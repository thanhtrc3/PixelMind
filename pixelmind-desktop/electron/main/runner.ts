import { exec } from 'node:child_process'
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import { promises as fs } from 'node:fs'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { PackageManager, RunLog, RunState } from '../../shared/types'

/* Quản lý tiến trình chạy dev server của dự án đang mở. */

const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g
const URL_RE = /(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):(\d{2,5})/i

const MIME: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  mp4: 'video/mp4',
  webm: 'video/webm',
  txt: 'text/plain; charset=utf-8',
  map: 'application/json; charset=utf-8',
}

interface Entry {
  state: RunState
  child?: ChildProcess
  server?: Server
  buffer: string
}

type LogHandler = (log: RunLog) => void
type StateHandler = (state: RunState) => void

export class RunnerManager {
  private entries = new Map<string, Entry>()
  private staticServers = new Map<string, Entry>()

  constructor(
    private onLog: LogHandler,
    private onState: StateHandler,
  ) {}

  list(): RunState[] {
    return [...this.entries.values()].map((e) => e.state)
  }

  private emitLog(runId: string, text: string, stream: RunLog['stream']) {
    const clean = text.replace(ANSI, '').replace(/\r/g, '')
    if (!clean.trim() && stream !== 'system') return
    this.onLog({ runId, stream, text: clean, at: Date.now() })
  }

  private update(entry: Entry, patch: Partial<RunState>) {
    entry.state = { ...entry.state, ...patch }
    this.onState(entry.state)
  }

  private scanUrl(entry: Entry, text: string) {
    const clean = text.replace(ANSI, '')
    entry.buffer = `${entry.buffer}${clean}`.slice(-4000)
    const match = entry.buffer.match(URL_RE)
    if (!match) return
    const port = Number(match[3])
    if (!port) return
    const url = `http://localhost:${port}`
    if (entry.state.url !== url) {
      this.update(entry, { url })
      this.emitLog(entry.state.id, `\n[system] Đã phát hiện địa chỉ xem trước: ${url}\n`, 'system')
    }
  }

  private buildCommand(manager: PackageManager, script: string): string {
    const bin = manager === 'none' ? 'npm' : manager
    if (bin === 'bun') return `bun run ${script}`
    if (bin === 'yarn') return `yarn ${script}`
    return `${bin} run ${script}`
  }

  startScript(project: { id: string; path: string; packageManager: PackageManager }, script: string): RunState {
    const running = [...this.entries.values()].find(
      (e) => e.state.projectId === project.id && (e.state.status === 'running' || e.state.status === 'starting'),
    )
    if (running) return running.state

    const command = this.buildCommand(project.packageManager, script)
    const id = randomUUID()
    const entry: Entry = {
      buffer: '',
      state: {
        id,
        projectId: project.id,
        cwd: resolve(project.path),
        script,
        command,
        status: 'starting',
        url: null,
        exitCode: null,
        startedAt: Date.now(),
        kind: 'script',
      },
    }
    this.entries.set(id, entry)
    this.onState(entry.state)
    this.emitLog(id, `$ ${command}  (${entry.state.cwd})\n`, 'system')

    let child: ChildProcess
    try {
      child = spawn(command, {
        cwd: entry.state.cwd,
        shell: true,
        windowsHide: true,
        env: {
          ...process.env,
          FORCE_COLOR: '0',
          NO_COLOR: '1',
          BROWSER: 'none',
          CI: '0',
        },
      })
    } catch (error) {
      this.update(entry, { status: 'error' })
      this.emitLog(id, `[error] ${(error as Error).message}\n`, 'stderr')
      return entry.state
    }

    entry.child = child
    this.update(entry, { status: 'running' })

    const pipe = (stream: 'stdout' | 'stderr') => (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      this.emitLog(id, text, stream)
      this.scanUrl(entry, text)
    }

    child.stdout?.on('data', pipe('stdout'))
    child.stderr?.on('data', pipe('stderr'))
    child.on('error', (error) => {
      this.emitLog(id, `[error] ${error.message}\n`, 'stderr')
      this.update(entry, { status: 'error' })
    })
    child.on('close', (code) => {
      const stopped = entry.state.status === 'stopped'
      if (entry.state.status !== 'error') {
        this.update(entry, { status: stopped ? 'stopped' : 'exited', exitCode: code ?? null })
      }
      this.emitLog(id, `\n[system] Tiến trình kết thúc (mã ${code ?? 'n/a'}).\n`, 'system')
      entry.child = undefined
    })

    return entry.state
  }

