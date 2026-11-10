import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Check,
  ChevronDown,
  ClipboardList,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  Octagon,
  Palette,
  Play,
  Redo2,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
  Sparkles,
  Square,
  Undo2,
} from 'lucide-react'
import type { ProjectRecord, RunState } from '@shared/types'
import type { AiBridgeKind, AiBridgeStatus } from '@shared/ai'
import { api } from '../lib/bridge'
import { editorBuffer } from '../lib/editorBuffer'
import AtomLogo from './AtomLogo'
import { PanelLeftIcon, PanelBottomIcon, PanelRightIcon } from './PanelIcons'

interface TopBarProps {
  project: ProjectRecord | null
  run: RunState | null
  home?: string
  view: 'projects' | 'detail' | 'workspace'
  onViewChange: (view: 'projects' | 'detail' | 'workspace') => void
  onOpenFolder: () => void
  onRun: () => void
  onStop: () => void
  onSettings: () => void
  onGuide: () => void
  onPalette: () => void
  onRefresh: () => void
  onTokens?: () => void
  isSidebarOpen?: boolean
  onToggleSidebar?: () => void
  isBottomPanelOpen?: boolean
  onToggleBottomPanel?: () => void
  isRightPanelOpen?: boolean
  onToggleRightPanel?: () => void
  aiOpen?: boolean
  onToggleAI?: () => void
}

