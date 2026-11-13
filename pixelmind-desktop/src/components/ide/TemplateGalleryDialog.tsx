import { useState } from 'react'
import {
  Atom,
  Boxes,
  Check,
  Component,
  FileCode,
  FolderOpen,
  Globe,
  LayoutDashboard,
  LayoutTemplate,
  Loader2,
  Plus,
  Terminal,
  X,
} from 'lucide-react'
import {
  PROJECT_TEMPLATES,
  type ProjectTemplate,
  type TemplateCategory,
} from '../../../shared/projectTemplates'

interface TemplateGalleryDialogProps {
  onClose: () => void
  onSelectFolder: () => Promise<string | null>
  onCreateProject: (options: {
    templateId: string
    parentDir: string
    projectName: string
  }) => Promise<{ success: boolean; error?: string }>
}

const CATEGORIES: { id: TemplateCategory; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'dotnet', label: '.NET / C#' },
  { id: 'frontend', label: 'React & Vue' },
  { id: 'fullstack', label: 'Next.js & Backend' },
  { id: 'static', label: 'Web tĩnh (F5 chạy)' },
]

const getIcon = (name: string) => {
  switch (name) {
    case 'Boxes':
      return <Boxes size={22} className="template-icon is-dotnet" />
    case 'Atom':
      return <Atom size={22} className="template-icon is-react" />
    case 'LayoutTemplate':
      return <LayoutTemplate size={22} className="template-icon is-static" />
    case 'LayoutDashboard':
      return <LayoutDashboard size={22} className="template-icon is-dashboard" />
    case 'Component':
      return <Component size={22} className="template-icon is-vue" />
    case 'Globe':
      return <Globe size={22} className="template-icon is-next" />
    case 'FileCode':
      return <FileCode size={22} className="template-icon is-php" />
    case 'Terminal':
    default:
      return <Terminal size={22} className="template-icon is-python" />
  }
}

const STORAGE_KEY_LAST_DIR = 'pm.template.last_parent_dir'

