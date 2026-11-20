/* E2E thật trên app Electron đang chạy (CDP 9229): kiểm tra IPC ↔ main process. */
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import net from 'node:net'

const results = []
const check = (name, cond, extra = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : ` — ${extra}`}`)
  console.log(results.at(-1))
}

const browser = await chromium.connectOverCDP('http://127.0.0.1:9229')
const page = browser.contexts()[0].pages()[0]
console.log('  trang:', page.url().split('/').pop())

const api = await page.evaluate(() => Object.keys(window.pixelmind ?? {}).sort())
check('preload expose window.pixelmind', api.length > 10, JSON.stringify(api))
console.log('  namespace:', api.join(', '))
check('có namespace mới a11y/mock/deploy/auth/cloud', ['a11y', 'mock', 'deploy', 'auth', 'cloud'].every((k) => api.includes(k)), JSON.stringify(api))
check('không expose namespace bí mật', !api.some((k) => /secret|token|env$/i.test(k)), JSON.stringify(api))

// ---- Mock API: IPC thật + server thật trong main ----
const started = await page.evaluate(() =>
  window.pixelmind.mock.start('D:/Code/PixelMind/PixelMind/pixelmind-desktop', {
    port: 0,
    routes: [{ id: 'r1', method: 'GET', path: '/api/hello', status: 201, body: '{"hello":"world"}' }],
  }),
)
check('mock.start qua IPC trả running + cổng', started.running === true && typeof started.port === 'number', JSON.stringify(started))

const res = await fetch(`http://127.0.0.1:${started.port}/api/hello?x=1`)
const text = await res.text()
check('server thật trả đúng status/body', res.status === 201 && text === '{"hello":"world"}', `${res.status} ${text}`)
const cors = res.headers.get('access-control-allow-origin')
check('server thật có CORS', cors === '*', String(cors))

const port = started.port
const stoppedState = await page.evaluate(() => window.pixelmind.mock.stop())
check('mock.stop qua IPC trả running=false', stoppedState.running === false, JSON.stringify(stoppedState))
const refused = await fetch(`http://127.0.0.1:${port}/api/hello`).then(() => false, () => true)
check('stop giải phóng cổng (kết nối bị từ chối)', refused, 'vẫn kết nối được')
const free = await new Promise((resolve) => {
  const s = net.createServer()
  s.once('error', () => resolve(false))
  s.listen(port, '127.0.0.1', () => s.close(() => resolve(true)))
})
check('cổng bind lại được sau stop', free, 'cổng còn bị giữ')

// ---- Auth thật (main đọc .env, không config nào lộ ra renderer) ----
const authState = await page.evaluate(() => window.pixelmind.auth.state())
check('auth.state không chứa token', !/token|eyJ/i.test(JSON.stringify(authState)), JSON.stringify(authState))
console.log('  auth state:', JSON.stringify(authState))
const signIn = await page.evaluate(() => window.pixelmind.cloud.members())
check('cloud.members khi chưa đăng nhập: lỗi tiếng Việt, không crash', signIn.success === false && !!signIn.error, JSON.stringify(signIn))

// ---- Deploy ----
const deployState = await page.evaluate(() => window.pixelmind.deploy.state())
check('deploy.state có shape đúng', 'status' in deployState && 'url' in deployState, JSON.stringify(deployState))
const hasToken = await page.evaluate(() => window.pixelmind.deploy.hasToken('vercel'))
check('deploy.hasToken trả boolean', typeof hasToken === 'boolean', String(hasToken))
const deployStart = await page.evaluate(() => window.pixelmind.deploy.start('khong-ton-tai'))
check('deploy.start khi chưa cấu hình: lỗi cụ thể, không throw', deployStart.status === 'error' && !!deployStart.error, JSON.stringify(deployStart))
console.log('  deploy error:', deployStart.error)

// ---- A11y: gọi thật với axe-core thật, chưa có preview ----
const axe = await readFile('node_modules/axe-core/axe.min.js', 'utf8')
const scan = await page.evaluate((src) => window.pixelmind.a11y.scan({ axeSource: src }), axe)
check('a11y.scan chạy qua IPC', typeof scan.ok === 'boolean', JSON.stringify(scan).slice(0, 120))
check('chưa có preview → ok=false, reason=no-frame (không phải "0 lỗi")', scan.ok === false && scan.reason === 'no-frame', JSON.stringify(scan).slice(0, 200))
check('a11y báo lỗi có nội dung', !!scan.error, JSON.stringify(scan).slice(0, 200))
console.log('  a11y:', scan.reason, '-', scan.error)

// ---- Gọi IPC sai kiểu không làm sập main ----
const badScan = await page.evaluate(() => window.pixelmind.a11y.scan({ axeSource: 'throw new Error("boom")' }))
check('axeSource lỗi → ok=false/failed, main sống', badScan.ok === false, JSON.stringify(badScan).slice(0, 150))
const stillAlive = await page.evaluate(() => window.pixelmind.mock.state())
check('main vẫn phản hồi sau lỗi', typeof stillAlive.running === 'boolean', JSON.stringify(stillAlive))

await browser.close()
const failed = results.filter((r) => r.startsWith('FAIL'))
console.log(failed.length ? `\n${failed.length} FAIL` : '\nTẤT CẢ IPC E2E PASS')
process.exit(failed.length ? 1 : 0)
