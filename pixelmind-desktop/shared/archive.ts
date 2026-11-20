/* Hợp đồng & quy tắc dùng chung cho nhập/xuất dự án ZIP (D1-11, D1-13).
   Tệp này KHÔNG được import module Node (fs/path…) để renderer dùng lại được. */

import type { ProjectRecord } from './types.ts'

/** Thư mục quản lý phiên bản — chỉ loại trừ khi người dùng không chọn kèm `.git`. */
export const EXPORT_VCS_DIRS = ['.git', '.svn', '.hg'] as const

/** Thư mục dependency / artifact build luôn loại trừ khi xuất ZIP. */
export const EXPORT_EXCLUDED_DIRS: readonly string[] = [
  'node_modules',
  'bower_components',
  'jspm_packages',
  '.vs',
  '.idea',
  '.dart_tool',
  '.pub-cache',
  'bin',
  'obj',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.output',
  '.vercel',
  '.netlify',
  '.turbo',
  '.cache',
  '.parcel-cache',
  'coverage',
  'release',
  'vendor',
  '__pycache__',
  '.venv',
  'venv',
  '.pytest_cache',
  '.mypy_cache',
  'target',
  '.pixelmind',
]

/** Tệp rác hệ điều hành luôn loại trừ khi xuất ZIP. */
export const EXPORT_EXCLUDED_FILES: readonly string[] = ['.ds_store', 'thumbs.db', 'desktop.ini']

/** Giới hạn an toàn khi nhập ZIP, chống ZIP bomb và cây thư mục quá lớn. */
export const ZIP_IMPORT_LIMITS = {
  /** Số mục tối đa trong ZIP. */
  maxEntries: 25_000,
  /** Tổng dung lượng sau giải nén tối đa (2 GiB). */
  maxTotalBytes: 2 * 1024 * 1024 * 1024,
  /** Một tệp đơn lẻ tối đa (1 GiB). */
  maxEntryBytes: 1024 * 1024 * 1024,
  /** Tỷ lệ nén tối đa trước khi coi là ZIP bomb (chỉ áp dụng cho ZIP > 32 MiB). */
  maxCompressionRatio: 250,
  /** Ngưỡng dung lượng để bắt đầu kiểm tra tỷ lệ nén. */
  ratioCheckMinBytes: 32 * 1024 * 1024,
  /** Độ dài đường dẫn tương đối tối đa. */
  maxPathLength: 400,
  /** Số tầng thư mục tối đa. */
  maxDepth: 32,
} as const

export type ArchivePhase = 'inspect' | 'extract' | 'compress'

/** Tiến trình nhập/xuất để renderer hiển thị. */
export interface ArchiveProgress {
  phase: ArchivePhase
  processed: number
  total: number
  /** Tệp đang xử lý (đường dẫn tương đối). */
  current?: string
}

export interface ZipEntryInfo {
  name: string
  size: number
  directory: boolean
}

/** Kết quả kiểm tra trước khi giải nén (hiển thị trong hộp thoại nhập ZIP). */
export interface ZipInspection {
  ok: boolean
  error?: string
  zipPath?: string
  fileCount: number
  directoryCount: number
  /** Tổng dung lượng sau giải nén (byte). */
  totalBytes: number
  /** Dung lượng tệp ZIP trên đĩa (byte). */
  compressedBytes: number
  /** Thư mục gốc chung có thể bỏ đi khi giải nén. */
  rootFolder?: string
  /** Trích đoạn danh sách mục để xem trước. */
  entries: ZipEntryInfo[]
  warnings: string[]
}

export interface ZipImportOptions {
  zipPath: string
  parentDir: string
  /** Tên thư mục dự án sẽ tạo; bỏ trống thì lấy theo tên tệp ZIP. */
  projectName?: string
  /** Bỏ lớp thư mục gốc chung (mặc định bật). */
  stripRoot?: boolean
}

export interface ZipImportResult {
  ok: boolean
  error?: string
  projectPath?: string
  project?: ProjectRecord
  fileCount?: number
  warnings?: string[]
}

export interface ZipExportOptions {
  projectId: string
  zipPath: string
  /** Kèm thư mục `.git` vào ZIP (mặc định không). */
  includeGit?: boolean
}

export interface ZipExportResult {
  ok: boolean
  error?: string
  zipPath?: string
  fileCount?: number
  totalBytes?: number
  /** Số mục bị bỏ qua do nằm trong danh sách loại trừ / là symlink. */
  skipped?: number
}

