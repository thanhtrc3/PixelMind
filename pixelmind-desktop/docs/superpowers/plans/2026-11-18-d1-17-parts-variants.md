# D1-17 — Variants/Props cho Part — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Cho phép khai báo props + nhiều biến thể (variant) cho một Part tự tạo, chọn biến thể trên thẻ Part và chèn/sao chép ra đúng HTML/CSS/JS; Part cũ (không có props/variants) vẫn đọc và chèn y nguyên.

**Architecture:** Một hàm thuần trong `shared/toolbox.ts` thay placeholder `{{ten}}` bằng giá trị props/variant. Renderer chỉ gọi hàm đó trước khi chèn/sao chép. Main process chỉ validate + lưu bền, không biết gì về placeholder. Không đổi định dạng file cũ: các trường mới là optional.

**Tech Stack:** TypeScript, Electron IPC (`toolbox:*`), React, node:test.

**Spec:** `pixelmind-feature-checklist-2dev.md:100` (D1-17).

## Global Constraints

- Không thêm dependency. Placeholder chỉ dạng `{{name}}` với `name` khớp `[a-zA-Z][\w-]*`.
- Field mới là optional → file `.pixelmind/custom-parts.json` cũ đọc được, không migrate.
- Giá trị variant được chèn vào HTML nên **phải** đi qua `inspectSuspiciousCode` khi lưu.
- Mirror API: `shared/api.ts` + `electron/preload/index.ts` + `src/lib/mock.ts` (không có channel mới ở plan này, chỉ đổi payload).

## Review Focus

- Part cũ (chỉ `html`) chèn ra y hệt trước khi sửa — không bị thêm class/attr rỗng.
- Placeholder không có trong props/variant phải giữ nguyên văn `{{abc}}`, không bị xoá.
- JSON biến thể sai định dạng không được làm hỏng modal hay ghi file.
- Variant chứa `<script>`/`javascript:` bị từ chối ở main (không chỉ ở UI).

---

### Task 1: Mô hình props/variants + hàm resolve (thuần, có test)

**Files:**
- Modify: `shared/toolbox.ts` (thêm sau `CustomPartSource`, khoảng dòng 330; thêm field vào `CustomToolboxPart` dòng 333 và `CustomPartInput` dòng 349)
- Test: `tests/partVariants.test.mjs` (Create)

**Interfaces:**
- Produces:
```ts
export interface PartPropDef {
  /** Tên placeholder trong html/css/js, ví dụ "size" cho {{size}}. */
  name: string
  label?: string
  defaultValue: string
}
export interface PartVariant {
  id: string
  name: string
  /** Giá trị ghi đè lên props mặc định khi chọn variant này. */
  values: Record<string, string>
}
export interface ResolvedPartTemplate {
  html: string
  css: string
  js: string
  values: Record<string, string>
  variantId: string | null
}
export function resolvePartVariant(
  part: Pick<CustomToolboxPart, 'html' | 'css' | 'js' | 'props' | 'variants'>,
  variantId?: string | null,
): ResolvedPartTemplate
export function parsePartVariantJson(text: string):
  | { ok: true; props: PartPropDef[]; variants: PartVariant[] }
  | { ok: false; error: string }
```

- [ ] **Step 1: Viết test đỏ**

Tạo `tests/partVariants.test.mjs`:

