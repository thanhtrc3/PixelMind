# Gợi ý chức năng có thể phát triển — PixelMind Desktop

**Mục đích:** Danh sách chức năng **khả thi** có thể bổ sung cho PixelMind Desktop, sắp xếp từ **cơ bản → nâng cao**, kèm mô tả chức năng làm gì, gồm những gì, và sản phẩm/dự án tham khảo.
**Phạm vi:** Chỉ liệt kê và mô tả để lên kế hoạch. **Không chỉnh sửa mã nguồn.**

**Cách đọc độ khó:**
- ⭐ = dễ, làm trong 1–3 ngày
- ⭐⭐ = trung bình, 1–3 tuần
- ⭐⭐⭐ = nâng cao, 1–3 tháng hoặc cần hạ tầng mới

---

## 0. Hiện trạng ngắn (để tránh đề xuất trùng)

PixelMind Desktop hiện đã có:

- Quản lý dự án, thêm/xoá/sửa trang, chẩn đoán dự án, tạo `index.html`, thêm dev script.
- Cây file, xem/sửa file, chạy dev server, log, dừng server, cài thư viện.
- Soi phần tử (inspect), sửa style/text trực tiếp, box model, nhân bản/xoá phần tử, copy selector/classes, snap cơ bản.
- Layers lấy DOM thật, Pages, Assets, Versions, Design Tokens (CSS + Tailwind), Toolbox 60 part + diff modal + context menu.
- **Multi-Page Canvas**: cửa sổ trang, dây nối, anchor, kéo-thả, zoom/pan, auto layout, camera fly-to, nối/xoá dây + đồng bộ mã nguồn (HTML/JSX/Vue/Svelte/ASP.NET).
- Command Palette, hướng dẫn, cài đặt, thanh trạng thái, toast, cửa sổ Electron tự vẽ.

Các mục dưới đây là **phần còn thiếu** so với các sản phẩm cùng loại.

---

# CẤP 1 — CƠ BẢN (nên làm trước, giá trị cao, ít rủi ro)

## 1.1. Khung thiết bị & xem trước responsive
- **Làm gì:** Cho phép chuyển canvas giữa các khung Desktop / Tablet / Mobile, xoay ngang-dọc, chỉnh kích thước tuỳ ý; nội dung iframe tự co giãn theo khung.
- **Bao gồm:** preset 1440×900, 1024×768, 768×1024, 390×844; nút xoay; dropdown chọn khung; lưu khung mặc định theo trang; hiển thị kích thước hiện tại trên thanh trạng thái.
- **Tham khảo:** Figma (Frame), Webflow (Breakpoints), Framer, Chrome Device Toolbar, kế hoạch cũ của `uiforge-ai` (4 khung thiết bị).
- **Độ khó:** ⭐ · **Khả thi:** rất cao — chỉ cần đổi `width/height` của iframe trong `CanvasArea.tsx`.

## 1.2. Chụp & xuất ảnh trang
- **Làm gì:** Chụp toàn bộ trang hoặc vùng đang chọn thành PNG/JPEG/PDF để làm ảnh báo cáo, ảnh mẫu, tài liệu.
- **Bao gồm:** chụp viewport, chụp full-page (cuộn nối ảnh), chụp vùng chọn, copy vào clipboard, lưu vào thư mục dự án, đặt tên tự động.
- **Tham khảo:** Figma Export, Webflow Screenshot, Chrome Capture full size screenshot, `uiforge-ai` (nút Chụp).
- **Độ khó:** ⭐ · **Khả thi:** dùng `webContents.capturePage()` / `iframe` + canvas ở main process.

## 1.3. So sánh ảnh mẫu với trang thật (Compare / Overlay / Diff)
- **Làm gì:** Đặt ảnh thiết kế mẫu lên trên hoặc cạnh trang đang chạy để so sánh độ lệch.
- **Bao gồm:** chế độ Song song (side-by-side), Chồng lớp (overlay với opacity), Khác biệt (diff màu), thanh trượt phân chia, bật/tắt ảnh mẫu.
- **Tham khảo:** `uiforge-ai` (5 chế độ xem: Ảnh mẫu / Trực tiếp / Song song / Chồng lớp / Khác biệt), Figma Dev Mode, Chromatic.
- **Độ khó:** ⭐⭐ · **Khả thi:** tận dụng `assets` + iframe hiện có; diff ảnh xử lý ở canvas 2D.

