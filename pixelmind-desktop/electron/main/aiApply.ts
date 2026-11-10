import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  AiChange,
  AiDiffLine,
  AiProposeChangeRequest,
} from '../../shared/ai'
import { resolveProjectPath, toPosix } from './aiSafe'
import { recordAudit } from './aiAudit'

/* Áp dụng tệp an toàn có cơ chế thử lại (Retry) khi gặp File Lock do dotnet watch hoặc IDE đang chiếm giữ */
async function writeFileWithRetry(
  filePath: string,
  content: string,
  maxRetries = 4,
  delayMs = 150,
): Promise<void> {
  let lastErr: unknown
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      await fs.writeFile(filePath, content, 'utf8')
      return
    } catch (err: unknown) {
      lastErr = err
      const code = (err as { code?: string })?.code
      if (code === 'EBUSY' || code === 'EPERM' || code === 'EACCES') {
        await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(1.5, attempt)))
        continue
      }
      throw err
    }
  }
  throw lastErr
}

/* Apply Engine + Change Journal.
   Luồng: đề xuất (ghi snapshot, chưa chạm mã nguồn) → người dùng duyệt → ghi tệp → log.
   Journal nằm trong userData/pixelmind-ai/<projectId>/, không bao giờ trong dự án. */

const MAX_DIFF_LINES = 400
const CONTEXT_LINES = 2

const safeId = (value: string): string => (value || 'global').replace(/[^a-zA-Z0-9._-]/g, '_')

const projectDir = (projectId: string): string =>
  join(app.getPath('userData'), 'pixelmind-ai', safeId(projectId))

const changesDir = (projectId: string): string => join(projectDir(projectId), 'changes')
const snapshotsDir = (projectId: string): string => join(projectDir(projectId), 'snapshots')
const journalPath = (projectId: string): string => join(projectDir(projectId), 'changes.jsonl')

const ensureDirs = async (projectId: string): Promise<void> => {
  await fs.mkdir(changesDir(projectId), { recursive: true })
  await fs.mkdir(snapshotsDir(projectId), { recursive: true })
}

const changePath = (projectId: string, changeId: string): string =>
  join(changesDir(projectId), `${safeId(changeId)}.json`)

const snapshotPath = (projectId: string, changeId: string, side: 'before' | 'after'): string =>
  join(snapshotsDir(projectId), `${safeId(changeId)}.${side}`)

const appendEvent = async (projectId: string, event: Record<string, unknown>): Promise<void> => {
  await fs.mkdir(projectDir(projectId), { recursive: true })
  await fs.appendFile(journalPath(projectId), `${JSON.stringify({ at: Date.now(), ...event })}\n`, 'utf8')
}

const writeChange = async (change: AiChange): Promise<void> => {
  await ensureDirs(change.projectId)
  const file = changePath(change.projectId, change.id)
  const tmp = `${file}.${process.pid}.tmp`
  await fs.writeFile(tmp, JSON.stringify(change, null, 2), 'utf8')
  await fs.rename(tmp, file)
}

const readChange = async (projectId: string, changeId: string): Promise<AiChange> => {
  const raw = await fs.readFile(changePath(projectId, changeId), 'utf8')
  return JSON.parse(raw) as AiChange
}

/* ───────────────────────── Diff ───────────────────────── */

const splitLines = (text: string): string[] => text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

interface Op {
  kind: 'add' | 'del' | 'ctx'
  text: string
}

