import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  AiChatEntry,
  AiChatEvent,
  AiChatHandle,
  AiChatStartRequest,
  AiConfig,
  AiKeyStatus,
  AiModel,
  AiProvider,
  AiStatus,
  AiTestResult,
} from '../../shared/ai'
import { readStore } from './store'
import { runTool, TOOL_SCHEMAS } from './aiTools'

/* AI Gateway: OpenAI-compatible Chat Completions + SSE.
   Khoá API chỉ được đọc trong main process từ biến môi trường hoặc tệp .env;
   không bao giờ trả về renderer, không lưu vào pixelmind-store.json. */

interface EnvMap {
  values: Record<string, string>
  file: string
}

const DEFAULTS: Record<AiProvider, { baseUrl: string; model: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  ollama: { baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5-coder' },
}

const controllers = new Map<string, AbortController>()

const parseEnvFile = (text: string): Record<string, string> => {
  const values: Record<string, string> = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    values[match[1]] = value
  }
  return values
}

const readEnvFile = async (file: string): Promise<EnvMap | null> => {
  try {
    const text = await fs.readFile(file, 'utf8')
    return { values: parseEnvFile(text), file }
  } catch {
    return null
  }
}

const KEY_NAMES = ['PIXELMIND_AI_KEY', 'OPENAI_API_KEY', 'OLLAMA_API_KEY']

const pickKey = (values: Record<string, string>): string | null => {
  for (const name of KEY_NAMES) {
    const value = values[name]
    if (value && value.trim()) return value.trim()
  }
  return null
}

const maskKey = (key: string | null): string => {
  if (!key) return ''
  if (key.length <= 8) return '••••••'
  return `${key.slice(0, 3)}…${key.slice(-4)}`
}

async function resolveKey(projectPath?: string): Promise<AiKeyStatus> {
  for (const name of KEY_NAMES) {
    const value = process.env[name]
    if (value && value.trim()) {
      return { present: true, source: 'process-env', masked: maskKey(value.trim()) }
    }
  }

  const userEnv = await readEnvFile(join(app.getPath('userData'), 'pixelmind.env'))
  if (userEnv) {
    const key = pickKey(userEnv.values)
    if (key) {
      return {
        present: true,
        source: 'user-data-env',
        masked: maskKey(key),
        envFile: userEnv.file,
      }
    }
  }

  if (projectPath) {
    const projectEnv = await readEnvFile(join(projectPath, '.env'))
    if (projectEnv) {
      const key = pickKey(projectEnv.values)
      if (key) {
        return {
          present: true,
          source: 'project-env',
          masked: maskKey(key),
          envFile: projectEnv.file,
        }
      }
    }
  }

  return { present: false, source: 'none', masked: '' }
}

async function readEnvOverrides(projectPath?: string): Promise<Record<string, string>> {
  // Chỉ dùng để đọc cấu hình phi bí mật từ biến môi trường và pixelmind.env của người dùng.
  // Không cho .env của dự án ghi đè base URL/provider để tránh đẩy khoá toàn cục tới endpoint lạ.
  const merged: Record<string, string> = {}
  const userEnv = await readEnvFile(join(app.getPath('userData'), 'pixelmind.env'))
  if (userEnv) Object.assign(merged, userEnv.values)
  for (const [key, value] of Object.entries(process.env)) {
    if (value) merged[key] = value
  }
  void projectPath
  return merged
}

