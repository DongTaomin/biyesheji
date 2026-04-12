export type PublicUser = {
  id: string;
  email: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  role: string;
  createdAt: string;
};

export type JWTPayload = {
  sub: string;
  email: string;
  username: string;
  role: string;
};
