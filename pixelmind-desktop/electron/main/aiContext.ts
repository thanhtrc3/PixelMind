import { promises as fs } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import type { AiContextPack, AiContextRequest, AiContextResult } from '../../shared/ai'
import { estimateTokens } from '../../shared/ai'
import { DEFAULT_DESIGN_TOKENS, parseVariablesCss } from '../../shared/designTokens'
import type { DesignTokens } from '../../shared/types'
import { readTextFileSafe, resolveProjectPath, toPosix, isInside } from './aiSafe'
import { readStore } from './store'
import { readTree } from './projects'
import { redactSecrets, sanitizeUntrustedContent } from './aiGuardrails'

/* Context Packer: đóng gói phần tử đang chọn, tệp nguồn, tokens, route, wire graph, log lỗi.
   Chỉ đọc tệp nằm trong dự án; bỏ qua .env, node_modules, thư mục build và tệp bí mật. */

const DEFAULT_BUDGET = 6000
const MAX_SOURCE_CHARS = 20_000
const MAX_HTML_CHARS = 8_000
const MAX_ERROR_CHARS = 6_000
const MAX_PROJECT_INDEX = 180

const clamp = (value: string, max: number): { text: string; truncated: boolean } =>
  value.length > max ? { text: `${value.slice(0, max)}\n… (đã cắt bớt)`, truncated: true } : { text: value, truncated: false }

const languageOf = (file: string): string => {
  const ext = extname(file).replace('.', '').toLowerCase()
  const map: Record<string, string> = {
    cshtml: 'razor',
    razor: 'razor',
    cs: 'csharp',
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    css: 'css',
    scss: 'scss',
    html: 'html',
    htm: 'html',
    json: 'json',
    md: 'markdown',
    xml: 'xml',
    yml: 'yaml',
    yaml: 'yaml',
    py: 'python',
  }
  return map[ext] ?? ext ?? 'text'
}

async function readTokens(root: string): Promise<DesignTokens | null> {
  try {
    const data = JSON.parse(await fs.readFile(join(root, '.pixelmind', 'tokens.json'), 'utf8')) as DesignTokens
    if (data && Array.isArray(data.colors) && data.colors.length) return data
  } catch {}

  const candidates = [
    join(root, 'src', 'styles', 'variables.css'),
    join(root, 'wwwroot', 'css', 'variables.css'),
    join(root, 'public', 'variables.css'),
    join(root, 'variables.css'),
  ]
  for (const file of candidates) {
    try {
      const parsed = parseVariablesCss(await fs.readFile(file, 'utf8'))
      if (parsed.colors?.length) return { ...DEFAULT_DESIGN_TOKENS, ...parsed }
    } catch {}
  }
  return null
}

const compactTokens = (tokens: DesignTokens): NonNullable<AiContextPack['tokens']> => ({
  colors: tokens.colors.slice(0, 40).map((token) => ({ name: token.name, value: token.value })),
  spacing: tokens.spacing.slice(0, 24).map((token) => ({ name: token.name, value: token.value })),
  radius: tokens.radius.slice(0, 16).map((token) => ({ name: token.name, value: token.value })),
  typography: tokens.typography
    .slice(0, 16)
    .map((token) => ({ name: token.name, value: `${token.fontSize}/${token.lineHeight}` })),
})

async function readSourceWindow(
  root: string,
  filePath: string,
  lineNumber?: number,
): Promise<AiContextPack['source']> {
  // filePath có thể là tuyệt đối (renderer gửi lên) — chuyển về tương đối rồi kiểm tra allowlist.
  const absolute = resolve(filePath)
  const rel = toPosix(isInside(root, absolute) ? absolute.slice(resolve(root).length + 1) : filePath)
  try {
    const safeRel = resolveProjectPath(root, rel)
    const relSafe = toPosix(safeRel.slice(resolve(root).length + 1))
    const { text } = await readTextFileSafe(root, relSafe, MAX_SOURCE_CHARS * 2)
    if (!lineNumber || lineNumber <= 0) {
      const clipped = clamp(text, MAX_SOURCE_CHARS)
      return { filePath: relSafe, lineNumber, text: clipped.text, language: languageOf(relSafe), truncated: clipped.truncated }
    }
    const lines = text.split(/\r?\n/)
    const start = Math.max(1, lineNumber - 60)
    const end = Math.min(lines.length, lineNumber + 80)
    const window = lines.slice(start - 1, end).join('\n')
    const clipped = clamp(window, MAX_SOURCE_CHARS)
    return {
      filePath: relSafe,
      lineNumber,
      text: clipped.text,
      language: languageOf(relSafe),
      truncated: clipped.truncated || start > 1 || end < lines.length,
    }
  } catch {
    return undefined
  }
}

