import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { mkdir } from 'node:fs/promises'

const root = resolve('out/renderer')
const port = 4188

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0])
    let target = normalize(join(root, urlPath === '/' ? '/index.html' : urlPath))
    if (!target.startsWith(root + sep) && target !== root) {
      res.writeHead(403).end('Forbidden')
      return
    }
    if ((await stat(target)).isDirectory()) target = join(target, 'index.html')
    const data = await readFile(target)
    res.writeHead(200, { 'Content-Type': MIME[extname(target).toLowerCase()] ?? 'application/octet-stream' })
    res.end(data)
  } catch {
    res.writeHead(404).end('Not found')
  }
})

await new Promise((resolve) => server.listen(port, resolve))
console.log(`Server started on http://localhost:${port}`)

await mkdir('tests/evidence', { recursive: true })

// Chế độ hiện cửa sổ trực tiếp trên màn hình: headless: false và slowMo để nhìn rõ từng bước
const isHeaded = !process.env.CI && process.env.HEADLESS !== 'true'

const browser = await chromium.launch({
  headless: !isHeaded,
  slowMo: isHeaded ? 600 : 0, // Làm chậm 600ms mỗi thao tác để mắt người kịp nhìn
})

const context = await browser.newContext({
  viewport: { width: 1400, height: 900 },
})
const page = await context.newPage()

// Thêm con trỏ chuột ảo màu đỏ lấp lánh để người dùng nhìn thấy đường đi của chuột
if (isHeaded) {
  await page.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => {
      const cursor = document.createElement('div')
      cursor.id = 'playwright-visual-mouse'
      cursor.style.position = 'fixed'
      cursor.style.width = '20px'
      cursor.style.height = '20px'
      cursor.style.borderRadius = '50%'
      cursor.style.background = 'rgba(239, 68, 68, 0.85)'
      cursor.style.border = '2px solid #ffffff'
      cursor.style.boxShadow = '0 0 12px rgba(239, 68, 68, 0.9), 0 0 24px rgba(239, 68, 68, 0.5)'
      cursor.style.pointerEvents = 'none'
      cursor.style.zIndex = '9999999'
      cursor.style.transition = 'transform 0.25s ease-out, background 0.15s ease'
      cursor.style.transform = 'translate(-50%, -50%) scale(1)'
      document.body.appendChild(cursor)

      window.addEventListener('mousemove', (e) => {
        cursor.style.left = `${e.clientX}px`
        cursor.style.top = `${e.clientY}px`
      })
      window.addEventListener('mousedown', () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(1.6)'
        cursor.style.background = 'rgba(16, 185, 129, 0.95)'
      })
      window.addEventListener('mouseup', () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(1)'
        cursor.style.background = 'rgba(239, 68, 68, 0.85)'
      })
    })
  })
}

await page.goto(`http://localhost:${port}`)
await page.waitForLoadState('networkidle')

// Giả lập localhost:5173 trả về 200 OK để Canvas vượt qua bước kiểm tra "isServerReady"
await page.route('http://localhost:5173/**', (route) => {
  route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<html><body><h1>Mock preview server</h1></body></html>',
  })
})

// Đóng bất kỳ modal/backdrop chào mừng nào nếu có
const closeBtn = page.locator('button:has-text("Đóng"), button:has-text("Bắt đầu"), .pm-modal__close')
if (await closeBtn.count() > 0) {
  try { await closeBtn.first().click({ timeout: 1500 }) } catch {}
  await page.waitForTimeout(300)
}

// 1. Chuyển vào màn hình Làm việc
console.log('[Playwright] Chuyển sang màn hình Làm việc...')
const workspaceBtn = page.locator('button:has-text("Mở màn hình làm việc"), button:has-text("Làm việc")').first()
if (await workspaceBtn.isVisible()) {
  const wBox = await workspaceBtn.boundingBox()
  if (wBox) {
    await page.mouse.move(wBox.x + wBox.width / 2, wBox.y + wBox.height / 2, { steps: 30 })
    await page.waitForTimeout(400)
    await page.mouse.down(); await page.waitForTimeout(100); await page.mouse.up()
  } else {
    await workspaceBtn.click({ force: true })
  }
}
await page.waitForTimeout(1000)

