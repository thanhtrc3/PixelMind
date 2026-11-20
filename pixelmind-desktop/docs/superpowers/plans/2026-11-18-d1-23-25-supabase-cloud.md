# D1-23/24/25 — Supabase Login · Cloud Sync · Workspace Roles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:**
- **D1-23:** đăng nhập/đăng xuất Supabase trong app; lỗi xác thực rõ; trạng thái phiên rõ; không cấu hình thì **không** tạo phiên giả; token không bao giờ vào renderer/repo.
- **D1-24:** đồng bộ 2 chiều `Settings` + `DesignTokens` lên Supabase, có schema version, xử lý xung đột (giữ bản sao cục bộ), lỗi mạng không mất dữ liệu cục bộ, có bước xác nhận của người dùng.
- **D1-25:** vai trò Owner/Editor/Viewer, kiểm quyền **ở server** (RLS) + kiểm tra phòng thủ ở main; Viewer không ghi được qua API.

**Architecture:** Toàn bộ giao tiếp Supabase chạy ở **main process** bằng `fetch` (GoTrue REST + PostgREST), không dùng SDK, không thêm dependency. Refresh token lưu mã hoá bằng `safeStorage`. Sync là merge theo hash 3 chiều (local/remote/lần đồng bộ trước) — không dựa vào đồng hồ máy. Quyền do RLS Postgres quyết định; app chỉ kiểm tra trước cho thông báo đẹp.

**Tech Stack:** `fetch` (Node 22), `node:crypto`, Electron `safeStorage`, Postgres/RLS trên Supabase, React, node:test.

**Spec:** `pixelmind-feature-checklist-2dev.md:112-114` (D1-23, D1-24, D1-25).

## Global Constraints

- **Không thêm dependency Supabase.** Gỡ `@supabase/supabase-js` (hiện chỉ dùng ở file chết `src/lib/supabase.ts`).
- **Không có token/secret trong renderer**: `AuthState` chỉ chứa `{ status, user: { id, email }, expiresAt }`. Không đưa `access_token`/`refresh_token` qua IPC.
- `.env` (đã gitignore) là nguồn cấu hình; `.env.example` chỉ chứa placeholder. Hỗ trợ cả tên cũ `VITE_SUPABASE_*` để không làm hỏng máy đang chạy, nhưng **không** dùng tiền tố `VITE_` cho biến mới (Vite sẽ nhúng vào bundle renderer).
- Local luôn thắng về mặt "không mất dữ liệu": ghi local xong mới push; lỗi mạng → giữ nguyên local, báo lỗi. Xung đột → ghi backup rồi mới ghi đè bằng bản remote.
- Không tự động đồng bộ khi khởi động app. Người dùng bấm **Đồng bộ ngay** và xác nhận khi có xung đột.
- `electron/main/{supabaseConfig,auth,cloudSync,supabaseCloud}.ts` **không** import `'electron'`.
- Mirror API 3 chỗ: `shared/api.ts`, `electron/preload/index.ts`, `src/lib/mock.ts`.

## Review Focus

- Chưa cấu hình env → mở dialog thấy "chưa cấu hình", không có nút tạo phiên, `signIn` trả lỗi và **không** lưu token.
- Sai mật khẩu / tài khoản chưa xác nhận email → thông báo tiếng Việt tương ứng, phiên vẫn `signed-out`.
- Mất mạng khi đồng bộ → file local không đổi byte nào; báo lỗi; lần sau đồng bộ lại được.
- Hai máy cùng sửa → không mất bản nào: bản local ghi vào `cloud-conflicts/` trước khi nhận bản remote.
- Viewer bấm đồng bộ → bị chặn ở main **và** RLS trả 403 nếu gọi thẳng API.
- Đăng xuất → xoá refresh token đã lưu, trạng thái về `signed-out`.

---

## Prompt thi hành (copy nguyên khối dưới đây giao cho AI)

> Repo **chưa từng dùng Supabase**. Prompt này gồm cả phần tạo project/khóa/tài khoản test, vì thiếu bước đó AI sẽ không chạy được gì và dễ "giả lập" kết quả.

```text
Bạn thi hành D1-23, D1-24, D1-25 trong repo pixelmind-desktop (Electron + React + TS).

ĐỌC TRƯỚC KHI LÀM
1. docs/superpowers/plans/2026-11-18-d1-23-25-supabase-cloud.md — spec chi tiết, Task 1→5. Làm đúng thứ tự, TDD (test đỏ → code → test xanh), commit sau mỗi task.
2. pixelmind-feature-checklist-2dev.md dòng 112-114 — tiêu chí nghiệm thu gốc.
3. docs/superpowers/plans/2026-11-18-d1-17-28-index.md — quy ước chung (mirror IPC 3 chỗ, không import 'electron' trong module thuần, test chạy bằng `node --experimental-strip-types --test`).
4. docs/superpowers/plans/2026-11-18-test-plan.md mục B1.6–B1.8, I4–I6, U23–U25, S3–S7, F2–F4, F12 — bạn phải làm code qua được đúng những test đó.

TRẠNG THÁI REPO
- `git log --oneline -5` để biết đã làm tới đâu; D1-17/19/21/28 đã xong, D1-26 có thể đang dở. KHÔNG sửa code của các mục đó; nếu buộc phải chạm, nêu lý do trong commit.
- Có thay đổi chưa commit (ví dụ `src/lib/canvasSettings.ts`) → hỏi trước khi commit hay tách nhánh.

PHẦN A — CHUẨN BỊ SUPABASE (làm 1 lần, trước khi code)
A1. Tạo project: https://supabase.com/dashboard → New project. Region: Southeast Asia (Singapore). Lưu database password vào trình quản lý mật khẩu của bạn; app KHÔNG dùng password này.
A2. Lấy khóa: Project Settings → API. Ghi lại:
    - Project URL  → SUPABASE_URL
    - anon public key (hoặc publishable key ở project mới) → SUPABASE_ANON_KEY
    TUYỆT ĐỐI KHÔNG dùng/copy `service_role` vào app, .env, repo hay log. Nếu đã lỡ đưa vào đâu, thu hồi key trong dashboard.
A3. Authentication → Sign In / Providers → Email: bật. Với project test, tắt "Confirm email" để đăng nhập được ngay; nếu bật, phải xác nhận qua hộp thư.
A4. Authentication → Users → Add user: tạo 3 tài khoản (mật khẩu ≥ 8 ký tự, tick auto-confirm):
    - owner@pixelmind.test
    - editor@pixelmind.test
    - viewer@pixelmind.test
A5. SQL Editor → New query → dán TOÀN BỘ nội dung `docs/sql/2026-11-18-cloud.sql` (Task 3 Step 4) → Run. Không sửa policy để "cho dễ test".
A6. SQL Editor → tạo workspace và phân vai trò (thay email nếu khác):
    insert into public.pm_workspaces (name, owner_email)
    values ('PixelMind Test', 'owner@pixelmind.test') returning id;
    -- lấy id vừa trả về, thay vào dưới:
    insert into public.pm_members (workspace_id, email, role) values
      ('<WORKSPACE_ID>', 'owner@pixelmind.test',  'owner'),
      ('<WORKSPACE_ID>', 'editor@pixelmind.test', 'editor'),
      ('<WORKSPACE_ID>', 'viewer@pixelmind.test', 'viewer');
    Ghi lại `<WORKSPACE_ID>`: cần cho verify-rls và cho Settings.cloudWorkspaceId.
A7. Tạo `.env` ở gốc `pixelmind-desktop` (đã gitignore):
    SUPABASE_URL=https://<project-ref>.supabase.co
    SUPABASE_ANON_KEY=<anon/publishable key>
    Kiểm tra: `git status --porcelain` KHÔNG được hiện `.env`.
A8. Xác nhận kết nối bằng PowerShell trước khi viết code:
    $env:V='<anon key>'; $u='https://<ref>.supabase.co'
    Invoke-RestMethod "$u/auth/v1/token?grant_type=password" -Method Post `
      -Headers @{apikey=$env:V;'Content-Type'='application/json'} `
      -Body '{"email":"owner@pixelmind.test","password":"<pw>"}'
    Phải trả `access_token` + `refresh_token`. Nếu 400/401 → quay lại A3/A4, đừng đi tiếp.

PHẦN B — CODE
B1. Task 1 → Task 5 theo đúng file/thứ tự trong plan. Commit message theo plan (`feat(auth): ... (D1-23)` v.v.).
B2. Mọi API mới phải sửa đủ 4 chỗ: `shared/api.ts`, `electron/preload/index.ts`, `src/lib/mock.ts`, `electron/main/index.ts`. Thiếu → `npm run typecheck` đỏ.
B3. Bắt buộc:
    - Không thêm dependency. Gỡ `@supabase/supabase-js`, xoá `src/lib/supabase.ts`.
    - Gọi Supabase bằng `fetch` trong MAIN process. Renderer không bao giờ thấy token.
    - `AuthState` chỉ `{ status, user: {id,email}, expiresAt, error? }`.
    - Refresh token lưu qua `safeStorage` (`createSecretStore` từ D1-26); không khả dụng → báo lỗi, không ghi plaintext.
    - Local thắng khi lỗi mạng: ghi local xong mới push; lỗi mạng không được xoá/đổi file local.
    - Conflict: ghi bản local vào `cloud-conflicts/<timestamp>.json` TRƯỚC khi nhận remote.
    - Viewer bị chặn ở main VÀ bởi RLS. Không "ẩn nút" thay cho kiểm quyền.
B4. UI tiếng Việt, giọng hiện có; mọi lỗi mạng/CLI phải hiện câu cụ thể, không nuốt lỗi.

PHẦN C — NGHIỆM THU (chạy và dán output thật, không mô tả suông)
C1. `npm run typecheck` → 0 lỗi.
C2. `npm test` → toàn bộ xanh, gồm `tests/supabaseAuth.test.mjs`, `tests/cloudSync.test.mjs`, `tests/cloudRoles.test.mjs`.
C3. `npm run check:api` → exit 0.
C4. RLS thật (3 lần chạy, mỗi vai trò một lần):
    $env:SUPABASE_URL='...'; $env:SUPABASE_ANON_KEY='...'; $env:WORKSPACE_ID='...'
    $env:VIEWER_EMAIL='viewer@pixelmind.test'; $env:VIEWER_PASSWORD='...'
    node scripts/verify-rls.mjs
    → GET 200, POST 401/403, exit 0.
    Lặp với editor (POST phải 201/204) và owner.
C5. Thử bằng tay trên app (`npm run dev`): đăng nhập owner, đồng bộ; đổi Settings trên máy thứ hai (bản portable/VM) và đồng bộ ngược; đăng nhập viewer và xác nhận nút đồng bộ bị chặn + script C4 chứng minh server cũng chặn.
C6. Báo cáo: PASS/FAIL từng mục C1–C5 + bằng chứng (output, mã HTTP), việc còn dở, và mọi chỗ lệch plan kèm lý do. Không viết "đã hoàn thành" nếu C4 chưa chạy với viewer thật.
```

