import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  exportCharactersToJson,
  importCharactersFromJson,
  exportWorldbookToJson,
  importWorldbookFromJson,
} from '../file-utils'
import type { Character, WorldSetting } from '../types'

describe('File Utils', () => {
  describe('Character Export/Import', () => {
    it('exportCharactersToJson 返回有效的 JSON 字符串', () => {
      const characters: Character[] = [
        { id: '1', name: '李四', description: '主角', enabled: true, linkedBookIds: [] },
        { id: '2', name: '王五', description: '配角', enabled: false, linkedBookIds: ['book1'] },
      ]
      const json = exportCharactersToJson(characters)
      expect(typeof json).toBe('string')
      expect(() => JSON.parse(json)).not.toThrow()
    })

    it('exportCharactersToJson 包含正确的 type 字段', () => {
      const characters: Character[] = [{ id: '1', name: 'Alice', description: '', enabled: true, linkedBookIds: [] }]
      const json = exportCharactersToJson(characters)
      const parsed = JSON.parse(json)
      expect(parsed.type).toBe('character-cards')
      expect(parsed.version).toBe(1)
    })

    it('exportCharactersToJson 包含所有字段', () => {
      const characters: Character[] = [
        { id: '1', name: '李四', description: '主角', enabled: true, linkedBookIds: ['book1'] },
      ]
      const json = exportCharactersToJson(characters)
      const parsed = JSON.parse(json)
      expect(parsed.items[0]).toHaveProperty('name', '李四')
      expect(parsed.items[0]).toHaveProperty('description', '主角')
      expect(parsed.items[0]).toHaveProperty('enabled', true)
      expect(parsed.items[0]).toHaveProperty('linkedBookIds')
    })

    it('importCharactersFromJson 成功解析有效 JSON', () => {
      const json = JSON.stringify({
        type: 'character-cards',
        version: 1,
        items: [
          { name: '李四', description: '主角', enabled: true, linkedBookIds: [] },
          { name: '王五', description: '配角', enabled: false, linkedBookIds: ['book1'] },
        ],
      })
      const characters = importCharactersFromJson(json)
      expect(characters).toHaveLength(2)
      expect(characters[0].name).toBe('李四')
      expect(characters[1].enabled).toBe(false)
    })

    it('importCharactersFromJson 生成新的 UUID', () => {
      const json = JSON.stringify({
        type: 'character-cards',
        version: 1,
        items: [{ name: 'Alice', description: '', enabled: true, linkedBookIds: [] }],
      })
      const characters = importCharactersFromJson(json)
      expect(characters[0].id).toBeDefined()
      expect(typeof characters[0].id).toBe('string')
      expect(characters[0].id).toMatch(/^[\da-f-]+$/i)
    })

    it('importCharactersFromJson 无效 JSON 返回空数组', () => {
      const result = importCharactersFromJson('invalid json')
      expect(result).toEqual([])
    })

    it('importCharactersFromJson type 不匹配返回空数组', () => {
      const json = JSON.stringify({
        type: 'worldbook',
        version: 1,
        items: [{ keyword: 'test' }],
      })
      const result = importCharactersFromJson(json)
      expect(result).toEqual([])
    })

    it('importCharactersFromJson 缺失 items 字段返回空数组', () => {
      const json = JSON.stringify({
        type: 'character-cards',
        version: 1,
      })
      const result = importCharactersFromJson(json)
      expect(result).toEqual([])
    })

    it('importCharactersFromJson 缺失字段时用默认值', () => {
      const json = JSON.stringify({
        type: 'character-cards',
        version: 1,
        items: [{ name: 'Alice' }],
      })
      const characters = importCharactersFromJson(json)
      expect(characters[0].name).toBe('Alice')
      expect(characters[0].description).toBe('')
      expect(characters[0].enabled).toBe(false)
      expect(characters[0].linkedBookIds).toEqual([])
    })

    it('round-trip: export -> import 保留所有字段（除 id）', () => {
      const original: Character[] = [
        { id: 'old-id-1', name: '李四', description: '主角', enabled: true, linkedBookIds: ['book1', 'book2'] },
      ]
      const json = exportCharactersToJson(original)
      const imported = importCharactersFromJson(json)
      expect(imported[0].name).toBe(original[0].name)
      expect(imported[0].description).toBe(original[0].description)
      expect(imported[0].enabled).toBe(original[0].enabled)
      expect(imported[0].linkedBookIds).toEqual(original[0].linkedBookIds)
      expect(imported[0].id).not.toBe(original[0].id)
    })
  })

  describe('WorldBook Export/Import', () => {
    it('exportWorldbookToJson 返回有效的 JSON 字符串', () => {
      const settings: WorldSetting[] = [
        { id: '1', keyword: '学院', description: '魔法学院设定', enabled: true, linkedBookIds: [] },
      ]
      const json = exportWorldbookToJson(settings)
      expect(typeof json).toBe('string')
      expect(() => JSON.parse(json)).not.toThrow()
    })

    it('exportWorldbookToJson 包含正确的 type 字段', () => {
      const settings: WorldSetting[] = [{ id: '1', keyword: 'test', description: '', enabled: true, linkedBookIds: [] }]
      const json = exportWorldbookToJson(settings)
      const parsed = JSON.parse(json)
      expect(parsed.type).toBe('worldbook')
      expect(parsed.version).toBe(1)
    })

    it('importWorldbookFromJson 成功解析有效 JSON', () => {
      const json = JSON.stringify({
        type: 'worldbook',
        version: 1,
        items: [
          { keyword: '学院', description: '魔法学院设定', enabled: true, linkedBookIds: [] },
          { keyword: '魔法', description: '魔法系统', enabled: false, linkedBookIds: ['book1'] },
        ],
      })
      const settings = importWorldbookFromJson(json)
      expect(settings).toHaveLength(2)
      expect(settings[0].keyword).toBe('学院')
    })

    it('importWorldbookFromJson 无效 JSON 返回空数组', () => {
      const result = importWorldbookFromJson('invalid json')
      expect(result).toEqual([])
    })

    it('importWorldbookFromJson type 不匹配返回空数组', () => {
      const json = JSON.stringify({
        type: 'character-cards',
        version: 1,
        items: [{ name: 'Alice' }],
      })
      const result = importWorldbookFromJson(json)
      expect(result).toEqual([])
    })

    it('importWorldbookFromJson 生成新的 UUID', () => {
      const json = JSON.stringify({
        type: 'worldbook',
        version: 1,
        items: [{ keyword: '学院', description: '', enabled: true, linkedBookIds: [] }],
      })
      const settings = importWorldbookFromJson(json)
      expect(settings[0].id).toBeDefined()
      expect(typeof settings[0].id).toBe('string')
    })

    it('round-trip: export -> import 保留所有字段（除 id）', () => {
      const original: WorldSetting[] = [
        { id: 'old-id', keyword: '学院', description: '魔法学院设定', enabled: true, linkedBookIds: ['book1'] },
      ]
      const json = exportWorldbookToJson(original)
      const imported = importWorldbookFromJson(json)
      expect(imported[0].keyword).toBe(original[0].keyword)
      expect(imported[0].description).toBe(original[0].description)
      expect(imported[0].enabled).toBe(original[0].enabled)
      expect(imported[0].linkedBookIds).toEqual(original[0].linkedBookIds)
      expect(imported[0].id).not.toBe(original[0].id)
    })
  })

  describe('Type validation', () => {
    it('importCharactersFromJson 拒绝 worldbook 类型', () => {
      const json = JSON.stringify({
        type: 'worldbook',
        items: [{ keyword: 'test' }],
      })
      expect(importCharactersFromJson(json)).toEqual([])
    })

    it('importWorldbookFromJson 拒绝 character-cards 类型', () => {
      const json = JSON.stringify({
        type: 'character-cards',
        items: [{ name: 'Alice' }],
      })
      expect(importWorldbookFromJson(json)).toEqual([])
    })
  })
})
