/* ══════════════════════════════════════════════════════════════
   Hộp công cụ (Toolbox) — kiểu VS2022
   Kiểu dữ liệu dùng chung giữa renderer, preload và main process.
   ══════════════════════════════════════════════════════════════ */

export type ToolboxGroupId =
  | 'layout'
  | 'typography'
  | 'navigation'
  | 'buttons'
  | 'forms'
  | 'data'
  | 'feedback'
  | 'marketing'
  | 'utility'
  | 'parts'
  | 'project'

export type FrameworkKind =
  | 'html'
  | 'razor'
  | 'jsx'
  | 'vue'
  | 'svelte'
  | 'angular'
  | 'php'
  | 'unknown'

export type InsertPlacement = 'auto' | 'before' | 'after' | 'inside'

export interface ToolboxElement {
  id: string
  name: string
  group: ToolboxGroupId
  tags: string[]
  description: string
  /** HTML template (đã kèm inline style để chèn được vào mọi dự án) */
  html: string
  /** CSS bổ sung, sẽ được chèn thành <style data-pm-toolbox> ngay cạnh phần tử */
  css?: string
  /** JavaScript bổ sung, sẽ được chèn thành <script data-pm-toolbox> đi kèm phần tử */
  js?: string
  /** Template JSX riêng nếu cần (mặc định tự sinh từ html) */
  jsx?: string
  /** Phần tử có thể nhận con (cho phép thả vào trong) */
  container?: boolean
  /** Không cho phép xoá (dùng cho item hệ thống) */
  locked?: boolean
  /** Nguồn: built-in | part | project */
  source?: 'builtin' | 'part' | 'project'
}

export interface ToolboxGroup {
  id: ToolboxGroupId
  label: string
  description: string
}

export const TOOLBOX_GROUPS: ToolboxGroup[] = [
  { id: 'layout', label: 'Bố cục', description: 'Container, section, lưới, cột, khoảng cách' },
  { id: 'typography', label: 'Văn bản', description: 'Tiêu đề, đoạn văn, danh sách, trích dẫn' },
  { id: 'navigation', label: 'Điều hướng', description: 'Navbar, menu, tab, breadcrumb, phân trang' },
  { id: 'buttons', label: 'Nút & Hành động', description: 'Nút chính, phụ, icon, nhóm nút' },
  { id: 'forms', label: 'Biểu mẫu', description: 'Ô nhập, chọn, checkbox, switch, tìm kiếm' },
  { id: 'data', label: 'Dữ liệu', description: 'Card, bảng, giá, badge, avatar, tiến trình' },
  { id: 'feedback', label: 'Phản hồi', description: 'Alert, toast, modal, trạng thái rỗng, 404' },
  { id: 'marketing', label: 'Marketing', description: 'Hero, tính năng, CTA, đánh giá, footer' },
  { id: 'utility', label: 'Tiện ích', description: 'Icon, divider, hình ảnh' },
  { id: 'parts', label: 'Linh kiện mẫu', description: '12 part trong thư mục /toolbox' },
  { id: 'project', label: 'Của dự án', description: 'Component, partial, class CSS tự quét' },
]

/* ── Chuyển HTML template sang JSX cho React/Next ── */
const JSX_ATTR_MAP: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  readonly: 'readOnly',
  maxlength: 'maxLength',
  minlength: 'minLength',
  autocomplete: 'autoComplete',
  autofocus: 'autoFocus',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  contenteditable: 'contentEditable',
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-dasharray': 'strokeDasharray',
  'fill-rule': 'fillRule',
  'clip-rule': 'clipRule',
  'stop-color': 'stopColor',
  'stop-opacity': 'stopOpacity',
}

function cssToJsxObject(css: string): string {
  const entries = css
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf(':')
      if (idx === -1) return null
      const key = part.slice(0, idx).trim()
      const value = part.slice(idx + 1).trim()
      if (!key || !value) return null
      const camel = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
      return `${camel}: '${value.replace(/'/g, "\\'")}'`
    })
    .filter(Boolean)
  return `{ ${entries.join(', ')} }`
}

