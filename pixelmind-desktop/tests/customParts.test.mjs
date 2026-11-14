import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  inspectSuspiciousCode,
  generatePartPreviewSvg,
  listCustomParts,
  saveCustomPart,
  deleteCustomPart,
} from '../electron/main/customParts.ts'

test('inspectSuspiciousCode detects dangerous scripts and patterns', () => {
  // Safe HTML
  assert.equal(inspectSuspiciousCode('<div class="card"><h1>Hello</h1></div>').suspicious, false)
  assert.equal(inspectSuspiciousCode('<button onclick="alert(1)">Click</button>').suspicious, false)

  // Dangerous scripts
  const scriptTest = inspectSuspiciousCode('<div class="box"><script>alert("hack")</script></div>')
  assert.equal(scriptTest.suspicious, true)
  assert.ok(scriptTest.reasons.some((r) => r.includes('<script>')))

  // Dangerous javascript: URL
  const jsUrlTest = inspectSuspiciousCode('<a href="javascript:doSomething()">Link</a>')
  assert.equal(jsUrlTest.suspicious, true)
  assert.ok(jsUrlTest.reasons.some((r) => r.includes('javascript:')))

  // Dangerous eval or cookie theft in event handler
  const evalTest = inspectSuspiciousCode('<img src="x" onerror="eval(atob(\'xyz\'))" />')
  assert.equal(evalTest.suspicious, true)
  assert.ok(evalTest.reasons.some((r) => r.includes('eval()') || r.includes('trình xử lý sự kiện')))
})

test('generatePartPreviewSvg generates a valid SVG data URI', () => {
  const svgData = generatePartPreviewSvg('<button class="btn">Click me</button>', '.btn { color: red; }')
  assert.ok(svgData.startsWith('data:image/svg+xml;base64,'))
  const decoded = Buffer.from(svgData.replace('data:image/svg+xml;base64,', ''), 'base64').toString('utf8')
  assert.ok(decoded.includes('<button class="btn">Click me</button>'))
  assert.ok(decoded.includes('.btn { color: red; }'))
})

test('save, list and delete custom parts workflow', async () => {
  const tempDir = await fs.mkdtemp(join(tmpdir(), 'pm-parts-test-'))
  try {
    // 1. Initial list is empty
    const initList = await listCustomParts(tempDir)
    assert.equal(initList.success, true)
    assert.equal(initList.parts.length, 0)

    // 2. Reject empty name or html
    const emptyNameRes = await saveCustomPart(tempDir, { name: '', html: '<div>test</div>' })
    assert.equal(emptyNameRes.success, false)

    const emptyHtmlRes = await saveCustomPart(tempDir, { name: 'Card', html: '' })
    assert.equal(emptyHtmlRes.success, false)

    // 3. Reject suspicious code
    const dangerRes = await saveCustomPart(tempDir, {
      name: 'Bad Part',
      html: '<script>document.cookie = "stolen"</script>',
    })
    assert.equal(dangerRes.success, false)
    assert.ok(dangerRes.error.includes('Phát hiện mã đáng nghi'))

    // 4. Save valid part
    const saveRes = await saveCustomPart(tempDir, {
      name: 'Thẻ bài viết (Card)',
      description: 'Khối card giới thiệu sản phẩm',
      html: '<div class="product-card"><h3>Sản phẩm A</h3><p>Giá: 100k</p></div>',
      css: '.product-card { padding: 16px; border: 1px solid #ccc; }',
    })
    assert.equal(saveRes.success, true)
    assert.ok(saveRes.part?.id)
    assert.equal(saveRes.part?.name, 'Thẻ bài viết (Card)')
    assert.ok(saveRes.part?.preview?.startsWith('data:image/svg+xml;base64,'))

    // 5. List parts
    const listRes = await listCustomParts(tempDir)
    assert.equal(listRes.success, true)
    assert.equal(listRes.parts.length, 1)
    assert.equal(listRes.parts[0].name, 'Thẻ bài viết (Card)')

    // 6. Delete part
    const delRes = await deleteCustomPart(tempDir, saveRes.part.id)
    assert.equal(delRes.success, true)

    // 7. Verify deletion
    const postDelList = await listCustomParts(tempDir)
    assert.equal(postDelList.parts.length, 0)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
})

