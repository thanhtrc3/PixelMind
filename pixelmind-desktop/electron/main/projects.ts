import { promises as fs } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { basename, extname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { userInfo } from 'node:os'
import type {
  FileContent,
  FileNode,
  PackageManager,
  ProjectDiagnosis,
  ProjectIssue,
  ProjectMeta,
  ProjectPage,
  ProjectRecord,
  ProjectStat,
  ProjectVersion,
  ScriptEntry,
} from '../../shared/types'

const execFileAsync = promisify(execFile)

/* Đọc / dò cấu trúc dự án trên đĩa. Chỉ dùng fs của Node, không phụ thuộc thư viện. */

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '.vs',
  '.vscode',
  '.idea',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.output',
  '.turbo',
  '.cache',
  'coverage',
  'release',
  'vendor',
  '__pycache__',
  '.venv',
  'venv',
  'target',
])

const TEXT_EXT = new Set([
  'txt', 'md', 'markdown', 'json', 'jsonc', 'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'mts', 'cts',
  'css', 'scss', 'sass', 'less', 'html', 'htm', 'xml', 'svg', 'yml', 'yaml', 'toml', 'ini', 'env',
  'sql', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'php', 'cs', 'c', 'h', 'cpp', 'hpp', 'sh', 'ps1',
  'bat', 'cmd', 'gitignore', 'editorconfig', 'prisma', 'graphql', 'vue', 'svelte', 'astro', 'lock',
])

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif'])

const MAX_FILE_BYTES = 1024 * 1024
const MAX_TREE_NODES = 4000

const extOf = (name: string) => extname(name).replace('.', '').toLowerCase()

const safeName = (name: string) => name.replace(/^\uFEFF/, '').trim()

export async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await fs.stat(target)).isDirectory()
  } catch {
    return false
  }
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T
  } catch {
    return null
  }
}

