/* ═══════════════════════════════════════════════════
   Dữ liệu dùng chung cho các màn quản lý.
   Nội dung bám theo bản thiết kế giao diện (prototype/index.html)
   và khớp tên bảng trong database/schema.sql.

   Ghi chú: đây là dữ liệu trưng bày, chưa nối CSDL.
   ═══════════════════════════════════════════════════ */

export type Page = {
  id: string;
  route: string;
  title: string;
  /** có ảnh mẫu hay không — theo CN03: ảnh mẫu KHÔNG bắt buộc */
  ref: 'co' | 'khong';
  software: string;
  frame: string;
  note?: string;
};

export const PROJECT = {
  code: 'DA-004',
  name: 'ShopWeb',
  stack: 'Next.js',
  folder: 'D:\\Code\\shopweb',
  owner: 'Nguyễn Thanh Hiền',
  created: '12/10/2026',
  repo: 'hien-nguyen/shopweb',
  devServer: 'localhost:3000',
  version: 'v3',
  commit: 'a41f9c2',
} as const;

export const PAGES: Page[] = [
  { id: 'p1', route: '/', title: 'Trang chủ', ref: 'co', software: 'Figma', frame: '1440×900' },
  { id: 'p2', route: '/dang-nhap', title: 'Đăng nhập', ref: 'co', software: 'Photoshop', frame: '390×844' },
  { id: 'p3', route: '/gio-hang', title: 'Giỏ hàng', ref: 'khong', software: '—', frame: '—', note: 'không bắt buộc' },
  {
    id: 'p4',
    route: '/san-pham',
    title: 'Danh sách sản phẩm',
    ref: 'khong',
    software: '—',
    frame: '—',
    note: 'không bắt buộc',
  },
];

export type Version = {
  id: string;
  tag: string;
  hash: string;
  when: string;
  what: string;
  by: string;
  state: 'cho-duyet' | 'da-duyet' | 'tu-choi';
  rounds?: string;
  ticket?: string;
};

export const VERSIONS: Version[] = [
  {
    id: 'v3',
    tag: 'v3',
    hash: 'a41f9c2',
    when: '17/10',
    what: 'Sửa nút Đăng nhập theo ảnh mẫu',
    by: 'AI sửa 2 vòng',
    state: 'cho-duyet',
    rounds: '2 vòng',
    ticket: 'PYC-014',
  },
  {
    id: 'v2',
    tag: 'v2',
    hash: '77b0de1',
    when: '16/10',
    what: 'Đổi màu header sang #111111',
    by: 'sửa tay',
    state: 'da-duyet',
    ticket: 'PYC-013',
  },
  {
    id: 'v1',
    tag: 'v1',
    hash: '05ce7aa',
    when: '15/10',
    what: 'Dựng khung trang chủ từ part có sẵn',
    by: 'ghép part',
    state: 'da-duyet',
    rounds: '1 vòng',
    ticket: 'PYC-011',
  },
  {
    id: 'v0',
    tag: 'v0',
    hash: 'init',
    when: '12/10',
    what: 'Khởi tạo dự án, nạp design token',
    by: 'khởi tạo',
    state: 'da-duyet',
  },
];

export type Ticket = {
  id: string;
  title: string;
  kind: 'Đối chiếu ảnh mẫu' | 'Sửa theo yêu cầu' | 'Kiểm tra token';
  who: string;
  due: string;
  state: 'dang-xu-ly' | 'cho-duyet' | 'qua-han' | 'xong';
  scope: string;
  brief: string;
};

