import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Compass,
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
  groupColor: string
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

const GROUP_META: Record<string, { label: string; color: string; icon: string }> = {
  auth: { label: 'Tài khoản & Xác thực', color: '#6366f1', icon: '👤' },
  catalog: { label: 'Sản phẩm & Danh mục', color: '#0ea5e9', icon: '📦' },
  order: { label: 'Đơn hàng & Giỏ hàng', color: '#f59e0b', icon: '🛒' },
  activity: { label: 'Bảng xếp hạng & Hoạt động', color: '#ec4899', icon: '🏆' },
  admin: { label: 'Quản trị hệ thống', color: '#8b5cf6', icon: '⚙️' },
  general: { label: 'Trang chức năng', color: '#10b981', icon: '⚡' },
}

// Kích thước thẻ lớn hơn, sắc nét, không bị thu nhỏ quá mức
const NODE_W = 270
const HOME_W = 340
const HOME_PREVIEW_H = 180
const NODE_PREVIEW_H = 145
const LABEL_H = 54
const HOME_H = HOME_PREVIEW_H + LABEL_H + 4
const NODE_H = NODE_PREVIEW_H + LABEL_H + 4
const COL_GAP = 68
const ROW_GAP = 28
const GROUP_HEADER_H = 38
const SPINE_OFFSET = 24

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
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null)
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
      groupColor: '#6366f1',
      isHome: true,
    }

    const otherPages = pages.filter((page) => page.id !== homePage?.id)

    // Nhóm các trang theo chuyên mục
    const groupMap = new Map<string, GraphNode[]>()
    for (const page of otherPages) {
      const norm = normalizeRoute(page.route)
      const groupKey = getGroupKey(norm)
      const meta = GROUP_META[groupKey] || { label: 'Trang chức năng', color: '#10b981', icon: '⚡' }
      const node: GraphNode = {
        id: `page:${page.id}`,
        page,
        route: norm,
        title: page.title || norm,
        groupKey,
        groupLabel: meta.label,
        groupColor: meta.color,
        isHome: false,
      }
      if (!groupMap.has(groupKey)) groupMap.set(groupKey, [])
      groupMap.get(groupKey)!.push(node)
    }

    const groups = [...groupMap.entries()].map(([key, nodes]) => ({
      key,
      meta: GROUP_META[key] || { label: 'Trang chức năng', color: '#10b981', icon: '⚡' },
      nodes,
    }))

    // Tính toán tọa độ dạng Cây Phân cấp chuyên nghiệp (Hierarchical Tree / Flow)
    const numCols = Math.max(1, groups.length)
    const totalColsWidth = numCols * NODE_W + (numCols - 1) * COL_GAP
    const startX = 80
    const homeX = startX + totalColsWidth / 2
    const homeY = 60

    const positions = new Map<string, Point>()
    const groupHeaders: { key: string; label: string; color: string; count: number; x: number; y: number }[] = []
    
    // Cổng rẽ nhánh trên Trang chủ (Menu Navigation Ports)
    const homeNavPorts: { key: string; label: string; color: string; x: number; y: number }[] = []
    
    // Dây nối rẽ nhánh uốn lượn có mũi tên định hướng
    const branchCurves: {
      id: string
      groupKey: string
      color: string
      from: Point
      to: Point
      type: 'home-to-group' | 'spine-to-card'
    }[] = []

    // Đường ray dọc cho mỗi cột chuyên mục (Spine Rails)
    const spineRails: {
      groupKey: string
      color: string
      from: Point
      to: Point
    }[] = []

    // Đặt vị trí Trang chủ ở đỉnh trung tâm
    positions.set(homeNode.id, { x: homeX, y: homeY })

    // Tính các cổng rẽ nhánh trên Trang chủ
    const navBarY = homeY + HOME_H / 2 - 12
    const portWidth = 50
    const totalPortsWidth = groups.length * portWidth
    const portsStartX = homeX - totalPortsWidth / 2 + portWidth / 2

    groups.forEach((group, idx) => {
      homeNavPorts.push({
        key: group.key,
        label: group.meta.label,
        color: group.meta.color,
        x: portsStartX + idx * portWidth,
        y: navBarY,
      })
    })

    const groupStartY = homeY + HOME_H / 2 + 84
    let maxY = groupStartY

    groups.forEach((group, colIdx) => {
      const colCenterX = startX + colIdx * (NODE_W + COL_GAP) + NODE_W / 2
      const cardLeftX = colCenterX - NODE_W / 2
      const spineX = cardLeftX - SPINE_OFFSET

      // 1. Tiêu đề nhóm chuyên mục ở đỉnh cột
      const headerY = groupStartY
      groupHeaders.push({
        key: group.key,
        label: group.meta.label,
        color: group.meta.color,
        count: group.nodes.length,
        x: colCenterX,
        y: headerY,
      })

      // 2. Dây nối uốn lượn hình chữ S từ cổng Trang chủ xuống tiêu đề nhóm
      const port = homeNavPorts.find((p) => p.key === group.key)
      const portPoint: Point = port ? { x: port.x, y: port.y + 12 } : { x: homeX, y: homeY + HOME_H / 2 }
      branchCurves.push({
        id: `home->header-${group.key}`,
        groupKey: group.key,
        color: group.meta.color,
        from: portPoint,
        to: { x: colCenterX, y: headerY - GROUP_HEADER_H / 2 },
        type: 'home-to-group',
      })

      // 3. Đường ray phân phối nhánh dọc bên trái cột thẻ (Spine Rail)
      let firstCardCenterY = headerY + GROUP_HEADER_H / 2 + 24 + NODE_H / 2
      let lastCardCenterY = firstCardCenterY + (group.nodes.length - 1) * (NODE_H + ROW_GAP)

      // Dây nối từ chân tiêu đề nhóm rẽ sang đường ray cột
      branchCurves.push({
        id: `header->spine-${group.key}`,
        groupKey: group.key,
        color: group.meta.color,
        from: { x: colCenterX, y: headerY + GROUP_HEADER_H / 2 },
        to: { x: spineX, y: firstCardCenterY },
        type: 'spine-to-card',
      })

      // Trục ray dọc
      if (group.nodes.length > 1) {
        spineRails.push({
          groupKey: group.key,
          color: group.meta.color,
          from: { x: spineX, y: firstCardCenterY },
          to: { x: spineX, y: lastCardCenterY },
        })
      }

      // 4. Rẽ nhánh ngang có mũi tên định hướng vào TỪNG THẺ TRANG ĐỘC LẬP
      let cardY = firstCardCenterY
      group.nodes.forEach((node) => {
        positions.set(node.id, { x: colCenterX, y: cardY })

        // Dây nối ngang từ trục ray cắm trực tiếp vào cổng bên trái của thẻ
        branchCurves.push({
          id: `spine->card-${node.id}`,
          groupKey: group.key,
          color: group.meta.color,
          from: { x: spineX, y: cardY },
          to: { x: cardLeftX, y: cardY },
          type: 'spine-to-card',
        })

        maxY = Math.max(maxY, cardY + NODE_H / 2)
        cardY += NODE_H + ROW_GAP
      })
    })

    const worldW = Math.max(stageSize.width, startX * 2 + totalColsWidth + 140)
    const worldH = Math.max(stageSize.height, maxY + 100)

    return {
      homeNode,
      groups,
      allNodes: [homeNode, ...otherPages.map((p) => {
        const norm = normalizeRoute(p.route)
        const groupKey = getGroupKey(norm)
        const meta = GROUP_META[groupKey] || { label: 'Trang chức năng', color: '#10b981', icon: '⚡' }
        return {
          id: `page:${p.id}`,
          page: p,
          route: norm,
          title: p.title || norm,
          groupKey,
          groupLabel: meta.label,
          groupColor: meta.color,
          isHome: false,
        }
      })],
      positions,
      groupHeaders,
      homeNavPorts,
      branchCurves,
      spineRails,
      worldW,
      worldH,
    }
  }, [pages, stageSize.width, stageSize.height])

  const fitView = useCallback(() => {
    const zoom = Math.max(
      0.45,
      Math.min(1.05, Math.min(stageSize.width / layout.worldW, stageSize.height / layout.worldH) * 0.94),
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
      const zoom = Math.min(2.2, Math.max(0.35, previous.zoom * factor))
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
            <span>Nhìn đường nối để biết nguồn gốc điều hướng · Nhấp thẻ để mở trang chức năng</span>
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
            {/* ── Dây nối đồ thị chuyên nghiệp với mũi tên định hướng (SVG Lines & Arrows) ── */}
            <svg className="pm-flow__edges" width={layout.worldW} height={layout.worldH}>
              <defs>
                {/* Mũi tên định hướng cho từng nhóm màu */}
                {Object.entries(GROUP_META).map(([key, meta]) => (
                  <marker
                    key={`marker-${key}`}
                    id={`flow-arrow-${key}`}
                    viewBox="0 0 10 10"
                    refX="7"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 8 5 L 0 9 z" fill={meta.color} />
                  </marker>
                ))}
                <marker
                  id="flow-arrow-default"
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#94a3b8" />
                </marker>
              </defs>

              {/* Các trục ray dọc bên trái mỗi cột */}
              {layout.spineRails.map((rail, idx) => (
                <path
                  key={`rail-${idx}`}
                  d={`M ${rail.from.x} ${rail.from.y} L ${rail.to.x} ${rail.to.y}`}
                  className="pm-flow__spine-rail"
                  style={{ stroke: rail.color, opacity: hoveredGroupId === rail.groupKey ? 0.9 : 0.45 }}
                />
              ))}

              {/* Dây nối rẽ nhánh uốn lượn tới từng trang */}
              {layout.branchCurves.map((curve) => {
                const isHovered = hoveredGroupId === curve.groupKey
                const markerId = `url(#flow-arrow-${curve.groupKey || 'default'})`

                // Đường cong mượt mà hình chữ S (Bezier)
                const dy = curve.to.y - curve.from.y

                let d = ''
                if (curve.type === 'home-to-group') {
                  const midY = curve.from.y + dy * 0.5
                  d = `M ${curve.from.x} ${curve.from.y} C ${curve.from.x} ${midY}, ${curve.to.x} ${midY}, ${curve.to.x} ${curve.to.y}`
                } else {
                  // Nhánh ngang từ trục ray vào thẻ
                  d = `M ${curve.from.x} ${curve.from.y} L ${curve.to.x} ${curve.to.y}`
                }

                return (
                  <path
                    key={curve.id}
                    d={d}
                    className="pm-flow__edge"
                    markerEnd={curve.type === 'spine-to-card' ? markerId : undefined}
                    style={{
                      stroke: curve.color,
                      opacity: isHovered ? 0.95 : 0.5,
                      strokeWidth: isHovered ? 2.2 : 1.6,
                    }}
                  />
                )
              })}
            </svg>

            {/* ── Tiêu đề từng cột nhóm chuyên mục ── */}
            {layout.groupHeaders.map((header) => (
              <div
                key={`header-${header.key}`}
                className="pm-flow__group-header"
                style={{
                  left: header.x,
                  top: header.y,
                  borderColor: `${header.color}45`,
                }}
                onMouseEnter={() => setHoveredGroupId(header.key)}
                onMouseLeave={() => setHoveredGroupId(null)}
              >
                <span className="pm-flow__group-dot" style={{ background: header.color }} />
                <span className="pm-flow__group-title">{header.label}</span>
                <span className="pm-flow__group-badge" style={{ background: `${header.color}25`, color: header.color }}>
                  {header.count} trang
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
              const previewHeight = isHome ? HOME_PREVIEW_H : NODE_PREVIEW_H

              // Kích thước iframe mô phỏng màn hình chuẩn máy tính bảng (600px - 760px)
              // Giúp chữ, tiêu đề, menu to hơn 2.5 lần và CỰC KỲ SẮC NÉT, không bị vỡ mờ!
              const iframeWidth = isHome ? 760 : 600
              const iframeHeight = Math.round(iframeWidth * (previewHeight / (cardWidth - 2)))
              const previewScale = (cardWidth - 2) / iframeWidth

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
                    opacity: isMatch ? 1 : 0.22,
                    borderColor: isCurrent ? '#22c55e' : `${node.groupColor}40`,
                  }}
                  onMouseEnter={() => setHoveredGroupId(node.groupKey)}
                  onMouseLeave={() => setHoveredGroupId(null)}
                  onClick={() => openRoute(effectiveRoute)}
                  title={`Bấm để mở trang: ${node.title} (${effectiveRoute})`}
                >
                  {/* Cổng kết nối vào bên trái thẻ (Input Port) */}
                  {!isHome && (
                    <span
                      className="pm-flow__input-port"
                      style={{ background: node.groupColor, boxShadow: `0 0 8px ${node.groupColor}` }}
                      title={`Nhận luồng điều hướng từ chuyên mục ${node.groupLabel}`}
                    />
                  )}

                  {/* Khung xem trước trực tiếp độ nét cao */}
                  <div className="pm-flow__preview" style={{ height: previewHeight }}>
                    {iframeSrc ? (
                      <iframe
                        className="pm-flow__frame"
                        src={iframeSrc}
                        title={node.title}
                        tabIndex={-1}
                        loading="lazy"
                        style={{
                          width: iframeWidth,
                          height: iframeHeight,
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

                  {/* Nhãn chân thẻ trang & Nút mở trực tiếp rõ ràng */}
                  <div className="pm-flow__label">
                    <div className="pm-flow__label-row">
                      <div className="pm-flow__label-copy">
                        <span className="pm-flow__label-title">{node.title}</span>
                        <span className="pm-flow__label-route">{effectiveRoute}</span>
                      </div>
                      
                      {/* Nút bấm trực quan: Nhìn vào là biết bấm để mở ngay! */}
                      <button
                        type="button"
                        className="pm-flow__cta-btn"
                        style={{
                          borderColor: `${node.groupColor}60`,
                          color: node.groupColor,
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          openRoute(effectiveRoute)
                        }}
                        title={`Mở trực tiếp trang ${node.title}`}
                      >
                        <span>Mở</span>
                        <ArrowUpRight size={11} />
                      </button>
                    </div>

                    {/* Nếu là Trang chủ: Hiển thị các cổng rẽ nhánh menu bên dưới */}
                    {isHome && (
                      <div className="pm-flow__home-nav-bar" onClick={(e) => e.stopPropagation()}>
                        <span className="pm-flow__home-nav-hint">
                          <Compass size={10} /> Menu điều hướng:
                        </span>
                        <div className="pm-flow__home-nav-items">
                          {layout.groups.map((g) => (
                            <span
                              key={g.key}
                              className="pm-flow__home-nav-chip"
                              style={{ borderColor: `${g.meta.color}60`, color: g.meta.color }}
                              onMouseEnter={() => setHoveredGroupId(g.key)}
                              onMouseLeave={() => setHoveredGroupId(null)}
                              title={`Chuyên mục: ${g.meta.label} (${g.nodes.length} trang)`}
                            >
                              {g.meta.label.split('&')[0].trim()} <ArrowRight size={9} />
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
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
            <span className="pm-flow__zoom-badge">{Math.round(view.zoom * 100)}%</span>
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
              style={{ fontSize: 10, fontWeight: 700, padding: '0 6px', width: 'auto' }}
            >
              1:1
            </button>
          </div>

          <div className="pm-flow__hint">
            Kéo chuột để di chuyển · Lăn chuột để zoom · Nhấp vào nút "Mở ↗" hoặc thẻ để xem trang · Nhấn Esc để thoát
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
