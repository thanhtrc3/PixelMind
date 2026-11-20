/* ══════════════════════════════════════════════════════════════
   D1-24 & D1-25: MO HINH DONG BO CLOUD & VAI TRO (SHARED)
   ══════════════════════════════════════════════════════════════ */

export type CloudRole = 'owner' | 'editor' | 'viewer'
export type CloudDoc = 'settings' | 'designTokens'

export interface CloudSnapshot<T = unknown> {
  doc: CloudDoc
  schemaVersion: number
  payload: T
  updatedAt: string
  updatedBy?: string
}

export interface CloudSyncReport {
  ok: boolean
  error?: string
  pushed: CloudDoc[]
  pulled: CloudDoc[]
  conflicts: Array<{ doc: CloudDoc; backupPath: string }>
  skipped: CloudDoc[]
}

export function isCloudRole(value: unknown): value is CloudRole {
  return value === 'owner' || value === 'editor' || value === 'viewer'
}

export function canWrite(role: CloudRole | null): boolean {
  return role === 'owner' || role === 'editor'
}
