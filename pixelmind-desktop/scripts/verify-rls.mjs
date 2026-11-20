/* Kiểm chứng Viewer không ghi được pm_snapshots.
   Chạy: SUPABASE_URL=... SUPABASE_ANON_KEY=... VIEWER_EMAIL=... VIEWER_PASSWORD=... \
        WORKSPACE_ID=... node scripts/verify-rls.mjs */
const env = process.env
const need = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VIEWER_EMAIL', 'VIEWER_PASSWORD', 'WORKSPACE_ID']
const missing = need.filter((k) => !env[k])
if (missing.length) {
  console.error(`Thiếu biến môi trường: ${missing.join(', ')}`)
  process.exit(2)
}
const url = env.SUPABASE_URL.replace(/\/+$/, '')
const signIn = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.VIEWER_EMAIL, password: env.VIEWER_PASSWORD }),
})
const session = await signIn.json()
if (!signIn.ok) {
  console.error('Đăng nhập Viewer thất bại:', session.error_description || session.msg || signIn.status)
  process.exit(1)
}
const headers = {
  apikey: env.SUPABASE_ANON_KEY,
  Authorization: `Bearer ${session.access_token}`,
  'Content-Type': 'application/json',
  Prefer: 'resolution=merge-duplicates,return=minimal',
}
const read = await fetch(
  `${url}/rest/v1/pm_snapshots?workspace_id=eq.${env.WORKSPACE_ID}&select=doc`,
  { headers },
)
console.log(`GET  → ${read.status} (mong đợi 200)`)
const write = await fetch(`${url}/rest/v1/pm_snapshots`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    workspace_id: env.WORKSPACE_ID,
    doc: 'settings',
    schema_version: 1,
    payload: { probe: true },
  }),
})
console.log(`POST → ${write.status} (mong đợi 401/403)`)
process.exit(read.status === 200 && (write.status === 401 || write.status === 403) ? 0 : 1)
