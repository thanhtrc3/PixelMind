# D1-28 — Tailwind sync hai chiều từ Canvas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Khi sửa style trên Canvas, lưu thành class Tailwind cho các thuộc tính chuyển được; thuộc tính không chuyển được giữ inline; lưu 2 lần không nhân đôi class/style; lần đọc lại (mở tài liệu, tải lại canvas) cho đúng giá trị đã lưu. Người dùng chọn được chế độ `auto | inline | tailwind`.

**Architecture:** Toàn bộ quyết định "class hay inline" nằm trong hàm thuần `buildStyleUpdate()` ở `electron/main/styleSync.ts` (đã electron-free). `inspect:sync-code` chỉ còn lo đọc/ghi file và thay text. `CanvasSettings` mang chế độ sync xuống renderer.

**Tech Stack:** TypeScript thuần, `shared/designTokens.ts` (bộ chuyển đổi sẵn có), node:test, React.

**Spec:** `pixelmind-feature-checklist-2dev.md:117` (D1-28).

## Global Constraints

- **Không viết bộ chuyển đổi Tailwind mới.** Dùng `stylesToTailwindClasses`, `tailwindClassesToStyles`, `mergeTailwindClasses` trong `shared/designTokens.ts`.
- Thuộc tính không chuyển được → `style` inline, không được mất giá trị.
- Gặp `className={...}` động hoặc `style={...}` động → không ghi class, dùng inline, trả `unsafe: true`.
- Key của style JSX phải camelCase (`backgroundColor`), HTML phải kebab-case (`background-color`). Đây là lỗi hiện có, phải sửa.
- Không đổi định dạng `DesignTokens` hay file `tokens.json`.

## Review Focus

- Lưu 2 lần cùng một bộ style → dòng mã không đổi (không `p-4 p-2`, không 2 lần `style`).
- Class Tailwind đã có sẵn trên phần tử (ví dụ `p-4`) khi đổi `padding` → class cũ bị thay, không cộng dồn.
- Project chưa có `.pixelmind/tokens.json` → vẫn chuyển được bằng token mặc định (hiện tại dùng bộ token rỗng nên gần như luôn fallback inline).
- JSX: style residual không được sinh `background-color: "..."` (TSX sai cú pháp).
- `styleMode: 'tailwind'` trên project v4 không bị báo sai là v3.

---

### Task 1: `buildStyleUpdate()` + inline fallback (thuần, có test)

**Files:**
- Modify: `electron/main/styleSync.ts` (thêm export; giữ nguyên 2 hàm hiện có và `camelToKebabCase`)
- Test: `tests/tailwindSync.test.mjs` (Create)
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces:
```ts
export type StyleSyncMode = 'auto' | 'inline' | 'tailwind'

export function kebabToCamelKey(key: string): string

/** Có nên thử Tailwind không (dùng chung cho handler và test). */
export function shouldUseTailwind(mode: StyleSyncMode, detected: 'v3' | 'v4' | null): boolean

export interface BuildStyleUpdateOptions {
  line: string
  isJsx: boolean
  tagName?: string
  styles: Record<string, string>
  tokens: DesignTokens
  /** false = luôn ghi inline (mode 'inline' hoặc project không có Tailwind). */
  allowTailwind: boolean
}
export interface BuildStyleUpdateResult {
  line: string
  modified: boolean
  unsafe: boolean
  mode: 'tailwind' | 'inline'
  appliedClasses: string[]
  residualStyles: Record<string, string>
}
export function buildStyleUpdate(options: BuildStyleUpdateOptions): BuildStyleUpdateResult
```

- [ ] **Step 1: Viết test đỏ**

`tests/tailwindSync.test.mjs`:

