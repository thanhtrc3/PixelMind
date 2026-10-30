import { app, BrowserWindow, dialog, ipcMain, Menu, screen, shell } from 'electron'
import { dirname, join, resolve } from 'node:path'
import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { MenuItemConstructorOptions } from 'electron'
import type { ProjectPage, ProjectRecord, Settings, StoreData } from '../../shared/types'
import { readStore, patchStore, patchProject, appendActivity, updateSettings, resetStore, storeFilePath } from './store'
import {
  addDevScriptToPkg,
  createIndexHtmlFile,
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

// Tắt Same-Origin Policy & Site Isolation cho iframe trong Electron
app.commandLine.appendSwitch('disable-web-security')
app.commandLine.appendSwitch('disable-site-isolation-trials')
app.commandLine.appendSwitch('disable-features', 'IsolateOrigins,site-per-process')

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
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders }
    delete responseHeaders['x-frame-options']
    delete responseHeaders['X-Frame-Options']
    delete responseHeaders['content-security-policy']
    delete responseHeaders['Content-Security-Policy']
    callback({ cancel: false, responseHeaders })
  })

  mainWindow.webContents.on('did-frame-finish-load', (_event, isMainFrame) => {
    if (!isMainFrame) {
      injectInspectorIntoAllFrames(inspectModeActive)
    }
  })

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
    title: 'Chọn thư mục hoặc tệp dự án (.sln, .csproj, package.json)',
    properties: ['openDirectory', 'openFile'],
    filters: [
      { name: 'Dự án được hỗ trợ (*.sln, *.csproj, package.json)', extensions: ['sln', 'csproj', 'json'] },
      { name: 'Visual Studio Solution (*.sln)', extensions: ['sln'] },
      { name: 'C# Project (*.csproj)', extensions: ['csproj'] },
      { name: 'Tất cả tệp', extensions: ['*'] },
    ],
    buttonLabel: 'Mở dự án này',
  })
  if (result.canceled || !result.filePaths.length) return null
  return addProject(result.filePaths[0])
})

async function addProject(targetPath: string): Promise<ProjectRecord | null> {
  let folder = targetPath
  try {
    const stat = await fs.stat(targetPath)
    if (!stat.isDirectory()) {
      folder = dirname(targetPath)
    }
  } catch {
    return null
  }
  if (!(await isDirectory(folder))) return null
  const detected = await detectProject(folder)
  const store = await readStore()
  const existing = store.projects.find((p) => samePath(p.path, detected.path))
  if (existing) {
    const merged: ProjectRecord = {
      ...existing,
      ...detected,
      id: existing.id,
      favorite: existing.favorite,
      lastOpenedAt: Date.now(),
    }
    await patchProject(existing.id, () => merged)
    await patchStore({ lastProjectId: existing.id })
    return merged
  }
  detected.lastOpenedAt = Date.now()
  await patchStore({ projects: [...store.projects, detected], lastProjectId: detected.id })
  return detected
}

ipcMain.handle('project:add', async (_e, folder: string): Promise<ProjectRecord | null> => addProject(folder))

ipcMain.handle('project:list', async (): Promise<ProjectRecord[]> => (await readStore()).projects)

