import { useCallback, useRef, useState } from 'react'
import { ChevronsLeftRight, X } from 'lucide-react'

export interface CanvasSplitSliderProps {
  imageSrc: string
  imageName?: string
  splitPosition: number
  onSplitChange: (pos: number) => void
  onClose?: () => void
  /** Chiều cao khung preview */
  height?: number | string
}

export const CanvasSplitSlider = ({
  imageSrc,
  imageName = 'Ảnh thiết kế',
  splitPosition,
  onSplitChange,
  onClose,
}: CanvasSplitSliderProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)

      const updatePos = (clientX: number) => {
        if (!containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        if (rect.width <= 0) return
        const x = clientX - rect.left
        const percent = Math.max(0, Math.min(100, (x / rect.width) * 100))
        onSplitChange(Math.round(percent * 10) / 10)
      }

      updatePos(e.clientX)

      const onPointerMove = (moveEvt: PointerEvent) => {
        moveEvt.preventDefault()
        updatePos(moveEvt.clientX)
      }

      const onPointerUp = () => {
        setIsDragging(false)
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        window.removeEventListener('pointercancel', onPointerUp)
      }

      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerUp)
    },
    [onSplitChange],
  )

  // Phím tắt mũi tên trái/phải để vi chỉnh slider khi focus
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onSplitChange(Math.max(0, splitPosition - (e.shiftKey ? 10 : 2)))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        onSplitChange(Math.min(100, splitPosition + (e.shiftKey ? 10 : 2)))
      } else if (e.key === 'Home') {
        e.preventDefault()
        onSplitChange(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        onSplitChange(100)
      }
    },
    [splitPosition, onSplitChange],
  )

  const clampedPos = Math.max(0, Math.min(100, splitPosition))

  return (
    <div
      ref={containerRef}
      className={`pm-split-slider-container ${isDragging ? 'is-dragging' : ''}`}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 38,
        pointerEvents: isDragging ? 'auto' : 'none',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* ── LỚP ẢNH MẪU ĐƯỢC CẮT BẰNG CLIP-PATH ── */}
      <div
        className="pm-split-slider-image-layer"
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: `inset(0 ${100 - clampedPos}% 0 0)`,
          WebkitClipPath: `inset(0 ${100 - clampedPos}% 0 0)`,
          backgroundImage: `url(${imageSrc})`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'top center',
          backgroundColor: 'transparent',
          pointerEvents: 'none',
        }}
      />

      {/* ── NHÃN CHỈ BÁO GÓC (DESIGN vs LIVE) ── */}
      <div
        className="pm-split-label pm-split-label--left"
        title={`Ảnh thiết kế: ${imageName}`}
        style={{
          position: 'absolute',
          top: 10,
          left: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          borderRadius: 6,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(168, 85, 247, 0.4)',
          color: '#e2e8f0',
          fontSize: 10.5,
          fontWeight: 650,
          letterSpacing: '0.02em',
          pointerEvents: 'none',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
          opacity: clampedPos > 12 ? 1 : Math.max(0, clampedPos / 12),
          transition: 'opacity 0.15s ease',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#a855f7',
            boxShadow: '0 0 6px #a855f7',
          }}
        />
        <span>THIẾT KẾ MẪU</span>
        <span style={{ fontSize: 9.5, opacity: 0.65, fontFamily: 'monospace' }}>
          ({Math.round(clampedPos)}%)
        </span>
      </div>

      <div
        className="pm-split-label pm-split-label--right"
        style={{
          position: 'absolute',
          top: 10,
          right: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          borderRadius: 6,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          color: '#e2e8f0',
          fontSize: 10.5,
          fontWeight: 650,
          letterSpacing: '0.02em',
          pointerEvents: 'none',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
          opacity: clampedPos < 88 ? 1 : Math.max(0, (100 - clampedPos) / 12),
          transition: 'opacity 0.15s ease',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#38bdf8',
            boxShadow: '0 0 6px #38bdf8',
          }}
        />
        <span>WEB THỰC TẾ (LIVE)</span>
        <span style={{ fontSize: 9.5, opacity: 0.65, fontFamily: 'monospace' }}>
          ({Math.round(100 - clampedPos)}%)
        </span>
        {onClose && (
          <button
            type="button"
            className="pm-ibtn"
            onClick={onClose}
            title="Đóng chế độ So sánh (Split Slider)"
            style={{
              width: 16,
              height: 16,
              marginLeft: 4,
              padding: 0,
              pointerEvents: 'auto',
              color: 'var(--text-3)',
            }}
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* ── ĐƯỜNG DÓNG CHIA ĐÔI & TAY NẮM SLIDER ── */}
      <div
        className="pm-split-divider"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${clampedPos}%`,
          width: 32,
          marginLeft: -16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'col-resize',
          pointerEvents: 'auto',
          zIndex: 42,
        }}
        onPointerDown={handlePointerDown}
        onDoubleClick={() => onSplitChange(50)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="slider"
        aria-valuenow={clampedPos}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Thanh trượt so sánh Before After"
        title="Kéo sang trái/phải để so sánh · Nhấp đúp để đặt lại 50%"
      >
        {/* Đường thẳng mảnh ở giữa */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 15,
            width: 2,
            background: isDragging
              ? 'linear-gradient(180deg, #a855f7, #6d5df5, #38bdf8)'
              : 'rgba(255, 255, 255, 0.85)',
            boxShadow: isDragging
              ? '0 0 10px rgba(109, 93, 245, 0.9), 0 0 20px rgba(168, 85, 247, 0.6)'
              : '0 0 8px rgba(0, 0, 0, 0.6)',
            transition: 'background 0.2s, box-shadow 0.2s',
          }}
        />

        {/* Tay nắm kéo ở giữa */}
        <div
          className="pm-split-handle"
          style={{
            position: 'relative',
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: isDragging ? '#6d5df5' : '#1e293b',
            border: '2px solid rgba(255, 255, 255, 0.9)',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.5), 0 0 10px rgba(109, 93, 245, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            cursor: 'col-resize',
            transform: isDragging ? 'scale(1.15)' : 'scale(1)',
            transition: 'transform 0.15s ease, background 0.15s ease',
          }}
        >
          <ChevronsLeftRight size={15} />
        </div>

        {/* Badge % vị trí ngay dưới tay nắm khi rê chuột hoặc kéo */}
        <div
          style={{
            position: 'absolute',
            top: 'calc(50% + 24px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.9)',
            padding: '2px 6px',
            borderRadius: 4,
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#f8fafc',
            fontSize: 9.5,
            fontFamily: 'monospace',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
          }}
        >
          {Math.round(clampedPos)}%
        </div>
      </div>
    </div>
  )
}

export default CanvasSplitSlider
