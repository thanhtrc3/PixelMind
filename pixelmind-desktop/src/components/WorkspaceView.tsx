import { useEffect, useMemo, useState } from 'react'
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels'
import {
  FileCode2,
  FolderOpen,
  Globe2,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import type {
  FileContent,
  FileNode,
  ProjectDiagnosis,
  ProjectRecord,
  ProjectStat,
  RunLog,
  RunState,
  Settings,
} from '@shared/types'
import { parseRunError } from '../lib/errorParser'
import { editorBuffer } from '../lib/editorBuffer'
import FileTree from './FileTree'
import FileViewer from './FileViewer'
import CanvasArea from './CanvasArea'
import LogPanel from './LogPanel'
import RunSidebar from './RunSidebar'

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
}: WorkspaceViewProps) => {
  const parsedError = useMemo(() => parseRunError(logs, run), [logs, run])
  /* App có thể đã nắn chỉnh route ASP.NET Core; ưu tiên URL đó. */
  const canvasUrl = previewUrl ?? run?.url ?? null

  const logPanelRef = usePanelRef()
  const [isLogCollapsed, setIsLogCollapsed] = useState(false)
  // Chế độ tập trung toàn màn hình Canvas (ẩn cả cây tệp và sidebar)
  const [focusCanvas, setFocusCanvas] = useState(false)
  const [isBufferDirty, setIsBufferDirty] = useState(editorBuffer.isDirty())

  // Đăng ký lắng nghe thay đổi của EditorBuffer (RAM Model chuẩn VS 2022)
  useEffect(() => {
    return editorBuffer.subscribe(() => {
      setIsBufferDirty(editorBuffer.isDirty())
    })
  }, [])

  // Phím tắt bàn phím toàn cục: Ctrl+S (Lưu), Ctrl+Z (Hoàn tác), Ctrl+Y (Làm lại)
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

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
  }, [])

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
        {/* ── Cây tệp (Ẩn khi ở chế độ Focus Canvas) ── */}
        {!focusCanvas && (
          <>
            <Panel defaultSize="270px" minSize="190px" maxSize="440px" collapsible>
              <div className="pm-panel" style={{ borderRight: '1px solid var(--line)' }}>
                <div className="pm-panel__hd">
                  <b>Tệp</b>
                  <span className="pm-muted" style={{ fontSize: 10.5 }}>
                    {project.name}
                  </span>
                  <span style={{ flex: 1 }} />
                  <button className="pm-ibtn" onClick={onRefresh} title="Tải lại cây tệp (Ctrl+R)">
                    <RefreshCw size={12} />
                  </button>
                  <button className="pm-ibtn" onClick={onOpenFolder} title="Mở thư mục khác">
                    <FolderOpen size={12} />
                  </button>
                </div>
                <div className="pm-tree__filter">
                  <div className="pm-searchbox" style={{ width: '100%' }}>
                    <Search size={12} />
                    <input
                      value={query}
                      placeholder="Lọc theo tên tệp…"
                      style={{ width: '100%' }}
                      onChange={(e) => onQuery(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
                <div className="pm-panel__bd">
                  {treeLoading ? (
                    <div className="pm-row pm-muted" style={{ padding: 12, gap: 7, fontSize: 11.5 }}>
                      <Loader2 size={12} className="spin" /> Đang đọc thư mục…
                    </div>
                  ) : (
                    <FileTree
                      nodes={tree}
                      rootPath={project.path}
                      selectedPath={selectedPath}
                      query={query}
                      onSelect={onSelectFile}
                    />
                  )}
                </div>
              </div>
            </Panel>
            <Separator className="pm-resize" />
          </>
        )}

        {/* ── Nội dung chính ── */}
        <Panel minSize="34%">
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

              {/* Nút Chế độ tập trung Canvas (Toàn màn hình) */}
              {activeTab === 'preview' && (
                <button
                  className={`pm-ibtn ${focusCanvas ? 'on' : ''}`}
                  onClick={() => setFocusCanvas((v) => !v)}
                  title={focusCanvas ? 'Thoát chế độ tập trung (Esc)' : 'Chế độ tập trung toàn màn hình Canvas'}
                  style={{
                    height: 24,
                    fontSize: 11,
                    gap: 4,
                    padding: '0 8px',
                    width: 'auto',
                    display: 'inline-flex',
                    marginLeft: 4,
                  }}
                >
                  {focusCanvas ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                  <span>{focusCanvas ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
                </button>
              )}
            </div>

            {/* Vùng hiển thị Canvas hoặc FileViewer kết hợp Nhật ký chạy phía dưới (kéo thả linh hoạt như 2 bên trái phải) */}
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
                    />
                  ) : (
                    <FileViewer
                      file={file}
                      loading={fileLoading}
                      onOpenExternal={onOpenFileExternal}
                      onShowInFolder={onShowInFolder}
                    />
                  )}
                </div>
              </Panel>

              {/* Dải phân cách kéo co giãn dọc mượt mà như 2 bên trái phải */}
              <Separator className="pm-resize-horizontal" />

              {/* Panel Nhật ký chạy ở dưới cùng, có thể kéo lên kéo xuống thoải mái */}
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
            </Group>
          </div>
        </Panel>

        {/* ── RunSidebar (Ẩn khi ở chế độ Focus Canvas) ── */}
        {!focusCanvas && (
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

      </Group>
    </div>
  )
}

export default WorkspaceView
