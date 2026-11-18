/* ══════════════════════════════════════════════════════════════
   D1-26: DEPLOY / PREVIEW URL — KIỂU DỮ LIỆU & HÀM THUẦN
   ══════════════════════════════════════════════════════════════ */

export type DeployProvider = 'vercel' | 'netlify' | 'custom'

export interface DeployLog {
  at: number
  stream: 'stdout' | 'stderr' | 'system'
  text: string
}

export interface DeployState {
  status: 'idle' | 'running' | 'success' | 'error'
  url: string | null
  error?: string
  phase: string
}

export const DEPLOY_PROVIDERS: DeployProvider[] = ['vercel', 'netlify', 'custom']

export function redactSecrets(text: string, secrets: string[]): string {
  if (!text || !Array.isArray(secrets) || secrets.length === 0) return text
  let result = text
  for (const s of secrets) {
    const clean = String(s || '').trim()
    if (clean.length >= 6) {
      result = result.split(clean).join('***')
    }
  }
  return result
}

export function parseDeployUrl(text: string): string | null {
  if (!text) return null
  const matches = text.match(/https:\/\/[^\s"'<>`]+/g)
  if (!matches) return null

  for (const raw of matches) {
    let clean = raw.replace(/[.,;)}\]]+$/, '')
    if (clean.includes('localhost') || clean.includes('127.0.0.1')) {
      continue
    }
    if (/^https:\/\/[a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]+$/.test(clean)) {
      return clean
    }
  }
  return null
}

export function deployErrorMessage(code: number | null, stderrTail: string): string {
  if (code === null) {
    return 'Không khởi chạy được lệnh triển khai. Kiểm tra tên lệnh trong Cài đặt → Triển khai.'
  }
  const tail = String(stderrTail || '').trim()
  return `Lệnh triển khai kết thúc với mã ${code}.` + (tail ? `\n${tail}` : '')
}

export function idleDeployState(): DeployState {
  return {
    status: 'idle',
    url: null,
    phase: '',
  }
}
