import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Compass,
  LayoutGrid,
  Maximize2,
  RefreshCw,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { ProjectPage } from '@shared/types'
import '../styles/multiPageCanvas.css'

interface MultiPageCanvasProps {
  projectName: string
  pages: ProjectPage[]
  previewUrl?: string | null
  currentRoute?: string | null
  onOpenPage: (route: string) => void
  onClose: () => void
}

interface CanvasWin {
  id: string
  page?: ProjectPage
  route: string
  title: string
  isHome: boolean
  x: number // Tọa độ tâm cửa sổ trên canvas vô cực
  y: number
  w: number
  h: number
  zIndex: number
  groupKey: string
  groupLabel: string
  groupColor: string
  sourceHint: {
    text: string
    relX: number // Tỷ lệ vị trí trên trang chủ (0..1)
    relY: number
  }
}

type LayoutMode = 'cluster' | 'rings'

const normalizeRoute = (route: string) => {
  const value = (route || '/').trim() || '/'
  return value.length > 1 ? value.replace(/\/+$/, '') : '/'
}

const joinPreviewUrl = (base: string, route: string) => {
  const cleanBase = (base || '').replace(/\/+$/, '')
  const cleanRoute = (route || '/').startsWith('/') ? route : `/${route}`
  return `${cleanBase}${cleanRoute === '/' ? '/' : cleanRoute}`
}

const getGroupInfo = (route: string) => {
  const clean = normalizeRoute(route).toLowerCase()
  const seg = clean.split('/').filter(Boolean)[0] || 'other'
  if (['account', 'identity', 'auth', 'login', 'register', 'user', 'manage'].includes(seg)) {
    return {
      groupKey: 'auth',
      groupLabel: 'Tài khoản & Xác thực',
      groupColor: '#818cf8',
      sourceText: clean.includes('login') ? 'Nút [Đăng nhập]' : clean.includes('reg') ? 'Nút [Đăng ký]' : 'Menu [Tài khoản]',
      relX: clean.includes('reg') ? 0.88 : 0.80,
      relY: 0.055,
    }
  }
  if (['product', 'products', 'item', 'items', 'category', 'categories', 'shop', 'catalog'].includes(seg)) {
    return {
      groupKey: 'catalog',
      groupLabel: 'Sản phẩm & Danh mục',
      groupColor: '#38bdf8',
      sourceText: 'Menu [Sản phẩm]',
      relX: 0.32,
      relY: 0.055,
    }
  }
  if (['cart', 'checkout', 'order', 'orders', 'payment', 'bill'].includes(seg)) {
    return {
      groupKey: 'order',
      groupLabel: 'Đơn hàng & Giỏ hàng',
      groupColor: '#fbbf24',
      sourceText: 'Icon [Giỏ hàng]',
      relX: 0.68,
      relY: 0.055,
    }
  }
  if (['leaderboard', 'lobby', 'room', 'rank', 'match', 'game', 'play'].includes(seg)) {
    return {
      groupKey: 'activity',
      groupLabel: 'Bảng xếp hạng & Kỳ đài',
      groupColor: '#f472b6',
      sourceText: 'Menu [Bảng xếp hạng]',
      relX: 0.48,
      relY: 0.055,
    }
  }
  if (['admin', 'setting', 'settings', 'dashboard', 'report'].includes(seg)) {
    return {
      groupKey: 'admin',
      groupLabel: 'Quản trị hệ thống',
      groupColor: '#c084fc',
      sourceText: 'Menu [Quản trị]',
      relX: 0.94,
      relY: 0.055,
    }
  }
  return {
    groupKey: 'general',
    groupLabel: 'Trang chức năng',
    groupColor: '#34d399',
    sourceText: 'Liên kết điều hướng',
    relX: 0.20,
    relY: 0.055,
  }
}

// Kích thước chuẩn các cửa sổ
const HOME_WIDTH = 840
const HOME_HEIGHT = 520
const SATELLITE_WIDTH = 380
const SATELLITE_HEIGHT = 260
const GAP_X = 50
const GAP_Y = 40
const STEP_X = SATELLITE_WIDTH + GAP_X // 430
const STEP_Y = SATELLITE_HEIGHT + GAP_Y // 300
const SAFE_MARGIN = 120

