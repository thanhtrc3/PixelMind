import { useState } from 'react';
import {
  Undo2, Redo2, Play, Square, Share2, Camera, Monitor, GitCompare,
  Settings, FolderCode, ChevronDown, Camera as _Camera, WandSparkles,
  User, Shield, Palette, LogOut, HelpCircle,
} from 'lucide-react';
import type { SectionId } from '../data/sections';
import '../styles/TopBar.css';

void _Camera;

interface TopBarProps {
  onOpenGuide?: () => void;
  onOpenHub?: () => void;
  onOpenPalette?: () => void;
  onOpenSettings?: () => void;
  /** Hoàn tác lần chèn part gần nhất từ Thư viện Part */
  onUndo?: () => void;
  undoCount?: number;
  projectName?: string;
  onSection?: (id: SectionId) => void;
  onLogout?: () => void;
  /** Đổi chế độ xem canvas từ thanh trên cùng (Compare / Preview) */
  onCanvasMode?: (mode: 'live' | 'side') => void;
}

const AI_PROFILES = [
  { id: 'antigravity', label: 'Antigravity IDE', tone: 'ok' as const },
  { id: 'local', label: 'Ollama · qwen2.5-coder', tone: 'ok' as const },
  { id: 'api', label: 'GPT-4o · API', tone: 'warn' as const },
];

const ROLES = ['Admin', 'Dev', 'Reviewer'];

const TopBar = ({
  onOpenGuide,
  onOpenHub,
  onOpenPalette,
  onOpenSettings,
  onUndo,
  undoCount = 0,
  projectName = 'ShopWeb',
  onSection,
  onLogout,
  onCanvasMode,
}: TopBarProps) => {
  const [profile, setProfile] = useState(AI_PROFILES[0]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [whoOpen, setWhoOpen] = useState(false);
  const [role, setRole] = useState(ROLES[0]);
  const [running, setRunning] = useState(true);

  return (
    <header className="topbar">
      {/* ── Thương hiệu ── */}
      <div className="topbar__brand">
        <div className="topbar__mark" aria-hidden>
          <WandSparkles size={13} strokeWidth={2} />
        </div>
        <span className="topbar__wordmark">PixelMind</span>
      </div>

      <div className="sep" />

      {/* ── Dự án đang mở ── */}
      <button className="proj" onClick={onOpenHub} title="Đổi dự án đang mở · Ctrl+O">
        <FolderCode size={14} className="dim" />
        <b>{projectName}</b>
        <span className="hint">Next.js</span>
        <span className="dot ok" />
        <ChevronDown size={13} className="dim" />
      </button>

      <div className="sep" />

      {/* ── Lịch sử ── */}
      <button
        className="ibtn"
        onClick={onUndo}
        disabled={!undoCount}
        title={undoCount ? 'Hoàn tác lần chèn part gần nhất · Ctrl+Z' : 'Hoàn tác · Ctrl+Z'}
      >
        <Undo2 size={15} strokeWidth={1.8} />
      </button>
      <button className="ibtn" title="Làm lại · Ctrl+Y"><Redo2 size={15} strokeWidth={1.8} /></button>

      <button className="btn" onClick={() => setRunning((v) => !v)} title="Chạy dev server">
        {running ? <Square size={11} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
        {running ? 'Đang chạy' : 'Run'}
      </button>

      <button className="ibtn topbar__opt" title="Compare — đổi chế độ so sánh" onClick={() => onCanvasMode?.('side')}>
        <GitCompare size={15} strokeWidth={1.8} />
      </button>
      <button className="ibtn topbar__opt" title="Preview — xem toàn trang" onClick={() => onCanvasMode?.('live')}>
        <Monitor size={15} strokeWidth={1.8} />
      </button>
      <button className="ibtn topbar__opt" title="Chụp màn hình"><Camera size={15} strokeWidth={1.8} /></button>

      {/* ── Bảng lệnh (đột phá) ── */}
      <button className="topbar__palette" onClick={onOpenPalette} title="Bảng lệnh · Ctrl+K">
        <span className="topbar__palette-txt">Bảng lệnh, phần tử, hành động…</span>
        <kbd className="kbd">Ctrl</kbd>
        <kbd className="kbd">K</kbd>
      </button>

      <div className="grow" />

      <button className="btn topbar__share" onClick={() => onSection?.('export')} title="Chia sẻ / xuất bài">
        <Share2 size={12} /> Share
      </button>

      <button className="ibtn" title="Hướng dẫn · F1" onClick={onOpenGuide}><HelpCircle size={15} strokeWidth={1.8} /></button>

      {/* ── Hồ sơ AI (1 bấm để đổi) ── */}
      <div className="topbar__pop">
        <button
          className="proj"
          title="Đổi hồ sơ AI — một lần bấm là chuyển ngay"
          onClick={() => { setProfileOpen((v) => !v); setWhoOpen(false); }}
        >
          <span className={`dot ${profile.tone}`} />
          <span className="topbar__profile-label">{profile.label}</span>
          <ChevronDown size={13} className="dim" />
        </button>
        {profileOpen && (
          <>
            <div className="topbar__scrim" onClick={() => setProfileOpen(false)} />
            <div className="topbar__menu slide-down">
              <div className="topbar__menu-hd">Hồ sơ kết nối AI</div>
              {AI_PROFILES.map((p) => (
                <button
                  key={p.id}
                  className={profile.id === p.id ? 'is-on' : ''}
                  onClick={() => { setProfile(p); setProfileOpen(false); }}
                >
                  <span className={`dot ${p.tone}`} />
                  <span className="grow">{p.label}</span>
                  {profile.id === p.id && <span className="topbar__menu-check">✓</span>}
                </button>
              ))}
              <div className="topbar__menu-foot">Mã hoá tại chỗ · đổi không cần khởi động lại</div>
            </div>
          </>
        )}
      </div>

      <button className="ibtn" title="Cài đặt · Ctrl+," onClick={onOpenSettings}>
        <Settings size={15} strokeWidth={1.8} />
      </button>

      {/* ── Người đang đăng nhập ── */}
      <div className="topbar__pop">
        <button className="who" onClick={() => { setWhoOpen((v) => !v); setProfileOpen(false); }}>
          <span className="avatar">TH</span>
          <span className="col topbar__who-txt">
            <b>Nguyễn Thanh Hiền</b>
            <span>{role} · giấy phép còn hạn</span>
          </span>
          <ChevronDown size={13} className="dim" />
        </button>
        {whoOpen && (
          <>
            <div className="topbar__scrim" onClick={() => setWhoOpen(false)} />
            <div className="topbar__menu slide-down">
              <div className="topbar__menu-hd">Đang đăng nhập</div>
              <button onClick={() => { onOpenSettings?.(); setWhoOpen(false); }}>
                <User size={13} /> Hồ sơ cá nhân
              </button>
              <button
                onClick={() => {
                  const i = ROLES.indexOf(role);
                  setRole(ROLES[(i + 1) % ROLES.length]);
                  setWhoOpen(false);
                }}
              >
                <Shield size={13} /> Đổi vai trò ({role})
              </button>
              <button onClick={() => { onOpenSettings?.(); setWhoOpen(false); }}>
                <Palette size={13} /> Giao diện &amp; phím tắt
              </button>
              <hr className="hr" style={{ margin: '5px 0' }} />
              <button onClick={() => { setWhoOpen(false); onLogout?.(); }}>
                <LogOut size={13} /> Đăng xuất
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
};

export default TopBar;
