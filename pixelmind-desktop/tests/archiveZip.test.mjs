import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  detectCommonRoot,
  sanitizeEntryName,
  shouldExcludeForExport,
  stripRootFolder,
} from '../shared/archive.ts'
import {
  exportProjectToZip,
  extractZipSafely,
  inspectZipFile,
} from '../electron/main/archive.ts'

/* ── Tiện ích tạo ZIP tối giản (method 0 — stored) để thử đầu vào độc hại ── */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
})()

const crc32 = (buffer) => {
  let value = 0xffffffff
  for (const byte of buffer) {
    value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8)
  }
  return (value ^ 0xffffffff) >>> 0
}

/** Tạo ZIP hợp lệ về định dạng nhưng có thể chứa tên độc hại (yazl không cho phép). */
function buildStoredZip(entries) {
  const localChunks = []
  const centralChunks = []
  let offset = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    const data = Buffer.from(entry.data ?? '', 'utf8')
    const crc = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    localChunks.push(local, name, data)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(entry.externalAttrs ?? 0, 38)
    central.writeUInt32LE(offset, 42)
    centralChunks.push(central, name)

    offset += 30 + name.length + data.length
  }

  const centralBuffer = Buffer.concat(centralChunks)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(centralBuffer.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)

  return Buffer.concat([...localChunks, centralBuffer, eocd])
}

async function makeTempDir(prefix) {
  return fs.mkdtemp(join(tmpdir(), prefix))
}

async function writeTree(root, files) {
  for (const [relative, content] of Object.entries(files)) {
    const full = join(root, relative)
    await fs.mkdir(join(full, '..'), { recursive: true })
    await fs.writeFile(full, content, 'utf8')
  }
}

