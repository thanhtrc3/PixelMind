import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type {
  AppInfo,
  FileContent,
  FileNode,
  ProjectPage,
  ProjectRecord,
  ProjectStat,
  RunLog,
  RunState,
  Settings,
  StoreData,
} from '../../shared/types'
import type { PixelMindApi } from '../../shared/api'

/* Cầu nối duy nhất giữa renderer và main process. Renderer không có quyền Node. */

const api: PixelMindApi = {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),

  store: {
    get: (): Promise<StoreData> => ipcRenderer.invoke('store:get'),
    patch: (patch: Partial<StoreData>): Promise<StoreData> => ipcRenderer.invoke('store:patch', patch),
    updateSettings: (patch: Partial<Settings>): Promise<Settings> =>
      ipcRenderer.invoke('store:update-settings', patch),
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
    addPage: (projectId: string, page: Omit<ProjectPage, 'id'>): Promise<ProjectRecord | null> =>
      ipcRenderer.invoke('project:add-page', projectId, page),
    removePage: (projectId: string, pageId: string): Promise<ProjectRecord | null> =>
      ipcRenderer.invoke('project:remove-page', projectId, pageId),
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
  },

  run: {
    start: (projectId: string, script: string): Promise<RunState> =>
      ipcRenderer.invoke('run:start', projectId, script),
    startCommand: (projectId: string, command: string): Promise<RunState> =>
      ipcRenderer.invoke('run:start-command', projectId, command),
    stop: (runId: string): Promise<boolean> => ipcRenderer.invoke('run:stop', runId),
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
  },
}

export type PreloadApi = typeof api

contextBridge.exposeInMainWorld('pixelmind', api)