```js
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DEFAULT_DESIGN_TOKENS, tailwindClassesToStyles, stylesToTailwindClasses } from '../shared/designTokens.ts'
import { buildStyleUpdate, kebabToCamelKey, shouldUseTailwind } from '../electron/main/styleSync.ts'

const tokens = DEFAULT_DESIGN_TOKENS
const jsxOpts = (line, styles, allowTailwind = true) => ({ line, isJsx: true, tagName: 'button', styles, tokens, allowTailwind })
const htmlOpts = (line, styles, allowTailwind = true) => ({ line, isJsx: false, tagName: 'div', styles, tokens, allowTailwind })

describe('kebabToCamelKey', () => {
  it('đổi key CSS sang camelCase, giữ custom property', () => {
    assert.equal(kebabToCamelKey('background-color'), 'backgroundColor')
    assert.equal(kebabToCamelKey('--pm-accent'), '--pm-accent')
  })
})

describe('shouldUseTailwind', () => {
  it('mode inline luôn tắt; auto/tailwind phụ thuộc phát hiện', () => {
    assert.equal(shouldUseTailwind('inline', 'v3'), false)
    assert.equal(shouldUseTailwind('auto', null), false)
    assert.equal(shouldUseTailwind('auto', 'v4'), true)
    assert.equal(shouldUseTailwind('tailwind', null), true)
  })
})

describe('buildStyleUpdate - JSX', () => {
  it('ghi class Tailwind và bỏ inline style cho thuộc tính chuyển được', () => {
    const res = buildStyleUpdate(jsxOpts('<button className="btn">Lưu</button>', { display: 'flex', gap: '8px' }))
    assert.equal(res.mode, 'tailwind')
    assert.match(res.line, /className="btn [^"]*flex[^"]*"/)
    assert.doesNotMatch(res.line, /style=/)
    assert.ok(res.appliedClasses.length > 0)
  })

  it('lưu lại lần 2 không nhân đôi class', () => {
    const first = buildStyleUpdate(jsxOpts('<button className="btn">Lưu</button>', { display: 'flex', gap: '8px' }))
    const second = buildStyleUpdate(jsxOpts(first.line, { display: 'flex', gap: '8px' }))
    assert.equal(second.line, first.line)
    const classes = second.line.match(/className="([^"]*)"/)[1].split(/\s+/)
    assert.equal(classes.length, new Set(classes).size)
    assert.equal(classes.filter((c) => c === 'flex').length, 1)
  })

  it('thuộc tính không hỗ trợ giữ inline với key camelCase', () => {
    const res = buildStyleUpdate(jsxOpts('<div className="box">x</div>', { writingMode: 'vertical-rl' }))
    assert.equal(res.mode, 'inline')
    assert.match(res.line, /style=\{\{ writingMode: "vertical-rl" \}\}/)
    assert.equal(res.appliedClasses.length, 0)
    assert.equal(res.residualStyles.writingMode, 'vertical-rl')
  })

  it('className động thì không ghi class, chỉ ghi inline', () => {
    const res = buildStyleUpdate(jsxOpts('<div className={cn("box")}>x</div>', { display: 'flex' }))
    assert.equal(res.unsafe, true)
    assert.match(res.line, /className=\{cn\("box"\)\}/)
    assert.match(res.line, /style=\{\{ display: "flex" \}\}/)
  })

  it('allowTailwind=false luôn ghi inline', () => {
    const res = buildStyleUpdate(jsxOpts('<div className="box">x</div>', { display: 'flex' }, false))
    assert.equal(res.mode, 'inline')
    assert.match(res.line, /style=\{\{ display: "flex" \}\}/)
  })
})

describe('buildStyleUpdate - HTML', () => {
  it('thay class cũ cùng thuộc tính thay vì cộng dồn', () => {
    const res = buildStyleUpdate(htmlOpts('<div class="p-4">x</div>', { padding: '8px' }))
    assert.equal(res.mode, 'tailwind')
    assert.match(res.line, /class="p-2"/)
    assert.doesNotMatch(res.line, /p-4/)
  })

  it('residual dùng key kebab-case trong style', () => {
    const res = buildStyleUpdate(htmlOpts('<div>x</div>', { writingMode: 'vertical-rl' }))
    assert.match(res.line, /style="writing-mode: vertical-rl;"/)
  })
})

describe('đọc lại class thành style', () => {
  it('class sinh ra đọc ngược được về đúng thuộc tính', () => {
    const styles = { display: 'flex', gap: '8px' }
    const conversion = stylesToTailwindClasses(styles, tokens, { arbitraryValues: true })
    const back = tailwindClassesToStyles(conversion.classes.join(' '), tokens)
    for (const item of conversion.applied) {
      assert.ok(back.styles[item.property] !== undefined, `Không đọc lại được ${item.property}`)
    }
  })
})
```

- [ ] **Step 2: Chạy test, phải đỏ**

Run: `node --experimental-strip-types --test tests/tailwindSync.test.mjs`
Expected: FAIL — `buildStyleUpdate`/`shouldUseTailwind`/`kebabToCamelKey` chưa export.

- [ ] **Step 3: Cài đặt**

