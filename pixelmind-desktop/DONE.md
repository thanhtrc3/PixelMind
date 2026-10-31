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


---

### 11. Phục hồi toàn bộ về nhánh `main` & Giải quyết triệt để lỗi click nhảy trang trong iframe + Tích hợp Live Style & Text Editor (Phân hệ 2)
- **Vấn đề người dùng gặp phải**:
  - Người dùng vô tình chuyển nhầm branch khiến các thay đổi trên nhánh làm việc bị gián đoạn.
  - Khi bật Chế độ Soi phần tử (Inspect Mode), người dùng nhấp vào link/chữ "Product" trên menu thì trang web trong iframe tự động điều hướng sang trang `/product` thay vì chọn phần tử để soi và hiển thị thuộc tính để chỉnh sửa.
  - Inspector Panel không nhận được dữ liệu và người dùng không có công cụ trực tiếp để sửa chữa.
- **Nguyên nhân cốt lõi**:
  - Chromium trong Electron áp dụng cơ chế Site Isolation / Out-of-Process iframes (OOPIF) giữa các port khác nhau (`localhost:5174` vs `localhost:5162`), khiến `iframe.contentDocument` trả về `null` hoặc bị chặn Same-Origin Policy.
  - Sự kiện click trên thẻ `<a>` kích hoạt hành vi mặc định của trình duyệt điều hướng trang trước khi parent frame có thể bắt sự kiện.
- **Giải pháp kỹ thuật đã triển khai**:
  - **Phục hồi nhánh `main`**: Đưa toàn bộ 100% mã nguồn (CanvasArea, styles, topbar, workspace, DONE.md) về nhánh `main` an toàn tuyệt đối.
  - **Cấu hình Chromium Switch trong Electron**:
    - `disable-web-security`
    - `disable-site-isolation-trials`
    - `disable-features=IsolateOrigins,site-per-process`
    - Gỡ bỏ giới hạn CSP & X-Frame-Options qua session `onHeadersReceived`.
  - **Cơ chế IPC Frame Script Auto-Injection**:
    - Khi frame tải (`did-frame-finish-load`), Electron tự động inject script giám sát trực tiếp vào context của iframe.
    - Script đăng ký sự kiện `click` ở **capture phase (`capture: true`)**: Gọi `e.preventDefault()`, `e.stopPropagation()`, `e.stopImmediatePropagation()` để **ngăn chặn 100% việc nhảy trang** khi đang ở chế độ Soi.
    - Trích xuất dữ liệu DOM thật 100% (tag, id, class, rect, computed styles, text snippet, dom path) và gửi ra parent qua `window.parent.postMessage`.
  - **Tích hợp Bảng Chỉnh sửa Trực quan (Live Style & Text Editor - Phân hệ 2)**:
    - Khi chọn phần tử (ví dụ chữ "Product"), Inspector Panel mở ra ngay lập tức với viền tím bao quanh phần tử.
    - **Sửa nội dung chữ (Text)**: Ô input cho phép người dùng sửa text trực tiếp -> thay đổi hiển thị ngay trên web trong iframe thời gian thực.
    - **Sửa màu sắc**: Bộ chọn màu chữ (`color`) và màu nền (`background-color`) với bảng màu HTML5 + mã màu hiển thị trực quan.
    - **Sửa cỡ chữ & Bo góc**: Nút tăng/giảm Cỡ chữ (Font size) và Bo góc (Border radius) tương tác trực tiếp lên DOM thật.
    - **Nút [Khôi phục thuộc tính gốc]**: Cho phép đưa phần tử trở về trạng thái CSS và nội dung ban đầu chỉ với 1 click.


---

### 12. Tách Inspector thành Dedicated Side Panel cạnh phải & Chặn triệt để lỗi cuộn chuột lan truyền
- **Vấn đề người dùng phản ánh**:
  - Khi lăn chuột giữa trong bảng soi thì cả Canvas bên dưới cũng bị lướt/pan theo, gây khó chịu và mất vị trí quan sát.
  - Bảng soi trước đó là một popup chữ nhật trôi nổi đè lên trên trang web, che khuất tầm nhìn, bố cục chưa hoàn thiện.
- **Giải pháp kỹ thuật đã triển khai**:
  - **Tách kiến trúc DOM**: Chuyển từ popup absolute trôi nổi bên trong `canvas__stage` sang cấu trúc bố cục 2 cột song song (`.canvas__body = .canvas__stage (trái) + .canvas__inspector-sidebar (phải)`).
  - **Chặn 100% sự kiện cuộn chuột (Event Propagation)**:
    - Gắn `onWheel={(e) => e.stopPropagation()}` trực tiếp trên `.canvas__inspector-sidebar`.
    - Khi người dùng lăn chuột giữa trong Side Panel, sự kiện cuộn chỉ tác động lên nội dung của Panel, Canvas bên cạnh đứng yên tuyệt đối.
  - **Cơ chế ẩn/hiện đồng bộ**:
    - **Khi tắt chế độ Soi (`isInspectMode = false`)**: Side Panel biến mất hoàn toàn 100%, Canvas tự động chiếm trọn vẹn toàn bộ màn hình.
    - **Khi bật chế độ Soi (`isInspectMode = true`)**: Side Panel trượt vào mượt mà ở cạnh phải (rộng 360px), Canvas tự co lại để cả hai cùng hiển thị rõ ràng, không che khuất nhau.
  - **Thiết kế hoàn chỉnh, chuyên nghiệp chuẩn Webflow / Figma**:
    - **Header**: LED pulsing xanh lá `Live DOM`, tên thẻ lớn (`<A>`, `<BUTTON>...`), `#id` badge, nút copy CSS Selector, nút đóng X (Esc).
    - **Hero Card**: Tóm tắt phần tử, phân cấp DOM Breadcrumbs, Class Pills kèm nút sao chép toàn bộ classes.
    - **Section 1 (Live Text Editor)**: Ô nhập liệu sửa nội dung văn bản trực tiếp lên trang web.
    - **Section 2 (Layout & Box Model)**: Thẻ lưới hiển thị Kích thước (Width x Height), Display, Padding, Margin.
    - **Section 3 (Colors & Appearance)**: Bộ chọn màu chữ (`color`) và màu nền (`background`) với ô màu preview + color picker HTML5 + mã màu hex.
    - **Section 4 (Typography & Radius)**: Bộ điều khiển stepper `[ - ]` giá trị `[ + ]` cho Cỡ chữ (Font size) và Bo góc (Border radius), hiển thị Font family.
    - **Sticky Action Footer**: Nút `[Khôi phục thuộc tính gốc]` + Nút `[Nhờ AI sửa phần tử này]` (nổi bật với gradient tím).
    - **Empty State chuyên nghiệp**: Icon radar định vị, hướng dẫn cụ thể và bảng phím tắt nhanh (`I`, `Space/H`, `F`, `Esc`).


