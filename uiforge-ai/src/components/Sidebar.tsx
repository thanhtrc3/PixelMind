import { useState } from 'react';
import {
  Layers, FileText, Image, FolderTree, History,
  ChevronRight, Plus, Box, Type, SquareIcon, CircleDot, LayoutGrid
} from 'lucide-react';
import '../styles/Sidebar.css';

type SidebarTab = 'layers' | 'pages' | 'assets' | 'files' | 'versions';

const LAYERS = [
  { id: 1, icon: LayoutGrid, label: 'Frame / Desktop', indent: 0, active: true },
  { id: 2, icon: Box, label: 'Header', indent: 1 },
  { id: 3, icon: SquareIcon, label: 'Logo', indent: 2 },
  { id: 4, icon: SquareIcon, label: 'Nav Menu', indent: 2 },
  { id: 5, icon: CircleDot, label: 'CTA Button', indent: 2 },
  { id: 6, icon: Box, label: 'Hero Section', indent: 1 },
  { id: 7, icon: Type, label: 'Hero Text', indent: 2 },
  { id: 8, icon: SquareIcon, label: 'Hero Image', indent: 2 },
  { id: 9, icon: Box, label: 'Footer', indent: 1 },
];

const PAGES = [
  { id: 1, label: 'Home', active: true },
  { id: 2, label: 'About' },
  { id: 3, label: 'Products' },
  { id: 4, label: 'Contact' },
  { id: 5, label: 'Login' },
];

const ASSETS = [
  { id: 1, label: 'hero-design.png' },
  { id: 2, label: 'mobile-mockup.png' },
  { id: 3, label: 'logo-ref.png' },
  { id: 4, label: 'button-spec.png' },
];

const FILES = [
  { id: 1, icon: FolderTree, label: 'src/', indent: 0 },
  { id: 2, icon: FileText, label: 'App.tsx', indent: 1 },
  { id: 3, icon: FileText, label: 'main.tsx', indent: 1 },
  { id: 4, icon: FolderTree, label: 'components/', indent: 1 },
  { id: 5, icon: FileText, label: 'Header.tsx', indent: 2 },
  { id: 6, icon: FileText, label: 'Hero.tsx', indent: 2 },
  { id: 7, icon: FileText, label: 'Footer.tsx', indent: 2 },
  { id: 8, icon: FolderTree, label: 'styles/', indent: 1 },
  { id: 9, icon: FileText, label: 'App.css', indent: 2, active: true },
];

const VERSIONS = [
  { id: 1, label: 'v4 — Fix Button Radius', meta: '5 phút trước', current: true },
  { id: 2, label: 'v3 — Fix Mobile Layout', meta: '1 giờ trước', current: false },
  { id: 3, label: 'v2 — Fix Header', meta: 'Hôm qua', current: false },
  { id: 4, label: 'v1 — Initial UI', meta: '2 ngày trước', current: false },
];

const TAB_ICONS: Record<SidebarTab, typeof Layers> = {
  layers: Layers,
  pages: FileText,
  assets: Image,
  files: FolderTree,
  versions: History,
};

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
        {tabs.map((t) => {
          const Icon = TAB_ICONS[t.key];
          return (
            <button
              key={t.key}
              className={`sidebar__tab ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}
              data-tooltip={t.label}
            >
              <Icon size={13} />
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="sidebar__content">

        {/* ── Layers ── */}
        {activeTab === 'layers' && (
          <>
            <div className="sidebar__section-header">
              <span>Component Tree</span>
              <ChevronRight size={12} />
            </div>
            {LAYERS.map((l) => {
              const Icon = l.icon;
              return (
                <div
                  key={l.id}
                  className={`sidebar__item ${l.active ? 'active' : ''} ${
                    l.indent === 1 ? 'sidebar__item--indent1' : l.indent === 2 ? 'sidebar__item--indent2' : ''
                  }`}
                >
                  <span className="sidebar__item-icon"><Icon size={13} /></span>
                  <span className="sidebar__item-label">{l.label}</span>
                </div>
              );
            })}
          </>
        )}

        {/* ── Pages ── */}
        {activeTab === 'pages' && (
          <>
            <div className="sidebar__section-header">
              <span>Trang</span>
              <button className="icon-btn" style={{ width: 20, height: 20 }}>
                <Plus size={12} />
              </button>
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
            <div className="sidebar__section-header">
              <span>Ảnh tham chiếu</span>
              <button className="icon-btn" style={{ width: 20, height: 20 }}>
                <Plus size={12} />
              </button>
            </div>
            <div className="sidebar__asset-grid">
              {ASSETS.map((a) => (
                <div key={a.id} className="sidebar__asset-thumb">
                  <div className="sidebar__asset-placeholder-icon">
                    <Image size={18} />
                  </div>
                  <span className="sidebar__asset-thumb-name">{a.label}</span>
                </div>
              ))}
              <div className="sidebar__asset-thumb" style={{ borderStyle: 'dashed' }}>
                <div className="sidebar__asset-placeholder-icon">
                  <Plus size={18} />
                </div>
                <span className="sidebar__asset-thumb-name">Thêm ảnh</span>
              </div>
            </div>
          </>
        )}

        {/* ── Files ── */}
        {activeTab === 'files' && (
          <>
            <div className="sidebar__section-header">
              <span>Project Files</span>
              <ChevronRight size={12} />
            </div>
            {FILES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.id}
                  className={`sidebar__item ${f.active ? 'active' : ''} ${
                    f.indent === 1 ? 'sidebar__item--indent1' : f.indent === 2 ? 'sidebar__item--indent2' : ''
                  }`}
                >
                  <span className="sidebar__item-icon"><Icon size={13} /></span>
                  <span className="sidebar__item-label">{f.label}</span>
                </div>
              );
            })}
          </>
        )}

        {/* ── Versions ── */}
        {activeTab === 'versions' && (
          <>
            <div className="sidebar__section-header">
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
                      <span className="badge badge-accent">Hiện tại</span>
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
