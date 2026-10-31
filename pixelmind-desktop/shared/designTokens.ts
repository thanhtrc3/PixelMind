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
}

/** Chuyển token ID thành tên biến CSS W3C chuẩn */
export function tokenToCssVarName(type: 'color' | 'font' | 'spacing' | 'radius', id: string): string {
  const clean = id.replace(/^[a-z]_/, '').replace(/_/g, '-')
  switch (type) {
    case 'color':
      return `--color-${clean}`
    case 'font':
      return `--font-size-${clean}`
    case 'spacing':
      return `--spacing-${clean}`
    case 'radius':
      return `--radius-${clean}`
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

  return `/* ═══════════════════════════════════════════════════════════════
   PixelMind Design Tokens — Hệ thống quy chuẩn thiết kế dự án
   Tự động sinh bởi PixelMind Theme Manager
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
}
`
}

/** Tự động sinh nội dung cho cấu hình Tailwind CSS (tailwind.tokens.js / theme.extend) */
export function generateTailwindTokensConfig(tokens: DesignTokens): string {
  const colorsObj: Record<string, string> = {}
  for (const c of tokens.colors) {
    const key = c.id.replace(/^c_/, '').replace(/_/g, '-')
    colorsObj[key] = c.value
  }

  const fontObj: Record<string, [string, { lineHeight: string }]> = {}
  for (const t of tokens.typography) {
    const key = t.id.replace(/^t_/, '').replace(/_/g, '-')
    fontObj[key] = [t.fontSize, { lineHeight: t.lineHeight }]
  }

  const spacingObj: Record<string, string> = {}
  for (const s of tokens.spacing) {
    const key = s.id.replace(/^s_/, '').replace(/_/g, '-')
    spacingObj[key] = s.value
  }

  const radiusObj: Record<string, string> = {}
  for (const r of tokens.radius) {
    const key = r.id.replace(/^r_/, '').replace(/_/g, '-')
    radiusObj[key] = r.value
  }

  return `/**
 * PixelMind Design Tokens for Tailwind CSS
 * Nhúng vào tailwind.config.js:
 *   const tokens = require('./tailwind.tokens.js')
 *   module.exports = { theme: { extend: tokens } }
 */

module.exports = {
  colors: ${JSON.stringify(colorsObj, null, 4)},
  fontSize: ${JSON.stringify(fontObj, null, 4)},
  spacing: ${JSON.stringify(spacingObj, null, 4)},
  borderRadius: ${JSON.stringify(radiusObj, null, 4)},
};
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
  return result
}
