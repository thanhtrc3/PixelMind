import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Box,
  Boxes,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FileCode2,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderTree,
  Hash,
  History,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  Link,
  List,
  Loader2,
  MousePointer2,
  Palette,
  PanelLeftClose,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Redo2,
  RotateCcw,
  Search,
  Sliders,
  Sparkles,
  Table,
  Target,
  Trash2,
  Type,
  Undo2,
  X,
} from 'lucide-react'
import type { FileContent, FileNode, ProjectPage, ProjectRecord, DesignTokens } from '@shared/types'
import type { FileSearchMatch } from '../../shared/api'
import { DEFAULT_DESIGN_TOKENS, tokenToCssVarName } from '@shared/designTokens'
import type { RealElementInfo } from './CanvasArea'
import { editorBuffer } from '../lib/editorBuffer'
import { formatBytes } from '../lib/format'
import { api } from '../lib/bridge'
import FileTree from './FileTree'
import FileActionDialog from './FileActionDialog'
import ToolboxPanel from './ToolboxPanel'
import VersionsTab from './VersionsTab'

export type SidebarTab = 'files' | 'layers' | 'pages' | 'assets' | 'versions' | 'design' | 'toolbox'

/** Ảnh mẫu đã chọn trong tab Assets để truyền sang Canvas. */
export interface ReferenceAsset {
  name: string
  path: string
  size: number
  dataUrl: string
}

/** Chuyển nội dung tệp ảnh thành data URL (hỗ trợ cả SVG dạng văn bản). */
function fileToDataUrl(file: FileContent, name: string): string | null {
  if (file.dataUrl) return file.dataUrl
  if (/\.svg$/i.test(name) && file.text) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(file.text)}`
  }
  return null
}

/* ── Lịch sử thao tác ảnh trong tab Assets (phiên làm việc hiện tại) ── */
interface AssetHistoryItem {
  source?: string
  destination: string
  backupPath?: string
}

type AssetHistoryEntry =
  | { kind: 'add'; label: string; items: AssetHistoryItem[] }
  | { kind: 'remove'; label: string; path: string; backupPath: string }

const MAX_ASSET_HISTORY = 20

interface WorkspaceSidebarProps {
  project: ProjectRecord
  tree: FileNode[]
  treeLoading: boolean
  selectedPath: string | null
  query: string
  onQuery: (value: string) => void
  onSelectFile: (node: FileNode, initialLine?: number) => void
  onRefresh: () => void
  onOpenFolder: () => void
  activeTab: SidebarTab
  onActiveTabChange: (tab: SidebarTab) => void
  onCloseSidebar: () => void
  onOpenPage: (route: string) => void
  onAddPage: () => void
  onEditPage?: (page: ProjectPage) => void
  onDeletePage?: (page: ProjectPage) => void
  onDuplicatePage?: (page: ProjectPage) => void
  onOpenParamChooser?: (page: ProjectPage) => void
  currentRoute?: string
  onOpenTokens: () => void
  branch: string | null
  onShowToast: (kind: 'ok' | 'err' | 'info', text: string) => void
  isRunning?: boolean
  onRun?: () => void
  /** Chuyển sang tab Xem trước để canvas nhận phần tử từ Hộp công cụ. */
  onOpenPreview?: () => void
  /** Đường dẫn ảnh mẫu đang được chọn (để làm nổi bật card tương ứng). */
  referenceAssetPath?: string | null
  /** Chọn một ảnh làm ảnh mẫu và truyền state sang Canvas. */
  onSelectReference?: (asset: ReferenceAsset) => void
  /** Bỏ ảnh mẫu đang chọn. */
  onClearReference?: () => void
}

export function isDynamicRoute(page: ProjectPage): boolean {
  if (page.sampleParams && page.sampleParams.length > 0) return true
  const r = (page.route || '').toLowerCase()
  return (
    r.includes('/delete') ||
    r.includes('/update') ||
    r.includes('/edit') ||
    r.includes('/display') ||
    r.includes('/details') ||
    r.includes('/detail') ||
    r.includes('/view') ||
    r.includes(':') ||
    r.includes('{') ||
    r.includes('[')
  )
}

/* ── Cây phân cấp Đường dẫn Route (1/ = Tầng 1, 2// = Tầng 2, ...) ── */
export interface RouteTreeNode {
  key: string
  path: string
  segment: string
  depth: number
  page?: ProjectPage
  children: RouteTreeNode[]
}

export function buildRouteTree(pages: ProjectPage[]): RouteTreeNode[] {
  const nodeMap = new Map<string, RouteTreeNode>()
  const rootNodes: RouteTreeNode[] = []

  function getOrCreateNode(path: string, depth: number, segment: string): RouteTreeNode {
    const normalized = path === '/' ? '/' : path.replace(/\/+$/, '')
    if (nodeMap.has(normalized)) {
      return nodeMap.get(normalized)!
    }
    const node: RouteTreeNode = {
      key: normalized,
      path: normalized,
      segment,
      depth,
      children: [],
    }
    nodeMap.set(normalized, node)
    return node
  }

  for (const page of pages) {
    const raw = (page.route || '/').trim()
    const r = raw.startsWith('/') ? raw : `/${raw}`

    if (r === '/') {
      const node = getOrCreateNode('/', 1, '/')
      node.page = page
      continue
    }

    const segments = r.slice(1).split('/').filter(Boolean)
    let currentPath = ''
    let parentNode: RouteTreeNode | null = null

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      currentPath += `/${seg}`
      const depth = i + 1
      const isTarget = i === segments.length - 1

      const node = getOrCreateNode(currentPath, depth, seg)
      if (isTarget) {
        node.page = page
      }

      if (parentNode) {
        if (!parentNode.children.some((c) => c.key === node.key)) {
          parentNode.children.push(node)
        }
      }
      parentNode = node
    }
  }

  for (const node of nodeMap.values()) {
    if (node.depth === 1) {
      rootNodes.push(node)
    }
  }

  function sortNodes(nodes: RouteTreeNode[]) {
    nodes.sort((a, b) => {
      if (a.path === '/') return -1
      if (b.path === '/') return 1
      return a.path.localeCompare(b.path)
    })
    for (const n of nodes) {
      if (n.children.length > 0) {
        sortNodes(n.children)
      }
    }
  }

  sortNodes(rootNodes)
  return rootNodes
}

export function filterRouteTree(nodes: RouteTreeNode[], query: string): RouteTreeNode[] {
  if (!query) return nodes
  const q = query.toLowerCase()
  const result: RouteTreeNode[] = []

  for (const node of nodes) {
    const titleMatch = node.page?.title?.toLowerCase().includes(q) || node.segment.toLowerCase().includes(q)
    const routeMatch = node.path.toLowerCase().includes(q)
    const isSelfMatch = Boolean(titleMatch || routeMatch)

    const filteredChildren = filterRouteTree(node.children, query)

    if (isSelfMatch || filteredChildren.length > 0) {
      result.push({
        ...node,
        children: filteredChildren,
      })
    }
  }

  return result
}

/* ── Cấu trúc nút phân cấp phần tử DOM thật ── */
export interface LayerNode {
  id: string
  uid?: string
  label: string
  tag: string
  tagName: string
  depth: number
  selector?: string
  childrenCount?: number
  rect?: { top: number; left: number; width: number; height: number }
}

function getTagIcon(tagName?: string) {
  const t = (tagName || '').toLowerCase()
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'label', 'b', 'strong', 'em', 'small'].includes(t)) {
    return Type
  }
  if (['button'].includes(t)) return MousePointer2
  if (['input', 'select', 'textarea'].includes(t)) return Sliders
  if (['a'].includes(t)) return Link
  if (['img', 'svg', 'canvas', 'video'].includes(t)) return ImageIcon
  if (['table', 'thead', 'tbody', 'tr', 'th', 'td'].includes(t)) return Table
  if (['ul', 'ol', 'li'].includes(t)) return List
  if (['header', 'footer', 'nav'].includes(t)) return Layers
  if (['body', 'main', 'section', 'article', 'aside'].includes(t)) return LayoutGrid
  return Box
}

export function parseRgbOrHex(colorStr?: string): { hex: string; isValid: boolean } {
  if (!colorStr) return { hex: '', isValid: false }
  const s = colorStr.trim().toLowerCase()
  if (
    s === 'transparent' ||
    s === 'inherit' ||
    s === 'initial' ||
    s === 'currentcolor' ||
    s === 'rgba(0, 0, 0, 0)'
  ) {
    return { hex: '', isValid: false }
  }
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) {
    if (s.length === 4) {
      const full = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]
      return { hex: full, isValid: true }
    }
    return { hex: s, isValid: true }
  }
  const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (m) {
    const r = parseInt(m[1], 10).toString(16).padStart(2, '0')
    const g = parseInt(m[2], 10).toString(16).padStart(2, '0')
    const b = parseInt(m[3], 10).toString(16).padStart(2, '0')
    return { hex: `#${r}${g}${b}`, isValid: true }
  }
  return { hex: s, isValid: false }
}

export function colorsMatch(c1?: string, c2?: string): boolean {
  if (!c1 || !c2) return false
  const p1 = parseRgbOrHex(c1)
  const p2 = parseRgbOrHex(c2)
  if (p1.isValid && p2.isValid) {
    return p1.hex.toLowerCase() === p2.hex.toLowerCase()
  }
  return c1.trim().toLowerCase() === c2.trim().toLowerCase()
}

