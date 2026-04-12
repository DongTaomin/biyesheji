# 登录功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于 Prisma + SQLite + 自定义 JWT（jose）实现完整的用户注册、登录、登出及会话保持功能。

**Architecture:**
- **数据层**：Prisma ORM 连接 SQLite 数据库（最小化两张表：User, Role）。
- **服务端**：Next.js App Router 提供 RESTful API 接口，使用无状态 JWT（通过 httpOnly Cookie 传递）来管理会话，bcryptjs 处理密码哈希。
- **客户端**：React Context + `useAuth` Hook 统一管理全局登录状态，通过 shadcn/ui 提供登录/注册弹窗交互。

**Tech Stack:**
- Next.js 15 (App Router)
- Prisma ORM + SQLite
- `bcryptjs` (密码哈希)
- `jose` (JWT 处理)
- `zod` + `react-hook-form` (前端表单)
- Tailwind CSS + shadcn/ui

---

## 预备知识与前提约束

1. **零配置测试优先**：由于本项目重点在集成验证，每完成一个重要模块需要确保它能被编译或通过特定端点/UI测试通过。
2. **纯 Edge 兼容的 JWT**：为了避免 Node.js `crypto` 模块在 Edge Runtime（如 middleware）中的兼容问题，必须且只能使用 `jose` 库处理 JWT。
3. **隔离的服务端与客户端类型**：`src/lib/types.ts` 具有 `'use server'` 指令，因此绝对不能在客户端组件中导入它。新建的认证相关类型必须放在无指令的 `src/lib/auth-types.ts` 中。

---

### Task 1: 依赖安装与数据库初始化

搭建底层环境，确保 Prisma Schema 正确并完成初次迁移。

**Files:**
- Create: `prisma/schema.prisma`
- Modify: `.gitignore`
- Modify: `package.json`

- [ ] **Step 1: 安装必要依赖**

```bash
npm install @prisma/client bcryptjs jose
npm install -D prisma @types/bcryptjs
```

- [ ] **Step 2: 创建并配置 Prisma Schema**

Create `prisma/schema.prisma` with content:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  username  String   @unique
  password  String
  avatar    String?
  bio       String?
  role      String   @default("USER")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

*Note: 使用了 String 类型替代 Enum，避免 SQLite 枚举兼容问题。*

- [ ] **Step 3: 更新 `.gitignore` 和环境变量**

修改 `.gitignore`，在文件末尾追加：
```text
# Prisma SQLite
prisma/dev.db
prisma/dev.db-journal
```

确保本地有 `.env.local` 且包含（如果没有，通过 Bash 创建）：
```bash
echo 'DATABASE_URL="file:./dev.db"' >> .env.local
echo "JWT_SECRET=\"$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")\"" >> .env.local
```

- [ ] **Step 4: 运行数据库迁移并生成 Client**

```bash
npx prisma migrate dev --name init
```

*Expected: 提示迁移成功，并自动生成 Prisma Client。*

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json prisma/ .gitignore .env.local
git commit -m "chore: 安装认证相关依赖并初始化 Prisma SQLite"
```

---

### Task 2: 服务端认证工具实现

提供与请求环境解耦的核心服务端功能（Prisma 单例、密码哈希、JWT 签发校验、Cookie 操作）。

**Files:**
- Create: `src/lib/auth-types.ts`
- Create: `src/lib/auth-server.ts`

- [ ] **Step 1: 定义客户端/服务端共享的认证类型**

Create `src/lib/auth-types.ts`:

```typescript
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
```

- [ ] **Step 2: 实现服务端认证工具**

Create `src/lib/auth-server.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { SignJWT, jwtVerify } from 'jose';
import { NextResponse, NextRequest } from 'next/server';
import { JWTPayload } from './auth-types';

// 1. Prisma 单例
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// 2. JWT 工具
const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret_for_development_only');
const alg = 'HS256';
const cookieName = 'auth_token';

export async function signJWT(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as JWTPayload;
  } catch (error) {
    return null;
  }
}

