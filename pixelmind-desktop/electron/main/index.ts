import { app, BrowserWindow, dialog, ipcMain, Menu, screen, shell } from 'electron'
import { join, resolve } from 'node:path'
import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { MenuItemConstructorOptions } from 'electron'
import type { ProjectPage, ProjectRecord, Settings, StoreData } from '../../shared/types'
import { readStore, patchStore, patchProject, appendActivity, updateSettings, resetStore, storeFilePath } from './store'
import {
  detectProject,
  diagnoseProject,
  gitBranch,
  initGit,
  isDirectory,
  readFileContent,
  readTree,
  statProject,
  writeFileContent,
} from './projects'
import { RunnerManager } from './runner'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null

const runner = new RunnerManager(
  (log) => mainWindow?.webContents.send('run:log', log),
  (state) => mainWindow?.webContents.send('run:state', state),
)

const samePath = (a: string, b: string) => resolve(a).toLowerCase() === resolve(b).toLowerCase()

function sendMenuAction(action: string) {
  mainWindow?.webContents.send('menu:action', action)
}

function buildMenu() {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Tệp',
      submenu: [
        {
          label: 'Mở thư mục dự án…',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendMenuAction('open-folder'),
        },
        {
          label: 'Màn hình dự án',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => sendMenuAction('view-projects'),
        },
        { type: 'separator' },
        {
          label: 'Cài đặt…',
          accelerator: 'CmdOrCtrl+,',
          click: () => sendMenuAction('settings'),
        },
        { type: 'separator' },
        { role: 'quit', label: 'Thoát' },
      ],
    },
    {
      label: 'Chạy',
      submenu: [
        { label: 'Chạy dự án', accelerator: 'F5', click: () => sendMenuAction('run') },
        { label: 'Dừng', accelerator: 'Shift+F5', click: () => sendMenuAction('stop') },
        { label: 'Tải lại cây tệp', accelerator: 'CmdOrCtrl+R', click: () => sendMenuAction('refresh') },
      ],
    },
    {
      label: 'Xem',
      submenu: [
        { role: 'reload', label: 'Tải lại cửa sổ' },
        { role: 'toggleDevTools', label: 'Công cụ nhà phát triển' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Cỡ chữ mặc định' },
        { role: 'zoomIn', label: 'Phóng to' },
        { role: 'zoomOut', label: 'Thu nhỏ' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Toàn màn hình' },
      ],
    },
    {
      label: 'Trợ giúp',
      submenu: [
        { label: 'Hướng dẫn sử dụng', accelerator: 'F1', click: () => sendMenuAction('guide') },
        { label: 'Bảng lệnh', accelerator: 'CmdOrCtrl+K', click: () => sendMenuAction('palette') },
        { type: 'separator' },
        {
          label: 'Mở thư mục dữ liệu',
          click: () => shell.openPath(app.getPath('userData')),
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow() {
  /* Co cửa sổ theo vùng làm việc thực tế để không bị tràn ra ngoài màn hình
     (máy dùng tỉ lệ hiển thị 125% thường có vùng làm việc nhỏ hơn 1440×900). */
  const { workAreaSize } = screen.getPrimaryDisplay()
  const width = Math.min(1440, Math.max(960, workAreaSize.width - 24))
  const height = Math.min(900, Math.max(640, workAreaSize.height - 24))

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: Math.min(1080, width),
    minHeight: Math.min(680, height),
    show: false,
    backgroundColor: '#0b0c0f',
    title: 'PixelMind',
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow?.webContents.getURL() ?? ''
    if (url !== current) {
      event.preventDefault()
      if (/^https?:/i.test(url)) void shell.openExternal(url)
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (isDev && devUrl) {
    void mainWindow.loadURL(devUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/* ───────────────────────── IPC: dữ liệu ───────────────────────── */

ipcMain.handle('app:info', () => ({
  appVersion: app.getVersion(),
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node,
  platform: process.platform,
  arch: process.arch,
  userDataPath: app.getPath('userData'),
  home: app.getPath('home'),
}))

ipcMain.handle('store:get', async (): Promise<StoreData> => readStore())

ipcMain.handle('store:patch', async (_e, patch: Partial<StoreData>): Promise<StoreData> => patchStore(patch))

ipcMain.handle('store:update-settings', async (_e, patch: Partial<Settings>): Promise<Settings> =>
  updateSettings(patch),
)

ipcMain.handle('store:reset', async (): Promise<StoreData> => {
  runner.stopAll()
  return resetStore()
})

ipcMain.handle('store:path', () => storeFilePath())

/* ───────────────────────── IPC: dự án ───────────────────────── */

ipcMain.handle('project:pick', async (): Promise<ProjectRecord | null> => {
  const result = await dialog.showOpenDialog(mainWindow ?? undefined!, {
    title: 'Chọn thư mục dự án',
    properties: ['openDirectory'],
    buttonLabel: 'Mở thư mục này',
  })
  if (result.canceled || !result.filePaths.length) return null
  return addProject(result.filePaths[0])
})

/** Ghép kết quả dò mới vào bản ghi cũ, giữ dữ liệu người dùng đã tạo. */
async function mergeDetected(project: ProjectRecord, fresh: ProjectRecord): Promise<ProjectRecord> {
  const merged: ProjectRecord = {
    ...fresh,
    id: project.id,
    addedAt: project.addedAt,
    lastOpenedAt: project.lastOpenedAt,
    favorite: project.favorite,
    meta: {
      ...fresh.meta,
      owner: project.meta.owner || fresh.meta.owner,
      code: project.meta.code || fresh.meta.code,
      repo: project.meta.repo || fresh.meta.repo,
      createdAt: project.meta.createdAt || fresh.meta.createdAt,
      /* Giữ các trang người dùng đã thêm, lệnh tự nhập và nhật ký hoạt động */
      pages: project.meta.pages.length ? project.meta.pages : fresh.meta.pages,
      customCommand: project.meta.customCommand || fresh.meta.customCommand,
      activity: project.meta.activity,
    },
  }
  /* Chẩn đoán lại theo lệnh tự nhập để không báo thiếu script khi đã có lệnh chạy. */
  merged.diagnosis = await diagnoseProject(merged.path, merged.meta.customCommand)
  return merged
}

async function addProject(folder: string): Promise<ProjectRecord | null> {
  if (!(await isDirectory(folder))) return null
  const detected = await detectProject(folder)
  const store = await readStore()
  const existing = store.projects.find((p) => samePath(p.path, detected.path))
  if (existing) {
    /* Dò lại để bản ghi cũ nhận được script/preview mới (ví dụ Flutter). */
    const updated = await mergeDetected(existing, detected)
    await patchStore({
      projects: store.projects.map((p) => (p.id === existing.id ? updated : p)),
      lastProjectId: existing.id,
    })
    return updated
  }
  detected.lastOpenedAt = Date.now()
  await patchStore({ projects: [...store.projects, detected], lastProjectId: detected.id })
  return detected
}

ipcMain.handle('project:add', async (_e, folder: string): Promise<ProjectRecord | null> => addProject(folder))

ipcMain.handle('project:list', async (): Promise<ProjectRecord[]> => (await readStore()).projects)

ipcMain.handle('project:open', async (_e, id: string): Promise<ProjectRecord | null> => {
  const store = await readStore()
  const existing = store.projects.find((p) => p.id === id)
  if (!existing) return null

  let project = existing
  if (await isDirectory(existing.path)) {
    /* Dò lại khi mở để cập nhật script mới hoặc nhận diện framework. */
    const fresh = await detectProject(existing.path)
    project = await mergeDetected(existing, fresh)
  }
  project = { ...project, lastOpenedAt: Date.now() }
  await patchStore({
    projects: store.projects.map((p) => (p.id === id ? project : p)),
    lastProjectId: id,
  })
  await appendActivity(id, {
    actor: 'bạn',
    action: `Mở dự án “${project.name}” trong PixelMind`,
    kind: 'người',
    status: 'info',
  })
  const latest = await readStore()
  return latest.projects.find((item) => item.id === id) ?? project
})

ipcMain.handle('project:remove', async (_e, id: string): Promise<ProjectRecord[]> => {
  const store = await readStore()
  const running = runner.stateOfProject(id)
  if (running) runner.stop(running.id)
  const projects = store.projects.filter((p) => p.id !== id)
  await patchStore({
    projects,
    lastProjectId: store.lastProjectId === id ? null : store.lastProjectId,
  })
  return projects
})

ipcMain.handle('project:favorite', async (_e, id: string): Promise<ProjectRecord[]> => {
  const store = await readStore()
  const projects = store.projects.map((p) => (p.id === id ? { ...p, favorite: !p.favorite } : p))
  await patchStore({ projects })
  return projects
})

ipcMain.handle('project:refresh', async (_e, id: string): Promise<ProjectRecord | null> => {
  const store = await readStore()
  const project = store.projects.find((p) => p.id === id)
  if (!project) return null
  if (!(await isDirectory(project.path))) return null
  const fresh = await detectProject(project.path)
  const updated = await mergeDetected(project, fresh)
  await patchStore({ projects: store.projects.map((p) => (p.id === id ? updated : p)) })
  return updated
})

ipcMain.handle('project:add-page', async (_e, id: string, page: Omit<ProjectPage, 'id'>) => {
  const updated = await patchProject(id, (project) => ({
    ...project,
    meta: {
      ...project.meta,
      pages: [...project.meta.pages, { ...page, id: randomUUID() }],
    },
  }))
  if (updated) {
    await appendActivity(id, {
      actor: 'bạn',
      action: `Thêm trang ${page.route} — ${page.title}`,
      kind: 'người',
      status: 'ok',
    })
  }
  return updated
})

ipcMain.handle('project:remove-page', async (_e, id: string, pageId: string) => {
  const removed = await readStore().then((store) =>
    store.projects.find((p) => p.id === id)?.meta.pages.find((page) => page.id === pageId),
  )
  const updated = await patchProject(id, (project) => ({
    ...project,
    meta: { ...project.meta, pages: project.meta.pages.filter((page) => page.id !== pageId) },
  }))
  if (updated && removed) {
    await appendActivity(id, {
      actor: 'bạn',
      action: `Xoá trang ${removed.route} khỏi danh sách`,
      kind: 'người',
      status: 'warn',
    })
  }
  return updated
})

ipcMain.handle('project:diagnose', async (_e, idOrPath: string) => {
  const store = await readStore()
  const project = store.projects.find((p) => p.id === idOrPath)
  const targetPath = project ? project.path : idOrPath
  const diagnosis = await diagnoseProject(targetPath, project?.meta.customCommand ?? '')
  if (project) {
    await patchProject(project.id, (p) => ({ ...p, diagnosis }))
  }
  return diagnosis
})

ipcMain.handle('project:git-init', async (_e, projectId: string) => {
  const store = await readStore()
  const project = store.projects.find((p) => p.id === projectId)
  if (!project) throw new Error('Không tìm thấy dự án.')
  const ok = await initGit(project.path)
  if (ok) {
    const updated = await detectProject(project.path)
    await patchProject(projectId, (p) => ({
      ...p,
      diagnosis: updated.diagnosis,
      meta: { ...p.meta, versions: updated.meta.versions },
    }))
    await appendActivity(projectId, {
      actor: 'bạn',
      action: 'Khởi tạo kho Git (git init)',
      kind: 'người',
      status: 'ok',
    })
  }
  return ok
})

ipcMain.handle('project:set-command', async (_e, id: string, command: string) => {
  const updated = await patchProject(id, (project) => ({
    ...project,
    meta: { ...project.meta, customCommand: command.trim() },
  }))
  if (!updated) return null
  /* Cập nhật lại chẩn đoán để thẻ cảnh báo phản ánh đúng lệnh tự nhập. */
  const diagnosis = await diagnoseProject(updated.path, updated.meta.customCommand)
  return patchProject(id, (project) => ({ ...project, diagnosis }))
})

/* ───────────────────────── IPC: tệp ───────────────────────── */

ipcMain.handle('fs:tree', async (_e, root: string, showHidden: boolean) => {
  if (!(await isDirectory(root))) return []
  return readTree(root, { showHidden })
})

ipcMain.handle('fs:read', async (_e, target: string) => readFileContent(target))

ipcMain.handle('fs:write', async (_e, target: string, text: string) => {
  await writeFileContent(target, text)
  return true
})

ipcMain.handle('fs:stat', async (_e, root: string) => statProject(root))

ipcMain.handle('fs:git', async (_e, root: string) => gitBranch(root))

ipcMain.handle('fs:show', async (_e, target: string) => {
  shell.showItemInFolder(target)
})

ipcMain.handle('fs:open', async (_e, target: string) => {
  const error = await shell.openPath(target)
  return error || null
})

ipcMain.handle('fs:exists', async (_e, target: string) => {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
})

ipcMain.handle('fs:special', async (_e, kind: 'userData' | 'home' | 'documents' | 'desktop') => {
  if (kind === 'userData') return app.getPath('userData')
  if (kind === 'home') return app.getPath('home')
  if (kind === 'documents') return app.getPath('documents')
  return app.getPath('desktop')
})

/* ───────────────────────── IPC: chạy dự án ───────────────────────── */

ipcMain.handle('run:start', async (_e, projectId: string, script: string) => {
  const store = await readStore()
  const project = store.projects.find((p) => p.id === projectId)
  if (!project) throw new Error('Không tìm thấy dự án trong danh sách.')
  const entry = project.scripts.find((item) => item.name === script)
  const state =
    script === 'static'
      ? await runner.startStatic(project)
      : runner.startScript(project, script, entry?.direct ? entry.command : undefined)
  await appendActivity(projectId, {
    actor: 'hệ thống',
    action: `Chạy script “${script}” cho ${project.name}`,
    kind: 'hệ thống',
    status: 'ok',
  })
  return state
})

ipcMain.handle('run:install', async (_e, projectId: string) => {
  const store = await readStore()
  const project = store.projects.find((p) => p.id === projectId)
  if (!project) throw new Error('Không tìm thấy dự án trong danh sách.')
  const state = runner.startInstall(project)
  await appendActivity(projectId, {
    actor: 'hệ thống',
    action: `Bắt đầu cài đặt thư viện (${project.packageManager || 'npm'} install)`,
    kind: 'hệ thống',
    status: 'info',
  })
  return state
})

ipcMain.handle('run:start-command', async (_e, projectId: string, command: string) => {
  const store = await readStore()
  const project = store.projects.find((p) => p.id === projectId)
  if (!project) throw new Error('Không tìm thấy dự án trong danh sách.')
  const clean = command.trim()
  if (!clean) throw new Error('Hãy nhập lệnh chạy trước khi bấm Chạy.')
  /* Lưu lại để lần sau mở dự án vẫn còn lệnh */
  await patchProject(projectId, (item) => ({
    ...item,
    meta: { ...item.meta, customCommand: clean },
  }))
  const state = runner.startCommand(project, clean)
  await appendActivity(projectId, {
    actor: 'hệ thống',
    action: `Chạy lệnh tự nhập cho ${project.name}: ${clean}`,
    kind: 'hệ thống',
    status: 'ok',
  })
  return state
})

ipcMain.handle('run:stop', async (_e, runId: string) => {
  const state = runner.list().find((item) => item.id === runId)
  const stopped = runner.stop(runId)
  if (state) {
    await appendActivity(state.projectId, {
      actor: 'hệ thống',
      action: `Dừng tiến trình “${state.script}”`,
      kind: 'hệ thống',
      status: 'warn',
    })
  }
  return stopped
})
ipcMain.handle('run:list', () => runner.list())
ipcMain.handle('run:project', (_e, projectId: string) => runner.stateOfProject(projectId))

ipcMain.handle('shell:external', async (_e, url: string) => {
  if (/^https?:/i.test(url)) await shell.openExternal(url)
  return true
})

/* ───────────────────────── Vòng đời ứng dụng ───────────────────────── */

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('com.pixelmind.desktop')
    buildMenu()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    runner.stopAll()
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => runner.stopAll())
}
