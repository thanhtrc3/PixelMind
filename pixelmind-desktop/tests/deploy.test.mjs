import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  deployErrorMessage,
  idleDeployState,
  parseDeployUrl,
  redactSecrets,
} from '../shared/deploy.ts'

describe('redactSecrets', () => {
  it('che mọi lần xuất hiện của secret', () => {
    const out = redactSecrets('Authorization: Bearer abc123\nabc123 abc123', ['abc123'])
    assert.doesNotMatch(out, /abc123/)
    assert.match(out, /\*\*\*/)
  })

  it('bỏ qua secret rỗng/ngắn để không che bừa', () => {
    assert.equal(redactSecrets('hello world', ['', 'a']), 'hello world')
  })
})

describe('parseDeployUrl', () => {
  it('bắt URL vercel/netlify/custom, bỏ dấu câu cuối', () => {
    assert.equal(parseDeployUrl('Production: https://demo.vercel.app'), 'https://demo.vercel.app')
    assert.equal(parseDeployUrl('site: https://demo-123.netlify.app.'), 'https://demo-123.netlify.app')
    assert.equal(parseDeployUrl('Deployed to https://pixel.example.com/preview'), 'https://pixel.example.com/preview')
  })

  it('không có URL thì null', () => {
    assert.equal(parseDeployUrl('building...'), null)
    assert.equal(parseDeployUrl('http://insecure.local'), null)
  })
})

describe('deployErrorMessage', () => {
  it('nêu mã lỗi và đuôi stderr', () => {
    const msg = deployErrorMessage(1, 'error: build failed\nmissing module')
    assert.match(msg, /mã 1/)
    assert.match(msg, /missing module/)
  })

  it('không có mã lỗi thì báo không khởi chạy được', () => {
    assert.match(deployErrorMessage(null, ''), /Không khởi chạy được/)
  })
})

describe('idleDeployState', () => {
  it('trạng thái nghỉ', () => {
    assert.deepEqual(idleDeployState(), { status: 'idle', url: null, phase: '' })
  })
})
