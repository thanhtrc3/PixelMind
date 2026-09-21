import { useState } from 'react';
import {
  X, ChevronLeft, ChevronRight,
  // TopBar icons
  FolderOpen, Undo2, Redo2, MousePointer2, Hand, Square, PenTool,
  Ruler, Columns2, Camera, Smartphone, Play, Settings,
  // Sidebar icons
  Layers, FileText, Image, FolderTree, History, Plus,
  // Canvas icons
  Globe, Search, Maximize2, ZoomIn, ZoomOut,
  // AI Panel icons
  MessageSquare, ListTodo, AlertTriangle, Info, Sparkles, Bot, Cpu, Monitor,
  Paperclip, ArrowUp,
  // StatusBar icons
  GitBranch,
  // Extra
  HelpCircle, Keyboard, BookOpen
} from 'lucide-react';
import '../styles/Guide.css';

/* ──────────────────────────────────────────────────────
   Guide Data — mỗi section là một "trang" trong modal
   ────────────────────────────────────────────────────── */

interface GuideFeature {
  icon: typeof FolderOpen;
  title: string;
  shortcut?: string;
  description: string;
}

interface GuideSection {
  id: string;
  title: string;
  subtitle: string;
  icon: typeof FolderOpen;
  features: GuideFeature[];
}

