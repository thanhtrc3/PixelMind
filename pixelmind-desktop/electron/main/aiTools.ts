import { app } from 'electron'
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  AiToolCallRequest,
  AiToolLogEntry,
  AiToolName,
  AiToolResult,
  AiToolSchema,
} from '../../shared/ai'
import { isBlockedPath, isTextFile, readTextFileSafe, resolveProjectPath, toPosix } from './aiSafe'
import { proposeChange } from './aiApply'

/* Tool Layer tối thiểu. AI chỉ được gọi đúng các tool trong danh sách này,
   mọi lần gọi đều đi qua kiểm tra đường dẫn và ghi audit log. */

const safeId = (value?: string): string => (value || '_global').replace(/[^a-zA-Z0-9._-]/g, '_')
const toolLogPath = (projectId?: string): string =>
  join(app.getPath('userData'), 'pixelmind-ai', safeId(projectId), 'tools.jsonl')

const MAX_READ_BYTES = 256 * 1024
const MAX_SEARCH_FILES = 2500
const MAX_SEARCH_RESULTS = 80
const BUILD_TIMEOUT_MS = 180_000

export const TOOL_SCHEMAS: AiToolSchema[] = [
  {
    name: 'read_file',
    description: 'Đọc nội dung một tệp văn bản trong dự án (đường dẫn tương đối).',
    risk: 'read',
    requiresApproval: false,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Đường dẫn tương đối trong dự án' },
        startLine: { type: 'number', description: 'Dòng bắt đầu (1-based, tuỳ chọn)' },
        endLine: { type: 'number', description: 'Dòng kết thúc (1-based, tuỳ chọn)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_project',
    description: 'Tìm chuỗi trong các tệp văn bản của dự án.',
    risk: 'read',
    requiresApproval: false,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Chuỗi cần tìm' },
        maxResults: { type: 'number', description: 'Số kết quả tối đa (mặc định 40)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'apply_patch',
    description:
      'Đề xuất thay đổi nội dung tệp. Không ghi ngay — tạo diff chờ người dùng duyệt trong tab Thay đổi.',
    risk: 'write',
    requiresApproval: true,
    parameters: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'Đường dẫn tương đối của tệp' },
        summary: { type: 'string', description: 'Mô tả ngắn gọn thay đổi' },
        content: { type: 'string', description: 'Nội dung mới toàn bộ tệp (nếu thay thế toàn bộ)' },
        edits: {
          type: 'array',
          description: 'Danh sách phép thay thế chính xác',
          items: {
            type: 'object',
            properties: {
              find: { type: 'string' },
              replace: { type: 'string' },
              all: { type: 'boolean' },
            },
            required: ['find', 'replace'],
          },
        },
      },
      required: ['file'],
    },
  },
  {
    name: 'run_build',
    description: 'Chạy lệnh build đã được allowlist theo loại dự án (npm build hoặc dotnet build).',
    risk: 'exec',
    requiresApproval: true,
    parameters: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Đường dẫn dự án (mặc định dự án hiện tại)' },
      },
    },
  },
  {
    name: 'sync_nav',
    description: 'Đổi đích một liên kết điều hướng trong tệp (href="from" → href="to"), tạo diff chờ duyệt.',
    risk: 'write',
    requiresApproval: true,
    parameters: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'Tệp chứa liên kết' },
        fromRoute: { type: 'string', description: 'Đích hiện tại, ví dụ /Account' },
        toRoute: { type: 'string', description: 'Đích mới, ví dụ /Home/Profile' },
      },
      required: ['file', 'fromRoute', 'toRoute'],
    },
  },
]

const findTool = (name: string): AiToolSchema | undefined => TOOL_SCHEMAS.find((tool) => tool.name === name)

const summarizeArgs = (args: Record<string, unknown>): string => {
  const json = JSON.stringify(args)
  return json.length > 600 ? `${json.slice(0, 600)}…` : json
}

export async function logToolCall(entry: AiToolLogEntry): Promise<void> {
  try {
    const file = toolLogPath(entry.projectId)
    await fs.mkdir(join(app.getPath('userData'), 'pixelmind-ai', safeId(entry.projectId)), { recursive: true })
    await fs.appendFile(file, `${JSON.stringify(entry)}\n`, 'utf8')
  } catch {
    // Audit log lỗi không được làm hỏng thao tác chính.
  }
}

