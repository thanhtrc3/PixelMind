import { api } from '../lib/bridge'
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ArrowRight,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Camera,
  Check,
  Code2,
  Columns2,
  Copy,
  ExternalLink,
  Globe,
  Hand,
  Image as ImageIcon,
  Layers,
  Maximize2,
  MessageSquarePlus,
  Monitor,
  MonitorUp,
  MousePointer2,
  Play,
  RefreshCw,
  RotateCcw,
  Ruler,
  ScanSearch,
  Smartphone,
  Sparkles,
  SlidersHorizontal,
  Sliders,
  Compass,
  Box,
  Palette,
  Square,
  Tablet,
  Type,
  X,
  ZoomIn,
  ZoomOut,
  Underline as UnderlineIcon,
  Strikethrough as StrikethroughIcon,
} from 'lucide-react'
import type { ParsedError } from '../lib/errorParser'
import VisualErrorCard from './VisualErrorCard'

export type CanvasMode = 'reference' | 'live' | 'compare' | 'overlay' | 'diff'
export type ViewportKey = 'mobile' | 'tablet' | 'desktop' | 'wide'
export type ToolKey = 'select' | 'pan' | 'rect' | 'text' | 'comment' | 'measure'
export type HandleDirection = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

interface ResizingState {
  handle: HandleDirection
  startX: number
  startY: number
  startWidth: number
  startHeight: number
  startTop: number
  startLeft: number
}

const RESIZE_HANDLES: { key: HandleDirection; label: string }[] = [
  { key: 'nw', label: 'Góc trên-trái' },
  { key: 'n', label: 'Cạnh trên' },
  { key: 'ne', label: 'Góc trên-phải' },
  { key: 'e', label: 'Cạnh phải' },
  { key: 'se', label: 'Góc dưới-phải' },
  { key: 's', label: 'Cạnh dưới' },
  { key: 'sw', label: 'Góc dưới-trái' },
  { key: 'w', label: 'Cạnh trái' },
]

interface ViewportConfig {
  key: ViewportKey
  label: string
  icon: typeof Smartphone
  w: number
  h: number
}

const VIEWPORTS: ViewportConfig[] = [
  { key: 'mobile', label: 'Mobile', icon: Smartphone, w: 375, h: 812 },
  { key: 'tablet', label: 'Tablet', icon: Tablet, w: 768, h: 1024 },
  { key: 'desktop', label: 'Desktop', icon: Monitor, w: 1440, h: 900 },
  { key: 'wide', label: 'Rộng', icon: MonitorUp, w: 1920, h: 1080 },
]

interface ModeConfig {
  key: CanvasMode
  label: string
  icon: typeof Globe
  reqMock?: boolean
}

const MODES: ModeConfig[] = [
  { key: 'reference', label: 'Ảnh mẫu', icon: ImageIcon, reqMock: true },
  { key: 'live', label: 'Trực tiếp', icon: Globe },
  { key: 'compare', label: 'Song song', icon: Columns2, reqMock: true },
  { key: 'overlay', label: 'Chồng lớp', icon: Layers, reqMock: true },
  { key: 'diff', label: 'Khác biệt', icon: ScanSearch, reqMock: true },
]

interface ToolConfig {
  key: ToolKey
  label: string
  icon: typeof MousePointer2
  shortcut: string
}

const TOOLS: ToolConfig[] = [
  { key: 'select', label: 'Chọn (V)', icon: MousePointer2, shortcut: 'V' },
  { key: 'pan', label: 'Kéo (H)', icon: Hand, shortcut: 'H' },
  { key: 'rect', label: 'Khung (R)', icon: Square, shortcut: 'R' },
  { key: 'text', label: 'Văn bản (T)', icon: Type, shortcut: 'T' },
  { key: 'comment', label: 'Bình luận (C)', icon: MessageSquarePlus, shortcut: 'C' },
  { key: 'measure', label: 'Đo thước (M)', icon: Ruler, shortcut: 'M' },
]

export interface HoverElementInfo {
  tagName: string
  className: string
  rect: {
    top: number
    left: number
    width: number
    height: number
  }
}

export interface RealElementInfo {
  tagName: string
  id: string
  className: string
  isLeaf?: boolean
  childrenCount?: number
  rect: {
    top: number
    left: number
    width: number
    height: number
  }
  computedStyles: {
    display: string
    flexDirection: string
    alignItems: string
    justifyContent: string
    gap: string
    flexWrap: string
    color: string
    backgroundColor: string
    backgroundImage: string
    fontSize: string
    fontWeight: string
    fontFamily: string
    lineHeight: string
    letterSpacing: string
    textAlign: string
    textDecoration: string
    textTransform: string
    padding: string
    paddingTop: string
    paddingRight: string
    paddingBottom: string
    paddingLeft: string
    margin: string
    marginTop: string
    marginRight: string
    marginBottom: string
    marginLeft: string
    borderRadius: string
    borderWidth: string
    borderStyle: string
    borderColor: string
    boxShadow: string
    opacity: string
    top?: string
    left?: string
    width: string
    height: string
  }
  domPath: string
  textSnippet: string
}

interface CanvasAreaProps {
  url: string | null
  running: boolean
  projectName: string
  projectPath?: string
  error?: ParsedError | null
  installing?: boolean
  onRun?: () => void
  onStop?: () => void
  onOpenExternal?: (url: string) => void
  onInstall?: () => void
  onCreateIndexHtml?: () => void
  onAddDevScript?: () => void
}

const COLOR_SWATCHES = [
  '#ffffff',
  '#000000',
  '#94a3b8',
  '#6d5df5',
  '#38bdf8',
  '#10b981',
  '#ef4444',
  '#f59e0b',
]

