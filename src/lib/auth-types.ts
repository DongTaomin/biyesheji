import type { JWTPayload as JoseJWTPayload } from 'jose';

export type UserRole = 'USER' | 'ADMIN';

export type PublicUser = {
  id: string;
  email: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  role: UserRole;
  createdAt: string;
};

export type JWTPayload = JoseJWTPayload & {
  sub: string;
  email: string;
  username: string;
  role: UserRole;
};

export type AuthSuccessResponse = {
  success: true;
  data: {
    user: PublicUser;
  };
};

export type AuthErrorResponse = {
  success: false;
  error: string;
};

export type AuthApiResponse = AuthSuccessResponse | AuthErrorResponse;

export type AuthResult = {
  user?: PublicUser;
  error?: string;
};
