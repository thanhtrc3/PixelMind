import {
  ChevronDown,
  ChevronUp,
  FileCode2,
  Lightbulb,
  Loader2,
  RefreshCw,
  Terminal,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import type { ParsedError } from '../lib/errorParser'

interface VisualErrorCardProps {
  error: ParsedError
  installing?: boolean
  onInstall?: () => void
  onRetry?: () => void
  onOpenFile?: (file: string) => void
  showRawLogs?: boolean
  onToggleRawLogs?: () => void
  rawLogsCount?: number
}

const errorBadgeLabel = (type: ParsedError['type']) => {
  switch (type) {
    case 'missing_package':
      return 'Thiếu gói thư viện'
    case 'port_in_use':
      return 'Trùng cổng mạng'
    case 'electron_cache_lock':
      return 'Xung đột tiến trình'
    case 'command_not_found':
      return 'Thiếu công cụ'
    case 'missing_script':
      return 'Sai lệnh chạy'
    case 'typescript_error':
      return 'Lỗi kiểu TypeScript'
    case 'syntax_error':
      return 'Lỗi cú pháp'
    case 'build_error':
      return 'Lỗi biên dịch'
    default:
      return 'Lỗi tiến trình'
  }
}

const VisualErrorCard = ({
  error,
  installing = false,
  onInstall,
  onRetry,
  onOpenFile,
  showRawLogs = false,
  onToggleRawLogs,
  rawLogsCount = 0,
}: VisualErrorCardProps) => {
  return (
    <div className="pm-visual-error">
      <div className="pm-visual-error__hd">
        <div className="pm-visual-error__ico">
          <TriangleAlert size={18} />
        </div>
        <div className="pm-visual-error__title-wrap">
          <div className="pm-row" style={{ gap: 8 }}>
            <h3>{error.title}</h3>
            <span className="chip err" style={{ fontSize: 10 }}>
              {errorBadgeLabel(error.type)}
            </span>
          </div>
          {error.file && (
            <p className="pm-visual-error__sub">
              Tệp: <code>{error.file}</code>
              {error.line ? ` (dòng ${error.line}${error.column ? `:${error.column}` : ''})` : ''}
            </p>
          )}
        </div>
      </div>

      <div className="pm-visual-error__bd">
        <p className="pm-visual-error__summary">{error.summary}</p>

        <div className="pm-visual-error__rec">
          <Lightbulb size={14} />
          <div>
            <b>Đề xuất xử lý:</b> {error.recommendation}
          </div>
        </div>

        <div className="pm-visual-error__actions">
          {error.actionKind === 'install' && onInstall && (
            <button className="btn primary sm" onClick={onInstall} disabled={installing}>
              {installing ? (
                <>
                  <Loader2 size={12} className="pm-spin" /> Đang cài đặt thư viện...
                </>
              ) : (
                <>
                  <Zap size={12} /> {error.actionLabel || 'Cài đặt thư viện ngay'}
                </>
              )}
            </button>
          )}

          {error.actionKind === 'retry' && onRetry && (
            <button className="btn primary sm" onClick={onRetry}>
              <RefreshCw size={12} /> {error.actionLabel || 'Thử chạy lại'}
            </button>
          )}

          {error.actionKind === 'open_file' && error.file && onOpenFile && (
            <button className="btn sm" onClick={() => onOpenFile(error.file!)}>
              <FileCode2 size={12} /> {error.actionLabel || `Mở tệp ${error.file}`}
            </button>
          )}

          {onToggleRawLogs && (
            <button
              className="btn sm ghost"
              onClick={onToggleRawLogs}
              title="Xem thông báo kỹ thuật đầy đủ từ Terminal"
              style={{ marginLeft: 'auto' }}
            >
              <Terminal size={11} />
              <span>{showRawLogs ? 'Thu gọn log kỹ thuật' : `Xem log kỹ thuật (${rawLogsCount} dòng)`}</span>
              {showRawLogs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default VisualErrorCard

