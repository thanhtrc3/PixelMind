import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { promises as fs } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'

import sharp from 'sharp'
import {
  canReplaceImage,
  imageExtensionFor,
  normalizeDimension,
  normalizeQuality,
  resolveOutputFormat,
  savingsRatio,
  suggestedOutputName,
} from '../shared/imageOptimize.ts'
import {
  applyOptimizedImage,
  inspectImage,
  previewImage,
  revertOptimizedImage,
} from '../electron/main/images.ts'

let root
let backupDir
let noise
let counter = 0

/** Ảnh nhiễu để nén có ý nghĩa (ảnh đơn sắc nén gần như không đổi). */
const makeImage = async (name, format = 'png', width = 320, height = 240) => {
  counter += 1
  const target = join(root, `${counter}-${name}`)
  const pipeline = sharp(noise, { raw: { width, height, channels: 3 } })
  if (format === 'jpeg') await pipeline.jpeg({ quality: 92 }).toFile(target)
  else if (format === 'webp') await pipeline.webp({ quality: 92 }).toFile(target)
  else await pipeline.png().toFile(target)
  return target
}

before(async () => {
  root = await fs.mkdtemp(join(tmpdir(), 'pixelmind-imgopt-'))
  backupDir = join(root, 'backups')
  /* Ảnh nhiễu ngẫu nhiên: nén lossy thể hiện rõ khác biệt dung lượng. */
  const width = 320
  const height = 240
  noise = randomBytes(width * height * 3)
})

