export interface CanvasSettings {
  smartGuides: boolean
  hoverOutline: boolean
  syncCanvasToTree: boolean
  styleSync: 'auto' | 'inline' | 'tailwind'
}

export function toWorkspaceCanvasSettings(
  settings: Partial<CanvasSettings> & { canvasStyleSync?: 'auto' | 'inline' | 'tailwind' },
): CanvasSettings {
  const mode = settings.styleSync ?? settings.canvasStyleSync
  return {
    smartGuides: settings.smartGuides !== false,
    hoverOutline: settings.hoverOutline !== false,
    syncCanvasToTree: settings.syncCanvasToTree !== false,
    styleSync: mode === 'inline' || mode === 'tailwind' ? mode : 'auto',
  }
}