export async function resolveConfig(projectPath?: string): Promise<{
  config: AiConfig
  key: AiKeyStatus
  keyValue: string | null
}> {
  const store = await readStore().catch(() => null)
  const settings = store?.settings
  const env = await readEnvOverrides(projectPath)

  const envProvider = env['PIXELMIND_AI_PROVIDER']?.toLowerCase()
  const provider: AiProvider =
    envProvider === 'ollama' || envProvider === 'openai'
      ? envProvider
      : settings?.aiProvider === 'ollama'
        ? 'ollama'
        : 'openai'

  const defaults = DEFAULTS[provider]
  const baseUrl = (
    env['PIXELMIND_AI_BASE_URL'] ||
    settings?.aiBaseUrl ||
    defaults.baseUrl
  ).replace(/\/+$/, '')
  const model = env['PIXELMIND_AI_MODEL'] || settings?.aiModel || defaults.model

  const temperature = Number(env['PIXELMIND_AI_TEMPERATURE'] ?? settings?.aiTemperature ?? 0.2)
  const maxTokens = Number(env['PIXELMIND_AI_MAX_TOKENS'] ?? settings?.aiMaxTokens ?? 2048)

  let key = await resolveKey(projectPath)
  // resolveKey chỉ trả masked; đọc lại giá trị thật trong main process.
  let keyValue: string | null = null
  if (key.source === 'process-env') {
    for (const name of KEY_NAMES) {
      const value = process.env[name]
      if (value && value.trim()) {
        keyValue = value.trim()
        break
      }
    }
  } else if (key.envFile) {
    const envFile = await readEnvFile(key.envFile)
    keyValue = envFile ? pickKey(envFile.values) : null
    if (!keyValue) key = { present: false, source: 'none', masked: '' }
  }

  return {
    config: {
      provider,
      baseUrl: baseUrl || defaults.baseUrl,
      model: model || defaults.model,
      temperature: Number.isFinite(temperature) ? Math.min(2, Math.max(0, temperature)) : 0.2,
      maxTokens: Number.isFinite(maxTokens) ? Math.min(32768, Math.max(256, maxTokens)) : 2048,
    },
    key,
    keyValue,
  }
}

export async function getStatus(projectPath?: string): Promise<AiStatus> {
  const { config, key } = await resolveConfig(projectPath)
  const configured =
    Boolean(config.baseUrl && config.model) && (config.provider === 'ollama' || key.present)
  return {
    ...config,
    configured,
    key,
    error: configured
      ? undefined
      : config.provider === 'openai' && !key.present
        ? 'Chưa tìm thấy khoá API. Đặt PIXELMIND_AI_KEY trong biến môi trường hoặc tệp pixelmind.env / .env của dự án.'
        : 'Thiếu base URL hoặc model.',
  }
}

const authHeaders = (keyValue: string | null): Record<string, string> =>
  keyValue ? { Authorization: `Bearer ${keyValue}` } : {}

const fetchJson = async (
  url: string,
  init: RequestInit,
  timeoutMs = 15_000,
): Promise<unknown> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const text = await response.text()
    if (!response.ok) {
      throw new Error(friendlyHttpError(response.status, text))
    }
    return text ? JSON.parse(text) : {}
  } finally {
    clearTimeout(timer)
  }
}

const friendlyHttpError = (status: number, text: string): string => {
  let detail = text.replace(/\s+/g, ' ').slice(0, 500)
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } | string; message?: string }
    const message =
      typeof parsed.error === 'string' ? parsed.error : parsed.error?.message ?? parsed.message
    if (message) detail = message
  } catch {}

  const lower = detail.toLowerCase()
  if (status === 401 || status === 403) {
    return `Khoá API không hợp lệ hoặc không có quyền (HTTP ${status}). ${detail}`
  }
  if (status === 404) {
    if (lower.includes('model')) {
      return `Model không tồn tại hoặc chưa được bật (HTTP 404). Kiểm tra lại tên model trong Cài đặt. ${detail}`
    }
    return `Không tìm thấy endpoint (HTTP 404). Kiểm tra Base URL, thường phải kết thúc bằng /v1. ${detail}`
  }
  if (status === 429) {
    return `Đã vượt giới hạn tốc độ hoặc hết hạn mức (HTTP 429). Chờ một lát rồi thử lại. ${detail}`
  }
  if (status === 413) {
    return `Gói ngữ cảnh quá lớn (HTTP 413). Giảm bớt mục trong tab Ngữ cảnh hoặc giảm Max tokens. ${detail}`
  }
  if (
    status === 400 &&
    (lower.includes('context_length') ||
      lower.includes('maximum context') ||
      lower.includes('too many tokens') ||
      lower.includes('token limit'))
  ) {
    return `Vượt giới hạn token của model (HTTP 400). Giảm bớt ngữ cảnh hoặc chọn model có cửa sổ ngữ cảnh lớn hơn. ${detail}`
  }
  return `Máy chủ AI trả về lỗi HTTP ${status}. ${detail}`
}

