import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isCssVarReference,
  extractVarName,
  formatVarReference,
  getAvailableDesignTokens,
} from '../src/lib/cssVariables.ts'

test('D2-14: isCssVarReference nhận diện đúng cú pháp var(--...)', () => {
  assert.equal(isCssVarReference('var(--primary-color)'), true)
  assert.equal(isCssVarReference('var(--space-md, 16px)'), true)
  assert.equal(isCssVarReference('  var(--bg-card)  '), true)
  assert.equal(isCssVarReference('#6366f1'), false)
  assert.equal(isCssVarReference('rgb(99, 102, 241)'), false)
  assert.equal(isCssVarReference('16px'), false)
  assert.equal(isCssVarReference(''), false)
  assert.equal(isCssVarReference(null), false)
})

test('D2-14: extractVarName trích xuất chính xác tên biến', () => {
  assert.equal(extractVarName('var(--primary-color)'), '--primary-color')
  assert.equal(extractVarName('var(--space-md, 16px)'), '--space-md')
  assert.equal(extractVarName('var(--font-heading, "Inter", sans-serif)'), '--font-heading')
  assert.equal(extractVarName('#6366f1'), null)
  assert.equal(extractVarName(''), null)
})

test('D2-14: formatVarReference tạo chuỗi chuẩn hóa có fallback tuỳ chọn', () => {
  assert.equal(formatVarReference('--accent'), 'var(--accent)')
  assert.equal(formatVarReference('accent'), 'var(--accent)')
  assert.equal(formatVarReference('--brand', '#6366f1'), 'var(--brand, #6366f1)')
  assert.equal(formatVarReference('space-4', '16px'), 'var(--space-4, 16px)')
})

test('D2-14: getAvailableDesignTokens chuyển đổi đầy đủ các danh mục token', () => {
  const mockTokens = {
    colors: [
      { id: 'c1', name: 'Brand Primary', value: '#6366f1', category: 'brand' },
      { id: 'c2', name: 'Background', value: '#0f172a', category: 'background' },
    ],
    spacing: [
      { id: 's1', name: 'md', value: '16px' },
    ],
    radius: [
      { id: 'r1', name: 'lg', value: '8px' },
    ],
    customVars: [
      { id: 'cv1', name: '--z-modal', value: '1000' },
    ],
  }

  const list = getAvailableDesignTokens(mockTokens)
  assert.equal(list.length, 5)

  const brand = list.find((x) => x.id === 'c1')
  assert.ok(brand)
  assert.equal(brand.cssVarName, '--color-brand-primary')
  assert.equal(brand.value, '#6366f1')
  assert.equal(brand.category, 'color')

  const space = list.find((x) => x.id === 's1')
  assert.ok(space)
  assert.equal(space.cssVarName, '--space-md')

  const radius = list.find((x) => x.id === 'r1')
  assert.ok(radius)
  assert.equal(radius.cssVarName, '--radius-lg')

  const custom = list.find((x) => x.id === 'cv1')
  assert.ok(custom)
  assert.equal(custom.cssVarName, '--z-modal')
})
