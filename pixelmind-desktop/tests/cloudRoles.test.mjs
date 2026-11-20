import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createCloudClient } from '../electron/main/supabaseCloud.ts'

const DEPS = {
  baseUrl: 'https://demo.supabase.co',
  anonKey: 'anon-key',
  accessToken: () => 'AT',
}

function fakeFetch(responses) {
  const calls = []
  const impl = async (url, init) => {
    calls.push({ url, init })
    const body = responses.shift()
    return {
      ok: body.status < 300,
      status: body.status,
      json: async () => body.json ?? {},
      text: async () => JSON.stringify(body.json ?? {}),
    }
  }
  return { impl, calls }
}

describe('createCloudClient', () => {
  it('pull trả null khi không có hàng, gửi đúng header và filter', async () => {
    const { impl, calls } = fakeFetch([{ status: 200, json: [] }])
    const client = createCloudClient({ ...DEPS, fetchImpl: impl })
    assert.equal(await client.pull('ws-1', 'settings'), null)
    assert.match(calls[0].url, /\/rest\/v1\/pm_snapshots\?workspace_id=eq\.ws-1&doc=eq\.settings&select=\*/)
    assert.equal(calls[0].init.headers.apikey, 'anon-key')
    assert.equal(calls[0].init.headers.Authorization, 'Bearer AT')
  })

  it('pull map đúng payload và schema_version', async () => {
    const { impl } = fakeFetch([
      {
        status: 200,
        json: [
          {
            payload: { schemaVersion: 1 },
            schema_version: 1,
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
      },
    ])
    const client = createCloudClient({ ...DEPS, fetchImpl: impl })
    const snap = await client.pull('ws-1', 'settings')
    assert.deepEqual(snap.payload, { schemaVersion: 1 })
    assert.equal(snap.schemaVersion, 1)
  })

  it('push gửi Prefer merge-duplicates', async () => {
    const { impl, calls } = fakeFetch([{ status: 201, json: [] }])
    const client = createCloudClient({ ...DEPS, fetchImpl: impl })
    await client.push('ws-1', 'settings', { schemaVersion: 1 })
    assert.equal(calls[0].init.method, 'POST')
    assert.match(calls[0].init.headers.Prefer, /resolution=merge-duplicates/)
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      workspace_id: 'ws-1',
      doc: 'settings',
      schema_version: 1,
      payload: { schemaVersion: 1 },
    })
  })

  it('RLS chặn Viewer: push 403 thành lỗi tiếng Việt rõ ràng', async () => {
    const { impl } = fakeFetch([
      { status: 403, json: { message: 'new row violates row-level security policy' } },
    ])
    const client = createCloudClient({ ...DEPS, fetchImpl: impl })
    await assert.rejects(client.push('ws-1', 'settings', {}), /không có quyền ghi/i)
  })

  it('role lấy từ pm_members, không có hàng → null', async () => {
    const { impl } = fakeFetch([{ status: 200, json: [{ role: 'viewer' }] }, { status: 200, json: [] }])
    const client = createCloudClient({ ...DEPS, fetchImpl: impl })
    assert.equal(await client.role('ws-1', 'a@b.c'), 'viewer')
    assert.equal(await client.role('ws-1', 'x@y.z'), null)
  })
})

describe('SQL schema', () => {
  it('không cho Viewer ghi pm_snapshots (RLS)', async () => {
    const sql = await readFile(new URL('../docs/sql/2026-11-18-cloud.sql', import.meta.url), 'utf8')
    assert.match(sql, /alter table public\.pm_snapshots enable row level security/i)
    assert.match(sql, /pm_role\(workspace_id\) in \('owner', ?'editor'\)/i)
    assert.match(sql, /pm_role\(workspace_id\) = 'owner'/i)
  })
})
