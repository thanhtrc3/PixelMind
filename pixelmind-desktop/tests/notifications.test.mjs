import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createNotification,
  prependNotification,
  markAsRead,
  countUnread,
  filterNotifications,
  serializeNotifications,
  parseNotifications,
  MAX_NOTIFICATIONS,
} from '../src/lib/notifications.ts'

describe('notifications helper', () => {
  it('creates notification with unique id and unread by default', () => {
    const item = createNotification('info', 'Xin chào PixelMind', 1000, 'test')
    assert.equal(item.id, 'notif_1000_test')
    assert.equal(item.kind, 'info')
    assert.equal(item.text, 'Xin chào PixelMind')
    assert.equal(item.timestamp, 1000)
    assert.equal(item.read, false)
  })

  it('prepends new item and enforces maximum of 50 items', () => {
    let list = []
    for (let i = 0; i < 60; i++) {
      const item = createNotification('ok', `Msg ${i}`, 1000 + i, String(i))
      list = prependNotification(list, item)
    }
    assert.equal(list.length, MAX_NOTIFICATIONS)
    assert.equal(list[0].text, 'Msg 59')
    assert.equal(list[MAX_NOTIFICATIONS - 1].text, 'Msg 10')
  })

  it('marks single notification or all notifications as read', () => {
    const n1 = createNotification('ok', 'Msg 1', 1)
    const n2 = createNotification('err', 'Msg 2', 2)
    let list = [n1, n2]

    assert.equal(countUnread(list), 2)

    list = markAsRead(list, n1.id)
    assert.equal(countUnread(list), 1)
    assert.equal(list[0].read, true)
    assert.equal(list[1].read, false)

    list = markAsRead(list)
    assert.equal(countUnread(list), 0)
    assert.equal(list[1].read, true)
  })

  it('filters notifications by kind', () => {
    const list = [
      createNotification('ok', 'Thành công'),
      createNotification('err', 'Lỗi nghiêm trọng'),
      createNotification('info', 'Thông tin'),
      createNotification('err', 'Lỗi kết nối'),
    ]

    assert.equal(filterNotifications(list, 'all').length, 4)
    assert.equal(filterNotifications(list, 'ok').length, 1)
    assert.equal(filterNotifications(list, 'err').length, 2)
    assert.equal(filterNotifications(list, 'info').length, 1)
  })

  it('serializes and safely parses notifications', () => {
    const list = [
      createNotification('err', 'Lỗi 1', 100),
      { ...createNotification('ok', 'Đã lưu', 200), read: true },
    ]
    const json = serializeNotifications(list)
    const parsed = parseNotifications(json)

    assert.deepEqual(parsed, list)
    assert.deepEqual(parseNotifications(null), [])
    assert.deepEqual(parseNotifications('invalid json'), [])
    assert.deepEqual(parseNotifications('{"some": "object"}'), [])
  })
})

