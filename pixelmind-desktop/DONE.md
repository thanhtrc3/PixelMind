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
- [x] **4.11. Loại bỏ dữ liệu ảo và kết nối Cây phân cấp phần tử thật (Live DOM Layers)**:
  - **Loại bỏ triệt để**: Xóa bỏ hoàn toàn mảng `DEFAULT_LAYERS` dữ liệu giả lập (`Khu vực Hero Section`, `div.logo`...) trong [`WorkspaceSidebar.tsx`](file:///d:/Code/PixelMind/PixelMind/pixelmind-desktop/src/components/WorkspaceSidebar.tsx).
  - **Trích xuất DOM thật từ iframe**:
    1. [`index.ts`](file:///d:/Code/PixelMind/PixelMind/pixelmind-desktop/electron/main/index.ts): Bổ sung hàm `sendDomTree()` và `scanLayers()` chạy bên trong iframe để trích xuất cây phần tử HTML thực tế theo cấu trúc phân cấp, tự động gán UID (`data-pm-uid`), trích xuất selector CSS và tạo nhãn trực quan (theo nội dung text, id, aria-label hoặc ngữ nghĩa thẻ).
    2. **Tương tác 2 chiều mượt mà**:
       - Nhấp vào phần tử trong Sidebar: Tự động cuộn đến phần tử trên Canvas, hiển thị khung chọn kích thước và mở bảng thuộc tính CSS trong Visual Inspector.
       - Rê chuột vào phần tử trong Sidebar: Hiển thị khung viền xanh hover chính xác vị trí phần tử trên Canvas.
       - Tự động gán Icon thông minh theo loại thẻ (thẻ văn bản, nút bấm, ô nhập, hình ảnh, bảng, danh sách, thanh điều hướng).
    3. **Giao diện trạng thái rỗng (Empty State) & Làm mới**:
       - Khi chưa chạy dev server: Hiển thị thông báo hướng dẫn rõ ràng kèm nút `[▶ Chạy dự án]` thay vì hiển thị dữ liệu giả.
       - Khi đang chạy: Tự động nạp cây DOM ngay khi trang tải xong; hỗ trợ nút `[Làm mới phân cấp]` để quét lại bất kỳ lúc nào.
- [x] **4.12. Bộ công cụ hỗ trợ trực quan khi Di chuyển phần tử & Tái cấu trúc DOM thật**:
  - **Vấn đề giải quyết**: Khi dùng công cụ `✥ Di chuyển` trên Canvas, phần tử nhận thuộc tính CSS `relative top/left` và bị kéo lệch ra khỏi khung cha (như `.p-3` bị kéo văng ra khỏi `.col-md-4`), gây xung đột giữa vị trí thị giác trên màn hình và phân cấp thật trong cây DOM.
  - **Bộ công cụ hỗ trợ thông minh đã tích hợp**:
    1. **Khung viền chỉ báo Khung cha (Parent Boundary Guide)**: Tự động vẽ đường viền nét đứt màu tím nhạt kèm nhãn `Khung cha: div.col-md-4` trên Canvas khi người dùng chọn bất kỳ phần tử con nào, giúp người dùng luôn nhận biết rõ ràng ranh giới của container chứa phần tử.
    2. **Thanh trợ giúp thông minh khi kéo lệch khung (Out-of-Bounds Helper Bar)**: Khi phần tử bị kéo lệch ra ngoài khung cha hoặc có tọa độ tương đối khác 0, một thanh trợ giúp tự động xuất hiện ngay trên đầu phần tử:
       - Cảnh báo: `⚠️ Lệch khỏi [khung cha]`
       - Nút **[↺ Đặt lại vị trí]**: Bấm 1 click là xóa bỏ `top/left`, đưa phần tử lập tức về lại vị trí tự nhiên ban đầu trong khung cha mà không vỡ responsive grid.
       - Nút **[◀ Đưa ra ngoài cha]**: Thực hiện tái cấu trúc DOM thật, chuyển phần tử ra ngoài thẻ cha để cây phân cấp cập nhật chuẩn xác.
       - Nút **[↺ Reset]** nhanh gắn ngay trên nhãn `✥ Di chuyển`.
    3. **Thanh công cụ Cấu trúc DOM trong Sidebar (DOM Reordering Actions)**: Khi nhấp chọn bất kỳ phần tử nào trong tab *Phân cấp phần tử*, xuất hiện dải nút điều khiển:
       - `[▲ Lên]`: Đổi vị trí với thẻ anh em liền trước.
       - `[▼ Xuống]`: Đổi vị trí với thẻ anh em liền sau.
       - `[◀ Ra ngoài cha]`: Đưa phần tử ra ngoài thẻ cha trong cây DOM thật.
       - `[▶ Vào trong]`: Đưa phần tử vào làm con của thẻ đứng trước.
       - `[↺ Đặt lại vị trí]`: Khôi phục tọa độ về mặc định.

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

---

## IV. CẢI TIẾN TRẢI NGHIỆM KÉO THẢ & PHÂN CẤP PHẦN TỬ (INSPECTOR OVERLAY & DOM HIERARCHY)

1. **Loại bỏ thanh cảnh báo nổi gây vướng víu trên Canvas**:
   - Gỡ bỏ hoàn toàn thanh thông báo đen `[⚠️ Vị trí tương đối | ↺ Đặt lại vị trí | ◀ Đưa ra ngoài cha]` trên Selection Box để giữ khung vẽ luôn thoáng mắt, sạch sẽ.
   - Nút di chuyển vị trí phần tử (Move Handle) được tinh gọn tuyệt đối thành một icon duy nhất (`<Move size={12} />`), loại bỏ hoàn toàn chữ thừa ("Di chuyển", "Reset") để đạt tính thẩm mỹ tối giản chuẩn Figma / Webflow.
   - Khung viền chỉ báo Khung cha (Parent Boundary Guide) chỉ hiển thị khi người dùng đang thực sự giữ chuột kéo di chuyển (`isMovingEl`), khi thả chuột ra thì biến mất để không làm rác Canvas.

2. **Chuyển các thao tác quản lý vị trí vào đúng nơi quy chuẩn (Inspector Panel & Layers)**:
   - Nút `Reset vị trí` (xóa `top/left` đưa phần tử về luồng tự nhiên) được đưa vào card **Vị trí & Kích thước (Location & Size)** trong Inspector Panel bên phải.
   - Các thao tác thay đổi phân cấp DOM (Lên, Xuống, Ra ngoài cha, Vào trong) được quản lý tập trung và chuẩn xác thông qua thanh công cụ **Cấu trúc DOM** trong tab **Phân cấp phần tử (Layers)** ở Sidebar.

3. **Hiện thực hóa cơ chế Kéo thả chuyển thẻ cha thật (Real Canvas Reparenting & Drop Zones)**:
   - Khi kéo di chuyển một phần tử (như `div.p-3`) trên Canvas ra ngoài khung cha, hệ thống tự động dò tìm thẻ chứa bên dưới con trỏ chuột và hiển thị vùng đích thả màu xanh lá: `📥 Thả vào: div.col-md-4` hoặc `📥 Thả vào: div.row`.
   - **Khi thả chuột**: Phần tử được di chuyển vật lý trong cây DOM sang thẻ cha mới (hoặc vị trí anh em mới), đồng thời tự động xóa bỏ `top/left` và `position: relative` để phần tử nhận vị trí luồng tự nhiên (natural flow) của thẻ cha mới.
   - Cây **Phân cấp phần tử** (Layers tree) tự động cập nhật ngay lập tức: `div.p-3` sẽ hiển thị đúng dưới thẻ cha mới, không còn tình trạng kẹt lại trong `col-md-4` cũ hay để lại khoảng trống đứt nét.

4. **Hỗ trợ kéo thả đưa phần tử trở về khung cha cũ (`.col-md-4`)**:
   - **Vùng nhận diện khung rỗng (Empty Drop Zone)**: Khi `.p-3` được kéo ra ngoài khiến `.col-md-4` trở nên rỗng, hệ thống tự động duy trì chiều cao tối thiểu 84px cho `.col-md-4`, hiển thị viền đứt tím tinh tế cùng nhãn `📥 Thả phần tử vào đây (col-md-4)`. Người dùng có thể kéo `.p-3` thả thẳng vào khung này trên Canvas bất cứ lúc nào.
   - **Kéo thả ngay trên cây Phân cấp phần tử (Layers Tree Drag & Drop)**: Cho phép kéo trực tiếp dòng `.p-3` trong danh sách cây DOM bên trái và thả lên dòng `.col-md-4` để đưa vào làm con.
   - **Phím tắt / Nút bấm 1-click**: Bấm chọn `.p-3` và nhấn nút `[▶ Vào trong]` trên thanh công cụ DOM để đưa ngay trở lại vào `.col-md-4`.

5. **Loại bỏ cột nhãn thẻ tag badge xám (`.pm-layer-tag`) trong cây Phân cấp phần tử**:
   - Đã gỡ bỏ toàn bộ các nhãn tag pill xám (`body`, `header`, `nav.navbar`, `div.container-fluid`, `col-md-4`...) nằm bên phải từng dòng.
   - Trả lại toàn bộ không gian chiều ngang để hiển thị đầy đủ tên phần tử và icon mà không bị che khuất hay ngắt chữ, giao diện danh sách cây trở nên tinh gọn và chuyên nghiệp chuẩn Figma / VS Code.

6. **Sửa lỗi vỡ dòng chữ ('Cấu trúc DOM:') và tinh gọn thanh điều hướng**:
   - Gỡ bỏ hoàn toàn thanh trung gian bị chật chội và vỡ dòng chữ thành 3 hàng (`Cấu \n trúc \n DOM:`).
   - Tích hợp các nút thao tác `[▲]` `[▼]` `[◀]` `[▶]` `[↺]` trực tiếp vào thanh tiêu đề header `[Phân cấp]` (chỉ xuất hiện tinh gọn khi người dùng đang chọn phần tử, chuẩn theo phong cách VS Code & Figma).
   - Giao diện trở nên liền mạch, không còn tình trạng đội chiều cao hay vỡ bố cục.

7. **Tự động tắt hoàn toàn Dev Server và giải phóng cổng mạng khi thoát dự án / đóng ứng dụng**:
   - **Tự động dọn dẹp khi chuyển màn hình**: Khi người dùng chuyển từ dự án về màn hình danh sách dự án (`'projects'`), mở dự án khác, hoặc xóa dự án, hệ thống sẽ tự động gọi lệnh dừng dev server của dự án hiện tại.
   - **Giải phóng cổng mạng bằng lệnh cấp độ hệ điều hành (`killPort`)**: Quét `netstat` tìm mọi PID đang chiếm cổng (ví dụ cổng 5162, 5173,...) và thực thi cưỡng chế tắt tiến trình bằng `taskkill /pid <PID> /T /F` trên Windows hoặc `kill -9` trên Unix, chấm dứt hoàn toàn tình trạng tiến trình mồ côi (orphan process/zombie) của `dotnet watch run` hay `vite`/`npm` chiếm giữ cổng.
   - **Bảo vệ toàn diện vòng đời ứng dụng**: Đăng ký các hook đóng cửa sổ và thoát ứng dụng (`mainWindow.on('close')`, `app.on('before-quit')`, `window.beforeunload`, `process.on('exit')`, `SIGINT`, `SIGTERM`) để đảm bảo không một tiến trình nào bị bỏ quên.
   - **Khởi động dự án an toàn**: Hàm `launch` tự động kiểm tra và tiêu diệt các phiên chạy cũ của cùng một dự án trước khi sinh ra tiến trình mới, triệt tiêu hoàn toàn lỗi `EADDRINUSE` hoặc `ERR_CONNECTION_REFUSED`.



8. **Xóa Trang, Liên Kết Nhanh Từ Navbar Đang Chạy & Đồng Bộ Hai Chiều URL Canvas**:
   - **Xóa trang linh hoạt**: Thêm nút Thùng rác (Xóa trang) với hộp thoại xác nhận an toàn, hỗ trợ khôi phục hoặc xóa sạch trang khỏi dự án.
   - **Liên kết nhanh từ Navbar**: Hệ thống tự động soi các thẻ `<a href>` trong Navbar của trang đang chạy và hiển thị danh sách nút bấm 1-click để liên kết thẳng tới các route thực tế.
   - **Đồng bộ hai chiều URL trên Canvas**: Khắc phục triệt để lỗi người dùng nhấp chuyển trang trong website nhưng thanh URL phía trên không đổi. Giờ đây URL phản hồi tức thì theo từng cú click điều hướng.

9. **Hộp Thoại Tham Số Trang Động (`PageParamDialog`) Cho Các Route `/Product/Delete/:id`**:
   - Với các trang quản trị hoặc chi tiết cần ID (như `/Product/Delete`, `/Product/Display`, `/Product/Update`), hệ thống không cố mở trang rỗng mà tự động bật popup cho phép chọn ID mẫu (`/Product/Delete/1`, `/2`...) hoặc tự điền ID tùy ý.

10. **Gợi Ý Thông Minh & Xếp Chồng Cây Thư Mục Route Trong Hộp Thoại Thêm/Sửa Trang (`AddPageDialog`)**:
   - Gợi ý phân cấp theo từng tầng dấu gạch chéo: gõ `/` gợi ý các trang cấp 1, gõ `/Product/` gợi ý các action con cấp 2.
   - Cung cấp ô tìm kiếm tức thì và danh sách cây xếp chồng gọn gàng, trực quan.

11. **Mở Rộng Tương Thích Toàn Diện Đa Loại Hình Dự Án Thông Dụng (Universal Framework & Project Support)**:
   - Tự động nhận diện và hỗ trợ trơn tru mọi loại hình dự án web: React + Vite, Next.js, Vue 3, Nuxt, SvelteKit, Angular, Astro, ASP.NET Core MVC (.NET 8/7/6), PHP (Laravel, WordPress, PHP thuần), Python (Django, Flask, FastAPI), Java Spring Boot, Go, Rust, và Web HTML5/CSS/JS tĩnh tích hợp sẵn máy chủ HTTP nội bộ.

12. **Cấu Trúc Cây Phân Cấp Route Chuẩn Theo Dấu Gạch Chéo (1/ là Tầng 1, 2// là Tầng 2, cứ thế mà tính)**:
   - **Phân tầng tuyệt đối theo dấu gạch chéo**: Tầng 1 (`/`, `/Home`, `/Product`), Tầng 2 (`/Product/Add`, `/Product/Delete`, `/Home/Privacy`), Tầng 3 (`/Product/Delete/1`...).
   - Hỗ trợ nút gập/mở `[▼]`, huy hiệu số trang con, và tính năng tìm kiếm tự động bung nhánh khớp.

13. **Thiết Kế Lại Toàn Diện Thông Báo HUD Trên Canvas (Floating Pill Toast Chuẩn Figma / Webflow)**:
   - Chuyển thông báo Toast thành dạng viên thuốc nổi Glassmorphism sang trọng ở giữa cạnh trên Canvas (`position: absolute; top: 50px; left: 50%`), không làm xô lệch thanh công cụ.
   - Chuẩn hóa ngôn ngữ lịch thiệp, tinh tế: "Đã bật chế độ Soi phần tử" kèm huy hiệu phím tắt `<kbd>Phím I</kbd>`.

14. **Chuyển Đổi Bộ 3 Nút Điều Khiển Bố Cục Panels Sang Bên Phải TopBar Cạnh Cài Đặt (Chuẩn VS Code / Modern IDE)**:
   - **Xóa bỏ nút lẻ ở bên trái**: Đã loại bỏ hoàn toàn nút bật/tắt đơn lẻ `[| ]` ở góc trái TopBar.
   - **Tích hợp cụm 3 nút Bố cục (Layout Controls: Trái, Dưới, Phải)**: Đặt tại góc phải TopBar ngay cạnh nút Cài đặt, phân tách bằng đường ngăn mỏng tinh tế (`pm-topbar-divider`).
   - Thiết kế SVG sắc nét với hiệu ứng đổ màu khi mở panel (Trái: Sidebar `Ctrl+B`, Dưới: Nhật ký máy chủ `Ctrl+J`, Phải: Bảng điều khiển `Ctrl+Alt+B` / `Ctrl+Shift+R`).
   - Cho phép thu gọn cả 3 panel để mở rộng không gian thiết kế Canvas 100% cực kỳ thoáng đãng.

15. **Nâng Cấp Toàn Diện Hộp Thoại Cài Đặt (Settings Dialog 2.0 Chuẩn Modern IDE / Visual Web Builder)**:
   - **Khắc phục lỗi nguy hiểm của nút 'Khôi phục mặc định'**:
     - Trước đây, nút "Khôi phục mặc định" ở chân trang gọi `api.store.reset()`, vô tình xóa sạch toàn bộ danh sách dự án của người dùng.
     - Đã tách riêng thành `onResetSettings` (chỉ đưa các tùy chọn cài đặt về mặc định, giữ nguyên vẹn 100% dự án) và chuyển tính năng xóa toàn bộ sang "Vùng nguy hiểm" (Danger Zone) trong tab Dữ liệu với cơ chế xác nhận 2 bước.
   - **Tổ chức 6 Tab chức năng trực quan & chuyên nghiệp**:
     1. **Chung (General)**: Tự mở dự án gần nhất, Hỏi trước khi xoá dự án, Hiện tệp & thư mục ẩn, Tự động lưu thay đổi (Auto-Save), Thu phóng ứng dụng (UI Zoom: 85% - 120%), Xác nhận khi thoát lúc server đang chạy, Script chạy phát triển ưu tiên.
     2. **Giao diện (Appearance)**: Chủ đề 3 chế độ (Tối / Sáng / Tự động theo Hệ điều hành), 8 mẫu màu nhấn chủ đạo + Bộ chọn màu Color Picker tự do (`<input type="color">`), Cỡ chữ giao diện slider (kèm nút Đặt lại 13px), Phông chữ mã nguồn Monospace (JetBrains Mono, Fira Code, Cascadia Code...), Cỡ chữ mã nguồn, Chế độ giảm chuyển động (Reduced Motion).
     3. **Canvas & Soi (Canvas & Inspector)**: Bật/tắt lưới chấm toạ độ nền Canvas (Blueprint Grid Dots), Thước đo khoảng cách thông minh (Smart Guides px), Viền bao định vị khi rê chuột (Hover Outline), Tự động đồng bộ vị trí chọn trên Canvas sang cây Phân cấp phần tử (Layers Tree).
     4. **Chạy & xem trước (Run & Preview)**: Tự động chuyển xem trước khi server sẵn sàng, Chế độ xem trước (Nhúng app / Trình duyệt ngoài), Tự động xóa log khi chạy lại (F5), Giới hạn số dòng nhật ký RAM (500 - 5000 dòng).
     5. **Dữ liệu & Bộ nhớ (Data & Storage)**: Đường dẫn cơ sở dữ liệu kèm nút Copy và Mở thư mục Windows Explorer, Sao lưu cài đặt ra file JSON (Export), Nhập cài đặt từ file JSON (Import), Dọn dẹp bộ nhớ đệm Preview (clearCache), Vùng nguy hiểm khôi phục toàn bộ.
     6. **Giới thiệu & Phím tắt (About & Shortcuts)**: Thông số môi trường hệ thống (Electron, Chromium, Node.js, OS), Ô tìm kiếm phím tắt thời gian thực, Bảng tra cứu phím tắt toàn năng phân loại theo 4 nhóm (Bố cục, Máy chủ, Canvas, Tiện ích).

16. **Khắc Phục Triệt Để Hệ Thống Thu Phóng Cỡ Chữ (Universal Dynamic Font Scaling Engine)**:
   - **Nguyên nhân lỗi trước đây**:
     - Trong CSS, các tiêu đề, mô tả, nhãn switch, tab, nút bấm, menu và bảng phím tắt đều bị viết cứng bằng giá trị pixel tĩnh (`font-size: 11px;`, `12px;`, `14px;`...).
     - Do đó khi người dùng kéo thanh trượt từ 11px lên 16px, chỉ có đúng một huy hiệu nhỏ chứa số `16px` thay đổi, toàn bộ chữ trong hộp thoại và giao diện vẫn giữ nguyên kích thước cũ.
   - **Cơ chế tỉ lệ động toàn diện (`--font-scale` & Root Rem Scaling)**:
     - Tính toán tỉ lệ co giãn động `scale = fontSize / 13` (Chuẩn 13px = 1.0, 11px = 0.846x, 16px = 1.231x - chênh lệch tới 45.5% kích thước).
     - Gắn trực tiếp `root.style.fontSize = (scale * 16px)` để tự động co giãn toàn bộ các đơn vị `rem` trong `variables.css`.
     - Chuyển đổi toàn bộ các phần tử trong hộp thoại Cài đặt (tiêu đề h2, h3, mô tả, nhãn in đậm, chữ mờ, nút bấm, dropdown select, bảng phím tắt), thanh TopBar (nút run, bảng lệnh, menubar) và Sidebar (cây tệp, phân cấp layers, danh sách trang) sang công thức tỉ lệ động `font-size: calc(XXpx * var(--font-scale, 1))`.
     - Giờ đây khi kéo thanh trượt từ 11px đến 16px, **toàn bộ giao diện và hộp thoại co giãn to nhỏ tức thì một cách mượt mà và trực quan 100%**.

17. **Cập Nhật Biểu Tượng Nút Soi Phần Tử Thành Cây Bút Chì Đặc (Chuẩn Ảnh 2 / Bootstrap bi-pencil-fill)**:
   - **Thay đổi icon nút 'Soi phần tử'**:
     - Thay thế icon thẻ mã `</>` (`Code2`) trước đây bằng biểu tượng cây bút chì tô đặc `PencilFillIcon` nghiêng 45 độ chuẩn xác theo Ảnh 2 (`bi-pencil-fill`).
     - Tích hợp nét vẽ tinh xảo với ngòi bút chì, thân bút có khía phân đoạn và phần tẩy trên đỉnh.
     - Đồng bộ màu sắc tự động với trạng thái kích hoạt (màu trắng khi đang bật soi, màu chữ hệ thống khi tắt).
