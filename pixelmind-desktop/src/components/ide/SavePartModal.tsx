import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  Code2,
  Eye,
  Grid,
  Image as ImageIcon,
  Loader2,
  Moon,
  PackagePlus,
  Plus,
  ShieldAlert,
  Sparkles,
  Sun,
  Tag,
  Upload,
  X,
} from 'lucide-react'
import Modal from '../Modal'
import { api } from '../../lib/bridge'
import type { CustomPartSource, CustomToolboxPart } from '@shared/toolbox'

interface SavePartModalProps {
  open: boolean
  initialHtml?: string
  initialCss?: string
  language?: 'html' | 'jsx'
  source?: CustomPartSource
  projectPath?: string
  title?: string
  subtitle?: string
  onClose: () => void
  onSaved: (part: CustomToolboxPart) => void
  onShowToast: (kind: 'ok' | 'err' | 'info', text: string) => void
}

const COMMON_TAGS = [
  'search',
  'form',
  'button',
  'navigation',
  'header',
  'hero',
  'card',
  'pricing',
  'table',
  'feedback',
  'footer',
  'layout',
  'marketing',
  'text',
]

const SUSPICIOUS_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /<script\b[^>]*>([\s\S]*?)<\/script>/i, reason: 'Chứa thẻ <script> thực thi mã JavaScript trực tiếp' },
  { pattern: /javascript:\s*[^\s"'>]/i, reason: 'Chứa giao thức javascript: trong thuộc tính URL' },
  {
    pattern: /\bon(?:error|load|click|mouseover|focus|blur)\s*=\s*["'][^"']*(?:eval|fetch|cookie|sessionStorage|localStorage|XMLHttpRequest)/i,
    reason: 'Chứa trình xử lý sự kiện nội dòng thực thi mã nguy hiểm',
  },
  { pattern: /\beval\s*\(/i, reason: 'Chứa hàm eval() thực thi chuỗi lệnh' },
  { pattern: /\bdocument\.(?:cookie|location\s*=)\b/i, reason: 'Truy cập tài nguyên nhạy cảm document.cookie hoặc điều hướng trang' },
  { pattern: /<iframe\b[^>]*src\s*=\s*["']javascript:/i, reason: 'Chứa thẻ <iframe> nhúng mã javascript:' },
  { pattern: /<(?:object|embed|applet)\b/i, reason: 'Chứa đối tượng nhúng nhị phân (object/embed/applet)' },
]

function clientInspectCode(code: string): { suspicious: boolean; reasons: string[] } {
  const reasons: string[] = []
  for (const { pattern, reason } of SUSPICIOUS_PATTERNS) {
    if (pattern.test(code)) {
      reasons.push(reason)
    }
  }
  return { suspicious: reasons.length > 0, reasons }
}

function cleanHtmlCode(raw: string): string {
  if (!raw) return ''
  return raw
    .replace(/\sdata-pm-(?:uid|multi)(?:="[^"]*")?/g, '')
    .trim()
}

function suggestPartName(code: string): string {
  const lower = code.toLowerCase()
  if (/<nav\b/i.test(lower) || /class="[^"]*navbar/i.test(lower)) return 'Thanh điều hướng (Navbar)'
  if (/search|tìm kiếm/i.test(lower) || /type=["']search["']/i.test(lower)) return 'Thanh tìm kiếm'
  if (/<header\b/i.test(lower)) return 'Đầu trang (Header)'
  if (/<footer\b/i.test(lower)) return 'Chân trang (Footer)'
  if (/class="[^"]*hero/i.test(lower)) return 'Vùng Hero nổi bật'
  if (/class="[^"]*pricing/i.test(lower) || /class="[^"]*price/i.test(lower)) return 'Bảng giá (Pricing)'
  if (/<table\b/i.test(lower)) return 'Bảng dữ liệu (Table)'
  if (/<form\b/i.test(lower)) return 'Biểu mẫu (Form)'
  if (/<button\b/i.test(lower) || /class="[^"]*btn/i.test(lower)) return 'Nút bấm (Button)'
  if (/<input\b|<select\b|<textarea\b/i.test(lower)) return 'Khung nhập liệu'
  if (/class="[^"]*card/i.test(lower)) return 'Thẻ nội dung (Card)'
  if (/class="[^"]*modal|dialog/i.test(lower)) return 'Hộp thoại (Modal)'
  if (/class="[^"]*alert|toast|notification/i.test(lower)) return 'Hộp thông báo (Toast)'
  if (/class="[^"]*badge/i.test(lower)) return 'Huy hiệu (Badge)'
  return 'Linh kiện tuỳ chỉnh'
}

