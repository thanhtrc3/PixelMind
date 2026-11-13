import { api } from '../lib/bridge'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  ArrowRight,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Code2,
  Copy,
  ExternalLink,
  Globe,
  Hand,
  Hash,
  Image as ImageIcon,
  Info,
  Layers,
  Maximize2,
  Monitor,
  MonitorUp,
  MousePointer2,
  Move,
  Network,
  Play,
  RefreshCw,
  RotateCcw,
  Scan,
  Smartphone,
  Sparkles,
  SlidersHorizontal,
  Sliders,
  Compass,
  Box,
  Palette,
  Square,
  Tablet,
  Trash2,
  Type,
  X,
  ZoomIn,
  ZoomOut,
  Underline as UnderlineIcon,
  Strikethrough as StrikethroughIcon,
} from 'lucide-react'
import type { ParsedError } from '../lib/errorParser'
import { formatBytes } from '../lib/format'
import VisualErrorCard from './VisualErrorCard'
import DesignTokensDialog from './DesignTokensDialog'
import MutationDiffDialog from './MutationDiffDialog'
import CanvasSplitSlider from './canvas/CanvasSplitSlider'
import AISidecar from './AISidecar'
import type { DesignTokens, ProjectPage } from '@shared/types'
import type {
  ElementMutationTarget,
  InsertPlacement,
  MutationPreview,
  ToolboxMutationPayload,
} from '@shared/toolbox'
import { editorBuffer, type ActionType, type DomMutationRecord, type ElementSnapshot } from '../lib/editorBuffer'
import { elementClipboard } from '../lib/elementClipboard'
import { onToolboxInsert, takePendingToolboxInsert, toolboxDrag } from '../lib/toolboxBridge'
import type { ToolboxDragItem } from '../lib/toolboxBridge'
import { PencilFillIcon } from './PanelIcons'
import MultiPageCanvas from './MultiPageCanvas'
import type { ReferenceAsset } from './WorkspaceSidebar'
import type { AiSelectedElement } from '../lib/aiMock'

export type CanvasMode = 'reference' | 'live' | 'compare' | 'overlay' | 'diff'
export type ViewportKey = 'responsive' | 'mobile' | 'tablet' | 'desktop' | 'wide'
export type ToolKey = 'select' | 'pan' | 'rect' | 'text' | 'comment' | 'measure'
export type HandleDirection = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

interface ResizingState {
  handle: HandleDirection
  startX: number
  startY: number
  startWidth: number
  startHeight: number
  startTop: number
  startLeft: number
}

const RESIZE_HANDLES: { key: HandleDirection; label: string }[] = [
  { key: 'nw', label: 'Góc trên-trái' },
  { key: 'n', label: 'Cạnh trên' },
  { key: 'ne', label: 'Góc trên-phải' },
  { key: 'e', label: 'Cạnh phải' },
  { key: 'se', label: 'Góc dưới-phải' },
  { key: 's', label: 'Cạnh dưới' },
  { key: 'sw', label: 'Góc dưới-trái' },
  { key: 'w', label: 'Cạnh trái' },
]

interface ViewportConfig {
  key: ViewportKey
  label: string
  icon: typeof Smartphone
  w: number
  h: number
}

const VIEWPORTS: ViewportConfig[] = [
  { key: 'responsive', label: 'Toàn khung', icon: Maximize2, w: 0, h: 0 },
  { key: 'mobile', label: 'Mobile', icon: Smartphone, w: 375, h: 812 },
  { key: 'tablet', label: 'Tablet', icon: Tablet, w: 768, h: 1024 },
  { key: 'desktop', label: 'Desktop', icon: Monitor, w: 1440, h: 900 },
  { key: 'wide', label: 'Rộng', icon: MonitorUp, w: 1920, h: 1080 },
]




interface ToolConfig {
  key: ToolKey
  label: string
  icon: typeof MousePointer2
  shortcut: string
}

const TOOLS: ToolConfig[] = [
  { key: 'select', label: 'Chọn (V)', icon: MousePointer2, shortcut: 'V' },
  { key: 'pan', label: 'Kéo (H)', icon: Hand, shortcut: 'H' },
]

export interface HoverElementInfo {
  uid?: string
  tagName: string
  className: string
  rect: {
    top: number
    left: number
    width: number
    height: number
  }
}

export interface RealElementInfo {
  uid?: string
  selector?: string
  tagName: string
  id: string
  className: string
  outerHTML?: string
  isLeaf?: boolean
  childrenCount?: number
  currentPath?: string
  currentUrl?: string
  pageTitle?: string
  parent?: {
    uid: string
    tagName: string
    id: string
    className: string
    tag: string
    rect: {
      top: number
      left: number
      width: number
      height: number
    }
  } | null
  rect: {
    top: number
    left: number
    width: number
    height: number
  }
  computedStyles: {
    display: string
    flexDirection: string
    alignItems: string
    justifyContent: string
    gap: string
    rowGap: string
    columnGap: string
    flexWrap: string
    gridTemplateColumns: string
    gridTemplateRows: string
    gridAutoFlow: string
    color: string
    backgroundColor: string
    backgroundImage: string
    fontSize: string
    fontWeight: string
    fontFamily: string
    lineHeight: string
    letterSpacing: string
    textAlign: string
    textDecoration: string
    textTransform: string
    padding: string
    paddingTop: string
    paddingRight: string
    paddingBottom: string
    paddingLeft: string
    margin: string
    marginTop: string
    marginRight: string
    marginBottom: string
    marginLeft: string
    borderRadius: string
    borderWidth: string
    borderStyle: string
    borderColor: string
    boxShadow: string
    opacity: string
    position: string
    top: string
    left: string
    width: string
    height: string
    [key: string]: string
  }
  domPath: string
  textSnippet: string
}

interface CanvasAreaProps {
  url: string | null
  running: boolean
  projectName: string
  projectId?: string
  projectPath?: string
  error?: ParsedError | null
  installing?: boolean
  onRun?: () => void
  onStop?: () => void
  onOpenExternal?: (url: string) => void
  onInstall?: () => void
  onCreateIndexHtml?: () => void
  onAddDevScript?: () => void
  onUrlChange?: (url: string, pathname: string) => void
  pages?: ProjectPage[]
  currentRoute?: string | null
  onOpenPage?: (route: string) => void
  /** Mở bảng Trợ lý AI đầy đủ từ sidecar. */
  onOpenAIPanel?: () => void
  /** Báo phần tử đang chọn ra ngoài (để panel AI dùng làm ngữ cảnh). */
  onSelectionChange?: (selection: AiSelectedElement | null) => void
  /** Tăng giá trị này để buộc iframe tải lại sau khi AI áp dụng thay đổi. */
  reloadToken?: number
  /** Ảnh mẫu đang chọn từ tab Assets (để xem trong chế độ Ảnh mẫu). */
  referenceAsset?: ReferenceAsset | null
  /** Bỏ ảnh mẫu đang chọn. */
  onClearReference?: () => void
  /** Mở tab Assets khi chưa có ảnh mẫu nào được chọn. */
  onOpenAssets?: () => void
  /** Kích hoạt mở DesignTokensDialog từ thanh công cụ bên ngoài */
  openTokensToken?: number
  /** Chế độ xem ảnh mẫu toàn màn hình */
  showReference?: boolean
  onToggleReference?: (show: boolean) => void
  /** Ảnh overlay thiết kế */
  overlayImage?: string | null
  overlayVisible?: boolean
  overlayOpacity?: number
  onToggleOverlay?: (visible: boolean) => void
  onOverlayOpacityChange?: (opacity: number) => void
  /** Chế độ Split Slider so sánh Before / After (D2-01) */
  isSplitCompare?: boolean
  splitPosition?: number
  onToggleSplitCompare?: (enabled: boolean) => void
  onSplitPositionChange?: (pos: number) => void
  /** D2-04 — Bật/tắt viền xanh bao quanh phần tử khi rê chuột (Hover Outline) */
  hoverOutline?: boolean
  /** D2-05 — Đồng bộ lựa chọn Canvas với cây Layers */
  syncCanvasToTree?: boolean
  /** D2-06 — Bật/tắt lưới chấm nền trên vùng Canvas */
  canvasGrid?: boolean
}

const COLOR_SWATCHES = [
  '#ffffff',
  '#000000',
  '#94a3b8',
  '#6d5df5',
  '#38bdf8',
  '#10b981',
  '#ef4444',
  '#f59e0b',
]

