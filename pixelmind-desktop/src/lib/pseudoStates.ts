/**
 * pseudoStates.ts — Xử lý giả lập trạng thái tương tác :hover, :focus, :active, :disabled (D2-11)
 * Trích xuất CSS rules từ stylesheet trong iframe, sao lưu & khôi phục style an toàn.
 */

export type PseudoStateKey = 'default' | 'hover' | 'focus' | 'active' | 'disabled'

export interface PseudoStateOption {
  key: PseudoStateKey
  label: string
  title: string
}

export const PSEUDO_STATES: PseudoStateOption[] = [
  { key: 'default', label: 'Normal', title: 'Trạng thái bình thường mặc định' },
  { key: 'hover', label: ':hover', title: 'Giả lập khi rê chuột lên phần tử' },
  { key: 'focus', label: ':focus', title: 'Giả lập khi phần tử nhận tiêu điểm' },
  { key: 'active', label: ':active', title: 'Giả lập khi đang bấm giữ chuột' },
  { key: 'disabled', label: ':disabled', title: 'Giả lập trạng thái bị vô hiệu hóa' },
]

/**
 * Trích xuất các thuộc tính CSS được định nghĩa cho pseudo-class từ document.styleSheets trong iframe
 */
export function extractPseudoStyles(
  doc: Document | null | undefined,
  el: HTMLElement | null | undefined,
  state: PseudoStateKey
): Record<string, string> {
  if (!doc || !el || state === 'default') return {}

  const extracted: Record<string, string> = {}
  const pseudoSelector = `:${state}`

  try {
    for (const sheet of Array.from(doc.styleSheets)) {
      try {
        const rules = sheet.cssRules || sheet.rules
        if (!rules) continue

        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSStyleRule && rule.selectorText.includes(pseudoSelector)) {
            // Tách selector để kiểm tra xem el có khớp với phần trước pseudo không
            const subSelectors = rule.selectorText.split(',')
            for (const sub of subSelectors) {
              const trimmed = sub.trim()
              if (!trimmed.includes(pseudoSelector)) continue

              // Bỏ đi :state để so sánh với phần tử hiện tại
              // Ví dụ: "button:hover" -> "button", ".btn:hover" -> ".btn", ".hover\:bg-blue-600:hover" -> ".hover\:bg-blue-600"
              const baseSelector = trimmed.replace(new RegExp(pseudoSelector, 'g'), '').trim()

              let matches = false
              try {
                if (!baseSelector || baseSelector === '*' || el.matches(baseSelector)) {
                  matches = true
                }
              } catch {
                // Xử lý escape selector như Tailwind
                try {
                  const escaped = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(baseSelector) : baseSelector
                  if (el.matches(escaped)) matches = true
                } catch { }
              }

              if (matches) {
                // Trích xuất các thuộc tính định kiểu của rule
                const styleObj = rule.style
                for (let i = 0; i < styleObj.length; i++) {
                  const prop = styleObj[i]
                  const val = styleObj.getPropertyValue(prop)
                  if (val) {
                    extracted[prop] = val
                  }
                }
              }
            }
          }
        }
      } catch {
        // Bỏ qua lỗi CORS khi duyệt external stylesheet
      }
    }
  } catch { }

  // Fallback mặc định trực quan cho các phần tử chưa có rule CSS viết sẵn
  if (Object.keys(extracted).length === 0) {
    if (state === 'hover') {
      extracted['filter'] = 'brightness(1.12)'
    } else if (state === 'focus') {
      extracted['outline'] = '2px solid #6366f1'
      extracted['outline-offset'] = '2px'
    } else if (state === 'active') {
      extracted['transform'] = 'scale(0.97)'
      extracted['filter'] = 'brightness(0.92)'
    } else if (state === 'disabled') {
      extracted['opacity'] = '0.45'
      extracted['cursor'] = 'not-allowed'
      extracted['pointer-events'] = 'none'
    }
  }

  return extracted
}

/**
 * Snapshot dữ liệu style trước khi chuyển sang trạng thái giả lập
 */
export interface PseudoSnapshot {
  uid?: string
  selector?: string
  inlineCssText: string
  originalStyles: Record<string, string>
  hadDisabledAttr?: boolean
}

/**
 * Kích hoạt trạng thái giả lập trên phần tử DOM thật
 */
export function applyPseudoStateToElement(
  el: HTMLElement,
  state: PseudoStateKey,
  pseudoStyles: Record<string, string>
): void {
  // 1. Áp dụng native behavior
  if (state === 'focus') {
    try {
      el.focus({ preventScroll: true })
    } catch { }
  } else if (state === 'disabled') {
    el.setAttribute('disabled', 'true')
  }

  // 2. Gán các thuộc tính style giả lập
  for (const [prop, val] of Object.entries(pseudoStyles)) {
    el.style.setProperty(prop, val, 'important')
  }
}

/**
 * Hoàn nguyên phần tử về trạng thái ban đầu một cách an toàn, không làm biến đổi mã nguồn
 */
export function restoreElementFromPseudoState(
  el: HTMLElement,
  snapshot: PseudoSnapshot
): void {
  // 1. Khôi phục inline style nguyên bản
  el.style.cssText = snapshot.inlineCssText

  // 2. Bỏ các native states
  try {
    el.blur()
  } catch { }

  if (!snapshot.hadDisabledAttr) {
    el.removeAttribute('disabled')
  }
}
