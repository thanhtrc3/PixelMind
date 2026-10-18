import { useMemo, useState } from 'react';
import {
  BarChart3,
  Check,
  Clock,
  Download,
  Gauge,
  ListFilter,
  RotateCcw,
  Ticket as TicketIcon,
  X,
} from 'lucide-react';
import { CHECKS, PAGES, TICKETS } from '../../data/project';
import '../../styles/Sections.css';

const WEEK = [
  { d: 'T2', v: 3 },
  { d: 'T3', v: 5 },
  { d: 'T4', v: 2 },
  { d: 'T5', v: 6 },
  { d: 'T6', v: 4 },
  { d: 'T7', v: 1 },
  { d: 'CN', v: 2 },
];

const ReportPage = () => {
  const [month, setMonth] = useState('Tháng 10/2026');
  const [toast, setToast] = useState<string | null>(null);

  /* Tỉ lệ token sạch đọc thẳng từ các phiếu kiểm tra */
  const passSum = CHECKS.reduce((s, c) => s + c.pass, 0);
  const markSum = CHECKS.reduce((s, c) => s + c.total, 0);
  const clean = ((passSum / markSum) * 100).toFixed(1).replace('.', ',');
  const maxWeek = Math.max(...WEEK.map((w) => w.v));
  const totalRounds = WEEK.reduce((s, w) => s + w.v, 0);
  const doneTickets = TICKETS.filter((t) => t.state === 'xong').length;

  /* Bảng chia theo trang: ghép PAGES với CHECKS */
  const rows = useMemo(
    () =>
      PAGES.map((p) => {
        const cs = CHECKS.filter((c) => c.page === p.route);
        return {
          route: p.route,
          title: p.title,
          total: cs.length,
          pass: cs.filter((c) => c.state === 'dat').length,
          warn: cs.filter((c) => c.state === 'canh-bao').length,
          err: cs.filter((c) => c.state === 'loi').length,
        };
      }),
    [],
  );

  const kpis = [
    {
      t: 'Tỉ lệ token sạch',
      icon: <Gauge size={13} />,
      v: `${clean}%`,
      f: `${passSum}/${markSum} điểm kiểm tra đạt`,
    },
    {
      t: 'Vòng AI sửa trung bình',
      icon: <RotateCcw size={13} />,
      v: '2,1',
      f: 'Cao nhất PYC-014 · 3 vòng',
    },
    {
      t: 'Thời gian tiết kiệm',
      icon: <Clock size={13} />,
      v: '5,4 giờ',
      f: 'So với sửa tay cả 4 trang',
    },
    {
      t: 'Phiếu đã xong',
      icon: <TicketIcon size={13} />,
      v: doneTickets,
      f: `Trên ${TICKETS.length} phiếu trong tháng`,
    },
  ];

  return (
    <div className="scroll">
      {/* ── Đầu trang ── */}
      <div className="pg-hd">
        <div>
          <h1 className="tt">Báo cáo cuối tháng</h1>
          <p className="sub">
            Chỉ số và biểu đồ đơn giản để biết tháng này làm được gì, tắc ở đâu
          </p>
        </div>
        <div className="grow" />
        <select
          className="inp"
          style={{ maxWidth: 170 }}
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        >
          <option>Tháng 10/2026</option>
          <option>Tháng 9/2026</option>
        </select>
        <button
          className="btn"
          onClick={() => setToast(`Đã xuất báo cáo ${month} ra bao-cao.csv`)}
        >
          <Download size={12} /> Xuất CSV
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

      {/* ── Biểu đồ số lần AI sửa theo tuần ── */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-hd">
          <BarChart3 size={14} className="dim" />
          <b>Số lần AI sửa theo tuần</b>
          <span className="tag">7 ngày</span>
          <div className="grow" />
          <span className="hint">Tổng {totalRounds} lượt sửa trong tuần</span>
        </div>
        <div className="card-bd">
          <div className="chart">
            {WEEK.map((w) => (
              <div className="c" key={w.d}>
                <i
                  style={{
                    height: `${Math.round((w.v / maxWeek) * 100)}%`,
                    background:
                      w.v >= 5
                        ? 'linear-gradient(180deg, var(--warn), #a97f1f)'
                        : 'linear-gradient(180deg, var(--accent), #4b3fd6)',
                  }}
                />
                <span>
                  {w.d}
                  <br />
                  <b>{w.v}</b>
                </span>
              </div>
            ))}
          </div>
          <div className="legend" style={{ marginTop: 12 }}>
            <span>
              <i style={{ background: 'var(--accent)' }} />
              tuần thường (≤ 4 lượt)
            </span>
            <span>
              <i style={{ background: 'var(--warn)' }} />
              tuần tốn nhiều vòng (≥ 5 lượt)
            </span>
          </div>
        </div>
      </div>

      {/* ── Chia theo trang ── */}
      <div className="card">
        <div className="card-hd">
          <ListFilter size={14} className="dim" />
          <b>Kiểm tra chia theo trang</b>
          <div className="grow" />
          <span className="hint">Ghép danh sách trang với các phiếu kiểm tra</span>
        </div>
        <div className="card-bd tight">
          <table className="tb">
            <thead>
              <tr>
                <th style={{ width: 150 }}>Trang</th>
                <th>Tiêu đề</th>
                <th className="r" style={{ width: 140 }}>
                  Số lần kiểm tra
                </th>
                <th className="r" style={{ width: 100 }}>
                  Đạt
                </th>
                <th className="r" style={{ width: 110 }}>
                  Cảnh báo
                </th>
                <th className="r" style={{ width: 90 }}>
                  Lỗi
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.route}>
                  <td className="mono">{r.route}</td>
                  <td className="muted">{r.title}</td>
                  <td className="r mono">{r.total}</td>
                  <td className="r">
                    {r.pass > 0 ? <span className="chip ok">{r.pass}</span> : <span className="dim">—</span>}
                  </td>
                  <td className="r">
                    {r.warn > 0 ? <span className="chip warn">{r.warn}</span> : <span className="dim">—</span>}
                  </td>
                  <td className="r">
                    {r.err > 0 ? <span className="chip err">{r.err}</span> : <span className="dim">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

export default ReportPage;