export async function listToolLogs(projectId?: string): Promise<AiToolLogEntry[]> {
  try {
    const text = await fs.readFile(toolLogPath(projectId), 'utf8')
    return text
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AiToolLogEntry)
      .slice(-100)
      .reverse()
  } catch {
    return []
  }
}

/* ───────────────────────── Tool implementations ───────────────────────── */

const runReadFile = async (
  root: string,
  args: Record<string, unknown>,
): Promise<AiToolResult> => {
  const relPath = String(args.path ?? '').trim()
  if (!relPath) return { ok: false, tool: 'read_file', error: 'Thiếu tham số path.' }
  const { text, truncated, rel } = await readTextFileSafe(root, relPath, MAX_READ_BYTES)
  const lines = text.split(/\r?\n/)
  const start = Math.max(1, Number(args.startLine ?? 1))
  const end = Math.min(lines.length, Number(args.endLine ?? lines.length))
  const slice = lines.slice(start - 1, end)
  return {
    ok: true,
    tool: 'read_file',
    output: slice.map((line, index) => `${start + index}: ${line}`).join('\n'),
    data: { file: rel, startLine: start, endLine: end, totalLines: lines.length, truncated },
  }
}

const walkFiles = async (
  root: string,
  dir: string,
  budget: { left: number },
  out: string[],
): Promise<void> => {
  if (budget.left <= 0) return
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (budget.left <= 0) return
    const full = join(dir, entry.name)
    const rel = toPosix(full.slice(resolve(root).length + 1))
    if (isBlockedPath(rel)) continue
    if (entry.isDirectory()) {
      if (entry.name === '.pixelmind' || entry.name.startsWith('.')) continue
      await walkFiles(root, full, budget, out)
    } else if (entry.isFile()) {
      budget.left -= 1
      if (isTextFile(entry.name)) out.push(rel)
    }
  }
}

const runSearch = async (
  root: string,
  args: Record<string, unknown>,
): Promise<AiToolResult> => {
  const query = String(args.query ?? '')
  if (!query.trim()) return { ok: false, tool: 'search_project', error: 'Thiếu tham số query.' }
  const maxResults = Math.min(MAX_SEARCH_RESULTS, Math.max(1, Number(args.maxResults ?? 40)))
  const files: string[] = []
  await walkFiles(root, root, { left: MAX_SEARCH_FILES }, files)

  const lowered = query.toLowerCase()
  const results: string[] = []
  for (const rel of files) {
    if (results.length >= maxResults) break
    let text = ''
    try {
      text = (await readTextFileSafe(root, rel, 160 * 1024)).text
    } catch {
      continue
    }
    const lines = text.split(/\r?\n/)
    for (let index = 0; index < lines.length; index += 1) {
      if (lines[index].toLowerCase().includes(lowered)) {
        results.push(`${rel}:${index + 1}: ${lines[index].trim().slice(0, 200)}`)
        if (results.length >= maxResults) break
      }
    }
  }
  return {
    ok: true,
    tool: 'search_project',
    output: results.length ? results.join('\n') : 'Không tìm thấy kết quả.',
    data: { scanned: files.length, matches: results.length },
  }
}

const applyEdits = (source: string, edits: Array<{ find: string; replace: string; all?: boolean }>): string => {
  let next = source
  for (const edit of edits) {
    const find = String(edit.find ?? '')
    const replace = String(edit.replace ?? '')
    if (!find) throw new Error('Phép thay thế có "find" rỗng.')
    const count = next.split(find).length - 1
    if (count === 0) throw new Error(`Không tìm thấy đoạn cần sửa trong tệp: ${find.slice(0, 80)}`)
    if (count > 1 && !edit.all) {
      throw new Error(`Đoạn cần sửa xuất hiện ${count} lần. Hãy thêm ngữ cảnh hoặc đặt all=true.`)
    }
    next = edit.all ? next.split(find).join(replace) : next.replace(find, replace)
  }
  return next
}

