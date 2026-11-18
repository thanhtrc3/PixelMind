/* ══════════════════════════════════════════════════════════════
   D1-24: CLOUD SNAPSHOTS BUILDER & PARSER (MAIN PROCESS)
   Module thuần đóng gói/giải mã snapshot với schemaVersion.
   ══════════════════════════════════════════════════════════════ */

import type { Settings, DesignTokens } from '../../shared/types.ts'

export const CLOUD_SCHEMA_VERSION = 1

export function buildSettingsSnapshot(settings: Settings): { schemaVersion: number; settings: Partial<Settings> } {
  const copy: Partial<Settings> = { ...settings }
  delete copy.cloudWorkspaceId
  return {
    schemaVersion: CLOUD_SCHEMA_VERSION,
    settings: copy,
  }
}

export function readSettingsPayload(payload: unknown): Partial<Settings> | null {
  if (typeof payload !== 'object' || payload === null) return null
  const p = payload as Record<string, unknown>
  if (p.schemaVersion !== CLOUD_SCHEMA_VERSION) return null
  if (typeof p.settings !== 'object' || p.settings === null) return null

  const cleanSettings = { ...(p.settings as Record<string, unknown>) }
  delete cleanSettings.cloudWorkspaceId
  return cleanSettings as Partial<Settings>
}

export function buildTokensSnapshot(tokens: DesignTokens): { schemaVersion: number; tokens: DesignTokens } {
  return {
    schemaVersion: CLOUD_SCHEMA_VERSION,
    tokens,
  }
}

export function readTokensPayload(payload: unknown): DesignTokens | null {
  if (typeof payload !== 'object' || payload === null) return null
  const p = payload as Record<string, unknown>
  if (p.schemaVersion !== CLOUD_SCHEMA_VERSION) return null
  if (typeof p.tokens !== 'object' || p.tokens === null) return null

  const t = p.tokens as Record<string, unknown>
  if (!Array.isArray(t.colors)) return null

  return t as unknown as DesignTokens
}
