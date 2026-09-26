# Sổ tay Bảo mật Toàn diện UIForge AI (Zero-Trust Security Playbook) — v2 đã vá

> Tài liệu này thay thế v1. Mọi AI Coding Assistant **bắt buộc** đọc và tuân thủ.
> Nguyên tắc sửa v2: **giữ toàn bộ tính năng đã có trong dự án** (Canvas 5 chế độ, Live Preview localhost, Manual Edit Engine, Multi-Bridge 1-click, Prompt Engine, Git checkpoint, Responsive tester). Không cấm tính năng — chỉ quy định cách triển khai an toàn. Mọi chỗ "đáng lẽ nên bỏ nhưng vẫn giữ" được ghi rõ trong mục `> Ý kiến:`.

Tính năng đang tồn tại (không được phép bỏ — chỉ được gia cố):
`Canvas Reference/Live/Side-by-side/Overlay/Diff · Viewport 390/768/1440/1920 · Zoom/Pan/Select/Annotation/Screenshot · Open project folder · Detect framework (HTML/CSS/JS → React/Vite → Next.js) · Run dev server + Live reload (localhost:5173/3000) · Manual Edit (move/resize/màu/text/padding/margin/font-size, map DOM→source CSS > inline > Tailwind, jscodeshift AST, Craft.js/Puck/dnd-kit/react-zoom-pan-pinch) · Multi-Bridge 1-click (1. IDE WebSocket ws://localhost:45678 + plugin Antigravity/OpenCode · 2. CLI Bridge spawn antigravity-cli · 3. API Bridge OpenAI/Claude/Gemini + Ollama local) · Connection Profiles (~/.uiforge/config.json + localStorage) · AIPanel (Chat/Tasks/Findings/Context/AI Settings 4 model) · Prompt Engine (structured task, max 3 iterations) · Git checkpoint/diff/rollback/restore · AI Review mode · Design tokens`

---

## LỚP 0: NỀN MÓNG BUILD & UPDATE (mới — v1 thiếu nên bị RCE dù code sạch)

1. **Electron Fuses + Code signing bắt buộc:** `RunAsNode=false, EnableNodeCliInspect=false`, bật ASAR integrity. Mọi bản build release phải ký số (Windows signtool / macOS notarize).
2. **AutoUpdater có xác thực chữ ký:** chỉ nhận bản update có chữ ký hợp lệ + HTTPS + cert pinning. Tuyệt đối không update qua HTTP hay tự tải file từ URL do AI trả về.
3. **Vite dev/prod phân biệt:** `vite.config.ts` hiện tại là mặc định — giữ nguyên cho dev, nhưng bản đóng gói phải `sourcemap:false`, tắt HMR, bật `npm ci --ignore-scripts` khi build (xem Lớp 7).

> Ý kiến: tốt nhất là Tauri (binary nhẹ, attack surface nhỏ hơn Electron). Nhưng dự án đã chọn **Electron + React + TS** làm MVP nên v2 giữ Electron và gia cố thay vì đổi stack.

---

## LỚP 1: DESKTOP (ELECTRON HARDENING) — giữ Live Preview, chặn XSS→RCE

Giữ `nodeIntegration:false + contextIsolation:true` của v1, **bổ sung đủ bộ** (v1 thiếu nên vẫn bypass được):

```js
new BrowserWindow({
  webPreferences: {
    nodeIntegration: false, contextIsolation: true, sandbox: true,
    webSecurity: true, allowRunningInsecureContent: false,
    webviewTag: false, enableRemoteModule: false,
    devTools: !app.isPackaged, // prod tắt DevTools
  }
});
will-navigate → deny; setWindowOpenHandler → deny;
Không dùng <webview>/<iframe> load URL ngoài; Live Preview chỉ load http://127.0.0.1:<port> do chính PreviewService bật.
contextBridge chỉ expose API tối thiểu: window.uiforge = { openProject(), runDev(), sendToAgent() } — mỗi hàm validate bằng Zod ở main-process, kèm Path Allowlist (root project).
```

CSP (sửa v1 — v1 có `style-src 'unsafe-inline'`, `img-src data: blob:`, `connect-src ws://localhost:*` đều thủng):

```
default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self';
frame-src 'none'; frame-ancestors 'none'; form-action 'none';
style-src 'self'; img-src 'self' blob:; connect-src 'self' ws://127.0.0.1:45678 http://127.0.0.1:* https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com http://127.0.0.1:11434;
```

