import { useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Check,
  FileCode2,
  History,
  Plus,
  Ticket as TicketIcon,
  X,
} from 'lucide-react';
import { PROJECT, TICKETS } from '../../data/project';
import type { Ticket } from '../../data/project';
import '../../styles/Sections.css';

const STATE_LABEL: Record<Ticket['state'], { text: string; cls: string }> = {
  'dang-xu-ly': { text: 'đang xử lý', cls: 'info' },
  'cho-duyet': { text: 'chờ duyệt', cls: 'warn' },
  'qua-han': { text: 'quá hạn', cls: 'err' },
  xong: { text: 'xong', cls: 'ok' },
};

/** Ba dòng thay đổi app đã ghi vào code cho phiếu PYC-014 */
const DIFF: { el: string; prop: string; cu: string; moi: string; file: string }[] = [
  { el: 'a.wlogin', prop: 'margin-left', cu: '8px', moi: '12px', file: 'Header.tsx' },
  { el: 'a.wlogin', prop: 'padding', cu: '7px 14px', moi: '8px 15px', file: 'Header.tsx' },
  { el: 'div.wlogo', prop: 'font-weight', cu: '700', moi: '800', file: 'index.css' },
];

const ROUNDS = [
  {
    t: 'Vòng 2 · AI sửa',
    when: '15:22',
    d: 'Đã khớp ảnh mẫu ở khung 1440, lệch 0,2%. Đang chờ người dùng quyết định.',
  },
  { t: 'Vòng 1 · AI sửa', when: '15:12', d: 'Sửa margin-left và padding, còn lệch 4px ở khung 1440.' },
  { t: 'Vòng 0 · Tạo phiếu', when: '14:40', d: 'BA ghi yêu cầu, app tạo checkpoint v2 trước khi sửa.' },
];

