# PixelMind Desktop — Audit tính năng và checklist cho 2 dev

> **Ngày rà soát:** 12/11/2026  
> **Phạm vi:** `pixelmind-desktop` (Electron \+ Vite \+ React \+ TypeScript)  
> **Kiểm tra:** Đọc mã nguồn `src/`, `electron/`, `shared/`; `npm run typecheck` đạt.  
> **Tham khảo:** `pixelmind-feature-audit-roadmap.md`. Không tìm thấy `.opencode/plan` ở thư mục dự án hoặc thư mục cha trực tiếp.

## 1\. Kết luận nhanh

Dự án đã có nền tảng chạy ứng dụng desktop, quản lý dự án, IDE, Canvas chỉnh sửa giao diện, Git, terminal và các luồng AI chính. **Chưa thể xem là hoàn chỉnh theo toàn bộ kế hoạch tính năng**: còn các mục đã có UI nhưng chưa nối hành vi thật, các tính năng mới chỉ ở mức MVP và nhiều tính năng chưa được triển khai.

`npm run typecheck` đạt tại thời điểm rà soát; đây không thay thế kiểm thử chức năng, kiểm thử build hoặc kiểm thử trên từng framework. Các mục dưới đây đánh giá dựa trên hiện trạng mã nguồn, không xác nhận mọi hành vi đã được QA trên máy người dùng.

**Trạng thái:** `[x] Đã làm` · `[~] Đã làm một phần / cần hoàn thiện` · `[ ] Chưa làm`

## 2\. Kiểm kê hiện trạng

### Đã làm

- [x] Mở, lưu, yêu thích và xoá dự án; lưu dữ liệu ứng dụng.  
- [x] Nhận diện nhiều loại framework/package manager; chạy, dừng, cài dependencies và chạy lệnh tùy chỉnh.  
- [x] Chẩn đoán dự án, phân tích log lỗi và hiển thị hướng xử lý.  
- [x] Menu desktop, phím tắt, theme, Settings, hướng dẫn và Command Palette cho lệnh/tệp.  
- [x] Sidebar Files/Layers/Pages/Assets/Versions/Design/Toolbox; thao tác tệp, trang và tài nguyên cơ bản.  
- [x] Monaco Editor, lưu tệp, auto-save theo cài đặt, undo/redo và diff theo từng hunk.  
- [x] Canvas live inspector; sửa style/text, định vị mã nguồn, ghi thay đổi về tệp, resize/move và thao tác nhiều phần tử.  
- [x] Flex/Grid editor gồm căn chỉnh, điều khiển grid track và các thao tác căn lề/phân bổ.  
- [x] Multi-Page Canvas và liên kết điều hướng cơ bản giữa trang.  
- [x] Terminal tương tác PTY trong ứng dụng.  
- [x] Git Graph và Git working tree: stage/unstage, commit, push/pull, branch/checkout, rollback có backup.  
- [x] Tìm nội dung tệp cơ bản (literal, phân biệt hoa thường tùy chọn) và nhảy đến dòng.  
- [x] AI Panel, AI Gateway/CLI/WebSocket bridge, sửa lỗi theo vòng lặp, Design-to-Code và tạo theme.  
- [x] Ảnh mẫu và overlay có chỉnh opacity; ảnh mẫu có zoom/pan/fit.

### Đã làm một phần / chưa nối đủ

- \[\~\] **So sánh thiết kế:** có ảnh mẫu và lớp overlay opacity; chưa có split slider và chế độ pixel-difference.  
- \[\~\] **Tìm kiếm:** có tìm tên tệp, route, asset và nội dung literal; chưa có Regex/whole-word/glob và tìm nội dung trong Command Palette.  
- \[\~\] **Lưu trạng thái Workspace:** đã lưu trạng thái bật/tắt một số panel; chưa lưu đầy đủ kích thước panel và danh sách file tab để khôi phục.  
- \[\~\] **Settings:** auto-save đã có hành vi. `canvasGrid` ghi trạng thái lên document nhưng chưa thấy CSS dùng trạng thái đó; `preferredPort`, `confirmQuitRunning`, `smartGuides`, `hoverOutline`, `syncCanvasToTree` chưa được nối đầy đủ tới hành vi tương ứng.  
- \[\~\] **AI Sidecar:** component đã có nhưng chưa được gắn vào Canvas để gọi AI ngay trên phần tử.  
- \[\~\] **Tailwind:** có tạo token và chuyển đổi class/style ở một số luồng; cần xác minh và hoàn thiện đồng bộ hai chiều cho các thao tác chỉnh sửa trên Canvas.  
- \[\~\] **Design Tokens/Breakpoint:** token hiện có; chưa có breakpoint tùy biến và quản lý CSS variable theo phần tử.  
- \[\~\] **Cloud:** có Supabase client cấu hình theo biến môi trường; chưa có luồng đăng nhập, schema/sync hoặc cộng tác.  
- \[\~\] **Hỗ trợ framework:** nhận diện/chạy nhiều framework; thao tác AST/code-sync không đồng đều giữa các framework.

