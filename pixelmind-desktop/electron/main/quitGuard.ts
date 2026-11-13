/* Quyết định có cho phép thoát ứng dụng khi runner còn tiến trình đang chạy. */

export type QuitReason =
  | 'no-running-processes'
  | 'setting-disabled'
  | 'user-confirmed'
  | 'user-cancelled'
  | 'confirm-failed'

export interface QuitDecision {
  /** true = được phép đóng cửa sổ/thoát ứng dụng. */
  allow: boolean
  reason: QuitReason
  /** Số tiến trình đang chạy tại thời điểm hỏi. */
  runningCount: number
}

export interface QuitGuardOptions {
  /** Đọc cài đặt `confirmQuitRunning` (undefined = dùng mặc định bật). */
  readConfirmSetting: () => Promise<boolean | undefined>
  /** Đếm số tiến trình runner đang chạy / đang khởi động. */
  countRunning: () => number
  /** Hỏi người dùng; trả về true nếu đồng ý thoát và dừng máy chủ. */
  confirmExit: (runningCount: number) => Promise<boolean>
}

/**
 * Quyết định thoát:
 * - Tắt `confirmQuitRunning` → cho thoát ngay.
 * - Không có tiến trình chạy → cho thoát ngay.
 * - Có tiến trình → hỏi người dùng; "ở lại" (false) phải giữ nguyên tiến trình.
 */
export async function decideQuit(options: QuitGuardOptions): Promise<QuitDecision> {
  const runningCount = options.countRunning()
  const confirmSetting = await options.readConfirmSetting()

  if (confirmSetting === false) {
    return { allow: true, reason: 'setting-disabled', runningCount }
  }
  if (runningCount <= 0) {
    return { allow: true, reason: 'no-running-processes', runningCount }
  }

  try {
    const confirmed = await options.confirmExit(runningCount)
    return {
      allow: confirmed,
      reason: confirmed ? 'user-confirmed' : 'user-cancelled',
      runningCount,
    }
  } catch {
    // Không hỏi được (dialog lỗi) → an toàn hơn là ở lại, không dừng máy chủ.
    return { allow: false, reason: 'confirm-failed', runningCount }
  }
}
