/* Tiện ích dựng biểu thức tìm kiếm nội dung — dùng chung cho main process và renderer. */

export interface SearchQueryFlags {
  /** Phân biệt chữ hoa/thường. */
  caseSensitive?: boolean
  /** Coi truy vấn là biểu thức chính quy (RegExp). */
  regex?: boolean
  /** Chỉ khớp khi từ trọn vẹn (không dính ký tự chữ/số/_ ở hai bên). */
  wholeWord?: boolean
}

export interface CompiledSearchQuery {
  /** Regex một dòng đã biên dịch; null khi truy vấn rỗng hoặc biểu thức sai. */
  regex: RegExp | null
  /** Thông báo lỗi thân thiện khi biểu thức chính quy không hợp lệ. */
  error: string | null
}

export interface LineMatch {
  /** Vị trí bắt đầu (0-based) trong dòng. */
  index: number
  /** Độ dài đoạn khớp (có thể bằng 0 với regex khớp rỗng). */
  length: number
}

const WORD_CHAR = /[A-Za-z0-9_]/

/** Thoát ký tự đặc biệt để tìm chuỗi theo nghĩa đen. */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Dựng pattern cuối cùng từ truy vấn + cờ tìm kiếm. */
export function buildSearchPattern(query: string, flags: SearchQueryFlags = {}): string {
  const source = flags.regex ? query : escapeRegExp(query)
  if (!flags.wholeWord) return source

  // Với regex: không thêm biên nếu người dùng đã neo đầu/cuối dòng.
  const leftBoundary = flags.regex ? !source.startsWith('^') : WORD_CHAR.test(query.charAt(0))
  const rightBoundary = flags.regex ? !/\$$/.test(source) : WORD_CHAR.test(query.charAt(query.length - 1))

  let pattern = flags.regex ? `(?:${source})` : source
  if (leftBoundary) pattern = `(?<![\\w])${pattern}`
  if (rightBoundary) pattern = `${pattern}(?![\\w])`
  return pattern
}

/**
 * Biên dịch truy vấn tìm kiếm. Trả về `regex = null` + `error` khi biểu thức
 * chính quy không hợp lệ, để giao diện hiển thị thông báo thay vì treo/lỗi ngầm.
 */
export function compileSearchQuery(query: string, flags: SearchQueryFlags = {}): CompiledSearchQuery {
  if (!query.trim()) return { regex: null, error: null }
  const pattern = buildSearchPattern(query, flags)
  try {
    return { regex: new RegExp(pattern, flags.caseSensitive ? '' : 'i'), error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      regex: null,
      error: `Biểu thức chính quy không hợp lệ: ${message.replace(/^Invalid regular expression:\s*/i, '')}`,
    }
  }
}

/** Tìm lần khớp đầu tiên trong một dòng (regex đã biên dịch bằng `compileSearchQuery`). */
export function firstMatchInLine(line: string, regex: RegExp): LineMatch | null {
  const match = regex.exec(line)
  if (!match) return null
  return { index: match.index, length: match[0].length }
}

/** Nhãn mô tả chế độ tìm kiếm để hiển thị trong giao diện. */
export function describeSearchFlags(flags: SearchQueryFlags = {}): string {
  const parts: string[] = []
  if (flags.regex) parts.push('Regex')
  if (flags.wholeWord) parts.push('Từ trọn vẹn')
  if (flags.caseSensitive) parts.push('Phân biệt hoa/thường')
  return parts.length ? parts.join(' · ') : 'Chuỗi thường'
}

/* ─────────────────── Cú pháp truy vấn của Command Palette ─────────────────── */

export type PaletteQueryMode = 'search' | 'command' | 'content'

export interface ParsedPaletteQuery {
  /** `search`: tệp + lệnh; `command`: chỉ lệnh; `content`: tìm trong nội dung dự án. */
  mode: PaletteQueryMode
  /** Phần truy vấn sau khi bỏ tiền tố (`>` hoặc `?`). */
  term: string
}

/**
 * Nhận diện cú pháp palette: `>` chỉ tìm lệnh, `?` tìm trong nội dung dự án,
 * còn lại là tìm tệp/lệnh thông thường. Dùng chung để UI và test không lệch nhau.
 */
export function parsePaletteQuery(input: string): ParsedPaletteQuery {
  const raw = (input || '').trim()
  if (raw.startsWith('>')) return { mode: 'command', term: raw.slice(1).trim() }
  if (raw.startsWith('?')) return { mode: 'content', term: raw.slice(1).trim() }
  return { mode: 'search', term: raw }
}

/* ─────────────────────────── Lọc tệp bằng glob ─────────────────────────── */

export interface CompiledGlob {
  /** Pattern gốc đã chuẩn hoá (dùng '/' làm dấu phân cách). */
  source: string
  /** Regex neo hai đầu để so khớp đường dẫn tương đối. */
  regex: RegExp
  /** Pattern không có '/' → chỉ so khớp phần tên tệp ở mọi độ sâu. */
  basenameOnly: boolean
  /** Đoạn đầu cố định (trước ký tự đại diện) đã cắt về ranh giới thư mục. */
  segmentPrefix: string
}

