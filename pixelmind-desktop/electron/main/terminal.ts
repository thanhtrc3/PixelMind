import { execSync, spawn } from 'node:child_process'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { basename } from 'node:path'
import type { IPty } from 'node-pty'
import type {
  TerminalCreateOptions,
  TerminalDataEvent,
  TerminalExitEvent,
  TerminalSession,
  TerminalShell,
} from '../../shared/types'

/* Quản lý phiên Terminal tương tác thật (PTY / ConPTY) cho LogPanel. */

const require = createRequire(import.meta.url)

interface PtyModule {
  spawn: (
    file: string,
    args: string[] | string,
    options: {
      name?: string
      cols?: number
      rows?: number
      cwd?: string
      env?: Record<string, string>
      useConpty?: boolean
    },
  ) => IPty
}

interface SessionEntry {
  session: TerminalSession
  pty?: IPty
  child?: ChildProcessWithoutNullStreams
  disposed: boolean
}

type DataHandler = (event: TerminalDataEvent) => void
type ExitHandler = (event: TerminalExitEvent) => void

function loadNodePty(): PtyModule | null {
  try {
    return require('node-pty') as PtyModule
  } catch {
    return null
  }
}

function commandExistsWin(bin: string): boolean {
  try {
    execSync(`where.exe ${bin}`, { stdio: 'ignore', timeout: 1500 })
    return true
  } catch {
    return false
  }
}

function resolveShell(preferred: TerminalShell = 'auto'): { file: string; args: string[]; label: string } {
  if (process.platform === 'win32') {
    if (preferred === 'cmd') {
      return { file: process.env.ComSpec || 'cmd.exe', args: [], label: 'Command Prompt' }
    }
    if (preferred === 'pwsh') {
      if (commandExistsWin('pwsh.exe')) {
        return { file: 'pwsh.exe', args: ['-NoLogo'], label: 'PowerShell 7' }
      }
      return { file: 'powershell.exe', args: ['-NoLogo'], label: 'PowerShell' }
    }
    if (preferred === 'bash') {
      const gitBashCandidates = [
        'C:\\Program Files\\Git\\bin\\bash.exe',
        'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
      ]
      const found = gitBashCandidates.find((p) => existsSync(p))
      if (found) return { file: found, args: ['--login', '-i'], label: 'Git Bash' }
      if (commandExistsWin('bash.exe')) return { file: 'bash.exe', args: ['--login', '-i'], label: 'Bash' }
      return { file: 'powershell.exe', args: ['-NoLogo'], label: 'PowerShell' }
    }
    return { file: 'powershell.exe', args: ['-NoLogo'], label: 'PowerShell' }
  }

  if (preferred === 'bash') {
    return { file: '/bin/bash', args: ['-i'], label: 'bash' }
  }
  const userShell = process.env.SHELL || '/bin/bash'
  return { file: userShell, args: ['-i'], label: basename(userShell) }
}

function resolveCwd(rawCwd?: string): string {
  if (rawCwd && rawCwd.trim()) {
    try {
      if (existsSync(rawCwd) && statSync(rawCwd).isDirectory()) {
        return rawCwd
      }
    } catch {
      // Rơi xuống thư mục home nếu đường dẫn không hợp lệ
    }
  }
  return homedir()
}

function buildTerminalEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v !== 'string') continue
    if (k === 'ELECTRON_RUN_AS_NODE' || k === 'ELECTRON_NO_ATTACH_CONSOLE') continue
    env[k] = v
  }
  env.TERM = 'xterm-256color'
  env.COLORTERM = 'truecolor'
  env.FORCE_COLOR = '1'
  return env
}

export class TerminalManager {
  private sessions = new Map<string, SessionEntry>()
  private sequence = 0

  constructor(
    private onData: DataHandler,
    private onExit: ExitHandler,
  ) {}

  list(): TerminalSession[] {
    return [...this.sessions.values()].map((entry) => entry.session)
  }