async function readTree(root) {
  const result = {}
  const walk = async (dir, base = '') => {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const rel = base ? `${base}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        await walk(join(dir, entry.name), rel)
      } else {
        result[rel] = await fs.readFile(join(dir, entry.name), 'utf8')
      }
    }
  }
  await walk(root)
  return result
}

/* ── Kiểm tra tên mục an toàn ─────────────────────────────────────────── */

describe('D1-11: chuẩn hoá đường dẫn trong ZIP', () => {
  it('chấp nhận đường dẫn tương đối và chuyển dấu \\ thành /', () => {
    const result = sanitizeEntryName('src\\components\\App.tsx')
    assert.equal(result.ok, true)
    assert.equal(result.name, 'src/components/App.tsx')
    assert.equal(result.directory, false)
  })

  it('nhận diện entry thư mục và bỏ dấu / cuối', () => {
    const result = sanitizeEntryName('src/assets/')
    assert.equal(result.ok, true)
    assert.equal(result.name, 'src/assets')
    assert.equal(result.directory, true)
  })

  it('từ chối path traversal', () => {
    for (const name of ['../evil.txt', 'a/../../evil.txt', '..\\evil.txt']) {
      const result = sanitizeEntryName(name)
      assert.equal(result.ok, false, name)
      assert.equal(result.fatal, true, name)
      assert.match(result.reason ?? '', /traversal|\.\./)
    }
  })

  it('từ chối đường dẫn tuyệt đối, ổ đĩa và UNC', () => {
    for (const name of ['/etc/passwd', 'C:\\Windows\\system.ini', '\\\\server\\share\\x.txt']) {
      const result = sanitizeEntryName(name)
      assert.equal(result.ok, false, name)
      assert.equal(result.fatal, true, name)
    }
  })

  it('từ chối NTFS alternate data stream và ký tự điều khiển', () => {
    assert.equal(sanitizeEntryName('file.txt:hidden').fatal, true)
    assert.equal(sanitizeEntryName('bad\u0001name.txt').fatal, true)
  })

  it('tự sửa ký tự Windows không hợp lệ và tên thiết bị dành riêng', () => {
    const illegal = sanitizeEntryName('a<b>c?.txt')
    assert.equal(illegal.ok, true)
    assert.equal(illegal.name, 'a_b_c_.txt')
    assert.equal(illegal.changed, true)

    const reserved = sanitizeEntryName('CON.txt')
    assert.equal(reserved.ok, true)
    assert.equal(reserved.name, '_CON.txt')
    assert.equal(reserved.changed, true)
  })

  it('phát hiện và bỏ lớp thư mục gốc chung', () => {
    assert.equal(detectCommonRoot(['my-app/package.json', 'my-app/src/main.ts']), 'my-app')
    assert.equal(detectCommonRoot(['package.json', 'my-app/src/main.ts']), undefined)
    assert.equal(detectCommonRoot(['a/x.txt', 'b/y.txt']), undefined)
    assert.equal(stripRootFolder('my-app/src/main.ts', 'my-app'), 'src/main.ts')
    assert.equal(stripRootFolder('my-app', 'my-app'), '')
  })
})

/* ── Quy tắc loại trừ khi xuất ────────────────────────────────────────── */

describe('D1-13: quy tắc loại trừ khi xuất ZIP', () => {
  it('loại trừ dependency, VCS và artifact build', () => {
    for (const path of [
      'node_modules/react/index.js',
      'src/.git/HEAD',
      'dist/bundle.js',
      'build/out.js',
      'bin/Debug/app.dll',
      'obj/project.assets.json',
      '.next/cache/data',
      'coverage/lcov.info',
      '.DS_Store',
      'Thumbs.db',
    ]) {
      assert.equal(shouldExcludeForExport(path), true, path)
    }
  })

  it('giữ mã nguồn và cấu hình hợp lệ', () => {
    for (const path of ['package.json', 'src/app.tsx', 'public/logo.svg', '.vscode/settings.json']) {
      assert.equal(shouldExcludeForExport(path), false, path)
    }
  })

  it('chỉ giữ .git khi người dùng chọn kèm', () => {
    assert.equal(shouldExcludeForExport('.git/config', false), true)
    assert.equal(shouldExcludeForExport('.git/config', true), false)
    assert.equal(shouldExcludeForExport('.svn/entries', true), true)
    assert.equal(shouldExcludeForExport('node_modules/x/y.js', true), true)
  })
})

/* ── Kiểm tra ZIP thật ────────────────────────────────────────────────── */

describe('D1-11: kiểm tra và giải nén ZIP', () => {
  it('từ chối ZIP chứa đường dẫn traversal và không ghi tệp ra ngoài', async () => {
    const tempDir = await makeTempDir('pm-zip-traversal-')
    const zipPath = join(tempDir, 'evil.zip')
    const outputDir = join(tempDir, 'out')
    try {
      await fs.writeFile(
        zipPath,
        buildStoredZip([
          { name: '../evil.txt', data: 'pwned' },
          { name: 'safe.txt', data: 'ok' },
        ]),
      )

      const inspection = await inspectZipFile(zipPath)
      assert.equal(inspection.ok, false)
      assert.match(inspection.error ?? '', /không an toàn|traversal/)

      const extracted = await extractZipSafely(zipPath, outputDir)
      assert.equal(extracted.ok, false)

      const escaped = await fs.access(join(tempDir, 'evil.txt')).then(() => true).catch(() => false)
      assert.equal(escaped, false, 'Không được ghi tệp ra ngoài thư mục đích')
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('từ chối ZIP bị hỏng và ZIP rỗng', async () => {
    const tempDir = await makeTempDir('pm-zip-broken-')
    try {
      const broken = join(tempDir, 'broken.zip')
      await fs.writeFile(broken, Buffer.from('day khong phai tep zip'))
      const brokenResult = await inspectZipFile(broken)
      assert.equal(brokenResult.ok, false)
      assert.ok(brokenResult.error)

      const empty = join(tempDir, 'empty.zip')
      await fs.writeFile(empty, buildStoredZip([]))
      const emptyResult = await inspectZipFile(empty)
      assert.equal(emptyResult.ok, false)
      assert.match(emptyResult.error ?? '', /không chứa tệp/)
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('từ chối ZIP có mục trùng tên', async () => {
    const tempDir = await makeTempDir('pm-zip-duplicate-')
    try {
      const zipPath = join(tempDir, 'dup.zip')
      await fs.writeFile(
        zipPath,
        buildStoredZip([
          { name: 'README.md', data: 'a' },
          { name: 'readme.md', data: 'b' },
        ]),
      )
      const result = await inspectZipFile(zipPath)
      assert.equal(result.ok, false)
      assert.match(result.error ?? '', /trùng tên/)
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('bỏ qua mục rác đứng trước tệp thật mà vẫn giải nén đúng', async () => {
    const tempDir = await makeTempDir('pm-zip-junk-')
    const zipPath = join(tempDir, 'junk.zip')
    const outputDir = join(tempDir, 'out')
    try {
      await fs.writeFile(
        zipPath,
        buildStoredZip([
          { name: '__MACOSX/._app' },
          { name: '.DS_Store', data: 'junk' },
          { name: 'package.json', data: '{}\n' },
          { name: 'src/main.ts', data: 'export {}\n' },
        ]),
      )

      const extracted = await extractZipSafely(zipPath, outputDir)
      assert.equal(extracted.ok, true, extracted.error)
      assert.equal(extracted.fileCount, 2)

      const tree = await readTree(outputDir)
      assert.deepEqual(tree, { 'package.json': '{}\n', 'src/main.ts': 'export {}\n' })
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('bỏ lớp thư mục gốc chung khi giải nén', async () => {
    const tempDir = await makeTempDir('pm-zip-strip-')
    const zipPath = join(tempDir, 'wrapped.zip')
    const outputDir = join(tempDir, 'out')
    try {
      await fs.writeFile(
        zipPath,
        buildStoredZip([
          { name: 'my-app/' },
          { name: 'my-app/package.json', data: '{"name":"demo"}' },
          { name: 'my-app/src/main.ts', data: 'export {}\n' },
        ]),
      )

      const inspection = await inspectZipFile(zipPath)
      assert.equal(inspection.ok, true)
      assert.equal(inspection.rootFolder, 'my-app')
      assert.equal(inspection.fileCount, 2)

      const extracted = await extractZipSafely(zipPath, outputDir, { stripRoot: true })
      assert.equal(extracted.ok, true)
      assert.equal(extracted.fileCount, 2)

      const tree = await readTree(outputDir)
      assert.deepEqual(tree, {
        'package.json': '{"name":"demo"}',
        'src/main.ts': 'export {}\n',
      })
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })
})

/* ── Xuất dự án ───────────────────────────────────────────────────────── */

describe('D1-13: xuất dự án ra ZIP', () => {
  it('loại trừ dependency/VCS/artifact, giữ nguyên tệp nguồn và giải nén lại được', async () => {
    const tempDir = await makeTempDir('pm-zip-export-')
    const projectDir = join(tempDir, 'demo-project')
    const zipPath = join(tempDir, 'demo-project.zip')
    const extractDir = join(tempDir, 'restored')
    try {
      await writeTree(projectDir, {
        'package.json': '{"name":"demo"}\n',
        'index.html': '<!DOCTYPE html><html><body>Demo</body></html>\n',
        'src/app.tsx': 'export const App = () => null\n',
        'public/logo.svg': '<svg></svg>\n',
        'node_modules/react/index.js': 'module.exports = {}\n',
        'dist/bundle.js': 'console.log("built")\n',
        '.git/HEAD': 'ref: refs/heads/main\n',
        '.DS_Store': 'junk',
      })
      await fs.mkdir(join(projectDir, 'empty-folder'), { recursive: true })

      const before = await readTree(projectDir)

      const result = await exportProjectToZip({ root: projectDir, zipPath })
      assert.equal(result.ok, true, result.error)
      assert.equal(result.fileCount, 4)
      assert.ok((result.skipped ?? 0) >= 4)

      const inspection = await inspectZipFile(zipPath)
      assert.equal(inspection.ok, true, inspection.error)
      const names = inspection.entries.map((entry) => entry.name)
      assert.ok(names.includes('package.json'))
      assert.ok(names.includes('src/app.tsx'))
      assert.ok(names.includes('empty-folder'))
      assert.equal(names.some((name) => name.startsWith('node_modules/')), false)
      assert.equal(names.some((name) => name.startsWith('.git/')), false)
      assert.equal(names.some((name) => name.startsWith('dist/')), false)
      assert.equal(names.includes('.DS_Store'), false)

      const extracted = await extractZipSafely(zipPath, extractDir, { stripRoot: true })
      assert.equal(extracted.ok, true, extracted.error)
      const restored = await readTree(extractDir)
      assert.equal(restored['package.json'], '{"name":"demo"}\n')
      assert.equal(restored['src/app.tsx'], 'export const App = () => null\n')
      assert.equal(restored['public/logo.svg'], '<svg></svg>\n')
      assert.equal(restored['node_modules/react/index.js'], undefined)

      const after = await readTree(projectDir)
      assert.deepEqual(after, before, 'Tệp nguồn không được thay đổi')
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('kèm .git khi được chọn', async () => {
    const tempDir = await makeTempDir('pm-zip-export-git-')
    const projectDir = join(tempDir, 'git-project')
    try {
      await writeTree(projectDir, {
        'index.html': '<html></html>',
        '.git/HEAD': 'ref: refs/heads/main\n',
      })
      const zipPath = join(tempDir, 'with-git.zip')
      const result = await exportProjectToZip({ root: projectDir, zipPath, includeGit: true })
      assert.equal(result.ok, true, result.error)

      const inspection = await inspectZipFile(zipPath)
      const names = inspection.entries.map((entry) => entry.name)
      assert.ok(names.includes('.git/HEAD'))
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('không đưa chính tệp ZIP đầu ra vào gói khi lưu trong dự án', async () => {
    const tempDir = await makeTempDir('pm-zip-self-')
    const projectDir = join(tempDir, 'self-project')
    try {
      await writeTree(projectDir, { 'index.html': '<html></html>' })
      const zipPath = join(projectDir, 'backup.zip')
      const result = await exportProjectToZip({ root: projectDir, zipPath })
      assert.equal(result.ok, true, result.error)

      const inspection = await inspectZipFile(zipPath)
      const names = inspection.entries.map((entry) => entry.name)
      assert.equal(names.includes('backup.zip'), false)
      assert.equal(await fs.access(zipPath).then(() => true).catch(() => false), true)
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('báo lỗi ghi tệp rõ ràng khi đường dẫn lưu không hợp lệ', async () => {
    const tempDir = await makeTempDir('pm-zip-write-error-')
    const projectDir = join(tempDir, 'error-project')
    const blocker = join(tempDir, 'blocker')
    try {
      await writeTree(projectDir, { 'index.html': '<html></html>' })
      await fs.writeFile(blocker, 'not a folder', 'utf8')

      const result = await exportProjectToZip({
        root: projectDir,
        zipPath: join(blocker, 'out.zip'),
      })
      assert.equal(result.ok, false)
      assert.match(result.error ?? '', /Không ghi được|Không tìm thấy/)
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('báo lỗi khi dự án không còn tệp nào sau khi loại trừ', async () => {
    const tempDir = await makeTempDir('pm-zip-empty-export-')
    const projectDir = join(tempDir, 'only-deps')
    try {
      await writeTree(projectDir, { 'node_modules/x/index.js': 'x' })
      const result = await exportProjectToZip({
        root: projectDir,
        zipPath: join(tempDir, 'empty.zip'),
      })
      assert.equal(result.ok, false)
      assert.match(result.error ?? '', /Không có tệp nào/)
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })
})
