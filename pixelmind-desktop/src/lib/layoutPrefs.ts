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

/* ────────────── Kích thước các panel Workspace (theo từng dự án) ────────────── */

export type PanelSizeKey = 'sidebar' | 'rightPanel' | 'bottomPanel' | 'aiPanel'

export interface PanelSizeLimits {
  min: number
  max: number
}

/** Giới hạn px cho từng panel; dùng chung với prop minSize/maxSize của react-resizable-panels. */
export const PANEL_SIZE_LIMITS: Record<PanelSizeKey, PanelSizeLimits> = {
  sidebar: { min: 220, max: 520 },
  rightPanel: { min: 264, max: 460 },
  bottomPanel: { min: 60, max: 900 },
  aiPanel: { min: 220, max: 860 },
}

/** Kích thước dự phòng khi giá trị lưu bị hỏng (không dùng cho lần chạy đầu tiên). */
export const PANEL_SIZE_DEFAULTS: Record<PanelSizeKey, number> = {
  sidebar: 320,
  rightPanel: 300,
  bottomPanel: 220,
  aiPanel: 400,
}

export type PanelSizeMap = Partial<Record<PanelSizeKey, number>>

const panelSizesKey = (projectId: string): string => `pm.panels.${projectId}`

/**
 * Chuẩn hoá kích thước panel: giá trị không phải số/dương → dùng mặc định,
 * giá trị ngoài giới hạn → kẹp về [min, max]. Nhờ vậy localStorage hỏng không
 * làm vỡ bố cục.
 */
export function sanitizePanelPixels(
  value: unknown,
  limits: PanelSizeLimits,
  fallback: number,
): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback
  return Math.min(limits.max, Math.max(limits.min, Math.round(numeric)))
}

const isPanelSizeKey = (key: string): key is PanelSizeKey =>
  Object.prototype.hasOwnProperty.call(PANEL_SIZE_LIMITS, key)

/** Đọc kích thước đã lưu của một dự án; dữ liệu lỗi được bỏ qua / kẹp về giới hạn. */
export function readPanelSizes(projectId?: string | null): PanelSizeMap {
  if (!projectId) return {}
  try {
    const raw = window.localStorage.getItem(panelSizesKey(projectId))
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const source = parsed as Record<string, unknown>
    const sizes: PanelSizeMap = {}
    for (const key of Object.keys(source)) {
      if (!isPanelSizeKey(key)) continue
      const value = source[key]
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue
      sizes[key] = sanitizePanelPixels(value, PANEL_SIZE_LIMITS[key], PANEL_SIZE_DEFAULTS[key])
    }
    return sizes
  } catch {
    return {}
  }
}

/** Ghi kích thước các panel của một dự án (đã chuẩn hoá trước khi lưu). */
export function persistPanelSizes(projectId: string | null | undefined, sizes: PanelSizeMap): void {
  if (!projectId) return
  const safe: PanelSizeMap = {}
  for (const key of Object.keys(sizes)) {
    if (!isPanelSizeKey(key)) continue
    const value = sizes[key]
    if (typeof value !== 'number') continue
    safe[key] = sanitizePanelPixels(value, PANEL_SIZE_LIMITS[key], PANEL_SIZE_DEFAULTS[key])
  }
  try {
    window.localStorage.setItem(panelSizesKey(projectId), JSON.stringify(safe))
  } catch {
    /* localStorage không khả dụng — bỏ qua */
  }
}