type RawPkg = {
  name?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function scriptKind(name: string): ScriptEntry['kind'] {
  if (/^(dev|serve|start:dev|develop)$/i.test(name)) return 'dev'
  if (/^(build|compile)$/i.test(name)) return 'build'
  if (/^start$/i.test(name)) return 'start'
  if (/test/i.test(name)) return 'test'
  return 'other'
}

async function detectPackageManager(dir: string): Promise<PackageManager> {
  const checks: Array<[string, PackageManager]> = [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lockb', 'bun'],
    ['bun.lock', 'bun'],
    ['package-lock.json', 'npm'],
  ]
  for (const [file, manager] of checks) {
    try {
      await fs.access(join(dir, file))
      return manager
    } catch {
      /* thử file tiếp theo */
    }
  }
  return 'none'
}

function detectFramework(pkg: RawPkg | null, isFlutter = false): string {
  if (isFlutter) return 'Flutter'
  if (!pkg) return 'Thư mục tĩnh'
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
  const has = (name: string) => Object.prototype.hasOwnProperty.call(deps, name)
  if (has('next')) return 'Next.js'
  if (has('nuxt')) return 'Nuxt'
  if (has('@angular/core')) return 'Angular'
  if (has('svelte')) return 'Svelte'
  if (has('vue')) return 'Vue'
  if (has('astro')) return 'Astro'
  if (has('solid-js')) return 'Solid'
  if (has('electron')) return 'Electron'
  if (has('react-native')) return 'React Native'
  if (has('react')) return has('vite') ? 'React + Vite' : 'React'
  if (has('vite')) return 'Vite'
  return 'Node.js'
}

function hasScript(pkg: RawPkg | null, name: string): boolean {
  return Boolean(pkg?.scripts && typeof pkg.scripts[name] === 'string')
}

/* ── Dò các trang thực tế trong dự án ─────────────────────── */

const titleFromName = (name: string): string => {
  const clean = name.replace(/\.(tsx|jsx|ts|js|vue|svelte|astro|html)$/i, '')
  const spaced = clean.replace(/[-_]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const routeFromName = (name: string): string => {
  const clean = name.replace(/\.(tsx|jsx|ts|js|vue|svelte|astro|html)$/i, '')
  if (/^index$/i.test(clean)) return '/'
  return `/${clean.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`
}

async function listFiles(dir: string, exts: string[], depth = 2, prefix = ''): Promise<string[]> {
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const out: string[] = []
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      if (depth > 0) out.push(...(await listFiles(join(dir, entry.name), exts, depth - 1, rel)))
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      out.push(rel)
    }
  }
  return out
}

export async function detectPages(dir: string): Promise<ProjectPage[]> {
  const pages: ProjectPage[] = []
  const push = (route: string, title: string) => {
    if (pages.some((page) => page.route === route)) return
    pages.push({
      id: randomUUID(),
      route,
      title,
      mockup: false,
      software: '—',
      frame: '—',
    })
  }

  /* Next.js App Router: tệp page.tsx trong thư mục app */
  const appFiles = [
    ...(await listFiles(join(dir, 'app'), ['.tsx', '.jsx'], 4)),
    ...(await listFiles(join(dir, 'src', 'app'), ['.tsx', '.jsx'], 4)),
  ].filter((file) => /(^|\/)page\.(tsx|jsx)$/.test(file))

  for (const file of appFiles) {
    const folder = file.replace(/\/?page\.(tsx|jsx)$/, '').replace(/^app\/?/, '')
    const route = folder ? `/${folder.replace(/\/\([^)]*\)/g, '')}` : '/'
    push(route.replace(/\/+/g, '/'), titleFromName(folder.split('/').pop() || 'Trang chủ'))
  }

  /* Next.js Pages Router hoặc cấu trúc src/pages quen thuộc */
  const pageFiles = [
    ...(await listFiles(join(dir, 'pages'), ['.tsx', '.jsx'], 3)),
    ...(await listFiles(join(dir, 'src', 'pages'), ['.tsx', '.jsx'], 3)),
  ].filter((file) => !/(^|\/)_/.test(file))

  for (const file of pageFiles) {
    const name = file.split('/').pop() ?? file
    const folder = file.replace(/\/?[^/]+$/, '')
    const route =
      folder === '' || folder === 'src/pages' || folder === 'pages'
        ? routeFromName(name)
        : `/${folder.replace(/^(src\/)?pages\/?/, '')}/${routeFromName(name).replace(/^\//, '')}`
    push(route.replace(/\/+/g, '/'), titleFromName(name))
  }

  if (!pages.length) {
    const hasIndex = await fs
      .access(join(dir, 'index.html'))
      .then(() => true)
      .catch(() => false)
    if (hasIndex) push('/', 'Trang chủ')
  }

  return pages.slice(0, 24)
}

/* ── Lịch sử git để hiển thị danh sách phiên bản ──────────── */

export async function readVersions(root: string): Promise<ProjectVersion[]> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', root, 'log', '-8', '--date=short', '--pretty=format:%h%x1f%s%x1f%ad%x1f%D'],
      { windowsHide: true, timeout: 4000 },
    )
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const [hash, subject, date, refs] = line.split('\u001f')
        const tag = refs?.match(/tag:\s*([^,]+)/)?.[1]
        const isHead = refs?.includes('HEAD')
        return {
          id: `${hash}-${index}`,
          name: tag ?? (isHead ? 'HEAD' : `v${index + 1}`),
          status: isHead ? 'review' : 'ok',
          hash: hash ?? '',
          date: date ?? '',
          note: subject ?? '',
        } satisfies ProjectVersion
      })
  } catch {
    return []
  }
}

