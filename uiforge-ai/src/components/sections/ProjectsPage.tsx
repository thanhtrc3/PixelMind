import { useMemo, useState } from 'react';
import {
  Check,
  Clock,
  FileStack,
  Files,
  FolderOpen,
  GitBranch,
  Image as ImageIcon,
  LayoutTemplate,
  PanelLeft,
  Play,
  Plus,
  Ticket as TicketIcon,
  Trash2,
  X,
} from 'lucide-react';
import { LOG, PAGES, PROJECT, VERSIONS } from '../../data/project';
import type { Page } from '../../data/project';
import type { SectionId } from '../../data/sections';
import '../../styles/Sections.css';

const STATE_LABEL: Record<string, { text: string; cls: string }> = {
  'cho-duyet': { text: 'chờ duyệt', cls: 'warn' },
  'da-duyet': { text: 'đã duyệt', cls: 'ok' },
  'tu-choi': { text: 'từ chối', cls: 'err' },
  'dang-xu-ly': { text: 'đang xử lý', cls: 'info' },
  'qua-han': { text: 'quá hạn', cls: 'err' },
  xong: { text: 'xong', cls: 'ok' },
  dat: { text: 'đạt', cls: 'ok' },
  'canh-bao': { text: 'cảnh báo', cls: 'warn' },
  loi: { text: 'lỗi', cls: 'err' },
  ai: { text: 'AI', cls: 'ac' },
  nguoi: { text: 'người', cls: 'plain' },
  'he-thong': { text: 'hệ thống', cls: 'info' },
};

type Props = {
  onSection: (id: SectionId) => void;
};

