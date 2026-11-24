/* ══════════════════════════════════════════════════════════════
   D1-23: LOGIN DIALOG (SUPABASE AUTH)
   Đăng nhập/đăng xuất Supabase, bảo vệ token, không lưu password.
   ══════════════════════════════════════════════════════════════ */

import { AlertTriangle, Eye, EyeOff, Loader2, LogIn, LogOut, ShieldCheck, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AuthState } from '@shared/auth'
import { api } from '../lib/bridge'
import Modal from './Modal'

export interface LoginDialogProps {
  onClose: () => void
  onShowToast?: (kind: 'ok' | 'err' | 'info', text: string) => void
}

export default function LoginDialog({ onClose, onShowToast }: LoginDialogProps) {
  const [state, setState] = useState<AuthState | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void api.auth.state().then(setState)
    const off = api.auth.onState((s) => setState(s))
    return () => off()
  }, [])

  const handleSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!email.trim() || !password || busy) return

    setBusy(true)
    setError('')
    try {
      const res = await api.auth.signIn(email.trim(), password)
      setState(res.state)
      if (res.ok) {
        setPassword('')
        setError('')
        onShowToast?.('ok', `Đã đăng nhập: ${res.state.user?.email}`)
      } else {
        setError(res.error || 'Đăng nhập thất bại.')
      }
    } catch (err) {
      setError((err as Error).message || 'Đăng nhập thất bại.')
    } finally {
      setBusy(false)
    }
  }

  const handleSignOut = async () => {
    setBusy(true)
    try {
      const nextState = await api.auth.signOut()
      setState(nextState)
      setError('')
      onShowToast?.('info', 'Đã đăng xuất tài khoản.')
    } catch (err) {
      setError((err as Error).message || 'Đăng xuất thất bại.')
    } finally {
      setBusy(false)
    }
  }

  const isConfigured = state?.status !== 'unconfigured'
  const isSignedIn = state?.status === 'signed-in'

  return (
    <Modal
      title="Tài khoản Supabase"
      icon={<User size={18} color="var(--accent, #6d5df5)" />}
      onClose={onClose}
      width={480}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
          <button className="pm-btn pm-btn--ghost" onClick={onClose}>
            Đóng
          </button>
          {isConfigured && !isSignedIn && (
            <button
              className="pm-btn pm-btn--primary"
              disabled={busy || !email.trim() || !password}
              onClick={handleSignIn}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {busy ? <Loader2 size={14} className="pm-spin" /> : <LogIn size={14} />}
              Đăng nhập
            </button>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!isConfigured ? (
          <div
            className="pm-console-warn"
            style={{
              padding: '12px 14px',
              borderRadius: 6,
              background: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              color: '#fbbf24',
              fontSize: 12,
              lineHeight: 1.6,
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <b>Chưa cấu hình Supabase</b>
              <div style={{ marginTop: 4 }}>
                Thêm <code>SUPABASE_URL</code> (hoặc <code>VITE_SUPABASE_URL</code>) và <code>SUPABASE_ANON_KEY</code> (hoặc <code>VITE_SUPABASE_ANON_KEY</code>) vào file <code>.env</code> ở thư mục gốc của ứng dụng rồi khởi động lại PixelMind.
              </div>
            </div>
          </div>
        ) : isSignedIn ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                background: 'var(--panel-2, #0f172a)',
                border: '1px solid var(--line, #1e293b)',
                borderRadius: 8,
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#4ade80', fontSize: 13, fontWeight: 600 }}>
                <ShieldCheck size={18} /> Đang đăng nhập
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text, #f8fafc)' }}>
                Email: <b>{state?.user?.email}</b>
              </div>
              {state?.expiresAt && (
                <div style={{ fontSize: 11, color: 'var(--muted, #64748b)' }}>
                  Phiên hết hạn: {new Date(state.expiresAt).toLocaleTimeString()} ({new Date(state.expiresAt).toLocaleDateString()})
                </div>
              )}
            </div>

            <button
              className="pm-btn pm-btn--ghost"
              disabled={busy}
              onClick={handleSignOut}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%' }}
            >
              {busy ? <Loader2 size={14} className="pm-spin" /> : <LogOut size={14} />} Đăng xuất
            </button>
          </div>
        ) : (
          <form onSubmit={handleSignIn} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="pm-desc" style={{ margin: 0 }}>
              Đăng nhập tài khoản Supabase để đồng bộ Cài đặt và Design Tokens lên workspace chia sẻ.
            </p>

            {(error || state?.error) && (
              <div
                className="pm-console-warn"
                style={{
                  padding: '10px 12px',
                  borderRadius: 6,
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  fontSize: 12,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{error || state?.error}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text, #f8fafc)' }}>Email:</label>
              <input
                type="email"
                className="pm-input"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                disabled={busy}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text, #f8fafc)' }}>Mật khẩu:</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="pm-input"
                  style={{ paddingRight: 32 }}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="off"
                  disabled={busy}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  style={{
                    position: 'absolute',
                    right: 4,
                    top: 0,
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 6px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-3)',
                    cursor: 'pointer',
                  }}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </Modal>
  )
}
