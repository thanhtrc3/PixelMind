import { useMemo, useState } from 'react'
import { FolderOpen, GitFork, Loader2 } from 'lucide-react'
import Modal from '../Modal'
import { parseRepoNameFromUrl } from '../../lib/gitUrl'

interface CloneGitDialogProps {
  onClose: () => void
  onSelectFolder: () => Promise<string | null>
  onClone: (options: {
    repoUrl: string
    parentDir: string
    folderName: string
  }) => Promise<{ success: boolean; error?: string }>
}

const STORAGE_KEY_LAST_DIR = 'pm.template.last_parent_dir'

const CloneGitDialog = ({ onClose, onSelectFolder, onClone }: CloneGitDialogProps) => {
  const [repoUrl, setRepoUrl] = useState('')
  const [folderName, setFolderName] = useState('')
  const [userEditedName, setUserEditedName] = useState(false)
  const [parentDir, setParentDir] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_LAST_DIR) || ''
    } catch {
      return ''
    }
  })
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleUrlChange = (val: string) => {
    setRepoUrl(val)
    setErrorMsg(null)
    if (!userEditedName) {
      const derived = parseRepoNameFromUrl(val)
      if (derived) setFolderName(derived)
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

  const fullPath = useMemo(() => {
    const p = parentDir.trim().replace(/[\\/]+$/, '')
    const n = folderName.trim()
    return p && n ? `${p}\\${n}` : ''
  }, [parentDir, folderName])

  const handleStartClone = async () => {
    const cleanUrl = repoUrl.trim()
    if (!cleanUrl) {
      setErrorMsg('Vui lòng nhập đường dẫn repository Git.')
      return
    }
    const cleanName = folderName.trim()
    if (!cleanName) {
      setErrorMsg('Vui lòng nhập tên thư mục cho dự án.')
      return
    }
    if (/[/\\:*?"<>|]/.test(cleanName)) {
      setErrorMsg('Tên thư mục không được chứa ký tự đặc biệt (/, \\, :, *, ?, ", <, >, |).')
      return
    }
    if (!parentDir.trim()) {
      setErrorMsg('Vui lòng chọn thư mục trên máy để lưu dự án.')
      return
    }

    setBusy(true)
    setErrorMsg(null)
    try {
      try {
        localStorage.setItem(STORAGE_KEY_LAST_DIR, parentDir.trim())
      } catch {}

      const res = await onClone({
        repoUrl: cleanUrl,
        parentDir: parentDir.trim(),
        folderName: cleanName,
      })

      if (!res.success) {
        setErrorMsg(res.error || 'Clone mã nguồn thất bại.')
        setBusy(false)
      } else {
        onClose()
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi không xác định khi clone repository.')
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Clone Repository từ Git / GitHub"
      subtitle="Sao chép mã nguồn từ GitHub hoặc Git server về máy tính và tự động mở vào không gian làm việc."
      icon={<GitFork size={16} />}
      width={560}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={handleStartClone}
            disabled={busy || !repoUrl.trim()}
          >
            {busy ? (
              <>
                <Loader2 size={13} className="pm-spin" /> Đang clone mã nguồn...
              </>
            ) : (
              <>
                <GitFork size={13} /> Bắt đầu Clone & Mở
              </>
            )}
          </button>
        </>
      }
    >
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
        <label className="pm-form-label">
          URL Repository Git (HTTPS hoặc SSH)
          <input
            type="text"
            className="pm-input"
            style={{ marginTop: 4, width: '100%' }}
            value={repoUrl}
            placeholder="Ví dụ: https://github.com/owner/repository.git"
            onChange={(e) => handleUrlChange(e.target.value)}
            disabled={busy}
            autoFocus
          />
        </label>

        <label className="pm-form-label">
          Thư mục lưu trữ trên máy
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <input
              type="text"
              className="pm-input"
              style={{ flex: 1 }}
              value={parentDir}
              placeholder="Chọn thư mục chứa dự án..."
              readOnly
              onClick={handlePickFolder}
            />
            <button
              type="button"
              className="btn"
              onClick={handlePickFolder}
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
            value={folderName}
            placeholder="Ví dụ: my-cloned-app"
            onChange={(e) => {
              setFolderName(e.target.value)
              setUserEditedName(true)
            }}
            disabled={busy}
          />
        </label>

        {fullPath && (
          <div className="pm-template-preview-path" style={{ marginTop: 0 }}>
            <div className="label">Đích clone trên máy:</div>
            <code className="path-text">{fullPath}</code>
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

export default CloneGitDialog
