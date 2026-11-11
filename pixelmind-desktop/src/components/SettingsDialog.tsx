import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Copy,
  Database,
  Download,
  FolderOpen,
  Info,
  Keyboard,
  LayoutGrid,
  Palette,
  Pipette,
  Plug,
  RotateCcw,
  Search,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import type { AppInfo, Settings } from '@shared/types'
import type { AiStatus, AiTestResult } from '@shared/ai'
import { api } from '../lib/bridge'
import Modal from './Modal'

interface SettingsDialogProps {
  settings: Settings
  appInfo: AppInfo | null
  storePath: string
  projectCount: number
  isDesktop: boolean
  /** Dự án đang mở — dùng để đọc .env của dự án và kiểm tra kết nối. */
  projectPath?: string
  onUpdate: (patch: Partial<Settings>) => void
  onResetSettings: () => void
  onResetAllData?: () => void
  onClearCache?: () => void
  onOpenDataFolder: () => void
  onClose: () => void
}

type TabId = 'general' | 'appearance' | 'canvas' | 'run' | 'ai' | 'data' | 'about'

const TABS: Array<{ id: TabId; label: string; icon: typeof SettingsIcon }> = [
  { id: 'general', label: 'Chung', icon: SlidersHorizontal },
  { id: 'appearance', label: 'Giao diện', icon: Palette },
  { id: 'canvas', label: 'Canvas & Soi', icon: LayoutGrid },
  { id: 'run', label: 'Chạy & xem trước', icon: Terminal },
  { id: 'ai', label: 'Trợ lý AI', icon: Sparkles },
  { id: 'data', label: 'Dữ liệu', icon: Database },
  { id: 'about', label: 'Giới thiệu & Phím tắt', icon: Info },
]

const ACCENTS = [
  { hex: '#6d5df5', label: 'Pixel Violet' },
  { hex: '#3b82f6', label: 'Ocean Blue' },
  { hex: '#10b981', label: 'Emerald' },
  { hex: '#f59e0b', label: 'Amber' },
  { hex: '#f43f5e', label: 'Rose Coral' },
  { hex: '#ec4899', label: 'Neon Pink' },
  { hex: '#06b6d4', label: 'Cyan Sky' },
  { hex: '#8b5cf6', label: 'Deep Purple' },
]

const CODE_FONTS = [
  'JetBrains Mono',
  'Fira Code',
  'Cascadia Code',
  'Consolas',
  'Monaco',
  'Courier New',
]

const SHORTCUT_GROUPS = [
  {
    title: 'Bố cục & Khung nhìn',
    items: [
      { name: 'Bật/tắt thanh bên trái (Sidebar)', keys: ['Ctrl', 'B'] },
      { name: 'Bật/tắt bảng nhật ký dưới (Terminal & Log)', keys: ['Ctrl', 'J'] },
      { name: 'Bật/tắt bảng điều khiển phải (Run & Inspector)', keys: ['Ctrl', 'Alt', 'B'] },
      { name: 'Chuyển sang màn hình làm việc (Workspace)', keys: ['Ctrl', 'Shift', 'W'] },
      { name: 'Chuyển sang danh sách dự án', keys: ['Ctrl', 'Shift', 'O'] },
    ],
  },
  {
    title: 'Máy chủ & Dự án',
    items: [
      { name: 'Mở thư mục dự án bất kỳ', keys: ['Ctrl', 'O'] },
      { name: 'Khởi động máy chủ phát triển (Dev Server)', keys: ['F5'] },
      { name: 'Dừng máy chủ & giải phóng cổng', keys: ['Shift', 'F5'] },
      { name: 'Tải lại toàn bộ cây tệp', keys: ['Ctrl', 'R'] },
    ],
  },
  {
    title: 'Canvas & Thiết kế trực quan',
    items: [
      { name: 'Bật / tắt chế độ Soi phần tử trực tiếp', keys: ['Phím I'] },
      { name: 'Chế độ Kéo rê Canvas (Pan)', keys: ['Phím H', 'hoặc giữ Space'] },
      { name: 'Phóng to Canvas', keys: ['Ctrl', '+'] },
      { name: 'Thu nhỏ Canvas', keys: ['Ctrl', '-'] },
      { name: 'Phóng vừa màn hình (Fit to Screen)', keys: ['Phím F'] },
      { name: 'Hoàn tác thay đổi đệm RAM (Undo)', keys: ['Ctrl', 'Z'] },
      { name: 'Làm lại thay đổi (Redo)', keys: ['Ctrl', 'Y'] },
    ],
  },
  {
    title: 'Hệ thống & Tiện ích',
    items: [
      { name: 'Mở Bảng lệnh điều khiển tập trung (Command Palette)', keys: ['Ctrl', 'K'] },
      { name: 'Mở hộp thoại Cài đặt (Settings)', keys: ['Ctrl', ','] },
      { name: 'Mở hướng dẫn sử dụng nhanh', keys: ['F1'] },
    ],
  },
]

