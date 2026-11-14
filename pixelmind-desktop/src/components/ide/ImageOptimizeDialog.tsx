import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FolderOpen,
  Image as ImageIcon,
  Info,
  Loader2,
  Wand2,
  TriangleAlert,
} from 'lucide-react'
import Modal from '../Modal'
import { api } from '../../lib/bridge'
import { formatBytes } from '../../lib/format'
import {
  IMAGE_FORMAT_OPTIONS,
  IMAGE_OPTIMIZE_LIMITS,
  canReplaceImage,
  describeImage,
  imageFormatLabel,
  normalizeQuality,
  resolveOutputFormat,
  suggestedOutputName,
  type ImageApplyOptions,
  type ImageApplyResult,
  type ImageFormatChoice,
  type ImageInspectResult,
  type ImagePreviewResult,
} from '@shared/imageOptimize'

interface ImageOptimizeDialogProps {
  asset: { name: string; path: string; size?: number }
  onClose: () => void
  onOptimized: (result: ImageApplyResult, options: ImageApplyOptions) => void
  onShowToast: (kind: 'ok' | 'err' | 'info', text: string) => void
}

const dirOf = (target: string) => target.replace(/[\\/][^\\/]+$/, '')

const parseDimension = (value: string): number | undefined => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined
  return Math.min(IMAGE_OPTIMIZE_LIMITS.maxDimension, Math.round(parsed))
}

const savingsText = (savings: number): string => {
  const percent = Math.round(Math.abs(savings) * 100)
  if (percent === 0) return 'Không thay đổi đáng kể'
  return savings > 0 ? `Tiết kiệm ${percent}%` : `Tăng ${percent}%`
}

