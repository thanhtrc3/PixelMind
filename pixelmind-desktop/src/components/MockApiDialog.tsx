/* ══════════════════════════════════════════════════════════════
   D1-21: MOCK API DIALOG
   Cấu hình routes và điều khiển HTTP server mock cục bộ.
   ══════════════════════════════════════════════════════════════ */

import { AlertTriangle, Check, Copy, Play, Plus, Server, Square, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { MockApiConfig, MockApiState, MockHttpMethod, MockRoute } from '@shared/mockApi'
import { MOCK_METHODS, emptyMockState } from '@shared/mockApi'
import { api } from '../lib/bridge'
import Modal from './Modal'

interface MockApiDialogProps {
  projectPath: string | null
  onClose: () => void
  onShowToast?: (kind: 'ok' | 'err' | 'info', text: string) => void
}

const DEFAULT_CONFIG: MockApiConfig = {
  port: 4500,
  routes: [
    {
      id: 'r_init',
      method: 'GET',
      path: '/api/users',
      status: 200,
      body: '[\n  { "id": 1, "name": "Nguyễn Văn A" },\n  { "id": 2, "name": "Trần Thị B" }\n]',
    },
  ],
}

export default function MockApiDialog({ projectPath, onClose, onShowToast }: MockApiDialogProps) {
  const [config, setConfig] = useState<MockApiConfig>(DEFAULT_CONFIG)
  const [serverState, setServerState] = useState<MockApiState>(emptyMockState())
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!projectPath) return
    void api.mock.load(projectPath).then((saved) => {
      if (saved && Array.isArray(saved.routes)) {
        setConfig(saved)
      }
    })
    void api.mock.state().then(setServerState)
    const off = api.mock.onState((s) => setServerState(s))
    return () => off()
  }, [projectPath])

  const handleSave = async () => {
    if (!projectPath) return
    setBusy(true)
    try {
      const res = await api.mock.save(projectPath, config)
      if (!res.success) {
        setErrors(res.errors || ['Lỗi không xác định khi lưu cấu hình.'])
      } else {
        setErrors([])
        onShowToast?.('ok', 'Đã lưu cấu hình Mock API cho dự án.')
      }
    } finally {
      setBusy(false)
    }
  }

  const handleStart = async () => {
    if (!projectPath) return
    setBusy(true)
    setErrors([])
    try {
      const s = await api.mock.start(projectPath, config)
      setServerState(s)
      if (s.error) {
        setErrors([s.error])
      } else {
        onShowToast?.('ok', `Mock API đang chạy tại ${s.url}`)
      }
    } finally {
      setBusy(false)
    }
  }

  const handleStop = async () => {
    setBusy(true)
    try {
      const s = await api.mock.stop()
      setServerState(s)
      onShowToast?.('info', 'Đã dừng Mock API.')
    } finally {
      setBusy(false)
    }
  }

  const addRoute = () => {
    const newRoute: MockRoute = {
      id: `r_${Date.now().toString(36)}`,
      method: 'GET',
      path: '/api/data',
      status: 200,
      body: '{\n  "ok": true\n}',
    }
    setConfig((prev) => ({
      ...prev,
      routes: [...prev.routes, newRoute],
    }))
  }

  const updateRoute = (id: string, patch: Partial<MockRoute>) => {
    setConfig((prev) => ({
      ...prev,
      routes: prev.routes.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }))
  }

  const removeRoute = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      routes: prev.routes.filter((r) => r.id !== id),
    }))
  }

  const copyUrl = () => {
    if (!serverState.url) return
    void navigator.clipboard.writeText(serverState.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
    onShowToast?.('ok', 'Đã sao chép URL Mock API vào clipboard!')
  }

  return (
    <Modal
      title="Mock API cho dự án thử nghiệm"
      subtitle={projectPath ? `Dự án: ${projectPath}` : 'Chưa mở dự án nào'}
      icon={<Server size={18} className="pm-accent" />}
      width={820}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={handleSave} disabled={!projectPath || busy}>
            Lưu cấu hình
          </button>
          <div className="grow" />
          <button className="btn" onClick={onClose}>
            Đóng
          </button>
          {serverState.running ? (
            <button className="btn danger" onClick={handleStop} disabled={busy}>
              <Square size={13} /> Dừng server
            </button>
          ) : (
            <button className="btn primary" onClick={handleStart} disabled={!projectPath || busy}>
              <Play size={13} /> Khởi động server
            </button>
          )}
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!projectPath && (
          <div className="pm-console-warn" style={{ padding: 10, borderRadius: 6, fontSize: 12 }}>
            Hãy mở một dự án trước khi sử dụng Mock API.
          </div>
        )}

        {/* Trạng thái server & Cổng */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            background: 'var(--panel-2, #1e293b)',
            borderRadius: 8,
            border: '1px solid var(--line, #334155)',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: serverState.running ? '#22c55e' : '#94a3b8',
                display: 'inline-block',
              }}
            />
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                {serverState.running ? 'Server đang hoạt động' : 'Server đã dừng'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>
                {serverState.running ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    URL: <code style={{ color: '#38bdf8' }}>{serverState.url}</code>
                    <button
                      className="btn ghost sm"
                      onClick={copyUrl}
                      style={{ padding: '2px 6px', height: 20, fontSize: 10.5 }}
                      title="Sao chép URL"
                    >
                      {copied ? <Check size={11} color="#22c55e" /> : <Copy size={11} />} {copied ? 'Đã chép' : 'Chép'}
                    </button>
                  </span>
                ) : (
                  'Chỉ mở cổng cục bộ 127.0.0.1, hỗ trợ CORS đầy đủ'
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 11.5, color: 'var(--muted, #94a3b8)' }}>Cổng (Port):</label>
            <input
              type="number"
              min={0}
              max={65535}
              disabled={serverState.running}
              value={config.port}
              onChange={(e) => setConfig((prev) => ({ ...prev, port: Number(e.target.value) || 0 }))}
              style={{
                width: 80,
                height: 28,
                borderRadius: 4,
                background: 'var(--panel, #0f172a)',
                color: 'var(--text, #f8fafc)',
                border: '1px solid var(--line, #334155)',
                padding: '0 8px',
                fontSize: 12,
              }}
            />
            <span style={{ fontSize: 10.5, color: 'var(--muted, #64748b)' }}>(0 = tự chọn)</span>
          </div>
        </div>

        {/* Lỗi cảnh báo */}
        {(errors.length > 0 || serverState.error) && (
          <div
            className="pm-console-warn"
            style={{
              padding: 10,
              borderRadius: 6,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: 11.5,
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              {serverState.error && <div>{serverState.error}</div>}
              {errors.map((err, i) => (
                <div key={i}>{err}</div>
              ))}
            </div>
          </div>
        )}

        {/* Danh sách Routes */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text, #f8fafc)' }}>
              Danh sách Routes ({config.routes.length})
            </span>
            <button className="btn secondary sm" onClick={addRoute} disabled={!projectPath}>
              <Plus size={12} /> Thêm Route
            </button>
          </div>

          <div
            style={{
              maxHeight: 280,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              paddingRight: 4,
            }}
          >
            {config.routes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted, #64748b)', fontSize: 12 }}>
                Chưa có route nào. Nhấn “Thêm Route” để bắt đầu.
              </div>
            ) : (
              config.routes.map((route) => (
                <div className="pm-mock-row" key={route.id}>
                  <select
                    value={route.method}
                    onChange={(e) => updateRoute(route.id, { method: e.target.value as MockHttpMethod })}
                    style={{
                      height: 28,
                      borderRadius: 4,
                      background: 'var(--panel-2, #1e293b)',
                      color: 'var(--text, #f8fafc)',
                      border: '1px solid var(--line, #334155)',
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '0 4px',
                    }}
                  >
                    {MOCK_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={route.path}
                    placeholder="/api/example"
                    onChange={(e) => updateRoute(route.id, { path: e.target.value })}
                    style={{
                      height: 28,
                      borderRadius: 4,
                      background: 'var(--panel-2, #1e293b)',
                      color: 'var(--text, #f8fafc)',
                      border: '1px solid var(--line, #334155)',
                      padding: '0 8px',
                      fontSize: 11.5,
                      fontFamily: 'monospace',
                    }}
                  />

                  <input
                    type="number"
                    min={100}
                    max={599}
                    value={route.status}
                    placeholder="200"
                    onChange={(e) => updateRoute(route.id, { status: Number(e.target.value) || 200 })}
                    style={{
                      height: 28,
                      borderRadius: 4,
                      background: 'var(--panel-2, #1e293b)',
                      color: 'var(--text, #f8fafc)',
                      border: '1px solid var(--line, #334155)',
                      padding: '0 6px',
                      fontSize: 11.5,
                    }}
                  />

                  <textarea
                    rows={2}
                    value={route.body}
                    placeholder='{"ok":true}'
                    onChange={(e) => updateRoute(route.id, { body: e.target.value })}
                    style={{
                      borderRadius: 4,
                      background: 'var(--panel-2, #1e293b)',
                      color: 'var(--text, #f8fafc)',
                      border: '1px solid var(--line, #334155)',
                      padding: '4px 8px',
                      fontSize: 11,
                      fontFamily: 'monospace',
                      resize: 'vertical',
                      lineHeight: 1.35,
                    }}
                  />

                  <button
                    className="btn ghost sm"
                    onClick={() => removeRoute(route.id)}
                    title="Xoá route này"
                    style={{ height: 28, color: '#f87171' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Nhật ký yêu cầu (Calls) */}
        {serverState.calls.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text, #f8fafc)', marginBottom: 6 }}>
              Nhật ký gọi API gần nhất ({serverState.calls.length})
            </div>
            <div
              style={{
                maxHeight: 120,
                overflowY: 'auto',
                background: 'var(--panel-2, #0f172a)',
                borderRadius: 6,
                border: '1px solid var(--line, #1e293b)',
                padding: '6px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                fontFamily: 'monospace',
                fontSize: 11,
              }}
            >
              {[...serverState.calls].reverse().map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, color: c.status >= 400 ? '#f87171' : '#4ade80' }}>
                  <span style={{ color: 'var(--muted, #64748b)' }}>{new Date(c.at).toLocaleTimeString()}</span>
                  <span style={{ fontWeight: 600 }}>{c.method}</span>
                  <span style={{ color: 'var(--text, #f8fafc)' }}>{c.path}</span>
                  <span style={{ marginLeft: 'auto' }}>→ {c.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
