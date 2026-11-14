/* ══════════════════════════════════════════════════════════════
   Kho Part tự tạo (D1-16)
   - Lưu bền vào .pixelmind/parts.json (theo dự án) hoặc userData
   - Mỗi Part là một khối HTML/JSX người dùng bôi đen / chọn trên Canvas
   - Kiểm tra mã đáng nghi (chống script độc hại), loại bỏ các rào cản duyệt phiền phức
   - Tự động sinh ảnh preview trực quan chính xác từ mã thật
   ══════════════════════════════════════════════════════════════ */

import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  CustomPartDeleteResult,
  CustomPartInput,
  CustomPartLanguage,
  CustomPartListResult,
  CustomPartSaveResult,
  CustomPartSource,
  CustomToolboxPart,
} from '../../shared/toolbox'

const STORE_FILE = 'custom-parts.json'
const MAX_NAME = 80
const MAX_DESCRIPTION = 500
const MAX_HTML_BYTES = 1024 * 1024

interface StoreFile {
  version: 1
  parts: CustomToolboxPart[]
}

const emptyStore = (): StoreFile => ({ version: 1, parts: [] })

const SUSPICIOUS_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /<script\b[^>]*>([\s\S]*?)<\/script>/i, reason: 'Chứa thẻ <script> thực thi mã JavaScript trực tiếp' },
  { pattern: /javascript:\s*[^\s"'>]/i, reason: 'Chứa giao thức javascript: trong thuộc tính URL' },
  {
    pattern: /\bon(?:error|load|click|mouseover|focus|blur)\s*=\s*["'][^"']*(?:eval|fetch|cookie|sessionStorage|localStorage|XMLHttpRequest)/i,
    reason: 'Chứa trình xử lý sự kiện nội dòng thực thi mã nguy hiểm',
  },
  { pattern: /\beval\s*\(/i, reason: 'Chứa hàm eval() thực thi chuỗi lệnh' },
  { pattern: /\bdocument\.(?:cookie|location\s*=)\b/i, reason: 'Truy cập tài nguyên nhạy cảm document.cookie hoặc điều hướng trang' },
  { pattern: /<iframe\b[^>]*src\s*=\s*["']javascript:/i, reason: 'Chứa thẻ <iframe> nhúng mã javascript:' },
  { pattern: /<(?:object|embed|applet)\b/i, reason: 'Chứa đối tượng nhúng nhị phân (object/embed/applet)' },
]

/**
 * Kiểm tra xem đoạn mã HTML/JSX có chứa thành phần đáng nghi / mã độc hay không.
 * Tinh gọn: chỉ ngăn chặn mã độc thực sự, không cản trở các thuộc tính HTML hợp lệ.
 */
export function inspectSuspiciousCode(code: string): { suspicious: boolean; reasons: string[] } {
  if (!code || typeof code !== 'string') {
    return { suspicious: false, reasons: [] }
  }

  const reasons: string[] = []
  for (const { pattern, reason } of SUSPICIOUS_PATTERNS) {
    if (pattern.test(code)) {
      reasons.push(reason)
    }
  }

  return {
    suspicious: reasons.length > 0,
    reasons,
  }
}

/** Chuẩn hoá HTML thành XHTML hợp lệ để nhúng vào thẻ foreignObject của SVG mà không bị lỗi XML parser. */
export function sanitizeHtmlForXml(html: string): string {
  if (!html) return ''
  const voidTags = ['input', 'img', 'br', 'hr', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr']
  let res = html
  for (const tag of voidTags) {
    const regex = new RegExp(`<(${tag}\\b[^>]*?)(?<!/)>`, 'gi')
    res = res.replace(regex, '<$1 />')
  }
  res = res.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
  res = res.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;')
  return res
}

/**
 * Sinh ảnh preview SVG dạng Data-URI trực quan cho Part từ chính HTML & CSS thật.
 */
export function generatePartPreviewSvg(html: string, css = ''): string {
  const cleanHtml = sanitizeHtmlForXml((html || '').trim().slice(0, 4000))

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="200" viewBox="0 0 360 200">
  <defs>
    <style>
      <![CDATA[
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .preview-host {
          width: 360px;
          height: 200px;
          background: #18181b;
          color: #f4f4f5;
          padding: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        button, input, select, textarea {
          font-family: inherit;
          font-size: inherit;
        }
        ${css}
      ]]>
    </style>
  </defs>
  <rect width="100%" height="100%" fill="#18181b" rx="8" />
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" class="preview-host">
      ${cleanHtml}
    </div>
  </foreignObject>
</svg>`

  const base64 = Buffer.from(svg, 'utf8').toString('base64')
  return `data:image/svg+xml;base64,${base64}`
}

function isStoredPart(value: unknown): value is CustomToolboxPart {
  if (!value || typeof value !== 'object') return false
  const part = value as Partial<CustomToolboxPart>
  return (
    typeof part.id === 'string' &&
    typeof part.name === 'string' &&
    typeof part.html === 'string' &&
    typeof part.createdAt === 'number'
  )
}

function normalizeSource(value: CustomPartSource | undefined): CustomPartSource | undefined {
  if (!value || typeof value.filePath !== 'string' || !value.filePath.trim()) return undefined
  const startLine = Math.max(1, Math.floor(Number(value.startLine) || 1))
  const endLine = Math.max(startLine, Math.floor(Number(value.endLine) || startLine))
  return { filePath: value.filePath.trim(), startLine, endLine }
}

function getStoreDirectory(baseDir: string, projectPath?: string): string {
  if (projectPath && typeof projectPath === 'string' && projectPath.trim()) {
    return join(projectPath.trim(), '.pixelmind')
  }
  return baseDir
}

async function readStoreFromDir(dir: string): Promise<StoreFile> {
  const file = join(dir, STORE_FILE)
  try {
    const raw = await fs.readFile(file, 'utf8')
    const parsed = JSON.parse(raw) as Partial<StoreFile>
    if (!parsed || !Array.isArray(parsed.parts)) return emptyStore()
    return { version: 1, parts: parsed.parts.filter(isStoredPart) }
  } catch (error: any) {
    if (error?.code === 'ENOENT') return emptyStore()
    if (error instanceof SyntaxError) {
      await fs
        .rename(file, `${file}.broken-${Date.now()}`)
        .catch(() => undefined)
      return emptyStore()
    }
    throw error
  }
}

async function writeStoreToDir(dir: string, store: StoreFile): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
  const file = join(dir, STORE_FILE)
  const temp = `${file}.${process.pid}.tmp`
  await fs.writeFile(temp, JSON.stringify(store, null, 2), 'utf8')
  await fs.rename(temp, file)
}

/** Danh sách Part tự tạo (kết hợp cả Part trong dự án và Part toàn cục). */
export async function listCustomParts(
  baseDir: string,
  projectPath?: string,
): Promise<CustomPartListResult> {
  try {
    const partsMap = new Map<string, CustomToolboxPart>()

    // 1. Nạp từ dự án hiện tại (nếu có)
    if (projectPath && projectPath.trim()) {
      const projDir = getStoreDirectory(baseDir, projectPath)
      const projStore = await readStoreFromDir(projDir)
      for (const p of projStore.parts) {
        partsMap.set(p.id, p)
      }
    }

    // 2. Nạp từ kho toàn cục userData
    const globalStore = await readStoreFromDir(baseDir)
    for (const p of globalStore.parts) {
      if (!partsMap.has(p.id)) {
        partsMap.set(p.id, p)
      }
    }

    const parts = Array.from(partsMap.values())
      .map((p) => {
        // Tự động chuẩn hoá SVG preview để đảm bảo XML hợp lệ (tránh lỗi thẻ void tag cũ)
        if (p.preview && p.preview.startsWith('data:image/svg+xml')) {
          p.preview = generatePartPreviewSvg(p.html, p.css)
        }
        return p
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
    return { success: true, parts }
  } catch (error: any) {
    return {
      success: false,
      parts: [],
      error: `Không đọc được kho Part: ${error?.message || 'lỗi không xác định'}`,
    }
  }
}

/** Lưu vùng chọn thành Part mới. */
export async function saveCustomPart(
  baseDir: string,
  input: CustomPartInput,
): Promise<CustomPartSaveResult> {
  const name = String(input?.name ?? '').trim()
  const html = String(input?.html ?? '').trim()
  const description = String(input?.description ?? '').trim()

  if (!name) return { success: false, error: 'Hãy nhập tên cho Part.' }
  if (name.length > MAX_NAME) {
    return { success: false, error: `Tên Part tối đa ${MAX_NAME} ký tự.` }
  }
  if (!html) return { success: false, error: 'Vùng chọn đang trống, không có mã để lưu.' }
  if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) {
    return { success: false, error: 'Vùng chọn quá lớn (tối đa 1 MB). Hãy chọn đoạn ngắn hơn.' }
  }

  // Quét mã nguy hiểm
  const inspection = inspectSuspiciousCode(html)
  if (inspection.suspicious) {
    return {
      success: false,
      error: `Phát hiện mã đáng nghi: ${inspection.reasons.join('; ')}. Vui lòng gỡ bỏ các đoạn script không an toàn trước khi lưu.`,
    }
  }

  const language: CustomPartLanguage = input?.language === 'jsx' ? 'jsx' : 'html'
  const now = Date.now()
  const preview = input?.preview || generatePartPreviewSvg(html, input?.css)

  const part: CustomToolboxPart = {
    id: `part_${now.toString(36)}_${randomUUID().slice(0, 8)}`,
    name,
    description: description.slice(0, MAX_DESCRIPTION),
    html,
    css: input?.css,
    preview,
    language,
    tags: input?.tags && input.tags.length > 0 ? input.tags : ['custom', language],
    source: normalizeSource(input?.source),
    projectPath: typeof input?.projectPath === 'string' ? input.projectPath.trim() || undefined : undefined,
    createdAt: now,
    updatedAt: now,
  }

  try {
    const targetDir = getStoreDirectory(baseDir, input?.projectPath)
    const store = await readStoreFromDir(targetDir)
    store.parts.unshift(part)
    await writeStoreToDir(targetDir, store)

    // Nếu lưu theo dự án, đồng thời lưu một bản sao vào kho toàn cục để tái sử dụng xuyên dự án
    if (targetDir !== baseDir) {
      try {
        const globalStore = await readStoreFromDir(baseDir)
        globalStore.parts = [part, ...globalStore.parts.filter((p) => p.id !== part.id)]
        await writeStoreToDir(baseDir, globalStore)
      } catch {
        // bỏ qua lỗi lưu phụ toàn cục
      }
    }

    return { success: true, part }
  } catch (error: any) {
    return { success: false, error: `Không lưu được Part: ${error?.message || 'lỗi không xác định'}` }
  }
}

/** Xoá một Part tự tạo theo id. */
export async function deleteCustomPart(
  baseDir: string,
  id: string,
  projectPath?: string,
): Promise<CustomPartDeleteResult> {
  if (!id || typeof id !== 'string') {
    return { success: false, error: 'Thiếu mã Part cần xoá.' }
  }
  try {
    // Thử xoá trong dự án trước nếu có
    if (projectPath && projectPath.trim()) {
      const projDir = getStoreDirectory(baseDir, projectPath)
      const projStore = await readStoreFromDir(projDir)
      const next = projStore.parts.filter((part) => part.id !== id)
      if (next.length !== projStore.parts.length) {
        await writeStoreToDir(projDir, { ...projStore, parts: next })
        return { success: true }
      }
    }

    // Sau đó thử xoá trong kho toàn cục
    const globalStore = await readStoreFromDir(baseDir)
    const nextGlobal = globalStore.parts.filter((part) => part.id !== id)
    if (nextGlobal.length !== globalStore.parts.length) {
      await writeStoreToDir(baseDir, { ...globalStore, parts: nextGlobal })
      return { success: true }
    }

    return { success: false, error: 'Không tìm thấy Part này trong kho.' }
  } catch (error: any) {
    return { success: false, error: `Không xoá được Part: ${error?.message || 'lỗi không xác định'}` }
  }
}
