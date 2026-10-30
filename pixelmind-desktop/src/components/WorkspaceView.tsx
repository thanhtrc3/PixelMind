import { useMemo } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import {
  FileCode2,
  FolderOpen,
  Globe2,
  Loader2,
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
import FileTree from './FileTree'
import FileViewer from './FileViewer'
import PreviewPane from './PreviewPane'
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
  customCommand: string
  onCustomCommand: (value: string) => void
  onSaveCustomCommand: (value: string) => void
  onSettings: () => void
  onReveal: () => void
  onOpenExternal: (url: string) => void
  onShowInFolder: (path: string) => void
  onOpenFileExternal: (path: string) => void
  onOpenDiagnosis?: () => void
  onInstall?: () => void
  onCreateIndexHtml?: () => void
  onAddDevScript?: () => void
  previewUrl?: string | null
  onPreviewUrlChange?: (url: string) => void
  targetRoute?: string
  onRouteChange?: (route: string) => void
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
  customCommand,
  onCustomCommand,
  onSaveCustomCommand,
  onSettings,
  onReveal,
  onOpenExternal,
  onShowInFolder,
  onOpenFileExternal,
  onOpenDiagnosis,
  onInstall,
  onCreateIndexHtml,
  onAddDevScript,
  previewUrl,
  onPreviewUrlChange,
  targetRoute,
  onRouteChange,
  activeTab,
  onActiveTab,
  tabs,
  onCloseTab,
  onSelectTab,
}: WorkspaceViewProps) => {
  const parsedError = useMemo(() => parseRunError(logs, run), [logs, run])

  const effectivePreviewUrl = useMemo(() => {
    if (previewUrl) return previewUrl
    if (!run?.url) return null
    if (targetRoute && targetRoute !== '/') {
      const base = run.url.replace(/\/+$/, '')
      const clean = targetRoute.startsWith('/') ? targetRoute : `/${targetRoute}`
      return `${base}${clean}`
    }
    return run.url
  }, [previewUrl, run?.url, targetRoute])

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
        {/* ── Cây tệp ── */}
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

        {/* ── Nội dung ── */}
        <Panel minSize="34%">
          <div className="pm-panel">
            <div className="pm-tabs">
              <button
                className={`pm-tab ${activeTab === 'preview' ? 'on' : ''}`}
                onClick={() => onActiveTab('preview')}
              >
                <Globe2 size={11} /> Xem trước
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
                    <span>{name}</span>
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
            </div>

            <Group orientation="vertical" style={{ flex: 1, minHeight: 0 }}>
              <Panel minSize="22%">
                {activeTab === 'preview' ? (
                  <PreviewPane
                    url={effectivePreviewUrl}
                    pages={project.meta.pages}
                    onUrlChange={onPreviewUrlChange}
                    onSelectRoute={(route) => {
                      let clean = route.startsWith('/') ? route : `/${route}`
                      if (project.packageManager === 'dotnet' || project.framework?.includes('ASP.NET')) {
                        if (clean.startsWith('/account/')) {
                          clean = `/Identity/Account/${clean.slice(9)}`
                        } else if (['/leaderboard', '/lobby', '/profile', '/account', '/privacy', '/room'].includes(clean.toLowerCase())) {
                          clean = `/Home${clean}`
                        }
                      }
                      onRouteChange?.(clean)
                      if (run?.url) {
                        const base = run.url.replace(/\/+$/, '')
                        onPreviewUrlChange?.(clean === '/' ? base : `${base}${clean}`)
                      }
                    }}
                    running={run?.status === 'running' || run?.status === 'starting'}
                    projectName={project.name}
                    error={parsedError}
                    installing={installing}
                    onRun={onRun}
                    onStop={onStop}
                    onOpenExternal={onOpenExternal}
                    onInstall={onInstall}
                  />
                ) : (
                  <FileViewer
                    file={file}
                    loading={fileLoading}
                    onOpenExternal={onOpenFileExternal}
                    onShowInFolder={onShowInFolder}
                  />
                )}
              </Panel>
              <Separator className="pm-resize" style={{ height: 1, width: '100%' }} />
              <Panel defaultSize="26%" minSize="80px" maxSize="60%" collapsible>
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
                />
              </Panel>
            </Group>
          </div>
        </Panel>

        <Separator className="pm-resize" />

        {/* ── Chạy + thông tin ── */}
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
      </Group>
    </div>
  )
}

export default WorkspaceView
