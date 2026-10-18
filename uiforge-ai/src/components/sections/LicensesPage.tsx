import { useState } from 'react';
import { Ban, Check, Cpu, Shield, ShieldCheck, X } from 'lucide-react';
import { LICENSES } from '../../data/project';
import type { License } from '../../data/project';
import '../../styles/Sections.css';

const STATE_LABEL: Record<License['state'], { text: string; cls: string }> = {
  'con-han': { text: 'còn hiệu lực', cls: 'ok' },
  'sap-het': { text: 'sắp hết hạn', cls: 'warn' },
  'thu-hoi': { text: 'đã thu hồi', cls: 'err' },
};

/** Phạm vi quyền theo bậc: chỉ đọc file → được ghi file → được chạy lệnh */
const SCOPES: Record<string, string[]> = {
  'GP-001': ['đọc', 'ghi', 'chạy lệnh'],
  'GP-002': ['đọc', 'ghi'],
  'GP-003': ['đọc'],
  'GP-004': ['đọc', 'ghi'],
  'GP-005': ['đọc'],
};

const PROFILES = [
  { name: 'Antigravity IDE (ws://localhost:45678)', v: 72 },
  { name: 'Ollama local (qwen2.5-coder)', v: 38 },
  { name: 'GPT-4o API', v: 14 },
  { name: 'OpenCode CLI', v: 9 },
];

const BLOCKED = [
  {
    time: '15:24',
    who: 'Phạm Thu (BA)',
    what: 'Yêu cầu AI sửa Header.tsx trên ShopWeb',
    why: 'giấy phép đã thu hồi',
    cls: 'err',
  },
  {
    time: '11:02',
    who: 'Lê Minh Anh (Tester)',
    what: 'Yêu cầu AI chạy lệnh npm run build',
    why: 'chỉ có quyền đọc',
    cls: 'warn',
  },
];

