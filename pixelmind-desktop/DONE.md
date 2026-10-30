# done 30/10/2026

Nhật ký các phần công việc, tính năng và lỗi đã được sửa và hoàn thành trong dự án PixelMind Desktop.

---

### 1. Sửa lỗi xung đột khi chạy Electron (`Access is denied 0x5` & Single Instance Lock)
- **Vấn đề**: Khi chạy `pixelmind-desktop` bên trong chính ứng dụng hoặc chạy khi app cũ đang chạy ngầm, Electron bị lỗi `Access is denied (0x5)` do khóa thư mục cache và tự đóng ngay lập tức (exit code 0) do `requestSingleInstanceLock`.
- **Đã xử lý**:
  - Xác định và giải thích cơ chế Single Instance và cache lock của Chromium/Electron.
  - Hướng dẫn và cung cấp cơ chế đóng tiến trình ngầm an toàn.

---

### 2. Tự động kiểm tra và chẩn đoán thiếu sót khi mở thư mục bất kỳ
- **Tính năng mới**:
  - Khi mở bất kỳ thư mục dự án nào (qua hộp thoại chọn thư mục hoặc mở từ danh sách), hệ thống tự động kích hoạt bộ chẩn đoán:
    - Kiểm tra `package.json` và thư mục `node_modules`: Phát hiện nếu dự án chưa cài đặt thư viện (`missing_deps`).
    - Kiểm tra các script dev server và `index.html`: Cảnh báo nếu dự án thiếu script chạy (`missing_script`).
    - Kiểm tra loại ứng dụng: Nhận diện nếu thư mục là phần mềm Desktop (Electron) thay vì trang web (`electron_app`).
    - Kiểm tra kho lưu trữ Git: Nhắc nhở nếu chưa khởi tạo `.git` (`no_git`).
    - Kiểm tra thư mục rỗng (`empty_folder`).

---

### 3. Hộp thoại Báo cáo kiểm tra & Hỏi ý kiến người dùng để cài đặt tự động
- **Tính năng mới**:
  - Bật hộp thoại **Báo cáo kiểm tra dự án** trực quan khi phát hiện thiếu sót nghiêm trọng.
  - Nêu rõ tình trạng (ví dụ: dự án khai báo X gói thư viện nhưng chưa có `node_modules`).
  - Đưa ra đề xuất cụ thể (chạy `npm install`, `pnpm`, `yarn`, `bun`).
  - Hiện câu hỏi: *"Bạn có muốn PixelMind tự động cài đặt thư viện ngay không?"* kèm nút bấm nổi bật **[⚡ Cài đặt ngay]** và nút **[Để sau]**.
  - Hiển thị Thẻ cảnh báo (Health Banner) trên Dashboard Màn hình dự án và Màn hình làm việc.
  - Ngăn chặn người dùng bấm "Chạy" (F5) khi chưa cài thư viện để tránh gặp lỗi crash, tự động chuyển sang đề xuất cài đặt.

---

### 4. Thông báo lỗi trực quan thay vì hiển thị đống log kỹ thuật khó hiểu
- **Tính năng mới**:
  - Xây dựng bộ phân tích lỗi thông minh (`errorParser.ts`) tự động lọc bỏ các dòng stack trace phức tạp của Node/Vite (`at Object...`, mã hash, timestamp rối mắt).
  - Phân loại và nhận diện chính xác các dạng lỗi phổ biến:
    - **Thiếu gói thư viện** (`ERR_MODULE_NOT_FOUND`, `Could not resolve 'xyz'`, `Cannot find package`): Trích xuất tên gói và tệp cần dùng.
    - **Trùng cổng mạng** (`EADDRINUSE`): Nhận diện cổng đang bị chiếm (ví dụ cổng 5173).
    - **Xung đột cache Electron** (`Access is denied 0x5`): Báo có tiến trình desktop cũ đang chạy.
    - **Thiếu công cụ / command not found** (`vite is not recognized`): Báo thiếu công cụ trong `node_modules/.bin`.
    - **Lỗi TypeScript & Lỗi cú pháp**: Chỉ rõ tên tệp và số dòng bị lỗi cú pháp.
    - **Lỗi biên dịch plugin**: Tóm tắt thông điệp lỗi ngắn gọn.
  - **Giao diện thẻ lỗi trực quan (`VisualErrorCard`)**:
    - Hiển thị tiêu đề lỗi rõ ràng, nhãn phân loại màu đỏ/cam.
    - Giải thích nguyên nhân bằng tiếng Việt bình dân, dễ hiểu.
    - Đưa ra đề xuất cách sửa cụ thể.
    - Nút bấm hành động 1-click: **[⚡ Cài đặt thư viện ngay]**, **[Thử chạy lại]**, **[Mở tệp lỗi]**.
    - Mặc định ẩn các dòng log kỹ thuật thô và cung cấp nút bấm **[Xem log kỹ thuật (X dòng)]** khi người dùng muốn xem sâu.
  - **Khung xem trước (Preview)**: Khi dev server gặp lỗi không khởi động được, thay vì để màn hình trắng trống trơn, hiển thị ngay thẻ thông báo lỗi trực quan với nút bấm sửa lỗi ngay giữa màn hình.

