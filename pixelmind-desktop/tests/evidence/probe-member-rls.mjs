import { readFile } from 'node:fs/promises'
const root = 'D:/Code/PixelMind/PixelMind/pixelmind-desktop'
const env = Object.fromEntries((await readFile(`${root}/.env`, 'utf8')).split(/\r?\n/).filter((l) => l && !l.startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const url = (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL).replace(/\/+$/, '')
const anon = env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY
const WS = '8174c691-9d14-45d9-9523-4e465981fa36'
const tok = async (email) => {
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'PixelMind@123' }) })
  return (await r.json()).access_token
}
const head = async (email) => ({ apikey: anon, Authorization: `Bearer ${await tok(email)}`, 'Content-Type': 'application/json', Prefer: 'return=representation' })
const patchRole = async (who, targetEmail, role) => {
  const h = await head(who)
  const r = await fetch(`${url}/rest/v1/pm_members?workspace_id=eq.${WS}&email=eq.${targetEmail}`, { method: 'PATCH', headers: h, body: JSON.stringify({ role }) })
  const text = await r.text()
  return { who, status: r.status, rows: (() => { try { const j = JSON.parse(text); return Array.isArray(j) ? j.length : j } catch { return text.slice(0, 80) } })() }
}
const readRoles = async (who) => {
  const h = await head(who)
  const r = await fetch(`${url}/rest/v1/pm_members?workspace_id=eq.${WS}&select=email,role&order=email`, { headers: h })
  return { status: r.status, rows: await r.json() }
}
const rank = { owner: 3, editor: 2, viewer: 1 }
const snap = async (label) => {
  const v = await readRoles('viewer@pixelmind.test')
  console.log(`${label}: viewer đọc ${v.status}`, JSON.stringify(v.rows).slice(0, 200))
}
await snap('trước')

for (const who of ['viewer@pixelmind.test', 'editor@pixelmind.test']) {
  const r = await patchRole(who, who, 'owner')
  console.log(`${who.split('@')[0]} tự nâng quyền ->`, JSON.stringify(r))
}
await snap('sau khi viewer/editor thử nâng quyền')

const o = await patchRole('owner@pixelmind.test', 'editor@pixelmind.test', 'editor')
console.log('owner đổi role editor -> editor (được phép):', JSON.stringify(o))
await snap('sau owner PATCH')

const bad = await patchRole('editor@pixelmind.test', 'viewer@pixelmind.test', 'owner')
console.log('editor nâng viewer -> owner:', JSON.stringify(bad))
const final = await readRoles('owner@pixelmind.test')
const roles = Object.fromEntries(final.rows.map((r) => [r.email.split('@')[0], r.role]))
console.log('role cuối:', JSON.stringify(roles))
console.log(Object.entries(roles).every(([k, v]) => rank[v] === rank[k]) ? 'PASS không ai đổi được vai trò' : 'FAIL vai trò bị đổi')