  startInstall(project: { id: string; path: string; packageManager: PackageManager }): RunState {
    const running = [...this.entries.values()].find(
      (e) => e.state.projectId === project.id && (e.state.status === 'running' || e.state.status === 'starting'),
    )
    if (running) return running.state

    const manager = project.packageManager === 'none' ? 'npm' : project.packageManager
    const command =
      manager === 'yarn'
        ? 'yarn install'
        : manager === 'bun'
          ? 'bun install'
          : manager === 'pnpm'
            ? 'pnpm install'
            : 'npm install'

    const id = randomUUID()
    const entry: Entry = {
      buffer: '',
      state: {
        id,
        projectId: project.id,
        cwd: resolve(project.path),
        script: 'install',
        command,
        status: 'starting',
        url: null,
        exitCode: null,
        startedAt: Date.now(),
        kind: 'install',
      },
    }
    this.entries.set(id, entry)
    this.onState(entry.state)
    this.emitLog(id, `$ ${command}  (${entry.state.cwd})\n`, 'system')
    this.emitLog(id, `[system] Bắt đầu cài đặt các gói phụ thuộc...\n`, 'system')

    let child: ChildProcess
    try {
      child = spawn(command, {
        cwd: entry.state.cwd,
        shell: true,
        windowsHide: true,
        env: {
          ...process.env,
          FORCE_COLOR: '0',
          NO_COLOR: '1',
          CI: '0',
        },
      })
    } catch (error) {
      this.update(entry, { status: 'error' })
      this.emitLog(id, `[error] ${(error as Error).message}\n`, 'stderr')
      return entry.state
    }

    entry.child = child
    this.update(entry, { status: 'running' })

    const pipe = (stream: 'stdout' | 'stderr') => (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      this.emitLog(id, text, stream)
    }

    child.stdout?.on('data', pipe('stdout'))
    child.stderr?.on('data', pipe('stderr'))
    child.on('error', (error) => {
      this.emitLog(id, `[error] ${error.message}\n`, 'stderr')
      this.update(entry, { status: 'error' })
    })
    child.on('close', (code) => {
      const stopped = entry.state.status === 'stopped'
      if (entry.state.status !== 'error') {
        this.update(entry, { status: stopped ? 'stopped' : 'exited', exitCode: code ?? null })
      }
      if (code === 0) {
        this.emitLog(id, `\n[system] Cài đặt thư viện hoàn tất thành công!\n`, 'system')
      } else {
        this.emitLog(id, `\n[system] Tiến trình cài đặt kết thúc (mã ${code ?? 'n/a'}).\n`, 'system')
      }
      entry.child = undefined
    })

    return entry.state
  }

  startStatic(project: { id: string; path: string }): Promise<RunState> {
    const existing = this.staticServers.get(project.id)
    if (existing && existing.state.status === 'running') return Promise.resolve(existing.state)

    const root = resolve(project.path)
    const id = randomUUID()
    const entry: Entry = {
      buffer: '',
      state: {
        id,
        projectId: project.id,
        cwd: root,
        script: 'static',
        command: 'static-server',
        status: 'starting',
        url: null,
        exitCode: null,
        startedAt: Date.now(),
        kind: 'static',
      },
    }

    return new Promise((resolvePromise) => {
      const server = createServer(async (req, res) => {
        try {
          const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0])
          let target = normalize(join(root, urlPath))
          if (!target.startsWith(root + sep) && target !== root) {
            res.writeHead(403).end('Forbidden')
            return
          }
          let data: Buffer
          try {
            const stat = await fs.stat(target)
            if (stat.isDirectory()) target = join(target, 'index.html')
            data = await fs.readFile(target)
          } catch {
            target = join(root, 'index.html')
            data = await fs.readFile(target)
          }
          res.writeHead(200, { 'Content-Type': MIME[extname(target).slice(1).toLowerCase()] ?? 'application/octet-stream' })
          res.end(data)
        } catch {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end('<h1>404</h1><p>Không tìm thấy tệp trong thư mục dự án.</p>')
        }
      })

      server.on('error', (error) => {
        this.update(entry, { status: 'error' })
        this.emitLog(id, `[error] ${error.message}\n`, 'stderr')
        resolvePromise(entry.state)
      })

      server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        const port = typeof address === 'object' && address ? address.port : 0
        const url = `http://localhost:${port}`
        entry.server = server
        this.entries.set(id, entry)
        this.staticServers.set(project.id, entry)
        this.update(entry, { status: 'running', url })
        this.emitLog(id, `$ máy chủ tĩnh đang chạy tại ${url}\nGốc: ${root}\n`, 'system')
        resolvePromise(entry.state)
      })
    })
  }

  stop(runId: string): boolean {
    const entry = this.entries.get(runId)
    if (!entry) return false
    this.update(entry, { status: 'stopped' })

    if (entry.server) {
      entry.server.close()
      entry.server = undefined
      for (const [key, value] of this.staticServers) {
        if (value === entry) this.staticServers.delete(key)
      }
      this.emitLog(runId, '[system] Đã dừng máy chủ tĩnh.\n', 'system')
      return true
    }

    const pid = entry.child?.pid
    if (!pid) return true
    if (process.platform === 'win32') {
      exec(`taskkill /pid ${pid} /T /F`, () => undefined)
    } else {
      try {
        process.kill(-pid, 'SIGTERM')
      } catch {
        entry.child?.kill('SIGTERM')
      }
    }
    this.emitLog(runId, '[system] Đã gửi yêu cầu dừng tiến trình.\n', 'system')
    return true
  }

  stopAll(): void {
    for (const entry of this.entries.values()) {
      this.stop(entry.state.id)
    }
  }

  /** Trả về trạng thái đang chạy của một dự án (nếu có). */
  stateOfProject(projectId: string): RunState | null {
    const list = [...this.entries.values()].filter(
      (e) => e.state.projectId === projectId && (e.state.status === 'running' || e.state.status === 'starting'),
    )
    return list.length ? list[list.length - 1].state : null
  }
}
