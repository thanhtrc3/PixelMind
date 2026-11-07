/**
 * Bộ nhớ tạm cho phần tử trên Canvas.
 *
 * Khác với clipboard của hệ điều hành, bộ nhớ tạm này giữ nguyên HTML gốc
 * (kèm class, inline style…) và tồn tại xuyên suốt phiên làm việc của ứng dụng.
 * Nhờ vậy người dùng có thể sao chép phần tử ở trang A rồi chuyển sang trang B
 * và dán lại — kể cả khi iframe của trang A đã bị huỷ.
 */
export interface ElementClipboardContent {
  /** HTML của (các) phần tử đã sao chép, đã tách bằng dấu xuống dòng. */
  html: string
  /** Số phần tử trong lần sao chép gần nhất. */
  count: number
  /** Route của trang nguồn (để hiển thị thông báo khi dán sang trang khác). */
  sourceRoute?: string
  /** Danh sách tagName để hiển thị gợi ý. */
  tags: string[]
  timestamp: number
}

let buffer: ElementClipboardContent | null = null

export const elementClipboard = {
  get(): ElementClipboardContent | null {
    return buffer
  },
  has(): boolean {
    return Boolean(buffer && buffer.html.trim())
  },
  set(content: Omit<ElementClipboardContent, 'timestamp'>): ElementClipboardContent {
    buffer = { ...content, timestamp: Date.now() }
    return buffer
  },
  clear() {
    buffer = null
  },
}
