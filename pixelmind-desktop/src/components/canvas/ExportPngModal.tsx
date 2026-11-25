import React, { useState, useEffect, useCallback } from 'react'
import {
  Camera,
  Copy,
  Download,
  Check,
  RefreshCw,
  X,
  Monitor,
  Scroll,
  Square,
  Sparkles,
} from 'lucide-react'
import type { CaptureScope } from '../../../shared/capture'
import { formatCaptureFilename } from '../../../shared/capture'

export interface ExportPngModalProps {
  isOpen: boolean
  onClose: () => void
  projectName: string
  hasSelectedElement: boolean
  selectedElementName?: string
  onCapture: (scope: CaptureScope) => Promise<string | null>
  onSavePng: (dataUrl: string, filename: string) => Promise<{ canceled: boolean; filePath?: string; error?: string }>
  onCopyPng: (dataUrl: string) => Promise<{ success: boolean; error?: string }>
  showToast: (msg: string, kind?: 'ok' | 'err' | 'info') => void
}

export const ExportPngModal: React.FC<ExportPngModalProps> = ({
  isOpen,
  onClose,
  projectName,
  hasSelectedElement,
  selectedElementName,
  onCapture,
  onSavePng,
  onCopyPng,
  showToast,
}) => {
  const [scope, setScope] = useState<CaptureScope>(hasSelectedElement ? 'element' : 'viewport')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)

  // Tự động chụp bản xem trước mỗi khi mở modal hoặc thay đổi scope
  const handleRefreshCapture = useCallback(
    async (targetScope: CaptureScope) => {
      setIsCapturing(true)
      setCopied(false)
      try {
        const shot = await onCapture(targetScope)
        setPreviewUrl(shot)
        if (shot) {
          const img = new Image()
          img.onload = () => {
            setImageSize({ width: img.naturalWidth, height: img.naturalHeight })
          }
          img.src = shot
        }
      } catch (err) {
        console.error('[ExportPngModal] Lỗi chụp ảnh:', err)
        showToast('Không thể chụp ảnh xem trước', 'err')
      } finally {
        setIsCapturing(false)
      }
    },
    [onCapture, showToast]
  )

  useEffect(() => {
    if (isOpen) {
      const initialScope: CaptureScope = hasSelectedElement ? 'element' : 'viewport'
      setScope(initialScope)
      void handleRefreshCapture(initialScope)
    } else {
      setPreviewUrl(null)
      setImageSize(null)
      setCopied(false)
    }
  }, [isOpen, hasSelectedElement, handleRefreshCapture])

  if (!isOpen) return null

  const handleSelectScope = (newScope: CaptureScope) => {
    if (newScope === 'element' && !hasSelectedElement) return
    setScope(newScope)
    void handleRefreshCapture(newScope)
  }

  const handleCopy = async () => {
    if (!previewUrl) return
    const res = await onCopyPng(previewUrl)
    if (res.success) {
      setCopied(true)
      showToast('Đã sao chép ảnh vào bộ nhớ tạm (Clipboard)', 'ok')
      setTimeout(() => setCopied(false), 2000)
    } else {
      showToast(res.error || 'Lỗi khi sao chép ảnh', 'err')
    }
  }

  const handleSave = async () => {
    if (!previewUrl) return
    setIsSaving(true)
    try {
      const filename = formatCaptureFilename(projectName, scope)
      const res = await onSavePng(previewUrl, filename)
      if (!res.canceled && res.filePath) {
        showToast(`Đã lưu ảnh thành công: ${res.filePath.split(/[\\/]/).pop()}`, 'ok')
        onClose()
      } else if (res.error) {
        showToast(res.error, 'err')
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="pm-modal-backdrop" onClick={onClose}>
      <div className="pm-export-png-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="pm-export-png-hd">
          <div className="pm-export-png-title-row">
            <div className="pm-export-png-icon">
              <Camera size={18} />
            </div>
            <div>
              <h3 className="pm-export-png-title">Xuất ảnh PNG</h3>
              <p className="pm-export-png-sub">
                Chụp ảnh sắc nét không dính thanh công cụ hay giao diện PixelMind
              </p>
            </div>
          </div>
          <button className="pm-export-png-close" onClick={onClose} title="Đóng (Esc)">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="pm-export-png-body">
          {/* Lựa chọn phạm vi chụp */}
          <div className="pm-export-png-section">
            <label className="pm-export-png-label">Phạm vi chụp:</label>
            <div className="pm-export-scope-grid">
              {/* Option 1: Viewport */}
              <button
                type="button"
                className={`pm-export-scope-card ${scope === 'viewport' ? 'active' : ''}`}
                onClick={() => handleSelectScope('viewport')}
              >
                <Monitor size={16} />
                <div className="pm-export-scope-meta">
                  <span className="pm-export-scope-title">Khung nhìn hiện tại</span>
                  <span className="pm-export-scope-desc">Chỉ phần trang web đang hiển thị</span>
                </div>
              </button>

              {/* Option 2: Full Page */}
              <button
                type="button"
                className={`pm-export-scope-card ${scope === 'fullPage' ? 'active' : ''}`}
                onClick={() => handleSelectScope('fullPage')}
              >
                <Scroll size={16} />
                <div className="pm-export-scope-meta">
                  <span className="pm-export-scope-title">Toàn bộ trang</span>
                  <span className="pm-export-scope-desc">Từ đầu trang đến hết nội dung cuộn</span>
                </div>
              </button>

              {/* Option 3: Element */}
              <button
                type="button"
                className={`pm-export-scope-card ${scope === 'element' ? 'active' : ''} ${
                  !hasSelectedElement ? 'disabled' : ''
                }`}
                onClick={() => handleSelectScope('element')}
                disabled={!hasSelectedElement}
                title={!hasSelectedElement ? 'Hãy chọn một phần tử trên Canvas trước' : ''}
              >
                <Square size={16} />
                <div className="pm-export-scope-meta">
                  <span className="pm-export-scope-title">Phần tử đang chọn</span>
                  <span className="pm-export-scope-desc">
                    {hasSelectedElement
                      ? selectedElementName || 'Thành phần được chọn'
                      : '(Chưa chọn phần tử nào)'}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Khung xem trước ảnh */}
          <div className="pm-export-png-preview-wrap">
            <div className="pm-export-png-preview-header">
              <span className="pm-export-preview-title">
                Xem trước ảnh
                {imageSize && (
                  <span className="pm-export-preview-dim">
                    {imageSize.width} × {imageSize.height} px
                  </span>
                )}
              </span>
              <button
                className="pm-export-btn-sub"
                onClick={() => void handleRefreshCapture(scope)}
                disabled={isCapturing}
                title="Chụp lại bản xem trước"
              >
                <RefreshCw size={12} className={isCapturing ? 'pm-spin' : ''} />
                <span>Chụp lại</span>
              </button>
            </div>

            <div className="pm-export-png-preview-canvas">
              {isCapturing ? (
                <div className="pm-export-png-loading">
                  <RefreshCw size={24} className="pm-spin" />
                  <span>Đang dựng ảnh PNG sắc nét...</span>
                </div>
              ) : previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Screenshot Preview"
                  className="pm-export-png-preview-img"
                />
              ) : (
                <div className="pm-export-png-empty">
                  <span>Không thể tạo ảnh xem trước</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pm-export-png-footer">
          <div className="pm-export-footer-hint">
            <Sparkles size={13} color="#a78bfa" />
            <span>Ảnh định dạng PNG 32-bit trong suốt chất lượng cao</span>
          </div>

          <div className="pm-export-footer-actions">
            <button
              type="button"
              className="pm-export-btn secondary"
              onClick={handleCopy}
              disabled={!previewUrl || isCapturing}
              title="Sao chép vào Clipboard (Ctrl + V vào Figma/Slack)"
            >
              {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
              <span>{copied ? 'Đã sao chép' : 'Sao chép ảnh'}</span>
            </button>

            <button
              type="button"
              className="pm-export-btn primary"
              onClick={handleSave}
              disabled={!previewUrl || isCapturing || isSaving}
            >
              <Download size={13} />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu ảnh PNG'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
