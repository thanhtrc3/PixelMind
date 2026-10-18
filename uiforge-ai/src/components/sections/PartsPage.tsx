import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Check,
  Download,
  GripVertical,
  Info,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { GROUPS, PARTS, STATUS_LABEL, matchesQuery } from '../../data/toolbox';
import type { Part } from '../../data/toolbox';
import '../../styles/Sections.css';

type Props = {
  onInsert: (partId: string) => void;
  onDragStart: (partId: string) => void;
  onDragEnd: () => void;
  draggingId?: string | null;
  /** Số part đã kéo vào canvas trong phiên */
  insertedCount?: number;
};

const DETAIL_TABS = ['meta.json', 'sample.html', 'sample.css', 'prompt.txt'] as const;
type DetailTab = (typeof DETAIL_TABS)[number];

const STEPS = [
  '1 · Thu thập',
  '2 · Chuẩn hóa sang token',
  '3 · Duyệt',
  '4 · Kéo vào canvas',
  '5 · AI ghép theo brief',
];

const PartsPage = ({ onInsert, onDragStart, onDragEnd, draggingId, insertedCount = 0 }: Props) => {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string>('all');
  const [sort, setSort] = useState<'uses' | 'updated' | 'group'>('uses');
  const [detail, setDetail] = useState<Part | null>(null);
  const [tab, setTab] = useState<DetailTab>('meta.json');
  const [onlyDraggable, setOnlyDraggable] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const list = useMemo(() => {
    const base = PARTS.filter((p) => matchesQuery(p, query))
      .filter((p) => group === 'all' || p.groups.includes(group))
      .filter((p) => !onlyDraggable || p.draggable);
    const sorted = [...base];
    if (sort === 'uses') sorted.sort((a, b) => b.uses - a.uses);
    else if (sort === 'group') sorted.sort((a, b) => a.groups[0].localeCompare(b.groups[0]));
    else sorted.sort((a, b) => b.updated.localeCompare(a.updated));
    return sorted;
  }, [query, group, sort, onlyDraggable]);

  const approved = PARTS.filter((p) => p.draggable).length;
  const pending = PARTS.length - approved;
  const topUsed = [...PARTS].sort((a, b) => b.uses - a.uses).slice(0, 4);
  const maxUses = topUsed[0]?.uses ?? 1;
  const topRejected = [...PARTS].sort((a, b) => b.rejects - a.rejects).slice(0, 3);

  const openDetail = (p: Part) => {
    setDetail(p);
    setTab('meta.json');
  };

  const copyPrompt = (p: Part) => {
    setToast(`Đã chép prompt.txt của “${p.name}” — dán vào ô nhờ AI là ghép được ngay`);
  };

  return (
    <div className="scroll">
      {/* ── Đầu trang ── */}
      <div className="pg-hd">
        <div>
          <div className="row" style={{ gap: 8 }}>
            <h1 className="tt">Thư viện Part</h1>
            <span className="chip ok">
              <ShieldCheck size={11} />
              lint token: 11/11 sạch
            </span>
            <span className="chip">
              {approved}/{PARTS.length} part kéo được
            </span>
          </div>
          <p className="sub">
            Người chọn bằng mắt (preview) → máy hiểu bằng chữ (prompt.txt) → code làm cầu nối
            (HTML/CSS theo token chung) → AI ghép theo brief, Git đứng sau đỡ.
          </p>
        </div>
        <div className="grow" />
        <select
          className="inp"
          style={{ maxWidth: 190 }}
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
        >
          <option value="uses">Sắp xếp: dùng nhiều nhất</option>
          <option value="updated">Mới cập nhật</option>
          <option value="group">Theo nhóm</option>
        </select>
        <button className="btn" onClick={() => setToast('Mở hộp thoại thêm part — chọn 5 tệp rồi lưu vào kho')}>
          <Plus size={12} /> Thêm part
        </button>
        <button className="btn primary" onClick={() => setToast('Đã gửi brief cho AI: ghép 3 part thành 1 trang mới')}>
          <Sparkles size={12} /> Nhờ AI ghép part
        </button>
      </div>

      {/* ── Dải 5 bước của quy trình kho part ── */}
      <div className="row wrap" style={{ gap: 6, marginBottom: 12 }}>
        {STEPS.map((s, i) => (
          <span key={s} className="row" style={{ gap: 6 }}>
            <span className="chip" style={i === 3 ? { color: 'var(--accent-text)', borderColor: 'var(--accent-line)', background: 'var(--accent-soft)' } : undefined}>
              {s}
            </span>
            {i < STEPS.length - 1 && <span className="hint">→</span>}
          </span>
        ))}
      </div>

      {/* ── Thanh tìm + lọc ── */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-bd row wrap" style={{ gap: 10 }}>
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
            <Search
              size={13}
              style={{ position: 'absolute', left: 9, top: 9, color: 'var(--text-3)' }}
            />
            <input
              className="inp"
              style={{ paddingLeft: 28 }}
              placeholder="Tìm part: gõ 'search', 'bo tròn', 'card'…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="row wrap" style={{ gap: 5 }}>
            <button
              className={`chip ${group === 'all' ? 'ac' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setGroup('all')}
            >
              Tất cả · {PARTS.length}
            </button>
            {GROUPS.map((g) => (
              <button
                key={g.key}
                className={`chip ${group === g.key ? 'ac' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setGroup(g.key)}
              >
                {g.key} · {g.count}
              </button>
            ))}
          </div>
          <label className="cbx">
            <input
              type="checkbox"
              checked={onlyDraggable}
              onChange={(e) => setOnlyDraggable(e.target.checked)}
            />
            Chỉ part kéo được
          </label>
        </div>
      </div>

      {/* ── Lưới part ── */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(216px, 1fr))',
          gridAutoRows: 'max-content',
          marginBottom: 12,
        }}
      >
        {list.map((p) => {
          const dragging = draggingId === p.id;
          return (
            <article
              key={p.id}
              className={`pcard ${dragging ? 'dragging' : ''} ${p.draggable ? '' : 'blocked'}`}
              draggable={p.draggable}
              onDragStart={() => p.draggable && onDragStart(p.id)}
              onDragEnd={onDragEnd}
            >
              <div className="pv">
                {p.preview ? (
                  <img src={p.preview} alt={`Xem trước ${p.name}`} />
                ) : (
                  <span className="ph">thiếu preview.png</span>
                )}
                <span className="st">
                  {p.draggable ? (
                    <span className="chip ok">{STATUS_LABEL[p.status]}</span>
                  ) : (
                    <span className="chip warn">
                      <Lock size={9} />
                      {STATUS_LABEL[p.status]}
                    </span>
                  )}
                </span>
              </div>

              <div className="pb">
                <div className="row" style={{ gap: 6 }}>
                  <span className="nm grow">{p.name}</span>
                  <GripVertical size={13} className="dim" />
                </div>
                <div className="row wrap" style={{ gap: 4 }}>
                  {p.tags.slice(0, 3).map((t) => (
                    <span className="tag" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
                <span className="src">
                  Nguồn: {p.origin} · {p.version} · {p.groups[0]}/{p.id}
                </span>
                {p.blockReason ? (
                  <span className="hint" style={{ color: 'var(--color-warning-text)' }}>
                    <AlertTriangle size={10} style={{ verticalAlign: -1 }} /> {p.blockReason}
                  </span>
                ) : (
                  <span className="hint">
                    {p.uses} lượt kéo · {p.updated}
                  </span>
                )}
              </div>

              <div className="act">
                <button
                  className="btn sm primary grow"
                  disabled={!p.draggable}
                  title={p.blockReason ?? 'Kéo vào canvas để chèn code đúng token'}
                  onClick={() => {
                    if (!p.draggable) return;
                    onInsert(p.id);
                    setToast(`Đã chèn part “${p.name}” vào src/pages/Home.tsx — trang đã tải lại`);
                  }}
                >
                  <Download size={11} /> Kéo vào canvas
                </button>
                <button className="btn sm" onClick={() => openDetail(p)}>
                  prompt.txt
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {list.length === 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-bd" style={{ textAlign: 'center', padding: '34px 16px' }}>
            <Boxes size={22} style={{ color: 'var(--text-3)' }} />
            <div style={{ marginTop: 8, fontSize: 12.5 }}>Không có part nào khớp “{query}”</div>
            <span className="hint">Thử gõ “search”, “bo tròn”, “card” hoặc bỏ lọc nhóm.</span>
          </div>
        </div>
      )}

      {/* ── Luật cứng + số liệu dùng ── */}
      <div className="grid g2">
        <div className="card">
          <div className="card-hd">
            <ShieldCheck size={14} className="dim" />
            <b>Luật cứng của kho</b>
            <span className="tag">{approved} part kéo được</span>
          </div>
          <div className="card-bd" style={{ paddingTop: 8, paddingBottom: 8 }}>
            {[
              ['Thiếu ảnh preview', 'không cho kéo vào canvas'],
              ['Chưa qua reviewer duyệt', 'không cho kéo vào canvas'],
              ['Part bị khoá', 'chỉ xem, không kéo ra ngoài kho'],
              ['Part bị ẩn', 'không hiện trong lưới mặc định'],
            ].map(([a, b]) => (
              <div className="kv" key={a}>
                <span className="k" style={{ width: 168 }}>{a}</span>
                <span className="hint" style={{ fontSize: 12 }}>{b}</span>
              </div>
            ))}
            <div className="strk info" style={{ marginTop: 10 }}>
              <Info size={14} style={{ flex: 'none', marginTop: 1 }} />
              <span>
                Đang có <b>{pending}</b> part chờ duyệt. Part chưa duyệt vẫn xem và chép prompt được,
                nhưng chưa dùng để chèn code.
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-hd">
            <Sparkles size={14} className="dim" />
            <b>Part dùng nhiều</b>
            <div className="grow" />
            <span className="hint">phiên này: {insertedCount} lượt kéo</span>
          </div>
          <div className="card-bd" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topUsed.map((p) => (
              <div key={p.id}>
                <div className="row" style={{ gap: 8 }}>
                  <span className="grow" style={{ fontSize: 12 }}>{p.name}</span>
                  <span className="num hint">{p.uses} lượt kéo</span>
                </div>
                <div className="row" style={{ gap: 8, marginTop: 5 }}>
                  <span className="bar">
                    <i style={{ width: `${Math.round((p.uses / maxUses) * 100)}%`, background: 'var(--accent)' }} />
                  </span>
                  <span className="tag">{p.groups[0]}</span>
                </div>
              </div>
            ))}
            <hr className="hr" style={{ margin: '2px 0' }} />
            <div className="lbl">Bị từ chối nhiều</div>
            {topRejected.map((p) => (
              <div className="row" key={p.id} style={{ gap: 8 }}>
                <span className="grow" style={{ fontSize: 12 }}>{p.name}</span>
                <span className="chip err">{p.rejects} lần</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Hộp thoại chi tiết part ── */}
      <div className={`modal ${detail ? 'on' : ''}`} onClick={() => setDetail(null)}>
        <div className="dlg" style={{ width: 860 }} onClick={(e) => e.stopPropagation()}>
          {detail && (
            <>
              <div className="dlg-hd">
                <Boxes size={16} style={{ color: 'var(--accent-2)' }} />
                <b>{detail.name}</b>
                <span className="tag">{detail.id}</span>
                <span className={`chip ${detail.draggable ? 'ok' : 'warn'}`}>
                  {STATUS_LABEL[detail.status]}
                </span>
                <div className="grow" />
                <span className="hint">
                  {detail.uses} lượt kéo · {detail.rejects} lần bị từ chối
                </span>
                <button className="ibtn sm" onClick={() => setDetail(null)}>
                  <X size={15} />
                </button>
              </div>

              <div className="dlg-bd" style={{ padding: 0 }}>
                <div className="split" style={{ border: 0, borderRadius: 0, borderBottom: '1px solid var(--line)' }}>
                  <div style={{ background: '#f6f7fb', display: 'grid', placeItems: 'center', minHeight: 220 }}>
                    {detail.preview ? (
                      <img
                        src={detail.preview}
                        alt={`Xem trước ${detail.name}`}
                        style={{ maxWidth: '78%', maxHeight: 200, objectFit: 'contain' }}
                      />
                    ) : (
                      <span className="hint">Thiếu ảnh preview.png</span>
                    )}
                  </div>
                  <div>
                    <div className="row wrap" style={{ gap: 4, marginBottom: 9 }}>
                      {detail.tags.map((t) => (
                        <span className="tag" key={t}>{t}</span>
                      ))}
                    </div>
                    <div className="kv"><span className="k" style={{ width: 92 }}>Nhóm</span><span>{detail.groups.join(' · ')}</span></div>
                    <div className="kv"><span className="k" style={{ width: 92 }}>Phiên bản</span><span className="mono">{detail.version}</span></div>
                    <div className="kv"><span className="k" style={{ width: 92 }}>Tác giả</span><span>{detail.author}</span></div>
                    <div className="kv"><span className="k" style={{ width: 92 }}>Nguồn</span><span>{detail.origin}</span></div>
                    <div className="kv"><span className="k" style={{ width: 92 }}>Giấy phép</span><span>{detail.license}</span></div>
                    <div className="kv"><span className="k" style={{ width: 92 }}>DESIGN.md</span><span className="mono">{detail.designMd}</span></div>
                    {detail.note && (
                      <div className="strk warn" style={{ marginTop: 9 }}>
                        <AlertTriangle size={13} style={{ flex: 'none', marginTop: 1 }} />
                        <span>{detail.note}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ padding: '0 0 0' }}>
                  <div className="utabs" style={{ padding: '0 12px' }}>
                    {DETAIL_TABS.map((t) => (
                      <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <div style={{ padding: 12, background: 'var(--bg-inset)' }}>
                    <span className="hint" style={{ display: 'block', marginBottom: 8 }}>
                      {detail.files.find((f) => f.name === tab)?.role}
                    </span>
                    <pre className="code" style={{ maxHeight: 260 }}>
                      {tab === 'meta.json'
                        ? detail.metaText
                        : tab === 'sample.html'
                          ? detail.html
                          : tab === 'sample.css'
                            ? detail.css
                            : detail.prompt}
                    </pre>
                  </div>
                </div>
              </div>

              <div className="dlg-ft">
                <span className="hint grow">
                  5 tệp đúng chuẩn: meta.json · preview.png · sample.html · sample.css · prompt.txt
                </span>
                <button className="btn" onClick={() => copyPrompt(detail)}>
                  <Check size={12} /> Chép prompt
                </button>
                <button
                  className="btn primary"
                  disabled={!detail.draggable}
                  title={detail.blockReason}
                  onClick={() => {
                    onInsert(detail.id);
                    setDetail(null);
                  }}
                >
                  <Download size={12} /> Kéo vào canvas
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {toast && (
        <div className="sec-toast slide-up" role="status">
          <Check size={13} />
          <span className="grow">{toast}</span>
          <button className="ibtn sm" onClick={() => setToast(null)}>
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
};

export default PartsPage;
