import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCheck,
  Columns2,
  Eye,
  FileCode2,
  FileText,
  Loader2,
  RotateCcw,
  Rows2,
  X,
} from 'lucide-react'
import type { MutationPreview } from '@shared/toolbox'
import Modal from './Modal'
import {
  computeLcsDiff,
  groupDiffIntoHunks,
  buildMergedText,
  type DiffHunk,
  type DiffLine,
} from '../lib/diff'

interface MutationDiffDialogProps {
  open: boolean
  title: string
  subtitle?: string
  preview: MutationPreview | null
  busy?: boolean
  confirmLabel?: string
  onCancel: () => void
  onConfirm: (mergedBlock?: string) => void
  /** Chỉ áp dụng lên Live DOM xem trước, không ghi file đĩa */
  onPreviewOnly?: () => void
}

type ViewMode = 'split' | 'unified' | 'result'

/**
 * Hộp thoại xác nhận thay đổi mã nguồn (Diff 2.0).
 * - Hỗ trợ xem Diff 2 cột (Split) hoặc 1 dòng (Unified)
 * - Tự động tách các Hunk (khối thay đổi độc lập)
 * - Cho phép Chấp nhận (Accept) hoặc Từ chối (Reject) từng đoạn riêng biệt
 * - Tự động tính toán mã nguồn ghép nối cuối cùng (Merged code)
 */
