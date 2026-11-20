/* Kiểm thử giao diện các tính năng D1-19/21/23/24/25/26/28 trên bản web-mock
   (out/renderer + src/lib/mock.ts), không cần Electron.
   Chạy: npm run build && HEADLESS=true node tests/ui-features-check.mjs
   Ảnh chụp lưu ở tests/evidence/ui-*.png */
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { mkdir, readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'

const root = resolve('out/renderer')
const port = 4189
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' }

const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0])
  let target = normalize(join(root, urlPath === '/' ? '/index.html' : urlPath))
  if (!target.startsWith(root + sep)) return res.writeHead(403).end()
  try {
    if ((await stat(target)).isDirectory()) target = join(target, 'index.html')
    res.writeHead(200, { 'Content-Type': MIME[extname(target)] ?? 'application/octet-stream' }).end(await readFile(target))
  } catch {
    res.writeHead(404).end()
  }
})
await new Promise((r) => server.listen(port, r))
await mkdir('tests/evidence', { recursive: true })

const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
const failures = []
const ok = (name) => console.log(`  PASS ${name}`)
const fail = (name, why) => {
  failures.push(`${name}: ${why}`)
  console.log(`  FAIL ${name} — ${why}`)
}
const check = async (name, fn) => {
  try {
    await fn()
    ok(name)
  } catch (error) {
    fail(name, error.message.split('\n')[0])
  }
}

await page.goto(`http://localhost:${port}`)
await page.waitForLoadState('networkidle')
await page.route('http://localhost:5173/**', (route) =>
  route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body><h1>mock</h1></body></html>' }),
)

// Vào màn hình làm việc (giống tests/ui-visual-check.mjs)
const closeBtn = page.locator('.pm-modal__close, button:has-text("Đóng"), button:has-text("Bỏ qua")')
if (await closeBtn.count()) await closeBtn.first().click({ timeout: 1500 }).catch(() => {})
const workspaceBtn = page.locator('button:has-text("Màn hình làm việc"), button:has-text("Làm việc")').first()
if (await workspaceBtn.count()) await workspaceBtn.click({ force: true }).catch(() => {})
await page.waitForTimeout(400)

async function openCommand(term) {
  await page.keyboard.press('Control+K')
  const input = page.locator('.pm-palette__input input')
  await input.waitFor({ timeout: 3000 })
  await input.fill(`> ${term}`)
  await page.waitForTimeout(250)
  const item = page.locator('.pm-palette__item', { hasText: term })
  await (await item.count() ? item.first() : page.locator('.pm-palette__item').first()).click()
  await page.waitForTimeout(350)
}

// D1-19: không quét được thì phải báo, không được nói "0 lỗi"
await check('D1-19 mở dialog + quét báo không có khung xem trước', async () => {
  await openCommand('Kiểm tra trợ năng')
  const modal = page.locator('.pm-modal', { hasText: 'Kiểm tra trợ năng' })
  await modal.waitFor({ timeout: 3000 })
  await modal.locator('button:has-text("Bắt đầu quét")').click()
  await page.waitForTimeout(600)
  const text = await modal.innerText()
  if (!text.includes('không có khung xem trước')) throw new Error(`thiếu câu báo lỗi. Text: ${text.slice(0, 200)}`)
  if (text.includes('Không phát hiện vi phạm')) throw new Error('báo "0 lỗi" dù không quét được')
  await page.screenshot({ path: 'tests/evidence/ui-a11y.png' })
  await modal.locator('button:has-text("Đóng")').click()
})

// D1-21: start/stop phản ánh trạng thái qua mock
await check('D1-21 dialog mock: start → running, stop → idle', async () => {
  await openCommand('Mock API')
  const modal = page.locator('.pm-modal', { hasText: 'Mock API' })
  await modal.waitFor({ timeout: 3000 })
  await modal.locator('button:has-text("Khởi động server")').click()
  await page.waitForTimeout(400)
  const running = await modal.innerText()
  if (!running.includes('127.0.0.1')) throw new Error('không hiện URL sau khi start')
  if (!running.includes('Dừng server')) throw new Error('không có nút Dừng sau khi start')
  await page.screenshot({ path: 'tests/evidence/ui-mock-running.png' })
  await modal.locator('button:has-text("Dừng server")').click()
  await page.waitForTimeout(300)
  const stopped = await modal.innerText()
  if (!stopped.includes('Khởi động server')) throw new Error('không quay về trạng thái dừng')
  await modal.locator('button:has-text("Đóng")').click()
})