// ─── THUẬT TOÁN GIẢI TỎA VA CHẠM (COLLISION RELAXATION SOLVER) ───
function resolveCollisions(windows: CanvasWin[]): CanvasWin[] {
  const result = windows.map((w) => ({ ...w }))
  const PAD_X = 50
  const PAD_Y = 40

  for (let iter = 0; iter < 18; iter++) {
    let moved = false
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i]
        const b = result[j]

        const minDistanceX = (a.w + b.w) / 2 + PAD_X
        const minDistanceY = (a.h + b.h) / 2 + PAD_Y

        const dx = b.x - a.x
        const dy = b.y - a.y
        const overlapX = minDistanceX - Math.abs(dx)
        const overlapY = minDistanceY - Math.abs(dy)

        if (overlapX > 0 && overlapY > 0) {
          moved = true
          if (overlapX < overlapY) {
            const shift = overlapX / 2 + 2
            const sign = dx >= 0 ? 1 : -1
            if (!a.isHome) a.x -= shift * sign
            if (!b.isHome) b.x += shift * sign
          } else {
            const shift = overlapY / 2 + 2
            const sign = dy >= 0 ? 1 : -1
            if (!a.isHome) a.y -= shift * sign
            if (!b.isHome) b.y += shift * sign
          }
        }
      }
    }
    if (!moved) break
  }
  return result
}

