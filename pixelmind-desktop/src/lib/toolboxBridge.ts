/* ══════════════════════════════════════════════════════════════
   Cầu nối Hộp công cụ ↔ Canvas
   - Giữ mục đang được kéo (vì iframe khác origin không đọc được dataTransfer)
   - Phát yêu cầu chèn khi người dùng bấm "Chèn" hoặc thả vào canvas
   ══════════════════════════════════════════════════════════════ */

export interface ToolboxDragItem {
  id: string
  name: string
  html: string
  css?: string
  source: 'builtin' | 'part' | 'project'
}

export type InsertPlacement = 'auto' | 'before' | 'after' | 'inside'

export interface ToolboxInsertRequest {
  item: ToolboxDragItem
  /** uid phần tử đích trong iframe (nếu thả vào canvas) */
  targetUid?: string
  placement?: InsertPlacement
}

let draggingItem: ToolboxDragItem | null = null

export const toolboxDrag = {
  start(item: ToolboxDragItem) {
    draggingItem = item
  },
  end() {
    draggingItem = null
  },
  current(): ToolboxDragItem | null {
    return draggingItem
  },
}

type InsertListener = (request: ToolboxInsertRequest) => void
const insertListeners = new Set<InsertListener>()
let pendingInsert: ToolboxInsertRequest | null = null

export function requestToolboxInsert(request: ToolboxInsertRequest) {
  if (insertListeners.size === 0) {
    // Canvas chưa mở (đang ở tab mã nguồn): giữ lại để dùng khi canvas xuất hiện.
    pendingInsert = request
    return
  }
  insertListeners.forEach((listener) => listener(request))
}

/** Lấy và xoá yêu cầu chèn còn chờ (dùng khi Canvas vừa được mở). */
export function takePendingToolboxInsert(): ToolboxInsertRequest | null {
  const request = pendingInsert
  pendingInsert = null
  return request
}

export function onToolboxInsert(listener: InsertListener) {
  insertListeners.add(listener)
  return () => {
    insertListeners.delete(listener)
  }
}
