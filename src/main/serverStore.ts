import Store from 'electron-store'
import type { ServerConfig } from './types'

interface StoreSchema {
  servers: ServerConfig[]
  steamcmdPath: string
  setupComplete: boolean
}

const defaults: StoreSchema = {
  servers: [],
  steamcmdPath: '',
  setupComplete: false
}

export const store = new Store<StoreSchema>({
  schema: {
    servers: {
      type: 'array',
      default: [],
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          installPath: { type: 'string' },
          game: { type: 'string' },
          map: { type: 'string' },
          hostname: { type: 'string' },
          token: { type: 'string' },
          extraArgs: { type: 'string' }
        },
        required: ['id', 'name', 'installPath', 'game', 'hostname']
      }
    },
    steamcmdPath: { type: 'string', default: '' },
    setupComplete: { type: 'boolean', default: false }
  },
  defaults
})

export function getServers(): ServerConfig[] {
  return store.get('servers')
}

export function saveServer(config: ServerConfig): void {
  const servers = store.get('servers')
  const idx = servers.findIndex((s) => s.id === config.id)
  if (idx >= 0) {
    servers[idx] = config
  } else {
    servers.push(config)
  }
  store.set('servers', servers)
}

export function deleteServer(id: string): void {
  const servers = store.get('servers').filter((s) => s.id !== id)
  store.set('servers', servers)
}

export function getSteamcmdPath(): string {
  return store.get('steamcmdPath')
}

export function setSteamcmdPath(p: string): void {
  store.set('steamcmdPath', p)
}

export function isSetupComplete(): boolean {
  return store.get('setupComplete')
}

export function setSetupComplete(v: boolean): void {
  store.set('setupComplete', v)
}
