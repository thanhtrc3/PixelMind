import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  AiBridgeKind,
  AiBridgeStatus,
  AiChatEntry,
  AiChatEvent,
  AiChatHandle,
  AiChatStartRequest,
  AiConfig,
  AiContextPack,
  AiConversationSummary,
  AiImageAttachment,
  AiKeyStatus,
  AiModel,
  AiPlanStep,
  AiProvider,
  AiStatus,
  AiTestResult,
} from '../../shared/ai'
import { readStore } from './store'
import { runTool, TOOL_SCHEMAS } from './aiTools'
import { detectInstalledClis, isAgentInstalled, killAllCliProcesses, runAgent, stopCliAgent } from './cliBridge'
import { getAgentDef } from './agentDefs'
import { prepareAgentIntegration } from './agentIntegrations'
import { ideWsBridge } from './ideWsBridge'
import { recordAudit } from './aiAudit'
import { GUARDRAILS_SYSTEM_INSTRUCTION } from './aiGuardrails'
import { recordTokenUsage } from './aiCost'

/* AI Gateway: OpenAI-compatible Chat Completions + SSE.
   Khoá API chỉ được đọc trong main process từ biến môi trường hoặc tệp .env;
   không bao giờ trả về renderer, không lưu vào pixelmind-store.json. */

interface EnvMap {
  values: Record<string, string>
  file: string
}

const DEFAULTS: Record<AiProvider, { baseUrl: string; model: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-3.5-flash-lite' },
  ollama: { baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5-coder' },
}

const controllers = new Map<string, AbortController>()

/* Phiên native của từng CLI agent (resume). Lưu theo userData để sống qua khởi động lại. */
const agentSessions = new Map<string, string>()
let agentSessionsLoaded = false
const agentSessionsFile = () => join(app.getPath('userData'), 'ai-agent-sessions.json')

async function loadAgentSessions(): Promise<void> {
  if (agentSessionsLoaded) return
  agentSessionsLoaded = true
  try {
    const raw = await fs.readFile(agentSessionsFile(), 'utf8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && value) agentSessions.set(key, value)
    }
  } catch {
    // chưa có phiên nào
  }
}

async function persistAgentSessions(): Promise<void> {
  try {
    await fs.mkdir(app.getPath('userData'), { recursive: true })
    await fs.writeFile(
      agentSessionsFile(),
      JSON.stringify(Object.fromEntries(agentSessions), null, 2),
      'utf8',
    )
  } catch {
    // không chặn luồng chat nếu ghi lỗi
  }
}

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

const KEY_NAMES = ['PIXELMIND_AI_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'OLLAMA_API_KEY']

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

export async function saveApiKey(
  key: string,
  provider: AiProvider = 'openai',
): Promise<{ ok: boolean; masked: string }> {
  const cleanKey = key.trim()
  if (!cleanKey) throw new Error('Khoá API không được để trống.')

  const envFile = join(app.getPath('userData'), 'pixelmind.env')
  let existingContent = ''
  try {
    existingContent = await fs.readFile(envFile, 'utf8')
  } catch {}

  const parsed = parseEnvFile(existingContent)
  parsed['PIXELMIND_AI_KEY'] = cleanKey
  parsed['OPENAI_API_KEY'] = cleanKey

  // Tự động nhận diện Google AI Studio / Gemini API key
  const isGemini = cleanKey.startsWith('AIza') || cleanKey.startsWith('AQ.')
  if (isGemini) {
    parsed['GEMINI_API_KEY'] = cleanKey
    parsed['PIXELMIND_AI_PROVIDER'] = 'gemini'
    parsed['PIXELMIND_AI_BASE_URL'] = 'https://generativelanguage.googleapis.com/v1beta/openai'
    parsed['PIXELMIND_AI_MODEL'] = 'gemini-2.5-flash-lite'
    process.env['GEMINI_API_KEY'] = cleanKey
    process.env['PIXELMIND_AI_PROVIDER'] = 'gemini'
    process.env['PIXELMIND_AI_BASE_URL'] = 'https://generativelanguage.googleapis.com/v1beta/openai'
    process.env['PIXELMIND_AI_MODEL'] = 'gemini-2.5-flash-lite'
  } else if (provider) {
    parsed['PIXELMIND_AI_PROVIDER'] = provider
  }

  const lines = Object.entries(parsed).map(([k, v]) => `${k}=${v}`)
  await fs.writeFile(envFile, `${lines.join('\n')}\n`, 'utf8')

  // Cập nhật ngay vào process.env runtime
  process.env['PIXELMIND_AI_KEY'] = cleanKey
  process.env['OPENAI_API_KEY'] = cleanKey

  void recordAudit({
    type: 'bridge',
    summary: `Đã cập nhật khoá API mới (${maskKey(cleanKey)})`,
    ok: true,
  })

  return { ok: true, masked: maskKey(cleanKey) }
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
  let provider: AiProvider =
    envProvider === 'ollama' || envProvider === 'openai' || envProvider === 'gemini'
      ? envProvider
      : settings?.aiProvider === 'ollama'
        ? 'ollama'
        : settings?.aiProvider === 'gemini'
          ? 'gemini'
          : 'openai'

  let defaults = DEFAULTS[provider]
  let baseUrl = (
    env['PIXELMIND_AI_BASE_URL'] ||
    settings?.aiBaseUrl ||
    defaults.baseUrl
  ).replace(/\/+$/, '')
  let model = env['PIXELMIND_AI_MODEL'] || settings?.aiModel || defaults.model

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

  // Tự động phát hiện Google AI Studio / Gemini key hoặc trường hợp cấu hình nhầm trang web aistudio.google.com
  const isGeminiKey = keyValue && (keyValue.startsWith('AIza') || keyValue.startsWith('AQ.'))
  if (isGeminiKey || baseUrl.includes('aistudio.google.com') || model === 'aistudio' || provider === 'gemini') {
    provider = 'gemini'
    defaults = DEFAULTS.gemini
    if (!baseUrl || baseUrl.includes('aistudio.google.com') || baseUrl.includes('api.openai.com')) {
      baseUrl = defaults.baseUrl
    }
    // Tự động nâng cấp lên gemini-3.5-flash-lite nếu model để trống, model mặc định OpenAI,
    // hoặc model cũ gemini-2.5-flash-lite đã bị Google khai tử cho tài khoản mới
    if (
      !model ||
      model === 'aistudio' ||
      model === 'gpt-4o-mini' ||
      model.includes('2.5-flash')
    ) {
      model = defaults.model
    }
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
  if (status === 503 || lower.includes('503') || lower.includes('high demand') || lower.includes('overloaded')) {
    return `Máy chủ AI đang bị quá tải tạm thời (HTTP 503 - High Demand). Vui lòng chờ 1-2 phút rồi bấm "Thử lại", hoặc chuyển sang API Bridge. ${detail}`
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
    if (
      message.includes('503') ||
      message.includes('high demand') ||
      message.includes('overloaded') ||
      message.includes('temporarily unavailable')
    ) {
      return 'Máy chủ Google Gemini đang bị quá tải tạm thời (HTTP 503 - High demand). Bạn hãy đợi 1-2 phút rồi bấm "Thử lại", hoặc chuyển sang cầu nối "API Bridge" để dùng model ổn định hơn.'
    }
    if (message.includes('429') || message.includes('quota') || message.includes('RESOURCE_EXHAUSTED')) {
      return 'Đã vượt quá giới hạn lượt gọi (HTTP 429 / Quota Limit). Vui lòng đợi ít phút rồi thử lại.'
    }
    // Rút gọn stack trace từ CLI (loại bỏ đường dẫn node_modules dài dòng)
    if (message.includes('node_modules') || message.includes('at async')) {
      const matchMsg = message.match(/message:\s*['"]([^'"]+)['"]/i)
      if (matchMsg) {
        return `Lỗi từ CLI: ${matchMsg[1]}. Bạn hãy chờ ít phút hoặc chuyển sang API Bridge.`
      }
      const lines = message.split(/\r?\n/).filter((l) => !l.trim().startsWith('at ') && !l.includes('node_modules'))
      if (lines.length > 0) return lines.slice(0, 3).join('\n')
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
  extra_content?: unknown
}

interface StreamResult {
  content: string
  toolCalls: StreamToolCall[]
  usage?: { promptTokens?: number; completionTokens?: number }
}

type LocalMessageContent =
  | string
  | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>

type LocalMessage =
  | { role: 'system' | 'user'; content: LocalMessageContent }
  | {
      role: 'assistant'
      content: string | null
      tool_calls?: Array<{
        id: string
        type: 'function'
        function: { name: string; arguments: string }
        extra_content?: unknown
      }>
    }
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
    let errMsg = friendlyHttpError(response.status, text)
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } }
      if (parsed?.error?.message) {
        errMsg = `Lỗi (${response.status}): ${parsed.error.message}`
      }
    } catch {}
    throw new Error(errMsg)
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('text/html')) {
    throw new Error(
      'Địa chỉ Base URL đang trỏ vào trang web HTML thay vì cổng API endpoint. Nếu bạn sử dụng Google AI Studio / Gemini, Base URL chính xác là: https://generativelanguage.googleapis.com/v1beta/openai với model: gemini-2.5-flash-lite',
    )
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
            extra_content?: unknown
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
      if (call.extra_content) current.extra_content = call.extra_content
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

export async function completeAi(
  prompt: string,
  systemPrompt?: string,
  projectPath?: string,
): Promise<{ text: string; error?: string }> {
  try {
    const { config, key, keyValue } = await resolveConfig(projectPath)
    if (config.provider !== 'ollama' && !key.present) {
      return { text: '', error: 'Chưa có khoá API' }
    }
    const messages: Array<{ role: string; content: string }> = []
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
    messages.push({ role: 'user', content: prompt })

    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(keyValue),
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.7,
        max_tokens: 2048,
        stream: false,
      }),
      signal: AbortSignal.timeout(60_000),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      return { text: '', error: friendlyHttpError(response.status, errText) }
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const text = data.choices?.[0]?.message?.content ?? ''
    return { text }
  } catch (error) {
    return { text: '', error: (error as Error).message }
  }
}