---

### 13. Kích hoạt tính năng kéo tương tác: 8 điểm neo phần tử (Live Resize Handles) & Thanh co giãn độ rộng Side Panel
- **Vấn đề người dùng phản ánh**:
  - Xung quanh phần tử được chọn có 8 điểm neo co giãn (hình vuông nhỏ ở góc và cạnh) nhưng người dùng bấm vào kéo thì không có phản hồi gì.
  - Bảng Soi phần tử bên phải chưa có thanh kéo để điều chỉnh độ rộng tùy biến.
- **Nguyên nhân**:
  - Trước đó các thẻ handle chỉ là các thẻ `<span>` hiển thị tĩnh, thuộc tính CSS cha mang `pointer-events: none` nên không nhận sự kiện chuột.
  - Chưa có bộ lắng nghe sự kiện chuột (`onMouseDown`, `mousemove`, `mouseup`) tính toán delta khoảng cách và cập nhật kích thước DOM.
- **Giải pháp kỹ thuật đã hoàn thành**:
  - **Tương tác 8 điểm neo co giãn phần tử thật (`Live Resize Handles`)**:
    - Bật `pointer-events: auto` và gắn các con trỏ resize chuẩn (`nwse-resize`, `nesw-resize`, `ns-resize`, `ew-resize`).
    - Gắn sự kiện `onMouseDown` cho từng điểm neo: `'nw'`, `'n'`, `'ne'`, `'e'`, `'se'`, `'s'`, `'sw'`, `'w'`.
    - Tính toán delta khoảng cách kéo chuột chia theo tỉ lệ `zoom / 100` của Canvas để đảm bảo dù zoom bao nhiêu % thì kéo cũng chính xác từng pixel.
    - Cập nhật kích thước `width` và `height` thời gian thực lên khung viền tím và đồng bộ ngay lập tức vào DOM thật trong iframe thông qua IPC / PostMessage.
    - Nhãn kích thước pixel (`width × height`) trên đầu phần tử nhảy số động liên tục theo tay người dùng.
  - **Thanh kéo co giãn độ rộng Side Panel (`Inspector Resizer Bar`)**:
    - Bổ sung thanh phân cách ở mép trái Side Panel với con trỏ `col-resize`, hover sáng màu tím accent.
    - Cho phép kéo sang trái/phải để co giãn độ rộng Panel linh hoạt từ `280px` đến `680px`.
  - **Lớp Drag Shield toàn màn hình chống trôi chuột**:
    - Khi đang kéo (resizing), tự động kích hoạt lớp chắn trong suốt phủ toàn màn hình (`zIndex: 9999`) để giữ con trỏ chuột không bị iframe bắt mất sự kiện `mousemove` và `mouseup`, đảm bảo thao tác kéo mượt mà 60fps.


---

### 14. Khắc phục triệt để lỗi nút "Khôi phục thuộc tính gốc" (True Element Original Reset)
- **Vấn đề người dùng phản ánh**:
  - Người dùng bấm nút "Khôi phục thuộc tính gốc" nhưng không có tác dụng, phần tử không quay lại trạng thái ban đầu.
- **Nguyên nhân cốt lõi**:
  - **Lỗi ghi đè State ban đầu**: Trước đó, mỗi khi người dùng kéo co giãn kích thước hoặc sửa text, iframe lại gửi thông điệp `PM_SELECT_ELEMENT`. Bộ lắng nghe ở parent vô tình gọi `setOriginalStyles` ghi đè bằng giá trị vừa sửa, khiến bộ nhớ thuộc tính gốc bị thay thế bằng thuộc tính mới!
  - **Thiếu khôi phục Kích thước**: `originalStyles` trước đó không lưu `width` và `height` ban đầu, nên khi kéo co giãn xong thì nút reset không thể trả về kích thước gốc.
  - **Cơ chế Inline Style trong DOM**: Khi chỉnh sửa, các thuộc tính được gán vào `target.style`. Khi khôi phục gốc, phần tử cần được đưa về đúng `target.style.cssText` ban đầu (hoặc xóa sạch các inline styles tạm) để nhường lại quyền điều khiển cho CSS/Tailwind gốc của trang web.
- **Giải pháp kỹ thuật đã hoàn thành**:
  - **Lưu Snapshot gốc trong DOM iframe**: Ngay khi click chọn phần tử lần đầu, script inject lưu ngay `target.__PM_ORIGINAL = { cssText: target.style.cssText, textContent: target.textContent }`.
  - **Bảo vệ State ban đầu ở Parent**: Chỉ gán `originalStyles` lần đầu tiên khi chọn phần tử mới (hoặc sau khi reset); chặn triệt để việc ghi đè state gốc trong suốt quá trình người dùng đang sửa đổi.
  - **Cơ chế True Reset 2 chiều**:
    - Gửi thông điệp `PM_RESET_ORIGINAL` qua IPC và PostMessage vào iframe -> DOM thực thi `lastSelected.style.cssText = lastSelected.__PM_ORIGINAL.cssText` và khôi phục text ban đầu.
    - Cập nhật state `selectedEl` ở Side Panel về đầy đủ: kích thước `width`, `height`, màu chữ, màu nền, font size, border radius và text ban đầu.
    - Khung viền chọn tím và các ô thông số trên Side Panel lập tức co lại về kích thước và thuộc tính gốc chuẩn xác 100%.


---

