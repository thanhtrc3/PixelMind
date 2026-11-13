import type { ToastMessage } from '../components/ToastStack'

export type NotificationKind = 'ok' | 'err' | 'info' | 'all'

export interface AppNotification {
  id: string
  kind: ToastMessage['kind']
  text: string
  timestamp: number
  read: boolean
}

export const MAX_NOTIFICATIONS = 50

export function createNotification(
  kind: ToastMessage['kind'],
  text: string,
  now: number = Date.now(),
  idSuffix: string = '',
): AppNotification {
  return {
    id: `notif_${now}_${idSuffix || Math.random().toString(36).slice(2, 8)}`,
    kind,
    text: String(text || '').trim(),
    timestamp: now,
    read: false,
  }
}

/**
 * Thêm một thông báo mới vào đầu danh sách, giới hạn tối đa MAX_NOTIFICATIONS (50).
 */
export function prependNotification(
  notifications: AppNotification[],
  newItem: AppNotification,
  maxItems: number = MAX_NOTIFICATIONS,
): AppNotification[] {
  return [newItem, ...notifications].slice(0, maxItems)
}

/**
 * Đánh dấu đã đọc cho 1 thông báo cụ thể hoặc tất cả.
 */
export function markAsRead(
  notifications: AppNotification[],
  id?: string,
): AppNotification[] {
  if (!id) {
    return notifications.map((n) => (n.read ? n : { ...n, read: true }))
  }
  return notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
}

/**
 * Đếm số lượng thông báo chưa đọc.
 */
export function countUnread(notifications: AppNotification[]): number {
  return notifications.reduce((count, n) => (n.read ? count : count + 1), 0)
}

/**
 * Lọc thông báo theo loại ('all' | 'ok' | 'err' | 'info').
 */
export function filterNotifications(
  notifications: AppNotification[],
  kind: NotificationKind,
): AppNotification[] {
  if (kind === 'all') return notifications
  return notifications.filter((n) => n.kind === kind)
}

/**
 * Serialize danh sách thông báo để lưu vào localStorage.
 */
export function serializeNotifications(notifications: AppNotification[]): string {
  try {
    return JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS))
  } catch {
    return '[]'
  }
}

/**
 * Parse danh sách thông báo từ localStorage an toàn.
 */
export function parseNotifications(raw: string | null): AppNotification[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (item): item is AppNotification =>
          Boolean(item) &&
          typeof item.id === 'string' &&
          (item.kind === 'ok' || item.kind === 'err' || item.kind === 'info') &&
          typeof item.text === 'string' &&
          typeof item.timestamp === 'number' &&
          typeof item.read === 'boolean',
      )
      .slice(0, MAX_NOTIFICATIONS)
  } catch {
    return []
  }
}

