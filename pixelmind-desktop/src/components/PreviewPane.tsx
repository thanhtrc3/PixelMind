import { useEffect, useState } from 'react'
import {
  ExternalLink,
  Globe2,
  Lightbulb,
  Loader2,
  Play,
  RefreshCw,
  Square,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import type { ParsedError } from '../lib/errorParser'

interface PreviewPaneProps {
  url: string | null
  running: boolean
  projectName?: string
  error?: ParsedError | null
  installing?: boolean
  onRun: () => void
  onStop: () => void
  onOpenExternal: (url: string) => void
  onInstall?: () => void
}

const PreviewPane = ({
  url,
  running,
  projectName,
  error,
  installing = false,
  onRun,
  onStop,
  onOpenExternal,
  onInstall,
}: PreviewPaneProps) => {
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
        ) : error ? (
          /* Giao diện báo lỗi trực quan ngay giữa khung xem trước */
          <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 20 }}>
            <div className="pm-preview-error-card">
              <div className="pm-preview-error-card__ico">
                <TriangleAlert size={28} />
              </div>
              <h3>Không thể khởi động xem trước</h3>
              <div className="pm-preview-error-card__title">{error.title}</div>
              <p className="pm-preview-error-card__desc">{error.summary}</p>
              <div className="pm-preview-error-card__rec">
                <Lightbulb size={13} />
                <span>{error.recommendation}</span>
              </div>
              <div className="pm-row" style={{ marginTop: 14, gap: 10, justifyContent: 'center' }}>
                {error.actionKind === 'install' && onInstall && (
                  <button className="btn primary" onClick={onInstall} disabled={installing}>
                    {installing ? (
                      <>
                        <Loader2 size={13} className="pm-spin" /> Đang cài đặt thư viện...
                      </>
                    ) : (
                      <>
                        <Zap size={13} /> Cài đặt thư viện ngay
                      </>
                    )}
                  </button>
                )}
                <button className="btn" onClick={onRun}>
                  <RefreshCw size={12} /> Thử chạy lại (F5)
                </button>
              </div>
            </div>
          </div>
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