### Chưa làm

- [ ] Trung tâm lịch sử thông báo; thư viện template; import/export dự án ZIP/HTML.  
- [ ] Tối ưu ảnh và quản lý `alt`; tạo component/part có props từ vùng chọn.  
- [ ] SEO Inspector; Accessibility Checker; Performance Panel; Mock API.  
- [ ] Multi-Viewport đồng thời; rulers/smart guides/snapping; state switcher; eyedropper.  
- [ ] Annotation pins; xuất screenshot PNG/PDF; visual regression.  
- [ ] Animation timeline và prototype event/action state machine.  
- [ ] Deploy/Preview URL; báo cáo tổng hợp; plugin API.

## 3\. Quy ước chia việc để giảm xung đột

Không thể cam kết “không bao giờ xung đột” nếu cả hai cùng sửa một tệp. Dùng quy ước **một người sở hữu mỗi tệp tích hợp**:

| Phạm vi | Dev 1 sở hữu | Dev 2 sở hữu |
| :---- | :---- | :---- |
| Tệp tích hợp/chung | `src/App.tsx`, `src/components/WorkspaceView.tsx`, `shared/api.ts`, `shared/types.ts`, `electron/preload/index.ts`, `electron/main/index.ts` | Không sửa; gửi yêu cầu interface/IPC cho Dev 1 |
| IDE và tính năng dự án | `electron/main/projects.ts`, `runner.ts`, `toolbox.ts`; `src/components/WorkspaceSidebar.tsx`, `ProjectView.tsx`, `CommandPalette.tsx`, `SettingsDialog.tsx`, `LogPanel.tsx`, `VersionsTab.tsx`, `src/components/ide/**`, `src/lib/layoutPrefs.ts`, `src/styles/desktop.css`, `src/styles/sidebar.css` | Không sửa |
| Canvas | Không sửa `CanvasArea.tsx` hoặc `src/components/canvas/**` | `src/components/CanvasArea.tsx`, `src/components/AISidecar.tsx`, `src/components/MultiPageCanvas.tsx`, `src/components/canvas/**`, `src/styles/canvas.css`, `src/styles/multiPageCanvas.css` |
| Backend riêng theo tính năng | IPC/main và dữ liệu dùng chung | Có thể tạo module backend độc lập trong `electron/main/canvas*.ts`; Dev 1 đăng ký module/IPC ở `electron/main/index.ts` và cập nhật hợp đồng chung |

**Nguyên tắc làm việc**

1. Tách nhánh riêng: `feat/dev1-ide-platform` và `feat/dev2-canvas`.  
2. Mỗi tính năng là một PR/tác vụ riêng. Không sửa tệp ngoài danh sách sở hữu; nếu cần thay đổi hợp đồng chung, ghi rõ đề xuất API và chờ Dev 1 tích hợp.  
3. Dev 1 là người duy nhất chỉnh các điểm nối chung. Dev 2 bàn giao component/module độc lập cùng interface đề xuất; Dev 1 tích hợp sau khi module chạy.  
4. Chạy `npm run typecheck` trước khi merge; kiểm thử trực tiếp chức năng và báo các bước đã kiểm thử trong PR.  
5. Các đầu việc phụ thuộc nhau được ghi rõ trong mô tả; không gộp nhiều tính năng chỉ vì chúng dùng chung một tệp.

## 4\. Checklist Dev 1 — IDE, dịch vụ dự án và tích hợp chung

### P0 — Hoàn thiện hành vi hiện có

