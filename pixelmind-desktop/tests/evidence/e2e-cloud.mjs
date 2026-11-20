/* E2E D1-24/25 trên app thật: push, pull, xung đột có backup, payload hỏng, Viewer bị chặn.
   Không xoá được snapshot (RLS không cấp DELETE — theo thiết kế) nên dùng mốc cloud-sync.json. */
import { chromium } from 'playwright'
import { readFile, writeFile, unlink, rm, readdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hashPayload } from 'file:///D:/Code/PixelMind/PixelMind/pixelmind-desktop/electron/main/cloudSync.ts'

const results = []
const check = (name, cond, extra = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : ` — ${extra}`}`)
  console.log(results.at(-1))
}

const root = 'D:/Code/PixelMind/PixelMind/pixelmind-desktop'
const ctxJson = JSON.parse(await readFile(`${root}/tests/evidence/supabase-test-context.json`, 'utf8'))
const env = Object.fromEntries(
  (await readFile(`${root}/.env`, 'utf8')).split(/\r?\n/).filter((l) => l && !l.startsWith('#')).map((l) => {
    const i = l.indexOf('=')
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
  }),
)
const url = (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL).replace(/\/+$/, '')
const anon = env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY
const WS = ctxJson.workspaceId
const PW = 'PixelMind@123'

async function restSignIn(email) {
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PW }),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error(`login ${email} thất bại: ${r.status} ${JSON.stringify(j).slice(0, 120)}`)
  return { apikey: anon, Authorization: `Bearer ${j.access_token}`, 'Content-Type': 'application/json' }
}

const ownerHead = await restSignIn('owner@pixelmind.test')
const editorHead = await restSignIn('editor@pixelmind.test')
const viewerHead = await restSignIn('viewer@pixelmind.test')

const getSnap = async (h) => {
  const r = await fetch(`${url}/rest/v1/pm_snapshots?workspace_id=eq.${WS}&doc=eq.settings&select=payload`, { headers: h })
  const rows = await r.json()
  return Array.isArray(rows) && rows[0] ? rows[0].payload : null
}
const putSnap = async (h, payload) => {
  const r = await fetch(`${url}/rest/v1/pm_snapshots`, {
    method: 'POST',
    headers: { ...h, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ workspace_id: WS, doc: 'settings', schema_version: 1, payload }),
  })
  return r.status
}

const browser = await chromium.connectOverCDP('http://127.0.0.1:9229')
const page = browser.contexts()[0].pages()[0]
const userData = await page.evaluate(() => window.pixelmind.fs.special('userData'))
const syncFile = join(userData, 'cloud-sync.json')
const projectPath = await mkdtemp(join(tmpdir(), 'pm-sync-project-'))
const before = await page.evaluate(() => window.pixelmind.store.get())
const originalSettings = JSON.parse(JSON.stringify(before.settings))

// Mốc: coi như máy này đã sync đúng bản remote hiện tại → thay đổi local sẽ push, không conflict
const seeded = await getSnap(ownerHead)
await writeFile(syncFile, JSON.stringify({ docs: seeded ? { settings: hashPayload(seeded) } : {} }), 'utf8')

try {
  const login = await page.evaluate(({ e, p }) => window.pixelmind.auth.signIn(e, p), { e: 'owner@pixelmind.test', p: PW })
  check('owner đăng nhập trong app', login.ok === true, JSON.stringify(login.state))
  await page.evaluate((ws) => window.pixelmind.store.updateSettings({ cloudWorkspaceId: ws }), WS)
  await page.waitForTimeout(150)

  // 1. Local đổi theme → push
  await page.evaluate(() => window.pixelmind.store.updateSettings({ theme: 'light' }))
  await page.waitForTimeout(150)
  const first = await page.evaluate((p) => window.pixelmind.cloud.sync(p), projectPath)
  check('sync lần 1: ok + push settings', first.ok === true && first.pushed.includes('settings'), JSON.stringify(first))
  const remote1 = await getSnap(ownerHead)
  check('remote nhận theme=light', remote1?.settings?.theme === 'light', JSON.stringify(remote1?.settings?.theme))
  check('remote đúng schemaVersion=1', remote1?.schemaVersion === 1, String(remote1?.schemaVersion))
  check('remote không chứa cloudWorkspaceId', !('cloudWorkspaceId' in (remote1?.settings ?? {})), JSON.stringify(remote1?.settings ?? {}).slice(0, 120))
  check('remote là snapshot đầy đủ (nhiều trường)', Object.keys(remote1?.settings ?? {}).length > 5, JSON.stringify(Object.keys(remote1?.settings ?? {})))

  // 2. Máy khác (editor) sửa remote → app pull
  check('editor ghi được remote', (await putSnap(editorHead, { schemaVersion: 1, settings: { ...remote1.settings, theme: 'dark' } })) < 300)
  const second = await page.evaluate((p) => window.pixelmind.cloud.sync(p), projectPath)
  check('sync lần 2: chỉ pull, không push', second.ok === true && second.pulled.includes('settings') && second.pushed.length === 0 && second.conflicts.length === 0, JSON.stringify(second))
  await page.waitForTimeout(150)
  check('local nhận theme=dark từ cloud', (await page.evaluate(async () => (await window.pixelmind.store.get()).settings.theme)) === 'dark')

  // 3. Xung đột: cả hai bên cùng đổi từ mốc chung
  await page.evaluate(() => window.pixelmind.store.updateSettings({ theme: 'light' }))
  await page.waitForTimeout(150)
  const far = await getSnap(ownerHead)
  check('editor ghi remote lần 2', (await putSnap(editorHead, { schemaVersion: 1, settings: { ...far.settings, theme: 'dark', fontSize: 18 } })) < 300)
  const third = await page.evaluate((p) => window.pixelmind.cloud.sync(p), projectPath)
  const conflict = third.conflicts.find((c) => c.doc === 'settings')
  check('sync lần 3: phát hiện xung đột settings', third.ok === true && !!conflict, JSON.stringify(third))
  const backup = conflict ? JSON.parse(await readFile(conflict.backupPath, 'utf8')) : null
  check('backup chứa bản local (theme=light)', backup?.settings?.theme === 'light', JSON.stringify(backup?.settings?.theme))
  await page.waitForTimeout(150)
  const afterConflict = await page.evaluate(async () => (await window.pixelmind.store.get()).settings)
  check('sau xung đột: áp bản remote (dark + fontSize=18)', afterConflict.theme === 'dark' && afterConflict.fontSize === 18, JSON.stringify({ t: afterConflict.theme, f: afterConflict.fontSize }))

  // 4. Remote hỏng: báo lỗi rõ, không áp bậy, không crash (local === mốc nên nhánh là pull)
  check('đặt payload hỏng lên remote', (await putSnap(editorHead, { probe: true })) < 300)
  const bad = await page.evaluate((p) => window.pixelmind.cloud.sync(p), projectPath)
  check('payload hỏng: ok=false + lỗi schema rõ', bad.ok === false && /schema|hợp lệ/i.test(bad.error ?? ''), JSON.stringify(bad).slice(0, 200))
  await page.waitForTimeout(150)
  check('payload hỏng: local giữ nguyên', (await page.evaluate(async () => (await window.pixelmind.store.get()).settings.theme)) === 'dark')
  check('payload hỏng: main còn sống', typeof (await page.evaluate(() => window.pixelmind.mock.state())).running === 'boolean')

  // 5. Viewer: main chặn ghi, RLS là chốt cuối
  // Đặt remote hợp lệ + mốc = remote, để local đang khác đi → nhánh push (ghi) mới bị chặn
  const validRemote = { schemaVersion: 1, settings: { ...originalSettings } }
  delete validRemote.settings.cloudWorkspaceId
  check('trả remote về bản hợp lệ trước khi test viewer', (await putSnap(ownerHead, validRemote)) < 300)
  await writeFile(syncFile, JSON.stringify({ docs: { settings: hashPayload(validRemote) } }), 'utf8')
  await page.evaluate(() => window.pixelmind.auth.signOut())
  const viewerIn = await page.evaluate(({ e, p }) => window.pixelmind.auth.signIn(e, p), { e: 'viewer@pixelmind.test', p: PW })
  check('viewer đăng nhập được', viewerIn.ok === true, JSON.stringify(viewerIn.state))
  const viewerSync = await page.evaluate((p) => window.pixelmind.cloud.sync(p), projectPath)
  check('viewer: sync bị chặn ở main', viewerSync.ok === false && /Viewer|quyền/i.test(viewerSync.error ?? ''), JSON.stringify(viewerSync).slice(0, 200))
  const members = await page.evaluate(() => window.pixelmind.cloud.members())
  check('viewer đọc được danh sách thành viên', members.success === true && members.members?.length >= 3, JSON.stringify(members).slice(0, 200))
  console.log('  members:', JSON.stringify(members.members))

  const vw = await fetch(`${url}/rest/v1/pm_snapshots`, {
    method: 'POST',
    headers: { ...viewerHead, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ workspace_id: WS, doc: 'settings', schema_version: 1, payload: { schemaVersion: 1, settings: { theme: 'hack' } } }),
  })
  check('viewer gọi thẳng REST vẫn bị RLS chặn', vw.status >= 400, `HTTP ${vw.status}`)
  console.log('  viewer POST thẳng:', vw.status, (await vw.text()).slice(0, 90))
} finally {
  await page.evaluate(() => window.pixelmind.auth.signOut()).catch(() => {})
  await page.evaluate((s) => window.pixelmind.store.updateSettings(s), originalSettings).catch(() => {})
  await page.waitForTimeout(150)
  // Trả remote về bản settings gốc (không xoá được hàng)
  const restoredPayload = { schemaVersion: 1, settings: { ...originalSettings } }
  delete restoredPayload.settings.cloudWorkspaceId
  await putSnap(ownerHead, restoredPayload).catch(() => {})
  await unlink(syncFile).catch(() => {})
  for (const f of await readdir(join(userData, 'cloud-conflicts')).catch(() => [])) {
    if (f.startsWith('settings-')) await unlink(join(userData, 'cloud-conflicts', f)).catch(() => {})
  }
  await rm(projectPath, { recursive: true, force: true }).catch(() => {})
}

const restored = await page.evaluate(async () => (await window.pixelmind.store.get()).settings)
check('dọn dẹp: settings local về gốc, không còn workspace', restored.theme === originalSettings.theme && !restored.cloudWorkspaceId, JSON.stringify({ theme: restored.theme, ws: restored.cloudWorkspaceId }))
check('dọn dẹp: cloud-sync.json đã xoá', await readFile(syncFile, 'utf8').then(() => false, () => true))
const finalRemote = await getSnap(ownerHead)
check('dọn dẹp: remote là snapshot hợp lệ', finalRemote?.schemaVersion === 1 && finalRemote?.settings?.theme === originalSettings.theme, JSON.stringify(finalRemote?.settings?.theme))
const leftover = (await readdir(join(userData, 'cloud-conflicts')).catch(() => [])).filter((f) => f.startsWith('settings-'))
check('dọn dẹp: không còn backup test', leftover.length === 0, leftover.join(', '))

await browser.close()
const failed = results.filter((r) => r.startsWith('FAIL'))
console.log(failed.length ? `\n${failed.length} FAIL` : '\nTẤT CẢ CLOUD E2E PASS')
process.exit(failed.length ? 1 : 0)
