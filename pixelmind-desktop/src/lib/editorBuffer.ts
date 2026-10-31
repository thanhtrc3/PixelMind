import { api } from './bridge'

export type ActionType = 'MOVE' | 'RESIZE' | 'TEXT' | 'STYLE' | 'LAYOUT'

export interface ElementSnapshot {
  styles: Record<string, string>
  text?: string
  rect?: { top: number; left: number; width: number; height: number }
}

export interface HistoryAction {
  id: string
  type: ActionType
  description: string
  timestamp: number
  target: {
    tagName: string
    id?: string
    className?: string
    domPath?: string
    uid?: string
    selector?: string
    textSnippet?: string
  }
  sourceLoc?: {
    filePath: string
    fullPath: string
    lineNumber: number
  }
  before: ElementSnapshot
  after: ElementSnapshot
  deltaStyles?: Record<string, string>
}

export interface DirtyFileInfo {
  filePath: string
  fullPath: string
  lineNumber?: number
  tagName?: string
  oldText?: string
  newText?: string
  styles: Record<string, string>
}

type BufferListener = () => void
type UndoRedoHandler = (action: HistoryAction, isUndo: boolean) => void

class EditorBufferManager {
  private undoStack: HistoryAction[] = []
  private redoStack: HistoryAction[] = []
  private dirtyFiles = new Map<string, DirtyFileInfo>()
  private listeners: Set<BufferListener> = new Set()
  private undoRedoHandlers: Set<UndoRedoHandler> = new Set()

  subscribe(listener: BufferListener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  onApplyHistory(handler: UndoRedoHandler) {
    this.undoRedoHandlers.add(handler)
    return () => {
      this.undoRedoHandlers.delete(handler)
    }
  }

  private notify() {
    this.listeners.forEach((fn) => fn())
  }

  private rebuildDirtyFiles() {
    this.dirtyFiles.clear()
    for (const act of this.undoStack) {
      if (!act.sourceLoc) continue
      const existing = this.dirtyFiles.get(act.sourceLoc.filePath) || {
        filePath: act.sourceLoc.filePath,
        fullPath: act.sourceLoc.fullPath,
        lineNumber: act.sourceLoc.lineNumber,
        tagName: act.target.tagName,
        oldText: act.before.text,
        styles: {},
      }

      const deltaStyles: Record<string, string> = act.deltaStyles ? { ...act.deltaStyles } : {}
      if (!act.deltaStyles && act.after.styles && act.before.styles) {
        for (const [k, v] of Object.entries(act.after.styles)) {
          if (act.before.styles[k] !== v) {
            deltaStyles[k] = v
          }
        }
      }

      this.dirtyFiles.set(act.sourceLoc.filePath, {
        ...existing,
        newText: act.after.text ?? existing.newText,
        styles: {
          ...existing.styles,
          ...deltaStyles,
        },
      })
    }
  }

  // ─── ĐĂNG KÝ HÀNH ĐỘNG VÀO NGĂN XẾP LỊCH SỬ ───
  pushAction(action: Omit<HistoryAction, 'id' | 'timestamp'>) {
    const fullAction: HistoryAction = {
      ...action,
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    }

    this.undoStack.push(fullAction)
    if (this.undoStack.length > 50) {
      this.undoStack.shift()
    }
    // Khi có thao tác mới, dọn sạch redo stack
    this.redoStack = []

    this.rebuildDirtyFiles()
    this.notify()
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  getUndoDescription(): string {
    const last = this.undoStack[this.undoStack.length - 1]
    return last ? `Hoàn tác: ${last.description} (Ctrl+Z)` : 'Hoàn tác (Ctrl+Z)'
  }

  getRedoDescription(): string {
    const last = this.redoStack[this.redoStack.length - 1]
    return last ? `Làm lại: ${last.description} (Ctrl+Y)` : 'Làm lại (Ctrl+Y)'
  }

  // ─── HOÀN TÁC (UNDO - CTRL+Z) ───
  undo(): HistoryAction | null {
    const action = this.undoStack.pop()
    if (!action) return null

    this.redoStack.push(action)

    // Bắn thông điệp cho CanvasArea cập nhật lại DOM thật
    this.undoRedoHandlers.forEach((handler) => handler(action, true))

    // Tự động tái tính toán lại các thay đổi còn lại cho file mã nguồn
    this.rebuildDirtyFiles()
    this.notify()
    return action
  }

  // ─── LÀM LẠI (REDO - CTRL+Y) ───
  redo(): HistoryAction | null {
    const action = this.redoStack.pop()
    if (!action) return null

    this.undoStack.push(action)

    // Bắn thông điệp cho CanvasArea cập nhật lại DOM thật
    this.undoRedoHandlers.forEach((handler) => handler(action, false))

    // Tự động cập nhật lại các thay đổi cho file mã nguồn
    this.rebuildDirtyFiles()
    this.notify()
    return action
  }

  isDirty(filePath?: string): boolean {
    if (filePath) {
      return this.dirtyFiles.has(filePath)
    }
    return this.dirtyFiles.size > 0
  }

  getDirtyFileCount(): number {
    return this.dirtyFiles.size
  }

  getDirtyFiles(): DirtyFileInfo[] {
    return Array.from(this.dirtyFiles.values())
  }

  // ─── LƯU TOÀN BỘ FILE CHƯA LƯU XUỐNG Ổ CỨNG (CTRL+S HOẶC TRƯỚC KHI RUN F5) ───
  async saveAllDirtyFiles(showToast?: (msg: string) => void): Promise<boolean> {
    if (this.dirtyFiles.size === 0) return true

    let allOk = true
    const files = Array.from(this.dirtyFiles.values())

    for (const info of files) {
      try {
        const res = await api.inspect.syncCode({
          fullPath: info.fullPath,
          oldText: info.oldText,
          newText: info.newText,
          styles: info.styles,
          tagName: info.tagName,
          lineNumber: info.lineNumber,
        })

        if (res?.success) {
          this.dirtyFiles.delete(info.filePath)
          showToast?.(`💾 Đã lưu vĩnh viễn vào ${info.filePath}`)
        } else {
          allOk = false
          showToast?.(`Lỗi khi lưu ${info.filePath}: ${res?.error || 'Không xác định'}`)
        }
      } catch (err) {
        allOk = false
        showToast?.(`Lỗi khi lưu ${info.filePath}`)
      }
    }

    this.notify()
    return allOk
  }

  clearAll() {
    this.undoStack = []
    this.redoStack = []
    this.dirtyFiles.clear()
    this.notify()
  }
}

export const editorBuffer = new EditorBufferManager()