// 3. Cookie 管理
export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    name: cookieName,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set({
    name: cookieName,
    value: '',
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });
}

// 4. 便捷获取当前用户身份
export async function getAuthUser(request: NextRequest): Promise<JWTPayload | null> {
  const token = request.cookies.get(cookieName)?.value;
  if (!token) return null;
  return verifyJWT(token);
}
```

- [ ] **Step 3: 运行类型检查以验证（静默通过即可）**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth-types.ts src/lib/auth-server.ts
git commit -m "feat: 实现服务端 JWT 与 Prisma 工具函数"
```

---

### Task 3: 注册与登录 API 路由实现

构建对外暴露的认证 REST 接口。

**Files:**
- Create: `src/app/api/auth/register/route.ts`
- Create: `src/app/api/auth/login/route.ts`

- [ ] **Step 1: 实现注册 API**

Create `src/app/api/auth/register/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma, signJWT, setAuthCookie } from '@/lib/auth-server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { PublicUser } from '@/lib/auth-types';

const registerSchema = z.object({
  email: z.string().email('无效的邮箱格式'),
  username: z.string().min(3, '用户名至少3个字符').max(20, '用户名最多20个字符'),
  password: z.string().min(8, '密码至少8个字符'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = registerSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error.errors[0].message }, { status: 400 });
    }

    const { email, username, password } = result.data;

    // 检查冲突
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    });

    if (existingUser) {
      const field = existingUser.email === email ? '邮箱' : '用户名';
      return NextResponse.json({ success: false, error: `该${field}已被使用` }, { status: 409 });
    }

    // 创建用户
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, username, password: hashedPassword },
    });

    const publicUser: PublicUser = {
      id: user.id, email: user.email, username: user.username,
      avatar: user.avatar, bio: user.bio, role: user.role,
      createdAt: user.createdAt.toISOString(),
    };

    const token = await signJWT({ sub: user.id, email: user.email, username: user.username, role: user.role });
    const response = NextResponse.json({ success: true, data: { user: publicUser } }, { status: 201 });
    
    setAuthCookie(response, token);
    return response;

  } catch (error) {
    return NextResponse.json({ success: false, error: '服务器内部错误' }, { status: 500 });
  }
}
```

- [ ] **Step 2: 实现登录 API**

Create `src/app/api/auth/login/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma, signJWT, setAuthCookie } from '@/lib/auth-server';
import bcrypt from 'bcryptjs';
import { PublicUser } from '@/lib/auth-types';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ success: false, error: '请提供邮箱和密码' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ success: false, error: '邮箱或密码错误' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json({ success: false, error: '邮箱或密码错误' }, { status: 401 });
    }

    const publicUser: PublicUser = {
      id: user.id, email: user.email, username: user.username,
      avatar: user.avatar, bio: user.bio, role: user.role,
      createdAt: user.createdAt.toISOString(),
    };

    const token = await signJWT({ sub: user.id, email: user.email, username: user.username, role: user.role });
    const response = NextResponse.json({ success: true, data: { user: publicUser } });
    
    setAuthCookie(response, token);
    return response;

  } catch (error) {
    return NextResponse.json({ success: false, error: '服务器内部错误' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/register src/app/api/auth/login
git commit -m "feat: 实现用户注册与登录 API"
```

---

### Task 4: 登出与读取会话 API 实现

实现状态清除以及供前端初始化校验身份的端点。

**Files:**
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/api/auth/me/route.ts`

- [ ] **Step 1: 实现 Logout API**

Create `src/app/api/auth/logout/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth-server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  clearAuthCookie(response);
  return response;
}
```

- [ ] **Step 2: 实现 Me API (Session 读取)**

Create `src/app/api/auth/me/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, prisma } from '@/lib/auth-server';
import { PublicUser } from '@/lib/auth-types';

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);
    if (!payload) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 401 });
    }

    const publicUser: PublicUser = {
      id: user.id, email: user.email, username: user.username,
      avatar: user.avatar, bio: user.bio, role: user.role,
      createdAt: user.createdAt.toISOString(),
    };

    return NextResponse.json({ success: true, data: { user: publicUser } });
  } catch (error) {
    return NextResponse.json({ success: false, error: '服务器内部错误' }, { status: 500 });
  }
}
```

- [ ] **Step 3: 测试这 4 个 API 的可用性（无需UI的脚本请求或 cURL）**

*(开发工具自动检验语法即可)*

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/logout src/app/api/auth/me
git commit -m "feat: 实现登出与会话读取 API"
```

