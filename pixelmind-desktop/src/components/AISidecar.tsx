import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  CornerDownLeft,
  Eye,
  Layers,
  Loader2,
  RotateCcw,
  Save,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react'
import { api } from '../lib/bridge'
import type { RealElementInfo } from './CanvasArea'
import type { AiContextPack, AiSelection } from '@shared/ai'

type ToastKind = 'ok' | 'err' | 'info'

export interface SidecarDiffItem {
  property: string
  old?: string
  new?: string
}

export interface SidecarSuggestion {
  summary: string
  styles: Record<string, string>
  textContent?: string
  diff: SidecarDiffItem[]
  previewed?: boolean
  saved?: boolean
  source?: 'gateway' | 'local'
}

interface AISidecarProps {
  x: number
  y: number
  label: string
  detail?: string
  projectId?: string
  projectPath?: string
  projectName?: string
  currentRoute?: string | null
  selectedEl?: RealElementInfo | null
  sourceLoc?: {
    filePath: string
    fullPath: string
    lineNumber: number
    lineContent?: string
  } | null
  initialExpanded?: boolean
  onClose: () => void
  onOpenPanel: () => void
  onShowToast: (kind: ToastKind, text: string) => void
  onPreview?: (change: { styles?: Record<string, string>; textContent?: string }) => void
  onUndo?: () => void
  onSyncCode?: (change: { styles?: Record<string, string>; textContent?: string }) => Promise<boolean>
}

const QUICK_PROMPTS = [
  'Nổi bật hơn',
  'Bo tròn 12px',
  'Màu xanh nhấn',
  'Đổi chữ thành Mua ngay',
  'Theo màu theme',
]

/**
 * Phân tích JSON đề xuất từ văn bản phản hồi của LLM
 */
function extractSuggestionFromText(text: string): {
  summary?: string
  styles?: Record<string, string>
  textContent?: string
  diff?: SidecarDiffItem[]
} | null {
  try {
    // 1. Tìm khối ```json ... ```
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (match) {
      const parsed = JSON.parse(match[1])
      if (parsed && typeof parsed === 'object') return parsed
    }

    // 2. Thử parse trực tiếp nếu là chuỗi JSON
    const firstBrace = text.indexOf('{')
    const lastBrace = text.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = text.slice(firstBrace, lastBrace + 1)
      const parsed = JSON.parse(candidate)
      if (parsed && typeof parsed === 'object') return parsed
    }
  } catch {}
  return null
}

/**
 * Trình phân tích đề xuất nhanh (Heuristic fallback) khi chưa cấu hình API Key
 */
