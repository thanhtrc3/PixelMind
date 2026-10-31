import { useEffect, useState } from 'react'
import {
  Check,
  Copy,
  FileCode2,
  Palette,
  Plus,
  RotateCcw,
  Trash2,
  Zap,
} from 'lucide-react'
import type { ColorToken, DesignTokens, RadiusToken, SpacingToken, TypographyToken } from '@shared/types'
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

type TokenTab = 'colors' | 'typography' | 'spacing' | 'radius' | 'sync'
type ColorCategoryFilter = 'all' | 'brand' | 'background' | 'status' | 'neutral'

const COLOR_CATEGORIES: Array<{ key: ColorCategoryFilter; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'brand', label: 'Thương hiệu' },
  { key: 'background', label: 'Nền & Khung' },
  { key: 'status', label: 'Trạng thái' },
  { key: 'neutral', label: 'Chữ & Trung tính' },
]
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
          setTokens(data || DEFAULT_DESIGN_TOKENS)
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
    setTokens({ ...DEFAULT_DESIGN_TOKENS })
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

  const filteredColors =
    activeCategory === 'all' ? tokens.colors : tokens.colors.filter((c) => c.category === activeCategory)

  return (
    <Modal
      title="Hệ thống thiết kế (Design Tokens & Theme Manager)"
      subtitle={`Quản lý tập trung quy chuẩn màu sắc, phông chữ, khoảng cách và bo góc cho ${projectName || 'dự án'}`}
      icon={<Palette size={20} style={{ color: 'var(--accent, #6d5df5)' }} />}
      width={860}
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
        <div className="canvas__seg" style={{ width: '100%', justifyContent: 'space-between' }}>
          {[
            { id: 'colors', label: '🎨 Bảng màu (Colors)', count: tokens.colors.length },
            { id: 'typography', label: '🔤 Tỷ lệ chữ (Typography)', count: tokens.typography.length },
            { id: 'spacing', label: '📐 Khoảng cách (Spacing)', count: tokens.spacing.length },
            { id: 'radius', label: '🔲 Bo góc (Radius)', count: tokens.radius.length },
            { id: 'sync', label: '⚡ Xuất & Đồng bộ (Sync)', count: null },
          ].map((item) => (
            <button
              key={item.id}
              className={`canvas__seg-btn ${tab === item.id ? 'active' : ''}`}
              style={{ flex: 1, padding: '7px 4px', fontSize: 11 }}
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
                TAB 5: XUẤT MÃ & ĐỒNG BỘ DỰ ÁN (SYNC)
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
