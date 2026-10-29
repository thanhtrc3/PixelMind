import { useState } from 'react'
import {
  Database,
  FolderOpen,
  Info,
  Palette,
  RotateCcw,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Terminal,
} from 'lucide-react'
import type { AppInfo, Settings } from '@shared/types'
import Modal from './Modal'

interface SettingsDialogProps {
  settings: Settings
  appInfo: AppInfo | null
  storePath: string
  projectCount: number
  isDesktop: boolean
  onUpdate: (patch: Partial<Settings>) => void
  onReset: () => void
  onOpenDataFolder: () => void
  onClose: () => void
}

type TabId = 'general' | 'appearance' | 'run' | 'data' | 'about'

const TABS: Array<{ id: TabId; label: string; icon: typeof SettingsIcon }> = [
  { id: 'general', label: 'Chung', icon: SlidersHorizontal },
  { id: 'appearance', label: 'Giao diện', icon: Palette },
  { id: 'run', label: 'Chạy & xem trước', icon: Terminal },
  { id: 'data', label: 'Dữ liệu', icon: Database },
  { id: 'about', label: 'Giới thiệu', icon: Info },
]

const ACCENTS = ['#6d5df5', '#4a8df6', '#31c07a', '#e2b13c', '#f0553f', '#e05aa8']

