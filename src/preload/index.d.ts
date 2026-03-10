import { ElectronAPI } from '@electron-toolkit/preload'

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

export interface ServerStats {
  id: string
  physics?: string
  navmesh?: string
  animation?: string
  update?: string
  network?: string
  serverInfo?: string
}

type ProgressData = { percent: number; message: string }
type SteamcmdErrorCode =
  | 'APP_CONFIG_MISSING'
  | 'APP_NOT_ACCESSIBLE_ANON'
  | 'AUTH_REQUIRED'
  | 'STEAMCMD_PROCESS_ERROR'

interface SteamcmdActionResult {
  success: boolean
  error?: string
  errorCode?: SteamcmdErrorCode
  hint?: string
  logTail?: string[]
}

interface UpdateServerRequest {
  installPath: string
  appId?: string
  branch?: string
}

interface SboxAPI {
  steamcmd: {
    getDefaultDir(): Promise<string>
    getSavedPath(): Promise<string>
    checkInstalled(dir: string): Promise<boolean>
    isSetupComplete(): Promise<boolean>
    install(dir: string): Promise<SteamcmdActionResult>
    updateServer(payload: string | UpdateServerRequest): Promise<SteamcmdActionResult>
    browsePath(): Promise<string | null>
    onInstallProgress(cb: (d: ProgressData) => void): () => void
    onUpdateProgress(cb: (d: ProgressData) => void): () => void
  }
  server: {
    list(): Promise<ServerConfig[]>
    create(config: Omit<ServerConfig, 'id'>): Promise<ServerConfig>
    update(config: ServerConfig): Promise<ServerConfig>
    delete(id: string): Promise<boolean>
    start(id: string): Promise<{ success: boolean; error?: string }>
    stop(id: string): Promise<{ success: boolean }>
    restart(id: string): Promise<{ success: boolean; error?: string }>
    getStatus(id: string): Promise<ServerStatus>
    getAllStatuses(): Promise<ServerStatus[]>
    onStatusUpdate(cb: (s: ServerStatus) => void): () => void
    onLog(cb: (d: { id: string; line: string }) => void): () => void
    getLogs(id: string): Promise<string[]>
    clearLogs(id: string): Promise<boolean>
    sendCommand(id: string, command: string): Promise<boolean>
    getStats(id: string): Promise<ServerStats | null>
    onStats(cb: (s: ServerStats) => void): () => void
  }
  config: {
    readPermissions(serverPath: string): Promise<UserPermission[]>
    writePermissions(serverPath: string, data: UserPermission[]): Promise<boolean>
    browseSbproj(): Promise<string | null>
  }
}

interface UserPermission {
  SteamId: string
  Name: string
  Claims: string[]
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: SboxAPI
  }
}

