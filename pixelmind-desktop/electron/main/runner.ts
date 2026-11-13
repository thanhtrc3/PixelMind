import { execSync } from 'node:child_process'
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import { promises as fs } from 'node:fs'
import { Socket } from 'node:net'
import { extname, join, normalize, resolve, sep, basename } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { PackageManager, RunLog, RunState } from '../../shared/types'
import { isPortAvailable, normalizePreferredPort, planPort } from './runnerPorts'

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

/** Quét netstat và cưỡng chế tắt bất kỳ tiến trình nào đang chiếm cổng mạng (ngăn lỗi EADDRINUSE) */
export function killPort(port: number): void {
  if (!port || port <= 0) return
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano -p tcp`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      const pids = new Set<string>()
      for (const line of out.split('\n')) {
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 5 && parts[0] === 'TCP') {
          const addr = parts[1]
          const state = parts[3]
          const pid = parts[4]
          if (state === 'LISTENING' && addr.endsWith(':' + port)) {
            if (pid && pid !== '0' && pid !== String(process.pid)) {
              pids.add(pid)
            }
          }
        }
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' })
        } catch {}
      }
    } else {
      try {
        execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'ignore' })
      } catch {}
    }
  } catch {}
}

/** Quét và cưỡng chế tắt bất kỳ tiến trình binary nào (.exe trong bin/obj của dự án hoặc dotnet watch rò rỉ cùng dự án) đang bị kẹt gây khoá file / xung đột build. */
export function killProjectBinaries(projectPath: string): void {
  if (!projectPath || process.platform !== 'win32') return
  try {
    const escaped = resolve(projectPath).replace(/'/g, "''")
    const projName = basename(resolve(projectPath)).replace(/'/g, "''")
    const psCmd = [
      `Get-CimInstance Win32_Process | Where-Object {`,
      `  ($_.ExecutablePath -and $_.ExecutablePath -like '${escaped}*') -or`,
      `  ($_.Name -eq 'dotnet.exe' -and $_.CommandLine -and (`,
      `    $_.CommandLine -like '*${escaped}*' -or`,
      projName ? `    ($_.CommandLine -like '*watch*' -and $_.CommandLine -like '*${projName}*')` : '    $false',
      `  ))`,
      `} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
    ].join(' ')
    execSync(`powershell -NoProfile -Command "${psCmd}"`, { stdio: 'ignore', timeout: 4000 })
  } catch {}
}

/** Chuẩn hoá lệnh `dotnet watch`: dùng `--non-interactive` để bật Hot Reload mượt, tránh giật dừng máy chủ khi lưu `.cshtml`/`.cs`. */
function normalizeDotnetCommand(cmd: string): string {
  if (!/\bdotnet\b/i.test(cmd)) return cmd
  let out = cmd
  if (/\bwatch\b/i.test(out)) {
    out = out.replace(/\s+--no-hot-reload\b/gi, '')
    if (!/--non-interactive\b/i.test(out)) {
      out = out.replace(/\bwatch\b/i, 'watch --non-interactive')
    }
  }
  if ((/\brun\b/i.test(out) || /\bwatch\b/i.test(out)) && !/--no-launch-browser\b/i.test(out)) {
    out = `${out} --no-launch-browser`
  }
  return out.replace(/\s+/g, ' ').trim()
}
interface Entry {
  state: RunState
  child?: ChildProcess
  server?: Server
  buffer: string
  isCheckingUrl?: boolean
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

