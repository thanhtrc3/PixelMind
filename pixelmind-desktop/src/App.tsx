import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  ClipboardList,
  Database,
  FileText,
  FolderKanban,
  FolderOpen,
  FolderTree,
  History,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  Boxes,
  Palette,
  PanelLeft,
  Play,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldAlert,
  Sparkles,
  Square,
  SunMoon,
  Trash2,
  TriangleAlert,
  Wand2,
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
import type { FileSearchRange } from '@shared/api'
import { api, isDesktop } from './lib/bridge'
import { applyThemeVariables } from './lib/theme'
import { fileName } from './lib/format'
import { editorBuffer } from './lib/editorBuffer'
import { LAYOUT_KEYS, persistFlag, readStoredFlag } from './lib/layoutPrefs'
import {
  parseWorkspaceTabs,
  restoreWorkspaceTabs as restoreSavedWorkspaceTabs,
  serializeWorkspaceTabs,
} from './lib/workspaceTabs'
import TitleBar from './components/TitleBar'
import TopBar from './components/TopBar'
import type { SidebarTab } from './components/WorkspaceSidebar'
import ProjectView from './components/ProjectView'
import ProjectDetail from './components/ProjectDetail'
import AddPageDialog from './components/AddPageDialog'
import PageParamDialog from './components/PageParamDialog'
import DeletePageDialog from './components/DeletePageDialog'
import DuplicatePageDialog from './components/DuplicatePageDialog'
import WorkspaceView from './components/WorkspaceView'
import StatusBar from './components/StatusBar'
import SettingsDialog from './components/SettingsDialog'
import DesignTokensDialog from './components/DesignTokensDialog'
import GuideDialog from './components/GuideDialog'
import CommandPalette from './components/CommandPalette'
import type { PaletteCommand } from './components/CommandPalette'
import Modal from './components/Modal'
import ToastStack from './components/ToastStack'
import type { ToastMessage } from './components/ToastStack'
import DiagnosisDialog from './components/DiagnosisDialog'
import AIDesignImportDialog from './components/AIDesignImportDialog'
import AIThemeDialog from './components/AIThemeDialog'
import NotificationCenter from './components/ide/NotificationCenter'
import type { AppNotification } from './lib/notifications'
import {
  createNotification,
  markAsRead,
  parseNotifications,
  prependNotification,
  serializeNotifications,
} from './lib/notifications'

const EMPTY_STORE: StoreData = {
  settings: { ...DEFAULT_SETTINGS },
  projects: [],
  lastProjectId: null,
}

const workspaceTabsKey = (projectId: string) => `pm.workspace_tabs.${projectId}`

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : typeof error === 'string' ? error : 'Đã xảy ra lỗi không xác định.'

type View = 'projects' | 'detail' | 'workspace'
type DialogId = 'settings' | 'guide' | 'palette' | 'tokens'

