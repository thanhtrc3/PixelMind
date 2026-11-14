import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowRightToLine,
  Bell,
  Box,
  Boxes,
  CheckSquare,
  ChevronDown,
  CircleDot,
  Columns,
  Compass,
  Copy,
  FormInput,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  Loader2,
  Menu,
  MoreHorizontal,
  MousePointer2,
  Package,
  Percent,
  Plus,
  RefreshCw,
  Rows,
  Search,
  Sliders,
  Sparkles,
  Square,
  Table,
  Trash2,
  Type,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CustomToolboxPart, InsertPlacement, ProjectComponent, ProjectScanResult, ToolboxGroupId } from '@shared/toolbox'
import { api } from '../lib/bridge'
import { PARTS, matchesQuery } from '../data/toolbox'
import type { Part } from '../data/toolbox'
import {
  TOOLBOX_ELEMENTS,
  TOOLBOX_ELEMENT_COUNT,
} from '../data/toolboxCatalog'
import type { ToolboxElement } from '@shared/toolbox'
import { requestToolboxInsert, toolboxDrag } from '../lib/toolboxBridge'
import type { ToolboxDragItem } from '../lib/toolboxBridge'
import SavePartModal from './ide/SavePartModal'

type ToolboxTab = 'elements' | 'parts' | 'project'

interface ToolboxPanelProps {
  projectPath?: string
  onShowToast: (kind: 'ok' | 'err' | 'info', text: string) => void
  /** Chuyển workspace sang tab Xem trước để có canvas nhận phần tử. */
  onNeedPreview?: () => void
}

const GROUP_ICONS: Record<ToolboxGroupId, LucideIcon> = {
  layout: LayoutGrid,
  typography: Type,
  navigation: Compass,
  buttons: MousePointer2,
  forms: Sliders,
  data: Table,
  feedback: AlertCircle,
  marketing: Sparkles,
  utility: Box,
  parts: Package,
  project: Boxes,
}

function getControlIcon(element: ToolboxElement): LucideIcon {
  const id = element.id.toLowerCase()
  if (id.includes('button') || id.startsWith('btn')) return Square
  if (id.includes('checkbox')) return CheckSquare
  if (id.includes('radio')) return CircleDot
  if (id.includes('select') || id.includes('combobox')) return Menu
  if (id.includes('input') || id.includes('textbox')) return FormInput
  if (id.includes('h1') || id.includes('h2') || id.includes('h3') || id.includes('heading')) return Type
  if (id.includes('paragraph') || id.includes('text') || id.includes('lead') || id.includes('small')) return Type
  if (id.includes('link')) return Compass
  if (id.includes('table')) return Table
  if (id.includes('image') || id.includes('img') || id.includes('picture')) return ImageIcon
  if (id.includes('card')) return LayoutGrid
  if (id.includes('container') || id.includes('section')) return Box
  if (id.includes('div')) return Layers
  if (id.includes('grid') || id.includes('row')) return Columns
  if (id.includes('column') || id.includes('stack')) return Rows
  if (id.includes('alert') || id.includes('badge')) return AlertCircle
  if (id.includes('progress')) return Percent
  if (id.includes('modal') || id.includes('toast')) return Bell
  if (id.includes('hero') || id.includes('cta')) return Sparkles
  if (id.includes('nav') || id.includes('menu') || id.includes('tabs')) return Compass
  return GROUP_ICONS[element.group] || Box
}

const COMMON_CONTROL_IDS = [
  'button-primary',
  'form-input',
  'form-checkbox',
  'form-select',
  'text-h1',
  'text-paragraph',
  'layout-container',
  'layout-section',
  'data-card',
  'nav-link',
  'utility-image',
]

