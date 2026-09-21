# UIForge AI — Kế hoạch phát triển

> **Một câu:** "Figma dành cho lập trình giao diện" — mở dự án thật hoặc đưa ảnh thiết kế, tự kéo thả chỉnh giao diện hoặc nhờ AI sửa code, mọi thay đổi áp dụng trực tiếp vào source code.

> **Điểm khác biệt:** Không phải bản sao Figma. Là *Visual Development Workspace* lấy UI thật từ project đang chạy, cho phép vừa tự tay chỉnh vừa nhờ AI sửa xen kẽ.

## 1. Ý tưởng cốt lõi

### Hai cách đưa đầu vào
1. **Ảnh thiết kế:** import ảnh tham chiếu (PNG/JPG/WebP). Giao diện thật được sửa cho khớp ảnh.
2. **Dự án có sẵn:** mở trực tiếp folder project. App chạy giao diện (dev server) và cho sửa ngay, không cần ảnh mẫu.

### Hai cách sửa giao diện (dùng xen kẽ)
1. **Nhờ AI (Antigravity):** chọn một vùng (ví dụ Header), mô tả bằng tiếng Việt ("căn logo sang trái 8px, giống ảnh mẫu"). Antigravity đọc ảnh + DOM + CSS + code rồi sửa code.
2. **Tự sửa bằng kéo thả:** kéo thả, đổi kích thước, chỉnh vị trí, màu sắc ngay trên UI đang chạy. App ghi thay đổi trực tiếp vào source code. Không phụ thuộc 100% vào AI.
   - Phần đơn giản (dời, căn, đổi màu, padding) → tự làm cho nhanh.
   - Phần phức tạp (khớp pixel với ảnh, refactor layout, responsive) → giao AI.

### Vòng lặp cốt lõi
```text
Đầu vào (ảnh thiết kế | dự án)
  → UI đang chạy
  → Sửa (kéo thả | AI)
  → Render lại
  → So sánh / kiểm tra lại → lặp
```

## 2. Bốn thành phần chính

| # | Thành phần | Vai trò |
|---|-----------|---------|
| 1 | **Canvas** | Side-by-side, overlay, diff, chọn vùng, kéo thả chỉnh sửa trực tiếp |
| 2 | **Project workspace** | Hiểu framework, tìm file sinh ra UI, chạy dev server |
| 3 | **AI Agent (Antigravity bridge)** | Nhận ảnh + DOM + CSS + code → phân tích → sửa code |
| 4 | **Feedback loop** | Tự render + chụp lại + so sánh sau mỗi lần sửa, rollback qua Git |

## 3. Kiến trúc tổng thể

```text
┌────────────────────────────────────────────────┐
│               UIForge AI Desktop               │
├──────────────┬──────────────────┬──────────────┤
│ Project Panel│  Visual Canvas   │   AI Panel   │
│ Pages/Files  │ Live UI (thật)   │ Chat/Tasks/  │
│              │ + Ref + Diff     │ Findings     │
│              │ + kéo thả edit   │              │
└──────┬───────┴────────┬─────────┴──────┬───────┘
       │                │                │
       ▼                ▼                ▼
┌─────────────┐ ┌──────────────┐ ┌──────────────┐
│ Project     │ │ Preview      │ │ Edit Engines │
│ Engine      │ │ Engine       │ │              │
│ files/git/  │ │ Chromium/    │ │ (a) Manual   │
│ framework   │ │ Playwright/  │ │ (b) Antigravity│
│ dev server  │ │ DOM+CSS+shot │ │     CLI/SDK  │
└─────────────┘ └──────┬───────┘ └──────┬───────┘
                       │                │
                       ▼                ▼
                 Visual Diff ──→ Feedback Loop ──→ Git checkpoint
```

Hai engine sửa (`Manual` và `Agent`) cùng ghi vào source code, cùng đi qua một Feedback loop duy nhất.

## 4. Canvas

Chế độ hiển thị (giữ gọn, không clone Figma):
- **Live:** UI thật đang chạy (mặc định, luôn có).
- **Reference:** ảnh thiết kế (chỉ khi có ảnh đầu vào).
- **Side-by-side / Overlay (opacity) / Diff (pixel + DOM-aware):** chỉ để so sánh.

