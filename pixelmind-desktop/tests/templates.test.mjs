import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PROJECT_TEMPLATES } from '../shared/projectTemplates.ts'
import { promises as fs } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { tmpdir } from 'node:os'

// Triển khai độc lập runner scaffold cho môi trường test runner
async function testScaffoldProject(options) {
  const { templateId, parentDir, projectName } = options
  const template = PROJECT_TEMPLATES.find((t) => t.id === templateId)
  if (!template) return { success: false, error: 'Không tìm thấy template' }
  const cleanName = projectName.trim()
  if (!cleanName || /[/\\:*?"<>|]/.test(cleanName)) return { success: false, error: 'Tên không hợp lệ' }
  const targetPath = resolve(parentDir, cleanName)
  await fs.mkdir(targetPath, { recursive: true })
  const files = template.files(cleanName)
  for (const file of files) {
    const safeRel = file.path.replace(/\\/g, '/').replace(/^\/+/, '')
    if (safeRel.includes('..')) continue
    const full = resolve(targetPath, safeRel)
    await fs.mkdir(dirname(full), { recursive: true })
    await fs.writeFile(full, file.content, 'utf8')
  }
  return { success: true, projectPath: targetPath, templateName: template.name }
}

describe('Project Templates Registry', () => {
  it('contains at least 8 templates covering all major frameworks', () => {
    assert.ok(PROJECT_TEMPLATES.length >= 8)
    const ids = PROJECT_TEMPLATES.map((t) => t.id)
    assert.ok(ids.includes('aspnet-core-mvc'))
    assert.ok(ids.includes('react-vite-ts'))
    assert.ok(ids.includes('static-landing-page'))
    assert.ok(ids.includes('admin-dashboard-ui'))
    assert.ok(ids.includes('vue3-vite'))
    assert.ok(ids.includes('nextjs-app-router'))
    assert.ok(ids.includes('php-starter'))
    assert.ok(ids.includes('python-web-app'))
  })

  it('each template provides valid files and metadata', () => {
    for (const t of PROJECT_TEMPLATES) {
      assert.ok(t.id)
      assert.ok(t.name)
      assert.ok(t.framework)
      assert.ok(t.runCommand)
      const files = t.files('TestApp')
      assert.ok(Array.isArray(files) && files.length > 0)
      for (const f of files) {
        assert.ok(f.path)
        assert.ok(typeof f.content === 'string')
        assert.ok(!f.path.includes('..'), `Path traversal detected in template ${t.id}`)
      }
    }
  })

  it('scaffolds an ASP.NET Core project cleanly into a directory', async () => {
    const tempDir = await fs.mkdtemp(join(tmpdir(), 'pm-test-template-'))
    try {
      const res = await testScaffoldProject({
        templateId: 'aspnet-core-mvc',
        parentDir: tempDir,
        projectName: 'MyDotnetApp',
      })

      assert.equal(res.success, true)
      assert.ok(res.projectPath)

      const csproj = await fs.readFile(join(res.projectPath, 'MyDotnetApp.csproj'), 'utf8')
      assert.ok(csproj.includes('<TargetFramework>net8.0</TargetFramework>'))

      const programCs = await fs.readFile(join(res.projectPath, 'Program.cs'), 'utf8')
      assert.ok(programCs.includes('AddControllersWithViews'))
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('rejects invalid project names or non-existent templates', async () => {
    const tempDir = await fs.mkdtemp(join(tmpdir(), 'pm-test-fail-'))
    try {
      const res1 = await testScaffoldProject({
        templateId: 'non-existent',
        parentDir: tempDir,
        projectName: 'App',
      })
      assert.equal(res1.success, false)

      const res2 = await testScaffoldProject({
        templateId: 'react-vite-ts',
        parentDir: tempDir,
        projectName: 'App/With/Slashes',
      })
      assert.equal(res2.success, false)
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })
})