### 15. Hoàn thành 100% Phân hệ 2: Visual Style Editor (Bảng chỉnh sửa thuộc tính như Webflow) & Two-Way Code Sync
- **Mục tiêu**: Chỉnh sửa giao diện trực quan bằng thanh trượt, bảng màu, dropdown mà không cần viết mã tay, phản chiếu tức thì 60fps và sinh diff cập nhật ngược vào mã nguồn thật (.cshtml, .tsx, .jsx, .html, .vue, .razor).
- **Chi tiết các nhóm tính năng đã hoàn thiện trọn vẹn**:
  1. **Layout & Flexbox / Grid**:
     - Chuyển đổi hiển thị: `block`, `flex`, `grid`, `inline-block`, `inline`.
     - Bộ điều khiển Flexbox nâng cao:
       - **Direction**: Hàng ngang (`row`), Cột dọc (`column`), Đảo ngang (`row-reverse`), Đảo dọc (`column-reverse`).
       - **Align Items**: Căn trục phụ (`flex-start`, `center`, `flex-end`, `stretch`).
       - **Justify Content**: Căn trục chính (`flex-start`, `center`, `flex-end`, `space-between`).
       - **Gap**: Thanh trượt khoảng cách từ 0px đến 48px với số đo pixel nhảy số thời gian thực.
  2. **Spacing (Hộp trực quan Webflow Box Model)**:
     - Sơ đồ lồng hộp 2 lớp:
       - Lớp ngoài: **MARGIN** (màu cam nhạt) với số đo 4 cạnh.
       - Lớp trong: **PADDING** (màu xanh lá) với số đo 4 cạnh.
       - Trung tâm: Kích thước pixel `Width × Height` của phần tử.
     - Bộ nút tăng giảm khoảng cách nhanh `+` / `-` cho Padding và Margin.
  3. **Typography (Chữ & Kiểu dáng)**:
     - **Cỡ chữ (Font size)**: Bộ stepper `+` / `-` và thanh trượt trực quan.
     - **Độ đậm (Font weight)**: 5 mức lựa chọn nhanh: 300 (Nhẹ), 400 (Thường), 500 (Vừa), 600 (Đậm), 700 (Rất đậm).
     - **Căn lề (Text align)**: 4 nút biểu tượng Trái (`AlignLeft`), Giữa (`AlignCenter`), Phải (`AlignRight`), Đều (`AlignJustify`).
     - **Trang trí (Text decoration)**: None, Gạch chân (`Underline`), Gạch ngang (`Strikethrough`).
     - **Kiểu chữ hoa/thường (Text transform)**: `Aa` (Bình thường), `AA` (VIẾT HOA), `aa` (viết thường).
     - **Màu chữ (Text color)**: Color picker HTML5 + nhập mã màu Hex/RGBA + dải màu mẫu swatch thông dụng.
  4. **Backgrounds, Borders & Effects (Màu nền, Gradient, Viền & Đổ bóng)**:
     - **Màu nền (Background color)**: Color picker + mã Hex + nút gán nhanh `Trong suốt` + dải swatch.
     - **Dải màu Gradient**: 4 mẫu dải gradient hiện đại (Tím Cyber, Xanh Ngọc, Hoàng Hôn, Tối Sâu).
     - **Độ mờ (Opacity)**: Thanh trượt từ 0% đến 100% với nhãn số % trực quan.
     - **Đường viền (Borders)**: Lựa chọn kiểu viền (`none`, `solid`, `dashed`, `dotted`), tăng giảm độ dày viền (0-12px) và chọn màu viền.
     - **Bo góc (Border radius)**: Thanh trượt (0-50px) + các mức bo nhanh: `0px`, `4px`, `8px`, `16px`, `9999px (Tròn/Viên thuốc)`.
     - **Đổ bóng (Box shadow)**: 5 cấp độ bóng: Không bóng (`none`), Nhẹ (`sm`), Vừa (`md`), Đậm (`lg`), Phát sáng tím (`glow`).
  5. **Live Move & Live Resize**:
     - Thanh kéo `[✥ Di chuyển]` gắn trên selection box: tự động chuyển sang `position: relative` và cập nhật tọa độ `left/top`.
     - 8 điểm neo co giãn kích thước (Resize Handles): tự động chuyển `display: inline` sang `display: inline-block` trên thẻ inline (như thẻ `<a>`) để nhận `width/height` chuẩn W3C CSS.
  6. **Sinh Diff & Đồng bộ hai chiều (Two-Way Code Sync Engine)**:
     - **Code Locator**: Quét đệ quy tìm chính xác file và số dòng chứa phần tử.
     - **Tab Mã nguồn thật**: Hiển thị đường dẫn file, số lượng thay đổi đang chờ lưu.
     - **Bảng so sánh mã nguồn (Diff View)**:
       - 🔴 Dòng cũ: Mã nguồn gốc hiện tại trên đĩa.
       - 🟢 Dòng mới: Mã nguồn sau khi đã thêm/sửa text và thuộc tính `style="..."` (hoặc `style={{...}}` với JSX).
     - **Nút [💾 Lưu thay đổi vào mã nguồn thật]**: 1-click ghi đè vật lý vào tệp mã nguồn trên ổ đĩa.
     - **Nút [↺ Khôi phục gốc]**: Hoàn tác toàn bộ inline styles và trả về thuộc tính gốc ban đầu.

---

### 16. Hỗ trợ toàn diện dự án ASP.NET Core MVC & Razor Pages
- Tự động nhận diện cấu trúc dự án ASP.NET Core qua file `.sln` và `.csproj`.
- Quản lý gói tự động chuyển sang `dotnet`, thiết lập lệnh chạy chuẩn `dotnet watch --no-launch-browser run`.
- Ngăn chặn triệt để tình trạng tự động bật trình duyệt ngoài (Chrome) khi bấm Chạy dự án.

---

### 17. Khắc phục sự cố nhúng iframe xem trước & Tự động nắn chỉnh Route
- Bóc tách toàn diện các header bảo mật HTTP chống nhúng của ASP.NET Core (`X-Frame-Options: SAMEORIGIN`, CSP `frame-ancestors`, COOP, COEP).
- Bật `webSecurity: false` và xử lý bỏ qua lỗi chứng chỉ SSL localhost để iframe hiển thị mượt mà không bị trắng màn hình.
- Nhận diện chính xác tiền tố Area (`/Identity/Account/...`) và Controller (`/Home/...`), tự động nắn chỉnh đường dẫn khi chuyển trang.

---

---


---

### 16. Kích hoạt tính năng Hoàn tác/Làm lại (Undo/Redo) & Áp dụng mô hình In-Memory Buffer chuẩn Visual Studio 2022 Designer
- **Vấn đề & Nhu cầu**:
  - Người dùng mong muốn 2 nút Undo (`↶`) và Redo (`↷`) trên thanh TopBar hoạt động thực tế 100%.
  - Trải nghiệm thiết kế cần giống như WinForms trong Visual Studio 2022: sửa trực tiếp, kéo thả, đổi thuộc tính tự nhiên mà không bắt người dùng phải bấm "Lưu vào code" sau mỗi lần chỉnh sửa.
  - Tuyệt đối không ghi đĩa liên tục trong lúc đang kéo rê / thiết kế để tránh giật lag, nghẽn I/O và làm sập Dev Server Hot Reload.
