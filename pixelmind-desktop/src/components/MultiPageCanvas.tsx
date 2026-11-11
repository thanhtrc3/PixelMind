import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  Compass,
  Crosshair,
  Eye,
  LayoutGrid,
  Link2,
  Maximize2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { ProjectPage } from '@shared/types'
import { api } from '../lib/bridge'
import '../styles/multiPageCanvas.css'

interface MultiPageCanvasProps {
  projectName: string
  projectPath?: string
  pages: ProjectPage[]
  previewUrl?: string | null
  currentRoute?: string | null
  onOpenPage: (route: string) => void
  onClose: () => void
  onNotify?: (kind: 'ok' | 'info' | 'warn' | 'err', message: string) => void
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
  key: string // Khoá duy nhất của từng thành phần liên kết (dùng cho id dây nối)
  childId: string // Trang đích mà nút bấm này dẫn tới
  parentId: string // ID của cửa sổ chứa nút bấm (cha)
  x: number // Tọa độ trong khung nhìn iframe (0..WINDOW_WIDTH)
  y: number // Tọa độ trong khung nhìn iframe (0..WINDOW_HEIGHT - 34)
  isClipped: boolean // Nút bấm có bị cuộn khuất khỏi viewport hay không
  clippedSide?: 'top' | 'bottom' | 'left' | 'right'
  text?: string
  tagName?: string
  className?: string
  elementId?: string
}

/** Thông tin nút bấm nguồn dùng để dò lại đúng thẻ trong mã nguồn. */
interface WireSource {
  text?: string
  tagName?: string
  className?: string
  elementId?: string
}

/** Dây nối do người dùng tự tạo bằng kéo thả từ một nút bấm sang trang đích. */
interface ManualWire {
  id: string
  parentId: string // Cửa sổ chứa nút bấm nguồn
  targetId: string // Cửa sổ đích
  anchorKey?: string // Khóa detectedAnchors nếu nút nguồn trùng nút đã quét (dây bám theo khi cuộn)
  sourceX: number // Tọa độ nút nguồn trong iframe cha (dự phòng)
  sourceY: number
  source: WireSource
}

/** Trạng thái đang kéo dây từ nút bấm nguồn ra ngoài canvas. */
interface ConnectDrag {
  parentId: string
  anchorKey?: string
  sourceX: number
  sourceY: number
  source: WireSource
  srcWorldX: number
  srcWorldY: number
  srcClientX: number
  srcClientY: number
  clientX: number
  clientY: number
  hoverTargetId: string | null
}

interface WireShape {
  parentWin: CanvasWin
  targetWin: CanvasWin
  isClipped: boolean
  color: string
  pathD: string
  portSide: 'top' | 'bottom' | 'left' | 'right'
  srcPoint: { x: number; y: number }
  destPoint: { x: number; y: number }
  midPoint: { x: number; y: number }
}

interface Wire extends WireShape {
  id: string
  satId: string
  hasAnchor: boolean
  label: string
  source?: WireSource
  anchorKey?: string
}

/** Thao tác mã nguồn cần hoàn tác khi người dùng nhấn Ctrl+Z. */
interface CodeRevert {
  action: 'link' | 'unlink'
  currentPath?: string
  targetRoute: string
  source: WireSource
}

interface HistoryEntry {
  manualWires: ManualWire[]
  hiddenWireIds: string[]
  codeReverts?: CodeRevert[]
}

/* ── Prototype: sự kiện → hành động (Event / State Machine) ── */
type PrototypeTrigger =
  | 'click'
  | 'dblclick'
  | 'hover'
  | 'mouseleave'
  | 'longpress'
  | 'contextmenu'
  | 'focus'
  | 'blur'
  | 'scroll'
  | 'timer'
  | 'keypress'

type PrototypeActionType =
  | 'focus'
  | 'flash'
  | 'toggle'
  | 'open'
  | 'back'
  | 'highlight_wire'
  | 'pulse_target'
  | 'scroll_top'
  | 'reload'
  | 'toast'

interface PrototypeInteraction {
  id: string
  /** Cửa sổ chứa phần tử nguồn. */
  parentId: string
  /** Cửa sổ đích của hành động. */
  targetId: string
  /** ID dây nối gắn kèm (nếu tạo trực tiếp từ chuột phải dây). */
  wireId?: string
  anchorKey?: string
  source: WireSource
  trigger: PrototypeTrigger
  action: PrototypeActionType
  enabled: boolean
  /** Giới hạn số lần chạy tối đa (0 = không giới hạn). */
  maxRuns: number
  /** Khoảng nghỉ giữa 2 lần chạy (giây), hoặc chu kỳ lặp đối với trigger Timer. */
  intervalSec: number
  /** Độ trễ trước khi thực thi hành động (giây). */
  delaySec: number
  /** Phím kích hoạt khi trigger === 'keypress'. */
  triggerKey?: string
  /** Thông báo tuỳ chỉnh khi action === 'toast'. */
  toastText?: string
}

interface PrototypeEventLog {
  id: string
  time: string
  message: string
  kind: 'run' | 'skip' | 'done'
}

const PROTOTYPE_TRIGGERS: Array<{ key: PrototypeTrigger; label: string; hint?: string }> = [
  { key: 'click', label: 'Nhấp chuột (Click)' },
  { key: 'dblclick', label: 'Nhấp đúp (Double Click)' },
  { key: 'hover', label: 'Rê chuột vào (Hover)' },
  { key: 'mouseleave', label: 'Rời chuột ra (Mouse Leave)' },
  { key: 'longpress', label: 'Nhấn giữ (Long Press 0.5s)' },
  { key: 'contextmenu', label: 'Chuột phải phần tử (Right Click)' },
  { key: 'focus', label: 'Nhận tiêu điểm (Focus)' },
  { key: 'blur', label: 'Mất tiêu điểm (Blur)' },
  { key: 'scroll', label: 'Cuộn vào vùng nhìn (Scroll)' },
  { key: 'timer', label: 'Tự động theo chu kỳ (Timer)' },
  { key: 'keypress', label: 'Nhấn phím tắt (Key Press)' },
]

const PROTOTYPE_ACTIONS: Array<{ key: PrototypeActionType; label: string }> = [
  { key: 'focus', label: 'Chuyển góc nhìn tới đích' },
  { key: 'flash', label: 'Nhấp nháy cửa sổ đích' },
  { key: 'toggle', label: 'Ẩn/Hiện cửa sổ đích' },
  { key: 'open', label: 'Mở toàn màn hình trang đích' },
  { key: 'back', label: 'Quay lại trang trước đó' },
  { key: 'highlight_wire', label: 'Phát sáng luồng dây dẫn' },
  { key: 'pulse_target', label: 'Nháy phần tử nguồn' },
  { key: 'scroll_top', label: 'Cuộn trang đích lên đầu' },
  { key: 'reload', label: 'Tải lại trang đích' },
  { key: 'toast', label: 'Hiện thông báo xem trước' },
]

function loadPrototypeInteractions(storageKey: string): PrototypeInteraction[] {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap<PrototypeInteraction>((item) => {
      const row = item as Partial<PrototypeInteraction>
      if (
        !row ||
        typeof row.id !== 'string' ||
        typeof row.parentId !== 'string' ||
        typeof row.targetId !== 'string' ||
        !PROTOTYPE_TRIGGERS.some((t) => t.key === row.trigger) ||
        !PROTOTYPE_ACTIONS.some((a) => a.key === row.action)
      ) {
        return []
      }
      return [
        {
          id: row.id,
          parentId: row.parentId,
          targetId: row.targetId,
          wireId: typeof row.wireId === 'string' ? row.wireId : undefined,
          anchorKey: row.anchorKey,
          source: row.source ?? {},
          trigger: row.trigger as PrototypeTrigger,
          action: row.action as PrototypeActionType,
          enabled: row.enabled !== false,
          maxRuns: typeof row.maxRuns === 'number' && row.maxRuns >= 0 ? row.maxRuns : 0,
          intervalSec:
            typeof row.intervalSec === 'number' && row.intervalSec >= 0 ? row.intervalSec : 0,
          delaySec: typeof row.delaySec === 'number' && row.delaySec >= 0 ? row.delaySec : 0,
          triggerKey: typeof row.triggerKey === 'string' ? row.triggerKey : undefined,
          toastText: typeof row.toastText === 'string' ? row.toastText : undefined,
        },
      ]
    })
  } catch {
    return []
  }
}

/** Tìm lại đúng phần tử nguồn trong iframe từ thông tin đã lưu. */
function findPrototypeElement(
  doc: Document,
  matched: Map<string, { childId: string; parentId: string; el: HTMLElement }>,
  interaction: PrototypeInteraction
): HTMLElement | null {
  const matchedEl = interaction.anchorKey ? matched.get(interaction.anchorKey)?.el : null
  if (matchedEl) return matchedEl

  if (interaction.source.elementId) {
    const byId = doc.getElementById(interaction.source.elementId)
    if (byId) return byId
  }

  const text = (interaction.source.text || '').trim().toLowerCase()
  if (!text) return null
  const candidates = Array.from(
    doc.querySelectorAll<HTMLElement>('a, button, [role="button"], [data-route], [onclick]')
  )
  return (
    candidates.find((el) => (el.textContent || '').trim().toLowerCase() === text) || null
  )
}

/** Tìm tương tác click khớp với phần tử vừa bấm trong iframe. */
function findPrototypeClick(
  doc: Document,
  matched: Map<string, { childId: string; parentId: string; el: HTMLElement }>,
  interactions: PrototypeInteraction[],
  winId: string,
  target: HTMLElement
): PrototypeInteraction | null {
  for (const interaction of interactions) {
    if (!interaction.enabled || interaction.parentId !== winId || interaction.trigger !== 'click') continue
    const el = findPrototypeElement(doc, matched, interaction)
    if (el && (el === target || el.contains(target) || target.contains(el))) return interaction
  }
  return null
}

