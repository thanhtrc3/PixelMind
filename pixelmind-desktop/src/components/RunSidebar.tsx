import { useState } from 'react'
import {
  Check,
  Copy,
  ExternalLink,
  FolderOpen,
  GitBranch,
  Info,
  Play,
  RefreshCw,
  Settings as SettingsIcon,
  Square,
} from 'lucide-react'
import type { ProjectRecord, ProjectStat, RunState, Settings } from '@shared/types'
import { formatBytes, formatTime, scriptLabel } from '../lib/format'

interface RunSidebarProps {
  project: ProjectRecord
  run: RunState | null
  settings: Settings
  stats: ProjectStat | null
  branch: string | null
  script: string
  onScript: (script: string) => void
  onRun: () => void
  onStop: () => void
  onReveal: () => void
  onRefresh: () => void
  onSettings: () => void
  onOpenExternal: (url: string) => void
}

const RunSidebar = ({
  project,
  run,
  settings,
  stats,
  branch,
  script,
  onScript,
  onRun,
  onStop,
  onReveal,
  onRefresh,
  onSettings,
  onOpenExternal,
}: RunSidebarProps) => {
  const [copied, setCopied] = useState(false)
  const running = run?.status === 'running' || run?.status === 'starting'
  const options = [
    ...project.scripts.map((s) => ({ value: s.name, label: `${s.name} — ${scriptLabel(s.kind)}` })),
    ...(project.hasIndexHtml ? [{ value: 'static', label: 'Xem trước tĩnh (index.html)' }] : []),
  ]
  const canRun = options.length > 0

  const copyUrl = async () => {
    if (!run?.url) return
    try {
      await navigator.clipboard.writeText(run.url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const statusText = (() => {
    if (!run) return 'Chưa chạy'
    switch (run.status) {
      case 'starting':
        return 'Đang khởi động…'
      case 'running':
        return 'Đang chạy'
      case 'stopped':
        return 'Đã dừng'
      case 'exited':
        return `Đã kết thúc (mã ${run.exitCode ?? '—'})`
      default:
        return 'Có lỗi'
    }
  })()

  return (
    <div className="pm-side">
      <section className="pm-card">
        <div className="pm-card__hd">
          <Play size={12} /> Chạy dự án
        </div>
        <div className="pm-card__bd">
          <div className="pm-field">
            <label htmlFor="run-script">Lệnh chạy</label>
            <select
              id="run-script"
              className="pm-select"
              value={script}
              onChange={(e) => onScript(e.target.value)}
              disabled={!canRun || running}
            >
              {!canRun && <option value="">Không có script</option>}
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="pm-statusline">
            <span className={`pm-dot ${running ? 'live' : run?.status === 'error' ? 'err' : run ? 'warn' : ''}`} />
            <span>{statusText}</span>
          </div>

          <div className="pm-row">
            {running ? (
              <button className="btn sm danger" onClick={onStop} style={{ flex: 1 }}>
                <Square size={11} /> Dừng
              </button>
            ) : (
              <button className="btn sm primary" onClick={onRun} disabled={!canRun} style={{ flex: 1 }}>
                <Play size={11} /> Chạy
              </button>
            )}
            <button className="btn sm ghost" onClick={onRefresh} title="Tải lại cây tệp">
              <RefreshCw size={12} />
            </button>
          </div>

          {run?.url && (
            <div className="pm-field">
              <span className="pm-label">Địa chỉ xem trước</span>
              <div className="pm-row">
                <code
                  className="pm-input mono"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    height: 29,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    color: 'var(--color-info-text)',
                  }}
                  title={run.url}
                >
                  {run.url}
                </code>
                <button className="pm-ibtn" onClick={copyUrl} title="Sao chép địa chỉ">
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                </button>
                <button className="pm-ibtn" onClick={() => onOpenExternal(run.url!)} title="Mở bằng trình duyệt">
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>
          )}

          {!canRun && (
            <p className="pm-hint">
              Thư mục này không có <code>package.json</code> kèm script và cũng không có <code>index.html</code>. Bạn
              vẫn có thể xem mã nguồn trong cây tệp.
            </p>
          )}

          {settings.previewMode === 'browser' && (
            <p className="pm-hint">Chế độ xem trước đang đặt là “Trình duyệt ngoài” — xem trong Cài đặt.</p>
          )}
        </div>
      </section>

      <section className="pm-card">
        <div className="pm-card__hd">
          <Info size={12} /> Thông tin dự án
        </div>
        <div className="pm-card__bd" style={{ gap: 0 }}>
          <div className="pm-kv">
            <span className="k">Khung</span>
            <span className="v">{project.framework}</span>
          </div>
          <div className="pm-kv">
            <span className="k">Quản lý gói</span>
            <span className="v">{project.packageManager === 'none' ? 'Không có' : project.packageManager}</span>
          </div>
          <div className="pm-kv">
            <span className="k">Nhánh git</span>
            <span className="v pm-row" style={{ gap: 4 }}>
              <GitBranch size={10} /> {branch ?? 'Không phải repo git'}
            </span>
          </div>
          <div className="pm-kv">
            <span className="k">Tệp / thư mục</span>
            <span className="v">{stats ? `${stats.files} / ${stats.folders}` : 'Đang đếm…'}</span>
          </div>
          <div className="pm-kv">
            <span className="k">Dung lượng</span>
            <span className="v">{stats ? formatBytes(stats.totalSize) : '—'}</span>
          </div>
          <div className="pm-kv">
            <span className="k">Mở lần cuối</span>
            <span className="v">{formatTime(project.lastOpenedAt)}</span>
          </div>
          <div className="pm-kv">
            <span className="k">Đường dẫn</span>
            <span className="v mono" title={project.path}>
              {project.path}
            </span>
          </div>
        </div>
      </section>

      <section className="pm-card">
        <div className="pm-card__hd">
          <FolderOpen size={12} /> Hành động nhanh
        </div>
        <div className="pm-card__bd">
          <button className="btn sm" onClick={onReveal}>
            <FolderOpen size={12} /> Mở trong File Explorer
          </button>
          <button className="btn sm" onClick={onSettings}>
            <SettingsIcon size={12} /> Cài đặt xem trước
          </button>
          <p className="pm-hint">
            Mẹo: nhấn <span className="pm-kbd">F5</span> để chạy, <span className="pm-kbd">Shift</span>+
            <span className="pm-kbd">F5</span> để dừng, <span className="pm-kbd">Ctrl</span>+
            <span className="pm-kbd">K</span> mở bảng lệnh.
          </p>
        </div>
      </section>
    </div>
  )
}

export default RunSidebar