## 1.4. Trình soạn thảo mã tích hợp (Code editor)
- **Làm gì:** Mở và sửa mã nguồn ngay trong app thay vì chỉ xem, có tô màu cú pháp, tìm/thay, lưu, format.
- **Bao gồm:** Monaco Editor; tab nhiều file; breadcrumb; Ctrl+S lưu; format (Prettier); go-to-line; highlight lỗi; tự phát hiện ngôn ngữ theo đuôi file.
- **Tham khảo:** VS Code, Cursor, Webstudio, Pinegrow.
- **Độ khó:** ⭐⭐ · **Khả thi:** thêm `monaco-editor` vào renderer; đọc/ghi đã có `fs.read/fs.write`.

## 1.5. Tab tài liệu & điều hướng file
- **Làm gì:** Mở nhiều file cùng lúc, chuyển tab, đóng tab, ghim tab, khôi phục tab sau khi mở lại app.
- **Bao gồm:** tab bar, dirty indicator (chưa lưu), recent files, breadcrumb thư mục, "Reveal in tree".
- **Tham khảo:** VS Code, Cursor, JetBrains.
- **Độ khó:** ⭐ · **Khả thi:** state ở renderer + lưu vào `store`.

## 1.6. Tìm kiếm toàn cục
- **Làm gì:** Tìm trong toàn dự án: tên file, nội dung file, route, tên component, asset.
- **Bao gồm:** panel search, regex, phân biệt hoa/thường, lọc theo loại file, kết quả có số dòng + preview, click để mở đúng vị trí.
- **Tham khảo:** VS Code Search, Webflow Find, Figma Search.
- **Độ khó:** ⭐⭐ · **Khả thi:** `fs.tree` đã có; thêm IPC đọc song song và cache.

## 1.7. Panel lịch sử thao tác & auto-save
- **Làm gì:** Xem lại toàn bộ thao tác đã làm (sửa style, di chuyển, nối dây, chèn part) và quay lại bất kỳ bước nào.
- **Bao gồm:** timeline các bước, nhãn thao tác, thời gian, nút Undo/Redo từng bước, auto-save theo khoảng thời gian, khôi phục phiên làm việc.
- **Tham khảo:** Figma Version History, Framer, VS Code Local History.
- **Độ khó:** ⭐⭐ · **Khả thi:** đã có `editorBuffer` / undo stack; cần chuẩn hoá thành lịch sử có nhãn.

## 1.8. Smart guides, thước & grid cho Multi-Page Canvas
- **Làm gì:** Căn chỉnh cửa sổ/ phần tử bằng đường dóng thông minh, thước đo, lưới nền.
- **Bao gồm:** guide ngang/dọc khi kéo, snap theo khoảng cách, ruler trên/dưới, grid bật/tắt, hiển thị toạ độ & kích thước khi kéo.
- **Tham khảo:** Figma (Smart Guides), Framer, Webflow.
- **Độ khó:** ⭐⭐ · **Khả thi:** canvas đã có toạ độ/zoom; thêm lớp overlay và thuật toán snap.

## 1.9. Chọn nhiều & căn chỉnh / phân bố
- **Làm gì:** Chọn nhiều cửa sổ hoặc nhiều phần tử để căn chỉnh hàng loạt.
- **Bao gồm:** multi-select (Shift/Ctrl + kéo vùng), align left/center/right/top/middle/bottom, distribute ngang/dọc, nhóm (group), di chuyển cả nhóm.
- **Tham khảo:** Figma Align, Webflow, Canva.
- **Độ khó:** ⭐⭐ · **Khả thi:** quản lý selection set trong state; áp dụng cho cả phần tử iframe.

## 1.10. Quản lý ảnh nâng cao (Assets)
- **Làm gì:** Kéo ảnh từ máy vào canvas/asset panel, thay ảnh, nén ảnh, đặt alt text.
- **Bao gồm:** upload/kéo-thả, thư mục đích, đổi tên, xoá, thay thế ảnh đang dùng, nén PNG/JPEG/WebP, tự tạo `alt`, copy đường dẫn.
- **Tham khảo:** Webflow Assets, Framer, Figma Images.
- **Độ khó:** ⭐⭐ · **Khả thi:** `fs.write` + IPC chọn file đã có; nén dùng `sharp` hoặc `squoosh`.

