/* ══════════════════════════════════════════════════════════════
   D1-19: ACCESSIBILITY CHECKER (axe-core) DIALOG
   ══════════════════════════════════════════════════════════════ */

import axeSource from 'axe-core/axe.min.js?raw'
import { AlertTriangle, ExternalLink, Loader2, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import type { A11yImpact, A11yScanResult } from '@shared/a11y'
import { api } from '../lib/bridge'
import Modal from './Modal'

const IMPACT_LABEL: Record<A11yImpact, string> = {
  critical: 'Nghiêm trọng',
  serious: 'Cao',
  moderate: 'Trung bình',
  minor: 'Thấp',
}

const IMPACT_COLOR: Record<A11yImpact, string> = {
  critical: '#ef4444',
  serious: '#f97316',
  moderate: '#eab308',
  minor: '#38bdf8',
}

const IMPACT_ORDER: A11yImpact[] = ['critical', 'serious', 'moderate', 'minor']

interface AccessibilityDialogProps {
  /** URL đang hiển thị trong canvas (previewUrl ?? run.url) để chọn đúng frame. */
  previewUrl: string | null
  onClose: () => void
}

const reasonText: Record<string, string> = {
  'no-frame': 'Chưa tìm thấy khung xem trước nào đang mở. Hãy chạy dự án (F5) rồi quét lại.',
  blocked: 'Trang xem trước chặn truy cập DOM (CSP/iframe). Không thể kết luận là trang không có lỗi.',
  failed: 'Không chạy được axe-core.',
}

export default function AccessibilityDialog({ previewUrl, onClose }: AccessibilityDialogProps) {
  const [result, setResult] = useState<A11yScanResult | null>(null)
  const [scanning, setScanning] = useState(false)

  const scan = async () => {
    setScanning(true)
    try {
      setResult(await api.a11y.scan({ axeSource, previewUrl }))
    } catch (error) {
      setResult({
        ok: false,
        reason: 'failed',
        error: String((error as Error)?.message || error),
        scannedAt: Date.now(),
        violations: [],
        counts: { critical: 0, serious: 0, moderate: 0, minor: 0 },
        total: 0,
      })
    } finally {
      setScanning(false)
    }
  }

  return (
    <Modal
      title="Kiểm tra trợ năng (Accessibility - axe-core)"
      subtitle={previewUrl ? `Khung xem trước: ${previewUrl}` : 'Chưa có khung xem trước nào đang mở'}
      icon={<ShieldAlert size={18} className="pm-accent" />}
      width={760}
      onClose={onClose}
      footer={
        <>
          <button className="btn sm ghost" onClick={scan} disabled={scanning} title="Quét lại trang hiện tại">
            {scanning ? <Loader2 size={12} className="pm-spin" /> : <RefreshCw size={12} />} Quét lại
          </button>
          <div className="grow" />
          <button className="btn" onClick={onClose}>
            Đóng
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Banner điều khiển quét */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'var(--panel-2, #1e293b)',
            borderRadius: 8,
            border: '1px solid var(--line, #334155)',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text, #f8fafc)' }}>
              Tiêu chuẩn WCAG 2.1 AA & Best Practices
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>
              {previewUrl ? `Mục tiêu quét: ${previewUrl}` : 'Vui lòng chạy preview trước khi quét'}
            </div>
          </div>
          <button className="btn primary" onClick={scan} disabled={scanning}>
            {scanning ? (
              <>
                <Loader2 size={13} className="pm-spin" /> Đang quét DOM...
              </>
            ) : (
              <>
                <ShieldCheck size={13} /> {result ? 'Quét lại' : 'Bắt đầu quét'}
              </>
            )}
          </button>
        </div>

        {/* Chưa quét */}
        {!result && !scanning && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted, #94a3b8)', fontSize: 12 }}>
            Nhấn “Bắt đầu quét” để phân tích khả năng tiếp cận (Accessibility) theo tiêu chuẩn WCAG 2.1 trên trang đang xem trước.
          </div>
        )}

        {/* Kết quả lỗi / bị chặn */}
        {result && !result.ok && (
          <div
            className="pm-console-warn"
            style={{
              display: 'flex',
              gap: 10,
              padding: 12,
              borderRadius: 8,
              background: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              color: '#facc15',
              fontSize: 12,
            }}
          >
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600 }}>{reasonText[result.reason ?? 'failed'] || 'Không thể quét.'}</div>
              {result.error && <div style={{ marginTop: 4, fontSize: 11, opacity: 0.9 }}>{result.error}</div>}
            </div>
          </div>
        )}

        {/* Kết quả 0 vi phạm */}
        {result?.ok && result.total === 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 16,
              borderRadius: 8,
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              color: '#4ade80',
            }}
          >
            <ShieldCheck size={24} style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Tuyệt vời! Không phát hiện vi phạm WCAG 2.1 AA.</div>
              <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>
                Đã kiểm tra trên khung: {result.frameUrl || previewUrl}
              </div>
            </div>
          </div>
        )}

        {/* Kết quả có vi phạm */}
        {result?.ok && result.total > 0 && (
          <>
            {/* Tóm tắt mức độ */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {IMPACT_ORDER.map((impact) => {
                const count = result.counts[impact] || 0
                return (
                  <div
                    key={impact}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: 'var(--panel-2, #1e293b)',
                      border: `1px solid ${count > 0 ? IMPACT_COLOR[impact] : 'var(--line, #334155)'}`,
                      fontSize: 11,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: IMPACT_COLOR[impact],
                        display: 'inline-block',
                      }}
                    />
                    <span style={{ color: 'var(--text, #f8fafc)' }}>{IMPACT_LABEL[impact]}:</span>
                    <strong style={{ color: count > 0 ? IMPACT_COLOR[impact] : 'var(--muted, #94a3b8)' }}>{count}</strong>
                  </div>
                )
              })}
              <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted, #94a3b8)', alignSelf: 'center' }}>
                Tổng cộng: <b>{result.total}</b> vi phạm
              </div>
            </div>

            {/* Danh sách nhóm theo mức độ */}
            <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {IMPACT_ORDER.map((impact) => {
                const list = result.violations.filter((v) => v.impact === impact)
                if (list.length === 0) return null
                return (
                  <div key={impact}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: IMPACT_COLOR[impact],
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        marginBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span>{IMPACT_LABEL[impact]}</span>
                      <span
                        style={{
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 10,
                          background: `${IMPACT_COLOR[impact]}20`,
                        }}
                      >
                        {list.length}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {list.map((v) => (
                        <div key={v.id} className="pm-a11y-item">
                          <div className="pm-a11y-item__hd">
                            <b>{v.help}</b>
                            <code style={{ fontSize: 10.5, opacity: 0.8 }}>{v.id}</code>
                            {v.helpUrl ? (
                              <button
                                className="btn secondary"
                                style={{ marginLeft: 'auto', height: 22, fontSize: 10.5, padding: '0 6px' }}
                                onClick={() => void api.system.openExternal(v.helpUrl)}
                                title="Mở trang tài liệu giải thích lỗi"
                              >
                                <ExternalLink size={11} /> Hướng dẫn
                              </button>
                            ) : null}
                          </div>
                          <p style={{ margin: '6px 0', fontSize: 11.5, color: 'var(--muted, #cbd5e1)' }}>{v.description}</p>
                          {v.nodes.map((node, i) => (
                            <div key={`${v.id}-${i}`} className="pm-a11y-node">
                              <code className="pm-a11y-selector">{node.selector}</code>
                              {node.html && <pre>{node.html}</pre>}
                              {node.failureSummary && (
                                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#fca5a5' }}>
                                  {node.failureSummary}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
