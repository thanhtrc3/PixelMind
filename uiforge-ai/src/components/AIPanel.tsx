import { useState } from 'react';
import {
  Trash2, PanelRightClose, ChevronDown, ArrowUp, Paperclip, Camera, Square,
  Sparkles, Bot, Monitor, CheckCircle2, Loader2, Clock, XCircle,
  AlertTriangle, CheckCircle, MousePointer2, Link2, Terminal, KeyRound,
  ShieldCheck, RefreshCw, ThumbsUp, ThumbsDown, MessageSquare, FileCode2,
  Braces, Eye, Zap, Gauge, ScrollText, Send, Filter, Package,
} from 'lucide-react';
import type { Part } from '../data/toolbox';
import '../styles/AIPanel.css';

type AITab = 'chat' | 'tasks' | 'findings' | 'context' | 'comments' | 'settings';

const PROFILES = [
  { id: 'antigravity', icon: Terminal, name: 'Antigravity IDE', kind: 'IDE WebSocket', desc: 'ws://localhost:45678 · miễn phí', on: true },
  { id: 'ollama', icon: Monitor, name: 'Ollama · llama3.1', kind: 'Local API', desc: 'http://localhost:11434 · offline', on: false },
  { id: 'openai', icon: Bot, name: 'OpenAI GPT-4o', kind: 'Cloud API', desc: 'sk-••••••••7f2a · trả phí', on: false },
];

const FIX_STEPS = [
  { id: 1, label: 'Đọc yêu cầu', state: 'done' },
  { id: 2, label: 'Xem project & file liên quan', state: 'done' },
  { id: 3, label: 'Xem giao diện hiện tại + ảnh mẫu', state: 'done' },
  { id: 4, label: 'Xác định điểm lệch', state: 'done' },
  { id: 5, label: 'Sửa mã nguồn', state: 'running' },
  { id: 6, label: 'Chạy lại dev server', state: 'pending' },
  { id: 7, label: 'Chụp ảnh & so sánh', state: 'pending' },
  { id: 8, label: 'Báo kết quả', state: 'pending' },
] as const;

const TASKS = [
  { id: 1, title: 'Sửa Header lệch so với ảnh mẫu', round: 2, meta: 'Antigravity · đang chạy', state: 'running' as const },
  { id: 2, title: 'Giảm bo góc nút submit xuống 8px', round: 1, meta: 'Đã xong · 2 phút trước', state: 'done' as const },
  { id: 3, title: 'Kiểm tra co giãn 390 / 768 / 1440', round: 0, meta: 'Chờ xử lý', state: 'pending' as const },
];

const FINDINGS = [
  { id: 1, sev: 'critical' as const, kind: 'Sai kích thước', msg: 'Logo rộng hơn ảnh mẫu', el: '.site-nav .logo', exp: '128px', act: '152px' },
  { id: 2, sev: 'warning' as const, kind: 'Sai khoảng cách', msg: 'Padding dọc Hero thiếu 12px', el: '.hero', exp: 'padding: 48px', act: 'padding: 36px' },
  { id: 3, sev: 'warning' as const, kind: 'Sai bo góc', msg: 'Bo góc thẻ card chưa khớp token', el: '.features .card', exp: 'radius: 16px', act: 'radius: 12px' },
  { id: 4, sev: 'ok' as const, kind: 'Đạt', msg: 'Màu nền Footer khớp ảnh mẫu', el: '.footer', exp: '#111827', act: '#111827' },
];

const MESSAGES = [
  { id: 1, role: 'system' as const, text: 'Phiên làm việc · dự án shop-landing · giấy phép AI còn hạn 12 ngày' },
  { id: 2, role: 'user' as const, text: 'Header đang lệch so với ảnh mẫu, sửa lại cho tôi.' },
  { id: 3, role: 'ai' as const, text: 'Đã phân tích giao diện và so với ảnh mẫu. Phát hiện 3 điểm lệch:\n• Logo rộng hơn 24px\n• Hero thiếu padding dọc 12px\n• Bo góc card chưa đúng token\n\nĐang tiến hành sửa…' },
  { id: 4, role: 'user' as const, text: 'Tốt, giảm bo góc nút submit xuống 8px.' },
  { id: 5, role: 'ai' as const, text: '✅ Đã cập nhật .btn-submit { border-radius: 8px }. Giao diện đã được tải lại và chụp ảnh để so sánh.' },
];

