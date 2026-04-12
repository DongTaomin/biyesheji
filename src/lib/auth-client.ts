'use client';

import type { AuthApiResponse, AuthResult, ProfileUpdatePayload, PublicUser } from '@/lib/auth-types';

async function parseAuthResponse(response: Response): Promise<AuthResult> {
  const data = (await response.json().catch(() => null)) as AuthApiResponse | null;

  if (!data) {
    return { error: '服务响应异常，请稍后重试' };
  }

  if (!data.success) {
    return { error: data.error };
  }

  return { user: data.data.user };
}

export async function apiLogin(email: string, password: string): Promise<AuthResult> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ email, password }),
  });

  return parseAuthResponse(response);
}

export async function apiRegister(email: string, username: string, password: string): Promise<AuthResult> {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ email, username, password }),
  });

  return parseAuthResponse(response);
}

export async function apiLogout(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
  });
}

export async function apiGetMe(): Promise<PublicUser | null> {
  const response = await fetch('/api/auth/me', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  });

  const result = await parseAuthResponse(response);
  return result.user ?? null;
}

export async function apiUpdateProfile(payload: ProfileUpdatePayload): Promise<AuthResult> {
  const response = await fetch('/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });

  return parseAuthResponse(response);
}