const GUIDE_SECTIONS: GuideSection[] = [
  /* ───── 1. TopBar ───── */
  {
    id: 'topbar',
    title: 'Thanh công cụ chính',
    subtitle: 'Các công cụ và hành động ở đầu giao diện',
    icon: Settings,
    features: [
      {
        icon: FolderOpen,
        title: 'Mở Project',
        description: 'Chọn thư mục chứa dự án web (React, Vue, HTML…). UIForge sẽ tự nhận diện framework và cấu hình dev server.',
      },
      {
        icon: Undo2,
        title: 'Hoàn tác / Làm lại',
        shortcut: 'Ctrl+Z / Ctrl+Y',
        description: 'Quay lại hoặc khôi phục thao tác trước đó — cả thao tác kéo thả lẫn thay đổi do AI thực hiện.',
      },
      {
        icon: MousePointer2,
        title: 'Công cụ Chọn (Select)',
        shortcut: 'V',
        description: 'Click vào một phần tử trên Live Preview để chọn nó. Phần tử được chọn sẽ hiển thị bounding box và thông tin CSS.',
      },
      {
        icon: Hand,
        title: 'Công cụ Pan',
        shortcut: 'H',
        description: 'Kéo để di chuyển canvas. Giữ Space + kéo chuột cũng có tác dụng tương tự.',
      },
      {
        icon: Square,
        title: 'Khoanh vùng (Region Select)',
        shortcut: 'L',
        description: 'Vẽ hình chữ nhật để chọn một vùng trên giao diện. Vùng này sẽ được gửi kèm khi yêu cầu AI sửa.',
      },
      {
        icon: PenTool,
        title: 'Ghi chú (Annotation)',
        shortcut: 'T',
        description: 'Thêm ghi chú trực tiếp lên canvas — mũi tên, text, khoanh tròn. Ghi chú sẽ trở thành hướng dẫn cho AI.',
      },
      {
        icon: Ruler,
        title: 'Đo khoảng cách',
        shortcut: 'M',
        description: 'Đo khoảng cách pixel giữa hai điểm hoặc hai phần tử. Hiển thị giá trị px trực tiếp trên canvas.',
      },
      {
        icon: Columns2,
        title: 'So sánh (Compare)',
        description: 'Mở chế độ so sánh side-by-side giữa ảnh tham chiếu và giao diện đang chạy.',
      },
      {
        icon: Camera,
        title: 'Screenshot',
        description: 'Chụp ảnh giao diện hiện tại. Ảnh được lưu lại để so sánh với phiên bản trước hoặc ảnh mẫu.',
      },
      {
        icon: Smartphone,
        title: 'Responsive Test',
        description: 'Kiểm tra giao diện ở nhiều viewport — Mobile (390px), Tablet (768px), Desktop (1440px), Wide (1920px).',
      },
      {
        icon: Play,
        title: 'Run / Stop',
        description: 'Khởi động hoặc dừng dev server của project. Giao diện sẽ được hiển thị trong Live Preview sau khi server chạy.',
      },
      {
        icon: Settings,
        title: 'Cài đặt',
        description: 'Cấu hình chung: theme, ngôn ngữ, phím tắt, đường dẫn mặc định và tùy chọn AI.',
      },
    ],
  },

  /* ───── 2. Sidebar — Layers ───── */
  {
    id: 'sidebar-layers',
    title: 'Sidebar → Layers',
    subtitle: 'Cây component của giao diện đang chạy',
    icon: Layers,
    features: [
      {
        icon: Layers,
        title: 'Component Tree',
        description: 'Hiển thị cấu trúc DOM của trang hiện tại dưới dạng cây. Click vào một node để highlight phần tử tương ứng trên canvas.',
      },
      {
        icon: MousePointer2,
        title: 'Chọn phần tử từ cây',
        description: 'Click vào bất kỳ node nào → phần tử được highlight trên Live Preview. Bounding box, CSS và selector sẽ hiện ở tab Context.',
      },
      {
        icon: Search,
        title: 'Tìm kiếm phần tử',
        description: 'Gõ tên class, tag hoặc ID để lọc nhanh trong cây component. Hữu ích khi trang có nhiều phần tử.',
      },
    ],
  },

  /* ───── 3. Sidebar — Pages ───── */
  {
    id: 'sidebar-pages',
    title: 'Sidebar → Pages',
    subtitle: 'Quản lý các trang trong dự án',
    icon: FileText,
    features: [
      {
        icon: FileText,
        title: 'Danh sách trang',
        description: 'Hiển thị tất cả route/trang của dự án. Click vào tên trang để chuyển Live Preview đến route đó.',
      },
      {
        icon: Plus,
        title: 'Thêm trang mới',
        description: 'Tạo trang mới trong dự án. UIForge tự tạo file component và thêm route tương ứng.',
      },
      {
        icon: Image,
        title: 'Gắn ảnh tham chiếu cho trang',
        description: 'Mỗi trang có thể gắn một ảnh mẫu riêng. Khi so sánh, UIForge sẽ dùng đúng ảnh của trang đang xem.',
      },
    ],
  },

  /* ───── 4. Sidebar — Assets ───── */
  {
    id: 'sidebar-assets',
    title: 'Sidebar → Assets',
    subtitle: 'Quản lý ảnh thiết kế tham chiếu',
    icon: Image,
    features: [
      {
        icon: Image,
        title: 'Ảnh tham chiếu',
        description: 'Import ảnh từ Figma, Photoshop, hoặc screenshot. Ảnh này sẽ được dùng để so sánh với giao diện thực tế.',
      },
      {
        icon: Plus,
        title: 'Thêm ảnh mới',
        description: 'Kéo thả file ảnh vào đây hoặc click nút "+" để chọn file. Hỗ trợ PNG, JPG, WebP.',
      },
      {
        icon: Maximize2,
        title: 'Xem ảnh toàn màn hình',
        description: 'Double-click vào thumbnail để xem ảnh ở chế độ toàn màn hình. Có thể zoom và pan.',
      },
    ],
  },

  /* ───── 5. Sidebar — Files ───── */
  {
    id: 'sidebar-files',
    title: 'Sidebar → Files',
    subtitle: 'Duyệt file trong dự án',
    icon: FolderTree,
    features: [
      {
        icon: FolderTree,
        title: 'Cây thư mục',
        description: 'Hiển thị toàn bộ cấu trúc file/folder của project. Mở rộng folder bằng cách click vào tên.',
      },
      {
        icon: FileText,
        title: 'Xem file liên quan',
        description: 'Click vào file để xem nội dung. File CSS/TSX/JSX liên quan đến phần tử đang chọn sẽ được đánh dấu.',
      },
      {
        icon: Search,
        title: 'Nhận diện framework',
        description: 'UIForge tự nhận diện React, Vue, Angular, Next.js, Vite, v.v. từ package.json và cấu hình project.',
      },
    ],
  },

  /* ───── 6. Sidebar — Versions ───── */
  {
    id: 'sidebar-versions',
    title: 'Sidebar → Versions',
    subtitle: 'Lịch sử thay đổi và rollback',
    icon: History,
    features: [
      {
        icon: History,
        title: 'Timeline phiên bản',
        description: 'Mỗi lần AI sửa code hoặc bạn kéo thả chỉnh UI, một checkpoint tự động được tạo. Timeline hiển thị toàn bộ lịch sử.',
      },
      {
        icon: Undo2,
        title: 'Rollback',
        description: 'Click vào bất kỳ phiên bản nào để quay lại trạng thái đó. Source code sẽ được khôi phục thông qua Git.',
      },
      {
        icon: GitBranch,
        title: 'Git diff',
        description: 'Xem diff giữa phiên bản hiện tại và bất kỳ checkpoint nào. Hiển thị chính xác dòng nào đã thay đổi.',
      },
    ],
  },

  /* ───── 7. Canvas — Các chế độ xem ───── */
  {
    id: 'canvas',
    title: 'Canvas — Chế độ xem',
    subtitle: 'Vùng hiển thị chính với 5 chế độ',
    icon: Globe,
    features: [
      {
        icon: Image,
        title: 'Reference Mode',
        description: 'Hiển thị ảnh thiết kế gốc. Dùng để đối chiếu hoặc đưa ảnh mẫu cho AI so sánh.',
      },
      {
        icon: Globe,
        title: 'Live Preview Mode',
        description: 'Hiển thị giao diện đang chạy thật (từ dev server). Hỗ trợ hot-reload — mọi thay đổi code tự cập nhật.',
      },
      {
        icon: Columns2,
        title: 'Compare Mode (Side-by-Side)',
        description: 'Đặt ảnh tham chiếu và Live Preview cạnh nhau để so sánh trực quan. Dễ thấy sai lệch.',
      },
      {
        icon: Layers,
        title: 'Overlay Mode',
        description: 'Chồng ảnh mẫu lên Live Preview với opacity điều chỉnh được. Kéo thanh trượt để thấy sai lệch trực tiếp.',
      },
      {
        icon: Search,
        title: 'Diff Mode',
        description: 'So sánh pixel-by-pixel. Vùng khác biệt được đánh dấu đỏ, hiển thị heatmap sai lệch.',
      },
      {
        icon: Smartphone,
        title: 'Viewport Selector',
        description: 'Chuyển viewport — Mobile (390×844), Tablet (768×1024), Desktop (1440×900), Wide (1920×1080).',
      },
      {
        icon: ZoomIn,
        title: 'Zoom In / Out / Fit',
        description: 'Phóng to, thu nhỏ hoặc fit-to-screen canvas. Dùng Ctrl+Scroll để zoom nhanh.',
      },
    ],
  },

  /* ───── 8. AI Panel — Chat ───── */
  {
    id: 'ai-chat',
    title: 'AI Panel → Chat',
    subtitle: 'Giao tiếp với AI bằng tiếng Việt',
    icon: MessageSquare,
    features: [
      {
        icon: MessageSquare,
        title: 'Chat tự nhiên',
        description: 'Viết yêu cầu bằng tiếng Việt: "Sửa header giống ảnh mẫu", "Giảm padding xuống 8px". AI hiểu ngữ cảnh và sửa trực tiếp.',
      },
      {
        icon: Square,
        title: 'Gửi kèm vùng chọn',
        description: 'Chọn một vùng trên canvas trước khi gõ → AI nhận được screenshot, CSS, DOM và selector của vùng đó.',
      },
      {
        icon: Paperclip,
        title: 'Đính kèm ảnh',
        description: 'Gửi ảnh tham chiếu cùng yêu cầu. AI sẽ so sánh ảnh với giao diện hiện tại và sửa cho khớp.',
      },
      {
        icon: Camera,
        title: 'Screenshot vùng chọn',
        description: 'Chụp nhanh vùng đang chọn trên canvas và gửi kèm chat để AI phân tích.',
      },
      {
        icon: ArrowUp,
        title: 'Gửi tin nhắn',
        shortcut: 'Enter',
        description: 'Nhấn Enter để gửi. Shift+Enter để xuống dòng. AI sẽ phân tích yêu cầu, sửa code, và reload preview tự động.',
      },
    ],
  },

  /* ───── 9. AI Panel — Tasks ───── */
  {
    id: 'ai-tasks',
    title: 'AI Panel → Tasks',
    subtitle: 'Theo dõi các tác vụ AI đang xử lý',
    icon: ListTodo,
    features: [
      {
        icon: Play,
        title: 'Task đang chạy',
        description: 'Hiển thị thanh tiến trình cho mỗi tác vụ AI đang thực hiện. Ví dụ: "Sửa Button border-radius — 60%".',
      },
      {
        icon: ListTodo,
        title: 'Lịch sử tác vụ',
        description: 'Tất cả tác vụ đã hoàn thành, đang chạy hoặc đang chờ đều được liệt kê theo thời gian.',
      },
      {
        icon: X,
        title: 'Hủy tác vụ',
        description: 'Click vào task đang chạy để hủy nếu AI đang đi sai hướng. Code sẽ tự rollback về checkpoint trước.',
      },
    ],
  },

  /* ───── 10. AI Panel — Issues (Findings) ───── */
  {
    id: 'ai-findings',
    title: 'AI Panel → Issues',
    subtitle: 'Danh sách vấn đề được phát hiện',
    icon: AlertTriangle,
    features: [
      {
        icon: AlertTriangle,
        title: 'Critical Issues',
        description: 'Sai lệch nghiêm trọng — kích thước, vị trí hoặc layout khác xa ảnh mẫu. Viền đỏ bên trái.',
      },
      {
        icon: AlertTriangle,
        title: 'Warning Issues',
        description: 'Sai lệch nhỏ — spacing, padding, border-radius chưa khớp. Viền vàng bên trái.',
      },
      {
        icon: AlertTriangle,
        title: 'OK (Đạt)',
        description: 'Phần tử đã khớp với ảnh mẫu. Viền xanh bên trái. Không cần sửa thêm.',
      },
      {
        icon: Search,
        title: 'Chi tiết sai lệch',
        description: 'Mỗi issue hiển thị: giá trị mong đợi vs hiện tại, CSS selector, và nút "Fix" để AI tự sửa.',
      },
    ],
  },

  /* ───── 11. AI Panel — Context ───── */
  {
    id: 'ai-context',
    title: 'AI Panel → Context',
    subtitle: 'Thông tin chi tiết phần tử đang chọn',
    icon: Info,
    features: [
      {
        icon: MousePointer2,
        title: 'Element Info',
        description: 'Hiển thị tag, class, ID, selector CSS của phần tử đang được chọn trên canvas.',
      },
      {
        icon: Ruler,
        title: 'Kích thước & Tọa độ',
        description: 'Width, height, x, y — giúp AI biết chính xác vị trí và kích thước phần tử cần sửa.',
      },
      {
        icon: Image,
        title: 'Screenshot vùng chọn',
        description: 'Ảnh chụp tự động của phần tử đang chọn. Được gửi kèm khi yêu cầu AI sửa.',
      },
      {
        icon: Globe,
        title: 'Viewport & Framework',
        description: 'Viewport hiện tại (ví dụ 1440×900) và framework đang dùng (React, Vue, Angular…).',
      },
    ],
  },

  /* ───── 12. AI Panel — Model Settings ───── */
  {
    id: 'ai-settings',
    title: 'AI Panel → AI Settings',
    subtitle: 'Chọn và cấu hình AI model',
    icon: Sparkles,
    features: [
      {
        icon: Sparkles,
        title: 'Antigravity (Gemini)',
        description: 'Google Antigravity Agent — tích hợp sâu với UIForge. Có khả năng đọc file, sửa code, chạy lệnh và kiểm tra trực tiếp.',
      },
      {
        icon: Bot,
        title: 'OpenAI GPT-4o',
        description: 'ChatGPT — đa năng, phù hợp cho các yêu cầu phức tạp. Kết nối qua API key của bạn.',
      },
      {
        icon: Cpu,
        title: 'Anthropic Claude',
        description: 'Claude Sonnet — lý luận tốt, đặc biệt mạnh khi xử lý CSS phức tạp và responsive.',
      },
      {
        icon: Monitor,
        title: 'Local Model',
        description: 'Chạy offline với Ollama hoặc LM Studio. Không cần internet, dữ liệu không rời máy.',
      },
    ],
  },

  /* ───── 13. StatusBar ───── */
  {
    id: 'statusbar',
    title: 'Thanh trạng thái',
    subtitle: 'Thông tin nhanh ở cuối giao diện',
    icon: Info,
    features: [
      {
        icon: Globe,
        title: 'URL Dev Server',
        description: 'Địa chỉ localhost đang chạy (ví dụ localhost:5173). Click để mở trong trình duyệt ngoài.',
      },
      {
        icon: Ruler,
        title: 'Viewport hiện tại',
        description: 'Kích thước viewport đang hiển thị — 1440×900, 768×1024, v.v.',
      },
      {
        icon: ZoomIn,
        title: 'Zoom level',
        description: 'Mức zoom hiện tại (75%, 100%, 150%…). Click để nhập giá trị tùy chỉnh.',
      },
      {
        icon: GitBranch,
        title: 'Git branch',
        description: 'Branch hiện tại (main, develop…). Click để chuyển branch hoặc xem lịch sử commit.',
      },
      {
        icon: Sparkles,
        title: 'Trạng thái AI',
        description: 'Hiển thị AI đang sẵn sàng (xanh), đang xử lý (vàng nhấp nháy) hay lỗi (đỏ).',
      },
    ],
  },

  /* ───── 14. Keyboard Shortcuts ───── */
  {
    id: 'shortcuts',
    title: 'Phím tắt',
    subtitle: 'Các phím tắt thao tác nhanh',
    icon: Keyboard,
    features: [
      { icon: MousePointer2, title: 'V', description: 'Chuyển sang công cụ Select — chọn phần tử trên canvas.' },
      { icon: Hand, title: 'H', description: 'Chuyển sang công cụ Pan — kéo di chuyển canvas.' },
      { icon: Square, title: 'L', description: 'Chuyển sang công cụ Region Select — vẽ vùng chọn.' },
      { icon: PenTool, title: 'T', description: 'Chuyển sang công cụ Annotation — ghi chú trên canvas.' },
      { icon: Ruler, title: 'M', description: 'Chuyển sang công cụ Measure — đo khoảng cách pixel.' },
      { icon: Undo2, title: 'Ctrl+Z', description: 'Hoàn tác thao tác gần nhất.' },
      { icon: Redo2, title: 'Ctrl+Y', description: 'Làm lại thao tác vừa hoàn tác.' },
      { icon: ZoomIn, title: 'Ctrl+Scroll', description: 'Zoom in/out canvas nhanh.' },
      { icon: Hand, title: 'Space + Drag', description: 'Pan canvas tạm thời (giữ Space).' },
      { icon: Play, title: 'Ctrl+R', description: 'Chạy/Restart dev server.' },
      { icon: HelpCircle, title: 'F1', description: 'Mở hướng dẫn này.' },
    ],
  },
];

