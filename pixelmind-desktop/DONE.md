# KẾ HOẠCH TỐI ƯU HÓA GIAO DIỆN & TÍCH HỢP HỆ THỐNG ĐIỀU HƯỚNG PIXELMIND DESKTOP

> **Ngày lập kế hoạch & Hoàn thành**: 04/11/2026  
> **Trạng thái**: [x] HOÀN THÀNH 100%  
> **Mục tiêu**: Xóa bỏ triệt để cấu trúc điều hướng 2 lớp (NavRail + TopBar), tinh gọn thanh trên cùng (bỏ logo trùng lặp, thu gọn đường dẫn dài), tận dụng tối đa Menu Bar hệ thống chuẩn desktop, và tích hợp Sidebar 7-trong-1 đa năng (Layers, Pages, Assets, Files, Phiên bản, Design, Part) có thể ẩn/hiện linh hoạt.

---

## I. XÁC NHẬN SỰ CẦN THIẾT CỦA CÁC MỤC ĐƯỢC YÊU CẦU

Sau khi rà soát mục tiêu sản phẩm PixelMind (Công cụ thiết kế & lập trình trực quan tích hợp AI), chúng tôi xác nhận mức độ cần thiết của cả 7 thành phần như sau:

| STT | Thành phần | Đánh giá | Vai trò & Giải pháp tích hợp trong PixelMind | Trạng thái triển khai |
| :--- | :--- | :---: | :--- | :--- |
| **1** | **Files (Tệp)** | **Cốt lõi (Bắt buộc)** | Quản lý cây tệp mã nguồn thật của dự án (`.tsx`, `.cshtml`, `.html`, `.css`...). Đã có `FileTree.tsx`. Giữ làm tab mặc định trong Sidebar. | [x] Đã hoàn thành 100% |
| **2** | **Layers (Cây phân cấp)** | **Cực kỳ cần thiết** | Hiển thị cây cấu trúc DOM/Element của trang web (Header, Hero, Nav, Buttons, Cards...) giúp người dùng định vị và chọn nhanh phần tử để sửa thuộc tính trên Canvas giống Figma/Webflow. | [x] Đã hoàn thành 100% |
| **3** | **Pages (Trang / Routes)** | **Cực kỳ cần thiết** | Liệt kê danh sách các trang web / routes trong dự án (`/`, `/about`, `/products`...). Bấm 1 click là chuyển URL xem trước tức thì trên Canvas; có nút `[+ Thêm trang]` nhanh. | [x] Đã hoàn thành 100% |
| **4** | **Assets (Tài nguyên)** | **Rất cần thiết** | Tự động quét và hiển thị các tệp hình ảnh trong thư mục dự án (`.png`, `.jpg`, `.svg`, `.webp`). Hỗ trợ nút **[Gắn làm ảnh mẫu Canvas]** để phục vụ tính năng So sánh, Chồng lớp, Diff. | [x] Đã hoàn thành 100% |
| **5** | **Phiên bản (Versions)** | **Rất cần thiết** | Hiển thị nhánh Git hiện tại, lịch sử thay đổi (các mốc sửa đổi trong In-Memory Buffer) và lịch sử commit gần nhất để người dùng theo dõi tiến trình làm việc. | [x] Đã hoàn thành 100% |
| **6** | **Design (Hệ thống thiết kế)** | **Rất cần thiết** | Xem nhanh bảng màu Swatches (accent, success, warning, dark/light), Typography, biến CSS Design Tokens. Bấm để sao chép biến CSS hoặc mở trình quản trị Tokens đầy đủ. | [x] Đã hoàn thành 100% |
| **7** | **Part (Thư viện Linh kiện)** | **Cực kỳ hữu ích** | Tận dụng kho dữ liệu linh kiện UI sẵn có trong `toolbox.ts` (Button CTA, Card Feature, Pricing Table, Tabs, Avatar Stack...). Cho phép tìm kiếm, xem trước và 1-click sao chép mã JSX/HTML vào dự án. | [x] Đã hoàn thành 100% |

> **Nguyên tắc hiển thị**: Tất cả các tab này được tích hợp vào một thanh Sidebar duy nhất bên trái. Người dùng có thể **thu gọn / ẩn hoàn toàn Sidebar bất cứ lúc nào** (`Ctrl + B` hoặc nút bấm `[Sidebar]`) để trả lại 100% không gian thoáng đãng cho Canvas làm việc.

