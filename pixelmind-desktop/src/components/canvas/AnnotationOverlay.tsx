import React, { useState, useEffect, useRef } from 'react'
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
import { calculateRelativePosition } from '../../../shared/annotation'

export interface AnnotationOverlayProps {
  annotations: AnnotationPin[]
  isAnnotateMode: boolean
  showResolved: boolean
  activePinId: string | null
  onSelectPin: (id: string | null) => void
  onCreatePin: (coords: { xPercent: number; yPercent: number }) => void
  onUpdatePin: (id: string, content: string) => void
  onToggleResolve: (id: string, resolved: boolean) => void
  onDeletePin: (id: string) => void
  containerRef: React.RefObject<HTMLDivElement | null>
}

export const AnnotationOverlay: React.FC<AnnotationOverlayProps> = ({
  annotations,
  isAnnotateMode,
  showResolved,
  activePinId,
  onSelectPin,
  onCreatePin,
  onUpdatePin,
  onToggleResolve,
  onDeletePin,
  containerRef,
}) => {
  const [editingContent, setEditingContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  const activePin = annotations.find((p) => p.id === activePinId)

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

  // Lọc danh sách ghim cần hiển thị
  const visiblePins = annotations.filter((p) => (showResolved ? true : !p.resolved))

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
    onCreatePin(coords)
  }

  const handleSaveContent = () => {
    if (!activePin) return
    const trimmed = editingContent.trim()
    if (!trimmed) {
      // Nếu xóa rỗng nội dung thì có thể xóa ghim hoặc giữ nguyên
      return
    }
    onUpdatePin(activePin.id, trimmed)
    setIsEditing(false)
  }

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString)
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString('vi-VN')
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

        return (
          <div
            key={pin.id}
            className={`pm-annotation-pin ${isActive ? 'active' : ''} ${isResolved ? 'resolved' : ''}`}
            style={{
              left: `${pin.xPercent}%`,
              top: `${pin.yPercent}%`,
              pointerEvents: 'auto',
            }}
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
            left: `${activePin.xPercent}%`,
            top: `${activePin.yPercent}%`,
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
