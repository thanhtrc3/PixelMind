# PixelMind Desktop — Audit tính năng & Roadmap

> **Ngày tạo:** 09/11/2026 · **Cập nhật trạng thái:** 11/11/2026  
> **Phạm vi:** `D:\Code\PixelMind\PixelMind\pixelmind-desktop`  
> **Phương pháp:** rà soát trực tiếp mã nguồn (`src`, `electron`, `shared`) + chạy `npm run typecheck`  
> **Kết quả typecheck gần nhất:** ✅ Pass, 0 lỗi  
> **Chưa chạy build:** tránh ghi đè thư mục `out/`

**Chú giải:** ✅ Hoàn thành · 🟡 Một phần / MVP · ❌ Chưa có

---

## 1. TÓM TẮT ĐIỀU HÀNH (Cập nhật 11/11/2026)

So với bản audit ngày 09/11/2026, dự án đã hoàn thiện toàn bộ các điểm "hoàn thành nhưng chưa thật" thuộc nhóm lõi Editor/Canvas và xây dựng hoàn chỉnh hệ sinh thái Trợ lý AI:

1. **Đã hoàn thiện dứt điểm (chuyển 🟡/❌ → ✅):**
   - **Assets:** có thumbnail thật, thêm/xoá ảnh (vào Thùng rác + Undo/Redo), chọn ảnh mẫu (`referenceAsset`) và xem trên Canvas (zoom/pan/fit).
   - **Pages CRUD:** tạo/xoá file route thật (`scaffoldPageFile`, `trashPageFile`), scaffold template đa framework và nhân bản trang (`DuplicatePageDialog.tsx`).
   - **Versions tab:** lịch sử commit thật (`GitGraphView`, `gitFetch`, `gitRollback` kèm backup `safetyRef`) và checkpoint RAM (`editorBuffer`) Undo/Redo trực tiếp trong sidebar.
   - **Design sidebar tab:** đọc Design Tokens thật của dự án, nhận diện màu thật của phần tử, hover preview tạm thời và áp dụng 1-chạm.
   - **FileViewer (Monaco Editor):** sửa file trực tiếp, `Ctrl+S` lưu, `Alt+Shift+F` format code, đồng bộ theme Sáng/Tối, kèm context menu FileTree kiểu IDE.
   - **Diff theo hunk:** hỗ trợ 2 chế độ Split & Unified, chia hunk độc lập với Accept/Reject từng đoạn (`MutationDiffDialog.tsx`, `src/lib/diff.ts`).
   - **Reparent / Reorder:** đổi DOM thật và ghi thay đổi cấu trúc xuống mã nguồn (`mutateReparent`), hỗ trợ Undo/Redo đầy đủ.
   - **Multi-select & Alignment:** chọn nhiều phần tử, sao chép/dán/xoá đa chọn, thanh công cụ nổi (khi chọn ≥ 2 phần tử), căn lề 6 hướng (cho cả đa phần tử lẫn 1 phần tử theo khung cha) và phân bổ khoảng cách đều ngang/dọc.
   - **Hệ sinh thái AI:** hoàn thiện CLI Bridge (`cliBridge.ts`), IDE WebSocket Bridge (`ideWsBridge.ts`), Direct API Gateway (`ai.ts`), `AIPanel.tsx`, vòng lặp tự sửa lỗi build (`runAutoFixLoop`), Design → Code (`AIDesignImportDialog.tsx`) và AI tạo Theme kèm sửa tương phản WCAG (`AIThemeDialog.tsx`).

2. **Các mục còn đang ở mức 🟡 Một phần hoặc ❌ Chưa có:**
   - **Visual Compare** (mới có chế độ xem ảnh mẫu + chuyển Live/Reference, chưa có split slider & opacity overlay).
   - **Settings toggles** (`autoSave`, `smartGuides`, `hoverOutline`, `syncCanvasToTree`...) còn phần lớn ở mức UI/chưa nối hành vi.
   - **In-Place AI Assistant:** đã viết component `AISidecar.tsx` nhưng chưa gắn lên `CanvasArea.tsx`.
   - **Flex/Grid 9 ô**, **Global Search nội dung file**, **Terminal nhập lệnh**, **Git Panel đầy đủ** (stage/commit/checkout UI), **Tailwind 2 chiều**, **Multi-Viewport song song**, **Smart Guides / Snapping**, **Supabase Cloud Sync / Auth** (mới dựng client `src/lib/supabase.ts`).