export interface SafeEntryName {
  ok: boolean
  /** Tên đã chuẩn hoá, dùng dấu `/`. */
  name?: string
  /** Entry là thư mục (tên gốc kết thúc bằng `/`). */
  directory?: boolean
  /** Đã tự sửa tên để hợp lệ trên Windows. */
  changed?: boolean
  /** Lý do từ chối/bỏ qua. */
  reason?: string
  /** `true` = ZIP không an toàn (chặn cả tệp); `false` = chỉ bỏ qua mục này. */
  fatal?: boolean
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/
const WINDOWS_ILLEGAL_CHARS = /[<>"|?*]/g
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i

/**
 * Chuẩn hoá và kiểm tra một tên mục trong ZIP.
 *
 * - Chặn tuyệt đối: đường dẫn tuyệt đối, UNC, ổ đĩa (`C:`), `..`, NTFS ADS (`file:stream`),
 *   ký tự điều khiển, đường dẫn quá dài/quá sâu.
 * - Tự sửa (kèm cảnh báo): ký tự Windows không hợp lệ, tên thiết bị dành riêng, dấu chấm/khoảng trắng cuối.
 * - Bỏ qua: entry rỗng hoặc thư mục gốc `/`.
 */
export function sanitizeEntryName(rawName: string): SafeEntryName {
  if (!rawName || !rawName.trim()) {
    return { ok: false, fatal: false, reason: 'Tên mục rỗng.' }
  }

  const normalized = rawName.replace(/\\/g, '/').normalize('NFC')

  if (normalized.startsWith('//')) {
    return { ok: false, fatal: true, reason: 'đường dẫn mạng (UNC) không được phép' }
  }
  if (normalized.startsWith('/')) {
    return { ok: false, fatal: true, reason: 'đường dẫn tuyệt đối không được phép' }
  }
  if (/^[a-zA-Z]:/.test(normalized)) {
    return { ok: false, fatal: true, reason: 'đường dẫn ổ đĩa không được phép' }
  }
  if (CONTROL_CHARS.test(normalized)) {
    return { ok: false, fatal: true, reason: 'chứa ký tự điều khiển' }
  }
  if (normalized.length > ZIP_IMPORT_LIMITS.maxPathLength) {
    return { ok: false, fatal: true, reason: 'đường dẫn quá dài' }
  }

  const directory = normalized.endsWith('/')
  const segments: string[] = []
  let changed = false

  for (const rawSegment of normalized.split('/')) {
    if (!rawSegment) continue
    if (rawSegment === '.') {
      changed = true
      continue
    }
    if (rawSegment === '..') {
      return { ok: false, fatal: true, reason: 'chứa đoạn “..” (path traversal)' }
    }
    if (rawSegment.includes(':')) {
      return { ok: false, fatal: true, reason: 'chứa dấu “:” (luồng dữ liệu NTFS không được phép)' }
    }

    let segment = rawSegment
    const trimmed = segment.replace(/[. ]+$/, '')
    if (trimmed !== segment) {
      segment = trimmed
      changed = true
    }
    const cleaned = segment.replace(WINDOWS_ILLEGAL_CHARS, '_')
    if (cleaned !== segment) {
      segment = cleaned
      changed = true
    }
    if (!segment) {
      /* Tên chỉ gồm dấu chấm/khoảng trắng → bỏ qua mục này. */
      changed = true
      continue
    }
    if (WINDOWS_RESERVED_NAME.test(segment)) {
      segment = `_${segment}`
      changed = true
    }
    segments.push(segment)
  }

  if (!segments.length) {
    return { ok: false, fatal: false, reason: 'mục gốc của ZIP' }
  }
  if (segments.length > ZIP_IMPORT_LIMITS.maxDepth) {
    return { ok: false, fatal: true, reason: 'cây thư mục quá sâu' }
  }

  return { ok: true, name: segments.join('/'), directory, changed }
}

/** Mục rác do macOS/Windows sinh ra, luôn bỏ qua khi nhập. */
export function isJunkArchiveEntry(name: string): boolean {
  const normalized = name.replace(/\\/g, '/')
  if (normalized.startsWith('__MACOSX/')) return true
  const base = normalized.split('/').pop()?.toLowerCase() ?? ''
  return (
    base === '.ds_store' ||
    base === 'thumbs.db' ||
    base === 'desktop.ini' ||
    base.startsWith('._')
  )
}

/**
 * Phát hiện lớp thư mục gốc chung của ZIP (ví dụ `my-app/src`, `my-app/package.json`).
 * Trả về `undefined` nếu ZIP có tệp nằm ngay gốc.
 */
export function detectCommonRoot(filePaths: string[]): string | undefined {
  const files = filePaths.filter(Boolean)
  if (!files.length) return undefined
  const segments = files.map((file) => file.split('/'))
  if (segments.some((parts) => parts.length < 2)) return undefined
  const root = segments[0][0]
  if (!root) return undefined
  return segments.every((parts) => parts[0] === root) ? root : undefined
}

/** Bỏ lớp thư mục gốc khỏi đường dẫn tương đối. */
export function stripRootFolder(name: string, root: string): string {
  if (name === root) return ''
  return name.startsWith(`${root}/`) ? name.slice(root.length + 1) : name
}

/** Quy tắc loại trừ khi xuất ZIP (áp dụng cho mọi tầng thư mục). */
export function shouldExcludeForExport(relPath: string, includeGit = false): boolean {
  const normalized = relPath.replace(/\\/g, '/')
  const segments = normalized.split('/').filter(Boolean)
  if (!segments.length) return false

  const excludedDirs = new Set<string>(EXPORT_EXCLUDED_DIRS)
  const vcsDirs = new Set<string>(EXPORT_VCS_DIRS)

  for (const segment of segments) {
    const lower = segment.toLowerCase()
    if (vcsDirs.has(lower)) {
      /* `.svn`/`.hg` luôn loại trừ; `.git` chỉ loại trừ khi không chọn kèm. */
      if (lower !== '.git' || !includeGit) return true
      continue
    }
    if (excludedDirs.has(lower)) return true
  }

  const base = segments[segments.length - 1].toLowerCase()
  return EXPORT_EXCLUDED_FILES.includes(base)
}
