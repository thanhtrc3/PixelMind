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
