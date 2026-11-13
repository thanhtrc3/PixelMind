/* Kiểu dữ liệu dùng chung giữa main process (Electron), preload và renderer. */

export type ThemeMode = 'dark' | 'light' | 'system'

export interface Settings {
  theme: ThemeMode
  accent: string
  fontSize: number
  autoPreview: boolean
  previewMode: 'embedded' | 'browser'
  confirmDelete: boolean
  showHidden: boolean
  openLastProject: boolean
  defaultScript: string

  // Mở rộng cài đặt chuyên nghiệp
  windowZoom?: number // 85, 90, 100, 110, 125 (%)
  autoSave?: boolean // Tự động lưu sau độ trễ
  confirmQuitRunning?: boolean // Hỏi khi thoát lúc server dev đang chạy
  editorFontFamily?: string // 'JetBrains Mono' | 'Fira Code' | 'Cascadia Code' | 'Consolas' | 'Monaco'
  editorFontSize?: number // 11 - 18px
  reducedMotion?: boolean // Giảm hiệu ứng động
  canvasGrid?: boolean // Lưới chấm nền Canvas
  smartGuides?: boolean // Thước đo khoảng cách thông minh
  syncCanvasToTree?: boolean // Tự động chọn và cuộn tới phần tử trong cây Layers
  hoverOutline?: boolean // Viền xanh khi rê chuột vào phần tử
  clearConsoleOnRun?: boolean // Tự động xóa console khi chạy lại
  maxLogLines?: number // Giới hạn dòng log RAM (500, 1000, 2000, 5000)
  preferredPort?: number // Cổng dev mặc định ưu tiên (0 = tự động)

  // Cấu hình AI (không chứa khoá bí mật — khoá chỉ đọc từ biến môi trường/.env ở main process)
  aiProvider?: 'openai' | 'ollama' | 'gemini'
  aiBaseUrl?: string
  aiModel?: string
  aiTemperature?: number
  aiMaxTokens?: number
}

export interface ScriptEntry {
  name: string
  command: string
  kind: 'dev' | 'build' | 'start' | 'test' | 'other'
  /** Chạy thẳng lệnh, không bọc qua package manager (vd. Flutter). */
  direct?: boolean
}

export type PackageManager =
  | 'npm'
  | 'pnpm'
  | 'yarn'
  | 'bun'
  | 'dotnet'
  | 'flutter'
  | 'python'
  | 'pip'
  | 'composer'
  | 'cargo'
  | 'go'
  | 'mvn'
  | 'gradle'
  | 'bundle'
  | 'none'

export interface ColorToken {
  id: string
  name: string
  value: string
  category: 'brand' | 'background' | 'status' | 'neutral'
}

export interface TypographyToken {
  id: string
  name: string
  fontSize: string
  lineHeight: string
  fontWeight?: string
}

export interface SpacingToken {
  id: string
  name: string
  value: string
}

export interface RadiusToken {
  id: string
  name: string
  value: string
}

export interface DesignTokens {
  colors: ColorToken[]
  typography: TypographyToken[]
  spacing: SpacingToken[]
  radius: RadiusToken[]
  updatedAt?: number
}

export interface ProjectPage {
  id: string
  route: string
  title: string
  mockup: boolean
  software: string
  frame: string
  /** Bộ chọn CSS hoặc phần tử liên kết từ giao diện (ví dụ: nav a[href*="Product"], #btn-search) */
  navLinkSelector?: string
  /** Danh sách tham số mẫu / ID mẫu cho các trang chi tiết/động (ví dụ: ['1', '2', '3']) */
  sampleParams?: string[]
  /** Đường dẫn tệp route thật, tương đối so với thư mục dự án (dùng '/' phân cách). */
  filePath?: string
}

/** Kết quả dò tệp route sẽ tạo cho một trang. */
export interface PageFilePreview {
  supported: boolean
  /** Nhãn framework hiển thị cho người dùng, ví dụ "Next.js App Router". */
  label: string
  /** Đường dẫn tương đối trong dự án (dùng '/' phân cách). */
  relativePath: string
  /** Tệp đã tồn tại trên đĩa hay chưa. */
  exists: boolean
  /** Lý do không hỗ trợ hoặc không thể tạo tệp. */
  reason?: string
}

export type VersionStatus = 'ok' | 'review' | 'error'

export interface ProjectVersion {
  id: string
  name: string
  status: VersionStatus
  hash: string
  date: string
  note: string
  /** Tên tác giả commit (nếu đọc được từ git log). */
  author?: string
}

export type GitRefType = 'head' | 'branch' | 'remote' | 'tag'

export interface GitRef {
  name: string
  type: GitRefType
  /** Nhánh hiện tại đang được checkout. */
  current?: boolean
}

export interface GitCommit {
  hash: string
  shortHash: string
  parents: string[]
  author: string
  authorEmail: string
  /** Unix timestamp (giây). */
  timestamp: number
  subject: string
  body?: string
  refs: GitRef[]
  isHead: boolean
  isMerge: boolean
}

export type GitGraphScope = 'all' | 'current'

export interface GitGraphData {
  branch: string | null
  hasRemote: boolean
  commits: GitCommit[]
}

export interface GitRollbackResult {
  ok: boolean
  error?: string
  /** Nhánh backup được tạo trước khi reset. */
  safetyRef?: string
  project?: ProjectRecord
}

export type GitFileStatusCode = 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed'

export interface GitFileChange {
  path: string
  oldPath?: string
  status: GitFileStatusCode
  staged: boolean
}

