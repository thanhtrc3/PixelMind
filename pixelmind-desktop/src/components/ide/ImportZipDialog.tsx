import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  CheckCircle2,
  FileArchive,
  FolderOpen,
  Loader2,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react'
import Modal from '../Modal'
import { api } from '../../lib/bridge'
import { formatBytes } from '../../lib/format'
import type { ArchiveProgress, ZipInspection, ZipImportOptions } from '@shared/archive'

interface ImportZipDialogProps {
  onClose: () => void
  onPickZip: () => Promise<string | null>
  onSelectFolder: () => Promise<string | null>
  onImport: (options: ZipImportOptions) => Promise<{
    ok: boolean
    error?: string
    warnings?: string[]
  }>
}

const STORAGE_KEY_LAST_DIR = 'pm.zip.last_parent_dir'

const fileNameOf = (target: string) => target.split(/[\\/]/).pop() ?? target
const stripZipExt = (name: string) => name.replace(/\.zip$/i, '')

const ImportZipDialog = ({
  onClose,
  onPickZip,
  onSelectFolder,
  onImport,
}: ImportZipDialogProps) => {
  const [zipPath, setZipPath] = useState('')
  const [inspection, setInspection] = useState<ZipInspection | null>(null)
  const [inspecting, setInspecting] = useState(false)
  const [parentDir, setParentDir] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_LAST_DIR) || ''
    } catch {
      return ''
    }
  })
  const [projectName, setProjectName] = useState('')
  const [userEditedName, setUserEditedName] = useState(false)
  const [stripRoot, setStripRoot] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<ArchiveProgress | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  useEffect(() => {
    const off = api.projects.onArchiveProgress?.((next) => {
      if (next.phase === 'extract') setProgress(next)
    })
    return () => off?.()
  }, [])

  const fullPath = useMemo(() => {
    const p = parentDir.trim().replace(/[\\/]+$/, '')
    const n = projectName.trim()
    return p && n ? `${p}\\${n}` : ''
  }, [parentDir, projectName])

  const handlePickZip = async () => {
    setErrorMsg(null)
    setWarnings([])
    try {
      const picked = await onPickZip()
      if (!picked) return
      setZipPath(picked)
      setInspection(null)
      setInspecting(true)
      const result = await api.projects.inspectZip(picked)
      setInspection(result)
      setWarnings(result.warnings ?? [])
      if (result.ok) {
        if (!userEditedName) {
          setProjectName(result.rootFolder || stripZipExt(fileNameOf(picked)))
        }
        setStripRoot(Boolean(result.rootFolder))
      }
      if (!result.ok) setErrorMsg(result.error ?? 'Tệp ZIP không hợp lệ.')
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không đọc được tệp ZIP đã chọn.')
    } finally {
      setInspecting(false)
    }
  }

  const handlePickFolder = async () => {
    try {
      const folder = await onSelectFolder()
      if (folder) {
        setParentDir(folder)
        setErrorMsg(null)
        try {
          localStorage.setItem(STORAGE_KEY_LAST_DIR, folder)
        } catch {}
      }
    } catch {}
  }

  const handleImport = async () => {
    if (!zipPath) {
      setErrorMsg('Vui lòng chọn tệp ZIP cần nhập.')
      return
    }
    if (!inspection?.ok) {
      setErrorMsg(inspection?.error || 'Tệp ZIP chưa vượt qua bước kiểm tra an toàn.')
      return
    }
    const cleanName = projectName.trim()
    if (!cleanName) {
      setErrorMsg('Vui lòng nhập tên thư mục cho dự án.')
      return
    }
    if (
      /[/\\:*?"<>|]/.test(cleanName) ||
      /[. ]$/.test(cleanName) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(cleanName)
    ) {
      setErrorMsg(
        'Tên thư mục không được chứa ký tự đặc biệt (/, \\, :, *, ?, ", <, >, |), kết thúc bằng dấu chấm/khoảng trắng hoặc trùng tên thiết bị Windows.',
      )
      return
    }
    if (!parentDir.trim()) {
      setErrorMsg('Vui lòng chọn thư mục lưu dự án trên máy.')
      return
    }

    setBusy(true)
    setProgress(null)
    setErrorMsg(null)
    try {
      try {
        localStorage.setItem(STORAGE_KEY_LAST_DIR, parentDir.trim())
      } catch {}

      const res = await onImport({
        zipPath,
        parentDir: parentDir.trim(),
        projectName: cleanName,
        stripRoot,
      })
      if (!res.ok) {
        setErrorMsg(res.error || 'Nhập dự án từ ZIP thất bại.')
        if (res.warnings?.length) setWarnings(res.warnings)
        setBusy(false)
      } else {
        onClose()
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Lỗi không xác định khi nhập dự án ZIP.')
      setBusy(false)
    }
  }

  const progressPercent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
      : 0

  return (
    <Modal
      title="Nhập dự án từ tệp ZIP"
      subtitle="PixelMind kiểm tra cấu trúc và đường dẫn an toàn trước khi giải nén, sau đó mở dự án ngay trong không gian làm việc."
      icon={<FileArchive size={16} />}
      width={600}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={handleImport}
            disabled={busy || inspecting || !inspection?.ok || !projectName.trim()}
          >
            {busy ? (
              <>
                <Loader2 size={13} className="pm-spin" /> Đang giải nén...
              </>
            ) : (
              <>
                <Archive size={13} /> Nhập & Mở dự án
              </>
            )}
          </button>
        </>
      }
    >
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
        <label className="pm-form-label">
          Tệp ZIP của dự án
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <input
              type="text"
              className="pm-input"
              style={{ flex: 1 }}
              value={zipPath}
              placeholder="Chọn tệp .zip đã được nén từ máy khác…"
              readOnly
              onClick={() => void handlePickZip()}
              disabled={busy}
            />
            <button
              type="button"
              className="btn"
              onClick={() => void handlePickZip()}
              disabled={busy || inspecting}
              title="Duyệt tệp ZIP"
            >
              {inspecting ? <Loader2 size={13} className="pm-spin" /> : <FolderOpen size={13} />} Chọn ZIP
            </button>
          </div>
        </label>

        {inspection?.ok && (
          <div className="pm-archive-summary">
            <div className="pm-archive-summary__head">
              <CheckCircle2 size={14} /> Tệp ZIP hợp lệ
            </div>
            <div className="pm-template-meta-row">
              <span className="label">Số tệp:</span>
              <span className="val">{inspection.fileCount.toLocaleString('vi-VN')}</span>
            </div>
            <div className="pm-template-meta-row">
              <span className="label">Thư mục:</span>
              <span className="val">{inspection.directoryCount.toLocaleString('vi-VN')}</span>
            </div>
            <div className="pm-template-meta-row">
              <span className="label">Dung lượng sau giải nén:</span>
              <span className="val">{formatBytes(inspection.totalBytes)}</span>
            </div>
            <div className="pm-template-meta-row">
              <span className="label">Dung lượng tệp ZIP:</span>
              <span className="val">{formatBytes(inspection.compressedBytes)}</span>
            </div>
            <div className="pm-template-meta-row">
              <span className="label">Thư mục gốc:</span>
              <span className="val" style={{ fontFamily: 'var(--font-mono)' }}>
                {inspection.rootFolder ?? '(không có)'}
              </span>
            </div>

            {inspection.rootFolder && (
              <label className="pm-archive-check">
                <input
                  type="checkbox"
                  checked={stripRoot}
                  onChange={(event) => setStripRoot(event.target.checked)}
                  disabled={busy}
                />
                Bỏ lớp thư mục gốc “{inspection.rootFolder}” khi giải nén
              </label>
            )}

            {inspection.entries.length > 0 && (
              <div className="pm-archive-entries">
                {inspection.entries.map((entry) => (
                  <div className="pm-template-file-item" key={entry.name} title={entry.name}>
                    <span className="file-icon">{entry.directory ? '📁' : '📄'}</span>
                    <span className="file-path">{entry.name}</span>
                  </div>
                ))}
                {inspection.fileCount + inspection.directoryCount > inspection.entries.length && (
                  <div className="pm-archive-more">
                    … và {inspection.fileCount + inspection.directoryCount - inspection.entries.length} mục khác
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {inspection && !inspection.ok && (
          <div className="pm-template-error" role="alert">
            <strong>Đã từ chối tệp ZIP: </strong>
            {inspection.error}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="pm-archive-warning">
            <TriangleAlert size={13} />
            <div>
              {warnings.map((warning) => (
                <div key={warning}>{warning}</div>
              ))}
            </div>
          </div>
        )}

        <label className="pm-form-label">
          Thư mục lưu dự án trên máy
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <input
              type="text"
              className="pm-input"
              style={{ flex: 1 }}
              value={parentDir}
              placeholder="Chọn thư mục chứa dự án..."
              readOnly
              onClick={() => void handlePickFolder()}
              disabled={busy}
            />
            <button
              type="button"
              className="btn"
              onClick={() => void handlePickFolder()}
              disabled={busy}
              title="Duyệt thư mục"
            >
              <FolderOpen size={13} /> Duyệt...
            </button>
          </div>
        </label>

        <label className="pm-form-label">
          Tên thư mục dự án
          <input
            type="text"
            className="pm-input"
            style={{ marginTop: 4, width: '100%' }}
            value={projectName}
            placeholder="Ví dụ: my-imported-app"
            onChange={(event) => {
              setProjectName(event.target.value)
              setUserEditedName(true)
            }}
            disabled={busy}
          />
        </label>

        {fullPath && (
          <div className="pm-template-preview-path" style={{ marginTop: 0 }}>
            <div className="label">Dự án sẽ được tạo tại:</div>
            <code className="path-text">{fullPath}</code>
          </div>
        )}

        {busy && progress && (
          <div className="pm-archive-progress">
            <div className="pm-archive-progress__bar">
              <span style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="pm-archive-progress__text">
              Đang giải nén {progress.processed}/{progress.total} tệp
              {progress.current ? ` · ${progress.current}` : ''}
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="pm-template-error" role="alert">
            <ShieldAlert size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            {errorMsg}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default ImportZipDialog
