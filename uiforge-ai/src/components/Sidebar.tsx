import { useState } from 'react';
import {
  Layers, FileText, Image as ImageIcon, FolderTree, History, Palette,
  ChevronRight, ChevronDown, Plus, Eye, EyeOff, Search, Box, Type,
  Square, Circle, LayoutGrid, FileCode2, Sparkles, Contrast, Ruler,
  Smartphone, PanelTop, RotateCcw, Check, Package, Wand2, Lock,
} from 'lucide-react';
import { PART_MAP, PARTS } from '../data/toolbox';
import type { InsertedPart } from '../data/toolbox';
import '../styles/Sidebar.css';

type SidebarTab = 'layers' | 'pages' | 'assets' | 'files' | 'versions' | 'design' | 'part';

const LAYERS = [
  { id: 1, icon: LayoutGrid, label: 'Frame · Desktop 1440', depth: 0, kind: 'frame', open: true, active: false },
  { id: 2, icon: Box, label: 'Header', depth: 1, kind: 'section', open: true, active: true },
  { id: 3, icon: Square, label: 'Logo', depth: 2, kind: 'el' },
  { id: 4, icon: Type, label: 'Nav Menu', depth: 2, kind: 'el' },
  { id: 5, icon: Circle, label: 'CTA Button', depth: 2, kind: 'el', fixed: true },
  { id: 6, icon: Box, label: 'Hero Section', depth: 1, kind: 'section', open: true },
  { id: 7, icon: Type, label: 'Hero Title', depth: 2, kind: 'text' },
  { id: 8, icon: Type, label: 'Hero Subtitle', depth: 2, kind: 'text' },
  { id: 9, icon: Square, label: 'Hero Image', depth: 2, kind: 'el' },
  { id: 10, icon: Box, label: 'Feature Grid', depth: 1, kind: 'section', open: false },
  { id: 11, icon: Box, label: 'Footer', depth: 1, kind: 'section', open: false },
];

const PAGES = [
  { id: 1, label: 'Home', route: '/', ref: true, active: true, issues: 2 },
  { id: 2, label: 'About', route: '/about', ref: false, active: false },
  { id: 3, label: 'Products', route: '/products', ref: true, active: false, issues: 5 },
  { id: 4, label: 'Contact', route: '/contact', ref: false, active: false },
  { id: 5, label: 'Login', route: '/login', ref: true, active: false, issues: 1 },
];

const ASSETS = [
  { id: 1, label: 'home-desktop.png', meta: '1440×900 · Figma' },
  { id: 2, label: 'home-mobile.png', meta: '390×844 · Figma' },
  { id: 3, label: 'login-spec.png', meta: '1440×900 · Photoshop' },
  { id: 4, label: 'button-states.png', meta: 'Illustrator' },
];

const FILES = [
  { id: 1, icon: FolderTree, label: 'src', depth: 0, dir: true, open: true },
  { id: 2, icon: FileCode2, label: 'App.tsx', depth: 1, changed: false },
  { id: 3, icon: FileCode2, label: 'main.tsx', depth: 1, changed: false },
  { id: 4, icon: FolderTree, label: 'components', depth: 1, dir: true, open: true },
  { id: 5, icon: FileCode2, label: 'Header.tsx', depth: 2, changed: true },
  { id: 6, icon: FileCode2, label: 'Hero.tsx', depth: 2, changed: false },
  { id: 7, icon: FileCode2, label: 'Footer.tsx', depth: 2, changed: false },
  { id: 8, icon: FolderTree, label: 'styles', depth: 1, dir: true, open: true },
  { id: 9, icon: FileText, label: 'Header.css', depth: 2, changed: true, active: true },
];

const VERSIONS = [
  { id: 1, label: 'v4 · Sửa bo góc nút', meta: '5 phút trước · AI', hash: 'a1f9c2', current: true },
  { id: 2, label: 'v3 · Sửa layout mobile', meta: '1 giờ trước · AI', hash: '7d3b81' },
  { id: 3, label: 'v2 · Sửa Header', meta: 'Hôm qua · Kéo thả', hash: '22ce90' },
  { id: 4, label: 'v1 · Giao diện đầu tiên', meta: '2 ngày trước · Kéo thả', hash: 'b40d17' },
];

