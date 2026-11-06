import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Box,
  Boxes,
  ChevronDown,
  ExternalLink,
  FileCode2,
  FileText,
  Folder,
  FolderOpen,
  FolderTree,
  GitBranch,
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
  RotateCcw,
  Search,
  Sliders,
  Sparkles,
  Table,
  Trash2,
  Type,
  X,
} from 'lucide-react'
import type { FileNode, ProjectPage, ProjectRecord } from '@shared/types'
import { formatBytes } from '../lib/format'
import { editorBuffer } from '../lib/editorBuffer'
import FileTree from './FileTree'
import ToolboxPanel from './ToolboxPanel'

export type SidebarTab = 'files' | 'layers' | 'pages' | 'assets' | 'versions' | 'design' | 'toolbox'

interface WorkspaceSidebarProps {
  project: ProjectRecord
  tree: FileNode[]
  treeLoading: boolean
  selectedPath: string | null
  query: string
  onQuery: (value: string) => void
  onSelectFile: (node: FileNode) => void
  onRefresh: () => void
  onOpenFolder: () => void
  activeTab: SidebarTab
  onActiveTabChange: (tab: SidebarTab) => void
  onCloseSidebar: () => void
  onOpenPage: (route: string) => void
  onAddPage: () => void
  onEditPage?: (page: ProjectPage) => void
  onDeletePage?: (page: ProjectPage) => void
  onOpenParamChooser?: (page: ProjectPage) => void
  currentRoute?: string
  onOpenTokens: () => void
  branch: string | null
  onShowToast: (kind: 'ok' | 'err' | 'info', text: string) => void
  isRunning?: boolean
  onRun?: () => void
  /** Chuyển sang tab Xem trước để canvas nhận phần tử từ Hộp công cụ. */
  onOpenPreview?: () => void
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
  onOpenParamChooser,
  currentRoute,
  onOpenTokens,
  branch,
  onShowToast,
  isRunning = false,
  onRun,
  onOpenPreview,
}: WorkspaceSidebarProps) => {
  const [layersSearch, setLayersSearch] = useState('')
  const [pagesSearch, setPagesSearch] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  const togglePageGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }))
  }
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null)
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null)

  const [liveLayers, setLiveLayers] = useState<LayerNode[]>([])
  const [isLoadingLayers, setIsLoadingLayers] = useState(false)

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
        if (e.data.payload?.uid) {
          setSelectedLayerId(e.data.payload.uid)
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
                  title="Xoá trang này khỏi danh sách"
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

  const copyToClipboard = (text: string, msg: string) => {
    navigator.clipboard.writeText(text)
    onShowToast('ok', msg)
  }

  return (
    <div className="pm-ws-sidebar">
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
                <button className="pm-ibtn" onClick={onRefresh} title="Tải lại cây tệp (Ctrl+R)">
                  <RefreshCw size={12} />
                </button>
                <button className="pm-ibtn" onClick={onOpenFolder} title="Mở thư mục khác (Ctrl+O)">
                  <FolderOpen size={12} />
                </button>
              </div>
            </div>

            <div className="pm-ws-filter">
              <div className="pm-searchbox" style={{ width: '100%' }}>
                <Search size={12} />
                <input
                  value={query}
                  placeholder="Lọc theo tên tệp…"
                  style={{ width: '100%' }}
                  onChange={(e) => onQuery(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            <div className="pm-ws-bd">
              {treeLoading ? (
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
                />
              )}
            </div>
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
                  onClick={onRefresh}
                  title="Quét lại tài nguyên"
                >
                  <RefreshCw size={12} />
                </button>
              </div>
            </div>

            <div className="pm-ws-bd">
              {assets.length === 0 ? (
                <div className="pm-empty" style={{ padding: '24px 12px', border: 0 }}>
                  <ImageIcon size={22} className="pm-muted" />
                  <p style={{ fontSize: 11.5, marginTop: 6 }}>
                    Chưa tìm thấy tệp ảnh nào (.png, .svg, .jpg) trong dự án.
                  </p>
                  <p className="pm-muted" style={{ fontSize: 10.5 }}>
                    Lưu ảnh thiết kế vào thư mục dự án để dùng làm ảnh mẫu đối chiếu.
                  </p>
                </div>
              ) : (
                <div className="pm-assets-grid">
                  {assets.map((ast) => (
                    <div
                      key={ast.path}
                      className="pm-asset-card"
                      onClick={() =>
                        onShowToast('ok', `Đã chọn ảnh “${ast.name}” làm mẫu đối chiếu!`)
                      }
                      title={`Tệp: ${ast.name}\nKích thước: ${ast.size ? formatBytes(ast.size) : 'n/a'}`}
                    >
                      <div className="pm-asset-thumb">
                        <ImageIcon size={20} className="pm-muted" />
                      </div>
                      <div className="pm-asset-info">
                        <span className="pm-asset-name">{ast.name}</span>
                        <span className="pm-asset-size">
                          {ast.size ? formatBytes(ast.size) : 'image'}
                        </span>
                      </div>
                    </div>
                  ))}
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
              {/* Thẻ nhánh Git */}
              <div className="pm-version-branch-card">
                <GitBranch size={14} style={{ color: 'var(--accent)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>Nhánh: {branch || 'main'}</div>
                  <div className="pm-muted" style={{ fontSize: 10 }}>
                    Trạng thái: Đã đồng bộ mã nguồn
                  </div>
                </div>
              </div>

              {/* Dòng thời gian checkpoint */}
              <div style={{ marginTop: 8 }}>
                <div
                  className="pm-muted"
                  style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}
                >
                  Mốc sửa đổi gần đây (In-Memory Buffer)
                </div>
                <div className="pm-timeline">
                  <div className="pm-timeline-item">
                    <span className="pm-timeline-title">Khởi tạo phiên làm việc</span>
                    <span className="pm-timeline-meta">Vừa xong · Sẵn sàng sửa đổi trực quan</span>
                  </div>
                  {editorBuffer.isDirty() && (
                    <div className="pm-timeline-item">
                      <span className="pm-timeline-title">Đang có thay đổi trong RAM</span>
                      <span className="pm-timeline-meta">Chưa ghi xuống ổ đĩa · Nhấn Ctrl+S để lưu</span>
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  marginTop: 'auto',
                  padding: 10,
                  borderRadius: 7,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--line)',
                  fontSize: 11,
                  color: 'var(--text-3)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-2)', fontWeight: 600, marginBottom: 3 }}>
                  <Sparkles size={12} style={{ color: 'var(--accent)' }} /> Tính năng nâng cao
                </div>
                Tính năng tạo nhánh Git và đồng bộ kho mã từ xa đang được phát triển ở phiên bản kế tiếp.
              </div>
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
                <button className="pm-ibtn" onClick={onOpenTokens} title="Mở bảng quản trị Tokens đầy đủ">
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>

            <div className="pm-ws-bd">
              {/* Bảng màu Swatches */}
              <div className="pm-design-section">
                <span className="pm-design-section-title">Bảng màu chính (Colors)</span>
                <div className="pm-swatches-grid">
                  <div
                    className="pm-swatch-item"
                    onClick={() => copyToClipboard('var(--pm-accent)', 'Đã sao chép var(--pm-accent)')}
                    title="Nhấp để chép biến CSS"
                  >
                    <span className="pm-swatch-circle" style={{ background: 'var(--pm-accent, #8b5cf6)' }} />
                    <span className="pm-swatch-label">Accent</span>
                  </div>
                  <div
                    className="pm-swatch-item"
                    onClick={() => copyToClipboard('var(--color-success)', 'Đã sao chép var(--color-success)')}
                    title="Nhấp để chép biến CSS"
                  >
                    <span className="pm-swatch-circle" style={{ background: '#10b981' }} />
                    <span className="pm-swatch-label">Success</span>
                  </div>
                  <div
                    className="pm-swatch-item"
                    onClick={() => copyToClipboard('var(--color-warning)', 'Đã sao chép var(--color-warning)')}
                    title="Nhấp để chép biến CSS"
                  >
                    <span className="pm-swatch-circle" style={{ background: '#f59e0b' }} />
                    <span className="pm-swatch-label">Warning</span>
                  </div>
                  <div
                    className="pm-swatch-item"
                    onClick={() => copyToClipboard('var(--color-error)', 'Đã sao chép var(--color-error)')}
                    title="Nhấp để chép biến CSS"
                  >
                    <span className="pm-swatch-circle" style={{ background: '#ef4444' }} />
                    <span className="pm-swatch-label">Error</span>
                  </div>
                </div>
              </div>

              {/* Kiểu chữ Typography */}
              <div className="pm-design-section" style={{ marginTop: 8 }}>
                <span className="pm-design-section-title">Kiểu chữ (Typography)</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ padding: '6px 8px', background: 'var(--panel-2)', borderRadius: 6, fontSize: 11 }}>
                    <div className="pm-muted" style={{ fontSize: 9.5 }}>Font Sans</div>
                    <div style={{ fontWeight: 600 }}>Inter, system-ui</div>
                  </div>
                  <div style={{ padding: '6px 8px', background: 'var(--panel-2)', borderRadius: 6, fontSize: 11 }}>
                    <div className="pm-muted" style={{ fontSize: 9.5 }}>Font Mono</div>
                    <div style={{ fontFamily: 'var(--font-mono)' }}>JetBrains Mono</div>
                  </div>
                </div>
              </div>

              <button
                className="btn primary"
                onClick={onOpenTokens}
                style={{ marginTop: 'auto', width: '100%', fontSize: 11.5, gap: 6 }}
              >
                <Palette size={13} /> Mở trình quản lý Tokens…
              </button>
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

