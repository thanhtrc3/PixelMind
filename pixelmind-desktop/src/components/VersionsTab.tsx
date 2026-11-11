import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArchiveRestore,
  Download,
  GitBranch,
  History,
  Loader2,
  Redo2,
  RefreshCw,
  Save,
  Trash2,
  TriangleAlert,
  Undo2,
  X,
} from 'lucide-react'
import type { BackupSnapshot, GitCommit, GitGraphData, GitGraphScope, ProjectRecord } from '@shared/types'
import { api, isDesktop } from '../lib/bridge'
import { editorBuffer } from '../lib/editorBuffer'
import { formatBytes, formatTime } from '../lib/format'
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
  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>([])
  const [snapshotsLoading, setSnapshotsLoading] = useState(false)
  const [restoringSnapId, setRestoringSnapId] = useState<string | null>(null)
  const [, forceRamRender] = useState(0)

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

  const loadSnapshots = useCallback(async () => {
    if (!project.path) return
    setSnapshotsLoading(true)
    try {
      const items = await api.snapshots.list(project.path)
      setSnapshots(items)
    } catch {
      setSnapshots([])
    } finally {
      setSnapshotsLoading(false)
    }
  }, [project.path])

  useEffect(() => {
    void loadGraph(scope)
  }, [loadGraph, scope])

  useEffect(() => {
    void loadSnapshots()
  }, [loadSnapshots])

  useEffect(() => {
    setSelected(null)
    setPendingRollback(null)
  }, [project.id])

  useEffect(() => {
    let prevSavedAt = editorBuffer.getLastSavedAt()
    return editorBuffer.subscribe(() => {
      forceRamRender((value) => value + 1)
      const curSavedAt = editorBuffer.getLastSavedAt()
      if (curSavedAt && curSavedAt !== prevSavedAt) {
        prevSavedAt = curSavedAt
        void loadSnapshots()
      }
    })
  }, [loadSnapshots])

  const undoHistory = editorBuffer.getUndoHistory()
  const redoHistory = editorBuffer.getRedoHistory()
  const dirtyFiles = editorBuffer.getDirtyFiles()
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

  const handleSaveRam = async () => {
    const ok = await editorBuffer.saveAllDirtyFiles((message) => toastRef.current('info', message))
    toastRef.current(
      ok ? 'ok' : 'err',
      ok ? 'Đã lưu toàn bộ thay đổi RAM xuống đĩa.' : 'Một số tệp chưa lưu được xuống đĩa.',
    )
    await loadSnapshots()
  }

  const handleRestoreSnapshot = async (snap: BackupSnapshot) => {
    if (!snap.originalPath || restoringSnapId) return
    const confirmed = window.confirm(
      `Khôi phục tệp “${snap.relativePath}” về bản sao lưu lúc ${formatTime(snap.createdAt)}?`,
    )
    if (!confirmed) return
    setRestoringSnapId(snap.id)
    try {
      const res = await api.snapshots.restore(project.path, snap.backupPath, snap.originalPath)
      if (!res.success) {
        toastRef.current('err', `Không khôi phục được snapshot: ${res.error ?? 'lỗi không rõ'}`)
        return
      }
      toastRef.current('ok', `Đã khôi phục “${snap.relativePath}” từ bản sao lưu.`)
      await loadSnapshots()
      onRefresh()
    } catch (error) {
      toastRef.current('err', `Không khôi phục được snapshot: ${errorText(error)}`)
    } finally {
      setRestoringSnapId(null)
    }
  }

  const handleClearSnapshots = async () => {
    if (snapshots.length === 0) return
    if (!window.confirm('Xoá toàn bộ bản sao lưu trong .pixelmind/backups/?')) return
    const ok = await api.snapshots.clear(project.path)
    if (ok) {
      setSnapshots([])
      toastRef.current('info', 'Đã dọn sạch .pixelmind/backups/.')
    }
  }

  const handleUndoTo = (actionId: string, description: string, newerCount: number) => {
    if (newerCount <= 0) return
    const confirmed = window.confirm(
      `Hoàn tác ${newerCount} thao tác để quay về mốc “${description}”?`,
    )
    if (!confirmed) return
    const count = editorBuffer.undoTo(actionId)
    toastRef.current('ok', `Đã hoàn tác ${count} thao tác trong RAM.`)
  }

  const handleRedoTo = (actionId: string, description: string) => {
    const count = editorBuffer.redoTo(actionId)
    toastRef.current('ok', `Đã làm lại ${count} thao tác: ${description}`)
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
      // `reset --hard` đã bỏ thay đổi tracked trên đĩa; xoá luôn checkpoint RAM
      // để nội dung cũ không bị ghi đè trở lại khi lưu tệp.
      const hadRamChanges = dirtyFiles.length > 0 || undoHistory.length > 0
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
          <History size={13} />
          <b>Mốc RAM</b>
          <span className="chip">{undoHistory.length}</span>
          <span className="pm-grow" />
          {dirtyFiles.length > 0 && (
            <button type="button" className="btn sm" onClick={() => void handleSaveRam()}>
              <Save size={11} /> Lưu {dirtyFiles.length} tệp
            </button>
          )}
        </div>

        {undoHistory.length === 0 && redoHistory.length === 0 ? (
          <div className="pm-versions-empty">
            <p className="pm-hint">
              Chưa có thao tác nào trong RAM. Thay đổi trên canvas sẽ xuất hiện ở đây.
            </p>
          </div>
        ) : (
          <div className="pm-timeline pm-timeline--versions">
            {redoHistory
              .slice()
              .reverse()
              .map((action) => (
                <div key={action.id} className="pm-timeline-item pm-timeline-item--redo">
                  <span className="pm-timeline-title">{action.description}</span>
                  <span className="pm-timeline-meta">
                    {formatTime(action.timestamp)} · đã hoàn tác
                  </span>
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() => handleRedoTo(action.id, action.description)}
                  >
                    <Redo2 size={11} /> Làm lại
                  </button>
                </div>
              ))}
            {undoHistory
              .slice()
              .reverse()
              .map((action, reverseIndex) => (
                <div key={action.id} className="pm-timeline-item">
                  <span className="pm-timeline-title">{action.description}</span>
                  <span className="pm-timeline-meta">
                    {formatTime(action.timestamp)} · {action.sourceLoc?.filePath ?? action.type}
                  </span>
                  {reverseIndex > 0 && (
                    <button
                      type="button"
                      className="btn sm ghost"
                      onClick={() => handleUndoTo(action.id, action.description, reverseIndex)}
                    >
                      <Undo2 size={11} /> Quay về mốc
                    </button>
                  )}
                </div>
              ))}
            <div className="pm-timeline-item pm-timeline-item--base">
              <span className="pm-timeline-title">Bắt đầu phiên làm việc</span>
              <span className="pm-timeline-meta">Trạng thái gốc trong RAM</span>
            </div>
          </div>
        )}

        {dirtyFiles.length > 0 && (
          <div className="pm-versions-dirty">
            <Save size={11} />
            <span>
              {dirtyFiles.length} tệp đang sửa trong RAM:{' '}
              {dirtyFiles
                .slice(0, 3)
                .map((file) => file.filePath)
                .join(', ')}
              {dirtyFiles.length > 3 ? '…' : ''}
            </span>
          </div>
        )}
      </div>

      {/* ── Snapshot sao lưu định kỳ (.pixelmind/backups/) ── */}
      <div className="pm-versions-section">
        <div className="pm-versions-section__hd">
          <ArchiveRestore size={13} />
          <b>Snapshot sao lưu</b>
          <span className="chip">{snapshots.length}</span>
          <span className="pm-grow" />
          <button
            type="button"
            className="pm-ibtn"
            onClick={() => void loadSnapshots()}
            disabled={snapshotsLoading}
            title="Làm mới danh sách .pixelmind/backups/"
          >
            <RefreshCw size={11} className={snapshotsLoading ? 'pm-spin' : ''} />
          </button>
          {snapshots.length > 0 && (
            <button
              type="button"
              className="pm-ibtn"
              onClick={() => void handleClearSnapshots()}
              title="Dọn sạch thư mục .pixelmind/backups/"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>

        {snapshots.length === 0 ? (
          <div className="pm-versions-empty">
            <p className="pm-hint">
              Chưa có snapshot nào trong <code>.pixelmind/backups/</code>. Mỗi lần tự lưu hoặc lưu
              thủ công sẽ tạo bản dự phòng tại đây.
            </p>
          </div>
        ) : (
          <div className="pm-snapshots-list">
            {snapshots.slice(0, 10).map((snap) => (
              <div key={snap.id} className="pm-snapshot-item">
                <div className="pm-snapshot-item__info">
                  <div className="pm-snapshot-item__name" title={snap.originalPath || snap.fileName}>
                    {snap.relativePath}
                  </div>
                  <div className="pm-snapshot-item__meta">
                    <span>{formatTime(snap.createdAt)}</span>
                    <span>·</span>
                    <span>{formatBytes(snap.size)}</span>
                    <span>·</span>
                    <span className="pm-snapshot-item__reason">
                      {snap.reason === 'auto-save'
                        ? 'Auto-Save'
                        : snap.reason === 'toolbox'
                          ? 'Toolbox'
                          : snap.reason === 'code-sync'
                            ? 'Code Sync'
                            : 'Lưu tay'}
                    </span>
                  </div>
                </div>
                {snap.originalPath && (
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() => void handleRestoreSnapshot(snap)}
                    disabled={restoringSnapId === snap.id}
                    title={`Khôi phục ${snap.relativePath} về bản lúc ${formatTime(snap.createdAt)}`}
                  >
                    {restoringSnapId === snap.id ? (
                      <Loader2 size={11} className="pm-spin" />
                    ) : (
                      <Undo2 size={11} />
                    )}
                    <span>Khôi phục</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
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
