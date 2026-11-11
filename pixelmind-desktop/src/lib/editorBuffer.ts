import { api } from './bridge'

export type ActionType = 'MOVE' | 'RESIZE' | 'TEXT' | 'STYLE' | 'LAYOUT' | 'INSERT' | 'DELETE' | 'DUPLICATE' | 'ATTRS'

export interface ElementSnapshot {
  styles: Record<string, string>
  text?: string
  rect?: { top: number; left: number; width: number; height: number }
}

/** Thông tin phản chiếu thao tác DOM thật trong iframe khi Undo/Redo. */
export interface DomMutationRecord {
  kind: 'insert' | 'delete' | 'duplicate' | 'attributes' | 'delete-batch' | 'move'
  /** uid khung cha để chèn lại (Undo của DELETE hoặc MOVE) */
  parentUid?: string
  /** uid khung cha cũ (cho MOVE) */
  oldParentUid?: string
  /** uid phần tử đích (cho ATTRS hoặc MOVE) */
  targetUid?: string
  /** Vị trí chèn trong khung cha */
  index?: number
  /** Vị trí cũ trong khung cha cũ (cho MOVE) */
  oldIndex?: number
  /** HTML gốc để chèn lại */
  html?: string
  /** uid của (các) phần tử vừa tạo — dùng để xoá khi Undo */
  uids?: string[]
  /** Thuộc tính trước/sau cho ATTRS */
  attributesBefore?: Record<string, string | null>
  attributesAfter?: Record<string, string | null>
  textBefore?: string
  textAfter?: string
  /** Danh sách phần tử bị xoá trong một lần xoá nhiều (delete-batch). */
  records?: Array<{
    parentUid: string
    index: number
    html: string
    uid: string
  }>
}

/** Một tệp mã nguồn cần ghi lại when Undo/Redo một thao tác gộp nhiều phần tử. */
export interface FileEditRecord {
  filePath?: string
  fullPath: string
  lineNumber?: number
  /** Toàn bộ nội dung tệp trước khi thao tác. */
  before: string
  /** Toàn bộ nội dung tệp sau khi thao tác. */
  after: string
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
  /** Thao tác DOM mới của Hộp công cụ */
  dom?: DomMutationRecord
  /** Toàn bộ nội dung tệp trước/sau — dùng để Undo/Redo tức thì */
  fileBefore?: string
  fileAfter?: string
  /** Nhiều tệp cùng lúc (thao tác gộp: xoá/dán nhiều phần tử) */
  fileEdits?: FileEditRecord[]
  projectPath?: string
  /**
   * Thế hệ tài liệu (document epoch) tại thời điểm thao tác được ghi.
   * Khi iframe hot-reload/điều hướng, epoch đổi và DOM đã phản chiếu mã nguồn —
   * lúc đó không được chèn/xoá DOM thủ công nữa để tránh nhân đôi phần tử.
   */
  docEpoch?: number
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
  /** Thế hệ tài liệu hiện tại của canvas (tăng mỗi khi iframe tải lại). */
  private documentEpoch = 0
  private activeProjectPath: string | null = null
  private autoSaveEnabled = true
  private autoSaveDelayMs = 1500
  private autoSaveTimer: number | null = null
  private savingNow = false
  private lastSavedAt: number | null = null

  setProjectPath(projectPath: string | null) {
    this.activeProjectPath = projectPath
  }

  setAutoSave(enabled: boolean, delayMs?: number) {
    this.autoSaveEnabled = enabled
    if (typeof delayMs === 'number' && delayMs >= 300) {
      this.autoSaveDelayMs = delayMs
    }
    if (!enabled) {
      this.clearAutoSaveTimer()
    } else if (this.dirtyFiles.size > 0) {
      this.scheduleAutoSave()
    }
    this.notify()
  }

  isAutoSaveEnabled(): boolean {
    return this.autoSaveEnabled
  }

  isSaving(): boolean {
    return this.savingNow
  }

  getLastSavedAt(): number | null {
    return this.lastSavedAt
  }

  private clearAutoSaveTimer() {
    if (this.autoSaveTimer !== null) {
      window.clearTimeout(this.autoSaveTimer)
      this.autoSaveTimer = null
    }
  }

  private scheduleAutoSave() {
    this.clearAutoSaveTimer()
    if (!this.autoSaveEnabled || this.dirtyFiles.size === 0) return
    this.autoSaveTimer = window.setTimeout(() => {
      this.autoSaveTimer = null
      if (this.autoSaveEnabled && this.dirtyFiles.size > 0) {
        void this.saveAllDirtyFiles(undefined, 'auto-save')
      }
    }, this.autoSaveDelayMs)
  }

  /** Ép lưu ngay lập tức nếu đang bật Auto-Save và còn buffer chưa ghi (dùng khi rời trang). */
  async flushAutoSave(): Promise<boolean> {
    if (!this.autoSaveEnabled || this.dirtyFiles.size === 0) return true
    return this.saveAllDirtyFiles(undefined, 'auto-save')
  }

  setDocumentEpoch(epoch: number) {
    this.documentEpoch = epoch
  }