// ─── BỐ CỤC 1: PHÂN CỤM THEO HƯỚNG NÚT BẤM (CLUSTER GRID) ───
function computeClusterLayout(homeWin: CanvasWin, otherPages: ProjectPage[]): CanvasWin[] {
  const halfHomeW = HOME_WIDTH / 2
  const halfHomeH = HOME_HEIGHT / 2

  const groups: Record<string, { info: ReturnType<typeof getGroupInfo>; pages: ProjectPage[] }> = {}
  otherPages.forEach((page) => {
    const norm = normalizeRoute(page.route)
    const info = getGroupInfo(norm)
    if (!groups[info.groupKey]) {
      groups[info.groupKey] = { info, pages: [] }
    }
    groups[info.groupKey].pages.push(page)
  })

  const satellites: CanvasWin[] = []

  // 1. Nhóm 'catalog' (Sản phẩm & Danh mục) -> Phía TRÊN
  if (groups.catalog && groups.catalog.pages.length > 0) {
    const items = groups.catalog.pages
    const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(items.length))))
    const rows = Math.ceil(items.length / cols)
    const clusterW = cols * STEP_X - GAP_X
    const clusterH = rows * STEP_Y - GAP_Y
    const centerX = -100
    const centerY = -(halfHomeH + SAFE_MARGIN + clusterH / 2)

    items.forEach((page, idx) => {
      const col = idx % cols
      const row = Math.floor(idx / cols)
      const x = Math.round(centerX - clusterW / 2 + col * STEP_X + SATELLITE_WIDTH / 2)
      const y = Math.round(centerY - clusterH / 2 + row * STEP_Y + SATELLITE_HEIGHT / 2)
      const norm = normalizeRoute(page.route)
      const info = groups.catalog.info
      satellites.push({
        id: `win:${page.id || norm}`,
        page,
        route: norm,
        title: page.title || norm,
        isHome: false,
        x,
        y,
        w: SATELLITE_WIDTH,
        h: SATELLITE_HEIGHT,
        zIndex: 5,
        groupKey: info.groupKey,
        groupLabel: info.groupLabel,
        groupColor: info.groupColor,
        sourceHint: { text: info.sourceText, relX: info.relX, relY: info.relY },
      })
    })
  }

  // 2. Nhóm 'auth' (Tài khoản & Xác thực) -> Phía BÊN PHẢI
  if (groups.auth && groups.auth.pages.length > 0) {
    const items = groups.auth.pages
    const cols = Math.min(4, Math.max(3, Math.ceil(Math.sqrt(items.length))))
    const rows = Math.ceil(items.length / cols)
    const clusterW = cols * STEP_X - GAP_X
    const clusterH = rows * STEP_Y - GAP_Y
    const centerX = halfHomeW + SAFE_MARGIN + clusterW / 2
    const centerY = -100

    items.forEach((page, idx) => {
      const col = idx % cols
      const row = Math.floor(idx / cols)
      const x = Math.round(centerX - clusterW / 2 + col * STEP_X + SATELLITE_WIDTH / 2)
      const y = Math.round(centerY - clusterH / 2 + row * STEP_Y + SATELLITE_HEIGHT / 2)
      const norm = normalizeRoute(page.route)
      const info = groups.auth.info
      satellites.push({
        id: `win:${page.id || norm}`,
        page,
        route: norm,
        title: page.title || norm,
        isHome: false,
        x,
        y,
        w: SATELLITE_WIDTH,
        h: SATELLITE_HEIGHT,
        zIndex: 5,
        groupKey: info.groupKey,
        groupLabel: info.groupLabel,
        groupColor: info.groupColor,
        sourceHint: { text: info.sourceText, relX: info.relX, relY: info.relY },
      })
    })
  }

  // 3. Nhóm 'order' (Đơn hàng & Giỏ hàng) -> Phía DƯỚI BÊN PHẢI
  if (groups.order && groups.order.pages.length > 0) {
    const items = groups.order.pages
    const cols = Math.min(3, Math.max(2, Math.ceil(Math.sqrt(items.length))))
    const rows = Math.ceil(items.length / cols)
    const clusterW = cols * STEP_X - GAP_X
    const clusterH = rows * STEP_Y - GAP_Y
    const centerX = halfHomeW + SAFE_MARGIN + clusterW / 2
    const centerY = halfHomeH + SAFE_MARGIN + clusterH / 2 + 60

    items.forEach((page, idx) => {
      const col = idx % cols
      const row = Math.floor(idx / cols)
      const x = Math.round(centerX - clusterW / 2 + col * STEP_X + SATELLITE_WIDTH / 2)
      const y = Math.round(centerY - clusterH / 2 + row * STEP_Y + SATELLITE_HEIGHT / 2)
      const norm = normalizeRoute(page.route)
      const info = groups.order.info
      satellites.push({
        id: `win:${page.id || norm}`,
        page,
        route: norm,
        title: page.title || norm,
        isHome: false,
        x,
        y,
        w: SATELLITE_WIDTH,
        h: SATELLITE_HEIGHT,
        zIndex: 5,
        groupKey: info.groupKey,
        groupLabel: info.groupLabel,
        groupColor: info.groupColor,
        sourceHint: { text: info.sourceText, relX: info.relX, relY: info.relY },
      })
    })
  }

  // 4. Nhóm 'activity' (Bảng xếp hạng & Kỳ đài) -> Phía DƯỚI
  if (groups.activity && groups.activity.pages.length > 0) {
    const items = groups.activity.pages
    const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(items.length))))
    const rows = Math.ceil(items.length / cols)
    const clusterW = cols * STEP_X - GAP_X
    const clusterH = rows * STEP_Y - GAP_Y
    const centerX = -80
    const centerY = halfHomeH + SAFE_MARGIN + clusterH / 2

    items.forEach((page, idx) => {
      const col = idx % cols
      const row = Math.floor(idx / cols)
      const x = Math.round(centerX - clusterW / 2 + col * STEP_X + SATELLITE_WIDTH / 2)
      const y = Math.round(centerY - clusterH / 2 + row * STEP_Y + SATELLITE_HEIGHT / 2)
      const norm = normalizeRoute(page.route)
      const info = groups.activity.info
      satellites.push({
        id: `win:${page.id || norm}`,
        page,
        route: norm,
        title: page.title || norm,
        isHome: false,
        x,
        y,
        w: SATELLITE_WIDTH,
        h: SATELLITE_HEIGHT,
        zIndex: 5,
        groupKey: info.groupKey,
        groupLabel: info.groupLabel,
        groupColor: info.groupColor,
        sourceHint: { text: info.sourceText, relX: info.relX, relY: info.relY },
      })
    })
  }

  // 5. Nhóm 'admin' & 'general' -> Phía BÊN TRÁI
  const leftItems = [...(groups.admin?.pages || []), ...(groups.general?.pages || [])]
  if (leftItems.length > 0) {
    const cols = Math.min(3, Math.max(2, Math.ceil(Math.sqrt(leftItems.length))))
    const rows = Math.ceil(leftItems.length / cols)
    const clusterW = cols * STEP_X - GAP_X
    const clusterH = rows * STEP_Y - GAP_Y
    const centerX = -(halfHomeW + SAFE_MARGIN + clusterW / 2)
    const centerY = 0

    leftItems.forEach((page, idx) => {
      const col = idx % cols
      const row = Math.floor(idx / cols)
      const x = Math.round(centerX - clusterW / 2 + col * STEP_X + SATELLITE_WIDTH / 2)
      const y = Math.round(centerY - clusterH / 2 + row * STEP_Y + SATELLITE_HEIGHT / 2)
      const norm = normalizeRoute(page.route)
      const info = getGroupInfo(norm)
      satellites.push({
        id: `win:${page.id || norm}`,
        page,
        route: norm,
        title: page.title || norm,
        isHome: false,
        x,
        y,
        w: SATELLITE_WIDTH,
        h: SATELLITE_HEIGHT,
        zIndex: 5,
        groupKey: info.groupKey,
        groupLabel: info.groupLabel,
        groupColor: info.groupColor,
        sourceHint: { text: info.sourceText, relX: info.relX, relY: info.relY },
      })
    })
  }

  // Các trang còn sót lại nếu có
  const processedRoutes = new Set(satellites.map((s) => s.route))
  const remaining = otherPages.filter((p) => !processedRoutes.has(normalizeRoute(p.route)))
  if (remaining.length > 0) {
    remaining.forEach((page, idx) => {
      const norm = normalizeRoute(page.route)
      const info = getGroupInfo(norm)
      satellites.push({
        id: `win:${page.id || norm}`,
        page,
        route: norm,
        title: page.title || norm,
        isHome: false,
        x: -(halfHomeW + SAFE_MARGIN + 240),
        y: 450 + idx * STEP_Y,
        w: SATELLITE_WIDTH,
        h: SATELLITE_HEIGHT,
        zIndex: 5,
        groupKey: info.groupKey,
        groupLabel: info.groupLabel,
        groupColor: info.groupColor,
        sourceHint: { text: info.sourceText, relX: info.relX, relY: info.relY },
      })
    })
  }

  return resolveCollisions([homeWin, ...satellites])
}

