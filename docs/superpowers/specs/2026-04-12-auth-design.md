# 登录功能设计规范

**日期：** 2026-04-12  
**作者：** TraeCli  
**状态：** 已确认，待实施  
**范围：** 认证层（注册 / 登录 / 登出 / 会话读取），不涉及创作数据迁移

---

## 1. 背景与目标

### 背景

当前项目（长大写作平台）为多用户 AI 小说创作平台，但完全没有用户认证基础设施：

- 无用户注册/登录流程
- 无 Session / JWT 管理
- 无路由保护
- 创作数据（章节、角色卡、世界观）全部存储在浏览器 LocalStorage / IndexedDB

### 本次目标

实现完整的**认证层**，为后续多用户功能（社区发布、个人主页、云同步）奠定基础：

1. 用户可注册账号（邮箱 + 用户名 + 密码）
2. 用户可登录，获得 7 天有效的 JWT 会话
3. 用户可登出
4. 前端全局感知登录状态（Header 显示用户信息 / 登录按钮）
5. API 可校验当前用户身份（供后续功能使用）

**本次不做：**
- 创作数据迁移到数据库
- 路由强制保护（middleware 文件建好但不启用）
- 第三方 OAuth（GitHub/Google）
- 密码重置 / 邮箱验证

---

## 2. 技术选型

| 层次 | 技术 | 理由 |
|------|------|------|
| ORM | Prisma | 类型安全、迁移工具完善、可无缝切换 PostgreSQL/MySQL |
| 数据库 | SQLite | 零外部依赖、文件即数据库、适合开发和毕设演示 |
| 密码哈希 | bcryptjs | 纯 JS 实现，无 native 依赖，salt rounds=12 |
| JWT | jose | Edge Runtime 兼容，无 Node.js crypto 问题，支持 HS256 |
| 表单验证 | zod + react-hook-form | 项目已有，保持一致 |
| UI 组件 | shadcn/ui | 项目已有 Dialog / Form / Input / Button / Tabs / Alert |

**新增依赖：**
```
prisma            (devDependency)
@prisma/client
bcryptjs
@types/bcryptjs   (devDependency)
jose
```

---

## 3. 数据模型

### 3.1 Prisma Schema

文件路径：`prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// 注意：Prisma 在 SQLite 中使用字符串字段模拟 enum（SQLite 无原生 enum 类型）
// 迁移到 PostgreSQL/MySQL 时，Prisma 会自动生成真正的 enum 类型，无需手动修改 schema
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  username  String   @unique
  password  String           // bcryptjs hash，salt=12
  avatar    String?          // 头像 URL，可选
  bio       String?          // 个人简介，可选
  role      Role     @default(USER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum Role {
  USER
  ADMIN
}
```

### 3.2 设计决策

- `id` 使用 `cuid()` 而非自增整数：URL 安全、不可枚举、全局唯一
- Session **不入库**：使用无状态 JWT，存入 httpOnly Cookie，无需 Session 表
- `role` 字段预留，默认 USER，本次主流程不使用
- `avatar`/`bio` 为可选字段，注册时不填，后续个人资料页补充

### 3.3 环境变量

文件：`.env.local`（不提交 git，`.gitignore` 需同时加入 `prisma/dev.db`）

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="<随机生成的 32+ 字节字符串>"
```

> **生成 JWT_SECRET 示例：** `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## 4. API 路由设计

所有路由位于 `src/app/api/auth/`（Next.js 15 App Router）。

### 4.1 端点列表

| 方法 | 路径 | 功能 | 认证要求 |
|------|------|------|---------|
| `POST` | `/api/auth/register` | 注册新用户 | 无 |
| `POST` | `/api/auth/login` | 登录，签发 JWT Cookie | 无 |
| `POST` | `/api/auth/logout` | 登出，清除 Cookie | 无（清除即可）|
| `GET` | `/api/auth/me` | 读取当前会话用户信息 | 需要有效 Cookie |

### 4.2 统一响应结构