const friendlyRuntimeError = (error: unknown, timedOut: boolean): string => {
  if (timedOut) {
    return 'AI phản hồi quá lâu nên yêu cầu đã bị dừng. Kiểm tra mạng rồi bấm Thử lại.'
  }
  if (error instanceof Error) {
    if (error.name === 'AbortError') return 'Đã huỷ yêu cầu.'
    const message = error.message
    if (
      message.includes('fetch failed') ||
      message.includes('ECONNREFUSED') ||
      message.includes('ENOTFOUND') ||
      message.includes('ETIMEDOUT') ||
      message.includes('network')
    ) {
      return 'Mất kết nối tới AI Gateway. Kiểm tra mạng, Base URL hoặc trạng thái Ollama rồi bấm Thử lại.'
    }
    return message
  }
  return 'Lỗi không xác định khi gọi AI.'
}

export async function listModels(projectPath?: string): Promise<AiModel[]> {
  const { config, keyValue } = await resolveConfig(projectPath)
  const data = (await fetchJson(`${config.baseUrl}/models`, {
    method: 'GET',
    headers: { ...authHeaders(keyValue) },
  })) as { data?: Array<{ id: string; owned_by?: string }>; models?: Array<{ name?: string; model?: string }> }

  if (Array.isArray(data.data)) {
    return data.data.map((item) => ({ id: item.id, name: item.id, ownedBy: item.owned_by }))
  }
  if (Array.isArray(data.models)) {
    return data.models
      .map((item) => item.model ?? item.name ?? '')
      .filter(Boolean)
      .map((id) => ({ id, name: id }))
  }
  return []
}

export async function testConnection(projectPath?: string): Promise<AiTestResult> {
  const started = Date.now()
  const { config, key } = await resolveConfig(projectPath)
  if (config.provider !== 'ollama' && !key.present) {
    return {
      ok: false,
      message: 'Chưa có khoá API. Hãy đặt PIXELMIND_AI_KEY trong biến môi trường hoặc tệp pixelmind.env.',
      latencyMs: 0,
      error: 'missing-key',
    }
  }

  try {
    const models = await listModels(projectPath)
    return {
      ok: true,
      message: `Kết nối thành công tới ${config.baseUrl} (${models.length} model khả dụng).`,
      latencyMs: Date.now() - started,
      models: models.slice(0, 30).map((item) => item.id),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không kết nối được máy chủ AI.'
    return { ok: false, message, latencyMs: Date.now() - started, error: message }
  }
}

/* ───────────────────────── Chat streaming ───────────────────────── */

interface StreamToolCall {
  id: string
  name: string
  arguments: string
}

interface StreamResult {
  content: string
  toolCalls: StreamToolCall[]
  usage?: { promptTokens?: number; completionTokens?: number }
}

type LocalMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> }
  | { role: 'tool'; tool_call_id: string; content: string }

const parseSseData = (line: string): string | null => {
  if (!line.startsWith('data:')) return null
  const data = line.slice(5).trim()
  return data || null
}