// D1-26: chưa cấu hình lệnh → cảnh báo + nút bị chặn
await check('D1-26 dialog deploy chặn khi chưa có lệnh', async () => {
  await openCommand('Triển khai')
  const modal = page.locator('.pm-modal', { hasText: 'Triển khai' })
  await modal.waitFor({ timeout: 3000 })
  const text = await modal.innerText()
  if (!text.includes('Chưa cấu hình lệnh triển khai')) throw new Error('thiếu cảnh báo chưa cấu hình')
  const disabled = await modal.locator('button:has-text("Triển khai ngay")').isDisabled()
  if (!disabled) throw new Error('nút Triển khai vẫn bấm được khi chưa có lệnh')
  await page.screenshot({ path: 'tests/evidence/ui-deploy.png' })
  await modal.locator('button:has-text("Đóng")').click()
})

// D1-23: chưa cấu hình → không có đường tạo phiên giả
await check('D1-23 login báo chưa cấu hình, không lộ token', async () => {
  await openCommand('Tài khoản Supabase')
  const modal = page.locator('.pm-modal', { hasText: 'Tài khoản Supabase' })
  await modal.waitFor({ timeout: 3000 })
  const text = await modal.innerText()
  if (!text.includes('Chưa cấu hình Supabase')) throw new Error('thiếu thông báo chưa cấu hình')
  const body = await page.locator('body').innerText()
  if (/eyJ[\w-]{10,}/.test(body)) throw new Error('DOM chứa chuỗi giống JWT')
  await page.screenshot({ path: 'tests/evidence/ui-login.png' })
  await modal.locator('button:has-text("Đóng")').click()
})

// D1-24/25: chưa có workspace id → không đồng bộ được; có lời giải thích
await check('D1-24/25 cloud dialog chặn khi thiếu workspace id', async () => {
  await openCommand('Đồng bộ Cloud')
  const modal = page.locator('.pm-modal', { hasText: 'Đồng bộ Cloud' })
  await modal.waitFor({ timeout: 3000 })
  const text = await modal.innerText()
  if (!text.includes('Workspace ID')) throw new Error('thiếu ô Workspace ID')
  const syncBtn = modal.locator('button:has-text("Đồng bộ ngay")')
  if (await syncBtn.count()) {
    if (!(await syncBtn.isDisabled())) throw new Error('Đồng bộ bấm được khi chưa có Workspace ID')
  }
  await page.screenshot({ path: 'tests/evidence/ui-cloud.png' })
  await modal.locator('button:has-text("Đóng")').click()
})

// D1-28: Settings có lựa chọn chế độ đồng bộ style
await check('D1-28 Settings có 3 chế độ đồng bộ style', async () => {
  await openCommand('Mở cài đặt')
  const modal = page.locator('.pm-modal', { hasText: 'Cài đặt' })
  await modal.waitFor({ timeout: 3000 })
  await modal.locator('button:has-text("Canvas & Soi")').click()
  await page.waitForTimeout(250)
  const select = modal.locator('select').filter({ hasText: 'Tự động' }).first()
  const values = await select.locator('option').evaluateAll((els) => els.map((e) => e.value))
  if (values.length < 3) throw new Error(`chỉ có ${values.length} lựa chọn: ${values.join(',')}`)
  await select.selectOption('inline')
  await page.waitForTimeout(200)
  if ((await select.inputValue()) !== 'inline') throw new Error('không giữ được lựa chọn inline')
  await page.screenshot({ path: 'tests/evidence/ui-style-sync.png' })
})

await browser.close()
server.close()
console.log(failures.length ? `\n${failures.length} FAIL:\n- ${failures.join('\n- ')}` : '\nTẤT CẢ UI CHECK PASS')
process.exit(failures.length ? 1 : 0)