const GRADIENT_PRESETS = [
  { name: 'Tím Cyber', val: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { name: 'Xanh Ngọc', val: 'linear-gradient(135deg, #0ba360 0%, #3cba92 100%)' },
  { name: 'Hoàng Hôn', val: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { name: 'Tối Sâu', val: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' },
]

const SHADOW_PRESETS = [
  { label: 'Không bóng', val: 'none' },
  { label: 'Nhẹ (Sm)', val: '0 1px 3px rgba(0,0,0,0.2)' },
  { label: 'Vừa (Md)', val: '0 4px 12px rgba(0,0,0,0.3)' },
  { label: 'Đậm (Lg)', val: '0 10px 25px rgba(0,0,0,0.4)' },
  { label: 'Glow Tím', val: '0 0 20px rgba(109, 93, 245, 0.5)' },
]

// ─── GRID VISUAL EDITOR: hằng số & tiện ích dùng chung ───
const GRID_MAX_TRACKS = 12
const ALIGN_MATRIX_VALUES = ['flex-start', 'center', 'flex-end'] as const

/** Chuẩn hoá giá trị computed của align-items / justify-content về từ khoá của ma trận. */
const normalizeAlignValue = (value?: string): string => {
  const v = (value || '').trim().toLowerCase()
  if (!v || v === 'normal' || v === 'start' || v === 'left') return 'flex-start'
  if (v === 'end' || v === 'right') return 'flex-end'
  return v
}

/** Đếm số track trong giá trị computed của grid-template-columns / grid-template-rows. */
const countGridTracks = (value?: string): number => {
  const raw = (value || '').trim()
  if (!raw || raw === 'none') return 1
  const repeat = raw.match(/^repeat\(\s*(\d+)\s*,/i)
  if (repeat) return Math.max(1, Math.min(GRID_MAX_TRACKS, parseInt(repeat[1], 10) || 1))
  let depth = 0
  let count = 0
  let inToken = false
  for (const ch of raw) {
    if (ch === '(') depth += 1
    else if (ch === ')') depth = Math.max(0, depth - 1)
    if (/\s/.test(ch) && depth === 0) {
      inToken = false
    } else if (!inToken) {
      inToken = true
      count += 1
    }
  }
  return Math.max(1, Math.min(GRID_MAX_TRACKS, count))
}

/** Hiển thị grid-template dạng dễ đọc: các track bằng nhau thì gộp thành repeat(n, 1fr). */
const displayGridTracks = (value: string | undefined, count: number): string => {
  const raw = (value || '').trim()
  if (!raw || raw === 'none' || count <= 1) return '1fr'
  if (/^repeat\(/i.test(raw)) return raw
  const parts = raw.split(/\s+(?![^(]*\))/).filter(Boolean)
  if (parts.length === count && parts.every((part) => part === parts[0])) return `repeat(${count}, 1fr)`
  return raw
}

function GridTrackInput({
  label,
  value,
  onApply,
}: {
  label: string
  value: string
  onApply: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => {
    setDraft(value)
  }, [value])

  const commit = () => {
    const next = draft.trim()
    if (!next || next === value) {
      setDraft(value)
      return
    }
    onApply(next)
  }

  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="canvas__inspector-field-lbl">{label}</span>
      <input
        className="canvas__grid-input"
        value={draft}
        spellCheck={false}
        placeholder="vd: repeat(3, minmax(0, 1fr))"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
            ;(e.target as HTMLInputElement).blur()
          } else if (e.key === 'Escape') {
            setDraft(value)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
      />
    </label>
  )
}

const CanvasArea = ({
  url,
  running,
  projectName,
  projectId,
  projectPath,
  error,
  installing = false,
  onRun,
  onStop: _onStop,
  onOpenExternal,
  onInstall,
  onCreateIndexHtml: _onCreateIndexHtml,
  onAddDevScript: _onAddDevScript,
  onUrlChange,
  pages = [],
  currentRoute,
  onOpenPage,
  onOpenAIPanel,
  onSelectionChange,
  reloadToken = 0,
  referenceAsset = null,
  onClearReference,
  onOpenAssets: _onOpenAssets,
  openTokensToken = 0,
  showReference: propShowReference,
  onToggleReference: propOnToggleReference,
  overlayImage: propOverlayImage,
  overlayVisible: propOverlayVisible,
  overlayOpacity: propOverlayOpacity,
  onToggleOverlay: _propOnToggleOverlay,
  onOverlayOpacityChange: _propOnOverlayOpacityChange,
  isSplitCompare: propIsSplitCompare,
  splitPosition: propSplitPosition,
  onToggleSplitCompare: propOnToggleSplitCompare,
  onSplitPositionChange: propOnSplitPositionChange,
  hoverOutline = true,
  syncCanvasToTree: _syncCanvasToTree = true,
  canvasGrid = true,
}: CanvasAreaProps) => {

  const [currentLiveUrl, setCurrentLiveUrl] = useState<string | null>(url ?? null)

  useEffect(() => {
    if (url) {
      setCurrentLiveUrl(url)
    }
  }, [url])

  const [viewport, setViewport] = useState<ViewportKey>('responsive')
  const [tool, setTool] = useState<ToolKey>('select')
  const [zoom, setZoom] = useState(100)
  const [zoomEditing, setZoomEditing] = useState(false)
  const [zoomDraft, setZoomDraft] = useState('')
  const zoomInputRef = useRef<HTMLInputElement>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const spacePressedRef = useRef(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeKey, setIframeKey] = useState(0)
  // Nhận diện tài liệu của iframe. Mỗi lần trang được tải lại (điều hướng hoặc
  // hot-reload), script inspector sinh docId mới → tăng epoch. Epoch được lưu
  // cùng mỗi HistoryAction để biết có còn được phép sửa DOM thủ công hay không.
  const docIdRef = useRef<string | null>(null)
  const docEpochRef = useRef(0)
  // Lần load đầu tiên của iframe không phải là reload. Các lần sau (hot-reload,
  // bấm Thử lại, điều hướng cứng) đều làm uid cũ mất hiệu lực.
  const iframeLoadedOnceRef = useRef(false)

  // Buộc iframe tải lại khi AI vừa áp dụng thay đổi mã nguồn.
  const reloadSeenRef = useRef(reloadToken)
  useEffect(() => {
    if (reloadSeenRef.current === reloadToken) return
    reloadSeenRef.current = reloadToken
    setIframeKey((key) => key + 1)
  }, [reloadToken])

  // Mở hộp thoại Design Tokens khi nhận trigger từ thanh công cụ bên ngoài
  const tokensSeenRef = useRef(openTokensToken)
  useEffect(() => {
    if (openTokensToken && tokensSeenRef.current !== openTokensToken) {
      tokensSeenRef.current = openTokensToken
      setIsTokensDialogOpen(true)
    }
  }, [openTokensToken])

  // Lắng nghe yêu cầu đổi viewport từ Breakpoint Manager trong Design Tokens
  useEffect(() => {
    const handleSetVpWidth = (e: Event) => {
      const custom = e as CustomEvent<number>
      const w = custom.detail
      if (typeof w === 'number') {
        if (w <= 640) setViewport('mobile')
        else if (w <= 1024) setViewport('tablet')
        else if (w <= 1440) setViewport('desktop')
        else setViewport('wide')
      }
    }
    window.addEventListener('pm:set-viewport-width', handleSetVpWidth)
    return () => window.removeEventListener('pm:set-viewport-width', handleSetVpWidth)
  }, [])

  // Chặng 7 — Design Overlay so sánh (Ảnh thiết kế chồng lên canvas iframe với thanh trượt opacity)
  const [internalOverlayImage, setInternalOverlayImage] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem('pm.canvasOverlay')
    } catch {
      return null
    }
  })
  const [internalOverlayVisible] = useState(true)
  const [internalOverlayOpacity] = useState(50)

  const effectiveOverlayImage = propOverlayImage !== undefined ? propOverlayImage : internalOverlayImage
  const effectiveOverlayVisible = propOverlayVisible !== undefined ? propOverlayVisible : internalOverlayVisible
  const effectiveOverlayOpacity = propOverlayOpacity !== undefined ? propOverlayOpacity : internalOverlayOpacity

  useEffect(() => {
    const handleOverlayUpdated = () => {
      try {
        const img = window.localStorage.getItem('pm.canvasOverlay')
        setInternalOverlayImage(img)
      } catch {}
    }
    window.addEventListener('pm:overlay-updated', handleOverlayUpdated)
    return () => window.removeEventListener('pm:overlay-updated', handleOverlayUpdated)
  }, [])

  // D2-01 — Split slider so sánh Live với ảnh mẫu (Before / After)
  const [internalSplitCompare, setInternalSplitCompare] = useState(false)
  const [internalSplitPosition, setInternalSplitPosition] = useState(50)

  const effectiveIsSplitCompare = propIsSplitCompare !== undefined ? propIsSplitCompare : internalSplitCompare
  const effectiveSplitPosition = propSplitPosition !== undefined ? propSplitPosition : internalSplitPosition

  const setSplitCompareState = (enabled: boolean) => {
    if (propOnToggleSplitCompare) {
      propOnToggleSplitCompare(enabled)
    } else {
      setInternalSplitCompare(enabled)
    }
  }

  const updateSplitPosition = (pos: number) => {
    if (propOnSplitPositionChange) {
      propOnSplitPositionChange(pos)
    } else {
      setInternalSplitPosition(pos)
    }
  }

  // ─── STATE SOI PHẦN TỬ THẬT (VISUAL INSPECTOR) ───
  const [isInspectMode, setIsInspectMode] = useState(false)
  const [hoverEl, setHoverEl] = useState<HoverElementInfo | null>(null)
  const [selectedEl, setSelectedEl] = useState<RealElementInfo | null>(null)
  // D2-03 — Gắn AI Sidecar vào phần tử đang chọn
  const [isSidecarOpen, setIsSidecarOpen] = useState(false)
  const preAiStylesRef = useRef<{
    styles: Record<string, string>
    textSnippet?: string
  } | null>(null)

  // Tự động đóng AI Sidecar khi bỏ chọn phần tử
  useEffect(() => {
    if (!selectedEl) {
      setIsSidecarOpen(false)
      preAiStylesRef.current = null
    }
  }, [selectedEl])

  // D2-04 — Tự động xóa khung viền hover ngay khi setting hoverOutline bị tắt
  useEffect(() => {
    if (!hoverOutline) {
      setHoverEl(null)
    }
  }, [hoverOutline])

  // Tính toán vị trí hiển thị nổi của AI Sidecar bám sát phần tử đang chọn
  const sidecarPos = useMemo(() => {
    if (!selectedEl) return { x: 100, y: 100 }
    const rect = selectedEl.rect
    let x = rect.left
    let y = rect.top + rect.height + 8
    const stageW = stageRef.current?.clientWidth || 1200
    const stageH = stageRef.current?.clientHeight || 800

    if (x + 310 > stageW) {
      x = Math.max(12, stageW - 320)
    }
    if (y + 320 > stageH) {
      y = Math.max(12, rect.top - 320)
    }
    return { x: Math.max(12, x), y: Math.max(12, y) }
  }, [selectedEl])
  // Nhiều phần tử được chọn cùng lúc (Shift + Click hoặc kéo vùng chọn trên canvas)
  const [multiSelection, setMultiSelection] = useState<RealElementInfo[]>([])
  const multiSelectionRef = useRef<RealElementInfo[]>([])
  multiSelectionRef.current = multiSelection
  // Cầu nối để các listener (bàn phím / postMessage) luôn gọi được handler mới nhất
  const canvasActionsRef = useRef<{
    copy: () => void
    paste: () => void
    deleteSelection: () => void
  }>({ copy: () => {}, paste: () => {}, deleteSelection: () => {} })
  const [resizingEl, setResizingEl] = useState<ResizingState | null>(null)
  const [inspectorWidth, setInspectorWidth] = useState(320)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const sidebarDragRef = useRef({ startX: 0, startWidth: 380 })

  // Phân hệ 2: Tabs & Two-Way Code Sync & Modified Styles
  const [inspectorTab, setInspectorTab] = useState<'design' | 'code' | 'attrs'>('design')
  const [modifiedStyles, setModifiedStyles] = useState<Record<string, string>>({})
  const [isMovingEl, setIsMovingEl] = useState(false)
  const [dropTargetHover, setDropTargetHover] = useState<{
    uid: string
    tagName: string
    tag: string
    rect: { top: number; left: number; width: number; height: number }
  } | null>(null)

  // ─── HỘP CÔNG CỤ: kéo-thả, diff & thuộc tính ───
  const [toolboxDropHover, setToolboxDropHover] = useState<{
    uid: string
    tagName: string
    tag: string
    placement: InsertPlacement
    rect: { top: number; left: number; width: number; height: number }
  } | null>(null)
  const [canvasContextMenu, setCanvasContextMenu] = useState<{
    x: number
    y: number
    info: RealElementInfo
  } | null>(null)
  const [pendingMutation, setPendingMutation] = useState<{
    payload: ToolboxMutationPayload
    preview: MutationPreview
    title: string
    subtitle?: string
    mode: 'insert' | 'delete' | 'duplicate' | 'attributes'
    domHtml?: string
    targetUid?: string
    placement?: InsertPlacement
    attrsBefore?: Record<string, string | null>
    attrsAfter?: Record<string, string | null>
    textBefore?: string
    textAfter?: string
  } | null>(null)
  const [mutationBusy, setMutationBusy] = useState(false)
  const [attrsDraft, setAttrsDraft] = useState({ id: '', className: '', text: '' })
  const toolboxRequestsRef = useRef<Map<string, (data: any) => void>>(new Map())
  const isInsertingRef = useRef(false)
  const lastInsertTimeRef = useRef(0)
  const [isDirtyBuffer, setIsDirtyBuffer] = useState(editorBuffer.isDirty())
  const initialTextRef = useRef<string>('')
  const currentRouteRef = useRef<string>('/')
  const [isTokensDialogOpen, setIsTokensDialogOpen] = useState(false)
  const [isPageFlowOpen, setIsPageFlowOpen] = useState(false)
  const [projectTokens, setProjectTokens] = useState<DesignTokens | null>(null)
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false)

  // ─── CHẾ ĐỘ XEM ẢNH MẪU (REFERENCE VIEW) ───
  const [internalShowReference, setInternalShowReference] = useState(false)
  const effectiveShowReference = propShowReference !== undefined ? propShowReference : internalShowReference

  const toggleReference = (open: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof open === 'function' ? open(effectiveShowReference) : open
    if (propOnToggleReference) {
      propOnToggleReference(next)
    } else {
      setInternalShowReference(next)
    }
  }

  const [referenceZoom, setReferenceZoom] = useState(100)
  const [referencePan, setReferencePan] = useState({ x: 0, y: 0 })
  const [referenceSize, setReferenceSize] = useState<{ w: number; h: number } | null>(null)
  const [isReferenceDragging, setIsReferenceDragging] = useState(false)
  const referenceCanvasRef = useRef<HTMLDivElement>(null)
  const referenceDragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

  useEffect(() => {
    if (!referenceAsset) {
      toggleReference(false)
      return
    }
    toggleReference(true)
    setReferenceSize(null)
    setReferenceZoom(100)
    setReferencePan({ x: 0, y: 0 })
  }, [referenceAsset])

  useEffect(() => {
    if (!effectiveShowReference) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toggleReference(false)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [effectiveShowReference])

  const fitReference = (size = referenceSize) => {
    const container = referenceCanvasRef.current
    if (!size || !container) {
      setReferenceZoom(100)
      setReferencePan({ x: 0, y: 0 })
      return
    }
    const padding = 48
    const scale = Math.min(
      (container.clientWidth - padding) / size.w,
      (container.clientHeight - padding) / size.h,
      1,
    )
    setReferenceZoom(Math.max(10, Math.round(scale * 100)))
    setReferencePan({ x: 0, y: 0 })
  }

  const handleReferenceWheel = (e: React.WheelEvent) => {
    e.stopPropagation()
    setReferenceZoom((z) => Math.min(400, Math.max(10, z + (e.deltaY < 0 ? 10 : -10))))
  }

  const handleReferenceMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    referenceDragRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: referencePan.x,
      panY: referencePan.y,
    }
    setIsReferenceDragging(true)
  }

  const handleReferenceMouseMove = (e: React.MouseEvent) => {
    const start = referenceDragRef.current
    if (!start) return
    setReferencePan({
      x: start.panX + (e.clientX - start.x),
      y: start.panY + (e.clientY - start.y),
    })
  }

  const endReferenceDrag = () => {
    referenceDragRef.current = null
    setIsReferenceDragging(false)
  }

  const safeCanvasUrl = useMemo(() => {
    if (!url) return ''
    try {
      const sanitized = url.replace(/\[/g, '%5B').replace(/\]/g, '%5D').replace(/\{/g, '%7B').replace(/\}/g, '%7D')
      const parsed = new URL(sanitized)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return sanitized
      return ''
    } catch {
      return ''
    }
  }, [url])

  // ─── TỰ ĐỘNG THỬ LẠI KẾT NỐI MÁY CHỦ (HEALTH CHECK & AUTO-RETRY) ───
  const [isServerReady, setIsServerReady] = useState(false)
  const [connectRetryCount, setConnectRetryCount] = useState(0)
  const [connectTimeout, setConnectTimeout] = useState(false)

  useEffect(() => {
    if (!running || !url) {
      setIsServerReady(false)
      setConnectRetryCount(0)
      setConnectTimeout(false)
      return
    }

    let isMounted = true
    let attempts = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    const checkServer = async () => {
      try {
        // Gửi GET probe tới địa chỉ xem trước; dùng cache 'no-store' và 'no-cors'
        await fetch(url, { method: 'GET', cache: 'no-store', mode: 'no-cors' })
        if (isMounted) {
          setIsServerReady(true)
          setConnectTimeout(false)
        }
      } catch {
        if (!isMounted) return
        attempts++
        setConnectRetryCount(attempts)
        if (attempts >= 30) {
          // Sau khoảng 15 giây thử liên tục mà máy chủ vẫn từ chối
          setConnectTimeout(true)
        }
        // Thử lại sau mỗi 450ms
        timer = setTimeout(checkServer, 450)
      }
    }

    setIsServerReady(false)
    setConnectRetryCount(0)
    setConnectTimeout(false)
    void checkServer()

    return () => {
      isMounted = false
      if (timer) clearTimeout(timer)
    }
  }, [url, running, iframeKey])

  // Tải Design Tokens của dự án để dùng làm mẫu chọn màu & tỷ lệ
  useEffect(() => {
    let isMounted = true
    if (projectPath && api?.tokens?.get) {
      api.tokens
        .get(projectPath)
        .then((t) => {
          if (isMounted) setProjectTokens(t)
        })
        .catch(() => { })
    }
    return () => {
      isMounted = false
    }
  }, [projectPath])
  const moveStartRef = useRef<{
    startX: number
    startY: number
    initialLeft: number
    initialTop: number
    beforeStyles: Record<string, string>
    beforeRect?: { top: number; left: number; width: number; height: number }
    beforeText?: string
    oldParentUid?: string
    oldIndex?: number
  }>({ startX: 0, startY: 0, initialLeft: 0, initialTop: 0, beforeStyles: {} })

  const resizeStartRef = useRef<{
    startX: number
    startY: number
    startWidth: number
    startHeight: number
    beforeStyles: Record<string, string>
    beforeRect?: { top: number; left: number; width: number; height: number }
    beforeText?: string
  }>({ startX: 0, startY: 0, startWidth: 0, startHeight: 0, beforeStyles: {} })

  const [sourceLoc, setSourceLoc] = useState<{
    filePath: string
    fullPath: string
    lineNumber: number
    lineContent: string
  } | null>(null)
  const [isLocatingSource, setIsLocatingSource] = useState(false)
  const [isSyncingCode, setIsSyncingCode] = useState(false)

  // Lưu thuộc tính gốc ban đầu để phục vụ nút Khôi phục gốc
  const [originalStyles, setOriginalStyles] = useState<{
    text: string
    styles: Record<string, string>
  } | null>(null)

  // Toast thông báo nổi HUD cao cấp (Figma / Webflow style)
  interface CanvasToast {
    text: string
    kind?: 'ok' | 'info' | 'warn' | 'err'
    shortcut?: string
  }
  const [toast, setToast] = useState<CanvasToast | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback(
    (msg: string | CanvasToast, kind: 'ok' | 'info' | 'warn' | 'err' = 'ok', shortcut?: string) => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      if (typeof msg === 'string') {
        setToast({ text: msg, kind, shortcut })
      } else {
        setToast(msg)
      }
      toastTimerRef.current = setTimeout(() => {
        setToast(null)
      }, 2400)
    },
    [],
  )

  const currentVp = VIEWPORTS.find((v) => v.key === viewport) ?? VIEWPORTS[0]

  // Báo ngữ cảnh phần tử đang chọn ra ngoài cho AI Panel.
  useEffect(() => {
    if (!onSelectionChange) return
    if (multiSelection.length > 1) {
      const summaryText = multiSelection
        .map((el, i) => `${i + 1}. <${el.tagName}${el.id ? `#${el.id}` : ''}>: "${el.textSnippet || ''}"`)
        .join('\n')
      onSelectionChange({
        tag: `Vùng khoanh (${multiSelection.length} phần tử)`,
        id: undefined,
        className: undefined,
        text: summaryText,
        outerHTML: multiSelection.map((el) => el.outerHTML).join('\n'),
        computedStyles: selectedEl?.computedStyles as unknown as Record<string, string>,
        selector: multiSelection.map((el) => el.selector).join(', '),
        filePath: sourceLoc?.fullPath || sourceLoc?.filePath,
        lineNumber: sourceLoc?.lineNumber,
      })
      return
    }
    if (!selectedEl) {
      onSelectionChange(null)
      return
    }
    onSelectionChange({
      tag: selectedEl.tagName,
      id: selectedEl.id || undefined,
      className: selectedEl.className || undefined,
      text: selectedEl.textSnippet || undefined,
      outerHTML: selectedEl.outerHTML,
      computedStyles: selectedEl.computedStyles as unknown as Record<string, string>,
      selector: selectedEl.selector,
      filePath: sourceLoc?.fullPath || sourceLoc?.filePath,
      lineNumber: sourceLoc?.lineNumber,
    })
  }, [selectedEl, multiSelection, sourceLoc, onSelectionChange])

  // Zoom to Fit (F) — tính theo đúng kích thước sân khấu để khung thiết bị vừa khít.
  const zoomToFit = useCallback(
    (vp: ViewportConfig = currentVp) => {
      const stage = stageRef.current
      if (!stage) return
      if (vp.key === 'responsive' || !vp.w || !vp.h) {
        // Chế độ toàn khung đã phủ 100% sân khấu.
        setZoom(100)
        setPan({ x: 0, y: 0 })
        return
      }
      const PADDING = 48 // chừa viền hai bên cho dễ thở
      const FRAME_BAR = 30 // thanh tiêu đề của khung thiết bị
      const stageW = stage.clientWidth - PADDING
      const stageH = stage.clientHeight - PADDING
      if (stageW <= 0 || stageH <= 0) return
      const scaleX = stageW / vp.w
      const scaleY = stageH / (vp.h + FRAME_BAR)
      const next = Math.round(Math.min(scaleX, scaleY) * 100)
      setZoom(Math.max(10, Math.min(200, next)))
      setPan({ x: 0, y: 0 })
    },
    [currentVp.key, currentVp.w, currentVp.h],
  )

  // Nhập % phóng to trực tiếp trên thanh công cụ.
  const beginZoomEdit = useCallback(() => {
    setZoomDraft(String(zoom))
    setZoomEditing(true)
  }, [zoom])

  const commitZoomEdit = useCallback(() => {
    const parsed = Number.parseInt(zoomDraft.replace(/[^\d]/g, ''), 10)
    if (Number.isFinite(parsed)) {
      const next = Math.max(10, Math.min(200, parsed))
      setZoom(next)
      // "Toàn khung" luôn phủ kín 100%, nên đổi % chỉ có ý nghĩa ở khung thiết bị.
      if (viewport === 'responsive' && next !== 100) setViewport('desktop')
    }
    setZoomEditing(false)
  }, [zoomDraft, viewport])

  useEffect(() => {
    if (!zoomEditing) return
    const input = zoomInputRef.current
    input?.focus()
    input?.select()
  }, [zoomEditing])

  // Lắng nghe phím tắt bàn phím
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable)) {
        return
      }
      // Chế độ Đa màn hình có bộ phím tắt riêng: không để phím tắt Canvas can thiệp.
      if (isPageFlowOpen) return
      // Không xử lý phím tắt khi đang mở hộp thoại (diff, tokens, v.v.)
      const hasDialog = Boolean(document.querySelector('.pm-overlay'))

      // Phím tắt toàn cục: Hoàn tác (Ctrl+Z), Làm lại (Ctrl+Y hoặc Ctrl+Shift+Z), Lưu (Ctrl+S)
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault()
          if (e.shiftKey) {
            if (editorBuffer.canRedo()) editorBuffer.redo()
          } else {
            if (editorBuffer.canUndo()) editorBuffer.undo()
          }
          return
        }
        if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault()
          if (editorBuffer.canRedo()) editorBuffer.redo()
          return
        }
        if (e.key === 's' || e.key === 'S') {
          e.preventDefault()
          editorBuffer.saveAllDirtyFiles(showToast)
          return
        }
        if (e.key === 'd' || e.key === 'D') {
          if (selectedEl && !pendingMutation && !hasDialog) {
            e.preventDefault()
            void beginToolboxDuplicate()
          }
          return
        }
        if (e.key === 'k' || e.key === 'K') {
          if (selectedEl && !pendingMutation && !hasDialog) {
            e.preventDefault()
            setIsSidecarOpen((open) => !open)
            return
          }
        }
        if (e.key === 'c' || e.key === 'C') {
          if ((selectedEl || multiSelection.length > 0) && !hasDialog) {
            e.preventDefault()
            canvasActionsRef.current.copy()
          }
          return
        }
        if (e.key === 'v' || e.key === 'V') {
          if (isInspectMode && !hasDialog && !pendingMutation) {
            e.preventDefault()
            canvasActionsRef.current.paste()
          }
          return
        }
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedEl || multiSelection.length > 0) && !pendingMutation && !hasDialog) {
        e.preventDefault()
        canvasActionsRef.current.deleteSelection()
        return
      }

      if (e.shiftKey && (e.key === 'a' || e.key === 'A')) {
        if (selectedEl && !pendingMutation && !hasDialog) {
          e.preventDefault()
          setIsSidecarOpen((open) => !open)
          return
        }
      }

      if (e.code === 'Space' && !e.repeat) {
        spacePressedRef.current = true
        if (stageRef.current) stageRef.current.style.cursor = 'grab'
      }

      const key = e.key.toUpperCase()
      if (key === 'V') setTool('select')
      else if (key === 'H') setTool('pan')
      else if (key === 'R') setTool('rect')
      else if (key === 'T') setTool('text')
      else if (key === 'C') setTool('comment')
      else if (key === 'M') setTool('measure')
      else if (key === 'F') zoomToFit()
      else if (key === 'I') {
        const next = !isInspectMode
        setIsInspectMode(next)
        if (!next) {
          setSelectedEl(null)
          setHoverEl(null)
          setMultiSelection([])
          iframeRef.current?.contentWindow?.postMessage({ type: 'PM_CLEAR_MULTI_SELECTION' }, '*')
        }
        showToast(
          next ? 'Đã bật chế độ Soi phần tử' : 'Đã tắt chế độ Soi phần tử',
          next ? 'ok' : 'info',
          next ? 'Phím I' : undefined,
        )
      } else if (e.key === 'Escape') {
        if (isSidecarOpen) {
          setIsSidecarOpen(false)
          return
        }
        if (selectedEl || multiSelection.length > 0) {
          setSelectedEl(null)
          setMultiSelection([])
          iframeRef.current?.contentWindow?.postMessage({ type: 'PM_CLEAR_MULTI_SELECTION' }, '*')
        } else if (isInspectMode) {
          setIsInspectMode(false)
          setHoverEl(null)
          showToast('Đã tắt chế độ Soi phần tử', 'info')
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spacePressedRef.current = false
        if (stageRef.current) {
          stageRef.current.style.cursor = ''
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [isInspectMode, isSidecarOpen, selectedEl, multiSelection.length, zoomToFit, showToast, sourceLoc?.fullPath, projectPath, pendingMutation, isPageFlowOpen])

  // Xử lý zoom bằng bánh lăn chuột (Ctrl + Wheel)
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -5 : 5
      setZoom((z) => Math.max(10, Math.min(200, z + delta)))
    } else {
      setPan((p) => ({
        x: p.x - e.deltaX,
        y: p.y - e.deltaY,
      }))
    }
  }

  // Xử lý kéo Pan sân khấu
  const isPanActive = tool === 'pan' || spacePressedRef.current

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isPanActive || e.button === 1) {
      e.preventDefault()
      setIsPanning(true)
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      })
    }
  }

  const handleMouseUp = () => {
    if (isPanning) setIsPanning(false)
  }

  // ─── LẮNG NGHE POSTMESSAGE TỪ TRÌNH DUYỆT THẬT (IFRAME) ───
  useEffect(() => {
    const handleWindowMessage = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return

      if (e.data.type === 'PM_LOCATION_CHANGE') {
        const { pathname, href, docId } = e.data.payload || {}
        // Phát hiện iframe được tải lại (hot-reload của dev server hoặc điều hướng cứng).
        // Khi tài liệu đổi, mọi uid cũ không còn giá trị → tăng epoch để vô hiệu
        // hoá các thao tác DOM thủ công khi Undo/Redo.
        if (typeof docId === 'string' && docId && docId !== docIdRef.current) {
          const isReload = docIdRef.current !== null
          docIdRef.current = docId
          if (isReload) {
            docEpochRef.current += 1
            editorBuffer.setDocumentEpoch(docEpochRef.current)
            setSelectedEl(null)
            setMultiSelection([])
          }
        }
        const previousRoute = currentRouteRef.current
        if (pathname) {
          currentRouteRef.current = pathname
        }
        // Chuyển trang: vùng chọn của trang cũ không còn ý nghĩa
        if (pathname && pathname !== previousRoute) {
          setSelectedEl(null)
          setMultiSelection([])
          iframeRef.current?.contentWindow?.postMessage({ type: 'PM_CLEAR_MULTI_SELECTION' }, '*')
        }
        if (href) {
          if (/^https?:/i.test(href)) {
            setCurrentLiveUrl(href)
            onUrlChange?.(href, pathname || '/')
          }
        } else if (pathname && url && /^https?:/i.test(url)) {
          try {
            const parsed = new URL(url)
            parsed.pathname = pathname
            const newHref = parsed.href
            setCurrentLiveUrl(newHref)
            onUrlChange?.(newHref, pathname)
          } catch { }
        }
      } else if (e.data.type === 'PM_DROP_TARGET_HOVER') {
        setDropTargetHover(e.data.payload || null)
      } else if (e.data.type === 'PM_REPARENT_NOTIFY') {
        const payload = e.data || {}
        const targetUid = payload.uid || selectedEl?.uid
        const oldParentUid = payload.oldParentUid || moveStartRef.current?.oldParentUid || selectedEl?.parent?.uid || ''
        const oldIndex = typeof payload.oldIndex === 'number' && payload.oldIndex >= 0
          ? payload.oldIndex
          : (moveStartRef.current?.oldIndex ?? -1)
        let newParentUid = payload.newParentUid || ''
        let newIndex = typeof payload.newIndex === 'number' ? payload.newIndex : -1

        void (async () => {
          let el: HTMLElement | null = null
          let parentEl: HTMLElement | null = null
          let prevSibling: HTMLElement | null = null
          let nextSibling: HTMLElement | null = null

          try {
            const doc = iframeRef.current?.contentDocument || iframeRef.current?.contentWindow?.document
            if (doc && targetUid) {
              el = doc.querySelector(`[data-pm-uid="${targetUid}"]`) as HTMLElement | null
              if (el && el.parentElement) {
                if (!el.parentElement.getAttribute('data-pm-uid')) {
                  el.parentElement.setAttribute('data-pm-uid', 'pm_' + Math.random().toString(36).slice(2, 9))
                }
                if (!newParentUid) {
                  newParentUid = el.parentElement.getAttribute('data-pm-uid') || ''
                }
                if (newIndex < 0) {
                  newIndex = Array.prototype.indexOf.call(el.parentElement.childNodes, el)
                }
                parentEl = el.parentElement as HTMLElement
                prevSibling = el.previousElementSibling as HTMLElement | null
                nextSibling = el.nextElementSibling as HTMLElement | null
              }
            }
          } catch { }

          if (!targetUid || !projectPath) return

          const tagName = (el?.tagName || payload.tagName || selectedEl?.tagName || 'div').toLowerCase()

          const targetMutation: ElementMutationTarget = {
            tagName,
            id: el?.id || selectedEl?.id,
            className: el?.className || selectedEl?.className,
            domPath: selectedEl?.domPath,
            uid: targetUid,
            selector: selectedEl?.selector,
            textSnippet: el?.textContent?.trim().slice(0, 80) || selectedEl?.textSnippet,
            currentPath: currentRouteRef.current,
            fullPath: sourceLoc?.fullPath,
            lineNumber: sourceLoc?.lineNumber,
          }

          let targetParent: ElementMutationTarget | undefined
          if (parentEl && parentEl.tagName.toLowerCase() !== 'body') {
            targetParent = {
              tagName: parentEl.tagName.toLowerCase(),
              id: parentEl.id,
              className: parentEl.className,
              uid: newParentUid,
              textSnippet: parentEl.textContent?.trim().slice(0, 80),
              currentPath: currentRouteRef.current,
            }
          }

          let targetSibling: ElementMutationTarget | undefined
          let placement: InsertPlacement = 'inside'
          if (nextSibling) {
            targetSibling = {
              tagName: nextSibling.tagName.toLowerCase(),
              id: nextSibling.id,
              className: nextSibling.className,
              uid: nextSibling.getAttribute('data-pm-uid') || undefined,
              textSnippet: nextSibling.textContent?.trim().slice(0, 80),
              currentPath: currentRouteRef.current,
            }
            placement = 'before'
          } else if (prevSibling) {
            targetSibling = {
              tagName: prevSibling.tagName.toLowerCase(),
              id: prevSibling.id,
              className: prevSibling.className,
              uid: prevSibling.getAttribute('data-pm-uid') || undefined,
              textSnippet: prevSibling.textContent?.trim().slice(0, 80),
              currentPath: currentRouteRef.current,
            }
            placement = 'after'
          }

          let fileBefore: string | undefined
          let fileAfter: string | undefined
          let reparentSourceLoc = sourceLoc ? { ...sourceLoc } : null

          // Thực hiện ghi cấu trúc mới xuống mã nguồn
          try {
            const mutateRes = await api.toolbox.mutate({
              kind: 'reparent',
              projectPath,
              target: targetMutation,
              targetParent,
              targetSibling,
              placement,
              index: newIndex,
              dryRun: false,
            })

            if (mutateRes.success && mutateRes.newText !== undefined) {
              fileBefore = mutateRes.oldText
              fileAfter = mutateRes.newText
              if (mutateRes.fullPath) {
                reparentSourceLoc = {
                  filePath: mutateRes.filePath || '',
                  fullPath: mutateRes.fullPath,
                  lineNumber: mutateRes.startLine || 1,
                  lineContent: '',
                }
              }
              showToast(
                `Đã chuyển <${tagName}> và ghi cấu trúc vào mã nguồn thành công!`
              )
            } else {
              showToast(payload.message || 'Đã cập nhật phân cấp phần tử trên giao diện!')
            }
          } catch {
            showToast(payload.message || 'Đã cập nhật phân cấp phần tử!')
          }

          editorBuffer.pushAction({
            type: 'MOVE',
            description: `Chuyển vị trí <${tagName}>`,
            target: {
              tagName,
              id: targetMutation.id,
              className: targetMutation.className,
              domPath: targetMutation.domPath,
              uid: targetUid,
              selector: targetMutation.selector,
              textSnippet: targetMutation.textSnippet,
            },
            sourceLoc: reparentSourceLoc
              ? {
                  filePath: reparentSourceLoc.filePath,
                  fullPath: reparentSourceLoc.fullPath,
                  lineNumber: reparentSourceLoc.lineNumber,
                }
              : undefined,
            before: {
              styles: {},
            },
            after: {
              styles: {},
            },
            dom: {
              kind: 'move',
              targetUid: targetUid,
              parentUid: newParentUid,
              index: newIndex,
              oldParentUid,
              oldIndex,
            },
            fileBefore,
            fileAfter,
            projectPath,
            docEpoch: docEpochRef.current,
          })
        })()
      } else if (e.data.type === 'PM_HOVER_ELEMENT') {
        if (!hoverOutline) {
          if (hoverEl) setHoverEl(null)
        } else {
          setHoverEl(e.data.payload)
        }
      } else if (e.data.type === 'PM_SELECT_ELEMENT') {
        if (e.data.payload) {
          const payload = e.data.payload as RealElementInfo
          // Phát sự kiện element-picked ra toàn ứng dụng (cho AI Panel)
          window.dispatchEvent(new CustomEvent('pixelmind:element-picked', { detail: payload }))
          // Click chọn một phần tử: xoá vùng chọn nhiều trước đó
          if (e.data.source === 'click') {
            setMultiSelection([])
          }
          setSelectedEl(payload)
          setHoverEl(null)
          if (!isInspectMode) {
            setIsInspectMode(true)
          }
          if (payload.currentPath) {
            currentRouteRef.current = payload.currentPath
          }
          if (!e.data.isReset && !originalStyles) {
            setOriginalStyles({
              text: payload.textSnippet,
              styles: { ...payload.computedStyles },
            })
          }
        }
      } else if (e.data.type === 'PM_SELECTION_CHANGED') {
        const payload = e.data.payload || {}
        const items = Array.isArray(payload.items) ? (payload.items as RealElementInfo[]) : []
        setMultiSelection(items)
        setHoverEl(null)
        if (items.length > 0) {
          // Phát sự kiện area-picked ra toàn ứng dụng (cho AI Panel)
          window.dispatchEvent(new CustomEvent('pixelmind:area-picked', { detail: items }))
        }
        if (payload.primary) {
          const primary = payload.primary as RealElementInfo
          setSelectedEl(primary)
          if (primary.currentPath) {
            currentRouteRef.current = primary.currentPath
          }
          if (!originalStyles) {
            setOriginalStyles({
              text: primary.textSnippet,
              styles: { ...primary.computedStyles },
            })
          }
        } else if (items.length === 0) {
          setSelectedEl(null)
        }
      } else if (e.data.type === 'PM_KEYBOARD_SHORTCUT') {
        const { key, shiftKey, ctrlKey } = e.data.payload || {}
        if (key === 's') {
          editorBuffer.saveAllDirtyFiles(showToast)
        } else if (key === 'z' && !shiftKey) {
          if (editorBuffer.canUndo()) editorBuffer.undo()
        } else if (key === 'y' || (key === 'z' && shiftKey)) {
          if (editorBuffer.canRedo()) editorBuffer.redo()
        } else if (key === 'delete' || key === 'backspace') {
          canvasActionsRef.current.deleteSelection()
        } else if (key === 'd' && ctrlKey) {
          void beginToolboxDuplicate()
        } else if (key === 'c' && ctrlKey) {
          canvasActionsRef.current.copy()
        } else if (key === 'v' && ctrlKey) {
          canvasActionsRef.current.paste()
        }
      } else if (e.data.type === 'PM_TOOLBOX_DOM_RESULT') {
        const resolver = toolboxRequestsRef.current.get(e.data.requestId)
        if (resolver) {
          toolboxRequestsRef.current.delete(e.data.requestId)
          resolver(e.data)
        }
      } else if (e.data.type === 'PM_TOOLBOX_DROP_HOVER') {
        setToolboxDropHover(e.data.payload || null)
      } else if (e.data.type === 'PM_TOOLBOX_DROP') {
        const item = toolboxDrag.current()
        if (item) {
          toolboxDrag.end()
          void beginToolboxInsert(item, {
            targetUid: e.data.payload?.targetUid,
            placement: e.data.payload?.placement,
          })
        }
      } else if (e.data.type === 'PM_ELEMENT_CONTEXTMENU') {
        const payload = e.data.payload
        if (payload?.info) {
          setSelectedEl(payload.info)
          setCanvasContextMenu({
            x: payload.clientX,
            y: payload.clientY,
            info: payload.info,
          })
        }
      }
    }

    window.addEventListener('message', handleWindowMessage)
    return () => window.removeEventListener('message', handleWindowMessage)
  }, [isInspectMode, selectedEl, originalStyles, showToast, sourceLoc?.fullPath, projectPath])

  useEffect(() => {
    const handleDismissMenu = () => setCanvasContextMenu(null)
    window.addEventListener('click', handleDismissMenu)
    return () => window.removeEventListener('click', handleDismissMenu)
  }, [])

  // Đồng bộ trạng thái inspect mode xuống Electron main process và iframe
  useEffect(() => {
    api.inspect.setMode(isInspectMode).catch(() => { })

    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'PM_SET_INSPECT_MODE', enabled: isInspectMode },
        '*'
      )
    }
    if (!isInspectMode) {
      setMultiSelection([])
    }
  }, [isInspectMode])

  // Lắng nghe kích hoạt chế độ Soi / Khoanh vùng từ AI Panel
  useEffect(() => {
    const handleInspectRequest = (e: Event) => {
      const detail = (e as CustomEvent<{ mode: 'single' | 'area' }>).detail
      setIsInspectMode(true)
      if (detail?.mode === 'single') {
        showToast('Cây bút: Hãy nhấp vào 1 phần tử trên Canvas để đính kèm vào AI', 'info')
      } else if (detail?.mode === 'area') {
        showToast('Cây bút: Hãy kéo chuột khoanh 1 vùng trên Canvas để đính kèm vào AI', 'info')
      }
    }
    window.addEventListener('pixelmind:enable-inspect', handleInspectRequest)
    return () => {
      window.removeEventListener('pixelmind:enable-inspect', handleInspectRequest)
    }
  }, [showToast])

  // Reset modified styles khi chọn phần tử khác & phát sự kiện đồng bộ toàn ứng dụng
  useEffect(() => {
    setModifiedStyles({})
    setOriginalStyles(null)
    window.dispatchEvent(
      new CustomEvent('pm:selected-element-changed', { detail: selectedEl })
    )
  }, [selectedEl])

  // Lắng nghe thay đổi của EditorBuffer (Dirty flag cho RAM Designer)
  useEffect(() => {
    return editorBuffer.subscribe(() => {
      setIsDirtyBuffer(editorBuffer.isDirty())
    })
  }, [])

  // Đăng ký bộ xử lý phản chiếu Undo/Redo lên DOM thật trong iframe
  useEffect(() => {
    const unsub = editorBuffer.onApplyHistory((action, isUndo) => {
      // Nếu iframe đã tải lại kể từ lúc thao tác được ghi (hot-reload của dev server),
      // DOM hiện tại đã được render lại từ mã nguồn. Chèn/xoá DOM thủ công lúc này sẽ
      // tạo phần tử trùng lặp chồng lên nhau. Chỉ cần phần ghi tệp ở editorBuffer là đủ.
      if (action.dom && action.docEpoch !== undefined && action.docEpoch !== docEpochRef.current) {
        return
      }
      // ── Thao tác Hộp công cụ: phản chiếu bằng DOM op thay vì style delta ──
      if (action.dom) {
        const dom = action.dom
        if (dom.kind === 'insert' || dom.kind === 'duplicate') {
          if (isUndo) {
            void sendToolboxMessage('PM_TOOLBOX_DOM_REMOVE', { uids: dom.uids || [] })
          } else {
            void sendToolboxMessage('PM_TOOLBOX_DOM_INSERT', {
              parentUid: dom.parentUid,
              index: dom.index,
              html: dom.html,
            }).then((data) => {
              if (data?.result?.uids) dom.uids = data.result.uids
            })
          }
        } else if (dom.kind === 'delete') {
          if (isUndo) {
            void sendToolboxMessage('PM_TOOLBOX_DOM_INSERT', {
              parentUid: dom.parentUid,
              index: dom.index,
              html: dom.html,
            })
          } else {
            void sendToolboxMessage('PM_TOOLBOX_DOM_REMOVE', { uids: dom.uids || [] })
          }
        } else if (dom.kind === 'delete-batch') {
          if (isUndo) {
            const records = (dom.records || []).slice().sort((a, b) => a.index - b.index)
            void (async () => {
              for (const record of records) {
                await sendToolboxMessage('PM_TOOLBOX_DOM_INSERT', {
                  parentUid: record.parentUid,
                  index: record.index,
                  html: record.html,
                })
              }
            })()
          } else {
            void sendToolboxMessage('PM_TOOLBOX_DOM_REMOVE', { uids: dom.uids || [] })
          }
        } else if (dom.kind === 'attributes') {
          void sendToolboxMessage('PM_TOOLBOX_DOM_ATTRS', {
            uid: dom.targetUid,
            attributes: isUndo ? dom.attributesBefore : dom.attributesAfter,
            text: isUndo ? dom.textBefore : dom.textAfter,
          })
        } else if (dom.kind === 'move') {
          const targetUid = dom.targetUid || action.target.uid
          const targetParentUid = isUndo ? dom.oldParentUid : dom.parentUid
          const targetIndex = isUndo ? dom.oldIndex : dom.index

          // 1. Khôi phục trực tiếp trên DOM của iframe (hoạt động tức thì mà không phụ thuộc phiên bản script backend)
          try {
            const doc = iframeRef.current?.contentDocument || iframeRef.current?.contentWindow?.document
            if (doc && targetUid) {
              const moveEl = doc.querySelector(`[data-pm-uid="${targetUid}"]`) as HTMLElement | null
              let targetParent: Element | null = null
              if (targetParentUid) {
                targetParent = doc.querySelector(`[data-pm-uid="${targetParentUid}"]`)
                if (!targetParent && (targetParentUid === 'pm_body' || (doc.body && targetParentUid === doc.body.getAttribute('data-pm-uid')))) {
                  targetParent = doc.body
                }
              } else {
                targetParent = doc.body
              }

              if (moveEl && targetParent && moveEl !== targetParent && !moveEl.contains(targetParent)) {
                const siblings = Array.prototype.filter.call(targetParent.childNodes, (n: ChildNode) => n !== moveEl)
                const targetRef = (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex < siblings.length)
                  ? siblings[targetIndex]
                  : null
                targetParent.insertBefore(moveEl, targetRef)
                moveEl.style.removeProperty('top')
                moveEl.style.removeProperty('left')
                moveEl.style.removeProperty('right')
                moveEl.style.removeProperty('bottom')
                if (moveEl.style.position === 'relative') {
                  moveEl.style.removeProperty('position')
                }
              }
            }
          } catch (err) {
            console.error('[Undo/Redo MOVE] Error reverting DOM node:', err)
          }

          // 2. Gửi lệnh hoàn tác/làm lại qua giao tiếp postMessage
          if (targetParentUid !== undefined && typeof targetIndex === 'number') {
            void sendToolboxMessage('PM_TOOLBOX_DOM_MOVE', {
              uid: targetUid,
              parentUid: targetParentUid,
              index: targetIndex,
            })
          }

          // 3. Làm mới cây phân cấp phần tử và cập nhật viền chọn
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({ type: 'PM_GET_DOM_TREE' }, '*')
            if (targetUid) {
              iframeRef.current.contentWindow.postMessage({ type: 'PM_SELECT_BY_UID', uid: targetUid }, '*')
            }
          }
        }
        showToast(isUndo ? `↶ Hoàn tác: ${action.description}` : `↷ Làm lại: ${action.description}`)
        return
      }

      // 1. Chỉ lấy đúng các thuộc tính style delta thực tế thay vì áp đặt cả 50 computed styles
      const delta = action.deltaStyles || {}
      const deltaKeys = Object.keys(delta)
      if (deltaKeys.length === 0 && action.after.styles && action.before.styles) {
        for (const [k, v] of Object.entries(action.after.styles)) {
          if (action.before.styles[k] !== v) {
            deltaKeys.push(k)
          }
        }
      }

      const stylesToApply: Record<string, string> = {}
      for (const k of deltaKeys) {
        if (isUndo) {
          // Khi Hoàn tác (Undo): khôi phục lại giá trị trước đó (hoặc đặt rỗng '' để xóa inline style)
          stylesToApply[k] = action.before.styles[k] || ''
        } else {
          // Khi Làm lại (Redo): áp dụng lại giá trị sau thay đổi
          stylesToApply[k] = action.after.styles[k] || delta[k] || ''
        }
      }

      // QUAN TRỌNG: Chỉ gửi textContent khi hành động là TEXT! Tuyệt đối không gửi textContent khi hành động là MOVE, RESIZE, hoặc STYLE
      const isTextAction = action.type === 'TEXT'
      const textToApply = isTextAction ? (isUndo ? action.before.text : action.after.text) : undefined

      // 2. Phản chiếu ngược lại iframe DOM cho ĐÚNG phần tử mục tiêu (action.target)
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: 'PM_APPLY_STYLE',
            payload: {
              target: {
                tagName: action.target.tagName,
                id: action.target.id,
                className: action.target.className,
                domPath: action.target.domPath,
                uid: action.target.uid,
                selector: action.target.selector,
                textSnippet: action.target.textSnippet,
              },
              styles: stylesToApply,
              textContent: textToApply,
            },
          },
          '*'
        )
      }

      // 3. Cập nhật state selectedEl chuyển sang đúng phần tử mục tiêu
      setSelectedEl((prev) => {
        const isSame = prev && (
          (action.target.uid && prev.uid === action.target.uid) ||
          (action.target.selector && prev.selector === action.target.selector) ||
          (action.target.id && prev.id === action.target.id) ||
          (action.target.domPath && prev.domPath === action.target.domPath)
        )

        const baseStyles = isSame ? { ...prev.computedStyles } : { ...(action.before.styles || {}) }
        for (const k of deltaKeys) {
          if (isUndo) {
            if (action.before.styles[k]) {
              baseStyles[k] = action.before.styles[k]
            } else {
              delete (baseStyles as any)[k]
            }
          } else {
            baseStyles[k] = stylesToApply[k]
          }
        }

        const rectToUse = isUndo ? action.before.rect : action.after.rect

        return {
          uid: action.target.uid || prev?.uid,
          selector: action.target.selector || prev?.selector,
          tagName: action.target.tagName,
          id: action.target.id || '',
          className: action.target.className || '',
          domPath: action.target.domPath || prev?.domPath || '',
          textSnippet: isTextAction && textToApply !== undefined ? textToApply : (action.before.text || prev?.textSnippet || ''),
          rect: rectToUse ? { ...(prev?.rect || { top: 0, left: 0, width: 0, height: 0 }), ...rectToUse } : (prev?.rect || { top: 0, left: 0, width: 0, height: 0 }),
          computedStyles: baseStyles as any,
          isLeaf: prev?.isLeaf,
          childrenCount: prev?.childrenCount,
        }
      })

      // 4. Cập nhật modifiedStyles
      setModifiedStyles((prev) => {
        const next = { ...prev }
        for (const k of deltaKeys) {
          if (isUndo) {
            delete next[k]
          } else {
            next[k] = stylesToApply[k]
          }
        }
        return next
      })

      showToast(isUndo ? `↶ Hoàn tác: ${action.description}` : `↷ Làm lại: ${action.description}`)
    })

    return unsub
  }, [showToast])

  // ─── ÁP DỤNG THAY ĐỔI LIVE (STYLE / TEXT) & ĐẨY VÀO RAM BUFFER ───
  const handleApplyLiveChange = useCallback(
    (
      styles?: Record<string, string>,
      textContent?: string,
      options?: { skipHistory?: boolean; description?: string; actionType?: ActionType }
    ) => {
      if (!selectedEl) return

      if (styles) {
        setModifiedStyles((prev) => ({ ...prev, ...styles }))
      }

      // ─── Đang chọn nhiều phần tử: áp dụng cùng một thay đổi style cho TẤT CẢ ───
      const multiTargets = multiSelectionRef.current
      if (styles && multiTargets.length > 1) {
        const description = options?.description || `Chỉnh sửa ${multiTargets.length} phần tử`
        const win = iframeRef.current?.contentWindow
        const doc = iframeRef.current?.contentDocument
        const toCssProperty = (key: string) => key.replace(/([A-Z])/g, '-$1').toLowerCase()

        const nextItems = multiTargets.map((item) => {
          const el = item.uid
            ? (doc?.querySelector(`[data-pm-uid="${item.uid}"]`) as HTMLElement | null)
            : null

          // Cập nhật trực tiếp DOM để mọi phần tử đổi ngay, kể cả khi iframe chậm phản hồi.
          if (el) {
            for (const [key, value] of Object.entries(styles)) {
              const property = toCssProperty(key)
              if (!value) el.style.removeProperty(property)
              else el.style.setProperty(property, value)
            }
          }

          win?.postMessage(
            {
              type: 'PM_APPLY_STYLE',
              payload: { target: item, styles },
            },
            '*'
          )

          const nextStyles = { ...item.computedStyles, ...styles }
          if (!options?.skipHistory) {
            editorBuffer.pushAction({
              type: options?.actionType || 'STYLE',
              description,
              target: {
                tagName: item.tagName,
                id: item.id,
                className: item.className,
                domPath: item.domPath,
                uid: item.uid,
                selector: item.selector,
                textSnippet: item.textSnippet,
              },
              before: {
                styles: { ...item.computedStyles },
                text: item.textSnippet,
                rect: { ...item.rect },
              },
              after: {
                styles: nextStyles,
                text: item.textSnippet,
                rect: { ...item.rect },
              },
              deltaStyles: styles,
            })
          }

          return { ...item, computedStyles: nextStyles }
        })

        setMultiSelection(nextItems)
        setSelectedEl((prev) =>
          prev ? { ...prev, computedStyles: { ...prev.computedStyles, ...styles } } : prev
        )
        return
      }

      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: 'PM_APPLY_STYLE',
            payload: {
              target: {
                tagName: selectedEl.tagName,
                id: selectedEl.id,
                className: selectedEl.className,
                domPath: selectedEl.domPath,
                uid: selectedEl.uid,
                selector: selectedEl.selector,
                textSnippet: selectedEl.textSnippet,
              },
              styles,
              textContent,
            },
          },
          '*'
        )
      }

      api.inspect.applyStyle({ styles, textContent }).catch(() => { })

      const beforeSnapshot: ElementSnapshot = {
        styles: { ...selectedEl.computedStyles },
        text: selectedEl.textSnippet,
        rect: { ...selectedEl.rect },
      }

      const nextStyles = {
        ...selectedEl.computedStyles,
        ...(styles || {}),
      }
      const nextText = typeof textContent === 'string' ? textContent : selectedEl.textSnippet

      setSelectedEl((prev) => {
        if (!prev) return null
        return {
          ...prev,
          textSnippet: nextText,
          computedStyles: nextStyles,
        }
      })

      if (!options?.skipHistory) {
        editorBuffer.pushAction({
          type: options?.actionType || (textContent !== undefined ? 'TEXT' : 'STYLE'),
          description: options?.description || `Chỉnh sửa <${selectedEl.tagName.toLowerCase()}>`,
          target: {
            tagName: selectedEl.tagName,
            id: selectedEl.id,
            className: selectedEl.className,
            domPath: selectedEl.domPath,
            uid: selectedEl.uid,
            selector: selectedEl.selector,
            textSnippet: selectedEl.textSnippet,
          },
          sourceLoc: sourceLoc
            ? {
              filePath: sourceLoc.filePath,
              fullPath: sourceLoc.fullPath,
              lineNumber: sourceLoc.lineNumber,
            }
            : undefined,
          before: beforeSnapshot,
          after: {
            styles: nextStyles,
            text: nextText,
            rect: { ...selectedEl.rect },
          },
          deltaStyles: styles,
        })
      }
    },
    [selectedEl, sourceLoc]
  )

  // Lắng nghe sự kiện áp dụng token trực tiếp từ Design Sidebar
  useEffect(() => {
    const handleApplyTokenStyle = (e: Event) => {
      const custom = e as CustomEvent<{
        styles: Record<string, string>
        textContent?: string
        tokenName?: string
      }>
      if (!custom.detail?.styles) return
      if (selectedEl) {
        handleApplyLiveChange(custom.detail.styles, custom.detail.textContent, {
          description: `Áp dụng token ${custom.detail.tokenName || ''}`,
        })
      }
    }
    window.addEventListener('pm:apply-token-style', handleApplyTokenStyle)
    return () => window.removeEventListener('pm:apply-token-style', handleApplyTokenStyle)
  }, [selectedEl, handleApplyLiveChange])

  // ─── KÉO CO GIÃN 8 ĐIỂM NEO PHẦN TỬ THẬT ───
  const handleStartElementResize = (e: React.MouseEvent, handle: HandleDirection) => {
    e.preventDefault()
    e.stopPropagation()
    if (!selectedEl) return

    resizeStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: selectedEl.rect.width,
      startHeight: selectedEl.rect.height,
      beforeStyles: { ...selectedEl.computedStyles },
      beforeRect: { ...selectedEl.rect },
      beforeText: selectedEl.textSnippet,
    }

    setResizingEl({
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: selectedEl.rect.width,
      startHeight: selectedEl.rect.height,
      startTop: selectedEl.rect.top,
      startLeft: selectedEl.rect.left,
    })
  }

  useEffect(() => {
    if (!resizingEl) return

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      const scale = zoom / 100
      const dx = (e.clientX - resizingEl.startX) / scale
      const dy = (e.clientY - resizingEl.startY) / scale

      let newWidth = resizingEl.startWidth
      let newHeight = resizingEl.startHeight
      let newTop = resizingEl.startTop
      let newLeft = resizingEl.startLeft

      if (resizingEl.handle.includes('e')) newWidth = Math.max(10, resizingEl.startWidth + dx)
      if (resizingEl.handle.includes('s')) newHeight = Math.max(10, resizingEl.startHeight + dy)
      if (resizingEl.handle.includes('w')) {
        newWidth = Math.max(10, resizingEl.startWidth - dx)
        newLeft = resizingEl.startLeft + (resizingEl.startWidth - newWidth)
      }
      if (resizingEl.handle.includes('n')) {
        newHeight = Math.max(10, resizingEl.startHeight - dy)
        newTop = resizingEl.startTop + (resizingEl.startHeight - newHeight)
      }

      setSelectedEl((prev) => {
        if (!prev) return null
        return {
          ...prev,
          rect: {
            ...prev.rect,
            width: Math.round(newWidth),
            height: Math.round(newHeight),
            top: Math.round(newTop),
            left: Math.round(newLeft),
          },
          computedStyles: {
            ...prev.computedStyles,
            width: `${Math.round(newWidth)}px`,
            height: `${Math.round(newHeight)}px`,
          },
        }
      })

      handleApplyLiveChange(
        {
          width: `${Math.round(newWidth)}px`,
          height: `${Math.round(newHeight)}px`,
        },
        undefined,
        { skipHistory: true }
      )
    }

    const handleMouseUp = () => {
      setResizingEl(null)
      const initial = resizeStartRef.current
      if (!selectedEl || !initial.startWidth) return

      const curW = parseInt(selectedEl.computedStyles.width) || selectedEl.rect.width
      const curH = parseInt(selectedEl.computedStyles.height) || selectedEl.rect.height

      if (curW !== initial.startWidth || curH !== initial.startHeight) {
        editorBuffer.pushAction({
          type: 'RESIZE',
          description: `Co giãn <${selectedEl.tagName.toLowerCase()}> (${Math.round(curW)} × ${Math.round(curH)})`,
          target: {
            tagName: selectedEl.tagName,
            id: selectedEl.id,
            className: selectedEl.className,
            domPath: selectedEl.domPath,
            uid: selectedEl.uid,
            selector: selectedEl.selector,
            textSnippet: selectedEl.textSnippet,
          },
          sourceLoc: sourceLoc
            ? {
              filePath: sourceLoc.filePath,
              fullPath: sourceLoc.fullPath,
              lineNumber: sourceLoc.lineNumber,
            }
            : undefined,
          before: {
            styles: initial.beforeStyles,
            text: initial.beforeText,
            rect: initial.beforeRect,
          },
          after: {
            styles: {
              ...selectedEl.computedStyles,
              width: `${Math.round(curW)}px`,
              height: `${Math.round(curH)}px`,
            },
            text: selectedEl.textSnippet,
            rect: { ...selectedEl.rect },
          },
          deltaStyles: {
            width: `${Math.round(curW)}px`,
            height: `${Math.round(curH)}px`,
          },
        })
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingEl, zoom, handleApplyLiveChange, selectedEl, sourceLoc])

  // ─── KÉO DI CHUYỂN VỊ TRÍ PHẦN TỬ THẬT (LIVE MOVE) ───
  const handleStartElementMove = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!selectedEl) return

    setIsMovingEl(true)
    const curLeft = parseInt(selectedEl.computedStyles.left || '0') || 0
    const curTop = parseInt(selectedEl.computedStyles.top || '0') || 0

    let domOldParentUid = selectedEl.parent?.uid || ''
    let domOldIndex = -1
    try {
      const doc = iframeRef.current?.contentDocument || iframeRef.current?.contentWindow?.document
      if (doc && selectedEl.uid) {
        const el = doc.querySelector(`[data-pm-uid="${selectedEl.uid}"]`)
        if (el && el.parentElement) {
          if (!el.parentElement.getAttribute('data-pm-uid')) {
            el.parentElement.setAttribute('data-pm-uid', 'pm_' + Math.random().toString(36).slice(2, 9))
          }
          domOldParentUid = el.parentElement.getAttribute('data-pm-uid') || domOldParentUid
          domOldIndex = Array.prototype.indexOf.call(el.parentElement.childNodes, el)
        }
      }
    } catch { }

    moveStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialLeft: curLeft,
      initialTop: curTop,
      beforeStyles: { ...selectedEl.computedStyles },
      beforeRect: { ...selectedEl.rect },
      beforeText: selectedEl.textSnippet,
      oldParentUid: domOldParentUid,
      oldIndex: domOldIndex,
    }
  }

  useEffect(() => {
    if (!isMovingEl) return

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      const scale = zoom / 100
      const dx = (e.clientX - moveStartRef.current.startX) / scale
      const dy = (e.clientY - moveStartRef.current.startY) / scale

      const curPos = selectedEl?.computedStyles?.position
      const isAbsolute = curPos === 'absolute' || curPos === 'fixed'

      // Chỉ cập nhật toạ độ left/top đối với phần tử định vị tuyệt đối (absolute/fixed).
      // Với phần tử trong luồng tự nhiên (form, flex, grid), không ép position: relative và toạ độ âm
      // để tránh phá vỡ bố cục gốc của trang.
      if (isAbsolute) {
        const nextLeft = Math.round(moveStartRef.current.initialLeft + dx)
        const nextTop = Math.round(moveStartRef.current.initialTop + dy)
        handleApplyLiveChange(
          {
            position: curPos,
            left: `${nextLeft}px`,
            top: `${nextTop}px`,
          },
          undefined,
          { skipHistory: true }
        )
      }

      // Gửi tọa độ tới iframe để dò tìm vùng chứa đích (Drop Target Zone / Reorder)
      const iframe = iframeRef.current
      if (iframe?.contentWindow) {
        const iframeRect = iframe.getBoundingClientRect()
        const x = (e.clientX - iframeRect.left) / scale
        const y = (e.clientY - iframeRect.top) / scale
        iframe.contentWindow.postMessage(
          {
            type: 'PM_DRAG_OVER',
            dragUid: selectedEl?.uid,
            x,
            y,
          },
          '*'
        )
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      setIsMovingEl(false)
      setDropTargetHover(null)
      const initial = moveStartRef.current
      if (!selectedEl) return

      const curPos = selectedEl.computedStyles?.position
      const isAbsolute = curPos === 'absolute' || curPos === 'fixed'

      // Thả chuột: Thực hiện di chuyển cấu trúc DOM (Reparenting / Reorder vào vị trí mới) cho phần tử trong luồng tự nhiên
      const iframe = iframeRef.current
      if (iframe?.contentWindow && !isAbsolute) {
        const iframeRect = iframe.getBoundingClientRect()
        const scale = zoom / 100
        const x = (e.clientX - iframeRect.left) / scale
        const y = (e.clientY - iframeRect.top) / scale
        iframe.contentWindow.postMessage(
          {
            type: 'PM_DROP_REPARENT',
            uid: selectedEl.uid,
            x,
            y,
          },
          '*'
        )
      }

      // Chỉ ghi toạ độ di chuyển vào mã nguồn khi phần tử vốn là định vị tuyệt đối.
      if (isAbsolute) {
        const curLeft = parseInt(selectedEl.computedStyles.left || '0') || 0
        const curTop = parseInt(selectedEl.computedStyles.top || '0') || 0

        if (curLeft !== initial.initialLeft || curTop !== initial.initialTop) {
          editorBuffer.pushAction({
            type: 'MOVE',
            description: `Di chuyển <${selectedEl.tagName.toLowerCase()}>`,
            target: {
              tagName: selectedEl.tagName,
              id: selectedEl.id,
              className: selectedEl.className,
              domPath: selectedEl.domPath,
              uid: selectedEl.uid,
              selector: selectedEl.selector,
              textSnippet: selectedEl.textSnippet,
            },
            sourceLoc: sourceLoc
              ? {
                  filePath: sourceLoc.filePath,
                  fullPath: sourceLoc.fullPath,
                  lineNumber: sourceLoc.lineNumber,
                }
              : undefined,
            before: {
              styles: initial.beforeStyles,
              text: initial.beforeText,
              rect: initial.beforeRect,
            },
            after: {
              styles: {
                ...selectedEl.computedStyles,
                left: `${curLeft}px`,
                top: `${curTop}px`,
                position: curPos,
              },
              text: selectedEl.textSnippet,
              rect: { ...selectedEl.rect },
            },
            deltaStyles: {
              left: `${curLeft}px`,
              top: `${curTop}px`,
              position: curPos,
            },
          })
        }
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isMovingEl, zoom, handleApplyLiveChange, selectedEl, sourceLoc])

  // ─── ĐẶT LẠI VỊ TRÍ PHẦN TỬ VỀ TỰ NHIÊN (RESET RELATIVE/TOP/LEFT) ───
  const handleResetElementPosition = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'PM_RESET_POSITION', uid: selectedEl?.uid }, '*')
    }
    showToast('Đã đặt lại phần tử về vị trí tự nhiên trong khung cha!')
  }

  // ─── TỰ ĐỘNG DÒ TÌM TỆP MÃ NGUỒN CHỨA PHẦN TỬ (CODE LOCATOR) ───
  useEffect(() => {
    if (!selectedEl || !projectPath) {
      setSourceLoc(null)
      return
    }

    let isMounted = true
    setIsLocatingSource(true)

    if (api?.inspect?.locateSource) {
      api.inspect
        .locateSource({
          projectPath,
          textSnippet: selectedEl.textSnippet,
          tagName: selectedEl.tagName,
          className: selectedEl.className,
          currentPath: selectedEl.currentPath || currentRouteRef.current,
          id: selectedEl.id,
          selector: selectedEl.selector,
        })
        .then((loc) => {
          if (isMounted) {
            setSourceLoc(loc as any)
            setIsLocatingSource(false)
          }
        })
        .catch(() => {
          if (isMounted) setIsLocatingSource(false)
        })
    }

    return () => {
      isMounted = false
    }
  }, [selectedEl?.domPath, selectedEl?.textSnippet, projectPath])

  // ─── GHI THAY ĐỔI VÀO MÃ NGUỒN THẬT TRÊN Ổ ĐĨA ───
  const handleSyncCodeToFile = async () => {
    const multiTargets = multiSelectionRef.current
    const isMultiSave = multiTargets.length > 1

    if (!sourceLoc && !isMultiSave) {
      showToast('Chưa tìm thấy tệp mã nguồn tương ứng!')
      return
    }

    setIsSyncingCode(true)
    try {
      // ─── Lưu nhiều phần tử: ghi cùng bộ style đã sửa vào từng phần tử ───
      if (isMultiSave) {
        let saved = 0
        let failed = 0

        for (const item of multiTargets) {
          const isPrimary = Boolean(item.uid && item.uid === selectedEl?.uid)
          let fullPath = isPrimary ? sourceLoc?.fullPath : undefined
          let lineNumber = isPrimary ? sourceLoc?.lineNumber : undefined

          if (!fullPath && api?.inspect?.locateSource) {
            try {
              const loc = await api.inspect.locateSource({
                projectPath: projectPath || '',
                textSnippet: item.textSnippet,
                tagName: item.tagName,
                className: item.className,
                currentPath: item.currentPath || currentRouteRef.current,
                id: item.id,
                selector: item.selector,
              })
              fullPath = loc?.fullPath
              lineNumber = loc?.lineNumber
            } catch {}
          }

          if (!fullPath) {
            failed += 1
            continue
          }

          try {
            const res = await api.inspect.syncCode({
              fullPath,
              // Không đổi nội dung chữ — chỉ ghi style cho từng phần tử.
              oldText: item.textSnippet,
              newText: item.textSnippet,
              styles: modifiedStyles,
              tagName: item.tagName,
              lineNumber,
              projectPath: projectPath || undefined,
            })
            if (res?.success) saved += 1
            else failed += 1
          } catch {
            failed += 1
          }
        }

        if (saved > 0) {
          setModifiedStyles({})
          showToast(
            failed > 0
              ? `Đã lưu ${saved}/${multiTargets.length} phần tử, ${failed} phần tử không tìm thấy mã nguồn.`
              : `Đã lưu thay đổi cho cả ${saved} phần tử đang chọn!`
          )
        } else {
          showToast('Không tìm thấy mã nguồn của các phần tử đang chọn.')
        }
        return
      }

      const res = await api.inspect.syncCode({
        fullPath: sourceLoc!.fullPath,
        oldText: originalStyles?.text || selectedEl?.textSnippet,
        newText: selectedEl?.textSnippet,
        styles: modifiedStyles,
        tagName: selectedEl?.tagName,
        lineNumber: sourceLoc!.lineNumber,
        projectPath: projectPath || undefined,
      })

      if (res?.success) {
        showToast(`Đã lưu vĩnh viễn vào ${sourceLoc!.filePath}!`)
        setModifiedStyles({})
      } else {
        showToast(`Lỗi khi lưu tệp: ${res?.error || 'Không xác định'}`)
      }
    } catch {
      showToast('Không thể lưu vào tệp mã nguồn!')
    } finally {
      setIsSyncingCode(false)
    }
  }

  // ─── D2-03: AI SIDECAR CALLBACKS (PREVIEW, UNDO, CODE SYNC) ───
  const handleAiPreview = useCallback((change: { styles?: Record<string, string>; textContent?: string }) => {
    if (!selectedEl) return
    if (!preAiStylesRef.current) {
      preAiStylesRef.current = {
        styles: { ...(selectedEl.computedStyles as unknown as Record<string, string>) },
        textSnippet: selectedEl.textSnippet,
      }
    }

    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'PM_APPLY_STYLE',
          payload: {
            target: {
              tagName: selectedEl.tagName,
              id: selectedEl.id,
              className: selectedEl.className,
              domPath: selectedEl.domPath,
              uid: selectedEl.uid,
              selector: selectedEl.selector,
              textSnippet: selectedEl.textSnippet,
            },
            styles: change.styles || {},
            textContent: change.textContent,
          },
        },
        '*'
      )
    }

    setSelectedEl((prev) => {
      if (!prev) return null
      return {
        ...prev,
        textSnippet: change.textContent ?? prev.textSnippet ?? '',
        computedStyles: {
          ...prev.computedStyles,
          ...(change.styles || {}),
        } as any,
      }
    })
  }, [selectedEl])

  const handleAiUndo = useCallback(() => {
    if (!selectedEl || !preAiStylesRef.current) return
    const backup = preAiStylesRef.current

    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'PM_APPLY_STYLE',
          payload: {
            target: {
              tagName: selectedEl.tagName,
              id: selectedEl.id,
              className: selectedEl.className,
              domPath: selectedEl.domPath,
              uid: selectedEl.uid,
              selector: selectedEl.selector,
              textSnippet: selectedEl.textSnippet,
            },
            styles: backup.styles,
            textContent: backup.textSnippet,
          },
        },
        '*'
      )
    }

    setSelectedEl((prev) => {
      if (!prev) return null
      return {
        ...prev,
        textSnippet: backup.textSnippet ?? prev.textSnippet ?? '',
        computedStyles: {
          ...prev.computedStyles,
          ...backup.styles,
        } as any,
      }
    })

    preAiStylesRef.current = null
  }, [selectedEl])

  const handleAiSyncCode = useCallback(async (change: { styles?: Record<string, string>; textContent?: string }): Promise<boolean> => {
    if (!selectedEl) {
      showToast('Không có phần tử nào đang chọn!', 'err')
      return false
    }
    if (!sourceLoc?.fullPath) {
      showToast('Chưa xác định được tệp mã nguồn tương ứng của phần tử!', 'err')
      return false
    }

    try {
      const res = await api.inspect.syncCode({
        fullPath: sourceLoc.fullPath,
        oldText: selectedEl.textSnippet,
        newText: change.textContent ?? selectedEl.textSnippet,
        styles: change.styles || {},
        tagName: selectedEl.tagName,
        lineNumber: sourceLoc.lineNumber,
        projectPath: projectPath || undefined,
      })

      if (res?.success) {
        showToast(`Đã đồng bộ code thành công vào ${sourceLoc.filePath}!`, 'ok')
        preAiStylesRef.current = null
        return true
      } else {
        showToast(`Lỗi khi lưu mã nguồn: ${res?.error || 'Không xác định'}`, 'err')
        return false
      }
    } catch (err) {
      showToast(`Không thể lưu vào tệp mã nguồn: ${(err as Error).message}`, 'err')
      return false
    }
  }, [selectedEl, sourceLoc, projectPath, showToast])

  // ─── HỘP CÔNG CỤ: CẦU NỐI DOM ↔ MÃ NGUỒN ───
  const sendToolboxMessage = useCallback(
    (type: string, payload: Record<string, unknown> = {}, timeout = 2500): Promise<any> => {
      return new Promise((resolve) => {
        const win = iframeRef.current?.contentWindow
        if (!win) {
          resolve(null)
          return
        }
        const requestId = `tb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        toolboxRequestsRef.current.set(requestId, resolve)
        try {
          win.postMessage({ type, requestId, payload, ...payload }, '*')
        } catch {
          toolboxRequestsRef.current.delete(requestId)
          resolve(null)
          return
        }
        window.setTimeout(() => {
          if (toolboxRequestsRef.current.has(requestId)) {
            toolboxRequestsRef.current.delete(requestId)
            resolve(null)
          }
        }, timeout)
      })
    },
    [],
  )

  const buildTarget = useCallback(
    (info: RealElementInfo | null, placement?: InsertPlacement) => ({
      uid: info?.uid,
      tagName: info?.tagName,
      id: info?.id,
      className: info?.className,
      textSnippet: info?.textSnippet,
      domPath: info?.domPath,
      selector: info?.selector,
      currentPath: info?.currentPath || currentRouteRef.current,
      fullPath: info?.uid && info.uid === selectedEl?.uid ? sourceLoc?.fullPath : undefined,
      lineNumber: info?.uid && info.uid === selectedEl?.uid ? sourceLoc?.lineNumber : undefined,
      placement,
    }),
    [selectedEl?.uid, sourceLoc?.fullPath, sourceLoc?.lineNumber],
  )

  const beginToolboxInsert = useCallback(
    async (item: ToolboxDragItem, target?: { targetUid?: string; placement?: InsertPlacement }) => {
      if (!projectPath) {
        showToast('Hãy mở một dự án trước khi chèn phần tử.', 'err')
        return
      }

      // Ngăn chặn các sự kiện chèn lặp lại (debounce 500ms)
      const now = Date.now()
      if (isInsertingRef.current || (now - lastInsertTimeRef.current < 500)) {
        return
      }
      isInsertingRef.current = true
      lastInsertTimeRef.current = now
      toolboxDrag.end()

      try {
        let info: RealElementInfo | null = selectedEl
        const targetUid = target?.targetUid || selectedEl?.uid || 'pm_body'
        const placement = target?.placement || (selectedEl ? 'after' : 'inside')

        if (targetUid && targetUid !== info?.uid) {
          const data = await sendToolboxMessage('PM_TOOLBOX_GET_INFO', { uid: targetUid })
          if (data?.info) info = data.info as RealElementInfo
        }

        // Tự động định vị tệp và dòng mã nguồn của phần tử mục tiêu
        let resolvedFullPath = info?.uid && info.uid === selectedEl?.uid ? sourceLoc?.fullPath : undefined
        let resolvedLineNumber = info?.uid && info.uid === selectedEl?.uid ? sourceLoc?.lineNumber : undefined

        if (!resolvedFullPath && info && api?.inspect?.locateSource) {
          try {
            const loc = await api.inspect.locateSource({
              projectPath,
              textSnippet: info.textSnippet,
              tagName: info.tagName,
              className: info.className,
              currentPath: info.currentPath || currentRouteRef.current,
              id: info.id,
              selector: info.selector,
            })
            if (loc?.fullPath) {
              resolvedFullPath = loc.fullPath
              resolvedLineNumber = loc.lineNumber
            }
          } catch {}
        }

        const targetObj = {
          ...buildTarget(info, placement),
          fullPath: resolvedFullPath,
          lineNumber: resolvedLineNumber,
        }

        const domHtml = item.css
          ? `${item.html}\n<style data-pm-toolbox>${item.css}</style>`
          : item.html

        const startEpoch = docEpochRef.current

        // 1. Chèn ngay lập tức vào Live DOM trong iframe (hiển thị lập tức tại vị trí kéo thả, không cần tải lại)
        const domData = await sendToolboxMessage('PM_TOOLBOX_INSERT', {
          html: domHtml || '',
          targetUid,
          placement,
        })
        const r = domData?.result

        // 2. Tự động ghi đồng bộ vào mã nguồn tệp tương ứng trên ổ đĩa
        let writeResult: any = null
        try {
          writeResult = await api.toolbox.mutate({
            kind: 'insert',
            projectPath,
            target: targetObj,
            html: item.html,
            css: item.css,
            dryRun: false,
          })
        } catch (err) {
          console.warn('Lỗi ghi mã nguồn khi chèn công cụ:', err)
        }

        // 3. Đưa vào bộ đệm hoàn tác (Ctrl+Z / Ctrl+Y)
        editorBuffer.pushAction({
          type: 'INSERT',
          description: `Chèn ${item.name}`,
          target: {
            tagName: targetObj.tagName || 'div',
            id: targetObj.id,
            className: targetObj.className,
            domPath: targetObj.domPath,
            uid: targetObj.uid,
            selector: targetObj.selector,
            textSnippet: targetObj.textSnippet,
          },
          sourceLoc: writeResult?.fullPath
            ? {
                filePath: writeResult.filePath || '',
                fullPath: writeResult.fullPath,
                lineNumber: writeResult.startLine || 1,
              }
            : (resolvedFullPath
                ? {
                    filePath: writeResult?.filePath || '',
                    fullPath: resolvedFullPath,
                    lineNumber: resolvedLineNumber || 1,
                  }
                : undefined),
          before: { styles: {} },
          after: { styles: {} },
          dom: {
            kind: 'insert',
            parentUid: r?.parentUid,
            index: r?.index,
            uids: r?.uids || [],
            html: domHtml,
          },
          fileBefore: writeResult?.oldText,
          fileAfter: writeResult?.newText,
          projectPath,
          docEpoch: startEpoch,
        })

        showToast(`Đã chèn “${item.name}” vào trang (Ctrl+Z để hoàn tác)`, 'ok')
      } finally {
        window.setTimeout(() => {
          isInsertingRef.current = false
        }, 400)
      }
    },
    [projectPath, selectedEl, sourceLoc, buildTarget, sendToolboxMessage, showToast],
  )

  const beginToolboxDelete = useCallback(async () => {
    if (!projectPath || !selectedEl) {
      showToast('Chọn một phần tử trên canvas trước.', 'info')
      return
    }
    const payload: ToolboxMutationPayload = {
      kind: 'delete',
      projectPath,
      target: buildTarget(selectedEl),
      dryRun: true,
    }
    try {
      const preview = await api.toolbox.mutate(payload)
      if (!preview.success) {
        showToast(preview.error || 'Không thể xoá phần tử.', 'err')
        return
      }
      setPendingMutation({
        payload,
        preview,
        title: `Xoá <${selectedEl.tagName.toLowerCase()}>`,
        subtitle: 'Phần tử sẽ bị xoá khỏi cả canvas lẫn mã nguồn. Có thể hoàn tác bằng Ctrl+Z.',
        mode: 'delete',
        targetUid: selectedEl.uid,
      })
    } catch {
      showToast('Không thể tạo bản xem trước.', 'err')
    }
  }, [projectPath, selectedEl, sourceLoc, buildTarget, showToast])

  // ─── CĂN LỀ & PHÂN BỔ KHOẢNG CÁCH (MULTI-SELECT ALIGN & DISTRIBUTE) ───
  /**
   * Căn ngang cho phần tử đã chiếm hết bề ngang khung cha.
   * Không thể dịch `left` (khối vẫn rộng bằng cha), nên phải đổi cách căn nội dung.
   * Lưu ý: nếu phần tử là flex container, nội dung chữ trở thành flex item nên
   * `text-align` KHÔNG có tác dụng — phải dùng `justify-content`.
   */
  const applyFullWidthHorizontalAlign = (
    el: HTMLElement,
    align: 'left' | 'center' | 'right',
    win: Window
  ): Record<string, string> => {
    const styles: Record<string, string> = { textAlign: align }
    const display = win.getComputedStyle(el).display

    if (display === 'flex' || display === 'inline-flex') {
      styles.justifyContent =
        align === 'left' ? 'flex-start' : align === 'center' ? 'center' : 'flex-end'
    } else if (display === 'grid' || display === 'inline-grid') {
      styles.justifyItems =
        align === 'left' ? 'start' : align === 'center' ? 'center' : 'end'
    }

    for (const [key, value] of Object.entries(styles)) {
      el.style.setProperty(key.replace(/([A-Z])/g, '-$1').toLowerCase(), value)
    }

    return styles
  }

  type AlignType = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
  type DistributeType = 'horizontal' | 'vertical'

  const handleAlignSelection = useCallback(
    (type: AlignType) => {
      const list = multiSelectionRef.current.length > 1 ? multiSelectionRef.current : []

      // ─── TRƯỜNG HỢP 1: Căn 1 phần tử theo Khung cha (Parent Container) ───
      if (list.length < 2) {
        if (!selectedEl) return
        const win = iframeRef.current?.contentWindow
        const doc = win?.document || iframeRef.current?.contentDocument
        if (!win || !doc) return
        const el = (selectedEl.uid ? doc.querySelector(`[data-pm-uid="${selectedEl.uid}"]`) : null) as HTMLElement | null
        if (!el) return

        const computed = win.getComputedStyle(el)
        const isAbsolute = computed.position === 'absolute' || computed.position === 'fixed'
        const parentEl = (isAbsolute ? (el.offsetParent as HTMLElement) : null) || el.parentElement || doc.body

        const parentRect = parentEl.getBoundingClientRect()
        const elRect = el.getBoundingClientRect()
        const pWidth = parentEl.clientWidth || parentRect.width
        const pHeight = parentEl.clientHeight || parentRect.height
        const elWidth = elRect.width
        const elHeight = elRect.height

        let nextStyles: Record<string, string> = {}
        let label = ''

        if (isAbsolute) {
          if (type === 'left') {
            label = 'lề trái khung cha'
            nextStyles = { left: '0px' }
          } else if (type === 'center') {
            label = 'chính giữa ngang khung cha'
            const newLeft = Math.max(0, Math.round((pWidth - elWidth) / 2))
            nextStyles = { left: `${newLeft}px` }
          } else if (type === 'right') {
            label = 'lề phải khung cha'
            const newLeft = Math.max(0, Math.round(pWidth - elWidth))
            nextStyles = { left: `${newLeft}px` }
          } else if (type === 'top') {
            label = 'lề trên khung cha'
            nextStyles = { top: '0px' }
          } else if (type === 'middle') {
            label = 'chính giữa dọc khung cha'
            const newTop = Math.max(0, Math.round((pHeight - elHeight) / 2))
            nextStyles = { top: `${newTop}px` }
          } else if (type === 'bottom') {
            label = 'lề dưới khung cha'
            const newTop = Math.max(0, Math.round(pHeight - elHeight))
            nextStyles = { top: `${newTop}px` }
          }
        } else {
          // Phần tử trong luồng tự nhiên (static / relative)
          const currentLeftInParent = elRect.left - parentRect.left
          const currentTopInParent = elRect.top - parentRect.top

          const curLeft = parseFloat(computed.left) || 0
          const curTop = parseFloat(computed.top) || 0
          const isHorizontal = type === 'left' || type === 'center' || type === 'right'
          // Phần tử đã chiếm hết bề ngang thì dịch left vô nghĩa — căn chữ bên trong thay thế.
          const isFullWidth = pWidth > 0 && elWidth >= pWidth - 2

          if (!(isHorizontal && isFullWidth) && (computed.position === 'static' || !computed.position)) {
            nextStyles.position = 'relative'
          }

          if (type === 'left') {
            label = 'lề trái khung cha'
            if (isFullWidth) {
              Object.assign(nextStyles, applyFullWidthHorizontalAlign(el, 'left', win))
            } else {
              const deltaX = 0 - currentLeftInParent
              nextStyles.left = `${Math.round(curLeft + deltaX)}px`
            }
          } else if (type === 'center') {
            label = 'chính giữa ngang khung cha'
            if (isFullWidth) {
              Object.assign(nextStyles, applyFullWidthHorizontalAlign(el, 'center', win))
            } else {
              const targetLeft = Math.round((pWidth - elWidth) / 2)
              const deltaX = targetLeft - currentLeftInParent
              nextStyles.left = `${Math.round(curLeft + deltaX)}px`
            }
          } else if (type === 'right') {
            label = 'lề phải khung cha'
            if (isFullWidth) {
              Object.assign(nextStyles, applyFullWidthHorizontalAlign(el, 'right', win))
            } else {
              const targetLeft = Math.round(pWidth - elWidth)
              const deltaX = targetLeft - currentLeftInParent
              nextStyles.left = `${Math.round(curLeft + deltaX)}px`
            }
          } else if (type === 'top') {
            label = 'lề trên khung cha'
            const deltaY = 0 - currentTopInParent
            nextStyles.top = `${Math.round(curTop + deltaY)}px`
          } else if (type === 'middle') {
            label = 'chính giữa dọc khung cha'
            const targetTop = Math.round((pHeight - elHeight) / 2)
            const deltaY = targetTop - currentTopInParent
            nextStyles.top = `${Math.round(curTop + deltaY)}px`
          } else if (type === 'bottom') {
            label = 'lề dưới khung cha'
            const targetTop = Math.round(pHeight - elHeight)
            const deltaY = targetTop - currentTopInParent
            nextStyles.top = `${Math.round(curTop + deltaY)}px`
          }
        }

        handleApplyLiveChange(nextStyles)
        showToast(`Đã căn ${label} cho <${selectedEl.tagName.toLowerCase()}>!`, 'ok')
        return
      }

      // ─── TRƯỜNG HỢP 2: Căn nhiều phần tử theo nhau (Multi-select) ───
      const win = iframeRef.current?.contentWindow
      const doc = win?.document || iframeRef.current?.contentDocument
      if (!win || !doc) return

      const itemsWithDom = list
        .map((item) => {
          const el = (item.uid ? doc.querySelector(`[data-pm-uid="${item.uid}"]`) : null) as HTMLElement | null
          if (!el) return null
          const rect = el.getBoundingClientRect()
          const computed = win.getComputedStyle(el)
          const curLeft = parseFloat(computed.left) || 0
          const curTop = parseFloat(computed.top) || 0
          return {
            info: item,
            el,
            rect: {
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              right: rect.right,
              bottom: rect.bottom,
            },
            curLeft,
            curTop,
            computedPosition: computed.position,
          }
        })
        .filter(Boolean) as Array<{
          info: RealElementInfo
          el: HTMLElement
          rect: { left: number; top: number; width: number; height: number; right: number; bottom: number }
          curLeft: number
          curTop: number
          computedPosition: string
        }>

      if (itemsWithDom.length < 2) return

      // Chiều ngang khả dụng bên trong thẻ cha (trừ padding) để nhận biết phần tử đang chiếm hết bề ngang.
      const getParentContentWidth = (el: HTMLElement) => {
        const parent = el.parentElement
        if (!parent) return 0
        const cs = win.getComputedStyle(parent)
        const padding = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)
        return Math.max(0, parent.clientWidth - padding)
      }

      const updatedSelection: RealElementInfo[] = []
      let label = ''

      if (type === 'left') {
        label = 'lề trái'
        const minLeft = Math.min(...itemsWithDom.map((i) => i.rect.left))
        itemsWithDom.forEach((item) => {
          const parentWidth = getParentContentWidth(item.el)
          const isFullWidth = parentWidth > 0 && item.rect.width >= parentWidth - 2
          const dx = isFullWidth ? 0 : minLeft - item.rect.left
          const newLeft = Math.round(item.curLeft + dx)
          // Khối đã chiếm hết bề ngang thì dịch left không có tác dụng nhìn thấy;
          // căn chữ bên trong để người dùng vẫn thấy thay đổi.
          const styles: Record<string, string> = isFullWidth
            ? applyFullWidthHorizontalAlign(item.el, 'left', win)
            : { left: `${newLeft}px` }

          if (!isFullWidth) {
            item.el.style.left = `${newLeft}px`
            if (item.computedPosition === 'static') item.el.style.position = 'relative'
          }

          iframeRef.current?.contentWindow?.postMessage(
            {
              type: 'PM_APPLY_STYLE',
              payload: {
                target: item.info,
                styles,
              },
            },
            '*'
          )

          editorBuffer.pushAction({
            type: 'MOVE',
            description: `Căn lề trái <${item.info.tagName.toLowerCase()}>`,
            target: {
              tagName: item.info.tagName,
              id: item.info.id,
              className: item.info.className,
              domPath: item.info.domPath,
              uid: item.info.uid,
              selector: item.info.selector,
              textSnippet: item.info.textSnippet,
            },
            before: { styles: { left: `${item.curLeft}px` } },
            after: { styles: { left: `${newLeft}px` } },
            deltaStyles: styles,
            projectPath,
            docEpoch: docEpochRef.current,
          })

          updatedSelection.push({
            ...item.info,
            rect: { ...item.info.rect, left: item.info.rect.left + dx },
            computedStyles: { ...item.info.computedStyles, ...styles },
          })
        })
      } else if (type === 'center') {
        label = 'giữa ngang'
        const minLeft = Math.min(...itemsWithDom.map((i) => i.rect.left))
        const maxRight = Math.max(...itemsWithDom.map((i) => i.rect.right))
        const targetCenter = (minLeft + maxRight) / 2
        itemsWithDom.forEach((item) => {
          const parentWidth = getParentContentWidth(item.el)
          const isFullWidth = parentWidth > 0 && item.rect.width >= parentWidth - 2
          const itemCenter = item.rect.left + item.rect.width / 2
          const dx = isFullWidth ? 0 : targetCenter - itemCenter
          const newLeft = Math.round(item.curLeft + dx)
          const styles: Record<string, string> = isFullWidth
            ? applyFullWidthHorizontalAlign(item.el, 'center', win)
            : { left: `${newLeft}px` }

          if (!isFullWidth) {
            item.el.style.left = `${newLeft}px`
            if (item.computedPosition === 'static') item.el.style.position = 'relative'
          }

          iframeRef.current?.contentWindow?.postMessage(
            {
              type: 'PM_APPLY_STYLE',
              payload: {
                target: item.info,
                styles,
              },
            },
            '*'
          )

          editorBuffer.pushAction({
            type: 'MOVE',
            description: `Căn giữa ngang <${item.info.tagName.toLowerCase()}>`,
            target: {
              tagName: item.info.tagName,
              id: item.info.id,
              className: item.info.className,
              domPath: item.info.domPath,
              uid: item.info.uid,
              selector: item.info.selector,
              textSnippet: item.info.textSnippet,
            },
            before: { styles: { left: `${item.curLeft}px` } },
            after: { styles: { left: `${newLeft}px` } },
            deltaStyles: styles,
            projectPath,
            docEpoch: docEpochRef.current,
          })

          updatedSelection.push({
            ...item.info,
            rect: { ...item.info.rect, left: item.info.rect.left + dx },
            computedStyles: { ...item.info.computedStyles, ...styles },
          })
        })
      } else if (type === 'right') {
        label = 'lề phải'
        const maxRight = Math.max(...itemsWithDom.map((i) => i.rect.right))
        itemsWithDom.forEach((item) => {
          const parentWidth = getParentContentWidth(item.el)
          const isFullWidth = parentWidth > 0 && item.rect.width >= parentWidth - 2
          const dx = isFullWidth ? 0 : maxRight - item.rect.right
          const newLeft = Math.round(item.curLeft + dx)
          const styles: Record<string, string> = isFullWidth
            ? applyFullWidthHorizontalAlign(item.el, 'right', win)
            : { left: `${newLeft}px` }

          if (!isFullWidth) {
            item.el.style.left = `${newLeft}px`
            if (item.computedPosition === 'static') item.el.style.position = 'relative'
          }

          iframeRef.current?.contentWindow?.postMessage(
            {
              type: 'PM_APPLY_STYLE',
              payload: {
                target: item.info,
                styles,
              },
            },
            '*'
          )

          editorBuffer.pushAction({
            type: 'MOVE',
            description: `Căn lề phải <${item.info.tagName.toLowerCase()}>`,
            target: {
              tagName: item.info.tagName,
              id: item.info.id,
              className: item.info.className,
              domPath: item.info.domPath,
              uid: item.info.uid,
              selector: item.info.selector,
              textSnippet: item.info.textSnippet,
            },
            before: { styles: { left: `${item.curLeft}px` } },
            after: { styles: { left: `${newLeft}px` } },
            deltaStyles: styles,
            projectPath,
            docEpoch: docEpochRef.current,
          })

          updatedSelection.push({
            ...item.info,
            rect: { ...item.info.rect, left: item.info.rect.left + dx },
            computedStyles: { ...item.info.computedStyles, ...styles },
          })
        })
      } else if (type === 'top') {
        label = 'lề trên'
        const minTop = Math.min(...itemsWithDom.map((i) => i.rect.top))
        itemsWithDom.forEach((item) => {
          const dy = minTop - item.rect.top
          const newTop = Math.round(item.curTop + dy)
          const styles = { top: `${newTop}px` }

          item.el.style.top = `${newTop}px`
          if (item.computedPosition === 'static') item.el.style.position = 'relative'

          iframeRef.current?.contentWindow?.postMessage(
            {
              type: 'PM_APPLY_STYLE',
              payload: {
                target: item.info,
                styles,
              },
            },
            '*'
          )

          editorBuffer.pushAction({
            type: 'MOVE',
            description: `Căn lề trên <${item.info.tagName.toLowerCase()}>`,
            target: {
              tagName: item.info.tagName,
              id: item.info.id,
              className: item.info.className,
              domPath: item.info.domPath,
              uid: item.info.uid,
              selector: item.info.selector,
              textSnippet: item.info.textSnippet,
            },
            before: { styles: { top: `${item.curTop}px` } },
            after: { styles: { top: `${newTop}px` } },
            deltaStyles: styles,
            projectPath,
            docEpoch: docEpochRef.current,
          })

          updatedSelection.push({
            ...item.info,
            rect: { ...item.info.rect, top: item.info.rect.top + dy },
            computedStyles: { ...item.info.computedStyles, ...styles },
          })
        })
      } else if (type === 'middle') {
        label = 'giữa dọc'
        const minTop = Math.min(...itemsWithDom.map((i) => i.rect.top))
        const maxBottom = Math.max(...itemsWithDom.map((i) => i.rect.bottom))
        const targetMiddle = (minTop + maxBottom) / 2
        itemsWithDom.forEach((item) => {
          const itemMiddle = item.rect.top + item.rect.height / 2
          const dy = targetMiddle - itemMiddle
          const newTop = Math.round(item.curTop + dy)
          const styles = { top: `${newTop}px` }

          item.el.style.top = `${newTop}px`
          if (item.computedPosition === 'static') item.el.style.position = 'relative'

          iframeRef.current?.contentWindow?.postMessage(
            {
              type: 'PM_APPLY_STYLE',
              payload: {
                target: item.info,
                styles,
              },
            },
            '*'
          )

          editorBuffer.pushAction({
            type: 'MOVE',
            description: `Căn giữa dọc <${item.info.tagName.toLowerCase()}>`,
            target: {
              tagName: item.info.tagName,
              id: item.info.id,
              className: item.info.className,
              domPath: item.info.domPath,
              uid: item.info.uid,
              selector: item.info.selector,
              textSnippet: item.info.textSnippet,
            },
            before: { styles: { top: `${item.curTop}px` } },
            after: { styles: { top: `${newTop}px` } },
            deltaStyles: styles,
            projectPath,
            docEpoch: docEpochRef.current,
          })

          updatedSelection.push({
            ...item.info,
            rect: { ...item.info.rect, top: item.info.rect.top + dy },
            computedStyles: { ...item.info.computedStyles, ...styles },
          })
        })
      } else if (type === 'bottom') {
        label = 'lề dưới'
        const maxBottom = Math.max(...itemsWithDom.map((i) => i.rect.bottom))
        itemsWithDom.forEach((item) => {
          const dy = maxBottom - item.rect.bottom
          const newTop = Math.round(item.curTop + dy)
          const styles = { top: `${newTop}px` }

          item.el.style.top = `${newTop}px`
          if (item.computedPosition === 'static') item.el.style.position = 'relative'

          iframeRef.current?.contentWindow?.postMessage(
            {
              type: 'PM_APPLY_STYLE',
              payload: {
                target: item.info,
                styles,
              },
            },
            '*'
          )

          editorBuffer.pushAction({
            type: 'MOVE',
            description: `Căn lề dưới <${item.info.tagName.toLowerCase()}>`,
            target: {
              tagName: item.info.tagName,
              id: item.info.id,
              className: item.info.className,
              domPath: item.info.domPath,
              uid: item.info.uid,
              selector: item.info.selector,
              textSnippet: item.info.textSnippet,
            },
            before: { styles: { top: `${item.curTop}px` } },
            after: { styles: { top: `${newTop}px` } },
            deltaStyles: styles,
            projectPath,
            docEpoch: docEpochRef.current,
          })

          updatedSelection.push({
            ...item.info,
            rect: { ...item.info.rect, top: item.info.rect.top + dy },
            computedStyles: { ...item.info.computedStyles, ...styles },
          })
        })
      }

      setMultiSelection(updatedSelection)
      showToast(`Đã căn ${label} cho ${itemsWithDom.length} phần tử!`, 'ok')
    },
    [projectPath, showToast]
  )

  const handleDistributeSelection = useCallback(
    (type: DistributeType) => {
      const list = multiSelectionRef.current.length > 1 ? multiSelectionRef.current : []
      if (list.length < 3) {
        showToast('Cần chọn từ 3 phần tử trở lên để phân bổ khoảng cách đều.', 'info')
        return
      }

      const doc = iframeRef.current?.contentDocument || iframeRef.current?.contentWindow?.document
      if (!doc) return

      const itemsWithDom = list
        .map((item) => {
          const el = (item.uid ? doc.querySelector(`[data-pm-uid="${item.uid}"]`) : null) as HTMLElement | null
          if (!el) return null
          const rect = el.getBoundingClientRect()
          const computed = window.getComputedStyle(el)
          const curLeft = parseFloat(computed.left) || 0
          const curTop = parseFloat(computed.top) || 0
          return {
            info: item,
            el,
            rect: {
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              right: rect.right,
              bottom: rect.bottom,
            },
            curLeft,
            curTop,
            computedPosition: computed.position,
          }
        })
        .filter(Boolean) as Array<{
          info: RealElementInfo
          el: HTMLElement
          rect: { left: number; top: number; width: number; height: number; right: number; bottom: number }
          curLeft: number
          curTop: number
          computedPosition: string
        }>

      if (itemsWithDom.length < 3) {
        showToast('Cần ít nhất 3 phần tử để phân bổ khoảng cách đều.', 'info')
        return
      }

      const updatedMap = new Map<string, { rect: { left: number; top: number; width: number; height: number }; styles: Record<string, string> }>()

      if (type === 'horizontal') {
        const sorted = [...itemsWithDom].sort((a, b) => a.rect.left - b.rect.left)
        const first = sorted[0]
        const last = sorted[sorted.length - 1]

        const totalSpan = last.rect.left - first.rect.right
        const midWidths = sorted.slice(1, -1).reduce((sum, item) => sum + item.rect.width, 0)
        const totalGapSpace = totalSpan - midWidths
        const gap = totalGapSpace / (sorted.length - 1)

        let prevEdge = first.rect.right
        sorted.slice(1, -1).forEach((item) => {
          const targetLeft = prevEdge + gap
          const dx = targetLeft - item.rect.left
          const newLeft = Math.round(item.curLeft + dx)
          const styles = { left: `${newLeft}px` }

          item.el.style.left = `${newLeft}px`
          if (item.computedPosition === 'static') item.el.style.position = 'relative'

          iframeRef.current?.contentWindow?.postMessage(
            {
              type: 'PM_APPLY_STYLE',
              payload: {
                target: item.info,
                styles,
              },
            },
            '*'
          )

          editorBuffer.pushAction({
            type: 'MOVE',
            description: `Phân bổ khoảng cách ngang <${item.info.tagName.toLowerCase()}>`,
            target: {
              tagName: item.info.tagName,
              id: item.info.id,
              className: item.info.className,
              domPath: item.info.domPath,
              uid: item.info.uid,
              selector: item.info.selector,
              textSnippet: item.info.textSnippet,
            },
            before: { styles: { left: `${item.curLeft}px` } },
            after: { styles: { left: `${newLeft}px` } },
            deltaStyles: styles,
            projectPath,
            docEpoch: docEpochRef.current,
          })

          updatedMap.set(item.info.uid || '', {
            rect: { ...item.info.rect, left: item.info.rect.left + dx },
            styles,
          })

          prevEdge = targetLeft + item.rect.width
        })

        showToast(`Đã phân bổ khoảng cách ngang đều nhau (${Math.round(gap)}px) cho ${sorted.length} phần tử!`, 'ok')
      } else {
        const sorted = [...itemsWithDom].sort((a, b) => a.rect.top - b.rect.top)
        const first = sorted[0]
        const last = sorted[sorted.length - 1]

        const totalSpan = last.rect.top - first.rect.bottom
        const midHeights = sorted.slice(1, -1).reduce((sum, item) => sum + item.rect.height, 0)
        const totalGapSpace = totalSpan - midHeights
        const gap = totalGapSpace / (sorted.length - 1)

        let prevEdge = first.rect.bottom
        sorted.slice(1, -1).forEach((item) => {
          const targetTop = prevEdge + gap
          const dy = targetTop - item.rect.top
          const newTop = Math.round(item.curTop + dy)
          const styles = { top: `${newTop}px` }

          item.el.style.top = `${newTop}px`
          if (item.computedPosition === 'static') item.el.style.position = 'relative'

          iframeRef.current?.contentWindow?.postMessage(
            {
              type: 'PM_APPLY_STYLE',
              payload: {
                target: item.info,
                styles,
              },
            },
            '*'
          )

          editorBuffer.pushAction({
            type: 'MOVE',
            description: `Phân bổ khoảng cách dọc <${item.info.tagName.toLowerCase()}>`,
            target: {
              tagName: item.info.tagName,
              id: item.info.id,
              className: item.info.className,
              domPath: item.info.domPath,
              uid: item.info.uid,
              selector: item.info.selector,
              textSnippet: item.info.textSnippet,
            },
            before: { styles: { top: `${item.curTop}px` } },
            after: { styles: { top: `${newTop}px` } },
            deltaStyles: styles,
            projectPath,
            docEpoch: docEpochRef.current,
          })

          updatedMap.set(item.info.uid || '', {
            rect: { ...item.info.rect, top: item.info.rect.top + dy },
            styles,
          })

          prevEdge = targetTop + item.rect.height
        })

        showToast(`Đã phân bổ khoảng cách dọc đều nhau (${Math.round(gap)}px) cho ${sorted.length} phần tử!`, 'ok')
      }

      setMultiSelection((prev) =>
        prev.map((item) => {
          const upd = updatedMap.get(item.uid || '')
          if (!upd) return item
          return {
            ...item,
            rect: { ...item.rect, ...upd.rect },
            computedStyles: { ...item.computedStyles, ...upd.styles },
          }
        })
      )
    },
    [projectPath, showToast]
  )

  // ─── SAO CHÉP / DÁN PHẦN TỬ (HOẠT ĐỘNG XUYÊN TRANG) ───
  const copySelection = useCallback(() => {
    const list = multiSelection.length > 0 ? multiSelection : selectedEl ? [selectedEl] : []
    if (list.length === 0) {
      showToast('Hãy chọn ít nhất một phần tử trên canvas trước khi sao chép.', 'info')
      return
    }

    const parts: string[] = []
    for (const info of list) {
      const html = (info.outerHTML || '')
        // Bỏ các thuộc tính đánh dấu nội bộ để bản sao sạch khi dán sang trang khác
        .replace(/\sdata-pm-(?:uid|multi)(?:="[^"]*")?/g, '')
        .trim()
      if (html) parts.push(html)
    }
    if (parts.length === 0) {
      showToast('Không lấy được mã HTML của phần tử đã chọn.', 'warn')
      return
    }

    const html = parts.join('\n')
    elementClipboard.set({
      html,
      count: parts.length,
      sourceRoute: currentRouteRef.current,
      tags: list.map((info) => info.tagName),
    })
    // Đồng thời đưa vào clipboard hệ thống để có thể dán ra ngoài ứng dụng
    try {
      Promise.resolve(navigator.clipboard?.writeText(html)).catch(() => {})
    } catch {
      /* Clipboard hệ thống có thể bị từ chối quyền — bỏ qua */
    }
    showToast(
      `Đã sao chép ${parts.length} phần tử. Chuyển sang trang khác rồi nhấn Ctrl+V để dán.`,
      'ok',
      'Ctrl+C',
    )
  }, [multiSelection, selectedEl, showToast])

  const pasteSelection = useCallback(async () => {
    const clip = elementClipboard.get()
    if (!clip || !clip.html.trim()) {
      showToast('Bộ nhớ tạm đang trống — hãy chọn phần tử và nhấn Ctrl+C trước.', 'info')
      return
    }
    if (isInsertingRef.current) return
    if (!iframeRef.current?.contentWindow) {
      showToast('Canvas chưa sẵn sàng để dán. Hãy chờ trang tải xong.', 'warn')
      return
    }

    isInsertingRef.current = true
    const now = Date.now()
    lastInsertTimeRef.current = now
    try {
      const info = selectedEl
      const placement: InsertPlacement = info ? 'after' : 'inside'
      const domTargetUid = info?.uid || 'pm_body'
      const domHtml = clip.html

      // Tự dò tệp mã nguồn của phần tử đích (nếu có) để ghi đúng chỗ
      let resolvedFullPath: string | undefined
      let resolvedLineNumber: number | undefined
      if (projectPath && info && info.uid === selectedEl?.uid && sourceLoc?.fullPath) {
        resolvedFullPath = sourceLoc.fullPath
        resolvedLineNumber = sourceLoc.lineNumber
      }
      if (!resolvedFullPath && projectPath && info && api?.inspect?.locateSource) {
        try {
          const loc = await api.inspect.locateSource({
            projectPath,
            textSnippet: info.textSnippet,
            tagName: info.tagName,
            className: info.className,
            currentPath: info.currentPath || currentRouteRef.current,
            id: info.id,
            selector: info.selector,
          })
          if (loc?.fullPath) {
            resolvedFullPath = loc.fullPath
            resolvedLineNumber = loc.lineNumber
          }
        } catch {}
      }

      const targetObj = {
        ...buildTarget(info, placement),
        fullPath: resolvedFullPath,
        lineNumber: resolvedLineNumber,
      }

      const startEpoch = docEpochRef.current

      // 1. Chèn vào DOM thật trong iframe TRƯỚC khi ghi tệp. Nếu ghi tệp trước,
      //    dev server có thể hot-reload và render sẵn phần tử mới, khiến lần chèn
      //    thủ công ngay sau đó tạo ra bản sao trùng lặp.
      const domData = await sendToolboxMessage('PM_TOOLBOX_INSERT', {
        html: domHtml,
        targetUid: domTargetUid,
        placement,
      })
      const r = domData?.result
      if (!r) {
        showToast('Không dán được phần tử vào canvas.', 'err')
        return
      }

      // 2. Ghi vào mã nguồn của trang hiện tại (một lần ghi duy nhất)
      let writeResult: Awaited<ReturnType<typeof api.toolbox.mutate>> | null = null
      if (projectPath) {
        try {
          writeResult = await api.toolbox.mutate({
            kind: 'insert',
            projectPath,
            target: targetObj,
            html: domHtml,
            dryRun: false,
          })
          if (!writeResult.success) {
            showToast(writeResult.error || 'Không ghi được mã nguồn, chỉ dán trên canvas.', 'warn')
          }
        } catch (err) {
          console.warn('Lỗi ghi mã nguồn khi dán phần tử:', err)
        }
      }

      // 3. Đưa vào bộ đệm hoàn tác (Ctrl+Z / Ctrl+Y)
      editorBuffer.pushAction({
        type: 'INSERT',
        description: clip.count > 1 ? `Dán ${clip.count} phần tử` : 'Dán phần tử',
        target: {
          tagName: targetObj.tagName || 'div',
          id: targetObj.id,
          className: targetObj.className,
          domPath: targetObj.domPath,
          uid: targetObj.uid,
          selector: targetObj.selector,
          textSnippet: targetObj.textSnippet,
        },
        sourceLoc: writeResult?.fullPath
          ? {
              filePath: writeResult.filePath || '',
              fullPath: writeResult.fullPath,
              lineNumber: writeResult.startLine || 1,
            }
          : resolvedFullPath
            ? {
                filePath: '',
                fullPath: resolvedFullPath,
                lineNumber: resolvedLineNumber || 1,
              }
            : undefined,
        before: { styles: {} },
        after: { styles: {} },
        dom: {
          kind: 'insert',
          parentUid: r.parentUid,
          index: r.index,
          uids: r.uids || [],
          html: domHtml,
        },
        fileBefore: writeResult?.oldText,
        fileAfter: writeResult?.newText,
        projectPath,
        docEpoch: startEpoch,
      })

      if (r.uids?.[0]) {
        iframeRef.current?.contentWindow?.postMessage({ type: 'PM_SELECT_BY_UID', uid: r.uids[0] }, '*')
      }
      setMultiSelection([])

      const crossPage = Boolean(clip.sourceRoute && clip.sourceRoute !== currentRouteRef.current)
      showToast(
        `Đã dán ${clip.count} phần tử${crossPage ? ' sang trang này' : ''} (Ctrl+Z để hoàn tác).`,
        'ok',
        'Ctrl+V',
      )
    } finally {
      window.setTimeout(() => {
        isInsertingRef.current = false
      }, 400)
    }
  }, [
    projectPath,
    selectedEl,
    sourceLoc,
    buildTarget,
    sendToolboxMessage,
    showToast,
  ])

  // ─── XOÁ NHIỀU PHẦN TỬ ĐANG CHỌN (MỘT LẦN HOÀN TÁC) ───
  const beginDeleteSelection = useCallback(async () => {
    const list = multiSelection.length > 0 ? multiSelection : selectedEl ? [selectedEl] : []
    if (list.length === 0) {
      showToast('Chọn một hoặc nhiều phần tử trên canvas trước.', 'info')
      return
    }
    // Một phần tử + có dự án: giữ nguyên luồng xem diff & xác nhận như cũ
    if (list.length === 1 && selectedEl && list[0].uid === selectedEl.uid && projectPath) {
      void beginToolboxDelete()
      return
    }
    if (pendingMutation) return
    if (mutationBusy) return

    // Epoch tại thời điểm bắt đầu: các dom record bên dưới thuộc về tài liệu này.
    const startEpoch = docEpochRef.current

    setMutationBusy(true)
    const domRecords: Array<{ parentUid: string; index: number; html: string; uid: string }> = []
    const fileEdits = new Map<
      string,
      { filePath?: string; fullPath: string; lineNumber?: number; before: string; after: string }
    >()
    let sourceFailures = 0

    try {
      // 1) Xoá DOM TRƯỚC khi ghi tệp. Nếu ghi tệp trước, dev server có thể
      //    hot-reload iframe giữa chừng và làm mất data-pm-uid của các bước sau.
      //    Thứ tự ngược tài liệu giúp index chèn lại khi Undo luôn ổn định.
      for (let i = list.length - 1; i >= 0; i--) {
        const info = list[i]
        if (!info.uid) continue
        const data = await sendToolboxMessage('PM_TOOLBOX_DELETE', { uid: info.uid })
        const result = data?.result
        if (result) {
          domRecords.push({
            parentUid: result.parentUid,
            index: result.index,
            html: result.html,
            uid: info.uid,
          })
        }
      }

      // 2) Dò tệp nguồn cho từng phần tử rồi gom theo tệp. Mỗi tệp chỉ bị ghi
      //    MỘT lần bằng delete-batch để tránh hot-reload giữa các lần xoá.
      if (projectPath) {
        const groups = new Map<string, ElementMutationTarget[]>()
        for (const info of list) {
          let fullPath: string | undefined
          let lineNumber: number | undefined
          if (api?.inspect?.locateSource) {
            try {
              const loc = await api.inspect.locateSource({
                projectPath,
                textSnippet: info.textSnippet,
                tagName: info.tagName,
                className: info.className,
                currentPath: info.currentPath || currentRouteRef.current,
                id: info.id,
                selector: info.selector,
              })
              if (loc?.fullPath) {
                fullPath = loc.fullPath
                lineNumber = loc.lineNumber
              }
            } catch {
              /* dò thất bại — tính vào sourceFailures bên dưới */
            }
          }
          if (!fullPath) {
            sourceFailures++
            continue
          }
          const target: ElementMutationTarget = {
            uid: info.uid,
            tagName: info.tagName,
            id: info.id,
            className: info.className,
            textSnippet: info.textSnippet,
            domPath: info.domPath,
            selector: info.selector,
            currentPath: info.currentPath || currentRouteRef.current,
            fullPath,
            lineNumber,
          }
          const group = groups.get(fullPath) || []
          group.push(target)
          groups.set(fullPath, group)
        }

        for (const [fullPath, targets] of groups) {
          try {
            const res = await api.toolbox.mutate({
              kind: 'delete-batch',
              projectPath,
              targets,
              dryRun: false,
            })
            if (res.success && typeof res.oldText === 'string' && typeof res.newText === 'string') {
              fileEdits.set(res.fullPath || fullPath, {
                filePath: res.filePath,
                fullPath: res.fullPath || fullPath,
                lineNumber: res.startLine,
                before: res.oldText,
                after: res.newText,
              })
              const matched = res.matchedCount ?? targets.length
              sourceFailures += Math.max(0, targets.length - matched)
            } else {
              sourceFailures += targets.length
            }
          } catch {
            sourceFailures += targets.length
          }
        }
      }

      if (domRecords.length > 0 || fileEdits.size > 0) {
        domRecords.sort((a, b) => a.index - b.index)
        const editList = Array.from(fileEdits.values())
        const firstEdit = editList[0]
        const first = list[0]
        editorBuffer.pushAction({
          type: 'DELETE',
          description: `Xoá ${domRecords.length || list.length} phần tử`,
          target: {
            tagName: first.tagName,
            id: first.id,
            className: first.className,
            domPath: first.domPath,
            uid: first.uid,
            selector: first.selector,
            textSnippet: first.textSnippet,
          },
          sourceLoc: firstEdit
            ? {
                filePath: firstEdit.filePath || '',
                fullPath: firstEdit.fullPath,
                lineNumber: firstEdit.lineNumber || 1,
              }
            : undefined,
          before: { styles: {} },
          after: { styles: {} },
          dom: {
            kind: 'delete-batch',
            uids: domRecords.map((record) => record.uid).filter(Boolean),
            records: domRecords,
          },
          fileEdits: editList,
          projectPath,
          docEpoch: startEpoch,
        })
      }

      setMultiSelection([])
      setSelectedEl(null)
      iframeRef.current?.contentWindow?.postMessage({ type: 'PM_CLEAR_MULTI_SELECTION' }, '*')

      if (domRecords.length === 0 && fileEdits.size === 0) {
        showToast('Không xoá được phần tử nào trên canvas.', 'err')
      } else if (!projectPath) {
        showToast(`Đã xoá ${domRecords.length} phần tử trên canvas (chưa gắn dự án nên không ghi mã nguồn).`, 'warn')
      } else if (sourceFailures > 0) {
        showToast(
          `Đã xoá ${domRecords.length} phần tử trên canvas; ${sourceFailures} phần tử chưa dò được mã nguồn.`,
          'warn',
        )
      } else {
        showToast(`Đã xoá ${domRecords.length} phần tử khỏi trang và mã nguồn (Ctrl+Z để hoàn tác).`, 'ok')
      }
    } finally {
      setMutationBusy(false)
    }
  }, [
    multiSelection,
    selectedEl,
    projectPath,
    pendingMutation,
    mutationBusy,
    sendToolboxMessage,
    showToast,
    beginToolboxDelete,
  ])

  canvasActionsRef.current = {
    copy: copySelection,
    paste: pasteSelection,
    deleteSelection: beginDeleteSelection,
  }

  const beginToolboxDuplicate = useCallback(async () => {
    if (!projectPath || !selectedEl) {
      showToast('Chọn một phần tử trên canvas trước.', 'info')
      return
    }
    const payload: ToolboxMutationPayload = {
      kind: 'duplicate',
      projectPath,
      target: buildTarget(selectedEl),
      dryRun: true,
    }
    try {
      const preview = await api.toolbox.mutate(payload)
      if (!preview.success) {
        showToast(preview.error || 'Không thể nhân bản phần tử.', 'err')
        return
      }
      setPendingMutation({
        payload,
        preview,
        title: `Nhân bản <${selectedEl.tagName.toLowerCase()}>`,
        subtitle: 'Một bản sao sẽ được thêm ngay sau phần tử đang chọn.',
        mode: 'duplicate',
        targetUid: selectedEl.uid,
      })
    } catch {
      showToast('Không thể tạo bản xem trước.', 'err')
    }
  }, [projectPath, selectedEl, sourceLoc, buildTarget, showToast])

  const beginToolboxAttributes = useCallback(async () => {
    if (!projectPath || !selectedEl) {
      showToast('Chọn một phần tử trên canvas trước.', 'info')
      return
    }

    const attributes: Record<string, string | null> = {}
    const before: Record<string, string | null> = {}
    const after: Record<string, string | null> = {}

    const nextId = attrsDraft.id.trim()
    const nextClass = attrsDraft.className.trim()
    if (nextId !== (selectedEl.id || '')) {
      attributes.id = nextId || null
      before.id = selectedEl.id || null
      after.id = nextId || null
    }
    if (nextClass !== (selectedEl.className || '')) {
      attributes.class = nextClass || null
      before.class = selectedEl.className || null
      after.class = nextClass || null
    }

    const textChanged = Boolean(selectedEl.isLeaf) && attrsDraft.text !== selectedEl.textSnippet
    if (Object.keys(attributes).length === 0 && !textChanged) {
      showToast('Chưa có thay đổi thuộc tính nào.', 'info')
      return
    }

    const payload: ToolboxMutationPayload = {
      kind: 'attributes',
      projectPath,
      target: buildTarget(selectedEl),
      attributes,
      text: textChanged ? attrsDraft.text : undefined,
      dryRun: true,
    }

    try {
      const preview = await api.toolbox.mutate(payload)
      if (!preview.success) {
        showToast(preview.error || 'Không thể sửa thuộc tính.', 'err')
        return
      }
      setPendingMutation({
        payload,
        preview,
        title: `Sửa thuộc tính <${selectedEl.tagName.toLowerCase()}>`,
        subtitle: 'Chỉ các thuộc tính thay đổi mới được ghi vào mã nguồn.',
        mode: 'attributes',
        targetUid: selectedEl.uid,
        attrsBefore: before,
        attrsAfter: after,
        textBefore: selectedEl.textSnippet,
        textAfter: textChanged ? attrsDraft.text : undefined,
      })
    } catch {
      showToast('Không thể tạo bản xem trước.', 'err')
    }
  }, [projectPath, selectedEl, sourceLoc, attrsDraft, buildTarget, showToast])

  const applyPendingMutation = useCallback(async (customBlock?: string) => {
    if (!pendingMutation) return
    setMutationBusy(true)
    const startEpoch = docEpochRef.current
    try {
      const {
        payload,
        mode,
        domHtml,
        targetUid,
        placement,
        attrsBefore,
        attrsAfter,
        textBefore,
        textAfter,
        preview,
      } = pendingMutation

      let result: MutationPreview
      // Nếu người dùng chọn lọc từng hunk và customBlock khác với newBlock dự tính:
      if (customBlock && preview?.fullPath && preview?.oldBlock && customBlock !== preview.newBlock) {
        if (customBlock === preview.oldBlock) {
          showToast('Đã bỏ qua tất cả đoạn thay đổi (giữ nguyên mã nguồn).', 'info')
          setPendingMutation(null)
          setMutationBusy(false)
          return
        }

        const fileRes = await api.fs.read(preview.fullPath)
        if (fileRes && typeof fileRes.text === 'string' && fileRes.text.includes(preview.oldBlock)) {
          const updatedFullText = fileRes.text.replace(preview.oldBlock, customBlock)
          const writeRes = await api.toolbox.writeFile({
            fullPath: preview.fullPath,
            text: updatedFullText,
            backup: true,
          })
          if (!writeRes.success) {
            showToast(writeRes.error || 'Không ghi được mã nguồn.', 'err')
            setMutationBusy(false)
            return
          }
          result = {
            success: true,
            fullPath: preview.fullPath,
            filePath: preview.filePath,
            startLine: preview.startLine,
            endLine: preview.endLine,
            oldBlock: preview.oldBlock,
            newBlock: customBlock,
            oldText: fileRes.text,
            newText: updatedFullText,
          }
        } else {
          result = await api.toolbox.mutate({ ...payload, dryRun: false })
          if (!result.success) {
            showToast(result.error || 'Không ghi được mã nguồn.', 'err')
            setMutationBusy(false)
            return
          }
        }
      } else {
        result = await api.toolbox.mutate({ ...payload, dryRun: false })
        if (!result.success) {
          showToast(result.error || 'Không ghi được mã nguồn.', 'err')
          setMutationBusy(false)
          return
        }
      }

      let dom: DomMutationRecord | undefined
      if (mode === 'insert') {
        const data = await sendToolboxMessage('PM_TOOLBOX_INSERT', {
          html: domHtml || '',
          targetUid,
          placement,
        })
        const r = data?.result
        dom = {
          kind: 'insert',
          parentUid: r?.parentUid,
          index: r?.index,
          uids: r?.uids || [],
          html: domHtml,
        }
        if (r?.uids?.[0] && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: 'PM_SELECT_BY_UID', uid: r.uids[0] }, '*')
        }
      } else if (mode === 'duplicate') {
        const data = await sendToolboxMessage('PM_TOOLBOX_DUPLICATE', { uid: targetUid })
        const r = data?.result
        dom = {
          kind: 'duplicate',
          parentUid: r?.parentUid,
          index: r?.index,
          uids: r?.uids || [],
          html: r?.html,
        }
      } else if (mode === 'delete') {
        const data = await sendToolboxMessage('PM_TOOLBOX_DELETE', { uid: targetUid })
        const r = data?.result
        dom = {
          kind: 'delete',
          parentUid: r?.parentUid,
          index: r?.index,
          html: r?.html,
          uids: targetUid ? [targetUid] : [],
        }
      } else {
        const data = await sendToolboxMessage('PM_TOOLBOX_ATTRS', {
          uid: targetUid,
          attributes: attrsAfter,
          text: textAfter,
        })
        dom = {
          kind: 'attributes',
          targetUid,
          attributesBefore: attrsBefore,
          attributesAfter: attrsAfter,
          textBefore,
          textAfter,
        }
        if (data?.info) {
          setSelectedEl(data.info as RealElementInfo)
        }
      }

      editorBuffer.pushAction({
        type:
          mode === 'insert'
            ? 'INSERT'
            : mode === 'delete'
              ? 'DELETE'
              : mode === 'duplicate'
                ? 'DUPLICATE'
                : 'ATTRS',
        description:
          mode === 'insert'
            ? 'Chèn phần tử mới'
            : mode === 'delete'
              ? 'Xoá phần tử'
              : mode === 'duplicate'
                ? 'Nhân bản phần tử'
                : 'Sửa thuộc tính',
        target: {
          tagName: payload.target?.tagName || 'div',
          id: payload.target?.id,
          className: payload.target?.className,
          domPath: payload.target?.domPath,
          uid: payload.target?.uid,
          selector: payload.target?.selector,
          textSnippet: payload.target?.textSnippet,
        },
        sourceLoc: result.fullPath
          ? {
              filePath: result.filePath || '',
              fullPath: result.fullPath,
              lineNumber: result.startLine || 1,
            }
          : undefined,
        before: { styles: {}, text: textBefore },
        after: { styles: {}, text: textAfter },
        dom,
        fileBefore: preview.oldText,
        fileAfter: result.newText,
        projectPath,
        docEpoch: startEpoch,
      })

      setPendingMutation(null)
      showToast(
        mode === 'insert'
          ? 'Đã chèn phần tử vào trang và mã nguồn.'
          : mode === 'delete'
            ? 'Đã xoá phần tử khỏi trang và mã nguồn.'
            : mode === 'duplicate'
              ? 'Đã nhân bản phần tử.'
              : 'Đã cập nhật thuộc tính phần tử.',
        'ok',
      )
    } catch {
      showToast('Không áp dụng được thay đổi.', 'err')
    } finally {
      setMutationBusy(false)
    }
  }, [pendingMutation, projectPath, sendToolboxMessage, showToast])

  const applyPreviewOnlyMutation = useCallback(async () => {
    if (!pendingMutation) return
    setMutationBusy(true)
    const startEpoch = docEpochRef.current
    try {
      const {
        payload,
        mode,
        domHtml,
        targetUid,
        placement,
        attrsBefore,
        attrsAfter,
        textBefore,
        textAfter,
      } = pendingMutation

      let dom: DomMutationRecord | undefined
      if (mode === 'insert') {
        const data = await sendToolboxMessage('PM_TOOLBOX_INSERT', {
          html: domHtml || '',
          targetUid,
          placement,
        })
        const r = data?.result
        dom = {
          kind: 'insert',
          parentUid: r?.parentUid,
          index: r?.index,
          uids: r?.uids || [],
          html: domHtml,
        }
        if (r?.uids?.[0] && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: 'PM_SELECT_BY_UID', uid: r.uids[0] }, '*')
        }
      } else if (mode === 'duplicate') {
        const data = await sendToolboxMessage('PM_TOOLBOX_DUPLICATE', { uid: targetUid })
        const r = data?.result
        dom = {
          kind: 'duplicate',
          parentUid: r?.parentUid,
          index: r?.index,
          uids: r?.uids || [],
          html: r?.html,
        }
      } else if (mode === 'delete') {
        const data = await sendToolboxMessage('PM_TOOLBOX_DELETE', { uid: targetUid })
        const r = data?.result
        dom = {
          kind: 'delete',
          parentUid: r?.parentUid,
          index: r?.index,
          html: r?.html,
          uids: targetUid ? [targetUid] : [],
        }
      } else {
        const data = await sendToolboxMessage('PM_TOOLBOX_ATTRS', {
          uid: targetUid,
          attributes: attrsAfter,
          text: textAfter,
        })
        dom = {
          kind: 'attributes',
          targetUid,
          attributesBefore: attrsBefore,
          attributesAfter: attrsAfter,
          textBefore,
          textAfter,
        }
        if (data?.info) {
          setSelectedEl(data.info as RealElementInfo)
        }
      }

      editorBuffer.pushAction({
        type:
          mode === 'insert'
            ? 'INSERT'
            : mode === 'delete'
              ? 'DELETE'
              : mode === 'duplicate'
                ? 'DUPLICATE'
                : 'ATTRS',
        description:
          mode === 'insert'
            ? 'Chèn phần tử (Live Preview)'
            : mode === 'delete'
              ? 'Xoá phần tử (Live Preview)'
              : mode === 'duplicate'
                ? 'Nhân bản phần tử (Live Preview)'
                : 'Sửa thuộc tính (Live Preview)',
        target: {
          tagName: payload.target?.tagName || 'div',
          id: payload.target?.id,
          className: payload.target?.className,
          domPath: payload.target?.domPath,
          uid: payload.target?.uid,
          selector: payload.target?.selector,
          textSnippet: payload.target?.textSnippet,
        },
        before: { styles: {}, text: textBefore },
        after: { styles: {}, text: textAfter },
        dom,
        projectPath,
        docEpoch: startEpoch,
      })

      setPendingMutation(null)
      showToast('Đã áp dụng vào xem trước (Live Preview). Chưa ghi vào mã nguồn.', 'ok')
    } catch {
      showToast('Không áp dụng được thay đổi.', 'err')
    } finally {
      setMutationBusy(false)
    }
  }, [pendingMutation, projectPath, sendToolboxMessage, showToast])

  useEffect(() => {
    const unsub = onToolboxInsert((request) => {
      void beginToolboxInsert(request.item, {
        targetUid: request.targetUid,
        placement: request.placement,
      })
    })
    const pending = takePendingToolboxInsert()
    if (pending) {
      void beginToolboxInsert(pending.item, {
        targetUid: pending.targetUid,
        placement: pending.placement,
      })
    }
    return unsub
  }, [beginToolboxInsert])

  useEffect(() => {
    if (!selectedEl) {
      setAttrsDraft({ id: '', className: '', text: '' })
      return
    }
    setAttrsDraft({
      id: selectedEl.id || '',
      className: selectedEl.className || '',
      text: selectedEl.textSnippet || '',
    })
  }, [selectedEl?.uid, selectedEl?.id, selectedEl?.className, selectedEl?.textSnippet])

  // ─── KÉO CO GIÃN ĐỘ RỘNG SIDE PANEL CẠNH PHẢI ───
  const handleSidebarResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizingSidebar(true)
    sidebarDragRef.current = {
      startX: e.clientX,
      startWidth: inspectorWidth,
    }
  }

  useEffect(() => {
    if (!isResizingSidebar) return

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      const dx = sidebarDragRef.current.startX - e.clientX
      const nextW = Math.max(280, Math.min(680, sidebarDragRef.current.startWidth + dx))
      setInspectorWidth(nextW)
    }

    const handleMouseUp = () => {
      setIsResizingSidebar(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizingSidebar])

  // Khôi phục thuộc tính gốc
  const handleResetOriginal = useCallback(() => {
    if (!selectedEl) return

    setModifiedStyles({})

    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'PM_RESET_ORIGINAL',
        },
        '*'
      )
    }

    api.inspect.resetOriginal().catch(() => { })

    if (originalStyles) {
      const beforeSnapshot = {
        styles: { ...selectedEl.computedStyles },
        text: selectedEl.textSnippet,
        rect: { ...selectedEl.rect },
      }

      setSelectedEl((prev) => {
        if (!prev) return null
        return {
          ...prev,
          textSnippet: originalStyles.text,
          computedStyles: {
            ...prev.computedStyles,
            ...originalStyles.styles,
          },
        }
      })

      editorBuffer.pushAction({
        type: 'STYLE',
        description: `Khôi phục cài đặt gốc <${selectedEl.tagName.toLowerCase()}>`,
        target: {
          tagName: selectedEl.tagName,
          id: selectedEl.id,
          className: selectedEl.className,
          domPath: selectedEl.domPath,
          uid: selectedEl.uid,
          selector: selectedEl.selector,
          textSnippet: selectedEl.textSnippet,
        },
        sourceLoc: sourceLoc
          ? {
            filePath: sourceLoc.filePath,
            fullPath: sourceLoc.fullPath,
            lineNumber: sourceLoc.lineNumber,
          }
          : undefined,
        before: beforeSnapshot,
        after: {
          styles: { ...selectedEl.computedStyles, ...originalStyles.styles },
          text: originalStyles.text,
          rect: { ...selectedEl.rect },
        },
      })

      showToast('Đã khôi phục thuộc tính gốc của phần tử')
    }
  }, [selectedEl, originalStyles, sourceLoc, showToast])

  // Sao chép CSS Selector
  const handleCopySelector = () => {
    if (!selectedEl) return
    let selector = selectedEl.tagName
    if (selectedEl.id) {
      selector += `#${selectedEl.id}`
    } else if (selectedEl.className) {
      const cls = selectedEl.className.split(/\s+/).filter(Boolean).slice(0, 3).join('.')
      if (cls) selector += `.${cls}`
    }
    navigator.clipboard.writeText(selector)
    showToast(`Đã sao chép CSS Selector: ${selector}`)
  }

  // Sao chép toàn bộ classes
  const handleCopyClasses = () => {
    if (!selectedEl?.className) return
    navigator.clipboard.writeText(selectedEl.className)
    showToast('Đã sao chép danh sách class!')
  }

  // ─── GRID VISUAL EDITOR: trạng thái & thao tác ───
  const isFlexLayout = selectedEl?.computedStyles.display === 'flex'
  const isGridLayout = selectedEl?.computedStyles.display === 'grid'
  const gridColCount = countGridTracks(selectedEl?.computedStyles.gridTemplateColumns)
  const gridRowCount = countGridTracks(selectedEl?.computedStyles.gridTemplateRows)
  const matrixAlign = normalizeAlignValue(selectedEl?.computedStyles.alignItems)
  const matrixJustify = normalizeAlignValue(selectedEl?.computedStyles.justifyContent)

  const setGridTracks = (axis: 'columns' | 'rows', nextCount: number) => {
    const safe = Math.max(1, Math.min(GRID_MAX_TRACKS, nextCount))
    const template = `repeat(${safe}, minmax(0, 1fr))`
    handleApplyLiveChange(
      axis === 'columns' ? { gridTemplateColumns: template } : { gridTemplateRows: template },
      undefined,
      {
        description: `Grid ${axis === 'columns' ? 'cột' : 'hàng'}: ${safe}`,
        actionType: 'STYLE',
      }
    )
  }

  // Tính toán dòng Diff Preview cho Tab Mã nguồn thật
  const diffPreview = (() => {
    if (!sourceLoc) return null
    const origLine = sourceLoc.lineContent
    let newLine = origLine

    if (selectedEl && originalStyles && selectedEl.textSnippet !== originalStyles.text) {
      newLine = newLine.replace(originalStyles.text, selectedEl.textSnippet)
    }

    const entries = Object.entries(modifiedStyles).filter(([_, v]) => Boolean(v))
    if (entries.length > 0 && selectedEl) {
      const isJsx = sourceLoc.fullPath.endsWith('.tsx') || sourceLoc.fullPath.endsWith('.jsx')
      if (isJsx) {
        const jsxStyle = entries.map(([k, v]) => `${k}: '${v}'`).join(', ')
        if (/style=\{\{.*?\}\}/.test(newLine)) {
          newLine = newLine.replace(/style=\{\{.*?\}\}/, `style={{ ${jsxStyle} }}`)
        } else {
          const tagRegex = new RegExp(`(<${selectedEl.tagName})([\\s>])`)
          if (tagRegex.test(newLine)) {
            newLine = newLine.replace(tagRegex, `$1 style={{ ${jsxStyle} }}$2`)
          }
        }
      } else {
        const toKebab = (s: string) => s.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase()
        const htmlStyle = entries.map(([k, v]) => `${toKebab(k)}: ${v};`).join(' ')
        if (/style=".*?"/.test(newLine)) {
          newLine = newLine.replace(/style=".*?"/, `style="${htmlStyle}"`)
        } else {
          const tagRegex = new RegExp(`(<${selectedEl.tagName})([\\s>])`)
          if (tagRegex.test(newLine)) {
            newLine = newLine.replace(tagRegex, `$1 style="${htmlStyle}"$2`)
          }
        }
      }
    }

    return { origLine, newLine }
  })()

  const modifiedCount = Object.keys(modifiedStyles).length + (selectedEl && originalStyles && selectedEl.textSnippet !== originalStyles.text ? 1 : 0)

  const renderReferenceView = () => {
    if (!referenceAsset) return null
    return (
      <div
        className="canvas__reference-view"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="canvas__reference-bar">
          <span className="canvas__reference-name" title={referenceAsset.path}>
            <ImageIcon size={12} /> {referenceAsset.name}
          </span>
          <span className="canvas__reference-meta">
            {referenceSize ? `${referenceSize.w} × ${referenceSize.h}` : 'Đang đọc ảnh…'}
            {referenceAsset.size > 0 ? ` · ${formatBytes(referenceAsset.size)}` : ''}
          </span>
          <span className="canvas__tools-spacer" />
          <button
            className="canvas__tool-btn"
            title="Thu nhỏ ảnh mẫu"
            onClick={() => setReferenceZoom((z) => Math.max(10, z - 10))}
          >
            <ZoomOut size={13} />
          </button>
          <span className="canvas__zoom-badge">{referenceZoom}%</span>
          <button
            className="canvas__tool-btn"
            title="Phóng to ảnh mẫu"
            onClick={() => setReferenceZoom((z) => Math.min(400, z + 10))}
          >
            <ZoomIn size={13} />
          </button>
          <button
            className="canvas__tool-btn"
            title="Kích thước gốc 1:1"
            style={{ fontSize: 10, fontWeight: 700, width: 'auto', padding: '0 5px' }}
            onClick={() => {
              setReferenceZoom(100)
              setReferencePan({ x: 0, y: 0 })
            }}
          >
            1:1
          </button>
          <button
            className="canvas__tool-btn"
            title="Vừa khung nhìn"
            onClick={() => fitReference()}
          >
            <Maximize2 size={13} />
          </button>
          <button
            className="canvas__tool-btn"
            title="Quay lại giao diện Live (Esc)"
            onClick={() => toggleReference(false)}
          >
            <Monitor size={13} />
          </button>
          <button
            className="canvas__tool-btn canvas__tool-btn--danger"
            title="Bỏ ảnh mẫu"
            onClick={() => {
              toggleReference(false)
              onClearReference?.()
            }}
          >
            <X size={13} />
          </button>
        </div>

        <div
          ref={referenceCanvasRef}
          className={`canvas__reference-canvas ${!canvasGrid ? 'no-grid' : ''} ${isReferenceDragging ? 'is-dragging' : ''}`}
          onWheel={handleReferenceWheel}
          onMouseDown={handleReferenceMouseDown}
          onMouseMove={handleReferenceMouseMove}
          onMouseUp={endReferenceDrag}
          onMouseLeave={endReferenceDrag}
        >
          <img
            src={referenceAsset.dataUrl}
            alt={referenceAsset.name}
            className="canvas__reference-img"
            draggable={false}
            style={{
              transform: `translate(${referencePan.x}px, ${referencePan.y}px) scale(${referenceZoom / 100})`,
            }}
            onLoad={(event) => {
              const size = {
                w: event.currentTarget.naturalWidth,
                h: event.currentTarget.naturalHeight,
              }
              setReferenceSize(size)
              fitReference(size)
            }}
          />
        </div>
      </div>
    )
  }

  const renderFrameContent = () => (
    <>
      {/* Chặng 7 & D2-01 — Split slider so sánh Live với ảnh mẫu */}
      {effectiveIsSplitCompare && (referenceAsset?.dataUrl || effectiveOverlayImage) ? (
        <CanvasSplitSlider
          imageSrc={referenceAsset?.dataUrl || effectiveOverlayImage!}
          imageName={referenceAsset?.name || 'Ảnh thiết kế'}
          splitPosition={effectiveSplitPosition}
          onSplitChange={updateSplitPosition}
          onClose={() => setSplitCompareState(false)}
        />
      ) : (
        effectiveOverlayImage && effectiveOverlayVisible && (
          <div
            className="canvas__design-overlay"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${effectiveOverlayImage})`,
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'top center',
              opacity: effectiveOverlayOpacity / 100,
              pointerEvents: 'none',
              zIndex: 35,
              transition: 'opacity 0.1s ease',
            }}
          />
        )
      )}

                {(isPanActive || isPanning) && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      zIndex: 50,
                      cursor: isPanning ? 'grabbing' : 'grab',
                    }}
                  />
                )}

                {/* D2-04: Khung viền hover phần tử khi soi (chỉ hiển thị khi hoverOutline bật) */}
                {isInspectMode && hoverOutline && hoverEl && (!selectedEl || hoverEl.uid !== selectedEl.uid) && (
                  <div
                    className="canvas__inspect-hover"
                    style={{
                      top: hoverEl.rect.top,
                      left: hoverEl.rect.left,
                      width: hoverEl.rect.width,
                      height: hoverEl.rect.height,
                    }}
                  >
                    <span
                      className="canvas__inspect-hover-tag"
                      style={
                        hoverEl.rect.top < 24
                          ? { top: 2, left: 2, borderRadius: 3, boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }
                          : undefined
                      }
                    >
                      {hoverEl.tagName}
                      {hoverEl.className ? `.${hoverEl.className.split(/\s+/)[0]}` : ''} · {Math.round(hoverEl.rect.width)} × {Math.round(hoverEl.rect.height)}
                    </span>
                  </div>
                )}

                {/* Khung viền chỉ báo Khung cha (Chỉ hiển thị khi đang kéo chuột di chuyển để định hướng) */}
                {isInspectMode && isMovingEl && selectedEl && selectedEl.parent && (
                  <div
                    style={{
                      position: 'absolute',
                      top: selectedEl.parent.rect.top,
                      left: selectedEl.parent.rect.left,
                      width: selectedEl.parent.rect.width,
                      height: selectedEl.parent.rect.height,
                      border: '1.5px dashed rgba(99, 102, 241, 0.45)',
                      borderRadius: 6,
                      pointerEvents: 'none',
                      zIndex: 35,
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: 0,
                        marginBottom: 2,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: 'rgba(99, 102, 241, 0.85)',
                        color: '#ffffff',
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: '0.02em',
                      }}
                    >
                      Khung cha: {selectedEl.parent.tag}
                    </span>
                  </div>
                )}

                {/* Khung viền chỉ báo Đích Thả Mới (Drop Target Zone Indicator) */}
                {isInspectMode && isMovingEl && dropTargetHover && (
                  <div
                    style={{
                      position: 'absolute',
                      top: dropTargetHover.rect.top,
                      left: dropTargetHover.rect.left,
                      width: dropTargetHover.rect.width,
                      height: dropTargetHover.rect.height,
                      border: '2px solid #22c55e',
                      backgroundColor: 'rgba(34, 197, 94, 0.12)',
                      borderRadius: 6,
                      pointerEvents: 'none',
                      zIndex: 38,
                      boxShadow: '0 0 0 3px rgba(34, 197, 94, 0.25)',
                      transition: 'all 60ms ease-out',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: -22,
                        left: 0,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: '#16a34a',
                        color: '#ffffff',
                        fontSize: 10.5,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                      }}
                    >
                      <span>📥 Thả vào:</span>
                      <code>{dropTargetHover.tag}</code>
                    </span>
                  </div>
                )}

                {/* Khung chỉ báo thả phần tử từ Hộp công cụ — chuẩn VS2022 / Webflow */}
                {toolboxDropHover && (
                  <>
                    {/* Bounding box mờ bao quanh phần tử mục tiêu */}
                    <div
                      style={{
                        position: 'absolute',
                        top: toolboxDropHover.rect.top,
                        left: toolboxDropHover.rect.left,
                        width: toolboxDropHover.rect.width,
                        height: toolboxDropHover.rect.height,
                        border: toolboxDropHover.placement === 'inside'
                          ? '2.5px dashed #0284c7'
                          : '1px dashed rgba(2, 132, 199, 0.45)',
                        backgroundColor: toolboxDropHover.placement === 'inside'
                          ? 'rgba(2, 132, 199, 0.14)'
                          : 'rgba(2, 132, 199, 0.04)',
                        borderRadius: 6,
                        pointerEvents: 'none',
                        zIndex: 39,
                        boxShadow: toolboxDropHover.placement === 'inside'
                          ? '0 0 0 3px rgba(2, 132, 199, 0.25), inset 0 0 14px rgba(2, 132, 199, 0.15)'
                          : 'none',
                        transition: 'all 60ms ease-out',
                      }}
                    />

                    {/* VẠCH XANH CHỈ THỊ CHÈN TRƯỚC / SAU CHUẨN VS2022 / FIGMA */}
                    {toolboxDropHover.placement !== 'inside' && (
                      <div
                        style={{
                          position: 'absolute',
                          top: toolboxDropHover.placement === 'before'
                            ? toolboxDropHover.rect.top - 2
                            : toolboxDropHover.rect.top + toolboxDropHover.rect.height - 2,
                          left: Math.max(0, toolboxDropHover.rect.left - 4),
                          width: toolboxDropHover.rect.width + 8,
                          height: 4,
                          background: '#0284c7',
                          borderRadius: 2,
                          zIndex: 41,
                          pointerEvents: 'none',
                          boxShadow: '0 0 10px rgba(2, 132, 199, 0.8), 0 0 3px #38bdf8',
                        }}
                      >
                        {/* Điểm neo tròn bên trái */}
                        <span
                          style={{
                            position: 'absolute',
                            left: -4,
                            top: -3,
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: '#0284c7',
                            border: '2px solid #ffffff',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                          }}
                        />
                        {/* Điểm neo tròn bên phải */}
                        <span
                          style={{
                            position: 'absolute',
                            right: -4,
                            top: -3,
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: '#0284c7',
                            border: '2px solid #ffffff',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                          }}
                        />
                      </div>
                    )}

                    {/* Pill nhãn hiển thị vị trí chèn */}
                    <div
                      style={{
                        position: 'absolute',
                        top: toolboxDropHover.placement === 'before'
                          ? Math.max(2, toolboxDropHover.rect.top - 24)
                          : toolboxDropHover.placement === 'after'
                            ? toolboxDropHover.rect.top + toolboxDropHover.rect.height + 4
                            : Math.max(2, toolboxDropHover.rect.top - 22),
                        left: toolboxDropHover.rect.left,
                        padding: '3px 9px',
                        borderRadius: 4,
                        background: '#0284c7',
                        color: '#ffffff',
                        fontSize: 10.5,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                        zIndex: 42,
                        pointerEvents: 'none',
                      }}
                    >
                      <span>
                        {toolboxDropHover.placement === 'inside'
                          ? '📥 Thả vào trong:'
                          : toolboxDropHover.placement === 'before'
                            ? '⬆️ Chèn trước:'
                            : '⬇️ Chèn sau:'}
                      </span>
                      <code style={{ background: 'rgba(0,0,0,0.25)', padding: '1px 5px', borderRadius: 3 }}>
                        {toolboxDropHover.tag}
                      </code>
                    </div>
                  </>
                )}

                {/* Khung viền phần tử ĐÃ CHỌN (Selection Box) */}
                {isInspectMode && selectedEl && (() => {
                  return (
                    <div
                      className="canvas__inspect-selected"
                      style={{
                        top: selectedEl.rect.top,
                        left: selectedEl.rect.left,
                        width: selectedEl.rect.width,
                        height: selectedEl.rect.height,
                      }}
                    >
                      {/* Nút kéo di chuyển vị trí phần tử (Icon-only, gọn gàng và tinh tế) */}
                      <div
                        className="canvas__inspect-move-bar"
                        style={selectedEl.rect.top < 26 ? { top: 2, right: 2 } : undefined}
                        onMouseDown={handleStartElementMove}
                        title="Bấm giữ và kéo để di chuyển vị trí phần tử"
                      >
                        <Move size={12} strokeWidth={2.4} />
                      </div>

                      {/* D2-03: Nút mở AI Sidecar trên góc khung viền chọn */}
                      <button
                        type="button"
                        className={`canvas__inspect-ai-btn ${isSidecarOpen ? 'active' : ''}`}
                        style={selectedEl.rect.top < 26 ? { top: 2, right: 28 } : undefined}
                        onClick={(e) => {
                          e.stopPropagation()
                          setIsSidecarOpen((open) => !open)
                        }}
                        title={
                          isSidecarOpen
                            ? 'Đóng trợ lý AI (Esc)'
                            : 'Nhờ AI sửa phần tử này (Ctrl+K hoặc Shift+A)'
                        }
                      >
                        <Sparkles size={11} />
                        <span>AI</span>
                      </button>

                      <span
                        className="canvas__inspect-selected-tag"
                        style={
                          selectedEl.rect.top < 24
                            ? { top: 2, left: 2, borderRadius: 3, boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }
                            : undefined
                        }
                      >
                        {selectedEl.tagName}
                        {selectedEl.id ? `#${selectedEl.id}` : ''}
                      </span>
                      <span className="canvas__inspect-selected-size">
                        {Math.round(selectedEl.rect.width)} × {Math.round(selectedEl.rect.height)}
                      </span>

                      {RESIZE_HANDLES.map((h) => (
                        <span
                          key={h.key}
                          className={`canvas__inspect-handle ${h.key}`}
                          onMouseDown={(e) => handleStartElementResize(e, h.key)}
                          title={`Kéo để thay đổi kích thước (${h.label})`}
                        />
                      ))}
                    </div>
                  )
                })()}

                {/* D2-03: Component AI Sidecar gắn vào phần tử đang chọn */}
                {isInspectMode && isSidecarOpen && selectedEl && (
                  <AISidecar
                    x={sidecarPos.x}
                    y={sidecarPos.y}
                    label={`<${selectedEl.tagName.toLowerCase()}${selectedEl.id ? `#${selectedEl.id}` : ''}>`}
                    detail={
                      sourceLoc
                        ? `${sourceLoc.filePath}:${sourceLoc.lineNumber}`
                        : selectedEl.className
                        ? `.${selectedEl.className.split(' ').filter(Boolean).slice(0, 3).join('.')}`
                        : selectedEl.selector
                    }
                    projectId={projectId}
                    projectPath={projectPath}
                    projectName={projectName}
                    currentRoute={currentRoute}
                    selectedEl={selectedEl}
                    sourceLoc={sourceLoc}
                    initialExpanded={true}
                    onClose={() => setIsSidecarOpen(false)}
                    onOpenPanel={() => onOpenAIPanel?.()}
                    onShowToast={(kind, text) => showToast(text, kind === 'err' ? 'err' : kind === 'ok' ? 'ok' : 'info')}
                    onPreview={handleAiPreview}
                    onUndo={handleAiUndo}
                    onSyncCode={handleAiSyncCode}
                  />
                )}

                {error ? (
                  <div style={{ height: '100%', overflowY: 'auto' }}>
                    <VisualErrorCard
                      error={error}
                      installing={installing}
                      onInstall={onInstall}
                      onRetry={onRun}
                      onAskAI={onOpenAIPanel}
                    />
                  </div>
                ) : running && url && !isServerReady ? (
                  <div className="canvas__frame-fallback" style={{ gap: 14 }}>
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 14,
                        background: 'var(--panel-2)',
                        display: 'grid',
                        placeItems: 'center',
                        color: 'var(--accent)',
                        position: 'relative',
                      }}
                    >
                      <RefreshCw size={24} className="pm-spin" />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <h3 style={{ fontSize: 16, fontWeight: 650, marginBottom: 6 }}>
                        Đang kết nối tới máy chủ...
                      </h3>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 12px',
                          borderRadius: 6,
                          background: 'var(--panel-2)',
                          fontSize: 12,
                          fontFamily: 'monospace',
                          color: 'var(--accent-text)',
                          marginBottom: 10,
                        }}
                      >
                        <span className="pm-dot live" />
                        {url}
                      </div>
                      <p style={{ fontSize: 12.5, color: 'var(--text-3)', maxWidth: 420, margin: '0 auto 16px' }}>
                        {connectTimeout
                          ? 'Máy chủ phản hồi chậm hoặc đang gặp sự cố khi khởi động. Bạn có thể bấm thử lại hoặc mở bằng trình duyệt ngoài.'
                          : `Đang chờ máy chủ ${projectName} biên dịch và phản hồi kết nối HTTP...${connectRetryCount > 0 ? ` (Lần thử ${connectRetryCount})` : ''
                          }`}
                      </p>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <button
                          className="btn secondary"
                          onClick={() => setIframeKey((k) => k + 1)}
                          style={{
                            fontSize: 12,
                            padding: '6px 14px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            cursor: 'pointer',
                          }}
                        >
                          <RefreshCw size={12} />
                          Thử lại ngay
                        </button>
                        {onOpenExternal && (
                          <button
                            className="btn secondary"
                            onClick={() => onOpenExternal(url)}
                            style={{
                              fontSize: 12,
                              padding: '6px 14px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              cursor: 'pointer',
                            }}
                          >
                            <ExternalLink size={12} />
                            Mở trình duyệt ngoài
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : running && safeCanvasUrl && isServerReady ? (
                  <iframe
                    ref={iframeRef}
                    key={iframeKey}
                    src={safeCanvasUrl}
                    className="canvas__iframe"
                    title={projectName}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 0,
                      display: 'block',
                      background: '#ffffff',
                      pointerEvents: isPanActive || isPanning ? 'none' : 'auto',
                    }}
                    onLoad={() => {
                      if (iframeLoadedOnceRef.current) {
                        // Iframe vừa tải lại tài liệu → uid cũ không còn giá trị.
                        docEpochRef.current += 1
                        editorBuffer.setDocumentEpoch(docEpochRef.current)
                        setSelectedEl(null)
                        setMultiSelection([])
                      } else {
                        iframeLoadedOnceRef.current = true
                      }
                      try {
                        const win = iframeRef.current?.contentWindow
                        if (win && win.localStorage) {
                          try {
                            if (!win.localStorage.getItem('bancotuong.token')) {
                              win.localStorage.setItem('bancotuong.token', 'preview-token')
                              win.localStorage.setItem(
                                'bancotuong.user',
                                JSON.stringify({
                                  id: 1,
                                  username: 'Kỳ Thủ',
                                  displayName: 'Kỳ Thủ Mẫu',
                                  email: 'preview@bancotuong.vn',
                                  elo: 1200,
                                })
                              )
                            }
                          } catch {}
                        }
                        if (win && win.location) {
                          const href = win.location.href
                          const pathname = win.location.pathname || '/'
                          if (href && href.startsWith('chrome-error://')) {
                            // Máy chủ vừa khởi động lại khi lưu tệp → đợi kết nối sẵn sàng rồi tự nạp lại
                            if (running) {
                              setIsServerReady(false)
                              window.setTimeout(() => {
                                setIframeKey((k) => k + 1)
                              }, 500)
                            }
                            return
                          }
                          if (href && /^https?:/i.test(href)) {
                            setCurrentLiveUrl(href)
                            onUrlChange?.(href, pathname)
                          }
                        }
                      } catch { }
                      setTimeout(() => {
                        if (iframeRef.current?.contentWindow) {
                          iframeRef.current.contentWindow.postMessage({ type: 'PM_GET_DOM_TREE' }, '*')
                        }
                      }, 250)
                    }}
                  />
                ) : running && !url ? (
                  <div className="canvas__frame-fallback" style={{ gap: 14 }}>
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 14,
                        background: 'var(--panel-2)',
                        display: 'grid',
                        placeItems: 'center',
                        color: 'var(--accent)',
                      }}
                    >
                      <RefreshCw size={24} className="pm-spin" />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <h3 style={{ fontSize: 16, fontWeight: 650, marginBottom: 6 }}>
                        Đang khởi động máy chủ...
                      </h3>
                      <p style={{ fontSize: 12.5, color: 'var(--text-3)', maxWidth: 380, margin: '0 auto' }}>
                        Đang biên dịch và kích hoạt dịch vụ phát triển cho <b>{projectName}</b>. Địa chỉ xem trước sẽ tự động mở khi sẵn sàng.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="canvas__frame-fallback">
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: 'var(--panel-2)',
                        display: 'grid',
                        placeItems: 'center',
                        marginBottom: 14,
                        color: 'var(--accent-text)',
                      }}
                    >
                      <Globe size={24} />
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 650, marginBottom: 6 }}>
                      Chưa có bản xem trước trực tiếp
                    </h3>
                    <p style={{ fontSize: 12.5, color: 'var(--text-3)', maxWidth: 380, marginBottom: 18 }}>
                      Khởi động máy chủ phát triển của <b>{projectName}</b> để xem giao diện ứng dụng hoạt động thực tế ngay trên khung này.
                    </p>
                    {onRun && (
                      <button
                        className="btn primary"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 7,
                          padding: '8px 18px',
                          borderRadius: 8,
                          fontSize: 12.5,
                          fontWeight: 600,
                          background: 'var(--accent)',
                          color: '#fff',
                          border: 0,
                          cursor: 'pointer',
                        }}
                        onClick={onRun}
                      >
                        <Play size={12} fill="currentColor" /> Chạy dự án (F5)
                      </button>
                    )}
                  </div>
                )}

    </>
  )

  return (
    <div className="canvas">
      {/* Toast thông báo nổi HUD cao cấp (Figma / Webflow Style) */}
      {toast && (
        <div className={`canvas__toast canvas__toast--${toast.kind || 'ok'}`}>
          <div className="canvas__toast-icon">
            {toast.kind === 'err' ? (
              <AlertCircle size={13} />
            ) : toast.kind === 'warn' ? (
              <AlertTriangle size={13} />
            ) : toast.kind === 'info' ? (
              <Info size={13} />
            ) : (
              <CheckCircle2 size={13} />
            )}
          </div>
          <span className="canvas__toast-text">{toast.text}</span>
          {toast.shortcut && <kbd className="canvas__toast-kbd">{toast.shortcut}</kbd>}
        </div>
      )}

      {/* Lớp Drag Shield toàn màn hình */}
      {(resizingEl || isResizingSidebar || isMovingEl) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            cursor: isMovingEl ? 'move' : resizingEl ? `${resizingEl.handle}-resize` : 'col-resize',
          }}
        />
      )}

      {/* ═══════════════════════════════════════════════
          HÀNG 1: THANH CÔNG CỤ ĐỈNH CANVAS
          ═══════════════════════════════════════════════ */}
      {!isPageFlowOpen && (isToolbarCollapsed ? (
        <div
          className="canvas__tools-collapsed"
          onClick={() => setIsToolbarCollapsed(false)}
          title="Mở rộng thanh công cụ Canvas"
        >
          <ChevronDown size={12} />
          <span>Mở rộng thanh công cụ</span>
        </div>
      ) : (
        <div className="canvas__tools">
          {/* Nhóm 1: Soi phần tử & Con trỏ */}
          <div className="canvas__seg">
            <button
              className={`canvas__seg-btn ${isInspectMode ? 'active accent' : ''}`}
              onClick={() => {
                const next = !isInspectMode
                setIsInspectMode(next)
                if (!next) {
                  setSelectedEl(null)
                  setHoverEl(null)
                  setMultiSelection([])
                }
                showToast(
                  next ? 'Đã bật chế độ Soi phần tử' : 'Đã tắt chế độ Soi phần tử',
                  next ? 'ok' : 'info',
                  next ? 'Phím I' : undefined,
                )
              }}
              title="Bật/Tắt chế độ Soi phần tử (Phím tắt: I)"
              style={{
                height: 24,
                padding: '0 9px',
                gap: 6,
                borderRadius: 6,
                fontWeight: 650,
                background: isInspectMode ? 'var(--accent, #6d5df5)' : 'var(--panel-2)',
                color: isInspectMode ? '#ffffff' : 'var(--text)',
                border: '1px solid var(--line)',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              <PencilFillIcon size={12} />
            </button>

            {TOOLS.map((t) => (
              <button
                key={t.key}
                className={`canvas__seg-btn icon-only ${tool === t.key ? 'active' : ''}`}
                onClick={() => setTool(t.key)}
                title={`${t.label} (${t.shortcut})`}
              >
                <t.icon size={13} />
              </button>
            ))}

            <button
              className={`canvas__seg-btn icon-only ${isPageFlowOpen ? 'active' : ''}`}
              onClick={() => setIsPageFlowOpen((open) => !open)}
              title={isPageFlowOpen ? 'Đóng không gian Đa màn hình liên kết' : 'Không gian Đa màn hình liên kết (Multi-Page Canvas)'}
            >
              <Network size={13} />
            </button>
          </div>

          <div className="canvas__tools-spacer" />

          {/* Nhóm 2: Thiết bị / Viewport */}
          <div className="canvas__seg">
            {VIEWPORTS.map((v) => (
              <button
                key={v.key}
                className={`canvas__seg-btn ${viewport === v.key ? 'active' : ''}`}
                onClick={() => {
                  setViewport(v.key)
                  // Đổi thiết bị thì tự canh vừa khung cho đúng kích thước mới.
                  zoomToFit(v)
                }}
                title={
                  v.key === 'responsive'
                    ? 'Toàn khung (100% full màn hình, chuẩn web)'
                    : `${v.label} · ${v.w} × ${v.h}`
                }
              >
                <v.icon size={12} />
                <span>{v.label}</span>
              </button>
            ))}
          </div>

          <div className="canvas__tools-spacer" />

          {/* Nhóm 4: Zoom */}
          <div className="canvas__seg">
            <button
              className="canvas__tool-btn"
              title="Thu nhỏ (Ctrl -)"
              onClick={() => {
                setZoom((z) => Math.max(10, z - 10))
                if (viewport === 'responsive') setViewport('desktop')
              }}
            >
              <ZoomOut size={13} />
            </button>
            {zoomEditing ? (
              <>
                <input
                  ref={zoomInputRef}
                  className="canvas__zoom-input"
                  value={zoomDraft}
                  inputMode="numeric"
                  onChange={(e) => setZoomDraft(e.target.value.replace(/[^\d]/g, ''))}
                  onBlur={commitZoomEdit}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitZoomEdit()
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      setZoomEditing(false)
                    }
                  }}
                  title="Nhập % phóng to (10–200), Enter để áp dụng"
                />
                <span className="canvas__zoom-unit">%</span>
              </>
            ) : (
              <span
                className="canvas__zoom-badge"
                onClick={beginZoomEdit}
                title="Nhấp để nhập % phóng to (F: vừa khung)"
              >
                {zoom}%
              </span>
            )}
            <button
              className="canvas__tool-btn"
              title="Phóng to (Ctrl +)"
              onClick={() => {
                setZoom((z) => Math.min(200, z + 10))
                if (viewport === 'responsive') setViewport('desktop')
              }}
            >
              <ZoomIn size={13} />
            </button>
            <button
              className="canvas__tool-btn"
              title="Khôi phục kích thước 100% (Scale 1:1)"
              onClick={() => {
                setZoom(100)
                setPan({ x: 0, y: 0 })
              }}
              style={{ fontSize: 10, fontWeight: 700, padding: '0 4px', width: 'auto' }}
            >
              1:1
            </button>
            <button
              className="canvas__tool-btn"
              title="Vừa khung nhìn (F) — canh thiết bị vừa khít khu canvas"
              onClick={() => zoomToFit()}
            >
              <Scan size={13} />
            </button>
          </div>

          {/* Nút thu gọn thanh công cụ lên đỉnh */}
          <button
            className="canvas__tool-btn"
            title="Thu gọn thanh công cụ để mở rộng không gian Canvas"
            onClick={() => setIsToolbarCollapsed(true)}
            style={{ marginLeft: 2 }}
          >
            <ChevronUp size={13} />
          </button>
        </div>
      ))}
      {/* ═══════════════════════════════════════════════
          THÂN CANVAS: BÊN TRÁI LÀ STAGE, BÊN PHẢI LÀ INSPECTOR SIDE PANEL
          ═══════════════════════════════════════════════ */}
      <div className="canvas__body">
        {/* SÂN KHẤU VÔ CỰC (Bên trái) */}
        <div
          className={`canvas__stage ${!canvasGrid ? 'no-grid' : ''} tool-${tool} ${isPanning ? 'is-panning' : ''}`}
          ref={stageRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={() => {
            if (!isPanActive) {
              setSelectedEl(null)
              setMultiSelection([])
              iframeRef.current?.contentWindow?.postMessage({ type: 'PM_CLEAR_MULTI_SELECTION' }, '*')
            }
          }}
        >
          {/* SÂN KHẤU: Giữ nguyên cấu trúc cây để đổi giữa Toàn khung và Mobile/Desktop không tháo/nạp lại iframe */}
          <div
            className={viewport === 'responsive' ? 'canvas__responsive-wrap' : 'canvas__transform-layer'}
            style={
              viewport === 'responsive'
                ? {
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    overflow: 'hidden',
                    background: '#ffffff',
                  }
                : {
                    transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom / 100})`,
                  }
            }
          >
            <div
              className={viewport === 'responsive' ? undefined : 'canvas__frame-wrap'}
              style={viewport === 'responsive' ? { width: '100%', height: '100%' } : { width: currentVp.w }}
              onClick={(e) => e.stopPropagation()}
            >
              {viewport !== 'responsive' ? (
                <div key="frame-bar" className="canvas__frame-bar">
                  <div className="canvas__frame-dots">
                    <span className="dot red" />
                    <span className="dot yellow" />
                    <span className="dot green" />
                  </div>
                  <span className="canvas__frame-url" title={currentLiveUrl || url || ''}>
                    {(currentLiveUrl || url) ? (currentLiveUrl || url)!.replace(/^https?:\/\//, '') : 'localhost:Chưa khởi động'}
                  </span>
                  <span className="canvas__frame-size">
                    {currentVp.w} × {currentVp.h}
                  </span>
                </div>
              ) : null}

              <div
                key="canvas-frame-content"
                className={
                  viewport === 'responsive'
                    ? 'canvas__frame-content canvas__frame-content--responsive'
                    : 'canvas__frame-content'
                }
                style={{
                  width: viewport === 'responsive' ? '100%' : undefined,
                  height: viewport === 'responsive' ? '100%' : currentVp.h,
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onDragOver={(e) => {
                  if (toolboxDrag.current()) {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'copy'
                  }
                }}
              >
                {renderFrameContent()}
              </div>
            </div>
          </div>

          {/* Lớp xem ảnh mẫu phủ kín stage nhưng KHÔNG unmount iframe Live bên dưới. */}
          {effectiveShowReference && referenceAsset && renderReferenceView()}

          {isInspectMode && multiSelection.length >= 2 && (
            <div
              style={{
                position: 'absolute',
                top: 12,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 100,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '6px 10px',
                borderRadius: 10,
                background: 'rgba(15, 23, 42, 0.94)',
                border: '1px solid #6d5df5',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                backdropFilter: 'blur(8px)',
                color: '#e2e8f0',
                fontSize: 11.5,
                whiteSpace: 'nowrap',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#c4b5fd' }}>
                <Layers size={13} />
                Đang chọn {multiSelection.length} phần tử
              </span>
              <span style={{ width: 1, height: 16, background: 'rgba(148,163,184,0.35)' }} />

              {/* ── CĂN LỀ NGANG ── */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: 2 }}>
                <button
                  className="pm-ibtn"
                  style={{ width: 22, height: 22 }}
                  onClick={() => handleAlignSelection('left')}
                  title="Căn lề trái các phần tử đang chọn"
                >
                  <AlignLeft size={12} />
                </button>
                <button
                  className="pm-ibtn"
                  style={{ width: 22, height: 22 }}
                  onClick={() => handleAlignSelection('center')}
                  title="Căn giữa ngang các phần tử đang chọn"
                >
                  <AlignCenter size={12} />
                </button>
                <button
                  className="pm-ibtn"
                  style={{ width: 22, height: 22 }}
                  onClick={() => handleAlignSelection('right')}
                  title="Căn lề phải các phần tử đang chọn"
                >
                  <AlignRight size={12} />
                </button>
              </div>

              {/* ── CĂN LỀ DỌC ── */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: 2 }}>
                <button
                  className="pm-ibtn"
                  style={{ width: 22, height: 22 }}
                  onClick={() => handleAlignSelection('top')}
                  title="Căn lề trên các phần tử đang chọn"
                >
                  <AlignStartVertical size={12} />
                </button>
                <button
                  className="pm-ibtn"
                  style={{ width: 22, height: 22 }}
                  onClick={() => handleAlignSelection('middle')}
                  title="Căn giữa dọc các phần tử đang chọn"
                >
                  <AlignCenterVertical size={12} />
                </button>
                <button
                  className="pm-ibtn"
                  style={{ width: 22, height: 22 }}
                  onClick={() => handleAlignSelection('bottom')}
                  title="Căn lề dưới các phần tử đang chọn"
                >
                  <AlignEndVertical size={12} />
                </button>
              </div>

              {/* ── PHÂN BỔ KHOẢNG CÁCH ĐỀU ── */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: 2 }}>
                <button
                  className="pm-ibtn"
                  style={{ width: 22, height: 22 }}
                  onClick={() => handleDistributeSelection('horizontal')}
                  title="Phân bổ khoảng cách ngang đều nhau (tối thiểu 3 phần tử)"
                >
                  <AlignHorizontalDistributeCenter size={12} />
                </button>
                <button
                  className="pm-ibtn"
                  style={{ width: 22, height: 22 }}
                  onClick={() => handleDistributeSelection('vertical')}
                  title="Phân bổ khoảng cách dọc đều nhau (tối thiểu 3 phần tử)"
                >
                  <AlignVerticalDistributeCenter size={12} />
                </button>
              </div>

              <span style={{ width: 1, height: 16, background: 'rgba(148,163,184,0.35)' }} />

              {multiSelection.length <= 1 && (
                <button
                  className="btn secondary"
                  style={{ height: 24, fontSize: 11, padding: '0 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  onClick={() => void beginToolboxDuplicate()}
                  title="Nhân bản phần tử (Ctrl+D)"
                >
                  <Copy size={11} /> Nhân bản
                </button>
              )}

              <button
                className="btn secondary"
                style={{ height: 24, fontSize: 11, padding: '0 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                onClick={copySelection}
                title="Sao chép phần tử đang chọn (Ctrl+C)"
              >
                <Copy size={11} /> Sao chép
              </button>
              <button
                className="btn secondary"
                style={{ height: 24, fontSize: 11, padding: '0 8px' }}
                onClick={() => void pasteSelection()}
                title="Dán phần tử vào trang hiện tại (Ctrl+V)"
              >
                Dán
              </button>
              <button
                className="btn secondary canvas__attrs-danger"
                style={{ height: 24, fontSize: 11, padding: '0 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                onClick={() => void beginDeleteSelection()}
                title="Xoá phần tử đang chọn (Delete) — có thể hoàn tác bằng Ctrl+Z"
              >
                <Trash2 size={11} /> Xoá
              </button>
              <button
                className="canvas__tool-btn"
                style={{ width: 24, height: 24 }}
                title="Bỏ chọn (Esc)"
                onClick={() => {
                  setMultiSelection([])
                  setSelectedEl(null)
                  iframeRef.current?.contentWindow?.postMessage({ type: 'PM_CLEAR_MULTI_SELECTION' }, '*')
                }}
              >
                <X size={12} />
              </button>
            </div>
          )}

          <div className="canvas__hint">
            <span>▷ Soi phần tử (I) · Kéo vùng để chọn nhiều · Shift + Click để cộng/trừ · Ctrl+C / Ctrl+V sao chép-dán · F vừa khung</span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════
            INSPECTOR SIDE PANEL CỐ ĐỊNH Ở CẠNH PHẢI (CHỈ XUẤT HIỆN KHI BẬT SOI)
            ═══════════════════════════════════════════════ */}
        {isInspectMode && (
          <aside
            className="canvas__inspector-sidebar"
            style={{ width: inspectorWidth, position: 'relative' }}
            onWheel={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Thanh kéo co giãn độ rộng Side Panel */}
            <div
              className={`canvas__inspector-resizer ${isResizingSidebar ? 'is-resizing' : ''}`}
              onMouseDown={handleSidebarResizeStart}
              title="Kéo sang trái/phải để co giãn độ rộng bảng Soi"
            />

            {/* Header đỉnh của Side Panel */}
            <div className="canvas__inspector-hd">
              <div className="canvas__inspector-title-area">
                <div className="canvas__inspector-eyebrow">
                  <div className="canvas__inspector-badge-live">
                    <span className="pulse-dot" />
                    <span>Live DOM</span>
                  </div>
                  <span className="canvas__inspector-eyebrow-text">Visual Style Editor</span>
                </div>
                <div className="canvas__inspector-tag-title">
                  {selectedEl ? (
                    <>
                      <span>{selectedEl.tagName.toUpperCase()}</span>
                      {selectedEl.id && <code>#{selectedEl.id}</code>}
                      {multiSelection.length > 1 && (
                        <span
                          style={{
                            marginLeft: 6,
                            padding: '1px 7px',
                            borderRadius: 999,
                            background: 'rgba(109,93,245,0.18)',
                            border: '1px solid rgba(109,93,245,0.45)',
                            color: '#c4b5fd',
                            fontSize: 10.5,
                            fontWeight: 700,
                          }}
                        >
                          +{multiSelection.length - 1}
                        </span>
                      )}
                    </>
                  ) : (
                    <span>Chế độ Soi phần tử</span>
                  )}
                </div>
              </div>

              {selectedEl && (
                <>
                  <button
                    className="canvas__tool-btn"
                    title="Sao chép CSS Selector"
                    onClick={handleCopySelector}
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    className="canvas__tool-btn"
                    title="Nhân bản phần tử (Ctrl+D)"
                    onClick={() => void beginToolboxDuplicate()}
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    className="canvas__tool-btn canvas__tool-btn--danger"
                    title={
                      multiSelection.length > 1
                        ? `Xoá ${multiSelection.length} phần tử đang chọn (Delete) — hoàn tác bằng Ctrl+Z`
                        : 'Xoá phần tử (Delete) — hoàn tác bằng Ctrl+Z'
                    }
                    onClick={() => void beginDeleteSelection()}
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}

              <button
                className="canvas__tool-btn"
                title="Tắt chế độ Soi phần tử (Esc hoặc I)"
                onClick={() => {
                  setIsInspectMode(false)
                  setSelectedEl(null)
                  setHoverEl(null)
                  setMultiSelection([])
                  iframeRef.current?.contentWindow?.postMessage({ type: 'PM_CLEAR_MULTI_SELECTION' }, '*')
                  showToast('Đã tắt chế độ Soi phần tử', 'info')
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* TAB BAR: CHUYỂN ĐỔI THIẾT KẾ & ĐỒNG BỘ MÃ NGUỒN THẬT */}
            <div className="canvas__inspector-tabs">
              <button
                className={`canvas__inspector-tab-btn ${inspectorTab === 'design' ? 'active' : ''}`}
                onClick={() => setInspectorTab('design')}
              >
                <Sliders size={12} />
                <span>Thiết kế & Kiểu dáng</span>
              </button>
              <button
                className={`canvas__inspector-tab-btn ${inspectorTab === 'code' ? 'active' : ''}`}
                onClick={() => setInspectorTab('code')}
              >
                <Code2 size={12} />
                <span>Mã nguồn thật {modifiedCount > 0 ? `(${modifiedCount})` : sourceLoc ? '●' : ''}</span>
              </button>
              <button
                className={`canvas__inspector-tab-btn ${inspectorTab === 'attrs' ? 'active' : ''}`}
                onClick={() => setInspectorTab('attrs')}
              >
                <SlidersHorizontal size={12} />
                <span>Thuộc tính</span>
              </button>
            </div>

            {selectedEl ? (
              <>
                <div
                  className="canvas__inspector-bd"
                  onWheel={(e) => e.stopPropagation()}
                >
                  {inspectorTab === 'design' ? (
                    <>
                      {/* Hero Card thông tin phần tử */}
                      <div className="canvas__inspector-hero">
                        <div className="canvas__inspector-hero-top">
                          <span className="canvas__inspector-hero-tag">
                            <Code2 size={15} style={{ color: 'var(--accent, #6d5df5)' }} />
                            &lt;{selectedEl.tagName}&gt;
                          </span>
                          <span style={{ fontSize: 11, color: '#a78bfa', fontFamily: 'monospace' }}>
                            {selectedEl.computedStyles.width} × {selectedEl.computedStyles.height}
                          </span>
                          <button
                            type="button"
                            className="pm-ibtn"
                            style={{
                              marginLeft: 'auto',
                              height: 22,
                              fontSize: 11,
                              padding: '0 7px',
                              width: 'auto',
                              gap: 4,
                              display: 'inline-flex',
                              background: 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(168,85,247,0.25) 100%)',
                              border: '1px solid rgba(168,85,247,0.4)',
                              borderRadius: 4,
                              color: '#c4b5fd',
                              fontWeight: 600,
                            }}
                            onClick={() => setIsSidecarOpen((open) => !open)}
                            title="Mở AI Sidecar cho phần tử này (Ctrl+K hoặc Shift+A)"
                          >
                            <Sparkles size={11} style={{ color: '#fde047' }} />
                            <span>AI Sửa</span>
                          </button>
                        </div>

                        {/* Phân cấp DOM Path */}
                        <div style={{ fontSize: 11, color: '#94a3b8', wordBreak: 'break-all', lineHeight: 1.4 }}>
                          <span style={{ color: '#64748b', marginRight: 4 }}>Path:</span>
                          {selectedEl.domPath || selectedEl.tagName}
                        </div>

                        {/* Đường dẫn tệp mã nguồn */}
                        <div style={{ fontSize: 11, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 5, lineHeight: 1.4, wordBreak: 'break-all' }}>
                          <span style={{ color: '#64748b' }}>Source:</span>
                          {isLocatingSource ? (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Đang dò tệp mã nguồn...</span>
                          ) : sourceLoc ? (
                            <span
                              title={`${sourceLoc.fullPath} (Bấm để xem diff & mã nguồn)`}
                              style={{ fontFamily: 'monospace', color: '#38bdf8', cursor: 'pointer', textDecoration: 'underline' }}
                              onClick={() => setInspectorTab('code')}
                            >
                              {sourceLoc.filePath}:{sourceLoc.lineNumber}
                            </span>
                          ) : (
                            <span style={{ color: '#64748b', fontStyle: 'italic' }}>Chưa xác định</span>
                          )}
                        </div>

                        {/* Class badges */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                          <span style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600 }}>
                            CLASSES ({selectedEl.className ? selectedEl.className.split(/\s+/).filter(Boolean).length : 0}):
                          </span>
                          {selectedEl.className && (
                            <button
                              className="canvas__tool-btn"
                              style={{ width: 18, height: 18, padding: 0 }}
                              title="Sao chép toàn bộ classes"
                              onClick={handleCopyClasses}
                            >
                              <Copy size={10} />
                            </button>
                          )}
                        </div>

                        {selectedEl.className ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {selectedEl.className.split(/\s+/).filter(Boolean).map((cls, idx) => (
                              <span
                                key={idx}
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  background: 'rgba(255, 255, 255, 0.06)',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  fontSize: 10.5,
                                  color: '#cbd5e1',
                                  fontFamily: 'monospace',
                                }}
                              >
                                .{cls}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: 10.5, color: '#64748b', fontStyle: 'italic' }}>
                            Không có class CSS riêng
                          </span>
                        )}
                      </div>

                      {/* 1. NỘI DUNG VĂN BẢN TRỰC TIẾP */}
                      {selectedEl.isLeaf || !selectedEl.childrenCount ? (
                        <div className="canvas__inspector-card">
                          <div className="canvas__inspector-card-hd">
                            <Type size={13} style={{ color: '#38bdf8' }} />
                            <span>Nội dung chữ (Text Content)</span>
                          </div>
                          <div className="canvas__inspector-field">
                            <input
                              type="text"
                              className="canvas__inspector-field-input"
                              value={selectedEl.textSnippet}
                              onFocus={() => {
                                initialTextRef.current = selectedEl.textSnippet
                              }}
                              onChange={(e) => handleApplyLiveChange(undefined, e.target.value, { skipHistory: true })}
                              onBlur={() => {
                                if (selectedEl.textSnippet !== initialTextRef.current) {
                                  editorBuffer.pushAction({
                                    type: 'TEXT',
                                    description: `Sửa chữ: "${selectedEl.textSnippet.slice(0, 20)}..."`,
                                    target: {
                                      tagName: selectedEl.tagName,
                                      id: selectedEl.id,
                                      className: selectedEl.className,
                                      domPath: selectedEl.domPath,
                                      uid: selectedEl.uid,
                                      selector: selectedEl.selector,
                                      textSnippet: selectedEl.textSnippet,
                                    },
                                    sourceLoc: sourceLoc
                                      ? {
                                        filePath: sourceLoc.filePath,
                                        fullPath: sourceLoc.fullPath,
                                        lineNumber: sourceLoc.lineNumber,
                                      }
                                      : undefined,
                                    before: {
                                      styles: { ...selectedEl.computedStyles },
                                      text: initialTextRef.current,
                                      rect: { ...selectedEl.rect },
                                    },
                                    after: {
                                      styles: { ...selectedEl.computedStyles },
                                      text: selectedEl.textSnippet,
                                      rect: { ...selectedEl.rect },
                                    },
                                  })
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLElement).blur()
                              }}
                              placeholder="Nhập nội dung chữ để đổi trực tiếp..."
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="canvas__inspector-card" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                          <div className="canvas__inspector-card-hd">
                            <Layers size={13} style={{ color: '#94a3b8' }} />
                            <span>Khối bao bọc ({selectedEl.childrenCount} phần tử con)</span>
                          </div>
                          <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, lineHeight: 1.45 }}>
                            Đây là thẻ cha (Container chứa nhiều thẻ con như chữ, nút bấm, ảnh). Hãy nhấp chuột vào phần tử con cụ thể để chỉnh sửa chữ.
                          </p>
                        </div>
                      )}

                      {/* 2. BỐ CỤC (LAYOUT: FLEXBOX / GRID / BLOCK) */}
                      <div className="canvas__inspector-card">
                        <div className="canvas__inspector-card-hd">
                          <Layers size={13} style={{ color: '#a78bfa' }} />
                          <span>Bố cục (Display Layout)</span>
                        </div>

                        <div className="canvas__btn-group">
                          {['block', 'flex', 'grid', 'inline-block', 'inline'].map((d) => (
                            <button
                              key={d}
                              className={`canvas__btn-group-item ${selectedEl.computedStyles.display === d ? 'active' : ''}`}
                              onClick={() => handleApplyLiveChange({ display: d })}
                            >
                              {d}
                            </button>
                          ))}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                            {/* Ma trận căn chỉnh 3×3: Align Items × Justify Content — luôn hiển thị */}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span className="canvas__inspector-field-lbl">Căn chỉnh 3×3 (Align × Justify)</span>
                                <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#38bdf8' }}>
                                  {isFlexLayout || isGridLayout
                                    ? `${matrixAlign} / ${matrixJustify}`
                                    : `display: ${selectedEl.computedStyles.display || 'block'}`}
                                </span>
                              </div>
                              <div className="canvas__align-matrix">
                                {ALIGN_MATRIX_VALUES.map((alignValue) =>
                                  ALIGN_MATRIX_VALUES.map((justifyValue) => {
                                    const active =
                                      (isFlexLayout || isGridLayout) &&
                                      matrixAlign === alignValue &&
                                      matrixJustify === justifyValue
                                    const row = alignValue === 'flex-start' ? 'flex-start' : alignValue === 'flex-end' ? 'flex-end' : 'center'
                                    const column = justifyValue === 'flex-start' ? 'flex-start' : justifyValue === 'flex-end' ? 'flex-end' : 'center'
                                    return (
                                      <button
                                        key={`${alignValue}-${justifyValue}`}
                                        type="button"
                                        className={`canvas__align-matrix-cell ${active ? 'active' : ''}`}
                                        title={`align-items: ${alignValue} · justify-content: ${justifyValue}`}
                                        aria-label={`Căn ${alignValue} theo trục phụ, ${justifyValue} theo trục chính`}
                                        onClick={() => {
                                          const styles: Record<string, string> = {
                                            alignItems: alignValue,
                                            justifyContent: justifyValue,
                                          }
                                          // Nếu phần tử chưa phải flex/grid, tự bật flex để ma trận có tác dụng.
                                          if (!isFlexLayout && !isGridLayout) styles.display = 'flex'
                                          handleApplyLiveChange(styles, undefined, {
                                            description: `Căn chỉnh ${alignValue} / ${justifyValue}`,
                                            actionType: 'STYLE',
                                          })
                                        }}
                                      >
                                        <span className="canvas__align-matrix-box" style={{ alignItems: row, justifyContent: column }}>
                                          <span className="canvas__align-matrix-dot" />
                                        </span>
                                      </button>
                                    )
                                  })
                                )}
                              </div>
                              <div className="canvas__align-matrix-caption">
                                Hàng: align-items · Cột: justify-content
                              </div>
                              {!(isFlexLayout || isGridLayout) && (
                                <div className="canvas__align-matrix-hint">
                                  Phần tử đang là <b>{selectedEl.computedStyles.display || 'block'}</b>. Bấm một ô
                                  bất kỳ để tự chuyển sang <b>flex</b> và căn chỉnh các phần tử con.
                                </div>
                              )}
                            </div>

                            {(isFlexLayout || isGridLayout) && (
                              <>
                            {/* Align Items — giá trị mở rộng */}
                            <div>
                              <span className="canvas__inspector-field-lbl">Căn trục phụ (Align Items)</span>
                              <div className="canvas__btn-group">
                                {[
                                  { label: 'Đầu', val: 'flex-start' },
                                  { label: 'Giữa', val: 'center' },
                                  { label: 'Cuối', val: 'flex-end' },
                                  { label: 'Giãn', val: 'stretch' },
                                  { label: 'Baseline', val: 'baseline' },
                                ].map((item) => (
                                  <button
                                    key={item.val}
                                    className={`canvas__btn-group-item ${selectedEl.computedStyles.alignItems === item.val ? 'active' : ''}`}
                                    onClick={() => handleApplyLiveChange({ alignItems: item.val })}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Justify Content — giá trị mở rộng */}
                            <div>
                              <span className="canvas__inspector-field-lbl">Căn trục chính (Justify Content)</span>
                              <div className="canvas__btn-group">
                                {[
                                  { label: 'Đầu', val: 'flex-start' },
                                  { label: 'Giữa', val: 'center' },
                                  { label: 'Cuối', val: 'flex-end' },
                                  { label: 'Space between', val: 'space-between' },
                                  { label: 'Space around', val: 'space-around' },
                                  { label: 'Space evenly', val: 'space-evenly' },
                                ].map((item) => (
                                  <button
                                    key={item.val}
                                    className={`canvas__btn-group-item ${selectedEl.computedStyles.justifyContent === item.val ? 'active' : ''}`}
                                    onClick={() => handleApplyLiveChange({ justifyContent: item.val })}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Gap */}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span className="canvas__inspector-field-lbl">Khoảng cách giữa các phần tử (Gap)</span>
                                <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#38bdf8' }}>
                                  {selectedEl.computedStyles.gap || '0px'}
                                </span>
                              </div>
                              <div className="canvas__slider-row">
                                <input
                                  type="range"
                                  min="0"
                                  max="48"
                                  value={parseInt(selectedEl.computedStyles.gap) || 0}
                                  onChange={(e) => handleApplyLiveChange({ gap: `${e.target.value}px` })}
                                />
                                <span className="canvas__slider-val">{selectedEl.computedStyles.gap || '0px'}</span>
                              </div>
                            </div>

                            {/* Flex Direction */}
                            {isFlexLayout && (
                              <div>
                                <span className="canvas__inspector-field-lbl">Hướng sắp xếp (Direction)</span>
                                <div className="canvas__btn-group">
                                  {[
                                    { label: 'Ngang ➔', val: 'row', icon: ArrowRight },
                                    { label: 'Dọc ⬇', val: 'column', icon: ArrowDown },
                                    { label: 'Đảo ⬅', val: 'row-reverse', icon: ArrowLeft },
                                    { label: 'Đảo ⬆', val: 'column-reverse', icon: ArrowUp },
                                  ].map((item) => (
                                    <button
                                      key={item.val}
                                      className={`canvas__btn-group-item ${selectedEl.computedStyles.flexDirection === item.val ? 'active' : ''}`}
                                      onClick={() => handleApplyLiveChange({ flexDirection: item.val })}
                                    >
                                      {item.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Flex Wrap */}
                            {isFlexLayout && (
                              <div>
                                <span className="canvas__inspector-field-lbl">Xuống dòng (Flex Wrap)</span>
                                <div className="canvas__btn-group">
                                  {[
                                    { label: 'Không (nowrap)', val: 'nowrap' },
                                    { label: 'Tự xuống dòng (wrap)', val: 'wrap' },
                                    { label: 'Đảo (wrap-reverse)', val: 'wrap-reverse' },
                                  ].map((item) => (
                                    <button
                                      key={item.val}
                                      className={`canvas__btn-group-item ${selectedEl.computedStyles.flexWrap === item.val ? 'active' : ''}`}
                                      onClick={() => handleApplyLiveChange({ flexWrap: item.val })}
                                    >
                                      {item.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Grid visual editor — chỉ hiện khi display: grid */}
                            {isGridLayout && (
                              <div className="canvas__grid-editor">
                                <div className="canvas__grid-editor-hd">
                                  <span>Trình chỉnh Grid</span>
                                  <span className="canvas__grid-editor-size">
                                    {gridColCount} × {gridRowCount}
                                  </span>
                                </div>

                                <div
                                  className="canvas__grid-preview"
                                  style={{
                                    gridTemplateColumns: `repeat(${Math.min(gridColCount, GRID_MAX_TRACKS)}, 1fr)`,
                                    gridTemplateRows: `repeat(${Math.min(gridRowCount, GRID_MAX_TRACKS)}, 1fr)`,
                                  }}
                                >
                                  {Array.from({ length: gridColCount * gridRowCount }).map((_, index) => (
                                    <span key={index} className="canvas__grid-preview-cell" />
                                  ))}
                                </div>

                                <div className="canvas__grid-steppers">
                                  <div className="canvas__grid-stepper">
                                    <span>Cột</span>
                                    <button
                                      type="button"
                                      onClick={() => setGridTracks('columns', gridColCount - 1)}
                                      disabled={gridColCount <= 1}
                                      aria-label="Giảm số cột"
                                    >
                                      −
                                    </button>
                                    <b>{gridColCount}</b>
                                    <button
                                      type="button"
                                      onClick={() => setGridTracks('columns', gridColCount + 1)}
                                      disabled={gridColCount >= GRID_MAX_TRACKS}
                                      aria-label="Tăng số cột"
                                    >
                                      +
                                    </button>
                                  </div>
                                  <div className="canvas__grid-stepper">
                                    <span>Hàng</span>
                                    <button
                                      type="button"
                                      onClick={() => setGridTracks('rows', gridRowCount - 1)}
                                      disabled={gridRowCount <= 1}
                                      aria-label="Giảm số hàng"
                                    >
                                      −
                                    </button>
                                    <b>{gridRowCount}</b>
                                    <button
                                      type="button"
                                      onClick={() => setGridTracks('rows', gridRowCount + 1)}
                                      disabled={gridRowCount >= GRID_MAX_TRACKS}
                                      aria-label="Tăng số hàng"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>

                                <GridTrackInput
                                  label="grid-template-columns"
                                  value={displayGridTracks(selectedEl.computedStyles.gridTemplateColumns, gridColCount)}
                                  onApply={(value) =>
                                    handleApplyLiveChange(
                                      { gridTemplateColumns: value },
                                      undefined,
                                      { description: `grid-template-columns: ${value}`, actionType: 'STYLE' }
                                    )
                                  }
                                />
                                <GridTrackInput
                                  label="grid-template-rows"
                                  value={displayGridTracks(selectedEl.computedStyles.gridTemplateRows, gridRowCount)}
                                  onApply={(value) =>
                                    handleApplyLiveChange(
                                      { gridTemplateRows: value },
                                      undefined,
                                      { description: `grid-template-rows: ${value}`, actionType: 'STYLE' }
                                    )
                                  }
                                />
                              </div>
                            )}
                              </>
                            )}
                          </div>
                      </div>

                      {/* 3. KHOẢNG CÁCH TRỰC QUAN WEBFLOW & DEVTOOLS BOX MODEL */}
                      <div className="canvas__inspector-card">
                        <div className="canvas__inspector-card-hd">
                          <Box size={13} style={{ color: '#f59e0b' }} />
                          <span>Khoảng cách Box Model (Margin & Padding)</span>
                        </div>

                        {/* Sơ đồ lồng hộp tương tác trực tiếp 8 cạnh */}
                        <div className="canvas__box-model">
                          <div className="canvas__box-model-margin">
                            <span className="canvas__box-model-label" style={{ color: '#f59e0b' }}>Margin</span>
                            {/* Margin Top */}
                            <input
                              type="text"
                              className="canvas__box-model-input canvas__box-model-pos-top"
                              title="Lề trên (Margin Top)"
                              value={selectedEl.computedStyles.marginTop || '0px'}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/px/g, '').trim()
                                const val = raw === 'auto' ? 'auto' : `${parseInt(raw) || 0}px`
                                handleApplyLiveChange({ marginTop: val }, undefined, { description: `Margin Top: ${val}`, actionType: 'STYLE' })
                              }}
                            />
                            {/* Margin Bottom */}
                            <input
                              type="text"
                              className="canvas__box-model-input canvas__box-model-pos-bottom"
                              title="Lề dưới (Margin Bottom)"
                              value={selectedEl.computedStyles.marginBottom || '0px'}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/px/g, '').trim()
                                const val = raw === 'auto' ? 'auto' : `${parseInt(raw) || 0}px`
                                handleApplyLiveChange({ marginBottom: val }, undefined, { description: `Margin Bottom: ${val}`, actionType: 'STYLE' })
                              }}
                            />
                            {/* Margin Left */}
                            <input
                              type="text"
                              className="canvas__box-model-input canvas__box-model-pos-left"
                              title="Lề trái (Margin Left)"
                              value={selectedEl.computedStyles.marginLeft || '0px'}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/px/g, '').trim()
                                const val = raw === 'auto' ? 'auto' : `${parseInt(raw) || 0}px`
                                handleApplyLiveChange({ marginLeft: val }, undefined, { description: `Margin Left: ${val}`, actionType: 'STYLE' })
                              }}
                            />
                            {/* Margin Right */}
                            <input
                              type="text"
                              className="canvas__box-model-input canvas__box-model-pos-right"
                              title="Lề phải (Margin Right)"
                              value={selectedEl.computedStyles.marginRight || '0px'}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/px/g, '').trim()
                                const val = raw === 'auto' ? 'auto' : `${parseInt(raw) || 0}px`
                                handleApplyLiveChange({ marginRight: val }, undefined, { description: `Margin Right: ${val}`, actionType: 'STYLE' })
                              }}
                            />

                            {/* Khối lồng Padding trong */}
                            <div className="canvas__box-model-padding">
                              <span className="canvas__box-model-label" style={{ color: '#10b981' }}>Padding</span>
                              {/* Padding Top */}
                              <input
                                type="text"
                                className="canvas__box-model-input canvas__box-model-pos-top"
                                title="Đệm trên (Padding Top)"
                                value={selectedEl.computedStyles.paddingTop || '0px'}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/px/g, '').trim()
                                  const val = `${parseInt(raw) || 0}px`
                                  handleApplyLiveChange({ paddingTop: val }, undefined, { description: `Padding Top: ${val}`, actionType: 'STYLE' })
                                }}
                              />
                              {/* Padding Bottom */}
                              <input
                                type="text"
                                className="canvas__box-model-input canvas__box-model-pos-bottom"
                                title="Đệm dưới (Padding Bottom)"
                                value={selectedEl.computedStyles.paddingBottom || '0px'}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/px/g, '').trim()
                                  const val = `${parseInt(raw) || 0}px`
                                  handleApplyLiveChange({ paddingBottom: val }, undefined, { description: `Padding Bottom: ${val}`, actionType: 'STYLE' })
                                }}
                              />
                              {/* Padding Left */}
                              <input
                                type="text"
                                className="canvas__box-model-input canvas__box-model-pos-left"
                                title="Đệm trái (Padding Left)"
                                value={selectedEl.computedStyles.paddingLeft || '0px'}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/px/g, '').trim()
                                  const val = `${parseInt(raw) || 0}px`
                                  handleApplyLiveChange({ paddingLeft: val }, undefined, { description: `Padding Left: ${val}`, actionType: 'STYLE' })
                                }}
                              />
                              {/* Padding Right */}
                              <input
                                type="text"
                                className="canvas__box-model-input canvas__box-model-pos-right"
                                title="Đệm phải (Padding Right)"
                                value={selectedEl.computedStyles.paddingRight || '0px'}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/px/g, '').trim()
                                  const val = `${parseInt(raw) || 0}px`
                                  handleApplyLiveChange({ paddingRight: val }, undefined, { description: `Padding Right: ${val}`, actionType: 'STYLE' })
                                }}
                              />

                              {/* Kích thước nội dung chính */}
                              <div className="canvas__box-model-center" title="Kích thước thực tế">
                                {selectedEl.computedStyles.width} × {selectedEl.computedStyles.height}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Bộ điều khiển chi tiết Lề ngoài (Margin) */}
                        <div className="canvas__spacing-group">
                          <div className="canvas__spacing-hd">
                            <span className="canvas__spacing-title" style={{ color: '#f59e0b' }}>
                              Lề ngoài (Margin)
                            </span>
                            <div className="canvas__spacing-actions">
                              <button
                                className="canvas__btn-group-item"
                                style={{ background: '#1c202d', borderRadius: 4, padding: '2px 6px', fontSize: 10 }}
                                title="Căn giữa nội dung ngang"
                                onClick={() => handleApplyLiveChange({ marginLeft: 'auto', marginRight: 'auto' }, undefined, { description: 'Margin: Auto Giữa', actionType: 'STYLE' })}
                              >
                                Auto
                              </button>
                              <button
                                className="canvas__btn-group-item"
                                style={{ background: '#1c202d', borderRadius: 4, padding: '2px 6px', fontSize: 10 }}
                                onClick={() => handleApplyLiveChange({ marginTop: '0px', marginRight: '0px', marginBottom: '0px', marginLeft: '0px' }, undefined, { description: 'Xóa Margin', actionType: 'STYLE' })}
                              >
                                0px
                              </button>
                              <button
                                className="canvas__btn-group-item"
                                style={{ background: '#1c202d', borderRadius: 4, padding: '2px 6px', fontSize: 10 }}
                                onClick={() => handleApplyLiveChange({ marginTop: '16px', marginRight: '16px', marginBottom: '16px', marginLeft: '16px' }, undefined, { description: 'Margin: 16px', actionType: 'STYLE' })}
                              >
                                16px
                              </button>
                            </div>
                          </div>
                          <div className="canvas__spacing-value" title={selectedEl.computedStyles.margin}>
                            {selectedEl.computedStyles.margin}
                          </div>

                          <div className="canvas__box-model-4col">
                            {/* Margin Top */}
                            <div className="canvas__inspector-prop-card" style={{ padding: '4px 6px' }}>
                              <span className="canvas__inspector-prop-lbl">Trên (T)</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <button
                                  className="canvas__tool-btn"
                                  style={{ width: 18, height: 18, fontSize: 11 }}
                                  onClick={() => {
                                    const cur = parseInt(selectedEl.computedStyles.marginTop) || 0
                                    const next = Math.max(0, cur - 2)
                                    handleApplyLiveChange({ marginTop: `${next}px` }, undefined, { description: `Margin Top: ${next}px`, actionType: 'STYLE' })
                                  }}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  className="canvas__inspector-field-input"
                                  style={{ padding: '0 2px', height: 20, textAlign: 'center', fontFamily: 'monospace', fontSize: 10 }}
                                  value={parseInt(selectedEl.computedStyles.marginTop) || 0}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0
                                    handleApplyLiveChange({ marginTop: `${val}px` }, undefined, { description: `Margin Top: ${val}px`, actionType: 'STYLE' })
                                  }}
                                />
                                <button
                                  className="canvas__tool-btn"
                                  style={{ width: 18, height: 18, fontSize: 11 }}
                                  onClick={() => {
                                    const cur = parseInt(selectedEl.computedStyles.marginTop) || 0
                                    const next = cur + 2
                                    handleApplyLiveChange({ marginTop: `${next}px` }, undefined, { description: `Margin Top: ${next}px`, actionType: 'STYLE' })
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Margin Right */}
                            <div className="canvas__inspector-prop-card" style={{ padding: '4px 6px' }}>
                              <span className="canvas__inspector-prop-lbl">Phải (R)</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <button
                                  className="canvas__tool-btn"
                                  style={{ width: 18, height: 18, fontSize: 11 }}
                                  onClick={() => {
                                    const cur = parseInt(selectedEl.computedStyles.marginRight) || 0
                                    const next = Math.max(0, cur - 2)
                                    handleApplyLiveChange({ marginRight: `${next}px` }, undefined, { description: `Margin Right: ${next}px`, actionType: 'STYLE' })
                                  }}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  className="canvas__inspector-field-input"
                                  style={{ padding: '0 2px', height: 20, textAlign: 'center', fontFamily: 'monospace', fontSize: 10 }}
                                  value={parseInt(selectedEl.computedStyles.marginRight) || 0}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0
                                    handleApplyLiveChange({ marginRight: `${val}px` }, undefined, { description: `Margin Right: ${val}px`, actionType: 'STYLE' })
                                  }}
                                />
                                <button
                                  className="canvas__tool-btn"
                                  style={{ width: 18, height: 18, fontSize: 11 }}
                                  onClick={() => {
                                    const cur = parseInt(selectedEl.computedStyles.marginRight) || 0
                                    const next = cur + 2
                                    handleApplyLiveChange({ marginRight: `${next}px` }, undefined, { description: `Margin Right: ${next}px`, actionType: 'STYLE' })
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Margin Bottom */}
                            <div className="canvas__inspector-prop-card" style={{ padding: '4px 6px' }}>
                              <span className="canvas__inspector-prop-lbl">Dưới (B)</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <button
                                  className="canvas__tool-btn"
                                  style={{ width: 18, height: 18, fontSize: 11 }}
                                  onClick={() => {
                                    const cur = parseInt(selectedEl.computedStyles.marginBottom) || 0
                                    const next = Math.max(0, cur - 2)
                                    handleApplyLiveChange({ marginBottom: `${next}px` }, undefined, { description: `Margin Bottom: ${next}px`, actionType: 'STYLE' })
                                  }}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  className="canvas__inspector-field-input"
                                  style={{ padding: '0 2px', height: 20, textAlign: 'center', fontFamily: 'monospace', fontSize: 10 }}
                                  value={parseInt(selectedEl.computedStyles.marginBottom) || 0}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0
                                    handleApplyLiveChange({ marginBottom: `${val}px` }, undefined, { description: `Margin Bottom: ${val}px`, actionType: 'STYLE' })
                                  }}
                                />
                                <button
                                  className="canvas__tool-btn"
                                  style={{ width: 18, height: 18, fontSize: 11 }}
                                  onClick={() => {
                                    const cur = parseInt(selectedEl.computedStyles.marginBottom) || 0
                                    const next = cur + 2
                                    handleApplyLiveChange({ marginBottom: `${next}px` }, undefined, { description: `Margin Bottom: ${next}px`, actionType: 'STYLE' })
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Margin Left */}
                            <div className="canvas__inspector-prop-card" style={{ padding: '4px 6px' }}>
                              <span className="canvas__inspector-prop-lbl">Trái (L)</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <button
                                  className="canvas__tool-btn"
                                  style={{ width: 18, height: 18, fontSize: 11 }}
                                  onClick={() => {
                                    const cur = parseInt(selectedEl.computedStyles.marginLeft) || 0
                                    const next = Math.max(0, cur - 2)
                                    handleApplyLiveChange({ marginLeft: `${next}px` }, undefined, { description: `Margin Left: ${next}px`, actionType: 'STYLE' })
                                  }}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  className="canvas__inspector-field-input"
                                  style={{ padding: '0 2px', height: 20, textAlign: 'center', fontFamily: 'monospace', fontSize: 10 }}
                                  value={parseInt(selectedEl.computedStyles.marginLeft) || 0}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0
                                    handleApplyLiveChange({ marginLeft: `${val}px` }, undefined, { description: `Margin Left: ${val}px`, actionType: 'STYLE' })
                                  }}
                                />
                                <button
                                  className="canvas__tool-btn"
                                  style={{ width: 18, height: 18, fontSize: 11 }}
                                  onClick={() => {
                                    const cur = parseInt(selectedEl.computedStyles.marginLeft) || 0
                                    const next = cur + 2
                                    handleApplyLiveChange({ marginLeft: `${next}px` }, undefined, { description: `Margin Left: ${next}px`, actionType: 'STYLE' })
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Bộ điều khiển chi tiết Đệm trong (Padding) */}
                        <div className="canvas__spacing-group">
                          <div className="canvas__spacing-hd">
                            <span className="canvas__spacing-title" style={{ color: '#10b981' }}>
                              Đệm trong (Padding)
                            </span>
                            <div className="canvas__spacing-actions">
                              <button
                                className="canvas__btn-group-item"
                                style={{ background: '#1c202d', borderRadius: 4, padding: '2px 6px', fontSize: 10 }}
                                title="Đệm tiêu chuẩn cho nút bấm"
                                onClick={() => handleApplyLiveChange({ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '16px', paddingRight: '16px' }, undefined, { description: 'Padding: Nút (8x16)', actionType: 'STYLE' })}
                              >
                                Nút
                              </button>
                              <button
                                className="canvas__btn-group-item"
                                style={{ background: '#1c202d', borderRadius: 4, padding: '2px 6px', fontSize: 10 }}
                                title="Đệm tiêu chuẩn cho Thẻ Card"
                                onClick={() => handleApplyLiveChange({ paddingTop: '16px', paddingBottom: '16px', paddingLeft: '24px', paddingRight: '24px' }, undefined, { description: 'Padding: Card (16x24)', actionType: 'STYLE' })}
                              >
                                Card
                              </button>
                              <button
                                className="canvas__btn-group-item"
                                style={{ background: '#1c202d', borderRadius: 4, padding: '2px 6px', fontSize: 10 }}
                                onClick={() => handleApplyLiveChange({ paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px' }, undefined, { description: 'Xóa Padding', actionType: 'STYLE' })}
                              >
                                0px
                              </button>
                            </div>
                          </div>
                          <div className="canvas__spacing-value" title={selectedEl.computedStyles.padding}>
                            {selectedEl.computedStyles.padding}
                          </div>

                          <div className="canvas__box-model-4col">
                            {/* Padding Top */}
                            <div className="canvas__inspector-prop-card" style={{ padding: '4px 6px' }}>
                              <span className="canvas__inspector-prop-lbl">Trên (T)</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <button
                                  className="canvas__tool-btn"
                                  style={{ width: 18, height: 18, fontSize: 11 }}
                                  onClick={() => {
                                    const cur = parseInt(selectedEl.computedStyles.paddingTop) || 0
                                    const next = Math.max(0, cur - 2)
                                    handleApplyLiveChange({ paddingTop: `${next}px` }, undefined, { description: `Padding Top: ${next}px`, actionType: 'STYLE' })
                                  }}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  className="canvas__inspector-field-input"
                                  style={{ padding: '0 2px', height: 20, textAlign: 'center', fontFamily: 'monospace', fontSize: 10 }}
                                  value={parseInt(selectedEl.computedStyles.paddingTop) || 0}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0
                                    handleApplyLiveChange({ paddingTop: `${val}px` }, undefined, { description: `Padding Top: ${val}px`, actionType: 'STYLE' })
                                  }}
                                />
                                <button
                                  className="canvas__tool-btn"
                                  style={{ width: 18, height: 18, fontSize: 11 }}
                                  onClick={() => {
                                    const cur = parseInt(selectedEl.computedStyles.paddingTop) || 0
                                    const next = cur + 2
                                    handleApplyLiveChange({ paddingTop: `${next}px` }, undefined, { description: `Padding Top: ${next}px`, actionType: 'STYLE' })
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Padding Right */}
                            <div className="canvas__inspector-prop-card" style={{ padding: '4px 6px' }}>
                              <span className="canvas__inspector-prop-lbl">Phải (R)</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <button
                                  className="canvas__tool-btn"
                                  style={{ width: 18, height: 18, fontSize: 11 }}
                                  onClick={() => {
                                    const cur = parseInt(selectedEl.computedStyles.paddingRight) || 0
                                    const next = Math.max(0, cur - 2)
                                    handleApplyLiveChange({ paddingRight: `${next}px` }, undefined, { description: `Padding Right: ${next}px`, actionType: 'STYLE' })
                                  }}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  className="canvas__inspector-field-input"
                                  style={{ padding: '0 2px', height: 20, textAlign: 'center', fontFamily: 'monospace', fontSize: 10 }}
                                  value={parseInt(selectedEl.computedStyles.paddingRight) || 0}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0
                                    handleApplyLiveChange({ paddingRight: `${val}px` }, undefined, { description: `Padding Right: ${val}px`, actionType: 'STYLE' })
                                  }}
                                />
                                <button
                                  className="canvas__tool-btn"
                                  style={{ width: 18, height: 18, fontSize: 11 }}
                                  onClick={() => {
                                    const cur = parseInt(selectedEl.computedStyles.paddingRight) || 0
                                    const next = cur + 2
                                    handleApplyLiveChange({ paddingRight: `${next}px` }, undefined, { description: `Padding Right: ${next}px`, actionType: 'STYLE' })
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Padding Bottom */}
                            <div className="canvas__inspector-prop-card" style={{ padding: '4px 6px' }}>
                              <span className="canvas__inspector-prop-lbl">Dưới (B)</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <button
                                  className="canvas__tool-btn"
                                  style={{ width: 18, height: 18, fontSize: 11 }}
                                  onClick={() => {
                                    const cur = parseInt(selectedEl.computedStyles.paddingBottom) || 0
                                    const next = Math.max(0, cur - 2)
                                    handleApplyLiveChange({ paddingBottom: `${next}px` }, undefined, { description: `Padding Bottom: ${next}px`, actionType: 'STYLE' })
                                  }}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  className="canvas__inspector-field-input"
                                  style={{ padding: '0 2px', height: 20, textAlign: 'center', fontFamily: 'monospace', fontSize: 10 }}
                                  value={parseInt(selectedEl.computedStyles.paddingBottom) || 0}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0
                                    handleApplyLiveChange({ paddingBottom: `${val}px` }, undefined, { description: `Padding Bottom: ${val}px`, actionType: 'STYLE' })
                                  }}
                                />
                                <button
                                  className="canvas__tool-btn"
                                  style={{ width: 18, height: 18, fontSize: 11 }}
                                  onClick={() => {
                                    const cur = parseInt(selectedEl.computedStyles.paddingBottom) || 0
                                    const next = cur + 2
                                    handleApplyLiveChange({ paddingBottom: `${next}px` }, undefined, { description: `Padding Bottom: ${next}px`, actionType: 'STYLE' })
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Padding Left */}
                            <div className="canvas__inspector-prop-card" style={{ padding: '4px 6px' }}>
                              <span className="canvas__inspector-prop-lbl">Trái (L)</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <button
                                  className="canvas__tool-btn"
                                  style={{ width: 18, height: 18, fontSize: 11 }}
                                  onClick={() => {
                                    const cur = parseInt(selectedEl.computedStyles.paddingLeft) || 0
                                    const next = Math.max(0, cur - 2)
                                    handleApplyLiveChange({ paddingLeft: `${next}px` }, undefined, { description: `Padding Left: ${next}px`, actionType: 'STYLE' })
                                  }}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  className="canvas__inspector-field-input"
                                  style={{ padding: '0 2px', height: 20, textAlign: 'center', fontFamily: 'monospace', fontSize: 10 }}
                                  value={parseInt(selectedEl.computedStyles.paddingLeft) || 0}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0
                                    handleApplyLiveChange({ paddingLeft: `${val}px` }, undefined, { description: `Padding Left: ${val}px`, actionType: 'STYLE' })
                                  }}
                                />
                                <button
                                  className="canvas__tool-btn"
                                  style={{ width: 18, height: 18, fontSize: 11 }}
                                  onClick={() => {
                                    const cur = parseInt(selectedEl.computedStyles.paddingLeft) || 0
                                    const next = cur + 2
                                    handleApplyLiveChange({ paddingLeft: `${next}px` }, undefined, { description: `Padding Left: ${next}px`, actionType: 'STYLE' })
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 4. VỊ TRÍ & KÍCH THƯỚC (WINFORMS LOCATION & SIZE) */}
                      <div className="canvas__inspector-card">
                        <div className="canvas__inspector-card-hd">
                          <Compass size={13} style={{ color: '#06b6d4' }} />
                          <span>Vị trí & Kích thước (Location & Size)</span>
                          {((parseInt(selectedEl.computedStyles.left || '0') !== 0) || (parseInt(selectedEl.computedStyles.top || '0') !== 0)) && (
                            <button
                              type="button"
                              onClick={handleResetElementPosition}
                              className="canvas__tool-btn"
                              style={{ marginLeft: 'auto', fontSize: 10.5, height: 20, padding: '0 6px', color: '#f59e0b', gap: 3 }}
                              title="Xóa tọa độ kéo lệch, đưa phần tử về đúng vị trí tự nhiên trong khung cha"
                            >
                              <RotateCcw size={10} />
                              <span>Reset vị trí</span>
                            </button>
                          )}
                        </div>

                        {/* Nhóm 1: Vị trí tọa độ (Location: X, Y) */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <span className="canvas__inspector-field-lbl" style={{ color: '#38bdf8', fontWeight: 600 }}>
                            Vị trí tọa độ (Location: X, Y)
                          </span>
                          <div className="canvas__inspector-grid">
                            {/* Tọa độ X (Left) */}
                            <div className="canvas__inspector-prop-card">
                              <span className="canvas__inspector-prop-lbl">Tọa độ X (Left)</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <button
                                  className="canvas__tool-btn"
                                  style={{ width: 22, height: 22 }}
                                  title="Giảm X (-5px)"
                                  onClick={() => {
                                    const curX = parseInt(selectedEl.computedStyles.left || '0') || 0
                                    const nextX = curX - 5
                                    const curPos = selectedEl.computedStyles.position
                                    const targetPos = curPos === 'absolute' || curPos === 'fixed' ? curPos : 'relative'
                                    handleApplyLiveChange(
                                      {
                                        position: targetPos,
                                        left: `${nextX}px`,
                                      },
                                      undefined,
                                      { description: `Dịch X: ${nextX}px`, actionType: 'MOVE' }
                                    )
                                  }}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  className="canvas__inspector-field-input"
                                  style={{ padding: '2px 6px', height: 24, textAlign: 'center', fontFamily: 'monospace' }}
                                  value={parseInt(selectedEl.computedStyles.left || '0') || 0}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0
                                    const curPos = selectedEl.computedStyles.position
                                    const targetPos = curPos === 'absolute' || curPos === 'fixed' ? curPos : 'relative'
                                    handleApplyLiveChange(
                                      {
                                        position: targetPos,
                                        left: `${val}px`,
                                      },
                                      undefined,
                                      { description: `Tọa độ X: ${val}px`, actionType: 'MOVE' }
                                    )
                                  }}
                                />
                                <button
                                  className="canvas__tool-btn"
                                  style={{ width: 22, height: 22 }}
                                  title="Tăng X (+5px)"
                                  onClick={() => {
                                    const curX = parseInt(selectedEl.computedStyles.left || '0') || 0
                                    const nextX = curX + 5
                                    const curPos = selectedEl.computedStyles.position
                                    const targetPos = curPos === 'absolute' || curPos === 'fixed' ? curPos : 'relative'
                                    handleApplyLiveChange(
                                      {
                                        position: targetPos,
                                        left: `${nextX}px`,
                                      },
                                      undefined,
                                      { description: `Dịch X: ${nextX}px`, actionType: 'MOVE' }
                                    )
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Tọa độ Y (Top) */}
                            <div className="canvas__inspector-prop-card">
                              <span className="canvas__inspector-prop-lbl">Tọa độ Y (Top)</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <button
                                  className="canvas__tool-btn"
                                  style={{ width: 22, height: 22 }}
                                  title="Giảm Y (-5px)"
                                  onClick={() => {
                                    const curY = parseInt(selectedEl.computedStyles.top || '0') || 0
                                    const nextY = curY - 5
                                    const curPos = selectedEl.computedStyles.position
                                    const targetPos = curPos === 'absolute' || curPos === 'fixed' ? curPos : 'relative'
                                    handleApplyLiveChange(
                                      {
                                        position: targetPos,
                                        top: `${nextY}px`,
                                      },
                                      undefined,
                                      { description: `Dịch Y: ${nextY}px`, actionType: 'MOVE' }
                                    )
                                  }}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  className="canvas__inspector-field-input"
                                  style={{ padding: '2px 6px', height: 24, textAlign: 'center', fontFamily: 'monospace' }}
                                  value={parseInt(selectedEl.computedStyles.top || '0') || 0}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0
                                    const curPos = selectedEl.computedStyles.position
                                    const targetPos = curPos === 'absolute' || curPos === 'fixed' ? curPos : 'relative'
                                    handleApplyLiveChange(
                                      {
                                        position: targetPos,
                                        top: `${val}px`,
                                      },
                                      undefined,
                                      { description: `Tọa độ Y: ${val}px`, actionType: 'MOVE' }
                                    )
                                  }}
                                />
                                <button
                                  className="canvas__tool-btn"
                                  style={{ width: 22, height: 22 }}
                                  title="Tăng Y (+5px)"
                                  onClick={() => {
                                    const curY = parseInt(selectedEl.computedStyles.top || '0') || 0
                                    const nextY = curY + 5
                                    const curPos = selectedEl.computedStyles.position
                                    const targetPos = curPos === 'absolute' || curPos === 'fixed' ? curPos : 'relative'
                                    handleApplyLiveChange(
                                      {
                                        position: targetPos,
                                        top: `${nextY}px`,
                                      },
                                      undefined,
                                      { description: `Dịch Y: ${nextY}px`, actionType: 'MOVE' }
                                    )
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Preset vị trí */}
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="canvas__btn-group-item"
                              style={{ background: '#1c202d', borderRadius: 4, padding: '3px 8px', fontSize: 10.5 }}
                              onClick={() => {
                                const curPos = selectedEl.computedStyles.position
                                const targetPos = curPos === 'absolute' || curPos === 'fixed' ? curPos : 'relative'
                                handleApplyLiveChange({ position: targetPos, left: '0px' }, undefined, { description: 'Đặt X = 0', actionType: 'MOVE' })
                              }}
                            >
                              X: 0
                            </button>
                            <button
                              className="canvas__btn-group-item"
                              style={{ background: '#1c202d', borderRadius: 4, padding: '3px 8px', fontSize: 10.5 }}
                              onClick={() => {
                                const curPos = selectedEl.computedStyles.position
                                const targetPos = curPos === 'absolute' || curPos === 'fixed' ? curPos : 'relative'
                                handleApplyLiveChange({ position: targetPos, top: '0px' }, undefined, { description: 'Đặt Y = 0', actionType: 'MOVE' })
                              }}
                            >
                              Y: 0
                            </button>
                            <button
                              className="canvas__btn-group-item"
                              style={{ background: '#1c202d', borderRadius: 4, padding: '3px 8px', fontSize: 10.5 }}
                              onClick={() => {
                                const curPos = selectedEl.computedStyles.position
                                const targetPos = curPos === 'absolute' || curPos === 'fixed' ? curPos : 'relative'
                                handleApplyLiveChange({ position: targetPos, left: '0px', top: '0px' }, undefined, { description: 'Về gốc (0, 0)', actionType: 'MOVE' })
                              }}
                            >
                              Về gốc (0, 0)
                            </button>
                          </div>
                        </div>

                        {/* Nhóm 2: Kích thước (Size: Width, Height) */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                          <span className="canvas__inspector-field-lbl" style={{ color: '#06b6d4', fontWeight: 600 }}>
                            Kích thước (Size: Width, Height)
                          </span>
                          <div className="canvas__inspector-grid">
                            {/* Chiều rộng (Width) */}
                            <div className="canvas__inspector-prop-card">
                              <span className="canvas__inspector-prop-lbl">Chiều rộng (W)</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <button
                                  className="canvas__tool-btn"
                                  style={{ width: 22, height: 22 }}
                                  title="Thu hẹp (-10px)"
                                  onClick={() => {
                                    const cur = parseInt(selectedEl.computedStyles.width) || Math.round(selectedEl.rect.width) || 50
                                    const nextW = Math.max(10, cur - 10)
                                    handleApplyLiveChange({ width: `${nextW}px` }, undefined, { description: `Rộng: ${nextW}px`, actionType: 'RESIZE' })
                                  }}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  className="canvas__inspector-field-input"
                                  style={{ padding: '2px 6px', height: 24, textAlign: 'center', fontFamily: 'monospace' }}
                                  value={parseInt(selectedEl.computedStyles.width) || Math.round(selectedEl.rect.width) || 0}
                                  onChange={(e) => {
                                    const val = Math.max(10, parseInt(e.target.value) || 10)
                                    handleApplyLiveChange({ width: `${val}px` }, undefined, { description: `Rộng: ${val}px`, actionType: 'RESIZE' })
                                  }}
                                />
                                <button
                                  className="canvas__tool-btn"
                                  style={{ width: 22, height: 22 }}
                                  title="Mở rộng (+10px)"
                                  onClick={() => {
                                    const cur = parseInt(selectedEl.computedStyles.width) || Math.round(selectedEl.rect.width) || 50
                                    const nextW = cur + 10
                                    handleApplyLiveChange({ width: `${nextW}px` }, undefined, { description: `Rộng: ${nextW}px`, actionType: 'RESIZE' })
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Chiều cao (Height) */}
                            <div className="canvas__inspector-prop-card">
                              <span className="canvas__inspector-prop-lbl">Chiều cao (H)</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <button
                                  className="canvas__tool-btn"
                                  style={{ width: 22, height: 22 }}
                                  title="Giảm cao (-10px)"
                                  onClick={() => {
                                    const cur = parseInt(selectedEl.computedStyles.height) || Math.round(selectedEl.rect.height) || 30
                                    const nextH = Math.max(10, cur - 10)
                                    handleApplyLiveChange({ height: `${nextH}px` }, undefined, { description: `Cao: ${nextH}px`, actionType: 'RESIZE' })
                                  }}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  className="canvas__inspector-field-input"
                                  style={{ padding: '2px 6px', height: 24, textAlign: 'center', fontFamily: 'monospace' }}
                                  value={parseInt(selectedEl.computedStyles.height) || Math.round(selectedEl.rect.height) || 0}
                                  onChange={(e) => {
                                    const val = Math.max(10, parseInt(e.target.value) || 10)
                                    handleApplyLiveChange({ height: `${val}px` }, undefined, { description: `Cao: ${val}px`, actionType: 'RESIZE' })
                                  }}
                                />
                                <button
                                  className="canvas__tool-btn"
                                  style={{ width: 22, height: 22 }}
                                  title="Tăng cao (+10px)"
                                  onClick={() => {
                                    const cur = parseInt(selectedEl.computedStyles.height) || Math.round(selectedEl.rect.height) || 30
                                    const nextH = cur + 10
                                    handleApplyLiveChange({ height: `${nextH}px` }, undefined, { description: `Cao: ${nextH}px`, actionType: 'RESIZE' })
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Preset kích thước */}
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="canvas__btn-group-item"
                              style={{ background: '#1c202d', borderRadius: 4, padding: '3px 8px', fontSize: 10.5 }}
                              onClick={() => handleApplyLiveChange({ width: 'auto' }, undefined, { description: 'Rộng: Auto', actionType: 'RESIZE' })}
                            >
                              Auto W
                            </button>
                            <button
                              className="canvas__btn-group-item"
                              style={{ background: '#1c202d', borderRadius: 4, padding: '3px 8px', fontSize: 10.5 }}
                              onClick={() => handleApplyLiveChange({ width: '100%' }, undefined, { description: 'Rộng: 100%', actionType: 'RESIZE' })}
                            >
                              100% W
                            </button>
                            <button
                              className="canvas__btn-group-item"
                              style={{ background: '#1c202d', borderRadius: 4, padding: '3px 8px', fontSize: 10.5 }}
                              onClick={() => handleApplyLiveChange({ height: 'auto' }, undefined, { description: 'Cao: Auto', actionType: 'RESIZE' })}
                            >
                              Auto H
                            </button>
                            <button
                              className="canvas__btn-group-item"
                              style={{ background: '#1c202d', borderRadius: 4, padding: '3px 8px', fontSize: 10.5 }}
                              onClick={() => handleApplyLiveChange({ width: '100%', height: '100%' }, undefined, { description: 'Fill 100%', actionType: 'RESIZE' })}
                            >
                              Fill
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 5. PHÔNG CHỮ & KIỂU DÁNG (TYPOGRAPHY) */}
                      <div className="canvas__inspector-card">
                        <div className="canvas__inspector-card-hd">
                          <SlidersHorizontal size={13} style={{ color: '#10b981' }} />
                          <span>Phông chữ & Kiểu dáng (Typography)</span>
                        </div>

                        {/* Cỡ chữ */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span className="canvas__inspector-field-lbl">Cỡ chữ (Font size)</span>
                          <div className="canvas__inspector-stepper">
                            <button
                              onClick={() => {
                                const curr = parseInt(selectedEl.computedStyles.fontSize) || 16
                                handleApplyLiveChange({ fontSize: Math.max(10, curr - 2) + 'px' })
                              }}
                            >
                              -
                            </button>
                            <span className="canvas__inspector-stepper-val">
                              {selectedEl.computedStyles.fontSize}
                            </span>
                            <button
                              onClick={() => {
                                const curr = parseInt(selectedEl.computedStyles.fontSize) || 16
                                handleApplyLiveChange({ fontSize: Math.min(72, curr + 2) + 'px' })
                              }}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Độ đậm */}
                        <div className="canvas__inspector-field">
                          <span className="canvas__inspector-field-lbl">
                            Độ đậm (Font weight: {selectedEl.computedStyles.fontWeight})
                          </span>
                          <div className="canvas__btn-group">
                            {[
                              { label: 'Nhẹ', val: '300' },
                              { label: 'Thường', val: '400' },
                              { label: 'Vừa', val: '500' },
                              { label: 'Đậm', val: '600' },
                              { label: 'Rất đậm', val: '700' },
                            ].map((w) => (
                              <button
                                key={w.val}
                                className={`canvas__btn-group-item ${selectedEl.computedStyles.fontWeight === w.val ? 'active' : ''}`}
                                onClick={() => handleApplyLiveChange({ fontWeight: w.val })}
                              >
                                {w.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Căn lề chữ */}
                        <div className="canvas__inspector-field">
                          <span className="canvas__inspector-field-lbl">Căn lề chữ (Text Align)</span>
                          <div className="canvas__btn-group">
                            {[
                              { label: 'Trái', val: 'left', icon: AlignLeft },
                              { label: 'Giữa', val: 'center', icon: AlignCenter },
                              { label: 'Phải', val: 'right', icon: AlignRight },
                              { label: 'Đều', val: 'justify', icon: AlignJustify },
                            ].map((item) => (
                              <button
                                key={item.val}
                                className={`canvas__btn-group-item ${selectedEl.computedStyles.textAlign === item.val ? 'active' : ''}`}
                                onClick={() => handleApplyLiveChange({ textAlign: item.val })}
                                title={`Căn ${item.label}`}
                              >
                                <item.icon size={13} style={{ margin: '0 auto' }} />
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Trang trí & Viết hoa */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          <div>
                            <span className="canvas__inspector-field-lbl">Kiểu chữ</span>
                            <div className="canvas__btn-group">
                              <button
                                className={`canvas__btn-group-item ${selectedEl.computedStyles.textDecoration === 'none' ? 'active' : ''}`}
                                onClick={() => handleApplyLiveChange({ textDecoration: 'none' })}
                              >
                                None
                              </button>
                              <button
                                className={`canvas__btn-group-item ${selectedEl.computedStyles.textDecoration.includes('underline') ? 'active' : ''}`}
                                onClick={() => handleApplyLiveChange({ textDecoration: 'underline' })}
                              >
                                <UnderlineIcon size={12} style={{ margin: '0 auto' }} />
                              </button>
                              <button
                                className={`canvas__btn-group-item ${selectedEl.computedStyles.textDecoration.includes('line-through') ? 'active' : ''}`}
                                onClick={() => handleApplyLiveChange({ textDecoration: 'line-through' })}
                              >
                                <StrikethroughIcon size={12} style={{ margin: '0 auto' }} />
                              </button>
                            </div>
                          </div>

                          <div>
                            <span className="canvas__inspector-field-lbl">Chữ hoa/thường</span>
                            <div className="canvas__btn-group">
                              {[
                                { label: 'Aa', val: 'none' },
                                { label: 'AA', val: 'uppercase' },
                                { label: 'aa', val: 'lowercase' },
                              ].map((item) => (
                                <button
                                  key={item.val}
                                  className={`canvas__btn-group-item ${selectedEl.computedStyles.textTransform === item.val ? 'active' : ''}`}
                                  onClick={() => handleApplyLiveChange({ textTransform: item.val })}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Màu chữ */}
                        <div className="canvas__inspector-field" style={{ marginTop: 6 }}>
                          <span className="canvas__inspector-field-lbl">Màu chữ (Text Color)</span>
                          <div className="canvas__inspector-color-row">
                            <input
                              type="color"
                              value={selectedEl.computedStyles.color.startsWith('#') ? selectedEl.computedStyles.color : '#ffffff'}
                              onChange={(e) => handleApplyLiveChange({ color: e.target.value })}
                            />
                            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#ffffff' }}>
                              {selectedEl.computedStyles.color}
                            </span>
                          </div>
                          <div className="canvas__swatch-row">
                            {COLOR_SWATCHES.map((hex) => (
                              <button
                                key={hex}
                                className="canvas__swatch-btn"
                                style={{ background: hex }}
                                onClick={() => handleApplyLiveChange({ color: hex })}
                              />
                            ))}
                          </div>
                          {projectTokens?.colors && projectTokens.colors.length > 0 && (
                            <div style={{ marginTop: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                                <span style={{ fontSize: 10, color: '#94a3b8' }}>Màu Theme (Design Tokens):</span>
                                <button
                                  style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: 10, cursor: 'pointer' }}
                                  onClick={() => setIsTokensDialogOpen(true)}
                                >
                                  Quản lý Tokens
                                </button>
                              </div>
                              <div className="canvas__swatch-row">
                                {projectTokens.colors.slice(0, 10).map((c) => (
                                  <button
                                    key={c.id}
                                    className="canvas__swatch-btn"
                                    style={{ background: c.value }}
                                    title={`${c.name} (${c.value})`}
                                    onClick={() => handleApplyLiveChange({ color: c.value })}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 6. MÀU NỀN & GRADIENT & ĐỘ MỜ */}
                      <div className="canvas__inspector-card">
                        <div className="canvas__inspector-card-hd">
                          <Palette size={13} style={{ color: '#ec4899' }} />
                          <span>Màu nền & Gradient & Hiệu ứng</span>
                        </div>

                        <div className="canvas__inspector-field">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span className="canvas__inspector-field-lbl">Màu nền (Background Color)</span>
                            <button
                              style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: 10, cursor: 'pointer' }}
                              onClick={() => handleApplyLiveChange({ backgroundColor: 'transparent', backgroundImage: 'none' })}
                            >
                              Trong suốt
                            </button>
                          </div>
                          <div className="canvas__inspector-color-row">
                            <input
                              type="color"
                              value={selectedEl.computedStyles.backgroundColor.startsWith('#') ? selectedEl.computedStyles.backgroundColor : '#1e293b'}
                              onChange={(e) => handleApplyLiveChange({ backgroundColor: e.target.value, backgroundImage: 'none' })}
                            />
                            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#ffffff' }}>
                              {selectedEl.computedStyles.backgroundColor || 'transparent'}
                            </span>
                          </div>
                          <div className="canvas__swatch-row">
                            {COLOR_SWATCHES.map((hex) => (
                              <button
                                key={hex}
                                className="canvas__swatch-btn"
                                style={{ background: hex }}
                                onClick={() => handleApplyLiveChange({ backgroundColor: hex, backgroundImage: 'none' })}
                              />
                            ))}
                          </div>
                          {projectTokens?.colors && projectTokens.colors.length > 0 && (
                            <div style={{ marginTop: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                                <span style={{ fontSize: 10, color: '#94a3b8' }}>Màu Theme (Design Tokens):</span>
                                <button
                                  style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: 10, cursor: 'pointer' }}
                                  onClick={() => setIsTokensDialogOpen(true)}
                                >
                                  Quản lý Tokens
                                </button>
                              </div>
                              <div className="canvas__swatch-row">
                                {projectTokens.colors.slice(0, 10).map((c) => (
                                  <button
                                    key={c.id}
                                    className="canvas__swatch-btn"
                                    style={{ background: c.value }}
                                    title={`${c.name} (${c.value})`}
                                    onClick={() => handleApplyLiveChange({ backgroundColor: c.value, backgroundImage: 'none' })}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Preset Gradients */}
                        <div className="canvas__inspector-field">
                          <span className="canvas__inspector-field-lbl">Dải màu Gradient sẵn có</span>
                          <div className="canvas__gradient-row">
                            {GRADIENT_PRESETS.map((g) => (
                              <button
                                key={g.name}
                                className="canvas__gradient-btn"
                                style={{ background: g.val }}
                                onClick={() => handleApplyLiveChange({ backgroundImage: g.val })}
                              >
                                {g.name}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Độ trong suốt (Opacity) */}
                        <div className="canvas__inspector-field">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span className="canvas__inspector-field-lbl">Độ trong suốt (Opacity)</span>
                            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#38bdf8' }}>
                              {Math.round((parseFloat(selectedEl.computedStyles.opacity) || 1) * 100)}%
                            </span>
                          </div>
                          <div className="canvas__slider-row">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={Math.round((parseFloat(selectedEl.computedStyles.opacity) || 1) * 100)}
                              onChange={(e) => handleApplyLiveChange({ opacity: `${parseInt(e.target.value) / 100}` })}
                            />
                            <span className="canvas__slider-val">
                              {Math.round((parseFloat(selectedEl.computedStyles.opacity) || 1) * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 7. ĐƯỜNG VIỀN & BO GÓC (BORDERS & RADIUS) */}
                      <div className="canvas__inspector-card">
                        <div className="canvas__inspector-card-hd">
                          <Square size={13} style={{ color: '#eab308' }} />
                          <span>Đường viền & Bo góc (Borders & Radius)</span>
                        </div>

                        {/* Kiểu viền */}
                        <div className="canvas__inspector-field">
                          <span className="canvas__inspector-field-lbl">Kiểu viền (Border Style)</span>
                          <div className="canvas__btn-group">
                            {['none', 'solid', 'dashed', 'dotted'].map((s) => (
                              <button
                                key={s}
                                className={`canvas__btn-group-item ${selectedEl.computedStyles.borderStyle === s ? 'active' : ''}`}
                                onClick={() => handleApplyLiveChange({ borderStyle: s })}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>

                        {selectedEl.computedStyles.borderStyle !== 'none' && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
                            <div>
                              <span className="canvas__inspector-field-lbl">Độ dày viền</span>
                              <div className="canvas__inspector-stepper">
                                <button
                                  onClick={() => {
                                    const curr = parseInt(selectedEl.computedStyles.borderWidth) || 0
                                    handleApplyLiveChange({ borderWidth: Math.max(0, curr - 1) + 'px' })
                                  }}
                                >
                                  -
                                </button>
                                <span className="canvas__inspector-stepper-val">
                                  {selectedEl.computedStyles.borderWidth}
                                </span>
                                <button
                                  onClick={() => {
                                    const curr = parseInt(selectedEl.computedStyles.borderWidth) || 0
                                    handleApplyLiveChange({ borderWidth: Math.min(12, curr + 1) + 'px' })
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            <div>
                              <span className="canvas__inspector-field-lbl">Màu viền</span>
                              <div className="canvas__inspector-color-row">
                                <input
                                  type="color"
                                  value={selectedEl.computedStyles.borderColor.startsWith('#') ? selectedEl.computedStyles.borderColor : '#6d5df5'}
                                  onChange={(e) => handleApplyLiveChange({ borderColor: e.target.value })}
                                />
                                <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#ffffff' }}>
                                  {selectedEl.computedStyles.borderColor || '#6d5df5'}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Bo góc (Radius) */}
                        <div style={{ marginTop: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span className="canvas__inspector-field-lbl">Bo góc (Border radius)</span>
                            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#38bdf8' }}>
                              {selectedEl.computedStyles.borderRadius}
                            </span>
                          </div>
                          <div className="canvas__slider-row">
                            <input
                              type="range"
                              min="0"
                              max="50"
                              value={parseInt(selectedEl.computedStyles.borderRadius) || 0}
                              onChange={(e) => handleApplyLiveChange({ borderRadius: `${e.target.value}px` })}
                            />
                            <span className="canvas__slider-val">{selectedEl.computedStyles.borderRadius}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                            {['0px', '4px', '8px', '16px', '9999px'].map((r) => (
                              <button
                                key={r}
                                className="canvas__btn-group-item"
                                style={{ background: '#1c202d', borderRadius: 4, padding: '3px 6px', fontSize: 10 }}
                                onClick={() => handleApplyLiveChange({ borderRadius: r })}
                              >
                                {r === '9999px' ? 'Tròn' : r}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* 8. ĐỔ BÓNG (BOX SHADOW) */}
                      <div className="canvas__inspector-card">
                        <div className="canvas__inspector-card-hd">
                          <Sparkles size={13} style={{ color: '#a855f7' }} />
                          <span>Đổ bóng (Box Shadow)</span>
                        </div>
                        <div className="canvas__shadow-grid">
                          {SHADOW_PRESETS.map((sh) => (
                            <button
                              key={sh.label}
                              className={`canvas__shadow-card ${selectedEl.computedStyles.boxShadow === sh.val ? 'active' : ''}`}
                              onClick={() => handleApplyLiveChange({ boxShadow: sh.val })}
                            >
                              {sh.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 9. CON TRỎ CHUỘT & TƯƠNG TÁC (CURSOR) */}
                      <div className="canvas__inspector-card">
                        <div className="canvas__inspector-card-hd">
                          <MousePointer2 size={13} style={{ color: '#06b6d4' }} />
                          <span>Con trỏ chuột & Tương tác (Cursor)</span>
                        </div>
                        <div className="canvas__btn-group">
                          {[
                            { label: 'Mặc định', val: 'default' },
                            { label: 'Bàn tay (pointer)', val: 'pointer' },
                            { label: 'Chữ (text)', val: 'text' },
                            { label: 'Cấm (not-allowed)', val: 'not-allowed' },
                          ].map((c) => (
                            <button
                              key={c.val}
                              className={`canvas__btn-group-item ${(selectedEl.computedStyles as any).cursor === c.val ? 'active' : ''}`}
                              onClick={() => handleApplyLiveChange({ cursor: c.val }, undefined, { description: `Con trỏ: ${c.val}`, actionType: 'STYLE' })}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : inspectorTab === 'code' ? (
                    /* TAB 2: ĐỒNG BỘ MÃ NGUỒN THẬT (TWO-WAY CODE SYNC) */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div className="canvas__source-card">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8' }}>
                            Tệp mã nguồn tương ứng
                          </span>
                          {isLocatingSource && (
                            <span style={{ fontSize: 10, color: '#38bdf8' }}>Đang quét dự án...</span>
                          )}
                        </div>

                        {sourceLoc ? (
                          <>
                            <div className="canvas__source-badge">
                              📄 {sourceLoc.filePath} : dòng {sourceLoc.lineNumber}
                            </div>

                            {/* Badge số thay đổi đang chờ lưu */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span className="canvas__diff-badge">
                                ⚡ {modifiedCount} thay đổi đang chờ lưu
                              </span>
                            </div>

                            {/* DIFF VIEW (BEFORE & AFTER) */}
                            {diffPreview && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600 }}>
                                  SO SÁNH MÃ NGUỒN (DIFF VIEW):
                                </span>
                                <div className="canvas__diff-container">
                                  <div className="canvas__diff-line old">
                                    <span className="canvas__diff-prefix">-</span>
                                    <span>{diffPreview.origLine}</span>
                                  </div>
                                  <div className="canvas__diff-line new">
                                    <span className="canvas__diff-prefix">+</span>
                                    <span>{diffPreview.newLine}</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            <button
                              className="btn primary"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 7,
                                height: 36,
                                fontSize: 12.5,
                                fontWeight: 700,
                                borderRadius: 6,
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                color: '#fff',
                                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                                border: 'none',
                                cursor: 'pointer',
                              }}
                              disabled={isSyncingCode}
                              onClick={handleSyncCodeToFile}
                            >
                              <Check size={14} />
                              {isSyncingCode ? 'Đang lưu vào tệp...' : '💾 Lưu thay đổi vào mã nguồn thật'}
                            </button>
                          </>
                        ) : (
                          <div style={{ padding: '16px 8px', textAlign: 'center', color: '#94a3b8', fontSize: 11.5 }}>
                            {isLocatingSource
                              ? 'Hệ thống đang quét toàn bộ thư mục dự án để tìm tệp chứa phần tử này...'
                              : 'Chưa tự động xác định được tệp nguồn. Bạn có thể mở tệp trong cây tệp bên trái để chỉnh sửa.'}
                          </div>
                        )}
                      </div>

                      <div className="canvas__inspector-card">
                        <div className="canvas__inspector-card-hd">
                          <span>Cách hoạt động của Code Sync Engine</span>
                        </div>
                        <p style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                          Khi bạn bấm nút <b>Lưu thay đổi vào mã nguồn thật</b>, PixelMind sẽ ghi trực tiếp vào tệp mã nguồn (.cshtml, .tsx, .jsx, .html, .vue, .svelte, .py, .php...) trên máy tính. Máy chủ phát triển sẽ lập tức nhận diện tệp thay đổi và cập nhật giao diện vĩnh viễn!
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* TAB 3: THUỘC TÍNH PHẦN TỬ (HỘP CÔNG CỤ) */
                    <div className="canvas__attrs-panel">
                      <div className="canvas__inspector-card">
                        <div className="canvas__inspector-card-hd">
                          <SlidersHorizontal size={13} style={{ color: '#38bdf8' }} />
                          <span>Thuộc tính HTML</span>
                        </div>

                        <div className="canvas__inspector-field">
                          <span className="canvas__inspector-field-lbl">ID</span>
                          <input
                            className="canvas__inspector-field-input"
                            value={attrsDraft.id}
                            placeholder="vd: hero-section"
                            onChange={(event) => setAttrsDraft((prev) => ({ ...prev, id: event.target.value }))}
                            onKeyDown={(event) => event.stopPropagation()}
                          />
                        </div>

                        <div className="canvas__inspector-field">
                          <span className="canvas__inspector-field-lbl">Class</span>
                          <input
                            className="canvas__inspector-field-input"
                            value={attrsDraft.className}
                            placeholder="vd: card shadow-lg"
                            onChange={(event) => setAttrsDraft((prev) => ({ ...prev, className: event.target.value }))}
                            onKeyDown={(event) => event.stopPropagation()}
                          />
                        </div>

                        <div className="canvas__inspector-field">
                          <span className="canvas__inspector-field-lbl">Nội dung văn bản</span>
                          <textarea
                            className="canvas__inspector-field-input"
                            rows={3}
                            value={attrsDraft.text}
                            disabled={!selectedEl.isLeaf}
                            onChange={(event) => setAttrsDraft((prev) => ({ ...prev, text: event.target.value }))}
                            onKeyDown={(event) => event.stopPropagation()}
                          />
                          {!selectedEl.isLeaf && (
                            <em className="canvas__attrs-hint">
                              Chỉ sửa được văn bản của phần tử không có phần tử con.
                            </em>
                          )}
                        </div>

                        <button
                          className="btn primary canvas__attrs-apply"
                          onClick={() => void beginToolboxAttributes()}
                        >
                          <Check size={13} /> Áp dụng & xem diff
                        </button>
                      </div>

                      {(multiSelection.length > 1 || selectedEl) && (
                        <div className="canvas__inspector-card">
                          <div className="canvas__inspector-card-hd">
                            <Layers size={13} style={{ color: '#a78bfa' }} />
                            <span>
                              {multiSelection.length > 1
                                ? `Căn lề & Phân bổ (${multiSelection.length} phần tử)`
                                : `Căn lề theo khung cha (<${(selectedEl?.tagName || 'div').toLowerCase()}>)`}
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
                            <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>
                              {multiSelection.length > 1 ? 'Căn lề (Alignment)' : 'Căn lề trong phần tử cha (Container Alignment)'}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3 }}>
                              <button
                                className="pm-ibtn"
                                title={multiSelection.length > 1 ? "Căn lề trái các phần tử" : "Căn lề trái theo khung cha"}
                                onClick={() => handleAlignSelection('left')}
                                style={{ height: 26, width: '100%' }}
                              >
                                <AlignLeft size={13} />
                              </button>
                              <button
                                className="pm-ibtn"
                                title={multiSelection.length > 1 ? "Căn giữa ngang các phần tử" : "Căn giữa ngang theo khung cha"}
                                onClick={() => handleAlignSelection('center')}
                                style={{ height: 26, width: '100%' }}
                              >
                                <AlignCenter size={13} />
                              </button>
                              <button
                                className="pm-ibtn"
                                title={multiSelection.length > 1 ? "Căn lề phải các phần tử" : "Căn lề phải theo khung cha"}
                                onClick={() => handleAlignSelection('right')}
                                style={{ height: 26, width: '100%' }}
                              >
                                <AlignRight size={13} />
                              </button>
                              <button
                                className="pm-ibtn"
                                title={multiSelection.length > 1 ? "Căn lề trên các phần tử" : "Căn lề trên theo khung cha"}
                                onClick={() => handleAlignSelection('top')}
                                style={{ height: 26, width: '100%' }}
                              >
                                <AlignStartVertical size={13} />
                              </button>
                              <button
                                className="pm-ibtn"
                                title={multiSelection.length > 1 ? "Căn giữa dọc các phần tử" : "Căn giữa dọc theo khung cha"}
                                onClick={() => handleAlignSelection('middle')}
                                style={{ height: 26, width: '100%' }}
                              >
                                <AlignCenterVertical size={13} />
                              </button>
                              <button
                                className="pm-ibtn"
                                title={multiSelection.length > 1 ? "Căn lề dưới các phần tử" : "Căn lề dưới theo khung cha"}
                                onClick={() => handleAlignSelection('bottom')}
                                style={{ height: 26, width: '100%' }}
                              >
                                <AlignEndVertical size={13} />
                              </button>
                            </div>

                            {multiSelection.length > 1 && (
                              <>
                                <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 4 }}>Khoảng cách đều (Distribution)</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                                  <button
                                    className="btn secondary"
                                    style={{ height: 26, fontSize: 10.5, padding: '0 6px', gap: 4, justifyContent: 'center' }}
                                    title="Phân bổ khoảng cách ngang đều nhau (tối thiểu 3 phần tử)"
                                    onClick={() => handleDistributeSelection('horizontal')}
                                  >
                                    <AlignHorizontalDistributeCenter size={12} /> Cách đều ngang
                                  </button>
                                  <button
                                    className="btn secondary"
                                    style={{ height: 26, fontSize: 10.5, padding: '0 6px', gap: 4, justifyContent: 'center' }}
                                    title="Phân bổ khoảng cách dọc đều nhau (tối thiểu 3 phần tử)"
                                    onClick={() => handleDistributeSelection('vertical')}
                                  >
                                    <AlignVerticalDistributeCenter size={12} /> Cách đều dọc
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="canvas__inspector-card">
                        <div className="canvas__inspector-card-hd">
                          <Copy size={13} style={{ color: '#a78bfa' }} />
                          <span>Thao tác nhanh</span>
                        </div>
                        <div className="canvas__attrs-quick">
                          <button className="btn secondary" onClick={() => void beginToolboxDuplicate()}>
                            <Copy size={12} /> Nhân bản (Ctrl+D)
                          </button>
                          <button
                            className="btn secondary"
                            onClick={copySelection}
                            title="Sao chép phần tử đang chọn để dán sang trang khác (Ctrl+C)"
                          >
                            <Copy size={12} /> Sao chép (Ctrl+C)
                          </button>
                          <button
                            className="btn secondary"
                            onClick={() => void pasteSelection()}
                            title="Dán phần tử từ bộ nhớ tạm vào trang hiện tại (Ctrl+V)"
                          >
                            <ClipboardPaste size={12} /> Dán (Ctrl+V)
                          </button>
                          <button className="btn secondary canvas__attrs-danger" onClick={() => void beginDeleteSelection()}>
                            <Trash2 size={12} />{' '}
                            {multiSelection.length > 1 ? `Xoá ${multiSelection.length} phần tử (Delete)` : 'Xoá (Delete)'}
                          </button>
                        </div>
                        <p className="canvas__attrs-hint">
                          Mọi thay đổi đều hiển thị diff trước khi ghi và có thể hoàn tác bằng Ctrl+Z.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Side Panel cố định ở đáy */}
                <div className="canvas__inspector-ft">
                  {/* Trạng thái RAM Designer Buffer (WinForms Model) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 11 }}>
                    {isDirtyBuffer ? (
                      <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                        <span>Có thay đổi trong RAM (<b>Ctrl+S</b> hoặc <b>▶ Run</b> để lưu)</span>
                      </span>
                    ) : (
                      <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                        <span>Mã nguồn đã đồng bộ sạch</span>
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn secondary"
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        height: 32,
                        fontSize: 11.5,
                        borderRadius: 6,
                      }}
                      onClick={handleResetOriginal}
                      title="Khôi phục thuộc tính và kích thước ban đầu (có thể hoàn tác Ctrl+Z)"
                    >
                      <RotateCcw size={13} /> Khôi phục gốc
                    </button>

                    <button
                      className="btn primary"
                      style={{
                        flex: 1.2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        height: 32,
                        fontSize: 11.5,
                        fontWeight: 700,
                        borderRadius: 6,
                        background: isDirtyBuffer ? '#10b981' : '#334155',
                        color: '#fff',
                        opacity: isDirtyBuffer ? 1 : 0.7,
                      }}
                      disabled={isSyncingCode}
                      onClick={async () => {
                        setIsSyncingCode(true)
                        await editorBuffer.saveAllDirtyFiles(showToast)
                        setIsSyncingCode(false)
                      }}
                      title="Lưu tất cả thay đổi trong RAM vào tệp mã nguồn thật trên ổ đĩa (Ctrl+S)"
                    >
                      <Check size={13} /> {isDirtyBuffer ? 'Lưu mã nguồn (Ctrl+S)' : 'Đã lưu (Ctrl+S)'}
                    </button>
                  </div>

                </div>
              </>
            ) : (
              <div className="canvas__inspector-empty-wrap">
                <div className="canvas__inspector-empty-hero">
                  <div className="canvas__inspector-empty-radar">
                    <MousePointer2 size={20} />
                  </div>
                  <div className="canvas__inspector-empty-copy">
                    <h4>Chế độ Soi phần tử đang bật</h4>
                    <p>
                      Rê chuột vào giao diện xem trước bên trái và <b>nhấp vào bất kỳ thành phần nào</b> (nút bấm, tiêu đề, menu, thẻ) để mở bảng thông số và sửa trực tiếp.
                    </p>
                  </div>
                </div>

                <div className="canvas__inspector-shortcuts">
                  <div className="canvas__inspector-shortcuts-hd">
                    <Sparkles size={11} />
                    <span>Phím tắt nhanh</span>
                  </div>
                  <div className="canvas__inspector-shortcuts-grid">
                    <div className="canvas__inspector-shortcut-item">
                      <span>Bật / tắt soi</span>
                      <kbd>I</kbd>
                    </div>
                    <div className="canvas__inspector-shortcut-item">
                      <span>Di chuyển canvas</span>
                      <kbd>Space / H</kbd>
                    </div>
                    <div className="canvas__inspector-shortcut-item">
                      <span>Căn vừa khung</span>
                      <kbd>F</kbd>
                    </div>
                    <div className="canvas__inspector-shortcut-item">
                      <span>Thoát chế độ soi</span>
                      <kbd>Esc</kbd>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </aside>
        )}

        {isPageFlowOpen && (
          <MultiPageCanvas
            projectName={projectName}
            projectPath={projectPath}
            pages={pages}
            previewUrl={url ?? currentLiveUrl}
            currentRoute={currentRoute ?? null}
            onNotify={(kind, message) => showToast(message, kind)}
            onOpenPage={(route) => {
              setIsPageFlowOpen(false)
              onOpenPage?.(route)
            }}
            onClose={() => setIsPageFlowOpen(false)}
          />
        )}
      </div>

      {isTokensDialogOpen && (
        <DesignTokensDialog
          projectPath={projectPath}
          projectName={projectName}
          onClose={() => setIsTokensDialogOpen(false)}
          showToast={showToast}
          onTokensUpdated={(t) => setProjectTokens(t)}
        />
      )}

      {/* ── Menu ngữ cảnh chuột phải trên Canvas (Live Element Context Menu) ── */}
      {canvasContextMenu && (
        <div
          className="pm-canvas-context-menu"
          style={{
            position: 'fixed',
            left: Math.min(window.innerWidth - 240, canvasContextMenu.x),
            top: Math.min(window.innerHeight - 280, canvasContextMenu.y),
            zIndex: 9999,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pm-canvas-context-menu__hd">
            <span className="pm-canvas-context-menu__tag">
              &lt;{canvasContextMenu.info.tagName.toLowerCase()}&gt;
            </span>
            {canvasContextMenu.info.id && (
              <span className="pm-canvas-context-menu__id">#{canvasContextMenu.info.id}</span>
            )}
          </div>

          <button
            className="pm-canvas-context-menu__item"
            onClick={() => {
              void beginToolboxDuplicate()
              setCanvasContextMenu(null)
            }}
          >
            <Copy size={13} />
            <span>Nhân bản (Ctrl+D)</span>
          </button>

          <button
            className="pm-canvas-context-menu__item pm-canvas-context-menu__item--danger"
            onClick={() => {
              void beginDeleteSelection()
              setCanvasContextMenu(null)
            }}
          >
            <Trash2 size={13} />
            <span>
              Xoá {multiSelection.length > 1 ? `${multiSelection.length} phần tử` : 'phần tử'} (Delete)
            </span>
          </button>

          <div className="pm-canvas-context-menu__divider" />

          <button
            className="pm-canvas-context-menu__item"
            onClick={() => {
              copySelection()
              setCanvasContextMenu(null)
            }}
          >
            <Copy size={13} />
            <span>Sao chép phần tử (Ctrl+C)</span>
          </button>

          <button
            className="pm-canvas-context-menu__item"
            onClick={() => {
              void pasteSelection()
              setCanvasContextMenu(null)
            }}
            disabled={!elementClipboard.has()}
          >
            <Copy size={13} />
            <span>Dán phần tử (Ctrl+V)</span>
          </button>

          {multiSelection.length > 1 && (
            <>
              <div className="pm-canvas-context-menu__divider" />
              <div style={{ padding: '4px 8px 2px', fontSize: 10, color: 'var(--text-3)', fontWeight: 600 }}>
                CĂN LỀ & PHÂN BỔ
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 2, padding: '2px 6px' }}>
                <button
                  className="pm-ibtn"
                  style={{ width: '100%', height: 24 }}
                  title="Căn lề trái"
                  onClick={() => {
                    handleAlignSelection('left')
                    setCanvasContextMenu(null)
                  }}
                >
                  <AlignLeft size={12} />
                </button>
                <button
                  className="pm-ibtn"
                  style={{ width: '100%', height: 24 }}
                  title="Căn giữa ngang"
                  onClick={() => {
                    handleAlignSelection('center')
                    setCanvasContextMenu(null)
                  }}
                >
                  <AlignCenter size={12} />
                </button>
                <button
                  className="pm-ibtn"
                  style={{ width: '100%', height: 24 }}
                  title="Căn lề phải"
                  onClick={() => {
                    handleAlignSelection('right')
                    setCanvasContextMenu(null)
                  }}
                >
                  <AlignRight size={12} />
                </button>
                <button
                  className="pm-ibtn"
                  style={{ width: '100%', height: 24 }}
                  title="Căn lề trên"
                  onClick={() => {
                    handleAlignSelection('top')
                    setCanvasContextMenu(null)
                  }}
                >
                  <AlignStartVertical size={12} />
                </button>
                <button
                  className="pm-ibtn"
                  style={{ width: '100%', height: 24 }}
                  title="Căn giữa dọc"
                  onClick={() => {
                    handleAlignSelection('middle')
                    setCanvasContextMenu(null)
                  }}
                >
                  <AlignCenterVertical size={12} />
                </button>
                <button
                  className="pm-ibtn"
                  style={{ width: '100%', height: 24 }}
                  title="Căn lề dưới"
                  onClick={() => {
                    handleAlignSelection('bottom')
                    setCanvasContextMenu(null)
                  }}
                >
                  <AlignEndVertical size={12} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: '3px 6px 4px' }}>
                <button
                  className="pm-ibtn"
                  style={{ width: '100%', height: 22, fontSize: 10, gap: 4, padding: '0 4px', justifyContent: 'center' }}
                  title="Phân bổ khoảng cách ngang đều nhau"
                  onClick={() => {
                    handleDistributeSelection('horizontal')
                    setCanvasContextMenu(null)
                  }}
                >
                  <AlignHorizontalDistributeCenter size={11} /> Cách đều ngang
                </button>
                <button
                  className="pm-ibtn"
                  style={{ width: '100%', height: 22, fontSize: 10, gap: 4, padding: '0 4px', justifyContent: 'center' }}
                  title="Phân bổ khoảng cách dọc đều nhau"
                  onClick={() => {
                    handleDistributeSelection('vertical')
                    setCanvasContextMenu(null)
                  }}
                >
                  <AlignVerticalDistributeCenter size={11} /> Cách đều dọc
                </button>
              </div>
            </>
          )}

          <div className="pm-canvas-context-menu__divider" />

          <button
            className="pm-canvas-context-menu__item"
            onClick={() => {
              if (canvasContextMenu.info.outerHTML) {
                void navigator.clipboard.writeText(canvasContextMenu.info.outerHTML)
                showToast('Đã sao chép mã HTML phần tử vào bộ nhớ tạm.', 'ok')
              }
              setCanvasContextMenu(null)
            }}
          >
            <Code2 size={13} />
            <span>Sao chép mã HTML</span>
          </button>

          <button
            className="pm-canvas-context-menu__item"
            onClick={() => {
              if (canvasContextMenu.info.selector) {
                void navigator.clipboard.writeText(canvasContextMenu.info.selector)
                showToast('Đã sao chép CSS Selector.', 'ok')
              }
              setCanvasContextMenu(null)
            }}
          >
            <Hash size={13} />
            <span>Sao chép CSS Selector</span>
          </button>

          <div className="pm-canvas-context-menu__divider" />

          <button
            className="pm-canvas-context-menu__item"
            onClick={() => {
              setInspectorTab('attrs')
              setCanvasContextMenu(null)
            }}
          >
            <SlidersHorizontal size={13} />
            <span>Chỉnh sửa thuộc tính...</span>
          </button>
        </div>
      )}

      <MutationDiffDialog
        open={Boolean(pendingMutation)}
        title={pendingMutation?.title || 'Xác nhận thay đổi mã nguồn'}
        subtitle={pendingMutation?.subtitle}
        preview={pendingMutation?.preview ?? null}
        busy={mutationBusy}
        confirmLabel={
          pendingMutation?.mode === 'delete'
            ? 'Xoá khỏi mã nguồn'
            : pendingMutation?.mode === 'duplicate'
              ? 'Nhân bản trong mã nguồn'
              : pendingMutation?.mode === 'attributes'
                ? 'Ghi thuộc tính'
                : 'Chèn vào mã nguồn'
        }
        onCancel={() => {
          if (!mutationBusy) setPendingMutation(null)
        }}
        onConfirm={(customBlock?: string) => void applyPendingMutation(customBlock)}
        onPreviewOnly={() => void applyPreviewOnlyMutation()}
      />

    </div>
  )
}

export default CanvasArea