- [ ] **D1-01 — Áp dụng cổng ưu tiên khi chạy dự án.** Đọc `preferredPort` từ Settings, truyền đúng cổng vào lệnh/env theo loại runner; xử lý cổng bận với thông báo rõ ràng và không làm hỏng chế độ tự chọn cổng. **Nghiệm thu:** đặt cổng, chạy dự án và xác nhận URL/cổng thực tế; thử cổng đang bị chiếm.  
- [ ] **D1-02 — Xác nhận trước khi thoát khi còn tiến trình chạy.** Dùng `confirmQuitRunning` để hỏi người dùng trước khi thoát/đóng cửa sổ khi runner còn tiến trình; lựa chọn ở lại không được dừng server. **Nghiệm thu:** kiểm tra bật/tắt setting và cả trường hợp không có tiến trình.  
- [ ] **D1-03 — Tìm kiếm nội dung Regex và whole-word.** Mở rộng tìm kiếm nội dung hiện có để có chế độ regex, whole-word, xử lý regex sai có thông báo và giữ giới hạn kết quả. **Nghiệm thu:** tìm chuỗi thường, regex, whole-word, chữ hoa/thường và regex không hợp lệ.  
- [ ] **D1-04 — Lọc tìm kiếm theo include/exclude glob.** Cho phép giới hạn phần mở rộng/thư mục được tìm và loại trừ thư mục/tệp; mặc định tiếp tục bỏ qua thư mục build/dependency. **Nghiệm thu:** tìm chỉ trong `*.tsx`, loại `src/generated/**`, xác nhận không quét `node_modules`.  
- [ ] **D1-05 — Tìm nội dung từ Command Palette.** Thêm truy vấn nội dung có cú pháp dễ nhận biết, hiển thị kết quả giới hạn kèm file/dòng và mở đúng vị trí trong editor. **Nghiệm thu:** tìm một đoạn code từ palette, mở đúng file và dòng; xử lý trạng thái không có kết quả.  
- [ ] **D1-06 — Khôi phục kích thước các panel Workspace.** Lưu và khôi phục kích thước sidebar, panel phải, panel dưới và AI panel theo dự án; bảo vệ giá trị lỗi/ngoài giới hạn. **Nghiệm thu:** đổi kích thước, khởi động lại ứng dụng và kiểm tra panel về đúng kích thước đã lưu.  
- [ ] **D1-07 — Khôi phục các file tab đang mở.** Lưu danh sách tab theo dự án và tab đang chọn; khi khôi phục, xử lý file đã bị xóa/không còn truy cập được. **Nghiệm thu:** mở nhiều file, khởi động lại, kiểm tra tab hợp lệ khôi phục và tab lỗi không làm treo Workspace.  
- [ ] **D1-08 — Truyền cấu hình Settings vào Workspace/Canvas.** Hoàn thiện đường truyền các tùy chọn `smartGuides`, `hoverOutline`, `syncCanvasToTree` qua điểm tích hợp để Dev 2 tiêu thụ; không tự triển khai hành vi Canvas trong phần việc này. **Nghiệm thu:** thay đổi setting được cập nhật tức thời và không cần khởi động lại.

### P1 — Quản lý thông báo, template và tài nguyên

