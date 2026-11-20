/* E2E D1-28: gọi inspect.syncCode thật qua IPC, ghi file thật trong thư mục tạm. */
import { chromium } from 'playwright'
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const results = []
const check = (name, cond, extra = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : ` — ${extra}`}`)
  console.log(results.at(-1))
}

const root = join(await mkdtemp(join(tmpdir(), 'pm-sync-')), 'proj')
await mkdir(join(root, 'src'), { recursive: true })
const setPkg = (v) => writeFile(join(root, 'package.json'), JSON.stringify(v ? { dependencies: { tailwindcss: v } } : {}, null, 2))

const browser = await chromium.connectOverCDP('http://127.0.0.1:9229')
const page = browser.contexts()[0].pages()[0]
const sync = (payload) => page.evaluate((p) => window.pixelmind.inspect.syncCode(p), payload)

// A. JSX + Tailwind v3: class thay thế, không cộng dồn
await setPkg('^3.4.0')
const jsx = join(root, 'src', 'App.tsx')
const jsxSrc = `export default function App() {\n  return <div className="p-4 text-sm">Nội dung</div>\n}\n`
await writeFile(jsx, jsxSrc)
const a = await sync({ fullPath: jsx, projectPath: root, tagName: 'div', lineNumber: 2, styles: { padding: '8px', backgroundColor: '#ef4444' }, styleMode: 'auto' })
check('A1 sync thành công', a.success === true, JSON.stringify(a))
check('A2 mode=tailwind, version=v3', a.mode === 'tailwind' && a.tailwindVersion === 'v3', JSON.stringify(a))
const afterA = await readFile(jsx, 'utf8')
check('A3 có p-2 và không còn p-4', /p-2/.test(afterA) && !/p-4/.test(afterA), afterA.trim())
check('A4 không cộng dồn class', !/p-4\s+p-2|p-2\s+p-4/.test(afterA), afterA.trim())
check('A5 có class màu nền', /bg-/.test(afterA), afterA.match(/className="([^"]*)"/)?.[1] ?? '')
check('A6 xoá padding khỏi style', !/padding/.test(afterA), afterA.trim())

// B. Lưu lần 2 (y hệt) → file không đổi
const b = await sync({ fullPath: jsx, projectPath: root, tagName: 'div', lineNumber: 2, styles: { padding: '8px', backgroundColor: '#ef4444' }, styleMode: 'auto' })
const afterB = await readFile(jsx, 'utf8')
check('B1 lưu lần 2 thành công', b.success === true, JSON.stringify(b))
check('B2 file không đổi byte nào (idempotent)', afterA === afterB, 'file bị sửa')

// C. Chế độ inline: không sinh class
const inlineFile = join(root, 'src', 'Inline.tsx')
await writeFile(inlineFile, `export default function I() {\n  return <div className="p-4">x</div>\n}\n`)
const c = await sync({ fullPath: inlineFile, projectPath: root, tagName: 'div', lineNumber: 2, styles: { padding: '8px' }, styleMode: 'inline' })
const afterC = await readFile(inlineFile, 'utf8')
check('C1 mode=inline', c.success === true && c.mode === 'inline', JSON.stringify(c))
check('C2 giữ nguyên p-4, chỉ thêm style', /p-4/.test(afterC) && /padding/.test(afterC), afterC.trim())

// D. HTML: residual dùng kebab-case
const html = join(root, 'src', 'page.html')
await writeFile(html, `<div class="p-4">x</div>\n`)
const d = await sync({ fullPath: html, projectPath: root, tagName: 'div', lineNumber: 1, styles: { padding: '8px', writingMode: 'vertical-rl' }, styleMode: 'auto' })
const afterD = await readFile(html, 'utf8')
check('D1 HTML: chuyển được padding thành class', d.success === true && /p-2/.test(afterD), afterD.trim())
check('D2 HTML: residual dùng writing-mode (kebab)', /writing-mode:\s*vertical-rl/.test(afterD) && !/writingMode/.test(afterD), afterD.trim())

// E. className động → từ chối an toàn, không sửa file
const dyn = join(root, 'src', 'Dyn.tsx')
const dynSrc = `export default function D({ on }) {\n  return <div className={on ? 'a' : 'b'}>x</div>\n}\n`
await writeFile(dyn, dynSrc)
const e = await sync({ fullPath: dyn, projectPath: root, tagName: 'div', lineNumber: 2, styles: { padding: '8px' }, styleMode: 'auto' })
const afterE = await readFile(dyn, 'utf8')
check('E1 className động: success=false + lỗi rõ', e.success === false && /className\/style động|động/.test(e.error ?? ''), JSON.stringify(e))
check('E2 file không bị sửa', afterE === dynSrc, 'file bị sửa')

// F. Project v4 → báo v4, không phải v3
await setPkg('^4.0.0')
const v4 = join(root, 'src', 'V4.tsx')
await writeFile(v4, `export default function V() {\n  return <div className="p-4">x</div>\n}\n`)
const f = await sync({ fullPath: v4, projectPath: root, tagName: 'div', lineNumber: 2, styles: { padding: '8px' }, styleMode: 'tailwind' })
check('F1 project v4: tailwindVersion=v4', f.success === true && f.tailwindVersion === 'v4', JSON.stringify(f))

// G. Không tìm được project (file ngoài mọi dự án) → không ghi class, dùng inline
await setPkg('^3.4.0')
const outside = join(tmpdir(), `pm-sync-outside-${Date.now()}`, 'src')
await mkdir(outside, { recursive: true })
const noProj = join(outside, 'NoProj.tsx')
await writeFile(noProj, `export default function N() {\n  return <div>x</div>\n}\n`)
const g = await sync({ fullPath: noProj, tagName: 'div', lineNumber: 2, styles: { padding: '8px' }, styleMode: 'auto' })
const afterG = await readFile(noProj, 'utf8')
check('G1 không tìm được project → dùng inline', g.success === true && g.mode === 'inline' && /padding/.test(afterG), JSON.stringify(g))

// H. Đường dẫn không tồn tại → lỗi, không throw
const h = await sync({ fullPath: join(root, 'src', 'khong-co.tsx'), projectPath: root, tagName: 'div', styles: { padding: '1px' } })
check('H1 file không tồn tại: success=false, có error', h.success === false && !!h.error, JSON.stringify(h))

await browser.close()
const failed = results.filter((r) => r.startsWith('FAIL'))
console.log(failed.length ? `\n${failed.length} FAIL` : '\nTẤT CẢ SYNC E2E PASS')
process.exit(failed.length ? 1 : 0)
