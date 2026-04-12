'use client';

import { useEffect, useMemo, useState } from 'react';

import { AuthContext } from '@/hooks/useAuth';
import { apiGetMe, apiLogin, apiLogout, apiRegister, apiUpdateProfile } from '@/lib/auth-client';
import type { ProfileUpdatePayload, PublicUser } from '@/lib/auth-types';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    const currentUser = await apiGetMe();
    setUser(currentUser);
  };

  useEffect(() => {
    let cancelled = false;

    async function bootstrapAuth() {
      try {
        const currentUser = await apiGetMe();
        if (!cancelled) {
          setUser(currentUser);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void bootstrapAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      login: async (email: string, password: string) => {
        const result = await apiLogin(email, password);
        if (result.user) {
          setUser(result.user);
        }
        return result;
      },
      register: async (email: string, username: string, password: string) => {
        const result = await apiRegister(email, username, password);
        if (result.user) {
          setUser(result.user);
        }
        return result;
      },
      updateProfile: async (payload: ProfileUpdatePayload) => {
        const result = await apiUpdateProfile(payload);
        if (result.user) {
          setUser(result.user);
        }
        return result;
      },
      refreshUser,
      logout: async () => {
        await apiLogout();
        setUser(null);
      },
    }),
    [isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