async function readRepo(root: string): Promise<string> {
  try {
    const config = await fs.readFile(join(root, '.git', 'config'), 'utf8')
    const match = config.match(/url\s*=\s*(.+)/)
    if (!match) return ''
    return match[1]
      .trim()
      .replace(/^git@github\.com:/, '')
      .replace(/^https?:\/\/github\.com\//, '')
      .replace(/\.git$/, '')
  } catch {
    return ''
  }
}

const projectCode = (name: string): string => {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 1000
  return `DA-${String(hash).padStart(3, '0')}`
}

async function buildMeta(dir: string, name: string): Promise<ProjectMeta> {
  let owner = 'Người dùng Windows'
  try {
    owner = userInfo().username
  } catch {
    /* giữ mặc định */
  }
  const [pages, versions, repo] = await Promise.all([
    detectPages(dir),
    readVersions(dir),
    readRepo(dir),
  ])
  return {
    owner,
    code: projectCode(basename(dir) || name),
    repo,
    createdAt: Date.now(),
    pages,
    versions,
    activity: [],
    customCommand: '',
  }
}

async function fileExists(file: string): Promise<boolean> {
  return fs
    .access(file)
    .then(() => true)
    .catch(() => false)
}

async function detectFlutter(dir: string): Promise<boolean> {
  try {
    const pubspec = await fs.readFile(join(dir, 'pubspec.yaml'), 'utf8')
    return /sdk:\s*flutter|^\s*flutter:/m.test(pubspec)
  } catch {
    return false
  }
}

/* Tìm thư mục có index.html để dựng máy chủ tĩnh.
   Với Flutter chỉ dùng bản đã build (build/web), không dùng web/index.html
   vì tệp đó cần Flutter biên dịch main.dart thành JS trước. */
async function detectPreviewDir(dir: string, isFlutter: boolean): Promise<string> {
  const candidates = isFlutter
    ? ['build/web', 'build']
    : ['', 'public', 'dist', 'build/web', 'build', 'out', 'web']
  for (const rel of candidates) {
    const target = rel ? join(dir, rel, 'index.html') : join(dir, 'index.html')
    if (await fileExists(target)) return rel
  }
  return ''
}

export async function initGit(folder: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['-C', folder, 'init'], { windowsHide: true })
    return true
  } catch {
    return false
  }
}

/** Kiểm tra nhanh thư mục dự án và đề xuất cách khắc phục.
 *  customCommand khác rỗng nghĩa là người dùng đã có lệnh chạy tay. */
