/* E2E D1-19: dựng 2 trang preview thật trong app, quét axe thật qua IPC. */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'

const results = []
const check = (name, cond, extra = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : ` — ${extra}`}`)
  console.log(results.at(-1))
}

const BAD = `<!doctype html><html lang="vi"><head><title>bad</title></head><body><main>
<h1>Trang lỗi</h1>
<img src="x.png">
<img src="y.png">
<button><svg width="10" height="10"></svg></button>
<input type="text">
</main></body></html>`
const GOOD = `<!doctype html><html lang="vi"><head><title>ok</title></head><body><main>
<h1>Trang tốt</h1>
<img src="x.png" alt="mô tả">
<button aria-label="Đóng">X</button>
<label>Email <input type="email"></label>
</main></body></html>`

const mk = (html) =>
  new Promise((resolve) => {
    const s = createServer((_q, r) => r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html))
    s.listen(0, '127.0.0.1', () => resolve({ s, port: s.address().port }))
  })
const bad = await mk(BAD)
const good = await mk(GOOD)
const badUrl = `http://127.0.0.1:${bad.port}/`
const goodUrl = `http://127.0.0.1:${good.port}/`

const browser = await chromium.connectOverCDP('http://127.0.0.1:9229')
const page = browser.contexts()[0].pages()[0]
const axe = await readFile('node_modules/axe-core/axe.min.js', 'utf8')

// Nhúng 2 iframe preview vào DOM của app (app bật webSecurity:false nên tải được)
await page.evaluate(({ badUrl, goodUrl }) => {
  for (const [id, url] of [['bad', badUrl], ['good', goodUrl]]) {
    const f = document.createElement('iframe')
    f.id = `probe-${id}`
    f.src = url
    f.style.cssText = 'position:fixed;left:-9999px;width:400px;height:300px'
    document.body.appendChild(f)
  }
}, { badUrl, goodUrl })
await new Promise((r) => setTimeout(r, 2500))

const scan = (url) => page.evaluate(({ src, url }) => window.pixelmind.a11y.scan({ axeSource: src, previewUrl: url }), { src: axe, url })

const badScan = await scan(badUrl)
check('trang lỗi: ok=true', badScan.ok === true, JSON.stringify(badScan).slice(0, 200))
check('trang lỗi: phát hiện >= 2 vi phạm', badScan.total >= 2, `total=${badScan.total}`)
const withNodes = (badScan.violations ?? []).filter((v) => (v.nodes ?? []).length > 0)
check('vi phạm có selector', withNodes.length > 0 && !!withNodes[0].nodes[0].selector, JSON.stringify(withNodes[0] ?? {}).slice(0, 200))
check('vi phạm có nhóm impact + hướng dẫn', (badScan.violations ?? []).every((v) => v.impact && v.help), JSON.stringify((badScan.violations ?? [])[0] ?? {}).slice(0, 200))
console.log('  impact counts:', JSON.stringify(badScan.counts), 'total', badScan.total)

const goodScan = await scan(goodUrl)
check('trang tốt: ok=true', goodScan.ok === true, JSON.stringify(goodScan).slice(0, 200))
check('trang tốt: 0 vi phạm', goodScan.total === 0, JSON.stringify(goodScan.violations).slice(0, 200))

// previewUrl không khớp frame nào → theo thiết kế: quét frame http đầu tiên (có test đơn vị)
const missing = await scan('http://127.0.0.1:1/khong-co')
check('previewUrl lạc: fallback frame http đầu tiên (hành vi đã thiết kế)', missing.ok === true && !!missing.frameUrl, JSON.stringify(missing).slice(0, 160))
check('previewUrl đúng: quét đúng frame (good ≠ bad)', goodScan.frameUrl === goodUrl && badScan.frameUrl === badUrl, `${goodScan.frameUrl} / ${badScan.frameUrl}`)

// Quét lại lần 2 không nhân đôi kết quả
const again = await scan(badUrl)
check('quét lại: cùng total, không cộng dồn', again.total === badScan.total, `${badScan.total} → ${again.total}`)

await page.evaluate(() => document.querySelectorAll('iframe[id^="probe-"]').forEach((f) => f.remove()))
bad.s.close()
good.s.close()
await browser.close()
const failed = results.filter((r) => r.startsWith('FAIL'))
console.log(failed.length ? `\n${failed.length} FAIL` : '\nTẤT CẢ A11Y E2E PASS')
process.exit(failed.length ? 1 : 0)
