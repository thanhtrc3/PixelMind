/* ══════════════════════════════════════════════════════════════
   D1-23: MO HINH XAC THUC SUPABASE (SHARED)
   Khong chua token, chi chua trang thai phien phuc vu UI renderer.
   ══════════════════════════════════════════════════════════════ */

export type AuthStatus = 'unconfigured' | 'signed-out' | 'signed-in'

export interface AuthUser {
  id: string
  email: string
}

export interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  expiresAt: number | null
  error?: string
}

export interface SignInResult {
  ok: boolean
  state: AuthState
  error?: string
}