// ─── BỐ CỤC 2: QUỸ ĐẠO ĐA TẦNG (MULTI-RING ORBIT) ───
function computeRingsLayout(homeWin: CanvasWin, otherPages: ProjectPage[]): CanvasWin[] {
  const satellites: CanvasWin[] = []
  const count = otherPages.length
  if (count === 0) return [homeWin]

  let pageIdx = 0
  let ringIndex = 0

  while (pageIdx < count) {
    const rx = HOME_WIDTH / 2 + SATELLITE_WIDTH / 2 + 160 + ringIndex * (SATELLITE_WIDTH + 100)
    const ry = HOME_HEIGHT / 2 + SATELLITE_HEIGHT / 2 + 130 + ringIndex * (SATELLITE_HEIGHT + 80)

    const perimeter = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2)
    const capacity = Math.max(6, Math.floor(perimeter / (SATELLITE_WIDTH + 80)))

    const remainingPages = count - pageIdx
    const countInThisRing = Math.min(capacity, remainingPages)

    for (let i = 0; i < countInThisRing; i++) {
      const page = otherPages[pageIdx]
      const norm = normalizeRoute(page.route)
      const info = getGroupInfo(norm)

      const angle = (i / countInThisRing) * 2 * Math.PI - Math.PI / 2
      const x = Math.round(Math.cos(angle) * rx)
      const y = Math.round(Math.sin(angle) * ry)

      satellites.push({
        id: `win:${page.id || norm}`,
        page,
        route: norm,
        title: page.title || norm,
        isHome: false,
        x,
        y,
        w: SATELLITE_WIDTH,
        h: SATELLITE_HEIGHT,
        zIndex: 5,
        groupKey: info.groupKey,
        groupLabel: info.groupLabel,
        groupColor: info.groupColor,
        sourceHint: { text: info.sourceText, relX: info.relX, relY: info.relY },
      })
      pageIdx++
    }
    ringIndex++
  }

  return resolveCollisions([homeWin, ...satellites])
}

