/* E2E D1-26: chạy lệnh deploy thật (node script giả lập CLI), kiểm tra URL, log che token, meta lưu lại. */
import { chromium } from 'playwright'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const results = []
const check = (name, cond, extra = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : ` — ${extra}`}`)
  console.log(results.at(-1))
}

const TOKEN = 'SUPERSECRET-TOKEN-123'
const projectDir = await mkdtemp(join(tmpdir(), 'pm-deploy-'))
await writeFile(join(projectDir, 'package.json'), JSON.stringify({ name: 'pm-deploy-test' }))
await writeFile(
  join(projectDir, 'ok.mjs'),
  `console.log('Bắt đầu deploy');
console.log(JSON.stringify(process.argv));
console.log('token env:', process.env.VERCEL_TOKEN ? 'present' : 'missing');
console.log('https://pixelmind-test.vercel.app');
`,
)
await writeFile(join(projectDir, 'fail.mjs'), `console.error('Error: missing project config'); process.exit(3)\n`)

const browser = await chromium.connectOverCDP('http://127.0.0.1:9229')
const page = browser.contexts()[0].pages()[0]
const userData = await page.evaluate(() => window.pixelmind.fs.special('userData'))

const before = await page.evaluate(() => window.pixelmind.store.get())
const original = {
  deployProvider: before.settings.deployProvider,
  deployCommand: before.settings.deployCommand,
  deployTokenEnv: before.settings.deployTokenEnv,
}

const project = await page.evaluate((dir) => window.pixelmind.projects.add(dir), projectDir)
check('thêm dự án tạm vào store', !!project?.id, JSON.stringify(project))

// Lưu token qua IPC → phải được mã hoá trên đĩa
const setTok = await page.evaluate((t) => window.pixelmind.deploy.setToken('vercel', t), TOKEN)
check('setToken thành công', setTok.success === true, JSON.stringify(setTok))
const tokenFile = join(userData, 'deploy-token-vercel.json')
const raw = await readFile(tokenFile, 'utf8').catch(() => '')
check('file token không chứa plaintext', raw.length > 0 && !raw.includes(TOKEN), raw.slice(0, 80))
check('hasToken trả true sau khi lưu', (await page.evaluate(() => window.pixelmind.deploy.hasToken('vercel'))) === true)

// Cấu hình lệnh deploy tạm
await page.evaluate(() => window.pixelmind.store.updateSettings({ deployProvider: 'vercel', deployCommand: 'node ok.mjs', deployTokenEnv: 'VERCEL_TOKEN' }))

// Bắt log stream từ main
await page.evaluate(() => {
  window.__deployLogs = []
  window.__offLog = window.pixelmind.deploy.onLog((l) => window.__deployLogs.push(l.text))
})

const state = await page.evaluate((id) => window.pixelmind.deploy.start(id), project.id)
check('deploy thành công', state.status === 'success', JSON.stringify(state))
check('bắt được URL từ stdout', state.url === 'https://pixelmind-test.vercel.app', String(state.url))

await page.waitForTimeout(500)
const logs = await page.evaluate(() => window.__deployLogs.join('\n'))
check('log không chứa token', !logs.includes(TOKEN), logs.slice(0, 300))
check('command line không chứa token', !/SUPERSECRET/.test(logs), logs.slice(0, 300))
check('tiến trình con nhận token qua env', /token env: present/.test(logs), logs.slice(0, 300))

const projects = await page.evaluate(() => window.pixelmind.projects.list())
const saved = projects.find((p) => p.id === project.id)
check('lưu deployUrl vào ProjectMeta', saved?.meta?.deployUrl === 'https://pixelmind-test.vercel.app', JSON.stringify(saved?.meta ?? {}))

// Lệnh lỗi → thông báo cụ thể
await page.evaluate(() => window.pixelmind.store.updateSettings({ deployCommand: 'node fail.mjs' }))
const failed = await page.evaluate((id) => window.pixelmind.deploy.start(id), project.id)
check('lệnh exit 3 → status error', failed.status === 'error' && !!failed.error, JSON.stringify(failed))
check('thông báo lỗi nêu exit code / stderr', /3|missing project config/.test(failed.error ?? ''), String(failed.error))
console.log('  lỗi:', failed.error)

// CLI không tồn tại → lỗi nhanh, không treo
await page.evaluate(() => window.pixelmind.store.updateSettings({ deployCommand: 'khong-ton-tai-cli --version' }))
const t0 = Date.now()
const missing = await page.evaluate((id) => window.pixelmind.deploy.start(id), project.id)
const took = Date.now() - t0
check('CLI không tồn tại → error, không treo', missing.status === 'error' && took < 20000, `${took}ms ${JSON.stringify(missing)}`)

// Dọn dẹp: trả settings, xoá token, xoá project
await page.evaluate((o) => window.pixelmind.store.updateSettings(o), original)
await page.evaluate(() => window.pixelmind.deploy.clearToken('vercel'))
await page.evaluate((id) => window.pixelmind.projects.remove(id), project.id)
await page.evaluate(() => window.__offLog?.())
await rm(projectDir, { recursive: true, force: true }).catch(() => {})
const clearedFile = await readFile(tokenFile, 'utf8').catch(() => null)
check('clearToken xoá token khỏi đĩa', clearedFile === null || !clearedFile.includes(TOKEN), String(clearedFile).slice(0, 60))

await browser.close()
const failedList = results.filter((r) => r.startsWith('FAIL'))
console.log(failedList.length ? `\n${failedList.length} FAIL` : '\nTẤT CẢ DEPLOY E2E PASS')
process.exit(failedList.length ? 1 : 0)
