import { readFile } from 'node:fs/promises'
const root = 'D:/Code/PixelMind/PixelMind/pixelmind-desktop'
const env = Object.fromEntries((await readFile(`${root}/.env`, 'utf8')).split(/\r?\n/).filter((l) => l && !l.startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const url = (env.VITE_SUPABASE_URL ?? env.SUPABASE_URL).replace(/\/+$/, '')
const key = env.VITE_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY
const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
const j = await r.json()
console.log(JSON.stringify({ status: r.status, disable_signup: j.disable_signup, mailer_autoconfirm: j.mailer_autoconfirm, external: Object.fromEntries(Object.entries(j.external ?? {}).map(([k, v]) => [k, v])) }, null, 1))
