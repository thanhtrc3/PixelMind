import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runToolboxMutation } from '../electron/main/toolbox.ts'
import { pageFileForRoute } from '../src/lib/toolboxBridge.ts'
import { buildSelectorMatcher, enclosingHtml, extractMatchedRules } from '../src/lib/partCapture.ts'

const pageTemplate = (title) => `<!doctype html>
<html lang="vi">
  <head><title>${title}</title></head>
  <body>
    <main><h1>${title}</h1></main>
  </body>
</html>
`

async function makeProject() {
  const dir = await fs.mkdtemp(join(tmpdir(), 'pm-insert-'))
  await fs.mkdir(join(dir, 'about'), { recursive: true })
  await fs.writeFile(join(dir, 'index.html'), pageTemplate('Trang chủ'), 'utf8')
  await fs.writeFile(join(dir, 'about', 'index.html'), pageTemplate('Giới thiệu'), 'utf8')
  return dir
}

test('chèn part vào trang mới ghi đúng tệp trang đó, kèm HTML + CSS + JS', async () => {
  const projectPath = await makeProject()
  const pageFile = join(projectPath, 'about', 'index.html')

  const result = await runToolboxMutation({
    kind: 'insert',
    projectPath,
    target: { uid: 'pm_body', placement: 'inside', currentPath: '/about', fullPath: pageFile },
    html: '<div class="pm-card">Xin chào</div>',
    css: '.pm-card{color:red}',
    js: 'console.log("card")',
    dryRun: false,
  })

  assert.equal(result.success, true)
  assert.equal(result.filePath, 'about/index.html')

  const written = await fs.readFile(pageFile, 'utf8')
  assert.ok(written.includes('class="pm-card"'), 'HTML phải nằm trong trang mới')
  assert.ok(written.includes('<style data-pm-toolbox>'), 'CSS phải nằm trong trang mới')
  assert.ok(written.includes('.pm-card{color:red}'), 'Nội dung CSS phải được giữ nguyên')
  assert.ok(written.includes('<script data-pm-toolbox>'), 'JS phải nằm trong trang mới')

  const home = await fs.readFile(join(projectPath, 'index.html'), 'utf8')
  assert.ok(!home.includes('pm-card'), 'Không được ghi part sang trang chủ')
})

test('chèn part vào trang mới chỉ có route (không có fullPath) vẫn đúng trang', async () => {
  const projectPath = await makeProject()

  const htmlResult = await runToolboxMutation({
    kind: 'insert',
    projectPath,
    target: { uid: 'pm_body', placement: 'inside', currentPath: '/about' },
    html: '<div class="pm-route-card">Theo route</div>',
    css: '.pm-route-card{margin:0}',
    dryRun: false,
  })
  assert.equal(htmlResult.filePath, 'about/index.html')
  assert.ok((await fs.readFile(join(projectPath, 'about', 'index.html'), 'utf8')).includes('pm-route-card'))

  // Next.js App Router: route /about nằm ở app/about/page.tsx
  const nextPath = await fs.mkdtemp(join(tmpdir(), 'pm-insert-next-'))
  await fs.mkdir(join(nextPath, 'app', 'about'), { recursive: true })
  await fs.writeFile(
    join(nextPath, 'package.json'),
    JSON.stringify({ dependencies: { next: '15.0.0' } }),
    'utf8',
  )
  const tsx = (title) => `export default function Page() {\n  return (\n    <main>\n      <h1>${title}</h1>\n    </main>\n  )\n}\n`
  await fs.writeFile(join(nextPath, 'app', 'page.tsx'), tsx('Trang chủ'), 'utf8')
  await fs.writeFile(join(nextPath, 'app', 'about', 'page.tsx'), tsx('Giới thiệu'), 'utf8')

  const nextResult = await runToolboxMutation({
    kind: 'insert',
    projectPath: nextPath,
    target: { uid: 'pm_body', placement: 'inside', currentPath: '/about' },
    html: '<div class="pm-next-card">Next</div>',
    css: '.pm-next-card{color:blue}',
    dryRun: false,
  })
  assert.equal(nextResult.filePath, 'app/about/page.tsx')
  const aboutPage = await fs.readFile(join(nextPath, 'app', 'about', 'page.tsx'), 'utf8')
  assert.ok(aboutPage.includes('className="pm-next-card"'))
  assert.ok(aboutPage.includes('.pm-next-card{color:blue}'))
  assert.ok(!(await fs.readFile(join(nextPath, 'app', 'page.tsx'), 'utf8')).includes('pm-next-card'))
})

