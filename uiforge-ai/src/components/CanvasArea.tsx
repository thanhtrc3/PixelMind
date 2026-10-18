import { useEffect, useRef, useState } from 'react';
import {
  Image as ImageIcon, Globe, Columns2, Layers, ScanSearch,
  MousePointer2, Hand, Square, Type, MessageSquarePlus, Ruler, Camera,
  ZoomIn, ZoomOut, Maximize2, Smartphone, Tablet, Monitor, MonitorUp,
  Play, Move, Sparkles, X, Crosshair, Check, Package,
} from 'lucide-react';
import { PART_MAP } from '../data/toolbox';
import type { InsertedPart } from '../data/toolbox';
import '../styles/Canvas.css';

export type CanvasMode = 'reference' | 'live' | 'compare' | 'overlay' | 'diff';
type Viewport = 'mobile' | 'tablet' | 'desktop' | 'wide';
type Tool = 'select' | 'pan' | 'rect' | 'text' | 'comment' | 'measure';
type SelectionId = 'header' | 'heroTitle' | 'ctaButton' | 'featureCard';

const MODES: { key: CanvasMode; label: string; icon: typeof ImageIcon }[] = [
  { key: 'reference', label: 'Ảnh mẫu', icon: ImageIcon },
  { key: 'live', label: 'Trực tiếp', icon: Globe },
  { key: 'compare', label: 'Song song', icon: Columns2 },
  { key: 'overlay', label: 'Chồng lớp', icon: Layers },
  { key: 'diff', label: 'Khác biệt', icon: ScanSearch },
];

const TOOLS: { key: Tool; label: string; icon: typeof MousePointer2; key_hint: string }[] = [
  { key: 'select', label: 'Chọn', icon: MousePointer2, key_hint: 'V' },
  { key: 'pan', label: 'Di chuyển', icon: Hand, key_hint: 'H' },
  { key: 'rect', label: 'Khoanh vùng', icon: Square, key_hint: 'L' },
  { key: 'text', label: 'Ghi chú', icon: Type, key_hint: 'T' },
  { key: 'comment', label: 'Bình luận', icon: MessageSquarePlus, key_hint: 'C' },
  { key: 'measure', label: 'Đo khoảng cách', icon: Ruler, key_hint: 'M' },
];

interface CanvasAreaProps {
  /** Part đã kéo từ Search Toolbox vào khung */
  inserted?: InsertedPart[];
  /** id part đang được kéo (để hiện vùng thả) */
  draggingPartId?: string | null;
  /** Thả part vào khung */
  onDropPart?: (partId: string) => void;
  /** Chế độ xem do thanh trên cùng điều khiển (Compare / Preview) */
  mode?: CanvasMode;
  onModeChange?: (mode: CanvasMode) => void;
}

const VIEWPORTS: { key: Viewport; label: string; icon: typeof Smartphone; w: number; h: number }[] = [
  { key: 'mobile', label: 'Mobile', icon: Smartphone, w: 390, h: 844 },
  { key: 'tablet', label: 'Tablet', icon: Tablet, w: 768, h: 1024 },
  { key: 'desktop', label: 'Desktop', icon: Monitor, w: 1440, h: 900 },
  { key: 'wide', label: 'Rộng', icon: MonitorUp, w: 1920, h: 1080 },
];

const SELECT_RECTS: Record<SelectionId, { label: string; x: number; y: number; w: number; h: number; size: string; selector: string }> = {
  header:     { label: 'header',        x: 0,   y: 0,  w: 100, h: 8,  size: '1440 × 72',  selector: 'header.site-nav' },
  heroTitle:  { label: 'h1.hero-title', x: 7.5, y: 22, w: 44,  h: 11, size: '634 × 99',   selector: '.hero h1' },
  ctaButton:  { label: 'button.cta',    x: 7.5, y: 47, w: 14,  h: 7,  size: '202 × 63',   selector: '.hero .cta' },
  featureCard:{ label: 'article.card',  x: 52,  y: 60, w: 20,  h: 27, size: '288 × 243',  selector: '.features .card:nth-child(2)' },
};

