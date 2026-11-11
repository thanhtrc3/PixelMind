/* Hợp đồng dữ liệu AI dùng chung giữa main process, preload và renderer.
   Khoá API KHÔNG bao giờ nằm trong các kiểu dữ liệu gửi xuống renderer. */

export type AiProvider = 'openai' | 'ollama' | 'gemini'

export type AiBridgeKind = 'api' | 'ide' | 'cli' | 'ollama'

export interface AiBridgeStatus {
  kind: AiBridgeKind
  name: string
  detail: string
  status: 'online' | 'offline' | 'local'
  latencyMs?: number
  model?: string
  error?: string
}

export interface AiAuditEntry {
  id: string
  at: number
  type: 'tool_call' | 'patch' | 'cli' | 'kill_switch' | 'bridge' | 'guardrail_blocked'
  summary: string
  ok: boolean
  projectId?: string
  detail?: string
  durationMs?: number
}

export interface AiCostStats {
  projectId?: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCostUsd: number
  budgetTokens: number
  percentageUsed: number
  isOverBudget: boolean
  isNearBudget: boolean
}

export interface AiPlanStep {
  id: string
  label: string
  status: 'pending' | 'running' | 'done' | 'failed'
}

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
  /** Giới hạn phạm vi: chỉ cho phép sửa tệp này (nếu gọi tool sửa tệp) */
  scopedFile?: string
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
  /** Hội thoại đích để ghi nhật ký; bỏ trống thì tạo hội thoại mới. */
  conversationId?: string
  /** Giới hạn phạm vi: chỉ cho phép sửa tệp này (nếu gọi tool sửa tệp) */
  scopedFile?: string
  /** Cầu nối người dùng chọn tại thời điểm gửi (ưu tiên hơn activeBridge toàn cục). */
  bridge?: AiBridgeKind
  /** CLI agent đích khi dùng CLI Bridge. */
  cli?: AiCliTarget
}

export interface DetectedCli {
  /** ID adapter, ví dụ "opencode" | "codex" | "claude". */
  id: string
  binary: string
  name: string
  version?: string
  path?: string
  installed: boolean
  description: string
  /** CLI có hỗ trợ chạy từ chatbox hay chỉ phát hiện. */
  supportsRun: boolean
  /** Trạng thái đăng nhập nếu CLI có auth probe. */
  auth?: 'ok' | 'missing' | 'unknown'
  /** Model gợi ý / phát hiện được. */
  models?: string[]
  /** Ghi chú chẩn đoán khi tìm thấy lệnh nhưng không chạy được. */
  note?: string
}

export interface AiCliTarget {
  id: string
  model?: string
}

export interface AiCliRunRequest {
  id?: string
  binary: string
  args: string[]
  projectPath: string
  timeoutMs?: number
  /** Nội dung ghi vào stdin (nếu cần). */
  stdinText?: string
  /** Biến môi trường bổ sung. */
  env?: Record<string, string>
}

export interface AiCliEvent {
  id: string
  type:
    | 'stdout'
    | 'stderr'
    | 'exit'
    | 'error'
    | 'text'
    | 'tool'
    | 'session'
    | 'usage'
  text?: string
  code?: number
  tool?: { name: string; status: 'running' | 'ok' | 'error'; detail?: string }
  sessionId?: string
  usage?: { promptTokens?: number; completionTokens?: number }
}

export type AiChatEvent =
  | { type: 'start'; id: string; at: number }
  | { type: 'delta'; id: string; text: string }
  | { type: 'plan'; id: string; steps: AiPlanStep[] }
  | { type: 'step_update'; id: string; stepId: string; status: 'running' | 'done' | 'failed' }
  | { type: 'tool'; id: string; name: string; status: 'running' | 'ok' | 'error'; detail?: string }
  /** Tiến trình sống của agent (chuẩn bị, khởi chạy, chờ, chạy tool). text rỗng = xoá trạng thái. */
  | { type: 'status'; id: string; text: string; phase?: 'prepare' | 'spawn' | 'wait' | 'tool' | 'stream' }
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
  plan?: AiPlanStep[]
  /** Hội thoại mà dòng chat này thuộc về (bản ghi cũ không có trường này). */
  conversationId?: string
}

/** Tóm tắt một hội thoại để hiển thị trong danh sách của chatbox. */
export interface AiConversationSummary {
  id: string
  title: string
  updatedAt: number
  messageCount: number
  preview?: string
}

export interface AiChatStartRequest extends AiChatRequest {
  id?: string
}

export interface AiApi {
  status(projectPath?: string): Promise<AiStatus>
  models(projectPath?: string): Promise<AiModel[]>
  test(projectPath?: string): Promise<AiTestResult>
  saveKey(key: string, provider?: string): Promise<{ ok: boolean; masked: string }>
  chat(request: AiChatStartRequest): Promise<AiChatHandle>
  complete(request: { prompt: string; system?: string; projectPath?: string }): Promise<{ text: string; error?: string }>
  cancel(id: string): Promise<boolean>
  killSwitch(): Promise<{ count: number; ok: boolean }>
  onChatEvent(callback: (event: AiChatEvent) => void): () => void
  bridges: {
    getActive(): Promise<AiBridgeKind>
    setActive(kind: AiBridgeKind): Promise<AiBridgeStatus>
    list(projectPath?: string): Promise<AiBridgeStatus[]>
    ping(kind: AiBridgeKind, projectPath?: string): Promise<AiBridgeStatus>
  }
  audit: {
    list(projectId?: string): Promise<AiAuditEntry[]>
    clear(projectId?: string): Promise<boolean>
  }
  cost: {
    get(projectId?: string): Promise<AiCostStats>
    setBudget(projectId: string, budgetTokens: number): Promise<AiCostStats>
    reset(projectId?: string): Promise<boolean>
  }
  cli: {
    run(request: AiCliRunRequest): Promise<{ id: string }>
    stop(id: string): Promise<boolean>
    detect(force?: boolean): Promise<DetectedCli[]>
    models(id: string): Promise<string[]>
    onEvent(callback: (event: AiCliEvent) => void): () => void
  }
  ws: {
    send(message: unknown): Promise<boolean>
    status(): Promise<{ online: boolean; latencyMs: number }>
  }
  chats: {
    history(projectId: string, conversationId?: string): Promise<AiChatEntry[]>
    conversations(projectId: string): Promise<AiConversationSummary[]>
    clear(projectId: string): Promise<boolean>
    rewrite(projectId: string, entries: AiChatEntry[], conversationId?: string): Promise<boolean>
    remove(projectId: string, conversationId: string): Promise<boolean>
  }
  context(request: AiContextRequest): Promise<AiContextResult>
  changes: {
    list(projectId: string): Promise<AiChange[]>
    propose(request: AiProposeChangeRequest): Promise<AiChange>
    accept(projectId: string, changeId: string): Promise<AiChange[]>
    reject(projectId: string, changeId: string): Promise<AiChange[]>
    undo(projectId: string, changeId: string): Promise<AiChange[]>
    diffStats?(projectPath: string): Promise<Array<{ file: string; added: number; removed: number }>>
    gitRevert?(projectPath: string, files?: string[]): Promise<boolean>
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
