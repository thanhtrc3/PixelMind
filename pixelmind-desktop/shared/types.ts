/* Kiểu dữ liệu dùng chung giữa main process (Electron), preload và renderer. */

export type ThemeMode = 'dark' | 'light'

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
}

export interface ScriptEntry {
  name: string
  command: string
  kind: 'dev' | 'build' | 'start' | 'test' | 'other'
  /** Chạy thẳng lệnh, không bọc qua package manager (vd. Flutter). */
  direct?: boolean
}

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'dotnet' | 'flutter' | 'python' | 'pip' | 'composer' | 'cargo' | 'go' | 'none'

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
}

export type VersionStatus = 'ok' | 'review' | 'error'

export interface ProjectVersion {
  id: string
  name: string
  status: VersionStatus
  hash: string
  date: string
  note: string
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
}

export interface RunLog {
  runId: string
  stream: 'stdout' | 'stderr' | 'system'
  text: string
  at: number
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
}
