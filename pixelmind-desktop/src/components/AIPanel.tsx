import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  Atom,
  BoxSelect,
  Bug,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Copy,
  Cpu,
  EllipsisVertical,
  FileCode2,
  Folder,
  FolderPlus,
  History,
  Image as ImageIcon,
  Layers,
  ListChecks,
  MessageSquare,
  Octagon,
  Palette,
  PanelLeft,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Terminal,
  Trash2,
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
  AiChatEntry,
  AiContextPack,
  AiContextResult,
  AiConversationSummary,
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

export interface AiAttachment {
  id: string
  type: 'file' | 'folder' | 'image' | 'element' | 'area'
  name: string
  path?: string
  dataUrl?: string
  size?: number
  content?: string
  tag?: string
  selector?: string
  count?: number
  elements?: Array<{
    tag: string
    id?: string
    className?: string
    text?: string
    selector?: string
    outerHTML?: string
  }>
}

interface AiChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  time: string
  at?: number
  failed?: boolean
  plan?: AiPlanStep[]
  attachments?: AiAttachment[]
}

export interface AiUndoItem {
  file: string
  added: number
  removed: number
  changeId?: string
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
  { id: 'logs', label: 'Nhật ký lỗi build gần nhất', checked: true },
  { id: 'project', label: 'Chỉ mục tệp toàn bộ dự án', checked: true },
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

const formatRelativeOrTime = (at?: number, fallback?: string) => {
  if (!at) return fallback || ''
  const diffSec = Math.floor((Date.now() - at) / 1000)
  if (diffSec < 60) return 'Vừa xong'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`
  return fallback || timeOf(at)
}

/** Tuổi hội thoại kiểu danh sách chat: 15h, 4d... */
const conversationAge = (at: number): string => {
  if (!at) return ''
  const diffMin = Math.max(1, Math.floor((Date.now() - at) / 60_000))
  if (diffMin < 60) return `${diffMin}m`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h`
  return `${Math.floor(diffHour / 24)}d`
}

let conversationSeq = 0
const newConversationId = (): string =>
  `conv-${Date.now().toString(36)}-${(conversationSeq++).toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`

const renderFileBadge = (file: string) => {
  const ext = file.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'ts') {
    return <span className="pm-ai-undo-file-badge is-ts">TS</span>
  }
  if (ext === 'tsx' || ext === 'jsx') {
    return (
      <span className="pm-ai-undo-file-badge is-tsx" title="React">
        <Atom size={13} style={{ color: '#38bdf8' }} />
      </span>
    )
  }
  if (ext === 'css' || ext === 'scss' || ext === 'less') {
    return <span className="pm-ai-undo-file-badge is-css">&#123;&#125;</span>
  }
  if (ext === 'js') {
    return <span className="pm-ai-undo-file-badge is-js">JS</span>
  }
  if (ext === 'cs') {
    return <span className="pm-ai-undo-file-badge is-cs">C#</span>
  }
  if (ext === 'html' || ext === 'cshtml' || ext === 'razor') {
    return <span className="pm-ai-undo-file-badge is-code">&lt;&gt;</span>
  }
  return (
    <span className="pm-ai-undo-file-badge is-code">
      <FileCode2 size={12} />
    </span>
  )
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
      {change.status === 'accepted' && (
        <button
          className="btn sm pm-ai-diff__undo-btn"
          onClick={(e) => {
            e.stopPropagation()
            onUndo(change.id)
          }}
          disabled={busy}
          title="Hoàn tác thay đổi này về trạng thái trước đó"
        >
          <Undo2 size={11} /> Hoàn tác
        </button>
      )}
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
      <span className="pm-ai-diff__reason">{change.summary || 'Thay đổi mã nguồn'}</span>
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
        <button
          className="btn sm pm-ai-diff__undo-ft-btn"
          onClick={() => onUndo(change.id)}
          disabled={busy}
          title="Hoàn tác thay đổi này về trạng thái trước đó"
        >
          <Undo2 size={11} /> Hoàn tác
        </button>
      )}
      {change.status === 'undone' && (
        <span className="pm-ai-diff__undone-msg">
          <Check size={11} /> Đã hoàn tác tệp
        </span>
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
  onShowToast: _onShowToast,
}: AIPanelProps) => {
  const [tab, setTab] = useState<AiTab>(initialTab || 'chat')
  const [chatNotice, setChatNotice] = useState<{
    id: number
    kind: 'ok' | 'info' | 'err'
    text: string
  } | null>(null)
  const noticeTimerRef = useRef<number | null>(null)

  const notifyChat = useCallback((kind: 'ok' | 'info' | 'err', text: string) => {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current)
    const id = Date.now() + Math.random()
    setChatNotice({ id, kind, text })
    noticeTimerRef.current = window.setTimeout(() => {
      setChatNotice((prev) => (prev?.id === id ? null : prev))
      noticeTimerRef.current = null
    }, 3200)
  }, [])

  useEffect(
    () => () => {
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current)
    },
    [],
  )

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
      notifyChat('err', 'Hạn mức ngân sách không hợp lệ')
      return
    }
    try {
      const updated = await api.ai.cost.setBudget(projectId, val)
      setCostStats(updated)
      setIsEditingBudget(false)
      notifyChat('ok', `Đã cập nhật hạn mức ngân sách: ${val.toLocaleString()} tokens`)
    } catch {
      notifyChat('err', 'Không thể lưu hạn mức ngân sách')
    }
  }

  const handleClearAudit = async () => {
    try {
      await api.ai.audit.clear(projectId)
      setAuditLogs([])
      notifyChat('ok', 'Đã xoá lịch sử thao tác AI')
    } catch {
      notifyChat('err', 'Không thể xoá lịch sử audit')
    }
  }

  const handleResetCost = async () => {
    try {
      await api.ai.cost.reset(projectId)
      void loadSecurityData()
      notifyChat('ok', 'Đã đặt lại bộ đếm token và chi phí')
    } catch {
      notifyChat('err', 'Không thể đặt lại chi phí')
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
      notifyChat('ok', `Đã chọn ${cli.name}`)
      void loadCliModels(cli.id)
    },
    [loadCliModels, notifyChat],
  )

  const handleSaveApiKey = async () => {
    const key = apiKeyInput.trim()
    if (!key) return
    setIsSavingKey(true)
    try {
      const res = await api.ai.saveKey(key)
      setApiKeyInput('')
      notifyChat('ok', `Đã lưu khoá API (${res.masked})!`)
      void refreshStatus()
      void refreshBridges()
    } catch (err) {
      notifyChat('err', `Lỗi lưu khoá: ${(err as Error).message}`)
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
      notifyChat('ok', `Đã chuyển sang ${updated.name} (${updated.status})`)
      void refreshStatus()
    } catch {
      notifyChat('err', 'Không thể đổi cầu nối AI')
    }
  }
  const [messages, setMessages] = useState<AiChatMessage[]>([])
  // ─── HỘI THOẠI (CONVERSATIONS) ───
  const [conversationId, setConversationId] = useState<string>(() => newConversationId())
  const [conversations, setConversations] = useState<AiConversationSummary[]>([])
  const [convListOpen, setConvListOpen] = useState(false)
  const [convMenuOpen, setConvMenuOpen] = useState(false)
  const [convLoading, setConvLoading] = useState(false)
  const [convError, setConvError] = useState<string | null>(null)
  const [convSort, setConvSort] = useState<'new' | 'old'>('new')
  const [convMenuPos, setConvMenuPos] = useState<{ top: number; right: number }>({
    top: 44,
    right: 10,
  })
  const convMenuBtnRef = useRef<HTMLButtonElement>(null)
  const convInitRef = useRef<string | null>(null)
  const [changes, setChanges] = useState<AiChange[]>([])
  const [undoTarget, setUndoTarget] = useState<{
    message: AiChatMessage
    index: number
    items: AiUndoItem[]
    affectedChanges: AiChange[]
  } | null>(null)
  const [revertFilesChecked, setRevertFilesChecked] = useState(true)
  const [undoing, setUndoing] = useState(false)
  const [toolLogs, setToolLogs] = useState<AiToolLogEntry[]>([])
  const [contexts, setContexts] = useState<ContextOption[]>(DEFAULT_CONTEXT_OPTIONS)
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const cliMutatedRef = useRef(false)
  const onAppliedRef = useRef(onApplied)
  onAppliedRef.current = onApplied
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

  // ─── ĐÍNH KÈM (ATTACHMENTS) & NÚT DẤU + ───
  const [attachments, setAttachments] = useState<AiAttachment[]>([])
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [waitingPickMode, setWaitingPickMode] = useState<'single' | 'area' | null>(null)
  const waitingPickModeRef = useRef(waitingPickMode)
  useEffect(() => {
    waitingPickModeRef.current = waitingPickMode
  }, [waitingPickMode])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const addBtnRef = useRef<HTMLButtonElement>(null)
  const addMenuRef = useRef<HTMLDivElement>(null)

  // Đóng popover menu dấu + khi nhấp chuột ra ngoài
  useEffect(() => {
    if (!addMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        addMenuRef.current &&
        !addMenuRef.current.contains(e.target as Node) &&
        addBtnRef.current &&
        !addBtnRef.current.contains(e.target as Node)
      ) {
        setAddMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [addMenuOpen])

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const newAtts: AiAttachment[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const filePath = (file as unknown as { path?: string }).path || file.name
      let content = ''
      try {
        content = await file.text()
      } catch {}
      newAtts.push({
        id: `file-${Date.now()}-${i}`,
        type: 'file',
        name: file.name,
        path: filePath,
        size: file.size,
        content: content.slice(0, 10000),
      })
    }
    setAttachments((prev) => [...prev, ...newAtts])
    e.target.value = ''
    setAddMenuOpen(false)
    notifyChat('ok', `Đã đính kèm ${newAtts.length} tệp`)
  }

  const handleFolderSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const firstPath = files[0].webkitRelativePath || ''
    const folderName = firstPath.split('/')[0] || 'Thư mục'
    const folderFullPath = (files[0] as unknown as { path?: string }).path
      ? (files[0] as unknown as { path: string }).path.replace(/[\\/][^\\/]+$/, '')
      : folderName
    setAttachments((prev) => [
      ...prev,
      {
        id: `folder-${Date.now()}`,
        type: 'folder',
        name: folderName,
        path: folderFullPath,
      },
    ])
    e.target.value = ''
    setAddMenuOpen(false)
    notifyChat('ok', `Đã đính kèm thư mục "${folderName}"`)
  }

  const handleImagesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const newAtts: AiAttachment[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const filePath = (file as unknown as { path?: string }).path || file.name
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })
      newAtts.push({
        id: `img-${Date.now()}-${i}`,
        type: 'image',
        name: file.name,
        path: filePath,
        dataUrl,
        size: file.size,
      })
    }
    setAttachments((prev) => [...prev, ...newAtts])
    e.target.value = ''
    setAddMenuOpen(false)
    notifyChat('ok', `Đã đính kèm ${newAtts.length} ảnh`)
  }

  const handlePickElement = () => {
    setWaitingPickMode('single')
    setAddMenuOpen(false)
    window.dispatchEvent(new CustomEvent('pixelmind:enable-inspect', { detail: { mode: 'single' } }))
    notifyChat('info', '✏️ Cây bút: Hãy nhấp vào 1 phần tử trên Canvas để đính kèm vào câu hỏi.')
  }

  const handlePickArea = () => {
    setWaitingPickMode('area')
    setAddMenuOpen(false)
    window.dispatchEvent(new CustomEvent('pixelmind:enable-inspect', { detail: { mode: 'area' } }))
    notifyChat('info', '⬚ Cây bút: Hãy kéo chuột khoanh 1 vùng trên Canvas để đính kèm các phần tử.')
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          const reader = new FileReader()
          reader.onload = () => {
            setAttachments((prev) => [
              ...prev,
              {
                id: `paste-img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                type: 'image',
                name: `Ảnh dán ${new Date().toLocaleTimeString('vi-VN')}`,
                dataUrl: reader.result as string,
                size: file.size,
              },
            ])
            notifyChat('ok', 'Đã dán ảnh từ clipboard vào câu hỏi!')
          }
          reader.readAsDataURL(file)
        }
      }
    }
  }

  useEffect(() => {
    const handleElementPicked = (e: Event) => {
      if (waitingPickModeRef.current !== 'single') return
      const payload = (e as CustomEvent).detail as {
        tagName?: string
        tag?: string
        id?: string
        className?: string
        selector?: string
        textSnippet?: string
        outerHTML?: string
      }
      if (!payload) return
      const tag = payload.tagName || payload.tag || 'element'
      const id = payload.id || ''
      const className = payload.className || ''
      const name = `<${tag}${id ? `#${id}` : className ? `.${className.split(' ')[0]}` : ''}>`
      setAttachments((prev) => [
        ...prev,
        {
          id: `el-${Date.now()}`,
          type: 'element',
          name,
          tag,
          selector: payload.selector || (id ? `#${id}` : tag),
          content: payload.textSnippet || payload.outerHTML || '',
        },
      ])
      setWaitingPickMode(null)
      notifyChat('ok', `Đã đính kèm phần tử ${name} vào câu hỏi!`)
    }

    const handleAreaPicked = (e: Event) => {
      if (waitingPickModeRef.current !== 'area') return
      const items = (e as CustomEvent).detail as Array<{
        tagName?: string
        id?: string
        className?: string
        textSnippet?: string
        selector?: string
        outerHTML?: string
      }>
      if (!Array.isArray(items) || items.length === 0) return
      const count = items.length
      const name = `Vùng khoanh (${count} phần tử)`
      setAttachments((prev) => [
        ...prev.filter((a) => a.type !== 'area'),
        {
          id: `area-${Date.now()}`,
          type: 'area',
          name,
          count,
          elements: items.map((it) => ({
            tag: it.tagName || 'div',
            id: it.id,
            className: it.className,
            text: it.textSnippet,
            selector: it.selector,
            outerHTML: it.outerHTML,
          })),
        },
      ])
      setWaitingPickMode(null)
      notifyChat('ok', `Đã đính kèm ${name} vào câu hỏi!`)
    }

    window.addEventListener('pixelmind:element-picked', handleElementPicked)
    window.addEventListener('pixelmind:area-picked', handleAreaPicked)
    return () => {
      window.removeEventListener('pixelmind:element-picked', handleElementPicked)
      window.removeEventListener('pixelmind:area-picked', handleAreaPicked)
    }
  }, [notifyChat])

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
      notifyChat('ok', `Dừng khẩn cấp: Đã dừng ${res.count} tiến trình AI`)
      void loadToolLogs()
      void loadAuditLogs()
    } catch (err) {
      notifyChat('err', `Lỗi dừng khẩn cấp: ${(err as Error).message}`)
    }
  }, [notifyChat, loadToolLogs, loadAuditLogs])

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
      const entries = await api.ai.chats.history(projectId, conversationId)
      setMessages(
        entries.map((entry) => ({
          id: entry.id,
          role: entry.role,
          text: entry.text,
          time: timeOf(entry.at),
          at: entry.at,
          plan: entry.plan,
        })),
      )
    } catch {
      setMessages([])
    }
  }, [projectId, conversationId])

  const loadConversations = useCallback(async (): Promise<AiConversationSummary[]> => {
    if (!projectId) {
      setConversations([])
      return []
    }
    setConvLoading(true)
    setConvError(null)
    try {
      if (typeof api.ai.chats.conversations !== 'function') {
        throw new Error('API hội thoại chưa sẵn sàng')
      }
      const list = await api.ai.chats.conversations(projectId)
      setConversations(list)
      return list
    } catch {
      setConversations([])
      setConvError('Không tải được danh sách hội thoại. Hãy khởi động lại ứng dụng.')
      return []
    } finally {
      setConvLoading(false)
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
  }, [open, refreshStatus, refreshBridges, scanLocalClis, loadChanges])

  // Mở panel: chọn hội thoại gần nhất của dự án (hoặc tạo hội thoại mới).
  useEffect(() => {
    if (!open || !projectId) return
    if (convInitRef.current === projectId) return
    convInitRef.current = projectId
    void loadConversations().then((list) => {
      setConversationId(list[0]?.id ?? newConversationId())
      setMessages([])
    })
  }, [open, projectId, loadConversations])

  // Tải nội dung của hội thoại đang chọn.
  useEffect(() => {
    if (!open) return
    void loadHistory()
  }, [open, loadHistory])

  useEffect(() => {
    let reloadTimer: number | null = null
    const off = api.ai.onChatEvent((event) => {
      if (event.id !== activeChatId.current) return
      if (event.type === 'start') {
        cliMutatedRef.current = false
      } else if (event.type === 'delta') {
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
          if (event.status === 'ok') {
            void loadChanges()
            if (
              !/^(read|view|grep|ripgrep|glob|find|ls|list|search|tree|stat|head|tail|cat|web_search|fetch|read_file|search_project|apply_patch)$/i.test(
                event.name.trim(),
              )
            ) {
              cliMutatedRef.current = true
            }
          }
          setLiveStatus({
            text: `Đang tổng hợp kết quả ${event.name}…`,
            phase: 'wait',
          })
        }
      } else if (event.type === 'done') {
        setThinking(false)
        setLiveStatus(null)
        setRetryText(null)
        activeChatId.current = null
        if (cliMutatedRef.current) {
          cliMutatedRef.current = false
          if (reloadTimer !== null) window.clearTimeout(reloadTimer)
          // Chờ nhẹ để CLI ghi đĩa / Hot Reload áp dụng xong rồi tự làm mới Canvas & cây tệp.
          reloadTimer = window.setTimeout(() => {
            reloadTimer = null
            onAppliedRef.current?.()
          }, 900)
        }
        void loadChanges()
        void loadToolLogs()
        void loadAuditLogs()
        void loadConversations()
      } else if (event.type === 'error') {
        cliMutatedRef.current = false
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
        notifyChat('err', event.message)
        void loadChanges()
        void loadToolLogs()
        void loadAuditLogs()
      }
    })
    return () => {
      if (reloadTimer !== null) window.clearTimeout(reloadTimer)
      off()
    }
  }, [loadChanges, loadConversations, notifyChat, loadToolLogs, loadAuditLogs])

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
      notifyChat('err', 'Chưa mở dự án — không thể đóng gói ngữ cảnh.')
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
    if ((!text && attachments.length === 0) || thinking) return
    lastPromptRef.current = text
    setRetryText(null)
    msgId.current += 1
    const time = timeNow()

    // Sao chép đính kèm hiện tại và xoá khỏi input
    const currentAttachments = [...attachments]
    setAttachments([])

    let augmentedText = text
    if (currentAttachments.length > 0) {
      const parts: string[] = []
      const fileAtts = currentAttachments.filter((a) => a.type === 'file')
      const folderAtts = currentAttachments.filter((a) => a.type === 'folder')
      const imgAtts = currentAttachments.filter((a) => a.type === 'image')
      const elAtts = currentAttachments.filter((a) => a.type === 'element')
      const areaAtts = currentAttachments.filter((a) => a.type === 'area')

      if (fileAtts.length > 0) {
        parts.push(
          `[Tệp đính kèm (${fileAtts.length})]:\n` +
            fileAtts
              .map(
                (f) =>
                  `• ${f.name} (${f.path || ''})${f.content ? `:\n\`\`\`\n${f.content.slice(0, 4000)}\n\`\`\`` : ''}`,
              )
              .join('\n'),
        )
      }
      if (folderAtts.length > 0) {
        parts.push(`[Thư mục đính kèm]: ${folderAtts.map((f) => f.path || f.name).join(', ')}`)
      }
      if (imgAtts.length > 0) {
        parts.push(`[Ảnh đính kèm (${imgAtts.length})]: ${imgAtts.map((img) => img.name).join(', ')}`)
      }
      if (elAtts.length > 0) {
        parts.push(
          `[Phần tử giao diện chỉ định chính xác bằng Cây bút]:\n` +
            elAtts.map((el) => `• ${el.name} (selector: ${el.selector || el.tag})`).join('\n'),
        )
      }
      if (areaAtts.length > 0) {
        parts.push(
          `[Vùng khoanh chọn giao diện bằng Cây bút (${areaAtts.length} vùng)]:\n` +
            areaAtts
              .map(
                (ar) =>
                  `• ${ar.name} bao gồm ${ar.elements?.length || 0} phần tử:\n` +
                  (ar.elements || [])
                    .map(
                      (e, idx) =>
                        `  ${idx + 1}. <${e.tag}${e.id ? `#${e.id}` : ''}${e.className ? ` class="${e.className}"` : ''}>: ${e.text ? `"${e.text}"` : '(không có chữ)'}${e.selector ? ` (selector: ${e.selector})` : ''}${e.outerHTML ? `\n     HTML: \`${e.outerHTML.slice(0, 250).replace(/\r?\n\s*/g, ' ')}\`` : ''}`,
                    )
                    .join('\n'),
              )
              .join('\n'),
        )
      }
      augmentedText = text
        ? `${text}\n\n--- THÔNG TIN ĐÍNH KÈM TỪ NGƯỜI DÙNG ---\n${parts.join('\n\n')}`
        : parts.join('\n\n')
    }

    const nowMs = Date.now()
    const userMessage: AiChatMessage = {
      id: `local-user-${msgId.current}`,
      role: 'user',
      text: text || (currentAttachments.length > 0 ? `Đã đính kèm ${currentAttachments.length} mục` : ''),
      time,
      at: nowMs,
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
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
      { id: replyId, role: 'assistant', text: '', time, at: nowMs },
    ])
    setThinking(true)
    setLiveStatus({ text: 'Đang gửi yêu cầu…', phase: 'prepare' })
    setElapsed(0)

    let context: AiContextPack | undefined
    try {
      context = await buildContext()
    } catch (error) {
      notifyChat('info', `Không đóng gói được ngữ cảnh: ${(error as Error).message}`)
    }

    const payloadMessages =
      addUser || history[history.length - 1]?.content !== augmentedText
        ? [...history, { role: 'user' as const, content: augmentedText }]
        : history

    const payloadImages = currentAttachments
      .filter((a) => a.type === 'image' && typeof a.dataUrl === 'string' && a.dataUrl.startsWith('data:image/'))
      .map((a) => ({ name: a.name, dataUrl: a.dataUrl! }))

    try {
      const handle = await api.ai.chat({
        projectId,
        projectPath,
        tools: true,
        context,
        images: payloadImages.length > 0 ? payloadImages : undefined,
        conversationId,
        messages: payloadMessages,
        bridge: activeBridge,
        cli: activeBridge === 'cli' ? (selectedCli ?? undefined) : undefined,
      })
      activeChatId.current = handle.id
      void loadConversations()
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
      notifyChat('err', message)
    }
  }

  const send = () => {
    const text = draft.trim()
    if ((!text && attachments.length === 0) || thinking) return
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

  // ─── ĐIỀU KHIỂN HỘI THOẠI ───
  const newConversation = useCallback(() => {
    if (thinking) stopChat()
    setConversationId(newConversationId())
    setMessages([])
    setDraft('')
    setAttachments([])
    setRetryText(null)
    setConvListOpen(false)
    setConvMenuOpen(false)
  }, [thinking])

  const selectConversation = useCallback(
    (id: string) => {
      if (id === conversationId) {
        setConvListOpen(false)
        return
      }
      if (thinking) stopChat()
      setConversationId(id)
      setMessages([])
      setConvListOpen(false)
      setConvMenuOpen(false)
    },
    [conversationId, thinking],
  )

  const deleteConversation = useCallback(
    async (id: string) => {
      if (!projectId) return
      if (!window.confirm('Xoá hội thoại này khỏi lịch sử trò chuyện?')) return
      try {
        await api.ai.chats.remove(projectId, id)
        const list = await loadConversations()
        if (id === conversationId) {
          setConversationId(list[0]?.id ?? newConversationId())
          setMessages([])
        }
        notifyChat('ok', 'Đã xoá hội thoại')
      } catch {
        notifyChat('err', 'Không thể xoá hội thoại')
      }
    },
    [projectId, conversationId, loadConversations, notifyChat],
  )

  const clearAllConversations = useCallback(async () => {
    if (!projectId) return
    if (!window.confirm('Xoá toàn bộ lịch sử trò chuyện của dự án này?')) return
    try {
      await api.ai.chats.clear(projectId)
      setConversations([])
      setConversationId(newConversationId())
      setMessages([])
      setConvMenuOpen(false)
      notifyChat('ok', 'Đã xoá toàn bộ lịch sử trò chuyện')
    } catch {
      notifyChat('err', 'Không thể xoá lịch sử trò chuyện')
    }
  }, [projectId, notifyChat])

  const updateConvMenuPos = useCallback(() => {
    if (!convMenuBtnRef.current) return
    const rect = convMenuBtnRef.current.getBoundingClientRect()
    setConvMenuPos({
      top: Math.round(rect.bottom + 4),
      right: Math.max(8, Math.round(window.innerWidth - rect.right)),
    })
  }, [])

  useEffect(() => {
    if (!convMenuOpen) return
    updateConvMenuPos()
    const recalc = () => updateConvMenuPos()
    window.addEventListener('resize', recalc)
    window.addEventListener('scroll', recalc, true)
    return () => {
      window.removeEventListener('resize', recalc)
      window.removeEventListener('scroll', recalc, true)
    }
  }, [convMenuOpen, updateConvMenuPos])

  const updateChangeStatus = async (id: string, action: 'accept' | 'reject' | 'undo') => {
    if (!projectId) return
    setBusyChange(true)
    try {
      const list = await api.ai.changes[action](projectId, id)
      setChanges(list)
      if (action !== 'reject') onApplied?.()
      notifyChat(
        action === 'reject' ? 'info' : 'ok',
        action === 'accept'
          ? 'Đã ghi thay đổi vào mã nguồn và tải lại canvas.'
          : action === 'undo'
            ? 'Đã hoàn tác thay đổi, tệp trở về trạng thái trước đó.'
            : 'Đã từ chối thay đổi.',
      )
    } catch (error) {
      notifyChat('err', (error as Error).message)
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
      notifyChat('ok', `Đã áp dụng ${pending.length} thay đổi vào mã nguồn.`)
    } catch (error) {
      notifyChat('err', (error as Error).message)
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
      notifyChat('err', (error as Error).message)
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
      notifyChat('ok', `Đã chuyển sang ${provider === 'ollama' ? 'Ollama (local)' : 'OpenAI-compatible'}.`)
    } catch (error) {
      notifyChat('err', (error as Error).message)
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
        notifyChat('ok', `🎉 Đã sửa thành công lỗi build sau lần thử ${attempt}!`)
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
        notifyChat('info', 'Đã kích hoạt Kill-switch dừng vòng lặp tự sửa.')
      } else {
        setLoopStage('failed')
        addLog(`\n❌ ĐÃ HẾT ${maxAttempts} LẦN THỬ TỰ ĐỘNG! DỪNG LẠI VÀ BÁO "CẦN NGƯỜI XEM".`)
        notifyChat('err', 'Đã hết 3 lần thử tự động nhưng chưa khắc phục được. Cần người xem!')
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
    notifyChat('info', 'Đã kích hoạt Kill-switch dừng vòng lặp.')
  }

  /**
   * Rollback toàn bộ các thay đổi trong phiên tự sửa về snapshot ban đầu
   */
  const handleRollback = async () => {
    if (appliedChangeIds.length === 0 || !projectId) {
      notifyChat('info', 'Không có thay đổi nào để rollback.')
      return
    }
    try {
      for (const chgId of [...appliedChangeIds].reverse()) {
        await api.ai.changes.undo(projectId, chgId)
      }
      setAppliedChangeIds([])
      onApplied?.()
      notifyChat('ok', 'Đã rollback thành công toàn bộ mã nguồn về snapshot ban đầu!')
      setLoopLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ↩ Đã rollback thành công toàn bộ tệp về snapshot ban đầu!`,
      ])
      await loadChanges()
    } catch (err) {
      notifyChat('err', `Lỗi rollback: ${(err as Error).message}`)
    }
  }

  const handleCopyMessage = useCallback(
    async (text: string) => {
      if (!text) return
      try {
        await navigator.clipboard.writeText(text)
        notifyChat('ok', 'Đã sao chép nội dung tin nhắn!')
      } catch (err) {
        notifyChat('err', `Không thể sao chép: ${(err as Error).message}`)
      }
    },
    [notifyChat],
  )

  const handleOpenUndo = useCallback(
    async (targetMsg: AiChatMessage, targetIndex: number) => {
      const targetAt = targetMsg.at ?? 0
      let currentChanges = changes
      if (projectId) {
        try {
          currentChanges = await api.ai.changes.list(projectId)
          setChanges(currentChanges)
        } catch {
          // keep current
        }
      }

      let affected = currentChanges.filter((chg) => {
        if (chg.status !== 'accepted' && chg.status !== 'pending') return false
        if (targetAt && chg.createdAt) {
          return chg.createdAt >= targetAt - 2000
        }
        return true
      })

      if (affected.length === 0 && currentChanges.length > 0) {
        affected = currentChanges.filter(
          (chg) => chg.status === 'accepted' || chg.status === 'pending',
        )
      }

      const items: AiUndoItem[] = []
      for (const chg of affected) {
        const fileName = chg.file.split(/[\\/]/).pop() || chg.file
        items.push({
          file: fileName,
          added: chg.removed ?? 0,
          removed: chg.added ?? 0,
          changeId: chg.id,
        })
      }

      if (items.length === 0 && projectPath) {
        try {
          const diffs = await api.ai.changes.diffStats?.(projectPath)
          if (diffs && diffs.length > 0) {
            for (const d of diffs) {
              const fileName = d.file.split(/[\\/]/).pop() || d.file
              items.push({
                file: fileName,
                added: d.removed ?? 0,
                removed: d.added ?? 0,
              })
            }
          }
        } catch {
          // ignore
        }
      }

      setUndoTarget({
        message: targetMsg,
        index: targetIndex,
        items,
        affectedChanges: affected,
      })
      setRevertFilesChecked(true)
    },
    [changes, projectId, projectPath],
  )

  const handleConfirmUndo = useCallback(async () => {
    if (!undoTarget || undoing) return
    setUndoing(true)
    try {
      const { message, index, affectedChanges, items } = undoTarget

      // 1. Revert file changes if checked
      if (revertFilesChecked) {
        if (projectId && affectedChanges.length > 0) {
          for (const chg of [...affectedChanges].reverse()) {
            try {
              if (chg.status === 'accepted') {
                await api.ai.changes.undo(projectId, chg.id)
              } else if (chg.status === 'pending') {
                await api.ai.changes.reject(projectId, chg.id)
              }
            } catch (err) {
              console.warn('[AI] Failed to revert change', chg.id, err)
            }
          }
        }
        if (projectPath && items.some((it) => !it.changeId)) {
          try {
            await api.ai.changes.gitRevert?.(projectPath)
          } catch (err) {
            console.warn('[AI] Failed to git revert', err)
          }
        }
        await loadChanges()
        onApplied?.()
      }

      // 2. Truncate chat messages to before this message
      const remainingMessages = messages.slice(0, index)
      setMessages(remainingMessages)

      // 3. If target was user message, restore prompt to draft input
      if (message.role === 'user' && message.text) {
        setDraft(message.text)
      }

      // 4. Rewrite chat history on backend
      if (projectId) {
        const remainingEntries: AiChatEntry[] = remainingMessages.map((m) => ({
          id: m.id,
          role: m.role,
          text: m.text,
          at: m.at ?? Date.now(),
          plan: m.plan,
          conversationId,
        }))
        await api.ai.chats.rewrite(projectId, remainingEntries, conversationId)
      }

      notifyChat('ok', 'Đã hoàn tác tin nhắn thành công!')
      setUndoTarget(null)
    } catch (err) {
      notifyChat('err', `Không thể hoàn tác: ${(err as Error).message}`)
    } finally {
      setUndoing(false)
    }
  }, [
    undoTarget,
    undoing,
    revertFilesChecked,
    projectId,
    projectPath,
    conversationId,
    loadChanges,
    onApplied,
    messages,
    notifyChat,
  ])

  useEffect(() => {
    if (!undoTarget) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setUndoTarget(null)
      } else if (e.key === 'Enter' && !undoing) {
        e.preventDefault()
        void handleConfirmUndo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undoTarget, undoing, handleConfirmUndo])

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

  const activeConversation = conversations.find((item) => item.id === conversationId)
  const conversationTitle = activeConversation?.title || 'New Conversation'
  // Luôn hiển thị hội thoại đang mở, kể cả khi chưa có tin nhắn nào được lưu.
  const displayConversations = useMemo(() => {
    const list = conversations.some((item) => item.id === conversationId)
      ? [...conversations]
      : [
          {
            id: conversationId,
            title: conversationTitle,
            updatedAt: Date.now(),
            messageCount: messages.length,
          } satisfies AiConversationSummary,
          ...conversations,
        ]
    return list.sort((a, b) =>
      convSort === 'new' ? b.updatedAt - a.updatedAt : a.updatedAt - b.updatedAt,
    )
  }, [conversations, conversationId, conversationTitle, convSort, messages.length])

  return (
    <aside className="pm-ai-panel" role="complementary" aria-label="Trợ lý AI">
      {/* ── Đầu panel ── */}
      <div className="pm-ai-panel__hd">
        <span className="pm-ai-panel__logo">
          <Sparkles size={14} />
        </span>
        <button
          className="pm-ai-panel__title"
          onClick={() => {
            setConvListOpen((v) => {
              if (!v) void loadConversations()
              return !v
            })
          }}
          title={`${conversationTitle} — mở danh sách hội thoại`}
        >
          <b>{conversationTitle}</b>
          <span>{projectName ? projectName : 'Chưa mở dự án'}</span>
        </button>
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
                        title="Model truyền xuống CLI (ưu tiên các model flash / mini / haiku để phản hồi nhanh)"
                      >
                        <option value="">Mặc định của CLI</option>
                        {[...cliModels]
                          .sort((a, b) => {
                            const fastRe = /(flash|mini|haiku|nano|lite|spark|lightning)/i
                            const aFast = fastRe.test(a) ? 0 : 1
                            const bFast = fastRe.test(b) ? 0 : 1
                            return aFast - bFast || a.localeCompare(b)
                          })
                          .map((model) => {
                            const isFast = /(flash|mini|haiku|nano|lite|spark|lightning)/i.test(model)
                            return (
                              <option key={model} value={model}>
                                {isFast ? `⚡ ${model} (Nhanh)` : model}
                              </option>
                            )
                          })}
                      </select>
                    </div>
                    <div className="pm-ai-bridge__key-hint">
                      Mẹo tăng tốc: chọn model có <code>flash</code> / <code>mini</code> /{' '}
                      <code>haiku</code> thay cho Mặc định nếu OpenCode phản hồi chậm.
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
        <div className="pm-ai-hd-actions">
          <button className="pm-ibtn" onClick={newConversation} title="New Conversation">
            <Plus size={14} />
          </button>
          <button
            ref={convMenuBtnRef}
            className={`pm-ibtn ${convMenuOpen ? 'on' : ''}`}
            onClick={() => {
              updateConvMenuPos()
              setConvMenuOpen((v) => !v)
            }}
            title="Tuỳ chọn hội thoại"
          >
            <EllipsisVertical size={14} />
          </button>
          <button
            className={`pm-ibtn ${convListOpen ? 'on' : ''}`}
            onClick={() => {
              setConvListOpen((v) => {
                if (!v) void loadConversations()
                return !v
              })
            }}
            title="Danh sách hội thoại"
          >
            <PanelLeft size={14} />
          </button>
          <button className="pm-ibtn" onClick={onClose} title="Đóng trợ lý AI (Ctrl+Shift+A)">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Drawer: danh sách hội thoại ── */}
      {convListOpen && (
        <div className="pm-ai-conv-drawer" role="dialog" aria-label="Conversations">
          <div className="pm-ai-conv-drawer__hd">
            <button
              className="pm-ai-conv-close"
              onClick={() => setConvListOpen(false)}
              title="Đóng danh sách hội thoại"
            >
              <X size={16} />
            </button>
          </div>

          <button className="pm-ai-conv-new" onClick={newConversation}>
            <Plus size={16} />
            <span>New Conversation</span>
          </button>

          <button
            className="pm-ai-conv-custom"
            onClick={() => {
              setConvListOpen(false)
              onOpenTheme()
            }}
          >
            <Palette size={15} />
            <span>Customizations</span>
          </button>

          <div className="pm-ai-conv-sec">
            <span>Conversations</span>
            <div className="pm-ai-conv-sec__actions">
              <button
                className={convSort === 'old' ? 'is-on' : ''}
                onClick={() => setConvSort((v) => (v === 'new' ? 'old' : 'new'))}
                title={convSort === 'new' ? 'Đang xếp mới nhất trước' : 'Đang xếp cũ nhất trước'}
              >
                <SlidersHorizontal size={13} />
              </button>
              <button onClick={newConversation} title="Tạo hội thoại mới cho dự án hiện tại">
                <FolderPlus size={13} />
              </button>
            </div>
          </div>

          <div className="pm-ai-conv-list">
            {convError && <div className="pm-ai-conv-empty is-err">{convError}</div>}
            {!convError &&
              displayConversations.map((conversation) => (
                <div className="pm-ai-conv-row" key={conversation.id}>
                  <button
                    className={`pm-ai-conv-item ${conversation.id === conversationId ? 'is-on' : ''}`}
                    onClick={() => selectConversation(conversation.id)}
                    title={conversation.title}
                  >
                    <span className="pm-ai-conv-item__main">
                      <span className="pm-ai-conv-item__title">{conversation.title}</span>
                      <span className="pm-ai-conv-item__sub">
                        <Folder size={11} />
                        {projectName || 'Chưa mở dự án'}
                      </span>
                    </span>
                    <span className="pm-ai-conv-item__time">
                      {conversationAge(conversation.updatedAt)}
                    </span>
                  </button>
                  <button
                    className="pm-ai-conv-del"
                    title="Xoá hội thoại"
                    onClick={(e) => {
                      e.stopPropagation()
                      void deleteConversation(conversation.id)
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            {!convError && !convLoading && displayConversations.length === 0 && (
              <div className="pm-ai-conv-empty">Chưa có hội thoại nào</div>
            )}
          </div>
        </div>
      )}

      {/* ── Menu ⋮ của hội thoại ── */}
      {convMenuOpen &&
        createPortal(
          <>
            <div
              className="pm-ai-popover__scrim"
              style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'transparent' }}
              onClick={() => setConvMenuOpen(false)}
            />
            <div
              className="pm-ai-conv-menu"
              style={{
                position: 'fixed',
                top: convMenuPos.top,
                right: convMenuPos.right,
                zIndex: 99999,
              }}
            >
              <button
                onClick={() => {
                  newConversation()
                }}
              >
                <Plus size={13} /> New Conversation
              </button>
              <button onClick={() => void loadConversations()}>
                <RefreshCw size={13} /> Làm mới danh sách
              </button>
              <button
                onClick={() => {
                  setConvMenuOpen(false)
                  setConvListOpen(true)
                  void loadConversations()
                }}
              >
                <PanelLeft size={13} /> Mở danh sách hội thoại
              </button>
              <div className="pm-ai-conv-menu__sep" />
              <button
                className="is-danger"
                onClick={() => {
                  setConvMenuOpen(false)
                  void handleKillSwitch()
                }}
              >
                <Octagon size={13} /> Dừng khẩn cấp AI (Kill-switch)
              </button>
              <div className="pm-ai-conv-menu__sep" />
              <button
                className="is-danger"
                onClick={() => {
                  setConvMenuOpen(false)
                  void deleteConversation(conversationId)
                }}
              >
                <Trash2 size={13} /> Xoá hội thoại này
              </button>
              <button
                className="is-danger"
                onClick={() => {
                  setConvMenuOpen(false)
                  void clearAllConversations()
                }}
              >
                <Trash2 size={13} /> Xoá toàn bộ lịch sử
              </button>
            </div>
          </>,
          document.body,
        )}

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

      {chatNotice && (
        <div className={`pm-ai-notice is-${chatNotice.kind}`} role="status">
          {chatNotice.kind === 'ok' && <Check size={12} />}
          {chatNotice.kind === 'err' && <AlertTriangle size={12} />}
          {chatNotice.kind === 'info' && <Sparkles size={12} />}
          <span>{chatNotice.text}</span>
          <button
            type="button"
            className="pm-ai-notice__close"
            onClick={() => setChatNotice(null)}
            title="Đóng thông báo"
          >
            <X size={11} />
          </button>
        </div>
      )}

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

              {messages.map((message, index) => (
                <div key={message.id} className={`pm-ai-msg is-${message.role}`}>
                  {message.role === 'assistant' && (
                    <span className="pm-ai-avatar">
                      <Sparkles size={11} />
                    </span>
                  )}
                  <div className="pm-ai-msg__col">
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="pm-ai-msg__attachments">
                        {message.attachments.map((att) => (
                          <div
                            key={att.id}
                            className={`pm-ai-att pm-ai-att--${att.type}`}
                            title={att.path || att.name}
                          >
                            {att.type === 'image' && att.dataUrl ? (
                              <div className="pm-ai-att__img-wrap">
                                <img src={att.dataUrl} alt={att.name} className="pm-ai-att__img" />
                              </div>
                            ) : (
                              <>
                                <span className="pm-ai-att__icon">
                                  {att.type === 'file' && <FileCode2 size={11} />}
                                  {att.type === 'folder' && <Folder size={11} />}
                                  {att.type === 'element' && <Pencil size={11} style={{ color: '#a78bfa' }} />}
                                  {att.type === 'area' && <BoxSelect size={11} style={{ color: '#38bdf8' }} />}
                                </span>
                                <span className="pm-ai-att__name">{att.name}</span>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {Boolean(message.text || (thinking && message.id === assistantId.current)) && (
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
                    )}
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
                    <div className="pm-ai-msg__ft">
                      <span className="pm-ai-msg__time">
                        {formatRelativeOrTime(message.at, message.time)}
                      </span>
                      {message.text && (
                        <div className="pm-ai-msg__actions">
                          <button
                            type="button"
                            className="pm-ai-msg__btn"
                            title="Sao chép nội dung tin nhắn"
                            onClick={() => handleCopyMessage(message.text)}
                          >
                            <Copy size={11} />
                          </button>
                          <button
                            type="button"
                            className="pm-ai-msg__btn"
                            title="Hoàn tác (Undo) từ tin nhắn này"
                            onClick={() => handleOpenUndo(message, index)}
                          >
                            <Undo2 size={11} />
                          </button>
                        </div>
                      )}
                    </div>
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
              {/* File inputs ẩn cho Files, Folder, Image */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={handleFilesSelected}
              />
              <input
                ref={folderInputRef}
                type="file"
                // @ts-expect-error webkitdirectory is standard in Chromium
                webkitdirectory=""
                directory=""
                multiple
                style={{ display: 'none' }}
                onChange={handleFolderSelected}
              />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={handleImagesSelected}
              />

              {/* Banner báo đang bật Cây bút chọn phần tử / khoanh vùng */}
              {waitingPickMode && (
                <div className="pm-ai-picking-banner">
                  <span className="pm-spin"><Pencil size={11} /></span>
                  <span>
                    {waitingPickMode === 'single'
                      ? 'Đang bật Cây bút: Hãy nhấp vào 1 phần tử trên giao diện...'
                      : 'Đang bật Cây bút: Hãy kéo chuột khoanh 1 vùng trên giao diện...'}
                  </span>
                  <button
                    type="button"
                    className="pm-ai-picking-banner__cancel"
                    onClick={() => setWaitingPickMode(null)}
                  >
                    Huỷ
                  </button>
                </div>
              )}

              {/* Khung nhập liệu hợp nhất (Chứa hàng đính kèm phía trên và ô nhập phía dưới) */}
              <div className="pm-ai-composer__box">
                {/* Vùng hiển thị đính kèm phía trên ô nhập (Ảnh, Tệp, Folder, Element) */}
                {attachments.length > 0 && (
                  <div className="pm-ai-attachments">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className={`pm-ai-att pm-ai-att--${att.type}`}
                        title={att.path || att.name}
                      >
                        {att.type === 'image' && att.dataUrl ? (
                          <div className="pm-ai-att__img-wrap">
                            <img src={att.dataUrl} alt={att.name} className="pm-ai-att__img" />
                            <button
                              type="button"
                              className="pm-ai-att__del"
                              onClick={() => removeAttachment(att.id)}
                              title="Xoá ảnh này"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="pm-ai-att__icon">
                              {att.type === 'file' && <FileCode2 size={12} />}
                              {att.type === 'folder' && <Folder size={12} />}
                              {att.type === 'element' && <Pencil size={12} style={{ color: '#a78bfa' }} />}
                              {att.type === 'area' && <BoxSelect size={12} style={{ color: '#38bdf8' }} />}
                            </span>
                            <span className="pm-ai-att__name">{att.name}</span>
                            <button
                              type="button"
                              className="pm-ai-att__del"
                              onClick={() => removeAttachment(att.id)}
                              title="Xoá đính kèm"
                            >
                              <X size={10} />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {attachments.length > 0 && <div className="pm-ai-composer__box-divider" />}

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
                  onPaste={handlePaste}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      void send()
                    }
                  }}
                  rows={2}
                />
              </div>

              <div className="pm-ai-composer__ft">
                {/* Nút + Thêm tệp, thư mục, ảnh, cây bút */}
                <div className="pm-ai-add-wrap">
                  <button
                    ref={addBtnRef}
                    type="button"
                    className={`pm-ai-add-btn ${addMenuOpen ? 'is-active' : ''}`}
                    onClick={() => setAddMenuOpen((v) => !v)}
                    title="Thêm đính kèm (Tệp, Thư mục, Ảnh, Cây bút chọn phần tử, Khoanh vùng)"
                  >
                    <Plus size={14} />
                  </button>

                  {/* Popover menu của nút + */}
                  {addMenuOpen && (
                    <div ref={addMenuRef} className="pm-ai-add-menu">
                      <div className="pm-ai-add-menu__hd">Đính kèm vào câu hỏi</div>

                        <button
                          type="button"
                          className="pm-ai-add-menu__item"
                          onClick={() => {
                            fileInputRef.current?.click()
                            setAddMenuOpen(false)
                          }}
                        >
                          <FileCode2 size={14} style={{ color: 'var(--accent, #6d5df5)' }} />
                          <div className="pm-ai-add-menu__item-text">
                            <b>Chọn Tệp (Files)</b>
                            <span>Đính kèm mã nguồn hoặc tệp văn bản</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          className="pm-ai-add-menu__item"
                          onClick={() => {
                            folderInputRef.current?.click()
                            setAddMenuOpen(false)
                          }}
                        >
                          <Folder size={14} style={{ color: '#eab308' }} />
                          <div className="pm-ai-add-menu__item-text">
                            <b>Chọn Thư mục (Folder)</b>
                            <span>Đính kèm thư mục dự án làm ngữ cảnh</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          className="pm-ai-add-menu__item"
                          onClick={() => {
                            imageInputRef.current?.click()
                            setAddMenuOpen(false)
                          }}
                        >
                          <ImageIcon size={14} style={{ color: '#22c55e' }} />
                          <div className="pm-ai-add-menu__item-text">
                            <b>Chọn Ảnh (Image)</b>
                            <span>Tải ảnh giao diện, mockup để AI phân tích</span>
                          </div>
                        </button>

                        <div className="pm-ai-add-menu__div" />

                        <button
                          type="button"
                          className="pm-ai-add-menu__item"
                          onClick={handlePickElement}
                        >
                          <Pencil size={14} style={{ color: '#a78bfa' }} />
                          <div className="pm-ai-add-menu__item-text">
                            <b>Cây bút: Chọn 1 phần tử</b>
                            <span>Nhấp chuột chọn chính xác 1 phần tử trên giao diện</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          className="pm-ai-add-menu__item"
                          onClick={handlePickArea}
                        >
                          <BoxSelect size={14} style={{ color: '#38bdf8' }} />
                          <div className="pm-ai-add-menu__item-text">
                            <b>Cây bút: Khoanh vùng nhiều phần tử</b>
                            <span>Kéo chuột khoanh 1 vùng chọn nhiều phần tử cùng lúc</span>
                          </div>
                        </button>
                      </div>
                  )}
                </div>

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
                    disabled={!draft.trim() && attachments.length === 0}
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

      {undoTarget && (
        <div className="pm-ai-undo-overlay" onClick={() => setUndoTarget(null)}>
          <div
            className="pm-ai-undo-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="pm-ai-undo-dialog__hd">
              <h3 className="pm-ai-undo-dialog__title">Confirm Undo</h3>
              <button
                type="button"
                className="pm-ai-undo-dialog__close"
                onClick={() => setUndoTarget(null)}
                title="Đóng (Esc)"
              >
                <X size={15} />
              </button>
            </div>

            <div className="pm-ai-undo-dialog__desc">
              {undoTarget.items.length === 0
                ? 'This undo action will not make any code changes.'
                : 'Confirming this undo action will make the following changes:'}
            </div>

            <label className="pm-ai-undo-check">
              <input
                type="checkbox"
                checked={revertFilesChecked}
                onChange={(e) => setRevertFilesChecked(e.target.checked)}
              />
              <span>Revert file changes</span>
            </label>

            {revertFilesChecked && undoTarget.items.length > 0 && (
              <div className="pm-ai-undo-files">
                {undoTarget.items.map((item, idx) => (
                  <div key={`${item.file}-${idx}`} className="pm-ai-undo-file-row">
                    {renderFileBadge(item.file)}
                    <span className="pm-ai-undo-file-name" title={item.file}>
                      {item.file}
                    </span>
                    <span className="pm-ai-undo-file-stats">
                      <span className="pm-ai-undo-diff-add">+{item.added}</span>
                      <span className="pm-ai-undo-diff-del">-{item.removed}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="pm-ai-undo-dialog__ft">
              <button
                type="button"
                className="pm-ai-undo-btn-cancel"
                onClick={() => setUndoTarget(null)}
                disabled={undoing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="pm-ai-undo-btn-confirm"
                onClick={() => void handleConfirmUndo()}
                disabled={undoing}
              >
                {undoing ? 'Reverting…' : 'Confirm'}
                <span className="pm-ai-undo-enter">↵</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

export default AIPanel