- [ ] **D1-09 — Trung tâm lịch sử thông báo.** Lưu tối đa 50 toast, trạng thái đã đọc, lọc theo loại, sao chép lỗi, đánh dấu đã đọc và xóa lịch sử. **Nghiệm thu:** toast đã đóng vẫn xem lại được; giới hạn lịch sử hoạt động.  
- [ ] **D1-10 — Thư viện template khởi tạo dự án.** Cung cấp các template có cấu trúc tệp rõ ràng; người dùng chọn template và thư mục đích để tạo dự án mới. **Nghiệm thu:** dự án tạo ra mở được trong PixelMind và chạy theo hướng dẫn của template.  
- [ ] **D1-11 — Nhập dự án từ ZIP.** Chọn ZIP, kiểm tra nội dung/đường dẫn an toàn, giải nén vào thư mục đích và đăng ký dự án. **Nghiệm thu:** ZIP hợp lệ được mở thành dự án; ZIP lỗi/đường dẫn traversal bị từ chối có thông báo.  
- [ ] **D1-12 — Nhập thư mục HTML tĩnh.** Chọn thư mục có HTML/CSS/JS tĩnh và đăng ký thành dự án mà không yêu cầu `package.json`. **Nghiệm thu:** dự án mở được và dùng luồng static server hiện có.  
- [ ] **D1-13 — Xuất dự án ZIP.** Cho phép chọn đường dẫn lưu, loại trừ dependency, VCS và artifact build, không thay đổi tệp nguồn. **Nghiệm thu:** ZIP giải nén được, chạy được sau khi cài dependencies; hiển thị lỗi ghi file.  
- [ ] **D1-14 — Tối ưu ảnh trong Assets.** Tạo thao tác tối ưu ảnh có chọn định dạng/chất lượng và xem dung lượng trước/sau; không ghi đè ảnh gốc nếu người dùng chưa xác nhận. **Nghiệm thu:** ảnh đầu ra mở được, dung lượng/thông số hiển thị đúng.  
- [ ] **D1-15 — Kiểm tra và quản lý thuộc tính `alt`.** Quét ảnh trong mã nguồn, liệt kê ảnh thiếu alt và dẫn tới vị trí file/dòng; hỗ trợ sửa có xác nhận. **Nghiệm thu:** kiểm tra HTML/JSX phổ biến, không báo nhầm ảnh nền CSS là thẻ `img`.  
- [ ] **D1-16 — Tạo Part từ vùng chọn.** Lưu đoạn HTML/JSX được chọn thành Part có tên và mô tả, đồng thời dùng được trong Toolbox hiện có. **Nghiệm thu:** tạo Part, tìm thấy trong Toolbox và chèn lại được vào trang.  
- [ ] **D1-17 — Khai báo Variants/Props cho Part.** Cho phép định nghĩa các biến thể/props được hỗ trợ và áp dụng chúng khi chèn Part. **Nghiệm thu:** chọn variant khác nhau sinh đúng đầu ra; dữ liệu Part cũ vẫn đọc được.

### P2 — Chất lượng web và dữ liệu thử nghiệm

- [ ] **D1-18 — SEO Inspector.** Phân tích title, description, canonical, Open Graph, heading và alt; chỉ rõ vị trí/vấn đề, hiển thị preview thẻ chia sẻ. **Nghiệm thu:** phân biệt lỗi thiếu thẻ và giá trị sai; không đưa ra điểm số nếu không giải thích cách tính.  
- [ ] **D1-19 — Accessibility Checker.** Chạy axe-core trên trang preview cùng DOM có quyền truy cập; nhóm lỗi theo mức độ, hiển thị selector và hướng dẫn. **Nghiệm thu:** bắt được các lỗi phổ biến; trạng thái không truy cập được DOM được thông báo thay vì báo “không có lỗi”.  
- [ ] **D1-20 — Performance Panel.** Đo thời gian tải và tài nguyên trang preview, nhóm theo loại và chỉ ra tài nguyên nặng. **Nghiệm thu:** ghi rõ giới hạn số liệu khi trang không cho phép đo; không coi số liệu thiếu là 0\.  
- [ ] **D1-21 — Mock API cho dự án thử nghiệm.** Cho phép cấu hình endpoint/phương thức/JSON response và khởi động dịch vụ mock có kiểm soát cổng. **Nghiệm thu:** frontend dự án gọi endpoint mẫu nhận đúng status/body; dừng mock giải phóng cổng.  
- [ ] **D1-22 — Báo cáo kiểm tra dự án.** Xuất kết quả SEO, Accessibility, Performance và thiết kế thành Markdown hoặc HTML có thời điểm và thông tin dự án. **Nghiệm thu:** file xuất mở được và ghi rõ mục nào chưa chạy.

### P3 — Cloud và mở rộng sản phẩm