test('pageFileForRoute khớp route của trang đang mở', () => {
  const pages = [
    { id: '1', route: '/', title: 'Trang chủ', filePath: 'index.html' },
    { id: '2', route: '/about', title: 'Giới thiệu', filePath: 'about/index.html' },
    { id: '3', route: '/lien-he', title: 'Liên hệ' },
  ]
  assert.equal(pageFileForRoute(pages, '/about'), 'about/index.html')
  assert.equal(pageFileForRoute(pages, '/about/?preview=true'), 'about/index.html')
  assert.equal(pageFileForRoute(pages, '/ABOUT'), 'about/index.html')
  assert.equal(pageFileForRoute(pages, '/lien-he'), '', 'trang chỉ có metadata thì không có tệp')
  assert.equal(pageFileForRoute(pages, '/khong-ton-tai'), '')
  assert.equal(pageFileForRoute(undefined, '/'), '')
})

test('trang không có tệp nguồn thì báo lỗi, không chèn bừa sang trang/layout khác', async () => {
  const dir = await fs.mkdtemp(join(tmpdir(), 'pm-insert-razor-'))
  await fs.mkdir(join(dir, 'Views', 'Home'), { recursive: true })
  await fs.mkdir(join(dir, 'Views', 'Shared'), { recursive: true })
  const home = join(dir, 'Views', 'Home', 'Index.cshtml')
  const layout = join(dir, 'Views', 'Shared', '_Layout.cshtml')
  await fs.writeFile(home, '<main><h1>Trang chủ</h1></main>\n', 'utf8')
  await fs.writeFile(layout, '<html><body>@RenderBody()</body></html>\n', 'utf8')

  const result = await runToolboxMutation({
    kind: 'insert',
    projectPath: dir,
    target: { uid: 'pm_body', placement: 'inside', currentPath: '/Home/test' },
    html: '<div class="pm-card">Part</div>',
    css: '.pm-card{color:red}',
    dryRun: false,
  })

  assert.equal(result.success, false)
  assert.match(result.error, /chưa có tệp/)
  assert.ok(!(await fs.readFile(home, 'utf8')).includes('pm-card'), 'không được ghi vào trang chủ')
  assert.ok(!(await fs.readFile(layout, 'utf8')).includes('pm-card'), 'không được ghi vào layout')
})

test('không chèn part vào view dùng chung (_Layout) khi không khớp phần tử', async () => {
  const dir = await fs.mkdtemp(join(tmpdir(), 'pm-insert-layout-'))
  await fs.mkdir(join(dir, 'Views', 'Shared'), { recursive: true })
  const layout = join(dir, 'Views', 'Shared', '_Layout.cshtml')
  await fs.writeFile(layout, '<html><body>@RenderBody()</body></html>\n', 'utf8')

  const result = await runToolboxMutation({
    kind: 'insert',
    projectPath: dir,
    target: { uid: 'pm_body', placement: 'inside', currentPath: '/Account', fullPath: layout },
    html: '<div class="pm-card">Part</div>',
    dryRun: false,
  })

  assert.equal(result.success, false)
  assert.ok(!(await fs.readFile(layout, 'utf8')).includes('pm-card'))
})

test('buildSelectorMatcher khớp trọn token, tránh Bootstrap chiếm hết CSS của part', () => {
  const hit = buildSelectorMatcher(new Set(['btn', 'auth-card']), new Set(['auth-title']))
  assert.equal(hit('.btn'), true)
  assert.equal(hit('.btn:hover'), true)
  assert.equal(hit('.btn-primary'), false, '.btn không được khớp .btn-primary')
  assert.equal(hit('.auth-card h2'), true)
  assert.equal(hit('.btn-group > .btn'), true)
  assert.equal(hit('#auth-title'), true)
  assert.equal(hit('h2'), false)
  assert.equal(hit(':root'), true, 'biến CSS của design token phải được giữ')
})

test('extractMatchedRules giữ :root design token đứng sau @import', () => {
  // site.css bắt đầu bằng 2 @import; nếu không lọc, `@import ...;` dính vào selector `:root`
  // và mất biến --gold/--ink khiến part không style được.
  const css = `@import './variables.css';
@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap');
@import url("https://fonts.example.com/x.css?v=1;2");

/* comment */
:root {
  --gold: #e6bd75;
  --ink: #f7f2e8;
}
.auth-card { color: var(--ink); }
.unrelated { color: red; }
`
  const hit = buildSelectorMatcher(new Set(['auth-card']), new Set())
  const rules = extractMatchedRules(css, hit)
  assert.ok(rules.some((rule) => rule.startsWith(':root {')), ':root phải được giữ')
  assert.ok(rules.some((rule) => rule.startsWith('.auth-card {')), 'rule của part phải được giữ')
  assert.ok(!rules.some((rule) => rule.includes('.unrelated')), 'rule không liên quan phải bị bỏ')
})