function detectSuggestedTags(code: string): string[] {
  const lower = code.toLowerCase()
  const tags = new Set<string>()
  if (/search|tìm kiếm/i.test(lower) || /type=["']search["']/i.test(lower)) tags.add('search')
  if (/<form\b|<input\b|<select\b|<textarea\b/i.test(lower)) tags.add('form')
  if (/<button\b|class="[^"]*btn/i.test(lower)) tags.add('button')
  if (/<nav\b|navbar|menu/i.test(lower)) tags.add('navigation')
  if (/<header\b/i.test(lower)) tags.add('header')
  if (/hero/i.test(lower)) tags.add('hero')
  if (/card/i.test(lower)) tags.add('card')
  if (/pricing|bảng giá|price/i.test(lower)) tags.add('pricing')
  if (/<table\b/i.test(lower)) tags.add('table')
  if (/<footer\b/i.test(lower)) tags.add('footer')
  if (/feedback|alert|toast/i.test(lower)) tags.add('feedback')
  return Array.from(tags)
}

export const SavePartModal = ({
  open,
  initialHtml = '',
  initialCss = '',
  language = 'html',
  source,
  projectPath,
  title,
  subtitle,
  onClose,
  onSaved,
  onShowToast,
}: SavePartModalProps) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [html, setHtml] = useState('')
  const [css, setCss] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [newTagInput, setNewTagInput] = useState('')
  const [previewImage, setPreviewImage] = useState<string>('')
  const [tab, setTab] = useState<'preview' | 'code' | 'image'>('preview')
  const [bgMode, setBgMode] = useState<'dark' | 'light' | 'grid'>('dark')
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Đồng bộ props vào state mỗi khi mở modal
  useEffect(() => {
    if (open) {
      const cleaned = cleanHtmlCode(initialHtml || '')
      setHtml(cleaned)
      setCss(initialCss || '')
      setName(cleaned ? suggestPartName(cleaned) : '')
      setDescription(cleaned ? 'Linh kiện lưu từ giao diện' : '')
      setSelectedTags(cleaned ? detectSuggestedTags(cleaned) : ['custom'])
      setNewTagInput('')
      setPreviewImage('')
      setTab(cleaned ? 'preview' : 'code')
      setSaving(false)
    }
  }, [open, initialHtml, initialCss])

  const inspection = useMemo(() => clientInspectCode(html), [html])

  if (!open) return null

  const toggleTag = (t: string) => {
    setSelectedTags((prev) =>
      prev.includes(t) ? prev.filter((item) => item !== t) : [...prev, t],
    )
  }

  const handleAddCustomTag = () => {
    const trimmed = newTagInput.trim().toLowerCase()
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags((prev) => [...prev, trimmed])
      setNewTagInput('')
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      onShowToast('err', 'Vui lòng chọn tệp hình ảnh (PNG, JPG, SVG, WebP).')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPreviewImage(reader.result)
        onShowToast('ok', 'Đã tải ảnh xem trước thành công!')
      }
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      onShowToast('err', 'Vui lòng nhập tên cho linh kiện (Part).')
      return
    }
    const trimmedHtml = html.trim()
    if (!trimmedHtml) {
      onShowToast('err', 'Mã HTML/JSX không được để trống.')
      return
    }

    if (inspection.suspicious) {
      onShowToast('err', `Mã chứa phần đáng nghi: ${inspection.reasons.join('; ')}`)
      return
    }

    setSaving(true)
    try {
      const tagsToSave = selectedTags.length > 0 ? selectedTags : ['custom']
      const res = await api.toolbox.savePart({
        name: trimmedName,
        description: description.trim(),
        html: trimmedHtml,
        css: css.trim() || undefined,
        preview: previewImage.trim() || undefined,
        tags: tagsToSave,
        language,
        source,
        projectPath,
      })

      if (res.success && res.part) {
        onShowToast('ok', `✨ Đã lưu Part “${res.part.name}” vào Thư viện thành công!`)
        onSaved(res.part)
        onClose()
      } else {
        onShowToast('err', res.error || 'Lưu Part thất bại.')
      }
    } catch (err: any) {
      onShowToast('err', `Lỗi: ${err?.message || 'Không thể lưu Part'}`)
    } finally {
      setSaving(false)
    }
  }

  // Cấu hình nền xem trước
  const bgStyles = {
    dark: { bg: '#18181b', color: '#f4f4f5' },
    light: { bg: '#ffffff', color: '#09090b' },
    grid: {
      bg: '#0f172a radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)',
      color: '#f8fafc',
    },
  }
  const currentBg = bgStyles[bgMode]

  // Khung render preview an toàn
  const previewSrcDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: ${currentBg.bg};
      background-size: 16px 16px;
      color: ${currentBg.color};
      padding: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.5;
    }
    button, input, select, textarea {
      font-family: inherit;
      font-size: inherit;
    }
    ${css}
  </style>
