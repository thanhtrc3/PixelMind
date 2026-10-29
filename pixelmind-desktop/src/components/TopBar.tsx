import {
  BookOpen,
  Command,
  ExternalLink,
  FolderOpen,
  FolderSearch,
  Play,
  RefreshCw,
  Settings as SettingsIcon,
  Square,
} from 'lucide-react'
import type { ProjectRecord, RunState } from '@shared/types'
import { shortPath } from '../lib/format'

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
  onOpenPreview: () => void
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
  onOpenPreview,
}: TopBarProps) => {
  const running = run?.status === 'running' || run?.status === 'starting'

  return (
    <header className="pm-topbar">
      <div className="pm-brand">
        <div className="pm-brand__mark">
          <FolderSearch size={14} strokeWidth={2.4} />
        </div>
        <div className="pm-brand__name">
          Pixel<span>Mind</span>
        </div>
      </div>

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

      <div className="pm-topbar__spacer" />

      {project && (
        <>
          {running && run?.url && (
            <button className="pm-urlpill" onClick={onOpenPreview} title="Mở bản xem trước">
              <ExternalLink size={11} />
              <span>{run.url.replace(/^https?:\/\//, '')}</span>
            </button>
          )}
          {running ? (
            <button className="pm-runbtn stop" onClick={onStop} title="Dừng tiến trình (Shift+F5)">
              <Square size={11} fill="currentColor" />
              Dừng
            </button>
          ) : (
            <button className="pm-runbtn" onClick={onRun} title="Chạy dự án (F5)">
              <Play size={11} fill="currentColor" />
              Chạy
            </button>
          )}
        </>
      )}

      <div className="pm-topbar__group">
        <button
          className="pm-ibtn"
          onClick={onRefresh}
          disabled={!project}
          title="Tải lại cây tệp (Ctrl+R)"
        >
          <RefreshCw size={14} />
        </button>
        <button className="pm-ibtn" onClick={onPalette} title="Bảng lệnh (Ctrl+K)">
          <Command size={14} />
        </button>
        <button className="pm-ibtn" onClick={onGuide} title="Hướng dẫn (F1)">
          <BookOpen size={14} />
        </button>
        <button className="pm-ibtn" onClick={onSettings} title="Cài đặt (Ctrl+,)">
          <SettingsIcon size={14} />
        </button>
      </div>
    </header>
  )
}

export default TopBar