- **Đã thực hiện**:
  1. **Bộ quản lý bộ nhớ đệm In-Memory Buffer (`src/lib/editorBuffer.ts`)**:
     - Lưu trữ toàn bộ lịch sử thao tác (`undoStack` và `redoStack`) trong bộ nhớ RAM.
     - Cơ chế `pushAction()` ghi lại ảnh chụp trạng thái trước (`before`) và sau (`after`) cho từng phần tử: kiểu dáng CSS, văn bản và tọa độ bounding box.
     - Quản lý danh sách file bẩn (`dirtyFiles` Map) đánh dấu những file có thay đổi trong RAM chưa ghi xuống đĩa.
  2. **Kích hoạt 2 nút Hoàn tác & Làm lại trên TopBar**:
     - Biểu tượng `Undo2` (`↶`) và `Redo2` (`↷`) sáng lên khi có lịch sử thao tác.
     - Tooltip hiển thị rõ thao tác sẽ được hoàn tác/làm lại (ví dụ: `Hoàn tác: Di chuyển <a> (Ctrl+Z)`).
     - Kết nối phím tắt toàn cục: `Ctrl + Z` (Undo), `Ctrl + Y` hoặc `Ctrl + Shift + Z` (Redo).
     - Hỗ trợ bắt phím tắt xuyên suốt ngay cả khi con trỏ chuột đang focus bên trong iframe trang web.
  3. **Hiển thị dấu hoa thị `*` chưa lưu chuẩn Visual Studio**:
     - Tab `Xem trước*` hiển thị dấu hoa thị `*` ngay khi có bất kỳ thay đổi nào trong RAM.
     - Các tab tệp mã nguồn mở (`${fileName}*`) tự động gắn cờ `*` nếu tệp đó đang có thay đổi chờ lưu.
     - Dấu hoa thị tự động biến mất khi hoàn tác sạch hoặc khi đã bấm lưu.
  4. **Cơ chế lưu đĩa an toàn (Ctrl + S & Auto-Save before Run)**:
     - Nhấn `Ctrl + S` hoặc bấm `[💾 Lưu mã nguồn (Ctrl+S)]` để flush toàn bộ buffer trong RAM xuống tệp vật lý trên đĩa.
     - Nút `[▶ Run] (F5)` tự động lưu toàn bộ các tệp dirty trong RAM trước khi biên dịch/chạy máy chủ.
  5. **Bổ sung cụm thuộc tính chuẩn WinForms: Location (X, Y) & Size (Width, Height)**:
     - Ô nhập tọa độ X (Left) và Y (Top) kèm stepper `[-]` `[+]` và nút preset `X: 0`, `Y: 0`, `Về gốc (0, 0)`.
     - Tự động chuyển `position: relative` khi phần tử đang là `static` để nhận tọa độ mượt mà.
     - Ô nhập kích thước Chiều rộng (W) và Chiều cao (H) kèm stepper `[-]` `[+]` và các nút preset `Auto W`, `100% W`, `Auto H`, `Fill`.
  6. **Tối ưu trải nghiệm chỉnh sửa văn bản & Kéo thả 60fps**:
     - Kéo di chuyển (Move) và co giãn (Resize) cập nhật DOM siêu mượt 60fps trong lúc drag và chỉ ghi đúng 1 bước lịch sử hoàn tác khi thả chuột (MouseUp).
     - Nhập văn bản trực tiếp phản chiếu ngay lập tức trên màn hình và chỉ ghi 1 bước lịch sử khi rời ô nhập (Blur / Enter).
     - Thao tác "Khôi phục gốc" cũng được đưa vào lịch sử Undo để người dùng có thể khôi phục lại nếu lỡ tay bấm nhầm.


---

### 17. Bộ đồng bộ mã nguồn phổ quát (Universal Multi-Framework Style & Position Engine)
- **Vấn đề**: Khi di chuyển phần tử, văn bản lưu được nhưng khi reload trang web thì vị trí bị nhảy về chỗ cũ.
- **Nguyên nhân**:
  - CSS chuẩn W3C quy định: Thẻ mang `position: static` (mặc định) sẽ bị trình duyệt lờ đi hoàn toàn các thuộc tính `left`, `top`.
  - Bộ trích xuất `extractElementInfo` trước đó thiếu trường `position`, khiến file lưu chỉ ghi `left/top` mà quên `position: relative`.
- **Đã giải quyết phổ quát cho MỌI loại dự án (React/Next.js JSX, Vue, Svelte, HTML, PHP/Laravel, ASP.NET Razor)**:
  1. **Bảo toàn định vị CSS W3C (Position Protection Guard)**:
     - Bất cứ khi nào có thay đổi `left` hoặc `top` (kéo rê chuột hoặc nhập tọa độ X/Y), hệ thống tự động ép buộc gắn `position: relative` (hoặc giữ `absolute`/`fixed` nếu đã có).
  2. **Tự động chuyển đổi thẻ inline khi co giãn kích thước**:
     - Các thẻ inline như `<a>`, `<span>`, `<strong>`, `<b>` khi co giãn `width`/`height` được tự động bổ sung `display: inline-block` để chuẩn CSS W3C.
  3. **Hỗ trợ cú pháp đa nền tảng**:
     - **React JSX/TSX**: Tự động sinh hoặc merge `style={{ position: 'relative', left: '100px', top: '40px' }}`.
     - **HTML / CSHTML / Vue / Svelte / PHP / Blade**: Tự động sinh hoặc merge `style="position: relative; left: 100px; top: 40px;"` bảo tồn các thuộc tính màu sắc, viền cũ đã có.
  4. **Bộ quét thẻ mở đa dòng (Multi-line Reverse Scanner)**:
     - Quét ngược tìm chính xác thẻ mở dù thẻ và chữ nằm ở các dòng khác nhau.

---

### 18. Khắc phục triệt để lỗi Undo/Redo làm vỡ giao diện & Hoàn thiện toàn diện Visual Style Editor (Webflow / Chrome DevTools Box Model)
- **Vấn đề & Triệu chứng**:
  - Khi bấm Hoàn tác (`Ctrl+Z`), giao diện bị vỡ nghiêm trọng: Thẻ container `<div>` bị bóp hẹp lại thành cột dọc 408px, toàn bộ tiêu đề dài bị bẻ gãy chữ, thanh điều khiển nhảy loạn xạ.
  - Sơ đồ Box Model trước đây chỉ là chuỗi text tĩnh (`- 8px 16px 8px 16px +`), không cho phép chỉnh sửa từng cạnh, bấm `+` hoặc `-` làm ghi đè sai cả 4 cạnh của padding/margin.
- **Nguyên nhân cốt lõi**:
  1. *Lỗi gán sai phần tử mục tiêu (Target Blindness)*: Trong injected script, `PM_APPLY_STYLE` chỉ dùng biến `var targetEl = lastSelected`. Khi người dùng click sang thẻ khác (ví dụ click vào `<div>`), rồi bấm Undo cho một thao tác của thẻ `<a>`, toàn bộ thuộc tính của thẻ `<a>` bị trút ngược đè lên thẻ `<div>`.
  2. *Lỗi áp đặt 50 Computed Styles (Style Explosion)*: Khi hoàn tác, hệ thống gửi nguyên vẹn 50 thuộc tính trình duyệt đã tính toán (`width: 408px`, `padding: 48px`,...). Việc gán `width: 408px` vào `<div>` container làm bóp nát khung chứa.
