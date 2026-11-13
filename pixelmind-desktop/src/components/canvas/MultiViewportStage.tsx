import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Smartphone,
  Tablet,
  Monitor,
  Maximize2,
  RotateCw,
  Link2,
  Unlink,
  ArrowUp,
} from 'lucide-react'
import type { ViewportKey } from '../CanvasArea'

export interface MultiViewportStageProps {
  safeCanvasUrl: string
  projectName: string
  running: boolean
  isServerReady: boolean
  globalIframeKey: number
  activeFrame: 'mobile' | 'tablet' | 'desktop'
  onSelectActiveFrame: (frame: 'mobile' | 'tablet' | 'desktop') => void
  onFocusSingle: (vpKey: ViewportKey) => void
  primaryIframeRef: React.RefObject<HTMLIFrameElement | null>
  renderPrimaryOverlays?: () => React.ReactNode
  onUrlChange?: (url: string, pathname: string) => void
}

interface FrameSpec {
  key: 'mobile' | 'tablet' | 'desktop'
  label: string
  w: number
  h: number
  icon: typeof Smartphone
}

const FRAME_SPECS: FrameSpec[] = [
  { key: 'mobile', label: 'Mobile', w: 375, h: 812, icon: Smartphone },
  { key: 'tablet', label: 'Tablet', w: 768, h: 1024, icon: Tablet },
  { key: 'desktop', label: 'Desktop', w: 1440, h: 900, icon: Monitor },
]

