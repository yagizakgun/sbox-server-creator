import { autoUpdater } from 'electron-updater'
import { BrowserWindow } from 'electron'
import log from 'electron-log'

export function setupAutoUpdater(win: BrowserWindow): void {
  autoUpdater.logger = log
  autoUpdater.autoDownload = false

  autoUpdater.on('update-available', (info) => {
    win.webContents.send('updater:update-available', info)
  })

  autoUpdater.on('update-not-available', () => {
    win.webContents.send('updater:up-to-date')
  })

  autoUpdater.on('download-progress', (progress) => {
    win.webContents.send('updater:progress', progress)
  })

  autoUpdater.on('update-downloaded', () => {
    win.webContents.send('updater:downloaded')
  })

  autoUpdater.on('error', (err) => {
    win.webContents.send('updater:error', err.message)
  })
}

export function checkForUpdates(): void {
  autoUpdater.checkForUpdates().catch(() => {
    // silently ignore in dev mode
  })
}

export function downloadUpdate(): void {
  autoUpdater.downloadUpdate()
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall()
}
