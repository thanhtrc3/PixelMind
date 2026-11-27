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
    route?: string
  }) => void
  onUpdatePin: (id: string, content: string) => void
  onToggleResolve: (id: string, resolved: boolean) => void
  onDeletePin: (id: string) => void
  containerRef: React.RefObject<HTMLDivElement | null>
  iframeRef?: React.RefObject<HTMLIFrameElement | null>
  stageRef?: React.RefObject<HTMLDivElement | null>
}

/**
 * Tạo CSS selector duy nhất cho phần tử để tìm lại chính xác khi trang tải lại
 */
function getUniqueCssSelector(el: HTMLElement): string {
  if (!el || el.nodeType !== 1) return ''
  if (el.id) return `#${el.id}`
  const parent = el.parentElement
  if (!parent || parent === document.documentElement) return el.tagName.toLowerCase()
  const siblings = Array.prototype.filter.call(parent.children, (c) => c.tagName === el.tagName)
  const index = Array.prototype.indexOf.call(siblings, el) + 1
  const part = `${el.tagName.toLowerCase()}:nth-of-type(${index})`
  const parentSel = getUniqueCssSelector(parent)
  return parentSel ? `${parentSel} > ${part}` : part
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
  stageRef,
}) => {
  const [editingContent, setEditingContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Vị trí thông minh của popover (tự động tránh vật cản: panel terminal bên dưới, viền khung, inspector bên phải...)
  const [popoverPos, setPopoverPos] = useState<{
    left: number
    top: number
    placement: 'top' | 'bottom'
  } | null>(null)

  // Lưu trữ route nội bộ thực tế của iframe (tự đồng bộ khi người dùng click chuyển trang)
  const [iframeRoute, setIframeRoute] = useState<string>(currentRoute || '/')

  useEffect(() => {
    if (currentRoute) {
      setIframeRoute(currentRoute)
    }
  }, [currentRoute])

  // Lưu tọa độ hiển thị thực tế trên màn hình của từng ghim
  const [pinPositions, setPinPositions] = useState<
    Record<string, { left: number; top: number; isVisible: boolean }>
  >({})

  // Lọc danh sách ghim theo route hiện tại và trạng thái đã xử lý
  const visiblePins = useMemo(() => {
    return filterAnnotations(annotations, {
      route: iframeRoute,
      showResolved,
    })
  }, [annotations, iframeRoute, showResolved])

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

    const doc = iframe?.contentDocument || iframe?.contentWindow?.document
    const win = iframe?.contentWindow

    const iframeOffsetLeft = iframe ? iframe.offsetLeft : 0
    const iframeOffsetTop = iframe ? iframe.offsetTop : 0

    const vpWidth = win ? win.innerWidth : (iframe ? iframe.offsetWidth : 10000)
    const vpHeight = win ? win.innerHeight : (iframe ? iframe.offsetHeight : 10000)

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
        // Tọa độ tính tương đối với container overlay (container và iframe cùng toạ độ unscaled)
        const posX = iframeOffsetLeft + r.left + (r.width * (pin.elementOffsetX ?? 50)) / 100
        const posY = iframeOffsetTop + r.top + (r.height * (pin.elementOffsetY ?? 50)) / 100

        // Kiểm tra xem phần tử có nằm trong khung nhìn hiển thị của iframe không
        const isVisible =
          r.bottom > 0 &&
          r.top < vpHeight &&
          r.right > 0 &&
          r.left < vpWidth

        newPositions[pin.id] = {
          left: posX,
          top: posY,
          isVisible,
        }
      } else if (win && typeof pin.documentX === 'number' && typeof pin.documentY === 'number') {
        // Fallback theo tọa độ document trừ đi scroll của iframe
        const posX = iframeOffsetLeft + (pin.documentX - win.scrollX)
        const posY = iframeOffsetTop + (pin.documentY - win.scrollY)
        const isVisible = posY > -40 && posY < vpHeight + 40
        newPositions[pin.id] = {
          left: posX,
          top: posY,
          isVisible,
        }
      } else {
        // Fallback cho ghim cũ theo % container
        const cWidth = container.clientWidth || container.offsetWidth || 1
        const cHeight = container.clientHeight || container.offsetHeight || 1
        newPositions[pin.id] = {
          left: (pin.xPercent / 100) * cWidth,
          top: (pin.yPercent / 100) * cHeight,
          isVisible: true,
        }
      }
    }

    setPinPositions(newPositions)
  }, [visiblePins, iframeRef, containerRef])

  // Tính toán vị trí thông minh của popover (tự động tránh vật cản: panel terminal bên dưới, viền khung, inspector bên phải...)
  const updatePopoverPlacement = useCallback(() => {
    if (!activePin || !containerRef.current) {
      setPopoverPos(null)
      return
    }

    const pinPos = pinPositions[activePin.id] || {
      left: (activePin.xPercent / 100) * (containerRef.current.clientWidth || 800),
      top: (activePin.yPercent / 100) * (containerRef.current.clientHeight || 600),
      isVisible: true,
    }

    const container = containerRef.current
    const containerRect = container.getBoundingClientRect()
    const containerW = container.clientWidth || 800
    const containerH = container.clientHeight || 600

    const popoverEl = popoverRef.current
    const popoverW = popoverEl?.offsetWidth || 290
    const popoverH = popoverEl?.offsetHeight || (isEditing ? 220 : 160)

    // Tỉ lệ scale thực tế giữa màn hình và container (do zoom Canvas)
    const scale = containerRect.width > 0 && containerW > 0 ? containerRect.width / containerW : 1

    // 1. Tìm chướng ngại vật phía dưới trên màn hình (Terminal Panel / Logs, thanh chỉ dẫn đáy, viền stage...)
    let maxSafeScreenBottom = window.innerHeight - 16
    if (stageRef?.current) {
      const stageRect = stageRef.current.getBoundingClientRect()
      if (stageRect.bottom > 100 && stageRect.bottom < maxSafeScreenBottom) {
        maxSafeScreenBottom = stageRect.bottom - 12
      }
    }
    const logPanel = document.querySelector('.pm-logs, [class*="pm-logs"]') as HTMLElement | null
    if (logPanel) {
      const r = logPanel.getBoundingClientRect()
      if (r.top > 80 && r.top < maxSafeScreenBottom) {
        maxSafeScreenBottom = r.top - 8
      }
    }
    const canvasHint = document.querySelector('.canvas__hint') as HTMLElement | null
    if (canvasHint) {
      const r = canvasHint.getBoundingClientRect()
      if (r.top > 80 && r.top < maxSafeScreenBottom) {
        maxSafeScreenBottom = r.top - 6
      }
    }

    // 2. Tìm chướng ngại vật cạnh phải (Inspector Sidebar)
    let maxSafeScreenRight = window.innerWidth - 16
    const inspectorSidebar = document.querySelector('.canvas__inspector-sidebar') as HTMLElement | null
    if (inspectorSidebar) {
      const r = inspectorSidebar.getBoundingClientRect()
      if (r.left > 200 && r.left < maxSafeScreenRight) {
        maxSafeScreenRight = r.left - 8
      }
    }

    // 3. Tìm chướng ngại vật phía trên (Thanh công cụ Toolbar)
    let minSafeScreenTop = 16
    if (stageRef?.current) {
      const stageRect = stageRef.current.getBoundingClientRect()
      if (stageRect.top > minSafeScreenTop && stageRect.top < 250) {
        minSafeScreenTop = stageRect.top + 8
      }
    }

    // Tọa độ màn hình của điểm ghim
    const pinScreenY = containerRect.top + pinPos.top * scale

    // Kiểm tra đặt bên dưới (placement: bottom)
    const candidateTopBelow = pinPos.top + 22
    const screenBottomY = pinScreenY + (22 + popoverH) * scale
    const isBelowBlocked =
      candidateTopBelow + popoverH > containerH - 10 ||
      screenBottomY > maxSafeScreenBottom

    // Kiểm tra đặt bên trên (placement: top)
    const candidateTopAbove = pinPos.top - popoverH - 18
    const screenTopY = pinScreenY - (18 + popoverH) * scale
    const isAboveAvailable =
      candidateTopAbove >= 10 &&
      screenTopY >= minSafeScreenTop

    let finalTop: number
    let placement: 'top' | 'bottom' = 'bottom'

    if (isBelowBlocked && isAboveAvailable) {
      // Phía dưới bị che/tràn (bởi terminal, đáy khung...) -> TỰ ĐỘNG LẬT LÊN TRÊN
      finalTop = candidateTopAbove
      placement = 'top'
    } else if (isBelowBlocked && !isAboveAvailable) {
      // Cả 2 phía đều chật hẹp -> Chọn phía có nhiều không gian hiển thị hơn
      const spaceBelow = Math.min(containerH - pinPos.top, (maxSafeScreenBottom - pinScreenY) / Math.max(0.1, scale))
      const spaceAbove = Math.min(pinPos.top, (pinScreenY - minSafeScreenTop) / Math.max(0.1, scale))
      if (spaceAbove > spaceBelow) {
        finalTop = Math.max(10, candidateTopAbove)
        placement = 'top'
      } else {
        finalTop = Math.max(10, Math.min(containerH - popoverH - 10, candidateTopBelow))
        placement = 'bottom'
      }
    } else {
      // Phía dưới thoáng -> Giữ mặc định ở dưới
      finalTop = candidateTopBelow
      placement = 'bottom'
    }

    // Căn chỉnh trục ngang: tránh tràn qua thanh Inspector bên phải hoặc mép trái
    let candidateLeft = pinPos.left - 20
    const screenRightX = containerRect.left + (candidateLeft + popoverW) * scale

    if (candidateLeft + popoverW > containerW - 16 || screenRightX > maxSafeScreenRight) {
      const maxContainerLeft = containerW - popoverW - 16
      const maxScreenLeft = (maxSafeScreenRight - containerRect.left) / Math.max(0.1, scale) - popoverW
      candidateLeft = Math.min(candidateLeft, maxContainerLeft, maxScreenLeft)
    }

    const minScreenLeft = Math.max(12, (12 - containerRect.left) / Math.max(0.1, scale))
    candidateLeft = Math.max(12, candidateLeft, minScreenLeft)

    setPopoverPos({
      left: Math.round(candidateLeft),
      top: Math.round(finalTop),
      placement,
    })
  }, [activePin, pinPositions, isEditing, containerRef, stageRef])

  // Lắng nghe scroll & resize của iframe để ghim di chuyển theo phần tử mượt mà
  useEffect(() => {
    updatePinPositions()
    updatePopoverPlacement()

    const iframe = iframeRef?.current
    const win = iframe?.contentWindow

    const handleScrollOrResize = () => {
      updatePinPositions()
      updatePopoverPlacement()
    }

    if (win) {
      win.addEventListener('scroll', handleScrollOrResize, { passive: true })
      win.addEventListener('resize', handleScrollOrResize, { passive: true })
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('scroll', handleScrollOrResize, { passive: true })
    }

    window.addEventListener('resize', handleScrollOrResize, { passive: true })

    // Interval theo dõi chuyển trang, layout shift hoặc animation
    const interval = setInterval(() => {
      try {
        const curPath = iframeRef?.current?.contentWindow?.location?.pathname
        if (curPath && curPath !== iframeRoute) {
          setIframeRoute(curPath)
        }
      } catch {}
      updatePinPositions()
      updatePopoverPlacement()
    }, 150)

    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', handleScrollOrResize)
      if (win) {
        win.removeEventListener('scroll', handleScrollOrResize)
        win.removeEventListener('resize', handleScrollOrResize)
      }
      if (container) {
        container.removeEventListener('scroll', handleScrollOrResize)
      }
    }
  }, [updatePinPositions, updatePopoverPlacement, iframeRef, containerRef, iframeRoute])

  // Cập nhật vị trí popover ngay khi activePin hoặc chế độ sửa thay đổi
  useEffect(() => {
    const t = setTimeout(() => {
      updatePopoverPlacement()
    }, 10)
    return () => clearTimeout(t)
  }, [activePinId, isEditing, updatePopoverPlacement])

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
    let pinRoute = iframeRoute || currentRoute || '/'

    const iframe = iframeRef?.current
    if (iframe) {
      const iframeRect = iframe.getBoundingClientRect()
      // Tỷ lệ scale của Canvas zoom (màn hình vs nội bộ iframe)
      const scaleX = iframeRect.width > 0 && iframe.offsetWidth > 0 ? iframe.offsetWidth / iframeRect.width : 1
      const scaleY = iframeRect.height > 0 && iframe.offsetHeight > 0 ? iframe.offsetHeight / iframeRect.height : 1

      // Chuyển tọa độ click chuột thành tọa độ viewport nội bộ của iframe (đã triệt tiêu hệ số Canvas zoom)
      const iframeX = (e.clientX - iframeRect.left) * scaleX
      const iframeY = (e.clientY - iframeRect.top) * scaleY

      const doc = iframe.contentDocument || iframe.contentWindow?.document
      const win = iframe.contentWindow

      if (win && win.location && win.location.pathname) {
        pinRoute = win.location.pathname
      }

      if (doc) {
        const clickedEl = doc.elementFromPoint(iframeX, iframeY) as HTMLElement | null
        if (clickedEl && clickedEl !== doc.body && clickedEl !== doc.documentElement) {
          let uid = clickedEl.getAttribute('data-pm-uid')
          if (!uid) {
            uid = 'pm_' + Math.random().toString(36).slice(2, 9)
            clickedEl.setAttribute('data-pm-uid', uid)
          }
          targetUid = uid
          targetSelector = getUniqueCssSelector(clickedEl)

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
      route: pinRoute,
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
          className={`pm-annotation-popover ${popoverPos?.placement === 'top' ? 'placement-top' : 'placement-bottom'}`}
          style={{
            left: `${
              popoverPos
                ? popoverPos.left
                : pinPositions[activePin.id]
                ? pinPositions[activePin.id].left - 20
                : (activePin.xPercent / 100) * (containerRef.current?.clientWidth || 800)
            }px`,
            top: `${
              popoverPos
                ? popoverPos.top
                : pinPositions[activePin.id]
                ? pinPositions[activePin.id].top + 22
                : (activePin.yPercent / 100) * (containerRef.current?.clientHeight || 600)
            }px`,
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
