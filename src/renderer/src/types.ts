// Shared types used by both main process and renderer
// (Renderer imports from here, main imports from ./types)

export interface ServerConfig {
  id: string
  name: string
  installPath: string
  game: string
  map?: string
  hostname: string
  token?: string
  extraArgs?: string
}

export interface ServerStatus {
  id: string
  state: 'stopped' | 'starting' | 'running' | 'error'
  pid?: number
  error?: string
}

export interface ProgressEvent {
  percent: number
  message: string
}

export interface UserPermission {
  SteamId: string
  Name: string
  Claims: string[]
}
