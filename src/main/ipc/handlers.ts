import { ipcMain, dialog } from 'electron'
import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  isSteamcmdInstalled,
  installSteamcmd,
  installSboxServer,
  getDefaultSteamcmdDir
} from '../steamcmd'
import {
  getServers,
  saveServer,
  deleteServer,
  getSteamcmdPath,
  setSteamcmdPath,
  isSetupComplete,
  setSetupComplete
} from '../serverStore'
import { serverManager } from '../serverInstance'
import type { ServerConfig } from '../types'

export function registerSteamcmdIpc(): void {
  ipcMain.handle('steamcmd:getDefaultDir', () => getDefaultSteamcmdDir())

  ipcMain.handle('steamcmd:getSavedPath', () => getSteamcmdPath())

  ipcMain.handle('steamcmd:checkInstalled', (_e, dir: string) => {
    return isSteamcmdInstalled(dir)
  })

  ipcMain.handle('steamcmd:isSetupComplete', () => isSetupComplete())

  ipcMain.handle('steamcmd:install', async (event, dir: string) => {
    try {
      await installSteamcmd(dir, (pct, msg) => {
        event.sender.send('steamcmd:install:progress', { percent: pct, message: msg })
      })
      setSteamcmdPath(dir)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('steamcmd:updateServer', async (event, installPath: string) => {
    const steamcmdDir = getSteamcmdPath()
    try {
      await installSboxServer(steamcmdDir, installPath, (pct, msg) => {
        event.sender.send('steamcmd:update:progress', { percent: pct, message: msg })
      })
      setSetupComplete(true)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('steamcmd:browsePath', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })
}

export function registerServerIpc(): void {
  ipcMain.handle('server:list', () => getServers())

  ipcMain.handle('server:create', (_e, config: Omit<ServerConfig, 'id'>) => {
    const full: ServerConfig = { id: randomUUID(), ...config }
    saveServer(full)
    return full
  })

  ipcMain.handle('server:update', (_e, config: ServerConfig) => {
    saveServer(config)
    return config
  })

  ipcMain.handle('server:delete', (_e, id: string) => {
    serverManager.stop(id)
    deleteServer(id)
    return true
  })

  ipcMain.handle('server:start', (_e, id: string) => {
    const servers = getServers()
    const config = servers.find((s) => s.id === id)
    if (!config) return { success: false, error: 'Server not found' }
    try {
      serverManager.start(config)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('server:stop', (_e, id: string) => {
    serverManager.stop(id)
    return { success: true }
  })

  ipcMain.handle('server:restart', (_e, id: string) => {
    const servers = getServers()
    const config = servers.find((s) => s.id === id)
    if (!config) return { success: false, error: 'Server not found' }
    serverManager.restart(config)
    return { success: true }
  })

  ipcMain.handle('server:status', (_e, id: string) => {
    return serverManager.getStatus(id)
  })

  ipcMain.handle('server:allStatuses', () => {
    return serverManager.getAllStatuses()
  })

  ipcMain.handle('server:getLogs', (_e, id: string) => {
    return serverManager.getLogs(id)
  })

  ipcMain.handle('server:clearLogs', (_e, id: string) => {
    serverManager.clearLogs(id)
    return true
  })

  ipcMain.handle('server:sendCommand', (_e, id: string, command: string) => {
    return serverManager.sendCommand(id, command)
  })

  ipcMain.handle('server:getStats', (_e, id: string) => {
    return serverManager.getStats(id)
  })
}

export function registerConfigIpc(): void {
  ipcMain.handle('config:readPermissions', (_e, serverPath: string) => {
    const filePath = join(serverPath, 'users', 'config.json')
    if (!existsSync(filePath)) {
      return []
    }
    try {
      return JSON.parse(readFileSync(filePath, 'utf-8'))
    } catch {
      return []
    }
  })

  ipcMain.handle('config:writePermissions', (_e, serverPath: string, data: unknown) => {
    const usersDir = join(serverPath, 'users')
    if (!existsSync(usersDir)) {
      mkdirSync(usersDir, { recursive: true })
    }
    const filePath = join(usersDir, 'config.json')
    writeFileSync(filePath, JSON.stringify(data, null, '\t'), 'utf-8')
    return true
  })

  ipcMain.handle('config:browseSbproj', async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'sbox Project', extensions: ['sbproj'] }],
      properties: ['openFile']
    })
    return result.canceled ? null : result.filePaths[0]
  })
}
