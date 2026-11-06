/* ══════════════════════════════════════════════════════════════
   Bộ máy Hộp công cụ (Toolbox) — chạy trong Electron main process.
   - Dò chính xác phạm vi phần tử trong mã nguồn (tag-depth matching)
   - Chèn / xoá / nhân bản / sửa thuộc tính
   - Sao lưu trước khi ghi và trả về diff để renderer xác nhận
   - Quét component / partial / class / asset / route của dự án
   ══════════════════════════════════════════════════════════════ */

import { promises as fs } from 'node:fs'
import { basename, extname, join, relative, resolve, sep } from 'node:path'
import type {
  ElementMutationTarget,
  ElementRangeInfo,
  FrameworkKind,
  MutationPreview,
  ProjectComponent,
  ProjectScanResult,
  ToolboxMutationPayload,
  ToolboxWritePayload,
  ToolboxWriteResult,
} from '../../shared/toolbox'
import { detectFramework, escapeRazor, htmlToJsx } from '../../shared/toolbox'

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
])

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', '.output',
  'vendor', 'bin', 'obj', '.pixelmind', 'coverage', '.cache', '.turbo',
])

const CODE_EXT = new Set([
  '.html', '.htm', '.cshtml', '.razor', '.jsx', '.tsx', '.vue',
  '.svelte', '.php', '.js', '.ts', '.css', '.scss', '.less',
])

const ASSET_EXT = new Set(['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif', '.ico', '.avif', '.bmp'])

/* ─────────────────────────── Quét thẻ ─────────────────────────── */

interface OpenTag {
  name: string
  start: number
  openEnd: number
  attrsStart: number
  attrsEnd: number
  selfClosing: boolean
}

function scanOpenTag(content: string, from: number): OpenTag | null {
  if (content[from] !== '<') return null
  let i = from + 1
  if (i >= content.length) return null
  if (!/[A-Za-z]/.test(content[i])) return null
  const nameStart = i
  while (i < content.length && /[A-Za-z0-9:._-]/.test(content[i])) i++
  const name = content.slice(nameStart, i)
  if (!name) return null
  const attrsStart = i
  let quote: string | null = null
  let brace = 0
  while (i < content.length) {
    const ch = content[i]
    if (quote) {
      if (ch === '\\') { i += 2; continue }
      if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
    } else if (ch === '{') {
      brace++
    } else if (ch === '}') {
      brace = Math.max(0, brace - 1)
    } else if (ch === '>' && brace === 0) {
      const selfClosing = content[i - 1] === '/'
      return {
        name,
        start: from,
        openEnd: i + 1,
        attrsStart,
        attrsEnd: i - (selfClosing ? 1 : 0),
        selfClosing,
      }
    }
    i++
  }
  return null
}

function lineNumberAt(content: string, offset: number): number {
  let line = 1
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === '\n') line++
  }
  return line
}

function lineStartAt(content: string, offset: number): number {
  return content.lastIndexOf('\n', Math.max(0, offset - 1)) + 1
}

function lineEndAt(content: string, offset: number): number {
  const idx = content.indexOf('\n', Math.max(0, offset))
  return idx === -1 ? content.length : idx
}

function findElementRange(content: string, tag: OpenTag): ElementRangeInfo {
  const lower = tag.name.toLowerCase()
  let end = tag.openEnd
  let closeTagStart = tag.openEnd
  let selfClosing = tag.selfClosing || VOID_TAGS.has(lower)

  if (!selfClosing) {
    let depth = 1
    let i = tag.openEnd
    while (i < content.length) {
      const lt = content.indexOf('<', i)
      if (lt === -1) break
      if (content.startsWith('<!--', lt)) {
        const c = content.indexOf('-->', lt + 4)
        i = c === -1 ? content.length : c + 3
        continue
      }
      if (content.startsWith('</', lt)) {
        const m = /^<\/\s*([A-Za-z][\w:.-]*)\s*>/.exec(content.slice(lt, lt + 120))
        if (m && m[1].toLowerCase() === lower) {
          depth--
          if (depth === 0) {
            closeTagStart = lt
            end = lt + m[0].length
            break
          }
        }
        i = lt + 2
        continue
      }
      const child = scanOpenTag(content, lt)
      if (!child) { i = lt + 1; continue }
      if (child.name.toLowerCase() === lower && !child.selfClosing && !VOID_TAGS.has(lower)) depth++
      i = child.openEnd
    }
    if (depth !== 0) {
      end = tag.openEnd
      closeTagStart = tag.openEnd
      selfClosing = true
    }
  }

  const indentMatch = content.slice(lineStartAt(content, tag.start), tag.start).match(/^[ \t]*/)
  return {
    fullPath: '',
    filePath: '',
    tagName: tag.name,
    startOffset: tag.start,
    endOffset: end,
    startLine: lineNumberAt(content, tag.start),
    endLine: lineNumberAt(content, Math.max(tag.start, end - 1)),
    openTagStart: tag.start,
    openTagEnd: tag.openEnd,
    contentStart: tag.openEnd,
    contentEnd: closeTagStart,
    closeTagStart,
    selfClosing,
    indent: indentMatch?.[0] ?? '',
  }
}

