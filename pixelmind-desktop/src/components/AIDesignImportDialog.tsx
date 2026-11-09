import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  Code2,
  FileCode2,
  FileImage,
  Image as ImageIcon,
  Layers,
  Loader2,
  ScanSearch,
  Sparkles,
  UploadCloud,
} from 'lucide-react'
import Modal from './Modal'
import { AI_DESIGN_SECTIONS, type AiDesignSection } from '../lib/aiMock'

type ToastKind = 'ok' | 'err' | 'info'
type Phase = 'idle' | 'analyzing' | 'analyzed' | 'generating' | 'generated'
type FrameworkId = 'html' | 'react' | 'razor' | 'vue'

interface AIDesignImportDialogProps {
  onClose: () => void
  onShowToast: (kind: ToastKind, text: string) => void
  projectName?: string
  pageRoutes?: string[]
}

const FRAMEWORKS: { id: FrameworkId; label: string; hint: string }[] = [
  { id: 'html', label: 'HTML / CSS', hint: 'thuần, dễ nhúng' },
  { id: 'react', label: 'React', hint: 'TSX + CSS module' },
  { id: 'razor', label: 'Razor', hint: 'ASP.NET MVC' },
  { id: 'vue', label: 'Vue', hint: 'SFC' },
]

const CODE_SNIPPETS: Record<FrameworkId, { html: string; css: string }> = {
  html: {
    html: `<section class="hero">
  <div class="hero__inner">
    <p class="hero__eyebrow">Bàn Cờ Tướng</p>
    <h1 class="hero__title">Khai cuộc cùng Bàn Cờ Tướng</h1>
    <p class="hero__desc">Học cờ tướng, đấu trực tuyến và theo dõi tiến bộ.</p>
    <div class="hero__actions">
      <a class="btn btn--primary" href="/Lobby">Chơi ngay</a>
      <a class="btn btn--ghost" href="/Learn">Học luật</a>
    </div>
  </div>
</section>`,
    css: `.hero {
  padding: 96px 24px;
  background: var(--bg, #0f1014);
}
.hero__inner { max-width: 1120px; margin: 0 auto; }
.hero__title {
  font-size: clamp(2rem, 5vw, 3.5rem);
  line-height: 1.1;
  color: var(--text, #eceef2);
}
.hero__actions { display: flex; gap: 12px; margin-top: 24px; }
.btn--primary { background: var(--accent, #6d5df5); color: #fff; border-radius: 10px; }`,
  },
  react: {
    html: `export function Hero() {
  return (
    <section className="hero">
      <div className="hero__inner">
        <p className="hero__eyebrow">Bàn Cờ Tướng</p>
        <h1 className="hero__title">Khai cuộc cùng Bàn Cờ Tướng</h1>
        <p className="hero__desc">Học cờ tướng, đấu trực tuyến và theo dõi tiến bộ.</p>
        <div className="hero__actions">
          <a className="btn btn--primary" href="/Lobby">Chơi ngay</a>
          <a className="btn btn--ghost" href="/Learn">Học luật</a>
        </div>
      </div>
    </section>
  )
}`,
    css: `.hero { padding: 96px 24px; background: var(--bg, #0f1014); }
.hero__inner { max-width: 1120px; margin: 0 auto; }
.hero__title { font-size: clamp(2rem, 5vw, 3.5rem); color: var(--text, #eceef2); }
.hero__actions { display: flex; gap: 12px; margin-top: 24px; }`,
  },
  razor: {
    html: `<section class="hero">
  <div class="hero__inner">
    <p class="hero__eyebrow">Bàn Cờ Tướng</p>
    <h1 class="hero__title">@Model.Title</h1>
    <p class="hero__desc">@Model.Description</p>
    <div class="hero__actions">
      <a class="btn btn--primary" asp-controller="Home" asp-action="Lobby">Chơi ngay</a>
      <a class="btn btn--ghost" asp-controller="Home" asp-action="Learn">Học luật</a>
    </div>
  </div>
</section>`,
    css: `.hero { padding: 96px 24px; background: var(--bg, #0f1014); }
.hero__inner { max-width: 1120px; margin: 0 auto; }
.hero__title { font-size: clamp(2rem, 5vw, 3.5rem); color: var(--text, #eceef2); }`,
  },
  vue: {
    html: `<template>
  <section class="hero">
    <div class="hero__inner">
      <p class="hero__eyebrow">Bàn Cờ Tướng</p>
      <h1 class="hero__title">{{ title }}</h1>
      <p class="hero__desc">{{ description }}</p>
      <div class="hero__actions">
        <a class="btn btn--primary" href="/Lobby">Chơi ngay</a>
        <a class="btn btn--ghost" href="/Learn">Học luật</a>
      </div>
    </div>
  </section>
</template>`,
    css: `.hero { padding: 96px 24px; background: var(--bg, #0f1014); }
.hero__inner { max-width: 1120px; margin: 0 auto; }
.hero__title { font-size: clamp(2rem, 5vw, 3.5rem); color: var(--text, #eceef2); }`,
  },
}

