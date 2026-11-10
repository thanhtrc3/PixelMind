import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { promisify } from 'node:util'
import type { AiCliEvent, AiCliRunRequest, DetectedCli } from '../../shared/ai'
import {
  AGENT_DEFS,
  findAgentDefByBinary,
  getAgentDef,
  type AgentDef,
  type AgentStreamFormat,
} from './agentDefs'
import { recordAudit } from './aiAudit'

const execFileAsync = promisify(execFile)

const LOOKUP_CMD = process.platform === 'win32' ? 'where.exe' : 'which'
const DEFAULT_AGENT_TIMEOUT_MS = 10 * 60_000

const activeCliProcesses = new Map<string, { proc: ChildProcess; timer?: NodeJS.Timeout }>()

/** Quote một tham số cho cmd.exe (dùng khi phải chạy shim .cmd/.bat trên Windows). */
function quoteForCmd(value: string): string {
  if (value === '') return '""'
  if (!/[\s"&|<>^()%!]/.test(value)) return value
  return `"${value.replace(/"/g, '\\"')}"`
}

/**
 * Trên Windows, các CLI cài qua npm là shim .cmd/.bat và KHÔNG thể spawn trực tiếp
 * bằng shell:false. Chạy qua cmd.exe với command line được quote thủ công.
 */
function spawnBinary(
  binaryPath: string,
  args: string[],
  options: Parameters<typeof spawn>[2],
): ChildProcess {
  const isShim = process.platform === 'win32' && /\.(cmd|bat)$/i.test(binaryPath)
  if (!isShim) return spawn(binaryPath, args, options)

  const comspec = process.env.ComSpec || 'cmd.exe'
  const inner = [binaryPath, ...args].map(quoteForCmd).join(' ')
  if (inner.length > 7000) {
    throw new Error(
      `Lệnh quá dài cho shim .cmd trên Windows (${inner.length} ký tự, giới hạn ~8191). ` +
        'Hãy giảm ngữ cảnh gửi kèm hoặc chọn CLI nhận prompt qua stdin (ví dụ OpenCode).',
    )
  }
  return spawn(comspec, [`/d /s /c "${inner}"`], {
    ...options,
    windowsVerbatimArguments: true,
  })
}

export function isBinaryAllowed(binary: string): boolean {
  return Boolean(findAgentDefByBinary(binary))
}

function firstLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.replace(/\u001b\[[0-9;]*m/g, '').trim())
      .find(Boolean) ?? ''
  )
}

/** Trên Windows, ưu tiên .exe rồi .cmd/.bat — bỏ qua shim bash không có phần mở rộng. */
function rankCandidate(candidate: string): number {
  if (process.platform !== 'win32') return 0
  const lower = candidate.toLowerCase()
  if (lower.endsWith('.exe')) return 0
  if (lower.endsWith('.cmd') || lower.endsWith('.bat')) return 1
  return 2
}

/** Tìm đường dẫn thật của binary: ưu tiên bin chính, rồi tới fallbackBins. */
async function resolveBinary(def: AgentDef): Promise<string | null> {
  for (const bin of [def.bin, ...(def.fallbackBins ?? [])]) {
    try {
      const { stdout } = await execFileAsync(LOOKUP_CMD, [bin], {
        timeout: 2500,
        windowsHide: true,
      })
      const candidates = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .sort((a, b) => rankCandidate(a) - rankCandidate(b))
      if (candidates.length) return candidates[0]
    } catch {
      // thử binary kế tiếp
    }
  }
  return null
}

/** Một dòng có giống số phiên bản không (tránh nhầm thông báo lỗi thành version). */
function extractVersion(line: string): string | undefined {
  if (line.length > 120) return undefined
  const match = line.match(/v?\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?/i)
  return match ? match[0].replace(/^v/i, '') : undefined
}

interface VersionProbe {
  version?: string
  /** Thông báo thô khi lệnh tồn tại nhưng không chạy được (shim hỏng, thiếu cài đặt…). */
  note?: string
}

