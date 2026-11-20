import { readFile } from 'node:fs/promises'
const root = 'D:/Code/PixelMind/PixelMind/pixelmind-desktop'
const env = Object.fromEntries((await readFile(`${root}/.env`, 'utf8')).split(/\r?\n/).filter((l) => l && !l.startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim().replace(/^export\s+/, ''), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const url = (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL).replace(/\/+$/, '')
const key = env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY
const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
const post = async (path, body, extra = {}) => {
  const r = await fetch(`${url}/rest/v1/${path}`, { method: 'POST', headers: { ...h, ...extra }, body: JSON.stringify(body) })
  return `${r.status} ${(await r.text()).slice(0, 100)}`
}
console.log('anon insert pm_workspaces  ->', await post('pm_workspaces', { name: 'probe', owner_email: 'probe@x.y' }))
console.log('anon insert pm_members     ->', await post('pm_members', { workspace_id: '00000000-0000-0000-0000-000000000000', email: 'probe@x.y', role: 'owner' }))
console.log('anon insert pm_snapshots   ->', await post('pm_snapshots', { workspace_id: '00000000-0000-0000-0000-000000000000', doc: 'settings', schema_version: 1, payload: {} }))
console.log('anon rpc pm_role           ->', await post('rpc/pm_role', { p_workspace: '00000000-0000-0000-0000-000000000000' }))
console.log('anon read pm_snapshots     ->', await (async () => { const r = await fetch(`${url}/rest/v1/pm_snapshots?select=*`, { headers: h }); return `${r.status} ${await r.text()}` })())