- **Đã xử lý & Hoàn thiện**:
  1. **Cơ chế định danh phần tử chuẩn xác (`uid` Tracking & `findTargetElement`)**:
     - Gán tự động thuộc tính định danh duy nhất `data-pm-uid` cho mọi phần tử DOM được soi.
     - Hàm `findTargetElement(target)` truy vết phần tử mục tiêu theo độ ưu tiên: `uid` -> `id` -> `domPath` (CSS selector & breadcrumb) -> `tagName`.
     - Tuyệt đối không bao giờ áp dụng nhầm style của phần tử này lên phần tử khác khi Undo/Redo.
  2. **Bộ hoàn tác Delta-Only Styles**:
     - Khi Undo/Redo, chỉ tính toán và đảo ngược đúng các thuộc tính thực sự bị thay đổi (`deltaStyles`).
     - Khi xóa style (ví dụ hoàn tác xóa màu nền hoặc xóa width), injected script gọi `targetEl.style.removeProperty()` giúp khôi phục hoàn hảo về quy tắc CSS ban đầu của class thay vì để lại style inline rác.
     - Tự động tái tính toán danh sách `dirtyFiles` (`rebuildDirtyFiles`) từ ngăn xếp lịch sử, không bao giờ ghi computed styles xuống file ổ đĩa.
  3. **Hoàn thiện Webflow & Chrome DevTools Interactive Box Model**:
     - Sơ đồ lồng hộp tương tác 2 chiều 100%: 4 ô input số pixel đặt trực tiếp tại các vị trí Trên (Top), Dưới (Bottom), Trái (Left), Phải (Right) của cả hộp Margin (vàng hổ phách) và hộp Padding (xanh ngọc).
     - Bộ điều khiển 4 hướng chi tiết kèm nút tăng/giảm pixel (stepper `[-]` `[+]`) và ô nhập số riêng biệt cho từng cạnh: `marginTop`, `marginRight`, `marginBottom`, `marginLeft`, `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`.
     - Phím tắt đặt nhanh (Presets):
       - Margin: `Auto` (căn giữa nội dung), `0px`, `16px`.
       - Padding: `Nút` (8px 16px), `Card` (16px 24px), `0px`.
  4. **Bổ sung các bộ điều khiển kiểu dáng trực quan cao cấp**:
     - *Xuống dòng Flexbox (`flexWrap`)*: Hỗ trợ `nowrap` và `wrap`.
     - *Con trỏ chuột & Tương tác (`cursor`)*: Tùy chỉnh `default`, `pointer` (bàn tay liên kết/nút), `text` (văn bản), `not-allowed` (vô hiệu hóa).
  5. **Kiểm tra chất lượng**:
     - Biên dịch TypeScript (`npm run typecheck`) và đóng gói (`npm run build`) đạt chuẩn 0 lỗi.

---

### 19. Sửa lỗi tráo văn bản khi Hoàn tác kéo nhiều phần tử & Kích hoạt toàn diện tính năng Làm lại (Redo)
- **Vấn đề & Triệu chứng**:
  - Khi kéo di chuyển lần lượt 3 phần tử (Tiêu đề `h1`, Mô tả `p`, Nút bấm `a`), sau đó bấm Hoàn tác (`Ctrl+Z`), chữ của Tiêu đề bất ngờ bị gán đè vào trong nút bấm `a`, tiêu đề và mô tả không quay về chỗ cũ.
  - Người dùng phản ánh nút Làm lại (Redo) không có tác dụng hoặc không biết cách dùng.
- **Nguyên nhân cốt lõi**:
  1. *Lỗi gửi kèm `textContent` trong thao tác di chuyển (`MOVE`)*:
     - Trước đây, khi hoàn tác, hệ thống gửi `textContent: textToApply` trong mọi loại thao tác (kể cả di chuyển vị trí `MOVE` hay co giãn `RESIZE`).
     - Khi `findTargetElement` gặp khó khăn trong việc định danh và fallback vào `lastSelected` (đang là nút `<a>`), nút `<a>` bị gán đè chữ của `<h1>`!
  2. *Lỗi Fallback sai phần tử mục tiêu*:
     - Trước đây, khi không tìm thấy phần tử mục tiêu, script tự động fallback vào `lastSelected` bất kể `lastSelected` là thẻ gì (`<a>` thay vì `<h1>`), khiến thao tác của thẻ này bị áp đặt lên thẻ khác.
  3. *Lý do Làm lại (Redo) không thấy tác dụng*:
     - Vì cả Undo lẫn Redo đều bị dồn vào `lastSelected`, hai phần tử kia (`h1` và `p`) chưa từng được Undo về vị trí ban đầu nên khi Redo chúng cũng không có bất kỳ thay đổi nào.
     - Ngoài ra, thiếu bộ lắng nghe phím tắt `Ctrl+Y` / `Ctrl+Shift+Z` ở tầng cửa sổ ứng dụng (ngoài iframe).
- **Đã xử lý & Hoàn thiện**:
  1. **Tách biệt tuyệt đối thao tác Di chuyển (`MOVE`) và Văn bản (`TEXT`)**:
     - Khi hoàn tác / làm lại thao tác `MOVE`, `RESIZE`, `STYLE`: Thuộc tính `textContent` luôn là `undefined`, **TUYỆT ĐỐI KHÔNG BAO GIỜ** chạm vào chữ của bất kỳ phần tử nào!
     - Chỉ khi người dùng thực sự sửa chữ (thao tác `TEXT`), `textContent` mới được gửi đi.
  2. **Bộ tạo CSS Selector độc nhất (`:nth-of-type`)**:
     - Bổ sung hàm `getUniqueSelector` tự động sinh selector phân cấp CSS chuẩn W3C (ví dụ `body > div:nth-of-type(1) > ... > h1:nth-of-type(1)`).
     - Định vị phần tử mục tiêu với độ chính xác 100% qua: `uid` -> `id` -> `unique selector` -> `domPath` -> `textSnippet`.
     - Quy tắc an toàn: Nếu không tìm thấy đúng phần tử có cùng `tagName`, hệ thống **DỪNG LẠI NGAY LẬP TỨC** (`return;`), tuyệt đối không bao giờ gán đè lên phần tử khác.
  3. **Tự động chuyển đổi phần tử đang chọn khi Undo/Redo**:
     - Khi bấm Undo/Redo, khung viền chọn xanh và bảng thuộc tính trong PixelMind tự động nhảy đến đúng phần tử đang được hoàn tác (từ `<a>` sang `<p>` rồi sang `<h1>`), giúp người dùng quan sát trực quan từng bước thay đổi.
  4. **Kích hoạt toàn diện phím tắt Làm lại (Redo)**:
     - Hỗ trợ `Ctrl + Y` và `Ctrl + Shift + Z` xuyên suốt cả trong iframe lẫn ngoài canvas.
     - Nút bấm Làm lại (`↷`) trên TopBar phản hồi tức thời theo từng bước lịch sử.

---

