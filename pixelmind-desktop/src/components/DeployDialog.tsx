/* ══════════════════════════════════════════════════════════════
   D1-26: DEPLOY / PREVIEW URL DIALOG
   Triển khai dự án lên Vercel / Netlify / Custom CLI và hiển thị URL.
   ══════════════════════════════════════════════════════════════ */

import { AlertTriangle, Check, Copy, ExternalLink, Globe, Loader2, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ProjectRecord, Settings } from '@shared/types'
import type { DeployLog, DeployState } from '@shared/deploy'
import { idleDeployState } from '@shared/deploy'
import { api } from '../lib/bridge'
import Modal from './Modal'

export interface DeployDialogProps {
  project: ProjectRecord
  settings: Settings
  onClose: () => void
  onShowToast: (kind: 'ok' | 'err' | 'info', text: string) => void
}

export default function DeployDialog({ project, settings, onClose, onShowToast }: DeployDialogProps) {
  const [state, setState] = useState<DeployState>(idleDeployState())
  const [logs, setLogs] = useState<DeployLog[]>([])
  const [copied, setCopied] = useState(false)
  const logRef = useRef<HTMLPreElement | null>(null)

  const provider = settings.deployProvider || 'vercel'
  const command = (settings.deployCommand || '').trim()

  useEffect(() => {
    void api.deploy.state().then(setState)

    const offState = api.deploy.onState((s) => setState(s))
    const offLog = api.deploy.onLog((log) => {
      setLogs((prev) => {
        const next = [...prev, log]
        return next.length > 500 ? next.slice(next.length - 500) : next
      })
    })

    return () => {
      offState()
      offLog()
    }
  }, [])

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  const handleStartDeploy = async () => {
    if (state.status === 'running') return
    setLogs([])
    try {
      const res = await api.deploy.start(project.id)
      setState(res)
      if (res.error) {
        onShowToast('err', res.error)
      } else if (res.status === 'success') {
        onShowToast('ok', 'Triển khai thành công!')
      }
    } catch (err) {
      const msg = (err as Error).message || String(err)
      onShowToast('err', msg)
    }
  }

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    onShowToast('ok', 'Đã sao chép URL vào khay nhớ tạm.')
  }

  const handleOpenExternal = (url: string) => {
    api.system.openExternal(url).catch(() => {
      window.open(url, '_blank', 'noopener')
    })
  }

  const activeUrl = state.url || project.meta?.deployUrl

  return (
    <Modal
      title="Triển khai &amp; Preview URL"
      icon={<Globe size={18} color="var(--accent, #6d5df5)" />}
      onClose={onClose}
      width={680}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
          <button className="pm-btn pm-btn--ghost" onClick={onClose}>
            Đóng
          </button>
          <button
            className="pm-btn pm-btn--primary"
            disabled={state.status === 'running' || !command}
            onClick={handleStartDeploy}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {state.status === 'running' ? (
              <>
                <Loader2 size={14} className="pm-spin" /> {state.phase || 'Đang triển khai…'}
              </>
            ) : (
              <>
                <Play size={14} /> Triển khai ngay
              </>
            )}
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Thông tin cấu hình hiện tại */}
        <div
          style={{
            background: 'var(--panel-2, #0f172a)',
            border: '1px solid var(--line, #1e293b)',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--muted, #64748b)' }}>Nền tảng:</span>
            <b style={{ color: 'var(--text, #f8fafc)', textTransform: 'capitalize' }}>{provider}</b>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--muted, #64748b)' }}>Lệnh thực thi:</span>
            <code style={{ fontSize: 11, color: command ? 'var(--accent, #6d5df5)' : 'var(--muted, #64748b)' }}>
              {command || '(chưa cấu hình)'}
            </code>
          </div>
          {project.meta?.deployUrl && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line, #1e293b)', paddingTop: 6 }}>
              <span style={{ color: 'var(--muted, #64748b)' }}>Lần triển khai trước:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <a
                  href={project.meta.deployUrl}
                  onClick={(e) => {
                    e.preventDefault()
                    handleOpenExternal(project.meta.deployUrl!)
                  }}
                  style={{ color: '#38bdf8', textDecoration: 'underline', fontSize: 11.5 }}
                >
                  {project.meta.deployUrl}
                </a>
                {project.meta.deployAt && (
                  <span style={{ color: 'var(--muted, #64748b)', fontSize: 10.5 }}>
                    ({new Date(project.meta.deployAt).toLocaleDateString()})
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Cảnh báo chưa có lệnh */}
        {!command && (
          <div
            className="pm-console-warn"
            style={{
              padding: '10px 14px',
              borderRadius: 6,
              background: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              color: '#fbbf24',
              fontSize: 12,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>
              Chưa cấu hình lệnh triển khai. Hãy vào <b>Cài đặt → Triển khai</b> để nhập lệnh CLI (ví dụ: <code>vercel deploy --prod --yes</code>) và token.
            </span>
          </div>
        )}

        {/* Lỗi triển khai nếu có */}
        {state.status === 'error' && state.error && (
          <div
            className="pm-console-warn"
            style={{
              padding: '10px 14px',
              borderRadius: 6,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: 12,
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <b>Lỗi triển khai:</b>
              <div style={{ marginTop: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{state.error}</div>
            </div>
          </div>
        )}

        {/* Thành công: hiển thị URL */}
        {state.status === 'success' && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 6,
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4ade80', fontSize: 12.5, fontWeight: 600 }}>
              <Check size={16} /> Triển khai thành công!
            </div>
            {activeUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--panel-2, #0f172a)', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line, #1e293b)' }}>
                <a
                  href={activeUrl}
                  onClick={(e) => {
                    e.preventDefault()
                    handleOpenExternal(activeUrl)
                  }}
                  style={{ color: '#38bdf8', textDecoration: 'underline', fontSize: 12.5, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {activeUrl}
                </a>
                <button
                  className="pm-btn pm-btn--ghost"
                  onClick={() => handleCopyUrl(activeUrl)}
                  title="Sao chép URL"
                  style={{ padding: '4px 8px', fontSize: 11 }}
                >
                  {copied ? <Check size={12} color="#4ade80" /> : <Copy size={12} />} Sao chép
                </button>
                <button
                  className="pm-btn pm-btn--ghost"
                  onClick={() => handleOpenExternal(activeUrl)}
                  title="Mở trong trình duyệt ngoài"
                  style={{ padding: '4px 8px', fontSize: 11 }}
                >
                  <ExternalLink size={12} /> Mở
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 11.5, color: 'var(--muted, #64748b)' }}>
                Không tìm thấy URL trong output của lệnh deploy. Kiểm tra nhật ký bên dưới.
              </div>
            )}
          </div>
        )}

        {/* Nhật ký Deploy */}
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text, #f8fafc)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span>Nhật ký triển khai ({logs.length} dòng)</span>
            {logs.length > 0 && (
              <button
                className="pm-btn pm-btn--ghost"
                onClick={() => setLogs([])}
                style={{ padding: '2px 6px', fontSize: 10.5 }}
              >
                Xoá nhật ký
              </button>
            )}
          </div>
          <pre
            ref={logRef}
            className="pm-deploy-log"
            style={{
              margin: 0,
              padding: 10,
              height: 220,
              overflowY: 'auto',
              background: '#0a0d14',
              borderRadius: 6,
              border: '1px solid var(--line, #1e293b)',
              fontFamily: 'Consolas, "JetBrains Mono", monospace',
              fontSize: 11,
              lineHeight: 1.5,
              color: '#cbd5e1',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {logs.length === 0 ? (
              <span style={{ color: '#475569' }}>Chưa có nhật ký. Bấm &quot;Triển khai ngay&quot; để bắt đầu.</span>
            ) : (
              logs.map((l, i) => (
                <span
                  key={i}
                  style={{
                    color: l.stream === 'stderr' ? '#f87171' : l.stream === 'system' ? '#38bdf8' : '#e2e8f0',
                  }}
                >
                  {l.text}
                </span>
              ))
            )}
          </pre>
        </div>
      </div>
    </Modal>
  )
}
