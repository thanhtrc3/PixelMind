/* Hợp đồng dữ liệu AI dùng chung giữa main process, preload và renderer.
   Khoá API KHÔNG bao giờ nằm trong các kiểu dữ liệu gửi xuống renderer. */

export type AiProvider = 'openai' | 'ollama'

export type AiMessageRole = 'system' | 'user' | 'assistant'

export interface AiChatMessage {
  role: AiMessageRole
  content: string
}

/** Phần tử người dùng đang chọn trên canvas (do renderer gửi lên khi đóng gói ngữ cảnh). */
export interface AiSelection {
  tag: string
  id?: string
  className?: string
  text?: string
  filePath?: string
  lineNumber?: number
  outerHTML?: string
  computedStyles?: Record<string, string>
  selector?: string
}

export interface AiKeyStatus {
  present: boolean
  /** Nguồn khoá: biến môi trường, tệp pixelmind.env trong userData, hoặc .env của dự án. */
  source: 'process-env' | 'user-data-env' | 'project-env' | 'none'
  /** Khoá đã che, ví dụ: sk-…9f2a. Không bao giờ trả về khoá đầy đủ. */
  masked: string
  envFile?: string
}

export interface AiConfig {
  provider: AiProvider
  baseUrl: string
  model: string
  temperature: number
  maxTokens: number
}

export interface AiStatus extends AiConfig {
  configured: boolean
  key: AiKeyStatus
  /** Chỉ có khi kiểm tra thất bại. */
  error?: string
}

export interface AiModel {
  id: string
  name?: string
  ownedBy?: string
}

export interface AiTestResult {
  ok: boolean
  message: string
  latencyMs: number
  models?: string[]
  error?: string
}

export interface AiContextRequest {
  projectPath: string
  projectId?: string
  projectName?: string
  route?: string
  selection?: AiSelection | null
  /** Các mục ngữ cảnh người dùng bật trong tab Ngữ cảnh. */
  include?: Array<'selection' | 'source' | 'tokens' | 'wires' | 'logs' | 'project'>
  errorLog?: string
  tokenBudget?: number
}

export interface AiContextSource {
  filePath: string
  lineNumber?: number
  text: string
  language?: string
  truncated: boolean
}

export interface AiContextWire {
  pageId?: string
  route: string
  title?: string
  navLinkSelector?: string
}

export interface AiContextPack {
  version: 1
  createdAt: number
  mode: 'selection' | 'page' | 'project'
  project: {
    id?: string
    name?: string
    path: string
    route?: string
  }
  selection?: {
    tag: string
    id?: string
    className?: string
    text?: string
    selector?: string
    outerHTML?: string
    computedStyles?: Record<string, string>
  }
  source?: AiContextSource
  tokens?: {
    colors: Array<{ name: string; value: string }>
    spacing: Array<{ name: string; value: string }>
    radius: Array<{ name: string; value: string }>
    typography: Array<{ name: string; value: string }>
  }
  wires?: AiContextWire[]
  errors?: string
  /** Chỉ mục dự án (chỉ khi người dùng bật "toàn bộ dự án"). */
  projectIndex?: string[]
}

export interface AiContextResult {
  pack: AiContextPack
  json: string
  tokens: number
  budget: number
  dropped: string[]
  notes: string[]
}

export type AiChangeStatus = 'pending' | 'accepted' | 'rejected' | 'undone'

export interface AiDiffLine {
  kind: 'add' | 'del' | 'ctx' | 'hunk'
  text: string
}

export interface AiChange {
  id: string
  projectId: string
  /** Đường dẫn tương đối trong dự án. */
  file: string
  fullPath: string
  summary: string
  added: number
  removed: number
  status: AiChangeStatus
  diff: AiDiffLine[]
  createdAt: number
  appliedAt?: number
  undoneAt?: number
  task?: string
}

export interface AiProposeChangeRequest {
  projectId: string
  projectPath: string
  file: string
  content: string
  summary: string
  task?: string
}

export type AiToolName = 'read_file' | 'search_project' | 'apply_patch' | 'run_build' | 'sync_nav'

export interface AiToolSchema {
  name: AiToolName
  description: string
  risk: 'read' | 'write' | 'exec'
  requiresApproval: boolean
  parameters: Record<string, unknown>
}

export interface AiToolCallRequest {
  tool: AiToolName
  projectId?: string
  projectPath: string
  args: Record<string, unknown>
}

export interface AiToolResult {
  ok: boolean
  tool: AiToolName
  output?: string
  error?: string
  changeId?: string
  data?: unknown
}

export interface AiToolLogEntry {
  id: string
  at: number
  projectId?: string
  tool: string
  args: string
  ok: boolean
  durationMs: number
  summary: string
}

export interface AiToolCall {
  id: string
  name: string
  arguments: string
}

export interface AiChatRequest {
  projectId?: string
  projectPath?: string
  messages: AiChatMessage[]
  context?: AiContextPack
  /** Cho phép mô hình gọi tool nội bộ (mặc định true). */
  tools?: boolean
  /** Tên hiển thị cho phiên chat, dùng cho nhật ký. */
  title?: string
}

export type AiChatEvent =
  | { type: 'start'; id: string; at: number }
  | { type: 'delta'; id: string; text: string }
  | { type: 'tool'; id: string; name: string; status: 'running' | 'ok' | 'error'; detail?: string }
  | { type: 'done'; id: string; at: number; usage?: { promptTokens?: number; completionTokens?: number } }
  | { type: 'error'; id: string; message: string }

export interface AiChatHandle {
  id: string
}

/** Một dòng lịch sử chat đã lưu trong userData. */
export interface AiChatEntry {
  id: string
  at: number
  role: AiMessageRole
  text: string
}

export interface AiChatStartRequest extends AiChatRequest {
  id?: string
}

export interface AiApi {
  status(projectPath?: string): Promise<AiStatus>
  models(projectPath?: string): Promise<AiModel[]>
  test(projectPath?: string): Promise<AiTestResult>
  chat(request: AiChatStartRequest): Promise<AiChatHandle>
  cancel(id: string): Promise<boolean>
  onChatEvent(callback: (event: AiChatEvent) => void): () => void
  chats: {
    history(projectId: string): Promise<AiChatEntry[]>
    clear(projectId: string): Promise<boolean>
  }
  context(request: AiContextRequest): Promise<AiContextResult>
  changes: {
    list(projectId: string): Promise<AiChange[]>
    propose(request: AiProposeChangeRequest): Promise<AiChange>
    accept(projectId: string, changeId: string): Promise<AiChange[]>
    reject(projectId: string, changeId: string): Promise<AiChange[]>
    undo(projectId: string, changeId: string): Promise<AiChange[]>
  }
  tools: {
    list(): Promise<AiToolSchema[]>
    run(request: AiToolCallRequest): Promise<AiToolResult>
    logs(projectId?: string): Promise<AiToolLogEntry[]>
  }
}

/** Ước lượng token thô, đủ dùng cho ngân sách ngữ cảnh (không phải tokenizer thật). */
export function estimateTokens(text: string): number {
  if (!text) return 0
  // Văn bản Việt/Anh lẫn mã nguồn: trung bình ~3.6 ký tự/token.
  return Math.max(1, Math.ceil(text.length / 3.6))
}
