import { app, BrowserWindow, dialog, ipcMain, Menu, screen, session, shell } from 'electron'
import { basename, dirname, extname, join, resolve, sep } from 'node:path'
import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { MenuItemConstructorOptions, OpenDialogOptions } from 'electron'
import type {
  DesignTokens,
  GitGraphScope,
  GitRollbackResult,
  ProjectPage,
  ProjectRecord,
  Settings,
  StoreData,
  TerminalCreateOptions,
} from '../../shared/types'
import type { ToolboxMutationPayload, ToolboxWritePayload } from '../../shared/toolbox'
import {
  DEFAULT_DESIGN_TOKENS,
  generateVariablesCss,
  generateTailwindTokensConfig,
  generateTailwindThemeCss,
  parseVariablesCss,
  stylesToTailwindClasses,
} from '../../shared/designTokens'
import { readStore, patchStore, patchProject, appendActivity, updateSettings, resetSettings, resetStore, storeFilePath } from './store'
import {
  addDevScriptToPkg,
  createIndexHtmlFile,
  detectProject,
  diagnoseProject,
  gitBranch,
  gitCheckoutBranch,
  gitCommitMessage,
  gitCreateNewBranch,
  gitDiscardPaths,
  gitFetch,
  gitPullProject,
  gitPushProject,
  getGitDiffStats,
  gitRevertFiles,
  gitStagePaths,
  gitUnstagePaths,
  initGit,
  isDirectory,
  listGitBranches,
  readFileContent,
  readGitGraph,
  readGitStatus,
  readTree,
  rollbackGit,
  searchProjectContent,
  statProject,
  writeFileContent,
} from './projects'
import { RunnerManager } from './runner'
import { decideQuit } from './quitGuard'
import {
  normalizeWindowState,
  readWindowStateFile,
  writeWindowStateFile,
  type WindowState,
} from './windowState'
import { TerminalManager } from './terminal'
import {
  copyPageFile,
  normalizePageRoute,
  resolvePageTarget,
  scaffoldPageFile,
  trashPageFile,
} from './pages'
import { runToolboxMutation, scanProjectToolbox, writeToolboxFile } from './toolbox'
import {
  applyHtmlTailwindAttributes,
  applyJsxTailwindAttributes,
  camelToKebabCase,
} from './styleSync'
import {
  cancelChat,
  clearChatHistory,
  rewriteChatHistory,
  getChatHistory,
  getConversations,
  removeConversation,
  getStatus,
  listModels,
  startChat,
  completeAi,
  testConnection,
  getActiveBridge,
  setActiveBridge,
  listBridges,
  pingBridge,
  killSwitch,
  saveApiKey,
} from './ai'
import { listAuditLogs, clearAuditLogs } from './aiAudit'
import { getCostStats, setTokenBudget, resetCostStats } from './aiCost'
import { runCliAgent, stopCliAgent, detectInstalledClis, listAgentModels } from './cliBridge'
import { ideWsBridge } from './ideWsBridge'
import { buildContextPack } from './aiContext'
import { acceptChange, listChanges, proposeChange, rejectChange, undoChange } from './aiApply'
import { listToolLogs, runTool, TOOL_SCHEMAS } from './aiTools'
import type {
  AiBridgeKind,
  AiChatEntry,
  AiChatStartRequest,
  AiCliRunRequest,
  AiContextRequest,
  AiProposeChangeRequest,
  AiToolCallRequest,
} from '../../shared/ai'
import type { FileSearchOptions } from '../../shared/api'

// Tắt Same-Origin Policy & Site Isolation cho iframe trong Electron
app.commandLine.appendSwitch('disable-web-security')
app.commandLine.appendSwitch('disable-site-isolation-trials')
app.commandLine.appendSwitch('disable-features', 'IsolateOrigins,site-per-process')

const isDev = !app.isPackaged

const ASSET_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif']
const ASSET_EXTENSION_SET = new Set(ASSET_EXTENSIONS)

/** Thư mục lưu bản sao lưu ảnh đã xoá, phục vụ Undo/Redo trong tab Assets. */
function assetBackupDir(): string {
  // Dùng thư mục tạm: lịch sử undo chỉ tồn tại trong phiên, không cần lưu lâu dài.
  return join(app.getPath('temp'), 'pixelmind-asset-backups')
}

/** Tìm tên tệp chưa tồn tại trong thư mục (thêm hậu tố -1, -2…). */
async function uniqueFilePath(dir: string, fileName: string): Promise<string> {
  const extension = extname(fileName)
  const stem = fileName.slice(0, fileName.length - extension.length) || fileName
  let suffix = 0
  for (;;) {
    const candidate = suffix === 0 ? join(dir, fileName) : join(dir, `${stem}-${suffix}${extension}`)
    try {
      await fs.access(candidate)
      suffix += 1
    } catch {
      return candidate
    }
  }
}

let mainWindow: BrowserWindow | null = null

const runner = new RunnerManager(
  (log) => mainWindow?.webContents.send('run:log', log),
  (state) => mainWindow?.webContents.send('run:state', state),
)

const terminalManager = new TerminalManager(
  (event) => mainWindow?.webContents.send('terminal:data', event),
  (event) => mainWindow?.webContents.send('terminal:exit', event),
)

/* ── Chặn thoát khi dev server còn chạy (Settings → confirmQuitRunning) ── */
let allowWindowClose = false
let quitApproved = false
let quitPromptOpen = false

/** Số tiến trình máy chủ đang chạy hoặc đang khởi động. */
function countRunningProcesses(): number {
  return runner.list().filter((state) => state.status === 'running' || state.status === 'starting').length
}

async function confirmQuitWithUser(runningCount: number): Promise<boolean> {
  const running = runner.list().filter((state) => state.status === 'running' || state.status === 'starting')
  const names = running
    .map((state) => state.script)
    .filter(Boolean)
    .slice(0, 4)
    .join(', ')
  const options = {
    type: 'warning' as const,
    title: 'Máy chủ vẫn đang chạy',
    message: `Còn ${runningCount} tiến trình máy chủ đang chạy`,
    detail:
      `${names ? `Tiến trình: ${names}\n\n` : ''}` +
      'Nếu thoát, PixelMind sẽ dừng các tiến trình này và giải phóng cổng mạng. ' +
      'Chọn “Ở lại” để tiếp tục làm việc mà không dừng máy chủ.',
    buttons: ['Ở lại', 'Thoát và dừng máy chủ'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  }
  const result = mainWindow
    ? await dialog.showMessageBox(mainWindow, options)
    : await dialog.showMessageBox(options)
  // Chỉ nút thứ hai mới đồng ý thoát; Esc / đóng hộp thoại = ở lại.
  return result.response === 1
}

/** Hỏi xác nhận trước khi đóng cửa sổ hoặc thoát ứng dụng. */
async function requestQuitApproval(): Promise<boolean> {
  const decision = await decideQuit({
    readConfirmSetting: async () => (await readStore()).settings.confirmQuitRunning,
    countRunning: countRunningProcesses,
    confirmExit: confirmQuitWithUser,
  })
  if (!decision.allow) {
    // "Ở lại": không dừng runner, không đóng cửa sổ.
    console.info(`[quit] Người dùng chọn ở lại (${decision.reason}).`)
  }
  return decision.allow
}

/** Bắt đầu một lượt xin phép thoát (chống mở nhiều hộp thoại cùng lúc). */
function handleQuitAttempt(): void {
  if (quitPromptOpen) return
  quitPromptOpen = true
  void (async () => {
    try {
      const allow = await requestQuitApproval()
      if (!allow) return
      quitApproved = true
      allowWindowClose = true
      if (mainWindow) mainWindow.close()
      else app.quit()
    } catch (error) {
      console.error('[quit] Không xác nhận được yêu cầu thoát:', error)
    } finally {
      quitPromptOpen = false
    }
  })()
}

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
        {
          label: 'Màn hình làm việc',
          accelerator: 'CmdOrCtrl+Shift+W',
          click: () => sendMenuAction('view-workspace'),
        },
        {
          label: 'Lưu thay đổi mã nguồn',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendMenuAction('save'),
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
      label: 'Chỉnh sửa',
      submenu: [
        {
          label: 'Hoàn tác (Undo)',
          accelerator: 'CmdOrCtrl+Z',
          click: () => sendMenuAction('undo'),
        },
        {
          label: 'Làm lại (Redo)',
          accelerator: 'CmdOrCtrl+Y',
          click: () => sendMenuAction('redo'),
        },
        { type: 'separator' },
        {
          label: 'Bảng lệnh…',
          accelerator: 'CmdOrCtrl+K',
          click: () => sendMenuAction('palette'),
        },
      ],
    },
    {
      label: 'Chạy',
      submenu: [
        { label: 'Chạy dự án', accelerator: 'F5', click: () => sendMenuAction('run') },
        { label: 'Dừng máy chủ', accelerator: 'Shift+F5', click: () => sendMenuAction('stop') },
        { type: 'separator' },
        {
          label: 'Cài đặt / Khôi phục thư viện',
          click: () => sendMenuAction('install-deps'),
        },
        {
          label: 'Báo cáo kiểm tra dự án',
          click: () => sendMenuAction('diagnose'),
        },
        { type: 'separator' },
        { label: 'Tải lại cây tệp', accelerator: 'CmdOrCtrl+R', click: () => sendMenuAction('refresh') },
      ],
    },
    {
      label: 'Xem',
      submenu: [
        {
          label: 'Ẩn / Hiện thanh bên (Sidebar)',
          accelerator: 'CmdOrCtrl+B',
          click: () => sendMenuAction('toggle-sidebar'),
        },
        { type: 'separator' },
        {
          label: 'Cây tệp (Files)',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => sendMenuAction('tab-files'),
        },
        {
          label: 'Cây phân cấp (Layers)',
          accelerator: 'CmdOrCtrl+Shift+L',
          click: () => sendMenuAction('tab-layers'),
        },
        {
          label: 'Danh sách trang (Pages)',
          click: () => sendMenuAction('tab-pages'),
        },
        {
          label: 'Tài nguyên (Assets)',
          click: () => sendMenuAction('tab-assets'),
        },
        {
          label: 'Lịch sử phiên bản (Versions)',
          click: () => sendMenuAction('tab-versions'),
        },
        {
          label: 'Hệ thống thiết kế (Design Tokens)',
          click: () => sendMenuAction('tab-design'),
        },
        {
          label: 'Thư viện linh kiện (Parts)',
          click: () => sendMenuAction('tab-parts'),
        },
        { type: 'separator' },
        {
          label: 'Ẩn / Hiện Nhật ký chạy',
          accelerator: 'CmdOrCtrl+J',
          click: () => sendMenuAction('toggle-logs'),
        },
        {
          label: 'Chế độ tập trung Canvas',
          click: () => sendMenuAction('focus-canvas'),
        },
        { type: 'separator' },
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
      label: 'Công cụ',
      submenu: [
        {
          label: 'Soi phần tử trực quan (Inspect)',
          accelerator: 'I',
          click: () => sendMenuAction('toggle-inspect'),
        },
        {
          label: 'Hệ thống thiết kế (Design Tokens)',
          click: () => sendMenuAction('tokens'),
        },
        {
          label: 'Mở trang trong trình duyệt ngoài',
          click: () => sendMenuAction('open-browser'),
        },
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

/** File lưu trạng thái cửa sổ (bounds + maximize) trong thư mục dữ liệu ứng dụng. */
function windowStatePath(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

function createWindow() {
  /* Co cửa sổ theo vùng làm việc thực tế để không bị tràn ra ngoài màn hình
     (máy dùng tỉ lệ hiển thị 125% thường có vùng làm việc nhỏ hơn 1440×900). */
  const { workAreaSize } = screen.getPrimaryDisplay()
  const defaultWidth = Math.min(1440, Math.max(960, workAreaSize.width - 24))
  const defaultHeight = Math.min(900, Math.max(640, workAreaSize.height - 24))

  /* Khôi phục đúng vị trí/kích thước và trạng thái maximize của lần thoát trước. */
  const workAreas = screen.getAllDisplays().map((display) => display.workArea)
  const stateFilePath = windowStatePath()
  const savedState = normalizeWindowState(readWindowStateFile(stateFilePath), workAreas)
  const savedBounds = savedState?.bounds

  const width = savedBounds?.width ?? defaultWidth
  const height = savedBounds?.height ?? defaultHeight

  mainWindow = new BrowserWindow({
    x: savedBounds?.x,
    y: savedBounds?.y,
    width,
    height,
    minWidth: Math.min(1080, width),
    minHeight: Math.min(680, height),
    show: false,
    frame: false,
    icon: join(__dirname, '../../src/assets/icon.png'),
    title: 'PixelMind',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      sandbox: false,
      spellcheck: false,
    },
  })

  let stateSaveTimer: ReturnType<typeof setTimeout> | null = null

  /** Chụp trạng thái hiện tại; khi đang maximize vẫn lưu kích thước "bình thường". */
  const captureWindowState = (): WindowState | null => {
    if (!mainWindow || mainWindow.isDestroyed()) return null
    if (mainWindow.isMinimized() || mainWindow.isFullScreen()) return null
    const maximized = mainWindow.isMaximized()
    const rawBounds = maximized ? mainWindow.getNormalBounds() : mainWindow.getBounds()
    const normalized = normalizeWindowState(
      { bounds: rawBounds, maximized },
      screen.getAllDisplays().map((display) => display.workArea),
    )
    return normalized ?? { bounds: rawBounds, maximized }
  }

  const persistWindowState = () => {
    const state = captureWindowState()
    if (state) writeWindowStateFile(stateFilePath, state)
  }

  /* Gộp các sự kiện resize/move/maximize liên tiếp thành một lần ghi. */
  const queueWindowStateSave = () => {
    if (stateSaveTimer !== null) clearTimeout(stateSaveTimer)
    stateSaveTimer = setTimeout(() => {
      stateSaveTimer = null
      persistWindowState()
    }, 350)
  }

  mainWindow.on('resize', queueWindowStateSave)
  mainWindow.on('move', queueWindowStateSave)
  mainWindow.on('maximize', queueWindowStateSave)
  mainWindow.on('unmaximize', queueWindowStateSave)

  mainWindow.on('ready-to-show', () => {
    // Áp trạng thái maximize trước khi hiện để tránh nháy từ kích thước thường sang toàn màn hình.
    if (savedState?.maximized) mainWindow?.maximize()
    mainWindow?.show()
  })

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
    try {
      if (!url || typeof url !== 'string') return { action: 'deny' }
      // Không đẩy ra trình duyệt ngoài nếu là url nội bộ hoặc dev server localhost
      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        return { action: 'allow' }
      }
      if (/^https?:/i.test(url)) {
        const parsed = new URL(url)
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          void shell.openExternal(url).catch(() => {})
        }
      }
    } catch {}
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const current = mainWindow?.webContents.getURL() ?? ''
      // Chỉ cho phép Vite HMR dev server của chính ứng dụng desktop
      const rendererUrl = process.env['ELECTRON_RENDERER_URL']
      if (isDev && rendererUrl && url.startsWith(rendererUrl)) {
        return
      }
      // Ngăn chặn tuyệt đối mainWindow bị điều hướng khi người dùng kéo thả hoặc drop URL vào cửa sổ chính
      if (url !== current) {
        event.preventDefault()
        if (/^https?:/i.test(url)) {
          const parsed = new URL(url)
          if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            void shell.openExternal(url).catch(() => {})
          }
        }
      }
    } catch {
      event.preventDefault()
    }
  })

  mainWindow.on('close', (event) => {
    // Luôn lưu trạng thái cửa sổ trước khi xử lý thoát (kể cả khi người dùng chọn Ở lại).
    if (stateSaveTimer !== null) {
      clearTimeout(stateSaveTimer)
      stateSaveTimer = null
    }
    persistWindowState()

    // Đã xác nhận thoát → cho đóng; ngược lại hỏi trước khi dừng máy chủ.
    if (allowWindowClose) return
    event.preventDefault()
    handleQuitAttempt()
  })

  mainWindow.on('closed', () => {
    if (stateSaveTimer !== null) {
      clearTimeout(stateSaveTimer)
      stateSaveTimer = null
    }
    mainWindow = null
    allowWindowClose = false
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

ipcMain.handle('store:reset-settings', async (): Promise<Settings> => resetSettings())

ipcMain.handle('system:clear-cache', async (): Promise<boolean> => {
  try {
    await session.defaultSession.clearCache()
    await session.defaultSession.clearStorageData()
    return true
  } catch {
    return false
  }
})

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
      /* Đồng bộ danh sách trang: lấy các trang được quét chuẩn từ fresh.meta.pages,
         đồng thời giữ lại các trang tự thêm/mockup của người dùng */
      pages: (() => {
        if (!fresh.meta.pages.length) return project.meta.pages
        const isDotnet = project.framework?.includes('ASP.NET') || fresh.framework?.includes('ASP.NET') || fresh.packageManager === 'dotnet'
        const normalizeRel = (value?: string) => (value ?? '').replace(/\\/g, '/').toLowerCase()
        const updated = fresh.meta.pages.map((fp) => {
          const matched = project.meta.pages.find((p) => {
            if (p.filePath && fp.filePath && normalizeRel(p.filePath) === normalizeRel(fp.filePath)) {
              return true
            }
            let pRoute = p.route
            if (isDotnet && pRoute.startsWith('/account/')) pRoute = `/Identity/Account/${pRoute.slice(9)}`
            return pRoute.toLowerCase() === fp.route.toLowerCase() || p.title.toLowerCase() === fp.title.toLowerCase()
          })
          if (!matched) return fp
          /* Giữ metadata người dùng đã chỉnh, nhưng route/tệp luôn lấy theo lần quét mới. */
          return {
            ...fp,
            id: matched.id,
            title: matched.title || fp.title,
            mockup: matched.mockup,
            software: matched.software,
            frame: matched.frame,
            navLinkSelector: matched.navLinkSelector,
            sampleParams: matched.sampleParams,
            filePath: fp.filePath ?? matched.filePath,
          }
        })
        /* Giữ các trang thủ công (không gắn với tệp thật). Trang đã có tệp mà không còn
           được quét thấy nghĩa là tệp đã bị xoá/đổi tên → loại khỏi danh sách. */
        const extras = project.meta.pages.filter(
          (p) => !p.filePath && !updated.some((u) => u.route.toLowerCase() === p.route.toLowerCase()),
        )
        return [...updated, ...extras]
      })(),
      customCommand: project.meta.customCommand || fresh.meta.customCommand,
      activity: project.meta.activity,
    },
  }
  /* Chẩn đoán lại theo lệnh tự nhập để không báo thiếu script khi đã có lệnh chạy. */
  merged.diagnosis = await diagnoseProject(merged.path, merged.meta.customCommand)
  return merged
}

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