/* Danh sách ngữ cảnh gửi kèm khi nhờ AI — tick để bật/tắt từng mục.
   Đúng bố cục “Gửi kèm khi nhờ AI” của bản thiết kế giao diện. */
const CONTEXT_ITEMS: {
  id: string;
  icon: typeof Eye;
  label: string;
  detail: string;
  /** mặc định có gửi kèm hay không */
  on: boolean;
}[] = [
  { id: 'ref', icon: Eye, label: 'Ảnh mẫu + ảnh hiện tại', detail: 'trang-chu.png · 1440×900 · screenshot-live.png', on: true },
  { id: 'sel', icon: MousePointer2, label: 'Vùng đang chọn', detail: 'a.wlogin · 96×34 @ (1180, 43)', on: true },
  { id: 'note', icon: Square, label: 'Chú thích khoanh vùng', detail: '1 vùng · “khu vực hero”', on: true },
  { id: 'comment', icon: MessageSquare, label: 'Comment đang mở', detail: '2 comment chưa xử lý', on: true },
  { id: 'design', icon: Braces, label: 'DESIGN.md + tokens.css', detail: 'bản 01/10/2026 · 19 token', on: false },
  { id: 'skill', icon: ScrollText, label: 'Skill review-UI + fix-spacing', detail: 'AI đọc trước khi sửa', on: false },
  { id: 'files', icon: FileCode2, label: 'Chỉ file liên quan', detail: 'Header.tsx · Header.css · index.css', on: true },
  { id: 'parts', icon: Package, label: 'Part đã duyệt', detail: 'chỉ được dùng part trong kho', on: true },
];

const COMMENTS = [
  { id: 1, author: 'QT', name: 'Đoàn Quý Trường', text: 'Nút này thấp hơn ảnh mẫu 8px', el: '.hero .cta', status: 'open' as const, time: '2 giờ trước' },
  { id: 2, author: 'TH', name: 'Nguyễn Thanh Hiền', text: 'Bo góc card nên là 16px theo token', el: '.features .card', status: 'open' as const, time: '3 giờ trước' },
  { id: 3, author: 'BA', name: 'Vai BA', text: 'Màu CTA đã khớp ảnh mẫu ✓', el: '.hero .cta', status: 'done' as const, time: 'Hôm qua' },
];