export async function diagnoseProject(folder: string, customCommand = ''): Promise<ProjectDiagnosis> {
  const dir = resolve(folder)
  const issues: ProjectIssue[] = []

  if (!(await isDirectory(dir))) {
    return {
      healthy: false,
      hasIssues: true,
      checkedAt: Date.now(),
      issues: [
        {
          id: 'invalid_dir',
          type: 'other',
          level: 'error',
          title: 'Thư mục không tồn tại hoặc không thể truy cập',
          message: `Không thể đọc đường dẫn thư mục: ${dir}`,
          recommendation: 'Kiểm tra lại đường dẫn hoặc chọn thư mục hợp lệ khác.',
        },
      ],
    }
  }

  try {
    const entries = await fs.readdir(dir)
    const validEntries = entries.filter((e) => e !== '.git' && e !== '.DS_Store' && e !== '.vs' && e !== '.vscode')
    if (validEntries.length === 0) {
      issues.push({
        id: 'empty_folder',
        type: 'empty_folder',
        level: 'warning',
        title: 'Thư mục trống',
        message: 'Thư mục này hiện chưa có tệp hoặc mã nguồn nào.',
        recommendation: 'Thêm mã nguồn vào thư mục hoặc khởi tạo dự án mới để bắt đầu.',
      })
      return { healthy: false, hasIssues: true, checkedAt: Date.now(), issues }
    }
  } catch {
    /* bỏ qua */
  }

  const pkg = await readJson<RawPkg>(join(dir, 'package.json'))
  const manager = await detectPackageManager(dir)
  const actualManager = manager === 'none' ? 'npm' : manager
  const isFlutter = await detectFlutter(dir)
  const hasIndexHtml = Boolean(await detectPreviewDir(dir, isFlutter))
  const hasCustomCommand = customCommand.trim().length > 0

  if (pkg) {
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
    const depCount = Object.keys(deps).length

    if (depCount > 0) {
      const nodeModulesPath = join(dir, 'node_modules')
      let hasNodeModules = false
      try {
        const stat = await fs.stat(nodeModulesPath)
        if (stat.isDirectory()) {
          const files = await fs.readdir(nodeModulesPath)
          hasNodeModules = files.some((f) => !f.startsWith('.') && f !== '.package-lock.json')
        }
      } catch {
        hasNodeModules = false
      }

      if (!hasNodeModules) {
        issues.push({
          id: 'missing_deps',
          type: 'missing_deps',
          level: 'error',
          title: 'Chưa cài đặt thư viện (thiếu node_modules)',
          message: `Dự án có khai báo ${depCount} gói phụ thuộc trong package.json nhưng chưa có thư mục node_modules. Khi chạy sẽ gặp lỗi thiếu module (Module not found).`,
          recommendation: `Cần chạy lệnh "${actualManager} install" để tải các gói phụ thuộc về máy.`,
          actionLabel: `Cài đặt thư viện (${actualManager} install)`,
          actionKind: 'install',
        })
      }
    }

    const scriptKeys = Object.keys(pkg.scripts ?? {})
    const hasDevOrStart = scriptKeys.some((s) => /^(dev|start|serve|preview)$/i.test(s))
    if (!hasDevOrStart && !hasIndexHtml && !hasCustomCommand) {
      issues.push({
        id: 'missing_script',
        type: 'missing_script',
        level: 'warning',
        title: 'Thiếu script dev server và index.html',
        message: 'Dự án không có script dev/start trong package.json và không có tệp index.html tĩnh.',
        recommendation:
          'Thêm script "dev": "..." vào package.json, tạo file index.html, hoặc dùng ô “Lệnh tự nhập” để chạy dự án.',
      })
    }

    const hasElectron = Boolean(
      (pkg.dependencies && 'electron' in pkg.dependencies) ||
        (pkg.devDependencies && 'electron' in pkg.devDependencies) ||
        (pkg.devDependencies && 'electron-vite' in pkg.devDependencies),
    )
    if (hasElectron) {
      issues.push({
        id: 'electron_app',
        type: 'electron_app',
        level: 'warning',
        title: 'Dự án là ứng dụng Desktop (Electron)',
        message:
          'Dự án này là phần mềm Desktop xây dựng trên Electron. Lệnh dev sẽ mở một cửa sổ desktop độc lập thay vì hiển thị trực tiếp trong khung xem trước Web.',
        recommendation:
          'Để xem trước giao diện trên Web, hãy dùng script web preview nếu có hoặc mở dự án web thuần.',
      })
    }
  } else if (!hasIndexHtml && !hasCustomCommand && !isFlutter) {
    issues.push({
      id: 'no_package_json',
      type: 'no_package_json',
      level: 'warning',
      title: 'Không tìm thấy package.json hoặc index.html',
      message: 'Thư mục không có package.json để chạy script và cũng không có index.html tĩnh.',
      recommendation:
        'Chạy "npm init -y", tạo tệp index.html, hoặc dùng ô “Lệnh tự nhập” để chạy dự án hiện có.',
    })
  }

  const hasGit = await fs
    .access(join(dir, '.git'))
    .then(() => true)
    .catch(() => false)

  if (!hasGit) {
    issues.push({
      id: 'no_git',
      type: 'no_git',
      level: 'info',
      title: 'Chưa khởi tạo Git (.git)',
      message: 'Thư mục chưa có kho lưu trữ Git để theo dõi các phiên bản và lịch sử thay đổi.',
      recommendation: 'Khởi tạo Git giúp PixelMind tự động ghi nhận các phiên bản trên thanh timeline.',
      actionLabel: 'Khởi tạo Git (git init)',
      actionKind: 'git_init',
    })
  }

  return {
    healthy: !issues.some((i) => i.level === 'error'),
    hasIssues: issues.length > 0,
    checkedAt: Date.now(),
    issues,
  }
}

export async function detectProject(folder: string): Promise<ProjectRecord> {
  const dir = resolve(folder)
  const pkg = await readJson<RawPkg>(join(dir, 'package.json'))
  const isFlutter = await detectFlutter(dir)
  const scripts: ScriptEntry[] = Object.entries(pkg?.scripts ?? {})
    .filter(([, command]) => typeof command === 'string')
    .map(([name, command]) => ({ name, command, kind: scriptKind(name) }))

  /* Flutter không có package.json nhưng vẫn chạy được bằng web-server device. */
  if (isFlutter && !scripts.some((item) => item.name === 'run')) {
    scripts.unshift({
      name: 'run',
      command: 'flutter run -d web-server --web-hostname 127.0.0.1',
      kind: 'dev',
      direct: true,
    })
  }

  const order: Record<ScriptEntry['kind'], number> = { dev: 0, start: 1, build: 2, test: 3, other: 4 }
  scripts.sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name))

  const manager = await detectPackageManager(dir)
  const previewDir = await detectPreviewDir(dir, isFlutter)
  const hasIndexHtml = Boolean(previewDir) || (await fileExists(join(dir, 'index.html')))

  const existing = await readJson<{ name?: string }>(join(dir, 'package.json'))
  const projectName = safeName(existing?.name || basename(dir)) || basename(dir)

  return {
    id: randomUUID(),
    name: projectName,
    path: dir,
    framework: detectFramework(pkg, isFlutter),
    packageManager: manager === 'none' && hasScript(pkg, 'dev') ? 'npm' : manager,
    scripts,
    hasIndexHtml,
    previewDir,
    addedAt: Date.now(),
    lastOpenedAt: null,
    favorite: false,
    diagnosis: await diagnoseProject(dir),
    meta: await buildMeta(dir, projectName),
  }
}

