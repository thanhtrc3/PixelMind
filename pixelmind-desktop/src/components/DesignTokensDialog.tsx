import { useEffect, useState } from 'react'
import {
  Check,
  Copy,
  Eye,
  FileCode2,
  Laptop,
  Monitor,
  Palette,
  Plus,
  RotateCcw,
  Smartphone,
  Tablet,
  Trash2,
  Tv,
  Zap,
} from 'lucide-react'
import type {
  BreakpointToken,
  ColorToken,
  CustomCssVarToken,
  DesignTokens,
  RadiusToken,
  SpacingToken,
  TypographyToken,
} from '@shared/types'
import {
  DEFAULT_DESIGN_TOKENS,
  generateTailwindTokensConfig,
  generateVariablesCss,
  tokenToCssVarName,
} from '../lib/designTokens'
import { api } from '../lib/bridge'
import Modal from './Modal'

interface DesignTokensDialogProps {
  projectPath?: string
  projectName?: string
  onClose: () => void
  showToast: (msg: string) => void
  onTokensUpdated?: (tokens: DesignTokens) => void
}

type TokenTab = 'colors' | 'typography' | 'spacing' | 'radius' | 'breakpoints' | 'custom' | 'sync'
type ColorCategoryFilter = 'all' | 'brand' | 'background' | 'status' | 'neutral'
type CustomCategoryFilter = 'all' | 'layout' | 'effect' | 'z-index' | 'color' | 'other'

const COLOR_CATEGORIES: Array<{ key: ColorCategoryFilter; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'brand', label: 'Thương hiệu' },
  { key: 'background', label: 'Nền & Khung' },
  { key: 'status', label: 'Trạng thái' },
  { key: 'neutral', label: 'Chữ & Trung tính' },
]

const CUSTOM_CATEGORIES: Array<{ key: CustomCategoryFilter; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'layout', label: '📐 Layout & Khung' },
  { key: 'effect', label: '✨ Hiệu ứng (Shadow/Blur)' },
  { key: 'z-index', label: '📑 Lớp (Z-Index)' },
  { key: 'other', label: 'Khác' },
]

const renderDeviceIcon = (icon?: string) => {
  switch (icon) {
    case 'mobile':
      return <Smartphone size={16} style={{ color: '#38bdf8' }} />
    case 'tablet':
      return <Tablet size={16} style={{ color: '#a78bfa' }} />
    case 'desktop':
      return <Laptop size={16} style={{ color: '#34d399' }} />
    case 'wide':
      return <Tv size={16} style={{ color: '#f59e0b' }} />
    default:
      return <Monitor size={16} style={{ color: '#94a3b8' }} />
  }
}