interface ProbeResult {
  stdout: string
  stderr: string
  code: number | null
  timedOut: boolean
}

/**
 * Chạy một lệnh probe và thu toàn bộ output.
 * Dùng spawnBinary để chạy được cả shim .cmd/.bat trên Windows
 * (execFile không thể chạy trực tiếp các shim này).
 */
function runProbe(binaryPath: string, args: string[], timeoutMs: number): Promise<ProbeResult> {
  return new Promise((resolve) => {
    let child: ChildProcess
    try {
      child = spawnBinary(binaryPath, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (error) {
      resolve({
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        code: -1,
        timedOut: false,
      })
      return
    }

    let stdout = ''
    let stderr = ''
    let done = false

    const finish = (code: number | null, timedOut = false) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve({ stdout, stderr, code, timedOut })
    }

    const timer = setTimeout(() => {
      try {
        if (process.platform === 'win32' && child.pid) {
          spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], {
            windowsHide: true,
            stdio: 'ignore',
          })
        } else {
          child.kill('SIGKILL')
        }
      } catch {
        // bỏ qua
      }
      finish(null, true)
    }, timeoutMs)

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', (error) => {
      stderr += error.message
      finish(-1)
    })
    child.on('close', (code) => finish(code))
  })
}

async function probeVersion(binaryPath: string, def: AgentDef): Promise<VersionProbe> {
  const result = await runProbe(binaryPath, def.versionArgs, 6000)
  const output = result.stdout || result.stderr
  const line = firstLine(output)
  const version = line ? extractVersion(line) : undefined

  // Nhiều CLI in version ra stderr rồi thoát với mã lỗi — vẫn chấp nhận nếu có số phiên bản.
  if (version) return { version }

  if (result.code !== 0) {
    return { note: line ? line.slice(0, 160) : 'Lệnh không chạy được' }
  }
  return {}
}

async function probeAuth(
  binaryPath: string,
  def: AgentDef,
): Promise<'ok' | 'missing' | 'unknown'> {
  if (!def.authArgs) return 'unknown'
  const result = await runProbe(binaryPath, def.authArgs, 5000)
  return result.code === 0 ? 'ok' : 'missing'
}

/** Kiểm tra nhanh một agent có sẵn trên máy hay không (cache riêng, TTL dài hơn UI). */
const installCache = new Map<string, { at: number; ok: boolean }>()
const INSTALL_TTL_MS = 5 * 60_000

export async function isAgentInstalled(id: string): Promise<boolean> {
  const def = getAgentDef(id)
  if (!def) return false

  const cached = installCache.get(id)
  if (cached && Date.now() - cached.at < INSTALL_TTL_MS) return cached.ok

  const path = await resolveBinary(def)
  let ok = false
  if (path) {
    const probe = await probeVersion(path, def)
    ok = Boolean(probe.version)
  }
  installCache.set(id, { at: Date.now(), ok })
  return ok
}

/** Quét song song toàn bộ CLI đã đăng ký, lỗi một CLI không làm hỏng cả danh sách. */
let detectCache: { at: number; value: DetectedCli[] } | null = null
const DETECT_TTL_MS = 20_000

