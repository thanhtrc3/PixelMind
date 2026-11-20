import { promises as fs, constants as fsConstants } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import type { PageFilePreview } from '../../shared/types'

export type PageTemplateKind =
  | 'next-app'
  | 'next-pages'
  | 'vue'
  | 'sveltekit'
  | 'astro'
  | 'html'
  | 'razor'

export interface PageFileTarget extends PageFilePreview {
  kind: PageTemplateKind | 'unsupported'
  absolutePath: string
  /** Route đã chuẩn hoá (dùng cho template). */
  route: string
}

const rootOf = (projectPath: string) => resolve(projectPath)

/* ── Tiện ích hệ thống tệp ─────────────────────────────────── */

async function fileExists(target: string): Promise<boolean> {
  try {
    return (await fs.stat(target)).isFile()
  } catch {
    return false
  }
}

async function dirExists(target: string): Promise<boolean> {
  try {
    return (await fs.stat(target)).isDirectory()
  } catch {
    return false
  }
}

async function collectFiles(
  dir: string,
  exts: string[],
  depth: number,
  prefix = '',
): Promise<string[]> {
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
      if (depth > 0) out.push(...(await collectFiles(join(dir, entry.name), exts, depth - 1, rel)))
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      out.push(rel)
    }
  }
  return out
}

