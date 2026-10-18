import { useMemo, useState } from 'react';
import {
  X, Search, Settings as SettingsIcon, Palette, LayoutGrid, Sparkles,
  ShieldCheck, BadgeCheck, Save, Keyboard, Wrench, Check, Lock,
  CircleCheck, TriangleAlert, Server, RefreshCw, Download, Upload,
  FolderOpen, Terminal, RotateCcw, ScanLine, Database, Ruler, ZoomIn,
  Gauge, KeyRound, FileText, ExternalLink, Monitor, Moon, Sun, Hand,
  MousePointer2, Square, PenTool, Play, GitBranch, AlertTriangle,
} from 'lucide-react';
import '../styles/Settings.css';

/* ══════════════════════════════════════════════════════
   Kiểu dữ liệu
   ══════════════════════════════════════════════════════ */

type Val = string | number | boolean;
type SetSection =
  | 'general' | 'appearance' | 'canvas' | 'ai'
  | 'security' | 'license' | 'storage' | 'shortcuts' | 'advanced';

type Control =
  | { kind: 'toggle' }
  | { kind: 'seg'; options: { value: string; label: string }[] }
  | { kind: 'text'; placeholder?: string; mono?: boolean }
  | { kind: 'number'; unit?: string; min?: number; max?: number; step?: number }
  | { kind: 'range'; unit?: string; min?: number; max?: number };

interface Item {
  key: string;
  section: SetSection;
  card: string;
  title: string;
  desc?: string;
  control: Control;
  tone?: 'warning';
  keywords?: string;
}

const NAV: { key: SetSection; label: string; icon: typeof SettingsIcon }[] = [
  { key: 'general', label: 'Chung', icon: SettingsIcon },
  { key: 'appearance', label: 'Giao diện', icon: Palette },
  { key: 'canvas', label: 'Canvas & so sánh', icon: LayoutGrid },
  { key: 'ai', label: 'AI & hồ sơ kết nối', icon: Sparkles },
  { key: 'security', label: 'Quyền & bảo mật', icon: ShieldCheck },
  { key: 'license', label: 'Giấy phép AI', icon: BadgeCheck },
  { key: 'storage', label: 'Lưu & xuất bài', icon: Save },
  { key: 'shortcuts', label: 'Phím tắt', icon: Keyboard },
  { key: 'advanced', label: 'Nâng cao', icon: Wrench },
];

/* ══════════════════════════════════════════════════════
   Danh sách mục cài đặt (dữ liệu → render + tìm kiếm)
   ══════════════════════════════════════════════════════ */

