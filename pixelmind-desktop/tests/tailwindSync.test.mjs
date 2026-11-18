import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DEFAULT_DESIGN_TOKENS, tailwindClassesToStyles, stylesToTailwindClasses } from '../shared/designTokens.ts'
import { buildStyleUpdate, kebabToCamelKey, shouldUseTailwind } from '../electron/main/styleSync.ts'

const tokens = DEFAULT_DESIGN_TOKENS
const jsxOpts = (line, styles, allowTailwind = true) => ({ line, isJsx: true, tagName: 'button', styles, tokens, allowTailwind })
const htmlOpts = (line, styles, allowTailwind = true) => ({ line, isJsx: false, tagName: 'div', styles, tokens, allowTailwind })

describe('kebabToCamelKey', () => {
  it('đổi key CSS sang camelCase, giữ custom property', () => {
    assert.equal(kebabToCamelKey('background-color'), 'backgroundColor')
    assert.equal(kebabToCamelKey('--pm-accent'), '--pm-accent')
  })
})

describe('shouldUseTailwind', () => {
  it('mode inline luôn tắt; auto/tailwind phụ thuộc phát hiện', () => {
    assert.equal(shouldUseTailwind('inline', 'v3'), false)
    assert.equal(shouldUseTailwind('auto', null), false)
    assert.equal(shouldUseTailwind('auto', 'v4'), true)
    assert.equal(shouldUseTailwind('tailwind', null), true)
  })
})

describe('buildStyleUpdate - JSX', () => {
  it('ghi class Tailwind và bỏ inline style cho thuộc tính chuyển được', () => {
    const res = buildStyleUpdate(jsxOpts('<button className="btn">Lưu</button>', { display: 'flex', gap: '8px' }))
    assert.equal(res.mode, 'tailwind')
    assert.match(res.line, /className="btn [^"]*flex[^"]*"/)
    assert.doesNotMatch(res.line, /style=/)
    assert.ok(res.appliedClasses.length > 0)
  })

  it('lưu lại lần 2 không nhân đôi class', () => {
    const first = buildStyleUpdate(jsxOpts('<button className="btn">Lưu</button>', { display: 'flex', gap: '8px' }))
    const second = buildStyleUpdate(jsxOpts(first.line, { display: 'flex', gap: '8px' }))
    assert.equal(second.line, first.line)
    const classes = second.line.match(/className="([^"]*)"/)[1].split(/\s+/)
    assert.equal(classes.length, new Set(classes).size)
    assert.equal(classes.filter((c) => c === 'flex').length, 1)
  })

  it('thuộc tính không hỗ trợ giữ inline với key camelCase', () => {
    const res = buildStyleUpdate(jsxOpts('<div className="box">x</div>', { writingMode: 'vertical-rl' }))
    assert.equal(res.mode, 'inline')
    assert.match(res.line, /style=\{\{ writingMode: "vertical-rl" \}\}/)
    assert.equal(res.appliedClasses.length, 0)
    assert.equal(res.residualStyles.writingMode, 'vertical-rl')
  })

  it('className động thì không ghi class, chỉ ghi inline', () => {
    const res = buildStyleUpdate(jsxOpts('<div className={cn("box")}>x</div>', { display: 'flex' }))
    assert.equal(res.unsafe, true)
    assert.match(res.line, /className=\{cn\("box"\)\}/)
    assert.match(res.line, /style=\{\{ display: "flex" \}\}/)
  })

  it('allowTailwind=false luôn ghi inline', () => {
    const res = buildStyleUpdate(jsxOpts('<div className="box">x</div>', { display: 'flex' }, false))
    assert.equal(res.mode, 'inline')
    assert.match(res.line, /style=\{\{ display: "flex" \}\}/)
  })
})

describe('buildStyleUpdate - HTML', () => {
  it('thay class cũ cùng thuộc tính thay vì cộng dồn', () => {
    const res = buildStyleUpdate(htmlOpts('<div class="p-4">x</div>', { padding: '8px' }))
    assert.equal(res.mode, 'tailwind')
    assert.match(res.line, /class="p-2"/)
    assert.doesNotMatch(res.line, /p-4/)
  })

  it('residual dùng key kebab-case trong style', () => {
    const res = buildStyleUpdate(htmlOpts('<div>x</div>', { writingMode: 'vertical-rl' }))
    assert.match(res.line, /style="writing-mode: vertical-rl;"/)
  })
})

describe('đọc lại class thành style', () => {
  it('class sinh ra đọc ngược được về đúng thuộc tính', () => {
    const styles = { display: 'flex', gap: '8px' }
    const conversion = stylesToTailwindClasses(styles, tokens, { arbitraryValues: true })
    const back = tailwindClassesToStyles(conversion.classes.join(' '), tokens)
    for (const item of conversion.applied) {
      assert.ok(back.styles[item.property] !== undefined, `Không đọc lại được ${item.property}`)
    }
  })
})