### 20. Khắc phục lỗi ghi nhầm tệp mã nguồn từ trang Product sang Home, tách Nhật ký chạy thành Dock kéo co giãn và phổ quát hóa nền tảng
- **Vấn đề & Triệu chứng người dùng báo cáo**:
  1. *Lỗi sửa nút Xóa / Sửa trên trang Product làm vỡ nút trang Home*: Người dùng vào trang Product sửa nút Xóa, Sửa thì nút "Khám Phá Sản Phẩm Ngay" bên trang Home bất ngờ bị đổi thành chữ "Sửa" và dính kèm một loạt style inline (width 97px, height 31px, line-through...).
  2. *Lỗi bấm Nhật ký làm web tự động nhảy về trang Home*: Khi đang xem bất kỳ trang nào (ví dụ `/Product`), người dùng bấm vào nút "Nhật ký" thì khung xem trước bị tải lại và quay ngoắt về trang chủ (`/`).
  3. *Nhu cầu giao diện Nhật ký*: Người dùng muốn Nhật ký có thể cầm kéo mép lên xuống thoải mái như 2 thanh trái phải của ứng dụng chứ không phải là một nút chật chội nằm chung hàng với thanh tab "Xem trước".
  4. *Lỗi báo đỏ Terminal (`ERR_CONNECTION_REFUSED`)*: Electron cố gắng tải địa chỉ dev server trước khi port thực sự lắng nghe.
  5. *Phổ quát hóa tính năng*: Hỗ trợ mở rộng cho các thể loại dự án khác nhau (Python, PHP, Flutter, Rust, Go...) chứ không chỉ riêng web tĩnh hay Node.
- **Nguyên nhân cốt lõi**:
  1. *Thuật toán tìm tệp mã nguồn (`scanProjectForSource`)*:
     - Trước đây, thuật toán duyệt thư mục theo thứ tự alphabet (`Views/Home` đến trước `Views/Product`).
     - Trong vòng lặp từng file, nếu `textSnippet` chưa khớp, code lập tức fallback sang so khớp class đầu tiên: `firstClass = className.split(/\s+/)[0]`.
     - Với các framework CSS phổ biến (Bootstrap, Tailwind...), class đầu tiên của nút luôn là `btn`!
     - `Views/Home/Index.cshtml` có `<a class="btn ...">`, nên hàm lập tức `return` luôn tệp `Home/Index.cshtml` dòng 11 mà không thèm kiểm tra xem các file tiếp theo (`Product/Index.cshtml`) có chứa chính xác text "Sửa" hay không!
     - Code locator hoàn toàn không biết URL / Route hiện tại mà người dùng đang duyệt trong webview là gì.
  2. *Cấu trúc cây DOM của WorkspaceView*:
     - Khi bấm nút "Nhật ký", `showLogs` đổi từ `false` sang `true`, dẫn đến việc hoán đổi component cha từ thẻ `<div>` sang `<Group orientation="vertical">`.
     - React nhận diện đây là 2 cây component khác nhau nên unmount hoàn toàn `<CanvasArea>` cũ và mount `<CanvasArea>` mới.
     - Khi mount mới, thẻ `<iframe>` bị tạo lại từ đầu và tải lại `src={url}` gốc (`http://localhost:5162/` - Trang Chủ)!
- **Đã xử lý & Hoàn thiện**:
  1. **Khôi phục nguyên trạng tệp `Home/Index.cshtml`**:
     - Trả lại đúng nội dung ban đầu cho dự án của người dùng: nút "Khám Phá Sản Phẩm Ngay", khôi phục giao diện trang chủ trong sáng, không còn bị đè chữ "Sửa".
  2. **Thuật toán chấm điểm thông minh đa yếu tố cho Code Locator (`scanProjectForSource`)**:
     - Tự động truyền `currentPath` (URL route hiện tại, ví dụ `/Product`) từ iframe lên bộ dò tìm mã nguồn.
     - Hệ thống tính điểm trọng số (`score`):
       - Điểm Route (+80 điểm nếu đường dẫn tệp chứa token của route như `product`, phạt -40 điểm nếu thuộc trang khác như `home`).
       - Điểm ID (+160 điểm nếu khớp ID thuộc tính).
       - Điểm Text Snippet (+70 điểm nếu chứa đúng chữ, +80 điểm nếu thẻ `tagName` tương ứng bao bọc chữ đó).
       - Điểm Class đặc trưng (+40 đến +80 điểm nếu khớp các class riêng biệt như `btn-warning`, `btn-danger`, `product-card`).
       - Loại trừ hoàn toàn các generic classes (`btn`, `row`, `col`, `container`, `card`...) không cho phép khớp đơn lẻ.
       - Thu thập tất cả ứng viên và chỉ lấy ứng viên có điểm số cao nhất (tối thiểu 40 điểm). Tránh tuyệt đối việc gán nhầm sang file khác!
  3. **Tách Nhật ký chạy thành Panel kéo co giãn dọc chuẩn IDE**:
     - Loại bỏ nút "Nhật ký" chật chội trên thanh tab Xem trước.
     - Cấu trúc cố định vĩnh viễn `<Group orientation="vertical">`:
       - Phía trên: Khung Canvas / FileViewer.
       - Dải phân cách ngang: `<Separator className="pm-resize-horizontal" />` với con trỏ `row-resize` và dải kéo mượt mà, tiện dụng như 2 bên trái phải.
       - Phía dưới: `<Panel collapsible defaultSize="24%" minSize="34px" maxSize="75%">` chứa `LogPanel`.
     - **Giữ CanvasArea luôn sống (Không Unmount)**: Bất kể người dùng kéo Nhật ký lên, hạ xuống, thu gọn hay mở rộng, CanvasArea và iframe bên trong KHÔNG BAO GIỜ bị tải lại, giữ nguyên trang người dùng đang xem!
     - Header của `LogPanel` hỗ trợ nhấp đúp để thu gọn/mở rộng tức thì, kèm nút chevron và thông báo trực quan.
  4. **Triệt tiêu lỗi `ERR_CONNECTION_REFUSED` khi máy chủ khởi động**:
     - Bổ sung hàm `waitForPort(port)` trong `runner.ts` kiểm tra socket TCP thực sự mở và chấp nhận kết nối trước khi phát tín hiệu URL cho iframe.
  5. **Phổ quát hóa hỗ trợ đa nền tảng dự án**:
     - Hỗ trợ thêm các dự án Python (Django, FastAPI, Flask), PHP (Laravel, Native), Rust (Cargo), Go (go.mod) với việc tự động nhận diện framework, script khởi chạy và đuôi tệp mã nguồn (`.cshtml`, `.razor`, `.tsx`, `.jsx`, `.vue`, `.svelte`, `.html`, `.php`, `.py`, `.dart`, `.xaml`, `.css`...).
     - Chuẩn hóa các thuật ngữ hiển thị thành đa năng ("Giao diện ứng dụng", "Xem trước", "Máy chủ dự án").

---

