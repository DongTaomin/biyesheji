import { describe, it, expect } from 'vitest'
import { rewriteViaProxyBase } from '../proxy-fetch'

describe('Proxy Fetch', () => {
  describe('rewriteViaProxyBase', () => {
    it('无 proxyBase 返回原始 URL', () => {
      const url = 'https://example.com/book'
      expect(rewriteViaProxyBase(url, undefined)).toBe(url)
      expect(rewriteViaProxyBase(url, '')).toBe(url)
      expect(rewriteViaProxyBase(url, '  ')).toBe(url)
      expect(rewriteViaProxyBase(url, null as any)).toBe(url)
    })

    it('proxyBase 含 {url} 占位符', () => {
      const url = 'https://example.com/book'
      const proxyBase = 'https://proxy.com/fetch?url={url}'
      const result = rewriteViaProxyBase(url, proxyBase)
      expect(result).toBe(`https://proxy.com/fetch?url=${encodeURIComponent(url)}`)
    })

    it('proxyBase 以 / 结尾', () => {
      const url = 'https://example.com/book'
      const proxyBase = 'https://proxy.com/fetch/'
      const result = rewriteViaProxyBase(url, proxyBase)
      expect(result).toBe(`https://proxy.com/fetch/${encodeURIComponent(url)}`)
    })

    it('proxyBase 不以 / 结尾', () => {
      const url = 'https://example.com/book'
      const proxyBase = 'https://proxy.com/fetch'
      const result = rewriteViaProxyBase(url, proxyBase)
      expect(result).toBe(`https://proxy.com/fetch/${encodeURIComponent(url)}`)
    })

    it('URL encode 特殊字符', () => {
      const url = 'https://example.com/book?id=1&name=test'
      const proxyBase = 'https://proxy.com/'
      const result = rewriteViaProxyBase(url, proxyBase)
      expect(result).toContain(encodeURIComponent(url))
      expect(result).toContain('%3F')
      expect(result).toContain('%26')
    })

    it('多个 {url} 占位符只替换第一个', () => {
      const url = 'https://example.com/book'
      const proxyBase = 'https://proxy.com/{url}/mirror/{url}'
      const result = rewriteViaProxyBase(url, proxyBase)
      expect(result).toContain(encodeURIComponent(url))
    })

    it('处理中文 URL', () => {
      const url = 'https://example.com/书籍'
      const proxyBase = 'https://proxy.com/'
      const result = rewriteViaProxyBase(url, proxyBase)
      expect(result).toContain(encodeURIComponent(url))
    })

    it('处理含空格的 URL', () => {
      const url = 'https://example.com/book title'
      const proxyBase = 'https://proxy.com/'
      const result = rewriteViaProxyBase(url, proxyBase)
      expect(result).toContain('%20')
    })

    it('proxyBase 含多个占位符的情况', () => {
      const url = 'https://example.com/api'
      const proxyBase = 'https://proxy.com/v1/{url}/v2'
      const result = rewriteViaProxyBase(url, proxyBase)
      expect(result).toBe(`https://proxy.com/v1/${encodeURIComponent(url)}/v2`)
    })

    it('空 URL', () => {
      const proxyBase = 'https://proxy.com/'
      const result = rewriteViaProxyBase('', proxyBase)
      expect(result).toBe('https://proxy.com/')
    })
  })
})
