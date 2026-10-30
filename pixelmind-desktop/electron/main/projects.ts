import { promises as fs } from 'node:fs'
import { exec, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
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
const execAsync = promisify(exec)

/* Đọc / dò cấu trúc dự án trên đĩa. Chỉ dùng fs của Node, không phụ thuộc thư viện. */

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '.vs',
  '.vscode',
  '.idea',
  '.dart_tool',
  'bin',
  'obj',
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
  'cshtml', 'razor', 'sln', 'csproj', 'fsproj', 'vbproj', 'props', 'targets', 'config', 'dart',
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

function detectFramework(pkg: RawPkg | null): string {
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

/* ── Nhận diện dự án .NET / Visual Studio (sln, csproj) ───── */

export interface DotnetProjectInfo {
  solutionName?: string
  solutionFile?: string
  vsVersion: string
  projectName: string
  projectDir: string
  projectFile: string
  targetFramework: string
  frameworkFormatted: string
  isWeb: boolean
  isBlazor: boolean
  framework: string
  scripts: ScriptEntry[]
  hasIndexHtml: boolean
}

function formatTargetFramework(tf: string): string {
  const clean = tf.trim().toLowerCase()
  const netMatch = clean.match(/^net(\d+)\.(\d+)$/)
  if (netMatch) return `.NET ${netMatch[1]}.${netMatch[2]}`
  if (/^net(\d+)$/.test(clean)) return `.NET ${clean.replace('net', '')}.0`
  if (clean === 'netcoreapp3.1') return '.NET Core 3.1'
  if (clean === 'netcoreapp3.0') return '.NET Core 3.0'
  if (clean === 'netcoreapp2.1') return '.NET Core 2.1'
  if (clean === 'net48' || clean === 'net481') return '.NET Framework 4.8'
  if (clean === 'net472') return '.NET Framework 4.7.2'
  return tf.toUpperCase()
}

export async function detectDotnetProject(dir: string): Promise<DotnetProjectInfo | null> {
  let entries: import('node:fs').Dirent[] = []
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return null
  }

  // 1. Tìm tệp .sln hoặc .csproj ở thư mục gốc
  let slnFile = entries.find((e) => e.isFile() && e.name.toLowerCase().endsWith('.sln'))?.name
  const csprojFiles = entries
    .filter((e) => e.isFile() && (e.name.toLowerCase().endsWith('.csproj') || e.name.toLowerCase().endsWith('.fsproj')))
    .map((e) => e.name)

  // 2. Nếu không có ở gốc, quét tìm trong các thư mục con cấp 1 (trừ IGNORED_DIRS)
  if (!slnFile && csprojFiles.length === 0) {
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && !IGNORED_DIRS.has(entry.name)) {
        try {
          const subEntries = await fs.readdir(join(dir, entry.name), { withFileTypes: true })
          const subSln = subEntries.find((e) => e.isFile() && e.name.toLowerCase().endsWith('.sln'))?.name
          if (subSln) {
            slnFile = `${entry.name}/${subSln}`
            break
          }
          const subCsproj = subEntries
            .filter((e) => e.isFile() && (e.name.toLowerCase().endsWith('.csproj') || e.name.toLowerCase().endsWith('.fsproj')))
            .map((e) => `${entry.name}/${e.name}`)
          if (subCsproj.length) {
            csprojFiles.push(...subCsproj)
          }
        } catch {
          /* bỏ qua thư mục không truy cập được */
        }
      }
    }
  }

  if (!slnFile && csprojFiles.length === 0) {
    return null
  }

  let vsVersion = 'VS 2022'
  let solutionName: string | undefined
  const projectsFound: Array<{ name: string; file: string; dir: string }> = []

  if (slnFile) {
    const slnFullName = basename(slnFile)
    solutionName = slnFullName.replace(/\.sln$/i, '')
    try {
      const slnContent = await fs.readFile(join(dir, slnFile), 'utf8')
      const vsMatch =
        slnContent.match(/# Visual Studio Version (\d+)/i) ||
        slnContent.match(/VisualStudioVersion\s*=\s*(\d+)/i)
      if (vsMatch) {
        const verNum = parseInt(vsMatch[1], 10)
        if (verNum >= 17) vsVersion = 'VS 2022'
        else if (verNum === 16) vsVersion = 'VS 2019'
        else if (verNum === 15) vsVersion = 'VS 2017'
        else vsVersion = `VS ${verNum}`
      }

      // Trích xuất các project trong .sln: Project("{...}") = "Name", "RelPath\Proj.csproj", "{...}"
      const slnDir = resolve(dir, dirname(slnFile))
      const projRe = /Project\("[^"]+"\)\s*=\s*"([^"]+)",\s*"([^"]+\.(?:csproj|fsproj|vbproj))"/g
      let match: RegExpExecArray | null
      while ((match = projRe.exec(slnContent)) !== null) {
        const projName = match[1]
        const rawProjRel = match[2].replace(/\\/g, '/')
        const projFullPath = resolve(slnDir, rawProjRel)
        const relToRoot = relative(dir, projFullPath).replace(/\\/g, '/')
        const relDir = dirname(relToRoot).replace(/\\/g, '/')
        projectsFound.push({
          name: projName,
          file: relToRoot,
          dir: relDir === '.' ? '' : relDir,
        })
      }
    } catch {
      /* bỏ qua */
    }
  }

  // Nếu không có project nào trích từ sln, dùng danh sách csprojFiles
  if (projectsFound.length === 0) {
    for (const file of csprojFiles) {
      const cleanFile = file.replace(/\\/g, '/')
      const projName = basename(cleanFile).replace(/\.(csproj|fsproj)$/i, '')
      const relDir = dirname(cleanFile).replace(/\\/g, '/')
      projectsFound.push({
        name: projName,
        file: cleanFile,
        dir: relDir === '.' ? '' : relDir,
      })
    }
  }

  if (projectsFound.length === 0) {
    return null
  }

  // Phân tích từng project để xác định loại dự án và startup project
  interface ParsedCsproj {
    name: string
    file: string
    dir: string
    targetFramework: string
    isWeb: boolean
    isBlazor: boolean
  }

  const parsedList: ParsedCsproj[] = []
  for (const p of projectsFound) {
    let content = ''
    try {
      content = await fs.readFile(join(dir, p.file), 'utf8')
    } catch {
      continue
    }

    const isWeb =
      /Sdk=["']Microsoft\.NET\.Sdk\.Web["']/i.test(content) ||
      /Sdk=["']Microsoft\.NET\.Sdk\.BlazorWebAssembly["']/i.test(content) ||
      /Microsoft\.AspNetCore/i.test(content)

    const isBlazor =
      /Microsoft\.NET\.Sdk\.BlazorWebAssembly/i.test(content) ||
      /Microsoft\.AspNetCore\.Components/i.test(content)

    const tfMatch =
      content.match(/<TargetFramework>(.+?)<\/TargetFramework>/i) ||
      content.match(/<TargetFrameworks>(.+?)<\/TargetFrameworks>/i)
    const rawTf = tfMatch ? tfMatch[1].split(';')[0].trim() : 'net8.0'

    parsedList.push({
      name: p.name,
      file: p.file,
      dir: p.dir,
      targetFramework: rawTf,
      isWeb,
      isBlazor,
    })
  }

  const primary =
    parsedList.find((p) => p.isWeb) ||
    parsedList.find((p) => p.isBlazor) ||
    parsedList[0] || {
      name: solutionName || basename(dir),
      file: '',
      dir: '',
      targetFramework: 'net8.0',
      isWeb: true,
      isBlazor: false,
    }

  const tfFormatted = formatTargetFramework(primary.targetFramework)
  let framework = ''
  if (primary.isBlazor) {
    framework = `Blazor (${tfFormatted}) • ${vsVersion}`
  } else if (primary.isWeb) {
    framework = `ASP.NET Core (${tfFormatted}) • ${vsVersion}`
  } else {
    framework = `.NET App (${tfFormatted}) • ${vsVersion}`
  }

  const projArg = primary.dir ? ` --project ${primary.dir}` : ''
  const scripts: ScriptEntry[] = [
    {
      name: 'watch',
      command: `dotnet watch --non-interactive run${projArg}`,
      kind: 'dev',
    },
    {
      name: 'run',
      command: `dotnet run${projArg}`,
      kind: 'start',
    },
    {
      name: 'build',
      command: 'dotnet build',
      kind: 'build',
    },
    {
      name: 'test',
      command: 'dotnet test',
      kind: 'test',
    },
  ]

  let hasWwwrootIndex = false
  try {
    const checkPaths = [
      join(dir, primary.dir, 'wwwroot', 'index.html'),
      join(dir, 'wwwroot', 'index.html'),
    ]
    for (const p of checkPaths) {
      if (await fs.access(p).then(() => true).catch(() => false)) {
        hasWwwrootIndex = true
        break
      }
    }
  } catch {
    hasWwwrootIndex = false
  }

  return {
    solutionName,
    solutionFile: slnFile,
    vsVersion,
    projectName: primary.name,
    projectDir: primary.dir,
    projectFile: primary.file,
    targetFramework: primary.targetFramework,
    frameworkFormatted: tfFormatted,
    isWeb: primary.isWeb,
    isBlazor: primary.isBlazor,
    framework,
    scripts,
    hasIndexHtml: hasWwwrootIndex,
  }
}

/* ── Nhận diện dự án Flutter / Dart (pubspec.yaml) ────────── */

export interface FlutterProjectInfo {
  name: string
  framework: string
  isFlutterWeb: boolean
  scripts: ScriptEntry[]
  hasIndexHtml: boolean
}

export async function detectFlutterProject(dir: string): Promise<FlutterProjectInfo | null> {
  const pubspecPath = join(dir, 'pubspec.yaml')
  let content = ''
  try {
    content = await fs.readFile(pubspecPath, 'utf8')
  } catch {
    return null
  }

  const nameMatch = content.match(/^name:\s*([a-zA-Z0-9_-]+)/m)
  const name = nameMatch ? nameMatch[1].trim() : basename(dir)

  const isFlutter = content.includes('flutter:') || content.includes('sdk: flutter')
  const hasWebIndex = await fs
    .access(join(dir, 'web', 'index.html'))
    .then(() => true)
    .catch(() => false)

  const framework = isFlutter
    ? hasWebIndex
      ? 'Flutter (Web)'
      : 'Flutter App'
    : 'Dart'

  const scripts: ScriptEntry[] = [
    {
      name: 'dev',
      command: hasWebIndex ? 'flutter run -d chrome' : 'flutter run',
      kind: 'dev',
    },
    {
      name: 'run',
      command: 'flutter run',
      kind: 'start',
    },
    {
      name: 'build',
      command: hasWebIndex ? 'flutter build web' : 'flutter build',
      kind: 'build',
    },
    {
      name: 'test',
      command: 'flutter test',
      kind: 'test',
    },
    {
      name: 'pub-get',
      command: 'flutter pub get',
      kind: 'other',
    },
  ]

  return {
    name,
    framework,
    isFlutterWeb: hasWebIndex,
    scripts,
    hasIndexHtml: hasWebIndex,
  }
}

/* ── Tự động tạo tệp index.html và script dev theo yêu cầu ─── */

export async function createIndexHtmlFile(folder: string, projectName: string): Promise<boolean> {
  const dir = resolve(folder)
  const target = join(dir, 'index.html')
  try {
    const title = safeName(projectName) || basename(dir)
    const content = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Xem trước</title>
  <style>
    :root {
      --bg: #0b0c0f;
      --card: #15171e;
      --text: #f0f2f5;
      --text-muted: #8b949e;
      --accent: #6366f1;
      --accent-hover: #4f46e5;
      --border: rgba(255, 255, 255, 0.08);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 2.5rem;
      max-width: 540px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      background: rgba(99, 102, 241, 0.15);
      color: var(--accent);
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 1.25rem;
    }
    h1 {
      font-size: 1.85rem;
      margin-bottom: 0.75rem;
      letter-spacing: -0.5px;
    }
    p {
      color: var(--text-muted);
      font-size: 0.95rem;
      line-height: 1.6;
      margin-bottom: 1.75rem;
    }
    .btn {
      display: inline-block;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      background: var(--accent);
      color: #fff;
      font-weight: 500;
      text-decoration: none;
      transition: background 0.2s;
    }
    .btn:hover { background: var(--accent-hover); }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">PixelMind Preview</span>
    <h1>${title}</h1>
    <p>Trang web mẫu được khởi tạo tự động bởi PixelMind. Bạn có thể chỉnh sửa tệp <code>index.html</code> này hoặc thêm mã nguồn HTML/CSS/JS để thiết kế giao diện.</p>
    <a href="#" class="btn" onclick="alert('Trang xem trước PixelMind đã sẵn sàng!')">Bắt đầu thiết kế</a>
  </div>
</body>
</html>
`
    await fs.writeFile(target, content, 'utf8')
    return true
  } catch {
    return false
  }
}

export async function addDevScriptToPkg(folder: string): Promise<boolean> {
  const dir = resolve(folder)
  const pkgPath = join(dir, 'package.json')
  try {
    let pkg: RawPkg = {}
    try {
      pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8')) as RawPkg
    } catch {
      pkg = { name: basename(dir), scripts: {} }
    }
    if (!pkg.scripts) pkg.scripts = {}
    if (!pkg.scripts.dev) {
      pkg.scripts.dev = 'npx serve .'
    }
    await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2), 'utf8')
    return true
  } catch {
    return false
  }
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
    if (entry.name.startsWith('.') || IGNORED_DIRS.has(entry.name)) continue
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

  /* ASP.NET Core Views: Views/<Controller>/<Action>.cshtml */
  const cshtmlFiles = await listFiles(dir, ['.cshtml'], 5)
  for (const rel of cshtmlFiles) {
    const filename = rel.split('/').pop() ?? rel
    if (filename.startsWith('_')) continue

    // Khớp Views/<Controller>/<Action>.cshtml
    const viewsMatch = rel.match(/(?:^|\/)Views\/([^/]+)\/([^/]+)\.cshtml$/i)
    if (viewsMatch) {
      const [, controller, action] = viewsMatch
      let route = ''
      if (controller.toLowerCase() === 'home' && action.toLowerCase() === 'index') {
        route = '/'
      } else if (controller.toLowerCase() === 'home') {
        route = `/${action.toLowerCase()}`
      } else if (action.toLowerCase() === 'index') {
        route = `/${controller.toLowerCase()}`
      } else {
        route = `/${controller.toLowerCase()}/${action.toLowerCase()}`
      }

      let title = ''
      try {
        const content = await fs.readFile(join(dir, rel), 'utf8')
        const titleMatch =
          content.match(/ViewData\[["']Title["']\]\s*=\s*["']([^"']+)["']/i) ||
          content.match(/ViewBag\.Title\s*=\s*["']([^"']+)["']/i) ||
          content.match(/<title>([^<]+)<\/title>/i)
        if (titleMatch) title = titleMatch[1].trim()
      } catch {
        /* bỏ qua */
      }
      if (!title) {
        title = controller.toLowerCase() === 'home' ? titleFromName(action) : `${titleFromName(controller)} - ${titleFromName(action)}`
      }
      push(route, title)
      continue
    }

    // Khớp Pages/<Name>.cshtml (Razor Pages)
    const pagesMatch = rel.match(/(?:^|\/)Pages\/(.+)\.cshtml$/i)
    if (pagesMatch) {
      const rawRoute = pagesMatch[1]
      const clean = rawRoute.replace(/\/Index$/i, '') || '/'
      const route = clean.startsWith('/') ? clean : `/${clean}`
      let title = ''
      try {
        const content = await fs.readFile(join(dir, rel), 'utf8')
        const titleMatch =
          content.match(/ViewData\[["']Title["']\]\s*=\s*["']([^"']+)["']/i) ||
          content.match(/ViewBag\.Title\s*=\s*["']([^"']+)["']/i) ||
          content.match(/<title>([^<]+)<\/title>/i)
        if (titleMatch) title = titleMatch[1].trim()
      } catch {
        /* bỏ qua */
      }
      if (!title) title = titleFromName(filename)
      push(route.toLowerCase(), title)
    }
  }

  // Blazor Components: file .razor có chứa @page directive
  const razorFiles = await listFiles(dir, ['.razor'], 5)
  for (const rel of razorFiles) {
    const filename = rel.split('/').pop() ?? rel
    if (filename.startsWith('_')) continue
    try {
      const content = await fs.readFile(join(dir, rel), 'utf8')
      const pageMatch = content.match(/@page\s+["']([^"']+)["']/i)
      if (pageMatch) {
        const route = pageMatch[1]
        const titleMatch = content.match(/<PageTitle>([^<]+)<\/PageTitle>/i)
        const title = titleMatch ? titleMatch[1].trim() : titleFromName(filename)
        push(route, title)
      }
    } catch {
      /* bỏ qua */
    }
  }

  /* wwwroot/*.html */
  const wwwrootHtml = await listFiles(join(dir, 'wwwroot'), ['.html', '.htm'], 3)
  for (const rel of wwwrootHtml) {
    const name = rel.replace(/\.(html|htm)$/i, '')
    const route = name === 'index' ? '/' : `/${name}`
    push(route, titleFromName(name))
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
  }
}

export async function initGit(folder: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['-C', folder, 'init'], { windowsHide: true })
    return true
  } catch {
    return false
  }
}

export async function diagnoseProject(folder: string, dotnet?: DotnetProjectInfo | null): Promise<ProjectDiagnosis> {
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
      return {
        healthy: false,
        hasIssues: true,
        checkedAt: Date.now(),
        issues,
      }
    }
  } catch {
    /* bỏ qua */
  }

  const dotnetInfo = dotnet !== undefined ? dotnet : await detectDotnetProject(dir)
  if (dotnetInfo) {
    // 1. Kiểm tra dotnet CLI
    let hasDotnet = false
    try {
      await execFileAsync('dotnet', ['--version'], { windowsHide: true })
      hasDotnet = true
    } catch {
      hasDotnet = false
    }

    if (!hasDotnet) {
      issues.push({
        id: 'missing_dotnet_sdk',
        type: 'other',
        level: 'error',
        title: 'Chưa cài đặt .NET SDK',
        message:
          'Hệ thống không tìm thấy công cụ dòng lệnh "dotnet". Để biên dịch và chạy dự án C# / ASP.NET Core, máy tính cần cài đặt .NET SDK.',
        recommendation: 'Tải và cài đặt .NET SDK (khuyên dùng .NET 8.0) từ https://dotnet.microsoft.com/download.',
      })
    }

    // 2. Kiểm tra các gói NuGet đã được restore chưa
    const candidateAssets = [
      join(dir, dotnetInfo.projectDir, 'obj', 'project.assets.json'),
      join(dir, 'obj', 'project.assets.json'),
    ]
    let hasAssets = false
    for (const p of candidateAssets) {
      try {
        await fs.access(p)
        hasAssets = true
        break
      } catch {
        /* thử tiếp */
      }
    }

    if (!hasAssets) {
      issues.push({
        id: 'missing_deps',
        type: 'missing_deps',
        level: 'error',
        title: 'Chưa khôi phục thư viện NuGet (.NET)',
        message:
          'Dự án chưa được khôi phục các gói thư viện NuGet (thiếu obj/project.assets.json). Khi chạy có thể gặp lỗi biên dịch.',
        recommendation:
          'Bấm nút "Khôi phục NuGet" bên dưới hoặc chạy lệnh "dotnet restore" để tải các gói phụ thuộc về máy.',
        actionLabel: 'Khôi phục NuGet (dotnet restore)',
        actionKind: 'install',
      })
    }

    // 3. Kiểm tra git
    const hasGit = await fs.access(join(dir, '.git')).then(() => true).catch(() => false)
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

  const flutterInfo = await detectFlutterProject(dir)
  if (flutterInfo) {
    let hasFlutter = false
    try {
      await execAsync('flutter --version', { windowsHide: true })
      hasFlutter = true
    } catch {
      hasFlutter = false
    }

    if (!hasFlutter) {
      issues.push({
        id: 'missing_flutter_sdk',
        type: 'other',
        level: 'error',
        title: 'Chưa cài đặt Flutter SDK',
        message: 'Hệ thống không tìm thấy công cụ dòng lệnh "flutter". Dự án cần Flutter SDK để biên dịch và chạy.',
        recommendation: 'Tải và cài đặt Flutter SDK từ https://flutter.dev.',
      })
    }

    const hasConfig = await fs
      .access(join(dir, '.dart_tool', 'package_config.json'))
      .then(() => true)
      .catch(() => false)

    if (!hasConfig) {
      issues.push({
        id: 'missing_deps',
        type: 'missing_deps',
        level: 'error',
        title: 'Chưa tải thư viện Flutter (chưa pub get)',
        message:
          'Dự án có khai báo thư viện trong pubspec.yaml nhưng chưa được tải về máy (thiếu .dart_tool/package_config.json).',
        recommendation: 'Cần chạy lệnh "flutter pub get" để tải các gói phụ thuộc về máy.',
        actionLabel: 'Tải thư viện (flutter pub get)',
        actionKind: 'install',
      })
    }

    const hasGit = await fs.access(join(dir, '.git')).then(() => true).catch(() => false)
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

  const pkg = await readJson<RawPkg>(join(dir, 'package.json'))
  const manager = await detectPackageManager(dir)
  const actualManager = manager === 'none' ? 'npm' : manager

  const hasIndexHtml = await fs
    .access(join(dir, 'index.html'))
    .then(() => true)
    .catch(async () =>
      fs
        .access(join(dir, 'web', 'index.html'))
        .then(() => true)
        .catch(async () =>
          fs
            .access(join(dir, 'wwwroot', 'index.html'))
            .then(() => true)
            .catch(() => false),
        ),
    )

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
    if (!hasDevOrStart && !hasIndexHtml) {
      issues.push({
        id: 'missing_script',
        type: 'missing_script',
        level: 'warning',
        title: 'Thiếu script dev server và index.html',
        message: 'Dự án không có script dev/start trong package.json và không có tệp index.html tĩnh để hiển thị giao diện xem trước.',
        recommendation: 'Bấm nút "Tạo index.html mẫu" bên dưới để PixelMind tự động tạo trang xem trước ngay.',
        actionLabel: 'Tạo tệp index.html mẫu',
        actionKind: 'create_index_html',
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
  } else {
    if (!hasIndexHtml) {
      issues.push({
        id: 'no_package_json',
        type: 'no_package_json',
        level: 'warning',
        title: 'Không tìm thấy package.json hoặc index.html',
        message: 'Thư mục không có package.json để chạy script và cũng không có tệp index.html tĩnh để hiển thị.',
        recommendation: 'Bấm nút "Tạo index.html mẫu" bên dưới để PixelMind tự động tạo trang xem trước ngay lập tức.',
        actionLabel: 'Tạo tệp index.html mẫu',
        actionKind: 'create_index_html',
      })
    }
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
  const dotnetInfo = await detectDotnetProject(dir)
  const flutterInfo = await detectFlutterProject(dir)
  const pkg = await readJson<RawPkg>(join(dir, 'package.json'))

  if (dotnetInfo) {
    const scripts = [...dotnetInfo.scripts]
    if (pkg?.scripts) {
      for (const [name, command] of Object.entries(pkg.scripts)) {
        if (!scripts.some((s) => s.name === name) && typeof command === 'string') {
          scripts.push({ name, command, kind: scriptKind(name) })
        }
      }
    }
    const projectName = safeName(dotnetInfo.solutionName || dotnetInfo.projectName || basename(dir))
    const diagnosis = await diagnoseProject(dir, dotnetInfo)

    return {
      id: randomUUID(),
      name: projectName,
      path: dir,
      framework: dotnetInfo.framework,
      packageManager: 'dotnet',
      scripts,
      hasIndexHtml: dotnetInfo.hasIndexHtml,
      addedAt: Date.now(),
      lastOpenedAt: null,
      favorite: false,
      diagnosis,
      meta: await buildMeta(dir, projectName),
    }
  }

  if (flutterInfo) {
    const scripts = [...flutterInfo.scripts]
    if (pkg?.scripts) {
      for (const [name, command] of Object.entries(pkg.scripts)) {
        if (!scripts.some((s) => s.name === name) && typeof command === 'string') {
          scripts.push({ name, command, kind: scriptKind(name) })
        }
      }
    }
    const projectName = safeName(flutterInfo.name || basename(dir))
    const diagnosis = await diagnoseProject(dir)

    return {
      id: randomUUID(),
      name: projectName,
      path: dir,
      framework: flutterInfo.framework,
      packageManager: 'flutter',
      scripts,
      hasIndexHtml: flutterInfo.hasIndexHtml,
      addedAt: Date.now(),
      lastOpenedAt: null,
      favorite: false,
      diagnosis,
      meta: await buildMeta(dir, projectName),
    }
  }

  const scripts: ScriptEntry[] = Object.entries(pkg?.scripts ?? {})
    .filter(([, command]) => typeof command === 'string')
    .map(([name, command]) => ({ name, command, kind: scriptKind(name) }))

  const order: Record<ScriptEntry['kind'], number> = { dev: 0, start: 1, build: 2, test: 3, other: 4 }
  scripts.sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name))

  const manager = await detectPackageManager(dir)
  const hasIndexHtml = await fs
    .access(join(dir, 'index.html'))
    .then(() => true)
    .catch(async () =>
      fs
        .access(join(dir, 'web', 'index.html'))
        .then(() => true)
        .catch(async () =>
          fs
            .access(join(dir, 'wwwroot', 'index.html'))
            .then(() => true)
            .catch(() => false),
        ),
    )

  const existing = await readJson<{ name?: string }>(join(dir, 'package.json'))
  const projectName = safeName(existing?.name || basename(dir)) || basename(dir)
  const diagnosis = await diagnoseProject(dir)

  return {
    id: randomUUID(),
    name: projectName,
    path: dir,
    framework: detectFramework(pkg),
    packageManager: manager === 'none' && hasScript(pkg, 'dev') ? 'npm' : manager,
    scripts,
    hasIndexHtml,
    addedAt: Date.now(),
    lastOpenedAt: null,
    favorite: false,
    diagnosis,
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
