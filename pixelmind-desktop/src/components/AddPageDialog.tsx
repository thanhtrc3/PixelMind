import { useState, useRef, useEffect, useMemo } from 'react'
import { FilePlus2, Image as ImageIcon, Link, Hash, Pencil, Folder, FileText, ChevronRight, CornerDownLeft } from 'lucide-react'
import type { ProjectPage } from '@shared/types'
import Modal from './Modal'

interface AddPageDialogProps {
  projectName: string
  pageToEdit?: ProjectPage | null
  existingPages?: ProjectPage[]
  onAdd: (page: Omit<ProjectPage, 'id'>) => void
  onUpdate?: (page: ProjectPage) => void
  onClose: () => void
}

const SOFTWARES = ['Figma', 'Photoshop', 'Sketch', 'Adobe XD', 'Penpot', 'Khác']
const FRAMES = ['1440×900', '1920×1080', '390×844', '768×1024', '1280×800', 'Khác']

export interface RouteSuggestion {
  route: string
  fullRoute: string
  title: string
  segment: string
  isFolder: boolean
  childCount: number
}

function computeSuggestions(input: string, pages: ProjectPage[]): RouteSuggestion[] {
  if (!pages || pages.length === 0) return []

  const raw = input.trim()
  if (!raw.startsWith('/')) return []

  const lastSlashIndex = raw.lastIndexOf('/')
  const parentPath = raw.slice(0, lastSlashIndex) // "" hoặc "/Product"
  const currentQuery = raw.slice(lastSlashIndex + 1).toLowerCase()

  const list: RouteSuggestion[] = []
  const seen = new Set<string>()

  // 1. Tầng gốc (parentPath === ""): ví dụ gõ "/" hoặc "/p"
  if (parentPath === '') {
    for (const p of pages) {
      const pr = p.route.startsWith('/') ? p.route : `/${p.route}`
      if (pr === '/') {
        if (currentQuery === '' && !seen.has('/')) {
          seen.add('/')
          list.push({
            route: '/',
            fullRoute: '/',
            title: p.title || 'Trang chủ',
            segment: '/',
            isFolder: false,
            childCount: 0,
          })
        }
        continue
      }

      const parts = pr.slice(1).split('/') // ['Product', 'Delete']
      const topSeg = parts[0]
      const topRoute = `/${topSeg}`

      if (topSeg.toLowerCase().startsWith(currentQuery)) {
        if (!seen.has(topRoute)) {
          seen.add(topRoute)
          const children = pages.filter((item) => {
            const ir = item.route.startsWith('/') ? item.route : `/${item.route}`
            return ir.toLowerCase().startsWith(topRoute.toLowerCase() + '/')
          })
          const directMatch = pages.find((item) => item.route.toLowerCase() === topRoute.toLowerCase())
          list.push({
            route: topRoute,
            fullRoute: topRoute,
            title: directMatch?.title || topSeg,
            segment: topSeg,
            isFolder: children.length > 0,
            childCount: children.length,
          })
        }
      }
    }
  } else {
    // 2. Tầng con (ví dụ parentPath === "/Product"):
    for (const p of pages) {
      const pr = p.route.startsWith('/') ? p.route : `/${p.route}`
      if (pr.toLowerCase().startsWith(parentPath.toLowerCase() + '/')) {
        const subRest = pr.slice(parentPath.length + 1)
        const parts = subRest.split('/')
        const nextSeg = parts[0]
        const fullSub = `${parentPath}/${nextSeg}`

        if (nextSeg.toLowerCase().startsWith(currentQuery)) {
          if (!seen.has(fullSub)) {
            seen.add(fullSub)
            const children = pages.filter((item) => {
              const ir = item.route.startsWith('/') ? item.route : `/${item.route}`
              return ir.toLowerCase().startsWith(fullSub.toLowerCase() + '/')
            })
            list.push({
              route: fullSub,
              fullRoute: fullSub,
              title: p.title || nextSeg,
              segment: nextSeg,
              isFolder: children.length > 0,
              childCount: children.length,
            })
          }
        }
      }
    }

    // 3. Tầng tham số mẫu (ví dụ parentPath === "/Product/Delete" có sampleParams: ['1', '2'])
    const parentPage = pages.find((p) => {
      const pr = p.route.startsWith('/') ? p.route : `/${p.route}`
      return pr.toLowerCase() === parentPath.toLowerCase()
    })
    if (parentPage && parentPage.sampleParams) {
      for (const param of parentPage.sampleParams) {
        if (param.toLowerCase().startsWith(currentQuery)) {
          const fullParam = `${parentPath}/${param}`
          if (!seen.has(fullParam)) {
            seen.add(fullParam)
            list.push({
              route: fullParam,
              fullRoute: fullParam,
              title: `${parentPage.title} #${param}`,
              segment: param,
              isFolder: false,
              childCount: 0,
            })
          }
        }
      }
    }
  }

  return list
}

