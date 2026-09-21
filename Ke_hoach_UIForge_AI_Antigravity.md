# Kế hoạch phát triển ứng dụng Visual UI Designer + Antigravity Agent

> **Một câu:** "Figma dành cho lập trình giao diện" — mở dự án thật hoặc đưa ảnh thiết kế, tự kéo thả chỉnh giao diện hoặc nhờ AI sửa code, mọi thay đổi áp dụng trực tiếp vào source code.

> **Mục tiêu:** Xây dựng một ứng dụng desktop kiểu "Figma + AI coding agent workspace", trong đó người dùng có thể đưa vào hình ảnh/tham chiếu giao diện, xem giao diện web/app đang phát triển ngay trong canvas, yêu cầu Antigravity kiểm tra hình ảnh và sửa giao diện theo từng vòng lặp.

## 1. Hiểu đúng ý tưởng

Ứng dụng không nên chỉ là một trình xem ảnh.

Nó nên trở thành một **Visual Development Workspace** gồm 4 phần:

1. **Canvas trực quan**  
   Hiển thị screenshot, thiết kế tham chiếu, live web/app preview và các vùng được chọn. Cho phép chọn vùng và **kéo thả chỉnh sửa trực tiếp** trên UI đang chạy.

2. **Project/Code workspace**  
   Biết project đang nằm ở đâu, framework gì, file nào tạo ra UI và phiên bản hiện tại của giao diện.

3. **AI Agent / Antigravity bridge**  
   Người dùng có thể ra lệnh tự nhiên như:
   - "Header đang lệch, sửa cho giống ảnh tham chiếu."
   - "Nút này thấp hơn thiết kế khoảng 8px."
   - "Đổi giao diện sang dark mode nhưng giữ nguyên bố cục."
   - "Kiểm tra responsive ở 390px, 768px và 1440px."
   - "So sánh giao diện hiện tại với ảnh mẫu và sửa toàn bộ các điểm khác biệt."

4. **Feedback + iteration**  
   Sau mỗi lần sửa (bằng tay hay bằng AI), app tự cập nhật preview, chụp lại ảnh và cho phép tiếp tục đánh giá.

### Hai cách đưa đầu vào
1. **Ảnh thiết kế:** import ảnh tham chiếu để giao diện thật được sửa cho khớp.
2. **Dự án có sẵn:** mở trực tiếp project, app chạy giao diện và cho sửa ngay trong app, không cần ảnh mẫu.

### Hai cách sửa giao diện (dùng xen kẽ)
1. **Nhờ AI:** chọn một vùng (ví dụ Header), mô tả yêu cầu bằng tiếng Việt, Antigravity sửa code. Dùng cho phần phức tạp hoặc cần khớp chính xác với ảnh thiết kế.
2. **Tự sửa bằng kéo thả:** kéo thả, đổi kích thước, chỉnh vị trí, màu sắc ngay trên giao diện đang chạy. App ghi thay đổi trực tiếp vào source code, không phụ thuộc 100% vào AI. Dùng cho phần đơn giản.

Điểm quan trọng nhất là tạo được vòng lặp:

**Đầu vào (ảnh thiết kế | dự án) → UI đang chạy → Sửa (kéo thả | AI) → Render lại → So sánh / kiểm tra lại**

---

# 2. Khả năng thực tế của Antigravity

Google Antigravity hiện được mô tả là một nền tảng agentic development có thể làm việc qua editor, terminal và browser; agent có thể lập kế hoạch, thực thi và kiểm tra tác vụ. Antigravity cũng hỗ trợ artifact, feedback và browser-based verification. Đây là nền tảng rất phù hợp để làm "bộ não" cho quy trình thiết kế → code → kiểm tra → sửa. citeturn632615search1turn632615search2

Antigravity 2.0 hiện là ứng dụng desktop độc lập cho Windows, macOS và Linux, đồng thời cho phép làm việc với agent theo kiểu đồng bộ/bất đồng bộ. citeturn632615search12

Ngoài IDE, Google hiện cũng cung cấp Antigravity Agent qua Gemini API/Interactions API. Agent có khả năng thực thi code, quản lý file và truy cập web trong sandbox. citeturn632615search8