## 1.11. Quản lý trang nâng cao
- **Làm gì:** Nhân bản trang, tạo trang từ template, đổi route, đổi tiêu đề, đặt trang mặc định.
- **Bao gồm:** duplicate page, template landing/dashboard/mobile, đổi route có kiểm tra trùng, preview trước khi lưu, xoá có xác nhận, sắp xếp lại thứ tự trang.
- **Tham khảo:** Webflow Pages, Framer Pages, `uiforge-ai` (template khởi đầu).
- **Độ khó:** ⭐ · **Khả thi:** API `projects.addPage/updatePage/removePage` đã có.

## 1.12. Terminal / Console panel
- **Làm gì:** Chạy lệnh trong dự án ngay trong app (npm, dotnet, git) và xem output.
- **Bao gồm:** terminal nhiều tab, chọn shell, lịch sử lệnh, copy output, dừng tiến trình, mở terminal ngoài.
- **Tham khảo:** VS Code Terminal, Cursor, JetBrains.
- **Độ khó:** ⭐⭐ · **Khả thi:** `runner.ts` đã spawn process + stream log; cần thêm shell tương tác (PTY).

## 1.13. Git panel cơ bản
- **Làm gì:** Xem thay đổi, so sánh diff, commit, chuyển nhánh ngay trong app.
- **Bao gồm:** danh sách file thay đổi (staged/unstaged), diff theo dòng, commit message, tạo/chuyển nhánh, pull/push, xem log.
- **Tham khảo:** VS Code Source Control, GitHub Desktop, Cursor.
- **Độ khó:** ⭐⭐ · **Khả thi:** `fs.git` đã có; thêm IPC cho `git diff/commit/checkout`.

## 1.14. Giao diện Sáng/Tối & bảng phím tắt
- **Làm gì:** Chuyển theme sáng/tối, đổi màu nhấn; xem và tuỳ chỉnh phím tắt.
- **Bao gồm:** light/dark/system, accent color, độ tương phản, bảng cheat sheet, gán lại phím tắt, xung đột phím tắt.
- **Tham khảo:** VS Code Themes, Figma Appearance, Cursor.
- **Độ khó:** ⭐ · **Khả thi:** đã có CSS variables và theme.

## 1.15. Thư viện template khởi đầu
- **Làm gì:** Tạo dự án/ trang mới từ mẫu có sẵn thay vì trang trắng.
- **Bao gồm:** landing page, dashboard, portfolio, login, pricing; chọn framework (HTML/CSS, React, Razor); preview template; tạo file + route tự động.
- **Tham khảo:** Webflow Templates, Relume, Framer Templates, shadcn/ui blocks.
- **Độ khó:** ⭐⭐ · **Khả thi:** tái sử dụng catalog toolbox + `project:create-index-html`.

## 1.16. Trung tâm thông báo & lỗi
- **Làm gì:** Gom lỗi build, lỗi runtime, cảnh báo, thông báo vào một nơi.
- **Bao gồm:** notification center, mức độ (info/warn/error), lọc, đánh dấu đã đọc, nhảy tới file/dòng lỗi, copy lỗi.
- **Tham khảo:** VS Code Problems, Chrome DevTools Console.
- **Độ khó:** ⭐ · **Khả thi:** đã có `VisualErrorCard`, `errorParser`, log panel.

---

# CẤP 2 — TRUNG CẤP (mở rộng sức mạnh biên tập)

## 2.1. Bảng thuộc tính CSS nâng cao
- **Làm gì:** Chỉnh CSS trực quan đầy đủ hơn thay vì chỉ vài thuộc tính.
- **Bao gồm:** layout Flex/Grid (thêm/xoá item, gap, align), typography, border/shadow, position, transform, transition; trạng thái hover/focus/active; biến CSS; chỉnh theo breakpoint; reset về mặc định.
- **Tham khảo:** Webflow Style Panel, Framer, Figma Dev Mode, Pinegrow.
- **Độ khó:** ⭐⭐ · **Khả thi:** đã có inspect + applyStyle; mở rộng schema thuộc tính.

