import { useState, useEffect } from 'react'
import {
  FolderOpen,
  FolderSearch,
  HelpCircle,
  Play,
  Redo2,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
  Square,
  Undo2,
} from 'lucide-react'
import type { ProjectRecord, RunState } from '@shared/types'
import { shortPath } from '../lib/format'
import { editorBuffer } from '../lib/editorBuffer'

interface TopBarProps {
  project: ProjectRecord | null
  run: RunState | null
  home?: string
  onOpenFolder: () => void
  onRun: () => void
  onStop: () => void
  onProjects: () => void
  onSettings: () => void
  onGuide: () => void
  onPalette: () => void
  onRefresh: () => void
  onOpenPreview?: () => void
}



const TopBar = ({
  project,
  run,
  home,
  onOpenFolder,
  onRun,
  onStop,
  onProjects,
  onSettings,
  onGuide,
  onPalette,
  onRefresh,
  onOpenPreview: _onOpenPreview,
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
      {/* ── Thương hiệu PixelMind ── */}
      <div className="pm-brand">
        <div className="pm-brand__mark">
          <FolderSearch size={14} strokeWidth={2.4} />
        </div>
        <div className="pm-brand__name">
          Pixel<span>Mind</span>
        </div>
      </div>

      {/* ── Thư mục / Dự án đang mở ── */}
      {project ? (
        <button className="pm-crumb" onClick={onProjects} title="Quay lại màn hình dự án">
          <FolderOpen size={13} />
          <b>{project.name}</b>
          <span>{shortPath(project.path, home)}</span>
        </button>
      ) : (
        <button className="pm-crumb" onClick={onOpenFolder} title="Mở một thư mục dự án (Ctrl+O)">
          <FolderOpen size={13} />
          <b>Mở thư mục dự án</b>
        </button>
      )}

      {/* ── CỤM NÚT BÊN TRÁI THEO ẢNH 2 ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 6 }}>
        {/* Undo / Redo */}
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

        {/* Nút trạng thái máy chủ [⏹ Đang chạy] hoặc [▶ Run] (Ảnh 2) */}
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

      {/* ── CỤM NÚT BÊN PHẢI THEO ẢNH 2 ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
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
      </div>
    </header>
  )
}

export default TopBar