ipcMain.handle('project:git-graph', async (_e, id: string, scope?: GitGraphScope) => {
  const store = await readStore()
  const project = store.projects.find((p) => p.id === id)
  if (!project) return { branch: null, hasRemote: false, commits: [] }
  return readGitGraph(project.path, { scope })
})

ipcMain.handle('project:git-fetch', async (_e, id: string) => {
  const store = await readStore()
  const project = store.projects.find((p) => p.id === id)
  if (!project) return { ok: false, error: 'Không tìm thấy dự án.' }
  return gitFetch(project.path)
})

ipcMain.handle(
  'project:git-rollback',
  async (_e, id: string, hash: string): Promise<GitRollbackResult> => {
    const store = await readStore()
    const project = store.projects.find((p) => p.id === id)
    if (!project) return { ok: false, error: 'Không tìm thấy dự án.' }

    const result = await rollbackGit(project.path, hash)
    if (!result.ok) return result

    const fresh = await detectProject(project.path)
    const updated = await mergeDetected(project, fresh)
    await patchStore({
      projects: store.projects.map((p) => (p.id === id ? updated : p)),
    })
    await appendActivity(id, {
      actor: 'bạn',
      action: `Khôi phục mã nguồn về commit ${hash.slice(0, 7)}${result.safetyRef ? ` (backup: ${result.safetyRef})` : ''}`,
      kind: 'người',
      status: 'ok',
    })

    return { ...result, project: updated }
  },
)

ipcMain.handle('project:git-status', async (_e, id: string) => {
  const store = await readStore()
  const project = store.projects.find((p) => p.id === id)
  if (!project) {
    return {
      branch: null,
      clean: true,
      staged: [],
      unstaged: [],
      untracked: [],
      ahead: 0,
      behind: 0,
    }
  }
  return readGitStatus(project.path)
})

ipcMain.handle('project:git-stage', async (_e, id: string, paths: string[]) => {
  const store = await readStore()
  const project = store.projects.find((p) => p.id === id)
  if (!project) return { ok: false, error: 'Không tìm thấy dự án.' }
  return gitStagePaths(project.path, paths)
})

ipcMain.handle('project:git-unstage', async (_e, id: string, paths: string[]) => {
  const store = await readStore()
  const project = store.projects.find((p) => p.id === id)
  if (!project) return { ok: false, error: 'Không tìm thấy dự án.' }
  return gitUnstagePaths(project.path, paths)
})

ipcMain.handle('project:git-discard', async (_e, id: string, paths: string[]) => {
  const store = await readStore()
  const project = store.projects.find((p) => p.id === id)
  if (!project) return { ok: false, error: 'Không tìm thấy dự án.' }
  return gitDiscardPaths(project.path, paths)
})

ipcMain.handle('project:git-commit', async (_e, id: string, message: string) => {
  const store = await readStore()
  const project = store.projects.find((p) => p.id === id)
  if (!project) return { ok: false, error: 'Không tìm thấy dự án.' }

  const res = await gitCommitMessage(project.path, message)
  if (res.ok) {
    await appendActivity(id, {
      actor: 'bạn',
      action: `Tạo commit: ${message.slice(0, 50)}${message.length > 50 ? '…' : ''}`,
      kind: 'người',
      status: 'ok',
    })
  }
  return res
})

ipcMain.handle('project:git-branches', async (_e, id: string) => {
  const store = await readStore()
  const project = store.projects.find((p) => p.id === id)
  if (!project) return []
  return listGitBranches(project.path)
})

ipcMain.handle('project:git-checkout', async (_e, id: string, branchName: string) => {
  const store = await readStore()
  const project = store.projects.find((p) => p.id === id)
  if (!project) return { ok: false, error: 'Không tìm thấy dự án.' }

  const res = await gitCheckoutBranch(project.path, branchName)
  if (res.ok) {
    const fresh = await detectProject(project.path)
    const updated = await mergeDetected(project, fresh)
    await patchStore({
      projects: store.projects.map((p) => (p.id === id ? updated : p)),
    })
    await appendActivity(id, {
      actor: 'bạn',
      action: `Chuyển sang nhánh “${branchName}”`,
      kind: 'người',
      status: 'ok',
    })
  }
  return res
})

ipcMain.handle('project:git-create-branch', async (_e, id: string, branchName: string, checkout = true) => {
  const store = await readStore()
  const project = store.projects.find((p) => p.id === id)
  if (!project) return { ok: false, error: 'Không tìm thấy dự án.' }

  const res = await gitCreateNewBranch(project.path, branchName, checkout)
  if (res.ok) {
    const fresh = await detectProject(project.path)
    const updated = await mergeDetected(project, fresh)
    await patchStore({
      projects: store.projects.map((p) => (p.id === id ? updated : p)),
    })
    await appendActivity(id, {
      actor: 'bạn',
      action: `Tạo nhánh mới “${branchName}”${checkout ? ' và chuyển sang' : ''}`,
      kind: 'người',
      status: 'ok',
    })
  }
  return res
})

ipcMain.handle('project:git-push', async (_e, id: string, setUpstream = false) => {
  const store = await readStore()
  const project = store.projects.find((p) => p.id === id)
  if (!project) return { ok: false, error: 'Không tìm thấy dự án.' }

  const res = await gitPushProject(project.path, setUpstream)
  if (res.ok) {
    await appendActivity(id, {
      actor: 'bạn',
      action: 'Đẩy mã nguồn lên GitHub (git push)',
      kind: 'người',
      status: 'ok',
    })
  }
  return res
})

ipcMain.handle('project:git-pull', async (_e, id: string) => {
  const store = await readStore()
  const project = store.projects.find((p) => p.id === id)
  if (!project) return { ok: false, error: 'Không tìm thấy dự án.' }

  const res = await gitPullProject(project.path)
  if (res.ok) {
    const fresh = await detectProject(project.path)
    const updated = await mergeDetected(project, fresh)
    await patchStore({
      projects: store.projects.map((p) => (p.id === id ? updated : p)),
    })
    await appendActivity(id, {
      actor: 'bạn',
      action: 'Cập nhật mã nguồn từ GitHub (git pull)',
      kind: 'người',
      status: 'ok',
    })
  }
  return res
})

ipcMain.handle(
  'project:add-page',
  async (
    _e,
    id: string,
    page: Omit<ProjectPage, 'id'>,
    options?: { createFile?: boolean },
  ) => {
    const store = await readStore()
    const project = store.projects.find((p) => p.id === id)
    if (!project) return null

    const route = normalizePageRoute(page.route)
    let filePath: string | undefined
    if (options?.createFile) {
      const target = await resolvePageTarget(project.path, route)
      if (!target.supported) {
        throw new Error(target.reason ?? 'Không hỗ trợ tạo tệp route cho dự án này.')
      }
      if (target.exists) {
        throw new Error(`Tệp ${target.relativePath} đã tồn tại. Hãy chọn route khác.`)
      }
      const created = await scaffoldPageFile(target, page.title)
      filePath = created.relativePath
    }

    const newPage: ProjectPage = { ...page, route, id: randomUUID(), filePath }
    const updated = await patchProject(id, (current) => ({
      ...current,
      meta: { ...current.meta, pages: [...current.meta.pages, newPage] },
    }))
    if (updated) {
      await appendActivity(id, {
        actor: 'bạn',
        action: filePath
          ? `Thêm trang ${route} — ${page.title} (tạo tệp ${filePath})`
          : `Thêm trang ${route} — ${page.title}`,
        kind: 'người',
        status: 'ok',
      })
    }
    return updated
  },
)

ipcMain.handle('project:update-page', async (_e, id: string, page: ProjectPage) => {
  const store = await readStore()
  const project = store.projects.find((p) => p.id === id)
  const current = project?.meta.pages.find((p) => p.id === page.id)
  if (!project || !current) return null

  const route = normalizePageRoute(page.route)
  if (current.filePath && normalizePageRoute(current.route) !== route) {
    throw new Error(
      `Trang này gắn với tệp ${current.filePath}. Hãy đổi tên/thư mục trong tab Files thay vì sửa route tại đây.`,
    )
  }
  const nextPage: ProjectPage = {
    ...page,
    route,
    filePath: current.filePath ?? page.filePath,
  }

  const updated = await patchProject(id, (target) => ({
    ...target,
    meta: {
      ...target.meta,
      pages: target.meta.pages.map((p) => (p.id === nextPage.id ? nextPage : p)),
    },
  }))
  if (updated) {
    await appendActivity(id, {
      actor: 'bạn',
      action: `Cập nhật trang ${route} — ${page.title}`,
      kind: 'người',
      status: 'ok',
    })
  }
  return updated
})

ipcMain.handle(
  'project:remove-page',
  async (_e, id: string, pageId: string, options?: { deleteFile?: boolean }) => {
    const store = await readStore()
    const project = store.projects.find((p) => p.id === id)
    const removed = project?.meta.pages.find((page) => page.id === pageId)
    if (!project || !removed) return null

    let trashed = false
    if (options?.deleteFile && removed.filePath) {
      trashed = await trashPageFile(project.path, removed.filePath)
    }

    const updated = await patchProject(id, (current) => ({
      ...current,
      meta: {
        ...current.meta,
        pages: current.meta.pages.filter((page) => page.id !== pageId),
      },
    }))
    if (updated) {
      await appendActivity(id, {
        actor: 'bạn',
        action: trashed
          ? `Xoá trang ${removed.route} và chuyển tệp ${removed.filePath} vào Thùng rác`
          : `Xoá trang ${removed.route} khỏi danh sách`,
        kind: 'người',
        status: 'warn',
      })
    }
    return updated
  },
)

ipcMain.handle(
  'project:duplicate-page',
  async (
    _e,
    id: string,
    pageId: string,
    payload: { route: string; title: string; copyFile?: boolean },
  ) => {
    const store = await readStore()
    const project = store.projects.find((p) => p.id === id)
    const source = project?.meta.pages.find((page) => page.id === pageId)
    if (!project || !source) return null

    const route = normalizePageRoute(payload.route || `${source.route}-copy`)
    const title = payload.title.trim() || `${source.title} (bản sao)`
    if (
      project.meta.pages.some(
        (page) => normalizePageRoute(page.route).toLowerCase() === route.toLowerCase(),
      )
    ) {
      throw new Error(`Route ${route} đã có trong danh sách trang.`)
    }

    let filePath: string | undefined
    if (payload.copyFile && source.filePath) {
      const target = await resolvePageTarget(project.path, route)
      if (!target.supported) {
        throw new Error(target.reason ?? 'Không hỗ trợ tạo tệp route cho dự án này.')
      }
      if (target.exists) {
        throw new Error(`Tệp ${target.relativePath} đã tồn tại. Hãy chọn route khác.`)
      }
      const copied = await copyPageFile(project.path, source.filePath, target)
      filePath = copied.relativePath
    }

    const newPage: ProjectPage = {
      ...source,
      id: randomUUID(),
      route,
      title,
      filePath,
      sampleParams: source.sampleParams ? [...source.sampleParams] : undefined,
    }
    const updated = await patchProject(id, (current) => ({
      ...current,
      meta: { ...current.meta, pages: [...current.meta.pages, newPage] },
    }))
    if (updated) {
      await appendActivity(id, {
        actor: 'bạn',
        action: filePath
          ? `Nhân bản trang ${source.route} → ${route} (tạo tệp ${filePath})`
          : `Nhân bản trang ${source.route} → ${route} (chỉ metadata)`,
        kind: 'người',
        status: 'ok',
      })
    }
    return updated
  },
)

