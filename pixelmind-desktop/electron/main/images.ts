/* Tối ưu ảnh trong Assets (D1-14) — chạy trong main process.
 *
 * Module thuần Node (không import `electron`) để có thể kiểm thử trực tiếp.
 * Mọi thao tác ghi đều atomic (ghi tệp tạm rồi đổi tên) và không bao giờ
 * ghi đè ảnh gốc nếu người dùng chưa xác nhận.
 */

import { promises as fs } from 'node:fs'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import type { Sharp, SharpOptions } from 'sharp'
import {
  IMAGE_OPTIMIZE_LIMITS,
  IMAGE_SOURCE_EXTENSIONS,
  canReplaceImage,
  imageExtensionFor,
  imageFormatLabel,
  normalizeDimension,
  normalizeQuality,
  resolveOutputFormat,
  savingsRatio,
  suggestedOutputName,
  type ImageApplyOptions,
  type ImageApplyResult,
  type ImageFormat,
  type ImageInfo,
  type ImageInspectResult,
  type ImageOptimizeOptions,
  type ImagePreviewResult,
} from '../../shared/imageOptimize.ts'

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err))

const READABLE_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif', 'gif', 'svg', 'tiff'])

/** Thông báo lỗi thân thiện khi không đọc được ảnh. */
function describeReadError(err: unknown): string {
  const message = errorMessage(err)
  if (/pixel limit|exceeds pixel/i.test(message)) {
    return `Ảnh có độ phân giải quá lớn (giới hạn ${(IMAGE_OPTIMIZE_LIMITS.maxPixels / 1_000_000).toLocaleString('vi-VN')} megapixel).`
  }
  if (/unsupported image format|Input file contains unsupported/i.test(message)) {
    return 'Định dạng ảnh không được hỗ trợ để tối ưu. Hãy dùng PNG, JPG, WebP, AVIF, GIF hoặc SVG.'
  }
  if (/missing|ENOENT/i.test(message)) return 'Không tìm thấy tệp ảnh.'
  return `Không đọc được ảnh: ${message}`
}

function ensureImageExtension(target: string): string | null {
  const extension = extname(target).replace(/^\./, '').toLowerCase()
  return IMAGE_SOURCE_EXTENSIONS.includes(extension) ? extension : null
}

/** Đọc thông tin ảnh: định dạng, kích thước, dung lượng, khung hình. */
export async function inspectImage(target: string): Promise<ImageInspectResult> {
  const path = resolve(target)
  if (!ensureImageExtension(path)) {
    return { ok: false, error: 'Chỉ hỗ trợ tệp ảnh (PNG, JPG, WebP, AVIF, GIF, SVG…).' }
  }

  let stat: Awaited<ReturnType<typeof fs.stat>>
  try {
    stat = await fs.stat(path)
  } catch {
    return { ok: false, error: 'Không tìm thấy tệp ảnh.' }
  }
  if (!stat.isFile()) return { ok: false, error: 'Đường dẫn đã chọn không phải là tệp ảnh.' }
  if (stat.size <= 0) return { ok: false, error: 'Tệp ảnh rỗng (0 byte).' }
  if (stat.size > IMAGE_OPTIMIZE_LIMITS.maxInputBytes) {
    return {
      ok: false,
      error: `Tệp ảnh quá lớn (${Math.round(stat.size / 1024 / 1024)} MB). Giới hạn là ${Math.round(
        IMAGE_OPTIMIZE_LIMITS.maxInputBytes / 1024 / 1024,
      )} MB.`,
    }
  }

  try {
    const meta = await sharp(path, {
      failOn: 'none',
      limitInputPixels: IMAGE_OPTIMIZE_LIMITS.maxPixels,
    }).metadata()

    const format = String(meta.format ?? extname(path).replace(/^\./, '')).toLowerCase()
    const pages = Math.max(1, meta.pages ?? 1)
    const optimizable = READABLE_FORMATS.has(format)
    const info: ImageInfo = {
      path,
      name: basename(path),
      extension: extname(path).replace(/^\./, '').toLowerCase(),
      format,
      size: stat.size,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      hasAlpha: Boolean(meta.hasAlpha),
      animated: pages > 1,
      pages,
      optimizable,
      reason: optimizable
        ? undefined
        : `Định dạng ${imageFormatLabel(format)} chưa được hỗ trợ để tối ưu.`,
    }
    return { ok: true, info }
  } catch (err) {
    return { ok: false, error: describeReadError(err) }
  }
}

interface PipelineOptions {
  path: string
  info: ImageInfo
  target: ImageFormat
  quality: number
  maxWidth?: number
  maxHeight?: number
}

