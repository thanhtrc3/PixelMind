/* Hợp đồng & quy tắc dùng chung cho tối ưu ảnh trong Assets (D1-14).
   Tệp này KHÔNG import module Node để renderer dùng lại được. */

/** Định dạng ảnh có thể ghi ra. */
export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'gif'

/** Lựa chọn định dạng: giữ nguyên định dạng gốc hoặc đổi sang định dạng cụ thể. */
export type ImageFormatChoice = 'keep' | ImageFormat

export interface ImageInfo {
  path: string
  name: string
  /** Phần mở rộng (không có dấu chấm), đã viết thường. */
  extension: string
  /** Định dạng do thư viện ảnh nhận diện (jpeg, png, webp, avif, gif, svg, tiff…). */
  format: string
  size: number
  width: number
  height: number
  hasAlpha: boolean
  animated: boolean
  pages: number
  /** Có thể tối ưu/đổi định dạng được không. */
  optimizable: boolean
  /** Lý do khi `optimizable === false`. */
  reason?: string
}

export interface ImageInspectResult {
  ok: boolean
  error?: string
  info?: ImageInfo
}

/** Tuỳ chọn tối ưu ảnh (dùng cho cả xem trước và áp dụng). */
export interface ImageOptimizeOptions {
  path: string
  format: ImageFormatChoice
  /** 1–100. Với PNG đây là mức giảm bảng màu; với GIF là số màu tương ứng. */
  quality: number
  /** Chiều rộng tối đa, 0/không đặt = giữ nguyên. */
  maxWidth?: number
  /** Chiều cao tối đa, 0/không đặt = giữ nguyên. */
  maxHeight?: number
}

export interface ImagePreviewOutput {
  size: number
  width: number
  height: number
  format: ImageFormat
  /** Thumbnail nhỏ (data URL) để xem trước kết quả. */
  dataUrl: string
  /** Tỷ lệ tiết kiệm 0..1 (âm nếu tệp mới lớn hơn). */
  savings: number
  outputName: string
}

export interface ImagePreviewResult {
  ok: boolean
  error?: string
  source?: ImageInfo
  output?: ImagePreviewOutput
}

export interface ImageApplyOptions extends ImageOptimizeOptions {
  /** `new` = tạo tệp mới trong optimized/, `replace` = ghi đè ảnh gốc. */
  mode: 'new' | 'replace'
  /** Bắt buộc `true` khi mode = replace (xác nhận của người dùng). */
  confirmed?: boolean
}

export interface ImageApplyResult {
  ok: boolean
  error?: string
  outputPath?: string
  originalPath?: string
  originalSize?: number
  size?: number
  width?: number
  height?: number
  replaced?: boolean
  /** Bản sao lưu ảnh gốc (chỉ có khi replace) để hoàn tác. */
  backupPath?: string
}

/** Giới hạn an toàn khi xử lý ảnh. */
export const IMAGE_OPTIMIZE_LIMITS = {
  /** Tệp đầu vào tối đa (80 MiB). */
  maxInputBytes: 80 * 1024 * 1024,
  /** Tổng số điểm ảnh tối đa (60 MP) để tránh ngốn RAM. */
  maxPixels: 60_000_000,
  /** Cạnh tối đa cho phép khi resize. */
  maxDimension: 20_000,
  /** Kích thước cạnh dài của thumbnail xem trước. */
  previewThumbSize: 480,
  defaultQuality: 80,
} as const

/** Phần mở rộng nguồn được phép đưa vào bộ tối ưu. */
export const IMAGE_SOURCE_EXTENSIONS: readonly string[] = [
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
  'ico',
  'avif',
  'tif',
  'tiff',
]

