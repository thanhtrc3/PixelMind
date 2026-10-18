import { useMemo, useState } from 'react';
import { Calendar, Check, Download, Filter, Search, X } from 'lucide-react';
import { LOG } from '../../data/project';
import type { LogRow } from '../../data/project';
import '../../styles/Sections.css';

const KIND: Record<LogRow['kind'], { text: string; cls: string }> = {
  ai: { text: 'AI', cls: 'ac' },
  nguoi: { text: 'người', cls: 'plain' },
  'he-thong': { text: 'hệ thống', cls: 'info' },
};

const STATE: Record<LogRow['state'], { text: string; cls: string }> = {
  dat: { text: 'đạt', cls: 'ok' },
  'canh-bao': { text: 'cảnh báo', cls: 'warn' },
  loi: { text: 'lỗi', cls: 'err' },
  'dang-xu-ly': { text: 'đang xử lý', cls: 'info' },
};

type KindFilter = 'all' | LogRow['kind'];
type StateFilter = 'all' | LogRow['state'];

const KIND_FILTERS: { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'Mọi loại' },
  { id: 'ai', label: 'AI' },
  { id: 'nguoi', label: 'người' },
  { id: 'he-thong', label: 'hệ thống' },
];

const STATE_FILTERS: { id: StateFilter; label: string }[] = [
  { id: 'all', label: 'Mọi trạng thái' },
  { id: 'dat', label: 'đạt' },
  { id: 'canh-bao', label: 'cảnh báo' },
  { id: 'loi', label: 'lỗi' },
  { id: 'dang-xu-ly', label: 'đang xử lý' },
];

const LogPage = () => {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [state, setState] = useState<StateFilter>('all');
  const [toast, setToast] = useState<string | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LOG.filter((l) => {
      if (kind !== 'all' && l.kind !== kind) return false;
      if (state !== 'all' && l.state !== state) return false;
      if (!q) return true;
      return (
        l.who.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.target.toLowerCase().includes(q)
      );
    });
  }, [query, kind, state]);

  const reset = () => {
    setQuery('');
    setKind('all');
    setState('all');
  };

  return (
    <div className="scroll">
      {/* ── Đầu trang ── */}
      <div className="pg-hd">
        <div>
          <h1 className="tt">Nhật ký</h1>
          <p className="sub">
            Ai · làm gì · lúc nào. Nhật ký chỉ thêm — không sửa, không xóa, kể cả admin
          </p>
        </div>
        <div className="grow" />
        <span className="chip">
          <Calendar size={12} />
          01/10 – 17/10/2026
        </span>
        <button className="btn" onClick={reset}>
          <Filter size={12} /> Xoá lọc
        </button>
        <button
          className="btn"
          onClick={() => setToast(`Đã xuất ${list.length} bản ghi nhật ký ra nhat-ky.csv`)}
        >
          <Download size={12} /> Xuất CSV
        </button>
      </div>

      {/* ── Dòng lọc ── */}
      <div className="row wrap" style={{ gap: 8, marginBottom: 11 }}>
        <div style={{ position: 'relative', display: 'flex', flex: '1 1 240px', maxWidth: 300 }}>
          <Search size={13} className="dim" style={{ position: 'absolute', left: 9, top: 9 }} />
          <input
            className="inp"
            style={{ paddingLeft: 28 }}
            placeholder="Tìm theo người, hành động, đích…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {KIND_FILTERS.map((k) => (
          <button
            key={k.id}
            className={`chip ${kind === k.id ? 'ac' : ''}`}
            onClick={() => setKind(k.id)}
          >
            {k.id !== 'all' && <span className={`dot ${KIND[k.id].cls === 'plain' ? 'off' : KIND[k.id].cls}`} />}
            {k.label}
          </button>
        ))}
        <div className="sep" />
        {STATE_FILTERS.map((s) => (
          <button
            key={s.id}
            className={`chip ${state === s.id ? 'ac' : ''}`}
            onClick={() => setState(s.id)}
          >
            {s.id !== 'all' && <span className="dot" style={{ background: 'currentColor' }} />}
            {s.label}
          </button>
        ))}
        <div className="grow" />
        <span className="chip ac">{list.length} bản ghi</span>
      </div>

      {/* ── Bảng nhật ký ── */}
      <div className="card">
        <div className="card-bd tight">
          <table className="tb">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Thời gian</th>
                <th style={{ width: 170 }}>Người thực hiện</th>
                <th>Hành động</th>
                <th style={{ width: 100 }}>Loại</th>
                <th style={{ width: 130 }}>Đích</th>
                <th className="r" style={{ width: 120 }}>
                  Trạng thái
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((l) => {
                const k = KIND[l.kind];
                const s = STATE[l.state];
                return (
                  <tr key={`${l.time}-${l.action}`}>
                    <td className="mono">{l.time}</td>
                    <td>{l.who}</td>
                    <td className="muted">{l.action}</td>
                    <td>
                      <span className={`chip ${k.cls}`}>{k.text}</span>
                    </td>
                    <td className="mono">{l.target}</td>
                    <td className="r">
                      <span className={`chip ${s.cls}`}>{s.text}</span>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className="hint" style={{ padding: '18px 11px', textAlign: 'center' }}>
                    Không có bản ghi nào khớp bộ lọc. Bỏ lọc để xem toàn bộ nhật ký.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="card-bd" style={{ borderTop: '1px solid var(--line)' }}>
          <div className="row">
            <span className="hint">
              Hiện {list.length} / {LOG.length} bản ghi
            </span>
            <div className="grow" />
            <button className="btn sm" disabled>
              Trang trước
            </button>
            <button className="btn sm" disabled={list.length === LOG.length}>
              Trang sau
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

export default LogPage;