export async function detectInstalledClis(force = false): Promise<DetectedCli[]> {
  if (!force && detectCache && Date.now() - detectCache.at < DETECT_TTL_MS) {
    return detectCache.value
  }
  if (force) installCache.clear()

  const results = await Promise.all(
    AGENT_DEFS.map(async (def): Promise<DetectedCli> => {
      const path = await resolveBinary(def)
      if (!path) {
        return {
          id: def.id,
          binary: def.bin,
          name: def.name,
          installed: false,
          description: def.description,
          supportsRun: def.supportsRun,
          auth: 'unknown',
        }
      }

      const versionProbe = await probeVersion(path, def)
      if (!versionProbe.version) {
        // Tìm thấy lệnh nhưng không chạy được (shim rỗng, thiếu cài đặt, sai PATH…).
        return {
          id: def.id,
          binary: def.bin,
          name: def.name,
          path,
          installed: false,
          description: def.description,
          supportsRun: def.supportsRun,
          auth: 'unknown',
          note: versionProbe.note ?? 'Không lấy được phiên bản — lệnh có thể chưa cài đặt đầy đủ.',
        }
      }

      const auth = await probeAuth(path, def)

      return {
        id: def.id,
        binary: def.bin,
        name: def.name,
        version: versionProbe.version,
        path,
        installed: true,
        description: def.description,
        supportsRun: def.supportsRun,
        auth,
        models: def.fallbackModels,
      }
    }),
  )

  const sorted = results.sort((a, b) => {
    if (a.installed !== b.installed) return a.installed ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  detectCache = { at: Date.now(), value: sorted }
  return sorted
}

function parseModelList(raw: string): string[] {
  const text = raw.replace(/\u001b\[[0-9;]*m/g, '').trim()
  if (!text) return []

  // Một số CLI trả JSON.
  try {
    const parsed = JSON.parse(text) as unknown
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { data?: unknown }).data)
        ? (parsed as { data: unknown[] }).data
        : Array.isArray((parsed as { models?: unknown }).models)
          ? (parsed as { models: unknown[] }).models
          : []
    const models = list
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>
          return String(obj.id ?? obj.model ?? obj.name ?? obj.slug ?? '')
        }
        return ''
      })
      .filter(Boolean)
    if (models.length) return [...new Set(models)].slice(0, 300)
  } catch {
    // không phải JSON — rơi xuống parse theo dòng
  }

  const models = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s*•\-–]+/, '').trim())
    .filter((line) => line && !/\s{3,}/.test(line) && line.length <= 120)
    .filter((line) => !/^(provider|model|available|default|usage|error|no models)/i.test(line))
  return [...new Set(models)].slice(0, 300)
}

/** Model discovery theo từng CLI, có fallback tĩnh. */
export async function listAgentModels(id: string): Promise<string[]> {
  const def = getAgentDef(id)
  if (!def) return []

  if (def.modelsArgs) {
    const binaryPath = await resolveBinary(def)
    if (binaryPath) {
      const result = await runProbe(binaryPath, def.modelsArgs, 25_000)
      const models = parseModelList(result.stdout || result.stderr)
      if (models.length) return models
    }
  }

  return def.fallbackModels ?? []
}

/* ─────────────────────────────────────────────────────────────
   Bộ phân tích stream: biến stdout của từng CLI thành sự kiện
   có cấu trúc (text / tool / session / usage) cho chatbox.
   ───────────────────────────────────────────────────────────── */

type ParsedChunk =
  | { kind: 'text'; text: string }
  | { kind: 'tool'; name: string; status: 'running' | 'ok' | 'error'; detail?: string }
  | { kind: 'session'; sessionId: string }
  | { kind: 'usage'; promptTokens?: number; completionTokens?: number }

function readSessionId(obj: Record<string, unknown>): string | undefined {
  const direct = [
    obj.session_id,
    obj.sessionId,
    obj.sessionID,
    obj.thread_id,
    obj.threadId,
    obj.conversation_id,
    obj.conversationId,
  ]
  for (const value of direct) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  const message = obj.message
  if (message && typeof message === 'object') {
    const nested = (message as Record<string, unknown>).session_id
    if (typeof nested === 'string' && nested.trim()) return nested.trim()
  }
  return undefined
}

function readUsage(obj: Record<string, unknown>): ParsedChunk | null {
  const part = obj.part as Record<string, unknown> | undefined
  const partTokens = part?.tokens as Record<string, unknown> | undefined
  if (partTokens) {
    const promptTokens = Number(partTokens.input ?? 0) || 0
    const completionTokens = Number(partTokens.output ?? 0) || 0
    if (promptTokens || completionTokens) return { kind: 'usage', promptTokens, completionTokens }
  }

  const raw =
    (obj.usage as Record<string, unknown> | undefined) ??
    ((obj.data as Record<string, unknown> | undefined)?.usage as
      | Record<string, unknown>
      | undefined) ??
    ((obj.message as Record<string, unknown> | undefined)?.usage as
      | Record<string, unknown>
      | undefined)
  if (!raw) return null
  const promptTokens = Number(raw.input_tokens ?? raw.prompt_tokens ?? raw.inputTokens ?? 0) || 0
  const completionTokens =
    Number(raw.output_tokens ?? raw.completion_tokens ?? raw.outputTokens ?? 0) || 0
  if (!promptTokens && !completionTokens) return null
  return { kind: 'usage', promptTokens, completionTokens }
}