## 2.2. Breakpoint Manager
- **Làm gì:** Quản lý các điểm ngắt responsive và chỉnh style riêng cho từng breakpoint.
- **Bao gồm:** thêm/xoá/sửa breakpoint, thứ tự mobile-first, preview đồng thời nhiều breakpoint, ghi CSS vào đúng `@media`, cảnh báo xung đột.
- **Tham khảo:** Webflow Breakpoints, Bootstrap/Tailwind config.
- **Độ khó:** ⭐⭐ · **Khả thi:** kết hợp device frames + syncCode.

## 2.3. Interaction & Navigation Editor
- **Làm gì:** Định nghĩa hành vi khi click/hover/scroll mà không cần viết code.
- **Bao gồm:** trigger (click, hover, scroll, load), action (navigate, mở modal, scroll tới, toggle class, phát animation), điều kiện, thời gian trễ; preview ngay; sinh code tương ứng.
- **Tham khảo:** Webflow Interactions, Framer Interactions, Figma Prototype.
- **Độ khó:** ⭐⭐ · **Khả thi:** tận dụng `syncNav` + inspect; cần thêm runtime script inject.

## 2.4. Comment & Review pins
- **Làm gì:** Ghim bình luận tại đúng vị trí trên trang, trao đổi và đánh dấu đã xử lý.
- **Bao gồm:** pin theo toạ độ/element, thread trả lời, trạng thái open/resolved, filter, mention, lưu theo dự án, xuất danh sách comment.
- **Tham khảo:** Figma Comments, Webflow Comments, `uiforge-ai` (bình luận ghim).
- **Độ khó:** ⭐⭐ · **Khả thi:** overlay trong iframe + lưu JSON trong dự án.

## 2.5. Visual Diff & Change Review
- **Làm gì:** Xem trước chính xác mã sẽ đổi trước khi áp dụng, và duyệt từng thay đổi.
- **Bao gồm:** diff trước/sau, chấp nhận/từ chối từng hunk, áp dụng hàng loạt, xem ảnh hưởng tới file khác, lịch sử thay đổi.
- **Tham khảo:** GitHub Pull Request, Chromatic, `MutationDiffDialog` hiện có.
- **Độ khó:** ⭐⭐ · **Khả thi:** đã có diff modal; mở rộng thành review queue.

## 2.6. Snapshot & Rollback phiên bản
- **Làm gì:** Lưu ảnh chụp trạng thái dự án theo mốc thời gian và khôi phục khi cần.
- **Bao gồm:** snapshot thủ công/tự động, đặt tên, so sánh 2 snapshot, khôi phục toàn bộ hoặc từng file, xoá snapshot cũ.
- **Tham khảo:** Figma Version History, VS Code Local History, JetBrains Local History.
- **Độ khó:** ⭐⭐ · **Khả thi:** lưu bản sao file trong `userData` + metadata JSON.

## 2.7. Component/Part Manager
- **Làm gì:** Tạo part mới từ vùng chọn, quản lý vòng đời part trong toolbox.
- **Bao gồm:** tạo part từ element, nhập tên/nhóm/tags, sinh đủ 5 file (`meta.json`, `preview.png`, `sample.html`, `sample.css`, `prompt.txt`), sửa/xoá, versioning, trạng thái duyệt, tìm kiếm.
- **Tham khảo:** Storybook, shadcn/ui registry, `uiforge-ai` Search Toolbox.
- **Độ khó:** ⭐⭐ · **Khả thi:** `toolbox.ts` đã quét/đọc part; thêm luồng ghi.

## 2.8. Chẩn đoán dự án mở rộng
- **Làm gì:** Phát hiện sớm các vấn đề cấu trúc dự án.
- **Bao gồm:** route chết, link nội bộ hỏng, asset thiếu, file mồ côi, import sai, framework detect, thiếu script chạy, xung đột route.
- **Tham khảo:** Webflow Audit, Next.js build diagnostics, Lighthouse.
- **Độ khó:** ⭐⭐ · **Khả thi:** đã có `DiagnosisDialog` + `project:diagnose`.