```typescript
// 成功
{ success: true, data: { user: PublicUser } }

// 失败
{ success: false, error: string }  // HTTP 400 / 401 / 409 / 500
```

`PublicUser` 类型（不含 password，定义在 `src/lib/auth-types.ts`）：
```typescript
type PublicUser = {
  id: string;
  email: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  role: 'USER' | 'ADMIN';
  createdAt: string;
}
```

### 4.3 端点详情

#### POST /api/auth/register

**Request Body：**
```json
{ "email": "user@example.com", "username": "张三", "password": "secret123" }
```

**校验规则（Zod）：**
- `email`：合法邮箱格式
- `username`：3-20 字符，仅允许字母、数字、中文、下划线
- `password`：≥8 字符（有意简化，生产环境应增加大小写/数字/特殊字符复杂度校验）

**成功：** HTTP 201，返回 PublicUser，**同时设置 JWT Cookie**（注册即登录）

**失败场景：**
- 邮箱已注册 → HTTP 409，`"该邮箱已被注册"`
- 用户名已占用 → HTTP 409，`"该用户名已被使用"`
- 校验失败 → HTTP 400，Zod 错误信息

---

#### POST /api/auth/login

**Request Body：**
```json
{ "email": "user@example.com", "password": "secret123" }
```

**成功：** HTTP 200，返回 PublicUser，设置 JWT Cookie

**失败场景：**
- 邮箱不存在或密码错误 → HTTP 401，`"邮箱或密码错误"`（统一，防枚举）
- 注：本次不实现登录限速（毕设范围），生产环境应在此处添加 IP 频率限制

---

#### POST /api/auth/logout

无 body，清除 `auth_token` Cookie。

**成功：** HTTP 200，`{ success: true }`

---

#### GET /api/auth/me

读取 `auth_token` Cookie，验证 JWT，返回用户信息。

**成功：** HTTP 200，返回 PublicUser

**失败：** HTTP 401，`"未登录"`（Cookie 不存在或 JWT 无效）

---

### 4.4 JWT 配置

```typescript
// Cookie 属性
{
  name: 'auth_token',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 7  // 单位：秒，等于 7 天
}

// JWT Payload
{
  sub: user.id,
  email: user.email,
  username: user.username,
  role: user.role
}

// 签名算法：HS256
// 过期时间：'7d'（必须与 Cookie maxAge 保持一致，两处同步修改）
```

### 4.5 服务端工具 `src/lib/auth-server.ts` 接口

该文件为纯服务端模块（顶部不加 `'use client'`，仅在 API Route / Server Component 中使用）：

```typescript
// Prisma 单例（避免开发模式热重载导致连接泄漏）
export function getPrismaClient(): PrismaClient

// JWT 签发（返回签名后的 token 字符串）
export async function signJWT(payload: JWTPayload): Promise<string>

// JWT 验证（返回 payload 或 null）
export async function verifyJWT(token: string): Promise<JWTPayload | null>

// 在 NextResponse 上设置认证 Cookie
export function setAuthCookie(response: NextResponse, token: string): void

// 清除认证 Cookie
export function clearAuthCookie(response: NextResponse): void

// 从 Request 中读取并验证 JWT，返回用户信息或 null
export async function getAuthUser(request: NextRequest): Promise<JWTPayload | null>
```

---

## 5. 前端组件架构

### 5.1 新增文件

```
src/lib/auth-types.ts           # 认证相关类型（PublicUser、AuthState）— 无 'use server'，客户端/服务端均可导入
src/lib/auth-client.ts          # 前端认证 fetch 工具函数（封装 /api/auth/* 调用）
src/hooks/useAuth.ts            # React Context + useAuth Hook
src/components/AuthProvider.tsx # 全局 Context Provider
src/components/AuthDialog.tsx   # 登录/注册弹窗
src/components/UserMenu.tsx     # 已登录状态头像下拉菜单
src/middleware.ts               # 路由保护（预留框架，不启用保护规则）
```

> **重要：** 认证相关类型必须放在独立的 `auth-types.ts` 中，**不能追加到现有的 `src/lib/types.ts`**，因为后者顶部有 `'use server'` 指令，客户端组件无法导入。