const GRADIENT_PRESETS = [
  { name: 'Tím Cyber', val: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { name: 'Xanh Ngọc', val: 'linear-gradient(135deg, #0ba360 0%, #3cba92 100%)' },
  { name: 'Hoàng Hôn', val: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { name: 'Tối Sâu', val: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' },
]

const SHADOW_PRESETS = [
  { label: 'Không bóng', val: 'none' },
  { label: 'Nhẹ (Sm)', val: '0 1px 3px rgba(0,0,0,0.2)' },
  { label: 'Vừa (Md)', val: '0 4px 12px rgba(0,0,0,0.3)' },
  { label: 'Đậm (Lg)', val: '0 10px 25px rgba(0,0,0,0.4)' },
  { label: 'Glow Tím', val: '0 0 20px rgba(109, 93, 245, 0.5)' },
]

const CanvasArea = ({
  url,
  running,
  projectName,
  projectPath,
  error,
  installing = false,
  onRun,
  onStop: _onStop,
  onOpenExternal,
  onInstall,
  onCreateIndexHtml: _onCreateIndexHtml,
  onAddDevScript: _onAddDevScript,
}: CanvasAreaProps) => {
  const [mode, setMode] = useState<CanvasMode>('live')
  const [viewport, setViewport] = useState<ViewportKey>('desktop')
  const [tool, setTool] = useState<ToolKey>('select')
  const [zoom, setZoom] = useState(51)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const spacePressedRef = useRef(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeKey, setIframeKey] = useState(0)

  // ─── STATE SOI PHẦN TỬ THẬT (VISUAL INSPECTOR) ───
  const [isInspectMode, setIsInspectMode] = useState(false)
  const [hoverEl, setHoverEl] = useState<HoverElementInfo | null>(null)
  const [selectedEl, setSelectedEl] = useState<RealElementInfo | null>(null)
  const [resizingEl, setResizingEl] = useState<ResizingState | null>(null)
  const [inspectorWidth, setInspectorWidth] = useState(380)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const sidebarDragRef = useRef({ startX: 0, startWidth: 380 })

  // Phân hệ 2: Tabs & Two-Way Code Sync & Modified Styles
  const [inspectorTab, setInspectorTab] = useState<'design' | 'code'>('design')
  const [modifiedStyles, setModifiedStyles] = useState<Record<string, string>>({})
  const [isMovingEl, setIsMovingEl] = useState(false)
  const moveStartRef = useRef({ startX: 0, startY: 0, initialLeft: 0, initialTop: 0 })
  const [sourceLoc, setSourceLoc] = useState<{
    filePath: string
    fullPath: string
    lineNumber: number
    lineContent: string
  } | null>(null)
  const [isLocatingSource, setIsLocatingSource] = useState(false)
  const [isSyncingCode, setIsSyncingCode] = useState(false)

  // Lưu thuộc tính gốc ban đầu để phục vụ nút Khôi phục gốc
  const [originalStyles, setOriginalStyles] = useState<{
    text: string
    styles: Record<string, string>
  } | null>(null)

  // Toast thông báo nhỏ
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToastMsg(msg)
    toastTimerRef.current = setTimeout(() => {
      setToastMsg(null)
    }, 2800)
  }, [])

  const currentVp = VIEWPORTS.find((v) => v.key === viewport) ?? VIEWPORTS[2]

  // Zoom to Fit (F)
  const zoomToFit = useCallback(() => {
    if (!stageRef.current) return
    const stageW = stageRef.current.clientWidth - 80
    const stageH = stageRef.current.clientHeight - 80
    if (stageW <= 0 || stageH <= 0) return
    const scaleX = stageW / currentVp.w
    const scaleY = stageH / currentVp.h
    const fitScale = Math.min(scaleX, scaleY, 1)
    setZoom(Math.max(10, Math.min(100, Math.round(fitScale * 100))))
    setPan({ x: 0, y: 0 })
  }, [currentVp.w, currentVp.h])

  // Lắng nghe phím tắt bàn phím
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return
      }

      if (e.code === 'Space' && !e.repeat) {
        spacePressedRef.current = true
        if (stageRef.current) stageRef.current.style.cursor = 'grab'
      }

      const key = e.key.toUpperCase()
      if (key === 'V') setTool('select')
      else if (key === 'H') setTool('pan')
      else if (key === 'R') setTool('rect')
      else if (key === 'T') setTool('text')
      else if (key === 'C') setTool('comment')
      else if (key === 'M') setTool('measure')
      else if (key === 'F') zoomToFit()
      else if (key === 'I') {
        const next = !isInspectMode
        setIsInspectMode(next)
        if (!next) {
          setSelectedEl(null)
          setHoverEl(null)
        }
        showToast(next ? 'Đã BẬT Chế độ Soi phần tử (Visual Inspector)' : 'Đã TẮT Chế độ Soi phần tử')
      } else if (e.key === 'Escape') {
        if (selectedEl) {
          setSelectedEl(null)
        } else if (isInspectMode) {
          setIsInspectMode(false)
          setHoverEl(null)
          showToast('Đã TẮT Chế độ Soi phần tử')
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spacePressedRef.current = false
        if (stageRef.current) {
          stageRef.current.style.cursor = ''
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [isInspectMode, selectedEl, zoomToFit, showToast])

  // Xử lý zoom bằng bánh lăn chuột (Ctrl + Wheel)
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -5 : 5
      setZoom((z) => Math.max(10, Math.min(200, z + delta)))
    } else {
      setPan((p) => ({
        x: p.x - e.deltaX,
        y: p.y - e.deltaY,
      }))
    }
  }

  // Xử lý kéo Pan sân khấu
  const isPanActive = tool === 'pan' || spacePressedRef.current

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isPanActive || e.button === 1) {
      e.preventDefault()
      setIsPanning(true)
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      })
    }
  }

  const handleMouseUp = () => {
    if (isPanning) setIsPanning(false)
  }

  // ─── LẮNG NGHE POSTMESSAGE TỪ TRÌNH DUYỆT THẬT (IFRAME) ───
  useEffect(() => {
    const handleWindowMessage = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return

      if (e.data.type === 'PM_HOVER_ELEMENT') {
        if (isInspectMode && !selectedEl) {
          setHoverEl(e.data.payload)
        }
      } else if (e.data.type === 'PM_SELECT_ELEMENT') {
        if (isInspectMode && e.data.payload) {
          const payload = e.data.payload as RealElementInfo
          setSelectedEl(payload)
          setHoverEl(null)

          if (!e.data.isReset && !originalStyles) {
            setOriginalStyles({
              text: payload.textSnippet,
              styles: { ...payload.computedStyles },
            })
          }
        }
      }
    }

    window.addEventListener('message', handleWindowMessage)
    return () => window.removeEventListener('message', handleWindowMessage)
  }, [isInspectMode, selectedEl, originalStyles, showToast])

  // Đồng bộ trạng thái inspect mode xuống Electron main process và iframe
  useEffect(() => {
    api.inspect.setMode(isInspectMode).catch(() => {})

    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'PM_SET_INSPECT_MODE', enabled: isInspectMode },
        '*'
      )
    }
  }, [isInspectMode])

  // Reset modified styles khi chọn phần tử khác
  useEffect(() => {
    setModifiedStyles({})
  }, [selectedEl?.domPath])

  // ─── ÁP DỤNG THAY ĐỔI LIVE (STYLE / TEXT) ───
  const handleApplyLiveChange = useCallback(
    (styles?: Record<string, string>, textContent?: string) => {
      if (!selectedEl) return

      if (styles) {
        setModifiedStyles((prev) => ({ ...prev, ...styles }))
      }

      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: 'PM_APPLY_STYLE',
            payload: { styles, textContent },
          },
          '*'
        )
      }

      api.inspect.applyStyle({ styles, textContent }).catch(() => {})

      setSelectedEl((prev) => {
        if (!prev) return null
        return {
          ...prev,
          textSnippet: typeof textContent === 'string' ? textContent : prev.textSnippet,
          computedStyles: {
            ...prev.computedStyles,
            ...(styles || {}),
          },
        }
      })
    },
    [selectedEl]
  )

  // ─── KÉO CO GIÃN 8 ĐIỂM NEO PHẦN TỬ THẬT ───
  const handleStartElementResize = (e: React.MouseEvent, handle: HandleDirection) => {
    e.preventDefault()
    e.stopPropagation()
    if (!selectedEl) return

    setResizingEl({
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: selectedEl.rect.width,
      startHeight: selectedEl.rect.height,
      startTop: selectedEl.rect.top,
      startLeft: selectedEl.rect.left,
    })
  }

  useEffect(() => {
    if (!resizingEl) return

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      const scale = zoom / 100
      const dx = (e.clientX - resizingEl.startX) / scale
      const dy = (e.clientY - resizingEl.startY) / scale

      let newWidth = resizingEl.startWidth
      let newHeight = resizingEl.startHeight
      let newTop = resizingEl.startTop
      let newLeft = resizingEl.startLeft

      if (resizingEl.handle.includes('e')) newWidth = Math.max(10, resizingEl.startWidth + dx)
      if (resizingEl.handle.includes('s')) newHeight = Math.max(10, resizingEl.startHeight + dy)
      if (resizingEl.handle.includes('w')) {
        newWidth = Math.max(10, resizingEl.startWidth - dx)
        newLeft = resizingEl.startLeft + (resizingEl.startWidth - newWidth)
      }
      if (resizingEl.handle.includes('n')) {
        newHeight = Math.max(10, resizingEl.startHeight - dy)
        newTop = resizingEl.startTop + (resizingEl.startHeight - newHeight)
      }

      setSelectedEl((prev) => {
        if (!prev) return null
        return {
          ...prev,
          rect: {
            ...prev.rect,
            width: Math.round(newWidth),
            height: Math.round(newHeight),
            top: Math.round(newTop),
            left: Math.round(newLeft),
          },
          computedStyles: {
            ...prev.computedStyles,
            width: `${Math.round(newWidth)}px`,
            height: `${Math.round(newHeight)}px`,
          },
        }
      })

      handleApplyLiveChange({
        width: `${Math.round(newWidth)}px`,
        height: `${Math.round(newHeight)}px`,
      })
    }

    const handleMouseUp = () => {
      setResizingEl(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingEl, zoom, handleApplyLiveChange])

  // ─── KÉO DI CHUYỂN VỊ TRÍ PHẦN TỬ THẬT (LIVE MOVE) ───
  const handleStartElementMove = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!selectedEl) return

    setIsMovingEl(true)
    const curLeft = parseInt(selectedEl.computedStyles.left || '0') || 0
    const curTop = parseInt(selectedEl.computedStyles.top || '0') || 0

    moveStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialLeft: curLeft,
      initialTop: curTop,
    }
  }

  useEffect(() => {
    if (!isMovingEl) return

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      const scale = zoom / 100
      const dx = (e.clientX - moveStartRef.current.startX) / scale
      const dy = (e.clientY - moveStartRef.current.startY) / scale

      const nextLeft = Math.round(moveStartRef.current.initialLeft + dx)
      const nextTop = Math.round(moveStartRef.current.initialTop + dy)

      handleApplyLiveChange({
        left: `${nextLeft}px`,
        top: `${nextTop}px`,
      })
    }

    const handleMouseUp = () => {
      setIsMovingEl(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isMovingEl, zoom, handleApplyLiveChange])

  // ─── TỰ ĐỘNG DÒ TÌM TỆP MÃ NGUỒN CHỨA PHẦN TỬ (CODE LOCATOR) ───
  useEffect(() => {
    if (!selectedEl || !projectPath) {
      setSourceLoc(null)
      return
    }

    let isMounted = true
    setIsLocatingSource(true)

    if (api?.inspect?.locateSource) {
      api.inspect
        .locateSource({
          projectPath,
          textSnippet: selectedEl.textSnippet,
          tagName: selectedEl.tagName,
          className: selectedEl.className,
        })
        .then((loc) => {
          if (isMounted) {
            setSourceLoc(loc as any)
            setIsLocatingSource(false)
          }
        })
        .catch(() => {
          if (isMounted) setIsLocatingSource(false)
        })
    }

    return () => {
      isMounted = false
    }
  }, [selectedEl?.domPath, selectedEl?.textSnippet, projectPath])

  // ─── GHI THAY ĐỔI VÀO MÃ NGUỒN THẬT TRÊN Ổ ĐĨA ───
  const handleSyncCodeToFile = async () => {
    if (!sourceLoc) {
      showToast('Chưa tìm thấy tệp mã nguồn tương ứng!')
      return
    }

    setIsSyncingCode(true)
    try {
      const res = await api.inspect.syncCode({
        fullPath: sourceLoc.fullPath,
        oldText: originalStyles?.text || selectedEl?.textSnippet,
        newText: selectedEl?.textSnippet,
        styles: modifiedStyles,
        tagName: selectedEl?.tagName,
        lineNumber: sourceLoc.lineNumber,
      })

      if (res?.success) {
        showToast(`Đã lưu vĩnh viễn vào ${sourceLoc.filePath}!`)
        setModifiedStyles({})
      } else {
        showToast(`Lỗi khi lưu tệp: ${res?.error || 'Không xác định'}`)
      }
    } catch {
      showToast('Không thể lưu vào tệp mã nguồn!')
    } finally {
      setIsSyncingCode(false)
    }
  }

  // ─── KÉO CO GIÃN ĐỘ RỘNG SIDE PANEL CẠNH PHẢI ───
  const handleSidebarResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizingSidebar(true)
    sidebarDragRef.current = {
      startX: e.clientX,
      startWidth: inspectorWidth,
    }
  }

  useEffect(() => {
    if (!isResizingSidebar) return

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      const dx = sidebarDragRef.current.startX - e.clientX
      const nextW = Math.max(280, Math.min(680, sidebarDragRef.current.startWidth + dx))
      setInspectorWidth(nextW)
    }

    const handleMouseUp = () => {
      setIsResizingSidebar(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizingSidebar])

  // Khôi phục thuộc tính gốc
  const handleResetOriginal = useCallback(() => {
    if (!selectedEl) return

    setModifiedStyles({})

    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'PM_RESET_ORIGINAL',
        },
        '*'
      )
    }

    api.inspect.resetOriginal().catch(() => {})

    if (originalStyles) {
      setSelectedEl((prev) => {
        if (!prev) return null
        return {
          ...prev,
          textSnippet: originalStyles.text,
          computedStyles: {
            ...prev.computedStyles,
            ...originalStyles.styles,
          },
        }
      })
      showToast('Đã khôi phục thuộc tính gốc của phần tử')
    }
  }, [selectedEl, originalStyles, showToast])

  // Sao chép CSS Selector
  const handleCopySelector = () => {
    if (!selectedEl) return
    let selector = selectedEl.tagName
    if (selectedEl.id) {
      selector += `#${selectedEl.id}`
    } else if (selectedEl.className) {
      const cls = selectedEl.className.split(/\s+/).filter(Boolean).slice(0, 3).join('.')
      if (cls) selector += `.${cls}`
    }
    navigator.clipboard.writeText(selector)
    showToast(`Đã sao chép CSS Selector: ${selector}`)
  }

  // Sao chép toàn bộ classes
  const handleCopyClasses = () => {
    if (!selectedEl?.className) return
    navigator.clipboard.writeText(selectedEl.className)
    showToast('Đã sao chép danh sách class!')
  }

  // Chuyển chế độ xem
  const handleSelectMode = (nextMode: CanvasMode) => {
    const target = MODES.find((m) => m.key === nextMode)
    if (target?.reqMock) {
      showToast(`Chế độ "${target.label}" cần ảnh mẫu thiết kế (PNG, JPG, Figma). Đang hoàn thiện ở Phân hệ 6!`)
      return
    }
    setMode(nextMode)
  }

  // Tính toán dòng Diff Preview cho Tab Mã nguồn thật
  const diffPreview = (() => {
    if (!sourceLoc) return null
    const origLine = sourceLoc.lineContent
    let newLine = origLine

    if (selectedEl && originalStyles && selectedEl.textSnippet !== originalStyles.text) {
      newLine = newLine.replace(originalStyles.text, selectedEl.textSnippet)
    }

    const entries = Object.entries(modifiedStyles).filter(([_, v]) => Boolean(v))
    if (entries.length > 0 && selectedEl) {
      const isJsx = sourceLoc.fullPath.endsWith('.tsx') || sourceLoc.fullPath.endsWith('.jsx')
      if (isJsx) {
        const jsxStyle = entries.map(([k, v]) => `${k}: '${v}'`).join(', ')
        if (/style=\{\{.*?\}\}/.test(newLine)) {
          newLine = newLine.replace(/style=\{\{.*?\}\}/, `style={{ ${jsxStyle} }}`)
        } else {
          const tagRegex = new RegExp(`(<${selectedEl.tagName})([\\s>])`)
          if (tagRegex.test(newLine)) {
            newLine = newLine.replace(tagRegex, `$1 style={{ ${jsxStyle} }}$2`)
          }
        }
      } else {
        const toKebab = (s: string) => s.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase()
        const htmlStyle = entries.map(([k, v]) => `${toKebab(k)}: ${v};`).join(' ')
        if (/style=".*?"/.test(newLine)) {
          newLine = newLine.replace(/style=".*?"/, `style="${htmlStyle}"`)
        } else {
          const tagRegex = new RegExp(`(<${selectedEl.tagName})([\\s>])`)
          if (tagRegex.test(newLine)) {
            newLine = newLine.replace(tagRegex, `$1 style="${htmlStyle}"$2`)
          }
        }
      }
    }

    return { origLine, newLine }
  })()

  const modifiedCount = Object.keys(modifiedStyles).length + (selectedEl && originalStyles && selectedEl.textSnippet !== originalStyles.text ? 1 : 0)

  return (
    <div className="canvas">
      {/* Toast thông báo góc trên */}
      {toastMsg && (
        <div className="canvas__toast">
          <Sparkles size={13} style={{ color: 'var(--accent, #6d5df5)' }} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Lớp Drag Shield toàn màn hình */}
      {(resizingEl || isResizingSidebar || isMovingEl) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            cursor: isMovingEl ? 'move' : resizingEl ? `${resizingEl.handle}-resize` : 'col-resize',
          }}
        />
      )}

      {/* ═══════════════════════════════════════════════
          HÀNG 1: THANH CÔNG CỤ ĐỈNH CANVAS
          ═══════════════════════════════════════════════ */}
      <div className="canvas__tools">
        {/* Nút bật/tắt Soi phần tử nổi bật */}
        <button
          className={`canvas__seg-btn ${isInspectMode ? 'active accent' : ''}`}
          onClick={() => {
            const next = !isInspectMode
            setIsInspectMode(next)
            if (!next) {
              setSelectedEl(null)
              setHoverEl(null)
            }
            showToast(next ? 'Đã BẬT Chế độ Soi phần tử (Visual Inspector)' : 'Đã TẮT Chế độ Soi phần tử')
          }}
          title="Bật/Tắt chế độ Soi phần tử (Phím tắt: I)"
          style={{
            height: 28,
            padding: '0 12px',
            gap: 7,
            borderRadius: 6,
            fontWeight: 650,
            background: isInspectMode ? 'var(--accent, #6d5df5)' : 'var(--panel-2)',
            color: isInspectMode ? '#ffffff' : 'var(--text)',
            border: '1px solid var(--line)',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          <Code2 size={13} />
          <span>Soi phần tử {isInspectMode ? '(BẬT)' : ''}</span>
        </button>

        <div className="canvas__divider-v" />

        {/* Nhóm công cụ vẽ & tương tác */}
        <div className="canvas__seg">
          {TOOLS.map((t) => (
            <button
              key={t.key}
              className={`canvas__seg-btn icon-only ${tool === t.key ? 'active' : ''}`}
              onClick={() => setTool(t.key)}
              title={`${t.label} (${t.shortcut})`}
            >
              <t.icon size={13} />
            </button>
          ))}
        </div>

        <div className="canvas__divider-v" />

        <div className="canvas__seg">
          <button
            className="canvas__tool-btn"
            title="Chụp ảnh khung nhìn (P)"
            onClick={() => showToast('Tính năng chụp ảnh khung nhìn sẽ lưu PNG vào thư mục dự án')}
          >
            <Camera size={13} />
          </button>
          <button
            className="canvas__tool-btn"
            title="Tải lại trang web"
            onClick={() => setIframeKey((k) => k + 1)}
          >
            <RefreshCw size={13} />
          </button>
          {url && onOpenExternal && (
            <button
              className="canvas__tool-btn"
              title="Mở trên trình duyệt ngoài"
              onClick={() => onOpenExternal(url)}
            >
              <ExternalLink size={13} />
            </button>
          )}
        </div>

        <div className="canvas__tools-spacer" />

        {/* Nhóm điều khiển Zoom */}
        <div className="canvas__seg">
          <button
            className="canvas__tool-btn"
            title="Thu nhỏ (Ctrl -)"
            onClick={() => setZoom((z) => Math.max(10, z - 10))}
          >
            <ZoomOut size={13} />
          </button>
          <span className="canvas__zoom-badge" onClick={zoomToFit} title="Nhấp để vừa khung (F)">
            {zoom}%
          </span>
          <button
            className="canvas__tool-btn"
            title="Phóng to (Ctrl +)"
            onClick={() => setZoom((z) => Math.min(200, z + 10))}
          >
            <ZoomIn size={13} />
          </button>
          <button className="canvas__tool-btn" title="Vừa khung nhìn (F)" onClick={zoomToFit}>
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          HÀNG 2: CHẾ ĐỘ XEM & KÍCH THƯỚC THIẾT BỊ
          ═══════════════════════════════════════════════ */}
      <div className="canvas__modes">
        <div className="canvas__seg">
          {MODES.map((m) => (
            <button
              key={m.key}
              className={`canvas__seg-btn ${mode === m.key ? 'active' : ''}`}
              style={{ opacity: m.reqMock ? 0.65 : 1 }}
              onClick={() => handleSelectMode(m.key)}
              title={m.reqMock ? `${m.label} (Cần ảnh mẫu thiết kế)` : m.label}
            >
              <m.icon size={13} />
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        <div className="canvas__modes-spacer" />

        <div className="canvas__seg">
          {VIEWPORTS.map((v) => (
            <button
              key={v.key}
              className={`canvas__seg-btn ${viewport === v.key ? 'active' : ''}`}
              onClick={() => setViewport(v.key)}
              title={`${v.label} · ${v.w} × ${v.h}`}
            >
              <v.icon size={13} />
              <span>{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          THÂN CANVAS: BÊN TRÁI LÀ STAGE, BÊN PHẢI LÀ INSPECTOR SIDE PANEL
          ═══════════════════════════════════════════════ */}
      <div className="canvas__body">
        {/* SÂN KHẤU VÔ CỰC (Bên trái) */}
        <div
          className={`canvas__stage tool-${tool} ${isPanning ? 'is-panning' : ''}`}
          ref={stageRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={() => {
            if (!isPanActive) {
              setSelectedEl(null)
            }
          }}
        >
          {/* Layer biến đổi Pan & Zoom */}
          <div
            className="canvas__transform-layer"
            style={{
              transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom / 100})`,
            }}
          >
            {/* KHUNG ARTBOARD TRÔI NỔI */}
            <div
              className="canvas__frame-wrap"
              style={{ width: currentVp.w }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="canvas__frame-bar">
                <div className="canvas__frame-dots">
                  <span className="dot red" />
                  <span className="dot yellow" />
                  <span className="dot green" />
                </div>
                <span className="canvas__frame-url">
                  {url ? url.replace(/^https?:\/\//, '') : 'localhost:Chưa khởi động'}
                </span>
                <span className="canvas__frame-size">
                  {currentVp.w} × {currentVp.h}
                </span>
              </div>

              <div
                className="canvas__frame-content"
                style={{
                  height: currentVp.h,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {(isPanActive || isPanning) && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      zIndex: 50,
                      cursor: isPanning ? 'grabbing' : 'grab',
                    }}
                  />
                )}

                {/* Khung viền hover phần tử khi soi */}
                {isInspectMode && hoverEl && !selectedEl && (
                  <div
                    className="canvas__inspect-hover"
                    style={{
                      top: hoverEl.rect.top,
                      left: hoverEl.rect.left,
                      width: hoverEl.rect.width,
                      height: hoverEl.rect.height,
                    }}
                  >
                    <span className="canvas__inspect-hover-tag">
                      {hoverEl.tagName}
                      {hoverEl.className ? `.${hoverEl.className.split(/\s+/)[0]}` : ''} · {Math.round(hoverEl.rect.width)} × {Math.round(hoverEl.rect.height)}
                    </span>
                  </div>
                )}

                {/* Khung viền phần tử ĐÃ CHỌN (Selection Box) */}
                {isInspectMode && selectedEl && (
                  <div
                    className="canvas__inspect-selected"
                    style={{
                      top: selectedEl.rect.top,
                      left: selectedEl.rect.left,
                      width: selectedEl.rect.width,
                      height: selectedEl.rect.height,
                    }}
                  >
                    <div
                      className="canvas__inspect-move-bar"
                      onMouseDown={handleStartElementMove}
                      title="Bấm giữ và kéo để di chuyển vị trí phần tử trên trang"
                    >
                      <span>✥ Di chuyển</span>
                    </div>

                    <span className="canvas__inspect-selected-tag">
                      {selectedEl.tagName}
                      {selectedEl.id ? `#${selectedEl.id}` : ''}
                    </span>
                    <span className="canvas__inspect-selected-size">
                      {Math.round(selectedEl.rect.width)} × {Math.round(selectedEl.rect.height)}
                    </span>

                    {RESIZE_HANDLES.map((h) => (
                      <span
                        key={h.key}
                        className={`canvas__inspect-handle ${h.key}`}
                        onMouseDown={(e) => handleStartElementResize(e, h.key)}
                        title={`Kéo để thay đổi kích thước (${h.label})`}
                      />
                    ))}
                  </div>
                )}

                {error ? (
                  <div style={{ height: '100%', overflowY: 'auto' }}>
                    <VisualErrorCard
                      error={error}
                      installing={installing}
                      onInstall={onInstall}
                      onRetry={onRun}
                    />
                  </div>
                ) : running && url ? (
                  <iframe
                    ref={iframeRef}
                    key={iframeKey}
                    src={url}
                    className="canvas__iframe"
                    title={projectName}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 0,
                      display: 'block',
                      background: '#ffffff',
                      pointerEvents: isPanActive || isPanning ? 'none' : 'auto',
                    }}
                  />
                ) : (
                  <div className="canvas__frame-fallback">
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: 'var(--panel-2)',
                        display: 'grid',
                        placeItems: 'center',
                        marginBottom: 14,
                        color: 'var(--accent-text)',
                      }}
                    >
                      <Globe size={24} />
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 650, marginBottom: 6 }}>
                      Chưa có bản xem trước trực tiếp
                    </h3>
                    <p style={{ fontSize: 12.5, color: 'var(--text-3)', maxWidth: 380, marginBottom: 18 }}>
                      Khởi động máy chủ phát triển của <b>{projectName}</b> để xem giao diện web hoạt động thực tế ngay trên khung này.
                    </p>
                    {onRun && (
                      <button
                        className="btn primary"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 7,
                          padding: '8px 18px',
                          borderRadius: 8,
                          fontSize: 12.5,
                          fontWeight: 600,
                          background: 'var(--accent)',
                          color: '#fff',
                          border: 0,
                          cursor: 'pointer',
                        }}
                        onClick={onRun}
                      >
                        <Play size={12} fill="currentColor" /> Chạy dự án (F5)
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="canvas__hint">
            <span>▷ Soi phần tử (Phím I) · Kéo để pan (H hoặc Space) · Ctrl + lăn chuột để zoom · F để vừa khung</span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════
            INSPECTOR SIDE PANEL CỐ ĐỊNH Ở CẠNH PHẢI (CHỈ XUẤT HIỆN KHI BẬT SOI)
            ═══════════════════════════════════════════════ */}
        {isInspectMode && (
          <aside
            className="canvas__inspector-sidebar"
            style={{ width: inspectorWidth, position: 'relative' }}
            onWheel={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Thanh kéo co giãn độ rộng Side Panel */}
            <div
              className={`canvas__inspector-resizer ${isResizingSidebar ? 'is-resizing' : ''}`}
              onMouseDown={handleSidebarResizeStart}
              title="Kéo sang trái/phải để co giãn độ rộng bảng Soi"
            />

            {/* Header đỉnh của Side Panel */}
            <div className="canvas__inspector-hd">
              <div className="canvas__inspector-title-area">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <div className="canvas__inspector-badge-live">
                    <span className="pulse-dot" />
                    <span>Live DOM</span>
                  </div>
                  <span style={{ fontSize: 11, color: '#64748b' }}>•</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Visual Style Editor</span>
                </div>
                <div className="canvas__inspector-tag-title">
                  {selectedEl ? (
                    <>
                      <span>{selectedEl.tagName.toUpperCase()}</span>
                      {selectedEl.id && <code>#{selectedEl.id}</code>}
                    </>
                  ) : (
                    <span>Chế độ Soi phần tử</span>
                  )}
                </div>
              </div>

              {selectedEl && (
                <button
                  className="canvas__tool-btn"
                  title="Sao chép CSS Selector"
                  onClick={handleCopySelector}
                >
                  <Copy size={13} />
                </button>
              )}

              <button
                className="canvas__tool-btn"
                title="Tắt chế độ Soi phần tử (Esc hoặc I)"
                onClick={() => {
                  setIsInspectMode(false)
                  setSelectedEl(null)
                  setHoverEl(null)
                  showToast('Đã TẮT Chế độ Soi phần tử')
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* TAB BAR: CHUYỂN ĐỔI THIẾT KẾ & ĐỒNG BỘ MÃ NGUỒN THẬT */}
            <div className="canvas__inspector-tabs">
              <button
                className={`canvas__inspector-tab-btn ${inspectorTab === 'design' ? 'active' : ''}`}
                onClick={() => setInspectorTab('design')}
              >
                <Sliders size={12} />
                <span>Thiết kế & Kiểu dáng</span>
              </button>
              <button
                className={`canvas__inspector-tab-btn ${inspectorTab === 'code' ? 'active' : ''}`}
                onClick={() => setInspectorTab('code')}
              >
                <Code2 size={12} />
                <span>Mã nguồn thật {modifiedCount > 0 ? `(${modifiedCount})` : sourceLoc ? '●' : ''}</span>
              </button>
            </div>

            {selectedEl ? (
              <>
                <div
                  className="canvas__inspector-bd"
                  onWheel={(e) => e.stopPropagation()}
                >
                  {inspectorTab === 'design' ? (
                    <>
                      {/* Hero Card thông tin phần tử */}
                      <div className="canvas__inspector-hero">
                        <div className="canvas__inspector-hero-top">
                          <span className="canvas__inspector-hero-tag">
                            <Code2 size={15} style={{ color: 'var(--accent, #6d5df5)' }} />
                            &lt;{selectedEl.tagName}&gt;
                          </span>
                          <span style={{ fontSize: 11, color: '#a78bfa', fontFamily: 'monospace' }}>
                            {selectedEl.computedStyles.width} × {selectedEl.computedStyles.height}
                          </span>
                        </div>

                        {/* Phân cấp DOM Path */}
                        <div style={{ fontSize: 11, color: '#94a3b8', wordBreak: 'break-all', lineHeight: 1.4 }}>
                          <span style={{ color: '#64748b', marginRight: 4 }}>Path:</span>
                          {selectedEl.domPath || selectedEl.tagName}
                        </div>

                        {/* Class badges */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                          <span style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600 }}>
                            CLASSES ({selectedEl.className ? selectedEl.className.split(/\s+/).filter(Boolean).length : 0}):
                          </span>
                          {selectedEl.className && (
                            <button
                              className="canvas__tool-btn"
                              style={{ width: 18, height: 18, padding: 0 }}
                              title="Sao chép toàn bộ classes"
                              onClick={handleCopyClasses}
                            >
                              <Copy size={10} />
                            </button>
                          )}
                        </div>

                        {selectedEl.className ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {selectedEl.className.split(/\s+/).filter(Boolean).map((cls, idx) => (
                              <span
                                key={idx}
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  background: 'rgba(255, 255, 255, 0.06)',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  fontSize: 10.5,
                                  color: '#cbd5e1',
                                  fontFamily: 'monospace',
                                }}
                              >
                                .{cls}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: 10.5, color: '#64748b', fontStyle: 'italic' }}>
                            Không có class CSS riêng
                          </span>
                        )}
                      </div>

                      {/* 1. NỘI DUNG VĂN BẢN TRỰC TIẾP */}
                      {selectedEl.isLeaf || !selectedEl.childrenCount ? (
                        <div className="canvas__inspector-card">
                          <div className="canvas__inspector-card-hd">
                            <Type size={13} style={{ color: '#38bdf8' }} />
                            <span>Nội dung chữ (Text Content)</span>
                          </div>
                          <div className="canvas__inspector-field">
                            <input
                              type="text"
                              className="canvas__inspector-field-input"
                              value={selectedEl.textSnippet}
                              onChange={(e) => handleApplyLiveChange(undefined, e.target.value)}
                              placeholder="Nhập nội dung chữ để đổi trực tiếp..."
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="canvas__inspector-card" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                          <div className="canvas__inspector-card-hd">
                            <Layers size={13} style={{ color: '#94a3b8' }} />
                            <span>Khối bao bọc ({selectedEl.childrenCount} phần tử con)</span>
                          </div>
                          <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, lineHeight: 1.45 }}>
                            Đây là thẻ cha (Container chứa nhiều thẻ con như chữ, nút bấm, ảnh). Hãy nhấp chuột vào phần tử con cụ thể để chỉnh sửa chữ.
                          </p>
                        </div>
                      )}

                      {/* 2. BỐ CỤC (LAYOUT: FLEXBOX / GRID / BLOCK) */}
                      <div className="canvas__inspector-card">
                        <div className="canvas__inspector-card-hd">
                          <Layers size={13} style={{ color: '#a78bfa' }} />
                          <span>Bố cục (Display Layout)</span>
                        </div>

                        <div className="canvas__btn-group">
                          {['block', 'flex', 'grid', 'inline-block', 'inline'].map((d) => (
                            <button
                              key={d}
                              className={`canvas__btn-group-item ${selectedEl.computedStyles.display === d ? 'active' : ''}`}
                              onClick={() => handleApplyLiveChange({ display: d })}
                            >
                              {d}
                            </button>
                          ))}
                        </div>

                        {(selectedEl.computedStyles.display === 'flex' || selectedEl.computedStyles.display === 'grid') && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                            {/* Flex Direction */}
                            <div>
                              <span className="canvas__inspector-field-lbl">Hướng sắp xếp (Direction)</span>
                              <div className="canvas__btn-group">
                                {[
                                  { label: 'Ngang ➔', val: 'row', icon: ArrowRight },
                                  { label: 'Dọc ⬇', val: 'column', icon: ArrowDown },
                                  { label: 'Đảo ⬅', val: 'row-reverse', icon: ArrowLeft },
                                  { label: 'Đảo ⬆', val: 'column-reverse', icon: ArrowUp },
                                ].map((item) => (
                                  <button
                                    key={item.val}
                                    className={`canvas__btn-group-item ${selectedEl.computedStyles.flexDirection === item.val ? 'active' : ''}`}
                                    onClick={() => handleApplyLiveChange({ flexDirection: item.val })}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Align Items */}
                            <div>
                              <span className="canvas__inspector-field-lbl">Căn trục phụ (Align Items)</span>
                              <div className="canvas__btn-group">
                                {[
                                  { label: 'Đầu', val: 'flex-start' },
                                  { label: 'Giữa', val: 'center' },
                                  { label: 'Cuối', val: 'flex-end' },
                                  { label: 'Giãn', val: 'stretch' },
                                ].map((item) => (
                                  <button
                                    key={item.val}
                                    className={`canvas__btn-group-item ${selectedEl.computedStyles.alignItems === item.val ? 'active' : ''}`}
                                    onClick={() => handleApplyLiveChange({ alignItems: item.val })}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Justify Content */}
                            <div>
                              <span className="canvas__inspector-field-lbl">Căn trục chính (Justify Content)</span>
                              <div className="canvas__btn-group">
                                {[
                                  { label: 'Đầu', val: 'flex-start' },
                                  { label: 'Giữa', val: 'center' },
                                  { label: 'Cuối', val: 'flex-end' },
                                  { label: 'Khoảng cách', val: 'space-between' },
                                ].map((item) => (
                                  <button
                                    key={item.val}
                                    className={`canvas__btn-group-item ${selectedEl.computedStyles.justifyContent === item.val ? 'active' : ''}`}
                                    onClick={() => handleApplyLiveChange({ justifyContent: item.val })}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Gap */}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span className="canvas__inspector-field-lbl">Khoảng cách giữa các phần tử (Gap)</span>
                                <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#38bdf8' }}>
                                  {selectedEl.computedStyles.gap || '0px'}
                                </span>
                              </div>
                              <div className="canvas__slider-row">
                                <input
                                  type="range"
                                  min="0"
                                  max="48"
                                  value={parseInt(selectedEl.computedStyles.gap) || 0}
                                  onChange={(e) => handleApplyLiveChange({ gap: `${e.target.value}px` })}
                                />
                                <span className="canvas__slider-val">{selectedEl.computedStyles.gap || '0px'}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 3. KHOẢNG CÁCH TRỰC QUAN WEBFLOW BOX MODEL */}
                      <div className="canvas__inspector-card">
                        <div className="canvas__inspector-card-hd">
                          <Box size={13} style={{ color: '#f59e0b' }} />
                          <span>Khoảng cách Box Model (Margin & Padding)</span>
                        </div>

                        {/* Mô hình lồng hộp Webflow */}
                        <div className="canvas__box-model">
                          <div className="canvas__box-model-margin">
                            <span className="canvas__box-model-label">Margin ({selectedEl.computedStyles.margin})</span>
                            <div className="canvas__box-model-padding">
                              <span className="canvas__box-model-label" style={{ color: '#10b981' }}>
                                Padding ({selectedEl.computedStyles.padding})
                              </span>
                              <div className="canvas__box-model-center">
                                {selectedEl.computedStyles.width} × {selectedEl.computedStyles.height}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Bộ điều khiển 4 cạnh Margin & Padding */}
                        <div className="canvas__inspector-grid">
                          <div className="canvas__inspector-prop-card">
                            <span className="canvas__inspector-prop-lbl">Padding (Trong)</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <button
                                className="canvas__tool-btn"
                                style={{ width: 20, height: 20 }}
                                onClick={() => {
                                  const cur = parseInt(selectedEl.computedStyles.paddingTop) || 0
                                  handleApplyLiveChange({ padding: `${Math.max(0, cur - 4)}px` })
                                }}
                              >
                                -
                              </button>
                              <span className="canvas__inspector-prop-val">{selectedEl.computedStyles.padding}</span>
                              <button
                                className="canvas__tool-btn"
                                style={{ width: 20, height: 20 }}
                                onClick={() => {
                                  const cur = parseInt(selectedEl.computedStyles.paddingTop) || 0
                                  handleApplyLiveChange({ padding: `${cur + 4}px` })
                                }}
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div className="canvas__inspector-prop-card">
                            <span className="canvas__inspector-prop-lbl">Margin (Ngoài)</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <button
                                className="canvas__tool-btn"
                                style={{ width: 20, height: 20 }}
                                onClick={() => {
                                  const cur = parseInt(selectedEl.computedStyles.marginTop) || 0
                                  handleApplyLiveChange({ margin: `${Math.max(0, cur - 4)}px` })
                                }}
                              >
                                -
                              </button>
                              <span className="canvas__inspector-prop-val">{selectedEl.computedStyles.margin}</span>
                              <button
                                className="canvas__tool-btn"
                                style={{ width: 20, height: 20 }}
                                onClick={() => {
                                  const cur = parseInt(selectedEl.computedStyles.marginTop) || 0
                                  handleApplyLiveChange({ margin: `${cur + 4}px` })
                                }}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 4. KÍCH THƯỚC & TỌA ĐỘ (DIMENSIONS) */}
                      <div className="canvas__inspector-card">
                        <div className="canvas__inspector-card-hd">
                          <Compass size={13} style={{ color: '#06b6d4' }} />
                          <span>Kích thước & Vị trí tọa độ</span>
                        </div>
                        <div className="canvas__inspector-grid">
                          <div className="canvas__inspector-prop-card">
                            <span className="canvas__inspector-prop-lbl">Chiều rộng (Width)</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <button
                                className="canvas__tool-btn"
                                style={{ width: 20, height: 20 }}
                                onClick={() => {
                                  const cur = parseInt(selectedEl.computedStyles.width) || 50
                                  handleApplyLiveChange({ width: `${Math.max(10, cur - 10)}px` })
                                }}
                              >
                                -
                              </button>
                              <span className="canvas__inspector-prop-val">{selectedEl.computedStyles.width}</span>
                              <button
                                className="canvas__tool-btn"
                                style={{ width: 20, height: 20 }}
                                onClick={() => {
                                  const cur = parseInt(selectedEl.computedStyles.width) || 50
                                  handleApplyLiveChange({ width: `${cur + 10}px` })
                                }}
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div className="canvas__inspector-prop-card">
                            <span className="canvas__inspector-prop-lbl">Chiều cao (Height)</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <button
                                className="canvas__tool-btn"
                                style={{ width: 20, height: 20 }}
                                onClick={() => {
                                  const cur = parseInt(selectedEl.computedStyles.height) || 30
                                  handleApplyLiveChange({ height: `${Math.max(10, cur - 10)}px` })
                                }}
                              >
                                -
                              </button>
                              <span className="canvas__inspector-prop-val">{selectedEl.computedStyles.height}</span>
                              <button
                                className="canvas__tool-btn"
                                style={{ width: 20, height: 20 }}
                                onClick={() => {
                                  const cur = parseInt(selectedEl.computedStyles.height) || 30
                                  handleApplyLiveChange({ height: `${cur + 10}px` })
                                }}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="canvas__btn-group-item"
                            style={{ background: '#1c202d', borderRadius: 4, padding: '4px 8px' }}
                            onClick={() => handleApplyLiveChange({ width: 'auto' })}
                          >
                            Width: Auto
                          </button>
                          <button
                            className="canvas__btn-group-item"
                            style={{ background: '#1c202d', borderRadius: 4, padding: '4px 8px' }}
                            onClick={() => handleApplyLiveChange({ width: '100%' })}
                          >
                            Width: 100%
                          </button>
                          <button
                            className="canvas__btn-group-item"
                            style={{ background: '#1c202d', borderRadius: 4, padding: '4px 8px' }}
                            onClick={() => handleApplyLiveChange({ height: 'auto' })}
                          >
                            Height: Auto
                          </button>
                        </div>
                      </div>

                      {/* 5. PHÔNG CHỮ & KIỂU DÁNG (TYPOGRAPHY) */}
                      <div className="canvas__inspector-card">
                        <div className="canvas__inspector-card-hd">
                          <SlidersHorizontal size={13} style={{ color: '#10b981' }} />
                          <span>Phông chữ & Kiểu dáng (Typography)</span>
                        </div>

                        {/* Cỡ chữ */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span className="canvas__inspector-field-lbl">Cỡ chữ (Font size)</span>
                          <div className="canvas__inspector-stepper">
                            <button
                              onClick={() => {
                                const curr = parseInt(selectedEl.computedStyles.fontSize) || 16
                                handleApplyLiveChange({ fontSize: Math.max(10, curr - 2) + 'px' })
                              }}
                            >
                              -
                            </button>
                            <span className="canvas__inspector-stepper-val">
                              {selectedEl.computedStyles.fontSize}
                            </span>
                            <button
                              onClick={() => {
                                const curr = parseInt(selectedEl.computedStyles.fontSize) || 16
                                handleApplyLiveChange({ fontSize: Math.min(72, curr + 2) + 'px' })
                              }}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Độ đậm */}
                        <div className="canvas__inspector-field">
                          <span className="canvas__inspector-field-lbl">
                            Độ đậm (Font weight: {selectedEl.computedStyles.fontWeight})
                          </span>
                          <div className="canvas__btn-group">
                            {[
                              { label: 'Nhẹ', val: '300' },
                              { label: 'Thường', val: '400' },
                              { label: 'Vừa', val: '500' },
                              { label: 'Đậm', val: '600' },
                              { label: 'Rất đậm', val: '700' },
                            ].map((w) => (
                              <button
                                key={w.val}
                                className={`canvas__btn-group-item ${selectedEl.computedStyles.fontWeight === w.val ? 'active' : ''}`}
                                onClick={() => handleApplyLiveChange({ fontWeight: w.val })}
                              >
                                {w.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Căn lề chữ */}
                        <div className="canvas__inspector-field">
                          <span className="canvas__inspector-field-lbl">Căn lề chữ (Text Align)</span>
                          <div className="canvas__btn-group">
                            {[
                              { label: 'Trái', val: 'left', icon: AlignLeft },
                              { label: 'Giữa', val: 'center', icon: AlignCenter },
                              { label: 'Phải', val: 'right', icon: AlignRight },
                              { label: 'Đều', val: 'justify', icon: AlignJustify },
                            ].map((item) => (
                              <button
                                key={item.val}
                                className={`canvas__btn-group-item ${selectedEl.computedStyles.textAlign === item.val ? 'active' : ''}`}
                                onClick={() => handleApplyLiveChange({ textAlign: item.val })}
                                title={`Căn ${item.label}`}
                              >
                                <item.icon size={13} style={{ margin: '0 auto' }} />
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Trang trí & Viết hoa */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          <div>
                            <span className="canvas__inspector-field-lbl">Kiểu chữ</span>
                            <div className="canvas__btn-group">
                              <button
                                className={`canvas__btn-group-item ${selectedEl.computedStyles.textDecoration === 'none' ? 'active' : ''}`}
                                onClick={() => handleApplyLiveChange({ textDecoration: 'none' })}
                              >
                                None
                              </button>
                              <button
                                className={`canvas__btn-group-item ${selectedEl.computedStyles.textDecoration.includes('underline') ? 'active' : ''}`}
                                onClick={() => handleApplyLiveChange({ textDecoration: 'underline' })}
                              >
                                <UnderlineIcon size={12} style={{ margin: '0 auto' }} />
                              </button>
                              <button
                                className={`canvas__btn-group-item ${selectedEl.computedStyles.textDecoration.includes('line-through') ? 'active' : ''}`}
                                onClick={() => handleApplyLiveChange({ textDecoration: 'line-through' })}
                              >
                                <StrikethroughIcon size={12} style={{ margin: '0 auto' }} />
                              </button>
                            </div>
                          </div>

                          <div>
                            <span className="canvas__inspector-field-lbl">Chữ hoa/thường</span>
                            <div className="canvas__btn-group">
                              {[
                                { label: 'Aa', val: 'none' },
                                { label: 'AA', val: 'uppercase' },
                                { label: 'aa', val: 'lowercase' },
                              ].map((item) => (
                                <button
                                  key={item.val}
                                  className={`canvas__btn-group-item ${selectedEl.computedStyles.textTransform === item.val ? 'active' : ''}`}
                                  onClick={() => handleApplyLiveChange({ textTransform: item.val })}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Màu chữ */}
                        <div className="canvas__inspector-field" style={{ marginTop: 6 }}>
                          <span className="canvas__inspector-field-lbl">Màu chữ (Text Color)</span>
                          <div className="canvas__inspector-color-row">
                            <input
                              type="color"
                              value={selectedEl.computedStyles.color.startsWith('#') ? selectedEl.computedStyles.color : '#ffffff'}
                              onChange={(e) => handleApplyLiveChange({ color: e.target.value })}
                            />
                            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#ffffff' }}>
                              {selectedEl.computedStyles.color}
                            </span>
                          </div>
                          <div className="canvas__swatch-row">
                            {COLOR_SWATCHES.map((hex) => (
                              <button
                                key={hex}
                                className="canvas__swatch-btn"
                                style={{ background: hex }}
                                onClick={() => handleApplyLiveChange({ color: hex })}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* 6. MÀU NỀN & GRADIENT & ĐỘ MỜ */}
                      <div className="canvas__inspector-card">
                        <div className="canvas__inspector-card-hd">
                          <Palette size={13} style={{ color: '#ec4899' }} />
                          <span>Màu nền & Gradient & Hiệu ứng</span>
                        </div>

                        <div className="canvas__inspector-field">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span className="canvas__inspector-field-lbl">Màu nền (Background Color)</span>
                            <button
                              style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: 10, cursor: 'pointer' }}
                              onClick={() => handleApplyLiveChange({ backgroundColor: 'transparent', backgroundImage: 'none' })}
                            >
                              Trong suốt
                            </button>
                          </div>
                          <div className="canvas__inspector-color-row">
                            <input
                              type="color"
                              value={selectedEl.computedStyles.backgroundColor.startsWith('#') ? selectedEl.computedStyles.backgroundColor : '#1e293b'}
                              onChange={(e) => handleApplyLiveChange({ backgroundColor: e.target.value, backgroundImage: 'none' })}
                            />
                            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#ffffff' }}>
                              {selectedEl.computedStyles.backgroundColor || 'transparent'}
                            </span>
                          </div>
                          <div className="canvas__swatch-row">
                            {COLOR_SWATCHES.map((hex) => (
                              <button
                                key={hex}
                                className="canvas__swatch-btn"
                                style={{ background: hex }}
                                onClick={() => handleApplyLiveChange({ backgroundColor: hex, backgroundImage: 'none' })}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Preset Gradients */}
                        <div className="canvas__inspector-field">
                          <span className="canvas__inspector-field-lbl">Dải màu Gradient sẵn có</span>
                          <div className="canvas__gradient-row">
                            {GRADIENT_PRESETS.map((g) => (
                              <button
                                key={g.name}
                                className="canvas__gradient-btn"
                                style={{ background: g.val }}
                                onClick={() => handleApplyLiveChange({ backgroundImage: g.val })}
                              >
                                {g.name}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Độ trong suốt (Opacity) */}
                        <div className="canvas__inspector-field">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span className="canvas__inspector-field-lbl">Độ trong suốt (Opacity)</span>
                            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#38bdf8' }}>
                              {Math.round((parseFloat(selectedEl.computedStyles.opacity) || 1) * 100)}%
                            </span>
                          </div>
                          <div className="canvas__slider-row">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={Math.round((parseFloat(selectedEl.computedStyles.opacity) || 1) * 100)}
                              onChange={(e) => handleApplyLiveChange({ opacity: `${parseInt(e.target.value) / 100}` })}
                            />
                            <span className="canvas__slider-val">
                              {Math.round((parseFloat(selectedEl.computedStyles.opacity) || 1) * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 7. ĐƯỜNG VIỀN & BO GÓC (BORDERS & RADIUS) */}
                      <div className="canvas__inspector-card">
                        <div className="canvas__inspector-card-hd">
                          <Square size={13} style={{ color: '#eab308' }} />
                          <span>Đường viền & Bo góc (Borders & Radius)</span>
                        </div>

                        {/* Kiểu viền */}
                        <div className="canvas__inspector-field">
                          <span className="canvas__inspector-field-lbl">Kiểu viền (Border Style)</span>
                          <div className="canvas__btn-group">
                            {['none', 'solid', 'dashed', 'dotted'].map((s) => (
                              <button
                                key={s}
                                className={`canvas__btn-group-item ${selectedEl.computedStyles.borderStyle === s ? 'active' : ''}`}
                                onClick={() => handleApplyLiveChange({ borderStyle: s })}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>

                        {selectedEl.computedStyles.borderStyle !== 'none' && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
                            <div>
                              <span className="canvas__inspector-field-lbl">Độ dày viền</span>
                              <div className="canvas__inspector-stepper">
                                <button
                                  onClick={() => {
                                    const curr = parseInt(selectedEl.computedStyles.borderWidth) || 0
                                    handleApplyLiveChange({ borderWidth: Math.max(0, curr - 1) + 'px' })
                                  }}
                                >
                                  -
                                </button>
                                <span className="canvas__inspector-stepper-val">
                                  {selectedEl.computedStyles.borderWidth}
                                </span>
                                <button
                                  onClick={() => {
                                    const curr = parseInt(selectedEl.computedStyles.borderWidth) || 0
                                    handleApplyLiveChange({ borderWidth: Math.min(12, curr + 1) + 'px' })
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            <div>
                              <span className="canvas__inspector-field-lbl">Màu viền</span>
                              <div className="canvas__inspector-color-row">
                                <input
                                  type="color"
                                  value={selectedEl.computedStyles.borderColor.startsWith('#') ? selectedEl.computedStyles.borderColor : '#6d5df5'}
                                  onChange={(e) => handleApplyLiveChange({ borderColor: e.target.value })}
                                />
                                <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#ffffff' }}>
                                  {selectedEl.computedStyles.borderColor || '#6d5df5'}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Bo góc (Radius) */}
                        <div style={{ marginTop: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span className="canvas__inspector-field-lbl">Bo góc (Border radius)</span>
                            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#38bdf8' }}>
                              {selectedEl.computedStyles.borderRadius}
                            </span>
                          </div>
                          <div className="canvas__slider-row">
                            <input
                              type="range"
                              min="0"
                              max="50"
                              value={parseInt(selectedEl.computedStyles.borderRadius) || 0}
                              onChange={(e) => handleApplyLiveChange({ borderRadius: `${e.target.value}px` })}
                            />
                            <span className="canvas__slider-val">{selectedEl.computedStyles.borderRadius}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                            {['0px', '4px', '8px', '16px', '9999px'].map((r) => (
                              <button
                                key={r}
                                className="canvas__btn-group-item"
                                style={{ background: '#1c202d', borderRadius: 4, padding: '3px 6px', fontSize: 10 }}
                                onClick={() => handleApplyLiveChange({ borderRadius: r })}
                              >
                                {r === '9999px' ? 'Tròn' : r}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* 8. ĐỔ BÓNG (BOX SHADOW) */}
                      <div className="canvas__inspector-card">
                        <div className="canvas__inspector-card-hd">
                          <Sparkles size={13} style={{ color: '#a855f7' }} />
                          <span>Đổ bóng (Box Shadow)</span>
                        </div>
                        <div className="canvas__shadow-grid">
                          {SHADOW_PRESETS.map((sh) => (
                            <button
                              key={sh.label}
                              className={`canvas__shadow-card ${selectedEl.computedStyles.boxShadow === sh.val ? 'active' : ''}`}
                              onClick={() => handleApplyLiveChange({ boxShadow: sh.val })}
                            >
                              {sh.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    /* TAB 2: ĐỒNG BỘ MÃ NGUỒN THẬT (TWO-WAY CODE SYNC) */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div className="canvas__source-card">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8' }}>
                            Tệp mã nguồn tương ứng
                          </span>
                          {isLocatingSource && (
                            <span style={{ fontSize: 10, color: '#38bdf8' }}>Đang quét dự án...</span>
                          )}
                        </div>

                        {sourceLoc ? (
                          <>
                            <div className="canvas__source-badge">
                              📄 {sourceLoc.filePath} : dòng {sourceLoc.lineNumber}
                            </div>

                            {/* Badge số thay đổi đang chờ lưu */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span className="canvas__diff-badge">
                                ⚡ {modifiedCount} thay đổi đang chờ lưu
                              </span>
                            </div>

                            {/* DIFF VIEW (BEFORE & AFTER) */}
                            {diffPreview && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600 }}>
                                  SO SÁNH MÃ NGUỒN (DIFF VIEW):
                                </span>
                                <div className="canvas__diff-container">
                                  <div className="canvas__diff-line old">
                                    <span className="canvas__diff-prefix">-</span>
                                    <span>{diffPreview.origLine}</span>
                                  </div>
                                  <div className="canvas__diff-line new">
                                    <span className="canvas__diff-prefix">+</span>
                                    <span>{diffPreview.newLine}</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            <button
                              className="btn primary"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 7,
                                height: 36,
                                fontSize: 12.5,
                                fontWeight: 700,
                                borderRadius: 6,
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                color: '#fff',
                                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                                border: 'none',
                                cursor: 'pointer',
                              }}
                              disabled={isSyncingCode}
                              onClick={handleSyncCodeToFile}
                            >
                              <Check size={14} />
                              {isSyncingCode ? 'Đang lưu vào tệp...' : '💾 Lưu thay đổi vào mã nguồn thật'}
                            </button>
                          </>
                        ) : (
                          <div style={{ padding: '16px 8px', textAlign: 'center', color: '#94a3b8', fontSize: 11.5 }}>
                            {isLocatingSource
                              ? 'Hệ thống đang quét toàn bộ thư mục dự án để tìm tệp chứa phần tử này...'
                              : 'Chưa tự động xác định được tệp nguồn. Bạn có thể mở tệp trong cây tệp bên trái để chỉnh sửa.'}
                          </div>
                        )}
                      </div>

                      <div className="canvas__inspector-card">
                        <div className="canvas__inspector-card-hd">
                          <span>Cách hoạt động của Code Sync Engine</span>
                        </div>
                        <p style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                          Khi bạn bấm nút <b>Lưu thay đổi vào mã nguồn thật</b>, PixelMind sẽ ghi trực tiếp vào tệp mã nguồn (.cshtml, .tsx, .jsx, .html) trên máy tính. Vite Dev Server hoặc .NET Core sẽ lập tức nhận diện tệp thay đổi và tải lại trang web vĩnh viễn!
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Side Panel cố định ở đáy */}
                <div className="canvas__inspector-ft">
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn secondary"
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        height: 32,
                        fontSize: 11.5,
                        borderRadius: 6,
                      }}
                      onClick={handleResetOriginal}
                      title="Khôi phục thuộc tính và kích thước ban đầu"
                    >
                      <RotateCcw size={13} /> Khôi phục gốc
                    </button>

                    {sourceLoc && (
                      <button
                        className="btn primary"
                        style={{
                          flex: 1.2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          height: 32,
                          fontSize: 11.5,
                          fontWeight: 700,
                          borderRadius: 6,
                          background: '#10b981',
                          color: '#fff',
                        }}
                        disabled={isSyncingCode}
                        onClick={handleSyncCodeToFile}
                        title="Ghi trực tiếp thay đổi vào tệp mã nguồn trên ổ đĩa"
                      >
                        <Check size={13} /> Lưu vào code
                      </button>
                    )}
                  </div>

                  <button
                    className="btn primary"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 7,
                      height: 34,
                      fontSize: 12,
                      fontWeight: 650,
                      borderRadius: 6,
                      background: 'linear-gradient(135deg, #6d5df5, #8b5cf6)',
                      color: '#fff',
                      boxShadow: '0 4px 14px rgba(109, 93, 245, 0.35)',
                    }}
                    onClick={() => showToast('Phân hệ 5 (AI Component Modifier) đang được phát triển, sẽ ra mắt ở bước tiếp theo!')}
                  >
                    <Sparkles size={14} /> Nhờ AI sửa phần tử này
                  </button>
                </div>
              </>
            ) : (
              <div className="canvas__inspector-empty-wrap">
                <div className="canvas__inspector-empty-radar">
                  <MousePointer2 size={26} />
                </div>
                <h4>Chế độ Soi phần tử đang bật</h4>
                <p>
                  Rê chuột vào trang web bên trái và <b>nhấp vào bất kỳ thành phần nào</b> (nút bấm, tiêu đề, menu, thẻ) để mở bảng thông số và sửa trực tiếp.
                </p>

                <div className="canvas__inspector-shortcuts">
                  <div className="canvas__inspector-shortcut-item">
                    <span>Bật / Tắt chế độ soi</span>
                    <kbd>I</kbd>
                  </div>
                  <div className="canvas__inspector-shortcut-item">
                    <span>Di chuyển Canvas (Pan)</span>
                    <kbd>Space / H</kbd>
                  </div>
                  <div className="canvas__inspector-shortcut-item">
                    <span>Căn vừa khung nhìn</span>
                    <kbd>F</kbd>
                  </div>
                  <div className="canvas__inspector-shortcut-item">
                    <span>Thoát chế độ soi</span>
                    <kbd>Esc</kbd>
                  </div>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}

export default CanvasArea