  create(options: TerminalCreateOptions = {}): TerminalSession {
    this.sequence += 1
    const id = `term-${randomUUID()}`
    const cols = Math.max(20, Math.min(400, Math.floor(options.cols ?? 96)))
    const rows = Math.max(5, Math.min(120, Math.floor(options.rows ?? 18)))
    const cwd = resolveCwd(options.cwd)
    const { file, args, label } = resolveShell(options.shell ?? 'auto')
    const title = options.title?.trim() || `${label} #${this.sequence}`
    const env = buildTerminalEnv()

    const nodePty = loadNodePty()
    if (nodePty) {
      try {
        const ptyProc = nodePty.spawn(file, args, {
          name: 'xterm-256color',
          cols,
          rows,
          cwd,
          env,
        })

        const session: TerminalSession = {
          id,
          projectId: options.projectId,
          title,
          shell: label,
          cwd,
          pid: ptyProc.pid,
          cols,
          rows,
          backend: 'pty',
          startedAt: Date.now(),
        }

        const entry: SessionEntry = { session, pty: ptyProc, disposed: false }
        this.sessions.set(id, entry)

        ptyProc.onData((data) => {
          if (entry.disposed) return
          this.onData({ sessionId: id, data })
        })

        ptyProc.onExit(({ exitCode, signal }) => {
          if (entry.disposed) return
          entry.disposed = true
          this.sessions.delete(id)
          this.onExit({ sessionId: id, exitCode, signal })
        })

        return session
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        // Dự phòng tự động sang pipe nếu ConPTY không khởi tạo được
        this.onData({
          sessionId: id,
          data: `\x1b[33m[PixelMind] Không khởi tạo được PTY (${message}), chuyển sang chế độ shell pipe.\x1b[0m\r\n`,
        })
      }
    }

    // Chế độ dự phòng bằng child_process pipe (vẫn chạy được các lệnh shell)
    const child = spawn(file, args, { cwd, env, stdio: 'pipe' })
    const session: TerminalSession = {
      id,
      projectId: options.projectId,
      title,
      shell: label,
      cwd,
      pid: child.pid ?? 0,
      cols,
      rows,
      backend: 'pipe',
      startedAt: Date.now(),
    }
    const entry: SessionEntry = { session, child, disposed: false }
    this.sessions.set(id, entry)

    const emitChunk = (chunk: Buffer) => {
      if (entry.disposed) return
      const text = chunk.toString('utf8').replace(/\r?\n/g, '\r\n')
      this.onData({ sessionId: id, data: text })
    }

    child.stdout.on('data', emitChunk)
    child.stderr.on('data', emitChunk)
    child.on('exit', (code) => {
      if (entry.disposed) return
      entry.disposed = true
      this.sessions.delete(id)
      this.onExit({ sessionId: id, exitCode: code ?? 0 })
    })

    return session
  }

  write(sessionId: string, data: string): boolean {
    const entry = this.sessions.get(sessionId)
    if (!entry || entry.disposed) return false
    if (entry.pty) {
      entry.pty.write(data)
      return true
    }
    if (entry.child && !entry.child.stdin.destroyed) {
      // Với pipe thuần: chuẩn hoá CR -> LF để shell xử lý Enter
      const normalized = data === '\r' ? '\n' : data.replace(/\r/g, '\n')
      if (data === '\x03') {
        entry.child.kill('SIGINT')
      } else {
        entry.child.stdin.write(normalized)
      }
      return true
    }
    return false
  }

  resize(sessionId: string, cols: number, rows: number): boolean {
    const entry = this.sessions.get(sessionId)
    if (!entry || entry.disposed) return false
    const safeCols = Math.max(10, Math.min(400, Math.floor(cols)))
    const safeRows = Math.max(2, Math.min(120, Math.floor(rows)))
    entry.session.cols = safeCols
    entry.session.rows = safeRows
    if (entry.pty) {
      try {
        entry.pty.resize(safeCols, safeRows)
        return true
      } catch {
        return false
      }
    }
    return true
  }

  kill(sessionId: string): boolean {
    const entry = this.sessions.get(sessionId)
    if (!entry) return false
    entry.disposed = true
    this.sessions.delete(sessionId)

    const pid = entry.session.pid
    try {
      entry.pty?.kill()
    } catch {}
    try {
      entry.child?.kill('SIGKILL')
    } catch {}

    if (process.platform === 'win32' && pid > 0) {
      try {
        execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' })
      } catch {}
    }
    return true
  }

  killAll(): void {
    for (const id of [...this.sessions.keys()]) {
      this.kill(id)
    }
  }
}