### 5.2 修改已有文件

```
src/components/Providers.tsx    # 加入 <AuthProvider> 包裹（~3行改动）
                                # 同时修复已有的重复 <Toaster /> 问题
src/components/Header.tsx       # 加入登录按钮 / UserMenu（~15行改动）
```

### 5.3 `src/lib/auth-client.ts` 接口

封装所有对认证 API 的 fetch 调用，供 `useAuth.ts` 使用：

```typescript
// 调用 POST /api/auth/login
export async function apiLogin(email: string, password: string): Promise<{ user?: PublicUser; error?: string }>

// 调用 POST /api/auth/register
export async function apiRegister(email: string, username: string, password: string): Promise<{ user?: PublicUser; error?: string }>

// 调用 POST /api/auth/logout
export async function apiLogout(): Promise<void>

// 调用 GET /api/auth/me
export async function apiGetMe(): Promise<PublicUser | null>
```

### 5.4 数据流

```
页面挂载
  └─ AuthProvider.useEffect
       └─ apiGetMe() → GET /api/auth/me
            ├─ 成功 → setUser(data.user)
            └─ 失败(401) → setUser(null)

Header
  └─ useAuth().user
       ├─ isLoading=true → 骨架/空白占位
       ├─ null           → <Button onClick={openAuthDialog}>登录</Button>
       └─ 有值           → <UserMenu user={user} onLogout={logout} />

UserMenu（已登录）
  ├─ 显示头像（无头像时显示用户名首字）+ 用户名
  ├─ 点击"个人资料"→ /profile（预留路由）
  └─ 点击"退出登录"→ apiLogout() → setUser(null)

AuthDialog（弹窗）
  ├─ Tab "登录"
  │    └─ Form: email + password
  │         └─ apiLogin()
  │              ├─ 成功 → setUser(user) + 关闭弹窗 + Toast "登录成功"
  │              └─ 失败 → Alert 显示错误信息（如"邮箱或密码错误"）
  └─ Tab "注册"
       └─ Form: email + username + password + confirmPassword（前端校验一致性）
            └─ apiRegister()
                 ├─ 成功 → setUser(user) + 关闭弹窗 + Toast "注册成功，欢迎 {username}"
                 └─ 失败 → Alert 显示错误信息（如"该邮箱已被注册"）
```

### 5.5 useAuth Hook 接口

```typescript
interface AuthContextValue {
  user: PublicUser | null;
  isLoading: boolean;          // 初始化 /me 请求期间为 true
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (email: string, username: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
}

// 使用方式
const { user, isLoading, login, register, logout } = useAuth();
```

---

## 6. 安全策略

| 威胁 | 防御措施 |
|------|---------|
| 密码泄露 | bcryptjs hash，salt=12，数据库只存哈希值，绝不明文 |
| XSS 窃取 Token | JWT 存 `httpOnly` Cookie，JavaScript 无法读取 |
| CSRF 攻击 | Cookie `SameSite=Lax`，POST 需 `Content-Type: application/json`，浏览器表单无法跨站伪造 |
| 用户枚举 | 登录失败统一返回"邮箱或密码错误"，不区分是邮箱不存在还是密码错误 |
| JWT 伪造 | HS256 + 强随机 JWT_SECRET（≥32字节），存 `.env.local` 不入 git |
| SQL 注入 | Prisma ORM 参数化查询，无原始 SQL |
| 暴力破解 | **有意简化**（毕设范围），生产环境应在登录接口添加 IP 频率限制 |
| 密码强度 | 仅要求 ≥8 字符（**有意简化**），生产环境应要求大小写+数字+特殊字符混合 |

---

## 7. 文件结构总览

