import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { basename } from 'node:path'
import { randomUUID } from 'node:crypto'
import { promisify } from 'node:util'
import type { AiCliEvent, AiCliRunRequest, DetectedCli } from '../../shared/ai'
import { recordAudit } from './aiAudit'

const execFileAsync = promisify(execFile)

const ALLOWED_BINARIES = new Set([
  'opencode',
  'agy',
  'claude',
  'aider',
  'ollama',
  'gemini',
  'dotnet',
  'npm',
  'node',
  'git',
  'gh',
  'python',
])

const activeCliProcesses = new Map<string, { proc: ChildProcess; timer?: NodeJS.Timeout }>()

export function isBinaryAllowed(binary: string): boolean {
  const base = basename(binary).toLowerCase().replace(/\.(exe|cmd|bat|sh)$/i, '')
  return ALLOWED_BINARIES.has(base)
}

export function runCliAgent(
  request: AiCliRunRequest,
  onEvent: (event: AiCliEvent) => void,
): { id: string } {
  const id = request.id || `cli-${Date.now().toString(36)}-${randomUUID().slice(0, 5)}`

  if (!isBinaryAllowed(request.binary)) {
    const errorMsg = `Lệnh thực thi không hợp lệ: "${request.binary}". Chỉ cho phép: ${[...ALLOWED_BINARIES].join(', ')}`
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

  const timeoutMs = request.timeoutMs ?? 120_000
  const startedAt = Date.now()

  try {
    // spawn an toàn: truyền mảng args, KHÔNG dùng shell: true để chống argument/command injection
    const proc = spawn(request.binary, request.args, {
      cwd: request.projectPath,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    })

    const timer = setTimeout(() => {
      stopCliAgent(id)
      onEvent({ id, type: 'error', text: `CLI vượt quá thời gian tối đa (${timeoutMs / 1000}s), đã tự động dừng.` })
    }, timeoutMs)

    activeCliProcesses.set(id, { proc, timer })

    void recordAudit({
      type: 'cli',
      summary: `Chạy CLI Agent: ${request.binary} ${request.args.slice(0, 3).join(' ')}`,
      ok: true,
      detail: `PID: ${proc.pid}, CWD: ${request.projectPath}`,
    })

    proc.stdout.on('data', (chunk: Buffer) => {
      onEvent({ id, type: 'stdout', text: chunk.toString('utf8') })
    })

    proc.stderr.on('data', (chunk: Buffer) => {
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
      const durationMs = Date.now() - startedAt
      void recordAudit({
        type: 'cli',
        summary: `CLI Agent hoàn thành (${code === 0 ? 'Thành công' : `Mã lỗi ${code}`})`,
        ok: code === 0,
        durationMs,
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

export function stopCliAgent(id: string): boolean {
  const item = activeCliProcesses.get(id)
  if (!item) return false

  if (item.timer) clearTimeout(item.timer)

  try {
    const pid = item.proc.pid
    if (pid) {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(pid), '/f', '/t'], { shell: false })
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

export async function detectInstalledClis(): Promise<DetectedCli[]> {
  const candidates = [
    { binary: 'agy', name: 'Antigravity CLI (agy)', description: 'Google Antigravity Agent CLI' },
    { binary: 'claude', name: 'Claude Code', description: 'Anthropic Claude Code CLI' },
    { binary: 'opencode', name: 'OpenCode', description: 'OpenCode Terminal Agent' },
    { binary: 'aider', name: 'Aider', description: 'AI Pair Programming CLI' },
    { binary: 'ollama', name: 'Ollama', description: 'Local LLM Runner CLI' },
    { binary: 'dotnet', name: '.NET SDK', description: 'ASP.NET Core & C# Compiler' },
    { binary: 'node', name: 'Node.js', description: 'JavaScript / TypeScript Runtime' },
    { binary: 'git', name: 'Git', description: 'Version Control System' },
  ]

  const lookupCmd = process.platform === 'win32' ? 'where.exe' : 'which'

  const results: DetectedCli[] = await Promise.all(
    candidates.map(async (item) => {
      try {
        const { stdout } = await execFileAsync(lookupCmd, [item.binary], { timeout: 1500 })
        const resolvedPath = stdout.trim().split(/\r?\n/)[0]
        return {
          binary: item.binary,
          name: item.name,
          path: resolvedPath,
          installed: Boolean(resolvedPath),
          description: item.description,
        }
      } catch {
        return {
          binary: item.binary,
          name: item.name,
          installed: false,
          description: item.description,
        }
      }
    }),
  )

  return results
}

