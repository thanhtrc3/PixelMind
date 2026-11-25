/* ══════════════════════════════════════════════════════════════
   D2-20: Backend Quản lý Prototype Interactions
   - Lưu trữ bền vững tại .pixelmind/prototype-interactions.json
   - Đảm bảo ghi nguyên tử (atomic write qua file tạm)
   ══════════════════════════════════════════════════════════════ */

import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { PrototypeInteraction } from '../../shared/prototype'

const STORE_FILENAME = 'prototype-interactions.json'
const PIXELMIND_DIR = '.pixelmind'

interface PrototypeStoreData {
  version: 1
  interactions: PrototypeInteraction[]
}

export function getPrototypeFilePath(projectPath: string): string {
  return join(projectPath, PIXELMIND_DIR, STORE_FILENAME)
}

/**
 * Đọc danh sách prototype interactions từ dự án
 */
export async function listPrototypeInteractions(projectPath: string): Promise<PrototypeInteraction[]> {
  if (!projectPath) return []
  const filePath = getPrototypeFilePath(projectPath)
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as PrototypeStoreData
    if (parsed && Array.isArray(parsed.interactions)) {
      return parsed.interactions
    }
    return []
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code === 'ENOENT') {
      return []
    }
    console.warn(`[Prototype] Không thể đọc ${filePath}:`, err)
    return []
  }
}

/**
 * Lưu danh sách prototype interactions vào .pixelmind/prototype-interactions.json
 */
export async function savePrototypeInteractions(
  projectPath: string,
  interactions: PrototypeInteraction[]
): Promise<{ ok: boolean; count: number; error?: string }> {
  if (!projectPath) {
    return { ok: false, count: 0, error: 'Thiếu đường dẫn dự án' }
  }

  const dirPath = join(projectPath, PIXELMIND_DIR)
  const filePath = join(dirPath, STORE_FILENAME)
  const tempPath = join(dirPath, `${STORE_FILENAME}.${randomUUID()}.tmp`)

  try {
    await fs.mkdir(dirPath, { recursive: true })
    const storeData: PrototypeStoreData = {
      version: 1,
      interactions,
    }
    const jsonStr = JSON.stringify(storeData, null, 2)
    await fs.writeFile(tempPath, jsonStr, 'utf-8')
    await fs.rename(tempPath, filePath)
    return { ok: true, count: interactions.length }
  } catch (err: unknown) {
    try {
      await fs.unlink(tempPath).catch(() => {})
    } catch {}
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[Prototype] Lỗi khi lưu ${filePath}:`, msg)
    return { ok: false, count: 0, error: msg }
  }
}