```js
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolvePartVariant, parsePartVariantJson } from '../shared/toolbox.ts'

const part = {
  html: '<button class="btn {{size}} {{tone}}">Xin chào {{label}}</button>',
  css: '.btn.{{size}} { padding: {{pad}} }',
  js: '',
  props: [
    { name: 'size', defaultValue: 'md' },
    { name: 'tone', defaultValue: 'primary' },
    { name: 'label', defaultValue: 'Mua' },
    { name: 'pad', defaultValue: '8px' },
  ],
  variants: [
    { id: 'sm', name: 'Nhỏ', values: { size: 'sm', pad: '4px' } },
    { id: 'danger', name: 'Nguy hiểm', values: { tone: 'danger' } },
  ],
}

describe('resolvePartVariant', () => {
  it('áp dụng giá trị biến thể vào html/css, giữ giá trị mặc định cho props còn lại', () => {
    const out = resolvePartVariant(part, 'sm')
    assert.match(out.html, /class="btn sm primary"/)
    assert.match(out.html, /Xin chào Mua/)
    assert.equal(out.css, '.btn.sm { padding: 4px }')
    assert.equal(out.variantId, 'sm')
    assert.equal(out.values.size, 'sm')
    assert.equal(out.values.tone, 'primary')
  })

  it('hai biến thể khác nhau sinh đầu ra khác nhau', () => {
    assert.notEqual(resolvePartVariant(part, 'sm').html, resolvePartVariant(part, 'danger').html)
    assert.match(resolvePartVariant(part, 'danger').html, /btn md danger/)
  })

  it('biến thể không tồn tại thì dùng props mặc định', () => {
    const out = resolvePartVariant(part, 'khong-co')
    assert.match(out.html, /btn md primary/)
    assert.equal(out.variantId, null)
  })

  it('placeholder lạ không bị thay thế hay xoá', () => {
    const out = resolvePartVariant({ html: '<p>{{unknown}} {{size}}</p>', props: [{ name: 'size', defaultValue: 'x' }] })
    assert.equal(out.html, '<p>{{unknown}} x</p>')
  })

  it('part cũ không có props/variants trả về nguyên văn', () => {
    const legacy = { html: '<div class="old">{{name}}</div>', css: '.old{}', js: '' }
    const out = resolvePartVariant(legacy)
    assert.equal(out.html, legacy.html)
    assert.equal(out.css, legacy.css)
    assert.equal(out.variantId, null)
    assert.deepEqual(out.values, {})
  })
})

describe('parsePartVariantJson', () => {
  it('đọc JSON hợp lệ', () => {
    const res = parsePartVariantJson(JSON.stringify({ props: part.props, variants: part.variants }))
    assert.equal(res.ok, true)
    assert.equal(res.variants.length, 2)
  })

  it('báo lỗi khi JSON sai hoặc khoá không hợp lệ', () => {
    assert.equal(parsePartVariantJson('{').ok, false)
    assert.equal(parsePartVariantJson(JSON.stringify({ props: [{ name: '1 bad', defaultValue: 'x' }] })).ok, false)
    assert.equal(parsePartVariantJson(JSON.stringify({ variants: [{ id: '', name: 'A', values: {} }] })).ok, false)
  })
})
```

- [ ] **Step 2: Chạy test, phải đỏ**

Run: `node --experimental-strip-types --test tests/partVariants.test.mjs`
Expected: FAIL — `resolvePartVariant is not a exported function` / `SyntaxError: does not provide an export named`.

- [ ] **Step 3: Cài đặt**

Trong `shared/toolbox.ts` thêm các interface ở trên, và thêm vào 2 interface sẵn có:

```ts
// CustomToolboxPart
/** Props mặc định; placeholder dạng {{name}} trong html/css/js. */
props?: PartPropDef[]
/** Các biến thể chọn khi chèn; rỗng/không có = part cũ. */
variants?: PartVariant[]

// CustomPartInput — cùng 2 field optional y hệt
```

Cài đặt (chép được nguyên văn):

```ts
const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z][\w-]*)\s*\}\}/g
const PROP_NAME_RE = /^[a-zA-Z][\w-]*$/

function fillPlaceholders(text: string, values: Record<string, string>): string {
  if (!text) return ''
  return text.replace(PLACEHOLDER_RE, (raw, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? values[name] : raw,
  )
}

export function resolvePartVariant(
  part: Pick<CustomToolboxPart, 'html' | 'css' | 'js' | 'props' | 'variants'>,
  variantId?: string | null,
): ResolvedPartTemplate {
  const values: Record<string, string> = {}
  for (const prop of part.props ?? []) values[prop.name] = prop.defaultValue
  const variant = variantId ? (part.variants ?? []).find((v) => v.id === variantId) : undefined
  if (variant) for (const [key, value] of Object.entries(variant.values)) values[key] = value
  return {
    html: fillPlaceholders(part.html || '', values),
    css: fillPlaceholders(part.css || '', values),
    js: fillPlaceholders(part.js || '', values),
    values,
    variantId: variant ? variant.id : null,
  }
}
```

