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

import { runA11yScan } from '../electron/main/a11y.ts'

const axeSource = 'window.axe = { run: function(){ return Promise.resolve({ violations: [] }) } }'
const violation = {
  id: 'image-alt',
  impact: 'critical',
  help: 'Hình ảnh phải có alt',
  description: 'd',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/image-alt',
  tags: ['wcag2a'],
  nodes: [{ selector: 'img', html: '<img>', failureSummary: 'Thêm alt' }],
}

describe('runA11yScan', () => {
  it('inject source rồi chạy axe trong frame khớp previewUrl', async () => {
    const injected = []
    const frames = [
      { url: 'http://localhost:5173/', executeJavaScript: async (code) => { injected.push(code); return { ok: true, violations: [] } } },
      { url: 'http://localhost:3000/', executeJavaScript: async (code) => { injected.push(code); return { ok: true, violations: [violation] } } },
    ]
    const res = await runA11yScan(frames, axeSource, 'http://localhost:3000/')
    assert.equal(res.ok, true)
    assert.equal(res.frameUrl, 'http://localhost:3000/')
    assert.equal(res.total, 1)
    assert.equal(res.counts.critical, 1)
    assert.equal(injected.length, 2)
  })

  it('không có frame thì báo no-frame', async () => {
    const res = await runA11yScan([], axeSource, null)
    assert.equal(res.ok, false)
    assert.equal(res.reason, 'no-frame')
  })

  it('thiếu axeSource thì báo failed', async () => {
    const res = await runA11yScan([{ url: 'http://localhost:1/', executeJavaScript: async () => ({ ok: true, violations: [] }) }], '', null)
    assert.equal(res.ok, false)
    assert.equal(res.reason, 'failed')
  })

  it('frame ném lỗi (CSP/chặn) thì báo blocked, không ném ra ngoài', async () => {
    const frames = [{ url: 'http://localhost:3000/', executeJavaScript: async () => { throw new Error('Blocked by CSP') } }]
    const res = await runA11yScan(frames, axeSource, 'http://localhost:3000/')
    assert.equal(res.ok, false)
    assert.equal(res.reason, 'blocked')
    assert.match(res.error, /CSP/)
  })
})

