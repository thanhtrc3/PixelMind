import type { DesignTokens } from './types'

export const DEFAULT_DESIGN_TOKENS: DesignTokens = {
  colors: [
    // Màu thương hiệu (Brand / Accent)
    { id: 'c_primary', name: 'Primary (Chủ đạo)', value: '#6d5df5', category: 'brand' },
    { id: 'c_accent', name: 'Accent (Nhấn mạnh)', value: '#06b6d4', category: 'brand' },
    // Màu nền & Giao diện (Background & Surface)
    { id: 'c_bg', name: 'Background (Nền trang)', value: '#ffffff', category: 'background' },
    { id: 'c_surface', name: 'Surface (Mặt thẻ Card)', value: '#f8fafc', category: 'background' },
    { id: 'c_border', name: 'Border (Đường viền)', value: '#e2e8f0', category: 'background' },
    // Màu trạng thái (Status)
    { id: 'c_success', name: 'Success (Thành công)', value: '#10b981', category: 'status' },
    { id: 'c_warning', name: 'Warning (Cảnh báo)', value: '#f59e0b', category: 'status' },
    { id: 'c_danger', name: 'Danger (Nguy hiểm/Lỗi)', value: '#ef4444', category: 'status' },
    { id: 'c_info', name: 'Info (Thông tin)', value: '#3b82f6', category: 'status' },
    // Màu trung tính & Chữ (Neutral & Text)
    { id: 'c_text_main', name: 'Text Main (Chữ chính)', value: '#0f172a', category: 'neutral' },
    { id: 'c_text_muted', name: 'Text Muted (Chữ phụ)', value: '#64748b', category: 'neutral' },
  ],
  typography: [
    { id: 't_xs', name: 'Extra Small (xs)', fontSize: '12px', lineHeight: '16px', fontWeight: '400' },
    { id: 't_sm', name: 'Small (sm)', fontSize: '14px', lineHeight: '20px', fontWeight: '400' },
    { id: 't_base', name: 'Base / Body (base)', fontSize: '16px', lineHeight: '24px', fontWeight: '400' },
    { id: 't_lg', name: 'Large (lg)', fontSize: '18px', lineHeight: '28px', fontWeight: '500' },
    { id: 't_xl', name: 'Heading 4 (xl)', fontSize: '20px', lineHeight: '28px', fontWeight: '600' },
    { id: 't_2xl', name: 'Heading 3 (2xl)', fontSize: '24px', lineHeight: '32px', fontWeight: '700' },
    { id: 't_3xl', name: 'Heading 2 (3xl)', fontSize: '30px', lineHeight: '36px', fontWeight: '700' },
    { id: 't_4xl', name: 'Heading 1 (4xl)', fontSize: '36px', lineHeight: '40px', fontWeight: '800' },
  ],
  spacing: [
    { id: 's_1', name: '1 (4px)', value: '4px' },
    { id: 's_2', name: '2 (8px)', value: '8px' },
    { id: 's_3', name: '3 (12px)', value: '12px' },
    { id: 's_4', name: '4 (16px)', value: '16px' },
    { id: 's_5', name: '5 (20px)', value: '20px' },
    { id: 's_6', name: '6 (24px)', value: '24px' },
    { id: 's_8', name: '8 (32px)', value: '32px' },
    { id: 's_10', name: '10 (40px)', value: '40px' },
    { id: 's_12', name: '12 (48px)', value: '48px' },
    { id: 's_16', name: '16 (64px)', value: '64px' },
  ],
  radius: [
    { id: 'r_none', name: 'none (Vuông)', value: '0px' },
    { id: 'r_sm', name: 'sm (Nhỏ)', value: '4px' },
    { id: 'r_md', name: 'md (Vừa)', value: '8px' },
    { id: 'r_lg', name: 'lg (Lớn)', value: '12px' },
    { id: 'r_xl', name: 'xl (Rất lớn)', value: '16px' },
    { id: 'r_full', name: 'full (Tròn/Viên thuốc)', value: '9999px' },
  ],
  breakpoints: [
    { id: 'bp_xs', name: 'xs (Mobile nhỏ)', minWidth: 375, maxWidth: 639, icon: 'mobile', description: 'Điện thoại di động màn hình nhỏ' },
    { id: 'bp_sm', name: 'sm (Mobile lớn)', minWidth: 640, maxWidth: 767, icon: 'mobile', description: 'Điện thoại ngang, phablet' },
    { id: 'bp_md', name: 'md (Tablet)', minWidth: 768, maxWidth: 1023, icon: 'tablet', description: 'Máy tính bảng iPad/Tablet' },
    { id: 'bp_lg', name: 'lg (Laptop/Desktop)', minWidth: 1024, maxWidth: 1279, icon: 'desktop', description: 'Màn hình máy tính xách tay & PC' },
    { id: 'bp_xl', name: 'xl (Desktop lớn)', minWidth: 1280, maxWidth: 1535, icon: 'desktop', description: 'Màn hình máy tính độ phân giải cao' },
    { id: 'bp_2xl', name: '2xl (Ultra Wide)', minWidth: 1536, icon: 'wide', description: 'Màn hình siêu rộng & TV' },
  ],
  customVars: [
    { id: 'v_header_h', name: '--header-height', value: '64px', category: 'layout', scope: ':root', description: 'Chiều cao thanh điều hướng chính' },
    { id: 'v_sidebar_w', name: '--sidebar-width', value: '280px', category: 'layout', scope: ':root', description: 'Độ rộng sidebar tiện ích' },
    { id: 'v_shadow_sm', name: '--shadow-sm', value: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', category: 'effect', scope: ':root', description: 'Đổ bóng nhẹ cho nút bấm & thẻ' },
    { id: 'v_shadow_md', name: '--shadow-md', value: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', category: 'effect', scope: ':root', description: 'Đổ bóng vừa cho menu/dropdown' },
    { id: 'v_z_modal', name: '--z-modal', value: '9999', category: 'z-index', scope: ':root', description: 'Thứ tự lớp hiển thị hộp thoại' },
  ],
}

/** Chuyển token ID thành tên biến CSS W3C chuẩn */
export function tokenToCssVarName(
  type: 'color' | 'font' | 'spacing' | 'radius' | 'breakpoint' | 'custom',
  id: string,
): string {
  if (type === 'custom') {
    return id.startsWith('--') ? id : `--${id.replace(/^v_/, '').replace(/_/g, '-')}`
  }
  const clean = id.replace(/^[a-z]+_/, '').replace(/_/g, '-')
  switch (type) {
    case 'color':
      return `--color-${clean}`
    case 'font':
      return `--font-size-${clean}`
    case 'spacing':
      return `--spacing-${clean}`
    case 'radius':
      return `--radius-${clean}`
    case 'breakpoint':
      return `--breakpoint-${clean}`
  }
}

/** Tự động sinh nội dung file variables.css chuẩn W3C */
export function generateVariablesCss(tokens: DesignTokens): string {
  const colorLines = tokens.colors
    .map((c) => `  ${tokenToCssVarName('color', c.id)}: ${c.value}; /* ${c.name} */`)
    .join('\n')

  const typoLines = tokens.typography
    .map((t) => `  ${tokenToCssVarName('font', t.id)}: ${t.fontSize}; /* line-height: ${t.lineHeight} */`)
    .join('\n')

  const spacingLines = tokens.spacing
    .map((s) => `  ${tokenToCssVarName('spacing', s.id)}: ${s.value};`)
    .join('\n')

  const radiusLines = tokens.radius
    .map((r) => `  ${tokenToCssVarName('radius', r.id)}: ${r.value};`)
    .join('\n')

  const breakpoints = tokens.breakpoints || DEFAULT_DESIGN_TOKENS.breakpoints || []
  const bpLines = breakpoints
    .map((b) => `  ${tokenToCssVarName('breakpoint', b.id)}: ${b.minWidth}px; /* ${b.name} */`)
    .join('\n')

  const customVars = tokens.customVars || DEFAULT_DESIGN_TOKENS.customVars || []
  const customLines = customVars
    .map((v) => `  ${v.name.startsWith('--') ? v.name : `--${v.name}`}: ${v.value};${v.description ? ` /* ${v.description} */` : ''}`)
    .join('\n')

  const mediaBlocks = breakpoints
    .map(
      (b) => `/* Breakpoint ${b.name}: ${b.minWidth}px */
@media (min-width: ${b.minWidth}px) {
  /* Style thích ứng cho màn hình từ ${b.name} trở lên */
}`,
    )
    .join('\n\n')

  return `/* ═══════════════════════════════════════════════════════════════
   PixelMind Design Tokens — Hệ thống quy chuẩn thiết kế dự án
   Tự động sinh bởi PixelMind Theme & Design Tokens Manager
   ═══════════════════════════════════════════════════════════════ */

:root {
  /* ── 1. Bảng màu chuẩn (Color Palette) ── */
${colorLines}

  /* ── 2. Thang tỷ lệ phông chữ (Typography Scale) ── */
${typoLines}

  /* ── 3. Thang khoảng cách (Spacing Scale) ── */
${spacingLines}

  /* ── 4. Bán kính bo góc (Border Radius Scale) ── */
${radiusLines}

  /* ── 5. Điểm ngắt Responsive (Breakpoints) ── */
${bpLines}

  /* ── 6. Biến CSS tùy biến (Custom Variables) ── */
${customLines}
}

/* ═══════════════════════════════════════════════════════════════
   Media Queries mẫu theo hệ thống Breakpoints chuẩn
   ═══════════════════════════════════════════════════════════════ */
${mediaBlocks}
`
}

/** Chuyển token ID thành key Tailwind (bỏ tiền tố `c_`, `t_`, `s_`, `r_`). */
export function tokenIdToTailwindKey(id: string): string {
  return id.replace(/^[a-z]_/, '').replace(/_/g, '-')
}

export interface TailwindConfigOptions {
  /** Dùng biến CSS (`var(--color-primary)`) thay vì giá trị literal. Mặc định true. */
  useCssVars?: boolean
}

/**
 * Sinh nội dung `tailwind.tokens.js` (theme.extend cho Tailwind v3).
 * Mặc định dùng biến CSS để class luôn bám theo `variables.css`.
 */
export function generateTailwindTokensConfig(
  tokens: DesignTokens,
  options: TailwindConfigOptions = {}
): string {
  const useCssVars = options.useCssVars !== false

  const colorValue = (id: string, value: string): string =>
    useCssVars ? `var(${tokenToCssVarName('color', id)})` : value
  const spacingValue = (id: string, value: string): string =>
    useCssVars ? `var(${tokenToCssVarName('spacing', id)})` : value
  const radiusValue = (id: string, value: string): string =>
    useCssVars ? `var(${tokenToCssVarName('radius', id)})` : value

  const colorsObj: Record<string, string> = {}
  for (const c of tokens.colors) {
    colorsObj[tokenIdToTailwindKey(c.id)] = colorValue(c.id, c.value)
  }

  const fontObj: Record<string, [string, { lineHeight: string }]> = {}
  for (const t of tokens.typography) {
    fontObj[tokenIdToTailwindKey(t.id)] = [
      useCssVars ? `var(${tokenToCssVarName('font', t.id)})` : t.fontSize,
      { lineHeight: t.lineHeight },
    ]
  }

  const spacingObj: Record<string, string> = {}
  for (const s of tokens.spacing) {
    spacingObj[tokenIdToTailwindKey(s.id)] = spacingValue(s.id, s.value)
  }

  const radiusObj: Record<string, string> = {}
  for (const r of tokens.radius) {
    radiusObj[tokenIdToTailwindKey(r.id)] = radiusValue(r.id, r.value)
  }

  const screensObj: Record<string, string> = {}
  const breakpoints = tokens.breakpoints || DEFAULT_DESIGN_TOKENS.breakpoints || []
  for (const b of breakpoints) {
    const key = b.id.replace(/^bp_/, '').replace(/_/g, '-')
    screensObj[key] = `${b.minWidth}px`
  }

  return `/**
 * PixelMind Design Tokens for Tailwind CSS (v3)
 * Nhúng vào tailwind.config.js:
 *   const tokens = require('./tailwind.tokens.js')
 *   module.exports = { theme: { extend: tokens } }
 *
 * File này được sinh tự động bởi PixelMind. Đừng sửa tay.
 */

module.exports = {
  colors: ${JSON.stringify(colorsObj, null, 4)},
  fontSize: ${JSON.stringify(fontObj, null, 4)},
  spacing: ${JSON.stringify(spacingObj, null, 4)},
  borderRadius: ${JSON.stringify(radiusObj, null, 4)},
  screens: ${JSON.stringify(screensObj, null, 4)},
};
`
}

/** Sinh `@theme` cho Tailwind CSS v4 (tailwind.tokens.css). */
export function generateTailwindThemeCss(tokens: DesignTokens): string {
  const colorLines = tokens.colors
    .map((c) => `  --color-${tokenIdToTailwindKey(c.id)}: ${c.value};`)
    .join('\n')

  const typographyLines = tokens.typography
    .map((t) => {
      const key = tokenIdToTailwindKey(t.id)
      return `  --text-${key}: ${t.fontSize};\n  --text-${key}--line-height: ${t.lineHeight};`
    })
    .join('\n')

  const spacingLines = tokens.spacing
    .map((s) => `  --spacing-${tokenIdToTailwindKey(s.id)}: ${s.value};`)
    .join('\n')

  const radiusLines = tokens.radius
    .map((r) => `  --radius-${tokenIdToTailwindKey(r.id)}: ${r.value};`)
    .join('\n')

  return `/* PixelMind Design Tokens — Tailwind CSS v4 @theme (tự động sinh) */
@theme {
${colorLines}

${typographyLines}

${spacingLines}

${radiusLines}
}
`
}

/** Phân tích file variables.css hiện có để trích xuất tokens nếu có */
export function parseVariablesCss(cssText: string): Partial<DesignTokens> {
  const result: Partial<DesignTokens> = {}
  const colorMatches = cssText.matchAll(/--color-([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g)
  const colors = []
  for (const m of colorMatches) {
    const id = `c_${m[1].replace(/-/g, '_')}`
    colors.push({
      id,
      name: m[1],
      value: m[2].trim(),
      category: (m[1].includes('success') || m[1].includes('warning') || m[1].includes('danger')
        ? 'status'
        : m[1].includes('bg') || m[1].includes('surface')
          ? 'background'
          : 'brand') as 'brand' | 'background' | 'status' | 'neutral',
    })
  }
  if (colors.length > 0) result.colors = colors

  // Breakpoints
  const bpMatches = cssText.matchAll(/--breakpoint-([a-zA-Z0-9_-]+)\s*:\s*([0-9]+)px;/g)
  const breakpoints = []
  for (const m of bpMatches) {
    const minWidth = parseInt(m[2], 10)
    breakpoints.push({
      id: `bp_${m[1].replace(/-/g, '_')}`,
      name: m[1],
      minWidth,
      icon: (minWidth <= 640 ? 'mobile' : minWidth <= 1024 ? 'tablet' : minWidth <= 1440 ? 'desktop' : 'wide') as 'mobile' | 'tablet' | 'desktop' | 'wide',
    })
  }
  if (breakpoints.length > 0) result.breakpoints = breakpoints

  return result
}

/* ═══════════════════════════════════════════════════════════════
   Tailwind 2-way: style ↔ className
   - stylesToTailwindClasses: đổi style sang utility class
   - tailwindClassesToStyles: đọc className thành style
   - mergeTailwindClasses: gộp class, tự xoá class xung đột
   ═══════════════════════════════════════════════════════════════ */

export interface TailwindTokenOptions {
  /** Tiền tố utility class của dự án, ví dụ `tw-`. */
  prefix?: string
  /** Cho phép sinh class giá trị tuỳ ý, ví dụ `p-[18px]`. Mặc định true. */
  arbitraryValues?: boolean
}

export interface AppliedTailwindClass {
  property: string
  value: string
  className: string
}

export interface StylesToTailwindResult {
  classes: string[]
  /** Các style chưa chuyển được — vẫn phải ghi inline. */
  residualStyles: Record<string, string>
  applied: AppliedTailwindClass[]
  unsupported: string[]
}

export interface TailwindClassesToStylesResult {
  styles: Record<string, string>
  knownClasses: string[]
  unknownClasses: string[]
  variantClasses: string[]
}

interface TokenScale {
  byKey: Map<string, string>
  byValue: Map<string, string>
}

interface TailwindTokenIndex {
  prefix: string
  arbitrary: boolean
  colors: TokenScale
  spacing: TokenScale
  radius: TokenScale
  fontSizes: TokenScale
}

const DEFAULT_SPACING_ENTRIES: Array<[string, string]> = [
  ['0', '0px'],
  ['0.5', '2px'],
  ['1', '4px'],
  ['1.5', '6px'],
  ['2', '8px'],
  ['2.5', '10px'],
  ['3', '12px'],
  ['3.5', '14px'],
  ['4', '16px'],
  ['5', '20px'],
  ['6', '24px'],
  ['7', '28px'],
  ['8', '32px'],
  ['9', '36px'],
  ['10', '40px'],
  ['11', '44px'],
  ['12', '48px'],
  ['14', '56px'],
  ['16', '64px'],
  ['20', '80px'],
  ['24', '96px'],
  ['28', '112px'],
  ['32', '128px'],
  ['36', '144px'],
  ['40', '160px'],
  ['44', '176px'],
  ['48', '192px'],
  ['52', '208px'],
  ['56', '224px'],
  ['60', '240px'],
  ['64', '256px'],
  ['72', '288px'],
  ['80', '320px'],
  ['96', '384px'],
]

const DEFAULT_RADIUS_ENTRIES: Array<[string, string]> = [
  ['none', '0px'],
  ['sm', '2px'],
  ['', '4px'],
  ['md', '6px'],
  ['lg', '8px'],
  ['xl', '12px'],
  ['2xl', '16px'],
  ['3xl', '24px'],
  ['full', '9999px'],
]

const DEFAULT_FONT_SIZE_ENTRIES: Array<[string, string]> = [
  ['xs', '12px'],
  ['sm', '14px'],
  ['base', '16px'],
  ['lg', '18px'],
  ['xl', '20px'],
  ['2xl', '24px'],
  ['3xl', '30px'],
  ['4xl', '36px'],
  ['5xl', '48px'],
  ['6xl', '60px'],
  ['7xl', '72px'],
  ['8xl', '96px'],
  ['9xl', '128px'],
]

const LINE_HEIGHT_BY_KEY: Record<string, string> = {
  none: '1',
  tight: '1.25',
  snug: '1.375',
  normal: '1.5',
  relaxed: '1.625',
  loose: '2',
  '3': '12px',
  '4': '16px',
  '5': '20px',
  '6': '24px',
  '7': '28px',
  '8': '32px',
  '9': '36px',
  '10': '40px',
}

const FONT_WEIGHT_BY_KEY: Record<string, string> = {
  thin: '100',
  extralight: '200',
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
}

const FONT_WEIGHT_KEY_BY_VALUE: Record<string, string> = {
  '100': 'thin',
  '200': 'extralight',
  '300': 'light',
  '400': 'normal',
  '500': 'medium',
  '600': 'semibold',
  '700': 'bold',
  '800': 'extrabold',
  '900': 'black',
}

const DISPLAY_CLASSES: Record<string, string> = {
  block: 'block',
  'inline-block': 'inline-block',
  inline: 'inline',
  flex: 'flex',
  'inline-flex': 'inline-flex',
  grid: 'grid',
  'inline-grid': 'inline-grid',
  hidden: 'none',
  contents: 'contents',
  table: 'table',
  'flow-root': 'flow-root',
  'list-item': 'list-item',
}

const POSITION_CLASSES: Record<string, string> = {
  static: 'static',
  fixed: 'fixed',
  absolute: 'absolute',
  relative: 'relative',
  sticky: 'sticky',
}

const FLEX_DIRECTION_CLASSES: Record<string, string> = {
  'flex-row': 'row',
  'flex-row-reverse': 'row-reverse',
  'flex-col': 'column',
  'flex-col-reverse': 'column-reverse',
}

const FLEX_WRAP_CLASSES: Record<string, string> = {
  'flex-wrap': 'wrap',
  'flex-wrap-reverse': 'wrap-reverse',
  'flex-nowrap': 'nowrap',
}

const ALIGN_ITEMS_CLASSES: Record<string, string> = {
  'items-start': 'flex-start',
  'items-end': 'flex-end',
  'items-center': 'center',
  'items-baseline': 'baseline',
  'items-stretch': 'stretch',
}

const JUSTIFY_CONTENT_CLASSES: Record<string, string> = {
  'justify-start': 'flex-start',
  'justify-end': 'flex-end',
  'justify-center': 'center',
  'justify-between': 'space-between',
  'justify-around': 'space-around',
  'justify-evenly': 'space-evenly',
}

const TEXT_ALIGN_CLASSES: Record<string, string> = {
  'text-left': 'left',
  'text-center': 'center',
  'text-right': 'right',
  'text-justify': 'justify',
  'text-start': 'start',
  'text-end': 'end',
}

const OVERFLOW_CLASSES: Record<string, string> = {
  'overflow-auto': 'auto',
  'overflow-hidden': 'hidden',
  'overflow-clip': 'clip',
  'overflow-visible': 'visible',
  'overflow-scroll': 'scroll',
}

const BORDER_STYLE_CLASSES: Record<string, string> = {
  'border-solid': 'solid',
  'border-dashed': 'dashed',
  'border-dotted': 'dotted',
  'border-double': 'double',
  'border-none': 'none',
  'border-hidden': 'hidden',
}

/** Thuộc tính shorthand → các thuộc tính con, dùng khi xét xung đột class. */
const SHORTHAND_PROPERTIES: Record<string, string[]> = {
  padding: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
  margin: ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'],
  gap: ['rowGap', 'columnGap'],
  borderWidth: ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'],
  borderColor: ['borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'],
  borderRadius: [
    'borderTopLeftRadius',
    'borderTopRightRadius',
    'borderBottomRightRadius',
    'borderBottomLeftRadius',
  ],
  overflow: ['overflowX', 'overflowY'],
}

function normalizeScaleValue(value: string): string {
  const raw = String(value).trim().toLowerCase().replace(/\s+/g, ' ')
  if (raw === '0') return '0px'
  return raw
}

function normalizeColorValue(value: string): string {
  const raw = String(value).trim().toLowerCase().replace(/\s+/g, '')
  if (/^#[0-9a-f]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`
  }
  return raw
}

function pxKey(value: string): string | null {
  const raw = normalizeScaleValue(value)
  if (raw === '0px') return 'px:0'
  const match = raw.match(/^(-?\d*\.?\d+)(px|rem|em)$/)
  if (!match) return null
  const factor = match[2] === 'px' ? 1 : 16
  const px = Number(match[1]) * factor
  return `px:${Math.round(px * 1000) / 1000}`
}

function createScale(): TokenScale {
  return { byKey: new Map(), byValue: new Map() }
}

function addScaleValue(scale: TokenScale, key: string, value: string): void {
  if (!scale.byKey.has(key)) scale.byKey.set(key, value)
  const norm = normalizeScaleValue(value)
  if (!scale.byValue.has(norm)) scale.byValue.set(norm, key)
  const px = pxKey(norm)
  if (px && !scale.byValue.has(px)) scale.byValue.set(px, key)
}

function lookupScaleValue(scale: TokenScale, value: string): string | null {
  const norm = normalizeScaleValue(value)
  if (scale.byValue.has(norm)) return scale.byValue.get(norm) ?? null
  const px = pxKey(norm)
  if (px && scale.byValue.has(px)) return scale.byValue.get(px) ?? null
  return null
}

function addColorValue(scale: TokenScale, key: string, value: string): void {
  const normalized = normalizeColorValue(value)
  if (!scale.byValue.has(normalized)) scale.byValue.set(normalized, key)
  addScaleValue(scale, key, value)
}

function lookupColorValue(scale: TokenScale, value: string): string | null {
  const normalized = normalizeColorValue(value)
  if (scale.byValue.has(normalized)) return scale.byValue.get(normalized) ?? null
  return lookupScaleValue(scale, value)
}

function buildTailwindIndex(tokens: DesignTokens, options: TailwindTokenOptions = {}): TailwindTokenIndex {
  const index: TailwindTokenIndex = {
    prefix: options.prefix ?? '',
    arbitrary: options.arbitraryValues !== false,
    colors: createScale(),
    spacing: createScale(),
    radius: createScale(),
    fontSizes: createScale(),
  }

  for (const color of tokens.colors ?? []) {
    const key = tokenIdToTailwindKey(color.id)
    addColorValue(index.colors, key, color.value)
    addColorValue(index.colors, key, `var(${tokenToCssVarName('color', color.id)})`)
  }
  for (const spacing of tokens.spacing ?? []) {
    const key = tokenIdToTailwindKey(spacing.id)
    addScaleValue(index.spacing, key, spacing.value)
    addScaleValue(index.spacing, key, `var(${tokenToCssVarName('spacing', spacing.id)})`)
  }
  for (const radius of tokens.radius ?? []) {
    const key = tokenIdToTailwindKey(radius.id)
    addScaleValue(index.radius, key, radius.value)
    addScaleValue(index.radius, key, `var(${tokenToCssVarName('radius', radius.id)})`)
  }
  for (const typography of tokens.typography ?? []) {
    const key = tokenIdToTailwindKey(typography.id)
    addScaleValue(index.fontSizes, key, typography.fontSize)
    addScaleValue(index.fontSizes, key, `var(${tokenToCssVarName('font', typography.id)})`)
  }

  // Bổ sung thang mặc định của Tailwind để đọc/ghi được cả class không nằm trong token.
  for (const [key, value] of DEFAULT_SPACING_ENTRIES) addScaleValue(index.spacing, key, value)
  for (const [key, value] of DEFAULT_RADIUS_ENTRIES) addScaleValue(index.radius, key, value)
  for (const [key, value] of DEFAULT_FONT_SIZE_ENTRIES) addScaleValue(index.fontSizes, key, value)
  addColorValue(index.colors, 'white', '#ffffff')
  addColorValue(index.colors, 'black', '#000000')
  return index
}

function escapeArbitraryValue(value: string): string {
  return value.trim().replace(/\s+/g, '_').replace(/['"]/g, '')
}

function arbitraryClass(prefix: string, keyword: string, value: string): string {
  return `${prefix}${keyword}-[${escapeArbitraryValue(value)}]`
}

function matchScaleClass(
  index: TailwindTokenIndex,
  scale: TokenScale,
  keyword: string,
  value: string
): string | null {
  const key = lookupScaleValue(scale, value)
  if (key !== null) return `${index.prefix}${keyword}-${key}`
  if (!index.arbitrary) return null
  return arbitraryClass(index.prefix, keyword, value)
}

function matchColorClass(index: TailwindTokenIndex, keyword: string, value: string): string | null {
  const raw = String(value).trim()
  const lower = raw.toLowerCase()
  if (lower === 'transparent') return `${index.prefix}${keyword}-transparent`
  if (lower === 'currentcolor' || lower === 'current-color') return `${index.prefix}${keyword}-current`
  if (lower === 'inherit' || lower === 'initial' || lower === 'unset') return null
  const key = lookupColorValue(index.colors, raw)
  if (key !== null) return `${index.prefix}${keyword}-${key}`
  if (!index.arbitrary) return null
  return arbitraryClass(index.prefix, keyword, raw)
}

function resolveNegative(value: string): { negative: boolean; value: string } {
  const raw = String(value).trim()
  if (raw.startsWith('-')) return { negative: true, value: raw.slice(1).trim() }
  return { negative: false, value: raw }
}

function classesForSpacing(
  index: TailwindTokenIndex,
  keyword: string,
  value: string,
  allowNegative: boolean
): string | null {
  const resolved = allowNegative
    ? resolveNegative(value)
    : { negative: false, value: String(value).trim() }
  const positive = resolved.value
  if (positive === 'auto' && (keyword.startsWith('m') || keyword === 'top' || keyword === 'right' || keyword === 'bottom' || keyword === 'left')) {
    return `${index.prefix}${keyword}-auto`
  }
  const key = lookupScaleValue(index.spacing, positive)
  const sign = resolved.negative ? '-' : ''
  if (key !== null) return `${sign}${index.prefix}${keyword}-${key}`
  if (!index.arbitrary) return null
  return `${sign}${arbitraryClass(index.prefix, keyword, positive)}`
}

function classNameForSize(
  index: TailwindTokenIndex,
  keyword: string,
  value: string,
  axis: 'x' | 'y'
): string | null {
  const raw = normalizeScaleValue(value)
  const special: Record<string, string> = {
    auto: 'auto',
    '100%': 'full',
    'fit-content': 'fit',
    'min-content': 'min',
    'max-content': 'max',
  }
  if (axis === 'x' && raw === '100vw') return `${index.prefix}${keyword}-screen`
  if (axis === 'y' && raw === '100vh') return `${index.prefix}${keyword}-screen`
  if (special[raw]) return `${index.prefix}${keyword}-${special[raw]}`
  if (keyword.startsWith('max-') || keyword.startsWith('min-')) {
    if (!index.arbitrary) return null
    return arbitraryClass(index.prefix, keyword, raw)
  }
  return matchScaleClass(index, index.spacing, keyword, raw)
}

function borderWidthClass(index: TailwindTokenIndex, keyword: string, value: string): string | null {
  const raw = normalizeScaleValue(value)
  if (raw === '1px') return `${index.prefix}${keyword}`
  if (/^(0|2|4|8)px$/.test(raw)) return `${index.prefix}${keyword}-${raw.replace('px', '')}`
  if (!index.arbitrary) return null
  return arbitraryClass(index.prefix, keyword, raw)
}

function wrap(value: string | null): string[] | null {
  return value ? [value] : null
}

function wrapKeyed(
  index: TailwindTokenIndex,
  map: Record<string, string>,
  keyword: string,
  value: string
): string[] | null {
  const raw = normalizeScaleValue(value)
  if (Object.values(map).includes(raw)) return [`${index.prefix}${keyword}-${raw}`]
  if (!index.arbitrary) return null
  return [arbitraryClass(index.prefix, keyword, raw)]
}

function classesForProperty(
  property: string,
  value: string,
  index: TailwindTokenIndex
): string[] | null {
  switch (property) {
    case 'color':
      return wrap(matchColorClass(index, 'text', value))
    case 'backgroundColor':
      return wrap(matchColorClass(index, 'bg', value))
    case 'borderColor':
      return wrap(matchColorClass(index, 'border', value))
    case 'borderTopColor':
      return wrap(matchColorClass(index, 'border-t', value))
    case 'borderRightColor':
      return wrap(matchColorClass(index, 'border-r', value))
    case 'borderBottomColor':
      return wrap(matchColorClass(index, 'border-b', value))
    case 'borderLeftColor':
      return wrap(matchColorClass(index, 'border-l', value))
    case 'fontSize':
      return wrap(matchScaleClass(index, index.fontSizes, 'text', value))
    case 'fontWeight': {
      const key = FONT_WEIGHT_KEY_BY_VALUE[normalizeScaleValue(value)]
      return key ? [`${index.prefix}font-${key}`] : null
    }
    case 'fontStyle': {
      const raw = normalizeScaleValue(value)
      if (raw === 'italic') return [`${index.prefix}italic`]
      if (raw === 'normal') return [`${index.prefix}not-italic`]
      return null
    }
    case 'lineHeight': {
      const raw = normalizeScaleValue(value)
      const key = Object.entries(LINE_HEIGHT_BY_KEY).find(([, v]) => v === raw)?.[0]
      if (key) return [`${index.prefix}leading-${key}`]
      if (!index.arbitrary) return null
      return [arbitraryClass(index.prefix, 'leading', raw)]
    }
    case 'textAlign': {
      const map: Record<string, string> = {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right',
        justify: 'text-justify',
        start: 'text-start',
        end: 'text-end',
      }
      const cls = map[normalizeScaleValue(value)]
      return cls ? [`${index.prefix}${cls}`] : null
    }
    case 'textDecorationLine':
    case 'textDecoration': {
      const raw = normalizeScaleValue(value)
      if (raw.includes('underline') && !raw.includes('line-through')) return [`${index.prefix}underline`]
      if (raw.includes('line-through')) return [`${index.prefix}line-through`]
      if (raw === 'none') return [`${index.prefix}no-underline`]
      return null
    }
    case 'whiteSpace': {
      const raw = normalizeScaleValue(value)
      const map: Record<string, string> = {
        normal: 'whitespace-normal',
        nowrap: 'whitespace-nowrap',
        pre: 'whitespace-pre',
        'pre-line': 'whitespace-pre-line',
        'pre-wrap': 'whitespace-pre-wrap',
        'break-spaces': 'whitespace-break-spaces',
      }
      return map[raw] ? [`${index.prefix}${map[raw]}`] : null
    }
    case 'display': {
      const raw = normalizeScaleValue(value)
      const cls = Object.entries(DISPLAY_CLASSES).find(([, v]) => v === raw)?.[0]
      return cls ? [`${index.prefix}${cls}`] : null
    }
    case 'position': {
      const cls = POSITION_CLASSES[normalizeScaleValue(value)]
      return cls ? [`${index.prefix}${cls}`] : null
    }
    case 'flexDirection': {
      const normalized = normalizeScaleValue(value)
      const cls = Object.entries(FLEX_DIRECTION_CLASSES).find(([, v]) => v === normalized)?.[0]
      return cls ? [`${index.prefix}${cls}`] : null
    }
    case 'flexWrap': {
      const normalized = normalizeScaleValue(value)
      const cls = Object.entries(FLEX_WRAP_CLASSES).find(([, v]) => v === normalized)?.[0]
      return cls ? [`${index.prefix}${cls}`] : null
    }
    case 'alignItems': {
      const normalized = normalizeScaleValue(value)
      const cls = Object.entries(ALIGN_ITEMS_CLASSES).find(([, v]) => v === normalized)?.[0]
      return cls ? [`${index.prefix}${cls}`] : null
    }
    case 'justifyContent': {
      const normalized = normalizeScaleValue(value)
      const cls = Object.entries(JUSTIFY_CONTENT_CLASSES).find(([, v]) => v === normalized)?.[0]
      return cls ? [`${index.prefix}${cls}`] : null
    }
    case 'overflow':
      return wrapKeyed(index, OVERFLOW_CLASSES, 'overflow', value)
    case 'overflowX':
      return wrapKeyed(index, OVERFLOW_CLASSES, 'overflow-x', value)
    case 'overflowY':
      return wrapKeyed(index, OVERFLOW_CLASSES, 'overflow-y', value)
    case 'padding':
      return wrap(classesForSpacing(index, 'p', value, false))
    case 'paddingTop':
      return wrap(classesForSpacing(index, 'pt', value, false))
    case 'paddingRight':
      return wrap(classesForSpacing(index, 'pr', value, false))
    case 'paddingBottom':
      return wrap(classesForSpacing(index, 'pb', value, false))
    case 'paddingLeft':
      return wrap(classesForSpacing(index, 'pl', value, false))
    case 'margin':
      return wrap(classesForSpacing(index, 'm', value, true))
    case 'marginTop':
      return wrap(classesForSpacing(index, 'mt', value, true))
    case 'marginRight':
      return wrap(classesForSpacing(index, 'mr', value, true))
    case 'marginBottom':
      return wrap(classesForSpacing(index, 'mb', value, true))
    case 'marginLeft':
      return wrap(classesForSpacing(index, 'ml', value, true))
    case 'gap':
      return wrap(classesForSpacing(index, 'gap', value, false))
    case 'rowGap':
      return wrap(classesForSpacing(index, 'gap-y', value, false))
    case 'columnGap':
      return wrap(classesForSpacing(index, 'gap-x', value, false))
    case 'width':
      return wrap(classNameForSize(index, 'w', value, 'x'))
    case 'height':
      return wrap(classNameForSize(index, 'h', value, 'y'))
    case 'minWidth':
      return wrap(classNameForSize(index, 'min-w', value, 'x'))
    case 'minHeight':
      return wrap(classNameForSize(index, 'min-h', value, 'y'))
    case 'maxWidth':
      return wrap(classNameForSize(index, 'max-w', value, 'x'))
    case 'maxHeight':
      return wrap(classNameForSize(index, 'max-h', value, 'y'))
    case 'top':
      return wrap(classesForSpacing(index, 'top', value, true))
    case 'right':
      return wrap(classesForSpacing(index, 'right', value, true))
    case 'bottom':
      return wrap(classesForSpacing(index, 'bottom', value, true))
    case 'left':
      return wrap(classesForSpacing(index, 'left', value, true))
    case 'borderRadius':
      return wrap(matchScaleClass(index, index.radius, 'rounded', value))
    case 'borderTopLeftRadius':
      return wrap(matchScaleClass(index, index.radius, 'rounded-tl', value))
    case 'borderTopRightRadius':
      return wrap(matchScaleClass(index, index.radius, 'rounded-tr', value))
    case 'borderBottomRightRadius':
      return wrap(matchScaleClass(index, index.radius, 'rounded-br', value))
    case 'borderBottomLeftRadius':
      return wrap(matchScaleClass(index, index.radius, 'rounded-bl', value))
    case 'borderWidth':
      return wrap(borderWidthClass(index, 'border', value))
    case 'borderTopWidth':
      return wrap(borderWidthClass(index, 'border-t', value))
    case 'borderRightWidth':
      return wrap(borderWidthClass(index, 'border-r', value))
    case 'borderBottomWidth':
      return wrap(borderWidthClass(index, 'border-b', value))
    case 'borderLeftWidth':
      return wrap(borderWidthClass(index, 'border-l', value))
    case 'borderStyle': {
      const normalized = normalizeScaleValue(value)
      const cls = Object.entries(BORDER_STYLE_CLASSES).find(([, v]) => v === normalized)?.[0]
      return cls ? [`${index.prefix}${cls}`] : null
    }
    case 'opacity': {
      const num = Number(normalizeScaleValue(value))
      if (!Number.isFinite(num)) return null
      return [`${index.prefix}opacity-${Math.round(num * 100)}`]
    }
    case 'zIndex': {
      const raw = normalizeScaleValue(value)
      if (raw === 'auto') return [`${index.prefix}z-auto`]
      if (['0', '10', '20', '30', '40', '50'].includes(raw)) return [`${index.prefix}z-${raw}`]
      if (!index.arbitrary) return null
      return [arbitraryClass(index.prefix, 'z', raw)]
    }
    default:
      return null
  }
}

function toCamelProperty(property: string): string {
  if (property.startsWith('--')) return property
  return property.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())
}

/**
 * Đổi một tập style (camelCase hoặc kebab-case) thành class Tailwind.
 * Style không chuyển được sẽ nằm trong `residualStyles` để ghi inline.
 */
export function stylesToTailwindClasses(
  styles: Record<string, string>,
  tokens: DesignTokens,
  options: TailwindTokenOptions = {}
): StylesToTailwindResult {
  const index = buildTailwindIndex(tokens, options)
  const classes: string[] = []
  const residualStyles: Record<string, string> = {}
  const applied: AppliedTailwindClass[] = []
  const unsupported: string[] = []

  for (const [rawProperty, rawValue] of Object.entries(styles)) {
    const property = toCamelProperty(rawProperty)
    const value = String(rawValue ?? '').trim()
    if (!value) continue

    const result = classesForProperty(property, value, index)
    if (!result || result.length === 0) {
      residualStyles[rawProperty] = rawValue
      unsupported.push(rawProperty)
      continue
    }

    for (const className of result) {
      if (!classes.includes(className)) classes.push(className)
      applied.push({ property, value, className })
    }
  }

  return { classes, residualStyles, applied, unsupported }
}

function splitVariant(className: string): { base: string; variant: string } {
  let depth = 0
  let splitAt = -1
  for (let i = 0; i < className.length; i += 1) {
    const char = className[i]
    if (char === '[') depth += 1
    else if (char === ']') depth = Math.max(0, depth - 1)
    else if (char === ':' && depth === 0) splitAt = i
  }
  if (splitAt === -1) return { base: className, variant: '' }
  return { base: className.slice(splitAt + 1), variant: className.slice(0, splitAt + 1) }
}

function readArbitraryValue(value: string): string | null {
  const match = value.match(/^\[(.+)\]$/)
  return match ? match[1].replace(/_/g, ' ') : null
}

function resolveScaleToken(scale: TokenScale, suffix: string): string | null {
  if (suffix === 'px') return '1px'
  if (suffix === 'auto') return 'auto'
  if (scale.byKey.has(suffix)) return scale.byKey.get(suffix) ?? null
  return readArbitraryValue(suffix)
}

function resolveSizeToken(scale: TokenScale, suffix: string, axis: 'x' | 'y'): string | null {
  const special: Record<string, string> = {
    auto: 'auto',
    full: '100%',
    min: 'min-content',
    max: 'max-content',
    fit: 'fit-content',
    px: '1px',
    screen: axis === 'x' ? '100vw' : '100vh',
  }
  if (special[suffix]) return special[suffix]
  if (scale.byKey.has(suffix)) return scale.byKey.get(suffix) ?? null
  const fraction = suffix.match(/^(\d+)\/(\d+)$/)
  if (fraction) {
    const percent = (Number(fraction[1]) / Number(fraction[2])) * 100
    return `${Math.round(percent * 10000) / 10000}%`
  }
  return readArbitraryValue(suffix)
}

function stripClassPrefix(className: string, index: TailwindTokenIndex): string | null {
  if (!index.prefix) return className
  if (!className.startsWith(index.prefix)) return null
  return className.slice(index.prefix.length)
}

function resolveRadiusToken(index: TailwindTokenIndex, suffix: string): string | null {
  if (suffix === 'full') return '9999px'
  if (index.radius.byKey.has(suffix)) return index.radius.byKey.get(suffix) ?? null
  return readArbitraryValue(suffix)
}

function spacingSides(side: string): string[] {
  switch (side) {
    case 'x':
      return ['Left', 'Right']
    case 'y':
      return ['Top', 'Bottom']
    case 't':
      return ['Top']
    case 'r':
      return ['Right']
    case 'b':
      return ['Bottom']
    case 'l':
      return ['Left']
    case 's':
      return ['InlineStart']
    case 'e':
      return ['InlineEnd']
    default:
      return ['']
  }
}

function radiusProps(side: string): string[] {
  switch (side) {
    case 't':
      return ['borderTopLeftRadius', 'borderTopRightRadius']
    case 'r':
      return ['borderTopRightRadius', 'borderBottomRightRadius']
    case 'b':
      return ['borderBottomLeftRadius', 'borderBottomRightRadius']
    case 'l':
      return ['borderTopLeftRadius', 'borderBottomLeftRadius']
    case 'tl':
      return ['borderTopLeftRadius']
    case 'tr':
      return ['borderTopRightRadius']
    case 'br':
      return ['borderBottomRightRadius']
    case 'bl':
      return ['borderBottomLeftRadius']
    default:
      return ['borderRadius']
  }
}

function borderWidthProps(side: string): string[] {
  switch (side) {
    case 't':
      return ['borderTopWidth']
    case 'r':
      return ['borderRightWidth']
    case 'b':
      return ['borderBottomWidth']
    case 'l':
      return ['borderLeftWidth']
    case 'x':
      return ['borderLeftWidth', 'borderRightWidth']
    case 'y':
      return ['borderTopWidth', 'borderBottomWidth']
    default:
      return ['borderWidth']
  }
}

function borderColorProps(side: string): string[] {
  switch (side) {
    case 't':
      return ['borderTopColor']
    case 'r':
      return ['borderRightColor']
    case 'b':
      return ['borderBottomColor']
    case 'l':
      return ['borderLeftColor']
    case 'x':
      return ['borderLeftColor', 'borderRightColor']
    case 'y':
      return ['borderTopColor', 'borderBottomColor']
    default:
      return ['borderColor']
  }
}

function parseUtilityClass(base: string, index: TailwindTokenIndex): Record<string, string> | null {
  const className = stripClassPrefix(base, index)
  if (!className) return null

  const display = DISPLAY_CLASSES[className]
  if (display) return { display }

  const position = POSITION_CLASSES[className]
  if (position) return { position }

  if (FLEX_DIRECTION_CLASSES[className]) return { flexDirection: FLEX_DIRECTION_CLASSES[className] }
  if (FLEX_WRAP_CLASSES[className]) return { flexWrap: FLEX_WRAP_CLASSES[className] }
  if (ALIGN_ITEMS_CLASSES[className]) return { alignItems: ALIGN_ITEMS_CLASSES[className] }
  if (JUSTIFY_CONTENT_CLASSES[className]) {
    return { justifyContent: JUSTIFY_CONTENT_CLASSES[className] }
  }

  if (className === 'italic') return { fontStyle: 'italic' }
  if (className === 'not-italic') return { fontStyle: 'normal' }
  if (className === 'underline') return { textDecorationLine: 'underline' }
  if (className === 'line-through') return { textDecorationLine: 'line-through' }
  if (className === 'no-underline') return { textDecorationLine: 'none' }

  if (OVERFLOW_CLASSES[className]) return { overflow: OVERFLOW_CLASSES[className] }
  if (className.startsWith('overflow-x-')) {
    const key = `overflow-${className.slice('overflow-x-'.length)}`
    if (OVERFLOW_CLASSES[key]) return { overflowX: OVERFLOW_CLASSES[key] }
    return null
  }
  if (className.startsWith('overflow-y-')) {
    const key = `overflow-${className.slice('overflow-y-'.length)}`
    if (OVERFLOW_CLASSES[key]) return { overflowY: OVERFLOW_CLASSES[key] }
    return null
  }

  if (className === 'border' || /^border-[trblxy]$/.test(className)) {
    const side = className === 'border' ? '' : className.slice('border-'.length)
    const result: Record<string, string> = {}
    for (const prop of borderWidthProps(side)) result[prop] = '1px'
    return result
  }

  if (className.startsWith('rounded')) {
    const rest = className === 'rounded' ? '' : className.slice('rounded-'.length)
    const sideMatch = rest.match(/^(t|r|b|l|tl|tr|br|bl)(?:-(.+))?$/)
    const valueSuffix = sideMatch ? sideMatch[2] ?? '' : rest
    const value = valueSuffix === '' ? '4px' : resolveRadiusToken(index, valueSuffix)
    if (value === null) return null
    const side = sideMatch ? sideMatch[1] : ''
    const result: Record<string, string> = {}
    for (const prop of radiusProps(side)) result[prop] = value
    return result
  }

  const spacingMatch = className.match(/^([pm])([xytrblse])?-(.+)$/)
  if (spacingMatch) {
    const value = resolveScaleToken(index.spacing, spacingMatch[3])
    if (value === null) return null
    const result: Record<string, string> = {}
    const base = spacingMatch[1] === 'p' ? 'padding' : 'margin'
    for (const suffix of spacingSides(spacingMatch[2] ?? '')) {
      result[`${base}${suffix}`] = value
    }
    return result
  }

  const gapMatch = className.match(/^gap(?:-([xy]))?-(.+)$/)
  if (gapMatch) {
    const value = resolveScaleToken(index.spacing, gapMatch[2])
    if (value === null) return null
    if (gapMatch[1] === 'x') return { columnGap: value }
    if (gapMatch[1] === 'y') return { rowGap: value }
    return { gap: value }
  }

  const sizeMatch = className.match(/^(min-w|max-w|min-h|max-h|size|w|h)-(.+)$/)
  if (sizeMatch) {
    const keyword = sizeMatch[1]
    const suffix = sizeMatch[2]
    const axis = keyword === 'h' || keyword === 'min-h' || keyword === 'max-h' ? 'y' : 'x'
    const value = resolveSizeToken(index.spacing, suffix, axis)
    if (value === null) return null
    if (keyword === 'size') return { width: value, height: value }
    const propMap: Record<string, string> = {
      w: 'width',
      h: 'height',
      'min-w': 'minWidth',
      'min-h': 'minHeight',
      'max-w': 'maxWidth',
      'max-h': 'maxHeight',
    }
    return { [propMap[keyword]]: value }
  }

  const insetMatch = className.match(/^(inset|inset-x|inset-y|top|right|bottom|left)-(.+)$/)
  if (insetMatch) {
    const value = resolveScaleToken(index.spacing, insetMatch[2])
    if (value === null) return null
    const result: Record<string, string> = {}
    const side = insetMatch[1]
    if (side === 'inset') {
      Object.assign(result, { top: value, right: value, bottom: value, left: value })
    } else if (side === 'inset-x') {
      Object.assign(result, { left: value, right: value })
    } else if (side === 'inset-y') {
      Object.assign(result, { top: value, bottom: value })
    } else {
      result[side] = value
    }
    return result
  }

  if (className.startsWith('leading-')) {
    const suffix = className.slice('leading-'.length)
    const preset = LINE_HEIGHT_BY_KEY[suffix]
    if (preset) return { lineHeight: preset }
    const arbitrary = readArbitraryValue(suffix)
    return arbitrary ? { lineHeight: arbitrary } : null
  }

  if (className.startsWith('font-')) {
    const suffix = className.slice('font-'.length)
    const weight = FONT_WEIGHT_BY_KEY[suffix]
    return weight ? { fontWeight: weight } : null
  }

  if (className.startsWith('opacity-')) {
    const suffix = className.slice('opacity-'.length)
    const arbitrary = readArbitraryValue(suffix)
    if (arbitrary !== null) return { opacity: arbitrary }
    const num = Number(suffix)
    if (!Number.isFinite(num)) return null
    return { opacity: String(num / 100) }
  }

  if (className.startsWith('z-')) {
    const suffix = className.slice('z-'.length)
    if (suffix === 'auto') return { zIndex: 'auto' }
    const arbitrary = readArbitraryValue(suffix)
    if (arbitrary !== null) return { zIndex: arbitrary }
    if (/^\d+$/.test(suffix)) return { zIndex: suffix }
    return null
  }

  if (className.startsWith('bg-')) {
    const suffix = className.slice('bg-'.length)
    if (suffix === 'transparent') return { backgroundColor: 'transparent' }
    if (suffix === 'current') return { backgroundColor: 'currentColor' }
    const arbitrary = readArbitraryValue(suffix)
    if (arbitrary !== null) return { backgroundColor: arbitrary }
    if (index.colors.byKey.has(suffix)) {
      return { backgroundColor: index.colors.byKey.get(suffix) ?? '' }
    }
    return null
  }

  if (className.startsWith('text-')) {
    const suffix = className.slice('text-'.length)
    if (TEXT_ALIGN_CLASSES[className]) return { textAlign: TEXT_ALIGN_CLASSES[className] }
    if (index.fontSizes.byKey.has(suffix)) {
      return { fontSize: index.fontSizes.byKey.get(suffix) ?? '' }
    }
    if (suffix === 'transparent') return { color: 'transparent' }
    if (suffix === 'current') return { color: 'currentColor' }
    const arbitrary = readArbitraryValue(suffix)
    if (arbitrary !== null) {
      return /^(#|rgb|hsl|var\()/i.test(arbitrary) ? { color: arbitrary } : { fontSize: arbitrary }
    }
    if (index.colors.byKey.has(suffix)) {
      return { color: index.colors.byKey.get(suffix) ?? '' }
    }
    return null
  }

  const borderMatch = className.match(/^border(?:-([trblxy]))?-(.+)$/)
  if (borderMatch) {
    const side = borderMatch[1] ?? ''
    const suffix = borderMatch[2]
    const styleClass = `border-${suffix}`
    if (BORDER_STYLE_CLASSES[styleClass]) {
      return { borderStyle: BORDER_STYLE_CLASSES[styleClass] }
    }
    const widthMatch = suffix.match(/^(\d+)$/)
    if (widthMatch) {
      const result: Record<string, string> = {}
      for (const prop of borderWidthProps(side)) result[prop] = `${widthMatch[1]}px`
      return result
    }
    const arbitrary = readArbitraryValue(suffix)
    if (arbitrary !== null) {
      const result: Record<string, string> = {}
      const isWidth = /^\d+(\.\d+)?(px|rem|em)$/.test(arbitrary)
      for (const prop of isWidth ? borderWidthProps(side) : borderColorProps(side)) {
        result[prop] = arbitrary
      }
      return result
    }
    if (index.colors.byKey.has(suffix)) {
      const result: Record<string, string> = {}
      for (const prop of borderColorProps(side)) {
        result[prop] = index.colors.byKey.get(suffix) ?? ''
      }
      return result
    }
    return null
  }

  return null
}

function expandProperties(properties: string[]): Set<string> {
  const expanded = new Set<string>()
  for (const property of properties) {
    const children = SHORTHAND_PROPERTIES[property]
    if (children) for (const child of children) expanded.add(child)
    else expanded.add(property)
  }
  return expanded
}

/**
 * Đọc danh sách class Tailwind thành style (camelCase).
 * Class biến thể (`hover:`, `md:`…) được giữ riêng, không áp vào style gốc.
 */
export function tailwindClassesToStyles(
  className: string,
  tokens: DesignTokens,
  options: TailwindTokenOptions = {}
): TailwindClassesToStylesResult {
  const index = buildTailwindIndex(tokens, options)
  const styles: Record<string, string> = {}
  const knownClasses: string[] = []
  const unknownClasses: string[] = []
  const variantClasses: string[] = []

  for (const rawClass of String(className || '').split(/\s+/).filter(Boolean)) {
    const important = rawClass.startsWith('!')
    const cleaned = important ? rawClass.slice(1) : rawClass
    const { base, variant } = splitVariant(cleaned)
    if (variant) {
      variantClasses.push(rawClass)
      continue
    }
    const parsed = parseUtilityClass(base, index)
    if (!parsed) {
      unknownClasses.push(rawClass)
      continue
    }
    knownClasses.push(rawClass)
    for (const [property, value] of Object.entries(parsed)) {
      styles[property] = important ? `${value} !important` : value
    }
  }

  return { styles, knownClasses, unknownClasses, variantClasses }
}

/**
 * Gộp class mới vào className hiện có, tự xoá utility xung đột cùng thuộc tính.
 * Class lạ, class biến thể (`hover:`, `md:`…) được giữ nguyên.
 */
export function mergeTailwindClasses(
  existing: string,
  addedClasses: string[],
  tokens: DesignTokens,
  options: TailwindTokenOptions = {}
): string {
  const index = buildTailwindIndex(tokens, options)
  const existingClasses = String(existing || '').split(/\s+/).filter(Boolean)
  const added = addedClasses.map((c) => c.trim()).filter(Boolean)
  if (added.length === 0) return existingClasses.join(' ')

  const addedProperties = new Set<string>()
  for (const className of added) {
    const { base, variant } = splitVariant(className)
    if (variant) continue
    const parsed = parseUtilityClass(base, index)
    if (!parsed) continue
    for (const property of expandProperties(Object.keys(parsed))) addedProperties.add(property)
  }

  const kept = existingClasses.filter((className) => {
    if (added.includes(className)) return false
    const { base, variant } = splitVariant(className)
    if (variant) return true
    const parsed = parseUtilityClass(base, index)
    if (!parsed) return true
    const properties = [...expandProperties(Object.keys(parsed))]
    if (properties.length === 0) return true
    return !properties.every((property) => addedProperties.has(property))
  })

  return [...kept, ...added].join(' ')
}

/** Gộp style từ class + style inline (inline thắng) để hiển thị trong bảng chỉnh sửa. */
export function resolveElementStyles(
  className: string,
  inlineStyles: Record<string, string>,
  tokens: DesignTokens,
  options: TailwindTokenOptions = {}
): Record<string, string> {
  const fromClasses = tailwindClassesToStyles(className, tokens, options).styles
  return { ...fromClasses, ...inlineStyles }
}
