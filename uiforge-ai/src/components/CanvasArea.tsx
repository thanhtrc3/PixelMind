import { useState } from 'react';
import {
  Image, Globe, Columns2, Layers, Search,
  Smartphone, Tablet, Monitor, MonitorUp,
  ZoomOut, ZoomIn, Maximize2, Plus, ClipboardPaste,
  Play
} from 'lucide-react';
import '../styles/Canvas.css';

type CanvasMode = 'reference' | 'live' | 'sidebyside' | 'overlay' | 'diff';
type Viewport = 'mobile' | 'tablet' | 'desktop' | 'wide';

const CANVAS_MODES: { key: CanvasMode; label: string; icon: typeof Image }[] = [
  { key: 'reference', label: 'Reference', icon: Image },
  { key: 'live', label: 'Live', icon: Globe },
  { key: 'sidebyside', label: 'Compare', icon: Columns2 },
  { key: 'overlay', label: 'Overlay', icon: Layers },
  { key: 'diff', label: 'Diff', icon: Search },
];

const VIEWPORTS: { key: Viewport; label: string; icon: typeof Smartphone; w: number; h: number }[] = [
  { key: 'mobile', label: 'Mobile', icon: Smartphone, w: 390, h: 844 },
  { key: 'tablet', label: 'Tablet', icon: Tablet, w: 768, h: 1024 },
  { key: 'desktop', label: 'Desktop', icon: Monitor, w: 1440, h: 900 },
  { key: 'wide', label: '1920', icon: MonitorUp, w: 1920, h: 1080 },
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
          {CANVAS_MODES.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.key}
                className={`canvas-mode-btn ${mode === m.key ? 'active' : ''}`}
                onClick={() => setMode(m.key)}
              >
                <Icon size={11} style={{ marginRight: 4 }} />
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Viewport selector */}
        <div className="viewport-selector">
          {VIEWPORTS.map((vp) => {
            const Icon = vp.icon;
            return (
              <button
                key={vp.key}
                className={`viewport-btn ${viewport === vp.key ? 'active' : ''}`}
                onClick={() => setViewport(vp.key)}
                data-tooltip={`${vp.w} × ${vp.h}`}
              >
                <Icon size={12} />
                <span>{vp.label}</span>
              </button>
            );
          })}
        </div>

        <div className="divider-v" />

        {/* Zoom */}
        <button className="icon-btn" data-tooltip="Zoom out">
          <ZoomOut size={14} />
        </button>
        <span className="canvas-zoom-label">75%</span>
        <button className="icon-btn" data-tooltip="Zoom in">
          <ZoomIn size={14} />
        </button>
        <button className="icon-btn" data-tooltip="Fit to screen">
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Canvas Viewport */}
      <div className="canvas-viewport">

        {/* ── Reference Mode ── */}
        {mode === 'reference' && (
          <div className="canvas-placeholder">
            <div className="canvas-placeholder-icon">
              <Image size={24} />
            </div>
            <div className="canvas-placeholder-title">Chưa có ảnh tham chiếu</div>
            <div className="canvas-placeholder-sub">
              Kéo thả hoặc nhập ảnh thiết kế từ Figma, Photoshop, Screenshot…
            </div>
            <div className="canvas-placeholder-actions">
              <button className="canvas-action-btn primary">
                <Plus size={13} style={{ marginRight: 4 }} />
                Nhập ảnh
              </button>
              <button className="canvas-action-btn">
                <ClipboardPaste size={13} style={{ marginRight: 4 }} />
                Dán từ clipboard
              </button>
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
              <div className="canvas-server-placeholder">
                <Globe size={40} />
                <div className="canvas-server-placeholder-title">Dev Server chưa chạy</div>
                <div className="canvas-server-placeholder-sub">
                  Nhấn <Play size={11} style={{ verticalAlign: 'middle' }} /> Run để khởi động project
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Side-by-Side Mode ── */}
        {mode === 'sidebyside' && (
          <div className="canvas-split">
            <div className="canvas-split-pane">
              <div className="canvas-split-pane-label">
                <Image size={12} /> REFERENCE
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
              <div className="canvas-placeholder-icon">
                <Layers size={24} />
              </div>
              <div className="canvas-placeholder-title">Chế độ Overlay</div>
              <div className="canvas-placeholder-sub">
                Chồng ảnh mẫu lên Live Preview để thấy sự khác biệt trực tiếp
              </div>
              <div className="canvas-placeholder-actions">
                <button className="canvas-action-btn">
                  <Plus size={13} style={{ marginRight: 4 }} />
                  Nhập ảnh mẫu
                </button>
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
            <div className="canvas-placeholder-icon">
              <Search size={24} />
            </div>
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