ipcMain.handle('project:page-file-preview', async (_e, id: string, route: string) => {
  const project = (await readStore()).projects.find((p) => p.id === id)
  if (!project) {
    return {
      supported: false,
      label: '',
      relativePath: '',
      exists: false,
      reason: 'Không tìm thấy dự án.',
    }
  }
  const target = await resolvePageTarget(project.path, route)
  return {
    supported: target.supported,
    label: target.label,
    relativePath: target.relativePath,
    exists: target.exists,
    reason: target.reason,
  }
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

ipcMain.handle('fs:create-file', async (_e, target: string, initialContent = '') => {
  await fs.mkdir(dirname(target), { recursive: true })
  await fs.writeFile(target, initialContent, { encoding: 'utf8', flag: 'wx' })
  return true
})

ipcMain.handle('fs:create-dir', async (_e, target: string) => {
  await fs.mkdir(target, { recursive: true })
  return true
})

ipcMain.handle('fs:rename', async (_e, oldPath: string, newPath: string) => {
  await fs.rename(oldPath, newPath)
  return true
})

ipcMain.handle('fs:trash', async (_e, target: string) => {
  await shell.trashItem(target)
  return true
})

ipcMain.handle(
  'fs:search',
  async (_e, root: string, query: string, options?: FileSearchOptions) => {
    return searchProjectContent(root, query, options)
  },
)

/* ───────────────────────── IPC: tài nguyên ảnh ───────────────────────── */

ipcMain.handle('assets:add', async (_e, projectPath: string) => {
  try {
    const options: OpenDialogOptions = {
      title: 'Chọn ảnh để thêm vào dự án',
      buttonLabel: 'Thêm ảnh',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Hình ảnh', extensions: ASSET_EXTENSIONS }],
    }
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, added: [] as Array<{ source: string; destination: string; copied: boolean }> }
    }

    const targetDir = join(projectPath, 'assets')
    await fs.mkdir(targetDir, { recursive: true })

    const added: Array<{ source: string; destination: string; copied: boolean }> = []
    for (const source of result.filePaths) {
      const sourceName = basename(source)

      // Ảnh đã nằm sẵn trong thư mục assets/ của dự án: không copy, không ghi vào lịch sử undo.
      if (resolve(join(targetDir, sourceName)) === resolve(source)) {
        added.push({ source, destination: source, copied: false })
        continue
      }

      const destination = await uniqueFilePath(targetDir, sourceName)
      await fs.copyFile(source, destination)
      added.push({ source, destination, copied: true })
    }

    return { canceled: false, added }
  } catch (error) {
    return {
      canceled: false,
      added: [] as Array<{ source: string; destination: string; copied: boolean }>,
      error: error instanceof Error ? error.message : String(error),
    }
  }
})