const DesignTokensDialog = ({
  projectPath,
  projectName,
  onClose,
  showToast,
  onTokensUpdated,
}: DesignTokensDialogProps) => {
  const [tab, setTab] = useState<TokenTab>('colors')
  const [tokens, setTokens] = useState<DesignTokens>({ ...DEFAULT_DESIGN_TOKENS })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeCategory, setActiveCategory] = useState<ColorCategoryFilter>('all')
  const [activeCustomCategory, setActiveCustomCategory] = useState<CustomCategoryFilter>('all')
  const [syncTarget, setSyncTarget] = useState<'css' | 'tailwind'>('css')
  const [copied, setCopied] = useState(false)

  // Tải tokens hiện tại của dự án
  useEffect(() => {
    let isMounted = true
    if (!projectPath) {
      setLoading(false)
      return
    }

    api.tokens
      .get(projectPath)
      .then((data) => {
        if (isMounted) {
          setTokens({
            ...DEFAULT_DESIGN_TOKENS,
            ...(data || {}),
            breakpoints: data?.breakpoints?.length ? data.breakpoints : DEFAULT_DESIGN_TOKENS.breakpoints,
            customVars: data?.customVars?.length ? data.customVars : DEFAULT_DESIGN_TOKENS.customVars,
          })
          setLoading(false)
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [projectPath])

  // Lưu và đồng bộ tokens vào file mã nguồn thật
  const handleSaveAndSync = async (target: 'css' | 'tailwind' | 'both' = 'both') => {
    if (!projectPath) {
      showToast('Vui lòng mở dự án để đồng bộ!')
      return
    }

    setSaving(true)
    try {
      const res = await api.tokens.save({
        projectPath,
        tokens,
        syncTarget: target,
      })

      if (res?.success) {
        showToast(`✨ Đã đồng bộ Design Tokens vào ${res.filePath || 'dự án'}!`)
        onTokensUpdated?.(tokens)
        window.dispatchEvent(new CustomEvent('pm:tokens-updated', { detail: tokens }))
      } else {
        showToast(`Lỗi khi đồng bộ: ${res?.error || 'Không xác định'}`)
      }
    } catch {
      showToast('Không thể đồng bộ tokens vào dự án!')
    } finally {
      setSaving(false)
    }
  }

  // Khôi phục mặc định
  const handleResetDefault = () => {
    setTokens({
      ...DEFAULT_DESIGN_TOKENS,
      colors: [...DEFAULT_DESIGN_TOKENS.colors],
      typography: [...DEFAULT_DESIGN_TOKENS.typography],
      spacing: [...DEFAULT_DESIGN_TOKENS.spacing],
      radius: [...DEFAULT_DESIGN_TOKENS.radius],
      breakpoints: [...(DEFAULT_DESIGN_TOKENS.breakpoints || [])],
      customVars: [...(DEFAULT_DESIGN_TOKENS.customVars || [])],
    })
    showToast('Đã khôi phục bộ Design Tokens chuẩn')
  }

  // Sao chép mã xuất
  const handleCopyCode = async () => {
    const code = syncTarget === 'css' ? generateVariablesCss(tokens) : generateTailwindTokensConfig(tokens)
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      showToast('Đã sao chép mã cấu hình vào bộ nhớ tạm')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast('Không thể sao chép')
    }
  }

  // Chỉnh sửa màu
  const handleUpdateColor = (id: string, patch: Partial<ColorToken>) => {
    setTokens((prev) => ({
      ...prev,
      colors: prev.colors.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }))
  }

  // Thêm màu mới
  const handleAddColor = () => {
    const newId = `c_custom_${Date.now().toString(36).slice(-4)}`
    const newColor: ColorToken = {
      id: newId,
      name: 'Màu mới',
      value: '#8b5cf6',
      category: activeCategory === 'all' ? 'brand' : activeCategory,
    }
    setTokens((prev) => ({
      ...prev,
      colors: [...prev.colors, newColor],
    }))
  }

  // Xóa màu
  const handleDeleteColor = (id: string) => {
    setTokens((prev) => ({
      ...prev,
      colors: prev.colors.filter((c) => c.id !== id),
    }))
  }

  // Chỉnh sửa Typography
  const handleUpdateTypo = (id: string, patch: Partial<TypographyToken>) => {
    setTokens((prev) => ({
      ...prev,
      typography: prev.typography.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }))
  }

  // Chỉnh sửa Spacing
  const handleUpdateSpacing = (id: string, patch: Partial<SpacingToken>) => {
    setTokens((prev) => ({
      ...prev,
      spacing: prev.spacing.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }))
  }

  // Chỉnh sửa Radius
  const handleUpdateRadius = (id: string, patch: Partial<RadiusToken>) => {
    setTokens((prev) => ({
      ...prev,
      radius: prev.radius.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }))
  }

  // Chỉnh sửa Breakpoint
  const handleUpdateBreakpoint = (id: string, patch: Partial<BreakpointToken>) => {
    setTokens((prev) => ({
      ...prev,
      breakpoints: (prev.breakpoints || []).map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }))
  }

  const handleAddBreakpoint = () => {
    const newId = `bp_custom_${Date.now().toString(36).slice(-4)}`
    const newBp: BreakpointToken = {
      id: newId,
      name: 'Custom',
      minWidth: 900,
      icon: 'desktop',
      description: 'Mốc responsive tùy biến',
    }
    setTokens((prev) => ({
      ...prev,
      breakpoints: [...(prev.breakpoints || []), newBp].sort((a, b) => a.minWidth - b.minWidth),
    }))
  }

  const handleDeleteBreakpoint = (id: string) => {
    setTokens((prev) => ({
      ...prev,
      breakpoints: (prev.breakpoints || []).filter((b) => b.id !== id),
    }))
  }

  const handleTestViewport = (width: number) => {
    window.dispatchEvent(new CustomEvent('pm:set-viewport-width', { detail: width }))
    showToast(`Đã chuyển thử kích thước khung hình sang ${width}px`)
  }

  // Chỉnh sửa Custom CSS Variables
  const handleUpdateCustomVar = (id: string, patch: Partial<CustomCssVarToken>) => {
    setTokens((prev) => ({
      ...prev,
      customVars: (prev.customVars || []).map((v) => (v.id === id ? { ...v, ...patch } : v)),
    }))
  }

  const handleAddCustomVar = () => {
    const newId = `v_custom_${Date.now().toString(36).slice(-4)}`
    const newVar: CustomCssVarToken = {
      id: newId,
      name: `--custom-${Date.now().toString(36).slice(-3)}`,
      value: '16px',
      category: activeCustomCategory === 'all' ? 'layout' : activeCustomCategory,
      scope: ':root',
      description: 'Biến CSS tùy biến',
    }
    setTokens((prev) => ({
      ...prev,
      customVars: [...(prev.customVars || []), newVar],
    }))
  }

  const handleDeleteCustomVar = (id: string) => {
    setTokens((prev) => ({
      ...prev,
      customVars: (prev.customVars || []).filter((v) => v.id !== id),
    }))
  }

  const filteredColors =
    activeCategory === 'all' ? tokens.colors : tokens.colors.filter((c) => c.category === activeCategory)

  const filteredCustomVars = (tokens.customVars || []).filter(
    (v) => activeCustomCategory === 'all' || v.category === activeCustomCategory,
  )

  return (
    <Modal
      title="Hệ thống thiết kế (Design Tokens & Theme Manager)"
      subtitle={`Quản lý tập trung quy chuẩn màu sắc, phông chữ, khoảng cách, bo góc, breakpoint và biến CSS cho ${projectName || 'dự án'}`}
      icon={<Palette size={20} style={{ color: 'var(--accent, #6d5df5)' }} />}
      width={920}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8 }}>
          <button className="btn secondary" onClick={handleResetDefault} style={{ fontSize: 11.5 }}>
            <RotateCcw size={13} /> Khôi phục mặc định
          </button>
          <span style={{ flex: 1 }} />
          <button className="btn secondary" onClick={onClose} style={{ fontSize: 11.5 }}>
            Đóng
          </button>
          <button
            className="btn primary"
            onClick={() => handleSaveAndSync('both')}
            disabled={saving}
            style={{
              fontSize: 11.5,
              fontWeight: 650,
              background: 'linear-gradient(135deg, #6d5df5, #8b5cf6)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Zap size={13} />
            {saving ? 'Đang đồng bộ...' : 'Lưu & Đồng bộ vào dự án'}
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Thanh chuyển tab phân hệ Tokens */}
        <div className="canvas__seg" style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap', gap: 3 }}>
          {[
            { id: 'colors', label: '🎨 Màu sắc', count: tokens.colors.length },
            { id: 'typography', label: '🔤 Kiểu chữ', count: tokens.typography.length },
            { id: 'spacing', label: '📐 Khoảng cách', count: tokens.spacing.length },
            { id: 'radius', label: '🔲 Bo góc', count: tokens.radius.length },
            { id: 'breakpoints', label: '📱 Điểm ngắt', count: (tokens.breakpoints || []).length },
            { id: 'custom', label: '🏷️ Biến tùy biến', count: (tokens.customVars || []).length },
            { id: 'sync', label: '⚡ Xuất & Đồng bộ', count: null },
          ].map((item) => (
            <button
              key={item.id}
              className={`canvas__seg-btn ${tab === item.id ? 'active' : ''}`}
              style={{ flex: 1, minWidth: 96, padding: '7px 4px', fontSize: 10.5 }}
              onClick={() => setTab(item.id as TokenTab)}
            >
              <span>{item.label}</span>
              {item.count !== null && (
                <span
                  style={{
                    fontSize: 9.5,
                    padding: '1px 5px',
                    borderRadius: 8,
                    background: tab === item.id ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
                  }}
                >
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
            Đang tải dữ liệu Design Tokens...
          </div>
        ) : (
          <>
            {/* ══════════════════════════════════════════════════
                TAB 1: BẢNG MÀU CHUẨN (COLOR PALETTE)
                ══════════════════════════════════════════════════ */}
            {tab === 'colors' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Bộ lọc nhóm màu & Nút thêm màu */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div className="canvas__btn-group" style={{ flex: 1 }}>
                    {COLOR_CATEGORIES.map((cat) => (
                      <button
                        key={cat.key}
                        className={`canvas__btn-group-item ${activeCategory === cat.key ? 'active' : ''}`}
                        onClick={() => setActiveCategory(cat.key)}
                        style={{ fontSize: 10.5, padding: '4px 8px' }}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  <button
                    className="btn primary"
                    onClick={handleAddColor}
                    style={{ fontSize: 11, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Plus size={13} /> Thêm màu
                  </button>
                </div>

                {/* Danh sách thẻ màu lưới 2 cột */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                    gap: 8,
                    maxHeight: 420,
                    overflowY: 'auto',
                    paddingRight: 4,
                  }}
                >
                  {filteredColors.map((color) => {
                    const cssVar = tokenToCssVarName('color', color.id)
                    return (
                      <div
                        key={color.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 12px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid var(--line)',
                          borderRadius: 8,
                        }}
                      >
                        {/* Hộp xem màu trực tiếp & Native Color Picker */}
                        <div style={{ position: 'relative', width: 34, height: 34, flexShrink: 0 }}>
                          <input
                            type="color"
                            value={color.value.startsWith('#') ? color.value : '#6d5df5'}
                            onChange={(e) => handleUpdateColor(color.id, { value: e.target.value })}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              opacity: 0,
                              cursor: 'pointer',
                            }}
                          />
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              borderRadius: 6,
                              background: color.value,
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                              pointerEvents: 'none',
                            }}
                          />
                        </div>

                        {/* Tên và CSS Var Name */}
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <input
                            type="text"
                            value={color.name}
                            onChange={(e) => handleUpdateColor(color.id, { name: e.target.value })}
                            style={{
                              background: 'transparent',
                              border: 0,
                              borderBottom: '1px solid transparent',
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: 'var(--text-1)',
                              padding: '1px 0',
                            }}
                            onFocus={(e) => (e.target.style.borderBottomColor = 'var(--accent)')}
                            onBlur={(e) => (e.target.style.borderBottomColor = 'transparent')}
                          />
                          <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#38bdf8' }}>{cssVar}</span>
                        </div>

                        {/* Ô nhập mã màu Hex */}
                        <input
                          type="text"
                          value={color.value}
                          onChange={(e) => handleUpdateColor(color.id, { value: e.target.value })}
                          style={{
                            width: 78,
                            padding: '3px 6px',
                            borderRadius: 4,
                            background: '#0f172a',
                            border: '1px solid var(--line)',
                            color: '#ffffff',
                            fontFamily: 'monospace',
                            fontSize: 11,
                            textAlign: 'center',
                          }}
                        />

                        {/* Phân loại danh mục màu (Thương hiệu, Nền, Chữ & Viền, Trạng thái) */}
                        <select
                          value={color.category || 'brand'}
                          onChange={(e) => handleUpdateColor(color.id, { category: e.target.value as ColorToken['category'] })}
                          style={{
                            padding: '3px 6px',
                            borderRadius: 4,
                            background: '#0f172a',
                            border: '1px solid var(--line)',
                            color: '#cbd5e1',
                            fontSize: 10.5,
                            cursor: 'pointer',
                          }}
                          title="Phân loại nhóm cho màu này"
                        >
                          <option value="brand">Thương hiệu</option>
                          <option value="background">Nền & Khung</option>
                          <option value="neutral">Chữ & Viền</option>
                          <option value="status">Trạng thái</option>
                        </select>

                        {/* Nút xóa */}
                        <button
                          className="pm-ibtn"
                          onClick={() => handleDeleteColor(color.id)}
                          title="Xóa token màu này"
                          style={{ width: 22, height: 22, opacity: 0.6 }}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════
                TAB 2: TỶ LỆ PHÔNG CHỮ (TYPOGRAPHY SCALE)
                ══════════════════════════════════════════════════ */}
            {tab === 'typography' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 440, overflowY: 'auto' }}>
                {tokens.typography.map((typo) => {
                  const cssVar = tokenToCssVarName('font', typo.id)
                  return (
                    <div
                      key={typo.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 14px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ width: 140, flexShrink: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-1)' }}>{typo.name}</div>
                        <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#38bdf8' }}>{cssVar}</div>
                      </div>

                      {/* Thông số Size & LineHeight */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10.5, color: '#94a3b8' }}>Size:</span>
                        <input
                          type="text"
                          value={typo.fontSize}
                          onChange={(e) => handleUpdateTypo(typo.id, { fontSize: e.target.value })}
                          style={{
                            width: 58,
                            padding: '3px 6px',
                            borderRadius: 4,
                            background: '#0f172a',
                            border: '1px solid var(--line)',
                            color: '#ffffff',
                            fontFamily: 'monospace',
                            fontSize: 11,
                            textAlign: 'center',
                          }}
                        />
                        <span style={{ fontSize: 10.5, color: '#94a3b8' }}>Line:</span>
                        <input
                          type="text"
                          value={typo.lineHeight}
                          onChange={(e) => handleUpdateTypo(typo.id, { lineHeight: e.target.value })}
                          style={{
                            width: 58,
                            padding: '3px 6px',
                            borderRadius: 4,
                            background: '#0f172a',
                            border: '1px solid var(--line)',
                            color: '#ffffff',
                            fontFamily: 'monospace',
                            fontSize: 11,
                            textAlign: 'center',
                          }}
                        />
                      </div>

                      {/* Chữ mẫu trực quan hiển thị kích thước thực */}
                      <div
                        style={{
                          flex: 1,
                          fontSize: typo.fontSize,
                          lineHeight: typo.lineHeight,
                          fontWeight: typo.fontWeight || '400',
                          color: 'var(--text-1)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          paddingLeft: 12,
                          borderLeft: '1px solid var(--line)',
                        }}
                      >
                        PixelMind Design Typography
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ══════════════════════════════════════════════════
                TAB 3: KHOẢNG CÁCH (SPACING SCALE)
                ══════════════════════════════════════════════════ */}
            {tab === 'spacing' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 440, overflowY: 'auto' }}>
                {tokens.spacing.map((sp) => {
                  const cssVar = tokenToCssVarName('spacing', sp.id)
                  const pxVal = parseInt(sp.value) || 0
                  return (
                    <div
                      key={sp.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '8px 14px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ width: 120, flexShrink: 0 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 650 }}>{sp.name}</div>
                        <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#38bdf8' }}>{cssVar}</div>
                      </div>

                      {/* Ô nhập giá trị */}
                      <input
                        type="text"
                        value={sp.value}
                        onChange={(e) => handleUpdateSpacing(sp.id, { value: e.target.value })}
                        style={{
                          width: 64,
                          padding: '3px 6px',
                          borderRadius: 4,
                          background: '#0f172a',
                          border: '1px solid var(--line)',
                          color: '#ffffff',
                          fontFamily: 'monospace',
                          fontSize: 11,
                          textAlign: 'center',
                        }}
                      />

                      {/* Thanh đo pixel trực quan */}
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            height: 12,
                            width: Math.min(pxVal * 3, 300),
                            borderRadius: 3,
                            background: 'linear-gradient(90deg, #f59e0b, #ec4899)',
                          }}
                        />
                        <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'monospace' }}>
                          {sp.value}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ══════════════════════════════════════════════════
                TAB 4: BÁN KÍNH BO GÓC (BORDER RADIUS SCALE)
                ══════════════════════════════════════════════════ */}
            {tab === 'radius' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 440, overflowY: 'auto' }}>
                {tokens.radius.map((rad) => {
                  const cssVar = tokenToCssVarName('radius', rad.id)
                  return (
                    <div
                      key={rad.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 14px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ width: 140, flexShrink: 0 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 650 }}>{rad.name}</div>
                        <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#38bdf8' }}>{cssVar}</div>
                      </div>

                      {/* Ô nhập giá trị */}
                      <input
                        type="text"
                        value={rad.value}
                        onChange={(e) => handleUpdateRadius(rad.id, { value: e.target.value })}
                        style={{
                          width: 70,
                          padding: '3px 6px',
                          borderRadius: 4,
                          background: '#0f172a',
                          border: '1px solid var(--line)',
                          color: '#ffffff',
                          fontFamily: 'monospace',
                          fontSize: 11,
                          textAlign: 'center',
                        }}
                      />

                      {/* Hộp mẫu trực quan */}
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 80,
                            height: 32,
                            borderRadius: rad.value,
                            background: 'rgba(109, 93, 245, 0.25)',
                            border: '2px solid var(--accent, #6d5df5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 10,
                            fontWeight: 600,
                            color: '#a78bfa',
                          }}
                        >
                          Preview
                        </div>
                        <span style={{ fontSize: 10.5, color: '#94a3b8' }}>
                          Áp dụng cho nút bấm, card, modal, hình ảnh
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ══════════════════════════════════════════════════
                TAB 5: ĐIỂM NGẮT RESPONSIVE (BREAKPOINTS MANAGER)
                ══════════════════════════════════════════════════ */}
            {tab === 'breakpoints' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Thanh điều khiển & Thêm breakpoint */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                    Cấu hình các mốc kích thước màn hình responsive (sinh mã W3C Media Queries &amp; Tailwind Screens)
                  </div>
                  <button
                    className="btn primary"
                    onClick={handleAddBreakpoint}
                    style={{ fontSize: 11, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <Plus size={13} /> Thêm Breakpoint
                  </button>
                </div>

                {/* Thước đo trực quan dải màn hình Responsive */}
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8' }}>
                    <span>0px</span>
                    <span>640px (sm)</span>
                    <span>768px (md)</span>
                    <span>1024px (lg)</span>
                    <span>1280px (xl)</span>
                    <span>1536px+ (2xl)</span>
                  </div>
                  <div
                    style={{
                      height: 20,
                      borderRadius: 4,
                      background: 'rgba(255, 255, 255, 0.04)',
                      display: 'flex',
                      overflow: 'hidden',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    {(tokens.breakpoints || []).map((bp, idx) => {
                      const colors = ['#38bdf8', '#818cf8', '#a78bfa', '#34d399', '#f59e0b', '#ec4899']
                      const bg = colors[idx % colors.length]
                      return (
                        <div
                          key={bp.id}
                          style={{
                            flex: 1,
                            background: `linear-gradient(180deg, ${bg}44, ${bg}22)`,
                            borderRight: '1px solid rgba(255,255,255,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 9.5,
                            fontWeight: 700,
                            color: '#ffffff',
                            cursor: 'pointer',
                            userSelect: 'none',
                          }}
                          title={`Mốc ${bp.name}: từ ${bp.minWidth}px${bp.maxWidth ? ` đến ${bp.maxWidth}px` : ''} - Nhấp để xem thử`}
                          onClick={() => handleTestViewport(bp.minWidth)}
                        >
                          {bp.name.split(' ')[0]} ({bp.minWidth}px)
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Danh sách các thẻ Breakpoints */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
                    gap: 8,
                    maxHeight: 380,
                    overflowY: 'auto',
                    paddingRight: 4,
                  }}
                >
                  {(tokens.breakpoints || []).map((bp) => {
                    const cssVar = tokenToCssVarName('breakpoint', bp.id)
                    return (
                      <div
                        key={bp.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 12px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid var(--line)',
                          borderRadius: 8,
                        }}
                      >
                        {/* Icon thiết bị */}
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--line)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {renderDeviceIcon(bp.icon)}
                        </div>

                        {/* Tên & CSS Var */}
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <input
                            type="text"
                            value={bp.name}
                            onChange={(e) => handleUpdateBreakpoint(bp.id, { name: e.target.value })}
                            style={{
                              background: 'transparent',
                              border: 0,
                              borderBottom: '1px solid transparent',
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: 'var(--text-1)',
                              padding: '1px 0',
                            }}
                            onFocus={(e) => (e.target.style.borderBottomColor = 'var(--accent)')}
                            onBlur={(e) => (e.target.style.borderBottomColor = 'transparent')}
                          />
                          <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#38bdf8' }}>{cssVar}</span>
                        </div>

                        {/* Ô nhập MinWidth */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>≥</span>
                          <input
                            type="number"
                            value={bp.minWidth}
                            onChange={(e) =>
                              handleUpdateBreakpoint(bp.id, { minWidth: parseInt(e.target.value, 10) || 0 })
                            }
                            style={{
                              width: 60,
                              padding: '3px 6px',
                              borderRadius: 4,
                              background: '#0f172a',
                              border: '1px solid var(--line)',
                              color: '#ffffff',
                              fontFamily: 'monospace',
                              fontSize: 11,
                              textAlign: 'center',
                            }}
                          />
                          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>px</span>
                        </div>

                        {/* Nút xem thử viewport trên Canvas */}
                        <button
                          className="pm-ibtn"
                          onClick={() => handleTestViewport(bp.minWidth)}
                          title={`Xem thử kích thước ${bp.minWidth}px trên Canvas`}
                          style={{ width: 24, height: 24 }}
                        >
                          <Eye size={12} style={{ color: '#38bdf8' }} />
                        </button>

                        {/* Nút xóa */}
                        <button
                          className="pm-ibtn"
                          onClick={() => handleDeleteBreakpoint(bp.id)}
                          title="Xóa breakpoint này"
                          style={{ width: 24, height: 24, opacity: 0.6 }}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════
                TAB 6: BIẾN CSS TÙY BIẾN (CUSTOM CSS VARIABLES)
                ══════════════════════════════════════════════════ */}
            {tab === 'custom' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Bộ lọc danh mục & Nút thêm biến */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div className="canvas__btn-group" style={{ flex: 1 }}>
                    {CUSTOM_CATEGORIES.map((cat) => (
                      <button
                        key={cat.key}
                        className={`canvas__btn-group-item ${activeCustomCategory === cat.key ? 'active' : ''}`}
                        onClick={() => setActiveCustomCategory(cat.key)}
                        style={{ fontSize: 10.5, padding: '4px 8px' }}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  <button
                    className="btn primary"
                    onClick={handleAddCustomVar}
                    style={{ fontSize: 11, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Plus size={13} /> Thêm biến CSS
                  </button>
                </div>

                {/* Danh sách biến tùy biến */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    maxHeight: 400,
                    overflowY: 'auto',
                    paddingRight: 4,
                  }}
                >
                  {filteredCustomVars.map((v) => (
                    <div
                      key={v.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 14px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                      }}
                    >
                      {/* Tên biến */}
                      <div style={{ width: 180, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <input
                          type="text"
                          value={v.name}
                          onChange={(e) => {
                            let val = e.target.value
                            if (!val.startsWith('--') && val.length > 0) val = `--${val}`
                            handleUpdateCustomVar(v.id, { name: val })
                          }}
                          style={{
                            background: 'transparent',
                            border: 0,
                            borderBottom: '1px solid transparent',
                            fontFamily: 'monospace',
                            fontSize: 12,
                            fontWeight: 650,
                            color: '#38bdf8',
                            padding: '1px 0',
                          }}
                          onFocus={(e) => (e.target.style.borderBottomColor = 'var(--accent)')}
                          onBlur={(e) => (e.target.style.borderBottomColor = 'transparent')}
                        />
                        <span style={{ fontSize: 9.5, color: '#94a3b8' }}>
                          {v.description || 'Biến CSS tùy biến'}
                        </span>
                      </div>

                      {/* Ô nhập giá trị */}
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="text"
                          value={v.value}
                          onChange={(e) => handleUpdateCustomVar(v.id, { value: e.target.value })}
                          placeholder="Giá trị CSS (vd: 64px, 0 4px 6px ...)"
                          style={{
                            flex: 1,
                            padding: '5px 8px',
                            borderRadius: 4,
                            background: '#0f172a',
                            border: '1px solid var(--line)',
                            color: '#ffffff',
                            fontFamily: 'monospace',
                            fontSize: 11.5,
                          }}
                        />
                      </div>

                      {/* Chọn phân loại */}
                      <select
                        value={v.category || 'other'}
                        onChange={(e) =>
                          handleUpdateCustomVar(v.id, {
                            category: e.target.value as CustomCssVarToken['category'],
                          })
                        }
                        style={{
                          padding: '4px 8px',
                          borderRadius: 4,
                          background: '#1e293b',
                          border: '1px solid var(--line)',
                          color: '#cbd5e1',
                          fontSize: 10.5,
                        }}
                      >
                        <option value="layout">Layout</option>
                        <option value="effect">Effect</option>
                        <option value="z-index">Z-Index</option>
                        <option value="other">Khác</option>
                      </select>

                      {/* Nút sao chép var(--name) */}
                      <button
                        className="pm-ibtn"
                        onClick={() => {
                          const code = `var(${v.name.startsWith('--') ? v.name : `--${v.name}`})`
                          navigator.clipboard.writeText(code)
                          showToast(`Đã sao chép ${code}`)
                        }}
                        title="Sao chép cú pháp var(...)"
                        style={{ width: 24, height: 24 }}
                      >
                        <Copy size={12} />
                      </button>

                      {/* Nút xóa */}
                      <button
                        className="pm-ibtn"
                        onClick={() => handleDeleteCustomVar(v.id)}
                        title="Xóa biến này"
                        style={{ width: 24, height: 24, opacity: 0.6 }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                  {filteredCustomVars.length === 0 && (
                    <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
                      Chưa có biến tùy biến nào trong nhóm này. Bấm &quot;+ Thêm biến CSS&quot; để tạo mới!
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════
                TAB 7: XUẤT MÃ & ĐỒNG BỘ DỰ ÁN (SYNC)
                ══════════════════════════════════════════════════ */}
            {tab === 'sync' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="canvas__btn-group">
                    <button
                      className={`canvas__btn-group-item ${syncTarget === 'css' ? 'active' : ''}`}
                      onClick={() => setSyncTarget('css')}
                    >
                      <FileCode2 size={12} /> variables.css (Chuẩn W3C)
                    </button>
                    <button
                      className={`canvas__btn-group-item ${syncTarget === 'tailwind' ? 'active' : ''}`}
                      onClick={() => setSyncTarget('tailwind')}
                    >
                      <Zap size={12} /> tailwind.tokens.js (Tailwind CSS)
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn secondary"
                      onClick={handleCopyCode}
                      style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      {copied ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                      {copied ? 'Đã sao chép!' : 'Sao chép mã'}
                    </button>
                    <button
                      className="btn primary"
                      onClick={() => handleSaveAndSync(syncTarget)}
                      disabled={saving}
                      style={{ fontSize: 11, padding: '4px 12px' }}
                    >
                      {saving ? 'Đang ghi file...' : `Ghi vào ${syncTarget === 'css' ? 'variables.css' : 'tailwind.tokens.js'}`}
                    </button>
                  </div>
                </div>

                {/* Khung mã nguồn sinh tự động */}
                <pre
                  style={{
                    background: '#07090e',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    padding: 14,
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: '#94a3b8',
                    maxHeight: 380,
                    overflowY: 'auto',
                    lineHeight: 1.5,
                  }}
                >
                  {syncTarget === 'css' ? generateVariablesCss(tokens) : generateTailwindTokensConfig(tokens)}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

export default DesignTokensDialog
