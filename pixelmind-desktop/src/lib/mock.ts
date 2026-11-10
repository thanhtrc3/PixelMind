import type { PixelMindApi } from '@shared/api'
import { DEFAULT_DESIGN_TOKENS } from './designTokens'
import type {
  FileContent,
  FileNode,
  ProjectRecord,
  RunLog,
  RunState,
  Settings,
} from '@shared/types'
import type {
  AiChange,
  AiChatEvent,
  AiChatStartRequest,
  AiContextRequest,
  AiProposeChangeRequest,
  AiToolCallRequest,
} from '@shared/ai'
import { estimateTokens } from '@shared/ai'
import { DEFAULT_SETTINGS } from '@shared/types'

/* Bản giả lập dùng khi mở giao diện bằng trình duyệt (không có Electron).
   Giúp xem trước / kiểm thử giao diện mà không cần build desktop. */

export const DEMO_ROOT = 'D:\\DEMO\\shopweb'

const now = Date.now()

const demoProject: ProjectRecord = {
  id: 'demo-project',
  name: 'shopweb',
  path: DEMO_ROOT,
  framework: 'React + Vite',
  packageManager: 'npm',
  scripts: [
    { name: 'dev', command: 'vite', kind: 'dev' },
    { name: 'build', command: 'tsc -b && vite build', kind: 'build' },
    { name: 'preview', command: 'vite preview', kind: 'other' },
    { name: 'lint', command: 'eslint .', kind: 'other' },
  ],
  hasIndexHtml: true,
  previewDir: '',
  addedAt: now - 86_400_000 * 6,
  lastOpenedAt: now - 3_600_000,
  favorite: true,
  meta: {
    owner: 'Nguyễn Thanh Hiền',
    code: 'DA-004',
    repo: 'hien-nguyen/shopweb',
    createdAt: now - 86_400_000 * 16,
    customCommand: '',
    pages: [
      { id: 'p1', route: '/', title: 'Trang chủ', mockup: true, software: 'Figma', frame: '1440×900' },
      { id: 'p2', route: '/dang-nhap', title: 'Đăng nhập', mockup: true, software: 'Photoshop', frame: '390×844' },
      { id: 'p3', route: '/gio-hang', title: 'Giỏ hàng', mockup: false, software: '—', frame: '—' },
      { id: 'p4', route: '/san-pham', title: 'Danh sách sản phẩm', mockup: false, software: '—', frame: '—' },
    ],
    versions: [
      { id: 'v3', name: 'v3', status: 'review', hash: 'a41f9c2', date: '17/10', note: 'Sửa nút Đăng nhập theo ảnh mẫu · AI sửa 2 vòng' },
      { id: 'v2', name: 'v2', status: 'ok', hash: '77b0de1', date: '16/10', note: 'Đổi màu header sang #111111 · sửa tay' },
      { id: 'v1', name: 'v1', status: 'ok', hash: '05ce7aa', date: '15/10', note: 'Dựng khung trang chủ từ part có sẵn' },
    ],
    activity: [
      {
        id: 'a1',
        at: now - 2 * 3_600_000,
        actor: 'Nguyễn Thanh Hiền',
        action: 'Chèn part Searchbox bo tròn vào /',
        kind: 'người',
        status: 'ok',
      },
      {
        id: 'a2',
        at: now - 3 * 3_600_000,
        actor: 'Máy kiểm tra',
        action: 'Kiểm tra token trang — 11/11 sạch',
        kind: 'hệ thống',
        status: 'ok',
      },
      {
        id: 'a3',
        at: now - 26 * 3_600_000,
        actor: 'AI · Antigravity',
        action: 'Sửa nút Đăng nhập theo ảnh mẫu (2 vòng)',
        kind: 'AI',
        status: 'warn',
      },
    ],
  },
}

const node = (path: string, type: 'dir' | 'file', children?: FileNode[]): FileNode => ({
  name: path.split(/[\\/]/).pop() ?? path,
  path,
  type,
  ext: type === 'file' ? (path.split('.').pop() ?? '').toLowerCase() : '',
  size: type === 'file' ? 1200 + path.length * 37 : 0,
  children,
})