/**
 * Chuyển ảnh thiết kế thành mã (UI-only, mô phỏng toàn bộ pipeline).
 */
const AIDesignImportDialog = ({
  onClose,
  onShowToast,
  projectName,
  pageRoutes = [],
}: AIDesignImportDialogProps) => {
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [framework, setFramework] = useState<FrameworkId>('html')
  const [page, setPage] = useState(pageRoutes[0] ?? '/')
  const [phase, setPhase] = useState<Phase>('idle')
  const [sections, setSections] = useState<AiDesignSection[]>(
    AI_DESIGN_SECTIONS.map((item) => ({ ...item })),
  )
  const [codeTab, setCodeTab] = useState<'html' | 'css'>('html')
  const inputRef = useRef<HTMLInputElement>(null)
  const timers = useRef<number[]>([])

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id))
    },
    [],
  )

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  const checked = sections.filter((item) => item.checked).length
  const snippet = useMemo(() => CODE_SNIPPETS[framework], [framework])
  const busy = phase === 'analyzing' || phase === 'generating'

  const pickFile = (file: File | null | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      onShowToast('err', 'Chỉ nhận tệp ảnh (PNG, JPG, WebP, SVG).')
      return
    }
    setFileName(file.name)
    setPhase('idle')
  }

  const analyze = () => {
    if (!fileName) {
      onShowToast('info', 'Hãy chọn hoặc kéo một ảnh thiết kế vào khung bên trái.')
      return
    }
    setPhase('analyzing')
    later(() => {
      setPhase('analyzed')
      onShowToast('info', 'Đã nhận diện các khối (mô phỏng). Bật/tắt khối trước khi sinh mã.')
    }, 1300)
  }

  const generate = () => {
    if (!checked) {
      onShowToast('err', 'Chọn ít nhất một khối để sinh mã.')
      return
    }
    setPhase('generating')
    later(() => {
      setPhase('generated')
      onShowToast('ok', 'Đã sinh mã mô phỏng cho các khối đã chọn.')
    }, 1200)
  }

  const apply = () => {
    onShowToast(
      'ok',
      `Đã đánh dấu chèn vào ${page} (mô phỏng, chưa ghi tệp). Duyệt diff trong tab Thay đổi.`,
    )
    onClose()
  }

  const useSample = () => {
    setFileName('hero-reference.png')
    setPhase('idle')
  }

  const toggleSection = (id: string) => {
    setSections((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)),
    )
  }

  return (
    <Modal
      title="Chuyển thiết kế thành mã"
      subtitle={
        projectName
          ? `Dự án ${projectName} · ảnh → section → mã nguồn (bản xem trước)`
          : 'Ảnh → section → mã nguồn (bản xem trước)'
      }
      icon={<Sparkles size={16} />}
      width={980}
      onClose={onClose}
      footer={
        <>
          <span className="grow">
            {fileName ? `Nguồn: ${fileName}` : 'Chưa chọn ảnh thiết kế'} · {checked}/{sections.length} khối
          </span>
          <button className="btn" onClick={onClose}>
            Đóng
          </button>
          {phase === 'generated' ? (
            <button className="btn primary" onClick={apply}>
              <Check size={13} /> Chèn vào {page}
            </button>
          ) : (
            <button
              className="btn primary"
              onClick={generate}
              disabled={phase !== 'analyzed' || busy || !checked}
            >
              <Code2 size={13} /> Sinh mã
            </button>
          )}
        </>
      }
    >
      <div className="pm-ai-design">
        {/* ── Cột trái: nguồn & cấu hình ── */}
        <div className="pm-ai-design__side">
          <div
            className={`pm-ai-dropzone ${dragOver ? 'is-over' : ''} ${fileName ? 'has-file' : ''}`}
            onDragOver={(event) => {
              event.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragOver(false)
              pickFile(event.dataTransfer.files?.[0])
            }}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click()
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              hidden
              onChange={(event) => pickFile(event.target.files?.[0])}
            />
            {fileName ? (
              <>
                <FileImage size={26} />
                <b>{fileName}</b>
                <span>Bấm để chọn ảnh khác</span>
              </>
            ) : (
              <>
                <UploadCloud size={26} />
                <b>Kéo ảnh thiết kế vào đây</b>
                <span>PNG, JPG, WebP, SVG · nên ≥ 1200px</span>
              </>
            )}
          </div>

          <button className="pm-ai-linkbtn" onClick={useSample}>
            <ImageIcon size={11} /> Dùng ảnh mẫu để xem thử
          </button>

          <div className="pm-ai-design__group">
            <span className="pm-ai-label">Khung mã đích</span>
            <div className="pm-ai-frameworks">
              {FRAMEWORKS.map((item) => (
                <button
                  key={item.id}
                  className={`pm-ai-framework ${framework === item.id ? 'is-on' : ''}`}
                  onClick={() => setFramework(item.id)}
                >
                  <b>{item.label}</b>
                  <span>{item.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pm-ai-design__group">
            <span className="pm-ai-label">Trang đích</span>
            <select className="pm-select" value={page} onChange={(event) => setPage(event.target.value)}>
              {(pageRoutes.length ? pageRoutes : ['/Home/Index', '/Home/Lobby', '/Home/Profile']).map(
                (route) => (
                  <option key={route} value={route}>
                    {route}
                  </option>
                ),
              )}
            </select>
          </div>

          <button className="btn primary" onClick={analyze} disabled={busy || !fileName}>
            {phase === 'analyzing' ? (
              <>
                <Loader2 size={13} className="pm-spin" /> Đang phân tích…
              </>
            ) : (
              <>
                <ScanSearch size={13} /> Phân tích ảnh
              </>
            )}
          </button>

          <p className="pm-ai-design__hint">
            Mẹo: ảnh càng rõ bố cục, AI càng chia khối chính xác. Luôn duyệt diff trước khi chèn
            vào mã nguồn thật.
          </p>
        </div>

        {/* ── Cột phải: kết quả ── */}
        <div className="pm-ai-design__main">
          {phase === 'idle' && (
            <div className="pm-ai-design__empty">
              <span className="pm-ai-design__empty-ico">
                <Layers size={22} />
              </span>
              <h3>Sẵn sàng phân tích thiết kế</h3>
              <p>
                Chọn ảnh ở cột bên trái, sau đó bấm <b>Phân tích ảnh</b>. Bạn sẽ thấy các khối được
                nhận diện, độ tin cậy và có thể bật/tắt từng khối.
              </p>
              <div className="pm-ai-design__flow">
                <span>Ảnh</span>
                <i>→</i>
                <span>Section</span>
                <i>→</i>
                <span>Mã nguồn</span>
                <i>→</i>
                <span>Duyệt diff</span>
              </div>
            </div>
          )}

          {phase === 'analyzing' && (
            <div className="pm-ai-design__empty">
              <Loader2 size={24} className="pm-spin" />
              <h3>Đang nhận diện bố cục…</h3>
              <p>Ước lượng section, bảng màu, khoảng cách và thành phần tương tác.</p>
            </div>
          )}

          {(phase === 'analyzed' || phase === 'generating' || phase === 'generated') && (
            <>
              <div className="pm-ai-design__block">
                <div className="pm-ai-design__block-hd">
                  <FileImage size={12} />
                  <b>Khối được nhận diện</b>
                  <span className="pm-ai-muted">{checked} đang chọn</span>
                </div>
                <div className="pm-ai-sections">
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      className={`pm-ai-section ${section.checked ? 'is-on' : ''}`}
                      onClick={() => toggleSection(section.id)}
                    >
                      <span className={`pm-ai-checkbox ${section.checked ? 'is-on' : ''}`}>
                        {section.checked && <Check size={9} strokeWidth={3} />}
                      </span>
                      <span className="pm-ai-section__main">
                        <b>{section.name}</b>
                        <span>{section.role}</span>
                      </span>
                      <span className="pm-ai-section__conf">
                        <i style={{ width: `${section.confidence}%` }} />
                        <em>{section.confidence}%</em>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pm-ai-design__block is-code">
                <div className="pm-ai-design__block-hd">
                  <FileCode2 size={12} />
                  <b>Mã đề xuất</b>
                  <div className="pm-ai-codetabs">
                    <button
                      className={codeTab === 'html' ? 'is-on' : ''}
                      onClick={() => setCodeTab('html')}
                    >
                      {framework === 'html' ? 'HTML' : framework === 'react' ? 'TSX' : framework === 'razor' ? 'Razor' : 'Vue'}
                    </button>
                    <button
                      className={codeTab === 'css' ? 'is-on' : ''}
                      onClick={() => setCodeTab('css')}
                    >
                      CSS
                    </button>
                  </div>
                </div>
                {phase === 'generating' ? (
                  <div className="pm-ai-design__generating">
                    <Loader2 size={18} className="pm-spin" />
                    <span>Đang sinh mã từ {checked} khối…</span>
                  </div>
                ) : (
                  <pre className="pm-ai-code">
                    <code>{codeTab === 'html' ? snippet.html : snippet.css}</code>
                  </pre>
                )}
                {phase === 'generated' && (
                  <div className="pm-ai-design__notice">
                    <Check size={12} />
                    <span>
                      Mã chỉ là bản xem trước. Bấm <b>Chèn vào {page}</b> để đưa vào hàng đợi duyệt.
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default AIDesignImportDialog
