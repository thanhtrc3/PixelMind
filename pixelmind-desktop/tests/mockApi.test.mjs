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

import { MockApiServer } from '../electron/main/mockApi.ts'
import { isPortAvailable } from '../electron/main/runnerPorts.ts'

const config = {
  port: 0,
  routes: [
    { id: 'hello', method: 'GET', path: '/api/hello', status: 201, body: '{"hello":"world"}' },
    { id: 'echo', method: 'POST', path: '/api/echo', status: 200, body: '{"ok":true}' },
  ],
}

describe('MockApiServer', () => {
  it('phục vụ đúng method/status/body rồi dừng giải phóng cổng', async () => {
    const server = new MockApiServer()
    const started = await server.start(config)
    try {
      assert.equal(started.running, true)
      assert.ok(started.port > 0)
      const base = `http://127.0.0.1:${started.port}`

      const res = await fetch(`${base}/api/hello`)
      assert.equal(res.status, 201)
      assert.deepEqual(await res.json(), { hello: 'world' })
      assert.equal(res.headers.get('access-control-allow-origin'), '*')

      const post = await fetch(`${base}/api/echo`, { method: 'POST' })
      assert.equal(post.status, 200)
      assert.deepEqual(await post.json(), { ok: true })

      const missing = await fetch(`${base}/api/nope`)
      assert.equal(missing.status, 404)

      const options = await fetch(`${base}/api/hello`, { method: 'OPTIONS' })
      assert.equal(options.status, 204)

      assert.equal(started.calls.length >= 4, true)

      const stopped = await server.stop()
      assert.equal(stopped.running, false)
      assert.equal(await isPortAvailable(started.port), true)
      await assert.rejects(fetch(`${base}/api/hello`))
    } finally {
      await server.stop()
    }
  })

  it('báo lỗi khi cổng bị chiếm, không đổi cổng', async () => {
    const server = new MockApiServer({ isPortAvailable: async () => false })
    const state = await server.start({ ...config, port: 4321 })
    assert.equal(state.running, false)
    assert.match(state.error, /4321/)
    assert.equal(state.port, null)
  })
})

import { readMockConfig, writeMockConfig } from '../electron/main/mockApi.ts'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

describe('readMockConfig / writeMockConfig', () => {
  it('ghi và đọc lại cấu hình từ thư mục .pixelmind/mock.json', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pm-mock-test-'))
    try {
      const initial = await readMockConfig(tempDir)
      assert.equal(initial, null)

      await writeMockConfig(tempDir, config)
      const loaded = await readMockConfig(tempDir)
      assert.ok(loaded)
      assert.equal(loaded.routes.length, 2)
      assert.equal(loaded.routes[0].path, '/api/hello')
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
    }
  })
})