function readTool(obj: Record<string, unknown>): ParsedChunk | null {
  const type = String(obj.type ?? '')
  if (!/tool/i.test(type)) return null
  if (/result/i.test(type)) return null

  const part = (obj.part as Record<string, unknown> | undefined) ?? undefined
  const item = (obj.item as Record<string, unknown> | undefined) ?? undefined
  const data = (obj.data as Record<string, unknown> | undefined) ?? undefined
  const state = (part?.state as Record<string, unknown> | undefined) ?? undefined

  const name =
    obj.name ??
    obj.tool ??
    obj.tool_name ??
    item?.name ??
    item?.type ??
    part?.tool ??
    data?.toolName ??
    data?.name ??
    'tool'

  const statusRaw = String(
    obj.status ?? state?.status ?? data?.status ?? item?.status ?? type,
  ).toLowerCase()
  const status: 'running' | 'ok' | 'error' = /error|fail/.test(statusRaw)
    ? 'error'
    : /start|running|begin|call|pending/.test(statusRaw)
      ? 'running'
      : 'ok'

  const detailRaw = obj.detail ?? obj.summary ?? data?.detail ?? item?.command ?? state?.title
  return {
    kind: 'tool',
    name: String(name).slice(0, 80),
    status,
    detail: detailRaw ? String(detailRaw).slice(0, 300) : undefined,
  }
}

function readContentBlocks(content: unknown): ParsedChunk[] {
  if (!Array.isArray(content)) return []
  const out: ParsedChunk[] = []
  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    const item = block as Record<string, unknown>
    if (item.type === 'text' && typeof item.text === 'string') {
      out.push({ kind: 'text', text: item.text })
    } else if (item.type === 'tool_use') {
      out.push({
        kind: 'tool',
        name: String(item.name ?? 'tool'),
        status: 'running',
        detail: typeof item.input === 'object' ? JSON.stringify(item.input).slice(0, 300) : undefined,
      })
    }
  }
  return out
}

