import { existsSync, statSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import type { BackupSnapshot } from '../../shared/types'

/* Quản lý Snapshot & Backup định kỳ trong thư mục .pixelmind/backups/ của từng dự án. */

const MAX_BACKUPS_KEEP = 60

function findProjectRoot(fullPath: string, hintProjectPath?: string): string {
  if (hintProjectPath && hintProjectPath.trim()) {
    try {
      const root = resolve(hintProjectPath)
      const target = resolve(fullPath)
      if (
        target.toLowerCase() === root.toLowerCase() ||
        target.toLowerCase().startsWith(root.toLowerCase() + sep)
      ) {
        return root
      }
    } catch {
      // Rơi xuống dò ngược
    }
  }

  let current = dirname(resolve(fullPath))
  for (let i = 0; i < 7; i += 1) {
    if (
      existsSync(join(current, '.pixelmind')) ||
      existsSync(join(current, 'package.json')) ||
      existsSync(join(current, '.git'))
    ) {
      return current
    }
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }

  return dirname(resolve(fullPath))
}

function isInsideRoot(root: string, target: string): boolean {
  const r = resolve(root).toLowerCase()
  const t = resolve(target).toLowerCase()
  return t === r || t.startsWith(r + sep)
}

async function readManifest(backupDir: string): Promise<BackupSnapshot[]> {
  try {
    const raw = await fs.readFile(join(backupDir, 'manifest.json'), 'utf8')
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as BackupSnapshot[]) : []
  } catch {
    return []
  }
}

async function writeManifest(backupDir: string, entries: BackupSnapshot[]): Promise<void> {
  await fs.mkdir(backupDir, { recursive: true })
  await fs.writeFile(join(backupDir, 'manifest.json'), JSON.stringify(entries, null, 2), 'utf8')
}

/** Tạo bản sao lưu trước khi ghi đè tệp thật; trả về đường dẫn tệp .bak nếu tạo thành công. */
export async function createFileBackup(
  fullPath: string,
  projectPath?: string,
  reason: BackupSnapshot['reason'] = 'auto-save',
): Promise<string | undefined> {
  try {
    if (!fullPath || !existsSync(fullPath) || !statSync(fullPath).isFile()) {
      return undefined
    }

    const root = findProjectRoot(fullPath, projectPath)
    const backupDir = join(root, '.pixelmind', 'backups')
    await fs.mkdir(backupDir, { recursive: true })

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = basename(fullPath)
    const dest = join(backupDir, `${fileName}.${stamp}.bak`)
    const originalContent = await fs.readFile(fullPath, 'utf8')
    await fs.writeFile(dest, originalContent, 'utf8')

    const stat = await fs.stat(dest)
    const rel = relative(root, resolve(fullPath)).replace(/\\/g, '/')
    const entry: BackupSnapshot = {
      id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      backupPath: dest,
      fileName,
      originalPath: resolve(fullPath),
      relativePath: rel.startsWith('..') ? fileName : rel,
      size: stat.size,
      createdAt: Date.now(),
      reason,
    }

    const existing = await readManifest(backupDir)
    const next = [entry, ...existing.filter((item) => existsSync(item.backupPath))]
    const pruned = next.slice(MAX_BACKUPS_KEEP)
    for (const stale of pruned) {
      if (stale.backupPath && existsSync(stale.backupPath)) {
        await fs.unlink(stale.backupPath).catch(() => {})
      }
    }
    await writeManifest(backupDir, next.slice(0, MAX_BACKUPS_KEEP))

    return dest
  } catch {
    return undefined
  }
}

export async function listBackups(projectPath: string): Promise<BackupSnapshot[]> {
  if (!projectPath) return []
  const backupDir = join(projectPath, '.pixelmind', 'backups')
  if (!existsSync(backupDir)) return []

  const manifest = await readManifest(backupDir)
  const byBackupPath = new Map<string, BackupSnapshot>()
  for (const item of manifest) {
    if (item.backupPath && existsSync(item.backupPath)) {
      byBackupPath.set(resolve(item.backupPath).toLowerCase(), item)
    }
  }

  // Quét thêm các tệp .bak do toolbox tạo trước đó mà chưa có trong manifest
  try {
    const names = await fs.readdir(backupDir)
    for (const name of names) {
      if (!name.endsWith('.bak')) continue
      const fullBak = join(backupDir, name)
      const key = resolve(fullBak).toLowerCase()
      if (byBackupPath.has(key)) continue
      try {
        const st = await fs.stat(fullBak)
        const guessName = name.replace(/\.\d{4}-\d{2}-\d{2}T[\d-]+Z\.bak$/, '')
        byBackupPath.set(key, {
          id: `bak-${st.mtimeMs}-${name}`,
          backupPath: fullBak,
          fileName: guessName || name,
          originalPath: '',
          relativePath: guessName || name,
          size: st.size,
          createdAt: Math.round(st.mtimeMs),
          reason: 'toolbox',
        })
      } catch {}
    }
  } catch {}

  return [...byBackupPath.values()].sort((a, b) => b.createdAt - a.createdAt)
}

export async function restoreBackup(
  projectPath: string,
  backupPath: string,
  targetPathOverride?: string,
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    if (!projectPath || !backupPath) {
      return { success: false, error: 'Thiếu đường dẫn dự án hoặc bản sao lưu.' }
    }
    const backupDir = join(projectPath, '.pixelmind', 'backups')
    if (!isInsideRoot(backupDir, backupPath)) {
      return { success: false, error: 'Tệp sao lưu không nằm trong thư mục dự án.' }
    }
    if (!existsSync(backupPath)) {
      return { success: false, error: 'Tệp sao lưu không còn tồn tại.' }
    }

    const list = await listBackups(projectPath)
    const matched = list.find(
      (item) => resolve(item.backupPath).toLowerCase() === resolve(backupPath).toLowerCase(),
    )
    const targetPath = targetPathOverride?.trim() || matched?.originalPath || ''
    if (!targetPath) {
      return { success: false, error: 'Không xác định được tệp gốc để khôi phục.' }
    }
    if (!isInsideRoot(projectPath, targetPath)) {
      return { success: false, error: 'Đường dẫn đích nằm ngoài thư mục dự án.' }
    }

    // Lưu thêm 1 bản backup trạng thái hiện tại trước khi ghi đè khôi phục
    await createFileBackup(targetPath, projectPath, 'manual-save')

    const content = await fs.readFile(backupPath, 'utf8')
    await fs.mkdir(dirname(targetPath), { recursive: true })
    await fs.writeFile(targetPath, content, 'utf8')

    return { success: true, path: targetPath }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function clearBackups(projectPath: string): Promise<boolean> {
  if (!projectPath) return false
  const backupDir = join(projectPath, '.pixelmind', 'backups')
  if (!existsSync(backupDir)) return true
  try {
    const names = await fs.readdir(backupDir)
    for (const name of names) {
      if (name.endsWith('.bak') || name === 'manifest.json') {
        await fs.unlink(join(backupDir, name)).catch(() => {})
      }
    }
    return true
  } catch {
    return false
  }
}