---

## II. BẢNG TIẾN ĐỘ THỰC HIỆN CHI TIẾT

### Giai đoạn 1: Tinh gọn Thanh trên cùng (TopBar) & Xóa bỏ Cấu trúc 2 lớp
- [x] **1.1. Loại bỏ cụm Logo PixelMind thừa trên TopBar**: Thanh tiêu đề cửa sổ Electron (Image 1) đã có logo và chữ "PixelMind", đã loại bỏ logo và chữ trùng lặp ở thanh TopBar HTML (Image 3) để tiết kiệm diện tích.
- [x] **1.2. Thu gọn hiển thị thư mục dự án (Image 2)**: Chuyển khối hiển thị đường dẫn dài ngoằng `[Folder] uiforge-ai D:\Code\...` thành thẻ Chip nhỏ gọn tinh tế `[📁 uiforge-ai]`, rê chuột hiển thị tooltip đường dẫn đầy đủ, nhấp chuột để quay lại danh sách dự án.
- [x] **1.3. Tích hợp chuyển màn hình (View Switcher) lên TopBar**: Bổ sung bộ chuyển chế độ mượt mà `[Dự án]` / `[Chi tiết]` / `[Làm việc]` trực tiếp trên TopBar; loại bỏ hoàn toàn thanh dọc `NavRail` chiếm diện tích bên ngoài.
- [x] **1.4. Bổ sung nút Ẩn/Hiện Sidebar (Toggle Sidebar)**: Thêm nút bấm trực quan `[Sidebar]` trên TopBar cạnh nút Undo/Redo để người dùng dễ dàng bật/tắt toàn bộ thanh công cụ bên trái (hỗ trợ phím tắt `Ctrl + B`).

### Giai đoạn 2: Tận dụng Tối đa Electron Menu Bar Hệ thống
- [x] **2.1. Nâng cấp Menu "Tệp" (File)**: Thêm Mở thư mục (Ctrl+O), Màn hình dự án (Ctrl+Shift+O), Màn hình làm việc (Ctrl+Shift+W), Lưu mã nguồn (Ctrl+S), Cài đặt (Ctrl+,), Thoát (Role: quit).
- [x] **2.2. Bổ sung Menu "Chỉnh sửa" (Edit)**: Hoàn tác (Ctrl+Z), Làm lại (Ctrl+Y), Bảng lệnh (Ctrl+K).
- [x] **2.3. Nâng cấp Menu "Chạy" (Run)**: Chạy dự án (F5), Dừng máy chủ (Shift+F5), Cài đặt/Khôi phục thư viện, Báo cáo kiểm tra dự án, Tải lại cây tệp (Ctrl+R).
- [x] **2.4. Mở rộng Menu "Xem" (View)**: 
  - Bật/tắt Sidebar (Ctrl+B)
  - Chọn nhanh các tab Sidebar: Cây tệp (Ctrl+Shift+E), Layers (Ctrl+Shift+L), Pages, Assets, Versions, Design, Parts
  - Bật/tắt Nhật ký chạy (Ctrl+J)
  - Chế độ tập trung Canvas (Esc / Toàn màn hình)
  - Điều khiển Zoom Canvas (Phóng to, Thu nhỏ, Cỡ chữ mặc định)
- [x] **2.5. Bổ sung Menu "Công cụ" (Tools)**: Bật/tắt Soi phần tử trực quan (I), Hệ thống thiết kế (Tokens), Mở trang trong trình duyệt ngoài.
- [x] **2.6. Hoàn thiện Menu "Trợ giúp" (Help)**: Hướng dẫn sử dụng (F1), Bảng lệnh (Ctrl+K), Mở thư mục dữ liệu ứng dụng.

### Giai đoạn 3: Xây dựng Sidebar 7-trong-1 Đa năng (WorkspaceSidebar)
- [x] **3.1. Thiết kế thanh Activity Bar kiêm Panel nội dung**:
  - Cột icon nhỏ gọn bên trái gồm 7 icon: Files (`FolderTree`), Layers (`Layers`), Pages (`FileText`), Assets (`ImageIcon`), Versions (`History`), Design (`Palette`), Part (`Package`).
  - Hỗ trợ click vào icon đang chọn để toggle thu gọn / mở rộng nhanh (chuẩn VS Code / Figma).
  - Khi Sidebar thu gọn, Activity Bar 44px vẫn cho phép 1-click mở lại bất kỳ tab nào ngay lập tức; khi ở chế độ Tập trung Canvas (`Focus Canvas`), ẩn 100% để trả lại không gian tối đa.
