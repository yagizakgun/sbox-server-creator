import * as React from 'react'
import { cn } from '@renderer/lib/utils'

const Badge = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & {
    variant?: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline'
  }
>(({ className, variant = 'default', ...props }, ref) => {
  const variants = {
    default: 'bg-primary/20 text-primary border-primary/30',
    secondary: 'bg-secondary text-secondary-foreground border-border',
    destructive: 'bg-destructive/20 text-destructive border-destructive/30',
    success: 'bg-success/20 text-success border-success/30',
    warning: 'bg-warning/20 text-warning border-warning/30',
    outline: 'border-border text-foreground'
  }
  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors',
        variants[variant],
        className
      )}
      {...props}
    />
  )
})
Badge.displayName = 'Badge'

export { Badge }