const lcsOps = (before: string[], after: string[]): Op[] => {
  const n = before.length
  const m = after.length
  if (n * m > 4_000_000) {
    // Tệp quá lớn: đối chiếu theo dòng thô để tránh treo main process.
    const ops: Op[] = []
    const max = Math.max(n, m)
    for (let i = 0; i < max; i += 1) {
      if (i >= n) ops.push({ kind: 'add', text: after[i] })
      else if (i >= m) ops.push({ kind: 'del', text: before[i] })
      else if (before[i] === after[i]) ops.push({ kind: 'ctx', text: before[i] })
      else {
        ops.push({ kind: 'del', text: before[i] })
        ops.push({ kind: 'add', text: after[i] })
      }
    }
    return ops
  }

  const width = m + 1
  const table = new Uint32Array((n + 1) * width)
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        before[i] === after[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1])
    }
  }

  const ops: Op[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      ops.push({ kind: 'ctx', text: before[i] })
      i += 1
      j += 1
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      ops.push({ kind: 'del', text: before[i] })
      i += 1
    } else {
      ops.push({ kind: 'add', text: after[j] })
      j += 1
    }
  }
  while (i < n) {
    ops.push({ kind: 'del', text: before[i] })
    i += 1
  }
  while (j < m) {
    ops.push({ kind: 'add', text: after[j] })
    j += 1
  }
  return ops
}

export function buildDiff(beforeText: string, afterText: string): { diff: AiDiffLine[]; added: number; removed: number } {
  const before = splitLines(beforeText)
  const after = splitLines(afterText)
  const ops = lcsOps(before, after)
  const added = ops.filter((op) => op.kind === 'add').length
  const removed = ops.filter((op) => op.kind === 'del').length

  // Gom các khối thay đổi kèm ngữ cảnh xung quanh.
  const changed = ops
    .map((op, index) => (op.kind === 'ctx' ? -1 : index))
    .filter((index) => index >= 0)
  if (changed.length === 0) {
    return { diff: [{ kind: 'ctx', text: 'Không có thay đổi nội dung.' }], added: 0, removed: 0 }
  }

  const ranges: Array<[number, number]> = []
  for (const index of changed) {
    const start = Math.max(0, index - CONTEXT_LINES)
    const end = Math.min(ops.length - 1, index + CONTEXT_LINES)
    const last = ranges[ranges.length - 1]
    if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end)
    else ranges.push([start, end])
  }

  const diff: AiDiffLine[] = []
  let oldLine = 1
  let newLine = 1
  let cursor = 0
  for (const [start, end] of ranges) {
    for (; cursor < start; cursor += 1) {
      if (ops[cursor].kind === 'add') newLine += 1
      else {
        oldLine += 1
        if (ops[cursor].kind === 'ctx') newLine += 1
      }
    }
    let oldCount = 0
    let newCount = 0
    for (let index = start; index <= end; index += 1) {
      if (ops[index].kind === 'add') newCount += 1
      else {
        oldCount += 1
        if (ops[index].kind === 'ctx') newCount += 1
      }
    }
    diff.push({ kind: 'hunk', text: `@@ -${oldLine},${oldCount} +${newLine},${newCount} @@` })
    for (let index = start; index <= end; index += 1) {
      diff.push({ kind: ops[index].kind, text: ops[index].text })
    }
    oldLine += oldCount
    newLine += newCount
    cursor = end + 1
    if (diff.length > MAX_DIFF_LINES) {
      diff.push({ kind: 'ctx', text: `… diff đã được rút gọn (quá ${MAX_DIFF_LINES} dòng).` })
      break
    }
  }

  return { diff, added, removed }
}

/* ───────────────────────── Journal ───────────────────────── */

export async function listChanges(projectId: string): Promise<AiChange[]> {
  const dir = changesDir(projectId)
  let files: string[] = []
  try {
    files = (await fs.readdir(dir)).filter((name) => name.endsWith('.json'))
  } catch {
    return []
  }
  const changes: AiChange[] = []
  for (const name of files) {
    try {
      changes.push(JSON.parse(await fs.readFile(join(dir, name), 'utf8')) as AiChange)
    } catch {
      // Bỏ qua bản ghi hỏng, không làm sập UI.
    }
  }
  return changes.sort((a, b) => b.createdAt - a.createdAt)
}

