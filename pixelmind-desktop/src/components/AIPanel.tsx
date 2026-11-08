import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bug,
  Check,
  ChevronDown,
  CircleDot,
  Cpu,
  FileCode2,
  History,
  Image as ImageIcon,
  Layers,
  ListChecks,
  MessageSquare,
  Palette,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Wand2,
  X,
} from 'lucide-react'
import {
  AI_BRIDGES,
  AI_BUILD_ERRORS,
  AI_CHANGES,
  AI_CONTEXT_ITEMS,
  AI_FIX_CHANGE,
  AI_FIX_STEPS,
  AI_INITIAL_MESSAGES,
  AI_TASKS,
  type AiChange,
  type AiChatMessage,
  type AiContextItem,
  type AiSelectedElement,
  type AiStep,
  type AiTab,
} from '../lib/aiMock'

type ToastKind = 'ok' | 'err' | 'info'

interface AIPanelProps {
  open: boolean
  onClose: () => void
  projectName?: string
  selected?: AiSelectedElement | null
  onOpenDesign: () => void
  onOpenTheme: () => void
  onShowToast: (kind: ToastKind, text: string) => void
}

const TABS: { id: AiTab; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'tasks', label: 'Tác vụ', icon: ListChecks },
  { id: 'changes', label: 'Thay đổi', icon: History },
  { id: 'context', label: 'Ngữ cảnh', icon: Layers },
  { id: 'errors', label: 'Lỗi', icon: Bug },
]

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ duyệt',
  accepted: 'Đã áp dụng',
  rejected: 'Đã từ chối',
}

/** In đậm **đoạn** và `code` trong câu trả lời mô phỏng. */
const richText = (text: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <b key={index}>{part.slice(2, -2)}</b>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index}>{part.slice(1, -1)}</code>
    }
    return <span key={index}>{part}</span>
  })
}

const StepTimeline = ({ steps, compact = false }: { steps: AiStep[]; compact?: boolean }) => (
  <div className={`pm-ai-steps ${compact ? 'is-compact' : ''}`}>
    {steps.map((step, index) => (
      <div key={`${step.label}-${index}`} className={`pm-ai-step is-${step.status}`}>
        <span className="pm-ai-step__dot">
          {step.status === 'done' && <Check size={9} strokeWidth={3} />}
          {step.status === 'running' && <RefreshCw size={9} className="pm-spin" />}
          {step.status === 'failed' && <X size={9} strokeWidth={3} />}
        </span>
        <span className="pm-ai-step__label">{step.label}</span>
      </div>
    ))}
  </div>
)

const DiffBlock = ({
  change,
  onAccept,
  onReject,
  applied,
}: {
  change: AiChange
  onAccept: (id: string) => void
  onReject: (id: string) => void
  applied: boolean
}) => (
  <div className={`pm-ai-diff is-${change.status}`}>
    <div className="pm-ai-diff__hd">
      <FileCode2 size={12} />
      <span className="pm-ai-diff__file" title={change.file}>
        {change.file.split('/').pop()}
      </span>
      <span className="pm-ai-diff__stat">
        <b className="is-add">+{change.added}</b>
        <b className="is-del">−{change.removed}</b>
      </span>
      <span className={`pm-ai-status is-${change.status}`}>{STATUS_LABEL[change.status]}</span>
    </div>
    <div className="pm-ai-diff__body">
      {change.diff.map((line, index) => (
        <div key={index} className={`pm-ai-diff__line is-${line.kind}`}>
          <span className="pm-ai-diff__sign">
            {line.kind === 'add' ? '+' : line.kind === 'del' ? '−' : ' '}
          </span>
          <code>{line.text || ' '}</code>
        </div>
      ))}
    </div>
    {change.status === 'pending' && (
      <div className="pm-ai-diff__ft">
        <span className="pm-ai-diff__reason">{change.summary}</span>
        <button className="btn sm" onClick={() => onReject(change.id)}>
          Từ chối
        </button>
        <button className="btn sm primary" onClick={() => onAccept(change.id)} disabled={applied}>
          <Check size={11} /> Áp dụng
        </button>
      </div>
    )}
  </div>
)

/**
 * Bảng điều khiển Trợ lý AI (UI-only).
 * Toàn bộ dữ liệu là mô phỏng — chưa gọi backend AI thật.
 */
