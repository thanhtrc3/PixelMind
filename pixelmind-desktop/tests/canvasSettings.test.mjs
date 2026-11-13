import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { toWorkspaceCanvasSettings } from '../src/lib/canvasSettings.ts'

describe('toWorkspaceCanvasSettings', () => {
  it('defaults unspecified options to enabled', () => {
    assert.deepEqual(toWorkspaceCanvasSettings({}), {
      smartGuides: true,
      hoverOutline: true,
      syncCanvasToTree: true,
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
    })
    assert.deepEqual(after, {
      smartGuides: false,
      hoverOutline: true,
      syncCanvasToTree: false,
    })
  })
})
