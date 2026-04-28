import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getApiKey,
  saveApiKey,
  clearApiKey,
  hasApiKey,
  listGeminiModels,
  generateContent,
  testApiKey,
  getDefaultModel,
  DEFAULT_MODELS,
} from '../gemini-client'

describe('Gemini Client', () => {
  beforeEach(() => {
    localStorage.clear()
    global.fetch = vi.fn()
    vi.clearAllMocks()
  })

  describe('API Key Management', () => {
    it('getApiKey 从 localStorage 获取', () => {
      localStorage.setItem('gemini-api-key', 'test-key-123')
      expect(getApiKey()).toBe('test-key-123')
    })

    it('getApiKey 不存在时返回 null', () => {
      expect(getApiKey()).toBeNull()
    })

    it('saveApiKey 保存到 localStorage', () => {
      saveApiKey('new-key')
      expect(localStorage.getItem('gemini-api-key')).toBe('new-key')
    })

    it('saveApiKey 去除前后空格', () => {
      saveApiKey('  key-with-spaces  ')
      expect(localStorage.getItem('gemini-api-key')).toBe('key-with-spaces')
    })

    it('clearApiKey 删除 localStorage 项', () => {
      localStorage.setItem('gemini-api-key', 'key')
      clearApiKey()
      expect(localStorage.getItem('gemini-api-key')).toBeNull()
    })

    it('hasApiKey 存在时返回 true', () => {
      localStorage.setItem('gemini-api-key', 'key')
      expect(hasApiKey()).toBe(true)
    })

    it('hasApiKey 不存在时返回 false', () => {
      expect(hasApiKey()).toBe(false)
    })

    it('hasApiKey 空字符串时返回 false', () => {
      localStorage.setItem('gemini-api-key', '')
      expect(hasApiKey()).toBe(false)
    })
  })

  describe('listGeminiModels', () => {
    it('成功获取模型列表', async () => {
      const mockResponse = {
        models: [
          {
            name: 'models/gemini-2.5-flash',
            displayName: 'Gemini 2.5 Flash',
            supportedGenerationMethods: ['generateContent'],
          },
          {
            name: 'models/gemini-2.5-pro',
            displayName: 'Gemini 2.5 Pro',
            supportedGenerationMethods: ['generateContent'],
          },
        ],
      }
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      )

      const models = await listGeminiModels('test-key')
      expect(models).toHaveLength(2)
      expect(models[0]).toHaveProperty('id')
      expect(models[0]).toHaveProperty('displayName')
    })

    it('API 密钥无效时返回 fallback 列表', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response('Invalid key', { status: 401 })
      )

      const models = await listGeminiModels('invalid-key')
      expect(models).toHaveLength(4)
      expect(models.some(m => m.id.includes('gemini-2.5-flash'))).toBe(true)
    })

    it('网络错误时返回 fallback 列表', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

      const models = await listGeminiModels('test-key')
      expect(models).toHaveLength(4)
      expect(models[0]).toHaveProperty('id')
    })

    it('无 API 密钥时抛出错误', async () => {
      await expect(listGeminiModels()).rejects.toThrow('请先配置Gemini API密钥')
    })

    it('使用 localStorage 中的密钥', async () => {
      localStorage.setItem('gemini-api-key', 'key-from-storage')
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('fail'))

      const models = await listGeminiModels()
      expect(models).toBeDefined()
    })
  })

  describe('generateContent', () => {
    it('成功生成内容', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'Generated content' }],
              role: 'model',
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 20,
          totalTokenCount: 30,
        },
      }
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      )

      const result = await generateContent('gemini-2.5-flash', 'Hello', {
        apiKey: 'test-key',
      })
      expect(result).toBe('Generated content')
    })

    it('无 API 密钥时抛出错误', async () => {
      await expect(generateContent('gemini-2.5-flash', 'test')).rejects.toThrow(
        '请先配置Gemini API密钥'
      )
    })

    it('candidates 为空时抛出错误', async () => {
      const mockResponse = { candidates: [] }
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      )

      await expect(
        generateContent('gemini-2.5-flash', 'test', { apiKey: 'key' })
      ).rejects.toThrow('模型未返回内容')
    })

    it('HTTP 错误会被正确处理', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response('Unauthorized', { status: 401 })
      )

      await expect(
        generateContent('gemini-2.5-flash', 'test', { apiKey: 'key' })
      ).rejects.toThrow()
    })

    it('HTTP 403 错误会抛出异常', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response('Forbidden', { status: 403 })
      )

      await expect(
        generateContent('gemini-2.5-flash', 'test', { apiKey: 'key' })
      ).rejects.toThrow()
    })

    it('HTTP 429 (限额) 错误会抛出异常', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response('Too Many Requests', { status: 429 })
      )

      await expect(
        generateContent('gemini-2.5-flash', 'test', { apiKey: 'key' })
      ).rejects.toThrow()
    })

    it('thinkingBudget 仅对 gemini-2.5 模型注入', async () => {
      const mockResponse = {
        candidates: [
          {
            content: { parts: [{ text: 'ok' }], role: 'model' },
            finishReason: 'STOP',
          },
        ],
      }
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      )

      await generateContent('gemini-2.5-flash', 'test', {
        apiKey: 'key',
        thinkingBudget: 10000,
      })

      const calls = vi.mocked(global.fetch).mock.calls
      const lastCall = calls[calls.length - 1]
      const body = JSON.parse(lastCall[1]?.body as string)
      expect(body.generationConfig?.thinkingConfig?.thinkingBudget).toBe(10000)
    })

    it('thinkingBudget 对非 gemini-2.5 模型不注入', async () => {
      const mockResponse = {
        candidates: [
          {
            content: { parts: [{ text: 'ok' }], role: 'model' },
            finishReason: 'STOP',
          },
        ],
      }
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      )

      await generateContent('gemini-1.5-pro', 'test', {
        apiKey: 'key',
        thinkingBudget: 10000,
      })

      const calls = vi.mocked(global.fetch).mock.calls
      const lastCall = calls[calls.length - 1]
      const body = JSON.parse(lastCall[1]?.body as string)
      expect(body.generationConfig?.thinkingConfig).toBeUndefined()
    })

    it('temperature 和 maxOutputTokens 配置正确', async () => {
      const mockResponse = {
        candidates: [
          {
            content: { parts: [{ text: 'ok' }], role: 'model' },
            finishReason: 'STOP',
          },
        ],
      }
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      )

      await generateContent('gemini-2.5-flash', 'test', {
        apiKey: 'key',
        temperature: 0.5,
        maxOutputTokens: 1000,
      })

      const calls = vi.mocked(global.fetch).mock.calls
      const lastCall = calls[calls.length - 1]
      const body = JSON.parse(lastCall[1]?.body as string)
      expect(body.generationConfig?.temperature).toBe(0.5)
      expect(body.generationConfig?.maxOutputTokens).toBe(1000)
    })
  })

  describe('testApiKey', () => {
    it('有效密钥返回 { valid: true }', async () => {
      const mockResponse = { models: [] }
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      )

      const result = await testApiKey('valid-key')
      expect(result).toEqual({ valid: true })
    })

    it('无效密钥返回 { valid: false, error }', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response('Unauthorized', { status: 401 })
      )

      const result = await testApiKey('invalid-key')
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error).toContain('401')
    })

    it('网络错误返回 { valid: false, error }', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

      const result = await testApiKey('test-key')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Network')
    })
  })

  describe('Default Models', () => {
    it('getDefaultModel 返回快速模型', () => {
      const model = getDefaultModel()
      expect(model).toBe(DEFAULT_MODELS.FAST)
    })

    it('DEFAULT_MODELS 包含 FAST 和 POWERFUL', () => {
      expect(DEFAULT_MODELS.FAST).toBe('gemini-2.5-flash-lite')
      expect(DEFAULT_MODELS.POWERFUL).toBe('gemini-2.5-pro')
    })
  })

  describe('System Instruction', () => {
    it('systemInstruction 作为第一条消息发送', async () => {
      const mockResponse = {
        candidates: [
          {
            content: { parts: [{ text: 'ok' }], role: 'model' },
            finishReason: 'STOP',
          },
        ],
      }
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      )

      await generateContent('gemini-2.5-flash', 'prompt', {
        apiKey: 'key',
        systemInstruction: 'You are helpful',
      })

      const calls = vi.mocked(global.fetch).mock.calls
      const lastCall = calls[calls.length - 1]
      const body = JSON.parse(lastCall[1]?.body as string)
      expect(body.contents[0].parts[0].text).toBe('You are helpful')
      expect(body.contents[1].parts[0].text).toBe('prompt')
    })
  })

  describe('Safety Settings', () => {
    it('安全设置被正确应用', async () => {
      const mockResponse = {
        candidates: [
          {
            content: { parts: [{ text: 'ok' }], role: 'model' },
            finishReason: 'STOP',
          },
        ],
      }
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      )

      await generateContent('gemini-2.5-flash', 'test', { apiKey: 'key' })

      const calls = vi.mocked(global.fetch).mock.calls
      const lastCall = calls[calls.length - 1]
      const body = JSON.parse(lastCall[1]?.body as string)
      expect(body.safetySettings).toBeDefined()
      expect(body.safetySettings.length).toBeGreaterThan(0)
    })
  })
})
