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
}

export type ToolboxMutationKind = 'insert' | 'delete' | 'duplicate' | 'attributes'

export interface ToolboxMutationPayload {
  kind: ToolboxMutationKind
  projectPath: string
  projectFramework?: string
  target?: ElementMutationTarget
  html?: string
  css?: string
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
