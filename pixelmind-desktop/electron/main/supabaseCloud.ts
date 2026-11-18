/* ══════════════════════════════════════════════════════════════
   D1-24 & D1-25: SUPABASE CLOUD REST CLIENT (MAIN PROCESS)
   Module thuần không import 'electron', tương tác với PostgREST.
   ══════════════════════════════════════════════════════════════ */

import type { CloudDoc, CloudRole, CloudSnapshot } from '../../shared/cloud.ts'
import { isCloudRole } from '../../shared/cloud.ts'

export interface CloudClientDeps {
  baseUrl: string
  anonKey: string
  accessToken: () => string | null
  fetchImpl: typeof fetch
}

export interface CloudClient {
  pull(workspaceId: string, doc: CloudDoc): Promise<CloudSnapshot | null>
  push(workspaceId: string, doc: CloudDoc, payload: unknown): Promise<void>
  role(workspaceId: string, email: string): Promise<CloudRole | null>
  members(workspaceId: string): Promise<Array<{ email: string; role: CloudRole }>>
  invite(workspaceId: string, email: string, role: CloudRole): Promise<void>
  setRole(workspaceId: string, email: string, role: CloudRole): Promise<void>
}

async function readError(res: { status: number; json?: () => Promise<any>; text?: () => Promise<string> }): Promise<string> {
  try {
    if (typeof res.json === 'function') {
      const data = await res.json()
      if (typeof data === 'object' && data !== null) {
        const msg = data.message || data.error_description || data.error || data.hint
        if (msg) return String(msg)
      }
    }
  } catch {
    // fallback
  }
  return `HTTP ${res.status}`
}

export function createCloudClient(deps: CloudClientDeps): CloudClient {
  const baseUrl = deps.baseUrl.replace(/\/+$/, '')

  function getHeaders(extra?: Record<string, string>): Record<string, string> {
    const token = deps.accessToken()
    if (!token) {
      throw new Error('Bạn cần đăng nhập để đồng bộ.')
    }
    return {
      apikey: deps.anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...extra,
    }
  }

  return {
    async pull(workspaceId: string, doc: CloudDoc): Promise<CloudSnapshot | null> {
      const ws = encodeURIComponent(workspaceId)
      const url = `${baseUrl}/rest/v1/pm_snapshots?workspace_id=eq.${ws}&doc=eq.${doc}&select=*`
      const headers = getHeaders()

      const res = await deps.fetchImpl(url, { method: 'GET', headers })
      if (!res.ok) {
        throw new Error(await readError(res))
      }

      const rows: any[] = await res.json()
      if (!Array.isArray(rows) || rows.length === 0) {
        return null
      }

      const row = rows[0]
      return {
        doc,
        schemaVersion: typeof row.schema_version === 'number' ? row.schema_version : 1,
        payload: row.payload,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by,
      }
    },

    async push(workspaceId: string, doc: CloudDoc, payload: unknown): Promise<void> {
      const url = `${baseUrl}/rest/v1/pm_snapshots`
      const headers = getHeaders({
        Prefer: 'resolution=merge-duplicates,return=minimal',
      })

      const schemaVersion =
        typeof payload === 'object' && payload !== null && 'schemaVersion' in payload
          ? (payload as any).schemaVersion
          : 1

      const res = await deps.fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          workspace_id: workspaceId,
          doc,
          schema_version: schemaVersion,
          payload,
        }),
      })

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error('Tài khoản của bạn không có quyền ghi vào workspace này (Viewer chỉ được xem).')
        }
        throw new Error(await readError(res))
      }
    },

    async role(workspaceId: string, email: string): Promise<CloudRole | null> {
      const ws = encodeURIComponent(workspaceId)
      const mail = encodeURIComponent(email.toLowerCase())
      const url = `${baseUrl}/rest/v1/pm_members?workspace_id=eq.${ws}&email=eq.${mail}&select=role`
      const headers = getHeaders()

      const res = await deps.fetchImpl(url, { method: 'GET', headers })
      if (!res.ok) {
        throw new Error(await readError(res))
      }

      const rows: any[] = await res.json()
      if (!Array.isArray(rows) || rows.length === 0) {
        return null
      }

      const rawRole = rows[0]?.role
      return isCloudRole(rawRole) ? rawRole : null
    },

    async members(workspaceId: string): Promise<Array<{ email: string; role: CloudRole }>> {
      const ws = encodeURIComponent(workspaceId)
      const url = `${baseUrl}/rest/v1/pm_members?workspace_id=eq.${ws}&select=email,role&order=email.asc`
      const headers = getHeaders()

      const res = await deps.fetchImpl(url, { method: 'GET', headers })
      if (!res.ok) {
        throw new Error(await readError(res))
      }

      const rows: any[] = await res.json()
      if (!Array.isArray(rows)) return []

      return rows
        .filter((r) => isCloudRole(r.role))
        .map((r) => ({ email: r.email, role: r.role }))
    },

    async invite(workspaceId: string, email: string, role: CloudRole): Promise<void> {
      const url = `${baseUrl}/rest/v1/pm_members`
      const headers = getHeaders({
        Prefer: 'resolution=merge-duplicates',
      })

      const res = await deps.fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          workspace_id: workspaceId,
          email: email.toLowerCase(),
          role,
        }),
      })

      if (!res.ok) {
        throw new Error(await readError(res))
      }
    },

    async setRole(workspaceId: string, email: string, role: CloudRole): Promise<void> {
      const ws = encodeURIComponent(workspaceId)
      const mail = encodeURIComponent(email.toLowerCase())
      const url = `${baseUrl}/rest/v1/pm_members?workspace_id=eq.${ws}&email=eq.${mail}`
      const headers = getHeaders()

      const res = await deps.fetchImpl(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ role }),
      })

      if (!res.ok) {
        throw new Error(await readError(res))
      }
    },
  }
}
