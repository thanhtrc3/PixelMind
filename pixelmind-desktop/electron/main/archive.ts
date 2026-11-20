/* Nhập / xuất dự án ZIP (D1-11, D1-13).
 *
 * Module thuần Node (không import `electron`) để có thể kiểm thử trực tiếp.
 * Mọi tên mục đều được chuẩn hoá qua `sanitizeEntryName` trước khi chạm đĩa,
 * sau đó còn kiểm tra lại đường dẫn tuyệt đối bằng `relative()` (phòng thủ nhiều lớp).
 */

import { createWriteStream, promises as fs } from 'node:fs'
import type { Dirent } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { randomUUID } from 'node:crypto'
import * as yauzl from 'yauzl'
import * as yazl from 'yazl'
import {
  ZIP_IMPORT_LIMITS,
  detectCommonRoot,
  isJunkArchiveEntry,
  sanitizeEntryName,
  shouldExcludeForExport,
  stripRootFolder,
  type ArchiveProgress,
  type ZipEntryInfo,
  type ZipExportResult,
  type ZipInspection,
} from '../../shared/archive.ts'

interface PlannedEntry {
  /** Tên gốc trong ZIP. */
  rawName: string
  /** Tên đã chuẩn hoá (không còn dấu `/` cuối). */
  name: string
  directory: boolean
  size: number
}

interface ZipAnalysis {
  ok: boolean
  error?: string
  warnings: string[]
  entries: PlannedEntry[]
  fileCount: number
  directoryCount: number
  totalBytes: number
  compressedBytes: number
}

const errorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message
  return String(err)
}

/** Thư mục? (dựa trên tên và thuộc tính Unix lưu trong ZIP). */
function isDirectoryEntry(entry: yauzl.Entry): boolean {
  if (entry.fileName.endsWith('/') || entry.fileName.endsWith('\\')) return true
  const mode = (entry.externalFileAttributes >>> 16) & 0o170000
  return mode === 0o040000
}

/** Symlink? Không bao giờ tạo liên kết tượng trưng khi giải nén. */
function isSymlinkEntry(entry: yauzl.Entry): boolean {
  const mode = (entry.externalFileAttributes >>> 16) & 0o170000
  return mode === 0o120000
}

