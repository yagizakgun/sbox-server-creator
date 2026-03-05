import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Play,
  Square,
  RotateCcw,
  Plus,
  Settings,
  FileText,
  Users,
  RefreshCw,
  Terminal
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@renderer/components/ui/card'
import { Separator } from '@renderer/components/ui/separator'
import { StatusBadge } from '@renderer/components/StatusBadge'
import type { ServerConfig, ServerStatus } from '@renderer/types'

interface ServerCardProps {
  config: ServerConfig
  status: ServerStatus
  onStart: (id: string) => void
  onStop: (id: string) => void
  onRestart: (id: string) => void
  onEdit: (config: ServerConfig) => void
  onViewLogs: (id: string) => void
  onPermissions: (config: ServerConfig) => void
}

function ServerCard({
  config,
  status,
  onStart,
  onStop,
  onRestart,
  onEdit,
  onViewLogs,
  onPermissions
}: ServerCardProps): React.JSX.Element {
  const running = status.state === 'running'
  const starting = status.state === 'starting'
  const busy = starting

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate">{config.name}</CardTitle>
            <CardDescription className="mt-1 truncate font-mono text-xs">
              {config.game}
              {config.map ? ` · ${config.map}` : ''}
            </CardDescription>
          </div>
          <StatusBadge state={status.state} />
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Hostname</span>
          <span className="text-foreground truncate max-w-[60%] text-right">{config.hostname}</span>
        </div>
        <div className="flex justify-between">
          <span>Directory</span>
          <span className="text-foreground truncate max-w-[60%] text-right font-mono">
            {config.installPath}
          </span>
        </div>
        {status.pid && (
          <div className="flex justify-between">
            <span>PID</span>
            <span className="text-foreground font-mono">{status.pid}</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-2 pt-3">
        <div className="flex w-full gap-2">
          {!running && !starting ? (
            <Button size="sm" className="flex-1" onClick={() => onStart(config.id)} disabled={busy}>
              <Play className="h-3.5 w-3.5" />
              Start
            </Button>
          ) : (
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              onClick={() => onStop(config.id)}
            >
              <Square className="h-3.5 w-3.5" />
              Stop
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRestart(config.id)}
            disabled={busy}
            title="Restart"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex w-full gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 text-xs"
            onClick={() => onViewLogs(config.id)}
          >
            <Terminal className="h-3.5 w-3.5" />
            Logs
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 text-xs"
            onClick={() => onPermissions(config)}
          >
            <Users className="h-3.5 w-3.5" />
            Users
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 text-xs"
            onClick={() => onEdit(config)}
          >
            <Settings className="h-3.5 w-3.5" />
            Edit
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}

export default function Dashboard(): React.JSX.Element {
  const navigate = useNavigate()
  const [servers, setServers] = useState<ServerConfig[]>([])
  const [statuses, setStatuses] = useState<Map<string, ServerStatus>>(new Map())
  const [loading, setLoading] = useState(true)

  const loadServers = useCallback(async () => {
    const list = await window.api.server.list()
    setServers(list)
    const all = await window.api.server.getAllStatuses()
    const map = new Map<string, ServerStatus>()
    for (const s of all) map.set(s.id, s)
    setStatuses(map)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadServers()
    const unsub = window.api.server.onStatusUpdate((status) => {
      setStatuses((prev) => new Map(prev).set(status.id, status))
    })
    return unsub
  }, [loadServers])

  const getStatus = (id: string): ServerStatus =>
    statuses.get(id) ?? { id, state: 'stopped' }

  const handleStart = async (id: string): Promise<void> => {
    await window.api.server.start(id)
  }
  const handleStop = async (id: string): Promise<void> => {
    await window.api.server.stop(id)
  }
  const handleRestart = async (id: string): Promise<void> => {
    await window.api.server.restart(id)
  }
  const handleEdit = (config: ServerConfig): void => {
    navigate(`/server/${config.id}`)
  }
  const handleViewLogs = (id: string): void => {
    navigate(`/logs/${id}`)
  }
  const handlePermissions = (config: ServerConfig): void => {
    navigate(`/permissions/${config.id}`)
  }

  const runningCount = [...statuses.values()].filter((s) => s.state === 'running').length

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-foreground">Dashboard</h1>
          {!loading && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {servers.length} server{servers.length !== 1 ? 's' : ''}
              {runningCount > 0 && ` · ${runningCount} running`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={loadServers} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => navigate('/server/new')}>
            <Plus className="h-4 w-4" />
            New Server
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : servers.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">No servers yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first server to get started.
              </p>
            </div>
            <Button onClick={() => navigate('/server/new')}>
              <Plus className="h-4 w-4" />
              Create Server
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {servers.map((config) => (
              <ServerCard
                key={config.id}
                config={config}
                status={getStatus(config.id)}
                onStart={handleStart}
                onStop={handleStop}
                onRestart={handleRestart}
                onEdit={handleEdit}
                onViewLogs={handleViewLogs}
                onPermissions={handlePermissions}
              />
            ))}
          </div>
        )}
      </div>

      <Separator />
    </div>
  )
}
