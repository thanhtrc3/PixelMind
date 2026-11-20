import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  parseWorkspaceTabs,
  restoreWorkspaceTabs,
  serializeWorkspaceTabs,
} from '../src/lib/workspaceTabs.ts'

describe('serializeWorkspaceTabs', () => {
  it('saves tab order and the selected tab for the current view', () => {
    assert.deepEqual(
      JSON.parse(serializeWorkspaceTabs(['one.ts', 'two.ts'], 'two.ts', 'file')),
      {
        paths: ['one.ts', 'two.ts'],
        selectedPath: 'two.ts',
        activeTab: 'file',
      },
    )
  })

  it('does not save a selected path that is not an open tab', () => {
    assert.deepEqual(
      JSON.parse(serializeWorkspaceTabs(['one.ts'], 'missing.ts', 'preview')),
      {
        paths: ['one.ts'],
        selectedPath: null,
        activeTab: 'preview',
      },
    )
  })
})

describe('parseWorkspaceTabs', () => {
  it('uses safe defaults for missing or malformed saved data', () => {
    assert.deepEqual(parseWorkspaceTabs(null), {
      paths: [],
      selectedPath: null,
      activeTab: 'preview',
    })
    assert.deepEqual(parseWorkspaceTabs('{'), {
      paths: [],
      selectedPath: null,
      activeTab: 'preview',
    })
  })

  it('deduplicates file paths and only restores a selected path from the saved tabs', () => {
    assert.deepEqual(
      parseWorkspaceTabs(
        JSON.stringify({
          paths: ['one.ts', 'two.ts', 'one.ts', null, ''],
          selectedPath: 'missing.ts',
          activeTab: 'file',
        }),
      ),
      {
        paths: ['one.ts', 'two.ts'],
        selectedPath: null,
        activeTab: 'file',
      },
    )
  })
})

describe('restoreWorkspaceTabs', () => {
  const saved = {
    paths: ['one.ts', 'two.ts', 'three.ts'],
    selectedPath: 'two.ts',
    activeTab: 'file',
  }

  it('restores valid tabs in order and reads the selected file', async () => {
    const restored = await restoreWorkspaceTabs(saved, {
      exists: async () => true,
      read: async (path) => `content:${path}`,
    })

    assert.deepEqual(restored, {
      paths: saved.paths,
      selectedPath: 'two.ts',
      file: 'content:two.ts',
      activeTab: 'file',
      inaccessibleCount: 0,
    })
  })

  it('drops removed files and selects the last remaining tab when the selected one is gone', async () => {
    const restored = await restoreWorkspaceTabs(saved, {
      exists: async (path) => path !== 'two.ts',
      read: async (path) => `content:${path}`,
    })

    assert.deepEqual(restored, {
      paths: ['one.ts', 'three.ts'],
      selectedPath: 'three.ts',
      file: 'content:three.ts',
      activeTab: 'file',
      inaccessibleCount: 1,
    })
  })

  it('falls back when the selected file exists but cannot be read', async () => {
    const restored = await restoreWorkspaceTabs(saved, {
      exists: async () => true,
      read: async (path) => {
        if (path === 'two.ts') throw new Error('access denied')
        return `content:${path}`
      },
    })

    assert.deepEqual(restored, {
      paths: ['one.ts', 'three.ts'],
      selectedPath: 'three.ts',
      file: 'content:three.ts',
      activeTab: 'file',
      inaccessibleCount: 1,
    })
  })
})