  getDocumentEpoch(): number {
    return this.documentEpoch
  }

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
      // Thao tác của Hộp công cụ ghi thẳng xuống tệp ngay khi áp dụng,
      // không đi qua cơ chế gom style rồi syncCode.
      if (act.dom) continue
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
      docEpoch: action.docEpoch ?? this.documentEpoch,
    }

    this.undoStack.push(fullAction)
    if (this.undoStack.length > 50) {
      this.undoStack.shift()
    }
    // Khi có thao tác mới, dọn sạch redo stack
    this.redoStack = []

    this.rebuildDirtyFiles()
    this.notify()
    this.scheduleAutoSave()
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

    // Ghi lại toàn bộ tệp trước thay đổi (thao tác Hộp công cụ)
    if (action.dom && action.fileEdits && action.fileEdits.length > 0) {
      for (const edit of action.fileEdits) {
        void api.toolbox
          .writeFile({
            projectPath: action.projectPath,
            fullPath: edit.fullPath,
            text: edit.before,
            backup: true,
          })
          .catch(() => {})
      }
    } else if (action.dom && action.sourceLoc && action.fileBefore !== undefined) {
      void api.toolbox
        .writeFile({
          projectPath: action.projectPath,
          fullPath: action.sourceLoc.fullPath,
          text: action.fileBefore,
          backup: true,
        })
        .catch(() => {})
    }

    // Bắn thông điệp cho CanvasArea cập nhật lại DOM thật
    this.undoRedoHandlers.forEach((handler) => handler(action, true))

    // Tự động tái tính toán lại các thay đổi còn lại cho file mã nguồn
    this.rebuildDirtyFiles()
    this.notify()
    this.scheduleAutoSave()
    return action
  }

  // ─── LÀM LẠI (REDO - CTRL+Y) ───
  redo(): HistoryAction | null {
    const action = this.redoStack.pop()
    if (!action) return null

    this.undoStack.push(action)

    // Ghi lại toàn bộ tệp sau thay đổi (thao tác Hộp công cụ)
    if (action.dom && action.fileEdits && action.fileEdits.length > 0) {
      for (const edit of action.fileEdits) {
        void api.toolbox
          .writeFile({
            projectPath: action.projectPath,
            fullPath: edit.fullPath,
            text: edit.after,
            backup: true,
          })
          .catch(() => {})
      }
    } else if (action.dom && action.sourceLoc && action.fileAfter !== undefined) {
      void api.toolbox
        .writeFile({
          projectPath: action.projectPath,
          fullPath: action.sourceLoc.fullPath,
          text: action.fileAfter,
          backup: true,
        })
        .catch(() => {})
    }

    // Bắn thông điệp cho CanvasArea cập nhật lại DOM thật
    this.undoRedoHandlers.forEach((handler) => handler(action, false))

    // Tự động cập nhật lại các thay đổi cho file mã nguồn
    this.rebuildDirtyFiles()
    this.notify()
    this.scheduleAutoSave()
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

  /** Lịch sử thao tác trong RAM, cũ → mới. */
  getUndoHistory(): HistoryAction[] {
    return [...this.undoStack]
  }

  /** Các thao tác đã hoàn tác, có thể làm lại. Phần tử cuối là thao tác kế tiếp. */
  getRedoHistory(): HistoryAction[] {
    return [...this.redoStack]
  }

  /**
   * Hoàn tác các thao tác mới hơn `actionId`, giữ nguyên trạng thái sau `actionId`.
   * Trả về số thao tác đã hoàn tác.
   */
  undoTo(actionId: string): number {
    const index = this.undoStack.findIndex((action) => action.id === actionId)
    if (index < 0) return 0

    let count = 0
    while (this.undoStack.length - 1 > index) {
      if (!this.undo()) break
      count += 1
    }
    return count
  }

  /**
   * Làm lại các thao tác cho tới khi `actionId` được áp dụng lại.
   * Trả về số thao tác đã làm lại.
   */
  redoTo(actionId: string): number {
    const index = this.redoStack.findIndex((action) => action.id === actionId)
    if (index < 0) return 0

    const count = this.redoStack.length - index
    let done = 0
    for (let step = 0; step < count; step += 1) {
      if (!this.redo()) break
      done += 1
    }
    return done
  }

  // ─── LƯU TOÀN BỘ FILE CHƯA LƯU XUỐNG Ổ CỨNG (CTRL+S HOẶC AUTO-SAVE / TRƯỚC KHI RUN F5) ───
  async saveAllDirtyFiles(
    showToast?: (msg: string) => void,
    reason: 'auto-save' | 'manual-save' = 'manual-save',
  ): Promise<boolean> {
    this.clearAutoSaveTimer()
    if (this.dirtyFiles.size === 0) return true
    if (this.savingNow) return true

    this.savingNow = true
    this.notify()

    let allOk = true
    const files = Array.from(this.dirtyFiles.values())

    try {
      for (const info of files) {
        try {
          const res = await api.inspect.syncCode({
            fullPath: info.fullPath,
            oldText: info.oldText,
            newText: info.newText,
            styles: info.styles,
            tagName: info.tagName,
            lineNumber: info.lineNumber,
            projectPath: this.activeProjectPath || undefined,
            backup: true,
            reason,
          })

          if (res?.success) {
            this.dirtyFiles.delete(info.filePath)
            showToast?.(`💾 Đã lưu vào ${info.filePath}`)
          } else {
            allOk = false
            showToast?.(`Lỗi khi lưu ${info.filePath}: ${res?.error || 'Không xác định'}`)
          }
        } catch {
          allOk = false
          showToast?.(`Lỗi khi lưu ${info.filePath}`)
        }
      }
      if (allOk) {
        this.lastSavedAt = Date.now()
      }
    } finally {
      this.savingNow = false
      this.notify()
    }

    return allOk
  }

  clearAll() {
    this.clearAutoSaveTimer()
    this.undoStack = []
    this.redoStack = []
    this.dirtyFiles.clear()
    this.notify()
  }
}

export const editorBuffer = new EditorBufferManager()

