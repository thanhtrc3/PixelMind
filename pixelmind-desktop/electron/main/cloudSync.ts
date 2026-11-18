/* ══════════════════════════════════════════════════════════════
   D1-24: CLOUD SYNC MERGE ENGINE (MAIN PROCESS)
   Module thuần không import 'electron', merge 3 chiều theo hash SHA-256.
   ══════════════════════════════════════════════════════════════ */

import { createHash } from 'node:crypto'
import type { CloudDoc, CloudSnapshot, CloudSyncReport } from '../../shared/cloud.ts'

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }
  const keys = Object.keys(value as Record<string, unknown>).sort()
  const parts: string[] = []
  for (const key of keys) {
    const val = (value as Record<string, unknown>)[key]
    if (val !== undefined) {
      parts.push(`${JSON.stringify(key)}:${stableStringify(val)}`)
    }
  }
  return `{${parts.join(',')}}`
}

export function hashPayload(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex')
}

export type MergeAction = 'push' | 'pull' | 'noop' | 'conflict'

export function decideMerge(input: {
  localHash: string | null
  remoteHash: string | null
  lastSyncedHash: string | null
}): MergeAction {
  const { localHash, remoteHash, lastSyncedHash } = input

  if (!localHash && !remoteHash) return 'noop'
  if (localHash && !remoteHash) return 'push'
  if (!localHash && remoteHash) return 'pull'

  if (localHash === remoteHash) return 'noop'

  if (lastSyncedHash && localHash === lastSyncedHash) return 'pull'
  if (lastSyncedHash && remoteHash === lastSyncedHash) return 'push'

  return 'conflict'
}

export interface SyncDoc {
  doc: CloudDoc
  payload: unknown
}

export interface SyncAdapter {
  pull(doc: CloudDoc): Promise<CloudSnapshot | null>
  push(doc: CloudDoc, payload: unknown): Promise<void>
}

export interface SyncHooks {
  lastSynced: Record<string, string>
  onPull: (doc: CloudDoc, payload: unknown) => Promise<void>
  onPush: (doc: CloudDoc, hash: string) => Promise<void>
  /** Ghi backup bản local, trả đường dẫn file backup. */
  onConflict: (doc: CloudDoc, localPayload: unknown) => Promise<string>
}

export async function syncDocs(
  adapter: SyncAdapter,
  local: SyncDoc[],
  hooks: SyncHooks,
): Promise<CloudSyncReport> {
  const report: CloudSyncReport = {
    ok: true,
    pushed: [],
    pulled: [],
    conflicts: [],
    skipped: [],
  }

  for (const item of local) {
    const doc = item.doc
    const localPayload = item.payload
    const localHash = localPayload !== null && localPayload !== undefined ? hashPayload(localPayload) : null

    let remoteSnapshot: CloudSnapshot | null = null
    try {
      remoteSnapshot = await adapter.pull(doc)
    } catch (err) {
      report.ok = false
      report.error = (err as Error).message || String(err)
      return report
    }

    const remotePayload = remoteSnapshot?.payload ?? null
    const remoteHash = remotePayload !== null && remotePayload !== undefined ? hashPayload(remotePayload) : null
    const lastSyncedHash = hooks.lastSynced[doc] ?? null

    const action = decideMerge({ localHash, remoteHash, lastSyncedHash })

    try {
      if (action === 'push') {
        await adapter.push(doc, localPayload)
        await hooks.onPush(doc, localHash!)
        report.pushed.push(doc)
      } else if (action === 'pull') {
        await hooks.onPull(doc, remotePayload)
        await hooks.onPush(doc, remoteHash!)
        report.pulled.push(doc)
      } else if (action === 'conflict') {
        const backupPath = await hooks.onConflict(doc, localPayload)
        await hooks.onPull(doc, remotePayload)
        await hooks.onPush(doc, remoteHash!)
        report.conflicts.push({ doc, backupPath })
      } else {
        // noop
        if (localHash) {
          await hooks.onPush(doc, localHash)
        }
        report.skipped.push(doc)
      }
    } catch (err) {
      report.ok = false
      report.error = (err as Error).message || String(err)
      return report
    }
  }

  return report
}
