import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2, Download, ArrowDownToLine, ChevronsDown } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { LogViewer } from '@renderer/components/LogViewer'
import { StatusBadge } from '@renderer/components/StatusBadge'
import { cn } from '@renderer/lib/utils'
import type { ServerConfig, ServerStatus } from '@renderer/types'

type LogLevel = 'all' | 'info' | 'warning' | 'error'

const LEVEL_OPTIONS: { value: LogLevel; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' }
]

function matchesLevel(line: string, level: LogLevel): boolean {
  if (level === 'all') return true
  const text = line.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '')
  const isError = text.startsWith('[Error') || /\berror\b/i.test(text)
  const isWarning = /\bwarn(ing)?\b/i.test(text)
  if (level === 'error') return isError
  if (level === 'warning') return isWarning
  if (level === 'info') return !isError && !isWarning
  return true
}

export default function Logs(): React.JSX.Element {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const [config, setConfig] = useState<ServerConfig | null>(null)
  const [status, setStatus] = useState<ServerStatus>({ id: id!, state: 'stopped' })
  const [lines, setLines] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [level, setLevel] = useState<LogLevel>('all')
  const [follow, setFollow] = useState(true)

  useEffect(() => {
    window.api.server.list().then((list) => {
      const found = list.find((s) => s.id === id)
      if (found) setConfig(found)
    })
    window.api.server.getStatus(id!).then(setStatus)

    // Hydrate with buffered history — logs survive navigation
    window.api.server.getLogs(id!).then((history) => {
      setLines(history)
    })

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

  const clearLogs = useCallback(async () => {
    await window.api.server.clearLogs(id!)
    setLines([])
  }, [id])

  const exportLogs = useCallback(() => {
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sbox-server-${id}-${Date.now()}.log`
    a.click()
    URL.revokeObjectURL(url)
  }, [lines, id])

  const filteredLines = lines.filter((l) => {
    const textMatch = !filter || l.toLowerCase().includes(filter.toLowerCase())
    return textMatch && matchesLevel(l, level)
  })

  return (
    <div className="flex h-full flex-col relative">
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

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter logs..."
          className="max-w-xs h-7 text-xs"
        />
        <div className="flex items-center rounded-md border border-border overflow-hidden">
          {LEVEL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setLevel(opt.value)}
              className={cn(
                'px-2.5 py-0.5 text-xs font-medium transition-colors',
                level === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {filteredLines.length} / {lines.length} lines
        </span>
        <button
          onClick={() => setFollow((f) => !f)}
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors border',
            follow
              ? 'border-green-500/30 text-green-400 bg-green-500/10'
              : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          <ChevronsDown className="h-3 w-3" />
          {follow ? 'Following' : 'Paused'}
        </button>
      </div>

      {/* Log output */}
      <div className="flex-1 overflow-hidden p-4">
        <LogViewer
          lines={filteredLines}
          follow={follow}
          onFollowChange={setFollow}
          className="h-full"
        />
      </div>

      {/* Jump to bottom FAB */}
      {!follow && (
        <div className="absolute bottom-8 right-8 z-10">
          <Button
            size="sm"
            variant="secondary"
            className="shadow-lg gap-1.5"
            onClick={() => setFollow(true)}
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
            Jump to bottom
          </Button>
        </div>
      )}
    </div>
  )
}
