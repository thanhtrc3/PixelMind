import '../styles/TopBar.css';

const TopBar = () => {
  return (
    <header className="topbar">
      {/* Logo */}
      <div className="topbar__logo">
        <div className="topbar__logo-icon">UI</div>
        <span className="topbar__logo-text">UIForge <span>AI</span></span>
      </div>

      <div className="divider" />

      {/* Project selector */}
      <button className="topbar__project-btn" data-tooltip="Mở project">
        <span style={{ fontSize: 13 }}>📁</span>
        <span className="topbar__project-name">Chưa mở project</span>
        <span className="topbar__project-caret">▾</span>
      </button>

      <div className="divider" />

      {/* Undo / Redo */}
      <div className="topbar__group">
        <button className="icon-btn" data-tooltip="Hoàn tác (Ctrl+Z)">↩</button>
        <button className="icon-btn" data-tooltip="Làm lại (Ctrl+Y)">↪</button>
      </div>

      <div className="divider" />

      {/* Canvas tools shortcut */}
      <div className="topbar__group">
        <button className="icon-btn active" data-tooltip="Chọn (V)">↖</button>
        <button className="icon-btn" data-tooltip="Pan (H)">✋</button>
        <button className="icon-btn" data-tooltip="Khoanh vùng (L)">⬚</button>
        <button className="icon-btn" data-tooltip="Ghi chú (T)">✏️</button>
        <button className="icon-btn" data-tooltip="Đo khoảng cách (M)">↔</button>
      </div>

      <div className="divider" />

      {/* View controls */}
      <div className="topbar__group">
        <button className="icon-btn" data-tooltip="So sánh">⧈</button>
        <button className="icon-btn" data-tooltip="Screenshot">📷</button>
        <button className="icon-btn" data-tooltip="Responsive test">📱</button>
      </div>

      <div className="topbar__spacer" />

      {/* Run / Stop */}
      <button className="topbar__run-btn" data-tooltip="Khởi động dev server">
        <span>▶</span>
        <span>Run</span>
      </button>

      <div className="divider" />

      {/* Settings & Avatar */}
      <button className="icon-btn" data-tooltip="Cài đặt">⚙</button>
      <div className="topbar__avatar" data-tooltip="Tài khoản">U</div>
    </header>
  );
};

export default TopBar;

