'use client'

import { cn } from '@/lib/utils'

interface ConfidenceMeterProps {
  value: number // 0-1
  showLabel?: boolean
  className?: string
}

export function ConfidenceMeter({ value, showLabel = true, className }: ConfidenceMeterProps) {
  const pct = Math.round(value * 100)
  const color =
    pct >= 95 ? 'bg-emerald-500' : pct >= 90 ? 'bg-teal-500' : pct >= 80 ? 'bg-amber-500' : 'bg-red-500'
  const textColor =
    pct >= 95
      ? 'text-emerald-600'
      : pct >= 90
        ? 'text-teal-600'
        : pct >= 80
          ? 'text-amber-600'
          : 'text-red-600'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className={cn('text-xs font-semibold tabular-nums', textColor)}>{pct}%</span>
      )}
    </div>
  )
}
