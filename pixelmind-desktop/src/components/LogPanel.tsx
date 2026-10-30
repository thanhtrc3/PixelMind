import { useEffect, useMemo, useRef, useState } from 'react'
import { Eraser, Terminal } from 'lucide-react'
import type { RunLog, RunState } from '@shared/types'
import { parseRunError } from '../lib/errorParser'
import VisualErrorCard from './VisualErrorCard'

interface LogPanelProps {
  logs: RunLog[]
  run?: RunState | null
  onClear: () => void
  heading?: string
  installing?: boolean
  onInstall?: () => void
  onRetry?: () => void
  onOpenFile?: (file: string) => void
}

const LogPanel = ({
  logs,
  run,
  onClear,
  heading,
  installing = false,
  onInstall,
  onRetry,
  onOpenFile,
}: LogPanelProps) => {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [showRawLogs, setShowRawLogs] = useState(false)

  const parsedError = useMemo(() => parseRunError(logs, run), [logs, run])

  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logs, showRawLogs])

  return (
    <div className="pm-logs" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="pm-panel__hd">
        <Terminal size={12} />
        <b>{heading ?? 'Nhật ký chạy'}</b>
        <span className="pm-muted" style={{ fontSize: 10.5 }}>
          {logs.length ? `${logs.length} dòng` : ''}
        </span>
        {parsedError && (
          <span className="chip err" style={{ fontSize: 9.5, marginLeft: 4 }}>
            Có lỗi
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button className="pm-ibtn" onClick={onClear} title="Xoá nhật ký" style={{ width: 24, height: 24 }}>
          <Eraser size={12} />
        </button>
      </div>

      <div className="pm-logs__content" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Khung báo lỗi trực quan nếu có lỗi */}
        {parsedError && (
          <div style={{ padding: '8px 10px 4px' }}>
            <VisualErrorCard
              error={parsedError}
              installing={installing}
              onInstall={onInstall}
              onRetry={onRetry}
              onOpenFile={onOpenFile}
              showRawLogs={showRawLogs}
              onToggleRawLogs={() => setShowRawLogs((v) => !v)}
              rawLogsCount={logs.length}
            />
          </div>
        )}

        {/* Bảng dòng log kỹ thuật: Hiển thị nếu không có lỗi hoặc người dùng bấm Xem log kỹ thuật */}
        {(!parsedError || showRawLogs) && (
          <div className="pm-logs__bd" ref={bodyRef} style={{ flex: 1, minHeight: 0 }}>
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
        )}
      </div>
    </div>
  )
}

export default LogPanel
