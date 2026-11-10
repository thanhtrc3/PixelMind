import { contextBridge, ipcRenderer, webFrame } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type {
  AppInfo,
  DesignTokens,
  FileContent,
  FileNode,
  PageFilePreview,
  ProjectDiagnosis,
  ProjectPage,
  ProjectRecord,
  ProjectStat,
  RunLog,
  RunState,
  Settings,
  StoreData,
} from '../../shared/types'
import type { PixelMindApi } from '../../shared/api'
import type {
  MutationPreview,
  ProjectScanResult,
  ToolboxMutationPayload,
  ToolboxWritePayload,
  ToolboxWriteResult,
} from '../../shared/toolbox'
import type {
  AiBridgeKind,
  AiChatEvent,
  AiChatStartRequest,
  AiCliEvent,
  AiCliRunRequest,
  AiContextRequest,
  AiProposeChangeRequest,
  AiToolCallRequest,
} from '../../shared/ai'

/* Cß║ºu nß╗æi duy nhß║Ñt giß╗»a renderer v├á main process. Renderer kh├┤ng c├│ quyß╗ün Node. */

const api: PixelMindApi = {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),

  store: {
    get: (): Promise<StoreData> => ipcRenderer.invoke('store:get'),
    patch: (patch: Partial<StoreData>): Promise<StoreData> => ipcRenderer.invoke('store:patch', patch),
    updateSettings: (patch: Partial<Settings>): Promise<Settings> =>
      ipcRenderer.invoke('store:update-settings', patch),
    resetSettings: (): Promise<Settings> => ipcRenderer.invoke('store:reset-settings'),
    reset: (): Promise<StoreData> => ipcRenderer.invoke('store:reset'),
    path: (): Promise<string> => ipcRenderer.invoke('store:path'),
  },

  projects: {
    pickFolder: (): Promise<ProjectRecord | null> => ipcRenderer.invoke('project:pick'),
    add: (folder: string): Promise<ProjectRecord | null> => ipcRenderer.invoke('project:add', folder),
    list: (): Promise<ProjectRecord[]> => ipcRenderer.invoke('project:list'),
    open: (id: string): Promise<ProjectRecord | null> => ipcRenderer.invoke('project:open', id),
    remove: (id: string): Promise<ProjectRecord[]> => ipcRenderer.invoke('project:remove', id),
    favorite: (id: string): Promise<ProjectRecord[]> => ipcRenderer.invoke('project:favorite', id),
    refresh: (id: string): Promise<ProjectRecord | null> => ipcRenderer.invoke('project:refresh', id),
    addPage: (
      projectId: string,
      page: Omit<ProjectPage, 'id'>,
      options?: { createFile?: boolean },
    ): Promise<ProjectRecord | null> =>
      ipcRenderer.invoke('project:add-page', projectId, page, options),
    updatePage: (projectId: string, page: ProjectPage): Promise<ProjectRecord | null> =>
      ipcRenderer.invoke('project:update-page', projectId, page),
    removePage: (
      projectId: string,
      pageId: string,
      options?: { deleteFile?: boolean },
    ): Promise<ProjectRecord | null> =>
      ipcRenderer.invoke('project:remove-page', projectId, pageId, options),
    duplicatePage: (
      projectId: string,
      pageId: string,
      payload: { route: string; title: string; copyFile?: boolean },
    ): Promise<ProjectRecord | null> =>
      ipcRenderer.invoke('project:duplicate-page', projectId, pageId, payload),
    pageFilePreview: (projectId: string, route: string): Promise<PageFilePreview> =>
      ipcRenderer.invoke('project:page-file-preview', projectId, route),
    diagnose: (idOrPath: string): Promise<ProjectDiagnosis> =>
      ipcRenderer.invoke('project:diagnose', idOrPath),
    gitInit: (projectId: string): Promise<boolean> => ipcRenderer.invoke('project:git-init', projectId),
    createIndexHtml: (projectId: string): Promise<boolean> =>
      ipcRenderer.invoke('project:create-index-html', projectId),
    addDevScript: (projectId: string): Promise<boolean> =>
      ipcRenderer.invoke('project:add-dev-script', projectId),
    setCommand: (projectId: string, command: string): Promise<ProjectRecord | null> =>
      ipcRenderer.invoke('project:set-command', projectId, command),
  },

  fs: {
    tree: (root: string, showHidden = false): Promise<FileNode[]> =>
      ipcRenderer.invoke('fs:tree', root, showHidden),
    read: (path: string): Promise<FileContent> => ipcRenderer.invoke('fs:read', path),
    write: (path: string, text: string): Promise<boolean> => ipcRenderer.invoke('fs:write', path, text),
    stat: (root: string): Promise<ProjectStat> => ipcRenderer.invoke('fs:stat', root),
    git: (root: string): Promise<string | null> => ipcRenderer.invoke('fs:git', root),
    showInFolder: (path: string): Promise<void> => ipcRenderer.invoke('fs:show', path),
    openPath: (path: string): Promise<string | null> => ipcRenderer.invoke('fs:open', path),
    exists: (path: string): Promise<boolean> => ipcRenderer.invoke('fs:exists', path),
    special: (kind: 'userData' | 'home' | 'documents' | 'desktop'): Promise<string> =>
      ipcRenderer.invoke('fs:special', kind),
    createFile: (path: string, initialContent = ''): Promise<boolean> =>
      ipcRenderer.invoke('fs:create-file', path, initialContent),
    createDir: (path: string): Promise<boolean> => ipcRenderer.invoke('fs:create-dir', path),
    rename: (oldPath: string, newPath: string): Promise<boolean> =>
      ipcRenderer.invoke('fs:rename', oldPath, newPath),
    trash: (path: string): Promise<boolean> => ipcRenderer.invoke('fs:trash', path),
  },

  assets: {
    add: (
      projectPath: string,
    ): Promise<{
      canceled: boolean
      added: Array<{ source: string; destination: string; copied: boolean }>
      error?: string
    }> => ipcRenderer.invoke('assets:add', projectPath),
    remove: (
      path: string,
    ): Promise<{ success: boolean; backupPath?: string; error?: string }> =>
      ipcRenderer.invoke('assets:remove', path),
    restore: (
      backupPath: string,
      destination: string,
    ): Promise<{ success: boolean; path?: string; error?: string }> =>
      ipcRenderer.invoke('assets:restore', backupPath, destination),
  },

  run: {
    start: (projectId: string, script: string): Promise<RunState> =>
      ipcRenderer.invoke('run:start', projectId, script),
    install: (projectId: string): Promise<RunState> => ipcRenderer.invoke('run:install', projectId),
    startCommand: (projectId: string, command: string): Promise<RunState> =>
      ipcRenderer.invoke('run:start-command', projectId, command),
    stop: (runId: string): Promise<boolean> => ipcRenderer.invoke('run:stop', runId),
    stopOfProject: (projectId: string): Promise<boolean> => ipcRenderer.invoke('run:stop-project', projectId),
    stopAll: (): Promise<boolean> => ipcRenderer.invoke('run:stop-all'),
    list: (): Promise<RunState[]> => ipcRenderer.invoke('run:list'),
    ofProject: (projectId: string): Promise<RunState | null> => ipcRenderer.invoke('run:project', projectId),
    onLog: (cb: (log: RunLog) => void) => {
      const listener = (_e: IpcRendererEvent, log: RunLog) => cb(log)
      ipcRenderer.on('run:log', listener)
      return () => ipcRenderer.removeListener('run:log', listener)
    },
    onState: (cb: (state: RunState) => void) => {
      const listener = (_e: IpcRendererEvent, state: RunState) => cb(state)
      ipcRenderer.on('run:state', listener)
      return () => ipcRenderer.removeListener('run:state', listener)
    },
  },

  system: {
    openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke('shell:external', url),
    onMenuAction: (cb: (action: string) => void) => {
      const listener = (_e: IpcRendererEvent, action: string) => cb(action)
      ipcRenderer.on('menu:action', listener)
      return () => ipcRenderer.removeListener('menu:action', listener)
    },
    popupMenu: (menuIndex: number, x: number, y: number): Promise<boolean> =>
      ipcRenderer.invoke('menu:popup', { menuIndex, x, y }),
    clearCache: (): Promise<boolean> => ipcRenderer.invoke('system:clear-cache'),
  },

  inspect: {
    setMode: (enabled: boolean): Promise<boolean> => ipcRenderer.invoke('inspect:set-mode', enabled),
    applyStyle: (payload: { styles?: Record<string, string>; textContent?: string }): Promise<boolean> =>
      ipcRenderer.invoke('inspect:apply-style', payload),
    resetOriginal: (): Promise<boolean> => ipcRenderer.invoke('inspect:reset-original'),
    locateSource: (payload: {
      projectPath: string
      textSnippet?: string
      tagName?: string
      className?: string
      currentPath?: string
      id?: string
      selector?: string
    }) => ipcRenderer.invoke('inspect:locate-source', payload),
    syncCode: (payload: {
      fullPath: string
      oldText?: string
      newText?: string
      styles?: Record<string, string>
      tagName?: string
      lineNumber?: number
    }) => ipcRenderer.invoke('inspect:sync-code', payload),
    syncNav: (payload: {
      projectPath: string
      currentPath?: string
      targetRoute: string
      action: 'link' | 'unlink'
      textSnippet?: string
      tagName?: string
      className?: string
      id?: string
    }) => ipcRenderer.invoke('inspect:sync-nav', payload),
  },
  tokens: {
    get: (projectPath: string) => ipcRenderer.invoke('tokens:get', projectPath),
    save: (payload: { projectPath: string; tokens: DesignTokens; syncTarget?: 'css' | 'tailwind' | 'both' }) =>
      ipcRenderer.invoke('tokens:save', payload),
  },
  toolbox: {
    mutate: (payload: ToolboxMutationPayload): Promise<MutationPreview> =>
      ipcRenderer.invoke('toolbox:mutate', payload),
    writeFile: (payload: ToolboxWritePayload): Promise<ToolboxWriteResult> =>
      ipcRenderer.invoke('toolbox:write-file', payload),
    scan: (projectPath: string): Promise<ProjectScanResult> =>
      ipcRenderer.invoke('toolbox:scan', projectPath),
  },
  ai: {
    status: (projectPath?: string) => ipcRenderer.invoke('ai:status', projectPath),
    models: (projectPath?: string) => ipcRenderer.invoke('ai:models', projectPath),
    test: (projectPath?: string) => ipcRenderer.invoke('ai:test', projectPath),
    chat: (request: AiChatStartRequest) => ipcRenderer.invoke('ai:chat:start', request),
    complete: (payload: { prompt: string; system?: string; projectPath?: string }) =>
      ipcRenderer.invoke('ai:complete', payload),
    cancel: (id: string) => ipcRenderer.invoke('ai:cancel', id),
    onChatEvent: (cb: (event: AiChatEvent) => void) => {
      const listener = (_e: IpcRendererEvent, event: AiChatEvent) => cb(event)
      ipcRenderer.on('ai:chat:event', listener)
      return () => ipcRenderer.removeListener('ai:chat:event', listener)
    },
    chats: {
      history: (projectId: string) => ipcRenderer.invoke('ai:chats:history', projectId),
      clear: (projectId: string) => ipcRenderer.invoke('ai:chats:clear', projectId),
    },
    context: (request: AiContextRequest) => ipcRenderer.invoke('ai:context', request),
    changes: {
      list: (projectId: string) => ipcRenderer.invoke('ai:changes:list', projectId),
      propose: (request: AiProposeChangeRequest) => ipcRenderer.invoke('ai:changes:propose', request),
      accept: (projectId: string, changeId: string) =>
        ipcRenderer.invoke('ai:changes:accept', projectId, changeId),
      reject: (projectId: string, changeId: string) =>
        ipcRenderer.invoke('ai:changes:reject', projectId, changeId),
      undo: (projectId: string, changeId: string) =>
        ipcRenderer.invoke('ai:changes:undo', projectId, changeId),
    },
    tools: {
      list: () => ipcRenderer.invoke('ai:tools:list'),
      run: (request: AiToolCallRequest) => ipcRenderer.invoke('ai:tools:run', request),
      logs: (projectId?: string) => ipcRenderer.invoke('ai:tools:logs', projectId),
    },
    killSwitch: () => ipcRenderer.invoke('ai:kill-switch'),
    saveKey: (key: string, provider?: string) =>
      ipcRenderer.invoke('ai:key:save', key, provider),
    bridges: {
      getActive: () => ipcRenderer.invoke('ai:bridges:getActive'),
      setActive: (kind: AiBridgeKind) => ipcRenderer.invoke('ai:bridges:setActive', kind),
      list: (projectPath?: string) => ipcRenderer.invoke('ai:bridges:list', projectPath),
      ping: (kind: AiBridgeKind, projectPath?: string) =>
        ipcRenderer.invoke('ai:bridges:ping', kind, projectPath),
    },
    audit: {
      list: (projectId?: string) => ipcRenderer.invoke('ai:audit:list', projectId),
      clear: (projectId?: string) => ipcRenderer.invoke('ai:audit:clear', projectId),
    },
    cost: {
      get: (projectId?: string) => ipcRenderer.invoke('ai:cost:get', projectId),
      setBudget: (projectId: string, budgetTokens: number) =>
        ipcRenderer.invoke('ai:cost:setBudget', projectId, budgetTokens),
      reset: (projectId?: string) => ipcRenderer.invoke('ai:cost:reset', projectId),
    },
    cli: {
      run: (request: AiCliRunRequest) => ipcRenderer.invoke('ai:cli:run', request),
      stop: (id: string) => ipcRenderer.invoke('ai:cli:stop', id),
      detect: () => ipcRenderer.invoke('ai:cli:detect'),
      onEvent: (cb: (event: AiCliEvent) => void) => {
        const listener = (_e: IpcRendererEvent, event: AiCliEvent) => cb(event)
        ipcRenderer.on('ai:cli:event', listener)
        return () => ipcRenderer.removeListener('ai:cli:event', listener)
      },
    },
    ws: {
      send: (message: unknown) => ipcRenderer.invoke('ai:ws:send', message),
      status: () => ipcRenderer.invoke('ai:ws:status'),
    },
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    setZoomFactor: (factor: number) => webFrame.setZoomFactor(factor),
    getZoomFactor: () => webFrame.getZoomFactor(),
  },
}

export type PreloadApi = typeof api

contextBridge.exposeInMainWorld('pixelmind', api)