function generateLocalHeuristicSuggestion(
  prompt: string,
  selectedEl?: RealElementInfo | null,
): SidecarSuggestion {
  const p = prompt.toLowerCase()
  const styles: Record<string, string> = {}
  let textContent: string | undefined
  const diff: SidecarDiffItem[] = []

  // Đổi chữ / nội dung
  const textMatch = prompt.match(/(?:đổi|thay|sửa)\s+(?:chữ|tiêu đề|text|nội dung)\s+(?:thành|là)?\s*[:"']?([^"'\n]+)["']?/i)
  if (textMatch) {
    textContent = textMatch[1].trim()
    diff.push({
      property: 'text',
      old: selectedEl?.textSnippet || 'text cũ',
      new: textContent,
    })
  }

  // Bo góc / bo tròn
  if (p.includes('bo tròn') || p.includes('bo góc')) {
    const numMatch = prompt.match(/(\d+)\s*px/)
    const rVal = numMatch ? `${numMatch[1]}px` : p.includes('tròn hẳn') ? '9999px' : '12px'
    styles.borderRadius = rVal
    diff.push({
      property: 'border-radius',
      old: selectedEl?.computedStyles?.borderRadius || '0px',
      new: rVal,
    })
  }

  // Màu sắc nền & chữ
  if (p.includes('đỏ') || p.includes('red')) {
    styles.backgroundColor = '#ef4444'
    styles.color = '#ffffff'
    diff.push({
      property: 'background-color',
      old: selectedEl?.computedStyles?.backgroundColor || 'none',
      new: '#ef4444',
    })
    diff.push({ property: 'color', old: selectedEl?.computedStyles?.color || 'inherit', new: '#ffffff' })
  } else if (p.includes('xanh lá') || p.includes('green')) {
    styles.backgroundColor = '#10b981'
    styles.color = '#ffffff'
    diff.push({
      property: 'background-color',
      old: selectedEl?.computedStyles?.backgroundColor || 'none',
      new: '#10b981',
    })
    diff.push({ property: 'color', old: selectedEl?.computedStyles?.color || 'inherit', new: '#ffffff' })
  } else if (p.includes('xanh') || p.includes('blue')) {
    styles.backgroundColor = '#2563eb'
    styles.color = '#ffffff'
    diff.push({
      property: 'background-color',
      old: selectedEl?.computedStyles?.backgroundColor || 'none',
      new: '#2563eb',
    })
    diff.push({ property: 'color', old: selectedEl?.computedStyles?.color || 'inherit', new: '#ffffff' })
  } else if (p.includes('nổi bật') || p.includes('theme') || p.includes('tím')) {
    styles.backgroundColor = 'var(--accent, #6d5df5)'
    styles.color = '#ffffff'
    diff.push({
      property: 'background-color',
      old: selectedEl?.computedStyles?.backgroundColor || 'none',
      new: 'var(--accent, #6d5df5)',
    })
    diff.push({ property: 'color', old: selectedEl?.computedStyles?.color || 'inherit', new: '#ffffff' })
  }

  // Padding / khoảng cách
  if (p.includes('rộng hơn') || p.includes('padding')) {
    styles.padding = '10px 20px'
    diff.push({
      property: 'padding',
      old: selectedEl?.computedStyles?.padding || 'initial',
      new: '10px 20px',
    })
  }

  // Nếu không khớp pattern nào, mặc định đổi màu nhấn và bo góc nhẹ
  if (Object.keys(styles).length === 0 && !textContent) {
    styles.backgroundColor = 'var(--accent, #6d5df5)'
    styles.color = '#ffffff'
    styles.borderRadius = '8px'
    diff.push({
      property: 'background-color',
      old: selectedEl?.computedStyles?.backgroundColor || 'none',
      new: 'var(--accent, #6d5df5)',
    })
    diff.push({
      property: 'border-radius',
      old: selectedEl?.computedStyles?.borderRadius || '0px',
      new: '8px',
    })
  }

  return {
    summary: `Đề xuất thay đổi style cho <${(selectedEl?.tagName || 'el').toLowerCase()}> theo yêu cầu "${prompt}"`,
    styles,
    textContent,
    diff,
    previewed: false,
    saved: false,
    source: 'local',
  }
}

/**
 * Ô nhập AI nổi (AISidecar) kết nối Gateway thật và Context Packer chế độ element
 */
