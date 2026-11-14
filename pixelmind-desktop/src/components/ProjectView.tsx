import { useMemo, useState } from 'react'
import {
  Clock,
  FileArchive,
  Folder,
  FolderOpen,
  GitFork,
  Play,
  Plus,
  Search,
  Star,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import type { ProjectRecord } from '@shared/types'
import { formatTime, shortPath } from '../lib/format'
import AtomLogo from './AtomLogo'

interface ProjectViewProps {
  projects: ProjectRecord[]
  home?: string
  isDesktop: boolean
  busy: boolean
  onOpen: (project: ProjectRecord) => void
  onOpenFolder: () => void
  onNewProject?: () => void
  onCloneGit?: () => void
  onImportZip?: () => void
  onRemove: (project: ProjectRecord) => void
  onFavorite: (project: ProjectRecord) => void
  onReveal: (project: ProjectRecord) => void
}

const ProjectView = ({
  projects,
  home,
  isDesktop,
  busy,
  onOpen,
  onOpenFolder,
  onNewProject,
  onCloneGit,
  onImportZip,
  onRemove,
  onFavorite,
  onReveal,
}: ProjectViewProps) => {
  const [query, setQuery] = useState('')

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? projects.filter((p) => [p.name, p.path, p.framework].join(' ').toLowerCase().includes(q))
      : projects
    return [...filtered].sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
      return (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0)
    })
  }, [projects, query])

  return (
    <section className="pm-projects">
      <div className="pm-projects__head">
        <div>
          <h1 className="pm-projects__title">Dự án của bạn</h1>
          <p className="pm-projects__sub">
            Mở thư mục mã nguồn để PixelMind đọc cấu trúc, chạy máy chủ phát triển và xem trước giao diện ngay trong
            ứng dụng.
          </p>
        </div>
        <div className="pm-projects__tools">
          <div className="pm-searchbox">
            <Search size={13} />
            <input
              value={query}
              placeholder="Tìm dự án…"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          {onNewProject && (
            <button className="btn primary" onClick={onNewProject} disabled={busy}>
              <Plus size={13} /> Tạo dự án mới
            </button>
          )}
          {onCloneGit && (
            <button
              className="btn"
              onClick={onCloneGit}
              disabled={busy}
              title="Sao chép dự án từ GitHub / Git server về máy"
            >
              <GitFork size={13} /> Clone từ Git
            </button>
          )}
          {onImportZip && (
            <button
              className="btn"
              onClick={onImportZip}
              disabled={busy}
              title="Nhập dự án từ tệp ZIP có sẵn"
            >
              <FileArchive size={13} /> Nhập từ ZIP
            </button>
          )}
          <button className="btn" onClick={onOpenFolder} disabled={busy}>
            <FolderOpen size={13} /> Mở thư mục
          </button>
        </div>
      </div>

      {!isDesktop && (
        <div className="pm-banner">
          <TriangleAlert size={14} style={{ flex: 'none', marginTop: 1 }} />
          <span>
            <b>Đang chạy trong trình duyệt.</b> Mở thư mục, đọc/ghi tệp và chạy tiến trình cần bản desktop. Dữ liệu
            bên dưới là bản xem trước.
          </span>
        </div>
      )}

      {list.length === 0 ? (
        <div className="pm-empty">
          <div className="pm-empty__ico">
            <Folder size={20} />
          </div>
          <h3>{projects.length ? 'Không tìm thấy dự án phù hợp' : 'Chưa có dự án nào'}</h3>
          <p>
            {projects.length
              ? 'Thử từ khoá khác hoặc xoá bộ lọc tìm kiếm.'
              : 'Chọn một thư mục chứa mã nguồn hoặc tạo nhanh dự án mới từ Template.'}
          </p>
          <div className="pm-empty__actions">
            {onNewProject && (
              <button className="btn primary" onClick={onNewProject} disabled={busy}>
                <Plus size={13} /> Khởi tạo từ Template
              </button>
            )}
            {onCloneGit && (
              <button className="btn" onClick={onCloneGit} disabled={busy}>
                <GitFork size={13} /> Clone từ Git
              </button>
            )}
            {onImportZip && (
              <button className="btn" onClick={onImportZip} disabled={busy}>
                <FileArchive size={13} /> Nhập từ ZIP
              </button>
            )}
            <button className="btn" onClick={onOpenFolder} disabled={busy}>
              <FolderOpen size={13} /> Mở thư mục có sẵn
            </button>
          </div>
        </div>
      ) : (
        <div className="pm-grid">
          {list.map((project) => (
            <article key={project.id} className="pm-pcard" onClick={() => onOpen(project)}>
              <div className="pm-pcard__top">
                <div className="pm-pcard__icon">
                  <AtomLogo size={18} />
                </div>
                <div className="pm-grow">
                  <div className="pm-pcard__name">
                    <span>{project.name}</span>
                    {project.favorite && <Star size={11} fill="currentColor" style={{ color: 'var(--warn)' }} />}
                  </div>
                  <div className="pm-pcard__path" title={project.path}>
                    {shortPath(project.path, home)}
                  </div>
                </div>
                <button
                  className={`pm-ibtn pm-pcard__star ${project.favorite ? 'on' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onFavorite(project)
                  }}
                  title={project.favorite ? 'Bỏ yêu thích' : 'Đánh dấu yêu thích'}
                >
                  <Star size={13} fill={project.favorite ? 'currentColor' : 'none'} />
                </button>
              </div>

              <div className="pm-pcard__meta">
                <span className="chip" style={{ fontSize: 10 }}>
                  {project.framework}
                </span>
                <span className="pm-row" style={{ gap: 4 }}>
                  <Play size={10} /> {project.scripts.length} script
                </span>
                <span className="pm-row" style={{ gap: 4 }}>
                  <Clock size={10} /> {formatTime(project.lastOpenedAt)}
                </span>
              </div>

              <div className="pm-pcard__actions">
                <button
                  className="btn sm primary"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpen(project)
                  }}
                >
                  Mở
                </button>
                <button
                  className="btn sm ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    onReveal(project)
                  }}
                  title="Hiện thư mục trong File Explorer"
                >
                  <FolderOpen size={12} /> Thư mục
                </button>
                <button
                  className="btn sm ghost"
                  style={{ marginLeft: 'auto' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(project)
                  }}
                  title="Xoá khỏi danh sách"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default ProjectView
