import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Boxes,
  GitFork,
  Maximize2,
  Package,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { ProjectPage } from '@shared/types'
import '../styles/pageFlow.css'

interface PageFlowMapProps {
  projectName: string
  pages: ProjectPage[]
  previewUrl?: string | null
  currentRoute?: string | null
  onOpenRoute: (route: string) => void
  onClose: () => void
}

interface GraphNode {
  id: string
  page?: ProjectPage
  route: string
  title: string
  groupKey: string
  groupLabel: string
  isHome: boolean
}

interface Point {
  x: number
  y: number
}

const normalizeRoute = (route: string) => {
  const value = (route || '/').trim() || '/'
  return value.length > 1 ? value.replace(/\/+$/, '') : '/'
}

const buildParamRoute = (page: ProjectPage, param: string) => {
  const base = page.route.replace(/\/+$/, '')
  const cleanParam = param.trim().replace(/^\/+/, '')
  if (!cleanParam) return base || '/'
  if (base.includes(':id') || base.includes('{id}') || base.includes(':param')) {
    return base.replace(/:id|\{id\}|:param/g, cleanParam)
  }
  return `${base}/${cleanParam}`
}

const joinPreviewUrl = (base: string, route: string) => {
  const cleanBase = base.replace(/\/+$/, '')
  const cleanRoute = route.startsWith('/') ? route : `/${route}`
  return `${cleanBase}${cleanRoute === '/' ? '/' : cleanRoute}`
}

const getGroupKey = (route: string): string => {
  const clean = normalizeRoute(route).toLowerCase()
  const seg = clean.split('/').filter(Boolean)[0] || 'other'
  if (['account', 'identity', 'auth', 'login', 'register', 'user', 'manage'].includes(seg)) return 'auth'
  if (['product', 'products', 'item', 'items', 'category', 'categories', 'shop', 'catalog'].includes(seg)) return 'catalog'
  if (['cart', 'checkout', 'order', 'orders', 'payment', 'bill'].includes(seg)) return 'order'
  if (['leaderboard', 'lobby', 'room', 'rank', 'match', 'game', 'play'].includes(seg)) return 'activity'
  if (['admin', 'setting', 'settings', 'dashboard', 'report'].includes(seg)) return 'admin'
  return 'general'
}

const GROUP_META: Record<string, { label: string; color: string }> = {
  auth: { label: 'Tài khoản & Xác thực', color: '#6366f1' },
  catalog: { label: 'Sản phẩm & Danh mục', color: '#0ea5e9' },
  order: { label: 'Đơn hàng & Giỏ hàng', color: '#f59e0b' },
  activity: { label: 'Bảng xếp hạng & Hoạt động', color: '#ec4899' },
  admin: { label: 'Quản trị hệ thống', color: '#8b5cf6' },
  general: { label: 'Trang chức năng', color: '#10b981' },
}

const NODE_W = 224
const HOME_W = 260
const PREVIEW_RATIO = 0.62
const LABEL_H = 38
const HOME_H = Math.round((HOME_W - 2) * PREVIEW_RATIO) + LABEL_H + 4
const NODE_H = Math.round((NODE_W - 2) * PREVIEW_RATIO) + LABEL_H + 4
const COL_GAP = 52
const ROW_GAP = 28
const GROUP_HEADER_H = 34