**Kết luận kiến trúc:** không nên cố "nhúng toàn bộ Antigravity IDE vào app". Tốt hơn là xây một lớp **Visual UI Control Center** đứng bên cạnh project và kết nối với Antigravity bằng cơ chế agent/API/CLI thích hợp.

---

# 3. Mục tiêu sản phẩm

Tên tạm:

**UIForge AI**

Hoặc:

**VisualAgent**
**DesignPilot**
**UI Copilot Studio**

Ứng dụng hướng tới:

- Thiết kế giao diện web.
- Thiết kế UI cho desktop/mobile app.
- So sánh giao diện với screenshot.
- Quản lý nhiều reference image.
- Chọn một thành phần trên canvas và gửi feedback.
- Điều khiển AI bằng ngôn ngữ tự nhiên.
- Kiểm tra responsive.
- Theo dõi lịch sử thay đổi.
- Rollback phiên bản.
- Preview live.
- Sinh screenshot tự động.
- Phát hiện sai lệch về layout, spacing, typography, màu sắc và kích thước.
- Cho AI sửa trực tiếp source code.

---

# 4. Kiến trúc tổng thể

```text
┌─────────────────────────────────────────────────────────────┐
│                     UIForge AI Desktop                     │
├───────────────┬───────────────────────────────┬────────────┤
│ Project Panel │          Visual Canvas         │ AI Panel  │
│               │                               │            │
│ - Pages       │ Reference / Live / Compare    │ Chat       │
│ - Assets      │ Zoom / Pan / Select           │ Tasks      │
│ - Components  │ Overlay / Diff                │ Findings   │
│ - Versions    │ Annotations                   │ Commands   │
└───────┬───────┴──────────────┬────────────────┴─────┬──────┘
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐     ┌─────────────────┐    ┌──────────────────┐
│ Project Engine│     │ Preview Engine   │    │ Agent Bridge     │
│               │     │                 │    │                  │
│ Files         │     │ Browser         │    │ Antigravity CLI  │
│ Git           │     │ Screenshot      │    │ Antigravity SDK  │
│ Config        │     │ DOM inspection  │    │ API / Agent      │
└───────────────┘     └─────────────────┘    └────────┬─────────┘
                                                      │
                                                      ▼
                                             ┌──────────────────┐
                                             │ Antigravity      │
                                             │ Agent            │
                                             │                  │
                                             │ inspect → edit   │
                                             │ test → verify    │
                                             └──────────────────┘
```

> Lưu ý: ngoài **Agent Bridge** (nhờ AI sửa), app còn có **Manual Edit Engine** (tự kéo thả sửa, xem mục 12b). Cả hai cùng ghi vào source code và cùng đi qua một Feedback loop + Git checkpoint duy nhất.

---

# 5. Giao diện ứng dụng đề xuất