export const IMAGE_FORMAT_OPTIONS: ReadonlyArray<{
  value: ImageFormatChoice
  label: string
  hint: string
}> = [
  { value: 'keep', label: 'Giữ nguyên', hint: 'Giữ định dạng gốc, chỉ nén lại' },
  { value: 'webp', label: 'WebP', hint: 'Nhỏ gọn, hợp cho web' },
  { value: 'avif', label: 'AVIF', hint: 'Nhỏ nhất, hỗ trợ trình duyệt mới' },
  { value: 'jpeg', label: 'JPEG', hint: 'Phổ biến, không giữ trong suốt' },
  { value: 'png', label: 'PNG', hint: 'Giữ trong suốt, có thể giảm bảng màu' },
]

const FORMAT_LABELS: Record<string, string> = {
  jpeg: 'JPEG',
  jpg: 'JPEG',
  png: 'PNG',
  webp: 'WebP',
  avif: 'AVIF',
  gif: 'GIF',
  svg: 'SVG',
  tiff: 'TIFF',
  tif: 'TIFF',
  bmp: 'BMP',
  ico: 'ICO',
}

/** Nhãn hiển thị của một định dạng. */
export function imageFormatLabel(format: string): string {
  return FORMAT_LABELS[format.toLowerCase()] ?? format.toUpperCase()
}

/** Phần mở rộng tệp tương ứng định dạng đích. */
export function imageExtensionFor(format: ImageFormat): string {
  return format === 'jpeg' ? 'jpg' : format
}

/** Định dạng thực sự sẽ ghi ra, hoặc `null` nếu cần người dùng chọn (SVG/TIFF/BMP/ICO…). */
export function resolveOutputFormat(
  sourceFormat: string,
  choice: ImageFormatChoice,
): ImageFormat | null {
  if (choice !== 'keep') return choice
  const source = sourceFormat.toLowerCase()
  if (source === 'jpg' || source === 'jpeg') return 'jpeg'
  if (source === 'png' || source === 'webp' || source === 'avif' || source === 'gif') {
    return source
  }
  return null
}

/** Có được phép ghi đè ảnh gốc không (chỉ khi giữ nguyên định dạng và là ảnh tĩnh). */
export function canReplaceImage(sourceFormat: string, choice: ImageFormatChoice): boolean {
  const source = sourceFormat.toLowerCase()
  /* GIF/SVG và các định dạng chỉ đọc: luôn tạo tệp mới để tránh mất dữ liệu. */
  if (source === 'gif' || source === 'svg') return false
  const target = resolveOutputFormat(source, choice)
  if (!target) return false
  return target === (source === 'jpg' ? 'jpeg' : source)
}

/** Tên tệp gợi ý khi xuất sang định dạng mới. */
export function suggestedOutputName(sourceName: string, format: ImageFormat): string {
  const dot = sourceName.lastIndexOf('.')
  const stem = dot > 0 ? sourceName.slice(0, dot) : sourceName
  return `${stem}.${imageExtensionFor(format)}`
}

/** Chuẩn hoá chất lượng về số nguyên 1–100. */
export function normalizeQuality(quality: number | undefined): number {
  if (typeof quality !== 'number' || !Number.isFinite(quality)) {
    return IMAGE_OPTIMIZE_LIMITS.defaultQuality
  }
  return Math.min(100, Math.max(1, Math.round(quality)))
}

/** Chuẩn hoá kích thước resize: 0 = không giới hạn. */
export function normalizeDimension(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0
  return Math.min(IMAGE_OPTIMIZE_LIMITS.maxDimension, Math.round(value))
}

/** Tỷ lệ tiết kiệm (0..1), âm nếu tệp mới lớn hơn. */
export function savingsRatio(originalSize: number, nextSize: number): number {
  if (!Number.isFinite(originalSize) || originalSize <= 0) return 0
  return (originalSize - nextSize) / originalSize
}

/** Mô tả ngắn gọn thông số ảnh để hiển thị trong hộp thoại. */
export function describeImage(info: ImageInfo): string {
  const dims = info.width > 0 && info.height > 0 ? `${info.width}×${info.height}` : 'không rõ kích thước'
  return `${imageFormatLabel(info.format)} · ${dims}${info.animated ? ` · ${info.pages} khung hình` : ''}`
}
