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
  return {
    load: async () => value,
    save: async (v) => {
      value = v
    },
    get value() {
      return value
    },
  }
}

describe('readSupabaseConfig', () => {
  it('đọc biến mới và biến VITE_ cũ', () => {
    assert.deepEqual(readSupabaseConfig({ SUPABASE_URL: CONFIG.url, SUPABASE_ANON_KEY: CONFIG.anonKey }), CONFIG)
    assert.deepEqual(
      readSupabaseConfig({ VITE_SUPABASE_URL: CONFIG.url, VITE_SUPABASE_ANON_KEY: CONFIG.anonKey }),
      CONFIG,
    )
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
      fetchImpl: async () => {
        throw new Error('offline')
      },
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
