import { useEffect } from 'react'
import { CheckCircle2, Info, XCircle } from 'lucide-react'

export interface ToastMessage {
  id: number
  kind: 'ok' | 'err' | 'info'
  text: string
}

interface ToastStackProps {
  items: ToastMessage[]
  onDismiss: (id: number) => void
}

const ToastStack = ({ items, onDismiss }: ToastStackProps) => (
  <div className="pm-toast-wrap">
    {items.map((item) => (
      <Toast key={item.id} item={item} onDismiss={onDismiss} />
    ))}
  </div>
)

const Toast = ({ item, onDismiss }: { item: ToastMessage; onDismiss: (id: number) => void }) => {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(item.id), 4200)
    return () => window.clearTimeout(timer)
  }, [item.id, onDismiss])

  const Icon = item.kind === 'err' ? XCircle : item.kind === 'info' ? Info : CheckCircle2
  return (
    <div className={`pm-toast ${item.kind}`} role="status" onClick={() => onDismiss(item.id)}>
      <span className="pm-toast__ico">
        <Icon size={12} />
      </span>
      <span className="pm-toast__txt">{item.text}</span>
    </div>
  )
}

export default ToastStack