Thêm vào `electron/main/styleSync.ts` (import thêm `stylesToTailwindClasses`, `DesignTokens` đã có):

```ts
export type StyleSyncMode = 'auto' | 'inline' | 'tailwind'

export function kebabToCamelKey(key: string): string {
  if (key.startsWith('--')) return key
  return key.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase())
}

export function shouldUseTailwind(mode: StyleSyncMode, detected: 'v3' | 'v4' | null): boolean {
  if (mode === 'inline') return false
  if (mode === 'tailwind') return true
  return detected !== null
}
```

Hai hàm inline (chép được nguyên văn — đây là logic đang nằm trong `index.ts:4245-4284`, chuyển ra, có sửa key casing):

```ts
function applyInlineStyleJsx(
  line: string,
  tagRegex: RegExp,
  styles: Record<string, string>,
): TailwindLineUpdate {
  // style={{ ... }} tĩnh thì thay; style={biến} thì không đụng được
  if (/style\s*=\s*\{/.test(line) && !/style\s*=\s*\{\{[^{}]*\}\}/.test(line)) {
    return { line, modified: false, unsafe: true }
  }
  const body = Object.entries(styles)
    .map(([key, value]) => `${kebabToCamelKey(key)}: ${JSON.stringify(String(value))}`)
    .join(', ')
  const simpleStyleRe = /style\s*=\s*\{\{[^{}]*\}\}/
  if (simpleStyleRe.test(line)) {
    return { line: line.replace(simpleStyleRe, `style={{ ${body} }}`), modified: true, unsafe: false }
  }
  return { line: line.replace(tagRegex, `$1 style={{ ${body} }}$2`), modified: true, unsafe: false }
}

function applyInlineStyleHtml(
  line: string,
  tagRegex: RegExp,
  styles: Record<string, string>,
): TailwindLineUpdate {
  if (/style\s*=\s*\{/.test(line) || /:style\s*=/.test(line)) {
    return { line, modified: false, unsafe: true }
  }
  const styleRe = /style\s*=\s*("[^"]*"|'[^']*')/
  const existing = line.match(styleRe)
  const map: Record<string, string> = {}
  if (existing) {
    const raw = (existing[1] || '').slice(1, -1)
    for (const part of raw.split(';')) {
      const idx = part.indexOf(':')
      if (idx === -1) continue
      const key = part.slice(0, idx).trim()
      const value = part.slice(idx + 1).trim()
      if (key && value) map[key] = value
    }
  }
  for (const [key, value] of Object.entries(styles)) map[camelToKebabCase(key)] = String(value)
  const text = Object.entries(map).map(([k, v]) => `${k}: ${v};`).join(' ')
  if (existing) return { line: line.replace(styleRe, `style="${text}"`), modified: true, unsafe: false }
  return { line: line.replace(tagRegex, `$1 style="${text}"$2`), modified: true, unsafe: false }
}
```

`buildStyleUpdate`:

```ts
export function buildStyleUpdate(options: BuildStyleUpdateOptions): BuildStyleUpdateResult {
  const { line, isJsx, tagName, tokens, allowTailwind } = options
  const styles = Object.fromEntries(
    Object.entries(options.styles || {}).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== ''),
  )
  const tagStr = (tagName || '[a-zA-Z0-9_-]+').toLowerCase()
  const tagRegex = new RegExp(`(<${tagStr})(\\s|>|$)`, 'i')
  const inline = () =>
    isJsx ? applyInlineStyleJsx(line, tagRegex, styles) : applyInlineStyleHtml(line, tagRegex, styles)

  if (!allowTailwind || Object.keys(styles).length === 0) {
    const update = styles.length === 0 ? { line, modified: false, unsafe: false } : inline()
    return { line: update.line, modified: update.modified, unsafe: update.unsafe, mode: 'inline', appliedClasses: [], residualStyles: styles }
  }

  const conversion = stylesToTailwindClasses(styles, tokens, { arbitraryValues: true })
  if (conversion.classes.length === 0) {
    const update = inline()
    return { line: update.line, modified: update.modified, unsafe: update.unsafe, mode: 'inline', appliedClasses: [], residualStyles: styles }
  }

  const convertedProperties = conversion.applied.map((item) => item.property)
  const residual = isJsx
    ? Object.fromEntries(Object.entries(conversion.residualStyles).map(([k, v]) => [kebabToCamelKey(k), v]))
    : conversion.residualStyles
  const update = isJsx
    ? applyJsxTailwindAttributes(line, tagRegex, conversion.classes, residual, convertedProperties, tokens)
    : applyHtmlTailwindAttributes(line, tagRegex, conversion.classes, residual, convertedProperties, tokens)

  if (update.unsafe) {
    const fallback = inline()
    return { line: fallback.line, modified: fallback.modified, unsafe: true, mode: 'inline', appliedClasses: [], residualStyles: styles }
  }
  return {
    line: update.line, modified: update.modified, unsafe: false, mode: 'tailwind',
    appliedClasses: conversion.classes, residualStyles: residual,
  }
}
```