---

## 2. ✅ HOÀN THÀNH

### 2.1. Nền tảng & vận hành

| # | Tính năng | Ghi chú |
|---|---|---|
| 1 | Mở / quản lý / yêu thích / xoá dự án, lưu store JSON | Có xác nhận xoá, lưu hoạt động |
| 2 | Tự nhận diện framework & package manager | Next.js, Nuxt, Vite, Vue, Svelte/SvelteKit, Astro, Angular, Blazor, ASP.NET Core, Laravel, Django/Flask, PHP, Go, Rust, Flutter, HTML tĩnh |
| 3 | Runner chạy/dừng/install/custom command | Có static server cho HTML tĩnh |
| 4 | Tự phát hiện URL dev server + health-check + auto-retry | Canvas tự kết nối lại khi server sẵn sàng |
| 5 | Dọn tiến trình & giải phóng cổng | `killPort`, `killProjectBinaries`, `taskkill`, dọn khi đổi dự án/thoát app |
| 6 | DiagnosisDialog + errorParser + VisualErrorCard | Quét thiếu dependency, thiếu script, thiếu Git, lỗi build/runtime phổ biến |
| 7 | Menu Bar native + Titlebar tùy biến | Có fallback HTML menu khi chạy web |
| 8 | Phím tắt toàn cục | Ctrl+B, Ctrl+J, Ctrl+K, Ctrl+S, Ctrl+Z, Ctrl+Y, Ctrl+Shift+E/L, Ctrl+Alt+X, I, F, F5, F1… |
| 9 | Settings 2.0 | 6 tab, theme/accent/font/zoom, export/import settings JSON, shortcut reference |
| 10 | Theme system | Dark / Light / System, accent, font, reduced motion |
| 11 | Project Dashboard / Detail | Chỉ số dự án, trang & ảnh mẫu, git log read-only, hoạt động gần đây, chẩn đoán |

### 2.2. Sidebar, IDE & quản lý tài nguyên

| # | Tính năng | Ghi chú |
|---|---|---|
| 12 | Sidebar 7-trong-1 | Files, Layers, Pages, Assets, Versions, Design, Toolbox |
| 13 | Files & FileTree kiểu IDE | Cây tệp thật + context menu đầy đủ (tạo tệp/thư mục, đổi tên F2, xoá vào Thùng rác, copy path/relative path, mở Explorer) |
| 14 | FileViewer (Monaco Editor) | Tích hợp Monaco Editor cục bộ: sửa file trực tiếp, `Ctrl+S` lưu, `Alt+Shift+F` format code, đồng bộ theme Sáng/Tối |
| 15 | Layers | Cây DOM thật, hover/click, DnD reparent, Lên/Xuống/Vào/Ra, reset vị trí |
| 16 | Pages CRUD thật | Route tree, preview, tạo/xoá file route thật (`scaffoldPageFile`, `trashPageFile`), nhân bản trang (`DuplicatePageDialog`), dynamic params, nav link sync |
| 17 | Assets thật | Thumbnail thật, thêm ảnh từ máy tính, xoá vào Thùng rác + Undo/Redo, chọn ảnh mẫu (`referenceAsset`) truyền sang Canvas |
| 18 | Versions tab | Branch Git, Git Graph commit thật, Fetch, Rollback an toàn (`safetyRef`), checkpoint RAM (`editorBuffer`) Undo/Redo nhiều mốc |
| 19 | Design sidebar tab | Đọc token thật từ dự án (Màu, Chữ, Cách, Góc), nhận diện màu thật phần tử, hover preview, áp dụng 1-chạm |
| 20 | Toolbox / Parts | 60 phần tử, 12 part mẫu, quét component/partial/CSS/asset/route |
| 21 | Toolbox drag-drop | Chèn vào Canvas, context menu, double-click/Enter, diff, backup, undo |
| 22 | Design Tokens Editor | Color/typography/spacing/radius, ghi `variables.css`, sinh `tailwind.tokens.js` |