ipcMain.handle('assets:remove', async (_e, target: string) => {
  try {
    const extension = extname(target).replace(/^\./, '').toLowerCase()
    if (!ASSET_EXTENSION_SET.has(extension)) {
      return { success: false, error: 'Chỉ có thể xoá tệp ảnh.' }
    }
    const stat = await fs.stat(target)
    if (!stat.isFile()) {
      return { success: false, error: 'Chỉ có thể xoá tệp ảnh.' }
    }

    // Giữ một bản sao lưu trước khi đưa vào Thùng rác để có thể hoàn tác.
    const backupDir = assetBackupDir()
    await fs.mkdir(backupDir, { recursive: true })
    const backupPath = await uniqueFilePath(backupDir, `${Date.now()}-${basename(target)}`)
    await fs.copyFile(target, backupPath)

    await shell.trashItem(target)
    return { success: true, backupPath }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('assets:restore', async (_e, backupPath: string, destination: string) => {
  try {
    const backupRoot = resolve(assetBackupDir())
    const resolvedBackup = resolve(backupPath)
    if (!resolvedBackup.startsWith(`${backupRoot}${sep}`)) {
      return { success: false, error: 'Đường dẫn sao lưu không hợp lệ.' }
    }

    const stat = await fs.stat(resolvedBackup)
    if (!stat.isFile()) {
      return { success: false, error: 'Bản sao lưu không tồn tại.' }
    }

    // Nếu vị trí cũ đã có tệp khác, khôi phục với tên mới để không ghi đè.
    let finalDestination = destination
    try {
      await fs.access(finalDestination)
      finalDestination = await uniqueFilePath(dirname(destination), basename(destination))
    } catch {
      /* Vị trí cũ đang trống: dùng đúng đường dẫn ban đầu. */
    }

    await fs.mkdir(dirname(finalDestination), { recursive: true })
    await fs.copyFile(resolvedBackup, finalDestination)
    return { success: true, path: finalDestination }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

/* ───────────────────────── IPC: chạy dự án ───────────────────────── */

ipcMain.handle('run:start', async (_e, projectId: string, script: string) => {
  const store = await readStore()
  const project = store.projects.find((p) => p.id === projectId)
  if (!project) throw new Error('Không tìm thấy dự án trong danh sách.')
  const entry = project.scripts.find((item) => item.name === script)
  const portOptions = { preferredPort: store.settings.preferredPort }
  const state =
    script === 'static'
      ? await runner.startStatic(project, portOptions)
      : await runner.startScript(project, script, entry?.direct ? entry.command : undefined, portOptions)
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
  const state = await runner.startInstall(project)
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
  const state = await runner.startCommand(project, clean, { preferredPort: store.settings.preferredPort })
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
ipcMain.handle('run:stop-project', async (_e, projectId: string) => {
  runner.stopOfProject(projectId)
  return true
})
ipcMain.handle('run:stop-all', async () => {
  runner.stopAll()
  return true
})

/* ───────────────────────── IPC: Terminal tương tác thật (PTY) ───────────────────────── */

ipcMain.handle('terminal:create', (_e, options?: TerminalCreateOptions) => {
  return terminalManager.create(options)
})

ipcMain.handle('terminal:write', (_e, sessionId: string, data: string) => {
  return terminalManager.write(sessionId, data)
})

ipcMain.handle('terminal:resize', (_e, sessionId: string, cols: number, rows: number) => {
  return terminalManager.resize(sessionId, cols, rows)
})

ipcMain.handle('terminal:kill', (_e, sessionId: string) => {
  return terminalManager.kill(sessionId)
})

ipcMain.handle('terminal:kill-all', () => {
  terminalManager.killAll()
  return true
})

ipcMain.handle('terminal:list', () => {
  return terminalManager.list()
})

ipcMain.handle('shell:external', async (_e, url: string) => {
  if (url && typeof url === 'string' && /^https?:/i.test(url)) {
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        await shell.openExternal(url)
      }
    } catch {}
  }
  return true
})

ipcMain.handle('menu:popup', async (_e, payload: { menuIndex: number; x: number; y: number }) => {
  const appMenu = Menu.getApplicationMenu()
  if (!appMenu) return false
  const menuItem = appMenu.items[payload.menuIndex]
  if (menuItem && menuItem.submenu) {
    menuItem.submenu.popup({
      window: mainWindow ?? undefined,
      x: Math.round(payload.x),
      y: Math.round(payload.y),
    })
    return true
  }
  return false
})

ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize()
})

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

ipcMain.handle('window:close', () => {
  mainWindow?.close()
})

ipcMain.handle('window:is-maximized', () => {
  return mainWindow?.isMaximized() ?? false
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
    // Ngăn chặn việc gắn lặp lại hàng loạt event listeners (mouseover, drop, keydown, click...)
    if (window.__PM_INSPECT_INITIALIZED) {
      return;
    }
    window.__PM_INSPECT_INITIALIZED = true;

    // Mỗi tài liệu (lần tải trang) có một docId riêng. Renderer dùng docId để
    // phát hiện iframe vừa hot-reload và tránh áp dụng lại thao tác DOM khi Undo.
    window.__PM_DOC_ID = window.__PM_DOC_ID || ('pmdoc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8));

    if (window.__PM_INSPECT_CLEANUP) {
      try { window.__PM_INSPECT_CLEANUP(); } catch(e) {}
    }

    // Tự động giữ kích thước & tạo khung viền trực quan cho các cột hoặc container rỗng khi bị kéo con ra ngoài
    var styleId = '__pm_empty_drop_zones';
    var existingStyle = document.getElementById(styleId);
    if (!existingStyle && document.head) {
      existingStyle = document.createElement('style');
      existingStyle.id = styleId;
      existingStyle.textContent = '' +
        '[class*="col-"]:empty, .row > div:empty, div[class*="col"]:empty, section:empty, div[class*="grid"]:empty {' +
        '  min-height: 84px !important;' +
        '  outline: 2px dashed rgba(99, 102, 241, 0.6) !important;' +
        '  outline-offset: -2px !important;' +
        '  background: rgba(99, 102, 241, 0.08) !important;' +
        '  border-radius: 6px !important;' +
        '  display: flex !important;' +
        '  align-items: center !important;' +
        '  justify-content: center !important;' +
        '  position: relative !important;' +
        '  box-sizing: border-box !important;' +
        '  cursor: pointer !important;' +
        '}' +
        '[class*="col-"]:empty::after, .row > div:empty::after, div[class*="col"]:empty::after {' +
        '  content: "📥 Thả phần tử vào đây (" attr(class) ")";' +
        '  font-size: 11px !important;' +
        '  font-weight: 600 !important;' +
        '  color: #6366f1 !important;' +
        '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;' +
        '  pointer-events: none !important;' +
        '  padding: 4px 10px !important;' +
        '  background: rgba(255, 255, 255, 0.9) !important;' +
        '  border-radius: 4px !important;' +
        '  box-shadow: 0 1px 4px rgba(0,0,0,0.12) !important;' +
        '}';
      document.head.appendChild(existingStyle);
    }

    var lastSelected = null;

    /* ── CHỌN NHIỀU PHẦN TỬ (MARQUEE + SHIFT + CLICK) ── */
    var multiSelected = [];
    var suppressClickOnce = false;
    var marqueeState = null;

    function ensureMultiStyle() {
      if (document.getElementById('__pm_multi_style') || !document.head) return;
      var st = document.createElement('style');
      st.id = '__pm_multi_style';
      st.textContent =
        '[data-pm-multi]{outline:2px solid #6d5df5 !important;outline-offset:-2px !important;}' +
        '[data-pm-marquee]{position:fixed;z-index:2147483000;border:1.5px solid #6d5df5;' +
        'background:rgba(109,93,245,0.12);border-radius:2px;pointer-events:none;}';
      document.head.appendChild(st);
    }
    ensureMultiStyle();

    function sortDomOrder(els) {
      return els.slice().sort(function(a, b) {
        if (a === b) return 0;
        var pos = a.compareDocumentPosition(b);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
      });
    }

    function pruneNested(els) {
      var unique = [];
      for (var i = 0; i < els.length; i++) {
        if (els[i] && unique.indexOf(els[i]) === -1) unique.push(els[i]);
      }
      return unique.filter(function(el) {
        return !unique.some(function(other) {
          return other !== el && other.contains(el);
        });
      });
    }

    function postMultiSelection(primaryEl) {
      var items = [];
      for (var i = 0; i < multiSelected.length; i++) {
        if (!multiSelected[i].isConnected) continue;
        items.push(extractElementInfo(multiSelected[i]));
      }
      var primary = null;
      if (primaryEl && primaryEl.isConnected && multiSelected.indexOf(primaryEl) !== -1) {
        primary = extractElementInfo(primaryEl);
      } else if (items.length > 0) {
        primary = items[items.length - 1];
      }
      window.parent.postMessage({
        type: 'PM_SELECTION_CHANGED',
        payload: {
          count: items.length,
          items: items,
          primary: primary
        }
      }, '*');
    }

    function setMultiSelected(els, silent, primaryEl) {
      for (var i = 0; i < multiSelected.length; i++) {
        var old = multiSelected[i];
        if (old && old.removeAttribute) old.removeAttribute('data-pm-multi');
      }
      multiSelected = pruneNested(sortDomOrder(els || []));
      ensureMultiStyle();
      for (var j = 0; j < multiSelected.length; j++) {
        try { multiSelected[j].setAttribute('data-pm-multi', '1'); } catch(err) {}
      }
      if (!silent) postMultiSelection(primaryEl);
      return multiSelected;
    }

    function rectIntersects(rect, box) {
      if (rect.width < 1 || rect.height < 1) return false;
      return rect.left < box.right && rect.right > box.left && rect.top < box.bottom && rect.bottom > box.top;
    }

    function collectMarqueeHits(box) {
      var hits = [];
      if (!document.body) return hits;
      var nodes = document.body.querySelectorAll('*');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (el === document.body || el === document.documentElement) continue;
        var tag = el.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK' || tag === 'META' || tag === 'NOSCRIPT' || tag === 'BR' || tag === 'TEMPLATE') continue;
        if (el.hasAttribute('data-pm-marquee') || el.id === '__pm_multi_style') continue;
        var cs = window.getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;
        var rect = el.getBoundingClientRect();
        if (rectIntersects(rect, box)) hits.push(el);
      }
      return hits;
    }

    document.addEventListener('mousedown', function(e) {
      if (!window.__PM_INSPECT_ACTIVE || e.button !== 0) return;
      suppressClickOnce = false;
      marqueeState = { sx: e.clientX, sy: e.clientY, active: false, boxEl: null };
    }, true);

    document.addEventListener('mousemove', function(e) {
      if (!marqueeState) return;
      var dx = e.clientX - marqueeState.sx;
      var dy = e.clientY - marqueeState.sy;
      if (!marqueeState.active) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        marqueeState.active = true;
        var boxEl = document.createElement('div');
        boxEl.setAttribute('data-pm-marquee', '1');
        (document.body || document.documentElement).appendChild(boxEl);
        marqueeState.boxEl = boxEl;
      }
      if (e.preventDefault) e.preventDefault();
      var b = marqueeState.boxEl;
      if (!b) return;
      b.style.left = Math.min(marqueeState.sx, e.clientX) + 'px';
      b.style.top = Math.min(marqueeState.sy, e.clientY) + 'px';
      b.style.width = Math.abs(e.clientX - marqueeState.sx) + 'px';
      b.style.height = Math.abs(e.clientY - marqueeState.sy) + 'px';
    }, true);

    document.addEventListener('mouseup', function(e) {
      if (!marqueeState) return;
      var state = marqueeState;
      marqueeState = null;
      if (!state.active) return;
      suppressClickOnce = true;
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
      if (state.boxEl && state.boxEl.parentNode) state.boxEl.parentNode.removeChild(state.boxEl);

      var box = {
        left: Math.min(state.sx, e.clientX),
        top: Math.min(state.sy, e.clientY),
        right: Math.max(state.sx, e.clientX),
        bottom: Math.max(state.sy, e.clientY)
      };
      var boxW = box.right - box.left;
      var boxH = box.bottom - box.top;
      var boxArea = boxW * boxH;
      var hits = collectMarqueeHits(box);
      if (hits.length === 0) {
        setMultiSelected([], false, null);
        return;
      }

      // 1. Loại bỏ các thẻ layout / container quá lớn bao trùm toàn bộ trang
      // nếu chúng có phần tử con cụ thể hơn cũng nằm trong vùng kéo
      var nonContainers = hits.filter(function(el) {
        var r = el.getBoundingClientRect();
        var elArea = r.width * r.height;
        var tag = el.tagName.toUpperCase();
        var isBigWrapper = (tag === 'SECTION' || tag === 'MAIN' || tag === 'ARTICLE' || tag === 'DIV' || tag === 'FORM' || tag === 'NAV');
        if (isBigWrapper && elArea > boxArea * 2.2 && (r.width > boxW + 40 || r.height > boxH + 40)) {
          for (var c = 0; c < hits.length; c++) {
            if (hits[c] !== el && el.contains(hits[c])) {
              return false;
            }
          }
        }
        return true;
      });

      var candidates = nonContainers.length > 0 ? nonContainers : hits;

      // 2. Lấy các phần tử giao với vùng kéo (không bắt buộc 100% lọt lòng)
      var validHits = candidates.filter(function(el) {
        var r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return false;
        var cx = (r.left + r.right) / 2;
        var cy = (r.top + r.bottom) / 2;
        if (cx >= box.left && cx <= box.right && cy >= box.top && cy <= box.bottom) return true;
        var ix = Math.max(0, Math.min(r.right, box.right) - Math.max(r.left, box.left));
        var iy = Math.max(0, Math.min(r.bottom, box.bottom) - Math.max(r.top, box.top));
        var inter = ix * iy;
        return inter > 0 && (inter / (r.width * r.height) >= 0.15 || inter / boxArea >= 0.05);
      });

      if (validHits.length === 0) validHits = candidates;

      // 3. Chọn các phần tử có nội dung thực tế (h1..h6, p, a, button, input, span, v.v.)
      var picked = [];
      for (var f = 0; f < validHits.length; f++) {
        var el = validHits[f];
        var tag = el.tagName.toUpperCase();
        var isTextOrControl = (tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'H4' || tag === 'H5' || tag === 'H6' ||
          tag === 'P' || tag === 'BUTTON' || tag === 'A' || tag === 'SPAN' || tag === 'INPUT' || tag === 'LABEL' ||
          tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'LI' || tag === 'IMG' || tag === 'SVG' || tag === 'I' || tag === 'B' || tag === 'STRONG');

        if (isTextOrControl) {
          picked.push(el);
        } else {
          // Với thẻ div / khác: chỉ chọn nếu nó không chứa thẻ con nào khác trong validHits
          var hasChild = false;
          for (var k = 0; k < validHits.length; k++) {
            if (validHits[k] !== el && el.contains(validHits[k])) {
              hasChild = true;
              break;
            }
          }
          if (!hasChild) picked.push(el);
        }
      }

      if (picked.length === 0) picked = validHits;

      var next = setMultiSelected(picked, false, null);
      if (next.length > 0) lastSelected = next[next.length - 1];
    }, true);

    document.addEventListener('dragstart', function(e) {
      if (window.__PM_INSPECT_ACTIVE) e.preventDefault();
    }, true);

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
      var rawText = (el.innerText || el.textContent || '').trim();
      if (!rawText && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) {
        rawText = el.getAttribute('placeholder') || el.getAttribute('name') || el.getAttribute('type') || el.value || '';
      }
      var snippet = rawText.length > 80 ? rawText.slice(0, 80) + '…' : rawText;

      return {
        uid: uid,
        selector: getUniqueSelector(el),
        tagName: el.tagName.toLowerCase(),
        id: el.id || '',
        className: typeof el.className === 'string' ? el.className.trim() : '',
        outerHTML: el.outerHTML,
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
          rowGap: style.rowGap || '0px',
          columnGap: style.columnGap || '0px',
          flexWrap: style.flexWrap || 'nowrap',
          gridTemplateColumns: style.gridTemplateColumns || 'none',
          gridTemplateRows: style.gridTemplateRows || 'none',
          gridAutoFlow: style.gridAutoFlow || 'row',
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
        parent: (function() {
          var p = el.parentElement;
          if (!p || p === document.documentElement || p === document.body) return null;
          var pr = p.getBoundingClientRect();
          if (!p.getAttribute('data-pm-uid')) {
            p.setAttribute('data-pm-uid', 'pm_' + Math.random().toString(36).slice(2, 9));
          }
          var pCls = typeof p.className === 'string' && p.className.trim() ? p.className.trim().split(/\\s+/)[0] : '';
          var pTag = p.tagName.toLowerCase() + (p.id ? '#' + p.id : (pCls ? '.' + pCls : ''));
          return {
            uid: p.getAttribute('data-pm-uid'),
            tagName: p.tagName.toLowerCase(),
            id: p.id || '',
            className: typeof p.className === 'string' ? p.className : '',
            tag: pTag,
            rect: {
              top: pr.top,
              left: pr.left,
              width: pr.width,
              height: pr.height,
            }
          };
        })(),
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

    /* ── Hộp công cụ: tiện ích DOM ── */

    function ensureUid(el) {
      if (!el || el.nodeType !== 1) return '';
      if (!el.getAttribute('data-pm-uid')) {
        el.setAttribute('data-pm-uid', 'pm_' + Math.random().toString(36).slice(2, 9));
      }
      return el.getAttribute('data-pm-uid');
    }

    function uidElements(root) {
      var uids = [ensureUid(root)];
      if (root.querySelectorAll) {
        var all = root.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) ensureUid(all[i]);
      }
      return uids;
    }

    function insertHtmlNodes(html, targetUid, placement) {
      var target = targetUid ? document.querySelector('[data-pm-uid="' + targetUid + '"]') : null;
      var isRoot = !target || target === document.body || target === document.documentElement;
      var wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      var nodes = Array.prototype.slice.call(wrapper.childNodes);
      var parent = target;
      var reference = null;

      if (isRoot) {
        parent = document.body || document.documentElement;
        reference = placement === 'before' ? parent.firstChild : null;
      } else if (placement === 'before') {
        parent = target.parentNode || document.body;
        reference = target;
      } else if (placement === 'inside') {
        parent = target;
        reference = null;
      } else {
        parent = target.parentNode || document.body;
        reference = target.nextSibling;
      }

      var index = Array.prototype.indexOf.call(parent.childNodes, reference);
      if (index < 0) index = parent.childNodes.length;
      var uids = [];
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        parent.insertBefore(node, reference);
        if (node.nodeType === 1) {
          uids = uids.concat(uidElements(node));
        }
      }
      return { uids: uids, parentUid: ensureUid(parent), index: index };
    }

    function insertHtmlAtIndex(html, parentUid, index) {
      var parent = null;
      if (parentUid) {
        parent = document.querySelector('[data-pm-uid="' + parentUid + '"]');
        if (!parent && parentUid === 'pm_body') parent = document.body;
      } else {
        parent = document.body;
      }
      // Không tìm thấy khung cha (uid đã cũ vì trang đã được tải lại).
      // Tuyệt đối không chèn vào body để tránh tạo bản sao trùng lặp của cả khối UI.
      if (!parent) {
        return { uids: [], parentUid: parentUid, index: index, missingParent: true };
      }
      var wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      var nodes = Array.prototype.slice.call(wrapper.childNodes);
      var reference = parent.childNodes[index] || null;
      var uids = [];
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        parent.insertBefore(node, reference);
        if (node.nodeType === 1) uids = uids.concat(uidElements(node));
      }
      return { uids: uids, parentUid: ensureUid(parent), index: index };
    }

    function removeByUid(uid) {
      var el = uid ? document.querySelector('[data-pm-uid="' + uid + '"]') : lastSelected;
      if (!el || el === document.body || el === document.documentElement) return null;
      var parent = el.parentElement;
      if (!parent) return null;
      var index = Array.prototype.indexOf.call(parent.childNodes, el);
      // Không lưu lại dấu chọn nhiều vào HTML để tránh viền tím khi hoàn tác
      var html = el.outerHTML.replace(/\sdata-pm-multi(?:="[^"]*")?/g, '');
      var parentUid = ensureUid(parent);
      parent.removeChild(el);
      return { parentUid: parentUid, index: index, html: html };
    }

    function applyElementAttrs(uid, attributes, text) {
      var el = uid ? document.querySelector('[data-pm-uid="' + uid + '"]') : lastSelected;
      if (!el) return null;
      if (attributes) {
        for (var key in attributes) {
          if (!Object.prototype.hasOwnProperty.call(attributes, key)) continue;
          var value = attributes[key];
          if (value === null || value === undefined || value === '') {
            el.removeAttribute(key);
          } else {
            el.setAttribute(key, value);
          }
        }
      }
      if (typeof text === 'string' && el.children.length === 0) {
        el.textContent = text;
      }
      return extractElementInfo(el);
    }

    function computeDropPlacement(el, x, y) {
      var rect = el.getBoundingClientRect();
      var tag = el.tagName.toUpperCase();
      var leaf = ['IMG','INPUT','BUTTON','A','H1','H2','H3','H4','H5','H6','P','SPAN','LI','TD','TH','LABEL','TEXTAREA','SELECT'].indexOf(tag) !== -1;
      if (leaf || el.children.length === 0) {
        return y > rect.top + rect.height / 2 ? 'after' : 'before';
      }
      if (y < rect.top + rect.height * 0.25) return 'before';
      if (y > rect.top + rect.height * 0.75) return 'after';
      return 'inside';
    }

    function hasToolboxDrag(dt) {
      // Chromium thường ẩn các custom MIME type khi kéo qua biên giới iframe trong sự kiện dragover.
      // Luôn trả về true để preventDefault() kích hoạt và cho phép thả phần tử chính xác vào DOM.
      return true;
    }

    function dropElementAt(x, y) {
      var el = document.elementFromPoint(x, y);
      if (!el || el === document.documentElement) el = document.body;
      return el;
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
      if (suppressClickOnce) {
        suppressClickOnce = false;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      var target = e.target;
      if (!target || target === document.body || target === document.documentElement) return;

      // Shift + Click: cộng/trừ phần tử khỏi vùng chọn nhiều
      if (e.shiftKey) {
        if (multiSelected.indexOf(target) !== -1) {
          setMultiSelected(multiSelected.filter(function(el) { return el !== target; }), false, target);
        } else {
          setMultiSelected(multiSelected.concat([target]), false, target);
        }
        lastSelected = target;
        return;
      }

      setMultiSelected([], true);
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
        source: 'click',
        payload: info
      }, '*');
    }, true);

    window.addEventListener('contextmenu', function(e) {
      if (!window.__PM_INSPECT_ACTIVE) return;
      e.preventDefault();
      e.stopPropagation();
      var target = e.target;
      if (!target || target === document.documentElement) target = document.body;
      lastSelected = target;
      var info = extractElementInfo(target);
      window.parent.postMessage({
        type: 'PM_ELEMENT_CONTEXTMENU',
        payload: {
          info: info,
          clientX: e.clientX,
          clientY: e.clientY
        }
      }, '*');
    }, true);

    window.addEventListener('message', function(e) {
      if (!e.data) return;
      if (e.data.type === 'PM_SET_INSPECT_MODE') {
        window.__PM_INSPECT_ACTIVE = !!e.data.enabled;
        if (document.documentElement) {
          document.documentElement.style.cursor = window.__PM_INSPECT_ACTIVE ? 'crosshair' : '';
        }
        if (!window.__PM_INSPECT_ACTIVE) {
          marqueeState = null;
          setMultiSelected([], true);
        } else {
          ensureMultiStyle();
        }
      } else if (e.data.type === 'PM_CLEAR_MULTI_SELECTION') {
        setMultiSelected([], true);
        if (!e.data.keepLastSelected) lastSelected = null;
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
      } else if (e.data.type === 'PM_GET_DOM_TREE') {
        sendDomTree();
      } else if (e.data.type === 'PM_SELECT_BY_UID') {
        var selUid = e.data.uid;
        var selEl = selUid ? document.querySelector('[data-pm-uid="' + selUid + '"]') : null;
        if (!selEl && e.data.selector) {
          try { selEl = document.querySelector(e.data.selector); } catch(err) {}
        }
        if (selEl) {
          lastSelected = selEl;
          try { selEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch(err) {}
          var info = extractElementInfo(selEl);
          window.parent.postMessage({
            type: 'PM_SELECT_ELEMENT',
            payload: info
          }, '*');
        }
      } else if (e.data.type === 'PM_HOVER_BY_UID') {
        var hUid = e.data.uid;
        if (!hUid) {
          window.parent.postMessage({ type: 'PM_HOVER_ELEMENT', payload: null }, '*');
        } else {
          var hEl = document.querySelector('[data-pm-uid="' + hUid + '"]');
          if (hEl) {
            var hr = hEl.getBoundingClientRect();
            window.parent.postMessage({
              type: 'PM_HOVER_ELEMENT',
              payload: {
                uid: hUid,
                tagName: hEl.tagName.toLowerCase(),
                className: typeof hEl.className === 'string' ? hEl.className : '',
                rect: {
                  top: hr.top,
                  left: hr.left,
                  width: hr.width,
                  height: hr.height,
                }
              }
            }, '*');
          }
        }
      } else if (e.data.type === 'PM_RESET_POSITION') {
        var targetToReset = lastSelected;
        if (!targetToReset && e.data.uid) {
          targetToReset = document.querySelector('[data-pm-uid="' + e.data.uid + '"]');
        }
        if (targetToReset) {
          targetToReset.style.removeProperty('top');
          targetToReset.style.removeProperty('left');
          targetToReset.style.removeProperty('right');
          targetToReset.style.removeProperty('bottom');
          var curPos = targetToReset.style.position;
          if (curPos === 'relative') {
            targetToReset.style.removeProperty('position');
          }
          sendDomTree();
          var resInfo = extractElementInfo(targetToReset);
          window.parent.postMessage({
            type: 'PM_SELECT_ELEMENT',
            payload: resInfo
          }, '*');
        }
      } else if (e.data.type === 'PM_MOVE_DOM_NODE') {
        var targetToMove = lastSelected;
        if (!targetToMove && e.data.uid) {
          targetToMove = document.querySelector('[data-pm-uid="' + e.data.uid + '"]');
        }
        if (targetToMove && targetToMove.parentElement) {
          var pNode = targetToMove.parentElement;
          var oldParentUid = ensureUid(pNode);
          var oldIndex = Array.prototype.indexOf.call(pNode.childNodes, targetToMove);
          var act = e.data.action;
          if (act === 'up' && targetToMove.previousElementSibling) {
            pNode.insertBefore(targetToMove, targetToMove.previousElementSibling);
          } else if (act === 'down' && targetToMove.nextElementSibling) {
            pNode.insertBefore(targetToMove, targetToMove.nextElementSibling.nextElementSibling);
          } else if (act === 'outdent' && pNode.parentElement && pNode !== document.body) {
            // Đưa phần tử ra ngoài thẻ cha, làm anh em kế tiếp của thẻ cha
            pNode.parentElement.insertBefore(targetToMove, pNode.nextSibling);
            targetToMove.style.removeProperty('top');
            targetToMove.style.removeProperty('left');
            if (targetToMove.style.position === 'relative') targetToMove.style.removeProperty('position');
          } else if (act === 'indent' && targetToMove.previousElementSibling) {
            // Đưa phần tử vào làm con của thẻ anh em liền trước
            targetToMove.previousElementSibling.appendChild(targetToMove);
            targetToMove.style.removeProperty('top');
            targetToMove.style.removeProperty('left');
            if (targetToMove.style.position === 'relative') targetToMove.style.removeProperty('position');
          } else if (act === 'into' && e.data.targetUid) {
            // Đưa phần tử trực tiếp vào làm con của thẻ mục tiêu (Target Container)
            var destTarget = document.querySelector('[data-pm-uid="' + e.data.targetUid + '"]');
            if (destTarget && destTarget !== targetToMove && !targetToMove.contains(destTarget)) {
              destTarget.appendChild(targetToMove);
              targetToMove.style.removeProperty('top');
              targetToMove.style.removeProperty('left');
              if (targetToMove.style.position === 'relative') targetToMove.style.removeProperty('position');
            }
          }
          sendDomTree();
          var movedInfo = extractElementInfo(targetToMove);
          window.parent.postMessage({
            type: 'PM_SELECT_ELEMENT',
            payload: movedInfo
          }, '*');

          var finalParent = targetToMove.parentElement;
          var finalNewParentUid = finalParent ? ensureUid(finalParent) : null;
          var finalNewIndex = finalParent ? Array.prototype.indexOf.call(finalParent.childNodes, targetToMove) : -1;
          window.parent.postMessage({
            type: 'PM_REPARENT_NOTIFY',
            message: 'Đã cập nhật phân cấp phần tử <' + targetToMove.tagName.toLowerCase() + '>!',
            uid: ensureUid(targetToMove),
            tagName: targetToMove.tagName,
            oldParentUid: oldParentUid,
            oldIndex: oldIndex,
            newParentUid: finalNewParentUid,
            newIndex: finalNewIndex
          }, '*');
        }
      } else if (e.data.type === 'PM_DRAG_OVER') {
        var dragUid = e.data.dragUid;
        var dragEl = dragUid ? document.querySelector('[data-pm-uid="' + dragUid + '"]') : null;
        if (!dragEl) return;

        var prevVis = dragEl.style.visibility;
        dragEl.style.visibility = 'hidden';
        var hovered = document.elementFromPoint(e.data.x, e.data.y);
        dragEl.style.visibility = prevVis;

        if (hovered && hovered !== dragEl && !dragEl.contains(hovered)) {
          var targetContainer = hovered;
          if (['SPAN', 'SMALL', 'B', 'I', 'STRONG', 'EM'].indexOf(targetContainer.tagName) !== -1 && targetContainer.parentElement) {
            targetContainer = targetContainer.parentElement;
          }
          var cr = targetContainer.getBoundingClientRect();
          var firstCls = (typeof targetContainer.className === 'string' && targetContainer.className.trim())
            ? targetContainer.className.trim().split(/\s+/)[0]
            : '';
          var tagLabel = targetContainer.tagName.toLowerCase() + (targetContainer.id ? '#' + targetContainer.id : (firstCls ? '.' + firstCls : ''));
          window.parent.postMessage({
            type: 'PM_DROP_TARGET_HOVER',
            payload: {
              uid: targetContainer.getAttribute('data-pm-uid') || '',
              tagName: targetContainer.tagName.toLowerCase(),
              tag: tagLabel,
              rect: {
                top: cr.top,
                left: cr.left,
                width: cr.width,
                height: cr.height
              }
            }
          }, '*');
        } else {
          window.parent.postMessage({ type: 'PM_DROP_TARGET_HOVER', payload: null }, '*');
        }
      } else if (e.data.type === 'PM_DROP_REPARENT') {
        var dragUid = e.data.uid;
        var dragEl = dragUid ? document.querySelector('[data-pm-uid="' + dragUid + '"]') : null;
        if (!dragEl) return;
        var dragStyle = window.getComputedStyle(dragEl);
        if (dragStyle.position === 'absolute' || dragStyle.position === 'fixed') return;

        var oldParent = dragEl.parentElement;
        if (!oldParent) return;
        var oldParentUid = ensureUid(oldParent);
        var oldIndex = Array.prototype.indexOf.call(oldParent.childNodes, dragEl);
        var prevVis = dragEl.style.visibility;
        dragEl.style.visibility = 'hidden';
        var dropTarget = document.elementFromPoint(e.data.x, e.data.y);
        dragEl.style.visibility = prevVis;

        var reparented = false;
        var newParentTag = '';

        if (dropTarget && dropTarget !== dragEl && !dragEl.contains(dropTarget)) {
          if (dropTarget !== oldParent) {
            var isLeaf = ['H1','H2','H3','H4','H5','H6','P','BUTTON','A','IMG','INPUT'].indexOf(dropTarget.tagName) !== -1;
            if (isLeaf && dropTarget.parentElement && dropTarget.parentElement !== dragEl) {
              var r = dropTarget.getBoundingClientRect();
              var isAfter = e.data.y > (r.top + r.height / 2);
              if (isAfter) {
                dropTarget.parentElement.insertBefore(dragEl, dropTarget.nextSibling);
              } else {
                dropTarget.parentElement.insertBefore(dragEl, dropTarget);
              }
              reparented = true;
              newParentTag = dropTarget.parentElement.tagName.toLowerCase();
            } else {
              dropTarget.appendChild(dragEl);
              reparented = true;
              newParentTag = dropTarget.tagName.toLowerCase();
            }
          } else {
            // Drop trong cùng thẻ cha: kiểm tra đổi thứ tự anh em (reorder)
            var siblings = Array.prototype.slice.call(oldParent.children);
            for (var si = 0; si < siblings.length; si++) {
              var sib = siblings[si];
              if (sib === dragEl) continue;
              var sr = sib.getBoundingClientRect();
              if (e.data.y >= sr.top && e.data.y <= sr.bottom && e.data.x >= sr.left && e.data.x <= sr.right) {
                if (e.data.y > (sr.top + sr.height / 2)) {
                  oldParent.insertBefore(dragEl, sib.nextSibling);
                } else {
                  oldParent.insertBefore(dragEl, sib);
                }
                reparented = true;
                newParentTag = oldParent.tagName.toLowerCase();
                break;
              }
            }
          }
        }

        if (reparented) {
          dragEl.style.removeProperty('top');
          dragEl.style.removeProperty('left');
          dragEl.style.removeProperty('right');
          dragEl.style.removeProperty('bottom');
          if (dragEl.style.position === 'relative') {
            dragEl.style.removeProperty('position');
          }
          var checkParent = dragEl.parentElement;
          var checkParentUid = checkParent ? ensureUid(checkParent) : null;
          var checkIndex = checkParent ? Array.prototype.indexOf.call(checkParent.childNodes, dragEl) : -1;
          if (oldParentUid === checkParentUid && oldIndex === checkIndex) {
            reparented = false;
          }
        }

        sendDomTree();
        var finalInfo = extractElementInfo(dragEl);
        lastSelected = dragEl;
        window.parent.postMessage({
          type: 'PM_SELECT_ELEMENT',
          payload: finalInfo
        }, '*');

        if (reparented) {
          var finalParent = dragEl.parentElement;
          var finalNewParentUid = finalParent ? ensureUid(finalParent) : null;
          var finalNewIndex = finalParent ? Array.prototype.indexOf.call(finalParent.childNodes, dragEl) : -1;
          window.parent.postMessage({
            type: 'PM_REPARENT_NOTIFY',
            message: 'Đã chuyển <' + dragEl.tagName.toLowerCase() + '> vào <' + newParentTag + '>, phân cấp phần tử đã cập nhật!',
            uid: dragUid,
            tagName: dragEl.tagName,
            oldParentUid: oldParentUid,
            oldIndex: oldIndex,
            newParentUid: finalNewParentUid,
            newIndex: finalNewIndex
          }, '*');
        }
      } else if (e.data.type === 'PM_TOOLBOX_INSERT') {
        var insertPayload = e.data.payload || e.data || {};
        var insertHtml = insertPayload.html || e.data.html || '';
        var insertTargetUid = insertPayload.targetUid || e.data.targetUid;
        var insertPlacement = insertPayload.placement || e.data.placement || 'after';
        var insertResult = insertHtmlNodes(
          insertHtml,
          insertTargetUid,
          insertPlacement
        );
        sendDomTree();
        if (insertResult && insertResult.uids && insertResult.uids[0]) {
          var firstNew = document.querySelector('[data-pm-uid="' + insertResult.uids[0] + '"]');
          if (firstNew) {
            lastSelected = firstNew;
            try { firstNew.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch(err) {}
            window.parent.postMessage({
              type: 'PM_SELECT_ELEMENT',
              payload: extractElementInfo(firstNew)
            }, '*');
          }
        }
        window.parent.postMessage({
          type: 'PM_TOOLBOX_DOM_RESULT',
          requestId: e.data.requestId,
          action: 'insert',
          result: insertResult
        }, '*');
      } else if (e.data.type === 'PM_TOOLBOX_DELETE') {
        var deleteResult = removeByUid(e.data.uid);
        sendDomTree();
        window.parent.postMessage({
          type: 'PM_TOOLBOX_DOM_RESULT',
          requestId: e.data.requestId,
          action: 'delete',
          result: deleteResult
        }, '*');
      } else if (e.data.type === 'PM_TOOLBOX_DUPLICATE') {
        var dupEl = e.data.uid ? document.querySelector('[data-pm-uid="' + e.data.uid + '"]') : lastSelected;
        var dupResult = null;
        if (dupEl && dupEl.parentNode) {
          var clone = dupEl.cloneNode(true);
          clone.removeAttribute('data-pm-uid');
          var dupUids = uidElements(clone);
          dupEl.parentNode.insertBefore(clone, dupEl.nextSibling);
          dupResult = {
            uids: dupUids,
            parentUid: ensureUid(dupEl.parentNode),
            index: Array.prototype.indexOf.call(dupEl.parentNode.childNodes, clone),
            html: clone.outerHTML
          };
        }
        sendDomTree();
        window.parent.postMessage({
          type: 'PM_TOOLBOX_DOM_RESULT',
          requestId: e.data.requestId,
          action: 'duplicate',
          result: dupResult
        }, '*');
      } else if (e.data.type === 'PM_TOOLBOX_ATTRS' || e.data.type === 'PM_TOOLBOX_DOM_ATTRS') {
        var attrInfo = applyElementAttrs(e.data.uid, e.data.attributes, e.data.text);
        sendDomTree();
        window.parent.postMessage({
          type: 'PM_TOOLBOX_DOM_RESULT',
          requestId: e.data.requestId,
          action: 'attributes',
          info: attrInfo
        }, '*');
      } else if (e.data.type === 'PM_TOOLBOX_DOM_INSERT') {
        var reinsertResult = insertHtmlAtIndex(e.data.html || '', e.data.parentUid, e.data.index);
        sendDomTree();
        window.parent.postMessage({
          type: 'PM_TOOLBOX_DOM_RESULT',
          requestId: e.data.requestId,
          action: 'dom-insert',
          result: reinsertResult
        }, '*');
      } else if (e.data.type === 'PM_TOOLBOX_DOM_REMOVE') {
        var removeUids = e.data.uids || [];
        for (var ri = 0; ri < removeUids.length; ri++) {
          removeByUid(removeUids[ri]);
        }
        sendDomTree();
        window.parent.postMessage({
          type: 'PM_TOOLBOX_DOM_RESULT',
          requestId: e.data.requestId,
          action: 'dom-remove'
        }, '*');
      } else if (e.data.type === 'PM_TOOLBOX_DOM_MOVE') {
        var moveUid = e.data.uid;
        var moveEl = moveUid ? document.querySelector('[data-pm-uid="' + moveUid + '"]') : null;
        var targetParentUid = e.data.parentUid;
        var targetParent = null;
        if (targetParentUid) {
          targetParent = document.querySelector('[data-pm-uid="' + targetParentUid + '"]');
          if (!targetParent && (targetParentUid === 'pm_body' || (document.body && targetParentUid === document.body.getAttribute('data-pm-uid')))) {
            targetParent = document.body;
          }
        } else {
          targetParent = document.body;
        }
        var targetIndex = typeof e.data.index === 'number' ? e.data.index : -1;
        var moveSuccess = false;
        if (moveEl && targetParent && moveEl !== targetParent && !moveEl.contains(targetParent)) {
          try {
            var siblings = Array.prototype.filter.call(targetParent.childNodes, function(n) { return n !== moveEl; });
            var targetRef = (targetIndex >= 0 && targetIndex < siblings.length) ? siblings[targetIndex] : null;
            targetParent.insertBefore(moveEl, targetRef);
            moveEl.style.removeProperty('top');
            moveEl.style.removeProperty('left');
            moveEl.style.removeProperty('right');
            moveEl.style.removeProperty('bottom');
            if (moveEl.style.position === 'relative') {
              moveEl.style.removeProperty('position');
            }
            moveSuccess = true;
            sendDomTree();
            var updatedInfo = extractElementInfo(moveEl);
            lastSelected = moveEl;
            window.parent.postMessage({
              type: 'PM_SELECT_ELEMENT',
              payload: updatedInfo
            }, '*');
          } catch (err) {
            console.error('[PM_TOOLBOX_DOM_MOVE] Error moving node:', err);
          }
        }
        window.parent.postMessage({
          type: 'PM_TOOLBOX_DOM_RESULT',
          requestId: e.data.requestId,
          action: 'dom-move',
          result: { success: moveSuccess }
        }, '*');
      } else if (e.data.type === 'PM_TOOLBOX_GET_INFO') {
        var infoEl = e.data.uid ? document.querySelector('[data-pm-uid="' + e.data.uid + '"]') : document.body;
        window.parent.postMessage({
          type: 'PM_TOOLBOX_DOM_RESULT',
          requestId: e.data.requestId,
          action: 'info',
          info: infoEl ? extractElementInfo(infoEl) : null
        }, '*');
      }
    });

    function getReadableLabel(el) {
      if (!el) return '';
      var tag = el.tagName ? el.tagName.toLowerCase() : '';
      if (tag === 'body') return 'Khung trang · ' + (document.title || 'Body');

      var text = '';
      for (var i = 0; i < el.childNodes.length; i++) {
        if (el.childNodes[i].nodeType === 3) {
          var t = (el.childNodes[i].textContent || '').trim();
          if (t) { text = t; break; }
        }
      }
      if (!text && el.children.length === 0) {
        text = (el.innerText || el.textContent || '').trim();
      }
      if (text) {
        if (text.length > 35) text = text.slice(0, 35) + '…';
        return text;
      }

      if (el.id) return '#' + el.id;
      if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
      if (el.getAttribute('title')) return el.getAttribute('title');
      if (el.getAttribute('placeholder')) return 'Ô nhập: ' + el.getAttribute('placeholder');
      if (el.getAttribute('alt')) return 'Ảnh: ' + el.getAttribute('alt');

      if (tag === 'header') return 'Thanh điều hướng Header';
      if (tag === 'nav') return 'Menu điều hướng (nav)';
      if (tag === 'main') return 'Vùng nội dung chính (main)';
      if (tag === 'footer') return 'Chân trang Footer';
      if (tag === 'section') return 'Khối phân vùng (section)';
      if (tag === 'article') return 'Khối bài viết (article)';
      if (tag === 'aside') return 'Thanh bên (aside)';
      if (tag === 'form') return 'Biểu mẫu nhập liệu (form)';
      if (tag === 'table') return 'Bảng dữ liệu (table)';
      if (tag === 'thead') return 'Đầu bảng (thead)';
      if (tag === 'tbody') return 'Thân bảng (tbody)';
      if (tag === 'tr') return 'Hàng bảng (tr)';
      if (tag === 'th') return 'Tiêu đề cột (th)';
      if (tag === 'td') return 'Ô dữ liệu (td)';
      if (tag === 'ul' || tag === 'ol') return 'Danh sách (list)';
      if (tag === 'li') return 'Mục danh sách (item)';
      if (tag === 'button') return 'Nút bấm (button)';
      if (tag === 'input') return 'Ô nhập (' + (el.type || 'text') + ')';
      if (tag === 'img') return 'Hình ảnh (img)';
      if (/^h[1-6]$/.test(tag)) return 'Tiêu đề ' + tag.toUpperCase();
      if (tag === 'p') return 'Đoạn văn bản';
      if (tag === 'a') return 'Đường dẫn liên kết';

      if (el.className && typeof el.className === 'string') {
        var firstCls = el.className.trim().split(/\\s+/)[0];
        if (firstCls) return '.' + firstCls;
      }
      return tag;
    }

    function scanLayers(root, depth, maxDepth, result) {
      if (!root || depth > maxDepth) return;
      var skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'BR', 'HR', 'SVG', 'PATH', 'SOURCE'];
      for (var i = 0; i < root.children.length; i++) {
        var child = root.children[i];
        if (skipTags.indexOf(child.tagName) !== -1) continue;

        var rect = child.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0 && child.children.length === 0) continue;

        if (!child.getAttribute('data-pm-uid')) {
          child.setAttribute('data-pm-uid', 'pm_' + Math.random().toString(36).slice(2, 9));
        }
        var uid = child.getAttribute('data-pm-uid');
        var tag = child.tagName.toLowerCase();
        var firstClass = (typeof child.className === 'string' && child.className.trim())
          ? child.className.trim().split(/\\s+/)[0]
          : '';
        var tagLabel = tag + (child.id ? '#' + child.id : (firstClass ? '.' + firstClass : ''));

        result.push({
          id: uid,
          uid: uid,
          label: getReadableLabel(child),
          tag: tagLabel,
          tagName: tag,
          depth: depth,
          selector: getUniqueSelector(child),
          childrenCount: child.children.length,
          rect: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }
        });

        if (child.children.length > 0 && depth < 6) {
          scanLayers(child, depth + 1, maxDepth, result);
        }
      }
    }

    function sendDomTree() {
      if (!document.body) return;
      var layers = [];
      if (!document.body.getAttribute('data-pm-uid')) {
        document.body.setAttribute('data-pm-uid', 'pm_body');
      }
      var bodyRect = document.body.getBoundingClientRect();
      layers.push({
        id: 'pm_body',
        uid: 'pm_body',
        label: 'Khung trang · ' + (document.title || 'Body'),
        tag: 'body',
        tagName: 'body',
        depth: 0,
        selector: 'body',
        childrenCount: document.body.children.length,
        rect: {
          top: bodyRect.top,
          left: bodyRect.left,
          width: bodyRect.width,
          height: bodyRect.height
        }
      });
      scanLayers(document.body, 1, 6, layers);
      try {
        window.parent.postMessage({
          type: 'PM_DOM_TREE',
          payload: layers
        }, '*');
      } catch (err) {}
    }

    /* ── Hộp công cụ: nhận kéo-thả từ panel bên trái ── */

    document.addEventListener('dragover', function(e) {
      if (!hasToolboxDrag(e.dataTransfer)) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'copy'; } catch (err) {}
      var el = dropElementAt(e.clientX, e.clientY);
      var rect = el.getBoundingClientRect();
      var firstCls = (typeof el.className === 'string' && el.className.trim())
        ? el.className.trim().split(/\s+/)[0]
        : '';
      window.parent.postMessage({
        type: 'PM_TOOLBOX_DROP_HOVER',
        payload: {
          uid: ensureUid(el),
          tagName: el.tagName.toLowerCase(),
          tag: el.tagName.toLowerCase() + (el.id ? '#' + el.id : (firstCls ? '.' + firstCls : '')),
          placement: computeDropPlacement(el, e.clientX, e.clientY),
          rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
        }
      }, '*');
    }, true);

    document.addEventListener('dragleave', function(e) {
      if (!hasToolboxDrag(e.dataTransfer)) return;
      if (e.relatedTarget) return;
      window.parent.postMessage({ type: 'PM_TOOLBOX_DROP_HOVER', payload: null }, '*');
    }, true);

    document.addEventListener('drop', function(e) {
      if (!hasToolboxDrag(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
      var el = dropElementAt(e.clientX, e.clientY);
      window.parent.postMessage({
        type: 'PM_TOOLBOX_DROP',
        payload: {
          targetUid: ensureUid(el),
          targetTag: el.tagName.toLowerCase(),
          placement: computeDropPlacement(el, e.clientX, e.clientY)
        }
      }, '*');
      window.parent.postMessage({ type: 'PM_TOOLBOX_DROP_HOVER', payload: null }, '*');
    }, true);

    // Chuyển tiếp phím tắt Ctrl+Z (Undo), Ctrl+Y (Redo), Ctrl+S (Save) từ iframe lên PixelMind
    window.addEventListener('keydown', function(e) {
      var isZ = e.key === 'z' || e.key === 'Z';
      var isY = e.key === 'y' || e.key === 'Y';
      var isS = e.key === 's' || e.key === 'S';
      var isD = e.key === 'd' || e.key === 'D';
      var isC = e.key === 'c' || e.key === 'C';
      var isV = e.key === 'v' || e.key === 'V';
      var isDelete = e.key === 'Delete' || e.key === 'Backspace';
      var target = e.target;
      var isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isInput) return;
      var clipboardShortcut = (isC || isV) && window.__PM_INSPECT_ACTIVE;
      if ((e.ctrlKey || e.metaKey) && (isZ || isY || isS || isD || clipboardShortcut)) {
        e.preventDefault();
        window.parent.postMessage({
          type: 'PM_KEYBOARD_SHORTCUT',
          payload: {
            key: e.key.toLowerCase(),
            ctrlKey: e.ctrlKey || e.metaKey,
            shiftKey: e.shiftKey
          }
        }, '*');
      } else if (isDelete && !e.ctrlKey && !e.metaKey && window.__PM_INSPECT_ACTIVE) {
        e.preventDefault();
        window.parent.postMessage({
          type: 'PM_KEYBOARD_SHORTCUT',
          payload: {
            key: e.key.toLowerCase(),
            ctrlKey: false,
            shiftKey: e.shiftKey
          }
        }, '*');
      } else if (e.key === 'Escape' && window.__PM_INSPECT_ACTIVE && multiSelected.length > 0) {
        setMultiSelected([], false, null);
      }
    });

    function reportUrl() {
      try {
        var href = window.location.href || '';
        if (!/^https?:/i.test(href)) return;
        var path = window.location.pathname || '/';
        window.parent.postMessage({
          type: 'PM_LOCATION_CHANGE',
          payload: {
            pathname: path,
            href: href,
            search: window.location.search || '',
            title: document.title || '',
            docId: window.__PM_DOC_ID || ''
          }
        }, '*');
      } catch(e) {}
    }
    reportUrl();
    setTimeout(sendDomTree, 200);

    // Bắt điều hướng popstate, hashchange, load
    window.addEventListener('popstate', function() {
      reportUrl();
      setTimeout(sendDomTree, 150);
    });
    window.addEventListener('hashchange', function() {
      reportUrl();
      setTimeout(sendDomTree, 150);
    });
    window.addEventListener('load', function() {
      reportUrl();
      setTimeout(sendDomTree, 150);
    });

    // Bắt sự kiện click vào các thẻ liên kết <a> trên thanh menu/navbar
    window.addEventListener('click', function(e) {
      var a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (a && a.href && !window.__PM_INSPECT_ACTIVE) {
        setTimeout(reportUrl, 80);
        setTimeout(reportUrl, 300);
        setTimeout(sendDomTree, 350);
      }
    }, false);

    // Hook SPA pushState/replaceState
    try {
      var origPush = history.pushState;
      if (origPush) {
        history.pushState = function() {
          var res = origPush.apply(this, arguments);
          reportUrl();
          setTimeout(sendDomTree, 150);
          return res;
        };
      }
      var origReplace = history.replaceState;
      if (origReplace) {
        history.replaceState = function() {
          var res = origReplace.apply(this, arguments);
          reportUrl();
          setTimeout(sendDomTree, 150);
          return res;
        };
      }
    } catch(err) {}
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

/** Chỉ lấy các frame con hợp lệ (http/https, chưa bị huỷ) — tránh chọc vào chrome-error:// hoặc frame đã dispose. */
function getInjectableChildFrames(): Electron.WebFrameMain[] {
  if (!mainWindow || mainWindow.isDestroyed()) return []
  const mainFrame = mainWindow.webContents.mainFrame
  return getAllWebFrames(mainFrame).filter((frame) => {
    if (frame === mainFrame || frame.isDestroyed()) return false
    try {
      const frameUrl = frame.url || ''
      return frameUrl.startsWith('http://') || frameUrl.startsWith('https://')
    } catch {
      return false
    }
  })
}

function injectInspectorIntoAllFrames(enabled: boolean) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const script = getInspectorScript(enabled)
  try {
    for (const frame of getInjectableChildFrames()) {
      frame.executeJavaScript(script).catch(() => {})
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
    for (const frame of getInjectableChildFrames()) {
      frame.executeJavaScript(script).catch(() => {})
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
      for (const frame of getInjectableChildFrames()) {
        frame.executeJavaScript(script).catch(() => {})
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

          // Bỏ qua các tệp import / directive / layout wrapper hệ thống
          if (
            lowerRel.includes('_viewimports') ||
            lowerRel.includes('_viewstart') ||
            lowerRel.includes('_validationscriptspartial') ||
            lowerRel.endsWith('.bak')
          ) {
            continue
          }

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

/* ───────────────────────── IPC: Toolbox (Hộp công cụ) ───────────────────────── */

ipcMain.handle('toolbox:mutate', async (_e, payload: ToolboxMutationPayload) => {
  try {
    return await runToolboxMutation(payload)
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('toolbox:write-file', async (_e, payload: ToolboxWritePayload) => {
  try {
    return await writeToolboxFile(payload)
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('toolbox:scan', async (_e, projectPath: string) => {
  try {
    return await scanProjectToolbox(projectPath)
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      framework: 'unknown',
      components: [],
      classes: [],
      assets: [],
      routes: [],
    }
  }
})

/* ───────────────────────── IPC: AI ───────────────────────── */

ipcMain.handle('ai:status', async (_e, projectPath?: string) => {
  try {
    return await getStatus(projectPath)
  } catch (error) {
    return {
      provider: 'openai',
      baseUrl: '',
      model: '',
      temperature: 0.2,
      maxTokens: 2048,
      configured: false,
      key: { present: false, source: 'none', masked: '' },
      error: (error as Error).message,
    }
  }
})

ipcMain.handle('ai:models', async (_e, projectPath?: string) => {
  try {
    return await listModels(projectPath)
  } catch {
    return []
  }
})

ipcMain.handle('ai:test', async (_e, projectPath?: string) => {
  try {
    return await testConnection(projectPath)
  } catch (error) {
    return {
      ok: false,
      message: (error as Error).message,
      latencyMs: 0,
      error: (error as Error).message,
    }
  }
})

ipcMain.handle('ai:chat:start', async (event, request: AiChatStartRequest) => {
  return startChat(request, (chatEvent) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('ai:chat:event', chatEvent)
    }
  })
})

ipcMain.handle(
  'ai:complete',
  async (
    _e,
    payload: { prompt: string; system?: string; projectPath?: string },
  ) => completeAi(payload.prompt, payload.system, payload.projectPath),
)

ipcMain.handle('ai:cancel', async (_e, id: string) => cancelChat(id))

ipcMain.handle('ai:chats:history', async (_e, projectId: string, conversationId?: string) =>
  getChatHistory(projectId, conversationId),
)

ipcMain.handle('ai:chats:conversations', async (_e, projectId: string) =>
  getConversations(projectId),
)

ipcMain.handle('ai:chats:clear', async (_e, projectId: string) => clearChatHistory(projectId))

ipcMain.handle(
  'ai:chats:rewrite',
  async (_e, projectId: string, entries: AiChatEntry[], conversationId?: string) =>
    rewriteChatHistory(projectId, entries, conversationId),
)

ipcMain.handle('ai:chats:remove', async (_e, projectId: string, conversationId: string) =>
  removeConversation(projectId, conversationId),
)

ipcMain.handle('ai:context', async (_e, request: AiContextRequest) => {
  return buildContextPack(request)
})

ipcMain.handle('ai:changes:list', async (_e, projectId: string) => listChanges(projectId))

ipcMain.handle('ai:changes:propose', async (_e, request: AiProposeChangeRequest) => {
  return proposeChange(request)
})

ipcMain.handle('ai:changes:accept', async (_e, projectId: string, changeId: string) => {
  return acceptChange(projectId, changeId)
})

ipcMain.handle('ai:changes:reject', async (_e, projectId: string, changeId: string) => {
  return rejectChange(projectId, changeId)
})

ipcMain.handle('ai:changes:undo', async (_e, projectId: string, changeId: string) => {
  return undoChange(projectId, changeId)
})

ipcMain.handle('ai:changes:diff-stats', async (_e, projectPath: string) => {
  return getGitDiffStats(projectPath)
})

ipcMain.handle('ai:changes:git-revert', async (_e, projectPath: string, files?: string[]) => {
  return gitRevertFiles(projectPath, files)
})

ipcMain.handle('ai:tools:list', async () => TOOL_SCHEMAS)

ipcMain.handle('ai:tools:run', async (_e, request: AiToolCallRequest) => runTool(request))

ipcMain.handle('ai:tools:logs', async (_e, projectId?: string) => listToolLogs(projectId))

/* ── Chặng 5: Agent / Anti Gravity Bridge & Kill-Switch ── */
ipcMain.handle('ai:kill-switch', async () => killSwitch())

ipcMain.handle('ai:bridges:getActive', async () => getActiveBridge())

ipcMain.handle('ai:bridges:setActive', async (_e, kind: AiBridgeKind) => setActiveBridge(kind))

ipcMain.handle('ai:bridges:list', async (_e, projectPath?: string) => listBridges(projectPath))

ipcMain.handle('ai:bridges:ping', async (_e, kind: AiBridgeKind, projectPath?: string) =>
  pingBridge(kind, projectPath),
)

ipcMain.handle('ai:audit:list', async (_e, projectId?: string) => listAuditLogs(projectId))

ipcMain.handle('ai:audit:clear', async (_e, projectId?: string) => clearAuditLogs(projectId))

ipcMain.handle('ai:cost:get', async (_e, projectId?: string) => getCostStats(projectId))

ipcMain.handle('ai:cost:setBudget', async (_e, projectId: string, budgetTokens: number) =>
  setTokenBudget(projectId, budgetTokens),
)

ipcMain.handle('ai:cost:reset', async (_e, projectId?: string) => resetCostStats(projectId))

ipcMain.handle('ai:cli:run', async (event, request: AiCliRunRequest) => {
  return runCliAgent(request, (cliEvent) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('ai:cli:event', cliEvent)
    }
  })
})

ipcMain.handle('ai:cli:stop', async (_e, id: string) => stopCliAgent(id))

ipcMain.handle('ai:cli:detect', async (_e, force?: boolean) => detectInstalledClis(force))

ipcMain.handle('ai:cli:models', async (_e, id: string) => listAgentModels(id))

ipcMain.handle('ai:key:save', async (_e, key: string, provider?: string) =>
  saveApiKey(key, provider as never),
)

ipcMain.handle('ai:ws:send', async (_e, message: unknown) => {
  return ideWsBridge.send(message as never)
})

ipcMain.handle('ai:ws:status', async () => ideWsBridge.ping())

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

/** Đọc tokens của dự án: ưu tiên .pixelmind/tokens.json, sau đó variables.css. */
async function readProjectDesignTokens(projectPath: string): Promise<DesignTokens> {
  if (!projectPath) return DEFAULT_DESIGN_TOKENS
  try {
    const metaPath = join(projectPath, '.pixelmind', 'tokens.json')
    try {
      const data = JSON.parse(await fs.readFile(metaPath, 'utf8')) as DesignTokens
      if (data && Array.isArray(data.colors)) return data
    } catch {}

    const cssDir = await findProjectCssDir(projectPath)
    const candidates = [join(cssDir, 'variables.css'), join(projectPath, 'variables.css')]
    for (const candidate of candidates) {
      try {
        const text = await fs.readFile(candidate, 'utf8')
        const parsed = parseVariablesCss(text)
        if (parsed.colors && parsed.colors.length > 0) {
          return { ...DEFAULT_DESIGN_TOKENS, ...parsed }
        }
      } catch {}
    }
  } catch {}
  return DEFAULT_DESIGN_TOKENS
}

/** Dự án đã có bộ token PixelMind chưa (tokens.json / variables.css / tailwind.tokens.js). */
async function projectHasPixelMindTokens(projectPath: string): Promise<boolean> {
  if (!projectPath) return false
  if (await fileExists(join(projectPath, '.pixelmind', 'tokens.json'))) return true
  if (await fileExists(join(projectPath, 'tailwind.tokens.js'))) return true
  const cssDir = await findProjectCssDir(projectPath).catch(() => projectPath)
  for (const candidate of [join(cssDir, 'variables.css'), join(projectPath, 'variables.css')]) {
    try {
      const text = await fs.readFile(candidate, 'utf8')
      if (text.includes('--color-primary') || text.includes('--spacing-1:')) return true
    } catch {}
  }
  return false
}

/** Tìm thư mục gốc dự án từ đường dẫn file nguồn (nếu renderer không truyền projectPath). */
async function resolveProjectRoot(fullPath: string, explicit?: string): Promise<string | null> {
  if (explicit) return explicit
  let dir = dirname(fullPath)
  for (let i = 0; i < 12; i += 1) {
    const markers = [
      join(dir, 'package.json'),
      join(dir, '.pixelmind'),
      join(dir, 'tailwind.config.js'),
      join(dir, 'tailwind.config.cjs'),
      join(dir, 'tailwind.config.mjs'),
      join(dir, 'tailwind.config.ts'),
    ]
    for (const marker of markers) {
      if (await fileExists(marker)) return dir
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

/** Nhận diện dự án có Tailwind không và đang dùng v3 hay v4. */
async function detectTailwindVersion(root: string | null): Promise<'v3' | 'v4' | null> {
  if (!root) return null

  let major = 0
  try {
    const pkg = JSON.parse(await fs.readFile(join(root, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const version = pkg.dependencies?.['tailwindcss'] ?? pkg.devDependencies?.['tailwindcss']
    if (version) {
      const match = version.match(/(\d+)/)
      major = match ? Number(match[1]) : 0
    }
  } catch {}

  if (major >= 4) return 'v4'
  if (major >= 3) return 'v3'

  const configFiles = [
    'tailwind.config.js',
    'tailwind.config.cjs',
    'tailwind.config.mjs',
    'tailwind.config.ts',
  ]
  for (const name of configFiles) {
    if (await fileExists(join(root, name))) return 'v3'
  }

  const cssDirs = [await findProjectCssDir(root).catch(() => root), root]
  const cssNames = ['global.css', 'globals.css', 'app.css', 'index.css', 'site.css', 'main.css', 'styles.css', 'tailwind.css']
  const contents: string[] = []
  for (const dir of cssDirs) {
    for (const name of cssNames) {
      try {
        contents.push(await fs.readFile(join(dir, name), 'utf8'))
      } catch {}
    }
  }
  const joined = contents.join('\n')
  if (/@import\s+["']tailwindcss["']|@theme\b/.test(joined)) return 'v4'
  if (/@tailwind\s+(base|components|utilities)/.test(joined)) return 'v3'
  return null
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
      projectPath,
      styleMode = 'auto',
    }: {
      fullPath: string
      oldText?: string
      newText?: string
      styles?: Record<string, string>
      tagName?: string
      lineNumber?: number
      projectPath?: string
      styleMode?: 'inline' | 'tailwind' | 'auto'
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

      // 2. Cập nhật thuộc tính vào thẻ mở.
      //    - Dự án có Tailwind: ghi className/class + giữ inline style cho phần chưa chuyển được.
      //    - Còn lại (hoặc gặp attribute động): ghi inline style như cũ.
      let modified = false
      let appliedClasses: string[] = []
      let residualStyles: Record<string, string> = {}
      let appliedMode: 'inline' | 'tailwind' = 'inline'
      let tailwindVersion: 'v3' | 'v4' | null = null

      if (styleEntries.length > 0 && tagLineIdx !== -1) {
        let line = lines[tagLineIdx]
        let handled = false

        if (styleMode !== 'inline') {
          const projectRoot = await resolveProjectRoot(fullPath, projectPath)
          tailwindVersion =
            styleMode === 'tailwind' ? 'v3' : await detectTailwindVersion(projectRoot)

          if (tailwindVersion && projectRoot) {
            const hasTokens = await projectHasPixelMindTokens(projectRoot)
            const tokens = hasTokens
              ? await readProjectDesignTokens(projectRoot)
              : { colors: [], typography: [], spacing: [], radius: [] }
            const conversion = stylesToTailwindClasses(finalStyles, tokens, {
              arbitraryValues: true,
            })
            const convertedProperties = conversion.applied.map((item) => item.property)
            const update = isJsx
              ? applyJsxTailwindAttributes(
                  line,
                  tagRegex,
                  conversion.classes,
                  conversion.residualStyles,
                  convertedProperties,
                  tokens
                )
              : applyHtmlTailwindAttributes(
                  line,
                  tagRegex,
                  conversion.classes,
                  conversion.residualStyles,
                  convertedProperties,
                  tokens
                )

            if (!update.unsafe) {
              line = update.line
              modified = update.modified
              appliedClasses = conversion.classes
              residualStyles = conversion.residualStyles
              appliedMode = conversion.classes.length > 0 ? 'tailwind' : 'inline'
              handled = true
            }
          }
        }

        if (!handled) {
          appliedClasses = []
          residualStyles = {}
          appliedMode = 'inline'
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
              const htmlStyleStr = styleEntries
                .map(([k, v]) => `${camelToKebabCase(k)}: ${v};`)
                .join(' ')
              line = line.replace(tagRegex, `$1 style="${htmlStyleStr}"$2`)
            }
          }
          modified = true
        }

        lines[tagLineIdx] = line
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
        return {
          success: true,
          updatedLine: tagLineIdx !== -1 ? lines[tagLineIdx] : undefined,
          mode: appliedMode,
          tailwindVersion: tailwindVersion ?? undefined,
          appliedClasses,
          residualStyles,
        }
      }

      if (oldText && newText && oldText !== newText && content.includes(oldText)) {
        content = content.replace(oldText, newText)
        await fs.writeFile(fullPath, content, 'utf8')
        return {
          success: true,
          mode: appliedMode,
          tailwindVersion: tailwindVersion ?? undefined,
          appliedClasses,
          residualStyles,
        }
      }

      return { success: false, error: 'Không tìm thấy phần tử tương ứng trong tệp mã nguồn' }
    } catch (err: unknown) {
      return { success: false, error: String(err) }
    }
  }
)

/* ───────────────────────── IPC: Đồng bộ logic nối trang vào mã nguồn ───────────────────────── */

interface SourceTagSpan {
  start: number
  end: number
  name: string
  attrsStart: number
  attrsEnd: number
}

const NAV_SOURCE_TAGS = [
  'a',
  'button',
  'link',
  'navlink',
  'routerlink',
  'router-link',
  'nuxt-link',
  'input',
  'li',
  'div',
  'span',
]

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function parseOpeningTagAt(content: string, start: number): SourceTagSpan | null {
  const match = /^<([A-Za-z][\w.:-]*)/.exec(content.slice(start, start + 80))
  if (!match) return null
  let i = start + match[0].length
  const attrsStart = i
  let quote: string | null = null
  let brace = 0
  while (i < content.length) {
    const ch = content[i]
    if (quote) {
      if (ch === quote && content[i - 1] !== '\\') quote = null
    } else if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
    } else if (ch === '{') {
      brace++
    } else if (ch === '}') {
      brace = Math.max(0, brace - 1)
    } else if (ch === '>' && brace === 0) {
      return { start, end: i + 1, name: match[1], attrsStart, attrsEnd: i }
    }
    i++
  }
  return null
}

function collectSourceTags(content: string): SourceTagSpan[] {
  const tags: SourceTagSpan[] = []
  const re = new RegExp(`<(${NAV_SOURCE_TAGS.join('|')})\\b`, 'gi')
  let match: RegExpExecArray | null
  while ((match = re.exec(content)) !== null) {
    const span = parseOpeningTagAt(content, match.index)
    if (span) tags.push(span)
  }
  return tags
}

function pickSourceTag(
  content: string,
  tags: SourceTagSpan[],
  payload: { textSnippet?: string; tagName?: string; className?: string; id?: string },
  lineHint?: number
): SourceTagSpan | null {
  const snippet = (payload.textSnippet || '').trim().slice(0, 30)
  const classes = (payload.className || '')
    .split(/\s+/)
    .filter((c) => c.length > 2 && !GENERIC_CSS_CLASSES[c.toLowerCase()])
  const wantedTag = (payload.tagName || '').toLowerCase()

  let best: SourceTagSpan | null = null
  let bestScore = -1

  for (const tag of tags) {
    const attrs = content.slice(tag.attrsStart, tag.attrsEnd)
    const after = content.slice(tag.end, Math.min(content.length, tag.end + 600))
    const closeIdx = after.search(new RegExp(`</${escapeRegExp(tag.name)}\\b`, 'i'))
    const ownHtml = closeIdx >= 0 ? after.slice(0, closeIdx) : after.slice(0, 200)
    const ownText = ownHtml.replace(/<[^>]*>/g, '')
    let score = 0

    // Chỉ ưu tiên text nằm BÊN TRONG thẻ, tránh nhận nhầm thẻ đứng trước
    if (snippet && (attrs.includes(snippet) || ownText.includes(snippet))) score += 90
    else if (snippet && after.slice(0, 90).includes(snippet)) score += 10
    if (snippet && ownText.includes(snippet)) score += 20
    if (
      payload.id &&
      new RegExp(`\\bid\\s*=\\s*["']${escapeRegExp(payload.id)}["']`, 'i').test(attrs)
    ) {
      score += 120
    }
    for (const cls of classes) {
      if (attrs.includes(cls)) score += 40
    }
    if (wantedTag && wantedTag === tag.name.toLowerCase()) score += 30
    if (['a', 'button', 'link', 'navlink'].includes(tag.name.toLowerCase())) score += 15
    else score -= 15

    if (lineHint) {
      const line = content.slice(0, tag.start).split('\n').length
      if (Math.abs(line - lineHint) <= 30) score += 25
    }

    if (score > bestScore) {
      bestScore = score
      best = tag
    }
  }

  return bestScore >= 40 ? best : null
}

interface AttrMatch {
  fullStart: number
  fullEnd: number
  value: string
}

function findStaticAttr(attrs: string, name: string): AttrMatch | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i')
  const m = re.exec(attrs)
  if (!m) return null
  return { fullStart: m.index, fullEnd: m.index + m[0].length, value: m[2] }
}

function findBracedAttr(attrs: string, name: string): AttrMatch | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*\\{`, 'i')
  const m = re.exec(attrs)
  if (!m) return null
  let i = m.index + m[0].length
  let depth = 1
  let quote: string | null = null
  while (i < attrs.length) {
    const ch = attrs[i]
    if (quote) {
      if (ch === quote && attrs[i - 1] !== '\\') quote = null
    } else if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
    } else if (ch === '{') {
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0) {
        return {
          fullStart: m.index,
          fullEnd: i + 1,
          value: attrs.slice(m.index + m[0].length, i),
        }
      }
    }
    i++
  }
  return null
}

function setStaticAttr(attrs: string, name: string, value: string): string | null {
  const found = findStaticAttr(attrs, name)
  if (!found) return null
  return `${attrs.slice(0, found.fullStart)}${name}="${value}"${attrs.slice(found.fullEnd)}`
}

function upsertStaticAttr(attrs: string, name: string, value: string): string {
  const updated = setStaticAttr(attrs, name, value)
  if (updated !== null) return updated
  return `${attrs.trimEnd()} ${name}="${value}"`
}

function removeStaticAttr(attrs: string, name: string): string {
  const found = findStaticAttr(attrs, name)
  if (!found) return attrs
  return attrs.slice(0, found.fullStart) + attrs.slice(found.fullEnd)
}

/** Tách route kiểu ASP.NET MVC (/Home/Profile hoặc /Profile) thành controller/action/id. */
function routeToAspAction(route: string): { controller: string; action: string; id?: string } {
  const parts = routeCore(route).split('/').filter(Boolean)
  if (parts.length === 0) return { controller: 'Home', action: 'Index' }
  if (parts.length === 1) {
    const single = parts[0]
    if (single.toLowerCase() === 'home') return { controller: 'Home', action: 'Index' }
    // Với các route tầng 1 như /Lobby, /Leaderboard, /Profile, /Privacy, /Room -> controller mặc định là Home
    return { controller: 'Home', action: single }
  }
  return { controller: parts[0], action: parts[1], id: parts[2] }
}

function hasAspNavigation(attrs: string): boolean {
  return /\basp-(action|controller|area|route-[\w-]+)\s*=/i.test(attrs)
}

/** Ghi đè điều hướng ASP.NET Tag Helper (asp-controller/asp-action). */
function setAspNavigation(attrs: string, route: string): string {
  const { controller, action, id } = routeToAspAction(route)
  let result = attrs
  result = removeStaticAttr(result, 'asp-action')
  result = removeStaticAttr(result, 'asp-controller')
  result = removeStaticAttr(result, 'asp-area')
  result = removeStaticAttr(result, 'href')
  result = result.replace(/\s*asp-route-[\w-]+\s*=\s*(["'])[\s\S]*?\1/gi, '')
  result = upsertStaticAttr(result, 'asp-area', '')
  result = upsertStaticAttr(result, 'asp-controller', controller)
  result = upsertStaticAttr(result, 'asp-action', action)
  if (id) result = upsertStaticAttr(result, 'asp-route-id', id)
  return result
}

/** Xoá điều hướng ASP.NET nếu nó đang trỏ tới route cần ngắt. */
function removeAspNavigation(attrs: string, route: string): string {
  const { controller, action } = routeToAspAction(route)
  const routeParts = routeCore(route).toLowerCase().split('/').filter(Boolean)
  const targetActionName = routeParts.pop() || action.toLowerCase()

  const aspAction = findStaticAttr(attrs, 'asp-action')
  if (!aspAction) return attrs

  const currentAction = aspAction.value.trim().toLowerCase()
  const matchesAction =
    currentAction === action.toLowerCase() ||
    currentAction === targetActionName ||
    (routeParts.length > 0 && routeParts.includes(currentAction))

  if (!matchesAction) return attrs

  const aspController = findStaticAttr(attrs, 'asp-controller')
  if (aspController && controller && controller.toLowerCase() !== 'home') {
    if (aspController.value.trim().toLowerCase() !== controller.toLowerCase()) {
      return attrs
    }
  }

  let result = attrs
  result = removeStaticAttr(result, 'asp-action')
  result = removeStaticAttr(result, 'asp-controller')
  result = removeStaticAttr(result, 'asp-area')
  result = result.replace(/\s*asp-route-[\w-]+\s*=\s*(["'])[\s\S]*?\1/gi, '')
  // Không để lại href trỏ tới trang cũ
  const href = findStaticAttr(result, 'href')
  if (href) result = setStaticAttr(result, 'href', '#') ?? result
  else result = `${result.trimEnd()} href="#"`
  return result
}

function routeCore(route: string): string {
  const clean = (route || '').split(/[?#]/)[0].trim()
  return clean.length > 1 ? clean.replace(/\/+$/, '') : '/'
}

function handlerPointsTo(handler: string, route: string): boolean {
  const core = routeCore(route).toLowerCase()
  const lower = handler.toLowerCase()
  if (core === '/') return lower.includes("'/'") || lower.includes('"/"')
  const last = core.split('/').filter(Boolean).pop() || ''
  return lower.includes(core) || (last.length >= 2 && lower.includes(last))
}

function handlerHasNavigation(handler: string): boolean {
  return /navigate\s*\(|history\.(push|replace)\s*\(|location\.(href|assign|replace)|router\.(push|replace)|routerLink/i.test(
    handler
  )
}

function replaceRouteInHandler(handler: string, route: string): string | null {
  const re = /(["'`])(\/[^"'`]*|#[^"'`]*)\1/
  if (!re.test(handler)) return null
  return handler.replace(re, (_m, quote: string) => `${quote}${route}${quote}`)
}

type SourceFlavor = 'jsx' | 'html' | 'vue' | 'svelte' | 'razor'

function detectFlavor(fullPath: string): SourceFlavor {
  const lower = fullPath.toLowerCase()
  if (lower.endsWith('.cshtml') || lower.endsWith('.razor')) return 'razor'
  if (lower.endsWith('.vue')) return 'vue'
  if (lower.endsWith('.svelte')) return 'svelte'
  if (lower.endsWith('.tsx') || lower.endsWith('.jsx') || lower.endsWith('.ts') || lower.endsWith('.js')) return 'jsx'
  return 'html'
}

function addNavigation(attrs: string, tagName: string, route: string, flavor: SourceFlavor): string {
  // Dự án ASP.NET MVC/Razor (.cshtml, .razor) hoặc đã có Tag Helper asp-*
  if (flavor === 'razor' || hasAspNavigation(attrs)) {
    return setAspNavigation(attrs, route)
  }

  const lower = tagName.toLowerCase()
  const preferredAttr =
    ['link', 'navlink', 'routerlink', 'router-link', 'nuxt-link'].includes(lower)
      ? 'to'
      : lower === 'a'
        ? 'href'
        : null

  if (preferredAttr) {
    const set = setStaticAttr(attrs, preferredAttr, route)
    if (set !== null) return set
    for (const name of ['href', 'to', 'data-route']) {
      const existing = setStaticAttr(attrs, name, route)
      if (existing !== null) return existing
      const braced = findBracedAttr(attrs, name)
      if (braced) {
        return `${attrs.slice(0, braced.fullStart)}${name}="${route}"${attrs.slice(braced.fullEnd)}`
      }
    }
    return `${attrs} ${preferredAttr}="${route}"`
  }

  // Nút bấm / phần tử không có thuộc tính điều hướng: gắn handler chuyển trang
  const jsxHandler = flavor === 'jsx' || flavor === 'svelte'
  const clickAttr = flavor === 'jsx' ? 'onClick' : flavor === 'vue' ? '@click' : flavor === 'svelte' ? 'on:click' : 'onclick'

  const braced = findBracedAttr(attrs, clickAttr)
  if (braced) {
    const replaced = replaceRouteInHandler(braced.value, route)
    const nextValue =
      replaced !== null ? replaced : `${braced.value.replace(/\s*$/, '')}; window.location.href = '${route}'`
    return `${attrs.slice(0, braced.fullStart)}${clickAttr}={${nextValue}}${attrs.slice(braced.fullEnd)}`
  }

  const staticH = findStaticAttr(attrs, clickAttr)
  if (staticH) {
    const replaced = replaceRouteInHandler(staticH.value, route)
    const nextValue =
      replaced !== null ? replaced : `${staticH.value.replace(/\s*;?\s*$/, '')};window.location.href='${route}'`
    return `${attrs.slice(0, staticH.fullStart)}${clickAttr}="${nextValue}"${attrs.slice(staticH.fullEnd)}`
  }

  if (jsxHandler) {
    return `${attrs} ${clickAttr}={() => { window.location.href = '${route}' }}`
  }
  if (flavor === 'vue') {
    return `${attrs} @click="window.location.href = '${route}'"`
  }
  return `${attrs} onclick="window.location.href='${route}'"`
}

function removeNavigation(attrs: string, route: string): string {
  let result = attrs

  // Dự án ASP.NET MVC/Razor: gỡ Tag Helper đang trỏ tới trang này
  result = removeAspNavigation(result, route)

  const handlerNames = ['onClick', 'onclick', '@click', 'on:click', 'v-on:click']

  for (const name of handlerNames) {
    const braced = findBracedAttr(result, name)
    if (braced && handlerHasNavigation(braced.value) && handlerPointsTo(braced.value, route)) {
      result = result.slice(0, braced.fullStart) + result.slice(braced.fullEnd)
      continue
    }
    const staticH = findStaticAttr(result, name)
    if (staticH && handlerHasNavigation(staticH.value) && handlerPointsTo(staticH.value, route)) {
      result = result.slice(0, staticH.fullStart) + result.slice(staticH.fullEnd)
    }
  }

  for (const name of ['href', 'to', 'data-route']) {
    const found = findStaticAttr(result, name)
    if (found && routeCore(found.value).toLowerCase() === routeCore(route).toLowerCase()) {
      result = `${result.slice(0, found.fullStart)}${name}="#"${result.slice(found.fullEnd)}`
    }
  }

  // Dọn khoảng trắng thừa sau khi bỏ thuộc tính
  return result.replace(/[ \t]{2,}/g, ' ').replace(/\s+$/, '')
}

ipcMain.handle(
  'inspect:sync-nav',
  async (
    _e,
    payload: {
      projectPath: string
      currentPath?: string
      targetRoute: string
      action: 'link' | 'unlink'
      textSnippet?: string
      tagName?: string
      className?: string
      id?: string
    }
  ) => {
    try {
      if (!payload?.projectPath || !payload.targetRoute) {
        return { success: false, error: 'Thiếu thông tin dự án hoặc trang đích' }
      }

      const loc = await scanProjectForSource(
        payload.projectPath,
        payload.textSnippet,
        payload.tagName,
        payload.className,
        payload.currentPath,
        payload.id
      )
      if (!loc) {
        return { success: false, error: 'Không tìm thấy tệp mã nguồn chứa nút bấm' }
      }

      const content = await fs.readFile(loc.fullPath, 'utf8')
      const tags = collectSourceTags(content)
      const tag = pickSourceTag(content, tags, payload, loc.lineNumber)
      if (!tag) {
        return { success: false, error: 'Không xác định được thẻ chứa nút bấm trong mã nguồn' }
      }

      const flavor = detectFlavor(loc.fullPath)
      const attrs = content.slice(tag.attrsStart, tag.attrsEnd)
      const nextAttrs =
        payload.action === 'link'
          ? addNavigation(attrs, tag.name, payload.targetRoute, flavor)
          : removeNavigation(attrs, payload.targetRoute)

      let finalAttrs = nextAttrs
      if (finalAttrs === attrs && payload.action === 'unlink') {
        // Fallback dứt điểm cho thao tác xoá dây: gỡ mọi liên kết điều hướng dù cú pháp biến thể
        let forced = removeStaticAttr(attrs, 'asp-action')
        forced = removeStaticAttr(forced, 'asp-controller')
        forced = removeStaticAttr(forced, 'asp-area')
        const href = findStaticAttr(forced, 'href')
        if (href) forced = setStaticAttr(forced, 'href', '#') ?? forced
        else forced = `${forced.trimEnd()} href="#"`
        if (forced !== attrs) {
          finalAttrs = forced
        }
      }

      if (finalAttrs === attrs) {
        return {
          success: false,
          error:
            payload.action === 'link'
              ? 'Nút bấm đã trỏ tới trang này rồi'
              : 'Không tìm thấy logic nối trang tương ứng trong mã nguồn',
        }
      }

      const nextTag = `<${tag.name}${finalAttrs}>`
      const updated = content.slice(0, tag.start) + nextTag + content.slice(tag.end)
      await fs.writeFile(loc.fullPath, updated, 'utf8')

      const lineNumber = updated.slice(0, tag.start).split('\n').length
      return {
        success: true,
        filePath: loc.filePath,
        lineNumber,
        oldLine: content.split('\n')[lineNumber - 1]?.trim(),
        newLine: nextTag.trim(),
      }
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
  return readProjectDesignTokens(projectPath)
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
      const mainCssNames = ['site.css', 'main.css', 'app.css', 'style.css', 'global.css', 'globals.css', 'index.css']
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

        // Tailwind v4 dùng cấu hình CSS-first: sinh thêm @theme và tự import nếu tìm thấy file CSS chính.
        const tailwindVersion = await detectTailwindVersion(projectPath)
        if (tailwindVersion === 'v4') {
          const themeFile = join(cssDir, 'tailwind.tokens.css')
          await fs.writeFile(themeFile, generateTailwindThemeCss(tokens), 'utf8')
          for (const name of mainCssNames) {
            const fullMain = join(cssDir, name)
            try {
              const stat = await fs.stat(fullMain)
              if (!stat.isFile()) continue
              let raw = await fs.readFile(fullMain, 'utf8')
              if (!raw.includes('tailwind.tokens.css')) {
                if (raw.includes('variables.css')) {
                  raw = raw.replace(
                    /(@import\s+['"]\.\/variables\.css['"];?)/,
                    `$1\n@import './tailwind.tokens.css';`
                  )
                } else {
                  raw = `@import './tailwind.tokens.css';\n\n${raw}`
                }
                await fs.writeFile(fullMain, raw, 'utf8')
              }
              break
            } catch {}
          }
        }
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
        for (const frame of getInjectableChildFrames()) {
          frame.executeJavaScript(liveScript).catch(() => {})
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

  app.on('certificate-error', (event, _webContents, url, _error, _certificate, callback) => {
    if (url.startsWith('https://localhost') || url.startsWith('https://127.0.0.1')) {
      event.preventDefault()
      callback(true)
      return
    }
    callback(false)
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('com.pixelmind.desktop')

    /* Gỡ bỏ triệt để X-Frame-Options, frame-ancestors và các hạn chế chính sách nhúng
       (COOP, COEP, CORP) của các dev server (ASP.NET Core Identity, Razor, Vite...)
       để khung iframe xem trước PreviewPane hiển thị mọi trang nội bộ mượt mà */
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = { ...details.responseHeaders }
      for (const key of Object.keys(responseHeaders)) {
        const lower = key.toLowerCase()
        if (
          lower === 'x-frame-options' ||
          lower === 'cross-origin-opener-policy' ||
          lower === 'cross-origin-embedder-policy' ||
          lower === 'cross-origin-resource-policy'
        ) {
          delete responseHeaders[key]
        } else if (lower === 'content-security-policy' || lower === 'content-security-policy-report-only') {
          const list = responseHeaders[key]
          if (Array.isArray(list)) {
            responseHeaders[key] = list.map((csp) =>
              csp
                .split(';')
                .filter((part) => !part.trim().toLowerCase().startsWith('frame-ancestors'))
                .join('; '),
            )
          }
        }
      }
      callback({ cancel: false, responseHeaders })
    })

    buildMenu()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    runner.stopAll()
    terminalManager.killAll()
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', (event) => {
    // Thoát bằng menu/⌘Q/Ctrl+Q khi chưa xác nhận → hỏi trước, giữ nguyên server nếu ở lại.
    if (!quitApproved) {
      event.preventDefault()
      handleQuitAttempt()
      return
    }
    runner.stopAll()
    terminalManager.killAll()
  })

  process.on('exit', () => {
    runner.stopAll()
    terminalManager.killAll()
  })
  process.on('SIGINT', () => {
    runner.stopAll()
    terminalManager.killAll()
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    runner.stopAll()
    terminalManager.killAll()
    process.exit(0)
  })
}
