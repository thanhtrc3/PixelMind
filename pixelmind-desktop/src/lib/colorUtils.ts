/**
 * colorUtils.ts — Tiện ích xử lý màu và tương tác EyeDropper API (D2-12)
 * Hỗ trợ chuyển đổi HEX/RGBA, trích xuất màu từ màn hình Canvas và fallback an toàn.
 */

export interface ColorPickResult {
  hex: string
  rgba: string
}

export type EyeDropperStatus = 'supported' | 'unsupported' | 'permission_denied'

/**
 * Kiểm tra xem môi trường hiện tại có hỗ trợ EyeDropper API không
 */
export function isEyeDropperSupported(): boolean {
  return typeof window !== 'undefined' && 'EyeDropper' in window
}

/**
 * Chuẩn hoá mã màu HEX thành chuỗi 6 ký tự viết thường (#rrggbb)
 */
export function normalizeHex(hex: string): string {
  let cleaned = hex.trim().toLowerCase()
  if (!cleaned.startsWith('#')) {
    cleaned = '#' + cleaned
  }
  if (cleaned.length === 4) {
    // #rgb -> #rrggbb
    cleaned = '#' + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2] + cleaned[3] + cleaned[3]
  }
  return cleaned.slice(0, 7)
}

/**
 * Chuyển đổi mã màu HEX sang chuỗi RGBA
 */
export function hexToRgba(hex: string, alpha: number = 1): string {
  const norm = normalizeHex(hex)
  const r = parseInt(norm.slice(1, 3), 16) || 0
  const g = parseInt(norm.slice(3, 5), 16) || 0
  const b = parseInt(norm.slice(5, 7), 16) || 0
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Chuyển đổi chuỗi rgb/rgba sang mã HEX
 */
export function rgbaToHex(rgbaStr: string): string {
  if (!rgbaStr) return '#000000'
  if (rgbaStr.startsWith('#')) return normalizeHex(rgbaStr)

  const match = rgbaStr.match(/\d+(\.\d+)?/g)
  if (!match || match.length < 3) return '#000000'

  const r = Math.min(255, Math.max(0, parseInt(match[0], 10)))
  const g = Math.min(255, Math.max(0, parseInt(match[1], 10)))
  const b = Math.min(255, Math.max(0, parseInt(match[2], 10)))

  return (
    '#' +
    r.toString(16).padStart(2, '0') +
    g.toString(16).padStart(2, '0') +
    b.toString(16).padStart(2, '0')
  )
}

/**
 * Gọi EyeDropper API để hút màu từ màn hình
 * @returns ColorPickResult nếu chọn thành công, null nếu người dùng nhấn Esc hủy, hoặc ném lỗi nếu không được cấp quyền / không hỗ trợ
 */
export async function pickColorWithEyeDropper(): Promise<ColorPickResult | null> {
  if (!isEyeDropperSupported()) {
    const err = new Error('EYEDROPPER_UNSUPPORTED')
    err.name = 'NotSupportedError'
    throw err
  }

  try {
    // @ts-expect-error EyeDropper is a standard Web API in Chromium
    const eyeDropper = new window.EyeDropper()
    const result = await eyeDropper.open()
    if (!result || !result.sRGBHex) return null

    const hex = normalizeHex(result.sRGBHex)
    const rgba = hexToRgba(hex, 1)

    return { hex, rgba }
  } catch (error: any) {
    // Người dùng bấm Esc hoặc huỷ chọn màu
    if (error?.name === 'AbortError') {
      return null
    }
    // Trình duyệt / OS từ chối quyền truy cập màn hình
    if (error?.name === 'NotAllowedError') {
      const permErr = new Error('PERMISSION_DENIED')
      permErr.name = 'NotAllowedError'
      throw permErr
    }
    throw error
  }
}

