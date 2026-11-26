import { test } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  calculateRelativePosition,
  calculateAbsolutePosition,
  filterAnnotations,
} from '../shared/annotation.ts'
import {
  listAnnotations,
  addAnnotation,
  updateAnnotation,
  deleteAnnotation,
} from '../electron/main/annotations.ts'

test('D2-15: calculateRelativePosition tính toán chính xác tọa độ tương đối (%)', () => {
  const container = { left: 100, top: 100, width: 800, height: 600 }

  // Điểm giữa (500, 400) -> x = 400/800 = 50%, y = 300/600 = 50%
  const center = calculateRelativePosition(500, 400, container)
  assert.equal(center.xPercent, 50)
  assert.equal(center.yPercent, 50)

  // Điểm góc trên trái (100, 100) -> 0%, 0%
  const topLeft = calculateRelativePosition(100, 100, container)
  assert.equal(topLeft.xPercent, 0)
  assert.equal(topLeft.yPercent, 0)

  // Điểm vượt quá khung ngoài -> tự động clamp về 0% và 100%
  const outOfBounds = calculateRelativePosition(1200, -50, container)
  assert.equal(outOfBounds.xPercent, 100)
  assert.equal(outOfBounds.yPercent, 0)
})

test('D2-15: calculateAbsolutePosition chuyển đổi % thành pixel chính xác', () => {
  const pos = calculateAbsolutePosition(25, 75, 1000, 400)
  assert.equal(pos.left, 250)
  assert.equal(pos.top, 300)
})

test('D2-15: filterAnnotations lọc chính xác theo route và trạng thái resolve', () => {
  const samplePins = [
    {
      id: '1',
      projectPath: '/test',
      route: '/',
      xPercent: 10,
      yPercent: 10,
      author: 'A',
      content: 'Chưa xử lý trên trang chủ',
      resolved: false,
      createdAt: '2026-11-25T00:00:00Z',
    },
    {
      id: '2',
      projectPath: '/test',
      route: '/',
      xPercent: 20,
      yPercent: 20,
      author: 'B',
      content: 'Đã xử lý trên trang chủ',
      resolved: true,
      createdAt: '2026-11-25T00:00:00Z',
    },
    {
      id: '3',
      projectPath: '/test',
      route: '/about',
      xPercent: 30,
      yPercent: 30,
      author: 'C',
      content: 'Trang about',
      resolved: false,
      createdAt: '2026-11-25T00:00:00Z',
    },
  ]

  // Lọc chỉ hiện ghim chưa xử lý trên trang chủ
  const openHome = filterAnnotations(samplePins, { route: '/', showResolved: false })
  assert.equal(openHome.length, 1)
  assert.equal(openHome[0].id, '1')

  // Hiện tất cả trên trang chủ (kể cả đã resolve)
  const allHome = filterAnnotations(samplePins, { route: '/', showResolved: true })
  assert.equal(allHome.length, 2)
})

test('D2-15: Quản lý lưu trữ tệp .pixelmind/annotations.json (CRUD)', async () => {
  const testDir = await fs.mkdtemp(join(tmpdir(), 'pm-annotation-test-'))

  try {
    // 1. Khi chưa có tệp -> trả mảng rỗng
    const initialList = await listAnnotations(testDir)
    assert.deepEqual(initialList, [])

    // 2. Thêm ghi chú mới (cho phép tạo draft rỗng khi click lên Canvas)
    const emptyDraftRes = await addAnnotation(testDir, {
      xPercent: 10,
      yPercent: 20,
      route: '/',
      content: '',
    })
    assert.equal(emptyDraftRes.ok, true)
    assert.ok(emptyDraftRes.annotation?.id)
    assert.equal(emptyDraftRes.annotation.content, '')
    await deleteAnnotation(testDir, emptyDraftRes.annotation.id)

    // Thêm ghi chú có nội dung
    const addRes = await addAnnotation(testDir, {
      xPercent: 33.5,
      yPercent: 66.8,
      route: '/dashboard',
      author: 'Tester',
      content: 'Cần đổi màu nút bấm sang tím',
    })
    assert.equal(addRes.ok, true)
    assert.ok(addRes.annotation?.id)
    assert.equal(addRes.annotation.content, 'Cần đổi màu nút bấm sang tím')
    assert.equal(addRes.annotation.resolved, false)

    // Đọc lại từ tệp
    const afterAdd = await listAnnotations(testDir)
    assert.equal(afterAdd.length, 1)
    assert.equal(afterAdd[0].id, addRes.annotation.id)

    // 3. Cập nhật trạng thái và nội dung (Resolve / Edit)
    const updateRes = await updateAnnotation(testDir, addRes.annotation.id, {
      content: 'Đã đổi màu nút bấm sang tím đậm',
      resolved: true,
    })
    assert.equal(updateRes.ok, true)
    assert.equal(updateRes.annotation?.resolved, true)
    assert.equal(updateRes.annotation?.content, 'Đã đổi màu nút bấm sang tím đậm')

    // 4. Xóa ghi chú
    const delRes = await deleteAnnotation(testDir, addRes.annotation.id)
    assert.equal(delRes.ok, true)

    const finalList = await listAnnotations(testDir)
    assert.equal(finalList.length, 0)
  } finally {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {})
  }
})
