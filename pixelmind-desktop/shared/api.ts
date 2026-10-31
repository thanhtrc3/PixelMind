import type {
  AppInfo,
  FileContent,
  FileNode,
  ProjectDiagnosis,
  ProjectPage,
  ProjectRecord,
  ProjectStat,
  RunLog,
  RunState,
  Settings,
  StoreData,
} from './types'

/** Hợp đồng API mà preload (Electron) và bản giả lập trên trình duyệt cùng cài đặt. */
export interface PixelMindApi {
  getAppInfo(): Promise<AppInfo>
  store: {
    get(): Promise<StoreData>
    patch(patch: Partial<StoreData>): Promise<StoreData>
    updateSettings(patch: Partial<Settings>): Promise<Settings>
    reset(): Promise<StoreData>
    path(): Promise<string>
  }
  projects: {
    pickFolder(): Promise<ProjectRecord | null>
    add(folder: string): Promise<ProjectRecord | null>
    list(): Promise<ProjectRecord[]>
    open(id: string): Promise<ProjectRecord | null>
    remove(id: string): Promise<ProjectRecord[]>
    favorite(id: string): Promise<ProjectRecord[]>
    refresh(id: string): Promise<ProjectRecord | null>
    addPage(projectId: string, page: Omit<ProjectPage, 'id'>): Promise<ProjectRecord | null>
    removePage(projectId: string, pageId: string): Promise<ProjectRecord | null>
    diagnose(idOrPath: string): Promise<ProjectDiagnosis>
    gitInit(projectId: string): Promise<boolean>
    createIndexHtml(projectId: string): Promise<boolean>
    addDevScript(projectId: string): Promise<boolean>
    setCommand(projectId: string, command: string): Promise<ProjectRecord | null>
  }
  fs: {
    tree(root: string, showHidden?: boolean): Promise<FileNode[]>
    read(path: string): Promise<FileContent>
    write(path: string, text: string): Promise<boolean>
    stat(root: string): Promise<ProjectStat>
    git(root: string): Promise<string | null>
    showInFolder(path: string): Promise<void>
    openPath(path: string): Promise<string | null>
    exists(path: string): Promise<boolean>
    special(kind: 'userData' | 'home' | 'documents' | 'desktop'): Promise<string>
  }
  run: {
    start(projectId: string, script: string): Promise<RunState>
    install(projectId: string): Promise<RunState>
    startCommand(projectId: string, command: string): Promise<RunState>
    stop(runId: string): Promise<boolean>
    list(): Promise<RunState[]>
    ofProject(projectId: string): Promise<RunState | null>
    onLog(cb: (log: RunLog) => void): () => void
    onState(cb: (state: RunState) => void): () => void
  }
  system: {
    openExternal(url: string): Promise<boolean>
    onMenuAction(cb: (action: string) => void): () => void
  }
  inspect: {
    setMode(enabled: boolean): Promise<boolean>
    applyStyle(payload: { styles?: Record<string, string>; textContent?: string }): Promise<boolean>
    resetOriginal(): Promise<boolean>
    locateSource(payload: {
      projectPath: string
      textSnippet: string
      tagName: string
      className: string
    }): Promise<{ filePath: string; fullPath: string; lineNumber: number; lineContent: string } | null>
    syncCode(payload: {
      fullPath: string
      oldText?: string
      newText?: string
      styles?: Record<string, string>
      tagName?: string
      lineNumber?: number
    }): Promise<{ success: boolean; error?: string; oldLine?: string; newLine?: string }>
  }
}