const ImageOptimizeDialog = ({
  asset,
  onClose,
  onOptimized,
  onShowToast,
}: ImageOptimizeDialogProps) => {
  const [inspection, setInspection] = useState<ImageInspectResult | null>(null)
  const [inspecting, setInspecting] = useState(true)
  const [format, setFormat] = useState<ImageFormatChoice>('keep')
  const [quality, setQuality] = useState<number>(IMAGE_OPTIMIZE_LIMITS.defaultQuality)
  const [maxWidth, setMaxWidth] = useState('')
  const [maxHeight, setMaxHeight] = useState('')
  const [mode, setMode] = useState<'new' | 'replace'>('new')
  const [confirmed, setConfirmed] = useState(false)
  const [preview, setPreview] = useState<ImagePreviewResult | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImageApplyResult | null>(null)
  const previewSeq = useRef(0)

  const info = inspection?.info
  const target = info ? resolveOutputFormat(info.format, format) : null
  const replaceAllowed = info ? canReplaceImage(info.format, format) : false

  /* Đọc thông tin ảnh khi mở hộp thoại. */
  useEffect(() => {
    let cancelled = false
    setInspecting(true)
    setInspection(null)
    setError(null)
    setResult(null)
    api.images
      .inspect(asset.path)
      .then((res) => {
        if (cancelled) return
        setInspection(res)
        if (!res.ok) {
          setError(res.error ?? 'Không đọc được ảnh.')
        } else if (res.info) {
          setFormat(resolveOutputFormat(res.info.format, 'keep') ? 'keep' : 'webp')
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setInspection({
          ok: false,
          error: err instanceof Error ? err.message : 'Không đọc được ảnh.',
        })
        setError(err instanceof Error ? err.message : 'Không đọc được ảnh.')
      })
      .finally(() => {
        if (!cancelled) setInspecting(false)
      })
    return () => {
      cancelled = true
    }
  }, [asset.path])

  /* Đổi định dạng khiến không thể ghi đè → quay về chế độ tạo tệp mới. */
  useEffect(() => {
    if (!replaceAllowed) {
      setMode('new')
      setConfirmed(false)
    }
  }, [replaceAllowed])

  /* Xem trước có debounce, bỏ qua kết quả cũ. */
  useEffect(() => {
    if (!info || !target) {
      setPreview(null)
      setPreviewing(false)
      return
    }
    /* Giữ nguyên bản xem trước cuối cùng sau khi đã lưu để so sánh. */
    if (result) return
    const seq = ++previewSeq.current
    setPreviewing(true)
    const timer = window.setTimeout(() => {
      api.images
        .preview({
          path: info.path,
          format,
          quality: normalizeQuality(quality),
          maxWidth: parseDimension(maxWidth),
          maxHeight: parseDimension(maxHeight),
        })
        .then((res) => {
          if (seq !== previewSeq.current) return
          setPreview(res)
          if (!res.ok) setError(res.error ?? 'Không xem trước được ảnh.')
        })
        .catch((err: unknown) => {
          if (seq !== previewSeq.current) return
          setPreview({
            ok: false,
            error: err instanceof Error ? err.message : 'Không xem trước được ảnh.',
          })
        })
        .finally(() => {
          if (seq === previewSeq.current) setPreviewing(false)
        })
    }, 350)

    return () => {
      window.clearTimeout(timer)
    }
  }, [info, target, format, quality, maxWidth, maxHeight, result])

  const outputName = useMemo(() => {
    if (!info || !target) return ''
    return suggestedOutputName(info.name, target)
  }, [info, target])

  const outputPathPreview = useMemo(() => {
    if (!info) return ''
    if (mode === 'replace') return info.path
    const dir = dirOf(info.path)
    const folder = dir.split(/[\\/]/).pop()?.toLowerCase() === 'optimized' ? dir : `${dir}\\optimized`
    return `${folder}\\${outputName}`
  }, [info, mode, outputName])

  const handleApply = async () => {
    if (!info || busy) return
    if (!target) {
      setError('Vui lòng chọn định dạng đích cho ảnh.')
      return
    }
    if (mode === 'replace' && !confirmed) {
      setError('Hãy tick xác nhận trước khi thay thế ảnh gốc.')
      return
    }

    const options: ImageApplyOptions = {
      path: info.path,
      format,
      quality: normalizeQuality(quality),
      maxWidth: parseDimension(maxWidth),
      maxHeight: parseDimension(maxHeight),
      mode,
      confirmed: mode === 'replace' ? true : undefined,
    }

    setBusy(true)
    setError(null)
    try {
      const res = await api.images.apply(options)
      if (!res.ok) {
        setError(res.error ?? 'Tối ưu ảnh thất bại.')
        onShowToast('err', res.error ?? 'Tối ưu ảnh thất bại.')
        return
      }
      setResult(res)
      onOptimized(res, options)
      const saved = res.originalSize && res.size ? res.originalSize - res.size : 0
      onShowToast(
        'ok',
        `Đã tối ưu “${info.name}” (${formatBytes(res.size ?? 0)}${
          saved > 0 ? `, giảm ${formatBytes(saved)}` : ''
        }).`,
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Tối ưu ảnh thất bại.'
      setError(message)
      onShowToast('err', message)
    } finally {
      setBusy(false)
    }
  }

  const handleOpenResult = async () => {
    if (!result?.outputPath) return
    const openError = await api.fs.openPath(result.outputPath)
    if (openError) onShowToast('err', `Không mở được ảnh: ${openError}`)
  }

  const previewOutput = preview?.ok ? preview.output : undefined
  const savings = previewOutput?.savings ?? 0
  const savingPositive = savings > 0.005

  return (
    <Modal
      title="Tối ưu ảnh"
      subtitle="Chọn định dạng, chất lượng và kích thước. PixelMind không bao giờ ghi đè ảnh gốc nếu bạn chưa xác nhận."
      icon={<Wand2 size={16} />}
      width={660}
      onClose={onClose}
      footer={
        result?.ok ? (
          <>
            <button type="button" className="btn" onClick={() => void api.fs.showInFolder(result.outputPath ?? asset.path)}>
              <FolderOpen size={13} /> Hiện trong thư mục
            </button>
            <button type="button" className="btn" onClick={() => void handleOpenResult()}>
              <ExternalLink size={13} /> Mở ảnh
            </button>
            <button type="button" className="btn primary" onClick={onClose}>
              Đóng
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn" onClick={onClose} disabled={busy}>
              Hủy
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => void handleApply()}
              disabled={busy || inspecting || !inspection?.ok || !previewOutput}
            >
              {busy ? (
                <>
                  <Loader2 size={13} className="pm-spin" /> Đang tối ưu...
                </>
              ) : (
                <>
                  <Wand2 size={13} /> {mode === 'replace' ? 'Thay thế ảnh gốc' : 'Lưu bản tối ưu'}
                </>
              )}
            </button>
          </>
        )
      }
    >
      <div className="pm-imgopt">
        {inspecting && (
          <div className="pm-imgopt-loading">
            <Loader2 size={16} className="pm-spin" /> Đang đọc thông tin ảnh…
          </div>
        )}

        {!inspecting && inspection && !inspection.ok && (
          <div className="pm-template-error" role="alert">
            {inspection.error ?? 'Không đọc được ảnh.'}
          </div>
        )}

        {info && (
          <>
            <div className="pm-imgopt-source">
              <div className="pm-imgopt-source__thumb">
                <ImageIcon size={22} className="pm-muted" />
              </div>
              <div className="pm-imgopt-source__meta">
                <span className="pm-imgopt-source__name" title={info.path}>
                  {info.name}
                </span>
                <span className="pm-imgopt-source__path" title={info.path}>
                  {info.path}
                </span>
                <span className="pm-imgopt-source__stats">
                  {describeImage(info)} · {formatBytes(info.size)}
                </span>
              </div>
            </div>

            <div className="pm-imgopt-section">
              <span className="pm-imgopt-label">Định dạng đầu ra</span>
              <div className="pm-imgopt-formats">
                {IMAGE_FORMAT_OPTIONS.map((option) => {
                  const disabled =
                    option.value === 'keep' && !resolveOutputFormat(info.format, 'keep')
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`pm-imgopt-format ${format === option.value ? 'active' : ''}`}
                      onClick={() => setFormat(option.value)}
                      disabled={busy || disabled}
                      title={disabled ? `Ảnh ${imageFormatLabel(info.format)} cần chọn định dạng đích` : option.hint}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
              <span className="pm-imgopt-hint">
                {IMAGE_FORMAT_OPTIONS.find((option) => option.value === format)?.hint}
              </span>
            </div>

            <div className="pm-imgopt-section">
              <div className="pm-imgopt-label-row">
                <span className="pm-imgopt-label">
                  {target === 'png' ? 'Mức giảm bảng màu' : target === 'gif' ? 'Số màu' : 'Chất lượng'}
                </span>
                <span className="pm-imgopt-quality">{normalizeQuality(quality)}%</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={quality}
                onChange={(event) => setQuality(Number(event.target.value))}
                disabled={busy}
                className="pm-imgopt-range"
              />
              <span className="pm-imgopt-hint">
                {target === 'png'
                  ? 'PNG dùng bảng màu khi mức dưới 100% (giữ trong suốt, giảm dung lượng).'
                  : 'Chất lượng thấp hơn cho tệp nhỏ hơn nhưng có thể mờ chi tiết.'}
              </span>
            </div>

            <div className="pm-imgopt-section">
              <span className="pm-imgopt-label">Kích thước tối đa (giữ tỉ lệ)</span>
              <div className="pm-imgopt-resize">
                <label>
                  Rộng
                  <input
                    type="number"
                    min={1}
                    max={IMAGE_OPTIMIZE_LIMITS.maxDimension}
                    placeholder={String(info.width || '—')}
                    value={maxWidth}
                    onChange={(event) => setMaxWidth(event.target.value)}
                    disabled={busy}
                    className="pm-input"
                  />
                </label>
                <label>
                  Cao
                  <input
                    type="number"
                    min={1}
                    max={IMAGE_OPTIMIZE_LIMITS.maxDimension}
                    placeholder={String(info.height || '—')}
                    value={maxHeight}
                    onChange={(event) => setMaxHeight(event.target.value)}
                    disabled={busy}
                    className="pm-input"
                  />
                </label>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setMaxWidth('')
                    setMaxHeight('')
                  }}
                  disabled={busy || (!maxWidth && !maxHeight)}
                >
                  Đặt lại
                </button>
              </div>
              <span className="pm-imgopt-hint">
                Để trống để giữ nguyên. Ảnh chỉ được thu nhỏ, không bị phóng to.
              </span>
            </div>

            {info.animated && target !== 'webp' && target !== 'avif' && (
              <div className="pm-imgopt-warning">
                <TriangleAlert size={13} />
                <span>
                  Ảnh động {info.pages} khung hình sẽ chỉ giữ khung đầu tiên khi xuất{' '}
                  {target ? imageFormatLabel(target) : 'định dạng này'}. Chọn WebP/AVIF để giữ chuyển động.
                </span>
              </div>
            )}
            {info.format === 'svg' && (
              <div className="pm-imgopt-warning">
                <Info size={13} />
                <span>SVG sẽ được rasterize thành ảnh điểm ảnh, mất khả năng phóng to vô hạn.</span>
              </div>
            )}

            <div className="pm-imgopt-compare">
              <div className="pm-imgopt-side">
                <span className="pm-imgopt-side__label">Ảnh gốc</span>
                <strong>{formatBytes(info.size)}</strong>
                <span>
                  {info.width > 0 ? `${info.width}×${info.height} · ` : ''}
                  {imageFormatLabel(info.format)}
                </span>
              </div>
              <ArrowRight size={16} className="pm-imgopt-arrow" />
              <div className="pm-imgopt-side">
                <span className="pm-imgopt-side__label">Sau tối ưu</span>
                <strong>{previewing ? '…' : previewOutput ? formatBytes(previewOutput.size) : '—'}</strong>
                <span>
                  {previewOutput
                    ? `${previewOutput.width}×${previewOutput.height} · ${imageFormatLabel(previewOutput.format)}`
                    : 'Chưa có kết quả'}
                </span>
                {previewOutput && (
                  <span className={`pm-imgopt-savings ${savingPositive ? 'down' : 'up'}`}>
                    {savingsText(previewOutput.savings)}
                  </span>
                )}
              </div>
              {previewOutput?.dataUrl && (
                <div className="pm-imgopt-thumb">
                  <img src={previewOutput.dataUrl} alt="Xem trước ảnh tối ưu" />
                </div>
              )}
            </div>

            {preview && !preview.ok && (
              <div className="pm-template-error" role="alert">
                {preview.error ?? 'Không xem trước được ảnh.'}
              </div>
            )}

            <div className="pm-imgopt-section">
              <span className="pm-imgopt-label">Lưu kết quả</span>
              <label className={`pm-imgopt-mode ${mode === 'new' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="pm-imgopt-mode"
                  checked={mode === 'new'}
                  onChange={() => setMode('new')}
                  disabled={busy}
                />
                <span>
                  <b>Tạo tệp mới trong optimized/</b>
                  <em>Giữ nguyên ảnh gốc, an toàn để thử nhiều mức chất lượng.</em>
                </span>
              </label>
              <label className={`pm-imgopt-mode ${mode === 'replace' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="pm-imgopt-mode"
                  checked={mode === 'replace'}
                  onChange={() => setMode('replace')}
                  disabled={busy || !replaceAllowed}
                />
                <span>
                  <b>Thay thế ảnh gốc</b>
                  <em>
                    {replaceAllowed
                      ? 'Có bản sao lưu để hoàn tác.'
                      : 'Chỉ áp dụng khi giữ nguyên định dạng. Đổi định dạng sẽ tạo tệp mới.'}
                  </em>
                </span>
              </label>

              {mode === 'replace' && (
                <label className="pm-imgopt-confirm">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    disabled={busy}
                  />
                  <span>
                    Tôi hiểu ảnh gốc sẽ bị ghi đè. PixelMind tạo bản sao lưu để hoàn tác trong phiên
                    làm việc này.
                  </span>
                </label>
              )}

              {outputPathPreview && (
                <div className="pm-imgopt-outpath">
                  <span>Đường dẫn đầu ra:</span>
                  <code>{outputPathPreview}</code>
                </div>
              )}
            </div>

            {result?.ok && (
              <div className="pm-archive-success" role="status">
                <CheckCircle2 size={14} />
                <div>
                  <b>Đã lưu ảnh tối ưu.</b>
                  <div>
                    {formatBytes(result.size ?? 0)}
                    {result.originalSize
                      ? ` · giảm ${formatBytes(Math.max(0, result.originalSize - (result.size ?? 0)))}`
                      : ''}
                    {result.replaced ? ' · đã thay thế ảnh gốc' : ''}
                  </div>
                  <code>{result.outputPath}</code>
                </div>
              </div>
            )}

            {error && (
              <div className="pm-template-error" role="alert">
                {error}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

export default ImageOptimizeDialog
