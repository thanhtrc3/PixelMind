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

// Kích thước chuẩn các cửa sổ (mọi trang đều to chuẩn Desktop bằng với trang chủ)
const WINDOW_WIDTH = 960
const WINDOW_HEIGHT = 600
const GAP_X = 140
const GAP_Y = 120
const STEP_X = WINDOW_WIDTH + GAP_X // 1100
const STEP_Y = WINDOW_HEIGHT + GAP_Y // 720
const SAFE_MARGIN = 160

// ─── THUẬT TOÁN GIẢI TỎA VA CHẠM (COLLISION RELAXATION SOLVER) ───
function resolveCollisions(windows: CanvasWin[]): CanvasWin[] {
  const result = windows.map((w) => ({ ...w }))
  const PAD_X = 70
  const PAD_Y = 60

  for (let iter = 0; iter < 20; iter++) {
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
            const shift = overlapX / 2 + 4
            const sign = dx >= 0 ? 1 : -1
            if (!a.isHome) a.x -= shift * sign
            if (!b.isHome) b.x += shift * sign
          } else {
            const shift = overlapY / 2 + 4
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

// ─── HÀM TÌM CỬA SỔ PHÙ HỢP KHI BẤM NÚT / LINK TRÊN TRANG ───
function findMatchingWindow(href: string, text: string, winList: CanvasWin[]): CanvasWin | null {
  const normHref = href ? normalizeRoute(href.replace(/^https?:\/\/[^/]+/, '')) : ''
  const cleanText = (text || '').trim().toLowerCase()

  // 1. Kiểm tra về Trang chủ
  const homeWin = winList.find((w) => w.isHome)
  if (normHref === '/' || cleanText === 'trang chủ' || cleanText === 'home') {
    return homeWin || null
  }

  // 2. Khớp chính xác theo route
  if (normHref && normHref !== '/') {
    const directMatch = winList.find(
      (w) =>
        !w.isHome &&
        (normalizeRoute(w.route).toLowerCase() === normHref.toLowerCase() ||
          normHref.toLowerCase().startsWith(normalizeRoute(w.route).toLowerCase()) ||
          normalizeRoute(w.route).toLowerCase().startsWith(normHref.toLowerCase()))
    )
    if (directMatch) return directMatch
  }

  // 3. Khớp theo phân đoạn route (segment)
  if (normHref && normHref !== '/') {
    const segments = normHref.toLowerCase().split('/').filter(Boolean)
    for (const seg of segments) {
      if (['home', 'index', 'api'].includes(seg)) continue
      const segMatch = winList.find((w) => !w.isHome && w.route.toLowerCase().includes(seg))
      if (segMatch) return segMatch
    }
  }

  // 4. Khớp theo text của nút bấm
  if (cleanText) {
    const textMatch = winList.find((w) => {
      if (w.isHome) return false
      const title = w.title.toLowerCase()
      const route = w.route.toLowerCase()
      if (title.includes(cleanText) || cleanText.includes(title)) return true
      if (route.includes(cleanText)) return true

      if (
        cleanText.includes('xếp hạng') ||
        cleanText.includes('bảng') ||
        cleanText.includes('kỳ đài') ||
        cleanText.includes('leaderboard') ||
        cleanText.includes('rank')
      ) {
        return route.includes('leaderboard') || route.includes('rank') || title.includes('xếp hạng')
      }
      if (
        cleanText.includes('sản phẩm') ||
        cleanText.includes('product') ||
        cleanText.includes('danh mục') ||
        cleanText.includes('catalog') ||
        cleanText.includes('shop')
      ) {
        return route.includes('product') || route.includes('catalog') || route.includes('categor') || title.includes('sản phẩm')
      }
      if (
        cleanText.includes('giỏ hàng') ||
        cleanText.includes('cart') ||
        cleanText.includes('đơn hàng') ||
        cleanText.includes('checkout')
      ) {
        return route.includes('cart') || route.includes('order') || route.includes('checkout')
      }
      if (cleanText.includes('đăng nhập') || cleanText.includes('login') || cleanText.includes('tài khoản')) {
        return route.includes('login') || route.includes('auth') || route.includes('account')
      }
      if (cleanText.includes('đăng ký') || cleanText.includes('register')) {
        return route.includes('register') || route.includes('auth')
      }
      if (cleanText.includes('quản trị') || cleanText.includes('admin') || cleanText.includes('dashboard')) {
        return route.includes('admin') || route.includes('dashboard')
      }
      return false
    })
    if (textMatch) return textMatch
  }

  return null
}

// ─── BỐ CỤC 1: PHÂN CỤM THEO HƯỚNG NÚT BẤM (CLUSTER GRID) ───
function computeClusterLayout(homeWin: CanvasWin, otherPages: ProjectPage[]): CanvasWin[] {
  const halfHomeW = WINDOW_WIDTH / 2
  const halfHomeH = WINDOW_HEIGHT / 2

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
    const cols = Math.min(3, Math.max(2, Math.ceil(Math.sqrt(items.length))))
    const rows = Math.ceil(items.length / cols)
    const clusterW = cols * STEP_X - GAP_X
    const clusterH = rows * STEP_Y - GAP_Y
    const centerX = 0
    const centerY = -(halfHomeH + SAFE_MARGIN + clusterH / 2)

    items.forEach((page, idx) => {
      const col = idx % cols
      const row = Math.floor(idx / cols)
      const x = Math.round(centerX - clusterW / 2 + col * STEP_X + WINDOW_WIDTH / 2)
      const y = Math.round(centerY - clusterH / 2 + row * STEP_Y + WINDOW_HEIGHT / 2)
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
        w: WINDOW_WIDTH,
        h: WINDOW_HEIGHT,
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
    const cols = Math.min(3, Math.max(2, Math.ceil(Math.sqrt(items.length))))
    const rows = Math.ceil(items.length / cols)
    const clusterW = cols * STEP_X - GAP_X
    const clusterH = rows * STEP_Y - GAP_Y
    const centerX = halfHomeW + SAFE_MARGIN + clusterW / 2
    const centerY = -60

    items.forEach((page, idx) => {
      const col = idx % cols
      const row = Math.floor(idx / cols)
      const x = Math.round(centerX - clusterW / 2 + col * STEP_X + WINDOW_WIDTH / 2)
      const y = Math.round(centerY - clusterH / 2 + row * STEP_Y + WINDOW_HEIGHT / 2)
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
        w: WINDOW_WIDTH,
        h: WINDOW_HEIGHT,
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
    const centerY = halfHomeH + SAFE_MARGIN + clusterH / 2 + 80

    items.forEach((page, idx) => {
      const col = idx % cols
      const row = Math.floor(idx / cols)
      const x = Math.round(centerX - clusterW / 2 + col * STEP_X + WINDOW_WIDTH / 2)
      const y = Math.round(centerY - clusterH / 2 + row * STEP_Y + WINDOW_HEIGHT / 2)
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
        w: WINDOW_WIDTH,
        h: WINDOW_HEIGHT,
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
    const cols = Math.min(3, Math.max(2, Math.ceil(Math.sqrt(items.length))))
    const rows = Math.ceil(items.length / cols)
    const clusterW = cols * STEP_X - GAP_X
    const clusterH = rows * STEP_Y - GAP_Y
    const centerX = 0
    const centerY = halfHomeH + SAFE_MARGIN + clusterH / 2

    items.forEach((page, idx) => {
      const col = idx % cols
      const row = Math.floor(idx / cols)
      const x = Math.round(centerX - clusterW / 2 + col * STEP_X + WINDOW_WIDTH / 2)
      const y = Math.round(centerY - clusterH / 2 + row * STEP_Y + WINDOW_HEIGHT / 2)
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
        w: WINDOW_WIDTH,
        h: WINDOW_HEIGHT,
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
      const x = Math.round(centerX - clusterW / 2 + col * STEP_X + WINDOW_WIDTH / 2)
      const y = Math.round(centerY - clusterH / 2 + row * STEP_Y + WINDOW_HEIGHT / 2)
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
        w: WINDOW_WIDTH,
        h: WINDOW_HEIGHT,
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
        x: -(halfHomeW + SAFE_MARGIN + WINDOW_WIDTH / 2),
        y: halfHomeH + SAFE_MARGIN + idx * STEP_Y,
        w: WINDOW_WIDTH,
        h: WINDOW_HEIGHT,
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
    const rx = WINDOW_WIDTH * 0.95 + ringIndex * (WINDOW_WIDTH + 140)
    const ry = WINDOW_HEIGHT * 0.95 + ringIndex * (WINDOW_HEIGHT + 120)

    const perimeter = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2)
    const capacity = Math.max(5, Math.floor(perimeter / (WINDOW_WIDTH + 100)))

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
        w: WINDOW_WIDTH,
        h: WINDOW_HEIGHT,
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
  const homeIframeRef = useRef<HTMLIFrameElement | null>(null)
  const iframeRefs = useRef<Map<string, HTMLIFrameElement>>(new Map())
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('cluster')

  // Quét tọa độ chính xác của nút bấm trên trang chủ
  const [detectedAnchors, setDetectedAnchors] = useState<Record<string, { x: number; y: number }>>({})
  const [isFlying, setIsFlying] = useState(false)
  const [flyingToWin, setFlyingToWin] = useState<CanvasWin | null>(null)

  // Khởi tạo cửa sổ ĐỒNG BỘ ngay từ đầu (mọi cửa sổ đều to bằng kích thước trang chủ)
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
      w: WINDOW_WIDTH,
      h: WINDOW_HEIGHT,
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
  const [isDraggingWin, setIsDraggingWin] = useState(false)
  const maxZRef = useRef(10)
  const [activeWinId, setActiveWinId] = useState<string | null>(null)
  const [hoveredWinId, setHoveredWinId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

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

    const pad = 120
    const boundW = Math.max(800, maxX - minX + pad * 2)
    const boundH = Math.max(500, maxY - minY + pad * 2)
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    const zoom = Math.max(0.12, Math.min(0.85, Math.min(stageW / boundW, stageH / boundH)))
    const panX = stageW / 2 - centerX * zoom
    const panY = stageH / 2 - centerY * zoom

    setView({ zoom, panX, panY })
  }, [])

  // Chuyển góc nhìn camera mượt mà đến cửa sổ mục tiêu (không làm thay đổi trang chủ)
  const flyToWindow = useCallback((targetWin: CanvasWin) => {
    if (!stageRef.current) return
    const rect = stageRef.current.getBoundingClientRect()
    const stageW = rect.width > 50 ? rect.width : window.innerWidth
    const stageH = rect.height > 50 ? rect.height : window.innerHeight

    // Zoom vừa vặn cửa sổ để xem to rõ nét chuẩn thông thường
    const targetZoom = Math.min(0.95, Math.max(0.65, (stageW * 0.8) / targetWin.w))
    const targetPanX = Math.round(stageW / 2 - targetWin.x * targetZoom)
    const targetPanY = Math.round(stageH / 2 - targetWin.y * targetZoom)

    setActiveWinId(targetWin.id)
    setFlyingToWin(targetWin)
    setIsFlying(true)

    setView({
      zoom: targetZoom,
      panX: targetPanX,
      panY: targetPanY,
    })

    maxZRef.current = Math.min(450, maxZRef.current + 2)
    setWindows((prev) => {
      const next = prev.map((w) => (w.id === targetWin.id ? { ...w, zIndex: maxZRef.current } : w))
      windowsRef.current = next
      return next
    })

    setTimeout(() => {
      setIsFlying(false)
    }, 480)
  }, [])

  // Thiết lập bắt click & quét vị trí nút bấm trong iframe
  const setupIframeEvents = useCallback(
    (win: CanvasWin, iframe: HTMLIFrameElement | null) => {
      if (!iframe) return
      try {
        const doc = iframe.contentDocument
        if (!doc) return

        // 1. Chặn click điều hướng: thay vì đổi trang trong iframe, chuyển góc nhìn camera sang trang đích
        const handleClick = (e: MouseEvent) => {
          const target = (e.target as HTMLElement).closest<HTMLElement>('a, button, [role="button"], [data-route]')
          if (!target) return

          const href = (target.getAttribute('href') || target.getAttribute('data-route') || '').trim()
          const text = (target.textContent || '').trim()

          // Bỏ qua anchor nội bộ trong trang
          if (href.startsWith('#') && href.length > 1) return

          e.preventDefault()
          e.stopPropagation()

          const targetWin = findMatchingWindow(href, text, windowsRef.current)
          if (targetWin) {
            flyToWindow(targetWin)
          }
        }

        doc.removeEventListener('click', handleClick, true)
        doc.addEventListener('click', handleClick, true)

        // 2. Nếu là Trang chủ, quét vị trí các nút bấm riêng biệt để gắn dây nối 1-1 (không gộp thành cục)
        if (win.isHome) {
          // Chỉ lấy các phần tử tương tác thực tế (leaf clickable elements), loại bỏ các thẻ bọc container lớn
          const allCandidates = Array.from(
            doc.querySelectorAll<HTMLElement>(
              'a, button, [role="button"], input[type="button"], input[type="submit"]'
            )
          ).filter((el) => {
            if (el.querySelectorAll('a, button').length > 0) return false
            const rect = el.getBoundingClientRect()
            return rect.width > 8 && rect.height > 8 && rect.top >= 0 && rect.top <= 1200
          })

          const otherWindows = windowsRef.current.filter((w) => !w.isHome)
          const matchScores: Array<{
            satId: string
            el: HTMLElement
            score: number
          }> = []

          otherWindows.forEach((sat) => {
            const satNorm = normalizeRoute(sat.route).toLowerCase()
            const satTitle = sat.title.toLowerCase()

            allCandidates.forEach((el) => {
              const href = (el.getAttribute('href') || el.getAttribute('data-route') || '').toLowerCase().trim()
              const text = (el.textContent || '').toLowerCase().trim()
              const id = (el.id || '').toLowerCase()
              const className = (el.className || '').toLowerCase()

              let score = 0

              // 1. So khớp route
              if (href && href !== '#' && href !== '/' && satNorm !== '/') {
                const normHref = normalizeRoute(href.replace(/^https?:\/\/[^/]+/, ''))
                if (normHref === satNorm) {
                  score += 150
                } else if (normHref.endsWith(satNorm) || satNorm.endsWith(normHref)) {
                  score += 120
                } else if (satNorm.includes(normHref) || normHref.includes(satNorm)) {
                  score += 80
                }
              }

              // 2. So khớp nhãn văn bản của nút bấm
              if (text) {
                if (text === satTitle) {
                  score += 100
                } else if (text.length >= 2 && (satTitle.includes(text) || text.includes(satTitle))) {
                  score += 70
                } else {
                  // Khớp từ khóa theo từng chức năng cụ thể
                  if (
                    sat.route.toLowerCase().includes('leaderboard') &&
                    (text.includes('xếp hạng') || text.includes('kỳ đài') || text.includes('leaderboard') || text.includes('rank'))
                  ) {
                    score += 90
                  }
                  if (
                    sat.route.toLowerCase().includes('profile') &&
                    (text.includes('hồ sơ') || text.includes('kỳ thủ') || text.includes('profile'))
                  ) {
                    score += 90
                  }
                  if (
                    (sat.route.toLowerCase().includes('account') || sat.route.toLowerCase().includes('login') || sat.route.toLowerCase().includes('auth')) &&
                    (text.includes('đăng nhập') || text.includes('tài khoản') || id.includes('auth') || className.includes('auth') || text.includes('login'))
                  ) {
                    score += 90
                  }
                  if (
                    sat.route.toLowerCase().includes('lobby') &&
                    (text.includes('sảnh') || text.includes('chờ') || text.includes('lobby'))
                  ) {
                    score += 90
                  }
                  if (
                    sat.route.toLowerCase().includes('privacy') &&
                    text.includes('privacy')
                  ) {
                    score += 90
                  }
                  if (
                    sat.groupKey === 'catalog' &&
                    (text.includes('sản phẩm') || text.includes('danh mục') || text.includes('product') || text.includes('shop'))
                  ) {
                    score += 75
                  }
                  if (
                    sat.groupKey === 'order' &&
                    (text.includes('giỏ hàng') || text.includes('đơn hàng') || text.includes('cart') || text.includes('thanh toán'))
                  ) {
                    score += 75
                  }
                  if (
                    sat.groupKey === 'admin' &&
                    (text.includes('quản trị') || text.includes('admin') || text.includes('dashboard'))
                  ) {
                    score += 75
                  }
                }
              }

              // Không gán logo thương hiệu trang chủ cho các trang vệ tinh khác
              if (id.includes('brand') || className.includes('brand') || text.includes('bàn cờ tướng')) {
                score -= 100
              }

              if (score > 35) {
                matchScores.push({ satId: sat.id, el, score })
              }
            })
          })

          // Sắp xếp điểm giảm dần để ghép cặp tốt nhất trước
          matchScores.sort((a, b) => b.score - a.score)

          // Phân phối 1-1 tuyệt đối: Mỗi nút bấm CHỈ GẮN VỚI DUY NHẤT 1 TRANG VỆ TINH!
          const claimedElements = new Set<HTMLElement>()
          const claimedSats = new Set<string>()
          const newAnchors: Record<string, { x: number; y: number }> = {}

          for (const match of matchScores) {
            if (!claimedSats.has(match.satId) && !claimedElements.has(match.el)) {
              claimedSats.add(match.satId)
              claimedElements.add(match.el)
              const rect = match.el.getBoundingClientRect()
              newAnchors[match.satId] = {
                x: Math.round(rect.left + rect.width / 2),
                y: Math.round(rect.top + rect.height / 2),
              }
            }
          }

          setDetectedAnchors(newAnchors)
        }
      } catch {
        // Safe cross-origin fallback
      }
    },
    [flyToWindow]
  )

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
        w: WINDOW_WIDTH,
        h: WINDOW_HEIGHT,
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
    // Chỉ xử lý chuột trái (button === 0)
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const targetWin = windowsRef.current.find((w) => w.id === winId) || windows.find((w) => w.id === winId)
    if (!targetWin) return

    maxZRef.current = Math.min(450, maxZRef.current + 1)
    const newZ = maxZRef.current
    setActiveWinId(winId)
    setIsDraggingWin(true)

    setWindows((prev) => {
      const next = prev.map((w) => (w.id === winId ? { ...w, zIndex: newZ } : w))
      windowsRef.current = next
      return next
    })

    const startMouseX = e.clientX
    const startMouseY = e.clientY
    const startWinX = targetWin.x
    const startWinY = targetWin.y
    const curZoom = view.zoom

    let cleanedUp = false
    const cleanup = () => {
      if (cleanedUp) return
      cleanedUp = true
      setIsDraggingWin(false)
      window.removeEventListener('pointermove', onPointerMove, true)
      window.removeEventListener('pointerup', onPointerUp, true)
      window.removeEventListener('pointercancel', onPointerUp, true)
      window.removeEventListener('mouseup', onPointerUp, true)
      window.removeEventListener('touchend', onPointerUp, true)
      window.removeEventListener('blur', cleanup, true)
    }

    const onPointerMove = (moveEvt: MouseEvent | PointerEvent) => {
      // Dừng kéo ngay khi người dùng thả nút chuột (buttons === 0)
      if (moveEvt.buttons === 0) {
        cleanup()
        return
      }
      const dx = (moveEvt.clientX - startMouseX) / curZoom
      const dy = (moveEvt.clientY - startMouseY) / curZoom

      const newX = Math.round(startWinX + dx)
      const newY = Math.round(startWinY + dy)

      setWindows((prev) => {
        const next = prev.map((w) => (w.id === winId ? { ...w, x: newX, y: newY } : w))
        windowsRef.current = next
        return next
      })
    }

    const onPointerUp = () => {
      cleanup()
    }

    // Đăng ký ở capture phase (true) để luôn bắt được sự kiện dù có phần tử con nào chặn
    window.addEventListener('pointermove', onPointerMove, { capture: true, passive: false })
    window.addEventListener('pointerup', onPointerUp, { capture: true, passive: false })
    window.addEventListener('pointercancel', onPointerUp, { capture: true, passive: false })
    window.addEventListener('mouseup', onPointerUp, { capture: true, passive: false })
    window.addEventListener('touchend', onPointerUp, { capture: true, passive: false })
    window.addEventListener('blur', cleanup, { capture: true })
  }

  // Kéo và phóng to sân khấu canvas (Pan stage)
  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Chỉ xử lý nút chuột trái
    if (e.button !== 0) return
    if (
      (e.target as HTMLElement).closest('.pm-win') ||
      (e.target as HTMLElement).closest('.pm-multi-controls') ||
      (e.target as HTMLElement).closest('.pm-multi-topbar')
    ) {
      return
    }
    e.preventDefault()
    e.stopPropagation()

    setIsPanning(true)
    const startMouseX = e.clientX
    const startMouseY = e.clientY
    const startPanX = view.panX
    const startPanY = view.panY

    let cleanedUp = false
    const cleanup = () => {
      if (cleanedUp) return
      cleanedUp = true
      setIsPanning(false)
      window.removeEventListener('pointermove', onPointerMove, true)
      window.removeEventListener('pointerup', onPointerUp, true)
      window.removeEventListener('pointercancel', onPointerUp, true)
      window.removeEventListener('mouseup', onPointerUp, true)
      window.removeEventListener('touchend', onPointerUp, true)
      window.removeEventListener('blur', cleanup, true)
    }

    const onPointerMove = (moveEvt: MouseEvent | PointerEvent) => {
      // Dừng kéo ngay khi người dùng thả nút chuột (buttons === 0)
      if (moveEvt.buttons === 0) {
        cleanup()
        return
      }
      const dx = moveEvt.clientX - startMouseX
      const dy = moveEvt.clientY - startMouseY
      setView((prev) => ({
        ...prev,
        panX: Math.round(startPanX + dx),
        panY: Math.round(startPanY + dy),
      }))
    }

    const onPointerUp = () => {
      cleanup()
    }

    // Đăng ký ở capture phase (true)
    window.addEventListener('pointermove', onPointerMove, { capture: true, passive: false })
    window.addEventListener('pointerup', onPointerUp, { capture: true, passive: false })
    window.addEventListener('pointercancel', onPointerUp, { capture: true, passive: false })
    window.addEventListener('mouseup', onPointerUp, { capture: true, passive: false })
    window.addEventListener('touchend', onPointerUp, { capture: true, passive: false })
    window.addEventListener('blur', cleanup, { capture: true })
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
    const halfW = homeWin.w / 2
    const halfH = homeWin.h / 2

    return windows
      .filter((w) => !w.isHome)
      .map((sat) => {
        const anchor = detectedAnchors[sat.id]
        let srcX: number
        let srcY: number
        const hasAnchor = Boolean(anchor)

        if (anchor) {
          // Nối chính xác vào tâm của nút bấm thực tế trên trang chủ!
          srcX = homeLeft + anchor.x
          srcY = homeTop + 34 + anchor.y
        } else {
          // Các trang không có nút bấm trên navbar (ví dụ trang lỗi, privacy footer...):
          // Xuất phát từ mép ngoài của cửa sổ trang chủ hướng về phía trang vệ tinh,
          // TUYỆT ĐỐI không dồn vào thanh menu hay logo trang chủ.
          const dx = sat.x - homeWin.x
          const dy = sat.y - homeWin.y

          if (Math.abs(dx) / halfW > Math.abs(dy) / halfH) {
            // Mép trái hoặc phải
            const signX = dx >= 0 ? 1 : -1
            srcX = homeWin.x + halfW * signX
            srcY = Math.round(homeWin.y + Math.max(-halfH * 0.7, Math.min(halfH * 0.7, (dy / (Math.abs(dx) || 1)) * halfW)))
          } else {
            // Mép trên hoặc dưới
            const signY = dy >= 0 ? 1 : -1
            srcX = Math.round(homeWin.x + Math.max(-halfW * 0.7, Math.min(halfW * 0.7, (dx / (Math.abs(dy) || 1)) * halfH)))
            srcY = homeWin.y + halfH * signY
          }
        }

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

        // ─── TÍNH TOÁN ĐƯỜNG CONG TỰ NHIÊN, KHÔNG CẮT NGANG CÁC NÚT BÊN CẠNH ───
        const dist = Math.hypot(destX - srcX, destY - srcY)
        const curveSpan = Math.min(320, Math.max(100, dist * 0.38))

        let cp1X = srcX
        let cp1Y = srcY
        let cp2X = destX
        let cp2Y = destY

        if (hasAnchor) {
          // Dây xuất phát từ nút bấm trên navbar:
          // Nếu cửa sổ đích ở phía trên: lượn vút lên trên
          if (destY < srcY) {
            cp1X = srcX + (destX - srcX) * 0.18
            cp1Y = srcY - curveSpan
          } else {
            // Nếu cửa sổ đích ở phía dưới hoặc 2 bên: lượn nhẹ lên rồi uốn ra ngoài,
            // không được nằm ngang đâm qua các nút bấm khác
            cp1X = srcX + (destX - srcX) * 0.28
            cp1Y = srcY - Math.min(80, curveSpan * 0.35)
          }
        } else {
          // Dây từ mép ngoài trang chủ
          const dxEdge = srcX - homeWin.x
          const dyEdge = srcY - homeWin.y
          if (Math.abs(dxEdge) > Math.abs(dyEdge)) {
            cp1X = srcX + (dxEdge > 0 ? curveSpan : -curveSpan)
            cp1Y = srcY
          } else {
            cp1X = srcX
            cp1Y = srcY + (dyEdge > 0 ? curveSpan : -curveSpan)
          }
        }

        // Điểm uốn tại cổng cắm của cửa sổ đích
        if (portSide === 'left') {
          cp2X = destX - curveSpan
          cp2Y = destY
        } else if (portSide === 'right') {
          cp2X = destX + curveSpan
          cp2Y = destY
        } else if (portSide === 'top') {
          cp2X = destX
          cp2Y = destY - curveSpan
        } else {
          cp2X = destX
          cp2Y = destY + curveSpan
        }

        const pathD = `M ${srcX} ${srcY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${destX} ${destY}`
        const midX = (srcX + destX) / 2
        const midY = (srcY + destY) / 2

        return {
          id: `wire-${sat.id}`,
          satId: sat.id,
          targetWin: sat,
          hasAnchor,
          color: sat.groupColor || '#6366f1',
          label: sat.title,
          pathD,
          portSide,
          srcPoint: { x: srcX, y: srcY },
          destPoint: { x: destX, y: destY },
          midPoint: { x: midX, y: midY },
        }
      })
      .filter((w): w is NonNullable<typeof w> => w !== null)
  }, [windows, homeWin, detectedAnchors])

  const portSideMap = useMemo(() => {
    const map: Record<string, 'top' | 'bottom' | 'left' | 'right'> = {}
    wires.forEach((w) => {
      map[w.satId] = w.portSide
    })
    return map
  }, [wires])

  const filteredQuery = searchQuery.trim().toLowerCase()

  return (
    <div
      className={`pm-multi-canvas ${isPanning || isDraggingWin ? 'is-interacting' : ''}`}
      onPointerDown={(e) => e.stopPropagation()}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      {/* ── TopBar điều khiển ── */}
      <div className="pm-multi-topbar">
        <div className="pm-multi-topbar__title">
          <span className="pm-multi-topbar__icon">
            <LayoutGrid size={15} />
          </span>
          <div className="pm-multi-topbar__text">
            <b>Không gian Đa màn hình ({projectName})</b>
            <span>Tự động sắp xếp thông minh · Bấm vào nút để chuyển góc nhìn · Kéo tiêu đề để di chuyển</span>
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
        onWheel={handleWheel}
      >
        {/* Lớp màn che bảo vệ khi kéo thả (chống iframe cướp sự kiện và ngăn Chromium drop) */}
        {(isPanning || isDraggingWin) && (
          <div
            className="pm-multi-pan-catcher"
            onPointerUp={() => {
              setIsPanning(false)
              setIsDraggingWin(false)
            }}
            onMouseUp={() => {
              setIsPanning(false)
              setIsDraggingWin(false)
            }}
          />
        )}

        <div
          className={`pm-multi-world ${isFlying ? 'is-flying' : ''}`}
          style={{
            transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`,
          }}
        >
          {/* ── 1. CÁC CỬA SỔ DESKTOP (NẰM PHÍA DƯỚI) ── */}
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
                      ref={(el) => {
                        if (el) {
                          iframeRefs.current.set(win.id, el)
                          if (win.isHome) homeIframeRef.current = el
                        } else {
                          iframeRefs.current.delete(win.id)
                        }
                      }}
                      onLoad={() => {
                        const el = iframeRefs.current.get(win.id)
                        if (el) {
                          setupIframeEvents(win, el)
                          setTimeout(() => setupIframeEvents(win, el), 600)
                          setTimeout(() => setupIframeEvents(win, el), 1800)
                        }
                      }}
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
                </div>
              </div>
            )
          })}

          {/* ── 2. LỚP DÂY NỐI SVG BẮT NGUỒN TỪ THÀNH PHẦN NÚT BẤM (NẰM TRÊN CÁC TRANG) ── */}
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
                  <g key={wire.id} onClick={() => flyToWindow(wire.targetWin)} style={{ cursor: 'pointer' }}>
                    {/* Dây bóng phát sáng khi hover */}
                    <path
                      d={wire.pathD}
                      className="pm-multi-wire-glow"
                      style={{
                        stroke: wire.color,
                        strokeWidth: isHovered ? 9 : 5,
                        opacity: isHovered ? 0.55 : 0.28,
                      }}
                    />

                    {/* Dây nối chính */}
                    <path
                      d={wire.pathD}
                      className={`pm-multi-wire ${isHovered ? 'pm-multi-wire-active' : ''}`}
                      markerEnd={`url(#arrow-${wire.satId})`}
                      style={{
                        stroke: wire.color,
                        strokeWidth: isHovered ? 3.0 : 2.2,
                        opacity: isHovered ? 1 : 0.85,
                      }}
                    />

                    {/* Hạt ánh sáng chuyển động dọc dây nối */}
                    <circle r={isHovered ? 4.5 : 3} fill={wire.color} className="pm-multi-particle">
                      <animateMotion dur={isHovered ? '2s' : '3.5s'} repeatCount="indefinite" path={wire.pathD} />
                    </circle>
                  </g>
                )
              })}
            </g>
          </svg>

          {/* ── 3. CÁC ĐIỂM GHIM TRÊN NÚT BẤM CỦA TRANG CHỦ (CHỈ HIỂN THỊ TẠI ĐÚNG NÚT BẤM THẬT) ── */}
          {wires
            .filter((wire) => wire.hasAnchor)
            .map((wire) => (
              <div
                key={`pin-${wire.id}`}
                className="pm-multi-pin"
                style={{
                  left: wire.srcPoint.x,
                  top: wire.srcPoint.y,
                  color: wire.color,
                }}
                title={`Nối từ nút bấm: ${wire.label} (Bấm để chuyển góc nhìn)`}
                onClick={() => flyToWindow(wire.targetWin)}
              >
                <span className="pm-multi-pin-dot" />
              </div>
            ))}
        </div>

        {/* ── Thanh điều hướng nhanh khi đang chuyển góc nhìn sang trang khác ── */}
        {flyingToWin && !flyingToWin.isHome && (
          <div className="pm-multi-focus-pill">
            <span>
              Đang xem: <b>{flyingToWin.title}</b> ({flyingToWin.route})
            </span>
            <button onClick={() => flyToWindow(homeWin)}>← Quay về Trang chủ</button>
            <button onClick={() => fitBounding()}>Toàn cảnh</button>
          </div>
        )}

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
            onClick={() => flyToWindow(homeWin)}
            title="Về ngay Trang chủ (1:1)"
            style={{ fontSize: 10, fontWeight: 700, width: 'auto', padding: '0 5px' }}
          >
            1:1
          </button>
        </div>

        <div className="pm-multi-hint">
          Bấm vào nút bất kỳ trên trang chủ để chuyển góc nhìn sang trang tương ứng · Kéo thanh tiêu đề để di chuyển
        </div>
      </div>
    </div>
  )
}