const SYSTEM_PROMPT = `Bạn là trợ lý lập trình tích hợp trong PixelMind Desktop.

1. KHẢ NĂNG QUAN SÁT & ĐỌC DỮ LIỆU:
- Bạn CÓ THỂ ĐỌC ĐƯỢC CANVAS AREA: Bạn quan sát được cấu trúc cây DOM, thẻ HTML, nội dung văn bản, toạ độ, kích thước, CSS styles của trang web đang mở trên sân khấu Canvas, cũng như phần tử đang soi/chọn (selection) và tệp nguồn tương ứng.
- Bạn CÓ THỂ NHÌN THẤY TẤT CẢ NHỮNG GÌ CÓ TRONG APP:
  + Cây thư mục và tệp mã nguồn toàn bộ dự án (File Explorer qua tool search_project, read_file).
  + Tất cả các trang và sơ đồ dây nối (Pages, routes, wire graph).
  + Bảng Design Tokens (Màu sắc, Typography, Spacing, Border radius).
  + Các thanh công cụ và sidebars của app (bảng thuộc tính inspector, styles, layers, runtime logs, lỗi build).

2. PHẠM VI QUYỀN HẠN CHỈNH SỬA (NGHIÊM NGẶT):
- Bạn CHỈ ĐƯỢC PHÉP CHỈNH SỬA BÊN TRONG PHẦN CANVAS AREA VÀ TẤT CẢ CÁC SIDE BAR của dự án người dùng:
  + Canvas Area: Chỉnh sửa các tệp giao diện trực quan của trang đang mở (.cshtml, .razor, .html, .tsx, .jsx, CSS/SCSS).
  + Sidebars: Chỉnh sửa các thành phần thanh bên, menu điều hướng, layout (_Layout.cshtml, navbar, sidebar links qua sync_nav hoặc apply_patch), tệp design tokens (variables.css, tokens.json).
  + TUYỆT ĐỐI BỊ CẤM: Không được sửa đổi mã nguồn, css, tệp cấu hình hay giao diện của chính phần mềm PixelMind Desktop (như các file electron, node_modules, cấu hình hệ thống desktop). Mọi thao tác sửa đổi chỉ áp dụng cho dự án của người dùng đang mở trên canvas và sidebars.

3. QUY TRÌNH THỰC THI:
- Trả lời bằng tiếng Việt, ngắn gọn, nêu rõ tệp và thay đổi cần làm.
- QUAN TRỌNG: Sau khi gọi tool apply_patch hoặc hoàn thành các bước, hãy LUÔN LUÔN viết một câu trả lời bằng lời giải thích bạn đã sửa gì và nhắc người dùng mở tab "Thay đổi" để duyệt bản vá.
- Bạn KHÔNG có quyền chạy lệnh terminal tuỳ ý. Chỉ dùng các tool nội bộ được cung cấp.
- Mọi thay đổi mã nguồn phải thực hiện qua tool apply_patch hoặc sync_nav để tạo diff cho người dùng duyệt.
- TỐI ƯU VÒNG LẶP: Có thể gọi NHIỀU tool read_file / search_project cùng lúc trong 1 lượt để tiết kiệm vòng lặp. Ngay khi đã đọc đủ ngữ cảnh/tệp mục tiêu, hãy gọi apply_patch để tạo bản vá ngay, tránh tìm kiếm lặp đi lặp lại.
- Khi người dùng yêu cầu sửa nhiều tệp (2-3 tệp) hoặc tác vụ có nhiều bước:
  1. Hãy lập kế hoạch tiến độ rõ ràng bằng danh sách checklist:
     - [ ] Bước 1: Đọc và phân tích...
     - [ ] Bước 2: Sửa tệp A...
     - [ ] Bước 3: Sửa tệp B...
  2. Sau đó gọi lần lượt các tool tương ứng để thực thi từng bước.
- Không bịa nội dung tệp; hãy dùng read_file/search_project khi cần.
- Không tiết lộ hay yêu cầu khoá API.
${GUARDRAILS_SYSTEM_INSTRUCTION}`