> Ý kiến: `img-src data:` tiện cho paste ảnh từ clipboard (Canvas có nút "Dán từ clipboard") nên muốn giữ. Nhưng `data:` cho phép SVG chứa script → v2 **cấm `data:`**, thay bằng `blob:` (tạo objectURL sau khi validate magic-bytes PNG/JPG/WebP ở main-process). Giữ tính năng paste ảnh, bỏ vector XSS.

---

## LỚP 2: MULTI-BRIDGE (giữ cả 3 cầu + 1-click switch, vá DNS-rebinding & Origin-spoof)

Không bỏ cầu nào. Mỗi cầu gia cố riêng, Router/Profile Manager giữ nguyên UX 1-click.

### 2A. IDE WebSocket Bridge (giữ `ws://localhost:45678`, miễn phí, khuyên dùng)

v1 chỉ check `Origin` → hacker forge bằng `curl/python` là qua. v2:

1. **Bind `127.0.0.1` only, validate `Host === 127.0.0.1:45678`.** Chặn DNS-rebinding (`evil.com` trỏ về 127.0.0.1 sẽ có Host sai → reject).
2. **Pairing 1 lần, auth mọi message:** lần đầu IDE↔UIForge pairing bằng mã 6 số hiện trên cả 2 màn hình (hoặc QR), sinh secret 256-bit, lưu Keychain/keytar cả 2 đầu. Mỗi message: `HMAC(secret, nonce||timestamp||sha256(body))`, `nonce` dùng 1 lần (cache 5 phút), `timestamp ±30s`. Reject thiếu/sai HMAC.
3. **Schema + giới hạn:** mọi message validate Zod, `max 256KB` (v1 để 5MB vẫn DDoS được), tối đa 20 msg/s + 1 connection/IP, payload là JSON có `type` nằm trong allowlist (`agent.request`, `agent.cancel`, `agent.result`).
4. Giữ `wss` local **chỉ khi** đã pin fingerprint (TOFU lần đầu lúc pairing). Nếu chưa pin được thì `ws://127.0.0.1` + HMAC vẫn an toàn hơn `wss` self-signed không pin.

> Ý kiến: tốt nhất là bỏ socket TCP, dùng NamedPipe (Windows) / Unix socket (quyền file-system tự chống rebinding). Nhưng plugin Antigravity/OpenCode hiện chỉ nói WebSocket nên v2 giữ WebSocket + Host-check + HMAC để tương thích.

### 2B. CLI Bridge (giữ `spawn antigravity-cli`, vá argument-injection)

v1 ghi `spawn('cmd', args)` vẫn chết vì arg bắt đầu bằng `-` (vd `--upload-pack=evil`).

```ts
// GIỮ tính năng gọi CLI, nhưng:
const ALLOWED_BIN = { antigravity: '/abs/path/antigravity-cli' }; // resolve 1 lần, không lấy từ input
const ALLOWED_FLAGS = new Set(['--project', '--image', '--prompt-file']);
function runCli(profile: string, flags: Record<string,string>) {
  for (const k of Object.keys(flags)) if (!ALLOWED_FLAGS.has(k)) throw new Error('deny flag');
  const bin = ALLOWED_BIN[profile]; // không bao giờ lấy bin từ user input
  return spawn(bin, ['--project', flags['--project'], '--', flags['--prompt-file']], { shell: false, timeout: 120_000 });
}
// prompt truyền qua file tạm (không qua argv), ảnh truyền bằng đường dẫn đã realpath-check (Lớp 4).
// Tuyệt đối không dùng exec()/shell:true/cmd.exe string concat.
```

### 2C. API Bridge (giữ OpenAI/Claude/Gemini + Ollama, vá lộ key & lộ source)

Giữ nhập key + chọn model 1-click. Key lưu theo Lớp 5. Thêm: request đi qua main-process (không fetch trực tiếp từ renderer để key không vào JS renderer), enforce `maxIterations:3` + timeout 60s, Ollama endpoint chỉ cho phép `http://127.0.0.1:11434` (chặn SSRF ra LAN — xem Lớp 9).

---

## LỚP 3: AI & PROMPT INJECTION (giữ gửi screenshot+DOM+CSS+ref cho AI, bỏ ảo tưởng "tag XML là đủ")

