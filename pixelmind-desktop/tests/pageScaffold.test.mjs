import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildTemplate, scaffoldPageFile, trashPageFile } from '../electron/main/pages.ts'

test('buildTemplate produces header, main container, and footer for all template kinds', () => {
  const kinds = ['next-app', 'next-pages', 'vue', 'sveltekit', 'astro', 'html', 'razor']

  for (const kind of kinds) {
    const code = buildTemplate(kind, 'Sản phẩm mới', '/products/new')

    // 1. Phải có thẻ/khung Header
    assert.ok(code.includes('<header'), `${kind} thiếu thẻ <header>`)
    assert.ok(code.includes('PixelMind'), `${kind} thiếu logo / tên PixelMind trong header`)
    assert.ok(code.includes('Trang chủ'), `${kind} thiếu link Trang chủ`)

    // 2. Phải có khung trang chính (main container) & nội dung
    assert.ok(code.includes('<main'), `${kind} thiếu thẻ <main>`)
    assert.ok(code.includes('Sản phẩm mới'), `${kind} thiếu tiêu đề trang`)
    assert.ok(code.includes('/products/new'), `${kind} thiếu route trang`)
    assert.ok(code.includes('id="features"') || code.includes('Điểm nổi bật'), `${kind} thiếu phần nội dung nổi bật`)
    assert.ok(code.includes('Thông tin rõ ràng'), `${kind} thiếu thẻ nội dung thực tế`)
    assert.ok(code.includes('id="contact"') || code.includes('Bạn muốn tìm hiểu thêm?'), `${kind} thiếu phần liên hệ`)

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

test('scaffoldPageFile writes the template file to disk correctly for Next.js', async () => {
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
    assert.ok(content.includes('Điểm nổi bật'))
    assert.ok(content.includes('Thông tin rõ ràng'))
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
})

test('scaffoldPageFile writes Razor view without mutating other project files', async () => {
  const tempDir = await fs.mkdtemp(join(tmpdir(), 'pm-razor-test-'))
  try {
    const viewsDir = join(tempDir, 'Views', 'Home')
    await fs.mkdir(viewsDir, { recursive: true })

    const target = {
      supported: true,
      label: 'ASP.NET Core (Razor)',
      relativePath: 'Views/Home/Test.cshtml',
      exists: false,
      kind: 'razor',
      absolutePath: join(viewsDir, 'Test.cshtml'),
      route: '/Home/Test',
    }

    const result = await scaffoldPageFile(target, 'Test')
    assert.equal(result.relativePath, 'Views/Home/Test.cshtml')

    const viewContent = await fs.readFile(target.absolutePath, 'utf8')
    assert.ok(viewContent.includes('ViewData["Title"] = "Test"'))
    assert.ok(viewContent.includes('<header'))
    assert.ok(viewContent.includes('<footer'))
    assert.ok(viewContent.includes('Điểm nổi bật'))
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
})

test('scaffoldPageFile syncs Razor view with _Layout.cshtml and wires MVC controller action', async () => {
  const tempDir = await fs.mkdtemp(join(tmpdir(), 'pm-razor-mvc-'))
  try {
    await fs.mkdir(join(tempDir, 'Views', 'Shared'), { recursive: true })
    await fs.mkdir(join(tempDir, 'Views', 'Product'), { recursive: true })
    await fs.mkdir(join(tempDir, 'Controllers'), { recursive: true })

    await fs.writeFile(
      join(tempDir, 'Views', 'Shared', '_Layout.cshtml'),
      '<!doctype html><html><head><link rel="stylesheet" href="~/css/site.css" /></head><body><header class="topbar">Shop</header><main>@RenderBody()</main><footer>Shop Footer</footer></body></html>',
      'utf8',
    )
    await fs.writeFile(
      join(tempDir, 'Views', 'Product', 'Index.cshtml'),
      '<div class="grid"><div class="card">Item</div></div>',
      'utf8',
    )
    const controllerPath = join(tempDir, 'Controllers', 'ProductController.cs')
    await fs.writeFile(
      controllerPath,
      'using Microsoft.AspNetCore.Mvc;\nnamespace Shop.Controllers;\npublic class ProductController : Controller\n{\n    public IActionResult Index() => View();\n}\n',
      'utf8',
    )

    const target = {
      supported: true,
      label: 'ASP.NET Core (Razor)',
      relativePath: 'Views/Product/Tesst.cshtml',
      exists: false,
      kind: 'razor',
      absolutePath: join(tempDir, 'Views', 'Product', 'Tesst.cshtml'),
      route: '/Product/tesst',
    }

    await scaffoldPageFile(target, 'tesst')

    const viewContent = await fs.readFile(target.absolutePath, 'utf8')
    assert.ok(viewContent.includes('ViewData["Title"] = "tesst"'))
    assert.ok(!viewContent.includes('PixelMind</a'), 'Không chèn header PixelMind giả khi đã có _Layout.cshtml')
    assert.ok(viewContent.includes('class="grid"'), 'Kế thừa class khung từ trang anh em')

    const controllerContent = await fs.readFile(controllerPath, 'utf8')
    assert.ok(controllerContent.includes('[HttpGet("/Product/tesst")]'))
    assert.ok(controllerContent.includes('public IActionResult PageTesst() => View("Tesst");'))

    await trashPageFile(tempDir, 'Views/Product/Tesst.cshtml')
    const afterTrash = await fs.readFile(controllerPath, 'utf8')
    assert.ok(!afterTrash.includes('PageTesst'), 'Xoá trang phải gỡ action tự tạo khỏi Controller')
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
})

test('scaffoldPageFile syncs HTML page head, header, and footer from index.html', async () => {
  const tempDir = await fs.mkdtemp(join(tmpdir(), 'pm-html-sync-'))
  try {
    await fs.writeFile(
      join(tempDir, 'index.html'),
      '<!doctype html><html><head><meta charset="utf-8" /><link rel="stylesheet" href="css/main.css" /><title>Trang chủ</title></head><body class="theme-shop"><header class="site-hd"><a href="/">MyShop</a></header><main class="site-main">Home</main><footer class="site-ft">Footer MyShop</footer></body></html>',
      'utf8',
    )

    const target = {
      supported: true,
      label: 'HTML tĩnh',
      relativePath: 'about/index.html',
      exists: false,
      kind: 'html',
      absolutePath: join(tempDir, 'about', 'index.html'),
      route: '/about',
    }

    await scaffoldPageFile(target, 'Giới thiệu')

    const html = await fs.readFile(target.absolutePath, 'utf8')
    assert.ok(html.includes('<title>Giới thiệu</title>'))
    assert.ok(html.includes('href="../css/main.css"'), 'Điều chỉnh đường dẫn CSS theo độ sâu thư mục')
    assert.ok(html.includes('<body class="theme-shop">'))
    assert.ok(html.includes('<header class="site-hd"><a href="/">MyShop</a></header>'))
    assert.ok(html.includes('<footer class="site-ft">Footer MyShop</footer>'))
    assert.ok(!html.includes('🌐</span> PixelMind'))
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
})
