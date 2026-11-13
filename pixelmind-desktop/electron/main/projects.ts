import { promises as fs } from 'node:fs'
import type { Dirent } from 'node:fs'
import { exec, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { userInfo } from 'node:os'
import type { FileSearchMatch, FileSearchOptions } from '../../shared/api'
import {
  compileGlobList,
  compileSearchQuery,
  firstMatchInLine,
  globMayMatchUnder,
  matchesAnyGlob,
} from '../../shared/search'
import type {
  FileContent,
  FileNode,
  GitActionResult,
  GitBranchItem,
  GitCommit,
  GitCommitResult,
  GitFileChange,
  GitFileStatusCode,
  GitGraphData,
  GitGraphScope,
  GitRef,
  GitWorkingTreeStatus,
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
  if (has('@remix-run/react')) return 'Remix'
  if (has('@angular/core')) return 'Angular'
  if (has('@sveltejs/kit')) return 'SvelteKit'
  if (has('svelte')) return 'Svelte'
  if (has('vue')) return has('vite') ? 'Vue + Vite' : 'Vue'
  if (has('astro')) return 'Astro'
  if (has('solid-js')) return 'Solid'
  if (has('@builder.io/qwik')) return 'Qwik'
  if (has('electron')) return 'Electron'
  if (has('react-native')) return 'React Native'
  if (has('react')) return has('vite') ? 'React + Vite' : 'React'
  if (has('vite')) return 'Vite'
  if (has('@nestjs/core')) return 'NestJS'
  if (has('express')) return 'Express (Node.js)'
  if (has('fastify')) return 'Fastify'
  if (has('hono')) return 'Hono'
  if (has('gatsby')) return 'Gatsby'
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
  const push = (route: string, title: string, filePath?: string) => {
    const cleanRoute = route.replace(/\/+/g, '/')
    if (pages.some((page) => page.route === cleanRoute)) return
    pages.push({
      id: randomUUID(),
      route: cleanRoute,
      title,
      mockup: false,
      software: '—',
      frame: '—',
      filePath,
    })
  }
  const joinRel = (base: string, file: string) => (base ? `${base}/${file}` : file)

  /* Next.js App Router: tệp page.tsx trong thư mục app */
  for (const base of ['src/app', 'app']) {
    if (!(await isDirectory(join(dir, base)))) continue
    const appFiles = (
      await listFiles(join(dir, base), ['.tsx', '.jsx'], 4)
    ).filter((file) => /(^|\/)page\.(tsx|jsx)$/.test(file))

    for (const file of appFiles) {
      const folder = file.replace(/\/?page\.(tsx|jsx)$/, '').replace(/^app\/?/, '')
      const route = folder ? `/${folder.replace(/\/\([^)]*\)/g, '')}` : '/'
      push(route, titleFromName(folder.split('/').pop() || 'Trang chủ'), joinRel(base, file))
    }
  }

  /* Next.js Pages Router hoặc cấu trúc src/pages quen thuộc */
  for (const base of ['src/pages', 'pages']) {
    if (!(await isDirectory(join(dir, base)))) continue
    const pageFiles = (
      await listFiles(join(dir, base), ['.tsx', '.jsx'], 3)
    ).filter((file) => !/(^|\/)_/.test(file))

    for (const file of pageFiles) {
      const name = file.split('/').pop() ?? file
      const folder = file.replace(/\/?[^/]+$/, '')
      const route =
        folder === ''
          ? routeFromName(name)
          : `/${folder}/${routeFromName(name).replace(/^\//, '')}`
      push(route, titleFromName(name), joinRel(base, file))
    }
  }

  /* ASP.NET Core Views / Razor Pages:
     - Views/<Controller>/<Action>.cshtml
     - Areas/<Area>/Views/<Controller>/<Action>.cshtml
     - Areas/<Area>/Pages/<SubPath>.cshtml
     - Pages/<SubPath>.cshtml
  */
  const cshtmlFiles = await listFiles(dir, ['.cshtml'], 5)
  // Ưu tiên sắp xếp: các file Views MVC chính lên trước, các file trong Areas (như Identity) xếp sau
  cshtmlFiles.sort((a, b) => {
    const aIsArea = /(^|\/)Areas\//i.test(a)
    const bIsArea = /(^|\/)Areas\//i.test(b)
    if (aIsArea && !bIsArea) return 1
    if (!aIsArea && bIsArea) return -1
    return 0
  })

  for (const rel of cshtmlFiles) {
    const filename = rel.split('/').pop() ?? rel
    if (filename.startsWith('_')) continue

    let title = ''
    try {
      const c = await fs.readFile(join(dir, rel), 'utf8')
      const titleMatch =
        c.match(/ViewData\[["']Title["']\]\s*=\s*["']([^"']+)["']/i) ||
        c.match(/ViewBag\.Title\s*=\s*["']([^"']+)["']/i) ||
        c.match(/<title>([^<]+)<\/title>/i)
      if (titleMatch) title = titleMatch[1].trim()
    } catch {
      /* bỏ qua */
    }

    // 1. Khớp Areas/<Area>/Views/<Controller>/<Action>.cshtml
    const areaViewsMatch = rel.match(/(?:^|\/)Areas\/([^/]+)\/Views\/([^/]+)\/([^/]+)\.cshtml$/i)
    if (areaViewsMatch) {
      const [, area, controller, action] = areaViewsMatch
      const route = action.toLowerCase() === 'index' ? `/${area}/${controller}` : `/${area}/${controller}/${action}`
      if (!title) title = `${titleFromName(area)}: ${titleFromName(controller)} - ${titleFromName(action)}`
      push(route, title, rel)
      continue
    }

    // 2. Khớp Areas/<Area>/Pages/<SubPath>.cshtml (ví dụ Areas/Identity/Pages/Account/AccessDenied.cshtml)
    const areaPagesMatch = rel.match(/(?:^|\/)Areas\/([^/]+)\/Pages\/(.+)\.cshtml$/i)
    if (areaPagesMatch) {
      const [, area, rawPath] = areaPagesMatch
      const cleanPath = rawPath.replace(/\/Index$/i, '')
      const route = cleanPath ? `/${area}/${cleanPath}` : `/${area}`
      if (!title) title = titleFromName(filename.replace(/\.cshtml$/i, ''))
      push(route, title, rel)
      continue
    }

    // 3. Khớp Views/<Controller>/<Action>.cshtml (Views MVC chính)
    const viewsMatch = rel.match(/(?:^|\/)Views\/([^/]+)\/([^/]+)\.cshtml$/i)
    if (viewsMatch) {
      const [, controller, action] = viewsMatch
      let route = ''
      if (controller.toLowerCase() === 'shared') {
        if (action.toLowerCase() === 'error') {
          route = '/Home/Error'
        } else {
          continue
        }
      } else if (controller.toLowerCase() === 'home' && action.toLowerCase() === 'index') {
        route = '/'
      } else if (controller.toLowerCase() === 'home') {
        route = `/Home/${action}`
      } else if (action.toLowerCase() === 'index') {
        route = `/${controller}`
      } else {
        route = `/${controller}/${action}`
      }

      if (!title) {
        title = controller.toLowerCase() === 'home' ? titleFromName(action) : `${titleFromName(controller)} - ${titleFromName(action)}`
      }
      push(route, title, rel)
      continue
    }

    // 4. Khớp Pages/<Name>.cshtml (Razor Pages gốc)
    const pagesMatch = rel.match(/(?:^|\/)Pages\/(.+)\.cshtml$/i)
    if (pagesMatch) {
      const rawRoute = pagesMatch[1]
      const clean = rawRoute.replace(/\/Index$/i, '') || '/'
      const route = clean.startsWith('/') ? clean : `/${clean}`
      if (!title) title = titleFromName(filename.replace(/\.cshtml$/i, ''))
      push(route, title, rel)
      continue
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
        push(route, title, rel)
      }
    } catch {
      /* bỏ qua */
    }
  }

  // Vue / Nuxt pages (pages/**/*.vue, src/pages/**/*.vue)
  for (const base of ['pages', 'src/pages']) {
    if (!(await isDirectory(join(dir, base)))) continue
    const vueFiles = (
      await listFiles(join(dir, base), ['.vue'], 3)
    ).filter((f) => !/(^|\/)_/.test(f))
    for (const file of vueFiles) {
      const name = file.replace(/\.vue$/i, '')
      const clean = name.replace(/index$/i, '')
      const route = clean ? (clean.startsWith('/') ? clean : `/${clean}`) : '/'
      push(route, titleFromName(name.split('/').pop() || name), joinRel(base, file))
    }
  }

  // SvelteKit (+page.svelte)
  for (const base of ['src/routes', 'routes']) {
    if (!(await isDirectory(join(dir, base)))) continue
    const svelteFiles = (
      await listFiles(join(dir, base), ['.svelte'], 4)
    ).filter((f) => f.endsWith('+page.svelte'))
    for (const file of svelteFiles) {
      const folder = file.replace(/\/?\+page\.svelte$/, '')
      const route = folder ? (folder.startsWith('/') ? folder : `/${folder}`) : '/'
      push(route, titleFromName(folder.split('/').pop() || 'Trang chủ'), joinRel(base, file))
    }
  }

  // Astro (src/pages/**/*.astro, pages/**/*.astro)
  for (const base of ['src/pages', 'pages']) {
    if (!(await isDirectory(join(dir, base)))) continue
    const astroFiles = (
      await listFiles(join(dir, base), ['.astro'], 3)
    ).filter((f) => !/(^|\/)_/.test(f))
    for (const file of astroFiles) {
      const name = file.replace(/\.astro$/i, '')
      const clean = name.replace(/index$/i, '')
      const route = clean ? (clean.startsWith('/') ? clean : `/${clean}`) : '/'
      push(route, titleFromName(name.split('/').pop() || name), joinRel(base, file))
    }
  }

  // Laravel Blade (resources/views/**/*.blade.php)
  const bladeFiles = await listFiles(join(dir, 'resources', 'views'), ['.blade.php'], 4)
  for (const rel of bladeFiles) {
    const name = rel.replace(/\.blade\.php$/i, '')
    if (name.startsWith('_') || name.startsWith('layouts/') || name.startsWith('components/')) continue
    const route = name.toLowerCase() === 'welcome' || name.toLowerCase() === 'index' ? '/' : `/${name}`
    push(route, titleFromName(name.split('/').pop() || name), `resources/views/${rel}`)
  }

  // Django / Flask templates (templates/**/*.html)
  const templateFiles = await listFiles(join(dir, 'templates'), ['.html', '.htm'], 3)
  for (const rel of templateFiles) {
    const name = rel.replace(/\.(html|htm)$/i, '')
    if (name.startsWith('_') || name.startsWith('base')) continue
    const route = name.toLowerCase() === 'index' || name.toLowerCase() === 'home' ? '/' : `/${name}`
    push(route, titleFromName(name.split('/').pop() || name), `templates/${rel}`)
  }

  // Root & public static HTML files (*.html, *.htm)
  const staticGroups: Array<{ base: string; files: string[] }> = [
    { base: '', files: await listFiles(dir, ['.html', '.htm'], 0) },
    {
      base: '',
      files: (await listFiles(dir, ['.html', '.htm'], 1)).filter(
        (file) => /(^|\/)index\.(html|htm)$/i.test(file) && !/^(public|wwwroot)\//i.test(file),
      ),
    },
    { base: 'public', files: await listFiles(join(dir, 'public'), ['.html', '.htm'], 2) },
  ]
  for (const group of staticGroups) {
    for (const file of group.files) {
      const clean = file.replace(/\.(html|htm)$/i, '')
      const filename = clean.split('/').pop() ?? clean
      const dirPart = clean.split('/').slice(0, -1).join('/')
      const route =
        filename.toLowerCase() === 'index'
          ? dirPart
            ? `/${dirPart}`
            : '/'
          : `/${clean}`
      let title = ''
      try {
        const c = await fs.readFile(join(dir, group.base, file), 'utf8')
        const match = c.match(/<title>([^<]+)<\/title>/i)
        if (match) title = match[1].trim()
      } catch {
        /* bỏ qua */
      }
      push(route, title || titleFromName(filename), joinRel(group.base, file))
    }
  }

  /* wwwroot/*.html */
  const wwwrootHtml = await listFiles(join(dir, 'wwwroot'), ['.html', '.htm'], 3)
  for (const rel of wwwrootHtml) {
    const name = rel.replace(/\.(html|htm)$/i, '')
    const fileName = name.split('/').pop() ?? name
    const dirPart = name.split('/').slice(0, -1).join('/')
    const route =
      fileName.toLowerCase() === 'index'
        ? dirPart
          ? `/${dirPart}`
          : '/'
        : `/${name}`
    push(route, titleFromName(fileName), `wwwroot/${rel}`)
  }

  if (!pages.length) {
    const hasIndex = await fs
      .access(join(dir, 'index.html'))
      .then(() => true)
      .catch(() => false)
    if (hasIndex) push('/', 'Trang chủ', 'index.html')
  }

  return pages.slice(0, 60)
}

/* ── Lịch sử git để hiển thị danh sách phiên bản ──────────── */

const GIT_LOG_FIELD = '\u001f'
const GIT_LOG_RECORD = '\u001e'
const GIT_LOG_FORMAT = [
  '%H',
  '%h',
  '%P',
  '%an',
  '%ae',
  '%at',
  '%s',
  '%D',
  '%b',
].join(GIT_LOG_FIELD)

async function gitRemotes(root: string): Promise<Set<string>> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', root, 'remote'], {
      windowsHide: true,
      timeout: 4000,
    })
    return new Set(
      stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    )
  } catch {
    return new Set()
  }
}

