import { useEffect, useMemo, useState } from 'react';
import {
  X, Search, Wand2, Package, ImageOff, Lock, EyeOff, TriangleAlert, Info,
  CircleCheck, Sparkle, Download, MousePointer2, ArrowRight, GripVertical,
  LayoutTemplate, Clock, Boxes, FileText, ExternalLink, Layers,
} from 'lucide-react';
import { PARTS, PART_MAP, GROUPS, STATUS_LABEL, matchesQuery } from '../data/toolbox';
import type { Part, PartStatus } from '../data/toolbox';
import '../styles/Toolbox.css';

/* ══════════════════════════════════════════════════════════════
   Search Toolbox — Thư viện part (mục 2.13 · CN12)

   · Gõ “search” là ra ngay nhóm part searchbox kèm ảnh để chọn
   · Kéo part vào canvas là app chèn code vào đúng file, sai thì Undo
   · Part thiếu ảnh preview hoặc chưa qua reviewer thì không kéo được
   · AI mặc định chỉ chép nguyên code mẫu, chỉ biến tấu khi cho phép
   ══════════════════════════════════════════════════════════════ */

type StatusFilter = 'all' | PartStatus | 'blocked';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'approved', label: 'Đã duyệt' },
  { key: 'pending', label: 'Chờ duyệt' },
  { key: 'hidden', label: 'Bị ẩn' },
  { key: 'blocked', label: 'Không kéo được' },
];

/* Từ khoá hay dùng — bấm là ra nhóm part tương ứng */
const PRESETS = ['search', 'card', 'button', 'form', 'navigation'];

const statusTone: Record<PartStatus, string> = {
  approved: 'badge-success',
  pending: 'badge-warning',
  hidden: 'badge-error',
};

interface ToolboxProps {
  isOpen: boolean;
  onClose: () => void;
  /** Kéo/thả hoặc bấm chèn part vào canvas */
  onInsert: (partId: string) => void;
  onDragStart: (partId: string) => void;
  onDragEnd: () => void;
  /** id các part đã chèn trong phiên làm việc */
  inserted: string[];
  /** id các part đang đính kèm vào yêu cầu AI */
  attached: string[];
  onToggleAttach: (partId: string) => void;
  /** id các part được phép cho AI biến tấu */
  variants: string[];
  onToggleVariant: (partId: string) => void;
  /** Từ khoá điền sẵn khi mở từ ô Search Toolbox trên sidebar */
  initialQuery?: string;
}

