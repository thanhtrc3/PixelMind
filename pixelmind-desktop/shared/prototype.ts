/* ══════════════════════════════════════════════════════════════
   D2-20: Prototype Interaction State Machine
   - Gán trigger (click, hover, focus) ➔ action (route, modal, toggle_state, toast, back)
   - Phát hiện target lỗi (route không tồn tại, selector không có trên DOM)
   - Tách biệt chế độ mô phỏng với việc ghi đè mã nguồn thật
   ══════════════════════════════════════════════════════════════ */

export type PrototypeTrigger = 'click' | 'hover' | 'focus'

export type PrototypeActionType = 'route' | 'modal' | 'toggle_state' | 'back' | 'toast'

export interface PrototypeInteraction {
  id: string
  projectPath: string
  sourceUid?: string
  sourceSelector?: string
  sourceTag?: string
  sourceText?: string
  trigger: PrototypeTrigger
  action: PrototypeActionType
  target?: string // Route (vd: '/about') hoặc CSS selector (vd: '#modal-login')
  toastText?: string
  stateClass?: string // Class thêm vào target khi toggle_state (mặc định: 'is-active')
  createdAt: string
  updatedAt?: string
}

export interface PrototypeValidationError {
  interactionId: string
  type: 'missing_target' | 'invalid_route' | 'missing_source'
  message: string
}

/**
 * Danh sách các Trigger hỗ trợ kèm nhãn tiếng Việt
 */
export const PROTOTYPE_TRIGGERS: Array<{ key: PrototypeTrigger; label: string; desc: string }> = [
  { key: 'click', label: 'Nhấp chuột (Click)', desc: 'Kích hoạt khi người dùng nhấp vào phần tử' },
  { key: 'hover', label: 'Rê chuột (Hover)', desc: 'Kích hoạt khi đưa con trỏ chuột vào' },
  { key: 'focus', label: 'Nhận tiêu điểm (Focus)', desc: 'Kích hoạt khi người dùng bấm Tab hoặc chọn ô' },
]

/**
 * Danh sách các Action hỗ trợ kèm nhãn tiếng Việt
 */
export const PROTOTYPE_ACTIONS: Array<{ key: PrototypeActionType; label: string; desc: string }> = [
  { key: 'route', label: 'Chuyển Route (Navigate)', desc: 'Điều hướng sang trang khác trong dự án' },
  { key: 'modal', label: 'Mở Modal / Hộp thoại', desc: 'Hiển thị phần tử modal mục tiêu' },
  { key: 'toggle_state', label: 'Bật/Tắt trạng thái (Toggle Class)', desc: 'Thêm hoặc gỡ class trên phần tử mục tiêu' },
  { key: 'toast', label: 'Hiện thông báo (Toast)', desc: 'Hiển thị thông báo xem trước luồng' },
  { key: 'back', label: 'Quay lại trang trước', desc: 'Trở lại route trước đó trong lịch sử' },
]

/**
 * Kiểm tra tính hợp lệ của một liên kết Prototype
 * Phát hiện target lỗi nếu route không có trong dự án hoặc selector bị thiếu
 */
export function validateInteraction(
  interaction: PrototypeInteraction,
  availableRoutes: string[] = []
): { isValid: boolean; error?: PrototypeValidationError } {
  // 1. Kiểm tra action route
  if (interaction.action === 'route') {
    if (!interaction.target || !interaction.target.trim()) {
      return {
        isValid: false,
        error: {
          interactionId: interaction.id,
          type: 'missing_target',
          message: 'Chưa chỉ định đường dẫn Route đích',
        },
      }
    }
    const targetRoute = interaction.target.trim()
    if (availableRoutes.length > 0 && !availableRoutes.includes(targetRoute)) {
      return {
        isValid: false,
        error: {
          interactionId: interaction.id,
          type: 'invalid_route',
          message: `Route đích "${targetRoute}" không tồn tại trong danh sách trang của dự án`,
        },
      }
    }
  }

  // 2. Kiểm tra action modal hoặc toggle_state
  if (interaction.action === 'modal' || interaction.action === 'toggle_state') {
    if (!interaction.target || !interaction.target.trim()) {
      return {
        isValid: false,
        error: {
          interactionId: interaction.id,
          type: 'missing_target',
          message: `Chưa nhập selector CSS cho phần tử mục tiêu (${interaction.action === 'modal' ? 'Modal' : 'State'})`,
        },
      }
    }
  }

  return { isValid: true }
}

/**
 * Lọc danh sách các tương tác áp dụng lên một phần tử cụ thể
 */
export function getInteractionsForElement(
  interactions: PrototypeInteraction[],
  uid?: string,
  selector?: string
): PrototypeInteraction[] {
  return interactions.filter((item) => {
    if (uid && item.sourceUid && item.sourceUid === uid) return true
    if (selector && item.sourceSelector && item.sourceSelector === selector) return true
    return false
  })
}