interface Candidate {
  tag: OpenTag
  range: ElementRangeInfo
}

function collectCandidates(content: string): Candidate[] {
  const out: Candidate[] = []
  let i = 0
  while (i < content.length) {
    const lt = content.indexOf('<', i)
    if (lt === -1) break
    if (content.startsWith('<!--', lt)) {
      const c = content.indexOf('-->', lt + 4)
      i = c === -1 ? content.length : c + 3
      continue
    }
    if (content.startsWith('<!', lt) || content.startsWith('<?', lt)) {
      i = lt + 2
      continue
    }
    if (content.startsWith('</', lt)) {
      i = lt + 2
      continue
    }
    const tag = scanOpenTag(content, lt)
    if (!tag) { i = lt + 1; continue }
    out.push({ tag, range: findElementRange(content, tag) })
    i = tag.openEnd
  }
  return out
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function scoreCandidate(content: string, candidate: Candidate, target: ElementMutationTarget): number {
  const { tag } = candidate
  const tagName = (target.tagName || '').toLowerCase()
  if (tagName && tag.name.toLowerCase() !== tagName) return -1

  let score = tagName ? 8 : 0
  const open = content.slice(tag.start, tag.openEnd)

  if (target.id) {
    const re = new RegExp(`\\bid\\s*=\\s*["']${escapeRegExp(target.id)}["']`)
    if (re.test(open)) score += 40
  }

  if (target.className) {
    const tokens = target.className.split(/\s+/).filter(Boolean)
    let hit = 0
    for (const token of tokens) {
      const re = new RegExp(`(^|["'\\s])${escapeRegExp(token)}(["'\\s]|$)`)
      if (re.test(open)) hit++
    }
    if (hit > 0) score += Math.min(30, hit * 8)
  }

  if (target.textSnippet) {
    const snippet = target.textSnippet.trim().slice(0, 60)
    if (snippet) {
      const body = content.slice(tag.openEnd, Math.min(content.length, tag.openEnd + 6000))
      if (body.includes(snippet)) score += 30
      else {
        const firstWord = snippet.split(/\s+/)[0]
        if (firstWord.length > 2 && body.includes(firstWord)) score += 6
      }
    }
  }

  if (target.selector) {
    const simple = target.selector.replace(/[>+~].*$/, '').trim()
    if (simple && open.includes(simple)) score += 12
  }

  if (target.lineNumber) {
    const line = lineNumberAt(content, tag.start)
    const distance = Math.abs(line - target.lineNumber)
    if (distance === 0) score += 25
    else if (distance <= 2) score += 12
    else if (distance <= 8) score += 4
  }

  return score
}

function findBestCandidate(
  content: string,
  target: ElementMutationTarget,
): { candidate: Candidate; score: number } | null {
  let best: { candidate: Candidate; score: number } | null = null
  for (const candidate of collectCandidates(content)) {
    const score = scoreCandidate(content, candidate, target)
    if (score < 0) continue
    if (!best || score > best.score) best = { candidate, score }
  }
  if (!best) return null
  // Khi không có tagName (ví dụ chèn vào cuối trang) chỉ chấp nhận ứng viên
  // có tín hiệu nhận dạng thật (id/class/text/dòng), tránh bắt nhầm thẻ đầu tiên.
  const minScore = target.tagName ? 8 : 1
  if (best.score < minScore) return null
  return best
}

/* ─────────────────────── Diff / preview ─────────────────────── */

function blockAround(content: string, start: number, end: number, context = 3): string {
  const lines = content.split('\n')
  const startLine = lineNumberAt(content, Math.max(0, start))
  const endLine = lineNumberAt(content, Math.max(0, end))
  const from = Math.max(1, startLine - context)
  const to = Math.min(lines.length, endLine + context)
  return lines.slice(from - 1, to).join('\n')
}

function buildPreview(
  fullPath: string,
  projectPath: string,
  oldText: string,
  newText: string,
  changeStart: number,
  oldChangeEnd: number,
  newChangeEnd: number,
  element: ElementRangeInfo | null,
): MutationPreview {
  return {
    success: true,
    fullPath,
    filePath: relative(projectPath, fullPath).replace(/\\/g, '/'),
    oldText,
    newText,
    oldBlock: blockAround(oldText, changeStart, oldChangeEnd),
    newBlock: blockAround(newText, changeStart, newChangeEnd),
    startLine: lineNumberAt(oldText, changeStart),
    endLine: lineNumberAt(oldText, Math.max(changeStart, oldChangeEnd)),
    element,
  }
}

/* ─────────────────────── Tiện ích tệp ─────────────────────── */

function isInsideProject(projectPath: string, fullPath: string): boolean {
  const root = resolve(projectPath).toLowerCase()
  const file = resolve(fullPath).toLowerCase()
  return file === root || file.startsWith(root + sep)
}

async function backupFile(projectPath: string, fullPath: string): Promise<string> {
  const dir = join(projectPath, '.pixelmind', 'backups')
  await fs.mkdir(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dest = join(dir, `${basename(fullPath)}.${stamp}.bak`)
  await fs.writeFile(dest, await fs.readFile(fullPath, 'utf8'), 'utf8')
  return dest
}

async function walkFiles(root: string, limit = 1500): Promise<string[]> {
  const out: string[] = []
  const queue = [root]
  while (queue.length > 0 && out.length < limit) {
    const dir = queue.shift() as string
    let entries: import('node:fs').Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (out.length >= limit) break
      if (entry.name.startsWith('.') && entry.name !== '.well-known') continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name.toLowerCase())) continue
        queue.push(full)
      } else if (entry.isFile()) {
        out.push(full)
      }
    }
  }
  return out
}

