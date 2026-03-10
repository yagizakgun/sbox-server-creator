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
const DEFAULT_SBOX_APP_ID = '1892930'
const ERROR_LOG_TAIL_LINES = 30

export type SteamcmdInstallErrorCode =
  | 'APP_CONFIG_MISSING'
  | 'APP_NOT_ACCESSIBLE_ANON'
  | 'AUTH_REQUIRED'
  | 'STEAMCMD_PROCESS_ERROR'

export class SteamcmdInstallError extends Error {
  code: SteamcmdInstallErrorCode
  hint: string
  logTail: string[]

  constructor(
    message: string,
    code: SteamcmdInstallErrorCode,
    hint: string,
    logTail: string[] = []
  ) {
    super(message)
    this.name = 'SteamcmdInstallError'
    this.code = code
    this.hint = hint
    this.logTail = logTail
  }
}

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

  // SteamCMD self-updates on first run and needs a second pass to fully initialize
  onProgress(0.9, 'Finalizing SteamCMD setup...')
  await runSteamcmd(dir, ['+quit'], (line) => {
    onProgress(0.92, line)
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

function lastLines(lines: string[], count = ERROR_LOG_TAIL_LINES): string[] {
  return lines.slice(Math.max(lines.length - count, 0))
}

function classifySteamcmdFailure(lines: string[], fallbackMessage: string): SteamcmdInstallError {
  const normalized = lines.join('\n').toLowerCase()
  const tail = lastLines(lines)

  if (normalized.includes('missing configuration')) {
    return new SteamcmdInstallError(
      'Steam app configuration is missing for this target.',
      'APP_CONFIG_MISSING',
      'Anonymous access can fail when the selected app id or branch is unavailable. Verify App ID and branch settings.',
      tail
    )
  }

  if (normalized.includes('no subscription') || normalized.includes('not subscribed')) {
    return new SteamcmdInstallError(
      'Anonymous account is not subscribed to this app.',
      'APP_NOT_ACCESSIBLE_ANON',
      'This app cannot be fetched anonymously right now. Confirm the app is public for anonymous SteamCMD access.',
      tail
    )
  }

  if (normalized.includes('invalid password') || normalized.includes('steam guard')) {
    return new SteamcmdInstallError(
      'SteamCMD requested account authentication.',
      'AUTH_REQUIRED',
      'The current setup supports anonymous login only. Use an app/branch that supports anonymous access.',
      tail
    )
  }

  return new SteamcmdInstallError(
    fallbackMessage,
    'STEAMCMD_PROCESS_ERROR',
    'Review recent SteamCMD logs for details and retry the install.',
    tail
  )
}

async function checkAnonymousAppAccess(
  steamcmdDir: string,
  appId: string,
  onProgress: (p: number, msg: string) => void
): Promise<void> {
  const probeLines: string[] = []
  onProgress(0.05, `Preflight: checking anonymous access for app ${appId}...`)

  try {
    await runSteamcmd(
      steamcmdDir,
      ['+login', 'anonymous', '+app_info_update', '1', '+app_info_print', appId, '+quit'],
      (line) => {
        probeLines.push(line)
        onProgress(0.08, line)
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'SteamCMD preflight failed.'
    throw classifySteamcmdFailure(probeLines, message)
  }

  const probeText = probeLines.join('\n').toLowerCase()
  if (probeText.includes('missing configuration') || probeText.includes('no subscription')) {
    throw classifySteamcmdFailure(probeLines, 'SteamCMD preflight failed for anonymous access.')
  }
}

/**
 * Installs or updates the sbox dedicated server.
 */
export async function installSboxServer(
  steamcmdDir: string,
  installPath: string,
  target: { appId?: string; branch?: string } | undefined,
  onProgress: (p: number, msg: string) => void
): Promise<void> {
  const appId = (target?.appId || DEFAULT_SBOX_APP_ID).trim()
  const branch = (target?.branch || '').trim()

  if (!existsSync(installPath)) {
    mkdirSync(installPath, { recursive: true })
  }

  await checkAnonymousAppAccess(steamcmdDir, appId, onProgress)

  const args: string[] = [
    '+force_install_dir',
    installPath,
    '+login',
    'anonymous',
    '+app_update',
    appId
  ]

  if (branch) {
    args.push('-beta', branch)
  }

  args.push('validate', '+quit')

  const lines: string[] = []
  try {
    await runSteamcmd(steamcmdDir, args, (line) => {
      lines.push(line)
      // Try to parse "Update state ... downloading" lines for progress
      const match = line.match(/(\d+\.\d+)%/)
      const pct = match ? parseFloat(match[1]) / 100 : -1
      onProgress(pct >= 0 ? pct : 0.5, line)
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'SteamCMD failed during server install.'
    throw classifySteamcmdFailure(lines, message)
  }

  onProgress(1, 'sbox server installation complete.')
}