- [ ] **D1-23 — Đăng nhập Supabase.** Tạo luồng đăng nhập/đăng xuất với lỗi xác thực và trạng thái phiên rõ ràng; không lưu secret trong renderer/repository. **Nghiệm thu:** dùng cấu hình hợp lệ đăng nhập được; thiếu cấu hình không tạo phiên giả.  
- [ ] **D1-24 — Đồng bộ Settings và Design Tokens lên cloud.** Xác định schema, phiên bản dữ liệu, xử lý xung đột và đồng bộ có xác nhận. **Nghiệm thu:** đồng bộ hai chiều giữa hai phiên đăng nhập; lỗi mạng không làm mất dữ liệu cục bộ.  
- [ ] **D1-25 — Chia sẻ Workspace theo quyền.** Thêm vai trò Owner/Editor/Viewer và xác thực quyền ở dịch vụ, không chỉ ẩn nút trên giao diện. **Nghiệm thu:** Viewer không thể ghi dữ liệu qua API.  
- [ ] **D1-26 — Deploy/Preview URL.** Tích hợp nhà cung cấp deploy theo cấu hình người dùng, hiển thị tiến trình/lỗi và lưu URL triển khai. **Nghiệm thu:** không ghi token vào log; lỗi CLI/network được báo cụ thể.  
- [ ] **D1-27 — Plugin API tối thiểu.** Đọc manifest plugin có schema/phiên bản, chỉ nạp plugin được cho phép và cung cấp danh sách tool/snippet. **Nghiệm thu:** plugin hợp lệ được hiển thị; manifest lỗi hoặc plugin không tin cậy bị từ chối.  
- [ ] **D1-28 — Tailwind sync hai chiều từ Canvas.** Hoàn thiện áp dụng class Tailwind khi sửa style và khôi phục đúng style khi đọc lại; giữ inline fallback nếu không chuyển đổi được. **Nghiệm thu:** sửa các thuộc tính được hỗ trợ trong Canvas, lưu, tải lại và kiểm tra class/style không mất hoặc nhân đôi.

## 5\. Checklist Dev 2 — Canvas và tương tác trực quan

### P0 — Hoàn thiện công cụ Canvas hiện có

- [ ] **D2-01 — Split slider so sánh Live với ảnh mẫu.** Hiển thị ảnh và trang Live đồng thời, kéo đường chia trước/sau; xử lý thay đổi kích thước viewport. **Nghiệm thu:** kéo được toàn dải, ảnh không bị lệch tỷ lệ so với khung.  
- [ ] **D2-02 — Difference mode.** Tạo chế độ so sánh sai khác hình ảnh trên cùng route/viewport và hiển thị vùng khác biệt; không chỉ áp `mix-blend-mode` lên hai lớp không được căn chỉnh. **Nghiệm thu:** ảnh giống nhau cho kết quả ít sai khác; đổi màu/vị trí tạo vùng báo khác biệt.  
- [ ] **D2-03 — Gắn AI Sidecar vào phần tử đang chọn.** Mở Sidecar từ nút cạnh khung chọn hoặc phím tắt; gửi ngữ cảnh phần tử; hỗ trợ preview, hoàn tác và đồng bộ code. **Nghiệm thu:** thử chọn phần tử, đề nghị đổi style, xem trước, hoàn tác và lưu xuống file.  
- [ ] **D2-04 — Điều khiển viền hover bằng setting.** Ẩn/hiện viền hover theo `hoverOutline` đã được Dev 1 truyền xuống. **Nghiệm thu:** bật/tắt setting đổi hành vi ngay cả khi đang Inspect.  
- [ ] **D2-05 — Đồng bộ lựa chọn Canvas với Layers.** Khi chọn phần tử trên Canvas, cập nhật lựa chọn và cuộn Layers tới đúng node theo `syncCanvasToTree`. **Nghiệm thu:** phần tử lồng sâu được đưa vào vùng nhìn và tắt setting thì không tự cuộn.  
- [ ] **D2-06 — Hiển thị/tắt lưới Canvas theo setting.** Dùng trạng thái `canvasGrid` hiện có để bật/tắt lưới nền trên vùng Canvas. **Nghiệm thu:** đổi setting cập nhật lưới ngay, không ảnh hưởng lưới trong ảnh chụp trang.  
- [ ] **D2-07 — Smart guides và snapping.** Khi kéo/resize, gióng theo cạnh/tâm phần tử liên quan, hiển thị khoảng cách và snap trong ngưỡng nhỏ có thể kiểm soát. **Nghiệm thu:** guides bám đúng tọa độ khi zoom; không làm thay đổi vị trí ngoài dự kiến sau khi thả.  
- [ ] **D2-08 — Rulers Canvas.** Hiển thị thước X/Y và chỉ báo vị trí con trỏ, đồng bộ với zoom/pan. **Nghiệm thu:** khoảng chia đúng theo pixel của viewport ở nhiều mức zoom.

### P1 — Kiểm soát trạng thái và viewport

