import type {
  AppInfo,
  DesignTokens,
  FileContent,
  FileNode,
  GitGraphData,
  GitGraphScope,
  GitRollbackResult,
  ProjectDiagnosis,
  ProjectPage,
  ProjectRecord,
  ProjectStat,
  PageFilePreview,
  RunLog,
  RunState,
  Settings,
  StoreData,
  TerminalCreateOptions,
  TerminalDataEvent,
  TerminalExitEvent,
  TerminalSession,
} from './types'
import type {
  MutationPreview,
  ProjectScanResult,
  ToolboxMutationPayload,
  ToolboxWritePayload,
  ToolboxWriteResult,
} from './toolbox'
import type { AiApi } from './ai'

/** Hợp đồng API mà preload (Electron) và bản giả lập trên trình duyệt cùng cài đặt. */
export interface PixelMindApi {
  getAppInfo(): Promise<AppInfo>
  store: {
    get(): Promise<StoreData>
    patch(patch: Partial<StoreData>): Promise<StoreData>
    updateSettings(patch: Partial<Settings>): Promise<Settings>
    resetSettings?(): Promise<Settings>
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
    addPage(
      projectId: string,
      page: Omit<ProjectPage, 'id'>,
      options?: { createFile?: boolean },
    ): Promise<ProjectRecord | null>
    updatePage(projectId: string, page: ProjectPage): Promise<ProjectRecord | null>
    removePage(
      projectId: string,
      pageId: string,
      options?: { deleteFile?: boolean },
    ): Promise<ProjectRecord | null>
    duplicatePage(
      projectId: string,
      pageId: string,
      payload: { route: string; title: string; copyFile?: boolean },
    ): Promise<ProjectRecord | null>
    /** Dò xem route sẽ tạo tệp ở đâu, có hỗ trợ không và có trùng tệp không. */
    pageFilePreview(projectId: string, route: string): Promise<PageFilePreview>
    diagnose(idOrPath: string): Promise<ProjectDiagnosis>
    /** Đọc đồ thị commit thật từ .git (mọi nhánh hoặc nhánh hiện tại). */
    gitGraph(projectId: string, scope?: GitGraphScope): Promise<GitGraphData>
    /** Chạy git fetch --all --prune để cập nhật remote-tracking branches. */
    gitFetch(projectId: string): Promise<{ ok: boolean; error?: string }>
    /** Khôi phục mã nguồn về commit đã chọn, có tạo nhánh backup trước. */
    gitRollback(projectId: string, hash: string): Promise<GitRollbackResult>
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
    createFile(path: string, initialContent?: string): Promise<boolean>
    createDir(path: string): Promise<boolean>
    rename(oldPath: string, newPath: string): Promise<boolean>
    trash(path: string): Promise<boolean>
  }
  assets: {
    /** Mở hộp thoại chọn ảnh và copy vào thư mục assets/ của dự án. */
    add(projectPath: string): Promise<{
      canceled: boolean
      added: Array<{ source: string; destination: string; copied: boolean }>
      error?: string
    }>
    /** Chuyển một tệp ảnh vào Thùng rác, giữ bản sao lưu để hoàn tác. */
    remove(path: string): Promise<{ success: boolean; backupPath?: string; error?: string }>
    /** Khôi phục tệp từ bản sao lưu về đường dẫn cũ (dùng cho Undo/Redo). */
    restore(
      backupPath: string,
      destination: string,
    ): Promise<{ success: boolean; path?: string; error?: string }>
  }
  run: {
    start(projectId: string, script: string): Promise<RunState>
    install(projectId: string): Promise<RunState>
    startCommand(projectId: string, command: string): Promise<RunState>
    stop(runId: string): Promise<boolean>
    stopOfProject?(projectId: string): Promise<boolean>
    stopAll?(): Promise<boolean>
    list(): Promise<RunState[]>
    ofProject(projectId: string): Promise<RunState | null>
    onLog(cb: (log: RunLog) => void): () => void
    onState(cb: (state: RunState) => void): () => void
  }
  terminal: {
    create(options?: TerminalCreateOptions): Promise<TerminalSession>
    write(sessionId: string, data: string): Promise<boolean>
    resize(sessionId: string, cols: number, rows: number): Promise<boolean>
    kill(sessionId: string): Promise<boolean>
    killAll(): Promise<boolean>
    list(): Promise<TerminalSession[]>
    onData(cb: (event: TerminalDataEvent) => void): () => void
    onExit(cb: (event: TerminalExitEvent) => void): () => void
  }
  system: {
    openExternal(url: string): Promise<boolean>
    onMenuAction(cb: (action: string) => void): () => void
    popupMenu?(menuIndex: number, x: number, y: number): Promise<boolean>
    clearCache?(): Promise<boolean>
  }
  inspect: {
    setMode(enabled: boolean): Promise<boolean>
    applyStyle(payload: { styles?: Record<string, string>; textContent?: string }): Promise<boolean>
    resetOriginal(): Promise<boolean>
    locateSource(payload: {
      projectPath: string
      textSnippet?: string
      tagName?: string
      className?: string
      currentPath?: string
      id?: string
      selector?: string
    }): Promise<{ filePath: string; fullPath: string; lineNumber: number; lineContent: string } | null>
    syncCode(payload: {
      fullPath: string
      oldText?: string
      newText?: string
      styles?: Record<string, string>
      tagName?: string
      lineNumber?: number
    }): Promise<{ success: boolean; error?: string; oldLine?: string; newLine?: string }>
    syncNav(payload: {
      projectPath: string
      currentPath?: string
      targetRoute: string
      action: 'link' | 'unlink'
      textSnippet?: string
      tagName?: string
      className?: string
      id?: string
    }): Promise<{
      success: boolean
      error?: string
      filePath?: string
      lineNumber?: number
      oldLine?: string
      newLine?: string
    }>
  }
  tokens: {
    get(projectPath: string): Promise<DesignTokens>
    save(payload: {
      projectPath: string
      tokens: DesignTokens
      syncTarget?: 'css' | 'tailwind' | 'both'
    }): Promise<{ success: boolean; filePath?: string; tailwindPath?: string; error?: string }>
  }
  toolbox: {
    /** Xem trước hoặc áp dụng một phép biến đổi phần tử. */
    mutate(payload: ToolboxMutationPayload): Promise<MutationPreview>
    /** Ghi đè toàn bộ nội dung tệp (dùng cho Undo/Redo). */
    writeFile(payload: ToolboxWritePayload): Promise<ToolboxWriteResult>
    /** Quét component / partial / class / asset / route của dự án. */
    scan(projectPath: string): Promise<ProjectScanResult>
  }
  ai: AiApi
  window?: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
    isMaximized: () => Promise<boolean>
    setZoomFactor?: (factor: number) => void
    getZoomFactor?: () => number
  }
}