/** Tách danh sách glob người dùng nhập (phân cách bằng dấu phẩy hoặc xuống dòng). */
export function parseGlobList(input: string): string[] {
  return (input || '')
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

/** Chuẩn hoá glob: bỏ './', đổi '\' thành '/', thêm '/**' nếu chỉ đưa tên thư mục. */
export function normalizeGlobPattern(pattern: string): string {
  let normalized = (pattern || '').trim().replace(/\\/g, '/')
  while (normalized.startsWith('./')) normalized = normalized.slice(2)
  if (normalized.endsWith('/')) normalized += '**'
  return normalized
}

/** Tìm vị trí đóng tương ứng, có tính lồng nhau (dùng cho {a,{b,c}}). */
function findClosing(text: string, start: number, open: string, close: string): number {
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === open) depth++
    else if (text[i] === close) {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** Tách các lựa chọn trong {a,b,c} tại dấu phẩy ngoài cùng. */
function splitAlternatives(body: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const ch of body) {
    if (ch === '{' || ch === '[') depth++
    else if (ch === '}' || ch === ']') depth--
    if (ch === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  parts.push(current)
  return parts
}

/** Chuyển phần thân glob (đã chuẩn hoá) thành nguồn regex, chưa neo đầu/cuối. */
function globSource(glob: string): string {
  let out = ''
  let i = 0
  while (i < glob.length) {
    const ch = glob[i]

    // '/**' ở cuối: khớp cả chính thư mục lẫn mọi thứ bên trong
    if (ch === '/' && glob.startsWith('**', i + 1) && i + 3 === glob.length) {
      out += '(?:/.*)?'
      i += 3
      continue
    }

    if (ch === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') {
          // '**/' khớp 0 hoặc nhiều tầng thư mục
          out += '(?:[^/]+/)*'
          i += 3
        } else {
          out += '.*'
          i += 2
        }
      } else {
        out += '[^/]*'
        i += 1
      }
      continue
    }

    if (ch === '?') {
      out += '[^/]'
      i += 1
      continue
    }

    if (ch === '{') {
      const close = findClosing(glob, i, '{', '}')
      if (close > i) {
        const alternatives = splitAlternatives(glob.slice(i + 1, close))
        out += `(?:${alternatives.map((alt) => globSource(alt)).join('|')})`
        i = close + 1
        continue
      }
    }

    if (ch === '[') {
      const close = glob.indexOf(']', i + 2)
      if (close > i) {
        let body = glob.slice(i + 1, close)
        let negate = false
        if (body.startsWith('!') || body.startsWith('^')) {
          negate = true
          body = body.slice(1)
        }
        if (body) {
          out += `[${negate ? '^' : ''}${body.replace(/\\/g, '\\\\')}]`
          i = close + 1
          continue
        }
      }
    }

    out += escapeRegExp(ch)
    i += 1
  }
  return out
}

/** Đoạn đầu cố định của glob, cắt về ranh giới thư mục để dùng khi pruning. */
function segmentPrefixOf(glob: string): string {
  const wildcardIndex = glob.search(/[*?{[]/)
  const literal = wildcardIndex === -1 ? glob : glob.slice(0, wildcardIndex)
  if (!literal.includes('/')) return ''
  return literal.slice(0, literal.lastIndexOf('/'))
}

/** Biên dịch một glob; pattern rỗng hoặc không hợp lệ trả về null. */
export function compileGlob(pattern: string): CompiledGlob | null {
  const source = normalizeGlobPattern(pattern)
  if (!source) return null
  try {
    return {
      source,
      regex: new RegExp(`^${globSource(source)}$`),
      basenameOnly: !source.includes('/'),
      segmentPrefix: segmentPrefixOf(source),
    }
  } catch {
    return null
  }
}

/** Biên dịch danh sách glob (nhận mảng hoặc chuỗi người dùng nhập). */
export function compileGlobList(patterns?: string[] | string | null): CompiledGlob[] {
  const list = Array.isArray(patterns) ? patterns : parseGlobList(patterns || '')
  const compiled: CompiledGlob[] = []
  for (const pattern of list) {
    const glob = compileGlob(pattern)
    if (glob) compiled.push(glob)
  }
  return compiled
}

/**
 * So khớp đường dẫn tương đối (dùng '/') với glob.
 * Pattern không có '/' được so với tên tệp ở bất kỳ độ sâu nào,
 * nhờ vậy `*.tsx` hoạt động như người dùng thường mong đợi.
 */
export function matchesGlob(relPath: string, glob: CompiledGlob): boolean {
  const path = (relPath || '').replace(/\\/g, '/').replace(/^\.\//, '')
  const target = glob.basenameOnly ? path.split('/').pop() || path : path
  return glob.regex.test(target)
}

/** True khi đường dẫn khớp ít nhất một glob trong danh sách. */
export function matchesAnyGlob(relPath: string, globs: CompiledGlob[]): boolean {
  return globs.some((glob) => matchesGlob(relPath, glob))
}

/**
 * Ước lượng nhanh xem có khả năng tồn tại tệp khớp glob bên trong thư mục
 * `relDir` hay không — dùng để bỏ qua cả cây thư mục khi lọc include.
 * Chỉ là tối ưu: trả về true khi không chắc chắn.
 */
export function globMayMatchUnder(glob: CompiledGlob, relDir: string): boolean {
  if (glob.basenameOnly) return true
  const dir = (relDir || '').replace(/\\/g, '/').replace(/^\.\//, '')
  if (!dir) return true
  const prefix = glob.segmentPrefix
  if (!prefix) return true
  return dir === prefix || dir.startsWith(`${prefix}/`) || prefix.startsWith(`${dir}/`)
}