- [ ] **D2-09 — Multi-Viewport đồng thời.** Hiển thị Mobile/Tablet/Desktop cùng lúc bằng route hiện tại và nhãn kích thước. **Nghiệm thu:** ba viewport chạy ổn định, mỗi khung có kích thước đúng.  
- [ ] **D2-10 — Đồng bộ route/scroll giữa viewport.** Chuyển route và cuộn đồng bộ theo thiết lập người dùng. **Nghiệm thu:** route giữ nhất quán; scroll đồng bộ theo tỷ lệ, không tạo vòng lặp sự kiện.  
- [ ] **D2-11 — State Switcher.** Xem/chỉnh trạng thái `:hover`, `:focus`, `:active`, `:disabled` mà không cần thao tác chuột/bàn phím thật lên phần tử. **Nghiệm thu:** trạng thái giả lập có thể thoát và không bị ghi nhầm vào source code.  
- [ ] **D2-12 — Eyedropper.** Hút màu từ vùng Canvas hỗ trợ, hiển thị mã màu và cho phép áp dụng vào thuộc tính/token phù hợp. **Nghiệm thu:** trường hợp API không hỗ trợ/quyền bị từ chối có hướng dẫn.  
- [ ] **D2-13 — Breakpoint Manager.** Tạo/sửa/xóa breakpoint riêng và dùng ngay trong bộ chọn viewport. **Nghiệm thu:** giá trị lưu hợp lệ, không trùng gây lỗi và mặc định hiện có không bị mất.  
- [ ] **D2-14 — CSS Variables theo phần tử.** Hiển thị biến CSS đang áp dụng và cho gán token thay cho giá trị cứng trong Inspector. **Nghiệm thu:** áp dụng biến lưu được vào mã nguồn hoặc báo rõ khi framework không hỗ trợ.

### P2 — Review và kiểm thử hình ảnh

- [ ] **D2-15 — Annotation pins.** Đặt pin theo tọa độ tương đối của Canvas, thêm/sửa/resolve/xóa ghi chú và lưu theo dự án. **Nghiệm thu:** pin giữ đúng vị trí khi đổi kích thước viewport và mở lại dự án.  
- [ ] **D2-16 — Xuất ảnh PNG.** Chụp trang/viewport hoặc phần tử được chọn với kích thước đầu ra đã chọn. **Nghiệm thu:** ảnh có đủ nội dung mong muốn, không chụp UI của PixelMind nếu chỉ chọn trang.  
- [ ] **D2-17 — Xuất PDF.** Xuất trang hiện tại ra PDF có lựa chọn khổ/kích thước phù hợp. **Nghiệm thu:** nội dung không bị cắt bất ngờ và lỗi lưu file được báo.  
- [ ] **D2-18 — Visual regression.** Lưu baseline theo route/viewport và so sánh lần chạy mới, hiển thị ảnh sai khác và tỷ lệ pixel. **Nghiệm thu:** baseline và lần chụp giống nhau không báo sai lệch lớn; kích thước ảnh khác được báo riêng.

### P3 — Prototype và chuyển động

- [ ] **D2-19 — Animation editor.** Tạo/xem trước transition và preset keyframes từ Canvas; giới hạn thuộc tính/đầu ra được hỗ trợ. **Nghiệm thu:** preview, dừng và hoàn tác; mã sinh ra chạy được trên trang.  
- [ ] **D2-20 — Prototype interaction state machine.** Gán trigger và action cho liên kết prototype (ví dụ click → route/modal/state), tách khỏi việc sửa source nếu chỉ ở chế độ mô phỏng. **Nghiệm thu:** chạy thử luồng, phát hiện route/target không hợp lệ và reset được trạng thái.

## 6\. Các hạng mục cần xác nhận phạm vi sản phẩm

Những nội dung dưới đây chưa thấy có triển khai và chưa được mô tả đủ để giao task an toàn; cần chốt yêu cầu trước khi thêm checklist triển khai:

- CMS/content modeling.  
- Import trực tiếp từ Figma.  
- Analytics, heatmap và session replay.  
- Marketplace plugin công khai hoặc đồng bộ cộng tác kiểu CRDT.

## 7\. Điều kiện hoàn thành chung

- [ ] Task có mô tả thao tác người dùng, luồng lỗi và tiêu chí nghiệm thu như checklist trên.  
- [ ] Không sửa tệp do dev còn lại sở hữu; thay đổi interface chung phải qua Dev 1\.  
- [ ] `npm run typecheck` đạt và kiểm thử thủ công đúng tiêu chí task.  
- [ ] Không để dữ liệu mẫu/placeholder tạo cảm giác tính năng đã hoạt động thật.  
- [ ] Cập nhật trạng thái `[ ]` thành `[x]` chỉ sau khi tiêu chí nghiệm thu đã được kiểm tra.