---

### Task 1: Cấu hình + AuthService (thuần, test được)

**Files:**
- Create: `shared/auth.ts`
- Create: `electron/main/supabaseConfig.ts`
- Create: `electron/main/auth.ts`
- Delete: `src/lib/supabase.ts`
- Modify: `.env.example`, `package.json` (gỡ dependency + thêm test)
- Test: `tests/supabaseAuth.test.mjs` (Create)

**Interfaces:**
- Produces:
```ts
// shared/auth.ts
export type AuthStatus = 'unconfigured' | 'signed-out' | 'signed-in'
export interface AuthUser { id: string; email: string }
export interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  expiresAt: number | null
  error?: string
}
export interface SignInResult { ok: boolean; state: AuthState; error?: string }

// electron/main/supabaseConfig.ts
export interface SupabaseConfig { url: string; anonKey: string }
export function parseEnvText(text: string): Record<string, string>
export function readSupabaseConfig(env: Record<string, string | undefined>): SupabaseConfig | null

// electron/main/auth.ts
export interface AuthDeps {
  config: SupabaseConfig | null
  fetchImpl: typeof fetch
  session: { load(): Promise<string | null>; save(value: string | null): Promise<void> }
  now?: () => number
}
export interface AuthService {
  state(): AuthState
  signIn(email: string, password: string): Promise<SignInResult>
  signOut(): Promise<AuthState>
  restore(): Promise<AuthState>
  refresh(): Promise<AuthState>
  accessToken(): string | null
  userEmail(): string | null
}
export function createAuthService(deps: AuthDeps): AuthService
export function authErrorMessage(status: number, body: unknown): string
```

- [ ] **Step 1: Viết test đỏ**

`tests/supabaseAuth.test.mjs`:

```js
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseEnvText, readSupabaseConfig } from '../electron/main/supabaseConfig.ts'
import { authErrorMessage, createAuthService } from '../electron/main/auth.ts'

const CONFIG = { url: 'https://demo.supabase.co', anonKey: 'anon-key-1234567890abcdef' }

function fakeFetch(handler) {
  const calls = []
  const impl = async (url, init) => {
    calls.push({ url, init })
    return handler(url, init)
  }
  return { impl, calls }
}

function ok(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data }
}

function memorySession(initial = null) {
  let value = initial
  return { load: async () => value, save: async (v) => { value = v }, get value() { return value } }
}

describe('readSupabaseConfig', () => {
  it('đọc biến mới và biến VITE_ cũ', () => {
    assert.deepEqual(readSupabaseConfig({ SUPABASE_URL: CONFIG.url, SUPABASE_ANON_KEY: CONFIG.anonKey }), CONFIG)
    assert.deepEqual(readSupabaseConfig({ VITE_SUPABASE_URL: CONFIG.url, VITE_SUPABASE_ANON_KEY: CONFIG.anonKey }), CONFIG)
  })

  it('thiếu một nửa hoặc URL không https thì null', () => {
    assert.equal(readSupabaseConfig({ SUPABASE_URL: CONFIG.url }), null)
    assert.equal(readSupabaseConfig({ SUPABASE_URL: 'http://x', SUPABASE_ANON_KEY: CONFIG.anonKey }), null)
    assert.equal(readSupabaseConfig({}), null)
  })

  it('parseEnvText đọc file .env đơn giản', () => {
    const env = parseEnvText('# comment\nA=1\nB="two"\nexport C=three\n')
    assert.deepEqual(env, { A: '1', B: 'two', C: 'three' })
  })
})

describe('authErrorMessage', () => {
  it('map lỗi phổ biến sang tiếng Việt', () => {
    assert.match(authErrorMessage(400, { error_description: 'Invalid login credentials' }), /Email hoặc mật khẩu/)
    assert.match(authErrorMessage(422, { msg: 'Email not confirmed' }), /xác nhận email/)
    assert.match(authErrorMessage(429, {}), /quá nhiều/)
  })
})

describe('createAuthService - chưa cấu hình', () => {
  it('không tạo phiên giả', async () => {
    const session = memorySession()
    const { impl } = fakeFetch(() => ok({}))
    const auth = createAuthService({ config: null, fetchImpl: impl, session })
    assert.equal(auth.state().status, 'unconfigured')
    const res = await auth.signIn('a@b.c', 'x')
    assert.equal(res.ok, false)
    assert.match(res.error, /Chưa cấu hình/)
    assert.equal(res.state.status, 'unconfigured')
    assert.equal(auth.accessToken(), null)
    assert.equal(session.value, null)
  })
})

describe('createAuthService - đăng nhập', () => {
  it('thành công: signed-in, lưu refresh token, có access token', async () => {
    const session = memorySession()
    const { impl, calls } = fakeFetch(() =>
      ok({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600, user: { id: 'u1', email: 'a@b.c' } }),
    )
    const auth = createAuthService({ config: CONFIG, fetchImpl: impl, session, now: () => 1000 })
    const res = await auth.signIn('a@b.c', 'mat-khau')
    assert.equal(res.ok, true)
    assert.equal(res.state.status, 'signed-in')
    assert.equal(res.state.user.email, 'a@b.c')
    assert.equal(res.state.expiresAt, 1000 + 3600_000)
    assert.equal(auth.accessToken(), 'AT')
    assert.equal(session.value, 'RT')
    assert.match(calls[0].url, /\/auth\/v1\/token\?grant_type=password$/)
    assert.equal(calls[0].init.headers.apikey, CONFIG.anonKey)
    assert.doesNotMatch(JSON.stringify(auth.state()), /AT|RT/)
  })

  it('sai mật khẩu: lỗi tiếng Việt, không lưu phiên', async () => {
    const session = memorySession()
    const { impl } = fakeFetch(() => ok({ error_description: 'Invalid login credentials' }, 400))
    const auth = createAuthService({ config: CONFIG, fetchImpl: impl, session })
    const res = await auth.signIn('a@b.c', 'sai')
    assert.equal(res.ok, false)
    assert.match(res.error, /Email hoặc mật khẩu/)
    assert.equal(res.state.status, 'signed-out')
    assert.equal(session.value, null)
  })

  it('lỗi mạng: báo không kết nối được, không lưu phiên', async () => {
    const session = memorySession()
    const auth = createAuthService({
      config: CONFIG,
      fetchImpl: async () => { throw new Error('offline') },
      session,
    })
    const res = await auth.signIn('a@b.c', 'x')
    assert.equal(res.ok, false)
    assert.match(res.error, /kết nối/)
    assert.equal(session.value, null)
  })
})

describe('createAuthService - khôi phục và đăng xuất', () => {
  it('restore thành công từ refresh token', async () => {
    const session = memorySession('OLD_RT')
    const { impl } = fakeFetch(() =>
      ok({ access_token: 'AT2', refresh_token: 'RT2', expires_in: 3600, user: { id: 'u1', email: 'a@b.c' } }),
    )
    const auth = createAuthService({ config: CONFIG, fetchImpl: impl, session })
    const state = await auth.restore()
    assert.equal(state.status, 'signed-in')
    assert.equal(auth.accessToken(), 'AT2')
    assert.equal(session.value, 'RT2')
  })

  it('restore thất bại xoá phiên, không bịa user', async () => {
    const session = memorySession('BAD_RT')
    const { impl } = fakeFetch(() => ok({ error: 'invalid_grant' }, 400))
    const auth = createAuthService({ config: CONFIG, fetchImpl: impl, session })
    const state = await auth.restore()
    assert.equal(state.status, 'signed-out')
    assert.equal(state.user, null)
    assert.equal(session.value, null)
  })

  it('signOut xoá token và về signed-out', async () => {
    const session = memorySession()
    const { impl } = fakeFetch(() =>
      ok({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600, user: { id: 'u1', email: 'a@b.c' } }),
    )
    const auth = createAuthService({ config: CONFIG, fetchImpl: impl, session })
    await auth.signIn('a@b.c', 'x')
    await auth.signOut()
    assert.equal(auth.state().status, 'signed-out')
    assert.equal(auth.accessToken(), null)
    assert.equal(session.value, null)
  })
})
```