### 2.3. Canvas, Inspector & Diff

| # | Tính năng | Ghi chú |
|---|---|---|
| 23 | Live DOM Inspector | Sửa typography, màu, spacing, layout, position, effects, text, attrs |
| 24 | Code Locator | Dò DOM → file/dòng source |
| 25 | Code Sync | Ghi style/text vào TSX/JSX/Vue/Svelte/Razor/HTML, có backup |
| 26 | Diff theo Hunk (Split & Unified) | `MutationDiffDialog.tsx` + `src/lib/diff.ts`: xem 2 cột/1 dòng, Accept/Reject từng hunk |
| 27 | Reparent / Reorder (Persist Source) | Đổi DOM thật + ghi cấu trúc xuống mã nguồn (`mutateReparent`) + Undo/Redo đầy đủ |
| 28 | Resize & move | Resize 8 hướng; move absolute có ghi style |
| 29 | Undo / Redo | 50 action, hỗ trợ DOM + file + move/reparent |
| 30 | Responsive single iframe | Responsive / Mobile / Tablet / Desktop / Wide |
| 31 | Zoom / Pan / Focus Canvas | Ctrl+wheel, zoom badge, F vừa khung, full-screen focus |
| 32 | Multi-select nâng cao & Alignment | Kéo vùng, Shift+Click, copy/paste/delete, floating bar (≥ 2 phần tử), căn lề 6 hướng (cả 1 phần tử theo khung cha lẫn nhiều phần tử), phân bổ đều ngang/dọc |
| 33 | Element context menu | Nhân bản, xoá, copy HTML/selector, sửa thuộc tính, căn lề |
| 34 | Multi-Page Canvas | Không gian vô cực, nhiều cửa sổ trang, live SVG wires, camera sync, Cluster/Rings |
| 35 | Manual wire + source link sync | Kéo dây tạo link, xoá dây unlink, ghi vào source qua `syncNav` |

### 2.4. AI & Tự động hóa

| # | Tính năng | Ghi chú |
|---|---|---|
| 36 | AI Agent Bridge (WebSocket, CLI, API) | `cliBridge.ts` (Claude Code, Codex, OpenCode, Gemini CLI...), `ideWsBridge.ts`, `ai.ts` + Context/Tools/Guardrails/Audit/Cost |
| 37 | AI Assistant Panel | `AIPanel.tsx`: panel chat dock, ngữ cảnh Canvas/Code/Log, preview diff, apply/revert, quản lý agents/providers/token |
| 38 | Vòng lặp AI tự sửa lỗi build/runtime | `VisualErrorCard.tsx` + `runAutoFixLoop` trong `AIPanel.tsx` (Propose → Apply → Verify → Retry tối đa 3 lần, có Kill-switch) |
| 39 | Design → Code | `AIDesignImportDialog.tsx`: phân tích ảnh thiết kế và sinh code HTML/React/Razor/Vue qua AI Gateway |
| 40 | AI tạo Theme & nội dung | `AIThemeDialog.tsx`: sinh palette/theme qua AI Gateway + tự kiểm tra & sửa tương phản WCAG (`autoFixWcag`) |

---

## 3. 🟡 MỘT PHẦN / MVP

