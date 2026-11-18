/* ══════════════════════════════════════════════════════════════
   D1-24 & D1-25: CLOUD SYNC & SHARING DIALOG
   Đồng bộ 2 chiều Settings + Tokens, quản lý thành viên và phân vai trò.
   ══════════════════════════════════════════════════════════════ */

import {
  AlertTriangle,
  Check,
  Cloud,
  Loader2,
  RefreshCw,
  UserPlus,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { CloudRole, CloudSyncReport } from '@shared/cloud'
import type { Settings } from '@shared/types'
import { api } from '../lib/bridge'
import Modal from './Modal'

export interface CloudDialogProps {
  settings: Settings
  projectPath: string | null
  onUpdate: (patch: Partial<Settings>) => void
  onClose: () => void
  onShowToast: (kind: 'ok' | 'err' | 'info', text: string) => void
}

export default function CloudDialog({
  settings,
  projectPath,
  onUpdate,
  onClose,
  onShowToast,
}: CloudDialogProps) {
  const [workspaceId, setWorkspaceId] = useState(settings.cloudWorkspaceId || '')
  const [syncing, setSyncing] = useState(false)
  const [report, setReport] = useState<CloudSyncReport | null>(null)

  // Thành viên & Quyền
  const [members, setMembers] = useState<Array<{ email: string; role: CloudRole }>>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<CloudRole>('viewer')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    setWorkspaceId(settings.cloudWorkspaceId || '')
    void api.auth.state().then((s) => {
      setUserEmail(s.user?.email ?? null)
    })
  }, [settings.cloudWorkspaceId])

  const myRole = members.find((m) => m.email.toLowerCase() === userEmail?.toLowerCase())?.role ?? null
  const isOwner = myRole === 'owner'

  const handleSaveWorkspaceId = () => {
    onUpdate({ cloudWorkspaceId: workspaceId.trim() })
    onShowToast('ok', 'Đã lưu Workspace ID.')
  }

  const handleSync = async () => {
    if (!projectPath) {
      onShowToast('err', 'Chưa mở dự án để đồng bộ.')
      return
    }
    const authState = await api.auth.state()
    if (authState.status !== 'signed-in') {
      onShowToast('err', 'Hãy đăng nhập trước khi đồng bộ.')
      return
    }

    setSyncing(true)
    setReport(null)
    try {
      const res = await api.cloud.sync(projectPath)
      setReport(res)
      if (res.ok) {
        onShowToast('ok', 'Đồng bộ Cloud hoàn tất!')
      } else {
        onShowToast('err', res.error || 'Đồng bộ thất bại.')
      }
    } catch (err) {
      const msg = (err as Error).message || String(err)
      setReport({ ok: false, error: msg, pushed: [], pulled: [], conflicts: [], skipped: [] })
      onShowToast('err', msg)
    } finally {
      setSyncing(false)
    }
  }

  const handleLoadMembers = async () => {
    setLoadingMembers(true)
    try {
      const res = await api.cloud.members()
      if (res.success && res.members) {
        setMembers(res.members)
      } else {
        onShowToast('err', res.error || 'Không tải được danh sách thành viên.')
      }
    } catch (err) {
      onShowToast('err', (err as Error).message || 'Lỗi khi tải thành viên.')
    } finally {
      setLoadingMembers(false)
    }
  }

  const handleInvite = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!inviteEmail.trim() || inviteBusy) return

    setInviteBusy(true)
    try {
      const res = await api.cloud.invite(inviteEmail.trim(), inviteRole)
      if (res.success) {
        onShowToast('ok', `Đã mời ${inviteEmail.trim()} làm ${inviteRole}.`)
        setInviteEmail('')
        void handleLoadMembers()
      } else {
        onShowToast('err', res.error || 'Mời thành viên thất bại.')
      }
    } catch (err) {
      onShowToast('err', (err as Error).message || 'Mời thành viên thất bại.')
    } finally {
      setInviteBusy(false)
    }
  }

  const handleRoleChange = async (targetEmail: string, nextRole: CloudRole) => {
    try {
      const res = await api.cloud.setRole(targetEmail, nextRole)
      if (res.success) {
        onShowToast('ok', `Đã cập nhật quyền của ${targetEmail} thành ${nextRole}.`)
        setMembers((prev) =>
          prev.map((m) => (m.email === targetEmail ? { ...m, role: nextRole } : m)),
        )
      } else {
        onShowToast('err', res.error || 'Cập nhật vai trò thất bại.')
      }
    } catch (err) {
      onShowToast('err', (err as Error).message || 'Lỗi khi cập nhật vai trò.')
    }
  }

  return (
    <Modal
      title="Đồng bộ Cloud &amp; Chia sẻ Workspace"
      icon={<Cloud size={18} color="var(--accent, #6d5df5)" />}
      onClose={onClose}
      width={640}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
          <button className="pm-btn pm-btn--ghost" onClick={onClose}>
            Đóng
          </button>
          <button
            className="pm-btn pm-btn--primary"
            disabled={syncing || !workspaceId.trim() || !projectPath}
            onClick={handleSync}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {syncing ? <Loader2 size={14} className="pm-spin" /> : <RefreshCw size={14} />}
            Đồng bộ ngay
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Workspace ID */}
        <div
          style={{
            background: 'var(--panel-2, #0f172a)',
            border: '1px solid var(--line, #1e293b)',
            borderRadius: 8,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b style={{ fontSize: 12.5, color: 'var(--text, #f8fafc)' }}>Mã không gian làm việc (Workspace ID)</b>
            {workspaceId !== (settings.cloudWorkspaceId || '') && (
              <button className="pm-btn pm-btn--primary" style={{ padding: '3px 8px', fontSize: 11 }} onClick={handleSaveWorkspaceId}>
                Lưu ID
              </button>
            )}
          </div>
          <input
            type="text"
            className="pm-input"
            placeholder="uuid-workspace-tu-supabase"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
          />
          <div style={{ fontSize: 11, color: 'var(--muted, #64748b)' }}>
            Lấy ID sau khi chạy file SQL <code>docs/sql/2026-11-18-cloud.sql</code> trên Supabase Dashboard.
          </div>
        </div>

        {/* Báo cáo đồng bộ */}
        {report && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 6,
              background: report.ok ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${report.ok ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              fontSize: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {report.ok ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4ade80', fontWeight: 600 }}>
                <Check size={16} /> Đồng bộ thành công: Đã đẩy {report.pushed.length} · Đã kéo {report.pulled.length} · Bỏ qua {report.skipped.length}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, color: '#f87171' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{report.error || 'Đồng bộ thất bại.'}</span>
              </div>
            )}

            {/* Xung đột nếu có */}
            {report.conflicts.length > 0 && (
              <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', padding: 8, borderRadius: 6, color: '#fbbf24', fontSize: 11.5 }}>
                <b>Phát hiện xung đột dữ liệu:</b>
                {report.conflicts.map((c, i) => (
                  <div key={i} style={{ marginTop: 4 }}>
                    • Bản cục bộ của <code>{c.doc}</code> đã được sao lưu tại <code>{c.backupPath}</code> và bản trên cloud đã được áp dụng.
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Danh sách thành viên & Phân vai trò */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text, #f8fafc)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={15} color="var(--accent, #6d5df5)" /> Thành viên Workspace ({members.length})
            </span>
            <button
              className="pm-btn pm-btn--ghost"
              disabled={loadingMembers || !workspaceId.trim()}
              onClick={handleLoadMembers}
              style={{ fontSize: 11, padding: '3px 8px' }}
            >
              {loadingMembers ? <Loader2 size={12} className="pm-spin" /> : <RefreshCw size={12} />} Tải thành viên
            </button>
          </div>

          {members.length > 0 && (
            <div
              style={{
                border: '1px solid var(--line, #1e293b)',
                borderRadius: 6,
                overflow: 'hidden',
                background: 'var(--panel-2, #0f172a)',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line, #1e293b)', color: 'var(--muted, #64748b)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>Email</th>
                    <th style={{ padding: '8px 12px', width: 140 }}>Vai trò</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.email} style={{ borderBottom: '1px solid var(--line, #1e293b)' }}>
                      <td style={{ padding: '8px 12px', color: 'var(--text, #f8fafc)' }}>
                        {m.email} {m.email === userEmail && <span style={{ color: 'var(--accent, #6d5df5)', fontSize: 11 }}>(Bạn)</span>}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <select
                          className="pm-select"
                          value={m.role}
                          disabled={!isOwner}
                          onChange={(e) => handleRoleChange(m.email, e.target.value as CloudRole)}
                          style={{ padding: '2px 6px', fontSize: 11.5 }}
                        >
                          <option value="owner">Owner (Chủ)</option>
                          <option value="editor">Editor (Sửa)</option>
                          <option value="viewer">Viewer (Xem)</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!isOwner && members.length > 0 && (
                <div style={{ padding: '6px 12px', fontSize: 10.5, color: 'var(--muted, #64748b)', fontStyle: 'italic' }}>
                  Chỉ Owner mới có quyền thay đổi vai trò hoặc mời thêm thành viên.
                </div>
              )}
            </div>
          )}

          {/* Form mời thành viên mới */}
          {isOwner && (
            <form
              onSubmit={handleInvite}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                background: 'var(--panel-2, #0f172a)',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--line, #1e293b)',
              }}
            >
              <input
                type="email"
                className="pm-input"
                placeholder="email-thanh-vien@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                style={{ flex: 1, fontSize: 11.5 }}
                required
              />
              <select
                className="pm-select"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as CloudRole)}
                style={{ width: 110, fontSize: 11.5 }}
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="owner">Owner</option>
              </select>
              <button
                type="submit"
                className="pm-btn pm-btn--primary"
                disabled={inviteBusy || !inviteEmail.trim()}
                style={{ fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                {inviteBusy ? <Loader2 size={12} className="pm-spin" /> : <UserPlus size={12} />} Mời
              </button>
            </form>
          )}
        </div>
      </div>
    </Modal>
  )
}
