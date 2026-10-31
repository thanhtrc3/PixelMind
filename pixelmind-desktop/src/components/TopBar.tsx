import { useState } from 'react'
import {
  Camera,
  ChevronDown,
  FolderOpen,
  FolderSearch,
  GitCompare,
  HelpCircle,
  Monitor,
  Play,
  Redo2,
  RefreshCw,
  Settings as SettingsIcon,
  Share2,
  Square,
  Undo2,
  User,
  Shield,
} from 'lucide-react'
import type { ProjectRecord, RunState } from '@shared/types'
import { shortPath } from '../lib/format'

interface TopBarProps {
  project: ProjectRecord | null
  run: RunState | null
  home?: string
  onOpenFolder: () => void
  onRun: () => void
  onStop: () => void
  onProjects: () => void
  onSettings: () => void
  onGuide: () => void
  onPalette: () => void
  onRefresh: () => void
  onOpenPreview: () => void
}

const AI_PROFILES = [
  { id: 'antigravity', label: 'Antigravity IDE', status: 'ok' },
  { id: 'ollama', label: 'Ollama · qwen2.5-coder', status: 'ok' },
  { id: 'gpt4o', label: 'GPT-4o · Cloud API', status: 'warn' },
  { id: 'claude', label: 'Claude 3.5 Sonnet', status: 'ok' },
]