| # | Mục | Đã có | Còn thiếu | File / ghi chú |
|---|---|---|---|---|
| 1 | Visual Compare | Chế độ xem ảnh mẫu (`referenceAsset`) với zoom/pan/fit và bật tắt Live ↔ Reference | Split slider so sánh trực tiếp và thanh trượt opacity overlay | `CanvasArea.tsx` |
| 2 | Flex / Grid | `display`, `flex-direction`, `align-items`, `justify-content`, `wrap`, `gap` | Ma trận 9 ô, `grid-template-columns`/`rows`, grid visual editor | `CanvasArea.tsx` |
| 3 | Prototype Editor | Multi-Page Canvas, live wires, manual link/unlink | Event/state machine click/hover/scroll → action | `MultiPageCanvas.tsx` |
| 4 | Global search | Tab file mở, lọc tên file, tìm route/asset, palette lệnh + dự án gần đây | Search nội dung toàn văn bản file, breadcrumb, recent files | `FileTree.tsx`, `CommandPalette.tsx` |
| 5 | Terminal | `LogPanel` xem log dev server, clear, collapse | Ô nhập lệnh / terminal tương tác thật (PTY) | `LogPanel.tsx` |
| 6 | Git Panel | Branch, Graph commit thật, Fetch, Rollback an toàn | Working tree status, stage/unstage, commit message, branch create/checkout UI | `VersionsTab.tsx`, `GitGraphView.tsx` |
| 7 | Auto-save / Snapshot | Dirty buffer, `Ctrl+S`, backup `.pixelmind/backups/`, checkpoint RAM Undo/Redo | Tự động lưu (auto-save) theo timer/setting | `editorBuffer.ts`; `autoSave` trong Settings chưa nối |
| 8 | CSS Variables / Breakpoint | Design Tokens Editor, ghi `variables.css`, tailwind config, đọc/áp token trong sidebar | Quản lý biến CSS theo từng phần tử tùy biến, Breakpoint Manager | `DesignTokensDialog.tsx` |
| 9 | Tailwind 2-way | Sinh `tailwind.tokens.js` | Sinh/đọc class hai chiều vào `className` thay cho inline style | `shared/designTokens.ts` |
| 10 | Component/Part nâng cao | Quét component/partial/CSS/asset/route, chèn part | Tạo component từ vùng chọn, Variants/Props, publish Design System | `toolbox.ts`, `ToolboxPanel.tsx` |
| 11 | Pages/Assets nâng cao | Tạo/xoá/nhân bản trang, route tree, thumbnail/reference ảnh | Page template đa dạng, kéo-thả nén ảnh, quản lý thuộc tính `alt` | `WorkspaceSidebar.tsx`, `pages.ts` |
| 12 | Theme / Shortcuts / Notification / Template | Theme, accent, font, zoom, bảng phím tắt | Notification Center, thư viện template khởi đầu | `SettingsDialog.tsx` |
| 13 | Import / Export dự án | Export/import settings JSON | Đóng gói/nhập dự án ZIP/HTML/Figma | `SettingsDialog.tsx` |
| 14 | Multi-framework Adapter | Nhận diện và chạy nhiều framework, scaffold trang | Hỗ trợ sâu AST/component cho từng framework ngoài React/HTML/Vue/Razor | `projects.ts`, `pages.ts` |
| 15 | Settings toggles | UI toggle đầy đủ | Nối hành vi thật: `autoSave`, `smartGuides`, `hoverOutline`, `syncCanvasToTree`, `preferredPort`, `confirmQuitRunning` | `SettingsDialog.tsx`, `App.tsx` |
| 16 | In-Place AI Assistant | Đã có component `AISidecar.tsx` kết nối AI Gateway & element context | Gắn và định vị `AISidecar` trực tiếp cạnh phần tử trên `CanvasArea` | `AISidecar.tsx` |
| 17 | Workspace state persistence | Lưu cờ bật/tắt sidebar, bottomPanel, rightPanel, aiPanel, logCollapsed | Lưu độ rộng panel, danh sách tab đang mở | `src/lib/layoutPrefs.ts` |
| 18 | Database / Cloud (Supabase) | Đã cài `@supabase/supabase-js` và khởi tạo `src/lib/supabase.ts` | Schema DB thật trên Supabase, đăng nhập/phân quyền, đồng bộ đám mây | `src/lib/supabase.ts` |

---

## 4. ❌ CHƯA CÓ

### 4.1. Canvas & thiết kế

