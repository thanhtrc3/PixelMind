import { useState } from 'react';
import '../styles/Sidebar.css';

type SidebarTab = 'layers' | 'pages' | 'assets' | 'files' | 'versions';

const LAYERS = [
  { id: 1, icon: '▦', label: 'Frame / Desktop', indent: 0, active: true },
  { id: 2, icon: '□', label: 'Header', indent: 1 },
  { id: 3, icon: '▭', label: 'Logo', indent: 2 },
  { id: 4, icon: '▭', label: 'Nav Menu', indent: 2 },
  { id: 5, icon: '⬤', label: 'CTA Button', indent: 2 },
  { id: 6, icon: '□', label: 'Hero Section', indent: 1 },
  { id: 7, icon: '≡', label: 'Hero Text', indent: 2 },
  { id: 8, icon: '▭', label: 'Hero Image', indent: 2 },
  { id: 9, icon: '□', label: 'Footer', indent: 1 },
];

const PAGES = [
  { id: 1, label: 'Home', active: true },
  { id: 2, label: 'About' },
  { id: 3, label: 'Products' },
  { id: 4, label: 'Contact' },
  { id: 5, label: 'Login' },
];

const ASSETS = [
  { id: 1, label: 'hero-design.png', icon: '🖼' },
  { id: 2, label: 'mobile-mockup.png', icon: '🖼' },
  { id: 3, label: 'logo-ref.png', icon: '🖼' },
  { id: 4, label: 'button-spec.png', icon: '🖼' },
];

const FILES = [
  { id: 1, icon: '📂', label: 'src/', indent: 0 },
  { id: 2, icon: '📄', label: 'App.tsx', indent: 1 },
  { id: 3, icon: '📄', label: 'main.tsx', indent: 1 },
  { id: 4, icon: '📂', label: 'components/', indent: 1 },
  { id: 5, icon: '📄', label: 'Header.tsx', indent: 2 },
  { id: 6, icon: '📄', label: 'Hero.tsx', indent: 2 },
  { id: 7, icon: '📄', label: 'Footer.tsx', indent: 2 },
  { id: 8, icon: '📂', label: 'styles/', indent: 1 },
  { id: 9, icon: '📄', label: 'App.css', indent: 2, active: true },
];

const VERSIONS = [
  { id: 1, label: 'v4 — Fix Button Radius', meta: '5 phút trước', current: true },
  { id: 2, label: 'v3 — Fix Mobile Layout', meta: '1 giờ trước', current: false },
  { id: 3, label: 'v2 — Fix Header', meta: 'Hôm qua', current: false },
  { id: 4, label: 'v1 — Initial UI', meta: '2 ngày trước', current: false },
];

const Sidebar = () => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('layers');

  const tabs: { key: SidebarTab; label: string }[] = [
    { key: 'layers', label: 'Layers' },
    { key: 'pages', label: 'Pages' },
    { key: 'assets', label: 'Assets' },
    { key: 'files', label: 'Files' },
    { key: 'versions', label: 'Ver.' },
  ];

  return (
    <aside className="sidebar">
      {/* Tabs */}
      <div className="sidebar__tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`sidebar__tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="sidebar__content">

        {/* ── Layers ── */}
        {activeTab === 'layers' && (
          <>
            <div className="sidebar__section-header open">
              <span>Component Tree</span>
              <span className="chevron">▶</span>
            </div>
            {LAYERS.map((l) => (
              <div
                key={l.id}
                className={`sidebar__item ${l.active ? 'active' : ''} ${
                  l.indent === 1 ? 'sidebar__item--indent1' : l.indent === 2 ? 'sidebar__item--indent2' : ''
                }`}
              >
                <span className="sidebar__item-icon">{l.icon}</span>
                <span className="sidebar__item-label">{l.label}</span>
              </div>
            ))}
          </>
        )}

        {/* ── Pages ── */}
        {activeTab === 'pages' && (
          <>
            <div className="sidebar__section-header open">
              <span>Trang</span>
              <button className="icon-btn" style={{ width: 20, height: 20, fontSize: 12 }}>+</button>
            </div>
            {PAGES.map((p) => (
              <div key={p.id} className={`sidebar__page-item ${p.active ? 'active' : ''}`}>
                <div className="sidebar__page-dot" />
                <span className="sidebar__page-name">{p.label}</span>
              </div>
            ))}
          </>
        )}

        {/* ── Assets ── */}
        {activeTab === 'assets' && (
          <>
            <div className="sidebar__section-header open">
              <span>Ảnh tham chiếu</span>
              <button className="icon-btn" style={{ width: 20, height: 20, fontSize: 12 }}>+</button>
            </div>
            <div className="sidebar__asset-grid">
              {ASSETS.map((a) => (
                <div key={a.id} className="sidebar__asset-thumb">
                  <div className="sidebar__asset-placeholder-icon">{a.icon}</div>
                  <span className="sidebar__asset-thumb-name">{a.label}</span>
                </div>
              ))}
              {/* Add button */}
              <div className="sidebar__asset-thumb" style={{ borderStyle: 'dashed' }}>
                <div className="sidebar__asset-placeholder-icon" style={{ fontSize: 20 }}>+</div>
                <span className="sidebar__asset-thumb-name">Thêm ảnh</span>
              </div>
            </div>
          </>
        )}

        {/* ── Files ── */}
        {activeTab === 'files' && (
          <>
            <div className="sidebar__section-header open">
              <span>Project Files</span>
              <span className="chevron">▶</span>
            </div>
            {FILES.map((f) => (
              <div
                key={f.id}
                className={`sidebar__item ${f.active ? 'active' : ''} ${
                  f.indent === 1 ? 'sidebar__item--indent1' : f.indent === 2 ? 'sidebar__item--indent2' : ''
                }`}
              >
                <span className="sidebar__item-icon">{f.icon}</span>
                <span className="sidebar__item-label">{f.label}</span>
              </div>
            ))}
          </>
        )}

        {/* ── Versions ── */}
        {activeTab === 'versions' && (
          <>
            <div className="sidebar__section-header open">
              <span>Lịch sử</span>
            </div>
            {VERSIONS.map((v, idx) => (
              <div key={v.id} className="sidebar__version-item">
                <div className="sidebar__version-timeline">
                  <div className={`sidebar__version-dot ${v.current ? 'current' : ''}`} />
                  {idx < VERSIONS.length - 1 && <div className="sidebar__version-line" />}
                </div>
                <div className="sidebar__version-info">
                  <div className="sidebar__version-label">
                    {v.label}
                    {v.current && (
                      <span className="badge badge-accent" style={{ marginLeft: 6 }}>Hiện tại</span>
                    )}
                  </div>
                  <div className="sidebar__version-meta">{v.meta}</div>
                </div>
              </div>
            ))}
          </>
        )}

      </div>
    </aside>
  );
};

export default Sidebar;

