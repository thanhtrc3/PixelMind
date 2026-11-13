/* Áp dụng cổng dev ưu tiên (Settings → Chạy & Xem trước) cho từng loại runner. */
import { createServer, Socket } from 'node:net'
import type { PackageManager } from '../../shared/types'

/** Kế hoạch cổng của một lượt chạy. */
export interface PortPlan {
  /** Cổng người dùng đặt trong Settings (null = tự động / không hợp lệ). */
  requestedPort: number | null
  /** Cổng thực sự yêu cầu dev server dùng (null = để runner tự chọn). */
  appliedPort: number | null
  /** Cổng ưu tiên bị chiếm nên đã quay về chế độ tự chọn cổng. */
  portFallback: boolean
  /** Lệnh sau khi chèn tham số cổng (nếu runner hỗ trợ cờ dòng lệnh). */
  command: string
  /** Biến môi trường cần bổ sung khi spawn tiến trình. */
  env: Record<string, string>
  /** Thông báo hệ thống ghi vào log của lượt chạy. */
  messages: string[]
}

/** Các script không phải máy chủ — không nên chèn cổng. */
const NON_SERVER_RE =
  /\b(build|test|tests|lint|format|typecheck|check|install|restore|ci|migrate|seed|codegen|generate|release|publish|pack|deploy|e2e|pub|get|clean|prune|outdated|audit)\b/

/** CLI của framework Node biết nhận `--port`. */
const NODE_PORT_FLAG_RE =
  /\b(vite|astro|nuxt|svelte-kit|react-router|remix)\b|\bnext\s+(dev|start)\b|\bng\s+serve\b|\bvue-cli-service\s+serve\b|\bwebpack-dev-server\b/

/** Chuẩn hoá `preferredPort` từ Settings: 0 / rỗng / ngoài 1..65535 → null (chế độ tự động). */
export function normalizePreferredPort(raw: unknown): number | null {
  const value = typeof raw === 'string' ? Number(raw.trim() === '' ? 0 : raw.trim()) : raw
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const port = Math.trunc(value)
  if (port < 1 || port > 65535) return null
  return port
}

/** Có nên áp dụng cổng ưu tiên cho lệnh này không (bỏ qua build/test/lint/install...). */
export function appliesToRun(script: string, command: string): boolean {
  const text = `${script} ${command}`.toLowerCase()
  return !NON_SERVER_RE.test(text)
}

function probeConnect(port: number, host: string): Promise<boolean> {
  return new Promise<boolean>((done) => {
    const socket = new Socket()
    let settled = false
    const finish = (inUse: boolean) => {
      if (settled) return
      settled = true
      socket.removeAllListeners()
      socket.destroy()
      done(inUse)
    }
    socket.setTimeout(400)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
    try {
      socket.connect(port, host)
    } catch {
      finish(false)
    }
  })
}

function probeBind(port: number): Promise<boolean> {
  return new Promise<boolean>((done) => {
    const server = createServer()
    let settled = false
    const finish = (free: boolean) => {
      if (settled) return
      settled = true
      done(free)
    }
    server.once('error', () => finish(false))
    server.once('listening', () => {
      server.close(() => finish(true))
    })
    try {
      server.listen({ port, host: '0.0.0.0', exclusive: true })
    } catch {
      finish(false)
    }
  })
}

/** Cổng còn trống để bind không? Kiểm tra cả kết nối lẫn bind thật để tránh dương tính giả trên Windows. */
export async function isPortAvailable(port: number): Promise<boolean> {
  if (!port) return false
  if (await probeConnect(port, '127.0.0.1')) return false
  if (await probeConnect(port, '::1')) return false
  return probeBind(port)
}

type PackageManagerScript = 'npm' | 'pnpm' | 'yarn' | 'bun' | null

function viaPackageManagerScript(command: string): PackageManagerScript {
  const match = command.trim().match(/^(npm|pnpm|yarn|bun)\b/i)
  if (!match) return null
  return match[1].toLowerCase() as Exclude<PackageManagerScript, null>
}

