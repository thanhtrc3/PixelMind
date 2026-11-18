/* ══════════════════════════════════════════════════════════════
   D1-23: AUTH SERVICE SUPABASE (MAIN PROCESS)
   Module thuần không import 'electron', gọi GoTrue REST bằng fetch.
   ══════════════════════════════════════════════════════════════ */

import type { AuthState, SignInResult } from '../../shared/auth.ts'
import type { SupabaseConfig } from './supabaseConfig.ts'

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

export function authErrorMessage(status: number, body: unknown): string {
  const b = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  const rawMsg = String(b.error_description || b.msg || b.message || b.error || '')

  if ((status === 400 || status === 401) && /invalid login|invalid credentials/i.test(rawMsg)) {
    return 'Email hoặc mật khẩu không đúng.'
  }
  if (/not confirmed/i.test(rawMsg)) {
    return 'Tài khoản chưa xác nhận email. Hãy kiểm tra hộp thư.'
  }
  if (status === 429 || /too many requests/i.test(rawMsg)) {
    return 'Bạn thử quá nhiều lần. Hãy chờ một phút rồi thử lại.'
  }
  if (status >= 500) {
    return `Supabase đang lỗi (mã ${status}). Thử lại sau.`
  }
  return rawMsg ? `Đăng nhập thất bại: ${rawMsg}` : `Đăng nhập thất bại (mã ${status}).`
}

export function createAuthService(deps: AuthDeps): AuthService {
  const now = deps.now ?? (() => Date.now())

  let currentAccessToken: string | null = null
  let currentRefreshToken: string | null = null
  let tokenExpiresAt: number | null = null

  let currentState: AuthState = deps.config
    ? { status: 'signed-out', user: null, expiresAt: null }
    : { status: 'unconfigured', user: null, expiresAt: null }

  return {
    state(): AuthState {
      return { ...currentState }
    },

    accessToken(): string | null {
      if (!currentAccessToken || !tokenExpiresAt) return null
      // Trả null nếu token sắp hết hạn trong vòng 60 giây
      if (now() >= tokenExpiresAt - 60_000) return null
      return currentAccessToken
    },

    userEmail(): string | null {
      return currentState.user?.email ?? null
    },

    async signIn(email: string, password: string): Promise<SignInResult> {
      if (!deps.config) {
        const error = 'Chưa cấu hình Supabase.'
        currentState = { status: 'unconfigured', user: null, expiresAt: null, error }
        return { ok: false, state: { ...currentState }, error }
      }

      const url = `${deps.config.url}/auth/v1/token?grant_type=password`
      const headers = {
        apikey: deps.config.anonKey,
        'Content-Type': 'application/json',
      }

      try {
        const res = await deps.fetchImpl(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ email, password }),
        })

        let body: any = null
        try {
          body = await res.json()
        } catch {
          body = {}
        }

        if (!res.ok) {
          const error = authErrorMessage(res.status, body)
          currentAccessToken = null
          currentRefreshToken = null
          tokenExpiresAt = null
          currentState = { status: 'signed-out', user: null, expiresAt: null, error }
          return { ok: false, state: { ...currentState }, error }
        }

        currentAccessToken = body.access_token
        currentRefreshToken = body.refresh_token
        const expiresInSec = typeof body.expires_in === 'number' ? body.expires_in : 3600
        tokenExpiresAt = now() + expiresInSec * 1000

        await deps.session.save(currentRefreshToken)

        currentState = {
          status: 'signed-in',
          user: {
            id: body.user?.id || '',
            email: body.user?.email || email,
          },
          expiresAt: tokenExpiresAt,
        }

        return { ok: true, state: { ...currentState } }
      } catch {
        const error = 'Không kết nối được Supabase. Kiểm tra mạng rồi thử lại.'
        currentAccessToken = null
        currentRefreshToken = null
        tokenExpiresAt = null
        currentState = { status: 'signed-out', user: null, expiresAt: null, error }
        return { ok: false, state: { ...currentState }, error }
      }
    },

    async refresh(): Promise<AuthState> {
      if (!deps.config) {
        currentState = { status: 'unconfigured', user: null, expiresAt: null }
        return { ...currentState }
      }

      const rt = currentRefreshToken || (await deps.session.load())
      if (!rt) {
        currentState = { status: 'signed-out', user: null, expiresAt: null }
        return { ...currentState }
      }

      const url = `${deps.config.url}/auth/v1/token?grant_type=refresh_token`
      const headers = {
        apikey: deps.config.anonKey,
        'Content-Type': 'application/json',
      }

      try {
        const res = await deps.fetchImpl(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ refresh_token: rt }),
        })

        let body: any = null
        try {
          body = await res.json()
        } catch {
          body = {}
        }

        if (!res.ok) {
          // Token hỏng hoặc thu hồi -> xoá session
          if (res.status === 400 || res.status === 401) {
            await deps.session.save(null)
            currentAccessToken = null
            currentRefreshToken = null
            tokenExpiresAt = null
            currentState = {
              status: 'signed-out',
              user: null,
              expiresAt: null,
              error: 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.',
            }
            return { ...currentState }
          }
          const error = authErrorMessage(res.status, body)
          currentState = { status: 'signed-out', user: null, expiresAt: null, error }
          return { ...currentState }
        }

        currentAccessToken = body.access_token
        currentRefreshToken = body.refresh_token || rt
        const expiresInSec = typeof body.expires_in === 'number' ? body.expires_in : 3600
        tokenExpiresAt = now() + expiresInSec * 1000

        await deps.session.save(currentRefreshToken)

        currentState = {
          status: 'signed-in',
          user: {
            id: body.user?.id || currentState.user?.id || '',
            email: body.user?.email || currentState.user?.email || '',
          },
          expiresAt: tokenExpiresAt,
        }

        return { ...currentState }
      } catch {
        // Lỗi mạng: giữ token cũ, không xoá phiên để lần sau thử lại
        currentState = {
          status: 'signed-out',
          user: null,
          expiresAt: null,
          error: 'Không kết nối được Supabase. Kiểm tra mạng rồi thử lại.',
        }
        return { ...currentState }
      }
    },

    async restore(): Promise<AuthState> {
      if (!deps.config) {
        currentState = { status: 'unconfigured', user: null, expiresAt: null }
        return { ...currentState }
      }

      const savedToken = await deps.session.load()
      if (!savedToken) {
        currentState = { status: 'signed-out', user: null, expiresAt: null }
        return { ...currentState }
      }

      currentRefreshToken = savedToken
      return this.refresh()
    },

    async signOut(): Promise<AuthState> {
      if (deps.config && currentAccessToken) {
        const url = `${deps.config.url}/auth/v1/logout`
        const headers = {
          apikey: deps.config.anonKey,
          Authorization: `Bearer ${currentAccessToken}`,
        }
        try {
          await deps.fetchImpl(url, { method: 'POST', headers })
        } catch {
          // Bỏ qua lỗi logout mạng
        }
      }

      currentAccessToken = null
      currentRefreshToken = null
      tokenExpiresAt = null
      await deps.session.save(null)

      currentState = deps.config
        ? { status: 'signed-out', user: null, expiresAt: null }
        : { status: 'unconfigured', user: null, expiresAt: null }

      return { ...currentState }
    },
  }
}