## 5.1 Layout kiểu Figma

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Logo │ Project │ Undo │ Redo │ Run │ Compare │ Preview │ Share │ ⚙ │
├────────────┬──────────────────────────────────────────────┬─────────┤
│            │                                              │         │
│            │                                              │         │
│  Layers    │                 CANVAS                       │   AI    │
│            │                                              │         │
│  Pages     │      ┌───────────────────────────┐           │ Agent   │
│            │      │                           │           │         │
│  Assets    │      │        WEB PREVIEW        │           │ Chat    │
│            │      │                           │           │         │
│  Files     │      └───────────────────────────┘           │ Finding │
│            │                                              │         │
│            │                                              │         │
├────────────┴──────────────────────────────────────────────┴─────────┤
│ Status │ localhost:3000 │ viewport 1440×900 │ Zoom 75% │ AI ready │
└──────────────────────────────────────────────────────────────────────┘
```

## 5.2 Thanh công cụ

Cần có tối thiểu:

- Select
- Pan
- Zoom
- Rectangle
- Text/annotation
- Comment
- Measure
- Reference
- Compare
- Screenshot
- Run/Refresh
- Undo/Redo

---

# 6. Canvas kiểu Figma nhưng tập trung vào code

Không nên cố clone Figma 100%.

Thay vào đó, canvas nên tập trung vào **UI đang chạy**.

### Các chế độ:

### A. Reference

Hiển thị ảnh thiết kế:

```text
[Figma / Photoshop / Screenshot / JPG / PNG / WebP]
```

### B. Live Preview

Hiển thị project thực tế:

```text
localhost:3000
localhost:5173
...
```

### C. Side-by-side

```text
REFERENCE             LIVE
┌─────────────┐       ┌─────────────┐
│             │       │             │
│ DESIGN      │       │ CURRENT UI  │
│             │       │             │
└─────────────┘       └─────────────┘
```

### D. Overlay

```text
Reference: 50%
Live:      50%
```

Cho phép kéo opacity để nhìn trực tiếp phần lệch nhau.

### E. Difference mode

Tạo heatmap/diff:

```text
████████████████████
██      HEADER    ██
██        ▲       ██
██     lệch 6px   ██
████████████████████
```

### F. Chỉnh sửa trực tiếp (Manual edit)

Live Preview không chỉ để xem — người dùng kéo thả, đổi kích thước, chỉnh vị trí, màu sắc ngay trên UI đang chạy. Mọi thao tác được Manual Edit Engine (mục 12b) ghi thẳng vào source code, không cần qua AI.

---

# 7. Chức năng quan trọng nhất: chọn một vùng rồi giao việc cho AI

Ví dụ người dùng click vào nút.

App lưu context:

```json
{
  "page": "/login",
  "element": "button.submit",
  "boundingBox": {
    "x": 620,
    "y": 480,
    "width": 180,
    "height": 48
  },
  "screenshot": "...",
  "referenceScreenshot": "...",
  "domPath": "...",
  "cssSelector": "button.submit"
}
```

Sau đó người dùng nhập:

> "Nút này đang thấp hơn ảnh mẫu. Căn nó đúng giữa và giảm border-radius xuống 10px."

Agent nhận cả:

- ảnh hiện tại;
- ảnh tham chiếu;
- vị trí vùng được chọn;
- DOM element;
- CSS;
- code liên quan;
- viewport;
- lịch sử thay đổi.

Đây sẽ là tính năng tạo khác biệt lớn nhất của app.

---

# 8. Hệ thống AI Feedback

AI không nên nhận duy nhất một screenshot.

Nên xây context bundle:

```text
UI CONTEXT
│
├── Reference Image
├── Current Screenshot
├── DOM Tree
├── Computed CSS
├── Bounding Boxes
├── Viewport
├── Framework
├── Source Files
├── Git Diff
└── User Instruction
```

Agent trả về:

```json
{
  "issues": [
    {
      "type": "spacing",
      "severity": "medium",
      "element": ".hero-title",
      "expected": "margin-bottom 24px",
      "actual": "margin-bottom 12px"
    }
  ],
  "suggested_changes": [
    "Update margin-bottom"
  ]
}
```

---

# 9. Tự động kiểm tra hình ảnh

Đây là engine cốt lõi.

## 9.1 Visual comparison

So sánh:

- vị trí;
- kích thước;
- khoảng cách;
- màu;
- typography;
- border;
- shadow;
- radius;
- alignment;
- visibility.

## 9.2 Pixel diff

Cho các trường hợp:

- màu sai;
- kích thước sai;
- hình ảnh sai;
- element lệch.

## 9.3 DOM-aware comparison

Không chỉ nhìn pixel.

Ví dụ:

```text
Reference:
Button x=620 y=500

Live:
Button x=620 y=516

Difference:
Y +16px
```

Điều này giúp AI sửa chính xác hơn.

---

# 10. Responsive Testing

Người dùng có thể chọn:

```text
Mobile
390 × 844

Tablet
768 × 1024

Desktop
1440 × 900

Large Desktop
1920 × 1080
```

App sẽ tự:

1. mở browser;
2. resize viewport;
3. chụp screenshot;
4. so sánh;
5. gửi findings cho agent.

Ví dụ:

```text
Responsive Audit

390px
❌ Navbar overflow