/** Ghép tham số vào lệnh: `npm/pnpm/bun` cần `--`, `yarn` chuyển thẳng cho script. */
function appendScriptArgs(command: string, manager: PackageManagerScript, args: string): string {
  if (manager === 'npm' || manager === 'pnpm' || manager === 'bun') return `${command} -- ${args}`
  return `${command} ${args}`
}

interface Injection {
  command: string
  env: Record<string, string>
  /** Runner đã nhận cổng qua cờ dòng lệnh. */
  usedFlag: boolean
  /** Ghi chú khi chỉ truyền được qua biến môi trường. */
  hint?: string
}

/** Chèn cổng vào lệnh/env theo loại runner. */
export function buildPortInjection(
  command: string,
  manager: PackageManager,
  scriptCommand: string,
  port: number,
): Injection {
  const lowerCmd = command.toLowerCase()
  const lowerTool = (scriptCommand || command).toLowerCase()
  const env: Record<string, string> = {}

  // ── .NET / ASP.NET Core ────────────────────────────────────────────────
  if (manager === 'dotnet' || /^dotnet\s/.test(lowerCmd)) {
    const urls = `http://localhost:${port}`
    env.ASPNETCORE_URLS = urls
    env.DOTNET_URLS = urls
    if (/\bdotnet\s+(watch|run)\b/.test(lowerCmd) && !/--urls\b/.test(lowerCmd)) {
      return { command: `${command} --urls ${urls}`, env, usedFlag: true }
    }
    return {
      command,
      env,
      usedFlag: false,
      hint: `Runner .NET không nhận cờ cổng ở lệnh này — đã truyền ASPNETCORE_URLS=${urls}.`,
    }
  }

  // ── Flutter (web) ──────────────────────────────────────────────────────
  if (manager === 'flutter' || /^flutter\s/.test(lowerCmd)) {
    if (/\bflutter\s+run\b/.test(lowerCmd) && !/--web-port\b/.test(lowerCmd)) {
      return { command: `${command} --web-port=${port}`, env, usedFlag: true }
    }
    return {
      command,
      env,
      usedFlag: false,
      hint: 'Lệnh Flutter này không nhận --web-port — cổng do Flutter/thiết bị tự chọn.',
    }
  }

  // ── PHP / Rails ────────────────────────────────────────────────────────
  if (/\bphp\s+artisan\s+serve\b/.test(lowerCmd)) {
    if (/--port\b/.test(lowerCmd)) return { command, env, usedFlag: true }
    return { command: `${command} --port=${port}`, env, usedFlag: true }
  }
  if (/\bphp\s+-s\s+/.test(lowerCmd)) {
    if (/\bphp\s+-s\s+[^\s:]+:\d+/.test(lowerCmd)) {
      return { command: command.replace(/(\bphp\s+-s\s+[^\s:]+:)\d+/i, `$1${port}`), env, usedFlag: true }
    }
    return { command, env, usedFlag: false, hint: 'Lệnh php -S chưa có cổng — hãy thêm dạng host:cổng vào lệnh.' }
  }
  if (/\brails\s+(server|s)\b/.test(lowerCmd)) {
    if (/\s-p\s/.test(lowerCmd)) return { command, env, usedFlag: true }
    return { command: `${command} -p ${port}`, env, usedFlag: true }
  }

  // ── Python / Django / Flask ────────────────────────────────────────────
  if (/manage\.py\s+runserver\b/.test(lowerCmd)) {
    if (/runserver\s+\S+/.test(lowerCmd)) return { command, env, usedFlag: true }
    return { command: `${command} ${port}`, env, usedFlag: true }
  }
  if (/\bflask\s+run\b/.test(lowerCmd)) {
    if (/--port\b/.test(lowerCmd)) return { command, env, usedFlag: true }
    return { command: `${command} --port ${port}`, env, usedFlag: true }
  }
  if (/\bhttp\.server\b/.test(lowerCmd)) {
    if (/\bhttp\.server\s+\d+/.test(lowerCmd)) {
      return { command: command.replace(/(\bhttp\.server\s+)\d+/, `$1${port}`), env, usedFlag: true }
    }
    return { command: `${command} ${port}`, env, usedFlag: true }
  }

  // ── Node / Vite / Next / Angular... ────────────────────────────────────
  const nodeTool = NODE_PORT_FLAG_RE.test(lowerTool) || NODE_PORT_FLAG_RE.test(lowerCmd)
  if (nodeTool) {
    if (/--port\b/.test(lowerCmd)) return { command, env, usedFlag: true }
    return {
      command: appendScriptArgs(command, viaPackageManagerScript(command), `--port ${port}`),
      env,
      usedFlag: true,
    }
  }
  if (/\bhttp-server\b/.test(`${lowerTool} ${lowerCmd}`)) {
    if (/(^|\s)-p\s+\d+/.test(lowerCmd)) return { command, env, usedFlag: true }
    return {
      command: appendScriptArgs(command, viaPackageManagerScript(command), `-p ${port}`),
      env,
      usedFlag: true,
    }
  }
  if (/\b(npx|pnpm|yarn|bunx)\s+serve\b|^serve\s/.test(lowerTool)) {
    if (/(^|\s)(-l|--listen)\s/.test(lowerCmd)) return { command, env, usedFlag: true }
    return {
      command: appendScriptArgs(command, viaPackageManagerScript(command), `-l ${port}`),
      env,
      usedFlag: true,
    }
  }

  // ── Fallback: chỉ truyền biến môi trường ───────────────────────────────
  env.PORT = String(port)
  if (manager === 'mvn' || manager === 'gradle') env.SERVER_PORT = String(port)
  return {
    command,
    env,
    usedFlag: false,
    hint: `Runner này không có cờ cổng chuẩn — đã truyền biến môi trường PORT=${port}.`,
  }
}