function parseEvent(
  format: AgentStreamFormat,
  obj: Record<string, unknown>,
  state: { sawText: boolean },
): ParsedChunk[] {
  const out: ParsedChunk[] = []
  const type = String(obj.type ?? '')
  const sessionId = readSessionId(obj)
  if (sessionId) out.push({ kind: 'session', sessionId })

  const usage = readUsage(obj)
  if (usage) out.push(usage)

  const tool = readTool(obj)
  if (tool) out.push(tool)

  if (format === 'opencode-json') {
    if (type === 'text') {
      const part = obj.part as Record<string, unknown> | undefined
      const text = part?.text ?? obj.text
      if (typeof text === 'string' && text) {
        state.sawText = true
        out.push({ kind: 'text', text })
      }
    } else if (type === 'error') {
      const message = obj.message ?? (obj.error as Record<string, unknown> | undefined)?.message
      if (typeof message === 'string') out.push({ kind: 'text', text: `\n⚠️ ${message}\n` })
    }
    return out
  }

  if (format === 'codex-json') {
    const item = obj.item as Record<string, unknown> | undefined
    if (type === 'item.completed' && item?.type === 'agent_message') {
      const text = item.text ?? obj.text
      if (typeof text === 'string' && text) {
        state.sawText = true
        out.push({ kind: 'text', text })
      }
    } else if (type === 'error') {
      const message = obj.message
      if (typeof message === 'string') out.push({ kind: 'text', text: `\n⚠️ ${message}\n` })
    }
    return out
  }

  if (format === 'copilot-json') {
    const data = obj.data as Record<string, unknown> | undefined
    if (/message_delta/.test(type)) {
      const text = data?.delta ?? obj.delta
      if (typeof text === 'string' && text) {
        state.sawText = true
        out.push({ kind: 'text', text })
      }
    } else if (type === 'result') {
      const text = obj.result ?? data?.content
      if (!state.sawText && typeof text === 'string' && text) {
        out.push({ kind: 'text', text })
      }
    }
    return out
  }

  // claude-json / cursor-json / qoder-json: dùng message.content blocks.
  if (type === 'assistant' || type === 'message' || type === 'agent_message') {
    const message = obj.message as Record<string, unknown> | undefined
    const blocks = readContentBlocks(message?.content ?? obj.content)
    if (blocks.length) {
      state.sawText = state.sawText || blocks.some((chunk) => chunk.kind === 'text')
      out.push(...blocks)
    }
  } else if (type === 'user') {
    const message = obj.message as Record<string, unknown> | undefined
    const content = message?.content
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block && typeof block === 'object') {
          const item = block as Record<string, unknown>
          if (item.type === 'tool_result') {
            out.push({ kind: 'tool', name: 'tool', status: item.is_error ? 'error' : 'ok' })
          }
        }
      }
    }
  } else if (type === 'result') {
    const text = obj.result ?? obj.text
    if (!state.sawText && typeof text === 'string' && text) {
      state.sawText = true
      out.push({ kind: 'text', text })
    }
  }

  return out
}

function createStreamParser(format: AgentStreamFormat) {
  let buffer = ''
  const state = { sawText: false }

  const handleLine = (rawLine: string): ParsedChunk[] => {
    const line = rawLine.trim()
    if (!line) return []

    if (format === 'plain') {
      state.sawText = true
      return [{ kind: 'text', text: `${rawLine}\n` }]
    }

    if (!line.startsWith('{') && !line.startsWith('[')) {
      // Banner / log không phải JSON — vẫn hiển thị để không mất thông tin.
      return [{ kind: 'text', text: `${line}\n` }]
    }

    try {
      const parsed = JSON.parse(line) as unknown
      if (Array.isArray(parsed)) {
        return parsed.flatMap((item) =>
          item && typeof item === 'object'
            ? parseEvent(format, item as Record<string, unknown>, state)
            : [],
        )
      }
      if (parsed && typeof parsed === 'object') {
        return parseEvent(format, parsed as Record<string, unknown>, state)
      }
    } catch {
      return [{ kind: 'text', text: `${line}\n` }]
    }
    return []
  }

  return {
    push(chunk: string): ParsedChunk[] {
      if (format === 'plain') return [{ kind: 'text', text: chunk }]
      buffer += chunk
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''
      return lines.flatMap(handleLine)
    },
    flush(): ParsedChunk[] {
      if (!buffer.trim()) return []
      const rest = buffer
      buffer = ''
      return handleLine(rest)
    },
  }
}

export interface AgentRunOptions {
  def: AgentDef
  prompt: string
  projectPath: string
  model?: string
  sessionId?: string
  imagePaths?: string[]
  extraArgs?: string[]
  extraEnv?: Record<string, string>
  timeoutMs?: number
}

export interface AgentRunHandle {
  id: string
  done: Promise<number | null>
}

