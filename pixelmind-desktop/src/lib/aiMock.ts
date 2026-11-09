/* Dữ liệu mẫu cho giao diện Trợ lý AI (chưa kết nối backend AI). */

export type AiBridgeKind = 'api' | 'ide' | 'cli' | 'ollama'
export type AiChangeStatus = 'pending' | 'accepted' | 'rejected'
export type AiStepStatus = 'done' | 'running' | 'pending' | 'failed'
import type { AiSelection } from '@shared/ai'

export type AiMessageRole = 'user' | 'assistant' | 'system'
export type AiTab = 'chat' | 'tasks' | 'changes' | 'context' | 'errors'

export interface AiBridgeProfile {
  id: AiBridgeKind
  name: string
  detail: string
  status: 'online' | 'offline' | 'local'
  model?: string
}

export interface AiDiffLine {
  kind: 'add' | 'del' | 'ctx' | 'hunk'
  text: string
}

export interface AiChange {
  id: string
  file: string
  summary: string
  added: number
  removed: number
  status: AiChangeStatus
  diff: AiDiffLine[]
  task?: string
}

export interface AiStep {
  label: string
  status: AiStepStatus
}

export interface AiTask {
  id: string
  title: string
  detail: string
  status: 'running' | 'done' | 'failed' | 'queued'
  progress: number
  steps: AiStep[]
  time: string
}

export interface AiChatMessage {
  id: string
  role: AiMessageRole
  text: string
  time: string
  plan?: AiStep[]
  diff?: AiChange
}

export interface AiContextItem {
  id: string
  label: string
  detail: string
  tokens: number
  checked: boolean
}

export interface AiBuildError {
  id: string
  code: string
  file: string
  line?: number
  message: string
  severity: 'error' | 'warning'
}

export interface AiThemeOption {
  id: string
  name: string
  mood: string
  accent: string
  accent2: string
  bg: string
  surface: string
  text: string
  muted: string
  font: string
  radius: number
}

export interface AiDesignSection {
  id: string
  name: string
  role: string
  confidence: number
  checked: boolean
}

/** Phần tử đang được chọn trên canvas, dùng cho ngữ cảnh và sidecar. */
export type AiSelectedElement = AiSelection

export const AI_BRIDGES: AiBridgeProfile[] = [
  { id: 'api', name: 'API Bridge', detail: 'OpenAI · GPT-4o', status: 'online', model: 'gpt-4o' },
  { id: 'ide', name: 'IDE WebSocket', detail: 'ws://localhost:45678', status: 'online', model: 'Antigravity' },
  { id: 'cli', name: 'CLI Bridge', detail: 'opencode · local', status: 'offline', model: 'opencode' },
  { id: 'ollama', name: 'Ollama Local', detail: 'http://localhost:11434', status: 'local', model: 'qwen2.5-coder' },
]

export const AI_CONTEXT_ITEMS: AiContextItem[] = [
  { id: 'selection', label: 'Vùng chọn trên canvas', detail: 'a.nav-link · “Hồ sơ” · 96×36', tokens: 320, checked: true },
  { id: 'source', label: 'Tệp nguồn của phần tử', detail: 'Views/Shared/_Layout.cshtml', tokens: 1240, checked: true },
  { id: 'screenshot', label: 'Ảnh chụp vùng chọn', detail: 'PNG · 96×36 @2x', tokens: 860, checked: true },
  { id: 'tokens', label: 'Design tokens', detail: 'tokens.css · 24 biến', tokens: 430, checked: true },
  { id: 'wires', label: 'Sơ đồ dây nối', detail: '6 trang · 9 liên kết', tokens: 610, checked: true },
  { id: 'logs', label: 'Log build gần nhất', detail: 'dotnet watch · 42 dòng', tokens: 1150, checked: false },
  { id: 'project', label: 'Toàn bộ dự án (chỉ mục)', detail: '48 tệp · route, component, asset', tokens: 3400, checked: false },
]

