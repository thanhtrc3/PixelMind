import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels'
import {
  FileCode2,
  FileText,
  FolderOpen,
  FolderTree,
  Globe2,
  History,
  Image as ImageIcon,
  Layers,
  Maximize2,
  Minimize2,
  Boxes,
  Palette,
  X,
} from 'lucide-react'
import type {
  FileContent,
  FileNode,
  ProjectDiagnosis,
  ProjectPage,
  ProjectRecord,
  ProjectStat,
  RunLog,
  RunState,
  Settings,
} from '@shared/types'
import { parseRunError } from '../lib/errorParser'
import type { FileSearchRange } from '../../shared/api'
import { toWorkspaceCanvasSettings } from '../lib/canvasSettings'
import { editorBuffer } from '../lib/editorBuffer'
import {
  LAYOUT_KEYS,
  PANEL_SIZE_LIMITS,
  persistFlag,
  persistPanelSizes,
  readPanelSizes,
  readStoredFlag,
  type PanelSizeKey,
  type PanelSizeMap,
} from '../lib/layoutPrefs'
import WorkspaceSidebar, { type ReferenceAsset, type SidebarTab } from './WorkspaceSidebar'
import FileViewer from './FileViewer'
import CanvasArea from './CanvasArea'
import LogPanel from './LogPanel'
import RunSidebar from './RunSidebar'
import AIPanel from './AIPanel'
import type { AiSelectedElement, AiTab } from '../lib/aiMock'

interface WorkspaceViewProps {
  project: ProjectRecord | null
  tree: FileNode[]
  treeLoading: boolean
  file: FileContent | null
  fileLoading: boolean
  selectedPath: string | null
  initialLine?: number | null
  /** Vùng khớp tìm kiếm cần đánh dấu trong dòng (0-based). */
  initialMatch?: FileSearchRange | null
  query: string
  onQuery: (value: string) => void
  onSelectFile: (node: FileNode, initialLine?: number, match?: FileSearchRange) => void
  onRefresh: () => void
  onOpenFolder: () => void
  run: RunState | null
  logs: RunLog[]
  onRun: () => void
  onStop: () => void
  onClearLogs: () => void
  settings: Settings
  stats: ProjectStat | null
  branch: string | null
  script: string
  diagnosis?: ProjectDiagnosis | null
  installing?: boolean
  onScript: (value: string) => void
  customCommand?: string
  onCustomCommand?: (value: string) => void
  onSaveCustomCommand?: (value: string) => void
  /** URL xem trước do App quản lý (đã nắn chỉnh route) — ưu tiên hơn run.url. */
  previewUrl?: string | null
  onSettings: () => void
  onReveal: () => void
  onOpenExternal: (url: string) => void
  onShowInFolder: (path: string) => void
  onOpenFileExternal: (path: string) => void
  onOpenDiagnosis?: () => void
  onInstall?: () => void
  onCreateIndexHtml?: () => void
  onAddDevScript?: () => void
  activeTab: 'file' | 'preview'
  onActiveTab: (tab: 'file' | 'preview') => void
  tabs: string[]
  onCloseTab: (path: string) => void
  onSelectTab: (path: string) => void
  isSidebarOpen?: boolean
  onToggleSidebar?: () => void
  isBottomPanelOpen?: boolean
  onToggleBottomPanel?: () => void
  isRightPanelOpen?: boolean
  onToggleRightPanel?: () => void
  sidebarTab?: SidebarTab
  onSidebarTabChange?: (tab: SidebarTab) => void
  onOpenPage?: (route: string) => void
  onAddPage?: () => void
  onEditPage?: (page: ProjectPage) => void
  onDeletePage?: (page: ProjectPage) => void
  onDuplicatePage?: (page: ProjectPage) => void
  onOpenParamChooser?: (page: ProjectPage) => void
  currentRoute?: string
  onUrlChange?: (url: string, pathname: string) => void
  onOpenTokens?: () => void
  onShowToast?: (kind: 'ok' | 'err' | 'info', text: string) => void
  aiPanelOpen?: boolean
  onToggleAIPanel?: () => void
  onOpenDesign?: () => void
  onOpenTheme?: () => void
  canvasReloadToken?: number
  onAIApplied?: () => void
  /** Workspace có đang là màn hình hiển thị không (vẫn mounted khi ẩn để giữ phiên AI). */
  active?: boolean
}

const DEFAULT_AI_PANEL_WIDTH = 400
const DEFAULT_SIDEBAR_WIDTH = 320
const DEFAULT_RIGHT_PANEL_WIDTH = 300

