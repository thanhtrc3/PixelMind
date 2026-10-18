import { useState } from 'react';
import {
  X, FolderOpen, Plus, Search, LayoutGrid, ClipboardList, FlaskConical,
  ShieldCheck, Palette, ScrollText, BarChart3, ArrowUpRight, Users,
  AlertTriangle, CheckCircle2, Clock, Sparkles, FileText, PanelTop,
  Smartphone, GitBranch, Fingerprint,
} from 'lucide-react';
import '../styles/Hub.css';

type HubSection = 'projects' | 'requests' | 'tests' | 'licenses' | 'design' | 'logs' | 'reports';

const NAV: { key: HubSection; label: string; icon: typeof FolderOpen }[] = [
  { key: 'projects', label: 'Dự án', icon: FolderOpen },
  { key: 'requests', label: 'Phiếu yêu cầu', icon: ClipboardList },
  { key: 'tests', label: 'Phiếu kiểm tra', icon: FlaskConical },
  { key: 'licenses', label: 'Giấy phép AI', icon: ShieldCheck },
  { key: 'design', label: 'Design system', icon: Palette },
  { key: 'logs', label: 'Nhật ký', icon: ScrollText },
  { key: 'reports', label: 'Báo cáo tháng', icon: BarChart3 },
];

const PROJECTS = [
  { id: 1, name: 'shop-landing', stack: 'React + Vite', owner: 'Nguyễn Thanh Hiền', date: '12/09/2026', issues: 3, tint: '#8b6ed4', active: true },
  { id: 2, name: 'admin-dashboard', stack: 'Next.js', owner: 'Đoàn Quý Trường', date: '02/10/2026', issues: 0, tint: '#4a90d9' },
  { id: 3, name: 'mobile-booking', stack: 'React Native Web', owner: 'Nguyễn Thanh Hiền', date: '08/10/2026', issues: 7, tint: '#3f9e6e' },
  { id: 4, name: 'portfolio-v2', stack: 'HTML/CSS/JS', owner: 'Đoàn Quý Trường', date: '14/10/2026', issues: 1, tint: '#c98a2e' },
];

const REQUESTS = [
  { code: 'YC-014', content: 'Header lệch so với ảnh mẫu', due: '18/10', state: 'Đang làm', rounds: '2/3' },
  { code: 'YC-013', content: 'Bo góc nút submit chưa đúng token', due: '17/10', state: 'Chờ duyệt', rounds: '1/3' },
  { code: 'YC-012', content: 'Menu bị tràn ở 390px', due: '15/10', state: 'Quá hạn', rounds: '3/3', late: true },
  { code: 'YC-011', content: 'Đổi màu CTA sang #7C6BFF', due: '12/10', state: 'Đã xong', rounds: '1/3' },
];

const TESTS = [
  { code: 'KT-026', viewport: '390 × 844', result: false, errors: 2, note: 'Thanh menu bị tràn' },
  { code: 'KT-025', viewport: '768 × 1024', result: true, errors: 1, note: 'Khoảng cách card lệch nhẹ' },
  { code: 'KT-024', viewport: '1440 × 900', result: true, errors: 0, note: 'Đạt' },
];

const LICENSES = [
  { id: 1, user: 'Nguyễn Thanh Hiền', project: 'shop-landing', from: '01/10', to: '29/10', scope: 'đọc · ghi · chạy lệnh', state: 'active' as const },
  { id: 2, user: 'Đoàn Quý Trường', project: 'admin-dashboard', from: '02/10', to: '01/11', scope: 'đọc · ghi', state: 'active' as const },
  { id: 3, user: 'Vai BA', project: 'portfolio-v2', from: '01/09', to: '30/09', scope: 'chỉ đọc', state: 'expired' as const },
];

const LOGS = [
  { who: 'Nguyễn Thanh Hiền', project: 'shop-landing', action: 'AI sửa .btn-submit', time: '14:32 hôm nay' },
  { who: 'Đoàn Quý Trường', project: 'shop-landing', action: 'Chấp nhận phiên bản v4', time: '14:20 hôm nay' },
  { who: 'Vai BA', project: 'shop-landing', action: 'Ghim bình luận trên .hero .cta', time: '13:05 hôm nay' },
  { who: 'Tester', project: 'admin-dashboard', action: 'Lập phiếu kiểm tra KT-026', time: '11:48 hôm nay' },
  { who: 'Admin', project: '—', action: 'Cấp giấy phép AI cho Đoàn Quý Trường', time: '09:10 hôm nay' },
];

