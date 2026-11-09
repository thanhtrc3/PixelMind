import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Check,
  ChevronRight,
  CornerDownLeft,
  Layers,
  Loader2,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react'

type ToastKind = 'ok' | 'err' | 'info'

interface AISidecarProps {
  x: number
  y: number
  label: string
  detail?: string
  onClose: () => void
  onOpenPanel: () => void
  onShowToast: (kind: ToastKind, text: string) => void
}

const QUICK_PROMPTS = [
  'Nổi bật hơn',
  'Bo tròn hơn',
  'Theo màu theme',
  'Thêm icon',
  'Ẩn trên mobile',
]

/**
 * Ô nhập AI nổi ngay cạnh phần tử đang chọn (mô phỏng).
 * Đặt trong lớp overlay của stage, không nằm trong iframe.
 */
const AISidecar = ({
  x,
  y,
  label,
  detail,
  onClose,
  onOpenPanel,
  onShowToast,
}: AISidecarProps) => {
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [suggestion, setSuggestion] = useState(false)
  const [scoped, setScoped] = useState(true)
  const timer = useRef<number | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [])

  useEffect(() => {
    if (expanded) window.setTimeout(() => inputRef.current?.focus(), 30)
  }, [expanded])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const submit = () => {
    if (busy) return
    setBusy(true)
    setSuggestion(false)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setBusy(false)
      setSuggestion(true)
    }, 1300)
  }

  if (!expanded) {
    return (
      <div
        className="pm-ai-sidecar is-collapsed"
        style={{ left: x, top: y }}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="pm-ai-sidecar__trigger" onClick={() => setExpanded(true)}>
          <Sparkles size={12} />
          <span>Nhờ AI sửa…</span>
        </button>
        <button
          className="pm-ai-sidecar__dismiss"
          onClick={onClose}
          title="Ẩn gợi ý AI cho phần tử này"
        >
          <X size={10} />
        </button>
      </div>
    )
  }

  return (
    <div
      className="pm-ai-sidecar"
      style={{ left: x, top: y }}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="pm-ai-sidecar__hd">
        <span className="pm-ai-sidecar__logo">
          <Wand2 size={12} />
        </span>
        <div className="pm-ai-sidecar__title">
          <b>Sửa tại chỗ</b>
          <span title={label}>{label}</span>
        </div>
        <button className="pm-ibtn" onClick={onClose} title="Đóng (Esc)">
          <X size={12} />
        </button>
      </div>

      {detail && <div className="pm-ai-sidecar__target">{detail}</div>}

      {!suggestion && !busy && (
        <>
          <textarea
            ref={inputRef}
            className="pm-ai-sidecar__input"
            rows={2}
            placeholder="Mô tả điều bạn muốn thay đổi…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                submit()
              }
            }}
          />
          <div className="pm-ai-sidecar__chips">
            {QUICK_PROMPTS.map((prompt) => (
              <button key={prompt} className="pm-ai-chip" onClick={() => setDraft(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
          <div className="pm-ai-sidecar__ft">
            <label className="pm-ai-scope">
              <input
                type="checkbox"
                checked={scoped}
                onChange={(event) => setScoped(event.target.checked)}
              />
              <span>Chỉ sửa phần tử này</span>
            </label>
            <button className="btn sm primary" onClick={submit} title="Gửi yêu cầu (Enter)">
              <CornerDownLeft size={11} /> Gửi
            </button>
          </div>
        </>
      )}

      {busy && (
        <div className="pm-ai-sidecar__busy">
          <div className="pm-ai-sidecar__busy-hd">
            <Loader2 size={13} className="pm-spin" />
            <span>Đang đóng gói HTML, CSS và vị trí nguồn…</span>
          </div>
          <div className="pm-ai-skeleton" />
          <div className="pm-ai-skeleton is-short" />
          <div className="pm-ai-skeleton is-mid" />
        </div>
      )}

      {suggestion && (
        <div className="pm-ai-sidecar__result">
          <div className="pm-ai-sidecar__result-hd">
            <Check size={12} />
            <b>Đề xuất (mô phỏng)</b>
          </div>
          <p>
            Đổi màu nền sang token nhấn, bo góc 10px và thêm icon mũi tên. Giữ nguyên kích thước,
            khoảng cách và khả năng truy cập.
          </p>
          <div className="pm-ai-sidecar__diff">
            <div>
              <code>background</code>
              <span className="is-del">#2563eb</span>
              <ArrowRight size={9} />
              <span className="is-add">var(--accent)</span>
            </div>
            <div>
              <code>border-radius</code>
              <span className="is-del">6px</span>
              <ArrowRight size={9} />
              <span className="is-add">10px</span>
            </div>
          </div>
          <div className="pm-ai-sidecar__ft">
            <button className="pm-ai-sidecar__more" onClick={onOpenPanel}>
              <Layers size={11} /> Mở panel
              <ChevronRight size={10} />
            </button>
            <button
              className="btn sm primary"
              onClick={() => {
                onShowToast(
                  'ok',
                  `Đã áp dụng thử cho ${label} (mô phỏng, chưa ghi tệp).${
                    scoped ? '' : ' Phạm vi: toàn trang.'
                  }`,
                )
                onClose()
              }}
            >
              <Check size={11} /> Áp dụng
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AISidecar
