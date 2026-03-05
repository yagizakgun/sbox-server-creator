import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Typed API exposed to renderer via contextBridge
const api = {
  // SteamCMD
  steamcmd: {
    getDefaultDir: (): Promise<string> => ipcRenderer.invoke('steamcmd:getDefaultDir'),
    getSavedPath: (): Promise<string> => ipcRenderer.invoke('steamcmd:getSavedPath'),
    checkInstalled: (dir: string): Promise<boolean> =>
      ipcRenderer.invoke('steamcmd:checkInstalled', dir),
    isSetupComplete: (): Promise<boolean> => ipcRenderer.invoke('steamcmd:isSetupComplete'),
    install: (dir: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('steamcmd:install', dir),
    updateServer: (
      installPath: string
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('steamcmd:updateServer', installPath),
    browsePath: (): Promise<string | null> => ipcRenderer.invoke('steamcmd:browsePath'),
    onInstallProgress: (cb: (data: { percent: number; message: string }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, d: { percent: number; message: string }) =>
        cb(d)
      ipcRenderer.on('steamcmd:install:progress', handler)
      return () => ipcRenderer.removeListener('steamcmd:install:progress', handler)
    },
    onUpdateProgress: (cb: (data: { percent: number; message: string }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, d: { percent: number; message: string }) =>
        cb(d)
      ipcRenderer.on('steamcmd:update:progress', handler)
      return () => ipcRenderer.removeListener('steamcmd:update:progress', handler)
    }
  },

  // Server management
  server: {
    list: () => ipcRenderer.invoke('server:list'),
    create: (config: Omit<import('../main/types').ServerConfig, 'id'>) =>
      ipcRenderer.invoke('server:create', config),
    update: (config: import('../main/types').ServerConfig) =>
      ipcRenderer.invoke('server:update', config),
    delete: (id: string) => ipcRenderer.invoke('server:delete', id),
    start: (id: string) => ipcRenderer.invoke('server:start', id),
    stop: (id: string) => ipcRenderer.invoke('server:stop', id),
    restart: (id: string) => ipcRenderer.invoke('server:restart', id),
    getStatus: (id: string) => ipcRenderer.invoke('server:status', id),
    getAllStatuses: () => ipcRenderer.invoke('server:allStatuses'),
    onStatusUpdate: (cb: (status: import('../main/types').ServerStatus) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, s: import('../main/types').ServerStatus) =>
        cb(s)
      ipcRenderer.on('server:status:update', handler)
      return () => ipcRenderer.removeListener('server:status:update', handler)
    },
    onLog: (cb: (data: { id: string; line: string }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, d: { id: string; line: string }) => cb(d)
      ipcRenderer.on('server:log', handler)
      return () => ipcRenderer.removeListener('server:log', handler)
    },
    getLogs: (id: string): Promise<string[]> => ipcRenderer.invoke('server:getLogs', id),
    clearLogs: (id: string): Promise<boolean> => ipcRenderer.invoke('server:clearLogs', id),
    sendCommand: (id: string, command: string): Promise<boolean> =>
      ipcRenderer.invoke('server:sendCommand', id, command)
  },

  // Config / permissions
  config: {
    readPermissions: (serverPath: string) =>
      ipcRenderer.invoke('config:readPermissions', serverPath),
    writePermissions: (serverPath: string, data: unknown) =>
      ipcRenderer.invoke('config:writePermissions', serverPath, data),
    browseSbproj: (): Promise<string | null> => ipcRenderer.invoke('config:browseSbproj')
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}

