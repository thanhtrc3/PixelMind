import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import {
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Copy,
  CornerDownLeft,
  Eraser,
  OctagonX,
  Plus,
  RotateCcw,
  Search,
  Terminal,
  TerminalSquare,
  X,
} from 'lucide-react'
import type { RunLog, RunState, TerminalSession, TerminalShell } from '@shared/types'
import { api } from '../lib/bridge'
import { parseRunError } from '../lib/errorParser'
import VisualErrorCard from './VisualErrorCard'

interface LogPanelProps {
  logs: RunLog[]
  run?: RunState | null
  projectId?: string
  projectPath?: string
  onClear: () => void
  heading?: string
  installing?: boolean
  onInstall?: () => void
  updatingDb?: boolean
  onDatabaseUpdate?: () => void
  onRetry?: () => void
  onOpenFile?: (file: string) => void
  onToggleCollapse?: () => void
  isCollapsed?: boolean
  onAskAI?: () => void
}

type BottomTab = 'logs' | 'terminal'
type LogStreamFilter = 'all' | 'stderr' | 'system'

interface ClientTerminalTab {
  session: TerminalSession
  exited: boolean
  exitCode?: number
}

interface XTermInstance {
  term: XTerm
  fit: FitAddon
  container: HTMLDivElement | null
}

const SHELL_OPTIONS: Array<{ value: TerminalShell; label: string }> = [
  { value: 'auto', label: 'PowerShell' },
  { value: 'pwsh', label: 'PowerShell 7' },
  { value: 'cmd', label: 'CMD' },
  { value: 'bash', label: 'Git Bash' },
]

const QUICK_COMMANDS = ['git status', 'npm run build', 'npm run typecheck', 'ls']

function readXTermTheme() {
  const isLight =
    typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light'
  if (isLight) {
    return {
      background: '#f8fafc',
      foreground: '#0f172a',
      cursor: '#4f46e5',
      cursorAccent: '#f8fafc',
      selectionBackground: 'rgba(79, 70, 229, 0.2)',
      black: '#1e293b',
      red: '#dc2626',
      green: '#16a34a',
      yellow: '#ca8a04',
      blue: '#2563eb',
      magenta: '#9333ea',
      cyan: '#0891b2',
      white: '#e2e8f0',
      brightBlack: '#64748b',
      brightRed: '#ef4444',
      brightGreen: '#22c55e',
      brightYellow: '#eab308',
      brightBlue: '#3b82f6',
      brightMagenta: '#a855f7',
      brightCyan: '#06b6d4',
      brightWhite: '#ffffff',
    }
  }
  return {
    background: '#0b0f17',
    foreground: '#e2e8f0',
    cursor: '#8b7cf6',
    cursorAccent: '#0b0f17',
    selectionBackground: 'rgba(139, 124, 246, 0.28)',
    black: '#1e293b',
    red: '#f87171',
    green: '#4ade80',
    yellow: '#facc15',
    blue: '#60a5fa',
    magenta: '#c084fc',
    cyan: '#22d3ee',
    white: '#e2e8f0',
    brightBlack: '#64748b',
    brightRed: '#fca5a5',
    brightGreen: '#86efac',
    brightYellow: '#fde047',
    brightBlue: '#93c5fd',
    brightMagenta: '#d8b4fe',
    brightCyan: '#67e8f4',
    brightWhite: '#ffffff',
  }
}