const AISidecar = ({
  x,
  y,
  label,
  detail,
  projectId,
  projectPath,
  projectName,
  currentRoute,
  selectedEl,
  sourceLoc,
  initialExpanded = true,
  onClose,
  onOpenPanel,
  onShowToast,
  onPreview,
  onUndo,
  onSyncCode,
}: AISidecarProps) => {
  const [expanded, setExpanded] = useState(initialExpanded)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyStage, setBusyStage] = useState<'packing' | 'calling'>('packing')
  const [suggestion, setSuggestion] = useState<SidecarSuggestion | null>(null)
  const [scoped, setScoped] = useState(true)
  const [scopeViolation, setScopeViolation] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const activeChatId = useRef<string | null>(null)

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

  // Lắng nghe sự kiện SSE stream từ AI Gateway
  useEffect(() => {
    const off = api.ai.onChatEvent((event) => {
      if (!activeChatId.current || event.id !== activeChatId.current) return

      if (event.type === 'tool') {
        if (event.status === 'error' && event.detail && event.detail.includes('ngoài phạm vi')) {
          setScopeViolation(event.detail)
          onShowToast('err', event.detail)
        }
      } else if (event.type === 'error') {
        setBusy(false)
        activeChatId.current = null
        onShowToast('err', `Lỗi AI Gateway: ${event.message}`)
      }
    })
    return off
  }, [onShowToast])

  /**
   * Gửi yêu cầu qua AI Gateway kèm Context Packer
   */
  const submit = useCallback(
    async (customPrompt?: string) => {
      const promptText = (customPrompt || draft).trim()
      if (!promptText || busy) return

      setBusy(true)
      setBusyStage('packing')
      setSuggestion(null)
      setScopeViolation(null)

      // 1. ĐÓNG GÓI NGỮ CẢNH PHẦN TỬ (Context Packer chế độ element)
      let contextPack: AiContextPack | undefined
      try {
        if (selectedEl && projectPath) {
          const elementSelection: AiSelection = {
            tag: selectedEl.tagName,
            id: selectedEl.id || undefined,
            className: selectedEl.className || undefined,
            text: selectedEl.textSnippet || undefined,
            outerHTML: selectedEl.outerHTML,
            computedStyles: selectedEl.computedStyles as unknown as Record<string, string>,
            selector: selectedEl.selector,
            filePath: sourceLoc?.fullPath || sourceLoc?.filePath,
            lineNumber: sourceLoc?.lineNumber,
          }

          const ctxResult = await api.ai.context({
            projectPath,
            projectId,
            projectName,
            route: currentRoute ?? undefined,
            selection: elementSelection,
            include: ['selection', 'source', 'tokens'],
            tokenBudget: 3500,
          })
          contextPack = ctxResult?.pack
        }
      } catch (err) {
        console.warn('[AISidecar] Lỗi đóng gói ngữ cảnh:', err)
      }

      // 2. KIỂM TRA TRẠNG THÁI AI GATEWAY
      setBusyStage('calling')
      let isConfigured = false
      try {
        const status = await api.ai.status(projectPath)
        isConfigured = !!(status?.configured && status?.key?.present)
      } catch {
        isConfigured = false
      }

      // Nếu AI Gateway chưa có API Key, dùng heuristic fallback cục bộ ngay
      if (!isConfigured) {
        window.setTimeout(() => {
          const localSug = generateLocalHeuristicSuggestion(promptText, selectedEl)
          setSuggestion(localSug)
          setBusy(false)
          onShowToast('info', 'Chưa có API Key — áp dụng bộ gợi ý thông minh cục bộ.')
        }, 600)
        return
      }

      // 3. GỌI AI GATEWAY THẬT VỚI LỆNH ĐƯỢC GIỚI HẠN
      const scopedRule =
        scoped && sourceLoc
          ? `LƯU Ý GIỚI HẠN PHẠM VI: Chế độ "Chỉ sửa phần tử này" đang BẬT!
- Mục tiêu là: <${selectedEl?.tagName.toLowerCase()}${selectedEl?.id ? ` id="${selectedEl.id}"` : ''}${selectedEl?.className ? ` class="${selectedEl.className}"` : ''}>
- Tệp nguồn cho phép sửa DUY NHẤT: "${sourceLoc.filePath}" tại dòng ${sourceLoc.lineNumber}.
- TUYỆT ĐỐI KHÔNG sửa các phần tử khác, KHÔNG sửa các tệp khác.`
          : 'Đề xuất thay đổi style hoặc text cho phần tử đang chọn.'

      const promptPayload = `${scopedRule}

Yêu cầu người dùng: "${promptText}"

Hãy trả về phản hồi dưới dạng một khối JSON chính xác theo cấu trúc sau:
\`\`\`json
{
  "summary": "Tóm tắt ngắn gọn thay đổi bằng tiếng Việt",
  "styles": {
    /* Các thuộc tính CSS camelCase muốn thay đổi, ví dụ: "backgroundColor": "#ef4444", "borderRadius": "12px" */
  },
  "textContent": "Nội dung chữ mới nếu người dùng yêu cầu đổi chữ (bỏ trống nếu không)",
  "diff": [
    { "property": "background-color", "old": "giá trị cũ", "new": "giá trị mới" }
  ]
}
\`\`\``

      try {
        let streamAccumulator = ''
        const chatHandle = await api.ai.chat({
          projectId,
          projectPath,
          tools: true,
          context: contextPack,
          messages: [{ role: 'user', content: promptPayload }],
          scopedFile: scoped && sourceLoc ? sourceLoc.filePath : undefined,
        })
        activeChatId.current = chatHandle.id

        // Đăng ký nghe stream kết thúc cho phiên chat này
        const removeListener = api.ai.onChatEvent((ev) => {
          if (ev.id !== chatHandle.id) return
          if (ev.type === 'delta') {
            streamAccumulator += ev.text
          } else if (ev.type === 'done') {
            setBusy(false)
            activeChatId.current = null
            removeListener()

            const parsed = extractSuggestionFromText(streamAccumulator)
            if (parsed && (parsed.styles || parsed.textContent)) {
              // Tự động bổ sung diff nếu AI không trả đủ
              const finalDiff: SidecarDiffItem[] = parsed.diff || []
              if (finalDiff.length === 0 && parsed.styles) {
                for (const [k, v] of Object.entries(parsed.styles)) {
                  finalDiff.push({
                    property: k.replace(/([A-Z])/g, '-$1').toLowerCase(),
                    old: selectedEl?.computedStyles?.[k] || 'initial',
                    new: v,
                  })
                }
              }
              if (parsed.textContent && parsed.textContent !== selectedEl?.textSnippet) {
                finalDiff.push({
                  property: 'text',
                  old: selectedEl?.textSnippet || '',
                  new: parsed.textContent,
                })
              }

              setSuggestion({
                summary: parsed.summary || `Đề xuất thay đổi cho <${selectedEl?.tagName.toLowerCase()}>`,
                styles: parsed.styles || {},
                textContent: parsed.textContent,
                diff: finalDiff,
                previewed: false,
                saved: false,
                source: 'gateway',
              })
              onShowToast('ok', 'Đã nhận đề xuất từ AI Gateway!')
            } else {
              // Fallback nếu câu trả lời không có format JSON
              const localFallback = generateLocalHeuristicSuggestion(promptText, selectedEl)
              setSuggestion(localFallback)
            }
          }
        })
      } catch (err) {
        setBusy(false)
        activeChatId.current = null
        const msg = (err as Error).message
        onShowToast('info', `AI Gateway thông báo: ${msg}. Đang dùng gợi ý cục bộ.`)
        const localFallback = generateLocalHeuristicSuggestion(promptText, selectedEl)
        setSuggestion(localFallback)
      }
    },
    [draft, busy, selectedEl, projectPath, projectId, projectName, currentRoute, sourceLoc, scoped, onShowToast],
  )

  /**
   * Áp dụng xem trước (Live Preview) lên Canvas qua inspect.applyStyle
   */
  const handlePreview = () => {
    if (!suggestion) return
    onPreview?.({
      styles: suggestion.styles,
      textContent: suggestion.textContent,
    })
    setSuggestion((s) => (s ? { ...s, previewed: true } : null))
    onShowToast('ok', `Đang xem trước trên Canvas: ${label}`)
  }

  /**
   * Hoàn tác 1-click (Undo) về trạng thái ban đầu
   */
  const handleUndo = () => {
    onUndo?.()
    setSuggestion((s) => (s ? { ...s, previewed: false } : null))
    onShowToast('info', `Đã hoàn tác thay đổi của ${label}`)
  }

  /**
   * Lưu vĩnh viễn vào mã nguồn thật (syncCode)
   */
  const handleSave = async () => {
    if (!suggestion) return
    if (!onSyncCode) {
      onShowToast('err', 'Chưa có trình đồng bộ mã nguồn!')
      return
    }

    // Kiểm tra giới hạn phạm vi nếu bật "Chỉ sửa phần tử này"
    if (scoped && !sourceLoc) {
      onShowToast('err', 'Không thể lưu: Chưa xác định được tệp nguồn tương ứng của phần tử này!')
      return
    }

    const success = await onSyncCode({
      styles: suggestion.styles,
      textContent: suggestion.textContent,
    })

    if (success) {
      setSuggestion((s) => (s ? { ...s, saved: true } : null))
    }
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
        <button className="pm-ai-sidecar__dismiss" onClick={onClose} title="Ẩn gợi ý AI cho phần tử này">
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
      {/* ── Tiêu đề ── */}
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

      {/* ── Thông tin phần tử & tệp nguồn ── */}
      {detail && <div className="pm-ai-sidecar__target">{detail}</div>}

      {/* ── Cảnh báo vi phạm phạm vi ── */}
      {scopeViolation && (
        <div className="pm-ai-sidecar__alert">
          <AlertTriangle size={13} style={{ flex: 'none', marginTop: 1 }} />
          <span>{scopeViolation}</span>
        </div>
      )}

      {/* ── Form nhập lệnh ── */}
      {!suggestion && !busy && (
        <>
          <textarea
            ref={inputRef}
            className="pm-ai-sidecar__input"
            rows={2}
            placeholder="Mô tả điều bạn muốn thay đổi (vd: Đổi nền đỏ, bo tròn 12px, chữ Mua ngay)…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void submit()
              }
            }}
          />
          <div className="pm-ai-sidecar__chips">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                className="pm-ai-chip"
                onClick={() => {
                  setDraft(prompt)
                  void submit(prompt)
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
          <div className="pm-ai-sidecar__ft">
            <label
              className="pm-ai-scope"
              title={
                sourceLoc
                  ? `Chỉ sửa phần tử này trong ${sourceLoc.filePath}. Chặn sửa file khác.`
                  : 'Chỉ sửa phần tử này'
              }
            >
              <input
                type="checkbox"
                checked={scoped}
                onChange={(event) => setScoped(event.target.checked)}
              />
              <span>Chỉ sửa phần tử này</span>
            </label>
            <button className="btn sm primary" onClick={() => void submit()} title="Gửi yêu cầu (Enter)">
              <CornerDownLeft size={11} /> Gửi
            </button>
          </div>
        </>
      )}

      {/* ── Trạng thái đang xử lý ── */}
      {busy && (
        <div className="pm-ai-sidecar__busy">
          <div className="pm-ai-sidecar__busy-hd">
            <Loader2 size={13} className="pm-spin" />
            <span>
              {busyStage === 'packing'
                ? 'Đang đóng gói HTML, CSS & vị trí nguồn (Context Packer)...'
                : 'AI Gateway đang phân tích và tính toán style...'}
            </span>
          </div>
          <div className="pm-ai-skeleton" />
          <div className="pm-ai-skeleton is-short" />
          <div className="pm-ai-skeleton is-mid" />
        </div>
      )}

      {/* ── Kết quả đề xuất ── */}
      {suggestion && (
        <div className="pm-ai-sidecar__result">
          <div className="pm-ai-sidecar__result-hd">
            <Check size={12} />
            <b>Đề xuất từ AI {suggestion.source === 'local' ? '(Gợi ý nhanh)' : ''}</b>
            {suggestion.previewed && (
              <span className="pm-ai-sidecar__badge is-previewing">Đang xem trước</span>
            )}
            {suggestion.saved && <span className="pm-ai-sidecar__badge is-saved">Đã ghi tệp</span>}
          </div>
          <p>{suggestion.summary}</p>

          {/* Hộp Diff so sánh trực quan */}
          {suggestion.diff.length > 0 && (
            <div className="pm-ai-sidecar__diff">
              {suggestion.diff.map((d, idx) => (
                <div key={idx}>
                  <code>{d.property}</code>
                  <span className="is-del">{d.old || 'none'}</span>
                  <ArrowRight size={9} />
                  <span className="is-add">{d.new}</span>
                </div>
              ))}
            </div>
          )}

          {/* Thanh tác vụ: Xem trước, Hoàn tác 1-click, Lưu vào tệp, Mở panel */}
          <div className="pm-ai-sidecar__ft" style={{ gap: 5 }}>
            <button className="pm-ai-sidecar__more" onClick={onOpenPanel} title="Mở bảng điều khiển AI">
              <Layers size={11} /> Panel
              <ChevronRight size={10} />
            </button>

            {!suggestion.previewed ? (
              <button
                className="btn sm"
                onClick={handlePreview}
                title="Áp dụng xem trước trực tiếp trên Canvas"
                style={{ gap: 4 }}
              >
                <Eye size={11} /> Xem trước
              </button>
            ) : (
              <button
                className="btn sm"
                onClick={handleUndo}
                title="Hoàn tác xem trước với 1 click"
                style={{ gap: 4, color: '#f59e0b' }}
              >
                <RotateCcw size={11} /> Hoàn tác
              </button>
            )}

            {!suggestion.saved ? (
              <button
                className="btn sm primary"
                onClick={() => void handleSave()}
                title="Lưu thay đổi vĩnh viễn vào tệp mã nguồn thật"
                style={{ gap: 4 }}
              >
                <Save size={11} /> Lưu vào tệp
              </button>
            ) : (
              <button className="btn sm" onClick={onClose} title="Đóng bảng gợi ý">
                <Check size={11} /> Đóng
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default AISidecar
