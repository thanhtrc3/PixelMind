import { useState } from 'react'
import {
  Check,
  Copy,
  ExternalLink,
  FileCode2,
  FolderOpen,
  GitBranch,
  Info,
  Loader2,
  Play,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldAlert,
  Square,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import type { ProjectDiagnosis, ProjectRecord, ProjectStat, RunState, Settings } from '@shared/types'
import { formatBytes, formatTime, scriptLabel } from '../lib/format'

interface RunSidebarProps {
  project: ProjectRecord
  run: RunState | null
  settings: Settings
  stats: ProjectStat | null
  branch: string | null
  script: string
  diagnosis?: ProjectDiagnosis | null
  installing?: boolean
  onScript: (script: string) => void
  customCommand?: string
  onCustomCommand?: (command: string) => void
  onSaveCustomCommand?: (command: string) => void
  onRun: () => void
  onStop: () => void
  onReveal: () => void
  onRefresh: () => void
  onSettings: () => void
  onOpenExternal: (url: string) => void
  onOpenDiagnosis?: () => void
  onInstall?: () => void
  onCreateIndexHtml?: () => void
  onAddDevScript?: () => void
}

const RunSidebar = ({
  project,
  run,
  settings,
  stats,
  branch,
  script,
  diagnosis,
  installing = false,
  onScript,
  customCommand = '',
  onCustomCommand,
  onSaveCustomCommand,
  onRun,
  onStop,
  onReveal,
  onRefresh,
  onSettings,
  onOpenExternal,
  onOpenDiagnosis,
  onInstall,
  onCreateIndexHtml,
  onAddDevScript,
}: RunSidebarProps) => {
  const [copied, setCopied] = useState(false)
  const running = run?.status === 'running' || run?.status === 'starting'
  const options = [
    ...project.scripts.map((s) => ({ value: s.name, label: `${s.name} — ${scriptLabel(s.kind)}` })),
    ...(project.hasIndexHtml ? [{ value: 'static', label: 'Xem trước tĩnh (index.html)' }] : []),
    { value: 'custom', label: 'Lệnh tự nhập…' },
  ]
  const isCustom = script === 'custom'
  const canRun = !isCustom || customCommand.trim().length > 0
  const placeholder =
    project.framework === 'Flutter'
      ? 'flutter run -d chrome'
      : project.framework.includes('ASP.NET') || project.packageManager === 'dotnet'
        ? 'dotnet watch run'
        : 'python -m http.server 8000'
  const missingDeps = diagnosis?.issues.find((i) => i.type === 'missing_deps')
  const missingHtml = diagnosis?.issues.find((i) => i.actionKind === 'create_index_html')

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
        return run.kind === 'install' ? 'Đang cài đặt thư viện…' : 'Đang khởi động…'
      case 'running':
        return run.kind === 'install' ? 'Đang cài đặt thư viện…' : 'Đang chạy'
      case 'stopped':
        return run.kind === 'install' ? 'Cài đặt đã xong' : 'Đã dừng'
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
          {diagnosis && (
            <button
              className="pm-ibtn"
              onClick={onOpenDiagnosis}
              title="Xem báo cáo kiểm tra dự án"
              style={{ marginLeft: 'auto', width: 22, height: 22 }}
            >
              <ShieldAlert size={12} className={missingDeps ? 'pm-err' : ''} />
            </button>
          )}
        </div>
        <div className="pm-card__bd">
          {missingDeps && (
            <div className="pm-side-alert err">
              <div className="pm-side-alert__top">
                <TriangleAlert size={13} className="pm-err" />
                <b>
                  {project.packageManager === 'dotnet'
                    ? 'Chưa khôi phục NuGet!'
                    : project.packageManager === 'flutter'
                      ? 'Chưa pub get!'
                      : 'Chưa cài đặt thư viện!'}
                </b>
              </div>
              <p className="pm-hint" style={{ fontSize: 11, margin: '2px 0 6px' }}>
                {project.packageManager === 'dotnet' ? (
                  'Chưa khôi phục các gói NuGet (thiếu obj/project.assets.json).'
                ) : project.packageManager === 'flutter' ? (
                  'Chưa tải các gói Flutter (thiếu .dart_tool/package_config.json).'
                ) : (
                  <>Thư mục <code>node_modules</code> chưa có. Hãy cài đặt trước khi chạy.</>
                )}
              </p>
              <button
                className="btn sm primary"
                onClick={onInstall}
                disabled={installing}
                style={{ width: '100%' }}
              >
                {installing ? (
                  <>
                    <Loader2 size={11} className="pm-spin" />{' '}
                    {project.packageManager === 'dotnet'
                      ? 'Đang khôi phục...'
                      : project.packageManager === 'flutter'
                        ? 'Đang tải gói...'
                        : 'Đang cài đặt...'}
                  </>
                ) : (
                  <>
                    <Zap size={11} />{' '}
                    {project.packageManager === 'dotnet'
                      ? 'Khôi phục ngay (dotnet restore)'
                      : project.packageManager === 'flutter'
                        ? 'Tải ngay (flutter pub get)'
                        : `Cài đặt ngay (${project.packageManager || 'npm'} install)`}
                  </>
                )}
              </button>
            </div>
          )}

          {!missingDeps && missingHtml && onCreateIndexHtml && (
            <div className="pm-side-alert warn">
              <div className="pm-side-alert__top">
                <TriangleAlert size={13} className="pm-warn" />
                <b>Chưa có tệp index.html!</b>
              </div>
              <p className="pm-hint" style={{ fontSize: 11, margin: '2px 0 6px' }}>
                Dự án chưa có trang để xem trước. Tạo tệp index.html mẫu để bắt đầu.
              </p>
              <button
                className="btn sm primary"
                onClick={onCreateIndexHtml}
                style={{ width: '100%' }}
              >
                <FileCode2 size={11} /> Tạo tệp index.html ngay
              </button>
            </div>
          )}

          {!missingDeps && !missingHtml && onAddDevScript && diagnosis?.issues.some((i) => i.actionKind === 'add_dev_script') && (
            <div className="pm-side-alert warn">
              <div className="pm-side-alert__top">
                <TriangleAlert size={13} className="pm-warn" />
                <b>Thiếu script dev!</b>
              </div>
              <p className="pm-hint" style={{ fontSize: 11, margin: '2px 0 6px' }}>
                Thêm lệnh dev server vào package.json để khởi động xem trước.
              </p>
              <button
                className="btn sm primary"
                onClick={onAddDevScript}
                style={{ width: '100%' }}
              >
                <FileCode2 size={11} /> Thêm script dev ngay
              </button>
            </div>
          )}

          <div className="pm-field">
            <label htmlFor="run-script">Lệnh chạy</label>
            <select
              id="run-script"
              className="pm-select"
              value={script}
              onChange={(e) => onScript(e.target.value)}
              disabled={running}
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {isCustom && (
            <div className="pm-field">
              <label htmlFor="run-command">Lệnh tự nhập</label>
              <input
                id="run-command"
                className="pm-input mono"
                placeholder={placeholder}
                value={customCommand}
                disabled={running}
                onChange={(e) => onCustomCommand?.(e.target.value)}
                onBlur={() => onSaveCustomCommand?.(customCommand)}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter' && canRun && !running) onRun()
                }}
              />
              <p className="pm-hint" style={{ marginTop: 5 }}>
                Lệnh chạy trong thư mục dự án. PixelMind tự đọc địa chỉ localhost từ log để mở xem trước.
              </p>
            </div>
          )}

          <div className="pm-statusline">
            <span className={`pm-dot ${running ? 'live' : run?.status === 'error' ? 'err' : run ? 'warn' : ''}`} />
            <span>{statusText}</span>
          </div>

          <div className="pm-row" style={{ marginTop: 10, gap: 8 }}>
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

          {project.scripts.length === 0 && !project.hasIndexHtml && (
            <p className="pm-hint">
              Dự án chưa có script sẵn. Chọn <b>Lệnh tự nhập…</b> và nhập lệnh bạn muốn chạy — PixelMind sẽ ghi nhớ lệnh
              này cho lần sau.
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
          {onOpenDiagnosis && (
            <button className="btn sm" onClick={onOpenDiagnosis}>
              <ShieldAlert size={12} /> Báo cáo kiểm tra dự án
            </button>
          )}
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