export const TICKETS: Ticket[] = [
  {
    id: 'PYC-014',
    title: 'Sửa nút Đăng nhập cho giống ảnh mẫu',
    kind: 'Đối chiếu ảnh mẫu',
    who: 'Nguyễn Thanh Hiền',
    due: '17/10',
    state: 'dang-xu-ly',
    scope: 'a.wlogin · header.wnav',
    brief: 'Ảnh mẫu đệm 8px 15px, chữ 12.5px. Live đang 8px 20px, chữ 13.5px.',
  },
  {
    id: 'PYC-013',
    title: 'Đổi màu header sang #111111',
    kind: 'Sửa theo yêu cầu',
    who: 'Phạm Thu',
    due: '16/10',
    state: 'cho-duyet',
    scope: 'header.wnav',
    brief: 'Khách chốt nền header tối, chữ trắng. Đã sửa, chờ duyệt.',
  },
  {
    id: 'PYC-012',
    title: 'Kiểm tra token sau khi ghép part',
    kind: 'Kiểm tra token',
    who: 'Đoàn Quí Trường',
    due: '15/10',
    state: 'xong',
    scope: 'toàn trang',
    brief: '11/11 token sạch, không còn mã màu cứng.',
  },
  {
    id: 'PYC-011',
    title: 'Dựng khung trang chủ từ part có sẵn',
    kind: 'Sửa theo yêu cầu',
    who: 'Nguyễn Thanh Hiền',
    due: '15/10',
    state: 'xong',
    scope: 'toàn trang',
    brief: 'Ghép 4 part: navbar, hero, card dọc, footer.',
  },
  {
    id: 'PYC-010',
    title: 'Trang giỏ hàng chưa có ảnh mẫu',
    kind: 'Đối chiếu ảnh mẫu',
    who: 'Phạm Thu',
    due: '14/10',
    state: 'qua-han',
    scope: '/gio-hang',
    brief: 'Chờ khách gửi ảnh mẫu. Chưa có thì so sánh theo DOM.',
  },
];

export type Check = {
  id: string;
  page: string;
  total: number;
  pass: number;
  state: 'dat' | 'canh-bao' | 'loi' | 'dang-xu-ly';
  when: string;
  note: string;
};

export const CHECKS: Check[] = [
  { id: 'KT-018', page: '/', total: 11, pass: 11, state: 'dat', when: '17/10 15:20', note: 'Token sạch, khớp ảnh mẫu' },
  { id: 'KT-017', page: '/dang-nhap', total: 11, pass: 9, state: 'canh-bao', when: '17/10 14:02', note: 'Sai cỡ chữ nav.wlinks (14px so với 13px)' },
  { id: 'KT-016', page: '/', total: 11, pass: 6, state: 'loi', when: '16/10 20:41', note: 'Tràn chữ 42px khi thu về khung 390px' },
  { id: 'KT-015', page: '/san-pham', total: 11, pass: 11, state: 'dat', when: '16/10 11:15', note: 'Không có ảnh mẫu — so sánh theo DOM' },
  { id: 'KT-014', page: '/gio-hang', total: 11, pass: 10, state: 'dang-xu-ly', when: '15/10 09:30', note: 'Đang quét lại sau khi ghép part' },
];

export type License = {
  id: string;
  who: string;
  project: string;
  until: string;
  used: number;
  cap: number;
  state: 'con-han' | 'sap-het' | 'thu-hoi';
};

export const LICENSES: License[] = [
  { id: 'GP-001', who: 'Nguyễn Thanh Hiền', project: 'ShopWeb', until: '31/12', used: 118, cap: 300, state: 'con-han' },
  { id: 'GP-002', who: 'Đoàn Quí Trường', project: 'ShopWeb', until: '31/12', used: 92, cap: 300, state: 'con-han' },
  { id: 'GP-003', who: 'Phạm Thu', project: 'ShopWeb', until: '15/10', used: 300, cap: 300, state: 'thu-hoi' },
  { id: 'GP-004', who: 'Trần Bảo Long', project: 'Portfolio', until: '30/11', used: 74, cap: 150, state: 'sap-het' },
  { id: 'GP-005', who: 'Lê Minh Anh', project: 'Admin Dashboard', until: '31/12', used: 21, cap: 300, state: 'con-han' },
];

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'dev' | 'reviewer';
  joined: string;
  lastSeen: string;
  state: 'hoat-dong' | 'cho-moi' | 'khoa';
};

export const USERS: User[] = [
  { id: 'ND-001', name: 'Nguyễn Thanh Hiền', email: 'hien.nguyen@sv.edu.vn', role: 'admin', joined: '12/10/2026', lastSeen: '2 phút trước', state: 'hoat-dong' },
  { id: 'ND-002', name: 'Đoàn Quí Trường', email: 'truong.doan@sv.edu.vn', role: 'dev', joined: '12/10/2026', lastSeen: '1 giờ trước', state: 'hoat-dong' },
  { id: 'ND-003', name: 'Phạm Thu', email: 'thu.pham@sv.edu.vn', role: 'reviewer', joined: '13/10/2026', lastSeen: 'hôm qua', state: 'khoa' },
  { id: 'ND-004', name: 'Trần Bảo Long', email: 'long.tran@sv.edu.vn', role: 'dev', joined: '14/10/2026', lastSeen: '3 ngày trước', state: 'khoa' },
  { id: 'ND-005', name: 'Lê Minh Anh', email: 'anh.le@sv.edu.vn', role: 'reviewer', joined: '15/10/2026', lastSeen: 'chưa đăng nhập', state: 'cho-moi' },
];