const VS_SECTIONS: { id: string; label: string; groupKey?: ToolboxGroupId }[] = [
  { id: 'common', label: 'Common Controls' },
  { id: 'layout', label: 'Containers (Bố cục & Khung)', groupKey: 'layout' },
  { id: 'typography', label: 'Typography (Văn bản & Nhãn)', groupKey: 'typography' },
  { id: 'buttons', label: 'Buttons (Nút & Hành động)', groupKey: 'buttons' },
  { id: 'forms', label: 'Forms (Biểu mẫu & Ô nhập)', groupKey: 'forms' },
  { id: 'data', label: 'Data (Dữ liệu & Thẻ)', groupKey: 'data' },
  { id: 'navigation', label: 'Navigation (Điều hướng & Menu)', groupKey: 'navigation' },
  { id: 'feedback', label: 'Feedback (Phản hồi & Cảnh báo)', groupKey: 'feedback' },
  { id: 'marketing', label: 'Marketing (Hero & Tiếp thị)', groupKey: 'marketing' },
  { id: 'utility', label: 'Components (Tiện ích & Media)', groupKey: 'utility' },
]

function startDrag(event: React.DragEvent, item: ToolboxDragItem) {
  toolboxDrag.start(item)
  event.dataTransfer.effectAllowed = 'copy'
  try {
    event.dataTransfer.setData('application/x-pixelmind-toolbox', item.id)
    event.dataTransfer.setData('text/plain', item.name)
  } catch {
    // trình duyệt có thể chặn MIME tùy biến — vẫn dùng toolboxDrag
  }
}

function endDrag() {
  // Trì hoãn để thông điệp drop từ iframe kịp đọc mục đang kéo.
  window.setTimeout(() => toolboxDrag.end(), 400)
}

function elementToDragItem(element: ToolboxElement): ToolboxDragItem {
  return {
    id: element.id,
    name: element.name,
    html: element.html,
    css: element.css,
    source: 'builtin',
  }
}

function partToDragItem(part: Part): ToolboxDragItem {
  return {
    id: `part:${part.id}`,
    name: part.name,
    html: part.html,
    css: part.css,
    source: 'part',
  }
}

function projectToDragItem(component: ProjectComponent): ToolboxDragItem {
  return {
    id: component.id,
    name: component.name,
    html: component.insertHtml,
    source: 'project',
  }
}

/* ─────────────────────── Tab: Phần tử (Visual Studio Tree Accordion) ─────────────────────── */

