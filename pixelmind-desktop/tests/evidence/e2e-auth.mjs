/* E2E D1-23: đăng nhập sai qua IPC thật (mạng thật) — không tạo phiên giả, không lộ token. */
import { chromium } from 'playwright'

const results = []
const check = (name, cond, extra = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : ` — ${extra}`}`)
  console.log(results.at(-1))
}

const browser = await chromium.connectOverCDP('http://127.0.0.1:9229')
const page = browser.contexts()[0].pages()[0]

const s0 = await page.evaluate(() => window.pixelmind.auth.state())
check('trạng thái ban đầu không có token', !/token|eyJ/i.test(JSON.stringify(s0)), JSON.stringify(s0))

const bad = await page.evaluate(() => window.pixelmind.auth.signIn('khong-ton-tai@pixelmind.test', 'sai-mat-khau-123'))
check('signIn sai → ok=false', bad.ok === false, JSON.stringify(bad).slice(0, 200))
check('signIn sai → có câu lỗi tiếng Việt', /Email hoặc mật khẩu|Đăng nhập thất bại|Supabase|kết nối/i.test(bad.error ?? ''), String(bad.error))
check('signIn sai → state signed-out, không user', bad.state.status === 'signed-out' && bad.state.user === null, JSON.stringify(bad.state))

const s1 = await page.evaluate(() => window.pixelmind.auth.state())
check('state sau lỗi không chứa token', !/token|eyJ/i.test(JSON.stringify(s1)), JSON.stringify(s1))
console.log('  lỗi:', bad.error)

const out = await page.evaluate(() => window.pixelmind.auth.signOut())
check('signOut → signed-out', out.status === 'signed-out', JSON.stringify(out))

const cloud = await page.evaluate(() => window.pixelmind.cloud.sync('D:/Code/PixelMind/PixelMind/pixelmind-desktop'))
check('cloud.sync khi chưa đăng nhập → lỗi rõ, không crash', cloud.ok === false && !!cloud.error, JSON.stringify(cloud).slice(0, 200))
console.log('  cloud:', cloud.error)

await browser.close()
const failed = results.filter((r) => r.startsWith('FAIL'))
console.log(failed.length ? `\n${failed.length} FAIL` : '\nTẤT CẢ AUTH IPC PASS')
process.exit(failed.length ? 1 : 0)