ipcMain.handle('project:open', async (_e, id: string): Promise<ProjectRecord | null> => {
  const store = await readStore()
  const current = store.projects.find((p) => p.id === id)
  if (current) {
    try {
      const detected = await detectProject(current.path)
      await patchProject(id, (project) => ({
        ...project,
        ...detected,
        id: project.id,
        favorite: project.favorite,
        lastOpenedAt: Date.now(),
      }))
    } catch {
      await patchProject(id, (project) => ({ ...project, lastOpenedAt: Date.now() }))
    }
  } else {
    await patchProject(id, (project) => ({ ...project, lastOpenedAt: Date.now() }))
  }
  await patchStore({ lastProjectId: id })
  const updated = (await readStore()).projects.find((project) => project.id === id)
  if (updated) {
    await appendActivity(id, {
      actor: 'bạn',
      action: `Mở dự án “${updated.name}” trong PixelMind`,
      kind: 'người',
      status: 'info',
    })
  }
  return updated ?? null
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
  const updated: ProjectRecord = {
    ...fresh,
    id: project.id,
    addedAt: project.addedAt,
    lastOpenedAt: project.lastOpenedAt,
    favorite: project.favorite,
    diagnosis: fresh.diagnosis,
    meta: {
      ...fresh.meta,
      owner: project.meta.owner || fresh.meta.owner,
      code: project.meta.code || fresh.meta.code,
      repo: project.meta.repo || fresh.meta.repo,
      createdAt: project.meta.createdAt || fresh.meta.createdAt,
      /* Giữ các trang người dùng đã thêm và nhật ký hoạt động */
      pages: project.meta.pages.length ? project.meta.pages : fresh.meta.pages,
      activity: project.meta.activity,
    },
  }
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
  const diagnosis = await diagnoseProject(targetPath)
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

ipcMain.handle('project:create-index-html', async (_e, projectId: string) => {
  const store = await readStore()
  const project = store.projects.find((p) => p.id === projectId)
  if (!project) throw new Error('Không tìm thấy dự án.')
  const ok = await createIndexHtmlFile(project.path, project.name)
  if (ok) {
    const updated = await detectProject(project.path)
    await patchProject(projectId, (p) => ({
      ...p,
      hasIndexHtml: true,
      diagnosis: updated.diagnosis,
      meta: { ...p.meta, pages: updated.meta.pages },
    }))
    await appendActivity(projectId, {
      actor: 'PixelMind',
      action: 'Tự động tạo tệp index.html mẫu để xem trước',
      kind: 'hệ thống',
      status: 'ok',
    })
  }
  return ok
})

ipcMain.handle('project:add-dev-script', async (_e, projectId: string) => {
  const store = await readStore()
  const project = store.projects.find((p) => p.id === projectId)
  if (!project) throw new Error('Không tìm thấy dự án.')
  const ok = await addDevScriptToPkg(project.path)
  if (ok) {
    const updated = await detectProject(project.path)
    await patchProject(projectId, (p) => ({
      ...p,
      scripts: updated.scripts,
      diagnosis: updated.diagnosis,
    }))
    await appendActivity(projectId, {
      actor: 'PixelMind',
      action: 'Thêm script "dev" vào package.json',
      kind: 'hệ thống',
      status: 'ok',
    })
  }
  return ok
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
  const state = script === 'static' ? await runner.startStatic(project) : runner.startScript(project, script)
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

/* ───────────────────────── IPC: Inspector & Live DOM Bridge ───────────────────────── */

let inspectModeActive = false

function getInspectorScript(isActive: boolean) {
  return `
  (function() {
    window.__PM_INSPECT_ACTIVE = ${isActive ? 'true' : 'false'};
    if (document.documentElement) {
      document.documentElement.style.cursor = window.__PM_INSPECT_ACTIVE ? 'crosshair' : '';
    }
    if (window.__PM_INSPECT_INITIALIZED) return;
    window.__PM_INSPECT_INITIALIZED = true;

    var lastSelected = null;

    function getBreadcrumb(el) {
      var curr = el;
      var parts = [];
      while (curr && curr !== document.body && curr !== document.documentElement && parts.length < 5) {
        var seg = curr.tagName.toLowerCase();
        if (curr.id) {
          seg += '#' + curr.id;
        } else if (curr.className && typeof curr.className === 'string') {
          var first = curr.className.trim().split(/\\s+/)[0];
          if (first) seg += '.' + first;
        }
        parts.unshift(seg);
        curr = curr.parentElement;
      }
      return parts.join(' > ');
    }

    function extractElementInfo(el) {
      var rect = el.getBoundingClientRect();
      var style = window.getComputedStyle(el);
      var isLeaf = el.children.length === 0;
      var rawText = isLeaf ? (el.innerText || el.textContent || '').trim() : '';
      var snippet = rawText.length > 60 ? rawText.slice(0, 60) + '…' : rawText;

      return {
        tagName: el.tagName.toLowerCase(),
        id: el.id || '',
        className: typeof el.className === 'string' ? el.className.trim() : '',
        isLeaf: isLeaf,
        childrenCount: el.children.length,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        },
        computedStyles: {
          display: style.display || 'block',
          flexDirection: style.flexDirection || 'row',
          alignItems: style.alignItems || 'stretch',
          justifyContent: style.justifyContent || 'flex-start',
          gap: style.gap || '0px',
          flexWrap: style.flexWrap || 'nowrap',
          color: style.color || '',
          backgroundColor: style.backgroundColor || '',
          backgroundImage: style.backgroundImage || '',
          fontSize: style.fontSize || '',
          fontWeight: style.fontWeight || '',
          fontFamily: (style.fontFamily || '').split(',')[0].replace(/['"]/g, ''),
          lineHeight: style.lineHeight || 'normal',
          letterSpacing: style.letterSpacing || 'normal',
          textAlign: style.textAlign || 'left',
          textDecoration: style.textDecorationLine || style.textDecoration || 'none',
          textTransform: style.textTransform || 'none',
          padding: (style.paddingTop || '0px') + ' ' + (style.paddingRight || '0px') + ' ' + (style.paddingBottom || '0px') + ' ' + (style.paddingLeft || '0px'),
          paddingTop: style.paddingTop || '0px',
          paddingRight: style.paddingRight || '0px',
          paddingBottom: style.paddingBottom || '0px',
          paddingLeft: style.paddingLeft || '0px',
          margin: (style.marginTop || '0px') + ' ' + (style.marginRight || '0px') + ' ' + (style.marginBottom || '0px') + ' ' + (style.marginLeft || '0px'),
          marginTop: style.marginTop || '0px',
          marginRight: style.marginRight || '0px',
          marginBottom: style.marginBottom || '0px',
          marginLeft: style.marginLeft || '0px',
          borderRadius: style.borderRadius || '0px',
          borderWidth: style.borderWidth || '0px',
          borderStyle: style.borderStyle || 'none',
          borderColor: style.borderColor || '',
          boxShadow: style.boxShadow || 'none',
          opacity: style.opacity || '1',
          top: style.top !== 'auto' ? style.top : '0px',
          left: style.left !== 'auto' ? style.left : '0px',
          width: Math.round(rect.width) + 'px',
          height: Math.round(rect.height) + 'px',
        },
        domPath: getBreadcrumb(el),
        textSnippet: snippet,
      };
    }

    window.addEventListener('mouseover', function(e) {
      if (!window.__PM_INSPECT_ACTIVE) return;
      var target = e.target;
      if (!target || target === document.body || target === document.documentElement) return;
      var rect = target.getBoundingClientRect();
      window.parent.postMessage({
        type: 'PM_HOVER_ELEMENT',
        payload: {
          tagName: target.tagName.toLowerCase(),
          className: typeof target.className === 'string' ? target.className : '',
          rect: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }
        }
      }, '*');
    }, true);

    window.addEventListener('mouseout', function(e) {
      if (!window.__PM_INSPECT_ACTIVE) return;
      window.parent.postMessage({
        type: 'PM_HOVER_ELEMENT',
        payload: null
      }, '*');
    }, true);

    window.addEventListener('click', function(e) {
      if (!window.__PM_INSPECT_ACTIVE) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      var target = e.target;
      if (!target || target === document.body || target === document.documentElement) return;
      lastSelected = target;
      if (!target.__PM_ORIGINAL) {
        target.__PM_ORIGINAL = {
          cssText: target.style.cssText,
          innerHTML: target.innerHTML,
        };
      }

      var info = extractElementInfo(target);
      window.parent.postMessage({
        type: 'PM_SELECT_ELEMENT',
        payload: info
      }, '*');
    }, true);

    window.addEventListener('message', function(e) {
      if (!e.data) return;
      if (e.data.type === 'PM_SET_INSPECT_MODE') {
        window.__PM_INSPECT_ACTIVE = !!e.data.enabled;
        if (document.documentElement) {
          document.documentElement.style.cursor = window.__PM_INSPECT_ACTIVE ? 'crosshair' : '';
        }
      } else if (e.data.type === 'PM_RESET_ORIGINAL' && lastSelected) {
        if (lastSelected.__PM_ORIGINAL) {
          lastSelected.style.cssText = lastSelected.__PM_ORIGINAL.cssText;
          if (typeof lastSelected.__PM_ORIGINAL.innerHTML === 'string') {
            lastSelected.innerHTML = lastSelected.__PM_ORIGINAL.innerHTML;
          }
        } else {
          lastSelected.removeAttribute('style');
        }
        var updated = extractElementInfo(lastSelected);
        window.parent.postMessage({
          type: 'PM_SELECT_ELEMENT',
          payload: updated,
          isReset: true
        }, '*');
      } else if (e.data.type === 'PM_APPLY_STYLE') {
        var payload = e.data.payload || {};
        var styles = payload.styles;
        var textContent = payload.textContent;
        var targetEl = lastSelected;
        if (styles && targetEl) {
          // Nếu phần tử đang là inline, tự động đổi sang inline-block để nhận width, height
          if (styles.width || styles.height) {
            var curDisplay = window.getComputedStyle(targetEl).display;
            if (curDisplay === 'inline') {
              targetEl.style.display = 'inline-block';
            }
          }
          // Nếu đang di chuyển tọa độ left/top, đảm bảo có position relative
          if (styles.left !== undefined || styles.top !== undefined) {
            var curPos = window.getComputedStyle(targetEl).position;
            if (curPos === 'static') {
              targetEl.style.position = 'relative';
            }
          }
          for (var k in styles) {
            targetEl.style[k] = styles[k];
          }
        }
        if (typeof textContent === 'string' && targetEl) {
          // Chỉ gán textContent nếu phần tử KHÔNG có phần tử con (leaf element)
          if (targetEl.children.length === 0) {
            targetEl.textContent = textContent;
          }
        }
        if (targetEl) {
          var updated = extractElementInfo(targetEl);
          window.parent.postMessage({
            type: 'PM_SELECT_ELEMENT',
            payload: updated
          }, '*');
        }
      }
    });
  })();
  `;
}

function getAllWebFrames(frame: Electron.WebFrameMain): Electron.WebFrameMain[] {
  const result: Electron.WebFrameMain[] = [frame]
  for (const child of frame.frames) {
    result.push(...getAllWebFrames(child))
  }
  return result
}

function injectInspectorIntoAllFrames(enabled: boolean) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const script = getInspectorScript(enabled)
  try {
    const all = getAllWebFrames(mainWindow.webContents.mainFrame)
    for (const frame of all) {
      if (frame !== mainWindow.webContents.mainFrame) {
        frame.executeJavaScript(script).catch(() => {})
      }
    }
  } catch {
    // Frame có thể đang bận hoặc hủy
  }
}

ipcMain.handle('inspect:set-mode', (_e, enabled: boolean) => {
  inspectModeActive = enabled
  injectInspectorIntoAllFrames(enabled)
  return true
})

ipcMain.handle('inspect:reset-original', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return false
  const script = `
    window.postMessage({
      type: 'PM_RESET_ORIGINAL'
    }, '*');
  `;
  try {
    const all = getAllWebFrames(mainWindow.webContents.mainFrame)
    for (const frame of all) {
      if (frame !== mainWindow.webContents.mainFrame) {
        frame.executeJavaScript(script).catch(() => {})
      }
    }
  } catch {}
  return true
})

ipcMain.handle(
  'inspect:apply-style',
  (_e, payload: { styles?: Record<string, string>; textContent?: string }) => {
    if (!mainWindow || mainWindow.isDestroyed()) return false
    const script = `
      window.postMessage({
        type: 'PM_APPLY_STYLE',
        payload: ${JSON.stringify(payload)}
      }, '*');
    `;
    try {
      const all = getAllWebFrames(mainWindow.webContents.mainFrame)
      for (const frame of all) {
        if (frame !== mainWindow.webContents.mainFrame) {
          frame.executeJavaScript(script).catch(() => {})
        }
      }
    } catch {}
    return true
  },
)


/* ───────────────────────── IPC: Code Sync Engine (Ghi ngược vào mã nguồn thật) ───────────────────────── */

async function scanProjectForSource(
  rootDir: string,
  textSnippet: string,
  _tagName: string,
  className: string
): Promise<{ filePath: string; fullPath: string; lineNumber: number; lineContent: string } | null> {
  const exts = ['.cshtml', '.tsx', '.jsx', '.html', '.vue', '.razor', '.php', '.svelte', '.css']
  const ignoreDirs = ['node_modules', '.git', 'bin', 'obj', 'dist', 'build', '.vs', '.vscode']

  async function walk(dir: string): Promise<{ filePath: string; fullPath: string; lineNumber: number; lineContent: string } | null> {
    let entries: string[] = []
    try {
      entries = await fs.readdir(dir)
    } catch {
      return null
    }

    for (const entry of entries) {
      if (ignoreDirs.includes(entry)) continue
      const full = join(dir, entry)
      try {
        const stat = await fs.stat(full)
        if (stat.isDirectory()) {
          const res = await walk(full)
          if (res) return res
        } else if (stat.isFile() && exts.some((ext) => entry.toLowerCase().endsWith(ext))) {
          const content = await fs.readFile(full, 'utf8')

          // Ưu tiên 1: Khớp chuỗi chữ Text Snippet
          if (textSnippet && textSnippet.length >= 2 && content.includes(textSnippet)) {
            const lines = content.split(/\r?\n/)
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes(textSnippet)) {
                return {
                  filePath: full.replace(rootDir, '').replace(/^[\\/]/, '').replace(/\\/g, '/'),
                  fullPath: full,
                  lineNumber: i + 1,
                  lineContent: lines[i].trim(),
                }
              }
            }
          }

          // Ưu tiên 2: Khớp class đầu tiên
          if (className) {
            const firstClass = className.split(/\s+/)[0]
            if (firstClass && content.includes(firstClass)) {
              const lines = content.split(/\r?\n/)
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(firstClass)) {
                  return {
                    filePath: full.replace(rootDir, '').replace(/^[\\/]/, '').replace(/\\/g, '/'),
                    fullPath: full,
                    lineNumber: i + 1,
                    lineContent: lines[i].trim(),
                  }
                }
              }
            }
          }
        }
      } catch {
        // bỏ qua file bận
      }
    }
    return null
  }

  return walk(rootDir)
}

