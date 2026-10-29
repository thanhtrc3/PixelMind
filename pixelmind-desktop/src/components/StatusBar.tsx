import { GitBranch, FolderOpen, Radio, WifiOff } from 'lucide-react'
import type { ProjectRecord, ProjectStat, RunState } from '@shared/types'

interface StatusBarProps {
  project: ProjectRecord | null
  run: RunState | null
  stats: ProjectStat | null
  branch: string | null
  version: string
  isDesktop: boolean
}

const StatusBar = ({ project, run, stats, branch, version, isDesktop }: StatusBarProps) => {
  const running = run?.status === 'running' || run?.status === 'starting'

  return (
    <footer className="pm-status">
      <span className="pm-status__item">
        <FolderOpen size={11} />
        {project ? project.name : 'Chưa mở dự án'}
      </span>

      {project && (
        <>
          <span className="pm-status__item">·</span>
          <span className="pm-status__item">{project.framework}</span>
          {branch && (
            <span className="pm-status__item">
              <GitBranch size={11} /> {branch}
            </span>
          )}
          {stats && (
            <span className="pm-status__item">
              {stats.files} tệp · {stats.folders} thư mục
            </span>
          )}
        </>
      )}

      <span className="pm-status__grow" />

      <span className="pm-status__item">
        {running ? (
          <>
            <Radio size={11} style={{ color: 'var(--ok)' }} />
            Đang chạy {run?.url ? <span className="pm-mono">· {run.url}</span> : '…'}
          </>
        ) : (
          <>Sẵn sàng</>
        )}
      </span>

      <span className="pm-status__item">v{version}</span>
      <span className={`pm-status__badge ${isDesktop ? '' : 'mock'}`}>
        {isDesktop ? (
          'Desktop'
        ) : (
          <>
            <WifiOff size={9} style={{ marginRight: 3, verticalAlign: -1 }} />
            Xem trước
          </>
        )}
      </span>
    </footer>
  )
}

export default StatusBar