- ❌ Visual Compare hoàn chỉnh (split slider + opacity overlay + pixel diff)
- ❌ Multi-Viewport song song (Mobile + Tablet + Desktop cùng lúc)
- ❌ Synchronized Scroll & Click
- ❌ Smart Guides / Thước / Snapping
- ❌ State Switcher (:hover, :focus, :active)
- ❌ Eyedropper API
- ❌ Annotations & Comment Pins
- ❌ Screenshot / Export PNG/PDF
- ❌ Animation & Timeline Editor
- ❌ Interaction / State Machine Editor (event → action)

> Lưu ý: `CanvasMode` đã có type, `ToolKey` vẫn chưa có logic đo đạc/annotation hoàn chỉnh, `smartGuides` là setting chưa nối.

### 4.2. Developer Ergonomics

- ❌ Search nội dung toàn dự án
- ❌ Terminal nhập lệnh tương tác (PTY)
- ❌ Git Panel đầy đủ (stage, commit, checkout UI)
- ❌ Auto-save tự động theo timer/setting
- ❌ Tailwind class sync 2 chiều

### 4.3. Tài nguyên, linh kiện & kiểm thử

- ❌ Tạo component từ vùng chọn + Variants/Props
- ❌ Publish Design System
- ❌ Quản lý ảnh nâng cao (kéo-thả vào Canvas, nén ảnh, quản lý alt)
- ❌ Form & Data Binding / Mock API
- ❌ CMS / Content Modeling
- ❌ SEO Inspector
- ❌ Accessibility Checker (axe-core — hiện mới có check WCAG trong `AIThemeDialog`)
- ❌ Performance Panel (Web Vitals)
- ❌ Visual Regression Testing

### 4.4. Hệ thống, mở rộng & cộng tác

- ❌ Notification Center thật
- ❌ Template library khởi đầu
- ❌ Import/Export dự án ZIP/HTML/Figma
- ❌ Plugin / Extension API & Marketplace
- ❌ Cloud Sync / Team Workspace / CRDT
- ❌ Deploy & Preview URL
- ❌ Phân quyền / xác thực / bản quyền (mới chuẩn bị client `supabase.ts`)
- ❌ Analytics / Heatmap / Session Replay
- ❌ Xuất báo cáo & tài liệu dự án

---

## 5. SAI LỆCH CẦN SỬA TRONG TÀI LIỆU HIỆN TẠI

| Tài liệu / mục | Vấn đề | Trạng thái cập nhật |
|---|---|---|
| `DONE.md` | Ghi “HOÀN THÀNH 100%” không phản ánh độ chi tiết | Cần cập nhật theo 3 trạng thái ✅/🟡/❌ của bản 11/11 |
| `README.md` | Ghi “PixelMind không sửa mã nguồn dự án” | Đã lỗi thời vì Toolbox/Code Sync/Monaco/AI Patch đều sửa file trực tiếp |
| Settings | Nhiều toggle chưa nối hành vi | Vẫn cần nối logic thật cho `autoSave`, `smartGuides`, `hoverOutline`, `syncCanvasToTree` |

---

## 6. ROADMAP ƯU TIÊN

### P0 — Sửa các điểm “hoàn thành nhưng chưa thật”

- [x] Assets: thumbnail thật, chọn ảnh mẫu, lưu state reference.
- [ ] Visual Compare: split slider + opacity overlay + reference/live/diff.
- [x] Pages: tạo/xoá file route thật, scaffold template, duplicate page.
- [x] Persist reparent/reorder xuống source (AST/string update + backup).
- [x] Versions: danh sách commit thật + checkpoint RAM + rollback.
- [ ] Nối các Settings toggle vào hành vi thật (`autoSave`, `smartGuides`, `hoverOutline`, `syncCanvasToTree`, `preferredPort`, `confirmQuitRunning`).
- [x] Sửa toast/UI gây hiểu nhầm (Assets, Versions, Pages).

### P1 — Hoàn thiện các mục đang dở