async function gitHeadHash(root: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', root, 'rev-parse', 'HEAD'], {
      windowsHide: true,
      timeout: 4000,
    })
    return stdout.trim() || null
  } catch {
    return null
  }
}

function parseGitRefs(raw: string, currentBranch: string | null, remotes: Set<string>): GitRef[] {
  const refs: GitRef[] = []
  const seen = new Set<string>()
  const add = (ref: GitRef) => {
    const key = `${ref.type}:${ref.name}`
    if (seen.has(key)) return
    seen.add(key)
    refs.push(ref)
  }

  for (const rawToken of raw.split(',')) {
    let token = rawToken.trim()
    if (!token) continue

    if (token.startsWith('HEAD -> ')) {
      add({ name: 'HEAD', type: 'head' })
      token = token.slice('HEAD -> '.length).trim()
    } else if (token === 'HEAD') {
      add({ name: 'HEAD', type: 'head' })
      continue
    }

    if (token.startsWith('tag: ')) {
      add({ name: token.slice('tag: '.length).trim(), type: 'tag' })
      continue
    }

    // `origin/HEAD` chỉ là alias trỏ tới nhánh mặc định, không cần hiển thị thành badge riêng.
    if (token.endsWith('/HEAD')) continue

    const remoteName = token.split('/')[0]
    if (remotes.has(remoteName)) {
      add({ name: token, type: 'remote' })
    } else {
      add({ name: token, type: 'branch', current: token === currentBranch })
    }
  }

  return refs
}

