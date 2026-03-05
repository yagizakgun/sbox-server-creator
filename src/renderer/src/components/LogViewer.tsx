import React, { useEffect, useRef } from 'react'
import { cn } from '@renderer/lib/utils'

interface LogViewerProps {
  lines: string[]
  className?: string
}

export function LogViewer({ lines, className }: LogViewerProps): React.JSX.Element {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines.length])

  return (
    <div
      className={cn(
        'overflow-y-auto rounded-lg bg-black/60 p-3 font-mono text-xs text-green-400 border border-border',
        className
      )}
    >
      {lines.length === 0 ? (
        <p className="text-muted-foreground italic">No output yet...</p>
      ) : (
        lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              'leading-5 break-all whitespace-pre-wrap',
              line.startsWith('[Error') || line.includes('error') ? 'text-red-400' : '',
              line.startsWith('[stderr]') ? 'text-yellow-400' : '',
              line.startsWith('[Process') ? 'text-muted-foreground' : ''
            )}
          >
            {line}
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  )
}