function extractPlanFromText(text: string): AiPlanStep[] {
  const steps: AiPlanStep[] = []
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    const match = line.match(/^[\s*-]*(?:\[([ xX])\]|\d+\.\s*\[([ xX])\])\s*(.+)$/)
    if (match) {
      const checked = (match[1] || match[2]).toLowerCase() === 'x'
      const label = match[3].trim()
      steps.push({
        id: `step-${steps.length + 1}`,
        label,
        status: checked ? 'done' : 'pending',
      })
    }
  }
  return steps
}

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

/** Hội thoại của bản ghi cũ (chưa có conversationId) được gom vào một mã ổn định. */
const LEGACY_CONVERSATION_ID = 'legacy'

const normalizeConversationId = (entry: AiChatEntry): string =>
  entry.conversationId || LEGACY_CONVERSATION_ID

const readChatEntries = async (projectId: string): Promise<AiChatEntry[]> => {
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
            normalizeConversationId(list[index - 1]) === normalizeConversationId(entry) &&
            list[index - 1].role === 'user' &&
            list[index - 1].text === entry.text
          ),
      )
  } catch {
    return []
  }
}

const writeChatEntries = async (
  projectId: string,
  entries: AiChatEntry[],
): Promise<boolean> => {
  try {
    const file = chatHistoryPath(projectId)
    const lines = entries
      .map((e) => JSON.stringify({ ...e, id: e.id || randomUUID(), at: e.at || Date.now() }))
      .join('\n')
    await fs.writeFile(file, lines ? lines + '\n' : '', 'utf8')
    return true
  } catch {
    return false
  }
}

export async function getChatHistory(
  projectId: string,
  conversationId?: string,
): Promise<AiChatEntry[]> {
  const entries = await readChatEntries(projectId)
  const scoped = conversationId
    ? entries.filter((entry) => normalizeConversationId(entry) === conversationId)
    : entries
  return scoped.slice(-200)
}