after(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('quy tắc tối ưu ảnh dùng chung', () => {
  it('ánh xạ định dạng và phần mở rộng', () => {
    assert.equal(imageExtensionFor('jpeg'), 'jpg')
    assert.equal(imageExtensionFor('webp'), 'webp')
    assert.equal(resolveOutputFormat('jpeg', 'keep'), 'jpeg')
    assert.equal(resolveOutputFormat('jpg', 'keep'), 'jpeg')
    assert.equal(resolveOutputFormat('svg', 'keep'), null)
    assert.equal(resolveOutputFormat('svg', 'png'), 'png')
    assert.equal(suggestedOutputName('logo.png', 'webp'), 'logo.webp')
    assert.equal(suggestedOutputName('logo', 'jpeg'), 'logo.jpg')
  })

  it('chỉ cho ghi đè khi giữ nguyên định dạng và không phải GIF/SVG', () => {
    assert.equal(canReplaceImage('png', 'keep'), true)
    assert.equal(canReplaceImage('jpeg', 'keep'), true)
    assert.equal(canReplaceImage('png', 'webp'), false)
    assert.equal(canReplaceImage('gif', 'keep'), false)
    assert.equal(canReplaceImage('svg', 'png'), false)
    assert.equal(canReplaceImage('bmp', 'keep'), false)
  })

  it('chuẩn hoá chất lượng và kích thước', () => {
    assert.equal(normalizeQuality(undefined), 80)
    assert.equal(normalizeQuality(0), 1)
    assert.equal(normalizeQuality(180), 100)
    assert.equal(normalizeQuality(72.6), 73)
    assert.equal(normalizeDimension(undefined), 0)
    assert.equal(normalizeDimension(-5), 0)
    assert.equal(normalizeDimension(99999), 20_000)
    assert.equal(normalizeDimension(120.4), 120)
    assert.equal(savingsRatio(1000, 400), 0.6)
    assert.equal(savingsRatio(0, 100), 0)
  })
})

describe('inspectImage', () => {
  it('đọc được định dạng, kích thước và dung lượng', async () => {
    const target = await makeImage('inspect.png')
    const result = await inspectImage(target)
    assert.equal(result.ok, true)
    assert.equal(result.info.format, 'png')
    assert.equal(result.info.width, 320)
    assert.equal(result.info.height, 240)
    assert.equal(result.info.name, basename(target))
    assert.equal(result.info.optimizable, true)
    assert.ok(result.info.size > 0)
  })

  it('báo lỗi với tệp không tồn tại và phần mở rộng không phải ảnh', async () => {
    const missing = await inspectImage(join(root, 'khong-ton-tai.png'))
    assert.equal(missing.ok, false)
    assert.match(missing.error, /Không tìm thấy/)

    const textPath = join(root, 'ghi-chu.txt')
    await fs.writeFile(textPath, 'hello')
    const wrong = await inspectImage(textPath)
    assert.equal(wrong.ok, false)
    assert.match(wrong.error, /Chỉ hỗ trợ tệp ảnh/)
  })
})

describe('previewImage', () => {
  it('trả về dung lượng thật, kích thước và tỷ lệ tiết kiệm', async () => {
    const target = await makeImage('preview.png')
    const result = await previewImage({ path: target, format: 'webp', quality: 60 })
    assert.equal(result.ok, true)
    assert.equal(result.output.format, 'webp')
    assert.equal(result.output.width, 320)
    assert.equal(result.output.height, 240)
    assert.ok(result.output.size > 0)
    assert.ok(result.output.dataUrl.startsWith('data:image/webp;base64,'))
    assert.ok(result.output.savings > 0)
    assert.equal(result.output.outputName, `${basename(target, '.png')}.webp`)
  })

  it('chất lượng thấp cho tệp nhỏ hơn', async () => {
    const target = await makeImage('quality.png')
    const low = await previewImage({ path: target, format: 'webp', quality: 25 })
    const high = await previewImage({ path: target, format: 'webp', quality: 95 })
    assert.equal(low.ok, true)
    assert.equal(high.ok, true)
    assert.ok(low.output.size < high.output.size)
  })

  it('thu nhỏ đúng tỉ lệ khi đặt chiều rộng tối đa', async () => {
    const target = await makeImage('resize.png')
    const result = await previewImage({
      path: target,
      format: 'jpeg',
      quality: 75,
      maxWidth: 120,
    })
    assert.equal(result.ok, true)
    assert.equal(result.output.width, 120)
    assert.equal(result.output.height, 90)
    assert.equal(result.output.format, 'jpeg')
  })

  it('báo lỗi khi ảnh chỉ đọc cần chọn định dạng đích', async () => {
    const svgPath = join(root, 'vector.svg')
    await fs.writeFile(
      svgPath,
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#4f7cff"/></svg>',
    )
    const result = await previewImage({ path: svgPath, format: 'keep', quality: 80 })
    assert.equal(result.ok, false)
    assert.match(result.error, /cần chọn định dạng đích/)

    const converted = await previewImage({ path: svgPath, format: 'png', quality: 80 })
    assert.equal(converted.ok, true)
    assert.equal(converted.output.format, 'png')
    assert.equal(converted.output.width, 40)
  })
})

describe('applyOptimizedImage — tạo tệp mới', () => {
  it('không đổi ảnh gốc và ghi vào thư mục optimized/', async () => {
    const target = await makeImage('new.png')
    const before = await fs.readFile(target)

    const result = await applyOptimizedImage({
      path: target,
      format: 'webp',
      quality: 55,
      mode: 'new',
      backupDir,
    })

    assert.equal(result.ok, true)
    assert.equal(result.replaced, false)
    assert.equal(dirname(result.outputPath), join(dirname(target), 'optimized'))
    assert.equal(basename(result.outputPath), `${basename(target, '.png')}.webp`)
    assert.ok(result.size > 0)
    assert.ok(result.originalSize > 0)

    const after = await fs.readFile(target)
    assert.deepEqual(after, before)
    const output = await fs.stat(result.outputPath)
    assert.equal(output.size, result.size)
    const meta = await sharp(await fs.readFile(result.outputPath)).metadata()
    assert.equal(meta.format, 'webp')
    assert.equal(meta.width, result.width)
    assert.equal(meta.height, result.height)
  })

  it('thêm hậu tố khi tệp đã tồn tại thay vì ghi đè', async () => {
    const target = await makeImage('dup.png')
    const first = await applyOptimizedImage({
      path: target,
      format: 'jpeg',
      quality: 70,
      mode: 'new',
      backupDir,
    })
    const second = await applyOptimizedImage({
      path: target,
      format: 'jpeg',
      quality: 70,
      mode: 'new',
      backupDir,
    })
    assert.equal(first.ok, true)
    assert.equal(second.ok, true)
    assert.notEqual(first.outputPath, second.outputPath)
    assert.equal(basename(second.outputPath), `${basename(target, '.png')}-1.jpg`)
    /* Cả hai tệp đều tồn tại. */
    await fs.access(first.outputPath)
    await fs.access(second.outputPath)
  })

  it('giữ nguyên ảnh gốc khi định dạng không đổi nhưng chọn tạo tệp mới', async () => {
    const target = await makeImage('keep.png')
    const before = await fs.readFile(target)
    const result = await applyOptimizedImage({
      path: target,
      format: 'keep',
      quality: 65,
      mode: 'new',
      backupDir,
    })
    assert.equal(result.ok, true)
    assert.equal(result.replaced, false)
    assert.equal(basename(result.outputPath), basename(target))
    assert.deepEqual(await fs.readFile(target), before)
  })
})

describe('applyOptimizedImage — thay thế ảnh gốc', () => {
  it('từ chối khi chưa xác nhận', async () => {
    const target = await makeImage('guard.png')
    const before = await fs.readFile(target)
    const result = await applyOptimizedImage({
      path: target,
      format: 'keep',
      quality: 60,
      mode: 'replace',
      backupDir,
    })
    assert.equal(result.ok, false)
    assert.match(result.error, /Cần xác nhận/)
    assert.deepEqual(await fs.readFile(target), before)
  })

  it('từ chối khi đổi định dạng', async () => {
    const target = await makeImage('format.png')
    const before = await fs.readFile(target)
    const result = await applyOptimizedImage({
      path: target,
      format: 'webp',
      quality: 60,
      mode: 'replace',
      confirmed: true,
      backupDir,
    })
    assert.equal(result.ok, false)
    assert.match(result.error, /Chỉ có thể thay thế ảnh gốc/)
    assert.deepEqual(await fs.readFile(target), before)
  })

  it('ghi đè khi đã xác nhận, tạo bản sao lưu và hoàn tác được', async () => {
    const target = await makeImage('replace.png')
    const original = await fs.readFile(target)

    const result = await applyOptimizedImage({
      path: target,
      format: 'keep',
      quality: 40,
      mode: 'replace',
      confirmed: true,
      backupDir,
    })
    assert.equal(result.ok, true)
    assert.equal(result.replaced, true)
    assert.equal(result.outputPath, target)
    assert.ok(result.backupPath)
    assert.deepEqual(await fs.readFile(result.backupPath), original)

    const optimized = await fs.readFile(target)
    assert.notDeepEqual(optimized, original)
    assert.equal(optimized.length, result.size)

    const revert = await revertOptimizedImage(result.backupPath, target, backupDir)
    assert.equal(revert.success, true)
    assert.deepEqual(await fs.readFile(target), original)
  })

  it('không cho khôi phục từ đường dẫn ngoài thư mục sao lưu', async () => {
    const target = await makeImage('outside.png')
    const outside = join(root, 'outside.png')
    await fs.copyFile(target, outside)
    const result = await revertOptimizedImage(outside, target, backupDir)
    assert.equal(result.success, false)
    assert.match(result.error, /không hợp lệ/)
  })
})