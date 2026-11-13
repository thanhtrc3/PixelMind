import type {
  AppInfo,
  DesignTokens,
  FileContent,
  FileNode,
  GitActionResult,
  GitBranchItem,
  GitCommitResult,
  GitGraphData,
  GitGraphScope,
  GitRollbackResult,
  GitWorkingTreeStatus,
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

export interface FileSearchMatch {
  file: string
  fullPath: string
  line: number
  preview: string
  /** Vị trí bắt đầu của đoạn khớp trong dòng gốc (0-based, tính cả thụt lề). */
  matchStart?: number
  /** Vị trí kết thúc (không bao gồm) trong dòng gốc (0-based). */
  matchEnd?: number
  /** Vị trí khớp trong `preview` (0-based) — dùng để tô sáng trong danh sách kết quả. */
  previewMatchStart?: number
  /** Vị trí kết thúc (không bao gồm) trong `preview` (0-based). */
  previewMatchEnd?: number
}

export interface FileSearchRange {
  /** Cột bắt đầu trong dòng (0-based). */
  start: number
  /** Cột kết thúc, không bao gồm (0-based). */
  end: number
}

export interface FileSearchOptions {
  caseSensitive?: boolean
  maxResults?: number
  /** Coi truy vấn là biểu thức chính quy (RegExp). */
  regex?: boolean
  /** Chỉ khớp khi từ trọn vẹn. */
  wholeWord?: boolean
  /** Chỉ tìm trong các tệp khớp glob (ví dụ `*.tsx`, `src/**`). Rỗng = mọi tệp văn bản. */
  includeGlobs?: string[]
  /** Bỏ qua các tệp/thư mục khớp glob (ví dụ `src/generated/**`, `*.min.js`). */
  excludeGlobs?: string[]
}

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
    pickFolderOnly(): Promise<string | null>
    createFromTemplate(options: {
      templateId: string
      parentDir: string
      projectName: string
    }): Promise<{ success: boolean; project?: ProjectRecord; error?: string }>
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
    /** Đọc trạng thái Working Tree (staged, unstaged, untracked, ahead, behind). */
    gitStatus(projectId: string): Promise<GitWorkingTreeStatus>
    /** Đưa tệp vào staging (git add). */
    gitStage(projectId: string, paths: string[]): Promise<GitActionResult>
    /** Bỏ tệp khỏi staging (git restore --staged hoặc git reset HEAD). */
    gitUnstage(projectId: string, paths: string[]): Promise<GitActionResult>
    /** Khôi phục tệp về trạng thái gần nhất (git restore hoặc rm nếu untracked). */
    gitDiscard(projectId: string, paths: string[]): Promise<GitActionResult>
    /** Tạo commit mới với message. */
    gitCommit(projectId: string, message: string): Promise<GitCommitResult>
    /** Đẩy commit lên remote repository (GitHub). */
    gitPush(projectId: string, setUpstream?: boolean): Promise<GitActionResult>
    /** Kéo thay đổi mới nhất từ remote repository (git pull). */
    gitPull(projectId: string): Promise<GitActionResult>
    /** Lấy danh sách nhánh local và remote. */
    gitBranches(projectId: string): Promise<GitBranchItem[]>
    /** Chuyển nhánh (checkout / switch). */
    gitCheckout(projectId: string, branchName: string): Promise<GitActionResult>
    /** Tạo nhánh mới (và tuỳ chọn checkout sang nhánh đó). */
    gitCreateBranch(projectId: string, branchName: string, checkout?: boolean): Promise<GitActionResult>
    /** Clone một repository Git từ xa về máy và đăng ký thành dự án. */
    gitClone(options: {
      repoUrl: string
      parentDir: string
      folderName?: string
    }): Promise<{ ok: boolean; project?: ProjectRecord; error?: string }>
    /** Cấu hình remote repository (mặc định 'origin'). */
    gitSetRemote(
      projectId: string,
      remoteUrl: string,
      remoteName?: string,
    ): Promise<GitActionResult>
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
    search(root: string, query: string, options?: FileSearchOptions): Promise<FileSearchMatch[]>
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
      projectPath?: string
      styleMode?: 'inline' | 'tailwind' | 'auto'
    }): Promise<{
      success: boolean
      error?: string
      oldLine?: string
      newLine?: string
      updatedLine?: string
      mode?: 'inline' | 'tailwind'
      tailwindVersion?: 'v3' | 'v4'
      appliedClasses?: string[]
      residualStyles?: Record<string, string>
    }>
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