`parsePartVariantJson` (dùng cho modal; main có bộ validate riêng ở Task 2):

```ts
export function parsePartVariantJson(text: string):
  | { ok: true; props: PartPropDef[]; variants: PartVariant[] }
  | { ok: false; error: string } {
  const raw = (text || '').trim()
  if (!raw) return { ok: true, props: [], variants: [] }
  let data: unknown
  try { data = JSON.parse(raw) } catch { return { ok: false, error: 'JSON không hợp lệ.' } }
  if (!data || typeof data !== 'object') return { ok: false, error: 'JSON phải là một object.' }
  const input = data as { props?: unknown; variants?: unknown }
  const props = Array.isArray(input.props) ? input.props : []
  const variants = Array.isArray(input.variants) ? input.variants : []
  if (props.length > 20) return { ok: false, error: 'Tối đa 20 props.' }
  if (variants.length > 20) return { ok: false, error: 'Tối đa 20 biến thể.' }
  const seen = new Set<string>()
  const outProps: PartPropDef[] = []
  for (const item of props) {
    const p = item as Partial<PartPropDef>
    const name = String(p?.name ?? '').trim()
    if (!PROP_NAME_RE.test(name)) return { ok: false, error: `Tên prop không hợp lệ: "${name}".` }
    if (seen.has(name)) return { ok: false, error: `Prop bị trùng: "${name}".` }
    seen.add(name)
    outProps.push({ name, label: p.label ? String(p.label) : undefined, defaultValue: String(p.defaultValue ?? '') })
  }
  const outVariants: PartVariant[] = []
  const ids = new Set<string>()
  for (const item of variants) {
    const v = item as Partial<PartVariant>
    const id = String(v?.id ?? '').trim().toLowerCase()
    if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(id)) return { ok: false, error: `Mã biến thể không hợp lệ: "${id}".` }
    if (ids.has(id)) return { ok: false, error: `Biến thể bị trùng mã: "${id}".` }
    ids.add(id)
    const values: Record<string, string> = {}
    for (const [key, value] of Object.entries(v?.values ?? {})) {
      if (!PROP_NAME_RE.test(key)) return { ok: false, error: `Tên prop không hợp lệ trong biến thể "${id}": "${key}".` }
      values[key] = String(value ?? '')
    }
    outVariants.push({ id, name: String(v?.name ?? id), values })
  }
  return { ok: true, props: outProps, variants: outVariants }
}
```

- [ ] **Step 4: Chạy test, phải xanh**

Run: `node --experimental-strip-types --test tests/partVariants.test.mjs`
Expected: PASS (7 test).

- [ ] **Step 5: Commit**

```bash
git add shared/toolbox.ts tests/partVariants.test.mjs
git commit -m "feat(toolbox): mo hinh props va bien the cho Part (D1-17)"
```

---

### Task 2: Validate + lưu bền props/variants ở main

**Files:**
- Modify: `electron/main/customParts.ts` (dòng 178-200 vùng chuẩn hoá; dòng 281-361 `saveCustomPart`)
- Test: `tests/customParts.test.mjs` (Modify — thêm test; file đã có 3 test)

**Interfaces:**
- Consumes: `PartPropDef`, `PartVariant` từ Task 1.
- Produces: `saveCustomPart` nhận thêm `props`/`variants`, tự lọc item sai thay vì làm hỏng cả file; `listCustomParts` trả nguyên field đã lưu.

- [ ] **Step 1: Viết test đỏ**

Thêm vào cuối `tests/customParts.test.mjs` (giữ nguyên import hiện có, bổ sung `writeFile`/`readFile` từ `node:fs/promises` và `join` nếu chưa có):

