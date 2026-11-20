/* Lưu và khôi phục vị trí/kích thước cửa sổ giữa các lần mở ứng dụng.
   Phần logic thuần (chuẩn hoá, kẹp vào màn hình) tách khỏi Electron để dễ kiểm thử. */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export interface WindowRect {
  x: number
  y: number
  width: number
  height: number
}

export interface WindowState {
  /** Kích thước ở trạng thái bình thường (không phải lúc đang maximize). */
  bounds: WindowRect
  /** Cửa sổ đang maximize lúc thoát → lần sau mở lại cũng maximize. */
  maximized: boolean
}

/** Kích thước tối thiểu hợp lý của cửa sổ chính. */
export const MIN_WINDOW_WIDTH = 960
export const MIN_WINDOW_HEIGHT = 640

/** Phần cửa sổ tối thiểu phải nằm trong màn hình mới được coi là hợp lệ. */
const MIN_VISIBLE = 64

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/** Đọc một hình chữ nhật số hợp lệ (dùng cho cả bounds và workArea). */
export function parseRect(value: unknown): WindowRect | null {
  if (!value || typeof value !== 'object') return null
  const source = value as Record<string, unknown>
  const { x, y, width, height } = source
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null
  if (!isFiniteNumber(width) || !isFiniteNumber(height)) return null
  if (width <= 0 || height <= 0) return null
  if (width > 20000 || height > 20000) return null
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  }
}

const intersectionArea = (a: WindowRect, b: WindowRect): number => {
  const left = Math.max(a.x, b.x)
  const top = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const bottom = Math.min(a.y + a.height, b.y + b.height)
  if (right <= left || bottom <= top) return 0
  return (right - left) * (bottom - top)
}

/** Cửa sổ có ít nhất một phần đủ lớn nằm trong vùng làm việc của màn hình không. */
const isVisibleOn = (bounds: WindowRect, workArea: WindowRect): boolean => {
  const left = Math.max(bounds.x, workArea.x)
  const top = Math.max(bounds.y, workArea.y)
  const right = Math.min(bounds.x + bounds.width, workArea.x + workArea.width)
  const bottom = Math.min(bounds.y + bounds.height, workArea.y + workArea.height)
  return right - left >= MIN_VISIBLE && bottom - top >= MIN_VISIBLE
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

/**
 * Chuẩn hoá dữ liệu cửa sổ đã lưu:
 * - bỏ qua dữ liệu hỏng / thiếu trường;
 * - chọn màn hình chứa nhiều cửa sổ nhất rồi kẹp toàn bộ vào workArea;
 * - cửa sổ hoàn toàn ngoài mọi màn hình → trả null để dùng kích thước mặc định.
 */
export function normalizeWindowState(
  raw: unknown,
  workAreas: WindowRect[],
  minWidth = MIN_WINDOW_WIDTH,
  minHeight = MIN_WINDOW_HEIGHT,
): WindowState | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const bounds = parseRect(source.bounds)
  if (!bounds) return null
  if (workAreas.length === 0) return null

  const visibleAreas = workAreas.filter((area) => isVisibleOn(bounds, area))
  if (visibleAreas.length === 0) return null

  const target = visibleAreas.reduce((best, area) =>
    intersectionArea(bounds, area) > intersectionArea(bounds, best) ? area : best,
  )

  const lowerWidth = Math.min(minWidth, target.width)
  const lowerHeight = Math.min(minHeight, target.height)
  const width = clamp(bounds.width, lowerWidth, target.width)
  const height = clamp(bounds.height, lowerHeight, target.height)
  const x = clamp(bounds.x, target.x, target.x + target.width - width)
  const y = clamp(bounds.y, target.y, target.y + target.height - height)

  return {
    bounds: { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) },
    maximized: source.maximized === true,
  }
}

/** Đọc file trạng thái; trả dữ liệu thô để `normalizeWindowState` kiểm tra. */
export function readWindowStateFile(filePath: string): unknown {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

/** Ghi trạng thái cửa sổ (ghi tạm rồi đổi tên để tránh file hỏng giữa chừng). */
export function writeWindowStateFile(filePath: string, state: WindowState): void {
  try {
    mkdirSync(dirname(filePath), { recursive: true })
    const temporary = `${filePath}.tmp`
    writeFileSync(temporary, JSON.stringify(state, null, 2), 'utf8')
    renameSync(temporary, filePath)
  } catch {
    /* Không ghi được (quyền/ổ đĩa) — bỏ qua, lần sau dùng mặc định. */
  }
}
