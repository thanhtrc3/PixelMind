import { AlertTriangle, Check, Eye, FileCode2, Loader2 } from 'lucide-react'
import type { MutationPreview } from '@shared/toolbox'
import Modal from './Modal'

interface MutationDiffDialogProps {
  open: boolean
  title: string
  subtitle?: string
  preview: MutationPreview | null
  busy?: boolean
  confirmLabel?: string
  onCancel: () => void
  onConfirm: () => void
  /** Chỉ áp dụng lên Live DOM xem trước, không ghi file đĩa */
  onPreviewOnly?: () => void
}

/**
 * Hộp thoại xác nhận thay đổi mã nguồn.
 * Hiển thị đúng vùng mã bị thay đổi (oldBlock/newBlock) trước khi ghi ra đĩa.
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
  if (!open) return null

  const oldLines = (preview?.oldBlock ?? '').split('\n')
  const newLines = (preview?.newBlock ?? '').split('\n')
  const hasPreview = Boolean(preview?.success)

  return (
    <Modal
      title={title}
      subtitle={subtitle}
      width={980}
      icon={
        <span className="pm-diff-icon">
          <FileCode2 size={16} />
        </span>
      }
      onClose={onCancel}
      footer={
        <>
          <span className="grow">
            {preview?.filePath ? (
              <>
                <code>{preview.filePath}</code>
                {preview.startLine ? ` · dòng ${preview.startLine}${preview.endLine && preview.endLine !== preview.startLine ? `–${preview.endLine}` : ''}` : ''}
              </>
            ) : (
              'Chưa có thông tin tệp'
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
          <button className="btn primary" onClick={onConfirm} disabled={busy || !hasPreview}>
            {busy ? <Loader2 size={13} className="pm-spin" /> : <Check size={13} />}
            {confirmLabel}
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
        <div className="pm-diff">
          <section className="pm-diff__pane pm-diff__pane--old">
            <header>
              <span className="pm-diff__dot" />
              Trước
              <em>{oldLines.length} dòng</em>
            </header>
            <pre>
              {oldLines.map((line, index) => (
                <div key={index} className="pm-diff__line">
                  <span className="pm-diff__ln">{index + 1}</span>
                  <code>{line || ' '}</code>
                </div>
              ))}
            </pre>
          </section>
          <section className="pm-diff__pane pm-diff__pane--new">
            <header>
              <span className="pm-diff__dot" />
              Sau
              <em>{newLines.length} dòng</em>
            </header>
            <pre>
              {newLines.map((line, index) => (
                <div key={index} className="pm-diff__line">
                  <span className="pm-diff__ln">{index + 1}</span>
                  <code>{line || ' '}</code>
                </div>
              ))}
            </pre>
          </section>
        </div>
      )}
    </Modal>
  )
}

export default MutationDiffDialog
