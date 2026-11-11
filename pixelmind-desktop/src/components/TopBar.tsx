import { useState, useEffect } from 'react'
import {
  ClipboardList,
  ExternalLink,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
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
  /** URL giao diện đang chạy để nút Xem trước mở bằng trình duyệt ngoài. */
  canvasUrl?: string | null
  onOpenPreview?: (url: string) => void
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
  canvasUrl,
  onOpenPreview,
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

        {/* Nút Tải lại: cây tệp + giao diện Canvas */}
        <button
          className="pm-ibtn"
          onClick={() => {
            onRefresh()
            window.dispatchEvent(new CustomEvent('pixelmind:reload-canvas'))
          }}
          disabled={!project}
          title="Tải lại dự án & giao diện Canvas (Ctrl+R)"
        >
          <RefreshCw size={13} />
        </button>

        {/* Nút Xem trước: chỉ hiện khi giao diện đang chạy và có URL */}
        {view === 'workspace' && canvasUrl && (
          <button
            className="pm-ibtn"
            onClick={() => onOpenPreview?.(canvasUrl)}
            disabled={!onOpenPreview}
            title={`Xem trước trên trình duyệt ngoài\n${canvasUrl}`}
          >
            <ExternalLink size={14} />
          </button>
        )}

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