---

### 5. Hỗ trợ mở và chạy dạng dự án Visual Studio 2022 (`.sln`) và C# (`.csproj`)
- **Vấn đề**: Trước đây PixelMind chỉ hỗ trợ các dự án Node.js (dựa trên `package.json`). Khi mở dự án Visual Studio 2022 như `BanCoTuong` (chứa `BanCoTuong.sln` và `BanCoTuong.csproj`), ứng dụng nhận nhầm là "Thư mục tĩnh", báo lỗi thiếu `package.json`, không nhận diện được script chạy và không xem trước được.
- **Đã hoàn thành**:
  - **Hỗ trợ chọn tệp giải pháp trực tiếp**: Cho phép chọn thư mục hoặc chọn thẳng tệp `.sln` / `.csproj` qua hộp thoại mở dự án (`project:pick`).
  - **Tự động dò tìm cấu trúc Visual Studio & .NET**:
    - Phân tích tệp Solution (`.sln`) để phát hiện phiên bản Visual Studio (VS 2022, VS 2019...) và danh sách các project con.
    - Phân tích tệp `.csproj`: Nhận diện TargetFramework (`net8.0`, `net9.0`, `.NET Core`...), Sdk (`Microsoft.NET.Sdk.Web`, `BlazorWebAssembly`, `Razor`...).
    - Hiển thị tên Framework chuẩn xác: ví dụ `ASP.NET Core (.NET 8.0) • VS 2022`.
    - Trình quản lý gói hiển thị `dotnet` (NuGet).
  - **Tự động sinh các lệnh chạy .NET**:
    - `watch`: `dotnet watch --non-interactive run [--project SubDir]` (hỗ trợ Hot Reload khi chỉnh sửa mã C# và Razor).
    - `run`: `dotnet run [--project SubDir]`.
    - `build`: `dotnet build`.
    - `test`: `dotnet test`.
  - **Tự động quét các trang Razor / Blazor / MVC**:
    - Dò các View MVC trong `Views/<Controller>/<Action>.cshtml` (ví dụ `Views/Home/Index.cshtml` thành route `/`, `Privacy.cshtml` thành `/privacy`).
    - Trích xuất tiêu đề thực tế từ `@ViewData["Title"] = "..."` hoặc `<title>...</title>`.
    - Dò Razor Pages trong `Pages/**/*.cshtml` và Blazor Components với `@page`.
    - Dò các tệp HTML tĩnh trong `wwwroot`.
  - **Chẩn đoán dự án .NET thông minh**:
    - Kiểm tra máy tính đã cài đặt .NET SDK (`dotnet --version`) hay chưa.
    - Kiểm tra tình trạng khôi phục các gói NuGet (`obj/project.assets.json`).
    - Cung cấp nút 1-click **[Khôi phục NuGet (dotnet restore)]** khi dự án chưa được restore.
    - Không còn báo lỗi sai về thiếu `package.json` hay `index.html`.
  - **Bắt cổng xem trước và hiển thị lỗi .NET trực quan**:
    - Runner tự động bắt cổng máy chủ Kestrel (ví dụ `http://localhost:5077` từ `launchSettings.json` hoặc console log) và mở khung xem trước trực tiếp.
    - Bộ lọc lỗi nhận diện các mã lỗi biên dịch C# (`CSxxxx`), lỗi thiếu gói NuGet (`NETSDK1004`), lỗi xung đột cổng mạng Kestrel và hiển thị thẻ lỗi tiếng Việt trực quan.
  - **Tối ưu cây thư mục**: Thêm `bin/` và `obj/` vào danh sách thư mục bỏ qua để cây thư mục gọn gàng và quét nhanh. Hỗ trợ hiển thị và định dạng cú pháp các tệp `.cs`, `.cshtml`, `.razor`, `.sln`, `.csproj`, `.props`.

---

### 6. Tự động tạo tệp `index.html` mẫu & Hỗ trợ dự án Flutter / Dart Web
- **Vấn đề**:
  - Khi mở thư mục thiếu tệp `index.html` hoặc thiếu script `dev`, PixelMind chỉ đưa ra câu đề xuất dạng văn bản mà không có nút để ứng dụng tự động làm giúp người dùng.
  - Khi mở dự án Flutter/Dart (như `D:\Dart\webnovel` có `pubspec.yaml` và `web/index.html`), PixelMind nhận nhầm là thiếu `index.html` và thiếu script.
- **Đã hoàn thành**:
  - **Tự động làm giúp người dùng (1-click Action)**:
    - Khi phát hiện thiếu `index.html`, hộp thoại kiểm tra và thẻ cảnh báo cung cấp nút bấm nổi bật: **[⚡ Tạo tệp index.html mẫu ngay]**.
    - Hệ thống tự động tạo tệp `index.html` giao diện chuẩn hiện đại (thẻ card responsive, CSS biến màu dark mode, thông báo chào mừng) và nạp ngay vào khung Xem trước.
    - Cung cấp nút **[⚡ Thêm script dev vào package.json]** khi dự án có `package.json` nhưng thiếu lệnh dev server.
  - **Hỗ trợ đầy đủ dự án Flutter / Dart Web**:
    - Tự động nhận diện cấu trúc Flutter thông qua `pubspec.yaml` và thư mục `web/index.html`.
    - Hiển thị đúng loại công nghệ: **`Flutter (Web)`** hoặc **`Flutter App`**.
    - Quản lý gói tự động chuyển sang **`flutter`**.
    - Tự động cấu hình các lệnh chạy: `flutter run -d chrome`, `flutter run`, `flutter build web`, `flutter pub get`.
    - Chẩn đoán kiểm tra Flutter SDK và các gói dependencies (`.dart_tool/package_config.json`), cung cấp nút **[Tải ngay (flutter pub get)]** khi chưa tải thư viện.
    - Bỏ qua thư mục cache `.dart_tool/` trong cây tệp.




---

### 7. Hệ thống nút bấm Workspace & Canvas vô cực trôi nổi (Figma-Style Floating Artboard)
- **Yêu cầu & Mục tiêu* *:
  - Bổ sung toàn bộ nút bấm ở màn hình làm việc theo Ảnh 1 và Ảnh 2.
  - Thay thế khung xem trước tĩnh tràn viền (như Ảnh 4) thành khu vực **Canvas vô cực trôi nổi (Floating Artboard)** tự do phóng to, thu nhỏ và di chuyển như Figma (theo Ảnh 3).
  - Tích hợp đồng bộ vào hệ thống PixelMind Desktop mà không copy y hệt từ thư mục mẫu `uiforge-ai`.
- **Đã hoàn thành**:
  - **Thanh công cụ TopBar mới (chuẩn Ảnh 2)**:
    - *Bên trái*:
      - Nút **Hoàn tác** (`Undo2` · `Ctrl+Z`) và **Làm lại** (`Redo2` · `Ctrl+Y`).
      - Nút **Trạng thái máy chủ**: Hiển thị linh hoạt theo thời gian thực: `[⏹ Đang chạy]` (nền đỏ nhạt) khi server đang hoạt động và `[▶ Run]` (nền xanh ngọc) khi đang dừng.
      - Nút **So sánh Git** (`GitCompare` · `⑂`).
      - Nút **Chế độ hiển thị cửa sổ** (`Monitor` · `🖥️`).
      - Nút **Chụp ảnh nhanh** (`Camera` · `📷`).
      - Ô tìm kiếm / **Bảng lệnh nổi bật**: `Bảng lệnh, phần tử, hành động… [Ctrl] [K]`, một lần bấm là kích hoạt Command Palette tức thì.
    - *Bên phải*:
      - Nút **Chia sẻ** (`Share2` · `🔗 Share`).
      - Nút **Trợ giúp** (`HelpCircle` · `❓` · `F1`).
      - Nút **Tải lại cây tệp** (`RefreshCw` · `Ctrl+R`).
      - Dropdown **Hồ sơ kết nối AI**: Nút dạng pill hiển thị `[🟢 Antigravity IDE ▾]` (hoặc `Ollama`, `GPT-4o`, `Claude`), click mở popover chọn mô hình AI trực quan.
      - Nút **Cài đặt** (`SettingsIcon` · `⚙️` · `Ctrl+,`).
      - **Hồ sơ người dùng & Avatar**: Badge bo tròn `[TH] Nguyễn Thanh Hiền ▾` kèm phụ đề `Admin · giấy phép còn hạn`, click mở menu xem chi tiết tài khoản và trạng thái bản quyền.
  - **Hệ thống thanh công cụ Canvas 2 tầng (chuẩn Ảnh 1)**:
    - *Tầng 1 (Công cụ thao tác & Zoom)*:
      - Nhóm công cụ vẽ trong segment pill: `Select (V)`, `Pan (H)`, `Khoanh vùng (L)`, `Ghi chú (T)`, `Bình luận (C)`, `Đo khoảng cách (M)`.
      - Đường phân cách dọc thanh mảnh `|`.
      - Nút **Chụp ảnh màn hình canvas** (`Camera` · `📷`) có thông báo toast kích thước.
      - Nút **Bật/tắt ghim bình luận** (`MessageSquarePlus` · `💬+`) viền active màu tím.
      - Cụm điều khiển Zoom chuẩn xác: Nút **Thu nhỏ** (`[-]`), Huy hiệu % **Zoom Badge** (`[100%]`), Nút **Phóng to** (`[+]`), Nút **Vừa khung nhìn** (`[⤢]` · `F`).
    - *Tầng 2 (Chế độ xem & Kích thước thiết bị)*:
      - Nhóm chế độ hiển thị: **Ảnh mẫu** (Mockup wireframe), **Trực tiếp** (Live server iframe), **Song song** (Side-by-side compare), **Chồng lớp** (Overlay), **Khác biệt** (Diff heatmap).
      - Khi chọn *Chồng lớp*: Tự động hiện **Thanh trượt độ mờ (Opacity Slider)** điều chỉnh tỷ lệ hòa trộn 0% - 100%.
      - Khi chọn *Khác biệt*: Hiện **Bảng chú giải sai lệch** (`Lệch nặng`, `Lệch nhẹ`, `Khớp`).
      - Nhóm kích thước thiết bị: `Mobile 390×844`, `Tablet 768×1024`, `Desktop 1440×900`, `Rộng 1920×1080`.
  - **Sân khấu vô cực & Khung Artboard trôi nổi (chuẩn Figma & Ảnh 3)**:
    - **Nền Stage vô cực**: Tông màu tối với lưới chấm bi **Dot Grid** li ti (`radial-gradient`), không bị dính tràn viền dán cứng như Ảnh 4.
    - **Pan & Zoom tự do linh hoạt**:
      - Phóng to / Thu nhỏ mượt mà từ **25% đến 200%** bằng cách cuộn con lăn chuột kết hợp giữ phím `Ctrl`, hoặc dùng phím tắt `+` / `-`, phím `F` để fit khung.
      - Di chuyển (Pan) tự do không giới hạn bằng cách: Chọn công cụ Hand `[H]`, hoặc nhấn giữ phím `Space` rồi kéo chuột trái, hoặc nhấn giữ chuột giữa kéo.
      - Lăn chuột thường để cuộn pan dọc / Shift + lăn chuột để pan ngang.
    - **Thanh Frame Bar đỉnh khung**:
      - Chấm xanh báo trạng thái máy chủ nhấp nháy (`🟢`).
      - Nhãn địa chỉ thật: `localhost:PORT / W × H`.
      - Chip trạng thái: `✓ Đã đồng bộ code`.
      - Nút tải lại khung và nút mở ra tab trình duyệt ngoài.
      - Nút dừng server nhanh ngay trên thanh frame khi đang chạy.
    - **Thân Khung Artboard nổi**:
      - Bo góc mềm mại 12px (hoặc 28px viền bo tròn điện thoại khi ở chế độ Mobile), bóng đổ sâu đa tầng (`drop-shadow`) nổi bật trên nền chấm bi.
      - Khi ở chế độ *Trực tiếp (Live)*: Nhúng `<iframe>` kết nối trực tiếp đến dev server đang chạy của dự án. Nếu server có lỗi, tự động nhúng `VisualErrorCard` với giải thích và nút 1-click sửa; nếu chưa chạy, hiển thị card chào đón kèm nút `[▶ Chạy dự án (F5)]`.
      - Khi ở chế độ *Ảnh mẫu (Reference)*: Hiển thị giao diện thiết kế web hiện đại hoàn chỉnh (Navbar, Hero Section, CTA Button, Feature Cards).
      - Khi ở chế độ *Song song (Compare)*: Chia đôi 2 pane so sánh trực quan giữa Ảnh mẫu và Bản xem trước trực tiếp.
      - Khi ở chế độ *Chồng lớp (Overlay)*: Lớp ảnh mẫu và giao diện live hòa trộn với độ mờ tùy chỉnh.
      - Khi ở chế độ *Khác biệt (Diff)*: Khối heatmap đánh dấu các vị trí lệch màu sắc và kích thước.
    - **Tương tác thiết kế Figma-Style**:
      - Click chọn các phần tử trên khung (`header`, `h1.hero-title`, `button.cta`, `article.card`) hiển thị khung viền tím `sel` kèm 8 điểm neo co giãn (resize handles), nhãn selector và kích thước W×H.
      - Thanh nổi AI dưới chân phần tử: Hiển thị nhãn selector kèm nút tím nổi bật **`✨ Nhờ AI sửa`** (chuẩn Ảnh 4).
      - Ghim bình luận trực quan (`QT`, `TH`, `BA`) hiển thị trên canvas có thể bật/tắt linh hoạt.
      - Dòng chỉ dẫn mờ ở góc dưới sân khấu: `▷ Kéo để pan (giữ Space) · Ctrl + lăn chuột để zoom · F để vừa khung nhìn`.

---

### 8. Tinh chỉnh Canvas: Sửa lỗi mất khung, kéo Pan xuyên Iframe, dọn dẹp Comment & Mở rộng không gian làm việc
- **Vấn đề cần xử lý**:
  - Khi bấm *Vừa khung nhìn*, Canvas bị trôi mất tích khỏi màn hình.
  - Khi chọn công cụ Hand (`H`), không thể kéo chuột khi rê vào phạm vi dự án đang mở (do bị `iframe` nuốt sự kiện chuột).
  - Phần comment giả lập và các chế độ ảnh mẫu/song song/chồng lớp/khác biệt chưa có ảnh mẫu thật nên cần dọn dẹp và thông báo phát triển sau.
  - Khu vực Canvas bị Nhật ký chạy bên dưới chiếm quá nhiều diện tích, cần giải pháp thu gọn/mở rộng và chế độ toàn màn hình.
- **Đã hoàn thành**:
  - **Sửa triệt để lỗi Canvas bị mất khi Vừa khung nhìn**:
    - Chuẩn hóa tọa độ căn giữa sân khấu với `transform: translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom / 100})`.
    - Dù khung ở độ phân giải nào (`390×844`, `768×1024`, `1440×900`, `1920×1080`), tâm của Artboard luôn luôn nằm chính xác ở tâm của sân khấu, không bao giờ bị trôi lệch.
    - Cập nhật hàm `zoomToFit` (`F`) tính toán lề an toàn và tự động fit vừa khít ngay khi mở hoặc chuyển kích thước.
  - **Hỗ trợ kéo di chuyển (Pan) xuyên suốt kể cả trong dự án đang mở**:
    - Tự động kích hoạt lớp chắn trong suốt `canvas__iframe-shield` và vô hiệu hóa `pointer-events` trên thẻ `<iframe>` khi chọn công cụ Hand (`H`), khi giữ phím `Space`, hoặc trong suốt quá trình kéo chuột.
    - Người dùng có thể click chuột bất kỳ đâu trên giao diện web đang chạy để kéo di chuyển mượt mà 100%. Khi nhả chuột và về công cụ `Select (V)`, iframe nhận lại sự kiện click/gõ phím bình thường.
  - **Dọn dẹp Comment & Chế độ xem chưa có ảnh mẫu**:
    - Xóa bỏ các ghim bình luận tĩnh giả lập (`QT`, `TH`, `BA`) và popup AI mockup.
    - Giữ lại icon Bình luận `[💬+]` trên thanh công cụ và phím tắt `C`, hiển thị toast thông báo: *"Tính năng Bình luận AI đang được phát triển, sẽ ra mắt trong phiên bản tới!"*.
    - Mặc định giữ ở chế độ *Trực tiếp (Live)*. Khi bấm vào các nút *Ảnh mẫu*, *Song song*, *Chồng lớp*, *Khác biệt*, hiển thị toast hướng dẫn: *"Chưa có ảnh mẫu thiết kế. Vui lòng tải lên ảnh mẫu hoặc kết nối Figma để sử dụng tính năng này!"*.
  - **Tối đa hóa không gian Canvas & Thu gọn Nhật ký chạy**:
    - Khi xem trước, mặc định ẩn Panel Nhật ký chạy và thay bằng thanh mỏng 26px tinh tế dưới đáy (`>_ Nhật ký chạy · X dòng [^ Mở rộng]`).
    - Bổ sung nút bấm **[>_ Nhật ký ▾/▴]** trên thanh Tabs để người dùng bật/tắt nhật ký bất kỳ lúc nào với 1 click.
    - Bổ sung nút **[⛶ Toàn màn hình / Thu nhỏ]** (Focus Canvas): Ẩn ngay lập tức cả Cây tệp bên trái, RunSidebar bên phải và Nhật ký bên dưới, trả lại 100% diện tích cho Canvas. Hỗ trợ phím tắt `Esc` để thoát nhanh.

---

### 9. Triển khai Phân hệ 1: Visual Inspector & Live DOM Bridge (Soi & Trích xuất phần tử thực tế)
- **Cam kết & Nguyên tắc thực hiện**:
  - **Không dùng dữ liệu ảo**: Tuyệt đối 100% thông tin hiển thị (tên thẻ, id, class, kích thước, computed styles, màu sắc, phân cấp DOM) được đọc trực tiếp theo thời gian thực từ DOM của dự án đang chạy trong iframe.
  - **Thông báo rõ ràng các phần chưa tích hợp**: Các tính năng thuộc Phân hệ 2 (Visual Style Editor), Phân hệ 5 (AI Modifier) và Phân hệ 6 (Figma Sync) khi người dùng bấm vào sẽ hiển thị toast thông báo trạng thái lộ trình phát triển chứ không chèn dữ liệu mockup giả.
- **Chi tiết tính năng đã hoàn thành**:
  - **Kích hoạt Live DOM Bridge trong Electron**:
    - Cấu hình `webSecurity: false` trong `electron/main/index.ts` để môi trường Desktop của PixelMind có toàn quyền kết nối và lắng nghe sự kiện DOM trên `localhost` của dự án mà không bị rào cản Same-Origin chặn lại.
  - **Chế độ Soi phần tử (Visual Inspector · Phím V)**:
    - Khi rê chuột qua các phần tử trên trang web: Tự động hiển thị khung viền nét đứt màu xanh bám theo phần tử (`.canvas__inspect-hover`), kèm nhãn tag và kích thước pixel thực tế (`tag.class · W × H`).
    - Khi click chuột vào phần tử:
      - Ngăn chặn điều hướng mặc định (để người dùng không bị nhảy trang khi click vào thẻ `<a>` hoặc submit form).
      - Hiển thị khung viền chọn tím sắc nét (`.canvas__inspect-selected`) ôm sát phần tử kèm 8 điểm neo co giãn (resize handles) và nhãn kích thước pixel thực tế.
  - **Bảng thông tin thuộc tính thực tế (Live Inspector Panel)**:
    - Bảng kính mờ (`.canvas__inspect-panel`) xuất hiện ở góc phải sân khấu hiển thị toàn diện dữ liệu thật của phần tử đã chọn:
      - **Tên thẻ & ID**: ví dụ `BUTTON`, `H1 #hero-title`, `DIV`...
      - **Phân cấp DOM thực tế (DOM Breadcrumbs)**: Duyệt ngược từ phần tử lên các thẻ cha (ví dụ `main > section.hero > div > button.cta`).
      - **Danh sách Class / Tailwind thực tế**: Tách riêng từng class thành các chip trực quan, kèm nút **[Sao chép toàn bộ classes]**.
      - **Thông số Computed Styles thực tế**: Hiển thị kích thước thực (`width × height`), kiểu hiển thị (`display`), cỡ chữ (`font-size`), độ đậm (`font-weight`), khoảng cách (`padding`, `margin`), bo góc (`border-radius`), màu chữ và màu nền (có ô swatch màu trực quan).
      - Nút **[📋 Sao chép CSS Selector]**: Tự động sinh selector CSS chuẩn xác (`#id` hoặc `tag.class1.class2`) và copy vào clipboard.
  - **Thông báo trạng thái lộ trình**:
    - Nút **[✏️ Sửa thuộc tính trực quan]**: Báo toast *"Phân hệ 2 (Visual Style Editor) đang được phát triển, sẽ ra mắt ở bước tiếp theo!"*.
    - Nút **[✨ Nhờ AI sửa phần tử này]**: Báo toast *"Phân hệ 5 (AI Component Modifier) đang được phát triển, sẽ ra mắt ở bước tiếp theo!"*.

---

### 10. Chuyển đổi tính năng Soi phần tử thành Chế độ riêng biệt (Inspect Mode · Phím I)
- **Vấn đề đã xử lý**:
  - Bảng Inspector trước đó tự động mở cố định trên màn hình, che khuất góc phải của Canvas gây vướng víu và khó chịu khi người dùng chỉ muốn xem trước giao diện thông thường.
  - Khi chưa chủ động bật chế độ soi, việc bảng luôn hiện diện gây cảm giác không có tác dụng và chiếm diện tích.
- **Đã hoàn thành**:
  - **Tách thành Chế độ Soi phần tử riêng biệt (Inspect Mode)**:
    - **Mặc định TẮT hoàn toàn**: Màn hình Canvas sạch sẽ 100%, trang web hiển thị thoáng đãng và thao tác chuột bình thường như trên trình duyệt. Bảng Inspector **ẩn hoàn toàn 100%**.
    - Thêm **nút công tắc chế độ riêng biệt** trên thanh công cụ Canvas: **`[</> Soi phần tử (BẬT/TẮT)]`**.
    - Bổ sung phím tắt nhanh **`I`**: Cho phép bấm phím `I` để bật hoặc tắt chế độ soi tức thì.
  - **Khi BẬT chế độ Soi (`isInspectMode = true`)**:
    - Nút công tắc chuyển sang màu tím nổi bật: `[</> Soi phần tử (BẬT)]`.
    - Bảng Inspector mở ra ở góc phải, con trỏ chuột bên trong khung chuyển sang hình chữ thập soi (`crosshair`), kích hoạt chế độ nhặt phần tử DOM thực tế.
  - **Khi TẮT chế độ Soi (`isInspectMode = false`)**:
    - Bấm nút công tắc, hoặc bấm phím `Esc`, hoặc bấm nút `[X]` trên góc bảng Inspector: Bảng lập tức đóng lại và biến mất hoàn toàn, giải phóng 100% không gian cho Canvas.
  - **Cải thiện độ tương phản giao diện**:
    - Chỉnh sửa toàn bộ màu chữ của Bảng Inspector sang màu trắng sáng `#ffffff` và xám bạc `#cbd5e1`, hộp mẹo có viền tím tinh tế, hiển thị sắc nét trên nền tối.
