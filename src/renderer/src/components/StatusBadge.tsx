import React from 'react'
import { Badge } from '@renderer/components/ui/badge'
import type { ServerStatus } from '@renderer/types'

interface StatusBadgeProps {
  state: ServerStatus['state']
}

const labels: Record<ServerStatus['state'], string> = {
  stopped: 'Stopped',
  starting: 'Starting...',
  running: 'Running',
  error: 'Error'
}

const variants: Record<ServerStatus['state'], 'secondary' | 'warning' | 'success' | 'destructive'> = {
  stopped: 'secondary',
  starting: 'warning',
  running: 'success',
  error: 'destructive'
}

export function StatusBadge({ state }: StatusBadgeProps): React.JSX.Element {
  return (
    <Badge variant={variants[state]}>
      {state === 'running' && (
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
      )}
      {labels[state]}
    </Badge>
  )
}
