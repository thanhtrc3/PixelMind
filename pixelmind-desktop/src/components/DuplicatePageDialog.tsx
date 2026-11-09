import { useEffect, useMemo, useState } from 'react'
import { Copy, FileCode2, FileWarning } from 'lucide-react'
import type { PageFilePreview, ProjectPage } from '@shared/types'
import { api } from '../lib/bridge'
import Modal from './Modal'

interface DuplicatePageDialogProps {
  projectId?: string
  page: ProjectPage
  existingPages: ProjectPage[]
  onConfirm: (payload: { route: string; title: string; copyFile: boolean }) => void
  onClose: () => void
  busy?: boolean
}

const defaultRoute = (route: string): string => {
  if (route === '/' || route === '') return '/home'
  return `${route.replace(/\/+$/, '')}-copy`
}

const normalizeRoute = (input: string): string => {
  let route = input.trim()
  if (!route.startsWith('/')) route = `/${route}`
  route = route.replace(/\/+/g, '/')
  if (route.length > 1 && route.endsWith('/')) route = route.slice(0, -1)
  return route
}

export default function DuplicatePageDialog({
  projectId,
  page,
  existingPages,
  onConfirm,
  onClose,
  busy = false,
}: DuplicatePageDialogProps) {
  const [route, setRoute] = useState(defaultRoute(page.route))
  const [title, setTitle] = useState(`${page.title} (bản sao)`)
  const [copyFile, setCopyFile] = useState(Boolean(page.filePath))
  const [filePreview, setFilePreview] = useState<PageFilePreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const normalized = normalizeRoute(route)
  const routeError = useMemo(() => {
    if (!route.trim()) return 'Hãy nhập route cho trang mới.'
    if (
      existingPages.some(
        (item) => normalizeRoute(item.route).toLowerCase() === normalized.toLowerCase(),
      )
    ) {
      return `Route ${normalized} đã có trong danh sách trang.`
    }
    return ''
  }, [route, normalized, existingPages])

  const canCopyFile = Boolean(page.filePath && filePreview?.supported && !filePreview.exists)
  const willCopyFile = Boolean(copyFile && canCopyFile)

  useEffect(() => {
    if (!copyFile || !page.filePath || !projectId) {
      setFilePreview(null)
      setPreviewLoading(false)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    const timer = window.setTimeout(() => {
      void api.projects
        .pageFilePreview(projectId, normalized)
        .then((preview) => {
          if (!cancelled) setFilePreview(preview)
        })
        .catch(() => {
          if (!cancelled) setFilePreview(null)
        })
        .finally(() => {
          if (!cancelled) setPreviewLoading(false)
        })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [copyFile, page.filePath, projectId, normalized])

  const submit = () => {
    if (routeError) return
    onConfirm({
      route: normalized,
      title: title.trim() || `${page.title} (bản sao)`,
      copyFile: willCopyFile,
    })
  }

  return (
    <Modal
      title="Nhân bản trang"
      subtitle={`Tạo bản sao từ ${page.title} · ${page.route}`}
      icon={<Copy size={16} />}
      width={540}
      onClose={onClose}
      footer={
        <>
          <span className="grow" style={{ fontSize: 11.5, color: routeError ? 'var(--color-error-text)' : 'var(--text-3)' }}>
            {routeError ||
              (willCopyFile
                ? `Sẽ sao chép tệp sang ${filePreview?.relativePath ?? ''}.`
                : 'Chỉ nhân bản metadata, không tạo tệp mới.')}
          </span>
          <button className="btn" onClick={onClose} disabled={busy}>
            Huỷ
          </button>
          <button className="btn primary" onClick={submit} disabled={busy || Boolean(routeError)}>
            <Copy size={12} /> {busy ? 'Đang nhân bản…' : 'Nhân bản'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13, width: '100%', padding: '2px 2px 6px' }}>
        <div className="pm-field">
          <label htmlFor="duplicate-page-route">Route mới</label>
          <input
            id="duplicate-page-route"
            className="pm-input mono"
            value={route}
            autoComplete="off"
            onChange={(event) => setRoute(event.target.value)}
          />
        </div>

        <div className="pm-field">
          <label htmlFor="duplicate-page-title">Tiêu đề trang mới</label>
          <input
            id="duplicate-page-title"
            className="pm-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        {page.filePath ? (
          <>
            <div className="pm-setting" style={{ paddingTop: 4 }}>
              <div className="pm-setting__txt">
                <b>Sao chép cả tệp route</b>
                <span className="mono" style={{ fontSize: 11 }}>
                  Nguồn: {page.filePath}
                </span>
                <span>Nội dung tệp được giữ nguyên, bạn có thể chỉnh sửa sau.</span>
              </div>
              <div className="pm-setting__ctrl">
                <button
                  type="button"
                  className={`pm-switch ${willCopyFile ? 'on' : ''}`}
                  onClick={() => setCopyFile((value) => !value)}
                  aria-label="Sao chép cả tệp route"
                />
              </div>
            </div>

            {copyFile && (
              <div className="pm-note" style={{ margin: 0 }}>
                <FileCode2 size={13} style={{ flexShrink: 0 }} />
                <span>
                  {previewLoading ? (
                    'Đang kiểm tra đường dẫn tệp...'
                  ) : filePreview ? (
                    filePreview.supported ? (
                      <>
                        <b>{filePreview.label}</b>
                        {' · '}
                        <span className="mono">{filePreview.relativePath}</span>
                        {filePreview.exists ? ' — tệp đã tồn tại, không thể ghi đè.' : null}
                      </>
                    ) : (
                      <>{filePreview.reason || 'Không thể tạo tệp route tự động cho dự án này.'}</>
                    )
                  ) : (
                    'Nhập route để xem tệp sẽ được tạo ở đâu.'
                  )}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="pm-note" style={{ margin: 0 }}>
            <FileWarning size={14} style={{ flexShrink: 0 }} />
            <span>Trang nguồn không gắn với tệp route nên chỉ metadata được nhân bản.</span>
          </div>
        )}
      </div>
    </Modal>
  )
}