const App = () => {
  const [storeData, setStoreData] = useState<StoreData>(EMPTY_STORE)
  const [ready, setReady] = useState(false)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [storePath, setStorePath] = useState('')

  const [view, setView] = useState<View>('projects')
  const [projectId, setProjectId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
    readStoredFlag(LAYOUT_KEYS.sidebar, true),
  )
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(() =>
    readStoredFlag(LAYOUT_KEYS.bottomPanel, true),
  )
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(() =>
    readStoredFlag(LAYOUT_KEYS.rightPanel, true),
  )
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('files')

  const [tree, setTree] = useState<FileNode[]>([])
  const [treeLoading, setTreeLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [stats, setStats] = useState<ProjectStat | null>(null)
  const [branch, setBranch] = useState<string | null>(null)

  const [file, setFile] = useState<FileContent | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [initialLine, setInitialLine] = useState<number | null>(null)
  const [initialMatch, setInitialMatch] = useState<FileSearchRange | null>(null)
  const [openPaths, setOpenPaths] = useState<string[]>([])
  const fileLoadRequestRef = useRef(0)
  const [recentPaths, setRecentPaths] = useState<string[]>([])
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
  const [aiPanelOpen, setAiPanelOpen] = useState(() =>
    readStoredFlag(LAYOUT_KEYS.aiPanel, false),
  )
  const [canvasReloadToken, setCanvasReloadToken] = useState(0)
  const [designOpen, setDesignOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [addPageOpen, setAddPageOpen] = useState(false)
  const [pageToEdit, setPageToEdit] = useState<ProjectPage | null>(null)
  const [pageToDelete, setPageToDelete] = useState<ProjectPage | null>(null)
  const [pageToDuplicate, setPageToDuplicate] = useState<ProjectPage | null>(null)
  const [pageBusy, setPageBusy] = useState(false)
  const [paramChooserPage, setParamChooserPage] = useState<ProjectPage | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ProjectRecord | null>(null)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      return parseNotifications(localStorage.getItem('pm.notification_history'))
    } catch {
      return []
    }
  })
  const [notifCenterOpen, setNotifCenterOpen] = useState(false)

  const settings = storeData.settings
  const project = useMemo(
    () => storeData.projects.find((item) => item.id === projectId) ?? null,
    [storeData.projects, projectId],
  )

  /* ── Quản lý danh sách tệp mở gần đây (Recent files) ─── */
  useEffect(() => {
    if (!projectId) {
      setRecentPaths([])
      return
    }
    try {
      const raw = localStorage.getItem(`pm.recent_files.${projectId}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setRecentPaths(parsed)
      } else {
        setRecentPaths([])
      }
    } catch {
      setRecentPaths([])
    }
  }, [projectId])

  const addRecentPath = (filePath: string) => {
    if (!projectId || !filePath) return
    setRecentPaths((prev) => {
      const next = [filePath, ...prev.filter((p) => p !== filePath)].slice(0, 30)
      try {
        localStorage.setItem(`pm.recent_files.${projectId}`, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  /* ── Tiện ích nhỏ ─────────────────────────────────────── */

  useEffect(() => {
    try {
      localStorage.setItem('pm.notification_history', serializeNotifications(notifications))
    } catch {
      /* Bộ nhớ cục bộ có thể bị đầy */
    }
  }, [notifications])

  const showToast = (kind: ToastMessage['kind'], text: string) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev.slice(-2), { id, kind, text }])

    // Lưu vào Trung tâm lịch sử thông báo (D1-09)
    const newNotif = createNotification(kind, text)
    setNotifications((prev) => prependNotification(prev, newNotif))
  }

  const dismissToast = (id: number) => setToasts((prev) => prev.filter((item) => item.id !== id))

  useEffect(() => {
    if (!projectId) return
    try {
      localStorage.setItem(
        workspaceTabsKey(projectId),
        serializeWorkspaceTabs(openPaths, selectedPath, activeTab),
      )
    } catch {
      /* Bộ nhớ cục bộ có thể bị tắt hoặc đầy. */
    }
  }, [projectId, openPaths, selectedPath, activeTab])

  const restoreWorkspaceTabs = async (targetProjectId: string) => {
    let raw: string | null = null
    try {
      raw = localStorage.getItem(workspaceTabsKey(targetProjectId))
    } catch {
      /* Bộ nhớ cục bộ có thể bị tắt. */
    }
    return restoreSavedWorkspaceTabs(parseWorkspaceTabs(raw), api.fs)
  }

  // Ghi nhớ trạng thái bố cục giữa các lần mở app.
  // Chỉ lưu bố cục giao diện — canvas/máy chủ vẫn luôn khởi động ở trạng thái tắt.
  useEffect(() => persistFlag(LAYOUT_KEYS.sidebar, isSidebarOpen), [isSidebarOpen])
  useEffect(() => persistFlag(LAYOUT_KEYS.bottomPanel, isBottomPanelOpen), [isBottomPanelOpen])
  useEffect(() => persistFlag(LAYOUT_KEYS.rightPanel, isRightPanelOpen), [isRightPanelOpen])
  useEffect(() => persistFlag(LAYOUT_KEYS.aiPanel, aiPanelOpen), [aiPanelOpen])

  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const lastUrlRef = useRef<string | null>(null)

  /* ── Chặn kéo thả tệp/URL làm điều hướng ứng dụng Electron ───────── */
  useEffect(() => {
    const preventDrag = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('dragover', preventDrag, false)
    window.addEventListener('drop', preventDrag, false)
    return () => {
      window.removeEventListener('dragover', preventDrag, false)
      window.removeEventListener('drop', preventDrag, false)
    }
  }, [])

  /* ── Áp dụng chủ đề / màu nhấn / cỡ chữ / thu phóng ───────────────── */

  useEffect(() => {
    const isDark =
      settings.theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : settings.theme === 'dark'
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light'

    applyThemeVariables(
      settings.accent,
      settings.fontSize,
      settings.editorFontFamily,
      settings.editorFontSize,
      settings.reducedMotion,
      settings.canvasGrid,
    )
  }, [
    settings.theme,
    settings.accent,
    settings.fontSize,
    settings.editorFontFamily,
    settings.editorFontSize,
    settings.reducedMotion,
    settings.canvasGrid,
  ])

  useEffect(() => {
    if (settings.theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.dataset.theme = e.matches ? 'dark' : 'light'
    }
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [settings.theme])

  useEffect(() => {
    const factor = (settings.windowZoom ?? 100) / 100
    try {
      api.window?.setZoomFactor?.(factor)
    } catch {
      document.documentElement.style.zoom = String(factor)
    }
  }, [settings.windowZoom])

  // Nối cài đặt Auto-Save & thư mục dự án hiện tại vào EditorBuffer (timer + backup .pixelmind/backups/)
  useEffect(() => {
    editorBuffer.setAutoSave(settings.autoSave !== false)
  }, [settings.autoSave])

  useEffect(() => {
    editorBuffer.setProjectPath(project?.path ?? null)
  }, [project?.path])

  useEffect(() => {
    if (view !== 'workspace' && settings.autoSave !== false && editorBuffer.isDirty()) {
      void editorBuffer.flushAutoSave()
    }
  }, [view, settings.autoSave])

  const toggleAutoSave = () => {
    const next = !(settings.autoSave !== false)
    void updateSettings({ autoSave: next })
    showToast(
      'info',
      next
        ? 'Đã bật Auto-Save (tự lưu sau 1.5s & sao lưu .pixelmind/backups/)'
        : 'Đã tắt Auto-Save (nhấn Ctrl+S khi cần lưu)',
    )
  }

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

  const resetSettingsOnly = async () => {
    try {
      const res = api.store.resetSettings
        ? await api.store.resetSettings()
        : await api.store.updateSettings(DEFAULT_SETTINGS)
      setStoreData((prev) => ({ ...prev, settings: res }))
      showToast('ok', 'Đã khôi phục toàn bộ cài đặt về mặc định (danh sách dự án vẫn được giữ nguyên).')
    } catch (err) {
      showToast('err', `Lỗi khôi phục cài đặt: ${errorMessage(err)}`)
    }
  }

  const handleClearCache = async () => {
    try {
      await api.system.clearCache?.()
      showToast('ok', 'Đã xóa sạch bộ nhớ đệm và dữ liệu tạm của bản xem trước.')
    } catch (err) {
      showToast('err', `Không thể xóa bộ nhớ đệm: ${errorMessage(err)}`)
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
      // Dừng dứt điểm tiến trình của dự án cũ (nếu có) trước khi mở dự án mới để không bị chiếm cổng
      if (run && (run.status === 'running' || run.status === 'starting') && run.projectId !== target.id) {
        try {
          await api.run.stop(run.id)
        } catch {}
      } else if (projectId && projectId !== target.id && api.run?.stopOfProject) {
        try {
          await api.run.stopOfProject(projectId)
        } catch {}
      }

      // Checkpoint RAM là theo từng dự án: lưu phần đang sửa rồi xoá buffer trước khi đổi dự án.
      if (projectId && projectId !== target.id) {
        if (editorBuffer.isDirty()) {
          const saved = await editorBuffer.saveAllDirtyFiles((message) => showToast('info', message))
          if (!saved) {
            showToast('err', 'Một số thay đổi RAM chưa lưu được trước khi chuyển dự án.')
          }
        }
        editorBuffer.clearAll()
      }

      const opened = (await api.projects.open(target.id)) ?? target
      const restoredTabs = await restoreWorkspaceTabs(opened.id)
      fileLoadRequestRef.current += 1
      setStoreData((prev) => ({
        ...prev,
        lastProjectId: opened.id,
        projects: prev.projects.map((item) => (item.id === opened.id ? opened : item)),
      }))
      setProjectId(opened.id)
      setView('detail')
      setOpenPaths(restoredTabs.paths)
      setFile(restoredTabs.file)
      setFileLoading(false)
      setSelectedPath(restoredTabs.selectedPath)
      setInitialLine(null)
      setInitialMatch(null)
      setActiveTab(restoredTabs.activeTab)
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
      if (restoredTabs.inaccessibleCount > 0) {
        showToast(
          'info',
          `Đã bỏ qua ${restoredTabs.inaccessibleCount} tab vì tệp đã bị xóa hoặc không thể truy cập.`,
        )
      }

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
      if (run && run.projectId === target.id) {
        await stopRun()
      } else if (api.run?.stopOfProject) {
        await api.run.stopOfProject(target.id)
      }

      const list = await api.projects.remove(target.id)
      setStoreData((prev) => ({
        ...prev,
        projects: list,
        lastProjectId: prev.lastProjectId === target.id ? null : prev.lastProjectId,
      }))
      if (projectId === target.id) {
        fileLoadRequestRef.current += 1
        setProjectId(null)
        setView('projects')
        setTree([])
        setFile(null)
        setFileLoading(false)
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

  const addPage = async (page: Omit<ProjectPage, 'id'>, options?: { createFile?: boolean }) => {
    if (!project) return
    setPageBusy(true)
    try {
      const updated = await api.projects.addPage(project.id, page, options)
      mergeProject(updated)
      /* Đọc lại để lấy dòng nhật ký vừa được main process ghi thêm */
      await refreshStoreProjects()
      const target = updated ?? project
      await loadTree(target)
      setAddPageOpen(false)
      const created = updated?.meta.pages.find(
        (item) => item.route === page.route && item.title === page.title,
      )
      showToast(
        'ok',
        created?.filePath
          ? `Đã thêm trang ${page.route} và tạo tệp ${created.filePath}.`
          : `Đã thêm trang ${page.route}.`,
      )
    } catch (error) {
      showToast('err', `Không thêm được trang: ${errorMessage(error)}`)
    } finally {
      setPageBusy(false)
    }
  }

  const removePage = async (
    page: ProjectPage,
    options?: { deleteFile?: boolean },
  ) => {
    if (!project) return
    setPageBusy(true)
    try {
      const updated = await api.projects.removePage(project.id, page.id, options)
      mergeProject(updated)
      await refreshStoreProjects()
      const target = updated ?? project
      if (options?.deleteFile && page.filePath) {
        await loadTree(target)
      }
      setPageToDelete(null)
      showToast(
        'ok',
        options?.deleteFile && page.filePath
          ? `Đã xoá trang ${page.route} và chuyển tệp ${page.filePath} vào Thùng rác.`
          : `Đã xoá trang ${page.route} khỏi danh sách.`,
      )
    } catch (error) {
      showToast('err', `Không xoá được trang: ${errorMessage(error)}`)
    } finally {
      setPageBusy(false)
    }
  }

  const duplicatePage = async (
    page: ProjectPage,
    payload: { route: string; title: string; copyFile?: boolean },
  ) => {
    if (!project) return
    setPageBusy(true)
    try {
      const updated = await api.projects.duplicatePage(project.id, page.id, payload)
      mergeProject(updated)
      await refreshStoreProjects()
      const target = updated ?? project
      if (payload.copyFile) {
        await loadTree(target)
      }
      setPageToDuplicate(null)
      const created = updated?.meta.pages.find((item) => item.route === payload.route)
      showToast(
        'ok',
        created?.filePath
          ? `Đã nhân bản trang ${page.route} → ${payload.route} kèm tệp ${created.filePath}.`
          : `Đã nhân bản trang ${page.route} → ${payload.route}.`,
      )
    } catch (error) {
      showToast('err', `Không nhân bản được trang: ${errorMessage(error)}`)
    } finally {
      setPageBusy(false)
    }
  }

  const updatePage = async (page: ProjectPage) => {
    if (!project) return
    try {
      const updated = await api.projects.updatePage(project.id, page)
      mergeProject(updated)
      await refreshStoreProjects()
      setAddPageOpen(false)
      setPageToEdit(null)
      showToast('ok', `Đã cập nhật trang ${page.route}.`)
    } catch (error) {
      showToast('err', `Không cập nhật được trang: ${errorMessage(error)}`)
    }
  }

  const handleDeletePage = (page: ProjectPage) => {
    if (!project) return
    setPageToDelete(page)
  }

  const handleEditPage = (page: ProjectPage) => {
    setPageToEdit(page)
    setAddPageOpen(true)
  }

  const handleDuplicatePage = (page: ProjectPage) => {
    setPageToDuplicate(page)
  }

  const handleUrlChange = (newUrl: string, pathname: string) => {
    if (newUrl && !/^https?:/i.test(newUrl)) return
    if (pathname && pathname !== targetRouteRef.current) {
      setTargetRoute(pathname)
      targetRouteRef.current = pathname
    }
    if (newUrl && newUrl !== previewUrl) {
      setPreviewUrl(newUrl)
    }
  }

  const handleUpdatePageParams = async (pageId: string, params: string[]) => {
    if (!project) return
    const target = project.meta.pages.find((p) => p.id === pageId)
    if (!target) return
    await updatePage({ ...target, sampleParams: params })
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

  const openFile = async (
    node: FileNode | { path: string; name?: string; ext?: string; type?: 'file' },
    line?: number,
    match?: FileSearchRange,
  ) => {
    const requestId = ++fileLoadRequestRef.current
    setSelectedPath(node.path)
    setActiveTab('file')
    setFileLoading(true)
    setInitialLine(line ?? null)
    setInitialMatch(match ?? null)
    addRecentPath(node.path)
    try {
      const content = await api.fs.read(node.path)
      if (requestId !== fileLoadRequestRef.current) return
      setFile(content)
      setOpenPaths((prev) => (prev.includes(node.path) ? prev : [...prev, node.path]))
    } catch (error) {
      if (requestId !== fileLoadRequestRef.current) return
      setFile(null)
      setSelectedPath(null)
      setActiveTab('preview')
      showToast('err', `Không đọc được tệp ${node.name || node.path}: ${errorMessage(error)}`)
    } finally {
      if (requestId === fileLoadRequestRef.current) setFileLoading(false)
    }
  }

  const selectTab = (path: string, line?: number, match?: FileSearchRange) => {
    setActiveTab('file')
    setInitialLine(line ?? null)
    setInitialMatch(match ?? null)
    addRecentPath(path)
    if (path === selectedPath) return
    const requestId = ++fileLoadRequestRef.current
    setSelectedPath(path)
    setFileLoading(true)
    api.fs
      .read(path)
      .then((content) => {
        if (requestId === fileLoadRequestRef.current) setFile(content)
      })
      .catch((error) => {
        if (requestId !== fileLoadRequestRef.current) return
        setOpenPaths((prev) => prev.filter((item) => item !== path))
        setFile(null)
        setSelectedPath(null)
        setActiveTab('preview')
        showToast('err', `Đã đóng tab không đọc được: ${errorMessage(error)}`)
      })
      .finally(() => {
        if (requestId === fileLoadRequestRef.current) setFileLoading(false)
      })
  }

  const closeTab = (path: string) => {
    const next = openPaths.filter((item) => item !== path)
    setOpenPaths(next)
    if (path !== selectedPath) return
    const fallback = next[next.length - 1] ?? null
    if (fallback) {
      selectTab(fallback)
    } else {
      fileLoadRequestRef.current += 1
      setSelectedPath(null)
      setFile(null)
      setFileLoading(false)
      setActiveTab('preview')
    }
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
      const lower = cleanRoute.toLowerCase()
      if (lower === '/shared/error') {
        cleanRoute = '/Home/Error'
      } else if (lower === '/account' || lower === '/home/account') {
        cleanRoute = '/Account'
      } else if (cleanRoute.startsWith('/account/')) {
        cleanRoute = `/Identity/Account/${cleanRoute.slice(9)}`
      } else if (['/leaderboard', '/lobby', '/profile', '/privacy', '/room'].includes(lower)) {
        cleanRoute = `/Home${cleanRoute}`
      }
    }
    setTargetRoute(cleanRoute)
    targetRouteRef.current = cleanRoute

    if (run?.url) {
      const base = run.url.replace(/\/+$/, '')
      const sep = cleanRoute.includes('?') ? '&' : '?'
      const fullUrl = cleanRoute === '/' ? `${base}/?preview=true` : `${base}${cleanRoute}${sep}preview=true`
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
      if (settingsRef.current.clearConsoleOnRun ?? true) {
        setLogs([])
      }
      lastUrlRef.current = null
      setActiveTab('preview')
      showToast('ok', `Đang chạy ${useCustom ? `“${custom}”` : `“${effectiveScript}”`} cho ${project.name}`)
      void refreshStoreProjects()
    } catch (error) {
      showToast('err', `Không chạy được dự án: ${errorMessage(error)}`)
    }
  }

  const stopRun = async () => {
    if (!run && !projectId) return
    try {
      if (run) {
        await api.run.stop(run.id)
        setRun({ ...run, status: 'stopped' })
      } else if (projectId && api.run?.stopOfProject) {
        await api.run.stopOfProject(projectId)
      }
      showToast('ok', 'Đã dừng tiến trình và giải phóng cổng.')
      void refreshStoreProjects()
    } catch (error) {
      showToast('err', `Không dừng được tiến trình: ${errorMessage(error)}`)
    }
  }

  /** Thoát khỏi dự án hiện tại về danh sách dự án (tự động tắt dev server để tránh chiếm cổng) */
  const handleExitToProjects = async () => {
    if (run && (run.status === 'running' || run.status === 'starting')) {
      await stopRun()
    } else if (projectId && api.run?.stopOfProject) {
      await api.run.stopOfProject(projectId)
    }
    setView('projects')
  }

  // Tự động giải phóng cổng & dừng dev server khi đóng cửa sổ app
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (api.run?.stopAll) {
        void api.run.stopAll()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

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
            const restoredTabs = await restoreWorkspaceTabs(opened.id)
            setProjectId(opened.id)
            setView('detail')
            setOpenPaths(restoredTabs.paths)
            setFile(restoredTabs.file)
            setSelectedPath(restoredTabs.selectedPath)
            setActiveTab(restoredTabs.activeTab)
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
            if (restoredTabs.inaccessibleCount > 0) {
              showToast(
                'info',
                `Đã bỏ qua ${restoredTabs.inaccessibleCount} tab vì tệp đã bị xóa hoặc không thể truy cập.`,
              )
            }

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
      const maxLines = settingsRef.current.maxLogLines || 1000
      setLogs((prev) => [...prev.slice(-(maxLines - 1)), log])
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
        const fullUrl = currentRoute && currentRoute !== '/' ? `${base}${currentRoute}` : `${base}/`
        setPreviewUrl(fullUrl)
        const current = settingsRef.current
        if (current.previewMode === 'browser') {
          void api.system.openExternal(fullUrl)
        } else if (current.autoPreview) {
          setView('workspace')
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
    handleExitToProjects,
    refreshProject,
    setView,
    setDialog,
    setDiagnosisOpen,
    handleInstall,
    setIsSidebarOpen,
    setSidebarTab,
  })
  actionsRef.current = {
    openFolder,
    startRun,
    stopRun,
    handleExitToProjects,
    refreshProject,
    setView,
    setDialog,
    setDiagnosisOpen,
    handleInstall,
    setIsSidebarOpen,
    setSidebarTab,
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()

      if (mod && (key === 'k' || key === 'p')) {
        event.preventDefault()
        setDialog((prev) => (prev === 'palette' ? null : 'palette'))
      } else if (mod && key === 'b') {
        event.preventDefault()
        setIsSidebarOpen((prev) => !prev)
      } else if (mod && event.shiftKey && key === 'e') {
        event.preventDefault()
        setView('workspace')
        setSidebarTab('files')
        setIsSidebarOpen(true)
      } else if (mod && event.shiftKey && key === 'l') {
        event.preventDefault()
        setView('workspace')
        setSidebarTab('layers')
        setIsSidebarOpen(true)
      } else if (mod && event.key === ',') {
        event.preventDefault()
        setDialog('settings')
      } else if (mod && key === 'o') {
        event.preventDefault()
        if (event.shiftKey) void actionsRef.current.handleExitToProjects()
        else void actionsRef.current.openFolder()
      } else if (mod && event.shiftKey && key === 'r') {
        window.location.reload()
      } else if (mod && key === 'r') {
        event.preventDefault()
        void actionsRef.current.refreshProject()
        window.dispatchEvent(new CustomEvent('pixelmind:reload-canvas'))
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
          void actionsRef.current.handleExitToProjects()
          break
        case 'view-workspace':
          setView('workspace')
          break
        case 'toggle-sidebar':
          setIsSidebarOpen((v) => !v)
          break
        case 'tab-files':
          setView('workspace')
          setSidebarTab('files')
          setIsSidebarOpen(true)
          break
        case 'tab-layers':
          setView('workspace')
          setSidebarTab('layers')
          setIsSidebarOpen(true)
          break
        case 'tab-pages':
          setView('workspace')
          setSidebarTab('pages')
          setIsSidebarOpen(true)
          break
        case 'tab-assets':
          setView('workspace')
          setSidebarTab('assets')
          setIsSidebarOpen(true)
          break
        case 'tab-versions':
          setView('workspace')
          setSidebarTab('versions')
          setIsSidebarOpen(true)
          break
        case 'tab-design':
          setView('workspace')
          setSidebarTab('design')
          setIsSidebarOpen(true)
          break
        case 'tab-toolbox':
          setView('workspace')
          setSidebarTab('toolbox')
          setIsSidebarOpen(true)
          break
        case 'save':
          void editorBuffer.saveAllDirtyFiles().then(() => {
            showToast('ok', 'Đã lưu tất cả thay đổi vào tệp mã nguồn!')
          })
          break
        case 'undo':
          if (editorBuffer.canUndo()) editorBuffer.undo()
          break
        case 'redo':
          if (editorBuffer.canRedo()) editorBuffer.redo()
          break
        case 'tokens':
          setDialog('tokens')
          break
        case 'install-deps':
          void actionsRef.current.handleInstall()
          break
        case 'diagnose':
          setDiagnosisOpen(true)
          break
        case 'open-browser':
          if (run?.url) void api.system.openExternal(run.url)
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
        run: () => void handleExitToProjects(),
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
        id: 'toggle-sidebar',
        label: 'Ẩn / Hiện thanh bên (Sidebar)',
        icon: PanelLeft,
        keys: 'Ctrl B',
        disabled: !project,
        run: () => setIsSidebarOpen((v) => !v),
      },
      {
        id: 'tab-files',
        label: 'Thanh bên: Cây tệp mã nguồn (Files)',
        icon: FolderTree,
        keys: 'Ctrl Shift E',
        disabled: !project,
        run: () => {
          setView('workspace')
          setSidebarTab('files')
          setIsSidebarOpen(true)
        },
      },
      {
        id: 'tab-layers',
        label: 'Thanh bên: Cây phân cấp các lớp (Layers)',
        icon: Layers,
        keys: 'Ctrl Shift L',
        disabled: !project,
        run: () => {
          setView('workspace')
          setSidebarTab('layers')
          setIsSidebarOpen(true)
        },
      },
      {
        id: 'tab-pages',
        label: 'Thanh bên: Danh sách trang (Pages)',
        icon: FileText,
        disabled: !project,
        run: () => {
          setView('workspace')
          setSidebarTab('pages')
          setIsSidebarOpen(true)
        },
      },
      {
        id: 'tab-assets',
        label: 'Thanh bên: Tài nguyên hình ảnh & Ảnh mẫu (Assets)',
        icon: ImageIcon,
        disabled: !project,
        run: () => {
          setView('workspace')
          setSidebarTab('assets')
          setIsSidebarOpen(true)
        },
      },
      {
        id: 'tab-versions',
        label: 'Thanh bên: Lịch sử phiên bản & Git (Versions)',
        icon: History,
        disabled: !project,
        run: () => {
          setView('workspace')
          setSidebarTab('versions')
          setIsSidebarOpen(true)
        },
      },
      {
        id: 'tab-design',
        label: 'Thanh bên: Hệ thống thiết kế (Design Tokens)',
        icon: Palette,
        disabled: !project,
        run: () => {
          setView('workspace')
          setSidebarTab('design')
          setIsSidebarOpen(true)
        },
      },
      {
        id: 'tab-toolbox',
        label: 'Thanh bên: Hộp công cụ (Phần tử · Linh kiện · Của dự án)',
        icon: Boxes,
        disabled: !project,
        run: () => {
          setView('workspace')
          setSidebarTab('toolbox')
          setIsSidebarOpen(true)
        },
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
        id: 'tokens',
        label: 'Hệ thống thiết kế (Design Tokens & Theme Manager)',
        icon: Palette,
        run: () => setDialog('tokens'),
      },
      {
        id: 'ai-panel',
        label: 'Mở Trợ lý AI',
        hint: 'Chat · ngữ cảnh · duyệt diff · tự sửa lỗi',
        icon: Sparkles,
        keys: 'Ctrl Shift A',
        disabled: !project,
        run: () => {
          setView('workspace')
          setAiPanelOpen(true)
        },
      },
      {
        id: 'ai-design',
        label: 'Chuyển thiết kế thành mã (AI)',
        icon: Wand2,
        disabled: !project,
        run: () => setDesignOpen(true),
      },
      {
        id: 'ai-theme',
        label: 'Tạo theme & nội dung bằng AI',
        icon: Palette,
        disabled: !project,
        run: () => setThemeOpen(true),
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
      <TitleBar
        project={view === 'projects' ? null : project}
        onOpenFolder={() => void openFolder()}
        onViewProjects={() => void handleExitToProjects()}
        onViewWorkspace={() => {
          if (project) setView('workspace')
        }}
        onSettings={() => setDialog('settings')}
        onGuide={() => setDialog('guide')}
        onPalette={() => setDialog('palette')}
        onRun={() => void startRun()}
        onStop={() => void stopRun()}
        onRefresh={() => void refreshProject()}
        onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
        autoSave={settings.autoSave !== false}
        onToggleAutoSave={toggleAutoSave}
      />

      <TopBar
        project={view === 'projects' ? null : project}
        run={run}
        home={appInfo?.home}
        view={view}
        onViewChange={(v) => {
          if (v === 'projects') {
            void handleExitToProjects()
          } else {
            setView(v)
          }
        }}
        onOpenFolder={() => void openFolder()}
        onRun={() => void startRun()}
        onStop={() => void stopRun()}
        onSettings={() => setDialog('settings')}
        onGuide={() => setDialog('guide')}
        onPalette={() => setDialog('palette')}
        onRefresh={() => void refreshProject()}
        onTokens={() => setDialog('tokens')}
        canvasUrl={view === 'workspace' ? (previewUrl ?? run?.url ?? null) : null}
        onOpenPreview={(url) => void api.system.openExternal(url)}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
        isBottomPanelOpen={isBottomPanelOpen}
        onToggleBottomPanel={() => setIsBottomPanelOpen((v) => !v)}
        isRightPanelOpen={isRightPanelOpen}
        onToggleRightPanel={() => setIsRightPanelOpen((v) => !v)}
        aiOpen={aiPanelOpen}
        onToggleAI={() => {
          if (view !== 'workspace') setView('workspace')
          setAiPanelOpen((v) => !v)
        }}
      />

      <div className="pm-body">
        <main className="pm-main">
          {view === 'projects' && (
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
          )}
          {view === 'detail' && project && (
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
              onAddPage={() => {
                setPageToEdit(null)
                setAddPageOpen(true)
              }}
              onRemovePage={(page) => handleDeletePage(page)}
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
          )}
          {/* Workspace luôn được giữ mounted (ẩn khi ở màn hình khác) để phiên AI
              và các tác vụ đang chạy không bị ngắt khi người dùng điều hướng. */}
          <div
            className="pm-view-host"
            data-hidden={view !== 'workspace'}
            aria-hidden={view !== 'workspace'}
          >
            <WorkspaceView
              active={view === 'workspace'}
              project={project}
              tree={tree}
              treeLoading={treeLoading}
              file={file}
              fileLoading={fileLoading}
              selectedPath={selectedPath}
              initialLine={initialLine}
              initialMatch={initialMatch}
              query={query}
              onQuery={setQuery}
              onSelectFile={(node, line, match) => void openFile(node, line, match)}
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
              onOpenDiagnosis={() => setDiagnosisOpen(true)}
              onInstall={() => void handleInstall()}
              onCreateIndexHtml={() => void handleCreateIndexHtml()}
              onAddDevScript={() => void handleAddDevScript()}
              activeTab={activeTab}
              onActiveTab={setActiveTab}
              tabs={openPaths}
              onCloseTab={closeTab}
              onSelectTab={selectTab}
              isSidebarOpen={isSidebarOpen}
              onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
              isBottomPanelOpen={isBottomPanelOpen}
              onToggleBottomPanel={() => setIsBottomPanelOpen((v) => !v)}
              isRightPanelOpen={isRightPanelOpen}
              onToggleRightPanel={() => setIsRightPanelOpen((v) => !v)}
              sidebarTab={sidebarTab}
              onSidebarTabChange={setSidebarTab}
              onOpenPage={handleOpenPage}
              onAddPage={() => {
                setPageToEdit(null)
                setAddPageOpen(true)
              }}
              onEditPage={handleEditPage}
              onDeletePage={handleDeletePage}
              onDuplicatePage={handleDuplicatePage}
              onOpenParamChooser={(p) => setParamChooserPage(p)}
              currentRoute={targetRoute}
              onUrlChange={handleUrlChange}
              onOpenTokens={() => setDialog('tokens')}
              onShowToast={showToast}
              aiPanelOpen={aiPanelOpen}
              onToggleAIPanel={() => setAiPanelOpen((v) => !v)}
              onOpenDesign={() => setDesignOpen(true)}
              onOpenTheme={() => setThemeOpen(true)}
              canvasReloadToken={canvasReloadToken}
              onAIApplied={() => {
                setCanvasReloadToken((value) => value + 1)
                void refreshProject()
              }}
            />
          </div>
        </main>
      </div>

      <StatusBar
        project={project}
        run={run}
        stats={stats}
        branch={branch}
        version={appInfo?.appVersion ?? '0.1.0'}
        isDesktop={isDesktop}
        unreadNotifications={notifications.filter((n) => !n.read).length}
        onToggleNotifications={() => setNotifCenterOpen((prev) => !prev)}
      />

      {dialog === 'settings' && (
        <SettingsDialog
          settings={settings}
          appInfo={appInfo}
          storePath={storePath}
          projectCount={storeData.projects.length}
          isDesktop={isDesktop}
          projectPath={project?.path}
          onUpdate={(patch) => void updateSettings(patch)}
          onResetSettings={resetSettingsOnly}
          onResetAllData={() => {
            void (async () => {
              if (api.run?.stopAll) {
                await api.run.stopAll()
              }
              const data = await api.store.reset()
              fileLoadRequestRef.current += 1
              setStoreData(data)
              setProjectId(null)
              setView('projects')
              setTree([])
              setFile(null)
              setFileLoading(false)
              setOpenPaths([])
              setRun(null)
              setLogs([])
              showToast('ok', 'Đã xóa toàn bộ dữ liệu và đưa PixelMind về trạng thái mới cài đặt.')
            })()
          }}
          onClearCache={handleClearCache}
          onOpenDataFolder={() => void api.store.path().then((path) => api.fs.openPath(path))}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog === 'guide' && <GuideDialog isDesktop={isDesktop} onClose={() => setDialog(null)} />}

      {dialog === 'tokens' && (
        <DesignTokensDialog
          projectPath={project?.path}
          projectName={project?.name}
          onClose={() => setDialog(null)}
          showToast={(msg) => showToast('info', msg)}
        />
      )}

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
          projectId={project.id}
          pageToEdit={pageToEdit}
          existingPages={project.meta.pages}
          onAdd={(page, options) => void addPage(page, options)}
          onUpdate={(page) => void updatePage(page)}
          onClose={() => {
            setAddPageOpen(false)
            setPageToEdit(null)
          }}
        />
      )}

      {pageToDelete && project && (
        <DeletePageDialog
          page={pageToDelete}
          busy={pageBusy}
          onConfirm={(options) => void removePage(pageToDelete, options)}
          onClose={() => {
            if (!pageBusy) setPageToDelete(null)
          }}
        />
      )}

      {pageToDuplicate && project && (
        <DuplicatePageDialog
          projectId={project.id}
          page={pageToDuplicate}
          existingPages={project.meta.pages}
          busy={pageBusy}
          onConfirm={(payload) => void duplicatePage(pageToDuplicate, payload)}
          onClose={() => {
            if (!pageBusy) setPageToDuplicate(null)
          }}
        />
      )}

      {paramChooserPage && (
        <PageParamDialog
          page={paramChooserPage}
          onSelectRoute={(fullRoute) => {
            handleOpenPage(fullRoute)
            setParamChooserPage(null)
          }}
          onClose={() => setParamChooserPage(null)}
          onUpdateParams={(pageId, params) => void handleUpdatePageParams(pageId, params)}
        />
      )}

      {dialog === 'palette' && (
        <CommandPalette
          commands={commands}
          recentPaths={recentPaths}
          treeNodes={tree}
          rootPath={project?.path}
          onOpenFile={(path) => {
            const fileName = path.split(/[\\/]/).pop() || ''
            const fileExt = fileName.split('.').pop() || ''
            void openFile({ path, name: fileName, ext: fileExt, type: 'file' })
          }}
          onOpenContentMatch={(match) => {
            const fileName = match.file.split('/').pop() || match.file
            const fileExt = fileName.split('.').pop() || ''
            void openFile(
              { path: match.fullPath, name: fileName, ext: fileExt, type: 'file' },
              match.line,
              typeof match.matchStart === 'number'
                ? { start: match.matchStart, end: match.matchEnd ?? match.matchStart }
                : undefined,
            )
          }}
          onClose={() => setDialog(null)}
        />
      )}

      {designOpen && (
        <AIDesignImportDialog
          onClose={() => setDesignOpen(false)}
          onShowToast={showToast}
          projectName={project?.name}
          projectPath={project?.path}
          projectId={project?.id}
          pageRoutes={project?.meta.pages.map((page) => page.route)}
          onSetCanvasOverlay={(img) => {
            try {
              window.localStorage.setItem('pm.canvasOverlay', img)
              window.dispatchEvent(new Event('pm:overlay-updated'))
              showToast('ok', '✨ Đã bật Overlay so sánh ảnh mẫu trên Canvas!')
            } catch {}
          }}
        />
      )}

      {themeOpen && (
        <AIThemeDialog
          onClose={() => setThemeOpen(false)}
          onShowToast={showToast}
          projectName={project?.name}
          projectPath={project?.path}
          onTokensUpdated={() => void refreshProject()}
        />
      )}

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

      {notifCenterOpen && (
        <div
          className="pm-notif-backdrop"
          onClick={() => setNotifCenterOpen(false)}
        >
          <NotificationCenter
            notifications={notifications}
            onMarkAsRead={(id) => setNotifications((prev) => markAsRead(prev, id))}
            onClearAll={() => setNotifications([])}
            onClose={() => setNotifCenterOpen(false)}
            onCopyText={(text) => {
              void navigator.clipboard?.writeText(text)
              showToast('ok', 'Đã sao chép nội dung thông báo!')
            }}
          />
        </div>
      )}
    </div>
  )
}

export default App
