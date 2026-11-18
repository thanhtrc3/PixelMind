import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  deployErrorMessage,
  idleDeployState,
  parseDeployUrl,
  redactSecrets,
} from '../shared/deploy.ts'

describe('redactSecrets', () => {
  it('che mọi lần xuất hiện của secret', () => {
    const out = redactSecrets('Authorization: Bearer abc123\nabc123 abc123', ['abc123'])
    assert.doesNotMatch(out, /abc123/)
    assert.match(out, /\*\*\*/)
  })

  it('bỏ qua secret rỗng/ngắn để không che bừa', () => {
    assert.equal(redactSecrets('hello world', ['', 'a']), 'hello world')
  })
})

describe('parseDeployUrl', () => {
  it('bắt URL vercel/netlify/custom, bỏ dấu câu cuối', () => {
    assert.equal(parseDeployUrl('Production: https://demo.vercel.app'), 'https://demo.vercel.app')
    assert.equal(parseDeployUrl('site: https://demo-123.netlify.app.'), 'https://demo-123.netlify.app')
    assert.equal(parseDeployUrl('Deployed to https://pixel.example.com/preview'), 'https://pixel.example.com/preview')
  })

  it('không có URL thì null', () => {
    assert.equal(parseDeployUrl('building...'), null)
    assert.equal(parseDeployUrl('http://insecure.local'), null)
  })
})

describe('deployErrorMessage', () => {
  it('nêu mã lỗi và đuôi stderr', () => {
    const msg = deployErrorMessage(1, 'error: build failed\nmissing module')
    assert.match(msg, /mã 1/)
    assert.match(msg, /missing module/)
  })

  it('không có mã lỗi thì báo không khởi chạy được', () => {
    assert.match(deployErrorMessage(null, ''), /Không khởi chạy được/)
  })
})

describe('idleDeployState', () => {
  it('trạng thái nghỉ', () => {
    assert.deepEqual(idleDeployState(), { status: 'idle', url: null, phase: '' })
  })
})

import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runDeployCommand } from '../electron/main/deploy.ts'

const TOKEN = 'super-secret-token-999'

async function makeScript(body) {
  const dir = await mkdtemp(join(tmpdir(), 'pm-deploy-'))
  const file = join(dir, 'deploy.mjs')
  await writeFile(file, body, 'utf8')
  return { dir, command: `node "${file}"` }
}

describe('runDeployCommand', () => {
  it('phát log đã che secret, bắt URL và ok=true', async () => {
    const { dir, command } = await makeScript(
      "console.log('token=' + process.env.PM_TOKEN)\nconsole.log('Production: https://demo.vercel.app')\n",
    )
    try {
      const logs = []
      const res = await runDeployCommand({
        command,
        cwd: dir,
        env: { PM_TOKEN: TOKEN },
        secrets: [TOKEN],
        onLog: (l) => logs.push(l),
      })
      assert.equal(res.ok, true)
      assert.equal(res.url, 'https://demo.vercel.app')
      assert.ok(logs.length > 0)
      const joined = logs.map((l) => l.text).join('')
      assert.doesNotMatch(joined, new RegExp(TOKEN))
      assert.match(joined, /\*\*\*/)
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  })

  it('thoát mã khác 0 trả lỗi kèm stderr đã che', async () => {
    const { dir, command } = await makeScript(
      "console.log(process.env.PM_TOKEN)\nconsole.error('build failed: missing module')\nprocess.exit(2)\n",
    )
    try {
      const res = await runDeployCommand({ command, cwd: dir, env: { PM_TOKEN: TOKEN }, secrets: [TOKEN] })
      assert.equal(res.ok, false)
      assert.match(res.error, /mã 2/)
      assert.match(res.error, /missing module/)
      assert.doesNotMatch(res.error, new RegExp(TOKEN))
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  })

  it('quá timeout thì kill và báo lỗi', async () => {
    const { dir, command } = await makeScript('setTimeout(() => {}, 5000)\n')
    try {
      const started = Date.now()
      const res = await runDeployCommand({ command, cwd: dir, timeoutMs: 300 })
      assert.equal(res.ok, false)
      assert.match(res.error, /thời gian/i)
      assert.ok(Date.now() - started < 4000)
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  })

  it('lệnh không tồn tại trả lỗi cụ thể', async () => {
    const { dir } = await makeScript('')
    try {
      const res = await runDeployCommand({ command: 'pm-lenh-khong-ton-tai-xyz', cwd: dir })
      assert.equal(res.ok, false)
      assert.ok(res.error && res.error.length > 10)
      assert.match(res.error.toLowerCase(), /pm-lenh-khong-ton-tai-xyz|không khởi chạy/)
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  })
})

