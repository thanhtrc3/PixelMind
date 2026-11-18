/* ══════════════════════════════════════════════════════════════
   D1-19: ACCESSIBILITY CHECKER (axe-core) — KIỂU DỮ LIỆU & HÀM THUẦN
   ══════════════════════════════════════════════════════════════ */

export type A11yImpact = 'critical' | 'serious' | 'moderate' | 'minor'

export interface A11yNode {
  selector: string
  html: string
  failureSummary: string
}

export interface A11yViolation {
  id: string
  impact: A11yImpact
  help: string
  description: string
  helpUrl: string
  tags: string[]
  nodes: A11yNode[]
}

export interface A11yScanResult {
  ok: boolean
  reason?: 'no-frame' | 'blocked' | 'failed'
  error?: string
  frameUrl?: string
  scannedAt: number
  violations: A11yViolation[]
  counts: Record<A11yImpact, number>
  total: number
}

export const A11Y_TAGS: string[] = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']
export const MAX_NODES_PER_VIOLATION = 20

const IMPACTS: A11yImpact[] = ['critical', 'serious', 'moderate', 'minor']

export function summarizeA11y(violations: Array<Omit<A11yViolation, 'impact'> & { impact: A11yImpact | null }>): {
  counts: Record<A11yImpact, number>
  total: number
} {
  const counts: Record<A11yImpact, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 }
  for (const v of violations) {
    const key = v.impact && IMPACTS.includes(v.impact) ? v.impact : 'minor'
    counts[key] += 1
  }
  return { counts, total: violations.length }
}

export function emptyA11yResult(reason: A11yScanResult['reason'], error?: string): A11yScanResult {
  return {
    ok: false,
    reason,
    error,
    scannedAt: Date.now(),
    violations: [],
    counts: { critical: 0, serious: 0, moderate: 0, minor: 0 },
    total: 0,
  }
}

const trimUrl = (url: string) => url.split('?')[0].replace(/\/+$/, '') || '/'

export function pickA11yFrameIndex(frames: Array<{ url: string }>, previewUrl?: string | null): number {
  if (frames.length === 0) return -1
  if (previewUrl) {
    const wanted = trimUrl(previewUrl)
    const index = frames.findIndex((f) => trimUrl(f.url || '') === wanted)
    if (index !== -1) return index
  }
  const httpIndex = frames.findIndex((f) => /^https?:/i.test(f.url || ''))
  return httpIndex === -1 ? 0 : httpIndex
}

/**
 * Script chạy TRONG frame preview. Trả object thuần JSON để IPC serialize được.
 * `axe` do main process nạp trước bằng executeJavaScript(axeSource).
 */
export function buildAxeRunScript(): string {
  return `(function () {
    if (typeof axe === 'undefined' || typeof axe.run !== 'function') {
      return { ok: false, reason: 'blocked', error: 'axe-core chưa được nạp vào trang xem trước.' };
    }
    var IMPACTS = ['critical','serious','moderate','minor'];
    return axe.run(document, {
      runOnly: { type: 'tag', values: ${JSON.stringify(A11Y_TAGS)} },
      resultTypes: ['violations']
    }).then(function (results) {
      return {
        ok: true,
        violations: (results.violations || []).map(function (v) {
          return {
            id: String(v.id),
            impact: IMPACTS.indexOf(v.impact) === -1 ? 'minor' : v.impact,
            help: String(v.help || ''),
            description: String(v.description || ''),
            helpUrl: String(v.helpUrl || ''),
            tags: v.tags || [],
            nodes: (v.nodes || []).slice(0, ${MAX_NODES_PER_VIOLATION}).map(function (n) {
              var target = n.target;
              return {
                selector: Array.isArray(target) ? target.join(' ') : String(target || ''),
                html: String(n.html || ''),
                failureSummary: String(n.failureSummary || '')
              };
            })
          };
        })
      };
    }).catch(function (err) {
      return { ok: false, reason: 'blocked', error: String((err && err.message) || err) };
    });
  })()`
}
