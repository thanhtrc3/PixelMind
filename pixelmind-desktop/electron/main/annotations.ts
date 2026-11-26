/* ══════════════════════════════════════════════════════════════
   D2-15: Quản lý Annotation Pins theo dự án
   - Lưu trữ bền vững tại .pixelmind/annotations.json
   - Đảm bảo ghi an toàn (atomic write via temp file + rename)
   ══════════════════════════════════════════════════════════════ */

import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { AnnotationInput, AnnotationPin, AnnotationStoreData } from '../../shared/annotation'

const STORE_FILENAME = 'annotations.json'
const PIXELMIND_DIR = '.pixelmind'

export function getAnnotationsFilePath(projectPath: string): string {
  return join(projectPath, PIXELMIND_DIR, STORE_FILENAME)
}

/**
 * Đọc danh sách annotations từ dự án
 */
export async function listAnnotations(projectPath: string): Promise<AnnotationPin[]> {
  if (!projectPath) return []
  const filePath = getAnnotationsFilePath(projectPath)
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as AnnotationStoreData
    if (parsed && Array.isArray(parsed.annotations)) {
      return parsed.annotations
    }
    return []
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code === 'ENOENT') {
      return []
    }
    console.warn(`[Annotations] Không thể đọc ${filePath}:`, err)
    return []
  }
}

/**
 * Lưu danh sách annotations vào .pixelmind/annotations.json (ghi nguyên tử)
 */
export async function saveAnnotations(
  projectPath: string,
  annotations: AnnotationPin[]
): Promise<{ ok: boolean; count: number; error?: string }> {
  if (!projectPath) {
    return { ok: false, count: 0, error: 'Thiếu đường dẫn dự án' }
  }

  const dirPath = join(projectPath, PIXELMIND_DIR)
  const filePath = join(dirPath, STORE_FILENAME)
  const tempPath = join(dirPath, `${STORE_FILENAME}.${randomUUID()}.tmp`)

  try {
    await fs.mkdir(dirPath, { recursive: true })
    const storeData: AnnotationStoreData = {
      version: 1,
      annotations,
    }
    const jsonStr = JSON.stringify(storeData, null, 2)
    await fs.writeFile(tempPath, jsonStr, 'utf-8')
    await fs.rename(tempPath, filePath)
    return { ok: true, count: annotations.length }
  } catch (err: unknown) {
    try {
      await fs.unlink(tempPath).catch(() => {})
    } catch {}
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[Annotations] Lỗi khi lưu ${filePath}:`, msg)
    return { ok: false, count: 0, error: msg }
  }
}

/**
 * Thêm một Annotation Pin mới vào dự án
 */
export async function addAnnotation(
  projectPath: string,
  input: AnnotationInput
): Promise<{ ok: boolean; annotation?: AnnotationPin; error?: string }> {
  if (!projectPath) return { ok: false, error: 'Thiếu đường dẫn dự án' }

  const current = await listAnnotations(projectPath)
  const now = new Date().toISOString()
  const newPin: AnnotationPin = {
    id: `pin_${Date.now()}_${randomUUID().slice(0, 8)}`,
    projectPath,
    route: input.route || '/',
    xPercent: Math.min(100, Math.max(0, input.xPercent)),
    yPercent: Math.min(100, Math.max(0, input.yPercent)),
    author: input.author?.trim() || 'Bạn',
    content: (input.content || '').trim(),
    resolved: false,
    createdAt: now,
    color: input.color || '#8b5cf6',
  }

  const updated = [newPin, ...current]
  const saveRes = await saveAnnotations(projectPath, updated)
  if (!saveRes.ok) {
    return { ok: false, error: saveRes.error }
  }
  return { ok: true, annotation: newPin }
}

/**
 * Cập nhật nội dung hoặc trạng thái của một Annotation Pin
 */
export async function updateAnnotation(
  projectPath: string,
  pinId: string,
  changes: Partial<Pick<AnnotationPin, 'content' | 'resolved' | 'color'>>
): Promise<{ ok: boolean; annotation?: AnnotationPin; error?: string }> {
  if (!projectPath) return { ok: false, error: 'Thiếu đường dẫn dự án' }

  const current = await listAnnotations(projectPath)
  const index = current.findIndex((p) => p.id === pinId)
  if (index === -1) {
    return { ok: false, error: `Không tìm thấy ghim có mã ${pinId}` }
  }

  const existing = current[index]
  const updatedPin: AnnotationPin = {
    ...existing,
    ...changes,
    content: changes.content !== undefined ? changes.content.trim() : existing.content,
    updatedAt: new Date().toISOString(),
  }

  current[index] = updatedPin
  const saveRes = await saveAnnotations(projectPath, current)
  if (!saveRes.ok) {
    return { ok: false, error: saveRes.error }
  }
  return { ok: true, annotation: updatedPin }
}

/**
 * Xóa một Annotation Pin
 */
export async function deleteAnnotation(
  projectPath: string,
  pinId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!projectPath) return { ok: false, error: 'Thiếu đường dẫn dự án' }

  const current = await listAnnotations(projectPath)
  const next = current.filter((p) => p.id !== pinId)
  if (next.length === current.length) {
    return { ok: false, error: `Không tìm thấy ghim ${pinId}` }
  }

  const saveRes = await saveAnnotations(projectPath, next)
  return { ok: saveRes.ok, error: saveRes.error }
}
