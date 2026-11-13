/* Ghi nhớ trạng thái bố cục giao diện giữa các lần mở app.
   Chỉ lưu cờ bật/tắt của các panel — không lưu trạng thái canvas/máy chủ chạy. */

export const LAYOUT_KEYS = {
  sidebar: 'pm.layout.sidebar',
  bottomPanel: 'pm.layout.bottomPanel',
  rightPanel: 'pm.layout.rightPanel',
  aiPanel: 'pm.layout.aiPanel',
  logCollapsed: 'pm.layout.logCollapsed',
  searchInclude: 'pm.search.includeGlobs',
  searchExclude: 'pm.search.excludeGlobs',
} as const

/** Đọc cờ bật/tắt đã lưu; giá trị lỗi hoặc chưa có thì dùng mặc định. */
export const readStoredFlag = (key: string, fallback: boolean): boolean => {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    return raw === '1'
  } catch {
    return fallback
  }
}

export const persistFlag = (key: string, value: boolean): void => {
  try {
    window.localStorage.setItem(key, value ? '1' : '0')
  } catch {
    /* localStorage không khả dụng — bỏ qua */
  }
}

/** Đọc chuỗi tuỳ chọn đã lưu (ví dụ bộ lọc glob); lỗi hoặc chưa có thì dùng mặc định. */
export const readStoredText = (key: string, fallback = ''): string => {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? fallback : raw
  } catch {
    return fallback
  }
}

export const persistText = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* localStorage không khả dụng — bỏ qua */
  }
}