Tương tác:
- Select vùng → sinh context bundle (boundingBox, cssSelector, domPath, screenshot vùng, ảnh ref tương ứng).
- **Kéo thả trực tiếp trên Live UI:** di chuyển, resize (8 handle), đổi màu/text/padding qua inspector. Mọi thao tác → `Manual Edit Engine` ghi code ngay.
- Zoom / Pan / Measure / Annotation (annotation thành instruction cho AI).

Toolbar tối thiểu: Select, Pan, Zoom, Measure, Annotate, Compare, Screenshot, Run/Refresh, Undo/Redo.

## 5. Manual Edit Engine (mới — phần bản cũ thiếu)

Mục tiêu: thao tác trên UI thật → patch source code thật, không qua AI.

```text
Thao tác canvas (move/resize/đổi màu)
  → xác định DOM node + computed CSS
  → map tới source (CSS file / Tailwind class / inline style / styled-component)
  → ghi patch → reload preview → Git checkpoint
```

Phạm vi MVP (chỉ thế này, không hơn):
- Text content, màu, font-size, padding/margin, width/height, vị trí (absolute/flex offset đơn giản).
- Ghi theo thứ tự ưu tiên: CSS module/file riêng > inline style > Tailwind class (sửa class có sẵn, không sinh utility phức tạp).
- Mỗi thao tác = 1 checkpoint nhỏ, Undo/Redo ngay, không cần AI.

Giới hạn cố ý (không làm ở MVP):
- Không dựng layout engine, không auto-refactor component, không sinh component mới.
- Trường hợp map mờ (CSS kế thừa sâu, style từ lib UI) → báo "không map chắc, giao AI" thay vì đoán.
- // ponytail: ghi đè trực tiếp file CSS, AST refactor đầy đủ khi cần mới thêm.

## 6. Project workspace

- Mở folder → nhận diện framework. MVP: **HTML/CSS/JS → React/Vite → Next.js**. Còn lại báo unsupported, không cố gánh.
- Tự chạy dev server (`npm run dev`), giữ port, live reload.
- Cung cấp cho cả 2 engine: cây file liên quan, framework, git status.

## 7. AI Agent (Antigravity bridge)

Không nhúng cả Antigravity IDE. App là Control Center, gọi agent qua:
1. **CLI Bridge (MVP):** Task Generator → Antigravity CLI → sửa file.
2. **Agent/API Bridge (sau):** khi môi trường cho phép sandbox tool execution.
3. **IDE Extension (sau):** kết nối VS Code/Antigravity IDE.

Context bundle gửi agent (app tự ráp, user chỉ gõ tiếng Việt ngắn):
```text
ảnh ref (vùng cắt) + screenshot live (vùng cắt) + DOM + computed CSS
+ boundingBox + viewport + file nguồn liên quan + git diff + instruction
```

Prompt engine biến "nút này sai" thành structured task (goal + constraints: không phá layout xung quanh, giữ chức năng/a11y, verify ở viewport hiện tại).

Luồng task: Understand → Inspect (project/UI/ref) → Plan → Edit → Run → Screenshot → Compare → Verify → Report. `maxIterations: 3`, fail thì hỏi user. Mỗi task có checkpoint để rollback.

## 8. Feedback loop + Version

- Sau **mọi** lần sửa (tay hay AI): reload → screenshot (Playwright/Chromium) → diff (pixelmatch + so DOM bounding box) → findings (spacing/màu/type/size/alignment).
- Version: `v1, v2...` + git diff + accept/rollback/restore + so sánh version.
- Responsive check: 390 / 768 / 1440 (+1920 khi cần): resize → shot → findings.
- AI Review mode (sau MVP): chấm Visual/Responsive/A11y + report.

## 9. Stack (giữ nguyên, không thêm)

```text
Desktop: Electron + React + TypeScript + Tailwind + Zustand + Radix
Canvas: SVG/DOM overlay (Konva.js chỉ khi cần)
Preview: Playwright + Chromium
Backend local: Node.js services (Project/Preview/Screenshot/Compare/Agent/Git)
Storage: SQLite (Projects/References/Annotations/Tasks/Findings/Versions) + Git
AI: Antigravity CLI trước, SDK/API sau
Image: Sharp + pixelmatch (OpenCV sau)
```