export const MultiViewportStage: React.FC<MultiViewportStageProps> = ({
  safeCanvasUrl,
  projectName,
  running,
  isServerReady,
  globalIframeKey,
  activeFrame,
  onSelectActiveFrame,
  onFocusSingle,
  primaryIframeRef,
  renderPrimaryOverlays,
  onUrlChange,
}) => {
  const [frameReloadTokens, setFrameReloadTokens] = useState<Record<string, number>>({
    mobile: 0,
    tablet: 0,
    desktop: 0,
  })

  // D2-10: Cờ bật/tắt đồng bộ cuộn
  const [syncScrollEnabled, setSyncScrollEnabled] = useState(true)

  // Lưu trữ tham chiếu riêng cho cả 3 iframe
  const iframeRefs = useRef<Record<'mobile' | 'tablet' | 'desktop', HTMLIFrameElement | null>>({
    mobile: null,
    tablet: null,
    desktop: null,
  })

  // D2-10: Cờ khóa chống vòng lặp sự kiện cuộn (Event Loop Prevention Guard)
  const isSyncingScrollRef = useRef(false)

  // ─── ĐỒNG BỘ CUỘN THEO TỶ LỆ PHẦN TRĂM (PROPORTIONAL SCROLL SYNC) ───
  const syncScrollFrom = useCallback(
    (sourceKey: 'mobile' | 'tablet' | 'desktop') => {
      if (!syncScrollEnabled || isSyncingScrollRef.current) return

      const sourceIframe = iframeRefs.current[sourceKey]
      const sourceWin = sourceIframe?.contentWindow
      const sourceDoc = sourceIframe?.contentDocument
      if (!sourceWin || !sourceDoc) return

      const sourceDocEl = sourceDoc.documentElement || sourceDoc.body
      if (!sourceDocEl) return

      const maxScrollY = sourceDocEl.scrollHeight - sourceWin.innerHeight
      const maxScrollX = sourceDocEl.scrollWidth - sourceWin.innerWidth

      const ratioY = maxScrollY > 0 ? Math.max(0, Math.min(1, sourceWin.scrollY / maxScrollY)) : 0
      const ratioX = maxScrollX > 0 ? Math.max(0, Math.min(1, sourceWin.scrollX / maxScrollX)) : 0

      // Khóa cờ trước khi gửi lệnh cuộn sang các iframe khác để ngăn phản hồi ngược
      isSyncingScrollRef.current = true

      for (const [key, targetIframe] of Object.entries(iframeRefs.current)) {
        if (key !== sourceKey && targetIframe?.contentWindow && targetIframe?.contentDocument) {
          try {
            const targetWin = targetIframe.contentWindow
            const targetDoc = targetIframe.contentDocument
            const targetDocEl = targetDoc.documentElement || targetDoc.body
            if (!targetDocEl) continue

            const targetMaxY = targetDocEl.scrollHeight - targetWin.innerHeight
            const targetMaxX = targetDocEl.scrollWidth - targetWin.innerWidth

            const targetY = targetMaxY > 0 ? Math.round(ratioY * targetMaxY) : 0
            const targetX = targetMaxX > 0 ? Math.round(ratioX * targetMaxX) : 0

            targetWin.scrollTo({ top: targetY, left: targetX, behavior: 'instant' })
          } catch {
            // Bỏ qua lỗi truy cập DOM nếu có
          }
        }
      }

      // Mở lại cờ sau chu kỳ render tiếp theo
      requestAnimationFrame(() => {
        isSyncingScrollRef.current = false
      })
    },
    [syncScrollEnabled]
  )

  // ─── GẮN SỰ KIỆN CUỘN CHO TỪNG IFRAME ───
  const attachScrollListeners = useCallback(
    (key: 'mobile' | 'tablet' | 'desktop') => {
      const iframe = iframeRefs.current[key]
      if (!iframe) return

      try {
        const win = iframe.contentWindow
        const doc = iframe.contentDocument
        if (!win || !doc) return

        const handleScroll = () => {
          syncScrollFrom(key)
        }

        win.removeEventListener('scroll', handleScroll)
        doc.removeEventListener('scroll', handleScroll)
        win.addEventListener('scroll', handleScroll, { passive: true })
        doc.addEventListener('scroll', handleScroll, { passive: true })
      } catch { }
    },
    [syncScrollFrom]
  )

  // Gắn lại sự kiện cuộn khi iframe render
  useEffect(() => {
    FRAME_SPECS.forEach((spec) => {
      attachScrollListeners(spec.key)
    })
  }, [attachScrollListeners, running, safeCanvasUrl, globalIframeKey, frameReloadTokens])

  // ─── D2-10: ĐỒNG BỘ ROUTE GIỮA CÁC IFRAME ───
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'PM_LOCATION_CHANGE') {
        const { pathname, href } = e.data.payload || {}
        if (!pathname) return

        // Đồng bộ chuyển trang sang các iframe còn lại nếu khác pathname
        for (const targetIframe of Object.values(iframeRefs.current)) {
          try {
            const targetWin = targetIframe?.contentWindow
            if (targetWin && targetWin.location.pathname !== pathname) {
              targetWin.location.assign(href || pathname)
            }
          } catch { }
        }

        if (href && onUrlChange) {
          onUrlChange(href, pathname)
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [onUrlChange])

  // ─── CÁC THAO TÁC TIỆN ÍCH TRÊN THANH CÔNG CỤ MULTI ───
  const handleReloadSingleFrame = (e: React.MouseEvent, frameKey: 'mobile' | 'tablet' | 'desktop') => {
    e.stopPropagation()
    setFrameReloadTokens((prev) => ({
      ...prev,
      [frameKey]: (prev[frameKey] || 0) + 1,
    }))
  }

  const handleReloadAllFrames = () => {
    setFrameReloadTokens((prev) => ({
      mobile: prev.mobile + 1,
      tablet: prev.tablet + 1,
      desktop: prev.desktop + 1,
    }))
  }

  const handleScrollAllToTop = () => {
    isSyncingScrollRef.current = true
    for (const iframe of Object.values(iframeRefs.current)) {
      try {
        iframe?.contentWindow?.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
      } catch { }
    }
    setTimeout(() => {
      isSyncingScrollRef.current = false
    }, 400)
  }

  return (
    <div className="canvas__multi-viewport-container" onClick={(e) => e.stopPropagation()}>
      {/* ─── THANH ĐIỀU KHIỂN MULTI-VIEWPORT (D2-10: Đồng bộ Route & Scroll) ─── */}
      <div className="canvas__multi-controls-bar">
        <div className="canvas__multi-controls-left">
          {/* Status Badge: Route Sync */}
          <div className="canvas__multi-status-pill">
            <span className="dot green" />
            <Link2 size={12} />
            <span>Đồng bộ Route: <b>Bật</b></span>
          </div>

          {/* Toggle Button: Scroll Sync */}
          <button
            type="button"
            className={`canvas__multi-control-btn ${syncScrollEnabled ? 'is-active' : ''}`}
            onClick={() => setSyncScrollEnabled((v) => !v)}
            title={
              syncScrollEnabled
                ? 'Đang bật đồng bộ cuộn theo tỷ lệ (Nhấp để tắt)'
                : 'Đang tắt đồng bộ cuộn (Nhấp để bật)'
            }
          >
            {syncScrollEnabled ? <Link2 size={12} /> : <Unlink size={12} />}
            <span>Đồng bộ cuộn ({syncScrollEnabled ? 'Bật' : 'Tắt'})</span>
          </button>
        </div>

        <div className="canvas__multi-controls-right">
          {/* Nút: Cuộn tất cả lên đầu trang */}
          <button
            type="button"
            className="canvas__multi-control-btn"
            onClick={handleScrollAllToTop}
            title="Cuộn cả 3 khung nhìn về đầu trang"
          >
            <ArrowUp size={12} />
            <span>Về đầu trang</span>
          </button>

          {/* Nút: Tải lại cả 3 khung */}
          <button
            type="button"
            className="canvas__multi-control-btn"
            onClick={handleReloadAllFrames}
            title="Tải lại cả 3 khung nhìn"
          >
            <RotateCw size={12} />
            <span>Tải lại tất cả</span>
          </button>
        </div>
      </div>

      {/* ─── HÀNG 3 KHUNG NHÌN NẰM NGANG ─── */}
      <div className="canvas__multi-frames-row">
        {FRAME_SPECS.map((spec) => {
          const isActive = activeFrame === spec.key
          const FrameIcon = spec.icon
          const localKey = `${spec.key}-${globalIframeKey}-${frameReloadTokens[spec.key] || 0}`

          return (
            <div
              key={spec.key}
              className={`canvas__multi-frame-wrap ${isActive ? 'is-active' : ''}`}
              style={{ width: spec.w }}
              onClick={() => onSelectActiveFrame(spec.key)}
            >
              {/* Thanh tiêu đề của từng Frame */}
              <div className="canvas__frame-bar canvas__multi-frame-bar">
                <div className="canvas__frame-dots">
                  <span className="dot red" />
                  <span className="dot yellow" />
                  <span className="dot green" />
                </div>

                <div className="canvas__multi-frame-title">
                  <FrameIcon size={12} className="canvas__multi-frame-icon" />
                  <b>{spec.label}</b>
                </div>

                <span className="canvas__frame-url" title={safeCanvasUrl || 'Chưa khởi động'}>
                  {safeCanvasUrl ? safeCanvasUrl.replace(/^https?:\/\//, '') : 'localhost:Chưa khởi động'}
                </span>

                <span className="canvas__frame-size canvas__multi-frame-size">
                  {spec.w} × {spec.h}
                </span>

                {/* Nút hành động nhanh trên góc phải thanh Frame */}
                <div className="canvas__frame-actions">
                  <button
                    type="button"
                    className="canvas__frame-action-btn"
                    title={`Tải lại khung ${spec.label}`}
                    onClick={(e) => handleReloadSingleFrame(e, spec.key)}
                  >
                    <RotateCw size={11} />
                  </button>
                  <button
                    type="button"
                    className="canvas__frame-action-btn"
                    title={`Phóng to toàn khung nhìn ${spec.label}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onFocusSingle(spec.key)
                    }}
                  >
                    <Maximize2 size={11} />
                  </button>
                </div>
              </div>

              {/* Nội dung Artboard / Iframe */}
              <div
                className={`canvas__frame-content canvas__multi-frame-content ${
                  spec.key === 'mobile' ? 'canvas__frame--mobile-round' : ''
                }`}
                style={{
                  width: spec.w,
                  height: spec.h,
                  position: 'relative',
                  overflow: 'hidden',
                  background: '#ffffff',
                }}
              >
                {running && safeCanvasUrl && isServerReady ? (
                  <>
                    <iframe
                      ref={(el) => {
                        iframeRefs.current[spec.key] = el
                        if (isActive && primaryIframeRef) {
                          ;(primaryIframeRef as React.MutableRefObject<HTMLIFrameElement | null>).current = el
                        }
                      }}
                      key={localKey}
                      src={safeCanvasUrl}
                      className="canvas__iframe"
                      title={`${projectName} - ${spec.label}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        border: 0,
                        display: 'block',
                      }}
                      onLoad={() => attachScrollListeners(spec.key)}
                    />
                    {/* Nếu là khung Active thì render các lớp overlay chọn/soi/smart guides */}
                    {isActive && renderPrimaryOverlays && renderPrimaryOverlays()}
                  </>
                ) : (
                  <div
                    className="canvas__frame-fallback"
                    style={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-3)',
                      fontSize: 12,
                      gap: 8,
                      background: '#0b0c10',
                    }}
                  >
                    <FrameIcon size={24} style={{ opacity: 0.5 }} />
                    <span>{running ? 'Đang đợi dev server...' : 'Dev server chưa chạy'}</span>
                    <span style={{ fontSize: 11, opacity: 0.6 }}>{spec.w} × {spec.h}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