const TicketsPage = () => {
  const [selected, setSelected] = useState<string>(TICKETS[0].id);
  const [toast, setToast] = useState<string | null>(null);

  const ticket = TICKETS.find((t) => t.id === selected) ?? TICKETS[0];
  const st = STATE_LABEL[ticket.state];
  const doing = TICKETS.filter((t) => t.state === 'dang-xu-ly').length;
  const late = TICKETS.filter((t) => t.state === 'qua-han').length;
  const wait = TICKETS.filter((t) => t.state === 'cho-duyet').length;

  return (
    <div className="scroll">
      {/* ── Đầu trang ── */}
      <div className="pg-hd">
        <div>
          <div className="row" style={{ gap: 8 }}>
            <h1 className="tt">Phiếu yêu cầu</h1>
            <span className="chip info">
              <span className="dot info" />
              {doing} đang xử lý
            </span>
            <span className="chip err">
              <span className="dot err" />
              {late} quá hạn
            </span>
            <span className="chip warn">{wait} chờ duyệt</span>
          </div>
          <p className="sub">
            {PROJECT.name} · {TICKETS.length} phiếu · mỗi phiếu ghi rõ người nhận, hạn xử lý và phạm vi
            phần tử cần sửa
          </p>
        </div>
        <div className="grow" />
        <button
          className="btn"
          onClick={() => setSelected(TICKETS.find((t) => t.state === 'qua-han')?.id ?? TICKETS[0].id)}
        >
          <AlertTriangle size={12} /> Xem phiếu quá hạn
        </button>
        <button
          className="btn primary"
          onClick={() => setToast('Đã tạo PYC-015 — BA mô tả mong muốn rồi giao cho dev nhận việc')}
        >
          <Plus size={12} /> Tạo phiếu
        </button>
      </div>

      <div className="grid g2">
        {/* ── Danh sách phiếu ── */}
        <div className="card">
          <div className="card-hd">
            <TicketIcon size={14} className="dim" />
            <b>Danh sách phiếu</b>
            <span className="tag">{TICKETS.length} phiếu</span>
            <div className="grow" />
            <span className="hint">bấm một dòng để xem chi tiết</span>
          </div>
          <div className="card-bd tight">
            <table className="tb">
              <thead>
                <tr>
                  <th style={{ width: 72 }}>Mã</th>
                  <th>Nội dung</th>
                  <th style={{ width: 132 }}>Người nhận</th>
                  <th style={{ width: 52 }}>Hạn</th>
                  <th className="r" style={{ width: 96 }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {TICKETS.map((t) => {
                  const s = STATE_LABEL[t.state];
                  return (
                    <tr
                      key={t.id}
                      className={selected === t.id ? 'is-on' : ''}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelected(t.id)}
                    >
                      <td className="mono">{t.id}</td>
                      <td>
                        {t.title}
                        <div className="hint">{t.kind}</div>
                      </td>
                      <td>{t.who}</td>
                      <td className="mono">{t.due}</td>
                      <td className="r">
                        <span className={`chip ${s.cls}`}>{s.text}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Chi tiết phiếu đang chọn ── */}
        <div className="col" style={{ gap: 12 }}>
          <div className="card">
            <div className="card-hd">
              <TicketIcon size={14} className="dim" />
              <b>{ticket.id}</b>
              <span className={`chip ${st.cls}`}>{st.text}</span>
              <span className="tag">{ticket.kind}</span>
              <div className="grow" />
              <span className="hint">hạn {ticket.due}/2026</span>
            </div>
            <div className="card-bd" style={{ paddingTop: 6, paddingBottom: 6 }}>
              <div className="kv">
                <span className="k">Người nhận</span>
                <span>{ticket.who}</span>
              </div>
              <div className="kv">
                <span className="k">Phạm vi phần tử</span>
                <span className="mono">{ticket.scope}</span>
              </div>
              <div className="kv">
                <span className="k">Hạn xử lý</span>
                <span className="mono">{ticket.due}/2026</span>
              </div>
              <div className="kv">
                <span className="k">Trạng thái</span>
                <span className={`chip ${st.cls}`}>
                  <span className={`dot ${st.cls}`} />
                  {st.text}
                </span>
              </div>
              <div className="kv">
                <span className="k">Mô tả ngắn</span>
                <span>{ticket.brief}</span>
              </div>
            </div>
            <div
              className="card-bd"
              style={{ borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <button
                className="btn danger"
                onClick={() => setToast(`Đã từ chối ${ticket.id} — lý do được ghi vào nhật ký`)}
              >
                <Ban size={12} /> Từ chối
              </button>
              <button
                className="btn ok"
                onClick={() => setToast(`Đã đồng ý ${ticket.id} và lưu thay đổi vào Git`)}
              >
                <Check size={12} /> Đồng ý &amp; lưu Git
              </button>
              <div className="grow" />
              <span className="hint">checkpoint v2 · 77b0de1</span>
            </div>
          </div>

          <div className="card">
            <div className="card-hd">
              <History size={14} className="dim" />
              <b>Lịch sử vòng sửa</b>
              <div className="grow" />
              <span className="chip ac">2/3</span>
            </div>
            <div className="card-bd">
              <div className="tl">
                {ROUNDS.map((r, i) => (
                  <div className={`it ${i === 0 ? 'on' : ''}`} key={r.t}>
                    <div className="row" style={{ gap: 7 }}>
                      <b style={{ fontSize: 12 }}>{r.t}</b>
                      <div className="grow" />
                      <span className="hint">{r.when}</span>
                    </div>
                    <div className="hint">{r.d}</div>
                  </div>
                ))}
              </div>
              <hr className="hr" />
              <div className="row">
                <span className="hint">Quyết định cuối</span>
                <div className="grow" />
                <span className="chip warn">chưa chốt</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Chi tiết thay đổi app đã ghi vào code ── */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-hd">
          <FileCode2 size={14} className="dim" />
          <b>Chi tiết thay đổi đã ghi vào code</b>
          <div className="grow" />
          <span className="chip">{DIFF.length} dòng</span>
        </div>
        <div className="card-bd tight">
          <table className="tb">
            <thead>
              <tr>
                <th>Phần tử</th>
                <th>Thuộc tính</th>
                <th>Cũ</th>
                <th>Mới</th>
                <th>File bị sửa</th>
              </tr>
            </thead>
            <tbody>
              {DIFF.map((d) => (
                <tr key={`${d.el}-${d.prop}`}>
                  <td className="mono">{d.el}</td>
                  <td className="mono">{d.prop}</td>
                  <td className="mono">{d.cu}</td>
                  <td className="mono">{d.moi}</td>
                  <td className="mono">{d.file}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-bd" style={{ borderTop: '1px solid var(--line)' }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <span className="chip ok">
              <Check size={11} /> Không có 2 dòng cùng sửa một thuộc tính của một phần tử
            </span>
            <div className="grow" />
            <span className="hint">
              Mỗi thao tác là một checkpoint nhỏ nên Undo / Redo dùng được ngay.
            </span>
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

export default TicketsPage;
