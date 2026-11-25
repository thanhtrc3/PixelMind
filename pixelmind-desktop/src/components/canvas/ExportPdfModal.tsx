import React, { useState } from 'react'
import {
  FileText,
  Download,
  X,
  FileCheck,
  Sparkles,
  RefreshCw,
} from 'lucide-react'
import type { PdfMarginType, PdfPageSize, PdfExportResult } from '../../../shared/pdf'

export interface ExportPdfModalProps {
  isOpen: boolean
  onClose: () => void
  projectName: string
  currentRoute?: string
  onExportPdf: (options: {
    pageSize: PdfPageSize
    landscape: boolean
    printBackground: boolean
    marginType: PdfMarginType
  }) => Promise<PdfExportResult>
  showToast: (msg: string, kind?: 'ok' | 'err' | 'info') => void
}

const PAGE_SIZES: Array<{ key: PdfPageSize; label: string; desc: string }> = [
  { key: 'A4', label: 'Khổ A4', desc: '210 × 297 mm (Tiêu chuẩn)' },
  { key: 'A3', label: 'Khổ A3', desc: '297 × 420 mm (Bản vẽ lớn)' },
  { key: 'Letter', label: 'Letter', desc: '8.5 × 11 in (Mỹ & Quốc tế)' },
  { key: 'Legal', label: 'Legal', desc: '8.5 × 14 in (Văn bản dài)' },
]

export const ExportPdfModal: React.FC<ExportPdfModalProps> = ({
  isOpen,
  onClose,
  projectName,
  onExportPdf,
  showToast,
}) => {
  const [pageSize, setPageSize] = useState<PdfPageSize>('A4')
  const [landscape, setLandscape] = useState(false)
  const [printBackground, setPrintBackground] = useState(true)
  const [marginType, setMarginType] = useState<PdfMarginType>('default')
  const [isExporting, setIsExporting] = useState(false)

  if (!isOpen) return null

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const res = await onExportPdf({
        pageSize,
        landscape,
        printBackground,
        marginType,
      })

      if (!res.canceled && res.filePath) {
        const name = res.filePath.split(/[\\/]/).pop()
        const kb = res.bytes ? ` (${Math.round(res.bytes / 1024)} KB)` : ''
        showToast(`Đã xuất PDF thành công: ${name}${kb}`, 'ok')
        onClose()
      } else if (res.error) {
        showToast(res.error, 'err')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast(`Lỗi khi xuất PDF: ${msg}`, 'err')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="pm-modal-backdrop" onClick={onClose}>
      <div className="pm-export-pdf-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="pm-export-pdf-hd">
          <div className="pm-export-pdf-title-row">
            <div className="pm-export-pdf-icon">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="pm-export-pdf-title">
                Xuất trang {projectName ? `(${projectName})` : ''} ra file PDF
              </h3>
              <p className="pm-export-pdf-sub">
                Định dạng vector sắc nét, tự động ngắt trang thông minh không bị cắt gãy chữ
              </p>
            </div>
          </div>
          <button className="pm-export-pdf-close" onClick={onClose} title="Đóng (Esc)">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="pm-export-pdf-body">
          {/* Nhóm 1: Khổ giấy */}
          <div className="pm-export-pdf-section">
            <label className="pm-export-pdf-label">1. Chọn khổ giấy:</label>
            <div className="pm-export-pdf-grid">
              {PAGE_SIZES.map((sz) => (
                <button
                  key={sz.key}
                  type="button"
                  className={`pm-export-pdf-card ${pageSize === sz.key ? 'active' : ''}`}
                  onClick={() => setPageSize(sz.key)}
                >
                  <FileCheck size={16} />
                  <div className="pm-export-pdf-card-meta">
                    <span className="pm-export-pdf-card-title">{sz.label}</span>
                    <span className="pm-export-pdf-card-desc">{sz.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Nhóm 2: Hướng giấy */}
          <div className="pm-export-pdf-section">
            <label className="pm-export-pdf-label">2. Hướng trang in:</label>
            <div className="pm-export-pdf-orient-row">
              <button
                type="button"
                className={`pm-export-pdf-orient-btn ${!landscape ? 'active' : ''}`}
                onClick={() => setLandscape(false)}
              >
                <div className="pm-orient-icon portrait" />
                <span>Khổ dọc (Portrait)</span>
              </button>

              <button
                type="button"
                className={`pm-export-pdf-orient-btn ${landscape ? 'active' : ''}`}
                onClick={() => setLandscape(true)}
              >
                <div className="pm-orient-icon landscape" />
                <span>Khổ ngang (Landscape)</span>
              </button>
            </div>
          </div>

          {/* Nhóm 3: Lề trang */}
          <div className="pm-export-pdf-section">
            <label className="pm-export-pdf-label">3. Canh lề trang (Margins):</label>
            <div className="pm-export-pdf-margins-row">
              <button
                type="button"
                className={`pm-export-pdf-margin-btn ${marginType === 'default' ? 'active' : ''}`}
                onClick={() => setMarginType('default')}
              >
                <span>Mặc định (Tiêu chuẩn)</span>
              </button>
              <button
                type="button"
                className={`pm-export-pdf-margin-btn ${marginType === 'none' ? 'active' : ''}`}
                onClick={() => setMarginType('none')}
                title="Không lề, trang web tràn kín trang in (Full-bleed)"
              >
                <span>Không lề (Tràn trang)</span>
              </button>
              <button
                type="button"
                className={`pm-export-pdf-margin-btn ${marginType === 'minimal' ? 'active' : ''}`}
                onClick={() => setMarginType('minimal')}
                title="Lề nhỏ 5mm"
              >
                <span>Lề nhỏ (5mm)</span>
              </button>
            </div>
          </div>

          {/* Nhóm 4: Tùy chọn in nền */}
          <div className="pm-export-pdf-section">
            <label className="pm-export-pdf-checkbox-row">
              <input
                type="checkbox"
                checked={printBackground}
                onChange={(e) => setPrintBackground(e.target.checked)}
              />
              <span className="pm-export-pdf-checkbox-label">
                <b>In màu nền và hình ảnh thiết kế</b> (Khuyên dùng để giữ trọn vẹn màu sắc trang web)
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="pm-export-pdf-footer">
          <div className="pm-export-footer-hint">
            <Sparkles size={13} color="#a78bfa" />
            <span>Tạo file PDF vector nguyên bản từ Chromium, chữ có thể bôi đen copy</span>
          </div>

          <div className="pm-export-footer-actions">
            <button
              type="button"
              className="pm-export-btn secondary"
              onClick={onClose}
              disabled={isExporting}
            >
              Hủy
            </button>

            <button
              type="button"
              className="pm-export-btn primary"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <RefreshCw size={13} className="pm-spin" />
                  <span>Đang kết xuất PDF...</span>
                </>
              ) : (
                <>
                  <Download size={13} />
                  <span>Xuất tệp PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
