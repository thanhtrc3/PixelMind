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
