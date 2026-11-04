import { useState, useMemo } from 'react'
import {
  Box,
  Circle,
  Copy,
  ExternalLink,
  FileCode2,
  FileText,
  FolderOpen,
  FolderTree,
  GitBranch,
  History,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  Loader2,
  Package,
  Palette,
  PanelLeftClose,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Square,
  Type,
} from 'lucide-react'
import type { FileNode, ProjectRecord } from '@shared/types'
import { formatBytes } from '../lib/format'
import { editorBuffer } from '../lib/editorBuffer'
import { PARTS } from '../data/toolbox'
import FileTree from './FileTree'

export type SidebarTab = 'files' | 'layers' | 'pages' | 'assets' | 'versions' | 'design' | 'part'

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
  onOpenTokens: () => void
  branch: string | null
  onShowToast: (kind: 'ok' | 'err' | 'info', text: string) => void
}

/* ── Cây phân cấp DOM mẫu trực quan ── */
interface LayerNode {
  id: string
  label: string
  tag: string
  icon: typeof Box
  depth: number
  open?: boolean
}

const DEFAULT_LAYERS: LayerNode[] = [
  { id: 'frame', label: 'Khung · Desktop (1440×900)', tag: 'body', icon: LayoutGrid, depth: 0, open: true },
  { id: 'header', label: 'Thanh điều hướng Header', tag: 'header', icon: Box, depth: 1, open: true },
  { id: 'logo', label: 'Logo thương hiệu', tag: 'div.logo', icon: Square, depth: 2 },
  { id: 'nav', label: 'Menu điều hướng', tag: 'nav', icon: Type, depth: 2 },
  { id: 'cta-btn', label: 'Nút hành động CTA', tag: 'button.btn-primary', icon: Circle, depth: 2 },
  { id: 'hero', label: 'Khu vực Hero Section', tag: 'section.hero', icon: Box, depth: 1, open: true },
  { id: 'hero-title', label: 'Tiêu đề chính', tag: 'h1.hero-title', icon: Type, depth: 2 },
  { id: 'hero-desc', label: 'Phụ đề giới thiệu', tag: 'p.hero-desc', icon: Type, depth: 2 },
  { id: 'hero-action', label: 'Cụm nút bấm chính', tag: 'div.actions', icon: Box, depth: 2 },
  { id: 'features', label: 'Khối tính năng Features', tag: 'section.features', icon: Box, depth: 1, open: false },
  { id: 'footer', label: 'Chân trang Footer', tag: 'footer', icon: Box, depth: 1, open: false },
]

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
  onOpenTokens,
  branch,
  onShowToast,
}: WorkspaceSidebarProps) => {
  const [layersSearch, setLayersSearch] = useState('')
  const [partsSearch, setPartsSearch] = useState('')
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [selectedPartGroup, setSelectedPartGroup] = useState<string>('all')

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
    if (!layersSearch.trim()) return DEFAULT_LAYERS
    const q = layersSearch.toLowerCase()
    return DEFAULT_LAYERS.filter((l) => l.label.toLowerCase().includes(q) || l.tag.toLowerCase().includes(q))
  }, [layersSearch])

  /* ── Lọc linh kiện Part theo từ khoá và nhóm ── */
  const filteredParts = useMemo(() => {
    return PARTS.filter((p) => {
      const matchSearch =
        !partsSearch.trim() ||
        p.name.toLowerCase().includes(partsSearch.toLowerCase()) ||
        p.id.toLowerCase().includes(partsSearch.toLowerCase()) ||
        p.tags.some((t) => t.toLowerCase().includes(partsSearch.toLowerCase()))
      const matchGroup = selectedPartGroup === 'all' || p.groups.includes(selectedPartGroup)
      return matchSearch && matchGroup
    })
  }, [partsSearch, selectedPartGroup])

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
          className={`pm-ws-tab-btn ${activeTab === 'part' ? 'active' : ''}`}
          onClick={() => onActiveTabChange('part')}
          title="Thư viện linh kiện mẫu (Part Library)"
        >
          <Package size={16} />
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
              <span className="pm-ws-hd__title">
                <Layers size={13} /> Phân cấp phần tử
              </span>
              <div className="pm-ws-hd__actions">
                <button
                  className="pm-ibtn"
                  onClick={() => onShowToast('ok', 'Đã làm mới danh sách phân cấp thẻ DOM.')}
                  title="Làm mới phân cấp"
                >
                  <RefreshCw size={12} />
                </button>
              </div>
            </div>

            <div className="pm-ws-filter">
              <div className="pm-searchbox" style={{ width: '100%' }}>
                <Search size={12} />
                <input
                  value={layersSearch}
                  placeholder="Lọc phần tử (header, hero, btn…)…"
                  style={{ width: '100%' }}
                  onChange={(e) => setLayersSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            <div className="pm-ws-bd">
              <div className="pm-layers-list">
                {filteredLayers.map((layer) => {
                  const Icon = layer.icon
                  const isSelected = selectedLayerId === layer.id
                  return (
                    <div
                      key={layer.id}
                      className={`pm-layer-item ${isSelected ? 'selected' : ''}`}
                      style={{ paddingLeft: `${8 + layer.depth * 14}px` }}
                      onClick={() => {
                        setSelectedLayerId(layer.id)
                        onShowToast('info', `Đã chọn phần tử “${layer.label}” (${layer.tag})`)
                      }}
                    >
                      <Icon size={12} style={{ opacity: 0.7, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                        {layer.label}
                      </span>
                      <span className="pm-layer-tag">{layer.tag}</span>
                    </div>
                  )
                })}
              </div>
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

            <div className="pm-ws-bd">
              <div className="pm-pages-list">
                {/* Trang mặc định hoặc danh sách trang đã quét */}
                {project.meta?.pages && project.meta.pages.length > 0 ? (
                  project.meta.pages.map((p) => (
                    <div
                      key={p.id}
                      className="pm-page-card"
                      onClick={() => onOpenPage(p.route)}
                      title={`Xem trước trang ${p.route}`}
                    >
                      <FileCode2 size={14} className="pm-muted" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="pm-page-card__title">{p.title || 'Trang web'}</div>
                        <div className="pm-page-card__route">{p.route}</div>
                      </div>
                    </div>
                  ))
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
                    <div
                      className="pm-page-card"
                      onClick={() => onOpenPage('/about')}
                      title="Trang giới thiệu"
                    >
                      <FileCode2 size={14} className="pm-muted" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="pm-page-card__title">Giới thiệu (About)</div>
                        <div className="pm-page-card__route">/about</div>
                      </div>
                    </div>
                    <div
                      className="pm-page-card"
                      onClick={() => onOpenPage('/contact')}
                      title="Trang liên hệ"
                    >
                      <FileCode2 size={14} className="pm-muted" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="pm-page-card__title">Liên hệ (Contact)</div>
                        <div className="pm-page-card__route">/contact</div>
                      </div>
                    </div>
                  </>
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

        {/* TAB 7: PART (Thư viện Linh kiện mẫu) */}
        {activeTab === 'part' && (
          <>
            <div className="pm-ws-hd">
              <span className="pm-ws-hd__title">
                <Package size={13} /> Thư viện Linh kiện ({filteredParts.length})
              </span>
            </div>

            <div className="pm-ws-filter" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="pm-searchbox" style={{ width: '100%' }}>
                <Search size={12} />
                <input
                  value={partsSearch}
                  placeholder="Tìm linh kiện (nút, bảng giá, card…)…"
                  style={{ width: '100%' }}
                  onChange={(e) => setPartsSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
              <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: 'ui', label: 'UI' },
                  { id: 'marketing', label: 'Marketing' },
                  { id: 'layout', label: 'Layout' },
                ].map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedPartGroup(g.id)}
                    className={`pm-filter-pill ${selectedPartGroup === g.id ? 'active' : ''}`}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 10,
                      border: '1px solid var(--line)',
                      background: selectedPartGroup === g.id ? 'var(--panel-3)' : 'transparent',
                      color: selectedPartGroup === g.id ? 'var(--text)' : 'var(--text-3)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pm-ws-bd">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredParts.map((part) => (
                  <div key={part.id} className="pm-part-card">
                    <div className="pm-part-card__hd">
                      <span className="pm-part-card__name">{part.name}</span>
                      <span className="pm-part-pill">{part.version}</span>
                    </div>
                    <p className="pm-part-card__desc">
                      {part.files.find((f) => f.name === 'prompt.txt')?.body ||
                        part.tags.join(' • ')}
                    </p>
                    <div className="pm-part-card__actions">
                      <button
                        className="btn secondary"
                        onClick={() =>
                          copyToClipboard(
                            part.html || part.css,
                            `Đã sao chép mã nguồn của “${part.name}”!`,
                          )
                        }
                        style={{ height: 25, fontSize: 11, padding: '0 8px', gap: 4 }}
                      >
                        <Copy size={11} /> Sao chép mã
                      </button>
                      <button
                        className="btn ghost"
                        onClick={() =>
                          onShowToast(
                            'info',
                            `Tính năng kéo thả AST tự động cho “${part.name}” đang được hoàn thiện!`,
                          )
                        }
                        style={{ height: 25, fontSize: 11, padding: '0 8px', gap: 4 }}
                      >
                        <Plus size={11} /> Chèn vào trang
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default WorkspaceSidebar