export default function PageFlowMap({
  projectName,
  pages,
  previewUrl,
  currentRoute,
  onOpenRoute,
  onClose,
}: PageFlowMapProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)
  const [stageSize, setStageSize] = useState({ width: 900, height: 560 })
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 })
  const [dragging, setDragging] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [productByPage, setProductByPage] = useState<Record<string, string>>({})

  const baseUrl = useMemo(() => {
    if (!previewUrl) return null
    try {
      const parsed = new URL(previewUrl)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
      return parsed.origin
    } catch {
      return null
    }
  }, [previewUrl])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  useEffect(() => {
    const element = stageRef.current
    if (!element) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect && rect.width > 0 && rect.height > 0) {
        setStageSize({ width: rect.width, height: rect.height })
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Bố cục sơ đồ phân cấp theo cấu trúc thư mục & nhóm chuyên mục
  const layout = useMemo(() => {
    const homePage = pages.find((page) => normalizeRoute(page.route) === '/')
    const homeNode: GraphNode = {
      id: homePage ? `page:${homePage.id}` : 'root',
      page: homePage,
      route: '/',
      title: homePage?.title || 'Trang chủ',
      groupKey: 'home',
      groupLabel: 'Trang chủ',
      isHome: true,
    }

    const otherPages = pages.filter((page) => page.id !== homePage?.id)

    // Nhóm các trang theo chuyên mục
    const groupMap = new Map<string, GraphNode[]>()
    for (const page of otherPages) {
      const norm = normalizeRoute(page.route)
      const groupKey = getGroupKey(norm)
      const groupLabel = GROUP_META[groupKey]?.label || 'Trang chức năng'
      const node: GraphNode = {
        id: `page:${page.id}`,
        page,
        route: norm,
        title: page.title || norm,
        groupKey,
        groupLabel,
        isHome: false,
      }
      if (!groupMap.has(groupKey)) groupMap.set(groupKey, [])
      groupMap.get(groupKey)!.push(node)
    }

    const groups = [...groupMap.entries()].map(([key, nodes]) => ({
      key,
      meta: GROUP_META[key] || { label: 'Trang chức năng', color: '#10b981' },
      nodes,
    }))

    // Tính toán tọa độ lưới phân tầng rõ ràng, thẩm mỹ
    const numCols = Math.max(1, groups.length)
    const totalColsWidth = numCols * NODE_W + (numCols - 1) * COL_GAP
    const startX = 60
    const homeX = startX + totalColsWidth / 2
    const homeY = 60

    const positions = new Map<string, Point>()
    const groupHeaders: { key: string; label: string; color: string; count: number; x: number; y: number }[] = []
    const busLines: { from: Point; to: Point; color?: string }[] = []

    // Đặt vị trí Trang chủ ở đỉnh trung tâm
    positions.set(homeNode.id, { x: homeX, y: homeY })

    const groupStartY = homeY + HOME_H / 2 + 70
    let maxY = groupStartY

    // Tọa độ bus line ngang từ Trang chủ tỏa ra các cột
    const busY = homeY + HOME_H / 2 + 35
    const homeBottom: Point = { x: homeX, y: homeY + HOME_H / 2 }
    busLines.push({ from: homeBottom, to: { x: homeX, y: busY } })

    let minColCenterX = Number.POSITIVE_INFINITY
    let maxColCenterX = Number.NEGATIVE_INFINITY

    groups.forEach((group, colIdx) => {
      const colCenterX = startX + colIdx * (NODE_W + COL_GAP) + NODE_W / 2
      minColCenterX = Math.min(minColCenterX, colCenterX)
      maxColCenterX = Math.max(maxColCenterX, colCenterX)

      // Đầu cột: Tiêu đề nhóm
      const headerY = groupStartY
      groupHeaders.push({
        key: group.key,
        label: group.meta.label,
        color: group.meta.color,
        count: group.nodes.length,
        x: colCenterX,
        y: headerY,
      })

      // Đường nối dọc từ bus bar xuống đầu cột nhóm
      busLines.push({
        from: { x: colCenterX, y: busY },
        to: { x: colCenterX, y: headerY - 14 },
        color: group.meta.color,
      })

      // Đặt vị trí các thẻ trang trong cột
      let cardY = headerY + GROUP_HEADER_H / 2 + 16 + NODE_H / 2
      group.nodes.forEach((node, nodeIdx) => {
        positions.set(node.id, { x: colCenterX, y: cardY })

        // Dây nối giữa các thẻ trang trong cùng cột
        if (nodeIdx > 0) {
          busLines.push({
            from: { x: colCenterX, y: cardY - NODE_H / 2 - ROW_GAP },
            to: { x: colCenterX, y: cardY - NODE_H / 2 },
            color: group.meta.color,
          })
        }

        maxY = Math.max(maxY, cardY + NODE_H / 2)
        cardY += NODE_H + ROW_GAP
      })
    })

    // Dây bus ngang kết nối các cột
    if (minColCenterX !== Number.POSITIVE_INFINITY && maxColCenterX !== Number.NEGATIVE_INFINITY) {
      busLines.push({
        from: { x: minColCenterX, y: busY },
        to: { x: maxColCenterX, y: busY },
      })
    }

    const worldW = Math.max(stageSize.width, startX * 2 + totalColsWidth + 120)
    const worldH = Math.max(stageSize.height, maxY + 80)

    return {
      homeNode,
      groups,
      allNodes: [homeNode, ...otherPages.map((p) => ({
        id: `page:${p.id}`,
        page: p,
        route: normalizeRoute(p.route),
        title: p.title || p.route,
        groupKey: getGroupKey(normalizeRoute(p.route)),
        groupLabel: GROUP_META[getGroupKey(normalizeRoute(p.route))]?.label || 'Trang chức năng',
        isHome: false,
      }))],
      positions,
      groupHeaders,
      busLines,
      worldW,
      worldH,
    }
  }, [pages, stageSize.width, stageSize.height])

  const fitView = useCallback(() => {
    const zoom = Math.max(
      0.35,
      Math.min(1.15, Math.min(stageSize.width / layout.worldW, stageSize.height / layout.worldH) * 0.94),
    )
    setView({
      zoom,
      panX: (stageSize.width - layout.worldW * zoom) / 2,
      panY: 15,
    })
  }, [stageSize.width, stageSize.height, layout.worldW, layout.worldH])

  useEffect(() => {
    fitView()
  }, [fitView])

  const zoomBy = (factor: number) => {
    setView((previous) => {
      const zoom = Math.min(2, Math.max(0.3, previous.zoom * factor))
      const ratio = zoom / previous.zoom
      const cx = stageSize.width / 2
      const cy = stageSize.height / 2
      return {
        zoom,
        panX: cx - (cx - previous.panX) * ratio,
        panY: cy - (cy - previous.panY) * ratio,
      }
    })
  }

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.stopPropagation()
    const factor = event.deltaY < 0 ? 1.08 : 0.92
    zoomBy(factor)
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    const target = event.target as HTMLElement
    if (target.closest('.pm-flow__node') || target.closest('.pm-flow__zoom') || target.closest('.pm-flow__topbar')) return
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      panX: view.panX,
      panY: view.panY,
    }
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    setView((previous) => ({
      ...previous,
      panX: drag.panX + event.clientX - drag.startX,
      panY: drag.panY + event.clientY - drag.startY,
    }))
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null
    setDragging(false)
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // ignore
    }
  }

  const openRoute = (route: string) => {
    onOpenRoute(route)
    onClose()
  }

  const selectProduct = (pageId: string, param: string) => {
    setProductByPage((prev) => ({ ...prev, [pageId]: param }))
  }

  const filteredQuery = searchQuery.trim().toLowerCase()
  const totalDynamicPages = pages.filter((p) => (p.sampleParams?.length ?? 0) > 0).length

  return (
    <div className="pm-flow pm-flow--inline" onPointerDown={(event) => event.stopPropagation()}>
      {/* ── Thanh công cụ đỉnh Sơ đồ ── */}
      <div className="pm-flow__topbar">
        <div className="pm-flow__topbar-title">
          <span className="pm-flow__topbar-icon">
            <GitFork size={14} />
          </span>
          <div>
            <b>Sơ đồ chức năng dự án ({projectName})</b>
            <span>Tự động sắp xếp phân cấp theo chuyên mục · Bấm để xem trước trang</span>
          </div>
        </div>

        {/* Ô tìm kiếm trang nhanh */}
        <div className="pm-flow__search-box">
          <Search size={12} className="pm-flow__search-icon" />
          <input
            className="pm-flow__search-input"
            type="text"
            placeholder="Tìm theo tên trang hoặc route (/login, /product)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="pm-flow__search-clear" onClick={() => setSearchQuery('')}>
              <X size={11} />
            </button>
          )}
        </div>

        <div className="pm-flow__legend">
          <span className="pm-flow__legend-item"><i className="is-home" /> Trang chủ</span>
          <span className="pm-flow__legend-item"><i className="is-page" /> Trang chức năng</span>
          {totalDynamicPages > 0 && (
            <span className="pm-flow__legend-item"><i className="is-dynamic" /> Trang động ({totalDynamicPages})</span>
          )}
        </div>

        <span className="pm-flow__grow" />

        <span className="pm-flow__count">Tổng số: {pages.length} trang</span>
        <button type="button" className="pm-flow__close" title="Đóng sơ đồ (Esc)" onClick={onClose}>
          <X size={14} />
        </button>
      </div>

      {/* ── Sân khấu sơ đồ vô cực ── */}
      <div className="pm-flow__main" style={{ padding: 0 }}>
        <div
          className={`pm-flow__stage ${dragging ? 'is-dragging' : ''}`}
          ref={stageRef}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ borderRadius: 0, border: 0 }}
        >
          <div
            className="pm-flow__world"
            style={{
              width: layout.worldW,
              height: layout.worldH,
              transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`,
            }}
          >
            {/* ── Dây nối đồ thị chuẩn xác (SVG Lines) ── */}
            <svg className="pm-flow__edges" width={layout.worldW} height={layout.worldH}>
              {layout.busLines.map((line, idx) => (
                <path
                  key={`line-${idx}`}
                  d={`M ${line.from.x} ${line.from.y} L ${line.to.x} ${line.to.y}`}
                  className="pm-flow__edge"
                  style={line.color ? { stroke: line.color, opacity: 0.65 } : undefined}
                />
              ))}
            </svg>

            {/* ── Tiêu đề từng cột nhóm chuyên mục ── */}
            {layout.groupHeaders.map((header) => (
              <div
                key={`header-${header.key}`}
                className="pm-flow__group-header"
                style={{
                  left: header.x,
                  top: header.y,
                  borderColor: `${header.color}40`,
                }}
              >
                <span className="pm-flow__group-dot" style={{ background: header.color }} />
                <span className="pm-flow__group-title">{header.label}</span>
                <span className="pm-flow__group-badge" style={{ background: `${header.color}20`, color: header.color }}>
                  {header.count}
                </span>
              </div>
            ))}

            {/* ── Các thẻ trang giao diện ── */}
            {layout.allNodes.map((node) => {
              const position = layout.positions.get(node.id)
              if (!position) return null

              const isHome = node.isHome
              const isCurrent = Boolean(node.page && currentRoute && normalizeRoute(currentRoute) === node.route)
              const cardWidth = isHome ? HOME_W : NODE_W
              const cardHeight = isHome ? HOME_H : NODE_H
              const previewHeight = Math.round((cardWidth - 2) * PREVIEW_RATIO)
              const previewScale = (cardWidth - 2) / 1280

              const sampleParams = node.page?.sampleParams ?? []
              const selectedParam = node.page ? (productByPage[node.page.id] || sampleParams[0]) : undefined

              const effectiveRoute = selectedParam && node.page
                ? buildParamRoute(node.page, selectedParam)
                : node.route

              const iframeSrc = baseUrl && !/[:{}[\]]/.test(effectiveRoute)
                ? joinPreviewUrl(baseUrl, effectiveRoute)
                : null

              const isMatch = filteredQuery ? (
                node.title.toLowerCase().includes(filteredQuery) ||
                node.route.toLowerCase().includes(filteredQuery)
              ) : true

              return (
                <div
                  key={node.id}
                  className={[
                    'pm-flow__node',
                    isHome ? 'is-home' : '',
                    isCurrent ? 'is-current' : '',
                    isMatch ? 'is-match' : 'is-dimmed',
                  ].filter(Boolean).join(' ')}
                  style={{
                    left: position.x,
                    top: position.y,
                    width: cardWidth,
                    height: cardHeight,
                    opacity: isMatch ? 1 : 0.25,
                  }}
                  onClick={() => openRoute(effectiveRoute)}
                  title={`Nhấp đúp hoặc bấm để mở trang: ${node.title} (${effectiveRoute})`}
                >
                  {/* Khung xem trước trực tiếp của trang */}
                  <div className="pm-flow__preview" style={{ height: previewHeight }}>
                    {iframeSrc ? (
                      <iframe
                        className="pm-flow__frame"
                        src={iframeSrc}
                        title={node.title}
                        tabIndex={-1}
                        loading="lazy"
                        style={{
                          width: 1280,
                          height: 800,
                          transform: `scale(${previewScale})`,
                        }}
                      />
                    ) : (
                      <div className="pm-flow__wire" aria-hidden="true">
                        <div className="pm-flow__wire-bar">
                          <i className="pm-flow__wire-dot" />
                          <i className="pm-flow__wire-dot" />
                          <i className="pm-flow__wire-dot" />
                          <span className="pm-flow__wire-url">{effectiveRoute}</span>
                        </div>
                        <div className="pm-flow__wire-body">
                          <div className="pm-flow__wire-hero" />
                          <div className="pm-flow__wire-row">
                            <div className="pm-flow__wire-card" />
                            <div className="pm-flow__wire-card" />
                            <div className="pm-flow__wire-card" />
                          </div>
                          <div className="pm-flow__wire-line is-long" />
                          <div className="pm-flow__wire-line" />
                        </div>
                        <span className="pm-flow__wire-note">Chưa chạy server</span>
                      </div>
                    )}

                    {isCurrent && <span className="pm-flow__preview-tag">Đang mở</span>}

                    {/* Bộ chọn sản phẩm / tham số mẫu hiển thị TRỰC TIẾP TRÊN THẺ TRANG */}
                    {sampleParams.length > 0 && node.page && (
                      <div
                        className="pm-flow__inline-params"
                        onClick={(e) => e.stopPropagation()}
                        title="Đổi nhanh sản phẩm mẫu ngay trên trang này"
                      >
                        <span className="pm-flow__inline-params-label">
                          <Package size={9} /> SP:
                        </span>
                        {sampleParams.map((param) => {
                          const isSel = selectedParam === param
                          return (
                            <button
                              key={param}
                              type="button"
                              className={`pm-flow__param-pill ${isSel ? 'is-active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                selectProduct(node.page!.id, param)
                              }}
                              title={`Nạp Sản phẩm #${param} vào trang này`}
                            >
                              #{param}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Nhãn chân thẻ trang */}
                  <div className="pm-flow__label">
                    <div className="pm-flow__label-row">
                      <span className="pm-flow__label-title">{node.title}</span>
                      <ArrowUpRight size={11} className="pm-flow__open-icon" />
                    </div>
                    <span className="pm-flow__label-route">{effectiveRoute}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Cụm điều khiển Zoom & Căn vừa ── */}
          <div className="pm-flow__zoom">
            <button type="button" title="Thu nhỏ (-)" onClick={() => zoomBy(0.85)}>
              <ZoomOut size={13} />
            </button>
            <button type="button" title="Phóng to (+)" onClick={() => zoomBy(1.15)}>
              <ZoomIn size={13} />
            </button>
            <button type="button" title="Căn vừa toàn bộ sơ đồ" onClick={fitView}>
              <Maximize2 size={13} />
            </button>
            <button
              type="button"
              title="Kích thước thực 100%"
              onClick={() => {
                setView({ zoom: 1, panX: (stageSize.width - layout.worldW) / 2, panY: 20 })
              }}
              style={{ fontSize: 10, fontWeight: 700, padding: '0 4px', width: 'auto' }}
            >
              1:1
            </button>
          </div>

          <div className="pm-flow__hint">
            Kéo chuột để di chuyển · Lăn chuột để zoom · Nhấp vào thẻ để mở trang · Nhấn Esc để thoát
          </div>

          {pages.length === 0 && (
            <div className="pm-flow__empty">
              <Boxes size={24} />
              <b>Chưa có trang nào trong dự án</b>
              <span>Quét lại thư mục hoặc thêm trang để hiển thị sơ đồ.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
