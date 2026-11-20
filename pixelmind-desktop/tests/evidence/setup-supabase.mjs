/* Tạo 3 tài khoản test + workspace + phân quyền trên Supabase thật (dùng anon key, không service_role). */
import { readFile, writeFile } from 'node:fs/promises'

const root = 'D:/Code/PixelMind/PixelMind/pixelmind-desktop'
const env = Object.fromEntries(
  (await readFile(`${root}/.env`, 'utf8')).split(/\r?\n/).filter((l) => l && !l.startsWith('#')).map((l) => {
    const i = l.indexOf('=')
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
  }),
)
const url = (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL).replace(/\/+$/, '')
const key = env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY
const PASSWORD = 'PixelMind@123'
const users = ['owner', 'editor', 'viewer'].map((r) => ({ role: r, email: `${r}@pixelmind.test` }))

const post = async (path, body, headers = {}) => {
  const res = await fetch(`${url}${path}`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json, text }
}

// 1. Đăng ký (bỏ qua nếu đã tồn tại)
for (const u of users) {
  const r = await post('/auth/v1/signup', { email: u.email, password: PASSWORD })
  const already = /already registered|already exists/i.test(r.text)
  console.log(`${u.email}: signup ${r.status}${already ? ' (đã tồn tại)' : ''}${r.json?.user?.email_confirmed_at ? ' — confirmed' : ''}`)
}

// 2. Đăng nhập cả 3, lưu token
const sessions = {}
for (const u of users) {
  const r = await post('/auth/v1/token?grant_type=password', { email: u.email, password: PASSWORD })
  if (!r.json?.access_token) {
    console.log(`ĐĂNG NHẬP THẤT BẠI ${u.email}: ${r.status} ${r.text.slice(0, 160)}`)
    process.exit(1)
  }
  sessions[u.role] = { token: r.json.access_token, id: r.json.user.id, email: u.email }
  console.log(`${u.email}: đăng nhập OK, user id ${r.json.user.id}`)
}

const authHeader = (role) => ({ Authorization: `Bearer ${sessions[role].token}` })

// 3. Tìm hoặc tạo workspace của owner
const list = await fetch(`${url}/rest/v1/pm_workspaces?select=*`, { headers: { apikey: key, ...authHeader('owner') } })
const existing = await list.json()
let ws = Array.isArray(existing) ? existing[0] : null
if (ws) {
  console.log(`workspace đã có: ${ws.id} (${ws.name})`)
} else {
  const created = await post('/rest/v1/pm_workspaces', { name: 'PixelMind Test', owner_email: sessions.owner.email }, { ...authHeader('owner'), Prefer: 'return=representation' })
  if (!created.json?.[0]?.id) {
    console.log(`TẠO WORKSPACE THẤT BẠI: ${created.status} ${created.text.slice(0, 200)}`)
    process.exit(1)
  }
  ws = created.json[0]
  console.log(`đã tạo workspace: ${ws.id}`)
}

// 4. Bảo đảm 3 hàng pm_members
const members = users.map((u) => ({ workspace_id: ws.id, email: u.email, role: u.role }))
const upsert = await post('/rest/v1/pm_members', members, { ...authHeader('owner'), Prefer: 'resolution=merge-duplicates,return=representation' })
if (upsert.status >= 300) {
  console.log(`GHI MEMBERS THẤT BẠI: ${upsert.status} ${upsert.text.slice(0, 240)}`)
  process.exit(1)
}
console.log(`đã ghi ${users.length} thành viên: ${users.map((u) => `${u.email} (${u.role})`).join(', ')}`)

// 5. In kết quả cho các bước sau
const out = { workspaceId: ws.id, url, accounts: users.map((u) => ({ ...u, password: PASSWORD })) }
await writeFile(`${root}/tests/evidence/supabase-test-context.json`, JSON.stringify(out, null, 2))
console.log(`\nWORKSPACE_ID=${ws.id}`)
console.log('Đã lưu tests/evidence/supabase-test-context.json (untracked)')