Lưu ý: `styles.length === 0` là lỗi đánh máy có chủ ý trong snippet trên — **sửa thành `Object.keys(styles).length === 0`** khi áp dụng (test sẽ bắt).

- [ ] **Step 4: Chạy test, phải xanh**

Run: `node --experimental-strip-types --test tests/tailwindSync.test.mjs`
Expected: PASS.

Nếu test "class sinh ra đọc ngược" fail ở một thuộc tính: **không sửa test thành so sánh giá trị**, chỉ giữ assertion `!== undefined`; nếu vẫn fail, thuộc tính đó phải rời khỏi `classesForProperty` (coi như residual inline) và ghi chú `shortcut:` trong `shared/designTokens.ts`.

- [ ] **Step 5: Commit**

```bash
git add electron/main/styleSync.ts tests/tailwindSync.test.mjs package.json
git commit -m "feat(tailwind): tach buildStyleUpdate va sua key casing cho inline fallback (D1-28)"
```

---

### Task 2: `inspect:sync-code` dùng `buildStyleUpdate`, bỏ token rỗng và v3 cứng

**Files:**
- Modify: `electron/main/index.ts:4198-4284` (nhánh Tailwind + fallback inline) và `:4205` (v3 cứng), `:4208-4214` (token rỗng)
- Modify: `shared/api.ts:286-296` (thêm `resolveTailwindMode`? **không** — chỉ dùng hàm thuần ở main)
- Test: `tests/tailwindSync.test.mjs` (Modify — thêm test cho `readProjectStyleTokens` quyết định)

**Interfaces:**
- Consumes: `buildStyleUpdate`, `shouldUseTailwind` (Task 1).
- Produces: `inspect:sync-code` trả `mode`, `appliedClasses`, `residualStyles`, `tailwindVersion` đúng thực tế.

- [ ] **Step 1: Viết test đỏ cho quyết định token**

Thêm vào `tests/tailwindSync.test.mjs`:

```js
import { DEFAULT_DESIGN_TOKENS as DEFAULTS } from '../shared/designTokens.ts'

describe('token mặc định khi dự án chưa có tokens', () => {
  it('bộ token mặc định vẫn chuyển được display/gap', () => {
    const conversion = stylesToTailwindClasses({ display: 'flex', gap: '8px' }, DEFAULTS, { arbitraryValues: true })
    assert.ok(conversion.classes.length > 0)
    assert.equal(conversion.residualStyles.display, undefined)
  })
})
```

Run: `node --experimental-strip-types --test tests/tailwindSync.test.mjs` → test mới PASS ngay (chứng minh chỉ cần dùng DEFAULTS thay vì object rỗng). Nếu FAIL: bộ token mặc định thiếu mapping → bổ sung mapping còn thiếu trong `shared/designTokens.ts` (không đổi shape) rồi chạy lại.

- [ ] **Step 2: Sửa handler**

Trong `electron/main/index.ts`:

1. Import `buildStyleUpdate, shouldUseTailwind, type StyleSyncMode` từ `./styleSync` (cạnh import sẵn có của `applyJsxTailwindAttributes`…).
2. Thay đoạn 4198-4243 (tính `tailwindVersion`, `hasTokens`, `tokens`, `conversion`, `update`, gán `appliedClasses/residualStyles/appliedMode/handled`) bằng:

```ts
const mode = (styleMode || 'auto') as StyleSyncMode
const projectRoot = await resolveProjectRoot(fullPath, projectPath)
const detected = projectRoot ? await detectTailwindVersion(projectRoot) : null
tailwindVersion = detected ?? undefined
const allowTailwind = Boolean(projectRoot) && shouldUseTailwind(mode, detected)
const tokens = projectRoot ? await readProjectDesignTokens(projectRoot) : { ...DEFAULT_DESIGN_TOKENS }
const update = buildStyleUpdate({
  line,
  isJsx,
  tagName,
  styles: finalStyles,
  tokens,
  allowTailwind,
})
line = update.line
appliedMode = update.mode
appliedClasses = update.appliedClasses
residualStyles = update.residualStyles
handled = update.modified
if (update.unsafe) {
  return {
    success: false,
    error: 'Phần tử dùng className/style động nên không ghi class an toàn được. Hãy sửa trực tiếp trong mã nguồn.',
  }
}
```

