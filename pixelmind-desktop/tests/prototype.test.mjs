import { test } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  validateInteraction,
  getInteractionsForElement,
} from '../shared/prototype.ts'
import {
  listPrototypeInteractions,
  savePrototypeInteractions,
} from '../electron/main/prototype.ts'

test('D2-20: validateInteraction phát hiện route đích hợp lệ và route lỗi', () => {
  const availableRoutes = ['/', '/about', '/contact', '/dashboard']

  // 1. Route hợp lệ
  const validRouteInteraction = {
    id: 'proto_1',
    projectPath: '/test-project',
    trigger: 'click',
    action: 'route',
    target: '/about',
    createdAt: '2026-11-26T00:00:00Z',
  }
  const res1 = validateInteraction(validRouteInteraction, availableRoutes)
  assert.equal(res1.isValid, true)
  assert.equal(res1.error, undefined)

  // 2. Route rỗng -> báo lỗi missing_target
  const emptyRouteInteraction = {
    id: 'proto_2',
    projectPath: '/test-project',
    trigger: 'click',
    action: 'route',
    target: '   ',
    createdAt: '2026-11-26T00:00:00Z',
  }
  const res2 = validateInteraction(emptyRouteInteraction, availableRoutes)
  assert.equal(res2.isValid, false)
  assert.equal(res2.error?.type, 'missing_target')

  // 3. Route không tồn tại trong danh sách trang -> báo lỗi invalid_route
  const brokenRouteInteraction = {
    id: 'proto_3',
    projectPath: '/test-project',
    trigger: 'click',
    action: 'route',
    target: '/checkout-not-found',
    createdAt: '2026-11-26T00:00:00Z',
  }
  const res3 = validateInteraction(brokenRouteInteraction, availableRoutes)
  assert.equal(res3.isValid, false)
  assert.equal(res3.error?.type, 'invalid_route')
})

test('D2-20: validateInteraction kiểm tra tính hợp lệ của action modal và toggle_state', () => {
  // Modal có selector hợp lệ
  const validModal = {
    id: 'proto_4',
    projectPath: '/test-project',
    trigger: 'click',
    action: 'modal',
    target: '#login-modal',
    createdAt: '2026-11-26T00:00:00Z',
  }
  const res4 = validateInteraction(validModal)
  assert.equal(res4.isValid, true)

  // Modal thiếu selector -> báo lỗi missing_target
  const missingModal = {
    id: 'proto_5',
    projectPath: '/test-project',
    trigger: 'click',
    action: 'modal',
    target: '',
    createdAt: '2026-11-26T00:00:00Z',
  }
  const res5 = validateInteraction(missingModal)
  assert.equal(res5.isValid, false)
  assert.equal(res5.error?.type, 'missing_target')

  // Toggle state thiếu target
  const missingState = {
    id: 'proto_6',
    projectPath: '/test-project',
    trigger: 'click',
    action: 'toggle_state',
    target: '',
    createdAt: '2026-11-26T00:00:00Z',
  }
  const res6 = validateInteraction(missingState)
  assert.equal(res6.isValid, false)
  assert.equal(res6.error?.type, 'missing_target')
})

test('D2-20: getInteractionsForElement tìm chính xác tương tác theo UID hoặc CSS selector', () => {
  const interactions = [
    {
      id: 'p1',
      projectPath: '/test',
      sourceUid: 'el-uid-100',
      sourceSelector: 'button.btn-primary',
      trigger: 'click',
      action: 'route',
      target: '/dashboard',
      createdAt: '2026-11-26T00:00:00Z',
    },
    {
      id: 'p2',
      projectPath: '/test',
      sourceSelector: '.nav-link-about',
      trigger: 'hover',
      action: 'toast',
      toastText: 'Xem giới thiệu',
      createdAt: '2026-11-26T00:00:00Z',
    },
  ]

  // Khớp theo UID
  const matchUid = getInteractionsForElement(interactions, 'el-uid-100')
  assert.equal(matchUid.length, 1)
  assert.equal(matchUid[0].id, 'p1')

  // Khớp theo selector
  const matchSelector = getInteractionsForElement(interactions, undefined, '.nav-link-about')
  assert.equal(matchSelector.length, 1)
  assert.equal(matchSelector[0].id, 'p2')

  // Không khớp
  const noMatch = getInteractionsForElement(interactions, 'other-uid', '.other-class')
  assert.equal(noMatch.length, 0)
})

test('D2-20: Persistence CRUD lưu trữ và đọc tương tác Prototype vào .pixelmind/prototype-interactions.json', async () => {
  const testDir = join(tmpdir(), `pixelmind-proto-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`)
  await fs.mkdir(testDir, { recursive: true })

  try {
    // 1. Khi chưa có file, trả về mảng rỗng an toàn
    const initialList = await listPrototypeInteractions(testDir)
    assert.deepEqual(initialList, [])

    // 2. Lưu danh sách tương tác
    const sampleList = [
      {
        id: 'proto_crud_1',
        projectPath: testDir,
        sourceUid: 'btn-1',
        sourceSelector: '#btn-submit',
        trigger: 'click',
        action: 'modal',
        target: '#confirm-dialog',
        createdAt: '2026-11-26T00:00:00Z',
      },
      {
        id: 'proto_crud_2',
        projectPath: testDir,
        sourceUid: 'link-2',
        sourceSelector: 'a.nav-item',
        trigger: 'click',
        action: 'route',
        target: '/contact',
        createdAt: '2026-11-26T00:00:00Z',
      },
    ]

    const saveRes = await savePrototypeInteractions(testDir, sampleList)
    assert.equal(saveRes.ok, true)
    assert.equal(saveRes.count, 2)

    // 3. Đọc lại từ đĩa
    const loadedList = await listPrototypeInteractions(testDir)
    assert.equal(loadedList.length, 2)
    assert.equal(loadedList[0].id, 'proto_crud_1')
    assert.equal(loadedList[0].action, 'modal')
    assert.equal(loadedList[1].id, 'proto_crud_2')
    assert.equal(loadedList[1].target, '/contact')

    // 4. Cập nhật / xóa tương tác
    const updatedList = loadedList.filter((item) => item.id !== 'proto_crud_1')
    const updateRes = await savePrototypeInteractions(testDir, updatedList)
    assert.equal(updateRes.ok, true)
    assert.equal(updateRes.count, 1)

    const finalLoaded = await listPrototypeInteractions(testDir)
    assert.equal(finalLoaded.length, 1)
    assert.equal(finalLoaded[0].id, 'proto_crud_2')
  } finally {
    await fs.rm(testDir, { recursive: true, force: true })
  }
})
