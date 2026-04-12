import { NextResponse } from 'next/server';
import { prisma, signJWT, setAuthCookie, toPublicUser } from '@/lib/auth-server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email('无效的邮箱格式'),
  username: z
    .string()
    .trim()
    .min(3, '用户名至少3个字符')
    .max(20, '用户名最多20个字符')
    .regex(/^[\u4e00-\u9fa5\w]+$/, '用户名仅支持中文、字母、数字和下划线'),
  password: z.string().min(8, '密码至少8个字符'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = registerSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error.errors[0].message }, { status: 400 });
    }

    const { email, username, password } = result.data;

    // 检查冲突
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    });

    if (existingUser) {
      const field = existingUser.email === email ? '邮箱' : '用户名';
      return NextResponse.json({ success: false, error: `该${field}已被使用` }, { status: 409 });
    }

    // 创建用户
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, username, password: hashedPassword },
    });

    const publicUser = toPublicUser(user);

    const token = await signJWT({ sub: user.id, email: user.email, username: user.username, role: publicUser.role });
    const response = NextResponse.json({ success: true, data: { user: publicUser } }, { status: 201 });
    
    setAuthCookie(response, token);
    return response;

  } catch (error) {
    return NextResponse.json({ success: false, error: '服务器内部错误' }, { status: 500 });
  }
}
