'use client'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  trend?: { value: number; label?: string }
  accent?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  className?: string
}

const accentMap = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  danger: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
  info: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  accent = 'primary',
  className,
}: StatCardProps) {
  return (
    <Card className={cn('relative overflow-hidden p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
          {trend && (
            <div className="mt-1.5 flex items-center gap-1 text-xs">
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 font-medium',
                  trend.value >= 0 ? 'text-emerald-600' : 'text-red-600'
                )}
              >
                {trend.value >= 0 ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {Math.abs(trend.value)}%
              </span>
              {trend.label && (
                <span className="text-muted-foreground">{trend.label}</span>
              )}
            </div>
          )}
        </div>
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
            accentMap[accent]
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  )
}