```
dog-Engine/
├── prisma/
│   ├── schema.prisma          # 数据库模型
│   └── dev.db                 # SQLite 数据库文件（需加入 .gitignore）
├── src/
│   ├── app/
│   │   └── api/
│   │       └── auth/
│   │           ├── register/
│   │           │   └── route.ts
│   │           ├── login/
│   │           │   └── route.ts
│   │           ├── logout/
│   │           │   └── route.ts
│   │           └── me/
│   │               └── route.ts
│   ├── components/
│   │   ├── AuthProvider.tsx   # 新增
│   │   ├── AuthDialog.tsx     # 新增
│   │   ├── UserMenu.tsx       # 新增
│   │   ├── Providers.tsx      # 修改（加 AuthProvider，修复重复 Toaster）
│   │   └── Header.tsx         # 修改（加登录按钮/UserMenu）
│   ├── hooks/
│   │   └── useAuth.ts         # 新增
│   ├── middleware.ts           # 新增（预留框架，不启用保护规则）
│   └── lib/
│       ├── auth-types.ts      # 新增（PublicUser、AuthState 等认证类型）
│       ├── auth-client.ts     # 新增（前端 fetch 工具）
│       └── auth-server.ts     # 新增（服务端 JWT 工具函数，仅服务端使用）
└── .env.local                  # 修改（追加 DATABASE_URL, JWT_SECRET）
```

> **注意：** `src/middleware.ts` 位于 `src/` 目录下（与项目 `src/` 源码目录结构一致），Next.js 15 同时支持根目录和 `src/` 目录下的 middleware。

---

## 8. 实施顺序

1. 安装依赖（`prisma`、`@prisma/client`、`bcryptjs`、`@types/bcryptjs`、`jose`）
2. 更新 `.gitignore`，加入 `prisma/dev.db`
3. 配置 `.env.local`（`DATABASE_URL`、`JWT_SECRET`）
4. 创建 `prisma/schema.prisma`，运行 `npx prisma migrate dev --name init`
   - 该命令会自动触发 `prisma generate`，生成 `@prisma/client`
5. 实现服务端工具 `src/lib/auth-server.ts`（Prisma 单例、JWT 签发/验证、Cookie 工具）
6. 实现 4 个 API 路由（register → login → logout → me）
7. 新建 `src/lib/auth-types.ts`（`PublicUser`、`AuthState`、`JWTPayload` 类型）
8. 实现前端工具 `src/lib/auth-client.ts`（封装 fetch 调用）
9. 实现 `src/hooks/useAuth.ts` + `src/components/AuthProvider.tsx`
10. 实现 `src/components/AuthDialog.tsx`（登录/注册弹窗）
11. 实现 `src/components/UserMenu.tsx`（头像下拉菜单）
12. 修改 `src/components/Providers.tsx`（加 `<AuthProvider>`，修复重复 `<Toaster />`）
13. 修改 `src/components/Header.tsx`（加登录按钮/UserMenu）
14. 创建 `src/middleware.ts`（预留框架，`matcher` 注释掉）
15. 端到端测试验证

---

## 9. 验收标准

**功能验收：**
- [ ] 用户可以用邮箱+用户名+密码成功注册
- [ ] 注册成功后自动登录，Header 右上角显示用户名
- [ ] 用户可以登出，Header 恢复显示"登录"按钮
- [ ] 刷新页面后登录状态持久（Cookie 有效期 7 天内）
- [ ] 重复邮箱注册返回"该邮箱已被注册"
- [ ] 重复用户名注册返回"该用户名已被使用"
- [ ] 密码错误登录返回"邮箱或密码错误"（不暴露具体原因）

**UI 验收：**
- [ ] 登录/注册 Tab 切换流畅
- [ ] 表单校验错误实时显示在对应字段下方
- [ ] API 错误信息显示在表单顶部 Alert 中
- [ ] 注册成功 Toast："注册成功，欢迎 {username}"
- [ ] 已登录用户头像下拉菜单正常显示

**安全验收：**
- [ ] `auth_token` Cookie 在浏览器 DevTools → Application → Cookies 中显示 `HttpOnly` 标记
- [ ] `document.cookie` 在控制台执行不返回 `auth_token`
- [ ] `/api/auth/me` 在未登录时返回 HTTP 401
