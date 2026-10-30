import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  ClipboardList,
  Database,
  FolderKanban,
  FolderOpen,
  LayoutDashboard,
  Play,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldAlert,
  Square,
  SunMoon,
  Trash2,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import { DEFAULT_SETTINGS } from '@shared/types'
import type {
  AppInfo,
  FileContent,
  FileNode,
  ProjectPage,
  ProjectRecord,
  ProjectStat,
  RunLog,
  RunState,
  Settings,
  StoreData,
} from '@shared/types'
import { api, isDesktop } from './lib/bridge'
import { applyThemeVariables } from './lib/theme'
import { fileName } from './lib/format'
import TopBar from './components/TopBar'
import NavRail from './components/NavRail'
import ProjectView from './components/ProjectView'
import ProjectDetail from './components/ProjectDetail'
import AddPageDialog from './components/AddPageDialog'
import WorkspaceView from './components/WorkspaceView'
import StatusBar from './components/StatusBar'
import SettingsDialog from './components/SettingsDialog'
import GuideDialog from './components/GuideDialog'
import CommandPalette from './components/CommandPalette'
import type { PaletteCommand } from './components/CommandPalette'
import Modal from './components/Modal'
import ToastStack from './components/ToastStack'
import type { ToastMessage } from './components/ToastStack'
import DiagnosisDialog from './components/DiagnosisDialog'