- [ ] **Step 2: Chạy test, phải đỏ**

Run: `node --experimental-strip-types --test tests/supabaseAuth.test.mjs`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Gỡ SDK không dùng**

```powershell
npm uninstall @supabase/supabase-js
git rm src/lib/supabase.ts
```
Cập nhật `.env.example`:
```
# Bắt buộc cho đăng nhập + đồng bộ cloud (main process đọc, KHÔNG nhúng vào renderer)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-or-publishable-key
```
(+ chú thích: sao chép sang `.env`; `.env` đã gitignore, không commit.)

- [ ] **Step 4: Cài đặt `shared/auth.ts` + `supabaseConfig.ts`**

`supabaseConfig.ts`:
- `parseEnvText`: bỏ dòng trống/`#`, bỏ tiền tố `export `, tách tại `=` đầu tiên, bỏ nháy bao ngoài.
- `readSupabaseConfig`: lấy `SUPABASE_URL ?? VITE_SUPABASE_URL`, `SUPABASE_ANON_KEY ?? VITE_SUPABASE_ANON_KEY`; trim; yêu cầu `url` khớp `/^https:\/\/[^\s]+$/` và `anonKey.length >= 20`; trả `{url: url.replace(/\/+$/, ''), anonKey}`.

`auth.ts` — `createAuthService` giữ trong closure: `accessToken`, `refreshToken`, `state`.

- Header chung mọi request: `{ apikey: config.anonKey, 'Content-Type': 'application/json' }`.
- `signIn`: `POST ${url}/auth/v1/token?grant_type=password` body `{email, password}`.
  - !config → như test.
  - `!res.ok` → `message = authErrorMessage(res.status, body)`; set state `{status:'signed-out', user:null, expiresAt:null, error: message}`; **không** lưu token; trả `{ok:false, state, error: message}`.
  - throw → `'Không kết nối được Supabase. Kiểm tra mạng rồi thử lại.'`, state signed-out.
  - ok → lưu token trong closure, `await session.save(refresh_token)`, state signed-in (không có `error`), trả `{ok:true, state}`.
- `restore`: `session.load()`; null → state signed-out; không → gọi refresh token.
- `refresh`: `POST ...grant_type=refresh_token` body `{refresh_token}`. Thành công như signIn (lưu RT mới nếu có). Thất bại 400/401 → `await session.save(null)`, xoá closure, state `{status:'signed-out', error:'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.'}`. Mạng lỗi → giữ token cũ, state `{status:'signed-out', error:'Không kết nối được Supabase...'}` (không xoá token → lần sau thử lại được).
- `accessToken()`: trả token nếu `now() < expiresAt - 60_000`, ngược lại null.
- `signOut`: gọi `POST ${url}/auth/v1/logout` với Bearer (bỏ qua lỗi), `await session.save(null)`, xoá closure, state signed-out.
- `authErrorMessage(status, body)`: đọc `error_description || msg || message || error`; 400/401 + /invalid login/ → `'Email hoặc mật khẩu không đúng.'`; /not confirmed/ → `'Tài khoản chưa xác nhận email. Hãy kiểm tra hộp thư.'`; 429 → `'Bạn thử quá nhiều lần. Hãy chờ một phút rồi thử lại.'`; 5xx → `'Supabase đang lỗi (mã ${status}). Thử lại sau.'`; mặc định `'Đăng nhập thất bại (mã ${status}).'`.

- [ ] **Step 5: Chạy test, phải xanh**

Run: `node --experimental-strip-types --test tests/supabaseAuth.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add shared/auth.ts electron/main/supabaseConfig.ts electron/main/auth.ts tests/supabaseAuth.test.mjs .env.example package.json package-lock.json
git commit -m "feat(auth): dang nhap Supabase o main process, khong lo token ra renderer (D1-23)"
```

---

### Task 2: Merge engine cho Settings + DesignTokens

**Files:**
- Create: `shared/cloud.ts`
- Create: `electron/main/cloudSync.ts`
- Test: `tests/cloudSync.test.mjs` (Create)
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces:
```ts
// shared/cloud.ts
export type CloudRole = 'owner' | 'editor' | 'viewer'
export type CloudDoc = 'settings' | 'designTokens'
export interface CloudSnapshot<T = unknown> {
  doc: CloudDoc
  schemaVersion: number
  payload: T
  updatedAt: string
  updatedBy?: string
}
export interface CloudSyncReport {
  ok: boolean
  error?: string
  pushed: CloudDoc[]
  pulled: CloudDoc[]
  conflicts: Array<{ doc: CloudDoc; backupPath: string }>
  skipped: CloudDoc[]
}
export function isCloudRole(value: unknown): value is CloudRole
export function canWrite(role: CloudRole | null): boolean

// electron/main/cloudSync.ts
export function stableStringify(value: unknown): string
export function hashPayload(value: unknown): string
export type MergeAction = 'push' | 'pull' | 'noop' | 'conflict'
export function decideMerge(input: {
  localHash: string | null
  remoteHash: string | null
  lastSyncedHash: string | null
}): MergeAction
export interface SyncDoc { doc: CloudDoc; payload: unknown }
export interface SyncAdapter {
  pull(doc: CloudDoc): Promise<CloudSnapshot | null>
  push(doc: CloudDoc, payload: unknown): Promise<void>
}
export interface SyncHooks {
  lastSynced: Record<string, string>
  onPull: (doc: CloudDoc, payload: unknown) => Promise<void>
  onPush: (doc: CloudDoc, hash: string) => Promise<void>
  /** Ghi backup bản local, trả đường dẫn file backup. */
  onConflict: (doc: CloudDoc, localPayload: unknown) => Promise<string>
}
export async function syncDocs(adapter: SyncAdapter, local: SyncDoc[], hooks: SyncHooks): Promise<CloudSyncReport>
```

