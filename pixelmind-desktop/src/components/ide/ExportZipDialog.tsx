import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  CheckCircle2,
  FolderOpen,
  Loader2,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import Modal from '../Modal'
import { api } from '../../lib/bridge'
import { formatBytes } from '../../lib/format'
import {
  EXPORT_EXCLUDED_DIRS,
  EXPORT_EXCLUDED_FILES,
  type ArchiveProgress,
  type ZipExportOptions,
  type ZipExportResult,
} from '@shared/archive'

interface ExportZipDialogProps {
  project: { id: string; name: string; path: string }
  onClose: () => void
  onPickSavePath: (defaultName: string) => Promise<string | null>
  onExport: (options: ZipExportOptions) => Promise<ZipExportResult>
}

const PREVIEW_EXCLUSIONS = EXPORT_EXCLUDED_DIRS.slice(0, 10)

const ExportZipDialog = ({
  project,
  onClose,
  onPickSavePath,
  onExport,
}: ExportZipDialogProps) => {
  const [zipPath, setZipPath] = useState('')
  const [includeGit, setIncludeGit] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<ArchiveProgress | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [result, setResult] = useState<ZipExportResult | null>(null)

  useEffect(() => {
    const off = api.projects.onArchiveProgress?.((next) => {
      if (next.phase === 'compress') setProgress(next)
    })
    return () => off?.()
  }, [])

  const handlePickSavePath = async () => {
    try {
      const picked = await onPickSavePath(project.name)
      if (picked) {
        setZipPath(picked)
        setErrorMsg(null)
        setResult(null)
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không chọn được đường dẫn lưu tệp ZIP.')
    }
  }

  const handleExport = async () => {
    if (!zipPath) {
      setErrorMsg('Vui lòng chọn đường dẫn lưu tệp ZIP.')
      return
    }
    setBusy(true)
    setProgress(null)
    setErrorMsg(null)
    setResult(null)
    try {
      const res = await onExport({ projectId: project.id, zipPath, includeGit })
      if (!res.ok) {
        setErrorMsg(res.error || 'Xuất dự án ra ZIP thất bại.')
        setBusy(false)
      } else {
        setResult(res)
        setBusy(false)
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Lỗi không xác định khi xuất dự án ZIP.')
      setBusy(false)
    }
  }

  const progressPercent = useMemo(() => {
    if (!progress || progress.total <= 0) return 0
    return Math.min(100, Math.round((progress.processed / progress.total) * 100))
  }, [progress])

  return (
    <Modal
      title="Xuất dự án ra tệp ZIP"
      subtitle="Đóng gói mã nguồn để chia sẻ hoặc sao lưu. Tệp nguồn chỉ được đọc, không bị thay đổi."
      icon={<Archive size={16} />}
      width={600}
      onClose={onClose}
      footer={
        result?.ok ? (
          <button type="button" className="btn primary" onClick={onClose}>
            Đóng
          </button>
        ) : (
          <>
            <button type="button" className="btn" onClick={onClose} disabled={busy}>
              Hủy
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={handleExport}
              disabled={busy || !zipPath}
            >
              {busy ? (
                <>
                  <Loader2 size={13} className="pm-spin" /> Đang nén dự án...
                </>
              ) : (
                <>
                  <Archive size={13} /> Xuất ZIP
                </>
              )}
            </button>
          </>
        )
      }
    >
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
        <div className="pm-archive-summary">
          <div className="pm-archive-summary__head">
            <ShieldCheck size={14} /> Dự án sẽ được đóng gói
          </div>
          <div className="pm-template-meta-row">
            <span className="label">Tên dự án:</span>
            <span className="val">{project.name}</span>
          </div>
          <div className="pm-template-meta-row">
            <span className="label">Thư mục nguồn:</span>
            <span className="val" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>
              {project.path}
            </span>
          </div>
        </div>

        <label className="pm-form-label">
          Lưu tệp ZIP tại
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <input
              type="text"
              className="pm-input"
              style={{ flex: 1 }}
              value={zipPath}
              placeholder={`${project.name}.zip`}
              readOnly
              onClick={() => void handlePickSavePath()}
              disabled={busy}
            />
            <button
              type="button"
              className="btn"
              onClick={() => void handlePickSavePath()}
              disabled={busy}
              title="Chọn nơi lưu"
            >
              <FolderOpen size={13} /> Chọn nơi lưu...
            </button>
          </div>
        </label>

        <div className="pm-archive-summary">
          <div className="pm-archive-summary__head">
            <TriangleAlert size={14} /> Tự động loại trừ khỏi ZIP
          </div>
          <div className="pm-archive-tags">
            {PREVIEW_EXCLUSIONS.map((dir) => (
              <span className="pm-archive-tag" key={dir}>
                {dir}
              </span>
            ))}
            <span className="pm-archive-tag">…</span>
            {EXPORT_EXCLUDED_FILES.slice(0, 3).map((file) => (
              <span className="pm-archive-tag" key={file}>
                {file}
              </span>
            ))}
          </div>
          <div className="pm-archive-note">
            Dependency, thư mục quản lý phiên bản và artifact build không được đưa vào ZIP để tệp gọn và sạch.
            Sau khi giải nén, chạy lại lệnh cài dependencies của dự án là dùng được.
          </div>
          <label className="pm-archive-check">
            <input
              type="checkbox"
              checked={includeGit}
              onChange={(event) => setIncludeGit(event.target.checked)}
              disabled={busy}
            />
            Kèm thư mục <code>.git</code> (giữ lịch sử commit)
          </label>
        </div>

        {busy && progress && (
          <div className="pm-archive-progress">
            <div className="pm-archive-progress__bar">
              <span style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="pm-archive-progress__text">
              Đang nén {progress.processed}/{progress.total} tệp
              {progress.current ? ` · ${progress.current}` : ''}
            </div>
          </div>
        )}

        {result?.ok && (
          <div className="pm-archive-success" role="status">
            <CheckCircle2 size={14} />
            <div>
              <b>Đã xuất ZIP thành công.</b>
              <div>
                {result.fileCount?.toLocaleString('vi-VN')} tệp · {formatBytes(result.totalBytes ?? 0)}
                {result.skipped ? ` · bỏ qua ${result.skipped.toLocaleString('vi-VN')} mục` : ''}
              </div>
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>{result.zipPath}</code>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="pm-template-error" role="alert">
            {errorMsg}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default ExportZipDialog