async function readPackageDeps(projectPath: string): Promise<Set<string>> {
  try {
    const raw = JSON.parse(await fs.readFile(join(projectPath, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    return new Set([
      ...Object.keys(raw.dependencies ?? {}),
      ...Object.keys(raw.devDependencies ?? {}),
    ])
  } catch {
    return new Set()
  }
}

async function hasNonJsMarker(projectPath: string): Promise<boolean> {
  const markers = ['pubspec.yaml', 'composer.json', 'manage.py', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'pyproject.toml']
  for (const marker of markers) {
    if (await fileExists(join(projectPath, marker))) return true
  }
  try {
    const entries = await fs.readdir(projectPath)
    return entries.some((name) => /\.(csproj|sln|cshtml|razor|fsproj|vbproj|slnx)$/i.test(name))
  } catch {
    return false
  }
}

/* ── Chuẩn hoá route & tên tệp ─────────────────────────────── */

export function normalizePageRoute(input: string): string {
  let route = input.trim()
  if (!route.startsWith('/')) route = `/${route}`
  route = route.replace(/\/+/g, '/')
  if (route.length > 1 && route.endsWith('/')) route = route.slice(0, -1)
  return route
}

function toSlug(segment: string): string {
  return segment
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

/** Trả về null nếu route chứa ký tự/ký hiệu chưa được hỗ trợ. */
function routeSegments(route: string): string[] | null {
  if (route === '/') return []
  const raw = route.slice(1).split('/')
  if (raw.some((segment) => !segment)) return null
  if (raw.some((segment) => /[\\<>:"|?*\u0000-\u001f]/.test(segment))) return null
  if (raw.some((segment) => segment === '.' || segment === '..')) return null
  // Route động phức tạp: chưa hỗ trợ tạo tệp tự động.
  if (raw.some((segment) => /[:[\]*]/.test(segment))) return null
  const slugs = raw.map(toSlug)
  if (slugs.some((segment) => !segment)) return null
  return slugs
}

function unsupported(label: string, reason: string, route: string): PageFileTarget {
  return {
    supported: false,
    label,
    relativePath: '',
    exists: false,
    reason,
    kind: 'unsupported',
    absolutePath: '',
    route,
  }
}

async function pickNextExtension(projectPath: string, baseRel: string): Promise<'tsx' | 'jsx'> {
  const files = await collectFiles(join(projectPath, baseRel), ['.tsx', '.jsx'], 4)
  if (files.some((file) => file.endsWith('.tsx'))) return 'tsx'
  if (files.some((file) => file.endsWith('.jsx'))) return 'jsx'
  return (await fileExists(join(projectPath, 'tsconfig.json'))) ? 'tsx' : 'jsx'
}

/* ── Dò framework & đường dẫn tệp ──────────────────────────── */

export async function resolvePageTarget(
  projectPath: string,
  routeInput: string,
): Promise<PageFileTarget> {
  const root = rootOf(projectPath)
  const route = normalizePageRoute(routeInput)

  const [
    srcApp,
    app,
    srcPages,
    pages,
    srcRoutes,
    routes,
    hasIndexHtml,
    deps,
    nonJs,
  ] = await Promise.all([
    dirExists(join(root, 'src', 'app')),
    dirExists(join(root, 'app')),
    dirExists(join(root, 'src', 'pages')),
    dirExists(join(root, 'pages')),
    dirExists(join(root, 'src', 'routes')),
    dirExists(join(root, 'routes')),
    fileExists(join(root, 'index.html')),
    readPackageDeps(root),
    hasNonJsMarker(root),
  ])

  // Kiểm tra dự án ASP.NET Core MVC hoặc Razor Pages
  const cshtmlFiles = await collectFiles(root, ['.cshtml'], 4)
  if (
    cshtmlFiles.length > 0 ||
    (await dirExists(join(root, 'Views'))) ||
    (await dirExists(join(root, 'Pages')))
  ) {
    let baseViews = ''
    if (await dirExists(join(root, 'Views'))) {
      baseViews = 'Views'
    } else {
      const match = cshtmlFiles.find((f) => /(?:^|[\\/])Views[\\/]/i.test(f))
      if (match) {
        const norm = match.replace(/\\/g, '/')
        const idx = norm.search(/(?:^|\/)Views\//i)
        const prefix = norm.slice(0, idx).replace(/^\/+|\/+$/g, '')
        baseViews = prefix ? `${prefix}/Views` : 'Views'
      }
    }

    if (baseViews) {
      const segments = routeSegments(route)
      if (segments) {
        let relPath = ''
        if (segments.length === 0) {
          relPath = `${baseViews}/Home/Index.cshtml`
        } else if (segments.length === 1) {
          const cap = segments[0].charAt(0).toUpperCase() + segments[0].slice(1)
          relPath = `${baseViews}/Home/${cap}.cshtml`
        } else {
          const c1 = segments[0].charAt(0).toUpperCase() + segments[0].slice(1)
          const c2 = segments[1].charAt(0).toUpperCase() + segments[1].slice(1)
          relPath = `${baseViews}/${c1}/${c2}.cshtml`
        }
        const absolutePath = join(root, ...relPath.split('/'))
        const exists = await fileExists(absolutePath)
        return {
          supported: true,
          label: 'ASP.NET Core (Razor)',
          relativePath: relPath,
          exists,
          reason: exists ? `Tệp ${relPath} đã tồn tại.` : undefined,
          kind: 'razor',
          absolutePath,
          route,
        }
      }
    }
  }

  if (nonJs) {
    return unsupported('Không hỗ trợ', 'Dự án này không dùng quy ước tệp route của web/JS.', route)
  }

  let kind: PageTemplateKind | null = null
  let baseRel = ''
  let label = ''

  if (deps.has('next')) {
    if (srcApp || app) {
      kind = 'next-app'
      baseRel = srcApp ? 'src/app' : 'app'
      label = 'Next.js App Router'
    } else if (srcPages || pages) {
      kind = 'next-pages'
      baseRel = srcPages ? 'src/pages' : 'pages'
      label = 'Next.js Pages Router'
    } else {
      kind = 'next-app'
      baseRel = 'app'
      label = 'Next.js App Router'
    }
  } else if (deps.has('nuxt') || deps.has('vue')) {
    kind = 'vue'
    baseRel = pages ? 'pages' : srcPages ? 'src/pages' : 'pages'
    label = deps.has('nuxt') ? 'Nuxt (Vue)' : 'Vue'
  } else if (deps.has('@sveltejs/kit') || deps.has('svelte')) {
    kind = 'sveltekit'
    baseRel = srcRoutes ? 'src/routes' : routes ? 'routes' : 'src/routes'
    label = 'SvelteKit'
  } else if (deps.has('astro')) {
    kind = 'astro'
    baseRel = srcPages ? 'src/pages' : pages ? 'pages' : 'src/pages'
    label = 'Astro'
  } else if (deps.size > 0) {
    // Dự án JS nhưng dùng router tự do (React Router, Vite…) — không có quy ước tệp route.
    return unsupported(
      'Router tự do',
      'Dự án không dùng routing theo tệp nên không thể tạo route tự động. Hãy thêm trang ở chế độ chỉ metadata.',
      route,
    )
  } else if (hasIndexHtml || (await collectFiles(root, ['.html', '.htm'], 1)).length > 0) {
    kind = 'html'
    baseRel = ''
    label = 'HTML tĩnh'
  } else {
    // Thử đoán theo cấu trúc thư mục khi không có package.json.
    if (srcApp || app) {
      kind = 'next-app'
      baseRel = srcApp ? 'src/app' : 'app'
      label = 'Next.js App Router'
    } else if (srcRoutes || routes) {
      kind = 'sveltekit'
      baseRel = srcRoutes ? 'src/routes' : 'routes'
      label = 'SvelteKit'
    } else if (srcPages || pages) {
      const base = srcPages ? 'src/pages' : 'pages'
      const astro = (await collectFiles(join(root, base), ['.astro'], 3)).length > 0
      const vue = (await collectFiles(join(root, base), ['.vue'], 3)).length > 0
      if (astro) {
        kind = 'astro'
        label = 'Astro'
      } else if (vue) {
        kind = 'vue'
        label = 'Vue'
      } else {
        kind = 'next-pages'
        label = 'Next.js Pages Router'
      }
      baseRel = base
    }
  }

  if (!kind) {
    return unsupported('Không hỗ trợ', 'Không nhận diện được framework có routing theo tệp.', route)
  }

  const segments = routeSegments(route)
  if (segments === null) {
    return unsupported(
      label,
      'Route chứa tham số động hoặc ký tự chưa hỗ trợ. Hãy tạo trang ở chế độ chỉ metadata.',
      route,
    )
  }

  let relativePath = ''
  if (kind === 'next-app') {
    const ext = await pickNextExtension(root, baseRel)
    relativePath = segments.length === 0 ? `page.${ext}` : `${segments.join('/')}/page.${ext}`
  } else if (kind === 'next-pages') {
    const ext = await pickNextExtension(root, baseRel)
    relativePath = segments.length === 0 ? `index.${ext}` : `${segments.join('/')}.${ext}`
  } else if (kind === 'vue') {
    relativePath = segments.length === 0 ? 'index.vue' : `${segments.join('/')}.vue`
  } else if (kind === 'sveltekit') {
    relativePath = segments.length === 0 ? '+page.svelte' : `${segments.join('/')}/+page.svelte`
  } else if (kind === 'astro') {
    relativePath = segments.length === 0 ? 'index.astro' : `${segments.join('/')}.astro`
  } else {
    // HTML tĩnh: dùng <route>/index.html để máy chủ tĩnh phục vụ đúng route sạch.
    relativePath = segments.length === 0 ? 'index.html' : `${segments.join('/')}/index.html`
  }

  const relativeFull = baseRel ? `${baseRel}/${relativePath}` : relativePath
  const absolutePath = join(root, ...relativeFull.split('/'))
  const exists = await fileExists(absolutePath)

  return {
    supported: true,
    label,
    relativePath: relativeFull,
    exists,
    reason: exists ? `Tệp ${relativeFull} đã tồn tại.` : undefined,
    kind,
    absolutePath,
    route,
  }
}

/* ── Template & thao tác tệp ───────────────────────────────── */

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export function buildTemplate(kind: PageTemplateKind, title: string, route: string): string {
  const safeTitle = title.trim() || 'Trang mới'
  const htmlTitle = escapeHtml(safeTitle)
  const htmlRoute = escapeHtml(route)
  const jsTitle = JSON.stringify(safeTitle)

  if (kind === 'next-app' || kind === 'next-pages') {
    return `export default function Page() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1e293b', backgroundColor: '#f8fafc' }}>
      <header style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '16px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ fontWeight: 700, fontSize: 18, color: '#0f172a', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🌐</span> PixelMind
          </a>
          <nav style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <a href="/" style={{ color: '#64748b', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>Trang chủ</a>
            <a href="#" style={{ color: '#2563eb', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>${htmlTitle}</a>
            <a href="#about" style={{ color: '#64748b', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>Giới thiệu</a>
            <a href="#contact" style={{ color: '#64748b', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>Liên hệ</a>
          </nav>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 1200, width: '100%', margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 32, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0f172a', marginTop: 0, marginBottom: 8 }}>${htmlTitle}</h1>
          <p style={{ color: '#64748b', fontSize: 15, marginBottom: 24 }}>Trang <code>${htmlRoute}</code> được tạo bởi PixelMind.</p>
          <section style={{ borderRadius: 12, padding: '48px 32px', background: 'linear-gradient(135deg, #eff6ff, #f5f3ff)', marginBottom: 32 }}>
            <p style={{ color: '#2563eb', fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Khám phá nội dung</p>
            <h2 style={{ fontSize: 32, color: '#0f172a', margin: '12px 0' }}>Chào mừng đến với ${htmlTitle}</h2>
            <p style={{ maxWidth: 640, color: '#475569', fontSize: 16, lineHeight: 1.7 }}>Tìm hiểu những thông tin hữu ích, khám phá các điểm nổi bật và bắt đầu trải nghiệm ngay hôm nay.</p>
            <a href="#features" style={{ display: 'inline-block', marginTop: 12, padding: '12px 20px', borderRadius: 8, background: '#2563eb', color: '#ffffff', textDecoration: 'none', fontWeight: 600 }}>Khám phá ngay</a>
          </section>
          <section id="features" style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 24, color: '#0f172a' }}>Điểm nổi bật</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <article style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 22 }}><h3 style={{ color: '#1e293b', marginTop: 0 }}>Thông tin rõ ràng</h3><p style={{ color: '#64748b', lineHeight: 1.6 }}>Trình bày những điều người dùng cần biết theo cách dễ đọc và dễ tìm.</p></article>
              <article style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 22 }}><h3 style={{ color: '#1e293b', marginTop: 0 }}>Trải nghiệm thuận tiện</h3><p style={{ color: '#64748b', lineHeight: 1.6 }}>Sắp xếp nội dung mạch lạc để người dùng nhanh chóng tìm thấy điều họ cần.</p></article>
              <article style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 22 }}><h3 style={{ color: '#1e293b', marginTop: 0 }}>Luôn đồng hành</h3><p style={{ color: '#64748b', lineHeight: 1.6 }}>Tạo điểm kết nối để người dùng dễ dàng tìm hiểu thêm và liên hệ với bạn.</p></article>
            </div>
          </section>
          <section id="contact" style={{ borderRadius: 12, padding: 28, background: '#f1f5f9' }}>
            <h2 style={{ color: '#0f172a', marginTop: 0 }}>Bạn muốn tìm hiểu thêm?</h2>
            <p style={{ color: '#475569', lineHeight: 1.6 }}>Khám phá thêm nội dung trên trang hoặc liên hệ với chúng tôi để được hỗ trợ.</p>
            <a href="#features" style={{ color: '#2563eb', fontWeight: 600 }}>Xem các mục nổi bật</a>
          </section>
        </div>
      </main>

      <footer style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', padding: 24, textAlign: 'center', color: '#64748b', fontSize: 14 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <p style={{ margin: 0 }}>&copy; 2026 PixelMind. Tất cả quyền được bảo lưu.</p>
          <div style={{ display: 'flex', gap: 16 }}>
            <a href="#" style={{ color: '#64748b', textDecoration: 'none' }}>Chính sách bảo mật</a>
            <a href="#" style={{ color: '#64748b', textDecoration: 'none' }}>Điều khoản dịch vụ</a>
            <a href="#" style={{ color: '#64748b', textDecoration: 'none' }}>Trợ giúp</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
`
  }

  if (kind === 'vue') {
    return `<template>
  <div style="min-height: 100vh; display: flex; flex-direction: column; font-family: system-ui, -apple-system, sans-serif; color: #1e293b; background-color: #f8fafc">
    <header style="background: #ffffff; border-bottom: 1px solid #e2e8f0; padding: 16px 24px">
      <div style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between">
        <a href="/" style="font-weight: 700; font-size: 18px; color: #0f172a; text-decoration: none; display: flex; align-items: center; gap: 8px">
          <span>🌐</span> PixelMind
        </a>
        <nav style="display: flex; gap: 20px; align-items: center">
          <a href="/" style="color: #64748b; text-decoration: none; font-size: 14px; font-weight: 500">Trang chủ</a>
          <a href="#" style="color: #2563eb; text-decoration: none; font-size: 14px; font-weight: 600">{{ title }}</a>
          <a href="#about" style="color: #64748b; text-decoration: none; font-size: 14px; font-weight: 500">Giới thiệu</a>
          <a href="#contact" style="color: #64748b; text-decoration: none; font-size: 14px; font-weight: 500">Liên hệ</a>
        </nav>
      </div>
    </header>

    <main style="flex: 1; max-width: 1200px; width: 100%; margin: 0 auto; padding: 40px 24px">
      <div style="background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05)">
        <h1 style="font-size: 28px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 8px">{{ title }}</h1>
        <p style="color: #64748b; font-size: 15px; margin-bottom: 24px">Trang <code>${htmlRoute}</code> được tạo bởi PixelMind.</p>
        <section style="border-radius: 12px; padding: 48px 32px; background: linear-gradient(135deg, #eff6ff, #f5f3ff); margin-bottom: 32px">
          <p style="color: #2563eb; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase">Khám phá nội dung</p>
          <h2 style="font-size: 32px; color: #0f172a; margin: 12px 0">Chào mừng đến với {{ title }}</h2>
          <p style="max-width: 640px; color: #475569; font-size: 16px; line-height: 1.7">Tìm hiểu những thông tin hữu ích, khám phá các điểm nổi bật và bắt đầu trải nghiệm ngay hôm nay.</p>
          <a href="#features" style="display: inline-block; margin-top: 12px; padding: 12px 20px; border-radius: 8px; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600">Khám phá ngay</a>
        </section>
        <section id="features" style="margin-bottom: 32px">
          <h2 style="font-size: 24px; color: #0f172a">Điểm nổi bật</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px">
            <article style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px"><h3 style="color: #1e293b; margin-top: 0">Thông tin rõ ràng</h3><p style="color: #64748b; line-height: 1.6">Trình bày những điều người dùng cần biết theo cách dễ đọc và dễ tìm.</p></article>
            <article style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px"><h3 style="color: #1e293b; margin-top: 0">Trải nghiệm thuận tiện</h3><p style="color: #64748b; line-height: 1.6">Sắp xếp nội dung mạch lạc để người dùng nhanh chóng tìm thấy điều họ cần.</p></article>
            <article style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px"><h3 style="color: #1e293b; margin-top: 0">Luôn đồng hành</h3><p style="color: #64748b; line-height: 1.6">Tạo điểm kết nối để người dùng dễ dàng tìm hiểu thêm và liên hệ với bạn.</p></article>
          </div>
        </section>
        <section id="contact" style="border-radius: 12px; padding: 28px; background: #f1f5f9">
          <h2 style="color: #0f172a; margin-top: 0">Bạn muốn tìm hiểu thêm?</h2>
          <p style="color: #475569; line-height: 1.6">Khám phá thêm nội dung trên trang hoặc liên hệ với chúng tôi để được hỗ trợ.</p>
          <a href="#features" style="color: #2563eb; font-weight: 600">Xem các mục nổi bật</a>
        </section>
      </div>
    </main>

    <footer style="background: #ffffff; border-top: 1px solid #e2e8f0; padding: 24px; text-align: center; color: #64748b; font-size: 14px">
      <div style="max-width: 1200px; margin: 0 auto; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px">
        <p style="margin: 0">&copy; 2026 PixelMind. Tất cả quyền được bảo lưu.</p>
        <div style="display: flex; gap: 16px">
          <a href="#" style="color: #64748b; text-decoration: none">Chính sách bảo mật</a>
          <a href="#" style="color: #64748b; text-decoration: none">Điều khoản dịch vụ</a>
          <a href="#" style="color: #64748b; text-decoration: none">Trợ giúp</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
const title = ${jsTitle}
</script>
`
  }

  if (kind === 'sveltekit') {
    return `<script>
  const title = ${jsTitle}
</script>

<div style="min-height: 100vh; display: flex; flex-direction: column; font-family: system-ui, -apple-system, sans-serif; color: #1e293b; background-color: #f8fafc">
  <header style="background: #ffffff; border-bottom: 1px solid #e2e8f0; padding: 16px 24px">
    <div style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between">
      <a href="/" style="font-weight: 700; font-size: 18px; color: #0f172a; text-decoration: none; display: flex; align-items: center; gap: 8px">
        <span>🌐</span> PixelMind
      </a>
      <nav style="display: flex; gap: 20px; align-items: center">
        <a href="/" style="color: #64748b; text-decoration: none; font-size: 14px; font-weight: 500">Trang chủ</a>
        <a href="#" style="color: #2563eb; text-decoration: none; font-size: 14px; font-weight: 600">{title}</a>
        <a href="#about" style="color: #64748b; text-decoration: none; font-size: 14px; font-weight: 500">Giới thiệu</a>
        <a href="#contact" style="color: #64748b; text-decoration: none; font-size: 14px; font-weight: 500">Liên hệ</a>
      </nav>
    </div>
  </header>

  <main style="flex: 1; max-width: 1200px; width: 100%; margin: 0 auto; padding: 40px 24px">
    <div style="background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05)">
      <h1 style="font-size: 28px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 8px">{title}</h1>
      <p style="color: #64748b; font-size: 15px; margin-bottom: 24px">Trang <code>${htmlRoute}</code> được tạo bởi PixelMind.</p>
      <section style="border-radius: 12px; padding: 48px 32px; background: linear-gradient(135deg, #eff6ff, #f5f3ff); margin-bottom: 32px">
        <p style="color: #2563eb; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase">Khám phá nội dung</p>
        <h2 style="font-size: 32px; color: #0f172a; margin: 12px 0">Chào mừng đến với {title}</h2>
        <p style="max-width: 640px; color: #475569; font-size: 16px; line-height: 1.7">Tìm hiểu những thông tin hữu ích, khám phá các điểm nổi bật và bắt đầu trải nghiệm ngay hôm nay.</p>
        <a href="#features" style="display: inline-block; margin-top: 12px; padding: 12px 20px; border-radius: 8px; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600">Khám phá ngay</a>
      </section>
      <section id="features" style="margin-bottom: 32px">
        <h2 style="font-size: 24px; color: #0f172a">Điểm nổi bật</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px">
          <article style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px"><h3 style="color: #1e293b; margin-top: 0">Thông tin rõ ràng</h3><p style="color: #64748b; line-height: 1.6">Trình bày những điều người dùng cần biết theo cách dễ đọc và dễ tìm.</p></article>
          <article style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px"><h3 style="color: #1e293b; margin-top: 0">Trải nghiệm thuận tiện</h3><p style="color: #64748b; line-height: 1.6">Sắp xếp nội dung mạch lạc để người dùng nhanh chóng tìm thấy điều họ cần.</p></article>
          <article style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px"><h3 style="color: #1e293b; margin-top: 0">Luôn đồng hành</h3><p style="color: #64748b; line-height: 1.6">Tạo điểm kết nối để người dùng dễ dàng tìm hiểu thêm và liên hệ với bạn.</p></article>
        </div>
      </section>
      <section id="contact" style="border-radius: 12px; padding: 28px; background: #f1f5f9">
        <h2 style="color: #0f172a; margin-top: 0">Bạn muốn tìm hiểu thêm?</h2>
        <p style="color: #475569; line-height: 1.6">Khám phá thêm nội dung trên trang hoặc liên hệ với chúng tôi để được hỗ trợ.</p>
        <a href="#features" style="color: #2563eb; font-weight: 600">Xem các mục nổi bật</a>
      </section>
    </div>
  </main>

  <footer style="background: #ffffff; border-top: 1px solid #e2e8f0; padding: 24px; text-align: center; color: #64748b; font-size: 14px">
    <div style="max-width: 1200px; margin: 0 auto; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px">
      <p style="margin: 0">&copy; 2026 PixelMind. Tất cả quyền được bảo lưu.</p>
      <div style="display: flex; gap: 16px">
        <a href="#" style="color: #64748b; text-decoration: none">Chính sách bảo mật</a>
        <a href="#" style="color: #64748b; text-decoration: none">Điều khoản dịch vụ</a>
        <a href="#" style="color: #64748b; text-decoration: none">Trợ giúp</a>
      </div>
    </div>
  </footer>
</div>
`
  }

  if (kind === 'astro') {
    return `---
const title = ${jsTitle}
---

<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
  </head>
  <body style="margin: 0; padding: 0;">
    <div style="min-height: 100vh; display: flex; flex-direction: column; font-family: system-ui, -apple-system, sans-serif; color: #1e293b; background-color: #f8fafc">
      <header style="background: #ffffff; border-bottom: 1px solid #e2e8f0; padding: 16px 24px">
        <div style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between">
          <a href="/" style="font-weight: 700; font-size: 18px; color: #0f172a; text-decoration: none; display: flex; align-items: center; gap: 8px">
            <span>🌐</span> PixelMind
          </a>
          <nav style="display: flex; gap: 20px; align-items: center">
            <a href="/" style="color: #64748b; text-decoration: none; font-size: 14px; font-weight: 500">Trang chủ</a>
            <a href="#" style="color: #2563eb; text-decoration: none; font-size: 14px; font-weight: 600">{title}</a>
            <a href="#about" style="color: #64748b; text-decoration: none; font-size: 14px; font-weight: 500">Giới thiệu</a>
            <a href="#contact" style="color: #64748b; text-decoration: none; font-size: 14px; font-weight: 500">Liên hệ</a>
          </nav>
        </div>
      </header>

      <main style="flex: 1; max-width: 1200px; width: 100%; margin: 0 auto; padding: 40px 24px">
        <div style="background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05)">
          <h1 style="font-size: 28px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 8px">{title}</h1>
          <p style="color: #64748b; font-size: 15px; margin-bottom: 24px">Trang <code>${htmlRoute}</code> được tạo bởi PixelMind.</p>
          <section style="border-radius: 12px; padding: 48px 32px; background: linear-gradient(135deg, #eff6ff, #f5f3ff); margin-bottom: 32px">
            <p style="color: #2563eb; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase">Khám phá nội dung</p>
            <h2 style="font-size: 32px; color: #0f172a; margin: 12px 0">{title}</h2>
            <p style="max-width: 640px; color: #475569; font-size: 16px; line-height: 1.7">Tìm hiểu những thông tin hữu ích, khám phá các điểm nổi bật và bắt đầu trải nghiệm ngay hôm nay.</p>
            <a href="#features" style="display: inline-block; margin-top: 12px; padding: 12px 20px; border-radius: 8px; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600">Khám phá ngay</a>
          </section>
          <section id="features" style="margin-bottom: 32px">
            <h2 style="font-size: 24px; color: #0f172a">Điểm nổi bật</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px">
              <article style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px"><h3 style="color: #1e293b; margin-top: 0">Thông tin rõ ràng</h3><p style="color: #64748b; line-height: 1.6">Trình bày những điều người dùng cần biết theo cách dễ đọc và dễ tìm.</p></article>
              <article style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px"><h3 style="color: #1e293b; margin-top: 0">Trải nghiệm thuận tiện</h3><p style="color: #64748b; line-height: 1.6">Sắp xếp nội dung mạch lạc để người dùng nhanh chóng tìm thấy điều họ cần.</p></article>
              <article style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px"><h3 style="color: #1e293b; margin-top: 0">Luôn đồng hành</h3><p style="color: #64748b; line-height: 1.6">Tạo điểm kết nối để người dùng dễ dàng tìm hiểu thêm và liên hệ với bạn.</p></article>
            </div>
          </section>
          <section id="contact" style="border-radius: 12px; padding: 28px; background: #f1f5f9">
            <h2 style="color: #0f172a; margin-top: 0">Bạn muốn tìm hiểu thêm?</h2>
            <p style="color: #475569; line-height: 1.6">Khám phá thêm nội dung trên trang hoặc liên hệ với chúng tôi để được hỗ trợ.</p>
            <a href="#features" style="color: #2563eb; font-weight: 600">Xem các mục nổi bật</a>
          </section>
        </div>
      </main>

      <footer style="background: #ffffff; border-top: 1px solid #e2e8f0; padding: 24px; text-align: center; color: #64748b; font-size: 14px">
        <div style="max-width: 1200px; margin: 0 auto; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px">
          <p style="margin: 0">&copy; 2026 PixelMind. Tất cả quyền được bảo lưu.</p>
          <div style="display: flex; gap: 16px">
            <a href="#" style="color: #64748b; text-decoration: none">Chính sách bảo mật</a>
            <a href="#" style="color: #64748b; text-decoration: none">Điều khoản dịch vụ</a>
            <a href="#" style="color: #64748b; text-decoration: none">Trợ giúp</a>
          </div>
        </div>
      </footer>
    </div>
  </body>
</html>
`
  }

  if (kind === 'razor') {
    return `@{
    ViewData["Title"] = ${jsTitle};
}

<div style="min-height: 100vh; display: flex; flex-direction: column; font-family: system-ui, -apple-system, sans-serif; color: #1e293b; background-color: #f8fafc">
    <header style="background: #ffffff; border-bottom: 1px solid #e2e8f0; padding: 16px 24px">
        <div style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between">
            <a href="/" style="font-weight: 700; font-size: 18px; color: #0f172a; text-decoration: none; display: flex; align-items: center; gap: 8px">
                <span>🌐</span> PixelMind
            </a>
            <nav style="display: flex; gap: 20px; align-items: center">
                <a href="/" style="color: #64748b; text-decoration: none; font-size: 14px; font-weight: 500">Trang chủ</a>
                <a href="#" style="color: #2563eb; text-decoration: none; font-size: 14px; font-weight: 600">@ViewData["Title"]</a>
                <a href="#about" style="color: #64748b; text-decoration: none; font-size: 14px; font-weight: 500">Giới thiệu</a>
                <a href="#contact" style="color: #64748b; text-decoration: none; font-size: 14px; font-weight: 500">Liên hệ</a>
            </nav>
        </div>
    </header>

    <main style="flex: 1; max-width: 1200px; width: 100%; margin: 0 auto; padding: 40px 24px">
        <div style="background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05)">
            <h1 style="font-size: 28px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 8px">@ViewData["Title"]</h1>
            <p style="color: #64748b; font-size: 15px; margin-bottom: 24px">Trang <code>${htmlRoute}</code> được tạo bởi PixelMind.</p>
            <section style="border-radius: 12px; padding: 48px 32px; background: linear-gradient(135deg, #eff6ff, #f5f3ff); margin-bottom: 32px">
                <p style="color: #2563eb; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase">Khám phá nội dung</p>
                <h2 style="font-size: 32px; color: #0f172a; margin: 12px 0">Chào mừng đến với @ViewData["Title"]</h2>
                <p style="max-width: 640px; color: #475569; font-size: 16px; line-height: 1.7">Tìm hiểu những thông tin hữu ích, khám phá các điểm nổi bật và bắt đầu trải nghiệm ngay hôm nay.</p>
                <a href="#features" style="display: inline-block; margin-top: 12px; padding: 12px 20px; border-radius: 8px; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600">Khám phá ngay</a>
            </section>
            <section id="features" style="margin-bottom: 32px">
                <h2 style="font-size: 24px; color: #0f172a">Điểm nổi bật</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px">
                    <article style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px"><h3 style="color: #1e293b; margin-top: 0">Thông tin rõ ràng</h3><p style="color: #64748b; line-height: 1.6">Trình bày những điều người dùng cần biết theo cách dễ đọc và dễ tìm.</p></article>
                    <article style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px"><h3 style="color: #1e293b; margin-top: 0">Trải nghiệm thuận tiện</h3><p style="color: #64748b; line-height: 1.6">Sắp xếp nội dung mạch lạc để người dùng nhanh chóng tìm thấy điều họ cần.</p></article>
                    <article style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px"><h3 style="color: #1e293b; margin-top: 0">Luôn đồng hành</h3><p style="color: #64748b; line-height: 1.6">Tạo điểm kết nối để người dùng dễ dàng tìm hiểu thêm và liên hệ với bạn.</p></article>
                </div>
            </section>
            <section id="contact" style="border-radius: 12px; padding: 28px; background: #f1f5f9">
                <h2 style="color: #0f172a; margin-top: 0">Bạn muốn tìm hiểu thêm?</h2>
                <p style="color: #475569; line-height: 1.6">Khám phá thêm nội dung trên trang hoặc liên hệ với chúng tôi để được hỗ trợ.</p>
                <a href="#features" style="color: #2563eb; font-weight: 600">Xem các mục nổi bật</a>
            </section>
        </div>
    </main>

    <footer style="background: #ffffff; border-top: 1px solid #e2e8f0; padding: 24px; text-align: center; color: #64748b; font-size: 14px">
        <div style="max-width: 1200px; margin: 0 auto; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px">
            <p style="margin: 0">&copy; 2026 PixelMind. Tất cả quyền được bảo lưu.</p>
            <div style="display: flex; gap: 16px">
                <a href="#" style="color: #64748b; text-decoration: none">Chính sách bảo mật</a>
                <a href="#" style="color: #64748b; text-decoration: none">Điều khoản dịch vụ</a>
                <a href="#" style="color: #64748b; text-decoration: none">Trợ giúp</a>
            </div>
        </div>
    </footer>
</div>
`
  }

  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${htmlTitle}</title>
  </head>
  <body style="margin: 0; padding: 0;">
    <div style="min-height: 100vh; display: flex; flex-direction: column; font-family: system-ui, -apple-system, sans-serif; color: #1e293b; background-color: #f8fafc">
      <header style="background: #ffffff; border-bottom: 1px solid #e2e8f0; padding: 16px 24px">
        <div style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between">
          <a href="/" style="font-weight: 700; font-size: 18px; color: #0f172a; text-decoration: none; display: flex; align-items: center; gap: 8px">
            <span>🌐</span> PixelMind
          </a>
          <nav style="display: flex; gap: 20px; align-items: center">
            <a href="/" style="color: #64748b; text-decoration: none; font-size: 14px; font-weight: 500">Trang chủ</a>
            <a href="#" style="color: #2563eb; text-decoration: none; font-size: 14px; font-weight: 600">${htmlTitle}</a>
            <a href="#about" style="color: #64748b; text-decoration: none; font-size: 14px; font-weight: 500">Giới thiệu</a>
            <a href="#contact" style="color: #64748b; text-decoration: none; font-size: 14px; font-weight: 500">Liên hệ</a>
          </nav>
        </div>
      </header>

      <main style="flex: 1; max-width: 1200px; width: 100%; margin: 0 auto; padding: 40px 24px">
        <div style="background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05)">
          <h1 style="font-size: 28px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 8px">${htmlTitle}</h1>
          <p style="color: #64748b; font-size: 15px; margin-bottom: 24px">Trang <code>${htmlRoute}</code> được tạo bởi PixelMind.</p>
          <section style="border-radius: 12px; padding: 48px 32px; background: linear-gradient(135deg, #eff6ff, #f5f3ff); margin-bottom: 32px">
            <p style="color: #2563eb; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase">Khám phá nội dung</p>
            <h2 style="font-size: 32px; color: #0f172a; margin: 12px 0">${htmlTitle}</h2>
            <p style="max-width: 640px; color: #475569; font-size: 16px; line-height: 1.7">Tìm hiểu những thông tin hữu ích, khám phá các điểm nổi bật và bắt đầu trải nghiệm ngay hôm nay.</p>
            <a href="#features" style="display: inline-block; margin-top: 12px; padding: 12px 20px; border-radius: 8px; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600">Khám phá ngay</a>
          </section>
          <section id="features" style="margin-bottom: 32px">
            <h2 style="font-size: 24px; color: #0f172a">Điểm nổi bật</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px">
              <article style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px"><h3 style="color: #1e293b; margin-top: 0">Thông tin rõ ràng</h3><p style="color: #64748b; line-height: 1.6">Trình bày những điều người dùng cần biết theo cách dễ đọc và dễ tìm.</p></article>
              <article style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px"><h3 style="color: #1e293b; margin-top: 0">Trải nghiệm thuận tiện</h3><p style="color: #64748b; line-height: 1.6">Sắp xếp nội dung mạch lạc để người dùng nhanh chóng tìm thấy điều họ cần.</p></article>
              <article style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px"><h3 style="color: #1e293b; margin-top: 0">Luôn đồng hành</h3><p style="color: #64748b; line-height: 1.6">Tạo điểm kết nối để người dùng dễ dàng tìm hiểu thêm và liên hệ với bạn.</p></article>
            </div>
          </section>
          <section id="contact" style="border-radius: 12px; padding: 28px; background: #f1f5f9">
            <h2 style="color: #0f172a; margin-top: 0">Bạn muốn tìm hiểu thêm?</h2>
            <p style="color: #475569; line-height: 1.6">Khám phá thêm nội dung trên trang hoặc liên hệ với chúng tôi để được hỗ trợ.</p>
            <a href="#features" style="color: #2563eb; font-weight: 600">Xem các mục nổi bật</a>
          </section>
        </div>
      </main>

      <footer style="background: #ffffff; border-top: 1px solid #e2e8f0; padding: 24px; text-align: center; color: #64748b; font-size: 14px">
        <div style="max-width: 1200px; margin: 0 auto; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px">
          <p style="margin: 0">&copy; 2026 PixelMind. Tất cả quyền được bảo lưu.</p>
          <div style="display: flex; gap: 16px">
            <a href="#" style="color: #64748b; text-decoration: none">Chính sách bảo mật</a>
            <a href="#" style="color: #64748b; text-decoration: none">Điều khoản dịch vụ</a>
            <a href="#" style="color: #64748b; text-decoration: none">Trợ giúp</a>
          </div>
        </div>
      </footer>
    </div>
  </body>
</html>
`
}

export async function scaffoldPageFile(
  target: PageFileTarget,
  title: string,
): Promise<{ relativePath: string }> {
  if (!target.supported || target.kind === 'unsupported') {
    throw new Error(target.reason ?? 'Không hỗ trợ tạo tệp route cho trang này.')
  }
  if (target.exists) {
    throw new Error(`Tệp ${target.relativePath} đã tồn tại.`)
  }
  await fs.mkdir(dirname(target.absolutePath), { recursive: true })
  await fs.writeFile(target.absolutePath, buildTemplate(target.kind, title, target.route), {
    encoding: 'utf8',
    flag: 'wx',
  })

  return { relativePath: target.relativePath }
}

function assertInsideProject(projectPath: string, relativePath: string): string {
  const root = rootOf(projectPath)
  const absolute = resolve(root, relativePath)
  if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) {
    throw new Error('Đường dẫn tệp nằm ngoài thư mục dự án.')
  }
  return absolute
}

export async function copyPageFile(
  projectPath: string,
  sourceRelativePath: string,
  target: PageFileTarget,
): Promise<{ relativePath: string }> {
  if (!target.supported || target.kind === 'unsupported') {
    throw new Error(target.reason ?? 'Không hỗ trợ tạo tệp route cho trang này.')
  }
  if (target.exists) {
    throw new Error(`Tệp ${target.relativePath} đã tồn tại.`)
  }
  const source = assertInsideProject(projectPath, sourceRelativePath)
  if (!(await fileExists(source))) {
    throw new Error(`Không tìm thấy tệp nguồn ${sourceRelativePath}.`)
  }
  await fs.mkdir(dirname(target.absolutePath), { recursive: true })
  await fs.copyFile(source, target.absolutePath, fsConstants.COPYFILE_EXCL)
  return { relativePath: target.relativePath }
}

const PROTECTED_PARENT_DIRS = new Set([
  'app',
  'src',
  'src/app',
  'pages',
  'src/pages',
  'routes',
  'src/routes',
  'resources',
  'resources/views',
  'templates',
  'public',
  'wwwroot',
])

async function cleanupEmptyParents(projectPath: string, relativeFilePath: string): Promise<void> {
  const root = rootOf(projectPath)
  let parentRel = dirname(relativeFilePath).replace(/\\/g, '/')

  while (parentRel && parentRel !== '.' && parentRel !== '/') {
    if (PROTECTED_PARENT_DIRS.has(parentRel.toLowerCase())) break

    const absParent = join(root, ...parentRel.split('/'))
    try {
      const items = await fs.readdir(absParent)
      if (items.length === 0) {
        await fs.rmdir(absParent)
        parentRel = dirname(parentRel).replace(/\\/g, '/')
      } else {
        break
      }
    } catch {
      break
    }
  }
}

export async function trashPageFile(projectPath: string, relativePath: string): Promise<boolean> {
  const absolute = assertInsideProject(projectPath, relativePath)
  if (!(await fileExists(absolute))) return false
  const electron = await import('electron')
  const shell = (electron as unknown as { shell?: { trashItem: (path: string) => Promise<void> } }).shell
  if (shell?.trashItem) {
    await shell.trashItem(absolute)
  } else {
    await fs.unlink(absolute)
  }
  await cleanupEmptyParents(projectPath, relativePath)
  return true
}
