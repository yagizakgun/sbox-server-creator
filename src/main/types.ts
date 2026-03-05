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
