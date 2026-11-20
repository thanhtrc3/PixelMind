import { useState, useMemo } from 'react'
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Copy,
  Info,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import type {
  AppNotification,
  NotificationKind,
} from '../../lib/notifications'
import { filterNotifications } from '../../lib/notifications'

interface NotificationCenterProps {
  notifications: AppNotification[]
  onMarkAsRead: (id?: string) => void
  onClearAll: () => void
  onClose: () => void
  onCopyText: (text: string) => void
}

const NotificationCenter = ({
  notifications,
  onMarkAsRead,
  onClearAll,
  onClose,
  onCopyText,
}: NotificationCenterProps) => {
  const [filter, setFilter] = useState<NotificationKind>('all')

  const filtered = useMemo(
    () => filterNotifications(notifications, filter),
    [notifications, filter],
  )

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  )

  const errCount = useMemo(
    () => notifications.filter((n) => n.kind === 'err').length,
    [notifications],
  )

  const formatTimestamp = (ts: number) => {
    try {
      const d = new Date(ts)
      const now = new Date()
      const diffSec = Math.floor((now.getTime() - ts) / 1000)
      if (diffSec < 60) return 'Vừa xong'
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  const getIcon = (kind: AppNotification['kind']) => {
    switch (kind) {
      case 'err':
        return <XCircle size={14} className="pm-notif-item__icon is-err" />
      case 'info':
        return <Info size={14} className="pm-notif-item__icon is-info" />
      case 'ok':
      default:
        return <CheckCircle2 size={14} className="pm-notif-item__icon is-ok" />
    }
  }

  return (
    <div
      className="pm-notif-center"
      role="dialog"
      aria-label="Trung tâm lịch sử thông báo"
      onClick={(e) => e.stopPropagation()}
    >
      <header className="pm-notif-center__header">
        <div className="pm-notif-center__title">
          <Bell size={14} />
          <b>Lịch sử thông báo</b>
          <span className="pm-notif-center__badge">{notifications.length}/50</span>
          {unreadCount > 0 && (
            <span className="pm-notif-center__unread-pill">{unreadCount} mới</span>
          )}
        </div>

        <div className="pm-notif-center__actions">
          {unreadCount > 0 && (
            <button
              className="pm-tool-btn"
              title="Đánh dấu tất cả đã đọc"
              onClick={() => onMarkAsRead()}
            >
              <CheckCheck size={12} />
              <span>Đã đọc</span>
            </button>
          )}
          {notifications.length > 0 && (
            <button
              className="pm-tool-btn pm-tool-btn--danger"
              title="Xóa toàn bộ lịch sử"
              onClick={onClearAll}
            >
              <Trash2 size={12} />
              <span>Xóa hết</span>
            </button>
          )}
          <button className="pm-tool-btn" title="Đóng (Esc)" onClick={onClose}>
            <X size={13} />
          </button>
        </div>
      </header>

      {/* Thanh bộ lọc */}
      <div className="pm-notif-center__filters">
        <button
          className={`pm-notif-center__tab ${filter === 'all' ? 'is-active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Tất cả ({notifications.length})
        </button>
        <button
          className={`pm-notif-center__tab ${filter === 'err' ? 'is-active' : ''}`}
          onClick={() => setFilter('err')}
        >
          Lỗi {errCount > 0 ? `(${errCount})` : ''}
        </button>
        <button
          className={`pm-notif-center__tab ${filter === 'ok' ? 'is-active' : ''}`}
          onClick={() => setFilter('ok')}
        >
          Thành công
        </button>
        <button
          className={`pm-notif-center__tab ${filter === 'info' ? 'is-active' : ''}`}
          onClick={() => setFilter('info')}
        >
          Thông tin
        </button>
      </div>

      {/* Danh sách thông báo */}
      <div className="pm-notif-center__list">
        {filtered.length === 0 ? (
          <div className="pm-notif-center__empty">
            <Bell size={24} style={{ opacity: 0.3, marginBottom: 6 }} />
            <span>Không có thông báo nào trong mục này.</span>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className={`pm-notif-item ${item.read ? 'is-read' : 'is-unread'} kind-${item.kind}`}
              onClick={() => {
                if (!item.read) onMarkAsRead(item.id)
              }}
            >
              <div className="pm-notif-item__left">{getIcon(item.kind)}</div>
              <div className="pm-notif-item__body">
                <div className="pm-notif-item__top">
                  <span className="pm-notif-item__kind">
                    {item.kind === 'err'
                      ? 'Lỗi'
                      : item.kind === 'ok'
                        ? 'Thành công'
                        : 'Thông tin'}
                  </span>
                  <span className="pm-notif-item__time">
                    {formatTimestamp(item.timestamp)}
                  </span>
                </div>
                <div className="pm-notif-item__text">{item.text}</div>
              </div>
              <div className="pm-notif-item__actions">
                <button
                  className="pm-notif-item__copy"
                  title="Sao chép nội dung thông báo"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCopyText(item.text)
                  }}
                >
                  <Copy size={11} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default NotificationCenter

