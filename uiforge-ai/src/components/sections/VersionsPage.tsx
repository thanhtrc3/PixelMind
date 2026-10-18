import { useState } from 'react';
import {
  Check,
  Clock,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  RotateCcw,
  Sparkles,
  Ticket as TicketIcon,
  User,
  X,
} from 'lucide-react';
import { PROJECT, VERSIONS } from '../../data/project';
import type { Version } from '../../data/project';
import '../../styles/Sections.css';

const STATE_LABEL: Record<Version['state'], { text: string; cls: string }> = {
  'cho-duyet': { text: 'chờ duyệt', cls: 'info' },
  'da-duyet': { text: 'đã duyệt', cls: 'ok' },
  'tu-choi': { text: 'từ chối', cls: 'err' },
};

const BEFORE = `.wlogin {
  padding: 7px 14px;
  margin-left: 8px;
  font-weight: 700;
}`;

/** Từng dòng đổi của v3 so với v2 — đúng thứ tự bản thiết kế */
const CHANGES: { line: string; kind: 'add' | 'del' }[] = [
  { line: '  padding: 7px 14px;', kind: 'del' },
  { line: '  padding: 8px 15px;', kind: 'add' },
  { line: '  margin-left: 8px;', kind: 'del' },
  { line: '  margin-left: 12px;', kind: 'add' },
  { line: '  font-weight: 700;', kind: 'del' },
  { line: '  font-weight: 600;', kind: 'add' },
];

const ROUNDS = [
  {
    t: 'Vòng 2',
    when: '15:22 · a41f9c2',
    d: 'Khớp ảnh mẫu, tạo phiên bản v3 đang xem.',
  },
  { t: 'Vòng 1', when: '15:12 · c8e441a', d: 'Sửa padding và margin, còn lệch 4px.' },
  { t: 'Checkpoint trước khi sửa', when: '14:40 · 77b0de1', d: 'Là bản mà nút Từ chối sẽ quay về.' },
];

