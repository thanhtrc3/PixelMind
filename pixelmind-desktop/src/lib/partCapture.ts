/**
 * Trích xuất DOM + CSS khi lưu vùng chọn thành Part.
 * Tách khỏi CanvasArea để test được bằng node (không cần React).
 */

/** So khớp selector với class/id của part theo trọn token (tránh `.btn` khớp `.btn-primary`). */
export function buildSelectorMatcher(
  classNames: Iterable<string>,
  idNames: Iterable<string>,
): (selector: string) => boolean {
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const classes = Array.from(classNames, escape)
  const ids = Array.from(idNames, escape)
  const alternatives: string[] = []
  if (classes.length > 0) alternatives.push(`\\.(?:${classes.join('|')})`)
  if (ids.length > 0) alternatives.push(`#(?:${ids.join('|')})`)
  if (alternatives.length === 0) return () => false
  const re = new RegExp(`(?:${alternatives.join('|')})(?![\\w-])`)
  // Biến CSS (:root của design token) luôn cần đi kèm part.
  return (selector) => re.test(selector) || /(^|,)\s*:root\s*(,|$)/i.test(selector)
}

/** Tách các rule khớp part từ text CSS. Bỏ @import/comment trước để selector không dính
 *  rác phía trước (nếu không `:root` của design token bị bỏ sót). */
export function extractMatchedRules(
  cssText: string,
  selectorHits: (selector: string) => boolean,
): string[] {
  const text = cssText
    // URL Google Fonts chứa `;` (wght@400;500;...) nên phải nhảy qua phần trong nháy.
    .replace(/@import\s+(?:url\(\s*)?(?:'[^']*'|"[^"]*"|[^;'"])*\s*\)?\s*;/gi, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  const ruleRegex = /([^{}]+)\{([^}]+)\}/g
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = ruleRegex.exec(text)) !== null) {
    const selector = m[1].trim()
    const body = m[2].trim()
    if (selectorHits(selector)) out.push(`${selector} { ${body} }`)
  }
  return out
}

/**
 * Tổ tiên chung gần nhất của vùng chọn, chỉ giữ các nhánh được chọn.
 * Nhờ vậy CSS phụ thuộc ancestor (vd `.auth-card input`) vẫn khớp sau khi part
 * được chèn sang vị trí khác.
 */
export function enclosingHtml(nodes: HTMLElement[]): string {
  if (nodes.length < 2) return ''
  const doc = nodes[0].ownerDocument
  if (!doc) return ''
  let ancestor: HTMLElement | null = nodes[0].parentElement
  while (ancestor && !nodes.every((node) => ancestor?.contains(node))) {
    ancestor = ancestor.parentElement
  }
  if (!ancestor || ancestor === doc.body || ancestor === doc.documentElement) return ''

  const keep = new Set<Node>(nodes)
  const prune = (el: Element): Element | null => {
    const clone = el.cloneNode(false) as Element
    el.childNodes.forEach((child) => {
      if (keep.has(child)) {
        clone.appendChild(child.cloneNode(true))
      } else if (child.nodeType === 1) {
        const inner = prune(child as Element)
        if (inner) clone.appendChild(inner)
      }
    })
    return clone.childNodes.length > 0 ? clone : null
  }
  return prune(ancestor)?.outerHTML || ''
}
