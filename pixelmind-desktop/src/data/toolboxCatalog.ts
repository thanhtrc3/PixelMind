/* ══════════════════════════════════════════════════════════════
   Catalog 60 phần tử cốt lõi cho Hộp công cụ (MVP)
   Mỗi phần tử dùng inline style để chèn được vào mọi framework
   mà không cần sửa file CSS toàn cục.
   ══════════════════════════════════════════════════════════════ */

import type { ToolboxElement, ToolboxGroupId } from '@shared/toolbox'

const FONT = "font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"

const items: ToolboxElement[] = [
  /* ───────────── BỐ CỤC ───────────── */
  {
    id: 'layout-container',
    name: 'Container',
    group: 'layout',
    tags: ['container', 'wrapper', 'khung', 'max-width'],
    description: 'Khung giới hạn chiều rộng tối đa, căn giữa trang.',
    container: true,
    html: `<div style="width:100%; max-width:1200px; margin:0 auto; padding:0 24px; box-sizing:border-box; ${FONT}">
  <p style="margin:0; color:#64748b; font-size:15px; line-height:1.6;">Nội dung bên trong container</p>
</div>`,
  },
  {
    id: 'layout-section',
    name: 'Section',
    group: 'layout',
    tags: ['section', 'khối', 'phân vùng', 'vùng'],
    description: 'Khối phân vùng nội dung có padding và nền.',
    container: true,
    html: `<section style="padding:64px 24px; background:#ffffff; ${FONT}">
  <div style="max-width:1200px; margin:0 auto;">
    <h2 style="margin:0 0 12px; font-size:32px; line-height:1.25; font-weight:700; color:#0f172a;">Tiêu đề section</h2>
    <p style="margin:0; font-size:16px; line-height:1.65; color:#64748b;">Mô tả ngắn cho khu vực nội dung này.</p>
  </div>
</section>`,
  },
  {
    id: 'layout-div',
    name: 'Div block',
    group: 'layout',
    tags: ['div', 'block', 'khối'],
    description: 'Khối trung tính dùng để bọc nội dung.',
    container: true,
    html: `<div style="padding:16px; ${FONT}">
  <p style="margin:0; color:#334155; font-size:15px;">Khối nội dung</p>
</div>`,
  },
  {
    id: 'layout-row',
    name: 'Row 12 cột',
    group: 'layout',
    tags: ['row', 'hàng', '12', 'grid', 'bootstrap'],
    description: 'Hàng chia cột theo hệ 12 cột, tự xuống dòng trên mobile.',
    container: true,
    html: `<div style="display:flex; flex-wrap:wrap; gap:24px; ${FONT}">
  <div style="flex:1 1 0; min-width:220px; padding:20px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; color:#334155; font-size:14px;">Cột 1</div>
  <div style="flex:1 1 0; min-width:220px; padding:20px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; color:#334155; font-size:14px;">Cột 2</div>
  <div style="flex:1 1 0; min-width:220px; padding:20px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; color:#334155; font-size:14px;">Cột 3</div>
</div>`,
  },
  {
    id: 'layout-column',
    name: 'Column',
    group: 'layout',
    tags: ['column', 'cột', 'col'],
    description: 'Một cột co giãn trong hàng flex.',
    container: true,
    html: `<div style="flex:1 1 0; min-width:220px; padding:20px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; ${FONT}">
  <p style="margin:0; color:#334155; font-size:14px;">Nội dung cột</p>
</div>`,
  },
  {
    id: 'layout-stack',
    name: 'Stack dọc',
    group: 'layout',
    tags: ['stack', 'column', 'flex', 'dọc'],
    description: 'Xếp các phần tử theo chiều dọc với khoảng cách đều.',
    container: true,
    html: `<div style="display:flex; flex-direction:column; gap:16px; ${FONT}">
  <div style="padding:14px 16px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; color:#334155; font-size:14px;">Phần tử 1</div>
  <div style="padding:14px 16px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; color:#334155; font-size:14px;">Phần tử 2</div>
  <div style="padding:14px 16px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; color:#334155; font-size:14px;">Phần tử 3</div>
</div>`,
  },
  {
    id: 'layout-grid-3',
    name: 'Grid 3 cột',
    group: 'layout',
    tags: ['grid', 'lưới', '3 cột'],
    description: 'Lưới 3 cột tự co giãn theo bề rộng.',
    container: true,
    html: `<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:20px; ${FONT}">
  <div style="padding:20px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; color:#334155; font-size:14px;">Ô 1</div>
  <div style="padding:20px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; color:#334155; font-size:14px;">Ô 2</div>
  <div style="padding:20px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; color:#334155; font-size:14px;">Ô 3</div>
</div>`,
  },
  {
    id: 'layout-spacer',
    name: 'Spacer',
    group: 'layout',
    tags: ['spacer', 'khoảng trống', 'space'],
    description: 'Khoảng trống dọc để đẩy nội dung.',
    html: `<div style="height:48px;" aria-hidden="true"></div>`,
  },

  /* ───────────── VĂN BẢN ───────────── */
  {
    id: 'text-h1',
    name: 'Tiêu đề H1',
    group: 'typography',
    tags: ['h1', 'title', 'tiêu đề'],
    description: 'Tiêu đề lớn nhất trang.',
    html: `<h1 style="margin:0 0 16px; font-size:44px; line-height:1.15; font-weight:800; letter-spacing:-0.02em; color:#0f172a; ${FONT}">Tiêu đề chính của trang</h1>`,
  },
  {
    id: 'text-h2',
    name: 'Tiêu đề H2',
    group: 'typography',
    tags: ['h2', 'heading', 'tiêu đề'],
    description: 'Tiêu đề cấp 2 cho section.',
    html: `<h2 style="margin:0 0 12px; font-size:32px; line-height:1.25; font-weight:700; color:#0f172a; ${FONT}">Tiêu đề section</h2>`,
  },
  {
    id: 'text-h3',
    name: 'Tiêu đề H3',
    group: 'typography',
    tags: ['h3', 'heading', 'tiêu đề'],
    description: 'Tiêu đề cấp 3 cho khối nội dung.',
    html: `<h3 style="margin:0 0 8px; font-size:22px; line-height:1.35; font-weight:650; color:#0f172a; ${FONT}">Tiêu đề phụ</h3>`,
  },
  {
    id: 'text-paragraph',
    name: 'Đoạn văn',
    group: 'typography',
    tags: ['p', 'paragraph', 'đoạn văn', 'text'],
    description: 'Đoạn văn bản có khoảng cách dòng thoải mái.',
    html: `<p style="margin:0 0 16px; font-size:16px; line-height:1.7; color:#475569; ${FONT}">Đây là đoạn văn bản mẫu. Bạn có thể thay nội dung trực tiếp trên Canvas hoặc trong tab Thuộc tính.</p>`,
  },
  {
    id: 'text-lead',
    name: 'Đoạn mở đầu',
    group: 'typography',
    tags: ['lead', 'sapo', 'mở đầu'],
    description: 'Đoạn mở đầu cỡ lớn, màu dịu.',
    html: `<p style="margin:0 0 20px; font-size:20px; line-height:1.6; color:#475569; ${FONT}">Một đoạn mở đầu ngắn gọn, giúp người đọc nắm được nội dung chính.</p>`,
  },
  {
    id: 'text-small',
    name: 'Chữ nhỏ',
    group: 'typography',
    tags: ['small', 'caption', 'chú thích'],
    description: 'Chú thích hoặc metadata cỡ nhỏ.',
    html: `<p style="margin:0; font-size:13px; line-height:1.5; color:#94a3b8; ${FONT}">Cập nhật lúc 14:30 · 6 phút đọc</p>`,
  },
  {
    id: 'text-blockquote',
    name: 'Trích dẫn',
    group: 'typography',
    tags: ['blockquote', 'quote', 'trích dẫn'],
    description: 'Khối trích dẫn có viền nhấn.',
    html: `<blockquote style="margin:0; padding:16px 20px; border-left:4px solid #6d5df5; background:#f8fafc; border-radius:0 10px 10px 0; ${FONT}">
  <p style="margin:0 0 8px; font-size:17px; line-height:1.65; color:#334155; font-style:italic;">“Thiết kế không chỉ là giao diện, mà là cách sản phẩm nói chuyện với người dùng.”</p>
  <cite style="font-size:13px; color:#64748b; font-style:normal;">— Tác giả</cite>
</blockquote>`,
  },
  {
    id: 'text-list',
    name: 'Danh sách',
    group: 'typography',
    tags: ['list', 'ul', 'ol', 'danh sách'],
    description: 'Danh sách có dấu đầu dòng.',
    html: `<ul style="margin:0; padding-left:22px; ${FONT}">
  <li style="margin-bottom:8px; font-size:15px; line-height:1.6; color:#475569;">Mục thứ nhất</li>
  <li style="margin-bottom:8px; font-size:15px; line-height:1.6; color:#475569;">Mục thứ hai</li>
  <li style="font-size:15px; line-height:1.6; color:#475569;">Mục thứ ba</li>
</ul>`,
  },

  /* ───────────── ĐIỀU HƯỚNG ───────────── */
  {
    id: 'nav-link',
    name: 'Liên kết',
    group: 'navigation',
    tags: ['link', 'a', 'liên kết'],
    description: 'Đường dẫn văn bản có gạch chân khi hover.',
    html: `<a href="#" style="color:#6d5df5; font-size:15px; font-weight:500; text-decoration:none; ${FONT}">Xem thêm →</a>`,
  },
  {
    id: 'nav-navbar',
    name: 'Navbar',
    group: 'navigation',
    tags: ['navbar', 'header', 'menu', 'thanh điều hướng'],
    description: 'Thanh điều hướng trên cùng với logo và menu.',
    container: true,
    html: `<header style="display:flex; align-items:center; justify-content:space-between; gap:24px; padding:14px 24px; background:#ffffff; border-bottom:1px solid #e2e8f0; ${FONT}">
  <a href="#" style="font-size:18px; font-weight:750; color:#0f172a; text-decoration:none;">PixelMind</a>
  <nav style="display:flex; align-items:center; gap:20px;">
    <a href="#" style="font-size:14px; font-weight:500; color:#475569; text-decoration:none;">Trang chủ</a>
    <a href="#" style="font-size:14px; font-weight:500; color:#475569; text-decoration:none;">Tính năng</a>
    <a href="#" style="font-size:14px; font-weight:500; color:#475569; text-decoration:none;">Bảng giá</a>
  </nav>
  <a href="#" style="padding:9px 16px; border-radius:9px; background:#6d5df5; color:#ffffff; font-size:14px; font-weight:600; text-decoration:none;">Bắt đầu</a>
</header>`,
  },
  {
    id: 'nav-menu',
    name: 'Menu dọc',
    group: 'navigation',
    tags: ['menu', 'sidebar', 'nav', 'dọc'],
    description: 'Danh sách menu dọc cho sidebar.',
    container: true,
    html: `<nav style="display:flex; flex-direction:column; gap:4px; width:220px; ${FONT}">
  <a href="#" style="padding:10px 12px; border-radius:8px; background:#eef2ff; color:#4338ca; font-size:14px; font-weight:600; text-decoration:none;">Tổng quan</a>
  <a href="#" style="padding:10px 12px; border-radius:8px; color:#475569; font-size:14px; text-decoration:none;">Dự án</a>
  <a href="#" style="padding:10px 12px; border-radius:8px; color:#475569; font-size:14px; text-decoration:none;">Thành viên</a>
  <a href="#" style="padding:10px 12px; border-radius:8px; color:#475569; font-size:14px; text-decoration:none;">Cài đặt</a>
</nav>`,
  },
  {
    id: 'nav-breadcrumb',
    name: 'Breadcrumb',
    group: 'navigation',
    tags: ['breadcrumb', 'đường dẫn', 'điều hướng'],
    description: 'Chuỗi đường dẫn phân cấp.',
    html: `<nav aria-label="Breadcrumb" style="display:flex; align-items:center; gap:8px; font-size:14px; ${FONT}">
  <a href="#" style="color:#64748b; text-decoration:none;">Trang chủ</a>
  <span style="color:#cbd5e1;">/</span>
  <a href="#" style="color:#64748b; text-decoration:none;">Dự án</a>
  <span style="color:#cbd5e1;">/</span>
  <span style="color:#0f172a; font-weight:600;">Chi tiết</span>
</nav>`,
  },
  {
    id: 'nav-tabs',
    name: 'Tabs',
    group: 'navigation',
    tags: ['tabs', 'tab', 'chuyển tab'],
    description: 'Thanh tab với trạng thái đang chọn.',
    container: true,
    html: `<div style="display:flex; gap:4px; border-bottom:1px solid #e2e8f0; ${FONT}">
  <button type="button" style="padding:10px 16px; border:0; border-bottom:2px solid #6d5df5; background:transparent; color:#4338ca; font-size:14px; font-weight:600; cursor:pointer;">Tổng quan</button>
  <button type="button" style="padding:10px 16px; border:0; border-bottom:2px solid transparent; background:transparent; color:#64748b; font-size:14px; font-weight:500; cursor:pointer;">Hoạt động</button>
  <button type="button" style="padding:10px 16px; border:0; border-bottom:2px solid transparent; background:transparent; color:#64748b; font-size:14px; font-weight:500; cursor:pointer;">Cài đặt</button>
</div>`,
  },
  {
    id: 'nav-pagination',
    name: 'Phân trang',
    group: 'navigation',
    tags: ['pagination', 'phân trang', 'page'],
    description: 'Dãy nút chuyển trang.',
    html: `<nav aria-label="Phân trang" style="display:flex; align-items:center; gap:6px; ${FONT}">
  <button type="button" style="width:34px; height:34px; border:1px solid #e2e8f0; border-radius:8px; background:#ffffff; color:#64748b; cursor:pointer;">‹</button>
  <button type="button" style="width:34px; height:34px; border:1px solid #6d5df5; border-radius:8px; background:#6d5df5; color:#ffffff; font-weight:600; cursor:pointer;">1</button>
  <button type="button" style="width:34px; height:34px; border:1px solid #e2e8f0; border-radius:8px; background:#ffffff; color:#334155; cursor:pointer;">2</button>
  <button type="button" style="width:34px; height:34px; border:1px solid #e2e8f0; border-radius:8px; background:#ffffff; color:#334155; cursor:pointer;">3</button>
  <button type="button" style="width:34px; height:34px; border:1px solid #e2e8f0; border-radius:8px; background:#ffffff; color:#64748b; cursor:pointer;">›</button>
</nav>`,
  },

  /* ───────────── NÚT ───────────── */
  {
    id: 'btn-primary',
    name: 'Nút chính',
    group: 'buttons',
    tags: ['button', 'primary', 'cta', 'nút'],
    description: 'Nút hành động chính, nền màu nhấn.',
    html: `<button type="button" style="display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:11px 20px; border:0; border-radius:10px; background:#6d5df5; color:#ffffff; font-size:14px; font-weight:650; cursor:pointer; box-shadow:0 6px 16px rgba(109,93,245,0.28); ${FONT}">Bắt đầu ngay</button>`,
  },
  {
    id: 'btn-secondary',
    name: 'Nút phụ',
    group: 'buttons',
    tags: ['button', 'secondary', 'nút'],
    description: 'Nút phụ nền xám nhẹ.',
    html: `<button type="button" style="display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:11px 20px; border:1px solid #e2e8f0; border-radius:10px; background:#f8fafc; color:#334155; font-size:14px; font-weight:600; cursor:pointer; ${FONT}">Tìm hiểu thêm</button>`,
  },
  {
    id: 'btn-outline',
    name: 'Nút viền',
    group: 'buttons',
    tags: ['button', 'outline', 'viền', 'nút'],
    description: 'Nút chỉ có viền, nền trong suốt.',
    html: `<button type="button" style="display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:11px 20px; border:1px solid #6d5df5; border-radius:10px; background:transparent; color:#6d5df5; font-size:14px; font-weight:650; cursor:pointer; ${FONT}">Xem demo</button>`,
  },
  {
    id: 'btn-ghost',
    name: 'Nút ghost',
    group: 'buttons',
    tags: ['button', 'ghost', 'nút'],
    description: 'Nút không viền, chỉ đổi nền khi hover.',
    html: `<button type="button" style="display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:10px 16px; border:0; border-radius:9px; background:transparent; color:#475569; font-size:14px; font-weight:550; cursor:pointer; ${FONT}">Bỏ qua</button>`,
  },
  {
    id: 'btn-icon',
    name: 'Nút icon',
    group: 'buttons',
    tags: ['button', 'icon', 'nút'],
    description: 'Nút vuông chỉ chứa icon.',
    html: `<button type="button" aria-label="Thêm" style="display:inline-flex; align-items:center; justify-content:center; width:38px; height:38px; border:1px solid #e2e8f0; border-radius:10px; background:#ffffff; color:#475569; cursor:pointer;">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
</button>`,
  },
  {
    id: 'btn-group',
    name: 'Nhóm nút',
    group: 'buttons',
    tags: ['button', 'group', 'nhóm'],
    description: 'Các nút liên kết thành một dải.',
    html: `<div style="display:inline-flex; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; ${FONT}">
  <button type="button" style="padding:10px 16px; border:0; background:#6d5df5; color:#ffffff; font-size:14px; font-weight:600; cursor:pointer;">Ngày</button>
  <button type="button" style="padding:10px 16px; border:0; border-left:1px solid #e2e8f0; background:#ffffff; color:#475569; font-size:14px; cursor:pointer;">Tuần</button>
  <button type="button" style="padding:10px 16px; border:0; border-left:1px solid #e2e8f0; background:#ffffff; color:#475569; font-size:14px; cursor:pointer;">Tháng</button>
</div>`,
  },

  /* ───────────── BIỂU MẪU ───────────── */
  {
    id: 'form-field',
    name: 'Nhóm trường nhập',
    group: 'forms',
    tags: ['field', 'label', 'input', 'form'],
    description: 'Label + ô nhập + gợi ý, chuẩn form.',
    container: true,
    html: `<div style="display:flex; flex-direction:column; gap:6px; ${FONT}">
  <label for="pm-field-1" style="font-size:13px; font-weight:600; color:#334155;">Email</label>
  <input id="pm-field-1" type="email" placeholder="ban@congty.vn" style="width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid #e2e8f0; border-radius:9px; background:#ffffff; color:#0f172a; font-size:14px; outline:none;" />
  <span style="font-size:12px; color:#94a3b8;">Chúng tôi sẽ không chia sẻ email của bạn.</span>
</div>`,
  },
  {
    id: 'form-input',
    name: 'Ô nhập văn bản',
    group: 'forms',
    tags: ['input', 'text', 'ô nhập'],
    description: 'Ô nhập một dòng.',
    html: `<input type="text" placeholder="Nhập nội dung…" style="width:100%; box-sizing:border-box; padding:11px 14px; border:1px solid #e2e8f0; border-radius:10px; background:#ffffff; color:#0f172a; font-size:14px; outline:none; ${FONT}" />`,
  },
  {
    id: 'form-textarea',
    name: 'Vùng văn bản',
    group: 'forms',
    tags: ['textarea', 'nội dung', 'form'],
    description: 'Ô nhập nhiều dòng.',
    html: `<textarea rows="4" placeholder="Nhập mô tả chi tiết…" style="width:100%; box-sizing:border-box; padding:12px 14px; border:1px solid #e2e8f0; border-radius:10px; background:#ffffff; color:#0f172a; font-size:14px; line-height:1.6; resize:vertical; outline:none; ${FONT}"></textarea>`,
  },
  {
    id: 'form-select',
    name: 'Ô chọn',
    group: 'forms',
    tags: ['select', 'dropdown', 'chọn'],
    description: 'Danh sách lựa chọn một giá trị.',
    html: `<select style="width:100%; box-sizing:border-box; padding:11px 14px; border:1px solid #e2e8f0; border-radius:10px; background:#ffffff; color:#0f172a; font-size:14px; outline:none; ${FONT}">
  <option>Chọn một mục</option>
  <option>Lựa chọn 1</option>
  <option>Lựa chọn 2</option>
  <option>Lựa chọn 3</option>
</select>`,
  },
  {
    id: 'form-checkbox',
    name: 'Checkbox',
    group: 'forms',
    tags: ['checkbox', 'chọn', 'tick'],
    description: 'Ô đánh dấu kèm nhãn.',
    html: `<label style="display:inline-flex; align-items:center; gap:10px; cursor:pointer; ${FONT}">
  <input type="checkbox" checked style="width:17px; height:17px; accent-color:#6d5df5; cursor:pointer;" />
  <span style="font-size:14px; color:#334155;">Tôi đồng ý với điều khoản sử dụng</span>
</label>`,
  },
  {
    id: 'form-radio',
    name: 'Nhóm radio',
    group: 'forms',
    tags: ['radio', 'chọn', 'nhóm'],
    description: 'Các lựa chọn loại trừ lẫn nhau.',
    html: `<div style="display:flex; flex-direction:column; gap:10px; ${FONT}">
  <label style="display:inline-flex; align-items:center; gap:10px; cursor:pointer;">
    <input type="radio" name="pm-radio" checked style="width:16px; height:16px; accent-color:#6d5df5; cursor:pointer;" />
    <span style="font-size:14px; color:#334155;">Gói Cơ bản</span>
  </label>
  <label style="display:inline-flex; align-items:center; gap:10px; cursor:pointer;">
    <input type="radio" name="pm-radio" style="width:16px; height:16px; accent-color:#6d5df5; cursor:pointer;" />
    <span style="font-size:14px; color:#334155;">Gói Chuyên nghiệp</span>
  </label>
</div>`,
  },
  {
    id: 'form-switch',
    name: 'Công tắc',
    group: 'forms',
    tags: ['switch', 'toggle', 'công tắc'],
    description: 'Công tắc bật/tắt dạng pill.',
    html: `<label style="display:inline-flex; align-items:center; gap:10px; cursor:pointer; ${FONT}">
  <span style="position:relative; display:inline-block; width:42px; height:24px;">
    <input type="checkbox" checked style="opacity:0; width:0; height:0;" />
    <span style="position:absolute; inset:0; border-radius:999px; background:#6d5df5; transition:background 150ms;">
      <span style="position:absolute; top:3px; left:21px; width:18px; height:18px; border-radius:50%; background:#ffffff; box-shadow:0 1px 3px rgba(15,23,42,0.25);"></span>
    </span>
  </span>
  <span style="font-size:14px; color:#334155;">Nhận thông báo qua email</span>
</label>`,
  },
  {
    id: 'form-search',
    name: 'Ô tìm kiếm',
    group: 'forms',
    tags: ['search', 'tìm kiếm', 'input'],
    description: 'Ô tìm kiếm có icon kính lúp.',
    html: `<div style="position:relative; width:100%; max-width:380px; ${FONT}">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" style="position:absolute; left:13px; top:50%; transform:translateY(-50%); pointer-events:none;"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>
  <input type="search" placeholder="Tìm kiếm…" style="width:100%; box-sizing:border-box; padding:11px 14px 11px 38px; border:1px solid #e2e8f0; border-radius:10px; background:#ffffff; color:#0f172a; font-size:14px; outline:none;" />
</div>`,
  },

  /* ───────────── DỮ LIỆU ───────────── */
  {
    id: 'data-card',
    name: 'Card cơ bản',
    group: 'data',
    tags: ['card', 'thẻ', 'khối'],
    description: 'Thẻ nội dung có viền và bóng nhẹ.',
    container: true,
    html: `<div style="padding:22px; background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; box-shadow:0 4px 14px rgba(15,23,42,0.05); ${FONT}">
  <h3 style="margin:0 0 8px; font-size:18px; font-weight:650; color:#0f172a;">Tiêu đề thẻ</h3>
  <p style="margin:0; font-size:14px; line-height:1.65; color:#64748b;">Mô tả ngắn cho nội dung của thẻ này.</p>
</div>`,
  },
  {
    id: 'data-card-media',
    name: 'Card có ảnh',
    group: 'data',
    tags: ['card', 'media', 'image', 'ảnh'],
    description: 'Thẻ có ảnh bìa phía trên.',
    container: true,
    html: `<article style="overflow:hidden; background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; box-shadow:0 4px 14px rgba(15,23,42,0.05); ${FONT}">
  <div style="height:160px; background:linear-gradient(135deg,#c7d2fe,#a5b4fc);"></div>
  <div style="padding:20px;">
    <h3 style="margin:0 0 8px; font-size:18px; font-weight:650; color:#0f172a;">Tiêu đề bài viết</h3>
    <p style="margin:0; font-size:14px; line-height:1.65; color:#64748b;">Tóm tắt ngắn gọn nội dung bài viết.</p>
  </div>
</article>`,
  },
  {
    id: 'data-card-stat',
    name: 'Card số liệu',
    group: 'data',
    tags: ['stat', 'kpi', 'số liệu', 'card'],
    description: 'Thẻ hiển thị một chỉ số nổi bật.',
    container: true,
    html: `<div style="padding:20px 22px; background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; ${FONT}">
  <div style="font-size:12px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#94a3b8;">Doanh thu tháng</div>
  <div style="margin-top:8px; font-size:32px; font-weight:800; letter-spacing:-0.02em; color:#0f172a;">₫ 128,4tr</div>
  <div style="margin-top:6px; font-size:13px; color:#10b981; font-weight:600;">▲ 12,5% so với tháng trước</div>
</div>`,
  },
  {
    id: 'data-table',
    name: 'Bảng dữ liệu',
    group: 'data',
    tags: ['table', 'bảng', 'dữ liệu'],
    description: 'Bảng có tiêu đề và các dòng dữ liệu.',
    container: true,
    html: `<div style="overflow:auto; border:1px solid #e2e8f0; border-radius:12px; ${FONT}">
  <table style="width:100%; border-collapse:collapse; font-size:14px;">
    <thead>
      <tr style="background:#f8fafc;">
        <th style="padding:12px 16px; text-align:left; font-weight:600; color:#475569; border-bottom:1px solid #e2e8f0;">Tên</th>
        <th style="padding:12px 16px; text-align:left; font-weight:600; color:#475569; border-bottom:1px solid #e2e8f0;">Trạng thái</th>
        <th style="padding:12px 16px; text-align:right; font-weight:600; color:#475569; border-bottom:1px solid #e2e8f0;">Giá trị</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding:12px 16px; color:#0f172a; border-bottom:1px solid #f1f5f9;">Dự án Alpha</td>
        <td style="padding:12px 16px; border-bottom:1px solid #f1f5f9;"><span style="display:inline-block; padding:3px 9px; border-radius:999px; background:#dcfce7; color:#15803d; font-size:12px; font-weight:600;">Hoàn tất</span></td>
        <td style="padding:12px 16px; text-align:right; color:#334155; border-bottom:1px solid #f1f5f9;">₫ 24.000.000</td>
      </tr>
      <tr>
        <td style="padding:12px 16px; color:#0f172a;">Dự án Beta</td>
        <td style="padding:12px 16px;"><span style="display:inline-block; padding:3px 9px; border-radius:999px; background:#fef3c7; color:#b45309; font-size:12px; font-weight:600;">Đang chạy</span></td>
        <td style="padding:12px 16px; text-align:right; color:#334155;">₫ 8.500.000</td>
      </tr>
    </tbody>
  </table>
</div>`,
  },
  {
    id: 'data-pricing',
    name: 'Bảng giá',
    group: 'data',
    tags: ['pricing', 'bảng giá', 'gói', 'plan'],
    description: 'Gói giá nổi bật kèm danh sách quyền lợi.',
    container: true,
    html: `<div style="width:100%; max-width:340px; padding:26px; background:#ffffff; border:2px solid #6d5df5; border-radius:18px; box-shadow:0 16px 40px rgba(109,93,245,0.16); ${FONT}">
  <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
    <span style="font-size:13px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#6d5df5;">Chuyên nghiệp</span>
    <span style="padding:3px 9px; border-radius:999px; background:#eef2ff; color:#4338ca; font-size:11px; font-weight:700;">Phổ biến</span>
  </div>
  <div style="margin-top:14px; font-size:40px; font-weight:800; letter-spacing:-0.03em; color:#0f172a;">₫299k<span style="font-size:14px; font-weight:500; color:#94a3b8;">/tháng</span></div>
  <p style="margin:8px 0 18px; font-size:14px; line-height:1.6; color:#64748b;">Dành cho nhóm thiết kế và phát triển sản phẩm.</p>
  <ul style="margin:0 0 20px; padding:0; list-style:none; display:flex; flex-direction:column; gap:9px;">
    <li style="font-size:14px; color:#334155;">✓ Không giới hạn dự án</li>
    <li style="font-size:14px; color:#334155;">✓ Cộng tác nhóm 10 người</li>
    <li style="font-size:14px; color:#334155;">✓ Xuất mã HTML / React</li>
  </ul>
  <button type="button" style="width:100%; padding:12px 16px; border:0; border-radius:10px; background:#6d5df5; color:#ffffff; font-size:14px; font-weight:650; cursor:pointer;">Chọn gói này</button>
</div>`,
  },
  {
    id: 'data-badge',
    name: 'Badge',
    group: 'data',
    tags: ['badge', 'nhãn', 'trạng thái'],
    description: 'Nhãn trạng thái nhỏ gọn.',
    html: `<span style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; background:#dcfce7; color:#15803d; font-size:12px; font-weight:650; ${FONT}">
  <span style="width:6px; height:6px; border-radius:50%; background:#22c55e;"></span>
  Đang hoạt động
</span>`,
  },
  {
    id: 'data-avatar',
    name: 'Avatar',
    group: 'data',
    tags: ['avatar', 'ảnh đại diện', 'user'],
    description: 'Ảnh đại diện tròn có viền.',
    html: `<div style="display:inline-flex; align-items:center; gap:12px; ${FONT}">
  <span style="width:44px; height:44px; border-radius:50%; background:linear-gradient(135deg,#6d5df5,#38bdf8); display:grid; place-items:center; color:#ffffff; font-size:15px; font-weight:700; box-shadow:0 0 0 3px #ffffff, 0 0 0 4px #e2e8f0;">KT</span>
  <span>
    <span style="display:block; font-size:14px; font-weight:600; color:#0f172a;">Kỳ Thủ</span>
    <span style="display:block; font-size:12.5px; color:#94a3b8;">Quản trị viên</span>
  </span>
</div>`,
  },
  {
    id: 'data-avatar-stack',
    name: 'Chồng avatar',
    group: 'data',
    tags: ['avatar', 'stack', 'nhóm', 'chồng'],
    description: 'Nhiều avatar xếp chồng.',
    html: `<div style="display:flex; align-items:center; ${FONT}">
  <span style="width:36px; height:36px; border-radius:50%; background:#6d5df5; color:#ffffff; display:grid; place-items:center; font-size:13px; font-weight:700; border:2px solid #ffffff; margin-left:0;">A</span>
  <span style="width:36px; height:36px; border-radius:50%; background:#0ea5e9; color:#ffffff; display:grid; place-items:center; font-size:13px; font-weight:700; border:2px solid #ffffff; margin-left:-10px;">B</span>
  <span style="width:36px; height:36px; border-radius:50%; background:#10b981; color:#ffffff; display:grid; place-items:center; font-size:13px; font-weight:700; border:2px solid #ffffff; margin-left:-10px;">C</span>
  <span style="width:36px; height:36px; border-radius:50%; background:#f1f5f9; color:#475569; display:grid; place-items:center; font-size:12px; font-weight:700; border:2px solid #ffffff; margin-left:-10px;">+8</span>
</div>`,
  },
  {
    id: 'data-progress',
    name: 'Thanh tiến trình',
    group: 'data',
    tags: ['progress', 'tiến trình', 'bar'],
    description: 'Thanh tiến trình có nhãn phần trăm.',
    html: `<div style="${FONT}">
  <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
    <span style="font-size:13px; font-weight:600; color:#334155;">Hoàn thiện hồ sơ</span>
    <span style="font-size:13px; font-weight:600; color:#6d5df5;">72%</span>
  </div>
  <div style="height:9px; border-radius:999px; background:#e2e8f0; overflow:hidden;">
    <div style="width:72%; height:100%; border-radius:999px; background:linear-gradient(90deg,#6d5df5,#38bdf8);"></div>
  </div>
</div>`,
  },
  {
    id: 'data-accordion',
    name: 'Accordion / FAQ',
    group: 'data',
    tags: ['accordion', 'faq', 'mở rộng', 'thu gọn'],
    description: 'Mục hỏi đáp mở/đóng không cần JS.',
    container: true,
    html: `<div style="border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; ${FONT}">
  <details open style="border-bottom:1px solid #e2e8f0;">
    <summary style="padding:14px 18px; cursor:pointer; font-size:14px; font-weight:600; color:#0f172a;">PixelMind hỗ trợ những framework nào?</summary>
    <p style="margin:0; padding:0 18px 16px; font-size:14px; line-height:1.65; color:#64748b;">Hỗ trợ HTML, Razor, React, Vue, Svelte, Angular, PHP và nhiều loại dự án web khác.</p>
  </details>
  <details>
    <summary style="padding:14px 18px; cursor:pointer; font-size:14px; font-weight:600; color:#0f172a;">Tôi có thể hoàn tác thay đổi không?</summary>
    <p style="margin:0; padding:0 18px 16px; font-size:14px; line-height:1.65; color:#64748b;">Có. Mọi thao tác đều được lưu vào bộ đệm và hoàn tác bằng Ctrl+Z.</p>
  </details>
</div>`,
  },

  /* ───────────── PHẢN HỒI ───────────── */
  {
    id: 'feedback-alert',
    name: 'Alert',
    group: 'feedback',
    tags: ['alert', 'thông báo', 'cảnh báo'],
    description: 'Khối thông báo thành công.',
    container: true,
    html: `<div role="alert" style="display:flex; gap:12px; padding:14px 16px; border:1px solid #bbf7d0; border-radius:12px; background:#f0fdf4; ${FONT}">
  <span style="width:22px; height:22px; flex:none; border-radius:50%; background:#22c55e; color:#ffffff; display:grid; place-items:center; font-size:13px; font-weight:700;">✓</span>
  <div>
    <div style="font-size:14px; font-weight:650; color:#166534;">Lưu thành công</div>
    <div style="margin-top:3px; font-size:13px; line-height:1.55; color:#15803d;">Thay đổi của bạn đã được ghi vào mã nguồn dự án.</div>
  </div>
</div>`,
  },
  {
    id: 'feedback-toast',
    name: 'Toast',
    group: 'feedback',
    tags: ['toast', 'snackbar', 'thông báo'],
    description: 'Thông báo nổi góc dưới bên phải.',
    html: `<div role="status" style="display:inline-flex; align-items:center; gap:12px; padding:12px 16px; border-radius:12px; background:#0f172a; color:#f8fafc; box-shadow:0 12px 30px rgba(15,23,42,0.25); ${FONT}">
  <span style="width:20px; height:20px; border-radius:50%; background:#22c55e; color:#ffffff; display:grid; place-items:center; font-size:12px; font-weight:700;">✓</span>
  <span style="font-size:13.5px; font-weight:500;">Đã sao chép vào bộ nhớ tạm</span>
  <button type="button" aria-label="Đóng" style="border:0; background:transparent; color:#94a3b8; font-size:16px; cursor:pointer;">×</button>
</div>`,
  },
  {
    id: 'feedback-modal',
    name: 'Modal',
    group: 'feedback',
    tags: ['modal', 'dialog', 'hộp thoại'],
    description: 'Hộp thoại xác nhận có nút hành động.',
    container: true,
    html: `<div style="width:100%; max-width:460px; padding:24px; background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; box-shadow:0 24px 60px rgba(15,23,42,0.18); ${FONT}">
  <h3 style="margin:0 0 8px; font-size:19px; font-weight:700; color:#0f172a;">Xoá dự án này?</h3>
  <p style="margin:0 0 20px; font-size:14px; line-height:1.65; color:#64748b;">Hành động này không thể hoàn tác. Toàn bộ dữ liệu của dự án sẽ bị xoá khỏi danh sách.</p>
  <div style="display:flex; justify-content:flex-end; gap:10px;">
    <button type="button" style="padding:10px 16px; border:1px solid #e2e8f0; border-radius:9px; background:#ffffff; color:#334155; font-size:14px; font-weight:600; cursor:pointer;">Huỷ</button>
    <button type="button" style="padding:10px 16px; border:0; border-radius:9px; background:#ef4444; color:#ffffff; font-size:14px; font-weight:650; cursor:pointer;">Xoá dự án</button>
  </div>
</div>`,
  },
  {
    id: 'feedback-empty',
    name: 'Trạng thái rỗng',
    group: 'feedback',
    tags: ['empty', 'rỗng', 'chưa có dữ liệu'],
    description: 'Khối trạng thái chưa có nội dung.',
    container: true,
    html: `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:48px 24px; border:1px dashed #cbd5e1; border-radius:14px; background:#f8fafc; text-align:center; ${FONT}">
  <span style="width:48px; height:48px; border-radius:14px; background:#eef2ff; color:#6d5df5; display:grid; place-items:center;">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 7h18M3 12h18M3 17h18"/></svg>
  </span>
  <h3 style="margin:4px 0 0; font-size:16px; font-weight:650; color:#0f172a;">Chưa có dự án nào</h3>
  <p style="margin:0; max-width:320px; font-size:13.5px; line-height:1.6; color:#64748b;">Bắt đầu bằng cách tạo dự án mới hoặc mở thư mục mã nguồn có sẵn.</p>
  <button type="button" style="margin-top:6px; padding:9px 16px; border:0; border-radius:9px; background:#6d5df5; color:#ffffff; font-size:13.5px; font-weight:650; cursor:pointer;">Tạo dự án</button>
</div>`,
  },
  {
    id: 'feedback-spinner',
    name: 'Đang tải',
    group: 'feedback',
    tags: ['loading', 'spinner', 'tải'],
    description: 'Vòng xoay chờ xử lý.',
    html: `<div style="display:inline-flex; align-items:center; gap:10px; ${FONT}">
  <span style="width:20px; height:20px; border:2.5px solid #e2e8f0; border-top-color:#6d5df5; border-radius:50%; display:inline-block; animation:pm-toolbox-spin 700ms linear infinite;"></span>
  <span style="font-size:13.5px; color:#64748b;">Đang tải dữ liệu…</span>
</div>
<style data-pm-toolbox>@keyframes pm-toolbox-spin{to{transform:rotate(360deg)}}</style>`,
  },
  {
    id: 'feedback-404',
    name: 'Trang 404',
    group: 'feedback',
    tags: ['404', 'không tìm thấy', 'error'],
    description: 'Khối báo trang không tồn tại.',
    container: true,
    html: `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:64px 24px; text-align:center; ${FONT}">
  <div style="font-size:88px; line-height:1; font-weight:900; letter-spacing:-0.05em; background:linear-gradient(135deg,#6d5df5,#38bdf8); -webkit-background-clip:text; background-clip:text; color:transparent;">404</div>
  <h2 style="margin:8px 0 0; font-size:22px; font-weight:700; color:#0f172a;">Không tìm thấy trang</h2>
  <p style="margin:0; max-width:360px; font-size:14px; line-height:1.65; color:#64748b;">Đường dẫn bạn truy cập không tồn tại hoặc đã bị di chuyển.</p>
  <a href="#" style="margin-top:8px; padding:10px 18px; border-radius:9px; background:#6d5df5; color:#ffffff; font-size:14px; font-weight:600; text-decoration:none;">Về trang chủ</a>
</div>`,
  },

  /* ───────────── MARKETING ───────────── */
  {
    id: 'mkt-hero',
    name: 'Hero căn giữa',
    group: 'marketing',
    tags: ['hero', 'banner', 'landing', 'đầu trang'],
    description: 'Khối hero lớn với tiêu đề và CTA.',
    container: true,
    html: `<section style="padding:88px 24px; background:linear-gradient(180deg,#f8fafc 0%,#ffffff 100%); text-align:center; ${FONT}">
  <div style="max-width:760px; margin:0 auto;">
    <span style="display:inline-block; padding:5px 12px; border-radius:999px; background:#eef2ff; color:#4338ca; font-size:12px; font-weight:700; letter-spacing:0.04em;">MỚI · PHIÊN BẢN 2.0</span>
    <h1 style="margin:18px 0 14px; font-size:52px; line-height:1.1; font-weight:850; letter-spacing:-0.03em; color:#0f172a;">Thiết kế giao diện nhanh gấp 10 lần</h1>
    <p style="margin:0 auto 26px; max-width:560px; font-size:17px; line-height:1.7; color:#64748b;">Kéo thả linh kiện, chỉnh sửa trực tiếp trên canvas và đồng bộ mã nguồn thật chỉ với một cú bấm.</p>
    <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
      <a href="#" style="padding:13px 24px; border-radius:11px; background:#6d5df5; color:#ffffff; font-size:15px; font-weight:650; text-decoration:none; box-shadow:0 10px 24px rgba(109,93,245,0.3);">Dùng thử miễn phí</a>
      <a href="#" style="padding:13px 24px; border-radius:11px; border:1px solid #e2e8f0; background:#ffffff; color:#334155; font-size:15px; font-weight:600; text-decoration:none;">Xem demo</a>
    </div>
  </div>
</section>`,
  },
  {
    id: 'mkt-features',
    name: 'Lưới tính năng',
    group: 'marketing',
    tags: ['features', 'tính năng', 'grid', 'landing'],
    description: 'Ba thẻ tính năng có icon.',
    container: true,
    html: `<section style="padding:64px 24px; background:#ffffff; ${FONT}">
  <div style="max-width:1100px; margin:0 auto;">
    <h2 style="margin:0 0 10px; font-size:34px; font-weight:750; letter-spacing:-0.02em; color:#0f172a; text-align:center;">Mọi thứ bạn cần để thiết kế</h2>
    <p style="margin:0 auto 36px; max-width:520px; text-align:center; font-size:15px; line-height:1.65; color:#64748b;">Bộ công cụ đầy đủ cho quy trình thiết kế và phát triển sản phẩm.</p>
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:20px;">
      <div style="padding:24px; border:1px solid #e2e8f0; border-radius:14px; background:#f8fafc;">
        <span style="width:42px; height:42px; border-radius:12px; background:#eef2ff; color:#6d5df5; display:grid; place-items:center; font-size:18px;">⚡</span>
        <h3 style="margin:14px 0 6px; font-size:17px; font-weight:650; color:#0f172a;">Kéo thả tức thì</h3>
        <p style="margin:0; font-size:13.5px; line-height:1.65; color:#64748b;">Thêm phần tử vào trang chỉ bằng một thao tác kéo thả.</p>
      </div>
      <div style="padding:24px; border:1px solid #e2e8f0; border-radius:14px; background:#f8fafc;">
        <span style="width:42px; height:42px; border-radius:12px; background:#ecfeff; color:#0891b2; display:grid; place-items:center; font-size:18px;">◈</span>
        <h3 style="margin:14px 0 6px; font-size:17px; font-weight:650; color:#0f172a;">Đồng bộ mã nguồn</h3>
        <p style="margin:0; font-size:13.5px; line-height:1.65; color:#64748b;">Mọi thay đổi được ghi thẳng vào file dự án.</p>
      </div>
      <div style="padding:24px; border:1px solid #e2e8f0; border-radius:14px; background:#f8fafc;">
        <span style="width:42px; height:42px; border-radius:12px; background:#ecfdf5; color:#059669; display:grid; place-items:center; font-size:18px;">✓</span>
        <h3 style="margin:14px 0 6px; font-size:17px; font-weight:650; color:#0f172a;">Hoàn tác an toàn</h3>
        <p style="margin:0; font-size:13.5px; line-height:1.65; color:#64748b;">Ctrl+Z khôi phục cả giao diện lẫn mã nguồn.</p>
      </div>
    </div>
  </div>
</section>`,
  },
  {
    id: 'mkt-cta',
    name: 'Dải CTA',
    group: 'marketing',
    tags: ['cta', 'call to action', 'kêu gọi'],
    description: 'Dải kêu gọi hành động nổi bật.',
    container: true,
    html: `<section style="padding:48px 24px; ${FONT}">
  <div style="max-width:1000px; margin:0 auto; display:flex; align-items:center; justify-content:space-between; gap:24px; flex-wrap:wrap; padding:34px 38px; border-radius:20px; background:linear-gradient(135deg,#6d5df5,#4f46e5); color:#ffffff;">
    <div>
      <h2 style="margin:0 0 6px; font-size:26px; font-weight:750; letter-spacing:-0.02em;">Sẵn sàng bắt đầu dự án mới?</h2>
      <p style="margin:0; font-size:14.5px; opacity:0.85;">Tạo tài khoản miễn phí, không cần thẻ tín dụng.</p>
    </div>
    <a href="#" style="padding:12px 22px; border-radius:10px; background:#ffffff; color:#4338ca; font-size:14.5px; font-weight:700; text-decoration:none; white-space:nowrap;">Bắt đầu ngay →</a>
  </div>
</section>`,
  },
  {
    id: 'mkt-testimonials',
    name: 'Đánh giá khách hàng',
    group: 'marketing',
    tags: ['testimonial', 'review', 'đánh giá'],
    description: 'Thẻ trích dẫn từ khách hàng.',
    container: true,
    html: `<section style="padding:56px 24px; background:#f8fafc; ${FONT}">
  <div style="max-width:900px; margin:0 auto; display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:20px;">
    <figure style="margin:0; padding:24px; background:#ffffff; border:1px solid #e2e8f0; border-radius:14px;">
      <div style="color:#f59e0b; font-size:15px; letter-spacing:2px;">★★★★★</div>
      <blockquote style="margin:12px 0 16px; font-size:14.5px; line-height:1.7; color:#334155;">“PixelMind giúp nhóm mình rút ngắn thời gian dựng giao diện từ 3 ngày xuống còn vài giờ.”</blockquote>
      <figcaption style="display:flex; align-items:center; gap:10px;">
        <span style="width:36px; height:36px; border-radius:50%; background:#6d5df5; color:#fff; display:grid; place-items:center; font-size:13px; font-weight:700;">NH</span>
        <span>
          <span style="display:block; font-size:13.5px; font-weight:650; color:#0f172a;">Nguyễn Hương</span>
          <span style="display:block; font-size:12px; color:#94a3b8;">Product Designer</span>
        </span>
      </figcaption>
    </figure>
    <figure style="margin:0; padding:24px; background:#ffffff; border:1px solid #e2e8f0; border-radius:14px;">
      <div style="color:#f59e0b; font-size:15px; letter-spacing:2px;">★★★★★</div>
      <blockquote style="margin:12px 0 16px; font-size:14.5px; line-height:1.7; color:#334155;">“Đồng bộ mã nguồn thật là điểm khác biệt lớn nhất so với các công cụ khác.”</blockquote>
      <figcaption style="display:flex; align-items:center; gap:10px;">
        <span style="width:36px; height:36px; border-radius:50%; background:#0ea5e9; color:#fff; display:grid; place-items:center; font-size:13px; font-weight:700;">TM</span>
        <span>
          <span style="display:block; font-size:13.5px; font-weight:650; color:#0f172a;">Trần Minh</span>
          <span style="display:block; font-size:12px; color:#94a3b8;">Frontend Engineer</span>
        </span>
      </figcaption>
    </figure>
  </div>
</section>`,
  },
  {
    id: 'mkt-footer',
    name: 'Footer',
    group: 'marketing',
    tags: ['footer', 'chân trang', 'liên hệ'],
    description: 'Chân trang nhiều cột kèm bản quyền.',
    container: true,
    html: `<footer style="padding:48px 24px 24px; background:#0f172a; color:#cbd5e1; ${FONT}">
  <div style="max-width:1100px; margin:0 auto; display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:28px;">
    <div>
      <div style="font-size:18px; font-weight:750; color:#ffffff;">PixelMind</div>
      <p style="margin:10px 0 0; font-size:13px; line-height:1.7; color:#94a3b8;">Không gian làm việc thiết kế giao diện tích hợp AI.</p>
    </div>
    <div>
      <div style="font-size:13px; font-weight:700; color:#ffffff; margin-bottom:10px;">Sản phẩm</div>
      <div style="display:flex; flex-direction:column; gap:7px; font-size:13px;">
        <a href="#" style="color:#94a3b8; text-decoration:none;">Tính năng</a>
        <a href="#" style="color:#94a3b8; text-decoration:none;">Bảng giá</a>
        <a href="#" style="color:#94a3b8; text-decoration:none;">Cập nhật</a>
      </div>
    </div>
    <div>
      <div style="font-size:13px; font-weight:700; color:#ffffff; margin-bottom:10px;">Công ty</div>
      <div style="display:flex; flex-direction:column; gap:7px; font-size:13px;">
        <a href="#" style="color:#94a3b8; text-decoration:none;">Giới thiệu</a>
        <a href="#" style="color:#94a3b8; text-decoration:none;">Liên hệ</a>
        <a href="#" style="color:#94a3b8; text-decoration:none;">Tuyển dụng</a>
      </div>
    </div>
  </div>
  <div style="max-width:1100px; margin:32px auto 0; padding-top:18px; border-top:1px solid #1e293b; font-size:12.5px; color:#64748b;">© 2026 PixelMind. Bảo lưu mọi quyền.</div>
</footer>`,
  },

  /* ───────────── TIỆN ÍCH ───────────── */
  {
    id: 'util-icon',
    name: 'Icon',
    group: 'utility',
    tags: ['icon', 'svg', 'biểu tượng'],
    description: 'Icon ngôi sao SVG dùng currentColor.',
    html: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#6d5df5;" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2z"/></svg>`,
  },
  {
    id: 'util-divider',
    name: 'Đường phân cách',
    group: 'utility',
    tags: ['divider', 'hr', 'phân cách'],
    description: 'Đường kẻ ngang phân tách nội dung.',
    html: `<hr style="margin:24px 0; border:0; border-top:1px solid #e2e8f0;" />`,
  },
  {
    id: 'util-image',
    name: 'Hình ảnh',
    group: 'utility',
    tags: ['image', 'img', 'ảnh', 'picture'],
    description: 'Khung ảnh tỉ lệ 16:9 có nền giữ chỗ.',
    html: `<figure style="margin:0; ${FONT}">
  <div style="aspect-ratio:16/9; border-radius:14px; background:linear-gradient(135deg,#e0e7ff,#bae6fd); display:grid; place-items:center; color:#6366f1;">
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 16-5-5-9 9"/></svg>
  </div>
  <figcaption style="margin-top:8px; font-size:12.5px; color:#94a3b8;">Chú thích ảnh (có thể sửa)</figcaption>
</figure>`,
  },
]

export const TOOLBOX_ELEMENTS: ToolboxElement[] = items.map((item) => ({
  ...item,
  source: 'builtin',
}))

export const TOOLBOX_ELEMENT_MAP: Record<string, ToolboxElement> = Object.fromEntries(
  TOOLBOX_ELEMENTS.map((item) => [item.id, item]),
)

export const TOOLBOX_ELEMENT_COUNT = TOOLBOX_ELEMENTS.length

export function groupCounts(): Record<ToolboxGroupId, number> {
  const counts = {} as Record<ToolboxGroupId, number>
  for (const item of TOOLBOX_ELEMENTS) {
    counts[item.group] = (counts[item.group] ?? 0) + 1
  }
  return counts
}
