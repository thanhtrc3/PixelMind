# PixelMind Desktop

Bản desktop (Windows) của PixelMind / UIForge AI, đóng gói bằng **Electron + electron-vite**.
Toàn bộ mã nguồn nằm trong thư mục này; dự án web gốc `uiforge-ai/` không bị chỉnh sửa.

## Tính năng

| Màn hình | Nội dung |
| --- | --- |
| **Danh sách dự án** | Mở thư mục bằng hộp thoại Windows, tự nhận framework (Vite, Next.js, Nuxt, Astro…), package manager, script và đánh dấu yêu thích. |
| **Màn hình dự án** | Dashboard thật của từng dự án: chỉ số nhanh, bảng *Trang và ảnh mẫu*, timeline *Phiên bản* (đọc từ `git log`), *Thông tin dự án*, *Hoạt động gần đây*. Thêm/xoá trang, quét lại, mở thư mục, Run/Dừng, mở màn hình làm việc. Có thẻ cảnh báo sức khoẻ dự án và báo cáo kiểm tra. |
| **Màn hình làm việc** | Cây tệp thật, xem nội dung tệp, chạy script và đọc log trực tiếp, phát hiện URL dev server và nhúng preview. Tự nhận Flutter (`flutter run -d web-server`) và cho phép nhập lệnh chạy tay cho dự án không có script. |
| **Tab Phiên bản (Workspace)** | Đồ thị commit Git thật kiểu VS Code Git Graph: làn nhánh nhiều màu, commit merge, badge `main` / `origin/…` / tag, avatar chữ cái. Có nút **Fetch** (`git fetch --all --prune`) để đồng bộ GitHub, xem chi tiết commit, khôi phục mã nguồn bằng `git reset --hard` kèm nhánh backup `pm-backup-*`, và danh sách mốc undo/redo thật của In-Memory Buffer. |
| **Chẩn đoán dự án** | Khi mở thư mục, PixelMind tự kiểm tra: thiếu `node_modules`, thiếu script dev/index.html, dự án Electron, chưa có `.git`, thư mục rỗng. Có hộp thoại báo cáo, thẻ cảnh báo trên Dashboard và nút **Cài đặt ngay** (`npm/pnpm/yarn/bun install`) chạy thật. |
| **Báo lỗi trực quan** | Log lỗi được phân tích thành thẻ dễ hiểu: thiếu gói, trùng cổng, thiếu công cụ, lỗi TypeScript/cú pháp, xung đột cache Electron… kèm đề xuất và nút sửa nhanh. Log kỹ thuật được thu gọn sau nút *Xem log kỹ thuật*. |
| **Cài đặt / Hướng dẫn / Bảng lệnh** | Chủ đề sáng–tối, cỡ chữ, thư mục mặc định, phím tắt, hướng dẫn sử dụng. |

### Màn hình dự án lấy dữ liệu từ đâu?

- **Trang**: dò `app/**/page.tsx`, `src/app/**/page.tsx`, `pages/**`, `src/pages/**`, hoặc `index.html`.
- **Phiên bản**: `git log --all --topo-order` của thư mục dự án. Timeline ở Dashboard lấy 30 commit gần nhất; tab Versions trong Workspace vẽ đồ thị tối đa 200 commit (mặc định `all`, có thể lọc theo nhánh hiện tại). Cả hai dùng chung bộ đọc Git trong main process.
- **Kho GitHub**: đọc `url` trong `.git/config`.
- **Chủ dự án**: tên tài khoản Windows hiện tại.
- **Hoạt động gần đây**: main process ghi lại khi mở dự án, chạy/dừng script, thêm/xoá trang.
- **Số tệp / thư mục**: đếm trực tiếp trên đĩa.

Không có số liệu nào là dữ liệu giả trong chế độ desktop. Chế độ xem trước trên trình duyệt
(`npm run preview:web`) dùng dữ liệu mẫu cho giao diện và lưu trong `localStorage` để tiện phát triển;
riêng dữ liệu Git (đồ thị commit, fetch, rollback) chỉ đọc được trên bản desktop và trả về rỗng/lỗi
trên trình duyệt, không sinh commit giả.

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
- Dự án không có `package.json`/script vẫn chạy được: chọn **Lệnh tự nhập…** trong mục *Lệnh chạy*, nhập lệnh
  (ví dụ `node server.js`, `python -m http.server 8000`) rồi bấm **Chạy**. Lệnh được lưu lại cho lần mở sau.
- Dự án Flutter được nhận diện qua `pubspec.yaml` và tự có script `run` (`flutter run -d web-server`).
- Preview nhúng phụ thuộc dev server của dự án; nếu cổng bị chiếm, đổi cổng trong script của dự án.
- Ảnh mẫu là thông tin theo dõi, không bắt buộc — thiếu ảnh mẫu thì canvas vẫn chạy ở chế độ Live.