async function streamCompletion(
  config: AiConfig,
  keyValue: string | null,
  messages: LocalMessage[],
  toolsEnabled: boolean,
  onDelta: (text: string) => void,
  signal: AbortSignal,
): Promise<StreamResult> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: true,
  }
  if (toolsEnabled) {
    body.tools = TOOL_SCHEMAS.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }))
    body.tool_choice = 'auto'
  }

  const local = new AbortController()
  const onOuterAbort = () => local.abort()
  signal.addEventListener('abort', onOuterAbort)
  const timer = setTimeout(() => {
    local.abort()
  }, 120_000)
  const cleanup = () => {
    clearTimeout(timer)
    signal.removeEventListener('abort', onOuterAbort)
  }

  try {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...authHeaders(keyValue),
    },
    body: JSON.stringify(body),
    signal: local.signal,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(friendlyHttpError(response.status, text))
  }
  if (!response.body) throw new Error('Máy chủ AI không trả về luồng dữ liệu (stream).')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  const toolCalls = new Map<number, StreamToolCall>()
  let usage: StreamResult['usage']

  const handleChunk = (payload: unknown) => {
    const data = payload as {
      choices?: Array<{
        delta?: {
          content?: string
          tool_calls?: Array<{
            index?: number
            id?: string
            function?: { name?: string; arguments?: string }
          }>
        }
        finish_reason?: string
      }>
      usage?: { prompt_tokens?: number; completion_tokens?: number }
    }
    if (data.usage) {
      usage = {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
      }
    }
    const delta = data.choices?.[0]?.delta
    if (!delta) return
    if (typeof delta.content === 'string' && delta.content) {
      content += delta.content
      onDelta(delta.content)
    }
    for (const call of delta.tool_calls ?? []) {
      const index = call.index ?? 0
      const current = toolCalls.get(index) ?? { id: '', name: '', arguments: '' }
      if (call.id) current.id = call.id
      if (call.function?.name) current.name += call.function.name
      if (call.function?.arguments) current.arguments += call.function.arguments
      toolCalls.set(index, current)
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let newline = buffer.indexOf('\n')
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (line === 'data: [DONE]') {
        newline = -1
        buffer = ''
        break
      }
      const data = parseSseData(line)
      if (data) {
        try {
          handleChunk(JSON.parse(data))
        } catch {
          // Bỏ qua dòng SSE không phải JSON hợp lệ.
        }
      }
      newline = buffer.indexOf('\n')
    }
  }
  if (buffer.trim().startsWith('data:')) {
    const data = parseSseData(buffer.trim())
    if (data && data !== '[DONE]') {
      try {
        handleChunk(JSON.parse(data))
      } catch {}
    }
  }

  return {
    content,
    toolCalls: [...toolCalls.values()].filter((call) => call.name),
    usage,
  }
  } finally {
    cleanup()
  }
}

const SYSTEM_PROMPT = `Bạn là trợ lý lập trình tích hợp trong PixelMind Desktop.
- Trả lời bằng tiếng Việt, ngắn gọn, nêu rõ tệp và thay đổi cần làm.
- Bạn KHÔNG có quyền chạy lệnh terminal tuỳ ý. Chỉ dùng các tool nội bộ được cung cấp.
- Mọi thay đổi mã nguồn phải thực hiện qua tool apply_patch hoặc sync_nav để tạo diff cho người dùng duyệt.
- Không bịa nội dung tệp; hãy dùng read_file/search_project khi cần.
- Không tiết lộ hay yêu cầu khoá API.`

const persistChat = async (
  projectId: string | undefined,
  entry: Record<string, unknown>,
): Promise<void> => {
  if (!projectId) return
  try {
    const dir = join(app.getPath('userData'), 'pixelmind-ai', projectId.replace(/[^a-zA-Z0-9._-]/g, '_'))
    await fs.mkdir(dir, { recursive: true })
    await fs.appendFile(
      join(dir, 'chats.jsonl'),
      `${JSON.stringify({ id: randomUUID(), at: Date.now(), ...entry })}\n`,
      'utf8',
    )
  } catch {
    // Nhật ký chat lỗi không chặn luồng chính.
  }
}

const chatHistoryPath = (projectId: string): string =>
  join(
    app.getPath('userData'),
    'pixelmind-ai',
    projectId.replace(/[^a-zA-Z0-9._-]/g, '_'),
    'chats.jsonl',
  )

export async function getChatHistory(projectId: string): Promise<AiChatEntry[]> {
  try {
    const text = await fs.readFile(chatHistoryPath(projectId), 'utf8')
    return text
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as AiChatEntry
        } catch {
          return null
        }
      })
      .filter(
        (entry): entry is AiChatEntry =>
          Boolean(entry) &&
          typeof entry!.text === 'string' &&
          ['user', 'assistant', 'system'].includes(entry!.role),
      )
      // Thử lại có thể ghi lại cùng một câu hỏi; gộp các dòng user trùng liền kề.
      .filter(
        (entry, index, list) =>
          !(
            entry.role === 'user' &&
            index > 0 &&
            list[index - 1].role === 'user' &&
            list[index - 1].text === entry.text
          ),
      )
      .slice(-200)
  } catch {
    return []
  }
}

