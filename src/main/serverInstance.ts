import * as pty from 'node-pty'
import { join } from 'path'
import { EventEmitter } from 'events'
import type { ServerConfig, ServerStatus, ServerStats } from './types'

const MAX_LOG_LINES = 5000
// Strip ANSI/VT100 escape codes from PTY output (including private mode sequences like ?25h)
const ANSI_RE = /\x1b\[[\x20-\x3f]*[\x40-\x7e]|\x1b[()][0-9A-Za-z]|\x1b[=>M]|\x07|\r/g

// Matches periodic server stats lines — these update the stats panel instead of the log
const STATS_PHYSICS_RE = /^Physics\s+([\d.]+ms).*NavMesh\s+([\d.]+ms).*Animation\s+([\d.]+ms)/
const STATS_UPDATE_RE = /^Update\s+([\d.]+ms)/
const STATS_NETWORK_RE = /^Network\s+([\d.]+ms)/
const STATS_SERVER_RE = /^(.+?)\s+\((\d+\/\d+)\)\s+(\[\d+:\d+:\d+\])/

class ServerInstanceManager extends EventEmitter {
  private processes = new Map<string, pty.IPty>()
  private statuses = new Map<string, ServerStatus>()
  private logBuffers = new Map<string, string[]>()
  private statsBuffers = new Map<string, ServerStats>()

  getStats(id: string): ServerStats | null {
    return this.statsBuffers.get(id) ?? null
  }

  private updateStats(id: string, patch: Partial<Omit<ServerStats, 'id'>>): void {
    const current = this.statsBuffers.get(id) ?? { id }
    const updated = { ...current, ...patch }
    this.statsBuffers.set(id, updated)
    this.emit('stats', updated)
    // If stats are flowing, the server is clearly running
    const status = this.statuses.get(id)
    if (status?.state === 'starting') {
      const proc = this.processes.get(id)
      this.setStatus(id, { id, state: 'running', pid: proc?.pid })
    }
  }

  start(config: ServerConfig): void {
    const existing = this.processes.get(config.id)
    if (existing) {
      // node-pty doesn't expose exitCode directly, track via onExit
      return
    }

    const exe = join(config.installPath, 'sbox-server.exe')
    const args = buildArgs(config)

    this.setStatus(config.id, { id: config.id, state: 'starting' })
    this.appendLog(config.id, `> ${exe} ${args.join(' ')}`)

    const proc = pty.spawn(exe, args, {
      name: 'xterm',
      cols: 220,
      rows: 50,
      cwd: config.installPath,
      env: process.env as Record<string, string>
    })

    this.processes.set(config.id, proc)

    let lineBuffer = ''
    proc.onData((data) => {
      const clean = data.replace(ANSI_RE, '')
      lineBuffer += clean
      const parts = lineBuffer.split('\n')
      lineBuffer = parts.pop() ?? ''
      for (const line of parts) {
        const trimmed = line.trimEnd()
        if (!trimmed) continue

        // Parse stats lines — update panel, don't log
        let mPhysics: RegExpMatchArray | null
        let mUpdate: RegExpMatchArray | null
        let mNetwork: RegExpMatchArray | null
        let mServer: RegExpMatchArray | null
        if ((mPhysics = trimmed.match(STATS_PHYSICS_RE))) {
          this.updateStats(config.id, { physics: mPhysics[1], navmesh: mPhysics[2], animation: mPhysics[3] })
          continue
        } else if ((mUpdate = trimmed.match(STATS_UPDATE_RE))) {
          this.updateStats(config.id, { update: mUpdate[1] })
          continue
        } else if ((mNetwork = trimmed.match(STATS_NETWORK_RE))) {
          this.updateStats(config.id, { network: mNetwork[1] })
          continue
        } else if ((mServer = trimmed.match(STATS_SERVER_RE))) {
          this.updateStats(config.id, { serverInfo: `${mServer[1]} (${mServer[2]}) ${mServer[3]}` })
          continue
        }

        this.appendLog(config.id, trimmed)
        if (trimmed.includes('Server startup complete') || trimmed.includes('listening')) {
          this.setStatus(config.id, { id: config.id, state: 'running', pid: proc.pid })
        }
      }
    })

    proc.onExit(({ exitCode }) => {
      if (lineBuffer.trim()) {
        this.appendLog(config.id, lineBuffer.trimEnd())
        lineBuffer = ''
      }
      this.appendLog(config.id, `[Process exited with code ${exitCode}]`)
      if (exitCode !== 0) {
        this.setStatus(config.id, { id: config.id, state: 'error', error: `Exit code ${exitCode}` })
      } else {
        this.setStatus(config.id, { id: config.id, state: 'stopped' })
      }
      this.processes.delete(config.id)
    })
  }

  stop(id: string): void {
    const proc = this.processes.get(id)
    if (proc) {
      proc.kill()
    }
  }

  restart(config: ServerConfig): void {
    const proc = this.processes.get(config.id)
    if (proc) {
      proc.onExit(() => this.start(config))
      proc.kill()
    } else {
      this.start(config)
    }
  }

  getStatus(id: string): ServerStatus {
    return this.statuses.get(id) ?? { id, state: 'stopped' }
  }

  getAllStatuses(): ServerStatus[] {
    return Array.from(this.statuses.values())
  }

  private setStatus(id: string, status: ServerStatus): void {
    this.statuses.set(id, status)
    this.emit('status', status)
  }

  getLogs(id: string): string[] {
    return this.logBuffers.get(id) ?? []
  }

  clearLogs(id: string): void {
    this.logBuffers.set(id, [])
  }

  sendCommand(id: string, command: string): boolean {
    const proc = this.processes.get(id)
    if (!proc) {
      this.appendLog(id, `[sendCommand failed: server not running]`)
      return false
    }
    this.appendLog(id, `> ${command}`)
    proc.write(command + '\r')
    return true
  }

  stopAll(): void {
    for (const [id] of this.processes) {
      this.stop(id)
    }
  }

  private appendLog(id: string, line: string): void {
    const now = new Date()
    const ts = `[${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}]`
    const stamped = `${ts} ${line}`
    let buf = this.logBuffers.get(id)
    if (!buf) {
      buf = []
      this.logBuffers.set(id, buf)
    }
    buf.push(stamped)
    if (buf.length > MAX_LOG_LINES) {
      buf.shift()
    }
    this.emit('log', id, stamped)
  }
}

function buildArgs(config: ServerConfig): string[] {
  const args: string[] = []
  args.push('+game', config.game)
  if (config.map) {
    args.push(config.map)
  }
  args.push('+hostname', config.hostname)
  if (config.token) {
    args.push('+net_game_server_token', config.token)
  }
  if (config.extraArgs) {
    args.push(...config.extraArgs.split(/\s+/).filter(Boolean))
  }
  return args
}

export const serverManager = new ServerInstanceManager()
