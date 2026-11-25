/* ══════════════════════════════════════════════════════════════
   D2-15: Kiểu dữ liệu và Tiện ích Ghim phản hồi (Annotation Pins)
   - Lưu trữ tọa độ tương đối (%) trên Canvas để giữ đúng vị trí khi resize
   - Hỗ trợ thêm, sửa, resolve/reopen, xóa ghi chú theo dự án
   ══════════════════════════════════════════════════════════════ */

export interface AnnotationPin {
  id: string
  projectPath: string
  route?: string
  xPercent: number // 0 - 100 (% relative to canvas viewport width)
  yPercent: number // 0 - 100 (% relative to canvas viewport height)
  author: string
  content: string
  resolved: boolean
  createdAt: string
  updatedAt?: string
  color?: string // Tuỳ chọn màu đánh dấu ghim (mặc định tím/xanh)
}

export interface AnnotationInput {
  route?: string
  xPercent: number
  yPercent: number
  author?: string
  content: string
  color?: string
}

export interface AnnotationStoreData {
  version: 1
  annotations: AnnotationPin[]
}

/**
 * Tính toán tọa độ tương đối theo phần trăm (%)
 * Đảm bảo giá trị luôn nằm trong khoảng 0% - 100%
 */
export function calculateRelativePosition(
  clientX: number,
  clientY: number,
  containerRect: { left: number; top: number; width: number; height: number }
): { xPercent: number; yPercent: number } {
  if (containerRect.width <= 0 || containerRect.height <= 0) {
    return { xPercent: 50, yPercent: 50 }
  }

  const rawX = ((clientX - containerRect.left) / containerRect.width) * 100
  const rawY = ((clientY - containerRect.top) / containerRect.height) * 100

  // Giới hạn 0 - 100% và làm tròn 2 chữ số thập phân
  const clampedX = Math.min(100, Math.max(0, rawX))
  const clampedY = Math.min(100, Math.max(0, rawY))

  return {
    xPercent: Math.round(clampedX * 100) / 100,
    yPercent: Math.round(clampedY * 100) / 100,
  }
}

/**
 * Chuyển đổi tọa độ % thành pixel tương ứng với kích thước container hiện tại
 */
export function calculateAbsolutePosition(
  xPercent: number,
  yPercent: number,
  containerWidth: number,
  containerHeight: number
): { left: number; top: number } {
  return {
    left: Math.round((xPercent / 100) * containerWidth),
    top: Math.round((yPercent / 100) * containerHeight),
  }
}

/**
 * Lọc danh sách annotations theo điều kiện (route, resolved)
 */
export function filterAnnotations(
  annotations: AnnotationPin[],
  options: {
    route?: string
    showResolved?: boolean
  } = {}
): AnnotationPin[] {
  const { route, showResolved = true } = options

  return annotations.filter((ann) => {
    if (route && ann.route && ann.route !== route) {
      return false
    }
    if (!showResolved && ann.resolved) {
      return false
    }
    return true
  })
}
