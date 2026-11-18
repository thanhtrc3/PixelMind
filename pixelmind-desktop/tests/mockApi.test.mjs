import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  emptyMockState,
  matchMockRoute,
  normalizeMockConfig,
  normalizeMockPath,
} from '../shared/mockApi.ts'

const route = { id: 'r1', method: 'GET', path: '/api/hello', status: 200, body: '{"ok":true}' }

describe('normalizeMockPath', () => {
  it('bỏ query, thêm / đầu, bỏ / cuối', () => {
    assert.equal(normalizeMockPath('api/hello/?q=1'), '/api/hello')
    assert.equal(normalizeMockPath('/'), '/')
  })
})

describe('matchMockRoute', () => {
  it('khớp method + path, không phân biệt hoa thường của method', () => {
    assert.equal(matchMockRoute([route], 'get', '/api/hello?q=1')?.id, 'r1')
    assert.equal(matchMockRoute([route], 'POST', '/api/hello'), null)
  })

  it('path không khớp trả null', () => {
    assert.equal(matchMockRoute([route], 'GET', '/api/other'), null)
  })
})

describe('normalizeMockConfig', () => {
  it('chuẩn hoá route hợp lệ và sinh id nếu thiếu', () => {
    const { config, errors } = normalizeMockConfig({
      port: '3001',
      routes: [{ method: 'post', path: 'api/x', status: '201', body: '{"a":1}' }],
    })
    assert.deepEqual(errors, [])
    assert.equal(config.port, 3001)
    assert.equal(config.routes[0].method, 'POST')
    assert.equal(config.routes[0].path, '/api/x')
    assert.equal(config.routes[0].status, 201)
    assert.ok(config.routes[0].id)
  })

  it('báo lỗi cổng sai, status sai, body không phải JSON', () => {
    assert.ok(normalizeMockConfig({ port: 70000, routes: [] }).errors.length > 0)
    assert.ok(normalizeMockConfig({ port: 3000, routes: [{ method: 'GET', path: '/a', status: 99, body: '' }] }).errors.length > 0)
    assert.ok(normalizeMockConfig({ port: 3000, routes: [{ method: 'GET', path: '/a', status: 200, body: '{oops' }] }).errors.length > 0)
  })
})

describe('emptyMockState', () => {
  it('trạng thái dừng', () => {
    assert.deepEqual(emptyMockState(), {
      running: false,
      port: null,
      url: null,
      calls: [],
    })
  })
})
