'use client'

import { cn } from '@/lib/utils'

interface ProgressRingProps {
  value: number
  size?: number
  strokeWidth?: number
  className?: string
  showLabel?: boolean
  color?: string
}

export function ProgressRing({
  value,
  size = 48,
  strokeWidth = 4,
  className,
  showLabel = true,
  color,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (value / 100) * circumference

  const ringColor =
    color ||
    (value >= 100
      ? '#10b981'
      : value >= 75
        ? '#0ea5e9'
        : value >= 50
          ? '#f59e0b'
          : '#ef4444')

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/40"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      {showLabel && (
        <span className="absolute text-[10px] font-semibold tabular-nums">
          {value}%
        </span>
      )}
    </div>
  )
}