/** Chạy một agent CLI, stream sự kiện có cấu trúc ra chatbox. */
export function runAgent(
  options: AgentRunOptions,
  onEvent: (event: AiCliEvent) => void,
): AgentRunHandle {
  const id = `cli-${Date.now().toString(36)}-${randomUUID().slice(0, 5)}`
  const { def } = options

  if (!def.supportsRun) {
    const message = `${def.name} hiện chỉ được phát hiện, chưa hỗ trợ chạy từ chatbox.`
    setTimeout(() => {
      onEvent({ id, type: 'error', text: message })
      onEvent({ id, type: 'exit', code: 1 })
    }, 10)
    return { id, done: Promise.resolve(1) }
  }

  const args = [
    ...def.buildArgs({
      prompt: options.prompt,
      model: options.model,
      sessionId: options.sessionId,
      imagePaths: options.imagePaths,
      cwd: options.projectPath,
    }),
    ...(options.extraArgs ?? []),
  ]

  const timeoutMs = options.timeoutMs ?? DEFAULT_AGENT_TIMEOUT_MS
  const startedAt = Date.now()
  const parser = createStreamParser(def.streamFormat)

  const emitChunks = (chunks: ParsedChunk[]) => {
    for (const chunk of chunks) {
      if (chunk.kind === 'text') {
        if (chunk.text) onEvent({ id, type: 'text', text: chunk.text })
      } else if (chunk.kind === 'tool') {
        onEvent({
          id,
          type: 'tool',
          tool: { name: chunk.name, status: chunk.status, detail: chunk.detail },
        })
      } else if (chunk.kind === 'session') {
        onEvent({ id, type: 'session', sessionId: chunk.sessionId })
      } else if (chunk.kind === 'usage') {
        onEvent({
          id,
          type: 'usage',
          usage: { promptTokens: chunk.promptTokens, completionTokens: chunk.completionTokens },
        })
      }
    }
  }

  const done = (async (): Promise<number | null> => {
    const binaryPath = (await resolveBinary(def)) ?? def.bin
    let proc: ChildProcess
    try {
      proc = spawnBinary(binaryPath, args, {
        cwd: options.projectPath,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        env: { ...process.env, ...(options.extraEnv ?? {}) },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      onEvent({ id, type: 'error', text: message })
      onEvent({ id, type: 'exit', code: 1 })
      return 1
    }

    return new Promise<number | null>((resolve) => {
      // Chỉ phát "exit" và resolve đúng một lần, kể cả khi spawn lỗi rồi vẫn có "close".
      let settled = false
      const finish = (code: number | null) => {
        if (settled) return
        settled = true
        onEvent({ id, type: 'exit', code: code ?? 0 })
        resolve(code)
      }

      const timer = setTimeout(() => {
        stopCliAgent(id)
        onEvent({
          id,
          type: 'error',
          text: `CLI vượt quá thời gian tối đa (${Math.round(timeoutMs / 1000)}s), đã tự động dừng.`,
        })
      }, timeoutMs)

      activeCliProcesses.set(id, { proc, timer })

      void recordAudit({
        type: 'cli',
        summary: `Chạy agent ${def.name}: ${def.bin} ${args.slice(0, 4).join(' ')}`,
        ok: true,
        detail: `PID: ${proc.pid}, CWD: ${options.projectPath}`,
      })

      proc.stdout?.on('data', (chunk: Buffer) => {
        emitChunks(parser.push(chunk.toString('utf8')))
      })

      proc.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8')
        onEvent({ id, type: 'stderr', text })
      })

      proc.on('error', (error) => {
        clearTimeout(timer)
        activeCliProcesses.delete(id)
        void recordAudit({
          type: 'cli',
          summary: `Lỗi khởi chạy ${def.name}: ${error.message}`,
          ok: false,
        })
        onEvent({ id, type: 'error', text: error.message })
        finish(1)
      })

      proc.on('close', (code) => {
        clearTimeout(timer)
        activeCliProcesses.delete(id)
        emitChunks(parser.flush())
        void recordAudit({
          type: 'cli',
          summary: `${def.name} hoàn thành (${code === 0 ? 'Thành công' : `Mã lỗi ${code}`})`,
          ok: code === 0,
          durationMs: Date.now() - startedAt,
        })
        finish(code ?? 0)
      })

      // Gửi prompt: stdin nếu CLI khai báo, ngược lại đóng stdin ngay.
      try {
        if (def.promptViaStdin) {
          proc.stdin?.write(options.prompt)
          proc.stdin?.end()
        } else {
          proc.stdin?.end()
        }
      } catch {
        // bỏ qua lỗi đóng stdin
      }
    })
  })()

  return { id, done }
}

