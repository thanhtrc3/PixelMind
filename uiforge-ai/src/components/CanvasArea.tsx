import { useState } from 'react';
import '../styles/Canvas.css';

type CanvasMode = 'reference' | 'live' | 'sidebyside' | 'overlay' | 'diff';
type Viewport = 'mobile' | 'tablet' | 'desktop' | 'wide';

const CANVAS_MODES: { key: CanvasMode; label: string }[] = [
  { key: 'reference', label: 'Reference' },
  { key: 'live', label: 'Live Preview' },
  { key: 'sidebyside', label: 'Side-by-Side' },
  { key: 'overlay', label: 'Overlay' },
  { key: 'diff', label: 'Diff' },
];

const VIEWPORTS: { key: Viewport; label: string; icon: string; w: number; h: number }[] = [
  { key: 'mobile', label: 'Mobile', icon: '📱', w: 390, h: 844 },
  { key: 'tablet', label: 'Tablet', icon: '📟', w: 768, h: 1024 },
  { key: 'desktop', label: 'Desktop', icon: '🖥', w: 1440, h: 900 },
  { key: 'wide', label: '1920', icon: '⬛', w: 1920, h: 1080 },
];

const CanvasArea = () => {
  const [mode, setMode] = useState<CanvasMode>('live');
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [overlayOpacity, setOverlayOpacity] = useState(50);

  const currentVP = VIEWPORTS.find((v) => v.key === viewport)!;

  return (
    <main className="canvas-area">
      {/* Canvas Toolbar */}
      <div className="canvas-toolbar">
        {/* Mode switcher */}
        <div className="canvas-modes">
          {CANVAS_MODES.map((m) => (
            <button
              key={m.key}
              className={`canvas-mode-btn ${mode === m.key ? 'active' : ''}`}
              onClick={() => setMode(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Viewport selector */}
        <div className="viewport-selector">
          {VIEWPORTS.map((vp) => (
            <button
              key={vp.key}
              className={`viewport-btn ${viewport === vp.key ? 'active' : ''}`}
              onClick={() => setViewport(vp.key)}
              data-tooltip={`${vp.w} × ${vp.h}`}
            >
              <span>{vp.icon}</span>
              <span>{vp.label}</span>
            </button>
          ))}
        </div>

        <div className="divider" />

        {/* Zoom */}
        <button className="icon-btn" data-tooltip="Zoom out">−</button>
        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', minWidth: 32, textAlign: 'center' }}>
          75%
        </span>
        <button className="icon-btn" data-tooltip="Zoom in">+</button>
        <button className="icon-btn" data-tooltip="Fit to screen">⊡</button>
      </div>

      {/* Canvas Viewport */}
      <div className="canvas-viewport">

        {/* ── Reference Mode ── */}
        {mode === 'reference' && (
          <div className="canvas-placeholder">
            <div className="canvas-placeholder-icon">🖼</div>
            <div className="canvas-placeholder-title">Chưa có ảnh tham chiếu</div>
            <div className="canvas-placeholder-sub">
              Kéo thả hoặc nhập ảnh thiết kế từ Figma, Photoshop, Screenshot…
            </div>
            <div className="canvas-placeholder-actions">
              <button className="canvas-action-btn primary">+ Nhập ảnh</button>
              <button className="canvas-action-btn">Dán từ clipboard</button>
            </div>
          </div>
        )}

        {/* ── Live Preview Mode ── */}
        {mode === 'live' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div className="canvas-frame-label">
              <div className="canvas-frame-label-dot" />
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)' }}>
                localhost:5173 — {currentVP.w} × {currentVP.h}
              </span>
            </div>
            <div
              className="canvas-frame"
              style={{
                width: Math.min(currentVP.w * 0.55, 900),
                height: Math.min(currentVP.h * 0.55, 600),
              }}
            >
              {/* Placeholder web content */}
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: '#f8f9fa',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  color: '#666',
                  fontSize: 13,
                  fontFamily: 'sans-serif',
                }}
              >
                <div style={{ fontSize: 32, opacity: 0.2 }}>🌐</div>
                <div style={{ fontWeight: 600 }}>Dev Server chưa chạy</div>
                <div style={{ fontSize: 12, opacity: 0.6 }}>Nhấn Run để khởi động project</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Side-by-Side Mode ── */}
        {mode === 'sidebyside' && (
          <div className="canvas-split">
            <div className="canvas-split-pane">
              <div className="canvas-split-pane-label">
                <span>🖼</span> REFERENCE
              </div>
              <div className="canvas-split-pane-content">
                Chưa có ảnh tham chiếu
              </div>
            </div>
            <div className="canvas-split-pane">
              <div className="canvas-split-pane-label">
                <span style={{ color: 'var(--color-success)' }}>●</span> LIVE PREVIEW
              </div>
              <div className="canvas-split-pane-content">
                Dev server chưa chạy
              </div>
            </div>
          </div>
        )}

        {/* ── Overlay Mode ── */}
        {mode === 'overlay' && (
          <>
            <div className="canvas-placeholder">
              <div className="canvas-placeholder-icon">⧉</div>
              <div className="canvas-placeholder-title">Chế độ Overlay</div>
              <div className="canvas-placeholder-sub">
                Chồng ảnh mẫu lên Live Preview để thấy sự khác biệt trực tiếp
              </div>
              <div className="canvas-placeholder-actions">
                <button className="canvas-action-btn">+ Nhập ảnh mẫu</button>
              </div>
            </div>
            <div className="canvas-overlay-controls">
              <span className="canvas-overlay-label">Reference</span>
              <input
                type="range"
                min={0}
                max={100}
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                className="canvas-overlay-slider"
              />
              <span className="canvas-overlay-label">Live {overlayOpacity}%</span>
            </div>
          </>
        )}

        {/* ── Diff Mode ── */}
        {mode === 'diff' && (
          <div className="canvas-placeholder">
            <div className="canvas-placeholder-icon">🔍</div>
            <div className="canvas-placeholder-title">Visual Diff</div>
            <div className="canvas-placeholder-sub">
              So sánh pixel-by-pixel giữa ảnh mẫu và giao diện hiện tại.<br />
              Vùng sai lệch sẽ được đánh dấu màu đỏ.
            </div>
            <div className="canvas-placeholder-actions">
              <button className="canvas-action-btn primary">Chạy so sánh</button>
            </div>
          </div>
        )}

      </div>
    </main>
  );
};

export default CanvasArea;

