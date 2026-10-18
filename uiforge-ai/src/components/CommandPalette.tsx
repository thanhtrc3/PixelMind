import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, CornerDownLeft, FolderOpen, Wand2, Camera, Columns2, Layers,
  Smartphone, GitBranch, Palette, ShieldCheck, FileText, Eye, Share2,
  Settings, HelpCircle, Sparkles, ScanSearch, Terminal,
} from 'lucide-react';
import '../styles/Palette.css';

export interface PaletteAction {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: typeof Search;
  shortcut?: string;
}

const ACTIONS: PaletteAction[] = [
  { id: 'fix', group: 'AI', label: 'Nhờ AI sửa vùng đang chọn', hint: 'Header chưa giống ảnh mẫu…', icon: Sparkles, shortcut: 'Ctrl+Enter' },
  { id: 'inspect', group: 'AI', label: 'Kiểm tra giao diện & liệt kê lỗi', hint: 'So ảnh mẫu với giao diện hiện tại', icon: ScanSearch, shortcut: 'Ctrl+I' },
  { id: 'review', group: 'AI', label: 'Chạy chế độ Review UI', hint: 'Chấm điểm hình ảnh · co giãn · tương phản', icon: Eye },
  { id: 'profile', group: 'AI', label: 'Đổi hồ sơ kết nối AI', hint: 'Antigravity IDE → Ollama local', icon: Terminal },

  { id: 'compare', group: 'Canvas', label: 'Chuyển sang chế độ song song', icon: Columns2, shortcut: 'C' },
  { id: 'overlay', group: 'Canvas', label: 'Chuyển sang chế độ chồng lớp', icon: Layers },
  { id: 'diff', group: 'Canvas', label: 'Chạy so sánh điểm ảnh (Diff)', icon: ScanSearch },
  { id: 'shot', group: 'Canvas', label: 'Chụp màn hình giao diện', icon: Camera, shortcut: 'Ctrl+Shift+S' },

  { id: 'responsive', group: 'Kiểm tra', label: 'Kiểm tra co giãn 390 · 768 · 1440', icon: Smartphone },
  { id: 'version', group: 'Kiểm tra', label: 'Xem diff phiên bản v4', icon: GitBranch },
  { id: 'restore', group: 'Kiểm tra', label: 'Khôi phục phiên bản v3', icon: GitBranch },

  { id: 'project', group: 'Dự án', label: 'Mở danh sách dự án', icon: FolderOpen, shortcut: 'Ctrl+O' },
  { id: 'newproject', group: 'Dự án', label: 'Tạo dự án mới', icon: FolderOpen },
  { id: 'reference', group: 'Dự án', label: 'Nhập ảnh mẫu cho trang Home', icon: FileText },
  { id: 'design', group: 'Dự án', label: 'Mở DESIGN.md & tokens.css', icon: Palette },
  { id: 'license', group: 'Dự án', label: 'Xem giấy phép AI của dự án', icon: ShieldCheck },
  { id: 'share', group: 'Dự án', label: 'Chia sẻ dự án cho nhóm', icon: Share2 },
  { id: 'export', group: 'Dự án', label: 'Xuất HTML một file / ZIP', icon: FileText },

  { id: 'settings', group: 'Hệ thống', label: 'Mở cài đặt', icon: Settings, shortcut: 'Ctrl+,' },
  { id: 'help', group: 'Hệ thống', label: 'Mở hướng dẫn sử dụng', icon: HelpCircle, shortcut: 'F1' },
  { id: 'toolbox', group: 'Hệ thống', label: 'Search Toolbox — tìm part giao diện', icon: Wand2, shortcut: 'Ctrl+Shift+P', hint: 'thư viện part · search · card · kéo vào canvas' },
];

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenGuide?: () => void;
  onOpenHub?: () => void;
  onOpenSettings?: () => void;
  onOpenToolbox?: () => void;
}

const CommandPalette = ({ isOpen, onClose, onOpenGuide, onOpenHub, onOpenSettings, onOpenToolbox }: CommandPaletteProps) => {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ACTIONS;
    return ACTIONS.filter(
      (a) => a.label.toLowerCase().includes(q) || a.group.toLowerCase().includes(q) || a.hint?.toLowerCase().includes(q),
    );
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<string, PaletteAction[]>();
    results.forEach((r) => {
      if (!map.has(r.group)) map.set(r.group, []);
      map.get(r.group)!.push(r);
    });
    return [...map.entries()];
  }, [results]);

  if (!isOpen) return null;

  const run = (a: PaletteAction) => {
    if (a.id === 'help') onOpenGuide?.();
    else if (a.id === 'project' || a.id === 'newproject') onOpenHub?.();
    else if (a.id === 'settings') onOpenSettings?.();
    else if (a.id === 'toolbox') onOpenToolbox?.();
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[cursor]) run(results[cursor]); }
    else if (e.key === 'Escape') { onClose(); }
  };

  let flat = -1;

  return (
    <div className="palette__overlay" onClick={onClose}>
      <div className="palette slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="palette__input-row">
          <Search size={16} />
          <input
            ref={inputRef}
            className="palette__input"
            placeholder="Gõ lệnh, tên phần tử hoặc hành động…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
            onKeyDown={onKeyDown}
          />
          <kbd className="kbd">Esc</kbd>
        </div>

        <div className="palette__results">
          {results.length === 0 && (
            <div className="palette__empty">
              <Sparkles size={16} />
              <span>Không có kết quả cho “{query}”. Thử “so sánh”, “ảnh mẫu” hoặc “kiểm tra”.</span>
            </div>
          )}
          {grouped.map(([group, items]) => (
            <div key={group} className="palette__group">
              <div className="palette__group-title">{group}</div>
              {items.map((a) => {
                flat += 1;
                const active = flat === cursor;
                const idx = flat;
                return (
                  <button
                    key={a.id}
                    className={`palette__item ${active ? 'active' : ''}`}
                    onMouseEnter={() => setCursor(idx)}
                    onClick={() => run(a)}
                  >
                    <span className="palette__item-icon"><a.icon size={15} /></span>
                    <span className="palette__item-text">
                      <span className="palette__item-label">{a.label}</span>
                      {a.hint && <span className="palette__item-hint">{a.hint}</span>}
                    </span>
                    {a.shortcut && <kbd className="kbd">{a.shortcut}</kbd>}
                    {active && <CornerDownLeft size={13} className="palette__enter" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="palette__foot">
          <span><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> di chuyển</span>
          <span><kbd className="kbd">Enter</kbd> chạy</span>
          <span><kbd className="kbd">Esc</kbd> đóng</span>
          <span className="palette__foot-brand">PixelMind · Bảng lệnh</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