- [ ] **Step 1: Viết test đỏ**

`tests/cloudSync.test.mjs`:

```js
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { canWrite, isCloudRole } from '../shared/cloud.ts'
import { decideMerge, hashPayload, stableStringify, syncDocs } from '../electron/main/cloudSync.ts'

describe('vai trò', () => {
  it('chỉ owner/editor được ghi', () => {
    assert.equal(canWrite('owner'), true)
    assert.equal(canWrite('editor'), true)
    assert.equal(canWrite('viewer'), false)
    assert.equal(canWrite(null), false)
    assert.equal(isCloudRole('owner'), true)
    assert.equal(isCloudRole('guest'), false)
  })
})

describe('hashPayload', () => {
  it('không phụ thuộc thứ tự key', () => {
    assert.equal(hashPayload({ a: 1, b: { c: 2, d: 3 } }), hashPayload({ b: { d: 3, c: 2 }, a: 1 }))
    assert.notEqual(hashPayload({ a: 1 }), hashPayload({ a: 2 }))
    assert.equal(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] }), '{"a":[2,{"c":2,"d":1}],"b":1}')
  })
})

describe('decideMerge', () => {
  const H = (s) => hashPayload(s)
  it('chưa có remote → push', () => {
    assert.equal(decideMerge({ localHash: H('l'), remoteHash: null, lastSyncedHash: null }), 'push')
  })
  it('chưa có local → pull', () => {
    assert.equal(decideMerge({ localHash: null, remoteHash: H('r'), lastSyncedHash: null }), 'pull')
  })
  it('giống nhau → noop', () => {
    assert.equal(decideMerge({ localHash: H('x'), remoteHash: H('x'), lastSyncedHash: null }), 'noop')
  })
  it('local không đổi kể từ lần sync trước → pull', () => {
    assert.equal(decideMerge({ localHash: H('l'), remoteHash: H('r'), lastSyncedHash: H('l') }), 'pull')
  })
  it('remote không đổi kể từ lần sync trước → push', () => {
    assert.equal(decideMerge({ localHash: H('l'), remoteHash: H('r'), lastSyncedHash: H('r') }), 'push')
  })
  it('cả hai cùng đổi → conflict', () => {
    assert.equal(decideMerge({ localHash: H('l'), remoteHash: H('r'), lastSyncedHash: H('old') }), 'conflict')
  })
})

describe('syncDocs', () => {
  const settings = { schemaVersion: 1, settings: { theme: 'dark' } }
  const tokens = { schemaVersion: 1, tokens: { colors: [] } }

  function adapter({ remote = {}, failPush = null } = {}) {
    const pushed = []
    return {
      pushed,
      pull: async (doc) => remote[doc] ?? null,
      push: async (doc, payload) => {
        if (failPush) throw new Error(failPush)
        pushed.push({ doc, payload })
        remote[doc] = { doc, schemaVersion: 1, payload, updatedAt: new Date().toISOString() }
      },
    }
  }

  function hooks(overrides = {}) {
    const pulls = []
    const pushes = []
    const backups = []
    return {
      pulls, pushes, backups,
      lastSynced: {},
      onPull: async (doc, payload) => { pulls.push({ doc, payload }) },
      onPush: async (doc, hash) => { pushes.push({ doc, hash }) },
      onConflict: async (doc) => { const path = `backup-${doc}.json`; backups.push(doc); return path },
      ...overrides,
    }
  }

  it('đẩy local mới lên và kéo remote mới về', async () => {
    const a = adapter({ remote: { designTokens: { doc: 'designTokens', schemaVersion: 1, payload: tokens, updatedAt: 'x' } } })
    const h = hooks()
    const report = await syncDocs(a, [{ doc: 'settings', payload: settings }, { doc: 'designTokens', payload: tokens }], h)
    assert.equal(report.ok, true)
    assert.deepEqual(report.pushed, ['settings'])
    assert.deepEqual(report.pulled, ['designTokens'])
    assert.equal(h.pushes.length, 2)
    assert.equal(h.pulls[0].payload.schemaVersion, 1)
  })

  it('xung đột: backup local trước, nhận remote, báo conflict', async () => {
    const remote = { doc: 'settings', schemaVersion: 1, payload: { ...settings, settings: { theme: 'light' } }, updatedAt: 'y' }
    const a = adapter({ remote: { settings: remote } })
    const h = hooks({ lastSynced: { settings: hashPayload({ schemaVersion: 1, settings: { theme: 'sepia' } }) } })
    const report = await syncDocs(a, [{ doc: 'settings', payload: settings }], h)
    assert.equal(report.ok, true)
    assert.equal(report.conflicts.length, 1)
    assert.equal(report.conflicts[0].backupPath, 'backup-settings.json')
    assert.equal(h.pulls[0].payload.settings.theme, 'light')
  })

  it('lỗi mạng khi push: ok=false, không gọi onPull cho doc đó', async () => {
    const a = adapter({ failPush: 'offline' })
    const h = hooks()
    const report = await syncDocs(a, [{ doc: 'settings', payload: settings }], h)
    assert.equal(report.ok, false)
    assert.match(report.error, /offline/)
    assert.equal(h.pulls.length, 0)
    assert.deepEqual(report.pushed, [])
  })
})
```

- [ ] **Step 2: Chạy test, phải đỏ**

Run: `node --experimental-strip-types --test tests/cloudSync.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Cài đặt**

`shared/cloud.ts`: types + `isCloudRole` + `canWrite` (`role === 'owner' || role === 'editor'`).

`electron/main/cloudSync.ts`:
- `stableStringify`: đệ quy, object → sort key, bỏ `undefined`; mảng giữ thứ tự.
- `hashPayload`: `createHash('sha256').update(stableStringify(value)).digest('hex')`.
- `decideMerge` đúng bảng trong test (thứ tự kiểm tra: remote null → local null?; cả hai null → 'noop'; remote null → 'push'; local null → 'pull'; bằng nhau → noop; `lastSyncedHash === localHash` → pull; `=== remoteHash` → push; còn lại conflict).
- `syncDocs`: lặp **tuần tự** từng doc trong `local`; nếu `adapter.pull` throw → `return { ok:false, error: message, ...các mảng đã làm }` (không đụng local vì `onPull` chưa được gọi cho doc lỗi). Với action push gọi `adapter.push` rồi `onPush(doc, localHash)`; pull gọi `onPull(doc, remote.payload)` rồi `onPush(doc, remoteHash)`; conflict gọi `onConflict` rồi `onPull` rồi `onPush`; noop → skipped.

- [ ] **Step 4: Chạy test, phải xanh**

Run: `node --experimental-strip-types --test tests/cloudSync.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/cloud.ts electron/main/cloudSync.ts tests/cloudSync.test.mjs package.json
git commit -m "feat(cloud): merge 3 chieu theo hash cho Settings va Design Tokens (D1-24)"
```

---

### Task 3: REST adapter Supabase + schema SQL + quyền

**Files:**
- Create: `electron/main/supabaseCloud.ts`
- Create: `docs/sql/2026-11-18-cloud.sql`
- Create: `scripts/verify-rls.mjs`
- Test: `tests/cloudRoles.test.mjs` (Create)
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces:
```ts
// electron/main/supabaseCloud.ts
export interface CloudClientDeps {
  baseUrl: string
  anonKey: string
  accessToken: () => string | null
  fetchImpl: typeof fetch
}
export interface CloudClient {
  pull(workspaceId: string, doc: CloudDoc): Promise<CloudSnapshot | null>
  push(workspaceId: string, doc: CloudDoc, payload: unknown): Promise<void>
  role(workspaceId: string, email: string): Promise<CloudRole | null>
  members(workspaceId: string): Promise<Array<{ email: string; role: CloudRole }>>
  invite(workspaceId: string, email: string, role: CloudRole): Promise<void>
  setRole(workspaceId: string, email: string, role: CloudRole): Promise<void>
}
export function createCloudClient(deps: CloudClientDeps): CloudClient
```

- [ ] **Step 1: Viết test đỏ**

`tests/cloudRoles.test.mjs`:

```js
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createCloudClient } from '../electron/main/supabaseCloud.ts'