const SettingsDialog = ({
  settings,
  appInfo,
  storePath,
  projectCount,
  isDesktop,
  onUpdate,
  onReset,
  onOpenDataFolder,
  onClose,
}: SettingsDialogProps) => {
  const [tab, setTab] = useState<TabId>('general')

  const toggle = (key: 'openLastProject' | 'confirmDelete' | 'showHidden' | 'autoPreview') =>
    onUpdate({ [key]: !settings[key] } as Partial<Settings>)

  return (
    <Modal
      title="Cài đặt"
      subtitle="Thay đổi được lưu ngay vào thư mục dữ liệu của ứng dụng."
      icon={<SettingsIcon size={16} />}
      width={820}
      onClose={onClose}
      footer={
        <>
          <span className="grow">
            {isDesktop ? `Dữ liệu: ${storePath || 'đang tải…'}` : 'Chế độ trình duyệt — cài đặt lưu tạm trong localStorage.'}
          </span>
          <button className="btn" onClick={onReset}>
            <RotateCcw size={12} /> Khôi phục mặc định
          </button>
          <button className="btn primary" onClick={onClose}>
            Xong
          </button>
        </>
      }
    >
      <div className="pm-settings">
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

        <div className="pm-settings__pane">
          {tab === 'general' && (
            <>
              <h3>Hành vi chung</h3>
              <p className="pm-desc">Các tuỳ chọn áp dụng cho toàn bộ ứng dụng.</p>
              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Tự mở dự án gần nhất</b>
                  <span>Khôi phục dự án bạn mở lần trước khi khởi động PixelMind.</span>
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
                  <b>Hỏi trước khi xoá dự án</b>
                  <span>Hiện hộp thoại xác nhận khi xoá dự án khỏi danh sách.</span>
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
                  <span>Bao gồm các mục bắt đầu bằng dấu chấm như .env, .github.</span>
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
                  <b>Script chạy mặc định</b>
                  <span>Tên script dùng khi nhấn F5. Để trống sẽ tự chọn script phát triển đầu tiên.</span>
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

          {tab === 'appearance' && (
            <>
              <h3>Giao diện</h3>
              <p className="pm-desc">Chọn chủ đề, màu nhấn và cỡ chữ hiển thị.</p>
              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Chủ đề</b>
                  <span>Chế độ tối phù hợp khi làm việc lâu, chế độ sáng rõ hơn khi trời sáng.</span>
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
                  </div>
                </div>
              </div>
              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Màu nhấn</b>
                  <span>Áp dụng cho nút chính, mục đang chọn và điểm nhấn điều hướng.</span>
                </div>
                <div className="pm-setting__ctrl">
                  <div className="pm-swatches">
                    {ACCENTS.map((color) => (
                      <button
                        key={color}
                        className={`pm-swatch ${settings.accent.toLowerCase() === color ? 'on' : ''}`}
                        style={{ background: color }}
                        title={color}
                        onClick={() => onUpdate({ accent: color })}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Cỡ chữ giao diện</b>
                  <span>Hiện tại: {settings.fontSize}px. Phù hợp màn hình 13–15 inch.</span>
                </div>
                <div className="pm-setting__ctrl">
                  <input
                    type="range"
                    min={11}
                    max={16}
                    step={1}
                    value={settings.fontSize}
                    onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                </div>
              </div>
            </>
          )}

          {tab === 'run' && (
            <>
              <h3>Chạy & xem trước</h3>
              <p className="pm-desc">
                PixelMind đọc đầu ra của tiến trình để tìm địa chỉ localhost và hiển thị giao diện dự án.
              </p>
              <div className="pm-setting">
                <div className="pm-setting__txt">
                  <b>Tự động mở bản xem trước</b>
                  <span>Chuyển sang tab “Xem trước” ngay khi phát hiện địa chỉ localhost.</span>
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
                  <span>Nhúng trong ứng dụng hoặc mở bằng trình duyệt mặc định của Windows.</span>
                </div>
                <div className="pm-setting__ctrl">
                  <div className="pm-segmented">
                    <button
                      className={settings.previewMode === 'embedded' ? 'on' : ''}
                      onClick={() => onUpdate({ previewMode: 'embedded' })}
                    >
                      Nhúng
                    </button>
                    <button
                      className={settings.previewMode === 'browser' ? 'on' : ''}
                      onClick={() => onUpdate({ previewMode: 'browser' })}
                    >
                      Trình duyệt
                    </button>
                  </div>
                </div>
              </div>
              <div className="pm-guide__card">
                <b>Lưu ý khi chạy</b>
                <p style={{ margin: '6px 0 0' }}>
                  Tiến trình được chạy trong thư mục dự án bằng đúng trình quản lý gói mà dự án dùng (npm, pnpm, yarn
                  hoặc bun). Khi thoát ứng dụng, mọi tiến trình con sẽ được dừng theo.
                </p>
              </div>
            </>
          )}

          {tab === 'data' && (
            <>
              <h3>Dữ liệu ứng dụng</h3>
              <p className="pm-desc">
                Danh sách dự án và cài đặt được lưu trong một tệp JSON nhỏ, không gửi đi đâu cả.
              </p>
              <div className="pm-field" style={{ marginBottom: 12 }}>
                <label>Tệp lưu trữ</label>
                <input className="pm-input mono" readOnly value={storePath} />
              </div>
              <div className="pm-row" style={{ marginBottom: 14 }}>
                <button className="btn" onClick={onOpenDataFolder}>
                  <FolderOpen size={12} /> Mở thư mục dữ liệu
                </button>
              </div>
              <div className="pm-kv">
                <span className="k">Số dự án</span>
                <span className="v">{projectCount}</span>
              </div>
              <div className="pm-kv">
                <span className="k">Phiên bản dữ liệu</span>
                <span className="v">1 (JSON)</span>
              </div>
              <div className="pm-setting" style={{ marginTop: 10 }}>
                <div className="pm-setting__txt">
                  <b>Khôi phục toàn bộ</b>
                  <span>Xoá danh sách dự án và đưa mọi cài đặt về mặc định. Không xoá mã nguồn trên đĩa.</span>
                </div>
                <div className="pm-setting__ctrl">
                  <button className="btn danger" onClick={onReset}>
                    <RotateCcw size={12} /> Khôi phục
                  </button>
                </div>
              </div>
            </>
          )}

          {tab === 'about' && (
            <>
              <h3>PixelMind Desktop</h3>
              <p className="pm-desc">
                Không gian làm việc giúp mở dự án giao diện, xem mã nguồn, chạy máy chủ phát triển và theo dõi bản
                xem trước trong cùng một cửa sổ.
              </p>
              <div className="pm-kv">
                <span className="k">Phiên bản</span>
                <span className="v">{appInfo?.appVersion ?? '0.1.0'}</span>
              </div>
              <div className="pm-kv">
                <span className="k">Electron</span>
                <span className="v">{appInfo?.electron ?? '—'}</span>
              </div>
              <div className="pm-kv">
                <span className="k">Chromium</span>
                <span className="v">{appInfo?.chrome ?? '—'}</span>
              </div>
              <div className="pm-kv">
                <span className="k">Node.js</span>
                <span className="v">{appInfo?.node ?? '—'}</span>
              </div>
              <div className="pm-kv">
                <span className="k">Hệ điều hành</span>
                <span className="v">
                  {appInfo ? `${appInfo.platform} · ${appInfo.arch}` : '—'}
                </span>
              </div>

              <h4 style={{ marginTop: 18, fontSize: 12 }}>Phím tắt</h4>
              <table className="pm-shortcuts">
                <tbody>
                  <tr>
                    <td>Mở thư mục dự án</td>
                    <td>
                      <span className="pm-kbd">Ctrl</span> <span className="pm-kbd">O</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Chạy dự án</td>
                    <td>
                      <span className="pm-kbd">F5</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Dừng tiến trình</td>
                    <td>
                      <span className="pm-kbd">Shift</span> <span className="pm-kbd">F5</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Bảng lệnh</td>
                    <td>
                      <span className="pm-kbd">Ctrl</span> <span className="pm-kbd">K</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Cài đặt</td>
                    <td>
                      <span className="pm-kbd">Ctrl</span> <span className="pm-kbd">,</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default SettingsDialog