- [x] **3.2. Tab Files (Tệp)**: Giữ nguyên cây thư mục thật `FileTree`, ô tìm kiếm tệp, nút tải lại, mở thư mục.
- [x] **3.3. Tab Layers (Lớp / DOM Tree)**:
  - Hiển thị cây phân cấp các thẻ DOM (Header, Hero, Sections, Buttons, Cards, Footer...).
  - Click vào layer: Tự động chọn và highlight phần tử trên Canvas.
  - Nút làm mới phân cấp và ô tìm kiếm thẻ (header, hero, btn...).
- [x] **3.4. Tab Pages (Trang / Routes)**:
  - Liệt kê các routes trong dự án (`/`, `/about`, `/contact`, `/login`, Razor Pages...).
  - 1-click chuyển ngay route trên Canvas xem trước.
  - Nút `[+ Thêm trang mới]` mở hộp thoại tạo trang nhanh.
- [x] **3.5. Tab Assets (Tài nguyên)**:
  - Tự động quét đệ quy các tệp hình ảnh từ cây tệp dự án (`.png`, `.jpg`, `.svg`, `.webp`, `.ico`).
  - Hiển thị thumbnail xem trước, tên và dung lượng tệp.
  - 1-click chọn làm ảnh mẫu đối chiếu trên Canvas.
- [x] **3.6. Tab Versions (Phiên bản & Lịch sử)**:
  - Hiển thị nhánh Git hiện tại (`git branch`), trạng thái kho mã.
  - Dòng thời gian các mốc thay đổi trong RAM In-Memory Buffer (Undo/Redo checkpoints).
  - Thông báo trạng thái lộ trình cho tính năng Git branching & sync nâng cao.
- [x] **3.7. Tab Design (Hệ thống thiết kế)**:
  - Bảng màu Swatches trực quan (Accent, Success, Warning, Error...).
  - 1-click sao chép tên biến CSS (`var(--pm-accent)...`).
  - Hiển thị xem nhanh font chữ (Inter, JetBrains Mono).
  - Nút mở hộp thoại Design Tokens Editor chuyên sâu.
- [x] **3.8. Tab Part (Thư viện Linh kiện mẫu)**:
  - Nạp đầy đủ kho part từ thư mục `toolbox` (Button CTA, Feature Card, Pricing Table, Tabs, Avatar Stack...).
  - Ô tìm kiếm linh kiện nhanh.
  - Thẻ linh kiện kèm mô tả và nút **[📋 Sao chép mã]** (HTML/CSS).
  - Nút **[Chèn vào trang]** kèm thông báo lộ trình tương tác AST tự động.