const ITEMS: Item[] = [
  /* ─────────────── 1. CHUNG ─────────────── */
  {
    key: 'language', section: 'general', card: 'Ngôn ngữ & khởi động',
    title: 'Ngôn ngữ giao diện', keywords: 'tiếng việt english language ngon ngu',
    control: { kind: 'seg', options: [{ value: 'vi', label: 'Tiếng Việt' }, { value: 'en', label: 'English' }] },
  },
  {
    key: 'reopenLast', section: 'general', card: 'Ngôn ngữ & khởi động',
    title: 'Mở lại dự án gần nhất khi khởi động',
    control: { kind: 'toggle' },
  },
  {
    key: 'restoreSession', section: 'general', card: 'Ngôn ngữ & khởi động',
    title: 'Khôi phục phiên làm việc',
    desc: 'Nhớ khung hiển thị, chế độ xem và vị trí đang xem của lần làm việc trước.',
    control: { kind: 'toggle' },
  },
  {
    key: 'confirmExit', section: 'general', card: 'Ngôn ngữ & khởi động',
    title: 'Hỏi trước khi thoát khi AI đang sửa dở',
    control: { kind: 'toggle' },
  },
  {
    key: 'notifyDone', section: 'general', card: 'Thông báo',
    title: 'Thông báo khi AI sửa xong một vòng',
    control: { kind: 'toggle' },
  },
  {
    key: 'notifyFail', section: 'general', card: 'Thông báo',
    title: 'Thông báo khi phiếu kiểm tra không đạt',
    control: { kind: 'toggle' },
  },
  {
    key: 'notifyLicense', section: 'general', card: 'Thông báo',
    title: 'Nhắc khi giấy phép AI sắp hết hạn',
    control: { kind: 'toggle' },
  },
  {
    key: 'notifyComment', section: 'general', card: 'Thông báo',
    title: 'Thông báo khi có bình luận ghim mới trên vùng của bạn',
    control: { kind: 'toggle' },
  },
  {
    key: 'diagnostics', section: 'general', card: 'Thông báo',
    title: 'Gửi dữ liệu chẩn đoán',
    desc: 'Chỉ gửi lỗi và số liệu hiệu năng, không kèm mã nguồn hay ảnh giao diện.',
    tone: 'warning', control: { kind: 'toggle' },
  },

  /* ─────────────── 2. GIAO DIỆN ─────────────── */
  {
    key: 'theme', section: 'appearance', card: 'Nền & màu sắc',
    title: 'Chế độ nền',
    desc: 'Mục 3.10 của báo cáo quy định nền tối là chuẩn của PixelMind.',
    keywords: 'dark light theme nền sáng tối',
    control: {
      kind: 'seg',
      options: [{ value: 'dark', label: 'Nền tối' }, { value: 'light', label: 'Nền sáng' }, { value: 'system', label: 'Theo hệ thống' }],
    },
  },
  {
    key: 'contrast', section: 'appearance', card: 'Nền & màu sắc',
    title: 'Độ tương phản chữ',
    desc: 'Tăng tương phản giúp đọc rõ hơn khi trình chiếu máy chiếu hoặc màn hình sáng.',
    control: { kind: 'seg', options: [{ value: 'normal', label: 'Tiêu chuẩn' }, { value: 'high', label: 'Tăng' }] },
  },
  {
    key: 'density', section: 'appearance', card: 'Mật độ & chữ',
    title: 'Mật độ hiển thị',
    control: { kind: 'seg', options: [{ value: 'compact', label: 'Gọn' }, { value: 'cozy', label: 'Thoải mái' }] },
  },
  {
    key: 'uiScale', section: 'appearance', card: 'Mật độ & chữ',
    title: 'Cỡ chữ giao diện',
    control: { kind: 'seg', options: [{ value: 'sm', label: 'Nhỏ' }, { value: 'md', label: 'Vừa' }, { value: 'lg', label: 'Lớn' }] },
  },
  {
    key: 'monoCode', section: 'appearance', card: 'Mật độ & chữ',
    title: 'Dùng font monospace cho mã nguồn và giá trị CSS',
    desc: 'Inter cho chữ giao diện, JetBrains Mono cho code — đúng quy định ở mục 3.10.',
    control: { kind: 'toggle' },
  },
  {
    key: 'motion', section: 'appearance', card: 'Chuyển động & hiệu ứng',
    title: 'Hiệu ứng chuyển động',
    control: { kind: 'toggle' },
  },
  {
    key: 'pulse', section: 'appearance', card: 'Chuyển động & hiệu ứng',
    title: 'Chấm trạng thái nhấp nháy (pulse)',
    desc: 'Tắt nếu không muốn các chấm "đang chạy / đang xử lý" nhấp nháy.',
    control: { kind: 'toggle' },
  },
  {
    key: 'glass', section: 'appearance', card: 'Chuyển động & hiệu ứng',
    title: 'Nền kính mờ (backdrop blur)',
    desc: 'Tắt để tăng tốc trên máy yếu.',
    control: { kind: 'toggle' },
  },

  /* ─────────────── 3. CANVAS ─────────────── */
  {
    key: 'defaultViewport', section: 'canvas', card: 'Hiển thị mặc định',
    title: 'Khung hiển thị mặc định',
    control: {
      kind: 'seg',
      options: [
        { value: 'mobile', label: 'Mobile' }, { value: 'tablet', label: 'Tablet' },
        { value: 'desktop', label: 'Máy tính' }, { value: 'wide', label: 'Rộng' },
      ],
    },
  },
  {
    key: 'defaultMode', section: 'canvas', card: 'Hiển thị mặc định',
    title: 'Chế độ xem mặc định',
    control: {
      kind: 'seg',
      options: [
        { value: 'live', label: 'Trực tiếp' }, { value: 'reference', label: 'Ảnh mẫu' },
        { value: 'compare', label: 'Song song' }, { value: 'overlay', label: 'Chồng lớp' },
        { value: 'diff', label: 'Khác biệt' },
      ],
    },
  },
  {
    key: 'defaultZoom', section: 'canvas', card: 'Hiển thị mặc định',
    title: 'Mức thu phóng khi mở dự án',
    control: { kind: 'seg', options: [{ value: 'fit', label: 'Vừa khung' }, { value: '100', label: '100%' }, { value: '75', label: '75%' }] },
  },
  {
    key: 'showGrid', section: 'canvas', card: 'Trợ giúp thao tác',
    title: 'Hiện lưới nền trên canvas', control: { kind: 'toggle' },
  },
  {
    key: 'showRulers', section: 'canvas', card: 'Trợ giúp thao tác',
    title: 'Hiện thước đo ở viền canvas', control: { kind: 'toggle' },
  },
  {
    key: 'showSelection', section: 'canvas', card: 'Trợ giúp thao tác',
    title: 'Hiện hộp chọn và 8 tay cầm khi chọn phần tử', control: { kind: 'toggle' },
  },
  {
    key: 'snap', section: 'canvas', card: 'Trợ giúp thao tác',
    title: 'Hít vào phần tử khi kéo và đổi kích thước', control: { kind: 'toggle' },
  },
  {
    key: 'showPins', section: 'canvas', card: 'Trợ giúp thao tác',
    title: 'Hiện ghim bình luận trên canvas', control: { kind: 'toggle' },
  },
  {
    key: 'showProps', section: 'canvas', card: 'Trợ giúp thao tác',
    title: 'Hiện thanh thuộc tính nổi khi chọn phần tử', control: { kind: 'toggle' },
  },
  {
    key: 'diffThreshold', section: 'canvas', card: 'So sánh với ảnh mẫu',
    title: 'Ngưỡng lệch coi là lỗi',
    desc: 'Vượt ngưỡng này thì vùng đó bị đánh dấu đỏ trong chế độ Khác biệt.',
    control: { kind: 'number', unit: 'px', min: 0, max: 40, step: 1 },
  },
  {
    key: 'minSimilarity', section: 'canvas', card: 'So sánh với ảnh mẫu',
    title: 'Chỉ số tương đồng tối thiểu để coi là đạt',
    control: { kind: 'number', unit: '%', min: 50, max: 100, step: 1 },
  },
  {
    key: 'autoShot', section: 'canvas', card: 'So sánh với ảnh mẫu',
    title: 'Tự chụp màn hình sau mỗi vòng AI sửa',
    desc: 'Bật để app tự tải lại, chụp ảnh và so sánh như mô tả ở mục 3.9.',
    control: { kind: 'toggle' },
  },
  {
    key: 'ignoreDynamic', section: 'canvas', card: 'So sánh với ảnh mẫu',
    title: 'Bỏ qua vùng động khi so sánh',
    desc: 'Băng chuyền ảnh, quảng cáo và đồng hồ đếm ngược thường xuyên đổi nên dễ báo lỗi sai.',
    control: { kind: 'toggle' },
  },

  /* ─────────────── 4. AI ─────────────── */
  {
    key: 'endpoint', section: 'ai', card: 'Tham số hồ sơ đang bật',
    title: 'Địa chỉ cầu nối (endpoint)',
    control: { kind: 'text', mono: true, placeholder: 'ws://localhost:45678' },
  },
  {
    key: 'model', section: 'ai', card: 'Tham số hồ sơ đang bật',
    title: 'Mô hình đang dùng',
    control: {
      kind: 'seg',
      options: [
        { value: 'claude', label: 'claude-sonnet-4.6' },
        { value: 'gpt', label: 'gpt-4o' },
        { value: 'llama', label: 'llama3.1:8b' },
      ],
    },
  },
  {
    key: 'temperature', section: 'ai', card: 'Tham số hồ sơ đang bật',
    title: 'Mức sáng tạo (temperature)',
    desc: 'Để thấp cho việc sửa CSS chính xác theo ảnh mẫu.',
    control: { kind: 'range', unit: '%', min: 0, max: 100 },
  },
  {
    key: 'maxRounds', section: 'ai', card: 'Tham số hồ sơ đang bật',
    title: 'Số vòng sửa tối đa cho một yêu cầu',
    desc: 'Mục 3.6: quá 3 vòng vẫn sai thì hộp thoại sẽ hỏi bạn Đồng ý hay Từ chối.',
    control: { kind: 'seg', options: [{ value: '1', label: '1 vòng' }, { value: '2', label: '2 vòng' }, { value: '3', label: '3 vòng' }] },
  },
  {
    key: 'tokenBudget', section: 'ai', card: 'Tham số hồ sơ đang bật',
    title: 'Ngân sách ngữ cảnh gửi cho AI',
    desc: 'Ảnh, DOM, CSS và file liên quan đều tính vào ngân sách này.',
    control: { kind: 'number', unit: 'k token', min: 4, max: 200, step: 4 },
  },
  {
    key: 'permRead', section: 'ai', card: 'Quyền AI được phép',
    title: 'Đọc file trong dự án', control: { kind: 'toggle' },
  },
  {
    key: 'permWrite', section: 'ai', card: 'Quyền AI được phép',
    title: 'Ghi và sửa file', control: { kind: 'toggle' },
  },
  {
    key: 'permRun', section: 'ai', card: 'Quyền AI được phép',
    title: 'Chạy lệnh trong dự án', control: { kind: 'toggle' },
  },
  {
    key: 'permInstall', section: 'ai', card: 'Quyền AI được phép',
    title: 'Cài thêm gói (npm install)',
    tone: 'warning', control: { kind: 'toggle' },
  },
  {
    key: 'permPush', section: 'ai', card: 'Quyền AI được phép',
    title: 'Push lên GitHub',
    tone: 'warning', control: { kind: 'toggle' },
  },
  {
    key: 'autoRun', section: 'ai', card: 'Quyền AI được phép',
    title: 'Tự chạy lệnh khi AI đề xuất (không hỏi lại)',
    desc: 'Chỉ nên bật khi bạn đã quen và tin cậy hồ sơ kết nối đang dùng.',
    tone: 'warning', control: { kind: 'toggle' },
  },

  /* ─────────────── 5. BẢO MẬT ─────────────── */
  {
    key: 'localOnly', section: 'security', card: 'Cầu nối & khoá',
    title: 'Chỉ dùng cầu nối cục bộ',
    desc: 'Không đẩy mã nguồn ra dịch vụ đám mây. Tắt khi bạn muốn dùng hồ sơ API.',
    control: { kind: 'toggle' },
  },
  {
    key: 'encryptKeys', section: 'security', card: 'Cầu nối & khoá',
    title: 'Mã hoá khoá API khi lưu',
    desc: 'Khoá đã lưu sẽ không hiển thị lại — đúng như mô tả ở mục 3.6.',
    control: { kind: 'toggle' },
  },
  {
    key: 'confirmDanger', section: 'security', card: 'Cầu nối & khoá',
    title: 'Xác nhận trước khi chạy lệnh nguy hiểm',
    control: { kind: 'toggle' },
  },
  {
    key: 'gitGuard', section: 'security', card: 'Cầu nối & khoá',
    title: 'Chặn push khi còn phiếu kiểm tra chưa đạt',
    control: { kind: 'toggle' },
  },
  {
    key: 'lockLicense', section: 'security', card: 'Cầu nối & khoá',
    title: 'Giấy phép hết hạn thì AI dừng ngay, kể cả đang giữa vòng sửa',
    desc: 'Quy định bắt buộc ở mục 3.6 — không thể tắt.',
    control: { kind: 'toggle' },
  },

  /* ─────────────── 6. GIẤY PHÉP ─────────────── */
  {
    key: 'warnBefore', section: 'license', card: 'Nhắc hạn sử dụng',
    title: 'Nhắc trước khi giấy phép hết hạn',
    control: {
      kind: 'seg',
      options: [{ value: '3', label: '3 ngày' }, { value: '7', label: '7 ngày' }, { value: '14', label: '14 ngày' }],
    },
  },
  {
    key: 'autoRevoke', section: 'license', card: 'Nhắc hạn sử dụng',
    title: 'Tự thu hồi quyền ghi khi hết hạn',
    control: { kind: 'toggle' },
  },
  {
    key: 'onePerProject', section: 'license', card: 'Nhắc hạn sử dụng',
    title: 'Mỗi người chỉ một giấy phép hiệu lực trên một dự án',
    desc: 'Quy định của báo cáo, không thể tắt.',
    control: { kind: 'toggle' },
  },

  /* ─────────────── 7. LƯU & XUẤT ─────────────── */
  {
    key: 'projectDir', section: 'storage', card: 'Đường dẫn',
    title: 'Thư mục dự án đang mở',
    control: { kind: 'text', mono: true },
  },
  {
    key: 'referenceDir', section: 'storage', card: 'Đường dẫn',
    title: 'Thư mục chứa ảnh mẫu',
    control: { kind: 'text', mono: true },
  },
  {
    key: 'autoSave', section: 'storage', card: 'Lưu & phiên bản',
    title: 'Tự động lưu khi AI sửa xong', control: { kind: 'toggle' },
  },
  {
    key: 'autoSaveEvery', section: 'storage', card: 'Lưu & phiên bản',
    title: 'Tần suất tự lưu',
    control: { kind: 'seg', options: [{ value: '1', label: 'Mỗi 1 phút' }, { value: '2', label: 'Mỗi 2 phút' }, { value: '5', label: 'Mỗi 5 phút' }] },
  },
  {
    key: 'backups', section: 'storage', card: 'Lưu & phiên bản',
    title: 'Số bản lưu giữ lại',
    control: { kind: 'seg', options: [{ value: '5', label: '5 bản' }, { value: '10', label: '10 bản' }, { value: '20', label: '20 bản' }] },
  },
  {
    key: 'exportFormat', section: 'storage', card: 'Xuất bài để nộp',
    title: 'Định dạng xuất',
    desc: 'Mục 3.8: chọn HTML một file để nộp nhanh, hoặc ZIP khi cần kèm ảnh và tài liệu.',
    control: { kind: 'seg', options: [{ value: 'html', label: 'HTML một file' }, { value: 'zip', label: 'ZIP' }] },
  },
  {
    key: 'exportDesign', section: 'storage', card: 'Xuất bài để nộp',
    title: 'Kèm DESIGN.md và tokens.css', control: { kind: 'toggle' },
  },
  {
    key: 'exportShots', section: 'storage', card: 'Xuất bài để nộp',
    title: 'Kèm ảnh chụp ở 390 · 768 · 1440', control: { kind: 'toggle' },
  },

  /* ─────────────── 9. NÂNG CAO ─────────────── */
  {
    key: 'devServer', section: 'advanced', card: 'Dev server',
    title: 'Cách nhận diện dev server',
    control: { kind: 'seg', options: [{ value: 'auto', label: 'Tự nhận diện' }, { value: 'vite', label: 'Vite' }, { value: 'manual', label: 'Nhập tay' }] },
  },
  {
    key: 'port', section: 'advanced', card: 'Dev server',
    title: 'Cổng mặc định',
    control: { kind: 'number', unit: 'port', min: 1024, max: 65535, step: 1 },
  },
  {
    key: 'keepVersions', section: 'advanced', card: 'Dev server',
    title: 'Số phiên bản giữ trong lịch sử',
    control: { kind: 'number', unit: 'bản', min: 5, max: 200, step: 5 },
  },
  {
    key: 'verboseLog', section: 'advanced', card: 'Chẩn đoán',
    title: 'Ghi nhật ký chi tiết (debug)',
    desc: 'Nhật ký nằm trong Nhật ký hoạt động của Project Hub.',
    control: { kind: 'toggle' },
  },
  {
    key: 'ramLimit', section: 'advanced', card: 'Chẩn đoán',
    title: 'Giới hạn RAM cho tiến trình AI',
    control: { kind: 'seg', options: [{ value: '2', label: '2 GB' }, { value: '4', label: '4 GB' }, { value: '0', label: 'Không giới hạn' }] },
  },
];

