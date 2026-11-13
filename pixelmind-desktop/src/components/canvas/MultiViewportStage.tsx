import React, { useState } from 'react'
import {
  Smartphone,
  Tablet,
  Monitor,
  Maximize2,
  RotateCw,
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
}) => {
  const [frameReloadTokens, setFrameReloadTokens] = useState<Record<string, number>>({
    mobile: 0,
    tablet: 0,
    desktop: 0,
  })

  const handleReloadSingleFrame = (e: React.MouseEvent, frameKey: 'mobile' | 'tablet' | 'desktop') => {
    e.stopPropagation()
    setFrameReloadTokens((prev) => ({
      ...prev,
      [frameKey]: (prev[frameKey] || 0) + 1,
    }))
  }

  return (
    <div className="canvas__multi-viewport-container" onClick={(e) => e.stopPropagation()}>
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
                    ref={isActive ? primaryIframeRef : undefined}
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
  )
}