## 2.9. SEO Inspector
- **Làm gì:** Kiểm tra và chỉnh các yếu tố SEO ngay trên trang.
- **Bao gồm:** title, meta description, canonical, Open Graph/Twitter card, heading hierarchy, alt ảnh, `robots.txt`/`sitemap.xml`, preview kết quả Google/Facebook.
- **Tham khảo:** Webflow SEO, Yoast, Chrome Lighthouse SEO.
- **Độ khó:** ⭐⭐ · **Khả thi:** đọc DOM iframe + sửa thẻ `<head>` qua syncCode.

## 2.10. Accessibility Checker
- **Làm gì:** Phát hiện lỗi tiếp cận (màu tương phản, thiếu alt, thiếu label, thứ tự heading…).
- **Bao gồm:** quét bằng axe-core, danh sách lỗi theo mức độ, highlight phần tử lỗi, gợi ý sửa, chạy lại sau khi sửa.
- **Tham khảo:** axe DevTools, Lighthouse Accessibility, WebAIM.
- **Độ khó:** ⭐⭐ · **Khả thi:** inject `axe-core` vào iframe; kết quả hiển thị ở panel.

## 2.11. Performance Panel
- **Làm gì:** Đo hiệu năng trang và gợi ý tối ưu.
- **Bao gồm:** thời gian tải, kích thước tài nguyên, số request, LCP/CLS/INP, ảnh quá lớn, JS/CSS không dùng, so sánh trước/sau.
- **Tham khảo:** Lighthouse, Chrome Performance, WebPageTest.
- **Độ khó:** ⭐⭐⭐ · **Khả thi:** dùng DevTools Protocol qua `webContents.debugger`.

## 2.12. Form & Data Binding
- **Làm gì:** Thiết kế form và xem trước luồng dữ liệu mà không cần backend thật.
- **Bao gồm:** tạo field, validation, trạng thái loading/success/error, mock API, bind dữ liệu mẫu, xem payload gửi đi.
- **Tham khảo:** Webflow Forms/Logic, Bubble, Retool.
- **Độ khó:** ⭐⭐⭐ · **Khả thi:** cần runtime + mock server nhỏ trong main process.

## 2.13. Component Variants & Props
- **Làm gì:** Tạo nhiều biến thể của một component và điều khiển bằng thuộc tính.
- **Bao gồm:** variant (size/color/state), property controls, default value, chuyển đổi trong canvas, sinh code props tương ứng.
- **Tham khảo:** Figma Variants, Storybook Args, shadcn/ui.
- **Độ khó:** ⭐⭐⭐ · **Khả thi:** cần mô hình hoá component ở giữa toolbox và DOM.

## 2.14. Import / Export dự án
- **Làm gì:** Đưa giao diện từ ngoài vào hoặc xuất dự án ra để dùng tiếp.
- **Bao gồm:** import HTML/zip/Figma (qua file JSON), export static site (zip), export component React/Vue, export ảnh, export báo cáo.
- **Tham khảo:** Figma Dev Mode, Locofy, Anima, Webflow Export.
- **Độ khó:** ⭐⭐⭐ · **Khả thi:** export HTML/zip dễ; import Figma cần parser/API.

## 2.15. Multi-framework Adapter
- **Làm gì:** Hiểu và đồng bộ điều hướng/style cho nhiều framework khác nhau.
- **Bao gồm:** adapter cho Next.js (App/Pages Router), Nuxt, Angular, SvelteKit, Blazor, Laravel Blade, Django; phát hiện framework tự động; map route tương ứng.
- **Tham khảo:** Webstudio, Builder.io, Locofy.
- **Độ khó:** ⭐⭐⭐ · **Khả thi:** hiện đã có nền tảng ASP.NET/HTML/JSX/Vue/Svelte; mở rộng theo adapter.

## 2.16. Plugin / Extension API
- **Làm gì:** Cho phép mở rộng app bằng plugin do người dùng viết.
- **Bao gồm:** API đăng ký command/panel/menu, sandbox chạy plugin, marketplace nội bộ, cài/bật/tắt plugin.
- **Tham khảo:** Figma Plugins, VS Code Extensions, Obsidian Plugins.
- **Độ khó:** ⭐⭐⭐ · **Khả thi:** cần thiết kế API ổn định + sandbox bảo mật.

---

# CẤP 3 — NÂNG CAO (khác biệt hoá sản phẩm)