const TopBar = ({
  project,
  run,
  home,
  onOpenFolder,
  onRun,
  onStop,
  onProjects,
  onSettings,
  onGuide,
  onPalette,
  onRefresh,
  onOpenPreview,
}: TopBarProps) => {
  const running = run?.status === 'running' || run?.status === 'starting'

  const [aiProfile, setAiProfile] = useState(AI_PROFILES[0])
  const [aiMenuOpen, setAiMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  return (
    <header className="pm-topbar">
      {/* ── Thương hiệu PixelMind ── */}
      <div className="pm-brand">
        <div className="pm-brand__mark">
          <FolderSearch size={14} strokeWidth={2.4} />
        </div>
        <div className="pm-brand__name">
          Pixel<span>Mind</span>
        </div>
      </div>

      {/* ── Thư mục / Dự án đang mở ── */}
      {project ? (
        <button className="pm-crumb" onClick={onProjects} title="Quay lại màn hình dự án">
          <FolderOpen size={13} />
          <b>{project.name}</b>
          <span>{shortPath(project.path, home)}</span>
        </button>
      ) : (
        <button className="pm-crumb" onClick={onOpenFolder} title="Mở một thư mục dự án (Ctrl+O)">
          <FolderOpen size={13} />
          <b>Mở thư mục dự án</b>
        </button>
      )}

      {/* ── CỤM NÚT BÊN TRÁI THEO ẢNH 2 ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 6 }}>
        {/* Undo / Redo */}
        <button className="pm-ibtn" title="Hoàn tác (Ctrl+Z)">
          <Undo2 size={14} />
        </button>
        <button className="pm-ibtn" title="Làm lại (Ctrl+Y)">
          <Redo2 size={14} />
        </button>

        {/* Nút trạng thái máy chủ [⏹ Đang chạy] hoặc [▶ Run] (Ảnh 2) */}
        {running ? (
          <button
            className="pm-topbar__run-status running"
            onClick={onStop}
            title="Dừng tiến trình máy chủ (Shift+F5)"
          >
            <Square size={11} fill="currentColor" />
            <span>Đang chạy</span>
          </button>
        ) : (
          <button
            className="pm-topbar__run-status idle"
            onClick={onRun}
            disabled={!project}
            title="Khởi động máy chủ phát triển (F5)"
          >
            <Play size={11} fill="currentColor" />
            <span>Run</span>
          </button>
        )}

        {/* Git Compare */}
        <button className="pm-ibtn" title="So sánh nhánh Git / Thay đổi">
          <GitCompare size={14} />
        </button>

        {/* Window / Display mode */}
        <button className="pm-ibtn" title="Chế độ hiển thị cửa sổ xem trước" onClick={onOpenPreview}>
          <Monitor size={14} />
        </button>

        {/* Camera snapshot */}
        <button className="pm-ibtn" title="Chụp ảnh nhanh màn hình làm việc">
          <Camera size={14} />
        </button>

        {/* Bảng lệnh nổi bật (Ảnh 2) */}
        <button className="pm-topbar__palette" onClick={onPalette} title="Mở bảng lệnh (Ctrl+K)">
          <span className="pm-topbar__palette-text">Bảng lệnh, phần tử, hành động…</span>
          <span className="pm-topbar__palette-keys">
            <kbd>Ctrl</kbd>
            <kbd>K</kbd>
          </span>
        </button>
      </div>

      <div className="pm-topbar__spacer" />

      {/* ── CỤM NÚT BÊN PHẢI THEO ẢNH 2 ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Nút Share */}
        <button className="pm-topbar__share" title="Chia sẻ dự án / Xuất giao diện">
          <Share2 size={12} />
          <span>Share</span>
        </button>

        {/* Nút Help */}
        <button className="pm-ibtn" onClick={onGuide} title="Hướng dẫn sử dụng (F1)">
          <HelpCircle size={14} />
        </button>

        {/* Nút Tải lại */}
        <button
          className="pm-ibtn"
          onClick={onRefresh}
          disabled={!project}
          title="Tải lại cây tệp (Ctrl+R)"
        >
          <RefreshCw size={13} />
        </button>

        {/* Dropdown Hồ sơ AI [🟢 Antigravity IDE ▾] (Ảnh 2) */}
        <div className="pm-topbar__pop">
          <button
            className="pm-topbar__ai-pill"
            onClick={() => {
              setAiMenuOpen((v) => !v)
              setUserMenuOpen(false)
            }}
            title="Đổi hồ sơ kết nối AI"
          >
            <span className={`pm-topbar__ai-dot ${aiProfile.status === 'warn' ? 'warn' : ''}`} />
            <span>{aiProfile.label}</span>
            <ChevronDown size={12} style={{ opacity: 0.6 }} />
          </button>

          {aiMenuOpen && (
            <>
              <div className="pm-topbar__scrim" onClick={() => setAiMenuOpen(false)} />
              <div className="pm-topbar__dropdown">
                <div className="pm-topbar__dropdown-title">Hồ sơ kết nối AI</div>
                {AI_PROFILES.map((p) => (
                  <button
                    key={p.id}
                    className={`pm-topbar__dropdown-item ${aiProfile.id === p.id ? 'active' : ''}`}
                    onClick={() => {
                      setAiProfile(p)
                      setAiMenuOpen(false)
                    }}
                  >
                    <span className={`pm-topbar__ai-dot ${p.status === 'warn' ? 'warn' : ''}`} />
                    <span style={{ flex: 1 }}>{p.label}</span>
                    {aiProfile.id === p.id && <span style={{ color: 'var(--accent)' }}>✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Nút Cài đặt */}
        <button className="pm-ibtn" onClick={onSettings} title="Cài đặt (Ctrl+,)">
          <SettingsIcon size={14} />
        </button>

        {/* Avatar Hồ sơ người dùng [TH] Nguyễn Thanh Hiền ▾ (Ảnh 2) */}
        <div className="pm-topbar__pop">
          <button
            className="pm-topbar__user"
            onClick={() => {
              setUserMenuOpen((v) => !v)
              setAiMenuOpen(false)
            }}
            title="Thông tin tài khoản"
          >
            <div className="pm-topbar__user-avatar">TH</div>
            <div className="pm-topbar__user-info">
              <span className="pm-topbar__user-name">Nguyễn Thanh Hiền</span>
              <span className="pm-topbar__user-sub">Admin · giấy phép còn hạn</span>
            </div>
            <ChevronDown size={12} style={{ opacity: 0.6, marginLeft: 2 }} />
          </button>

          {userMenuOpen && (
            <>
              <div className="pm-topbar__scrim" onClick={() => setUserMenuOpen(false)} />
              <div className="pm-topbar__dropdown" style={{ minWidth: 240 }}>
                <div className="pm-topbar__dropdown-title">Tài khoản PixelMind</div>
                <div
                  style={{
                    padding: '8px 10px',
                    fontSize: 12,
                    color: 'var(--text)',
                    lineHeight: 1.4,
                  }}
                >
                  <b>Nguyễn Thanh Hiền</b>
                  <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>hien.nguyen@pixelmind.ai</div>
                  <div
                    style={{
                      display: 'inline-block',
                      marginTop: 4,
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontSize: 10,
                      background: 'rgba(49, 192, 122, 0.15)',
                      color: '#34d399',
                    }}
                  >
                    Giấy phép Pro · Còn hạn 12 ngày
                  </div>
                </div>
                <div className="pm-topbar__dropdown-divider" />
                <button
                  className="pm-topbar__dropdown-item"
                  onClick={() => {
                    setUserMenuOpen(false)
                    onSettings()
                  }}
                >
                  <User size={13} />
                  <span>Quản lý hồ sơ cá nhân</span>
                </button>
                <button
                  className="pm-topbar__dropdown-item"
                  onClick={() => {
                    setUserMenuOpen(false)
                    onGuide()
                  }}
                >
                  <Shield size={13} />
                  <span>Quyền hạn & Bảo mật</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default TopBar