const ENTRY_CANDIDATES = [
  'index.html',
  'public/index.html',
  'src/index.html',
  'src/App.tsx',
  'src/App.jsx',
  'src/app.vue',
  'src/App.vue',
  'src/App.svelte',
  'src/app.component.html',
  'Pages/Index.cshtml',
  'Views/Home/Index.cshtml',
  'index.php',
  'resources/views/welcome.blade.php',
]

function isIgnoredTemplateFile(fullPath: string): boolean {
  const base = basename(fullPath).toLowerCase()
  if (base.startsWith('_viewimports') || base.startsWith('_viewstart') || base.endsWith('.bak')) return true
  return false
}

function getRouteCandidates(currentPath?: string): string[] {
  if (!currentPath) return []
  const clean = currentPath.split('?')[0].replace(/^\/+|\/+$/g, '')
  if (!clean || clean === 'home') {
    return [
      'Views/Home/Index.cshtml',
      'Pages/Index.cshtml',
      'index.html',
      'public/index.html',
      'src/App.tsx',
      'src/App.jsx',
      'src/App.vue',
      'src/app.vue',
      'src/App.svelte',
    ]
  }
  const parts = clean.split('/')
  const list: string[] = []
  if (parts.length === 1) {
    const name = parts[0]
    const cap = name.charAt(0).toUpperCase() + name.slice(1)
    list.push(`Views/${cap}/Index.cshtml`)
    list.push(`Views/Home/${cap}.cshtml`)
    list.push(`Pages/${cap}/Index.cshtml`)
    list.push(`Pages/${cap}.cshtml`)
    list.push(`src/pages/${cap}.tsx`)
    list.push(`src/pages/${name}.tsx`)
    list.push(`src/pages/${cap}.vue`)
    list.push(`src/pages/${name}.vue`)
  } else if (parts.length === 2) {
    const c1 = parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
    const c2 = parts[1].charAt(0).toUpperCase() + parts[1].slice(1)
    list.push(`Views/${c1}/${c2}.cshtml`)
    list.push(`Pages/${c1}/${c2}.cshtml`)
    list.push(`src/pages/${c1}/${c2}.tsx`)
  }
  return list
}

