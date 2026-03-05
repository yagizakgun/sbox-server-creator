import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import * as readline from 'readline'
import { EventEmitter } from 'events'
import type { ServerConfig, ServerStatus } from './types'

class ServerInstanceManager extends EventEmitter {
  private processes = new Map<string, ChildProcess>()
  private statuses = new Map<string, ServerStatus>()

  start(config: ServerConfig): void {
    if (this.processes.has(config.id)) {
      const proc = this.processes.get(config.id)!
      if (proc.exitCode === null) {
        // Already running
        return
      }
    }

    const exe = join(config.installPath, 'sbox-server.exe')
    const args = buildArgs(config)

    this.setStatus(config.id, { id: config.id, state: 'starting' })
    this.emit('log', config.id, `> ${exe} ${args.join(' ')}`)

    const proc = spawn(exe, args, {
      cwd: config.installPath,
      windowsHide: false
    })

    this.processes.set(config.id, proc)

    const handleLine = (line: string): void => {
      this.emit('log', config.id, line)
    }

    const rl = readline.createInterface({ input: proc.stdout, crlfDelay: Infinity })
    rl.on('line', (line) => {
      handleLine(line)
      if (line.includes('Server startup complete') || line.includes('listening')) {
        this.setStatus(config.id, { id: config.id, state: 'running', pid: proc.pid })
      }
    })

    const errl = readline.createInterface({ input: proc.stderr, crlfDelay: Infinity })
    errl.on('line', handleLine)

    proc.on('spawn', () => {
      this.setStatus(config.id, { id: config.id, state: 'starting', pid: proc.pid })
    })

    proc.on('close', (code) => {
      handleLine(`[Process exited with code ${code}]`)
      if (code !== 0 && code !== null) {
        this.setStatus(config.id, { id: config.id, state: 'error', error: `Exit code ${code}` })
      } else {
        this.setStatus(config.id, { id: config.id, state: 'stopped' })
      }
      this.processes.delete(config.id)
    })

    proc.on('error', (err) => {
      handleLine(`[Error: ${err.message}]`)
      this.setStatus(config.id, { id: config.id, state: 'error', error: err.message })
      this.processes.delete(config.id)
    })
  }

  stop(id: string): void {
    const proc = this.processes.get(id)
    if (proc) {
      proc.kill('SIGTERM')
    }
  }

  restart(config: ServerConfig): void {
    const proc = this.processes.get(config.id)
    if (proc && proc.exitCode === null) {
      proc.once('close', () => this.start(config))
      proc.kill('SIGTERM')
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

  stopAll(): void {
    for (const [id] of this.processes) {
      this.stop(id)
    }
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