const REPORTS = [
  { label: 'Phiếu đã tạo', value: 26, tone: 'neutral' as const, icon: ClipboardList },
  { label: 'Phiếu được duyệt', value: 19, tone: 'success' as const, icon: CheckCircle2 },
  { label: 'Phải quay lại', value: 5, tone: 'warning' as const, icon: Clock },
  { label: 'Quá hạn', value: 2, tone: 'error' as const, icon: AlertTriangle },
];

const STATE_BARS = [
  { label: 'Đã xong', value: 19, max: 26, tone: 'var(--color-success)' },
  { label: 'Đang làm', value: 4, max: 26, tone: 'var(--color-info)' },
  { label: 'Chờ duyệt', value: 1, max: 26, tone: 'var(--color-warning)' },
  { label: 'Quá hạn', value: 2, max: 26, tone: 'var(--color-error)' },
];

interface ProjectHubProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProject?: () => void;
}

const ProjectHub = ({ isOpen, onClose, onOpenProject }: ProjectHubProps) => {
  const [section, setSection] = useState<HubSection>('projects');

  if (!isOpen) return null;

  return (
    <div className="hub__overlay">
      <div className="hub slide-up">
        {/* ── Đầu ── */}
        <header className="hub__head">
          <div className="hub__brand">
            <div className="hub__logo"><span /><span /><span /><span /></div>
            <div>
              <div className="hub__brand-name">Pixel<span>Mind</span></div>
              <div className="hub__brand-sub">Hệ thống hỗ trợ thiết kế giao diện</div>
            </div>
          </div>
          <div className="hub__user">
            <span className="hub__user-ava">TH</span>
            <div>
              <div className="hub__user-name">Nguyễn Thanh Hiền</div>
              <div className="hub__user-role">Dev · PixelMind</div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} data-tooltip="Đóng · Esc" data-tooltip-pos="dr"><X size={16} /></button>
        </header>

        <div className="hub__body">
          {/* ── Điều hướng ── */}
          <nav className="hub__nav">
            {NAV.map((n) => (
              <button
                key={n.key}
                className={`hub__nav-item ${section === n.key ? 'active' : ''}`}
                onClick={() => setSection(n.key)}
              >
                <n.icon size={15} />
                <span>{n.label}</span>
              </button>
            ))}
          </nav>

          {/* ── Nội dung ── */}
          <div className="hub__content">

            {/* ═══ DỰ ÁN ═══ */}
            {section === 'projects' && (
              <>
                <div className="hub__title-row">
                  <div>
                    <h2 className="hub__title">Danh sách dự án</h2>
                    <p className="hub__sub">Mở thư mục code có sẵn hoặc tạo dự án mới để bắt đầu.</p>
                  </div>
                  <div className="hub__title-actions">
                    <div className="hub__search"><Search size={13} /><input placeholder="Tìm dự án…" /></div>
                    <button className="btn btn-sm"><FolderOpen size={13} /> Mở thư mục</button>
                    <button className="btn btn-sm btn-primary"><Plus size={13} /> Tạo dự án</button>
                  </div>
                </div>

                <div className="hub__grid">
                  {PROJECTS.map((p) => (
                    <article key={p.id} className={`pjcard ${p.active ? 'active' : ''}`} onClick={onOpenProject}>
                      <div className="pjcard__thumb" style={{ background: `linear-gradient(150deg, ${p.tint}33, transparent)` }}>
                        <span className="pjcard__mock">
                          <i /><i /><i style={{ width: '60%' }} /><i /><i style={{ width: '40%' }} />
                        </span>
                        {p.active && <span className="pjcard__badge">Đang mở</span>}
                      </div>
                      <div className="pjcard__body">
                        <div className="pjcard__row">
                          <span className="pjcard__name">{p.name}</span>
                          <ArrowUpRight size={14} className="pjcard__go" />
                        </div>
                        <div className="pjcard__meta">
                          <span className="pjcard__stack" style={{ color: p.tint }}>{p.stack}</span>
                          <span className="pjcard__dot" />
                          <span>{p.date}</span>
                        </div>
                        <div className="pjcard__foot">
                          <span className="pjcard__owner"><Users size={11} /> {p.owner}</span>
                          {p.issues > 0
                            ? <span className="badge badge-warning">{p.issues} lỗi</span>
                            : <span className="badge badge-success">Đạt</span>}
                        </div>
                      </div>
                    </article>
                  ))}

                  <button className="pjcard pjcard--new">
                    <span className="pjcard__new-icon"><Plus size={20} /></span>
                    <span className="pjcard__new-label">Tạo dự án mới</span>
                    <span className="pjcard__new-sub">React · Vue · Next.js · HTML</span>
                  </button>
                </div>
              </>
            )}

            {/* ═══ PHIẾU YÊU CẦU ═══ */}
            {section === 'requests' && (
              <>
                <div className="hub__title-row">
                  <div>
                    <h2 className="hub__title">Phiếu yêu cầu</h2>
                    <p className="hub__sub">Một người tối đa 3 phiếu đang làm dở · không tạo mới khi còn phiếu quá hạn.</p>
                  </div>
                  <button className="btn btn-sm btn-primary"><Plus size={13} /> Tạo phiếu</button>
                </div>
                <div className="warnbar">
                  <AlertTriangle size={13} /> Bạn còn 1 phiếu quá hạn (YC-012) — không thể tạo phiếu mới cho tới khi xử lý.
                </div>
                <div className="table">
                  <div className="table__head">
                    <span>Mã</span><span>Nội dung</span><span>Hạn</span><span>Tình trạng</span><span>Vòng sửa</span>
                  </div>
                  {REQUESTS.map((r) => (
                    <div key={r.code} className={`table__row ${r.late ? 'late' : ''}`}>
                      <span className="mono">{r.code}</span>
                      <span>{r.content}</span>
                      <span className="mono">{r.due}</span>
                      <span>
                        <span className={`badge ${r.late ? 'badge-error' : r.state === 'Đã xong' ? 'badge-success' : r.state === 'Đang làm' ? 'badge-info' : 'badge-warning'}`}>
                          {r.state}
                        </span>
                      </span>
                      <span className="mono">{r.rounds}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ═══ PHIẾU KIỂM TRA ═══ */}
            {section === 'tests' && (
              <>
                <div className="hub__title-row">
                  <div>
                    <h2 className="hub__title">Phiếu kiểm tra</h2>
                    <p className="hub__sub">Tester ghi kết quả theo từng cỡ màn hình và từng dòng lỗi.</p>
                  </div>
                  <button className="btn btn-sm btn-primary"><Plus size={13} /> Lập phiếu</button>
                </div>
                <div className="hub__grid2">
                  {TESTS.map((t) => (
                    <div key={t.code} className={`testcard ${t.result ? 'ok' : 'bad'}`}>
                      <div className="testcard__head">
                        <span className="mono">{t.code}</span>
                        <span className={`badge ${t.result ? 'badge-success' : 'badge-error'}`}>
                          {t.result ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
                          {t.result ? 'Đạt' : 'Không đạt'}
                        </span>
                      </div>
                      <div className="testcard__vp"><Smartphone size={12} /> {t.viewport}</div>
                      <div className="testcard__note">{t.note}</div>
                      <div className="testcard__foot">
                        <span className="badge badge-neutral">{t.errors} dòng lỗi</span>
                        <GitBranch size={11} />
                        <span className="mono">v4</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ═══ GIẤY PHÉP AI ═══ */}
            {section === 'licenses' && (
              <>
                <div className="hub__title-row">
                  <div>
                    <h2 className="hub__title">Giấy phép AI</h2>
                    <p className="hub__sub">Admin cấp quyền cho AI trước khi AI được dùng vào dự án.</p>
                  </div>
                  <button className="btn btn-sm btn-primary"><Plus size={13} /> Cấp giấy phép</button>
                </div>
                <div className="lic-list">
                  {LICENSES.map((l) => (
                    <div key={l.id} className={`lic ${l.state}`}>
                      <span className="lic__icon"><Fingerprint size={16} /></span>
                      <div className="lic__main">
                        <div className="lic__top">
                          <span className="lic__user">{l.user}</span>
                          <span className={`badge ${l.state === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                            {l.state === 'active' ? 'Còn hiệu lực' : 'Đã hết hạn'}
                          </span>
                        </div>
                        <div className="lic__meta">
                          <span><FileText size={11} /> {l.project}</span>
                          <span>{l.from} → {l.to}</span>
                          <span className="lic__scope">{l.scope}</span>
                        </div>
                      </div>
                      <button className="btn btn-sm">{l.state === 'active' ? 'Thu hồi' : 'Cấp lại'}</button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ═══ DESIGN SYSTEM ═══ */}
            {section === 'design' && (
              <>
                <div className="hub__title-row">
                  <div>
                    <h2 className="hub__title">Design system</h2>
                    <p className="hub__sub">Chuẩn thương hiệu của dự án — AI đọc trước khi sửa giao diện.</p>
                  </div>
                </div>
                <div className="hub__grid3">
                  <div className="hub__panel">
                    <div className="hub__panel-title"><FileText size={13} /> DESIGN.md</div>
                    <pre className="hub__code">{`# shop-landing

## Màu
- accent:  #7C6BFF
- nền:     #0B0B10
## Kiểu chữ
- Inter · JetBrains Mono
## Bo góc
- card: 16px  · nút: 10px
## Khoảng cách
- nhịp 4px (4 · 8 · 12 · 16 · 24)`}</pre>
                  </div>
                  <div className="hub__panel">
                    <div className="hub__panel-title"><Palette size={13} /> tokens.css</div>
                    <pre className="hub__code">{`:root {
  --accent: #7C6BFF;
  --bg-base: #0B0B10;
  --radius-card: 16px;
  --radius-btn: 10px;
  --space-4: 16px;
}`}</pre>
                  </div>
                  <div className="hub__panel">
                    <div className="hub__panel-title"><Sparkles size={13} /> Skill &amp; Template</div>
                    <div className="hub__chips">
                      {['review-UI.md', 'fix-spacing.md', 'responsive-check.md', 'prompts.md'].map((s) => (
                        <span key={s} className="hub__chip mono">{s}</span>
                      ))}
                    </div>
                    <div className="hub__templates">
                      <span><PanelTop size={13} /> Landing</span>
                      <span><LayoutGrid size={13} /> Dashboard</span>
                      <span><Smartphone size={13} /> Mobile</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ═══ NHẬT KÝ ═══ */}
            {section === 'logs' && (
              <>
                <div className="hub__title-row">
                  <div>
                    <h2 className="hub__title">Nhật ký hoạt động</h2>
                    <p className="hub__sub">Nhật ký chỉ thêm, không sửa hay xoá.</p>
                  </div>
                  <div className="hub__search"><Search size={13} /><input placeholder="Lọc theo người, dự án…" /></div>
                </div>
                <div className="table">
                  <div className="table__head">
                    <span>Người</span><span>Dự án</span><span>Hành động</span><span>Thời điểm</span>
                  </div>
                  {LOGS.map((l, i) => (
                    <div key={i} className="table__row">
                      <span>{l.who}</span>
                      <span className="mono">{l.project}</span>
                      <span>{l.action}</span>
                      <span className="mono">{l.time}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ═══ BÁO CÁO ═══ */}
            {section === 'reports' && (
              <>
                <div className="hub__title-row">
                  <div>
                    <h2 className="hub__title">Báo cáo tháng 10</h2>
                    <p className="hub__sub">Số liệu và biểu đồ đơn giản cho Admin.</p>
                  </div>
                </div>

                <div className="stat-grid">
                  {REPORTS.map((r) => (
                    <div key={r.label} className={`stat stat--${r.tone}`}>
                      <span className="stat__icon"><r.icon size={15} /></span>
                      <span className="stat__value">{r.value}</span>
                      <span className="stat__label">{r.label}</span>
                    </div>
                  ))}
                </div>

                <div className="hub__grid3">
                  <div className="hub__panel">
                    <div className="hub__panel-title"><BarChart3 size={13} /> Phiếu theo trạng thái</div>
                    <div className="bars">
                      {STATE_BARS.map((b) => (
                        <div key={b.label} className="bars__row">
                          <span className="bars__label">{b.label}</span>
                          <span className="bars__track">
                            <span className="bars__fill" style={{ width: `${(b.value / b.max) * 100}%`, background: b.tone }} />
                          </span>
                          <span className="bars__value mono">{b.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="hub__panel">
                    <div className="hub__panel-title"><AlertTriangle size={13} /> Lỗi theo mức độ</div>
                    <div className="bars">
                      <div className="bars__row"><span className="bars__label">Nặng</span><span className="bars__track"><span className="bars__fill" style={{ width: '24%', background: 'var(--color-error)' }} /></span><span className="bars__value mono">6</span></div>
                      <div className="bars__row"><span className="bars__label">Vừa</span><span className="bars__track"><span className="bars__fill" style={{ width: '56%', background: 'var(--color-warning)' }} /></span><span className="bars__value mono">14</span></div>
                      <div className="bars__row"><span className="bars__label">Nhẹ</span><span className="bars__track"><span className="bars__fill" style={{ width: '84%', background: 'var(--color-info)' }} /></span><span className="bars__value mono">21</span></div>
                    </div>
                  </div>
                  <div className="hub__panel">
                    <div className="hub__panel-title"><Sparkles size={13} /> Hồ sơ AI dùng nhiều nhất</div>
                    <div className="bars">
                      <div className="bars__row"><span className="bars__label">Antigravity</span><span className="bars__track"><span className="bars__fill" style={{ width: '78%', background: 'var(--accent)' }} /></span><span className="bars__value mono">142</span></div>
                      <div className="bars__row"><span className="bars__label">Ollama</span><span className="bars__track"><span className="bars__fill" style={{ width: '32%', background: 'var(--accent)' }} /></span><span className="bars__value mono">58</span></div>
                      <div className="bars__row"><span className="bars__label">GPT-4o</span><span className="bars__track"><span className="bars__fill" style={{ width: '16%', background: 'var(--accent)' }} /></span><span className="bars__value mono">29</span></div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectHub;