/** Lập kế hoạch cổng: kiểm tra hợp lệ, kiểm tra cổng bận, rồi chèn vào lệnh/env. */
export async function planPort(input: {
  preferredPort?: number | null
  manager: PackageManager
  script: string
  command: string
  /** Nội dung script gốc trong package.json để nhận diện framework (vite, next...). */
  scriptCommand?: string
}): Promise<PortPlan> {
  const requested = normalizePreferredPort(input.preferredPort)
  if (!requested) {
    return {
      requestedPort: null,
      appliedPort: null,
      portFallback: false,
      command: input.command,
      env: {},
      messages: [],
    }
  }

  if (!appliesToRun(input.script, input.command)) {
    return {
      requestedPort: requested,
      appliedPort: null,
      portFallback: false,
      command: input.command,
      env: {},
      messages: [`[system] Cổng ưu tiên ${requested} chỉ áp dụng cho lệnh chạy máy chủ — bỏ qua cho “${input.script}”.\n`],
    }
  }

  if (!(await isPortAvailable(requested))) {
    return {
      requestedPort: requested,
      appliedPort: null,
      portFallback: true,
      command: input.command,
      env: {},
      messages: [
        `[system] ⚠ Cổng ưu tiên ${requested} đang bị tiến trình khác chiếm. PixelMind không tự tắt tiến trình lạ và sẽ chạy ở chế độ tự chọn cổng trống.\n`,
        `[system] Gợi ý: dừng ứng dụng đang dùng cổng ${requested}, hoặc đổi “Cổng dev ưu tiên” trong Cài đặt → Chạy & Xem trước.\n`,
      ],
    }
  }

  const injection = buildPortInjection(input.command, input.manager, input.scriptCommand ?? '', requested)
  const messages = [
    injection.usedFlag
      ? `[system] Áp dụng cổng ưu tiên ${requested}. Nếu cổng bị chiếm ngay sau bước kiểm tra, runner có thể tự tăng cổng.\n`
      : `[system] Áp dụng cổng ưu tiên ${requested} qua biến môi trường. ${injection.hint ?? ''}\n`,
  ]
  return {
    requestedPort: requested,
    appliedPort: requested,
    portFallback: false,
    command: injection.command,
    env: injection.env,
    messages,
  }
}