export const WorkspaceSidebar = ({
  project,
  tree,
  treeLoading,
  selectedPath,
  query,
  onQuery,
  onSelectFile,
  onRefresh,
  onOpenFolder,
  activeTab,
  onActiveTabChange,
  onCloseSidebar,
  onOpenPage,
  onAddPage,
  onEditPage,
  onDeletePage,
  onDuplicatePage,
  onOpenParamChooser,
  currentRoute,
  onOpenTokens,
  branch,
  onShowToast,
  isRunning = false,
  onRun,
  onOpenPreview,
  referenceAssetPath = null,
  onSelectReference,
  onClearReference,
}: WorkspaceSidebarProps) => {
  const [layersSearch, setLayersSearch] = useState('')
  const [pagesSearch, setPagesSearch] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [fileHeaderDialog, setFileHeaderDialog] = useState<'new-file' | 'new-folder' | null>(null)

  // ── Tìm kiếm nội dung toàn văn bản trong dự án (Full-text Grep) ──
  const [fileSearchMode, setFileSearchMode] = useState<'name' | 'content'>('name')
  const [contentQuery, setContentQuery] = useState('')
  const [contentMatches, setContentMatches] = useState<FileSearchMatch[]>([])
  const [isSearchingContent, setIsSearchingContent] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)

  const handleContentSearch = useCallback(
    async (text: string, cs = caseSensitive) => {
      const q = text.trim()
      if (!q || !project?.path) {
        setContentMatches([])
        setIsSearchingContent(false)
        return
      }
      setIsSearchingContent(true)
      try {
        const results = await api.fs.search(project.path, q, { caseSensitive: cs, maxResults: 150 })
        setContentMatches(results)
      } catch {
        setContentMatches([])
      } finally {
        setIsSearchingContent(false)
      }
    },
    [project?.path, caseSensitive],
  )

  useEffect(() => {
    if (fileSearchMode !== 'content') return
    const timer = setTimeout(() => {
      void handleContentSearch(contentQuery)
    }, 280)
    return () => clearTimeout(timer)
  }, [contentQuery, fileSearchMode, handleContentSearch])

  const groupedContentMatches = useMemo(() => {
    const map = new Map<string, FileSearchMatch[]>()
    for (const match of contentMatches) {
      const list = map.get(match.file) || []
      list.push(match)
      map.set(match.file, list)
    }
    return Array.from(map.entries()).map(([file, matches]) => ({
      file,
      fullPath: matches[0].fullPath,
      name: file.split(/[\\/]/).pop() || file,
      ext: (file.split('.').pop() || '').toLowerCase(),
      matches,
    }))
  }, [contentMatches])

  const togglePageGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }))
  }
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null)
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null)

  const [liveLayers, setLiveLayers] = useState<LayerNode[]>([])
  const [isLoadingLayers, setIsLoadingLayers] = useState(false)

  // ── Hệ thống Design Tokens từ dự án thật ──
  const [tokens, setTokens] = useState<DesignTokens | null>(null)
  const [tokensLoading, setTokensLoading] = useState(false)
  const [tokenSearch, setTokenSearch] = useState('')
  const [tokenSubtab, setTokenSubtab] = useState<
    'colors' | 'typography' | 'spacing' | 'radius' | 'breakpoints' | 'custom'
  >('colors')
  const [colorCategory, setColorCategory] = useState<'all' | 'brand' | 'background' | 'status' | 'neutral'>('all')
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null)

  // ── Phần tử đang được chọn trên Canvas (để trực tiếp áp dụng Token) ──
  const [selectedElement, setSelectedElement] = useState<RealElementInfo | null>(null)
  const [colorApplyTarget, setColorApplyTarget] = useState<'bg' | 'text' | 'border'>('bg')
  const [spacingApplyTarget, setSpacingApplyTarget] = useState<'padding' | 'margin' | 'gap'>('padding')
  const [appliedTokenId, setAppliedTokenId] = useState<string | null>(null)

  // Lắng nghe phần tử đang chọn từ CanvasArea
  useEffect(() => {
    const handleSelectedChange = (e: Event) => {
      const custom = e as CustomEvent<RealElementInfo | null>
      setSelectedElement(custom.detail || null)
    }
    window.addEventListener('pm:selected-element-changed', handleSelectedChange)
    return () => window.removeEventListener('pm:selected-element-changed', handleSelectedChange)
  }, [])

  const handleClearSelection = useCallback(() => {
    setSelectedElement(null)
    const iframe = (document.querySelector('iframe.canvas__iframe') ||
      document.querySelector('.canvas__frame iframe')) as HTMLIFrameElement | null
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'PM_CLEAR_MULTI_SELECTION' }, '*')
    }
  }, [])

  const loadProjectTokens = useCallback(async () => {
    if (!project?.path) return
    setTokensLoading(true)
    try {
      const data = await api.tokens.get(project.path)
      setTokens(data || DEFAULT_DESIGN_TOKENS)
    } catch {
      setTokens(DEFAULT_DESIGN_TOKENS)
    } finally {
      setTokensLoading(false)
    }
  }, [project?.path])

  useEffect(() => {
    if (activeTab === 'design') {
      loadProjectTokens()
    }
  }, [activeTab, loadProjectTokens])

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<DesignTokens>
      if (custom.detail) {
        setTokens(custom.detail)
      } else {
        loadProjectTokens()
      }
    }
    window.addEventListener('pm:tokens-updated', handler)
    return () => window.removeEventListener('pm:tokens-updated', handler)
  }, [loadProjectTokens])

  const handleCopyVar = (tokenType: 'color' | 'font' | 'spacing' | 'radius', id: string, extraNote?: string) => {
    const varName = tokenToCssVarName(tokenType, id)
    const textToCopy = `var(${varName})`
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedTokenId(id)
      onShowToast('ok', `Đã sao chép ${textToCopy}${extraNote ? ` (${extraNote})` : ''}`)
      setTimeout(() => setCopiedTokenId((prev) => (prev === id ? null : prev)), 1800)
    }).catch(() => {
      onShowToast('err', 'Không thể sao chép vào clipboard')
    })
  }

  const previewOriginalRef = useRef<{ prop: string; originalVal: string } | null>(null)

  const handleTokenMouseEnter = (
    tokenType: 'color' | 'font' | 'spacing' | 'radius',
    token: { id: string; name: string; value?: string; fontSize?: string; lineHeight?: string; fontWeight?: string; category?: string },
    explicitTarget?: string
  ) => {
    if (!selectedElement) return

    let prop = ''
    let val = ''

    if (tokenType === 'color') {
      let target = explicitTarget || colorApplyTarget
      if (!explicitTarget) {
        if (token.category === 'background' || token.id.includes('bg') || token.id.includes('surface')) {
          target = 'bg'
        } else if (token.id.includes('border')) {
          target = 'border'
        } else if (token.category === 'neutral' || token.id.includes('text')) {
          target = 'text'
        }
      }
      prop = target === 'bg' ? 'backgroundColor' : (target === 'text' ? 'color' : 'borderColor')
      val = token.value || ''
    } else if (tokenType === 'font') {
      prop = 'fontSize'
      val = token.fontSize || ''
    } else if (tokenType === 'spacing') {
      const target = explicitTarget || spacingApplyTarget
      prop = target === 'padding' ? 'padding' : (target === 'margin' ? 'margin' : 'gap')
      val = token.value || ''
    } else if (tokenType === 'radius') {
      prop = 'borderRadius'
      val = token.value || ''
    }

    if (!prop || !val) return

    // Lưu lại giá trị ban đầu nếu chưa lưu
    if (!previewOriginalRef.current) {
      const currentVal = (selectedElement.computedStyles as any)?.[prop] || ''
      previewOriginalRef.current = { prop, originalVal: currentVal }
    }

    // Gửi áp dụng tạm thời lên iframe để người dùng xem trước
    const iframe = (document.querySelector('iframe.canvas__iframe') ||
      document.querySelector('.canvas__frame iframe')) as HTMLIFrameElement | null
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        {
          type: 'PM_APPLY_STYLE',
          payload: {
            target: {
              tagName: selectedElement.tagName,
              id: selectedElement.id,
              className: selectedElement.className,
              domPath: (selectedElement as any).domPath,
              uid: selectedElement.uid,
              selector: selectedElement.selector,
            },
            styles: { [prop]: val },
          },
        },
        '*'
      )
    }
  }

  const handleTokenMouseLeave = () => {
    if (!selectedElement || !previewOriginalRef.current) return
    const { prop, originalVal } = previewOriginalRef.current
    previewOriginalRef.current = null

    // Hoàn nguyên lại style gốc trước khi hover
    const iframe = (document.querySelector('iframe.canvas__iframe') ||
      document.querySelector('.canvas__frame iframe')) as HTMLIFrameElement | null
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        {
          type: 'PM_APPLY_STYLE',
          payload: {
            target: {
              tagName: selectedElement.tagName,
              id: selectedElement.id,
              className: selectedElement.className,
              domPath: (selectedElement as any).domPath,
              uid: selectedElement.uid,
              selector: selectedElement.selector,
            },
            styles: { [prop]: originalVal },
          },
        },
        '*'
      )
    }
  }

  const applyTokenToElement = (
    tokenType: 'color' | 'font' | 'spacing' | 'radius',
    token: { id: string; name: string; value?: string; fontSize?: string; lineHeight?: string; fontWeight?: string; category?: string },
    explicitTarget?: string
  ) => {
    // Hủy bỏ biến preview để không bị hoàn nguyên khi mouseLeave
    previewOriginalRef.current = null
    const varName = tokenToCssVarName(tokenType, token.id)

    // Nếu CHƯA chọn phần tử nào trên Canvas: Tự động sao chép mã biến CSS và nhắc nhở
    if (!selectedElement) {
      const textToCopy = `var(${varName})`
      navigator.clipboard.writeText(textToCopy).then(() => {
        setCopiedTokenId(token.id)
        onShowToast('info', `Đã chép ${textToCopy} · Mẹo: Hãy nhấp chọn 1 phần tử trên Canvas để áp dụng trực tiếp!`)
        setTimeout(() => setCopiedTokenId((prev) => (prev === token.id ? null : prev)), 1800)
      }).catch(() => {
        onShowToast('err', 'Không thể sao chép vào clipboard')
      })
      return
    }

    let stylesToApply: Record<string, string> = {}
    let styleDescription = ''

    if (tokenType === 'color') {
      let target = explicitTarget || colorApplyTarget
      if (!explicitTarget) {
        if (token.category === 'background' || token.id.includes('bg') || token.id.includes('surface')) {
          target = 'bg'
        } else if (token.id.includes('border')) {
          target = 'border'
        } else if (token.category === 'neutral' || token.id.includes('text')) {
          target = 'text'
        }
      }

      const val = `var(${varName})`
      if (target === 'bg') {
        stylesToApply = { backgroundColor: val }
        styleDescription = `màu nền`
      } else if (target === 'text') {
        stylesToApply = { color: val }
        styleDescription = `màu chữ`
      } else {
        stylesToApply = { borderColor: val }
        styleDescription = `màu viền`
      }
    } else if (tokenType === 'font') {
      stylesToApply = {
        fontSize: `var(${varName})`,
        lineHeight: token.lineHeight || 'normal',
        ...(token.fontWeight ? { fontWeight: token.fontWeight } : {}),
      }
      styleDescription = `cỡ chữ ${token.fontSize || ''}`
    } else if (tokenType === 'spacing') {
      const target = explicitTarget || spacingApplyTarget
      const val = `var(${varName})`
      if (target === 'padding') {
        stylesToApply = { padding: val }
        styleDescription = `đệm (padding)`
      } else if (target === 'margin') {
        stylesToApply = { margin: val }
        styleDescription = `lề (margin)`
      } else {
        stylesToApply = { gap: val }
        styleDescription = `khoảng cách con (gap)`
      }
    } else if (tokenType === 'radius') {
      stylesToApply = { borderRadius: `var(${varName})` }
      styleDescription = `bo góc`
    }

    // 1. Phát sự kiện toàn cục để CanvasArea xử lý (ghi vào RAM buffer + hoàn tác Undo)
    window.dispatchEvent(
      new CustomEvent('pm:apply-token-style', {
        detail: {
          styles: stylesToApply,
          tokenName: token.name,
        },
      })
    )

    // 2. Gửi dự phòng trực tiếp vào iframe nếu có
    const iframe = (document.querySelector('iframe.canvas__iframe') ||
      document.querySelector('.canvas__frame iframe')) as HTMLIFrameElement | null
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        {
          type: 'PM_APPLY_STYLE',
          payload: {
            target: {
              tagName: selectedElement.tagName,
              id: selectedElement.id,
              className: selectedElement.className,
              domPath: (selectedElement as any).domPath,
              uid: selectedElement.uid,
              selector: selectedElement.selector,
            },
            styles: stylesToApply,
          },
        },
        '*'
      )
    }

    // 3. Phản hồi Toast & hiệu ứng UI
    setAppliedTokenId(token.id)
    const elTag = selectedElement.tagName.toLowerCase()
    onShowToast('ok', `✨ Đã áp dụng ${token.name} (${styleDescription}) cho <${elTag}>!`)
    setTimeout(() => setAppliedTokenId((prev) => (prev === token.id ? null : prev)), 1500)
  }

  // ── Nhận diện màu THẬT từ phần tử đang chọn trên DOM ──
  const elementRealColor = useMemo(() => {
    if (!selectedElement?.computedStyles) return null
    let rawColor = ''
    let label = ''
    if (colorApplyTarget === 'bg') {
      rawColor = selectedElement.computedStyles.backgroundColor || ''
      label = 'Màu nền'
      if (rawColor === 'rgba(0, 0, 0, 0)' || rawColor === 'transparent') {
        rawColor = selectedElement.computedStyles.color || ''
        label = 'Màu chữ'
      }
    } else if (colorApplyTarget === 'text') {
      rawColor = selectedElement.computedStyles.color || ''
      label = 'Màu chữ'
    } else {
      rawColor =
        selectedElement.computedStyles.borderColor ||
        (selectedElement.computedStyles as any).borderTopColor ||
        ''
      label = 'Màu viền'
    }

    const parsed = parseRgbOrHex(rawColor)
    if (!parsed.isValid) return null
    return {
      raw: rawColor,
      hex: parsed.hex,
      label,
    }
  }, [selectedElement, colorApplyTarget])

  const handleSaveDetectedColorAsToken = async () => {
    if (!elementRealColor || !project?.path || !tokens) return
    const cleanHex = elementRealColor.hex
    const tagName = selectedElement?.tagName?.toLowerCase() || 'el'
    const newId = `c_${tagName}_${Date.now().toString(36).slice(-4)}`
    const newName = `${tagName.toUpperCase()} ${cleanHex}`
    const newCategory =
      colorApplyTarget === 'bg'
        ? 'background'
        : colorApplyTarget === 'text'
        ? 'neutral'
        : 'brand'

    const newTokens: DesignTokens = {
      ...tokens,
      colors: [
        ...tokens.colors,
        { id: newId, name: newName, value: cleanHex, category: newCategory },
      ],
    }

    try {
      const res = await api.tokens.save({
        projectPath: project.path,
        tokens: newTokens,
        syncTarget: 'both',
      })
      if (res?.success) {
        setTokens(newTokens)
        window.dispatchEvent(new CustomEvent('pm:tokens-updated', { detail: newTokens }))
        onShowToast('ok', `✨ Đã lưu màu thật ${cleanHex} thành token "${newName}"!`)
      } else {
        onShowToast('err', `Lỗi lưu token: ${res?.error || 'Không xác định'}`)
      }
    } catch (err) {
      onShowToast('err', `Lỗi: ${(err as Error).message}`)
    }
  }

  const handleQuickUndo = () => {
    if (editorBuffer.canUndo()) {
      editorBuffer.undo()
      onShowToast('info', '↶ Đã hoàn tác thay đổi vừa áp dụng')
    } else {
      onShowToast('info', 'Chưa có thao tác nào để hoàn tác')
    }
  }

  const handleResetElementStyles = () => {
    if (!selectedElement) return
    const iframe = (document.querySelector('iframe.canvas__iframe') ||
      document.querySelector('.canvas__frame iframe')) as HTMLIFrameElement | null
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        {
          type: 'PM_APPLY_STYLE',
          payload: {
            target: {
              tagName: selectedElement.tagName,
              id: selectedElement.id,
              className: selectedElement.className,
              domPath: (selectedElement as any).domPath,
              uid: selectedElement.uid,
              selector: selectedElement.selector,
            },
            styles: {
              backgroundColor: '',
              color: '',
              borderColor: '',
              fontSize: '',
              padding: '',
              margin: '',
              gap: '',
              borderRadius: '',
            },
          },
        },
        '*'
      )
    }
    onShowToast('info', `✨ Đã đặt lại style mặc định cho <${selectedElement.tagName.toLowerCase()}>`)
  }

  const filteredColors = useMemo(() => {
    if (!tokens?.colors) return []
    const q = tokenSearch.trim().toLowerCase()
    return tokens.colors.filter((c) => {
      const matchCat = colorCategory === 'all' || c.category === colorCategory
      if (!matchCat) return false
      if (!q) return true
      const varName = tokenToCssVarName('color', c.id)
      return (
        c.name.toLowerCase().includes(q) ||
        c.value.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        varName.toLowerCase().includes(q)
      )
    })
  }, [tokens?.colors, colorCategory, tokenSearch])

  const filteredTypography = useMemo(() => {
    if (!tokens?.typography) return []
    const q = tokenSearch.trim().toLowerCase()
    return tokens.typography.filter((t) => {
      if (!q) return true
      const varName = tokenToCssVarName('font', t.id)
      return (
        t.name.toLowerCase().includes(q) ||
        t.fontSize.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        varName.toLowerCase().includes(q)
      )
    })
  }, [tokens?.typography, tokenSearch])

  const filteredSpacing = useMemo(() => {
    if (!tokens?.spacing) return []
    const q = tokenSearch.trim().toLowerCase()
    return tokens.spacing.filter((s) => {
      if (!q) return true
      const varName = tokenToCssVarName('spacing', s.id)
      return (
        s.name.toLowerCase().includes(q) ||
        s.value.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        varName.toLowerCase().includes(q)
      )
    })
  }, [tokens?.spacing, tokenSearch])

  const filteredRadius = useMemo(() => {
    if (!tokens?.radius) return []
    const q = tokenSearch.trim().toLowerCase()
    return tokens.radius.filter((r) => {
      if (!q) return true
      const varName = tokenToCssVarName('radius', r.id)
      return (
        r.name.toLowerCase().includes(q) ||
        r.value.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        varName.toLowerCase().includes(q)
      )
    })
  }, [tokens?.radius, tokenSearch])

  // ── Lắng nghe cây DOM thật phát ra từ iframe qua postMessage ──
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return
      if (e.data.type === 'PM_DOM_TREE') {
        const payload = e.data.payload
        if (Array.isArray(payload)) {
          setLiveLayers(payload)
          setIsLoadingLayers(false)
        }
      } else if (e.data.type === 'PM_SELECT_ELEMENT') {
        if (e.data.payload) {
          if (e.data.payload.uid) setSelectedLayerId(e.data.payload.uid)
          setSelectedElement(e.data.payload)
        }
      } else if (e.data.type === 'PM_CLEAR_MULTI_SELECTION') {
        setSelectedElement(null)
      } else if (e.data.type === 'PM_SELECTION_CHANGED') {
        if (e.data.payload?.primary) {
          setSelectedElement(e.data.payload.primary)
        } else if (Array.isArray(e.data.payload?.items) && e.data.payload.items.length === 0) {
          setSelectedElement(null)
        }
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const requestDomTree = useCallback(() => {
    setIsLoadingLayers(true)
    const iframe = document.querySelector('iframe.canvas__iframe') as HTMLIFrameElement | null
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'PM_GET_DOM_TREE' }, '*')
    }
    setTimeout(() => setIsLoadingLayers(false), 800)
  }, [])

  // Tự động yêu cầu iframe gửi DOM thật khi mở tab Phân cấp
  useEffect(() => {
    if (activeTab === 'layers') {
      requestDomTree()
    }
  }, [activeTab, requestDomTree])

  const handleSelectLayer = (layer: LayerNode) => {
    setSelectedLayerId(layer.id)
    const iframe = document.querySelector('iframe.canvas__iframe') as HTMLIFrameElement | null
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        { type: 'PM_SELECT_BY_UID', uid: layer.uid || layer.id, selector: layer.selector },
        '*'
      )
    }
    onShowToast('info', `Đã chọn phần tử “${layer.label}” (${layer.tag})`)
  }

  const handleHoverLayer = (layer: LayerNode | null) => {
    const iframe = document.querySelector('iframe.canvas__iframe') as HTMLIFrameElement | null
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        { type: 'PM_HOVER_BY_UID', uid: layer ? (layer.uid || layer.id) : null },
        '*'
      )
    }
  }

  const handleMoveDomNode = (action: 'up' | 'down' | 'outdent' | 'indent') => {
    if (!selectedLayerId) return
    const iframe = document.querySelector('iframe.canvas__iframe') as HTMLIFrameElement | null
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'PM_MOVE_DOM_NODE', action, uid: selectedLayerId }, '*')
    }
    const labels: Record<string, string> = {
      up: 'Di chuyển lên',
      down: 'Di chuyển xuống',
      outdent: 'Đưa ra ngoài thẻ cha',
      indent: 'Đưa vào trong thẻ trước',
    }
    onShowToast('ok', `Đã thực hiện: ${labels[action]}`)
  }

  const handleResetPosition = () => {
    if (!selectedLayerId) return
    const iframe = document.querySelector('iframe.canvas__iframe') as HTMLIFrameElement | null
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'PM_RESET_POSITION', uid: selectedLayerId }, '*')
    }
    onShowToast('ok', 'Đã đặt lại phần tử về vị trí tự nhiên trong khung cha!')
  }

  const handleMoveIntoLayer = (sourceUid: string, targetUid: string) => {
    const iframe = document.querySelector('iframe.canvas__iframe') as HTMLIFrameElement | null
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        { type: 'PM_MOVE_DOM_NODE', action: 'into', uid: sourceUid, targetUid },
        '*'
      )
      onShowToast('ok', 'Đã kéo thả phần tử vào trong khung đích!')
    }
  }

  /* ── Quét đệ quy cây thư mục để lọc ra các tệp hình ảnh (Assets) ── */
  const assets = useMemo(() => {
    const list: { name: string; path: string; size?: number }[] = []
    const imgExts = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif', '.ico']
    function traverse(nodes: FileNode[]) {
      for (const node of nodes) {
        if (node.type === 'file') {
          const lower = node.name.toLowerCase()
          if (imgExts.some((ext) => lower.endsWith(ext))) {
            list.push({ name: node.name, path: node.path, size: node.size })
          }
        } else if (node.children) {
          traverse(node.children)
        }
      }
    }
    traverse(tree)
    return list
  }, [tree])

  /* ── Thumbnail thật: đọc tối đa 3 ảnh song song, cache theo đường dẫn ── */
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({})
  const thumbnailsRef = useRef<Record<string, string>>({})
  const thumbGenerationRef = useRef(0)

  /* ── Undo/Redo cho thao tác Thêm/Xoá ảnh (chỉ trong phiên hiện tại) ── */
  const [undoStack, setUndoStack] = useState<AssetHistoryEntry[]>([])
  const [redoStack, setRedoStack] = useState<AssetHistoryEntry[]>([])
  const [historyBusy, setHistoryBusy] = useState(false)

  // Đổi dự án thì bỏ lịch sử để tránh hoàn tác nhầm sang tệp của dự án khác.
  useEffect(() => {
    setUndoStack([])
    setRedoStack([])
    setHistoryBusy(false)
  }, [project.id])

  const pushAssetHistory = (entry: AssetHistoryEntry) => {
    setUndoStack((prev) => [...prev.slice(-(MAX_ASSET_HISTORY - 1)), entry])
    setRedoStack([])
  }

  useEffect(() => {
    if (activeTab !== 'assets') return
    const generation = ++thumbGenerationRef.current
    const pending = assets.filter((asset) => !thumbnailsRef.current[asset.path])
    if (pending.length === 0) return

    const queue = [...pending]
    const loadOne = async () => {
      while (queue.length > 0) {
        const asset = queue.shift()
        if (!asset) return
        try {
          const file = await api.fs.read(asset.path)
          const dataUrl = fileToDataUrl(file, asset.name)
          if (!dataUrl) continue
          thumbnailsRef.current[asset.path] = dataUrl
          if (thumbGenerationRef.current === generation) {
            setThumbnails((prev) => (prev[asset.path] ? prev : { ...prev, [asset.path]: dataUrl }))
          }
        } catch {
          /* Ảnh lỗi hoặc quá lớn: giữ fallback icon, không chặn các ảnh khác. */
        }
      }
    }

    const workers = Array.from({ length: Math.min(3, queue.length) }, () => loadOne())
    void Promise.all(workers)
    return () => {
      if (thumbGenerationRef.current === generation) thumbGenerationRef.current += 1
    }
  }, [activeTab, assets])

  const handleRefreshAssets = () => {
    thumbGenerationRef.current += 1
    thumbnailsRef.current = {}
    setThumbnails({})
    onRefresh()
  }

  const handleSelectAsset = async (asset: { name: string; path: string; size?: number }) => {
    const cached = thumbnailsRef.current[asset.path] ?? thumbnails[asset.path]
    if (cached) {
      onSelectReference?.({ name: asset.name, path: asset.path, size: asset.size ?? 0, dataUrl: cached })
      onOpenPreview?.()
      return
    }
    try {
      const file = await api.fs.read(asset.path)
      const dataUrl = fileToDataUrl(file, asset.name)
      if (!dataUrl) {
        onShowToast('err', `Không đọc được ảnh “${asset.name}” (có thể lớn hơn 8MB).`)
        return
      }
      thumbnailsRef.current[asset.path] = dataUrl
      setThumbnails((prev) => ({ ...prev, [asset.path]: dataUrl }))
      onSelectReference?.({ name: asset.name, path: asset.path, size: asset.size ?? 0, dataUrl })
      onOpenPreview?.()
    } catch {
      onShowToast('err', `Không đọc được ảnh “${asset.name}”.`)
    }
  }

  const handleAddImages = async () => {
    try {
      const result = await api.assets.add(project.path)
      if (result.canceled) return
      if (result.error) {
        onShowToast('err', `Không thêm được ảnh: ${result.error}`)
        return
      }
      const copied = result.added.filter((item) => item.copied)
      if (result.added.length === 0) return
      if (copied.length === 0) {
        onShowToast('info', 'Ảnh đã có sẵn trong thư mục assets/ của dự án.')
        handleRefreshAssets()
        return
      }
      pushAssetHistory({
        kind: 'add',
        label:
          copied.length === 1
            ? `thêm “${copied[0].destination.split(/[\\/]/).pop() ?? 'ảnh'}”`
            : `thêm ${copied.length} ảnh`,
        items: copied.map((item) => ({ source: item.source, destination: item.destination })),
      })
      onShowToast('ok', `Đã thêm ${copied.length} ảnh vào thư mục assets/ của dự án.`)
      handleRefreshAssets()
    } catch {
      onShowToast('err', 'Không thêm được ảnh vào dự án.')
    }
  }

  const handleDeleteImage = async (asset: { name: string; path: string }) => {
    const confirmed = window.confirm(`Chuyển ảnh “${asset.name}” vào Thùng rác?`)
    if (!confirmed) return
    try {
      const result = await api.assets.remove(asset.path)
      if (!result.success) {
        onShowToast('err', `Không xoá được ảnh: ${result.error ?? 'lỗi không xác định'}`)
        return
      }
      delete thumbnailsRef.current[asset.path]
      setThumbnails((prev) => {
        if (!prev[asset.path]) return prev
        const next = { ...prev }
        delete next[asset.path]
        return next
      })
      if (referenceAssetPath === asset.path) onClearReference?.()
      pushAssetHistory({
        kind: 'remove',
        label: `xoá “${asset.name}”`,
        path: asset.path,
        backupPath: result.backupPath ?? '',
      })
      onShowToast('ok', `Đã chuyển “${asset.name}” vào Thùng rác.`)
      onRefresh()
    } catch {
      onShowToast('err', `Không xoá được ảnh “${asset.name}”.`)
    }
  }

  /* ── Hoàn tác: thêm ảnh → đưa ảnh vào Thùng rác; xoá ảnh → khôi phục từ bản sao lưu ── */
  const handleUndoAsset = async () => {
    if (historyBusy) return
    const entry = undoStack[undoStack.length - 1]
    if (!entry) return
    setHistoryBusy(true)
    try {
      if (entry.kind === 'add') {
        const redoItems: AssetHistoryItem[] = []
        for (const item of entry.items) {
          const result = await api.assets.remove(item.destination)
          if (result.success && result.backupPath) {
            redoItems.push({ ...item, backupPath: result.backupPath })
          }
        }
        if (redoItems.length === 0) {
          throw new Error('Không thể hoàn tác thao tác thêm ảnh.')
        }
        if (referenceAssetPath && entry.items.some((item) => item.destination === referenceAssetPath)) {
          onClearReference?.()
        }
        setUndoStack((prev) => prev.slice(0, -1))
        setRedoStack((prev) => [...prev, { ...entry, items: redoItems }])
        onShowToast(
          redoItems.length === entry.items.length ? 'ok' : 'err',
          redoItems.length === entry.items.length
            ? `Đã hoàn tác thao tác ${entry.label}.`
            : `Chỉ hoàn tác được ${redoItems.length}/${entry.items.length} ảnh đã thêm.`,
        )
      } else {
        if (!entry.backupPath) throw new Error('Không tìm thấy bản sao lưu của ảnh.')
        const result = await api.assets.restore(entry.backupPath, entry.path)
        if (!result.success) throw new Error(result.error ?? 'Không thể khôi phục ảnh.')
        setUndoStack((prev) => prev.slice(0, -1))
        setRedoStack((prev) => [...prev, { ...entry, path: result.path ?? entry.path }])
        onShowToast('ok', `Đã hoàn tác thao tác ${entry.label}.`)
      }
      handleRefreshAssets()
    } catch (error) {
      onShowToast('err', error instanceof Error ? error.message : 'Không thể hoàn tác.')
    } finally {
      setHistoryBusy(false)
    }
  }

  /* ── Làm lại: thêm ảnh → khôi phục ảnh đã hoàn tác; xoá ảnh → đưa vào Thùng rác lần nữa ── */
  const handleRedoAsset = async () => {
    if (historyBusy) return
    const entry = redoStack[redoStack.length - 1]
    if (!entry) return
    setHistoryBusy(true)
    try {
      if (entry.kind === 'add') {
        const undoItems: AssetHistoryItem[] = []
        for (const item of entry.items) {
          if (!item.backupPath) continue
          const result = await api.assets.restore(item.backupPath, item.destination)
          if (result.success) {
            undoItems.push({ ...item, destination: result.path ?? item.destination })
          }
        }
        if (undoItems.length === 0) {
          throw new Error('Không thể làm lại thao tác thêm ảnh.')
        }
        setRedoStack((prev) => prev.slice(0, -1))
        setUndoStack((prev) => [...prev, { ...entry, items: undoItems }])
        onShowToast(
          undoItems.length === entry.items.length ? 'ok' : 'err',
          undoItems.length === entry.items.length
            ? `Đã làm lại thao tác ${entry.label}.`
            : `Chỉ làm lại được ${undoItems.length}/${entry.items.length} ảnh.`,
        )
      } else {
        const result = await api.assets.remove(entry.path)
        if (!result.success || !result.backupPath) {
          throw new Error(result.error ?? 'Không thể xoá lại ảnh.')
        }
        if (referenceAssetPath === entry.path) onClearReference?.()
        setRedoStack((prev) => prev.slice(0, -1))
        setUndoStack((prev) => [...prev, { ...entry, backupPath: result.backupPath! }])
        onShowToast('ok', `Đã làm lại thao tác ${entry.label}.`)
      }
      handleRefreshAssets()
    } catch (error) {
      onShowToast('err', error instanceof Error ? error.message : 'Không thể làm lại.')
    } finally {
      setHistoryBusy(false)
    }
  }

  /* ── Ctrl+Z / Ctrl+Y khi đang thao tác trong panel Assets ── */
  const handleAssetsKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (activeTab !== 'assets' || historyBusy) return
    if (!event.ctrlKey && !event.metaKey) return
    const target = event.target as HTMLElement | null
    if (
      target &&
      (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
    ) {
      return
    }
    const key = event.key.toLowerCase()
    if (key === 'z' && !event.shiftKey && undoStack.length > 0) {
      event.preventDefault()
      event.stopPropagation()
      void handleUndoAsset()
    } else if ((key === 'y' || (key === 'z' && event.shiftKey)) && redoStack.length > 0) {
      event.preventDefault()
      event.stopPropagation()
      void handleRedoAsset()
    }
  }

  /* ── Lọc Layers theo từ khoá ── */
  const filteredLayers = useMemo(() => {
    if (!layersSearch.trim()) return liveLayers
    const q = layersSearch.toLowerCase()
    return liveLayers.filter(
      (l) => l.label.toLowerCase().includes(q) || l.tag.toLowerCase().includes(q) || l.tagName?.toLowerCase().includes(q)
    )
  }, [liveLayers, layersSearch])

  /* ── Cây phân cấp Route (1/ = Tầng 1, 2// = Tầng 2, ...) ── */
  const routeTree = useMemo(() => {
    const allPages = project.meta?.pages || []
    const tree = buildRouteTree(allPages)
    if (pagesSearch.trim()) {
      return filterRouteTree(tree, pagesSearch.trim())
    }
    return tree
  }, [project.meta?.pages, pagesSearch])

  /* ── Hàm render đệ quy từng nút phân cấp Route ── */
  const renderRouteNode = (node: RouteTreeNode): React.ReactNode => {
    const hasChildren = node.children.length > 0
    const isCollapsed = !pagesSearch.trim() && Boolean(collapsedGroups[node.key])
    const page = node.page
    const dynamic = page ? isDynamicRoute(page) : false
    const isActive =
      page &&
      (currentRoute === page.route ||
        (currentRoute && page.route !== '/' && currentRoute.startsWith(page.route)))

    const title = page?.title || (node.path === '/' ? 'Trang chủ' : node.segment)
    const isVirtualContainer = !page

    return (
      <div key={node.key} className="pm-page-node">
        <div
          className={`pm-page-node__row ${isActive ? 'active' : ''} ${isVirtualContainer ? 'container' : ''}`}
          onClick={() => {
            if (isVirtualContainer) {
              togglePageGroup(node.key)
            } else if (page) {
              if (dynamic && onOpenParamChooser) {
                onOpenParamChooser(page)
              } else {
                onOpenPage(page.route)
              }
            }
          }}
          title={
            isVirtualContainer
              ? `Thư mục ${node.path} (${node.children.length} trang con) — Bấm để ${isCollapsed ? 'mở' : 'thu gọn'}`
              : dynamic
                ? `Trang động cần ID (${page.route}) — Bấm để chọn mục xem trước`
                : `Xem trước trang ${page.route}`
          }
        >
          {/* Mũi tên gập/mở nếu có trang con */}
          {hasChildren ? (
            <span
              className={`pm-page-node__toggle ${isCollapsed ? 'collapsed' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                togglePageGroup(node.key)
              }}
              title={isCollapsed ? 'Mở rộng trang con' : 'Thu gọn trang con'}
            >
              <ChevronDown size={13} />
            </span>
          ) : (
            <span style={{ width: 14, flexShrink: 0 }} />
          )}

          {/* Icon */}
          {isVirtualContainer ? (
            isCollapsed ? (
              <Folder size={13} className="pm-muted" style={{ flexShrink: 0 }} />
            ) : (
              <FolderOpen size={13} className="pm-accent" style={{ flexShrink: 0 }} />
            )
          ) : (
            <FileCode2
              size={13}
              className={isActive ? 'pm-accent' : 'pm-muted'}
              style={{ flexShrink: 0 }}
            />
          )}

          {/* Tiêu đề & route */}
          <div className="pm-page-node__content">
            <div className="pm-page-node__title">
              {title}
              {hasChildren && <span className="pm-page-node__count">{node.children.length}</span>}
            </div>
            <div className="pm-page-node__route">{node.path}</div>

            {page?.navLinkSelector && (
              <div className="pm-page-card__badge" title={`Nút liên kết: ${page.navLinkSelector}`}>
                <Link size={9} /> {page.navLinkSelector}
              </div>
            )}
            {dynamic && page?.sampleParams && page.sampleParams.length > 0 && (
              <div
                className="pm-page-card__badge"
                style={{ background: 'rgba(234, 179, 8, 0.12)', color: '#eab308' }}
              >
                <Hash size={9} /> {page.sampleParams.length} ID mẫu
              </div>
            )}
          </div>

          {/* Nút thao tác: Chọn ID, Sửa, Xoá */}
          {page && (
            <div className="pm-page-node__actions">
              {dynamic && (
                <button
                  className="pm-page-card__btn"
                  title="Chọn ID / Tham số xem trước"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenParamChooser?.(page)
                  }}
                >
                  <Hash size={12} />
                </button>
              )}
              {onDuplicatePage && (
                <button
                  className="pm-page-card__btn"
                  title="Nhân bản trang này (route mới / sao chép tệp)"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDuplicatePage(page)
                  }}
                >
                  <Copy size={11} />
                </button>
              )}
              {onEditPage && (
                <button
                  className="pm-page-card__btn"
                  title="Sửa thông tin & liên kết trang này"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEditPage(page)
                  }}
                >
                  <Pencil size={11} />
                </button>
              )}
              {onDeletePage && (
                <button
                  className="pm-page-card__btn danger"
                  title={page.filePath ? 'Xoá trang (có tuỳ chọn chuyển tệp vào Thùng rác)' : 'Xoá trang khỏi danh sách'}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeletePage(page)
                  }}
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Các trang con đệ quy (Tầng 2, 3...) */}
        {hasChildren && !isCollapsed && (
          <div className="pm-page-node__children">
            {node.children.map((child) => renderRouteNode(child))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="pm-ws-sidebar"
      tabIndex={-1}
      onKeyDown={handleAssetsKeyDown}
    >
      {/* ── 1. Activity Bar (Dải Icon 7 Tab bên lề trái) ── */}
      <div className="pm-ws-activity-bar" aria-label="Thanh công cụ bên">
        <button
          className={`pm-ws-tab-btn ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => onActiveTabChange('files')}
          title="Tệp mã nguồn (Ctrl+Shift+E)"
        >
          <FolderTree size={16} />
        </button>

        <button
          className={`pm-ws-tab-btn ${activeTab === 'layers' ? 'active' : ''}`}
          onClick={() => onActiveTabChange('layers')}
          title="Cây phân cấp các lớp (Layers · Ctrl+Shift+L)"
        >
          <Layers size={16} />
        </button>

        <button
          className={`pm-ws-tab-btn ${activeTab === 'pages' ? 'active' : ''}`}
          onClick={() => onActiveTabChange('pages')}
          title="Danh sách trang (Pages)"
        >
          <FileText size={16} />
        </button>

        <button
          className={`pm-ws-tab-btn ${activeTab === 'assets' ? 'active' : ''}`}
          onClick={() => onActiveTabChange('assets')}
          title="Tài nguyên hình ảnh & Ảnh mẫu (Assets)"
        >
          <ImageIcon size={16} />
        </button>

        <button
          className={`pm-ws-tab-btn ${activeTab === 'versions' ? 'active' : ''}`}
          onClick={() => onActiveTabChange('versions')}
          title="Lịch sử phiên bản & Git (Versions)"
        >
          <History size={16} />
        </button>

        <button
          className={`pm-ws-tab-btn ${activeTab === 'design' ? 'active' : ''}`}
          onClick={() => onActiveTabChange('design')}
          title="Hệ thống thiết kế (Design Tokens)"
        >
          <Palette size={16} />
        </button>

        <button
          className={`pm-ws-tab-btn ${activeTab === 'toolbox' ? 'active' : ''}`}
          onClick={() => onActiveTabChange('toolbox')}
          title="Hộp công cụ — thêm/sửa/xoá phần tử (Ctrl+Alt+X)"
        >
          <Boxes size={16} />
        </button>

        <div className="pm-ws-activity-grow" />

        {/* Nút thu gọn / ẩn Sidebar */}
        <button
          className="pm-ws-tab-btn"
          onClick={onCloseSidebar}
          title="Thu gọn thanh bên (Ctrl+B)"
        >
          <PanelLeftClose size={15} />
        </button>
      </div>

      {/* ── 2. Panel Nội dung chi tiết của Tab được chọn ── */}
      <div className="pm-ws-panel-content">
        {/* TAB 1: FILES (Tệp) */}
        {activeTab === 'files' && (
          <>
            <div className="pm-ws-hd">
              <span className="pm-ws-hd__title">
                <FolderTree size={13} /> Tệp mã nguồn
              </span>
              <div className="pm-ws-hd__actions">
                <button
                  className="pm-ibtn"
                  onClick={() => setFileHeaderDialog('new-file')}
                  title="Tạo tệp mới ở thư mục gốc"
                >
                  <FilePlus2 size={12} />
                </button>
                <button
                  className="pm-ibtn"
                  onClick={() => setFileHeaderDialog('new-folder')}
                  title="Tạo thư mục mới ở thư mục gốc"
                >
                  <FolderPlus size={12} />
                </button>
                <button className="pm-ibtn" onClick={onRefresh} title="Tải lại cây tệp (Ctrl+R)">
                  <RefreshCw size={12} />
                </button>
                <button className="pm-ibtn" onClick={onOpenFolder} title="Mở thư mục khác (Ctrl+O)">
                  <FolderOpen size={12} />
                </button>
              </div>
            </div>

            <div className="pm-ws-filter" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Chế độ tìm kiếm: Tên tệp / Nội dung toàn văn bản */}
              <div className="pm-file-search-modes">
                <button
                  className={`pm-file-search-mode-btn ${fileSearchMode === 'name' ? 'on' : ''}`}
                  onClick={() => setFileSearchMode('name')}
                  title="Lọc theo tên tệp trong cây thư mục"
                >
                  <FileText size={11} />
                  <span>Tên tệp</span>
                </button>
                <button
                  className={`pm-file-search-mode-btn ${fileSearchMode === 'content' ? 'on' : ''}`}
                  onClick={() => setFileSearchMode('content')}
                  title="Tìm kiếm văn bản trong nội dung toàn bộ tệp dự án (Grep)"
                >
                  <Search size={11} />
                  <span>Nội dung</span>
                </button>
              </div>

              {fileSearchMode === 'name' ? (
                <div className="pm-searchbox" style={{ width: '100%' }}>
                  <Search size={12} />
                  <input
                    value={query}
                    placeholder="Lọc theo tên tệp…"
                    style={{ width: '100%' }}
                    onChange={(e) => onQuery(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                  {query && (
                    <button className="pm-searchbox__clear" onClick={() => onQuery('')}>
                      <X size={11} />
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div className="pm-searchbox" style={{ width: '100%' }}>
                    <Search size={12} />
                    <input
                      value={contentQuery}
                      placeholder="Tìm chuỗi trong toàn bộ tệp…"
                      style={{ width: '100%' }}
                      onChange={(e) => setContentQuery(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation()
                        if (e.key === 'Enter') void handleContentSearch(contentQuery)
                      }}
                    />
                    {isSearchingContent ? (
                      <Loader2 size={11} className="spin" />
                    ) : contentQuery ? (
                      <button className="pm-searchbox__clear" onClick={() => setContentQuery('')}>
                        <X size={11} />
                      </button>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-3)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={caseSensitive}
                        onChange={(e) => {
                          setCaseSensitive(e.target.checked)
                          void handleContentSearch(contentQuery, e.target.checked)
                        }}
                      />
                      <span>Khớp chữ hoa/thường (Aa)</span>
                    </label>
                    {contentMatches.length > 0 && (
                      <span style={{ fontSize: 10, color: 'var(--accent)' }}>
                        {contentMatches.length} kết quả
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pm-ws-bd">
              {fileSearchMode === 'content' ? (
                <div className="pm-content-search-results">
                  {isSearchingContent ? (
                    <div className="pm-row pm-muted" style={{ padding: 16, gap: 8, fontSize: 11.5 }}>
                      <Loader2 size={13} className="spin" /> Đang tìm kiếm trong các tệp…
                    </div>
                  ) : !contentQuery.trim() ? (
                    <div className="pm-hint" style={{ padding: '20px 14px', lineHeight: 1.6 }}>
                      Nhập từ khóa hoặc chuỗi cần tìm trong mã nguồn toàn bộ dự án (nhấn Enter hoặc chờ tự động tìm).
                    </div>
                  ) : groupedContentMatches.length === 0 ? (
                    <div className="pm-hint" style={{ padding: '20px 14px' }}>
                      Không tìm thấy kết quả nào chứa "{contentQuery}".
                    </div>
                  ) : (
                    groupedContentMatches.map((item) => (
                      <div key={item.file} className="pm-search-file-group">
                        <div
                          className="pm-search-file-hd"
                          onClick={() => {
                            onSelectFile(
                              {
                                path: item.fullPath,
                                name: item.name,
                                ext: item.ext,
                                type: 'file',
                                size: 0,
                              },
                              item.matches[0]?.line,
                            )
                          }}
                          title={item.file}
                        >
                          <FileCode2 size={12} className="pm-search-file-ico" />
                          <span className="pm-search-file-name">{item.name}</span>
                          <span className="pm-search-file-dir">
                            {item.file.includes('/') || item.file.includes('\\')
                              ? item.file.split(/[\\/]/).slice(0, -1).join('/')
                              : ''}
                          </span>
                          <span className="pm-badge" style={{ fontSize: 9, padding: '0 4px', height: 16 }}>
                            {item.matches.length}
                          </span>
                        </div>
                        <div className="pm-search-match-list">
                          {item.matches.map((m, idx) => (
                            <div
                              key={`${m.line}-${idx}`}
                              className="pm-search-match-row"
                              onClick={() => {
                                onSelectFile(
                                  {
                                    path: m.fullPath,
                                    name: item.name,
                                    ext: item.ext,
                                    type: 'file',
                                    size: 0,
                                  },
                                  m.line,
                                )
                              }}
                              title={`Dòng ${m.line}: ${m.preview}`}
                            >
                              <span className="pm-search-match-ln">{m.line}:</span>
                              <span className="pm-search-match-text">{m.preview}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : treeLoading ? (
                <div className="pm-row pm-muted" style={{ padding: 12, gap: 7, fontSize: 11.5 }}>
                  <Loader2 size={12} className="spin" /> Đang đọc thư mục…
                </div>
              ) : (
                <FileTree
                  nodes={tree}
                  rootPath={project.path}
                  selectedPath={selectedPath}
                  query={query}
                  onSelect={onSelectFile}
                  onRefresh={onRefresh}
                  onShowToast={onShowToast}
                />
              )}
            </div>

            {fileHeaderDialog && (
              <FileActionDialog
                action={fileHeaderDialog}
                targetNode={null}
                rootPath={project.path}
                onClose={() => setFileHeaderDialog(null)}
                onSuccess={(msg) => onShowToast('ok', msg)}
                onRefresh={onRefresh}
              />
            )}
          </>
        )}

        {/* TAB 2: LAYERS (Lớp / DOM Tree) */}
        {activeTab === 'layers' && (
          <>
            <div className="pm-ws-hd">
              <span className="pm-ws-hd__title" title="Phân cấp phần tử">
                <Layers size={13} />
              </span>
              <div className="pm-ws-hd__actions">
                {selectedLayerId && (
                  <>
                    <button
                      className="pm-ibtn"
                      onClick={() => handleMoveDomNode('up')}
                      title="Di chuyển lên trước thẻ anh em (▲ Lên)"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      className="pm-ibtn"
                      onClick={() => handleMoveDomNode('down')}
                      title="Di chuyển xuống sau thẻ anh em (▼ Xuống)"
                    >
                      <ArrowDown size={12} />
                    </button>
                    <button
                      className="pm-ibtn"
                      onClick={() => handleMoveDomNode('outdent')}
                      title="Đưa ra ngoài thẻ cha (◀ Ra ngoài)"
                    >
                      <ArrowLeft size={12} />
                    </button>
                    <button
                      className="pm-ibtn"
                      onClick={() => handleMoveDomNode('indent')}
                      title="Đưa vào trong thẻ trước (▶ Vào trong)"
                    >
                      <ArrowRight size={12} />
                    </button>
                    <button
                      className="pm-ibtn"
                      onClick={handleResetPosition}
                      title="Đặt lại vị trí tự nhiên (↺)"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </>
                )}
                <button
                  className="pm-ibtn"
                  onClick={() => {
                    requestDomTree()
                    onShowToast('info', 'Đang quét lại cây phân cấp phần tử DOM...')
                  }}
                  title="Làm mới phân cấp DOM"
                >
                  <RefreshCw size={12} className={isLoadingLayers ? 'pm-spin' : ''} />
                </button>
              </div>
            </div>

            <div className="pm-ws-filter">
              <div className="pm-searchbox" style={{ width: '100%' }}>
                <Search size={12} />
                <input
                  value={layersSearch}
                  placeholder="Lọc phần tử (header, h1, btn, div…)…"
                  style={{ width: '100%' }}
                  onChange={(e) => setLayersSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            <div className="pm-ws-bd">
              {isLoadingLayers && liveLayers.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)' }}>
                  <RefreshCw size={20} className="pm-spin" style={{ margin: '0 auto 10px', display: 'block' }} />
                  <div style={{ fontSize: 12 }}>Đang quét cây phần tử DOM thật từ trang web...</div>
                </div>
              ) : liveLayers.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                  <Layers size={28} style={{ opacity: 0.35, margin: '0 auto 10px', display: 'block' }} />
                  <div style={{ fontSize: 13, fontWeight: 650, marginBottom: 4 }}>
                    Chưa có phần tử DOM trực tiếp
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 14 }}>
                    {isRunning
                      ? 'Trang web đang tải hoặc chưa nạp xong. Bấm nút Quét lại để cập nhật.'
                      : 'Khởi động máy chủ phát triển (F5) để quét toàn bộ cây phân cấp HTML thật của trang web.'}
                  </p>
                  {!isRunning && onRun && (
                    <button
                      className="btn primary"
                      onClick={onRun}
                      style={{
                        fontSize: 12,
                        padding: '6px 14px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        margin: '0 auto',
                        cursor: 'pointer',
                      }}
                    >
                      <Play size={12} /> Chạy dự án
                    </button>
                  )}
                  {isRunning && (
                    <button
                      className="btn secondary"
                      onClick={requestDomTree}
                      style={{
                        fontSize: 12,
                        padding: '6px 14px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        margin: '0 auto',
                        cursor: 'pointer',
                      }}
                    >
                      <RefreshCw size={12} /> Quét lại phân cấp
                    </button>
                  )}
                </div>
              ) : (
                <div className="pm-layers-list">
                  {filteredLayers.map((layer) => {
                    const Icon = getTagIcon(layer.tagName)
                    const isSelected = selectedLayerId === layer.id
                    const isDragOver = dragOverLayerId === layer.id
                    const isDragging = draggingLayerId === layer.id
                    return (
                      <div
                        key={layer.id}
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', layer.uid || layer.id)
                          setDraggingLayerId(layer.id)
                        }}
                        onDragEnd={() => {
                          setDraggingLayerId(null)
                          setDragOverLayerId(null)
                        }}
                        onDragOver={(e) => {
                          e.preventDefault()
                          if (draggingLayerId && draggingLayerId !== layer.id) {
                            e.dataTransfer.dropEffect = 'move'
                            if (dragOverLayerId !== layer.id) setDragOverLayerId(layer.id)
                          }
                        }}
                        onDragLeave={() => {
                          if (dragOverLayerId === layer.id) setDragOverLayerId(null)
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          const sourceUid = e.dataTransfer.getData('text/plain')
                          setDragOverLayerId(null)
                          setDraggingLayerId(null)
                          if (sourceUid && sourceUid !== (layer.uid || layer.id)) {
                            handleMoveIntoLayer(sourceUid, layer.uid || layer.id)
                          }
                        }}
                        className={`pm-layer-item ${isSelected ? 'selected' : ''}`}
                        style={{
                          paddingLeft: `${8 + layer.depth * 12}px`,
                          opacity: isDragging ? 0.35 : 1,
                          border: isDragOver ? '1.5px dashed #6366f1' : undefined,
                          background: isDragOver ? 'rgba(99, 102, 241, 0.18)' : undefined,
                          cursor: 'grab',
                          transition: 'background 0.1s, border 0.1s',
                        }}
                        onClick={() => handleSelectLayer(layer)}
                        onMouseEnter={() => handleHoverLayer(layer)}
                        onMouseLeave={() => handleHoverLayer(null)}
                        title={`Bấm để chọn, hoặc kéo thả để đưa vào khung khác (${layer.tag})`}
                      >
                        <Icon size={12} style={{ opacity: 0.7, flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {layer.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* TAB 3: PAGES (Danh sách trang) */}
        {activeTab === 'pages' && (
          <>
            <div className="pm-ws-hd">
              <span className="pm-ws-hd__title">
                <FileText size={13} /> Trang dự án
              </span>
              <div className="pm-ws-hd__actions">
                <button className="pm-ibtn" onClick={onAddPage} title="Thêm trang mới">
                  <Plus size={13} />
                </button>
              </div>
            </div>

            <div className="pm-ws-filter">
              <div className="pm-searchbox" style={{ width: '100%' }}>
                <Search size={12} />
                <input
                  value={pagesSearch}
                  placeholder="Tìm kiếm trang (ví dụ: product, delete, /)..."
                  style={{ width: '100%' }}
                  onChange={(e) => setPagesSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                />
                {pagesSearch && (
                  <button
                    className="pm-searchbox__clear"
                    onClick={() => setPagesSearch('')}
                    title="Xoá tìm kiếm"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>

            <div className="pm-ws-bd">
              <div className="pm-pages-list">
                {routeTree.length > 0 ? (
                  <div className="pm-page-tree">
                    {routeTree.map((rootNode) => renderRouteNode(rootNode))}
                  </div>
                ) : (
                  <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
                    {pagesSearch ? (
                      <>
                        <div>Không tìm thấy trang nào khớp với &quot;{pagesSearch}&quot;</div>
                        <button
                          className="btn secondary"
                          onClick={() => setPagesSearch('')}
                          style={{ fontSize: 11, padding: '4px 10px', marginTop: 8 }}
                        >
                          Xoá bộ lọc
                        </button>
                      </>
                    ) : (
                      <>
                        <div
                          className="pm-page-card active"
                          onClick={() => onOpenPage('/')}
                          title="Trang chủ /"
                        >
                          <FileCode2 size={14} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="pm-page-card__title">Trang chủ (Home)</div>
                            <div className="pm-page-card__route">/</div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <button
                className="btn secondary"
                onClick={onAddPage}
                style={{ marginTop: 8, width: '100%', fontSize: 11.5, gap: 5 }}
              >
                <Plus size={12} /> Thêm trang mới…
              </button>
            </div>
          </>
        )}

        {/* TAB 4: ASSETS (Tài nguyên hình ảnh) */}
        {activeTab === 'assets' && (
          <>
            <div className="pm-ws-hd">
              <span className="pm-ws-hd__title">
                <ImageIcon size={13} /> Tài nguyên & Ảnh mẫu
              </span>
              <div className="pm-ws-hd__actions">
                <button
                  className="pm-ibtn"
                  onClick={() => void handleUndoAsset()}
                  disabled={undoStack.length === 0 || historyBusy}
                  title={
                    undoStack.length > 0
                      ? `Hoàn tác ${undoStack[undoStack.length - 1].label} (Ctrl+Z)`
                      : 'Không có thao tác nào để hoàn tác'
                  }
                >
                  <Undo2 size={12} />
                </button>
                <button
                  className="pm-ibtn"
                  onClick={() => void handleRedoAsset()}
                  disabled={redoStack.length === 0 || historyBusy}
                  title={
                    redoStack.length > 0
                      ? `Làm lại ${redoStack[redoStack.length - 1].label} (Ctrl+Y)`
                      : 'Không có thao tác nào để làm lại'
                  }
                >
                  <Redo2 size={12} />
                </button>
                {referenceAssetPath && onClearReference && (
                  <button
                    className="pm-ibtn"
                    onClick={onClearReference}
                    title="Bỏ ảnh mẫu đang chọn"
                  >
                    <X size={12} />
                  </button>
                )}
                <button
                  className="pm-ibtn"
                  onClick={handleRefreshAssets}
                  title="Quét lại tài nguyên"
                >
                  <RefreshCw size={12} />
                </button>
              </div>
            </div>

            <div className="pm-ws-bd">
              {referenceAssetPath && (
                <div className="pm-asset-active-hint">
                  <Check size={12} />
                  <span>Đang dùng ảnh mẫu. Bấm Ảnh mẫu trên Canvas để xem.</span>
                </div>
              )}
              <div className="pm-asset-toolbar">
                <button
                  className="pm-asset-add"
                  onClick={() => void handleAddImages()}
                  title="Chọn ảnh từ máy tính để copy vào thư mục assets/ của dự án"
                >
                  <Plus size={13} />
                  <span>Thêm ảnh từ máy tính</span>
                </button>
              </div>
              {assets.length === 0 ? (
                <div className="pm-empty" style={{ padding: '24px 12px', border: 0 }}>
                  <ImageIcon size={22} className="pm-muted" />
                  <p style={{ fontSize: 11.5, marginTop: 6 }}>
                    Chưa có ảnh nào trong dự án.
                  </p>
                  <p className="pm-muted" style={{ fontSize: 10.5 }}>
                    Bấm “Thêm ảnh từ máy tính” để thêm ảnh vào thư mục assets/ và dùng làm ảnh mẫu.
                  </p>
                </div>
              ) : (
                <div className="pm-assets-grid">
                  {assets.map((ast) => {
                    const thumb = thumbnails[ast.path]
                    const isActive = referenceAssetPath === ast.path
                    return (
                      <div
                        key={ast.path}
                        className={`pm-asset-card ${isActive ? 'active' : ''}`}
                        onClick={() => void handleSelectAsset(ast)}
                        title={`Tệp: ${ast.path}\nKích thước: ${ast.size ? formatBytes(ast.size) : 'n/a'}`}
                      >
                        <div className="pm-asset-thumb">
                          {thumb ? (
                            <img src={thumb} alt={ast.name} loading="lazy" draggable={false} />
                          ) : (
                            <ImageIcon size={20} className="pm-muted" />
                          )}
                          <button
                            className="pm-asset-delete"
                            title={`Xoá “${ast.name}” (chuyển vào Thùng rác)`}
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleDeleteImage(ast)
                            }}
                          >
                            <Trash2 size={11} />
                          </button>
                          {isActive && (
                            <span className="pm-asset-check" title="Ảnh mẫu đang chọn">
                              <Check size={10} />
                            </span>
                          )}
                        </div>
                        <div className="pm-asset-info">
                          <span className="pm-asset-name">{ast.name}</span>
                          <span className="pm-asset-size">
                            {ast.size ? formatBytes(ast.size) : 'image'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* TAB 5: VERSIONS (Lịch sử & Checkpoints) */}
        {activeTab === 'versions' && (
          <>
            <div className="pm-ws-hd">
              <span className="pm-ws-hd__title">
                <History size={13} /> Lịch sử phiên bản
              </span>
            </div>

            <div className="pm-ws-bd">
              <VersionsTab
                project={project}
                branch={branch}
                onSelectFile={onSelectFile}
                onRefresh={onRefresh}
                onShowToast={onShowToast}
              />
            </div>
          </>
        )}

        {/* TAB 6: DESIGN (Hệ thống thiết kế) */}
        {activeTab === 'design' && (
          <>
            <div className="pm-ws-hd">
              <span className="pm-ws-hd__title">
                <Palette size={13} /> Hệ thống thiết kế
              </span>
              <div className="pm-ws-hd__actions">
                <button
                  className="pm-ibtn"
                  onClick={loadProjectTokens}
                  title="Tải lại tokens từ dự án"
                  disabled={tokensLoading}
                >
                  <RefreshCw size={12} className={tokensLoading ? 'pm-spin' : ''} />
                </button>
                <button className="pm-ibtn" onClick={onOpenTokens} title="Mở trình chỉnh sửa Design Tokens đầy đủ">
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>

            <div className="pm-ws-bd pm-design-tokens-body">
              {/* Chỉ thị phần tử đang chọn trên Canvas */}
              {selectedElement ? (
                <div className="pm-design-selected-banner">
                  <div className="pm-design-selected-icon">
                    <Target size={13} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div className="pm-design-selected-info">
                    <div className="pm-design-selected-title">
                      Đang chọn: <code>&lt;{selectedElement.tagName.toLowerCase()}{selectedElement.className ? `.${selectedElement.className.trim().split(/\s+/)[0]}` : ''}&gt;</code>
                    </div>
                    <div className="pm-design-selected-hint">
                      Di chuột: Xem trước · Nhấp chuột: Áp dụng
                    </div>
                  </div>
                  <div className="pm-design-selected-actions">
                    <button
                      type="button"
                      className="pm-ibtn pm-design-quick-btn"
                      onClick={handleQuickUndo}
                      title="Hoàn tác thay đổi vừa áp dụng (Ctrl+Z)"
                    >
                      <Undo2 size={11} />
                    </button>
                    <button
                      type="button"
                      className="pm-ibtn pm-design-quick-btn"
                      onClick={handleResetElementStyles}
                      title="Xóa style tùy biến, trở về mặc định"
                    >
                      <RotateCcw size={11} />
                    </button>
                    <button
                      type="button"
                      className="pm-ibtn pm-design-quick-btn"
                      onClick={handleClearSelection}
                      title="Bỏ chọn phần tử"
                    >
                      <X size={11} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pm-design-unselected-banner">
                  <Sparkles size={13} style={{ color: 'var(--accent)' }} />
                  <span>Chọn 1 phần tử trên Canvas để xem trước khi rê chuột và áp dụng 1-chạm</span>
                </div>
              )}

              {/* Phân nhóm: Màu, Chữ, Khoảng cách, Bo góc, Màn hình, Biến */}
              <div className="pm-design-subnav" style={{ flexWrap: 'wrap', gap: 2 }}>
                <button
                  type="button"
                  className={`pm-design-subnav__btn ${tokenSubtab === 'colors' ? 'active' : ''}`}
                  onClick={() => setTokenSubtab('colors')}
                >
                  Màu ({tokens?.colors?.length ?? 0})
                </button>
                <button
                  type="button"
                  className={`pm-design-subnav__btn ${tokenSubtab === 'typography' ? 'active' : ''}`}
                  onClick={() => setTokenSubtab('typography')}
                >
                  Chữ ({tokens?.typography?.length ?? 0})
                </button>
                <button
                  type="button"
                  className={`pm-design-subnav__btn ${tokenSubtab === 'spacing' ? 'active' : ''}`}
                  onClick={() => setTokenSubtab('spacing')}
                >
                  Cách ({tokens?.spacing?.length ?? 0})
                </button>
                <button
                  type="button"
                  className={`pm-design-subnav__btn ${tokenSubtab === 'radius' ? 'active' : ''}`}
                  onClick={() => setTokenSubtab('radius')}
                >
                  Góc ({tokens?.radius?.length ?? 0})
                </button>
                <button
                  type="button"
                  className={`pm-design-subnav__btn ${tokenSubtab === 'breakpoints' ? 'active' : ''}`}
                  onClick={() => setTokenSubtab('breakpoints')}
                  title="Điểm ngắt kích thước màn hình responsive"
                >
                  Màn hình ({(tokens?.breakpoints || []).length})
                </button>
                <button
                  type="button"
                  className={`pm-design-subnav__btn ${tokenSubtab === 'custom' ? 'active' : ''}`}
                  onClick={() => setTokenSubtab('custom')}
                  title="Các biến CSS tùy biến của dự án"
                >
                  Biến ({(tokens?.customVars || []).length})
                </button>
              </div>

              {/* Ô tìm kiếm token */}
              <div className="pm-design-search-box">
                <Search size={12} className="pm-design-search-icon" />
                <input
                  type="text"
                  placeholder="Tìm token, CSS var, mã màu..."
                  value={tokenSearch}
                  onChange={(e) => setTokenSearch(e.target.value)}
                  className="pm-design-search-input"
                />
                {tokenSearch && (
                  <button className="pm-ibtn" onClick={() => setTokenSearch('')} title="Xóa tìm kiếm">
                    <X size={11} />
                  </button>
                )}
              </div>

              {/* Tùy chọn mục tiêu áp dụng cho Màu Sắc */}
              {tokenSubtab === 'colors' && (
                <>
                  <div className="pm-design-target-bar">
                    <span className="pm-design-target-label">Áp dụng:</span>
                    <div className="pm-design-target-pills">
                      <button
                        type="button"
                        className={`pm-design-target-pill ${colorApplyTarget === 'bg' ? 'active' : ''}`}
                        onClick={() => setColorApplyTarget('bg')}
                        title="Áp dụng làm màu nền (background-color)"
                      >
                        Nền (bg)
                      </button>
                      <button
                        type="button"
                        className={`pm-design-target-pill ${colorApplyTarget === 'text' ? 'active' : ''}`}
                        onClick={() => setColorApplyTarget('text')}
                        title="Áp dụng làm màu chữ (color)"
                      >
                        Chữ (text)
                      </button>
                      <button
                        type="button"
                        className={`pm-design-target-pill ${colorApplyTarget === 'border' ? 'active' : ''}`}
                        onClick={() => setColorApplyTarget('border')}
                        title="Áp dụng làm màu đường viền (border-color)"
                      >
                        Viền (border)
                      </button>
                    </div>
                  </div>

                  {/* Đề xuất 3: Nhận diện màu THẬT từ phần tử đang chọn */}
                  {elementRealColor && !tokens?.colors?.some((c) => colorsMatch(c.value, elementRealColor.hex)) && (
                    <div className="pm-design-detected-box">
                      <span
                        className="pm-token-color-swatch sm"
                        style={{ backgroundColor: elementRealColor.hex }}
                      />
                      <div className="pm-design-detected-info">
                        <span className="pm-design-detected-title">Màu thật của phần tử:</span>
                        <span className="pm-design-detected-sub">
                          <code>{elementRealColor.hex}</code> · {elementRealColor.label}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn primary sm pm-design-save-token-btn"
                        onClick={handleSaveDetectedColorAsToken}
                        title="Lưu màu này vào Design Tokens của dự án"
                      >
                        <Plus size={11} /> Lưu Token
                      </button>
                    </div>
                  )}

                  {/* Danh mục màu */}
                  <div className="pm-design-cats">
                    {(
                      [
                        { key: 'all', label: 'Tất cả' },
                        { key: 'brand', label: 'Brand' },
                        { key: 'background', label: 'Nền' },
                        { key: 'status', label: 'Trạng thái' },
                        { key: 'neutral', label: 'Chữ & Viền' },
                      ] as const
                    ).map((cat) => (
                      <button
                        key={cat.key}
                        type="button"
                        className={`pm-design-cat-pill ${colorCategory === cat.key ? 'active' : ''}`}
                        onClick={() => setColorCategory(cat.key)}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Tùy chọn mục tiêu áp dụng cho Khoảng cách */}
              {tokenSubtab === 'spacing' && (
                <div className="pm-design-target-bar">
                  <span className="pm-design-target-label">Áp dụng:</span>
                  <div className="pm-design-target-pills">
                    <button
                      type="button"
                      className={`pm-design-target-pill ${spacingApplyTarget === 'padding' ? 'active' : ''}`}
                      onClick={() => setSpacingApplyTarget('padding')}
                      title="Áp dụng khoảng cách đệm bên trong (padding)"
                    >
                      Padding (Trong)
                    </button>
                    <button
                      type="button"
                      className={`pm-design-target-pill ${spacingApplyTarget === 'margin' ? 'active' : ''}`}
                      onClick={() => setSpacingApplyTarget('margin')}
                      title="Áp dụng khoảng cách lề bên ngoài (margin)"
                    >
                      Margin (Ngoài)
                    </button>
                    <button
                      type="button"
                      className={`pm-design-target-pill ${spacingApplyTarget === 'gap' ? 'active' : ''}`}
                      onClick={() => setSpacingApplyTarget('gap')}
                      title="Áp dụng khoảng cách giữa các phần tử con (gap)"
                    >
                      Gap (Con)
                    </button>
                  </div>
                </div>
              )}

              {/* Danh sách tokens */}
              <div
                className="pm-design-token-list"
                onMouseLeave={handleTokenMouseLeave}
              >
                {tokensLoading && !tokens ? (
                  <div className="pm-design-loading">
                    <Loader2 size={16} className="pm-spin" />
                    <span>Đang nạp tokens dự án...</span>
                  </div>
                ) : (
                  <>
                    {/* 1. MÀU SẮC (COLORS) */}
                    {tokenSubtab === 'colors' && (
                      <div className="pm-token-colors-grid">
                        {filteredColors.length === 0 ? (
                          <div className="pm-design-empty">Không tìm thấy màu phù hợp</div>
                        ) : (
                          filteredColors.map((color) => {
                            const varName = tokenToCssVarName('color', color.id)
                            const isCopied = copiedTokenId === color.id
                            const isApplied = appliedTokenId === color.id
                            // Đề xuất 2: Nhận diện token đang dùng trên phần tử
                            const activeVal =
                              colorApplyTarget === 'bg'
                                ? selectedElement?.computedStyles?.backgroundColor
                                : colorApplyTarget === 'text'
                                ? selectedElement?.computedStyles?.color
                                : selectedElement?.computedStyles?.borderColor ||
                                  (selectedElement?.computedStyles as any)?.borderTopColor
                            const isActive = Boolean(selectedElement && colorsMatch(color.value, activeVal))

                            const cardTitle = selectedElement
                              ? `Rê chuột: Xem thử tạm thời\nNhấp chuột: Áp dụng màu này vào <${selectedElement.tagName.toLowerCase()}>\nIcon copy: Sao chép mã CSS`
                              : `Nhấp để sao chép var(${varName})\n(Mẹo: Chọn một phần tử trên Canvas để áp dụng trực tiếp)`
                            return (
                              <div
                                key={color.id}
                                className={`pm-token-color-card ${isCopied ? 'copied' : ''} ${isApplied ? 'applied' : ''} ${isActive ? 'is-active-token' : ''}`}
                                onClick={() => applyTokenToElement('color', color)}
                                onMouseEnter={() => handleTokenMouseEnter('color', color)}
                                onMouseLeave={handleTokenMouseLeave}
                                title={cardTitle}
                              >
                                <span
                                  className="pm-token-color-swatch"
                                  style={{ backgroundColor: color.value }}
                                />
                                <div className="pm-token-color-info">
                                  <div className="pm-token-color-name" title={color.name}>
                                    {color.name}
                                  </div>
                                  <div className="pm-token-color-meta">
                                    <code>{color.value}</code>
                                    <span className="pm-token-var-name">var({varName})</span>
                                  </div>
                                </div>
                                <div className="pm-token-card-actions">
                                  {isActive && (
                                    <span className="pm-token-active-badge">● Đang dùng</span>
                                  )}
                                  {isApplied && (
                                    <span className="pm-token-applied-badge">✓ Áp dụng</span>
                                  )}
                                  <button
                                    type="button"
                                    className="pm-token-copy-btn"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleCopyVar('color', color.id, color.value)
                                    }}
                                    title="Sao chép mã biến CSS"
                                  >
                                    {isCopied ? (
                                      <Check size={12} style={{ color: 'var(--color-success)' }} />
                                    ) : (
                                      <Copy size={11} />
                                    )}
                                  </button>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}

                    {/* 2. KIỂU CHỮ (TYPOGRAPHY) */}
                    {tokenSubtab === 'typography' && (
                      <div className="pm-token-typo-list">
                        {filteredTypography.length === 0 ? (
                          <div className="pm-design-empty">Không tìm thấy kiểu chữ phù hợp</div>
                        ) : (
                          filteredTypography.map((typo) => {
                            const varName = tokenToCssVarName('font', typo.id)
                            const isCopied = copiedTokenId === typo.id
                            const isApplied = appliedTokenId === typo.id
                            const isActive = Boolean(
                              selectedElement && selectedElement.computedStyles?.fontSize === typo.fontSize
                            )
                            const cardTitle = selectedElement
                              ? `Rê chuột: Xem thử tạm thời\nNhấp chuột: Áp dụng kiểu chữ này vào <${selectedElement.tagName.toLowerCase()}>\nIcon copy: Sao chép mã CSS`
                              : `Nhấp để sao chép var(${varName})\n(Mẹo: Chọn một phần tử trên Canvas để áp dụng trực tiếp)`
                            return (
                              <div
                                key={typo.id}
                                className={`pm-token-typo-card ${isCopied ? 'copied' : ''} ${isApplied ? 'applied' : ''} ${isActive ? 'is-active-token' : ''}`}
                                onClick={() => applyTokenToElement('font', typo)}
                                onMouseEnter={() => handleTokenMouseEnter('font', typo)}
                                onMouseLeave={handleTokenMouseLeave}
                                title={cardTitle}
                              >
                                <div className="pm-token-typo-header">
                                  <span className="pm-token-typo-name">{typo.name}</span>
                                  <span className="pm-token-typo-specs">
                                    {typo.fontSize} / {typo.lineHeight}
                                    {typo.fontWeight ? ` · ${typo.fontWeight}` : ''}
                                  </span>
                                  <div className="pm-token-card-actions">
                                    {isActive && (
                                      <span className="pm-token-active-badge">● Đang dùng</span>
                                    )}
                                    {isApplied && (
                                      <span className="pm-token-applied-badge">✓ Áp dụng</span>
                                    )}
                                    <button
                                      type="button"
                                      className="pm-token-copy-btn"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleCopyVar('font', typo.id, typo.fontSize)
                                      }}
                                      title="Sao chép mã biến CSS"
                                    >
                                      {isCopied ? (
                                        <Check size={12} style={{ color: 'var(--color-success)' }} />
                                      ) : (
                                        <Copy size={11} />
                                      )}
                                    </button>
                                  </div>
                                </div>
                                <div
                                  className="pm-token-typo-preview"
                                  style={{
                                    fontSize: typo.fontSize,
                                    lineHeight: typo.lineHeight,
                                    fontWeight: typo.fontWeight || '400',
                                  }}
                                >
                                  PixelMind Design 123
                                </div>
                                <div className="pm-token-typo-footer">
                                  <code>var({varName})</code>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}

                    {/* 3. KHOẢNG CÁCH (SPACING) */}
                    {tokenSubtab === 'spacing' && (
                      <div className="pm-token-metric-list">
                        {filteredSpacing.length === 0 ? (
                          <div className="pm-design-empty">Không tìm thấy khoảng cách phù hợp</div>
                        ) : (
                          filteredSpacing.map((sp) => {
                            const varName = tokenToCssVarName('spacing', sp.id)
                            const isCopied = copiedTokenId === sp.id
                            const isApplied = appliedTokenId === sp.id
                            const isActive = Boolean(
                              selectedElement &&
                                (selectedElement.computedStyles?.padding?.includes(sp.value) ||
                                  selectedElement.computedStyles?.paddingLeft === sp.value)
                            )
                            const numericVal = parseInt(sp.value, 10) || 4
                            const barWidth = Math.min(120, Math.max(6, numericVal * 2))
                            const cardTitle = selectedElement
                              ? `Rê chuột: Xem thử tạm thời\nNhấp chuột: Áp dụng ${spacingApplyTarget} = ${sp.value} vào <${selectedElement.tagName.toLowerCase()}>\nIcon copy: Sao chép mã CSS`
                              : `Nhấp để sao chép var(${varName})\n(Mẹo: Chọn một phần tử trên Canvas để áp dụng trực tiếp)`
                            return (
                              <div
                                key={sp.id}
                                className={`pm-token-metric-card ${isCopied ? 'copied' : ''} ${isApplied ? 'applied' : ''} ${isActive ? 'is-active-token' : ''}`}
                                onClick={() => applyTokenToElement('spacing', sp)}
                                onMouseEnter={() => handleTokenMouseEnter('spacing', sp)}
                                onMouseLeave={handleTokenMouseLeave}
                                title={cardTitle}
                              >
                                <div className="pm-token-metric-header">
                                  <span className="pm-token-metric-name">{sp.name}</span>
                                  <span className="pm-token-metric-val">{sp.value}</span>
                                  <div className="pm-token-card-actions">
                                    {isActive && (
                                      <span className="pm-token-active-badge">● Đang dùng</span>
                                    )}
                                    {isApplied && (
                                      <span className="pm-token-applied-badge">✓ Áp dụng</span>
                                    )}
                                    <button
                                      type="button"
                                      className="pm-token-copy-btn"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleCopyVar('spacing', sp.id, sp.value)
                                      }}
                                      title="Sao chép mã biến CSS"
                                    >
                                      {isCopied ? (
                                        <Check size={12} style={{ color: 'var(--color-success)' }} />
                                      ) : (
                                        <Copy size={11} />
                                      )}
                                    </button>
                                  </div>
                                </div>
                                <div className="pm-token-spacing-bar-track">
                                  <div className="pm-token-spacing-bar-fill" style={{ width: `${barWidth}px` }} />
                                </div>
                                <div className="pm-token-metric-code">
                                  <code>var({varName})</code>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}

                    {/* 4. BO GÓC (RADIUS) */}
                    {tokenSubtab === 'radius' && (
                      <div className="pm-token-metric-list">
                        {filteredRadius.length === 0 ? (
                          <div className="pm-design-empty">Không tìm thấy bán kính bo góc</div>
                        ) : (
                          filteredRadius.map((rad) => {
                            const varName = tokenToCssVarName('radius', rad.id)
                            const isCopied = copiedTokenId === rad.id
                            const isApplied = appliedTokenId === rad.id
                            const isActive = Boolean(
                              selectedElement &&
                                (selectedElement.computedStyles?.borderRadius === rad.value ||
                                  selectedElement.computedStyles?.borderTopLeftRadius === rad.value)
                            )
                            const cardTitle = selectedElement
                              ? `Rê chuột: Xem thử tạm thời\nNhấp chuột: Áp dụng bo góc ${rad.value} vào <${selectedElement.tagName.toLowerCase()}>\nIcon copy: Sao chép mã CSS`
                              : `Nhấp để sao chép var(${varName})\n(Mẹo: Chọn một phần tử trên Canvas để áp dụng trực tiếp)`
                            return (
                              <div
                                key={rad.id}
                                className={`pm-token-metric-card ${isCopied ? 'copied' : ''} ${isApplied ? 'applied' : ''} ${isActive ? 'is-active-token' : ''}`}
                                onClick={() => applyTokenToElement('radius', rad)}
                                onMouseEnter={() => handleTokenMouseEnter('radius', rad)}
                                onMouseLeave={handleTokenMouseLeave}
                                title={cardTitle}
                              >
                                <div className="pm-token-metric-header">
                                  <span className="pm-token-metric-name">{rad.name}</span>
                                  <span className="pm-token-metric-val">{rad.value}</span>
                                  <div className="pm-token-card-actions">
                                    {isActive && (
                                      <span className="pm-token-active-badge">● Đang dùng</span>
                                    )}
                                    {isApplied && (
                                      <span className="pm-token-applied-badge">✓ Áp dụng</span>
                                    )}
                                    <button
                                      type="button"
                                      className="pm-token-copy-btn"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleCopyVar('radius', rad.id, rad.value)
                                      }}
                                      title="Sao chép mã biến CSS"
                                    >
                                      {isCopied ? (
                                        <Check size={12} style={{ color: 'var(--color-success)' }} />
                                      ) : (
                                        <Copy size={11} />
                                      )}
                                    </button>
                                  </div>
                                </div>
                                <div className="pm-token-radius-box-wrapper">
                                  <div className="pm-token-radius-box-preview" style={{ borderRadius: rad.value }} />
                                </div>
                                <div className="pm-token-metric-code">
                                  <code>var({varName})</code>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}

                    {/* 5. ĐIỂM NGẮT (BREAKPOINTS) */}
                    {tokenSubtab === 'breakpoints' && (
                      <div className="pm-token-metric-list">
                        {(tokens?.breakpoints || []).length === 0 ? (
                          <div className="pm-design-empty">Chưa có breakpoint nào</div>
                        ) : (
                          (tokens?.breakpoints || []).map((bp) => {
                            const varName = tokenToCssVarName('breakpoint', bp.id)
                            const isCopied = copiedTokenId === bp.id
                            return (
                              <div
                                key={bp.id}
                                className={`pm-token-metric-card ${isCopied ? 'copied' : ''}`}
                                onClick={() => {
                                  window.dispatchEvent(
                                    new CustomEvent('pm:set-viewport-width', { detail: bp.minWidth }),
                                  )
                                  onShowToast('info', `Đã chuyển thử kích thước sang ${bp.minWidth}px`)
                                }}
                                title={`Mốc ${bp.name} (≥${bp.minWidth}px)\nNhấp để xem thử trên Canvas`}
                              >
                                <div className="pm-token-metric-header">
                                  <span className="pm-token-metric-name">{bp.name}</span>
                                  <span className="pm-token-metric-val">≥ {bp.minWidth}px</span>
                                  <div className="pm-token-card-actions">
                                    <button
                                      type="button"
                                      className="pm-token-copy-btn"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        navigator.clipboard.writeText(`var(${varName})`)
                                        setCopiedTokenId(bp.id)
                                        onShowToast('ok', `Đã sao chép var(${varName})`)
                                        setTimeout(() => setCopiedTokenId(null), 1500)
                                      }}
                                      title="Sao chép mã biến CSS"
                                    >
                                      {isCopied ? (
                                        <Check size={12} style={{ color: 'var(--color-success)' }} />
                                      ) : (
                                        <Copy size={11} />
                                      )}
                                    </button>
                                  </div>
                                </div>
                                <div className="pm-token-metric-code">
                                  <code>var({varName})</code>
                                  <span style={{ marginLeft: 'auto', fontSize: '9.5px', color: '#94a3b8' }}>
                                    {bp.description || 'Responsive'}
                                  </span>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}

                    {/* 6. BIẾN TÙY BIẾN (CUSTOM CSS VARIABLES) */}
                    {tokenSubtab === 'custom' && (
                      <div className="pm-token-metric-list">
                        {(tokens?.customVars || []).length === 0 ? (
                          <div className="pm-design-empty">Chưa có biến tùy biến nào</div>
                        ) : (
                          (tokens?.customVars || []).map((v) => {
                            const varName = v.name.startsWith('--') ? v.name : `--${v.name}`
                            const isCopied = copiedTokenId === v.id
                            return (
                              <div
                                key={v.id}
                                className={`pm-token-metric-card ${isCopied ? 'copied' : ''}`}
                                onClick={() => {
                                  const text = `var(${varName})`
                                  navigator.clipboard.writeText(text)
                                  setCopiedTokenId(v.id)
                                  onShowToast('ok', `Đã sao chép ${text}`)
                                  setTimeout(() => setCopiedTokenId(null), 1500)
                                }}
                                title={`Biến ${varName}: ${v.value}\nNhấp để sao chép var(${varName})`}
                              >
                                <div className="pm-token-metric-header">
                                  <span className="pm-token-metric-name" style={{ color: '#38bdf8' }}>
                                    {varName}
                                  </span>
                                  <span className="pm-token-metric-val">{v.value}</span>
                                  <div className="pm-token-card-actions">
                                    <button
                                      type="button"
                                      className="pm-token-copy-btn"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        navigator.clipboard.writeText(`var(${varName})`)
                                        setCopiedTokenId(v.id)
                                        onShowToast('ok', `Đã sao chép var(${varName})`)
                                        setTimeout(() => setCopiedTokenId(null), 1500)
                                      }}
                                      title="Sao chép mã biến CSS"
                                    >
                                      {isCopied ? (
                                        <Check size={12} style={{ color: 'var(--color-success)' }} />
                                      ) : (
                                        <Copy size={11} />
                                      )}
                                    </button>
                                  </div>
                                </div>
                                <div className="pm-token-metric-code">
                                  <code>var({varName})</code>
                                  <span style={{ marginLeft: 'auto', fontSize: '9.5px', color: '#94a3b8' }}>
                                    {v.category || 'other'}
                                  </span>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Chân sidebar: Nút mở trình biên tập Design Tokens */}
              <div className="pm-design-footer">
                <button
                  type="button"
                  className="btn primary"
                  onClick={onOpenTokens}
                  style={{ width: '100%', fontSize: 11.5, gap: 6 }}
                >
                  <Palette size={13} /> Mở trình chỉnh sửa Tokens…
                </button>
              </div>
            </div>
          </>
        )}

        {/* TAB 7: TOOLBOX (Hộp công cụ — Phần tử · Linh kiện · Của dự án) */}
        {activeTab === 'toolbox' && (
          <ToolboxPanel
            projectPath={project.path}
            onShowToast={onShowToast}
            onNeedPreview={onOpenPreview}
          />
        )}
      </div>
    </div>
  )
}

export default WorkspaceSidebar