const VersionsPage = () => {
  const [diffBase, setDiffBase] = useState('so với v2');
  const [toast, setToast] = useState<string | null>(null);

  const current = VERSIONS[0];
  const st = STATE_LABEL[current.state];
  const pending = VERSIONS.filter((v) => v.state === 'cho-duyet').length;
  const approved = VERSIONS.filter((v) => v.state === 'da-duyet').length;

  return (
    <div className="scroll">
      {/* ── Đầu trang ── */}
      <div className="pg-hd">
        <div>
          <div className="row" style={{ gap: 8 }}>
            <h1 className="tt">
              {current.tag} · {current.what}
            </h1>
            <span className={`chip ${st.cls}`}>{st.text}</span>
            <span className="chip ac">{current.rounds ?? '1 vòng'}</span>
          </div>
          <p className="sub">
            17/10/2026 15:22 · {current.ticket} · {current.by} · <span className="mono">{current.hash}</span> ·{' '}
            {approved} bản đã duyệt, {pending} bản chờ reviewer
          </p>
        </div>
        <div className="grow" />
        <button
          className="btn"
          onClick={() => setToast(`Đã mở ${PROJECT.repo} trên GitHub tại commit ${current.hash}`)}
        >
          <ExternalLink size={12} /> Mở trên GitHub
        </button>
        <button
          className="btn danger"
          onClick={() => setToast(`Đã khôi phục ${PROJECT.name} về v2 · 77b0de1 — cây làm việc sạch`)}
        >
          <RotateCcw size={12} /> Khôi phục về v2
        </button>
        <button className="btn ok" onClick={() => setToast('Đã đồng ý v3 và lưu vào Git')}>
          <Check size={12} /> Đồng ý
        </button>
      </div>

      <div className="grid g2">
        {/* ── Khác biệt của v3 so với v2 ── */}
        <div className="card">
          <div className="card-hd">
            <GitCommitHorizontal size={14} className="dim" />
            <b className="mono">src/components/Header.tsx</b>
            <div className="grow" />
            <span className="chip ok">+4</span>
            <span className="chip err">−3</span>
            <span className="sep" />
            <select
              className="inp"
              style={{ height: 25, maxWidth: 130 }}
              value={diffBase}
              onChange={(e) => setDiffBase(e.target.value)}
            >
              <option>so với v2</option>
              <option>so với v1</option>
              <option>so với v0</option>
            </select>
          </div>
          <div className="card-bd">
            <div className="split">
              <div>
                <div className="lbl" style={{ marginBottom: 6 }}>
                  {diffBase.replace('so với ', '')} · trước
                </div>
                <pre className="code" style={{ border: 0 }}>
                  {BEFORE}
                </pre>
              </div>
              <div>
                <div className="lbl" style={{ marginBottom: 6 }}>
                  {current.tag} · sau
                </div>
                <pre className="code" style={{ border: 0 }}>
                  {CHANGES.map((c) => (
                    <span key={`${c.kind}-${c.line}`} className={c.kind}>
                      {c.line}
                    </span>
                  ))}
                </pre>
              </div>
            </div>

            <div className="row wrap" style={{ gap: 7, marginTop: 12 }}>
              <span className="chip">
                <User size={11} /> Nguyễn Thanh Hiền · Dev
              </span>
              <span className="chip">
                <Sparkles size={11} /> Nguồn: AI sửa
              </span>
              <span className="chip">
                <TicketIcon size={11} /> {current.ticket}
              </span>
              <span className="chip">
                <Clock size={11} /> 17/10/2026 15:22
              </span>
              <span className="chip ok">
                <Check size={11} /> Kiểm tra: 1440 lệch 0,2%
              </span>
            </div>

            <hr className="hr" />

            <div className="row wrap">
              <span className="hint">
                Reviewer xem diff rồi bấm Đồng ý để lưu vào GitHub, hoặc Từ chối để quay lại v2.
              </span>
              <div className="grow" />
              <button
                className="btn danger"
                onClick={() => setToast('Đã từ chối v3 — app khôi phục về checkpoint 77b0de1')}
              >
                <X size={12} /> Từ chối
              </button>
              <button className="btn ok" onClick={() => setToast('Đã đồng ý v3 và lưu vào Git')}>
                <Check size={12} /> Đồng ý
              </button>
            </div>
          </div>
        </div>

        {/* ── Lịch sử phiên bản + thông tin ── */}
        <div className="col" style={{ gap: 12 }}>
          <div className="card">
            <div className="card-hd">
              <GitBranch size={14} className="dim" />
              <b>Lịch sử phiên bản</b>
              <span className="tag">{VERSIONS.length} bản</span>
              <div className="grow" />
              <span className="hint">mới nhất ở trên</span>
            </div>
            <div className="card-bd">
              <div className="tl">
                {VERSIONS.map((v, i) => {
                  const s = STATE_LABEL[v.state];
                  return (
                    <div className={`it ${i === 0 ? 'on' : ''}`} key={v.id}>
                      <div className="row" style={{ gap: 7 }}>
                        <b style={{ fontSize: 12.5 }}>{v.tag}</b>
                        <span className={`chip ${s.cls}`}>{s.text}</span>
                        <span className="mono dim">{v.hash}</span>
                        {v.rounds && <span className="tag">{v.rounds}</span>}
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
              <GitCommitHorizontal size={14} className="dim" />
              <b>Thông tin phiên bản</b>
            </div>
            <div className="card-bd" style={{ paddingTop: 6, paddingBottom: 6 }}>
              <div className="kv">
                <span className="k">Số thứ tự</span>
                <span className="mono">v3 (tự tăng theo dự án)</span>
              </div>
              <div className="kv">
                <span className="k">Git hash</span>
                <span className="mono">{current.hash}</span>
              </div>
              <div className="kv">
                <span className="k">Ghi chú</span>
                <span>{current.what}</span>
              </div>
              <div className="kv">
                <span className="k">Thuộc phiếu</span>
                <span className="mono">{current.ticket}</span>
              </div>
              <div className="kv">
                <span className="k">Ngày tạo</span>
                <span className="mono">17/10/2026 15:22</span>
              </div>
              <div className="kv">
                <span className="k">File thay đổi</span>
                <span className="mono">Header.tsx · index.css</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-hd">
              <GitPullRequest size={14} className="dim" />
              <b>Các lần sửa trong phiếu này</b>
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

export default VersionsPage;
