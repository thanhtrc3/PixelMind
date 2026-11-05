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

interface DetectedAnchor {
  parentId: string // ID của cửa sổ chứa nút bấm (cha)
  x: number // Tọa độ trong khung nhìn iframe (0..WINDOW_WIDTH)
  y: number // Tọa độ trong khung nhìn iframe (0..WINDOW_HEIGHT - 34)
  isClipped: boolean // Nút bấm có bị cuộn khuất khỏi viewport hay không
  clippedSide?: 'top' | 'bottom' | 'left' | 'right'
  text?: string
}

type LayoutMode = 'cluster' | 'rings'

const normalizeRoute = (route: string) => {
  const value = (route || '/').trim() || '/'
  return value.length > 1 ? value.replace(/\/+$/, '') : '/'
}

const joinPreviewUrl = (base: string, route: string) => {
  const cleanBase = (base || '').replace(/\/+$/, '')
  const cleanRoute = (route || '/').startsWith('/') ? route : `/${route}`
  const sep = cleanRoute.includes('?') ? '&' : '?'
  return `${cleanBase}${cleanRoute === '/' ? '/' : cleanRoute}${sep}preview=true`
}

const getGroupInfo = (route: string) => {
  const clean = normalizeRoute(route).toLowerCase()
  const full = clean

  if (full.includes('leaderboard') || full.includes('rank') || full.includes('kydai') || full.includes('top')) {
    return {
      groupKey: 'leaderboard',
      groupLabel: 'Bảng xếp hạng & Kỳ đài',
      groupColor: '#f472b6',
      sourceText: 'Menu [Bảng xếp hạng]',
      relX: 0.48,
      relY: 0.055,
    }
  }
  if (full.includes('lobby') || full.includes('sanh') || full.includes('waiting')) {
    return {
      groupKey: 'lobby',
      groupLabel: 'Sảnh chờ',
      groupColor: '#10b981',
      sourceText: 'Nút [Vào sảnh chờ]',
      relX: 0.65,
      relY: 0.62,
    }
  }
  if (full.includes('profile') || full.includes('hoso') || full.includes('user') || full.includes('player')) {
    return {
      groupKey: 'profile',
      groupLabel: 'Hồ sơ kỳ thủ',
      groupColor: '#06b6d4',
      sourceText: 'Menu [Hồ sơ]',
      relX: 0.62,
      relY: 0.055,
    }
  }
  if (full.includes('room') || full.includes('match') || full.includes('play') || full.includes('game') || full.includes('board')) {
    return {
      groupKey: 'room',
      groupLabel: 'Phòng cờ & Thi đấu',
      groupColor: '#ec4899',
      sourceText: 'Phòng cờ',
      relX: 0.28,
      relY: 0.55,
    }
  }
  if (['account', 'identity', 'auth', 'login', 'register', 'signin', 'signup'].some((k) => full.includes(k))) {
    return {
      groupKey: 'auth',
      groupLabel: 'Tài khoản & Xác thực',
      groupColor: '#818cf8',
      sourceText: clean.includes('reg') ? 'Nút [Tạo tài khoản]' : 'Nút [Đăng nhập]',
      relX: clean.includes('reg') ? 0.70 : 0.82,
      relY: 0.055,
    }
  }
  if (['product', 'products', 'item', 'items', 'category', 'categories', 'shop', 'catalog'].some((k) => full.includes(k))) {
    return {
      groupKey: 'catalog',
      groupLabel: 'Sản phẩm & Danh mục',
      groupColor: '#38bdf8',
      sourceText: 'Menu [Sản phẩm]',
      relX: 0.32,
      relY: 0.055,
    }
  }
  if (['cart', 'checkout', 'order', 'orders', 'payment', 'bill'].some((k) => full.includes(k))) {
    return {
      groupKey: 'order',
      groupLabel: 'Đơn hàng & Giỏ hàng',
      groupColor: '#fbbf24',
      sourceText: 'Icon [Giỏ hàng]',
      relX: 0.76,
      relY: 0.055,
    }
  }
  if (['admin', 'setting', 'settings', 'dashboard', 'report', 'manage'].some((k) => full.includes(k))) {
    return {
      groupKey: 'admin',
      groupLabel: 'Quản trị hệ thống',
      groupColor: '#c084fc',
      sourceText: 'Menu [Quản trị]',
      relX: 0.94,
      relY: 0.055,
    }
  }
  if (['privacy', 'policy', 'term', 'terms', 'about', 'contact'].some((k) => full.includes(k))) {
    return {
      groupKey: 'footer',
      groupLabel: 'Chính sách & Thông tin',
      groupColor: '#94a3b8',
      sourceText: 'Liên kết chân trang',
      relX: 0.25,
      relY: 0.96,
    }
  }
  return {
    groupKey: 'general',
    groupLabel: 'Trang chức năng',
    groupColor: '#34d399',
    sourceText: 'Điều hướng chức năng',
    relX: 0.15,
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

// ─── TÌM ID CỦA CỬA SỔ CHA THEO PHÂN CẤP ROUTE DỰ ÁN ───
export function getParentWinIdForRoute(
  route: string,
  allWindows: Array<{ id: string; route: string; isHome: boolean }>
): string {
  const homeWin = allWindows.find((w) => w.isHome) || allWindows[0]
  if (!homeWin) return ''
  const norm = normalizeRoute(route).toLowerCase()
  if (norm === '/') return ''

  // Danh sách các trang khác (loại trừ chính nó và Trang chủ)
  const otherCandidates = allWindows.filter(
    (w) => !w.isHome && normalizeRoute(w.route).toLowerCase() !== norm
  )

  const segments = norm.split('/').filter(Boolean)

  // 1. Tìm tiền tố cha theo phân đoạn path (segment) từ sâu về cạn
  // Ví dụ: '/cart/checkout/success' -> thử '/cart/checkout' -> thử '/cart'
  for (let len = segments.length - 1; len >= 1; len--) {
    const prefix = '/' + segments.slice(0, len).join('/')
    const found = otherCandidates.find(
      (w) => normalizeRoute(w.route).toLowerCase() === prefix
    )
    if (found) return found.id
  }

  // 2. Tìm trang cha có route là tiền tố dài nhất (ví dụ: '/cart/checkoutsuccess' với '/cart/checkout')
  const prefixMatches = otherCandidates
    .filter((w) => {
      const wNorm = normalizeRoute(w.route).toLowerCase()
      return wNorm !== '/' && norm.startsWith(wNorm)
    })
    .sort((a, b) => b.route.length - a.route.length)

  if (prefixMatches.length > 0) {
    return prefixMatches[0].id
  }

  // 3. Mặc định các trang cấp 1 (ví dụ /cart, /buildpc, /dashboard) nối về Trang chủ
  return homeWin.id
}

// ─── BỐ CỤC 1: XẾP THEO CỤM PHÂN CẤP CÂY DỰ ÁN (HIERARCHY CLUSTERS) ───
function computeClusterLayout(homeWin: CanvasWin, otherPages: ProjectPage[]): CanvasWin[] {
  if (otherPages.length === 0) return [homeWin]

  // Khởi tạo các node trang
  const winList: CanvasWin[] = otherPages.map((page) => {
    const norm = normalizeRoute(page.route)
    const info = getGroupInfo(norm)
    return {
      id: `win:${page.id || norm}`,
      page,
      route: norm,
      title: page.title || norm,
      isHome: false,
      x: 0,
      y: 0,
      w: WINDOW_WIDTH,
      h: WINDOW_HEIGHT,
      zIndex: 5,
      groupKey: info.groupKey,
      groupLabel: info.groupLabel,
      groupColor: info.groupColor,
      sourceHint: { text: info.sourceText, relX: info.relX, relY: info.relY },
    }
  })

  const allCandidateWins = [homeWin, ...winList]

  // Xác định cha cho từng trang
  const parentMap = new Map<string, string>()
  winList.forEach((win) => {
    const parentId = getParentWinIdForRoute(win.route, allCandidateWins)
    parentMap.set(win.id, parentId || homeWin.id)
  })

  // Phân loại: Các trang cấp 1 (con trực tiếp của Home) là gốc của các nhánh (branches)
  const level1Wins = winList.filter((w) => parentMap.get(w.id) === homeWin.id)
  const handled = new Set<string>()

  // Gom các trang con theo từng nhánh cấp 1
  const branches: Array<{
    root: CanvasWin
    children: CanvasWin[]
  }> = []

  level1Wins.forEach((root) => {
    handled.add(root.id)
    const descendants: CanvasWin[] = []
    const queue = [root.id]
    while (queue.length > 0) {
      const curId = queue.shift()!
      winList.forEach((w) => {
        if (!handled.has(w.id) && parentMap.get(w.id) === curId) {
          handled.add(w.id)
          descendants.push(w)
          queue.push(w.id)
        }
      })
    }
    branches.push({ root, children: descendants })
  })

  // Bất kỳ trang nào còn lại chưa gán nhánh
  winList.forEach((w) => {
    if (!handled.has(w.id)) {
      branches.push({ root: w, children: [] })
    }
  })

  // Xếp các nhánh quanh Trang chủ
  const numBranches = branches.length
  const branchRadius = WINDOW_WIDTH * 1.15 + 240

  branches.forEach((branch, bIdx) => {
    const baseAngle = -Math.PI / 2 + (bIdx / Math.max(1, numBranches)) * Math.PI * 2
    const rootX = Math.round(Math.cos(baseAngle) * branchRadius)
    const rootY = Math.round(Math.sin(baseAngle) * (WINDOW_HEIGHT * 1.15 + 200))

    branch.root.x = rootX
    branch.root.y = rootY

    const isRightHemisphere = rootX >= 0
    const dirX = isRightHemisphere ? 1 : -1
    const numChildren = branch.children.length

    if (numChildren > 0) {
      branch.children.forEach((child, cIdx) => {
        const childParentId = parentMap.get(child.id)
        const immediateParent =
          branch.children.find((c) => c.id === childParentId) || branch.root

        child.x = immediateParent.x + dirX * STEP_X
        const offsetIdx = cIdx - (numChildren - 1) / 2
        child.y = Math.round(branch.root.y + offsetIdx * STEP_Y)
      })
    }
  })

  return resolveCollisions([homeWin, ...winList])
}





// ─── BỐ CỤC 2: QUỸ ĐẠO ĐA TẦNG THEO PHÂN CẤP CÂY DỰ ÁN (HIERARCHY RINGS) ───
function computeRingsLayout(
  homeWin: CanvasWin,
  otherPages: ProjectPage[],
  anchorsMap?: Record<string, DetectedAnchor>
): CanvasWin[] {
  if (otherPages.length === 0) return [homeWin]

  const halfHomeW = WINDOW_WIDTH / 2
  const halfHomeH = WINDOW_HEIGHT / 2

  const winList: CanvasWin[] = otherPages.map((page) => {
    const norm = normalizeRoute(page.route)
    const info = getGroupInfo(norm)
    return {
      id: `win:${page.id || norm}`,
      page,
      route: norm,
      title: page.title || norm,
      isHome: false,
      x: 0,
      y: 0,
      w: WINDOW_WIDTH,
      h: WINDOW_HEIGHT,
      zIndex: 5,
      groupKey: info.groupKey,
      groupLabel: info.groupLabel,
      groupColor: info.groupColor,
      sourceHint: { text: info.sourceText, relX: info.relX, relY: info.relY },
    }
  })

  const allCandidateWins = [homeWin, ...winList]

  // Xác định cha cho từng trang
  const parentMap = new Map<string, string>()
  winList.forEach((win) => {
    const parentId = getParentWinIdForRoute(win.route, allCandidateWins)
    parentMap.set(win.id, parentId || homeWin.id)
  })

  // 1. Phân loại các trang theo tầng (Level)
  const level1 = winList.filter((w) => parentMap.get(w.id) === homeWin.id)
  const level2 = winList.filter((w) => {
    const pId = parentMap.get(w.id)
    return pId && pId !== homeWin.id && level1.some((l1) => l1.id === pId)
  })
  const level3 = winList.filter((w) => !level1.includes(w) && !level2.includes(w))

  // 2. Tầng 1: Đặt trên Vòng quỹ đạo 1 theo góc nút bấm trên Trang chủ
  const level1WithAngle = level1.map((win) => {
    const anchor = anchorsMap?.[win.id]
    let btnX: number
    let btnY: number
    if (anchor) {
      btnX = -halfHomeW + anchor.x
      btnY = -halfHomeH + 34 + anchor.y
    } else {
      btnX = -halfHomeW + WINDOW_WIDTH * win.sourceHint.relX
      btnY = -halfHomeH + 34 + (WINDOW_HEIGHT - 34) * win.sourceHint.relY
    }
    const angle = Math.atan2(btnY, btnX)
    return { win, angle }
  })

  level1WithAngle.sort((a, b) => a.angle - b.angle)

  const R1_X = WINDOW_WIDTH * 1.15 + 240
  const R1_Y = WINDOW_HEIGHT * 1.15 + 200

  const winAngleMap = new Map<string, number>()

  level1WithAngle.forEach((item) => {
    item.win.x = Math.round(Math.cos(item.angle) * R1_X)
    item.win.y = Math.round(Math.sin(item.angle) * R1_Y)
    winAngleMap.set(item.win.id, item.angle)
  })

  // 3. Tầng 2: Đặt trên Vòng quỹ đạo 2, nằm ngay phía sau cha của nó
  const R2_X = WINDOW_WIDTH * 2.3 + 500
  const R2_Y = WINDOW_HEIGHT * 2.3 + 420

  level1.forEach((pWin) => {
    const myChildren = level2.filter((c) => parentMap.get(c.id) === pWin.id)
    if (myChildren.length === 0) return
    const pAngle = winAngleMap.get(pWin.id) || 0
    const count = myChildren.length
    const angleSpan = Math.min(0.5, 0.16 * count)

    myChildren.forEach((child, idx) => {
      const childAngle = pAngle + (count > 1 ? (idx - (count - 1) / 2) * (angleSpan / (count - 1)) : 0)
      child.x = Math.round(Math.cos(childAngle) * R2_X)
      child.y = Math.round(Math.sin(childAngle) * R2_Y)
      winAngleMap.set(child.id, childAngle)
    })
  })

  // 4. Tầng 3 (cháu): Đặt trên Vòng quỹ đạo 3, nằm phía sau cha của nó
  const R3_X = WINDOW_WIDTH * 3.4 + 750
  const R3_Y = WINDOW_HEIGHT * 3.4 + 620

  level3.forEach((gChild, idx) => {
    const pId = parentMap.get(gChild.id)
    const pAngle = (pId && winAngleMap.get(pId)) || ((idx / Math.max(1, level3.length)) * Math.PI * 2)
    gChild.x = Math.round(Math.cos(pAngle) * R3_X)
    gChild.y = Math.round(Math.sin(pAngle) * R3_Y)
  })

  return resolveCollisions([homeWin, ...winList])
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

  // Quét tọa độ chính xác của nút bấm trên từng trang cha
  const [detectedAnchors, setDetectedAnchors] = useState<Record<string, DetectedAnchor>>({})
  const matchedElementsRef = useRef<Map<string, { parentId: string; el: HTMLElement }>>(new Map())
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

  // Tính toán lại vị trí các nút theo thời gian thực khi cuộn trang hoặc co giãn trên mọi cửa sổ cha
  const recomputeAnchors = useCallback(() => {
    const iframeH = WINDOW_HEIGHT - 34 // 566px
    const iframeW = WINDOW_WIDTH // 960px

    const nextAnchors: Record<string, DetectedAnchor> = {}

    matchedElementsRef.current.forEach(({ parentId, el }, childId) => {
      if (!el.isConnected) return
      const parentIframe = iframeRefs.current.get(parentId)
      if (!parentIframe) return

      const rect = el.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      let isClipped = false
      let clippedSide: 'top' | 'bottom' | 'left' | 'right' | undefined
      let clampedX = centerX
      let clampedY = centerY

      // Kiểm tra xem nút bấm có bị cuộn khuất khỏi viewport của iframe cha không
      if (rect.bottom < 4) {
        // Nút đã cuộn khuất qua mép trên
        isClipped = true
        clippedSide = 'top'
        clampedY = 0 // Ghim ngay mép trên của khung web
        clampedX = Math.max(16, Math.min(iframeW - 16, centerX))
      } else if (rect.top > iframeH - 4) {
        // Nút đã cuộn khuất qua mép dưới
        isClipped = true
        clippedSide = 'bottom'
        clampedY = iframeH // Ghim ngay mép dưới của khung web
        clampedX = Math.max(16, Math.min(iframeW - 16, centerX))
      } else if (rect.right < 4) {
        isClipped = true
        clippedSide = 'left'
        clampedX = 0
        clampedY = Math.max(16, Math.min(iframeH - 16, centerY))
      } else if (rect.left > iframeW - 4) {
        isClipped = true
        clippedSide = 'right'
        clampedX = iframeW
        clampedY = Math.max(16, Math.min(iframeH - 16, centerY))
      } else {
        // Đang hiển thị bình thường trong khung nhìn
        isClipped = false
        clampedX = Math.max(10, Math.min(iframeW - 10, centerX))
        clampedY = Math.max(10, Math.min(iframeH - 10, centerY))
      }

      nextAnchors[childId] = {
        parentId,
        x: Math.round(clampedX),
        y: Math.round(clampedY),
        isClipped,
        clippedSide,
        text: (el.textContent || '').trim().slice(0, 30),
      }
    })

    setDetectedAnchors(nextAnchors)
  }, [])

  // Thiết lập bắt click & quét vị trí nút bấm trong iframe của từng trang cha
  const setupIframeEvents = useCallback(
    (win: CanvasWin, iframe: HTMLIFrameElement | null) => {
      if (!iframe) return
      try {
        const iframeWin = iframe.contentWindow
        if (iframeWin && iframeWin.localStorage) {
          try {
            if (!iframeWin.localStorage.getItem('bancotuong.token')) {
              iframeWin.localStorage.setItem('bancotuong.token', 'preview-token')
              iframeWin.localStorage.setItem(
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

        const doc = iframe.contentDocument
        if (!doc) return

        // 1. Chặn click điều hướng: thay vì đổi trang trong iframe, chuyển góc nhìn camera sang trang đích
        const handleClick = (e: MouseEvent) => {
          const target = (e.target as HTMLElement).closest<HTMLElement>('a, button, [role="button"], [data-route]')
          if (!target) return

          const href = (target.getAttribute('href') || target.getAttribute('data-route') || '').trim()
          const text = (target.textContent || '').trim()

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

        // 2. Tìm tất cả các trang con có cha trực tiếp là cửa sổ này (win.id)
        const myChildren = windowsRef.current.filter((w) => {
          if (w.id === win.id) return false
          const pId = getParentWinIdForRoute(w.route, windowsRef.current)
          return pId === win.id
        })

        if (myChildren.length > 0) {
          const allCandidates = Array.from(
            doc.querySelectorAll<HTMLElement>(
              'a, button, [role="button"], input[type="button"], input[type="submit"], [data-route]'
            )
          ).filter((el) => {
            if (el.querySelectorAll('a, button').length > 0) return false
            const rect = el.getBoundingClientRect()
            return rect.width > 6 && rect.height > 6
          })

          const matchScores: Array<{
            childId: string
            el: HTMLElement
            score: number
          }> = []

          myChildren.forEach((child) => {
            const childNorm = normalizeRoute(child.route).toLowerCase()
            const childTitle = child.title.toLowerCase()
            const lastSegment = childNorm.split('/').filter(Boolean).pop() || ''

            allCandidates.forEach((el) => {
              const href = (el.getAttribute('href') || el.getAttribute('data-route') || '').toLowerCase().trim()
              const text = (el.textContent || '').toLowerCase().trim()
              const id = (el.id || '').toLowerCase()
              const className = (el.className || '').toLowerCase()

              let score = 0

              if (href && href !== '#' && href !== '/') {
                const normHref = normalizeRoute(href.replace(/^https?:\/\/[^/]+/, ''))
                if (normHref === childNorm) {
                  score += 150
                } else if (lastSegment && (normHref.endsWith(lastSegment) || normHref.includes(lastSegment))) {
                  score += 110
                } else if (normHref.includes(childNorm) || childNorm.includes(normHref)) {
                  score += 80
                }
              }

              if (text) {
                if (text === childTitle) {
                  score += 100
                } else if (text.length >= 2 && (childTitle.includes(text) || text.includes(childTitle))) {
                  score += 70
                } else if (lastSegment && text.includes(lastSegment)) {
                  score += 60
                }
              }

              if (lastSegment === 'create' && (text.includes('thêm') || text.includes('tạo') || text.includes('create') || text.includes('new'))) {
                score += 85
              }
              if (lastSegment === 'delete' && (text.includes('xóa') || text.includes('delete') || text.includes('remove'))) {
                score += 85
              }
              if (lastSegment === 'edit' && (text.includes('sửa') || text.includes('chỉnh') || text.includes('edit') || text.includes('update'))) {
                score += 85
              }
              if (lastSegment === 'details' && (text.includes('chi tiết') || text.includes('details') || text.includes('xem'))) {
                score += 85
              }
              if (lastSegment === 'checkout' && (text.includes('thanh toán') || text.includes('checkout') || text.includes('đặt hàng'))) {
                score += 85
              }
              if (childNorm.includes('leaderboard') && (text.includes('xếp hạng') || text.includes('kỳ đài') || text.includes('leaderboard') || text.includes('rank'))) {
                score += 85
              }
              if (childNorm.includes('lobby') && (text.includes('sảnh') || text.includes('chờ') || text.includes('lobby'))) {
                score += 85
              }
              if (childNorm.includes('profile') && (text.includes('hồ sơ') || text.includes('kỳ thủ') || text.includes('profile'))) {
                score += 85
              }
              if ((childNorm.includes('login') || childNorm.includes('account')) && (text.includes('đăng nhập') || text.includes('tài khoản') || id.includes('auth') || className.includes('auth'))) {
                score += 85
              }

              if (id.includes('brand') || className.includes('brand') || text.includes('bàn cờ tướng')) {
                score -= 100
              }

              if (score > 35) {
                matchScores.push({ childId: child.id, el, score })
              }
            })
          })

          matchScores.sort((a, b) => b.score - a.score)

          const claimedElements = new Set<HTMLElement>()
          const claimedChildren = new Set<string>()

          for (const match of matchScores) {
            if (!claimedChildren.has(match.childId) && !claimedElements.has(match.el)) {
              claimedChildren.add(match.childId)
              claimedElements.add(match.el)
              matchedElementsRef.current.set(match.childId, { parentId: win.id, el: match.el })
            }
          }

          recomputeAnchors()

          const iframeWin = iframe.contentWindow
          if (iframeWin) {
            const handleScroll = () => {
              recomputeAnchors()
            }
            iframeWin.removeEventListener('scroll', handleScroll)
            iframeWin.addEventListener('scroll', handleScroll, { passive: true })
            doc.removeEventListener('scroll', handleScroll)
            doc.addEventListener('scroll', handleScroll, { passive: true })
            doc.removeEventListener('wheel', handleScroll)
            doc.addEventListener('wheel', handleScroll, { passive: true })
          }
        }
      } catch {
        // Safe cross-origin fallback
      }
    },
    [flyToWindow, recomputeAnchors]
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
          ? computeRingsLayout(homeWin, otherPages, detectedAnchors)
          : computeClusterLayout(homeWin, otherPages)

      windowsRef.current = computed
      setWindows(computed)
      fitBounding(computed)
    },
    [pages, fitBounding, detectedAnchors]
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

  // ─── TÍNH TOÁN BẢN ĐỒ QUAN HỆ CHA - CON THEO PHÂN CẤP CÂY DỰ ÁN ───
  const parentMap = useMemo(() => {
    const map = new Map<string, string>()
    const home = windows.find((w) => w.isHome) || windows[0]
    if (!home) return map

    windows.forEach((win) => {
      if (win.id === home.id) return
      const parentId = getParentWinIdForRoute(win.route, windows)
      map.set(win.id, parentId || home.id)
    })
    return map
  }, [windows])

  // ─── TÍNH TOÁN DÂY NỐI TỪ NÚT BẤM TRÊN TRANG CHA TỚI TỪNG TRANG CON ───
  const homeWin = windows.find((w) => w.isHome) || windows[0]

  const wires = useMemo(() => {
    return windows
      .map((childWin) => {
        if (childWin.isHome) return null
        const parentId = parentMap.get(childWin.id)
        if (!parentId) return null
        const parentWin = windows.find((w) => w.id === parentId)
        if (!parentWin) return null

        const anchor = detectedAnchors[childWin.id]
        let srcX: number
        let srcY: number
        const hasAnchor = Boolean(anchor && anchor.parentId === parentWin.id)
        const isClipped = Boolean(anchor?.isClipped)
        const wireColor = isClipped ? '#ef4444' : (childWin.groupColor || '#6366f1')

        const parentLeft = parentWin.x - parentWin.w / 2
        const parentTop = parentWin.y - parentWin.h / 2
        const parentHalfW = parentWin.w / 2
        const parentHalfH = parentWin.h / 2

        if (hasAnchor && anchor) {
          // Nối chính xác vào tâm của nút bấm thực tế trên trang cha!
          srcX = parentLeft + anchor.x
          srcY = parentTop + 34 + anchor.y
        } else {
          // Chưa quét thấy nút trong trang cha: Nối từ mép của trang cha hướng về phía trang con
          const dx = childWin.x - parentWin.x
          const dy = childWin.y - parentWin.y

          if (Math.abs(dx) / parentHalfW > Math.abs(dy) / parentHalfH) {
            const signX = dx >= 0 ? 1 : -1
            srcX = parentWin.x + parentHalfW * signX
            srcY = Math.round(parentWin.y + Math.max(-parentHalfH * 0.7, Math.min(parentHalfH * 0.7, (dy / (Math.abs(dx) || 1)) * parentHalfW)))
          } else {
            const signY = dy >= 0 ? 1 : -1
            srcX = Math.round(parentWin.x + Math.max(-parentHalfW * 0.7, Math.min(parentHalfW * 0.7, (dx / (Math.abs(dy) || 1)) * parentHalfH)))
            srcY = parentWin.y + parentHalfH * signY
          }
        }

        const dxFromParent = childWin.x - parentWin.x
        const dyFromParent = childWin.y - parentWin.y

        let destX = childWin.x
        let destY = childWin.y
        let portSide: 'top' | 'bottom' | 'left' | 'right' = 'left'

        if (Math.abs(dxFromParent) > Math.abs(dyFromParent) * 1.15) {
          if (dxFromParent >= 0) {
            portSide = 'left'
            destX = childWin.x - childWin.w / 2
            destY = childWin.y
          } else {
            portSide = 'right'
            destX = childWin.x + childWin.w / 2
            destY = childWin.y
          }
        } else {
          if (dyFromParent <= 0) {
            portSide = 'bottom'
            destX = childWin.x
            destY = childWin.y + childWin.h / 2
          } else {
            portSide = 'top'
            destX = childWin.x
            destY = childWin.y - childWin.h / 2
          }
        }

        if (!Number.isFinite(srcX) || !Number.isFinite(srcY) || !Number.isFinite(destX) || !Number.isFinite(destY)) {
          return null
        }

        const dist = Math.hypot(destX - srcX, destY - srcY)
        const curveSpan = Math.min(320, Math.max(100, dist * 0.38))

        let cp1X = srcX
        let cp1Y = srcY
        let cp2X = destX
        let cp2Y = destY

        if (hasAnchor) {
          if (isClipped && anchor?.clippedSide === 'top') {
            cp1X = srcX
            cp1Y = srcY - curveSpan
          } else if (isClipped && anchor?.clippedSide === 'bottom') {
            cp1X = srcX
            cp1Y = srcY + curveSpan
          } else if (destY < srcY) {
            cp1X = srcX + (destX - srcX) * 0.18
            cp1Y = srcY - curveSpan
          } else {
            cp1X = srcX + (destX - srcX) * 0.28
            cp1Y = srcY - Math.min(80, curveSpan * 0.35)
          }
        } else {
          const dxEdge = srcX - parentWin.x
          const dyEdge = srcY - parentWin.y
          if (Math.abs(dxEdge) > Math.abs(dyEdge)) {
            cp1X = srcX + (dxEdge > 0 ? curveSpan : -curveSpan)
            cp1Y = srcY
          } else {
            cp1X = srcX
            cp1Y = srcY + (dyEdge > 0 ? curveSpan : -curveSpan)
          }
        }

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
          id: `wire-${childWin.id}`,
          satId: childWin.id,
          parentWin,
          targetWin: childWin,
          hasAnchor,
          isClipped,
          color: wireColor,
          label: childWin.title,
          pathD,
          portSide,
          srcPoint: { x: srcX, y: srcY },
          destPoint: { x: destX, y: destY },
          midPoint: { x: midX, y: midY },
        }
      })
      .filter((w): w is NonNullable<typeof w> => w !== null)
  }, [windows, parentMap, detectedAnchors])

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
                {wires.map((w) => (
                  <marker
                    key={`arrow-${w.satId}`}
                    id={`arrow-${w.satId}`}
                    viewBox="0 0 10 10"
                    refX="7"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={w.color} />
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

          {/* ── 3. CÁC ĐIỂM GHIM TRÊN NÚT BẤM (NẰM TRÊN NÚT CỦA CỬA SỔ CHA) ── */}
          {wires
            .filter((wire) => wire.hasAnchor)
            .map((wire) => (
              <div
                key={`pin-${wire.id}`}
                className={`pm-multi-pin ${wire.isClipped ? 'is-clipped' : ''}`}
                style={{
                  left: wire.srcPoint.x,
                  top: wire.srcPoint.y,
                  color: wire.color,
                }}
                title={
                  wire.isClipped
                    ? `Nút bấm mở [${wire.label}] đã cuộn khuất khỏi tầm nhìn (Bấm để chuyển góc nhìn)`
                    : `Nối từ nút bấm: [${wire.parentWin.title}] -> [${wire.label}] (Bấm để chuyển góc nhìn)`
                }
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
            {(() => {
              const pId = parentMap.get(flyingToWin.id)
              const parent = pId ? windows.find((w) => w.id === pId) : homeWin
              return parent ? (
                <button onClick={() => flyToWindow(parent)}>
                  ← Quay về {parent.title}
                </button>
              ) : null
            })()}
            {homeWin && (
              <button onClick={() => flyToWindow(homeWin)}>Trang chủ</button>
            )}
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