const demoTree = (): FileNode[] => [
  node(`${DEMO_ROOT}\\src`, 'dir', [
    node(`${DEMO_ROOT}\\src\\components`, 'dir', [
      node(`${DEMO_ROOT}\\src\\components\\Header.tsx`, 'file'),
      node(`${DEMO_ROOT}\\src\\components\\ProductCard.tsx`, 'file'),
      node(`${DEMO_ROOT}\\src\\components\\CartDrawer.tsx`, 'file'),
    ]),
    node(`${DEMO_ROOT}\\src\\pages`, 'dir', [
      node(`${DEMO_ROOT}\\src\\pages\\Home.tsx`, 'file'),
      node(`${DEMO_ROOT}\\src\\pages\\Checkout.tsx`, 'file'),
    ]),
    node(`${DEMO_ROOT}\\src\\styles`, 'dir', [node(`${DEMO_ROOT}\\src\\styles\\global.css`, 'file')]),
    node(`${DEMO_ROOT}\\src\\App.tsx`, 'file'),
    node(`${DEMO_ROOT}\\src\\main.tsx`, 'file'),
  ]),
  node(`${DEMO_ROOT}\\public`, 'dir', [node(`${DEMO_ROOT}\\public\\favicon.svg`, 'file')]),
  node(`${DEMO_ROOT}\\index.html`, 'file'),
  node(`${DEMO_ROOT}\\package.json`, 'file'),
  node(`${DEMO_ROOT}\\README.md`, 'file'),
  node(`${DEMO_ROOT}\\vite.config.ts`, 'file'),
  node(`${DEMO_ROOT}\\tsconfig.json`, 'file'),
]

const demoFiles: Record<string, string> = {
  [`${DEMO_ROOT}\\src\\App.tsx`]: `import Header from './components/Header'
import Home from './pages/Home'

export default function App() {
  return (
    <div className="shop">
      <Header />
      <main>
        <Home />
      </main>
    </div>
  )
}
`,
  [`${DEMO_ROOT}\\src\\components\\Header.tsx`]: `export default function Header() {
  return (
    <header className="header">
      <a className="header__logo" href="/">ShopWeb</a>
      <nav className="header__nav">
        <a href="/">Trang chủ</a>
        <a href="/products">Sản phẩm</a>
        <a href="/cart">Giỏ hàng</a>
      </nav>
    </header>
  )
}
`,
  [`${DEMO_ROOT}\\package.json`]: `{
  "name": "shopweb",
  "private": true,
  "version": "0.3.0",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint ."
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  }
}
`,
  [`${DEMO_ROOT}\\README.md`]: `# ShopWeb

Giao diện cửa hàng mẫu dùng để kiểm thử PixelMind.

## Lệnh

- \`npm run dev\` — chạy máy chủ phát triển
- \`npm run build\` — đóng gói
`,
  [`${DEMO_ROOT}\\vite.config.ts`]: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({ plugins: [react()] })
`,
  [`${DEMO_ROOT}\\index.html`]: `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <title>ShopWeb</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
}