const COMMENTS = [
  { id: 1, x: 30, y: 20, author: 'QT', text: 'Nút này thấp hơn ảnh mẫu 8px', status: 'open' as const },
  { id: 2, x: 63, y: 70, author: 'TH', text: 'Bo góc card nên là 16px', status: 'open' as const },
  { id: 3, x: 12, y: 52, author: 'BA', text: 'Màu CTA đã khớp ✓', status: 'done' as const },
];

/* ────────────────────────────────────────────────
   Mock giao diện của dự án đang được thiết kế
   ──────────────────────────────────────────────── */

/* Part kéo từ Search Toolbox: app chèn nguyên code sample.html + sample.css
   vào khung, đúng như mô tả ở mục 2.13 */
const MockParts = ({ parts }: { parts: InsertedPart[] }) => {
  if (parts.length === 0) return null;
  return (
    <div className="mock__parts">
      {parts.map((p, i) => {
        const part = PART_MAP[p.partId];
        if (!part) return null;
        return (
          <section className="mock__part" key={p.uid}>
            <style>{part.css}</style>
            <span className="mock__part-tag">
              part · {part.id} · v{part.version}
            </span>
            <div className="mock__part-body" dangerouslySetInnerHTML={{ __html: part.html }} />
            <span className="mock__part-index">#{i + 1}</span>
          </section>
        );
      })}
    </div>
  );
};