const runApplyPatch = async (
  request: AiToolCallRequest,
  root: string,
): Promise<AiToolResult> => {
  const file = String(request.args.file ?? '').trim()
  if (!file) return { ok: false, tool: 'apply_patch', error: 'Thiếu tham số file.' }
  const fullPath = resolveProjectPath(root, file)
  const rel = toPosix(fullPath.slice(resolve(root).length + 1))

  let current = ''
  try {
    current = await fs.readFile(fullPath, 'utf8')
  } catch {
    current = ''
  }

  let content: string
  if (typeof request.args.content === 'string') {
    content = request.args.content
  } else if (Array.isArray(request.args.edits)) {
    try {
      content = applyEdits(
        current,
        request.args.edits as Array<{ find: string; replace: string; all?: boolean }>,
      )
    } catch (error) {
      return {
        ok: false,
        tool: 'apply_patch',
        error: error instanceof Error ? error.message : 'Không thể áp dụng phép sửa.',
      }
    }
  } else {
    return {
      ok: false,
      tool: 'apply_patch',
      error: 'Cần truyền content hoặc edits.',
    }
  }

  if (content === current) {
    return { ok: true, tool: 'apply_patch', output: 'Nội dung không thay đổi, không tạo diff.' }
  }

  if (!request.projectId) {
    return { ok: false, tool: 'apply_patch', error: 'Thiếu projectId để lưu change journal.' }
  }

  const change = await proposeChange({
    projectId: request.projectId,
    projectPath: root,
    file: rel,
    content,
    summary: String(request.args.summary ?? `AI đề xuất sửa ${basename(file)}`),
  })

  return {
    ok: true,
    tool: 'apply_patch',
    changeId: change.id,
    output: `Đã tạo diff chờ duyệt cho ${rel} (+${change.added} / −${change.removed}).`,
    data: change,
  }
}