```js
test('luu va doc lai duoc props/variants cua Part', async () => {
  const dir = await fs.mkdtemp(join(tmpdir(), 'pm-parts-variants-'))
  const saved = await saveCustomPart(dir, {
    name: 'Nút',
    html: '<button class="btn {{tone}}">{{label}}</button>',
    props: [{ name: 'tone', defaultValue: 'primary' }, { name: 'label', defaultValue: 'Mua' }],
    variants: [{ id: 'danger', name: 'Nguy hiểm', values: { tone: 'danger' } }],
  })
  assert.equal(saved.success, true)
  const listed = await listCustomParts(dir)
  const part = listed.parts.find((p) => p.id === saved.part.id)
  assert.equal(part.variants.length, 1)
  assert.equal(part.variants[0].id, 'danger')
  assert.equal(part.props.length, 2)
})

test('Part cu khong co props/variants van doc duoc', async () => {
  const dir = await fs.mkdtemp(join(tmpdir(), 'pm-parts-legacy-'))
  await fs.mkdir(join(dir, '.pixelmind'), { recursive: true })
  await fs.writeFile(
    join(dir, '.pixelmind', 'custom-parts.json'),
    JSON.stringify({
      version: 1,
      parts: [{ id: 'old_1', name: 'Cũ', description: '', html: '<div>{{x}}</div>', language: 'html', tags: [], createdAt: 1, updatedAt: 1 }],
    }),
  )
  const listed = await listCustomParts(dir)
  assert.equal(listed.parts.length, 1)
  assert.equal(listed.parts[0].variants, undefined)
  assert.equal(listed.parts[0].html, '<div>{{x}}</div>')
})

test('tu choi bien the chua ma nguy hiem hoac ten prop sai', async () => {
  const dir = await fs.mkdtemp(join(tmpdir(), 'pm-parts-bad-'))
  const bad = await saveCustomPart(dir, {
    name: 'Xấu',
    html: '<div>{{v}}</div>',
    props: [{ name: 'v', defaultValue: 'ok' }],
    variants: [{ id: 'a', name: 'A', values: { v: '<script>alert(1)</script>' } }],
  })
  assert.equal(bad.success, false)
  assert.match(bad.error, /đáng nghi|nguy hiểm/i)

  const badName = await saveCustomPart(dir, {
    name: 'Sai tên',
    html: '<div></div>',
    props: [{ name: '1 bad', defaultValue: 'x' }],
  })
  assert.equal(badName.success, false)
})
```

- [ ] **Step 2: Chạy test, phải đỏ**

Run: `node --experimental-strip-types --test tests/customParts.test.mjs`
Expected: FAIL — `part.variants` là `undefined`, `saveCustomPart` trả success cho payload xấu.

- [ ] **Step 3: Cài đặt trong `electron/main/customParts.ts`**

Thêm import type `PartPropDef`, `PartVariant` và 2 hàm chuẩn hoá (pure, export được để test nếu muốn):

```ts
const PROP_NAME_RE = /^[a-zA-Z][\w-]*$/
const VARIANT_ID_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/
const MAX_PROPS = 20
const MAX_VARIANTS = 20
const MAX_VALUE = 200

function normalizeProps(raw: unknown): { props: PartPropDef[]; error?: string } {
  if (raw === undefined || raw === null) return { props: [] }
  if (!Array.isArray(raw)) return { props: [], error: 'Danh sách props phải là mảng.' }
  if (raw.length > MAX_PROPS) return { props: [], error: `Tối đa ${MAX_PROPS} props.` }
  const out: PartPropDef[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const name = String((item as PartPropDef)?.name ?? '').trim()
    const value = String((item as PartPropDef)?.defaultValue ?? '')
    if (!PROP_NAME_RE.test(name)) return { props: [], error: `Tên prop không hợp lệ: "${name}".` }
    if (seen.has(name)) return { props: [], error: `Prop bị trùng: "${name}".` }
    if (value.length > MAX_VALUE) return { props: [], error: `Giá trị prop "${name}" quá dài.` }
    seen.add(name)
    out.push({ name, label: (item as PartPropDef).label || undefined, defaultValue: value })
  }
  return { props: out }
}

function normalizeVariants(raw: unknown): { variants: PartVariant[]; error?: string } {
  if (raw === undefined || raw === null) return { variants: [] }
  if (!Array.isArray(raw)) return { variants: [], error: 'Danh sách biến thể phải là mảng.' }
  if (raw.length > MAX_VARIANTS) return { variants: [], error: `Tối đa ${MAX_VARIANTS} biến thể.` }
  const out: PartVariant[] = []
  const ids = new Set<string>()
  for (const item of raw) {
    const v = item as PartVariant
    const id = String(v?.id ?? '').trim().toLowerCase()
    if (!VARIANT_ID_RE.test(id)) return { variants: [], error: `Mã biến thể không hợp lệ: "${id}".` }
    if (ids.has(id)) return { variants: [], error: `Biến thể bị trùng mã: "${id}".` }
    ids.add(id)
    const values: Record<string, string> = {}
    for (const [key, value] of Object.entries(v?.values ?? {})) {
      if (!PROP_NAME_RE.test(key)) return { variants: [], error: `Tên prop không hợp lệ trong biến thể "${id}": "${key}".` }
      const text = String(value ?? '')
      if (text.length > MAX_VALUE) return { variants: [], error: `Giá trị "${key}" trong biến thể "${id}" quá dài.` }
      values[key] = text
    }
    out.push({ id, name: String(v?.name ?? id).trim() || id, values })
  }
  return { variants: out }
}
```

