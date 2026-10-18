import { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  Gauge,
  ListChecks,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import { CHECKS, PROJECT } from '../../data/project';
import type { Check as CheckRun } from '../../data/project';
import '../../styles/Sections.css';

const STATE_LABEL: Record<CheckRun['state'], { text: string; cls: string; color: string }> = {
  dat: { text: 'đạt', cls: 'ok', color: 'var(--ok)' },
  'canh-bao': { text: 'cảnh báo', cls: 'warn', color: 'var(--warn)' },
  loi: { text: 'lỗi', cls: 'err', color: 'var(--err)' },
  'dang-xu-ly': { text: 'đang xử lý', cls: 'info', color: 'var(--info)' },
};

/** So sánh DOM theo từng thuộc tính của lần kiểm tra gần nhất */
const DOM_DIFF: { prop: string; expect: string; real: string; ok: boolean }[] = [
  { prop: 'Vị trí', expect: 'x=1246 y=13', real: 'x=1250 y=13', ok: false },
  { prop: 'Kích thước', expect: '96×34', real: '96×34', ok: true },
  { prop: 'Khoảng cách', expect: '16px', real: '16px', ok: true },
  { prop: 'Màu', expect: '#4F46E5', real: '#4F46E5', ok: true },
  { prop: 'Chữ', expect: 'Inter 12.5', real: 'Inter 14', ok: false },
  { prop: 'Bo góc', expect: '8px', real: '8px', ok: true },
];

const ChecksPage = () => {
  const [toast, setToast] = useState<string | null>(null);

  const count = (s: CheckRun['state']) => CHECKS.filter((c) => c.state === s).length;
  const totalToken = CHECKS.reduce((a, c) => a + c.total, 0);
  const passToken = CHECKS.reduce((a, c) => a + c.pass, 0);
  const clean = Math.round((passToken / totalToken) * 100);

  const kpis = [
    { t: 'Đạt', icon: <Check size={13} />, v: String(count('dat')), f: 'KT-018 · 11/11 token sạch' },
    {
      t: 'Cảnh báo',
      icon: <AlertTriangle size={13} />,
      v: String(count('canh-bao')),
      f: 'KT-017 · sai cỡ chữ nav.wlinks',
    },
    { t: 'Lỗi', icon: <X size={13} />, v: String(count('loi')), f: 'KT-016 · tràn chữ 42px ở khung 390' },
    {
      t: 'Đang xử lý',
      icon: <RefreshCw size={13} />,
      v: String(count('dang-xu-ly')),
      f: 'KT-014 · đang quét lại sau khi ghép part',
    },
  ];

  return (
    <div className="scroll">
      {/* ── Đầu trang ── */}
      <div className="pg-hd">
        <div>
          <div className="row" style={{ gap: 8 }}>
            <h1 className="tt">Phiếu kiểm tra</h1>
            <span className="chip info">KT-018 · mới nhất</span>
            <span className="chip ok">
              <span className="dot ok" />
              {clean}% token sạch
            </span>
          </div>
          <p className="sub">
            {PROJECT.name} · app tự chạy lại, chụp ảnh và so sánh sau mỗi lần sửa — tester ghi lại chỗ
            sai và mức độ
          </p>
        </div>
        <div className="grow" />
        <button
          className="btn"
          onClick={() => setToast('Đang chạy lại kiểm tra token cho 4 trang của ShopWeb…')}
        >
          <RefreshCw size={12} /> Chạy kiểm tra lại
        </button>
        <button
          className="btn primary"
          onClick={() => setToast('Đã tạo phiếu kiểm tra KT-019 cho khung 1440×900')}
        >
          <Plus size={12} /> Tạo phiếu kiểm tra
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

      <div className="grid g2">
        {/* ── Các lần kiểm tra token ── */}
        <div className="card">
          <div className="card-hd">
            <ListChecks size={14} className="dim" />
            <b>Các lần kiểm tra token</b>
            <span className="tag">{CHECKS.length} lần</span>
            <div className="grow" />
            <span className="chip">
              <Calendar size={11} /> 17/10/2026
            </span>
          </div>
          <div className="card-bd tight">
            <table className="tb">
              <thead>
                <tr>
                  <th style={{ width: 68 }}>Mã</th>
                  <th>Trang</th>
                  <th style={{ width: 130 }}>Token đạt</th>
                  <th style={{ width: 104 }}>Khi nào</th>
                  <th className="r" style={{ width: 96 }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {CHECKS.map((c) => {
                  const s = STATE_LABEL[c.state];
                  return (
                    <tr key={c.id}>
                      <td className="mono">{c.id}</td>
                      <td>
                        <span className="mono">{c.page}</span>
                        <div className="hint">{c.note}</div>
                      </td>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <span className="bar">
                            <i
                              style={{
                                width: `${Math.round((c.pass / c.total) * 100)}%`,
                                background: s.color,
                              }}
                            />
                          </span>
                          <span className="mono dim">
                            {c.pass}/{c.total}
                          </span>
                        </div>
                      </td>
                      <td className="mono">{c.when}</td>
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

        {/* ── Biểu đồ + điểm tự kiểm tra ── */}
        <div className="col" style={{ gap: 12 }}>
          <div className="card">
            <div className="card-hd">
              <Gauge size={14} className="dim" />
              <b>Tỉ lệ token sạch theo lần chạy</b>
              <div className="grow" />
              <span className="hint">
                {passToken}/{totalToken} token
              </span>
            </div>
            <div className="card-bd">
              <div className="chart">
                {CHECKS.map((c) => {
                  const s = STATE_LABEL[c.state];
                  const pct = Math.round((c.pass / c.total) * 100);
                  return (
                    <div className="c" key={c.id}>
                      <i
                        style={{ height: `${Math.round(pct * 0.68)}%`, background: s.color }}
                        title={`${c.page} · ${c.pass}/${c.total} token đạt`}
                      />
                      <span>{c.id}</span>
                      <span className="hint">
                        {c.pass}/{c.total}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-hd">
              <Gauge size={14} className="dim" />
              <b>App tự kiểm tra</b>
            </div>
            <div className="card-bd" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div className="row">
                  <span className="lbl">Theo điểm ảnh</span>
                  <div className="grow" />
                  <b className="mono">96,8%</b>
                </div>
                <div className="row" style={{ marginTop: 6 }}>
                  <span className="bar">
                    <i style={{ width: '96.8%', background: 'var(--ok)' }} />
                  </span>
                </div>
                <div className="hint" style={{ marginTop: 5 }}>
                  Lệch 12.480 px (3,2%) so với ảnh mẫu
                </div>
              </div>
              <div>
                <div className="row">
                  <span className="lbl">Theo DOM</span>
                  <div className="grow" />
                  <b className="mono">22/25</b>
                </div>
                <div className="row" style={{ marginTop: 6 }}>
                  <span className="bar">
                    <i style={{ width: '88%', background: 'var(--warn)' }} />
                  </span>
                </div>
                <div className="hint" style={{ marginTop: 5 }}>
                  Vị trí, kích thước, khoảng cách, màu, chữ, viền, bóng, bo góc, canh lề
                </div>
              </div>
              <div>
                <div className="row">
                  <span className="lbl">Co giãn 390 / 768 / 1440</span>
                </div>
                <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                  <span className="chip warn">390 cảnh báo</span>
                  <span className="chip ok">768 đạt</span>
                  <span className="chip err">1440 lỗi</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── So sánh DOM theo thuộc tính ── */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-hd">
          <ListChecks size={14} className="dim" />
          <b>So sánh DOM theo thuộc tính</b>
          <span className="tag">a.wlogin · 1440×900</span>
          <div className="grow" />
          <span className="hint">2 thuộc tính lệch, 4 thuộc tính khớp</span>
        </div>
        <div className="card-bd tight">
          <table className="tb">
            <thead>
              <tr>
                <th>Thuộc tính</th>
                <th>Mong đợi</th>
                <th>Thực tế</th>
                <th className="r" style={{ width: 100 }} />
              </tr>
            </thead>
            <tbody>
              {DOM_DIFF.map((d) => (
                <tr key={d.prop}>
                  <td>{d.prop}</td>
                  <td className="mono">{d.expect}</td>
                  <td className="mono">{d.real}</td>
                  <td className="r">
                    <span className={`chip ${d.ok ? 'ok' : 'err'}`}>{d.ok ? 'khớp' : 'lệch'}</span>
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

export default ChecksPage;
