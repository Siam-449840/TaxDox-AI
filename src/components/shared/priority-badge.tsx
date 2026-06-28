'use client'

import { cn } from '@/lib/utils'
import { PRIORITY_CONFIG } from '@/lib/constants'
import type { Priority } from '@/lib/types'

interface PriorityBadgeProps {
  priority: Priority
  className?: string
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium',
        config.bg,
        config.color,
        className
      )}
    >
      {config.label}
    </span>
  )
}