export default function MultiPageCanvas({
  projectName,
  pages,
  previewUrl,
  currentRoute,
  onOpenPage,
  onClose,
}: MultiPageCanvasProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const windowsRef = useRef<CanvasWin[]>([])
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('cluster')

  // Khởi tạo cửa sổ ĐỒNG BỘ ngay từ đầu (không để mảng rỗng)
  const [windows, setWindows] = useState<CanvasWin[]>(() => {
    const homePage = pages.find((p) => normalizeRoute(p.route) === '/')
    const otherPages = pages.filter((p) => normalizeRoute(p.route) !== '/')

    const homeWin: CanvasWin = {
      id: homePage ? `win:${homePage.id}` : 'win:home',
      page: homePage,
      route: '/',
      title: homePage?.title || 'Trang chủ',
      isHome: true,
      x: 0,
      y: 0,
      w: HOME_WIDTH,
      h: HOME_HEIGHT,
      zIndex: 10,
      groupKey: 'home',
      groupLabel: 'Trang chủ (Màn hình chuẩn)',
      groupColor: '#6366f1',
      sourceHint: { text: 'Trang chủ gốc', relX: 0.5, relY: 0.5 },
    }

    const initList = computeClusterLayout(homeWin, otherPages)
    windowsRef.current = initList
    return initList
  })

  // Camera viewport: Khởi tạo với tâm Trang chủ ngay giữa màn hình
  const [view, setView] = useState(() => ({
    zoom: 0.38,
    panX: typeof window !== 'undefined' ? Math.round(window.innerWidth / 2) : 540,
    panY: typeof window !== 'undefined' ? Math.round(window.innerHeight / 2) : 340,
  }))

  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)
  const maxZRef = useRef(10)
  const [activeWinId, setActiveWinId] = useState<string | null>(null)
  const [hoveredWinId, setHoveredWinId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Trạng thái kéo cửa sổ
  const dragWinRef = useRef<{
    winId: string
    startMouseX: number
    startMouseY: number
    startWinX: number
    startWinY: number
  } | null>(null)

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

  // Phím tắt bàn phím
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [onClose])

  // Căn vừa toàn bộ các cửa sổ vào màn hình
  const fitBounding = useCallback((customList?: CanvasWin[]) => {
    const list = customList || windowsRef.current
    if (!stageRef.current || !list || list.length === 0) return
    const rect = stageRef.current.getBoundingClientRect()
    const stageW = rect.width > 50 ? rect.width : window.innerWidth
    const stageH = rect.height > 50 ? rect.height : window.innerHeight

    let minX = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY

    list.forEach((win) => {
      minX = Math.min(minX, win.x - win.w / 2)
      maxX = Math.max(maxX, win.x + win.w / 2)
      minY = Math.min(minY, win.y - win.h / 2)
      maxY = Math.max(maxY, win.y + win.h / 2)
    })

    const pad = 90
    const boundW = Math.max(600, maxX - minX + pad * 2)
    const boundH = Math.max(400, maxY - minY + pad * 2)
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    const zoom = Math.max(0.14, Math.min(0.9, Math.min(stageW / boundW, stageH / boundH)))
    const panX = stageW / 2 - centerX * zoom
    const panY = stageH / 2 - centerY * zoom

    setView({ zoom, panX, panY })
  }, [])

  // Áp dụng thuật toán sắp xếp
  const applyLayout = useCallback(
    (mode: LayoutMode) => {
      setLayoutMode(mode)
      const homePage = pages.find((p) => normalizeRoute(p.route) === '/')
      const otherPages = pages.filter((p) => normalizeRoute(p.route) !== '/')

      const homeWin: CanvasWin = {
        id: homePage ? `win:${homePage.id}` : 'win:home',
        page: homePage,
        route: '/',
        title: homePage?.title || 'Trang chủ',
        isHome: true,
        x: 0,
        y: 0,
        w: HOME_WIDTH,
        h: HOME_HEIGHT,
        zIndex: 10,
        groupKey: 'home',
        groupLabel: 'Trang chủ (Màn hình chuẩn)',
        groupColor: '#6366f1',
        sourceHint: { text: 'Trang chủ gốc', relX: 0.5, relY: 0.5 },
      }

      const computed =
        mode === 'rings'
          ? computeRingsLayout(homeWin, otherPages)
          : computeClusterLayout(homeWin, otherPages)

      windowsRef.current = computed
      setWindows(computed)
      fitBounding(computed)
    },
    [pages, fitBounding]
  )

  // Căn vừa màn hình ngay khi mở
  useEffect(() => {
    const t1 = setTimeout(() => fitBounding(), 50)
    const t2 = setTimeout(() => fitBounding(), 250)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [fitBounding, layoutMode])

  // Kéo cửa sổ tự do
  const startDragWindow = (winId: string, e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const targetWin = windows.find((w) => w.id === winId)
    if (!targetWin) return

    maxZRef.current += 1
    const newZ = maxZRef.current
    setActiveWinId(winId)
    setWindows((prev) => {
      const next = prev.map((w) => (w.id === winId ? { ...w, zIndex: newZ } : w))
      windowsRef.current = next
      return next
    })

    dragWinRef.current = {
      winId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startWinX: targetWin.x,
      startWinY: targetWin.y,
    }

    const onPointerMove = (moveEvt: PointerEvent) => {
      if (!dragWinRef.current) return
      const dx = (moveEvt.clientX - dragWinRef.current.startMouseX) / view.zoom
      const dy = (moveEvt.clientY - dragWinRef.current.startMouseY) / view.zoom

      const newX = Math.round(dragWinRef.current.startWinX + dx)
      const newY = Math.round(dragWinRef.current.startWinY + dy)

      setWindows((prev) => {
        const next = prev.map((w) =>
          w.id === dragWinRef.current?.winId ? { ...w, x: newX, y: newY } : w
        )
        windowsRef.current = next
        return next
      })
    }

    const onPointerUp = () => {
      dragWinRef.current = null
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  // Kéo và phóng to sân khấu canvas
  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.pm-win') || (e.target as HTMLElement).closest('.pm-multi-controls')) {
      return
    }
    panStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: view.panX,
      panY: view.panY,
    }
    setIsPanning(true)
  }

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panStartRef.current || !isPanning) return
    const dx = e.clientX - panStartRef.current.startX
    const dy = e.clientY - panStartRef.current.startY
    setView((prev) => ({
      ...prev,
      panX: panStartRef.current!.panX + dx,
      panY: panStartRef.current!.panY + dy,
    }))
  }

  const handleStagePointerUp = () => {
    panStartRef.current = null
    setIsPanning(false)
  }

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const factor = e.deltaY < 0 ? 1.08 : 0.92
    const newZoom = Math.min(2.0, Math.max(0.12, view.zoom * factor))
    const ratio = newZoom / view.zoom

    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    setView((prev) => ({
      zoom: newZoom,
      panX: mouseX - (mouseX - prev.panX) * ratio,
      panY: mouseY - (mouseY - prev.panY) * ratio,
    }))
  }

  // ─── TÍNH TOÁN DÂY NỐI TỪ NÚT BẤM TRÊN TRANG CHỦ TỚI CÁC TRANG VỆ TINH ───
  const homeWin = windows.find((w) => w.isHome) || windows[0]

  const wires = useMemo(() => {
    if (!homeWin) return []

    const homeLeft = homeWin.x - homeWin.w / 2
    const homeTop = homeWin.y - homeWin.h / 2

    return windows
      .filter((w) => !w.isHome)
      .map((sat) => {
        const hint = sat.sourceHint || { text: 'Điều hướng', relX: 0.5, relY: 0.055 }
        const srcX = homeLeft + homeWin.w * hint.relX
        const srcY = homeTop + 34 + (homeWin.h - 34) * hint.relY

        const dxFromHome = sat.x - homeWin.x
        const dyFromHome = sat.y - homeWin.y

        let destX = sat.x
        let destY = sat.y
        let portSide: 'top' | 'bottom' | 'left' | 'right' = 'left'

        if (Math.abs(dxFromHome) > Math.abs(dyFromHome) * 1.15) {
          if (dxFromHome >= 0) {
            portSide = 'left'
            destX = sat.x - sat.w / 2
            destY = sat.y
          } else {
            portSide = 'right'
            destX = sat.x + sat.w / 2
            destY = sat.y
          }
        } else {
          if (dyFromHome <= 0) {
            portSide = 'bottom'
            destX = sat.x
            destY = sat.y + sat.h / 2
          } else {
            portSide = 'top'
            destX = sat.x
            destY = sat.y - sat.h / 2
          }
        }

        // Đảm bảo không bao giờ bị NaN
        if (!Number.isFinite(srcX) || !Number.isFinite(srcY) || !Number.isFinite(destX) || !Number.isFinite(destY)) {
          return null
        }

        let cp1X = srcX
        let cp1Y = srcY
        let cp2X = destX
        let cp2Y = destY

        if (portSide === 'left' || portSide === 'right') {
          const deltaX = destX - srcX
          cp1X = srcX + deltaX * 0.45
          cp1Y = srcY
          cp2X = destX - deltaX * 0.45
          cp2Y = destY
        } else {
          const deltaY = destY - srcY
          cp1X = srcX
          cp1Y = srcY + deltaY * 0.45
          cp2X = destX
          cp2Y = destY - deltaY * 0.45
        }

        const pathD = `M ${srcX} ${srcY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${destX} ${destY}`
        const midX = (srcX + destX) / 2
        const midY = (srcY + destY) / 2

        return {
          id: `wire-${sat.id}`,
          satId: sat.id,
          color: sat.groupColor || '#6366f1',
          label: hint.text,
          pathD,
          portSide,
          srcPoint: { x: srcX, y: srcY },
          destPoint: { x: destX, y: destY },
          midPoint: { x: midX, y: midY },
        }
      })
      .filter((w): w is NonNullable<typeof w> => w !== null)
  }, [windows, homeWin])

  const portSideMap = useMemo(() => {
    const map: Record<string, 'top' | 'bottom' | 'left' | 'right'> = {}
    wires.forEach((w) => {
      map[w.satId] = w.portSide
    })
    return map
  }, [wires])

  const filteredQuery = searchQuery.trim().toLowerCase()

  return (
    <div className="pm-multi-canvas" onPointerDown={(e) => e.stopPropagation()}>
      {/* ── TopBar điều khiển ── */}
      <div className="pm-multi-topbar">
        <div className="pm-multi-topbar__title">
          <span className="pm-multi-topbar__icon">
            <LayoutGrid size={15} />
          </span>
          <div className="pm-multi-topbar__text">
            <b>Không gian Đa màn hình ({projectName})</b>
            <span>Tự động sắp xếp thông minh · Kéo thanh tiêu đề để di chuyển · Dây nối từ nút bấm</span>
          </div>
        </div>

        <div className="pm-multi-topbar__spacer" />

        {/* Chuyển đổi chế độ sắp xếp tự động */}
        <div className="pm-multi-layout-toggles">
          <button
            className={`pm-multi-topbar__btn ${layoutMode === 'cluster' ? 'active' : ''}`}
            onClick={() => applyLayout('cluster')}
            title="Tự động xếp theo cụm chuyên mục (Tránh chồng chéo 100%)"
          >
            <LayoutGrid size={12} /> Xếp theo cụm
          </button>
          <button
            className={`pm-multi-topbar__btn ${layoutMode === 'rings' ? 'active' : ''}`}
            onClick={() => applyLayout('rings')}
            title="Tự động xếp tỏa tròn nhiều tầng (Không chồng lấn)"
          >
            <Compass size={12} /> Xếp đa vòng
          </button>
        </div>

        {/* Ô tìm kiếm trang */}
        <div className="pm-multi-search-box" style={{ width: 220 }}>
          <Search size={12} className="pm-multi-search-icon" />
          <input
            className="pm-multi-search-input"
            placeholder="Tìm trang (/product, /login)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="pm-multi-search-clear" onClick={() => setSearchQuery('')}>
              <X size={11} />
            </button>
          )}
        </div>

        <button className="pm-multi-topbar__btn" onClick={() => fitBounding()} title="Căn vừa toàn bộ các cửa sổ">
          <Maximize2 size={12} /> Căn vừa
        </button>

        <button
          className="pm-multi-topbar__btn"
          onClick={() => applyLayout(layoutMode)}
          title="Tự động sắp xếp lại tránh chồng đè"
        >
          <RefreshCw size={12} /> Sắp xếp lại
        </button>

        <button className="pm-multi-topbar__close" onClick={onClose} title="Đóng chế độ đa màn hình (Esc)">
          <X size={14} />
        </button>
      </div>

      {/* ── Sân khấu vô cực kéo thả ── */}
      <div
        className={`pm-multi-stage ${isPanning ? 'is-panning' : ''}`}
        ref={stageRef}
        onPointerDown={handleStagePointerDown}
        onPointerMove={handleStagePointerMove}
        onPointerUp={handleStagePointerUp}
        onPointerCancel={handleStagePointerUp}
        onWheel={handleWheel}
      >
        <div
          className="pm-multi-world"
          style={{
            transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`,
          }}
        >
          {/* ── LỚP DÂY NỐI SVG BẮT NGUỒN TỪ THÀNH PHẦN NÚT BẤM TRÊN TRANG CHỦ ── */}
          <svg className="pm-multi-svg" width={10000} height={10000} style={{ left: -5000, top: -5000 }}>
            <g transform="translate(5000, 5000)">
              <defs>
                {windows.map((w) => (
                  <marker
                    key={`arrow-${w.id}`}
                    id={`arrow-${w.id}`}
                    viewBox="0 0 10 10"
                    refX="7"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={w.groupColor} />
                  </marker>
                ))}
              </defs>

              {wires.map((wire) => {
                const isHovered = hoveredWinId === wire.satId || activeWinId === wire.satId
                return (
                  <g key={wire.id}>
                    {/* Dây bóng phát sáng khi hover */}
                    <path
                      d={wire.pathD}
                      className="pm-multi-wire-glow"
                      style={{
                        stroke: wire.color,
                        strokeWidth: isHovered ? 8 : 4,
                        opacity: isHovered ? 0.45 : 0.18,
                      }}
                    />

                    {/* Dây nối chính */}
                    <path
                      d={wire.pathD}
                      className={`pm-multi-wire ${isHovered ? 'pm-multi-wire-active' : ''}`}
                      markerEnd={`url(#arrow-${wire.satId})`}
                      style={{
                        stroke: wire.color,
                        strokeWidth: isHovered ? 2.6 : 1.8,
                        opacity: isHovered ? 1 : 0.6,
                      }}
                    />

                    {/* Hạt ánh sáng chuyển động dọc dây nối */}
                    <circle r={isHovered ? 4 : 2.5} fill={wire.color} className="pm-multi-particle">
                      <animateMotion dur={isHovered ? '2s' : '3.5s'} repeatCount="indefinite" path={wire.pathD} />
                    </circle>
                  </g>
                )
              })}
            </g>
          </svg>

          {/* ── CÁC ĐIỂM GHIM TRÊN NÚT BẤM CỦA TRANG CHỦ (SOURCE ANCHOR PINS) ── */}
          {wires.map((wire) => (
            <div
              key={`pin-${wire.id}`}
              className="pm-multi-pin"
              style={{
                left: wire.srcPoint.x,
                top: wire.srcPoint.y,
                borderColor: wire.color,
                color: wire.color,
              }}
              title={`Điểm xuất phát: ${wire.label}`}
            >
              <span className="pm-multi-pin-dot" />
              <span>{wire.label}</span>
            </div>
          ))}

          {/* ── CÁC CỬA SỔ DESKTOP CÓ THỂ KÉO THẢ TỰ DO (WINDOWS) ── */}
          {windows.map((win) => {
            const isMatch = filteredQuery
              ? win.title.toLowerCase().includes(filteredQuery) || win.route.toLowerCase().includes(filteredQuery)
              : true

            const iframeUrl = baseUrl && !/[:{}[\]]/.test(win.route) ? joinPreviewUrl(baseUrl, win.route) : null
            const isCurrent = Boolean(currentRoute && normalizeRoute(currentRoute) === win.route)

            return (
              <div
                key={win.id}
                className={[
                  'pm-win',
                  win.isHome ? 'is-home' : '',
                  isCurrent ? 'is-current' : '',
                  activeWinId === win.id ? 'is-active' : '',
                  isMatch ? '' : 'is-dimmed',
                ].filter(Boolean).join(' ')}
                style={{
                  left: win.x - win.w / 2,
                  top: win.y - win.h / 2,
                  width: win.w,
                  height: win.h,
                  zIndex: win.zIndex,
                  opacity: isMatch ? 1 : 0.25,
                }}
                onMouseEnter={() => setHoveredWinId(win.id)}
                onMouseLeave={() => setHoveredWinId(null)}
              >
                {/* ── THANH TIÊU ĐỀ CỬA SỔ: KÉO PHẦN NÀY ĐỂ DI CHUYỂN CỬA SỔ! ── */}
                <div
                  className="pm-win__header"
                  onPointerDown={(e) => startDragWindow(win.id, e)}
                  title="Nhấp và kéo thanh này để di chuyển cửa sổ tự do trên màn hình"
                >
                  <div className="pm-win__dots">
                    <span className="pm-win__dot red" />
                    <span className="pm-win__dot yellow" />
                    <span className="pm-win__dot green" />
                  </div>

                  <div className="pm-win__title">
                    <span className="pm-win__title-text">{win.title}</span>
                    {win.isHome ? (
                      <span className="pm-win__title-badge">Màn hình chuẩn</span>
                    ) : (
                      <span className="pm-win__route">{win.route}</span>
                    )}
                  </div>

                  <div className="pm-win__actions" onPointerDown={(e) => e.stopPropagation()}>
                    <button
                      className="pm-win__btn"
                      onClick={() => {
                        onOpenPage(win.route)
                        onClose()
                      }}
                      title="Mở toàn màn hình trang này"
                    >
                      <ArrowUpRight size={12} />
                    </button>
                  </div>
                </div>

                {/* ── THÂN CỬA SỔ CHỨA IFRAME THẬT ── */}
                <div className="pm-win__body">
                  {/* Cổng kết nối động theo hướng cắm dây */}
                  {!win.isHome && (
                    <span
                      className={`pm-win__port ${portSideMap[win.id] || 'left'}`}
                      style={{ background: win.groupColor, color: win.groupColor }}
                    />
                  )}

                  {iframeUrl ? (
                    <iframe
                      className="pm-win__frame"
                      src={iframeUrl}
                      title={win.title}
                      loading="lazy"
                      style={{
                        width: win.w,
                        height: win.h - 34,
                      }}
                    />
                  ) : (
                    <div style={{ height: '100%', display: 'grid', placeItems: 'center', background: '#f8fafc', color: '#64748b' }}>
                      <span style={{ fontSize: 12 }}>Chưa có máy chủ xem trước</span>
                    </div>
                  )}

                  {/* Nhãn nguồn gốc điều hướng trên cửa sổ vệ tinh */}
                  {!win.isHome && (
                    <div className="pm-win__hint-pill">
                      <span className="from">Nối từ:</span>
                      <span>{win.sourceHint?.text || 'Điều hướng'}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Điều khiển Zoom & Căn giữa góc dưới ── */}
        <div className="pm-multi-controls">
          <button
            onClick={() => setView((v) => ({ ...v, zoom: Math.max(0.12, v.zoom * 0.88) }))}
            title="Thu nhỏ (-)"
          >
            <ZoomOut size={13} />
          </button>
          <span className="zoom-text">{Math.round(view.zoom * 100)}%</span>
          <button
            onClick={() => setView((v) => ({ ...v, zoom: Math.min(2.0, v.zoom * 1.12) }))}
            title="Phóng to (+)"
          >
            <ZoomIn size={13} />
          </button>
          <button onClick={() => fitBounding()} title="Căn vừa toàn bộ (Fit)">
            <Maximize2 size={13} />
          </button>
          <button
            onClick={() => {
              if (stageRef.current) {
                const rect = stageRef.current.getBoundingClientRect()
                setView({ zoom: 1, panX: rect.width / 2, panY: rect.height / 2 })
              }
            }}
            title="Về ngay Trang chủ (1:1)"
            style={{ fontSize: 10, fontWeight: 700, width: 'auto', padding: '0 5px' }}
          >
            1:1
          </button>
        </div>

        <div className="pm-multi-hint">
          Kéo thanh trên cùng của bất kỳ cửa sổ nào để di chuyển · Dây nối tự động co giãn theo thời gian thực
        </div>
      </div>
    </div>
  )
}