- [x] Multi-select: Align/Distribute (hỗ trợ cả nhiều phần tử và căn 1 phần tử theo khung cha).
- [x] Monaco + sửa file trực tiếp (kèm format code, `Ctrl+S`, đồng bộ theme).
- [ ] Search nội dung + breadcrumb + recent files.
- [ ] Terminal nhập lệnh.
- [ ] Git Panel đầy đủ (stage, commit, branch/checkout).
- [ ] Auto-save thật theo setting (Snapshot/Rollback UI đã xong trong `VersionsTab`).
- [ ] Tailwind class sync 2 chiều.
- [ ] Flex/Grid visual editor (ma trận 9 ô + grid template).
- [ ] CSS Variables nâng cao + Breakpoint Manager.
- [x] Per-hunk diff + accept/reject (`MutationDiffDialog.tsx` + `src/lib/diff.ts`).
- [ ] Notification Center.
- [ ] Project import/export ZIP/HTML/Figma.
- [ ] Template library.
- [ ] Multi-Viewport song song + sync scroll/click.
- [ ] Smart Guides / thước / snapping.
- [ ] Assets nâng cao (nén, alt, kéo-thả).

### P2 — Lớp AI, kiểm thử & cộng tác

- [x] AI Agent bridge (WebSocket/CLI/API).
- [ ] In-Place AI Assistant (đã có `AISidecar.tsx`, cần gắn lên `CanvasArea`).
- [x] AI Assistant Panel.
- [x] Vòng lặp AI tự sửa lỗi.
- [x] Design → Code.
- [x] AI tạo Theme & nội dung.
- [ ] Screenshot/Export PNG/PDF.
- [ ] Annotations & Comment Pins.
- [ ] Animation & Timeline Editor.
- [ ] State Switcher (:hover/:focus/:active).
- [ ] Eyedropper.
- [ ] SEO Inspector.
- [ ] Accessibility Checker (axe-core).
- [ ] Performance Panel (Web Vitals).
- [ ] Visual Regression Testing.
- [ ] Form & Data Binding / Mock API.
- [ ] CMS / Content Modeling.
- [ ] Plugin / Extension API & Marketplace.
- [ ] Cloud Sync / Team Workspace / CRDT (đã chuẩn bị client `supabase.ts`).
- [ ] Deploy / Preview URL / Permissions.
- [ ] Analytics / Heatmap / Session Replay / Reports.
- [ ] Multi-framework adapter sâu hơn.

---

## 7. KIỂM CHỨNG

| Hạng mục | Kết quả |
|---|---|
| `npm run typecheck` | ✅ Pass, 0 lỗi (đã kiểm chứng ngày 11/11/2026) |
| `npm run build` | Chưa chạy (tránh ghi `out/`) |
| Phương pháp | Đọc mã nguồn trực tiếp + `graphify` / `git grep` đối chiếu UI/props/IPC |

---

## 8. KẾT LUẬN

- **Tiến độ đã bứt phá:** Nhóm **P0** đã hoàn thành **5/7** mục (Assets, Pages CRUD, Persist Reparent, Versions thật, đồng bộ UI/toast); nhóm **P1** hoàn thành các tính năng trọng tâm (Multi-select & Align/Distribute, Monaco Editor, Per-hunk Diff); nhóm **P2 (AI)** hoàn thành gần như toàn bộ (**5/6** mục AI lớn).
- **Trọng tâm tiếp theo nên ưu tiên:**
  1. Hoàn thiện **2 mục P0 còn lại**: **Visual Compare** (split slider / opacity overlay) và nối **Settings toggles** vào hành vi thật (`autoSave`, `smartGuides`, `hoverOutline`, `syncCanvasToTree`).
  2. Gắn **`AISidecar.tsx`** lên `CanvasArea` để hoàn tất nốt mảnh ghép **In-Place AI Assistant**.
  3. Tiếp tục các mục Developer Ergonomics (**Search nội dung file**, **Terminal nhập lệnh**, **Git commit UI**) và Canvas nâng cao (**Flex/Grid 9 ô**, **Multi-Viewport**, **Smart Guides**).
