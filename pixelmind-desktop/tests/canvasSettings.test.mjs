import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { toWorkspaceCanvasSettings } from '../src/lib/canvasSettings.ts'

describe('toWorkspaceCanvasSettings', () => {
  it('defaults unspecified options to enabled', () => {
    assert.deepEqual(toWorkspaceCanvasSettings({}), {
      smartGuides: true,
      hoverOutline: true,
      syncCanvasToTree: true,
      styleSync: 'auto',
    })
  })

  it('passes disabled options through to the Canvas integration unchanged', () => {
    assert.deepEqual(
      toWorkspaceCanvasSettings({
        smartGuides: false,
        hoverOutline: false,
        syncCanvasToTree: false,
      }),
      {
        smartGuides: false,
        hoverOutline: false,
        syncCanvasToTree: false,
        styleSync: 'auto',
      },
    )
  })

  it('maps changed settings to updated Canvas values', () => {
    const before = toWorkspaceCanvasSettings({
      smartGuides: true,
      hoverOutline: true,
      syncCanvasToTree: true,
    })
    const after = toWorkspaceCanvasSettings({
      smartGuides: false,
      hoverOutline: true,
      syncCanvasToTree: false,
    })

    assert.deepEqual(before, {
      smartGuides: true,
      hoverOutline: true,
      syncCanvasToTree: true,
      styleSync: 'auto',
    })
    assert.deepEqual(after, {
      smartGuides: false,
      hoverOutline: true,
      syncCanvasToTree: false,
      styleSync: 'auto',
    })
  })

  it('truyền chế độ sync style và mặc định auto', () => {
    assert.equal(toWorkspaceCanvasSettings({}).styleSync, 'auto')
    assert.equal(toWorkspaceCanvasSettings({ styleSync: 'tailwind' }).styleSync, 'tailwind')
    assert.equal(toWorkspaceCanvasSettings({ styleSync: 'inline' }).styleSync, 'inline')
    assert.equal(toWorkspaceCanvasSettings({ styleSync: 'bậy' }).styleSync, 'auto')
  })
})
