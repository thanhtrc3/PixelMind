/* ══════════════════════════════════════════════════════════════
   Cầu nối Hộp công cụ ↔ Canvas
   - Giữ mục đang được kéo (vì iframe khác origin không đọc được dataTransfer)
   - Phát yêu cầu chèn khi người dùng bấm "Chèn" hoặc thả vào canvas
   ══════════════════════════════════════════════════════════════ */

import type { ProjectPage } from '../../shared/types'
import type { PartPropDef, PartVariant } from '../../shared/toolbox.ts'
import { resolvePartVariant } from '../../shared/toolbox.ts'

const normalizeRoute = (value: string) => (value.split('?')[0].replace(/\/+$/, '') || '/').toLowerCase()

/**
 * Tệp nguồn của trang đang mở. Trang vừa tạo không có phần tử nào để dò,
 * nếu không có tệp này bộ dò sẽ rơi về trang chủ và part bị ghi nhầm trang.
 */
export function pageFileForRoute(
  pages: ProjectPage[] | undefined,
  route: string | null | undefined,
): string {
  const wanted = normalizeRoute(route || '/')
  const page = pages?.find((item) => item.filePath && normalizeRoute(item.route) === wanted)
  return page?.filePath || ''
}

/**
 * Dựng item chèn từ Part, đã thay placeholder theo biến thể đang chọn.
 * Dùng chung cho nút Chèn, kéo-thả và Sao chép mã để đầu ra luôn khớp nhau.
 */
export function buildPartInsertItem(
  part: { id: string; name: string; html: string; css?: string; js?: string; props?: PartPropDef[]; variants?: PartVariant[] },
  variantId?: string | null,
): ToolboxDragItem {
  const resolved = resolvePartVariant(part, variantId)
  return {
    id: `part:${part.id}`,
    name: part.name,
    html: resolved.html,
    css: resolved.css || undefined,
    js: resolved.js || undefined,
    source: 'part',
  }
}

export interface ToolboxDragItem {
  id: string
  name: string
  html: string
  css?: string
  js?: string
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
