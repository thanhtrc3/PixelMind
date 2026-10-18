# PixelMind

**PixelMind** là một Visual Development Workspace (giống như Figma dành cho code). Ứng dụng này cho phép bạn mở một dự án web thực tế, xem giao diện đang chạy (Live Preview), và sử dụng AI hoặc kéo thả để chỉnh sửa trực tiếp mã nguồn (Source Code).

Dự án này được xây dựng trên nền tảng **React + TypeScript + Vite**.

---

## 🚀 Hướng dẫn cài đặt và chạy dự án

Để mở và chạy dự án này trên máy của bạn, hãy làm theo các bước sau:

### 1. Yêu cầu hệ thống (Prerequisites)
- Máy tính cần cài đặt sẵn **Node.js** (phiên bản 18 trở lên khuyến nghị). Bạn có thể tải tại [nodejs.org](https://nodejs.org/).

### 2. Cài đặt thư viện (Install Dependencies)
Mở terminal (hoặc Command Prompt / PowerShell) và di chuyển vào thư mục `uiforge-ai`:
```bash
cd d:\Code\PixelMind\uiforge-ai
```
Sau đó, chạy lệnh sau để tải các thư viện cần thiết:
```bash
npm install
```

### 3. Khởi động ứng dụng (Run Development Server)
Sau khi cài đặt xong, chạy lệnh sau để khởi động dự án:
```bash
npm run dev
```
Terminal sẽ hiển thị một đường link (thường là `http://localhost:5173`). Hãy giữ phím **Ctrl** và click vào đường link đó để mở ứng dụng trên trình duyệt của bạn.

---

## 📚 Tài liệu dự án

Các kế hoạch phát triển và kiến trúc của dự án được lưu trữ ở thư mục gốc (`d:\Code\PixelMind\`). Bạn có thể tham khảo các tài liệu sau để hiểu rõ định hướng của PixelMind:

- **[Kế hoạch MVP ban đầu](../Ke_hoach_UIForge_AI_Antigravity.md)**: Chứa ý tưởng cốt lõi, kiến trúc 4 phần và các chế độ Canvas.
- **[Kiến trúc Đa cầu nối AI (Multi-Bridge)](../Ke_hoach_NextSteps_UIForge.md)**: Giải thích cách ứng dụng sẽ kết nối với Antigravity IDE, CLI và API đám mây mà không tốn phí.
- **[Sổ tay Bảo mật Tối đa (Zero-Trust Security)](../Security_Plan_UIForge.md)**: Các quy tắc phòng thủ bắt buộc để đảm bảo ứng dụng không bị hack (như chặn Command Injection, bảo vệ WebSocket, mã hóa API Key).

---

## 🛠️ Công nghệ sử dụng (Tech Stack)
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Layout Engine**: `react-resizable-panels`
- **Icons**: `lucide-react`
- **Styling**: Vanilla CSS (CSS Variables theo hệ màu HSL)
- **Typography**: Inter (giao diện) + JetBrains Mono (mã nguồn, CSS)

---

## 🎨 Sơ đồ giao diện

Giao diện bám theo bản thiết kế giao diện (`prototype/index.html`) và đặc tả ở mục 3.10 của báo cáo: **thanh trên cùng → cột điều hướng dọc → vùng nội dung → thanh trạng thái**.

| Khu vực | Thành phần | Chức năng |
| --- | --- | --- |
| Thanh trên | `TopBar` | Logo, chip dự án, Undo/Redo, nút chạy, So sánh/Xem trước/Chụp, ô Bảng lệnh, Share, hướng dẫn, hồ sơ AI, cài đặt, menu người dùng |
| Cột điều hướng | `Nav` | 12 mục chia 4 nhóm: **Làm việc** · **Quy trình** · **Dùng lại** · **Quản trị**; tự thu gọn thành dải icon khi ở màn hình làm việc |
| Màn hình làm việc | `Sidebar` | Rail 7 tab: Layers · Pages · Assets · Files · Phiên bản · Design system · **Part** |
| | `CanvasArea` | 5 chế độ xem (Ảnh mẫu / Trực tiếp / Song song / Chồng lớp / Khác biệt), 6 công cụ vẽ, 4 khung thiết bị, thu/phóng vừa khung, ghim bình luận |
| | `AIPanel` | 6 tab: Chat · Tác vụ · Lỗi · **Ngữ cảnh** · Bình luận · Kết nối, vòng lặp sửa lỗi và duyệt nhiều vòng |
| Thanh dưới | `StatusBar` | localhost, framework, khung, thu phóng, phiên bản, nhánh git, hạn giấy phép, trạng thái AI |
| Màn quản lý | `sections/*` | Dự án · Phiếu yêu cầu · Phiếu kiểm tra · Lịch sử phiên bản · Thư viện Part · Design system · Giấy phép AI · Người dùng · Nhật ký · Báo cáo · Xuất bài |
| Lớp phủ | `CommandPalette` | Bảng lệnh mở bằng `Ctrl/⌘ + K` |
| Lớp phủ | `ProjectHub` | Danh sách dự án mở từ chip tên dự án hoặc `Ctrl/⌘ + O` |
| Lớp phủ | `Settings` | 9 nhóm cài đặt, có ô tìm nhanh và tự lưu |
| Lớp phủ | `Toolbox` | Search Toolbox — mở nhanh bằng `Ctrl/⌘ + Shift + P` |
| Lớp phủ | `LockScreen` | Màn đăng nhập, mở từ menu người dùng → Đăng xuất |

### Thêm trang cho dự án (màn **Dự án**)

Bảng “Trang và ảnh mẫu” cho biết mỗi trang có ảnh mẫu hay không, dùng phần mềm gì và xem ở khung nào. Bấm **+ Thêm trang** để mở hộp thoại nhập:

- **Đường dẫn (route) \*** — bắt buộc, tự thêm `/` ở đầu.
- **Tiêu đề**, **template khởi đầu** (landing / dashboard / mobile) và **khung xem mặc định** (1440×900 · 768×1024 · 390×844).
- **Ảnh mẫu không bắt buộc**: không có ảnh thì canvas vẫn chạy ở chế độ Live và so sánh theo DOM.

Trang mới được thêm ngay vào bảng, chọn được, và xoá được (trừ trang gốc `/`).

### Ngữ cảnh gửi kèm khi nhờ AI (tab **Ngữ cảnh**)

Danh sách tick chọn — mỗi mục bật/tắt độc lập: ảnh mẫu + ảnh hiện tại, vùng đang chọn, chú thích khoanh vùng, comment đang mở, DESIGN.md + tokens.css, skill, chỉ file liên quan, part đã duyệt. Thanh “Dung lượng gửi AI” ước lượng lại theo số mục đang bật. Gửi càng đúng ngữ cảnh thì AI càng ít sửa lung tung.

### Navbar của trang ShopWeb trong canvas

Thanh navbar trong khung xem trước là **trang thật đang được thiết kế**: `ShopWeb · Trang chủ · Sản phẩm · Khuyến mãi · Liên hệ · Đăng nhập`. Bấm được từng mục (mục đang mở đổi trạng thái), và mục nào cũng chọn được ra để xem thông số ở thanh dưới canvas.


### Search Toolbox — thư viện part

Kho part dùng chung nằm ở thư mục [`toolbox/`](toolbox). **Mỗi part là một thư mục chứa đúng 5 tệp** (mục 2.13 của báo cáo):

| Tệp | Vai trò |
| --- | --- |
| `meta.json` | “Căn cước” của part: tên, nhóm, tags tìm kiếm, phiên bản, bản DESIGN.md mà part dựa theo, tác giả, nguồn gốc và giấy phép sử dụng |
| `preview.png` | Ảnh chụp nhỏ để người lướt mắt chọn, khỏi phải đọc code |
| `sample.html` | Code khung sườn của part |
| `sample.css` | Code màu sắc, kiểu dáng của part |
| `prompt.txt` | Đoạn mô tả ngắn dành cho AI: kích thước, bo góc, vị trí icon, màu khi bấm vào |

Cách dùng:

1. Mở bằng `Ctrl/⌘ + Shift + P`, mục “Search Toolbox” trong Bảng lệnh, hoặc nút chèn part.
2. Gõ `search` để ra các part nhóm searchbox kèm ảnh, hoặc lọc theo nhóm / trạng thái duyệt.
3. **Kéo part thả vào khung giữa canvas** (hoặc bấm “Chèn vào canvas”): app chèn `sample.html` + `sample.css` vào trang và tải lại ngay. Part đã chèn hiện thành hàng trong cây phần tử.
4. Sai thì **Hoàn tác** — nút trên thông báo, nút Undo (có huy hiệu số part) hoặc `Ctrl/⌘ + Z`.
5. Part thiếu `preview.png`, chưa qua reviewer duyệt, bị ẩn hoặc bị khoá thì **không kéo vào khung được** và ghi rõ lý do.
6. AI mặc định chỉ **chép nguyên code mẫu**; muốn AI biến tấu thì bật công tắc “Cho phép AI biến tấu”, và chỉ part trong kho đã duyệt mới được dùng.

Thêm part mới chỉ cần tạo thư mục mới trong `toolbox/` với đủ 5 tệp — app tự nhận, không phải sửa code.

Kho demo có 12 part (6 part kéo được, 4 part minh hoạ các trường hợp bị chặn), sinh bằng script không cần thư viện ngoài:

```bash
node scripts/make-parts.mjs   # ghi lại meta.json / sample.html / sample.css / prompt.txt / preview.png
```

### Hệ thống token

Toàn bộ màu sắc và kích thước nằm trong `src/styles/variables.css`, lấy đúng bộ token của bản thiết kế giao diện:

- **Một màu nhấn duy nhất**: `--accent: #6d5df5` (tím chàm), tông sáng hơn `--accent-2: #8c7dff` dùng cho chữ trên nền nhấn.
- **Màu trạng thái cố định**: `--ok #31c07a` = đạt, `--warn #e2b13c` = cảnh báo, `--err #f0553f` = lỗi, `--info #4a8df6` = đang xử lý.
- **Nền theo tầng**: `--bg #0b0c0f` → `--panel #131519` → `--panel-2 #191b21` → `--panel-3 #20232a`; viền hairline `--line` / `--line-2`.
- **Bo góc**: `--r-sm 7px` (nút, ô nhập) · `--r 10px` (thẻ, panel) · `--r-lg 14px` (hộp thoại).
- **Phông chữ**: `--sans` (Inter) cho giao diện, `--mono` (JetBrains Mono) cho mã/CSS.
- Lớp dùng chung lấy từ bản thiết kế nằm ở `src/styles/proto.css` (`.btn`, `.chip`, `.tag`, `.kpi`, `.card`, `.tb`, `.kv`, `.tl`, `.rctx`, `.pcard`, `.dlg`…); màn quản lý dùng lại đúng bộ class này thay vì tự đặt màu.
- Không dùng màu tùy ý trong component — mọi màu đều đi qua biến.

### Phím tắt

| Phím | Hành động |
| --- | --- |
| `Ctrl/⌘ + K` | Mở/đóng Bảng lệnh |
| `Ctrl/⌘ + Shift + P` | Mở/đóng Search Toolbox (thư viện part) |
| `Ctrl/⌘ + ,` | Mở/đóng màn hình Cài đặt |
| `Ctrl/⌘ + O` | Mở Project Hub |
| `F1` | Mở Hướng dẫn sử dụng |
| `Esc` | Đóng lớp phủ đang mở |
