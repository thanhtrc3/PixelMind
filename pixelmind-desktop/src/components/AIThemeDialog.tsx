import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  Contrast,
  Loader2,
  Lock,
  Palette,
  RefreshCw,
  Sparkles,
  Type,
  Unlock,
  Wand2,
} from 'lucide-react'
import Modal from './Modal'
import {
  AI_CONTENT_FIELDS,
  AI_CONTENT_TONES,
  AI_THEMES,
  type AiThemeOption,
} from '../lib/aiMock'

type ToastKind = 'ok' | 'err' | 'info'
type TabId = 'theme' | 'content'

interface AIThemeDialogProps {
  onClose: () => void
  onShowToast: (kind: ToastKind, text: string) => void
  projectName?: string
}

const MOODS = ['Tối giản', 'Cổ điển', 'Hiện đại', 'Rực rỡ', 'Dịu mắt']

const CONTENT_VARIANTS: Record<string, string[]> = {
  'chuyen-nghiep': [
    'Khai cuộc cùng Bàn Cờ Tướng',
    'Học cờ tướng bài bản, đấu trực tuyến và theo dõi tiến bộ trong một nền tảng duy nhất.',
    'Bắt đầu miễn phí',
    'Đấu trực tuyến theo thời gian thực',
    'Bài tập khai cuộc được cá nhân hoá',
    'Bảng xếp hạng minh bạch và công bằng',
  ],
  'than-thien': [
    'Cùng nhau chơi cờ tướng nào!',
    'Một chỗ thân thiện để học cờ, chơi với bạn bè và xem mình tiến bộ mỗi ngày.',
    'Chơi thử ngay',
    'Gặp đối thủ cùng trình độ',
    'Bài tập nhỏ, vui và dễ hiểu',
    'Leo hạng cùng cộng đồng',
  ],
  'ngan-gon': [
    'Chơi cờ tướng',
    'Học nhanh, đấu vui, tiến bộ mỗi ngày.',
    'Chơi ngay',
    'Đấu online',
    'Luyện khai cuộc',
    'Bảng hạng',
  ],
  'hao-hung': [
    'Sẵn sàng khai cuộc?',
    'Mỗi ván cờ là một cơ hội mới — vào bàn, tung chiêu và chinh phục bảng xếp hạng!',
    'Vào bàn ngay',
    'Đấu nảy lửa mỗi ngày',
    'Thử thách khai cuộc đỉnh cao',
    'Ghi danh bảng vàng',
  ],
}

const hexToRgb = (hex: string) => {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value
  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0,
  }
}

