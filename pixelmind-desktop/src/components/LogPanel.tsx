import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Eraser, Terminal } from 'lucide-react'
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
  onToggleCollapse?: () => void
  isCollapsed?: boolean
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
  onToggleCollapse,
  isCollapsed = false,
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
      <div
        className="pm-panel__hd"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onDoubleClick={onToggleCollapse}
        title="Nhấp đúp để thu gọn / mở rộng nhật ký"
      >
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
        <span className="pm-muted" style={{ fontSize: 10, marginRight: 6 }}>
          (Kéo thanh ngang để chỉnh chiều cao)
        </span>
        <button
          className="pm-ibtn"
          onClick={(e) => {
            e.stopPropagation()
            onClear()
          }}
          title="Xoá nhật ký"
          style={{ width: 22, height: 22 }}
        >
          <Eraser size={11} />
        </button>
        {onToggleCollapse && (
          <button
            className="pm-ibtn"
            onClick={(e) => {
              e.stopPropagation()
              onToggleCollapse()
            }}
            title={isCollapsed ? 'Mở rộng nhật ký' : 'Thu gọn nhật ký'}
            style={{
              height: 22,
              padding: '0 6px',
              fontSize: 10.5,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              marginLeft: 4,
              color: isCollapsed ? 'var(--accent, #6d5df5)' : 'inherit',
              fontWeight: isCollapsed ? 600 : 400,
            }}
          >
            {isCollapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
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
