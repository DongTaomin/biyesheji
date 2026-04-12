import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiGetMe, apiLogin, apiUpdateProfile } from '../auth-client';

describe('auth-client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it('能正确解析登录成功响应', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            user: {
              id: 'user-1',
              email: 'demo@example.com',
              username: 'demo_user',
              avatar: null,
              bio: null,
              role: 'USER',
              createdAt: '2026-04-12T10:00:00.000Z',
            },
          },
        }),
        { status: 200 },
      ),
    );

    const result = await apiLogin('demo@example.com', 'password123');

    expect(result.error).toBeUndefined();
    expect(result.user?.username).toBe('demo_user');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
      }),
    );
  });

  it('在 me 接口返回失败时返回 null', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, error: '未登录' }), { status: 401 }),
    );

    const result = await apiGetMe();

    expect(result).toBeNull();
  });

  it('能提交资料更新并返回最新用户', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            user: {
              id: 'user-1',
              email: 'demo@example.com',
              username: 'updated_name',
              avatar: 'data:image/png;base64,ZmFrZQ==',
              bio: '新的简介',
              role: 'USER',
              createdAt: '2026-04-12T10:00:00.000Z',
            },
          },
        }),
        { status: 200 },
      ),
    );

    const result = await apiUpdateProfile({
      username: 'updated_name',
      bio: '新的简介',
    });

    expect(result.user?.bio).toBe('新的简介');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/profile',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'same-origin',
      }),
    );
  });
});
