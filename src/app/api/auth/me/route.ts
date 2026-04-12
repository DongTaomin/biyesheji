import { NextRequest, NextResponse } from 'next/server';

import { getAuthUser, prisma, toPublicUser } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      data: {
        user: toPublicUser(user),
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: '服务器内部错误' }, { status: 500 });
  }
}
