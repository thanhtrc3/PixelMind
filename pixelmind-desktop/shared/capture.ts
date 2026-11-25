/* ══════════════════════════════════════════════════════════════
   D2-16: Kiểu dữ liệu và Tiện ích chụp ảnh PNG (Capture PNG)
   - Hỗ trợ 3 phạm vi: Viewport, Toàn bộ trang (Full Page), Phần tử đang chọn (Element)
   - Đảm bảo tọa độ cắt chuẩn xác, không dính thanh công cụ hoặc UI PixelMind
   ══════════════════════════════════════════════════════════════ */

export type CaptureScope = 'viewport' | 'element' | 'fullPage'

export interface CaptureRect {
  x: number
  y: number
  width: number
  height: number
}

export interface CaptureElementRect {
  left: number
  top: number
  width: number
  height: number
}

export interface CaptureWindowBounds {
  width: number
  height: number
}

/**
 * Tính toán hình chữ nhật cắt (DIPs) so với cửa sổ ứng dụng
 * Đảm bảo toạ độ luôn nằm gọn gàng bên trong khung iframe
 */
export function calculateCaptureRect(params: {
  scope: CaptureScope
  iframeBounds: { left: number; top: number; right: number; bottom: number; width: number; height: number }
  elementRect?: CaptureElementRect | null
  iframeClientSize?: { width: number; height: number }
  fullPageSize?: { width: number; height: number }
  windowBounds?: CaptureWindowBounds
}): CaptureRect {
  const { iframeBounds, elementRect, iframeClientSize, fullPageSize, scope } = params

  const clientW = iframeClientSize?.width || iframeBounds.width || 1
  const clientH = iframeClientSize?.height || iframeBounds.height || 1
  const scaleX = iframeBounds.width / clientW
  const scaleY = iframeBounds.height / clientH

  if (scope === 'element' && elementRect && elementRect.width > 0 && elementRect.height > 0) {
    // Tọa độ thực tế của phần tử trên màn hình ứng dụng
    const rawX = Math.round(iframeBounds.left + elementRect.left * scaleX)
    const rawY = Math.round(iframeBounds.top + elementRect.top * scaleY)
    const rawW = Math.round(elementRect.width * scaleX)
    const rawH = Math.round(elementRect.height * scaleY)

    // Cắt gọn trong phạm vi khung nhìn của iframe (chống tràn ra ngoài thanh công cụ hoặc Inspector)
    const clampedX = Math.max(Math.round(iframeBounds.left), rawX)
    const clampedY = Math.max(Math.round(iframeBounds.top), rawY)
    const clampedW = Math.max(1, Math.min(Math.round(iframeBounds.right) - clampedX, rawW))
    const clampedH = Math.max(1, Math.min(Math.round(iframeBounds.bottom) - clampedY, rawH))

    return {
      x: clampedX,
      y: clampedY,
      width: clampedW,
      height: clampedH,
    }
  }

  if (scope === 'fullPage' && fullPageSize && fullPageSize.width > 0 && fullPageSize.height > 0) {
    // Phạm vi toàn bộ trang dựa trên kích thước scroll thật của trang
    const fullW = Math.round(fullPageSize.width * scaleX)
    const fullH = Math.round(fullPageSize.height * scaleY)
    return {
      x: Math.round(iframeBounds.left),
      y: Math.round(iframeBounds.top),
      width: Math.max(1, fullW),
      height: Math.max(1, fullH),
    }
  }

  // Mặc định: Chụp toàn bộ viewport của iframe
  return {
    x: Math.round(iframeBounds.left),
    y: Math.round(iframeBounds.top),
    width: Math.max(1, Math.round(iframeBounds.width)),
    height: Math.max(1, Math.round(iframeBounds.height)),
  }
}

/**
 * Tạo tên file xuất ảnh mặc định thân thiện
 */
export function formatCaptureFilename(projectName?: string, scope: CaptureScope = 'viewport'): string {
  const safeName = (projectName || 'du-an').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
  const now = new Date()
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  return `${safeName}-${scope}-${dateStr}.png`
}