## 3.1. AI Assistant Panel
- **Làm gì:** Trợ lý AI hiểu dự án để sửa giao diện/code bằng ngôn ngữ tự nhiên.
- **Bao gồm:** chat theo ngữ cảnh, chọn ngữ cảnh gửi đi (file, vùng chọn, ảnh mẫu, comment, design tokens), preview diff trước khi áp dụng, áp dụng/từ chối, lịch sử hội thoại, nhiều model/provider.
- **Tham khảo:** Cursor, v0, Figma AI, `uiforge-ai` (AIPanel 6 tab), kế hoạch Multi-Bridge.
- **Độ khó:** ⭐⭐⭐ · **Khả thi:** cần IPC gọi API + quản lý key an toàn (đã có `Security_Plan_UIForge.md`).

## 3.2. Vòng lặp AI sửa lỗi tự động
- **Làm gì:** Khi build/runtime lỗi, AI đọc log → đề xuất patch → áp dụng → chạy lại → kiểm tra cho tới khi hết lỗi.
- **Bao gồm:** thu thập lỗi, phân loại, đề xuất nguyên nhân, patch từng bước, giới hạn số vòng, báo cáo kết quả, luôn có diff để duyệt.
- **Tham khảo:** Cursor Agent, GitHub Copilot Workspace, Antigravity.
- **Độ khó:** ⭐⭐⭐ · **Khả thi:** tận dụng log + syncCode + AI panel.

## 3.3. Ảnh/Thiết kế → Code
- **Làm gì:** Tải ảnh thiết kế lên và sinh HTML/CSS hoặc component tương ứng.
- **Bao gồm:** upload ảnh, nhận diện bố cục, sinh code, chọn framework, so sánh ảnh gốc với kết quả, chỉnh bằng chat.
- **Tham khảo:** Locofy, Anima, v0, Builder.io Visual Copilot.
- **Độ khó:** ⭐⭐⭐ · **Khả thi:** phụ thuộc model vision; cần pipeline ảnh → DOM.

## 3.4. AI tạo theme & nội dung
- **Làm gì:** Sinh bảng màu, typography, spacing và nội dung mẫu theo mô tả.
- **Bao gồm:** prompt tạo design system, preview token, áp dụng vào CSS/Tailwind, sinh copy cho landing page, đa ngôn ngữ.
- **Tham khảo:** Figma AI, Framer AI, Relume, v0.
- **Độ khó:** ⭐⭐ · **Khả thi:** đã có `tokens.save`; thêm generator.

## 3.5. Cộng tác thời gian thực
- **Làm gì:** Nhiều người cùng mở dự án, thấy con trỏ/thao tác của nhau.
- **Bao gồm:** presence, cursor, selection, comment realtime, khoá mềm khi sửa, lịch sử hoạt động, phân quyền.
- **Tham khảo:** Figma Multiplayer, Framer, Liveblocks, Yjs.
- **Độ khó:** ⭐⭐⭐ · **Khả thi:** cần server + CRDT; nên tách giai đoạn riêng.

## 3.6. Cloud Sync & Team Workspace
- **Làm gì:** Đồng bộ dự án, cài đặt, part, snapshot lên cloud và làm việc nhóm.
- **Bao gồm:** đăng nhập, đồng bộ, xung đột, chia sẻ dự án, quyền xem/sửa, lịch sử hoạt động.
- **Tham khảo:** Figma Cloud, Webflow Teams, GitHub.
- **Độ khó:** ⭐⭐⭐ · **Khả thi:** cần backend/auth; có thể bắt đầu bằng export/import.

## 3.7. Design System Manager & Publish
- **Làm gì:** Quản lý token/component như một sản phẩm và phát hành cho team.
- **Bao gồm:** token (màu, chữ, spacing, radius, shadow), component catalog, tài liệu tự sinh, versioning, publish, import vào dự án khác.
- **Tham khảo:** Storybook, Figma Design System, Zeroheight, shadcn/ui.
- **Độ khó:** ⭐⭐⭐ · **Khả thi:** mở rộng `tokens` + toolbox.