export const AI_CHANGES: AiChange[] = [
  {
    id: 'chg-navbar',
    file: 'Views/Shared/_Layout.cshtml',
    summary: 'Navbar tối giản + nút Đăng nhập theo theme',
    added: 12,
    removed: 4,
    status: 'pending',
    task: 'Sửa navbar',
    diff: [
      { kind: 'hunk', text: '@@ -18,7 +18,15 @@' },
      { kind: 'ctx', text: '  <nav class="navbar navbar-expand-sm navbar-dark app-navbar">' },
      { kind: 'del', text: '    <div class="container">' },
      { kind: 'add', text: '    <div class="container app-navbar__inner">' },
      { kind: 'ctx', text: '      <a class="navbar-brand" asp-controller="Home" asp-action="Index">' },
      { kind: 'del', text: '        <span class="brand-mark">♟</span> Bàn Cờ Tướng' },
      { kind: 'add', text: '        <span class="brand-mark">♟</span> Bàn Cờ Tướng' },
      { kind: 'add', text: '      </a>' },
      { kind: 'add', text: '      <a class="btn btn-nav-login" asp-controller="Account" asp-action="Index">' },
      { kind: 'add', text: '        Đăng nhập' },
      { kind: 'ctx', text: '      </a>' },
    ],
  },
  {
    id: 'chg-tokens',
    file: 'wwwroot/css/site.css',
    summary: 'Thêm token màu tối cho navbar và nút nhấn',
    added: 9,
    removed: 2,
    status: 'pending',
    task: 'Sửa navbar',
    diff: [
      { kind: 'hunk', text: '@@ -12,6 +12,13 @@' },
      { kind: 'ctx', text: ' :root {' },
      { kind: 'add', text: '  --nav-bg: #0f1117;' },
      { kind: 'add', text: '  --nav-text: #e5e7eb;' },
      { kind: 'add', text: '  --nav-hover: rgba(255, 255, 255, 0.08);' },
      { kind: 'del', text: '  --nav-accent: #2563eb;' },
      { kind: 'add', text: '  --nav-accent: var(--accent, #6d5df5);' },
      { kind: 'add', text: '  --nav-radius: 8px;' },
      { kind: 'ctx', text: ' }' },
      { kind: 'add', text: '.app-navbar__inner { display: flex; align-items: center; gap: 10px; }' },
      { kind: 'add', text: '.btn-nav-login { background: var(--nav-accent); color: #fff; border-radius: var(--nav-radius); }' },
    ],
  },
  {
    id: 'chg-hero',
    file: 'Views/Home/Index.cshtml',
    summary: 'Hero CTA dùng token theme mới',
    added: 6,
    removed: 3,
    status: 'accepted',
    task: 'Tạo theme',
    diff: [
      { kind: 'hunk', text: '@@ -34,7 +34,10 @@' },
      { kind: 'del', text: '  <a class="btn btn-primary" asp-action="Lobby">Chơi ngay</a>' },
      { kind: 'add', text: '  <a class="btn btn-primary hero-cta" asp-action="Lobby">' },
      { kind: 'add', text: '    Chơi ngay' },
      { kind: 'add', text: '    <i class="icon-arrow-right"></i>' },
      { kind: 'ctx', text: '  </a>' },
    ],
  },
  {
    id: 'chg-wire',
    file: 'Views/Home/Leaderboard.cshtml',
    summary: 'Nối nút “Hồ sơ” tới /Home/Profile thay vì /Account',
    added: 1,
    removed: 1,
    status: 'rejected',
    task: 'Nối dây',
    diff: [
      { kind: 'hunk', text: '@@ -41,7 +41,7 @@' },
      { kind: 'del', text: '<a class="nav-link" asp-controller="Account" asp-action="Index">Hồ sơ</a>' },
      { kind: 'add', text: '<a class="nav-link" asp-controller="Home" asp-action="Profile">Hồ sơ</a>' },
    ],
  },
]