const WorkspaceView = ({
  project,
  tree,
  treeLoading,
  file,
  fileLoading,
  selectedPath,
  initialLine,
  initialMatch,
  query,
  onQuery,
  onSelectFile,
  onRefresh,
  onOpenFolder,
  run,
  logs,
  onRun,
  onStop,
  onClearLogs,
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
  previewUrl,
  onSettings,
  onReveal,
  onOpenExternal,
  onShowInFolder,
  onOpenFileExternal,
  onOpenDiagnosis,
  onInstall,
  onCreateIndexHtml,
  onAddDevScript,
  activeTab,
  onActiveTab,
  tabs,
  onCloseTab,
  onSelectTab,
  isSidebarOpen = true,
  onToggleSidebar,
  isBottomPanelOpen = true,
  onToggleBottomPanel,
  isRightPanelOpen = true,
  onToggleRightPanel,
  sidebarTab = 'files',
  onSidebarTabChange,
  onOpenPage,
  onAddPage,
  onEditPage,
  onDeletePage,
  onDuplicatePage,
  onOpenParamChooser,
  currentRoute,
  onUrlChange,
  onOpenTokens,
  onShowToast,
  aiPanelOpen = false,
  onToggleAIPanel,
  onOpenDesign,
  onOpenTheme,
  canvasReloadToken = 0,
  onAIApplied,
  active = true,
}: WorkspaceViewProps) => {
  const parsedError = useMemo(() => parseRunError(logs, run), [logs, run])
  /* App có thể đã nắn chỉnh route ASP.NET Core; ưu tiên URL đó. */
  const canvasUrl = previewUrl ?? run?.url ?? null

  const logPanelRef = usePanelRef()
  const sidebarPanelRef = usePanelRef()
  const rightPanelRef = usePanelRef()
  const aiPanelRef = usePanelRef()

  /* Chống gọi toggle hai lần khi kéo panel qua ngưỡng thu gọn (nhiều sự kiện resize). */
  const sidebarCollapseHandledRef = useRef(false)
  const rightCollapseHandledRef = useRef(false)
  const aiCollapseHandledRef = useRef(false)

  const [isLogCollapsed, setIsLogCollapsed] = useState(() =>
    readStoredFlag(LAYOUT_KEYS.logCollapsed, false),
  )
  // Chế độ tập trung toàn màn hình Canvas (ẩn cả cây tệp và sidebar)
  const [focusCanvas, setFocusCanvas] = useState(false)

  // Kích thước panel đã lưu theo từng dự án (đọc một lần khi mở; đổi dự án sẽ nạp lại).
  const [initialPanelSizes] = useState<PanelSizeMap>(() => readPanelSizes(project?.id))
  const panelSizesRef = useRef<PanelSizeMap>(initialPanelSizes)
  /* Kích thước "thoải mái" gần nhất trước khi kéo panel qua ngưỡng thu gọn: dùng để
     mở lại panel ở kích thước cũ thay vì dính mức tối thiểu. */
  const sidebarComfortRef = useRef(initialPanelSizes.sidebar ?? DEFAULT_SIDEBAR_WIDTH)
  const rightComfortRef = useRef(initialPanelSizes.rightPanel ?? DEFAULT_RIGHT_PANEL_WIDTH)
  const aiComfortRef = useRef(initialPanelSizes.aiPanel ?? DEFAULT_AI_PANEL_WIDTH)
  const projectIdRef = useRef<string | null>(project?.id ?? null)
  const panelPersistTimerRef = useRef<number | null>(null)

  /** Ghi nhớ kích thước panel đang kéo, debounce 250ms rồi lưu vào localStorage. */
  const rememberPanelSize = useCallback((key: PanelSizeKey, pixels: number) => {
    const limits = PANEL_SIZE_LIMITS[key]
    if (!Number.isFinite(pixels) || pixels < limits.min) return
    const rounded = Math.round(pixels)
    if (panelSizesRef.current[key] === rounded) return
    panelSizesRef.current = { ...panelSizesRef.current, [key]: rounded }
    const projectId = projectIdRef.current
    if (!projectId) return
    const snapshot = { ...panelSizesRef.current }
    if (panelPersistTimerRef.current !== null) {
      window.clearTimeout(panelPersistTimerRef.current)
    }
    panelPersistTimerRef.current = window.setTimeout(() => {
      panelPersistTimerRef.current = null
      persistPanelSizes(projectId, snapshot)
    }, 250)
  }, [])

  /** Đọc kích thước đã lưu khi mở dự án hoặc chuyển dự án. */
  useEffect(() => {
    const projectId = project?.id ?? null
    projectIdRef.current = projectId
    const sizes = readPanelSizes(projectId)
    panelSizesRef.current = sizes
    if (sizes.sidebar) sidebarComfortRef.current = sizes.sidebar
    if (sizes.rightPanel) rightComfortRef.current = sizes.rightPanel
    if (sizes.aiPanel) aiComfortRef.current = sizes.aiPanel
  }, [project?.id])

  // Panel bị tháo ra khi thu gọn rồi mở lại → áp lại kích thước gần nhất trong phiên.
  // Chỉ đọc từ ref (không đọc lại localStorage) để không ghi đè thay đổi vừa kéo.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const sizes = panelSizesRef.current
      if (!focusCanvas && isSidebarOpen && sizes.sidebar) {
        sidebarPanelRef.current?.resize(`${sizes.sidebar}px`)
      }
      // Chỉ khôi phục chiều cao nhật ký khi panel đang mở thật sự (không phải trạng thái thu gọn).
      if (isBottomPanelOpen && !isLogCollapsed && sizes.bottomPanel) {
        logPanelRef.current?.resize(`${sizes.bottomPanel}px`)
      }
    }, 0)
    return () => window.clearTimeout(id)
  }, [
    project?.id,
    focusCanvas,
    isSidebarOpen,
    isBottomPanelOpen,
    isLogCollapsed,
    logPanelRef,
    sidebarPanelRef,
  ])

  /* Trợ lý AI luôn được mount (kể cả khi panel đóng) để phiên đang chạy không bị ngắt:
     panel chỉ thu gọn về 0px thay vì tháo khỏi cây React. Dùng layout effect để thu gọn
     trước khi trình duyệt vẽ, tránh nháy panel một khung hình. */
  useLayoutEffect(() => {
    const panel = aiPanelRef.current
    if (!panel) return
    if (aiPanelOpen && !focusCanvas) {
      panel.expand()
      const saved = panelSizesRef.current.aiPanel
      if (saved) panel.resize(`${saved}px`)
    } else {
      panel.collapse()
    }
  }, [aiPanelOpen, focusCanvas, aiPanelRef])

  /* Panel phải cũng luôn được mount (chỉ thu gọn khi đóng hoặc khi Trợ lý AI mở):
     nếu tháo hẳn khỏi Group, mỗi lần panel khác mount lại thư viện sẽ khôi phục
     kích thước đã thu gọn và panel tự bung ra ngoài ý muốn. */
  useLayoutEffect(() => {
    const panel = rightPanelRef.current
    if (!panel) return
    if (isRightPanelOpen && !aiPanelOpen && !focusCanvas) {
      panel.expand()
      const saved = panelSizesRef.current.rightPanel
      if (saved) panel.resize(`${saved}px`)
    } else {
      panel.collapse()
    }
  }, [isRightPanelOpen, aiPanelOpen, focusCanvas, rightPanelRef])

  // Bảng nhật ký bị tháo ra khi đóng/mở lại → khôi phục chiều cao trước đó.
  const wasBottomPanelOpenRef = useRef(isBottomPanelOpen)
  useEffect(() => {
    const wasOpen = wasBottomPanelOpenRef.current
    wasBottomPanelOpenRef.current = isBottomPanelOpen
    if (!isBottomPanelOpen || wasOpen || isLogCollapsed) return
    const saved = panelSizesRef.current.bottomPanel
    if (!saved) return
    const id = window.setTimeout(() => logPanelRef.current?.resize(`${saved}px`), 0)
    return () => window.clearTimeout(id)
  }, [isBottomPanelOpen, isLogCollapsed, logPanelRef])

  // Dọn timer lưu kích thước khi đóng Workspace.
  useEffect(() => {
    return () => {
      if (panelPersistTimerRef.current !== null) {
        window.clearTimeout(panelPersistTimerRef.current)
      }
    }
  }, [])
  const [localReloadToken, setLocalReloadToken] = useState(0)
  const [isBufferDirty, setIsBufferDirty] = useState(editorBuffer.isDirty())
  const [aiSelection, setAiSelection] = useState<AiSelectedElement | null>(null)
  const [referenceAsset, setReferenceAsset] = useState<ReferenceAsset | null>(null)
  const [aiInitialTab, setAiInitialTab] = useState<AiTab>('chat')

  // Đổi dự án thì bỏ ảnh mẫu cũ để tránh hiển thị nhầm ảnh của dự án trước.
  useEffect(() => {
    setReferenceAsset(null)
  }, [project?.id])

  // Nút "Tải lại giao diện Canvas" trên menu bar phát sự kiện này.
  useEffect(() => {
    const handleReloadCanvas = () => setLocalReloadToken((v) => v + 1)
    window.addEventListener('pixelmind:reload-canvas', handleReloadCanvas)
    return () => window.removeEventListener('pixelmind:reload-canvas', handleReloadCanvas)
  }, [])

  // Ghi nhớ trạng thái thu gọn bảng nhật ký và khôi phục đúng chiều cao khi mở lại app.
  useEffect(() => persistFlag(LAYOUT_KEYS.logCollapsed, isLogCollapsed), [isLogCollapsed])
  useEffect(() => {
    if (!isLogCollapsed || !isBottomPanelOpen) return
    const id = window.setTimeout(() => {
      try {
        logPanelRef.current?.resize('36px')
      } catch {}
    }, 0)
    return () => window.clearTimeout(id)
  }, [isLogCollapsed, isBottomPanelOpen, logPanelRef])

  // Đăng ký lắng nghe thay đổi của EditorBuffer (RAM Model chuẩn VS 2022)
  useEffect(() => {
    return editorBuffer.subscribe(() => {
      setIsBufferDirty(editorBuffer.isDirty())
    })
  }, [])

  // Phím tắt bàn phím toàn cục: Ctrl+S (Lưu), Ctrl+Z (Hoàn tác), Ctrl+Y (Làm lại), Ctrl+B (Toggle Sidebar)
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // Workspace vẫn mounted khi ở màn hình khác (giữ phiên AI) → chỉ nhận phím tắt khi đang hiển thị.
      if (!active) return
      const target = e.target as HTMLElement
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

      // Ctrl + Shift + A: Bật / Tắt Trợ lý AI
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        onToggleAIPanel?.()
        return
      }

      // Ctrl + B: Bật / Tắt Sidebar Trái
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        onToggleSidebar?.()
        return
      }

      // Ctrl + J: Bật / Tắt Bottom Panel (Nhật ký / Terminal)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        onToggleBottomPanel?.()
        return
      }

      // Ctrl + Alt + B hoặc Ctrl + Shift + R: Bật / Tắt Right Panel
      if ((e.ctrlKey || e.metaKey) && ((e.altKey && e.key.toLowerCase() === 'b') || (e.shiftKey && e.key.toLowerCase() === 'r'))) {
        e.preventDefault()
        onToggleRightPanel?.()
        return
      }

      // Ctrl + Shift + E: Tab Files
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        onSidebarTabChange?.('files')
        if (!isSidebarOpen) onToggleSidebar?.()
        return
      }

      // Ctrl + Shift + L: Tab Layers
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        onSidebarTabChange?.('layers')
        if (!isSidebarOpen) onToggleSidebar?.()
        return
      }

      // Ctrl + Alt + X: Mở Hộp công cụ (Toolbox)
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'x') {
        e.preventDefault()
        onSidebarTabChange?.('toolbox')
        if (!isSidebarOpen) onToggleSidebar?.()
        return
      }

      // Ctrl + S: Lưu tất cả thay đổi RAM buffer vào tệp vật lý
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        editorBuffer.saveAllDirtyFiles()
        return
      }

      // Ctrl + Z: Hoàn tác
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (!isInput && editorBuffer.canUndo()) {
          e.preventDefault()
          editorBuffer.undo()
        }
        return
      }

      // Ctrl + Y hoặc Ctrl + Shift + Z: Làm lại
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        if (!isInput && editorBuffer.canRedo()) {
          e.preventDefault()
          editorBuffer.redo()
        }
        return
      }
    }

    window.addEventListener('keydown', handleGlobalShortcuts)
    return () => window.removeEventListener('keydown', handleGlobalShortcuts)
  }, [active, isSidebarOpen, onToggleSidebar, onSidebarTabChange, onToggleAIPanel])

  // Lắng nghe phím Escape để thoát chế độ Focus Canvas
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusCanvas) {
        setFocusCanvas(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusCanvas])

  if (!project) {
    return (
      <div className="pm-workspace" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="pm-empty" style={{ border: 0, background: 'transparent' }}>
          <div className="pm-empty__ico">
            <FolderOpen size={20} />
          </div>
          <h3>Chưa mở dự án nào</h3>
          <p>Chọn một thư mục mã nguồn để bắt đầu xem cây tệp, chạy máy chủ và xem trước giao diện.</p>
          <div className="pm-empty__actions">
            <button className="btn primary" onClick={onOpenFolder}>
              <FolderOpen size={13} /> Mở thư mục dự án
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* Panel AI và panel phải luôn nằm trong Group; khi ẩn chỉ thu gọn về 0px.
     defaultSize = 0 lúc ẩn để nếu thư viện khởi tạo lại layout (khi panel khác
     mount/unmount) thì chúng vẫn giữ 0px thay vì bung về kích thước mặc định. */
  const aiVisible = aiPanelOpen && !focusCanvas
  const rightPanelVisible = isRightPanelOpen && !aiPanelOpen && !focusCanvas
  const aiDefaultSize = aiVisible
    ? `${panelSizesRef.current.aiPanel ?? initialPanelSizes.aiPanel ?? DEFAULT_AI_PANEL_WIDTH}px`
    : '0px'
  const rightPanelDefaultSize = rightPanelVisible
    ? `${panelSizesRef.current.rightPanel ?? initialPanelSizes.rightPanel ?? DEFAULT_RIGHT_PANEL_WIDTH}px`
    : '0px'

  return (
    <div className="pm-workspace">
      <Group orientation="horizontal" style={{ flex: 1 }}>
        {/* ── Cột Sidebar 7-trong-1 (Ẩn khi ở chế độ Focus Canvas) ── */}
        {!focusCanvas && (
          isSidebarOpen ? (
            <>
              <Panel
                panelRef={sidebarPanelRef}
                defaultSize={`${initialPanelSizes.sidebar ?? DEFAULT_SIDEBAR_WIDTH}px`}
                minSize={PANEL_SIZE_LIMITS.sidebar.min}
                maxSize={PANEL_SIZE_LIMITS.sidebar.max}
                collapsible
                onResize={(size) => {
                  // Kéo qua ngưỡng thu gọn: đồng bộ cờ mở/đóng để nút trên thanh công cụ đổi theo.
                  const collapsed = (sidebarPanelRef.current?.isCollapsed() ?? false) || size.inPixels <= 0
                  if (collapsed) {
                    if (isSidebarOpen && !sidebarCollapseHandledRef.current) {
                      sidebarCollapseHandledRef.current = true
                      // Nhớ kích thước trước khi kéo qua ngưỡng, tránh lần sau mở lại ở mức tối thiểu.
                      rememberPanelSize('sidebar', sidebarComfortRef.current)
                      onToggleSidebar?.()
                    }
                    return
                  }
                  sidebarCollapseHandledRef.current = false
                  if (size.inPixels >= PANEL_SIZE_LIMITS.sidebar.min + 24) {
                    sidebarComfortRef.current = Math.round(size.inPixels)
                  }
                  rememberPanelSize('sidebar', size.inPixels)
                }}
              >
                <WorkspaceSidebar
                  project={project}
                  tree={tree}
                  treeLoading={treeLoading}
                  selectedPath={selectedPath}
                  query={query}
                  onQuery={onQuery}
                  onSelectFile={onSelectFile}
                  onRefresh={onRefresh}
                  onOpenFolder={onOpenFolder}
                  activeTab={sidebarTab}
                  onOpenPreview={() => onActiveTab('preview')}
                  onActiveTabChange={(tab) => {
                    if (sidebarTab === tab) {
                      onToggleSidebar?.()
                    } else {
                      onSidebarTabChange?.(tab)
                    }
                  }}
                  onCloseSidebar={() => onToggleSidebar?.()}
                  onOpenPage={onOpenPage ?? (() => {})}
                  onAddPage={onAddPage ?? (() => {})}
                  onEditPage={onEditPage}
                  onDeletePage={onDeletePage}
                  onDuplicatePage={onDuplicatePage}
                  onOpenParamChooser={onOpenParamChooser}
                  currentRoute={currentRoute}
                  onOpenTokens={onOpenTokens ?? (() => {})}
                  branch={branch}
                  onShowToast={onShowToast ?? (() => {})}
                  isRunning={run?.status === 'running' || run?.status === 'starting'}
                  onRun={onRun}
                  referenceAssetPath={referenceAsset?.path ?? null}
                  onSelectReference={setReferenceAsset}
                  onClearReference={() => setReferenceAsset(null)}
                />
              </Panel>
              <Separator className="pm-resize" />
            </>
          ) : (
            /* Khi Sidebar thu gọn: Hiển thị Activity Bar 44px nhỏ gọn để 1-click mở lại bất kỳ tab nào */
            <div
              className="pm-ws-activity-bar"
              style={{ borderRight: '1px solid var(--line)' }}
              title="Nhấp vào biểu tượng bất kỳ để mở rộng thanh bên (Ctrl+B)"
            >
              <button
                className={`pm-ws-tab-btn ${sidebarTab === 'files' ? 'active' : ''}`}
                onClick={() => {
                  onSidebarTabChange?.('files')
                  onToggleSidebar?.()
                }}
                title="Mở Tệp mã nguồn (Ctrl+Shift+E)"
              >
                <FolderTree size={16} />
              </button>
              <button
                className={`pm-ws-tab-btn ${sidebarTab === 'layers' ? 'active' : ''}`}
                onClick={() => {
                  onSidebarTabChange?.('layers')
                  onToggleSidebar?.()
                }}
                title="Mở Cây phân cấp (Layers · Ctrl+Shift+L)"
              >
                <Layers size={16} />
              </button>
              <button
                className={`pm-ws-tab-btn ${sidebarTab === 'pages' ? 'active' : ''}`}
                onClick={() => {
                  onSidebarTabChange?.('pages')
                  onToggleSidebar?.()
                }}
                title="Mở Danh sách trang (Pages)"
              >
                <FileText size={16} />
              </button>
              <button
                className={`pm-ws-tab-btn ${sidebarTab === 'assets' ? 'active' : ''}`}
                onClick={() => {
                  onSidebarTabChange?.('assets')
                  onToggleSidebar?.()
                }}
                title="Mở Tài nguyên & Ảnh mẫu (Assets)"
              >
                <ImageIcon size={16} />
              </button>
              <button
                className={`pm-ws-tab-btn ${sidebarTab === 'versions' ? 'active' : ''}`}
                onClick={() => {
                  onSidebarTabChange?.('versions')
                  onToggleSidebar?.()
                }}
                title="Mở Lịch sử phiên bản (Versions)"
              >
                <History size={16} />
              </button>
              <button
                className={`pm-ws-tab-btn ${sidebarTab === 'design' ? 'active' : ''}`}
                onClick={() => {
                  onSidebarTabChange?.('design')
                  onToggleSidebar?.()
                }}
                title="Mở Hệ thống thiết kế (Design Tokens)"
              >
                <Palette size={16} />
              </button>
              <button
                className={`pm-ws-tab-btn ${sidebarTab === 'toolbox' ? 'active' : ''}`}
                onClick={() => {
                  onSidebarTabChange?.('toolbox')
                  onToggleSidebar?.()
                }}
                title="Mở Hộp công cụ (Ctrl+Alt+X)"
              >
                <Boxes size={16} />
              </button>
            </div>
          )
        )}

        {/* ── Nội dung chính ── */}
        <Panel minSize="15%">
          <div className="pm-panel">
            {/* Thanh Tabs */}
            <div className="pm-tabs">
              <button
                className={`pm-tab ${activeTab === 'preview' ? 'on' : ''}`}
                onClick={() => onActiveTab('preview')}
              >
                <Globe2 size={11} /> Xem trước{isBufferDirty ? '*' : ''}
                {run?.url && <span className="pm-dot live" style={{ marginLeft: 2 }} />}
              </button>
              {tabs.map((path) => {
                const name = path.split(/[\\/]/).pop()
                return (
                  <button
                    key={path}
                    className={`pm-tab ${activeTab === 'file' && selectedPath === path ? 'on' : ''}`}
                    onClick={() => onSelectTab(path)}
                    title={path}
                  >
                    <FileCode2 size={11} />
                    <span>{name}{editorBuffer.isDirty(path) ? '*' : ''}</span>
                    <span
                      className="pm-tab__x"
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation()
                        onCloseTab(path)
                      }}
                      title="Đóng tab"
                    >
                      <X size={10} />
                    </span>
                  </button>
                )
              })}
              <span style={{ flex: 1 }} />

              {/* Nhóm tiện ích: Chế độ Toàn màn hình Canvas */}
              {activeTab === 'preview' && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
                  {/* Nút Chế độ tập trung Canvas (Toàn màn hình) */}
                  <button
                    className={`pm-ibtn ${focusCanvas ? 'on' : ''}`}
                    onClick={() => setFocusCanvas((v) => !v)}
                    title={focusCanvas ? 'Thoát chế độ tập trung (Esc)' : 'Chế độ tập trung toàn màn hình Canvas'}
                    style={{
                      height: 26,
                      fontSize: 11,
                      gap: 4,
                      padding: '0 8px',
                      width: 'auto',
                      display: 'inline-flex',
                    }}
                  >
                    {focusCanvas ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                    <span>{focusCanvas ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Vùng hiển thị Canvas hoặc FileViewer kết hợp Nhật ký chạy phía dưới */}
            <Group orientation="vertical" style={{ flex: 1, minHeight: 0 }}>
              <Panel minSize="20%">
                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                  {activeTab === 'preview' ? (
                    <CanvasArea
                      url={canvasUrl}
                      running={run?.status === 'running' || run?.status === 'starting'}
                      canvasSettings={toWorkspaceCanvasSettings(settings)}
                      projectName={project.name}
                      projectPath={project.path}
                      error={parsedError}
                      installing={installing}
                      onRun={onRun}
                      onStop={onStop}
                      onOpenExternal={onOpenExternal}
                      onInstall={onInstall}
                      onCreateIndexHtml={onCreateIndexHtml}
                      onAddDevScript={onAddDevScript}
                      onUrlChange={onUrlChange}
                      pages={project.meta.pages}
                      currentRoute={currentRoute ?? null}
                      onOpenPage={onOpenPage}
                      onOpenAIPanel={onToggleAIPanel}
                      onSelectionChange={setAiSelection}
                      reloadToken={(canvasReloadToken ?? 0) + localReloadToken}
                      referenceAsset={referenceAsset}
                      onClearReference={() => setReferenceAsset(null)}
                      onOpenAssets={() => {
                        onSidebarTabChange?.('assets')
                        if (!isSidebarOpen) onToggleSidebar?.()
                      }}
                    />
                  ) : (
                    <FileViewer
                      file={file}
                      loading={fileLoading}
                      projectPath={project?.path}
                      autoSave={settings.autoSave !== false}
                      rootPath={project.path}
                      initialLine={initialLine}
                      initialMatch={initialMatch}
                      onOpenExternal={onOpenFileExternal}
                      onShowInFolder={onShowInFolder}
                      onShowToast={onShowToast}
                      onRevealInTree={(path) => {
                        const fileName = path.split(/[\\/]/).pop() || ''
                        const fileExt = fileName.split('.').pop() || ''
                        onSelectFile({ path, name: fileName, ext: fileExt, type: 'file', size: 0 })
                      }}
                    />
                  )}
                </div>
              </Panel>

              {/* Dải phân cách kéo co giãn dọc */}
              {isBottomPanelOpen && <Separator className="pm-resize-horizontal" />}

              {/* Panel Nhật ký chạy ở dưới cùng */}
              {isBottomPanelOpen && (
                <Panel
                  panelRef={logPanelRef}
                  defaultSize={
                    initialPanelSizes.bottomPanel ? `${initialPanelSizes.bottomPanel}px` : '24%'
                  }
                  minSize="36px"
                  maxSize="75%"
                  onResize={(size) => {
                    const px = size.inPixels
                    setIsLogCollapsed(px <= 45)
                    // Bỏ qua lúc thu gọn để không ghi đè chiều cao đang dùng.
                    if (px > 45) rememberPanelSize('bottomPanel', px)
                  }}
                >
                  <LogPanel
                    logs={logs}
                    run={run}
                    projectId={project?.id}
                    projectPath={project?.path}
                    installing={installing}
                    onInstall={onInstall}
                    onRetry={onRun}
                    onOpenFile={(target) => {
                      const match = tabs.find((t) => t.toLowerCase().endsWith(target.toLowerCase()))
                      if (match) {
                        onSelectTab(match)
                      } else if (project) {
                        const full = `${project.path}/${target}`.replace(/\\/g, '/')
                        onSelectTab(full)
                      }
                    }}
                    onClear={onClearLogs}
                    isCollapsed={isLogCollapsed}
                    onAskAI={() => {
                      setAiInitialTab('errors')
                      if (!aiPanelOpen && onToggleAIPanel) {
                        onToggleAIPanel()
                      }
                    }}
                    onToggleCollapse={() => {
                      if (logPanelRef.current) {
                        if (isLogCollapsed) {
                          logPanelRef.current.resize('24%')
                          setIsLogCollapsed(false)
                        } else {
                          logPanelRef.current.resize('36px')
                          setIsLogCollapsed(true)
                        }
                      }
                    }}
                  />
                </Panel>
              )}
            </Group>
          </div>
        </Panel>

        {/* ── RunSidebar (tự thu gọn về 0px khi AI mở để nhường cột phải cho Trợ lý AI) ── */}
        {rightPanelVisible && <Separator className="pm-resize" />}
        <Panel
          panelRef={rightPanelRef}
          defaultSize={rightPanelDefaultSize}
          minSize={PANEL_SIZE_LIMITS.rightPanel.min}
          maxSize={PANEL_SIZE_LIMITS.rightPanel.max}
          collapsible
          onResize={(size) => {
            const collapsed = (rightPanelRef.current?.isCollapsed() ?? false) || size.inPixels <= 0
            if (collapsed) {
              // Chỉ coi là người dùng kéo đóng khi panel đang thực sự hiển thị.
              if (rightPanelVisible && !rightCollapseHandledRef.current) {
                rightCollapseHandledRef.current = true
                rememberPanelSize('rightPanel', rightComfortRef.current)
                onToggleRightPanel?.()
              }
              return
            }
            rightCollapseHandledRef.current = false
            if (rightPanelVisible) {
              if (size.inPixels >= PANEL_SIZE_LIMITS.rightPanel.min + 24) {
                rightComfortRef.current = Math.round(size.inPixels)
              }
              rememberPanelSize('rightPanel', size.inPixels)
            }
          }}
        >
              <div className="pm-panel" style={{ borderLeft: '1px solid var(--line)' }}>
                <RunSidebar
                  project={project}
                  run={run}
                  settings={settings}
                  stats={stats}
                  branch={branch}
                  script={script}
                  diagnosis={diagnosis}
                  installing={installing}
                  onScript={onScript}
                  customCommand={customCommand}
                  onCustomCommand={onCustomCommand}
                  onSaveCustomCommand={onSaveCustomCommand}
                  onRun={onRun}
                  onStop={onStop}
                  onReveal={onReveal}
                  onRefresh={onRefresh}
                  onSettings={onSettings}
                  onOpenExternal={onOpenExternal}
                  onOpenDiagnosis={onOpenDiagnosis}
                  onInstall={onInstall}
                  onCreateIndexHtml={onCreateIndexHtml}
                  onAddDevScript={onAddDevScript}
                />
              </div>
        </Panel>

        {/* ── Trợ lý AI: dock thật vào layout, không đè lên nội dung ──
             Panel luôn được render; khi đóng chỉ thu gọn về 0px để AIPanel không bị
             unmount (mất listener stream) nếu người dùng đóng panel hoặc đổi màn hình. */}
        {aiVisible && (
          <Separator
            className="pm-resize pm-resize-ai"
            title="Kéo để thay đổi độ rộng Trợ lý AI"
          />
        )}
        <Panel
          panelRef={aiPanelRef}
          className="pm-ai-panel"
          defaultSize={aiDefaultSize}
          minSize={PANEL_SIZE_LIMITS.aiPanel.min}
          maxSize={PANEL_SIZE_LIMITS.aiPanel.max}
          collapsible
          onResize={(size) => {
            const collapsed = (aiPanelRef.current?.isCollapsed() ?? false) || size.inPixels <= 0
            if (collapsed) {
              if (aiPanelOpen && !focusCanvas && !aiCollapseHandledRef.current) {
                aiCollapseHandledRef.current = true
                rememberPanelSize('aiPanel', aiComfortRef.current)
                onToggleAIPanel?.()
              }
              return
            }
            aiCollapseHandledRef.current = false
            if (aiPanelOpen && !focusCanvas) {
              if (size.inPixels >= PANEL_SIZE_LIMITS.aiPanel.min + 24) {
                aiComfortRef.current = Math.round(size.inPixels)
              }
              rememberPanelSize('aiPanel', size.inPixels)
            }
          }}
        >
          <AIPanel
            open
            onClose={() => onToggleAIPanel?.()}
            projectId={project.id}
            projectPath={project.path}
            projectName={project.name}
            route={currentRoute}
            selected={aiSelection}
            parsedError={parsedError}
            rawLogs={logs}
            initialTab={aiInitialTab}
            onTriggerBuild={onRun}
            errorLog={
              parsedError
                ? [
                    parsedError.title,
                    parsedError.summary,
                    parsedError.file
                      ? `${parsedError.file}${parsedError.line ? `:${parsedError.line}` : ''}`
                      : '',
                    parsedError.recommendation,
                  ]
                    .filter(Boolean)
                    .join('\n')
                : ''
            }
            onOpenDesign={() => onOpenDesign?.()}
            onOpenTheme={() => onOpenTheme?.()}
            onOpenSettings={onSettings}
            onApplied={onAIApplied}
            onShowToast={onShowToast ?? (() => {})}
          />
        </Panel>
      </Group>
    </div>
  )
}

export default WorkspaceView
