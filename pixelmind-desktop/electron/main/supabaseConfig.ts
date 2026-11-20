/* ══════════════════════════════════════════════════════════════
   D1-23: CAU HINH SUPABASE (MAIN PROCESS)
   Module thuan khong import 'electron', doc env va kiem tra tinh hop le.
   ══════════════════════════════════════════════════════════════ */

export interface SupabaseConfig {
  url: string
  anonKey: string
}

export function parseEnvText(text: string): Record<string, string> {
  const result: Record<string, string> = {}
  if (!text) return result

  const lines = text.split(/\r?\n/)
  for (const rawLine of lines) {
    let line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    if (line.startsWith('export ')) {
      line = line.slice(7).trim()
    }
    const idx = line.indexOf('=')
    if (idx === -1) continue

    const key = line.slice(0, idx).trim()
    let val = line.slice(idx + 1).trim()

    // Bỏ dấu nháy bao ngoài (' hoặc ")
    if (
      (val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
      (val.startsWith("'") && val.endsWith("'") && val.length >= 2)
    ) {
      val = val.slice(1, -1)
    }

    result[key] = val
  }

  return result
}

export function readSupabaseConfig(env: Record<string, string | undefined>): SupabaseConfig | null {
  const rawUrl = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL
  const rawKey = env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY

  if (!rawUrl || !rawKey) return null

  const url = rawUrl.trim()
  const anonKey = rawKey.trim()

  if (!/^https:\/\/[^\s]+$/.test(url)) {
    return null
  }

  if (anonKey.length < 20) {
    return null
  }

  return {
    url: url.replace(/\/+$/, ''),
    anonKey,
  }
}