const ProjectsPage = ({ onSection }: Props) => {
  const [pages, setPages] = useState<Page[]>(PAGES);
  const [selected, setSelected] = useState<string>('p1');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ route: '', title: '', template: 'Không dùng', frame: '1440×900' });
  const [toast, setToast] = useState<string | null>(null);

  const withRef = pages.filter((p) => p.ref === 'co').length;
  const pendingVersion = VERSIONS.find((v) => v.state === 'cho-duyet') ?? VERSIONS[0];
  const openTickets = 5;

  const submit = () => {
    const route = form.route.trim() || '/trang-moi';
    const clean = route.startsWith('/') ? route : `/${route}`;
    const next: Page = {
      id: `p${Date.now()}`,
      route: clean,
      title: form.title.trim() || 'Trang mới',
      ref: 'khong',
      software: '—',
      frame: form.frame,
      note: 'không bắt buộc',
    };
    setPages((prev) => [...prev, next]);
    setSelected(next.id);
    setAddOpen(false);
    setForm({ route: '', title: '', template: 'Không dùng', frame: '1440×900' });
    setToast(`Đã thêm trang “${next.title}” (${clean}) — canvas chạy ở chế độ Live`);
  };

  const remove = (id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
    if (selected === id) setSelected('');
  };

  /* Số liệu KPI đọc từ chính bảng trang + phiên bản */
  const kpis = useMemo(
    () => [
      {
        t: 'Trang',
        icon: <Files size={13} />,
        v: String(pages.length),
        f: `${withRef} trang có ảnh mẫu`,
      },
      {
        t: 'Phiên bản',
        icon: <GitBranch size={13} />,
        v: VERSIONS.length,
        f: `${pendingVersion.tag} → ${pendingVersion.hash} chờ duyệt`,
      },
      {
        t: 'Phiếu yêu cầu',
        icon: <TicketIcon size={13} />,
        v: openTickets,
        f: '1 đang xử lý · 1 quá hạn',
      },
      {
        t: 'Ảnh mẫu',
        icon: <ImageIcon size={13} />,
        v: withRef,
        f: 'Figma 1440×900 · Photoshop 390×844',
      },
    ],
    [pages.length, withRef, pendingVersion],
  );

  return (
    <div className="scroll">
      {/* ── Đầu trang ── */}
      <div className="pg-hd">
        <div>
          <div className="row" style={{ gap: 8 }}>
            <h1 className="tt">{PROJECT.name}</h1>
            <span className="chip info">{PROJECT.stack}</span>
            <span className="chip ok">
              <span className="dot ok" />
              dev server :3000
            </span>
          </div>
          <p className="sub">
            {PROJECT.folder} · chủ dự án: {PROJECT.owner} · tạo {PROJECT.created} ·{' '}
            <span className="mono">{PROJECT.repo}</span>
          </p>
        </div>
        <div className="grow" />
        <button className="btn" onClick={() => setToast(`Đã mở thư mục ${PROJECT.folder}`)}>
          <FolderOpen size={12} /> Mở thư mục
        </button>
        <button className="btn" onClick={() => setToast('Đang chạy dev server ở localhost:3000')}>
          <Play size={12} /> Run
        </button>
        <button className="btn primary" onClick={() => onSection('work')}>
          <PanelLeft size={12} /> Mở màn hình làm việc
        </button>
      </div>

      {/* ── Bốn thẻ số liệu ── */}
      <div className="grid g4" style={{ marginBottom: 12 }}>
        {kpis.map((k) => (
          <div className="kpi" key={k.t}>
            <div className="t">
              {k.icon}
              {k.t}
            </div>
            <div className="v">{k.v}</div>
            <div className="f">{k.f}</div>
          </div>
        ))}
      </div>

      {/* ── Trang và ảnh mẫu ── */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-hd">
          <Files size={14} className="dim" />
          <b>Trang và ảnh mẫu</b>
          <span className="tag">{pages.length} trang</span>
          <div className="grow" />
          <span className="hint">Ảnh mẫu không bắt buộc</span>
          <button className="btn primary" onClick={() => setAddOpen(true)}>
            <Plus size={12} /> Thêm trang
          </button>
        </div>
        <div className="card-bd tight">
          <table className="tb">
            <thead>
              <tr>
                <th style={{ width: 40 }} />
                <th>Route</th>
                <th>Tiêu đề</th>
                <th>Ảnh mẫu</th>
                <th>Phần mềm</th>
                <th>Khung</th>
                <th className="r" style={{ width: 56 }} />
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr
                  key={p.id}
                  className={selected === p.id ? 'is-on' : ''}
                  onClick={() => setSelected(p.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <span className={`dot ${selected === p.id ? 'ac' : 'off'}`} />
                  </td>
                  <td className="mono">{p.route}</td>
                  <td>
                    {p.title}
                    {p.id === 'p1' && <span className="tag" style={{ marginLeft: 6 }}>trang gốc</span>}
                  </td>
                  <td>
                    {p.ref === 'co' ? (
                      <span className="chip ok">có</span>
                    ) : (
                      <span className="hint">không bắt buộc</span>
                    )}
                  </td>
                  <td className={p.software === '—' ? 'dim' : ''}>{p.software}</td>
                  <td className="mono">{p.frame}</td>
                  <td className="r">
                    {p.id !== 'p1' && (
                      <button
                        className="ibtn sm"
                        title="Xoá trang"
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(p.id);
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-bd" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <div className="strk info">
            <ImageIcon size={14} style={{ flex: 'none', marginTop: 1 }} />
            <span>
              Ảnh mẫu không bắt buộc. Không có ảnh thì canvas vẫn chạy ở chế độ <b>Live</b> và so
              sánh theo DOM.
            </span>
          </div>
        </div>
      </div>

      {/* ── Hai cột: phiên bản + thông tin dự án ── */}
      <div className="grid g2">
        <div className="card">
          <div className="card-hd">
            <GitBranch size={14} className="dim" />
            <b>Phiên bản</b>
            <div className="grow" />
            <button className="btn sm" onClick={() => onSection('versions')}>
              Xem tất cả
            </button>
          </div>
          <div className="card-bd">
            <div className="tl">
              {VERSIONS.slice(0, 3).map((v, i) => {
                const s = STATE_LABEL[v.state];
                return (
                  <div className={`it ${i === 0 ? 'on' : ''}`} key={v.id}>
                    <div className="row" style={{ gap: 7 }}>
                      <b style={{ fontSize: 12.5 }}>{v.tag}</b>
                      <span className={`chip ${s.cls}`}>{s.text}</span>
                      <span className="mono dim">{v.hash}</span>
                      <div className="grow" />
                      <span className="hint">{v.when}</span>
                    </div>
                    <div className="hint" style={{ marginTop: 3 }}>
                      {v.what} · {v.by}
                      {v.ticket ? ` · ${v.ticket}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-hd">
            <LayoutTemplate size={14} className="dim" />
            <b>Thông tin dự án</b>
          </div>
          <div className="card-bd" style={{ paddingTop: 6, paddingBottom: 6 }}>
            <div className="kv">
              <span className="k">Mã dự án</span>
              <span className="mono">{PROJECT.code}</span>
            </div>
            <div className="kv">
              <span className="k">Thư mục code</span>
              <span className="mono">{PROJECT.folder}</span>
            </div>
            <div className="kv">
              <span className="k">Loại công nghệ</span>
              <span>{PROJECT.stack} (tự nhận ra khi mở thư mục)</span>
            </div>
            <div className="kv">
              <span className="k">Dev server</span>
              <span>{PROJECT.devServer} · tự tải lại khi code đổi</span>
            </div>
            <div className="kv">
              <span className="k">Kho GitHub</span>
              <span className="mono">{PROJECT.repo}</span>
            </div>
            <div className="kv">
              <span className="k">Người đứng tên</span>
              <span>{PROJECT.owner}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Hoạt động gần đây ── */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-hd">
          <Clock size={14} className="dim" />
          <b>Hoạt động gần đây</b>
          <div className="grow" />
          <button className="btn sm" onClick={() => onSection('log')}>
            Mở nhật ký
          </button>
        </div>
        <div className="card-bd tight">
          <table className="tb">
            <tbody>
              {LOG.slice(0, 4).map((l) => {
                const s = STATE_LABEL[l.state];
                const k = STATE_LABEL[l.kind];
                return (
                  <tr key={l.time}>
                    <td className="mono" style={{ width: 110 }}>{l.time}</td>
                    <td style={{ width: 150 }}>{l.who}</td>
                    <td>{l.action}</td>
                    <td style={{ width: 90 }}>
                      <span className={`chip ${k.cls}`}>{k.text}</span>
                    </td>
                    <td className="r" style={{ width: 110 }}>
                      <span className={`chip ${s.cls}`}>{s.text}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Hộp thoại Thêm trang ── */}
      <div className={`modal ${addOpen ? 'on' : ''}`} onClick={() => setAddOpen(false)}>
        <div className="dlg" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
          <div className="dlg-hd">
            <FileStack size={16} style={{ color: 'var(--accent-2)' }} />
            <b>Thêm trang</b>
            <div className="grow" />
            <button className="ibtn sm" onClick={() => setAddOpen(false)}>
              <X size={15} />
            </button>
          </div>
          <div className="dlg-bd">
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label className="lbl">Đường dẫn (route) *</label>
                <input
                  className="inp mono"
                  placeholder="/san-pham"
                  value={form.route}
                  autoFocus
                  onChange={(e) => setForm({ ...form, route: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                />
              </div>
              <div className="field">
                <label className="lbl">Tiêu đề</label>
                <input
                  className="inp"
                  placeholder="Danh sách sản phẩm"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                />
              </div>
              <div className="field">
                <label className="lbl">Bắt đầu từ template</label>
                <select
                  className="inp"
                  value={form.template}
                  onChange={(e) => setForm({ ...form, template: e.target.value })}
                >
                  <option>Không dùng</option>
                  <option>landing</option>
                  <option>dashboard</option>
                  <option>mobile</option>
                </select>
              </div>
              <div className="field">
                <label className="lbl">Khung xem mặc định</label>
                <select
                  className="inp"
                  value={form.frame}
                  onChange={(e) => setForm({ ...form, frame: e.target.value })}
                >
                  <option>1440×900</option>
                  <option>768×1024</option>
                  <option>390×844</option>
                </select>
              </div>
            </div>

            <hr className="hr" />

            <div className="field">
              <label className="lbl">Ảnh mẫu cho trang (không bắt buộc)</label>
              <div className="drop">
                <ImageIcon size={18} style={{ color: 'var(--text-3)' }} />
                <b style={{ fontSize: 12.5 }}>Kéo ảnh mẫu vào đây</b>
                <span className="hint">PNG / JPG — khung tự nhận theo kích thước ảnh</span>
              </div>
            </div>

            <div className="strk info" style={{ marginTop: 12 }}>
              <Check size={14} style={{ flex: 'none', marginTop: 1 }} />
              <span>
                Thêm trang xong, phần tử trên trang <b>tự có token</b> của design system. Không có
                ảnh mẫu thì so sánh theo DOM.
              </span>
            </div>
          </div>
          <div className="dlg-ft">
            <span className="hint grow">
              Trang mới sẽ được thêm vào dự án <b>{PROJECT.name}</b>
            </span>
            <button className="btn" onClick={() => setAddOpen(false)}>
              Huỷ
            </button>
            <button className="btn primary" onClick={submit}>
              <Plus size={12} /> Thêm trang
            </button>
          </div>
        </div>
      </div>

      {/* ── Thông báo nhỏ ── */}
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

export default ProjectsPage;