/* ──────────────────────────────────────────────────────
   Component
   ────────────────────────────────────────────────────── */

interface GuideProps {
  isOpen: boolean;
  onClose: () => void;
}

const Guide = ({ isOpen, onClose }: GuideProps) => {
  const [currentPage, setCurrentPage] = useState(0);

  if (!isOpen) return null;

  const section = GUIDE_SECTIONS[currentPage];
  const SectionIcon = section.icon;
  const totalPages = GUIDE_SECTIONS.length;

  const goNext = () => setCurrentPage((p) => Math.min(p + 1, totalPages - 1));
  const goPrev = () => setCurrentPage((p) => Math.max(p - 1, 0));

  return (
    <div className="guide-overlay" onClick={onClose}>
      <div className="guide-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="guide-header">
          <div className="guide-header-left">
            <BookOpen size={18} />
            <span className="guide-header-title">Hướng dẫn sử dụng</span>
          </div>
          <button className="icon-btn" onClick={onClose} data-tooltip="Đóng">
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="guide-body">

          {/* Section nav (left) */}
          <nav className="guide-nav">
            {GUIDE_SECTIONS.map((s, idx) => {
              const NavIcon = s.icon;
              return (
                <button
                  key={s.id}
                  className={`guide-nav-item ${currentPage === idx ? 'active' : ''}`}
                  onClick={() => setCurrentPage(idx)}
                >
                  <NavIcon size={14} />
                  <span>{s.title}</span>
                </button>
              );
            })}
          </nav>

          {/* Content (right) */}
          <div className="guide-content">
            {/* Section title */}
            <div className="guide-section-header">
              <div className="guide-section-icon">
                <SectionIcon size={22} />
              </div>
              <div>
                <h2 className="guide-section-title">{section.title}</h2>
                <p className="guide-section-subtitle">{section.subtitle}</p>
              </div>
            </div>

            {/* Feature cards */}
            <div className="guide-features">
              {section.features.map((f, i) => {
                const FeatureIcon = f.icon;
                return (
                  <div key={i} className="guide-feature-card">
                    <div className="guide-feature-icon">
                      <FeatureIcon size={16} />
                    </div>
                    <div className="guide-feature-info">
                      <div className="guide-feature-title">
                        {f.title}
                        {f.shortcut && (
                          <kbd className="guide-kbd">{f.shortcut}</kbd>
                        )}
                      </div>
                      <p className="guide-feature-desc">{f.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="guide-footer">
          <span className="guide-page-info">
            {currentPage + 1} / {totalPages}
          </span>
          <div className="guide-footer-nav">
            <button
              className="guide-nav-btn"
              onClick={goPrev}
              disabled={currentPage === 0}
            >
              <ChevronLeft size={16} />
              Trước
            </button>
            <button
              className="guide-nav-btn primary"
              onClick={currentPage === totalPages - 1 ? onClose : goNext}
            >
              {currentPage === totalPages - 1 ? 'Hoàn tất' : 'Tiếp theo'}
              {currentPage < totalPages - 1 && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Guide;
