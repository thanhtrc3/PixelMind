import {
  Undo2, Redo2, MousePointer2, Hand, Square, PenTool,
  Ruler, Columns2, Camera, Smartphone, Play, Settings, FolderOpen,
  ChevronDown, HelpCircle
} from 'lucide-react';
import '../styles/TopBar.css';

interface TopBarProps {
  onOpenGuide?: () => void;
}

const TopBar = ({ onOpenGuide }: TopBarProps) => {
  return (
    <header className="topbar">
      {/* Logo */}
      <div className="topbar__logo">
        <div className="topbar__logo-icon">UI</div>
        <span className="topbar__logo-text">UIForge <span>AI</span></span>
      </div>

      <div className="divider-v" />

      {/* Project selector */}
      <button className="topbar__project-btn" data-tooltip="Mở project">
        <FolderOpen size={13} />
        <span className="topbar__project-name">Chưa mở project</span>
        <ChevronDown size={10} className="topbar__project-caret" />
      </button>

      <div className="divider-v" />

      {/* Undo / Redo */}
      <div className="topbar__group">
        <button className="icon-btn" data-tooltip="Hoàn tác (Ctrl+Z)">
          <Undo2 size={15} />
        </button>
        <button className="icon-btn" data-tooltip="Làm lại (Ctrl+Y)">
          <Redo2 size={15} />
        </button>
      </div>

      <div className="divider-v" />

      {/* Canvas tools */}
      <div className="topbar__group">
        <button className="icon-btn active" data-tooltip="Chọn (V)">
          <MousePointer2 size={15} />
        </button>
        <button className="icon-btn" data-tooltip="Pan (H)">
          <Hand size={15} />
        </button>
        <button className="icon-btn" data-tooltip="Khoanh vùng (L)">
          <Square size={15} />
        </button>
        <button className="icon-btn" data-tooltip="Ghi chú (T)">
          <PenTool size={15} />
        </button>
        <button className="icon-btn" data-tooltip="Đo khoảng cách (M)">
          <Ruler size={15} />
        </button>
      </div>

      <div className="divider-v" />

      {/* View controls */}
      <div className="topbar__group">
        <button className="icon-btn" data-tooltip="So sánh">
          <Columns2 size={15} />
        </button>
        <button className="icon-btn" data-tooltip="Screenshot">
          <Camera size={15} />
        </button>
        <button className="icon-btn" data-tooltip="Responsive test">
          <Smartphone size={15} />
        </button>
      </div>

      <div className="topbar__spacer" />

      {/* Run */}
      <button className="topbar__run-btn" data-tooltip="Khởi động dev server">
        <Play size={13} fill="white" />
        <span>Run</span>
      </button>

      <div className="divider-v" />

      {/* Help */}
      <button className="icon-btn" data-tooltip="Hướng dẫn (F1)" onClick={onOpenGuide}>
        <HelpCircle size={15} />
      </button>

      {/* Settings & Avatar */}
      <button className="icon-btn" data-tooltip="Cài đặt">
        <Settings size={15} />
      </button>
      <div className="topbar__avatar" data-tooltip="Tài khoản">U</div>
    </header>
  );
};

export default TopBar;
