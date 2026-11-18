import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolvePartVariant, parsePartVariantJson } from '../shared/toolbox.ts'

const part = {
  html: '<button class="btn {{size}} {{tone}}">Xin chào {{label}}</button>',
  css: '.btn.{{size}} { padding: {{pad}} }',
  js: '',
  props: [
    { name: 'size', defaultValue: 'md' },
    { name: 'tone', defaultValue: 'primary' },
    { name: 'label', defaultValue: 'Mua' },
    { name: 'pad', defaultValue: '8px' },
  ],
  variants: [
    { id: 'sm', name: 'Nhỏ', values: { size: 'sm', pad: '4px' } },
    { id: 'danger', name: 'Nguy hiểm', values: { tone: 'danger' } },
  ],
}

describe('resolvePartVariant', () => {
  it('áp dụng giá trị biến thể vào html/css, giữ giá trị mặc định cho props còn lại', () => {
    const out = resolvePartVariant(part, 'sm')
    assert.match(out.html, /class="btn sm primary"/)
    assert.match(out.html, /Xin chào Mua/)
    assert.equal(out.css, '.btn.sm { padding: 4px }')
    assert.equal(out.variantId, 'sm')
    assert.equal(out.values.size, 'sm')
    assert.equal(out.values.tone, 'primary')
  })

  it('hai biến thể khác nhau sinh đầu ra khác nhau', () => {
    assert.notEqual(resolvePartVariant(part, 'sm').html, resolvePartVariant(part, 'danger').html)
    assert.match(resolvePartVariant(part, 'danger').html, /btn md danger/)
  })

  it('biến thể không tồn tại thì dùng props mặc định', () => {
    const out = resolvePartVariant(part, 'khong-co')
    assert.match(out.html, /btn md primary/)
    assert.equal(out.variantId, null)
  })

  it('placeholder lạ không bị thay thế hay xoá', () => {
    const out = resolvePartVariant({ html: '<p>{{unknown}} {{size}}</p>', props: [{ name: 'size', defaultValue: 'x' }] })
    assert.equal(out.html, '<p>{{unknown}} x</p>')
  })

  it('part cũ không có props/variants trả về nguyên văn', () => {
    const legacy = { html: '<div class="old">{{name}}</div>', css: '.old{}', js: '' }
    const out = resolvePartVariant(legacy)
    assert.equal(out.html, legacy.html)
    assert.equal(out.css, legacy.css)
    assert.equal(out.variantId, null)
    assert.deepEqual(out.values, {})
  })
})

describe('parsePartVariantJson', () => {
  it('đọc JSON hợp lệ', () => {
    const res = parsePartVariantJson(JSON.stringify({ props: part.props, variants: part.variants }))
    assert.equal(res.ok, true)
    assert.equal(res.variants.length, 2)
  })

  it('báo lỗi khi JSON sai hoặc khoá không hợp lệ', () => {
    assert.equal(parsePartVariantJson('{').ok, false)
    assert.equal(parsePartVariantJson(JSON.stringify({ props: [{ name: '1 bad', defaultValue: 'x' }] })).ok, false)
    assert.equal(parsePartVariantJson(JSON.stringify({ variants: [{ id: '', name: 'A', values: {} }] })).ok, false)
  })
})
