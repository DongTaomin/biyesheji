import { beforeEach, describe, expect, it, vi } from 'vitest';

const { compareMock, findUniqueMock, signJWTMock, setAuthCookieMock } = vi.hoisted(() => ({
  compareMock: vi.fn(),
  findUniqueMock: vi.fn(),
  signJWTMock: vi.fn(),
  setAuthCookieMock: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: compareMock,
  },
}));

vi.mock('@/lib/auth-server', () => ({
  prisma: {
    user: {
      findUnique: findUniqueMock,
    },
  },
  signJWT: signJWTMock,
  setAuthCookie: setAuthCookieMock,
  toPublicUser: (user: any) => ({
    id: user.id,
    email: user.email,
    username: user.username,
    avatar: user.avatar,
    bio: user.bio,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  }),
}));

import { POST } from '../login/route';

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('在密码错误时返回 401', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 'user-1',
      email: 'demo@example.com',
      username: 'demo',
      password: 'hashed-password',
      avatar: null,
      bio: null,
      role: 'USER',
      updatedAt: new Date('2026-04-12T10:00:00.000Z'),
      createdAt: new Date('2026-04-12T10:00:00.000Z'),
    });
    compareMock.mockResolvedValueOnce(false);

    const response = await POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@example.com', password: 'wrong' }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ success: false, error: '邮箱或密码错误' });
  });

  it('在登录成功时写入 cookie 并返回用户信息', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 'user-1',
      email: 'demo@example.com',
      username: 'demo',
      password: 'hashed-password',
      avatar: null,
      bio: '简介',
      role: 'USER',
      updatedAt: new Date('2026-04-12T10:00:00.000Z'),
      createdAt: new Date('2026-04-12T10:00:00.000Z'),
    });
    compareMock.mockResolvedValueOnce(true);
    signJWTMock.mockResolvedValueOnce('signed-token');

    const response = await POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@example.com', password: 'password123' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(signJWTMock).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'demo@example.com',
      username: 'demo',
      role: 'USER',
    });
    expect(setAuthCookieMock).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        user: {
          username: 'demo',
          bio: '简介',
        },
      },
    });
  });
});
