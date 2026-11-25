import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizePdfOptions,
  getMarginsForPrint,
  formatPdfFilename,
} from '../shared/pdf.ts'

test('D2-17: normalizePdfOptions áp dụng giá trị mặc định hợp lý', () => {
  const norm = normalizePdfOptions()
  assert.equal(norm.pageSize, 'A4')
  assert.equal(norm.landscape, false)
  assert.equal(norm.printBackground, true)
  assert.equal(norm.marginType, 'default')
  assert.equal(norm.scale, 1.0)

  // Kiểm tra giới hạn scale
  const custom = normalizePdfOptions({
    pageSize: 'A3',
    landscape: true,
    scale: 3.5, // Vượt quá 2.0 -> clamp về 2.0
  })
  assert.equal(custom.pageSize, 'A3')
  assert.equal(custom.landscape, true)
  assert.equal(custom.scale, 2.0)
})

test('D2-17: getMarginsForPrint chuyển đổi chính xác cấu hình lề Chromium', () => {
  const noneMargin = getMarginsForPrint('none')
  assert.equal(noneMargin.marginType, 'none')

  const minMargin = getMarginsForPrint('minimal')
  assert.equal(minMargin.marginType, 'custom')
  assert.equal(minMargin.top, 0.2)
  assert.equal(minMargin.left, 0.2)

  const defMargin = getMarginsForPrint('default')
  assert.equal(defMargin.marginType, 'default')
})

test('D2-17: formatPdfFilename tạo tên file PDF chuẩn xác và an toàn', () => {
  const filename = formatPdfFilename('BanCoTuong / Pro', '/dashboard', 'A4', false)
  assert.ok(filename.startsWith('BanCoTuong-Pro-dashboard-A4-doc-'))
  assert.ok(filename.endsWith('.pdf'))
  assert.equal(filename.includes('#'), false)
  assert.equal(filename.includes('/'), false)

  const landscapeFilename = formatPdfFilename('Project', '/', 'A3', true)
  assert.ok(landscapeFilename.startsWith('Project-trang-chu-A3-ngang-'))
  assert.ok(landscapeFilename.endsWith('.pdf'))
})
