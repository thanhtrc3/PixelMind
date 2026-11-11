import { useEffect, useMemo, useState } from 'react'
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
import { editorBuffer } from '../lib/editorBuffer'
import { LAYOUT_KEYS, persistFlag, readStoredFlag } from '../lib/layoutPrefs'
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
  query: string
  onQuery: (value: string) => void
  onSelectFile: (node: FileNode) => void
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
}

const DEFAULT_AI_PANEL_WIDTH = 400

/** Đọc độ rộng Trợ lý AI đã lưu; không dùng state để tránh re-render khi đang kéo. */
const savedAiPanelWidth = (): number => {
  try {
    const saved = Number(window.localStorage.getItem('pm.aiPanelSize'))
    if (Number.isFinite(saved) && saved >= 220 && saved <= 860) return saved
  } catch {}
  return DEFAULT_AI_PANEL_WIDTH
}

/** Lưu độ rộng panel kế bên thanh kéo (không gây re-render). */
const rememberAiPanelWidth = (panel: Element | null | undefined): void => {
  if (!panel) return
  const width = Math.round(panel.getBoundingClientRect().width)
  if (width < 180) return
  try {
    window.localStorage.setItem('pm.aiPanelSize', String(width))
  } catch {}
}

const WorkspaceView = ({
  project,
  tree,
  treeLoading,
  file,
  fileLoading,
  selectedPath,
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
}: WorkspaceViewProps) => {
  const parsedError = useMemo(() => parseRunError(logs, run), [logs, run])
  /* App có thể đã nắn chỉnh route ASP.NET Core; ưu tiên URL đó. */
  const canvasUrl = previewUrl ?? run?.url ?? null

  const logPanelRef = usePanelRef()
  const [isLogCollapsed, setIsLogCollapsed] = useState(() =>
    readStoredFlag(LAYOUT_KEYS.logCollapsed, false),
  )
  // Chế độ tập trung toàn màn hình Canvas (ẩn cả cây tệp và sidebar)
  const [focusCanvas, setFocusCanvas] = useState(false)
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
  }, [isSidebarOpen, onToggleSidebar, onSidebarTabChange, onToggleAIPanel])

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

  return (
    <div className="pm-workspace">
      <Group orientation="horizontal" style={{ flex: 1 }}>
        {/* ── Cột Sidebar 7-trong-1 (Ẩn khi ở chế độ Focus Canvas) ── */}
        {!focusCanvas && (
          isSidebarOpen ? (
            <>
              <Panel defaultSize="320px" minSize="220px" maxSize="520px" collapsible>
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
                      onOpenExternal={onOpenFileExternal}
                      onShowInFolder={onShowInFolder}
                      onShowToast={onShowToast}
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
                  defaultSize="24%"
                  minSize="36px"
                  maxSize="75%"
                  onResize={() => {
                    if (logPanelRef.current) {
                      try {
                        const px = logPanelRef.current.getSize().inPixels
                        setIsLogCollapsed(px <= 45)
                      } catch {}
                    }
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

        {/* ── RunSidebar (ẩn khi AI mở để nhường cột phải cho Trợ lý AI) ── */}
        {!focusCanvas && isRightPanelOpen && !aiPanelOpen && (
          <>
            <Separator className="pm-resize" />
            <Panel defaultSize="300px" minSize="264px" maxSize="460px" collapsible>
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
          </>
        )}

        {/* ── Trợ lý AI: dock thật vào layout, không đè lên nội dung ── */}
        {!focusCanvas && aiPanelOpen && onToggleAIPanel && onShowToast && (
          <>
            <Separator
              className="pm-resize pm-resize-ai"
              title="Kéo để thay đổi độ rộng Trợ lý AI"
              onPointerUp={(event) =>
                rememberAiPanelWidth(event.currentTarget.nextElementSibling)
              }
              onKeyUp={(event) => {
                if (event.key.startsWith('Arrow')) {
                  rememberAiPanelWidth(event.currentTarget.nextElementSibling)
                }
              }}
            />
            <Panel
              defaultSize={`${savedAiPanelWidth()}px`}
              minSize="220px"
              maxSize="860px"
            >
              <AIPanel
                open={aiPanelOpen}
                onClose={onToggleAIPanel}
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
                onShowToast={onShowToast}
              />
            </Panel>
          </>
        )}
      </Group>
    </div>
  )
}

export default WorkspaceView
