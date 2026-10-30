import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { DEFAULT_SETTINGS } from '../../shared/types'
import type {
  ActivityKind,
  ActivityStatus,
  ProjectActivity,
  ProjectMeta,
  ProjectRecord,
  Settings,
  StoreData,
} from '../../shared/types'

/* Kho dữ liệu nhỏ dạng JSON, lưu trong thư mục userData của Electron.
   Không dùng thư viện ngoài để giữ bản build gọn nhẹ. */

const EMPTY_SETTINGS = { ...DEFAULT_SETTINGS }

let cache: StoreData | null = null
let writeQueue: Promise<void> = Promise.resolve()

const storePath = () => join(app.getPath('userData'), 'pixelmind-store.json')

const normalizeProject = (project: ProjectRecord): ProjectRecord => {
  const meta = (project.meta ?? {}) as Partial<ProjectMeta>
  return {
    ...project,
    previewDir: project.previewDir ?? '',
    meta: {
      owner: 'Người dùng Windows',
      code: 'DA-000',
      repo: '',
      createdAt: project.addedAt ?? Date.now(),
      pages: [],
      versions: [],
      activity: [],
      customCommand: '',
      ...meta,
    },
  }
}

const normalize = (raw: Partial<StoreData> | null | undefined): StoreData => ({
  settings: { ...EMPTY_SETTINGS, ...(raw?.settings ?? {}) },
  projects: Array.isArray(raw?.projects) ? raw!.projects.map(normalizeProject) : [],
  lastProjectId: typeof raw?.lastProjectId === 'string' ? raw.lastProjectId : null,
})

export async function readStore(): Promise<StoreData> {
  if (cache) return cache
  try {
    const raw = JSON.parse(await fs.readFile(storePath(), 'utf8')) as Partial<StoreData>
    cache = normalize(raw)
  } catch {
    cache = normalize(null)
  }
  return cache
}

async function persist(data: StoreData): Promise<void> {
  const file = storePath()
  const tmp = `${file}.${process.pid}.tmp`
  await fs.mkdir(dirname(file), { recursive: true })
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
  await fs.rename(tmp, file)
}

async function write(data: StoreData): Promise<StoreData> {
  cache = data
  writeQueue = writeQueue.then(() => persist(data)).catch(() => undefined)
  await writeQueue
  return data
}

export async function patchStore(patch: Partial<StoreData>): Promise<StoreData> {
  const current = await readStore()
  return write(normalize({ ...current, ...patch }))
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await readStore()
  const settings = { ...current.settings, ...patch }
  await write({ ...current, settings })
  return settings
}

export async function resetStore(): Promise<StoreData> {
  return write(normalize(null))
}

/** Cập nhật một dự án và trả về bản ghi mới. */
export async function patchProject(
  id: string,
  updater: (project: ProjectRecord) => ProjectRecord,
): Promise<ProjectRecord | null> {
  const store = await readStore()
  const target = store.projects.find((project) => project.id === id)
  if (!target) return null
  const updated = updater(target)
  await write({
    ...store,
    projects: store.projects.map((project) => (project.id === id ? updated : project)),
  })
  return updated
}

/** Ghi thêm một dòng vào nhật ký hoạt động của dự án. */
export async function appendActivity(
  projectId: string,
  entry: { actor: string; action: string; kind: ActivityKind; status: ActivityStatus },
): Promise<void> {
  await patchProject(projectId, (project) => {
    const activity: ProjectActivity = { id: randomUUID(), at: Date.now(), ...entry }
    return {
      ...project,
      meta: { ...project.meta, activity: [activity, ...project.meta.activity].slice(0, 40) },
    }
  })
}

export const storeFilePath = storePath