const Toolbox = ({
  isOpen, onClose, onInsert, onDragStart, onDragEnd,
  inserted, attached, onToggleAttach, variants, onToggleVariant,
  initialQuery = '',
}: ToolboxProps) => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [group, setGroup] = useState('all');
  const [selectedId, setSelectedId] = useState(PARTS[0]?.id ?? '');
  const [fileOpen, setFileOpen] = useState<string | null>('meta.json');
  const [dragging, setDragging] = useState<string | null>(null);

  /* Mở từ sidebar thì điền sẵn từ khoá người dùng vừa gõ */
  useEffect(() => {
    if (isOpen) setQuery(initialQuery);
  }, [isOpen, initialQuery]);

  const results = useMemo(
    () =>
      PARTS.filter((p) => {
        if (!matchesQuery(p, query)) return false;
        if (group !== 'all' && !p.groups.includes(group)) return false;
        if (status === 'blocked') return !p.draggable;
        if (status !== 'all' && p.status !== status) return false;
        return true;
      }),
    [query, group, status],
  );

  const current: Part | undefined =
    results.find((p) => p.id === selectedId) ?? results[0] ?? PART_MAP[selectedId];

  if (!isOpen) return null;

  const demoCount = PARTS.filter((p) => p.demo).length;
  const blockedCount = PARTS.filter((p) => !p.draggable).length;

  /** Bản xem trước 1 tệp HTML (nhúng luôn sample.css) — dùng cho tải về & mở rộng */
  const buildPreviewDoc = (part: Part) => `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>${part.name} — part ${part.id}</title>
<style>
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f5fb; font-family: system-ui, sans-serif; }
${part.css}
</style>
</head>
<body>
${part.html}
</body>
</html>`;

  const downloadPreview = (part: Part) => {
    const url = URL.createObjectURL(new Blob([buildPreviewDoc(part)], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${part.id}-preview.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openPreview = (part: Part) => {
    const url = URL.createObjectURL(new Blob([buildPreviewDoc(part)], { type: 'text/html' }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 20000);
  };

  const openFile = (name: string) => setFileOpen(fileOpen === name ? null : name);

  return (
    <div
      className={`tbx__overlay ${dragging ? 'is-dragging' : ''}`}
      onClick={onClose}
    >
      <div className="tbx slide-up" onClick={(e) => e.stopPropagation()}>
        {/* ── Đầu ── */}
        <header className="tbx__head">
          <span className="tbx__head-icon"><Wand2 size={17} /></span>
          <div className="tbx__head-text">
            <h2 className="tbx__title">Search Toolbox · Thư viện part</h2>
            <p className="tbx__sub">
              Thư viện part dùng chung của dự án · mỗi part là một thư mục 5 tệp
            </p>
          </div>

          <div className="tbx__stats">
            <span className="tbx__stat"><Package size={12} /> {PARTS.length} part</span>
            <span className="tbx__stat"><CircleCheck size={12} /> {demoCount} part demo</span>
            <span className="tbx__stat is-muted"><Lock size={12} /> {blockedCount} part không kéo được</span>
          </div>

          <button className="icon-btn" onClick={onClose} data-tooltip="Đóng · Esc" data-tooltip-pos="dr">
            <X size={16} />
          </button>
        </header>

        {/* ── Tìm kiếm ── */}
        <div className="tbx__search-row">
          <label className="tbx__search">
            <Search size={16} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && current?.draggable) {
                  e.preventDefault();
                  onInsert(current.id);
                  onClose();
                }
              }}
              placeholder="Gõ “search” để tìm part nhóm searchbox, hoặc tên part, tag, tác giả…"
            />
            {query ? (
              <button className="tbx__search-clear" onClick={() => setQuery('')} aria-label="Xoá tìm kiếm">
                <X size={13} />
              </button>
            ) : (
              <span className="tbx__search-hint">Enter để chèn part đang chọn</span>
            )}
          </label>

          <div className="tbx__presets">
            {PRESETS.map((p) => (
              <button
                key={p}
                className={`tbx__preset ${query === p ? 'is-on' : ''}`}
                onClick={() => { setQuery(p); setGroup('all'); setStatus('all'); }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* ── Lọc ── */}
        <div className="tbx__filters">
          <div className="seg tbx__seg">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s.key}
                className={`seg__item ${status === s.key ? 'active' : ''}`}
                onClick={() => setStatus(s.key)}
              >
                {s.label}
                <em className="tbx__seg-count">
                  {s.key === 'all'
                    ? PARTS.length
                    : s.key === 'blocked'
                      ? blockedCount
                      : PARTS.filter((p) => p.status === s.key).length}
                </em>
              </button>
            ))}
          </div>

          <div className="tbx__groups">
            <button
              className={`tbx__group ${group === 'all' ? 'is-on' : ''}`}
              onClick={() => setGroup('all')}
            >
              <Layers size={11} /> mọi nhóm
            </button>
            {GROUPS.map((g) => (
              <button
                key={g.key}
                className={`tbx__group ${group === g.key ? 'is-on' : ''}`}
                onClick={() => setGroup(group === g.key ? 'all' : g.key)}
              >
                {g.key}<em>{g.count}</em>
              </button>
            ))}
          </div>
        </div>

        {/* ── Thân ── */}
        <div className="tbx__body">
          <div className="tbx__grid-wrap">
            <div className="tbx__result-line">
              <span>
                <strong>{results.length}</strong> part khớp
                {query && <> với “{query}”</>}
                {group !== 'all' && <> trong nhóm <code className="tbx__code">{group}</code></>}
              </span>
              {dragging && (
                <span className="tbx__drag-note">
                  <MousePointer2 size={12} /> Đang kéo — thả vào khung bên canvas để chèn
                </span>
              )}
            </div>

            {results.length === 0 ? (
              <div className="tbx__empty">
                <Search size={18} />
                <p>Không có part nào khớp “{query}”.</p>
                <p className="tbx__empty-hint">Thử “search”, “card”, “button”, “form” hoặc chọn lại nhóm.</p>
              </div>
            ) : (
              <div className="tbx__grid">
                {results.map((p) => (
                  <button
                    key={p.id}
                    className={`tbx-card ${current?.id === p.id ? 'is-sel' : ''} ${p.draggable ? '' : 'is-blocked'}`}
                    draggable={p.draggable}
                    onDragStart={(e) => {
                      if (!p.draggable) { e.preventDefault(); return; }
                      e.dataTransfer.setData('application/x-pixelmind-part', p.id);
                      e.dataTransfer.effectAllowed = 'copy';
                      setDragging(p.id);
                      setSelectedId(p.id);
                      onDragStart(p.id);
                    }}
                    onDragEnd={() => { setDragging(null); onDragEnd(); }}
                    onClick={() => setSelectedId(p.id)}
                    data-tooltip={p.draggable ? 'Kéo vào canvas hoặc bấm để xem chi tiết' : p.blockReason}
                  >
                    <span className="tbx-card__thumb">
                      {p.preview ? (
                        <img src={p.preview} alt={`preview ${p.name}`} draggable={false} />
                      ) : (
                        <span className="tbx-card__nopreview">
                          <ImageOff size={18} />
                          <em>thiếu preview.png</em>
                        </span>
                      )}
                      {p.demo && <span className="tbx-card__demo">demo</span>}
                      {inserted.includes(p.id) && (
                        <span className="tbx-card__used"><CircleCheck size={11} /> đã chèn</span>
                      )}
                      {!p.draggable && (
                        <span className="tbx-card__lock">
                          {p.status === 'hidden' ? <EyeOff size={13} /> : p.locked ? <Lock size={13} /> : <TriangleAlert size={13} />}
                        </span>
                      )}
                      {p.draggable && (
                        <span className="tbx-card__grip"><GripVertical size={13} /></span>
                      )}
                    </span>

                    <span className="tbx-card__meta">
                      <span className="tbx-card__name">{p.name}</span>
                      <span className="tbx-card__groups">
                        {p.groups.slice(0, 3).map((g) => <em key={g}>{g}</em>)}
                        {p.groups.length > 3 && <em className="is-more">+{p.groups.length - 3}</em>}
                      </span>
                      <span className="tbx-card__foot">
                        <span className="tbx-card__ver">v{p.version}</span>
                        <span className={`badge ${statusTone[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Chi tiết part ── */}
          {current && (
            <aside className="tbx-det">
              <header className="tbx-det__head">
                <div>
                  <h3 className="tbx-det__name">{current.name}</h3>
                  <code className="tbx__code tbx-det__id">{current.id}</code>
                </div>
                <span className={`badge ${statusTone[current.status]}`}>{STATUS_LABEL[current.status]}</span>
              </header>

              <div className="tbx-det__preview">
                {current.preview ? (
                  <img src={current.preview} alt={`preview ${current.name}`} draggable={false} />
                ) : (
                  <div className="tbx-det__nopreview">
                    <ImageOff size={20} />
                    <span>Không có <code className="tbx__code">preview.png</code></span>
                    <em>Ảnh chụp nhỏ để lướt mắt chọn, khỏi phải đọc code.</em>
                  </div>
                )}
              </div>

              {current.blockReason ? (
                <div className="tbx-note tbx-note--warn">
                  <TriangleAlert size={13} />
                  <span>
                    <strong>Không kéo được vào khung.</strong> {current.blockReason}.
                    {' '}Theo mục 2.13, part thiếu ảnh preview hoặc chưa qua reviewer duyệt thì không được dùng.
                  </span>
                </div>
              ) : (
                <div className="tbx-note tbx-note--ok">
                  <CircleCheck size={13} />
                  <span>Đã qua reviewer duyệt, đủ 5 tệp — kéo thẳng vào khung được.</span>
                </div>
              )}

              {current.rejects > 0 && (
                <div className="tbx-note tbx-note--warn">
                  <Info size={13} />
                  <span>
                    Bị Ban kiểm thử từ chối <strong>{current.rejects} lần</strong> — sẽ được cộng vào Báo cáo tháng.
                  </span>
                </div>
              )}

              {/* Căn cước của part */}
              <dl className="tbx-det__meta">
                <div><dt>Nhóm</dt><dd>{current.groups.join(' · ')}</dd></div>
                <div><dt>Phiên bản</dt><dd>v{current.version} · cập nhật {current.updated}</dd></div>
                <div><dt>Dựa theo</dt><dd><code className="tbx__code">{current.designMd}</code></dd></div>
                <div><dt>Tác giả</dt><dd>{current.author}</dd></div>
                <div><dt>Nguồn gốc</dt><dd>{current.origin}</dd></div>
                <div><dt>Giấy phép</dt><dd>{current.license}</dd></div>
                <div className="is-row">
                  <dt>Lượt dùng</dt><dd>{current.uses}</dd>
                  <dt>Bị từ chối</dt><dd>{current.rejects}</dd>
                  <dt>Tags</dt><dd>{current.tags.length}</dd>
                </div>
              </dl>

              <div className="tbx-det__tags">
                {current.tags.map((t) => <span key={t} className="tbx-tag">{t}</span>)}
              </div>

              {/* 5 tệp trong part */}
              <div className="tbx-det__files-head">
                <LayoutTemplate size={12} /> <span>5 tệp trong thư mục part</span>
              </div>
              <ul className="tbx-files">
                {current.files.map((f) => (
                  <li key={f.name} className={fileOpen === f.name ? 'is-open' : ''}>
                    <button className="tbx-files__row" onClick={() => openFile(f.name)}>
                      <span className="tbx-files__ico">
                        {f.kind === 'image' ? <ImageOff size={12} /> : <FileText size={12} />}
                      </span>
                      <code className="tbx__code">{f.name}</code>
                      <span className="tbx-files__role">{f.role}</span>
                    </button>
                    {fileOpen === f.name && (
                      f.kind === 'image' ? (
                        <div className="tbx-files__img">
                          {current.preview
                            ? <img src={current.preview} alt="" draggable={false} />
                            : <em>Part này thiếu ảnh preview.png.</em>}
                        </div>
                      ) : (
                        <pre className="tbx-files__code">{f.body?.trim()}</pre>
                      )
                    )}
                  </li>
                ))}
              </ul>

              {/* Luật dùng cho AI */}
              <div className="tbx-ai">
                <div className="tbx-ai__row">
                  <span className="tbx-ai__label">
                    <Sparkle size={12} /> Cho phép AI biến tấu part này
                  </span>
                  <button
                    role="switch"
                    aria-checked={variants.includes(current.id)}
                    aria-label="Cho phép AI biến tấu"
                    className={`tbx-switch ${variants.includes(current.id) ? 'is-on' : ''}`}
                    onClick={() => onToggleVariant(current.id)}
                  >
                    <span className="tbx-switch__dot" />
                  </button>
                </div>
                <p className="tbx-ai__note">
                  AI mặc định chỉ <strong>chép nguyên code mẫu</strong>. Bật công tắc thì AI mới được
                  biến tấu theo yêu cầu, và chỉ dùng part trong kho đã duyệt.
                </p>
                <button
                  className={`btn btn-sm tbx-ai__attach ${attached.includes(current.id) ? 'is-on' : ''}`}
                  onClick={() => onToggleAttach(current.id)}
                  disabled={!current.draggable}
                >
                  {attached.includes(current.id)
                    ? <><CircleCheck size={12} /> Đã đính kèm vào yêu cầu AI</>
                    : <><ArrowRight size={12} /> Đính kèm prompt.txt + code vào yêu cầu AI</>}
                </button>
              </div>

              <div className="tbx-det__actions">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => { onInsert(current.id); onClose(); }}
                  disabled={!current.draggable}
                  data-tooltip={current.draggable ? undefined : current.blockReason}
                  data-tooltip-pos="top"
                >
                  <MousePointer2 size={12} /> Chèn vào canvas
                </button>
                <button className="btn btn-sm" onClick={() => downloadPreview(current)}>
                  <Download size={12} /> Tải bản xem trước
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => openPreview(current)}
                  data-tooltip="Mở bản xem trước trong tab mới"
                  data-tooltip-pos="top"
                >
                  <ExternalLink size={12} /> Mở rộng
                </button>
              </div>
            </aside>
          )}
        </div>

        {/* ── Chân ── */}
        <footer className="tbx__foot">
          <span className="tbx__foot-note">
            <Boxes size={12} />
            Kho tối thiểu 10 part · mỗi part thuộc 3–5 nhóm · thêm part mới chỉ cần tạo thư mục trong
            <code className="tbx__code">/toolbox</code>
          </span>
          <span className="tbx__foot-spacer" />
          <span className="tbx__foot-hint">
            <Clock size={12} /> Part hay bị từ chối được cộng vào Báo cáo tháng
          </span>
          <button className="btn btn-sm" onClick={onClose}>Đóng</button>
        </footer>
      </div>
    </div>
  );
};

export default Toolbox;