---

### Task 5: 前端全局认证 Context 搭建

封装客户端 API 调用逻辑，利用 Context 为全局提供认证状态。

**Files:**
- Create: `src/lib/auth-client.ts`
- Create: `src/hooks/useAuth.ts`
- Create: `src/components/AuthProvider.tsx`
- Modify: `src/components/Providers.tsx`

- [ ] **Step 1: 创建客户端 API 调用层**

Create `src/lib/auth-client.ts`:

```typescript
import { PublicUser } from './auth-types';

type AuthResponse = { success: boolean; data?: { user: PublicUser }; error?: string };

export async function apiLogin(email: string, password: string): Promise<{ user?: PublicUser; error?: string }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data: AuthResponse = await res.json();
  return data.success ? { user: data.data!.user } : { error: data.error };
}

export async function apiRegister(email: string, username: string, password: string): Promise<{ user?: PublicUser; error?: string }> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username, password }),
  });
  const data: AuthResponse = await res.json();
  return data.success ? { user: data.data!.user } : { error: data.error };
}

export async function apiLogout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}

export async function apiGetMe(): Promise<PublicUser | null> {
  try {
    const res = await fetch('/api/auth/me', { method: 'GET' });
    const data: AuthResponse = await res.json();
    return data.success ? data.data!.user : null;
  } catch (e) {
    return null;
  }
}
```

- [ ] **Step 2: 创建 React Context 与 Hook**

Create `src/hooks/useAuth.ts`:

