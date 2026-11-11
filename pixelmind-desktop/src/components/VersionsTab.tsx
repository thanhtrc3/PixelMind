import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, GitBranch, Loader2, RefreshCw, TriangleAlert, Undo2, X } from 'lucide-react'
import type { GitCommit, GitGraphData, GitGraphScope, ProjectRecord } from '@shared/types'
import { api, isDesktop } from '../lib/bridge'
import { editorBuffer } from '../lib/editorBuffer'
import GitGraphView from './GitGraphView'
import Modal from './Modal'

interface VersionsTabProps {
  project: ProjectRecord
  branch: string | null
  onRefresh: () => void
  onShowToast: (kind: 'ok' | 'err' | 'info', text: string) => void
}

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : typeof error === 'string' ? error : 'Lỗi không xác định.'

const VersionsTab = ({ project, branch, onRefresh, onShowToast }: VersionsTabProps) => {
  const [scope, setScope] = useState<GitGraphScope>('all')
  const [graph, setGraph] = useState<GitGraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [selected, setSelected] = useState<GitCommit | null>(null)
  const [pendingRollback, setPendingRollback] = useState<GitCommit | null>(null)
  const [rollingBack, setRollingBack] = useState(false)

  const toastRef = useRef(onShowToast)
  toastRef.current = onShowToast

  const loadGraph = useCallback(
    async (nextScope: GitGraphScope = scope) => {
      setLoading(true)
      try {
        const data = await api.projects.gitGraph(project.id, nextScope)
        setGraph(data)
      } catch (error) {
        toastRef.current('err', `Không đọc được lịch sử Git: ${errorText(error)}`)
      } finally {
        setLoading(false)
      }
    },
    [project.id, scope],
  )

  useEffect(() => {
    void loadGraph(scope)
  }, [loadGraph, scope])

  useEffect(() => {
    setSelected(null)
    setPendingRollback(null)
  }, [project.id])

  const headCommit = graph?.commits.find((commit) => commit.isHead) ?? null
  const currentBranch = graph?.branch ?? branch

  const handleFetch = async () => {
    if (fetching) return
    setFetching(true)
    try {
      const result = await api.projects.gitFetch(project.id)
      if (!result.ok) {
        toastRef.current('err', `Không đồng bộ được GitHub: ${result.error ?? 'không rõ lỗi'}`)
        return
      }
      toastRef.current('ok', 'Đã đồng bộ remote-tracking branches từ GitHub.')
      await loadGraph(scope)
    } catch (error) {
      toastRef.current('err', `Không đồng bộ được GitHub: ${errorText(error)}`)
    } finally {
      setFetching(false)
    }
  }

  const handleRollback = async () => {
    if (!pendingRollback || rollingBack) return
    setRollingBack(true)
    try {
      const result = await api.projects.gitRollback(project.id, pendingRollback.hash)
      if (!result.ok) {
        toastRef.current('err', `Không khôi phục được commit: ${result.error ?? 'không rõ lỗi'}`)
        return
      }
      const hadRamChanges = editorBuffer.getDirtyFiles().length > 0 || editorBuffer.canUndo()
      editorBuffer.clearAll()

      toastRef.current(
        'ok',
        `Đã khôi phục về ${pendingRollback.shortHash}${
          result.safetyRef ? ` · backup: ${result.safetyRef}` : ''
        }.${hadRamChanges ? ' Đã xoá checkpoint RAM cũ.' : ''}`,
      )
      setPendingRollback(null)
      setSelected(null)
      await loadGraph(scope)
      onRefresh()
    } catch (error) {
      toastRef.current('err', `Không khôi phục được commit: ${errorText(error)}`)
    } finally {
      setRollingBack(false)
    }
  }

  return (
    <div className="pm-versions-tab">
      <div className="pm-version-branch-card">
        <GitBranch size={14} style={{ color: 'var(--accent)' }} />
        <div className="pm-grow" style={{ minWidth: 0 }}>
          <div className="pm-version-branch-card__title">Nhánh: {currentBranch || '—'}</div>
          <div className="pm-version-branch-card__meta">
            {headCommit ? `${headCommit.shortHash} · ${headCommit.subject}` : 'Chưa có commit nào'}
          </div>
          <div className="pm-version-branch-card__meta">
            {project.meta.repo || 'Chưa cấu hình remote GitHub'}
            {graph && !graph.hasRemote ? ' · không có remote' : ''}
          </div>
        </div>
        <button
          type="button"
          className="pm-ibtn"
          onClick={() => void handleFetch()}
          disabled={!graph?.hasRemote || fetching}
          title="Đồng bộ GitHub (git fetch --all --prune)"
        >
          {fetching ? <Loader2 size={12} className="pm-spin" /> : <Download size={12} />}
        </button>
        <button
          type="button"
          className="pm-ibtn"
          onClick={() => void loadGraph(scope)}
          disabled={loading}
          title="Đọc lại lịch sử Git"
        >
          <RefreshCw size={12} className={loading ? 'pm-spin' : ''} />
        </button>
      </div>

      <div className="pm-versions-section">
        <div className="pm-versions-section__hd">
          <GitBranch size={13} />
          <b>Đồ thị commit</b>
          <span className="chip">{graph?.commits.length ?? 0}</span>
          <span className="pm-grow" />
          <select
            className="pm-select pm-select--sm"
            value={scope}
            onChange={(event) => setScope(event.target.value as GitGraphScope)}
            title="Phạm vi commit"
          >
            <option value="all">Tất cả nhánh</option>
            <option value="current">Nhánh hiện tại</option>
          </select>
        </div>

        {loading ? (
          <div className="pm-versions-loading">
            <Loader2 size={14} className="pm-spin" /> Đang đọc .git…
          </div>
        ) : graph && graph.commits.length > 0 ? (
          <GitGraphView
            commits={graph.commits}
            selectedHash={selected?.hash ?? null}
            onSelect={setSelected}
          />
        ) : (
          <div className="pm-versions-empty">
            <GitBranch size={20} className="pm-muted" />
            <p className="pm-hint">
              Chưa đọc được commit nào. Kiểm tra dự án đã <code>git init</code> và có ít nhất một
              commit.
            </p>
            {!isDesktop && (
              <p className="pm-hint">
                Bản xem trước trên trình duyệt không đọc được <code>.git</code>. Hãy chạy bản
                desktop để xem đồ thị commit thật.
              </p>
            )}
          </div>
        )}

        {selected && (
          <div className="pm-gitgraph-detail">
            <div className="pm-gitgraph-detail__hd">
              <b>{selected.subject}</b>
              <button type="button" className="pm-ibtn" onClick={() => setSelected(null)}>
                <X size={12} />
              </button>
            </div>
            <div className="pm-gitgraph-detail__grid">
              <span>Commit</span>
              <code>{selected.shortHash}</code>
              <span>Tác giả</span>
              <span>{selected.author}</span>
              <span>Thời gian</span>
              <span>{new Date(selected.timestamp * 1000).toLocaleString('vi-VN')}</span>
              <span>Parent</span>
              <span>
                {selected.parents.length > 0
                  ? selected.parents.map((parent) => parent.slice(0, 7)).join(', ')
                  : '—'}
              </span>
            </div>
            {selected.body && <pre className="pm-gitgraph-detail__body">{selected.body}</pre>}
            <button
              type="button"
              className="btn sm danger"
              onClick={() => setPendingRollback(selected)}
            >
              <Undo2 size={11} /> Khôi phục về commit này
            </button>
          </div>
        )}
      </div>

      {pendingRollback && (
        <Modal
          title="Khôi phục mã nguồn"
          subtitle={`Commit ${pendingRollback.shortHash} · ${pendingRollback.subject}`}
          icon={<TriangleAlert size={16} />}
          width={460}
          onClose={() => {
            if (!rollingBack) setPendingRollback(null)
          }}
          footer={
            <>
              <button
                type="button"
                className="btn"
                onClick={() => setPendingRollback(null)}
                disabled={rollingBack}
              >
                Huỷ
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => void handleRollback()}
                disabled={rollingBack}
              >
                {rollingBack ? (
                  <Loader2 size={13} className="pm-spin" />
                ) : (
                  <Undo2 size={13} />
                )}{' '}
                Khôi phục
              </button>
            </>
          }
        >
          <div className="pm-rollback-warning">
            <TriangleAlert size={16} />
            <div>
              <p>
                PixelMind sẽ chạy <code>git reset --hard {pendingRollback.shortHash}</code> trên
                nhánh hiện tại.
              </p>
              <ul>
                <li>Các commit sau mốc này sẽ bị gỡ khỏi nhánh hiện tại.</li>
                <li>Thay đổi tracked chưa commit sẽ mất.</li>
                <li>
                  Một nhánh backup <code>pm-backup-…</code> sẽ được tạo trước khi reset để có thể
                  quay lại.
                </li>
              </ul>
            </div>
          </div>
          <div className="pm-gitgraph-detail__grid">
            <span>Tác giả</span>
            <span>{pendingRollback.author}</span>
            <span>Thời gian</span>
            <span>{new Date(pendingRollback.timestamp * 1000).toLocaleString('vi-VN')}</span>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default VersionsTab