const TopBar = ({
  project,
  run,
  view,
  onViewChange,
  onOpenFolder,
  onRun,
  onStop,
  onSettings,
  onGuide,
  onPalette,
  onRefresh,
  onTokens,
  isSidebarOpen,
  onToggleSidebar,
  isBottomPanelOpen,
  onToggleBottomPanel,
  isRightPanelOpen,
  onToggleRightPanel,
  aiOpen,
  onToggleAI,
}: TopBarProps) => {
  const [canUndo, setCanUndo] = useState(editorBuffer.canUndo())
  const [canRedo, setCanRedo] = useState(editorBuffer.canRedo())
  const [isDirty, setIsDirty] = useState(editorBuffer.isDirty())
  const [undoTitle, setUndoTitle] = useState(editorBuffer.getUndoDescription())
  const [redoTitle, setRedoTitle] = useState(editorBuffer.getRedoDescription())
  const [isSaving, setIsSaving] = useState(false)
  const [activeBridge, setActiveBridge] = useState<AiBridgeKind>('api')
  const [bridges, setBridges] = useState<AiBridgeStatus[]>([])
  const [bridgeOpen, setBridgeOpen] = useState(false)
  const bridgeBtnRef = useRef<HTMLButtonElement>(null)
  const [killSwitchFeedback, setKillSwitchFeedback] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const refreshBridges = async () => {
      try {
        const [active, list] = await Promise.all([
          api.ai.bridges.getActive(),
          api.ai.bridges.list(project?.path),
        ])
        if (!cancelled) {
          setActiveBridge(active)
          setBridges(list)
        }
      } catch {}
    }
    void refreshBridges()
    const timer = setInterval(() => void refreshBridges(), 15000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [project?.path])

  const handleSelectBridge = async (kind: AiBridgeKind) => {
    setActiveBridge(kind)
    setBridgeOpen(false)
    try {
      const updated = await api.ai.bridges.setActive(kind)
      setBridges((prev) => prev.map((b) => (b.kind === kind ? updated : b)))
    } catch {}
  }

  const handleKillSwitch = async () => {
    try {
      const res = await api.ai.killSwitch()
      setKillSwitchFeedback(`Đã dừng ${res.count} tiến trình`)
      setTimeout(() => setKillSwitchFeedback(null), 3000)
    } catch {
      setKillSwitchFeedback('Lỗi dừng')
      setTimeout(() => setKillSwitchFeedback(null), 3000)
    }
  }

  const currentBridgeInfo = bridges.find((b) => b.kind === activeBridge) || {
    kind: activeBridge,
    name: activeBridge === 'ide' ? 'IDE WebSocket' : activeBridge === 'cli' ? 'CLI Bridge' : 'API Bridge',
    status: 'offline' as const,
    detail: '',
  }

  useEffect(() => {
    return editorBuffer.subscribe(() => {
      setCanUndo(editorBuffer.canUndo())
      setCanRedo(editorBuffer.canRedo())
      setIsDirty(editorBuffer.isDirty())
      setUndoTitle(editorBuffer.getUndoDescription())
      setRedoTitle(editorBuffer.getRedoDescription())
    })
  }, [])

  // Auto-save dirty buffer before running (VS2022 Model)
  const handleRun = async () => {
    if (editorBuffer.isDirty()) {
      setIsSaving(true)
      await editorBuffer.saveAllDirtyFiles()
      setIsSaving(false)
    }
    onRun()
  }

  const running = run?.status === 'running' || run?.status === 'starting'

  return (
    <header className="pm-topbar">
      {/* ── Dự án đang mở (Thu gọn dạng Chip tinh tế, không chèn full path) ── */}
      {project ? (
        <button
          className="pm-project-pill"
          onClick={() => onViewChange('projects')}
          title={`Dự án: ${project.name}\nĐường dẫn: ${project.path}\nBấm để chuyển về danh sách dự án`}
        >
          <AtomLogo size={13} className="pm-project-pill__icon" />
          <b className="pm-project-pill__name">{project.name}</b>
        </button>
      ) : (
        <button className="pm-project-pill" onClick={onOpenFolder} title="Mở thư mục dự án (Ctrl+O)">
          <AtomLogo size={13} className="pm-project-pill__icon" style={{ opacity: 0.7 }} />
          <span>Mở dự án…</span>
        </button>
      )}

      {/* ── Bộ chuyển View (Dự án / Chi tiết / Làm việc) tích hợp lên TopBar ── */}
      <div className="pm-view-switcher">
        <button
          className={`pm-view-btn ${view === 'projects' ? 'active' : ''}`}
          onClick={() => onViewChange('projects')}
          title="Danh sách dự án (Ctrl+Shift+O)"
        >
          <FolderKanban size={13} />
          <span>Dự án</span>
        </button>
        {project && (
          <>
            <button
              className={`pm-view-btn ${view === 'detail' ? 'active' : ''}`}
              onClick={() => onViewChange('detail')}
              title="Màn hình thông tin dự án"
            >
              <ClipboardList size={13} />
              <span>Chi tiết</span>
            </button>
            <button
              className={`pm-view-btn ${view === 'workspace' ? 'active' : ''}`}
              onClick={() => onViewChange('workspace')}
              title="Màn hình làm việc (Ctrl+Shift+W)"
            >
              <LayoutDashboard size={13} />
              <span>Làm việc</span>
            </button>
          </>
        )}
      </div>

      {/* ── Thao tác Undo / Redo / Lưu đệm RAM ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
        <button
          className={`pm-ibtn ${canUndo ? '' : 'disabled'}`}
          onClick={() => editorBuffer.undo()}
          disabled={!canUndo}
          title={undoTitle}
          style={{ opacity: canUndo ? 1 : 0.35, cursor: canUndo ? 'pointer' : 'not-allowed' }}
        >
          <Undo2 size={14} />
        </button>
        <button
          className={`pm-ibtn ${canRedo ? '' : 'disabled'}`}
          onClick={() => editorBuffer.redo()}
          disabled={!canRedo}
          title={redoTitle}
          style={{ opacity: canRedo ? 1 : 0.35, cursor: canRedo ? 'pointer' : 'not-allowed' }}
        >
          <Redo2 size={14} />
        </button>

        {/* Nút Save (Ctrl+S) khi có buffer thay đổi chưa lưu (VS2022 Model) */}
        {isDirty && (
          <button
            className="pm-ibtn"
            onClick={async () => {
              setIsSaving(true)
              await editorBuffer.saveAllDirtyFiles()
              setIsSaving(false)
            }}
            disabled={isSaving}
            title="Lưu tất cả thay đổi vào tệp mã nguồn thật (Ctrl+S)"
            style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid #10b981',
              color: '#34d399',
              fontWeight: 700,
              padding: '0 8px',
              width: 'auto',
              gap: 5,
              fontSize: 11,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <Save size={12} />
            <span>Lưu (Ctrl+S)*</span>
          </button>
        )}

        {/* Nút trạng thái máy chủ [⏹ Đang chạy] hoặc [▶ Run] */}
        {running ? (
          <button
            className="pm-topbar__run-status running"
            onClick={onStop}
            title="Dừng tiến trình máy chủ (Shift+F5)"
          >
            <Square size={11} fill="currentColor" />
            <span>Đang chạy</span>
          </button>
        ) : (
          <button
            className="pm-topbar__run-status idle"
            onClick={handleRun}
            disabled={!project}
            title="Khởi động máy chủ phát triển (F5)"
          >
            <Play size={11} fill="currentColor" />
            <span>Run</span>
          </button>
        )}

        {/* Bảng lệnh nổi bật (Ctrl+K) */}
        <button className="pm-topbar__palette" onClick={onPalette} title="Mở bảng lệnh (Ctrl+K)">
          <span className="pm-topbar__palette-text">Bảng lệnh (Ctrl+K)…</span>
          <span className="pm-topbar__palette-keys">
            <kbd>Ctrl</kbd>
            <kbd>K</kbd>
          </span>
        </button>
      </div>

      <div className="pm-topbar__spacer" />

      {/* ── Cụm nút bên phải ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        {/* Bộ chọn Bridge AI (1-click đổi Bridge: API, IDE WebSocket, CLI, Ollama) */}
        <div style={{ position: 'relative' }}>
          <button
            ref={bridgeBtnRef}
            className={`pm-topbar__bridge-pill is-${currentBridgeInfo.status}`}
            onClick={() => setBridgeOpen((v) => !v)}
            title={`Cầu nối AI: ${currentBridgeInfo.name} (${currentBridgeInfo.status.toUpperCase()})`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 26,
              padding: '0 8px',
              fontSize: 11,
              fontWeight: 500,
              background: 'var(--surface, #1e1e24)',
              border: '1px solid var(--line, #333)',
              borderRadius: 6,
              cursor: 'pointer',
              color: 'var(--fg, #e2e8f0)',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background:
                  currentBridgeInfo.status === 'online'
                    ? '#22c55e'
                    : currentBridgeInfo.status === 'local'
                      ? '#3b82f6'
                      : '#ef4444',
                boxShadow:
                  currentBridgeInfo.status === 'online' ? '0 0 6px #22c55e' : 'none',
              }}
            />
            <span>{currentBridgeInfo.name}</span>
            <ChevronDown size={11} style={{ opacity: 0.6 }} />
          </button>

          {bridgeOpen && (() => {
            const rect = bridgeBtnRef.current?.getBoundingClientRect()
            return createPortal(
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 99998 }}
                  onClick={() => setBridgeOpen(false)}
                />
                <div
                  className="pm-topbar__dropdown"
                  style={{
                    position: 'fixed',
                    top: (rect?.bottom ?? 30) + 4,
                    right: Math.max(10, window.innerWidth - (rect?.right ?? window.innerWidth)),
                    minWidth: 230,
                    zIndex: 99999,
                  }}
                >
                  <div className="pm-topbar__dropdown-title">
                    <span>Cầu nối Agent (Chặng 5)</span>
                  </div>
                  {bridges.map((b) => (
                    <button
                      key={b.kind}
                      className={`pm-topbar__dropdown-item ${activeBridge === b.kind ? 'active' : ''}`}
                      onClick={() => void handleSelectBridge(b.kind)}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          marginRight: 8,
                          background:
                            b.status === 'online'
                              ? '#22c55e'
                              : b.status === 'local'
                                ? '#3b82f6'
                                : '#ef4444',
                          boxShadow: b.status === 'online' ? '0 0 6px #22c55e' : 'none',
                        }}
                      />
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, fontSize: 11 }}>{b.name}</div>
                        <div style={{ fontSize: 9.5, opacity: 0.6 }}>{b.detail}</div>
                      </div>
                      {activeBridge === b.kind && <Check size={12} style={{ color: '#22c55e' }} />}
                    </button>
                  ))}
                </div>
              </>,
              document.body,
            )
          })()}
        </div>

        {/* Nút Dừng khẩn cấp AI (Kill-Switch toàn cục) */}
        <button
          className="pm-ibtn"
          onClick={() => void handleKillSwitch()}
          title="Dừng khẩn cấp toàn bộ AI & tiến trình con (Kill-switch)"
          style={{
            color: '#ef4444',
            position: 'relative',
          }}
        >
          <Octagon size={13} strokeWidth={2.2} />
          {killSwitchFeedback && (
            <span
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                whiteSpace: 'nowrap',
                fontSize: 10,
                background: '#ef4444',
                color: '#fff',
                padding: '2px 6px',
                borderRadius: 4,
                zIndex: 1001,
              }}
            >
              {killSwitchFeedback}
            </span>
          )}
        </button>

        {/* Nút Trợ lý AI */}
        {project && onToggleAI && (
          <button
            className={`pm-ibtn ${aiOpen ? 'on' : ''}`}
            onClick={onToggleAI}
            title="Trợ lý AI (Ctrl+Shift+A)"
          >
            <Sparkles size={14} />
          </button>
        )}

        {/* Nút Design Tokens */}
        {project && onTokens && (
          <button
            className="pm-ibtn"
            onClick={onTokens}
            title="Hệ thống thiết kế (Design Tokens)"
          >
            <Palette size={14} />
          </button>
        )}

        {/* Nút Tải lại cây tệp */}
        <button
          className="pm-ibtn"
          onClick={onRefresh}
          disabled={!project}
          title="Tải lại cây tệp (Ctrl+R)"
        >
          <RefreshCw size={13} />
        </button>

        {/* Nút Help (F1) */}
        <button className="pm-ibtn" onClick={onGuide} title="Hướng dẫn sử dụng (F1)">
          <HelpCircle size={14} />
        </button>

        {/* Nút Cài đặt (Ctrl+,) */}
        <button className="pm-ibtn" onClick={onSettings} title="Cài đặt (Ctrl+,)">
          <SettingsIcon size={14} />
        </button>

        {/* ── Cụm 3 nút Điều khiển Bố cục (Layout Controls: Trái, Dưới, Phải - Chuẩn VS Code) ── */}
        {view === 'workspace' && (
          <>
            <div className="pm-topbar-divider" />
            <div className="pm-layout-controls" role="group" aria-label="Điều khiển bố cục khung nhìn">
              <button
                className={`pm-layout-btn ${isSidebarOpen ? 'active' : ''}`}
                onClick={onToggleSidebar}
                title={isSidebarOpen ? 'Thu gọn thanh bên trái (Ctrl+B)' : 'Mở thanh bên trái (Ctrl+B)'}
              >
                <PanelLeftIcon active={isSidebarOpen} size={14} />
              </button>

              <button
                className={`pm-layout-btn ${isBottomPanelOpen ? 'active' : ''}`}
                onClick={onToggleBottomPanel}
                title={isBottomPanelOpen ? 'Thu gọn bảng nhật ký dưới (Ctrl+J)' : 'Mở bảng nhật ký dưới (Ctrl+J)'}
              >
                <PanelBottomIcon active={isBottomPanelOpen} size={14} />
              </button>

              <button
                className={`pm-layout-btn ${isRightPanelOpen ? 'active' : ''}`}
                onClick={onToggleRightPanel}
                title={isRightPanelOpen ? 'Thu gọn thanh điều khiển phải' : 'Mở thanh điều khiển phải'}
              >
                <PanelRightIcon active={isRightPanelOpen} size={14} />
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}

export default TopBar
