import { app, BrowserWindow, dialog, ipcMain, Menu, screen, shell } from 'electron'
import { dirname, join, resolve } from 'node:path'
import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { MenuItemConstructorOptions } from 'electron'
import type { DesignTokens, ProjectPage, ProjectRecord, Settings, StoreData } from '../../shared/types'
import {
  DEFAULT_DESIGN_TOKENS,
  generateVariablesCss,
  generateTailwindTokensConfig,
  parseVariablesCss,
} from '../../shared/designTokens'
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
    if (window.__PM_INSPECT_CLEANUP) {
      try { window.__PM_INSPECT_CLEANUP(); } catch(e) {}
    }

    var lastSelected = null;

    function getUniqueSelector(el) {
      if (!el || el === document.body || el === document.documentElement) return '';
      if (el.id) {
        try {
          return '#' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id);
        } catch(e) {
          return '#' + el.id;
        }
      }
      var parent = el.parentElement;
      if (!parent) return el.tagName.toLowerCase();
      var siblings = Array.prototype.filter.call(parent.children, function(c) {
        return c.tagName === el.tagName;
      });
      var index = Array.prototype.indexOf.call(siblings, el) + 1;
      var part = el.tagName.toLowerCase() + ':nth-of-type(' + index + ')';
      var parentSel = getUniqueSelector(parent);
      return parentSel ? parentSel + ' > ' + part : part;
    }

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
      if (!el.getAttribute('data-pm-uid')) {
        el.setAttribute('data-pm-uid', 'pm_' + Math.random().toString(36).slice(2, 9));
      }
      var uid = el.getAttribute('data-pm-uid');
      var rect = el.getBoundingClientRect();
      var style = window.getComputedStyle(el);
      var isLeaf = el.children.length === 0;
      var rawText = isLeaf ? (el.innerText || el.textContent || '').trim() : '';
      var snippet = rawText.length > 60 ? rawText.slice(0, 60) + '…' : rawText;

      return {
        uid: uid,
        selector: getUniqueSelector(el),
        tagName: el.tagName.toLowerCase(),
        id: el.id || '',
        className: typeof el.className === 'string' ? el.className.trim() : '',
        isLeaf: isLeaf,
        childrenCount: el.children.length,
        currentPath: window.location.pathname || '/',
        currentUrl: window.location.href || '',
        pageTitle: document.title || '',
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        },
        computedStyles: {
          display: style.display || 'block',
          position: style.position || 'static',
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

    function findTargetElement(target) {
      if (!target) return null;
      // 1. Tìm bằng pmUid (chuẩn xác nhất trong cùng phiên làm việc)
      if (target.uid) {
        try {
          var byUid = document.querySelector('[data-pm-uid="' + target.uid + '"]');
          if (byUid) return byUid;
        } catch (e) {}
      }
      // 2. Tìm bằng ID
      if (target.id) {
        var byId = document.getElementById(target.id);
        if (byId) return byId;
      }
      // 3. Tìm bằng unique selector (:nth-of-type)
      if (target.selector) {
        try {
          var bySel = document.querySelector(target.selector);
          if (bySel) return bySel;
        } catch (e) {}
      }
      // 4. Tìm bằng domPath (nếu là CSS selector hợp lệ và đúng tagName)
      if (target.domPath) {
        try {
          var byPath = document.querySelector(target.domPath);
          if (byPath && target.tagName && byPath.tagName.toLowerCase() === target.tagName.toLowerCase()) {
            return byPath;
          }
        } catch (e) {}
      }
      // 5. Quét toàn bộ thẻ tagName khớp breadcrumb hoặc text
      if (target.tagName) {
        var candidates = document.getElementsByTagName(target.tagName);
        for (var i = 0; i < candidates.length; i++) {
          if (getBreadcrumb(candidates[i]) === target.domPath) {
            return candidates[i];
          }
        }
        if (target.textSnippet) {
          for (var j = 0; j < candidates.length; j++) {
            var txt = (candidates[j].textContent || '').trim();
            if (txt && txt.indexOf(target.textSnippet.slice(0, 15)) !== -1) {
              return candidates[j];
            }
          }
        }
      }
      // 6. TUYỆT ĐỐI chỉ dùng lastSelected nếu có cùng tagName
      if (lastSelected && target.tagName && lastSelected.tagName.toLowerCase() === target.tagName.toLowerCase()) {
        return lastSelected;
      }
      return null;
    }

    window.addEventListener('mouseover', function(e) {
      if (!window.__PM_INSPECT_ACTIVE) return;
      var target = e.target;
      if (!target || target === document.body || target === document.documentElement) return;
      var rect = target.getBoundingClientRect();
      if (!target.getAttribute('data-pm-uid')) {
        target.setAttribute('data-pm-uid', 'pm_' + Math.random().toString(36).slice(2, 9));
      }
      var uid = target.getAttribute('data-pm-uid');
      window.parent.postMessage({
        type: 'PM_HOVER_ELEMENT',
        payload: {
          uid: uid,
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
        var targetEl = null;
        if (payload.target) {
          targetEl = findTargetElement(payload.target);
        }
        if (!targetEl && lastSelected && payload.target && payload.target.tagName && lastSelected.tagName.toLowerCase() === payload.target.tagName.toLowerCase()) {
          targetEl = lastSelected;
        }
        if (!targetEl && !payload.target) {
          targetEl = lastSelected;
        }
        if (!targetEl) {
          console.warn('[PixelMind] Không tìm thấy phần tử mục tiêu:', payload.target);
          return; // TUYỆT ĐỐI DỪNG LẠI, KHÔNG GÁN NHẦM LÊN PHẦN TỬ KHÁC!
        }
        lastSelected = targetEl;

        if (styles) {
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
            var val = styles[k];
            if (val === '' || val === null || val === undefined) {
              targetEl.style.removeProperty(k.replace(/([A-Z])/g, '-$1').toLowerCase());
            } else {
              targetEl.style[k] = val;
            }
          }
        }
        if (typeof textContent === 'string' && textContent.length > 0) {
          // Chỉ gán textContent nếu phần tử KHÔNG có phần tử con (leaf element)
          if (targetEl.children.length === 0) {
            targetEl.textContent = textContent;
          }
        }
        var updated = extractElementInfo(targetEl);
        window.parent.postMessage({
          type: 'PM_SELECT_ELEMENT',
          payload: updated
        }, '*');
      }
    });

    // Chuyển tiếp phím tắt Ctrl+Z (Undo), Ctrl+Y (Redo), Ctrl+S (Save) từ iframe lên PixelMind
    window.addEventListener('keydown', function(e) {
      var isZ = e.key === 'z' || e.key === 'Z';
      var isY = e.key === 'y' || e.key === 'Y';
      var isS = e.key === 's' || e.key === 'S';
      if ((e.ctrlKey || e.metaKey) && (isZ || isY || isS)) {
        var target = e.target;
        var isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
        if (!isInput) {
          e.preventDefault();
          window.parent.postMessage({
            type: 'PM_KEYBOARD_SHORTCUT',
            payload: {
              key: e.key.toLowerCase(),
              ctrlKey: e.ctrlKey || e.metaKey,
              shiftKey: e.shiftKey
            }
          }, '*');
        }
      }
    });

    function reportUrl() {
      try {
        var path = window.location.pathname || '/';
        var href = window.location.href || '';
        window.parent.postMessage({
          type: 'PM_LOCATION_CHANGE',
          payload: {
            pathname: path,
            href: href,
            search: window.location.search || '',
            title: document.title || ''
          }
        }, '*');
      } catch(e) {}
    }
    reportUrl();
    window.addEventListener('popstate', reportUrl);
    window.addEventListener('hashchange', reportUrl);
    window.addEventListener('load', reportUrl);
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

const GENERIC_CSS_CLASSES: Record<string, true> = {
  btn: true, button: true, row: true, col: true, container: true, 'container-fluid': true, 'd-flex': true, flex: true, grid: true,
  card: true, 'card-body': true, 'card-footer': true, 'card-header': true, 'card-title': true, 'card-text': true, 'card-subtitle': true,
  'p-0': true, 'p-1': true, 'p-2': true, 'p-3': true, 'p-4': true, 'p-5': true,
  'm-0': true, 'm-1': true, 'm-2': true, 'm-3': true, 'm-4': true, 'm-5': true,
  'mt-1': true, 'mt-2': true, 'mt-3': true, 'mt-4': true, 'mt-5': true,
  'mb-1': true, 'mb-2': true, 'mb-3': true, 'mb-4': true, 'mb-5': true,
  'my-1': true, 'my-2': true, 'my-3': true, 'mx-1': true, 'mx-2': true, 'mx-3': true, 'mx-auto': true,
  'text-center': true, 'text-left': true, 'text-right': true, 'text-muted': true, 'text-dark': true, 'text-light': true, 'text-white': true,
  'w-100': true, 'h-100': true, 'w-full': true, 'h-full': true,
  active: true, show: true, fade: true, collapse: true, hidden: true, block: true, 'inline-block': true,
  relative: true, absolute: true, fixed: true, small: true, 'fs-1': true, 'fs-2': true, 'fs-3': true, 'fs-4': true, 'fs-5': true, 'fs-6': true,
  'form-control': true, 'form-label': true, 'form-select': true, 'form-check': true, 'form-check-input': true,
  'fw-bold': true, 'fw-normal': true, 'fw-semibold': true, 'fw-bolder': true,
  'shadow-sm': true, shadow: true, 'shadow-lg': true, 'shadow-none': true,
  'border-0': true, border: true, rounded: true, 'rounded-1': true, 'rounded-2': true, 'rounded-3': true, 'rounded-pill': true, 'rounded-circle': true,
}

async function scanProjectForSource(
  rootDir: string,
  textSnippet?: string,
  tagName?: string,
  className?: string,
  currentPath?: string,
  id?: string,
  _selector?: string
): Promise<{ filePath: string; fullPath: string; lineNumber: number; lineContent: string } | null> {
  const exts = [
    '.cshtml', '.razor',
    '.tsx', '.jsx', '.ts', '.js',
    '.vue', '.svelte',
    '.html', '.htm', '.xhtml', '.ejs', '.hbs',
    '.php',
    '.jinja', '.jinja2', '.py',
    '.dart',
    '.xaml', '.xml',
    '.css', '.scss', '.sass', '.less',
  ]
  const ignoreDirs = [
    'node_modules', '.git', 'bin', 'obj', 'dist', 'build', '.vs', '.vscode',
    '.next', '.nuxt', 'out', 'release', '.dart_tool', '__pycache__', 'venv', '.venv'
  ]

  const routeTokens = (currentPath || '')
    .toLowerCase()
    .split(/[\/\\]/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !['http:', 'https:', 'localhost'].includes(t))

  const rawClasses = (className || '').trim().split(/\s+/).filter(Boolean)
  const specificClasses = rawClasses.filter((c) => !GENERIC_CSS_CLASSES[c.toLowerCase()] && c.length > 2)

  const candidates: Array<{
    filePath: string
    fullPath: string
    lineNumber: number
    lineContent: string
    score: number
  }> = []

  async function walk(dir: string): Promise<void> {
    let entries: string[] = []
    try {
      entries = await fs.readdir(dir)
    } catch {
      return
    }

    for (const entry of entries) {
      if (ignoreDirs.includes(entry)) continue
      const full = join(dir, entry)
      try {
        const stat = await fs.stat(full)
        if (stat.isDirectory()) {
          await walk(full)
        } else if (stat.isFile() && exts.some((ext) => entry.toLowerCase().endsWith(ext))) {
          const content = await fs.readFile(full, 'utf8')
          const relPath = full.replace(rootDir, '').replace(/^[\\/]/, '').replace(/\\/g, '/')
          const lowerRel = relPath.toLowerCase()

          // 1. Điểm tương thích Route / Đường dẫn tệp
          let routeScore = 0
          if (routeTokens.length > 0) {
            const matchesRoute = routeTokens.some((t) => lowerRel.includes(t))
            if (matchesRoute) {
              routeScore += 80
            } else if (lowerRel.includes('shared') || lowerRel.includes('_layout') || lowerRel.includes('components')) {
              routeScore += 25
            } else {
              routeScore -= 40 // Trừ điểm nặng đối với view thuộc trang khác
            }
          }

          const lines = content.split(/\r?\n/)
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            let lineScore = routeScore
            let matched = false
            let actualLineNumber = i + 1

            // 2. Khớp ID thuộc tính (độ tin cậy cao nhất)
            if (id && (line.includes(`id="${id}"`) || line.includes(`id='${id}'`) || line.includes(`id=${id}`))) {
              lineScore += 160
              matched = true
            }

            // 3. Khớp Text Snippet (chuỗi hiển thị trên phần tử)
            if (textSnippet && textSnippet.length >= 2 && line.includes(textSnippet)) {
              lineScore += 70
              matched = true

              if (tagName) {
                const tagPattern = new RegExp(`<${tagName}(\\s|>|$)`, 'i')
                if (tagPattern.test(line)) {
                  lineScore += 80
                } else {
                  for (let j = i - 1; j >= 0 && j >= i - 15; j--) {
                    if (tagPattern.test(lines[j])) {
                      actualLineNumber = j + 1
                      lineScore += 60
                      break
                    }
                  }
                }
              }
            }

            // 4. Khớp Class đặc trưng (loại trừ generic utility classes)
            if (specificClasses.length > 0) {
              let matchedSpecific = 0
              for (const sc of specificClasses) {
                if (line.includes(sc)) matchedSpecific++
              }
              if (matchedSpecific > 0) {
                lineScore += 40 + (matchedSpecific - 1) * 20
                matched = true
              }
            }

            // 5. Nếu chỉ có generic classes, chỉ chấp nhận khi có >=2 generic classes và routeScore > 0
            if (!matched && specificClasses.length === 0 && rawClasses.length >= 2 && routeScore > 0) {
              const matchedGeneric = rawClasses.filter((gc) => line.includes(gc)).length
              if (matchedGeneric >= 2) {
                lineScore += 15
                matched = true
              }
            }

            if (matched && lineScore >= 40) {
              candidates.push({
                filePath: relPath,
                fullPath: full,
                lineNumber: actualLineNumber,
                lineContent: lines[actualLineNumber - 1].trim(),
                score: lineScore,
              })
            }
          }
        }
      } catch {
        // Bỏ qua lỗi đọc file
      }
    }
  }

  await walk(rootDir)
  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]
  return best.score >= 40 ? best : null
}

