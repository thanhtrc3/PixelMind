import { useEffect, useRef } from 'react'
import { Eraser, Terminal } from 'lucide-react'
import type { RunLog } from '@shared/types'

interface LogPanelProps {
  logs: RunLog[]
  onClear: () => void
  heading?: string
}

const LogPanel = ({ logs, onClear, heading }: LogPanelProps) => {
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logs])

  return (
    <div className="pm-logs" style={{ height: '100%' }}>
      <div className="pm-panel__hd">
        <Terminal size={12} />
        <b>{heading ?? 'Nhật ký chạy'}</b>
        <span className="pm-muted" style={{ fontSize: 10.5 }}>
          {logs.length ? `${logs.length} dòng` : ''}
        </span>
        <span style={{ flex: 1 }} />
        <button className="pm-ibtn" onClick={onClear} title="Xoá nhật ký" style={{ width: 24, height: 24 }}>
          <Eraser size={12} />
        </button>
      </div>
      <div className="pm-logs__bd" ref={bodyRef}>
        {logs.length === 0 ? (
          <div className="pm-logs__empty">
            Chưa có nhật ký. Nhấn “Chạy dự án” để bắt đầu và theo dõi đầu ra của tiến trình tại đây.
          </div>
        ) : (
          logs.map((log, index) => (
            <span key={`${log.at}-${index}`} className={`pm-logs__line ${log.stream}`}>
              {log.text}
            </span>
          ))
        )}
      </div>
    </div>
  )
}

export default LogPanel
