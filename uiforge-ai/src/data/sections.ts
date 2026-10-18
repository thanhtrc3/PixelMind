import {
  Boxes,
  Download,
  FolderTree,
  Gauge,
  GitBranch,
  ListChecks,
  Palette,
  PanelLeft,
  ScrollText,
  Shield,
  Ticket,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** 12 mục điều hướng — đúng thứ tự và cách chia nhóm của bản thiết kế */
export type SectionId =
  | 'work'
  | 'projects'
  | 'tickets'
  | 'checks'
  | 'versions'
  | 'parts'
  | 'design'
  | 'licenses'
  | 'users'
  | 'log'
  | 'report'
  | 'export';

export type NavItem = {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  /** số đếm nhỏ hiện bên phải, đúng như bản thiết kế */
  badge?: number;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Làm việc',
    items: [
      { id: 'work', label: 'Màn hình làm việc', icon: PanelLeft },
      { id: 'projects', label: 'Dự án', icon: FolderTree },
    ],
  },
  {
    title: 'Quy trình',
    items: [
      { id: 'tickets', label: 'Phiếu yêu cầu', icon: Ticket, badge: 5 },
      { id: 'checks', label: 'Phiếu kiểm tra', icon: ListChecks, badge: 4 },
      { id: 'versions', label: 'Lịch sử phiên bản', icon: GitBranch },
    ],
  },
  {
    title: 'Dùng lại',
    items: [
      { id: 'parts', label: 'Thư viện Part', icon: Boxes, badge: 11 },
      { id: 'design', label: 'Design system', icon: Palette },
    ],
  },
  {
    title: 'Quản trị',
    items: [
      { id: 'licenses', label: 'Giấy phép AI', icon: Shield, badge: 5 },
      { id: 'users', label: 'Người dùng', icon: Users },
      { id: 'log', label: 'Nhật ký', icon: ScrollText },
      { id: 'report', label: 'Báo cáo', icon: Gauge },
      { id: 'export', label: 'Xuất bài', icon: Download },
    ],
  },
];

export const SECTION_LABEL: Record<SectionId, string> = NAV_GROUPS.flatMap((g) => g.items).reduce(
  (acc, it) => {
    acc[it.id] = it.label;
    return acc;
  },
  {} as Record<SectionId, string>,
);
