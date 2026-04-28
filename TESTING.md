# 测试指南

## 快速开始

### 运行所有测试
```bash
npm test -- --run
```

### Watch 模式（开发时推荐）
```bash
npm test
# 修改文件后自动重新运行相关测试
```

### 运行特定测试文件
```bash
npm test -- src/lib/__tests__/gemini-client.test.ts
npm test -- src/lib/__tests__/jsonpath-parser.test.ts
```

### 运行匹配模式的测试
```bash
npm test -- --grep "parseJsonPath"
npm test -- --grep "Gemini"
```

---

## 测试框架配置

**框架**: [Vitest](https://vitest.dev/) v2.1.9  
**环境**: jsdom (浏览器环境模拟)  
**配置文件**: `vitest.config.mts`

### 配置特性
- ✅ 全局 `describe`, `it`, `expect` (无需导入)
- ✅ 路径别名支持 (`@/lib`)
- ✅ React 插件集成
- ✅ TypeScript 支持

---

## 测试文件结构

所有测试文件位于 `src/lib/__tests__/` 目录：

```
src/lib/
├── gemini-client.ts
├── jsonpath-parser.ts
├── utils.ts
├── file-utils.ts
├── proxy-fetch.ts
└── __tests__/
    ├── gemini-client.test.ts      ← 40+ 测试
    ├── jsonpath-parser.test.ts    ← 25 测试
    ├── utils.test.ts              ← 30 测试
    ├── file-utils.test.ts         ← 22 测试
    ├── proxy-fetch.test.ts        ← 10 测试
    ├── auth-client.test.ts        ← 3 测试
    └── rule-parser.test.ts        ← 10 测试
```

---

## 编写新测试

### 基本模板

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { yourFunction } from '../your-module'

describe('Module Name', () => {
  beforeEach(() => {
    // 每个测试前清理状态
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('should do something', () => {
    const result = yourFunction('input')
    expect(result).toBe('expected')
  })

  it('should handle error', () => {
    expect(() => yourFunction('bad')).toThrow()
  })
})
```

### Mock 策略

#### Mock fetch (API 调用)
```typescript
beforeEach(() => {
  global.fetch = vi.fn()
})

it('should call API', async () => {
  vi.mocked(global.fetch).mockResolvedValueOnce(
    new Response(JSON.stringify({ success: true }), { status: 200 })
  )

  const result = await apiFunction()
  expect(result.success).toBe(true)
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/'),
    expect.any(Object)
  )
})
```

#### Mock localStorage
```typescript
beforeEach(() => {
  localStorage.clear()
})

it('should save to localStorage', () => {
  saveValue('key', 'value')
  expect(localStorage.getItem('key')).toBe('value')
})
```

#### 纯函数测试（无 mock）
```typescript
it('should calculate correctly', () => {
  const result = pureFunction(1, 2)
  expect(result).toBe(3)
})
```

---

## 常见断言

```typescript
// 相等性
expect(value).toBe(expected)           // === 比较
expect(value).toEqual(expected)        // 深度比较
expect(value).toStrictEqual(expected)  // 严格深度比较

// 类型
expect(value).toHaveLength(5)
expect(value).toHaveProperty('key')
expect(value).toBeUndefined()
expect(value).toBeNull()

// 数字
expect(value).toBeGreaterThan(5)
expect(value).toBeLessThan(10)
expect(value).toBeCloseTo(0.3, 2)

// 字符串
expect(message).toMatch(/pattern/)
expect(message).toContain('substring')

// 数组
expect(array).toContain('item')
expect(array).toHaveLength(3)

// 函数
expect(() => func()).toThrow()
expect(() => func()).toThrow('message')

// Promise
await expect(promise).resolves.toBe(value)
await expect(promise).rejects.toThrow()
```

---

## 测试覆盖率

### 查看当前覆盖率
```bash
npm test -- --run --coverage
```

### 覆盖率目标
- 📊 **总体**: > 70%
- 🎯 **核心模块**: > 85%
- ✨ **关键路径**: > 90%

**核心模块** (优先级高):
- gemini-client.ts (AI 核心)
- jsonpath-parser.ts (书源解析)
- utils.ts (业务逻辑)

---

## CI/CD 集成

### GitHub Actions 配置示例
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm test -- --run
```

---

## 调试测试

### 运行单个测试
```bash
# 使用 .only 临时运行单个测试
it.only('specific test', () => {
  // 只运行这个测试
})

# 命令行运行
npm test -- --grep "specific test"
```

### 添加调试输出
```typescript
it('should work', () => {
  console.log('debugging info:', value)
  expect(value).toBe(expected)
})
```

### 进入调试模式
```bash
node --inspect-brk ./node_modules/vitest/vitest.mjs run
```

然后在 Chrome DevTools 中打开 `chrome://inspect`

---

## 性能测试

### 基准测试示例
```typescript
import { bench } from 'vitest'

bench('recursive search performance', () => {
  parseJsonPath(largeData, '$..[?(@.id)]')
})
```

运行：
```bash
npm test -- --run --bench
```

---

## 常见问题

### Q: 测试超时？
```typescript
it('slow test', async () => {
  // ...
}, 10000) // 10 秒超时
```

### Q: localStorage 在测试中不可用？
- Vitest jsdom 环境已内置 localStorage
- 使用 `beforeEach` 清理状态

### Q: Mock 不起作用？
```typescript
// ✅ 正确：在测试中设置 mock
beforeEach(() => {
  vi.mocked(global.fetch).mockResolvedValueOnce(...)
})

// ❌ 错误：在测试外设置
vi.mocked(global.fetch).mockResolvedValueOnce(...) // 这里会失效
```

### Q: 如何测试异步函数？
```typescript
// 方式 1: async/await
it('should handle async', async () => {
  const result = await asyncFunction()
  expect(result).toBe(expected)
})

// 方式 2: Promise
it('should handle promise', () => {
  return asyncFunction().then(result => {
    expect(result).toBe(expected)
  })
})

// 方式 3: expect().resolves
it('should handle promise', () => {
  return expect(asyncFunction()).resolves.toBe(expected)
})
```

---

## 测试清单

在提交代码前检查：

- [ ] 所有相关测试都通过：`npm test -- --run`
- [ ] 没有 console 错误/警告
- [ ] 新功能有对应的测试
- [ ] 修复的 bug 有测试用例防止回归
- [ ] 测试覆盖率未下降

---

## 相关资源

- 📖 [Vitest 官方文档](https://vitest.dev/)
- 🧪 [测试最佳实践](https://github.com/goldbergyoni/javascript-testing-best-practices)
- 📝 [本项目测试覆盖文档](./TEST_COVERAGE.md)

---

**更新于**: 2026-04-28  
**版本**: 1.0
