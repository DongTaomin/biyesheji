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
})
