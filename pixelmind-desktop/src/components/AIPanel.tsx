import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  Undo2,
  Wand2,
  X,
} from 'lucide-react'
import { api } from '../lib/bridge'
import type {
  AiChange,
  AiContextPack,
  AiContextResult,
  AiModel,
  AiStatus,
} from '@shared/ai'
import {
  AI_BUILD_ERRORS,
  AI_CONTEXT_ITEMS,
  AI_FIX_STEPS,
  AI_TASKS,
  type AiContextItem,
  type AiSelectedElement,
  type AiStep,
  type AiTab,
} from '../lib/aiMock'

type ToastKind = 'ok' | 'err' | 'info'

interface AiChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  time: string
  failed?: boolean
}

interface AIPanelProps {
  open: boolean
  onClose: () => void
  projectId?: string
  projectPath?: string
  projectName?: string
  route?: string
  selected?: AiSelectedElement | null
  errorLog?: string
  onOpenDesign: () => void
  onOpenTheme: () => void
  onOpenSettings?: () => void
  /** Gọi sau khi một thay đổi được áp dụng/hoàn tác để canvas tải lại. */
  onApplied?: () => void
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
  undone: 'Đã hoàn tác',
}

const CONTEXT_LIMIT = 6000

/** In đậm **đoạn** và `code` trong câu trả lời. */
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

