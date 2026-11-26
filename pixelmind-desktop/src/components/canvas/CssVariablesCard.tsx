import React, { useState, useMemo } from 'react'
import {
  Code2,
  Plus,
  Trash2,
  Check,
  Search,
  Sparkles,
  Link2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import {
  type ElementCssVar,
  type SuggestedToken,
  formatVarReference,
  isCssVarReference,
  extractVarName,
} from '../../lib/cssVariables'
import type { DesignTokens } from '@shared/types'

interface CssVariablesCardProps {
  variables: ElementCssVar[]
  designTokens?: DesignTokens | null
  computedStyles: Record<string, string>
  onApplyVariable: (varName: string, value: string, isDelete?: boolean) => void
  onApplyPropertyToken: (propertyName: string, tokenVarReference: string) => void
  onOpenDesignTokensDialog?: () => void
  isReadOnly?: boolean
}

// Các thuộc tính CSS phổ biến thường gán biến token
const COMMON_ASSIGNABLE_PROPERTIES: Array<{ key: string; label: string; category: 'color' | 'spacing' | 'radius' | 'other' }> = [
  { key: 'color', label: 'Màu chữ (color)', category: 'color' },
  { key: 'backgroundColor', label: 'Màu nền (background-color)', category: 'color' },
  { key: 'borderColor', label: 'Màu viền (border-color)', category: 'color' },
  { key: 'borderRadius', label: 'Bo góc (border-radius)', category: 'radius' },
  { key: 'padding', label: 'Khoảng đệm (padding)', category: 'spacing' },
  { key: 'margin', label: 'Căn lề (margin)', category: 'spacing' },
  { key: 'gap', label: 'Khoảng cách flex/grid (gap)', category: 'spacing' },
  { key: 'fontSize', label: 'Cỡ chữ (font-size)', category: 'other' },
]

export const CssVariablesCard: React.FC<CssVariablesCardProps> = ({
  variables,
  designTokens,
  computedStyles,
  onApplyVariable,
  onApplyPropertyToken,
  onOpenDesignTokensDialog,
  isReadOnly = false,
}) => {
  const [filterQuery, setFilterQuery] = useState('')
  const [isExpanded, setIsExpanded] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newVarName, setNewVarName] = useState('--')
  const [newVarValue, setNewVarValue] = useState('')

  // Trạng thái gán token vào thuộc tính viết cứng
  const [showTokenAssignModal, setShowTokenAssignModal] = useState(false)
  const [selectedPropKey, setSelectedPropKey] = useState<string>('color')
  const [selectedTokenRef, setSelectedTokenRef] = useState<string>('')

  // Trạng thái chỉnh sửa trực tiếp giá trị biến
  const [editingVarName, setEditingVarName] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')

  // Lọc danh sách biến
  const filteredVars = useMemo(() => {
    if (!filterQuery.trim()) return variables
    const q = filterQuery.toLowerCase()
    return variables.filter(
      (v) => v.name.toLowerCase().includes(q) || v.value.toLowerCase().includes(q) || (v.sourceSelector && v.sourceSelector.toLowerCase().includes(q)),
    )
  }, [variables, filterQuery])

  // Lấy các token gợi ý từ DesignTokens
  const tokenList: SuggestedToken[] = useMemo(() => {
    if (!designTokens) return []
    const toSafeVarSlug = (name: string): string => {
      const base = name.split(/[\(\[\{]/)[0].trim().toLowerCase()
      const slug = base
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-|-$/g, '')
      return slug || 'custom'
    }

    const res: SuggestedToken[] = []
    if (Array.isArray(designTokens.colors)) {
      for (const c of designTokens.colors) {
        const slug = toSafeVarSlug(c.name)
        res.push({
          id: c.id,
          name: c.name,
          cssVarName: `--color-${slug}`,
          value: c.value,
          category: 'color',
        })
      }
    }
    if (Array.isArray(designTokens.spacing)) {
      for (const s of designTokens.spacing) {
        const slug = toSafeVarSlug(s.name)
        res.push({
          id: s.id,
          name: s.name,
          cssVarName: `--space-${slug}`,
          value: s.value,
          category: 'spacing',
        })
      }
    }
    if (Array.isArray(designTokens.radius)) {
      for (const r of designTokens.radius) {
        const slug = toSafeVarSlug(r.name)
        res.push({
          id: r.id,
          name: r.name,
          cssVarName: `--radius-${slug}`,
          value: r.value,
          category: 'radius',
        })
      }
    }
    if (Array.isArray(designTokens.customVars)) {
      for (const cv of designTokens.customVars) {
        res.push({
          id: cv.id,
          name: cv.name,
          cssVarName: cv.name.startsWith('--') ? cv.name : `--${cv.name}`,
          value: cv.value,
          category: 'custom',
        })
      }
    }
    return res
  }, [designTokens])

  const handleStartEdit = (v: ElementCssVar) => {
    if (isReadOnly) return
    setEditingVarName(v.name)
    setEditingValue(v.value)
  }

  const handleCommitEdit = () => {
    if (!editingVarName) return
    onApplyVariable(editingVarName, editingValue.trim())
    setEditingVarName(null)
  }

  const handleAddVariable = (e: React.FormEvent) => {
    e.preventDefault()
    let name = newVarName.trim()
    if (!name.startsWith('--')) {
      name = `--${name}`
    }
    if (name.length <= 2 || !newVarValue.trim()) return

    onApplyVariable(name, newVarValue.trim())
    setNewVarName('--')
    setNewVarValue('')
    setShowAddForm(false)
  }

  const handleAssignTokenToProp = () => {
    if (!selectedPropKey || !selectedTokenRef) return
    onApplyPropertyToken(selectedPropKey, selectedTokenRef)
    setShowTokenAssignModal(false)
  }

  const isColorVal = (val: string) => {
    return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(val.trim()) || /^rgba?\(|^hsla?\(/i.test(val.trim())
  }

  return (
    <div className="canvas__inspector-card pm-css-vars-card">
      {/* Header */}
      <div
        className="canvas__inspector-header"
        onClick={() => setIsExpanded((prev) => !prev)}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Code2 size={13} style={{ color: 'var(--accent, #6366f1)' }} />
          <span>Biến CSS & Design Tokens</span>
          <span className="pm-css-vars-count">{variables.length}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={(e) => e.stopPropagation()}>
          {!isReadOnly && (
            <button
              type="button"
              className="canvas__tiny-btn"
              onClick={() => setShowTokenAssignModal(true)}
              title="Gán Token / Biến CSS thay thế giá trị cứng"
            >
              <Link2 size={12} />
              <span>Gán Token</span>
            </button>
          )}
          {!isReadOnly && (
            <button
              type="button"
              className="canvas__tiny-btn"
              onClick={() => setShowAddForm((prev) => !prev)}
              title="Thêm biến CSS mới cho phần tử"
            >
              <Plus size={12} />
            </button>
          )}
          <button
            type="button"
            className="canvas__tiny-btn"
            onClick={() => setIsExpanded((prev) => !prev)}
            title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
          >
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="pm-css-vars-body">
          {/* Thanh tìm kiếm nhanh biến */}
          {variables.length > 4 && (
            <div className="pm-css-vars-search-wrap">
              <Search size={12} className="pm-css-vars-search-icon" />
              <input
                type="text"
                placeholder="Tìm biến CSS (--*)..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="pm-css-vars-search-input"
              />
              {filterQuery && (
                <button
                  type="button"
                  className="pm-css-vars-clear-search"
                  onClick={() => setFilterQuery('')}
                >
                  ×
                </button>
              )}
            </div>
          )}

          {/* Form thêm biến mới */}
          {showAddForm && (
            <form onSubmit={handleAddVariable} className="pm-css-vars-add-form">
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>
                Thêm biến CSS mới cho phần tử:
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input
                  type="text"
                  placeholder="--ten-bien"
                  value={newVarName}
                  onChange={(e) => setNewVarName(e.target.value)}
                  className="canvas__input pm-css-var-input"
                  style={{ flex: 1, fontFamily: 'monospace', fontSize: 11 }}
                  autoFocus
                />
                <input
                  type="text"
                  placeholder="Giá trị (vd: #6366f1, 16px)"
                  value={newVarValue}
                  onChange={(e) => setNewVarValue(e.target.value)}
                  className="canvas__input pm-css-var-input"
                  style={{ flex: 1, fontSize: 11 }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ fontSize: 11, padding: '3px 8px' }}
                  onClick={() => setShowAddForm(false)}
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  style={{ fontSize: 11, padding: '3px 10px' }}
                  disabled={!newVarName.trim() || !newVarValue.trim()}
                >
                  Lưu biến
                </button>
              </div>
            </form>
          )}

          {/* Danh sách biến */}
          {filteredVars.length === 0 ? (
            <div className="pm-css-vars-empty">
              {filterQuery ? (
                'Không tìm thấy biến phù hợp.'
              ) : (
                <span>
                  Phần tử chưa có biến CSS riêng.{' '}
                  {!isReadOnly && (
                    <button
                      type="button"
                      className="pm-link-btn"
                      onClick={() => setShowAddForm(true)}
                    >
                      + Thêm biến
                    </button>
                  )}
                </span>
              )}
            </div>
          ) : (
            <div className="pm-css-vars-list">
              {filteredVars.map((v) => {
                const isEditing = editingVarName === v.name
                const hasColor = isColorVal(v.value)

                return (
                  <div
                    key={v.name}
                    className={`pm-css-var-row ${v.isInline ? 'is-inline' : ''}`}
                    title={`Nguồn: ${v.sourceSelector || (v.isInline ? 'Inline style' : 'Kế thừa')}`}
                  >
                    <div className="pm-css-var-meta">
                      <span className="pm-css-var-name" title={v.name}>
                        {v.name}
                      </span>
                      <span
                        className={`pm-css-var-badge ${
                          v.isInline ? 'badge-inline' : v.isInherited ? 'badge-root' : 'badge-rule'
                        }`}
                      >
                        {v.isInline ? 'inline' : v.sourceSelector || 'rule'}
                      </span>
                    </div>

                    <div className="pm-css-var-val-col">
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 4, width: '100%' }}>
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCommitEdit()
                              if (e.key === 'Escape') setEditingVarName(null)
                            }}
                            className="canvas__input pm-css-var-input"
                            style={{ flex: 1, fontSize: 11 }}
                            autoFocus
                          />
                          <button
                            type="button"
                            className="canvas__tiny-btn ok"
                            onClick={handleCommitEdit}
                            title="Áp dụng"
                          >
                            <Check size={11} />
                          </button>
                        </div>
                      ) : (
                        <div
                          className="pm-css-var-value-display"
                          onClick={() => handleStartEdit(v)}
                          title="Bấm để chỉnh sửa giá trị biến"
                        >
                          {hasColor && (
                            <span
                              className="pm-css-var-swatch"
                              style={{ backgroundColor: v.value }}
                            />
                          )}
                          <span className="pm-css-var-value-text">{v.value}</span>
                        </div>
                      )}

                      {!isReadOnly && v.isInline && !isEditing && (
                        <button
                          type="button"
                          className="pm-css-var-del-btn"
                          onClick={() => onApplyVariable(v.name, '', true)}
                          title="Xóa biến inline khỏi phần tử"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Quick link mở bảng Design Tokens */}
          {onOpenDesignTokensDialog && (
            <div className="pm-css-vars-footer">
              <button
                type="button"
                className="pm-link-btn"
                onClick={onOpenDesignTokensDialog}
              >
                <Sparkles size={11} />
                <span>Mở quản lý Design Tokens dự án...</span>
                <ExternalLink size={10} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal / Popover gán Token vào thuộc tính viết cứng */}
      {showTokenAssignModal && (
        <div className="pm-token-assign-backdrop" onClick={() => setShowTokenAssignModal(false)}>
          <div className="pm-token-assign-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="pm-token-assign-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 650, fontSize: 13 }}>
                <Link2 size={14} style={{ color: 'var(--accent)' }} />
                <span>Gán Token thay thế giá trị cứng</span>
              </div>
              <button
                type="button"
                className="pm-css-vars-clear-search"
                onClick={() => setShowTokenAssignModal(false)}
              >
                ×
              </button>
            </div>

            <div className="pm-token-assign-body">
              {/* Chọn thuộc tính */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>
                  Thuộc tính cần thay thế:
                </label>
                <select
                  value={selectedPropKey}
                  onChange={(e) => setSelectedPropKey(e.target.value)}
                  className="canvas__input"
                  style={{ width: '100%', fontSize: 12, padding: '5px 8px' }}
                >
                  {COMMON_ASSIGNABLE_PROPERTIES.map((p) => {
                    const currentVal = computedStyles[p.key] || 'chưa gán'
                    const isVar = isCssVarReference(currentVal)
                    return (
                      <option key={p.key} value={p.key}>
                        {p.label} {isVar ? `(đang dùng: ${extractVarName(currentVal)})` : `(hiện tại: ${currentVal})`}
                      </option>
                    )
                  })}
                </select>
              </div>

              {/* Chọn Token thay thế */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>
                  Chọn Design Token hoặc Biến CSS:
                </label>

                {tokenList.length === 0 && variables.length === 0 ? (
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', padding: '10px 0' }}>
                    Chưa có Design Token nào trong dự án. Bạn có thể tự nhập cú pháp <code>var(--tên-biến)</code> bên dưới.
                  </div>
                ) : (
                  <div className="pm-token-select-list">
                    {/* Danh sách Token có sẵn */}
                    {tokenList.map((tok) => {
                      const refStr = formatVarReference(tok.cssVarName, tok.value)
                      const isSelected = selectedTokenRef === refStr

                      return (
                        <div
                          key={tok.id}
                          className={`pm-token-select-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => setSelectedTokenRef(refStr)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                            {tok.category === 'color' && (
                              <span
                                className="pm-css-var-swatch"
                                style={{ backgroundColor: tok.value }}
                              />
                            )}
                            <span
                              style={{
                                fontWeight: 600,
                                fontSize: 11.5,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {tok.name}
                            </span>
                            <span style={{ fontSize: 10.5, color: 'var(--text-3)', fontFamily: 'monospace' }}>
                              {tok.cssVarName}
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{tok.value}</span>
                        </div>
                      )
                    })}

                    {/* Danh sách biến CSS trên element */}
                    {variables.map((v) => {
                      const refStr = formatVarReference(v.name)
                      const isSelected = selectedTokenRef === refStr

                      return (
                        <div
                          key={v.name}
                          className={`pm-token-select-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => setSelectedTokenRef(refStr)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                            <span style={{ fontWeight: 600, fontSize: 11.5, fontFamily: 'monospace' }}>
                              {v.name}
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{v.value}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Nhập thủ công nếu muốn */}
                <div style={{ marginTop: 8 }}>
                  <input
                    type="text"
                    placeholder="var(--custom-variable)"
                    value={selectedTokenRef}
                    onChange={(e) => setSelectedTokenRef(e.target.value)}
                    className="canvas__input"
                    style={{ width: '100%', fontSize: 11, fontFamily: 'monospace' }}
                  />
                </div>
              </div>
            </div>

            <div className="pm-token-assign-footer">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setShowTokenAssignModal(false)}
                style={{ fontSize: 12, padding: '5px 12px' }}
              >
                Đóng
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={handleAssignTokenToProp}
                disabled={!selectedPropKey || !selectedTokenRef.trim()}
                style={{ fontSize: 12, padding: '5px 14px' }}
              >
                Áp dụng Token
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CssVariablesCard
