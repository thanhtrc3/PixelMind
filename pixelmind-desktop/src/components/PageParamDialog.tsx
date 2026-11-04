import { useState } from 'react'
import { Hash, Play, ExternalLink, Sparkles, Check, Settings2 } from 'lucide-react'
import type { ProjectPage } from '@shared/types'
import Modal from './Modal'

interface PageParamDialogProps {
  page: ProjectPage
  onSelectRoute: (fullRoute: string) => void
  onClose: () => void
  onUpdateParams?: (pageId: string, params: string[]) => void
}

export default function PageParamDialog({
  page,
  onSelectRoute,
  onClose,
  onUpdateParams,
}: PageParamDialogProps) {
  const defaultParams = page.sampleParams && page.sampleParams.length > 0
    ? page.sampleParams
    : ['1', '2', '3', '4', '5']

  const [customId, setCustomId] = useState('')
  const [paramsList, setParamsList] = useState<string[]>(defaultParams)
  const [isEditingParams, setIsEditingParams] = useState(false)
  const [paramsInput, setParamsInput] = useState(defaultParams.join(', '))
  const [savedSuccess, setSavedSuccess] = useState(false)

  const buildRoute = (param: string) => {
    const base = page.route.replace(/\/+$/, '')
    const cleanParam = param.trim().replace(/^\/+/, '')
    if (!cleanParam) return base || '/'
    // Nếu route chứa placeholder như :id hoặc {id}
    if (base.includes(':id') || base.includes('{id}') || base.includes(':param')) {
      return base.replace(/:id|\{id\}|:param/g, cleanParam)
    }
    return `${base}/${cleanParam}`
  }

  const handleOpenParam = (param: string) => {
    const full = buildRoute(param)
    onSelectRoute(full)
    onClose()
  }

  const handleOpenRaw = () => {
    onSelectRoute(page.route)
    onClose()
  }

  const handleSaveParamsList = () => {
    const list = paramsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (list.length > 0) {
      setParamsList(list)
      onUpdateParams?.(page.id, list)
      setIsEditingParams(false)
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 2000)
    }
  }

  const previewCustomRoute = buildRoute(customId || '1')

  return (
    <Modal
      title={`Chọn mục xem trước · ${page.title}`}
      subtitle={`Đường dẫn: ${page.route} — Trang này cần ID sản phẩm/bản ghi để hiển thị nội dung chi tiết.`}
      icon={<Hash size={16} />}
      width={560}
      onClose={onClose}
      footer={
        <>
          <button
            className="btn secondary"
            onClick={handleOpenRaw}
            title="Mở đường dẫn gốc mà không kèm ID tham số"
            style={{ fontSize: 11.5 }}
          >
            Mở trang gốc ({page.route})
          </button>
          <div className="grow" />
          <button className="btn" onClick={onClose}>
            Đóng
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', padding: '2px 2px 8px' }}>
        {/* Thông báo định hướng */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: 'var(--panel-2, rgba(99, 102, 241, 0.08))',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <Sparkles size={16} style={{ color: '#6366f1', flexShrink: 0, marginTop: 2 }} />
          <div>
            <b>Trang yêu cầu ID hoặc tham số cụ thể</b>
            <div style={{ color: 'var(--text-3)', marginTop: 2 }}>
              Các trang như <span className="mono">{page.route}</span> thường cần mã sản phẩm (như <span className="mono">/1</span>, <span className="mono">/2</span>) để truy vấn cơ sở dữ liệu. Vui lòng chọn một mục bên dưới:
            </div>
          </div>
        </div>

        {/* Danh sách ID mẫu gợi ý */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>
              Mục mẫu có sẵn ({paramsList.length} ID):
            </span>
            <button
              className="btn sm secondary"
              onClick={() => setIsEditingParams(!isEditingParams)}
              style={{ fontSize: 11, padding: '2px 8px', gap: 4 }}
            >
              <Settings2 size={11} /> {isEditingParams ? 'Xong' : 'Sửa danh sách ID'}
            </button>
          </div>

          {isEditingParams ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: 10,
                borderRadius: 8,
                background: 'var(--panel-2)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontSize: 11.5, color: 'var(--text-2)' }}>
                Nhập các ID mẫu (phân cách bằng dấu phẩy):
              </div>
              <input
                className="pm-input mono"
                style={{ fontSize: 12 }}
                value={paramsInput}
                onChange={(e) => setParamsInput(e.target.value)}
                placeholder="1, 2, 3, 4, 5, sp-01"
              />
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button className="btn sm primary" onClick={handleSaveParamsList}>
                  <Check size={11} /> Lưu ID mẫu cho trang này
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
              {paramsList.map((param) => {
                const targetUrl = buildRoute(param)
                return (
                  <button
                    key={param}
                    onClick={() => handleOpenParam(param)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--line)',
                      background: 'var(--panel-2)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                    className="pm-param-btn"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--accent, #6366f1)' }}>
                        Sản phẩm #{param}
                      </span>
                      <Play size={10} style={{ opacity: 0.6 }} />
                    </div>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                      {targetUrl}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {savedSuccess && (
            <div style={{ fontSize: 11.5, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Check size={12} /> Đã cập nhật danh sách ID mẫu thành công!
            </div>
          )}
        </div>

        {/* Ô nhập ID tùy chỉnh */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          <label htmlFor="custom-param-input" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>
            Hoặc nhập ID / Tham số bất kỳ:
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="custom-param-input"
              className="pm-input mono"
              style={{ flex: 1, fontSize: 12.5 }}
              placeholder="Ví dụ: 10 hoặc macbook-m3"
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customId.trim()) {
                  handleOpenParam(customId.trim())
                }
              }}
            />
            <button
              className="btn primary"
              disabled={!customId.trim()}
              onClick={() => handleOpenParam(customId.trim())}
              style={{ whiteSpace: 'nowrap', gap: 6 }}
            >
              <ExternalLink size={12} /> Mở trang này
            </button>
          </div>
          {customId.trim() && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
              Đường dẫn sẽ mở: <span className="mono" style={{ color: 'var(--accent, #6366f1)', fontWeight: 600 }}>{previewCustomRoute}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

