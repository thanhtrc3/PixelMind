import {
  Activity,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Files,
  FolderGit2,
  FolderOpen,
  Image as ImageIcon,
  Info,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
  Square,
  Trash2,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import type { ProjectDiagnosis, ProjectRecord, ProjectStat, RunState } from '@shared/types'
import { formatTime, scriptLabel } from '../lib/format'

interface ProjectDetailProps {
  project: ProjectRecord
  run: RunState | null
  stats: ProjectStat | null
  branch: string | null
  diagnosis?: ProjectDiagnosis | null
  installing?: boolean
  onOpenFolder: () => void
  onRun: () => void
  onStop: () => void
  onWorkspace: () => void
  onRefresh: () => void
  onAddPage: () => void
  onRemovePage: (pageId: string) => void
  onReveal: () => void
  onOpenLog: () => void
  onOpenExternal: (url: string) => void
  onOpenDiagnosis: () => void
  onInstall: () => void
}

const statusChip: Record<string, { label: string; cls: string }> = {
  ok: { label: 'đạt', cls: 'ok' },
  review: { label: 'chờ duyệt', cls: 'warn' },
  error: { label: 'lỗi', cls: 'err' },
  warn: { label: 'cảnh báo', cls: 'warn' },
  info: { label: 'thông tin', cls: 'info' },
}

const ProjectDetail = ({
  project,
  run,
  stats,
  branch,
  diagnosis,
  installing = false,
  onOpenFolder,
  onRun,
  onStop,
  onWorkspace,
  onRefresh,
  onAddPage,
  onRemovePage,
  onReveal,
  onOpenLog,
  onOpenExternal,
  onOpenDiagnosis,
  onInstall,
}: ProjectDetailProps) => {
  const [allVersions, setAllVersions] = useState(false)
  const [allActivity, setAllActivity] = useState(false)

  const { meta } = project
  const running = run?.status === 'running' || run?.status === 'starting'
  const port = run?.url?.match(/:(\d+)/)?.[1]
  const devScript = project.scripts.find((item) => item.kind === 'dev')
  const mockupCount = meta.pages.filter((page) => page.mockup).length
  const visibleVersions = allVersions ? meta.versions : meta.versions.slice(0, 3)
  const visibleActivity = allActivity ? meta.activity : meta.activity.slice(0, 5)

  const missingDeps = diagnosis?.issues.find((i) => i.type === 'missing_deps')
  const issuesCount = diagnosis?.issues.length ?? 0

  return (
    <section className="pm-detail">
      <header className="pm-detail__hd">
        <div className="pm-grow">
          <div className="pm-detail__title">
            <h1>{project.name}</h1>
            <span className="pm-fw">{project.framework}</span>
            {diagnosis?.healthy && !diagnosis.hasIssues ? (
              <button className="pm-tag ok" onClick={onOpenDiagnosis} title="Dự án đã kiểm tra và sẵn sàng">
                <CheckCircle2 size={12} /> Sẵn sàng
              </button>
            ) : issuesCount > 0 ? (
              <button
                className={`pm-tag ${missingDeps ? 'err' : 'warn'}`}
                onClick={onOpenDiagnosis}
                title="Bấm để xem báo cáo kiểm tra dự án"
              >
                <ShieldAlert size={12} /> {missingDeps ? 'Thiếu thư viện' : `${issuesCount} lưu ý`}
              </button>
            ) : null}
            {running ? (
              <span className="pm-devpill">
                <span className="pm-dot live" /> dev server {port ? `:${port}` : '…'}
              </span>
            ) : (
              <span className="pm-devpill off">
                <span className="pm-dot" /> chưa chạy
              </span>
            )}
          </div>
          <p className="pm-detail__meta">
            <span className="pm-mono">{project.path}</span>
            <span>· chủ dự án: {meta.owner}</span>
            <span>· tạo {new Date(meta.createdAt).toLocaleDateString('vi-VN')}</span>
            {meta.repo && <span>· {meta.repo}</span>}
            {branch && <span>· nhánh {branch}</span>}
          </p>
        </div>

        <div className="pm-row" style={{ flex: 'none' }}>
          <button className="btn" onClick={onOpenDiagnosis} title="Báo cáo kiểm tra và đề xuất cho thư mục này">
            <ShieldAlert size={13} /> Kiểm tra dự án {issuesCount > 0 && `(${issuesCount})`}
          </button>
          <button className="btn" onClick={onOpenFolder}>
            <FolderOpen size={13} /> Mở thư mục
          </button>
          {running ? (
            <button className="btn danger" onClick={onStop}>
              <Square size={12} /> Dừng
            </button>
          ) : (
            <button className="btn" onClick={onRun}>
              <Play size={13} /> Run
            </button>
          )}
          <button className="btn primary" onClick={onWorkspace}>
            <LayoutDashboard size={13} /> Mở màn hình làm việc
          </button>
        </div>
      </header>

      {/* ── Khối cảnh báo chẩn đoán dự án nếu phát hiện vấn đề ── */}
      {diagnosis && diagnosis.hasIssues && (
        <div className={`pm-alert-banner ${missingDeps ? 'err' : 'warn'}`}>
          <div className="pm-alert-banner__icon">
            <TriangleAlert size={18} />
          </div>
          <div className="pm-alert-banner__content">
            <h4>
              {missingDeps
                ? 'Phát hiện thiếu sót: Dự án chưa cài đặt thư viện (thiếu node_modules)'
                : `Phát hiện ${issuesCount} vấn đề cần lưu ý đối với dự án này`}
            </h4>
            <p>
              {missingDeps
                ? 'Dự án khai báo thư viện trong package.json nhưng chưa được tải về máy. Nếu bấm Run sẽ bị lỗi thiếu module.'
                : diagnosis.issues[0]?.message}
            </p>
          </div>
          <div className="pm-alert-banner__actions">
            {missingDeps && (
              <button className="btn primary sm" onClick={onInstall} disabled={installing}>
                {installing ? (
                  <>
                    <Loader2 size={13} className="pm-spin" /> Đang cài đặt...
                  </>
                ) : (
                  <>
                    <Zap size={13} /> Cài đặt ngay ({project.packageManager || 'npm'} install)
                  </>
                )}
              </button>
            )}
            <button className="btn sm" onClick={onOpenDiagnosis}>
              <ShieldAlert size={13} /> Xem báo cáo & đề xuất ({issuesCount})
            </button>
          </div>
        </div>
      )}

      {/* ── Chỉ số nhanh ── */}
      <div className="pm-stats">
        <div className="pm-stat">
          <div className="pm-stat__ico">
            <Files size={15} />
          </div>
          <div className="pm-stat__l">Trang</div>
          <div className="pm-stat__v">{meta.pages.length}</div>
          <div className="pm-stat__f">{mockupCount} trang có ảnh mẫu</div>
        </div>
        <div className="pm-stat">
          <div className="pm-stat__ico">
            <FolderGit2 size={15} />
          </div>
          <div className="pm-stat__l">Phiên bản</div>
          <div className="pm-stat__v">{meta.versions.length}</div>
          <div className="pm-stat__f">
            {meta.versions[0] ? `${meta.versions[0].name} · ${meta.versions[0].hash}` : 'chưa có commit git'}
          </div>
        </div>
        <div className="pm-stat">
          <div className="pm-stat__ico">
            <ListChecks size={15} />
          </div>
          <div className="pm-stat__l">Script</div>
          <div className="pm-stat__v">{project.scripts.length}</div>
          <div className="pm-stat__f">
            {devScript ? `${devScript.name} · ${scriptLabel(devScript.kind)}` : 'không có script chạy'}
          </div>
        </div>
        <div className="pm-stat">
          <div className="pm-stat__ico">
            <ImageIcon size={15} />
          </div>
          <div className="pm-stat__l">Ảnh mẫu</div>
          <div className="pm-stat__v">{mockupCount}</div>
          <div className="pm-stat__f">
            {stats ? `${stats.files} tệp · ${stats.folders} thư mục` : 'đang đếm tệp…'}
          </div>
        </div>
      </div>

      {/* ── Trang và ảnh mẫu ── */}
      <div className="pm-box">
        <div className="pm-box__hd">
          <Files size={13} />
          <b>Trang và ảnh mẫu</b>
          <span className="chip" style={{ fontSize: 10 }}>
            {meta.pages.length} trang
          </span>
          <span className="pm-grow" />
          <span className="pm-hint">Ảnh mẫu không bắt buộc</span>
          <button className="btn sm primary" onClick={onAddPage}>
            <Plus size={12} /> Thêm trang
          </button>
        </div>

        {meta.pages.length === 0 ? (
          <div className="pm-box__empty">
            <p className="pm-hint">
              Chưa dò thấy trang nào. Thêm tay route đầu tiên hoặc mở lại dự án để PixelMind quét lại thư mục{' '}
              <code>src/pages</code>, <code>app</code>, <code>pages</code>.
            </p>
            <div className="pm-row">
              <button className="btn sm" onClick={onAddPage}>
                <Plus size={12} /> Thêm trang
              </button>
              <button className="btn sm ghost" onClick={onRefresh}>
                <RefreshCw size={12} /> Quét lại
              </button>
            </div>
          </div>
        ) : (
          <table className="pm-table">
            <thead>
              <tr>
                <th style={{ width: '24%' }}>Route</th>
                <th>Tiêu đề</th>
                <th style={{ width: '13%' }}>Ảnh mẫu</th>
                <th style={{ width: '15%' }}>Phần mềm</th>
                <th style={{ width: '12%' }}>Khung</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {meta.pages.map((page) => (
                <tr key={page.id} onClick={onWorkspace} title="Mở màn hình làm việc">
                  <td className="pm-mono">{page.route}</td>
                  <td>
                    {page.title}
                    {page.route === '/' && <span className="pm-tag">trang gốc</span>}
                  </td>
                  <td>
                    <span className={`chip ${page.mockup ? 'ok' : 'plain'}`} style={{ fontSize: 10 }}>
                      {page.mockup ? 'có' : 'không bắt buộc'}
                    </span>
                  </td>
                  <td className="pm-muted">{page.software}</td>
                  <td className="pm-muted pm-mono">{page.frame}</td>
                  <td>
                    <button
                      className="pm-ibtn"
                      title="Xoá trang khỏi danh sách"
                      onClick={(event) => {
                        event.stopPropagation()
                        onRemovePage(page.id)
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="pm-note">
          <ImageIcon size={12} />
          <span>
            Ảnh mẫu không bắt buộc. Không có ảnh mẫu thì canvas vẫn chạy ở chế độ Live và so sánh theo DOM.
          </span>
        </div>
      </div>

      {/* ── Phiên bản + thông tin ── */}
      <div className="pm-detail__cols">
        <div className="pm-box">
          <div className="pm-box__hd">
            <FolderGit2 size={13} />
            <b>Phiên bản</b>
            <span className="pm-grow" />
            <button className="btn sm ghost" onClick={() => setAllVersions((value) => !value)}>
              {allVersions ? 'Thu gọn' : 'Xem tất cả'}
            </button>
          </div>
          {visibleVersions.length === 0 ? (
            <div className="pm-box__empty">
              <p className="pm-hint">
                Chưa đọc được lịch sử git. Hãy kiểm tra dự án đã <code>git init</code> và có ít nhất một commit.
              </p>
            </div>
          ) : (
            <div className="pm-versions">
              {visibleVersions.map((version) => (
                <div className="pm-version" key={version.id}>
                  <span className={`pm-dot ${version.status === 'ok' ? 'ok' : version.status === 'review' ? 'warn' : 'err'}`} />
                  <div className="pm-grow">
                    <div className="pm-version__top">
                      <b>{version.name}</b>
                      <span className={`chip ${statusChip[version.status]?.cls ?? 'plain'}`} style={{ fontSize: 10 }}>
                        {statusChip[version.status]?.label ?? version.status}
                      </span>
                      <span className="pm-mono pm-muted">{version.hash}</span>
                      <span className="pm-version__date">{version.date}</span>
                    </div>
                    <div className="pm-version__note">{version.note}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pm-box">
          <div className="pm-box__hd">
            <Info size={13} />
            <b>Thông tin dự án</b>
            <span className="pm-grow" />
            <button className="pm-ibtn" onClick={onReveal} title="Mở thư mục trong File Explorer">
              <ExternalLink size={12} />
            </button>
          </div>
          <div className="pm-info">
            <div className="pm-kv">
              <span className="k">Mã dự án</span>
              <span className="v">{meta.code}</span>
            </div>
            <div className="pm-kv">
              <span className="k">Thư mục code</span>
              <span className="v mono" title={project.path}>
                {project.path}
              </span>
            </div>
            <div className="pm-kv">
              <span className="k">Loại công nghệ</span>
              <span className="v">{project.framework} (tự nhận ra khi mở thư mục)</span>
            </div>
            <div className="pm-kv">
              <span className="k">Dev server</span>
              <span className="v">
                {running && run?.url ? (
                  <button className="pm-link" onClick={() => onOpenExternal(run.url!)}>
                    {run.url}
                  </button>
                ) : running ? (
                  'đang khởi động…'
                ) : (
                  'chưa chạy'
                )}
              </span>
            </div>
            <div className="pm-kv">
              <span className="k">Kho GitHub</span>
              <span className="v">{meta.repo || '—'}</span>
            </div>
            <div className="pm-kv">
              <span className="k">Người dùng tên</span>
              <span className="v">{meta.owner}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Hoạt động gần đây ── */}
      <div className="pm-box">
        <div className="pm-box__hd">
          <Activity size={13} />
          <b>Hoạt động gần đây</b>
          <span className="pm-grow" />
          <button className="btn sm ghost" onClick={() => setAllActivity((value) => !value)}>
            {allActivity ? 'Thu gọn' : 'Xem tất cả'}
          </button>
          <button className="btn sm" onClick={onOpenLog}>
            Mở nhật ký
          </button>
        </div>
        {visibleActivity.length === 0 ? (
          <div className="pm-box__empty">
            <p className="pm-hint">Chưa có hoạt động nào. Mở dự án, chạy script hoặc thêm trang để bắt đầu ghi nhật ký.</p>
          </div>
        ) : (
          <table className="pm-table pm-table--activity">
            <tbody>
              {visibleActivity.map((entry) => (
                <tr key={entry.id}>
                  <td style={{ width: '15%' }} className="pm-muted">
                    <span className="pm-row" style={{ gap: 5 }}>
                      <Clock size={11} /> {formatTime(entry.at)}
                    </span>
                  </td>
                  <td style={{ width: '22%' }}>{entry.actor}</td>
                  <td>{entry.action}</td>
                  <td style={{ width: 90 }}>
                    <span className={`chip ${entry.kind === 'AI' ? 'ac' : entry.kind === 'hệ thống' ? 'info' : 'plain'}`} style={{ fontSize: 10 }}>
                      {entry.kind}
                    </span>
                  </td>
                  <td style={{ width: 100, textAlign: 'right' }}>
                    <span className={`chip ${statusChip[entry.status]?.cls ?? 'plain'}`} style={{ fontSize: 10 }}>
                      {statusChip[entry.status]?.label ?? entry.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!run && meta.versions.length === 0 && (
        <div className="pm-note" style={{ marginTop: 4 }}>
          <TriangleAlert size={12} />
          <span>
            Dự án chưa có lịch sử git nên danh sách phiên bản đang trống. Đây không phải lỗi — PixelMind chỉ hiển thị
            những gì đọc được từ <code>.git</code>.
          </span>
        </div>
      )}

      <div className="pm-detail__foot">
        <ChevronRight size={12} />
        <span>
          Nhấn vào một trang để mở màn hình làm việc. Toàn bộ dữ liệu dự án được đọc trực tiếp từ thư mục, không chỉnh
          sửa mã nguồn.
        </span>
      </div>
    </section>
  )
}

export default ProjectDetail