export async function readTree(
  root: string,
  options: { depth?: number; showHidden?: boolean } = {},
): Promise<FileNode[]> {
  const maxDepth = options.depth ?? 8
  const showHidden = options.showHidden ?? false
  let budget = MAX_TREE_NODES

  const walk = async (dir: string, depth: number): Promise<FileNode[]> => {
    if (depth > maxDepth || budget <= 0) return []
    let entries: import('node:fs').Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return []
    }
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
      return a.name.localeCompare(b.name, 'vi')
    })

    const nodes: FileNode[] = []
    for (const entry of entries) {
      if (budget <= 0) break
      const name = entry.name
      if (!showHidden && name.startsWith('.')) continue
      if (entry.isDirectory() && IGNORED_DIRS.has(name)) continue
      budget -= 1

      const full = join(dir, name)
      if (entry.isDirectory()) {
        const children = await walk(full, depth + 1)
        nodes.push({ name, path: full, type: 'dir', ext: '', size: 0, children })
      } else if (entry.isFile()) {
        let size = 0
        try {
          size = (await fs.stat(full)).size
        } catch {
          size = 0
        }
        nodes.push({ name, path: full, type: 'file', ext: extOf(name), size })
      }
    }
    return nodes
  }

  return walk(resolve(root), 0)
}

export async function readFileContent(target: string): Promise<FileContent> {
  const file = resolve(target)
  const stat = await fs.stat(file)
  const name = basename(file)
  const ext = extOf(name)

  if (IMAGE_EXT.has(ext) && stat.size <= 8 * 1024 * 1024) {
    const buf = await fs.readFile(file)
    const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`
    return {
      path: file,
      name,
      ext,
      size: stat.size,
      text: '',
      truncated: false,
      binary: true,
      dataUrl: `data:${mime};base64,${buf.toString('base64')}`,
    }
  }

  const known = TEXT_EXT.has(ext) || ext === '' || !ext
  const buf = await fs.readFile(file)
  const isBinary = !known || buf.subarray(0, 4096).includes(0)
  if (isBinary) {
    return {
      path: file,
      name,
      ext,
      size: stat.size,
      text: '',
      truncated: false,
      binary: true,
    }
  }

  const truncated = buf.byteLength > MAX_FILE_BYTES
  const slice = truncated ? buf.subarray(0, MAX_FILE_BYTES) : buf
  return {
    path: file,
    name,
    ext,
    size: stat.size,
    text: slice.toString('utf8'),
    truncated,
    binary: false,
  }
}

export async function writeFileContent(target: string, text: string): Promise<void> {
  await fs.writeFile(resolve(target), text, 'utf8')
}

export async function statProject(root: string): Promise<ProjectStat> {
  const stat: ProjectStat = { files: 0, folders: 0, totalSize: 0 }
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > 10) return
    let entries: import('node:fs').Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || IGNORED_DIRS.has(entry.name)) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        stat.folders += 1
        await walk(full, depth + 1)
      } else if (entry.isFile()) {
        stat.files += 1
        try {
          stat.totalSize += (await fs.stat(full)).size
        } catch {
          /* bỏ qua file không đọc được */
        }
      }
    }
  }
  await walk(resolve(root), 0)
  return stat
}

export async function gitBranch(root: string): Promise<string | null> {
  try {
    const head = await fs.readFile(join(root, '.git', 'HEAD'), 'utf8')
    const match = head.match(/ref:\s*refs\/heads\/(.+)/)
    return match ? match[1].trim() : head.trim().slice(0, 8)
  } catch {
    return null
  }
}