export interface ReadGitGraphOptions {
  scope?: GitGraphScope
  limit?: number
}

/**
 * Đọc đồ thị commit thật từ `.git`.
 * `scope: 'all'` lấy mọi nhánh local + remote-tracking (sau khi `git fetch`).
 */
export async function readGitGraph(
  root: string,
  options: ReadGitGraphOptions = {},
): Promise<GitGraphData> {
  const scope = options.scope ?? 'all'
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 500)
  const [branch, remotes, headHash] = await Promise.all([
    gitBranch(root),
    gitRemotes(root),
    gitHeadHash(root),
  ])

  if (!headHash) {
    return { branch, hasRemote: remotes.size > 0, commits: [] }
  }

  try {
    const args = ['-C', root, 'log', '--topo-order', `--max-count=${limit}`]
    if (scope === 'all') args.push('--all')
    args.push(`--pretty=format:${GIT_LOG_FORMAT}${GIT_LOG_RECORD}`)

    const { stdout } = await execFileAsync('git', args, {
      windowsHide: true,
      timeout: 8000,
      maxBuffer: 8 * 1024 * 1024,
    })

    const commits: GitCommit[] = []
    for (const rawRecord of stdout.split(GIT_LOG_RECORD)) {
      const record = rawRecord.replace(/^\r?\n/, '')
      if (!record.trim()) continue
      const [hash, shortHash, parentsRaw, author, authorEmail, timestampRaw, subject, refsRaw, body] =
        record.split(GIT_LOG_FIELD)
      if (!hash || !shortHash) continue
      const parents = (parentsRaw ?? '').split(/\s+/).filter(Boolean)
      commits.push({
        hash,
        shortHash,
        parents,
        author: author?.trim() || 'Không rõ',
        authorEmail: authorEmail?.trim() || '',
        timestamp: Number(timestampRaw) || 0,
        subject: subject?.trim() || '(không có tiêu đề)',
        body: body?.trim() || undefined,
        refs: parseGitRefs(refsRaw ?? '', branch, remotes),
        isHead: hash === headHash,
        isMerge: parents.length > 1,
      })
    }

    return { branch, hasRemote: remotes.size > 0, commits }
  } catch {
    return { branch, hasRemote: remotes.size > 0, commits: [] }
  }
}