async function readProjectIndex(root: string): Promise<string[]> {
  try {
    const tree = await readTree(root, { depth: 4, showHidden: false })
    const out: string[] = []
    const walk = (nodes: typeof tree) => {
      for (const node of nodes) {
        if (out.length >= MAX_PROJECT_INDEX) return
        const rel = toPosix(node.path.slice(resolve(root).length + 1))
        if (!rel) continue
        if (node.type === 'dir') {
          if (['node_modules', 'bin', 'obj', 'dist', 'build', '.git', '.pixelmind'].includes(node.name)) continue
          out.push(`${rel}/`)
          if (node.children) walk(node.children)
        } else if (out.length < MAX_PROJECT_INDEX) {
          out.push(rel)
        }
      }
    }
    walk(tree)
    return out
  } catch {
    return []
  }
}

export async function buildContextPack(request: AiContextRequest): Promise<AiContextResult> {
  const root = resolve(request.projectPath)
  const budget = Math.max(800, Math.min(32_000, request.tokenBudget ?? DEFAULT_BUDGET))
  const include = new Set(request.include ?? ['selection', 'source', 'tokens'])
  const notes: string[] = []
  const dropped: string[] = []

  const pack: AiContextPack = {
    version: 1,
    createdAt: Date.now(),
    mode: include.has('project') ? 'project' : request.selection ? 'selection' : 'page',
    project: {
      id: request.projectId,
      name: request.projectName,
      path: root,
      route: request.route,
    },
  }

  if (include.has('selection') && request.selection) {
    const selection = request.selection
    const styles = selection.computedStyles
      ? Object.fromEntries(Object.entries(selection.computedStyles).slice(0, 40))
      : undefined
    pack.selection = {
      tag: selection.tag,
      id: selection.id,
      className: selection.className,
      text: selection.text
        ? sanitizeUntrustedContent(redactSecrets(clamp(selection.text, 2500).text))
        : undefined,
      selector: selection.selector,
      outerHTML: selection.outerHTML
        ? sanitizeUntrustedContent(redactSecrets(clamp(selection.outerHTML, MAX_HTML_CHARS).text))
        : undefined,
      computedStyles: styles,
    }
  }

  if (include.has('source') && request.selection?.filePath) {
    const source = await readSourceWindow(root, request.selection.filePath, request.selection.lineNumber)
    if (source) {
      pack.source = {
        ...source,
        text: sanitizeUntrustedContent(redactSecrets(source.text)),
      }
    } else {
      notes.push('Không đọc được tệp nguồn của phần tử đang chọn (ngoài dự án hoặc bị chặn).')
    }
  }

  if (include.has('tokens')) {
    const tokens = await readTokens(root)
    if (tokens) pack.tokens = compactTokens(tokens)
    else notes.push('Dự án chưa có design tokens (.pixelmind/tokens.json hoặc variables.css).')
  }

  if (include.has('wires')) {
    if (request.projectId) {
      const store = await readStore().catch(() => null)
      const project = store?.projects.find((item) => item.id === request.projectId)
      if (project) {
        pack.wires = project.meta.pages.map((page) => ({
          pageId: page.id,
          route: page.route,
          title: page.title,
          navLinkSelector: page.navLinkSelector,
        }))
      }
    }
    if (!pack.wires?.length) notes.push('Không có sơ đồ dây nối (wire graph) cho dự án này.')
  }

  if (include.has('logs')) {
    const log = (request.errorLog ?? '').trim()
    if (log) pack.errors = sanitizeUntrustedContent(redactSecrets(clamp(log, MAX_ERROR_CHARS).text))
    else notes.push('Chưa có log lỗi gần nhất để đưa vào ngữ cảnh.')
  }

  if (include.has('project')) {
    pack.projectIndex = await readProjectIndex(root)
    notes.push(`Chỉ mục dự án gồm ${pack.projectIndex.length} mục (đã giới hạn).`)
  }

  const measure = () => estimateTokens(JSON.stringify(pack))

  // Cắt theo ngân sách: bỏ mục ít quan trọng trước, cuối cùng mới cắt nội dung nguồn.
  if (measure() > budget && pack.projectIndex) {
    delete pack.projectIndex
    dropped.push('project')
  }
  if (measure() > budget && pack.wires) {
    delete pack.wires
    dropped.push('wires')
  }
  if (measure() > budget && pack.tokens) {
    delete pack.tokens
    dropped.push('tokens')
  }
  if (measure() > budget && pack.errors) {
    delete pack.errors
    dropped.push('logs')
  }
  if (measure() > budget && pack.source) {
    const over = measure() - budget
    const cutChars = Math.max(400, Math.floor(over * 3.6) + 400)
    const next = pack.source.text.slice(0, Math.max(400, pack.source.text.length - cutChars))
    pack.source = { ...pack.source, text: `${next}\n… (đã cắt theo ngân sách token)`, truncated: true }
    dropped.push('source-truncated')
  }

  for (const item of dropped) {
    notes.push(`Đã lược bớt "${item}" để vừa ngân sách ${budget} token.`)
  }

  const json = JSON.stringify(pack, null, 2)
  return { pack, json, tokens: estimateTokens(json), budget, dropped, notes }
}
