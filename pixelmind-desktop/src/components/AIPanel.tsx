import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  Bug,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Copy,
  Cpu,
  FileCode2,
  History,
  Image as ImageIcon,
  Layers,
  ListChecks,
  MessageSquare,
  Octagon,
  Palette,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Terminal,
  Key,
  Undo2,
  Wand2,
  X,
} from 'lucide-react'
import type { ParsedError } from '../lib/errorParser'
import type { RunLog } from '@shared/types'
import { api } from '../lib/bridge'
import type {
  AiAuditEntry,
  AiBridgeKind,
  AiBridgeStatus,
  AiChange,
  AiContextPack,
  AiContextResult,
  AiCostStats,
  AiPlanStep,
  AiStatus,
  AiToolLogEntry,
  DetectedCli,
} from '@shared/ai'
import type {
  AiSelectedElement,
  AiStep,
  AiTab,
} from '../lib/aiMock'

type ToastKind = 'ok' | 'err' | 'info'

interface AiChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  time: string
  failed?: boolean
  plan?: AiPlanStep[]
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
  parsedError?: ParsedError | null
  rawLogs?: RunLog[]
  initialTab?: AiTab
  onTriggerBuild?: () => void
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
  { id: 'security', label: 'Bảo mật & Chi phí', icon: ShieldCheck },
]

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ duyệt',
  accepted: 'Đã áp dụng',
  rejected: 'Đã từ chối',
  undone: 'Đã hoàn tác',
}

interface ContextOption {
  id: 'selection' | 'source' | 'tokens' | 'wires' | 'logs' | 'project'
  label: string
  checked: boolean
}

const DEFAULT_CONTEXT_OPTIONS: ContextOption[] = [
  { id: 'selection', label: 'Vùng chọn trên canvas', checked: true },
  { id: 'source', label: 'Tệp nguồn của phần tử', checked: true },
  { id: 'tokens', label: 'Design tokens dự án', checked: true },
  { id: 'wires', label: 'Sơ đồ dây nối các trang', checked: true },
  { id: 'logs', label: 'Nhật ký lỗi build gần nhất', checked: false },
  { id: 'project', label: 'Chỉ mục tệp toàn bộ dự án', checked: false },
]

const CONTEXT_LIMIT = 6000

/** Phân tích các thành phần nội dòng: in đậm, code, liên kết URL. */
const renderInline = (text: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\bhttps?:\/\/[^\s]+)/g).filter(Boolean)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <b key={index}>{part.slice(2, -2)}</b>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index}>{part.slice(1, -1)}</code>
    }
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={index} href={part} target="_blank" rel="noreferrer" className="pm-ai-link">
          {part}
        </a>
      )
    }
    return <span key={index}>{part}</span>
  })
}

const CodeBlock = ({ lang, code }: { lang: string; code: string }) => {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    void navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="pm-ai-codeblock">
      <div className="pm-ai-codeblock__bar">
        <span>{lang || 'code'}</span>
        <button className="pm-ai-codeblock__copy" onClick={handleCopy} type="button">
          {copied ? <Check size={11} /> : <Copy size={11} />}
          <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}

interface ParsedBlock {
  type: 'p' | 'ol' | 'ul' | 'quote' | 'heading' | 'code'
  level?: number
  lang?: string
  code?: string
  items?: string[]
  text?: string
}

