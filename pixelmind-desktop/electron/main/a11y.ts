/* ══════════════════════════════════════════════════════════════
   D1-19: ACCESSIBILITY CHECKER (axe-core) — QUÉT FRAME
   Không phụ thuộc Electron để test được với Node runner.
   ══════════════════════════════════════════════════════════════ */

import type { A11yScanResult, A11yViolation } from '../../shared/a11y.ts'
import {
  MAX_NODES_PER_VIOLATION,
  buildAxeRunScript,
  emptyA11yResult,
  pickA11yFrameIndex,
  summarizeA11y,
} from '../../shared/a11y.ts'

export interface A11yFrame {
  url: string
  executeJavaScript(code: string): Promise<unknown>
}

export async function runA11yScan(
  frames: A11yFrame[],
  axeSource: string,
  previewUrl?: string | null,
): Promise<A11yScanResult> {
  if (!axeSource || typeof axeSource !== 'string') {
    return emptyA11yResult('failed', 'Không tải được axe-core trong ứng dụng.')
  }
  const index = pickA11yFrameIndex(frames, previewUrl)
  if (index === -1) return emptyA11yResult('no-frame', 'Chưa có khung xem trước nào đang mở.')
  const frame = frames[index]
  try {
    await frame.executeJavaScript(axeSource)
    const raw = (await frame.executeJavaScript(buildAxeRunScript())) as
      | { ok?: boolean; reason?: 'no-frame' | 'blocked' | 'failed'; error?: string; violations?: unknown[] }
      | null
    if (!raw || raw.ok !== true || !Array.isArray(raw.violations)) {
      return {
        ...emptyA11yResult(raw?.reason || 'blocked', raw?.error || 'Trang xem trước không trả về kết quả axe.'),
        frameUrl: frame.url,
      }
    }
    const violations = raw.violations as A11yViolation[]
    const safe: A11yViolation[] = violations
      .filter((v) => v && typeof v.id === 'string' && Array.isArray(v.nodes))
      .slice(0, 200)
      .map((v) => ({
        ...v,
        impact: (['critical', 'serious', 'moderate', 'minor'] as const).includes(v.impact as any) ? v.impact : 'minor',
        nodes: v.nodes.slice(0, MAX_NODES_PER_VIOLATION),
      }))
    const { counts, total } = summarizeA11y(safe)
    return {
      ok: true,
      frameUrl: frame.url,
      scannedAt: Date.now(),
      violations: safe,
      counts,
      total,
    }
  } catch (error: any) {
    return {
      ...emptyA11yResult('blocked', String(error?.message || error)),
      frameUrl: frame.url,
    }
  }
}
