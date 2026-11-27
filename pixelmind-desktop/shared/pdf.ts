/* ══════════════════════════════════════════════════════════════
   D2-17: Cấu hình và Tiện ích Xuất trang ra PDF
   - Hỗ trợ các khổ giấy: A4, A3, Letter, Legal
   - Hướng trang: Dọc (Portrait) / Ngang (Landscape)
   - Tùy chọn lề và in nền màu thiết kế
   ══════════════════════════════════════════════════════════════ */

export type PdfPageSize = 'A4' | 'A3' | 'Letter' | 'Legal'
export type PdfMarginType = 'default' | 'none' | 'minimal'

export interface PdfExportOptions {
  pageSize?: PdfPageSize
  landscape?: boolean
  printBackground?: boolean
  marginType?: PdfMarginType
  scale?: number
}

export interface PdfExportParams {
  url?: string
  html?: string
  projectName?: string
  route?: string
  options?: PdfExportOptions
}

export interface PdfExportResult {
  canceled: boolean
  filePath?: string
  error?: string
  bytes?: number
}

/**
 * Chuẩn hóa các tùy chọn in PDF
 */
export function normalizePdfOptions(options?: PdfExportOptions): Required<PdfExportOptions> {
  return {
    pageSize: options?.pageSize || 'A4',
    landscape: Boolean(options?.landscape),
    printBackground: options?.printBackground !== false, // Mặc định true để giữ màu nền
    marginType: options?.marginType || 'default',
    scale: Math.max(0.5, Math.min(2.0, options?.scale || 1.0)),
  }
}

/**
 * Chuyển đổi marginType sang cấu hình lề Chromium tương ứng
 */
export function getMarginsForPrint(marginType: PdfMarginType): {
  marginType: 'default' | 'none' | 'printableArea' | 'custom'
  top?: number
  bottom?: number
  left?: number
  right?: number
} {
  switch (marginType) {
    case 'none':
      return { marginType: 'none' }
    case 'minimal':
      return {
        marginType: 'custom',
        top: 0.2, // inches (~5mm)
        bottom: 0.2,
        left: 0.2,
        right: 0.2,
      }
    case 'default':
    default:
      return { marginType: 'default' }
  }
}

/**
 * Tính toán kích thước trang in tiêu chuẩn (pixels ở 96 DPI)
 */
export function getPaperDimensions(pageSize: PdfPageSize, landscape: boolean): { width: number; height: number } {
  let w = 8.27
  let h = 11.69
  if (pageSize === 'A3') {
    w = 11.69
    h = 16.54
  } else if (pageSize === 'Letter') {
    w = 8.5
    h = 11.0
  } else if (pageSize === 'Legal') {
    w = 8.5
    h = 14.0
  }
  const pw = landscape ? h : w
  const ph = landscape ? w : h
  return {
    width: Math.round(pw * 96 * 10) / 10,
    height: Math.round(ph * 96 * 10) / 10,
  }
}

/**
 * Tự động tính toán tỷ lệ scale trang in để không bao giờ bị cắt mất phần tử bên phải
 */
export function calculatePrintScale(
  pageSize: PdfPageSize,
  landscape: boolean,
  marginType: PdfMarginType,
  contentWidth: number,
  userScale?: number
): number {
  if (typeof userScale === 'number' && userScale !== 1.0) {
    return Math.max(0.4, Math.min(2.0, userScale))
  }
  const paper = getPaperDimensions(pageSize, landscape)
  const marginLoss = marginType === 'none' ? 0 : marginType === 'minimal' ? 38.4 : 76.8
  const printableWidth = Math.max(200, paper.width - marginLoss)

  if (contentWidth > printableWidth) {
    const autoScale = Math.round((printableWidth / contentWidth) * 100) / 100
    return Math.max(0.4, Math.min(1.0, autoScale))
  }
  return 1.0
}

/**
 * Tạo tên file xuất PDF thân thiện và an toàn
 */
export function formatPdfFilename(
  projectName?: string,
  route?: string,
  pageSize: PdfPageSize = 'A4',
  landscape: boolean = false
): string {
  const safeProject = (projectName || 'du-an').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
  const safeRoute = (route || 'trang')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-') || 'trang-chu'

  const orientation = landscape ? 'ngang' : 'doc'
  const now = new Date()
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`

  return `${safeProject}-${safeRoute}-${pageSize}-${orientation}-${dateStr}.pdf`
}