3. **Xoá toàn bộ nhánh fallback inline 4245-4284** (đã chuyển vào `buildStyleUpdate`). Kiểm tra không còn biến `handled`/`appliedMode` thừa gây lỗi `noUnusedLocals`.
4. Giữ nguyên phần cập nhật text 4289-4309 và phần ghi file/trả kết quả 4311-4338.

Lưu ý: `handled` giờ là `update.modified`; nếu không modified thì rơi xuống nhánh "Không tìm thấy phần tử tương ứng" — sai thông báo. Sửa: chỉ trả lỗi đó khi `tagLineIdx === -1`; nếu `tagLineIdx !== -1` mà `!modified` thì trả `{ success: true, updatedLine: line, mode: appliedMode, appliedClasses, residualStyles }` (không ghi file).

- [ ] **Step 3: Chạy kiểm tra**

```powershell
node --experimental-strip-types --test tests/tailwindSync.test.mjs
npm run typecheck
```
Expected: PASS + typecheck sạch.

- [ ] **Step 4: Commit**

```bash
git add electron/main/index.ts tests/tailwindSync.test.mjs shared/designTokens.ts
git commit -m "feat(tailwind): sync-code dung buildStyleUpdate, token mac dinh va phat hien v3/v4 dung (D1-28)"
```

---

### Task 3: Chọn chế độ sync trên Canvas + phản hồi khi fallback

**Files:**
- Modify: `shared/types.ts:5-37` (`Settings`) và `:410` (`DEFAULT_SETTINGS`)
- Modify: `src/lib/canvasSettings.ts` (toàn bộ, 15 dòng)
- Test: `tests/canvasSettings.test.mjs` (Modify — **3 test deepEqual sẽ đỏ**, phải cập nhật kỳ vọng)
- Modify: `src/components/SettingsDialog.tsx` (tab `canvas`, pane dòng 566-627)
- Modify: `src/components/CanvasArea.tsx:2528-2537`, `:2558-2566` (truyền `styleMode`), `:2568-2573` (thông báo kết quả)

**Interfaces:**
- Produces:
```ts
export interface CanvasSettings {
  smartGuides: boolean
  hoverOutline: boolean
  syncCanvasToTree: boolean
  /** Chế độ ghi style khi bấm "Lưu thay đổi vào mã nguồn". */
  styleSync: 'auto' | 'inline' | 'tailwind'
}
```
- Settings thêm: `canvasStyleSync?: 'auto' | 'inline' | 'tailwind'` (mặc định `'auto'`).

- [ ] **Step 1: Cập nhật test canvasSettings (đỏ trước, xanh sau)**

Trong `tests/canvasSettings.test.mjs`, thêm `styleSync: 'auto'` vào mọi object kỳ vọng và object đầu vào của 3 test hiện có; thêm 1 test mới:

```js
it('truyền chế độ sync style và mặc định auto', () => {
  assert.equal(toWorkspaceCanvasSettings({}).styleSync, 'auto')
  assert.equal(toWorkspaceCanvasSettings({ styleSync: 'tailwind' }).styleSync, 'tailwind')
  assert.equal(toWorkspaceCanvasSettings({ styleSync: 'inline' }).styleSync, 'inline')
  assert.equal(toWorkspaceCanvasSettings({ styleSync: 'bậy' }).styleSync, 'auto')
})
```

Run: `node --experimental-strip-types --test tests/canvasSettings.test.mjs`
Expected: FAIL.

- [ ] **Step 2: Cài đặt**

`src/lib/canvasSettings.ts`:
```ts
export interface CanvasSettings {
  smartGuides: boolean
  hoverOutline: boolean
  syncCanvasToTree: boolean
  styleSync: 'auto' | 'inline' | 'tailwind'
}

export function toWorkspaceCanvasSettings(settings: Partial<CanvasSettings>): CanvasSettings {
  const mode = settings.styleSync
  return {
    smartGuides: settings.smartGuides !== false,
    hoverOutline: settings.hoverOutline !== false,
    syncCanvasToTree: settings.syncCanvasToTree !== false,
    styleSync: mode === 'inline' || mode === 'tailwind' ? mode : 'auto',
  }
}
```