export async function proposeChange(request: AiProposeChangeRequest): Promise<AiChange> {
  const root = request.projectPath
  if (!root) throw new Error('Thiếu đường dẫn dự án.')
  const fullPath = resolveProjectPath(root, request.file)
  const rel = toPosix(relative(root, fullPath))

  let before = ''
  try {
    before = await fs.readFile(fullPath, 'utf8')
  } catch {
    before = ''
  }

  const { diff, added, removed } = buildDiff(before, request.content)
  const id = `chg-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`
  const change: AiChange = {
    id,
    projectId: request.projectId,
    file: rel,
    fullPath,
    summary: request.summary,
    added,
    removed,
    status: 'pending',
    diff,
    createdAt: Date.now(),
    task: request.task,
  }

  await ensureDirs(request.projectId)
  await fs.writeFile(snapshotPath(request.projectId, id, 'before'), before, 'utf8')
  await fs.writeFile(snapshotPath(request.projectId, id, 'after'), request.content, 'utf8')
  await writeChange(change)
  await appendEvent(request.projectId, { event: 'proposed', id, file: rel, added, removed })
  return change
}

const updateStatus = async (
  projectId: string,
  changeId: string,
  patch: Partial<AiChange>,
): Promise<AiChange> => {
  const change = await readChange(projectId, changeId)
  const updated = { ...change, ...patch }
  await writeChange(updated)
  return updated
}

export async function acceptChange(projectId: string, changeId: string): Promise<AiChange[]> {
  const change = await readChange(projectId, changeId)
  if (change.status !== 'pending') throw new Error('Thay đổi này không còn chờ duyệt.')

  const after = await fs.readFile(snapshotPath(projectId, changeId, 'after'), 'utf8')
  await fs.mkdir(dirname(change.fullPath), { recursive: true })
  // Snapshot "before" đã ghi lúc đề xuất; ghi tệp thật với cơ chế retry chống file lock (dotnet watch).
  await writeFileWithRetry(change.fullPath, after)
  await updateStatus(projectId, changeId, { status: 'accepted', appliedAt: Date.now() })
  await appendEvent(projectId, { event: 'accepted', id: changeId, file: change.file })
  void recordAudit({
    type: 'patch',
    summary: `Áp dụng thay đổi cho tệp: ${change.file}`,
    ok: true,
    projectId,
    detail: `+${change.added} -${change.removed} dòng | ${change.summary || 'Không có mô tả'}`,
  })
  return listChanges(projectId)
}

export async function rejectChange(projectId: string, changeId: string): Promise<AiChange[]> {
  const change = await readChange(projectId, changeId)
  if (change.status !== 'pending') throw new Error('Chỉ có thể từ chối thay đổi đang chờ duyệt.')

  // Xoá khỏi hàng đợi: bỏ bản ghi + snapshot, nhưng vẫn giữ sự kiện trong changes.jsonl để audit.
  await fs.rm(changePath(projectId, changeId), { force: true })
  await fs.rm(snapshotPath(projectId, changeId, 'before'), { force: true })
  await fs.rm(snapshotPath(projectId, changeId, 'after'), { force: true })
  await appendEvent(projectId, { event: 'rejected', id: changeId, file: change.file })
  void recordAudit({
    type: 'patch',
    summary: `Từ chối thay đổi tệp: ${change.file}`,
    ok: true,
    projectId,
    detail: change.summary,
  })
  return listChanges(projectId)
}

export async function undoChange(projectId: string, changeId: string): Promise<AiChange[]> {
  const change = await readChange(projectId, changeId)
  if (change.status !== 'accepted') throw new Error('Chỉ có thể hoàn tác thay đổi đã áp dụng.')

  const before = await fs.readFile(snapshotPath(projectId, changeId, 'before'), 'utf8')
  await writeFileWithRetry(change.fullPath, before)
  await updateStatus(projectId, changeId, { status: 'undone', undoneAt: Date.now() })
  await appendEvent(projectId, { event: 'undone', id: changeId, file: change.file })
  void recordAudit({
    type: 'patch',
    summary: `Hoàn tác thay đổi tệp (1-click Undo): ${change.file}`,
    ok: true,
    projectId,
    detail: `Khôi phục trạng thái ban đầu của ${change.file}`,
  })
  return listChanges(projectId)
}
