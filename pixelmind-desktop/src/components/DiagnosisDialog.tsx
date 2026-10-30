import {
  CheckCircle2,
  FolderGit2,
  HelpCircle,
  Lightbulb,
  Loader2,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import type { ProjectDiagnosis, ProjectIssue, ProjectRecord } from '@shared/types'
import Modal from './Modal'

interface DiagnosisDialogProps {
  project: ProjectRecord
  diagnosis: ProjectDiagnosis | null
  installing: boolean
  onClose: () => void
  onInstall: () => void
  onGitInit: () => void
  onRefresh: () => void
}

const levelBadge = (level: ProjectIssue['level']) => {
  switch (level) {
    case 'error':
      return { label: 'Thiếu sót nghiêm trọng', cls: 'err' }
    case 'warning':
      return { label: 'Cần lưu ý', cls: 'warn' }
    case 'info':
      return { label: 'Gợi ý tối ưu', cls: 'info' }
  }
}

const DiagnosisDialog = ({
  project,
  diagnosis,
  installing,
  onClose,
  onInstall,
  onGitInit,
  onRefresh,
}: DiagnosisDialogProps) => {
  const issues = diagnosis?.issues ?? []
  const hasErrors = issues.some((i) => i.level === 'error')
  const missingDeps = issues.find((i) => i.type === 'missing_deps')

  return (
    <Modal
      title={`Báo cáo kiểm tra dự án: ${project.name}`}
      subtitle={`Đường dẫn: ${project.path}`}
      icon={<ShieldAlert size={18} className={hasErrors ? 'pm-err' : 'pm-accent'} />}
      width={720}
      onClose={onClose}
      footer={
        <>
          <button className="btn sm ghost" onClick={onRefresh} title="Quét lại tình trạng thư mục">
            <RefreshCw size={12} /> Quét lại
          </button>
          <div className="grow" />
          <button className="btn" onClick={onClose}>
            {missingDeps ? 'Để sau' : 'Đóng'}
          </button>
          {missingDeps && (
            <button className="btn primary" onClick={onInstall} disabled={installing}>
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
        </>
      }
    >
      <div className="pm-diag-wrap">
        {issues.length === 0 ? (
          <div className="pm-diag-clean">
            <CheckCircle2 size={42} style={{ color: 'var(--ok)', marginBottom: 10 }} />
            <h3>Dự án đã sẵn sàng!</h3>
            <p className="pm-hint">
              Không phát hiện thiếu sót nào. Thư viện đã được cài đặt và các script cần thiết đã sẵn sàng.
            </p>
          </div>
        ) : (
          <div className="pm-diag-list">
            <div className="pm-diag-summary">
              {hasErrors ? (
                <div className="pm-diag-badge err">
                  <TriangleAlert size={14} /> Phát hiện {issues.length} vấn đề cần lưu ý (có mục bắt buộc trước khi chạy)
                </div>
              ) : (
                <div className="pm-diag-badge warn">
                  <HelpCircle size={14} /> Phát hiện {issues.length} gợi ý hỗ trợ trải nghiệm dự án
                </div>
              )}
            </div>

            {issues.map((issue) => {
              const badge = levelBadge(issue.level)
              return (
                <div key={issue.id} className={`pm-issue-card ${issue.level}`}>
                  <div className="pm-issue-card__hd">
                    {issue.level === 'error' && <TriangleAlert size={15} className="pm-err" />}
                    {issue.level === 'warning' && <TriangleAlert size={15} className="pm-warn" />}
                    {issue.level === 'info' && <HelpCircle size={15} className="pm-info" />}
                    <h4>{issue.title}</h4>
                    <span className={`chip ${badge.cls}`}>{badge.label}</span>
                  </div>

                  <p className="pm-issue-card__msg">{issue.message}</p>

                  <div className="pm-issue-card__rec">
                    <Lightbulb size={13} />
                    <div>
                      <b>Đề xuất:</b> {issue.recommendation}
                    </div>
                  </div>

                  {/* Hộp hành động trực tiếp nếu là thiếu npm install */}
                  {issue.actionKind === 'install' && (
                    <div className="pm-issue-prompt">
                      <div className="pm-issue-prompt__desc">
                        <span>👉 <b>Bạn có muốn PixelMind tự động cài đặt thư viện ngay không?</b></span>
                        <p className="pm-hint">
                          Hệ thống sẽ chạy <code>{project.packageManager || 'npm'} install</code> và hiển thị tiến trình trực tiếp.
                        </p>
                      </div>
                      <button
                        className="btn primary sm"
                        onClick={onInstall}
                        disabled={installing}
                      >
                        {installing ? (
                          <>
                            <Loader2 size={13} className="pm-spin" /> Đang cài đặt thư viện...
                          </>
                        ) : (
                          <>
                            <Zap size={13} /> Cài đặt ngay ({project.packageManager || 'npm'} install)
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Hộp hành động nếu là git init */}
                  {issue.actionKind === 'git_init' && (
                    <div className="pm-issue-prompt">
                      <div className="pm-issue-prompt__desc">
                        <span>👉 <b>Khởi tạo Git để theo dõi lịch sử và phiên bản:</b></span>
                      </div>
                      <button className="btn sm" onClick={onGitInit}>
                        <FolderGit2 size={13} /> Khởi tạo Git (git init)
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default DiagnosisDialog