## 3.8. Animation & Timeline Editor
- **Làm gì:** Tạo animation/transition trực quan và xem ngay.
- **Bao gồm:** keyframe, timeline, easing, trigger, preview phát lại, sinh CSS/JS animation.
- **Tham khảo:** Framer Motion, Webflow Interactions, After Effects.
- **Độ khó:** ⭐⭐⭐ · **Khả thi:** inject runtime + ghi CSS `@keyframes`.

## 3.9. Prototype / State Machine
- **Làm gì:** Mô phỏng luồng nhiều bước và trạng thái màn hình.
- **Bao gồm:** state, event, transition, flow map, chạy thử trong canvas, chia sẻ link prototype.
- **Tham khảo:** Figma Prototype, Framer, InVision.
- **Độ khó:** ⭐⭐⭐ · **Khả thi:** mở rộng Multi-Page Canvas + Interaction Editor.

## 3.10. CMS / Content Modeling
- **Làm gì:** Định nghĩa kiểu nội dung và bind vào giao diện.
- **Bao gồm:** model (bài viết, sản phẩm), field, quan hệ, dữ liệu mẫu, bind vào component, preview danh sách/chi tiết.
- **Tham khảo:** Webflow CMS, Builder.io, Contentful.
- **Độ khó:** ⭐⭐⭐ · **Khả thi:** cần schema + renderer; có thể bắt đầu bằng JSON cục bộ.

## 3.11. Deploy & Preview URL
- **Làm gì:** Xuất bản dự án lên hosting và chia sẻ link xem trước.
- **Bao gồm:** chọn provider (Vercel/Netlify/GitHub Pages), build, deploy, preview URL, log deploy, rollback.
- **Tham khảo:** Vercel, Netlify, Webflow Publish.
- **Độ khó:** ⭐⭐⭐ · **Khả thi:** cần CLI/token; có thể làm bản GitHub Pages trước.

## 3.12. Testing & Visual Regression
- **Làm gì:** Ghi lại thao tác và kiểm tra giao diện không bị lệch sau khi sửa.
- **Bao gồm:** record/replay Playwright, snapshot ảnh, so sánh pixel, báo cáo lệch, chạy theo CI.
- **Tham khảo:** Playwright, Chromatic, Percy.
- **Độ khó:** ⭐⭐⭐ · **Khả thi:** dùng Playwright + ảnh chụp hiện có.

## 3.13. Marketplace nội bộ
- **Làm gì:** Chia sẻ part, template, theme giữa các dự án/người dùng.
- **Bao gồm:** duyệt/tìm kiếm, preview, cài đặt, version, license, đánh giá.
- **Tham khảo:** Figma Community, Webflow Marketplace, shadcn/ui registry.
- **Độ khó:** ⭐⭐⭐ · **Khả thi:** bắt đầu bằng kho part cục bộ có metadata.

## 3.14. Phân quyền, xác thực & bản quyền
- **Làm gì:** Quản lý người dùng, vai trò và giấy phép sử dụng.
- **Bao gồm:** đăng nhập, role (owner/editor/viewer), license key, giới hạn tính năng, audit log.
- **Tham khảo:** Figma Plans, Webflow Roles, `uiforge-ai` (màn Người dùng/Giấy phép).
- **Độ khó:** ⭐⭐⭐ · **Khả thi:** cần backend; có thể làm local license trước.

## 3.15. Analytics / Heatmap / Session Replay
- **Làm gì:** Hiểu người dùng tương tác với giao diện thế nào.
- **Bao gồm:** heatmap click/scroll, session replay, funnel, so sánh trang.
- **Tham khảo:** Hotjar, Microsoft Clarity, PostHog.
- **Độ khó:** ⭐⭐⭐ · **Khả thi:** cần thu thập dữ liệu runtime + backend.

## 3.16. Multi-Agent / AI Bridge
- **Làm gì:** Kết nối PixelMind với IDE/CLI/agent bên ngoài để tự động hoá quy trình.
- **Bao gồm:** MCP/WebSocket bridge, gửi ngữ cảnh dự án, nhận patch, hàng đợi tác vụ, log, phê duyệt.
- **Tham khảo:** `Ke_hoach_NextSteps_UIForge.md` (Multi-Bridge), Antigravity, Cursor, Claude Code.
- **Độ khó:** ⭐⭐⭐ · **Khả thi:** đã có kế hoạch kiến trúc; cần làm theo giai đoạn.