const DEPS = {
  baseUrl: 'https://demo.supabase.co',
  anonKey: 'anon-key',
  accessToken: () => 'AT',
}

function fakeFetch(responses) {
  const calls = []
  const impl = async (url, init) => {
    calls.push({ url, init })
    const body = responses.shift()
    return { ok: body.status < 300, status: body.status, json: async () => body.json ?? {}, text: async () => JSON.stringify(body.json ?? {}) }
  }
  return { impl, calls }
}

describe('createCloudClient', () => {
  it('pull trả null khi không có hàng, gửi đúng header và filter', async () => {
    const { impl, calls } = fakeFetch([{ status: 200, json: [] }])
    const client = createCloudClient({ ...DEPS, fetchImpl: impl })
    assert.equal(await client.pull('ws-1', 'settings'), null)
    assert.match(calls[0].url, /\/rest\/v1\/pm_snapshots\?workspace_id=eq\.ws-1&doc=eq\.settings&select=\*/)
    assert.equal(calls[0].init.headers.apikey, 'anon-key')
    assert.equal(calls[0].init.headers.Authorization, 'Bearer AT')
  })

  it('pull map đúng payload và schema_version', async () => {
    const { impl } = fakeFetch([{ status: 200, json: [{ payload: { schemaVersion: 1 }, schema_version: 1, updated_at: '2026-01-01T00:00:00Z' }] }])
    const client = createCloudClient({ ...DEPS, fetchImpl: impl })
    const snap = await client.pull('ws-1', 'settings')
    assert.deepEqual(snap.payload, { schemaVersion: 1 })
    assert.equal(snap.schemaVersion, 1)
  })

  it('push gửi Prefer merge-duplicates', async () => {
    const { impl, calls } = fakeFetch([{ status: 201, json: [] }])
    const client = createCloudClient({ ...DEPS, fetchImpl: impl })
    await client.push('ws-1', 'settings', { schemaVersion: 1 })
    assert.equal(calls[0].init.method, 'POST')
    assert.match(calls[0].init.headers.Prefer, /resolution=merge-duplicates/)
    assert.deepEqual(JSON.parse(calls[0].init.body), { workspace_id: 'ws-1', doc: 'settings', schema_version: 1, payload: { schemaVersion: 1 } })
  })

  it('RLS chặn Viewer: push 403 thành lỗi tiếng Việt rõ ràng', async () => {
    const { impl } = fakeFetch([{ status: 403, json: { message: 'new row violates row-level security policy' } }])
    const client = createCloudClient({ ...DEPS, fetchImpl: impl })
    await assert.rejects(client.push('ws-1', 'settings', {}), /không có quyền ghi/i)
  })

  it('role lấy từ pm_members, không có hàng → null', async () => {
    const { impl } = fakeFetch([{ status: 200, json: [{ role: 'viewer' }] }, { status: 200, json: [] }])
    const client = createCloudClient({ ...DEPS, fetchImpl: impl })
    assert.equal(await client.role('ws-1', 'a@b.c'), 'viewer')
    assert.equal(await client.role('ws-1', 'x@y.z'), null)
  })
})

describe('SQL schema', () => {
  it('không cho Viewer ghi pm_snapshots (RLS)', async () => {
    const sql = await readFile(new URL('../docs/sql/2026-11-18-cloud.sql', import.meta.url), 'utf8')
    assert.match(sql, /alter table public\.pm_snapshots enable row level security/i)
    assert.match(sql, /pm_role\(workspace_id\) in \('owner', ?'editor'\)/i)
    assert.match(sql, /pm_role\(workspace_id\) = 'owner'/i)
  })
})
```

- [ ] **Step 2: Chạy test, phải đỏ**

Run: `node --experimental-strip-types --test tests/cloudRoles.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Cài đặt adapter**

`electron/main/supabaseCloud.ts`:

- Header: `{ apikey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }`; nếu `accessToken()` null → throw `Error('Bạn cần đăng nhập để đồng bộ.')`.
- `pull`: `GET ${baseUrl}/rest/v1/pm_snapshots?workspace_id=eq.${encodeURIComponent(ws)}&doc=eq.${doc}&select=*`; `!res.ok` → `throw new Error(await readError(res))`; mảng rỗng → null; map `{ doc, schemaVersion: row.schema_version, payload: row.payload, updatedAt: row.updated_at, updatedBy: row.updated_by }`.
- `push`: `POST .../pm_snapshots` header `Prefer: 'resolution=merge-duplicates,return=minimal'` body `{ workspace_id, doc, schema_version: payload.schemaVersion ?? 1, payload }`. `res.status === 401 || 403` → throw `new Error('Tài khoản của bạn không có quyền ghi vào workspace này (Viewer chỉ được xem).')`. Lỗi khác → `throw new Error(await readError(res))`.
- `role`: `GET .../pm_members?workspace_id=eq.${ws}&email=eq.${encodeURIComponent(email.toLowerCase())}&select=role` → `rows[0]?.role` nếu hợp lệ, không thì null.
- `members`: `GET .../pm_members?workspace_id=eq.${ws}&select=email,role&order=email.asc`.
- `invite`: `POST .../pm_members` body `{ workspace_id, email: email.toLowerCase(), role }`, `Prefer: 'resolution=merge-duplicates'`.
- `setRole`: `PATCH .../pm_members?workspace_id=eq.${ws}&email=eq.${email}` body `{ role }`.
- `readError(res)`: đọc JSON `message|error_description|error|hint`, fallback `HTTP ${status}`.

- [ ] **Step 4: Viết `docs/sql/2026-11-18-cloud.sql`**

Chép nguyên văn, chạy trên Supabase SQL Editor:

```sql
-- PixelMind cloud schema (D1-24, D1-25). Chạy 1 lần trong SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.pm_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.pm_members (
  workspace_id uuid not null references public.pm_workspaces(id) on delete cascade,
  email text not null check (email = lower(email)),
  role text not null check (role in ('owner','editor','viewer')),
  primary key (workspace_id, email)
);

create table if not exists public.pm_snapshots (
  workspace_id uuid not null references public.pm_workspaces(id) on delete cascade,
  doc text not null check (doc in ('settings','designTokens')),
  schema_version int not null default 1,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (workspace_id, doc)
);

create or replace function public.pm_role(p_workspace uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select m.role
  from public.pm_members m
  where m.workspace_id = p_workspace
    and m.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1
$$;

alter table public.pm_workspaces enable row level security;
alter table public.pm_members enable row level security;
alter table public.pm_snapshots enable row level security;

drop policy if exists pm_ws_select on public.pm_workspaces;
create policy pm_ws_select on public.pm_workspaces
  for select using (public.pm_role(id) is not null);

drop policy if exists pm_ws_insert on public.pm_workspaces;
create policy pm_ws_insert on public.pm_workspaces
  for insert with check (lower(owner_email) = lower(auth.jwt() ->> 'email'));

drop policy if exists pm_mem_select on public.pm_members;
create policy pm_mem_select on public.pm_members
  for select using (public.pm_role(workspace_id) is not null);

drop policy if exists pm_mem_insert on public.pm_members;
create policy pm_mem_insert on public.pm_members
  for insert with check (
    public.pm_role(workspace_id) = 'owner'
    or (
      role = 'owner'
      and email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and exists (
        select 1 from public.pm_workspaces w
        where w.id = pm_members.workspace_id
          and lower(w.owner_email) = lower(auth.jwt() ->> 'email')
      )
    )
  );

drop policy if exists pm_mem_update on public.pm_members;
create policy pm_mem_update on public.pm_members
  for update using (public.pm_role(workspace_id) = 'owner')
  with check (public.pm_role(workspace_id) = 'owner');

drop policy if exists pm_mem_delete on public.pm_members;
create policy pm_mem_delete on public.pm_members
  for delete using (public.pm_role(workspace_id) = 'owner');

drop policy if exists pm_snap_select on public.pm_snapshots;
create policy pm_snap_select on public.pm_snapshots
  for select using (public.pm_role(workspace_id) is not null);

drop policy if exists pm_snap_insert on public.pm_snapshots;
create policy pm_snap_insert on public.pm_snapshots
  for insert with check (public.pm_role(workspace_id) in ('owner', 'editor'));

drop policy if exists pm_snap_update on public.pm_snapshots;
create policy pm_snap_update on public.pm_snapshots
  for update using (public.pm_role(workspace_id) in ('owner', 'editor'))
  with check (public.pm_role(workspace_id) in ('owner', 'editor'));
```

