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
  { id: 'ollama', label: 'Ollama ┬╖ qwen2.5-coder', status: 'ok' },
  { id: 'gpt4o', label: 'GPT-4o ┬╖ Cloud API', status: 'warn' },
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
      {/* ΓöÇΓöÇ Th╞░╞íng hiß╗çu PixelMind ΓöÇΓöÇ */}
      <div className="pm-brand">
        <div className="pm-brand__mark">
          <FolderSearch size={14} strokeWidth={2.4} />
        </div>
        <div className="pm-brand__name">
          Pixel<span>Mind</span>
        </div>
      </div>

      {/* ΓöÇΓöÇ Th╞░ mß╗Ñc / Dß╗▒ ├ín ─æang mß╗ƒ ΓöÇΓöÇ */}
      {project ? (
        <button className="pm-crumb" onClick={onProjects} title="Quay lß║íi m├án h├¼nh dß╗▒ ├ín">
          <FolderOpen size={13} />
          <b>{project.name}</b>
          <span>{shortPath(project.path, home)}</span>
        </button>
      ) : (
        <button className="pm-crumb" onClick={onOpenFolder} title="Mß╗ƒ mß╗Öt th╞░ mß╗Ñc dß╗▒ ├ín (Ctrl+O)">
          <FolderOpen size={13} />
          <b>Mß╗ƒ th╞░ mß╗Ñc dß╗▒ ├ín</b>
        </button>
      )}

      {/* ΓöÇΓöÇ Cß╗ñM N├ÜT B├èN TR├üI THEO ß║óNH 2 ΓöÇΓöÇ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 6 }}>
        {/* Undo / Redo */}
        <button className="pm-ibtn" title="Ho├án t├íc (Ctrl+Z)">
          <Undo2 size={14} />
        </button>
        <button className="pm-ibtn" title="L├ám lß║íi (Ctrl+Y)">
          <Redo2 size={14} />
        </button>

        {/* N├║t trß║íng th├íi m├íy chß╗º [ΓÅ╣ ─Éang chß║íy] hoß║╖c [Γû╢ Run] (ß║ónh 2) */}
        {running ? (
          <button
            className="pm-topbar__run-status running"
            onClick={onStop}
            title="Dß╗½ng tiß║┐n tr├¼nh m├íy chß╗º (Shift+F5)"
          >
            <Square size={11} fill="currentColor" />
            <span>─Éang chß║íy</span>
          </button>
        ) : (
          <button
            className="pm-topbar__run-status idle"
            onClick={onRun}
            disabled={!project}
            title="Khß╗ƒi ─æß╗Öng m├íy chß╗º ph├ít triß╗ân (F5)"
          >
            <Play size={11} fill="currentColor" />
            <span>Run</span>
          </button>
        )}

        {/* Git Compare */}
        <button className="pm-ibtn" title="So s├ính nh├ính Git / Thay ─æß╗òi">
          <GitCompare size={14} />
        </button>

        {/* Window / Display mode */}
        <button className="pm-ibtn" title="Chß║┐ ─æß╗Ö hiß╗ân thß╗ï cß╗¡a sß╗ò xem tr╞░ß╗¢c" onClick={onOpenPreview}>
          <Monitor size={14} />
        </button>

        {/* Camera snapshot */}
        <button className="pm-ibtn" title="Chß╗Ñp ß║únh nhanh m├án h├¼nh l├ám viß╗çc">
          <Camera size={14} />
        </button>

        {/* Bß║úng lß╗çnh nß╗òi bß║¡t (ß║ónh 2) */}
        <button className="pm-topbar__palette" onClick={onPalette} title="Mß╗ƒ bß║úng lß╗çnh (Ctrl+K)">
          <span className="pm-topbar__palette-text">Bß║úng lß╗çnh, phß║ºn tß╗¡, h├ánh ─æß╗ÖngΓÇª</span>
          <span className="pm-topbar__palette-keys">
            <kbd>Ctrl</kbd>
            <kbd>K</kbd>
          </span>
        </button>
      </div>

      <div className="pm-topbar__spacer" />

      {/* ΓöÇΓöÇ Cß╗ñM N├ÜT B├èN PHß║óI THEO ß║óNH 2 ΓöÇΓöÇ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* N├║t Share */}
        <button className="pm-topbar__share" title="Chia sß║╗ dß╗▒ ├ín / Xuß║Ñt giao diß╗çn">
          <Share2 size={12} />
          <span>Share</span>
        </button>

        {/* N├║t Help */}
        <button className="pm-ibtn" onClick={onGuide} title="H╞░ß╗¢ng dß║½n sß╗¡ dß╗Ñng (F1)">
          <HelpCircle size={14} />
        </button>

        {/* N├║t Tß║úi lß║íi */}
        <button
          className="pm-ibtn"
          onClick={onRefresh}
          disabled={!project}
          title="Tß║úi lß║íi c├óy tß╗çp (Ctrl+R)"
        >
          <RefreshCw size={13} />
        </button>

        {/* Dropdown Hß╗ô s╞í AI [≡ƒƒó Antigravity IDE Γû╛] (ß║ónh 2) */}
        <div className="pm-topbar__pop">
          <button
            className="pm-topbar__ai-pill"
            onClick={() => {
              setAiMenuOpen((v) => !v)
              setUserMenuOpen(false)
            }}
            title="─Éß╗òi hß╗ô s╞í kß║┐t nß╗æi AI"
          >
            <span className={`pm-topbar__ai-dot ${aiProfile.status === 'warn' ? 'warn' : ''}`} />
            <span>{aiProfile.label}</span>
            <ChevronDown size={12} style={{ opacity: 0.6 }} />
          </button>

          {aiMenuOpen && (
            <>
              <div className="pm-topbar__scrim" onClick={() => setAiMenuOpen(false)} />
              <div className="pm-topbar__dropdown">
                <div className="pm-topbar__dropdown-title">Hß╗ô s╞í kß║┐t nß╗æi AI</div>
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
                    {aiProfile.id === p.id && <span style={{ color: 'var(--accent)' }}>Γ£ô</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* N├║t C├ái ─æß║╖t */}
        <button className="pm-ibtn" onClick={onSettings} title="C├ái ─æß║╖t (Ctrl+,)">
          <SettingsIcon size={14} />
        </button>

        {/* Avatar Hß╗ô s╞í ng╞░ß╗¥i d├╣ng [TH] Nguyß╗àn Thanh Hiß╗ün Γû╛ (ß║ónh 2) */}
        <div className="pm-topbar__pop">
          <button
            className="pm-topbar__user"
            onClick={() => {
              setUserMenuOpen((v) => !v)
              setAiMenuOpen(false)
            }}
            title="Th├┤ng tin t├ái khoß║ún"
          >
            <div className="pm-topbar__user-avatar">TH</div>
            <div className="pm-topbar__user-info">
              <span className="pm-topbar__user-name">Nguyß╗àn Thanh Hiß╗ün</span>
              <span className="pm-topbar__user-sub">Admin ┬╖ giß║Ñy ph├⌐p c├▓n hß║ín</span>
            </div>
            <ChevronDown size={12} style={{ opacity: 0.6, marginLeft: 2 }} />
          </button>

          {userMenuOpen && (
            <>
              <div className="pm-topbar__scrim" onClick={() => setUserMenuOpen(false)} />
              <div className="pm-topbar__dropdown" style={{ minWidth: 240 }}>
                <div className="pm-topbar__dropdown-title">T├ái khoß║ún PixelMind</div>
                <div
                  style={{
                    padding: '8px 10px',
                    fontSize: 12,
                    color: 'var(--text)',
                    lineHeight: 1.4,
                  }}
                >
                  <b>Nguyß╗àn Thanh Hiß╗ün</b>
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
                    Giß║Ñy ph├⌐p Pro ┬╖ C├▓n hß║ín 12 ng├áy
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
                  <span>Quß║ún l├╜ hß╗ô s╞í c├í nh├ón</span>
                </button>
                <button
                  className="pm-topbar__dropdown-item"
                  onClick={() => {
                    setUserMenuOpen(false)
                    onGuide()
                  }}
                >
                  <Shield size={13} />
                  <span>Quyß╗ün hß║ín & Bß║úo mß║¡t</span>
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