### 21. Sửa lỗi nhãn soi bị che khuất ở đỉnh Header & Hoàn thiện dải kéo Dock Nhật ký chạy chống biến mất
- **Vấn đề & Triệu chứng người dùng phản hồi sau khi test**:
  1. *Nhãn soi phần tử (Tag Badge) ở phần Header bị che khuất* (`step1_inspect_hover2.png`): Khi rê chuột vào thẻ `<header>` hoặc `<nav>` ở sát mép trên cùng của trang web, nhãn thẻ bị biến mất hoặc che khuất sau thanh tiêu đề khung nhìn.
  2. *Không kéo được Nhật ký chạy, bấm nút xuống là biến mất không lên lại được* (Bước 7): Khi bấm nút mũi tên xuống, panel Nhật ký bị collapse về 0px (biến mất hoàn toàn), không còn bất kỳ nút nào để mở lại; dải phân cách quá mỏng (2px) và thiếu gờ cầm kéo rõ ràng.
- **Nguyên nhân cốt lõi**:
  1. *Lỗi vị trí nhãn đỉnh*: Thuộc tính `.canvas__inspect-hover-tag` và `.canvas__inspect-selected-tag` đặt cố định `top: -22px`. Khi phần tử nằm sát mép trên (`rect.top < 24`), vị trí -22px bị đẩy ra ngoài vùng chứa của thẻ cha vốn có `overflow: hidden`, dẫn đến bị cắt đứt không nhìn thấy.
  2. *Lỗi `collapsible` của thư viện react-resizable-panels*: Khi đặt thuộc tính `collapsible` trên `<Panel>`, lệnh `collapse()` sẽ kéo chiều cao panel về `0%` (0px). Khi panel về 0px, toàn bộ header của Nhật ký bị ẩn mất. Đồng thời dải phân cách thiếu chiều cao và gờ kéo trực quan.
- **Đã xử lý & Hoàn thiện**:
  1. **Tự động lật vị trí nhãn soi khi ở đỉnh trang**:
     - Trong `CanvasArea.tsx`, khi phần tử có tọa độ đỉnh `rect.top < 24` (như header, menu trên cùng), hệ thống tự động lật nhãn `hover-tag` và `selected-tag` vào phía trong mép trên (`top: 2px, left: 2px`) kèm bóng đổ nổi bật.
     - Thanh kéo di chuyển `✥ Di chuyển` cũng tự động lùi xuống `top: 26px` khi phần tử ở mép trên, đảm bảo không bao giờ bị cắt khuất.
  2. **Dải kéo Dock Nhật ký trực quan chuẩn công nghiệp (`.pm-resize-horizontal`)**:
     - Bỏ thuộc tính `collapsible` $\rightarrow$ Panel Nhật ký có chiều cao tối thiểu vĩnh viễn là `36px` (chiều cao thanh header), **TUYỆT ĐỐI KHÔNG BAO GIỜ BIẾN MẤT VỀ 0PX**.
     - Dải phân cách được nâng độ cao lên `6px`, có gờ cầm kéo màu xám bo tròn (`width: 48px, height: 3px`) ở chính giữa thanh. Khi rê chuột vào, thanh sáng màu tím chủ đạo, gờ kéo chuyển sang màu trắng sáng và mở rộng ra `64px`.
     - Con trỏ chuột luôn luôn hiển thị chuẩn `row-resize` kèm vùng bắt chuột rộng 16px.
     - Khóa tạm thời `pointer-events` của iframe khi kéo thanh phân cách, ngăn chặn tình trạng iframe "cướp" chuột làm đứt quãng chuyển động kéo.
  3. **Bộ nút bấm Mở rộng / Thu gọn rõ ràng trên thanh Dock**:
     - Khi ở trạng thái thanh dock mỏng 36px: Nút hiển thị chữ nổi bật `[ ⌃ Mở rộng ]`. Nhấp đúp vào thanh dock hoặc bấm nút sẽ mở rộng bung lên 24% chiều cao màn hình.
     - Khi ở trạng thái mở rộng: Nút hiển thị `[ ⌄ Thu gọn ]`. Bấm nút sẽ thu gọn về thanh dock 36px.

---

### 22. Hoàn thành Phân hệ 3: Design Tokens & Theme Manager (Hệ thống thiết kế chuẩn W3C & Tailwind)
- **Mục tiêu**: Quản lý tập trung các quy chuẩn thiết kế của toàn dự án (Bảng màu, Tỷ lệ font, Khoảng cách, Bo góc) và tự động đồng bộ hai chiều với `variables.css` / `tailwind.config.js`.
- **Các tính năng đã triển khai & Kiểm thử đa vòng tự động (Automated Multiple Rounds Passed)**:
  1. **Bảng màu chuẩn (Color Palette)**:
     - Phân loại rõ theo 4 nhóm: *Thương hiệu (Brand), Nền & Khung (Background & Surface), Trạng thái (Status), Chữ & Trung tính (Neutral & Text)*.
     - Tự động sinh biến CSS W3C chuẩn: `--color-primary`, `--color-accent`, `--color-success`, `--color-warning`, `--color-danger`...
     - Hỗ trợ thêm màu mới không giới hạn, chỉnh sửa tên/mã HEX và xóa màu với bảng màu trực quan.
  2. **Thang tỷ lệ phông chữ (Typography Scale)**:
     - 8 bậc chuẩn: `xs`, `sm`, `base`, `lg`, `xl`, `2xl`, `3xl`, `4xl`.
     - Hiển thị xem trước chữ mẫu theo kích thước thực và line-height theo thời gian thực.
  3. **Thang khoảng cách (Spacing Scale) & Bán kính bo góc (Border Radius Scale)**:
     - Spacing từ `1` (4px) đến `16` (64px) có thanh đo pixel trực quan.
     - Radius từ `none` (0px) đến `full` (9999px) có hộp xem trước bo tròn trực tiếp.
  4. **Bộ sinh mã & Đồng bộ 2 chiều vào dự án (`tokens:save` & `tokens:get`)**:
     - Tự động phát hiện cấu trúc dự án để lưu `variables.css` đúng thư mục (`wwwroot/css/` cho ASP.NET Core, `src/styles/` cho React/Vite/Next, hoặc thư mục gốc).
     - Tự động sinh `tailwind.tokens.js` cấu hình chuẩn `theme.extend` cho Tailwind CSS.
     - Lưu trữ metadata chuẩn xác trong `.pixelmind/tokens.json`.
     - Bơm trực tiếp các biến CSS vào webview đang chạy (`PM_APPLY_DESIGN_TOKENS`) giúp thay đổi có hiệu lực ngay lập tức không cần F5.
  5. **Tích hợp sâu vào Bảng chỉnh sửa kiểu dáng (Visual Style Editor - Phân hệ 2)**:
     - Các thẻ Màu chữ và Màu nền hiển thị dòng chọn nhanh **"Màu Theme (Design Tokens)"** giúp người dùng nhấp chọn màu chuẩn thương hiệu chỉ với 1-Click.
  6. **Giao diện & Cổng truy cập linh hoạt**:
     - Nút icon `Palette 🎨` trên thanh NavRail bên trái.
     - Nút `[🎨 Tokens]` trên thanh công cụ Canvas đỉnh bản xem trước.
     - Lệnh "Hệ thống thiết kế" trong Command Palette (`Ctrl + K`).