Quy trình tạo workspace (làm 1 lần, có thể bằng SQL Editor với user owner đã đăng nhập qua app):
1. App tạo workspace: `insert into pm_workspaces (name, owner_email) values ('PixelMind', '<email owner>') returning id;`
2. `insert into pm_members (workspace_id, email, role) values ('<id>', '<email owner>', 'owner');`
3. Copy `id` → Settings → `cloudWorkspaceId`.

- [ ] **Step 5: Script kiểm chứng RLS (nghiệm thu D1-25)**

`scripts/verify-rls.mjs` (không nằm trong `npm test` — cần mạng + tài khoản thật):

```js
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
  body: JSON.stringify({ workspace_id: env.WORKSPACE_ID, doc: 'settings', schema_version: 1, payload: { probe: true } }),
})
console.log(`POST → ${write.status} (mong đợi 401/403)`)
process.exit(read.status === 200 && (write.status === 401 || write.status === 403) ? 0 : 1)
```

- [ ] **Step 6: Chạy test**

Run: `node --experimental-strip-types --test tests/cloudRoles.test.mjs`
Expected: PASS (6 test).

- [ ] **Step 7: Commit**

```bash
git add electron/main/supabaseCloud.ts docs/sql/2026-11-18-cloud.sql scripts/verify-rls.mjs tests/cloudRoles.test.mjs package.json
git commit -m "feat(cloud): REST adapter, schema RLS va script kiem chung quyen Viewer (D1-25)"
```

---

### Task 4: Nối IPC (auth + cloud), lưu phiên mã hoá, sync thật

**Files:**
- Create/Reuse: `electron/main/secretStore.ts` (nếu chưa có, tạo đúng hợp đồng ở plan D1-26 Task 3)
- Modify: `shared/types.ts` (`Settings.cloudWorkspaceId?: string`; `DEFAULT_SETTINGS` thêm `cloudWorkspaceId: ''`)
- Modify: `shared/api.ts`, `electron/preload/index.ts`, `src/lib/mock.ts`
- Modify: `electron/main/index.ts` (khởi tạo auth/cloud + handlers + menu)
- Test: `tests/cloudSync.test.mjs` (Modify — thêm test cho snapshot builder)

**Interfaces:**
- Produces:
```ts
// electron/main/cloudSnapshots.ts (file mới, thuần, test được)
export const CLOUD_SCHEMA_VERSION = 1
export function buildSettingsSnapshot(settings: Settings): unknown
export function readSettingsPayload(payload: unknown): Partial<Settings> | null
export function buildTokensSnapshot(tokens: DesignTokens): unknown
export function readTokensPayload(payload: unknown): DesignTokens | null
```
- API:
```ts
auth: {
  state(): Promise<AuthState>
  signIn(email: string, password: string): Promise<SignInResult>
  signOut(): Promise<AuthState>
  onState(cb: (state: AuthState) => void): () => void
}
cloud: {
  /** Đồng bộ 2 chiều; người dùng đã xác nhận trước khi gọi. */
  sync(projectPath: string): Promise<CloudSyncReport>
  members(): Promise<{ success: boolean; members?: Array<{ email: string; role: CloudRole }>; error?: string }>
  invite(email: string, role: CloudRole): Promise<{ success: boolean; error?: string }>
  setRole(email: string, role: CloudRole): Promise<{ success: boolean; error?: string }>
}
```

- [ ] **Step 1: Tạo `electron/main/cloudSnapshots.ts` + test**

Test thêm vào `tests/cloudSync.test.mjs`:

```js
import { buildSettingsSnapshot, readSettingsPayload, buildTokensSnapshot, readTokensPayload } from '../electron/main/cloudSnapshots.ts'
import { DEFAULT_SETTINGS } from '../shared/types.ts'
import { DEFAULT_DESIGN_TOKENS } from '../shared/designTokens.ts'

it('snapshot settings có schemaVersion và đọc lại được', () => {
  const payload = buildSettingsSnapshot({ ...DEFAULT_SETTINGS, theme: 'light' })
  assert.equal(payload.schemaVersion, 1)
  assert.equal(readSettingsPayload(payload).theme, 'light')
  assert.equal(readSettingsPayload({ schemaVersion: 999, settings: {} }), null)
  assert.equal(readSettingsPayload('x'), null)
})

it('snapshot tokens có schemaVersion và đọc lại được', () => {
  const payload = buildTokensSnapshot(DEFAULT_DESIGN_TOKENS)
  assert.equal(payload.schemaVersion, 1)
  assert.deepEqual(readTokensPayload(payload), DEFAULT_DESIGN_TOKENS)
  assert.equal(readTokensPayload({ schemaVersion: 1, tokens: null }), null)
})
```

Run để đỏ, rồi cài đặt:
- `buildSettingsSnapshot(settings)` → `{ schemaVersion: 1, settings }` (bỏ `cloudWorkspaceId` khỏi payload để không ghi đè cấu hình máy khác).
- `readSettingsPayload`: chỉ nhận object, `schemaVersion === 1`, `settings` là object → trả `settings` (lọc `cloudWorkspaceId` ra).
- `buildTokensSnapshot` / `readTokensPayload`: cùng quy tắc, yêu cầu `Array.isArray(tokens.colors)`.

- [ ] **Step 2: Khởi tạo auth + cloud trong `index.ts`**

```ts
import { parseEnvText, readSupabaseConfig } from './supabaseConfig'
import { createAuthService } from './auth'
import { createCloudClient } from './supabaseCloud'
import { syncDocs } from './cloudSync'
import { createSecretStore } from './secretStore'
import { buildSettingsSnapshot, readSettingsPayload, buildTokensSnapshot, readTokensPayload } from './cloudSnapshots'
```

Sau khi `app.whenReady()` (chỗ có `mainWindow = new BrowserWindow`):
```ts
const envFile = join(app.getAppPath(), '.env')
const envText = await fs.readFile(envFile, 'utf8').catch(() => '')
const env = { ...parseEnvText(envText), ...process.env }
const supabaseConfig = readSupabaseConfig(env)
const sessionStore = createSecretStore(join(app.getPath('userData'), 'supabase-session.json'), safeStorage)
let memoryRefreshToken: string | null = null
const auth = createAuthService({
  config: supabaseConfig,
  fetchImpl: fetch,
  session: {
    load: async () => (sessionStore.available ? sessionStore.load() : memoryRefreshToken),
    save: async (value) => {
      memoryRefreshToken = value
      if (sessionStore.available) await sessionStore.save(value)
    },
  },
})
auth.onState?.((state) => mainWindow?.webContents.send('auth:state', state)) // nếu AuthService chưa có onState: gọi sendAuthState thủ công sau mỗi thao tác (đơn giản hơn, làm cách này)
void auth.restore()
```
(Chọn cách đơn giản: **không** thêm `onState` vào service; sau mỗi handler gọi `mainWindow?.webContents.send('auth:state', auth.state())`.)

