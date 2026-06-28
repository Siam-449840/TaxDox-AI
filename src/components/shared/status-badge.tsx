'use client'

import { cn } from '@/lib/utils'
import { STATUS_CONFIG } from '@/lib/constants'

interface StatusBadgeProps {
  status: string
  size?: 'sm' | 'md'
  className?: string
}

export function StatusBadge({ status, size = 'sm', className }: StatusBadgeProps) {
  const config =
    STATUS_CONFIG[status] ||
    STATUS_CONFIG[status === 'processing' ? 'processing_doc' : 'pending'] ||
    { label: status, color: 'text-slate-600', bg: 'bg-slate-100', dot: 'bg-slate-400' }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        config.bg,
        config.color,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>
  )
}
