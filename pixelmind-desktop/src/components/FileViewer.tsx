import { useMemo } from 'react'
import { AlertTriangle, Check, Copy, ExternalLink, FileCode2, Loader2 } from 'lucide-react'
import { useState } from 'react'
import type { FileContent } from '@shared/types'
import { formatBytes, languageOf } from '../lib/format'

interface FileViewerProps {
  file: FileContent | null
  loading: boolean
  onOpenExternal: (path: string) => void
  onShowInFolder: (path: string) => void
}

const MAX_RENDERED_LINES = 6000

const FileViewer = ({ file, loading, onOpenExternal, onShowInFolder }: FileViewerProps) => {
  const [copied, setCopied] = useState(false)

  const lines = useMemo(() => {
    if (!file || file.binary) return []
    return file.text.split(/\r?\n/).slice(0, MAX_RENDERED_LINES)
  }, [file])

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
          <h3>Chọn một tệp để xem</h3>
          <p>Nhấn vào tệp trong cây thư mục bên trái để xem nội dung ngay tại đây.</p>
        </div>
      </div>
    )
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(file.text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="pm-viewer">
      <div className="pm-viewer__hd">
        <FileCode2 size={12} />
        <span className="path" title={file.path}>
          {file.path}
        </span>
        <span className="grow" />
        <span>{languageOf(file.ext)}</span>
        <span>·</span>
        <span>{formatBytes(file.size)}</span>
        <button className="pm-ibtn" onClick={copy} title="Sao chép nội dung" style={{ width: 24, height: 24 }}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
        <button
          className="pm-ibtn"
          onClick={() => onShowInFolder(file.path)}
          title="Hiện trong thư mục"
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

      <div className="pm-viewer__body">
        {file.truncated && (
          <div className="pm-banner" style={{ margin: '0 14px 12px' }}>
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
          <div className="pm-code">
            {lines.map((line, index) => (
              <div key={index} style={{ display: 'contents' }}>
                <div className="pm-code__ln">{index + 1}</div>
                <div className="pm-code__line">{line || ' '}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default FileViewer