const luminance = (hex: string) => {
  const { r, g, b } = hexToRgb(hex)
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

const contrast = (a: string, b: string) => {
  const la = luminance(a)
  const lb = luminance(b)
  const ratio = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
  return Math.round(ratio * 10) / 10
}

const ThemePreview = ({ theme }: { theme: AiThemeOption }) => (
  <div
    className="pm-ai-theme-preview"
    style={{ background: theme.bg, color: theme.text, borderRadius: theme.radius }}
  >
    <div className="pm-ai-theme-preview__bar" style={{ background: theme.surface }}>
      <span style={{ background: theme.accent }} />
      <span style={{ background: theme.accent2 }} />
      <i style={{ background: theme.muted }} />
    </div>
    <div className="pm-ai-theme-preview__body">
      <b style={{ color: theme.text }}>Khai cuộc</b>
      <span style={{ background: theme.muted }} />
      <span style={{ background: theme.muted, width: '62%' }} />
      <div className="pm-ai-theme-preview__row">
        <em style={{ background: theme.accent, color: '#fff', borderRadius: theme.radius / 2 }}>
          Chơi ngay
        </em>
        <em
          style={{
            border: `1px solid ${theme.accent}`,
            color: theme.accent,
            borderRadius: theme.radius / 2,
          }}
        >
          Học luật
        </em>
      </div>
      <div className="pm-ai-theme-preview__swatches">
        <span style={{ background: theme.accent }} />
        <span style={{ background: theme.accent2 }} />
        <span style={{ background: theme.surface }} />
        <span style={{ background: theme.text }} />
      </div>
    </div>
  </div>
)

const AIThemeDialog = ({ onClose, onShowToast, projectName }: AIThemeDialogProps) => {
  const [tab, setTab] = useState<TabId>('theme')
  const [prompt, setPrompt] = useState('Theme cờ tướng hiện đại, nền tối, màu nhấn đỏ son, chữ Việt dễ đọc.')
  const [mood, setMood] = useState('Cổ điển')
  const [themes, setThemes] = useState<AiThemeOption[]>(AI_THEMES)
  const [selected, setSelected] = useState(AI_THEMES[0].id)
  const [generating, setGenerating] = useState(false)
  const [applied, setApplied] = useState(false)
  const [locks, setLocks] = useState<Record<string, boolean>>({})
  const [tone, setTone] = useState(AI_CONTENT_TONES[0].id)
  const [fields, setFields] = useState(AI_CONTENT_FIELDS)
  const timers = useRef<number[]>([])

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id))
    },
    [],
  )

  const selectedTheme = themes.find((item) => item.id === selected) ?? themes[0]
  const ratio = useMemo(
    () => contrast(selectedTheme.accent, selectedTheme.text),
    [selectedTheme],
  )
  const lockedLabels = Object.keys(locks).filter((key) => locks[key])

  const generate = () => {
    setGenerating(true)
    setApplied(false)
    timers.current.push(
      window.setTimeout(() => {
        setThemes((prev) =>
          prev.map((item, index) =>
            index === 0
              ? { ...item, mood: `${mood} · ${prompt.slice(0, 34)}…`, name: `${mood} · ${item.name.split('·')[1]?.trim() ?? 'mới'}` }
              : item,
          ),
        )
        setGenerating(false)
        onShowToast('ok', `Đã sinh ${themes.length} phương án theme (mô phỏng).`)
      }, 1200),
    )
  }

  const regenerateContent = () => {
    const variant = CONTENT_VARIANTS[tone] ?? CONTENT_VARIANTS['chuyen-nghiep']
    setFields((prev) => prev.map((item, index) => ({ ...item, value: variant[index] ?? item.value })))
    onShowToast('ok', `Đã sinh lại nội dung theo giọng "${AI_CONTENT_TONES.find((t) => t.id === tone)?.label}" (mô phỏng).`)
  }

  const applyTheme = () => {
    setApplied(true)
    onShowToast(
      'ok',
      `Đã chọn theme "${selectedTheme.name}"${
        lockedLabels.length ? ` · giữ nguyên ${lockedLabels.join(', ')}` : ''
      } (mô phỏng, chưa ghi tokens.css).`,
    )
  }

  const applyContent = () => {
    onShowToast('ok', 'Đã đánh dấu áp dụng nội dung vào section đang chọn (mô phỏng, chưa ghi tệp).')
    onClose()
  }

  const tokenLocks = [
    { id: 'accent', label: 'Màu nhấn' },
    { id: 'font', label: 'Typography' },
    { id: 'radius', label: 'Bo góc' },
  ]

  return (
    <Modal
      title="AI tạo Theme & Nội dung"
      subtitle={projectName ? `${projectName} · sinh design tokens và nội dung mẫu` : 'Sinh design tokens và nội dung mẫu'}
      icon={<Palette size={16} />}
      width={940}
      onClose={onClose}
      footer={
        <>
          <span className="grow">
            {tab === 'theme'
              ? `${themes.length} phương án · tương phản ${ratio}:1${ratio >= 4.5 ? ' (đạt AA)' : ' (nên tăng)'}`
              : `${fields.length} trường nội dung · giọng ${AI_CONTENT_TONES.find((t) => t.id === tone)?.label}`}
          </span>
          <button className="btn" onClick={onClose}>
            Đóng
          </button>
          {tab === 'theme' ? (
            <button className="btn primary" onClick={applyTheme} disabled={applied}>
              <Check size={13} /> Áp dụng theme
            </button>
          ) : (
            <button className="btn primary" onClick={applyContent}>
              <Check size={13} /> Áp dụng nội dung
            </button>
          )}
        </>
      }
    >
      <div className="pm-ai-theme">
        <div className="pm-ai-theme__tabs">
          <button className={tab === 'theme' ? 'is-on' : ''} onClick={() => setTab('theme')}>
            <Palette size={12} /> Theme
          </button>
          <button className={tab === 'content' ? 'is-on' : ''} onClick={() => setTab('content')}>
            <Type size={12} /> Nội dung
          </button>
        </div>

        {tab === 'theme' ? (
          <div className="pm-ai-theme__layout">
            <div className="pm-ai-theme__side">
              <label className="pm-ai-label" htmlFor="pm-ai-theme-prompt">
                Mô tả phong cách
              </label>
              <textarea
                id="pm-ai-theme-prompt"
                className="pm-ai-textarea"
                rows={4}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
              />
              <div className="pm-ai-theme__moods">
                {MOODS.map((item) => (
                  <button
                    key={item}
                    className={`pm-ai-chip ${mood === item ? 'is-on' : ''}`}
                    onClick={() => setMood(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="pm-ai-theme__locks">
                <span className="pm-ai-label">Khoá token không đổi</span>
                <div>
                  {tokenLocks.map((item) => (
                    <button
                      key={item.id}
                      className={`pm-ai-lock ${locks[item.id] ? 'is-on' : ''}`}
                      onClick={() =>
                        setLocks((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                      }
                    >
                      {locks[item.id] ? <Lock size={10} /> : <Unlock size={10} />}
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <button className="btn primary" onClick={generate} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 size={13} className="pm-spin" /> Đang sinh theme…
                  </>
                ) : (
                  <>
                    <Wand2 size={13} /> Sinh lại phương án
                  </>
                )}
              </button>
              <p className="pm-ai-theme__hint">
                Preview chỉ đổi cục bộ trong hộp thoại. Bấm <b>Áp dụng theme</b> mới đưa vào hàng
                đợi ghi <code>tokens.css</code>.
              </p>
            </div>

            <div className="pm-ai-theme__grid">
              {themes.map((theme) => {
                const isSelected = theme.id === selected
                return (
                  <button
                    key={theme.id}
                    className={`pm-ai-theme-card ${isSelected ? 'is-on' : ''}`}
                    onClick={() => {
                      setSelected(theme.id)
                      setApplied(false)
                    }}
                  >
                    <ThemePreview theme={theme} />
                    <div className="pm-ai-theme-card__meta">
                      <b>{theme.name}</b>
                      <span>{theme.mood}</span>
                      <div className="pm-ai-theme-card__row">
                        <span>{theme.font}</span>
                        <span>{theme.radius}px</span>
                        <span className={`pm-ai-contrast ${contrast(theme.accent, theme.text) >= 4.5 ? 'is-good' : 'is-warn'}`}>
                          <Contrast size={9} />
                          {contrast(theme.accent, theme.text)}:1
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="pm-ai-theme-card__check">
                        <Check size={10} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="pm-ai-content">
            <div className="pm-ai-content__bar">
              <span className="pm-ai-label">Giọng điệu</span>
              <div className="pm-ai-theme__moods">
                {AI_CONTENT_TONES.map((item) => (
                  <button
                    key={item.id}
                    className={`pm-ai-chip ${tone === item.id ? 'is-on' : ''}`}
                    onClick={() => setTone(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <button className="btn sm" onClick={regenerateContent}>
                <RefreshCw size={11} /> Sinh lại
              </button>
            </div>

            <div className="pm-ai-content__grid">
              {fields.map((field) => (
                <label key={field.id} className="pm-ai-content__field">
                  <span className="pm-ai-label">{field.label}</span>
                  <textarea
                    className="pm-ai-textarea"
                    rows={field.id.startsWith('hero-sub') ? 3 : 2}
                    value={field.value}
                    onChange={(event) =>
                      setFields((prev) =>
                        prev.map((item) =>
                          item.id === field.id ? { ...item, value: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <span className="pm-ai-content__len">{field.value.length} ký tự</span>
                </label>
              ))}
            </div>

            <div className="pm-ai-content__notice">
              <Sparkles size={12} />
              <span>
                Nội dung chỉ là bản nháp mô phỏng. Kiểm tra độ dài trước khi áp dụng để không phá bố
                cục.
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default AIThemeDialog