const TemplateGalleryDialog = ({
  onClose,
  onSelectFolder,
  onCreateProject,
}: TemplateGalleryDialogProps) => {
  const [category, setCategory] = useState<TemplateCategory>('all')
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate>(
    PROJECT_TEMPLATES[0],
  )
  const [projectName, setProjectName] = useState('MyAwesomeApp')
  const [parentDir, setParentDir] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_LAST_DIR) || ''
    } catch {
      return ''
    }
  })
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const filtered = PROJECT_TEMPLATES.filter(
    (t) => category === 'all' || t.category === category,
  )

  const handlePickFolder = async () => {
    try {
      const folder = await onSelectFolder()
      if (folder) {
        setParentDir(folder)
        setErrorMsg(null)
        try {
          localStorage.setItem(STORAGE_KEY_LAST_DIR, folder)
        } catch {}
      }
    } catch {}
  }

  const handleCreate = async () => {
    const trimmedName = projectName.trim()
    if (!trimmedName) {
      setErrorMsg('Vui lòng nhập tên dự án.')
      return
    }
    if (/[/\\:*?"<>|]/.test(trimmedName)) {
      setErrorMsg('Tên dự án không được chứa ký tự đặc biệt (/, \\, :, *, ?, ", <, >, |).')
      return
    }
    if (!parentDir.trim()) {
      setErrorMsg('Vui lòng chọn thư mục lưu dự án.')
      return
    }

    setBusy(true)
    setErrorMsg(null)
    try {
      // Lưu lại thư mục này cho lần tạo dự án sau
      try {
        localStorage.setItem(STORAGE_KEY_LAST_DIR, parentDir.trim())
      } catch {}

      const res = await onCreateProject({
        templateId: selectedTemplate.id,
        parentDir: parentDir.trim(),
        projectName: trimmedName,
      })
      if (!res.success) {
        setErrorMsg(res.error || 'Khởi tạo dự án thất bại.')
        setBusy(false)
      } else {
        onClose()
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi không xác định khi tạo dự án.')
      setBusy(false)
    }
  }

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div
        className="pm-modal pm-template-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Thư viện template khởi tạo dự án"
      >
        <header className="pm-modal__header">
          <div>
            <h3>Khởi tạo dự án mới từ Template</h3>
            <p className="pm-hint" style={{ marginTop: 2 }}>
              Chọn khung công nghệ bạn muốn xây dựng. PixelMind sẽ sinh cấu trúc tệp chuẩn và nạp vào không gian làm việc.
            </p>
          </div>
          <button className="pm-modal__close" onClick={onClose} title="Đóng">
            <X size={14} />
          </button>
        </header>

        <div className="pm-template-body">
          {/* Cột trái: Bộ lọc & Danh sách template */}
          <div className="pm-template-left">
            <div className="pm-template-tabs">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  className={`pm-template-tab ${category === cat.id ? 'is-active' : ''}`}
                  onClick={() => setCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="pm-template-grid">
              {filtered.map((item) => {
                const isSelected = selectedTemplate.id === item.id
                return (
                  <div
                    key={item.id}
                    className={`pm-template-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => {
                      setSelectedTemplate(item)
                      setErrorMsg(null)
                    }}
                  >
                    <div className="pm-template-card__header">
                      {getIcon(item.iconName)}
                      <span className="pm-template-card__badge">{item.badge}</span>
                    </div>
                    <b className="pm-template-card__name">{item.name}</b>
                    <p className="pm-template-card__desc">{item.description}</p>
                    {isSelected && (
                      <span className="pm-template-card__check">
                        <Check size={12} /> Đang chọn
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Cột phải: Thông tin cấu hình & Nơi lưu */}
          <div className="pm-template-right">
            <div className="pm-template-summary">
              <h4>Chi tiết cấu hình</h4>
              <div className="pm-template-meta-row">
                <span className="label">Framework:</span>
                <span className="val">{selectedTemplate.framework}</span>
              </div>
              <div className="pm-template-meta-row">
                <span className="label">Lệnh chạy (F5):</span>
                <code className="val mono">{selectedTemplate.runCommand}</code>
              </div>
              <div className="pm-template-meta-row">
                <span className="label">Cổng mặc định:</span>
                <span className="val mono">{selectedTemplate.defaultPort}</span>
              </div>
            </div>

            <div className="pm-template-form">
              <label className="pm-form-label">
                Tên dự án mới
                <input
                  type="text"
                  className="pm-input"
                  value={projectName}
                  placeholder="Ví dụ: MyStoreApp"
                  onChange={(e) => setProjectName(e.target.value)}
                  disabled={busy}
                />
              </label>

              <label className="pm-form-label" style={{ marginTop: 12 }}>
                Thư mục lưu dự án
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <input
                    type="text"
                    className="pm-input"
                    style={{ flex: 1 }}
                    value={parentDir}
                    placeholder="Chọn thư mục chứa..."
                    readOnly
                    onClick={handlePickFolder}
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={handlePickFolder}
                    disabled={busy}
                    title="Duyệt thư mục trên máy tính"
                  >
                    <FolderOpen size={13} /> Duyệt...
                  </button>
                </div>
              </label>

              {parentDir && projectName.trim() && (
                <div className="pm-template-preview-path">
                  <div className="label">Đường dẫn đầy đủ:</div>
                  <code className="path-text">
                    {parentDir.replace(/[\\/]+$/, '')}\{projectName.trim()}
                  </code>
                </div>
              )}

              {errorMsg && (
                <div className="pm-template-error" role="alert">
                  {errorMsg}
                </div>
              )}
            </div>

            <div className="pm-template-footer">
              <button
                type="button"
                className="btn primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleCreate}
                disabled={busy}
              >
                {busy ? (
                  <>
                    <Loader2 size={13} className="pm-spin" /> Đang khởi tạo dự án...
                  </>
                ) : (
                  <>
                    <Plus size={13} /> Khởi tạo & Mở dự án
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TemplateGalleryDialog