const ElementCatalogPanel = ({ onShowToast, onNeedPreview }: Pick<ToolboxPanelProps, 'onShowToast' | 'onNeedPreview'>) => {
  const [query, setQuery] = useState('')
  const [selectedTool, setSelectedTool] = useState<string>('pointer')
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = { common: true, layout: true }
    VS_SECTIONS.forEach((s) => {
      init[s.id] = true
    })
    return init
  })
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; element: ToolboxElement } | null>(null)

  useEffect(() => {
    const dismiss = () => setContextMenu(null)
    window.addEventListener('click', dismiss)
    return () => window.removeEventListener('click', dismiss)
  }, [])

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }))
  }

  const toggleAll = () => {
    const allOpen = Object.values(openSections).every(Boolean)
    const next: Record<string, boolean> = {}
    VS_SECTIONS.forEach((s) => {
      next[s.id] = !allOpen
    })
    setOpenSections(next)
  }

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (elements: ToolboxElement[]) => {
      if (!needle) return elements
      return elements.filter((element) =>
        [element.name, element.description, ...element.tags].join(' ').toLowerCase().includes(needle),
      )
    }
  }, [query])

  const sectionData = useMemo(() => {
    return VS_SECTIONS.map((sec) => {
      let elements: ToolboxElement[] = []
      if (sec.id === 'common') {
        const set = new Set(COMMON_CONTROL_IDS)
        elements = TOOLBOX_ELEMENTS.filter((e) => set.has(e.id))
      } else if (sec.groupKey) {
        elements = TOOLBOX_ELEMENTS.filter((e) => e.group === sec.groupKey)
      }
      const matched = filteredItems(elements)
      return {
        ...sec,
        elements: matched,
      }
    })
  }, [filteredItems])

  const totalMatches = useMemo(() => {
    return sectionData.reduce((acc, s) => acc + s.elements.length, 0)
  }, [sectionData])

  const insert = (element: ToolboxElement, placement?: InsertPlacement) => {
    onNeedPreview?.()
    requestToolboxInsert({ item: elementToDragItem(element), placement })
    onShowToast('info', `Đang chèn “${element.name}”…`)
  }

  const copyHtml = (element: ToolboxElement) => {
    void navigator.clipboard.writeText(element.html)
    onShowToast('ok', `Đã sao chép mã HTML của “${element.name}”.`)
  }

  const copyCss = (element: ToolboxElement) => {
    if (element.css) {
      void navigator.clipboard.writeText(element.css)
      onShowToast('ok', `Đã sao chép mã CSS của “${element.name}”.`)
    }
  }

  return (
    <div className="pm-toolbox-body">
      <div className="pm-toolbox-search">
        <Search size={12} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
          placeholder="Tìm công cụ (Button, TextBox, Container…)"
        />
        {query && (
          <button className="pm-toolbox-search__clear" onClick={() => setQuery('')} title="Xoá tìm kiếm">
            ×
          </button>
        )}
        <button
          className="pm-toolbox-search__clear"
          style={{ width: 'auto', padding: '0 4px', fontSize: 10, color: 'var(--text-3)' }}
          onClick={toggleAll}
          title="Mở rộng / Thu gọn tất cả nhóm"
        >
          <ChevronDown size={11} />
        </button>
      </div>

      <div className="pm-toolbox-tree">
        {sectionData.map((sec) => {
          if (query.trim() && sec.elements.length === 0) return null
          const isOpen = query.trim() ? true : !!openSections[sec.id]

          return (
            <div key={sec.id} className="pm-toolbox-accordion">
              <div
                className="pm-toolbox-accordion__hd"
                onClick={() => toggleSection(sec.id)}
                title={`${sec.label} (${sec.elements.length} mục)`}
              >
                <ChevronDown
                  size={12}
                  className={`pm-toolbox-accordion__arrow ${isOpen ? '' : 'collapsed'}`}
                />
                <span className="pm-toolbox-accordion__title">{sec.label}</span>
                <span className="pm-toolbox-accordion__count">{sec.elements.length}</span>
              </div>

              {isOpen && (
                <div className="pm-toolbox-accordion__items">
                  {/* Mục 1: Pointer (Con trỏ) chuẩn Visual Studio 2022 */}
                  <div
                    className={`pm-toolbox-item ${selectedTool === `pointer_${sec.id}` || (selectedTool === 'pointer' && sec.id === 'common') ? 'is-selected' : ''}`}
                    onClick={() => setSelectedTool(`pointer_${sec.id}`)}
                    title="Pointer: Con trỏ chọn phần tử mặc định"
                  >
                    <span className="pm-toolbox-item__icon">
                      <MousePointer2 size={13} />
                    </span>
                    <span className="pm-toolbox-item__name">Pointer</span>
                  </div>

                  {sec.elements.map((element) => {
                    const Icon = getControlIcon(element)
                    const isSelected = selectedTool === element.id

                    return (
                      <div
                        key={element.id}
                        className={`pm-toolbox-item ${isSelected ? 'is-selected' : ''}`}
                        tabIndex={0}
                        draggable
                        onDragStart={(event) => {
                          setSelectedTool(element.id)
                          startDrag(event, elementToDragItem(element))
                        }}
                        onDragEnd={endDrag}
                        onClick={() => setSelectedTool(element.id)}
                        onDoubleClick={() => insert(element)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            insert(element)
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setSelectedTool(element.id)
                          setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            element,
                          })
                        }}
                        title={`${element.name}: ${element.description}\n• Nhấp đúp hoặc Enter để chèn trực tiếp\n• Kéo vào trang để chọn vị trí chèn\n• Chuột phải để mở menu thao tác.`}
                      >
                        <span className={`pm-toolbox-item__icon pm-toolbox-item__icon--${element.group}`}>
                          <Icon size={13} />
                        </span>
                        <span className="pm-toolbox-item__name">{element.name}</span>
                        <button
                          className="pm-toolbox-item__add"
                          title={`Chèn ${element.name} (Enter / Double-click)`}
                          onClick={(event) => {
                            event.stopPropagation()
                            insert(element)
                          }}
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {query.trim() && totalMatches === 0 && (
          <div className="pm-toolbox-empty">
            <Search size={20} />
            <strong>Không tìm thấy công cụ phù hợp</strong>
            <span>Thử từ khoá khác như button, card, header, input…</span>
          </div>
        )}
      </div>

      {/* Menu chuột phải trên phần tử Toolbox */}
      {contextMenu && (
        <div
          className="pm-toolbox-context-menu"
          style={{
            position: 'fixed',
            left: Math.min(window.innerWidth - 220, contextMenu.x),
            top: Math.min(window.innerHeight - 240, contextMenu.y),
            zIndex: 9999,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pm-toolbox-context-menu__hd">
            <span className="pm-toolbox-context-menu__tag">{contextMenu.element.name}</span>
          </div>

          <button
            className="pm-toolbox-context-menu__item"
            onClick={() => {
              insert(contextMenu.element)
              setContextMenu(null)
            }}
          >
            <Plus size={13} />
            <span>Chèn vào trang</span>
          </button>

          <button
            className="pm-toolbox-context-menu__item"
            onClick={() => {
              insert(contextMenu.element, 'after')
              setContextMenu(null)
            }}
          >
            <ArrowDownToLine size={13} />
            <span>Chèn sau phần tử đang chọn</span>
          </button>

          {contextMenu.element.container && (
            <button
              className="pm-toolbox-context-menu__item"
              onClick={() => {
                insert(contextMenu.element, 'inside')
                setContextMenu(null)
              }}
            >
              <ArrowRightToLine size={13} />
              <span>Chèn vào trong phần tử đang chọn</span>
            </button>
          )}

          <div className="pm-toolbox-context-menu__divider" />

          <button
            className="pm-toolbox-context-menu__item"
            onClick={() => {
              copyHtml(contextMenu.element)
              setContextMenu(null)
            }}
          >
            <Copy size={13} />
            <span>Sao chép mã HTML</span>
          </button>

          {contextMenu.element.css && (
            <button
              className="pm-toolbox-context-menu__item"
              onClick={() => {
                copyCss(contextMenu.element)
                setContextMenu(null)
              }}
            >
              <Copy size={13} />
              <span>Sao chép mã CSS</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────── Tab: Linh kiện mẫu ─────────────────────── */

const PartPreviewImage = ({ src, alt }: { src?: string; alt: string }) => {
  const [hasError, setHasError] = useState(false)

  if (hasError || !src) {
    return (
      <div className="pm-part-fallback-preview">
        <Package size={22} style={{ opacity: 0.4 }} />
        <span style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{alt}</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      onError={() => setHasError(true)}
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
    />
  )
}

interface PartLibraryPanelProps {
  projectPath?: string
  onShowToast: (kind: 'ok' | 'err' | 'info', text: string) => void
  onNeedPreview?: () => void
  onCountChange?: (count: number) => void
}

const PartLibraryPanel = ({
  projectPath,
  onShowToast,
  onNeedPreview,
  onCountChange,
}: PartLibraryPanelProps) => {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<string>('all')
  const [customParts, setCustomParts] = useState<CustomToolboxPart[]>([])
  const [createModalOpen, setCreateModalOpen] = useState(false)

  const loadCustomParts = useCallback(async () => {
    try {
      const res = await api.toolbox.listParts(projectPath)
      if (res.success && Array.isArray(res.parts)) {
        setCustomParts(res.parts)
        onCountChange?.(res.parts.length)
      }
    } catch {
      // ignore
    }
  }, [projectPath, onCountChange])

  useEffect(() => {
    void loadCustomParts()
    const handleUpdate = () => void loadCustomParts()
    window.addEventListener('pm:custom-parts-changed', handleUpdate)
    return () => window.removeEventListener('pm:custom-parts-changed', handleUpdate)
  }, [loadCustomParts])

  const customAsParts: (Part & { isCustom?: boolean })[] = useMemo(() => {
    return customParts.map((cp) => ({
      id: cp.id,
      name: cp.name,
      groups: ['Tự tạo', ...(cp.tags || []).filter((t) => t !== 'custom')],
      tags: cp.tags || ['custom'],
      version: '1.0',
      designMd: '',
      author: 'Bạn',
      origin: 'Dự án',
      license: 'Tự do',
      status: 'approved',
      locked: false,
      demo: false,
      uses: 0,
      rejects: 0,
      updated: new Date(cp.updatedAt).toISOString().split('T')[0],
      note: cp.description,
      preview: cp.preview,
      html: cp.html,
      css: cp.css || '',
      prompt: cp.description || 'Linh kiện tự tạo từ vùng chọn',
      metaText: '',
      files: [],
      draggable: true,
      isCustom: true,
    }))
  }, [customParts])

  const allParts = useMemo(() => [...customAsParts, ...PARTS], [customAsParts])

  const groups = useMemo(() => {
    const set = new Set<string>()
    if (customParts.length > 0) set.add('Tự tạo')
    allParts.forEach((part) => part.groups.forEach((item) => set.add(item)))
    return Array.from(set).slice(0, 16)
  }, [customParts.length, allParts])

  const filtered = useMemo(
    () => allParts.filter((part) => (group === 'all' || part.groups.includes(group)) && matchesQuery(part, query)),
    [allParts, query, group],
  )

  const insert = (part: Part) => {
    if (!part.draggable) {
      onShowToast('err', part.blockReason || 'Linh kiện này chưa thể chèn.')
      return
    }
    onNeedPreview?.()
    requestToolboxInsert({ item: partToDragItem(part) })
    onShowToast('info', `Đã gửi “${part.name}” tới canvas.`)
  }

  const copy = (part: Part) => {
    void navigator.clipboard.writeText(part.html)
    onShowToast('ok', `Đã sao chép mã của “${part.name}”.`)
  }

  const handleDeleteCustom = async (part: Part) => {
    if (!confirm(`Bạn có chắc muốn xoá linh kiện “${part.name}”?`)) return
    try {
      const res = await api.toolbox.deletePart(part.id, projectPath)
      if (res.success) {
        onShowToast('ok', `Đã xoá linh kiện “${part.name}”.`)
        void loadCustomParts()
      } else {
        onShowToast('err', res.error || 'Xoá linh kiện thất bại.')
      }
    } catch (err: any) {
      onShowToast('err', `Lỗi: ${err?.message || ''}`)
    }
  }

  return (
    <div className="pm-toolbox-body">
      <div style={{ display: 'flex', gap: 6, padding: '0 8px 6px' }}>
        <div className="pm-toolbox-search" style={{ flex: 1, margin: 0 }}>
          <Search size={12} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
            placeholder="Tìm linh kiện mẫu…"
          />
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={() => setCreateModalOpen(true)}
          title="Tạo Part mới từ mã HTML/CSS hoặc tải ảnh"
          style={{ height: 28, padding: '0 10px', fontSize: 11, whiteSpace: 'nowrap', gap: 4 }}
        >
          <Plus size={13} />
          <span>Tạo Part</span>
        </button>
      </div>

      <div className="pm-toolbox-groups">
        <button className={`pm-toolbox-group ${group === 'all' ? 'active' : ''}`} onClick={() => setGroup('all')}>
          <Package size={12} /> Tất cả <em>{allParts.length}</em>
        </button>
        {groups.map((item) => {
          const count = item === 'Tự tạo' ? customParts.length : allParts.filter((p) => p.groups.includes(item)).length
          return (
            <button
              key={item}
              className={`pm-toolbox-group ${group === item ? 'active' : ''}`}
              onClick={() => setGroup(item)}
            >
              {item} <em>{count}</em>
            </button>
          )
        })}
      </div>

      <div className="pm-toolbox-parts">
        {filtered.map((part: any) => (
          <div
            key={part.id}
            className={`pm-toolbox-part ${part.draggable ? '' : 'is-blocked'}`}
            draggable={part.draggable}
            onDragStart={(event) => part.draggable && startDrag(event, partToDragItem(part))}
            onDragEnd={endDrag}
          >
            <div className="pm-toolbox-part__preview">
              <PartPreviewImage src={part.preview} alt={part.name} />
            </div>
            <div className="pm-toolbox-part__body">
              <div className="pm-toolbox-part__hd">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <strong title={part.name}>{part.name}</strong>
                  {part.isCustom && (
                    <span className="pm-toolbox-part__badge-custom">
                      Tự tạo
                    </span>
                  )}
                </div>
                <span className="version-tag">v{part.version}</span>
              </div>
              <p>{part.prompt || part.tags.slice(0, 4).join(' · ')}</p>
              {!part.draggable && <em className="pm-toolbox-part__block">{part.blockReason}</em>}
              <div className="pm-toolbox-part__actions">
                <button className="btn secondary" onClick={() => copy(part)} title="Sao chép mã HTML">
                  <Copy size={11} /> Sao chép
                </button>
                {part.isCustom && (
                  <button
                    className="btn secondary btn-danger-hover"
                    onClick={() => handleDeleteCustom(part)}
                    title="Xoá linh kiện này"
                    style={{ padding: '0 7px' }}
                  >
                    <Trash2 size={11} />
                  </button>
                )}
                <button
                  className="btn primary btn-insert"
                  onClick={() => insert(part)}
                  disabled={!part.draggable}
                  title="Chèn linh kiện vào trang hiện tại"
                >
                  <Plus size={11} /> Chèn vào trang
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <SavePartModal
        open={createModalOpen}
        initialHtml=""
        initialCss=""
        language="html"
        projectPath={projectPath}
        title="Tạo Part mới cho Thư viện"
        subtitle="Nhập mã HTML, CSS hoặc tải ảnh xem trước từ máy tính để thêm linh kiện vào Hộp công cụ."
        onClose={() => setCreateModalOpen(false)}
        onSaved={(_part) => {
          void loadCustomParts()
          window.dispatchEvent(new CustomEvent('pm:custom-parts-changed'))
        }}
        onShowToast={onShowToast}
      />
    </div>
  )
}

/* ─────────────────────── Tab: Của dự án ─────────────────────── */

interface ProjectSectionProps {
  title: string
  hint: string
  items: ProjectComponent[]
  onInsert: (item: ProjectComponent) => void
}

const ProjectSection = ({ title, hint, items, onInsert }: ProjectSectionProps) => {
  const [open, setOpen] = useState(true)
  if (items.length === 0) return null
  return (
    <section className="pm-toolbox-section">
      <button className="pm-toolbox-section__hd" onClick={() => setOpen((value) => !value)}>
        <span className={`pm-toolbox-caret ${open ? 'open' : ''}`}>▸</span>
        <strong>{title}</strong>
        <em>{items.length}</em>
        <span className="pm-toolbox-section__hint">{hint}</span>
      </button>
      {open && (
        <div className="pm-toolbox-section__body">
          {items.map((item) => (
            <div
              key={item.id}
              className="pm-toolbox-project-item"
              draggable
              onDragStart={(event) => startDrag(event, projectToDragItem(item))}
              onDragEnd={endDrag}
              onClick={() => onInsert(item)}
              title={`${item.path}\nBấm để chèn.`}
            >
              <span className="pm-toolbox-project-item__kind">{item.kind}</span>
              <span className="pm-toolbox-project-item__name">{item.name}</span>
              <span className="pm-toolbox-project-item__path">{item.detail}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

const ProjectPartsPanel = ({
  projectPath,
  onShowToast,
  onNeedPreview,
}: Pick<ToolboxPanelProps, 'projectPath' | 'onShowToast' | 'onNeedPreview'>) => {
  const [result, setResult] = useState<ProjectScanResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')

  const scan = useCallback(async () => {
    if (!projectPath) {
      setResult(null)
      return
    }
    setLoading(true)
    try {
      const next = await api.toolbox.scan(projectPath)
      setResult(next)
      if (!next.success) onShowToast('err', next.error || 'Không quét được dự án.')
    } catch {
      onShowToast('err', 'Không quét được dự án.')
    } finally {
      setLoading(false)
    }
  }, [projectPath, onShowToast])

  useEffect(() => {
    void scan()
  }, [scan])

  const filter = useCallback(
    (items: ProjectComponent[]) => {
      const needle = query.trim().toLowerCase()
      if (!needle) return items
      return items.filter((item) =>
        [item.name, item.path, item.detail].join(' ').toLowerCase().includes(needle),
      )
    },
    [query],
  )

  const insert = (item: ProjectComponent) => {
    onNeedPreview?.()
    requestToolboxInsert({ item: projectToDragItem(item) })
    onShowToast('info', `Đã gửi “${item.name}” tới canvas.`)
  }

  const total =
    (result?.components.length ?? 0) +
    (result?.classes.length ?? 0) +
    (result?.assets.length ?? 0) +
    (result?.routes.length ?? 0)

  if (!projectPath) {
    return (
      <div className="pm-toolbox-empty">
        <Boxes size={20} />
        <strong>Chưa mở dự án</strong>
        <span>Mở một thư mục dự án để quét component, class và tài nguyên.</span>
      </div>
    )
  }

  return (
    <div className="pm-toolbox-body">
      <div className="pm-toolbox-search">
        <Search size={12} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
          placeholder="Tìm component, class, tài nguyên…"
        />
        <button className="pm-toolbox-search__clear" onClick={() => void scan()} title="Quét lại dự án">
          {loading ? <Loader2 size={12} className="pm-spin" /> : <RefreshCw size={12} />}
        </button>
      </div>

      <div className="pm-toolbox-meta">
        <span>{total} mục</span>
        <span>Framework: <b>{result?.framework ?? '—'}</b></span>
      </div>

      {loading && !result ? (
        <div className="pm-toolbox-empty">
          <Loader2 size={20} className="pm-spin" />
          <strong>Đang quét dự án…</strong>
          <span>Component, partial, class CSS và tài nguyên sẽ xuất hiện ở đây.</span>
        </div>
      ) : total === 0 ? (
        <div className="pm-toolbox-empty">
          <Boxes size={20} />
          <strong>Chưa phát hiện mục nào</strong>
          <span>Dự án chưa có component/partial/class phù hợp để tái sử dụng.</span>
        </div>
      ) : (
        <div className="pm-toolbox-sections">
          <ProjectSection
            title="Component / Partial"
            hint="Tái sử dụng khối giao diện"
            items={filter(result?.components ?? [])}
            onInsert={insert}
          />
          <ProjectSection
            title="Class CSS"
            hint="Gắn class có sẵn"
            items={filter(result?.classes ?? [])}
            onInsert={insert}
          />
          <ProjectSection
            title="Tài nguyên"
            hint="Ảnh & icon trong dự án"
            items={filter(result?.assets ?? [])}
            onInsert={insert}
          />
          <ProjectSection
            title="Route"
            hint="Liên kết tới trang có sẵn"
            items={filter(result?.routes ?? [])}
            onInsert={insert}
          />
        </div>
      )}
    </div>
  )
}

/* ─────────────────────── Khung chính ─────────────────────── */

const ToolboxPanel = ({ projectPath, onShowToast, onNeedPreview }: ToolboxPanelProps) => {
  const [tab, setTab] = useState<ToolboxTab>('elements')
  const [projectCount, setProjectCount] = useState<number | null>(null)
  const [customPartCount, setCustomPartCount] = useState(0)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    const dismiss = () => setIsMenuOpen(false)
    window.addEventListener('click', dismiss)
    return () => window.removeEventListener('click', dismiss)
  }, [])

  const refreshProject = useCallback(() => {
    if (!projectPath) return
    api.toolbox
      .scan(projectPath)
      .then((result) => {
        setProjectCount(
          result.components.length + result.classes.length + result.assets.length + result.routes.length,
        )
        onShowToast('ok', `Đã quét dự án: phát hiện ${result.components.length} component, ${result.classes.length} class, ${result.routes.length} route.`)
      })
      .catch(() => {
        onShowToast('err', 'Không quét được dự án.')
      })
  }, [projectPath, onShowToast])

  useEffect(() => {
    let mounted = true
    if (!projectPath) {
      setProjectCount(null)
      return
    }
    api.toolbox
      .scan(projectPath)
      .then((result) => {
        if (!mounted) return
        setProjectCount(
          result.components.length + result.classes.length + result.assets.length + result.routes.length,
        )
      })
      .catch(() => {
        if (mounted) setProjectCount(null)
      })
    return () => {
      mounted = false
    }
  }, [projectPath])

  return (
    <div className="pm-toolbox">
      <div className="pm-ws-hd" style={{ position: 'relative' }}>
        <span className="pm-ws-hd__title">
          <Boxes size={13} /> Hộp công cụ
        </span>
        <div className="pm-ws-hd__actions" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="pm-toolbox-kbd">Ctrl+Alt+X</span>
          <button
            className="pm-ibtn"
            onClick={(e) => {
              e.stopPropagation()
              setIsMenuOpen((v) => !v)
            }}
            title="Tùy chọn Hộp công cụ"
          >
            <MoreHorizontal size={13} />
          </button>
        </div>

        {isMenuOpen && (
          <div
            className="pm-toolbox-context-menu"
            style={{
              position: 'absolute',
              top: '100%',
              right: 6,
              zIndex: 999,
              marginTop: 2,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="pm-toolbox-context-menu__item"
              onClick={() => {
                refreshProject()
                setIsMenuOpen(false)
              }}
            >
              <RefreshCw size={12} />
              <span>Quét lại dự án</span>
            </button>
            <button
              className="pm-toolbox-context-menu__item"
              onClick={() => {
                onShowToast('info', `Hộp công cụ PixelMind: 60 phần tử chuẩn, ${PARTS.length} linh kiện mẫu.`)
                setIsMenuOpen(false)
              }}
            >
              <Package size={12} />
              <span>Thông tin catalog</span>
            </button>
          </div>
        )}
      </div>

      <div className="pm-toolbox-tabs">
        <button className={tab === 'elements' ? 'active' : ''} onClick={() => setTab('elements')}>
          Phần tử <em>{TOOLBOX_ELEMENT_COUNT}</em>
        </button>
        <button className={tab === 'parts' ? 'active' : ''} onClick={() => setTab('parts')}>
          Linh kiện <em>{PARTS.length + customPartCount}</em>
        </button>
        <button className={tab === 'project' ? 'active' : ''} onClick={() => setTab('project')}>
          Của dự án <em>{projectCount ?? '…'}</em>
        </button>
      </div>

      {tab === 'elements' && <ElementCatalogPanel onShowToast={onShowToast} onNeedPreview={onNeedPreview} />}
      {tab === 'parts' && (
        <PartLibraryPanel
          projectPath={projectPath}
          onShowToast={onShowToast}
          onNeedPreview={onNeedPreview}
          onCountChange={setCustomPartCount}
        />
      )}
      {tab === 'project' && (
        <ProjectPartsPanel projectPath={projectPath} onShowToast={onShowToast} onNeedPreview={onNeedPreview} />
      )}
    </div>
  )
}

export default ToolboxPanel
