import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import './styles/variables.css';
import './styles/global.css';
import './styles/proto.css';
import TopBar from './components/TopBar';
import Nav from './components/Nav';
import Sidebar from './components/Sidebar';
import CanvasArea from './components/CanvasArea';
import type { CanvasMode } from './components/CanvasArea';
import AIPanel from './components/AIPanel';
import StatusBar from './components/StatusBar';
import Guide from './components/Guide';
import CommandPalette from './components/CommandPalette';
import ProjectHub from './components/ProjectHub';
import Settings from './components/Settings';
import Toolbox from './components/Toolbox';
import LockScreen from './components/LockScreen';
import SectionView from './components/sections/SectionView';
import type { SectionId } from './data/sections';
import { PART_MAP } from './data/toolbox';
import type { InsertedPart } from './data/toolbox';

const App = () => {
  /* ── Màn đang mở (cột điều hướng dọc) ── */
  const [section, setSection] = useState<SectionId>('work');

  /* ── Lớp phủ ── */
  const [guideOpen, setGuideOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toolboxOpen, setToolboxOpen] = useState(false);
  const [toolboxQuery, setToolboxQuery] = useState('');
  const [locked, setLocked] = useState(false);

  /* ── Chế độ xem canvas (thanh trên cùng điều khiển được) ── */
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('live');

  /* ── Part kéo từ Thư viện Part ── */
  const [inserted, setInserted] = useState<InsertedPart[]>([]);
  const [dragPart, setDragPart] = useState<string | null>(null);
  const [attachParts, setAttachParts] = useState<string[]>([]);
  const [variantParts, setVariantParts] = useState<string[]>([]);
  const [toast, setToast] = useState<{ partId: string; msg: string } | null>(null);

  /* Thả part vào canvas: chèn code mẫu đúng token rồi tải lại trang */
  const insertPart = (partId: string) => {
    const part = PART_MAP[partId];
    if (!part || !part.draggable) return;
    setInserted((prev) => [
      ...prev,
      { uid: `${partId}-${prev.length + 1}`, partId, at: 'vừa xong' },
    ]);
    setDragPart(null);
    setToast({
      partId,
      msg: `Đã chèn part “${part.name}” vào src/pages/Home.tsx — trang đã tải lại`,
    });
  };

  const undoInsert = () => {
    setInserted((prev) => prev.slice(0, -1));
    setToast(null);
  };

  const togglePartAttachment = (partId: string) =>
    setAttachParts((prev) => (prev.includes(partId) ? prev.filter((x) => x !== partId) : [...prev, partId]));

  const togglePartVariant = (partId: string) =>
    setVariantParts((prev) => (prev.includes(partId) ? prev.filter((x) => x !== partId) : [...prev, partId]));

  /* ── Phím tắt toàn cục ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        setHubOpen(false);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setToolboxQuery('');
        setToolboxOpen((v) => !v);
        setPaletteOpen(false);
      } else if (mod && e.key === ',') {
        e.preventDefault();
        setSettingsOpen((v) => !v);
        setPaletteOpen(false);
        setHubOpen(false);
      } else if (mod && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setHubOpen(true);
        setPaletteOpen(false);
      } else if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        /* Undo như mọi sửa tay khác: hoàn tác lần chèn part gần nhất */
        setInserted((prev) => (prev.length ? prev.slice(0, -1) : prev));
        setToast(null);
      } else if (e.key === 'F1') {
        e.preventDefault();
        setGuideOpen(true);
      } else if (e.key === 'Escape') {
        setPaletteOpen(false);
        setSettingsOpen(false);
        setToolboxOpen(false);
        setHubOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ── Điều hướng: “Thư viện Part” mở hộp Search Toolbox, không phải màn riêng ── */
  const openBox = (query = '') => {
    setToolboxQuery(query);
    setToolboxOpen(true);
  };

  const goto = (id: SectionId) => {
    if (id === 'parts') {
      /* “Thư viện Part” không còn là màn riêng: về màn hình làm việc rồi mở hộp Search Toolbox */
      setSection('work');
      openBox('');
      return;
    }
    setSection(id);
  };

  return (
    <div className="app">
      {/* Thanh trên cùng */}
      <TopBar
        onOpenGuide={() => setGuideOpen(true)}
        onOpenHub={() => setHubOpen(true)}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onUndo={undoInsert}
        undoCount={inserted.length}
        projectName="ShopWeb"
        onSection={goto}
        onLogout={() => setLocked(true)}
        onCanvasMode={(m) => setCanvasMode(m === 'side' ? 'compare' : 'live')}
      />

      <div className="app__body">
        {/* Cột điều hướng dọc — thu gọn thành dải icon khi ở màn hình làm việc */}
        <Nav section={section} onSection={goto} mini={section === 'work'} onLogout={() => setLocked(true)} />

        <div className="app__main">
          {/* Vùng làm việc 3 cột — giữ nguyên trạng thái khi đổi màn khác */}
          <div className="app__pane" style={{ display: section === 'work' ? 'flex' : 'none' }}>
            <Group orientation="horizontal" style={{ flex: 1, minHeight: 0 }}>
              <Panel defaultSize="284px" minSize="220px" maxSize="420px" collapsible>
                <Sidebar
                  inserted={inserted}
                  onOpenToolbox={(q) => {
                    setToolboxQuery(q);
                    setToolboxOpen(true);
                  }}
                />
              </Panel>
              <Separator />

              <Panel minSize="34%">
                <CanvasArea
                  inserted={inserted}
                  draggingPartId={dragPart}
                  mode={canvasMode}
                  onModeChange={setCanvasMode}
                  onDropPart={(id) => {
                    insertPart(id);
                    setToolboxOpen(false);
                  }}
                />
              </Panel>
              <Separator />

              <Panel defaultSize="320px" minSize="280px" maxSize="520px" collapsible>
                <AIPanel
                  partAttachments={attachParts.map((id) => PART_MAP[id]).filter(Boolean)}
                  variantParts={variantParts}
                  onRemovePart={(id) => setAttachParts((prev) => prev.filter((x) => x !== id))}
                />
              </Panel>
            </Group>
          </div>

          {/* Các màn quản lý (“Thư viện Part” mở hộp riêng nên không tính là màn) */}
          {section !== 'work' && section !== 'parts' && (
            <SectionView
              section={section}
              onSection={goto}
            />
          )}
        </div>
      </div>

      {/* Thanh trạng thái */}
      <StatusBar zoom={100} viewport="1440 × 900" version="v3" licenseDays={12} aiState="working" />

      {/* Lớp phủ */}
      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onOpenGuide={() => setGuideOpen(true)}
        onOpenHub={() => setHubOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenToolbox={() => {
          openBox('');
        }}
      />
      <ProjectHub
        isOpen={hubOpen}
        onClose={() => setHubOpen(false)}
        onOpenProject={() => {
          setHubOpen(false);
          setSection('work');
        }}
      />
      <Settings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <Toolbox
        isOpen={toolboxOpen}
        onClose={() => {
          setToolboxOpen(false);
          setDragPart(null);
        }}
        onInsert={insertPart}
        onDragStart={setDragPart}
        onDragEnd={() => setDragPart(null)}
        inserted={inserted.map((p) => p.partId)}
        attached={attachParts}
        onToggleAttach={togglePartAttachment}
        variants={variantParts}
        onToggleVariant={togglePartVariant}
        initialQuery={toolboxQuery}
      />
      <Guide isOpen={guideOpen} onClose={() => setGuideOpen(false)} />

      {/* Màn đăng nhập khi bấm Đăng xuất */}
      {locked && <LockScreen onCancel={() => setLocked(false)} onLogin={() => setLocked(false)} />}

      {/* Thông báo sau khi chèn part — có nút Hoàn tác như mọi sửa tay khác */}
      {toast && (
        <div className="toast slide-up" role="status">
          <span className="toast__ico"><Check size={13} /></span>
          <div className="toast__text">
            <strong>Đã chèn part</strong>
            <span>{toast.msg}</span>
          </div>
          <button className="btn btn-sm toast__undo" onClick={undoInsert}>Hoàn tác</button>
          <button className="toast__x" onClick={() => setToast(null)} aria-label="Đóng thông báo">
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