768px
⚠ Card spacing differs

1440px
✅ Good
```

---

# 11. Antigravity Bridge

Có 3 tầng tích hợp nên hỗ trợ theo thứ tự ưu tiên.

## Tầng 1 — CLI Bridge

App gọi agent thông qua CLI.

```text
UIForge
   ↓
Task Generator
   ↓
Antigravity CLI
   ↓
Project files
```

Ưu điểm:

- đơn giản;
- phù hợp MVP;
- dễ debug;
- không phải clone IDE.

## Tầng 2 — Agent/API Bridge

Nếu môi trường triển khai cho phép dùng Antigravity Agent/API:

```text
UIForge
   ↓
Agent Request
   ↓
Antigravity Agent
   ↓
Tool execution
   ↓
Result
```

Antigravity Agent hiện có khả năng chạy code, thao tác file và truy cập web trong sandbox. citeturn632615search8

## Tầng 3 — IDE Extension

Có thể viết extension để kết nối sâu với VS Code/Antigravity IDE.

Antigravity hiện hỗ trợ extension cho VS Code, cùng Visual Studio, JetBrains và Zed. citeturn632615search0

---

# 12. Cách app "ra lệnh sửa giao diện" (nhờ AI)

Nên cung cấp 4 cách ra lệnh cho AI. (Ngoài ra còn cách tự sửa bằng kéo thả — xem mục 12b, hai cách dùng xen kẽ.)

### Cách 1 — Chat

```text
Sửa header giống ảnh mẫu.
```

### Cách 2 — Chọn vùng

Click:

```text
[Button]
```

sau đó:

```text
Làm nút này giống ảnh tham chiếu.
```

### Cách 3 — Annotation

Người dùng khoanh vùng:

```text
     ┌─────────────┐
     │   HEADER    │ ← sửa phần này
     └─────────────┘
```

### Cách 4 — Visual command

Ví dụ:

```text
"Đổi phần này thành màu #111111"
"Di chuyển sang trái 12px"
"Giữ nguyên chiều rộng"
"Cho font giống thiết kế"
```

---

# 12b. Tự sửa bằng kéo thả — Manual Edit Engine

Đây là cách sửa thứ hai, song song với nhờ AI: thao tác trên UI thật → patch source code thật, không qua AI.

```text
Thao tác canvas (move/resize/đổi màu)
   →
xác định DOM node + computed CSS
   →
map tới source (CSS file / Tailwind class / inline style)
   →
ghi patch → reload preview → Git checkpoint
```

Phạm vi MVP (chỉ thế này, không hơn):
- Text, màu, font-size, padding/margin, width/height, vị trí đơn giản.
- Ưu tiên ghi: CSS file riêng > inline style > Tailwind class có sẵn.
- Mỗi thao tác = 1 checkpoint nhỏ, Undo/Redo ngay.

Giới hạn cố ý:
- Không dựng layout engine, không auto-refactor component, không sinh component mới trong MVP.
- Trường hợp map mờ (CSS kế thừa sâu, style từ lib UI) → báo "không map chắc, giao AI" thay vì đoán.

---

# 13. File/project management

App cần hiểu project thật.

Ví dụ project:

```text
my-shop/
├── src/
├── public/
├── package.json
├── vite.config.ts
└── ...
```

App tự nhận diện:

```text
React
Next.js
Vue
Angular
HTML/CSS/JS
Electron
WPF
Flutter
...
```

MVP nên ưu tiên:

**HTML/CSS/JS → React/Vite → Next.js**

Sau đó mở rộng.

---

# 14. Preview Engine

Đề xuất dùng Chromium/Playwright.

Luồng:

```text
Project
   ↓
Run dev server
   ↓
Browser
   ↓
Playwright
   ↓
Screenshot + DOM + computed style
   ↓
Canvas
```

Playwright có thể dùng để:

- mở URL;
- click;
- inspect;
- screenshot;
- thay đổi viewport;
- lấy DOM;
- kiểm thử UI.

---

# 15. Annotation System

Người dùng có thể vẽ:

- rectangle;
- arrow;
- circle;
- text;
- measurement;
- comment.

Ví dụ:

```text
      ↓ 16px
