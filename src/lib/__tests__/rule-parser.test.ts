import { describe, it, expect } from 'vitest'
import { parseRuleWithCssJs } from '../book-source-rule-parser'

describe('Book Source Rule Parser', () => {
  it('should parse @css: rules correctly', async () => {
    const html = '<html><body><div class="title">My Book</div></body></html>'
    const rule = '@css: .title'
    const result = await parseRuleWithCssJs(html, rule, 'http://example.com')
    expect(result.text().trim()).toBe('My Book')
  })

  it('should execute @js: rules correctly', async () => {
    const html = '<html><body><div class="title">My Book</div></body></html>'
    const rule = '@css: .title @js: result[0].text().toUpperCase()'
    const result = await parseRuleWithCssJs(html, rule, 'http://example.com')
    expect(result).toBe('MY BOOK')
  })

  it('should return null for rules without @css: or @js:', async () => {
    const html = '<html><body><div class="title">My Book</div></body></html>'
    const rule = 'invalid-rule-without-selector'
    const result = await parseRuleWithCssJs(html, rule, 'http://example.com')
    expect(result).toBeNull()
  })

  it('should handle empty HTML', async () => {
    const html = ''
    const rule = '@css: .title'
    const result = await parseRuleWithCssJs(html, rule, 'http://example.com')
    expect(result).toBeDefined()
    expect(result.length).toBe(0)
  })

  it('should handle CSS selectors that match nothing', async () => {
    const html = '<html><body><div class="title">My Book</div></body></html>'
    const rule = '@css: .nonexistent'
    const result = await parseRuleWithCssJs(html, rule, 'http://example.com')
    expect(result).toBeDefined()
    expect(result.length).toBe(0)
  })

  it('should parse multiple elements with @css:', async () => {
    const html = '<html><body><div class="item">Item 1</div><div class="item">Item 2</div></body></html>'
    const rule = '@css: .item'
    const result = await parseRuleWithCssJs(html, rule, 'http://example.com')
    expect(result.length).toBe(2)
    expect(result.eq(0).text()).toBe('Item 1')
    expect(result.eq(1).text()).toBe('Item 2')
  })

  it('should handle attribute selectors', async () => {
    const html = '<html><body><a href="http://example.com/book1">Book 1</a></body></html>'
    const rule = '@css: a[href]'
    const result = await parseRuleWithCssJs(html, rule, 'http://example.com')
    expect(result.attr('href')).toBe('http://example.com/book1')
  })

  it('should handle chained selectors', async () => {
    const html = '<html><body><div class="container"><p class="title">Title</p></div></body></html>'
    const rule = '@css: .container .title'
    const result = await parseRuleWithCssJs(html, rule, 'http://example.com')
    expect(result.text()).toBe('Title')
  })

  it('should parse CSS rule with trailing whitespace', async () => {
    const html = '<html><body><div class="title">My Book</div></body></html>'
    const rule = '@css: .title   '
    const result = await parseRuleWithCssJs(html, rule, 'http://example.com')
    expect(result.text()).toBe('My Book')
  })

  it('should handle @css: with @js: extraction', async () => {
    const html = '<html><body><div class="item">First</div><div class="item">Second</div></body></html>'
    const rule = '@css: .item @js: result.map(el => el.text())'
    const result = await parseRuleWithCssJs(html, rule, 'http://example.com')
    expect(Array.isArray(result)).toBe(true)
    expect(result).toContain('First')
  })
})
