import { NextRequest, NextResponse } from "next/server";
import { autoGenerateContent } from "@/lib/ai/unified-client";

// ---------- Provider 1: ZeroGPT ----------
const ZEROGPT_API_URL = "https://api.zerogpt.com/api/detect/detectText";

async function detectWithZeroGPT(
  text: string
): Promise<{ avgAiProbability: number; avgHumanProbability: number }> {
  if (!process.env.ZEROGPT_API_KEY) {
    throw new Error("ZeroGPT: API key not configured");
  }

  const response = await fetch(ZEROGPT_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ApiKey: process.env.ZEROGPT_API_KEY,
    },
    body: JSON.stringify({ input_text: text }),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    const err = await response.text();
    const reason =
      response.status === 429 || response.status === 402
        ? "额度不足，回退下一服务"
        : `HTTP ${response.status}`;
    throw new Error(`ZeroGPT: ${reason} — ${err}`);
  }

  const data = await response.json();
  console.log("[ZeroGPT] raw response:", JSON.stringify(data));

  // ZeroGPT 可能返回多种结构，兼容处理
  // 结构1: { data: { fakePercentage: number } }
  // 结构2: { fakePercentage: number }
  // 结构3: { ai_generated_percent: number }
  const raw =
    data?.data?.fakePercentage ??
    data?.fakePercentage ??
    data?.data?.ai_generated_percent ??
    data?.ai_generated_percent ??
    null;

  const fakePercent = raw !== null ? parseFloat(String(raw)) : null;
  if (fakePercent === null || isNaN(fakePercent))
    throw new Error(
      `ZeroGPT: unexpected response shape — ${JSON.stringify(data)}`
    );

  return {
    avgAiProbability: fakePercent,
    avgHumanProbability: 100 - fakePercent,
  };
}

// ---------- Provider 2: Winston AI ----------
const WINSTON_API_URL = "https://api.gowinston.ai/v2/ai-content-detection";

async function detectWithWinston(
  text: string
): Promise<{ avgAiProbability: number; avgHumanProbability: number }> {
  if (!process.env.WINSTON_API_KEY) {
    throw new Error("Winston AI: API key not configured");
  }

  const response = await fetch(WINSTON_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.WINSTON_API_KEY}`,
    },
    body: JSON.stringify({ text, language: "zh" }),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    const err = await response.text();
    const reason =
      response.status === 429 || response.status === 402
        ? "额度不足，回退下一服务"
        : `HTTP ${response.status}`;
    throw new Error(`Winston AI: ${reason} — ${err}`);
  }

  const data = await response.json();
  // Winston 返回 { score, ... }  score 越高越像 AI（0-100）
  const score = typeof data?.score === "number" ? data.score : null;
  if (score === null) throw new Error("Winston AI: unexpected response shape");

  return {
    avgAiProbability: score,
    avgHumanProbability: 100 - score,
  };
}

// ---------- Provider 3: LLM fallback ----------
async function detectWithLLM(
  text: string
): Promise<{ avgAiProbability: number; avgHumanProbability: number }> {
  const prompt = `你是一个专业的AI内容检测专家。请分析以下文本，判断它是由AI生成还是由人类创作的。

文本内容：
"""
${text.slice(0, 3000)}
"""

请只返回一个JSON对象，格式如下（数值为0-100的整数，两者之和为100）：
{"avgAiProbability": <AI生成概率>, "avgHumanProbability": <人类原创概率>}

不要输出任何其他内容。`;

  const raw = await autoGenerateContent(prompt, { maxOutputTokens: 100 });

  // 提取 JSON
  const match = raw.match(/\{[^{}]*"avgAiProbability"[^{}]*\}/);
  if (!match) throw new Error("LLM fallback: cannot parse JSON from response");

  const parsed = JSON.parse(match[0]);
  const ai = Number(parsed.avgAiProbability);
  const human = Number(parsed.avgHumanProbability);

  if (isNaN(ai) || isNaN(human))
    throw new Error("LLM fallback: invalid numbers in response");

  return {
    avgAiProbability: Math.min(100, Math.max(0, ai)),
    avgHumanProbability: Math.min(100, Math.max(0, human)),
  };
}

// ---------- Main handler ----------
export async function POST(request: NextRequest) {
  const logPrefix = "[API/ai-detector]";
  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "请提供有效的文本内容" },
        { status: 400 }
      );
    }

    const errors: string[] = [];

    // 1. Winston AI（默认首选）
    try {
      console.log(`${logPrefix} Trying Winston AI...`);
      const result = await detectWithWinston(text.trim());
      console.log(`${logPrefix} Winston AI success:`, result);
      return NextResponse.json({ ...result, provider: "WinstonAI" });
    } catch (e: any) {
      console.warn(`${logPrefix} Winston AI failed:`, e.message);
      errors.push(`WinstonAI: ${e.message}`);
    }

    // 2. ZeroGPT
    try {
      console.log(`${logPrefix} Trying ZeroGPT...`);
      const result = await detectWithZeroGPT(text.trim());
      console.log(`${logPrefix} ZeroGPT success:`, result);
      return NextResponse.json({ ...result, provider: "ZeroGPT" });
    } catch (e: any) {
      console.warn(`${logPrefix} ZeroGPT failed:`, e.message);
      errors.push(`ZeroGPT: ${e.message}`);
    }

    // 3. LLM fallback
    try {
      console.log(`${logPrefix} Trying LLM fallback...`);
      const result = await detectWithLLM(text.trim());
      console.log(`${logPrefix} LLM fallback success:`, result);
      return NextResponse.json({ ...result, provider: "LLM" });
    } catch (e: any) {
      console.warn(`${logPrefix} LLM fallback failed:`, e.message);
      errors.push(`LLM: ${e.message}`);
    }

    // 全部失败
    return NextResponse.json(
      { error: `所有AI检测服务均不可用: ${errors.join(" | ")}` },
      { status: 503 }
    );
  } catch (error: any) {
    console.error(`${logPrefix} Internal Server Error:`, error);
    return NextResponse.json(
      { error: "处理请求时发生内部错误" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "不支持GET方法，请使用POST。" },
    { status: 405 }
  );
}
