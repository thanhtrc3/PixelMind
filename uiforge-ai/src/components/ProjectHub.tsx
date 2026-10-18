import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  FolderOpen,
  PanelLeft,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { PROJECT } from '../data/project';
import '../styles/Hub.css';

/* Hộp chọn dự án — chỉ còn màn “Dự án”.
   Các màn quản lý khác (phiếu yêu cầu, kiểm tra, giấy phép, thiết kế,
   nhật ký, báo cáo, xuất bài) đã chuyển hết sang cột điều hướng dọc. */

type Project = {
  id: number;
  name: string;
  stack: string;
  owner: string;
  date: string;
  issues: number;
  tint: string;
  active?: boolean;
};

const PROJECTS: Project[] = [
  { id: 1, name: PROJECT.name, stack: PROJECT.stack, owner: PROJECT.owner, date: PROJECT.created, issues: 3, tint: '#6d5df5', active: true },
  { id: 2, name: 'admin-dashboard', stack: 'Next.js', owner: 'Đoàn Quí Trường', date: '02/10/2026', issues: 0, tint: '#4a8df6' },
  { id: 3, name: 'mobile-booking', stack: 'React Native Web', owner: 'Nguyễn Thanh Hiền', date: '08/10/2026', issues: 7, tint: '#31c07a' },
  { id: 4, name: 'portfolio-v2', stack: 'HTML/CSS/JS', owner: 'Đoàn Quí Trường', date: '14/10/2026', issues: 1, tint: '#e2b13c' },
];

interface ProjectHubProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProject?: () => void;
}

const ProjectHub = ({ isOpen, onClose, onOpenProject }: ProjectHubProps) => {
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PROJECTS;
    return PROJECTS.filter((p) =>
      [p.name, p.stack, p.owner].join(' ').toLowerCase().includes(q),
    );
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="hub__overlay" onClick={onClose}>
      <div className="hub slide-up" onClick={(e) => e.stopPropagation()}>
        {/* ── Đầu ── */}
        <header className="hub__head">
          <div className="hub__brand">
            <div className="hub__logo">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div>
              <div className="hub__brand-name">
                Pixel<span>Mind</span>
              </div>
              <div className="hub__brand-sub">Hệ thống hỗ trợ thiết kế giao diện</div>
            </div>
          </div>
          <div className="hub__user">
            <span className="hub__user-ava">TH</span>
            <div>
              <div className="hub__user-name">{PROJECT.owner}</div>
              <div className="hub__user-role">Dev · PixelMind</div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} title="Đóng · Esc">
            <X size={16} />
          </button>
        </header>

        {/* ── Thân: danh sách dự án ── */}
        <div className="hub__body">
          <div className="hub__title-row">
            <div>
              <h2 className="hub__title">Dự án</h2>
              <p className="hub__sub">
                Mở thư mục code có sẵn hoặc tạo dự án mới để bắt đầu. Phiếu yêu cầu, kiểm tra,
                giấy phép, thiết kế… nằm ở cột điều hướng bên trái.
              </p>
            </div>
            <div className="hub__title-actions">
              <div className="hub__search">
                <Search size={13} />
                <input
                  placeholder="Tìm dự án…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <button className="btn">
                <FolderOpen size={13} /> Mở thư mục
              </button>
              <button className="btn primary">
                <Plus size={13} /> Tạo dự án
              </button>
            </div>
          </div>

          <div className="hub__grid">
            {list.map((p) => (
              <article
                key={p.id}
                className={`pjcard ${p.active ? 'active' : ''}`}
                onClick={onOpenProject}
              >
                <div
                  className="pjcard__thumb"
                  style={{ background: `linear-gradient(150deg, ${p.tint}33, transparent)` }}
                >
                  <span className="pjcard__mock">
                    <i />
                    <i />
                    <i style={{ width: '60%' }} />
                    <i />
                    <i style={{ width: '40%' }} />
                  </span>
                  {p.active && <span className="pjcard__badge">Đang mở</span>}
                </div>
                <div className="pjcard__body">
                  <div className="pjcard__row">
                    <span className="pjcard__name">{p.name}</span>
                    <ArrowUpRight size={14} className="pjcard__go" />
                  </div>
                  <div className="pjcard__meta">
                    <span className="pjcard__stack" style={{ color: p.tint }}>
                      {p.stack}
                    </span>
                    <span className="pjcard__dot" />
                    <span>{p.date}</span>
                  </div>
                  <div className="pjcard__foot">
                    <span className="pjcard__owner">{p.owner}</span>
                    {p.issues > 0 ? (
                      <span className="chip warn">
                        <AlertTriangle size={10} />
                        {p.issues} lỗi
                      </span>
                    ) : (
                      <span className="chip ok">
                        <CheckCircle2 size={10} />
                        đạt
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))}

            <button className="pjcard pjcard--new">
              <span className="pjcard__new-icon">
                <Plus size={20} />
              </span>
              <span className="pjcard__new-label">Tạo dự án mới</span>
              <span className="pjcard__new-sub">React · Vue · Next.js · HTML</span>
            </button>
          </div>

          {list.length === 0 && (
            <div className="hub__empty">
              Không có dự án nào khớp “{query}”. Thử tên khác hoặc bỏ từ khoá.
            </div>
          )}

          <div className="strk info" style={{ marginTop: 14 }}>
            <PanelLeft size={14} style={{ flex: 'none', marginTop: 1 }} />
            <span>
              Cần xem phiếu yêu cầu, phiếu kiểm tra, phiếu phiên bản, thư viện part, design
              system, giấy phép AI, người dùng, nhật ký, báo cáo hay xuất bài thì mở ở cột điều
              hướng bên trái — không còn nằm trong hộp này nữa.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectHub;