┌─────────────────┐
│     BUTTON      │
└─────────────────┘
```

Annotation sẽ trở thành instruction cho AI.

---

# 16. Version Control

Mọi lần agent sửa phải tạo một checkpoint.

Ví dụ:

```text
v1 Initial UI
v2 Fix Header
v3 Fix Mobile Layout
v4 Improve Button
```

Có:

- Diff
- Rollback
- Restore
- Compare versions

Nên tích hợp Git:

```text
AI change
   ↓
git diff
   ↓
review
   ↓
accept
   ↓
commit
```

---

# 17. AI Task lifecycle

Mỗi request nên chạy theo quy trình:

```text
1. Understand
      ↓
2. Inspect project
      ↓
3. Inspect current UI
      ↓
4. Inspect reference
      ↓
5. Identify problem
      ↓
6. Create plan
      ↓
7. Edit code
      ↓
8. Run application
      ↓
9. Screenshot
      ↓
10. Compare
      ↓
11. Verify
      ↓
12. Report result
```

Điều này rất phù hợp với cách Antigravity được thiết kế quanh agent, task, artifacts và verification. citeturn632615search1turn632615search5

---

# 18. Gợi ý stack công nghệ

## Desktop shell

**Electron + React + TypeScript**

Lý do:

- UI giống Figma dễ xây.
- Canvas tốt.
- WebView/Browser integration thuận lợi.
- dễ kết nối Node.js;
- dễ chạy trên Windows.

Có thể cân nhắc:

**Tauri + React**

nếu sau này ưu tiên:

- RAM thấp;
- binary nhẹ;
- hiệu năng tốt hơn.

### Khuyến nghị cho MVP:

**Electron + React + TypeScript**

---

# 19. UI layer

Đề xuất:

```text
React
TypeScript
Tailwind CSS
Radix UI
Zustand
```

Canvas:

```text
Konva.js
```

hoặc:

```text
Fabric.js
```

hoặc custom Canvas/SVG layer.

MVP nên dùng:

**React + SVG/DOM overlay**

Không cần xây một Figma clone hoàn chỉnh ngay.

---

# 20. Backend/local services

```text
Node.js
TypeScript
```

Các service:

```text
ProjectService
PreviewService
ScreenshotService
ComparisonService
AgentService
GitService
FileService
SettingsService
```

---

# 21. Database

MVP có thể dùng:

**SQLite**

Lưu:

```text
Projects
Pages
References
Annotations
Agent Tasks
Findings
Versions
Settings
```

---

# 22. Folder structure đề xuất

```text
uiforge/
├── apps/
│   ├── desktop/
│   └── renderer/
│
├── packages/
│   ├── ui/
│   ├── canvas/
│   ├── agent/
│   ├── preview/
│   ├── visual-diff/
│   ├── project-core/
│   └── shared/
│
├── services/
│   ├── browser/
│   ├── screenshot/
│   └── agent-bridge/
│
├── database/
│
└── docs/
```

---

# 23. Data model cơ bản

## Project

```text
Project
- id
- name
- path
- framework
- devServer
- createdAt
- updatedAt
```

## Reference

```text
Reference
- id
- projectId
- path
- name
- viewportWidth
- viewportHeight
- metadata
```

## Task

```text
AgentTask
- id
- projectId
- prompt
- context
- status
- result
- createdAt
```

## Finding

```text
Finding
- id
- taskId
- type
- severity
- element
- message
- expected
- actual
```

---

# 24. MVP — phiên bản đầu tiên

Không nên làm quá lớn.

MVP chỉ cần:

### Project

- Open project folder.
- Detect web project.
- Run dev server.

### Reference (không bắt buộc — app vẫn chạy khi không có ảnh)

- Import PNG/JPG/WebP.
- Set viewport.
- Display reference.

### Preview

- Embedded browser.
- Live reload.
- Screenshot.

### Canvas

- Zoom.
- Pan.
- Select area.
- Overlay.

### AI

- Chat box.
- Send screenshot + project context.
- Send selected area.
- Ask Antigravity to inspect/fix.

### Manual Edit (tự sửa bằng kéo thả, không cần AI)

- Move/resize element trên Live Preview.
- Đổi màu, text, padding/margin, font-size.
- Ghi thẳng vào source code + Undo/redo.

### Version

- Git diff.
- Undo/rollback.

---

# 25. MVP user flow

Người dùng mở app:

```text
Create Project
      ↓