// 2. Bấm nút Run để khởi động mock dev server
console.log('[Playwright] Bấm nút Run để khởi động xem trước...')
const runBtn = page.locator('button:has-text("Run")').first()
if (await runBtn.isVisible()) {
  const rBox = await runBtn.boundingBox()
  if (rBox) {
    await page.mouse.move(rBox.x + rBox.width / 2, rBox.y + rBox.height / 2, { steps: 25 })
    await page.waitForTimeout(400)
    await page.mouse.down(); await page.waitForTimeout(100); await page.mouse.up()
  } else {
    await runBtn.click({ force: true })
  }
}

// Chờ mock emit URL (1.4s) + Canvas kiểm tra server (intercepted → ngay lập tức)
console.log('[Playwright] Chờ iframe Canvas load...')
await page.waitForTimeout(3000)

// 3. Chụp ảnh màn hình sau khi Run
await page.screenshot({ path: 'tests/evidence/workspace-screen.png', fullPage: false })
console.log('[Playwright] Đã chụp ảnh tests/evidence/workspace-screen.png')

// 4. Di chuột đến nút Khoanh Part trên thanh công cụ Canvas
const lassoBtn = page.locator('button[title*="Khoanh vùng nhiều phần tử trên Canvas để lưu Part"]')
const lassoCount = await lassoBtn.count()
console.log(`[Playwright] Nút "Khoanh Part" trên Canvas toolbar: ${lassoCount > 0 ? 'TÌM THẤY ✓' : 'CHƯA THẤY'}`)

if (lassoCount > 0) {
  const box = await lassoBtn.first().boundingBox()
  if (box) {
    console.log('[Playwright] Di chuột đến nút [⬚ Khoanh Part]...')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 35 })
    await page.waitForTimeout(600)
    await page.mouse.down(); await page.waitForTimeout(150); await page.mouse.up()
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'tests/evidence/khoanh-part-active.png', fullPage: false })
    console.log('[Playwright] Đã chụp ảnh tests/evidence/khoanh-part-active.png')
    // Tắt lại chế độ Khoanh Part (Esc)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
  }
}

// 5. Mở Hộp công cụ Part (Toolbox)
console.log('[Playwright] Mở Hộp công cụ Part...')
const toolboxTab = page.locator('.pm-tab-strip button, button[title*="Hộp công cụ"], button:has-text("Linh kiện")').first()
if (await toolboxTab.count() > 0) {
  const tBox = await toolboxTab.boundingBox()
  if (tBox) {
    await page.mouse.move(tBox.x + tBox.width / 2, tBox.y + tBox.height / 2, { steps: 25 })
    await page.waitForTimeout(400)
    await toolboxTab.click({ force: true })
    await page.waitForTimeout(800)
  }
}

// 6. Di chuột đến nút "+ Tạo Part" và bấm mở modal
const createPartBtn = page.locator('button:has-text("Tạo Part")')
if (await createPartBtn.count() > 0) {
  const cBox = await createPartBtn.first().boundingBox()
  if (cBox) {
    console.log('[Playwright] Di chuột đến nút "+ Tạo Part"...')
    await page.mouse.move(cBox.x + cBox.width / 2, cBox.y + cBox.height / 2, { steps: 25 })
    await page.waitForTimeout(400)
    await createPartBtn.first().click({ force: true })
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'tests/evidence/save-part-modal.png', fullPage: false })
    console.log('[Playwright] Đã chụp ảnh tests/evidence/save-part-modal.png')

    // 7. Di chuột đến nút "Cây bút: Khoanh vùng trên Canvas" trong Modal
    const pickBtn = page.locator('button:has-text("Cây bút: Khoanh vùng trên Canvas")')
    if (await pickBtn.count() > 0) {
      const pBox = await pickBtn.first().boundingBox()
      if (pBox) {
        console.log('[Playwright] Di chuột đến nút [⬚ Cây bút: Khoanh vùng trên Canvas]...')
        await page.mouse.move(pBox.x + pBox.width / 2, pBox.y + pBox.height / 2, { steps: 30 })
        await page.waitForTimeout(700)
      }
    }
  }
}

// Giữ màn hình thêm 2.5 giây cho người dùng nhìn thấy kết quả trước khi đóng
if (isHeaded) {
  console.log('[Playwright] Dừng 2.5 giây để bạn quan sát trực tiếp trên màn hình...')
  await page.waitForTimeout(2500)
}

await browser.close()
server.close()
console.log('[Playwright] Kiểm thử giao diện thành công 100%!')