const DEFAULTS: Record<string, Val> = {
  /* Chung */
  language: 'vi', reopenLast: true, restoreSession: true, confirmExit: true,
  notifyDone: true, notifyFail: true, notifyLicense: true, notifyComment: false, diagnostics: false,
  /* Giao diện */
  theme: 'dark', contrast: 'normal', density: 'compact', uiScale: 'md', monoCode: true,
  motion: true, pulse: true, glass: true,
  /* Canvas */
  defaultViewport: 'desktop', defaultMode: 'live', defaultZoom: 'fit',
  showGrid: true, showRulers: false, showSelection: true, snap: true, showPins: true, showProps: true,
  diffThreshold: 6, minSimilarity: 92, autoShot: true, ignoreDynamic: true,
  /* AI */
  endpoint: 'ws://localhost:45678', model: 'claude', temperature: 30, maxRounds: '3', tokenBudget: 24,
  permRead: true, permWrite: true, permRun: true, permInstall: false, permPush: false, autoRun: false,
  /* Bảo mật */
  localOnly: true, encryptKeys: true, confirmDanger: true, gitGuard: true, lockLicense: true,
  /* Giấy phép */
  warnBefore: '7', autoRevoke: true, onePerProject: true,
  /* Lưu & xuất */
  projectDir: 'D:\\CODE\\PixelMind\\shop-landing',
  referenceDir: 'D:\\CODE\\PixelMind\\shop-landing\\.pixelmind\\references',
  autoSave: true, autoSaveEvery: '2', backups: '10',
  exportFormat: 'zip', exportDesign: true, exportShots: true,
  /* Nâng cao */
  devServer: 'auto', port: 5173, keepVersions: 20, verboseLog: false, ramLimit: '4',
};