/** Tạo pipeline sharp theo định dạng/chất lượng/kích thước đã chọn. */
function createPipeline(options: PipelineOptions): Sharp {
  const width = normalizeDimension(options.maxWidth)
  const height = normalizeDimension(options.maxHeight)
  const quality = normalizeQuality(options.quality)

  /* Chỉ giữ chuyển động khi định dạng đích hỗ trợ ảnh động. */
  const animated = options.info.animated && (options.target === 'webp' || options.target === 'avif')
  const input: SharpOptions = {
    failOn: 'none',
    limitInputPixels: IMAGE_OPTIMIZE_LIMITS.maxPixels,
    ...(animated ? { animated: true } : {}),
  }

  let image = sharp(options.path, input).rotate()

  if (width || height) {
    image = image.resize({
      width: width || undefined,
      height: height || undefined,
      fit: 'inside',
      withoutEnlargement: true,
    })
  }

  switch (options.target) {
    case 'jpeg':
      return image
        .flatten({ background: '#ffffff' })
        .jpeg({
          quality,
          mozjpeg: true,
          progressive: true,
          chromaSubsampling: quality >= 90 ? '4:4:4' : '4:2:0',
        })
    case 'webp':
      return image.webp({ quality, effort: 4 })
    case 'avif':
      return image.avif({ quality, effort: 4 })
    case 'png':
      return image.png({
        compressionLevel: 9,
        palette: quality < 100,
        quality,
        effort: 8,
      })
    case 'gif':
      return image.gif({
        effort: 7,
        colors: Math.max(2, Math.min(256, Math.round((quality / 100) * 256))),
      })
    default:
      return image
  }
}

/** Resolve định dạng đích và trả lỗi tiếng Việt khi cần người dùng chọn. */
function resolveTarget(
  info: ImageInfo,
  choice: ImageOptimizeOptions['format'],
): { ok: true; target: ImageFormat } | { ok: false; error: string } {
  const target = resolveOutputFormat(info.format, choice)
  if (!target) {
    return {
      ok: false,
      error: `Ảnh ${imageFormatLabel(info.format)} cần chọn định dạng đích (WebP, AVIF, JPEG hoặc PNG).`,
    }
  }
  return { ok: true, target }
}

/** Xem trước kết quả: dung lượng thật sau khi encode + thumbnail nhỏ. */
export async function previewImage(options: ImageOptimizeOptions): Promise<ImagePreviewResult> {
  const inspection = await inspectImage(options.path)
  if (!inspection.ok || !inspection.info) {
    return { ok: false, error: inspection.error ?? 'Không đọc được ảnh.' }
  }
  const info = inspection.info
  if (!info.optimizable) {
    return { ok: false, error: info.reason ?? 'Ảnh không hỗ trợ tối ưu.', source: info }
  }

  const resolved = resolveTarget(info, options.format)
  if (!resolved.ok) {
    return { ok: false, error: resolved.error, source: info }
  }
  const target = resolved.target

  try {
    const { data, info: output } = await createPipeline({
      path: info.path,
      info,
      target,
      quality: options.quality,
      maxWidth: options.maxWidth,
      maxHeight: options.maxHeight,
    }).toBuffer({ resolveWithObject: true })

    const thumbnail = await sharp(data, { failOn: 'none' })
      .resize({
        width: IMAGE_OPTIMIZE_LIMITS.previewThumbSize,
        height: IMAGE_OPTIMIZE_LIMITS.previewThumbSize,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 70 })
      .toBuffer()

    return {
      ok: true,
      source: info,
      output: {
        size: output.size,
        width: output.width,
        height: output.height,
        format: target,
        dataUrl: `data:image/webp;base64,${thumbnail.toString('base64')}`,
        savings: savingsRatio(info.size, output.size),
        outputName: suggestedOutputName(info.name, target),
      },
    }
  } catch (err) {
    return { ok: false, error: describeReadError(err), source: info }
  }
}

/** Tìm tên tệp chưa tồn tại trong thư mục (thêm hậu tố -1, -2…). */
async function uniqueFilePath(dir: string, fileName: string): Promise<string> {
  const extension = extname(fileName)
  const stem = fileName.slice(0, fileName.length - extension.length) || fileName
  let suffix = 0
  for (;;) {
    const candidate = suffix === 0 ? join(dir, fileName) : join(dir, `${stem}-${suffix}${extension}`)
    try {
      await fs.access(candidate)
      suffix += 1
    } catch {
      return candidate
    }
  }
}

