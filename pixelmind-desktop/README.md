# PixelMind Desktop

Bản desktop (Windows) của PixelMind / UIForge AI, đóng gói bằng **Electron + electron-vite**.
Toàn bộ mã nguồn nằm trong thư mục này; dự án web gốc `uiforge-ai/` không bị chỉnh sửa.

## Tính năng

| Màn hình | Nội dung |
| --- | --- |
| **Danh sách dự án** | Mở thư mục bằng hộp thoại Windows, tự nhận framework (Vite, Next.js, Nuxt, Astro…), package manager, script và đánh dấu yêu thích. |
| **Màn hình dự án** | Dashboard thật của từng dự án: chỉ số nhanh, bảng *Trang và ảnh mẫu*, timeline *Phiên bản* (đọc từ `git log`), *Thông tin dự án*, *Hoạt động gần đây*. Thêm/xoá trang, quét lại, mở thư mục, Run/Dừng, mở màn hình làm việc. |
| **Màn hình làm việc** | Cây tệp thật, xem nội dung tệp, chạy script và đọc log trực tiếp, phát hiện URL dev server và nhúng preview. |
| **Cài đặt / Hướng dẫn / Bảng lệnh** | Chủ đề sáng–tối, cỡ chữ, thư mục mặc định, phím tắt, hướng dẫn sử dụng. |

### Màn hình dự án lấy dữ liệu từ đâu?

- **Trang**: dò `app/**/page.tsx`, `src/app/**/page.tsx`, `pages/**`, `src/pages/**`, hoặc `index.html`.
- **Phiên bản**: `git log` của thư mục dự án (tối đa 8 commit gần nhất).
- **Kho GitHub**: đọc `url` trong `.git/config`.
- **Chủ dự án**: tên tài khoản Windows hiện tại.
- **Hoạt động gần đây**: main process ghi lại khi mở dự án, chạy/dừng script, thêm/xoá trang.
- **Số tệp / thư mục**: đếm trực tiếp trên đĩa.

Không có số liệu nào là dữ liệu giả trong chế độ desktop. Chế độ xem trước trên trình duyệt
(`npm run preview:web`) dùng dữ liệu mẫu và lưu trong `localStorage` để tiện phát triển giao diện.

## Chạy dự án

```powershell
npm install
npm run dev        # Electron + Vite dev server
npm run typecheck  # kiểm tra TypeScript cho main/preload và renderer
npm run build      # build production vào out/
npm run dist       # đóng gói bộ cài Windows bằng electron-builder
```

Sau `npm run dist`, bộ cài nằm ở `release/PixelMind Setup <phiên bản>.exe`, bản chạy trực tiếp ở
`release/win-unpacked/PixelMind.exe`.

Chạy bản đã build:

```powershell
npm run build
npx electron .
```

> Trên Windows nếu PowerShell chặn `npm`, dùng `cmd /c "npm run dev"`.

## Cấu trúc

```
electron/
  main/       # cửa sổ, menu, IPC, store JSON, dò dự án, runner
  preload/    # cầu nối an toàn contextBridge
shared/       # kiểu dữ liệu & hợp đồng API dùng chung
src/
  components/ # TopBar, NavRail, ProjectView, ProjectDetail, WorkspaceView…
  lib/        # bridge (Electron/browser), mock, theme, format
  styles/     # token giao diện + desktop.css
scripts/
  preview-web.mjs  # chạy thử giao diện trên trình duyệt
```

## Dữ liệu lưu trữ

File `pixelmind-store.json` trong thư mục `userData` của Electron
(Windows: `%APPDATA%\pixelmind-desktop\`). Chứa danh sách dự án, thiết lập và nhật ký hoạt động.
Xoá file này để đặt lại ứng dụng.

## Ghi chú

- Mở thư mục và chạy script là thao tác thật trên đĩa; PixelMind không sửa mã nguồn dự án.
- Preview nhúng phụ thuộc dev server của dự án; nếu cổng bị chiếm, đổi cổng trong script của dự án.
- Ảnh mẫu là thông tin theo dõi, không bắt buộc — thiếu ảnh mẫu thì canvas vẫn chạy ở chế độ Live.
