import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  FileCode2,
  Loader2,
  Save,
} from 'lucide-react'
import type { FileContent } from '@shared/types'
import { formatBytes, languageOf } from '../lib/format'
import { api } from '../lib/bridge'

interface FileViewerProps {
  file: FileContent | null
  loading: boolean
  onOpenExternal: (path: string) => void
  onShowInFolder: (path: string) => void
  onShowToast?: (kind: 'ok' | 'err' | 'info', text: string) => void
}

const FileViewer = ({
  file,
  loading,
  onOpenExternal,
  onShowInFolder,
  onShowToast,
}: FileViewerProps) => {
  const [code, setCode] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const guttersRef = useRef<HTMLDivElement>(null)

  // Đồng bộ nội dung khi chuyển sang file khác
  useEffect(() => {
    if (file && !file.binary) {
      setCode(file.text || '')
      setIsDirty(false)
    } else {
      setCode('')
      setIsDirty(false)
    }
  }, [file?.path, file?.text, file?.binary])

  // Tính số dòng để vẽ cột số dòng (line numbers)
  const lineCount = useMemo(() => {
    if (!code) return 1
    let count = 1
    for (let i = 0; i < code.length; i++) {
      if (code[i] === '\n') count++
    }
    return count
  }, [code])

  const lineNumbers = useMemo(() => {
    return Array.from({ length: lineCount }, (_, i) => i + 1)
  }, [lineCount])

  // Đồng bộ vị trí cuộn giữa textarea và cột số dòng
  const handleScroll = () => {
    if (textareaRef.current && guttersRef.current) {
      guttersRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  // Lưu file thật sự xuống đĩa (Ctrl+S)
  const handleSave = async () => {
    if (!file || saving) return
    setSaving(true)
    try {
      await api.fs.write(file.path, code)
      file.text = code // Cập nhật cache của file
      setIsDirty(false)
      onShowToast?.('ok', `Đã lưu tệp ${file.name} xuống đĩa thành công!`)
    } catch (err: any) {
      onShowToast?.('err', `Lỗi khi lưu tệp: ${err?.message || ''}`)
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Phím tắt lưu Ctrl+S hoặc Cmd+S
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault()
      e.stopPropagation()
      void handleSave()
      return
    }

    // Nhấn phím Tab để thụt lề 2 dấu cách thay vì chuyển focus
    if (e.key === 'Tab') {
      e.preventDefault()
      const target = e.currentTarget
      const start = target.selectionStart
      const end = target.selectionEnd
      const nextCode = code.substring(0, start) + '  ' + code.substring(end)
      setCode(nextCode)
      setIsDirty(nextCode !== (file?.text ?? ''))
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2
      }, 0)
    }
  }

  const handleCopy = async () => {
    if (!file) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  if (loading) {
    return (
      <div className="pm-viewer" style={{ display: 'grid', placeItems: 'center' }}>
        <span className="pm-row pm-muted" style={{ gap: 8 }}>
          <Loader2 size={14} className="spin" /> Đang đọc tệp…
        </span>
      </div>
    )
  }

  if (!file) {
    return (
      <div className="pm-viewer" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="pm-empty" style={{ border: 0, background: 'transparent', padding: 32 }}>
          <div className="pm-empty__ico">
            <FileCode2 size={20} />
          </div>
          <h3>Chọn một tệp để sửa</h3>
          <p>Nhấp vào tệp trong cây thư mục bên trái để xem và sửa mã nguồn trực tiếp tại đây.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pm-viewer">
      {/* ── HEADER THANH CÔNG CỤ TỆP ── */}
      <div className="pm-viewer__hd">
        <FileCode2 size={13} style={{ flexShrink: 0 }} />
        <span className="path" title={file.path}>
          {file.path}
        </span>

        {isDirty && (
          <span className="pm-viewer__dirty-badge" title="Tệp đã chỉnh sửa, bấm Ctrl+S để lưu">
            ● Chưa lưu
          </span>
        )}

        <span className="grow" />

        <span>{languageOf(file.ext)}</span>
        <span>·</span>
        <span>{formatBytes(file.size)}</span>

        {/* Nút lưu tệp trực tiếp */}
        {!file.binary && (
          <button
            className={`btn ${isDirty ? 'primary' : 'secondary'}`}
            onClick={() => void handleSave()}
            disabled={saving || !isDirty}
            title="Lưu tệp xuống đĩa (Ctrl+S)"
            style={{ height: 22, fontSize: 11, padding: '0 8px', gap: 4 }}
          >
            <Save size={11} /> {saving ? 'Đang lưu…' : 'Lưu'}
          </button>
        )}

        <button
          className="pm-ibtn"
          onClick={handleCopy}
          title="Sao chép toàn bộ nội dung"
          style={{ width: 24, height: 24 }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>

        <button
          className="pm-ibtn"
          onClick={() => onShowInFolder(file.path)}
          title="Hiện trong thư mục (Explorer)"
          style={{ width: 24, height: 24 }}
        >
          <ExternalLink size={12} />
        </button>

        <button
          className="pm-ibtn"
          onClick={() => onOpenExternal(file.path)}
          title="Mở bằng ứng dụng mặc định"
          style={{ width: 24, height: 24, fontSize: 10 }}
        >
          Mở
        </button>
      </div>

      {/* ── BODY NỘI DUNG TỆP ── */}
      <div className="pm-viewer__body" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
        {file.truncated && (
          <div className="pm-banner" style={{ margin: '8px 14px 4px' }}>
            <AlertTriangle size={13} />
            <span>
              Tệp lớn hơn 1 MB nên chỉ hiển thị phần đầu. Hãy mở bằng trình soạn thảo bên ngoài để xem đầy đủ.
            </span>
          </div>
        )}

        {file.binary ? (
          file.dataUrl ? (
            <div className="pm-viewer__img">
              <img src={file.dataUrl} alt={file.name} />
            </div>
          ) : (
            <div className="pm-hint" style={{ padding: 20 }}>
              Tệp nhị phân ({formatBytes(file.size)}) — không thể hiển thị dạng văn bản.
            </div>
          )
        ) : (
          <div className="pm-editor">
            {/* Cột số thứ tự dòng */}
            <div ref={guttersRef} className="pm-editor__gutters" aria-hidden="true">
              {lineNumbers.map((num) => (
                <div key={num}>{num}</div>
              ))}
            </div>

            {/* Vùng gõ code thật sự */}
            <textarea
              ref={textareaRef}
              className="pm-editor__textarea"
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                setIsDirty(e.target.value !== (file.text ?? ''))
              }}
              onScroll={handleScroll}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              placeholder="Nhập mã nguồn tại đây…"
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default FileViewer