const EMPTY_STORE: StoreData = {
  settings: { ...DEFAULT_SETTINGS },
  projects: [],
  lastProjectId: null,
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : typeof error === 'string' ? error : 'Đã xảy ra lỗi không xác định.'

type View = 'projects' | 'detail' | 'workspace'
type DialogId = 'settings' | 'guide' | 'palette'

const App = () => {
  const [storeData, setStoreData] = useState<StoreData>(EMPTY_STORE)
  const [ready, setReady] = useState(false)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [storePath, setStorePath] = useState('')

  const [view, setView] = useState<View>('projects')
  const [projectId, setProjectId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [tree, setTree] = useState<FileNode[]>([])
  const [treeLoading, setTreeLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [stats, setStats] = useState<ProjectStat | null>(null)
  const [branch, setBranch] = useState<string | null>(null)

  const [file, setFile] = useState<FileContent | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [openPaths, setOpenPaths] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'file' | 'preview'>('preview')

  const [run, setRun] = useState<RunState | null>(null)
  const [logs, setLogs] = useState<RunLog[]>([])
  const [script, setScript] = useState('')
  const [customCommand, setCustomCommand] = useState('')
  const [targetRoute, setTargetRoute] = useState<string>('')
  const targetRouteRef = useRef<string>('')
  targetRouteRef.current = targetRoute
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [dialog, setDialog] = useState<DialogId | null>(null)
  const [diagnosisOpen, setDiagnosisOpen] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [addPageOpen, setAddPageOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ProjectRecord | null>(null)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const settings = storeData.settings
  const project = useMemo(
    () => storeData.projects.find((item) => item.id === projectId) ?? null,
    [storeData.projects, projectId],
  )

  /* ── Tiện ích nhỏ ─────────────────────────────────────── */

  const showToast = (kind: ToastMessage['kind'], text: string) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev.slice(-2), { id, kind, text }])
  }

  const dismissToast = (id: number) => setToasts((prev) => prev.filter((item) => item.id !== id))

  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const lastUrlRef = useRef<string | null>(null)

  /* ── Áp dụng chủ đề / màu nhấn / cỡ chữ ───────────────── */

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
    applyThemeVariables(settings.accent, settings.fontSize)
  }, [settings.theme, settings.accent, settings.fontSize])

  const updateSettings = async (patch: Partial<Settings>) => {
    setStoreData((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }))
    try {
      const saved = await api.store.updateSettings(patch)
      setStoreData((prev) => ({ ...prev, settings: saved }))
      if (patch.showHidden !== undefined && project) await loadTree(project, patch.showHidden)
    } catch (error) {
      showToast('err', `Không lưu được cài đặt: ${errorMessage(error)}`)
    }
  }

  /* ── Đọc dữ liệu dự án ────────────────────────────────── */

  const loadTree = async (target: ProjectRecord, showHidden = settingsRef.current.showHidden) => {
    setTreeLoading(true)
    try {
      const [nodes, stat, git] = await Promise.all([
        api.fs.tree(target.path, showHidden),
        api.fs.stat(target.path),
        api.fs.git(target.path),
      ])
      setTree(nodes)
      setStats(stat)
      setBranch(git)
    } catch (error) {
      setTree([])
      showToast('err', `Không đọc được thư mục dự án: ${errorMessage(error)}`)
    } finally {
      setTreeLoading(false)
    }
  }

  const openProject = async (target: ProjectRecord, notify = true) => {
    try {
      const opened = (await api.projects.open(target.id)) ?? target
      setStoreData((prev) => ({
        ...prev,
        lastProjectId: opened.id,
        projects: prev.projects.map((item) => (item.id === opened.id ? opened : item)),
      }))
      setProjectId(opened.id)
      setView('detail')
      setOpenPaths([])
      setFile(null)
      setSelectedPath(null)
      setActiveTab('preview')
      setQuery('')
      setLogs([])
      setRun(null)
      setStats(null)
      setBranch(null)
      setScript('')
      setCustomCommand(opened.meta.customCommand || '')
      setTargetRoute('')
      targetRouteRef.current = ''
      setPreviewUrl(null)
      lastUrlRef.current = null
      await loadTree(opened)
      const running = await api.run.ofProject(opened.id)
      setRun(running)

      // Kiểm tra chẩn đoán và tự động mở báo cáo nếu phát hiện lỗi nghiêm trọng (như thiếu node_modules)
      const diag = opened.diagnosis ?? (await api.projects.diagnose(opened.path))
      if (diag && diag.issues.some((i) => i.level === 'error')) {
        setDiagnosisOpen(true)
      }

      if (notify) showToast('ok', `Đã mở dự án “${opened.name}”`)
    } catch (error) {
      showToast('err', `Không mở được dự án: ${errorMessage(error)}`)
    }
  }

  const openFolder = async () => {
    if (busy) return
    setBusy(true)
    try {
      const picked = await api.projects.pickFolder()
      if (!picked) {
        if (!isDesktop) {
          showToast('info', 'Chọn thư mục chỉ hoạt động trên bản desktop. Hãy chạy “npm run dev” trong pixelmind-desktop.')
        }
        return
      }
      const list = await api.projects.list()
      setStoreData((prev) => ({ ...prev, projects: list }))
      await openProject(picked, true)
    } catch (error) {
      showToast('err', `Không mở được thư mục: ${errorMessage(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const refreshProject = async () => {
    if (!project) return
    await loadTree(project)
    try {
      const fresh = await api.projects.refresh(project.id)
      if (fresh) {
        setStoreData((prev) => ({
          ...prev,
          projects: prev.projects.map((item) => (item.id === fresh.id ? fresh : item)),
        }))
      }
      showToast('ok', 'Đã tải lại cây tệp và thông tin dự án.')
    } catch (error) {
      showToast('err', `Không làm mới được dự án: ${errorMessage(error)}`)
    }
  }

  const removeProject = async (target: ProjectRecord) => {
    try {
      const list = await api.projects.remove(target.id)
      setStoreData((prev) => ({
        ...prev,
        projects: list,
        lastProjectId: prev.lastProjectId === target.id ? null : prev.lastProjectId,
      }))
      if (projectId === target.id) {
        setProjectId(null)
        setView('projects')
        setTree([])
        setFile(null)
        setSelectedPath(null)
        setOpenPaths([])
        setRun(null)
        setLogs([])
        setStats(null)
        setBranch(null)
      }
      showToast('ok', `Đã xoá “${target.name}” khỏi danh sách (không xoá tệp trên đĩa).`)
    } catch (error) {
      showToast('err', `Không xoá được dự án: ${errorMessage(error)}`)
    }
  }

  const requestRemove = (target: ProjectRecord) => {
    if (settings.confirmDelete) setPendingDelete(target)
    else void removeProject(target)
  }

  const toggleFavorite = async (target: ProjectRecord) => {
    try {
      const list = await api.projects.favorite(target.id)
      setStoreData((prev) => ({ ...prev, projects: list }))
    } catch (error) {
      showToast('err', `Không cập nhật được: ${errorMessage(error)}`)
    }
  }

  /* ── Trang của dự án (màn hình dự án) ─────────────────── */

  const mergeProject = (updated: ProjectRecord | null) => {
    if (!updated) return
    setStoreData((prev) => ({
      ...prev,
      projects: prev.projects.map((item) => (item.id === updated.id ? updated : item)),
    }))
  }

  const addPage = async (page: Omit<ProjectPage, 'id'>) => {
    if (!project) return
    try {
      const updated = await api.projects.addPage(project.id, page)
      mergeProject(updated)
      /* Đọc lại để lấy dòng nhật ký vừa được main process ghi thêm */
      await refreshStoreProjects()
      setAddPageOpen(false)
      showToast('ok', `Đã thêm trang ${page.route}.`)
    } catch (error) {
      showToast('err', `Không thêm được trang: ${errorMessage(error)}`)
    }
  }

  const removePage = async (pageId: string) => {
    if (!project) return
    try {
      const updated = await api.projects.removePage(project.id, pageId)
      mergeProject(updated)
      await refreshStoreProjects()
      showToast('ok', 'Đã xoá trang khỏi danh sách.')
    } catch (error) {
      showToast('err', `Không xoá được trang: ${errorMessage(error)}`)
    }
  }

  const refreshStoreProjects = async () => {
    try {
      const projects = await api.projects.list()
      setStoreData((prev) => ({ ...prev, projects }))
    } catch {
      /* bỏ qua: danh sách chỉ để hiển thị */
    }
  }

  /* ── Tệp ──────────────────────────────────────────────── */

  const openFile = async (node: FileNode) => {
    setSelectedPath(node.path)
    setActiveTab('file')
    setFileLoading(true)
    try {
      const content = await api.fs.read(node.path)
      setFile(content)
      setOpenPaths((prev) => (prev.includes(node.path) ? prev : [...prev, node.path]))
    } catch (error) {
      setFile(null)
      showToast('err', `Không đọc được tệp ${node.name}: ${errorMessage(error)}`)
    } finally {
      setFileLoading(false)
    }
  }

  const selectTab = (path: string) => {
    setActiveTab('file')
    if (path === selectedPath) return
    setSelectedPath(path)
    setFileLoading(true)
    api.fs
      .read(path)
      .then((content) => setFile(content))
      .catch((error) => showToast('err', `Không đọc được tệp: ${errorMessage(error)}`))
      .finally(() => setFileLoading(false))
  }

  const closeTab = (path: string) => {
    setOpenPaths((prev) => {
      const next = prev.filter((item) => item !== path)
      if (path === selectedPath) {
        const fallback = next[next.length - 1] ?? null
        setSelectedPath(fallback)
        if (fallback) {
          void api.fs.read(fallback).then((content) => setFile(content))
        } else {
          setFile(null)
          setActiveTab('preview')
        }
      }
      return next
    })
  }

  /* ── Chạy dự án & Cài đặt thư viện ────────────────────── */

  const autoScript = useMemo(() => {
    if (!project) return ''
    const preferred = settings.defaultScript.trim()
    if (preferred && project.scripts.some((item) => item.name === preferred)) return preferred
    const dev = project.scripts.find((item) => item.kind === 'dev') ?? project.scripts[0]
    if (dev) return dev.name
    if (project.hasIndexHtml) return 'static'
    /* Không có gì chạy sẵn: cho phép nhập lệnh tay. */
    return 'custom'
  }, [project, settings.defaultScript])

  const effectiveScript = script || autoScript

  /** Lưu lệnh tự nhập để lần sau mở dự án vẫn còn. */
  const saveCustomCommand = async (command: string) => {
    if (!project) return
    if (command.trim() === (project.meta.customCommand ?? '').trim()) return
    try {
      const updated = await api.projects.setCommand(project.id, command)
      if (updated) {
        setStoreData((prev) => ({
          ...prev,
          projects: prev.projects.map((item) => (item.id === updated.id ? updated : item)),
        }))
      }
    } catch {
      /* không chặn thao tác chạy nếu chỉ lưu lệnh thất bại */
    }
  }

  const handleInstall = async () => {
    if (!project) return
    setInstalling(true)
    try {
      const state = await api.run.install(project.id)
      setRun(state)
      setLogs([])
      lastUrlRef.current = null
      const installCmd =
        project.packageManager === 'dotnet'
          ? 'dotnet restore'
          : project.packageManager === 'flutter'
            ? 'flutter pub get'
            : `${project.packageManager || 'npm'} install`
      showToast('ok', `Đang chạy cài đặt thư viện (${installCmd})...`)
      setView('workspace')
      setActiveTab('preview')
    } catch (error) {
      setInstalling(false)
      showToast('err', `Không thể bắt đầu cài đặt: ${errorMessage(error)}`)
    }
  }

  const handleGitInit = async () => {
    if (!project) return
    try {
      const ok = await api.projects.gitInit(project.id)
      if (ok) {
        showToast('ok', 'Đã khởi tạo kho Git (.git) thành công!')
        await refreshProject()
      } else {
        showToast('err', 'Không khởi tạo được Git. Hãy kiểm tra git trên máy.')
      }
    } catch (error) {
      showToast('err', `Lỗi khi khởi tạo Git: ${errorMessage(error)}`)
    }
  }

  const handleCreateIndexHtml = async () => {
    if (!project) return
    try {
      const ok = await api.projects.createIndexHtml(project.id)
      if (ok) {
        showToast('ok', 'Đã tự động tạo tệp index.html mẫu thành công!')
        await refreshProject()
        setDiagnosisOpen(false)
      } else {
        showToast('err', 'Không thể tạo tệp index.html.')
      }
    } catch (error) {
      showToast('err', `Lỗi khi tạo index.html: ${errorMessage(error)}`)
    }
  }

  const handleAddDevScript = async () => {
    if (!project) return
    try {
      const ok = await api.projects.addDevScript(project.id)
      if (ok) {
        showToast('ok', 'Đã thêm script dev vào package.json thành công!')
        await refreshProject()
        setDiagnosisOpen(false)
      } else {
        showToast('err', 'Không thể cập nhật package.json.')
      }
    } catch (error) {
      showToast('err', `Lỗi khi cập nhật package.json: ${errorMessage(error)}`)
    }
  }

  const handleOpenPage = (route: string) => {
    let cleanRoute = route.startsWith('/') ? route : `/${route}`
    // Tự động sửa các route ASP.NET Core cũ còn lưu trong giao diện
    if (project?.packageManager === 'dotnet' || project?.framework?.includes('ASP.NET')) {
      if (cleanRoute.startsWith('/account/')) {
        cleanRoute = `/Identity/Account/${cleanRoute.slice(9)}`
      } else if (['/leaderboard', '/lobby', '/profile', '/account', '/privacy', '/room'].includes(cleanRoute.toLowerCase())) {
        cleanRoute = `/Home${cleanRoute}`
      }
    }
    setTargetRoute(cleanRoute)
    targetRouteRef.current = cleanRoute

    if (run?.url) {
      const base = run.url.replace(/\/+$/, '')
      const fullUrl = cleanRoute === '/' ? base : `${base}${cleanRoute}`
      setPreviewUrl(fullUrl)
    } else {
      setPreviewUrl(null)
    }

    setView('workspace')
    setActiveTab('preview')

    // Nếu chưa chạy, tự động khởi động chạy
    if (!run || (run.status !== 'running' && run.status !== 'starting')) {
      void startRun()
    }
  }

  const startRun = async () => {
    if (!project) {
      showToast('info', 'Hãy mở một dự án trước khi chạy.')
      return
    }

    // Nếu phát hiện thiếu node_modules, hỏi người dùng và mở báo cáo đề xuất cài đặt ngay
    const missingDeps = project.diagnosis?.issues.find((i) => i.type === 'missing_deps')
    if (missingDeps) {
      setDiagnosisOpen(true)
      showToast('err', 'Dự án chưa cài đặt thư viện! Vui lòng chọn “Cài đặt ngay” trong báo cáo.')
      return
    }

    const custom = customCommand.trim()
    const useCustom = effectiveScript === 'custom' || !effectiveScript
    if (useCustom && !custom) {
      showToast(
        'info',
        'Dự án không có script sẵn. Nhập lệnh chạy ở ô “Lệnh tự nhập” rồi bấm Chạy (ví dụ: flutter run -d chrome).',
      )
      return
    }
    try {
      const state = useCustom
        ? await api.run.startCommand(project.id, custom)
        : await api.run.start(project.id, effectiveScript)
      setRun(state)
      setLogs([])
      lastUrlRef.current = null
      setActiveTab('preview')
      showToast('ok', `Đang chạy ${useCustom ? `“${custom}”` : `“${effectiveScript}”`} cho ${project.name}`)
      void refreshStoreProjects()
    } catch (error) {
      showToast('err', `Không chạy được dự án: ${errorMessage(error)}`)
    }
  }

  const stopRun = async () => {
    if (!run) return
    try {
      await api.run.stop(run.id)
      setRun({ ...run, status: 'stopped' })
      showToast('ok', 'Đã dừng tiến trình.')
      void refreshStoreProjects()
    } catch (error) {
      showToast('err', `Không dừng được tiến trình: ${errorMessage(error)}`)
    }
  }

  /* ── Hiệu ứng khởi động ───────────────────────────────── */

  const bootedRef = useRef(false)

  useEffect(() => {
    if (bootedRef.current) return
    bootedRef.current = true
    void (async () => {
      try {
        const [data, info, path] = await Promise.all([api.store.get(), api.getAppInfo(), api.store.path()])
        setStoreData(data)
        setAppInfo(info)
        setStorePath(path)

        const last = data.projects.find((item) => item.id === data.lastProjectId)
        if (data.settings.openLastProject && last) {
          const opened = await api.projects.open(last.id)
          if (opened) {
            setProjectId(opened.id)
            setView('detail')
            setCustomCommand(opened.meta.customCommand || '')
      setTargetRoute('')
      targetRouteRef.current = ''
      setPreviewUrl(null)
            const [nodes, stat, git, running] = await Promise.all([
              api.fs.tree(opened.path, data.settings.showHidden),
              api.fs.stat(opened.path),
              api.fs.git(opened.path),
              api.run.ofProject(opened.id),
            ])
            setTree(nodes)
            setStats(stat)
            setBranch(git)
            setRun(running)

            // Kiểm tra chẩn đoán ban đầu
            if (opened.diagnosis?.issues.some((i) => i.level === 'error')) {
              setDiagnosisOpen(true)
            }
          }
        }
      } catch (error) {
        showToast('err', `Không đọc được dữ liệu ứng dụng: ${errorMessage(error)}`)
      } finally {
        setReady(true)
      }
    })()
  }, [])

  /* ── Nhận sự kiện từ tiến trình ────────────────────────── */

  useEffect(() => {
    const offLog = api.run.onLog((log) => {
      setLogs((prev) => [...prev.slice(-4000), log])
    })
    const offState = api.run.onState((state) => {
      setRun(state)
      if (state.kind === 'install') {
        if (state.status === 'running') {
          setInstalling(true)
        } else if (state.status === 'stopped' || state.status === 'exited') {
          setInstalling(false)
          if (state.exitCode === 0) {
            showToast('ok', 'Cài đặt thư viện hoàn tất thành công! Bạn có thể bấm Chạy dự án (F5).')
            void refreshStoreProjects()
            if (projectId) {
              void api.projects.refresh(projectId).then((fresh) => {
                if (fresh) {
                  setStoreData((prev) => ({
                    ...prev,
                    projects: prev.projects.map((p) => (p.id === fresh.id ? fresh : p)),
                  }))
                }
              })
            }
          } else {
            showToast('err', `Cài đặt thư viện kết thúc với mã lỗi ${state.exitCode ?? 'n/a'}.`)
          }
        }
      }
      if (state.url && state.url !== lastUrlRef.current) {
        lastUrlRef.current = state.url
        const base = state.url.replace(/\/+$/, '')
        const currentRoute = targetRouteRef.current
        const fullUrl = currentRoute && currentRoute !== '/' ? `${base}${currentRoute}` : state.url
        setPreviewUrl(fullUrl)
        const current = settingsRef.current
        if (current.previewMode === 'browser') {
          void api.system.openExternal(fullUrl)
        } else if (current.autoPreview) {
          setActiveTab('preview')
        }
      }
    })
    return () => {
      offLog?.()
      offState?.()
    }
  }, [projectId])

  /* ── Phím tắt + menu hệ thống ──────────────────────────── */

  const actionsRef = useRef({
    openFolder,
    startRun,
    stopRun,
    refreshProject,
    setView,
    setDialog,
    setDiagnosisOpen,
  })
  actionsRef.current = { openFolder, startRun, stopRun, refreshProject, setView, setDialog, setDiagnosisOpen }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()

      if (mod && key === 'k') {
        event.preventDefault()
        setDialog((prev) => (prev === 'palette' ? null : 'palette'))
      } else if (mod && event.key === ',') {
        event.preventDefault()
        setDialog('settings')
      } else if (mod && key === 'o') {
        event.preventDefault()
        if (event.shiftKey) setView('projects')
        else void actionsRef.current.openFolder()
      } else if (mod && key === 'r') {
        event.preventDefault()
        void actionsRef.current.refreshProject()
      } else if (event.key === 'F5') {
        event.preventDefault()
        if (event.shiftKey) void actionsRef.current.stopRun()
        else void actionsRef.current.startRun()
      } else if (event.key === 'F1') {
        event.preventDefault()
        setDialog('guide')
      } else if (event.key === 'Escape') {
        setDialog(null)
        setDiagnosisOpen(false)
        setPendingDelete(null)
      }
    }
    window.addEventListener('keydown', onKey)

    const offMenu = api.system.onMenuAction((action) => {
      switch (action) {
        case 'open-folder':
          void actionsRef.current.openFolder()
          break
        case 'run':
          void actionsRef.current.startRun()
          break
        case 'stop':
          void actionsRef.current.stopRun()
          break
        case 'refresh':
          void actionsRef.current.refreshProject()
          break
        case 'settings':
          setDialog('settings')
          break
        case 'guide':
          setDialog('guide')
          break
        case 'palette':
          setDialog('palette')
          break
        case 'view-projects':
          setView('projects')
          break
        default:
          break
      }
    })

    return () => {
      window.removeEventListener('keydown', onKey)
      offMenu?.()
    }
  }, [])

  /* ── Lệnh cho bảng lệnh ───────────────────────────────── */

  const commands = useMemo<PaletteCommand[]>(() => {
    const items: PaletteCommand[] = [
      {
        id: 'open-folder',
        label: 'Mở thư mục dự án…',
        icon: FolderOpen,
        keys: 'Ctrl O',
        run: () => void openFolder(),
      },
      {
        id: 'projects',
        label: 'Đi tới danh sách dự án',
        icon: FolderKanban,
        run: () => setView('projects'),
      },
      {
        id: 'detail',
        label: 'Đi tới màn hình dự án',
        icon: ClipboardList,
        disabled: !project,
        run: () => setView('detail'),
      },
      {
        id: 'workspace',
        label: 'Đi tới màn hình làm việc',
        icon: LayoutDashboard,
        disabled: !project,
        run: () => setView('workspace'),
      },
      {
        id: 'diagnose',
        label: 'Báo cáo kiểm tra và đề xuất cho dự án',
        icon: ShieldAlert,
        disabled: !project,
        run: () => setDiagnosisOpen(true),
      },
      {
        id: 'install-deps',
        label:
          project?.packageManager === 'dotnet'
            ? 'Khôi phục NuGet (dotnet restore)'
            : project?.packageManager === 'flutter'
              ? 'Tải gói Flutter (flutter pub get)'
              : `Cài đặt thư viện (${project?.packageManager || 'npm'} install)`,
        icon: Zap,
        disabled: !project,
        run: () => void handleInstall(),
      },
      {
        id: 'run',
        label: 'Chạy dự án',
        icon: Play,
        keys: 'F5',
        disabled: !project,
        run: () => void startRun(),
      },
      {
        id: 'stop',
        label: 'Dừng tiến trình',
        icon: Square,
        keys: 'Shift F5',
        disabled: !run,
        run: () => void stopRun(),
      },
      {
        id: 'refresh',
        label: 'Tải lại cây tệp',
        icon: RefreshCw,
        keys: 'Ctrl R',
        disabled: !project,
        run: () => void refreshProject(),
      },
      {
        id: 'theme',
        label: settings.theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối',
        icon: SunMoon,
        run: () => void updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' }),
      },
      {
        id: 'settings',
        label: 'Mở cài đặt',
        icon: SettingsIcon,
        keys: 'Ctrl ,',
        run: () => setDialog('settings'),
      },
      {
        id: 'guide',
        label: 'Mở hướng dẫn sử dụng',
        icon: BookOpen,
        keys: 'F1',
        run: () => setDialog('guide'),
      },
      {
        id: 'data',
        label: 'Mở thư mục dữ liệu ứng dụng',
        icon: Database,
        disabled: !isDesktop,
        run: () => void api.store.path().then((path) => api.fs.openPath(path)),
      },
    ]

    const recent = storeData.projects.slice(0, 5).map<PaletteCommand>((item) => ({
      id: `project-${item.id}`,
      label: `Mở dự án: ${item.name}`,
      icon: FolderOpen,
      hint: item.path,
      run: () => void openProject(item),
    }))

    return [...items, ...recent]
  }, [settings.theme, project, run, storeData.projects, startRun, stopRun, openFolder, refreshProject, openProject, updateSettings])

  /* ── Giao diện ─────────────────────────────────────────── */

  if (!ready) {
    return (
      <div className="pm-app" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="pm-row pm-muted" style={{ gap: 8, fontSize: 12 }}>
          <RefreshCw size={14} className="spin" /> Đang khởi động PixelMind…
        </div>
      </div>
    )
  }

  return (
    <div className="pm-app">
      <TopBar
        project={view === 'projects' ? null : project}
        run={run}
        home={appInfo?.home}
        onOpenFolder={() => void openFolder()}
        onRun={() => void startRun()}
        onStop={() => void stopRun()}
        onProjects={() => setView(view === 'workspace' ? 'detail' : 'projects')}
        onSettings={() => setDialog('settings')}
        onGuide={() => setDialog('guide')}
        onPalette={() => setDialog('palette')}
        onRefresh={() => void refreshProject()}
        onOpenPreview={() => {
          setView('workspace')
          setActiveTab('preview')
        }}
      />

      <div className="pm-body">
        <NavRail
          view={view}
          hasProject={Boolean(project)}
          onProjects={() => setView('projects')}
          onDetail={() => setView('detail')}
          onWorkspace={() => setView('workspace')}
          onOpenFolder={() => void openFolder()}
          onSettings={() => setDialog('settings')}
          onGuide={() => setDialog('guide')}
        />

        <main className="pm-main">
          {view === 'projects' ? (
            <ProjectView
              projects={storeData.projects}
              home={appInfo?.home}
              isDesktop={isDesktop}
              busy={busy}
              onOpen={(item) => void openProject(item)}
              onOpenFolder={() => void openFolder()}
              onRemove={requestRemove}
              onFavorite={(item) => void toggleFavorite(item)}
              onReveal={(item) => void api.fs.openPath(item.path)}
            />
          ) : view === 'detail' && project ? (
            <ProjectDetail
              project={project}
              run={run}
              stats={stats}
              branch={branch}
              diagnosis={project.diagnosis}
              installing={installing}
              onOpenFolder={() => void openFolder()}
              onRun={() => void startRun()}
              onStop={() => void stopRun()}
              onWorkspace={() => setView('workspace')}
              onOpenPage={handleOpenPage}
              onRefresh={() => void refreshProject()}
              onAddPage={() => setAddPageOpen(true)}
              onRemovePage={(pageId) => void removePage(pageId)}
              onReveal={() => void api.fs.openPath(project.path)}
              onOpenLog={() => {
                setView('workspace')
                setActiveTab('preview')
              }}
              onOpenExternal={(url) => void api.system.openExternal(url)}
              onOpenDiagnosis={() => setDiagnosisOpen(true)}
              onInstall={() => void handleInstall()}
              onCreateIndexHtml={() => void handleCreateIndexHtml()}
              onAddDevScript={() => void handleAddDevScript()}
            />
          ) : (
            <WorkspaceView
              project={project}
              tree={tree}
              treeLoading={treeLoading}
              file={file}
              fileLoading={fileLoading}
              selectedPath={selectedPath}
              query={query}
              onQuery={setQuery}
              onSelectFile={(node) => void openFile(node)}
              onRefresh={() => void refreshProject()}
              onOpenFolder={() => void openFolder()}
              run={run}
              logs={logs}
              onRun={() => void startRun()}
              onStop={() => void stopRun()}
              onClearLogs={() => setLogs([])}
              settings={settings}
              stats={stats}
              branch={branch}
              script={effectiveScript}
              diagnosis={project?.diagnosis}
              installing={installing}
              onScript={setScript}
              customCommand={customCommand}
              onCustomCommand={setCustomCommand}
              onSaveCustomCommand={(value) => void saveCustomCommand(value)}
              onSettings={() => setDialog('settings')}
              onReveal={() => project && void api.fs.openPath(project.path)}
              onOpenExternal={(url) => void api.system.openExternal(url)}
              onShowInFolder={(path) => void api.fs.showInFolder(path)}
              onOpenFileExternal={(path) => void api.fs.openPath(path)}
              previewUrl={previewUrl}
              onPreviewUrlChange={setPreviewUrl}
              targetRoute={targetRoute}
              onRouteChange={setTargetRoute}
              onOpenDiagnosis={() => setDiagnosisOpen(true)}
              onInstall={() => void handleInstall()}
              onCreateIndexHtml={() => void handleCreateIndexHtml()}
              onAddDevScript={() => void handleAddDevScript()}
              activeTab={activeTab}
              onActiveTab={setActiveTab}
              tabs={openPaths}
              onCloseTab={closeTab}
              onSelectTab={selectTab}
            />
          )}
        </main>
      </div>

      <StatusBar
        project={project}
        run={run}
        stats={stats}
        branch={branch}
        version={appInfo?.appVersion ?? '0.1.0'}
        isDesktop={isDesktop}
      />

      {dialog === 'settings' && (
        <SettingsDialog
          settings={settings}
          appInfo={appInfo}
          storePath={storePath}
          projectCount={storeData.projects.length}
          isDesktop={isDesktop}
          onUpdate={(patch) => void updateSettings(patch)}
          onReset={() => {
            void (async () => {
              const data = await api.store.reset()
              setStoreData(data)
              setProjectId(null)
              setView('projects')
              setTree([])
              setFile(null)
              setOpenPaths([])
              setRun(null)
              setLogs([])
              showToast('ok', 'Đã khôi phục cài đặt mặc định.')
            })()
          }}
          onOpenDataFolder={() => void api.store.path().then((path) => api.fs.openPath(path))}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog === 'guide' && <GuideDialog isDesktop={isDesktop} onClose={() => setDialog(null)} />}

      {diagnosisOpen && project && (
        <DiagnosisDialog
          project={project}
          diagnosis={project.diagnosis ?? null}
          installing={installing}
          onClose={() => setDiagnosisOpen(false)}
          onInstall={() => void handleInstall()}
          onGitInit={() => void handleGitInit()}
          onCreateIndexHtml={() => void handleCreateIndexHtml()}
          onAddDevScript={() => void handleAddDevScript()}
          onRefresh={() => void refreshProject()}
        />
      )}

      {addPageOpen && project && (
        <AddPageDialog
          projectName={project.name}
          onAdd={(page) => void addPage(page)}
          onClose={() => setAddPageOpen(false)}
        />
      )}

      {dialog === 'palette' && <CommandPalette commands={commands} onClose={() => setDialog(null)} />}

      {pendingDelete && (
        <Modal
          title="Xoá dự án khỏi danh sách?"
          subtitle="Tệp trên đĩa sẽ được giữ nguyên."
          icon={<TriangleAlert size={16} style={{ color: 'var(--warn)' }} />}
          width={460}
          onClose={() => setPendingDelete(null)}
          footer={
            <>
              <span className="grow">{fileName(pendingDelete.path)}</span>
              <button className="btn" onClick={() => setPendingDelete(null)}>
                Huỷ
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  void removeProject(pendingDelete)
                  setPendingDelete(null)
                }}
              >
                <Trash2 size={12} /> Xoá khỏi danh sách
              </button>
            </>
          }
        >
          <div style={{ padding: '0 2px' }}>
            <p className="pm-hint" style={{ fontSize: 12 }}>
              <b>{pendingDelete.name}</b> sẽ không còn xuất hiện trong màn hình dự án. Bạn có thể mở lại bất cứ lúc nào
              bằng nút “Mở thư mục”.
            </p>
            <p className="pm-hint" style={{ marginTop: 8 }}>
              Không có tệp mã nguồn nào bị xoá.
            </p>
          </div>
        </Modal>
      )}

      <ToastStack items={toasts} onDismiss={dismissToast} />
    </div>
  )
}

export default App