export function stopCliAgent(id: string): boolean {
  const item = activeCliProcesses.get(id)
  if (!item) return false

  if (item.timer) clearTimeout(item.timer)

  try {
    const pid = item.proc.pid
    if (pid) {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(pid), '/f', '/t'], { shell: false, windowsHide: true })
      } else {
        item.proc.kill('SIGKILL')
      }
    }
  } catch {}

  activeCliProcesses.delete(id)
  void recordAudit({
    type: 'cli',
    summary: `Đã dừng CLI Agent giữa chừng (${id})`,
    ok: true,
  })
  return true
}

export function killAllCliProcesses(): number {
  let count = 0
  for (const [id] of activeCliProcesses) {
    if (stopCliAgent(id)) count += 1
  }
  return count
}

/** API cũ: chạy binary thô với args, giữ để tương thích. */
export async function runCliAgent(
  request: AiCliRunRequest,
  onEvent: (event: AiCliEvent) => void,
): Promise<{ id: string }> {
  const id = request.id || `cli-${Date.now().toString(36)}-${randomUUID().slice(0, 5)}`

  const def = findAgentDefByBinary(request.binary)
  if (!def) {
    const errorMsg = `Lệnh thực thi không hợp lệ: "${request.binary}". Hãy chọn một CLI agent đã đăng ký.`
    void recordAudit({
      type: 'cli',
      summary: `CLI bị từ chối: ${request.binary}`,
      ok: false,
      detail: errorMsg,
    })
    setTimeout(() => {
      onEvent({ id, type: 'error', text: errorMsg })
      onEvent({ id, type: 'exit', code: 1 })
    }, 10)
    return { id }
  }

  const timeoutMs = request.timeoutMs ?? DEFAULT_AGENT_TIMEOUT_MS
  const startedAt = Date.now()

  try {
    const binaryPath = (await resolveBinary(def)) ?? request.binary
    const proc = spawnBinary(binaryPath, request.args, {
      cwd: request.projectPath,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env, ...(request.env ?? {}) },
    })

    const timer = setTimeout(() => {
      stopCliAgent(id)
      onEvent({
        id,
        type: 'error',
        text: `CLI vượt quá thời gian tối đa (${timeoutMs / 1000}s), đã tự động dừng.`,
      })
    }, timeoutMs)

    activeCliProcesses.set(id, { proc, timer })

    void recordAudit({
      type: 'cli',
      summary: `Chạy CLI Agent: ${request.binary} ${request.args.slice(0, 3).join(' ')}`,
      ok: true,
      detail: `PID: ${proc.pid}, CWD: ${request.projectPath}`,
    })

    if (typeof request.stdinText === 'string') {
      try {
        proc.stdin?.write(request.stdinText)
        proc.stdin?.end()
      } catch {}
    }

    proc.stdout?.on('data', (chunk: Buffer) => {
      onEvent({ id, type: 'stdout', text: chunk.toString('utf8') })
    })

    proc.stderr?.on('data', (chunk: Buffer) => {
      onEvent({ id, type: 'stderr', text: chunk.toString('utf8') })
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      activeCliProcesses.delete(id)
      void recordAudit({
        type: 'cli',
        summary: `Lỗi khởi chạy CLI: ${err.message}`,
        ok: false,
      })
      onEvent({ id, type: 'error', text: err.message })
    })

    proc.on('close', (code) => {
      clearTimeout(timer)
      activeCliProcesses.delete(id)
      void recordAudit({
        type: 'cli',
        summary: `CLI Agent hoàn thành (${code === 0 ? 'Thành công' : `Mã lỗi ${code}`})`,
        ok: code === 0,
        durationMs: Date.now() - startedAt,
      })
      onEvent({ id, type: 'exit', code: code ?? 0 })
    })
  } catch (error) {
    activeCliProcesses.delete(id)
    const message = error instanceof Error ? error.message : String(error)
    onEvent({ id, type: 'error', text: message })
    onEvent({ id, type: 'exit', code: 1 })
  }

  return { id }
}