---

### 23. Thanh lọc triệt để dữ liệu ảo, loại bỏ tính năng chưa làm (Phân hệ 4-5-6), tinh gọn giao diện và khắc phục Step 4
- **Yêu cầu của người dùng**:
  1. *Lỗi Step 4 (Không tìm thấy `variables.css` trong `TrangWebBanHang/wwwroot/css`)*: Khi đồng bộ tokens, file bị lưu nhầm ra thư mục gốc Solution thay vì thư mục web con của dự án.
  2. *Gác lại Phân hệ 4, 5, 6*: Tạm thời chưa làm, tập trung tối ưu hóa triệt để Phân hệ 1, 2, 3.
  3. *Giao diện thanh đỉnh (Head) quá cồng kềnh, chiếm diện tích Canvas (Ảnh 1)*: Có quá nhiều thanh công cụ xếp chồng lên nhau làm hẹp chiều cao khung xem trước; cần thu gọn lại được tương tự thanh Nhật ký.
  4. *Lỗi thanh TopBar khi co nhỏ cửa sổ bị mất nút (Ảnh 2)*: Co nhỏ cửa sổ làm thanh tìm kiếm và các nút bên phải tràn ra ngoài và biến mất; cần thiết kế co giãn đồng bộ chuẩn ứng dụng desktop.
  5. *Loại bỏ toàn bộ dữ liệu ảo (Ảnh 3, Ảnh 4)*: Không cho phép dùng dữ liệu ảo, xóa bỏ các phần chưa làm và ghi chép chi tiết danh sách đã xóa để sau này có thể thêm lại.
- **Chi tiết các phần và dữ liệu ảo ĐÃ XÓA BỎ**:
  1. *Hồ sơ kết nối AI (Ảnh 3)*: Xóa bỏ danh sách AI ảo (`AI_PROFILES`: Antigravity IDE, Ollama · qwen2.5-coder, GPT-4o, Claude 3.5 Sonnet) và dropdown trên TopBar.
  2. *Hồ sơ người dùng giả lập (Ảnh 4)*: Xóa bỏ Avatar `[TH]`, tên `Nguyễn Thanh Hiền`, email `hien.nguyen@pixelmind.ai`, nhãn `Giấy phép Pro · Còn hạn 12 ngày`, và dropdown tài khoản trên TopBar.
  3. *Nút Share*: Xóa bỏ nút Share giả lập trên TopBar vì chưa có hệ thống chia sẻ backend.
  4. *Các nút phụ không gắn sự kiện thật trên TopBar*: Xóa nút `Camera` (chụp màn hình trùng lặp), `Monitor` (chế độ cửa sổ ảo), `GitCompare` (so sánh nhánh chưa hoàn thiện).
  5. *Chế độ đối chiếu nguyên mẫu Phân hệ 6*: Xóa bỏ danh sách `MODES` trên Canvas (`Ảnh mẫu`, `Song song`, `Chồng lớp`, `Khác biệt` - `reqMock: true`) vốn chỉ hiện toast thông báo chưa hỗ trợ.
  6. *Nút AI Phân hệ 5*: Xóa bỏ nút tím `✨ Nhờ AI sửa phần tử này` trong chân trang Inspector.
  7. *Công cụ vẽ chưa hoàn thiện*: Xóa bỏ nút `Bình luận (C)` và `Đo thước (M)` trên thanh Canvas.
- **Các cải tiến kỹ thuật đã thực hiện**:
  1. **Khắc phục triệt để Step 4 (Lưu đúng thư mục `TrangWebBanHang/wwwroot/css/variables.css`)**:
     - Xây dựng hàm `findProjectCssDir(rootDir)` tự động quét sâu vào các thư mục dự án con trong Solution / Monorepo đa tầng (.NET Solution, WebProject con, Client/Server).
     - Xác định chuẩn xác thư mục `TrangWebBanHang/wwwroot/css` và ghi file `variables.css` trực tiếp vào đây.
     - Tự động kiểm tra file `site.css` (hoặc `main.css`, `style.css`...) và chèn dòng `@import './variables.css';` lên đầu tệp nếu chưa có, giúp toàn bộ trang web lập tức nhận diện hệ thống Design Tokens.
  2. **Gộp và Tinh gọn Thanh công cụ Canvas thành 1 DÒNG DUY NHẤT (Tiết kiệm ngay 38px)**:
     - Gộp toàn bộ công cụ vẽ (Soi phần tử, Con trỏ chọn, Kéo Pan) và bộ chọn kích thước thiết bị (Mobile, Tablet, Desktop, Rộng), nút Tokens, Tải lại, Mở ngoài và Zoom vào **một thanh công cụ duy nhất cao 36px**.
     - Loại bỏ hoàn toàn thanh hàng 2 (`.canvas__modes`) cồng kềnh.
  3. **Bổ sung tính năng Thu gọn Thanh công cụ Canvas (Tương tự Dock Nhật ký)**:
     - Thêm nút mũi tên `[ ⌃ ]` ở góc phải thanh công cụ.
     - Khi bấm `[ ⌃ ]`, thanh công cụ thu gọn lại thành một thanh mỏng 22px với nút `[ ⌄ Mở rộng ]`.
     - Nhường **100% chiều cao màn hình** cho sân khấu Canvas, mang lại không gian thiết kế cực kỳ rộng rãi và thoáng đãng!
  4. **Tối ưu hóa TopBar co giãn mượt mà theo chuẩn Desktop IDE**:
     - Giữ lại các thành phần cốt lõi và thực tế: Thương hiệu PixelMind, Tên thư mục dự án (với `text-overflow: ellipsis`), Hoàn tác/Làm lại (`↶ ↷`), Lưu mã nguồn (`💾 Lưu (Ctrl+S)*`), Chạy/Dừng máy chủ (`▶ Run / ⏹ Đang chạy`).
     - Thanh tìm kiếm `Ctrl+K` có `min-width: 120px; flex-shrink: 1`, tự động co giãn linh hoạt khi thu hẹp cửa sổ.
     - Nhóm công cụ bên phải chỉ gồm 3 nút biểu tượng chuẩn: Tải lại tệp (`Ctrl+R`), Hướng dẫn (`F1`), Cài đặt (`Ctrl+,`).
     - Triệt tiêu hoàn toàn hiện tượng tràn nút hay biến mất trên màn hình nhỏ (sửa triệt để Ảnh 2).