  private async checkHostPort(port: number, host: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const socket = new Socket()
      socket.setTimeout(350)
      socket.once('connect', () => {
        socket.destroy()
        resolve(true)
      })
      socket.once('error', () => {
        socket.destroy()
        resolve(false)
      })
      socket.once('timeout', () => {
        socket.destroy()
        resolve(false)
      })
      socket.connect(port, host)
    })
  }

  private async waitForPort(port: number, timeoutMs = 15000): Promise<boolean> {
    const start = Date.now()
    const hosts = ['127.0.0.1', 'localhost', '::1']
    while (Date.now() - start < timeoutMs) {
      for (const host of hosts) {
        const ok = await this.checkHostPort(port, host)
        if (ok) {
          // Socket đã mở, chờ thêm một chút (400ms) để Kestrel / Dev Server sẵn sàng tiếp nhận HTTP
          const { promise: delayPromise, resolve: delayResolve } = Promise.withResolvers<void>()
          setTimeout(delayResolve, 400)
          await delayPromise
          return true
        }
      }
      const { promise: delayPromise, resolve: delayResolve } = Promise.withResolvers<void>()
      setTimeout(delayResolve, 250)
      await delayPromise
    }
    return false
  }

  private async scanUrl(entry: Entry, text: string) {
    const clean = text.replace(ANSI, '')
    entry.buffer = `${entry.buffer}${clean}`.slice(-4000)
    const match = entry.buffer.match(URL_RE)
    if (!match) return
    const port = Number(match[3])
    if (!port) return
    const url = `http://localhost:${port}`

    // Ngăn chặn việc chạy kiểm tra trùng lặp khi nhiều dòng stdout cùng ghi URL
    if (entry.state.url === url || entry.isCheckingUrl) return

    entry.isCheckingUrl = true
    try {
      const ready = await this.waitForPort(port, 15000)
      if (entry.state.url !== url && (entry.state.status === 'running' || entry.state.status === 'starting')) {
        this.update(entry, { url })
        if (ready) {
          this.emitLog(entry.state.id, `\n[system] Máy chủ phát triển đã sẵn sàng: ${url}\n`, 'system')
        } else {
          this.emitLog(entry.state.id, `\n[system] Đã phát hiện địa chỉ xem trước: ${url}\n`, 'system')
        }
      }
    } finally {
      entry.isCheckingUrl = false
    }
  }

  private buildCommand(manager: PackageManager, script: string, matchedCommand?: string): string {
    if (matchedCommand) {
      if (manager === 'dotnet') {
        return normalizeDotnetCommand(matchedCommand)
      }
      return matchedCommand
    }
    if (manager === 'dotnet') {
      if (script === 'watch' || script === 'dev') return 'dotnet watch --non-interactive --no-launch-browser run'
      if (script === 'run' || script === 'start') return 'dotnet run --no-launch-browser'
      if (script === 'build') return 'dotnet build'
      if (script === 'test') return 'dotnet test'
      if (script.startsWith('dotnet ')) {
        return normalizeDotnetCommand(script)
      }
      return normalizeDotnetCommand(`dotnet ${script}`)
    }
    if (manager === 'flutter') {
      if (script === 'dev' || script === 'watch') return 'flutter run -d chrome'
      if (script === 'run' || script === 'start') return 'flutter run'
      if (script === 'build') return 'flutter build web'
      if (script === 'test') return 'flutter test'
      if (script === 'pub-get') return 'flutter pub get'
      return script.startsWith('flutter ') ? script : `flutter ${script}`
    }
    if (manager === 'python' || manager === 'pip') return matchedCommand || script
    if (manager === 'composer') return matchedCommand || `composer ${script}`
    if (manager === 'cargo') return matchedCommand || `cargo ${script}`
    if (manager === 'go') return matchedCommand || `go ${script}`
    const bin = manager === 'none' ? 'npm' : manager
    if (bin === 'bun') return `bun run ${script}`
    if (bin === 'yarn') return `yarn ${script}`
    return `${bin} run ${script}`
  }

  startScript(
    project: { id: string; path: string; packageManager: PackageManager; scripts?: import('../../shared/types').ScriptEntry[] },
    script: string,
    directCommand?: string,
    options?: { preferredPort?: number | null },
  ): Promise<RunState> {
    const running = this.runningOf(project.id)
    if (running) return Promise.resolve(running)

    const matchedCommand = directCommand?.trim() || project.scripts?.find((s) => s.name === script)?.command
    return this.launch(project, {
      script,
      command: this.buildCommand(project.packageManager, script, matchedCommand),
      kind: 'script',
      port: {
        preferredPort: options?.preferredPort,
        manager: project.packageManager,
        scriptCommand: matchedCommand,
      },
    })
  }

  /** Cài đặt thư viện của dự án bằng package manager hiện có. */
  startInstall(project: { id: string; path: string; packageManager: PackageManager }): Promise<RunState> {
    const running = this.runningOf(project.id)
    if (running) return Promise.resolve(running)

    const manager = project.packageManager === 'none' ? 'npm' : project.packageManager
    let command = 'npm install'
    let note = '[system] Bắt đầu cài đặt các gói phụ thuộc...\n'

    if (manager === 'dotnet') {
      command = 'dotnet restore'
      note = '[system] Đang khôi phục các gói thư viện NuGet cho giải pháp...\n'
    } else if (manager === 'flutter') {
      command = 'flutter pub get'
      note = '[system] Đang tải các gói phụ thuộc Flutter (flutter pub get)...\n'
    } else if (manager === 'yarn') {
      command = 'yarn install'
    } else if (manager === 'bun') {
      command = 'bun install'
    } else if (manager === 'pnpm') {
      command = 'pnpm install'
    } else if (manager === 'composer') {
      command = 'composer install'
      note = '[system] Đang cài đặt thư viện PHP Composer...\n'
    } else if (manager === 'pip' || manager === 'python') {
      command = 'pip install -r requirements.txt'
      note = '[system] Đang cài đặt thư viện Python (pip)...\n'
    } else if (manager === 'mvn') {
      command = 'mvn clean install'
      note = '[system] Đang tải thư viện Maven cho Java/Spring...\n'
    } else if (manager === 'gradle') {
      command = process.platform === 'win32' ? 'gradlew.bat build' : './gradlew build'
      note = '[system] Đang build và nạp thư viện Gradle...\n'
    }

    return this.launch(project, {
      script: 'install',
      command,
      kind: 'install',
      note,
    })
  }

  /** Chạy một lệnh tuỳ ý trong thư mục dự án (dùng cho dự án không có script). */
  startCommand(
    project: { id: string; path: string; packageManager?: PackageManager },
    command: string,
    options?: { preferredPort?: number | null },
  ): Promise<RunState> {
    const running = this.runningOf(project.id)
    if (running) return Promise.resolve(running)

    const finalCommand = /\bdotnet\b/i.test(command) ? normalizeDotnetCommand(command) : command

    return this.launch(project, {
      script: 'tuỳ chỉnh',
      command: finalCommand,
      kind: 'command',
      port: {
        preferredPort: options?.preferredPort,
        manager: project.packageManager ?? 'none',
        scriptCommand: finalCommand,
      },
    })
  }

  private runningOf(projectId: string): RunState | null {
    const entry = [...this.entries.values()].find(
      (e) => e.state.projectId === projectId && (e.state.status === 'running' || e.state.status === 'starting'),
    )
    return entry?.state ?? null
  }

  private async launch(
    project: { id: string; path: string },
    options: {
      script: string
      command: string
      kind: RunState['kind']
      note?: string
      /** Cấu hình cổng ưu tiên (Settings) — bỏ trống với lệnh cài đặt. */
      port?: { preferredPort?: number | null; manager: PackageManager; scriptCommand?: string }
    },
  ): Promise<RunState> {
    // Dọn dẹp dứt điểm toàn bộ tiến trình cũ đang chạy của dự án này (nếu có)
    this.stopOfProject(project.id)
    killProjectBinaries(project.path)

    const plan = options.port
      ? await planPort({
          preferredPort: options.port.preferredPort,
          manager: options.port.manager,
          script: options.script,
          command: options.command,
          scriptCommand: options.port.scriptCommand,
        })
      : {
          command: options.command,
          env: {} as Record<string, string>,
          requestedPort: null as number | null,
          appliedPort: null as number | null,
          portFallback: false,
          messages: [] as string[],
        }
    const command = plan.command

    const id = randomUUID()
    const entry: Entry = {
      buffer: '',
      state: {
        id,
        projectId: project.id,
        cwd: resolve(project.path),
        script: options.script,
        command,
        status: 'starting',
        url: null,
        exitCode: null,
        startedAt: Date.now(),
        kind: options.kind,
        requestedPort: plan.requestedPort,
        appliedPort: plan.appliedPort,
        portFallback: plan.portFallback,
      },
    }
    this.entries.set(id, entry)
    this.onState(entry.state)
    this.emitLog(id, `$ ${command}  (${entry.state.cwd})\n`, 'system')
    if (options.note) this.emitLog(id, options.note, 'system')
    for (const message of plan.messages) this.emitLog(id, message, 'system')

    // .NET: dừng bản app cũ còn sót lại để tránh lỗi khoá file .exe khi build lại
    if (process.platform === 'win32' && /\bdotnet\b/i.test(command)) {
      const exeName = basename(entry.state.cwd)
      if (exeName) {
        try {
          execSync(`taskkill /IM "${exeName}.exe" /T /F`, { stdio: 'ignore' })
          this.emitLog(id, `[system] Đã dừng tiến trình ${exeName}.exe cũ (nếu có) để tránh khoá tệp build.\n`, 'system')
        } catch {
          // Không có tiến trình cũ — bỏ qua
        }
      }
    }

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
          DOTNET_WATCH_SUPPRESS_LAUNCH_BROWSER: '1',
          DOTNET_LAUNCH_BROWSER: 'false',
          CI: '0',
          ...plan.env,
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
      if (options.kind === 'install') {
        this.emitLog(
          id,
          code === 0
            ? '\n[system] Cài đặt thư viện hoàn tất thành công!\n'
            : `\n[system] Tiến trình cài đặt kết thúc (mã ${code ?? 'n/a'}).\n`,
          'system',
        )
      } else {
        this.emitLog(id, `\n[system] Tiến trình kết thúc (mã ${code ?? 'n/a'}).\n`, 'system')
      }
      entry.child = undefined
    })

    return entry.state
  }

  async startStatic(
    project: { id: string; path: string; previewDir?: string },
    options?: { preferredPort?: number | null },
  ): Promise<RunState> {
    const existing = this.staticServers.get(project.id)
    if (existing && existing.state.status === 'running') return existing.state

    const requested = normalizePreferredPort(options?.preferredPort)
    let listenPort = 0
    let portFallback = false
    if (requested) {
      if (await isPortAvailable(requested)) listenPort = requested
      else portFallback = true
    }

    const root = resolve(project.path, project.previewDir ?? '')
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
        requestedPort: requested,
        appliedPort: listenPort || null,
        portFallback,
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

      server.listen(listenPort, '127.0.0.1', () => {
        const address = server.address()
        const port = typeof address === 'object' && address ? address.port : 0
        const url = `http://localhost:${port}`
        entry.server = server
        this.entries.set(id, entry)
        this.staticServers.set(project.id, entry)
        this.update(entry, { status: 'running', url, appliedPort: requested && !portFallback ? port : null })
        if (requested && !portFallback) {
          this.emitLog(id, `[system] Áp dụng cổng ưu tiên ${port} cho máy chủ tĩnh.\n`, 'system')
        } else if (portFallback) {
          this.emitLog(
            id,
            `[system] ⚠ Cổng ưu tiên ${requested} đang bị tiến trình khác chiếm — đã chuyển sang cổng trống ${port}.\n`,
            'system',
          )
        }
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
    if (pid) {
      if (process.platform === 'win32') {
        try {
          execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' })
        } catch {
          try {
            entry.child?.kill('SIGKILL')
          } catch {}
        }
        // Dừng tiến trình file exe của dự án nếu còn chạy nền (tránh khoá file build)
        const exeName = basename(entry.state.cwd)
        if (exeName) {
          try {
            execSync(`taskkill /IM "${exeName}.exe" /T /F`, { stdio: 'ignore' })
          } catch {}
        }
      } else {
        try {
          process.kill(-pid, 'SIGKILL')
        } catch {
          entry.child?.kill('SIGKILL')
        }
      }
    }

    // Giải phóng triệt để cổng mạng đang được dev server lắng nghe (ngăn lỗi chiếm cổng khi mở lại)
    let portToKill: number | null = null
    if (entry.state.url) {
      const match = entry.state.url.match(/:(\d{2,5})/)
      if (match) {
        portToKill = parseInt(match[1], 10)
      }
    } else if (entry.buffer) {
      const match = entry.buffer.match(URL_RE)
      if (match && match[3]) {
        portToKill = parseInt(match[3], 10)
      }
    }
    if (portToKill) killPort(portToKill)
    if (entry.state.cwd) killProjectBinaries(entry.state.cwd)

    this.emitLog(runId, '[system] Đã dừng tiến trình và giải phóng cổng mạng thành công.\n', 'system')
    return true
  }

  /** Dừng toàn bộ tiến trình đang chạy của một dự án cụ thể */
  stopOfProject(projectId: string): void {
    for (const entry of this.entries.values()) {
      if (entry.state.projectId === projectId) {
        if (entry.state.status === 'running' || entry.state.status === 'starting') {
          this.stop(entry.state.id)
        }
        if (process.platform === 'win32' && entry.state.cwd) {
          killProjectBinaries(entry.state.cwd)
          const exeName = basename(entry.state.cwd)
          if (exeName) {
            try {
              execSync(`taskkill /IM "${exeName}.exe" /T /F`, { stdio: 'ignore' })
            } catch {}
          }
        }
      }
    }
  }

  stopAll(): void {
    for (const entry of this.entries.values()) {
      if (entry.state.status === 'running' || entry.state.status === 'starting') {
        this.stop(entry.state.id)
      }
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