export const AI_TASKS: AiTask[] = [
  {
    id: 'task-wires',
    title: 'Nối các nút chưa có đích',
    detail: 'Quét anchor trên 6 trang và đề xuất dây nối còn thiếu',
    status: 'running',
    progress: 62,
    time: 'đang chạy · 00:42',
    steps: [
      { label: 'Quét DOM các trang', status: 'done' },
      { label: 'Đối chiếu với sơ đồ dây nối', status: 'done' },
      { label: 'Đề xuất 3 liên kết mới', status: 'running' },
      { label: 'Chờ duyệt diff', status: 'pending' },
    ],
  },
  {
    id: 'task-build',
    title: 'Sửa lỗi build',
    detail: 'MSB3027 · BanCoTuong.exe bị khoá bởi tiến trình cũ',
    status: 'done',
    progress: 100,
    time: 'hoàn tất · 01:18',
    steps: [
      { label: 'Đọc log build', status: 'done' },
      { label: 'Xác định tiến trình đang khoá tệp', status: 'done' },
      { label: 'Dừng tiến trình cũ và chạy lại', status: 'done' },
    ],
  },
  {
    id: 'task-theme',
    title: 'Tạo theme cờ tướng',
    detail: '3 phương án màu · typography · radius',
    status: 'done',
    progress: 100,
    time: 'hoàn tất · 00:36',
    steps: [
      { label: 'Phân tích mô tả', status: 'done' },
      { label: 'Sinh bảng màu và typography', status: 'done' },
      { label: 'Ghi tokens.css', status: 'done' },
    ],
  },
  {
    id: 'task-design',
    title: 'Import hero.png → HTML',
    detail: 'Chờ ảnh thiết kế từ người dùng',
    status: 'queued',
    progress: 0,
    time: 'trong hàng đợi',
    steps: [
      { label: 'Nhận ảnh thiết kế', status: 'pending' },
      { label: 'Nhận diện section', status: 'pending' },
      { label: 'Sinh mã và chèn vào trang', status: 'pending' },
    ],
  },
]

export const AI_INITIAL_MESSAGES: AiChatMessage[] = [
  {
    id: 'msg-welcome',
    role: 'assistant',
    time: '10:24',
    text:
      'Chào bạn 👋 Mình đã đọc cấu trúc dự án, design tokens và các trang trên canvas. Bạn có thể chọn một phần tử trên canvas rồi nhờ mình sửa, hoặc dùng gợi ý bên dưới. Mọi thay đổi đều được đưa ra dưới dạng diff để bạn duyệt trước khi ghi vào mã nguồn.',
  },
  {
    id: 'msg-user-1',
    role: 'user',
    time: '10:26',
    text: 'Làm navbar gọn hơn, nền tối và thêm nút Đăng nhập.',
  },
  {
    id: 'msg-assistant-1',
    role: 'assistant',
    time: '10:26',
    text:
      'Mình sẽ sửa navbar theo hướng tối giản, giữ logo và các liên kết hiện có, thêm nút Đăng nhập ở bên phải. Có 2 tệp cần thay đổi:',
    plan: [
      { label: 'Đọc _Layout.cshtml và site.css', status: 'done' },
      { label: 'Cập nhật markup navbar', status: 'done' },
      { label: 'Thêm token màu tối + nút Đăng nhập', status: 'running' },
      { label: 'Chờ bạn duyệt diff', status: 'pending' },
    ],
    diff: AI_CHANGES[0],
  },
]

export const AI_BUILD_ERRORS: AiBuildError[] = [
  {
    id: 'err-lock',
    code: 'MSB3027',
    file: 'BanCoTuong/BanCoTuong.csproj',
    message:
      'Could not copy "obj/Debug/net8.0/apphost.exe" to "bin/Debug/net8.0/BanCoTuong.exe". The file is locked by "BanCoTuong (27508)".',
    severity: 'error',
  },
  {
    id: 'err-null',
    code: 'CS8602',
    file: 'Controllers/HomeController.cs',
    line: 42,
    message: 'Dereference of a possibly null reference: `user.DisplayName`.',
    severity: 'warning',
  },
]

export const AI_FIX_STEPS = [
  'Đọc log và xác định lỗi',
  'Tìm tệp / dòng liên quan',
  'Đề xuất cách sửa',
  'Áp dụng thay đổi và chạy lại build',
]