export function htmlToJsx(html: string): string {
  let out = html
  // style="..." -> style={{ ... }}
  out = out.replace(/style=("|')(.*?)\1/g, (_m, _q, css: string) => `style={${cssToJsxObject(css)}}`)
  // class / for / các thuộc tính camelCase
  out = out.replace(/\b([a-zA-Z-]+)=/g, (match, name: string) => {
    const mapped = JSX_ATTR_MAP[name.toLowerCase()]
    return mapped ? `${mapped}=` : match
  })
  // Thẻ rỗng -> self-closing
  out = out.replace(
    /<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)(\b[^>]*?)\s*\/?>/gi,
    (_m, tag: string, rest: string) => {
      const clean = rest.replace(/\s+$/, '')
      return `<${tag}${clean} />`
    },
  )
  // HTML comment -> JSX comment
  out = out.replace(/<!--([\s\S]*?)-->/g, (_m, body: string) => `{/*${body}*/}`)
  return out
}

export function escapeRazor(html: string): string {
  // Trong Razor, ký tự @ bắt đầu biểu thức — escape thành @@
  return html.replace(/@/g, '@@')
}

/** Chọn template phù hợp với framework của dự án đích */
export function toFramework(element: ToolboxElement, framework: FrameworkKind): string {
  if (framework === 'jsx') {
    return element.jsx ?? htmlToJsx(element.html)
  }
  if (framework === 'razor') {
    return escapeRazor(element.html)
  }
  return element.html
}

export function detectFramework(
  filePath: string,
  projectFramework?: string,
): FrameworkKind {
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.tsx') || lower.endsWith('.jsx')) return 'jsx'
  if (lower.endsWith('.vue')) return 'vue'
  if (lower.endsWith('.svelte')) return 'svelte'
  if (lower.endsWith('.cshtml') || lower.endsWith('.razor')) return 'razor'
  if (lower.endsWith('.php')) return 'php'
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html'
  const fw = (projectFramework || '').toLowerCase()
  if (fw.includes('react') || fw.includes('next')) return 'jsx'
  if (fw.includes('vue') || fw.includes('nuxt')) return 'vue'
  if (fw.includes('svelte')) return 'svelte'
  if (fw.includes('angular')) return 'angular'
  if (fw.includes('razor') || fw.includes('asp')) return 'razor'
  if (fw.includes('php') || fw.includes('laravel')) return 'php'
  return 'html'
}

/* ── Dò tìm phần tử đích trong mã nguồn ── */
export interface ElementMutationTarget {
  uid?: string
  selector?: string
  tagName?: string
  id?: string
  className?: string
  textSnippet?: string
  domPath?: string
  currentPath?: string
  /** Tệp mã nguồn đã dò được (ưu tiên hơn việc quét lại dự án) */
  fullPath?: string
  /** Vị trí đặt phần tử mới */
  placement?: InsertPlacement
  /** Vị trí tương đối trong khung cha (before/after/inside) */
  position?: 'before' | 'after' | 'inside'
  /** Dòng đã dò được từ Code Locator (dùng để chọn đúng ứng viên) */
  lineNumber?: number
}

export interface ElementRangeInfo {
  fullPath: string
  filePath: string
  tagName: string
  startOffset: number
  endOffset: number
  startLine: number
  endLine: number
  openTagStart: number
  openTagEnd: number
  contentStart: number
  contentEnd: number
  closeTagStart: number
  selfClosing: boolean
  indent: string
}

export interface MutationPreview {
  success: boolean
  error?: string
  fullPath?: string
  filePath?: string
  /** Toàn bộ nội dung tệp trước/sau khi thay đổi (dùng cho Undo/Redo) */
  oldText?: string
  newText?: string
  /** Đoạn mã thay đổi thực tế (dùng cho hộp thoại Diff) */
  oldBlock?: string
  newBlock?: string
  startLine?: number
  endLine?: number
  element?: ElementRangeInfo | null
  /** Số phần tử khớp được trong tệp nguồn (dùng cho xoá gộp nhiều phần tử). */
  matchedCount?: number
}

export type ToolboxMutationKind = 'insert' | 'delete' | 'duplicate' | 'attributes' | 'delete-batch' | 'reparent'

export interface ToolboxMutationPayload {
  kind: ToolboxMutationKind
  projectPath: string
  projectFramework?: string
  target?: ElementMutationTarget
  /** Thẻ cha đích (cho thao tác chuyển phân cấp reparent). */
  targetParent?: ElementMutationTarget
  /** Thẻ anh em đích (cho thao tác sắp xếp reorder / chèn trước sau). */
  targetSibling?: ElementMutationTarget
  placement?: InsertPlacement
  index?: number
  /** Nhiều phần tử đích cho thao tác xoá gộp (kind = 'delete-batch'). */
  targets?: ElementMutationTarget[]
  html?: string
  css?: string
  js?: string
  attributes?: Record<string, string | null>
  text?: string
  tagName?: string
  dryRun?: boolean
}

export interface ToolboxWritePayload {
  projectPath?: string
  fullPath: string
  text: string
  backup?: boolean
}

export interface ToolboxWriteResult {
  success: boolean
  error?: string
  backupPath?: string
}

export interface InsertMutationRequest {
  projectPath: string
  projectFramework?: string
  target: ElementMutationTarget
  html: string
  css?: string
  js?: string
  /** Chỉ xem trước, không ghi file */
  dryRun?: boolean
}

export interface DeleteMutationRequest {
  projectPath: string
  projectFramework?: string
  target: ElementMutationTarget
  dryRun?: boolean
}

export interface DuplicateMutationRequest {
  projectPath: string
  projectFramework?: string
  target: ElementMutationTarget
  dryRun?: boolean
}

export interface AttributeMutationRequest {
  projectPath: string
  projectFramework?: string
  target: ElementMutationTarget
  /** null = xoá thuộc tính */
  attributes?: Record<string, string | null>
  text?: string
  tagName?: string
  dryRun?: boolean
}

export interface ProjectComponent {
  id: string
  name: string
  kind: 'component' | 'partial' | 'include' | 'class' | 'asset' | 'route'
  path: string
  detail: string
  /** HTML để chèn khi bấm */
  insertHtml: string
}

export interface ProjectScanResult {
  success: boolean
  error?: string
  framework: FrameworkKind
  components: ProjectComponent[]
  classes: ProjectComponent[]
  assets: ProjectComponent[]
  routes: ProjectComponent[]
}

/* ─────────────────────── Part tự tạo ─────────────────────── */

export type CustomPartLanguage = 'html' | 'jsx'

export interface CustomPartSource {
  /** Đường dẫn tệp nguồn (tuyệt đối) mà vùng chọn được lấy ra. */
  filePath: string
  startLine: number
  endLine: number
}

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

/** Một Part do người dùng lưu từ vùng chọn trong trình soạn thảo hoặc canvas. */
export interface CustomToolboxPart {
  id: string
  name: string
  description: string
  html: string
  css?: string
  js?: string
  preview?: string
  language: CustomPartLanguage
  tags: string[]
  /** Props mặc định; placeholder dạng {{name}} trong html/css/js. */
  props?: PartPropDef[]
  /** Các biến thể chọn khi chèn; rỗng/không có = part cũ. */
  variants?: PartVariant[]
  source?: CustomPartSource
  projectPath?: string
  createdAt: number
  updatedAt: number
}

export interface CustomPartInput {
  name: string
  description?: string
  html: string
  css?: string
  js?: string
  preview?: string
  language?: CustomPartLanguage
  tags?: string[]
  props?: PartPropDef[]
  variants?: PartVariant[]
  source?: CustomPartSource
  projectPath?: string
}

export interface CustomPartListResult {
  success: boolean
  parts: CustomToolboxPart[]
  error?: string
}

export interface CustomPartSaveResult {
  success: boolean
  part?: CustomToolboxPart
  error?: string
}

export interface CustomPartDeleteResult {
  success: boolean
  error?: string
}

/* ─────────────────── Xử lý biến thể & Props cho Part ─────────────────── */

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
