import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { AiAuditEntry } from '../../shared/ai'

const safeId = (val?: string): string => (val || '_global').replace(/[^a-zA-Z0-9._-]/g, '_')

const auditFilePath = (projectId?: string): string => {
  const dir = join(app.getPath('userData'), 'pixelmind-ai', safeId(projectId))
  return join(dir, 'audit.jsonl')
}

export async function recordAudit(
  entry: Omit<AiAuditEntry, 'id' | 'at'> & { at?: number },
): Promise<AiAuditEntry> {
  const fullEntry: AiAuditEntry = {
    id: `audit-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`,
    at: entry.at ?? Date.now(),
    ...entry,
  }

  try {
    const file = auditFilePath(entry.projectId)
    await fs.mkdir(join(file, '..'), { recursive: true })
    await fs.appendFile(file, `${JSON.stringify(fullEntry)}\n`, 'utf8')

    // Đồng thời lưu vào log tổng hợp global nếu là log của dự án cụ thể
    if (entry.projectId) {
      const globalFile = auditFilePath(undefined)
      await fs.mkdir(join(globalFile, '..'), { recursive: true })
      await fs.appendFile(globalFile, `${JSON.stringify(fullEntry)}\n`, 'utf8')
    }
  } catch (err) {
    console.warn('[Audit] Ghi nhật ký thất bại:', err)
  }

  return fullEntry
}

export async function listAuditLogs(projectId?: string): Promise<AiAuditEntry[]> {
  try {
    const file = auditFilePath(projectId)
    const text = await fs.readFile(file, 'utf8')
    const list: AiAuditEntry[] = []
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        list.push(JSON.parse(trimmed) as AiAuditEntry)
      } catch {}
    }
    return list.reverse().slice(0, 100)
  } catch {
    return []
  }
}

export async function clearAuditLogs(projectId?: string): Promise<boolean> {
  try {
    const file = auditFilePath(projectId)
    await fs.unlink(file)
    return true
  } catch {
    return false
  }
}

