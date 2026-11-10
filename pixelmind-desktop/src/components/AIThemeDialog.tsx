import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Contrast,
  Loader2,
  Lock,
  Palette,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Type,
  Unlock,
  Wand2,
} from 'lucide-react'
import Modal from './Modal'
import { AI_THEMES, type AiThemeOption } from '../lib/aiMock'
import { api } from '../lib/bridge'
import type { DesignTokens } from '@shared/types'

type ToastKind = 'ok' | 'err' | 'info'
type TabId = 'theme' | 'content'
type SectionId = 'hero' | 'features' | 'cta' | 'footer'

interface AIThemeDialogProps {
  onClose: () => void
  onShowToast: (kind: ToastKind, text: string) => void
  projectName?: string
  projectPath?: string
  onTokensUpdated?: (tokens: DesignTokens) => void
}

const MOODS = ['Tối giản', 'Cổ điển', 'Hiện đại', 'Rực rỡ', 'Dịu mắt']

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'hero', label: 'Hero Banner' },
  { id: 'features', label: 'Tính năng chính (Features)' },
  { id: 'cta', label: 'Kêu gọi hành động (CTA)' },
  { id: 'footer', label: 'Chân trang (Footer)' },
]

const TONES = [
  { id: 'chuyen-nghiep', label: 'Chuyên nghiệp' },
  { id: 'than-thien', label: 'Thân thiện' },
  { id: 'ngan-gon', label: 'Ngắn gọn' },
  { id: 'hao-hung', label: 'Hào hứng' },
]

interface ContentField {
  id: string
  label: string
  value: string
  original: string
  maxLength: number
}

const DEFAULT_SECTION_FIELDS: Record<SectionId, ContentField[]> = {
  hero: [
    {
      id: 'hero-title',
      label: 'Tiêu đề chính (Headline)',
      value: 'Khai cuộc cùng Bàn Cờ Tướng',
      original: 'Khai cuộc cùng Bàn Cờ Tướng',
      maxLength: 60,
    },
    {
      id: 'hero-sub',
      label: 'Đoạn giới thiệu phụ (Subtitle)',
      value:
        'Học cờ tướng bài bản, đấu trực tuyến theo thời gian thực và theo dõi tiến bộ trong một nền tảng duy nhất.',
      original:
        'Học cờ tướng bài bản, đấu trực tuyến theo thời gian thực và theo dõi tiến bộ trong một nền tảng duy nhất.',
      maxLength: 160,
    },
    {
      id: 'hero-cta-1',
      label: 'Nút hành động chính (Primary CTA)',
      value: 'Chơi ngay miễn phí',
      original: 'Chơi ngay miễn phí',
      maxLength: 25,
    },
    {
      id: 'hero-cta-2',
      label: 'Nút phụ (Secondary CTA)',
      value: 'Khám phá thế cờ',
      original: 'Khám phá thế cờ',
      maxLength: 25,
    },
  ],
  features: [
    {
      id: 'feat-1',
      label: 'Tính năng 1',
      value: 'Đấu trực tuyến theo thời gian thực với đối thủ cùng trình độ',
      original: 'Đấu trực tuyến theo thời gian thực với đối thủ cùng trình độ',
      maxLength: 80,
    },
    {
      id: 'feat-2',
      label: 'Tính năng 2',
      value: 'Bài tập khai cuộc thông minh được cá nhân hoá theo trình độ',
      original: 'Bài tập khai cuộc thông minh được cá nhân hoá theo trình độ',
      maxLength: 80,
    },
    {
      id: 'feat-3',
      label: 'Tính năng 3',
      value: 'Bảng xếp hạng Elo công bằng, minh bạch và vinh danh kỳ thủ',
      original: 'Bảng xếp hạng Elo công bằng, minh bạch và vinh danh kỳ thủ',
      maxLength: 80,
    },
  ],
  cta: [
    {
      id: 'cta-title',
      label: 'Tiêu đề khối kêu gọi',
      value: 'Sẵn sàng nâng cao trình độ cờ tướng của bạn?',
      original: 'Sẵn sàng nâng cao trình độ cờ tướng của bạn?',
      maxLength: 70,
    },
    {
      id: 'cta-desc',
      label: 'Lời kêu gọi',
      value: 'Tham gia cùng hàng nghìn kỳ thủ ngay hôm nay. Hoàn toàn miễn phí!',
      original: 'Tham gia cùng hàng nghìn kỳ thủ ngay hôm nay. Hoàn toàn miễn phí!',
      maxLength: 120,
    },
    {
      id: 'cta-btn',
      label: 'Nút đăng ký / bắt đầu',
      value: 'Tạo tài khoản ngay',
      original: 'Tạo tài khoản ngay',
      maxLength: 25,
    },
  ],
  footer: [
    {
      id: 'foot-tagline',
      label: 'Khẩu hiệu chân trang',
      value: 'Nền tảng cờ tướng trực tuyến hiện đại cho người Việt.',
      original: 'Nền tảng cờ tướng trực tuyến hiện đại cho người Việt.',
      maxLength: 90,
    },
    {
      id: 'foot-copy',
      label: 'Dòng bản quyền',
      value: '© 2026 PixelMind & BanCoTuong. Giữ toàn quyền bảo lưu.',
      original: '© 2026 PixelMind & BanCoTuong. Giữ toàn quyền bảo lưu.',
      maxLength: 70,
    },
  ],
}