export interface GitWorkingTreeStatus {
  branch: string | null
  clean: boolean
  staged: GitFileChange[]
  unstaged: GitFileChange[]
  untracked: GitFileChange[]
  ahead: number
  behind: number
}

export interface GitBranchItem {
  name: string
  current: boolean
  remote: boolean
  upstream?: string
}

export interface GitCommitResult {
  ok: boolean
  hash?: string
  error?: string
}

export interface GitActionResult {
  ok: boolean
  error?: string
}

export type ActivityStatus = 'ok' | 'warn' | 'err' | 'info'
export type ActivityKind = 'người' | 'hệ thống' | 'AI'

export interface ProjectActivity {
  id: string
  at: number
  actor: string
  action: string
  kind: ActivityKind
  status: ActivityStatus
}

export interface ProjectMeta {
  owner: string
  code: string
  repo: string
  createdAt: number
  pages: ProjectPage[]
  versions: ProjectVersion[]
  activity: ProjectActivity[]
  /** Lệnh người dùng tự nhập cho dự án không có script sẵn. */
  customCommand: string
}

export type IssueLevel = 'error' | 'warning' | 'info'
export type IssueType =
  | 'missing_deps'
  | 'missing_script'
  | 'electron_app'
  | 'no_git'
  | 'no_package_json'
  | 'empty_folder'
  | 'other'

export type IssueActionKind = 'install' | 'git_init' | 'create_index_html' | 'add_dev_script'

export interface ProjectIssue {
  id: string
  type: IssueType
  level: IssueLevel
  title: string
  message: string
  recommendation: string
  actionLabel?: string
  actionKind?: IssueActionKind
}

export interface ProjectDiagnosis {
  healthy: boolean
  hasIssues: boolean
  checkedAt: number
  issues: ProjectIssue[]
}

/** Kết quả dò tệp mã nguồn chứa một phần tử DOM. */
export interface SourceLocation {
  filePath: string
  fullPath: string
  lineNumber: number
  lineContent: string
}

export interface SyncCodeResult {
  success: boolean
  error?: string
  oldLine?: string
  newLine?: string
}

export interface ProjectRecord {
  id: string
  name: string
  path: string
  framework: string
  packageManager: PackageManager
  scripts: ScriptEntry[]
  hasIndexHtml: boolean
  /** Thư mục con chứa index.html để xem trước tĩnh (rỗng = gốc dự án). */
  previewDir: string
  addedAt: number
  lastOpenedAt: number | null
  favorite: boolean
  diagnosis?: ProjectDiagnosis
  meta: ProjectMeta
}

export interface FileNode {
  name: string
  path: string
  type: 'dir' | 'file'
  ext: string
  size: number
  children?: FileNode[]
}

export interface FileContent {
  path: string
  name: string
  ext: string
  size: number
  text: string
  truncated: boolean
  dataUrl?: string
  binary: boolean
}

export type RunStatus = 'starting' | 'running' | 'stopped' | 'exited' | 'error'

export interface RunState {
  id: string
  projectId: string
  cwd: string
  script: string
  command: string
  status: RunStatus
  url: string | null
  exitCode: number | null
  startedAt: number
  kind: 'script' | 'static' | 'install' | 'command'
  /** Cổng ưu tiên (Settings) đã yêu cầu cho lượt chạy này; null/undefined = tự động. */
  requestedPort?: number | null
  /** Cổng thực sự đã yêu cầu dev server dùng; null/undefined = runner tự chọn. */
  appliedPort?: number | null
  /** Cổng ưu tiên bị chiếm nên đã quay về chế độ tự chọn cổng. */
  portFallback?: boolean
}

export interface RunLog {
  runId: string
  stream: 'stdout' | 'stderr' | 'system'
  text: string
  at: number
}

export type TerminalShell = 'auto' | 'powershell' | 'pwsh' | 'cmd' | 'bash'

export interface TerminalCreateOptions {
  projectId?: string
  cwd?: string
  cols?: number
  rows?: number
  shell?: TerminalShell
  title?: string
}

export interface TerminalSession {
  id: string
  projectId?: string
  title: string
  shell: string
  cwd: string
  pid: number
  cols: number
  rows: number
  backend: 'pty' | 'pipe'
  startedAt: number
}

export interface TerminalDataEvent {
  sessionId: string
  data: string
}

export interface TerminalExitEvent {
  sessionId: string
  exitCode: number
  signal?: number
}

export interface AppInfo {
  appVersion: string
  electron: string
  chrome: string
  node: string
  platform: string
  arch: string
  userDataPath: string
  home: string
}

export interface StoreData {
  settings: Settings
  projects: ProjectRecord[]
  lastProjectId: string | null
}

export interface ProjectStat {
  files: number
  folders: number
  totalSize: number
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  accent: '#6d5df5',
  fontSize: 13,
  autoPreview: true,
  previewMode: 'embedded',
  confirmDelete: true,
  showHidden: false,
  openLastProject: true,
  defaultScript: '',
  windowZoom: 100,
  autoSave: true,
  confirmQuitRunning: true,
  editorFontFamily: 'JetBrains Mono',
  editorFontSize: 13,
  reducedMotion: false,
  canvasGrid: true,
  smartGuides: true,
  syncCanvasToTree: true,
  hoverOutline: true,
  clearConsoleOnRun: true,
  maxLogLines: 1000,
  preferredPort: 0,
  aiProvider: 'openai',
  aiBaseUrl: 'https://api.openai.com/v1',
  aiModel: 'gpt-4o-mini',
  aiTemperature: 0.2,
  aiMaxTokens: 2048,
}