const timeNow = () => {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

const timeOf = (at: number) => {
  const date = new Date(at)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
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
  onUndo,
  busy,
}: {
  change: AiChange
  onAccept: (id: string) => void
  onReject: (id: string) => void
  onUndo: (id: string) => void
  busy: boolean
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
    <div className="pm-ai-diff__ft">
      <span className="pm-ai-diff__reason">{change.summary}</span>
      {change.status === 'pending' && (
        <>
          <button className="btn sm" onClick={() => onReject(change.id)} disabled={busy}>
            Từ chối
          </button>
          <button className="btn sm primary" onClick={() => onAccept(change.id)} disabled={busy}>
            <Check size={11} /> Áp dụng
          </button>
        </>
      )}
      {change.status === 'accepted' && (
        <button className="btn sm" onClick={() => onUndo(change.id)} disabled={busy}>
          <Undo2 size={11} /> Hoàn tác
        </button>
      )}
    </div>
  </div>
)

/**
 * Bảng điều khiển Trợ lý AI.
 * Chat / Ngữ cảnh / Thay đổi dùng AI Gateway thật. Tab Tác vụ và Lỗi còn dùng dữ liệu mẫu
 * (sẽ nối runner/error parser ở chặng sau).
 */
const AIPanel = ({
  open,
  onClose,
  projectId,
  projectPath,
  projectName,
  route,
  selected,
  errorLog,
  onOpenDesign,
  onOpenTheme,
  onOpenSettings,
  onApplied,
  onShowToast,
}: AIPanelProps) => {
  const [tab, setTab] = useState<AiTab>('chat')
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [models, setModels] = useState<AiModel[]>([])
  const [bridgeOpen, setBridgeOpen] = useState(false)
  const [messages, setMessages] = useState<AiChatMessage[]>([])
  const [changes, setChanges] = useState<AiChange[]>([])
  const [contexts, setContexts] = useState<AiContextItem[]>(
    AI_CONTEXT_ITEMS.filter((item) => item.id !== 'screenshot'),
  )
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [retryText, setRetryText] = useState<string | null>(null)
  const [busyChange, setBusyChange] = useState(false)
  const [pack, setPack] = useState<AiContextResult | null>(null)
  const [packLoading, setPackLoading] = useState(false)
  const [showPack, setShowPack] = useState(false)
  const [fixingId, setFixingId] = useState<string | null>(null)
  const [fixStep, setFixStep] = useState(-1)
  const [fixDone, setFixDone] = useState(false)
  const [taskStopped, setTaskStopped] = useState<string[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  const timers = useRef<number[]>([])
  const msgId = useRef(0)
  const activeChatId = useRef<string | null>(null)
  const assistantId = useRef<string | null>(null)
  const lastPromptRef = useRef('')

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms)
    timers.current.push(id)
  }

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), [])

  const loadChanges = useCallback(async () => {
    if (!projectId) {
      setChanges([])
      return
    }
    try {
      setChanges(await api.ai.changes.list(projectId))
    } catch {
      setChanges([])
    }
  }, [projectId])

  const loadHistory = useCallback(async () => {
    if (!projectId) {
      setMessages([])
      return
    }
    try {
      const entries = await api.ai.chats.history(projectId)
      setMessages(
        entries.map((entry) => ({
          id: entry.id,
          role: entry.role,
          text: entry.text,
          time: timeOf(entry.at),
        })),
      )
    } catch {
      setMessages([])
    }
  }, [projectId])

  const refreshStatus = useCallback(async () => {
    try {
      const next = await api.ai.status(projectPath)
      setStatus(next)
      const list = await api.ai.models(projectPath).catch(() => [])
      setModels(list)
    } catch {
      setStatus(null)
      setModels([])
    }
  }, [projectPath])

  useEffect(() => {
    if (!open) return
    void refreshStatus()
    void loadChanges()
    void loadHistory()
  }, [open, refreshStatus, loadChanges, loadHistory])

  useEffect(() => {
    const off = api.ai.onChatEvent((event) => {
      if (event.id !== activeChatId.current) return
      if (event.type === 'delta') {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId.current
              ? { ...message, text: message.text + event.text }
              : message,
          ),
        )
      } else if (event.type === 'tool') {
        if (event.status !== 'running') {
          onShowToast(
            event.status === 'ok' ? 'ok' : 'err',
            `Tool ${event.name}: ${event.detail ?? event.status}`,
          )
          if (event.status === 'ok') void loadChanges()
        }
      } else if (event.type === 'done') {
        setThinking(false)
        setRetryText(null)
        activeChatId.current = null
        void loadChanges()
      } else if (event.type === 'error') {
        setThinking(false)
        activeChatId.current = null
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId.current
              ? {
                  ...message,
                  failed: true,
                  text: message.text
                    ? `${message.text}\n\n⚠️ ${event.message}`
                    : `⚠️ ${event.message}`,
                }
              : message,
          ),
        )
        setRetryText(lastPromptRef.current || null)
        onShowToast('err', event.message)
        void loadChanges()
      }
    })
    return off
  }, [loadChanges, onShowToast])

  useEffect(() => {
    if (tab === 'chat' && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, thinking, tab])

  const pending = changes.filter((item) => item.status === 'pending')
  const checkedInclude = useMemo(
    () =>
      contexts
        .filter((item) => item.checked)
        .map((item) => item.id)
        .filter(
          (id): id is 'selection' | 'source' | 'tokens' | 'wires' | 'logs' | 'project' =>
            ['selection', 'source', 'tokens', 'wires', 'logs', 'project'].includes(id),
        ),
    [contexts],
  )
  const tokenTotal = pack?.tokens ?? 0
  const contextLimit = pack?.budget ?? CONTEXT_LIMIT

  if (!open) return null

  const buildContext = async (): Promise<AiContextPack | undefined> => {
    if (!projectPath) {
      onShowToast('err', 'Chưa mở dự án — không thể đóng gói ngữ cảnh.')
      return undefined
    }
    const result = await api.ai.context({
      projectPath,
      projectId,
      projectName,
      route,
      selection: selected,
      include: checkedInclude,
      errorLog: errorLog ?? '',
      tokenBudget: CONTEXT_LIMIT,
    })
    setPack(result)
    return result.pack
  }

  const sendText = async (raw: string, addUser = true) => {
    const text = raw.trim()
    if (!text || thinking) return
    lastPromptRef.current = text
    setRetryText(null)
    msgId.current += 1
    const time = timeNow()
    const userMessage: AiChatMessage = {
      id: `local-user-${msgId.current}`,
      role: 'user',
      text,
      time,
    }
    const history = messages
      .filter(
        (message) =>
          (message.role === 'user' || message.role === 'assistant') &&
          !message.failed &&
          message.text.trim(),
      )
      .map((message) => ({ role: message.role as 'user' | 'assistant', content: message.text }))

    msgId.current += 1
    const replyId = `local-ai-${msgId.current}`
    assistantId.current = replyId
    setMessages((prev) => [
      ...prev.filter((message) => !message.failed),
      ...(addUser ? [userMessage] : []),
      { id: replyId, role: 'assistant', text: '', time },
    ])
    setThinking(true)

    let context: AiContextPack | undefined
    try {
      context = await buildContext()
    } catch (error) {
      onShowToast('info', `Không đóng gói được ngữ cảnh: ${(error as Error).message}`)
    }

    const payloadMessages =
      addUser || history[history.length - 1]?.content !== text
        ? [...history, { role: 'user' as const, content: text }]
        : history

    try {
      const handle = await api.ai.chat({
        projectId,
        projectPath,
        tools: true,
        context,
        messages: payloadMessages,
      })
      activeChatId.current = handle.id
    } catch (error) {
      setThinking(false)
      const message = (error as Error).message
      setMessages((prev) =>
        prev.map((item) =>
          item.id === replyId
            ? { ...item, failed: true, text: `⚠️ ${message}` }
            : item,
        ),
      )
      setRetryText(text)
      onShowToast('err', message)
    }
  }

  const send = () => {
    const text = draft.trim()
    if (!text || thinking) return
    setDraft('')
    void sendText(text, true)
  }

  const retry = () => {
    if (!retryText || thinking) return
    const text = retryText
    setRetryText(null)
    void sendText(text, false)
  }

  const stopChat = () => {
    const id = activeChatId.current
    // Phản hồi ngay trên UI; việc huỷ phía main chỉ cần hoàn tất sau đó.
    activeChatId.current = null
    setThinking(false)
    if (id) void api.ai.cancel(id).catch(() => undefined)
  }

  const updateChangeStatus = async (id: string, action: 'accept' | 'reject' | 'undo') => {
    if (!projectId) return
    setBusyChange(true)
    try {
      const list = await api.ai.changes[action](projectId, id)
      setChanges(list)
      if (action !== 'reject') onApplied?.()
      onShowToast(
        action === 'reject' ? 'info' : 'ok',
        action === 'accept'
          ? 'Đã ghi thay đổi vào mã nguồn và tải lại canvas.'
          : action === 'undo'
            ? 'Đã hoàn tác thay đổi, tệp trở về trạng thái trước đó.'
            : 'Đã từ chối thay đổi.',
      )
    } catch (error) {
      onShowToast('err', (error as Error).message)
    } finally {
      setBusyChange(false)
    }
  }

  const acceptAll = async () => {
    if (!projectId || !pending.length) return
    setBusyChange(true)
    try {
      let list = changes
      for (const change of pending) {
        list = await api.ai.changes.accept(projectId, change.id)
      }
      setChanges(list)
      onApplied?.()
      onShowToast('ok', `Đã áp dụng ${pending.length} thay đổi vào mã nguồn.`)
    } catch (error) {
      onShowToast('err', (error as Error).message)
      void loadChanges()
    } finally {
      setBusyChange(false)
    }
  }

  const previewContext = async () => {
    setPackLoading(true)
    try {
      await buildContext()
      setShowPack(true)
    } catch (error) {
      onShowToast('err', (error as Error).message)
    } finally {
      setPackLoading(false)
    }
  }

  const toggleContext = (id: string) => {
    setContexts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)),
    )
    setPack(null)
    setShowPack(false)
  }

  const switchProvider = async (provider: 'openai' | 'ollama') => {
    const defaults =
      provider === 'ollama'
        ? { aiBaseUrl: 'http://localhost:11434/v1', aiModel: 'qwen2.5-coder' }
        : { aiBaseUrl: 'https://api.openai.com/v1', aiModel: 'gpt-4o-mini' }
    try {
      await api.store.updateSettings({ aiProvider: provider, ...defaults })
      setBridgeOpen(false)
      await refreshStatus()
      onShowToast('ok', `Đã chuyển sang ${provider === 'ollama' ? 'Ollama (local)' : 'OpenAI-compatible'}.`)
    } catch (error) {
      onShowToast('err', (error as Error).message)
    }
  }

  const runFix = (errorId: string) => {
    if (fixingId) return
    setFixingId(errorId)
    setFixStep(0)
    setFixDone(false)
    AI_FIX_STEPS.forEach((_step, index) => {
      later(() => setFixStep(index + 1), 700 * (index + 1))
    })
    later(() => {
      setFixStep(AI_FIX_STEPS.length)
      setFixDone(true)
      onShowToast('info', 'Tự sửa lỗi sẽ được nối ở chặng sau. Hiện tại hãy dán log lỗi vào chat để AI phân tích.')
    }, 700 * (AI_FIX_STEPS.length + 1))
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

  const providerName = status?.provider === 'ollama' ? 'Ollama Local' : 'OpenAI-compatible'
  const configured = Boolean(status?.configured)

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
            className={`pm-ai-bridge__btn is-${configured ? 'online' : 'offline'}`}
            onClick={() => setBridgeOpen((v) => !v)}
            title="Trạng thái AI Gateway"
          >
            <span className={`pm-ai-dot is-${configured ? 'online' : 'offline'}`} />
            <span>{status?.model || providerName}</span>
            <ChevronDown size={11} />
          </button>
          {bridgeOpen && (
            <>
              <div className="pm-ai-popover__scrim" onClick={() => setBridgeOpen(false)} />
              <div className="pm-ai-bridge__menu">
                <div className="pm-ai-bridge__menu-hd">
                  AI Gateway · {configured ? 'đã cấu hình' : 'chưa cấu hình'}
                </div>
                {(['openai', 'ollama'] as const).map((provider) => (
                  <button
                    key={provider}
                    className={`pm-ai-bridge__item ${
                      status?.provider === provider ? 'is-active' : ''
                    }`}
                    onClick={() => void switchProvider(provider)}
                  >
                    <span className={`pm-ai-dot is-${configured ? 'online' : 'offline'}`} />
                    <span className="pm-ai-bridge__item-main">
                      <b>{provider === 'ollama' ? 'Ollama Local' : 'OpenAI-compatible'}</b>
                      <span>
                        {status?.provider === provider
                          ? `${status.baseUrl} · ${status.key.present ? status.key.masked : 'chưa có khoá'}`
                          : provider === 'ollama'
                            ? 'http://localhost:11434/v1'
                            : 'https://api.openai.com/v1'}
                      </span>
                    </span>
                    {status?.provider === provider && <Check size={12} />}
                  </button>
                ))}
                {models.length > 0 && (
                  <div className="pm-ai-bridge__menu-hd">
                    {models.length} model khả dụng · chọn trong Cài đặt
                  </div>
                )}
                {onOpenSettings && (
                  <button
                    className="pm-ai-bridge__item"
                    onClick={() => {
                      setBridgeOpen(false)
                      onOpenSettings()
                    }}
                  >
                    <span className="pm-ai-bridge__item-main">
                      <b>Mở Cài đặt AI…</b>
                      <span>Provider, base URL, model, kiểm tra kết nối</span>
                    </span>
                  </button>
                )}
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

      <div className={`pm-ai-preview-note ${configured ? 'is-ok' : ''}`}>
        <ShieldCheck size={11} />
        {configured
          ? `AI Gateway đã cấu hình · khoá ${status?.key.masked || 'từ môi trường'} · thay đổi phải được duyệt`
          : status?.error ?? 'Chưa cấu hình AI Gateway — mở Cài đặt để nhập provider/model và đặt khoá qua .env.'}
      </div>

      {/* ── Thân panel ── */}
      <div className="pm-ai-panel__body">
        {tab === 'chat' && (
          <>
            <div className="pm-ai-chat" ref={listRef}>
              {messages.length === 0 && (
                <div className="pm-ai-empty">
                  <Sparkles size={20} />
                  <b>Bắt đầu trò chuyện với AI</b>
                  <span>
                    AI đọc phần tử đang chọn, tệp nguồn và design tokens. Mọi sửa tệp đều tạo diff
                    chờ bạn duyệt.
                  </span>
                </div>
              )}

              {messages.map((message) => (
                <div key={message.id} className={`pm-ai-msg is-${message.role}`}>
                  {message.role === 'assistant' && (
                    <span className="pm-ai-avatar">
                      <Sparkles size={11} />
                    </span>
                  )}
                  <div className="pm-ai-msg__col">
                    <div className="pm-ai-bubble">
                      {message.text ? richText(message.text) : <span className="pm-ai-muted">…</span>}
                    </div>
                    <span className="pm-ai-msg__time">{message.time}</span>
                  </div>
                </div>
              ))}

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
                placeholder={
                  configured
                    ? 'Nhập yêu cầu bằng tiếng Việt… (Enter để gửi)'
                    : 'Chưa cấu hình AI — mở Cài đặt để bắt đầu'
                }
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void send()
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
                  {pack ? `${(tokenTotal / 1000).toFixed(1)}k token` : 'ngữ cảnh tự động'}
                </span>
                {retryText && !thinking && (
                  <button className="btn sm" onClick={retry} title="Gửi lại yêu cầu vừa lỗi">
                    <RefreshCw size={11} /> Thử lại
                  </button>
                )}
                {thinking ? (
                  <button className="btn sm" onClick={() => void stopChat()}>
                    <Square size={10} fill="currentColor" /> Dừng
                  </button>
                ) : (
                  <button
                    className="btn sm primary"
                    onClick={() => void send()}
                    disabled={!draft.trim()}
                  >
                    <Send size={11} /> Gửi
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {tab === 'tasks' && (
          <div className="pm-ai-list">
            <div className="pm-ai-list__hd">
              <span>Tác vụ AI</span>
              <span className="pm-ai-muted">{AI_TASKS.length} tác vụ mẫu</span>
            </div>
            {AI_TASKS.map((task) => {
              const stopped = taskStopped.includes(task.id)
              const running = task.status === 'running' && !stopped
              return (
                <div key={task.id} className={`pm-ai-task is-${stopped ? 'failed' : task.status}`}>
                  <div className="pm-ai-task__hd">
                    <span className="pm-ai-task__title">{task.title}</span>
                    <span className={`pm-ai-status is-${stopped ? 'failed' : task.status}`}>
                      {stopped
                        ? 'Đã dừng'
                        : task.status === 'running'
                          ? 'Đang chạy'
                          : task.status === 'done'
                            ? 'Hoàn tất'
                            : 'Chờ'}
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
                          onShowToast('info', `Đã dừng tác vụ "${task.title}" (mẫu).`)
                        }}
                      >
                        <Square size={10} fill="currentColor" /> Dừng
                      </button>
                    ) : (
                      <button
                        className="btn sm"
                        onClick={() => onShowToast('info', 'Hàng đợi tác vụ sẽ nối ở chặng sau.')}
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
                <button className="btn sm primary" onClick={() => void acceptAll()} disabled={busyChange}>
                  <Check size={11} /> Duyệt tất cả
                </button>
              )}
            </div>
            {changes.length === 0 ? (
              <div className="pm-ai-empty">
                <Check size={20} />
                <b>Không có thay đổi nào</b>
                <span>Khi AI đề xuất sửa mã, diff sẽ xuất hiện ở đây để bạn duyệt.</span>
              </div>
            ) : (
              changes.map((change) => (
                <DiffBlock
                  key={change.id}
                  change={change}
                  onAccept={(id) => void updateChangeStatus(id, 'accept')}
                  onReject={(id) => void updateChangeStatus(id, 'reject')}
                  onUndo={(id) => void updateChangeStatus(id, 'undo')}
                  busy={busyChange}
                />
              ))
            )}
          </div>
        )}

        {tab === 'context' && (
          <div className="pm-ai-list">
            <div className="pm-ai-list__hd">
              <span>Gói ngữ cảnh gửi AI</span>
              <button
                className="btn sm"
                onClick={() => void previewContext()}
                disabled={packLoading || !projectPath}
              >
                {packLoading ? 'Đang đóng gói…' : showPack ? 'Làm mới' : 'Xem trước'}
              </button>
            </div>

            <div className="pm-ai-context-summary">
              <div>
                <b>{(tokenTotal / 1000).toFixed(1)}k</b>
                <span>/ {Math.round(contextLimit / 1000)}k token</span>
              </div>
              <div className="pm-ai-progress">
                <span
                  style={{ width: `${Math.min(100, (tokenTotal / contextLimit) * 100)}%` }}
                />
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
                    {selected.filePath
                      ? ` · ${selected.filePath.split(/[\\/]/).pop()}:${selected.lineNumber ?? '?'}`
                      : ' · chưa xác định tệp nguồn'}
                  </span>
                </span>
                <span className="pm-ai-muted">
                  {pack?.pack.selection ? 'đã gói' : 'tự động'}
                </span>
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
                <span className="pm-ai-muted">
                  {pack ? (pack.dropped.includes(item.id) ? 'lược bớt' : 'đã gói') : item.tokens}
                </span>
              </button>
            ))}

            {pack?.notes.map((note) => (
              <div key={note} className="pm-ai-context-note">
                <AlertTriangle size={11} /> {note}
              </div>
            ))}

            {showPack && pack && (
              <pre className="pm-ai-pack">{pack.json}</pre>
            )}

            <button
              className="pm-ai-wide-btn"
              onClick={() => void previewContext()}
              disabled={packLoading}
            >
              <ShieldCheck size={12} /> Kiểm tra an toàn &amp; đóng gói lại
            </button>
          </div>
        )}

        {tab === 'errors' && (
          <div className="pm-ai-list">
            <div className="pm-ai-list__hd">
              <span>Lỗi gần đây</span>
              <span className="pm-ai-muted">dữ liệu mẫu · chưa nối error parser</span>
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
                        <span>Tự sửa lỗi chưa được bật trong chặng này.</span>
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
                    <span className="pm-ai-muted">Vòng lặp tối đa 3 lần thử (chặng sau)</span>
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
        <span className="pm-ai-model" title="Model của AI Gateway đang cấu hình">
          <Cpu size={11} />
          {status?.model ?? 'chưa cấu hình'}
        </span>
        <span className={`pm-ai-dot is-${configured ? 'online' : 'offline'}`} />
        <CircleDot size={11} className="pm-ai-muted" />
      </div>
    </aside>
  )
}

export default AIPanel