const MockSite = ({
  variant, onPick, selected, parts = [],
}: {
  variant: 'live' | 'wire';
  onPick: (id: SelectionId) => void;
  selected: SelectionId | null;
  parts?: InsertedPart[];
}) => {
  const cls = (id: SelectionId, extra = '') =>
    `mock__pick ${extra} ${selected === id ? 'is-selected' : ''}`;

  /* Thanh navbar của trang ShopWeb đang thiết kế — bấm được như trang thật */
  const [navOn, setNavOn] = useState('Trang chủ');

  return (
    <div className={`mock mock--${variant}`}>
      {/* Nav */}
      <div className={cls('header', 'mock__nav')} onClick={(e) => { e.stopPropagation(); onPick('header'); }}>
        <div className="mock__nav-inner">
          <div className="mock__brand">
            <span className="mock__brand-mark" />
            ShopWeb
          </div>
          <nav className="mock__nav-links">
            {['Trang chủ', 'Sản phẩm', 'Khuyến mãi', 'Liên hệ'].map((l) => (
              <button
                key={l}
                type="button"
                className={`mock__link ${navOn === l ? 'is-on' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setNavOn(l);
                  onPick('header');
                }}
              >
                {l}
              </button>
            ))}
          </nav>
          <div className="mock__nav-actions">
            <button
              type="button"
              className="mock__nav-login"
              onClick={(e) => {
                e.stopPropagation();
                onPick('header');
              }}
            >
              Đăng nhập
            </button>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="mock__hero">
        <div className="mock__hero-left">
          <span className="mock__pill">Bản 2.0 đã ra mắt</span>
          <h1 className={cls('heroTitle', 'mock__title')} onClick={(e) => { e.stopPropagation(); onPick('heroTitle'); }}>
            Thiết kế giao diện,<br />không cần dò từng pixel
          </h1>
          <p className="mock__sub">
            Mở dự án thật, xem giao diện đang chạy, kéo thả hoặc nhờ AI sửa — mọi thay đổi ghi thẳng vào mã nguồn.
          </p>
          <div className="mock__cta-row">
            <span className={cls('ctaButton', 'mock__cta')} onClick={(e) => { e.stopPropagation(); onPick('ctaButton'); }}>
              Bắt đầu miễn phí
            </span>
            <span className="mock__cta ghost">Xem demo</span>
          </div>
          <div className="mock__trust">
            <span className="mock__avatars"><i /><i /><i /><i /></span>
            <span>1.240 nhóm đang dùng</span>
          </div>
        </div>
        <div className="mock__hero-right">
          <div className="mock__shot">
            <div className="mock__shot-bar"><i /><i /><i /></div>
            <div className="mock__shot-body">
              <div className="mock__shot-side"><span /><span /><span className="on" /><span /></div>
              <div className="mock__shot-main">
                <span className="mock__shot-line w70" />
                <span className="mock__shot-line w45" />
                <div className="mock__shot-cards"><span /><span /><span /></div>
                <span className="mock__shot-line w60" />
              </div>
            </div>
          </div>
          <div className="mock__float mock__float--a">✓ Khớp ảnh mẫu 98%</div>
          <div className="mock__float mock__float--b">↕ Lệch 6px</div>
        </div>
      </div>

      {/* Features */}
      <div className="mock__features">
        {['Nhìn thấy lỗi', 'Sửa bằng AI', 'Kiểm tra tự động'].map((t, i) => (
          <div
            key={t}
            className={`${cls('featureCard', 'mock__card')} ${i === 1 ? 'mock__card--hl' : ''}`}
            onClick={(e) => { e.stopPropagation(); onPick('featureCard'); }}
          >
            <span className="mock__card-ico" />
            <span className="mock__card-title">{t}</span>
            <span className="mock__card-line" />
            <span className="mock__card-line short" />
          </div>
        ))}
      </div>

      {/* Part kéo từ Search Toolbox */}
      <MockParts parts={parts} />
    </div>
  );
};

const MockMobile = ({ variant }: { variant: 'live' | 'wire' }) => (
  <div className={`mock mock--mobile mock--${variant}`}>
    <div className="mock__m-nav">
      <span className="mock__brand-mark" />
      <span className="mock__m-burger"><i /><i /><i /></span>
    </div>
    <div className="mock__m-hero">
      <span className="mock__pill">Bản 2.0</span>
      <h1 className="mock__m-title">Thiết kế giao diện không cần dò pixel</h1>
      <p className="mock__m-sub">Nhìn – sửa – kiểm tra trên giao diện thật.</p>
      <span className="mock__m-cta">Bắt đầu miễn phí</span>
    </div>
    <div className="mock__m-cards">
      <span /><span /><span />
    </div>
  </div>
);

const CanvasArea = ({
  inserted = [],
  draggingPartId = null,
  onDropPart,
  mode: modeProp,
  onModeChange,
}: CanvasAreaProps) => {
  const [modeState, setModeState] = useState<CanvasMode>('live');
  const mode = modeProp ?? modeState;
  const setMode = (m: CanvasMode) => { setModeState(m); onModeChange?.(m); };
  const [tool, setTool] = useState<Tool>('select');
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [zoom, setZoom] = useState(100);
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  const [selected, setSelected] = useState<SelectionId | null>('heroTitle');
  const [showComments, setShowComments] = useState(true);
  const [activeComment, setActiveComment] = useState<number | null>(null);
  const [avail, setAvail] = useState({ w: 760, h: 560 });

  const stageRef = useRef<HTMLDivElement>(null);

  /* Tự canh vừa khung (fit) theo kích thước khu canvas */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setAvail({
        w: Math.max(140, Math.round(r.width) - 48),
        h: Math.max(140, Math.round(r.height) - 48 - 40),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const vp = VIEWPORTS.find((v) => v.key === viewport)!;
  const isMobile = viewport === 'mobile';
  const LOGICAL = isMobile ? { w: 390, h: 844 } : { w: 1440, h: 900 };

  const fitK = Math.min(avail.w / LOGICAL.w, avail.h / LOGICAL.h);
  const k = fitK * (zoom / 100);
  const displayW = LOGICAL.w * k;
  const displayH = LOGICAL.h * k;

  const zoomBy = (d: number) => setZoom((z) => Math.min(150, Math.max(25, z + d)));

  /* Chỉ một bảng nổi hiện tại một thời điểm: chọn phần tử → bảng thuộc tính,
     bấm ghim → thẻ bình luận */
  const pickElement = (id: SelectionId) => { setSelected(id); setActiveComment(null); };
  const pickComment = (id: number) => { setActiveComment(id); setSelected(null); };
  const clearAll = () => { setSelected(null); setActiveComment(null); };
  const showDiff = mode === 'diff';
  const rect = isMobile ? null : (selected ? SELECT_RECTS[selected] : null);
  /* Hệ số thu nhỏ từng khung khi so sánh song song */
  const compareK = (LOGICAL.w - 24) / 2 / LOGICAL.w;

  /* Lớp phủ trang trí: vùng lệch, vùng chọn, ghim bình luận */
  const deco = (
    <>
      {showDiff && (
        <div className="canvas__heat">
          <span className="heat heat--1" /><span className="heat heat--2" /><span className="heat heat--3" />
        </div>
      )}
      {rect && (
        <div
          className="sel"
          style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` }}
        >
          <span className="sel__tag">{rect.label}</span>
          <span className="sel__size">{rect.size}</span>
          {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((h) => (
            <span key={h} className={`sel__handle sel__handle--${h}`} />
          ))}
        </div>
      )}
      {showComments && !isMobile && COMMENTS.map((c) => (
        <button
          key={c.id}
          className={`pin ${c.status} ${activeComment === c.id ? 'active' : ''}`}
          style={{ left: `${c.x}%`, top: `${c.y}%` }}
          onClick={(e) => { e.stopPropagation(); pickComment(c.id); }}
        >
          {c.author}
        </button>
      ))}
    </>
  );

  const liveContent = (
    <>
      <MockSite variant="live" onPick={pickElement} selected={selected} parts={inserted} />
      {deco}
    </>
  );

  return (
    <main className="canvas">
      {/* ═════ Thanh công cụ vẽ ═════ */}
      <div className="canvas__tools">
        <div className="seg">
          {TOOLS.map((t, i) => (
            <button
              key={t.key}
              className={`seg__item ${tool === t.key ? 'active accent' : ''}`}
              onClick={() => setTool(t.key)}
              data-tooltip={`${t.label} · ${t.key_hint}`}
              data-tooltip-pos={i === 0 ? 'dl' : undefined}
            >
              <t.icon size={14} />
            </button>
          ))}
        </div>

        <div className="divider-v" />

        <button className="icon-btn canvas__tool-cam" data-tooltip="Chụp màn hình"><Camera size={15} /></button>
        <button
          className={`icon-btn canvas__tool-cmt ${showComments ? 'active' : ''}`}
          data-tooltip="Hiện/ẩn bình luận ghim"
          onClick={() => setShowComments((v) => !v)}
        >
          <MessageSquarePlus size={15} />
        </button>

        <div className="canvas__tools-spacer" />

        <button className="icon-btn canvas__zoom-out" data-tooltip="Thu nhỏ" onClick={() => zoomBy(-10)}><ZoomOut size={15} /></button>
        <button className="canvas__zoom" onClick={() => setZoom(100)}>{zoom}%</button>
        <button className="icon-btn canvas__zoom-in" data-tooltip="Phóng to" onClick={() => zoomBy(10)}><ZoomIn size={15} /></button>
        <button className="icon-btn" data-tooltip="Vừa khung" data-tooltip-pos="dr" onClick={() => setZoom(100)}><Maximize2 size={15} /></button>
      </div>

      {/* ═════ Thanh chế độ xem + khung ═════ */}
      <div className="canvas__modes">
        <div className="seg">
          {MODES.map((m, i) => (
            <button
              key={m.key}
              className={`seg__item ${mode === m.key ? 'active' : ''}`}
              onClick={() => setMode(m.key)}
              data-tooltip={m.label}
              data-tooltip-pos={i === 0 ? 'dl' : undefined}
            >
              <m.icon size={13} />
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        <div className="canvas__modes-spacer" />

        {mode === 'overlay' && (
          <div className="canvas__opacity">
            <span>Ảnh mẫu</span>
            <input
              type="range" min={0} max={100} value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(Number(e.target.value))}
              className="canvas__range"
            />
            <span>{100 - overlayOpacity}%</span>
          </div>
        )}
        {showDiff && (
          <div className="canvas__legend">
            <span className="canvas__legend-item"><i style={{ background: 'var(--color-error)' }} />Lệch nặng</span>
            <span className="canvas__legend-item"><i style={{ background: 'var(--color-warning)' }} />Lệch nhẹ</span>
            <span className="canvas__legend-item"><i style={{ background: 'var(--color-success)' }} />Khớp</span>
          </div>
        )}

        <div className="seg">
          {VIEWPORTS.map((v, i) => (
            <button
              key={v.key}
              className={`seg__item ${viewport === v.key ? 'active' : ''}`}
              onClick={() => setViewport(v.key)}
              data-tooltip={`${v.label} · ${v.w} × ${v.h}`}
              data-tooltip-pos={i === VIEWPORTS.length - 1 ? 'dr' : undefined}
            >
              <v.icon size={13} />
              <span className="canvas__vp-label">{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ═════ Sân khấu ═════ */}
      <div
        className={`canvas__stage ${draggingPartId ? 'is-dropping' : ''}`}
        ref={stageRef}
        onClick={clearAll}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('application/x-pixelmind-part')) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={(e) => {
          const id = e.dataTransfer.getData('application/x-pixelmind-part');
          if (!id) return;
          e.preventDefault();
          onDropPart?.(id);
        }}
      >
        {draggingPartId && (
          <div className="canvas__dropzone">
            <span className="canvas__dropzone-pill">
              <Package size={13} /> Thả để chèn part vào khung
            </span>
          </div>
        )}

        <div className="canvas__frame-wrap" onClick={(e) => e.stopPropagation()}>
          <div className="canvas__frame-bar">
            <span className="canvas__frame-url">
              <span className="canvas__live-dot" />
              localhost:5173<span className="canvas__frame-route">/</span>
            </span>
            <span className="canvas__frame-meta">{vp.w} × {vp.h}</span>
            <span className="canvas__frame-chip">
              <Check size={11} /> Đã đồng bộ code
            </span>
          </div>

          <div
            className={`canvas__frame ${isMobile ? 'is-mobile' : ''}`}
            style={{ width: displayW, height: displayH }}
          >
            {/* ── Live ── */}
            {mode === 'live' && (
              <div className="canvas__layer" style={{ width: LOGICAL.w, height: LOGICAL.h, transform: `scale(${k})` }}>
                {isMobile ? <MockMobile variant="live" /> : liveContent}
              </div>
            )}

            {/* ── Reference (ảnh mẫu) ── */}
            {mode === 'reference' && (
              <div className="canvas__layer" style={{ width: LOGICAL.w, height: LOGICAL.h, transform: `scale(${k})` }}>
                {isMobile
                  ? <MockMobile variant="wire" />
                  : <MockSite variant="wire" onPick={() => {}} selected={null} />}
              </div>
            )}

            {/* ── Compare ── */}
            {mode === 'compare' && (
              <div className="canvas__compare" style={{ width: LOGICAL.w, height: LOGICAL.h, transform: `scale(${k})` }}>
                <div className="canvas__compare-pane">
                  <div className="canvas__compare-tag"><ImageIcon size={12} /> ẢNH MẪU</div>
                  <div className="canvas__compare-body">
                    <div className="canvas__compare-scale" style={{ width: LOGICAL.w, height: LOGICAL.h, transform: `scale(${compareK})` }}>
                      {isMobile ? <MockMobile variant="wire" /> : <MockSite variant="wire" onPick={() => {}} selected={null} />}
                    </div>
                  </div>
                </div>
                <div className="canvas__compare-pane">
                  <div className="canvas__compare-tag live"><span className="canvas__live-dot" /> TRỰC TIẾP</div>
                  <div className="canvas__compare-body">
                    <div className="canvas__compare-scale" style={{ width: LOGICAL.w, height: LOGICAL.h, transform: `scale(${compareK})` }}>
                      {isMobile ? <MockMobile variant="live" /> : <MockSite variant="live" onPick={pickElement} selected={selected} parts={inserted} />}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Overlay ── */}
            {mode === 'overlay' && (
              <div className="canvas__layer" style={{ width: LOGICAL.w, height: LOGICAL.h, transform: `scale(${k})` }}>
                {isMobile ? <MockMobile variant="live" /> : <MockSite variant="live" onPick={pickElement} selected={selected} parts={inserted} />}
                <div className="canvas__overlay-img" style={{ opacity: overlayOpacity / 100 }}>
                  {isMobile ? <MockMobile variant="wire" /> : <MockSite variant="wire" onPick={() => {}} selected={null} />}
                </div>
                {!isMobile && deco}
              </div>
            )}

            {/* ── Diff ── */}
            {mode === 'diff' && (
              <div className="canvas__layer" style={{ width: LOGICAL.w, height: LOGICAL.h, transform: `scale(${k})` }}>
                {isMobile ? <MockMobile variant="live" /> : liveContent}
              </div>
            )}
          </div>
        </div>

        {/* ── Bảng thuộc tính nổi ── */}
        {rect && mode !== 'reference' && mode !== 'compare' && (
          <div className="canvas__props" onClick={(e) => e.stopPropagation()}>
            <span className="canvas__props-drag"><Move size={13} /></span>
            <div className="canvas__props-id">
              <span className="canvas__props-label">{rect.label}</span>
              <code className="canvas__props-sel">{rect.selector}</code>
            </div>
            <div className="canvas__props-fields">
              <label><span>W</span><input value={rect.size.split(' × ')[0]} readOnly /></label>
              <label><span>H</span><input value={rect.size.split(' × ')[1]} readOnly /></label>
              <label><span>Bo góc</span><input value="12" readOnly /></label>
              <label><span>Nền</span><input value="#7C6BFF" readOnly /></label>
            </div>
            <button className="canvas__props-ai">
              <Sparkles size={13} /> Nhờ AI sửa
            </button>
            <button className="icon-btn sm" onClick={clearAll}><X size={13} /></button>
          </div>
        )}

        {/* ── Thẻ bình luận ── */}
        {activeComment && showComments && !isMobile && !selected && (
          <div className="canvas__comment-card" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const c = COMMENTS.find((x) => x.id === activeComment)!;
              return (
                <>
                  <div className="canvas__comment-head">
                    <span className="canvas__comment-ava">{c.author}</span>
                    <div>
                      <div className="canvas__comment-name">Bình luận #{c.id}</div>
                      <div className="canvas__comment-time">2 giờ trước</div>
                    </div>
                    <span className={`badge ${c.status === 'done' ? 'badge-success' : 'badge-warning'}`}>
                      {c.status === 'done' ? 'Đã xong' : 'Đang mở'}
                    </span>
                    <button className="icon-btn sm" onClick={() => setActiveComment(null)}><X size={13} /></button>
                  </div>
                  <p className="canvas__comment-text">{c.text}</p>
                  <div className="canvas__comment-actions">
                    <button className="btn btn-sm" onClick={() => pickElement('ctaButton')}><Crosshair size={12} /> Xem phần tử</button>
                    <button className="btn btn-sm btn-primary"><Sparkles size={12} /> Chuyển thành lệnh AI</button>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* ── Nút Run nổi khi server tắt (demo) ── */}
        <div className="canvas__hint">
          <Play size={11} /> Kéo để pan · Ctrl+lăn chuột để zoom
        </div>
      </div>
    </main>
  );
};

export default CanvasArea;