Trong `saveCustomPart`, ngay sau khi kiểm tra `html` (trước khi tạo `part`, khoảng dòng 320):

```ts
const propsResult = normalizeProps(input?.props)
if (propsResult.error) return { success: false, error: propsResult.error }
const variantsResult = normalizeVariants(input?.variants)
if (variantsResult.error) return { success: false, error: variantsResult.error }

// Giá trị biến thể được chèn vào HTML sau này → phải quét như mã
const injected = JSON.stringify({
  props: propsResult.props.map((p) => p.defaultValue),
  variants: variantsResult.variants.flatMap((v) => Object.values(v.values)),
})
const injectedInspection = inspectSuspiciousCode(injected)
if (injectedInspection.suspicious) {
  return {
    success: false,
    error: `Phát hiện mã đáng nghi trong props/biến thể: ${injectedInspection.reasons.join('; ')}.`,
  }
}
```

Trong object `part` thêm (sau `language`):

```ts
props: propsResult.props.length > 0 ? propsResult.props : undefined,
variants: variantsResult.variants.length > 0 ? variantsResult.variants : undefined,
```

Ghi chú: `isStoredPart` (dòng 178) **không đổi** — chỉ kiểm tra các field bắt buộc cũ, nên file cũ vẫn qua.

- [ ] **Step 4: Chạy test, phải xanh**

Run: `node --experimental-strip-types --test tests/customParts.test.mjs`
Expected: PASS (6 test, gồm 3 test cũ).

- [ ] **Step 5: Commit**

```bash
git add electron/main/customParts.ts tests/customParts.test.mjs
git commit -m "feat(toolbox): validate va luu props/bien the Part, tuong thich du lieu cu (D1-17)"
```

---

### Task 3: Chọn biến thể trên thẻ Part + áp dụng khi chèn/sao chép

**Files:**
- Modify: `src/lib/toolboxBridge.ts` (thêm hàm thuần sau `pageFileForRoute`, dòng 22)
- Modify: `src/components/ToolboxPanel.tsx` (dòng 126-170 `partToDragItem`; dòng 487-745 panel + card)
- Modify: `src/components/ide/SavePartModal.tsx` (state dòng 142-153; form: chèn khối mới ngay sau trường description dòng 377-384; `handleSave` dòng 213-258)
- Modify: `package.json` (script `test`: thêm `tests/partVariants.test.mjs`)
- Test: `tests/partVariants.test.mjs` (Modify — thêm 2 test cho `buildPartInsertItem`)

**Interfaces:**
- Consumes: `resolvePartVariant` (Task 1), `CustomToolboxPart`.
- Produces:
```ts
// src/lib/toolboxBridge.ts
export function buildPartInsertItem(
  part: { id: string; name: string; html: string; css?: string; js?: string; props?: PartPropDef[]; variants?: PartVariant[] },
  variantId?: string | null,
): ToolboxDragItem
```