export async function readVersions(root: string): Promise<ProjectVersion[]> {
  const graph = await readGitGraph(root, { scope: 'current', limit: 30 })
  return graph.commits.map((commit, index) => {
    const tag = commit.refs.find((ref) => ref.type === 'tag')?.name
    const date = new Date(commit.timestamp * 1000)
    const dateText = Number.isNaN(date.getTime())
      ? ''
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return {
      id: `${commit.shortHash}-${index}`,
      name: tag ?? (commit.isHead ? 'HEAD' : `v${index + 1}`),
      status: commit.isHead ? 'review' : 'ok',
      hash: commit.shortHash,
      date: dateText,
      note: commit.subject,
      author: commit.author,
    } satisfies ProjectVersion
  })
}

/** Đồng bộ remote-tracking branches từ GitHub/remote đã cấu hình. */
export async function gitFetch(root: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await execFileAsync('git', ['-C', root, 'fetch', '--all', '--prune'], {
      windowsHide: true,
      timeout: 20_000,
      maxBuffer: 4 * 1024 * 1024,
    })
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Khôi phục mã nguồn về một commit bằng `git reset --hard`.
 * Luôn tạo nhánh backup `pm-backup-*` trước khi reset để có thể quay lại.
 */
export async function rollbackGit(
  root: string,
  hash: string,
): Promise<{ ok: boolean; error?: string; safetyRef?: string }> {
  if (!/^[0-9a-f]{4,40}$/i.test(hash)) {
    return { ok: false, error: 'Mã commit không hợp lệ.' }
  }

  try {
    await execFileAsync('git', ['-C', root, 'rev-parse', '--verify', `${hash}^{commit}`], {
      windowsHide: true,
      timeout: 4000,
    })

    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 17)
    const safetyRef = `pm-backup-${stamp}`
    await execFileAsync('git', ['-C', root, 'branch', '-f', safetyRef, 'HEAD'], {
      windowsHide: true,
      timeout: 4000,
    })
    await execFileAsync('git', ['-C', root, 'reset', '--hard', hash], {
      windowsHide: true,
      timeout: 10_000,
      maxBuffer: 4 * 1024 * 1024,
    })
    return { ok: true, safetyRef }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function cleanGitPath(raw: string): string {
  let p = raw.trim()
  if (p.startsWith('"') && p.endsWith('"')) {
    p = p.slice(1, -1)
  }
  return p.replace(/\\/g, '/')
}

function mapStatusCode(char: string): GitFileStatusCode {
  switch (char) {
    case 'M':
      return 'modified'
    case 'A':
      return 'added'
    case 'D':
      return 'deleted'
    case 'R':
      return 'renamed'
    case '?':
      return 'untracked'
    default:
      return 'modified'
  }
}

/** Đọc chi tiết working tree status (staged, unstaged, untracked). */
export async function readGitStatus(root: string): Promise<GitWorkingTreeStatus> {
  const empty: GitWorkingTreeStatus = {
    branch: null,
    clean: true,
    staged: [],
    unstaged: [],
    untracked: [],
    ahead: 0,
    behind: 0,
  }

  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', root, 'status', '--porcelain=v1', '-b', '-uall'],
      {
        windowsHide: true,
        timeout: 8000,
        maxBuffer: 8 * 1024 * 1024,
      },
    )

    const lines = stdout.split(/\r?\n/)
    let branch: string | null = null
    let ahead = 0
    let behind = 0
    const staged: GitFileChange[] = []
    const unstaged: GitFileChange[] = []
    const untracked: GitFileChange[] = []

    for (const rawLine of lines) {
      if (!rawLine.trim()) continue

      if (rawLine.startsWith('## ')) {
        const header = rawLine.slice(3).trim()
        if (header.startsWith('No commits yet on ')) {
          branch = header.slice('No commits yet on '.length).trim()
        } else if (header.startsWith('HEAD (no branch)')) {
          branch = 'HEAD detached'
        } else {
          const parts = header.split('...')
          branch = parts[0]?.trim() || null
          if (parts[1]) {
            const aheadMatch = parts[1].match(/ahead\s+(\d+)/)
            const behindMatch = parts[1].match(/behind\s+(\d+)/)
            if (aheadMatch) ahead = parseInt(aheadMatch[1], 10) || 0
            if (behindMatch) behind = parseInt(behindMatch[1], 10) || 0
          }
        }
        continue
      }

      const x = rawLine[0]
      const y = rawLine[1]
      const filePart = rawLine.slice(3).trim()

      if (x === '?' && y === '?') {
        untracked.push({
          path: cleanGitPath(filePart),
          status: 'untracked',
          staged: false,
        })
        continue
      }

      if (x && x !== ' ' && x !== '?') {
        let path = filePart
        let oldPath: string | undefined
        if (filePart.includes(' -> ')) {
          const split = filePart.split(' -> ')
          oldPath = cleanGitPath(split[0])
          path = cleanGitPath(split[1])
        } else {
          path = cleanGitPath(path)
        }
        staged.push({
          path,
          oldPath,
          status: mapStatusCode(x),
          staged: true,
        })
      }

      if (y && y !== ' ' && y !== '?') {
        let path = filePart
        let oldPath: string | undefined
        if (filePart.includes(' -> ')) {
          const split = filePart.split(' -> ')
          oldPath = cleanGitPath(split[0])
          path = cleanGitPath(split[1])
        } else {
          path = cleanGitPath(path)
        }
        unstaged.push({
          path,
          oldPath,
          status: mapStatusCode(y),
          staged: false,
        })
      }
    }

    if (!branch) {
      branch = await gitBranch(root)
    }

    const clean = staged.length === 0 && unstaged.length === 0 && untracked.length === 0

    return {
      branch,
      clean,
      staged,
      unstaged,
      untracked,
      ahead,
      behind,
    }
  } catch {
    const branch = await gitBranch(root)
    return { ...empty, branch }
  }
}