```typescript
'use client';
import { createContext, useContext } from 'react';
import { PublicUser } from '@/lib/auth-types';

export interface AuthContextValue {
  user: PublicUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (email: string, username: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

- [ ] **Step 3: 创建 AuthProvider 状态组件**

Create `src/components/AuthProvider.tsx`:

```typescript
'use client';
import { useState, useEffect } from 'react';
import { PublicUser } from '@/lib/auth-types';
import { apiGetMe, apiLogin, apiRegister, apiLogout } from '@/lib/auth-client';
import { AuthContext } from '@/hooks/useAuth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    apiGetMe().then((u) => {
      if (mounted) {
        setUser(u);
        setIsLoading(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  const login = async (e: string, p: string) => {
    const res = await apiLogin(e, p);
    if (res.user) setUser(res.user);
    return res;
  };

  const register = async (e: string, u: string, p: string) => {
    const res = await apiRegister(e, u, p);
    if (res.user) setUser(res.user);
    return res;
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 4: 注入 AuthProvider**

Modify `src/components/Providers.tsx`:
*   Import `AuthProvider` from `@/components/AuthProvider`.
*   Wrap `{children}` with `<AuthProvider>`.

```tsx
'use client';

import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from './AuthProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-client.ts src/hooks/useAuth.ts src/components/AuthProvider.tsx src/components/Providers.tsx
git commit -m "feat: 增加前端 AuthContext 与全局状态供给"
```

---

### Task 6: 认证 UI 组件实现 (Dialog & Menu)

构建用户互动的界面核心。

**Files:**
- Create: `src/components/AuthDialog.tsx`
- Create: `src/components/UserMenu.tsx`
- Modify: `src/components/Header.tsx`

- [ ] **Step 1: 创建登录/注册弹窗**

Create `src/components/AuthDialog.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export function AuthDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 表单状态
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const resetForm = () => {
    setError('');
    setEmail('');
    setUsername('');
    setPassword('');
  };

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    resetForm();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      toast({ title: "登录成功" });
      onOpenChange(false);
      resetForm();
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await register(email, username, password);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      toast({ title: `注册成功，欢迎 ${username}!` });
      onOpenChange(false);
      resetForm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{activeTab === 'login' ? '账号登录' : '注册账号'}</DialogTitle>
          <DialogDescription>
            {activeTab === 'login' ? '登录以同步你的创作数据与配置' : '创建一个新账号，开启创作之旅'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">登录</TabsTrigger>
            <TabsTrigger value="register">注册</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
                <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? '处理中...' : '登录'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reg-email">邮箱</Label>
                <Input id="reg-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-username">用户名</Label>
                <Input id="reg-username" required minLength={3} value={username} onChange={e => setUsername(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password">密码</Label>
                <Input id="reg-password" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? '处理中...' : '注册'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: 创建 UserMenu 头像下拉组件**

Create `src/components/UserMenu.tsx`:

```tsx
'use client';

import { useAuth } from '@/hooks/useAuth';
import { PublicUser } from '@/lib/auth-types';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, User } from 'lucide-react';

export function UserMenu({ user }: { user: PublicUser }) {
  const { logout } = useAuth();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="outline-none">
        <Avatar className="h-8 w-8 cursor-pointer border border-primary/10 transition-opacity hover:opacity-80">
          <AvatarImage src={user.avatar || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {user.username.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.username}</p>
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" disabled>
          <User className="mr-2 h-4 w-4" />
          <span>个人主页 (开发中)</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-red-600 cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>退出登录</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 3: 将 UI 组件接入 Header**

Modify `src/components/Header.tsx`:
*   Import `useAuth`, `AuthDialog`, `UserMenu`, and `useState`.
*   Replace `{children}` (或在其旁) 添加用户认证状态入口。

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Logo from './Logo';
import { Button } from '@/components/ui/button';
import { AIProviderSettings } from './AIProviderSettings';
import { ThemeToggle } from './ThemeToggle';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { UserMenu } from './UserMenu';
import { AuthDialog } from './AuthDialog';
import { Skeleton } from '@/components/ui/skeleton';

type HeaderProps = {
  children?: React.ReactNode;
};

export default function Header({ children }: HeaderProps) {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  
  const isWritingPage = pathname?.startsWith('/books/');

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between px-2 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/">
              <Logo hideText={isMobile} />
            </Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          {!isWritingPage && <AIProviderSettings variant="ghost" showStatus={true} />}
          {children}

          {/* 用户认证区域 */}
          <div className="ml-1 pl-2 sm:ml-2 sm:pl-3 border-l h-6 flex items-center">
            {isLoading ? (
              <Skeleton className="h-8 w-8 rounded-full" />
            ) : user ? (
              <UserMenu user={user} />
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setAuthDialogOpen(true)}>
                登录
              </Button>
            )}
          </div>
        </div>
      </div>
      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </header>
  );
}
```

- [ ] **Step 4: 启动项目检查 UI (可选的手动步骤)**

```bash
npm run build && npm run start
```
*(验证：打开浏览器，应在右上角看到登录按钮，点击弹出弹窗)*

- [ ] **Step 5: Commit**

```bash
git add src/components/AuthDialog.tsx src/components/UserMenu.tsx src/components/Header.tsx
git commit -m "feat: 完成 AuthDialog 与 UserMenu UI，并接入 Header"
```

---

### Task 7: 建立中间件骨架

作为前瞻性步骤建立 Middleware 的框架结构，即使目前不主动限制任何路径。

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: 编写中间件结构**

Create `src/middleware.ts`:

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 预留的中间件逻辑
  // const token = request.cookies.get('auth_token')?.value;
  //
  // if (!token && request.nextUrl.pathname.startsWith('/profile')) {
  //   return NextResponse.redirect(new URL('/', request.url));
  // }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // '/profile/:path*',
    // '/settings/account',
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "chore: 添加中间件骨架结构以备后续扩展路由保护"
```