- [ ] **Step 1: Viết test đỏ**

Thêm vào `tests/partVariants.test.mjs`:

```js
import { buildPartInsertItem } from '../src/lib/toolboxBridge.ts'

it('buildPartInsertItem áp dụng biến thể và giữ source part', () => {
  const item = buildPartInsertItem({ id: 'p1', name: 'Nút', ...part }, 'danger')
  assert.equal(item.id, 'part:p1')
  assert.equal(item.source, 'part')
  assert.match(item.html, /btn md danger/)
  assert.doesNotMatch(item.html, /\{\{/)
})

it('buildPartInsertItem với part cũ giữ nguyên html', () => {
  const item = buildPartInsertItem({ id: 'p2', name: 'Cũ', html: '<div>{{x}}</div>' })
  assert.equal(item.html, '<div>{{x}}</div>')
})
```

- [ ] **Step 2: Chạy test, phải đỏ**

Run: `node --experimental-strip-types --test tests/partVariants.test.mjs`
Expected: FAIL — `buildPartInsertItem` không tồn tại.

- [ ] **Step 3: Cài đặt**

`src/lib/toolboxBridge.ts` — thêm import type `PartPropDef, PartVariant` từ `../../shared/toolbox` và `resolvePartVariant`:

```ts
/**
 * Dựng item chèn từ Part, đã thay placeholder theo biến thể đang chọn.
 * Dùng chung cho nút Chèn, kéo-thả và Sao chép mã để đầu ra luôn khớp nhau.
 */
export function buildPartInsertItem(
  part: { id: string; name: string; html: string; css?: string; js?: string; props?: PartPropDef[]; variants?: PartVariant[] },
  variantId?: string | null,
): ToolboxDragItem {
  const resolved = resolvePartVariant(part, variantId)
  return {
    id: `part:${part.id}`,
    name: part.name,
    html: resolved.html,
    css: resolved.css || undefined,
    js: resolved.js || undefined,
    source: 'part',
  }
}
```

`src/components/ToolboxPanel.tsx`:

1. Thêm state cạnh các state dòng 500-504:
```tsx
const [variantByPart, setVariantByPart] = useState<Record<string, string>>({})
```
2. Thay `partToDragItem` (dòng 152-161) bằng:
```tsx
function partToDragItem(part: Part): ToolboxDragItem {
  const custom = customParts.find((p) => p.id === part.id)
  if (!custom) return { id: `part:${part.id}`, name: part.name, html: part.html, css: part.css, js: part.js, source: 'part' }
  return buildPartInsertItem(custom, variantByPart[part.id] ?? custom.variants?.[0]?.id ?? null)
}
```
→ vì hàm này cần `customParts`/`variantByPart` từ closure, hãy khai báo nó **bên trong** component `PartLibraryPanel` (giữ nguyên tên, bỏ bản ở module scope). Cập nhật import: `import { buildPartInsertItem } from '../lib/toolboxBridge'`.
3. Trong `insert` và `copy`: giữ nguyên — chúng đã dùng `partToDragItem(part)`. Riêng `copy` phải dùng cùng kết quả:
```tsx
const copy = async (part: Part) => {
  const item = partToDragItem(part)
  await navigator.clipboard.writeText(item.html)
  onShowToast('ok', `Đã sao chép mã của “${part.name}”.`)
}
```
(giữ phần xử lý lỗi clipboard hiện có nếu khác).
4. Trong `customAsParts` map (dòng 527-555) thêm trường để card biết có biến thể:
```tsx
variants: cp.variants,
```
và khai báo trong type `Part` (`src/data/toolbox.ts:42-54`):
```ts
/** Part tự tạo: danh sách biến thể để hiện ô chọn trên thẻ. */
variants?: import('../../shared/toolbox').PartVariant[]
```
5. Trong card (dòng 672-745), chèn ngay trước hàng nút hành động:
```tsx
{part.isCustom && (part.variants?.length ?? 0) > 0 ? (
  <label className="pm-toolbox-variant" onClick={(event) => event.stopPropagation()}>
    <span>Biến thể</span>
    <select
      value={variantByPart[part.id] ?? part.variants![0].id}
      onChange={(event) => setVariantByPart((prev) => ({ ...prev, [part.id]: event.target.value }))}
    >
      {part.variants!.map((variant) => (
        <option key={variant.id} value={variant.id}>{variant.name}</option>
      ))}
    </select>
  </label>
) : null}
```
CSS: thêm cuối `src/styles/toolbox.css`:
```css
.pm-toolbox-variant { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--muted); }
.pm-toolbox-variant select { height: 24px; border-radius: 4px; background: var(--panel-2); color: var(--text); border: 1px solid var(--line); }
```

