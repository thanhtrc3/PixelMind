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