const AIPanel = ({
  partAttachments = [],
  variantParts = [],
  onRemovePart,
}: {
  /** Part gửi kèm từ Search Toolbox — app tự đính kèm prompt.txt + code */
  partAttachments?: Part[];
  /** id các part được người dùng cho phép AI biến tấu */
  variantParts?: string[];
  onRemovePart?: (partId: string) => void;
}) => {
  const [tab, setTab] = useState<AITab>('chat');
  const [activeProfile, setActiveProfile] = useState('antigravity');
  const [input, setInput] = useState('');
  const [commentFilter, setCommentFilter] = useState<'all' | 'open' | 'done'>('open');
  const [round, setRound] = useState(2);
  /* Ngữ cảnh gửi kèm — người dùng tick để bật/tắt từng mục */
  const [ctx, setCtx] = useState<Record<string, boolean>>(
    Object.fromEntries(CONTEXT_ITEMS.map((c) => [c.id, c.on])),
  );
  const ctxOn = CONTEXT_ITEMS.filter((c) => ctx[c.id]).length;
  /* Ước lượng dung lượng: mỗi mục đang bật chiếm một phần, part đính kèm cộng thêm */
  const ctxTokens = ((ctxOn * 1650 + partAttachments.length * 480) / 1000).toFixed(1);

  const tabs: { key: AITab; label: string; badge?: number }[] = [
    { key: 'chat', label: 'Chat' },
    { key: 'tasks', label: 'Tác vụ', badge: 1 },
    { key: 'findings', label: 'Lỗi', badge: 3 },
    { key: 'context', label: 'Ngữ cảnh' },
    { key: 'comments', label: 'Bình luận', badge: 2 },
    { key: 'settings', label: 'Kết nối' },
  ];

  const filteredComments = COMMENTS.filter((c) => commentFilter === 'all' || c.status === commentFilter);

  return (
    <aside className="ai">
      {/* ── Đầu panel ── */}
      <div className="ai__head">
        <div className="ai__title">
          <span className="ai__dot working" />
          <span>Trợ lý AI</span>
          <span className="badge badge-accent">Vòng {round}/3</span>
        </div>
        <div className="ai__head-actions">
          <button className="icon-btn sm" data-tooltip="Xoá lịch sử chat" data-tooltip-pos="dr"><Trash2 size={14} /></button>
          <button className="icon-btn sm" data-tooltip="Thu gọn panel" data-tooltip-pos="dr"><PanelRightClose size={14} /></button>
        </div>
      </div>

      {/* ── Hồ sơ đang dùng ── */}
      <button className="ai__profile">
        <span className="ai__profile-icon"><Terminal size={14} /></span>
        <span className="ai__profile-text">
          <span className="ai__profile-name">
            {PROFILES.find((p) => p.id === activeProfile)?.name}
          </span>
          <span className="ai__profile-desc">
            {PROFILES.find((p) => p.id === activeProfile)?.desc}
          </span>
        </span>
        <span className="ai__profile-live"><Zap size={11} /> sẵn sàng</span>
        <ChevronDown size={11} />
      </button>

      {/* ── Tab ── */}
      <div className="ai__tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`ai__tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.badge ? <span className="ai__tab-badge">{t.badge}</span> : null}
          </button>
        ))}
      </div>

      <div className="ai__body">

        {/* ════════ CHAT ════════ */}
        {tab === 'chat' && (
          <>
            <div className="ai__scroll chat">
              {MESSAGES.map((m) => (
                <div key={m.id} className={`msg ${m.role === 'user' ? 'msg--user' : m.role === 'ai' ? 'msg--ai' : ''}`}>
                  {m.role === 'ai' && <span className="msg__ava"><Sparkles size={12} /></span>}
                  <div className={`bubble ${m.role === 'user' ? 'bubble--user' : m.role === 'ai' ? 'bubble--ai' : 'bubble--sys'}`}>
                    {m.text}
                  </div>
                </div>
              ))}

              {/* Thẻ ngữ cảnh đính kèm */}
              <div className="ctx-card">
                <span className="ctx-card__thumb"><Square size={14} /></span>
                <div className="ctx-card__info">
                  <span className="ctx-card__label">Đính kèm: vùng đang chọn</span>
                  <span className="ctx-card__detail">.hero h1 · 634×99 · ảnh mẫu + DOM + CSS</span>
                </div>
                <button className="ctx-card__x">✕</button>
              </div>

              {/* Part gửi kèm từ Search Toolbox (mục 2.13) */}
              {partAttachments.map((p) => (
                <div className="ctx-card ctx-card--part" key={p.id}>
                  <span className="ctx-card__thumb ctx-card__thumb--part"><Package size={14} /></span>
                  <div className="ctx-card__info">
                    <span className="ctx-card__label">
                      Part: {p.name}
                      <em className={`ctx-card__mode ${variantParts.includes(p.id) ? 'is-variant' : ''}`}>
                        {variantParts.includes(p.id) ? 'cho phép biến tấu' : 'chép nguyên code mẫu'}
                      </em>
                    </span>
                    <span className="ctx-card__detail">
                      {p.id} · prompt.txt + sample.html + sample.css
                    </span>
                  </div>
                  <button
                    className="ctx-card__x"
                    onClick={() => onRemovePart?.(p.id)}
                    aria-label={`Bỏ part ${p.id}`}
                  >
                    ✕
                  </button>
                </div>
              ))}

              <div className="ai__typing">
                <span /><span /><span />
              </div>
            </div>

            <div className="ai__composer">
              <div className="ai__input-box">
                <textarea
                  rows={2}
                  className="ai__input"
                  placeholder="Mô tả yêu cầu sửa giao diện bằng tiếng Việt…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <button className="ai__send" disabled={!input.trim()}><ArrowUp size={16} /></button>
              </div>
              <div className="ai__composer-actions">
                <button className="icon-btn sm" data-tooltip="Đính kèm ảnh" data-tooltip-pos="top"><Paperclip size={13} /></button>
                <button className="icon-btn sm" data-tooltip="Chụp vùng đang chọn" data-tooltip-pos="top"><Camera size={13} /></button>
                <button className="icon-btn sm" data-tooltip="Chọn vùng trên canvas" data-tooltip-pos="top"><Square size={13} /></button>
                <span className="ai__hint">Enter gửi · Shift+Enter xuống dòng</span>
              </div>
            </div>
          </>
        )}

        {/* ════════ TÁC VỤ ════════ */}
        {tab === 'tasks' && (
          <div className="ai__scroll">
            <div className="loop">
              <div className="loop__head">
                <span className="loop__title"><RefreshCw size={12} className="spin" /> Vòng sửa đang chạy</span>
                <span className="loop__round">Vòng {round}/3</span>
              </div>
              <div className="loop__steps">
                {FIX_STEPS.map((s) => (
                  <div key={s.id} className={`loop__step ${s.state}`}>
                    <span className="loop__step-mark">
                      {s.state === 'done' ? <CheckCircle2 size={13} />
                        : s.state === 'running' ? <Loader2 size={13} className="spin" />
                        : <span className="loop__step-dot" />}
                    </span>
                    <span className="loop__step-label">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="sect-title">Hàng đợi tác vụ</div>
            {TASKS.map((t) => (
              <div key={t.id} className={`task task--${t.state}`}>
                <div className="task__row">
                  <span className={`task__dot ${t.state}`} />
                  <span className="task__title">{t.title}</span>
                  <span className={`badge ${t.state === 'done' ? 'badge-success' : t.state === 'running' ? 'badge-info' : 'badge-neutral'}`}>
                    {t.round}/3 vòng
                  </span>
                </div>
                <div className="task__meta">{t.meta}</div>
                {t.state === 'running' && (
                  <div className="task__bar"><span style={{ width: '58%' }} /></div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ════════ LỖI ════════ */}
        {tab === 'findings' && (
          <div className="ai__scroll">
            <div className="ai__summary">
              <span className="ai__summary-item error"><i />1 nặng</span>
              <span className="ai__summary-item warning"><i />2 vừa</span>
              <span className="ai__summary-item success"><i />1 đạt</span>
              <span className="ai__summary-score"><Gauge size={12} /> Khớp 91%</span>
            </div>
            {FINDINGS.map((f) => (
              <div key={f.id} className={`finding finding--${f.sev}`}>
                <div className="finding__head">
                  <span className="finding__kind">{f.kind}</span>
                  <span className={`badge ${f.sev === 'critical' ? 'badge-error' : f.sev === 'warning' ? 'badge-warning' : 'badge-success'}`}>
                    {f.sev === 'critical' ? <XCircle size={10} /> : f.sev === 'warning' ? <AlertTriangle size={10} /> : <CheckCircle size={10} />}
                    {f.sev === 'critical' ? 'nặng' : f.sev === 'warning' ? 'vừa' : 'đạt'}
                  </span>
                </div>
                <div className="finding__msg">{f.msg}</div>
                <code className="finding__el">{f.el}</code>
                <div className="finding__diff">
                  <span><em>Mong đợi</em><b className="ok">{f.exp}</b></span>
                  <span><em>Hiện tại</em><b className="bad">{f.act}</b></span>
                </div>
                {f.sev !== 'ok' && (
                  <button className="btn btn-sm finding__fix"><Sparkles size={12} /> Nhờ AI sửa dòng này</button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ════════ NGỮ CẢNH ════════ */}
        {tab === 'context' && (
          <div className="ai__scroll">
            <div className="row" style={{ gap: 6, padding: '0 2px 8px' }}>
              <span className="lbl">Gửi kèm khi nhờ AI</span>
              <div className="grow" />
              <span className={`chip ${ctxOn ? 'ac' : 'warn'}`}>
                {ctxOn}/{CONTEXT_ITEMS.length} mục
              </span>
            </div>
            {CONTEXT_ITEMS.map((c) => (
              <label key={c.id} className={`rctx ${ctx[c.id] ? '' : 'off'}`}>
                <input
                  type="checkbox"
                  checked={!!ctx[c.id]}
                  onChange={() => setCtx((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
                />
                <c.icon size={13} />
                <span className="grow">
                  <b>{c.label}</b>
                  <span className="hint">{c.detail}</span>
                </span>
              </label>
            ))}
            <div className="ctx-note" style={{ marginTop: 8 }}>
              <Zap size={12} /> Gửi càng đúng ngữ cảnh thì AI càng ít sửa lung tung và càng ít phải
              sửa lại vòng sau.
            </div>

            {/* Part đính kèm từ Search Toolbox: gửi kèm prompt.txt + code mẫu */}
            {partAttachments.map((p) => (
              <div key={p.id} className="ctx-item ctx-item--part">
                <span className="ctx-item__icon"><Package size={14} /></span>
                <div className="ctx-item__text">
                  <span className="ctx-item__label">Part · {p.name}</span>
                  <span className="ctx-item__detail">
                    {p.id} v{p.version} · prompt.txt ({p.prompt.split('\n')[0]}) · sample.html + sample.css
                  </span>
                  <span className="ctx-item__rule">
                    {variantParts.includes(p.id)
                      ? 'Người dùng đã cho phép biến tấu part này'
                      : 'AI chỉ chép nguyên code mẫu — muốn biến tấu thì bật trong Search Toolbox'}
                  </span>
                </div>
                <span className="ctx-item__ok"><CheckCircle2 size={13} /></span>
              </div>
            ))}
            <div className="ctx-budget">
              <div className="ctx-budget__head">
                <span>Dung lượng gửi AI</span>
                <span>ước tính {ctxTokens.replace('.', ',')}k token</span>
              </div>
              <div className="ctx-budget__bar">
                <span
                  style={{
                    width: `${Math.round((ctxOn / CONTEXT_ITEMS.length) * 100)}%`,
                    background: 'var(--accent)',
                  }}
                />
              </div>
              <div className="ctx-budget__foot">
                {ctx.files
                  ? 'Đã lọc file liên quan — không gửi toàn bộ project'
                  : 'Đang gửi cả project — bật “Chỉ file liên quan” để AI đỡ sửa lung tung'}
              </div>
            </div>
          </div>
        )}

        {/* ════════ BÌNH LUẬN ════════ */}
        {tab === 'comments' && (
          <div className="ai__scroll">
            <div className="ai__filter">
              <Filter size={12} />
              {([['open', 'Đang mở'], ['done', 'Đã xong'], ['all', 'Tất cả']] as const).map(([k, l]) => (
                <button
                  key={k}
                  className={`ai__filter-btn ${commentFilter === k ? 'active' : ''}`}
                  onClick={() => setCommentFilter(k)}
                >
                  {l}
                </button>
              ))}
            </div>
            {filteredComments.map((c) => (
              <div key={c.id} className={`comment ${c.status}`}>
                <div className="comment__head">
                  <span className="comment__ava">{c.author}</span>
                  <div className="comment__who">
                    <span className="comment__name">{c.name}</span>
                    <span className="comment__time">{c.time}</span>
                  </div>
                  <span className={`badge ${c.status === 'done' ? 'badge-success' : 'badge-warning'}`}>
                    {c.status === 'done' ? 'Đã xong' : 'Đang mở'}
                  </span>
                </div>
                <p className="comment__text">{c.text}</p>
                <div className="comment__foot">
                  <code className="comment__el">{c.el}</code>
                  <button className="btn btn-sm comment__to-ai"><Send size={11} /> Chuyển thành lệnh AI</button>
                </div>
              </div>
            ))}
            <button className="comment__add"><MessageSquare size={13} /> Ghim bình luận mới trên canvas</button>
          </div>
        )}

        {/* ════════ KẾT NỐI AI ════════ */}
        {tab === 'settings' && (
          <div className="ai__scroll">
            <div className="conn-note">
              <ShieldCheck size={13} />
              <span>Đổi hồ sơ chỉ cần một lần bấm — không phải khởi động lại ứng dụng.</span>
            </div>
            {PROFILES.map((p) => (
              <div key={p.id} className={`profile ${activeProfile === p.id ? 'active' : ''}`} onClick={() => setActiveProfile(p.id)}>
                <span className="profile__icon"><p.icon size={16} /></span>
                <div className="profile__info">
                  <div className="profile__top">
                    <span className="profile__name">{p.name}</span>
                    <span className="profile__kind">{p.kind}</span>
                  </div>
                  <span className="profile__desc">{p.desc}</span>
                </div>
                <span className={`profile__switch ${activeProfile === p.id ? 'on' : ''}`}><i /></span>
              </div>
            ))}

            <div className="conn-actions">
              <button className="btn btn-sm"><RefreshCw size={12} /> Quét PATH tìm CLI</button>
              <button className="btn btn-sm"><KeyRound size={12} /> Thêm khoá API</button>
            </div>

            <div className="sect-title">Giấy phép AI</div>
            <div className="license-card">
              <div className="license-card__top">
                <span className="license-card__badge"><ShieldCheck size={13} /> Còn hiệu lực</span>
                <span className="license-card__exp">hết hạn sau 12 ngày</span>
              </div>
              <div className="license-card__rows">
                <div><span>Người được cấp</span><b>Nguyễn Thanh Hiền</b></div>
                <div><span>Dự án</span><b>shop-landing</b></div>
                <div><span>Phạm vi quyền</span><b>đọc file · ghi file · chạy lệnh</b></div>
                <div><span>Trạng thái</span><b className="ok">hoạt động</b></div>
              </div>
            </div>

            <div className="sect-title">Khu vực an toàn</div>
            <div className="perm-list">
              <div className="perm"><Terminal size={12} /><span>npm run dev</span><b className="ok">cho phép</b></div>
              <div className="perm"><Terminal size={12} /><span>Sửa source code</span><b className="ok">cho phép</b></div>
              <div className="perm danger"><Link2 size={12} /><span>Xoá dự án</span><b className="bad">chặn</b></div>
            </div>
          </div>
        )}
      </div>

      {/* ── Duyệt kết quả ── */}
      <div className={`ai__review ${round >= 3 ? 'warn' : ''}`}>
        {round >= 3 ? (
          <div className="ai__review-warn">
            <AlertTriangle size={13} /> Đã hết 3 vòng tự sửa — cần bạn quyết định
          </div>
        ) : (
          <div className="ai__review-info">
            <Clock size={12} /> Chờ bạn duyệt kết quả vòng {round}
          </div>
        )}
        <div className="ai__review-btns">
          <button className="btn btn-sm btn-success" onClick={() => setRound(1)}><ThumbsUp size={13} /> Đồng ý &amp; lưu</button>
          <button className="btn btn-sm btn-danger" onClick={() => setRound((r) => Math.max(1, r - 1))}><ThumbsDown size={13} /> Từ chối</button>
        </div>
      </div>
    </aside>
  );
};

export default AIPanel;