/* ── Dữ liệu phụ trợ ── */
const PROFILES = [
  { id: 'antigravity', name: 'Antigravity IDE', kind: 'Agent cục bộ', target: 'ws://localhost:45678', scope: 'đọc · ghi · chạy lệnh', created: '12/09/2026', state: 'on' as const },
  { id: 'ollama', name: 'Ollama', kind: 'Mô hình cục bộ', target: 'http://127.0.0.1:11434', scope: 'đọc · ghi', created: '20/09/2026', state: 'off' as const },
  { id: 'gpt4o', name: 'GPT-4o', kind: 'API đám mây', target: 'api.openai.com · khoá đã mã hoá', scope: 'đọc · ghi', created: '02/10/2026', state: 'off' as const },
];

const BLOCKED = ['rm -rf /', 'format C:', 'del /f /s /q', 'git push --force', 'curl … | sh', 'chmod 777'];

const SHORTCUTS: [string, string][] = [
  ['Ctrl + K', 'Mở bảng lệnh'],
  ['Ctrl + Shift + P', 'Mở Search Toolbox (thư viện part)'],
  ['Ctrl + O', 'Mở danh sách dự án'],
  ['Ctrl + ,', 'Mở màn hình cài đặt này'],
  ['F1', 'Mở hướng dẫn sử dụng'],
  ['Esc', 'Đóng lớp phủ đang mở'],
  ['Ctrl + Z / Ctrl + Y', 'Hoàn tác / Làm lại (kể cả lần chèn part)'],
  ['V · H · L · T · M', 'Chọn · Pan · Vùng · Ghi chú · Đo'],
  ['C', 'Chuyển sang chế độ song song'],
  ['Ctrl + Shift + S', 'Chụp màn hình giao diện'],
  ['Ctrl + Enter', 'Gửi yêu cầu cho AI'],
  ['Ctrl + Scroll', 'Thu phóng canvas'],
  ['Space + Kéo', 'Di chuyển canvas'],
];