/** Đường dẫn đích phải nằm trong thư mục gốc. */
function assertInside(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

async function analyzeZip(zipPath: string): Promise<ZipAnalysis> {
  const base: ZipAnalysis = {
    ok: false,
    warnings: [],
    entries: [],
    fileCount: 0,
    directoryCount: 0,
    totalBytes: 0,
    compressedBytes: 0,
  }

  let stat: Awaited<ReturnType<typeof fs.stat>>
  try {
    stat = await fs.stat(zipPath)
  } catch {
    return { ...base, error: 'Không tìm thấy tệp ZIP đã chọn.' }
  }
  if (!stat.isFile()) {
    return { ...base, error: 'Đường dẫn đã chọn không phải là tệp.' }
  }
  if (stat.size === 0) {
    return { ...base, error: 'Tệp ZIP rỗng (0 byte).' }
  }

  let zipfile: yauzl.ZipFile
  try {
    zipfile = await yauzl.openPromise(zipPath, {
      decodeStrings: true,
      validateEntrySizes: true,
    })
  } catch (err) {
    return {
      ...base,
      error: `Không đọc được tệp ZIP: ${errorMessage(err)}. Tệp có thể bị hỏng hoặc không đúng định dạng ZIP.`,
    }
  }

  const warnings: string[] = []
  const entries: PlannedEntry[] = []
  const seenNames = new Set<string>()
  let fileCount = 0
  let directoryCount = 0
  let totalBytes = 0
  let skippedSymlinks = 0
  let skippedJunk = 0
  let renamedEntries = 0

  try {
    for await (const entry of zipfile.eachEntry()) {
      if (entries.length >= ZIP_IMPORT_LIMITS.maxEntries) {
        return {
          ...base,
          warnings,
          error: `ZIP chứa quá nhiều mục (giới hạn ${ZIP_IMPORT_LIMITS.maxEntries.toLocaleString('vi-VN')}).`,
        }
      }

      const rawName = entry.fileName
      if (isJunkArchiveEntry(rawName)) {
        skippedJunk += 1
        continue
      }
      if (entry.isEncrypted()) {
        return {
          ...base,
          warnings,
          error: 'Tệp ZIP có mật khẩu hoặc được mã hoá. Vui lòng giải nén và nén lại không đặt mật khẩu.',
        }
      }
      if (!entry.canDecodeFileData()) {
        return {
          ...base,
          warnings,
          error: `ZIP dùng phương thức nén không hỗ trợ (mã ${entry.compressionMethod}). Vui lòng nén lại bằng định dạng chuẩn (deflate).`,
        }
      }
      if (isSymlinkEntry(entry)) {
        skippedSymlinks += 1
        continue
      }

      const safe = sanitizeEntryName(rawName)
      if (!safe.ok || !safe.name) {
        if (safe.fatal) {
          return {
            ...base,
            warnings,
            error: `ZIP chứa mục không an toàn “${rawName}”: ${safe.reason ?? 'không hợp lệ'}. Đã từ chối để bảo vệ máy tính của bạn.`,
          }
        }
        if (safe.reason && safe.reason !== 'mục gốc của ZIP') {
          skippedJunk += 1
        }
        continue
      }
      if (safe.changed) renamedEntries += 1

      const key = safe.name.toLowerCase()
      if (seenNames.has(key)) {
        return {
          ...base,
          warnings,
          error: `ZIP chứa nhiều mục trùng tên “${safe.name}”. Vui lòng nén lại để tránh ghi đè tệp.`,
        }
      }
      seenNames.add(key)

      const directory = isDirectoryEntry(entry)
      const size = directory ? 0 : entry.uncompressedSize
      if (!directory) {
        if (size > ZIP_IMPORT_LIMITS.maxEntryBytes) {
          return {
            ...base,
            warnings,
            error: `Tệp “${safe.name}” quá lớn (${formatBytes(size)}). Giới hạn mỗi tệp là ${formatBytes(ZIP_IMPORT_LIMITS.maxEntryBytes)}.`,
          }
        }
        fileCount += 1
        totalBytes += size
      } else {
        directoryCount += 1
      }

      entries.push({ rawName, name: safe.name, directory, size })
    }
  } catch (err) {
    const message = errorMessage(err)
    /* yauzl tự chặn tên mục tuyệt đối / `..` trước cả khi ta kiểm tra. */
    if (/invalid relative path|absolute path|invalid characters in file ?name|invalid path/i.test(message)) {
      return {
        ...base,
        warnings,
        error: `ZIP chứa mục không an toàn (đường dẫn không hợp lệ): ${message}. Đã từ chối để bảo vệ máy tính của bạn.`,
      }
    }
    return {
      ...base,
      warnings,
      error: `Tệp ZIP bị hỏng hoặc không đọc hết được: ${message}.`,
    }
  } finally {
    zipfile.close()
  }

  if (skippedSymlinks > 0) {
    warnings.push(`Đã bỏ qua ${skippedSymlinks} liên kết tượng trưng (symlink) — không tạo liên kết khi nhập.`)
  }
  if (skippedJunk > 0) {
    warnings.push(`Đã bỏ qua ${skippedJunk} mục rác của hệ điều hành (__MACOSX, .DS_Store, Thumbs.db…).`)
  }
  if (renamedEntries > 0) {
    warnings.push(
      `Đã tự đổi tên ${renamedEntries} mục chứa ký tự Windows không hợp lệ hoặc tên thiết bị dành riêng.`,
    )
  }

  if (fileCount === 0) {
    return { ...base, warnings, error: 'ZIP không chứa tệp nào để nhập thành dự án.' }
  }
  if (totalBytes > ZIP_IMPORT_LIMITS.maxTotalBytes) {
    return {
      ...base,
      warnings,
      error: `Dung lượng sau giải nén (${formatBytes(totalBytes)}) vượt giới hạn ${formatBytes(ZIP_IMPORT_LIMITS.maxTotalBytes)}.`,
    }
  }
  if (
    stat.size > 0 &&
    totalBytes > ZIP_IMPORT_LIMITS.ratioCheckMinBytes &&
    totalBytes / stat.size > ZIP_IMPORT_LIMITS.maxCompressionRatio
  ) {
    return {
      ...base,
      warnings,
      error: `Tỷ lệ nén bất thường (${Math.round(totalBytes / stat.size)}×) — tệp có thể là ZIP bomb. Đã từ chối vì an toàn.`,
    }
  }

  return {
    ok: true,
    warnings,
    entries,
    fileCount,
    directoryCount,
    totalBytes,
    compressedBytes: stat.size,
  }
}

/** Kiểm tra ZIP trước khi nhập: số tệp, dung lượng, thư mục gốc và các cảnh báo an toàn. */
export async function inspectZipFile(zipPath: string): Promise<ZipInspection> {
  const analysis = await analyzeZip(zipPath)
  const rootFolder = analysis.ok
    ? detectCommonRoot(analysis.entries.filter((entry) => !entry.directory).map((entry) => entry.name))
    : undefined

  const preview: ZipEntryInfo[] = analysis.entries
    .slice(0, 40)
    .map((entry) => ({ name: entry.name, size: entry.size, directory: entry.directory }))

  return {
    ok: analysis.ok,
    error: analysis.error,
    zipPath,
    fileCount: analysis.fileCount,
    directoryCount: analysis.directoryCount,
    totalBytes: analysis.totalBytes,
    compressedBytes: analysis.compressedBytes,
    rootFolder,
    entries: preview,
    warnings: analysis.warnings,
  }
}

export interface ExtractZipResult {
  ok: boolean
  error?: string
  fileCount?: number
  warnings?: string[]
}

/**
 * Giải nén ZIP vào `targetDir` sau khi đã kiểm tra an toàn.
 * Không ghi đè tệp có sẵn (cờ `wx`), không tạo symlink, không thoát khỏi `targetDir`.
 */
export async function extractZipSafely(
  zipPath: string,
  targetDir: string,
  options: { stripRoot?: boolean; onProgress?: (progress: ArchiveProgress) => void } = {},
): Promise<ExtractZipResult> {
  const analysis = await analyzeZip(zipPath)
  if (!analysis.ok) {
    return { ok: false, error: analysis.error, warnings: analysis.warnings }
  }

  const root =
    options.stripRoot === false
      ? undefined
      : detectCommonRoot(analysis.entries.filter((entry) => !entry.directory).map((entry) => entry.name))

  const planned = analysis.entries
  const planByRawName = new Map(planned.map((entry) => [entry.rawName, entry]))
  const totalFiles = planned.filter((entry) => !entry.directory).length
  const rootDir = resolve(targetDir)
  await fs.mkdir(rootDir, { recursive: true })

  let zipfile: yauzl.ZipFile
  try {
    zipfile = await yauzl.openPromise(zipPath, {
      autoClose: false,
      decodeStrings: true,
      validateEntrySizes: true,
    })
  } catch (err) {
    return {
      ok: false,
      error: `Không mở lại được tệp ZIP: ${errorMessage(err)}.`,
      warnings: analysis.warnings,
    }
  }

  let writtenFiles = 0
  let writtenBytes = 0

  try {
    for await (const entry of zipfile.eachEntry()) {
      /* Mục rác / symlink / không an toàn đã bị loại ở bước phân tích → bỏ qua. */
      const plan = planByRawName.get(entry.fileName)
      if (!plan) continue

      const finalName = root ? stripRootFolder(plan.name, root) : plan.name
      if (!finalName) continue

      const target = resolve(rootDir, finalName)
      if (!assertInside(rootDir, target)) {
        throw new Error(`Đường dẫn không an toàn: ${plan.name}`)
      }

      if (plan.directory) {
        await fs.mkdir(target, { recursive: true })
        continue
      }

      await fs.mkdir(dirname(target), { recursive: true })
      const stream = await zipfile.openReadStreamPromise(entry)

      stream.on('data', (chunk: Buffer) => {
        writtenBytes += chunk.length
        if (writtenBytes > ZIP_IMPORT_LIMITS.maxTotalBytes) {
          stream.destroy(new Error('Dung lượng giải nén vượt giới hạn an toàn.'))
        }
      })

      await pipeline(stream, createWriteStream(target, { flags: 'wx' }))
      writtenFiles += 1

      options.onProgress?.({
        phase: 'extract',
        processed: writtenFiles,
        total: totalFiles,
        current: finalName,
      })
    }
  } catch (err) {
    return { ok: false, error: `Giải nén thất bại: ${errorMessage(err)}`, warnings: analysis.warnings }
  } finally {
    zipfile.close()
  }

  return { ok: true, fileCount: writtenFiles, warnings: analysis.warnings }
}

interface ExportPlan {
  files: Array<{ abs: string; rel: string; size: number }>
  emptyDirs: string[]
  skipped: number
  totalBytes: number
}

async function planExport(root: string, includeGit: boolean, outputZip: string): Promise<ExportPlan> {
  const files: ExportPlan['files'] = []
  const emptyDirs: string[] = []
  let skipped = 0
  let totalBytes = 0
  const outputAbs = resolve(outputZip).toLowerCase()

  const walk = async (dir: string, relBase: string): Promise<boolean> => {
    let dirents: Dirent[]
    try {
      dirents = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      skipped += 1
      return false
    }

    let hasContent = false

    for (const dirent of dirents) {
      const rel = relBase ? `${relBase}/${dirent.name}` : dirent.name

      if (dirent.isSymbolicLink()) {
        skipped += 1
        continue
      }

      if (dirent.isDirectory()) {
        if (shouldExcludeForExport(rel, includeGit)) {
          skipped += 1
          continue
        }
        const childHasContent = await walk(join(dir, dirent.name), rel)
        if (!childHasContent) emptyDirs.push(rel)
        hasContent = true
        continue
      }

      if (!dirent.isFile()) {
        skipped += 1
        continue
      }
      if (shouldExcludeForExport(rel, includeGit)) {
        skipped += 1
        continue
      }

      const abs = join(dir, dirent.name)
      if (resolve(abs).toLowerCase() === outputAbs) {
        skipped += 1
        continue
      }

      let size = 0
      try {
        const stat = await fs.stat(abs)
        if (!stat.isFile()) {
          skipped += 1
          continue
        }
        size = stat.size
      } catch {
        skipped += 1
        continue
      }

      files.push({ abs, rel, size })
      totalBytes += size
      hasContent = true
    }

    return hasContent
  }

  await walk(root, '')
  return { files, emptyDirs, skipped, totalBytes }
}

function describeWriteError(err: unknown, zipPath: string): string {
  const code = (err as NodeJS.ErrnoException)?.code
  switch (code) {
    case 'EACCES':
    case 'EPERM':
      return 'Không có quyền ghi tệp ZIP vào thư mục đã chọn. Hãy chọn nơi khác hoặc đóng ứng dụng đang giữ tệp.'
    case 'ENOSPC':
      return 'Ổ đĩa không còn đủ dung lượng để ghi tệp ZIP.'
    case 'EROFS':
      return 'Thư mục đã chọn chỉ đọc, không thể ghi tệp ZIP.'
    case 'EBUSY':
      return 'Tệp ZIP đang bị chương trình khác sử dụng. Hãy đóng chương trình đó rồi thử lại.'
    case 'ENOENT':
      return `Không tìm thấy đường dẫn để ghi tệp ZIP (${zipPath}).`
    default:
      return `Không ghi được tệp ZIP: ${errorMessage(err)}`
  }
}

/**
 * Xuất dự án ra ZIP, chỉ đọc mã nguồn — không sửa/Xoá bất kỳ tệp nào của dự án.
 * Ghi ra tệp tạm rồi đổi tên để tránh ZIP dở dang khi lỗi.
 */
export async function exportProjectToZip(options: {
  root: string
  zipPath: string
  includeGit?: boolean
  onProgress?: (progress: ArchiveProgress) => void
}): Promise<ZipExportResult> {
  const root = resolve(options.root)
  const zipPath = resolve(options.zipPath)

  try {
    const stat = await fs.stat(root)
    if (!stat.isDirectory()) {
      return { ok: false, error: 'Đường dẫn dự án không phải là thư mục.' }
    }
  } catch {
    return { ok: false, error: 'Không tìm thấy thư mục dự án để xuất ZIP.' }
  }

  if (!zipPath.toLowerCase().endsWith('.zip')) {
    return { ok: false, error: 'Đường dẫn lưu phải có phần mở rộng .zip.' }
  }

  const plan = await planExport(root, Boolean(options.includeGit), zipPath)
  if (!plan.files.length) {
    return {
      ok: false,
      error: 'Không có tệp nào để xuất sau khi loại trừ dependency, VCS và artifact build.',
      skipped: plan.skipped,
    }
  }

  const tmpPath = `${zipPath}.part-${randomUUID().slice(0, 8)}`

  try {
    await fs.mkdir(dirname(zipPath), { recursive: true })

    const zip = new yazl.ZipFile()
    let added = 0
    options.onProgress?.({ phase: 'compress', processed: 0, total: plan.files.length })
    for (const file of plan.files) {
      zip.addFile(file.abs, file.rel, { compress: true })
      added += 1
      options.onProgress?.({
        phase: 'compress',
        processed: added,
        total: plan.files.length,
        current: file.rel,
      })
    }
    for (const dir of plan.emptyDirs) {
      zip.addEmptyDirectory(`${dir}/`)
    }
    zip.end()

    await pipeline(zip.outputStream as unknown as Readable, createWriteStream(tmpPath))
    await fs.rename(tmpPath, zipPath)

    return {
      ok: true,
      zipPath,
      fileCount: plan.files.length,
      totalBytes: plan.totalBytes,
      skipped: plan.skipped,
    }
  } catch (err) {
    await fs.rm(tmpPath, { force: true }).catch(() => undefined)
    return {
      ok: false,
      error: describeWriteError(err, zipPath),
      skipped: plan.skipped,
    }
  }
}

/** Định dạng dung lượng hiển thị trong thông báo. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, exponent)
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`
}
