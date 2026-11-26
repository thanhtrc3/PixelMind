import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  CheckCircle2,
  Clock,
  Trash2,
  X,
  Edit2,
  Send,
  RotateCcw,
} from 'lucide-react'
import type { AnnotationPin } from '../../../shared/annotation'
import { calculateRelativePosition, filterAnnotations } from '../../../shared/annotation'

export interface AnnotationOverlayProps {
  annotations: AnnotationPin[]
  currentRoute?: string
  isAnnotateMode: boolean
  showResolved: boolean
  activePinId: string | null
  onSelectPin: (id: string | null) => void
  onCreatePin: (data: {
    xPercent: number
    yPercent: number
    targetUid?: string
    targetSelector?: string
    elementOffsetX?: number
    elementOffsetY?: number
    documentX?: number
    documentY?: number
  }) => void
  onUpdatePin: (id: string, content: string) => void
  onToggleResolve: (id: string, resolved: boolean) => void
  onDeletePin: (id: string) => void
  containerRef: React.RefObject<HTMLDivElement | null>
  iframeRef?: React.RefObject<HTMLIFrameElement | null>
}

export const AnnotationOverlay: React.FC<AnnotationOverlayProps> = ({
  annotations,
  currentRoute,
  isAnnotateMode,
  showResolved,
  activePinId,
  onSelectPin,
  onCreatePin,
  onUpdatePin,
  onToggleResolve,
  onDeletePin,
  containerRef,
  iframeRef,
}) => {
  const [editingContent, setEditingContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Lưu tọa độ hiển thị thực tế trên màn hình của từng ghim
  const [pinPositions, setPinPositions] = useState<
    Record<string, { left: number; top: number; isVisible: boolean }>
  >({})

  // Lọc danh sách ghim theo route hiện tại và trạng thái đã xử lý
  const visiblePins = useMemo(() => {
    return filterAnnotations(annotations, {
      route: currentRoute,
      showResolved,
    })
  }, [annotations, currentRoute, showResolved])

  const activePin = visiblePins.find((p) => p.id === activePinId)

  // Đồng bộ nội dung khi đổi activePin
  useEffect(() => {
    if (activePin) {
      setEditingContent(activePin.content)
      setIsEditing(!activePin.content.trim()) // Tự động bật chế độ soạn thảo nếu vừa tạo chưa có nội dung
    } else {
      setIsEditing(false)
      setEditingContent('')
    }
  }, [activePinId, activePin?.content])

  // Cập nhật vị trí ghim bám dính theo phần tử trong iframe hoặc độ cuộn trang
  const updatePinPositions = useCallback(() => {
    const iframe = iframeRef?.current
    const container = containerRef.current
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    const iframeRect = iframe ? iframe.getBoundingClientRect() : containerRect
    const doc = iframe?.contentDocument || iframe?.contentWindow?.document
    const win = iframe?.contentWindow

    const newPositions: Record<string, { left: number; top: number; isVisible: boolean }> = {}

    for (const pin of visiblePins) {
      let targetEl: HTMLElement | null = null
      if (doc && pin.targetUid) {
        targetEl = doc.querySelector(`[data-pm-uid="${pin.targetUid}"]`) as HTMLElement | null
      }
      if (!targetEl && doc && pin.targetSelector) {
        try {
          targetEl = doc.querySelector(pin.targetSelector) as HTMLElement | null
        } catch {}
      }

      if (targetEl) {
        const r = targetEl.getBoundingClientRect()
        // Tọa độ tính tương đối với container overlay
        const posX = iframeRect.left - containerRect.left + r.left + (r.width * (pin.elementOffsetX ?? 50)) / 100
        const posY = iframeRect.top - containerRect.top + r.top + (r.height * (pin.elementOffsetY ?? 50)) / 100

        // Kiểm tra xem phần tử có nằm trong khung nhìn hiển thị của iframe không
        const isVisible =
          r.bottom > 0 &&
          r.top < iframeRect.height &&
          r.right > 0 &&
          r.left < iframeRect.width

        newPositions[pin.id] = {
          left: posX,
          top: posY,
          isVisible,
        }
      } else if (win && typeof pin.documentX === 'number' && typeof pin.documentY === 'number') {
        // Fallback theo tọa độ document trừ đi scroll của iframe
        const posX = iframeRect.left - containerRect.left + (pin.documentX - win.scrollX)
        const posY = iframeRect.top - containerRect.top + (pin.documentY - win.scrollY)
        const isVisible = posY > -40 && posY < containerRect.height + 40
        newPositions[pin.id] = {
          left: posX,
          top: posY,
          isVisible,
        }
      } else {
        // Fallback cho ghim cũ theo % viewport
        newPositions[pin.id] = {
          left: (pin.xPercent / 100) * containerRect.width,
          top: (pin.yPercent / 100) * containerRect.height,
          isVisible: true,
        }
      }
    }

    setPinPositions(newPositions)
  }, [visiblePins, iframeRef, containerRef])

  // Lắng nghe scroll & resize của iframe để ghim di chuyển theo phần tử mượt mà
  useEffect(() => {
    updatePinPositions()

    const iframe = iframeRef?.current
    const win = iframe?.contentWindow

    const handleScrollOrResize = () => {
      updatePinPositions()
    }

    if (win) {
      win.addEventListener('scroll', handleScrollOrResize, { passive: true })
      win.addEventListener('resize', handleScrollOrResize, { passive: true })
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('scroll', handleScrollOrResize, { passive: true })
    }

    // Interval nhẹ theo dõi layout shift hoặc animation
    const interval = setInterval(updatePinPositions, 150)

    return () => {
      clearInterval(interval)
      if (win) {
        win.removeEventListener('scroll', handleScrollOrResize)
        win.removeEventListener('resize', handleScrollOrResize)
      }
      if (container) {
        container.removeEventListener('scroll', handleScrollOrResize)
      }
    }
  }, [updatePinPositions, iframeRef, containerRef])

  // Xử lý click tạo ghim mới khi đang bật chế độ Annotate
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (!isAnnotateMode) return

    // Bỏ qua nếu click vào chính popover hoặc marker
    const target = e.target as HTMLElement
    if (target.closest('.pm-annotation-pin') || target.closest('.pm-annotation-popover')) {
      return
    }

    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const coords = calculateRelativePosition(e.clientX, e.clientY, rect)

    // Xác định phần tử thật trong iframe (để ghim dính chặt vào phần tử)
    let targetUid: string | undefined
    let targetSelector: string | undefined
    let elementOffsetX: number | undefined
    let elementOffsetY: number | undefined
    let documentX: number | undefined
    let documentY: number | undefined

    const iframe = iframeRef?.current
    if (iframe) {
      const iframeRect = iframe.getBoundingClientRect()
      const iframeX = e.clientX - iframeRect.left
      const iframeY = e.clientY - iframeRect.top
      const doc = iframe.contentDocument || iframe.contentWindow?.document
      const win = iframe.contentWindow

      if (doc) {
        const clickedEl = doc.elementFromPoint(iframeX, iframeY) as HTMLElement | null
        if (clickedEl && clickedEl !== doc.body && clickedEl !== doc.documentElement) {
          let uid = clickedEl.getAttribute('data-pm-uid')
          if (!uid) {
            uid = 'pm_' + Math.random().toString(36).slice(2, 9)
            clickedEl.setAttribute('data-pm-uid', uid)
          }
          targetUid = uid
          targetSelector = clickedEl.id
            ? `#${clickedEl.id}`
            : clickedEl.className && typeof clickedEl.className === 'string'
            ? `.${clickedEl.className.trim().split(/\s+/)[0]}`
            : clickedEl.tagName.toLowerCase()

          const elRect = clickedEl.getBoundingClientRect()
          if (elRect.width > 0 && elRect.height > 0) {
            elementOffsetX =
              Math.round((Math.max(0, Math.min(elRect.width, iframeX - elRect.left)) / elRect.width) * 1000) / 10
            elementOffsetY =
              Math.round((Math.max(0, Math.min(elRect.height, iframeY - elRect.top)) / elRect.height) * 1000) / 10
          }
        }

        if (win) {
          documentX = Math.round(iframeX + win.scrollX)
          documentY = Math.round(iframeY + win.scrollY)
        }
      }
    }

    onCreatePin({
      xPercent: coords.xPercent,
      yPercent: coords.yPercent,
      targetUid,
      targetSelector,
      elementOffsetX,
      elementOffsetY,
      documentX,
      documentY,
    })
  }

  const handleSaveContent = () => {
    if (!activePin) return
    const trimmed = editingContent.trim()
    if (!trimmed) {
      return
    }
    onUpdatePin(activePin.id, trimmed)
    setIsEditing(false)
  }

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString)
      return (
        d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
        ' ' +
        d.toLocaleDateString('vi-VN')
      )
    } catch {
      return isoString
    }
  }

  return (
    <div
      className={`pm-annotation-overlay ${isAnnotateMode ? 'annotate-active' : ''}`}
      onClick={handleOverlayClick}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: isAnnotateMode || activePinId ? 'auto' : 'none',
        zIndex: 50,
      }}
    >
      {/* Danh sách các Pin Marker */}
      {visiblePins.map((pin, idx) => {
        const isActive = pin.id === activePinId
        const isResolved = pin.resolved
        const pos = pinPositions[pin.id]

        const stylePos: React.CSSProperties = pos
          ? {
              left: `${pos.left}px`,
              top: `${pos.top}px`,
              opacity: pos.isVisible ? 1 : 0,
              pointerEvents: pos.isVisible ? 'auto' : 'none',
              transition: 'opacity 150ms ease',
            }
          : {
              left: `${pin.xPercent}%`,
              top: `${pin.yPercent}%`,
            }

        return (
          <div
            key={pin.id}
            className={`pm-annotation-pin ${isActive ? 'active' : ''} ${isResolved ? 'resolved' : ''} ${
              pos && !pos.isVisible ? 'is-offscreen' : ''
            }`}
            style={stylePos}
            title={`Ghi chú #${idx + 1}: ${pin.content.slice(0, 40) || '(Trống)'}`}
            onClick={(e) => {
              e.stopPropagation()
              onSelectPin(isActive ? null : pin.id)
            }}
          >
            <div className="pm-annotation-pin-bubble">
              {isResolved ? (
                <CheckCircle2 size={13} strokeWidth={2.5} />
              ) : (
                <span className="pm-annotation-pin-number">{idx + 1}</span>
              )}
            </div>

            {/* Vòng tròn gợn sóng khi active */}
            {isActive && <div className="pm-annotation-pin-pulse" />}
          </div>
        )
      })}

      {/* Popover hiển thị chi tiết ghim đang chọn */}
      {activePin && (
        <div
          ref={popoverRef}
          className="pm-annotation-popover"
          style={{
            left: pinPositions[activePin.id]
              ? `${pinPositions[activePin.id].left}px`
              : `${activePin.xPercent}%`,
            top: pinPositions[activePin.id]
              ? `${pinPositions[activePin.id].top + 8}px`
              : `${activePin.yPercent}%`,
            pointerEvents: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="pm-annotation-popover-hd">
            <div className="pm-annotation-author-row">
              <div className="pm-annotation-avatar">
                {activePin.author ? activePin.author.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="pm-annotation-meta">
                <span className="pm-annotation-author-name">{activePin.author || 'Bạn'}</span>
                <span className="pm-annotation-time">
                  <Clock size={10} />
                  {formatTime(activePin.createdAt)}
                </span>
              </div>
            </div>

            <div className="pm-annotation-actions-top">
              <span className={`pm-annotation-badge ${activePin.resolved ? 'resolved' : 'open'}`}>
                {activePin.resolved ? 'Đã xử lý' : 'Đang mở'}
              </span>
              <button
                className="pm-annotation-close-btn"
                onClick={() => onSelectPin(null)}
                title="Đóng (Esc)"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Body: Nội dung phản hồi */}
          <div className="pm-annotation-popover-body">
            {isEditing ? (
              <div className="pm-annotation-editor">
                <textarea
                  className="pm-annotation-textarea"
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  placeholder="Nhập ghi chú hoặc phản hồi tại đây..."
                  autoFocus
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault()
                      handleSaveContent()
                    } else if (e.key === 'Escape') {
                      setIsEditing(false)
                      setEditingContent(activePin.content)
                    }
                  }}
                />
                <div className="pm-annotation-editor-actions">
                  <button
                    className="pm-annotation-btn secondary"
                    onClick={() => {
                      if (!activePin.content.trim()) {
                        onDeletePin(activePin.id)
                      } else {
                        setIsEditing(false)
                        setEditingContent(activePin.content)
                      }
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    className="pm-annotation-btn primary"
                    onClick={handleSaveContent}
                    disabled={!editingContent.trim()}
                  >
                    <Send size={11} />
                    <span>Lưu ghi chú</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="pm-annotation-content-view">
                <p className="pm-annotation-text">{activePin.content || '(Chưa có nội dung)'}</p>
                <button
                  className="pm-annotation-edit-btn"
                  onClick={() => setIsEditing(true)}
                  title="Sửa ghi chú"
                >
                  <Edit2 size={11} />
                  <span>Sửa</span>
                </button>
              </div>
            )}
          </div>

          {/* Footer: Resolve / Reopen & Delete */}
          <div className="pm-annotation-popover-ft">
            <button
              className={`pm-annotation-btn-text ${activePin.resolved ? 'reopen' : 'resolve'}`}
              onClick={() => onToggleResolve(activePin.id, !activePin.resolved)}
            >
              {activePin.resolved ? (
                <>
                  <RotateCcw size={12} />
                  <span>Mở lại</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={12} />
                  <span>Đánh dấu đã xử lý</span>
                </>
              )}
            </button>

            <button
              className="pm-annotation-btn-text delete"
              onClick={() => {
                onDeletePin(activePin.id)
                onSelectPin(null)
              }}
              title="Xóa ghi chú này"
            >
              <Trash2 size={12} />
              <span>Xóa</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