Select folder
      ↓
Import Reference Image (không bắt buộc)
      ↓
Run Project
      ↓
Live Preview
```

Hai nhánh sửa dùng xen kẽ:

```text
[A] Tự kéo thả (không cần AI):
Drag/resize/đổi màu trên Live UI
      ↓
App ghi vào source code
      ↓
Refresh → Screenshot → Compare → Result

[B] Nhờ AI:
Select Header
      ↓
"Header chưa giống ảnh mẫu"
      ↓
Send to Agent
      ↓
Antigravity inspect
      ↓
Edit CSS/React
      ↓
Refresh
      ↓
Screenshot
      ↓
Compare
      ↓
Result ([B])
```

Người dùng tiếp tục:

```text
"Căn logo sang trái thêm 8px"
```

và vòng lặp tiếp tục.

---

# 26. Phase 2 — Smart Visual Inspector

Thêm:

- DOM inspection;
- computed CSS;
- element bounding box;
- color sampler;
- spacing analyzer;
- typography analyzer;
- automatic findings.

Ví dụ:

```text
Visual Inspector

Header
✓ Height
✓ Alignment
⚠ Padding mismatch: 12px
❌ Logo width mismatch: 24px
```

---

# 27. Phase 3 — Automatic UI Repair

Thay vì AI chỉ trả lời:

> "Header đang sai."

AI có thể:

```text
Detected:
Header padding differs by 8px.

[Fix automatically]
```

Sau đó:

```text
Agent
→ edit
→ render
→ compare
→ verify
```

---

# 28. Phase 4 — Figma-like editing (nâng cao)

> Core "tự kéo thả sửa UI" đã có ở MVP (xem mục 12b). Phase này chỉ thêm phần nâng cao:

Thêm:

- layers;
- component tree;
- constraints;
- guides;
- rulers;
- smart guides;
- design tokens;
- reusable components;
- inspect CSS;
- copy CSS;
- copy JSX.

Nhưng cần nhớ:

**Mục tiêu vẫn là phát triển UI bằng code + AI, không phải cạnh tranh trực tiếp với Figma.**

---

# 29. Phase 5 — Multi-agent

Có thể dùng nhiều agent:

```text
                ┌── UI Inspector
                │
User → Manager ─┼── CSS Fixer
                │
                ├── Responsive Tester
                │
                └── QA Agent
```

Ví dụ:

**UI Inspector**

→ tìm lỗi.

**Implementation Agent**

→ sửa code.

**QA Agent**

→ kiểm tra lại.

**Responsive Agent**

→ kiểm thử nhiều viewport.

Đây đặc biệt phù hợp với mô hình Antigravity hiện hỗ trợ nhiều agent hoạt động song song. citeturn632615search4

---

# 30. Những vấn đề khó cần tính từ đầu

## 30.1 Không nên gửi toàn bộ code cho AI

Project lớn sẽ rất tốn context.

Cần xây:

```text
Relevant file selection
+
DOM context
+
Visual context
+
Git diff
```

## 30.2 Pixel-perfect rất khó

Một ảnh không nói cho AI biết chính xác:

- font;
- DOM;
- responsive rule;
- CSS inheritance;
- component architecture.

Do đó cần kết hợp:

**Image + DOM + CSS + Source Code**

## 30.3 Không để AI sửa vô hạn

Phải có giới hạn:

```text
Maximum iterations: 3
```

Ví dụ:

```text
Fix
→ verify
→ fail
→ fix
→ verify
→ fail
→ ask user/review
```

## 30.4 Phải có rollback

Agent (hoặc thao tác tay) có thể sửa đúng một phần nhưng làm hỏng chỗ khác.

Vì vậy mỗi task AI và mỗi thao tác tay cần:

```text
checkpoint
→ changes
→ verify
→ accept / rollback
```

---

# 31. Security

Không nên để agent tự do chạy mọi command mà không có policy.

Nên có:

```text
Command permission
File permission
Network permission
Project sandbox
```

Ví dụ:

```text
npm install       ✓
npm run dev       ✓
read source       ✓
edit source       ✓
delete project    ✕
format disk       ✕
```

Mọi thao tác nguy hiểm cần confirmation.

---

# 32. UX quan trọng nhất

Người dùng không nên phải hiểu AI context.

Ví dụ người dùng chỉ cần:

```text
[ Chọn vùng ]

