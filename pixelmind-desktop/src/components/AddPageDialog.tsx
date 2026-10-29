import { useState } from 'react'
import { FilePlus2, Image as ImageIcon } from 'lucide-react'
import type { ProjectPage } from '@shared/types'
import Modal from './Modal'

interface AddPageDialogProps {
  projectName: string
  onAdd: (page: Omit<ProjectPage, 'id'>) => void
  onClose: () => void
}

const SOFTWARES = ['Figma', 'Photoshop', 'Sketch', 'Adobe XD', 'Penpot', 'Khác']
const FRAMES = ['1440×900', '1920×1080', '390×844', '768×1024', '1280×800', 'Khác']

const AddPageDialog = ({ projectName, onAdd, onClose }: AddPageDialogProps) => {
  const [route, setRoute] = useState('')
  const [title, setTitle] = useState('')
  const [mockup, setMockup] = useState(false)
  const [software, setSoftware] = useState('Figma')
  const [frame, setFrame] = useState('1440×900')
  const [error, setError] = useState('')

  const submit = () => {
    const cleanRoute = route.trim()
    const cleanTitle = title.trim()
    if (!cleanRoute) {
      setError('Hãy nhập route, ví dụ /gio-hang.')
      return
    }
    if (!cleanTitle) {
      setError('Hãy nhập tiêu đề trang.')
      return
    }
    const normalized = cleanRoute.startsWith('/') ? cleanRoute : `/${cleanRoute}`
    onAdd({
      route: normalized,
      title: cleanTitle,
      mockup,
      software: mockup ? software : '—',
      frame: mockup ? frame : '—',
    })
  }

  return (
    <Modal
      title="Thêm trang"
      subtitle={`Khai báo một route của ${projectName} để theo dõi ảnh mẫu.`}
      icon={<FilePlus2 size={16} />}
      width={520}
      onClose={onClose}
      footer={
        <>
          <span className="grow">{error ? <span style={{ color: 'var(--color-error-text)' }}>{error}</span> : 'Không tạo tệp mới trên đĩa.'}</span>
          <button className="btn" onClick={onClose}>
            Huỷ
          </button>
          <button className="btn primary" onClick={submit}>
            <FilePlus2 size={12} /> Thêm trang
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', padding: '2px 2px 6px' }}>
        <div className="pm-field">
          <label htmlFor="page-route">Route</label>
          <input
            id="page-route"
            className="pm-input mono"
            placeholder="/gio-hang"
            value={route}
            onChange={(e) => {
              setRoute(e.target.value)
              setError('')
            }}
          />
        </div>
        <div className="pm-field">
          <label htmlFor="page-title">Tiêu đề</label>
          <input
            id="page-title"
            className="pm-input"
            placeholder="Giỏ hàng"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setError('')
            }}
          />
        </div>

        <div className="pm-setting" style={{ paddingTop: 4 }}>
          <div className="pm-setting__txt">
            <b>Có ảnh mẫu thiết kế</b>
            <span>Bật nếu bạn đã có ảnh tham chiếu cho trang này.</span>
          </div>
          <div className="pm-setting__ctrl">
            <button
              className={`pm-switch ${mockup ? 'on' : ''}`}
              onClick={() => setMockup((value) => !value)}
              aria-label="Có ảnh mẫu"
            />
          </div>
        </div>

        {mockup && (
          <>
            <div className="pm-field">
              <label htmlFor="page-software">Phần mềm thiết kế</label>
              <select
                id="page-software"
                className="pm-select"
                value={software}
                onChange={(e) => setSoftware(e.target.value)}
              >
                {SOFTWARES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="pm-field">
              <label htmlFor="page-frame">Khung</label>
              <select
                id="page-frame"
                className="pm-select"
                value={frame}
                onChange={(e) => setFrame(e.target.value)}
              >
                {FRAMES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="pm-note" style={{ margin: 0 }}>
              <ImageIcon size={12} />
              <span>PixelMind chưa gắn tệp ảnh ở bước này — bạn có thể bổ sung sau khi mở màn hình làm việc.</span>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

export default AddPageDialog
