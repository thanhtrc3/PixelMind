import { useEffect, useState } from 'react'
import { ExternalLink, Globe2, Play, RefreshCw, Square } from 'lucide-react'

interface PreviewPaneProps {
  url: string | null
  running: boolean
  projectName?: string
  onRun: () => void
  onStop: () => void
  onOpenExternal: (url: string) => void
}

const PreviewPane = ({ url, running, projectName, onRun, onStop, onOpenExternal }: PreviewPaneProps) => {
  const [draft, setDraft] = useState(url ?? '')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (url) setDraft(url)
  }, [url])

  const go = () => {
    const next = draft.trim()
    if (!next) return
    setDraft(next.startsWith('http') ? next : `http://${next}`)
    setReloadKey((k) => k + 1)
  }

  return (
    <div className="pm-preview">
      <div className="pm-preview__bar">
        <Globe2 size={13} className="pm-muted" />
        <input
          className="pm-preview__url"
          value={draft}
          placeholder="Nhập địa chỉ xem trước, ví dụ http://localhost:5173"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') go()
            e.stopPropagation()
          }}
        />
        <button className="pm-ibtn" onClick={go} title="Tải lại khung xem trước" style={{ width: 24, height: 24 }}>
          <RefreshCw size={12} />
        </button>
        <button
          className="pm-ibtn"
          onClick={() => draft && onOpenExternal(draft.startsWith('http') ? draft : `http://${draft}`)}
          title="Mở bằng trình duyệt"
          style={{ width: 24, height: 24 }}
        >
          <ExternalLink size={12} />
        </button>
        {running ? (
          <button className="pm-ibtn" onClick={onStop} title="Dừng" style={{ width: 24, height: 24 }}>
            <Square size={11} />
          </button>
        ) : (
          <button className="pm-ibtn" onClick={onRun} title="Chạy dự án" style={{ width: 24, height: 24 }}>
            <Play size={12} />
          </button>
        )}
      </div>

      <div className="pm-preview__frame">
        {url ? (
          <iframe key={reloadKey} src={draft || url} title="Xem trước dự án" allow="clipboard-read; clipboard-write" />
        ) : (
          <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
            <div className="pm-empty" style={{ border: 0, background: 'transparent' }}>
              <div className="pm-empty__ico">
                <Globe2 size={20} />
              </div>
              <h3>Chưa có bản xem trước</h3>
              <p>
                {projectName
                  ? `Chạy ${projectName} để PixelMind tự phát hiện địa chỉ localhost và hiển thị giao diện ngay tại đây.`
                  : 'Mở một dự án rồi chạy để xem giao diện tại đây.'}
              </p>
              <div className="pm-empty__actions">
                <button className="btn primary" onClick={onRun} disabled={!projectName}>
                  <Play size={13} /> Chạy dự án
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PreviewPane
