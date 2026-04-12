import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAuthUserMock, findUniqueMock, updateMock } = vi.hoisted(() => ({
  getAuthUserMock: vi.fn(),
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock('@/lib/auth-server', () => ({
  getAuthUser: getAuthUserMock,
  prisma: {
    user: {
      findUnique: findUniqueMock,
      update: updateMock,
    },
  },
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

import { PATCH } from '../route';

describe('PATCH /api/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('未登录时返回 401', async () => {
    getAuthUserMock.mockResolvedValueOnce(null);

    const response = await PATCH(
      new Request('http://localhost/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'new_name' }),
      }) as any,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ success: false, error: '请先登录后再修改资料' });
  });

  it('用户名冲突时返回 409', async () => {
    getAuthUserMock.mockResolvedValueOnce({ sub: 'user-1' });
    findUniqueMock
      .mockResolvedValueOnce({
        id: 'user-1',
        email: 'demo@example.com',
      username: 'old_name',
      avatar: null,
      bio: null,
      role: 'USER',
      updatedAt: new Date('2026-04-12T10:00:00.000Z'),
      createdAt: new Date('2026-04-12T10:00:00.000Z'),
    })
      .mockResolvedValueOnce({
        id: 'user-2',
        email: 'other@example.com',
        username: 'taken_name',
      });

    const response = await PATCH(
      new Request('http://localhost/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'taken_name' }),
      }) as any,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ success: false, error: '该用户名已被使用' });
  });

  it('更新成功时返回最新用户信息', async () => {
    getAuthUserMock.mockResolvedValueOnce({ sub: 'user-1' });
    findUniqueMock.mockResolvedValueOnce({
      id: 'user-1',
      email: 'demo@example.com',
      username: 'old_name',
      avatar: null,
      bio: null,
      role: 'USER',
      updatedAt: new Date('2026-04-12T10:00:00.000Z'),
      createdAt: new Date('2026-04-12T10:00:00.000Z'),
    });
    updateMock.mockResolvedValueOnce({
      id: 'user-1',
      email: 'demo@example.com',
      username: 'new_name',
      avatar: 'data:image/png;base64,ZmFrZQ==',
      bio: '新的简介',
      role: 'USER',
      updatedAt: new Date('2026-04-12T10:00:00.000Z'),
      createdAt: new Date('2026-04-12T10:00:00.000Z'),
    });

    const response = await PATCH(
      new Request('http://localhost/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'new_name',
          bio: '新的简介',
          avatar: 'data:image/png;base64,ZmFrZQ==',
        }),
      }) as any,
    );

    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        username: 'new_name',
        bio: '新的简介',
        avatar: 'data:image/png;base64,ZmFrZQ==',
      },
    });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        user: {
          username: 'new_name',
          bio: '新的简介',
        },
      },
    });
  });
});
