import { describe, it, expect } from 'vitest'
import { parseJsonPath, parseJsonRule } from '../jsonpath-parser'

describe('JSONPath Parser', () => {
  describe('parseJsonPath', () => {
    const data = {
      name: 'Alice',
      age: 30,
      books: [
        { id: 1, title: 'Book A', author: { name: 'Author A' } },
        { id: 2, title: 'Book B', author: { name: 'Author B' } },
      ],
      metadata: {
        created: '2024-01-01',
        tags: ['fiction', 'adventure'],
      },
    }

    it('$ 返回整个对象', () => {
      expect(parseJsonPath(data, '$')).toEqual(data)
      expect(parseJsonPath(data, '$.')).toEqual(data)
    })

    it('$.key 返回顶层属性', () => {
      expect(parseJsonPath(data, '$.name')).toBe('Alice')
      expect(parseJsonPath(data, '$.age')).toBe(30)
    })

    it('$.a.b.c 多层嵌套属性', () => {
      expect(parseJsonPath(data, '$.metadata.created')).toBe('2024-01-01')
      expect(parseJsonPath(data, '$.books[0].title')).toBe('Book A')
      expect(parseJsonPath(data, '$.books[1].author.name')).toBe('Author B')
    })

    it('$[n] 数组索引', () => {
      expect(parseJsonPath(data, '$.books[0]')).toEqual({
        id: 1,
        title: 'Book A',
        author: { name: 'Author A' },
      })
      expect(parseJsonPath(data, '$.books[1]')).toEqual({
        id: 2,
        title: 'Book B',
        author: { name: 'Author B' },
      })
    })

    it('$[*] 通配符返回整个数组', () => {
      const result = parseJsonPath(data, '$.books[*]')
      expect(result).toEqual(data.books)
    })

    it('$..[?(@.property)] 递归搜索包含属性的对象', () => {
      const result = parseJsonPath(data, '$..[?(@.id)]')
      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('id', 1)
      expect(result[1]).toHaveProperty('id', 2)
    })

    it('$..[?(@.property==value)] 递归搜索属性值匹配的对象', () => {
      const result = parseJsonPath(data, '$..[?(@.id=="1")]')
      expect(result).toHaveLength(1)
      expect(result[0]).toHaveProperty('id', 1)
      expect(result[0]).toHaveProperty('title', 'Book A')
    })

    it('..$..property 递归搜索属性', () => {
      const result = parseJsonPath(data, '$..[?(@.title)]')
      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('title', 'Book A')
      expect(result[1]).toHaveProperty('title', 'Book B')
    })

    it('不以 $ 开头的路径返回 null', () => {
      expect(parseJsonPath(data, 'name')).toBeNull()
      expect(parseJsonPath(data, '.name')).toBeNull()
      expect(parseJsonPath(data, '')).toBeNull()
    })

    it('属性不存在时返回 null', () => {
      expect(parseJsonPath(data, '$.nonexistent')).toBeNull()
      expect(parseJsonPath(data, '$.books[99]')).toBeUndefined()
      expect(parseJsonPath(data, '$.books[0].nonexistent')).toBeNull()
    })

    it('非数组上尝试访问数组索引返回 null', () => {
      expect(parseJsonPath(data, '$.name[0]')).toBeNull()
    })

    it('空对象和数组的处理', () => {
      expect(parseJsonPath({}, '$')).toEqual({})
      expect(parseJsonPath({ items: [] }, '$.items')).toEqual([])
      expect(parseJsonPath({ items: [] }, '$.items[0]')).toBeUndefined()
    })
  })

  describe('parseJsonRule', () => {
    const data = {
      list: [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ],
      message: 'Hello World',
    }

    it('移除 @JSon: 前缀并解析路径', () => {
      const result = parseJsonRule(data, '@JSon:$.message')
      expect(result).toBe('Hello World')
    })

    it('移除 @Json: 前缀（大小写混合）', () => {
      const result = parseJsonRule(data, '@Json:$.message')
      expect(result).toBe('Hello World')
    })

    it('单个路径', () => {
      const result = parseJsonRule(data, '@JSon:$.list')
      expect(result).toEqual(data.list)
    })

    it('&& 分隔的多路径，返回第一个非空结果', () => {
      const result = parseJsonRule(data, '@JSon:$.nonexistent&&$.message')
      expect(result).toBe('Hello World')
    })

    it('多路径全部失败返回空数组', () => {
      const result = parseJsonRule(data, '@JSon:$.nonexistent&&$.alsonotexist')
      expect(result).toEqual([])
    })

    it('<js>...</js> 块时返回 { result, jsCode } 对象', () => {
      const result = parseJsonRule(data, '@JSon:$.message<js>result.toUpperCase()</js>')
      expect(result).toHaveProperty('result', 'Hello World')
      expect(result).toHaveProperty('jsCode', 'result.toUpperCase()')
    })

    it('空 rule 返回空数组', () => {
      const result = parseJsonRule(data, '@JSon:')
      expect(result).toEqual([])
    })

    it('|| 分隔的多路径', () => {
      const result = parseJsonRule(data, '@JSon:$.nonexistent||$.message')
      expect(result).toBe('Hello World')
    })

    it('多个 && 路径尝试第一个成功的', () => {
      const result = parseJsonRule(data, '@JSon:$.list[0].id&&$.message')
      expect(result).toBe(1)
    })
  })
})
