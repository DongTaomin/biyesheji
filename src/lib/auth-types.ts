import type { JWTPayload as JoseJWTPayload } from 'jose';

export type UserRole = 'USER' | 'ADMIN';

export const MAX_BIO_LENGTH = 300;
export const MAX_AVATAR_FILE_SIZE = 200 * 1024;
export const MAX_AVATAR_BASE64_BYTES = 300 * 1024;

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

export type ProfileUpdatePayload = {
  username?: string;
  bio?: string | null;
  avatar?: string | null;
};
