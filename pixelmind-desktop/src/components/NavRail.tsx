import { BookOpen, ClipboardList, FolderKanban, FolderOpen, LayoutDashboard, Settings as SettingsIcon } from 'lucide-react'

interface NavRailProps {
  view: 'projects' | 'detail' | 'workspace'
  hasProject: boolean
  onProjects: () => void
  onDetail: () => void
  onWorkspace: () => void
  onOpenFolder: () => void
  onSettings: () => void
  onGuide: () => void
}

const NavRail = ({
  view,
  hasProject,
  onProjects,
  onDetail,
  onWorkspace,
  onOpenFolder,
  onSettings,
  onGuide,
}: NavRailProps) => (
  <nav className="pm-rail" aria-label="Điều hướng chính">
    <button
      className={`pm-rail__btn ${view === 'projects' ? 'on' : ''}`}
      onClick={onProjects}
      title="Danh sách dự án"
    >
      <FolderKanban size={17} />
    </button>
    <button
      className={`pm-rail__btn ${view === 'detail' ? 'on' : ''}`}
      onClick={onDetail}
      title="Màn hình dự án"
      disabled={!hasProject}
    >
      <ClipboardList size={17} />
    </button>
    <button
      className={`pm-rail__btn ${view === 'workspace' ? 'on' : ''}`}
      onClick={onWorkspace}
      title="Màn hình làm việc"
      disabled={!hasProject}
    >
      <LayoutDashboard size={17} />
    </button>

    <div className="pm-rail__sep" />

    <button className="pm-rail__btn" onClick={onOpenFolder} title="Mở thư mục (Ctrl+O)">
      <FolderOpen size={17} />
    </button>

    <div className="pm-rail__grow" />

    <button className="pm-rail__btn" onClick={onGuide} title="Hướng dẫn (F1)">
      <BookOpen size={17} />
    </button>
    <button className="pm-rail__btn" onClick={onSettings} title="Cài đặt (Ctrl+,)">
      <SettingsIcon size={17} />
    </button>
  </nav>
)

export default NavRail