### Giai đoạn 4: Hoàn thiện Trải nghiệm, Tối ưu Giao diện & Đánh dấu Hoàn tất
- [x] **4.1. Dọn dẹp hoàn toàn CSS cũ của NavRail**, loại bỏ thanh điều hướng dọc 2 lớp ngoài cùng.
- [x] **4.2. Kiểm tra phím tắt toàn cục**: `Ctrl + B` (ẩn/hiện sidebar), `Ctrl + K` (palette), `Ctrl + S` (lưu), `Ctrl + Shift + E` (tệp), `Ctrl + Shift + L` (layers), `I` (soi), `F` (zoom fit), `F5` (chạy), `F1` (hướng dẫn).
- [x] **4.3. Kiểm thử biên dịch (Build & Run Test)**: Đảm bảo TypeScript không có bất kỳ lỗi nào (`npm run build` thành công 100%).
- [x] **4.4. Cập nhật nhật ký hoàn thành**: Đánh dấu `[x]` tất cả các mục trong `DONE.md`.
- [x] **4.5. Tinh gọn danh sách tìm kiếm tệp (FileTree)**: Bỏ chuỗi đường dẫn tương đối dài phía sau tên tệp trong danh sách kết quả tìm kiếm (vì khi nhấp mở tệp, thanh tiêu đề của `FileViewer` ở trên đã hiển thị đầy đủ đường dẫn và tooltip khi hover vẫn có sẵn), giúp danh sách tệp rộng rãi, gọn gàng và không bị cắt cụt tên tệp.
- [x] **4.6. Hợp nhất Tên App ngang hàng với Menu Bar**: Cấu hình `titleBarStyle: 'hidden'` kết hợp `titleBarOverlay` trong Electron để xóa bỏ thanh tiêu đề rời của Windows; đưa tên ứng dụng **PixelMind** và dải **Menu Bar (Tệp, Chỉnh sửa, Chạy, Xem, Công cụ, Trợ giúp)** lên nằm trên **cùng một dòng duy nhất** (chuẩn như VS Code / Cursor / Chrome), nhấp menu gọi trực tiếp native context popup mượt mà.
- [x] **4.7. Sửa triệt để lỗi màn hình trắng trống & khối đen góc trên phải**: Chuyển `.pm-app` từ CSS Grid sang Flexbox Column `height: 100vh;` và `.pm-body` nhận `flex: 1; min-height: 0;` (khắc phục lỗi TopBar chiếm trọn 1fr gây tràn trắng màn hình); đồng thời thay thế `titleBarOverlay` cứng màu đen bằng bộ nút điều khiển cửa sổ thông minh thích ứng 100% theo màu chủ đề (Light/Dark mode) kèm hiệu ứng hover đỏ chuẩn Windows.
- [x] **4.8. Đồng bộ hoàn toàn cụm nút Minimize, Restore, Close với bên trái**: 
  - Khắc phục triệt để tình trạng 3 nút cửa sổ bị "lẻ loi 1 mình" trong khối đen độc lập trên nền giao diện sáng.
  - Sử dụng cửa sổ `frame: false` trong Electron, loại bỏ hoàn toàn overlay màu cứng của hệ điều hành.
  - Đồng bộ kích thước (`height: 24px`, `width: 28px`), bo góc (`border-radius: 4px`), màu nền trong suốt (`transparent`) và hiệu ứng hover (`var(--panel-2)`) tương thích 100% với phong cách các nút menu bên trái.
  - Tự động hoán đổi icon Phóng to (`Square`) và Khôi phục (`RestoreIcon`) dựa trên trạng thái cửa sổ thực tế.