const readSettings = (): Settings => {
  try {
    const raw = localStorage.getItem('pixelmind:settings')
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

const writeSettings = (settings: Settings) => {
  try {
    localStorage.setItem('pixelmind:settings', JSON.stringify(settings))
  } catch {
    /* trình duyệt chặn lưu trữ */
  }
}

const readProjects = (): ProjectRecord[] => {
  try {
    const raw = localStorage.getItem('pixelmind:projects')
    if (raw) {
      return (JSON.parse(raw) as ProjectRecord[]).map((project) => ({
        ...project,
        meta: { ...demoProject.meta, ...(project.meta ?? {}) },
      }))
    }
  } catch {
    /* bỏ qua */
  }
  return [demoProject]
}

const writeProjects = (projects: ProjectRecord[]) => {
  try {
    localStorage.setItem('pixelmind:projects', JSON.stringify(projects))
  } catch {
    /* bỏ qua */
  }
}

export function createBrowserMock(): PixelMindApi {
  const logListeners = new Set<(log: RunLog) => void>()
  const stateListeners = new Set<(state: RunState) => void>()
  let currentRun: RunState | null = null
  const timers: number[] = []
  const aiEventListeners = new Set<(event: AiChatEvent) => void>()
  const aiChanges: AiChange[] = []
  const emitAi = (event: AiChatEvent) => aiEventListeners.forEach((cb) => cb(event))

  const emitLog = (stream: RunLog['stream'], text: string) => {
    if (!currentRun) return
    const log: RunLog = { runId: currentRun.id, stream, text, at: Date.now() }
    logListeners.forEach((cb) => cb(log))
  }

  const emitState = (patch: Partial<RunState>) => {
    if (!currentRun) return
    currentRun = { ...currentRun, ...patch }
    stateListeners.forEach((cb) => cb(currentRun as RunState))
  }

  const clear = () => {
    timers.forEach((t) => window.clearTimeout(t))
    timers.length = 0
  }

  return {
    async getAppInfo() {
      return {
        appVersion: '0.1.0',
        electron: 'bản trình duyệt',
        chrome: navigator.userAgent,
        node: '—',
        platform: 'browser',
        arch: '—',
        userDataPath: 'Chỉ khả dụng trên bản desktop',
        home: 'Chỉ khả dụng trên bản desktop',
      }
    },
    store: {
      async get() {
        return {
          settings: readSettings(),
          projects: readProjects(),
          lastProjectId: readProjects()[0]?.id ?? null,
        }
      },
      async patch(patch) {
        return { settings: readSettings(), projects: readProjects(), lastProjectId: null, ...patch }
      },
      async updateSettings(patch) {
        const settings = { ...readSettings(), ...patch }
        writeSettings(settings)
        return settings
      },
      async resetSettings() {
        writeSettings({ ...DEFAULT_SETTINGS })
        return { ...DEFAULT_SETTINGS }
      },
      async reset() {
        writeSettings({ ...DEFAULT_SETTINGS })
        writeProjects([demoProject])
        return { settings: { ...DEFAULT_SETTINGS }, projects: [demoProject], lastProjectId: demoProject.id }
      },
      async path() {
        return 'Trình duyệt không có thư mục dữ liệu'
      },
    },
    projects: {
      async pickFolder() {
        return null
      },
      async add() {
        return null
      },
      async list() {
        return readProjects()
      },
      async open(id) {
        const projects = readProjects().map((p) =>
          p.id === id ? { ...p, lastOpenedAt: Date.now() } : p,
        )
        writeProjects(projects)
        return projects.find((p) => p.id === id) ?? null
      },
      async remove(id) {
        const projects = readProjects().filter((p) => p.id !== id)
        writeProjects(projects)
        return projects
      },
      async favorite(id) {
        const projects = readProjects().map((p) => (p.id === id ? { ...p, favorite: !p.favorite } : p))
        writeProjects(projects)
        return projects
      },
      async refresh(id) {
        return readProjects().find((p) => p.id === id) ?? null
      },
      async addPage(projectId, page) {
        const projects = readProjects().map((p) =>
          p.id === projectId
            ? {
                ...p,
                meta: {
                  ...p.meta,
                  pages: [...p.meta.pages, { ...page, id: `p-${Date.now()}` }],
                  activity: [
                    {
                      id: `a-${Date.now()}`,
                      at: Date.now(),
                      actor: 'bạn',
                      action: `Thêm trang ${page.route} — ${page.title}`,
                      kind: 'người' as const,
                      status: 'ok' as const,
                    },
                    ...p.meta.activity,
                  ],
                },
              }
            : p,
        )
        writeProjects(projects)
        return projects.find((p) => p.id === projectId) ?? null
      },
      async duplicatePage(projectId, pageId, payload) {
        const source = readProjects()
          .find((p) => p.id === projectId)
          ?.meta.pages.find((item) => item.id === pageId)
        if (!source) return null
        const duplicated = {
          ...source,
          id: `p-${Date.now()}`,
          route: payload.route,
          title: payload.title,
          filePath: undefined,
          sampleParams: source.sampleParams ? [...source.sampleParams] : undefined,
        }
        const projects = readProjects().map((p) =>
          p.id === projectId
            ? {
                ...p,
                meta: {
                  ...p.meta,
                  pages: [...p.meta.pages, duplicated],
                  activity: [
                    {
                      id: `a-${Date.now()}`,
                      at: Date.now(),
                      actor: 'bạn',
                      action: `Nhân bản trang ${source.route} → ${payload.route}`,
                      kind: 'người' as const,
                      status: 'ok' as const,
                    },
                    ...p.meta.activity,
                  ],
                },
              }
            : p,
        )
        writeProjects(projects)
        return projects.find((p) => p.id === projectId) ?? null
      },
      async pageFilePreview() {
        return {
          supported: false,
          label: 'Bản xem trước trình duyệt',
          relativePath: '',
          exists: false,
          reason: 'Chế độ xem trước trên trình duyệt không đọc/ghi được tệp. Hãy dùng bản desktop để tạo tệp route.',
        }
      },
      async updatePage(projectId, page) {
        const projects = readProjects().map((p) =>
          p.id === projectId
            ? {
                ...p,
                meta: {
                  ...p.meta,
                  pages: p.meta.pages.map((item) => (item.id === page.id ? page : item)),
                  activity: [
                    {
                      id: `a-${Date.now()}`,
                      at: Date.now(),
                      actor: 'bạn',
                      action: `Cập nhật trang ${page.route} — ${page.title}`,
                      kind: 'người' as const,
                      status: 'ok' as const,
                    },
                    ...p.meta.activity,
                  ],
                },
              }
            : p,
        )
        writeProjects(projects)
        return projects.find((p) => p.id === projectId) ?? null
      },
      async diagnose() {
        return { healthy: true, hasIssues: false, checkedAt: Date.now(), issues: [] }
      },
      async gitGraph() {
        return { branch: null, hasRemote: false, commits: [] }
      },
      async gitFetch() {
        return { ok: false, error: 'Đồng bộ Git chỉ khả dụng trên bản desktop.' }
      },
      async gitRollback() {
        return { ok: false, error: 'Khôi phục Git chỉ khả dụng trên bản desktop.' }
      },
      async gitInit() {
        return true
      },
      async createIndexHtml() {
        return true
      },
      async addDevScript() {
        return true
      },
      async removePage(projectId, pageId) {
        const projects = readProjects().map((p) =>
          p.id === projectId
            ? { ...p, meta: { ...p.meta, pages: p.meta.pages.filter((page) => page.id !== pageId) } }
            : p,
        )
        writeProjects(projects)
        return projects.find((p) => p.id === projectId) ?? null
      },      async setCommand(projectId, command) {
        const projects = readProjects().map((p) =>
          p.id === projectId ? { ...p, meta: { ...p.meta, customCommand: command.trim() } } : p,
        )
        writeProjects(projects)
        return projects.find((p) => p.id === projectId) ?? null
      },
    },
    fs: {
      async tree() {
        return demoTree()
      },
      async read(path): Promise<FileContent> {
        const name = path.split(/[\\/]/).pop() ?? path
        const ext = (name.split('.').pop() ?? '').toLowerCase()
        return {
          path,
          name,
          ext,
          size: (demoFiles[path] ?? '').length,
          text: demoFiles[path] ?? `// Bản xem trước trên trình duyệt\n// Nội dung tệp ${name} chỉ đọc được trên bản desktop.\n`,
          truncated: false,
          binary: false,
        }
      },
      async write() {
        return false
      },
      async stat() {
        return { files: 148, folders: 23, totalSize: 2_400_000 }
      },
      async git() {
        return 'main'
      },
      async showInFolder() {
        return undefined
      },
      async openPath() {
        return 'Chỉ khả dụng trên bản desktop'
      },
      async exists() {
        return true
      },
      async special() {
        return 'Chỉ khả dụng trên bản desktop'
      },
      async createFile() {
        return true
      },
      async createDir() {
        return true
      },
      async rename() {
        return true
      },
      async trash() {
        return true
      },
    },
    assets: {
      async add() {
        return { canceled: true, added: [] as Array<{ source: string; destination: string; copied: boolean }> }
      },
      async remove() {
        return { success: false, error: 'Chỉ khả dụng trên bản desktop' }
      },
      async restore() {
        return { success: false, error: 'Chỉ khả dụng trên bản desktop' }
      },
    },
    run: {
      async install(projectId) {
        clear()
        currentRun = {
          id: `mock-install-${Date.now()}`,
          projectId,
          cwd: DEMO_ROOT,
          script: 'install',
          command: 'npm install',
          status: 'running',
          url: null,
          exitCode: null,
          startedAt: Date.now(),
          kind: 'install',
        }
        emitLog('system', `$ npm install  (${DEMO_ROOT})\n`)
        emitLog('system', '[system] Bắt đầu cài đặt các gói phụ thuộc...\n')
        timers.push(
          window.setTimeout(() => emitLog('stdout', 'added 28 packages in 1.4s\n'), 800),
          window.setTimeout(() => {
            emitLog('system', '\n[system] Cài đặt thư viện hoàn tất thành công!\n')
            emitState({ status: 'stopped', exitCode: 0 })
          }, 1500),
        )
        return currentRun
      },
      async start(projectId, script) {
        clear()
        currentRun = {
          id: `mock-${Date.now()}`,
          projectId,
          cwd: DEMO_ROOT,
          script,
          command: script === 'static' ? 'static-server' : `npm run ${script}`,
          status: 'running',
          url: null,
          exitCode: null,
          startedAt: Date.now(),
          kind: script === 'static' ? 'static' : 'script',
        }
        emitLog('system', `$ ${currentRun.command}  (${DEMO_ROOT})\n`)
        timers.push(
          window.setTimeout(() => emitLog('stdout', '\n  VITE v8.3.5  ready in 412 ms\n\n'), 700),
          window.setTimeout(() => {
            emitLog('stdout', '  ➜  Local:   http://localhost:5173/\n  ➜  Network: use --host to expose\n')
            emitState({ url: 'http://localhost:5173' })
          }, 1400),
        )
        return currentRun
      },
      async startCommand(projectId, command) {
        clear()
        currentRun = {
          id: `mock-${Date.now()}`,
          projectId,
          cwd: DEMO_ROOT,
          script: 'tuỳ chỉnh',
          command,
          status: 'running',
          url: null,
          exitCode: null,
          startedAt: Date.now(),
          kind: 'command',
        }
        emitLog('system', `$ ${command}  (${DEMO_ROOT})\n`)
        timers.push(
          window.setTimeout(() => {
            emitLog('stdout', '  ➜  Local:   http://localhost:5180/\n')
            emitState({ url: 'http://localhost:5180' })
          }, 1200),
        )
        return currentRun
      },
      async stop() {
        clear()
        emitLog('system', '\n[system] Đã dừng tiến trình.\n')
        emitState({ status: 'stopped' })
        return true
      },
      async stopOfProject() {
        clear()
        emitState({ status: 'stopped' })
        return true
      },
      async stopAll() {
        clear()
        emitState({ status: 'stopped' })
        return true
      },
      async list() {
        return currentRun ? [currentRun] : []
      },
      async ofProject(projectId) {
        return currentRun && currentRun.projectId === projectId ? currentRun : null
      },
      onLog(cb) {
        logListeners.add(cb)
        return () => logListeners.delete(cb)
      },
      onState(cb) {
        stateListeners.add(cb)
        return () => stateListeners.delete(cb)
      },
    },
    inspect: {
      async setMode(_enabled) {
        return true
      },
      async applyStyle(_payload) {
        return true
      },
      async resetOriginal() {
        return true
      },
      async locateSource(_payload) {
        return null
      },
      async syncCode(_payload) {
        return { success: true, oldLine: '<span>Old</span>', newLine: '<span>New</span>' }
      },
      async syncNav(_payload) {
        return { success: true, filePath: 'src/App.tsx', lineNumber: 1 }
      },
    },
    tokens: {
      async get(_projectPath) {
        return { ...DEFAULT_DESIGN_TOKENS }
      },
      async save(_payload) {
        return { success: true, filePath: 'src/styles/variables.css' }
      },
    },
    toolbox: {
      async mutate(_payload) {
        return {
          success: true,
          filePath: 'src/App.tsx',
          fullPath: 'src/App.tsx',
          oldBlock: '<div>Old</div>',
          newBlock: '<div>New</div>',
          startLine: 1,
          endLine: 1,
          element: null,
        }
      },
      async writeFile(_payload) {
        return { success: true }
      },
      async scan(_projectPath) {
        return {
          success: true,
          framework: 'html' as const,
          components: [],
          classes: [],
          assets: [],
          routes: [],
        }
      },
    },
    ai: {
      async status() {
        return {
          provider: 'openai' as const,
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-4o-mini',
          temperature: 0.2,
          maxTokens: 2048,
          configured: false,
          key: { present: false, source: 'none' as const, masked: '' },
          error: 'Bản xem trước trên trình duyệt không thể đọc biến môi trường. Hãy chạy bản desktop.',
        }
      },
      async models() {
        return []
      },
      async test() {
        return {
          ok: false,
          message: 'Bản trình duyệt không kết nối được AI. Hãy chạy PixelMind Desktop.',
          latencyMs: 0,
          error: 'browser-mock',
        }
      },
      async saveKey(key: string) {
        return { ok: true, masked: `${key.slice(0, 3)}…${key.slice(-4)}` }
      },
      async chat(request: AiChatStartRequest) {
        const id = `mock-chat-${Date.now()}`
        const reply =
          'Đây là phản hồi mô phỏng trên trình duyệt. Bản desktop sẽ gọi AI thật qua gateway và hiển thị diff thật để bạn duyệt.'
        emitAi({ type: 'start', id, at: Date.now() })
        const chunks = reply.split(' ')
        chunks.forEach((word, index) => {
          timers.push(
            window.setTimeout(
              () => emitAi({ type: 'delta', id, text: index === 0 ? word : ` ${word}` }),
              120 * (index + 1),
            ),
          )
        })
        timers.push(
          window.setTimeout(() => emitAi({ type: 'done', id, at: Date.now() }), 120 * (chunks.length + 1)),
        )
        void request
        return { id }
      },
      async cancel() {
        return true
      },
      async complete(payload: { prompt: string; system?: string }) {
        void payload
        return { text: '[]' }
      },
      onChatEvent(cb: (event: AiChatEvent) => void) {
        aiEventListeners.add(cb)
        return () => aiEventListeners.delete(cb)
      },
      chats: {
        async history() {
          return []
        },
        async clear() {
          return true
        },
      },
      async context(request: AiContextRequest) {
        const pack = {
          version: 1 as const,
          createdAt: Date.now(),
          mode: 'selection' as const,
          project: {
            id: request.projectId,
            name: request.projectName,
            path: request.projectPath,
            route: request.route,
          },
          selection: request.selection
            ? {
                tag: request.selection.tag,
                id: request.selection.id,
                className: request.selection.className,
                text: request.selection.text,
              }
            : undefined,
        }
        const json = JSON.stringify(pack, null, 2)
        return {
          pack,
          json,
          tokens: estimateTokens(json),
          budget: request.tokenBudget ?? 6000,
          dropped: [],
          notes: ['Bản trình duyệt chỉ mô phỏng gói ngữ cảnh — bản desktop đọc tệp thật.'],
        }
      },
      changes: {
        async list(projectId: string) {
          return aiChanges.filter((change) => change.projectId === projectId)
        },
        async propose(request: AiProposeChangeRequest) {
          const change: AiChange = {
            id: `mock-chg-${Date.now()}`,
            projectId: request.projectId,
            file: request.file,
            fullPath: `${request.projectPath}/${request.file}`,
            summary: request.summary,
            added: request.content.split('\n').length,
            removed: 1,
            status: 'pending',
            diff: [
              { kind: 'hunk', text: '@@ -1,1 +1,1 @@' },
              { kind: 'del', text: '// nội dung cũ (mô phỏng)' },
              ...request.content
                .split('\n')
                .slice(0, 20)
                .map((line) => ({ kind: 'add' as const, text: line })),
            ],
            createdAt: Date.now(),
            task: request.task,
          }
          aiChanges.unshift(change)
          return change
        },
        async accept(projectId: string, changeId: string) {
          const target = aiChanges.find((change) => change.id === changeId)
          if (target) {
            target.status = 'accepted'
            target.appliedAt = Date.now()
          }
          return aiChanges.filter((change) => change.projectId === projectId)
        },
        async reject(projectId: string, changeId: string) {
          const target = aiChanges.find((change) => change.id === changeId)
          if (target) target.status = 'rejected'
          return aiChanges.filter((change) => change.projectId === projectId)
        },
        async undo(projectId: string, changeId: string) {
          const target = aiChanges.find((change) => change.id === changeId)
          if (target) {
            target.status = 'undone'
            target.undoneAt = Date.now()
          }
          return aiChanges.filter((change) => change.projectId === projectId)
        },
      },
      tools: {
        async list() {
          return [
            { name: 'read_file' as const, description: 'Đọc tệp', risk: 'read' as const, requiresApproval: false, parameters: {} },
            { name: 'search_project' as const, description: 'Tìm trong dự án', risk: 'read' as const, requiresApproval: false, parameters: {} },
            { name: 'apply_patch' as const, description: 'Đề xuất sửa tệp', risk: 'write' as const, requiresApproval: true, parameters: {} },
            { name: 'run_build' as const, description: 'Chạy build', risk: 'exec' as const, requiresApproval: true, parameters: {} },
            { name: 'sync_nav' as const, description: 'Nối điều hướng', risk: 'write' as const, requiresApproval: true, parameters: {} },
          ]
        },
        async run(request: AiToolCallRequest) {
          return {
            ok: true,
            tool: request.tool,
            output: 'Tool mô phỏng trên trình duyệt — không thực thi thật.',
          }
        },
        async logs() {
          return []
        },
      },
      async killSwitch() {
        return { count: 0, ok: true }
      },
      bridges: {
        async getActive() {
          return 'api' as const
        },
        async setActive(kind) {
          return {
            kind,
            name: kind === 'ide' ? 'IDE WebSocket' : kind === 'cli' ? 'CLI Bridge' : 'API Bridge',
            detail: 'Mô phỏng trình duyệt',
            status: 'online' as const,
          }
        },
        async list() {
          return [
            { kind: 'api' as const, name: 'API Bridge', detail: 'OpenAI · GPT-4o', status: 'online' as const },
            { kind: 'ide' as const, name: 'IDE WebSocket', detail: 'ws://localhost:45678', status: 'offline' as const },
            { kind: 'cli' as const, name: 'CLI Bridge', detail: 'Local Agent CLI', status: 'local' as const },
            { kind: 'ollama' as const, name: 'Ollama Local', detail: 'http://localhost:11434', status: 'offline' as const },
          ]
        },
        async ping(kind) {
          return {
            kind,
            name: kind,
            detail: 'Mock ping',
            status: 'online' as const,
          }
        },
      },
      audit: {
        async list() {
          return []
        },
        async clear() {
          return true
        },
      },
      cost: {
        async get(projectId?: string) {
          return {
            projectId,
            promptTokens: 1240,
            completionTokens: 580,
            totalTokens: 1820,
            estimatedCostUsd: 0.0005,
            budgetTokens: 100000,
            percentageUsed: 2,
            isOverBudget: false,
            isNearBudget: false,
          }
        },
        async setBudget(_projectId: string, budgetTokens: number) {
          return {
            promptTokens: 1240,
            completionTokens: 580,
            totalTokens: 1820,
            estimatedCostUsd: 0.0005,
            budgetTokens,
            percentageUsed: Math.round((1820 / budgetTokens) * 100),
            isOverBudget: false,
            isNearBudget: false,
          }
        },
        async reset() {
          return true
        },
      },
      cli: {
        async run() {
          return { id: 'mock-cli' }
        },
        async stop() {
          return true
        },
        async detect() {
          return [
            {
              id: 'antigravity',
              binary: 'agy',
              name: 'Antigravity CLI (agy)',
              installed: true,
              description: 'Google Antigravity Agent CLI',
              supportsRun: false,
              auth: 'unknown' as const,
            },
            {
              id: 'opencode',
              binary: 'opencode',
              name: 'OpenCode',
              installed: true,
              version: '1.0.0',
              description: 'OpenCode terminal agent',
              supportsRun: true,
              auth: 'unknown' as const,
            },
            {
              id: 'codex',
              binary: 'codex',
              name: 'Codex CLI (ChatGPT)',
              installed: false,
              description: 'OpenAI Codex CLI',
              supportsRun: true,
              auth: 'unknown' as const,
            },
          ]
        },
        async models() {
          return ['mock-model']
        },
        onEvent() {
          return () => {}
        },
      },
      ws: {
        async send() {
          return true
        },
        async status() {
          return { online: false, latencyMs: 0 }
        },
      },
    },
    system: {
      async openExternal(url) {
        window.open(url, '_blank', 'noopener')
        return true
      },      onMenuAction() {
        return () => undefined
      },
      async popupMenu() {
        return false
      },
      async clearCache() {
        return true
      },
    },
    window: {
      async minimize() {},
      async maximize() {},
      async close() {},
      async isMaximized() {
        return false
      },
      setZoomFactor(factor: number) {
        document.documentElement.style.zoom = String(factor)
      },
      getZoomFactor() {
        return 1
      },
    },
  }
}