const LogPanel = ({
  logs,
  run,
  projectId,
  projectPath,
  onClear,
  heading,
  installing = false,
  onInstall,
  updatingDb = false,
  onDatabaseUpdate,
  onRetry,
  onOpenFile,
  onToggleCollapse,
  isCollapsed = false,
  onAskAI,
}: LogPanelProps) => {
  const bodyRef = useRef<HTMLDivElement>(null)
  const termStageRef = useRef<HTMLDivElement>(null)

  const [activeTab, setActiveTab] = useState<BottomTab>('logs')
  const [showRawLogs, setShowRawLogs] = useState(false)
  const [logFilter, setLogFilter] = useState<LogStreamFilter>('all')
  const [logQuery, setLogQuery] = useState('')
  const [showLogSearch, setShowLogSearch] = useState(false)

  // Trạng thái nhiều tab Terminal PTY thật
  const [terminals, setTerminals] = useState<ClientTerminalTab[]>([])
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null)
  const [selectedShell, setSelectedShell] = useState<TerminalShell>('auto')
  const [creatingTerminal, setCreatingTerminal] = useState(false)
  const [quickCmd, setQuickCmd] = useState('')
  const [cmdHistory, setCmdHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const xtermsRef = useRef<Map<string, XTermInstance>>(new Map())
  const pendingOutputRef = useRef<Map<string, string[]>>(new Map())
  const terminalIdsRef = useRef<Set<string>>(new Set())
  const autoSpawnedRef = useRef(false)

  const parsedError = useMemo(() => parseRunError(logs, run), [logs, run])

  const filteredLogs = useMemo(() => {
    const q = logQuery.trim().toLowerCase()
    return logs.filter((log) => {
      if (logFilter !== 'all' && log.stream !== logFilter) return false
      if (q && !log.text.toLowerCase().includes(q)) return false
      return true
    })
  }, [logs, logFilter, logQuery])

  useEffect(() => {
    const el = bodyRef.current
    if (el && activeTab === 'logs') el.scrollTop = el.scrollHeight
  }, [filteredLogs, showRawLogs, activeTab])

  // Lắng nghe dữ liệu stdout/stderr và sự kiện thoát từ mọi phiên PTY
  useEffect(() => {
    const unsubData = api.terminal.onData(({ sessionId, data }) => {
      const inst = xtermsRef.current.get(sessionId)
      if (inst) {
        inst.term.write(data)
      } else {
        const queue = pendingOutputRef.current.get(sessionId) ?? []
        queue.push(data)
        pendingOutputRef.current.set(sessionId, queue)
      }
    })

    const unsubExit = api.terminal.onExit(({ sessionId, exitCode }) => {
      const inst = xtermsRef.current.get(sessionId)
      inst?.term.write(`\r\n\x1b[90m[Phiên terminal đã kết thúc · mã thoát ${exitCode}]\x1b[0m\r\n`)
      setTerminals((prev) =>
        prev.map((tab) =>
          tab.session.id === sessionId ? { ...tab, exited: true, exitCode } : tab,
        ),
      )
    })

    return () => {
      unsubData()
      unsubExit()
    }
  }, [])

  // Đồng bộ giao diện sáng/tối cho xterm
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return
    const observer = new MutationObserver(() => {
      const nextTheme = readXTermTheme()
      xtermsRef.current.forEach(({ term }) => {
        term.options.theme = nextTheme
      })
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  // Dọn dẹp toàn bộ phiên PTY do panel này tạo khi unmount
  useEffect(() => {
    return () => {
      const ids = [...terminalIdsRef.current]
      ids.forEach((id) => {
        void api.terminal.kill(id)
      })
      terminalIdsRef.current.clear()
      xtermsRef.current.forEach(({ term }) => term.dispose())
      xtermsRef.current.clear()
      pendingOutputRef.current.clear()
    }
  }, [])

  const fitAndResizeSession = useCallback(
    (sessionId: string) => {
      if (isCollapsed || activeTab !== 'terminal') return
      const inst = xtermsRef.current.get(sessionId)
      if (!inst || !inst.container) return
      if (inst.container.clientWidth < 40 || inst.container.clientHeight < 24) return
      try {
        inst.fit.fit()
        if (inst.term.cols > 0 && inst.term.rows > 0) {
          void api.terminal.resize(sessionId, inst.term.cols, inst.term.rows)
        }
      } catch {
        // Bỏ qua khi panel đang thu gọn
      }
    },
    [activeTab, isCollapsed],
  )

  // Gắn container DOM vào instance xterm của từng tab
  const attachTerminalContainer = useCallback(
    (sessionId: string, el: HTMLDivElement | null) => {
      let inst = xtermsRef.current.get(sessionId)
      if (!el) return

      if (!inst) {
        const term = new XTerm({
          cursorBlink: true,
          cursorStyle: 'bar',
          fontSize: 12,
          lineHeight: 1.38,
          scrollback: 3000,
          fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
          theme: readXTermTheme(),
          allowProposedApi: false,
        })
        const fit = new FitAddon()
        term.loadAddon(fit)

        term.onData((data) => {
          void api.terminal.write(sessionId, data)
        })

        // Hỗ trợ Ctrl+C copy khi đang bôi đen (ngược lại gửi ^C); để xterm tự xử lý Ctrl+V native tránh dán đúp
        term.attachCustomKeyEventHandler((event) => {
          if (event.type !== 'keydown') return true
          const isMod = event.ctrlKey || event.metaKey
          const key = event.key.toLowerCase()

          if (isMod && key === 'c' && term.hasSelection()) {
            event.preventDefault()
            void navigator.clipboard?.writeText(term.getSelection())
            term.clearSelection()
            return false
          }
          if (isMod && event.shiftKey && key === 'c') {
            event.preventDefault()
            if (term.hasSelection()) void navigator.clipboard?.writeText(term.getSelection())
            return false
          }
          if (isMod && event.shiftKey && key === 'v') {
            event.preventDefault()
            void navigator.clipboard?.readText().then((text) => {
              if (text) term.paste(text)
            })
            return false
          }
          return true
        })

        inst = { term, fit, container: el }
        xtermsRef.current.set(sessionId, inst)
        term.open(el)

        const queued = pendingOutputRef.current.get(sessionId)
        if (queued?.length) {
          queued.forEach((chunk) => term.write(chunk))
          pendingOutputRef.current.delete(sessionId)
        }

        window.requestAnimationFrame(() => {
          fitAndResizeSession(sessionId)
          term.focus()
        })
      } else if (inst.container !== el) {
        inst.container = el
        el.innerHTML = ''
        inst.term.open(el)
        window.requestAnimationFrame(() => fitAndResizeSession(sessionId))
      }
    },
    [fitAndResizeSession],
  )

  // Theo dõi thay đổi kích thước vùng Terminal để refit xterm & đồng bộ kích thước PTY
  useEffect(() => {
    const stage = termStageRef.current
    if (!stage || typeof ResizeObserver === 'undefined') return

    const ro = new ResizeObserver(() => {
      if (activeTerminalId) {
        window.requestAnimationFrame(() => fitAndResizeSession(activeTerminalId))
      }
    })
    ro.observe(stage)
    return () => ro.disconnect()
  }, [activeTerminalId, fitAndResizeSession])

  // Refit & focus mỗi khi đổi tab Terminal hoặc mở rộng panel
  useEffect(() => {
    if (activeTab !== 'terminal' || isCollapsed || !activeTerminalId) return
    const timer = window.setTimeout(() => {
      fitAndResizeSession(activeTerminalId)
      xtermsRef.current.get(activeTerminalId)?.term.focus()
    }, 40)
    return () => window.clearTimeout(timer)
  }, [activeTab, isCollapsed, activeTerminalId, fitAndResizeSession])

  const createTerminalSession = useCallback(
    async (shellOverride?: TerminalShell) => {
      if (creatingTerminal) return
      setCreatingTerminal(true)
      try {
        const activeInst = activeTerminalId ? xtermsRef.current.get(activeTerminalId) : undefined
        const cols = activeInst?.term.cols && activeInst.term.cols >= 20 ? activeInst.term.cols : 96
        const rows = activeInst?.term.rows && activeInst.term.rows >= 4 ? activeInst.term.rows : 16
        const session = await api.terminal.create({
          projectId,
          cwd: projectPath,
          shell: shellOverride ?? selectedShell,
          cols,
          rows,
        })
        terminalIdsRef.current.add(session.id)
        setTerminals((prev) => [...prev, { session, exited: false }])
        setActiveTerminalId(session.id)
      } finally {
        setCreatingTerminal(false)
      }
    },
    [activeTerminalId, creatingTerminal, projectId, projectPath, selectedShell],
  )

  // Tự mở Terminal đầu tiên khi người dùng chuyển sang tab Terminal
  useEffect(() => {
    if (activeTab !== 'terminal' || isCollapsed) return
    if (terminals.length === 0 && !autoSpawnedRef.current && !creatingTerminal) {
      autoSpawnedRef.current = true
      void createTerminalSession()
    }
  }, [activeTab, isCollapsed, terminals.length, creatingTerminal, createTerminalSession])

  const closeTerminalSession = useCallback(
    (sessionId: string) => {
      terminalIdsRef.current.delete(sessionId)
      void api.terminal.kill(sessionId)
      const inst = xtermsRef.current.get(sessionId)
      inst?.term.dispose()
      xtermsRef.current.delete(sessionId)
      pendingOutputRef.current.delete(sessionId)

      setTerminals((prev) => {
        const next = prev.filter((item) => item.session.id !== sessionId)
        setActiveTerminalId((cur) => {
          if (cur !== sessionId) return cur
          return next[next.length - 1]?.session.id ?? null
        })
        if (next.length === 0) autoSpawnedRef.current = false
        return next
      })
    },
    [],
  )

  const restartTerminalSession = useCallback(
    async (sessionId: string) => {
      const target = terminals.find((t) => t.session.id === sessionId)
      closeTerminalSession(sessionId)
      autoSpawnedRef.current = true
      await createTerminalSession(
        target?.session.shell.toLowerCase().includes('cmd')
          ? 'cmd'
          : target?.session.shell.toLowerCase().includes('bash')
            ? 'bash'
            : selectedShell,
      )
    },
    [closeTerminalSession, createTerminalSession, selectedShell, terminals],
  )

  const sendCommandToActiveTerminal = useCallback(
    async (raw: string) => {
      const cmd = raw.trim()
      if (!cmd) return
      let targetId = activeTerminalId
      if (!targetId) {
        autoSpawnedRef.current = true
        const session = await api.terminal.create({
          projectId,
          cwd: projectPath,
          shell: selectedShell,
        })
        terminalIdsRef.current.add(session.id)
        setTerminals((prev) => [...prev, { session, exited: false }])
        setActiveTerminalId(session.id)
        targetId = session.id
        window.setTimeout(() => {
          void api.terminal.write(session.id, `${cmd}\r`)
        }, 180)
      } else {
        await api.terminal.write(targetId, `${cmd}\r`)
        xtermsRef.current.get(targetId)?.term.focus()
      }
      setCmdHistory((prev) => [cmd, ...prev.filter((item) => item !== cmd).slice(0, 29)])
      setHistoryIndex(-1)
    },
    [activeTerminalId, projectId, projectPath, selectedShell],
  )

  const activeTabInfo = terminals.find((t) => t.session.id === activeTerminalId) ?? null

  const switchMainTab = (tab: BottomTab) => {
    setActiveTab(tab)
    if (isCollapsed && onToggleCollapse) {
      onToggleCollapse()
    }
  }

  const copyLogsToClipboard = () => {
    const text = filteredLogs.map((item) => item.text).join('')
    if (text) void navigator.clipboard?.writeText(text)
  }

  return (
    <div className="pm-logs" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        className="pm-panel__hd pm-logs__hd"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onDoubleClick={onToggleCollapse}
        title="Nhấp đúp để thu gọn / mở rộng"
      >
        {/* Nhóm chuyển Tab: Nhật ký chạy | Terminal (PTY) */}
        <div className="pm-logs__tabs" onClick={(e) => e.stopPropagation()}>
          <button
            className={`pm-logs__tab ${activeTab === 'logs' ? 'on' : ''}`}
            onClick={() => switchMainTab('logs')}
            title="Xem log tiến trình dev server"
          >
            <Terminal size={12} />
            <span>{heading ?? 'Nhật ký chạy'}</span>
            {logs.length > 0 && <span className="pm-logs__badge">{logs.length}</span>}
            {parsedError && <span className="chip err pm-logs__err-chip">Có lỗi</span>}
          </button>
          <button
            className={`pm-logs__tab ${activeTab === 'terminal' ? 'on' : ''}`}
            onClick={() => switchMainTab('terminal')}
            title="Mở Terminal tương tác thật (PTY)"
          >
            <TerminalSquare size={12} />
            <span>Terminal (PTY)</span>
            {terminals.length > 0 && <span className="pm-logs__badge">{terminals.length}</span>}
          </button>
        </div>

        <span style={{ flex: 1 }} />

        {activeTab === 'logs' ? (
          <div className="pm-logs__tools" onClick={(e) => e.stopPropagation()}>
            {showLogSearch && (
              <div className="pm-logs__search">
                <Search size={11} />
                <input
                  value={logQuery}
                  onChange={(e) => setLogQuery(e.target.value)}
                  placeholder="Lọc log..."
                  aria-label="Tìm trong nhật ký"
                />
                {logQuery && (
                  <button
                    className="pm-logs__search-clr"
                    onClick={() => setLogQuery('')}
                    title="Xoá bộ lọc"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            )}
            <div className="pm-logs__filter-group" role="group" aria-label="Lọc luồng log">
              {(
                [
                  { id: 'all', label: 'Tất cả' },
                  { id: 'stderr', label: 'Lỗi' },
                  { id: 'system', label: 'Hệ thống' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  className={`pm-logs__pill ${logFilter === item.id ? 'on' : ''}`}
                  onClick={() => setLogFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              className={`pm-ibtn ${showLogSearch ? 'on' : ''}`}
              onClick={() => setShowLogSearch((v) => !v)}
              title="Tìm kiếm trong log"
              style={{ width: 22, height: 22 }}
            >
              <Search size={11} />
            </button>
            <button
              className="pm-ibtn"
              onClick={copyLogsToClipboard}
              disabled={filteredLogs.length === 0}
              title="Sao chép nhật ký"
              style={{ width: 22, height: 22 }}
            >
              <Copy size={11} />
            </button>
            <button
              className="pm-ibtn"
              onClick={onClear}
              title="Xoá nhật ký"
              style={{ width: 22, height: 22 }}
            >
              <Eraser size={11} />
            </button>
          </div>
        ) : (
          <div className="pm-logs__tools" onClick={(e) => e.stopPropagation()}>
            <select
              className="pm-logs__shell-select"
              value={selectedShell}
              onChange={(e) => setSelectedShell(e.target.value as TerminalShell)}
              title="Chọn loại Shell khi mở tab mới"
            >
              {SHELL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              className="pm-ibtn"
              onClick={() => void createTerminalSession()}
              disabled={creatingTerminal}
              title="Mở thêm tab Terminal mới"
              style={{ width: 22, height: 22 }}
            >
              <Plus size={12} />
            </button>
            {activeTerminalId && (
              <>
                <button
                  className="pm-ibtn"
                  onClick={() => void api.terminal.write(activeTerminalId, '\x03')}
                  title="Gửi Ctrl+C (ngắt tiến trình đang chạy trong Terminal)"
                  style={{ width: 22, height: 22, color: 'var(--color-error-text)' }}
                >
                  <OctagonX size={11} />
                </button>
                <button
                  className="pm-ibtn"
                  onClick={() => {
                    const inst = xtermsRef.current.get(activeTerminalId)
                    if (inst?.term.hasSelection()) {
                      void navigator.clipboard?.writeText(inst.term.getSelection())
                      inst.term.clearSelection()
                    }
                  }}
                  title="Sao chép vùng đang bôi đen"
                  style={{ width: 22, height: 22 }}
                >
                  <Copy size={11} />
                </button>
                <button
                  className="pm-ibtn"
                  onClick={() => {
                    void navigator.clipboard?.readText().then((txt) => {
                      if (txt) void api.terminal.write(activeTerminalId, txt)
                    })
                  }}
                  title="Dán từ Clipboard vào Terminal"
                  style={{ width: 22, height: 22 }}
                >
                  <ClipboardPaste size={11} />
                </button>
                <button
                  className="pm-ibtn"
                  onClick={() => xtermsRef.current.get(activeTerminalId)?.term.clear()}
                  title="Dọn màn hình Terminal (Clear)"
                  style={{ width: 22, height: 22 }}
                >
                  <Eraser size={11} />
                </button>
                <button
                  className="pm-ibtn"
                  onClick={() => void restartTerminalSession(activeTerminalId)}
                  title="Khởi động lại phiên Terminal này"
                  style={{ width: 22, height: 22 }}
                >
                  <RotateCcw size={11} />
                </button>
              </>
            )}
          </div>
        )}

        {onToggleCollapse && (
          <button
            className="pm-ibtn"
            onClick={(e) => {
              e.stopPropagation()
              onToggleCollapse()
            }}
            title={isCollapsed ? 'Mở rộng bảng dưới' : 'Thu gọn bảng dưới'}
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

      {/* ── Nội dung tab Nhật ký Dev Server ── */}
      {activeTab === 'logs' && (
        <div
          className="pm-logs__content"
          style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        >
          {parsedError && (
            <div style={{ padding: '8px 10px 4px' }}>
              <VisualErrorCard
                error={parsedError}
                installing={installing}
                onInstall={onInstall}
                updatingDb={updatingDb}
                onDatabaseUpdate={onDatabaseUpdate}
                onRetry={onRetry}
                onOpenFile={onOpenFile}
                showRawLogs={showRawLogs}
                onToggleRawLogs={() => setShowRawLogs((v) => !v)}
                rawLogsCount={logs.length}
                onAskAI={onAskAI}
              />
            </div>
          )}

          {(!parsedError || showRawLogs) && (
            <div className="pm-logs__bd" ref={bodyRef} style={{ flex: 1, minHeight: 0 }}>
              {filteredLogs.length === 0 ? (
                <div className="pm-logs__empty">
                  {logs.length === 0
                    ? 'Chưa có nhật ký. Nhấn “Chạy dự án” để bắt đầu hoặc chuyển sang tab Terminal (PTY) để gõ lệnh trực tiếp.'
                    : 'Không có dòng nhật ký nào khớp bộ lọc hiện tại.'}
                </div>
              ) : (
                filteredLogs.map((log, index) => (
                  <span key={`${log.at}-${index}`} className={`pm-logs__line ${log.stream}`}>
                    {log.text}
                  </span>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Nội dung tab Terminal tương tác thật (PTY) ── */}
      <div
        className="pm-term"
        style={{ display: activeTab === 'terminal' ? 'flex' : 'none' }}
      >
        {/* Thanh tab các phiên PTY đang mở */}
        {terminals.length > 0 && (
          <div className="pm-term__bar">
            <div className="pm-term__tablist">
              {terminals.map((tab) => {
                const isActive = tab.session.id === activeTerminalId
                return (
                  <div
                    key={tab.session.id}
                    className={`pm-term__session ${isActive ? 'on' : ''} ${
                      tab.exited ? 'is-exited' : ''
                    }`}
                    onClick={() => setActiveTerminalId(tab.session.id)}
                    title={`${tab.session.shell} · Thư mục: ${tab.session.cwd} · PID: ${
                      tab.session.pid || '—'
                    } (${tab.session.backend.toUpperCase()})`}
                  >
                    <span className={`pm-term__dot ${tab.exited ? 'is-exited' : ''}`} />
                    <span className="pm-term__session-title">{tab.session.title}</span>
                    <span className="pm-term__backend">{tab.session.backend.toUpperCase()}</span>
                    <button
                      className="pm-term__session-close"
                      onClick={(e) => {
                        e.stopPropagation()
                        closeTerminalSession(tab.session.id)
                      }}
                      title="Đóng và tắt phiên Terminal này"
                    >
                      <X size={10} />
                    </button>
                  </div>
                )
              })}
            </div>
            {activeTabInfo && (
              <span className="pm-term__cwd" title={activeTabInfo.session.cwd}>
                {activeTabInfo.session.cwd}
              </span>
            )}
          </div>
        )}

        {/* Sân khấu render xterm.js */}
        <div
          className="pm-term__stage"
          ref={termStageRef}
          onKeyDown={(e) => {
            // Giữ các phím mũi tên / chữ cái / Ctrl+C bên trong xterm, không bị phím tắt ngoài cướp mất
            e.stopPropagation()
          }}
          onContextMenu={(e) => {
            if (!activeTerminalId) return
            e.preventDefault()
            const inst = xtermsRef.current.get(activeTerminalId)
            if (inst?.term.hasSelection()) {
              void navigator.clipboard?.writeText(inst.term.getSelection())
              inst.term.clearSelection()
            } else {
              void navigator.clipboard?.readText().then((txt) => {
                if (txt) void api.terminal.write(activeTerminalId, txt)
              })
            }
          }}
        >
          {terminals.length === 0 ? (
            <div className="pm-term__empty">
              <span>Chưa có phiên Terminal nào đang mở.</span>
              <button
                className="pm-btn primary"
                onClick={() => void createTerminalSession()}
                disabled={creatingTerminal}
              >
                <Plus size={12} /> Mở Terminal mới
              </button>
            </div>
          ) : (
            terminals.map((tab) => (
              <div
                key={tab.session.id}
                className="pm-term__xterm-slot"
                style={{
                  display: tab.session.id === activeTerminalId ? 'block' : 'none',
                }}
                ref={(el) => attachTerminalContainer(tab.session.id, el)}
              />
            ))
          )}
        </div>

        {/* Ô nhập lệnh nhanh + phím tắt lệnh phổ biến (gửi thẳng tới PTY) */}
        <form
          className="pm-term__cmdbar"
          onSubmit={(e) => {
            e.preventDefault()
            const current = quickCmd
            setQuickCmd('')
            void sendCommandToActiveTerminal(current)
          }}
        >
          <span className="pm-term__prompt">&gt;_</span>
          <input
            className="pm-term__cmdinput"
            value={quickCmd}
            onChange={(e) => setQuickCmd(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp' && cmdHistory.length > 0) {
                e.preventDefault()
                const nextIdx = Math.min(cmdHistory.length - 1, historyIndex + 1)
                setHistoryIndex(nextIdx)
                setQuickCmd(cmdHistory[nextIdx] ?? '')
              } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                const nextIdx = historyIndex - 1
                setHistoryIndex(nextIdx)
                setQuickCmd(nextIdx >= 0 ? (cmdHistory[nextIdx] ?? '') : '')
              }
            }}
            placeholder="Nhập lệnh nhanh rồi nhấn Enter (vd: npm run build, git status... hoặc gõ trực tiếp ở trên)"
            aria-label="Ô nhập lệnh nhanh gửi tới Terminal"
          />
          <div className="pm-term__snippets">
            {QUICK_COMMANDS.map((snippet) => (
              <button
                key={snippet}
                type="button"
                className="pm-term__chip"
                onClick={() => void sendCommandToActiveTerminal(snippet)}
                title={`Chạy nhanh: ${snippet}`}
              >
                {snippet}
              </button>
            ))}
          </div>
          <button
            type="submit"
            className="pm-term__send"
            disabled={!quickCmd.trim()}
            title="Gửi lệnh tới Terminal (Enter)"
          >
            <CornerDownLeft size={11} />
            <span>Chạy</span>
          </button>
        </form>
      </div>
    </div>
  )
}

export default LogPanel