Handlers:
```ts
ipcMain.handle('auth:state', () => auth.state())
ipcMain.handle('auth:sign-in', async (_e, email: string, password: string) => {
  const res = await auth.signIn(email, password)
  mainWindow?.webContents.send('auth:state', res.state)
  return res
})
ipcMain.handle('auth:sign-out', async () => {
  const state = await auth.signOut()
  mainWindow?.webContents.send('auth:state', state)
  return state
})
```

`cloud:sync` handler (điểm mấu chốt của D1-24/D1-25):

```ts
ipcMain.handle('cloud:sync', async (_e, projectPath: string): Promise<CloudSyncReport> => {
  const empty = { ok: false, pushed: [], pulled: [], conflicts: [], skipped: [] }
  if (!supabaseConfig) return { ...empty, error: 'Chưa cấu hình Supabase (SUPABASE_URL / SUPABASE_ANON_KEY).' }
  if (!auth.accessToken()) {
    await auth.refresh()
    if (!auth.accessToken()) return { ...empty, error: auth.state().error || 'Bạn cần đăng nhập để đồng bộ.' }
  }
  const store = await readStore()
  const workspaceId = (store.settings.cloudWorkspaceId || '').trim()
  const email = auth.userEmail()
  if (!workspaceId) return { ...empty, error: 'Chưa nhập Workspace ID trong Cài đặt → Dữ liệu → Cloud.' }
  if (!email) return { ...empty, error: 'Không xác định được email phiên đăng nhập.' }

  const client = createCloudClient({
    baseUrl: supabaseConfig.url, anonKey: supabaseConfig.anonKey,
    accessToken: () => auth.accessToken(), fetchImpl: fetch,
  })
  let role: CloudRole | null = null
  try { role = await client.role(workspaceId, email) } catch (error: any) {
    return { ...empty, error: `Không kiểm tra được quyền: ${error?.message || error}` }
  }
  if (!role) return { ...empty, error: 'Tài khoản này không phải thành viên của workspace.' }
  if (!canWrite(role)) {
    // Viewer chỉ được kéo về, không bao giờ đẩy lên; vẫn báo rõ.
  }

  const local: Array<{ doc: CloudDoc; payload: unknown }> = [
    { doc: 'settings', payload: buildSettingsSnapshot(store.settings) },
  ]
  const tokensFile = join(projectPath || '', '.pixelmind', 'tokens.json')
  try {
    const rawTokens = JSON.parse(await fs.readFile(tokensFile, 'utf8')) as DesignTokens
    if (rawTokens && Array.isArray(rawTokens.colors)) {
      local.push({ doc: 'designTokens', payload: buildTokensSnapshot(rawTokens) })
    }
  } catch { /* dự án chưa có tokens: không đồng bộ tài liệu này */ }

  const syncFile = join(app.getPath('userData'), 'cloud-sync.json')
  const lastSynced = await fs.readFile(syncFile, 'utf8').then((t) => JSON.parse(t)).catch(() => ({}))
  const adapter = {
    pull: (doc: CloudDoc) => client.pull(workspaceId, doc),
    push: async (doc: CloudDoc, payload: unknown) => {
      if (!canWrite(role)) throw new Error('Bạn là Viewer: chỉ được xem workspace, không được ghi dữ liệu.')
      await client.push(workspaceId, doc, payload)
    },
  }

  const report = await syncDocs(adapter, local, {
    lastSynced: lastSynced.docs ?? {},
    onPull: async (doc, payload) => {
      if (doc === 'settings') {
        const incoming = readSettingsPayload(payload)
        if (!incoming) throw new Error('Payload Settings không hợp lệ hoặc sai phiên bản schema.')
        await updateSettings(incoming)
      } else {
        const incoming = readTokensPayload(payload)
        if (!incoming) throw new Error('Payload Design Tokens không hợp lệ hoặc sai phiên bản schema.')
        if (projectPath) {
          const dir = join(projectPath, '.pixelmind')
          await fs.mkdir(dir, { recursive: true })
          await fs.copyFile(join(dir, 'tokens.json'), join(dir, `tokens.backup-${Date.now()}.json`)).catch(() => undefined)
          await fs.writeFile(join(dir, 'tokens.json'), JSON.stringify(incoming, null, 2), 'utf8')
        }
      }
    },
    onPush: async (doc, hash) => {
      lastSynced.docs = { ...(lastSynced.docs ?? {}), [doc]: hash }
      await fs.writeFile(syncFile, JSON.stringify(lastSynced, null, 2), 'utf8')
    },
    onConflict: async (doc, localPayload) => {
      const dir = join(app.getPath('userData'), 'cloud-conflicts')
      await fs.mkdir(dir, { recursive: true })
      const file = join(dir, `${doc}-${Date.now()}.json`)
      await fs.writeFile(file, JSON.stringify(localPayload, null, 2), 'utf8')
      return file
    },
  })

  const result = await syncDocs(adapter, local, hooks)  // dùng đúng biến hooks ở trên
  return result
})
```

**Lưu ý bắt buộc:** gán object hooks vào biến `hooks` rồi truyền, không viết inline, để tránh sai thứ tự/typo.

`cloud:members` / `cloud:invite` / `cloud:setRole`: cùng cách lấy client/workspace/email; bọc try/catch trả `{success:false,error}`; riêng `invite`/`setRole` kiểm tra `role === 'owner'` trước (thông báo "Chỉ Owner mới được chia sẻ workspace."), RLS vẫn là chốt cuối.

- [ ] **Step 3: Preload/api/mock**

Theo Interfaces. Mock (`createBrowserMock`):
- `auth.state` → `{ status:'unconfigured', user:null, expiresAt:null }`, `signIn` → `{ok:false, state:..., error:'Bản giả lập không đăng nhập được.'}`, `signOut` → state signed-out, `onState` → `() => undefined`.
- `cloud.sync` → `{ ok:false, error:'Bản giả lập không đồng bộ cloud.', pushed:[],pulled:[],conflicts:[],skipped:[] }`; `members` → `{success:false,error:'...'}`; `invite`/`setRole` → `{success:false,error:'...'}`.

- [ ] **Step 4: `Settings.cloudWorkspaceId` + test**

`shared/types.ts`: thêm `cloudWorkspaceId?: string` (mặc định `''` trong `DEFAULT_SETTINGS`). Không cần test riêng; typecheck phủ.

- [ ] **Step 5: Chạy kiểm tra**

```powershell
node --experimental-strip-types --test tests/supabaseAuth.test.mjs
node --experimental-strip-types --test tests/cloudSync.test.mjs
node --experimental-strip-types --test tests/cloudRoles.test.mjs
npm run typecheck
```
Expected: PASS hết.

- [ ] **Step 6: Commit**

```bash
git add electron/main/secretStore.ts electron/main/cloudSnapshots.ts electron/main/index.ts shared/types.ts shared/api.ts electron/preload/index.ts src/lib/mock.ts tests/cloudSync.test.mjs
git commit -m "feat(cloud): IPC dang nhap/dong bo, backup xung dot va chan Viewer o main (D1-23, D1-24, D1-25)"
```

---

### Task 5: UI Đăng nhập + Đồng bộ/Chia sẻ

**Files:**
- Create: `src/components/LoginDialog.tsx`
- Create: `src/components/CloudDialog.tsx`
- Modify: `src/App.tsx` (DialogId + menu switch + render)
- Modify: `src/components/SettingsDialog.tsx` (tab `data` dòng 963-1063: thêm input Workspace ID)
- Modify: `electron/main/index.ts` (menu Công cụ: 2 mục mới)
- Modify: `src/styles/desktop.css` (CSS nhỏ)

**Interfaces:**
- `LoginDialog` props: `{ onClose: () => void }`.
- `CloudDialog` props: `{ settings: Settings; projectPath: string | null; onUpdate: (patch: Partial<Settings>) => void; onClose: () => void; onShowToast: (kind: 'ok'|'err'|'info', text: string) => void }`.

- [ ] **Step 1: `LoginDialog.tsx`**

