import React, { useEffect, useRef, useCallback } from 'react'
import { cn } from '@renderer/lib/utils'

interface LogViewerProps {
  lines: string[]
  follow: boolean
  onFollowChange: (follow: boolean) => void
  className?: string
}

function lineColorClass(line: string): string {
  const text = line.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '')
  if (text.startsWith('[Error') || /\berror\b/i.test(text)) return 'text-red-400'
  if (/\bwarn(ing)?\b/i.test(text)) return 'text-yellow-400'
  if (text.startsWith('[Process')) return 'text-zinc-500 italic'
  if (text.startsWith('>')) return 'text-cyan-400'
  return 'text-green-400'
}

export function LogViewer({
  lines,
  follow,
  onFollowChange,
  className
}: LogViewerProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const suppressScrollEvent = useRef(false)

  useEffect(() => {
    if (!follow) return
    const el = containerRef.current
    if (!el) return
    suppressScrollEvent.current = true
    el.scrollTop = el.scrollHeight
    requestAnimationFrame(() => {
      suppressScrollEvent.current = false
    })
  }, [lines.length, follow])

  const handleScroll = useCallback(() => {
    if (suppressScrollEvent.current) return
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    if (!atBottom && follow) {
      onFollowChange(false)
    } else if (atBottom && !follow) {
      onFollowChange(true)
    }
  }, [follow, onFollowChange])

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={cn(
        'overflow-y-auto rounded-lg bg-black/60 p-3 font-mono text-xs border border-border',
        className
      )}
    >
      {lines.length === 0 ? (
        <p className="text-zinc-500 italic">No output yet...</p>
      ) : (
        lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              'flex gap-2 leading-5 break-all whitespace-pre-wrap',
              lineColorClass(line)
            )}
          >
            <span className="select-none shrink-0 w-10 text-right text-zinc-600">{i + 1}</span>
            <span className="flex-1 min-w-0">{line}</span>
          </div>
        ))
      )}
    </div>
  )
}
