import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { createWriteStream } from 'fs'
import { spawn } from 'child_process'
import * as readline from 'readline'
import AdmZip from 'adm-zip'
import https from 'https'
import http from 'http'

const STEAMCMD_ZIP_URL = 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip'
const SBOX_APP_ID = '1892930'

export function getDefaultSteamcmdDir(): string {
  return join(app.getPath('userData'), 'steamcmd')
}

export function getSteamcmdExe(dir: string): string {
  return join(dir, 'steamcmd.exe')
}

export function isSteamcmdInstalled(dir: string): boolean {
  return existsSync(getSteamcmdExe(dir))
}

/**
 * Downloads and extracts SteamCMD to the given directory.
 * Emits progress via onProgress callback (0-1).
 */
export async function installSteamcmd(
  dir: string,
  onProgress: (p: number, msg: string) => void
): Promise<void> {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const zipPath = join(dir, 'steamcmd.zip')

  onProgress(0, 'Downloading SteamCMD...')
  await downloadFile(STEAMCMD_ZIP_URL, zipPath, (pct) => {
    onProgress(pct * 0.7, `Downloading SteamCMD... ${Math.round(pct * 100)}%`)
  })

  onProgress(0.7, 'Extracting SteamCMD...')
  const zip = new AdmZip(zipPath)
  zip.extractAllTo(dir, true)

  onProgress(0.8, 'Running initial SteamCMD setup...')
  await runSteamcmd(dir, ['+quit'], (line) => {
    onProgress(0.85, line)
  })

  onProgress(1, 'SteamCMD ready.')
}

function downloadFile(
  url: string,
  dest: string,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest)
    const get = url.startsWith('https') ? https.get : http.get
    const req = get(url, (res) => {
      // Follow redirects — wait for file.close() before reopening the same path on Windows
      if (res.statusCode === 301 || res.statusCode === 302) {
        res.resume()
        file.close(() => {
          downloadFile(res.headers.location!, dest, onProgress).then(resolve, reject)
        })
        return
      }
      if (res.statusCode !== 200) {
        res.resume()
        file.close()
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
      const total = parseInt(res.headers['content-length'] || '0', 10)
      let received = 0
      res.on('data', (chunk: Buffer) => {
        received += chunk.length
        if (total > 0) onProgress(received / total)
      })
      // Handle response stream errors — without this the promise hangs forever
      // if the server drops the connection mid-download
      res.on('error', (err) => {
        file.destroy()
        reject(err)
      })
      res.pipe(file)
      file.on('finish', () => file.close(() => resolve()))
      file.on('error', (err) => {
        res.destroy()
        reject(err)
      })
    })
    req.on('error', reject)
  })
}

/**
 * Runs SteamCMD with the given args and streams stdout line by line.
 */
export function runSteamcmd(
  dir: string,
  args: string[],
  onLine: (line: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const exe = getSteamcmdExe(dir)
    const proc = spawn(exe, args, { cwd: dir, windowsHide: true })

    const rl = readline.createInterface({ input: proc.stdout, crlfDelay: Infinity })
    rl.on('line', (line) => onLine(line))

    const errl = readline.createInterface({ input: proc.stderr, crlfDelay: Infinity })
    errl.on('line', (line) => onLine(`[stderr] ${line}`))

    // Use 'exit' instead of 'close' so the promise resolves as soon as the
    // main steamcmd.exe process exits, without waiting for inherited stdio
    // handles held open by child processes spawned during self-update.
    proc.on('exit', (code) => {
      // SteamCMD often exits with non-zero on first run (auto-update), treat as ok.
      // null means the process was killed/restarted by its own bootstrap updater.
      if (code === 0 || code === 7 || code === null) {
        resolve()
      } else {
        reject(new Error(`SteamCMD exited with code ${code}`))
      }
    })
    proc.on('error', reject)
  })
}

/**
 * Installs or updates the sbox dedicated server.
 */
export async function installSboxServer(
  steamcmdDir: string,
  installPath: string,
  onProgress: (p: number, msg: string) => void
): Promise<void> {
  if (!existsSync(installPath)) {
    mkdirSync(installPath, { recursive: true })
  }

  const args = [
    '+force_install_dir',
    installPath,
    '+login',
    'anonymous',
    '+app_update',
    SBOX_APP_ID,
    'validate',
    '+quit'
  ]

  const lines: string[] = []
  await runSteamcmd(steamcmdDir, args, (line) => {
    lines.push(line)
    // Try to parse "Update state ... downloading" lines for progress
    const match = line.match(/(\d+\.\d+)%/)
    const pct = match ? parseFloat(match[1]) / 100 : -1
    onProgress(pct >= 0 ? pct : 0.5, line)
  })

  onProgress(1, 'sbox server installation complete.')
}