export async function clearChatHistory(projectId: string): Promise<boolean> {
  try {
    await fs.unlink(chatHistoryPath(projectId))
    return true
  } catch {
    return false
  }
}

export function startChat(
  request: AiChatStartRequest,
  emit: (event: AiChatEvent) => void,
): AiChatHandle {
  const id = request.id ?? `chat-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`
  const controller = new AbortController()
  controllers.set(id, controller)

  const run = async () => {
    const started = Date.now()
    let finalText = ''
    let streamedText = ''
    emit({ type: 'start', id, at: started })
    try {
      const { config, key, keyValue } = await resolveConfig(request.projectPath)
      if (config.provider !== 'ollama' && !key.present) {
        throw new Error(
          'Chưa tìm thấy khoá API. Đặt PIXELMIND_AI_KEY trong biến môi trường hoặc tệp pixelmind.env (userData) / .env của dự án.',
        )
      }

      const messages: LocalMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }]
      if (request.context) {
        messages.push({
          role: 'system',
          content: `Gói ngữ cảnh dự án (JSON):\n${JSON.stringify(request.context, null, 2)}`,
        })
      }
      for (const message of request.messages) {
        if (message.role === 'system') continue
        messages.push({ role: message.role, content: message.content })
      }

      const lastUser = [...request.messages].reverse().find((message) => message.role === 'user')
      if (lastUser) {
        await persistChat(request.projectId, { at: started, role: 'user', text: lastUser.content })
      }

      const toolsEnabled = request.tools !== false

      for (let round = 0; round < 4; round += 1) {
        const result = await streamCompletion(
          config,
          keyValue,
          messages,
          toolsEnabled,
          (text) => {
            streamedText += text
            emit({ type: 'delta', id, text })
          },
          controller.signal,
        )
        finalText += result.content

        if (!result.toolCalls.length) {
          // Ghi lịch sử trước khi báo done để dữ liệu chắc chắn còn sau khi khởi động lại.
          if (finalText) {
            await persistChat(request.projectId, {
              at: Date.now(),
              role: 'assistant',
              text: finalText,
            })
          }
          emit({ type: 'done', id, at: Date.now(), usage: result.usage })
          return
        }

        messages.push({
          role: 'assistant',
          content: result.content || null,
          tool_calls: result.toolCalls.map((call) => ({
            id: call.id || `call-${randomUUID()}`,
            type: 'function' as const,
            function: { name: call.name, arguments: call.arguments || '{}' },
          })),
        })

        for (const call of result.toolCalls) {
          let args: Record<string, unknown> = {}
          try {
            args = JSON.parse(call.arguments || '{}') as Record<string, unknown>
          } catch {
            args = {}
          }
          emit({ type: 'tool', id, name: call.name, status: 'running' })
          const toolResult = await runTool({
            tool: call.name as never,
            projectId: request.projectId,
            projectPath: String(request.projectPath ?? ''),
            args,
          })
          emit({
            type: 'tool',
            id,
            name: call.name,
            status: toolResult.ok ? 'ok' : 'error',
            detail: toolResult.ok
              ? (toolResult.output ?? toolResult.changeId ?? 'ok').slice(0, 300)
              : toolResult.error,
          })
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(toolResult),
          })
        }
      }

      if (finalText) {
        await persistChat(request.projectId, {
          at: Date.now(),
          role: 'assistant',
          text: finalText,
        })
      }
      emit({ type: 'done', id, at: Date.now() })
    } catch (error) {
      if (controller.signal.aborted) {
        const partial = streamedText || finalText
        if (partial) {
          await persistChat(request.projectId, {
            at: Date.now(),
            role: 'assistant',
            text: partial,
          })
        }
        emit({ type: 'done', id, at: Date.now() })
        return
      }
      const timedOut = error instanceof Error && error.name === 'AbortError'
      emit({ type: 'error', id, message: friendlyRuntimeError(error, timedOut) })
    } finally {
      controllers.delete(id)
    }
  }

  void run()
  return { id }
}

export function cancelChat(id: string): boolean {
  const controller = controllers.get(id)
  if (!controller) return false
  controller.abort()
  controllers.delete(id)
  return true
}