test('enclosingHtml giữ tổ tiên chung để CSS phụ thuộc ancestor còn khớp', () => {
  const doc = { body: null, documentElement: null }
  const el = (tag, children = []) => {
    const node = {
      nodeType: 1,
      tag,
      children: [],
      parentElement: null,
      ownerDocument: doc,
      get childNodes() {
        return node.children
      },
      appendChild(child) {
        child.parentElement = node
        node.children.push(child)
        return child
      },
      contains(other) {
        return other === node || node.children.some((child) => child.contains?.(other))
      },
      cloneNode(deep) {
        const copy = el(tag)
        if (deep) for (const child of node.children) copy.appendChild(child.cloneNode(true))
        return copy
      },
      get outerHTML() {
        return `<${tag}>${node.children.map((child) => child.outerHTML).join('')}</${tag}>`
      },
    }
    for (const child of children) node.appendChild(child)
    return node
  }

  const heading = el('div')
  const title = el('h2')
  const subtitle = el('p')
  heading.appendChild(title)
  heading.appendChild(subtitle)
  const form = el('form')
  const label = el('label')
  const input = el('input')
  form.appendChild(label)
  form.appendChild(input)
  const card = el('section', [heading, form])
  doc.body = el('body', [card])
  doc.documentElement = el('html', [doc.body])

  const html = enclosingHtml([title, label, input])
  assert.ok(html.startsWith('<section>'), 'phải giữ wrapper .auth-card/section')
  assert.ok(html.includes('<h2></h2>'), 'phải giữ phần tử được chọn')
  assert.ok(html.includes('<form><label></label><input></input></form>'), 'phải giữ chuỗi tổ tiên của vùng chọn')
  assert.ok(!html.includes('<p>'), 'không kéo theo phần tử không được chọn')

  assert.equal(enclosingHtml([title]), '', 'một phần tử thì giữ nguyên outerHTML như cũ')

  const outside = el('footer')
  doc.body.appendChild(outside)
  assert.equal(enclosingHtml([title, outside]), '', 'tổ tiên chung là body thì không bọc')
})

test('reparent khớp đúng thẻ anh em trong <nav> (không bắt nhầm <a> đứng trước nó) và gỡ offset kéo tự do', async () => {
  const dir = await fs.mkdtemp(join(tmpdir(), 'pm-reparent-nav-'))
  await fs.mkdir(join(dir, 'Views', 'Shared'), { recursive: true })
  const layout = join(dir, 'Views', 'Shared', '_Layout.cshtml')
  await fs.writeFile(
    layout,
    [
      '<header class="topbar">',
      '  <div class="topbar-in">',
      '    <a class="logo" href="/">PixelShop</a>',
      '    <a style="position: relative; left: 48px; top: 2px;" href="/">Trang chủ</a>',
      '    <nav>',
      '      <a href="/Product">Kho hàng</a>',
      '    </nav>',
      '  </div>',
      '</header>',
      '',
    ].join('\n'),
    'utf8',
  )

  const result = await runToolboxMutation({
    kind: 'reparent',
    projectPath: dir,
    target: { tagName: 'a', textSnippet: 'Trang chủ', fullPath: layout },
    targetParent: { tagName: 'nav', textSnippet: 'Trang chủ Kho hàng' },
    targetSibling: { tagName: 'a', textSnippet: 'Kho hàng' },
    placement: 'before',
    dryRun: false,
  })

  assert.equal(result.success, true)
  const updated = await fs.readFile(layout, 'utf8')
  const navMatch = updated.match(/<nav>([\s\S]*?)<\/nav>/)
  assert.ok(navMatch, 'phải giữ thẻ <nav>')
  assert.ok(navMatch[1].includes('Trang chủ'), 'Trang chủ phải nằm bên trong <nav>')
  assert.ok(navMatch[1].indexOf('Trang chủ') < navMatch[1].indexOf('Kho hàng'), 'Trang chủ phải đứng trước Kho hàng trong <nav>')
  assert.ok(!navMatch[1].includes('left: 48px'), 'phải gỡ tọa độ kéo tự do cũ khi đổi khung cha')
})

test('delete và delete-batch tuyệt đối không được xoá vùng <main>@RenderBody()</main> trong _Layout.cshtml', async () => {
  const dir = await fs.mkdtemp(join(tmpdir(), 'pm-protect-renderbody-'))
  await fs.mkdir(join(dir, 'Views', 'Shared'), { recursive: true })
  const layout = join(dir, 'Views', 'Shared', '_Layout.cshtml')
  const original = [
    '<body>',
    '  <header>Header</header>',
    '  <main>',
    '    @RenderBody()',
    '  </main>',
    '  <footer>Footer</footer>',
    '</body>',
    '',
  ].join('\n')
  await fs.writeFile(layout, original, 'utf8')

  const resSingle = await runToolboxMutation({
    kind: 'delete',
    projectPath: dir,
    target: { tagName: 'main', fullPath: layout, lineNumber: 3 },
    dryRun: false,
  })
  assert.equal(resSingle.success, false)

  const resBatch = await runToolboxMutation({
    kind: 'delete-batch',
    projectPath: dir,
    targets: [{ tagName: 'main', fullPath: layout, lineNumber: 3 }],
    dryRun: false,
  })
  assert.equal(resBatch.success, false)
  assert.equal(await fs.readFile(layout, 'utf8'), original, 'phải giữ nguyên @RenderBody()')
})
