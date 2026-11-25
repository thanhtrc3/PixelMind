import React, { useState, useMemo } from 'react'
import {
  Workflow,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Play,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'
import type { RealElementInfo } from '../CanvasArea'
import type { ProjectPage } from '../../../shared/types'
import {
  type PrototypeInteraction,
  type PrototypeTrigger,
  type PrototypeActionType,
  PROTOTYPE_TRIGGERS,
  PROTOTYPE_ACTIONS,
  validateInteraction,
  getInteractionsForElement,
} from '../../../shared/prototype'

export interface PrototypeInspectorCardProps {
  selectedEl: RealElementInfo | null
  projectPath?: string
  pages?: ProjectPage[]
  interactions: PrototypeInteraction[]
  onSaveInteractions: (interactions: PrototypeInteraction[]) => void
  onTestTrigger: (interaction: PrototypeInteraction) => void
  showToast: (msg: string, kind?: 'ok' | 'err' | 'info') => void
}

export const PrototypeInspectorCard: React.FC<PrototypeInspectorCardProps> = ({
  selectedEl,
  projectPath,
  pages = [],
  interactions,
  onSaveInteractions,
  onTestTrigger,
  showToast,
}) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isAdding, setIsAdding] = useState(false)

  // Form thêm tương tác mới
  const [draftTrigger, setDraftTrigger] = useState<PrototypeTrigger>('click')
  const [draftAction, setDraftAction] = useState<PrototypeActionType>('route')
  const [draftTarget, setDraftTarget] = useState('')
  const [draftToastText, setDraftToastText] = useState('')

  const availableRoutes = useMemo(() => {
    const list = pages.map((p) => p.route).filter(Boolean)
    if (!list.includes('/')) list.unshift('/')
    return Array.from(new Set(list))
  }, [pages])

  const elementInteractions = useMemo(() => {
    if (!selectedEl) return []
    return getInteractionsForElement(interactions, selectedEl.uid, selectedEl.domPath)
  }, [interactions, selectedEl])

  const handleAddInteraction = () => {
    if (!selectedEl || !projectPath) return

    const newInteraction: PrototypeInteraction = {
      id: `proto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      projectPath,
      sourceUid: selectedEl.uid,
      sourceSelector: selectedEl.domPath,
      sourceTag: selectedEl.tagName.toLowerCase(),
      sourceText: selectedEl.textSnippet?.slice(0, 30),
      trigger: draftTrigger,
      action: draftAction,
      target: draftTarget.trim() || (draftAction === 'route' ? availableRoutes[0] || '/' : ''),
      toastText: draftToastText.trim() || undefined,
      createdAt: new Date().toISOString(),
    }

    const val = validateInteraction(newInteraction, availableRoutes)
    if (!val.isValid && val.error) {
      showToast(val.error.message, 'err')
    }

    const nextList = [newInteraction, ...interactions]
    onSaveInteractions(nextList)
    setIsAdding(false)
    setDraftTarget('')
    setDraftToastText('')
    showToast('Đã thêm tương tác Prototype', 'ok')
  }

  const handleDeleteInteraction = (id: string) => {
    const nextList = interactions.filter((item) => item.id !== id)
    onSaveInteractions(nextList)
    showToast('Đã xóa tương tác Prototype', 'ok')
  }

  return (
    <div className="pm-proto-card">
      {/* Header */}
      <div className="pm-proto-card-hd" onClick={() => setIsExpanded((v) => !v)}>
        <div className="pm-proto-card-title-row">
          <Workflow size={13} color="#a855f7" />
          <span className="pm-proto-card-title">Tương tác Prototype</span>
          {elementInteractions.length > 0 && (
            <span className="pm-proto-badge">{elementInteractions.length}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="pm-proto-card-body">
          {!selectedEl ? (
            <div className="pm-proto-empty-hint">
              <span>Chọn một phần tử trên Canvas để gán tương tác (Click ➔ Route, Modal, State).</span>
            </div>
          ) : (
            <>
              {/* Danh sách các tương tác của phần tử */}
              {elementInteractions.length === 0 && !isAdding && (
                <div className="pm-proto-empty-element">
                  <span>Chưa có tương tác nào cho phần tử &lt;{selectedEl.tagName.toLowerCase()}&gt;.</span>
                  <button
                    type="button"
                    className="pm-proto-add-btn"
                    onClick={() => setIsAdding(true)}
                  >
                    <Plus size={11} />
                    <span>Gán tương tác mới</span>
                  </button>
                </div>
              )}

              {elementInteractions.map((item) => {
                const val = validateInteraction(item, availableRoutes)
                const trigObj = PROTOTYPE_TRIGGERS.find((t) => t.key === item.trigger)
                const actObj = PROTOTYPE_ACTIONS.find((a) => a.key === item.action)

                return (
                  <div
                    key={item.id}
                    className={`pm-proto-item ${!val.isValid ? 'has-error' : ''}`}
                  >
                    <div className="pm-proto-item-hd">
                      <div className="pm-proto-flow-badge">
                        <span className="pm-proto-pill trigger">{trigObj?.label || item.trigger}</span>
                        <ArrowRight size={11} className="pm-proto-arrow" />
                        <span className="pm-proto-pill action">{actObj?.label || item.action}</span>
                      </div>

                      <div className="pm-proto-item-actions">
                        <button
                          type="button"
                          className="pm-proto-mini-btn play"
                          onClick={() => onTestTrigger(item)}
                          title="Chạy thử tương tác này"
                        >
                          <Play size={10} fill="currentColor" />
                        </button>
                        <button
                          type="button"
                          className="pm-proto-mini-btn delete"
                          onClick={() => handleDeleteInteraction(item.id)}
                          title="Xóa tương tác này"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>

                    {/* Chi tiết target / text */}
                    <div className="pm-proto-item-detail">
                      {item.action === 'route' && (
                        <div className="pm-proto-target-row">
                          <span className="label">Đích:</span>
                          <span className="value code">{item.target || '/'}</span>
                        </div>
                      )}
                      {(item.action === 'modal' || item.action === 'toggle_state') && (
                        <div className="pm-proto-target-row">
                          <span className="label">Selector:</span>
                          <span className="value code">{item.target || '(Trống)'}</span>
                        </div>
                      )}
                      {item.action === 'toast' && (
                        <div className="pm-proto-target-row">
                          <span className="label">Thông báo:</span>
                          <span className="value">{item.toastText || item.target || 'Thành công'}</span>
                        </div>
                      )}
                    </div>

                    {/* Cảnh báo lỗi target gãy */}
                    {!val.isValid && val.error && (
                      <div className="pm-proto-error-banner">
                        <AlertTriangle size={11} />
                        <span>{val.error.message}</span>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Form thêm tương tác mới */}
              {isAdding ? (
                <div className="pm-proto-form">
                  <div className="pm-proto-form-hd">
                    <span>Thêm liên kết tương tác mới</span>
                  </div>

                  <div className="pm-proto-form-row">
                    <label>Sự kiện (Trigger):</label>
                    <select
                      value={draftTrigger}
                      onChange={(e) => setDraftTrigger(e.target.value as PrototypeTrigger)}
                    >
                      {PROTOTYPE_TRIGGERS.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pm-proto-form-row">
                    <label>Hành động (Action):</label>
                    <select
                      value={draftAction}
                      onChange={(e) => {
                        const act = e.target.value as PrototypeActionType
                        setDraftAction(act)
                        if (act === 'route' && !draftTarget && availableRoutes.length > 0) {
                          setDraftTarget(availableRoutes[0])
                        }
                      }}
                    >
                      {PROTOTYPE_ACTIONS.map((a) => (
                        <option key={a.key} value={a.key}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {draftAction === 'route' && (
                    <div className="pm-proto-form-row">
                      <label>Chọn Route đích:</label>
                      <select
                        value={draftTarget}
                        onChange={(e) => setDraftTarget(e.target.value)}
                      >
                        {availableRoutes.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {(draftAction === 'modal' || draftAction === 'toggle_state') && (
                    <div className="pm-proto-form-row">
                      <label>CSS Selector mục tiêu:</label>
                      <input
                        type="text"
                        value={draftTarget}
                        onChange={(e) => setDraftTarget(e.target.value)}
                        placeholder="#modal-id hoặc .popup-card"
                      />
                    </div>
                  )}

                  {draftAction === 'toast' && (
                    <div className="pm-proto-form-row">
                      <label>Nội dung thông báo:</label>
                      <input
                        type="text"
                        value={draftToastText}
                        onChange={(e) => setDraftToastText(e.target.value)}
                        placeholder="Ví dụ: Đã gửi biểu mẫu thành công!"
                      />
                    </div>
                  )}

                  <div className="pm-proto-form-actions">
                    <button
                      type="button"
                      className="pm-proto-form-btn secondary"
                      onClick={() => setIsAdding(false)}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="pm-proto-form-btn primary"
                      onClick={handleAddInteraction}
                    >
                      <Plus size={11} />
                      <span>Lưu liên kết</span>
                    </button>
                  </div>
                </div>
              ) : (
                elementInteractions.length > 0 && (
                  <button
                    type="button"
                    className="pm-proto-add-link-btn"
                    onClick={() => setIsAdding(true)}
                  >
                    <Plus size={11} />
                    <span>Thêm tương tác khác</span>
                  </button>
                )
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