- [x] **4.9. Cập nhật Icon dự án & Thương hiệu chuẩn xác 100% theo đúng Ảnh cũ (Icon Nguyên tử Atom)**:
  - Khắc phục lỗi file `icon.png` mặc định của template bị nền xanh sáng + viền trắng + nét đen (ảnh người dùng vừa gửi).
  - Tạo lại file [`src/assets/icon.png`](file:///d:/Code/PixelMind/PixelMind/pixelmind-desktop/src/assets/icon.png) và component vector [`AtomLogo.tsx`](file:///d:/Code/PixelMind/PixelMind/pixelmind-desktop/src/components/AtomLogo.tsx) chuẩn 100% theo đúng **Ảnh cũ**:
    - Nền hình tròn màu tối `#2b2d39` sang trọng (không có viền trắng).
    - 3 vòng quỹ đạo elip và các hạt electron cùng hạt nhân trung tâm màu xanh cyan phát sáng (`#8fe5f5`).
  - Áp dụng đồng bộ tại:
    1. Thanh tiêu đề trên cùng [`TitleBar.tsx`](file:///d:/Code/PixelMind/PixelMind/pixelmind-desktop/src/components/TitleBar.tsx) cạnh chữ **PixelMind**.
    2. Nút Chip dự án đang mở trên [`TopBar.tsx`](file:///d:/Code/PixelMind/PixelMind/pixelmind-desktop/src/components/TopBar.tsx).
    3. Thẻ dự án trong màn hình danh sách dự án [`ProjectView.tsx`](file:///d:/Code/PixelMind/PixelMind/pixelmind-desktop/src/components/ProjectView.tsx).
    4. Cửa sổ Electron và thanh Taskbar hệ thống [`index.ts`](file:///d:/Code/PixelMind/PixelMind/pixelmind-desktop/electron/main/index.ts).
    5. Favicon trình duyệt Web [`index.html`](file:///d:/Code/PixelMind/PixelMind/pixelmind-desktop/index.html).
- [x] **4.10. Tự động kết nối & tải trang trên Canvas khi máy chủ sẵn sàng (Khắc phục lỗi `ERR_CONNECTION_REFUSED`)**:
  - **Nguyên nhân gốc rễ**: Khi bấm Chạy dự án ASP.NET Core (.NET 8), máy chủ Kestrel mất khoảng 2-4 giây để biên dịch và khởi tạo pipeline HTTP. Runner nhận diện cổng từ stdout và phát URL sớm hơn thời điểm máy chủ tiếp nhận request; Chromium tải iframe ngay lập tức nên bị từ chối kết nối (`ERR_CONNECTION_REFUSED`) và rơi vào trang lỗi tĩnh (màn hình trắng). Khi người dùng nhấp vào "Trang Chủ (`/`)", lúc đó server đã sẵn sàng nên trang mới hiện lên.
  - **Xử lý triệt để**:
    1. [`runner.ts`](file:///d:/Code/PixelMind/PixelMind/pixelmind-desktop/electron/main/runner.ts): Sửa `waitForPort` không còn trả về `true` giả khi timeout, hỗ trợ kết nối qua cả IPv4 (`127.0.0.1`), `localhost` và IPv6 (`::1`), bổ sung cờ `isCheckingUrl` chống quét trùng lặp khi nhiều dòng log đến cùng lúc, và tạo độ trễ ổn định 400ms sau khi kết nối TCP thành công.
    2. [`CanvasArea.tsx`](file:///d:/Code/PixelMind/PixelMind/pixelmind-desktop/src/components/CanvasArea.tsx): Tích hợp cơ chế tự động thăm dò độ sẵn sàng (Health Check & Auto-Retry Polling mỗi 450ms qua `fetch` không cache). Khi máy chủ chưa tiếp nhận HTTP, Canvas hiển thị màn hình chờ "Đang kết nối tới máy chủ..." sang trọng với icon xoay tròn, huy hiệu URL và bộ đếm lần thử. Ngay khi máy chủ phản hồi, Canvas tự động hiển thị trang web trực tiếp ngay lập tức mà không cần người dùng phải nhấp thủ công vào "Trang Chủ".
    3. [`App.tsx`](file:///d:/Code/PixelMind/PixelMind/pixelmind-desktop/src/App.tsx): Đồng bộ chuẩn hóa định dạng route và base URL xem trước (`http://localhost:5162/`).

---

## III. TỔNG KẾT THAY ĐỔI KIẾN TRÚC GIAO DIỆN

```
TRƯỚC ĐÂY (Bị dính 2 lớp điều hướng & lộn xộn):
┌────────────────────────────────────────────────────────────────────────┐
│ [Icon] PixelMind  (Titlebar Windows)                   [-] [□] [X]     │
├────────────────────────────────────────────────────────────────────────┤
│ Tệp   Chạy   Xem   Trợ giúp  (Menu Bar cơ bản)                        │
├────────────────────────────────────────────────────────────────────────┤
│ [Icon] PixelMind │ [📁 uiforge-ai D:\Code\PixelMind\...\uiforge-ai]    │  <-- Dài & Trùng lặp
├───────┬────────────────────────────────────────────────────────────────┤
│ Nav   │ Cây tệp   │ Canvas xem trước / Mã nguồn     │ RunSidebar       │  <-- 2 lớp dọc (NavRail + Cây tệp)
│ Rail  │ (chỉ tệp) │                                 │                  │
└───────┴───────────┴─────────────────────────────────┴──────────────────┘

HIỆN TẠI (Chuẩn Modern Desktop App như VS Code / Figma / Cursor):
┌────────────────────────────────────────────────────────────────────────┐
│ [Icon] PixelMind  Tệp  Chỉnh sửa  Chạy  Xem  Công cụ  Trợ giúp  [-] [□] [X] │  <-- 1 HÀNG DUY NHẤT ĐỒNG BỘ PHONG CÁCH
├────────────────────────────────────────────────────────────────────────┤
│ [Sidebar] [📁 uiforge-ai] [Dự án│Chi tiết│Làm việc] [↶][↷][▶ Run] [Ctrl+K]│  <-- 1 TopBar tinh gọn duy nhất
├───────────────────┬─────────────────────────────────┬──────────────────┤
│ 7-in-1 SIDEBAR    │ Canvas vô cực / Trực tiếp       │ RunSidebar       │
│ [📁][🥞][📄][🖼️] │ (Ấn Ctrl+B để ẩn Sidebar hoàn   │ (Thu gọn được)   │
│ [🕒][🎨][📦] [◀]  │  toàn, trả lại 100% không gian) │                  │
└───────────────────┴─────────────────────────────────┴──────────────────┘
```
