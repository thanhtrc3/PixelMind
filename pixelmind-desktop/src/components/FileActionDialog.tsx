import { useState, useMemo, useEffect, useRef } from 'react'
import { FilePlus2, FolderPlus, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import type { FileNode } from '@shared/types'
import { api } from '../lib/bridge'
import Modal from './Modal'

export type FileActionKind = 'new-file' | 'new-folder' | 'rename' | 'delete'

interface FileActionDialogProps {
  action: FileActionKind
  targetNode: FileNode | null
  rootPath: string
  onClose: () => void
  onSuccess: (message: string) => void
  onRefresh: () => void
}

const normalizeSlash = (p: string) => p.replace(/\\/g, '/')

const getParentDir = (path: string) => {
  const clean = normalizeSlash(path)
  const idx = clean.lastIndexOf('/')
  return idx > 0 ? clean.slice(0, idx) : clean
}

export default function FileActionDialog({
  action,
  targetNode,
  rootPath,
  onClose,
  onSuccess,
  onRefresh,
}: FileActionDialogProps) {
  // Xác định thư mục đích khi tạo file/folder mới
  const targetDir = useMemo(() => {
    if (!targetNode) return normalizeSlash(rootPath)
    if (targetNode.type === 'dir') return normalizeSlash(targetNode.path)
    return getParentDir(targetNode.path)
  }, [targetNode, rootPath])

  const relativeTargetDir = useMemo(() => {
    const root = normalizeSlash(rootPath)
    if (targetDir === root) return '/'
    return targetDir.startsWith(root) ? targetDir.slice(root.length) : targetDir
  }, [targetDir, rootPath])

  const [name, setName] = useState(action === 'rename' && targetNode ? targetNode.name : '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (action !== 'delete') {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          if (action === 'rename') {
            // Chọn tên trước phần mở rộng file (nếu là file)
            const dot = name.lastIndexOf('.')
            if (dot > 0 && targetNode?.type === 'file') {
              inputRef.current.setSelectionRange(0, dot)
            } else {
              inputRef.current.select()
            }
          }
        }
      }, 50)
    }
  }, [action])

  const handleSubmit = async () => {
    setError('')
    const trimmed = name.trim()

    if (action !== 'delete') {
      if (!trimmed) {
        setError('Vui lòng nhập tên.')
        return
      }
      if (/[\\/:*?"<>|]/.test(trimmed)) {
        setError('Tên không được chứa các ký tự đặc biệt: \\ / : * ? " < > |')
        return
      }
    }

    setBusy(true)
    try {
      if (action === 'new-file') {
        const fullPath = `${targetDir}/${trimmed}`
        const exists = await api.fs.exists(fullPath)
        if (exists) {
          setError(`Tệp "${trimmed}" đã tồn tại trong thư mục này.`)
          setBusy(false)
          return
        }
        await api.fs.createFile(fullPath, '')
        onSuccess(`Đã tạo tệp "${trimmed}".`)
      } else if (action === 'new-folder') {
        const fullPath = `${targetDir}/${trimmed}`
        const exists = await api.fs.exists(fullPath)
        if (exists) {
          setError(`Thư mục "${trimmed}" đã tồn tại.`)
          setBusy(false)
          return
        }
        await api.fs.createDir(fullPath)
        onSuccess(`Đã tạo thư mục "${trimmed}".`)
      } else if (action === 'rename' && targetNode) {
        const parent = getParentDir(targetNode.path)
        const fullPath = `${parent}/${trimmed}`
        if (fullPath === normalizeSlash(targetNode.path)) {
          onClose()
          return
        }
        const exists = await api.fs.exists(fullPath)
        if (exists) {
          setError(`Đã có tệp hoặc thư mục tên "${trimmed}".`)
          setBusy(false)
          return
        }
        await api.fs.rename(targetNode.path, fullPath)
        onSuccess(`Đã đổi tên thành "${trimmed}".`)
      } else if (action === 'delete' && targetNode) {
        await api.fs.trash(targetNode.path)
        onSuccess(`Đã chuyển "${targetNode.name}" vào Thùng rác.`)
      }

      onRefresh()
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra khi thực hiện.')
    } finally {
      setBusy(false)
    }
  }

  const titles = {
    'new-file': 'Tạo tệp mới',
    'new-folder': 'Tạo thư mục mới',
    rename: targetNode?.type === 'dir' ? 'Đổi tên thư mục' : 'Đổi tên tệp',
    delete: targetNode?.type === 'dir' ? 'Xoá thư mục' : 'Xoá tệp',
  }

  const icons = {
    'new-file': <FilePlus2 size={16} />,
    'new-folder': <FolderPlus size={16} />,
    rename: <Pencil size={16} />,
    delete: <Trash2 size={16} />,
  }

  return (
    <Modal
      title={titles[action]}
      subtitle={
        action === 'delete'
          ? targetNode?.name
          : `Thư mục: ${relativeTargetDir}`
      }
      icon={icons[action]}
      width={460}
      onClose={onClose}
      footer={
        <>
          <span className="grow" style={{ fontSize: 11.5, color: error ? 'var(--color-error-text)' : 'var(--text-3)' }}>
            {error || (action === 'delete' ? 'Tệp sẽ được chuyển vào Thùng rác, có thể phục hồi.' : '')}
          </span>
          <button className="btn" onClick={onClose} disabled={busy}>
            Huỷ
          </button>
          <button
            className={`btn ${action === 'delete' ? 'danger' : 'primary'}`}
            onClick={handleSubmit}
            disabled={busy}
          >
            {action === 'delete' ? (
              <>
                <Trash2 size={12} /> {busy ? 'Đang xoá…' : 'Xoá'}
              </>
            ) : action === 'rename' ? (
              <>
                <Pencil size={12} /> {busy ? 'Đang lưu…' : 'Đổi tên'}
              </>
            ) : (
              <>
                {action === 'new-file' ? <FilePlus2 size={12} /> : <FolderPlus size={12} />}
                {' '}
                {busy ? 'Đang tạo…' : 'Tạo ngay'}
              </>
            )}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void handleSubmit()
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 2px' }}
      >
        {action === 'delete' ? (
          <div className="pm-note" style={{ margin: 0 }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, color: 'var(--color-error-text)' }} />
            <span>
              Bạn có chắc muốn chuyển {targetNode?.type === 'dir' ? 'thư mục' : 'tệp'}{' '}
              <b>{targetNode?.name}</b> vào Thùng rác của hệ điều hành?
            </span>
          </div>
        ) : (
          <div className="pm-field">
            <label htmlFor="file-action-input">
              {action === 'new-file'
                ? 'Tên tệp (kèm phần mở rộng, VD: index.html, style.css, utils.ts)'
                : action === 'new-folder'
                  ? 'Tên thư mục mới'
                  : 'Tên mới'}
            </label>
            <input
              ref={inputRef}
              id="file-action-input"
              className="pm-input mono"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={action === 'new-file' ? 'example.tsx' : 'ten-thu-muc'}
              autoComplete="off"
            />
          </div>
        )}
      </form>
    </Modal>
  )
}