const SKILLS = [
  { id: 'review-ui', label: 'review-UI', desc: 'Soi toàn bộ giao diện, chấm điểm & liệt kê lỗi' },
  { id: 'fix-spacing', label: 'fix-spacing', desc: 'Chuẩn hoá padding / margin theo token' },
  { id: 'responsive-check', label: 'responsive-check', desc: 'Kiểm tra 390 · 768 · 1440' },
];

const TEMPLATES = [
  { id: 'landing', label: 'Landing', icon: PanelTop, tint: 'var(--accent)' },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid, tint: 'var(--color-info)' },
  { id: 'mobile', label: 'Mobile App', icon: Smartphone, tint: 'var(--color-success)' },
];

const SWATCHES = [
  { name: '--accent', value: 'hsl(262 82% 66%)', color: 'var(--accent)' },
  { name: '--bg-base', value: 'hsl(250 22% 5%)', color: 'var(--bg-base)' },
  { name: '--success', value: 'hsl(152 62% 48%)', color: 'var(--color-success)' },
  { name: '--warning', value: 'hsl(38 92% 58%)', color: 'var(--color-warning)' },
  { name: '--error', value: 'hsl(358 78% 62%)', color: 'var(--color-error)' },
  { name: '--info', value: 'hsl(212 92% 64%)', color: 'var(--color-info)' },
];

const TAB_ICONS: Record<SidebarTab, typeof Layers> = {
  layers: Layers,
  pages: FileText,
  assets: ImageIcon,
  files: FolderTree,
  versions: History,
  design: Palette,
  part: Package,
};

interface SidebarProps {
  /** Part đã kéo từ Search Toolbox vào khung, hiện thành hàng trong cây phần tử */
  inserted?: InsertedPart[];
  /** Mở Thư viện Part kèm từ khoá tìm sẵn */
  onOpenToolbox?: (query: string) => void;
  /** Mở màn Thư viện Part (tab Part → nút “Mở thư viện Part”) */
  onOpenParts?: () => void;
}