/** Dựng hình học dây nối từ tâm nút bấm thực tế trên trang cha tới cửa sổ đích. */
function computeWireShape(parentWin: CanvasWin, targetWin: CanvasWin, anchor: DetectedAnchor): WireShape | null {
  const isClipped = Boolean(anchor.isClipped)
  const color = isClipped ? '#ef4444' : targetWin.groupColor || '#6366f1'

  const srcX = parentWin.x - parentWin.w / 2 + anchor.x
  const srcY = parentWin.y - parentWin.h / 2 + 34 + anchor.y

  const dxFromParent = targetWin.x - parentWin.x
  const dyFromParent = targetWin.y - parentWin.y

  let destX = targetWin.x
  let destY = targetWin.y
  let portSide: 'top' | 'bottom' | 'left' | 'right' = 'left'

  if (Math.abs(dxFromParent) > Math.abs(dyFromParent) * 1.15) {
    if (dxFromParent >= 0) {
      portSide = 'left'
      destX = targetWin.x - targetWin.w / 2
      destY = targetWin.y
    } else {
      portSide = 'right'
      destX = targetWin.x + targetWin.w / 2
      destY = targetWin.y
    }
  } else {
    if (dyFromParent <= 0) {
      portSide = 'bottom'
      destX = targetWin.x
      destY = targetWin.y + targetWin.h / 2
    } else {
      portSide = 'top'
      destX = targetWin.x
      destY = targetWin.y - targetWin.h / 2
    }
  }

  if (![srcX, srcY, destX, destY].every((n) => Number.isFinite(n))) return null

  const dist = Math.hypot(destX - srcX, destY - srcY)
  const curveSpan = Math.min(320, Math.max(100, dist * 0.38))

  let cp1X = srcX
  let cp1Y = srcY
  let cp2X = destX
  let cp2Y = destY

  if (isClipped && anchor.clippedSide === 'top') {
    cp1X = srcX
    cp1Y = srcY - curveSpan
  } else if (isClipped && anchor.clippedSide === 'bottom') {
    cp1X = srcX
    cp1Y = srcY + curveSpan
  } else if (destY < srcY) {
    cp1X = srcX + (destX - srcX) * 0.18
    cp1Y = srcY - curveSpan
  } else {
    cp1X = srcX + (destX - srcX) * 0.28
    cp1Y = srcY - Math.min(80, curveSpan * 0.35)
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

  return {
    parentWin,
    targetWin,
    isClipped,
    color,
    pathD: `M ${srcX} ${srcY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${destX} ${destY}`,
    portSide,
    srcPoint: { x: srcX, y: srcY },
    destPoint: { x: destX, y: destY },
    midPoint: { x: (srcX + destX) / 2, y: (srcY + destY) / 2 },
  }
}

type LayoutMode = 'cluster' | 'rings'

const normalizeRoute = (route: string) => {
  const value = (route || '/').trim() || '/'
  const collapsed = value.replace(/\/{2,}/g, '/')
  return collapsed.length > 1 ? collapsed.replace(/\/+$/, '') : '/'
}

/** Chuẩn hoá route để các mục trang cùng một đích chỉ chiếm một cửa sổ trên bản đồ. */
const canonicalPageKey = (route: string) => {
  const clean = normalizeRoute((route || '/').split('?')[0].split('#')[0]).toLowerCase() || '/'
  return clean.replace(/^\/account\//, '/identity/account/')
}

/** Bỏ các mục trang trùng đích (khác hoa/thường, tham số truy vấn, dấu / cuối, tiền tố Identity). */
const dedupePages = (pages: ProjectPage[]): ProjectPage[] => {
  const seen = new Set<string>()
  const result: ProjectPage[] = []
  for (const page of pages) {
    const key = canonicalPageKey(page.route)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(page)
  }
  return result
}

/** Số nút bấm tối đa được vẽ dây cho mỗi trang đích (tránh bản đồ rối khi trang có nhiều link). */
const MAX_ANCHORS_PER_TARGET = 6

const joinPreviewUrl = (base: string, route: string): string | null => {
  try {
    if (!base) return null
    const cleanBase = base.replace(/\/+$/, '')
    const cleanRoute = (route || '/').startsWith('/') ? route : `/${route}`
    const sep = cleanRoute.includes('?') ? '&' : '?'
    const raw = `${cleanBase}${cleanRoute === '/' ? '/' : cleanRoute}${sep}preview=true`
    const sanitized = raw.replace(/\[/g, '%5B').replace(/\]/g, '%5D').replace(/\{/g, '%7B').replace(/\}/g, '%7D')
    const parsed = new URL(sanitized)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return sanitized
  } catch {
    return null
  }
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
  if (cleanText && cleanText.length >= 2) {
    const textMatch = winList.find((w) => {
      if (w.isHome) return false
      const title = w.title.toLowerCase()
      const route = w.route.toLowerCase()
      if (title === cleanText) return true
      if (title.includes(cleanText) || cleanText.includes(title)) return true
      if (cleanText.length >= 3 && route.includes(cleanText)) return true

      if (
        cleanText.includes('xếp hạng') ||
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
  anchorsMap?: Record<string, DetectedAnchor[]>
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
    const anchor = anchorsMap?.[win.id]?.[0]
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
  projectPath,
  pages,
  previewUrl,
  currentRoute,
  onOpenPage,
  onClose,
  onNotify,
}: MultiPageCanvasProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const windowsRef = useRef<CanvasWin[]>([])
  const homeIframeRef = useRef<HTMLIFrameElement | null>(null)
  const iframeRefs = useRef<Map<string, HTMLIFrameElement>>(new Map())
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('cluster')

  // Quét tọa độ chính xác của nút bấm trên từng trang cha
  const [detectedAnchors, setDetectedAnchors] = useState<Record<string, DetectedAnchor[]>>({})
  const matchedElementsRef = useRef<Map<string, { childId: string; parentId: string; el: HTMLElement }>>(new Map())
  const [isFlying, setIsFlying] = useState(false)
  const [flyingToWin, setFlyingToWin] = useState<CanvasWin | null>(null)

  // Khởi tạo cửa sổ ĐỒNG BỘ ngay từ đầu (mọi cửa sổ đều to bằng kích thước trang chủ)
  const [windows, setWindows] = useState<CanvasWin[]>(() => {
    const homePage = pages.find((p) => normalizeRoute(p.route) === '/')
    const otherPages = dedupePages(pages).filter((p) => normalizeRoute(p.route) !== '/')

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
  const [navHistory, setNavHistory] = useState<string[]>([])
  const navHistoryRef = useRef<string[]>([])
  const currentWinIdRef = useRef<string | null>(null)
  const [lastReachedWinId, setLastReachedWinId] = useState<string | null>(null)
  const [hoveredWinId, setHoveredWinId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // ─── Prototype Editor (mở khi chuột phải vào dây) & Kiểm soát sự kiện ───
  const prototypeStorageKey = useMemo(
    () => `pm.prototype:${projectPath || projectName}`,
    [projectPath, projectName]
  )
  const [interactions, setInteractions] = useState<PrototypeInteraction[]>(() =>
    loadPrototypeInteractions(`pm.prototype:${projectPath || projectName}`)
  )
  const [wireProtoTarget, setWireProtoTarget] = useState<{
    wireId: string
    sourceKey: string
    parentId: string
    parentTitle: string
    targetId: string
    targetTitle: string
    label: string
    source: WireSource
    anchorKey?: string
  } | null>(null)
  const [showEventController, setShowEventController] = useState(false)
  const [prototypeRunning, setPrototypeRunning] = useState(true)
  const [hiddenWinIds, setHiddenWinIds] = useState<Set<string>>(() => new Set())
  const [flashWinId, setFlashWinId] = useState<string | null>(null)
  const [flashWireId, setFlashWireId] = useState<string | null>(null)
  const [protoToast, setProtoToast] = useState<string | null>(null)
  const [draftTargetId, setDraftTargetId] = useState('')
  const [draftTrigger, setDraftTrigger] = useState<PrototypeTrigger>('click')
  const [draftAction, setDraftAction] = useState<PrototypeActionType>('focus')
  const [draftMaxRuns, setDraftMaxRuns] = useState<number>(1)
  const [draftIntervalSec, setDraftIntervalSec] = useState<number>(0)
  const [draftDelaySec, setDraftDelaySec] = useState<number>(0)
  const [draftTriggerKey, setDraftTriggerKey] = useState<string>('Enter')
  const [draftToastText, setDraftToastText] = useState<string>('')
  const [batchMaxRuns, setBatchMaxRuns] = useState<number>(1)
  const [batchIntervalSec, setBatchIntervalSec] = useState<number>(2)
  const [batchDelaySec, setBatchDelaySec] = useState<number>(0)
  const [runCounts, setRunCounts] = useState<Record<string, number>>({})
  const [eventLogs, setEventLogs] = useState<PrototypeEventLog[]>([])

  const interactionsRef = useRef<PrototypeInteraction[]>(interactions)
  const prototypeRunningRef = useRef(prototypeRunning)
  const prototypeBindingsRef = useRef<Map<string, () => void>>(new Map())
  const flashTimerRef = useRef<number | null>(null)
  const flashWireTimerRef = useRef<number | null>(null)
  const protoToastTimerRef = useRef<number | null>(null)
  const runCountsRef = useRef<Record<string, number>>({})
  const lastRunAtRef = useRef<Record<string, number>>({})
  const pendingTimersRef = useRef<Set<number>>(new Set())
  const executePrototypeActionRef = useRef<(interaction: PrototypeInteraction) => void>(() => {})
  const triggerPrototypeInteractionRef = useRef<
    (interaction: PrototypeInteraction, bypassLimits?: boolean) => void
  >(() => {})

  const appendEventLog = useCallback(
    (message: string, kind: PrototypeEventLog['kind'] = 'run') => {
      const time = new Date().toLocaleTimeString('vi-VN', { hour12: false })
      setEventLogs((prev) => [
        { id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, time, message, kind },
        ...prev.slice(0, 14),
      ])
    },
    []
  )

  // Nạp lại cấu hình khi đổi dự án
  const prototypeKeyRef = useRef(prototypeStorageKey)
  useEffect(() => {
    if (prototypeKeyRef.current === prototypeStorageKey) return
    prototypeKeyRef.current = prototypeStorageKey
    setInteractions(loadPrototypeInteractions(prototypeStorageKey))
    runCountsRef.current = {}
    lastRunAtRef.current = {}
    setRunCounts({})
    setEventLogs([])
  }, [prototypeStorageKey])

  // Lưu cấu hình Prototype của từng dự án
  useEffect(() => {
    try {
      window.localStorage.setItem(prototypeStorageKey, JSON.stringify(interactions))
    } catch {
      // Bỏ qua khi localStorage bị chặn
    }
  }, [prototypeStorageKey, interactions])

  // Dọn listener/iframe và timer khi đóng chế độ
  useEffect(
    () => () => {
      prototypeBindingsRef.current.forEach((cleanup) => cleanup())
      prototypeBindingsRef.current.clear()
      pendingTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
      pendingTimersRef.current.clear()
      if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current)
      if (flashWireTimerRef.current !== null) window.clearTimeout(flashWireTimerRef.current)
      if (protoToastTimerRef.current !== null) window.clearTimeout(protoToastTimerRef.current)
    },
    []
  )

  // Dây nối thủ công, các dây tự động đã bị xoá và trạng thái chọn dây
  const [manualWires, setManualWires] = useState<ManualWire[]>([])
  const [hiddenWireIds, setHiddenWireIds] = useState<Set<string>>(() => new Set())
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null)

  // Chế độ nối dây bằng kéo thả + trạng thái đang kéo
  const [isConnectMode, setIsConnectMode] = useState(false)
  const [connectDrag, setConnectDrag] = useState<ConnectDrag | null>(null)
  const connectModeRef = useRef(false)

  const viewRef = useRef(view)
  viewRef.current = view

  // Lịch sử thao tác (Ctrl+Z)
  const historyRef = useRef<HistoryEntry[]>([])
  const wiresRef = useRef<Wire[]>([])
  const unlinkedButtonsRef = useRef<Set<string>>(new Set())

  const syncWireCode = useCallback(
    async (
      action: 'link' | 'unlink',
      source: WireSource,
      targetRoute: string,
      currentPath?: string
    ): Promise<boolean> => {
      if (!projectPath) {
        onNotify?.('warn', 'Chưa xác định được thư mục dự án để đồng bộ mã nguồn')
        return false
      }
      if (!api?.inspect?.syncNav) {
        onNotify?.('warn', 'Tính năng đồng bộ mã nguồn chưa sẵn sàng')
        return false
      }
      try {
        const res = await api.inspect.syncNav({
          projectPath,
          currentPath,
          targetRoute,
          action,
          textSnippet: source.text,
          tagName: source.tagName,
          className: source.className,
          id: source.elementId,
        })
        if (res.success) {
          onNotify?.(
            'ok',
            action === 'link'
              ? `Đã thêm liên kết tới ${targetRoute} trong mã nguồn`
              : `Đã xoá liên kết tới ${targetRoute} trong mã nguồn`
          )
          return true
        }
        onNotify?.('warn', res.error || 'Không đồng bộ được mã nguồn')
        return false
      } catch (err) {
        onNotify?.('err', `Lỗi đồng bộ mã nguồn: ${String(err)}`)
        return false
      }
    },
    [projectPath, onNotify]
  )

  const pushHistory = useCallback(
    (codeReverts?: CodeRevert[]) => {
      historyRef.current.push({
        manualWires,
        hiddenWireIds: [...hiddenWireIds],
        codeReverts,
      })
      if (historyRef.current.length > 60) historyRef.current.shift()
    },
    [manualWires, hiddenWireIds]
  )

  const undo = useCallback(() => {
    const prev = historyRef.current.pop()
    if (!prev) return
    setManualWires(prev.manualWires)
    setHiddenWireIds(new Set(prev.hiddenWireIds))
    setSelectedWireId(null)
    // Hoàn tác cả thay đổi trong mã nguồn (nếu có)
    prev.codeReverts?.forEach((revert) => {
      void syncWireCode(revert.action, revert.source, revert.targetRoute, revert.currentPath)
    })
  }, [syncWireCode])

  const deleteWire = useCallback(
    (wireId: string) => {
      const wire = wiresRef.current.find((w) => w.id === wireId)
      const revert: CodeRevert[] = wire?.source
        ? [
            {
              action: 'link',
              currentPath: wire.parentWin.route,
              targetRoute: wire.targetWin.route,
              source: wire.source,
            },
          ]
        : []

      pushHistory(revert)

      if (wireId.startsWith('wire-')) {
        setHiddenWireIds((prev) => {
          const next = new Set(prev)
          next.add(wireId)
          return next
        })
      } else {
        setManualWires((prev) => prev.filter((w) => w.id !== wireId))
      }
      if (wire?.anchorKey) {
        setHiddenWireIds((prev) => {
          const next = new Set(prev)
          next.add(`wire-${wire.anchorKey}`)
          return next
        })
      }
      setSelectedWireId(null)

      if (wire?.source) {
        // Đánh dấu nút này đã bị huỷ liên kết để khi click không chuyển trang nữa
        if (wire.source.text) {
          unlinkedButtonsRef.current.add(`${wire.parentWin.id}:${wire.source.text}`)
        }
        if (wire.source.elementId) {
          unlinkedButtonsRef.current.add(`${wire.parentWin.id}:#${wire.source.elementId}`)
        }
        if (wire.anchorKey) {
          unlinkedButtonsRef.current.add(`${wire.parentWin.id}:${wire.anchorKey}`)
        }

        // Cập nhật DOM trực tiếp trong iframe nếu có
        try {
          const parentIframe = iframeRefs.current.get(wire.parentWin.id)
          const doc = parentIframe?.contentDocument
          if (doc) {
            const matchedEl = wire.anchorKey ? matchedElementsRef.current.get(wire.anchorKey)?.el : null
            const candidate =
              matchedEl || (wire.source.elementId ? doc.getElementById(wire.source.elementId) : null)
            if (candidate) {
              candidate.setAttribute('href', '#')
              candidate.removeAttribute('data-route')
            }
          }
        } catch {}

        // Xoá logic nối trang trong mã nguồn
        void syncWireCode('unlink', wire.source, wire.targetWin.route, wire.parentWin.route)
      }
    },
    [pushHistory, syncWireCode]
  )

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
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      const isTyping =
        tag === 'input' || tag === 'textarea' || tag === 'select' || Boolean(target?.isContentEditable)

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !isTyping) {
        e.preventDefault()
        e.stopPropagation()
        undo()
        return
      }

      if (e.key === 'Escape') {
        if (connectDrag) {
          setConnectDrag(null)
          e.stopPropagation()
          return
        }
        if (isConnectMode) {
          setIsConnectMode(false)
          e.stopPropagation()
          return
        }
        if (wireProtoTarget && !isTyping) {
          setWireProtoTarget(null)
          e.stopPropagation()
          return
        }
        if (showEventController && !isTyping) {
          setShowEventController(false)
          e.stopPropagation()
          return
        }
        if (selectedWireId) {
          setSelectedWireId(null)
          e.stopPropagation()
          return
        }
        e.stopPropagation()
        onClose()
        return
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedWireId && !isTyping) {
        e.preventDefault()
        e.stopPropagation()
        deleteWire(selectedWireId)
      }
    }
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [
    onClose,
    isConnectMode,
    connectDrag,
    selectedWireId,
    deleteWire,
    undo,
    wireProtoTarget,
    showEventController,
  ])

  // Đồng bộ cờ chế độ nối dây để listener trong iframe đọc được giá trị mới nhất
  useEffect(() => {
    connectModeRef.current = isConnectMode
    if (!isConnectMode) setConnectDrag(null)
  }, [isConnectMode])

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
  const flyToWindow = useCallback(
    (
      targetWin: CanvasWin,
      zoomOverride?: number,
      options?: { record?: boolean; fromWinId?: string; markEndpoint?: boolean }
    ) => {
      if (!stageRef.current) return
      const rect = stageRef.current.getBoundingClientRect()
      const stageW = rect.width > 50 ? rect.width : window.innerWidth
      const stageH = rect.height > 50 ? rect.height : window.innerHeight

      // Ghi lại trang nguồn để nút "Quay lại" lùi đúng một bước vừa đi qua
      if (options?.record !== false) {
        const fromId =
          options?.fromWinId ??
          currentWinIdRef.current ??
          windowsRef.current.find((w) => w.isHome)?.id ??
          null
        if (fromId && fromId !== targetWin.id) {
          const prevLast = navHistoryRef.current[navHistoryRef.current.length - 1]
          if (prevLast !== fromId) {
            const next = [...navHistoryRef.current, fromId].slice(-60)
            navHistoryRef.current = next
            setNavHistory(next)
          }
        }
      }

      if (options?.markEndpoint !== false && !targetWin.isHome) {
        setLastReachedWinId(targetWin.id)
      }

      currentWinIdRef.current = targetWin.id

      // Zoom vừa vặn cửa sổ để xem to rõ nét chuẩn thông thường
      const targetZoom =
        typeof zoomOverride === 'number'
          ? zoomOverride
          : Math.min(0.95, Math.max(0.65, (stageW * 0.8) / targetWin.w))
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
    },
    []
  )

  /** Lùi lại đúng trang đã xem trước đó; nếu chưa có lịch sử thì lùi theo cấp route. */
  const navigateBack = useCallback(
    (currentWin: CanvasWin) => {
      const next = [...navHistoryRef.current]
      while (next.length > 0) {
        const id = next.pop() as string
        const target = windowsRef.current.find((w) => w.id === id)
        if (target && target.id !== currentWin.id) {
          navHistoryRef.current = next
          setNavHistory(next)
          flyToWindow(target, undefined, { record: false, markEndpoint: false })
          return
        }
      }

      // Không còn lịch sử: lùi về trang cha gần nhất, rồi tới trang chủ
      const parentId = getParentWinIdForRoute(currentWin.route, windowsRef.current)
      const parent =
        (parentId ? windowsRef.current.find((w) => w.id === parentId) : null) ||
        windowsRef.current.find((w) => w.isHome)
      if (parent && parent.id !== currentWin.id) {
        flyToWindow(parent, undefined, { record: false, markEndpoint: false })
      }
    },
    [flyToWindow]
  )

  const showWindow = useCallback((winId: string) => {
    setHiddenWinIds((prev) => {
      if (!prev.has(winId)) return prev
      const next = new Set(prev)
      next.delete(winId)
      return next
    })
  }, [])

  /** Hiện thông báo xem trước nhanh từ hành động Prototype. */
  const showProtoToast = useCallback((message: string) => {
    setProtoToast(message)
    if (protoToastTimerRef.current !== null) window.clearTimeout(protoToastTimerRef.current)
    protoToastTimerRef.current = window.setTimeout(() => {
      setProtoToast(null)
      protoToastTimerRef.current = null
    }, 2600)
  }, [])

  /** Thực thi hành động của một tương tác Prototype. */
  const executePrototypeAction = useCallback(
    (interaction: PrototypeInteraction) => {
      const target = windowsRef.current.find((w) => w.id === interaction.targetId)
      const parent = windowsRef.current.find((w) => w.id === interaction.parentId)

      if (interaction.action === 'back') {
        const current = parent || windowsRef.current.find((w) => w.id === activeWinId)
        if (current) navigateBack(current)
        return
      }

      if (interaction.action === 'toast') {
        const label =
          interaction.toastText?.trim() ||
          `${interaction.source.text || parent?.title || 'Nguồn'} → ${target?.title || 'Đích'}`
        showProtoToast(label)
        return
      }

      if (interaction.action === 'pulse_target') {
        const doc = iframeRefs.current.get(interaction.parentId)?.contentDocument
        const el = doc
          ? findPrototypeElement(doc, matchedElementsRef.current, interaction)
          : null
        if (el) {
          const prevTransition = el.style.transition
          const prevOutline = el.style.outline
          const prevOutlineOffset = el.style.outlineOffset
          const prevTransform = el.style.transform
          el.style.transition = 'outline 0.2s ease, transform 0.2s ease'
          el.style.outline = '3px solid #a855f7'
          el.style.outlineOffset = '3px'
          el.style.transform = 'scale(1.04)'
          const tId = window.setTimeout(() => {
            pendingTimersRef.current.delete(tId)
            el.style.transition = prevTransition
            el.style.outline = prevOutline
            el.style.outlineOffset = prevOutlineOffset
            el.style.transform = prevTransform
          }, 900)
          pendingTimersRef.current.add(tId)
        } else if (parent) {
          flyToWindow(parent, undefined, { record: false, markEndpoint: false })
        }
        return
      }

      if (interaction.action === 'highlight_wire') {
        const matchedWire =
          (interaction.wireId
            ? wiresRef.current.find((w) => w.id === interaction.wireId)
            : undefined) ||
          (interaction.anchorKey
            ? wiresRef.current.find((w) => w.anchorKey === interaction.anchorKey)
            : undefined) ||
          wiresRef.current.find(
            (w) => w.parentWin.id === interaction.parentId && w.targetWin.id === interaction.targetId
          )
        const wireKey = matchedWire?.id || interaction.wireId || ''
        if (!wireKey) return
        setFlashWireId(null)
        window.requestAnimationFrame(() => setFlashWireId(wireKey))
        if (flashWireTimerRef.current !== null) window.clearTimeout(flashWireTimerRef.current)
        flashWireTimerRef.current = window.setTimeout(() => {
          setFlashWireId(null)
          flashWireTimerRef.current = null
        }, 1800)
        return
      }

      if (!target) return

      if (interaction.action === 'open') {
        onOpenPage(target.route)
        onClose()
        return
      }

      if (interaction.action === 'reload') {
        showWindow(target.id)
        try {
          iframeRefs.current.get(target.id)?.contentWindow?.location.reload()
        } catch {
          // Bỏ qua nếu cross-origin
        }
        return
      }

      if (interaction.action === 'scroll_top') {
        showWindow(target.id)
        try {
          iframeRefs.current.get(target.id)?.contentWindow?.scrollTo({ top: 0, behavior: 'smooth' })
        } catch {
          // Bỏ qua nếu cross-origin
        }
        flyToWindow(target, undefined, { fromWinId: interaction.parentId })
        return
      }

      if (interaction.action === 'toggle') {
        const isHidden = hiddenWinIds.has(target.id)
        setHiddenWinIds((prev) => {
          const next = new Set(prev)
          if (isHidden) next.delete(target.id)
          else next.add(target.id)
          return next
        })
        // Vừa hiện lại cửa sổ đang ẩn: đưa camera tới đó luôn
        if (isHidden) flyToWindow(target, undefined, { fromWinId: interaction.parentId })
        return
      }

      // focus / flash: luôn đảm bảo cửa sổ đích đang hiển thị
      showWindow(target.id)

      if (interaction.action === 'flash') {
        flyToWindow(target, undefined, { fromWinId: interaction.parentId })
        // Đặt lại null trước để animation nhấp nháy chạy lại nếu bấm nhiều lần
        setFlashWinId(null)
        window.requestAnimationFrame(() => setFlashWinId(target.id))
        if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current)
        flashTimerRef.current = window.setTimeout(() => {
          setFlashWinId(null)
          flashTimerRef.current = null
        }, 1800)
        return
      }

      flyToWindow(target, undefined, { fromWinId: interaction.parentId })
    },
    [activeWinId, flyToWindow, hiddenWinIds, navigateBack, onClose, onOpenPage, showProtoToast, showWindow]
  )

  executePrototypeActionRef.current = executePrototypeAction

  /** Kiểm tra bộ điều khiển (Bật/tắt, số lần chạy tối đa, khoảng nghỉ, độ trễ) trước khi chạy. */
  const triggerPrototypeInteraction = useCallback(
    (interaction: PrototypeInteraction, bypassLimits = false) => {
      if (!bypassLimits && (!prototypeRunningRef.current || !interaction.enabled)) return

      const used = runCountsRef.current[interaction.id] ?? 0
      const trigLabel =
        PROTOTYPE_TRIGGERS.find((t) => t.key === interaction.trigger)?.label.split(' (')[0] ||
        interaction.trigger
      const actLabel =
        PROTOTYPE_ACTIONS.find((a) => a.key === interaction.action)?.label || interaction.action

      if (!bypassLimits && interaction.maxRuns > 0 && used >= interaction.maxRuns) {
        appendEventLog(
          `Dừng "${interaction.source.text || trigLabel}" (${used}/${interaction.maxRuns} lần)`,
          'skip'
        )
        return
      }

      const now = Date.now()
      const lastAt = lastRunAtRef.current[interaction.id] ?? 0
      if (
        !bypassLimits &&
        interaction.intervalSec > 0 &&
        lastAt > 0 &&
        now - lastAt < interaction.intervalSec * 1000
      ) {
        return
      }

      const nextCount = used + 1
      runCountsRef.current[interaction.id] = nextCount
      lastRunAtRef.current[interaction.id] = now
      setRunCounts((prev) => ({ ...prev, [interaction.id]: nextCount }))

      const limitText = interaction.maxRuns > 0 ? `${nextCount}/${interaction.maxRuns}` : `${nextCount}/∞`
      const runNow = () => {
        executePrototypeActionRef.current(interaction)
        appendEventLog(
          `[${trigLabel}] ${interaction.source.text || 'Dây'} → ${actLabel} (${limitText})`,
          interaction.maxRuns > 0 && nextCount >= interaction.maxRuns ? 'done' : 'run'
        )
      }

      if (!bypassLimits && interaction.delaySec > 0) {
        const tId = window.setTimeout(() => {
          pendingTimersRef.current.delete(tId)
          if (!prototypeRunningRef.current) return
          runNow()
        }, interaction.delaySec * 1000)
        pendingTimersRef.current.add(tId)
        return
      }

      runNow()
    },
    [appendEventLog]
  )

  triggerPrototypeInteractionRef.current = triggerPrototypeInteraction

  /** Đặt lại bộ đếm số lần chạy của 1 hoặc toàn bộ quy tắc. */
  const resetRunCount = useCallback((interactionId: string) => {
    delete runCountsRef.current[interactionId]
    delete lastRunAtRef.current[interactionId]
    setRunCounts((prev) => {
      const next = { ...prev }
      delete next[interactionId]
      return next
    })
  }, [])

  const resetAllRunCounts = useCallback(() => {
    pendingTimersRef.current.forEach((id) => window.clearTimeout(id))
    pendingTimersRef.current.clear()
    runCountsRef.current = {}
    lastRunAtRef.current = {}
    setRunCounts({})
    appendEventLog('Đã đặt lại toàn bộ bộ đếm sự kiện', 'run')
  }, [appendEventLog])

  // Tính toán lại vị trí các nút theo thời gian thực khi cuộn trang hoặc co giãn trên mọi cửa sổ cha
  const recomputeAnchors = useCallback(() => {
    const iframeH = WINDOW_HEIGHT - 34 // 566px
    const iframeW = WINDOW_WIDTH // 960px

    const flatAnchors: Record<string, DetectedAnchor> = {}

    matchedElementsRef.current.forEach(({ parentId, el, childId }, key) => {
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

      flatAnchors[key] = {
        key,
        childId,
        parentId,
        x: Math.round(clampedX),
        y: Math.round(clampedY),
        isClipped,
        clippedSide,
        text: (el.textContent || '').trim().slice(0, 30),
        tagName: el.tagName.toLowerCase(),
        className: typeof el.className === 'string' ? el.className : '',
        elementId: el.id || '',
      }
    })

    const grouped: Record<string, DetectedAnchor[]> = {}
    Object.values(flatAnchors).forEach((anchor) => {
      ;(grouped[anchor.childId] ??= []).push(anchor)
    })
    setDetectedAnchors(grouped)
  }, [])

  /** Gắn listener Hover / Scroll cho các tương tác Prototype bên trong iframe. */
  const setupPrototypeInteractions = useCallback(
    (win: CanvasWin, iframe: HTMLIFrameElement | null) => {
      prototypeBindingsRef.current.get(win.id)?.()
      prototypeBindingsRef.current.delete(win.id)
      if (!iframe) return

      let doc: Document | null = null
      try {
        doc = iframe.contentDocument
      } catch {
        return
      }
      if (!doc) return

      const cleanups: Array<() => void> = []
      prototypeBindingsRef.current.set(win.id, () => {
        cleanups.forEach((cleanup) => cleanup())
        cleanups.length = 0
      })

      if (!prototypeRunningRef.current) return

      const iframeWin = iframe.contentWindow
      const list = interactionsRef.current.filter(
        (item) =>
          item.enabled &&
          item.parentId === win.id &&
          item.trigger !== 'click' &&
          item.trigger !== 'timer'
      )
      if (list.length === 0) return

      const matched = matchedElementsRef.current
      const IORef = (iframeWin as (Window & typeof globalThis) | null)?.IntersectionObserver

      list.forEach((interaction) => {
        const fire = () => {
          if (!prototypeRunningRef.current || connectModeRef.current) return
          triggerPrototypeInteractionRef.current(interaction)
        }

        if (interaction.trigger === 'keypress') {
          const expectedKey = (interaction.triggerKey || 'Enter').trim().toLowerCase()
          const onKeyDown = (e: KeyboardEvent) => {
            if (!prototypeRunningRef.current || connectModeRef.current) return
            if (e.key.toLowerCase() === expectedKey) {
              fire()
            }
          }
          doc?.addEventListener('keydown', onKeyDown)
          cleanups.push(() => doc?.removeEventListener('keydown', onKeyDown))
          return
        }

        const el = findPrototypeElement(doc as Document, matched, interaction)
        if (!el) return

        if (interaction.trigger === 'hover') {
          let lastFired = 0
          const onEnter = () => {
            const now = Date.now()
            // Tránh bắn liên tục khi chuột rung trong cùng một vùng
            if (now - lastFired < 350) return
            lastFired = now
            fire()
          }
          el.addEventListener('mouseenter', onEnter)
          cleanups.push(() => el.removeEventListener('mouseenter', onEnter))
          return
        }

        if (interaction.trigger === 'mouseleave') {
          el.addEventListener('mouseleave', fire)
          cleanups.push(() => el.removeEventListener('mouseleave', fire))
          return
        }

        if (interaction.trigger === 'dblclick') {
          const onDbl = (e: MouseEvent) => {
            e.preventDefault()
            e.stopPropagation()
            fire()
          }
          el.addEventListener('dblclick', onDbl)
          cleanups.push(() => el.removeEventListener('dblclick', onDbl))
          return
        }

        if (interaction.trigger === 'contextmenu') {
          const onCtx = (e: MouseEvent) => {
            e.preventDefault()
            e.stopPropagation()
            fire()
          }
          el.addEventListener('contextmenu', onCtx)
          cleanups.push(() => el.removeEventListener('contextmenu', onCtx))
          return
        }

        if (interaction.trigger === 'longpress') {
          let holdTimer: number | null = null
          const clearHold = () => {
            if (holdTimer !== null) {
              window.clearTimeout(holdTimer)
              holdTimer = null
            }
          }
          const onDown = () => {
            clearHold()
            holdTimer = window.setTimeout(() => {
              holdTimer = null
              fire()
            }, 500)
          }
          el.addEventListener('mousedown', onDown)
          el.addEventListener('mouseup', clearHold)
          el.addEventListener('mouseleave', clearHold)
          cleanups.push(() => {
            clearHold()
            el.removeEventListener('mousedown', onDown)
            el.removeEventListener('mouseup', clearHold)
            el.removeEventListener('mouseleave', clearHold)
          })
          return
        }

        if (interaction.trigger === 'focus') {
          el.addEventListener('focus', fire)
          cleanups.push(() => el.removeEventListener('focus', fire))
          return
        }

        if (interaction.trigger === 'blur') {
          el.addEventListener('blur', fire)
          cleanups.push(() => el.removeEventListener('blur', fire))
          return
        }

        // trigger === 'scroll': kích hoạt khi phần tử cuộn vào vùng nhìn
        if (IORef) {
          // Nếu phần tử đang hiện sẵn, chờ nó rời khỏi vùng nhìn rồi quay lại mới kích hoạt
          const initialRect = el.getBoundingClientRect()
          let wasVisible =
            initialRect.top < (iframeWin?.innerHeight || 0) && initialRect.bottom > 0
          const observer = new IORef(
            (entries) => {
              entries.forEach((entry) => {
                if (entry.isIntersecting) {
                  if (!wasVisible) {
                    wasVisible = true
                    fire()
                  }
                } else {
                  wasVisible = false
                }
              })
            },
            { threshold: 0.5 }
          )
          observer.observe(el)
          cleanups.push(() => observer.disconnect())
          return
        }

        // Dự phòng khi iframe không hỗ trợ IntersectionObserver
        let armed = false
        const checkVisible = () => {
          const rect = el.getBoundingClientRect()
          const viewportH = iframeWin?.innerHeight || doc?.documentElement.clientHeight || 0
          const visible = rect.bottom > 0 && rect.top < viewportH
          if (visible && armed) {
            armed = false
            fire()
          } else if (!visible) {
            armed = true
          }
        }
        doc?.addEventListener('scroll', checkVisible, { passive: true })
        iframeWin?.addEventListener('scroll', checkVisible, { passive: true })
        checkVisible()
        cleanups.push(() => {
          doc?.removeEventListener('scroll', checkVisible)
          iframeWin?.removeEventListener('scroll', checkVisible)
        })
      })
    },
    []
  )

  // Gắn lại listener Prototype khi cấu hình hoặc công tắc "Chạy" thay đổi
  useEffect(() => {
    interactionsRef.current = interactions
    prototypeRunningRef.current = prototypeRunning
    const winMap = new Map(windowsRef.current.map((win) => [win.id, win]))
    iframeRefs.current.forEach((iframe, winId) => {
      const win = winMap.get(winId)
      if (win) setupPrototypeInteractions(win, iframe)
    })
  }, [interactions, prototypeRunning, setupPrototypeInteractions])

  // Bộ hẹn giờ tự động cho các sự kiện trigger === 'timer' (tuân thủ maxRuns & intervalSec)
  useEffect(() => {
    if (!prototypeRunning) return
    const timers: number[] = []

    interactions
      .filter((item) => item.enabled && item.trigger === 'timer')
      .forEach((interaction) => {
        const periodMs = Math.max(1000, Math.round((interaction.intervalSec || 3) * 1000))
        const intervalId = window.setInterval(() => {
          if (!prototypeRunningRef.current || connectModeRef.current) return
          const used = runCountsRef.current[interaction.id] ?? 0
          if (interaction.maxRuns > 0 && used >= interaction.maxRuns) {
            window.clearInterval(intervalId)
            return
          }
          triggerPrototypeInteractionRef.current(interaction)
        }, periodMs)
        timers.push(intervalId)
      })

    return () => {
      timers.forEach((id) => window.clearInterval(id))
    }
  }, [interactions, prototypeRunning])

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
          // Đang ở chế độ nối dây: không cho click điều hướng
          if (connectModeRef.current) {
            e.preventDefault()
            e.stopPropagation()
            return
          }

          const target = (e.target as HTMLElement).closest<HTMLElement>(
            'a, button, [role="button"], input[type="button"], input[type="submit"], [data-route]'
          )
          if (!target) return

          // Prototype Editor: hành động Click do người dùng cấu hình được ưu tiên
          if (prototypeRunningRef.current) {
            const clickInteraction = findPrototypeClick(
              doc,
              matchedElementsRef.current,
              interactionsRef.current,
              win.id,
              target
            )
            if (clickInteraction) {
              e.preventDefault()
              e.stopPropagation()
              triggerPrototypeInteractionRef.current(clickInteraction)
              return
            }
          }

          const rawHref = (target.getAttribute('href') || target.getAttribute('data-route') || '').trim()
          const text = (target.textContent || '').trim()
          const targetId = (target.id || '').trim()

          if (rawHref.startsWith('#') && rawHref.length > 1) return

          e.preventDefault()
          e.stopPropagation()

          // 1. Tìm anchorKey tương ứng trong matchedElementsRef
          let anchorKey: string | undefined
          matchedElementsRef.current.forEach((value, key) => {
            if (value.parentId !== win.id) return
            if (
              value.el === target ||
              value.el.contains(target) ||
              (target.tagName.toLowerCase() === 'a' && value.el.closest('a') === target)
            ) {
              anchorKey = key
            }
          })

          const normHref =
            rawHref && rawHref !== '#' && rawHref !== 'javascript:void(0)'
              ? normalizeRoute(rawHref.replace(/^https?:\/\/[^/]+/, '')).toLowerCase()
              : ''
          const cleanText = text.toLowerCase()

          // 2. Tìm dây nối xuất phát từ nút bấm này: dùng hệ thống điểm số đa tiêu chí để chọn dây chính xác nhất
          let bestWire: Wire | null = null
          let bestScore = 0

          for (const w of wiresRef.current) {
            if (w.parentWin.id !== win.id) continue

            let score = 0

            // Khớp chính xác ID phần tử nếu có
            if (targetId && w.source?.elementId && targetId === w.source.elementId) {
              score += 200
            }

            // Khớp anchorKey hoặc satId với phần tử đã quét
            if (anchorKey && (w.anchorKey === anchorKey || w.satId === anchorKey)) {
              score += 160
            }

            // Khớp route đích của dây với href / data-route của nút
            if (normHref) {
              const targetRoute = normalizeRoute(w.targetWin.route).toLowerCase()
              if (targetRoute === normHref) {
                score += 140
              } else if (normHref.endsWith(targetRoute) || targetRoute.endsWith(normHref)) {
                score += 100
              } else if (targetRoute.includes(normHref) || normHref.includes(targetRoute)) {
                score += 70
              }
            }

            // Khớp text của nút với text lưu trong dây nguồn hoặc tiêu đề trang đích
            if (cleanText && cleanText.length >= 2) {
              const srcText = (w.source?.text || '').trim().toLowerCase()
              const wireLabel = (w.label || w.targetWin.title || '').trim().toLowerCase()
              if (srcText && srcText === cleanText) {
                score += 120
              } else if (srcText && (srcText.includes(cleanText) || cleanText.includes(srcText))) {
                score += 80
              } else if (
                wireLabel &&
                (wireLabel === cleanText || wireLabel.includes(cleanText) || cleanText.includes(wireLabel))
              ) {
                score += 75
              }
            }

            if (score > bestScore) {
              bestScore = score
              bestWire = w
            }
          }

          if (bestWire && bestScore >= 70) {
            flyToWindow(bestWire.targetWin, undefined, { fromWinId: win.id })
            return
          }

          // Kiểm tra xem nút bấm này có từng bị xoá dây nối (unlinked) hay không
          const isExplicitlyUnlinked =
            (anchorKey && hiddenWireIds.has(`wire-${anchorKey}`)) ||
            (anchorKey && unlinkedButtonsRef.current.has(`${win.id}:${anchorKey}`)) ||
            (cleanText && unlinkedButtonsRef.current.has(`${win.id}:${cleanText}`)) ||
            (targetId && unlinkedButtonsRef.current.has(`${win.id}:#${targetId}`)) ||
            rawHref === '#' ||
            rawHref === 'javascript:void(0)'

          if (isExplicitlyUnlinked) {
            // Đã xoá dây liên kết: không thực hiện điều hướng ngầm định
            return
          }

          const targetWin = findMatchingWindow(rawHref, text, windowsRef.current)
          if (targetWin) {
            flyToWindow(targetWin, undefined, { fromWinId: win.id })
          }
        }

        const docListeners = doc as Document & {
          __pmClick?: (e: MouseEvent) => void
          __pmConnectDown?: (e: PointerEvent) => void
          __pmScroll?: () => void
        }
        if (docListeners.__pmClick) doc.removeEventListener('click', docListeners.__pmClick, true)
        docListeners.__pmClick = handleClick
        doc.addEventListener('click', handleClick, true)

        // 1b. Chế độ nối dây: giữ chuột trên một nút bấm để bắt đầu kéo dây
        const handleConnectPointerDown = (e: PointerEvent) => {
          if (!connectModeRef.current || e.button !== 0) return
          const target = (e.target as HTMLElement)?.closest<HTMLElement>(
            'a, button, [role="button"], input[type="button"], input[type="submit"], [data-route], [onclick]'
          )
          if (!target) return

          const parentWin = windowsRef.current.find((w) => w.id === win.id)
          const stage = stageRef.current
          const stageRect = stage?.getBoundingClientRect()
          if (!parentWin || !stageRect) return

          e.preventDefault()
          e.stopPropagation()

          const rect = target.getBoundingClientRect()
          const relX = Math.round(rect.left + rect.width / 2)
          const relY = Math.round(rect.top + rect.height / 2)

          // Tìm anchor đã quét tương ứng để dây bám theo khi trang cha cuộn
          let anchorKey: string | undefined
          matchedElementsRef.current.forEach((value, key) => {
            if (value.parentId !== win.id) return
            if (value.el === target || value.el.contains(target) || target.contains(value.el)) {
              anchorKey = key
            }
          })

          const srcWorldX = parentWin.x - parentWin.w / 2 + relX
          const srcWorldY = parentWin.y - parentWin.h / 2 + 34 + relY
          const v = viewRef.current
          const srcClientX = stageRect.left + v.panX + srcWorldX * v.zoom
          const srcClientY = stageRect.top + v.panY + srcWorldY * v.zoom

          setConnectDrag({
            parentId: win.id,
            anchorKey,
            sourceX: relX,
            sourceY: relY,
            source: {
              text: (target.textContent || '').trim().slice(0, 30),
              tagName: target.tagName.toLowerCase(),
              className: target.getAttribute('class') || '',
              elementId: target.id || '',
            },
            srcWorldX,
            srcWorldY,
            srcClientX,
            srcClientY,
            clientX: srcClientX,
            clientY: srcClientY,
            hoverTargetId: null,
          })
        }

        if (docListeners.__pmConnectDown) {
          doc.removeEventListener('pointerdown', docListeners.__pmConnectDown, true)
        }
        docListeners.__pmConnectDown = handleConnectPointerDown
        doc.addEventListener('pointerdown', handleConnectPointerDown, true)

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

          // Dọn dẹp các liên kết cũ của cửa sổ này trước khi lưu liên kết mới
          for (const [k, v] of matchedElementsRef.current.entries()) {
            if (v.parentId === win.id) {
              matchedElementsRef.current.delete(k)
            }
          }

          const claimedElements = new Set<HTMLElement>()
          const anchorsByChild = new Map<string, number>()

          for (const match of matchScores) {
            if (claimedElements.has(match.el)) continue
            const used = anchorsByChild.get(match.childId) ?? 0
            if (used >= MAX_ANCHORS_PER_TARGET) continue
            anchorsByChild.set(match.childId, used + 1)
            claimedElements.add(match.el)
            matchedElementsRef.current.set(`${match.childId}#${used}`, {
              childId: match.childId,
              parentId: win.id,
              el: match.el,
            })
          }

          recomputeAnchors()

          const iframeWin = iframe.contentWindow
          if (iframeWin) {
            const handleScroll = () => {
              recomputeAnchors()
            }
            if (docListeners.__pmScroll) {
              iframeWin.removeEventListener('scroll', docListeners.__pmScroll)
              doc.removeEventListener('scroll', docListeners.__pmScroll)
              doc.removeEventListener('wheel', docListeners.__pmScroll)
            }
            docListeners.__pmScroll = handleScroll
            iframeWin.addEventListener('scroll', handleScroll, { passive: true })
            doc.addEventListener('scroll', handleScroll, { passive: true })
            doc.addEventListener('wheel', handleScroll, { passive: true })
          }
        }

        // Gắn hành vi Prototype (Hover / Scroll) sau khi đã quét lại anchor
        setupPrototypeInteractions(win, iframe)
      } catch {
        // Safe cross-origin fallback
      }
    },
    [flyToWindow, recomputeAnchors, setupPrototypeInteractions]
  )

  // Áp dụng thuật toán sắp xếp
  const applyLayout = useCallback(
    (mode: LayoutMode) => {
      setLayoutMode(mode)
      const homePage = pages.find((p) => normalizeRoute(p.route) === '/')
      const otherPages = dedupePages(pages).filter((p) => normalizeRoute(p.route) !== '/')

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
      fitBounding(computed.filter((win) => !hiddenWinIds.has(win.id)))
    },
    [pages, fitBounding, detectedAnchors, hiddenWinIds]
  )

  // Đồng bộ danh sách cửa sổ khi dự án được thêm/xoá trang trong lúc đang mở.
  // Thêm/xoá trang sẽ xếp lại toàn bộ; chỉ đổi tên/route thì giữ nguyên vị trí.
  const pageIdsRef = useRef(pages.map((p) => p.id).join('|'))
  useEffect(() => {
    const homePage = pages.find((p) => normalizeRoute(p.route) === '/')
    const otherPages = dedupePages(pages).filter((p) => normalizeRoute(p.route) !== '/')

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
      layoutMode === 'rings'
        ? computeRingsLayout(homeWin, otherPages, detectedAnchors)
        : computeClusterLayout(homeWin, otherPages)

    const nextIds = pages.map((p) => p.id).join('|')
    const idsChanged = pageIdsRef.current !== nextIds
    pageIdsRef.current = nextIds

    // Thêm/xoá trang: xếp lại toàn bộ để cửa sổ mới không đè lên cửa sổ cũ.
    if (idsChanged) {
      windowsRef.current = computed
      setWindows(computed)
      const timer = setTimeout(() => fitBounding(computed), 80)
      return () => clearTimeout(timer)
    }

    // Chỉ đổi tên/route: giữ nguyên vị trí người dùng đã kéo.
    setWindows((prev) => {
      const prevById = new Map(prev.map((w) => [w.id, w]))
      let changed = false
      const merged = computed.map((cw) => {
        const old = prevById.get(cw.id)
        if (!old) {
          changed = true
          return cw
        }
        if (old.title !== cw.title || old.route !== cw.route || old.page !== cw.page) {
          changed = true
          return { ...old, page: cw.page, route: cw.route, title: cw.title }
        }
        return old
      })
      if (!changed) return prev
      windowsRef.current = merged
      return merged
    })
    return undefined
  }, [pages, layoutMode, detectedAnchors, fitBounding])

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
      (e.target as HTMLElement).closest('.pm-multi-topbar') ||
      (e.target as HTMLElement).closest('.pm-multi-focus-pill') ||
      (e.target as HTMLElement).closest('.pm-multi-pin') ||
      (e.target as HTMLElement).closest('.pm-multi-connect-banner')
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

  const anchorIndex = useMemo(() => {
    const map: Record<string, DetectedAnchor> = {}
    Object.values(detectedAnchors).forEach((list) => {
      list.forEach((anchor) => {
        map[anchor.key] = anchor
      })
    })
    return map
  }, [detectedAnchors])

  const wires = useMemo<Wire[]>(() => {
    const list: Wire[] = []

    // Dây tự động: chỉ hiển thị khi quét được nút bấm thật trên trang cha.
    windows.forEach((childWin) => {
      if (childWin.isHome) return
      const anchors = detectedAnchors[childWin.id] ?? []
      anchors.forEach((anchor) => {
        const parentWin = windows.find((w) => w.id === anchor.parentId)
        if (!parentWin) return

        const autoId = `wire-${anchor.key}`
        if (hiddenWireIds.has(autoId)) return

        const shape = computeWireShape(parentWin, childWin, anchor)
        if (!shape) return
        list.push({
          ...shape,
          id: autoId,
          satId: childWin.id,
          hasAnchor: true,
          label: childWin.title,
          anchorKey: anchor.key,
          source: {
            text: anchor.text,
            tagName: anchor.tagName,
            className: anchor.className,
            elementId: anchor.elementId,
          },
        })
      })
    })

    // Dây thủ công: nối từ nút bấm nguồn sang trang đích.
    manualWires.forEach((mw) => {
      const parentWin = windows.find((w) => w.id === mw.parentId)
      const targetWin = windows.find((w) => w.id === mw.targetId)
      if (!parentWin || !targetWin || targetWin.isHome) return

      const tracked = mw.anchorKey ? anchorIndex[mw.anchorKey] : undefined
      const anchor: DetectedAnchor =
        tracked && tracked.parentId === mw.parentId
          ? tracked
          : {
              key: mw.anchorKey ?? mw.id,
              childId: targetWin.id,
              parentId: mw.parentId,
              x: mw.sourceX,
              y: mw.sourceY,
              isClipped: false,
              text: mw.source.text,
              tagName: mw.source.tagName,
              className: mw.source.className,
              elementId: mw.source.elementId,
            }

      const shape = computeWireShape(parentWin, targetWin, anchor)
      if (!shape) return
      list.push({
        ...shape,
        id: mw.id,
        satId: targetWin.id,
        hasAnchor: true,
        label: targetWin.title,
        anchorKey: mw.anchorKey,
        source: mw.source,
      })
    })

    return list
  }, [windows, detectedAnchors, anchorIndex, manualWires, hiddenWireIds])

  wiresRef.current = wires

  const visibleWindows = useMemo(
    () => windows.filter((win) => !hiddenWinIds.has(win.id)),
    [windows, hiddenWinIds]
  )

  const visibleWires = useMemo(
    () =>
      wires.filter(
        (wire) => !hiddenWinIds.has(wire.parentWin.id) && !hiddenWinIds.has(wire.targetWin.id)
      ),
    [wires, hiddenWinIds]
  )

  /** Mở bảng Prototype gắn trực tiếp với dây nối vừa chuột phải. */
  const openWirePrototypeEditor = useCallback((wire: Wire) => {
    setSelectedWireId(wire.id)
    setShowEventController(false)
    setWireProtoTarget({
      wireId: wire.id,
      sourceKey: wire.anchorKey ? `anchor:${wire.anchorKey}` : `wire:${wire.id}`,
      parentId: wire.parentWin.id,
      parentTitle: wire.parentWin.title,
      targetId: wire.targetWin.id,
      targetTitle: wire.targetWin.title,
      label: (wire.source?.text || wire.label || wire.targetWin.title).trim(),
      source: wire.source ?? {},
      anchorKey: wire.anchorKey,
    })
    setDraftTargetId(wire.targetWin.id)
    setDraftTrigger('click')
    setDraftAction('focus')
    setDraftMaxRuns(1)
    setDraftIntervalSec(0)
    setDraftDelaySec(0)
    setDraftTriggerKey('Enter')
    setDraftToastText('')
  }, [])

  /** Kiểm tra tương tác có thuộc về một dây đang chọn hay không. */
  const isInteractionOnWire = useCallback(
    (
      item: PrototypeInteraction,
      target: NonNullable<typeof wireProtoTarget>
    ): boolean => {
      if (item.wireId && item.wireId === target.wireId) return true
      if (target.anchorKey && item.anchorKey === target.anchorKey) return true
      return (
        item.parentId === target.parentId &&
        item.targetId === target.targetId &&
        (item.source.text || '') === (target.source.text || '')
      )
    },
    []
  )

  const wireScopedInteractions = useMemo(() => {
    if (!wireProtoTarget) return []
    return interactions.filter((item) => isInteractionOnWire(item, wireProtoTarget))
  }, [interactions, wireProtoTarget, isInteractionOnWire])

  const addWirePrototypeInteraction = useCallback(() => {
    if (!wireProtoTarget) return
    const targetId = draftTargetId || wireProtoTarget.targetId
    if (!targetId) return

    const safeMaxRuns = Math.max(0, Math.floor(Number.isFinite(draftMaxRuns) ? draftMaxRuns : 1))
    const safeIntervalSec = Math.max(
      0,
      Number.isFinite(draftIntervalSec) ? Math.round(draftIntervalSec * 10) / 10 : 0
    )
    const safeDelaySec = Math.max(
      0,
      Number.isFinite(draftDelaySec) ? Math.round(draftDelaySec * 10) / 10 : 0
    )

    const next: PrototypeInteraction = {
      id: `proto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      parentId: wireProtoTarget.parentId,
      targetId,
      wireId: wireProtoTarget.wireId,
      anchorKey: wireProtoTarget.anchorKey,
      source: wireProtoTarget.source,
      trigger: draftTrigger,
      action: draftAction,
      enabled: true,
      maxRuns: safeMaxRuns,
      intervalSec: draftIntervalSec > 0 ? safeIntervalSec : draftTrigger === 'timer' ? 3 : 0,
      delaySec: safeDelaySec,
      triggerKey: draftTrigger === 'keypress' ? draftTriggerKey.trim() || 'Enter' : undefined,
      toastText: draftAction === 'toast' ? draftToastText.trim() || undefined : undefined,
    }

    // Cùng một dây/nguồn + cùng sự kiện thì thay thế cấu hình cũ để tránh trùng
    setInteractions((prev) => [
      ...prev.filter(
        (item) => !(isInteractionOnWire(item, wireProtoTarget) && item.trigger === next.trigger)
      ),
      next,
    ])
    onNotify?.('ok', `Đã gắn sự kiện cho dây "${wireProtoTarget.label}"`)
  }, [
    draftAction,
    draftDelaySec,
    draftIntervalSec,
    draftMaxRuns,
    draftTargetId,
    draftToastText,
    draftTrigger,
    draftTriggerKey,
    isInteractionOnWire,
    onNotify,
    wireProtoTarget,
  ])

  const updatePrototypeInteraction = useCallback(
    (id: string, patch: Partial<PrototypeInteraction>) => {
      setInteractions((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
      )
    },
    []
  )

  const removePrototypeInteraction = useCallback((id: string) => {
    setInteractions((prev) => prev.filter((item) => item.id !== id))
    resetRunCount(id)
  }, [resetRunCount])

  const clearPrototypeInteractions = useCallback(() => {
    setInteractions([])
    resetAllRunCounts()
    onNotify?.('info', 'Đã xoá toàn bộ tương tác Prototype')
  }, [onNotify, resetAllRunCounts])

  const toggleAllInteractions = useCallback(
    (enabled: boolean) => {
      setInteractions((prev) => prev.map((item) => ({ ...item, enabled })))
      appendEventLog(enabled ? 'Đã bật toàn bộ quy tắc sự kiện' : 'Đã tắt toàn bộ quy tắc sự kiện', 'run')
    },
    [appendEventLog]
  )

  const applyBatchLimits = useCallback(() => {
    const safeMax = Math.max(0, Math.floor(Number.isFinite(batchMaxRuns) ? batchMaxRuns : 1))
    const safeInterval = Math.max(0, Math.round((Number.isFinite(batchIntervalSec) ? batchIntervalSec : 0) * 10) / 10)
    const safeDelay = Math.max(0, Math.round((Number.isFinite(batchDelaySec) ? batchDelaySec : 0) * 10) / 10)
    setInteractions((prev) =>
      prev.map((item) => ({
        ...item,
        maxRuns: safeMax,
        intervalSec: item.trigger === 'timer' && safeInterval <= 0 ? 3 : safeInterval,
        delaySec: safeDelay,
      }))
    )
    resetAllRunCounts()
    onNotify?.('ok', 'Đã áp dụng giới hạn chạy cho toàn bộ sự kiện')
  }, [batchDelaySec, batchIntervalSec, batchMaxRuns, onNotify, resetAllRunCounts])

  const locateWireForInteraction = useCallback(
    (item: PrototypeInteraction) => {
      const parentWin = windowsRef.current.find((w) => w.id === item.parentId)
      const matchedWire =
        (item.wireId ? wiresRef.current.find((w) => w.id === item.wireId) : undefined) ||
        (item.anchorKey ? wiresRef.current.find((w) => w.anchorKey === item.anchorKey) : undefined) ||
        wiresRef.current.find((w) => w.parentWin.id === item.parentId && w.targetWin.id === item.targetId)

      if (parentWin) {
        flyToWindow(parentWin, undefined, { record: false, markEndpoint: false })
      }
      if (matchedWire) {
        setSelectedWireId(matchedWire.id)
        setFlashWireId(null)
        window.requestAnimationFrame(() => setFlashWireId(matchedWire.id))
        if (flashWireTimerRef.current !== null) window.clearTimeout(flashWireTimerRef.current)
        flashWireTimerRef.current = window.setTimeout(() => {
          setFlashWireId(null)
          flashWireTimerRef.current = null
        }, 1800)
      }
    },
    [flyToWindow]
  )

  /** Tìm cửa sổ đích dưới con trỏ khi đang kéo dây. */
  const resolveDropTarget = (clientX: number, clientY: number, excludeId?: string): CanvasWin | null => {
    const stageRect = stageRef.current?.getBoundingClientRect()
    if (!stageRect) return null
    const v = viewRef.current
    const worldX = (clientX - stageRect.left - v.panX) / v.zoom
    const worldY = (clientY - stageRect.top - v.panY) / v.zoom

    return (
      windowsRef.current.find(
        (w) =>
          w.id !== excludeId &&
          !w.isHome &&
          Math.abs(worldX - w.x) <= w.w / 2 &&
          Math.abs(worldY - w.y) <= w.h / 2
      ) || null
    )
  }

  const handleConnectDragMove = (e: React.PointerEvent) => {
    const hover = resolveDropTarget(e.clientX, e.clientY, connectDrag?.parentId)
    setConnectDrag((prev) =>
      prev ? { ...prev, clientX: e.clientX, clientY: e.clientY, hoverTargetId: hover?.id || null } : prev
    )
  }

  const handleConnectDragEnd = (e: React.PointerEvent) => {
    const drag = connectDrag
    if (!drag) {
      setConnectDrag(null)
      return
    }

    const target = resolveDropTarget(e.clientX, e.clientY, drag.parentId)
    if (target) {
      const parentWin = windowsRef.current.find((w) => w.id === drag.parentId)
      const parentRoute = parentWin?.route
      pushHistory([
        {
          action: 'unlink',
          currentPath: parentRoute,
          targetRoute: target.route,
          source: drag.source,
        },
      ])

      // Xoá đánh dấu unlinked nếu có trên nút này
      if (drag.anchorKey) {
        unlinkedButtonsRef.current.delete(`${drag.parentId}:${drag.anchorKey}`)
        setHiddenWireIds((prev) => {
          const next = new Set(prev)
          next.add(`wire-${drag.anchorKey}`)
          return next
        })
      }
      if (drag.source.text) {
        unlinkedButtonsRef.current.delete(`${drag.parentId}:${drag.source.text}`)
      }
      if (drag.source.elementId) {
        unlinkedButtonsRef.current.delete(`${drag.parentId}:#${drag.source.elementId}`)
      }

      const id = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setManualWires((prev) => [
        ...prev.filter((mw) => {
          if (mw.parentId !== drag.parentId) return true
          if (drag.anchorKey && mw.anchorKey === drag.anchorKey) return false
          if (drag.source.elementId && mw.source.elementId === drag.source.elementId) return false
          if (drag.source.text && mw.source.text === drag.source.text) return false
          return true
        }),
        {
          id,
          parentId: drag.parentId,
          targetId: target.id,
          anchorKey: drag.anchorKey,
          sourceX: drag.sourceX,
          sourceY: drag.sourceY,
          source: drag.source,
        },
      ])

      // Cập nhật DOM trực tiếp trong iframe nếu có
      try {
        const parentIframe = iframeRefs.current.get(drag.parentId)
        const doc = parentIframe?.contentDocument
        if (doc) {
          const matchedEl = drag.anchorKey ? matchedElementsRef.current.get(drag.anchorKey)?.el : null
          const candidate =
            matchedEl || (drag.source.elementId ? doc.getElementById(drag.source.elementId) : null)
          if (candidate) {
            candidate.setAttribute('href', target.route)
            candidate.setAttribute('data-route', target.route)
          }
        }
      } catch {}

      // Thêm logic nối trang vào mã nguồn của nút bấm nguồn
      void syncWireCode('link', drag.source, target.route, parentRoute)
    }
    setConnectDrag(null)
  }

  const portSideMap = useMemo(() => {
    const map: Record<string, 'top' | 'bottom' | 'left' | 'right'> = {}
    visibleWires.forEach((w) => {
      map[w.satId] = w.portSide
    })
    return map
  }, [visibleWires])

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
        <div className="pm-multi-topbar__title" title={`Không gian đa màn hình · ${projectName}`}>
          <span className="pm-multi-topbar__icon">
            <LayoutGrid size={14} />
          </span>
          <div className="pm-multi-topbar__text">
            <b>Đa màn hình</b>
            <span className="pm-multi-topbar__project">{projectName}</span>
          </div>
        </div>

        <span className="pm-multi-chip" title="Số trang đang hiển thị">
          {visibleWindows.length} trang
        </span>
        <span className="pm-multi-chip pm-multi-chip--wires" title="Số liên kết đang hiển thị">
          {visibleWires.length} liên kết
        </span>

        <div className="pm-multi-topbar__spacer" />

        {/* Chuyển đổi chế độ sắp xếp tự động */}
        <div className="pm-segmented pm-multi-layout" role="group" aria-label="Kiểu sắp xếp">
          <button
            className={layoutMode === 'cluster' ? 'on' : ''}
            onClick={() => applyLayout('cluster')}
            title="Xếp theo cụm chuyên mục, tránh chồng chéo"
          >
            <LayoutGrid size={12} />
            <span className="pm-multi-btn-label">Theo cụm</span>
          </button>
          <button
            className={layoutMode === 'rings' ? 'on' : ''}
            onClick={() => applyLayout('rings')}
            title="Xếp tỏa tròn nhiều tầng, không chồng lấn"
          >
            <Compass size={12} />
            <span className="pm-multi-btn-label">Đa vòng</span>
          </button>
        </div>

        {/* Ô tìm kiếm trang */}
        <div className="pm-multi-search-box">
          <Search size={12} className="pm-multi-search-icon" />
          <input
            className="pm-multi-search-input"
            placeholder="Tìm trang..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Tìm trang theo tên hoặc route"
          />
          {searchQuery && (
            <button className="pm-multi-search-clear" onClick={() => setSearchQuery('')} title="Xoá tìm kiếm">
              <X size={11} />
            </button>
          )}
        </div>

        <div className="pm-multi-topbar__actions">
          <button className="pm-ibtn" onClick={() => fitBounding(visibleWindows)} title="Căn vừa toàn bộ các cửa sổ">
            <Maximize2 size={13} />
          </button>
          <button
            className="pm-ibtn"
            onClick={() => applyLayout(layoutMode)}
            title="Sắp xếp lại, tránh chồng đè"
          >
            <RefreshCw size={13} />
          </button>
          <button
            className={`pm-ibtn ${isConnectMode ? 'on' : ''}`}
            onClick={() => setIsConnectMode((v) => !v)}
            title={
              isConnectMode
                ? 'Thoát chế độ nối dây (Esc)'
                : 'Nối dây: giữ chuột vào nút bấm rồi kéo sang trang đích'
            }
          >
            <Link2 size={13} />
          </button>
          <button
            className={`pm-ibtn pm-multi-has-count pm-multi-evt-btn ${showEventController ? 'on' : ''} ${
              prototypeRunning && interactions.some((i) => i.enabled) ? 'is-running' : ''
            }`}
            onClick={() => {
              const next = !showEventController
              setShowEventController(next)
              if (next) setWireProtoTarget(null)
            }}
            title={
              prototypeRunning
                ? `Kiểm soát sự kiện: Đang chạy (${interactions.filter((i) => i.enabled).length}/${interactions.length} quy tắc bật) · Chuột phải vào dây để gắn sự kiện`
                : `Kiểm soát sự kiện: Đang tạm dừng (${interactions.length} quy tắc)`
            }
          >
            <SlidersHorizontal size={13} />
            {interactions.length > 0 && (
              <span className="pm-multi-restore__count">{interactions.length}</span>
            )}
          </button>
          {hiddenWinIds.size > 0 && (
            <button
              className="pm-ibtn pm-multi-has-count"
              onClick={() => setHiddenWinIds(new Set())}
              title={`Hiện lại ${hiddenWinIds.size} cửa sổ đã ẩn`}
            >
              <Eye size={13} />
              <span className="pm-multi-restore__count">{hiddenWinIds.size}</span>
            </button>
          )}
          <span className="pm-multi-topbar__divider" />
          <button className="pm-ibtn pm-multi-close" onClick={onClose} title="Đóng chế độ đa màn hình (Esc)">
            <X size={14} />
          </button>
        </div>
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
          {visibleWindows.map((win) => {
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
                  isConnectMode && !win.isHome && win.id !== connectDrag?.parentId ? 'is-wire-target' : '',
                  connectDrag?.hoverTargetId === win.id ? 'is-drop-target' : '',
                  flashWinId === win.id ? 'is-flash' : '',
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
                {visibleWires.map((w) => (
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
                    <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={w.color} />
                  </marker>
                ))}
              </defs>

              {visibleWires.map((wire) => {
                const isHovered = hoveredWinId === wire.satId || activeWinId === wire.satId
                const isSelected = selectedWireId === wire.id
                const isProtoFlash = flashWireId === wire.id
                const isWireConfigOpen = wireProtoTarget?.wireId === wire.id
                const ruleCount = interactions.filter(
                  (item) =>
                    item.enabled &&
                    (item.wireId === wire.id ||
                      (wire.anchorKey && item.anchorKey === wire.anchorKey))
                ).length
                return (
                  <g key={wire.id} style={{ cursor: 'pointer' }}>
                    {/* Vùng bấm rộng để dễ chọn dây hoặc chuột phải mở Prototype */}
                    <path
                      d={wire.pathD}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={14}
                      style={{ pointerEvents: 'stroke' }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedWireId((prev) => (prev === wire.id ? null : wire.id))
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        flyToWindow(wire.targetWin, undefined, { fromWinId: wire.parentWin.id })
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        openWirePrototypeEditor(wire)
                      }}
                    >
                      <title>{`Dây nối: ${wire.parentWin.title} → ${wire.label}${
                        ruleCount > 0 ? ` (${ruleCount} sự kiện Prototype)` : ''
                      } · Chuột phải để cấu hình Prototype · Click chọn · Delete xoá`}</title>
                    </path>

                    {/* Dây bóng phát sáng khi hover, được chọn hoặc kích hoạt hiệu ứng */}
                    <path
                      d={wire.pathD}
                      className={`pm-multi-wire-glow ${isProtoFlash ? 'is-proto-flash' : ''}`}
                      style={{
                        stroke: isProtoFlash ? '#a855f7' : wire.color,
                        strokeWidth: isProtoFlash ? 14 : isSelected || isWireConfigOpen ? 11 : isHovered ? 9 : 5,
                        opacity: isProtoFlash ? 0.95 : isSelected || isWireConfigOpen ? 0.85 : isHovered ? 0.55 : 0.28,
                      }}
                    />

                    {/* Dây nối chính */}
                    <path
                      d={wire.pathD}
                      className={[
                        'pm-multi-wire',
                        isHovered ? 'pm-multi-wire-active' : '',
                        isSelected || isWireConfigOpen ? 'pm-multi-wire-selected' : '',
                        isProtoFlash ? 'is-proto-flash' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      markerEnd={`url(#arrow-${wire.id})`}
                      style={{
                        stroke: isProtoFlash ? '#c084fc' : wire.color,
                        strokeWidth: isProtoFlash ? 4.4 : isSelected || isWireConfigOpen ? 3.6 : isHovered ? 3.0 : 2.2,
                        opacity: isSelected || isHovered || isProtoFlash || isWireConfigOpen ? 1 : 0.85,
                      }}
                    />

                    {/* Hạt ánh sáng chuyển động dọc dây nối */}
                    <circle
                      r={isProtoFlash ? 5.5 : isHovered ? 4.5 : ruleCount > 0 ? 3.8 : 3}
                      fill={isProtoFlash ? '#c084fc' : wire.color}
                      className="pm-multi-particle"
                    >
                      <animateMotion
                        dur={isProtoFlash ? '0.9s' : isHovered ? '2s' : '3.5s'}
                        repeatCount="indefinite"
                        path={wire.pathD}
                      />
                    </circle>
                  </g>
                )
              })}
            </g>
          </svg>

          {/* ── 3. CÁC ĐIỂM GHIM TRÊN NÚT BẤM (NẰM TRÊN NÚT CỦA CỬA SỔ CHA) ── */}
          {visibleWires
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
                    ? `Nút bấm mở [${wire.label}] đã cuộn khuất khỏi tầm nhìn (Click chuyển góc nhìn · Chuột phải cấu hình Prototype)`
                    : `Nối từ nút bấm: [${wire.parentWin.title}] -> [${wire.label}] (Click chuyển góc nhìn · Chuột phải cấu hình Prototype)`
                }
                onClick={() => flyToWindow(wire.targetWin, undefined, { fromWinId: wire.parentWin.id })}
                onContextMenu={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  openWirePrototypeEditor(wire)
                }}
              >
                <span className="pm-multi-pin-dot" />
              </div>
            ))}
        </div>

        {/* ── Thanh điều hướng nhanh khi đang chuyển góc nhìn sang trang khác ── */}
        {flyingToWin &&
          (() => {
            const lastWin = lastReachedWinId
              ? windows.find((w) => w.id === lastReachedWinId) || null
              : null
            if (flyingToWin.isHome && (!lastWin || lastWin.id === homeWin?.id)) {
              return null
            }

            const historyBackId = [...navHistory]
              .reverse()
              .find((id) => {
                const win = windows.find((w) => w.id === id)
                return win ? win.id !== flyingToWin.id : false
              })
            const hasHistory = Boolean(historyBackId)
            const parentId = parentMap.get(flyingToWin.id)
            const fallback =
              (parentId ? windows.find((w) => w.id === parentId) : null) || homeWin || null
            const backWin =
              (historyBackId ? windows.find((w) => w.id === historyBackId) : fallback) || null
            const canGoBack = !flyingToWin.isHome && Boolean(backWin && backWin.id !== flyingToWin.id)
            const isAtLastWin = Boolean(lastWin && lastWin.id === flyingToWin.id)

            return (
              <div className="pm-multi-focus-pill">
                <span>
                  Đang xem: <b>{flyingToWin.title}</b> ({flyingToWin.route})
                </span>
                {canGoBack && backWin && (
                  <button
                    onClick={() => navigateBack(flyingToWin)}
                    title={`Lui lại trang liền trước: ${backWin.title} (${backWin.route})`}
                  >
                    ← {hasHistory ? 'Quay lại' : 'Quay về'} {backWin.title}
                  </button>
                )}
                {homeWin && !flyingToWin.isHome && (
                  <button
                    onClick={() =>
                      flyToWindow(homeWin, undefined, { record: false, markEndpoint: false })
                    }
                    title="Về lại màn hình Trang chủ"
                  >
                    Trang chủ
                  </button>
                )}
                {lastWin && (
                  <button
                    className={isAtLastWin ? 'is-endpoint-active' : undefined}
                    onClick={() => {
                      if (isAtLastWin) {
                        flyToWindow(lastWin, undefined, { record: false, markEndpoint: false })
                        return
                      }
                      const shouldRecord = !flyingToWin.isHome || navHistory.length === 0
                      flyToWindow(lastWin, undefined, {
                        record: shouldRecord,
                        fromWinId: flyingToWin.id,
                        markEndpoint: false,
                      })
                    }}
                    title={
                      isAtLastWin
                        ? `Đang ở điểm đến cuối cùng vừa mở: ${lastWin.title} (${lastWin.route})`
                        : `Quay lại nơi cuối cùng đã bấm vào: ${lastWin.title} (${lastWin.route})`
                    }
                  >
                    {isAtLastWin ? `Điểm cuối: ${lastWin.title}` : `Điểm cuối: ${lastWin.title} →`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFlyingToWin(null)}
                  title="Đóng thanh điều hướng nhanh"
                  aria-label="Đóng thanh điều hướng nhanh"
                  style={{ padding: '3px 7px' }}
                >
                  ×
                </button>
              </div>
            )
          })()}

        {/* ── Điều khiển Zoom & Căn giữa góc dưới ── */}
        <div className="pm-multi-controls" role="group" aria-label="Điều khiển zoom">
          <button
            onClick={() => setView((v) => ({ ...v, zoom: Math.max(0.12, v.zoom * 0.88) }))}
            title="Thu nhỏ (-)"
          >
            <ZoomOut size={13} />
          </button>
          <button
            className="pm-multi-controls__zoom"
            onClick={() => fitBounding(visibleWindows)}
            title="Căn vừa toàn bộ (Fit)"
          >
            {Math.round(view.zoom * 100)}%
          </button>
          <button
            onClick={() => setView((v) => ({ ...v, zoom: Math.min(2.0, v.zoom * 1.12) }))}
            title="Phóng to (+)"
          >
            <ZoomIn size={13} />
          </button>
          <span className="pm-multi-controls__divider" />
          <button onClick={() => fitBounding(visibleWindows)} title="Căn vừa toàn bộ (Fit)">
            <Maximize2 size={13} />
          </button>
          <button
            onClick={() => flyToWindow(homeWin, 1, { record: false, markEndpoint: false })}
            title="Về Trang chủ ở tỉ lệ 1:1"
            className="pm-multi-controls__ratio"
          >
            1:1
          </button>
        </div>

        {/* ── Hướng dẫn khi bật chế độ nối dây ── */}
        {isConnectMode && !connectDrag && (
          <div className="pm-multi-connect-banner">
            <Link2 size={13} />
            <span>
              Giữ chuột vào một nút bấm trong trang rồi kéo sang trang đích để nối dây · Esc để thoát
            </span>
          </div>
        )}

        {/* ── Vùng bắt sự kiện và dây tạm khi đang kéo ── */}
        {connectDrag && (
          <>
            <div
              className="pm-multi-connect-catcher"
              onPointerMove={handleConnectDragMove}
              onPointerUp={handleConnectDragEnd}
              onPointerCancel={() => setConnectDrag(null)}
            />

            <svg className="pm-multi-wire-drag" width="100%" height="100%">
              {(() => {
                const sx = connectDrag.srcClientX
                const sy = connectDrag.srcClientY
                const cx = connectDrag.clientX
                const cy = connectDrag.clientY
                const midY = (sy + cy) / 2
                const color = connectDrag.hoverTargetId ? '#22c55e' : '#6366f1'
                return (
                  <>
                    <path
                      d={`M ${sx} ${sy} C ${sx} ${midY}, ${cx} ${midY}, ${cx} ${cy}`}
                      fill="none"
                      stroke={color}
                      strokeWidth={2.5}
                      strokeDasharray="7 5"
                      strokeLinecap="round"
                      opacity={0.95}
                    />
                    <circle cx={sx} cy={sy} r={5} fill={color} stroke="#0b0f19" strokeWidth={2} />
                    <circle cx={cx} cy={cy} r={connectDrag.hoverTargetId ? 8 : 6} fill={color} stroke="#0b0f19" strokeWidth={2} />
                  </>
                )
              })()}
            </svg>
          </>
        )}

        {/* ── Thông báo nổi khi chạy hành động Prototype Toast ── */}
        {protoToast && (
          <div className="pm-multi-proto-toast" role="status">
            <Zap size={13} />
            <span>{protoToast}</span>
          </div>
        )}

        <div className="pm-multi-hint">
          <span>Chuột phải dây: Prototype</span>
          <span className="pm-multi-hint__sep">·</span>
          <span>Click dây để chọn</span>
          <span className="pm-multi-hint__sep">·</span>
          <span><kbd>Delete</kbd> xoá dây</span>
          <span className="pm-multi-hint__sep">·</span>
          <span><kbd>Ctrl</kbd>+<kbd>Z</kbd> hoàn tác</span>
        </div>
      </div>

      {/* ── Bảng Prototype theo dây nối (mở khi chuột phải trực tiếp lên dây hoặc ghim) ── */}
      {wireProtoTarget && (
        <aside className="pm-multi-proto pm-multi-proto--wire" aria-label="Prototype theo dây nối">
          <div className="pm-multi-proto__hd">
            <span className="pm-multi-proto__title">
              <Zap size={13} /> Prototype Dây
            </span>
            <label className="pm-multi-proto__run" title="Công tắc tổng chạy/dừng toàn bộ sự kiện">
              <input
                type="checkbox"
                checked={prototypeRunning}
                onChange={(e) => setPrototypeRunning(e.target.checked)}
              />
              <span>{prototypeRunning ? 'Đang chạy' : 'Tạm dừng'}</span>
            </label>
            <button
              className="pm-ibtn"
              onClick={() => setWireProtoTarget(null)}
              title="Đóng bảng Prototype (Esc)"
            >
              <X size={13} />
            </button>
          </div>

          <div className="pm-multi-proto__body">
            <div className="pm-multi-proto__wire-banner">
              <div className="pm-multi-proto__wire-route">
                <span>{wireProtoTarget.parentTitle}</span>
                <span className="pm-multi-proto__arrow">→</span>
                <b>{wireProtoTarget.targetTitle}</b>
              </div>
              <div className="pm-multi-proto__wire-source" title={wireProtoTarget.label}>
                Nguồn: <b>{wireProtoTarget.label}</b>
              </div>
            </div>

            <div className="pm-multi-proto__form">
              <div className="pm-multi-proto__row">
                <label className="pm-multi-proto__field">
                  <span>Sự kiện kích hoạt</span>
                  <select
                    value={draftTrigger}
                    onChange={(e) => setDraftTrigger(e.target.value as PrototypeTrigger)}
                  >
                    {PROTOTYPE_TRIGGERS.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="pm-multi-proto__field">
                  <span>Hành động</span>
                  <select
                    value={draftAction}
                    onChange={(e) => setDraftAction(e.target.value as PrototypeActionType)}
                  >
                    {PROTOTYPE_ACTIONS.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {draftTrigger === 'keypress' && (
                <label className="pm-multi-proto__field">
                  <span>Phím kích hoạt (VD: Enter, Escape, k)</span>
                  <input
                    type="text"
                    className="pm-multi-proto__input"
                    value={draftTriggerKey}
                    onChange={(e) => setDraftTriggerKey(e.target.value)}
                    placeholder="Enter"
                  />
                </label>
              )}

              {draftAction === 'toast' && (
                <label className="pm-multi-proto__field">
                  <span>Nội dung thông báo xem trước</span>
                  <input
                    type="text"
                    className="pm-multi-proto__input"
                    value={draftToastText}
                    onChange={(e) => setDraftToastText(e.target.value)}
                    placeholder={`VD: Đã kích hoạt ${wireProtoTarget.label}`}
                  />
                </label>
              )}

              <label className="pm-multi-proto__field">
                <span>Cửa sổ đích</span>
                <select value={draftTargetId} onChange={(e) => setDraftTargetId(e.target.value)}>
                  {windows.map((win) => (
                    <option key={win.id} value={win.id}>
                      {win.title} ({win.route})
                    </option>
                  ))}
                </select>
              </label>

              <div className="pm-multi-proto__limits">
                <label className="pm-multi-proto__field" title="0 = chạy không giới hạn">
                  <span>Số lần (0=∞)</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className="pm-multi-proto__input"
                    value={draftMaxRuns}
                    onChange={(e) => setDraftMaxRuns(Math.max(0, Number(e.target.value) || 0))}
                  />
                </label>
                <label
                  className="pm-multi-proto__field"
                  title={
                    draftTrigger === 'timer'
                      ? 'Chu kỳ lặp lại tự động (giây)'
                      : 'Thời gian chờ tối thiểu giữa 2 lần chạy (giây)'
                  }
                >
                  <span>{draftTrigger === 'timer' ? 'Chu kỳ (s)' : 'Cách nhau (s)'}</span>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    className="pm-multi-proto__input"
                    value={draftIntervalSec}
                    onChange={(e) => setDraftIntervalSec(Math.max(0, Number(e.target.value) || 0))}
                  />
                </label>
                <label className="pm-multi-proto__field" title="Đợi bao nhiêu giây rồi mới chạy">
                  <span>Độ trễ (s)</span>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    className="pm-multi-proto__input"
                    value={draftDelaySec}
                    onChange={(e) => setDraftDelaySec(Math.max(0, Number(e.target.value) || 0))}
                  />
                </label>
              </div>

              <button className="pm-multi-proto__add" onClick={addWirePrototypeInteraction}>
                <Plus size={12} /> Gắn sự kiện vào dây này
              </button>
            </div>

            <div className="pm-multi-proto__section">
              <span className="pm-multi-proto__section-title">
                Trên dây này ({wireScopedInteractions.length})
              </span>
              <button
                className="pm-multi-proto__link"
                onClick={() => {
                  setWireProtoTarget(null)
                  setShowEventController(true)
                }}
                title="Mở bảng Kiểm soát toàn bộ sự kiện"
              >
                <SlidersHorizontal size={11} /> Kiểm soát sự kiện ({interactions.length})
              </button>
            </div>

            {wireScopedInteractions.length === 0 ? (
              <p className="pm-multi-proto__empty">
                Dây này chưa có sự kiện riêng. Chọn sự kiện, hành động và giới hạn chạy ở trên rồi
                bấm <b>Gắn sự kiện</b>.
              </p>
            ) : (
              <div className="pm-multi-proto__list">
                {wireScopedInteractions.map((interaction) => {
                  const used = runCounts[interaction.id] ?? 0
                  const limitLabel =
                    interaction.maxRuns > 0 ? `${used}/${interaction.maxRuns}` : `${used}/∞`
                  return (
                    <div
                      key={interaction.id}
                      className={`pm-multi-proto__item ${interaction.enabled ? '' : 'is-off'}`}
                    >
                      <div className="pm-multi-proto__item-hd">
                        <span className="pm-multi-proto__badge">{limitLabel}</span>
                        <div className="pm-multi-proto__item-actions">
                          <button
                            className="pm-multi-proto__mini-btn"
                            onClick={() => triggerPrototypeInteraction(interaction, true)}
                            title="Chạy thử ngay (bỏ qua giới hạn)"
                          >
                            <Play size={10} />
                          </button>
                          <button
                            className="pm-multi-proto__mini-btn"
                            onClick={() => resetRunCount(interaction.id)}
                            title="Đặt lại bộ đếm lần chạy"
                          >
                            <RotateCcw size={10} />
                          </button>
                          <button
                            className="pm-multi-proto__del"
                            onClick={() => removePrototypeInteraction(interaction.id)}
                            title="Xoá sự kiện này"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>

                      <div className="pm-multi-proto__row">
                        <select
                          className="pm-multi-proto__mini"
                          value={interaction.trigger}
                          onChange={(e) =>
                            updatePrototypeInteraction(interaction.id, {
                              trigger: e.target.value as PrototypeTrigger,
                            })
                          }
                        >
                          {PROTOTYPE_TRIGGERS.map((item) => (
                            <option key={item.key} value={item.key}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                        <span className="pm-multi-proto__arrow">→</span>
                        <select
                          className="pm-multi-proto__mini"
                          value={interaction.action}
                          onChange={(e) =>
                            updatePrototypeInteraction(interaction.id, {
                              action: e.target.value as PrototypeActionType,
                            })
                          }
                        >
                          {PROTOTYPE_ACTIONS.map((item) => (
                            <option key={item.key} value={item.key}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="pm-multi-proto__limits is-compact">
                        <label title="Giới hạn số lần chạy (0 = vô hạn)">
                          <span>Lần</span>
                          <input
                            type="number"
                            min={0}
                            className="pm-multi-proto__input"
                            value={interaction.maxRuns}
                            onChange={(e) =>
                              updatePrototypeInteraction(interaction.id, {
                                maxRuns: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                          />
                        </label>
                        <label title="Khoảng nghỉ / chu kỳ (giây)">
                          <span>Nghỉ(s)</span>
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            className="pm-multi-proto__input"
                            value={interaction.intervalSec}
                            onChange={(e) =>
                              updatePrototypeInteraction(interaction.id, {
                                intervalSec: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                          />
                        </label>
                        <label title="Độ trễ (giây)">
                          <span>Trễ(s)</span>
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            className="pm-multi-proto__input"
                            value={interaction.delaySec}
                            onChange={(e) =>
                              updatePrototypeInteraction(interaction.id, {
                                delaySec: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                          />
                        </label>
                        <label className="pm-multi-proto__check" title="Bật/tắt quy tắc này">
                          <input
                            type="checkbox"
                            checked={interaction.enabled}
                            onChange={(e) =>
                              updatePrototypeInteraction(interaction.id, {
                                enabled: e.target.checked,
                              })
                            }
                          />
                          <span>Bật</span>
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ── Bảng Kiểm soát sự kiện: bật/tắt, số lần chạy, khoảng nghỉ & nhật ký ── */}
      {showEventController && (
        <aside className="pm-multi-proto pm-multi-proto--ctrl" aria-label="Kiểm soát sự kiện">
          <div className="pm-multi-proto__hd">
            <span className="pm-multi-proto__title">
              <SlidersHorizontal size={13} /> Kiểm soát sự kiện
            </span>
            <button
              className={`pm-multi-proto__master-btn ${prototypeRunning ? 'is-running' : ''}`}
              onClick={() => setPrototypeRunning((v) => !v)}
              title={prototypeRunning ? 'Tạm dừng toàn bộ sự kiện' : 'Tiếp tục chạy toàn bộ sự kiện'}
            >
              {prototypeRunning ? <Pause size={11} /> : <Play size={11} />}
              <span>{prototypeRunning ? 'Đang chạy' : 'Tạm dừng'}</span>
            </button>
            <button
              className="pm-ibtn"
              onClick={() => setShowEventController(false)}
              title="Đóng Kiểm soát sự kiện (Esc)"
            >
              <X size={13} />
            </button>
          </div>

          <div className="pm-multi-proto__body">
            {/* Thanh điều khiển tổng nhanh */}
            <div className="pm-multi-proto__toolbar">
              <button
                className="pm-multi-proto__toolbtn"
                onClick={resetAllRunCounts}
                title="Đặt lại bộ đếm số lần đã chạy về 0 cho toàn bộ quy tắc"
              >
                <RotateCcw size={11} /> Reset lượt
              </button>
              <button
                className="pm-multi-proto__toolbtn"
                onClick={() => toggleAllInteractions(true)}
                disabled={interactions.length === 0}
                title="Bật toàn bộ quy tắc"
              >
                Bật hết
              </button>
              <button
                className="pm-multi-proto__toolbtn"
                onClick={() => toggleAllInteractions(false)}
                disabled={interactions.length === 0}
                title="Tắt toàn bộ quy tắc"
              >
                Tắt hết
              </button>
              {hiddenWinIds.size > 0 && (
                <button
                  className="pm-multi-proto__toolbtn"
                  onClick={() => setHiddenWinIds(new Set())}
                  title="Hiện lại các cửa sổ bị ẩn bởi hành động Toggle"
                >
                  <Eye size={11} /> Hiện ({hiddenWinIds.size})
                </button>
              )}
            </div>

            {/* Áp dụng giới hạn hàng loạt */}
            {interactions.length > 0 && (
              <div className="pm-multi-proto__batch">
                <div className="pm-multi-proto__section-title">Áp dụng hàng loạt cho mọi quy tắc</div>
                <div className="pm-multi-proto__limits">
                  <label className="pm-multi-proto__field" title="0 = không giới hạn">
                    <span>Tối đa (0=∞)</span>
                    <input
                      type="number"
                      min={0}
                      className="pm-multi-proto__input"
                      value={batchMaxRuns}
                      onChange={(e) => setBatchMaxRuns(Math.max(0, Number(e.target.value) || 0))}
                    />
                  </label>
                  <label className="pm-multi-proto__field" title="Khoảng nghỉ tối thiểu giữa các lần (giây)">
                    <span>Cách (s)</span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      className="pm-multi-proto__input"
                      value={batchIntervalSec}
                      onChange={(e) => setBatchIntervalSec(Math.max(0, Number(e.target.value) || 0))}
                    />
                  </label>
                  <label className="pm-multi-proto__field" title="Độ trễ trước khi chạy (giây)">
                    <span>Trễ (s)</span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      className="pm-multi-proto__input"
                      value={batchDelaySec}
                      onChange={(e) => setBatchDelaySec(Math.max(0, Number(e.target.value) || 0))}
                    />
                  </label>
                </div>
                <button className="pm-multi-proto__apply-btn" onClick={applyBatchLimits}>
                  Áp dụng &amp; Reset bộ đếm
                </button>
              </div>
            )}

            <div className="pm-multi-proto__section">
              <span className="pm-multi-proto__section-title">
                Danh sách quy tắc ({interactions.filter((i) => i.enabled).length}/{interactions.length})
              </span>
            </div>

            {interactions.length === 0 ? (
              <p className="pm-multi-proto__empty">
                Chưa có quy tắc nào. Hãy <b>chuột phải trực tiếp lên dây nối</b> (hoặc điểm ghim nút
                bấm) để tạo sự kiện Prototype rồi kiểm soát tại đây.
              </p>
            ) : (
              <div className="pm-multi-proto__list">
                {interactions.map((interaction) => {
                  const parent = windows.find((win) => win.id === interaction.parentId)
                  const target = windows.find((win) => win.id === interaction.targetId)
                  const label =
                    (interaction.source.text || '').trim() || interaction.anchorKey || 'Dây nối'
                  const used = runCounts[interaction.id] ?? 0
                  const exhausted = interaction.maxRuns > 0 && used >= interaction.maxRuns
                  const limitBadge =
                    interaction.maxRuns > 0
                      ? `${used}/${interaction.maxRuns}${exhausted ? ' · Xong' : ''}`
                      : `${used}/∞`

                  return (
                    <div
                      key={interaction.id}
                      className={`pm-multi-proto__item ${!interaction.enabled ? 'is-off' : ''} ${
                        exhausted ? 'is-exhausted' : ''
                      }`}
                    >
                      <div className="pm-multi-proto__item-hd">
                        <span
                          className="pm-multi-proto__item-name"
                          title={`${parent?.title ?? '?'} · ${label} → ${target?.title ?? '?'}`}
                        >
                          {parent?.title ?? '?'} · {label}
                        </span>
                        <div className="pm-multi-proto__item-actions">
                          <span className={`pm-multi-proto__badge ${exhausted ? 'is-done' : ''}`}>
                            {limitBadge}
                          </span>
                          <button
                            className="pm-multi-proto__mini-btn"
                            onClick={() => locateWireForInteraction(interaction)}
                            title="Tìm &amp; làm nổi bật dây dẫn trên Canvas"
                          >
                            <Crosshair size={10} />
                          </button>
                          <button
                            className="pm-multi-proto__mini-btn"
                            onClick={() => triggerPrototypeInteraction(interaction, true)}
                            title="Chạy thử ngay"
                          >
                            <Play size={10} />
                          </button>
                          <button
                            className="pm-multi-proto__mini-btn"
                            onClick={() => resetRunCount(interaction.id)}
                            title="Reset lượt chạy của quy tắc này"
                          >
                            <RotateCcw size={10} />
                          </button>
                          <button
                            className="pm-multi-proto__del"
                            onClick={() => removePrototypeInteraction(interaction.id)}
                            title="Xoá quy tắc này"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>

                      <div className="pm-multi-proto__row">
                        <select
                          className="pm-multi-proto__mini"
                          value={interaction.trigger}
                          onChange={(e) =>
                            updatePrototypeInteraction(interaction.id, {
                              trigger: e.target.value as PrototypeTrigger,
                            })
                          }
                          title="Sự kiện kích hoạt"
                        >
                          {PROTOTYPE_TRIGGERS.map((item) => (
                            <option key={item.key} value={item.key}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                        <span className="pm-multi-proto__arrow">→</span>
                        <select
                          className="pm-multi-proto__mini"
                          value={interaction.action}
                          onChange={(e) =>
                            updatePrototypeInteraction(interaction.id, {
                              action: e.target.value as PrototypeActionType,
                            })
                          }
                          title="Hành động"
                        >
                          {PROTOTYPE_ACTIONS.map((item) => (
                            <option key={item.key} value={item.key}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="pm-multi-proto__limits is-compact">
                        <label title="Giới hạn số lần chạy (0 = vĩnh viễn)">
                          <span>Lần</span>
                          <input
                            type="number"
                            min={0}
                            className="pm-multi-proto__input"
                            value={interaction.maxRuns}
                            onChange={(e) =>
                              updatePrototypeInteraction(interaction.id, {
                                maxRuns: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                          />
                        </label>
                        <label title="Mỗi lần chạy cách nhau bao nhiêu giây">
                          <span>Cách(s)</span>
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            className="pm-multi-proto__input"
                            value={interaction.intervalSec}
                            onChange={(e) =>
                              updatePrototypeInteraction(interaction.id, {
                                intervalSec: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                          />
                        </label>
                        <label title="Độ trễ trước khi chạy (giây)">
                          <span>Trễ(s)</span>
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            className="pm-multi-proto__input"
                            value={interaction.delaySec}
                            onChange={(e) =>
                              updatePrototypeInteraction(interaction.id, {
                                delaySec: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                          />
                        </label>
                        <label className="pm-multi-proto__check" title="Bật/tắt quy tắc này">
                          <input
                            type="checkbox"
                            checked={interaction.enabled}
                            onChange={(e) =>
                              updatePrototypeInteraction(interaction.id, {
                                enabled: e.target.checked,
                              })
                            }
                          />
                          <span>Bật</span>
                        </label>
                      </div>

                      {interaction.trigger === 'keypress' && (
                        <input
                          type="text"
                          className="pm-multi-proto__input pm-multi-proto__input--sm"
                          value={interaction.triggerKey || 'Enter'}
                          onChange={(e) =>
                            updatePrototypeInteraction(interaction.id, {
                              triggerKey: e.target.value,
                            })
                          }
                          placeholder="Phím kích hoạt (Enter, Space...)"
                        />
                      )}

                      {interaction.action === 'toast' && (
                        <input
                          type="text"
                          className="pm-multi-proto__input pm-multi-proto__input--sm"
                          value={interaction.toastText || ''}
                          onChange={(e) =>
                            updatePrototypeInteraction(interaction.id, {
                              toastText: e.target.value,
                            })
                          }
                          placeholder="Nội dung thông báo xem trước..."
                        />
                      )}

                      {!target && (
                        <p className="pm-multi-proto__warn">Cửa sổ đích không còn tồn tại.</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Nhật ký thực thi sự kiện */}
            <div className="pm-multi-proto__logs">
              <div className="pm-multi-proto__section">
                <span className="pm-multi-proto__section-title">
                  <Activity size={11} /> Nhật ký ({eventLogs.length})
                </span>
                {eventLogs.length > 0 && (
                  <button
                    className="pm-multi-proto__link"
                    onClick={() => setEventLogs([])}
                    title="Xoá nhật ký"
                  >
                    Xoá log
                  </button>
                )}
              </div>
              {eventLogs.length === 0 ? (
                <p className="pm-multi-proto__empty is-compact">
                  Chưa có sự kiện nào kích hoạt trong phiên này.
                </p>
              ) : (
                <div className="pm-multi-proto__log-list">
                  {eventLogs.slice(0, 8).map((log) => (
                    <div key={log.id} className={`pm-multi-proto__log-row is-${log.kind}`}>
                      <span className="pm-multi-proto__log-time">{log.time}</span>
                      <span className="pm-multi-proto__log-msg">{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {interactions.length > 0 && (
              <button className="pm-multi-proto__clear" onClick={clearPrototypeInteractions}>
                <Trash2 size={11} /> Xoá toàn bộ quy tắc
              </button>
            )}
          </div>
        </aside>
      )}
    </div>
  )
}