const SettingsDialog = ({
  settings,
  appInfo,
  storePath,
  projectCount,
  isDesktop,
  projectPath,
  onUpdate,
  onResetSettings,
  onResetAllData,
  onClearCache,
  onOpenDataFolder,
  onClose,
}: SettingsDialogProps) => {
  const [tab, setTab] = useState<TabId>('general')
  const [copiedStorePath, setCopiedStorePath] = useState(false)
  const [showDangerConfirm, setShowDangerConfirm] = useState(false)
  const [shortcutFilter, setShortcutFilter] = useState('')
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null)
  const [aiTesting, setAiTesting] = useState(false)
  const [aiTest, setAiTest] = useState<AiTestResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (tab !== 'ai') return
    let alive = true
    void api.ai
      .status(projectPath)
      .then((next) => {
        if (alive) setAiStatus(next)
      })
      .catch(() => {
        if (alive) setAiStatus(null)
      })
    return () => {
      alive = false
    }
  }, [tab, projectPath])

  const runAiTest = async () => {
    setAiTesting(true)
    setAiTest(null)
    try {
      const [result, nextStatus] = await Promise.all([
        api.ai.test(projectPath),
        api.ai.status(projectPath).catch(() => null),
      ])
      setAiTest(result)
      if (nextStatus) setAiStatus(nextStatus)
    } catch (error) {
      setAiTest({
        ok: false,
        message: error instanceof Error ? error.message : 'Không kiểm tra được kết nối.',
        latencyMs: 0,
      })
    } finally {
      setAiTesting(false)
    }
  }

  const setProvider = (provider: 'openai' | 'ollama' | 'gemini') => {
    const defaults =
      provider === 'ollama'
        ? { aiBaseUrl: 'http://localhost:11434/v1', aiModel: 'qwen2.5-coder' }
        : provider === 'gemini'
          ? { aiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', aiModel: 'gemini-3.5-flash-lite' }
          : { aiBaseUrl: 'https://api.openai.com/v1', aiModel: 'gpt-4o-mini' }
    onUpdate({ aiProvider: provider, ...defaults })
    setAiTest(null)
    void api.ai.status(projectPath).then(setAiStatus).catch(() => undefined)
  }

  const toggle = (key: keyof Settings) => {
    onUpdate({ [key]: !settings[key] } as Partial<Settings>)
  }

  const handleCopyPath = async () => {
    if (!storePath) return
    try {
      await navigator.clipboard.writeText(storePath)
      setCopiedStorePath(true)
      setTimeout(() => setCopiedStorePath(false), 2000)
    } catch {}
  }

  const handleExportSettings = () => {
    try {
      const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pixelmind-settings-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {}
  }

  const handleImportSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as Partial<Settings>
        if (typeof parsed === 'object' && parsed !== null) {
          onUpdate(parsed)
        }
      } catch {}
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const filteredShortcuts = SHORTCUT_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      item.name.toLowerCase().includes(shortcutFilter.toLowerCase()) ||
      item.keys.some((k) => k.toLowerCase().includes(shortcutFilter.toLowerCase())),
    ),
  })).filter((group) => group.items.length > 0)

  return (
    <Modal
      title="Cài đặt"
      subtitle="Mọi thay đổi có hiệu lực tức thì và được lưu tự động."
      icon={<SettingsIcon size={16} />}
      width={840}
      onClose={onClose}
      footer={
        <>
          <span className="grow" style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {isDesktop
              ? `Tệp dữ liệu: ${storePath || 'đang tải…'}`
              : 'Chế độ trình duyệt — cài đặt lưu tạm trong localStorage.'}
          </span>
          <button
            className="btn"
            onClick={onResetSettings}
            title="Khôi phục toàn bộ cài đặt về giá trị mặc định ban đầu mà không làm mất danh sách dự án"
          >
            <RotateCcw size={12} /> Khôi phục mặc định
          </button>
          <button className="btn primary" onClick={onClose}>
            Xong
          </button>
        </>
      }
    >
      <div className="pm-settings">
        {/* Thanh chuyển Tab bên trái */}
        <div className="pm-settings__tabs">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`pm-settings__tab ${tab === id ? 'on' : ''}`}
              onClick={() => setTab(id)}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Khung nội dung Tab bên phải */}
        <div className="pm-settings__pane">
          {/* ═══════════════════════════════════════════════
              TAB 1: CHUNG (GENERAL)
              ═══════════════════════════════════════════════ */}
          {tab === 'general' && (
            <>
              <h3>Hành vi chung</h3>
              <p className="pm-desc">Tuỳ chỉnh khởi động, xác nhận thao tác và cách lưu trữ dữ liệu.</p>

              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Tự mở dự án gần nhất</b>
                  <span>Tự động tải lại dự án bạn đang làm việc dở khi khởi động PixelMind.</span>
                </div>
                <div className="pm-setting__ctrl">
                  <button
                    className={`pm-switch ${settings.openLastProject ? 'on' : ''}`}
                    onClick={() => toggle('openLastProject')}
                    aria-label="Tự mở dự án gần nhất"
                  />
                </div>
              </div>

              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Hỏi trước khi xoá dự án khỏi danh sách</b>
                  <span>Hiển thị hộp thoại cảnh báo an toàn khi bạn bấm nút xoá dự án.</span>
                </div>
                <div className="pm-setting__ctrl">
                  <button
                    className={`pm-switch ${settings.confirmDelete ? 'on' : ''}`}
                    onClick={() => toggle('confirmDelete')}
                    aria-label="Hỏi trước khi xoá"
                  />
                </div>
              </div>

              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Hiện tệp và thư mục ẩn</b>
                  <span>Bao gồm các tệp/thư mục cấu hình bắt đầu bằng dấu chấm như .env, .github, .vscode.</span>
                </div>
                <div className="pm-setting__ctrl">
                  <button
                    className={`pm-switch ${settings.showHidden ? 'on' : ''}`}
                    onClick={() => toggle('showHidden')}
                    aria-label="Hiện tệp ẩn"
                  />
                </div>
              </div>

              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Tự động lưu thay đổi (Auto-Save)</b>
                  <span>Tự động đồng bộ các chỉnh sửa từ Canvas hoặc bộ soạn thảo vào đĩa khi bạn rời trang.</span>
                </div>
                <div className="pm-setting__ctrl">
                  <button
                    className={`pm-switch ${settings.autoSave !== false ? 'on' : ''}`}
                    onClick={() => toggle('autoSave')}
                    aria-label="Tự động lưu"
                  />
                </div>
              </div>

              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Thu phóng cửa sổ ứng dụng (UI Zoom)</b>
                  <span>Tăng hoặc giảm tỷ lệ giao diện toàn ứng dụng cho vừa vặn với kích thước màn hình của bạn.</span>
                </div>
                <div className="pm-setting__ctrl">
                  <select
                    className="pm-select"
                    value={settings.windowZoom ?? 100}
                    onChange={(e) => onUpdate({ windowZoom: Number(e.target.value) })}
                  >
                    <option value={85}>85% (Thu nhỏ)</option>
                    <option value={90}>90%</option>
                    <option value={100}>100% (Chuẩn)</option>
                    <option value={110}>110%</option>
                    <option value={120}>120% (Phóng to)</option>
                  </select>
                </div>
              </div>

              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Xác nhận khi thoát lúc máy chủ đang chạy</b>
                  <span>Cảnh báo nếu bạn đóng ứng dụng trong khi tiến trình máy chủ dev vẫn đang hoạt động.</span>
                </div>
                <div className="pm-setting__ctrl">
                  <button
                    className={`pm-switch ${settings.confirmQuitRunning !== false ? 'on' : ''}`}
                    onClick={() => toggle('confirmQuitRunning')}
                    aria-label="Xác nhận khi thoát"
                  />
                </div>
              </div>

              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Script chạy phát triển ưu tiên</b>
                  <span>Tên script chạy khi bạn nhấn F5 (ví dụ: dev, start, watch). Để trống sẽ tự động dò tìm.</span>
                </div>
                <div className="pm-setting__ctrl">
                  <input
                    className="pm-input"
                    style={{ width: 140 }}
                    value={settings.defaultScript}
                    placeholder="dev"
                    onChange={(e) => onUpdate({ defaultScript: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════
              TAB 2: GIAO DIỆN (APPEARANCE)
              ═══════════════════════════════════════════════ */}
          {tab === 'appearance' && (
            <>
              <h3>Giao diện & Cá nhân hóa</h3>
              <p className="pm-desc">Tuỳ biến chủ đề sáng/tối, màu sắc nhận diện thương hiệu và phông chữ làm việc.</p>

              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Chủ đề màu nền</b>
                  <span>Chế độ tối (Dark Mode), sáng (Light Mode) hoặc tự động chuyển theo Windows.</span>
                </div>
                <div className="pm-setting__ctrl">
                  <div className="pm-segmented">
                    <button
                      className={settings.theme === 'dark' ? 'on' : ''}
                      onClick={() => onUpdate({ theme: 'dark' })}
                    >
                      Tối
                    </button>
                    <button
                      className={settings.theme === 'light' ? 'on' : ''}
                      onClick={() => onUpdate({ theme: 'light' })}
                    >
                      Sáng
                    </button>
                    <button
                      className={settings.theme === 'system' ? 'on' : ''}
                      onClick={() => onUpdate({ theme: 'system' })}
                    >
                      Hệ điều hành
                    </button>
                  </div>
                </div>
              </div>

              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Màu sắc nhấn chủ đạo (Accent Color)</b>
                  <span>Áp dụng cho các nút bấm chính, đường viền kích hoạt, huy hiệu và chỉ báo trạng thái.</span>
                </div>
                <div className="pm-setting__ctrl">
                  <div className="pm-swatches" style={{ alignItems: 'center' }}>
                    {ACCENTS.map(({ hex, label }) => (
                      <button
                        key={hex}
                        className={`pm-swatch ${settings.accent.toLowerCase() === hex ? 'on' : ''}`}
                        style={{ background: hex }}
                        title={`${label} (${hex})`}
                        onClick={() => onUpdate({ accent: hex })}
                      />
                    ))}
                    {/* Color Picker tự do */}
                    <label
                      className="pm-swatch-custom"
                      title="Chọn mã màu tùy biến bất kỳ"
                      style={{
                        borderColor: !ACCENTS.some((a) => a.hex === settings.accent.toLowerCase())
                          ? settings.accent
                          : undefined,
                      }}
                    >
                      <Pipette size={11} />
                      <input
                        type="color"
                        value={settings.accent}
                        onChange={(e) => onUpdate({ accent: e.target.value })}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Cỡ chữ giao diện chung</b>
                  <span>Kích thước chữ tiêu chuẩn cho toàn bộ thanh công cụ, bảng điều khiển và danh sách.</span>
                </div>
                <div className="pm-setting__ctrl" style={{ gap: 8 }}>
                  <input
                    type="range"
                    min={11}
                    max={16}
                    step={1}
                    value={settings.fontSize}
                    onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
                    style={{ accentColor: 'var(--accent)', width: 100 }}
                  />
                  <span className="pm-range-val">{settings.fontSize}px</span>
                  {settings.fontSize !== 13 && (
                    <button
                      className="btn"
                      style={{ height: 22, padding: '0 6px', fontSize: 10 }}
                      onClick={() => onUpdate({ fontSize: 13 })}
                      title="Đặt lại cỡ chữ mặc định 13px"
                    >
                      Mặc định
                    </button>
                  )}
                </div>
              </div>

              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Phông chữ mã nguồn & Terminal</b>
                  <span>Phông chữ Monospace hiển thị cho trình soạn thảo mã, trình xem file và bảng dòng lệnh.</span>
                </div>
                <div className="pm-setting__ctrl">
                  <select
                    className="pm-select"
                    value={settings.editorFontFamily || 'JetBrains Mono'}
                    onChange={(e) => onUpdate({ editorFontFamily: e.target.value })}
                  >
                    {CODE_FONTS.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Cỡ chữ mã nguồn</b>
                  <span>Cỡ chữ hiển thị trong tab Tệp mã nguồn và Bảng nhật ký Log.</span>
                </div>
                <div className="pm-setting__ctrl" style={{ gap: 8 }}>
                  <input
                    type="range"
                    min={11}
                    max={18}
                    step={1}
                    value={settings.editorFontSize || 13}
                    onChange={(e) => onUpdate({ editorFontSize: Number(e.target.value) })}
                    style={{ accentColor: 'var(--accent)', width: 100 }}
                  />
                  <span className="pm-range-val">{settings.editorFontSize || 13}px</span>
                </div>
              </div>

              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Giảm hiệu ứng chuyển động (Reduced Motion)</b>
                  <span>Tắt các hiệu ứng chuyển cảnh và trượt mượt để tăng tốc độ phản hồi tối đa cho máy tính.</span>
                </div>
                <div className="pm-setting__ctrl">
                  <button
                    className={`pm-switch ${settings.reducedMotion ? 'on' : ''}`}
                    onClick={() => toggle('reducedMotion')}
                    aria-label="Giảm hiệu ứng chuyển động"
                  />
                </div>
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════
              TAB 3: CANVAS & SOI PHẦN TỬ (CANVAS & INSPECTOR)
              ═══════════════════════════════════════════════ */}
          {tab === 'canvas' && (
            <>
              <h3>Trình biên tập Canvas & Soi phần tử</h3>
              <p className="pm-desc">Tuỳ biến không gian thiết kế vô cực kiểu Figma và các đường chỉ báo định vị.</p>

              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Lưới chấm nền Canvas (Blueprint Grid)</b>
                  <span>Hiển thị mạng lưới chấm toạ độ 20x20px trên nền sân khấu vô cực để dễ căn gióng bố cục.</span>
                </div>
                <div className="pm-setting__ctrl">
                  <button
                    className={`pm-switch ${settings.canvasGrid !== false ? 'on' : ''}`}
                    onClick={() => toggle('canvasGrid')}
                    aria-label="Lưới chấm nền Canvas"
                  />
                </div>
              </div>

              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Thước đo khoảng cách thông minh (Smart Guides)</b>
                  <span>Tự động đo và hiển thị khoảng cách pixel giữa các thẻ khi bạn kéo thả hoặc di chuyển phần tử.</span>
                </div>
                <div className="pm-setting__ctrl">
                  <button
                    className={`pm-switch ${settings.smartGuides !== false ? 'on' : ''}`}
                    onClick={() => toggle('smartGuides')}
                    aria-label="Thước đo thông minh"
                  />
                </div>
              </div>

              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Viền bao định vị khi rê chuột (Hover Outline)</b>
                  <span>Hiện viền xanh lục đứt nét bao quanh phần tử ngay khi con trỏ chuột lướt qua.</span>
                </div>
                <div className="pm-setting__ctrl">
                  <button
                    className={`pm-switch ${settings.hoverOutline !== false ? 'on' : ''}`}
                    onClick={() => toggle('hoverOutline')}
                    aria-label="Viền bao định vị"
                  />
                </div>
              </div>

              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Đồng bộ vị trí sang cây Phân cấp phần tử</b>
                  <span>Khi nhấp chọn một thẻ trên Canvas, cây Layers bên trái sẽ tự động mở rộng và cuộn tới đúng dòng thẻ đó.</span>
                </div>
                <div className="pm-setting__ctrl">
                  <button
                    className={`pm-switch ${settings.syncCanvasToTree !== false ? 'on' : ''}`}
                    onClick={() => toggle('syncCanvasToTree')}
                    aria-label="Đồng bộ vị trí cây"
                  />
                </div>
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════
              TAB 4: CHẠY & XEM TRƯỚC (RUN & PREVIEW)
              ═══════════════════════════════════════════════ */}
          {tab === 'run' && (
            <>
              <h3>Chạy máy chủ & Bản xem trước</h3>
              <p className="pm-desc">Cấu hình tiến trình dev server và môi trường phản chiếu giao diện.</p>

              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Tự động mở bản xem trước khi máy chủ sẵn sàng</b>
                  <span>Tự chuyển ngay sang màn hình Canvas khi tiến trình phát hiện địa chỉ localhost hoạt động.</span>
                </div>
                <div className="pm-setting__ctrl">
                  <button
                    className={`pm-switch ${settings.autoPreview ? 'on' : ''}`}
                    onClick={() => toggle('autoPreview')}
                    aria-label="Tự động mở xem trước"
                  />
                </div>
              </div>

              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Nơi hiển thị bản xem trước</b>
                  <span>Xem trực tiếp trong Artboard nhúng của PixelMind hoặc mở bằng trình duyệt hệ thống.</span>
                </div>
                <div className="pm-setting__ctrl">
                  <div className="pm-segmented">
                    <button
                      className={settings.previewMode === 'embedded' ? 'on' : ''}
                      onClick={() => onUpdate({ previewMode: 'embedded' })}
                    >
                      Nhúng trong app
                    </button>
                    <button
                      className={settings.previewMode === 'browser' ? 'on' : ''}
                      onClick={() => onUpdate({ previewMode: 'browser' })}
                    >
                      Trình duyệt ngoài
                    </button>
                  </div>
                </div>
              </div>

              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Tự động làm sạch log khi chạy lại (F5)</b>
                  <span>Xóa sạch các dòng nhật ký cũ trước khi khởi động lượt chạy mới để màn hình console luôn ngăn nắp.</span>
                </div>
                <div className="pm-setting__ctrl">
                  <button
                    className={`pm-switch ${settings.clearConsoleOnRun !== false ? 'on' : ''}`}
                    onClick={() => toggle('clearConsoleOnRun')}
                    aria-label="Tự động làm sạch log"
                  />
                </div>
              </div>

              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Giới hạn số dòng nhật ký lưu trong RAM</b>
                  <span>Tránh chiếm dụng bộ nhớ khi tiến trình máy chủ in ra hàng triệu dòng log liên tục.</span>
                </div>
                <div className="pm-setting__ctrl">
                  <select
                    className="pm-select"
                    value={settings.maxLogLines || 1000}
                    onChange={(e) => onUpdate({ maxLogLines: Number(e.target.value) })}
                  >
                    <option value={500}>500 dòng</option>
                    <option value={1000}>1,000 dòng (Khuyên dùng)</option>
                    <option value={2000}>2,000 dòng</option>
                    <option value={5000}>5,000 dòng</option>
                  </select>
                </div>
              </div>

              <div className="pm-guide__card" style={{ marginTop: 14 }}>
                <b style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={13} color="var(--accent)" /> Cơ chế cô lập & bảo vệ cổng mạng
                </b>
                <p style={{ margin: '6px 0 0', lineHeight: 1.6 }}>
                  PixelMind tự động nhận diện trình quản lý gói phù hợp với dự án (npm, pnpm, yarn, bun, dotnet, composer, python, maven). Khi bạn thoát dự án hoặc đóng ứng dụng, cơ chế tiêu diệt tiến trình cấp hệ điều hành (killPort) sẽ giải phóng hoàn toàn cổng mạng để không bị lỗi xung đột cổng.
                </p>
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════
              TAB 5: TRỢ LÝ AI (AI GATEWAY)
              ═══════════════════════════════════════════════ */}
          {tab === 'ai' && (
            <>
              <h3>Trợ lý AI &amp; AI Gateway</h3>
              <p className="pm-desc">
                PixelMind dùng giao thức OpenAI-compatible cho cả API cloud và Ollama local. Khoá API
                chỉ được đọc trong main process từ biến môi trường hoặc tệp <code>.env</code> — không
                lưu vào cài đặt và không bao giờ gửi xuống giao diện.
              </p>

              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Nhà cung cấp</b>
                  <span>Chuyển provider sẽ đặt lại Base URL và model mặc định tương ứng.</span>
                </div>
                <div className="pm-setting__ctrl">
                  <div className="pm-segmented">
                    <button
                      className={(settings.aiProvider ?? 'openai') === 'openai' ? 'on' : ''}
                      onClick={() => setProvider('openai')}
                    >
                      OpenAI-compatible
                    </button>
                    <button
                      className={settings.aiProvider === 'gemini' ? 'on' : ''}
                      onClick={() => setProvider('gemini')}
                    >
                      Google Gemini / AI Studio
                    </button>
                    <button
                      className={settings.aiProvider === 'ollama' ? 'on' : ''}
                      onClick={() => setProvider('ollama')}
                    >
                      Ollama Local
                    </button>
                  </div>
                </div>
              </div>

              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Base URL</b>
                  <span>Thường kết thúc bằng <code>/v1</code>. Ví dụ Ollama: http://localhost:11434/v1</span>
                </div>
                <div className="pm-setting__ctrl">
                  <input
                    className="pm-input mono"
                    style={{ width: 280 }}
                    value={settings.aiBaseUrl ?? 'https://api.openai.com/v1'}
                    placeholder="https://api.openai.com/v1"
                    onChange={(e) => {
                      onUpdate({ aiBaseUrl: e.target.value })
                      setAiTest(null)
                    }}
                  />
                </div>
              </div>

              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Model</b>
                  <span>Tên model gửi tới endpoint Chat Completions.</span>
                </div>
                <div className="pm-setting__ctrl">
                  <input
                    className="pm-input mono"
                    style={{ width: 220 }}
                    value={settings.aiModel ?? 'gpt-4o-mini'}
                    placeholder="gpt-4o-mini"
                    onChange={(e) => {
                      onUpdate({ aiModel: e.target.value })
                      setAiTest(null)
                    }}
                  />
                </div>
              </div>

              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Temperature</b>
                  <span>0 = ổn định, 2 = sáng tạo. Nên dùng 0.1–0.3 cho sửa mã nguồn.</span>
                </div>
                <div className="pm-setting__ctrl" style={{ gap: 8 }}>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.aiTemperature ?? 0.2}
                    onChange={(e) => onUpdate({ aiTemperature: Number(e.target.value) })}
                    style={{ accentColor: 'var(--accent)', width: 110 }}
                  />
                  <span className="pm-range-val">{(settings.aiTemperature ?? 0.2).toFixed(2)}</span>
                </div>
              </div>

              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Max tokens</b>
                  <span>Giới hạn độ dài phản hồi của model (256–32768).</span>
                </div>
                <div className="pm-setting__ctrl">
                  <input
                    className="pm-input"
                    type="number"
                    min={256}
                    max={32768}
                    step={128}
                    style={{ width: 120 }}
                    value={settings.aiMaxTokens ?? 2048}
                    onChange={(e) => onUpdate({ aiMaxTokens: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="pm-guide__card" style={{ marginTop: 14 }}>
                <b style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Plug size={13} color="var(--accent)" /> Trạng thái khoá API
                </b>
                <p style={{ margin: '6px 0 0', lineHeight: 1.6 }}>
                  {aiStatus?.key.present ? (
                    <>
                      Đã tìm thấy khoá <code>{aiStatus.key.masked}</code> từ{' '}
                      <b>
                        {aiStatus.key.source === 'process-env'
                          ? 'biến môi trường'
                          : aiStatus.key.source === 'user-data-env'
                            ? 'pixelmind.env (userData)'
                            : '.env của dự án'}
                      </b>
                      .
                      {aiStatus.key.envFile && (
                        <>
                          <br />
                          <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>
                            {aiStatus.key.envFile}
                          </span>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      Chưa có khoá. Đặt <code>PIXELMIND_AI_KEY</code> trong biến môi trường, hoặc tạo
                      tệp <code>pixelmind.env</code> trong thư mục dữ liệu ứng dụng, hoặc <code>.env</code>{' '}
                      của dự án (chỉ dùng khi chạy với dự án đang mở).
                    </>
                  )}
                </p>
                <p style={{ margin: '6px 0 0', lineHeight: 1.6, color: 'var(--text-3)', fontSize: 11 }}>
                  Thứ tự ưu tiên: biến môi trường → pixelmind.env → .env của dự án. Khoá không được
                  ghi vào pixelmind-store.json.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                <button className="btn primary" onClick={() => void runAiTest()} disabled={aiTesting}>
                  {aiTesting ? <RotateCcw size={12} className="pm-spin" /> : <Plug size={12} />}
                  {aiTesting ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}
                </button>
                {aiTest && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 11,
                      fontWeight: 600,
                      color: aiTest.ok ? '#10b981' : '#ef4444',
                    }}
                  >
                    {aiTest.ok ? <Check size={12} /> : <X size={12} />}
                    {aiTest.ok ? 'OK' : 'Fail'} · {aiTest.latencyMs}ms
                  </span>
                )}
              </div>

              {aiTest && (
                <div
                  style={{
                    marginTop: 8,
                    padding: '8px 10px',
                    borderRadius: 8,
                    fontSize: 11,
                    lineHeight: 1.6,
                    border: `1px solid ${aiTest.ok ? 'rgba(16,185,129,.35)' : 'rgba(239,68,68,.35)'}`,
                    background: aiTest.ok ? 'rgba(16,185,129,.08)' : 'rgba(239,68,68,.08)',
                  }}
                >
                  {aiTest.message}
                  {aiTest.models && aiTest.models.length > 0 && (
                    <div style={{ marginTop: 4, color: 'var(--text-3)' }}>
                      Model khả dụng: {aiTest.models.slice(0, 8).join(', ')}
                      {aiTest.models.length > 8 ? '…' : ''}
                    </div>
                  )}
                </div>
              )}

              {aiStatus && !aiStatus.configured && (
                <div
                  className="pm-console-warn"
                  style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'flex-start' }}
                >
                  <AlertTriangle size={12} />
                  <span>{aiStatus.error ?? 'AI Gateway chưa sẵn sàng.'}</span>
                </div>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════
              TAB 5: DỮ LIỆU & BỘ NHỚ (DATA & STORAGE)
              ═══════════════════════════════════════════════ */}
          {tab === 'data' && (
            <>
              <h3>Dữ liệu & Bộ nhớ lưu trữ</h3>
              <p className="pm-desc">Quản lý kho tệp JSON nội bộ, sao lưu cấu hình và dọn dẹp bộ nhớ đệm.</p>

              <div className="pm-field" style={{ marginBottom: 12 }}>
                <label>Vị trí tệp cơ sở dữ liệu</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="pm-input mono" readOnly value={storePath} style={{ flex: 1 }} />
                  <button
                    className="btn"
                    onClick={handleCopyPath}
                    title="Sao chép đường dẫn vào clipboard"
                  >
                    {copiedStorePath ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  </button>
                  <button className="btn" onClick={onOpenDataFolder} title="Mở thư mục trong Windows Explorer">
                    <FolderOpen size={12} /> Mở thư mục
                  </button>
                </div>
              </div>

              <div className="pm-kv">
                <span className="k">Số lượng dự án trong kho</span>
                <span className="v">
                  <span className="pm-settings-badge accent">{projectCount} dự án</span>
                </span>
              </div>
              <div className="pm-kv">
                <span className="k">Định dạng cơ sở dữ liệu</span>
                <span className="v">Atomic JSON v1 (An toàn khi sập nguồn)</span>
              </div>

              <h4 style={{ margin: '16px 0 8px', fontSize: 12 }}>Sao lưu & Phục hồi Cài đặt</h4>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button className="btn" onClick={handleExportSettings}>
                  <Download size={12} /> Xuất cài đặt (JSON)
                </button>
                <button className="btn" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={12} /> Nhập cài đặt (JSON)
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={handleImportSettings}
                />
              </div>

              {onClearCache && (
                <div className="pm-setting">
                  <div className="pm-setting__txt">
                    <b>Dọn dẹp bộ nhớ đệm Preview (Webview Cache)</b>
                    <span>Xoá bỏ cache, cookie và local storage tạm thời của trang web preview để giải phóng RAM.</span>
                  </div>
                  <div className="pm-setting__ctrl">
                    <button className="btn" onClick={onClearCache}>
                      <RotateCcw size={12} /> Xóa bộ nhớ đệm
                    </button>
                  </div>
                </div>
              )}

              {/* VÙNG NGUY HIỂM (DANGER ZONE) */}
              <div className="pm-danger-zone">
                <h4>
                  <AlertTriangle size={14} /> Vùng nguy hiểm: Khôi phục toàn bộ
                </h4>
                <p>
                  Thao tác này sẽ xoá sạch danh sách dự án và đưa mọi cài đặt của PixelMind về trạng thái ban đầu như mới cài đặt. Thao tác này <b>không xoá mã nguồn</b> trên đĩa cứng của bạn.
                </p>
                {!showDangerConfirm ? (
                  <button
                    className="btn danger"
                    onClick={() => setShowDangerConfirm(true)}
                  >
                    <Trash2 size={12} /> Xoá toàn bộ dữ liệu ứng dụng…
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
                      Bạn có chắc chắn muốn xóa toàn bộ?
                    </span>
                    <button
                      className="btn danger"
                      onClick={() => {
                        setShowDangerConfirm(false)
                        onResetAllData?.()
                      }}
                    >
                      Xác nhận xoá
                    </button>
                    <button className="btn" onClick={() => setShowDangerConfirm(false)}>
                      Huỷ bỏ
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════
              TAB 6: GIỚI THIỆU & PHÍM TẮT (ABOUT & SHORTCUTS)
              ═══════════════════════════════════════════════ */}
          {tab === 'about' && (
            <>
              <h3>PixelMind Desktop</h3>
              <p className="pm-desc">
                Môi trường thiết kế trực quan và không gian làm việc tích hợp cho lập trình viên web hiện đại.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
                <div className="pm-kv">
                  <span className="k">Phiên bản ứng dụng</span>
                  <span className="v">{appInfo?.appVersion ?? '0.1.0'}</span>
                </div>
                <div className="pm-kv">
                  <span className="k">Electron Core</span>
                  <span className="v">{appInfo?.electron ?? '—'}</span>
                </div>
                <div className="pm-kv">
                  <span className="k">Chromium Engine</span>
                  <span className="v">{appInfo?.chrome ?? '—'}</span>
                </div>
                <div className="pm-kv">
                  <span className="k">Node.js Runtime</span>
                  <span className="v">{appInfo?.node ?? '—'}</span>
                </div>
                <div className="pm-kv">
                  <span className="k">Hệ điều hành</span>
                  <span className="v">{appInfo ? `${appInfo.platform} (${appInfo.arch})` : '—'}</span>
                </div>
                <div className="pm-kv">
                  <span className="k">Bản quyền</span>
                  <span className="v">PixelMind Team</span>
                </div>
              </div>

              {/* Tra cứu phím tắt */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 8 }}>
                <h4 style={{ fontSize: 12, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Keyboard size={13} /> Bảng tra cứu phím tắt toàn năng
                </h4>
              </div>

              <div className="pm-shortcuts-search">
                <Search size={13} style={{ color: 'var(--text-3)' }} />
                <input
                  type="text"
                  placeholder="Tìm phím tắt (Ctrl, F5, Canvas, Soi...)..."
                  value={shortcutFilter}
                  onChange={(e) => setShortcutFilter(e.target.value)}
                />
                {shortcutFilter && (
                  <button
                    style={{ fontSize: 11, color: 'var(--text-3)', cursor: 'pointer' }}
                    onClick={() => setShortcutFilter('')}
                  >
                    Xoá
                  </button>
                )}
              </div>

              {filteredShortcuts.map((group) => (
                <div key={group.title} className="pm-shortcuts-group">
                  <h5>{group.title}</h5>
                  <table className="pm-shortcuts" style={{ width: '100%' }}>
                    <tbody>
                      {group.items.map((item) => (
                        <tr key={item.name}>
                          <td style={{ width: '60%' }}>{item.name}</td>
                          <td style={{ textAlign: 'right' }}>
                            {item.keys.map((k) => (
                              <span key={k} className="pm-kbd" style={{ marginLeft: 3 }}>
                                {k}
                              </span>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default SettingsDialog
