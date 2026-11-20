import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseRepoNameFromUrl } from '../src/lib/gitUrl.ts'

describe('D1-29: Git Clone & Publish to GitHub', () => {
  it('correctly derives project folder name from various Git repository URLs', () => {
    assert.equal(
      parseRepoNameFromUrl('https://github.com/facebook/react.git'),
      'react',
    )
    assert.equal(
      parseRepoNameFromUrl('https://github.com/vercel/next.js'),
      'next.js',
    )
    assert.equal(
      parseRepoNameFromUrl('git@github.com:torvalds/linux.git'),
      'linux',
    )
    assert.equal(
      parseRepoNameFromUrl('https://gitlab.com/group/subgroup/my-service.git/'),
      'my-service',
    )
    assert.equal(parseRepoNameFromUrl(''), '')
  })

  it('validates noRemote flag on GitActionResult when remotes list is empty', () => {
    const errorResult = {
      ok: false,
      noRemote: true,
      error: 'Dự án chưa cấu hình remote repository (GitHub).',
    }

    assert.equal(errorResult.ok, false)
    assert.equal(errorResult.noRemote, true)
    assert.ok(errorResult.error.includes('chưa cấu hình remote repository'))
  })
})
