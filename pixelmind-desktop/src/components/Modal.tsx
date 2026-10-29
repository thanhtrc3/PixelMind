import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  width?: number
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

const Modal = ({ title, subtitle, icon, width, onClose, children, footer }: ModalProps) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="pm-overlay" onMouseDown={onClose} role="presentation">
      <div
        className="pm-modal"
        style={width ? { width: `min(${width}px, 100%)` } : undefined}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="pm-modal__hd">
          {icon}
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="pm-ibtn" onClick={onClose} title="Đóng (Esc)">
            <X size={14} />
          </button>
        </div>
        <div className="pm-modal__bd">{children}</div>
        {footer && <div className="pm-modal__ft">{footer}</div>}
      </div>
    </div>
  )
}

export default Modal