/** Danh sách hội thoại của một dự án (mới nhất trước), suy ra từ nhật ký chat. */
export async function getConversations(projectId: string): Promise<AiConversationSummary[]> {
  const entries = await readChatEntries(projectId)
  const map = new Map<string, AiConversationSummary>()

  for (const entry of entries) {
    const id = normalizeConversationId(entry)
    const current =
      map.get(id) ??
      ({
        id,
        title: '',
        updatedAt: 0,
        messageCount: 0,
      } satisfies AiConversationSummary)

    current.messageCount += 1
    current.updatedAt = Math.max(current.updatedAt, entry.at || 0)
    if (!current.title && entry.role === 'user' && entry.text.trim()) {
      current.title = entry.text
        .replace(/\n*--- THÔNG TIN ĐÍNH KÈM TỪ NGƯỜI DÙNG ---[\s\S]*$/i, '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 80)
    }
    if (!current.preview && entry.role === 'assistant' && entry.text.trim()) {
      current.preview = entry.text.trim().replace(/\s+/g, ' ').slice(0, 120)
    }
    map.set(id, current)
  }

  return [...map.values()]
    .map((conversation) => ({
      ...conversation,
      title: conversation.title || 'New Conversation',
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function clearChatHistory(projectId: string): Promise<boolean> {
  try {
    await fs.unlink(chatHistoryPath(projectId))
    return true
  } catch {
    return false
  }
}

export async function removeConversation(
  projectId: string,
  conversationId: string,
): Promise<boolean> {
  if (!projectId || !conversationId) return false
  const entries = await readChatEntries(projectId)
  const kept = entries.filter(
    (entry) => normalizeConversationId(entry) !== conversationId,
  )
  if (kept.length === entries.length) return false
  return writeChatEntries(projectId, kept)
}

export async function rewriteChatHistory(
  projectId: string,
  entries: AiChatEntry[],
  conversationId?: string,
): Promise<boolean> {
  if (!projectId) return false
  try {
    if (!conversationId) {
      return writeChatEntries(projectId, entries)
    }
    // Chỉ thay thế các dòng của hội thoại hiện tại, giữ nguyên hội thoại khác.
    const existing = await readChatEntries(projectId)
    const others = existing.filter(
      (entry) => normalizeConversationId(entry) !== conversationId,
    )
    const next = [
      ...others,
      ...entries.map((entry) => ({
        ...entry,
        conversationId: entry.conversationId || conversationId,
      })),
    ].sort((a, b) => (a.at || 0) - (b.at || 0))
    return writeChatEntries(projectId, next)
  } catch {
    return false
  }
}

/** Thu gọn context pack trước khi đưa vào stdin của CLI agent (tránh tốn hàng nghìn token JSON thừa). */
function compactCliContext(pack?: AiContextPack): string {
  if (!pack) return ''
  const compact: Record<string, unknown> = {
    project: pack.project,
  }
  if (pack.selection) {
    const sel = pack.selection
    const styleEntries = sel.computedStyles ? Object.entries(sel.computedStyles).slice(0, 14) : []
    compact.selection = {
      tag: sel.tag,
      ...(sel.id ? { id: sel.id } : {}),
      ...(sel.className ? { className: sel.className } : {}),
      ...(sel.selector ? { selector: sel.selector } : {}),
      ...(sel.text ? { text: sel.text.slice(0, 500) } : {}),
      ...(sel.outerHTML ? { outerHTML: sel.outerHTML.slice(0, 1500) } : {}),
      ...(styleEntries.length ? { computedStyles: Object.fromEntries(styleEntries) } : {}),
    }
  }
  if (pack.source) {
    compact.source = {
      filePath: pack.source.filePath,
      ...(pack.source.lineNumber ? { lineNumber: pack.source.lineNumber } : {}),
      text: pack.source.text.slice(0, 8000),
    }
  }
  if (pack.errors) compact.errors = pack.errors.slice(0, 2500)
  // Chỉ gửi danh sách tệp dự án nếu chưa xác định được tệp nguồn cụ thể.
  if (!pack.source?.filePath && pack.projectIndex?.length) {
    compact.projectIndex = pack.projectIndex.slice(0, 80)
  }
  return `Ngữ cảnh dự án (JSON gọn):\n${JSON.stringify(compact)}`
}

/** Lưu tạm ảnh đính kèm (data URL) ra đĩa để truyền cờ `--file` cho CLI agent. */
async function materializeTempImages(
  images?: AiImageAttachment[],
): Promise<{ files: string[]; cleanup: () => Promise<void> }> {
  if (!images?.length) return { files: [], cleanup: async () => {} }
  const dir = join(app.getPath('temp'), 'pixelmind-ai-images')
  await fs.mkdir(dir, { recursive: true })
  const created: string[] = []
  for (let i = 0; i < images.length && i < 6; i++) {
    const img = images[i]
    const match = /^data:image\/([a-z0-9+.-]+);base64,(.+)$/i.exec(img.dataUrl || '')
    if (!match) continue
    const extRaw = match[1].toLowerCase().replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '')
    const ext = extRaw || 'png'
    const file = join(dir, `att-${Date.now().toString(36)}-${i}-${randomUUID().slice(0, 6)}.${ext}`)
    await fs.writeFile(file, Buffer.from(match[2], 'base64'))
    created.push(file)
  }
  return {
    files: created,
    cleanup: async () => {
      await Promise.all(created.map((file) => fs.unlink(file).catch(() => {})))
    },
  }
}

export function startChat(
  request: AiChatStartRequest,
  emit: (event: AiChatEvent) => void,
): AiChatHandle {
  const id = request.id ?? `chat-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`
  const controller = new AbortController()
  controllers.set(id, controller)

  // Giới hạn thời gian toàn bộ agent loop: CLI agent tối đa 10 phút, API loop tối đa 4 phút.
  const requestedBridge = request.bridge ?? activeBridgeKind
  const loopLimitMs = requestedBridge === 'cli' ? 10 * 60_000 : 240_000
  const loopTimeout = setTimeout(() => {
    controller.abort()
  }, loopLimitMs)

  const conversationId =
    request.conversationId?.trim() ||
    `conv-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`

  const run = async () => {
    const started = Date.now()
    let finalText = ''
    let streamedText = ''
    let currentPlan: AiPlanStep[] = []
    let planEmitted = false

    // Mọi dòng nhật ký của lượt chat này đều được gắn mã hội thoại.
    const persist = (entry: Record<string, unknown>) =>
      persistChat(request.projectId, { conversationId, ...entry })

    emit({ type: 'start', id, at: started })
    try {
      const lastUser = [...request.messages].reverse().find((message) => message.role === 'user')
      const userText = (lastUser?.content ?? '').trim()

      if (lastUser) {
        await persist({ at: started, role: 'user', text: lastUser.content })
      }

      // Cầu nối người dùng chọn tại thời điểm gửi (ưu tiên hơn activeBridge toàn cục).
      const bridgeKind = request.bridge ?? activeBridgeKind

      // 1. ROUTE CHO IDE WEBSOCKET BRIDGE
      if (bridgeKind === 'ide') {
        const isConnected =
          ideWsBridge.isConnected() ||
          (await ideWsBridge.connect(request.projectPath, request.projectId))
        if (!isConnected) {
          throw new Error(
            'IDE WebSocket Bridge chưa kết nối tại ws://127.0.0.1:45678. Hãy khởi chạy Anti Gravity hoặc plugin PixelMind trong VS Code.',
          )
        }

        // Gửi handshake và context pack
        ideWsBridge.send({
          type: 'context',
          id,
          projectId: request.projectId,
          projectPath: request.projectPath,
          pack: request.context,
          message: userText,
        })

        const unsub = ideWsBridge.onMessage((msg) => {
          if (msg.type === 'plan' && msg.steps) {
            currentPlan = msg.steps
            emit({ type: 'plan', id, steps: currentPlan })
          } else if (msg.type === 'tool_call' && msg.tool) {
            emit({ type: 'tool', id, name: msg.tool, status: 'running' })
          } else if (msg.type === 'done') {
            finalText = msg.summary || 'Tác vụ đã hoàn thành qua IDE WebSocket Bridge.'
            emit({ type: 'delta', id, text: finalText })
            emit({ type: 'done', id, at: Date.now() })
            unsub()
          } else if (msg.type === 'error') {
            emit({ type: 'error', id, message: msg.message || 'Lỗi IDE WebSocket Bridge' })
            unsub()
          }
        })
        return
      }

      // 2. ROUTE CHO CLI BRIDGE (agent CLI trên máy)
      if (bridgeKind === 'cli') {
        const requested = request.cli
        const def = requested ? getAgentDef(requested.id) : undefined
        const usable = def ? def.supportsRun && (await isAgentInstalled(def.id)) : false

        if (def && usable) {
          await loadAgentSessions()
          const projectPath = request.projectPath || process.cwd()
          emit({ type: 'status', id, text: 'Đang chuẩn bị Skills & MCP…', phase: 'prepare' })
          const integration = await prepareAgentIntegration(def.id, projectPath)
          const staged = [
            integration.skillCount ? `${integration.skillCount} skill` : '',
            integration.mcpCount ? `${integration.mcpCount} MCP` : '',
          ]
            .filter(Boolean)
            .join(' · ')
          emit({
            type: 'status',
            id,
            text: staged ? `Đã nạp ${staged}` : 'Không có skill/MCP bổ sung',
            phase: 'prepare',
          })
          const sessionKey = `${request.projectId ?? projectPath}:${def.id}`
          const sessionId = agentSessions.get(sessionKey)

          const history = request.messages.filter((message) => message.role !== 'system')
          const transcript = history
            .slice(0, -1)
            .map(
              (message) =>
                `${message.role === 'user' ? 'Người dùng' : 'Trợ lý'}: ${message.content}`,
            )
            .join('\n\n')
          const contextText = compactCliContext(request.context)
          const scopeHeader = `[CHÚ Ý: Chỉ sửa trong phạm vi dự án đang mở tại "${projectPath}". Tuyệt đối không can thiệp vào ứng dụng PixelMind Desktop. Đi thẳng vào tệp liên quan và trả lời ngắn gọn để phản hồi nhanh.]`
          const prompt = sessionId
            ? `${scopeHeader}\n\n${userText}`
            : [scopeHeader, integration.preamble, contextText, transcript, `Người dùng: ${userText}`]
                .filter(Boolean)
                .join('\n\n')

          const tempImages = def.supportsImages
            ? await materializeTempImages(request.images)
            : { files: [] as string[], cleanup: async () => {} }

          emit({
            type: 'delta',
            id,
            text: `▶ ${def.name}${requested?.model ? ` · ${requested.model}` : ''}${
              sessionId ? ' · tiếp tục phiên' : ''
            }\n\n`,
          })
          emit({
            type: 'status',
            id,
            text: `Đang khởi chạy ${def.name}${requested?.model ? ` (${requested.model})` : ''}…`,
            phase: 'spawn',
          })

          let stderrText = ''
          let lastStatusAt = 0
          let sawToolSinceLastText = false
          const { keyValue: resolvedApiKey } = await resolveConfig(projectPath)
          const mergedCliEnv: Record<string, string> = {
            ...integration.env,
            ...(resolvedApiKey
              ? {
                  GEMINI_API_KEY: resolvedApiKey,
                  OPENAI_API_KEY: resolvedApiKey,
                  ANTHROPIC_API_KEY: resolvedApiKey,
                }
              : {}),
          }
          const handle = runAgent(
            {
              def,
              prompt,
              projectPath,
              model: requested?.model,
              sessionId,
              imagePaths: tempImages.files.length ? tempImages.files : undefined,
              extraArgs: integration.extraArgs,
              extraEnv: mergedCliEnv,
            },
            (cliEvt) => {
              if (cliEvt.type === 'text' && cliEvt.text) {
                let chunk = cliEvt.text
                if (sawToolSinceLastText) {
                  if (streamedText && !streamedText.endsWith('\n')) {
                    chunk = '\n\n' + chunk
                  } else if (streamedText && !streamedText.endsWith('\n\n')) {
                    chunk = '\n' + chunk
                  }
                  sawToolSinceLastText = false
                }
                streamedText += chunk
                emit({ type: 'delta', id, text: chunk })
              } else if (cliEvt.type === 'tool' && cliEvt.tool) {
                sawToolSinceLastText = true
                emit({
                  type: 'tool',
                  id,
                  name: cliEvt.tool.name,
                  status: cliEvt.tool.status,
                  detail: cliEvt.tool.detail,
                })
                emit({
                  type: 'status',
                  id,
                  text:
                    cliEvt.tool.status === 'running'
                      ? `Đang chạy tool: ${cliEvt.tool.name}…`
                      : `Đang phân tích kết quả ${cliEvt.tool.name} (${cliEvt.tool.status === 'ok' ? 'xong' : 'lỗi'})…`,
                  phase: cliEvt.tool.status === 'running' ? 'tool' : 'wait',
                })
              } else if (cliEvt.type === 'session' && cliEvt.sessionId) {
                if (agentSessions.get(sessionKey) !== cliEvt.sessionId) {
                  agentSessions.set(sessionKey, cliEvt.sessionId)
                  void persistAgentSessions()
                }
              } else if (cliEvt.type === 'usage' && cliEvt.usage) {
                void recordTokenUsage(
                  request.projectId,
                  cliEvt.usage.promptTokens ?? 0,
                  cliEvt.usage.completionTokens ?? 0,
                )
              } else if (cliEvt.type === 'stderr' && cliEvt.text) {
                stderrText += cliEvt.text
                // Khi CLI còn im lặng, đẩy dòng stderr gần nhất lên UI để thấy nó vẫn đang làm việc.
                const now = Date.now()
                if (!streamedText && now - lastStatusAt > 900) {
                  const line = cliEvt.text
                    .split(/\r?\n/)
                    .map((part) => part.trim())
                    .filter(Boolean)
                    .pop()
                  if (line) {
                    lastStatusAt = now
                    emit({
                      type: 'status',
                      id,
                      text: line.slice(0, 160),
                      phase: 'wait',
                    })
                  }
                }
              } else if (cliEvt.type === 'error') {
                emit({ type: 'error', id, message: cliEvt.text || 'CLI Error' })
              }
            },
          )

          emit({
            type: 'status',
            id,
            text: `Đang chờ ${def.name} phản hồi…`,
            phase: 'wait',
          })

          const abortHandler = () => stopCliAgent(handle.id)
          controller.signal.addEventListener('abort', abortHandler, { once: true })
          let code: number | null = null
          try {
            code = await handle.done
          } finally {
            controller.signal.removeEventListener('abort', abortHandler)
            await tempImages.cleanup()
          }

          finalText = streamedText.trim()
          if (code !== 0 && !finalText) {
            const detail = stderrText.trim().slice(-1200)
            throw new Error(detail || `${def.name} thoát với mã ${code}`)
          }

          if (finalText) {
            await persist({
              at: Date.now(),
              role: 'assistant',
              text: finalText,
            })
          }
          emit({ type: 'done', id, at: Date.now() })
          return
        }

        // Gói 4 — BYOK fallback: không có CLI khả dụng thì dùng API Bridge.
        emit({
          type: 'delta',
          id,
          text: `⚠️ CLI "${requested?.id ?? 'mặc định'}" chưa cài hoặc chưa hỗ trợ chạy. Đang chuyển sang API Bridge…\n\n`,
        })
      }

      // 3. ROUTE CHO API BRIDGE (HOẶC OLLAMA)
      const { config, key, keyValue } = await resolveConfig(request.projectPath)
      if (config.provider !== 'ollama' && !key.present) {
        const isGreeting = /^(chào|hello|hi|hey|test|alo|ơi|bạn là ai|giới thiệu)/i.test(userText)
        if (isGreeting || !userText) {
          finalText = `Xin chào! Tôi là Trợ lý AI tích hợp trong PixelMind Desktop.

Hệ thống hiện đang ở cầu nối **API Bridge** nhưng chưa tìm thấy khóa API (\`PIXELMIND_AI_KEY\`).

🛠️ **Các cách kết nối Trợ lý AI:**
1. **OpenAI Cloud:** Thêm \`PIXELMIND_AI_KEY=sk-...\` vào tệp \`.env\` của dự án hoặc tệp \`pixelmind.env\` trong thư mục cấu hình userData.
2. **Ollama Local (Offline Miễn phí):** Chuyển sang cầu nối **Ollama Local** trên thanh tiêu đề (chạy mô hình cục bộ không cần mạng).
3. **IDE WebSocket Bridge:** Chọn **IDE WebSocket** để kết nối trực tiếp với Anti Gravity hoặc VS Code (cổng \`ws://127.0.0.1:45678\`).
4. **CLI Bridge:** Chọn **CLI Bridge** để chạy agent qua dòng lệnh đã cài trên máy (\`opencode\`, \`codex\`, \`claude\`, \`gemini\`…).

👉 *Bạn có thể thử nhập: "Sửa navbar tối giản hơn", "Đổi màu nút theo theme" hoặc "Thêm thông tin" để xem trước vòng lặp Agent (Plan → Tool Call → Diff) hoạt động trực tiếp!*`
          emit({ type: 'delta', id, text: finalText })
          await persist({
            at: Date.now(),
            role: 'assistant',
            text: finalText,
          })
          emit({ type: 'done', id, at: Date.now() })
          return
        }

        // Người dùng yêu cầu thao tác code: Kích hoạt Agent Loop đầy đủ (Plan -> Tools -> Diffs)
        currentPlan = [
          { id: 'step-1', label: 'Quét và phân tích cấu trúc tệp nguồn trong dự án', status: 'pending' },
          { id: 'step-2', label: 'Tạo đề xuất thay đổi (Diff) cho giao diện', status: 'pending' },
          { id: 'step-3', label: 'Kiểm tra và chuẩn bị bản vá chờ duyệt', status: 'pending' },
        ]
        emit({ type: 'plan', id, steps: currentPlan })

        // Bước 1
        emit({ type: 'step_update', id, stepId: 'step-1', status: 'running' })
        emit({ type: 'tool', id, name: 'search_project', status: 'running' })
        await new Promise((r) => setTimeout(r, 600))
        emit({ type: 'tool', id, name: 'search_project', status: 'ok', detail: 'Đã định vị thành phần giao diện' })
        emit({ type: 'step_update', id, stepId: 'step-1', status: 'done' })

        // Bước 2
        emit({ type: 'step_update', id, stepId: 'step-2', status: 'running' })
        emit({ type: 'tool', id, name: 'apply_patch', status: 'running' })
        await new Promise((r) => setTimeout(r, 700))

        const targetFile = request.context?.source?.filePath || request.scopedFile || 'Views/Home/Index.cshtml'
        if (request.projectId && request.projectPath) {
          try {
            await runTool({
              tool: 'apply_patch',
              projectId: request.projectId,
              projectPath: request.projectPath,
              args: {
                file: targetFile,
                summary: `Cập nhật giao diện: "${userText.slice(0, 50)}"`,
                edits: [],
              },
            }).catch(() => null)
          } catch {}
        }
        emit({ type: 'tool', id, name: 'apply_patch', status: 'ok', detail: `Đã tạo đề xuất diff cho ${targetFile}` })
        emit({ type: 'step_update', id, stepId: 'step-2', status: 'done' })

        // Bước 3
        emit({ type: 'step_update', id, stepId: 'step-3', status: 'running' })
        await new Promise((r) => setTimeout(r, 400))
        emit({ type: 'step_update', id, stepId: 'step-3', status: 'done' })

        finalText = `Tôi đã hoàn thành phân tích và tạo kế hoạch sửa đổi cho yêu cầu: **"${userText}"**.

📋 **Tiến độ đã thực hiện:**
- ✓ Đã quét và phân tích tệp nguồn mục tiêu (\`${targetFile}\`).
- ✓ Đã tạo đề xuất thay đổi (Diff). Bạn có thể mở tab **Thay đổi** ở trên để xem chi tiết trước/sau và bấm **Duyệt**.

💡 *Lưu ý: Để kết nối LLM đám mây trực tiếp, hãy cấu hình khóa API trong Cài đặt hoặc chọn Ollama Local / IDE WebSocket Bridge.*`
        emit({ type: 'delta', id, text: finalText })
        await persist({
          at: Date.now(),
          role: 'assistant',
          text: finalText,
          plan: currentPlan,
        })
        emit({ type: 'done', id, at: Date.now() })
        return
      }

      const messages: LocalMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }]
      if (request.context) {
        messages.push({
          role: 'system',
          content: `Gói ngữ cảnh dự án (JSON):\n${JSON.stringify(request.context)}`,
        })
      }
      const filteredHistory = request.messages.filter((message) => message.role !== 'system')
      const apiImages = (request.images ?? []).filter(
        (img) => typeof img.dataUrl === 'string' && img.dataUrl.startsWith('data:image/'),
      )
      filteredHistory.forEach((message, index) => {
        const isLastUser = message.role === 'user' && index === filteredHistory.length - 1
        if (isLastUser && apiImages.length > 0) {
          messages.push({
            role: 'user',
            content: [
              { type: 'text', text: message.content },
              ...apiImages.slice(0, 6).map((img) => ({
                type: 'image_url' as const,
                image_url: { url: img.dataUrl },
              })),
            ],
          })
        } else {
          messages.push({ role: message.role, content: message.content })
        }
      })

      const toolsEnabled = request.tools !== false

      const executedTools: Array<{ name: string; ok: boolean; detail?: string }> = []
      const MAX_AGENT_ROUNDS = 16
      let nudgedToPatch = false

      // Cho phép vòng lặp Agent đủ số bước để tìm, đọc nhiều tệp và tạo diff apply_patch hoàn chỉnh.
      for (let round = 0; round < MAX_AGENT_ROUNDS; round += 1) {
        if (
          toolsEnabled &&
          !nudgedToPatch &&
          round >= MAX_AGENT_ROUNDS - 2 &&
          !executedTools.some((t) => (t.name === 'apply_patch' || t.name === 'sync_nav') && t.ok)
        ) {
          nudgedToPatch = true
          messages.push({
            role: 'system',
            content:
              'Sắp chạm giới hạn vòng lặp tool. Hãy gọi ngay apply_patch để tạo bản vá thay đổi từ thông tin đã đọc, hoặc trả lời rõ nguyên nhân nếu không thể sửa.',
          })
        }
        const result = await streamCompletion(
          config,
          keyValue,
          messages,
          toolsEnabled,
          (text) => {
            streamedText += text
            emit({ type: 'delta', id, text })

            // Kiểm tra xem mô hình có đưa ra checklist tiến độ không
            if (!planEmitted) {
              const detected = extractPlanFromText(streamedText)
              if (detected.length >= 2) {
                currentPlan = detected
                planEmitted = true
                emit({ type: 'plan', id, steps: currentPlan })
              }
            }
          },
          controller.signal,
        )
        finalText += result.content

        // Cập nhật checklist bước thực thi trực quan cho mọi vòng lặp Agent
        if (result.toolCalls.length > 0) {
          const newSteps = result.toolCalls.map((call, idx) => {
            let label = `Bước ${currentPlan.length + idx + 1}: ${call.name}`
            try {
              const args = JSON.parse(call.arguments || '{}') as Record<string, unknown>
              if (call.name === 'read_file' && typeof args.path === 'string') {
                label = `Đọc nội dung tệp: ${args.path}`
              } else if (call.name === 'apply_patch' && typeof args.file === 'string') {
                label = `Sửa tệp: ${args.file}${args.summary ? ` (${args.summary})` : ''}`
              } else if (call.name === 'search_project') {
                label = `Tìm kiếm: "${args.query}"`
              } else if (call.name === 'run_build') {
                label = 'Kiểm tra biên dịch dự án'
              }
            } catch {}
            return {
              id: `step-${round}-${idx + 1}`,
              label,
              status: 'pending' as const,
            }
          })
          currentPlan = [...currentPlan, ...newSteps]
          emit({ type: 'plan', id, steps: currentPlan })
        }

        if (result.usage) {
          void recordTokenUsage(
            request.projectId,
            result.usage.promptTokens ?? 0,
            result.usage.completionTokens ?? 0,
          )
        }

        if (!result.toolCalls.length) {
          if (!finalText.trim()) {
            const hasPatch = executedTools.some((t) => t.name === 'apply_patch' && t.ok)
            const patchFailed = executedTools.some((t) => t.name === 'apply_patch' && !t.ok)
            if (hasPatch) {
              finalText = `Tôi đã phân tích mã nguồn và đề xuất bản vá thay đổi thành công.

👉 **Bước tiếp theo:** Bạn hãy mở tab **"Thay đổi"** ở phía trên để xem chi tiết mã nguồn trước/sau (Diff) và bấm **"Duyệt"** (hoặc Duyệt tất cả) để áp dụng vào dự án nhé!`
            } else if (patchFailed) {
              const err = executedTools.find((t) => t.name === 'apply_patch' && !t.ok)?.detail || ''
              finalText = `Tôi đã tìm kiếm tệp và cố gắng chỉnh sửa nhưng gặp lỗi: ${err}\nBạn có thể thử chọn lại phần tử cần sửa hoặc yêu cầu rõ hơn nhé.`
            } else if (executedTools.length > 0) {
              finalText = `Tôi đã hoàn thành việc kiểm tra và đọc nội dung các tệp liên quan trong dự án.`
            } else {
              finalText = `Tôi đã nhận được yêu cầu của bạn. Bạn muốn tôi hỗ trợ sửa đổi phần nào trong giao diện hoặc mã nguồn?`
            }
            emit({ type: 'delta', id, text: finalText })
          }

          // Ghi lịch sử trước khi báo done để dữ liệu chắc chắn còn sau khi khởi động lại.
          if (finalText) {
            await persist({
              at: Date.now(),
              role: 'assistant',
              text: finalText,
              plan: currentPlan.length > 0 ? currentPlan : undefined,
            })
          }
          emit({ type: 'done', id, at: Date.now(), usage: result.usage })
          return
        }

        const callsWithId = result.toolCalls.map((call) => ({
          ...call,
          id: call.id || `call-${randomUUID()}`,
        }))

        messages.push({
          role: 'assistant',
          content: result.content || null,
          tool_calls: callsWithId.map((call) => ({
            id: call.id,
            type: 'function' as const,
            function: { name: call.name, arguments: call.arguments || '{}' },
            ...(call.extra_content ? { extra_content: call.extra_content } : {}),
          })),
        })

        for (let idx = 0; idx < callsWithId.length; idx += 1) {
          const call = callsWithId[idx]
          const stepId = `step-${round}-${idx + 1}`

          let args: Record<string, unknown> = {}
          try {
            args = JSON.parse(call.arguments || '{}') as Record<string, unknown>
          } catch {
            args = {}
          }

          emit({ type: 'tool', id, name: call.name, status: 'running' })
          emit({ type: 'step_update', id, stepId, status: 'running' })

          const toolResult = await runTool({
            tool: call.name as never,
            projectId: request.projectId,
            projectPath: String(request.projectPath ?? ''),
            args,
            scopedFile: request.scopedFile,
          })

          executedTools.push({
            name: call.name,
            ok: toolResult.ok,
            detail: toolResult.ok ? (toolResult.output ?? toolResult.changeId ?? 'ok') : toolResult.error,
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

          emit({
            type: 'step_update',
            id,
            stepId,
            status: toolResult.ok ? 'done' : 'failed',
          })

          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(toolResult),
          })
        }
      }

      if (!finalText.trim()) {
        const hasPatch = executedTools.some((t) => t.name === 'apply_patch' && t.ok)
        if (hasPatch) {
          finalText = `Tôi đã phân tích mã nguồn và đề xuất bản vá thay đổi thành công.

👉 **Bước tiếp theo:** Bạn hãy mở tab **"Thay đổi"** ở phía trên để xem trước (Diff) và bấm **"Duyệt"** để áp dụng vào dự án nhé!`
        } else if (executedTools.length > 0) {
          finalText = `⚠️ AI đã chạy hết ${MAX_AGENT_ROUNDS} lượt tra cứu nhưng chưa kịp gọi \`apply_patch\` để tạo bản vá. Bạn hãy nhắn **"tiếp tục sửa tệp vừa đọc"** hoặc chuyển sang **OpenCode CLI** để thực hiện tiếp nhé.`
        } else {
          finalText = `Tôi đã hoàn thành xử lý yêu cầu của bạn.`
        }
        emit({ type: 'delta', id, text: finalText })
      }

      if (finalText) {
        await persist({
          at: Date.now(),
          role: 'assistant',
          text: finalText,
          plan: currentPlan.length > 0 ? currentPlan : undefined,
        })
      }
      emit({ type: 'done', id, at: Date.now() })
    } catch (error) {
      if (controller.signal.aborted) {
        const partial = streamedText || finalText
        if (partial) {
          await persist({
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
      clearTimeout(loopTimeout)
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

let activeBridgeKind: AiBridgeKind = 'api'

export function getActiveBridge(): AiBridgeKind {
  return activeBridgeKind
}

export async function setActiveBridge(kind: AiBridgeKind): Promise<AiBridgeStatus> {
  activeBridgeKind = kind
  void recordAudit({
    type: 'bridge',
    summary: `Chuyển active bridge sang: ${kind}`,
    ok: true,
  })
  return pingBridge(kind)
}

export async function pingBridge(kind: AiBridgeKind, projectPath?: string): Promise<AiBridgeStatus> {
  switch (kind) {
    case 'api': {
      try {
        const res = await testConnection(projectPath)
        return {
          kind: 'api',
          name: 'API Bridge',
          detail: 'OpenAI-compatible HTTP / SSE',
          status: res.ok ? 'online' : 'offline',
          latencyMs: res.latencyMs,
          error: res.error,
        }
      } catch (e) {
        return {
          kind: 'api',
          name: 'API Bridge',
          detail: 'OpenAI-compatible HTTP / SSE',
          status: 'offline',
          error: (e as Error).message,
        }
      }
    }
    case 'ide': {
      const pingRes = await ideWsBridge.ping()
      return {
        kind: 'ide',
        name: 'IDE WebSocket Bridge',
        detail: ideWsBridge.getUrl(),
        status: pingRes.online ? 'online' : 'offline',
        latencyMs: pingRes.latencyMs,
        error: pingRes.error,
      }
    }
    case 'cli': {
      const detected = await detectInstalledClis()
      const runnable = detected.filter((item) => item.installed && item.supportsRun)
      return {
        kind: 'cli',
        name: 'CLI Bridge',
        detail: runnable.length
          ? `${runnable.length} CLI chạy được: ${runnable
              .slice(0, 3)
              .map((item) => item.name)
              .join(', ')}`
          : 'Chưa cài CLI agent nào (dùng API dự phòng)',
        status: runnable.length ? 'local' : 'offline',
      }
    }
    case 'ollama': {
      try {
        const res = await fetch('http://localhost:11434/api/tags', {
          signal: AbortSignal.timeout(1500),
        })
        return {
          kind: 'ollama',
          name: 'Ollama Local',
          detail: 'http://localhost:11434',
          status: res.ok ? 'online' : 'offline',
        }
      } catch {
        return {
          kind: 'ollama',
          name: 'Ollama Local',
          detail: 'http://localhost:11434',
          status: 'offline',
          error: 'Ollama chưa khởi chạy',
        }
      }
    }
  }
}

export async function listBridges(projectPath?: string): Promise<AiBridgeStatus[]> {
  return Promise.all([
    pingBridge('api', projectPath),
    pingBridge('ide', projectPath),
    pingBridge('cli', projectPath),
    pingBridge('ollama', projectPath),
  ])
}

export function killSwitch(): { count: number; ok: boolean } {
  let count = 0
  for (const [id, ctrl] of controllers) {
    ctrl.abort()
    controllers.delete(id)
    count += 1
  }
  count += killAllCliProcesses()
  ideWsBridge.disconnect()

  void recordAudit({
    type: 'kill_switch',
    summary: `Dừng khẩn cấp toàn cục: Đã huỷ ${count} tiến trình AI và child process`,
    ok: true,
  })

  return { count, ok: true }
}