ipcMain.handle(
  'inspect:locate-source',
  async (_e, { projectPath, textSnippet, tagName, className }) => {
    if (!projectPath) return null
    return await scanProjectForSource(projectPath, textSnippet, tagName, className)
  }
)

function camelToKebabCase(str: string): string {
  return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase()
}

ipcMain.handle(
  'inspect:sync-code',
  async (_e, { fullPath, oldText, newText, styles, tagName, lineNumber }: {
    fullPath: string
    oldText?: string
    newText?: string
    styles?: Record<string, string>
    tagName?: string
    lineNumber?: number
  }) => {
    try {
      if (!fullPath) return { success: false, error: 'Không có đường dẫn tệp nguồn' }
      let content = await fs.readFile(fullPath, 'utf8')
      const isJsx = fullPath.endsWith('.tsx') || fullPath.endsWith('.jsx')
      const lines = content.split(/\r?\n/)
      let targetLineIdx = -1

      if (typeof lineNumber === 'number' && lineNumber > 0 && lineNumber <= lines.length) {
        targetLineIdx = lineNumber - 1
      } else if (oldText) {
        targetLineIdx = lines.findIndex((l) => l.includes(oldText))
      }

      const styleEntries = styles ? Object.entries(styles).filter(([_, v]) => Boolean(v)) : []

      if (targetLineIdx !== -1) {
        let line = lines[targetLineIdx]
        const oldLine = line

        // 1. Cập nhật văn bản
        if (oldText && newText && oldText !== newText && line.includes(oldText)) {
          line = line.replace(oldText, newText)
        }

        // 2. Cập nhật thuộc tính style vào thẻ HTML / JSX
        if (styleEntries.length > 0) {
          if (isJsx) {
            const jsxStyleStr = styleEntries.map(([k, v]) => `${k}: '${v}'`).join(', ')
            if (/style=\{\{.*?\}\}/.test(line)) {
              line = line.replace(/style=\{\{.*?\}\}/, `style={{ ${jsxStyleStr} }}`)
            } else {
              const tagRegex = new RegExp(`(<${tagName || '[a-zA-Z0-9_-]+'})(\\s|>)`)
              if (tagRegex.test(line)) {
                line = line.replace(tagRegex, `$1 style={{ ${jsxStyleStr} }}$2`)
              }
            }
          } else {
            const htmlStyleStr = styleEntries.map(([k, v]) => `${camelToKebabCase(k)}: ${v};`).join(' ')
            if (/style=".*?"/.test(line)) {
              line = line.replace(/style=".*?"/, `style="${htmlStyleStr}"`)
            } else {
              const tagRegex = new RegExp(`(<${tagName || '[a-zA-Z0-9_-]+'})(\\s|>)`)
              if (tagRegex.test(line)) {
                line = line.replace(tagRegex, `$1 style="${htmlStyleStr}"$2`)
              }
            }
          }
        }

        lines[targetLineIdx] = line
        content = lines.join('\n')
        await fs.writeFile(fullPath, content, 'utf8')
        return { success: true, oldLine, newLine: line }
      } else if (oldText && newText && oldText !== newText && content.includes(oldText)) {
        const oldLine = content
        content = content.replace(oldText, newText)
        await fs.writeFile(fullPath, content, 'utf8')
        return { success: true, oldLine, newLine: content }
      }

      return { success: false, error: 'Không tìm thấy dòng tương ứng trong tệp' }
    } catch (err: unknown) {
      return { success: false, error: String(err) }
    }
  }
)

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
