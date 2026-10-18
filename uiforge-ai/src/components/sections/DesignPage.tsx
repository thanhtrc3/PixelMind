import { Fragment, useMemo, useState } from 'react';
import {
  Check,
  FileCode2,
  GitBranch,
  Info,
  Palette,
  Pencil,
  Ruler,
  Sparkles,
  X,
} from 'lucide-react';
import { DESIGN_TOKENS, PROJECT } from '../../data/project';
import '../../styles/Sections.css';

const TABS = ['Token', 'Quy chuẩn', 'Skill'] as const;
type Tab = (typeof TABS)[number];
type Token = (typeof DESIGN_TOKENS)[number];

const RULES = [
  { k: 'Cỡ chữ gốc', v: '13px', note: 'Thân bài 13 · nhãn nhỏ 11.5 · tiêu đề khối 20' },
  { k: 'Màu nhấn', v: '1 màu', note: 'Chỉ dùng cho hành động chính, không dùng để trang trí' },
  { k: 'Màu trạng thái', v: '4 màu cố định', note: 'đạt · cảnh báo · lỗi · đang xử lý — không thêm màu khác' },
  { k: 'Khoảng cách', v: 'bội số 4', note: '4 / 8 / 12 / 16 / 24 / 32 / 48' },
  { k: 'Bo góc', v: '8 · 12 · 99', note: 'Ô nhập & nút · thẻ · nhãn pill' },
];

const STATUS = [
  { name: 'đạt', color: 'var(--ok)' },
  { name: 'cảnh báo', color: 'var(--warn)' },
  { name: 'lỗi', color: 'var(--err)' },
  { name: 'đang xử lý', color: 'var(--info)' },
];

const SKILLS = [
  { name: 'review-UI', what: 'So giao diện với ảnh mẫu, chỉ ra chỗ lệch', uses: 42 },
  { name: 'fix-spacing', what: 'Chỉ dùng khoảng cách bội số 4', uses: 31 },
  { name: 'responsive-check', what: 'Kiểm tra 390 / 768 / 1440 trước khi trả kết quả', uses: 27 },
  { name: 'prompts.md', what: '8 câu lệnh mẫu hay dùng để gọi AI', uses: 19 },
];

/** Giá trị màu thì hiện ô vuông màu, còn lại chỉ hiện chữ */
const isColor = (v: string) => v.startsWith('#') || v.startsWith('rgb');

