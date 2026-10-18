import type { SectionId } from '../../data/sections';
import ProjectsPage from './ProjectsPage';
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
  /* “work” là vùng làm việc 3 cột; “parts” mở hộp Search Toolbox nên không phải màn riêng */
  section: Exclude<SectionId, 'work' | 'parts'>;
  onSection: (id: SectionId) => void;
};

/** Chọn màn quản lý theo mục điều hướng đang mở */
const SectionView = ({ section, onSection }: Props) => {
  switch (section) {
    case 'projects':
      return <ProjectsPage onSection={onSection} />;
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