ipcMain.handle(
  'inspect:locate-source',
  async (_e, { projectPath, textSnippet, tagName, className, currentPath, id, selector }) => {
    if (!projectPath) return null
    return await scanProjectForSource(projectPath, textSnippet, tagName, className, currentPath, id, selector)
  }
)

function camelToKebabCase(str: string): string {
  return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase()
}

ipcMain.handle(
  'inspect:sync-code',
  async (
    _e,
    {
      fullPath,
      oldText,
      newText,
      styles,
      tagName,
      lineNumber,
    }: {
      fullPath: string
      oldText?: string
      newText?: string
      styles?: Record<string, string>
      tagName?: string
      lineNumber?: number
    }
  ) => {
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

      // Chuẩn hóa phổ quát cho mọi loại dự án (HTML, React JSX/TSX, Vue, Svelte, PHP, ASP.NET):
      const finalStyles: Record<string, string> = { ...(styles || {}) }

      // Quy chuẩn CSS W3C phổ quát: Nếu có tọa độ left hoặc top, bắt buộc phải có position (relative hoặc absolute)
      if ((finalStyles.left !== undefined || finalStyles.top !== undefined) && (!finalStyles.position || finalStyles.position === 'static')) {
        finalStyles.position = 'relative'
      }

      // Quy chuẩn CSS W3C phổ quát: Nếu co giãn width/height trên thẻ inline phổ thông, tự động chuyển sang inline-block
      const inlineTags = ['a', 'span', 'strong', 'em', 'b', 'i', 'label', 'small']
      if ((finalStyles.width !== undefined || finalStyles.height !== undefined) && inlineTags.includes((tagName || '').toLowerCase())) {
        if (!finalStyles.display) {
          finalStyles.display = 'inline-block'
        }
      }

      const styleEntries = Object.entries(finalStyles).filter(([_, v]) => Boolean(v))
      const tagStr = (tagName || '[a-zA-Z0-9_-]+').toLowerCase()
      const tagRegex = new RegExp(`(<${tagStr})(\\s|>|$)`, 'i')

      // 1. Tìm dòng mở thẻ <tagName
      let tagLineIdx = -1
      if (targetLineIdx !== -1) {
        if (tagRegex.test(lines[targetLineIdx])) {
          tagLineIdx = targetLineIdx
        } else {
          // Quét ngược lên trên tối đa 30 dòng để tìm thẻ mở
          for (let j = targetLineIdx - 1; j >= 0 && j >= targetLineIdx - 30; j--) {
            if (tagRegex.test(lines[j])) {
              tagLineIdx = j
              break
            }
          }
          // Nếu không thấy thì quét xuôi xuống dưới tối đa 10 dòng
          if (tagLineIdx === -1) {
            for (let j = targetLineIdx + 1; j < lines.length && j <= targetLineIdx + 10; j++) {
              if (tagRegex.test(lines[j])) {
                tagLineIdx = j
                break
              }
            }
          }
        }
      } else {
        tagLineIdx = lines.findIndex((l) => tagRegex.test(l))
      }

      // 2. Cập nhật thuộc tính style vào thẻ mở
      let modified = false
      if (styleEntries.length > 0 && tagLineIdx !== -1) {
        let line = lines[tagLineIdx]
        if (isJsx) {
          const jsxStyleStr = styleEntries.map(([k, v]) => `${k}: '${v}'`).join(', ')
          if (/style=\{\{.*?\}\}/i.test(line)) {
            line = line.replace(/style=\{\{.*?\}\}/i, `style={{ ${jsxStyleStr} }}`)
          } else {
            line = line.replace(tagRegex, `$1 style={{ ${jsxStyleStr} }}$2`)
          }
        } else {
          // HTML / CSHTML / Razor
          const existingStyleMatch = line.match(/style=(["'])(.*?)\1/i)
          if (existingStyleMatch) {
            const existingMap: Record<string, string> = {}
            existingStyleMatch[2].split(';').forEach((part) => {
              const colonIdx = part.indexOf(':')
              if (colonIdx !== -1) {
                const k = part.slice(0, colonIdx).trim()
                const v = part.slice(colonIdx + 1).trim()
                if (k && v) existingMap[k.toLowerCase()] = v
              }
            })
            styleEntries.forEach(([k, v]) => {
              existingMap[camelToKebabCase(k)] = v
            })
            const mergedStyleStr = Object.entries(existingMap)
              .map(([k, v]) => `${k}: ${v};`)
              .join(' ')
            line = line.replace(/style=(["']).*?\1/i, `style="${mergedStyleStr}"`)
          } else {
            const htmlStyleStr = styleEntries.map(([k, v]) => `${camelToKebabCase(k)}: ${v};`).join(' ')
            line = line.replace(tagRegex, `$1 style="${htmlStyleStr}"$2`)
          }
        }
        lines[tagLineIdx] = line
        modified = true
      }

      // 3. Cập nhật nội dung văn bản nếu có
      if (oldText && newText && oldText !== newText) {
        let textLineIdx = -1
        if (targetLineIdx !== -1 && lines[targetLineIdx]?.includes(oldText)) {
          textLineIdx = targetLineIdx
        } else if (tagLineIdx !== -1) {
          for (let k = tagLineIdx; k < lines.length && k <= tagLineIdx + 20; k++) {
            if (lines[k].includes(oldText)) {
              textLineIdx = k
              break
            }
          }
        } else {
          textLineIdx = lines.findIndex((l) => l.includes(oldText))
        }

        if (textLineIdx !== -1) {
          lines[textLineIdx] = lines[textLineIdx].replace(oldText, newText)
          modified = true
        }
      }

      if (modified) {
        content = lines.join('\n')
        await fs.writeFile(fullPath, content, 'utf8')
        return { success: true, updatedLine: tagLineIdx !== -1 ? lines[tagLineIdx] : undefined }
      }

      if (oldText && newText && oldText !== newText && content.includes(oldText)) {
        content = content.replace(oldText, newText)
        await fs.writeFile(fullPath, content, 'utf8')
        return { success: true }
      }

      return { success: false, error: 'Không tìm thấy phần tử tương ứng trong tệp mã nguồn' }
    } catch (err: unknown) {
      return { success: false, error: String(err) }
    }
  }
)

/* ───────────────────────── IPC: Design Tokens & Theme Manager (Phân hệ 3) ───────────────────────── */

async function findProjectCssDir(rootDir: string): Promise<string> {
  const directCandidates = [
    join(rootDir, 'wwwroot', 'css'),
    join(rootDir, 'src', 'styles'),
    join(rootDir, 'styles'),
    join(rootDir, 'css'),
    join(rootDir, 'assets', 'css'),
  ]
  for (const d of directCandidates) {
    if (await isDirectory(d)) return d
  }

  // Quét các thư mục con (ví dụ Solution/WebProject/wwwroot/css trong dự án .NET hoặc monorepo)
  try {
    const entries = await fs.readdir(rootDir)
    for (const e of entries) {
      if (['node_modules', '.git', 'bin', 'obj', '.vs', '.vscode', 'dist', 'build', '.pixelmind'].includes(e)) continue
      const sub = join(rootDir, e)
      if (await isDirectory(sub)) {
        const subCandidates = [
          join(sub, 'wwwroot', 'css'),
          join(sub, 'src', 'styles'),
          join(sub, 'styles'),
          join(sub, 'css'),
          join(sub, 'assets', 'css'),
        ]
        for (const sd of subCandidates) {
          if (await isDirectory(sd)) return sd
        }
      }
    }
  } catch {}

  return rootDir
}

ipcMain.handle('tokens:get', async (_e, projectPath: string): Promise<DesignTokens> => {
  if (!projectPath) return DEFAULT_DESIGN_TOKENS
  try {
    const metaPath = join(projectPath, '.pixelmind', 'tokens.json')
    try {
      const data = JSON.parse(await fs.readFile(metaPath, 'utf8')) as DesignTokens
      if (data && Array.isArray(data.colors)) return data
    } catch {}

    // Dò tìm file variables.css trong các thư mục phổ biến của dự án (kể cả Solution lồng)
    const cssDir = await findProjectCssDir(projectPath)
    const candidates = [
      join(cssDir, 'variables.css'),
      join(projectPath, 'variables.css'),
    ]
    for (const c of candidates) {
      try {
        const text = await fs.readFile(c, 'utf8')
        const parsed = parseVariablesCss(text)
        if (parsed.colors && parsed.colors.length > 0) {
          return {
            ...DEFAULT_DESIGN_TOKENS,
            ...parsed,
          }
        }
      } catch {}
    }
  } catch {}
  return DEFAULT_DESIGN_TOKENS
})

ipcMain.handle(
  'tokens:save',
  async (
    _e,
    {
      projectPath,
      tokens,
      syncTarget = 'both',
    }: {
      projectPath: string
      tokens: DesignTokens
      syncTarget?: 'css' | 'tailwind' | 'both'
    }
  ): Promise<{ success: boolean; filePath?: string; tailwindPath?: string; error?: string }> => {
    if (!projectPath) return { success: false, error: 'Chưa có đường dẫn dự án' }
    try {
      // 1. Lưu metadata trọn vẹn vào .pixelmind/tokens.json
      const metaDir = join(projectPath, '.pixelmind')
      await fs.mkdir(metaDir, { recursive: true })
      await fs.writeFile(join(metaDir, 'tokens.json'), JSON.stringify(tokens, null, 2), 'utf8')

      // 2. Xác định vị trí lưu variables.css chuẩn xác theo cấu trúc dự án (kể cả Solution lồng nhiều cấp)
      const cssDir = await findProjectCssDir(projectPath)
      await fs.mkdir(cssDir, { recursive: true })
      const targetCssPath = join(cssDir, 'variables.css')

      const cssContent = generateVariablesCss(tokens)
      await fs.writeFile(targetCssPath, cssContent, 'utf8')

      // Tự động kiểm tra file CSS chính (site.css, main.css, style.css...) để nhúng @import nếu chưa có
      const mainCssNames = ['site.css', 'main.css', 'app.css', 'style.css', 'global.css']
      for (const name of mainCssNames) {
        const fullMain = join(cssDir, name)
        try {
          const stat = await fs.stat(fullMain)
          if (stat.isFile()) {
            let raw = await fs.readFile(fullMain, 'utf8')
            if (!raw.includes('variables.css')) {
              raw = `@import './variables.css';\n\n${raw}`
              await fs.writeFile(fullMain, raw, 'utf8')
            }
            break
          }
        } catch {}
      }

      // Lưu thêm 1 bản dự phòng ở root nếu cssDir khác projectPath
      if (cssDir !== projectPath) {
        await fs.writeFile(join(projectPath, 'variables.css'), cssContent, 'utf8').catch(() => {})
      }

      // 3. Nếu đồng bộ với Tailwind
      let tailwindPath: string | undefined = undefined
      if (syncTarget === 'tailwind' || syncTarget === 'both') {
        const twFile = join(projectPath, 'tailwind.tokens.js')
        const twContent = generateTailwindTokensConfig(tokens)
        await fs.writeFile(twFile, twContent, 'utf8')
        tailwindPath = twFile.replace(projectPath, '').replace(/^[\\/]/, '').replace(/\\/g, '/')
      }

      // 4. Áp dụng CSS variables ngay lập tức vào iframe xem trước (Live Reflection)
      if (mainWindow && !mainWindow.isDestroyed()) {
        const liveScript = `
          (function() {
            var el = document.getElementById('pm-design-tokens-live');
            if (!el) {
              el = document.createElement('style');
              el.id = 'pm-design-tokens-live';
              document.head.appendChild(el);
            }
            el.textContent = ${JSON.stringify(cssContent)};
          })();
        `
        const frames = getAllWebFrames(mainWindow.webContents.mainFrame)
        for (const frame of frames) {
          if (frame !== mainWindow.webContents.mainFrame) {
            frame.executeJavaScript(liveScript).catch(() => {})
          }
        }
      }

      return {
        success: true,
        filePath: targetCssPath.replace(projectPath, '').replace(/^[\\/]/, '').replace(/\\/g, '/'),
        tailwindPath,
      }
    } catch (err) {
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
