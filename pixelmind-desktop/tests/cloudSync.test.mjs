import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { canWrite, isCloudRole } from '../shared/cloud.ts'
import { decideMerge, hashPayload, stableStringify, syncDocs } from '../electron/main/cloudSync.ts'

describe('vai trò', () => {
  it('chỉ owner/editor được ghi', () => {
    assert.equal(canWrite('owner'), true)
    assert.equal(canWrite('editor'), true)
    assert.equal(canWrite('viewer'), false)
    assert.equal(canWrite(null), false)
    assert.equal(isCloudRole('owner'), true)
    assert.equal(isCloudRole('guest'), false)
  })
})

describe('hashPayload', () => {
  it('không phụ thuộc thứ tự key', () => {
    assert.equal(hashPayload({ a: 1, b: { c: 2, d: 3 } }), hashPayload({ b: { d: 3, c: 2 }, a: 1 }))
    assert.notEqual(hashPayload({ a: 1 }), hashPayload({ a: 2 }))
    assert.equal(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] }), '{"a":[2,{"c":2,"d":1}],"b":1}')
  })
})

describe('decideMerge', () => {
  const H = (s) => hashPayload(s)
  it('chưa có remote → push', () => {
    assert.equal(decideMerge({ localHash: H('l'), remoteHash: null, lastSyncedHash: null }), 'push')
  })
  it('chưa có local → pull', () => {
    assert.equal(decideMerge({ localHash: null, remoteHash: H('r'), lastSyncedHash: null }), 'pull')
  })
  it('giống nhau → noop', () => {
    assert.equal(decideMerge({ localHash: H('x'), remoteHash: H('x'), lastSyncedHash: null }), 'noop')
  })
  it('local không đổi kể từ lần sync trước → pull', () => {
    assert.equal(decideMerge({ localHash: H('l'), remoteHash: H('r'), lastSyncedHash: H('l') }), 'pull')
  })
  it('remote không đổi kể từ lần sync trước → push', () => {
    assert.equal(decideMerge({ localHash: H('l'), remoteHash: H('r'), lastSyncedHash: H('r') }), 'push')
  })
  it('cả hai cùng đổi → conflict', () => {
    assert.equal(decideMerge({ localHash: H('l'), remoteHash: H('r'), lastSyncedHash: H('old') }), 'conflict')
  })
})

describe('syncDocs', () => {
  const settings = { schemaVersion: 1, settings: { theme: 'dark' } }
  const tokens = { schemaVersion: 1, tokens: { colors: [] } }

  function adapter({ remote = {}, failPush = null } = {}) {
    const pushed = []
    return {
      pushed,
      pull: async (doc) => remote[doc] ?? null,
      push: async (doc, payload) => {
        if (failPush) throw new Error(failPush)
        pushed.push({ doc, payload })
        remote[doc] = { doc, schemaVersion: 1, payload, updatedAt: new Date().toISOString() }
      },
    }
  }

  function hooks(overrides = {}) {
    const pulls = []
    const pushes = []
    const backups = []
    return {
      pulls,
      pushes,
      backups,
      lastSynced: {},
      onPull: async (doc, payload) => {
        pulls.push({ doc, payload })
      },
      onPush: async (doc, hash) => {
        pushes.push({ doc, hash })
      },
      onConflict: async (doc) => {
        const path = `backup-${doc}.json`
        backups.push(doc)
        return path
      },
      ...overrides,
    }
  }

  it('đẩy local mới lên và kéo remote mới về', async () => {
    const a = adapter({
      remote: { designTokens: { doc: 'designTokens', schemaVersion: 1, payload: tokens, updatedAt: 'x' } },
    })
    const h = hooks()
    const report = await syncDocs(
      a,
      [
        { doc: 'settings', payload: settings },
        { doc: 'designTokens', payload: null },
      ],
      h,
    )
    assert.equal(report.ok, true)
    assert.deepEqual(report.pushed, ['settings'])
    assert.deepEqual(report.pulled, ['designTokens'])
    assert.equal(h.pushes.length, 2)
    assert.equal(h.pulls[0].payload.schemaVersion, 1)
  })

  it('xung đột: backup local trước, nhận remote, báo conflict', async () => {
    const remote = {
      doc: 'settings',
      schemaVersion: 1,
      payload: { ...settings, settings: { theme: 'light' } },
      updatedAt: 'y',
    }
    const a = adapter({ remote: { settings: remote } })
    const h = hooks({
      lastSynced: { settings: hashPayload({ schemaVersion: 1, settings: { theme: 'sepia' } }) },
    })
    const report = await syncDocs(a, [{ doc: 'settings', payload: settings }], h)
    assert.equal(report.ok, true)
    assert.equal(report.conflicts.length, 1)
    assert.equal(report.conflicts[0].backupPath, 'backup-settings.json')
    assert.equal(h.pulls[0].payload.settings.theme, 'light')
  })

  it('lỗi mạng khi push: ok=false, không gọi onPull cho doc đó', async () => {
    const a = adapter({ failPush: 'offline' })
    const h = hooks()
    const report = await syncDocs(a, [{ doc: 'settings', payload: settings }], h)
    assert.equal(report.ok, false)
    assert.match(report.error, /offline/)
    assert.equal(h.pulls.length, 0)
    assert.deepEqual(report.pushed, [])
  })
})

import {
  buildSettingsSnapshot,
  readSettingsPayload,
  buildTokensSnapshot,
  readTokensPayload,
} from '../electron/main/cloudSnapshots.ts'
import { DEFAULT_SETTINGS } from '../shared/types.ts'
import { DEFAULT_DESIGN_TOKENS } from '../shared/designTokens.ts'

describe('cloudSnapshots', () => {
  it('snapshot settings có schemaVersion và đọc lại được', () => {
    const payload = buildSettingsSnapshot({ ...DEFAULT_SETTINGS, theme: 'light', cloudWorkspaceId: 'ws-123' })
    assert.equal(payload.schemaVersion, 1)
    assert.equal(payload.settings.cloudWorkspaceId, undefined)
    const read = readSettingsPayload(payload)
    assert.equal(read.theme, 'light')
    assert.equal(read.cloudWorkspaceId, undefined)
    assert.equal(readSettingsPayload({ schemaVersion: 999, settings: {} }), null)
    assert.equal(readSettingsPayload('x'), null)
  })

  it('snapshot tokens có schemaVersion và đọc lại được', () => {
    const payload = buildTokensSnapshot(DEFAULT_DESIGN_TOKENS)
    assert.equal(payload.schemaVersion, 1)
    assert.deepEqual(readTokensPayload(payload), DEFAULT_DESIGN_TOKENS)
    assert.equal(readTokensPayload({ schemaVersion: 1, tokens: null }), null)
  })
})