`shared/types.ts`:
- `Settings`: `canvasStyleSync?: 'auto' | 'inline' | 'tailwind' // Chế độ ghi style từ Canvas`
- `DEFAULT_SETTINGS`: `canvasStyleSync: 'auto',`

`SettingsDialog.tsx` — trong pane `canvas` thêm một `.pm-setting` (mẫu dòng 294-306) với `<select>`:
```tsx
<div className="pm-setting">
  <div className="pm-setting__txt">
    <b>Đồng bộ style từ Canvas</b>
    <span>Tự động: dùng Tailwind nếu dự án có cấu hình, ngược lại ghi inline. Inline: luôn ghi style. Tailwind: luôn thử ghi class.</span>
  </div>
  <div className="pm-setting__ctrl">
    <select
      value={settings.canvasStyleSync ?? 'auto'}
      onChange={(event) => onUpdate({ canvasStyleSync: event.target.value as Settings['canvasStyleSync'] })}
    >
      <option value="auto">Tự động</option>
      <option value="inline">Inline style</option>
      <option value="tailwind">Tailwind class</option>
    </select>
  </div>
</div>
```

`CanvasArea.tsx`:
- Trong cả 2 lời gọi `api.inspect.syncCode({...})` thêm `styleMode: canvasSettings.styleSync,`.
- Sau khi lưu thành công (dòng 2568-2573):
```tsx
if (res?.mode === 'tailwind' && res.appliedClasses?.length) {
  showToast(`Đã lưu vào ${sourceLoc!.filePath}: ${res.appliedClasses.length} class Tailwind, ${Object.keys(res.residualStyles || {}).length} thuộc tính giữ inline.`)
} else {
  showToast(`Đã lưu inline vào ${sourceLoc!.filePath} (không chuyển được sang Tailwind).`)
}
```
- Với lưu nhiều phần tử: cộng thêm số phần tử lưu thành công như hiện tại, không đổi.

- [ ] **Step 3: Kiểm tra**

```powershell
node --experimental-strip-types --test tests/canvasSettings.test.mjs
node --experimental-strip-types --test tests/tailwindSync.test.mjs
npm run typecheck
```
Expected: tất cả PASS.

- [ ] **Step 4: Commit**

```bash
git add shared/types.ts src/lib/canvasSettings.ts tests/canvasSettings.test.mjs src/components/SettingsDialog.tsx src/components/CanvasArea.tsx
git commit -m "feat(tailwind): chon che do dong bo style tu Canvas va bao ket qua class/inline (D1-28)"
```

---

## Nghiệm thu thủ công (D1-28)

Chuẩn bị: dự án React + Tailwind v3 (có `tailwind.config.*`) hoặc v4 (`@import "tailwindcss"`), file có `<div className="p-4">`.

1. Settings → **Canvas & Soi** → **Đồng bộ style từ Canvas** = *Tự động*.
2. Mở Canvas, chọn `div`, đổi `padding` = 8px, `background-color` = đỏ → **Lưu thay đổi vào mã nguồn thật**.
3. Kiểm tra file: `className` có `p-2` (thay `p-4`, không cộng dồn) và class màu; `style` không còn `padding`.
4. Bấm Lưu lần 2 (không đổi gì) → file **không đổi** (git diff rỗng).
5. Tải lại canvas (Ctrl+R) → phần tử hiển thị đúng padding/màu mới; mở lại file không thấy `style` trùng lặp.
6. Đổi `writing-mode` (thuộc tính hiếm, không có utility) → Lưu → file có `style={{ writingMode: "vertical-rl" }}`, toast báo "giữ inline".
7. Đặt chế độ **Inline style** → đổi màu → Lưu → không sinh class mới, chỉ `style`.
8. Đặt chế độ **Tailwind class** trên project v4 → Lưu → log/kết quả báo `tailwindVersion: v4` (không phải v3).

## Không làm (YAGNI)

- Không có bảng map thuộc tính tự định nghĩa, không hỗ trợ `hover:`/`md:` do người dùng gõ, không rewrite toàn file, không format lại code.
- Không sửa `stylesToTailwindClasses` cho các thuộc tính ngoài phạm vi đã hỗ trợ sẵn.