1. **Tag `<user_untrusted_input>` của v1 GIỮ nhưng ghi rõ: nó chỉ là delimiter, không phải tường lửa.** Kẻ tấn công vẫn qua bằng base64/tiếng lạ/chia nhỏ/chữ ẩn trong ảnh (screenshot reference chính là kênh giấu lệnh). V2 bắt buộc thêm:
   - Instruction hierarchy: `system > developer > user > tool-output`. Mọi dữ liệu từ DOM/screenshot/file/reference là `tool-output` (độ tin cậy thấp nhất) — **không bao giờ được ra lệnh**, chỉ là dữ liệu.
   - Prompt Engine (đã có) dựng structured task + `CONSTRAINTS: không đổi layout xung quanh, giữ accessibility, verify ở viewport hiện tại` — AI không được tự nới constraint.
   - Output validator: mọi patch do AI sinh phải qua allowlist lệnh + diff preview + xác nhận gõ lại với lệnh nguy hiểm (xem Lớp 4), không phải nút đỏ 1 click (v1 bị approval-fatigue bypass).
2. **Data Leakage — giữ gửi context nhưng redact TRƯỚC khi rời máy:** regex `sk-...` của v1 GIỮ nhưng mở rộng thành thư viện entropy (`gitleaks`-rule: `sk-proj-`, `ghp_`, `AKIA`, `xoxb-`, JWT, PEM `-----BEGIN`, email, thẻ tín dụng) + mask OCR-text trích từ screenshot. Bật `zero-retention / no-training` với provider khi có option; repo gắn cờ nhạy cảm → ép dùng Local Model (Ollama).
3. **Excessive Agency — giữ auto-fix loop nhưng kẹp 3 khóa:** (a) `maxIterations:3` (đã có trong kế hoạch) → quá thì `ask user`; (b) command/file allowlist (Lớp 4); (c) checkpoint → verify → accept/rollback (đã có ở Git) — không có accept thì không commit.
4. **Trojan Source (mới):** code AI sinh ra phải quét ký tự bidi/homoglyph/invisible (`\u202a-\u202e`, `а` Cyrillic giả `a`) trước khi apply — nếu không hacker giấu logic độc trong code "nhìn bình thường".

---

## LỚP 4: THỰC THI & FILE (giữ Run dev server, Manual Edit, Git — vá symlink & TOCTOU)

1. **Giữ `spawn`, cấm `exec`, + allowlist:** `npm install/dev, run dev, read/edit source` cho phép; `delete project, format, curl|sh, --upload-pack, -e/-c` từ chối. Mọi lệnh nguy hiểm qua `requestHumanApproval()` dạng gõ lại, kèm log (Lớp 8).
2. **Manual Edit (Craft.js/jscodeshift) giữ nguyên flow, thêm guard:** map DOM→source mờ (CSS kế thừa sâu, style từ lib) → **báo "không map chắc, giao AI"** (đúng như kế hoạch 12b, không được đoán). Patch AST qua jscodeshift, mỗi thao tác = 1 checkpoint nhỏ + Undo/Redo.
3. **Path traversal — sửa v1 (v1 chỉ `path.resolve+startsWith` → bypass bằng symlink/UNC/ADS/TOCTOU):**

```ts
import { realpathSync } from 'fs';
function assertInside(root: string, p: string) {
  const real = realpathSync(p); // resolve symlink
  if (!real.startsWith(realpathSync(root) + sep)) throw new Error('path traversal deny');
  if (/^\\\\\?\\|:/.test(p)) throw new Error('deny UNC/ADS'); // Windows
  // mở file với O_NOFOLLOW, check lại sau khi mở (chống TOCTOU)
}
```

4. **Sandbox giữ Docker/WASM nhưng siết:** `docker run --network=none --read-only --memory=512m --cpus=0.5 --pids-limit=64 --timeout=30s`, xóa container sau mỗi lần; code AI test thử không bao giờ chạy trên Host. Dev server của project user (cần network) chạy riêng, không chung sandbox với code AI chưa verify.

---

## LỚP 5: SECRETS (giữ Connection Profiles + API Key 1-click, vá RAM-dump & `--no-verify`)

1. **Giữ nơi lưu (`~/.uiforge/config.json` + localStorage cho profile thường) nhưng phân loại:** càng nhạy càng xa renderer — API key + WS secret **chỉ ở main-process**, mã hóa `AES-GCM-256` (nonce random mỗi lần), khóa trong Keychain/keytar (Windows Credential Manager / macOS Keychain). Renderer chỉ giữ tên profile đang chọn, không giữ key. Không bao giờ `console.log`/đưa key vào screenshot/context gửi AI.
2. **"Xóa khỏi RAM" của v1 ghi lại cho đúng:** string JS không zeroize được → key nhạy cảm giữ trong `Buffer` native và `fill(0)` sau dùng; coi heap renderer là lộ được qua DevTools/crash-dump nên đã tắt DevTools prod (Lớp 1).
3. **Git leaks — giữ Husky+gitleaks nhưng ghi rõ nó chỉ là lưới lớp 1:** bypass bằng `--no-verify` hoặc upload web vẫn lọt → bắt buộc thêm `.gitignore (.env, config.json)`, GitHub push-protection + secret-scanning phía server, key lộ coi như đã lộ (xoay key ngay).