const DesignPage = () => {
  const [tab, setTab] = useState<Tab>('Token');
  const [toast, setToast] = useState<string | null>(null);

  /* Gom token theo nhóm, giữ nguyên thứ tự khai báo */
  const groups = useMemo(() => {
    const out: { name: string; items: Token[] }[] = [];
    DESIGN_TOKENS.forEach((t) => {
      const g = out.find((x) => x.name === t.group);
      if (g) g.items.push(t);
      else out.push({ name: t.group, items: [t] });
    });
    return out;
  }, []);

  const kpis = [
    {
      t: 'Số token',
      icon: <Palette size={13} />,
      v: DESIGN_TOKENS.length,
      f: `${groups.length} nhóm: nền, viền, chữ, nhấn, trạng thái`,
    },
    {
      t: '% token dùng',
      icon: <Check size={13} />,
      v: '100%',
      f: `${DESIGN_TOKENS.length}/${DESIGN_TOKENS.length} token đã có trong tokens.css`,
    },
    {
      t: 'DESIGN.md',
      icon: <FileCode2 size={13} />,
      v: '01/10',
      f: 'Bản quy chuẩn 01/10/2026 · tokens.css lint sạch',
    },
    {
      t: 'Phiên bản',
      icon: <GitBranch size={13} />,
      v: PROJECT.version,
      f: `Khớp commit ${PROJECT.commit} · đồng bộ 100%`,
    },
  ];

  return (
    <div className="scroll">
      {/* ── Đầu trang ── */}
      <div className="pg-hd">
        <div>
          <div className="row" style={{ gap: 8 }}>
            <h1 className="tt">Design system · {PROJECT.name}</h1>
            <span className="chip">{PROJECT.version}</span>
          </div>
          <p className="sub">
            Bộ quy chuẩn sống của dự án — file quy chuẩn 01/10/2026, sửa ở đây thì cả app đổi theo
          </p>
        </div>
        <div className="grow" />
        <span className="chip ok">
          <span className="dot ok" />
          Đồng bộ 100%
        </span>
        <button className="btn" onClick={() => setToast('Đã mở DESIGN.md để sửa quy chuẩn')}>
          <Pencil size={12} /> Sửa DESIGN.md
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

      {/* ── Chuyển giữa ba phần ── */}
      <div className="utabs" style={{ marginBottom: 12 }}>
        {TABS.map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Token ── */}
      {tab === 'Token' && (
        <div className="card">
          <div className="card-hd">
            <Palette size={14} className="dim" />
            <b>Token trong tokens.css</b>
            <span className="tag">{DESIGN_TOKENS.length} token</span>
            <div className="grow" />
            <span className="hint">Một màu nhấn duy nhất, còn lại là nền và trạng thái cố định</span>
          </div>
          <div className="card-bd tight">
            <table className="tb">
              <thead>
                <tr>
                  <th style={{ width: 190 }}>Token</th>
                  <th style={{ width: 260 }}>Giá trị</th>
                  <th>Cách dùng</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <Fragment key={g.name}>
                    <tr>
                      <td colSpan={3} style={{ background: 'var(--panel-2)' }}>
                        <span className="lbl">{g.name}</span>
                        <span className="tag" style={{ marginLeft: 7 }}>
                          {g.items.length} token
                        </span>
                      </td>
                    </tr>
                    {g.items.map((t) => (
                      <tr key={t.name}>
                        <td className="mono">{t.name}</td>
                        <td>
                          <span className="row" style={{ gap: 7 }}>
                            {isColor(t.value) && (
                              <span
                                style={{
                                  width: 14,
                                  height: 14,
                                  borderRadius: 4,
                                  flex: 'none',
                                  background: t.value,
                                  border: '1px solid var(--line-2)',
                                }}
                              />
                            )}
                            <span className="mono">{t.value}</span>
                          </span>
                        </td>
                        <td className="muted">{t.use}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Quy chuẩn ── */}
      {tab === 'Quy chuẩn' && (
        <div className="card">
          <div className="card-hd">
            <Ruler size={14} className="dim" />
            <b>Quy chuẩn bắt buộc</b>
            <div className="grow" />
            <span className="hint">AI đọc DESIGN.md trước khi sửa</span>
          </div>
          <div className="card-bd" style={{ paddingTop: 6, paddingBottom: 6 }}>
            {RULES.map((r) => (
              <div className="kv" key={r.k}>
                <span className="k">{r.k}</span>
                <span>
                  <b style={{ fontSize: 12.5 }}>{r.v}</b>
                  <span className="hint" style={{ display: 'block' }}>
                    {r.note}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <div className="card-bd" style={{ borderTop: '1px solid var(--line)' }}>
            <div className="row wrap" style={{ gap: 8 }}>
              {STATUS.map((s) => (
                <span className="chip" key={s.name}>
                  <span className="dot" style={{ background: s.color }} />
                  {s.name}
                </span>
              ))}
            </div>
            <div className="strk warn" style={{ marginTop: 11 }}>
              <Info size={14} style={{ flex: 'none', marginTop: 1 }} />
              <span>
                Cấm ghi màu cứng trong code, chỉ dùng <b>var(--…)</b>. Đổi quy chuẩn thì sửa
                DESIGN.md và tokens.css, không sửa lẻ từng trang.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Skill ── */}
      {tab === 'Skill' && (
        <div className="card">
          <div className="card-hd">
            <Sparkles size={14} className="dim" />
            <b>Skill — dạy AI cách làm</b>
            <span className="tag">{SKILLS.length} skill</span>
            <div className="grow" />
            <span className="hint">AI đọc trước khi sửa</span>
          </div>
          <div className="card-bd tight">
            <table className="tb">
              <thead>
                <tr>
                  <th style={{ width: 200 }}>Skill</th>
                  <th>AI phải làm gì</th>
                  <th className="r" style={{ width: 110 }}>
                    Lần dùng
                  </th>
                </tr>
              </thead>
              <tbody>
                {SKILLS.map((s) => (
                  <tr key={s.name}>
                    <td className="mono">{s.name}</td>
                    <td className="muted">{s.what}</td>
                    <td className="r mono">{s.uses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

export default DesignPage;
