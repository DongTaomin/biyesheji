import { NextResponse } from 'next/server';
import { prisma, signJWT, setAuthCookie } from '@/lib/auth-server';
import bcrypt from 'bcryptjs';
import { PublicUser } from '@/lib/auth-types';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ success: false, error: '请提供邮箱和密码' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ success: false, error: '邮箱或密码错误' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json({ success: false, error: '邮箱或密码错误' }, { status: 401 });
    }

    const publicUser: PublicUser = {
      id: user.id, email: user.email, username: user.username,
      avatar: user.avatar, bio: user.bio, role: user.role,
      createdAt: user.createdAt.toISOString(),
    };

    const token = await signJWT({ sub: user.id, email: user.email, username: user.username, role: user.role });
    const response = NextResponse.json({ success: true, data: { user: publicUser } });
    
    setAuthCookie(response, token);
    return response;

  } catch (error) {
    return NextResponse.json({ success: false, error: '服务器内部错误' }, { status: 500 });
  }
}