---

## LỚP 6: FRONTEND (giữ Craft.js/Puck/dnd-kit/zoom-pan-pinch + render AI markdown, vá đúng thuốc)

1. **Render AI output:** v1 đúng khi bắt `DOMPurify`, v2 chốt config (v1 thiếu → vẫn mXSS qua svg/mermaid):
```ts
DOMPurify.sanitize(aiHtml, { FORBID_TAGS: ['svg','math','style','form','script','iframe'], FORBID_ATTR: ['on*','formaction'] });
// + CSP require-trusted-types (Lớp 1). Không dùng dangerouslySetInnerHTML nếu không qua hàm này.
```
File ảnh reference/paste/clipboard validate magic-bytes + strip EXIF/SVG-script ở main-process trước khi vào Canvas.

2. **Prototype Pollution — bỏ `Object.freeze()` của v1 (uống nhầm thuốc, không chặn được `{"__proto__":...}` lúc merge style/dnd-state):**
```ts
// dùng 1 trong: Map / Object.create(null) / structuredClone + validate key
function safeMerge(t: any, s: any) {
  for (const k of Object.keys(s)) {
    if (['__proto__','constructor','prototype'].includes(k)) throw new Error('pollution deny');
    t[k] = s[k];
  } return t;
}
// + validate mọi style/config kéo-thả bằng Zod trước khi merge.
```

---

## LỚP 7: SUPPLY CHAIN (giữ Craft.js/Puck/dnd-kit/jscodeshift..., vá preinstall-RCE)

v1 có `npm ci + audit + SRI + SBOM` nhưng thiếu cái giết người thật là `preinstall` RCE.

1. **Giữ toàn bộ deps đang dùng, thêm:** `npm ci --ignore-scripts` mặc định; chỉ cho phép script của danh sách trắng (`onlyBuiltDependencies`), verify `npm audit signatures` (sigstore/provenance) khi nâng cấp Craft.js/Puck/dnd-kit/Playwright/Sharp.
2. **SRI của v1 GIỮ nhưng ghi đúng phạm vi:** chỉ áp dụng khi load tài nguyên ngoài (font/CDN) — app đóng gói local thì không cần SRI, đừng tốn công gắn cho file nội bộ.
3. SBOM + Snyk/Trivy + Dependabot auto-merge patch giữ nguyên (phát hiện), nhưng phòng thủ chính là **ít dep + pin version + review diff khi bump major**.

---

## LỚP 8: KILL-SWITCH & AUDIT (giữ nút phanh, thêm log bất biến — v1 bấm nút xong mất dấu vết)

Giữ 4 bước v1 (kill child, đóng WS, clear key, báo đỏ), **thêm rule kích hoạt cụ thể** (v1 ghi "bất thường" chung chung nên không bao giờ срабаты):
- AI chạm file ngoài root 3 lần/1 phút → freeze task + đỏ màn hình.
- CLI spawn lệnh ngoài allowlist → deny + log.
- WS HMAC fail 5 lần/1 phút → block IP 10 phút.

Kill-switch phải có **watchdog ngoài process** (cùng process thì hacker tắt nó trước). Mọi deny/approve ghi **append-only audit log ký từng dòng** (xoay file theo ngày) — để sau sự cố còn điều tra + rollback theo Git checkpoint.

---

## LỚP 9: SSRF / NETWORK HYGIENE (mới — Live Preview + Ollama + AI fetch URL bắt buộc phải có)

1. Live Preview/Playwright chỉ mở `http://127.0.0.1:<port-do-chính-app-bật>`; mọi URL do AI/user nhập phải qua allowlist (deny `169.254.169.254`, `10/8`, `192.168/16`, `*.internal`, `file://`, `gopher://`).
2. Ollama endpoint khóa `127.0.0.1:11434`, không cho trỏ ra LAN/internet tùy ý.
3. Ảnh reference chỉ PNG/JPG/WebP (giới hạn 10MB), quét magic-bytes, không render SVG mù.

---

**Tuyên ngôn (giữ, sửa cho khớp thực tế):**
> *Mỗi dòng code tôi viết cho UIForge đều phải coi như đang bị hacker tấn công trực tiếp. Tôi giữ mọi tính năng của dự án, nhưng không đặt tiện lợi lên trên toàn vẹn: luôn validate bằng Zod, giữ secret ở main-process + Keychain, cô lập thực thi, checkpoint trước khi sửa, và ghi audit log.*
