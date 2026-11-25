import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateCaptureRect,
  formatCaptureFilename,
} from '../shared/capture.ts'

test('D2-16: calculateCaptureRect phạm vi viewport lấy chuẩn khung iframe', () => {
  const iframeBounds = {
    left: 240,
    top: 90,
    right: 1240,
    bottom: 890,
    width: 1000,
    height: 800,
  }

  const rect = calculateCaptureRect({
    scope: 'viewport',
    iframeBounds,
  })

  assert.equal(rect.x, 240)
  assert.equal(rect.y, 90)
  assert.equal(rect.width, 1000)
  assert.equal(rect.height, 800)
})

test('D2-16: calculateCaptureRect phạm vi element tính đúng toạ độ phần tử và giới hạn trong iframe', () => {
  const iframeBounds = {
    left: 200,
    top: 100,
    right: 1200,
    bottom: 900,
    width: 1000,
    height: 800,
  }

  // Phần tử nằm ở tọa độ (50, 60) kích thước 200x120 bên trong iframe 1000x800
  const elRect = {
    left: 50,
    top: 60,
    width: 200,
    height: 120,
  }

  const rect = calculateCaptureRect({
    scope: 'element',
    iframeBounds,
    elementRect: elRect,
    iframeClientSize: { width: 1000, height: 800 },
  })

  assert.equal(rect.x, 250) // 200 + 50
  assert.equal(rect.y, 160) // 100 + 60
  assert.equal(rect.width, 200)
  assert.equal(rect.height, 120)

  // Trường hợp phần tử tràn ra ngoài bên phải iframe -> tự động cắt (clamped) không vượt quá 1200
  const overflowEl = {
    left: 900,
    top: 700,
    width: 400,
    height: 300,
  }

  const clampedRect = calculateCaptureRect({
    scope: 'element',
    iframeBounds,
    elementRect: overflowEl,
    iframeClientSize: { width: 1000, height: 800 },
  })

  assert.equal(clampedRect.x, 1100) // 200 + 900
  assert.equal(clampedRect.y, 800)  // 100 + 700
  assert.equal(clampedRect.width, 100) // max width chỉ còn 1200 - 1100 = 100
  assert.equal(clampedRect.height, 100) // max height chỉ còn 900 - 800 = 100
})

test('D2-16: calculateCaptureRect phạm vi fullPage mở rộng theo scrollHeight của trang', () => {
  const iframeBounds = {
    left: 150,
    top: 80,
    right: 1150,
    bottom: 680,
    width: 1000,
    height: 600,
  }

  const rect = calculateCaptureRect({
    scope: 'fullPage',
    iframeBounds,
    iframeClientSize: { width: 1000, height: 600 },
    fullPageSize: { width: 1000, height: 2400 },
  })

  assert.equal(rect.x, 150)
  assert.equal(rect.y, 80)
  assert.equal(rect.width, 1000)
  assert.equal(rect.height, 2400)
})

test('D2-16: formatCaptureFilename chuẩn hoá tên tệp an toàn', () => {
  const filename = formatCaptureFilename('BanCoTuong / Test #1!', 'viewport')
  assert.ok(filename.startsWith('BanCoTuong-Test-1-viewport-'))
  assert.ok(filename.endsWith('.png'))
  assert.equal(filename.includes('#'), false)
  assert.equal(filename.includes('/'), false)
})
