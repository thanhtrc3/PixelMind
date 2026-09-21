import { Globe, Ruler, GitBranch } from 'lucide-react';
import '../styles/StatusBar.css';

const StatusBar = () => {
  return (
    <footer className="statusbar">
      {/* Left info */}
      <div className="statusbar__item clickable" data-tooltip="Mở trong trình duyệt">
        <span className="statusbar__item-icon"><Globe size={11} /></span>
        <span>localhost:5173</span>
      </div>

      <div className="statusbar__divider" />

      <div className="statusbar__item">
        <span className="statusbar__item-icon"><Ruler size={11} /></span>
        <span>1440 × 900</span>
      </div>

      <div className="statusbar__divider" />

      <div className="statusbar__item clickable">
        <span>75%</span>
      </div>

      <div className="statusbar__divider" />

      <div className="statusbar__item">
        <span>React + Vite</span>
      </div>

      <div className="statusbar__spacer" />

      {/* Git */}
      <div className="statusbar__item clickable" data-tooltip="Git branch">
        <span className="statusbar__item-icon"><GitBranch size={11} /></span>
        <span>main</span>
      </div>

      <div className="statusbar__divider" />

      {/* AI Status */}
      <div className="statusbar__ai-status working">
        <span>●</span>
        <span>AI đang sửa…</span>
      </div>
    </footer>
  );
};

export default StatusBar;