function parseAiMessage(rawText: string): {
  agentBadge: string | null
  blocks: ParsedBlock[]
} {
  let text = rawText || ''
  let agentBadge: string | null = null

  // 1. Tách huy hiệu CLI nếu có (ví dụ "▶ OpenCode · tiếp tục phiên")
  const standardMatch = text.match(/^▶\s*([^\r\n]+?)(?:\r?\n+|$)/)
  if (standardMatch) {
    const candidate = standardMatch[1].trim()
    if (candidate.length < 80 && !candidate.includes('.')) {
      agentBadge = candidate
      text = text.slice(standardMatch[0].length).trim()
    }
  }

  if (!agentBadge) {
    const squashedMatch = text.match(
      /^▶\s*([^·\n\r]+(?:\s*·\s*[^·\n\r\s]+)*?\s*(?:·\s*tiếp tục phiên)?)(?:\s+(?=[A-ZÀ-ỸĐa-z])|\r?\n|$)/,
    )
    if (squashedMatch && squashedMatch[1] && squashedMatch[1].trim().length < 60) {
      agentBadge = squashedMatch[1].trim()
      text = text.slice(squashedMatch[0].length).trim()
    }
  }

  // 2. Tách các câu bị nối liền bởi dấu hai chấm (kết quả sau tool)
  text = text.replace(/([^\s\n]):([A-ZÀ-ỸĐ])/g, '$1:\n\n$2')
  // Tách các bước đánh số bị dính trên cùng một dòng thành dòng riêng
  text = text.replace(/([^\n])\s+(\d+\.)\s+/g, '$1\n$2 ')

  // 3. Tách khối mã (fenced code blocks ```...```)
  const blocks: ParsedBlock[] = []
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const nonCode = text.slice(lastIndex, match.index)
      blocks.push(...parseTextBlocks(nonCode))
    }
    blocks.push({
      type: 'code',
      lang: match[1] || '',
      code: match[2].trimEnd(),
    })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex)
    const unclosedMatch = remaining.match(/```([a-zA-Z0-9_-]*)\r?\n([\s\S]*)$/)
    if (unclosedMatch) {
      const beforeCode = remaining.slice(0, unclosedMatch.index)
      if (beforeCode.trim()) blocks.push(...parseTextBlocks(beforeCode))
      blocks.push({
        type: 'code',
        lang: unclosedMatch[1] || '',
        code: unclosedMatch[2],
      })
    } else {
      blocks.push(...parseTextBlocks(remaining))
    }
  }

  return { agentBadge, blocks }
}

function parseTextBlocks(text: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = []
  const rawParagraphs = text.split(/\r?\n\r?\n/)

  for (const para of rawParagraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue

    const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) continue

    if (lines.length === 1 && /^#{1,4}\s+/.test(lines[0])) {
      const level = lines[0].match(/^(#{1,4})\s+/)?.[1].length || 2
      blocks.push({
        type: 'heading',
        level,
        text: lines[0].replace(/^#{1,4}\s+/, ''),
      })
      continue
    }

    let currentList: { type: 'ol' | 'ul'; items: string[] } | null = null

    for (const line of lines) {
      const olMatch = line.match(/^(\d+)\.\s+(.*)$/)
      const ulMatch = line.match(/^[-*•]\s+(.*)$/)
      const quoteMatch = line.match(/^>\s+(.*)$/)

      if (olMatch) {
        if (!currentList || currentList.type !== 'ol') {
          if (currentList) blocks.push(currentList)
          currentList = { type: 'ol', items: [] }
        }
        currentList.items.push(olMatch[2])
      } else if (ulMatch) {
        if (!currentList || currentList.type !== 'ul') {
          if (currentList) blocks.push(currentList)
          currentList = { type: 'ul', items: [] }
        }
        currentList.items.push(ulMatch[1])
      } else if (quoteMatch) {
        if (currentList) {
          blocks.push(currentList)
          currentList = null
        }
        blocks.push({ type: 'quote', text: quoteMatch[1] })
      } else {
        if (currentList) {
          blocks.push(currentList)
          currentList = null
        }
        blocks.push({ type: 'p', text: line })
      }
    }

    if (currentList) {
      blocks.push(currentList)
    }
  }

  return blocks
}

const AiMessageContent = ({ text, isUser }: { text: string; isUser?: boolean }) => {
  if (isUser) {
    return <div className="pm-ai-user-text">{renderInline(text)}</div>
  }

  const { agentBadge, blocks } = useMemo(() => parseAiMessage(text), [text])

  return (
    <div className="pm-ai-message-content">
      {agentBadge && (
        <div className="pm-ai-agent-pill">
          <Sparkles size={10} className="pm-ai-agent-pill__icon" />
          <span>{agentBadge}</span>
        </div>
      )}
      <div className="pm-ai-markdown">
        {blocks.map((block, idx) => {
          if (block.type === 'code') {
            return <CodeBlock key={idx} lang={block.lang || ''} code={block.code || ''} />
          }
          if (block.type === 'heading') {
            if (block.level === 1) return <h2 key={idx} className="pm-ai-h2">{renderInline(block.text || '')}</h2>
            if (block.level === 2) return <h3 key={idx} className="pm-ai-h3">{renderInline(block.text || '')}</h3>
            return <h4 key={idx} className="pm-ai-h4">{renderInline(block.text || '')}</h4>
          }
          if (block.type === 'ol') {
            return (
              <ol key={idx} className="pm-ai-ol">
                {(block.items || []).map((item, itemIdx) => (
                  <li key={itemIdx} className="pm-ai-li">
                    {renderInline(item)}
                  </li>
                ))}
              </ol>
            )
          }
          if (block.type === 'ul') {
            return (
              <ul key={idx} className="pm-ai-ul">
                {(block.items || []).map((item, itemIdx) => (
                  <li key={itemIdx} className="pm-ai-li">
                    {renderInline(item)}
                  </li>
                ))}
              </ul>
            )
          }
          if (block.type === 'quote') {
            return (
              <blockquote key={idx} className="pm-ai-quote">
                {renderInline(block.text || '')}
              </blockquote>
            )
          }
          return (
            <p key={idx} className="pm-ai-p">
              {renderInline(block.text || '')}
            </p>
          )
        })}
      </div>
    </div>
  )
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
  parsedError,
  rawLogs: _rawLogs,
  initialTab,
  onTriggerBuild: _onTriggerBuild,
  onOpenDesign,
  onOpenTheme,
  onOpenSettings,
  onApplied,
  onShowToast,
}: AIPanelProps) => {
  const [tab, setTab] = useState<AiTab>(initialTab || 'chat')

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab)
    }
  }, [initialTab])

  // ─── VÒNG LẶP TỰ SỬA LỖI (CHẶNG 4: PROPOSE → APPLY → BUILD → VERIFY) ───
  const [loopActive, setLoopActive] = useState(false)
  const [loopAttempt, setLoopAttempt] = useState(1)
  const [loopStage, setLoopStage] = useState<
    'idle' | 'proposing' | 'applying' | 'building' | 'verifying' | 'success' | 'failed' | 'aborted'
  >('idle')
  const [loopLogs, setLoopLogs] = useState<string[]>([])
  const [autoApproveLogs, setAutoApproveLogs] = useState<string[]>([])
  const [appliedChangeIds, setAppliedChangeIds] = useState<string[]>([])
  const [autoApproveSafeErrors, setAutoApproveSafeErrors] = useState(true)
  const killSwitchRef = useRef(false)
  const [status, setStatus] = useState<AiStatus | null>(null)

  // ─── CHẶNG 8: BẢO MẬT, GUARDRAILS, AUDIT & NGÂN SÁCH CHI PHÍ ───
  const [costStats, setCostStats] = useState<AiCostStats | null>(null)
  const [budgetInput, setBudgetInput] = useState<string>('100000')
  const [isEditingBudget, setIsEditingBudget] = useState(false)

  const loadSecurityData = useCallback(async () => {
    try {
      const [logs, cost] = await Promise.all([
        api.ai.audit.list(projectId),
        api.ai.cost.get(projectId),
      ])
      setAuditLogs(logs)
      setCostStats(cost)
      if (cost?.budgetTokens) setBudgetInput(String(cost.budgetTokens))
    } catch {}
  }, [projectId])

  useEffect(() => {
    if (open && tab === 'security') {
      void loadSecurityData()
    }
  }, [open, tab, loadSecurityData])

  const handleUpdateBudget = async () => {
    if (!projectId) return
    const val = Number(budgetInput)
    if (!Number.isFinite(val) || val <= 0) {
      onShowToast('err', 'Hạn mức ngân sách không hợp lệ')
      return
    }
    try {
      const updated = await api.ai.cost.setBudget(projectId, val)
      setCostStats(updated)
      setIsEditingBudget(false)
      onShowToast('ok', `Đã cập nhật hạn mức ngân sách: ${val.toLocaleString()} tokens`)
    } catch {
      onShowToast('err', 'Không thể lưu hạn mức ngân sách')
    }
  }

  const handleClearAudit = async () => {
    try {
      await api.ai.audit.clear(projectId)
      setAuditLogs([])
      onShowToast('ok', 'Đã xoá lịch sử thao tác AI')
    } catch {
      onShowToast('err', 'Không thể xoá lịch sử audit')
    }
  }

  const handleResetCost = async () => {
    try {
      await api.ai.cost.reset(projectId)
      void loadSecurityData()
      onShowToast('ok', 'Đã đặt lại bộ đếm token và chi phí')
    } catch {
      onShowToast('err', 'Không thể đặt lại chi phí')
    }
  }
  const [bridgeOpen, setBridgeOpen] = useState(false)
  const [activeBridge, setActiveBridge] = useState<AiBridgeKind>('api')
  const [bridges, setBridges] = useState<AiBridgeStatus[]>([])
  const [detectedClis, setDetectedClis] = useState<DetectedCli[]>([])
  const [scanningClis, setScanningClis] = useState(false)
  const [selectedCli, setSelectedCli] = useState<{ id: string; model?: string } | null>(() => {
    try {
      const raw = localStorage.getItem('pixelmind.ai.cliTarget')
      return raw ? (JSON.parse(raw) as { id: string; model?: string }) : null
    } catch {
      return null
    }
  })
  const [cliModels, setCliModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [isSavingKey, setIsSavingKey] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem('pixelmind.ai.cliTarget', JSON.stringify(selectedCli))
    } catch {
      // localStorage có thể bị chặn — bỏ qua
    }
  }, [selectedCli])

  const loadCliModels = useCallback(async (id: string) => {
    setLoadingModels(true)
    try {
      const list = await api.ai.cli.models(id)
      setCliModels(list || [])
    } catch {
      setCliModels([])
    } finally {
      setLoadingModels(false)
    }
  }, [])

  // Tự chọn CLI chạy được đầu tiên nếu người dùng chưa chọn.
  useEffect(() => {
    if (selectedCli) return
    const first = detectedClis.find((cli) => cli.installed && cli.supportsRun)
    if (first) setSelectedCli({ id: first.id })
  }, [detectedClis, selectedCli])

  const scanLocalClis = useCallback(async () => {
    setScanningClis(true)
    try {
      const list = await api.ai.cli.detect(true)
      setDetectedClis(list || [])
    } catch {
      setDetectedClis([])
    } finally {
      setScanningClis(false)
    }
  }, [])

  const selectCli = useCallback(
    async (cli: DetectedCli) => {
      if (!cli.installed || !cli.supportsRun) return
      setSelectedCli({ id: cli.id })
      setActiveBridge('cli')
      try {
        await api.ai.bridges.setActive('cli')
      } catch {
        // vẫn giữ lựa chọn cục bộ
      }
      onShowToast('ok', `Đã chọn ${cli.name}`)
      void loadCliModels(cli.id)
    },
    [loadCliModels, onShowToast],
  )

  const handleSaveApiKey = async () => {
    const key = apiKeyInput.trim()
    if (!key) return
    setIsSavingKey(true)
    try {
      const res = await api.ai.saveKey(key)
      setApiKeyInput('')
      onShowToast('ok', `Đã lưu khoá API (${res.masked})!`)
      void refreshStatus()
      void refreshBridges()
    } catch (err) {
      onShowToast('err', `Lỗi lưu khoá: ${(err as Error).message}`)
    } finally {
      setIsSavingKey(false)
    }
  }

  const refreshBridges = useCallback(async () => {
    try {
      const [active, list] = await Promise.all([
        api.ai.bridges.getActive(),
        api.ai.bridges.list(projectPath),
      ])
      setActiveBridge(active)
      setBridges(list)
    } catch {}
  }, [projectPath])

  const handleSelectBridge = async (kind: AiBridgeKind) => {
    setActiveBridge(kind)
    setBridgeOpen(false)
    try {
      if (kind === 'cli' && !selectedCli) {
        // Chọn CLI Bridge mà chưa chọn agent: tự lấy CLI chạy được đầu tiên.
        const first = detectedClis.find((cli) => cli.installed && cli.supportsRun)
        if (first) {
          setSelectedCli({ id: first.id })
          void loadCliModels(first.id)
        }
      }
      if (kind === 'ollama') {
        await switchProvider('ollama')
      } else if (kind === 'api') {
        await switchProvider('openai')
      }
      const updated = await api.ai.bridges.setActive(kind)
      setBridges((prev) => prev.map((b) => (b.kind === kind ? updated : b)))
      onShowToast('ok', `Đã chuyển sang ${updated.name} (${updated.status})`)
      void refreshStatus()
    } catch {
      onShowToast('err', 'Không thể đổi cầu nối AI')
    }
  }
  const [messages, setMessages] = useState<AiChatMessage[]>([])
  const [changes, setChanges] = useState<AiChange[]>([])
  const [toolLogs, setToolLogs] = useState<AiToolLogEntry[]>([])
  const [contexts, setContexts] = useState<ContextOption[]>(DEFAULT_CONTEXT_OPTIONS)
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [liveStatus, setLiveStatus] = useState<{
    text: string
    phase: 'prepare' | 'spawn' | 'wait' | 'tool' | 'stream'
  } | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [retryText, setRetryText] = useState<string | null>(null)
  const [busyChange, setBusyChange] = useState(false)
  const [pack, setPack] = useState<AiContextResult | null>(null)
  const [packLoading, setPackLoading] = useState(false)
  const [showPack, setShowPack] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const timers = useRef<number[]>([])
  const msgId = useRef(0)
  const activeChatId = useRef<string | null>(null)
  const assistantId = useRef<string | null>(null)
  const bridgeBtnRef = useRef<HTMLButtonElement>(null)
  const [bridgePos, setBridgePos] = useState<{ top: number; right: number }>({ top: 34, right: 10 })

  const updateBridgePos = useCallback(() => {
    if (bridgeBtnRef.current) {
      const rect = bridgeBtnRef.current.getBoundingClientRect()
      setBridgePos({
        top: Math.round(rect.bottom + 4),
        right: Math.max(10, Math.round(window.innerWidth - rect.right)),
      })
    }
  }, [])

  useEffect(() => {
    if (!bridgeOpen) return
    updateBridgePos()
    const handleRecalc = () => updateBridgePos()
    window.addEventListener('resize', handleRecalc)
    window.addEventListener('scroll', handleRecalc, true)
    return () => {
      window.removeEventListener('resize', handleRecalc)
      window.removeEventListener('scroll', handleRecalc, true)
    }
  }, [bridgeOpen, updateBridgePos])

  const lastPromptRef = useRef('')

  const loadToolLogs = useCallback(async () => {
    if (!projectId) {
      setToolLogs([])
      return
    }
    try {
      const entries = await api.ai.tools.logs(projectId)
      setToolLogs(entries || [])
    } catch {
      setToolLogs([])
    }
  }, [projectId])

  const [tasksSubTab, setTasksSubTab] = useState<'tools' | 'audit'>('tools')
  const [auditLogs, setAuditLogs] = useState<AiAuditEntry[]>([])

  const loadAuditLogs = useCallback(async () => {
    try {
      const entries = await api.ai.audit.list(projectId)
      setAuditLogs(entries || [])
    } catch {
      setAuditLogs([])
    }
  }, [projectId])

  const handleKillSwitch = useCallback(async () => {
    try {
      const res = await api.ai.killSwitch()
      setThinking(false)
      onShowToast('ok', `Dừng khẩn cấp: Đã dừng ${res.count} tiến trình AI`)
      void loadToolLogs()
      void loadAuditLogs()
    } catch (err) {
      onShowToast('err', `Lỗi dừng khẩn cấp: ${(err as Error).message}`)
    }
  }, [onShowToast, loadToolLogs, loadAuditLogs])

  useEffect(() => {
    if (tab === 'tasks') {
      void loadToolLogs()
      void loadAuditLogs()
    }
  }, [tab, loadToolLogs, loadAuditLogs])

  const getContextDetail = (id: string): string => {
    switch (id) {
      case 'selection':
        return selected
          ? `<${selected.tag}${selected.id ? `#${selected.id}` : ''}${selected.className ? ` .${selected.className.split(/\s+/)[0]}` : ''}> · ${selected.text ? `"${selected.text.slice(0, 24)}"` : 'không có text'}`
          : 'Chưa chọn phần tử trên canvas'
      case 'source':
        return selected?.filePath
          ? `${selected.filePath.split(/[\\/]/).pop()}${selected.lineNumber ? `:${selected.lineNumber}` : ''}`
          : 'Theo tệp của phần tử đang chọn'
      case 'tokens':
        return pack?.pack.tokens
          ? `${pack.pack.tokens.colors?.length || 0} màu, ${pack.pack.tokens.spacing?.length || 0} khoảng cách`
          : 'Đọc từ tokens.json hoặc variables.css'
      case 'wires':
        return pack?.pack.wires?.length
          ? `${pack.pack.wires.length} trang có liên kết nav`
          : 'Sơ đồ luồng trang của dự án'
      case 'logs':
        return errorLog
          ? `Log lỗi (${errorLog.split('\n').filter(Boolean).length} dòng)`
          : 'Nhật ký lỗi gần nhất'
      case 'project':
        return pack?.pack.projectIndex?.length
          ? `${pack.pack.projectIndex.length} tệp trong chỉ mục`
          : projectName
            ? `${projectName} (quét cây tệp)`
            : 'Chỉ mục dự án'
      default:
        return ''
    }
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
    } catch {
      setStatus(null)
    }
  }, [projectPath])

  useEffect(() => {
    if (!open) return
    void refreshStatus()
    void refreshBridges()
    void scanLocalClis()
    void loadChanges()
    void loadHistory()
  }, [open, refreshStatus, refreshBridges, scanLocalClis, loadChanges, loadHistory])

  useEffect(() => {
    const off = api.ai.onChatEvent((event) => {
      if (event.id !== activeChatId.current) return
      if (event.type === 'delta') {
        if (event.text && !event.text.startsWith('▶')) setLiveStatus(null)
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId.current
              ? { ...message, text: message.text + event.text }
              : message,
          ),
        )
      } else if (event.type === 'status') {
        setLiveStatus(event.text ? { text: event.text, phase: event.phase ?? 'wait' } : null)
      } else if (event.type === 'plan') {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId.current
              ? { ...message, plan: event.steps }
              : message,
          ),
        )
      } else if (event.type === 'step_update') {
        setMessages((prev) =>
          prev.map((message) => {
            if (message.id === assistantId.current && message.plan) {
              return {
                ...message,
                plan: message.plan.map((s) => (s.id === event.stepId ? { ...s, status: event.status } : s)),
              }
            }
            return message
          }),
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
        setLiveStatus(null)
        setRetryText(null)
        activeChatId.current = null
        void loadChanges()
        void loadToolLogs()
        void loadAuditLogs()
      } else if (event.type === 'error') {
        setThinking(false)
        setLiveStatus(null)
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
        void loadToolLogs()
        void loadAuditLogs()
      }
    })
    return off
  }, [loadChanges, onShowToast, loadToolLogs, loadAuditLogs])

  useEffect(() => {
    if (!thinking) {
      setElapsed(0)
      return
    }
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [thinking])

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
    setLiveStatus({ text: 'Đang gửi yêu cầu…', phase: 'prepare' })
    setElapsed(0)

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
        bridge: activeBridge,
        cli: activeBridge === 'cli' ? (selectedCli ?? undefined) : undefined,
      })
      activeChatId.current = handle.id
    } catch (error) {
      setThinking(false)
      setLiveStatus(null)
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

  /**
   * Đánh giá quy tắc tự động duyệt an toàn (Safe Auto-Approve Policy):
   * Chỉ bật cho lỗi môi trường, cài package, format hoặc config; KHÔNG bật cho sửa logic nghiệp vụ.
   */
  const isSafeErrorChange = (err: ParsedError | null | undefined, chg: AiChange): boolean => {
    // 1. Lỗi thiếu package / library (cài thư viện an toàn)
    if (err?.type === 'missing_package') return true
    // 2. Lỗi cổng mạng hoặc xung đột tiến trình
    if (err?.type === 'port_in_use' || err?.type === 'electron_cache_lock') return true
    // 3. Tệp cấu hình môi trường / package / format
    const f = chg.file.toLowerCase()
    if (
      f.endsWith('package.json') ||
      f.endsWith('launchsettings.json') ||
      f.endsWith('.env') ||
      f.endsWith('.env.example') ||
      f.endsWith('variables.css') ||
      f.endsWith('.editorconfig')
    ) {
      return true
    }
    // 4. Lỗi định dạng nhẹ (format/syntax nhẹ dưới 5 dòng và KHÔNG nằm trong controller/service/model)
    const isLogicFile =
      f.includes('controller') ||
      f.includes('service') ||
      f.includes('repository') ||
      f.includes('model') ||
      f.includes('database') ||
      f.includes('auth')
    if (!isLogicFile && chg.added <= 4 && chg.removed <= 4) {
      return true
    }
    // Mọi sửa đổi logic nghiệp vụ -> Bắt buộc người dùng xác nhận thủ công
    return false
  }

  /**
   * Vòng lặp tự sửa lỗi build (Propose → Apply → Build → Verify)
   * Tối đa 3 lần thử; snapshot dự phòng trước mỗi lần; kill-switch; rollback
   */
  const runAutoFixLoop = async () => {
    if (loopActive || !projectPath || !projectId) return
    setLoopActive(true)
    setLoopLogs([])
    killSwitchRef.current = false
    setLoopStage('proposing')

    const maxAttempts = 3
    let attempt = 1
    let success = false
    let currentErrText =
      errorLog ||
      (parsedError
        ? `${parsedError.title}\n${parsedError.summary}\n${parsedError.recommendation}`
        : 'Lỗi build không xác định')

    const addLog = (msg: string) => {
      setLoopLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
    }

    addLog(`🚀 BẮT ĐẦU VÒNG LẶP TỰ SỬA LỖI (Tối đa ${maxAttempts} lần thử)`)
    if (parsedError) {
      addLog(`Phát hiện lỗi: ${parsedError.title} (${parsedError.type})`)
      if (parsedError.file) addLog(`Tệp nghi vấn: ${parsedError.file}:${parsedError.line || 1}`)
    }

    while (attempt <= maxAttempts) {
      if (killSwitchRef.current) {
        addLog(`🛑 Kill-switch kích hoạt: Dừng vòng lặp tại lần thử ${attempt}.`)
        break
      }

      setLoopAttempt(attempt)
      addLog(`\n═══════ LẦN THỬ ${attempt}/${maxAttempts} ═══════`)

      // BƯỚC 1: PROPOSE (Đề xuất)
      setLoopStage('proposing')
      addLog(`[1/4 Propose] Đóng gói ngữ cảnh và yêu cầu AI Gateway đề xuất bản vá...`)

      let currentProposed: AiChange | null = null
      try {
        const ctxRes = await api.ai.context({
          projectPath,
          projectId,
          projectName,
          route,
          include: ['logs', 'source', 'tokens'],
          errorLog: currentErrText,
          tokenBudget: 4000,
        })

        const promptText = `Dự án đang gặp lỗi build sau:
${currentErrText}

${parsedError?.file ? `Vị trí tệp lỗi: ${parsedError.file}:${parsedError.line || 1}` : ''}
${parsedError?.recommendation ? `Gợi ý xử lý: ${parsedError.recommendation}` : ''}

YÊU CẦU: Hãy phân tích kỹ và dùng tool apply_patch để đề xuất sửa dứt điểm lỗi build này. Chỉ sửa đúng những gì cần thiết để build vượt qua.`

        const chat = await api.ai.chat({
          projectId,
          projectPath,
          tools: true,
          context: ctxRes?.pack,
          messages: [{ role: 'user', content: promptText }],
        })
        activeChatId.current = chat.id

        await new Promise<void>((resolve) => {
          const off = api.ai.onChatEvent((ev) => {
            if (ev.id !== chat.id) return
            if (ev.type === 'done' || ev.type === 'error') {
              off()
              resolve()
            }
          })
        })

        const updatedChanges = await api.ai.changes.list(projectId)
        const pendingList = updatedChanges.filter((c) => c.status === 'pending')
        if (pendingList.length > 0) {
          currentProposed = pendingList[pendingList.length - 1]
          addLog(
            `✓ AI đề xuất bản vá: "${currentProposed.summary}" trên ${currentProposed.file} (+${currentProposed.added}/−${currentProposed.removed})`,
          )
        } else {
          addLog(`⚠️ AI không gọi tool apply_patch để tạo bản vá.`)
        }
      } catch (err) {
        addLog(`⚠️ Lỗi khi AI phân tích: ${(err as Error).message}`)
      }

      if (killSwitchRef.current) break

      // BƯỚC 2: APPLY (Áp dụng & Ghi snapshot dự phòng)
      if (currentProposed) {
        setLoopStage('applying')
        const safe = isSafeErrorChange(parsedError, currentProposed)
        addLog(`[2/4 Apply] Đánh giá an toàn: ${safe ? 'Lỗi an toàn (Environment/Format)' : 'Thay đổi logic'}`)

        if (autoApproveSafeErrors && safe) {
          const audit = `[AUTO-APPROVE] Tự động duyệt an toàn cho ${currentProposed.file}: "${currentProposed.summary}"`
          setAutoApproveLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${audit}`])
          addLog(`✓ ${audit}`)
        } else {
          addLog(`✓ Áp dụng bản vá vào ${currentProposed.file} (đã ghi snapshot dự phòng trước khi sửa).`)
        }

        try {
          await api.ai.changes.accept(projectId, currentProposed.id)
          setAppliedChangeIds((prev) => [...prev, currentProposed!.id])
          onApplied?.()
        } catch (applyErr) {
          addLog(`❌ Không áp dụng được bản vá: ${(applyErr as Error).message}`)
        }
      } else {
        addLog(`Không có bản vá hợp lệ để áp dụng ở lần thử ${attempt}.`)
      }

      if (killSwitchRef.current) break

      // BƯỚC 3: BUILD (Biên dịch lại kiểm tra)
      setLoopStage('building')
      addLog(`[3/4 Build] Chạy lại lệnh build kiểm tra...`)
      let isOk = false
      let buildOutput = ''
      try {
        const bRes = await api.ai.tools.run({
          tool: 'run_build',
          projectPath,
          args: {},
        })
        isOk = !!bRes.ok
        buildOutput = bRes.output || bRes.error || ''
        if (isOk) {
          addLog(`✓ Build thành công! Mã thoát 0.`)
        } else {
          addLog(`❌ Build thất bại: ${bRes.error || 'Vẫn còn lỗi biên dịch'}`)
        }
      } catch (bErr) {
        isOk = false
        buildOutput = (bErr as Error).message
        addLog(`❌ Lỗi khi chạy lệnh build: ${buildOutput}`)
      }

      if (killSwitchRef.current) break

      // BƯỚC 4: VERIFY (Xác thực kết quả)
      setLoopStage('verifying')
      if (isOk) {
        success = true
        setLoopStage('success')
        addLog(`\n🎉 [4/4 Verify] SỬA THÀNH CÔNG LỖI BUILD Ở LẦN THỬ ${attempt}!`)
        onShowToast('ok', `🎉 Đã sửa thành công lỗi build sau lần thử ${attempt}!`)
        break
      } else {
        addLog(`[4/4 Verify] Lần thử ${attempt} chưa thành công.`)
        currentErrText = buildOutput.slice(-3000)
        attempt += 1
      }
    }

    if (!success) {
      if (killSwitchRef.current) {
        setLoopStage('aborted')
        addLog(`\n🛑 Vòng lặp tự sửa đã bị dừng bởi người dùng (Kill-switch).`)
        onShowToast('info', 'Đã kích hoạt Kill-switch dừng vòng lặp tự sửa.')
      } else {
        setLoopStage('failed')
        addLog(`\n❌ ĐÃ HẾT ${maxAttempts} LẦN THỬ TỰ ĐỘNG! DỪNG LẠI VÀ BÁO "CẦN NGƯỜI XEM".`)
        onShowToast('err', 'Đã hết 3 lần thử tự động nhưng chưa khắc phục được. Cần người xem!')
      }
    }

    setLoopActive(false)
    await loadChanges()
  }

  /**
   * Dừng khẩn cấp (Kill-switch)
   */
  const handleStopLoop = () => {
    killSwitchRef.current = true
    if (activeChatId.current) {
      void api.ai.cancel(activeChatId.current).catch(() => {})
      activeChatId.current = null
    }
    setLoopActive(false)
    setLoopStage('aborted')
    setLoopLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] 🛑 Kill-switch: Đã dừng vòng lặp ngay lập tức.`,
    ])
    onShowToast('info', 'Đã kích hoạt Kill-switch dừng vòng lặp.')
  }

  /**
   * Rollback toàn bộ các thay đổi trong phiên tự sửa về snapshot ban đầu
   */
  const handleRollback = async () => {
    if (appliedChangeIds.length === 0 || !projectId) {
      onShowToast('info', 'Không có thay đổi nào để rollback.')
      return
    }
    try {
      for (const chgId of [...appliedChangeIds].reverse()) {
        await api.ai.changes.undo(projectId, chgId)
      }
      setAppliedChangeIds([])
      onApplied?.()
      onShowToast('ok', 'Đã rollback thành công toàn bộ mã nguồn về snapshot ban đầu!')
      setLoopLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ↩ Đã rollback thành công toàn bộ tệp về snapshot ban đầu!`,
      ])
      await loadChanges()
    } catch (err) {
      onShowToast('err', `Lỗi rollback: ${(err as Error).message}`)
    }
  }

  const fixStepsFor = (): AiStep[] => [
    { label: 'Đọc log và xác định lỗi', status: loopStage !== 'idle' ? 'done' : 'pending' },
    {
      label: 'AI đề xuất bản vá (apply_patch)',
      status: loopStage === 'proposing' ? 'running' : loopStage !== 'idle' ? 'done' : 'pending',
    },
    {
      label: 'Áp dụng thay đổi (ghi snapshot dự phòng)',
      status:
        loopStage === 'applying'
          ? 'running'
          : ['building', 'verifying', 'success'].includes(loopStage)
            ? 'done'
            : 'pending',
    },
    {
      label: 'Chạy lại build và xác thực (Exit code 0)',
      status:
        ['building', 'verifying'].includes(loopStage)
          ? 'running'
          : loopStage === 'success'
            ? 'done'
            : loopStage === 'failed'
              ? 'failed'
              : 'pending',
    },
  ]

  const providerName = status?.provider === 'ollama' ? 'Ollama Local' : 'OpenAI-compatible'
  const configured = Boolean(status?.configured)
  const activeCli = detectedClis.find((cli) => cli.id === selectedCli?.id)
  const cliReady = activeBridge === 'cli' && Boolean(activeCli?.installed && activeCli?.supportsRun)

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
            ref={bridgeBtnRef}
            className={`pm-ai-bridge__btn is-${bridges.find((b) => b.kind === activeBridge)?.status || (configured ? 'online' : 'offline')}`}
            onClick={() => {
              void refreshBridges()
              void scanLocalClis()
              if (selectedCli) void loadCliModels(selectedCli.id)
              updateBridgePos()
              setBridgeOpen((v) => !v)
            }}
            title="Đổi Cầu nối AI (API, IDE WebSocket, CLI, Ollama)"
          >
            <span
              className={`pm-ai-dot is-${bridges.find((b) => b.kind === activeBridge)?.status || (configured ? 'online' : 'offline')}`}
            />
            <span>
              {activeBridge === 'ide'
                ? 'IDE WebSocket'
                : activeBridge === 'cli'
                  ? selectedCli
                    ? `CLI · ${detectedClis.find((cli) => cli.id === selectedCli.id)?.name ?? selectedCli.id}`
                    : 'CLI Bridge'
                  : activeBridge === 'ollama'
                    ? 'Ollama Local'
                    : status?.model || providerName}
            </span>
            <ChevronDown size={11} />
          </button>
          {bridgeOpen &&
            createPortal(
              <>
                <div
                  className="pm-ai-popover__scrim"
                  style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'transparent' }}
                  onClick={() => setBridgeOpen(false)}
                />
                <div
                  className="pm-ai-bridge__menu"
                  style={{
                    position: 'fixed',
                    top: bridgePos.top,
                    right: bridgePos.right,
                    zIndex: 99999,
                  }}
                >
                {/* 1. Chọn Cầu nối AI */}
                <div className="pm-ai-bridge__menu-hd">
                  Cầu nối AI · Chọn cầu nối (1-Click)
                </div>
                {bridges.map((b) => (
                  <button
                    key={b.kind}
                    className={`pm-ai-bridge__item ${activeBridge === b.kind ? 'is-active' : ''}`}
                    onClick={() => void handleSelectBridge(b.kind)}
                  >
                    <span className={`pm-ai-dot is-${b.status}`} />
                    <span className="pm-ai-bridge__item-main">
                      <b>{b.name}</b>
                      <span>{b.detail || (b.status === 'online' ? 'Sẵn sàng' : 'Ngoại tuyến')}</span>
                    </span>
                    {activeBridge === b.kind && <Check size={12} />}
                  </button>
                ))}

                {/* 2. Nhập nhanh API Key (học theo Open Design / Cursor) */}
                <div className="pm-ai-bridge__key-box">
                  <div className="pm-ai-bridge__key-title">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Key size={11} style={{ color: 'var(--accent, #6d5df5)' }} />
                      <span>Khoá API (OpenAI / Gemini / AI Studio)</span>
                    </span>
                    {status?.key.present && (
                      <span style={{ fontSize: 9.5, color: 'var(--ok, #79dcab)', fontWeight: 600 }}>
                        ✓ {status.key.masked}
                      </span>
                    )}
                  </div>
                  <div className="pm-ai-bridge__key-row">
                    <input
                      type="password"
                      placeholder={
                        status?.key.present
                          ? 'Nhập khoá mới để thay đổi...'
                          : 'Dán khoá API (sk-... hoặc AQ...)...'
                      }
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleSaveApiKey()
                      }}
                    />
                    <button
                      onClick={() => void handleSaveApiKey()}
                      disabled={isSavingKey || !apiKeyInput.trim()}
                    >
                      {isSavingKey ? '...' : 'Lưu'}
                    </button>
                  </div>
                  <div className="pm-ai-bridge__key-hint">
                    Lưu tự động vào máy (<code>pixelmind.env</code>), không gửi ra ngoài.
                  </div>
                </div>

                {/* 3. Quét & Sử dụng CLI Agents trên máy */}
                <div
                  className="pm-ai-bridge__menu-hd"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Terminal size={11} />
                    <span>CLI trên máy ({detectedClis.filter((c) => c.installed).length} sẵn sàng)</span>
                  </span>
                  <button
                    className="btn xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      void scanLocalClis()
                    }}
                    disabled={scanningClis}
                    style={{ fontSize: 9.5, padding: '1px 6px', height: 18 }}
                  >
                    <RefreshCw size={9} className={scanningClis ? 'pm-spin' : ''} /> Quét
                  </button>
                </div>
                <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                  {detectedClis.length === 0 ? (
                    <div style={{ padding: '6px 8px', fontSize: 10, color: 'var(--text-3)', textAlign: 'center' }}>
                      Đang quét các lệnh CLI...
                    </div>
                  ) : (
                    detectedClis.map((cli) => {
                      const runnable = cli.installed && cli.supportsRun
                      const isSelected = selectedCli?.id === cli.id && activeBridge === 'cli'
                      const authLabel =
                        cli.auth === 'ok'
                          ? 'đã đăng nhập'
                          : cli.auth === 'missing'
                            ? 'chưa đăng nhập'
                            : ''
                      const detail = cli.installed
                        ? [cli.version ? `v${cli.version}` : '', authLabel]
                            .filter(Boolean)
                            .join(' · ') || 'Sẵn sàng'
                        : cli.note
                          ? 'Lệnh không chạy được'
                          : 'Chưa cài đặt'
                      return (
                        <button
                          key={cli.id}
                          className={`pm-ai-bridge__item ${isSelected ? 'is-active' : ''}`}
                          style={{
                            opacity: cli.installed ? (cli.supportsRun ? 1 : 0.6) : 0.4,
                            cursor: runnable ? 'pointer' : 'default',
                            padding: '5px 8px',
                          }}
                          onClick={() => void selectCli(cli)}
                          title={
                            cli.installed
                              ? `${cli.description}\nĐường dẫn: ${cli.path || cli.binary}${
                                  cli.supportsRun ? '' : '\nChưa hỗ trợ chạy từ chatbox'
                                }`
                              : cli.note
                                ? `${cli.description}\n${cli.note}\nĐường dẫn: ${cli.path || cli.binary}`
                                : 'Chưa cài đặt trên máy'
                          }
                        >
                          <span
                            className={`pm-ai-dot is-${
                              runnable ? 'local' : cli.installed ? 'offline' : 'offline'
                            }`}
                          />
                          <span className="pm-ai-bridge__item-main">
                            <b>{cli.name}</b>
                            <span>{detail}</span>
                          </span>
                          {isSelected && <Check size={12} />}
                          {!isSelected && cli.installed && (
                            <span
                              className={`pm-ai-badge ${runnable ? 'is-done' : ''}`}
                              style={{ fontSize: 8.5 }}
                            >
                              {runnable ? 'Dùng' : 'Chỉ quét'}
                            </span>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>

                {/* 4. Chọn model cho CLI đang dùng */}
                {activeBridge === 'cli' && selectedCli && (
                  <div className="pm-ai-bridge__key-box">
                    <div className="pm-ai-bridge__key-title">
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Cpu size={11} style={{ color: 'var(--accent)' }} />
                        <span>Model cho {selectedCli.id}</span>
                      </span>
                      {loadingModels && (
                        <span style={{ fontSize: 9.5, color: 'var(--text-3)' }}>Đang tải…</span>
                      )}
                    </div>
                    <div className="pm-ai-bridge__key-row">
                      <select
                        value={selectedCli.model ?? ''}
                        onChange={(e) =>
                          setSelectedCli((prev) =>
                            prev ? { ...prev, model: e.target.value || undefined } : prev,
                          )
                        }
                        title="Model truyền xuống CLI (để trống = mặc định của CLI)"
                      >
                        <option value="">Mặc định của CLI</option>
                        {cliModels.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="pm-ai-bridge__key-hint">
                      Skills được stage tự động vào <code>.pixelmind/skills</code>; MCP server
                      cấu hình trong <code>.pixelmind/mcp.json</code>.
                    </div>
                  </div>
                )}

                {/* 4. Link Cài đặt AI */}
                {onOpenSettings && (
                  <button
                    className="pm-ai-bridge__item"
                    style={{ marginTop: 4, borderTop: '1px solid var(--border)' }}
                    onClick={() => {
                      setBridgeOpen(false)
                      onOpenSettings()
                    }}
                  >
                    <span className="pm-ai-bridge__item-main">
                      <b>Mở Cài đặt AI chi tiết…</b>
                      <span>Provider, base URL, model, kiểm tra kết nối</span>
                    </span>
                  </button>
                )}
              </div>
            </>,
            document.body,
          )}
        </div>
        <button
          className="pm-ibtn pm-ibtn--danger"
          style={{ color: '#ef4444', marginRight: 4 }}
          onClick={() => void handleKillSwitch()}
          title="Dừng khẩn cấp: Huỷ toàn bộ tác vụ AI, child process và luồng streaming (Kill-switch)"
        >
          <Octagon size={14} strokeWidth={2.2} />
        </button>
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
                ? (parsedError || errorLog ? 1 : 0)
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

      <div className={`pm-ai-preview-note ${cliReady || configured ? 'is-ok' : ''}`}>
        <ShieldCheck size={11} />
        {cliReady
          ? `CLI ${activeCli?.name}${activeCli?.version ? ` ${activeCli.version}` : ''} · không cần API key · thay đổi phải được duyệt`
          : configured
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
                      {thinking && message.id === assistantId.current && (
                        <div className="pm-ai-live">
                          <RefreshCw size={11} className="pm-spin" />
                          <span className="pm-ai-live__text">
                            {liveStatus?.text || 'Đang xử lý…'}
                          </span>
                          <span className="pm-ai-live__time">{elapsed}s</span>
                        </div>
                      )}
                      {message.text ? (
                        <AiMessageContent text={message.text} isUser={message.role === 'user'} />
                      ) : null}
                    </div>
                    {message.plan && message.plan.length > 0 && (
                      <div className="pm-ai-steps is-compact" style={{ marginTop: 8 }}>
                        {message.plan.map((s) => (
                          <div key={s.id} className={`pm-ai-step is-${s.status}`}>
                            <span className="pm-ai-step__icon">
                              {s.status === 'done' && <Check size={11} strokeWidth={2.5} />}
                              {s.status === 'running' && (
                                <RefreshCw size={11} className="is-spinning" />
                              )}
                              {s.status === 'failed' && <AlertTriangle size={11} />}
                              {s.status === 'pending' && <CircleDot size={11} />}
                            </span>
                            <span className="pm-ai-step__label">{s.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <span className="pm-ai-msg__time">{message.time}</span>
                  </div>
                </div>
              ))}

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
                  cliReady
                    ? `Nhập yêu cầu cho ${activeCli?.name ?? 'CLI'}… (Enter để gửi)`
                    : configured
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
            <div className="pm-ai-list__hd" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="pm-ai-seg">
                <button
                  type="button"
                  className={tasksSubTab === 'tools' ? 'is-active' : ''}
                  onClick={() => setTasksSubTab('tools')}
                >
                  Công cụ Tool ({toolLogs.length})
                </button>
                <button
                  type="button"
                  className={tasksSubTab === 'audit' ? 'is-active' : ''}
                  onClick={() => setTasksSubTab('audit')}
                >
                  Audit Log ({auditLogs.length})
                </button>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {tasksSubTab === 'audit' && auditLogs.length > 0 && (
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() => void handleClearAudit()}
                    title="Xoá nhật ký audit"
                    style={{ fontSize: 10, color: 'var(--text-3)' }}
                  >
                    Xoá log
                  </button>
                )}
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={() => {
                    if (tasksSubTab === 'tools') void loadToolLogs()
                    else void loadAuditLogs()
                  }}
                  title="Làm mới"
                  style={{ gap: 4 }}
                >
                  <RefreshCw size={11} /> Làm mới
                </button>
              </div>
            </div>

            {tasksSubTab === 'tools' ? (
              toolLogs.length === 0 ? (
                <div className="pm-ai-empty" style={{ padding: '36px 16px', textAlign: 'center' }}>
                  <ListChecks size={26} style={{ color: 'var(--text-3)', margin: '0 auto 8px' }} />
                  <b>Chưa có tác vụ AI nào</b>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '4px 0 0', lineHeight: 1.5 }}>
                    Khi bạn yêu cầu AI sửa lỗi, chạy lệnh build hoặc thay đổi mã nguồn, các tác vụ thực tế sẽ được tự động ghi nhận tại đây.
                  </p>
                </div>
              ) : (
                toolLogs.map((entry) => (
                  <div key={entry.id} className={`pm-ai-task is-${entry.ok ? 'done' : 'failed'}`}>
                    <div className="pm-ai-task__hd">
                      <span className="pm-ai-task__title">
                        <b>{entry.tool}</b> · {entry.summary}
                      </span>
                      <span className={`pm-ai-status is-${entry.ok ? 'done' : 'failed'}`}>
                        {entry.ok ? 'Hoàn tất' : 'Thất bại'}
                      </span>
                    </div>
                    {entry.args && (
                      <p className="pm-ai-task__detail" style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5 }}>
                        {entry.args}
                      </p>
                    )}
                    <div className="pm-ai-task__ft">
                      <span className="pm-ai-muted">
                        {new Date(entry.at).toLocaleTimeString()} ({entry.durationMs}ms)
                      </span>
                    </div>
                  </div>
                ))
              )
            ) : auditLogs.length === 0 ? (
              <div className="pm-ai-empty" style={{ padding: '36px 16px', textAlign: 'center' }}>
                <ShieldCheck size={26} style={{ color: 'var(--text-3)', margin: '0 auto 8px' }} />
                <b>Chưa có nhật ký audit nào</b>
                <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '4px 0 0', lineHeight: 1.5 }}>
                  Mọi hành động nhạy cảm (gọi công cụ, áp dụng patch, đổi bridge, lệnh dừng khẩn cấp) đều được lưu trữ kiểm toán tại đây.
                </p>
              </div>
            ) : (
              auditLogs.map((entry) => (
                <div key={entry.id} className={`pm-ai-task is-${entry.ok ? 'done' : 'failed'}`}>
                  <div className="pm-ai-task__hd">
                    <span className="pm-ai-task__title">
                      <b
                        style={{
                          color:
                            entry.type === 'kill_switch'
                              ? '#ef4444'
                              : entry.type === 'bridge'
                                ? '#a855f7'
                                : entry.type === 'cli'
                                  ? '#3b82f6'
                                  : 'var(--fg)',
                        }}
                      >
                        [{entry.type.toUpperCase()}]
                      </b>{' '}
                      {entry.summary}
                    </span>
                    <span className={`pm-ai-status is-${entry.ok ? 'done' : 'failed'}`}>
                      {entry.ok ? 'OK' : 'Lỗi'}
                    </span>
                  </div>
                  {entry.detail && (
                    <p className="pm-ai-task__detail" style={{ fontSize: 9.5 }}>
                      {entry.detail}
                    </p>
                  )}
                  <div className="pm-ai-task__ft">
                    <span className="pm-ai-muted">
                      {new Date(entry.at).toLocaleTimeString()}
                      {entry.durationMs ? ` · ${entry.durationMs}ms` : ''}
                    </span>
                  </div>
                </div>
              ))
            )}
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
                  <span>{getContextDetail(item.id)}</span>
                </span>
                <span className="pm-ai-muted">
                  {pack ? (pack.dropped.includes(item.id) ? 'lược bớt' : 'đã gói') : 'sẵn sàng'}
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
          </div>
        )}

        {tab === 'errors' && (
          <div className="pm-ai-list">
            <div className="pm-ai-list__hd">
              <span>Lỗi biên dịch &amp; Vòng lặp tự sửa</span>
              <span className="pm-ai-muted">Tối đa 3 lần thử · Snapshot · Rollback</span>
            </div>

            {/* ── Thẻ lỗi build thật từ errorParser ── */}
            {parsedError ? (
              <div className="pm-ai-error">
                <div className="pm-ai-error__hd">
                  <span className="pm-ai-error__icon is-error">
                    <AlertTriangle size={14} />
                  </span>
                  <b>{parsedError.title}</b>
                  <span className="pm-ai-status is-failed">{parsedError.type}</span>
                </div>
                {parsedError.file && (
                  <div className="pm-ai-error__file">
                    <FileCode2 size={11} /> {parsedError.file}
                    {parsedError.line ? `:${parsedError.line}` : ''}
                  </div>
                )}
                <p className="pm-ai-error__msg">{parsedError.summary}</p>
                <div className="pm-ai-context-note" style={{ fontSize: 10 }}>
                  <Sparkles size={11} /> Gợi ý: {parsedError.recommendation}
                </div>
              </div>
            ) : errorLog ? (
              <div className="pm-ai-error">
                <div className="pm-ai-error__hd">
                  <span className="pm-ai-error__icon is-error">
                    <AlertTriangle size={14} />
                  </span>
                  <b>Nhật ký lỗi tiến trình</b>
                </div>
                <pre
                  className="pm-ai-error__msg"
                  style={{ maxHeight: 100, overflowY: 'auto', whiteSpace: 'pre-wrap' }}
                >
                  {errorLog}
                </pre>
              </div>
            ) : (
              <div className="pm-ai-empty" style={{ padding: '24px 12px', textAlign: 'center' }}>
                <CheckCircle2 size={24} style={{ color: 'var(--ok, #79dcab)', margin: '0 auto 8px' }} />
                <b>Không phát hiện lỗi build</b>
                <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '4px 0 0' }}>
                  Hệ thống đang hoạt động ổn định hoặc chưa chạy lệnh build.
                </p>
              </div>
            )}

            {/* ── Bảng điều khiển vòng lặp tự sửa lỗi (Chặng 4) ── */}
            <div className="pm-ai-loop-box">
              <div className="pm-ai-loop-box__hd">
                <Wand2 size={13} style={{ color: 'var(--accent, #6d5df5)' }} />
                <span>Vòng lặp tự sửa (Propose → Apply → Build → Verify)</span>
              </div>

              {/* Tùy chọn: Tự động duyệt lỗi an toàn (Môi trường & Format) */}
              <label
                className="pm-ai-scope"
                title="Tự động áp dụng các sửa đổi an toàn như thiếu package, cổng mạng hoặc định dạng code mà không cần hỏi lại. Logic nghiệp vụ luôn yêu cầu xác nhận."
              >
                <input
                  type="checkbox"
                  checked={autoApproveSafeErrors}
                  onChange={(e) => setAutoApproveSafeErrors(e.target.checked)}
                  disabled={loopActive}
                />
                <span>Tự động duyệt lỗi an toàn (Môi trường / Thư viện / Format)</span>
              </label>

              {/* Thanh tiến trình các bước */}
              {loopActive && (
                <div style={{ marginTop: 4 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 10.5,
                      fontWeight: 600,
                      marginBottom: 6,
                    }}
                  >
                    <span className="pm-ai-badge is-previewing">
                      Lần thử {loopAttempt}/3
                    </span>
                    <span style={{ color: 'var(--text-2)' }}>
                      {loopStage === 'proposing' && 'Đang yêu cầu AI đề xuất bản vá...'}
                      {loopStage === 'applying' && 'Đang áp dụng thay đổi & ghi snapshot...'}
                      {loopStage === 'building' && 'Đang chạy lại lệnh build...'}
                      {loopStage === 'verifying' && 'Đang xác thực kết quả biên dịch...'}
                    </span>
                  </div>
                  <StepTimeline steps={fixStepsFor()} />
                </div>
              )}

              {/* Nhật ký console vòng lặp */}
              {loopLogs.length > 0 && (
                <div className="pm-ai-loop-logs">
                  {loopLogs.map((log, idx) => (
                    <div key={idx}>{log}</div>
                  ))}
                </div>
              )}

              {/* Nhật ký Audit Log tự động duyệt an toàn */}
              {autoApproveLogs.length > 0 && (
                <div
                  style={{
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                  }}
                >
                  <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--ok, #79dcab)', marginBottom: 4 }}>
                    ✓ Nhật ký tự động duyệt an toàn (Audit Log):
                  </div>
                  <div className="pm-ai-audit-list">
                    {autoApproveLogs.map((log, idx) => (
                      <div key={idx}>{log}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Nút hành động */}
              <div className="pm-ai-error__ft" style={{ marginTop: 4 }}>
                {!loopActive ? (
                  <>
                    <button
                      className="btn sm primary"
                      onClick={() => void runAutoFixLoop()}
                      disabled={!parsedError && !errorLog}
                      title="Bắt đầu vòng lặp AI tự động phân tích và sửa lỗi tối đa 3 lần"
                      style={{
                        fontWeight: 600,
                        gap: 5,
                      }}
                    >
                      <Wand2 size={12} />
                      <span>Nhờ AI sửa (Tối đa 3 lần)</span>
                    </button>

                    {appliedChangeIds.length > 0 && (
                      <button
                        className="btn sm"
                        onClick={() => void handleRollback()}
                        title="Khôi phục toàn bộ các tệp về trạng thái snapshot ban đầu"
                        style={{ gap: 4, color: '#f59e0b' }}
                      >
                        <RotateCcw size={11} /> Rollback
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    className="btn sm"
                    onClick={handleStopLoop}
                    title="Dừng ngay lập tức vòng lặp tự sửa lỗi"
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      borderColor: 'rgba(239, 68, 68, 0.4)',
                      color: '#ef4444',
                      fontWeight: 600,
                      gap: 5,
                    }}
                  >
                    <Octagon size={12} fill="currentColor" /> Dừng (Kill-switch)
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── CHẶNG 8: BẢO MẬT, GUARDRAILS, AUDIT & NGÂN SÁCH CHI PHÍ ── */}
        {tab === 'security' && (
          <div className="pm-ai-list">
            <div className="pm-ai-list__hd">
              <span>Bảo mật, Guardrails &amp; Chi phí</span>
              <span className="pm-ai-muted">Zero Trust · Human-in-the-Loop</span>
            </div>

            {/* ── 1. Thống kê Chi phí & Hạn mức Token (Token Budget) ── */}
            <div className="pm-ai-loop-box" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 650, fontSize: 12 }}>
                  <ShieldCheck size={14} style={{ color: 'var(--accent, #6d5df5)' }} />
                  <span>Ngân sách &amp; Chi phí Token</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {!isEditingBudget ? (
                    <button
                      className="btn xs"
                      onClick={() => setIsEditingBudget(true)}
                      style={{ fontSize: 10, padding: '2px 8px' }}
                    >
                      Đổi hạn mức
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input
                        type="number"
                        value={budgetInput}
                        onChange={(e) => setBudgetInput(e.target.value)}
                        style={{ width: 70, fontSize: 11, padding: '2px 4px', borderRadius: 4, border: '1px solid var(--border)' }}
                      />
                      <button className="btn xs primary" onClick={() => void handleUpdateBudget()} style={{ fontSize: 10 }}>
                        Lưu
                      </button>
                      <button className="btn xs" onClick={() => setIsEditingBudget(false)} style={{ fontSize: 10 }}>
                        Huỷ
                      </button>
                    </div>
                  )}
                  <button
                    className="btn xs"
                    onClick={() => void handleResetCost()}
                    title="Đặt lại số liệu token đã dùng"
                    style={{ fontSize: 10, padding: '2px 8px', color: 'var(--text-3)' }}
                  >
                    Đặt lại
                  </button>
                </div>
              </div>

              {/* Thanh tiến trình ngân sách */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-2)', marginBottom: 4 }}>
                  <span>
                    Đã dùng <b>{costStats?.totalTokens.toLocaleString() ?? 0}</b> / {costStats?.budgetTokens.toLocaleString() ?? '100,000'} tokens
                  </span>
                  <span style={{ fontWeight: 700, color: (costStats?.percentageUsed ?? 0) > 90 ? '#ef4444' : (costStats?.percentageUsed ?? 0) > 70 ? '#f59e0b' : 'var(--ok, #79dcab)' }}>
                    {costStats?.percentageUsed ?? 0}%
                  </span>
                </div>
                <div style={{ width: '100%', height: 6, background: 'var(--panel-2, rgba(255,255,255,0.06))', borderRadius: 3, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, costStats?.percentageUsed ?? 0)}%`,
                      background: (costStats?.percentageUsed ?? 0) > 90
                        ? '#ef4444'
                        : (costStats?.percentageUsed ?? 0) > 70
                          ? '#f59e0b'
                          : 'var(--accent, #6d5df5)',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>

              {/* Chi tiết Prompt / Completion & USD */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 10.5 }}>
                <div style={{ padding: '6px 8px', borderRadius: 6, background: 'var(--panel-2, rgba(255,255,255,0.04))' }}>
                  <div style={{ color: 'var(--text-3)', fontSize: 9.5 }}>Prompt (Input)</div>
                  <div style={{ fontWeight: 650, marginTop: 2 }}>{costStats?.promptTokens.toLocaleString() ?? 0}</div>
                </div>
                <div style={{ padding: '6px 8px', borderRadius: 6, background: 'var(--panel-2, rgba(255,255,255,0.04))' }}>
                  <div style={{ color: 'var(--text-3)', fontSize: 9.5 }}>Completion (Output)</div>
                  <div style={{ fontWeight: 650, marginTop: 2 }}>{costStats?.completionTokens.toLocaleString() ?? 0}</div>
                </div>
                <div style={{ padding: '6px 8px', borderRadius: 6, background: 'var(--panel-2, rgba(255,255,255,0.04))' }}>
                  <div style={{ color: 'var(--text-3)', fontSize: 9.5 }}>Ước tính ($ USD)</div>
                  <div style={{ fontWeight: 650, marginTop: 2, color: 'var(--accent, #6d5df5)' }}>
                    ${costStats?.estimatedCostUsd ?? 0}
                  </div>
                </div>
              </div>
            </div>

            {/* ── 2. Trạng thái Guardrails & Phòng vệ ── */}
            <div className="pm-ai-loop-box" style={{ padding: 12 }}>
              <div style={{ fontWeight: 650, fontSize: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={13} style={{ color: 'var(--ok, #79dcab)' }} />
                <span>Quy tắc Guardrails đang kích hoạt</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>🛡️ Chống Prompt Injection từ DOM/file</span>
                  <span className="pm-ai-badge is-done">Kích hoạt</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>📁 Path Allowlist &amp; Chặn bí mật (.env, .git, keys)</span>
                  <span className="pm-ai-badge is-done">Kích hoạt</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>🔒 Tự động che giấu khoá API &amp; Bearer Tokens</span>
                  <span className="pm-ai-badge is-done">Kích hoạt</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>✍️ Mọi sửa đổi mã nguồn đều tạo Diff chờ duyệt</span>
                  <span className="pm-ai-badge is-done">Kích hoạt</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>🔄 Tự động thử lại khi gặp File Lock (dotnet watch)</span>
                  <span className="pm-ai-badge is-done">Kích hoạt</span>
                </div>
              </div>
            </div>

            {/* ── 3. Nhật ký Thao tác AI (Audit Log) ── */}
            <div className="pm-ai-loop-box" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 650, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <History size={13} />
                  <span>Nhật ký Thao tác &amp; Kiểm toán ({auditLogs.length} bản ghi)</span>
                </div>
                <button
                  type="button"
                  className="btn xs ghost"
                  onClick={() => {
                    setTab('tasks')
                    setTasksSubTab('audit')
                  }}
                  style={{ fontSize: 10, gap: 4 }}
                >
                  Xem chi tiết <ChevronRight size={10} />
                </button>
              </div>
            </div>

            {/* ── 4. Tài liệu Onboarding ── */}
            <div
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                background: 'rgba(109, 93, 245, 0.08)',
                border: '1px solid rgba(109, 93, 245, 0.2)',
                fontSize: 11,
                color: 'var(--text-2)',
                lineHeight: 1.4,
              }}
            >
              📖 Xem tài liệu đầy đủ về kiến trúc bảo mật và hướng dẫn cho người mới tại:
              <br />
              <code style={{ fontSize: 10, color: 'var(--accent, #6d5df5)', fontWeight: 600 }}>docs/AI_SECURITY_AND_ONBOARDING.md</code>
            </div>
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
        <span
          className="pm-ai-model"
          title={cliReady ? 'Model CLI đang dùng' : 'Model của AI Gateway đang cấu hình'}
        >
          <Cpu size={11} />
          {cliReady ? selectedCli?.model ?? 'mặc định CLI' : status?.model ?? 'chưa cấu hình'}
        </span>
        <span className={`pm-ai-dot is-${cliReady ? 'local' : configured ? 'online' : 'offline'}`} />
      </div>
    </aside>
  )
}

export default AIPanel
