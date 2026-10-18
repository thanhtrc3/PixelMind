import type { SectionId } from '../../data/sections';
import ProjectsPage from './ProjectsPage';
import PartsPage from './PartsPage';
import TicketsPage from './TicketsPage';
import ChecksPage from './ChecksPage';
import VersionsPage from './VersionsPage';
import DesignPage from './DesignPage';
import LicensesPage from './LicensesPage';
import UsersPage from './UsersPage';
import LogPage from './LogPage';
import ReportPage from './ReportPage';
import ExportPage from './ExportPage';

type Props = {
  section: Exclude<SectionId, 'work'>;
  onSection: (id: SectionId) => void;
  /* Thư viện Part cần chính sách kéo thả của app */
  onInsertPart: (partId: string) => void;
  onDragStart: (partId: string) => void;
  onDragEnd: () => void;
  draggingId?: string | null;
  insertedCount?: number;
};

/** Chọn màn quản lý theo mục điều hướng đang mở */
const SectionView = ({
  section,
  onSection,
  onInsertPart,
  onDragStart,
  onDragEnd,
  draggingId,
  insertedCount,
}: Props) => {
  switch (section) {
    case 'projects':
      return <ProjectsPage onSection={onSection} />;
    case 'parts':
      return (
        <PartsPage
          onInsert={onInsertPart}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          draggingId={draggingId}
          insertedCount={insertedCount}
        />
      );
    case 'tickets':
      return <TicketsPage />;
    case 'checks':
      return <ChecksPage />;
    case 'versions':
      return <VersionsPage />;
    case 'design':
      return <DesignPage />;
    case 'licenses':
      return <LicensesPage />;
    case 'users':
      return <UsersPage onSection={onSection} />;
    case 'log':
      return <LogPage />;
    case 'report':
      return <ReportPage />;
    case 'export':
      return <ExportPage />;
    default:
      return null;
  }
};

export default SectionView;
