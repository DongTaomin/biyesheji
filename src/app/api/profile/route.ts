import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getAuthUser,
  prisma,
  toPublicUser,
} from '@/lib/auth-server';
import {
  MAX_AVATAR_BASE64_BYTES,
  MAX_BIO_LENGTH,
  type ProfileUpdatePayload,
} from '@/lib/auth-types';

const imageDataUrlPattern = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i;

const profileUpdateSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, '用户名至少 3 个字符')
      .max(20, '用户名最多 20 个字符')
      .regex(/^[\u4e00-\u9fa5\w]+$/, '用户名仅支持中文、字母、数字和下划线')
      .optional(),
    bio: z
      .string()
      .trim()
      .max(MAX_BIO_LENGTH, `简介不能超过 ${MAX_BIO_LENGTH} 个字符`)
      .nullable()
      .optional(),
    avatar: z
      .string()
      .refine((value) => imageDataUrlPattern.test(value), '头像格式不支持')
      .nullable()
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.username === undefined && value.bio === undefined && value.avatar === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '请至少修改一项资料',
      });
    }
  });

function normalizeProfilePayload(payload: ProfileUpdatePayload) {
  return {
    username: payload.username?.trim(),
    bio: payload.bio === undefined ? undefined : payload.bio?.trim() || null,
    avatar: payload.avatar === undefined ? undefined : payload.avatar || null,
  };
}

function getAvatarBytes(dataUrl: string) {
  const base64Content = dataUrl.split(',')[1] ?? '';
  return Buffer.byteLength(base64Content, 'base64');
}

export async function PATCH(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ success: false, error: '请先登录后再修改资料' }, { status: 401 });
    }

    const rawBody = (await request.json()) as ProfileUpdatePayload;
    const normalizedBody = normalizeProfilePayload(rawBody);
    const result = profileUpdateSchema.safeParse(normalizedBody);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error.issues[0]?.message ?? '请求参数不合法' }, { status: 400 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: authUser.sub },
    });

    if (!currentUser) {
      return NextResponse.json({ success: false, error: '当前用户不存在' }, { status: 404 });
    }

    const { username, bio, avatar } = result.data;

    if (username && username !== currentUser.username) {
      const existingUser = await prisma.user.findUnique({
        where: { username },
      });

      if (existingUser) {
        return NextResponse.json({ success: false, error: '该用户名已被使用' }, { status: 409 });
      }
    }

    if (avatar) {
      const bytes = getAvatarBytes(avatar);
      if (bytes > MAX_AVATAR_BASE64_BYTES) {
        return NextResponse.json({ success: false, error: '头像不能超过约 300KB' }, { status: 400 });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        ...(username !== undefined ? { username } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(avatar !== undefined ? { avatar } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        user: toPublicUser(updatedUser),
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: '服务器内部错误' }, { status: 500 });
  }
}