const AddPageDialog = ({
  projectName,
  pageToEdit,
  existingPages = [],
  onAdd,
  onUpdate,
  onClose,
}: AddPageDialogProps) => {
  const isEditing = Boolean(pageToEdit)

  const [route, setRoute] = useState(pageToEdit?.route ?? '/')
  const [title, setTitle] = useState(pageToEdit?.title ?? '')
  const [navLinkSelector, setNavLinkSelector] = useState(pageToEdit?.navLinkSelector ?? '')
  const [sampleParams, setSampleParams] = useState(pageToEdit?.sampleParams?.join(', ') ?? '')
  const [mockup, setMockup] = useState(pageToEdit?.mockup ?? false)
  const [software, setSoftware] = useState(pageToEdit?.software || 'Figma')
  const [frame, setFrame] = useState(pageToEdit?.frame || '1440×900')
  const [error, setError] = useState('')

  // Autocomplete state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const routeInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Tính toán gợi ý từ danh sách các trang THẬT của dự án
  const suggestions = useMemo(() => {
    return computeSuggestions(route, existingPages)
  }, [route, existingPages])

  useEffect(() => {
    setHighlightIndex(0)
  }, [suggestions])

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (
        routeInputRef.current &&
        !routeInputRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleDocumentClick)
    return () => document.removeEventListener('mousedown', handleDocumentClick)
  }, [])

  const handleSelectSuggestion = (s: RouteSuggestion, forceExact = false) => {
    if (s.isFolder && !forceExact) {
      // Nếu là thư mục / controller có trang con (ví dụ /Product):
      // Gán '/Product/' để người dùng ngay lập tức thấy các trang con: Add, Delete, Display, Update
      const nextRoute = `${s.route}/`
      setRoute(nextRoute)
      setIsDropdownOpen(true)
      if (!title || title === 'Trang web') {
        setTitle(s.title)
      }
      setTimeout(() => {
        routeInputRef.current?.focus()
      }, 50)
    } else {
      // Nếu là trang cụ thể (hoặc chọn chính xác trang này)
      setRoute(s.fullRoute)
      setIsDropdownOpen(false)
      if (!title || title === 'Trang web' || title === s.segment) {
        setTitle(s.title)
      }
      setError('')
      setTimeout(() => {
        routeInputRef.current?.focus()
      }, 50)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && route.startsWith('/')) {
        setIsDropdownOpen(true)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((prev) => (prev + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter') {
      if (suggestions[highlightIndex]) {
        e.preventDefault()
        handleSelectSuggestion(suggestions[highlightIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsDropdownOpen(false)
    }
  }

  const submit = () => {
    const cleanRoute = route.trim()
    const cleanTitle = title.trim()
    if (!cleanRoute) {
      setError('Hãy nhập route, ví dụ /Product.')
      return
    }
    if (!cleanTitle) {
      setError('Hãy nhập tiêu đề trang.')
      return
    }
    const normalized = cleanRoute.startsWith('/') ? cleanRoute : `/${cleanRoute}`
    const parsedParams = sampleParams
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    if (isEditing && pageToEdit) {
      onUpdate?.({
        ...pageToEdit,
        route: normalized,
        title: cleanTitle,
        mockup,
        software: mockup ? software : '—',
        frame: mockup ? frame : '—',
        navLinkSelector: navLinkSelector.trim() || undefined,
        sampleParams: parsedParams.length > 0 ? parsedParams : undefined,
      })
    } else {
      onAdd({
        route: normalized,
        title: cleanTitle,
        mockup,
        software: mockup ? software : '—',
        frame: mockup ? frame : '—',
        navLinkSelector: navLinkSelector.trim() || undefined,
        sampleParams: parsedParams.length > 0 ? parsedParams : undefined,
      })
    }
  }

  return (
    <Modal
      title={isEditing ? `Sửa trang · ${pageToEdit?.title}` : 'Thêm trang mới'}
      subtitle={
        isEditing
          ? `Cập nhật route và thông tin cho ${projectName}.`
          : `Khai báo một route của ${projectName} để theo dõi và xem trước.`
      }
      icon={isEditing ? <Pencil size={16} /> : <FilePlus2 size={16} />}
      width={540}
      onClose={onClose}
      footer={
        <>
          <span className="grow">
            {error ? <span style={{ color: 'var(--color-error-text)' }}>{error}</span> : 'Không tạo tệp mới trên đĩa.'}
          </span>
          <button className="btn" onClick={onClose}>
            Huỷ
          </button>
          <button className="btn primary" onClick={submit}>
            {isEditing ? <Pencil size={12} /> : <FilePlus2 size={12} />} {isEditing ? 'Lưu thay đổi' : 'Thêm trang'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13, width: '100%', padding: '2px 2px 6px' }}>
        {/* Ô NHẬP ROUTE VỚI INTELLISENSE TỰ ĐỘNG GỢI Ý CÁC TRANG THẬT */}
        <div className="pm-field" style={{ position: 'relative' }}>
          <label htmlFor="page-route" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Route (Đường dẫn trang)</span>
            <span style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 400 }}>
              Gõ <span className="mono">/</span> để hiện danh mục thực tế của dự án
            </span>
          </label>
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              id="page-route"
              ref={routeInputRef}
              className="pm-input mono"
              placeholder="/Product hoặc /Product/Delete"
              value={route}
              autoComplete="off"
              onFocus={() => {
                if (route.startsWith('/')) setIsDropdownOpen(true)
              }}
              onChange={(e) => {
                const val = e.target.value
                setRoute(val)
                setError('')
                if (val.startsWith('/')) {
                  setIsDropdownOpen(true)
                } else {
                  setIsDropdownOpen(false)
                }
              }}
              onKeyDown={handleKeyDown}
            />

            {/* DROPDOWN GỢI Ý ĐƯỜNG DẪN DỰ ÁN (INTELLISENSE POPUP) */}
            {isDropdownOpen && suggestions.length > 0 && (
              <div
                ref={dropdownRef}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  zIndex: 120,
                  background: 'var(--panel)',
                  border: '1px solid var(--line-2)',
                  borderRadius: 8,
                  boxShadow: 'var(--shadow-xl, 0 12px 30px rgba(0,0,0,0.25))',
                  maxHeight: 240,
                  overflowY: 'auto',
                  padding: 4,
                }}
              >
                <div
                  style={{
                    padding: '4px 8px 6px',
                    fontSize: 10.5,
                    color: 'var(--text-3)',
                    borderBottom: '1px solid var(--line)',
                    marginBottom: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Các trang có trong dự án ({suggestions.length})</span>
                  <span>↑↓ điều hướng · Enter chọn</span>
                </div>

                {suggestions.map((s, idx) => {
                  const isHighlighted = idx === highlightIndex
                  return (
                    <div
                      key={s.fullRoute}
                      onMouseEnter={() => setHighlightIndex(idx)}
                      onClick={() => handleSelectSuggestion(s)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        background: isHighlighted ? 'var(--accent-soft, rgba(99, 102, 241, 0.12))' : 'transparent',
                        transition: 'background 80ms ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                        {s.isFolder ? (
                          <Folder size={13} style={{ color: 'var(--accent, #6366f1)', flexShrink: 0 }} />
                        ) : (
                          <FileText size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                        )}
                        <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                          {s.route}
                        </span>
                        {s.title && s.title !== s.segment && (
                          <span style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            ({s.title})
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {s.isFolder ? (
                          <span
                            style={{
                              fontSize: 10,
                              padding: '1px 5px',
                              borderRadius: 4,
                              background: 'rgba(99, 102, 241, 0.15)',
                              color: 'var(--accent, #6366f1)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 2,
                            }}
                          >
                            {s.childCount} trang sau <ChevronRight size={10} />
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                            <CornerDownLeft size={10} />
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="pm-field">
          <label htmlFor="page-title">Tiêu đề trang</label>
          <input
            id="page-title"
            className="pm-input"
            placeholder="Danh Sách Sản Phẩm"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setError('')
            }}
          />
        </div>

        {/* Nơi liên kết đến thành phần giao diện trong dự án đang chạy */}
        <div className="pm-field">
          <label htmlFor="page-nav-link" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Link size={12} /> Thành phần liên kết trong dự án (Nút nav / Selector kích hoạt)
          </label>
          <input
            id="page-nav-link"
            className="pm-input mono"
            placeholder="Ví dụ: a.nav-link[href='/Product'] hoặc nút Product trên nav, nút Tìm kiếm"
            value={navLinkSelector}
            onChange={(e) => setNavLinkSelector(e.target.value)}
          />
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
            Khai báo nút bấm trên Navbar hoặc vị trí trên giao diện dự án liên kết đến trang này.
          </div>
        </div>

        {/* Tham số mẫu (Sample IDs) cho các trang động như /Product/Delete */}
        <div className="pm-field">
          <label htmlFor="page-sample-params" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Hash size={12} /> Tham số / ID sản phẩm mẫu (dành cho trang /Delete, /Display, /Update...)
          </label>
          <input
            id="page-sample-params"
            className="pm-input mono"
            placeholder="Ví dụ: 1, 2, 3, 4, 5 (phân cách bằng dấu phẩy)"
            value={sampleParams}
            onChange={(e) => setSampleParams(e.target.value)}
          />
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
            Khi bạn bấm vào trang này, PixelMind sẽ hiện popup chọn ID xem trước cụ thể (như <span className="mono">/Product/Delete/1</span>).
          </div>
        </div>

        {/* Cấu hình mockup */}
        <div className="pm-setting" style={{ paddingTop: 4 }}>
          <div className="pm-setting__txt">
            <b>Có ảnh mẫu thiết kế</b>
            <span>Bật nếu bạn đã có ảnh tham chiếu Figma / Thiết kế cho trang này.</span>
          </div>
          <div className="pm-setting__ctrl">
            <button
              className={`pm-switch ${mockup ? 'on' : ''}`}
              onClick={() => setMockup((value) => !value)}
              aria-label="Có ảnh mẫu"
            />
          </div>
        </div>

        {mockup && (
          <>
            <div className="pm-field">
              <label htmlFor="page-software">Phần mềm thiết kế</label>
              <select
                id="page-software"
                className="pm-select"
                value={software}
                onChange={(e) => setSoftware(e.target.value)}
              >
                {SOFTWARES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="pm-field">
              <label htmlFor="page-frame">Khung thiết kế</label>
              <select
                id="page-frame"
                className="pm-select"
                value={frame}
                onChange={(e) => setFrame(e.target.value)}
              >
                {FRAMES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="pm-note" style={{ margin: 0 }}>
              <ImageIcon size={12} />
              <span>PixelMind chưa gắn tệp ảnh ở bước này — bạn có thể bổ sung sau khi mở màn hình làm việc.</span>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

export default AddPageDialog