## 3.17. Xuất báo cáo / tài liệu dự án
- **Làm gì:** Sinh báo cáo tiến độ, danh sách trang, component, token, lỗi, thay đổi.
- **Bao gồm:** chọn mẫu báo cáo, phạm vi thời gian, xuất Markdown/PDF/HTML, đính kèm ảnh chụp, thống kê.
- **Tham khảo:** Notion, Linear reports, GitHub Insights.
- **Độ khó:** ⭐⭐ · **Khả thi:** tổng hợp dữ liệu đã có (git, trang, token, diff).

---

# 4. Lộ trình gợi ý

### Giai đoạn 1 — Hoàn thiện trải nghiệm biên tập (2–4 tuần)
1.1 Khung thiết bị · 1.2 Chụp/xuất ảnh · 1.4 Code editor · 1.5 Tab tài liệu · 1.6 Tìm kiếm toàn cục · 1.7 Lịch sử thao tác · 1.8 Smart guides · 1.11 Quản lý trang · 1.12 Terminal · 1.13 Git panel.

### Giai đoạn 2 — Nâng cao khả năng thiết kế & kiểm tra (1–2 tháng)
2.1 CSS nâng cao · 2.2 Breakpoint · 2.3 Interaction editor · 2.4 Comment pins · 2.5 Visual diff · 2.6 Snapshot · 2.7 Part manager · 2.8 Chẩn đoán · 2.9 SEO · 2.10 Accessibility · 2.14 Export.

### Giai đoạn 3 — Khác biệt hoá bằng AI & cộng tác (2–3 tháng)
3.1 AI Assistant · 3.2 AI sửa lỗi · 3.3 Ảnh → Code · 3.8 Animation editor · 3.9 Prototype · 3.11 Deploy · 3.16 AI Bridge.

---

# 5. Bảng tham chiếu nhanh

| Nhóm | Sản phẩm/dự án tham khảo | Chức năng nên học hỏi |
|---|---|---|
| Thiết kế & prototype | Figma | Frame, Variants, Smart Guides, Comments, Prototype, Version History |
| Web builder | Webflow | Style Panel, Breakpoints, Interactions, CMS, SEO, Publish |
| Web builder | Framer | Responsive, Animation, CMS, Publish |
| Visual dev | Webstudio, Builder.io | Visual editing, code sync, component mapping |
| Code editor | VS Code, Cursor | Tabs, Search, Git, Terminal, AI, Problems |
| Component | Storybook, shadcn/ui | Catalog, variants, docs, registry |
| Chất lượng | Lighthouse, axe DevTools, Chromatic | Performance, Accessibility, Visual regression |
| AI | v0, Locofy, Anima, Copilot | Ảnh → code, chat sửa code, agent |
| Dự án nội bộ | `uiforge-ai` + các file kế hoạch | AIPanel, 5 chế độ xem, 6 công cụ vẽ, 4 khung thiết bị, comment, so sánh, chụp, Multi-Bridge |

---

# 6. Ghi chú khả thi kỹ thuật

- **Tận dụng được ngay:** `fs.*`, `run.*`, `inspect.*` (`applyStyle`, `syncCode`, `syncNav`, `locateSource`), `tokens.*`, `toolbox.*`, `projects.*` đã có IPC ổn định.
- **Chức năng chỉ cần renderer:** device frames, tab, search UI, comment pins, history panel, theme, phím tắt.
- **Chức năng cần main process:** screenshot, terminal PTY, git thao tác ghi, file watching, AI API (để giữ key an toàn).
- **Chức năng cần hạ tầng mới:** collaboration realtime, cloud sync, marketplace, deploy, analytics.
- **Ưu tiên bảo mật:** mọi lệnh shell/git/AI phải đi qua main process, validate input, không nhận lệnh tuỳ ý từ renderer (tham khảo `Security_Plan_UIForge.md`).
- **Nguyên tắc chọn làm trước:** chức năng nào dùng lại được API hiện có + tăng trải nghiệm hằng ngày (device, screenshot, editor, search, history, git) thì làm trước; chức năng cần server/AI nên tách giai đoạn.

---

*Tài liệu chỉ để tham khảo và lên kế hoạch; không thay đổi mã nguồn dự án.*
