import { useState, useEffect, useRef } from 'react'
import { Check, Loader2, Minus, Save, Square, X } from 'lucide-react'
import { api, isDesktop } from '../lib/bridge'
import { editorBuffer } from '../lib/editorBuffer'
import type { ProjectRecord } from '@shared/types'
import AtomLogo from './AtomLogo'

const RestoreIcon = () => (
  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="4" y="1" width="11" height="11" rx="1.5" />
    <path d="M1 5v9a1.5 1.5 0 0 0 1.5 1.5H11" />
  </svg>
)

interface TitleBarProps {
  project: ProjectRecord | null
  onOpenFolder: () => void
  onViewProjects: () => void
  onViewWorkspace: () => void
  onSettings: () => void
  onGuide: () => void
  onPalette: () => void
  onRun: () => void
  onStop: () => void
  onRefresh: () => void
  onToggleSidebar?: () => void
  onMenuAction?: (action: string) => void
  autoSave?: boolean
  onToggleAutoSave?: () => void
}

interface MenuDef {
  label: string
  items: { label: string; keys?: string; action: () => void; divider?: boolean }[]
}

const TitleBar = ({
  project,
  onOpenFolder,
  onViewProjects,
  onViewWorkspace,
  onSettings,
  onGuide,
  onPalette,
  onRun,
  onStop,
  onRefresh,
  onToggleSidebar,
  onMenuAction,
  autoSave = true,
  onToggleAutoSave,
}: TitleBarProps) => {
  const [activeHtmlMenu, setActiveHtmlMenu] = useState<number | null>(null)
  const [isMaximized, setIsMaximized] = useState(false)
  const [isSavingBuffer, setIsSavingBuffer] = useState(editorBuffer.isSaving())
  const [dirtyCount, setDirtyCount] = useState(editorBuffer.getDirtyFileCount())
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(editorBuffer.getLastSavedAt())
  const menuButtonsRef = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    return editorBuffer.subscribe(() => {
      setIsSavingBuffer(editorBuffer.isSaving())
      setDirtyCount(editorBuffer.getDirtyFileCount())
      setLastSavedAt(editorBuffer.getLastSavedAt())
    })
  }, [])

  useEffect(() => {
    const updateMaxState = () => {
      if (isDesktop && api.window?.isMaximized) {
        api.window.isMaximized().then(setIsMaximized).catch(() => {})
      }
    }
    updateMaxState()
    window.addEventListener('resize', updateMaxState)
    return () => window.removeEventListener('resize', updateMaxState)
  }, [])

  /* Cấu hình menu fallback cho bản Web / khi không dùng native popup */
  const act = (name: string, fallback?: () => void) => () => {
    if (onMenuAction) onMenuAction(name)
    else fallback?.()
  }
  const MENUS: MenuDef[] = [
    {
      label: 'Tệp',
      items: [
        { label: 'Mở thư mục dự án…', keys: 'Ctrl+O', action: onOpenFolder },
        { label: 'Nhập dự án từ tệp ZIP…', action: act('import-zip') },
        { label: 'Xuất dự án ra tệp ZIP…', action: act('export-zip'), divider: true },
        { label: 'Lưu thay đổi vào tệp', keys: 'Ctrl+S', action: act('save'), divider: true },
        { label: 'Màn hình dự án', keys: 'Ctrl+Shift+O', action: onViewProjects },
        { label: 'Màn hình làm việc', keys: 'Ctrl+Shift+W', action: onViewWorkspace, divider: true },
        { label: 'Cài đặt…', keys: 'Ctrl+,', action: onSettings },
      ],
    },
    {
      label: 'Chỉnh sửa',
      items: [
        { label: 'Hoàn tác trên Canvas', keys: 'Ctrl+Z', action: act('undo') },
        { label: 'Làm lại trên Canvas', keys: 'Ctrl+Y', action: act('redo'), divider: true },
        { label: 'Bảng lệnh…', keys: 'Ctrl+K', action: onPalette },
      ],
    },
    {
      label: 'Chạy',
      items: [
        { label: 'Chạy dự án', keys: 'F5', action: onRun },
        { label: 'Dừng máy chủ', keys: 'Shift+F5', action: onStop, divider: true },
        { label: 'Cài đặt thư viện (Install)', action: act('install-deps') },
        { label: 'Kiểm tra sức khỏe dự án', action: act('diagnose'), divider: true },
        { label: 'Tải lại cây tệp', keys: 'Ctrl+R', action: onRefresh },
      ],
    },
    {
      label: 'Xem',
      items: [
        { label: 'Ẩn / Hiện thanh bên (Sidebar)', keys: 'Ctrl+B', action: () => onToggleSidebar?.(), divider: true },
        { label: 'Cây tệp (Files)', keys: 'Ctrl+Shift+E', action: act('tab-files') },
        { label: 'Cây phân cấp (Layers)', keys: 'Ctrl+Shift+L', action: act('tab-layers') },
        { label: 'Danh sách trang (Pages)', action: act('tab-pages') },
        { label: 'Tài nguyên (Assets)', action: act('tab-assets') },
        { label: 'Lịch sử phiên bản (Versions)', action: act('tab-versions') },
        { label: 'Hệ thống thiết kế (Design Tokens)', action: act('tab-design') },
        { label: 'Thư viện linh kiện (Parts)', action: act('tab-parts'), divider: true },
        { label: 'Ẩn / Hiện Nhật ký chạy', keys: 'Ctrl+J', action: act('toggle-logs') },
        { label: 'Chế độ tập trung Canvas', action: act('focus-canvas') },
      ],
    },
    {
      label: 'Công cụ',
      items: [
        { label: 'Soi phần tử trực quan (Inspect)', keys: 'Alt+I', action: act('toggle-inspect') },
        { label: 'Hệ thống thiết kế (Design Tokens)', action: act('tokens') },
        { label: 'Kiểm tra trợ năng (Accessibility)', action: act('a11y') },
        { label: 'Mock API cho dự án…', action: act('mock') },
        { label: 'Triển khai / Preview URL…', action: act('deploy') },
        { label: 'Tài khoản Supabase…', action: act('login') },
        { label: 'Đồng bộ & Chia sẻ Cloud…', action: act('cloud') },
        { label: 'Mở trang trong trình duyệt ngoài', action: act('open-browser') },
      ],
    },
    {
      label: 'Trợ giúp',
      items: [
        { label: 'Hướng dẫn sử dụng', keys: 'F1', action: onGuide },
        { label: 'Bảng lệnh', keys: 'Ctrl+K', action: onPalette },
      ],
    },
  ]

  const handleMenuClick = async (index: number, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()

    if (isDesktop && api.system.popupMenu) {
      try {
        const ok = await api.system.popupMenu(index, rect.left, rect.bottom)
        if (ok) return
      } catch {
        /* fallback về html menu */
      }
    }

    setActiveHtmlMenu((prev) => (prev === index ? null : index))
  }

  const handleDoubleClick = async () => {
    if (isDesktop && api.window?.maximize) {
      await api.window.maximize()
      if (api.window?.isMaximized) {
        const max = await api.window.isMaximized()
        setIsMaximized(max)
      }
    }
  }

  const handleToggleMaximize = async () => {
    if (isDesktop && api.window?.maximize) {
      await api.window.maximize()
      if (api.window?.isMaximized) {
        const max = await api.window.isMaximized()
        setIsMaximized(max)
      }
    }
  }

  return (
    <div className="pm-titlebar" onDoubleClick={handleDoubleClick}>
      {/* ── 1. Tên App & Logo thương hiệu PixelMind (Icon Nguyên tử chuẩn theo Ảnh 1) ── */}
      <div className="pm-titlebar__brand">
        <AtomLogo size={18} className="pm-titlebar__brand-icon" />
        <div className="pm-titlebar__brand-name">
          Pixel<span>Mind</span>
        </div>
      </div>

      {/* ── 2. Dải Menu Bar nằm NGANG HÀNG TRỰC TIẾP với tên App ── */}
      <div className="pm-titlebar__menubar">
        {MENUS.map((menu, i) => (
          <div key={menu.label} style={{ position: 'relative' }}>
            <button
              ref={(el) => {
                menuButtonsRef.current[i] = el
              }}
              className={`pm-titlebar__menu-btn ${activeHtmlMenu === i ? 'active' : ''}`}
              onClick={(e) => handleMenuClick(i, e)}
              onMouseEnter={(e) => {
                if (activeHtmlMenu !== null && activeHtmlMenu !== i) {
                  handleMenuClick(i, e)
                }
              }}
            >
              {menu.label}
            </button>

            {/* Menu Dropdown dự phòng cho bản Web */}
            {activeHtmlMenu === i && (
              <>
                <div
                  className="pm-topbar__scrim"
                  style={{ zIndex: 999 }}
                  onClick={() => setActiveHtmlMenu(null)}
                />
                <div
                  className="pm-topbar__dropdown"
                  style={{ left: 0, right: 'auto', top: '100%', minWidth: 200, zIndex: 1000 }}
                >
                  {menu.items.map((item, idx) => (
                    <div key={idx}>
                      <button
                        className="pm-topbar__dropdown-item"
                        onClick={() => {
                          setActiveHtmlMenu(null)
                          item.action()
                        }}
                      >
                        <span style={{ flex: 1 }}>{item.label}</span>
                        {item.keys && (
                          <span className="pm-kbd" style={{ fontSize: 9.5 }}>
                            {item.keys}
                          </span>
                        )}
                      </button>
                      {item.divider && <div className="pm-topbar__dropdown-divider" />}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* ── 3. Vùng kéo cửa sổ & Tiêu đề dự án căn giữa ── */}
      <div className="pm-titlebar__center">
        {project ? <span>{project.name}</span> : null}
      </div>

      {/* ── 4. Nút bật/tắt Auto-Save ngay trên TitleBar & điều khiển cửa sổ ── */}
      <div className="pm-titlebar__right">
        {onToggleAutoSave && (
          <button
            type="button"
            className={`pm-titlebar__autosave ${autoSave ? 'on' : 'off'} ${
              isSavingBuffer ? 'is-saving' : ''
            }`}
            onClick={onToggleAutoSave}
            title={
              autoSave
                ? `Auto-Save đang BẬT (tự lưu sau 1.5s vào tệp + backup .pixelmind/backups/)${
                    lastSavedAt
                      ? ` · Lần lưu gần nhất: ${new Date(lastSavedAt).toLocaleTimeString('vi-VN')}`
                      : ''
                  }\nNhấp để tắt Auto-Save`
                : `Auto-Save đang TẮT${
                    dirtyCount > 0 ? ` · Còn ${dirtyCount} tệp chưa lưu (bấm Ctrl+S)` : ''
                  }\nNhấp để bật Auto-Save`
            }
            aria-pressed={autoSave}
            aria-label="Bật hoặc tắt Auto-Save"
          >
            {isSavingBuffer ? (
              <Loader2 size={11} className="spin" />
            ) : autoSave ? (
              <Check size={11} />
            ) : (
              <Save size={11} />
            )}
            <span>Auto Save</span>
            <span className="pm-titlebar__autosave-state">
              {isSavingBuffer
                ? 'Đang lưu…'
                : autoSave
                  ? 'Bật'
                  : dirtyCount > 0
                    ? `Tắt (${dirtyCount}*)`
                    : 'Tắt'}
            </span>
          </button>
        )}

        <div className="pm-titlebar__window-controls">
        <button
          className="pm-win-btn"
          onClick={() => api.window?.minimize()}
          title="Thu nhỏ cửa sổ"
          aria-label="Thu nhỏ"
        >
          <Minus size={13} strokeWidth={2} />
        </button>
        <button
          className="pm-win-btn"
          onClick={handleToggleMaximize}
          title={isMaximized ? 'Khôi phục kích thước' : 'Phóng to cửa sổ'}
          aria-label={isMaximized ? 'Khôi phục' : 'Phóng to'}
        >
          {isMaximized ? <RestoreIcon /> : <Square size={11} strokeWidth={2} />}
        </button>
        <button
          className="pm-win-btn close"
          onClick={() => api.window?.close()}
          title="Đóng PixelMind"
          aria-label="Đóng"
        >
          <X size={13} strokeWidth={2.2} />
        </button>
        </div>
      </div>
    </div>
  )
}

export default TitleBar