async function resolveSourceFile(
  projectPath: string,
  target: ElementMutationTarget,
  kind: string,
): Promise<{ fullPath: string; content: string; range: ElementRangeInfo | null } | null> {
  if (target.fullPath && isInsideProject(projectPath, target.fullPath) && !isIgnoredTemplateFile(target.fullPath)) {
    try {
      const content = await fs.readFile(target.fullPath, 'utf8')
      const best = findBestCandidate(content, target)
      if (best) {
        return { fullPath: target.fullPath, content, range: best.candidate.range }
      }
      if (kind === 'insert') {
        return { fullPath: target.fullPath, content, range: null }
      }
      // Không thấy trong tệp đã dò — tiếp tục quét các tệp khác bên dưới.
    } catch {
      // Tệp đã dò không đọc được — tiếp tục quét dự án.
    }
  }

  // 1. Thử các tệp theo route hiện tại của trang
  const routeCandidates = getRouteCandidates(target.currentPath)
  for (const rel of routeCandidates) {
    const fullPath = join(projectPath, rel)
    try {
      const content = await fs.readFile(fullPath, 'utf8')
      const best = findBestCandidate(content, target)
      if (best) return { fullPath, content, range: best.candidate.range }
      if (kind === 'insert' && !target.tagName) return { fullPath, content, range: null }
    } catch {}
  }

  // 2. Thử các điểm vào chuẩn (Entry Candidates)
  for (const rel of ENTRY_CANDIDATES) {
    const fullPath = join(projectPath, rel)
    try {
      const content = await fs.readFile(fullPath, 'utf8')
      const best = findBestCandidate(content, target)
      if (best) return { fullPath, content, range: best.candidate.range }
      if (kind === 'insert' && !target.tagName && routeCandidates.length === 0) return { fullPath, content, range: null }
    } catch {
      // thử tệp tiếp theo
    }
  }

  // 3. Quét các tệp mã nguồn hợp lệ trong dự án (loại trừ các file hệ thống/metadata)
  const files = await walkFiles(projectPath, 900)
  const codeFiles = files.filter((file) => CODE_EXT.has(extname(file).toLowerCase()) && !isIgnoredTemplateFile(file))
  let bestFile: { fullPath: string; content: string; range: ElementRangeInfo; score: number } | null = null

  for (const fullPath of codeFiles) {
    let content: string
    try {
      content = await fs.readFile(fullPath, 'utf8')
    } catch {
      continue
    }
    const best = findBestCandidate(content, target)
    if (best && (!bestFile || best.score > bestFile.score)) {
      bestFile = { fullPath, content, range: best.candidate.range, score: best.score }
    }
  }

  if (bestFile) {
    return { fullPath: bestFile.fullPath, content: bestFile.content, range: bestFile.range }
  }

  if (kind === 'insert') {
    // Ưu tiên tệp theo route hiện tại
    for (const rel of routeCandidates) {
      const fullPath = join(projectPath, rel)
      if (codeFiles.includes(fullPath)) {
        try {
          return { fullPath, content: await fs.readFile(fullPath, 'utf8'), range: null }
        } catch {}
      }
    }
    const htmlFile = codeFiles.find((file) => /\.(html?|php|cshtml|razor)$/i.test(file) && !basename(file).startsWith('_'))
    if (htmlFile) {
      return { fullPath: htmlFile, content: await fs.readFile(htmlFile, 'utf8'), range: null }
    }
  }
  return null
}

/* ─────────────────────── Sinh mã chèn ─────────────────────── */

function indentBlock(block: string, indent: string): string {
  return block
    .split('\n')
    .map((line, index) => (index === 0 ? line : indent + line))
    .join('\n')
}

function toFrameworkHtml(html: string, framework: FrameworkKind): string {
  if (framework === 'jsx') return htmlToJsx(html)
  if (framework === 'razor') return escapeRazor(html)
  return html
}

function cssToFrameworkBlock(css: string, framework: FrameworkKind): string {
  const trimmed = css.trim()
  if (!trimmed) return ''
  if (framework === 'jsx') {
    const safe = trimmed.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
    return `\n<style data-pm-toolbox dangerouslySetInnerHTML={{ __html: \`${safe}\` }} />`
  }
  const body = framework === 'razor' ? escapeRazor(trimmed) : trimmed
  return `\n<style data-pm-toolbox>\n${body}\n</style>`
}

