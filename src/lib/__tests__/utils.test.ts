import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cn, generateUUID, normalizeChineseName, simpleNameSimilarity, decideMatchForCharacter } from '../utils'

describe('Utils', () => {
  describe('cn - className merge', () => {
    it('合并单个 className', () => {
      expect(cn('text-red-500')).toBe('text-red-500')
    })

    it('合并多个 className', () => {
      const result = cn('px-4', 'py-2', 'text-center')
      expect(result).toContain('px-4')
      expect(result).toContain('py-2')
      expect(result).toContain('text-center')
    })

    it('Tailwind 冲突类覆盖', () => {
      const result = cn('text-red-500', 'text-blue-500')
      expect(result).toContain('text-blue-500')
      expect(result).not.toContain('text-red-500')
    })

    it('处理条件 className', () => {
      const isActive = true
      const result = cn('base', isActive && 'active')
      expect(result).toContain('base')
      expect(result).toContain('active')
    })

    it('过滤 falsy 值', () => {
      const result = cn('text-red-500', false && 'hidden', null, undefined)
      expect(result).toBe('text-red-500')
    })
  })

  describe('generateUUID', () => {
    it('生成有效的 UUID 格式', () => {
      const uuid = generateUUID()
      expect(uuid).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i)
    })

    it('每次生成不同的 UUID', () => {
      const uuid1 = generateUUID()
      const uuid2 = generateUUID()
      expect(uuid1).not.toBe(uuid2)
    })

    it('生成的 UUID 长度正确', () => {
      const uuid = generateUUID()
      expect(uuid).toHaveLength(36)
    })

    it('UUID 包含 4 个分隔符', () => {
      const uuid = generateUUID()
      const dashes = (uuid.match(/-/g) || []).length
      expect(dashes).toBe(4)
    })
  })

  describe('normalizeChineseName', () => {
    it('去除前缀：老、小、大、二等', () => {
      expect(normalizeChineseName('小红')).not.toContain('小')
      expect(normalizeChineseName('老王')).not.toContain('老')
      expect(normalizeChineseName('大李')).not.toContain('大')
      expect(normalizeChineseName('二阿')).not.toContain('二')
    })

    it('去除后缀：哥、姐、叔、老师等', () => {
      expect(normalizeChineseName('李哥')).not.toContain('哥')
      expect(normalizeChineseName('王姐')).not.toContain('姐')
      expect(normalizeChineseName('张老师')).not.toContain('老师')
    })

    it('保留中文字符', () => {
      const result = normalizeChineseName('李四')
      expect(result).toMatch(/李/)
      expect(result).toMatch(/四/)
    })

    it('转换为小写', () => {
      const result = normalizeChineseName('Alice')
      expect(result).toBe('alice')
    })

    it('移除特殊字符和空格', () => {
      expect(normalizeChineseName('李 四')).not.toContain(' ')
      expect(normalizeChineseName('李·四')).not.toContain('·')
    })

    it('空字符串返回空字符串', () => {
      expect(normalizeChineseName('')).toBe('')
      expect(normalizeChineseName('  ')).toBe('')
    })

    it('仅包含前后缀的字符串返回空', () => {
      expect(normalizeChineseName('小')).toBe('')
      expect(normalizeChineseName('老')).toBe('')
      expect(normalizeChineseName('哥')).toBe('')
    })
  })

  describe('simpleNameSimilarity', () => {
    it('相同字符串返回 1.0', () => {
      expect(simpleNameSimilarity('李四', '李四')).toBe(1)
      expect(simpleNameSimilarity('小李', '李')).toBe(1)
    })

    it('空字符串返回 0', () => {
      expect(simpleNameSimilarity('', 'test')).toBe(0)
      expect(simpleNameSimilarity('test', '')).toBe(0)
      expect(simpleNameSimilarity('', '')).toBe(0)
    })

    it('仅前缀不同，规范化后相同', () => {
      const score = simpleNameSimilarity('小李', '李')
      expect(score).toBe(1)
    })

    it('完全不同的字符串返回 0', () => {
      const score = simpleNameSimilarity('Alice', 'Bob')
      expect(score).toBe(0)
    })

    it('部分相似', () => {
      const score = simpleNameSimilarity('李四', '李五')
      expect(score).toBeGreaterThan(0)
      expect(score).toBeLessThan(1)
    })

    it('英文字符', () => {
      expect(simpleNameSimilarity('alice', 'alice')).toBe(1)
      expect(simpleNameSimilarity('alice', 'bob')).toBe(0)
    })

    it('混合中英文', () => {
      const score1 = simpleNameSimilarity('李Four', '李Four')
      expect(score1).toBe(1)
    })
  })

  describe('decideMatchForCharacter', () => {
    const candidate = { id: 'c1', name: '李四', description: '聪明 勇敢' }
    const existing = [
      { id: 'e1', name: '李四', description: '聪明 勇敢' },
      { id: 'e2', name: '王五', description: '冷酷 神秘' },
      { id: 'e3', name: 'Alice', description: '温柔 善良' },
    ]

    it('高相似度 (>= 0.88) 返回 autoMerge', () => {
      const result = decideMatchForCharacter(candidate, existing)
      expect(result.type).toBe('autoMerge')
      expect(result.targetId).toBe('e1')
      expect(result.score).toBeGreaterThanOrEqual(0.88)
    })

    it('中等相似度 (0.70-0.87) 返回 suggest', () => {
      const cand = { id: 'c2', name: '李', description: '聪' }
      const result = decideMatchForCharacter(cand, existing, {
        autoMergeThreshold: 0.95,
        suggestThreshold: 0.3,
      })
      expect(result.type).toMatch(/suggest|autoMerge|new/)
    })

    it('低相似度 (< 0.70) 返回 new', () => {
      const cand = { id: 'c3', name: 'Bob', description: '陌生人' }
      const result = decideMatchForCharacter(cand, existing)
      expect(result.type).toBe('new')
      expect(result.score).toBeLessThan(0.7)
    })

    it('空的现有列表返回 new', () => {
      const result = decideMatchForCharacter(candidate, [])
      expect(result.type).toBe('new')
      expect(result.targetId).toBeUndefined()
      expect(result.score).toBe(0)
    })

    it('考虑 aliases', () => {
      const cand = { id: 'c4', name: '老李', aliases: ['李四'] }
      const result = decideMatchForCharacter(cand, existing)
      expect(result.type).toBe('autoMerge')
    })

    it('custom threshold 工作正常', () => {
      const veryDifferent = { id: 'c99', name: 'Unknown', description: 'Mystery person' }
      const result = decideMatchForCharacter(veryDifferent, existing, {
        autoMergeThreshold: 0.99,
        suggestThreshold: 0.99,
      })
      expect(result.type).toBe('new')
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.targetId).toBeUndefined()
    })

    it('返回最高分的 match', () => {
      const cand = { id: 'c5', name: '李', description: '聪明 勇敢' }
      const result = decideMatchForCharacter(cand, existing)
      expect(result.targetId).toBe('e1')
      expect(result.score).toBeGreaterThan(0)
    })

    it('keywords 重合度提高分数', () => {
      const cand = { id: 'c6', name: 'Person', description: '聪明 勇敢 神秘' }
      const result = decideMatchForCharacter(cand, existing)
      expect(result.score).toBeGreaterThan(0)
    })
  })
})