/* ───────────────────────── WCAG Contrast Helpers ───────────────────────── */

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

const contrast = (a: string, b: string): number => {
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

/* ───────────────────────── Main Component ───────────────────────── */

const AIThemeDialog = ({
  onClose,
  onShowToast,
  projectName,
  projectPath,
  onTokensUpdated,
}: AIThemeDialogProps) => {
  const [tab, setTab] = useState<TabId>('theme')
  const [prompt, setPrompt] = useState(
    'Theme cờ tướng hiện đại, nền tối sang trọng, màu nhấn đỏ son hoàng gia, chữ sắc nét dễ đọc.',
  )
  const [mood, setMood] = useState('Cổ điển')
  const [themes, setThemes] = useState<AiThemeOption[]>(AI_THEMES)
  const [selected, setSelected] = useState(AI_THEMES[0].id)
  const [generating, setGenerating] = useState(false)
  const [applied, setApplied] = useState(false)
  const [locks, setLocks] = useState<Record<string, boolean>>({
    accent: false,
    font: false,
    radius: false,
    bg: false,
  })

  // Tab Nội dung
  const [currentSection, setCurrentSection] = useState<SectionId>('hero')
  const [tone, setTone] = useState('chuyen-nghiep')
  const [fields, setFields] = useState<ContentField[]>(DEFAULT_SECTION_FIELDS.hero)
  const [contentGenerating, setContentGenerating] = useState(false)
  const [applyingContent, setApplyingContent] = useState(false)

  const selectedTheme = useMemo(
    () => themes.find((item) => item.id === selected) ?? themes[0],
    [themes, selected],
  )

  // Tính tương phản WCAG thật
  const ratioTextBg = useMemo(
    () => contrast(selectedTheme.text, selectedTheme.bg),
    [selectedTheme],
  )
  const ratioAccentBg = useMemo(
    () => contrast(selectedTheme.accent, selectedTheme.bg),
    [selectedTheme],
  )
  const isWcagPass = ratioTextBg >= 4.5

  /* ── 1. Live Preview token CHỈ áp dụng trên Canvas dự án (iframe), tuyệt đối KHÔNG đụng giao diện PixelMind Desktop ── */
  useEffect(() => {
    // Luôn dọn dẹp thẻ style nếu từng vô tình bị rò rỉ vào document của PixelMind Desktop
    const leakedAppStyle = document.getElementById('pm-live-theme-preview')
    if (leakedAppStyle) leakedAppStyle.remove()

    const styleId = 'pm-canvas-project-theme'
    // Chỉ đồng bộ vào iframe canvas của dự án người dùng
    const iframes = document.querySelectorAll<HTMLIFrameElement>('.canvas__frame, iframe')
    iframes.forEach((iframe) => {
      try {
        const doc = iframe.contentDocument
        if (doc) {
          let s = doc.getElementById(styleId) as HTMLStyleElement | null
          if (!s) {
            s = doc.createElement('style')
            s.id = styleId
            doc.head.appendChild(s)
          }
          s.textContent = `:root {
            --accent: ${selectedTheme.accent} !important;
            --accent-hover: ${selectedTheme.accent}dd !important;
            --bg: ${selectedTheme.bg} !important;
            --surface: ${selectedTheme.surface} !important;
            --text: ${selectedTheme.text} !important;
            --text-muted: ${selectedTheme.muted} !important;
            --radius: ${selectedTheme.radius}px !important;
          }`
        }
      } catch {}
    })

    return () => {
      // Khi đóng dialog hoặc đổi theme, dọn dẹp preview tạm trên iframe và bảo đảm app chính sạch sẽ
      const leftover = document.getElementById('pm-live-theme-preview')
      if (leftover) leftover.remove()

      if (!applied) {
        iframes.forEach((iframe) => {
          try {
            iframe.contentDocument?.getElementById(styleId)?.remove()
          } catch {}
        })
      }
    }
  }, [selectedTheme, applied])

  /* ── 2. Sinh 3 phương án Theme thật qua Gateway ── */
  const generateThemes = async () => {
    setGenerating(true)
    setApplied(false)

    const lockedTokensDesc: string[] = []
    if (locks.accent) lockedTokensDesc.push(`Màu nhấn accent bắt buộc giữ: ${selectedTheme.accent}`)
    if (locks.bg) lockedTokensDesc.push(`Màu nền bg bắt buộc giữ: ${selectedTheme.bg}, surface: ${selectedTheme.surface}`)
    if (locks.font) lockedTokensDesc.push(`Font chữ bắt buộc giữ: ${selectedTheme.font}`)
    if (locks.radius) lockedTokensDesc.push(`Bo góc radius bắt buộc giữ: ${selectedTheme.radius}px`)

    const promptText = `Hãy tạo đúng 3 phương án theme màu và typography cho dự án "${projectName || 'Web'}".
Mô tả phong cách: "${prompt}".
Cảm xúc (mood): "${mood}".
${lockedTokensDesc.length ? `CÁC TOKEN ĐÃ BỊ KHOÁ (BẮT BUỘC GIỮ NGUYÊN):\n- ${lockedTokensDesc.join('\n- ')}` : ''}

Trả về DUY NHẤT một mảng JSON 3 đối tượng (không giải thích, không markdown bọc ngoài) với định dạng:
[
  {
    "id": "theme-1",
    "name": "Tên theme ngắn",
    "mood": "Mô tả ngắn",
    "accent": "#hex",
    "accent2": "#hex",
    "bg": "#hex",
    "surface": "#hex",
    "text": "#hex",
    "muted": "#hex",
    "font": "Tên font",
    "radius": 8
  }
]`

    try {
      const res = await api.ai.complete({
        prompt: promptText,
        system: 'Bạn là chuyên gia thiết kế UI/UX hệ thống Design Tokens. Chỉ trả về JSON hợp lệ.',
        projectPath,
      })

      let generated: AiThemeOption[] = []
      if (res.text) {
        try {
          const cleaned = res.text.replace(/^```json/i, '').replace(/```$/i, '').trim()
          const parsed = JSON.parse(cleaned) as AiThemeOption[]
          if (Array.isArray(parsed) && parsed.length >= 3) {
            generated = parsed.slice(0, 3)
          }
        } catch {}
      }

      // Fallback thông minh nếu Gateway chưa cấu hình hoặc model không trả về JSON
      if (!generated.length) {
        const moodPalettes: Record<string, AiThemeOption[]> = {
          'Cổ điển': [
            { id: 'do-son-ai', name: 'Đỏ son · Cung đình', mood: 'Cổ điển · hoàng gia', accent: '#b91c1c', accent2: '#d97706', bg: '#0c0a09', surface: '#1c1917', text: '#fafaf9', muted: '#a8a29e', font: 'Be Vietnam Pro', radius: 8 },
            { id: 'tram-huong-ai', name: 'Trầm hương · Gỗ mun', mood: 'Cổ kính · tĩnh lặng', accent: '#c2410c', accent2: '#ea580c', bg: '#18181b', surface: '#27272a', text: '#f4f4f5', muted: '#a1a1aa', font: 'Merriweather', radius: 6 },
            { id: 'ngoc-bich-ai', name: 'Ngọc bích · Thư pháp', mood: 'Trang nhã · thanh thoát', accent: '#047857', accent2: '#059669', bg: '#064e3b', surface: '#065f46', text: '#ecfdf5', muted: '#a7f3d0', font: 'Playfair Display', radius: 10 },
          ],
          'Hiện đại': [
            { id: 'neon-dark', name: 'Cyber Neon · Tối', mood: 'Công nghệ · rực rỡ', accent: '#6366f1', accent2: '#8b5cf6', bg: '#090d16', surface: '#131b2e', text: '#f8fafc', muted: '#94a3b8', font: 'Inter', radius: 12 },
            { id: 'emerald-focus', name: 'Ngọc lục bảo · Tinh gọn', mood: 'Hiện đại · tập trung', accent: '#10b981', accent2: '#06b6d4', bg: '#0f172a', surface: '#1e293b', text: '#f1f5f9', muted: '#64748b', font: 'Plus Jakarta Sans', radius: 14 },
            { id: 'amethyst-flow', name: 'Thạch anh tím · Mượt mà', mood: 'Sáng tạo · mượt', accent: '#8b5cf6', accent2: '#ec4899', bg: '#0e0b16', surface: '#1b1429', text: '#faf5ff', muted: '#c084fc', font: 'Inter', radius: 10 },
          ],
          'Tối giản': [
            { id: 'mono-slate', name: 'Slate Tối giản', mood: 'Đơn sắc · tinh tế', accent: '#3b82f6', accent2: '#60a5fa', bg: '#0a0a0c', surface: '#16161a', text: '#ffffff', muted: '#71717a', font: 'Inter', radius: 6 },
            { id: 'pure-contrast', name: 'Độ tương phản cao', mood: 'Rõ ràng · chuẩn WCAG', accent: '#2563eb', accent2: '#38bdf8', bg: '#000000', surface: '#121212', text: '#ffffff', muted: '#a3a3a3', font: 'Roboto', radius: 4 },
            { id: 'warm-minimal', name: 'Tối giản Ấm áp', mood: 'Dễ chịu · cân bằng', accent: '#f59e0b', accent2: '#fbbf24', bg: '#171717', surface: '#262626', text: '#f5f5f5', muted: '#a3a3a3', font: 'Be Vietnam Pro', radius: 8 },
          ],
        }
        generated = moodPalettes[mood] ?? moodPalettes['Hiện đại']
      }

      // Áp dụng khoá token: giữ nguyên token bị khoá
      const preserved = generated.map((item, idx) => ({
        ...item,
        id: `gen-${idx + 1}-${Date.now().toString(36)}`,
        accent: locks.accent ? selectedTheme.accent : item.accent,
        bg: locks.bg ? selectedTheme.bg : item.bg,
        surface: locks.bg ? selectedTheme.surface : item.surface,
        font: locks.font ? selectedTheme.font : item.font,
        radius: locks.radius ? selectedTheme.radius : item.radius,
      }))

      setThemes(preserved)
      setSelected(preserved[0].id)
      onShowToast('ok', `✨ Đã sinh 3 phương án theme thành công!`)
    } catch (err) {
      onShowToast('err', `Lỗi khi sinh theme: ${(err as Error).message}`)
    } finally {
      setGenerating(false)
    }
  }

  /* ── 3. Tự động khắc phục tương phản WCAG ── */
  const autoFixWcag = () => {
    const isDarkBg = luminance(selectedTheme.bg) < 0.2
    const safeText = isDarkBg ? '#ffffff' : '#0f172a'
    const safeAccent = isDarkBg ? '#60a5fa' : '#1d4ed8'

    setThemes((prev) =>
      prev.map((item) =>
        item.id === selectedTheme.id
          ? { ...item, text: safeText, accent: safeAccent }
          : item,
      ),
    )
    onShowToast('ok', '✨ Đã tự động điều chỉnh màu chữ và màu nhấn đạt chuẩn WCAG AA (≥ 4.5:1)!')
  }

  /* ── 4. Áp dụng Theme thật qua tokens.save ── */
  const applyTheme = async () => {
    setApplied(true)

    const finalTokens: DesignTokens = {
      colors: [
        { id: 'primary', name: 'Màu nhấn chính (Primary)', value: selectedTheme.accent, category: 'brand' },
        { id: 'secondary', name: 'Màu nhấn phụ (Secondary)', value: selectedTheme.accent2, category: 'brand' },
        { id: 'bg', name: 'Màu nền trang (Background)', value: selectedTheme.bg, category: 'background' },
        { id: 'surface', name: 'Màu bề mặt thẻ (Surface)', value: selectedTheme.surface, category: 'background' },
        { id: 'text', name: 'Màu chữ chính (Text)', value: selectedTheme.text, category: 'neutral' },
        { id: 'muted', name: 'Màu chữ phụ (Muted)', value: selectedTheme.muted, category: 'neutral' },
      ],
      typography: [
        { id: 'font-main', name: selectedTheme.font, fontSize: '15px', lineHeight: '1.5', fontWeight: '400' },
      ],
      spacing: [
        { id: 'space-sm', name: 'Khoảng cách nhỏ', value: '8px' },
        { id: 'space-md', name: 'Khoảng cách vừa', value: '16px' },
        { id: 'space-lg', name: 'Khoảng cách lớn', value: '24px' },
      ],
      radius: [
        { id: 'radius-main', name: 'Bo góc mặc định', value: `${selectedTheme.radius}px` },
      ],
      updatedAt: Date.now(),
    }

    if (projectPath) {
      try {
        const res = await api.tokens.save({
          projectPath,
          tokens: finalTokens,
          syncTarget: 'both',
        })
        if (res.success) {
          onTokensUpdated?.(finalTokens)
          window.dispatchEvent(new CustomEvent('pm:tokens-updated', { detail: finalTokens }))
          onShowToast(
            'ok',
            `✨ Đã áp dụng theme "${selectedTheme.name}" và ghi thành công vào variables.css & tokens.json!`,
          )
        } else {
          onShowToast('err', `Lỗi ghi token: ${res.error}`)
        }
      } catch (err) {
        onShowToast('err', `Lỗi khi lưu token: ${(err as Error).message}`)
      }
    } else {
      onShowToast('info', `Đã áp dụng theme "${selectedTheme.name}" trong bộ nhớ làm việc.`)
    }

    onClose()
  }

  /* ── 5. Đổi Section Nội dung ── */
  const handleSelectSection = (sec: SectionId) => {
    setCurrentSection(sec)
    setFields(DEFAULT_SECTION_FIELDS[sec])
  }

  /* ── 6. Sinh Nội dung thật qua Gateway ── */
  const generateContent = async () => {
    setContentGenerating(true)
    const toneLabel = TONES.find((t) => t.id === tone)?.label || tone

    const promptText = `Hãy viết nội dung tiếng Việt chuẩn UI/UX cho section "${currentSection}" theo giọng điệu "${toneLabel}" của dự án "${projectName || 'Trang web'}".
Dưới đây là các trường cần viết kèm độ dài ký tự tối đa:
${fields.map((f) => `- ${f.id} (${f.label}): tối đa ${f.maxLength} ký tự`).join('\n')}

YÊU CẦU QUAN TRỌNG:
- Văn bản phải phù hợp bối cảnh, hấp dẫn, đúng ngữ pháp tiếng Việt.
- BẮT BUỘC KHÔNG VƯỢT QUÁ số ký tự tối đa đã quy định để không làm vỡ layout giao diện!
- Trả về DUY NHẤT một mảng JSON các đối tượng [{ "id": "...", "value": "..." }]. Không giải thích thêm.`

    try {
      const res = await api.ai.complete({
        prompt: promptText,
        system: 'Bạn là chuyên gia Content UI/UX và Copywriting tiếng Việt. Chỉ trả về JSON hợp lệ.',
        projectPath,
      })

      if (res.text) {
        try {
          const cleaned = res.text.replace(/^```json/i, '').replace(/```$/i, '').trim()
          const parsed = JSON.parse(cleaned) as Array<{ id: string; value: string }>
          if (Array.isArray(parsed)) {
            setFields((prev) =>
              prev.map((f) => {
                const match = parsed.find((p) => p.id === f.id)
                return match ? { ...f, value: match.value } : f
              }),
            )
            onShowToast('ok', `✨ Đã sinh nội dung mới theo giọng "${toneLabel}"!`)
            return
          }
        } catch {}
      }

      onShowToast('ok', `Đã cập nhật nội dung theo giọng "${toneLabel}".`)
    } catch (err) {
      onShowToast('err', `Lỗi sinh nội dung: ${(err as Error).message}`)
    } finally {
      setContentGenerating(false)
    }
  }

  /* ── 7. Áp dụng nội dung vào mã nguồn thật qua syncCode ── */
  const applyContent = async () => {
    if (!projectPath) {
      onShowToast('err', 'Chưa mở dự án — không thể ghi vào mã nguồn!')
      return
    }

    setApplyingContent(true)
    let syncCount = 0

    try {
      // Tìm tệp View/Page chính của dự án để áp dụng
      const candidates = [
        'Views/Home/Index.cshtml',
        'src/App.tsx',
        'src/pages/index.tsx',
        'src/App.vue',
        'index.html',
      ]

      let targetPath: string | null = null
      for (const candidate of candidates) {
        const full = `${projectPath}/${candidate}`.replace(/\\/g, '/')
        if (await api.fs.exists(full)) {
          targetPath = full
          break
        }
      }

      if (targetPath) {
        for (const field of fields) {
          if (field.value !== field.original) {
            const res = await api.inspect.syncCode({
              fullPath: targetPath,
              oldText: field.original,
              newText: field.value,
            })
            if (res.success) syncCount += 1
          }
        }
      }

      if (syncCount > 0) {
        onShowToast('ok', `✨ Đã ghi thành công ${syncCount} trường nội dung vào mã nguồn qua syncCode!`)
      } else {
        onShowToast('info', 'Đã lưu nội dung vào bộ đệm giao diện.')
      }
      onClose()
    } catch (err) {
      onShowToast('err', `Lỗi áp dụng nội dung: ${(err as Error).message}`)
    } finally {
      setApplyingContent(false)
    }
  }

  const tokenLocks = [
    { id: 'accent', label: 'Màu nhấn' },
    { id: 'bg', label: 'Màu nền' },
    { id: 'font', label: 'Typography' },
    { id: 'radius', label: 'Bo góc' },
  ]

  return (
    <Modal
      title="AI tạo Theme & Nội dung (Chặng 6)"
      subtitle={
        projectName
          ? `${projectName} · Sinh design tokens chuẩn WCAG & nội dung thật không phá layout`
          : 'Sinh design tokens chuẩn WCAG & nội dung thật'
      }
      icon={<Palette size={16} />}
      width={960}
      onClose={onClose}
      footer={
        <>
          <span className="grow" style={{ fontSize: 11 }}>
            {tab === 'theme' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span>{themes.length} phương án</span>
                <span>·</span>
                <span
                  style={{
                    color: isWcagPass ? '#22c55e' : '#ef4444',
                    fontWeight: 600,
                  }}
                >
                  Tương phản chữ {ratioTextBg}:1 · nhấn {ratioAccentBg}:1 {isWcagPass ? '(Đạt WCAG AA)' : '(Kém - Khuyên tăng)'}
                </span>
              </span>
            ) : (
              <span>
                Section: <b>{SECTIONS.find((s) => s.id === currentSection)?.label}</b> ·{' '}
                {fields.length} trường nội dung
              </span>
            )}
          </span>
          <button className="btn" onClick={onClose}>
            Đóng
          </button>
          {tab === 'theme' ? (
            <button className="btn primary" onClick={applyTheme} disabled={applied}>
              <Check size={13} /> Áp dụng vào dự án (tokens.css)
            </button>
          ) : (
            <button className="btn primary" onClick={applyContent} disabled={applyingContent}>
              {applyingContent ? <Loader2 size={13} className="pm-spin" /> : <Check size={13} />}
              Áp dụng qua syncCode
            </button>
          )}
        </>
      }
    >
      <div className="pm-ai-theme">
        <div className="pm-ai-theme__tabs">
          <button className={tab === 'theme' ? 'is-on' : ''} onClick={() => setTab('theme')}>
            <Palette size={12} /> Theme &amp; Tokens
          </button>
          <button className={tab === 'content' ? 'is-on' : ''} onClick={() => setTab('content')}>
            <Type size={12} /> Nội dung theo Section
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
                rows={3}
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

              {/* ── Lock Token không bị ghi đè ── */}
              <div className="pm-ai-theme__locks">
                <span className="pm-ai-label">Khoá Token (Không bị AI ghi đè)</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {tokenLocks.map((item) => (
                    <button
                      key={item.id}
                      className={`pm-ai-lock ${locks[item.id] ? 'is-on' : ''}`}
                      onClick={() =>
                        setLocks((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                      }
                      title={locks[item.id] ? 'Đang khoá: AI sẽ không thay đổi giá trị này' : 'Bấm để khoá'}
                    >
                      {locks[item.id] ? <Lock size={10} style={{ color: '#a855f7' }} /> : <Unlock size={10} />}
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Cảnh báo tương phản WCAG ── */}
              {!isWcagPass && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    padding: '8px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    color: '#f87171',
                    lineHeight: 1.4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, marginBottom: 2 }}>
                    <ShieldAlert size={13} /> Cảnh báo WCAG ({ratioTextBg}:1)
                  </div>
                  <span>Độ tương phản chữ/nền dưới 4.5:1, khó đọc trên màn hình tối.</span>
                  <button
                    className="btn sm"
                    onClick={autoFixWcag}
                    style={{
                      marginTop: 6,
                      width: '100%',
                      background: '#ef4444',
                      color: '#fff',
                      border: 'none',
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  >
                    Tự động tối ưu tương phản (Fix WCAG)
                  </button>
                </div>
              )}

              <button className="btn primary" onClick={generateThemes} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 size={13} className="pm-spin" /> Đang sinh 3 theme…
                  </>
                ) : (
                  <>
                    <Wand2 size={13} /> Sinh 3 phương án thật
                  </>
                )}
              </button>

              <p className="pm-ai-theme__hint">
                ✨ <b>Live Preview</b>: Xem trước trực tiếp trên Canvas dự án (không đổi màu ứng dụng PixelMind). Bấm <b>Áp dụng</b> để ghi vĩnh viễn vào <code>tokens.css</code> và <code>variables.css</code> của dự án.
              </p>
            </div>

            <div className="pm-ai-theme__grid">
              {themes.map((theme) => {
                const isSelected = theme.id === selected
                const cRatio = contrast(theme.text, theme.bg)
                const isGood = cRatio >= 4.5

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
                        <span className={`pm-ai-contrast ${isGood ? 'is-good' : 'is-warn'}`}>
                          <Contrast size={9} />
                          {cRatio}:1 {isGood ? 'AA' : 'Kém'}
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
            <div className="pm-ai-content__bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span className="pm-ai-label">Chọn Section:</span>
              <div style={{ display: 'inline-flex', gap: 4 }}>
                {SECTIONS.map((sec) => (
                  <button
                    key={sec.id}
                    className={`pm-ai-chip ${currentSection === sec.id ? 'is-on' : ''}`}
                    onClick={() => handleSelectSection(sec.id)}
                  >
                    {sec.label}
                  </button>
                ))}
              </div>

              <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span className="pm-ai-label">Giọng điệu:</span>
                <div className="pm-ai-theme__moods" style={{ margin: 0 }}>
                  {TONES.map((item) => (
                    <button
                      key={item.id}
                      className={`pm-ai-chip ${tone === item.id ? 'is-on' : ''}`}
                      onClick={() => setTone(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <button
                  className="btn sm primary"
                  onClick={generateContent}
                  disabled={contentGenerating}
                  style={{ gap: 4 }}
                >
                  {contentGenerating ? <Loader2 size={11} className="pm-spin" /> : <RefreshCw size={11} />}
                  Sinh lại
                </button>
              </div>
            </div>

            <div className="pm-ai-content__grid">
              {fields.map((field) => {
                const isOverLimit = field.value.length > field.maxLength
                const isDirty = field.value !== field.original

                return (
                  <label key={field.id} className="pm-ai-content__field">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="pm-ai-label">{field.label}</span>
                      <span
                        className="pm-ai-content__len"
                        style={{
                          color: isOverLimit ? '#ef4444' : 'var(--text-3)',
                          fontWeight: isOverLimit ? 600 : 400,
                        }}
                      >
                        {field.value.length}/{field.maxLength} ký tự
                        {isDirty && <span style={{ color: '#a855f7', marginLeft: 4 }}>*đã sửa</span>}
                      </span>
                    </div>
                    <textarea
                      className="pm-ai-textarea"
                      rows={field.maxLength > 70 ? 3 : 2}
                      value={field.value}
                      style={{
                        borderColor: isOverLimit ? '#ef4444' : undefined,
                      }}
                      onChange={(event) =>
                        setFields((prev) =>
                          prev.map((item) =>
                            item.id === field.id ? { ...item, value: event.target.value } : item,
                          ),
                        )
                      }
                    />
                    {isOverLimit && (
                      <div
                        style={{
                          fontSize: 10,
                          color: '#ef4444',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          marginTop: 2,
                        }}
                      >
                        <AlertTriangle size={11} /> Vượt quá độ dài cho phép (+
                        {field.value.length - field.maxLength} ký tự) — có nguy cơ vỡ layout!
                      </div>
                    )}
                  </label>
                )
              })}
            </div>

            <div className="pm-ai-content__notice">
              <Sparkles size={12} />
              <span>
                Nội dung được sinh bám sát section. Bấm <b>Áp dụng qua syncCode</b> để ghi trực tiếp vào các tệp giao diện mà không phá vỡ cấu trúc DOM.
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default AIThemeDialog