/* ══════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════ */

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const Settings = ({ isOpen, onClose }: SettingsProps) => {
  const [section, setSection] = useState<SetSection>('general');
  const [query, setQuery] = useState('');
  const [values, setValues] = useState<Record<string, Val>>(DEFAULTS);
  const [activeProfile, setActiveProfile] = useState('antigravity');
  const [scanned, setScanned] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'ok'>('idle');
  const [savedAt, setSavedAt] = useState('14:32');

  const q = query.trim().toLowerCase();

  /** Đổi 1 giá trị + cập nhật mốc "đã lưu tự động" */
  const set = (key: string, v: Val) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    const now = new Date();
    setSavedAt(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  };

  const resetAll = () => {
    setValues(DEFAULTS);
    setActiveProfile('antigravity');
  };

  const shown = useMemo(() => {
    if (q) {
      return ITEMS.filter((i) => `${i.title} ${i.desc ?? ''} ${i.keywords ?? ''} ${i.card}`.toLowerCase().includes(q));
    }
    return ITEMS.filter((i) => i.section === section);
  }, [q, section]);

  /* Nhóm theo thẻ (card) để render */
  const cards = useMemo(() => {
    const map = new Map<string, Item[]>();
    shown.forEach((i) => {
      if (!map.has(i.card)) map.set(i.card, []);
      map.get(i.card)!.push(i);
    });
    return [...map.entries()];
  }, [shown]);

  if (!isOpen) return null;

  /* ── Điều khiển ── */
  const renderControl = (it: Item) => {
    const v = values[it.key];
    const c = it.control;

    if (c.kind === 'toggle') {
      return (
        <button
          role="switch"
          aria-checked={v as boolean}
          aria-label={it.title}
          className={`set-switch ${v ? 'is-on' : ''}`}
          onClick={() => set(it.key, !v)}
        >
          <span className="set-switch__dot" />
        </button>
      );
    }

    if (c.kind === 'seg') {
      return (
        <div className="seg set-seg">
          {c.options.map((o) => (
            <button
              key={o.value}
              className={`seg__item ${String(v) === o.value ? 'active' : ''}`}
              onClick={() => set(it.key, o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      );
    }

    if (c.kind === 'text') {
      return (
        <input
          className={`set-input ${c.mono ? 'is-mono' : ''}`}
          value={String(v)}
          placeholder={c.placeholder}
          onChange={(e) => set(it.key, e.target.value)}
          spellCheck={false}
        />
      );
    }

    if (c.kind === 'number') {
      return (
        <div className="set-num">
          <input
            type="number"
            value={Number(v)}
            min={c.min} max={c.max} step={c.step}
            onChange={(e) => set(it.key, Number(e.target.value))}
          />
          {c.unit && <span className="set-num__unit">{c.unit}</span>}
        </div>
      );
    }

    return (
      <div className="set-range">
        <input
          type="range"
          min={c.min ?? 0} max={c.max ?? 100}
          value={Number(v)}
          onChange={(e) => set(it.key, Number(e.target.value))}
        />
        <span className="set-range__val">{Number(v)}{c.unit}</span>
      </div>
    );
  };

  const renderCard = ([title, items]: [string, Item[]]) => (
    <section className="set-card" key={title}>
      <header className="set-card__head">
        <h3 className="set-card__title">{title}</h3>
        <span className="set-card__count">{items.length} mục</span>
      </header>
      <div className="set-card__body">
        {items.map((it) => (
          <div className="set-row" key={it.key}>
            <div className="set-row__text">
              <div className="set-row__title">
                {it.title}
                {it.tone === 'warning' && <span className="badge badge-warning">cần xác nhận</span>}
              </div>
              {it.desc && <div className="set-row__desc">{it.desc}</div>}
            </div>
            <div className="set-row__control">{renderControl(it)}</div>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className="set__overlay" onClick={onClose}>
      <div className="set slide-up" onClick={(e) => e.stopPropagation()}>
        {/* ── Đầu ── */}
        <header className="set__head">
          <div className="set__head-icon"><SettingsIcon size={17} /></div>
          <div className="set__head-text">
            <h2 className="set__title">Cài đặt</h2>
            <p className="set__sub">Cấu hình PixelMind cho máy này · nền tối và một màu nhấn theo mục 3.10</p>
          </div>
          <span className="set__role badge badge-neutral">
            <ShieldCheck size={11} /> Vai trò: Dev
          </span>
          <button className="icon-btn" onClick={onClose} data-tooltip="Đóng · Esc" data-tooltip-pos="dr">
            <X size={16} />
          </button>
        </header>

        <div className="set__body">
          {/* ── Cột điều hướng ── */}
          <nav className="set__nav">
            <label className="set__search">
              <Search size={14} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm một mục cài đặt…"
              />
              {query && (
                <button className="set__search-clear" onClick={() => setQuery('')} aria-label="Xoá tìm kiếm">
                  <X size={12} />
                </button>
              )}
            </label>

            <div className="set__nav-list">
              {NAV.map((n) => {
                const count = n.key === 'shortcuts' ? SHORTCUTS.length : ITEMS.filter((i) => i.section === n.key).length;
                return (
                  <button
                    key={n.key}
                    className={`set__nav-item ${!q && section === n.key ? 'active' : ''}`}
                    onClick={() => { setSection(n.key); setQuery(''); }}
                  >
                    <n.icon size={15} />
                    <span className="set__nav-label">{n.label}</span>
                    <span className="set__nav-count">{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="set__nav-foot">
              <div className="set__nav-foot-row">
                <Database size={12} />
                <span>Cấu hình lưu tại</span>
              </div>
              <code className="set-mono set-mono--wrap">%APPDATA%\PixelMind\settings.json</code>
            </div>
          </nav>

          {/* ── Nội dung ── */}
          <div className="set__content">
            {q ? (
              <div className="set__result-bar">
                <ScanLine size={14} />
                <span>
                  Tìm thấy <strong>{shown.length}</strong> mục cho “{query}”
                </span>
              </div>
            ) : (
              <div className="set__section-head">
                {(() => {
                  const n = NAV.find((x) => x.key === section)!;
                  return (
                    <>
                      <span className="set__section-icon"><n.icon size={16} /></span>
                      <div>
                        <h2 className="set__section-title">{n.label}</h2>
                        <p className="set__section-sub">{SECTION_SUB[section]}</p>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Bảng màu — chỉ xem, để chứng minh tuân thủ mục 3.10 */}
            {!q && section === 'appearance' && (
              <section className="set-card">
                <header className="set-card__head">
                  <h3 className="set-card__title">Bảng màu của PixelMind</h3>
                  <span className="badge badge-accent"><Lock size={10} /> theo quy chuẩn 3.10</span>
                </header>
                <div className="set-card__body set-card__body--palette">
                  <div className="set-swatch">
                    <span className="set-swatch__chip" style={{ background: 'var(--accent)' }} />
                    <div>
                      <div className="set-swatch__name">Màu nhấn · tím</div>
                      <code className="set-mono">--hue-accent: 262 — chỉ dùng cho nút hành động và phần tử đang chọn</code>
                    </div>
                  </div>
                  <div className="set-legend">
                    <span className="set-legend__item"><i style={{ background: 'var(--color-success)' }} />Đạt</span>
                    <span className="set-legend__item"><i style={{ background: 'var(--color-warning)' }} />Cảnh báo</span>
                    <span className="set-legend__item"><i style={{ background: 'var(--color-error)' }} />Lỗi</span>
                    <span className="set-legend__item"><i style={{ background: 'var(--color-info)' }} />Đang xử lý</span>
                    <span className="set-legend__note">Màu trạng thái cố định, không đổi được</span>
                  </div>
                </div>
              </section>
            )}

            {/* Hồ sơ kết nối AI */}
            {!q && section === 'ai' && (
              <section className="set-card">
                <header className="set-card__head">
                  <h3 className="set-card__title">Hồ sơ kết nối</h3>
                  <button className="btn btn-sm" onClick={() => setScanned(true)}>
                    <ScanLine size={12} /> Quét PATH tìm CLI
                  </button>
                </header>
                <div className="set-card__body">
                  {PROFILES.map((p) => {
                    const on = activeProfile === p.id;
                    return (
                      <button
                        key={p.id}
                        className={`set-prof ${on ? 'is-on' : ''}`}
                        onClick={() => setActiveProfile(p.id)}
                      >
                        <span className="set-prof__radio">{on && <Check size={11} />}</span>
                        <span className="set-prof__body">
                          <span className="set-prof__top">
                            <span className="set-prof__name">{p.name}</span>
                            <span className="badge badge-neutral">{p.kind}</span>
                            {on && <span className="badge badge-success">đang bật</span>}
                          </span>
                          <span className="set-prof__target set-mono">{p.target}</span>
                          <span className="set-prof__meta">
                            <span>Phạm vi: {p.scope}</span>
                            <span>Tạo ngày {p.created}</span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  {scanned && (
                    <div className="set-note set-note--ok">
                      <CircleCheck size={13} />
                      <span>
                        Tìm thấy 2 CLI trên máy: <code className="set-mono">ollama</code> (C:\Program Files\Ollama) và{' '}
                        <code className="set-mono">antigravity</code> (C:\Users\LENOVO\AppData\Local\antigravity\bin).
                      </span>
                    </div>
                  )}
                  <div className="set-row">
                    <div className="set-row__text">
                      <div className="set-row__title">Kiểm tra kết nối hồ sơ đang bật</div>
                      <div className="set-row__desc">Gửi một lệnh thử để chắc chắn cầu nối còn sống trước khi nhờ AI sửa.</div>
                    </div>
                    <div className="set-row__control set-row__control--inline">
                      {testState === 'ok' && (
                        <span className="badge badge-success"><CircleCheck size={11} /> OK · 42ms · 3 model</span>
                      )}
                      <button className="btn btn-sm" onClick={() => setTestState('ok')}>
                        <Gauge size={12} /> Kiểm tra
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {cards.map(renderCard)}

            {/* Lệnh bị chặn */}
            {!q && section === 'security' && (
              <section className="set-card">
                <header className="set-card__head">
                  <h3 className="set-card__title">Lệnh bị chặn</h3>
                  <span className="badge badge-error"><ShieldCheck size={10} /> zero-trust</span>
                </header>
                <div className="set-card__body">
                  <div className="set-blocklist">
                    {BLOCKED.map((b) => (
                      <span className="set-block" key={b}>
                        <code className="set-mono">{b}</code>
                        <span className="set-block__tag">chặn</span>
                      </span>
                    ))}
                  </div>
                  <div className="set-row">
                    <div className="set-row__text">
                      <div className="set-row__title">Thêm mẫu lệnh cần chặn</div>
                      <div className="set-row__desc">Dùng ký tự đại diện * cho phần thay đổi được.</div>
                    </div>
                    <div className="set-row__control">
                      <input className="set-input is-mono" placeholder="vd: npm publish --access public" />
                    </div>
                  </div>
                  <div className="set-note">
                    <KeyRound size={13} />
                    <span>
                      Khoá API lưu trong <code className="set-mono">credentials.dat</code> đã mã hoá; giao diện không hiển thị lại khoá.
                    </span>
                  </div>
                </div>
              </section>
            )}

            {/* Giấy phép AI */}
            {!q && section === 'license' && (
              <section className="set-card">
                <header className="set-card__head">
                  <h3 className="set-card__title">Giấy phép đang dùng</h3>
                  <span className="badge badge-success"><BadgeCheck size={10} /> còn hiệu lực</span>
                </header>
                <div className="set-card__body">
                  <div className="set-lic">
                    <div className="set-lic__top">
                      <div>
                        <div className="set-lic__name">Gói Team · 5 người</div>
                        <div className="set-lic__sub">Cấp 01/10/2026 · hết hạn 29/10/2026</div>
                      </div>
                      <div className="set-lic__days">
                        <strong>12</strong>
                        <span>ngày còn lại</span>
                      </div>
                    </div>
                    <div className="set-lic__bar"><span style={{ width: '43%' }} /></div>
                    <div className="set-lic__meta">
                      <span><ShieldCheck size={12} /> Phạm vi: đọc · ghi · chạy lệnh</span>
                      <span><GitBranch size={12} /> Áp dụng cho: shop-landing</span>
                      <span><Server size={12} /> Thiết bị: 1 / 1</span>
                    </div>
                  </div>
                  <div className="set-note set-note--warning">
                    <TriangleAlert size={13} />
                    <span>Hết hạn hoặc bị thu hồi thì AI dừng ngay, kể cả đang giữa vòng sửa (mục 3.6).</span>
                  </div>
                  <div className="set-actions">
                    <button className="btn btn-primary btn-sm"><RefreshCw size={12} /> Gia hạn giấy phép</button>
                    <button className="btn btn-sm"><FileText size={12} /> Xem lịch sử cấp phát</button>
                    <button className="btn btn-danger btn-sm"><TriangleAlert size={12} /> Thu hồi</button>
                  </div>
                </div>
              </section>
            )}

            {/* Xuất bài */}
            {!q && section === 'storage' && (
              <section className="set-card">
                <header className="set-card__head">
                  <h3 className="set-card__title">Xuất bài để nộp</h3>
                  <span className="badge badge-neutral">mục 3.8</span>
                </header>
                <div className="set-card__body">
                  <code className="set-mono set-mono--wrap">
                    D:\CODE\PixelMind\shop-landing\export\shop-landing-2026-10-17.zip
                  </code>
                  <div className="set-actions">
                    <button className="btn btn-primary btn-sm"><Download size={12} /> Xuất bài</button>
                    <button className="btn btn-sm"><FolderOpen size={12} /> Mở thư mục xuất</button>
                    <button className="btn btn-sm"><ExternalLink size={12} /> Xem trước bản xuất</button>
                  </div>
                </div>
              </section>
            )}

            {/* Phím tắt */}
            {!q && section === 'shortcuts' && (
              <section className="set-card">
                <header className="set-card__head">
                  <h3 className="set-card__title">Phím tắt toàn cục</h3>
                  <span className="set-card__count">{SHORTCUTS.length} phím</span>
                </header>
                <div className="set-card__body set-keys">
                  {SHORTCUTS.map(([k, d]) => (
                    <div className="set-key" key={k}>
                      <kbd className="kbd">{k}</kbd>
                      <span>{d}</span>
                    </div>
                  ))}
                </div>
                <div className="set-card__body">
                  <div className="set-note">
                    <MousePointer2 size={13} />
                    <span>
                      Công cụ canvas: <b>V</b> chọn · <b>H</b> pan · <b>L</b> vùng · <b>T</b> ghi chú · <b>M</b> đo ·
                      giữ <b>Space</b> rồi kéo để di chuyển.
                    </span>
                  </div>
                  <div className="set-keys set-keys--tools">
                    <span className="set-tool"><MousePointer2 size={13} /> Chọn</span>
                    <span className="set-tool"><Hand size={13} /> Pan</span>
                    <span className="set-tool"><Square size={13} /> Vùng</span>
                    <span className="set-tool"><PenTool size={13} /> Ghi chú</span>
                    <span className="set-tool"><Ruler size={13} /> Đo</span>
                    <span className="set-tool"><ZoomIn size={13} /> Thu phóng</span>
                    <span className="set-tool"><Play size={13} /> Chạy server</span>
                  </div>
                </div>
              </section>
            )}

            {/* Nâng cao: cấu hình & khôi phục */}
            {!q && section === 'advanced' && (
              <section className="set-card">
                <header className="set-card__head">
                  <h3 className="set-card__title">Tệp cấu hình</h3>
                  <span className="badge badge-neutral">.json</span>
                </header>
                <div className="set-card__body">
                  <div className="set-row">
                    <div className="set-row__text">
                      <div className="set-row__title">Sao lưu và phục hồi cài đặt</div>
                      <div className="set-row__desc">Xuất ra một tệp JSON để mang sang máy khác, hoặc nhập lại từ tệp có sẵn.</div>
                    </div>
                    <div className="set-row__control set-row__control--inline">
                      <button className="btn btn-sm"><Download size={12} /> Xuất cấu hình</button>
                      <button className="btn btn-sm"><Upload size={12} /> Nhập cấu hình</button>
                    </div>
                  </div>
                  <div className="set-row">
                    <div className="set-row__text">
                      <div className="set-row__title">Khôi phục cài đặt mặc định</div>
                      <div className="set-row__desc">Đưa toàn bộ {ITEMS.length} mục về giá trị gốc của PixelMind.</div>
                    </div>
                    <div className="set-row__control set-row__control--inline">
                      <button className="btn btn-danger btn-sm" onClick={resetAll}>
                        <RotateCcw size={12} /> Khôi phục mặc định
                      </button>
                    </div>
                  </div>
                  <div className="set-note set-note--warning">
                    <AlertTriangle size={13} />
                    <span>Đổi cài đặt chỉ ảnh hưởng máy này. Cấu hình dùng chung của nhóm nằm trong Project Hub → Design system.</span>
                  </div>
                </div>
              </section>
            )}

            {/* Trạng thái không có kết quả */}
            {q && shown.length === 0 && (
              <div className="set-empty">
                <Search size={18} />
                <p>Không có mục cài đặt nào khớp với “{query}”.</p>
                <p className="set-empty__hint">Thử “nền”, “canvas”, “giấy phép”, “phím tắt” hoặc “xuất bài”.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Chân ── */}
        <footer className="set__foot">
          <span className="set__saved">
            <CircleCheck size={13} /> Đã lưu tự động lúc {savedAt}
          </span>
          <span className="set__foot-spacer" />
          <span className="set__foot-hint">
            <Monitor size={12} /><Moon size={12} /><Sun size={12} />
            <Terminal size={12} />
          </span>
          <button className="btn btn-ghost btn-sm" onClick={resetAll}>
            <RotateCcw size={12} /> Mặc định
          </button>
          <button className="btn btn-primary btn-sm" onClick={onClose}>Xong</button>
        </footer>
      </div>
    </div>
  );
};

/* Mô tả ngắn cho từng nhóm cài đặt */
const SECTION_SUB: Record<SetSection, string> = {
  general: 'Ngôn ngữ, khởi động và cách PixelMind nhắc bạn khi có việc cần xử lý.',
  appearance: 'Nền tối, một màu nhấn duy nhất và hệ khoảng cách dùng chung cho mọi panel.',
  canvas: 'Khung hiển thị, chế độ xem và cách app so giao diện với ảnh mẫu.',
  ai: 'Chọn hồ sơ kết nối, giới hạn số vòng sửa và những gì AI được phép làm trong dự án.',
  security: 'Cầu nối cục bộ, khoá API, danh sách lệnh bị chặn và xác nhận trước thao tác nguy hiểm.',
  license: 'Giấy phép AI còn hạn bao lâu, phạm vi quyền và mức nhắc trước khi hết hạn.',
  storage: 'Đường dẫn dự án, tự lưu, số bản lưu và cách đóng gói bài để nộp.',
  shortcuts: 'Toàn bộ phím tắt dùng trong app để thao tác nhanh.',
  advanced: 'Dev server, chẩn đoán và tệp cấu hình dùng khi cần mang sang máy khác.',
};

export default Settings;