"Chỗ này nhìn chưa giống ảnh mẫu.
Làm cho giống."
```

App tự thêm:

```text
+ screenshot
+ reference
+ DOM
+ CSS
+ viewport
+ project
```

Đây mới là trải nghiệm "Figma + Antigravity".

---

# 33. Prompt engine

Không nên gửi raw prompt của người dùng trực tiếp.

App nên biến:

```text
"nút này sai"
```

thành structured task:

```text
TASK:
Inspect selected UI element.

GOAL:
Match reference image.

CONSTRAINTS:
- Do not alter surrounding layout.
- Preserve functionality.
- Preserve accessibility.
- Verify at current viewport.

CONTEXT:
...
```

Điều này giúp agent làm việc ổn định hơn.

---

# 34. Design token system

Có thể trích xuất:

```text
Colors
Fonts
Spacing
Radius
Shadows
Breakpoints
```

Ví dụ:

```text
--color-primary
--color-bg
--space-sm
--space-md
--radius-md
```

AI có thể sửa theo token thay vì hard-code.

---

# 35. "AI Review mode"

Một chế độ rất đáng làm:

```text
[Review UI]
```

Agent tự kiểm tra:

```text
Visual
Accessibility
Responsive
Typography
Spacing
Overflow
Contrast
Interaction
```

Sau đó tạo report:

```text
UI REVIEW
──────────────

Visual score       91%
Responsive score   84%
Accessibility      88%