export type LogRow = {
  time: string;
  who: string;
  action: string;
  kind: 'ai' | 'nguoi' | 'he-thong';
  target: string;
  state: 'dat' | 'canh-bao' | 'loi' | 'dang-xu-ly';
};

export const LOG: LogRow[] = [
  { time: '17/10 15:24', who: 'Nguyễn Thanh Hiền', action: 'Chèn part Searchbox bo tròn vào /', kind: 'nguoi', target: 'Home.tsx', state: 'dat' },
  { time: '17/10 15:20', who: 'Máy kiểm tra', action: 'Kiểm tra token trang / — 11/11 sạch', kind: 'he-thong', target: '/', state: 'dat' },
  { time: '17/10 14:02', who: 'AI · Antigravity', action: 'Sửa nút Đăng nhập theo ảnh mẫu (2 vòng)', kind: 'ai', target: 'Header.tsx', state: 'canh-bao' },
  { time: '17/10 13:40', who: 'Phạm Thu', action: 'Từ chối phiên bản v2 — màu header chưa đúng', kind: 'nguoi', target: 'v2', state: 'loi' },
  { time: '16/10 20:41', who: 'Máy kiểm tra', action: 'Phát hiện tràn chữ ở khung 390px', kind: 'he-thong', target: '/', state: 'loi' },
  { time: '16/10 11:15', who: 'Đoàn Quí Trường', action: 'Duyệt phiên bản v2', kind: 'nguoi', target: 'v2', state: 'dat' },
  { time: '15/10 09:30', who: 'AI · Ollama', action: 'Ghép 4 part thành trang chủ', kind: 'ai', target: 'Home.tsx', state: 'dang-xu-ly' },
];

export const DESIGN_TOKENS: { name: string; value: string; use: string; group: string }[] = [
  { name: '--bg', value: '#0b0c0f', use: 'Nền toàn app', group: 'Nền' },
  { name: '--panel', value: '#131519', use: 'Panel, thẻ', group: 'Nền' },
  { name: '--panel-2', value: '#191b21', use: 'Ô nhập, nút', group: 'Nền' },
  { name: '--panel-3', value: '#20232a', use: 'Chip, popover', group: 'Nền' },
  { name: '--line', value: 'rgba(255,255,255,.075)', use: 'Viền hairline', group: 'Viền' },
  { name: '--line-2', value: 'rgba(255,255,255,.14)', use: 'Viền đậm hơn', group: 'Viền' },
  { name: '--text', value: '#eceef2', use: 'Chữ chính', group: 'Chữ' },
  { name: '--text-2', value: '#a3a9b4', use: 'Chữ phụ', group: 'Chữ' },
  { name: '--text-3', value: '#717884', use: 'Chữ mờ', group: 'Chữ' },
  { name: '--accent', value: '#6d5df5', use: 'Màu nhấn duy nhất', group: 'Nhấn' },
  { name: '--accent-2', value: '#8c7dff', use: 'Chữ trên nền nhấn', group: 'Nhấn' },
  { name: '--ok', value: '#31c07a', use: 'Đạt', group: 'Trạng thái' },
  { name: '--warn', value: '#e2b13c', use: 'Cảnh báo', group: 'Trạng thái' },
  { name: '--err', value: '#f0553f', use: 'Lỗi', group: 'Trạng thái' },
  { name: '--info', value: '#4a8df6', use: 'Đang xử lý', group: 'Trạng thái' },
  { name: '--r-sm', value: '7px', use: 'Nút, ô nhập', group: 'Bo góc' },
  { name: '--r', value: '10px', use: 'Thẻ, panel', group: 'Bo góc' },
  { name: '--r-lg', value: '14px', use: 'Hộp thoại', group: 'Bo góc' },
  { name: '--sh', value: '0 14px 38px rgba(0,0,0,.5)', use: 'Lớp nổi', group: 'Bóng đổ' },
];
