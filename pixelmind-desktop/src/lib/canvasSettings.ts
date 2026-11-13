export interface CanvasSettings {
  smartGuides: boolean
  hoverOutline: boolean
  syncCanvasToTree: boolean
}

export function toWorkspaceCanvasSettings(
  settings: Partial<CanvasSettings>,
): CanvasSettings {
  return {
    smartGuides: settings.smartGuides !== false,
    hoverOutline: settings.hoverOutline !== false,
    syncCanvasToTree: settings.syncCanvasToTree !== false,
  }
}
