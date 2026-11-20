import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildTemplate, scaffoldPageFile } from '../electron/main/pages.ts'

test('buildTemplate produces header, main container, and footer for all template kinds', () => {
  const kinds = ['next-app', 'next-pages', 'vue', 'sveltekit', 'astro', 'html']

  for (const kind of kinds) {
    const code = buildTemplate(kind, 'Sản phẩm mới', '/products/new')

    // 1. Phải có thẻ/khung Header
    assert.ok(code.includes('<header'), `${kind} thiếu thẻ <header>`)
    assert.ok(code.includes('PixelMind'), `${kind} thiếu logo / tên PixelMind trong header`)
    assert.ok(code.includes('Trang chủ'), `${kind} thiếu link Trang chủ`)

    // 2. Phải có khung trang chính (main container)
    assert.ok(code.includes('<main'), `${kind} thiếu thẻ <main>`)
    assert.ok(code.includes('Sản phẩm mới'), `${kind} thiếu tiêu đề trang`)
    assert.ok(code.includes('/products/new'), `${kind} thiếu route trang`)
    assert.ok(code.includes('Khu vực nội dung chính'), `${kind} thiếu khung placeholder nội dung`)

    // 3. Phải có Chân trang (footer)
    assert.ok(code.includes('<footer'), `${kind} thiếu thẻ <footer>`)
    assert.ok(code.includes('Tất cả quyền được bảo lưu'), `${kind} thiếu bản quyền footer`)
    assert.ok(code.includes('Chính sách bảo mật'), `${kind} thiếu link footer`)
  }
})

test('buildTemplate escapes HTML special characters in title and route to prevent XSS', () => {
  const dangerousTitle = '<script>alert("XSS")</script>'
  const dangerousRoute = '/test?a=1&b=<hack>'

  const code = buildTemplate('html', dangerousTitle, dangerousRoute)
  assert.ok(!code.includes('<script>alert("XSS")</script>'))
  assert.ok(code.includes('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'))
  assert.ok(code.includes('&amp;b=&lt;hack&gt;'))
})

test('scaffoldPageFile writes the template file to disk correctly', async () => {
  const tempDir = await fs.mkdtemp(join(tmpdir(), 'pm-scaffold-test-'))
  try {
    const targetPath = join(tempDir, 'src', 'app', 'about', 'page.tsx')
    const target = {
      supported: true,
      label: 'Next.js App Router',
      relativePath: 'src/app/about/page.tsx',
      exists: false,
      kind: 'next-app',
      absolutePath: targetPath,
      route: '/about',
    }

    const result = await scaffoldPageFile(target, 'Giới thiệu công ty')
    assert.equal(result.relativePath, 'src/app/about/page.tsx')

    const content = await fs.readFile(targetPath, 'utf8')
    assert.ok(content.includes('Giới thiệu công ty'))
    assert.ok(content.includes('<header'))
    assert.ok(content.includes('<footer'))
    assert.ok(content.includes('Khu vực nội dung chính'))
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
})
