import { LogOut } from 'lucide-react';
import { NAV_GROUPS } from '../data/sections';
import type { SectionId } from '../data/sections';
import '../styles/Nav.css';

type Props = {
  section: SectionId;
  onSection: (id: SectionId) => void;
  /** Thu gọn thành dải icon khi đang ở màn hình làm việc */
  mini: boolean;
  onLogout?: () => void;
};

/**
 * Cột điều hướng dọc — thay cho thanh nút bấm nhanh.
 * Bản thiết kế giao diện: index.html → <nav class="nav">
 */
const Nav = ({ section, onSection, mini, onLogout }: Props) => (
  <nav className={`nav ${mini ? 'nav--mini' : ''}`}>
    {NAV_GROUPS.map((g) => (
      <div key={g.title} className="nav__group">
        <div className="nav__label">{g.title}</div>
        {g.items.map((it) => {
          const Icon = it.icon;
          const active = section === it.id;
          return (
            <button
              key={it.id}
              type="button"
              className={`nav__item ${active ? 'is-on' : ''}`}
              title={it.label}
              aria-current={active ? 'page' : undefined}
              onClick={() => onSection(it.id)}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span className="nav__text">{it.label}</span>
              {it.badge != null && <span className="nav__badge">{it.badge}</span>}
            </button>
          );
        })}
      </div>
    ))}

    <div className="grow" />

    <button
      type="button"
      className="nav__item"
      title="Đăng xuất"
      onClick={() => onLogout?.()}
    >
      <LogOut size={17} strokeWidth={1.8} />
      <span className="nav__text">Đăng xuất</span>
    </button>
  </nav>
);

export default Nav;
