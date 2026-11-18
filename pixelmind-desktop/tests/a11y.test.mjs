import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildAxeRunScript,
  emptyA11yResult,
  pickA11yFrameIndex,
  summarizeA11y,
} from '../shared/a11y.ts'

describe('pickA11yFrameIndex', () => {
  const frames = [{ url: 'http://localhost:5173/' }, { url: 'http://localhost:3000/about' }]

  it('chọn frame khớp previewUrl', () => {
    assert.equal(pickA11yFrameIndex(frames, 'http://localhost:3000/about'), 1)
    assert.equal(pickA11yFrameIndex(frames, 'http://localhost:3000/about/'), 1)
  })

  it('không khớp thì lấy frame http đầu tiên', () => {
    assert.equal(pickA11yFrameIndex(frames, 'http://localhost:9999'), 0)
  })

  it('không có frame thì trả -1', () => {
    assert.equal(pickA11yFrameIndex([], 'http://localhost:3000'), -1)
    assert.equal(pickA11yFrameIndex([{ url: 'about:blank' }], null), 0)
  })
})

describe('summarizeA11y', () => {
  it('đếm theo mức độ, impact null xếp vào minor', () => {
    const { counts, total } = summarizeA11y([
      { id: 'a', impact: 'critical', help: '', description: '', helpUrl: '', tags: [], nodes: [] },
      { id: 'b', impact: 'minor', help: '', description: '', helpUrl: '', tags: [], nodes: [] },
      { id: 'c', impact: null, help: '', description: '', helpUrl: '', tags: [], nodes: [] },
    ])
    assert.deepEqual(counts, { critical: 1, serious: 0, moderate: 0, minor: 2 })
    assert.equal(total, 3)
  })
})

describe('buildAxeRunScript', () => {
  it('gọi axe.run trên document và trả JSON gọn', () => {
    const script = buildAxeRunScript()
    assert.match(script, /axe\.run\(document/)
    assert.match(script, /violations/)
    assert.match(script, /wcag2a/)
  })
})

describe('emptyA11yResult', () => {
  it('ok=false và có reason, không phải 0 lỗi', () => {
    const res = emptyA11yResult('no-frame')
    assert.equal(res.ok, false)
    assert.equal(res.reason, 'no-frame')
    assert.equal(res.total, 0)
  })
})