const MutationDiffDialog = ({
  open,
  title,
  subtitle,
  preview,
  busy = false,
  confirmLabel = 'Ghi vào mã nguồn',
  onCancel,
  onConfirm,
  onPreviewOnly,
}: MutationDiffDialogProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('unified')
  const [hunks, setHunks] = useState<DiffHunk[]>([])

  const oldBlock = preview?.oldBlock ?? ''
  const newBlock = preview?.newBlock ?? ''
  const hasPreview = Boolean(preview?.success)

  // Tính toán diff và hunks khi preview thay đổi
  const diffLines: DiffLine[] = useMemo(() => {
    if (!open || !hasPreview) return []
    const oldLines = oldBlock.split('\n')
    const newLines = newBlock.split('\n')
    return computeLcsDiff(oldLines, newLines)
  }, [open, hasPreview, oldBlock, newBlock])

  // Khởi tạo danh sách Hunks với trạng thái mặc định là accepted = true
  useEffect(() => {
    if (diffLines.length > 0) {
      const generatedHunks = groupDiffIntoHunks(diffLines, 2)
      setHunks(generatedHunks)
    } else {
      setHunks([])
    }
  }, [diffLines])

  // Bật/tắt trạng thái của 1 hunk cụ thể
  const toggleHunk = (hunkId: string) => {
    setHunks((prev) =>
      prev.map((h) => (h.id === hunkId ? { ...h, accepted: !h.accepted } : h))
    )
  }

  // Chấp nhận tất cả các hunks
  const handleAcceptAll = () => {
    setHunks((prev) => prev.map((h) => ({ ...h, accepted: true })))
  }

  // Từ chối tất cả các hunks
  const handleRejectAll = () => {
    setHunks((prev) => prev.map((h) => ({ ...h, accepted: false })))
  }

  // Thống kê số lượng
  const stats = useMemo(() => {
    let added = 0
    let deleted = 0
    let acceptedCount = 0

    hunks.forEach((h) => {
      if (h.accepted) {
        acceptedCount++
        added += h.addedCount
        deleted += h.deletedCount
      }
    })

    return {
      totalHunks: hunks.length,
      acceptedCount,
      allAccepted: hunks.length > 0 && acceptedCount === hunks.length,
      noneAccepted: hunks.length > 0 && acceptedCount === 0,
      added,
      deleted,
    }
  }, [hunks])

  // Mã nguồn kết quả sau khi ghép nối các hunk được chọn
  const mergedText = useMemo(() => {
    if (!diffLines.length) return newBlock
    return buildMergedText(diffLines, hunks)
  }, [diffLines, hunks, newBlock])

  if (!open) return null

  const handleConfirmClick = () => {
    // Nếu tất cả đều accepted thì truyền newBlock, nếu có hunk bị reject thì truyền mergedText
    onConfirm(stats.allAccepted ? newBlock : mergedText)
  }

  return (
    <Modal
      title={title}
      subtitle={subtitle}
      width={1020}
      icon={
        <span className="pm-diff-icon">
          <FileCode2 size={16} />
        </span>
      }
      onClose={onCancel}
      footer={
        <>
          <span className="grow" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            {preview?.filePath ? (
              <>
                <code>{preview.filePath}</code>
                {preview.startLine ? (
                  <span style={{ color: 'var(--text-3)' }}>
                    · dòng {preview.startLine}
                    {preview.endLine && preview.endLine !== preview.startLine ? `–${preview.endLine}` : ''}
                  </span>
                ) : null}
              </>
            ) : (
              'Chưa có thông tin tệp'
            )}
            {hunks.length > 0 && (
              <span
                style={{
                  fontSize: 10,
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: stats.noneAccepted ? 'rgba(239, 68, 68, 0.15)' : 'var(--panel-3)',
                  color: stats.noneAccepted ? '#f87171' : 'var(--text-3)',
                }}
              >
                Đã chọn: {stats.acceptedCount}/{stats.totalHunks} đoạn
              </span>
            )}
          </span>

          <button className="btn secondary" onClick={onCancel} disabled={busy}>
            Huỷ
          </button>

          {onPreviewOnly && (
            <button
              className="btn secondary"
              onClick={onPreviewOnly}
              disabled={busy}
              title="Chỉ áp dụng lên trang xem trước hiện tại, không ghi vào file"
            >
              <Eye size={13} /> Chỉ xem trước
            </button>
          )}

          <button
            className={`btn ${stats.noneAccepted ? 'secondary' : 'primary'}`}
            onClick={handleConfirmClick}
            disabled={busy || !hasPreview}
            title={stats.noneAccepted ? 'Không có đoạn nào được chọn (giữ nguyên mã nguồn)' : undefined}
          >
            {busy ? <Loader2 size={13} className="pm-spin" /> : <Check size={13} />}
            {stats.noneAccepted ? 'Giữ nguyên (Bỏ qua hết)' : confirmLabel}
          </button>
        </>
      }
    >
      {preview && !preview.success ? (
        <div className="pm-diff-error">
          <AlertTriangle size={18} />
          <div>
            <strong>Không thể tạo thay đổi</strong>
            <p>{preview.error || 'Đã xảy ra lỗi không xác định.'}</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* ── THANH ĐIỀU KHIỂN DIFF (TOOLBAR) ── */}
          <div className="pm-diff-toolbar">
            <div className="pm-diff-toolbar__stats">
              <span className="pm-diff-stat-hunks">
                <b>{hunks.length}</b> đoạn thay đổi
              </span>
              <span style={{ color: 'var(--line-2)' }}>·</span>
              <span className="pm-diff-stat-add">+{stats.added} dòng</span>
              <span className="pm-diff-stat-del">-{stats.deleted} dòng</span>
            </div>

            <div className="pm-diff-toolbar__actions">
              {/* Hành động Hunk hàng loạt */}
              {hunks.length > 1 && (
                <>
                  <button
                    className="pm-diff-mode-btn"
                    onClick={handleAcceptAll}
                    disabled={stats.allAccepted}
                    title="Chấp nhận toàn bộ các đoạn thay đổi"
                  >
                    <CheckCheck size={12} /> Chọn tất cả
                  </button>
                  <button
                    className="pm-diff-mode-btn"
                    onClick={handleRejectAll}
                    disabled={stats.noneAccepted}
                    title="Từ chối toàn bộ các đoạn thay đổi"
                  >
                    <RotateCcw size={12} /> Bỏ chọn hết
                  </button>
                  <span style={{ width: 1, height: 16, background: 'var(--line)', margin: '0 4px' }} />
                </>
              )}

              {/* Chế độ xem */}
              <button
                className={`pm-diff-mode-btn ${viewMode === 'unified' ? 'active' : ''}`}
                onClick={() => setViewMode('unified')}
                title="Xem Diff dạng gộp 1 dòng (Unified)"
              >
                <Rows2 size={12} /> Gộp dòng
              </button>
              <button
                className={`pm-diff-mode-btn ${viewMode === 'split' ? 'active' : ''}`}
                onClick={() => setViewMode('split')}
                title="Xem Diff tách 2 cột (Trước / Sau)"
              >
                <Columns2 size={12} /> Tách đôi
              </button>
              <button
                className={`pm-diff-mode-btn ${viewMode === 'result' ? 'active' : ''}`}
                onClick={() => setViewMode('result')}
                title="Xem trước kết quả mã nguồn sau khi áp dụng các đoạn được chọn"
              >
                <FileText size={12} /> Kết quả ghép
              </button>
            </div>
          </div>

          {/* ── NỘI DUNG DIFF THEO TỪNG CHẾ ĐỘ ── */}
          {viewMode === 'result' ? (
            /* Chế độ xem trước kết quả đã ghép */
            <div
              style={{
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-md, 6px)',
                background: 'var(--panel-2)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '6px 10px',
                  background: 'var(--panel-3)',
                  borderBottom: '1px solid var(--line)',
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: 'var(--text-2)',
                }}
              >
                MÃ NGUỒN CUỐI CÙNG SẼ ĐƯỢC GHI XUỐNG TỆP
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: '10px 14px',
                  maxHeight: '52vh',
                  overflow: 'auto',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 11,
                  lineHeight: 1.6,
                  color: 'var(--text)',
                }}
              >
                {mergedText}
              </pre>
            </div>
          ) : hunks.length === 0 ? (
            /* Không có đoạn thay đổi nào */
            <div className="pm-hint" style={{ padding: 32, textAlign: 'center' }}>
              Không phát hiện thấy sự thay đổi nào giữa hai khối mã.
            </div>
          ) : (
            /* Danh sách các Hunk độc lập */
            <div className="pm-diff-hunks">
              {hunks.map((hunk) => (
                <div
                  key={hunk.id}
                  className={`pm-diff-hunk ${!hunk.accepted ? 'pm-diff-hunk--rejected' : ''}`}
                >
                  {/* Header của từng Hunk */}
                  <div className="pm-diff-hunk__hd">
                    <div className="pm-diff-hunk__info">
                      <strong>Đoạn {hunk.hunkIndex}</strong>
                      <span style={{ color: 'var(--text-3)', fontSize: 10 }}>
                        (Dòng cũ: {hunk.oldStart}–{hunk.oldEnd} ➔ Dòng mới: {hunk.newStart}–{hunk.newEnd})
                      </span>
                      {hunk.accepted ? (
                        <span className="pm-diff-hunk__badge pm-diff-hunk__badge--accepted">
                          <Check size={10} /> Áp dụng (+{hunk.addedCount} -{hunk.deletedCount})
                        </span>
                      ) : (
                        <span className="pm-diff-hunk__badge pm-diff-hunk__badge--rejected">
                          <X size={10} /> Đã bỏ qua (giữ nguyên mã cũ)
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      className="pm-diff-hunk__toggle-btn"
                      onClick={() => toggleHunk(hunk.id)}
                      title={hunk.accepted ? 'Từ chối đoạn này' : 'Chấp nhận đoạn này'}
                    >
                      {hunk.accepted ? (
                        <>
                          <X size={11} style={{ color: '#f87171' }} /> Bỏ qua đoạn này
                        </>
                      ) : (
                        <>
                          <Check size={11} style={{ color: '#4ade80' }} /> Chấp nhận đoạn này
                        </>
                      )}
                    </button>
                  </div>

                  {/* Body của Hunk: Gộp dòng (Unified) hoặc Tách đôi (Split) */}
                  {viewMode === 'unified' ? (
                    <div className="pm-diff-unified">
                      {hunk.lines.map((line, lIdx) => (
                        <div
                          key={lIdx}
                          className={`pm-diff-unified__row pm-diff-unified__row--${line.type}`}
                        >
                          <span className="pm-diff-unified__ln">{line.oldLn ?? ' '}</span>
                          <span className="pm-diff-unified__ln">{line.newLn ?? ' '}</span>
                          <span className="pm-diff-unified__sign">
                            {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
                          </span>
                          <span className="pm-diff-unified__code">{line.text || ' '}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Chế độ tách đôi (Split) cho riêng Hunk */
                    <div className="pm-diff" style={{ minHeight: 'unset', border: 0 }}>
                      <section className="pm-diff__pane pm-diff__pane--old" style={{ border: 0, borderRadius: 0 }}>
                        <pre style={{ maxHeight: '30vh', margin: 0 }}>
                          {hunk.lines
                            .filter((l) => l.type !== 'add')
                            .map((l, idx) => (
                              <div
                                key={idx}
                                className="pm-diff__line"
                                style={{
                                  background: l.type === 'del' ? 'rgba(239, 68, 68, 0.12)' : undefined,
                                }}
                              >
                                <span className="pm-diff__ln">{l.oldLn ?? ' '}</span>
                                <code>{l.text || ' '}</code>
                              </div>
                            ))}
                        </pre>
                      </section>
                      <section className="pm-diff__pane pm-diff__pane--new" style={{ border: 0, borderRadius: 0, borderLeft: '1px solid var(--line)' }}>
                        <pre style={{ maxHeight: '30vh', margin: 0 }}>
                          {hunk.lines
                            .filter((l) => l.type !== 'del')
                            .map((l, idx) => (
                              <div
                                key={idx}
                                className="pm-diff__line"
                                style={{
                                  background: l.type === 'add' ? 'rgba(34, 197, 94, 0.12)' : undefined,
                                }}
                              >
                                <span className="pm-diff__ln">{l.newLn ?? ' '}</span>
                                <code>{l.text || ' '}</code>
                              </div>
                            ))}
                        </pre>
                      </section>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

export default MutationDiffDialog