export const AI_FIX_CHANGE: AiChange = {
  id: 'chg-fix-lock',
  file: 'electron/main/runner.ts',
  summary: 'Dừng tiến trình cũ trước khi chạy dotnet để tránh khoá tệp',
  added: 8,
  removed: 1,
  status: 'pending',
  task: 'Sửa lỗi build',
  diff: [
    { kind: 'hunk', text: '@@ -184,6 +184,13 @@' },
    { kind: 'ctx', text: '    const command = options.command' },
    { kind: 'add', text: '    // Dừng tiến trình .exe còn sót lại trước khi build' },
    { kind: 'add', text: '    if (process.platform === \'win32\' && /\\bdotnet\\b/i.test(command)) {' },
    { kind: 'add', text: '      const exeName = basename(entry.state.cwd)' },
    { kind: 'add', text: '      try { execSync(`taskkill /IM "${exeName}.exe" /T /F`, { stdio: \'ignore\' }) }' },
    { kind: 'add', text: '      catch { /* không có tiến trình cũ */ }' },
    { kind: 'add', text: '    }' },
    { kind: 'ctx', text: '    this.entries.set(id, entry)' },
  ],
}

export const AI_THEMES: AiThemeOption[] = [
  {
    id: 'do-son',
    name: 'Đỏ son · Giấy cũ',
    mood: 'Cổ điển · ấm · truyền thống',
    accent: '#b91c1c',
    accent2: '#d97706',
    bg: '#f8f5ef',
    surface: '#ffffff',
    text: '#1f2937',
    muted: '#6b7280',
    font: 'Be Vietnam Pro',
    radius: 10,
  },
  {
    id: 'ngoc-dem',
    name: 'Xanh ngọc · Đêm',
    mood: 'Hiện đại · tập trung · dịu mắt',
    accent: '#10b981',
    accent2: '#38bdf8',
    bg: '#0b1220',
    surface: '#111a2e',
    text: '#e2e8f0',
    muted: '#94a3b8',
    font: 'Inter',
    radius: 12,
  },
  {
    id: 'tim-hien-dai',
    name: 'Tím · Hiện đại',
    mood: 'Năng động · công nghệ · nổi bật',
    accent: '#6d5df5',
    accent2: '#a78bfa',
    bg: '#0f1014',
    surface: '#191b21',
    text: '#eceef2',
    muted: '#a3a9b4',
    font: 'Inter',
    radius: 14,
  },
]

export const AI_DESIGN_SECTIONS: AiDesignSection[] = [
  { id: 'sec-header', name: 'Header / Navbar', role: 'logo + điều hướng + CTA', confidence: 98, checked: true },
  { id: 'sec-hero', name: 'Hero', role: 'tiêu đề lớn + mô tả + 2 nút', confidence: 94, checked: true },
  { id: 'sec-features', name: 'Features', role: '3 thẻ tính năng', confidence: 88, checked: true },
  { id: 'sec-cta', name: 'CTA', role: 'khối kêu gọi hành động', confidence: 82, checked: true },
  { id: 'sec-footer', name: 'Footer', role: 'liên kết + bản quyền', confidence: 91, checked: true },
]

export const AI_CONTENT_FIELDS = [
  { id: 'hero-title', label: 'Tiêu đề Hero', value: 'Khai cuộc cùng Bàn Cờ Tướng' },
  { id: 'hero-sub', label: 'Mô tả Hero', value: 'Học cờ tướng, đấu trực tuyến và theo dõi tiến bộ của bạn trong một không gian duy nhất.' },
  { id: 'hero-cta', label: 'Nút CTA', value: 'Chơi ngay miễn phí' },
  { id: 'feature-1', label: 'Tính năng 1', value: 'Đấu trực tuyến theo thời gian thực' },
  { id: 'feature-2', label: 'Tính năng 2', value: 'Bài tập khai cuộc thông minh' },
  { id: 'feature-3', label: 'Tính năng 3', value: 'Bảng xếp hạng công bằng' },
]

export const AI_CONTENT_TONES = [
  { id: 'chuyen-nghiep', label: 'Chuyên nghiệp' },
  { id: 'than-thien', label: 'Thân thiện' },
  { id: 'ngan-gon', label: 'Ngắn gọn' },
  { id: 'hao-hung', label: 'Hào hứng' },
]