</head>
<body>
  ${html}
</body>
</html>`

  return (
    <Modal
      title={title || 'Lưu vùng chọn thành Part (Linh kiện mẫu)'}
      subtitle={subtitle || 'Lưu đoạn mã giao diện để tái sử dụng nhanh chóng từ Hộp công cụ (Toolbox).'}
      icon={<PackagePlus className="pm-modal__icon" size={20} />}
      width={700}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
          <button className="btn secondary" onClick={onClose} disabled={saving}>
            Huỷ
          </button>
          <button
            className="btn primary"
            onClick={handleSave}
            disabled={saving || !name.trim() || !html.trim() || inspection.suspicious}
          >
            {saving ? <Loader2 size={13} className="pm-spin" /> : <Sparkles size={13} />}
            <span>Lưu vào Thư viện Part</span>
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Tên & Mô tả */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--pm-fg)' }}>
            Tên linh kiện <span style={{ color: 'var(--pm-err)' }}>*</span>
          </label>
          <input
            type="text"
            className="pm-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Thanh tìm kiếm sản phẩm, Khung đăng nhập, Navbar..."
            autoFocus
            maxLength={80}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--pm-fg)' }}>
            Mô tả ngắn
          </label>
          <input
            type="text"
            className="pm-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả công dụng hoặc phong cách thiết kế của linh kiện..."
            maxLength={300}
          />
        </div>

        {/* Phân loại & Tags */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--pm-fg)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Tag size={13} /> Nhóm & Thẻ tìm kiếm (Tags)
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {COMMON_TAGS.map((t) => {
              const active = selectedTags.includes(t)
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: 11,
                    cursor: 'pointer',
                    border: active ? '1px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: active ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    color: active ? '#a5b4fc' : '#94a3b8',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {t}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <input
              type="text"
              className="pm-input"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddCustomTag()
                }
              }}
              placeholder="Thêm tag tuỳ chỉnh khác (nhấn Enter)..."
              style={{ flex: 1, fontSize: 12, padding: '4px 10px', height: 28 }}
            />
            <button
              type="button"
              className="btn secondary"
              onClick={handleAddCustomTag}
              style={{ height: 28, padding: '0 10px', fontSize: 11 }}
            >
              <Plus size={11} /> Thêm tag
            </button>
          </div>
          {selectedTags.some((t) => !COMMON_TAGS.includes(t)) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {selectedTags
                .filter((t) => !COMMON_TAGS.includes(t))
                .map((t) => (
                  <span
                    key={t}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: '#34d399',
                      fontSize: 11,
                    }}
                  >
                    {t}
                    <X
                      size={11}
                      style={{ cursor: 'pointer' }}
                      onClick={() => toggleTag(t)}
                    />
                  </span>
                ))}
            </div>
          )}
        </div>

        {/* Cảnh báo mã độc nếu có */}
        {inspection.suspicious ? (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 6,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--pm-err)', fontWeight: 600, fontSize: 12 }}>
              <ShieldAlert size={14} />
              <span>Phát hiện mã nguồn không an toàn!</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 11, color: 'var(--pm-fg-subtle)' }}>
              {inspection.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: '#4ade80',
            }}
          >
            <CheckCircle2 size={13} />
            <span>Mã nguồn đã qua kiểm tra an toàn, sẵn sàng kéo thả trong Toolbox.</span>
          </div>
        )}

        {/* Tab chuyển đổi Xem trước & Code & Ảnh đại diện */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--pm-border)', gap: 4 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              className={`pm-tab-btn ${tab === 'preview' ? 'active' : ''}`}
              onClick={() => setTab('preview')}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                background: 'none',
                border: 'none',
                borderBottom: tab === 'preview' ? '2px solid var(--pm-accent)' : '2px solid transparent',
                color: tab === 'preview' ? 'var(--pm-accent)' : 'var(--pm-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Eye size={13} />
              <span>Xem trước trực tiếp</span>
            </button>
            <button
              type="button"
              className={`pm-tab-btn ${tab === 'code' ? 'active' : ''}`}
              onClick={() => setTab('code')}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                background: 'none',
                border: 'none',
                borderBottom: tab === 'code' ? '2px solid var(--pm-accent)' : '2px solid transparent',
                color: tab === 'code' ? 'var(--pm-accent)' : 'var(--pm-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Code2 size={13} />
              <span>Xem / Nhập mã ({language.toUpperCase()})</span>
            </button>
            <button
              type="button"
              className={`pm-tab-btn ${tab === 'image' ? 'active' : ''}`}
              onClick={() => setTab('image')}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                background: 'none',
                border: 'none',
                borderBottom: tab === 'image' ? '2px solid var(--pm-accent)' : '2px solid transparent',
                color: tab === 'image' ? 'var(--pm-accent)' : 'var(--pm-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ImageIcon size={13} />
              <span>Ảnh xem trước {previewImage ? '✓' : ''}</span>
            </button>
          </div>

          {tab === 'preview' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--pm-muted)', marginRight: 2 }}>Nền:</span>
              <button
                type="button"
                className={`btn sm ${bgMode === 'dark' ? 'primary' : 'secondary'}`}
                title="Nền tối"
                onClick={() => setBgMode('dark')}
                style={{ padding: '2px 8px', height: 24 }}
              >
                <Moon size={11} />
              </button>
              <button
                type="button"
                className={`btn sm ${bgMode === 'light' ? 'primary' : 'secondary'}`}
                title="Nền sáng"
                onClick={() => setBgMode('light')}
                style={{ padding: '2px 8px', height: 24 }}
              >
                <Sun size={11} />
              </button>
              <button
                type="button"
                className={`btn sm ${bgMode === 'grid' ? 'primary' : 'secondary'}`}
                title="Nền lưới"
                onClick={() => setBgMode('grid')}
                style={{ padding: '2px 8px', height: 24 }}
              >
                <Grid size={11} />
              </button>
            </div>
          )}
        </div>

        {tab === 'preview' && (
          <div
            style={{
              height: 220,
              borderRadius: 6,
              overflow: 'hidden',
              border: '1px solid var(--pm-border)',
              background: currentBg.bg,
            }}
          >
            <iframe
              title="Part Preview"
              srcDoc={previewSrcDoc}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          </div>
        )}

        {tab === 'code' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--pm-muted)' }}>Mã HTML / JSX <span style={{ color: 'var(--pm-err)' }}>*</span></label>
              <textarea
                className="pm-input"
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                rows={6}
                style={{
                  fontFamily: 'monospace',
                  fontSize: 12,
                  lineHeight: 1.4,
                  whiteSpace: 'pre',
                  resize: 'vertical',
                }}
                placeholder="<div class=&quot;my-component&quot;>...</div>"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--pm-muted)' }}>Mã CSS bổ sung (nếu có)</label>
              <textarea
                className="pm-input"
                value={css}
                onChange={(e) => setCss(e.target.value)}
                rows={3}
                style={{
                  fontFamily: 'monospace',
                  fontSize: 12,
                  lineHeight: 1.4,
                  whiteSpace: 'pre',
                  resize: 'vertical',
                }}
                placeholder=".my-component { color: #fff; padding: 12px; }"
              />
            </div>
          </div>
        )}

        {tab === 'image' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--pm-fg-subtle)' }}>
              Mặc định hệ thống sẽ tự động tạo ảnh xem trước từ mã HTML/CSS. Nếu bạn có sẵn ảnh chụp thật, hãy tải lên tại đây:
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                className="btn secondary"
                onClick={() => fileInputRef.current?.click()}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Upload size={13} />
                <span>Chọn tệp ảnh từ máy tính...</span>
              </button>
              {previewImage && (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setPreviewImage('')}
                  style={{ color: 'var(--pm-err)' }}
                >
                  Gỡ ảnh tự tải
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--pm-muted)' }}>Hoặc dán URL / Data-URI của ảnh:</label>
              <input
                type="text"
                className="pm-input"
                value={previewImage}
                onChange={(e) => setPreviewImage(e.target.value)}
                placeholder="https://... hoặc data:image/png;base64,..."
                style={{ fontSize: 12 }}
              />
            </div>
            {previewImage && (
              <div
                style={{
                  width: '100%',
                  height: 140,
                  borderRadius: 6,
                  border: '1px solid var(--pm-border)',
                  background: '#09090b',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={previewImage}
                  alt="Ảnh xem trước"
                  style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default SavePartModal
