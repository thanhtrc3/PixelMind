import React, { useState } from 'react'
import { Pipette, Copy, Check, BookmarkPlus, X, AlertTriangle, ArrowRight } from 'lucide-react'
import type { ColorPickResult } from '../../lib/colorUtils'

interface EyedropperResultModalProps {
  result: ColorPickResult | null
  error?: string | null
  hasSelectedElement: boolean
  onClose: () => void
  onApplyStyle?: (property: 'color' | 'backgroundColor' | 'borderColor', value: string) => void
  onSaveToken?: (name: string, value: string) => Promise<boolean | void>
  onRetryWithFallback?: (color: string) => void
}

export const EyedropperResultModal: React.FC<EyedropperResultModalProps> = ({
  result,
  error,
  hasSelectedElement,
  onClose,
  onApplyStyle,
  onSaveToken,
  onRetryWithFallback,
}) => {
  const [copiedFormat, setCopiedFormat] = useState<'hex' | 'rgba' | null>(null)
  const [isSavingToken, setIsSavingToken] = useState(false)
  const [tokenName, setTokenName] = useState('')
  const [tokenSaved, setTokenSaved] = useState(false)
  const [fallbackColor, setFallbackColor] = useState('#6366f1')

  const copyToClipboard = (text: string, format: 'hex' | 'rgba') => {
    navigator.clipboard.writeText(text)
    setCopiedFormat(format)
    setTimeout(() => setCopiedFormat(null), 1500)
  }

  const handleSaveToken = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tokenName.trim() || !result) return
    setIsSavingToken(true)
    try {
      if (onSaveToken) {
        await onSaveToken(tokenName.trim(), result.hex)
      }
      setTokenSaved(true)
      setTimeout(() => {
        setTokenSaved(false)
        setTokenName('')
      }, 2000)
    } finally {
      setIsSavingToken(false)
    }
  }

  return (
    <div className="canvas__eyedropper-modal-overlay" onClick={onClose}>
      <div
        className="canvas__eyedropper-modal-box"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="canvas__eyedropper-modal-hd">
          <div className="canvas__eyedropper-modal-title">
            <Pipette size={16} className="canvas__eyedropper-modal-icon" />
            <span>Ống hút màu Canvas (Eyedropper)</span>
          </div>
          <button
            type="button"
            className="canvas__eyedropper-modal-close"
            onClick={onClose}
            title="Đóng (Esc)"
          >
            <X size={15} />
          </button>
        </div>

        {/* TRƯỜNG HỢP LỖI PHÂN QUYỀN HOẶC KHÔNG HỖ TRỢ */}
        {error ? (
          <div className="canvas__eyedropper-error-box">
            <div className="canvas__eyedropper-error-banner">
              <AlertTriangle size={18} className="canvas__eyedropper-error-icon" />
              <div>
                <strong>
                  {error === 'PERMISSION_DENIED'
                    ? 'Chưa được cấp quyền hút màu màn hình'
                    : 'Trình duyệt chưa kích hoạt EyeDropper API'}
                </strong>
                <p>
                  {error === 'PERMISSION_DENIED'
                    ? 'Hệ điều hành hoặc Electron đang chặn quyền lấy mẫu màu (Screen Capture / EyeDropper). Hãy cấp quyền "Screen Recording" trong cài đặt quyền riêng tư hệ thống.'
                    : 'Tính năng EyeDropper yêu cầu nhân Chromium 95+ trở lên hoặc cờ Chromium EyeDropper được bật.'}
                </p>
              </div>
            </div>

            <div className="canvas__eyedropper-fallback-section">
              <span className="canvas__eyedropper-fallback-title">Chọn màu thủ công (Fallback):</span>
              <div className="canvas__eyedropper-fallback-picker">
                <input
                  type="color"
                  value={fallbackColor}
                  onChange={(e) => setFallbackColor(e.target.value)}
                  className="canvas__eyedropper-fallback-input"
                />
                <code className="canvas__eyedropper-fallback-code">{fallbackColor}</code>
                <button
                  type="button"
                  className="pm-btn pm-btn--primary pm-btn--sm"
                  onClick={() => onRetryWithFallback?.(fallbackColor)}
                >
                  <span>Dùng màu này</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>
        ) : result ? (
          <div className="canvas__eyedropper-modal-bd">
            {/* Swatch & Color Codes */}
            <div className="canvas__eyedropper-preview-row">
              <div
                className="canvas__eyedropper-swatch"
                style={{ backgroundColor: result.hex }}
                title={`Xem trước màu: ${result.hex}`}
              />
              <div className="canvas__eyedropper-codes">
                {/* Mã HEX */}
                <div className="canvas__eyedropper-code-item">
                  <span className="canvas__eyedropper-code-lbl">HEX</span>
                  <code className="canvas__eyedropper-code-val">{result.hex.toUpperCase()}</code>
                  <button
                    type="button"
                    className="canvas__eyedropper-copy-btn"
                    onClick={() => copyToClipboard(result.hex.toUpperCase(), 'hex')}
                    title="Sao chép mã HEX"
                  >
                    {copiedFormat === 'hex' ? <Check size={13} color="#22c55e" /> : <Copy size={13} />}
                  </button>
                </div>

                {/* Mã RGBA */}
                <div className="canvas__eyedropper-code-item">
                  <span className="canvas__eyedropper-code-lbl">RGBA</span>
                  <code className="canvas__eyedropper-code-val">{result.rgba}</code>
                  <button
                    type="button"
                    className="canvas__eyedropper-copy-btn"
                    onClick={() => copyToClipboard(result.rgba, 'rgba')}
                    title="Sao chép mã RGBA"
                  >
                    {copiedFormat === 'rgba' ? <Check size={13} color="#22c55e" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Áp dụng vào thuộc tính nếu có phần tử đang chọn */}
            {hasSelectedElement && onApplyStyle && (
              <div className="canvas__eyedropper-actions-group">
                <span className="canvas__eyedropper-group-lbl">Áp dụng trực tiếp vào phần tử đang chọn:</span>
                <div className="canvas__eyedropper-btn-grid">
                  <button
                    type="button"
                    className="canvas__eyedropper-action-btn"
                    onClick={() => onApplyStyle('color', result.hex)}
                  >
                    Màu chữ (color)
                  </button>
                  <button
                    type="button"
                    className="canvas__eyedropper-action-btn"
                    onClick={() => onApplyStyle('backgroundColor', result.hex)}
                  >
                    Màu nền (background)
                  </button>
                  <button
                    type="button"
                    className="canvas__eyedropper-action-btn"
                    onClick={() => onApplyStyle('borderColor', result.hex)}
                  >
                    Màu viền (border)
                  </button>
                </div>
              </div>
            )}

            {/* Lưu thành Design Token */}
            {onSaveToken && (
              <form onSubmit={handleSaveToken} className="canvas__eyedropper-token-form">
                <span className="canvas__eyedropper-group-lbl">Lưu vào Design Tokens:</span>
                <div className="canvas__eyedropper-token-row">
                  <input
                    type="text"
                    className="canvas__eyedropper-token-input"
                    placeholder="Tên token (vd: brand-primary, accent)"
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)}
                    disabled={isSavingToken}
                  />
                  <button
                    type="submit"
                    className="canvas__eyedropper-token-save-btn"
                    disabled={!tokenName.trim() || isSavingToken}
                  >
                    {tokenSaved ? (
                      <>
                        <Check size={13} color="#22c55e" />
                        <span>Đã lưu!</span>
                      </>
                    ) : (
                      <>
                        <BookmarkPlus size={13} />
                        <span>Lưu Token</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default EyedropperResultModal