function appendToBody(content: string, block: string): { text: string; at: number } {
  const lower = content.toLowerCase()
  const bodyClose = lower.lastIndexOf('</body>')
  const at = bodyClose === -1 ? content.length : lineStartAt(content, bodyClose)
  const prefix = at === 0 || content[at - 1] === '\n' ? '' : '\n'
  const suffix = bodyClose === -1 && content.length > 0 && !content.endsWith('\n') ? '\n' : ''
  return {
    text: content.slice(0, at) + prefix + block + suffix + content.slice(at),
    at,
  }
}

/**
 * Tìm khung chứa để chèn khi không xác định được phần tử đích.
 * - JSX/TSX: phần tử gốc trong khối `return (...)`
 * - Vue/Svelte: thẻ <template>
 * Trả về null nếu không tìm thấy (khi đó rơi về appendToBody).
 */
function findFallbackRange(content: string, framework: FrameworkKind): ElementRangeInfo | null {
  let from = 0
  if (framework === 'jsx') {
    const ret = content.search(/\breturn\s*\(/)
    if (ret !== -1) from = ret
  } else if (framework === 'vue' || framework === 'svelte') {
    const m = /<template\b[^>]*>/i.exec(content)
    if (!m) return null
    const tag = scanOpenTag(content, m.index)
    return tag ? findElementRange(content, tag) : null
  } else {
    return null
  }

  let i = from
  while (i < content.length) {
    const lt = content.indexOf('<', i)
    if (lt === -1) return null
    if (content.startsWith('<!--', lt)) {
      const c = content.indexOf('-->', lt + 4)
      i = c === -1 ? content.length : c + 3
      continue
    }
    const tag = scanOpenTag(content, lt)
    if (tag && !tag.selfClosing && !VOID_TAGS.has(tag.name.toLowerCase())) {
      return findElementRange(content, tag)
    }
    i = lt + 1
  }
  return null
}

/* ─────────────────────── Các phép biến đổi ─────────────────────── */

function mutateInsert(
  fullPath: string,
  projectPath: string,
  content: string,
  inputRange: ElementRangeInfo | null,
  target: ElementMutationTarget,
  payload: ToolboxMutationPayload,
  framework: FrameworkKind,
): MutationPreview {
  const html = toFrameworkHtml(payload.html || '', framework)
  const cssBlock = payload.css ? cssToFrameworkBlock(payload.css, framework) : ''
  const block = html + cssBlock

  let effectiveRange = inputRange
  let placement = target.placement || target.position || 'after'
  if (!effectiveRange) {
    const fallback = findFallbackRange(content, framework)
    if (fallback && !fallback.selfClosing) {
      effectiveRange = fallback
      placement = 'inside'
    }
  }

  if (!effectiveRange) {
    const indented = indentBlock(block, '  ')
    const result = appendToBody(content, `  ${indented}`)
    return buildPreview(
      fullPath, projectPath, content, result.text, result.at, result.at, result.at + indented.length + 2,
      null,
    )
  }

  const range = effectiveRange

  if (placement === 'inside' && !range.selfClosing) {
    const at = lineStartAt(content, range.closeTagStart)
    const innerIndent = range.indent + '  '
    if (at > range.openTagStart) {
      const inserted = indentBlock(block, innerIndent)
      const text = content.slice(0, at) + innerIndent + inserted + '\n' + content.slice(at)
      return buildPreview(
        fullPath, projectPath, content, text, at, at, at + innerIndent.length + inserted.length + 1, range,
      )
    }
    const inserted = block
    const text = content.slice(0, range.contentEnd) + inserted + content.slice(range.contentEnd)
    return buildPreview(
      fullPath, projectPath, content, text, range.contentEnd, range.contentEnd,
      range.contentEnd + inserted.length, range,
    )
  }

  if (placement === 'before') {
    const at = lineStartAt(content, range.startOffset)
    const inserted = indentBlock(block, range.indent)
    const text = content.slice(0, at) + range.indent + inserted + '\n' + content.slice(at)
    return buildPreview(
      fullPath, projectPath, content, text, at, at, at + range.indent.length + inserted.length + 1, range,
    )
  }

  // Mặc định: chèn ngay sau phần tử đích
  const at = Math.min(content.length, lineEndAt(content, Math.max(range.startOffset, range.endOffset - 1)) + 1)
  const inserted = indentBlock(block, range.indent)
  const needsLeadingNewline = at === content.length && content.length > 0 && !content.endsWith('\n')
  const prefix = needsLeadingNewline ? '\n' : ''
  const text = content.slice(0, at) + prefix + range.indent + inserted + '\n' + content.slice(at)
  return buildPreview(
    fullPath, projectPath, content, text, at, at,
    at + prefix.length + range.indent.length + inserted.length + 1, range,
  )
}

function mutateDelete(
  fullPath: string,
  projectPath: string,
  content: string,
  range: ElementRangeInfo,
): MutationPreview {
  const start = lineStartAt(content, range.startOffset)
  const endLine = lineEndAt(content, Math.max(range.startOffset, range.endOffset - 1))
  const end = endLine < content.length ? endLine + 1 : endLine
  const text = content.slice(0, start) + content.slice(end)
  return buildPreview(fullPath, projectPath, content, text, start, end, start, range)
}

function mutateDuplicate(
  fullPath: string,
  projectPath: string,
  content: string,
  range: ElementRangeInfo,
): MutationPreview {
  const block = content.slice(range.startOffset, range.endOffset)
  const at = Math.min(content.length, lineEndAt(content, Math.max(range.startOffset, range.endOffset - 1)) + 1)
  const needsLeadingNewline = at === content.length && content.length > 0 && !content.endsWith('\n')
  const prefix = needsLeadingNewline ? '\n' : ''
  // Khối gốc đã mang sẵn thụt lề tuyệt đối cho các dòng sau, chỉ cần thêm
  // thụt lề cho dòng đầu tiên.
  const text = content.slice(0, at) + prefix + range.indent + block + '\n' + content.slice(at)
  return buildPreview(
    fullPath, projectPath, content, text, at, at,
    at + prefix.length + range.indent.length + block.length + 1, range,
  )
}

function mutateAttributes(
  fullPath: string,
  projectPath: string,
  content: string,
  range: ElementRangeInfo,
  payload: ToolboxMutationPayload,
  framework: FrameworkKind,
): MutationPreview {
  const openTag = content.slice(range.openTagStart, range.openTagEnd)
  const isJsx = framework === 'jsx'
  let nextOpen = openTag

  for (const [key, value] of Object.entries(payload.attributes || {})) {
    // JSX dùng className thay cho class.
    const sourceKey = isJsx && key === 'class' ? 'className' : key
    const safeKey = escapeRegExp(sourceKey)
    const valuePattern = `("[^"]*"|'[^']*'|\\{[^}]*\\}|[^\\s>]+)`
    if (value === null) {
      nextOpen = nextOpen.replace(new RegExp(`\\s${safeKey}\\s*=\\s*${valuePattern}`, 'i'), '')
      nextOpen = nextOpen.replace(new RegExp(`\\s${safeKey}(?=\\s|/?>)`, 'i'), '')
    } else {
      const formatted =
        isJsx && value.trim().startsWith('{')
          ? value.trim()
          : `"${value.replace(/"/g, '&quot;')}"`
      const re = new RegExp(`(\\s${safeKey}\\s*=\\s*)${valuePattern}`, 'i')
      if (re.test(nextOpen)) {
        nextOpen = nextOpen.replace(re, `$1${formatted}`)
      } else {
        const insertAt = nextOpen.search(/\s*\/?>$/)
        if (insertAt >= 0) {
          nextOpen = nextOpen.slice(0, insertAt) + ` ${sourceKey}=${formatted}` + nextOpen.slice(insertAt)
        }
      }
    }
  }

  let nextContent = content.slice(0, range.openTagStart) + nextOpen + content.slice(range.openTagEnd)
  let changeStart = range.openTagStart
  let changeEnd = range.openTagEnd
  let newChangeEnd = range.openTagStart + nextOpen.length

  if (typeof payload.text === 'string' && !range.selfClosing) {
    const openEnd = range.openTagStart + nextOpen.length
    const closeStart = openEnd + (range.contentEnd - range.openTagEnd)
    const before = nextContent.slice(0, openEnd)
    const after = nextContent.slice(closeStart)
    // Giữ nguyên mốc bắt đầu (thẻ mở) cho cả hai khung diff để ngữ cảnh
    // trước/sau thẳng hàng, chỉ khác vị trí kết thúc.
    changeStart = range.openTagStart
    changeEnd = range.contentEnd
    let nextText = payload.text
    if (framework === 'jsx') {
      nextText = nextText.replace(/[{}<>]/g, (ch) =>
        ch === '{' ? '&#123;' : ch === '}' ? '&#125;' : ch === '<' ? '&lt;' : '&gt;',
      )
    } else if (framework === 'razor') {
      nextText = escapeRazor(nextText)
    }
    nextContent = before + nextText + after
    newChangeEnd = openEnd + nextText.length
  }

  return buildPreview(
    fullPath, projectPath, content, nextContent, changeStart, changeEnd, newChangeEnd, range,
  )
}

/* ─────────────────────── API chính ─────────────────────── */

export async function runToolboxMutation(payload: ToolboxMutationPayload): Promise<MutationPreview> {
  if (!payload.projectPath) return { success: false, error: 'Thiếu đường dẫn dự án.' }
  const target = payload.target || {}
  const resolved = await resolveSourceFile(payload.projectPath, target, payload.kind)
  if (!resolved) {
    return {
      success: false,
      error:
        payload.kind === 'insert'
          ? 'Không tìm thấy tệp mã nguồn phù hợp để chèn. Hãy mở một trang trong dự án trước.'
          : 'Không dò được phần tử này trong mã nguồn. Hãy chọn lại phần tử hoặc lưu tệp rồi thử lại.',
    }
  }

  const { fullPath, content, range } = resolved
  const framework = detectFramework(fullPath, payload.projectFramework)

  if (!range && payload.kind !== 'insert') {
    return { success: false, error: 'Không tìm thấy phần tử đích trong mã nguồn.' }
  }

  let preview: MutationPreview
  switch (payload.kind) {
    case 'insert':
      preview = mutateInsert(fullPath, payload.projectPath, content, range, target, payload, framework)
      break
    case 'delete':
      preview = mutateDelete(fullPath, payload.projectPath, content, range as ElementRangeInfo)
      break
    case 'duplicate':
      preview = mutateDuplicate(fullPath, payload.projectPath, content, range as ElementRangeInfo)
      break
    case 'attributes':
      preview = mutateAttributes(fullPath, payload.projectPath, content, range as ElementRangeInfo, payload, framework)
      break
    default:
      return { success: false, error: 'Thao tác không hợp lệ.' }
  }

  if (!preview.success || preview.newText === undefined) return preview

  if (payload.dryRun) {
    preview.newText = undefined
    return preview
  }

  try {
    await backupFile(payload.projectPath, fullPath)
    await fs.writeFile(fullPath, preview.newText, 'utf8')
  } catch (error) {
    return {
      success: false,
      error: `Không ghi được tệp ${basename(fullPath)}: ${(error as Error).message}`,
    }
  }

  return preview
}

export async function writeToolboxFile(payload: ToolboxWritePayload): Promise<ToolboxWriteResult> {
  try {
    if (payload.projectPath && !isInsideProject(payload.projectPath, payload.fullPath)) {
      return { success: false, error: 'Tệp nằm ngoài thư mục dự án.' }
    }
    let backupPath: string | undefined
    if (payload.backup && payload.projectPath) {
      backupPath = await backupFile(payload.projectPath, payload.fullPath)
    }
    await fs.writeFile(payload.fullPath, payload.text, 'utf8')
    return { success: true, backupPath }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/* ─────────────────────── Quét dự án ─────────────────────── */

function componentInsertHtml(
  name: string,
  relPath: string,
  framework: FrameworkKind,
  kind: ProjectComponent['kind'],
): string {
  if (kind === 'partial') {
    return `<partial name="~/${relPath}" />`
  }
  if (framework === 'jsx' || framework === 'vue' || framework === 'svelte') {
    return `<${name} />`
  }
  if (framework === 'angular') {
    const kebab = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
    return `<app-${kebab}></app-${kebab}>`
  }
  if (framework === 'php') {
    return `<?php include '${relPath}'; ?>`
  }
  if (framework === 'razor') {
    return `<partial name="~/${relPath}" />`
  }
  return `<!-- ${name} (${relPath}) -->`
}

function isComponentFile(relPath: string, base: string, framework: FrameworkKind): boolean {
  const lower = base.toLowerCase()
  if (['index', 'main', 'app', 'layout', '_app', '_document', 'vite.config'].includes(lower)) return false
  if (framework === 'razor') return base.startsWith('_')
  if (framework === 'php') {
    return /(^|\/)(partials?|includes?|components?)\//i.test(relPath)
  }
  if (framework === 'html') return false
  return /^[A-Z]/.test(base)
}

export async function scanProjectToolbox(projectPath: string): Promise<ProjectScanResult> {
  const framework = detectFramework('', '')
  const empty: ProjectScanResult = {
    success: true,
    framework,
    components: [],
    classes: [],
    assets: [],
    routes: [],
  }
  if (!projectPath) return { ...empty, success: false, error: 'Thiếu đường dẫn dự án.' }

  try {
    const files = await walkFiles(projectPath, 1600)
    const components: ProjectComponent[] = []
    const classes: ProjectComponent[] = []
    const assets: ProjectComponent[] = []
    const routes: ProjectComponent[] = []
    const classSet = new Set<string>()

    let detected: FrameworkKind = 'unknown'
    const counts: Record<string, number> = {}
    for (const file of files) {
      const ext = extname(file).toLowerCase()
      const fw = detectFramework(file)
      if (fw !== 'html' || ext === '.html' || ext === '.htm') {
        counts[fw] = (counts[fw] || 0) + 1
      }
    }
    detected = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as FrameworkKind) || 'html'

    for (const fullPath of files) {
      const ext = extname(fullPath).toLowerCase()
      const relPath = relative(projectPath, fullPath).replace(/\\/g, '/')
      const base = basename(fullPath, extname(fullPath))

      if (ASSET_EXT.has(ext)) {
        if (assets.length < 80) {
          assets.push({
            id: `asset:${relPath}`,
            name: basename(fullPath),
            kind: 'asset',
            path: relPath,
            detail: relPath,
            insertHtml: `<img src="/${relPath}" alt="${base}" style="max-width:100%; height:auto; display:block;" />`,
          })
        }
        continue
      }

      if (ext === '.css' || ext === '.scss' || ext === '.less') {
        if (classes.length >= 140) continue
        let content = ''
        try {
          content = await fs.readFile(fullPath, 'utf8')
        } catch {
          continue
        }
        const re = /\.(-?[_a-zA-Z]+[\w-]*)/g
        let match: RegExpExecArray | null
        while ((match = re.exec(content)) !== null) {
          const name = match[1]
          if (classSet.has(name) || name.length > 42) continue
          classSet.add(name)
          classes.push({
            id: `class:${name}`,
            name,
            kind: 'class',
            path: relPath,
            detail: `.${name}`,
            insertHtml: `<div class="${name}">Nội dung</div>`,
          })
          if (classes.length >= 140) break
        }
        continue
      }

      if (!CODE_EXT.has(ext)) continue

      const fw = detectFramework(fullPath)
      if (isComponentFile(relPath, base, fw)) {
        if (components.length < 90) {
          components.push({
            id: `component:${relPath}`,
            name: base,
            kind: fw === 'razor' ? 'partial' : 'component',
            path: relPath,
            detail: relPath,
            insertHtml: componentInsertHtml(base, relPath, fw, fw === 'razor' ? 'partial' : 'component'),
          })
        }
      }

      if (/^(index|page|\+page|route)\./i.test(basename(fullPath)) || /(^|\/)(pages|routes|views)\//i.test(relPath)) {
        if (routes.length < 60) {
          const route = '/' + relPath
            .replace(/(^|\/)(pages|routes|views)\//i, '$1')
            .replace(/\.(html?|cshtml|razor|jsx|tsx|vue|svelte|php|js|ts)$/i, '')
            .replace(/\/index$/i, '')
            .replace(/^\/+/, '')
          routes.push({
            id: `route:${relPath}`,
            name: route === '' ? '/' : route,
            kind: 'route',
            path: relPath,
            detail: relPath,
            insertHtml: `<a href="${route === '' ? '/' : route}">${base}</a>`,
          })
        }
      }
    }

    return {
      success: true,
      framework: detected,
      components: components.sort((a, b) => a.name.localeCompare(b.name)),
      classes: classes.sort((a, b) => a.name.localeCompare(b.name)),
      assets: assets.sort((a, b) => a.name.localeCompare(b.name)),
      routes: routes.sort((a, b) => a.name.localeCompare(b.name)),
    }
  } catch (error) {
    return { ...empty, success: false, error: (error as Error).message }
  }
}