/** Stage một hoặc nhiều file (`git add`). */
export async function gitStagePaths(
  root: string,
  paths: string[],
): Promise<GitActionResult> {
  try {
    if (paths.length === 0 || paths.includes('.')) {
      await execFileAsync('git', ['-C', root, 'add', '-A'], {
        windowsHide: true,
        timeout: 10_000,
      })
    } else {
      await execFileAsync('git', ['-C', root, 'add', '--', ...paths], {
        windowsHide: true,
        timeout: 10_000,
      })
    }
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Unstage một hoặc nhiều file (`git restore --staged` hoặc `git reset HEAD`). */
export async function gitUnstagePaths(
  root: string,
  paths: string[],
): Promise<GitActionResult> {
  try {
    if (paths.length === 0 || paths.includes('.')) {
      try {
        await execFileAsync('git', ['-C', root, 'restore', '--staged', '.'], {
          windowsHide: true,
          timeout: 10_000,
        })
      } catch {
        await execFileAsync('git', ['-C', root, 'reset', 'HEAD'], {
          windowsHide: true,
          timeout: 10_000,
        })
      }
    } else {
      try {
        await execFileAsync('git', ['-C', root, 'restore', '--staged', '--', ...paths], {
          windowsHide: true,
          timeout: 10_000,
        })
      } catch {
        await execFileAsync('git', ['-C', root, 'reset', 'HEAD', '--', ...paths], {
          windowsHide: true,
          timeout: 10_000,
        })
      }
    }
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Huỷ bỏ thay đổi (discard changes): khôi phục file sửa đổi hoặc xoá file untracked. */
export async function gitDiscardPaths(
  root: string,
  paths: string[],
): Promise<GitActionResult> {
  try {
    for (const p of paths) {
      const full = join(root, p)
      try {
        const { stdout } = await execFileAsync('git', ['-C', root, 'ls-files', '--', p], {
          windowsHide: true,
          timeout: 4000,
        })
        if (stdout.trim()) {
          try {
            await execFileAsync('git', ['-C', root, 'restore', '--', p], {
              windowsHide: true,
              timeout: 4000,
            })
          } catch {
            await execFileAsync('git', ['-C', root, 'checkout', '--', p], {
              windowsHide: true,
              timeout: 4000,
            })
          }
        } else {
          await fs.rm(full, { force: true, recursive: true })
        }
      } catch {
        await execFileAsync('git', ['-C', root, 'checkout', '--', p], {
          windowsHide: true,
          timeout: 4000,
        })
      }
    }
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Tạo commit với message. */
export async function gitCommitMessage(
  root: string,
  message: string,
): Promise<GitCommitResult> {
  const cleanMsg = message.trim()
  if (!cleanMsg) {
    return { ok: false, error: 'Thông điệp commit không được để trống.' }
  }

  try {
    await execFileAsync('git', ['-C', root, 'commit', '-m', cleanMsg], {
      windowsHide: true,
      timeout: 10_000,
      maxBuffer: 4 * 1024 * 1024,
    })
    const hash = await gitHeadHash(root)
    return { ok: true, hash: hash ?? undefined }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Lấy danh sách toàn bộ nhánh local & remote. */
export async function listGitBranches(root: string): Promise<GitBranchItem[]> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', root, 'branch', '-a', '--format=%(refname)|%(HEAD)|%(upstream:short)'],
      {
        windowsHide: true,
        timeout: 4000,
      },
    )

    const branches: GitBranchItem[] = []
    const seen = new Set<string>()

    for (const raw of stdout.split(/\r?\n/)) {
      if (!raw.trim()) continue
      const [refname, headMark, upstream] = raw.split('|')
      if (!refname) continue

      let name = refname.trim()
      let remote = false

      if (name.startsWith('refs/heads/')) {
        name = name.slice('refs/heads/'.length)
      } else if (name.startsWith('refs/remotes/')) {
        name = name.slice('refs/remotes/'.length)
        remote = true
        if (name.endsWith('/HEAD')) continue
      }

      if (seen.has(name)) continue
      seen.add(name)

      branches.push({
        name,
        current: headMark?.trim() === '*',
        remote,
        upstream: upstream?.trim() || undefined,
      })
    }

    return branches
  } catch {
    return []
  }
}

/** Checkout / switch sang một nhánh khác. */
export async function gitCheckoutBranch(
  root: string,
  branchName: string,
): Promise<GitActionResult> {
  const cleanName = branchName.trim()
  if (!cleanName) return { ok: false, error: 'Tên nhánh không hợp lệ.' }

  try {
    await execFileAsync('git', ['-C', root, 'checkout', cleanName], {
      windowsHide: true,
      timeout: 10_000,
    })
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Tạo nhánh mới và tuỳ chọn checkout sang nhánh đó. */
export async function gitCreateNewBranch(
  root: string,
  branchName: string,
  checkout = true,
): Promise<GitActionResult> {
  const cleanName = branchName.trim()
  if (!cleanName || /\s/.test(cleanName)) {
    return { ok: false, error: 'Tên nhánh không được chứa khoảng trắng hoặc để trống.' }
  }

  try {
    if (checkout) {
      await execFileAsync('git', ['-C', root, 'checkout', '-b', cleanName], {
        windowsHide: true,
        timeout: 10_000,
      })
    } else {
      await execFileAsync('git', ['-C', root, 'branch', cleanName], {
        windowsHide: true,
        timeout: 10_000,
      })
    }
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Đẩy commit lên remote repository (GitHub). */
export async function gitPushProject(
  root: string,
  setUpstream = false,
): Promise<GitActionResult> {
  try {
    const branch = await gitBranch(root)
    if (!branch) return { ok: false, error: 'Không xác định được nhánh hiện tại.' }

    const remotes = await gitRemotes(root)
    if (remotes.size === 0) {
      return { ok: false, error: 'Dự án chưa cấu hình remote repository (GitHub).' }
    }
    const remoteName = remotes.has('origin') ? 'origin' : Array.from(remotes)[0]

    const args = ['-C', root, 'push']
    let needsUpstream = setUpstream
    if (!needsUpstream) {
      try {
        await execFileAsync('git', ['-C', root, 'rev-parse', '--abbrev-ref', '@{u}'], {
          windowsHide: true,
          timeout: 4000,
        })
      } catch {
        needsUpstream = true
      }
    }

    if (needsUpstream) {
      args.push('-u', remoteName, branch)
    }

    await execFileAsync('git', args, {
      windowsHide: true,
      timeout: 60_000,
      maxBuffer: 8 * 1024 * 1024,
    })
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Kéo thay đổi mới nhất từ remote repository (git pull). */
export async function gitPullProject(root: string): Promise<GitActionResult> {
  try {
    await execFileAsync('git', ['-C', root, 'pull'], {
      windowsHide: true,
      timeout: 60_000,
      maxBuffer: 8 * 1024 * 1024,
    })
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
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

export async function initGit(folder: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['-C', folder, 'init'], { windowsHide: true })
    return true
  } catch {
    return false
  }
}

export async function diagnoseProject(
  folder: string,
  dotnetOrCustomCommand?: DotnetProjectInfo | null | string,
  customCommandParam = '',
): Promise<ProjectDiagnosis> {
  const customCommand =
    typeof dotnetOrCustomCommand === 'string'
      ? dotnetOrCustomCommand
      : customCommandParam
  const dotnet =
    typeof dotnetOrCustomCommand === 'object' ? dotnetOrCustomCommand : undefined
  const hasCustomCommand = customCommand.trim().length > 0
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
        .access(join(dir, 'index.htm'))
        .then(() => true)
        .catch(async () =>
          fs
            .access(join(dir, 'public', 'index.html'))
            .then(() => true)
            .catch(async () =>
              fs
                .access(join(dir, 'web', 'index.html'))
                .then(() => true)
                .catch(async () =>
                  fs
                    .access(join(dir, 'wwwroot', 'index.html'))
                    .then(() => true)
                    .catch(async () => {
                      try {
                        const entries = await fs.readdir(dir)
                        return entries.some((e) => /\.(html|htm)$/i.test(e))
                      } catch {
                        return false
                      }
                    }),
                ),
            ),
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
    if (!hasDevOrStart && !hasIndexHtml && !hasCustomCommand) {
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
    if (!hasIndexHtml && !hasCustomCommand) {
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
async function detectOtherProject(dir: string): Promise<{
  framework: string
  packageManager: PackageManager
  scripts: ScriptEntry[]
  hasIndexHtml: boolean
  previewDir?: string
} | null> {
  const exists = async (f: string) =>
    fs.access(join(dir, f)).then(() => true).catch(() => false)

  // 1. Python Django
  if (await exists('manage.py')) {
    return {
      framework: 'Django (Python)',
      packageManager: 'python',
      scripts: [
        { name: 'runserver', command: 'python manage.py runserver', kind: 'dev' },
        { name: 'migrate', command: 'python manage.py migrate', kind: 'other' },
      ],
      hasIndexHtml: false,
    }
  }

  // 2. Python Flask / FastAPI / General
  if (
    (await exists('app.py')) ||
    (await exists('main.py')) ||
    (await exists('requirements.txt')) ||
    (await exists('pyproject.toml'))
  ) {
    const mainFile = (await exists('main.py'))
      ? 'main.py'
      : (await exists('app.py'))
        ? 'app.py'
        : null
    const devCmd = mainFile ? `python ${mainFile}` : 'python -m http.server 8000'
    return {
      framework: 'Python App',
      packageManager: 'pip',
      scripts: [{ name: 'run', command: devCmd, kind: 'dev' }],
      hasIndexHtml: false,
    }
  }

  // 3. PHP Laravel / Native
  if (await exists('artisan')) {
    return {
      framework: 'Laravel (PHP)',
      packageManager: 'composer',
      scripts: [{ name: 'serve', command: 'php artisan serve', kind: 'dev' }],
      hasIndexHtml: false,
    }
  }
  if (await exists('index.php')) {
    return {
      framework: 'PHP App',
      packageManager: (await exists('composer.json')) ? 'composer' : 'none',
      scripts: [{ name: 'dev', command: 'php -S localhost:8000', kind: 'dev' }],
      hasIndexHtml: false,
    }
  }

  // 4. Rust
  if (await exists('Cargo.toml')) {
    return {
      framework: 'Rust App',
      packageManager: 'cargo',
      scripts: [
        { name: 'run', command: 'cargo run', kind: 'dev' },
        { name: 'build', command: 'cargo build', kind: 'build' },
        { name: 'test', command: 'cargo test', kind: 'test' },
      ],
      hasIndexHtml: false,
    }
  }

  // 5. Go
  if (await exists('go.mod')) {
    return {
      framework: 'Go App',
      packageManager: 'go',
      scripts: [
        { name: 'run', command: 'go run .', kind: 'dev' },
        { name: 'build', command: 'go build', kind: 'build' },
        { name: 'test', command: 'go test ./...', kind: 'test' },
      ],
      hasIndexHtml: false,
    }
  }

  // 6. Java (Spring Boot / Maven)
  if (await exists('pom.xml')) {
    const mvnCmd = process.platform === 'win32' ? 'mvnw.cmd' : './mvnw'
    const hasMvnw = await exists(process.platform === 'win32' ? 'mvnw.cmd' : 'mvnw')
    const cmd = hasMvnw ? `${mvnCmd} spring-boot:run` : 'mvn spring-boot:run'
    return {
      framework: 'Spring Boot (Java / Maven)',
      packageManager: 'mvn',
      scripts: [
        { name: 'run', command: cmd, kind: 'dev' },
        { name: 'build', command: hasMvnw ? `${mvnCmd} clean package` : 'mvn clean package', kind: 'build' },
        { name: 'test', command: hasMvnw ? `${mvnCmd} test` : 'mvn test', kind: 'test' },
      ],
      hasIndexHtml: false,
    }
  }

  // 7. Java / Kotlin (Gradle)
  if ((await exists('build.gradle')) || (await exists('build.gradle.kts'))) {
    const gradlewCmd = process.platform === 'win32' ? 'gradlew.bat' : './gradlew'
    const hasGradlew = await exists(process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')
    const cmd = hasGradlew ? `${gradlewCmd} bootRun` : 'gradle bootRun'
    return {
      framework: 'Java (Gradle)',
      packageManager: 'gradle',
      scripts: [
        { name: 'run', command: cmd, kind: 'dev' },
        { name: 'build', command: hasGradlew ? `${gradlewCmd} build` : 'gradle build', kind: 'build' },
      ],
      hasIndexHtml: false,
    }
  }

  // 8. Ruby on Rails
  if (await exists('Gemfile')) {
    return {
      framework: 'Ruby on Rails',
      packageManager: 'bundle',
      scripts: [
        { name: 'run', command: 'bundle exec rails server', kind: 'dev' },
      ],
      hasIndexHtml: false,
    }
  }

  // 9. Web tĩnh thuần (HTML/CSS/JS)
  const hasRootIndex = (await exists('index.html')) || (await exists('index.htm'))
  const hasPublicIndex =
    (await exists(join('public', 'index.html'))) || (await exists(join('public', 'index.htm')))

  let isStaticWeb = hasRootIndex || hasPublicIndex
  let staticPreviewDir = hasPublicIndex && !hasRootIndex ? 'public' : ''

  if (!isStaticWeb) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      const anyHtml = entries.some((e) => e.isFile() && /\.(html|htm)$/i.test(e.name))
      if (anyHtml) {
        isStaticWeb = true
      }
    } catch {}
  }

  if (isStaticWeb) {
    return {
      framework: 'HTML5 / Web Tĩnh',
      packageManager: 'none',
      scripts: [
        { name: 'static', command: 'static-server', kind: 'dev', direct: true },
      ],
      hasIndexHtml: true,
      previewDir: staticPreviewDir,
    }
  }

  return null
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
      previewDir: dotnetInfo.hasIndexHtml ? (dotnetInfo.projectDir ? join(dotnetInfo.projectDir, 'wwwroot').replace(/\\/g, '/') : 'wwwroot') : '',
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
      previewDir: flutterInfo.hasIndexHtml ? 'web' : '',
      addedAt: Date.now(),
      lastOpenedAt: null,
      favorite: false,
      diagnosis,
      meta: await buildMeta(dir, projectName),
    }
  }

  if (!pkg) {
    const other = await detectOtherProject(dir)
    if (other) {
      const projectName = basename(dir)
      const diagnosis = await diagnoseProject(dir)
      return {
        id: randomUUID(),
        name: projectName,
        path: dir,
        framework: other.framework,
        packageManager: other.packageManager,
        scripts: other.scripts,
        hasIndexHtml: other.hasIndexHtml,
        previewDir: other.previewDir ?? '',
        addedAt: Date.now(),
        lastOpenedAt: null,
        favorite: false,
        diagnosis,
        meta: await buildMeta(dir, projectName),
      }
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
        .access(join(dir, 'index.htm'))
        .then(() => true)
        .catch(async () =>
          fs
            .access(join(dir, 'public', 'index.html'))
            .then(() => true)
            .catch(async () =>
              fs
                .access(join(dir, 'web', 'index.html'))
                .then(() => true)
                .catch(async () =>
                  fs
                    .access(join(dir, 'wwwroot', 'index.html'))
                    .then(() => true)
                    .catch(async () => {
                      try {
                        const entries = await fs.readdir(dir)
                        return entries.some((e) => /\.(html|htm)$/i.test(e))
                      } catch {
                        return false
                      }
                    }),
                ),
            ),
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
    previewDir: '',
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
    // `rev-parse` xử lý đúng cả worktree (nơi `.git` là một tệp con trỏ).
    const { stdout } = await execFileAsync('git', ['-C', root, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      windowsHide: true,
      timeout: 4000,
    })
    const branch = stdout.trim()
    if (branch && branch !== 'HEAD') return branch
    const { stdout: hash } = await execFileAsync('git', ['-C', root, 'rev-parse', '--short', 'HEAD'], {
      windowsHide: true,
      timeout: 4000,
    })
    return hash.trim() || null
  } catch {
    try {
      const head = await fs.readFile(join(root, '.git', 'HEAD'), 'utf8')
      const match = head.match(/ref:\s*refs\/heads\/(.+)/)
      return match ? match[1].trim() : head.trim().slice(0, 8)
    } catch {
      return null
    }
  }
}

export async function getGitDiffStats(
  root: string,
): Promise<Array<{ file: string; added: number; removed: number }>> {
  if (!root) return []
  try {
    const { stdout } = await execFileAsync('git', ['-C', root, 'diff', '--numstat'], {
      windowsHide: true,
      timeout: 4000,
    })
    const list: Array<{ file: string; added: number; removed: number }> = []
    for (const line of stdout.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const parts = trimmed.split(/\s+/)
      if (parts.length >= 3) {
        const added = parseInt(parts[0], 10) || 0
        const removed = parseInt(parts[1], 10) || 0
        const file = parts.slice(2).join(' ')
        list.push({ file, added, removed })
      }
    }
    return list
  } catch {
    return []
  }
}

export async function gitRevertFiles(root: string, files?: string[]): Promise<boolean> {
  if (!root) return false
  try {
    const args = ['-C', root, 'checkout', '--']
    if (files && files.length > 0) {
      args.push(...files)
    } else {
      args.push('.')
    }
    await execFileAsync('git', args, { windowsHide: true, timeout: 5000 })
    return true
  } catch {
    return false
  }
}

export async function searchProjectContent(
  root: string,
  query: string,
  options?: FileSearchOptions,
): Promise<FileSearchMatch[]> {
  const q = (query || '').trim()
  if (!q || !root) return []
  const maxResults = Math.min(250, Math.max(1, options?.maxResults ?? 120))
  const compiled = compileSearchQuery(q, {
    caseSensitive: Boolean(options?.caseSensitive),
    regex: Boolean(options?.regex),
    wholeWord: Boolean(options?.wholeWord),
  })
  // Regex sai → ném lỗi rõ ràng để giao diện hiển thị thay vì im lặng trả rỗng.
  if (!compiled.regex) {
    if (compiled.error) throw new Error(compiled.error)
    return []
  }
  const matcher = compiled.regex
  const results: FileSearchMatch[] = []
  const includeGlobs = compileGlobList(options?.includeGlobs)
  const excludeGlobs = compileGlobList(options?.excludeGlobs)

  /** Đường dẫn tương đối dùng '/' — cùng dạng mà glob của người dùng mô tả. */
  const relPathOf = (target: string) => relative(root, target).replace(/\\/g, '/')
  const isExcluded = (relPath: string) => excludeGlobs.length > 0 && matchesAnyGlob(relPath, excludeGlobs)
  const isIncluded = (relPath: string) => includeGlobs.length === 0 || matchesAnyGlob(relPath, includeGlobs)

  const walk = async (dir: string) => {
    if (results.length >= maxResults) return
    let entries: Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (results.length >= maxResults) break
      const name = entry.name
      const relEntry = relPathOf(join(dir, name))
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(name) || name.startsWith('.')) continue
        // Cắt cả cây thư mục khi bị loại trừ hoặc chắc chắn không có tệp include.
        if (isExcluded(relEntry)) continue
        if (includeGlobs.length > 0 && !includeGlobs.some((glob) => globMayMatchUnder(glob, relEntry))) continue
        await walk(join(dir, name))
      } else if (entry.isFile()) {
        const ext = extname(name).slice(1).toLowerCase()
        if (!TEXT_EXT.has(ext)) continue
        if (isExcluded(relEntry) || !isIncluded(relEntry)) continue
        const full = join(dir, name)
        try {
          const stat = await fs.stat(full)
          if (stat.size > 1024 * 1024) continue
          const content = await fs.readFile(full, 'utf8')
          const lines = content.split(/\r?\n/)
          for (let i = 0; i < lines.length; i++) {
            const lineText = lines[i]
            const hit = firstMatchInLine(lineText, matcher)
            if (!hit) continue
            const rel = relEntry
            const leading = lineText.length - lineText.trimStart().length
            const preview = lineText.trim().slice(0, 300)
            // Vị trí khớp tính theo dòng gốc (0-based) để editor đánh dấu đúng cột.
            const matchStart = Math.max(0, Math.min(lineText.length, hit.index))
            const matchEnd = Math.max(matchStart, Math.min(lineText.length, hit.index + hit.length))
            // Vị trí trong preview (đã trim + cắt 300 ký tự) để tô sáng trong danh sách.
            const previewMatchStart = Math.max(0, Math.min(preview.length, hit.index - leading))
            const previewMatchEnd = Math.max(
              previewMatchStart,
              Math.min(preview.length, previewMatchStart + hit.length),
            )
            results.push({
              file: rel,
              fullPath: full,
              line: i + 1,
              preview,
              matchStart,
              matchEnd,
              previewMatchStart,
              previewMatchEnd,
            })
            if (results.length >= maxResults) break
          }
        } catch {
          // ignore unreadable files
        }
      }
    }
  }

  await walk(resolve(root))
  return results
}