const LicensesPage = () => {
  const [toast, setToast] = useState<string | null>(null);

  const active = LICENSES.filter((l) => l.state === 'con-han').length;
  const expiring = LICENSES.filter((l) => l.state === 'sap-het').length;
  const revoked = LICENSES.filter((l) => l.state === 'thu-hoi').length;
  const maxProfile = PROFILES[0].v;

  return (
    <div className="scroll">
      {/* ── Đầu trang ── */}
      <div className="pg-hd">
        <div>
          <div className="row" style={{ gap: 8 }}>
            <h1 className="tt">Giấy phép AI</h1>
            <span className="chip ok">
              <span className="dot ok" />
              {active} còn hiệu lực
            </span>
            <span className="chip warn">{expiring} sắp hết hạn</span>
            <span className="chip err">{revoked} đã thu hồi</span>
          </div>
          <p className="sub">
            AI chỉ được động vào dự án khi admin đã cấp giấy phép còn hiệu lực — hết hạn hoặc bị thu
            hồi thì AI dừng ngay, kể cả khi đang giữa vòng sửa
          </p>
        </div>
        <div className="grow" />
        <button
          className="btn primary"
          onClick={() => setToast('Mở hộp thoại cấp giấy phép cho thành viên và dự án đã chọn')}
        >
          <Shield size={12} /> Cấp giấy phép
        </button>
      </div>

      {/* ── Danh sách giấy phép ── */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-hd">
          <ShieldCheck size={14} className="dim" />
          <b>Danh sách giấy phép</b>
          <span className="tag">{LICENSES.length} giấy phép</span>
          <div className="grow" />
          <span className="hint">lượt gọi AI đã dùng / hạn mức</span>
        </div>
        <div className="card-bd tight">
          <table className="tb">
            <thead>
              <tr>
                <th style={{ width: 64 }}>Mã</th>
                <th>Người được cấp</th>
                <th>Dự án</th>
                <th style={{ width: 168 }}>Đã dùng</th>
                <th style={{ width: 74 }}>Hết hạn</th>
                <th>Phạm vi quyền</th>
                <th style={{ width: 118 }}>Trạng thái</th>
                <th className="r" style={{ width: 152 }} />
              </tr>
            </thead>
            <tbody>
              {LICENSES.map((l) => {
                const s = STATE_LABEL[l.state];
                const pct = Math.round((l.used / l.cap) * 100);
                return (
                  <tr key={l.id} style={{ opacity: l.state === 'thu-hoi' ? 0.6 : 1 }}>
                    <td className="mono">{l.id}</td>
                    <td>{l.who}</td>
                    <td>{l.project}</td>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <span className="bar">
                          <i
                            style={{
                              width: `${pct}%`,
                              background: pct >= 100 ? 'var(--err)' : pct >= 60 ? 'var(--warn)' : 'var(--accent)',
                            }}
                          />
                        </span>
                        <span className="mono dim">
                          {l.used}/{l.cap}
                        </span>
                      </div>
                    </td>
                    <td className="mono">{l.until}</td>
                    <td>
                      <span className="row wrap" style={{ gap: 4 }}>
                        {(SCOPES[l.id] ?? ['đọc']).map((sc) => (
                          <span className="tag" key={sc}>
                            {sc}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td>
                      <span className={`chip ${s.cls}`}>
                        <span className={`dot ${s.cls}`} />
                        {s.text}
                      </span>
                    </td>
                    <td className="r">
                      {l.state === 'thu-hoi' ? (
                        <button
                          className="btn sm"
                          onClick={() => setToast(`Đã cấp lại giấy phép cho ${l.who} — hiệu lực từ hôm nay`)}
                        >
                          Cấp lại
                        </button>
                      ) : (
                        <span className="row" style={{ gap: 5, justifyContent: 'flex-end' }}>
                          <button
                            className="btn sm"
                            onClick={() => setToast(`Đã gia hạn ${l.id} tới 31/01/2027`)}
                          >
                            Gia hạn
                          </button>
                          <button
                            className="btn sm danger"
                            onClick={() =>
                              setToast(`Đã thu hồi ${l.id} — app huỷ ngay lệnh AI đang chờ của ${l.who}`)
                            }
                          >
                            Thu hồi
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid g2">
        <div className="col" style={{ gap: 12 }}>
          {/* ── Hồ sơ AI dùng nhiều nhất ── */}
          <div className="card">
            <div className="card-hd">
              <Cpu size={14} className="dim" />
              <b>Hồ sơ AI dùng nhiều nhất</b>
              <div className="grow" />
              <span className="hint">lượt gọi trong 7 ngày</span>
            </div>
            <div className="card-bd" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PROFILES.map((p) => (
                <div key={p.name}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="mono grow">{p.name}</span>
                    <b className="mono">{p.v}</b>
                  </div>
                  <div className="row" style={{ marginTop: 5 }}>
                    <span className="bar">
                      <i
                        style={{
                          width: `${Math.round((p.v / maxProfile) * 100)}%`,
                          background: 'var(--accent)',
                        }}
                      />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Quy tắc cấp phép ── */}
          <div className="card">
            <div className="card-hd">
              <Shield size={14} style={{ color: 'var(--accent-2)' }} />
              <b>Quy tắc cấp phép</b>
            </div>
            <div className="card-bd" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div className="hint">
                • Một người tại một thời điểm chỉ có <b>1 giấy phép còn hiệu lực trên 1 dự án</b>.
              </div>
              <div className="hint">• Ngày hết hạn phải sau ngày cấp.</div>
              <div className="hint">
                • Phạm vi quyền theo bậc: chỉ đọc file → được ghi file → được chạy lệnh.
              </div>
              <div className="hint">• Thu hồi là có hiệu lực ngay, app huỷ luôn lệnh đang chờ.</div>
            </div>
          </div>
        </div>

        {/* ── Lệnh AI bị chặn ── */}
        <div className="card">
          <div className="card-hd">
            <Ban size={14} className="dim" />
            <b>Lệnh AI bị chặn</b>
            <div className="grow" />
            <span className="chip err">{BLOCKED.length} lệnh hôm nay</span>
          </div>
          <div className="card-bd tight">
            <table className="tb">
              <tbody>
                {BLOCKED.map((b) => (
                  <tr key={b.time}>
                    <td className="mono" style={{ width: 60 }}>
                      {b.time}
                    </td>
                    <td style={{ width: 128 }}>{b.who}</td>
                    <td>{b.what}</td>
                    <td className="r" style={{ width: 140 }}>
                      <span className={`chip ${b.cls}`}>{b.why}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-bd" style={{ borderTop: '1px solid var(--line)' }}>
            <div className="hint">
              Mọi lệnh AI bị chặn đều ghi vào nhật ký kèm lý do, kể cả khi người dùng đã bấm gửi.
            </div>
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

export default LicensesPage;
