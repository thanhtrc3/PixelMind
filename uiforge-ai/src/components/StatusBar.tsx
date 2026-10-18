import { Globe, Ruler, GitBranch, GitCommitHorizontal, ShieldCheck, Cpu, Maximize2 } from 'lucide-react';
import '../styles/StatusBar.css';

interface StatusBarProps {
  zoom?: number;
  viewport?: string;
  version?: string;
  licenseDays?: number;
  aiState?: 'ready' | 'working';
}

const StatusBar = ({
  zoom = 75,
  viewport = '1440 × 900',
  version = 'v4',
  licenseDays = 12,
  aiState = 'working',
}: StatusBarProps) => (
  <footer className="status">
    {/* ── Trái ── */}
    <button className="status__item link" data-tooltip="Mở trong trình duyệt ngoài" data-tooltip-pos="tl">
      <Globe size={11} />
      <span>localhost:5173</span>
    </button>
    <span className="status__sep" />

    <div className="status__item">
      <Cpu size={11} />
      <span>React + Vite</span>
    </div>
    <span className="status__sep" />

    <div className="status__item" data-tooltip="Khung hiển thị đang chọn" data-tooltip-pos="top">
      <Ruler size={11} />
      <span>{viewport}</span>
    </div>
    <span className="status__sep" />

    <div className="status__item" data-tooltip="Mức thu phóng canvas" data-tooltip-pos="top">
      <Maximize2 size={11} />
      <span>{zoom}%</span>
    </div>

    <span className="status__spacer" />

    {/* ── Phải ── */}
    <div className="status__item" data-tooltip="Phiên bản đang xem" data-tooltip-pos="top">
      <GitCommitHorizontal size={11} />
      <span>{version}</span>
      <span className="status__ver-dot" />
    </div>
    <span className="status__sep" />

    <div className="status__item" data-tooltip="Nhánh Git hiện tại" data-tooltip-pos="top">
      <GitBranch size={11} />
      <span>main</span>
    </div>
    <span className="status__sep" />

    <div className="status__license" data-tooltip={`Giấy phép AI còn ${licenseDays} ngày`} data-tooltip-pos="top">
      <ShieldCheck size={11} />
      <span>Giấy phép còn {licenseDays} ngày</span>
    </div>
    <span className="status__sep" />

    <div className={`status__ai ${aiState}`} data-tooltip={aiState === 'working' ? 'AI đang xử lý yêu cầu sửa' : 'AI đang rảnh, sẵn sàng nhận yêu cầu'} data-tooltip-pos="tr">
      <span className="status__ai-dot" />
      <span>{aiState === 'working' ? 'AI đang sửa…' : 'AI sẵn sàng'}</span>
    </div>
  </footer>
);

export default StatusBar;