Issues:
5 minor
2 medium
1 major
```

Antigravity hiện đã có định hướng mạnh về agent artifacts và verification, nên report dạng này phù hợp với mô hình làm việc của nó. citeturn632615search1turn632615search5

---

# 36. Công nghệ đề xuất cuối cùng

## Core

```text
Electron
React
TypeScript
Node.js
```

## UI

```text
Tailwind
Radix UI
Zustand
```

## Canvas

```text
SVG
DOM Overlay
Konva.js (khi cần)
```

## Browser

```text
Playwright
Chromium
```

## Storage

```text
SQLite
File System
Git
```

## AI Bridge

```text
Antigravity CLI
Antigravity Agent/API
Antigravity IDE Extension
```

## Image

```text
PNG/JPG/WebP
Canvas
Sharp
Pixelmatch
OpenCV (giai đoạn sau)
```

---

# 37. Roadmap thực tế

## Sprint 1 — Foundation

- Electron shell.
- React UI.
- Project opener.
- Basic layout.
- Settings.
- SQLite.

## Sprint 2 — Preview

- Dev server manager.
- Chromium preview.
- Playwright.
- Screenshot.
- Responsive viewport.

## Sprint 3 — Canvas

- Import reference.
- Pan/zoom.
- Side-by-side.
- Overlay.
- Region selection.
- Annotation.

## Sprint 4 — Manual Edit

- DOM → code mapping.
- Move/resize/style edit trên Live UI.
- Ghi CSS + undo.
- Checkpoint cho thao tác tay.

## Sprint 5 — Agent Bridge

- Antigravity connection.
- Prompt builder.
- Task execution.
- Logs.
- Result handling.

## Sprint 6 — Visual Comparison

- Pixel diff.
- Overlay diff.
- Bounding boxes.
- Visual findings.

## Sprint 7 — Auto Fix Loop

```text
Analyze
→ Fix
→ Render
→ Compare
→ Verify
```

## Sprint 8 — Git

- Checkpoint.
- Diff.
- Rollback.
- Commit.

## Sprint 9 — Polish

- Keyboard shortcuts.
- Command palette.
- Project management.
- Error handling.
- Performance.
- Installer.

---

# 38. Tiêu chí MVP thành công

MVP được xem là thành công khi người dùng có thể:

```text
1. Mở một React/HTML project.
2. Đưa screenshot thiết kế vào (không bắt buộc — vẫn chạy được khi không có).
3. Chạy website ngay trong app.
4. Nhìn reference và live UI cùng lúc (khi có ref).
5. Chọn một vùng UI.
6. Viết yêu cầu bằng tiếng Việt.
7. Gửi yêu cầu cho Antigravity.
8. Antigravity sửa source code.
9. App tự reload.
10. Chụp screenshot mới.
11. So sánh trước/sau.
12. Cho phép rollback.
13. Không cần AI vẫn kéo thả sửa được UI đơn giản, code thay đổi thật.
14. Kiểm tra responsive 390/768/1440 có findings.
```

Nếu hoàn thành đủ 14 bước này thì sản phẩm đã có giá trị thực tế, dù chưa có toàn bộ tính năng của Figma.

---

# 39. Định hướng sản phẩm nên theo

Không nên xây:

> "Một phần mềm vẽ UI giống Figma."

Nên xây:

> **"Một môi trường phát triển giao diện trực quan, nơi screenshot là reference, browser là canvas, source code là cấu trúc thật, người dùng vừa tự kéo thả chỉnh vừa nhờ Antigravity kiểm tra + sửa."**

Đây là khác biệt cốt lõi.

---

# 40. Kiến trúc phiên bản 1.0

```text
                   ┌───────────────────────┐
                   │       UIForge         │
                   │      Desktop App      │
                   └───────────┬───────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │ Project     │     │ Visual      │     │ AI          │
   │ Engine      │     │ Engine      │     │ Engine      │
   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
          │                    │                    │
          ▼                    ▼                    ▼
       Files/Git          Browser/DOM         Antigravity
                              │               Agent/CLI/API
                              ▼
                         Screenshot
                              │
                              ▼
                         Visual Diff
                              │
                              ▼
                          Findings
                              │
                              └───────────────→ Fix Loop (AI + Manual)
```

---

# 41. Ưu tiên triển khai

### P0 — Bắt buộc

- Project manager.
- Browser preview.
- Screenshot.
- Reference image.
- Canvas.
- Region selection.
- Manual edit (kéo thả ghi thẳng vào source).
- AI chat.
- Antigravity bridge.
- Visual comparison.
- Git rollback.

### P1 — Rất nên có

- DOM inspection.
- Bounding box.
- Computed CSS.
- Responsive tester.
- Annotation.
- Automatic findings.
- AI fix loop.

### P2 — Giai đoạn nâng cao

- Component tree.
- Design tokens.
- Multi-agent.
- Advanced accessibility.
- Figma import/export.
- Collaboration.
- Cloud sync.

---

# 42. Kết luận

Ý tưởng này **khả thi**, và hướng mạnh nhất không phải là tạo một bản sao của Figma.

Sản phẩm nên là một lớp **Visual Agent Workspace** dành cho việc phát triển UI.

Công thức sản phẩm:

```text
Figma-like Canvas
        +
Browser DevTools
        +
Screenshot Comparison
        +
Git
        +
Manual Edit Engine (kéo thả ghi vào code)
        +
Antigravity Agent
        =
AI UI Development Workspace
```

Trong đó:

- **Canvas** giúp con người nhìn và chọn vấn đề.
- **Browser** cung cấp UI thật.
- **Visual Engine** xác định giao diện đang sai ở đâu.
- **Project Engine** biết phải sửa file nào.
- **Manual Edit Engine** cho người dùng tự kéo thả sửa phần đơn giản, ghi thẳng vào code.
- **Antigravity** thực hiện việc phân tích, code, test và sửa.
- **Git** bảo vệ project bằng checkpoint/rollback.

Đây là kiến trúc nên dùng để bắt đầu xây MVP thay vì cố gắng tạo một "Figma hoàn chỉnh" ngay từ đầu.