- State: `const [state, setState] = useState<AuthState | null>(null)`, `email`, `password`, `busy`, `error`.
- Mount: `api.auth.state().then(setState)`; subscribe `api.auth.onState(setState)`.
- Nếu `state?.status === 'unconfigured'`:
  hiển thị cảnh báo (`.pm-console-warn`): "Chưa cấu hình Supabase. Thêm `SUPABASE_URL` và `SUPABASE_ANON_KEY` vào file `.env` của ứng dụng rồi khởi động lại." **Không render form đăng nhập.**
- Nếu `signed-in`: hiện email + `Hết hạn: <giờ>` + nút **Đăng xuất** (`api.auth.signOut()`).
- Nếu `signed-out`: form email/password + nút **Đăng nhập**; khi submit:
```tsx
const res = await api.auth.signIn(email.trim(), password)
setState(res.state)
setError(res.ok ? '' : (res.error || 'Đăng nhập thất bại.'))
if (res.ok) { setPassword(''); onShowToast('ok', `Đã đăng nhập: ${res.state.user?.email}`) }
```
  Không lưu email/password vào localStorage. `autoComplete="off"`.
- Hiển thị `state?.error` (nếu có) và `error` trong `.pm-console-warn`.

- [ ] **Step 2: `CloudDialog.tsx`**

- Đọc `settings.cloudWorkspaceId`; input **Workspace ID** + nút **Lưu** (`onUpdate({ cloudWorkspaceId })`).
- Nút **Đồng bộ ngay** (disable khi không có workspaceId/projectPath hoặc đang chạy):
  - Nếu chưa đăng nhập (`api.auth.state()` → không `signed-in`) → toast err "Hãy đăng nhập trước." và không gọi.
  - Gọi `api.cloud.sync(projectPath)`; hiển thị báo cáo:
    - `report.ok === false` → `.pm-console-warn` với `report.error`.
    - Thành công → dòng tổng: `Đã đẩy N · Đã kéo M · Bỏ qua K`.
    - Nếu `report.conflicts.length > 0` → khối cảnh báo liệt kê từng `doc` + `backupPath`: "Bản local đã được sao lưu tại … và bản trên cloud đã được áp dụng."
- Danh sách thành viên: nút **Tải thành viên** → `api.cloud.members()`; bảng email + role + `<select>` đổi role (gọi `api.cloud.setRole`). Chỉ bật select khi role hiện tại của mình là `owner` (lấy từ danh sách thành viên, so email phiên); nếu không phải owner, disable + chú thích "Chỉ Owner mới đổi được quyền."
- Mời: input email + select role (mặc định `viewer`) + nút **Mời**; gọi `api.cloud.invite`; lỗi hiển thị nguyên văn từ server (ví dụ "new row violates row-level security policy" → map sang "Bạn không có quyền mời thành viên." nếu status 403).
- Không hiển thị token.

- [ ] **Step 3: Settings tab Dữ liệu**

Trong pane `data`, thêm `.pm-setting`:
- Label "Workspace Cloud ID"; input value `settings.cloudWorkspaceId ?? ''`, `onChange={(e) => onUpdate({ cloudWorkspaceId: e.target.value.trim() })}`, placeholder UUID.
- Dòng phụ: "Lấy ID sau khi chạy `docs/sql/2026-11-18-cloud.sql` trên Supabase."

- [ ] **Step 4: App + menu**

`src/App.tsx`: `DialogId` thêm `'login' | 'cloud'`; switch:
```tsx
case 'login': setDialog('login'); break
case 'cloud': setDialog('cloud'); break
```
Render:
```tsx
{dialog === 'login' && <LoginDialog onClose={() => setDialog(null)} />}
{dialog === 'cloud' && (
  <CloudDialog
    settings={settings}
    projectPath={project?.path ?? null}
    onUpdate={(patch) => void updateSettings(patch)}
    onShowToast={showToast}
    onClose={() => setDialog(null)}
  />
)}
```
Menu Công cụ (sau mục Mock API):
```ts
{ type: 'separator' },
{ label: 'Đăng nhập Supabase…', click: () => sendMenuAction('login') },
{ label: 'Đồng bộ Cloud & chia sẻ…', click: () => sendMenuAction('cloud') },
```

- [ ] **Step 5: Kiểm tra**

```powershell
npm run typecheck
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/LoginDialog.tsx src/components/CloudDialog.tsx src/App.tsx src/components/SettingsDialog.tsx src/styles/desktop.css electron/main/index.ts
git commit -m "feat(cloud): giao dien dang nhap, dong bo va chia se workspace theo quyen (D1-23, D1-24, D1-25)"
```

---

## Nghiệm thu thủ công

### D1-23 — Đăng nhập

1. **Không cấu hình:** đổi tên `.env` thành `.env.bak`, khởi động app, menu Công cụ → Đăng nhập Supabase → thấy cảnh báo "Chưa cấu hình", **không** có form; trạng thái vẫn chưa đăng nhập.
2. Đặt lại `.env` đúng → khởi động lại → đăng nhập sai mật khẩu → thấy "Email hoặc mật khẩu không đúng.", không có phiên.
3. Đăng nhập đúng → hiện email; đóng app, mở lại → **vẫn đăng nhập** (refresh token đã lưu mã hoá). Kiểm tra `%APPDATA%\pixelmind-desktop\supabase-session.json` không đọc được token bằng text.
4. Đăng xuất → về form đăng nhập; mở lại app → vẫn đăng xuất.

### D1-24 — Đồng bộ hai chiều

1. Chạy `docs/sql/2026-11-18-cloud.sql`; tạo workspace + member owner như hướng dẫn; nhập Workspace ID vào Settings → Dữ liệu.
2. Phiên A (app): đổi `accent` + theme trong Settings → **Đồng bộ ngay** → báo "Đã đẩy 1".
3. Phiên B (máy/thư mục userData khác hoặc script): đăng nhập cùng user → Đồng bộ → nhận đúng `accent`/theme.
4. Phiên B đổi theme → Đồng bộ; Phiên A Đồng bộ → nhận theme mới.
5. Cả hai cùng đổi `accent` khác nhau rồi cùng đồng bộ → phiên sau thấy mục **Xung đột** + đường dẫn file backup trong `%APPDATA%\pixelmind-desktop\cloud-conflicts\`; file backup chứa giá trị local cũ.
6. **Ngắt mạng** (tắt Wi-Fi) → Đồng bộ → báo lỗi kết nối; kiểm tra `pixelmind-store.json` và `.pixelmind/tokens.json` **không đổi** (so sánh `Get-FileHash` trước/sau). Bật mạng → Đồng bộ lại thành công.
7. Tokens: sửa token trong Design Tokens → lưu → Đồng bộ → phiên khác Đồng bộ → `tokens.json` nhận đúng giá trị; file cũ được backup `tokens.backup-*.json`.

### D1-25 — Quyền

1. Owner mời `viewer@example.com` với role `viewer`. Đăng nhập bằng tài khoản Viewer → Settings → Workspace ID → **Đồng bộ ngay** → thấy lỗi "Bạn là Viewer: chỉ được xem workspace, không được ghi dữ liệu." và **không** có dữ liệu nào được đẩy (kiểm tra bảng `pm_snapshots.updated_by`/`updated_at` không đổi).
2. Chạy script kiểm chứng (bằng chứng server-side, không chỉ UI):
```powershell
$env:SUPABASE_URL="..."; $env:SUPABASE_ANON_KEY="..."; $env:VIEWER_EMAIL="..."; $env:VIEWER_PASSWORD="..."; $env:WORKSPACE_ID="..."
node scripts/verify-rls.mjs
```
Expected: `GET → 200` và `POST → 403`, exit code 0.
3. Owner đổi Viewer → Editor → Viewer đăng nhập lại → đồng bộ thành công.

## Không làm (YAGNI)

- Không đăng ký tài khoản/quên mật khẩu trong app (dùng dashboard Supabase).
- Không realtime subscription, không tự động sync nền, không mã hoá payload phía client, không đồng bộ danh sách project/dự án.
- Không phân quyền theo từng tài liệu; role áp cho cả workspace.
