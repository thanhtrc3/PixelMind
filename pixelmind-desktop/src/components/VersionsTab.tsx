import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowUp,
  Check,
  ChevronDown,
  Download,
  FileCode2,
  GitBranch,
  History,
  Loader2,
  Minus,
  Plus,
  Redo2,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  TriangleAlert,
  Undo2,
  Upload,
  X,
} from 'lucide-react'
import type {
  FileNode,
  GitBranchItem,
  GitCommit,
  GitFileChange,
  GitGraphData,
  GitGraphScope,
  GitWorkingTreeStatus,
  ProjectRecord,
} from '@shared/types'
import { api, isDesktop } from '../lib/bridge'
import { editorBuffer } from '../lib/editorBuffer'
import { formatTime } from '../lib/format'
import GitGraphView from './GitGraphView'
import Modal from './Modal'
import PublishRemoteDialog from './ide/PublishRemoteDialog'

interface VersionsTabProps {
  project: ProjectRecord
  branch: string | null
  onSelectFile?: (node: FileNode, initialLine?: number) => void
  onRefresh: () => void
  onShowToast: (kind: 'ok' | 'err' | 'info', text: string) => void
}

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : typeof error === 'string' ? error : 'Lỗi không xác định.'

const VersionsTab = ({
  project,
  branch,
  onSelectFile,
  onRefresh,
  onShowToast,
}: VersionsTabProps) => {
  const [scope, setScope] = useState<GitGraphScope>('all')
  const [graph, setGraph] = useState<GitGraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [selected, setSelected] = useState<GitCommit | null>(null)
  const [popoverCommit, setPopoverCommit] = useState<{
    commit: GitCommit
    x: number
    y: number
  } | null>(null)
  const [pendingRollback, setPendingRollback] = useState<GitCommit | null>(null)
  const [rollingBack, setRollingBack] = useState(false)
  const [, forceRamRender] = useState(0)

  // ── Trạng thái Git Status & Working Tree ───────────────────
  const [gitStatus, setGitStatus] = useState<GitWorkingTreeStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusBusy, setStatusBusy] = useState(false)
  const [commitMsg, setCommitMsg] = useState('')
  const [committing, setCommitting] = useState(false)
  const [generatingMsg, setGeneratingMsg] = useState(false)

  // ── Trạng thái Commit & Push Split Button ─────────────────
  const [commitMenuOpen, setCommitMenuOpen] = useState(false)
  const [commitAction, setCommitAction] = useState<'commit' | 'commit_push'>('commit')

  // ── Trạng thái Quản lý Nhánh (Branches) ───────────────────
  const [branches, setBranches] = useState<GitBranchItem[]>([])
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false)
  const [newBranchOpen, setNewBranchOpen] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [switchingBranch, setSwitchingBranch] = useState(false)
  const [branchFilter, setBranchFilter] = useState('')

  const [discardTarget, setDiscardTarget] = useState<GitFileChange | null>(null)
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)

  const toastRef = useRef(onShowToast)
  toastRef.current = onShowToast

  const isGitApiAvailable =
    typeof api.projects.gitCreateBranch === 'function' &&
    typeof api.projects.gitStatus === 'function'

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

  const loadStatus = useCallback(async () => {
    setStatusLoading(true)
    try {
      if (typeof api.projects.gitStatus !== 'function') {
        setGitStatus(null)
        return
      }
      const status = await api.projects.gitStatus(project.id)
      setGitStatus(status)
    } catch {
      setGitStatus(null)
    } finally {
      setStatusLoading(false)
    }
  }, [project.id])

  const loadBranches = useCallback(async () => {
    try {
      if (typeof api.projects.gitBranches !== 'function') {
        setBranches([])
        return
      }
      const list = await api.projects.gitBranches(project.id)
      setBranches(list)
    } catch {
      setBranches([])
    }
  }, [project.id])

  const refreshAll = useCallback(async () => {
    await Promise.all([loadGraph(scope), loadStatus(), loadBranches()])
  }, [loadGraph, loadStatus, loadBranches, scope])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  useEffect(() => {
    setSelected(null)
    setPopoverCommit(null)
    setPendingRollback(null)
    setBranchDropdownOpen(false)
    setNewBranchOpen(false)
    setNewBranchName('')
    setCommitMenuOpen(false)
  }, [project.id])

  useEffect(() => {
    if (!popoverCommit) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setPopoverCommit(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [popoverCommit])

  useEffect(() => {
    return editorBuffer.subscribe(() => {
      forceRamRender((value) => value + 1)
    })
  }, [])

  const undoHistory = editorBuffer.getUndoHistory()
  const redoHistory = editorBuffer.getRedoHistory()
  const dirtyFiles = editorBuffer.getDirtyFiles()
  const headCommit = graph?.commits.find((commit) => commit.isHead) ?? null
  const currentBranch = gitStatus?.branch ?? graph?.branch ?? branch

  /* ── Thao tác Push & Pull ───────────────────────────────── */

  const handlePush = async (setUpstream = false) => {
    if (pushing) return
    if (typeof api.projects.gitPush !== 'function') {
      toastRef.current(
        'err',
        'Cần khởi động lại app: Đóng PixelMind và chạy lại "npm run dev" để nạp tính năng Push.',
      )
      return
    }

    setPushing(true)
    try {
      const res = await api.projects.gitPush(project.id, setUpstream)
      if (!res.ok) {
        if (res.noRemote || res.error?.includes('chưa cấu hình remote repository')) {
          setPublishDialogOpen(true)
          return
        }
        toastRef.current('err', `Push thất bại: ${res.error || 'không rõ lỗi'}`)
        return
      }
      toastRef.current('ok', 'Đã đẩy thay đổi lên GitHub thành công (git push)!')
      await refreshAll()
      onRefresh()
    } catch (err) {
      toastRef.current('err', `Lỗi khi push: ${errorText(err)}`)
    } finally {
      setPushing(false)
    }
  }

  const handlePullAndSync = async () => {
    if (pushing || fetching) return
    setFetching(true)
    try {
      if (typeof api.projects.gitPull === 'function') {
        const pullRes = await api.projects.gitPull(project.id)
        if (!pullRes.ok) {
          toastRef.current('err', `Pull thất bại: ${pullRes.error || 'không rõ lỗi'}`)
          return
        }
      }
      await handlePush(false)
    } finally {
      setFetching(false)
    }
  }

  /* ── Tự động tạo Commit Message ─────────────────────────── */

  const handleGenerateMessage = async () => {
    const allFiles = [...stagedFiles, ...allChanges]
    if (allFiles.length === 0) {
      toastRef.current('info', 'Không có tệp thay đổi nào để tạo thông điệp.')
      return
    }
    setGeneratingMsg(true)
    try {
      const names = allFiles.map((f) => f.path.split(/[\\/]/).pop() || f.path)
      const exts = Array.from(new Set(allFiles.map((f) => f.path.split('.').pop() || '')))
      let prefix = 'feat'
      if (allFiles.every((f) => f.status === 'deleted')) prefix = 'chore(clean)'
      else if (exts.every((e) => ['css', 'scss', 'less'].includes(e))) prefix = 'style(ui)'
      else if (exts.every((e) => ['md', 'txt'].includes(e))) prefix = 'docs'
      else if (allFiles.some((f) => f.path.includes('fix') || f.path.includes('error'))) prefix = 'fix'

      let msg = ''
      if (names.length === 1) {
        msg = `${prefix}: cập nhật ${names[0]}`
      } else if (names.length <= 3) {
        msg = `${prefix}: cập nhật ${names.join(', ')}`
      } else {
        msg = `${prefix}: cập nhật ${names.slice(0, 2).join(', ')} và ${names.length - 2} tệp khác`
      }
      setCommitMsg(msg)
      toastRef.current('ok', 'Đã tạo gợi ý thông điệp commit!')
    } finally {
      setGeneratingMsg(false)
    }
  }

  /* ── Thao tác Staging / Discard / Commit ─────────────────── */

  const handleStage = async (paths: string[]) => {
    if (statusBusy) return
    if (!isGitApiAvailable) {
      toastRef.current(
        'err',
        'Cần khởi động lại ứng dụng: Vui lòng đóng PixelMind và chạy lại "npm run dev" để nạp tính năng Git mới.',
      )
      return
    }
    setStatusBusy(true)
    try {
      const res = await api.projects.gitStage(project.id, paths)
      if (!res.ok) {
        toastRef.current('err', `Lỗi đưa vào staging: ${res.error || 'không rõ'}`)
      } else {
        await loadStatus()
      }
    } catch (err) {
      toastRef.current('err', `Lỗi đưa vào staging: ${errorText(err)}`)
    } finally {
      setStatusBusy(false)
    }
  }

  const handleUnstage = async (paths: string[]) => {
    if (statusBusy) return
    if (!isGitApiAvailable) {
      toastRef.current(
        'err',
        'Cần khởi động lại ứng dụng: Vui lòng đóng PixelMind và chạy lại "npm run dev" để nạp tính năng Git mới.',
      )
      return
    }
    setStatusBusy(true)
    try {
      const res = await api.projects.gitUnstage(project.id, paths)
      if (!res.ok) {
        toastRef.current('err', `Lỗi bỏ khỏi staging: ${res.error || 'không rõ'}`)
      } else {
        await loadStatus()
      }
    } catch (err) {
      toastRef.current('err', `Lỗi bỏ khỏi staging: ${errorText(err)}`)
    } finally {
      setStatusBusy(false)
    }
  }

  const handleDiscard = async (item: GitFileChange) => {
    if (!isGitApiAvailable) {
      toastRef.current(
        'err',
        'Cần khởi động lại ứng dụng: Vui lòng đóng PixelMind và chạy lại "npm run dev" để nạp tính năng Git mới.',
      )
      return
    }
    setStatusBusy(true)
    try {
      const res = await api.projects.gitDiscard(project.id, [item.path])
      if (!res.ok) {
        toastRef.current('err', `Lỗi hoàn tác: ${res.error || 'không rõ'}`)
      } else {
        toastRef.current('ok', `Đã hoàn tác thay đổi của tệp: ${item.path}`)
        await loadStatus()
        onRefresh()
      }
    } catch (err) {
      toastRef.current('err', `Lỗi hoàn tác: ${errorText(err)}`)
    } finally {
      setStatusBusy(false)
      setDiscardTarget(null)
    }
  }

  const handleCommit = async (andPush = false) => {
    const trimmed = commitMsg.trim()
    if (!trimmed) {
      toastRef.current('info', 'Vui lòng nhập thông điệp commit.')
      return
    }

    const stagedCount = gitStatus?.staged.length ?? 0
    const unstagedCount = (gitStatus?.unstaged.length ?? 0) + (gitStatus?.untracked.length ?? 0)

    if (stagedCount === 0 && unstagedCount === 0) {
      toastRef.current('info', 'Không có thay đổi nào để commit.')
      return
    }

    if (!isGitApiAvailable) {
      toastRef.current(
        'err',
        'Cần khởi động lại ứng dụng: Vui lòng đóng PixelMind và chạy lại "npm run dev" để nạp tính năng Git mới.',
      )
      return
    }

    setCommitting(true)
    try {
      if (stagedCount === 0 && unstagedCount > 0) {
        const stageRes = await api.projects.gitStage(project.id, ['.'])
        if (!stageRes.ok) {
          toastRef.current('err', `Lỗi chuẩn bị tệp: ${stageRes.error || 'không rõ'}`)
          setCommitting(false)
          return
        }
      }

      const res = await api.projects.gitCommit(project.id, trimmed)
      if (!res.ok) {
        toastRef.current('err', `Commit thất bại: ${res.error || 'không rõ lỗi'}`)
        return
      }

      toastRef.current('ok', `Đã tạo commit thành công! (${res.hash ? res.hash.slice(0, 7) : ''})`)
      setCommitMsg('')
      await refreshAll()
      onRefresh()

      if (andPush) {
        toastRef.current('info', 'Đang đẩy thay đổi lên GitHub (git push)...')
        await handlePush(true)
      }
    } catch (err) {
      toastRef.current('err', `Lỗi tạo commit: ${errorText(err)}`)
    } finally {
      setCommitting(false)
    }
  }

  /* ── Thao tác Nhánh ─────────────────────────────────────── */

  const handleCheckout = async (targetBranch: string) => {
    if (switchingBranch || targetBranch === currentBranch) return
    if (gitStatus && !gitStatus.clean) {
      const confirmSwitch = window.confirm(
        `Bạn đang có thay đổi chưa commit. Bạn có chắc chắn muốn chuyển sang nhánh “${targetBranch}”?`,
      )
      if (!confirmSwitch) return
    }

    if (!isGitApiAvailable) {
      toastRef.current(
        'err',
        'Cần khởi động lại ứng dụng: Vui lòng đóng PixelMind và chạy lại "npm run dev" để nạp tính năng Git mới.',
      )
      return
    }

    setSwitchingBranch(true)
    try {
      const res = await api.projects.gitCheckout(project.id, targetBranch)
      if (!res.ok) {
        toastRef.current('err', `Không chuyển được nhánh: ${res.error || 'không rõ lỗi'}`)
        return
      }
      toastRef.current('ok', `Đã chuyển sang nhánh “${targetBranch}”.`)
      setBranchDropdownOpen(false)
      await refreshAll()
      onRefresh()
    } catch (err) {
      toastRef.current('err', `Lỗi chuyển nhánh: ${errorText(err)}`)
    } finally {
      setSwitchingBranch(false)
    }
  }

  const handleCreateBranch = async () => {
    const trimmed = newBranchName.trim()
    if (!trimmed) {
      toastRef.current('info', 'Vui lòng nhập tên nhánh mới.')
      return
    }

    if (!isGitApiAvailable) {
      toastRef.current(
        'err',
        'Cần khởi động lại app: Đóng PixelMind và chạy lại "npm run dev" (hoặc bấm Ctrl+Shift+R) để nạp tính năng tạo nhánh.',
      )
      return
    }

    setSwitchingBranch(true)
    try {
      const res = await api.projects.gitCreateBranch(project.id, trimmed, true)
      if (!res.ok) {
        toastRef.current('err', `Không tạo được nhánh: ${res.error || 'không rõ lỗi'}`)
        return
      }
      toastRef.current('ok', `Đã tạo và chuyển sang nhánh “${trimmed}”.`)
      setNewBranchOpen(false)
      setNewBranchName('')
      setBranchDropdownOpen(false)
      await refreshAll()
      onRefresh()
    } catch (err) {
      toastRef.current('err', `Lỗi tạo nhánh: ${errorText(err)}`)
    } finally {
      setSwitchingBranch(false)
    }
  }

  /* ── Thao tác Fetch / Rollback / RAM ────────────────────── */

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
      await refreshAll()
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
    await loadStatus()
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
      setPopoverCommit(null)
      await refreshAll()
      onRefresh()
    } catch (error) {
      toastRef.current('err', `Không khôi phục được commit: ${errorText(error)}`)
    } finally {
      setRollingBack(false)
    }
  }

  const openFileInEditor = (relativePath: string) => {
    if (!onSelectFile) return
    const fileName = relativePath.split(/[\\/]/).pop() || ''
    const fileExt = fileName.split('.').pop() || ''
    const fullPath = `${project.path}/${relativePath}`.replace(/\\/g, '/')
    onSelectFile({
      path: fullPath,
      name: fileName,
      ext: fileExt,
      type: 'file',
      size: 0,
    })
  }

  const stagedFiles = gitStatus?.staged ?? []
  const unstagedFiles = gitStatus?.unstaged ?? []
  const untrackedFiles = gitStatus?.untracked ?? []
  const allChanges = [...unstagedFiles, ...untrackedFiles]

  const filteredBranches = branches.filter((b) =>
    b.name.toLowerCase().includes(branchFilter.toLowerCase()),
  )

  return (
    <div className="pm-versions-tab">
      {!isGitApiAvailable && (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 6,
            background: 'rgba(234, 179, 8, 0.15)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            color: 'var(--yellow, #eab308)',
            fontSize: 11,
            lineHeight: 1.4,
          }}
        >
          <b>⚠️ Cần khởi động lại ứng dụng:</b>
          <div style={{ marginTop: 2, color: 'var(--text)' }}>
            Tiến trình Electron đang chạy từ phiên bản cũ chưa nạp API Git mới. Bạn hãy đóng cửa sổ
            PixelMind và chạy lại <code>npm run dev</code> trong terminal (hoặc bấm{' '}
            <code>Ctrl+Shift+R</code>) để kích hoạt tạo nhánh & commit.
          </div>
        </div>
      )}

      {/* ── CARD NHÁNH & THAO TÁC ĐỒNG BỘ ─────────────────────── */}
      <div className="pm-version-branch-card">
        <GitBranch size={14} style={{ color: 'var(--accent)', marginTop: 2 }} />
        <div className="pm-grow" style={{ minWidth: 0, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className="pm-git-branch-btn"
              onClick={() => setBranchDropdownOpen((v) => !v)}
              title="Nhấp để chuyển nhánh hoặc tạo nhánh mới"
            >
              <span className="pm-git-branch-name">{currentBranch || '—'}</span>
              <ChevronDown size={11} className={branchDropdownOpen ? 'pm-rotate-180' : ''} />
            </button>
            <button
              type="button"
              className="pm-ibtn"
              onClick={() => setNewBranchOpen(true)}
              title="Tạo nhánh mới từ nhánh hiện tại"
              style={{ width: 22, height: 22 }}
            >
              <Plus size={12} />
            </button>
          </div>

          <div className="pm-version-branch-card__meta">
            {headCommit ? `${headCommit.shortHash} · ${headCommit.subject}` : 'Chưa có commit nào'}
            {gitStatus && (gitStatus.ahead > 0 || gitStatus.behind > 0) ? (
              <span style={{ color: 'var(--accent)', marginLeft: 4 }}>
                ({gitStatus.ahead > 0 ? `↑${gitStatus.ahead}` : ''}
                {gitStatus.behind > 0 ? `↓${gitStatus.behind}` : ''})
              </span>
            ) : null}
          </div>
          <div className="pm-version-branch-card__meta">
            {project.meta.repo || 'Chưa cấu hình remote GitHub'}
            {graph && !graph.hasRemote ? ' · không có remote' : ''}
          </div>

          {/* DROPDOWN DANH SÁCH NHÁNH */}
          {branchDropdownOpen && (
            <div className="pm-git-branch-menu">
              <div className="pm-git-branch-menu__hd">
                <input
                  type="text"
                  placeholder="Lọc nhánh..."
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="pm-input pm-input--sm"
                  autoFocus
                />
              </div>
              <div className="pm-git-branch-menu__list">
                {filteredBranches.length === 0 ? (
                  <div className="pm-muted" style={{ padding: '8px 10px', fontSize: 11 }}>
                    Không tìm thấy nhánh phù hợp.
                  </div>
                ) : (
                  filteredBranches.map((b) => (
                    <div
                      key={b.name}
                      className={`pm-git-branch-menu__item ${b.current ? 'current' : ''}`}
                      onClick={() => void handleCheckout(b.name)}
                    >
                      <GitBranch size={12} className="pm-muted" />
                      <span className="pm-git-branch-menu__name">{b.name}</span>
                      {b.current && <Check size={12} className="pm-accent" />}
                      {b.remote && (
                        <span className="chip" style={{ fontSize: 9, padding: '0 4px' }}>
                          remote
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* NÚT PUSH LÊN GITHUB */}
        <button
          type="button"
          className="pm-ibtn"
          onClick={() => {
            if (!graph?.hasRemote) setPublishDialogOpen(true)
            else void handlePush(false)
          }}
          disabled={pushing}
          title={graph?.hasRemote ? 'Đẩy lên GitHub (git push)' : 'Chưa có remote — bấm để liên kết GitHub (Publish)'}
        >
          {pushing ? <Loader2 size={12} className="pm-spin" /> : <Upload size={12} />}
        </button>

        {/* NÚT FETCH TỪ GITHUB */}
        <button
          type="button"
          className="pm-ibtn"
          onClick={() => void handleFetch()}
          disabled={!graph?.hasRemote || fetching}
          title="Đồng bộ GitHub (git fetch --all --prune)"
        >
          {fetching ? <Loader2 size={12} className="pm-spin" /> : <Download size={12} />}
        </button>

        {/* NÚT REFRESH TẤT CẢ */}
        <button
          type="button"
          className="pm-ibtn"
          onClick={() => void refreshAll()}
          disabled={loading || statusLoading}
          title="Tải lại trạng thái Git & Commit"
        >
          <RefreshCw size={12} className={loading || statusLoading ? 'pm-spin' : ''} />
        </button>
      </div>

      {/* MODAL TẠO NHÁNH MỚI */}
      {newBranchOpen && (
        <Modal
          title="Tạo nhánh Git mới"
          subtitle={`Tách từ nhánh hiện tại: ${currentBranch || 'HEAD'}`}
          icon={<GitBranch size={16} />}
          width={380}
          onClose={() => setNewBranchOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn"
                onClick={() => setNewBranchOpen(false)}
                disabled={switchingBranch}
              >
                Huỷ
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => void handleCreateBranch()}
                disabled={switchingBranch || !newBranchName.trim()}
              >
                {switchingBranch ? <Loader2 size={12} className="pm-spin" /> : <Plus size={12} />} Tạo
                & Chuyển sang
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 11, color: 'var(--text-2)' }}>Tên nhánh mới:</label>
            <input
              type="text"
              className="pm-input"
              placeholder="ví dụ: feature/new-navbar, fix-bug-123"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreateBranch()
              }}
              autoFocus
            />
            <p className="pm-hint" style={{ fontSize: 10 }}>
              Không chứa khoảng trắng. Ký tự hợp lệ gồm chữ cái, số, gạch ngang, gạch dưới và dấu
              chấm.
            </p>
          </div>
        </Modal>
      )}

      {/* ── KHU VỰC WORKING TREE STATUS & STAGING ──────────────── */}
      <div className="pm-versions-section">
        <div className="pm-versions-section__hd">
          <FileCode2 size={13} />
          <b>Thay đổi mã nguồn (Working Tree)</b>
          <span className="chip">{stagedFiles.length + allChanges.length}</span>
          <span className="pm-grow" />
        </div>

        {/* KHUNG COMMIT & PUSH (THEO MẪU VS CODE) */}
        {(stagedFiles.length > 0 || allChanges.length > 0 || (gitStatus?.ahead ?? 0) > 0) && (
          <div className="pm-git-commit-box">
            {(stagedFiles.length > 0 || allChanges.length > 0) && (
              <div style={{ position: 'relative' }}>
                <textarea
                  className="pm-git-commit-input"
                  rows={2}
                  placeholder="Thông điệp commit (Ctrl+Enter để commit)..."
                  value={commitMsg}
                  onChange={(e) => setCommitMsg(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault()
                      if (commitAction === 'commit_push') void handleCommit(true)
                      else void handleCommit(false)
                    }
                  }}
                />
                <button
                  type="button"
                  className="pm-git-generate-btn"
                  onClick={() => void handleGenerateMessage()}
                  disabled={generatingMsg}
                  title="Tự động tạo thông điệp commit dựa trên các thay đổi (Conventional Commits)"
                >
                  {generatingMsg ? (
                    <Loader2 size={11} className="pm-spin" />
                  ) : (
                    <Sparkles size={11} />
                  )}
                  <span>Generate</span>
                </button>
              </div>
            )}

            {/* SPLIT BUTTON: COMMIT / COMMIT & PUSH / PUSH */}
            <div className="pm-git-split-container">
              {stagedFiles.length === 0 && allChanges.length === 0 && (gitStatus?.ahead ?? 0) > 0 ? (
                /* Đã commit hết, còn commit chưa push */
                <button
                  type="button"
                  className="btn sm primary"
                  onClick={() => {
                    if (!graph?.hasRemote) setPublishDialogOpen(true)
                    else void handlePush(false)
                  }}
                  disabled={pushing}
                  style={{ width: '100%', justifyContent: 'center', height: 28 }}
                >
                  {pushing ? <Loader2 size={12} className="pm-spin" /> : <Upload size={12} />}
                  <span>
                    {!graph?.hasRemote
                      ? `Xuất bản lên GitHub (Publish ${gitStatus?.ahead ?? 0} commit)`
                      : `Đẩy ${gitStatus?.ahead ?? 0} commit lên GitHub (Push)`}
                  </span>
                </button>
              ) : (
                <div className="pm-git-split-btn-group">
                  <button
                    type="button"
                    className="btn sm primary pm-git-split-main"
                    onClick={() => {
                      if (commitAction === 'commit_push') void handleCommit(true)
                      else void handleCommit(false)
                    }}
                    disabled={committing || pushing || statusBusy || !commitMsg.trim()}
                  >
                    {committing || pushing ? (
                      <Loader2 size={11} className="pm-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                    <span>
                      {commitAction === 'commit_push' ? 'Commit & Push' : 'Commit'}
                      {stagedFiles.length > 0
                        ? ` (${stagedFiles.length} tệp)`
                        : ` (${allChanges.length} tệp)`}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="btn sm primary pm-git-split-arrow"
                    onClick={() => setCommitMenuOpen((v) => !v)}
                    title="Tuỳ chọn Commit & Push"
                    disabled={committing || pushing}
                  >
                    <ChevronDown size={11} className={commitMenuOpen ? 'pm-rotate-180' : ''} />
                  </button>

                  {commitMenuOpen && (
                    <div className="pm-git-commit-menu">
                      <div
                        className={`pm-git-commit-menu-item ${commitAction === 'commit' ? 'active' : ''}`}
                        onClick={() => {
                          setCommitAction('commit')
                          setCommitMenuOpen(false)
                        }}
                      >
                        <Check size={12} />
                        <span>Commit (Chỉ lưu cục bộ)</span>
                      </div>
                      <div
                        className={`pm-git-commit-menu-item ${commitAction === 'commit_push' ? 'active' : ''}`}
                        onClick={() => {
                          setCommitAction('commit_push')
                          setCommitMenuOpen(false)
                        }}
                      >
                        <Upload size={12} />
                        <span>Commit & Push (Lưu và đẩy lên GitHub)</span>
                      </div>
                      <div className="pm-file-context-menu__divider" />
                      <div
                        className="pm-git-commit-menu-item"
                        onClick={() => {
                          setCommitMenuOpen(false)
                          if (!graph?.hasRemote) setPublishDialogOpen(true)
                          else void handlePush(false)
                        }}
                      >
                        <ArrowUp size={12} />
                        <span>
                          {!graph?.hasRemote
                            ? 'Xuất bản lên GitHub (Publish)'
                            : 'Push (Đẩy các commit lên GitHub)'}
                        </span>
                      </div>
                      <div
                        className="pm-git-commit-menu-item"
                        onClick={() => {
                          setCommitMenuOpen(false)
                          void handlePullAndSync()
                        }}
                      >
                        <RefreshCw size={12} />
                        <span>Sync (Pull & Push)</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* DANH SÁCH TỆP ĐÃ STAGED */}
        {stagedFiles.length > 0 && (
          <div className="pm-git-file-group">
            <div className="pm-git-group-hd">
              <span className="pm-git-group-title">Đã chuẩn bị (Staged Changes)</span>
              <span className="chip" style={{ fontSize: 9 }}>
                {stagedFiles.length}
              </span>
              <span className="pm-grow" />
              <button
                type="button"
                className="pm-git-tool-btn"
                onClick={() => void handleUnstage(['.'])}
                title="Bỏ chuẩn bị tất cả (Unstage all)"
                disabled={statusBusy}
              >
                <Minus size={11} /> Bỏ tất cả
              </button>
            </div>
            <div className="pm-git-file-list">
              {stagedFiles.map((file) => {
                const parts = file.path.split(/[\\/]/)
                const name = parts[parts.length - 1]
                const dir = parts.slice(0, -1).join('/')
                return (
                  <div
                    key={`staged-${file.path}`}
                    className="pm-git-file-row"
                    onClick={() => openFileInEditor(file.path)}
                    title={file.path}
                  >
                    <span className={`pm-git-badge pm-git-badge--${file.status}`}>
                      {file.status[0].toUpperCase()}
                    </span>
                    <span className="pm-git-file-name">{name}</span>
                    <span className="pm-git-file-dir">{dir}</span>
                    <button
                      type="button"
                      className="pm-git-row-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleUnstage([file.path])
                      }}
                      title="Bỏ khỏi staging (git restore --staged)"
                      disabled={statusBusy}
                    >
                      <Minus size={11} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* DANH SÁCH TỆP CHƯA STAGED (CHANGES) */}
        {allChanges.length > 0 && (
          <div className="pm-git-file-group">
            <div className="pm-git-group-hd">
              <span className="pm-git-group-title">Thay đổi chưa chuẩn bị (Changes)</span>
              <span className="chip" style={{ fontSize: 9 }}>
                {allChanges.length}
              </span>
              <span className="pm-grow" />
              <button
                type="button"
                className="pm-git-tool-btn"
                onClick={() => void handleStage(['.'])}
                title="Chuẩn bị tất cả (Stage all)"
                disabled={statusBusy}
              >
                <Plus size={11} /> Chuẩn bị tất cả
              </button>
            </div>
            <div className="pm-git-file-list">
              {allChanges.map((file) => {
                const parts = file.path.split(/[\\/]/)
                const name = parts[parts.length - 1]
                const dir = parts.slice(0, -1).join('/')
                return (
                  <div
                    key={`change-${file.path}`}
                    className="pm-git-file-row"
                    onClick={() => openFileInEditor(file.path)}
                    title={file.path}
                  >
                    <span className={`pm-git-badge pm-git-badge--${file.status}`}>
                      {file.status === 'untracked' ? 'U' : file.status[0].toUpperCase()}
                    </span>
                    <span className="pm-git-file-name">{name}</span>
                    <span className="pm-git-file-dir">{dir}</span>
                    <button
                      type="button"
                      className="pm-git-row-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleStage([file.path])
                      }}
                      title="Đưa vào staging (git add)"
                      disabled={statusBusy}
                    >
                      <Plus size={11} />
                    </button>
                    <button
                      type="button"
                      className="pm-git-row-btn danger"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDiscardTarget(file)
                      }}
                      title={
                        file.status === 'untracked'
                          ? 'Xoá tệp chưa theo dõi'
                          : 'Hoàn tác thay đổi (git restore)'
                      }
                      disabled={statusBusy}
                    >
                      <RotateCcw size={11} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* THÔNG BÁO KHI WORKING TREE SẠCH */}
        {gitStatus?.clean && stagedFiles.length === 0 && allChanges.length === 0 && (
          <div className="pm-versions-clean">
            <Check size={13} style={{ color: 'var(--green, #22c55e)' }} />
            <span>Working tree sạch, không có thay đổi nào chưa commit.</span>
          </div>
        )}
      </div>

      {/* CONFIRM HOÀN TÁC THAY ĐỔI */}
      {discardTarget && (
        <Modal
          title="Xác nhận hoàn tác thay đổi"
          subtitle={discardTarget.path}
          icon={<RotateCcw size={16} />}
          width={380}
          onClose={() => setDiscardTarget(null)}
          footer={
            <>
              <button
                type="button"
                className="btn"
                onClick={() => setDiscardTarget(null)}
                disabled={statusBusy}
              >
                Huỷ
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => void handleDiscard(discardTarget)}
                disabled={statusBusy}
              >
                {statusBusy ? <Loader2 size={12} className="pm-spin" /> : <RotateCcw size={12} />}{' '}
                {discardTarget.status === 'untracked' ? 'Xoá tệp' : 'Khôi phục'}
              </button>
            </>
          }
        >
          <p style={{ fontSize: 12, lineHeight: 1.4, margin: 0 }}>
            {discardTarget.status === 'untracked'
              ? `Tệp “${discardTarget.path}” là tệp mới chưa commit. Hành động này sẽ xoá hoàn toàn tệp này khỏi đĩa.`
              : `Mọi thay đổi chưa commit của “${discardTarget.path}” sẽ bị huỷ bỏ và khôi phục về trạng thái commit gần nhất.`}
          </p>
        </Modal>
      )}

      {/* ── KHU VỰC MỐC RAM (CHECKPOINT RAM CỦA EDITORBUFFER) ──── */}
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

      {/* ── KHU VỰC ĐỒ THỊ COMMIT THẬT (GIT GRAPH) ─────────────── */}
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
            onContextMenu={(commit, pos) => {
              setSelected(commit)
              setPopoverCommit({ commit, x: pos.x, y: pos.y })
            }}
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
      </div>

      {/* ── BẢNG CHI TIẾT COMMIT DẠNG POPOVER NỔI (KHI BẤM CHUỘT PHẢI) ── */}
      {popoverCommit &&
        createPortal(
          <>
            <div
              className="pm-git-popover-scrim"
              onClick={() => setPopoverCommit(null)}
              onContextMenu={(e) => {
                e.preventDefault()
                setPopoverCommit(null)
              }}
            />
            <div
              className="pm-git-popover-card"
              style={{
                top: Math.max(12, Math.min(window.innerHeight - 260, popoverCommit.y - 12)),
                left: Math.max(12, Math.min(window.innerWidth - 340, popoverCommit.x + 8)),
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pm-git-popover-card__hd">
                <b className="pm-git-popover-card__title" title={popoverCommit.commit.subject}>
                  {popoverCommit.commit.subject}
                </b>
                <button
                  type="button"
                  className="pm-git-popover-card__close"
                  onClick={() => setPopoverCommit(null)}
                  title="Đóng (Esc)"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="pm-git-popover-card__grid">
                <span className="pm-git-popover-card__label">Commit</span>
                <code className="pm-git-popover-card__val mono">{popoverCommit.commit.shortHash}</code>

                <span className="pm-git-popover-card__label">Tác giả</span>
                <span className="pm-git-popover-card__val">{popoverCommit.commit.author}</span>

                <span className="pm-git-popover-card__label">Thời gian</span>
                <span className="pm-git-popover-card__val">
                  {new Date(popoverCommit.commit.timestamp * 1000).toLocaleString('vi-VN')}
                </span>

                <span className="pm-git-popover-card__label">Parent</span>
                <span className="pm-git-popover-card__val mono">
                  {popoverCommit.commit.parents.length > 0
                    ? popoverCommit.commit.parents.map((p) => p.slice(0, 7)).join(', ')
                    : '—'}
                </span>
              </div>

              {popoverCommit.commit.body && (
                <pre className="pm-git-popover-card__body">{popoverCommit.commit.body}</pre>
              )}

              <button
                type="button"
                className="pm-git-popover-card__btn-rollback"
                onClick={() => {
                  const target = popoverCommit.commit
                  setPopoverCommit(null)
                  setPendingRollback(target)
                }}
                title="Khôi phục mã nguồn về trạng thái commit này (có tạo nhánh sao lưu)"
              >
                <Undo2 size={13} /> Khôi phục về commit này
              </button>
            </div>
          </>,
          document.body,
        )}

      {/* ── MODAL KHÔI PHỤC (ROLLBACK) AN TOÀN ─────────────────── */}
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

      {publishDialogOpen && (
        <PublishRemoteDialog
          projectName={project.name}
          onClose={() => setPublishDialogOpen(false)}
          onPublish={async (remoteUrl) => {
            if (!api.projects.gitSetRemote) {
              return { success: false, error: 'Chức năng cấu hình remote chỉ hỗ trợ trên bản desktop.' }
            }
            const setRes = await api.projects.gitSetRemote(project.id, remoteUrl)
            if (!setRes.ok) {
              return { success: false, error: setRes.error || 'Cấu hình remote thất bại.' }
            }
            const pushRes = await api.projects.gitPush(project.id, true)
            if (!pushRes.ok) {
              return { success: false, error: pushRes.error || 'Đã liên kết remote nhưng push thất bại.' }
            }
            toastRef.current('ok', '✨ Đã liên kết remote và đẩy mã nguồn lên GitHub thành công!')
            await refreshAll()
            onRefresh()
            return { success: true }
          }}
        />
      )}
    </div>
  )
}

export default VersionsTab
