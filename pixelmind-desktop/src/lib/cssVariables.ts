import type { DesignTokens } from '@shared/types'

export interface ElementCssVar {
  name: string
  value: string
  computedValue?: string
  isInline: boolean
  isInherited: boolean
  sourceSelector?: string
}

export interface SuggestedToken {
  id: string
  name: string
  cssVarName: string
  value: string
  category: 'color' | 'spacing' | 'radius' | 'custom'
}

/**
 * Kiểm tra xem chuỗi có chứa tham chiếu biến CSS dạng var(--...) hay không
 */
export function isCssVarReference(val: string | undefined | null): boolean {
  if (!val) return false
  return /var\(\s*--[\w-]+\s*(?:,.*)?\)/i.test(val.trim())
}

/**
 * Trích xuất tên biến CSS từ chuỗi var(--ten-bien)
 */
export function extractVarName(val: string | undefined | null): string | null {
  if (!val) return null
  const m = val.match(/var\(\s*(--[\w-]+)/i)
  return m ? m[1] : null
}

/**
 * Tạo cú pháp var(--name) chuẩn
 */
export function formatVarReference(varName: string, fallback?: string): string {
  const cleanName = varName.startsWith('--') ? varName : `--${varName}`
  if (fallback && fallback.trim()) {
    return `var(${cleanName}, ${fallback.trim()})`
  }
  return `var(${cleanName})`
}

/**
 * Trích xuất toàn bộ các biến CSS (--*) đang áp dụng lên phần tử và kế thừa từ :root/parent
 */
export function extractElementCssVariables(
  element: HTMLElement | null | undefined,
  doc?: Document | null,
): ElementCssVar[] {
  if (!element) return []
  const ownerDoc = doc || element.ownerDocument || document
  const win = ownerDoc.defaultView || window

  const varsMap = new Map<string, ElementCssVar>()
  const computed = win.getComputedStyle(element)

  // 1. Biến CSS khai báo trực tiếp trên inline style của phần tử
  try {
    for (let i = 0; i < element.style.length; i++) {
      const prop = element.style[i]
      if (prop && prop.startsWith('--')) {
        const rawVal = element.style.getPropertyValue(prop).trim()
        const computedVal = computed.getPropertyValue(prop).trim() || rawVal
        varsMap.set(prop, {
          name: prop,
          value: rawVal,
          computedValue: computedVal,
          isInline: true,
          isInherited: false,
          sourceSelector: 'inline',
        })
      }
    }
  } catch {}

  // 2. Quét từ getComputedStyle (trên Chrome/Electron, getComputedStyle chứa các custom properties đã tính toán)
  try {
    for (let i = 0; i < computed.length; i++) {
      const prop = computed[i]
      if (prop && prop.startsWith('--') && !varsMap.has(prop)) {
        const val = computed.getPropertyValue(prop).trim()
        if (val) {
          varsMap.set(prop, {
            name: prop,
            value: val,
            computedValue: val,
            isInline: false,
            isInherited: true,
            sourceSelector: 'inherited',
          })
        }
      }
    }
  } catch {}

  // 3. Quét stylesheet để tìm các biến định nghĩa trong :root hoặc selector khớp với element
  try {
    const sheets = Array.from(ownerDoc.styleSheets || [])
    for (const sheet of sheets) {
      let rules: CSSRuleList | null = null
      try {
        rules = sheet.cssRules || (sheet as any).rules
      } catch {
        // Cross-origin stylesheet có thể bị chặn, bỏ qua
        continue
      }
      if (!rules) continue

      for (let r = 0; r < rules.length; r++) {
        const rule = rules[r] as CSSStyleRule
        if (!rule || !rule.style || !rule.selectorText) continue

        const sel = rule.selectorText.trim()
        const isRoot = sel === ':root' || sel === 'html' || sel === 'body'
        let matches = isRoot
        if (!matches && typeof element.matches === 'function') {
          try {
            matches = element.matches(sel)
          } catch {
            matches = false
          }
        }

        if (matches) {
          for (let p = 0; p < rule.style.length; p++) {
            const prop = rule.style[p]
            if (prop && prop.startsWith('--')) {
              const ruleVal = rule.style.getPropertyValue(prop).trim()
              const computedVal = computed.getPropertyValue(prop).trim() || ruleVal
              if (!varsMap.has(prop)) {
                varsMap.set(prop, {
                  name: prop,
                  value: ruleVal,
                  computedValue: computedVal,
                  isInline: false,
                  isInherited: isRoot,
                  sourceSelector: sel,
                })
              } else {
                // Nếu đã có nhưng chưa có sourceSelector cụ thể
                const existing = varsMap.get(prop)!
                if (!existing.isInline && existing.sourceSelector === 'inherited') {
                  existing.sourceSelector = sel
                  existing.isInherited = isRoot
                }
              }
            }
          }
        }
      }
    }
  } catch {}

  // Chuyển sang mảng và sắp xếp: inline lên đầu, sau đó theo tên A-Z
  const result = Array.from(varsMap.values())
  result.sort((a, b) => {
    if (a.isInline && !b.isInline) return -1
    if (!a.isInline && b.isInline) return 1
    return a.name.localeCompare(b.name)
  })

  return result
}

/**
 * Lấy danh sách các Design Token của dự án có thể dùng để gán biến CSS
 */
export function getAvailableDesignTokens(tokens?: DesignTokens | null): SuggestedToken[] {
  if (!tokens) return []
  const list: SuggestedToken[] = []

  // Colors
  if (Array.isArray(tokens.colors)) {
    for (const c of tokens.colors) {
      const varName = `--color-${c.name.toLowerCase().replace(/\s+/g, '-')}`
      list.push({
        id: c.id,
        name: c.name,
        cssVarName: varName,
        value: c.value,
        category: 'color',
      })
    }
  }

  // Spacing
  if (Array.isArray(tokens.spacing)) {
    for (const s of tokens.spacing) {
      const varName = `--space-${s.name.toLowerCase().replace(/\s+/g, '-')}`
      list.push({
        id: s.id,
        name: s.name,
        cssVarName: varName,
        value: s.value,
        category: 'spacing',
      })
    }
  }

  // Radius
  if (Array.isArray(tokens.radius)) {
    for (const r of tokens.radius) {
      const varName = `--radius-${r.name.toLowerCase().replace(/\s+/g, '-')}`
      list.push({
        id: r.id,
        name: r.name,
        cssVarName: varName,
        value: r.value,
        category: 'radius',
      })
    }
  }

  // Custom vars
  if (Array.isArray(tokens.customVars)) {
    for (const cv of tokens.customVars) {
      const varName = cv.name.startsWith('--') ? cv.name : `--${cv.name}`
      list.push({
        id: cv.id,
        name: cv.name,
        cssVarName: varName,
        value: cv.value,
        category: 'custom',
      })
    }
  }

  return list
}
