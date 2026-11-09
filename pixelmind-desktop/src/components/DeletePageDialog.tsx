import { useState } from 'react'
import { AlertTriangle, FileWarning, Trash2 } from 'lucide-react'
import type { ProjectPage } from '@shared/types'
import Modal from './Modal'

interface DeletePageDialogProps {
  page: ProjectPage
  /** Xoá metadata và tuỳ chọn chuyển cả tệp route vào Thùng rác. */
  onConfirm: (options: { deleteFile: boolean }) => void
  onClose: () => void
  busy?: boolean
}

export default function DeletePageDialog({
  page,
  onConfirm,
  onClose,
  busy = false,
}: DeletePageDialogProps) {
  const hasFile = Boolean(page.filePath)
  const [deleteFile, setDeleteFile] = useState(false)

  return (
    <Modal
      title="Xoá trang"
      subtitle={`${page.title} · ${page.route}`}
      icon={<Trash2 size={16} />}
      width={520}
      onClose={onClose}
      footer={
        <>
          <span className="grow" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
            {deleteFile && hasFile
              ? 'Tệp sẽ được chuyển vào Thùng rác của hệ điều hành.'
              : 'Trang sẽ bị xoá khỏi danh sách, tệp trên đĩa được giữ nguyên.'}
          </span>
          <button className="btn" onClick={onClose} disabled={busy}>
            Huỷ
          </button>
          <button
            className="btn danger"
            onClick={() => onConfirm({ deleteFile: deleteFile && hasFile })}
            disabled={busy}
          >
            <Trash2 size={12} /> {busy ? 'Đang xoá…' : 'Xoá trang'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', padding: '2px 2px 6px' }}>
        <div className="pm-note" style={{ margin: 0 }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, color: 'var(--color-error-text)' }} />
          <span>
            Bạn có chắc muốn xoá trang <b>{page.title}</b> khỏi dự án? Hành động này không thể hoàn tác.
          </span>
        </div>

        {hasFile ? (
          <div className="pm-setting" style={{ paddingTop: 4 }}>
            <div className="pm-setting__txt">
              <b>Xoá cả tệp route trên đĩa</b>
              <span className="mono" style={{ fontSize: 11 }}>
                {page.filePath}
              </span>
              <span>Tệp sẽ được chuyển vào Thùng rác, không xoá vĩnh viễn.</span>
            </div>
            <div className="pm-setting__ctrl">
              <button
                type="button"
                className={`pm-switch ${deleteFile ? 'on' : ''}`}
                onClick={() => setDeleteFile((value) => !value)}
                aria-label="Xoá cả tệp route trên đĩa"
              />
            </div>
          </div>
        ) : (
          <div className="pm-note" style={{ margin: 0 }}>
            <FileWarning size={14} style={{ flexShrink: 0 }} />
            <span>Trang này chỉ có metadata, không gắn với tệp route nào trên đĩa.</span>
          </div>
        )}
      </div>
    </Modal>
  )
}
