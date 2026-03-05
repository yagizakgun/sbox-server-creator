import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2, Download } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { LogViewer } from '@renderer/components/LogViewer'
import { StatusBadge } from '@renderer/components/StatusBadge'
import type { ServerConfig, ServerStatus } from '@renderer/types'

export default function Logs(): React.JSX.Element {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const [config, setConfig] = useState<ServerConfig | null>(null)
  const [status, setStatus] = useState<ServerStatus>({ id: id!, state: 'stopped' })
  const [lines, setLines] = useState<string[]>([])
  const [filter, setFilter] = useState('')

  useEffect(() => {
    window.api.server.list().then((list) => {
      const found = list.find((s) => s.id === id)
      if (found) setConfig(found)
    })
    window.api.server.getStatus(id!).then(setStatus)

    const unsubLog = window.api.server.onLog(({ id: serverId, line }) => {
      if (serverId === id) {
        setLines((prev) => [...prev, line])
      }
    })

    const unsubStatus = window.api.server.onStatusUpdate((s) => {
      if (s.id === id) setStatus(s)
    })

    return () => {
      unsubLog()
      unsubStatus()
    }
  }, [id])

  const clearLogs = useCallback(() => setLines([]), [])

  const exportLogs = useCallback(() => {
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sbox-server-${id}-${Date.now()}.log`
    a.click()
    URL.revokeObjectURL(url)
  }, [lines, id])

  const filteredLines = filter
    ? lines.filter((l) => l.toLowerCase().includes(filter.toLowerCase()))
    : lines

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-foreground">
                {config?.name ?? 'Server'} — Logs
              </h1>
              <StatusBadge state={status.state} />
            </div>
            <p className="text-xs text-muted-foreground font-mono">{config?.installPath}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={exportLogs} disabled={lines.length === 0}>
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="ghost" size="sm" onClick={clearLogs} disabled={lines.length === 0}>
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter logs..."
          className="max-w-sm h-7 text-xs"
        />
        <span className="text-xs text-muted-foreground">
          {filteredLines.length} / {lines.length} lines
        </span>
      </div>

      {/* Log output */}
      <div className="flex-1 overflow-hidden p-4">
        <LogViewer lines={filteredLines} className="h-full" />
      </div>
    </div>
  )
}