const AIPanel = ({
  open,
  onClose,
  projectName,
  selected,
  onOpenDesign,
  onOpenTheme,
  onShowToast,
}: AIPanelProps) => {
  const [tab, setTab] = useState<AiTab>('chat')
  const [bridge, setBridge] = useState(AI_BRIDGES[0])
  const [bridgeOpen, setBridgeOpen] = useState(false)
  const [messages, setMessages] = useState<AiChatMessage[]>(AI_INITIAL_MESSAGES)
  const [changes, setChanges] = useState<AiChange[]>(AI_CHANGES)
  const [contexts, setContexts] = useState<AiContextItem[]>(AI_CONTEXT_ITEMS)
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [showPack, setShowPack] = useState(false)
  const [fixingId, setFixingId] = useState<string | null>(null)
  const [fixStep, setFixStep] = useState(-1)
  const [fixDone, setFixDone] = useState(false)
  const [taskStopped, setTaskStopped] = useState<string[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  const timers = useRef<number[]>([])
  const msgId = useRef(0)

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms)
    timers.current.push(id)
  }

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), [])

  useEffect(() => {
    if (tab === 'chat' && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, thinking, tab])

  const pending = changes.filter((item) => item.status === 'pending')
  const tokenTotal = useMemo(
    () => contexts.filter((item) => item.checked).reduce((sum, item) => sum + item.tokens, 0),
    [contexts],
  )
  const contextLimit = 128000

  if (!open) return null

  const send = () => {
    const text = draft.trim()
    if (!text || thinking) return
    msgId.current += 1
    const now = new Date()
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    setMessages((prev) => [
      ...prev,
      { id: `local-user-${msgId.current}`, role: 'user', text, time },
    ])
    setDraft('')
    setThinking(true)
    later(() => {
      msgId.current += 1
      const diff = changes.find((item) => item.status === 'pending')
      setMessages((prev) => [
        ...prev,
        {
          id: `local-ai-${msgId.current}`,
          role: 'assistant',
          time,
          text: `Mình đã đọc ngữ cảnh${
            selected ? ` của phần tử \`${selected.tag}${selected.id ? `#${selected.id}` : ''}\`` : ''
          }. Đây là kế hoạch mô phỏng — bạn duyệt diff trước khi áp dụng:`,
          plan: [
            { label: 'Đọc phần tử và tệp nguồn liên quan', status: 'done' },
            { label: 'Đối chiếu design tokens của dự án', status: 'done' },
            { label: 'Sinh thay đổi đề xuất', status: 'done' },
            { label: 'Chờ bạn duyệt diff', status: 'pending' },
          ],
          diff,
        },
      ])
      setThinking(false)
    }, 1200)
  }

  const updateChange = (id: string, status: AiChange['status']) => {
    setChanges((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)))
    const target = changes.find((item) => item.id === id)
    onShowToast(
      status === 'accepted' ? 'ok' : 'info',
      status === 'accepted'
        ? `Đã đánh dấu áp dụng ${target?.file.split('/').pop() ?? 'thay đổi'} (bản xem trước, chưa ghi tệp).`
        : `Đã từ chối thay đổi trên ${target?.file.split('/').pop() ?? 'tệp'}.`,
    )
  }

  const acceptAll = () => {
    if (!pending.length) return
    setChanges((prev) =>
      prev.map((item) => (item.status === 'pending' ? { ...item, status: 'accepted' } : item)),
    )
    onShowToast('ok', `Đã duyệt ${pending.length} thay đổi (mô phỏng, chưa ghi tệp).`)
  }

  const toggleContext = (id: string) => {
    setContexts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)),
    )
  }

  const runFix = (errorId: string) => {
    if (fixingId) return
    setFixingId(errorId)
    setFixStep(0)
    setFixDone(false)
    AI_FIX_STEPS.forEach((_step, index) => {
      later(() => setFixStep(index + 1), 800 * (index + 1))
    })
    later(() => {
      setFixStep(AI_FIX_STEPS.length)
      setFixDone(true)
      setChanges((prev) =>
        prev.some((item) => item.id === AI_FIX_CHANGE.id)
          ? prev
          : [{ ...AI_FIX_CHANGE, status: 'pending' }, ...prev],
      )
      onShowToast('ok', 'AI đã đề xuất bản sửa (mô phỏng). Xem trong tab Thay đổi.')
    }, 800 * (AI_FIX_STEPS.length + 1))
  }

  const resetFix = () => {
    setFixingId(null)
    setFixStep(-1)
    setFixDone(false)
  }

  const fixStepsFor = (): AiStep[] =>
    AI_FIX_STEPS.map((label, index) => ({
      label,
      status: fixStep > index ? 'done' : fixStep === index ? 'running' : 'pending',
    }))

  return (
    <aside className="pm-ai-panel" role="complementary" aria-label="Trợ lý AI">
      {/* ── Đầu panel ── */}
      <div className="pm-ai-panel__hd">
        <span className="pm-ai-panel__logo">
          <Sparkles size={14} />
        </span>
        <div className="pm-ai-panel__title">
          <b>Trợ lý AI</b>
          <span>{projectName ? projectName : 'Chưa mở dự án'}</span>
        </div>
        <div className="pm-ai-bridge">
          <button
            className={`pm-ai-bridge__btn is-${bridge.status}`}
            onClick={() => setBridgeOpen((v) => !v)}
            title="Chọn cầu nối AI (mô phỏng)"
          >
            <span className={`pm-ai-dot is-${bridge.status}`} />
            <span>{bridge.name}</span>
            <ChevronDown size={11} />
          </button>
          {bridgeOpen && (
            <>
              <div className="pm-ai-popover__scrim" onClick={() => setBridgeOpen(false)} />
              <div className="pm-ai-bridge__menu">
                <div className="pm-ai-bridge__menu-hd">Cầu nối AI · chưa kết nối thật</div>
                {AI_BRIDGES.map((item) => (
                  <button
                    key={item.id}
                    className={`pm-ai-bridge__item ${item.id === bridge.id ? 'is-active' : ''}`}
                    onClick={() => {
                      setBridge(item)
                      setBridgeOpen(false)
                      onShowToast('info', `Đã chọn ${item.name} (chưa kết nối backend thật).`)
                    }}
                  >
                    <span className={`pm-ai-dot is-${item.status}`} />
                    <span className="pm-ai-bridge__item-main">
                      <b>{item.name}</b>
                      <span>{item.detail}</span>
                    </span>
                    {item.id === bridge.id && <Check size={12} />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <button className="pm-ibtn" onClick={onClose} title="Đóng trợ lý AI (Ctrl+Shift+A)">
          <X size={14} />
        </button>
      </div>

      {/* ── Tab ── */}
      <div className="pm-ai-tabs">
        {TABS.map((item) => {
          const Icon = item.icon
          const badge =
            item.id === 'changes'
              ? pending.length
              : item.id === 'errors'
                ? AI_BUILD_ERRORS.length
                : 0
          return (
            <button
              key={item.id}
              className={`pm-ai-tab ${tab === item.id ? 'is-on' : ''}`}
              onClick={() => setTab(item.id)}
            >
              <Icon size={12} />
              <span>{item.label}</span>
              {badge > 0 && <em>{badge}</em>}
            </button>
          )
        })}
      </div>

      <div className="pm-ai-preview-note">
        <ShieldCheck size={11} />
        Bản xem trước giao diện · hành động chỉ mô phỏng, chưa ghi vào mã nguồn.
      </div>

      {/* ── Thân panel ── */}
      <div className="pm-ai-panel__body">
        {tab === 'chat' && (
          <>
            <div className="pm-ai-chat" ref={listRef}>
              {messages.map((message) => {
                const liveDiff = message.diff
                  ? changes.find((item) => item.id === message.diff?.id) ?? message.diff
                  : undefined
                return (
                <div key={message.id} className={`pm-ai-msg is-${message.role}`}>
                  {message.role === 'assistant' && (
                    <span className="pm-ai-avatar">
                      <Sparkles size={11} />
                    </span>
                  )}
                  <div className="pm-ai-msg__col">
                    <div className="pm-ai-bubble">{richText(message.text)}</div>
                    {message.plan && <StepTimeline steps={message.plan} compact />}
                    {liveDiff && (
                      <DiffBlock
                        change={liveDiff}
                        onAccept={(id) => updateChange(id, 'accepted')}
                        onReject={(id) => updateChange(id, 'rejected')}
                        applied={liveDiff.status !== 'pending'}
                      />
                    )}
                    <span className="pm-ai-msg__time">{message.time}</span>
                  </div>
                </div>
                )
              })}

              {thinking && (
                <div className="pm-ai-msg is-assistant">
                  <span className="pm-ai-avatar">
                    <Sparkles size={11} />
                  </span>
                  <div className="pm-ai-typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              )}
            </div>

            <div className="pm-ai-quick">
              {[
                'Làm navbar tối giản hơn',
                'Đổi màu nút theo theme',
                'Nối các nút chưa có đích',
                'Giải thích phần tử đang chọn',
              ].map((label) => (
                <button key={label} className="pm-ai-chip" onClick={() => setDraft(label)}>
                  {label}
                </button>
              ))}
            </div>

            <div className="pm-ai-composer">
              <textarea
                className="pm-ai-composer__input"
                placeholder="Nhập yêu cầu bằng tiếng Việt… (mô phỏng)"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    send()
                  }
                }}
                rows={2}
              />
              <div className="pm-ai-composer__ft">
                <span className="pm-ai-composer__ctx">
                  <Layers size={11} />
                  {selected
                    ? `${selected.tag}${selected.id ? `#${selected.id}` : ''}`
                    : 'Chưa chọn phần tử'}
                  <i>·</i>
                  {(tokenTotal / 1000).toFixed(1)}k token
                </span>
                <button className="btn sm primary" onClick={send} disabled={!draft.trim() || thinking}>
                  <Send size={11} /> Gửi
                </button>
              </div>
            </div>
          </>
        )}

        {tab === 'tasks' && (
          <div className="pm-ai-list">
            <div className="pm-ai-list__hd">
              <span>Tác vụ AI</span>
              <span className="pm-ai-muted">{AI_TASKS.length} tác vụ mô phỏng</span>
            </div>
            {AI_TASKS.map((task) => {
              const stopped = taskStopped.includes(task.id)
              const running = task.status === 'running' && !stopped
              return (
                <div key={task.id} className={`pm-ai-task is-${stopped ? 'failed' : task.status}`}>
                  <div className="pm-ai-task__hd">
                    <span className="pm-ai-task__title">{task.title}</span>
                    <span className={`pm-ai-status is-${stopped ? 'failed' : task.status}`}>
                      {stopped ? 'Đã dừng' : task.status === 'running' ? 'Đang chạy' : task.status === 'done' ? 'Hoàn tất' : 'Chờ'}
                    </span>
                  </div>
                  <p className="pm-ai-task__detail">{task.detail}</p>
                  <div className="pm-ai-progress">
                    <span style={{ width: `${running ? task.progress : stopped ? 40 : task.progress}%` }} />
                  </div>
                  <StepTimeline steps={task.steps} />
                  <div className="pm-ai-task__ft">
                    <span className="pm-ai-muted">{stopped ? 'dừng giữa chừng' : task.time}</span>
                    {running ? (
                      <button
                        className="btn sm"
                        onClick={() => {
                          setTaskStopped((prev) => [...prev, task.id])
                          onShowToast('info', `Đã dừng tác vụ "${task.title}" (mô phỏng).`)
                        }}
                      >
                        <Square size={10} fill="currentColor" /> Dừng
                      </button>
                    ) : (
                      <button
                        className="btn sm"
                        onClick={() => onShowToast('info', 'Đây là dữ liệu mô phỏng, chưa chạy tác vụ thật.')}
                      >
                        <Play size={10} /> Chạy lại
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'changes' && (
          <div className="pm-ai-list">
            <div className="pm-ai-list__hd">
              <span>Thay đổi</span>
              <span className="pm-ai-muted">{pending.length} chờ duyệt</span>
              {pending.length > 0 && (
                <button className="btn sm primary" onClick={acceptAll}>
                  <Check size={11} /> Duyệt tất cả
                </button>
              )}
            </div>
            {changes.map((change) => (
              <DiffBlock
                key={change.id}
                change={change}
                onAccept={(id) => updateChange(id, 'accepted')}
                onReject={(id) => updateChange(id, 'rejected')}
                applied={false}
              />
            ))}
            {changes.length === 0 && (
              <div className="pm-ai-empty">
                <Check size={20} />
                <b>Không có thay đổi nào</b>
                <span>Khi AI đề xuất sửa mã, diff sẽ xuất hiện ở đây.</span>
              </div>
            )}
          </div>
        )}

        {tab === 'context' && (
          <div className="pm-ai-list">
            <div className="pm-ai-list__hd">
              <span>Gói ngữ cảnh gửi AI</span>
              <button className="btn sm" onClick={() => setShowPack((v) => !v)}>
                {showPack ? 'Ẩn JSON' : 'Xem trước'}
              </button>
            </div>

            <div className="pm-ai-context-summary">
              <div>
                <b>{(tokenTotal / 1000).toFixed(1)}k</b>
                <span>/ {Math.round(contextLimit / 1000)}k token</span>
              </div>
              <div className="pm-ai-progress">
                <span style={{ width: `${Math.min(100, (tokenTotal / contextLimit) * 100)}%` }} />
              </div>
            </div>

            {selected && (
              <div className="pm-ai-context is-checked">
                <span className="pm-ai-checkbox is-on">
                  <Check size={9} strokeWidth={3} />
                </span>
                <span className="pm-ai-context__main">
                  <b>Phần tử đang chọn</b>
                  <span>
                    &lt;{selected.tag}&gt;
                    {selected.id ? `#${selected.id}` : ''}
                    {selected.className ? ` .${selected.className.split(/\s+/)[0]}` : ''}
                    {selected.filePath ? ` · ${selected.filePath.split(/[\\/]/).pop()}:${selected.lineNumber ?? '?'}` : ''}
                  </span>
                </span>
                <span className="pm-ai-muted">320</span>
              </div>
            )}

            {contexts.map((item) => (
              <button
                key={item.id}
                className={`pm-ai-context ${item.checked ? 'is-checked' : ''}`}
                onClick={() => toggleContext(item.id)}
              >
                <span className={`pm-ai-checkbox ${item.checked ? 'is-on' : ''}`}>
                  {item.checked && <Check size={9} strokeWidth={3} />}
                </span>
                <span className="pm-ai-context__main">
                  <b>{item.label}</b>
                  <span>{item.detail}</span>
                </span>
                <span className="pm-ai-muted">{item.tokens}</span>
              </button>
            ))}

            {showPack && (
              <pre className="pm-ai-pack">{`{
  "mode": "selection",
  "project": ${JSON.stringify(projectName ?? '')},
  "element": ${JSON.stringify(
    selected
      ? {
          tag: selected.tag,
          id: selected.id ?? '',
          className: selected.className ?? '',
          source: selected.filePath ?? '',
          line: selected.lineNumber ?? null,
        }
      : null,
    null,
    2,
  )},
  "tokens": ${tokenTotal},
  "bridges": [${AI_BRIDGES.map((item) => `"${item.id}"`).join(', ')}],
  "note": "Gói ngữ cảnh mô phỏng — chưa gửi tới AI thật."
}`}</pre>
            )}

            <button
              className="pm-ai-wide-btn"
              onClick={() => onShowToast('info', 'Đây là checklist mô phỏng để hình dung luồng gửi ngữ cảnh.')}
            >
              <ShieldCheck size={12} /> Kiểm tra an toàn trước khi gửi
            </button>
          </div>
        )}

        {tab === 'errors' && (
          <div className="pm-ai-list">
            <div className="pm-ai-list__hd">
              <span>Lỗi gần đây</span>
              <span className="pm-ai-muted">từ runner / error parser</span>
            </div>
            {AI_BUILD_ERRORS.map((error) => (
              <div key={error.id} className="pm-ai-error">
                <div className="pm-ai-error__hd">
                  <span className={`pm-ai-error__icon is-${error.severity}`}>
                    <AlertTriangle size={12} />
                  </span>
                  <b>{error.code}</b>
                  <span className={`pm-ai-status is-${error.severity === 'error' ? 'failed' : 'pending'}`}>
                    {error.severity === 'error' ? 'Lỗi' : 'Cảnh báo'}
                  </span>
                </div>
                <p className="pm-ai-error__msg">{error.message}</p>
                <div className="pm-ai-error__file">
                  <FileCode2 size={11} /> {error.file}
                  {error.line ? `:${error.line}` : ''}
                </div>

                {fixingId === error.id ? (
                  <div className="pm-ai-fix">
                    <StepTimeline steps={fixStepsFor()} />
                    {fixDone ? (
                      <div className="pm-ai-fix__done">
                        <Check size={12} />
                        <span>Đã tạo bản sửa mô phỏng — xem tab Thay đổi.</span>
                        <button className="btn sm" onClick={resetFix}>
                          Đóng
                        </button>
                      </div>
                    ) : (
                      <button className="btn sm" onClick={resetFix}>
                        <Square size={10} fill="currentColor" /> Dừng
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="pm-ai-error__ft">
                    <span className="pm-ai-muted">Vòng lặp tối đa 3 lần thử</span>
                    <button
                      className="btn sm primary"
                      onClick={() => runFix(error.id)}
                      disabled={Boolean(fixingId)}
                    >
                      <Wand2 size={11} /> Nhờ AI sửa
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Hành động nhanh ── */}
      <div className="pm-ai-panel__ft">
        <button className="pm-ai-ft-btn" onClick={onOpenDesign} title="Chuyển ảnh thiết kế thành mã">
          <ImageIcon size={12} />
          <span>Design → Code</span>
        </button>
        <button className="pm-ai-ft-btn" onClick={onOpenTheme} title="Sinh theme và nội dung mẫu">
          <Palette size={12} />
          <span>Theme &amp; Nội dung</span>
        </button>
        <span className="pm-ai-panel__ft-spacer" />
        <span className="pm-ai-model" title="Mô hình của cầu nối đang chọn">
          <Cpu size={11} />
          {bridge.model ?? 'chưa cấu hình'}
        </span>
        <span className="pm-ai-dot is-local" />
        <CircleDot size={11} className="pm-ai-muted" />
      </div>
    </aside>
  )
}

export default AIPanel
