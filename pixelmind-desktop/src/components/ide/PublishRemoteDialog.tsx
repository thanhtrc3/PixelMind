import { useState } from 'react'
import { Globe, Loader2, Upload } from 'lucide-react'
import Modal from '../Modal'

interface PublishRemoteDialogProps {
  projectName: string
  onClose: () => void
  onPublish: (remoteUrl: string) => Promise<{ success: boolean; error?: string }>
}

const PublishRemoteDialog = ({
  projectName,
  onClose,
  onPublish,
}: PublishRemoteDialogProps) => {
  const [remoteUrl, setRemoteUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handlePublish = async () => {
    const cleanUrl = remoteUrl.trim()
    if (!cleanUrl) {
      setErrorMsg('Vui lòng nhập đường dẫn repository Git từ xa (GitHub/GitLab/etc.).')
      return
    }

    setBusy(true)
    setErrorMsg(null)
    try {
      const res = await onPublish(cleanUrl)
      if (!res.success) {
        setErrorMsg(res.error || 'Xuất bản repository thất bại.')
        setBusy(false)
      } else {
        onClose()
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi không xác định khi liên kết remote.')
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Xuất bản lên GitHub / Cấu hình Remote"
      subtitle={`Dự án "${projectName}" hiện chưa liên kết với kho lưu trữ từ xa nào.`}
      icon={<Globe size={16} />}
      width={520}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={handlePublish}
            disabled={busy || !remoteUrl.trim()}
          >
            {busy ? (
              <>
                <Loader2 size={13} className="pm-spin" /> Đang liên kết & Push...
              </>
            ) : (
              <>
                <Upload size={13} /> Liên kết & Push ngay
              </>
            )}
          </button>
        </>
      }
    >
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
        <div
          style={{
            padding: '10px 12px',
            background: 'var(--panel-2)',
            border: '1px solid var(--line)',
            borderRadius: 6,
            fontSize: 11.5,
            lineHeight: 1.5,
            color: 'var(--text-2)',
          }}
        >
          💡 <b>Hướng dẫn:</b> Nếu bạn vừa tạo một repository mới trên GitHub (trống, chưa có file),
          hãy sao chép URL (HTTPS hoặc SSH) của repository đó và dán vào bên dưới. PixelMind sẽ cấu hình{' '}
          <code>origin</code> và tự động đẩy toàn bộ mã nguồn lên nhánh hiện tại.
        </div>

        <label className="pm-form-label">
          URL Repository GitHub / Git Server
          <input
            type="text"
            className="pm-input"
            style={{ marginTop: 4, width: '100%' }}
            value={remoteUrl}
            placeholder="Ví dụ: https://github.com/username/my-repo.git"
            onChange={(e) => {
              setRemoteUrl(e.target.value)
              setErrorMsg(null)
            }}
            disabled={busy}
            autoFocus
          />
        </label>

        {errorMsg && (
          <div className="pm-template-error" role="alert">
            {errorMsg}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default PublishRemoteDialog
