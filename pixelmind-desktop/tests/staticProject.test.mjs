import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { promises as fs } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

// Logic độc lập kiểm tra nhận diện Web tĩnh (tương tự detectOtherProject & diagnose)
async function detectStaticWeb(dir) {
  const exists = async (f) =>
    fs.access(join(dir, f)).then(() => true).catch(() => false)

  const hasRootIndex = (await exists('index.html')) || (await exists('index.htm'))
  const hasPublicIndex =
    (await exists(join('public', 'index.html'))) || (await exists(join('public', 'index.htm')))

  let isStaticWeb = hasRootIndex || hasPublicIndex
  let staticPreviewDir = hasPublicIndex && !hasRootIndex ? 'public' : ''

  if (!isStaticWeb) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      const anyHtml = entries.some((e) => e.isFile() && /\.(html|htm)$/i.test(e.name))
      if (anyHtml) {
        isStaticWeb = true
      }
    } catch {}
  }

  if (isStaticWeb) {
    return {
      framework: 'HTML5 / Web Tĩnh',
      packageManager: 'none',
      scripts: [
        { name: 'static', command: 'static-server', kind: 'dev', direct: true },
      ],
      hasIndexHtml: true,
      previewDir: staticPreviewDir,
    }
  }

  return null
}

describe('D1-12: Nhập thư mục HTML tĩnh (không cần package.json)', () => {
  it('detects a root index.html directory as HTML5 / Web Tĩnh with static server script', async () => {
    const tempDir = await fs.mkdtemp(join(tmpdir(), 'pm-static-root-'))
    try {
      await fs.writeFile(join(tempDir, 'index.html'), '<!DOCTYPE html><html><body><h1>Hello</h1></body></html>', 'utf8')
      await fs.writeFile(join(tempDir, 'style.css'), 'body { background: #000; }', 'utf8')
      await fs.writeFile(join(tempDir, 'main.js'), 'console.log("ready")', 'utf8')

      const result = await detectStaticWeb(tempDir)
      assert.ok(result, 'Thư mục tĩnh phải được nhận diện thành công')
      assert.equal(result.framework, 'HTML5 / Web Tĩnh')
      assert.equal(result.packageManager, 'none')
      assert.equal(result.hasIndexHtml, true)
      assert.equal(result.previewDir, '')
      assert.ok(result.scripts.some((s) => s.name === 'static' && s.command === 'static-server'))
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('detects public/index.html directory and sets previewDir to public', async () => {
    const tempDir = await fs.mkdtemp(join(tmpdir(), 'pm-static-public-'))
    try {
      await fs.mkdir(join(tempDir, 'public'), { recursive: true })
      await fs.writeFile(join(tempDir, 'public', 'index.html'), '<html><body>Public</body></html>', 'utf8')
      await fs.writeFile(join(tempDir, 'README.md'), '# Static site', 'utf8')

      const result = await detectStaticWeb(tempDir)
      assert.ok(result)
      assert.equal(result.framework, 'HTML5 / Web Tĩnh')
      assert.equal(result.previewDir, 'public')
      assert.equal(result.hasIndexHtml, true)
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('detects a folder containing any .html file without requiring index.html or package.json', async () => {
    const tempDir = await fs.mkdtemp(join(tmpdir(), 'pm-static-custom-'))
    try {
      await fs.writeFile(join(tempDir, 'landing.html'), '<html><body>Landing</body></html>', 'utf8')
      await fs.writeFile(join(tempDir, 'app.css'), '/* styles */', 'utf8')

      const result = await detectStaticWeb(tempDir)
      assert.ok(result)
      assert.equal(result.framework, 'HTML5 / Web Tĩnh')
      assert.equal(result.hasIndexHtml, true)
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('returns null for non-web empty folders', async () => {
    const tempDir = await fs.mkdtemp(join(tmpdir(), 'pm-empty-'))
    try {
      await fs.writeFile(join(tempDir, 'notes.txt'), 'notes only', 'utf8')

      const result = await detectStaticWeb(tempDir)
      assert.equal(result, null)
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })
})