Cấu trúc thư mục: `uiforge/apps/desktop, packages/{ui,canvas,agent,preview,visual-diff,project-core,shared}, services/{browser,agent-bridge}, database, docs`.

## 10. MVP — phạm vi khóa cứng

- [ ] Mở folder, detect React/Vite/HTML, chạy dev server, live preview trong app.
- [ ] Import ảnh ref (PNG/JPG/WebP), side-by-side + overlay + diff cơ bản.
- [ ] Chọn vùng → chat tiếng Việt → gửi Antigravity CLI → sửa code → reload → shot → so sánh.
- [ ] **Kéo thả tay: move/resize/đổi màu/padding/text trên Live UI → ghi vào source → undo được.**
- [ ] Git checkpoint + diff + rollback.
- [ ] Responsive 3 viewport + screenshot.

Không làm ở MVP: component tree, design token auto, multi-agent, Figma import/export, collab, cloud sync, DOM inspector đầy đủ (chỉ bounding box + computed CSS của vùng chọn).

## 11. User flow MVP

```text
Mở project (hoặc + import ảnh) → Run → Live UI trong app
  → [A] tự kéo nút cho ngay / đổi màu → lưu vào code → render lại
  → [B] chọn Header → "sửa cho giống ảnh mẫu" → AI sửa → render lại
  → Compare trước/sau → OK giữ / sai rollback → lặp
```

## 12. Tiêu chí MVP thành công (12 bước)

1. Mở React/HTML project. 2. Import ảnh (optional — vẫn chạy được khi không có).
3. Chạy web ngay trong app. 4. Xem ref + live cùng lúc (khi có ref).
5. Chọn vùng UI. 6. Gõ yêu cầu tiếng Việt.
7. Gửi Antigravity, sửa được source. 8. Reload + shot mới tự động.
9. So sánh trước/sau. 10. Rollback được.
11. **Không cần AI vẫn kéo thả sửa được UI đơn giản, code thay đổi thật.**
12. Responsive 3 viewport có findings.

## 13. Roadmap

- **Sprint 1 — Foundation:** Electron shell, layout 3 cột, opener, settings, SQLite.
- **Sprint 2 — Preview:** dev server manager, Chromium preview, screenshot, viewport.
- **Sprint 3 — Canvas:** ref import, pan/zoom, side-by-side/overlay, region select, annotation.
- **Sprint 4 — Manual Edit:** DOM→code map, move/resize/style edit, ghi CSS, undo.
- **Sprint 5 — Agent Bridge:** CLI bridge, prompt builder, task log, result handling.
- **Sprint 6 — Auto Fix Loop:** pixel+DOM diff, findings, verify loop (max 3), responsive audit.
- **Sprint 7 — Git:** checkpoint/diff/rollback/commit.
- **Sprint 8 — Polish:** shortcut, command palette, perf, installer.
- Sau MVP: Smart Inspector → Auto Repair → Design tokens → Multi-agent.

## 14. Ưu tiên

- **P0:** project manager, browser preview, screenshot, ref image, canvas, region select, **manual edit**, AI chat + bridge, visual compare, git rollback.
- **P1:** DOM inspect (bbox + computed CSS), responsive tester, annotation→instruction, findings auto, fix loop.
- **P2:** component tree, tokens, multi-agent, a11y sâu, Figma I/O, collab/cloud.

## 15. Rủi ro đã chốt cách xử lý

- Context quá lớn → chỉ gửi file liên quan + DOM/CSS vùng chọn + diff, không gửi cả project.
- Pixel-perfect khó → luôn kèm Image + DOM + CSS + code, không gửi ảnh chay.
- AI sửa hỏng chỗ khác → checkpoint trước mỗi task, rollback 1 click.
- Agent chạy lệnh nguy hiểm → whitelist (`npm run dev`, đọc/ghi source trong project), còn lại confirm; cấm xóa ngoài project.