/** Đường dẫn an toàn nằm trong thư mục gốc. */
function assertInside(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/**
 * Áp dụng tối ưu ảnh.
 *
 * - `mode: 'new'` → ghi vào `<thư mục ảnh>/optimized/<tên>.<ext>`, không ghi đè.
 * - `mode: 'replace'` → chỉ khi `confirmed === true` và giữ nguyên định dạng;
 *   sao lưu ảnh gốc rồi ghi đè atomic.
 */
export async function applyOptimizedImage(
  options: ImageApplyOptions & { backupDir: string },
): Promise<ImageApplyResult> {
  const inspection = await inspectImage(options.path)
  if (!inspection.ok || !inspection.info) {
    return { ok: false, error: inspection.error ?? 'Không đọc được ảnh.' }
  }
  const info = inspection.info
  if (!info.optimizable) {
    return { ok: false, error: info.reason ?? 'Ảnh không hỗ trợ tối ưu.' }
  }

  const resolved = resolveTarget(info, options.format)
  if (!resolved.ok) return { ok: false, error: resolved.error }
  const target = resolved.target

  const replace = options.mode === 'replace'
  if (replace) {
    if (options.confirmed !== true) {
      return {
        ok: false,
        error: 'Cần xác nhận trước khi thay thế ảnh gốc. Hãy chọn “Tạo tệp mới” nếu muốn giữ nguyên bản gốc.',
      }
    }
    if (!canReplaceImage(info.format, options.format)) {
      return {
        ok: false,
        error: `Chỉ có thể thay thế ảnh gốc khi giữ nguyên định dạng ${imageFormatLabel(
          info.format,
        )}. Đổi định dạng sẽ tạo tệp mới trong thư mục optimized/.`,
      }
    }
  }

  const sourceDir = dirname(info.path)
  let outputPath: string
  if (replace) {
    outputPath = info.path
  } else {
    const inOptimizedFolder = basename(sourceDir).toLowerCase() === 'optimized'
    const outputDir = inOptimizedFolder ? sourceDir : join(sourceDir, 'optimized')
    if (!assertInside(sourceDir, outputDir)) {
      return { ok: false, error: 'Đường dẫn thư mục đầu ra không hợp lệ.' }
    }
    await fs.mkdir(outputDir, { recursive: true })
    outputPath = await uniqueFilePath(outputDir, suggestedOutputName(info.name, target))
  }

  const tempPath = join(
    dirname(outputPath),
    `.pixelmind-image-${randomUUID().slice(0, 8)}.${imageExtensionFor(target)}`,
  )
  let backupPath: string | undefined

  try {
    if (replace) {
      await fs.mkdir(options.backupDir, { recursive: true })
      backupPath = await uniqueFilePath(
        options.backupDir,
        `${Date.now()}-${basename(info.path)}`,
      )
      await fs.copyFile(info.path, backupPath)
    }

    const output = await createPipeline({
      path: info.path,
      info,
      target,
      quality: options.quality,
      maxWidth: options.maxWidth,
      maxHeight: options.maxHeight,
    }).toFile(tempPath)

    await fs.rename(tempPath, outputPath)

    return {
      ok: true,
      outputPath,
      originalPath: info.path,
      originalSize: info.size,
      size: output.size,
      width: output.width,
      height: output.height,
      replaced: replace,
      backupPath,
    }
  } catch (err) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined)
    return {
      ok: false,
      error: `Không tối ưu được ảnh: ${describeReadError(err)}`,
      backupPath,
    }
  }
}

/**
 * Khôi phục ảnh gốc từ bản sao lưu (dùng cho Undo).
 * Chỉ chấp nhận bản sao lưu nằm trong thư mục backup của ứng dụng.
 */
export async function revertOptimizedImage(
  backupPath: string,
  destination: string,
  backupRootDir: string,
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const root = resolve(backupRootDir)
    const backup = resolve(backupPath)
    if (backup !== root && !backup.startsWith(`${root}${sep}`)) {
      return { success: false, error: 'Đường dẫn sao lưu không hợp lệ.' }
    }
    const destinationPath = resolve(destination)
    if (!ensureImageExtension(destinationPath)) {
      return { success: false, error: 'Chỉ có thể khôi phục tệp ảnh.' }
    }

    const stat = await fs.stat(backup)
    if (!stat.isFile()) return { success: false, error: 'Bản sao lưu không tồn tại.' }

    await fs.mkdir(dirname(destinationPath), { recursive: true })
    await fs.copyFile(backup, destinationPath)
    return { success: true, path: destinationPath }
  } catch (err) {
    return { success: false, error: errorMessage(err) }
  }
}