`src/components/ide/SavePartModal.tsx`:

1. State: `const [variantJson, setVariantJson] = useState('')`; `const [variantError, setVariantError] = useState('')`.
2. Thêm khối UI sau trường description:
```tsx
<div className="pm-field">
  <label>Biến thể &amp; props (JSON, không bắt buộc)</label>
  <textarea
    rows={5}
    value={variantJson}
    placeholder={'{"props":[{"name":"size","defaultValue":"md"}],"variants":[{"id":"sm","name":"Nhỏ","values":{"size":"sm"}}]}'}
    onChange={(event) => {
      const text = event.target.value
      setVariantJson(text)
      const parsed = parsePartVariantJson(text)
      setVariantError(parsed.ok ? '' : parsed.error)
    }}
  />
  {variantError ? <p className="pm-console-warn">{variantError}</p> : null}
  <p className="pm-hint">Dùng placeholder <code>{'{{size}}'}</code> trong HTML/CSS/JS. Để trống nếu không cần.</p>
</div>
```
(classname của field/hint: dùng đúng class đang có trong file — xem khối description ngay trên; nếu file dùng tên khác thì giữ tên đó.)
3. `handleSave`: trước khi gọi API:
```tsx
const parsedVariants = parsePartVariantJson(variantJson)
if (!parsedVariants.ok) {
  onShowToast('err', `Biến thể chưa hợp lệ: ${parsedVariants.error}`)
  return
}
```
và thêm vào payload `api.toolbox.savePart({ ..., props: parsedVariants.props, variants: parsedVariants.variants })`.
4. Nút Lưu: thêm điều kiện `|| Boolean(variantError)` vào `disabled`.

`package.json`: thêm `tests/partVariants.test.mjs` vào script `test`.

- [ ] **Step 4: Chạy kiểm tra**

```powershell
node --experimental-strip-types --test tests/partVariants.test.mjs
npm run typecheck
```
Expected: 9 test PASS, typecheck sạch.

- [ ] **Step 5: Commit**

```bash
git add src/lib/toolboxBridge.ts src/components/ToolboxPanel.tsx src/components/ide/SavePartModal.tsx src/data/toolbox.ts src/styles/toolbox.css tests/partVariants.test.mjs package.json
git commit -m "feat(toolbox): chon bien the Part va ap dung khi chen/sao chep (D1-17)"
```

---

## Nghiệm thu thủ công (D1-17)

1. `npm run dev`, mở Workbench → tab **Part** → **Tạo Part mới**, dán HTML có `{{size}}`, nhập JSON biến thể 2 mục.
2. Lưu → thẻ Part hiện ô **Biến thể**. Chọn "Nhỏ" → **Chèn** → kiểm tra mã nguồn: `class` chứa `sm`, không còn `{{...}}`.
3. Chọn biến thể khác → **Chèn** → đầu ra khác đúng như JSON (so sánh 2 lần chèn).
4. Mở một Part cũ (lưu trước thay đổi này) → thẻ không có ô Biến thể, chèn ra y nguyên HTML cũ.
5. Bấm **Sao chép mã** với biến thể đang chọn → clipboard khớp đầu ra đã chèn.

## Không làm (YAGNI)

- Không có màn hình sửa Part đã lưu, không có preview riêng cho từng biến thể.
- Không hỗ trợ placeholder trong tên/description hay biểu thức điều kiện.