const detectBuildCommand = async (root: string): Promise<{ command: string; label: string } | null> => {
  try {
    const pkg = JSON.parse(await fs.readFile(join(root, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>
    }
    if (pkg.scripts?.build) {
      const manager = (await fs
        .access(join(root, 'pnpm-lock.yaml'))
        .then(() => 'pnpm')
        .catch(() => null)) ??
        (await fs.access(join(root, 'yarn.lock')).then(() => 'yarn').catch(() => null)) ??
        (await fs.access(join(root, 'bun.lockb')).then(() => 'bun').catch(() => null)) ??
        'npm'
      return { command: manager === 'yarn' ? 'yarn build' : `${manager} run build`, label: `${manager} build` }
    }
  } catch {}

  try {
    const entries = await fs.readdir(root)
    if (entries.some((name) => name.endsWith('.sln') || name.endsWith('.csproj'))) {
      return { command: 'dotnet build --nologo', label: 'dotnet build' }
    }
  } catch {}

  return null
}

const runBuild = async (root: string): Promise<AiToolResult> => {
  const detected = await detectBuildCommand(root)
  if (!detected) {
    return {
      ok: false,
      tool: 'run_build',
      error: 'Không tìm thấy lệnh build được allowlist (package.json có script build hoặc tệp .csproj/.sln).',
    }
  }

  return new Promise<AiToolResult>((resolvePromise) => {
    const child = spawn(detected.command, {
      cwd: root,
      shell: true,
      windowsHide: true,
    })
    let output = ''
    let settled = false
    const finish = (result: AiToolResult) => {
      if (settled) return
      settled = true
      resolvePromise(result)
    }
    const timer = setTimeout(() => {
      try {
        if (process.platform === 'win32' && child.pid) {
          spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
        } else {
          child.kill('SIGKILL')
        }
      } catch {}
      finish({
        ok: false,
        tool: 'run_build',
        output: output.slice(-12_000),
        error: `Build quá thời gian ${BUILD_TIMEOUT_MS / 1000}s và đã bị dừng.`,
      })
    }, BUILD_TIMEOUT_MS)

    const collect = (chunk: Buffer) => {
      output += chunk.toString('utf8')
      if (output.length > 200_000) output = output.slice(-150_000)
    }
    child.stdout?.on('data', collect)
    child.stderr?.on('data', collect)
    child.once('error', (error) => {
      clearTimeout(timer)
      finish({ ok: false, tool: 'run_build', error: error.message })
    })
    child.once('close', (code) => {
      clearTimeout(timer)
      finish({
        ok: code === 0,
        tool: 'run_build',
        output: `${output.slice(-12_000)}\n\n[exit code: ${code ?? 'null'}]`,
        error: code === 0 ? undefined : `Build thất bại (exit code ${code ?? 'null'}).`,
        data: { command: detected.command, exitCode: code },
      })
    })
  })
}

const runSyncNav = async (
  request: AiToolCallRequest,
  root: string,
): Promise<AiToolResult> => {
  const file = String(request.args.file ?? '').trim()
  const fromRoute = String(request.args.fromRoute ?? '').trim()
  const toRoute = String(request.args.toRoute ?? '').trim()
  if (!file || !fromRoute || !toRoute) {
    return { ok: false, tool: 'sync_nav', error: 'Cần truyền file, fromRoute và toRoute.' }
  }
  if (!request.projectId) {
    return { ok: false, tool: 'sync_nav', error: 'Thiếu projectId để lưu change journal.' }
  }

  const fullPath = resolveProjectPath(root, file)
  const rel = toPosix(fullPath.slice(resolve(root).length + 1))
  let current = ''
  try {
    current = await fs.readFile(fullPath, 'utf8')
  } catch {
    return { ok: false, tool: 'sync_nav', error: `Không đọc được tệp ${rel}.` }
  }

  const patterns = [
    { find: `href="${fromRoute}"`, replace: `href="${toRoute}"` },
    { find: `href='${fromRoute}'`, replace: `href='${toRoute}'` },
  ]
  let content = current
  let replaced = false
  for (const pattern of patterns) {
    if (content.includes(pattern.find)) {
      content = content.split(pattern.find).join(pattern.replace)
      replaced = true
    }
  }
  if (!replaced) {
    return {
      ok: false,
      tool: 'sync_nav',
      error: `Không tìm thấy liên kết href="${fromRoute}" trong ${rel}.`,
    }
  }

  const change = await proposeChange({
    projectId: request.projectId,
    projectPath: root,
    file: rel,
    content,
    summary: `Nối liên kết ${fromRoute} → ${toRoute}`,
  })
  return {
    ok: true,
    tool: 'sync_nav',
    changeId: change.id,
    output: `Đã tạo diff đổi liên kết trong ${rel} (${fromRoute} → ${toRoute}).`,
    data: change,
  }
}

/* ───────────────────────── Dispatcher ───────────────────────── */

export async function runTool(request: AiToolCallRequest): Promise<AiToolResult> {
  const started = Date.now()
  const schema = findTool(request.tool)
  if (!schema) {
    return { ok: false, tool: request.tool, error: `Tool không được phép: ${request.tool}` }
  }

  let result: AiToolResult
  try {
    if (!request.projectPath) throw new Error('Thiếu đường dẫn dự án.')
    const root = resolve(request.projectPath)
    switch (schema.name) {
      case 'read_file':
        result = await runReadFile(root, request.args)
        break
      case 'search_project':
        result = await runSearch(root, request.args)
        break
      case 'apply_patch':
        result = await runApplyPatch(request, root)
        break
      case 'run_build':
        result = await runBuild(root)
        break
      case 'sync_nav':
        result = await runSyncNav(request, root)
        break
      default:
        result = { ok: false, tool: schema.name, error: 'Tool chưa được cài đặt.' }
    }
  } catch (error) {
    result = {
      ok: false,
      tool: schema.name,
      error: error instanceof Error ? error.message : 'Tool gặp lỗi không xác định.',
    }
  }

  const durationMs = Date.now() - started
  await logToolCall({
    id: randomUUID(),
    at: started,
    projectId: request.projectId,
    tool: request.tool,
    args: summarizeArgs(request.args),
    ok: result.ok,
    durationMs,
    summary: result.ok ? (result.output ?? result.changeId ?? 'ok').slice(0, 240) : (result.error ?? 'lỗi'),
  })

  return result
}

export const isToolName = (name: string): name is AiToolName => Boolean(findTool(name))