const Sidebar = ({ inserted = [], onOpenToolbox, onOpenParts }: SidebarProps) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('layers');
  const [hidden, setHidden] = useState<number[]>([8]);
  const [hiddenParts, setHiddenParts] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [designTab, setDesignTab] = useState<'tokens' | 'templates' | 'skills'>('tokens');

  const tabs: { key: SidebarTab; label: string }[] = [
    { key: 'layers', label: 'Layers' },
    { key: 'pages', label: 'Pages' },
    { key: 'assets', label: 'Assets' },
    { key: 'files', label: 'Files' },
    { key: 'versions', label: 'Phiên bản' },
    { key: 'design', label: 'Design' },
    { key: 'part', label: 'Part' },
  ];

  const toggleHidden = (id: number) =>
    setHidden((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]));

  const togglePartHidden = (uid: string) =>
    setHiddenParts((h) => (h.includes(uid) ? h.filter((x) => x !== uid) : [...h, uid]));

  const ind = (d: number) => ({ paddingLeft: `${7 + d * 12}px` });
  const q = query.trim().toLowerCase();

  /* Một hàng trong cây phần tử */
  const layerRow = (l: (typeof LAYERS)[number]) => (
    <div
      key={l.id}
      className={`sidebar__row ${l.active ? 'active' : ''} ${hidden.includes(l.id) ? 'is-hidden' : ''}`}
      style={ind(l.depth)}
    >
      {l.kind === 'section' || l.kind === 'frame' ? (
        <span className="sidebar__row-caret">{l.open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</span>
      ) : (
        <span className="sidebar__row-caret" />
      )}
      <span className="sidebar__row-icon"><l.icon size={13} /></span>
      <span className="sidebar__row-label">{l.label}</span>
      {l.fixed && <span className="sidebar__row-lock"><Lock size={10} /></span>}
      <button
        className="sidebar__row-eye"
        onClick={(e) => { e.stopPropagation(); toggleHidden(l.id); }}
      >
        {hidden.includes(l.id) ? <EyeOff size={11} /> : <Eye size={11} />}
      </button>
    </div>
  );

  /* Hàng của part vừa kéo từ Search Toolbox */
  const partRow = (p: InsertedPart) => {
    const part = PART_MAP[p.partId];
    if (!part) return null;
    return (
      <div
        key={p.uid}
        className={`sidebar__row sidebar__row--part ${hiddenParts.includes(p.uid) ? 'is-hidden' : ''}`}
        style={ind(2)}
      >
        <span className="sidebar__row-caret" />
        <span className="sidebar__row-icon"><Package size={13} /></span>
        <span className="sidebar__row-label">{part.name}</span>
        <span
          className="sidebar__part-tag"
          data-tooltip={`Part · ${part.id} · v${part.version}`}
          data-tooltip-pos="right"
        >
          part
        </span>
        <button
          className="sidebar__row-eye"
          onClick={(e) => { e.stopPropagation(); togglePartHidden(p.uid); }}
        >
          {hiddenParts.includes(p.uid) ? <EyeOff size={11} /> : <Eye size={11} />}
        </button>
      </div>
    );
  };

  return (
    <aside className="sidebar">
      {/* ── Tab dọc ── */}
      <div className="sidebar__tabs">
        {tabs.map((t) => {
          const Icon = TAB_ICONS[t.key];
          return (
            <button
              key={t.key}
              className={`sidebar__tab ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}
              data-tooltip={t.label}
              data-tooltip-pos="right"
            >
              <Icon size={15} />
            </button>
          );
        })}
      </div>

      {/* ── Thân ── */}
      <div className="sidebar__body">
        {/* Ô Search Toolbox (mục 2.13): gõ “search” là ra part nhóm searchbox kèm ảnh */}
        <button
          className="sidebar__toolbox"
          onClick={() => onOpenToolbox?.('')}
          data-tooltip="Search Toolbox — thư viện part"
          data-tooltip-pos="right"
        >
          <span className="sidebar__toolbox-ico"><Wand2 size={13} /></span>
          <span className="sidebar__toolbox-text">
            <strong>Search Toolbox</strong>
            <em>Gõ “search” để tìm part…</em>
          </span>
          <span className="kbd">⌘⇧P</span>
        </button>

        {/* ══════════ LAYERS ══════════ */}
        {activeTab === 'layers' && (
          <>
            <div className="sidebar__head">
              <span className="sidebar__head-title">Cây phần tử</span>
              <span className="badge badge-neutral">{LAYERS.length + inserted.length}</span>
            </div>
            <div className="sidebar__search">
              <Search size={12} />
              <input placeholder="Tìm phần tử, class…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="sidebar__scroll">
              {LAYERS.slice(0, 9).filter((l) => !q || l.label.toLowerCase().includes(q)).map(layerRow)}
              {inserted
                .filter((p) => {
                  const part = PART_MAP[p.partId];
                  return part && (!q || part.name.toLowerCase().includes(q) || part.id.includes(q));
                })
                .map(partRow)}
              {LAYERS.slice(9).filter((l) => !q || l.label.toLowerCase().includes(q)).map(layerRow)}
              <div className="sidebar__hint-line">
                <Sparkles size={11} /> Kéo part từ Search Toolbox (Ctrl+Shift+P) vào canvas
              </div>
            </div>
          </>
        )}

        {/* ══════════ PAGES ══════════ */}
        {activeTab === 'pages' && (
          <>
            <div className="sidebar__head">
              <span className="sidebar__head-title">Trang dự án</span>
              <button className="icon-btn sm"><Plus size={13} /></button>
            </div>
            <div className="sidebar__scroll">
              {PAGES.map((p) => (
                <div key={p.id} className={`sidebar__page ${p.active ? 'active' : ''}`}>
                  <span className="sidebar__page-dot" />
                  <div className="sidebar__page-text">
                    <span className="sidebar__page-name">{p.label}</span>
                    <span className="sidebar__page-route">{p.route}</span>
                  </div>
                  {p.ref ? (
                    <span className="sidebar__page-ref" data-tooltip="Đã có ảnh mẫu" data-tooltip-pos="dr"><ImageIcon size={12} /></span>
                  ) : (
                    <span className="sidebar__page-ref missing" data-tooltip="Chưa có ảnh mẫu" data-tooltip-pos="dr"><Plus size={12} /></span>
                  )}
                  {!!p.issues && <span className="badge badge-error">{p.issues}</span>}
                </div>
              ))}
              <button className="sidebar__add-row"><Plus size={13} /> Thêm trang</button>
            </div>
          </>
        )}

        {/* ══════════ ASSETS ══════════ */}
        {activeTab === 'assets' && (
          <>
            <div className="sidebar__head">
              <span className="sidebar__head-title">Ảnh tham chiếu</span>
              <button className="icon-btn sm"><Plus size={13} /></button>
            </div>
            <div className="sidebar__scroll">
              <div className="sidebar__asset-grid">
                {ASSETS.map((a) => (
                  <div key={a.id} className="sidebar__asset">
                    <div className="sidebar__asset-thumb">
                      <span className="sidebar__asset-ph" />
                      <span className="sidebar__asset-ph short" />
                      <span className="sidebar__asset-ph" />
                    </div>
                    <span className="sidebar__asset-name">{a.label}</span>
                    <span className="sidebar__asset-meta">{a.meta}</span>
                  </div>
                ))}
                <div className="sidebar__asset dashed">
                  <div className="sidebar__asset-thumb center"><Plus size={16} /></div>
                  <span className="sidebar__asset-name">Dán / kéo ảnh</span>
                  <span className="sidebar__asset-meta">PNG · JPG · WebP</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ══════════ FILES ══════════ */}
        {activeTab === 'files' && (
          <>
            <div className="sidebar__head">
              <span className="sidebar__head-title">Mã nguồn</span>
              <span className="badge badge-warning">2 đã sửa</span>
            </div>
            <div className="sidebar__search">
              <Search size={12} />
              <input placeholder="Tìm file…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="sidebar__scroll">
              {FILES.filter((f) => !q || f.label.toLowerCase().includes(q)).map((f) => (
                <div
                  key={f.id}
                  className={`sidebar__row ${f.active ? 'active' : ''}`}
                  style={ind(f.depth)}
                >
                  <span className="sidebar__row-caret">
                    {f.dir ? (f.open ? <ChevronDown size={11} /> : <ChevronRight size={11} />) : null}
                  </span>
                  <span className={`sidebar__row-icon ${f.dir ? 'is-dir' : ''}`}><f.icon size={13} /></span>
                  <span className="sidebar__row-label">{f.label}</span>
                  {f.changed && <span className="sidebar__row-changed" data-tooltip="File vừa được sửa" data-tooltip-pos="dr" />}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ══════════ VERSIONS ══════════ */}
        {activeTab === 'versions' && (
          <>
            <div className="sidebar__head">
              <span className="sidebar__head-title">Lịch sử phiên bản</span>
              <button className="icon-btn sm" data-tooltip="Quay lại bản trước" data-tooltip-pos="dr"><RotateCcw size={13} /></button>
            </div>
            <div className="sidebar__scroll">
              <div className="sidebar__version">
                {VERSIONS.map((v, i) => (
                  <div key={v.id} className="sidebar__version-row">
                    <div className="sidebar__version-rail">
                      <span className={`sidebar__version-dot ${v.current ? 'current' : ''}`} />
                      {i < VERSIONS.length - 1 && <span className="sidebar__version-line" />}
                    </div>
                    <div className="sidebar__version-card">
                      <div className="sidebar__version-top">
                        <span className="sidebar__version-label">{v.label}</span>
                        {v.current && <span className="badge badge-accent">Hiện tại</span>}
                      </div>
                      <div className="sidebar__version-meta">{v.meta}</div>
                      <div className="sidebar__version-actions">
                        <code className="sidebar__version-hash">{v.hash}</code>
                        <span className="sidebar__version-links">
                          <button className="sidebar__mini-btn">Diff</button>
                          {!v.current && <button className="sidebar__mini-btn strong">Khôi phục</button>}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ══════════ DESIGN SYSTEM ══════════ */}
        {/* ══════════ PART ══════════ */}
        {activeTab === 'part' && (
          <>
            <div className="sidebar__head">
              <span className="sidebar__head-title">Part</span>
              <span className="badge badge-neutral">1440×900</span>
            </div>
            <div className="sidebar__search">
              <Search size={12} />
              <input
                placeholder="Tìm part: gõ 'search', 'bo tròn', 'card'…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="sidebar__scroll">
              {PARTS.filter((p) => {
                const q = query.trim().toLowerCase();
                return !q || [p.name, p.id, ...p.tags, ...p.groups].join(' ').toLowerCase().includes(q);
              })
                .slice(0, 8)
                .map((p) => (
                  <button
                    key={p.id}
                    className="ritem"
                    style={{ width: '100%', background: 'none', textAlign: 'left' }}
                    onClick={() => onOpenToolbox?.(p.name)}
                    data-tooltip="Mở thư viện Part với part này"
                    data-tooltip-pos="dr"
                  >
                    <span className="av">
                      <Package size={13} />
                    </span>
                    <span className="grow">
                      <span className="nm" style={{ display: 'block' }}>{p.name}</span>
                      <span className="mt" style={{ display: 'block' }}>
                        {p.groups[0]} · {p.uses} lượt kéo
                      </span>
                    </span>
                    <ChevronRight size={13} className="dim" />
                  </button>
                ))}
              <button className="btn primary wide" style={{ marginTop: 8 }} onClick={onOpenParts}>
                <Package size={13} /> Mở thư viện Part
              </button>
              <div className="sidebar__hint-line">
                <Sparkles size={11} /> Kéo part vào canvas để chèn code đúng token, hoặc nhờ AI ghép
                2-3 part thành 1 trang.
              </div>
            </div>
          </>
        )}

        {activeTab === 'design' && (
          <>
            <div className="sidebar__head">
              <span className="sidebar__head-title">Design system</span>
              <button className="icon-btn sm" data-tooltip="Đồng bộ vào tokens.css" data-tooltip-pos="dr"><Check size={13} /></button>
            </div>
            <div className="sidebar__scroll">
              <div className="design-file">
                <FileText size={13} />
                <div>
                  <div className="design-file-name">DESIGN.md</div>
                  <div className="design-file-meta">v1.2 · 48 dòng · nhóm PixelMind</div>
                </div>
              </div>

              <div className="design-seg">
                {([['tokens', 'Tokens'], ['templates', 'Template'], ['skills', 'Skill']] as const).map(([k, l]) => (
                  <button
                    key={k}
                    className={`design-seg-btn ${designTab === k ? 'active' : ''}`}
                    onClick={() => setDesignTab(k)}
                  >
                    {l}
                  </button>
                ))}
              </div>

              {designTab === 'tokens' && (
                <>
                  <div className="design-note">
                    AI đọc <code>DESIGN.md</code> + <code>tokens.css</code> trước khi sửa, nên không phải mô tả lại
                    thương hiệu mỗi lần.
                  </div>
                  <div className="design-colors">
                    {SWATCHES.map((s) => (
                      <div key={s.name} className="design-color">
                        <span className="design-color-chip" style={{ background: s.color }} />
                        <span className="design-color-name">{s.name}</span>
                        <span className="design-color-val">{s.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="design-sub">Bo góc</div>
                  <div className="design-radii">
                    <span className="design-radius r-sm">6</span>
                    <span className="design-radius r-md">8</span>
                    <span className="design-radius r-lg">12</span>
                    <span className="design-radius r-xl">16</span>
                  </div>

                  <div className="design-sub">Kiểu chữ</div>
                  <div className="design-type">
                    <div className="design-type-row"><span className="design-type-a">Aa</span> Inter · giao diện</div>
                    <div className="design-type-row mono"><span className="design-type-a">Aa</span> JetBrains Mono · mã &amp; CSS</div>
                  </div>
                </>
              )}

              {designTab === 'templates' && (
                <div className="design-list">
                  {TEMPLATES.map((t) => (
                    <button key={t.id} className="design-template">
                      <span className="design-template-icon" style={{ color: t.tint }}>
                        <t.icon size={15} />
                      </span>
                      <span className="design-template-label">{t.label}</span>
                      <Plus size={12} className="design-template-plus" />
                    </button>
                  ))}
                </div>
              )}

              {designTab === 'skills' && (
                <div className="design-list">
                  {SKILLS.map((s) => (
                    <div key={s.id} className="design-skill">
                      <span className="design-skill-icon"><Sparkles size={13} /></span>
                      <div>
                        <div className="design-skill-label">{s.label}.md</div>
                        <div className="design-skill-desc">{s.desc}</div>
                      </div>
                    </div>
                  ))}
                  <div className="design-note">
                    <Contrast size={11} /> Kèm <code>prompts.md</code> gồm 5 câu lệnh mẫu dùng nhiều nhất
                  </div>
                  <div className="design-hint"><Ruler size={11} /> Mọi part trong Toolbox bắt buộc dùng biến tokens</div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
