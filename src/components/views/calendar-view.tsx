'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { StatusBadge } from '@/components/shared/status-badge'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { StatCard } from '@/components/shared/stat-card'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  List as ListIcon,
  Columns3,
  Clock,
  AlertTriangle,
  Flame,
  CalendarCheck,
  ArrowRight,
  ArrowUpDown,
} from 'lucide-react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  addDays,
  differenceInDays,
  isBefore,
  startOfDay,
  isValid,
  parseISO,
} from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Priority } from '@/lib/types'

/* ----------------------------- helpers & config ----------------------------- */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

const PRIORITY_DOT: Record<Priority, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-slate-400',
}

const PRIORITY_CHIP: Record<Priority, string> = {
  high: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900/60',
  medium:
    'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60',
  low: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:ring-slate-700',
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

const ENGAGEMENT_TYPE_BADGE: Record<string, string> = {
  '1040':
    'bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:ring-teal-900/60',
  '1065':
    'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900/60',
  '1120':
    'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60',
  '1120S':
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60',
  '1041':
    'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/60',
}

function getInitials(name?: string) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function getProgressColor(value: number) {
  if (value >= 100) return 'bg-emerald-500'
  if (value >= 75) return 'bg-teal-500'
  if (value >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

function safeDate(value?: string | null): Date | null {
  if (!value) return null
  const d = typeof value === 'string' ? parseISO(value) : new Date(value)
  return isValid(d) ? d : null
}

function getTypeBadgeClass(type: string) {
  return (
    ENGAGEMENT_TYPE_BADGE[type] ||
    'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:ring-slate-700'
  )
}

/* --------------------------------- types --------------------------------- */

interface CalendarEngagement {
  id: string
  deadline: string
  priority: Priority
  status: string
  progress: number
  taxYear: number
  engagementType: string
  client?: { id: string; name: string; clientType?: string } | null
  assignedTo?: {
    id: string
    name: string
    email?: string
    color?: string
    role?: string
  } | null
}

type CalendarMode = 'month' | 'week' | 'list'
type SortMode = 'date' | 'priority'

/* ============================ main component ============================ */

export function CalendarView() {
  const openEngagement = useAppStore((s) => s.openEngagement)

  const [engagements, setEngagements] = useState<CalendarEngagement[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<CalendarMode>('month')
  const [cursor, setCursor] = useState<Date>(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('date')

  /* fetch engagements */
  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/engagements', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load engagements')
        const json = await res.json()
        if (cancelled) return
        const all: CalendarEngagement[] = json.engagements || []
        // filter: has deadline + status !== 'done'
        const filtered = all.filter((e) => {
          if (e.status === 'done') return false
          return !!safeDate(e.deadline)
        })
        setEngagements(filtered)
      } catch {
        if (!cancelled) {
          toast.error('Could not load deadlines')
          setEngagements([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => {
      cancelled = true
    }
  }, [])

  /* group by yyyy-MM-dd */
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEngagement[]>()
    for (const e of engagements) {
      const d = safeDate(e.deadline)
      if (!d) continue
      const key = format(startOfDay(d), 'yyyy-MM-dd')
      const list = map.get(key) || []
      list.push(e)
      map.set(key, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
        if (p !== 0) return p
        return (a.progress || 0) - (b.progress || 0)
      })
    }
    return map
  }, [engagements])

  const getForDay = useCallback(
    (date: Date): CalendarEngagement[] => {
      const key = format(date, 'yyyy-MM-dd')
      return byDate.get(key) || []
    },
    [byDate]
  )

  /* stats */
  const stats = useMemo(() => {
    const today = startOfDay(new Date())
    let upcoming7 = 0
    let pastDue = 0
    let high = 0
    for (const e of engagements) {
      const d = safeDate(e.deadline)
      if (!d) continue
      const days = differenceInDays(startOfDay(d), today)
      if (days < 0) pastDue++
      else if (days <= 7) upcoming7++
      if (e.priority === 'high') high++
    }
    return {
      total: engagements.length,
      upcoming7,
      pastDue,
      high,
    }
  }, [engagements])

  /* nav handlers */
  const goPrev = () => {
    if (mode === 'week') setCursor((c) => addDays(c, -7))
    else setCursor((c) => addMonths(c, -1))
  }
  const goNext = () => {
    if (mode === 'week') setCursor((c) => addDays(c, 7))
    else setCursor((c) => addMonths(c, 1))
  }
  const goToday = () => setCursor(new Date())

  const openDay = (date: Date) => {
    setSelectedDate(date)
    setPanelOpen(true)
  }

  const headerLabel = useMemo(() => {
    if (mode === 'week') {
      const ws = startOfWeek(cursor, { weekStartsOn: 0 })
      const we = endOfWeek(cursor, { weekStartsOn: 0 })
      if (isSameMonth(ws, we)) return `${format(ws, 'MMM d')} – ${format(we, 'd, yyyy')}`
      return `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}`
    }
    return format(cursor, 'MMMM yyyy')
  }, [mode, cursor])

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight md:text-3xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <CalendarDays className="h-5 w-5 text-primary" />
            </span>
            Deadline Calendar
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground md:text-base">
            Track all engagement filing deadlines at a glance
          </p>
        </div>
        {/* view toggle */}
        <div className="inline-flex shrink-0 rounded-lg border bg-card p-0.5 shadow-sm">
          <ToggleBtn
            active={mode === 'month'}
            onClick={() => setMode('month')}
            icon={CalendarDays}
            label="Month"
          />
          <ToggleBtn
            active={mode === 'week'}
            onClick={() => setMode('week')}
            icon={Columns3}
            label="Week"
          />
          <ToggleBtn
            active={mode === 'list'}
            onClick={() => setMode('list')}
            icon={ListIcon}
            label="List"
          />
        </div>
      </div>

      {/* Nav row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday} className="gap-1.5">
            <CalendarCheck className="h-4 w-4" />
            Today
          </Button>
          <div className="flex items-center rounded-lg border bg-card p-0.5 shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              onClick={goPrev}
              className="h-8 w-8"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={goNext}
              className="h-8 w-8"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="ml-1 min-w-[140px] text-sm font-semibold tabular-nums sm:text-base">
            {headerLabel}
          </div>
        </div>

        {mode === 'list' ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortMode((s) => (s === 'date' ? 'priority' : 'date'))}
            className="gap-1.5"
          >
            <ArrowUpDown className="h-4 w-4" />
            Sort: {sortMode === 'date' ? 'Date' : 'Priority'}
          </Button>
        ) : (
          <div className="hidden items-center gap-4 text-[11px] text-muted-foreground sm:flex">
            <LegendDot color="bg-red-500" label="High" />
            <LegendDot color="bg-amber-500" label="Medium" />
            <LegendDot color="bg-slate-400" label="Low" />
            <span className="hidden items-center gap-1.5 md:flex">
              <span className="h-2.5 w-2.5 rounded-sm ring-2 ring-inset ring-red-400/70" />
              Past due
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading ? (
          <>
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </>
        ) : (
          <>
            <StatCard
              label="Active Deadlines"
              value={stats.total}
              icon={CalendarDays}
              accent="primary"
            />
            <StatCard label="Due in 7 Days" value={stats.upcoming7} icon={Clock} accent="warning" />
            <StatCard label="Past Due" value={stats.pastDue} icon={AlertTriangle} accent="danger" />
            <StatCard label="High Priority" value={stats.high} icon={Flame} accent="danger" />
          </>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <CalendarSkeleton mode={mode} />
      ) : engagements.length === 0 ? (
        <EmptyState />
      ) : mode === 'month' ? (
        <MonthView cursor={cursor} getForDay={getForDay} onDayClick={openDay} />
      ) : mode === 'week' ? (
        <WeekView cursor={cursor} getForDay={getForDay} onDayClick={openDay} />
      ) : (
        <ListView
          engagements={engagements}
          sortMode={sortMode}
          onRowClick={openDay}
          onOpenEngagement={openEngagement}
        />
      )}

      {/* Detail panel */}
      <DeadlineDetailPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        date={selectedDate}
        items={selectedDate ? getForDay(selectedDate) : []}
        onOpenEngagement={(id) => {
          setPanelOpen(false)
          openEngagement(id)
        }}
      />
    </div>
  )
}

/* ============================ subcomponents ============================ */

function ToggleBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof CalendarDays
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('h-2 w-2 rounded-full', color)} />
      <span>{label}</span>
    </span>
  )
}

/* ----------------------------- Month view ----------------------------- */

function MonthView({
  cursor,
  getForDay,
  onDayClick,
}: {
  cursor: Date
  getForDay: (d: Date) => CalendarEngagement[]
  onDayClick: (d: Date) => void
}) {
  const monthStart = startOfMonth(cursor)
  const monthEnd = endOfMonth(cursor)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const today = new Date()

  return (
    <Card className="overflow-hidden p-0">
      {/* weekday header */}
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className={cn(
              'px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wider sm:text-xs',
              i === 0 || i === 6 ? 'text-muted-foreground/70' : 'text-muted-foreground'
            )}
          >
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{d[0]}</span>
          </div>
        ))}
      </div>

      {/* grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const items = getForDay(day)
          const inMonth = isSameMonth(day, cursor)
          const isWeekend = day.getDay() === 0 || day.getDay() === 6
          const isTodayCell = isToday(day)
          const pastDue =
            items.length > 0 &&
            items.some((e) => {
              const dd = safeDate(e.deadline)
              return dd ? isBefore(startOfDay(dd), startOfDay(today)) : false
            })
          const hasDeadlines = items.length > 0

          const visibleItems = items.slice(0, 3)
          const remaining = items.length - visibleItems.length

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onDayClick(day)}
              className={cn(
                'group relative flex min-h-[88px] flex-col items-stretch gap-1 border-b border-r border-border/80 p-1.5 text-left transition-all hover:shadow-md hover:z-10 sm:min-h-[112px] sm:p-2',
                'hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none',
                !inMonth && 'bg-muted/20',
                inMonth && isWeekend && 'bg-muted/30',
                pastDue && 'ring-2 ring-inset ring-red-400/60 dark:ring-red-700/60',
                hasDeadlines && inMonth && 'bg-primary/[0.03]'
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                    isTodayCell
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : inMonth
                      ? 'text-foreground'
                      : 'text-muted-foreground/40'
                  )}
                >
                  {format(day, 'd')}
                </span>
                {items.length > 0 && (
                  <span className="text-[10px] font-medium text-muted-foreground/70">
                    {items.length}
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                {visibleItems.map((e) => (
                  <DeadlineChip key={e.id} engagement={e} />
                ))}
                {remaining > 0 && (
                  <span className="px-1 text-[10px] font-medium text-muted-foreground transition-colors group-hover:text-primary">
                    +{remaining} more
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

function DeadlineChip({ engagement: e }: { engagement: CalendarEngagement }) {
  const name = e.client?.name || 'Unknown'
  const shortName = name.length > 14 ? name.slice(0, 13) + '…' : name
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 truncate rounded px-1 py-0.5 text-[10px] font-medium sm:text-[11px]',
        PRIORITY_CHIP[e.priority]
      )}
      title={`${name} — ${e.engagementType} (${e.priority} priority)`}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', PRIORITY_DOT[e.priority])} />
      <span className="truncate">{shortName}</span>
    </div>
  )
}

/* ----------------------------- Week view ----------------------------- */

function WeekView({
  cursor,
  getForDay,
  onDayClick,
}: {
  cursor: Date
  getForDay: (d: Date) => CalendarEngagement[]
  onDayClick: (d: Date) => void
}) {
  const ws = startOfWeek(cursor, { weekStartsOn: 0 })
  const we = endOfWeek(cursor, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: ws, end: we })
  const today = new Date()

  return (
    <Card className="overflow-hidden p-0">
      <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-7 md:divide-x md:divide-y-0">
        {days.map((day, i) => {
          const items = getForDay(day)
          const isWeekend = day.getDay() === 0 || day.getDay() === 6
          const isTodayCell = isToday(day)
          const pastDue =
            items.length > 0 &&
            items.some((e) => {
              const dd = safeDate(e.deadline)
              return dd ? isBefore(startOfDay(dd), startOfDay(today)) : false
            })

          return (
            <div
              key={i}
              className={cn(
                'flex min-h-[160px] flex-col md:min-h-[440px]',
                isWeekend && 'bg-muted/20',
                pastDue && 'ring-1 ring-inset ring-red-400/60 dark:ring-red-700/60'
              )}
            >
              {/* day header */}
              <button
                type="button"
                onClick={() => onDayClick(day)}
                className={cn(
                  'flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-left transition-colors hover:bg-accent/60',
                  isTodayCell && 'bg-primary/5'
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                      isTodayCell
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-foreground'
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {WEEKDAYS[day.getDay()]}
                  </span>
                </div>
                {items.length > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    {items.length}
                  </Badge>
                )}
              </button>

              {/* items */}
              <div className="flex-1 space-y-2 overflow-y-auto p-2 scrollbar-thin">
                {items.length === 0 ? (
                  <div className="flex h-full min-h-[80px] items-center justify-center text-[10px] text-muted-foreground/60">
                    No deadlines
                  </div>
                ) : (
                  items.map((e) => (
                    <WeekCard key={e.id} engagement={e} onOpen={() => onDayClick(day)} />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function WeekCard({
  engagement: e,
  onOpen,
}: {
  engagement: CalendarEngagement
  onOpen: () => void
}) {
  const name = e.client?.name || 'Unknown'
  const today = new Date()
  const dd = safeDate(e.deadline)
  const days = dd ? differenceInDays(startOfDay(dd), startOfDay(today)) : 0
  const pastDue = days < 0

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'w-full rounded-lg border bg-card p-2 text-left transition-all hover:shadow-sm hover:border-primary/40',
        pastDue
          ? 'border-red-300/80 dark:border-red-900/60'
          : 'border-border'
      )}
    >
      <div className="flex items-center justify-between gap-1.5">
        <span
          className={cn(
            'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset',
            getTypeBadgeClass(e.engagementType)
          )}
        >
          {e.engagementType}
        </span>
        <span className={cn('h-2 w-2 shrink-0 rounded-full', PRIORITY_DOT[e.priority])} />
      </div>
      <p className="mt-1 truncate text-xs font-semibold">{name}</p>
      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{e.assignedTo?.name ? getInitials(e.assignedTo.name) : '—'}</span>
        <span
          className={cn(
            'font-semibold',
            pastDue
              ? 'text-red-600 dark:text-red-400'
              : days <= 3
              ? 'text-amber-600 dark:text-amber-400'
              : ''
          )}
        >
          {pastDue ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d left`}
        </span>
      </div>
      {/* progress */}
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', getProgressColor(e.progress))}
          style={{ width: `${Math.min(100, Math.max(0, e.progress))}%` }}
        />
      </div>
    </button>
  )
}

/* ----------------------------- List view ----------------------------- */

function ListView({
  engagements,
  sortMode,
  onRowClick,
  onOpenEngagement,
}: {
  engagements: CalendarEngagement[]
  sortMode: SortMode
  onRowClick: (d: Date) => void
  onOpenEngagement: (id: string) => void
}) {
  const today = startOfDay(new Date())

  const rows = useMemo(() => {
    const withMeta = engagements
      .map((e) => {
        const dd = safeDate(e.deadline)!
        const days = differenceInDays(startOfDay(dd), today)
        return { e, dd, days, pastDue: days < 0 }
      })
      .filter((r) => r.dd)

    if (sortMode === 'priority') {
      withMeta.sort((a, b) => {
        if (a.pastDue && !b.pastDue) return -1
        if (!a.pastDue && b.pastDue) return 1
        if (a.pastDue) {
          // both past due: most overdue first
          return a.dd.getTime() - b.dd.getTime()
        }
        const p = PRIORITY_RANK[a.e.priority] - PRIORITY_RANK[b.e.priority]
        if (p !== 0) return p
        return a.dd.getTime() - b.dd.getTime()
      })
    } else {
      withMeta.sort((a, b) => {
        if (a.pastDue && !b.pastDue) return -1
        if (!a.pastDue && b.pastDue) return 1
        return a.dd.getTime() - b.dd.getTime()
      })
    }
    return withMeta
  }, [engagements, sortMode, today])

  if (rows.length === 0) {
    return <EmptyState />
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="hidden grid-cols-12 gap-3 border-b bg-muted/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
        <div className="col-span-2">Date</div>
        <div className="col-span-3">Client</div>
        <div className="col-span-1">Type</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-1">Priority</div>
        <div className="col-span-2">Days Remaining</div>
        <div className="col-span-1 text-right">Open</div>
      </div>
      <div className="divide-y divide-border">
        {rows.map(({ e, dd, days, pastDue }) => (
          <ListViewRow
            key={e.id}
            engagement={e}
            deadline={dd}
            days={days}
            pastDue={pastDue}
            onRowClick={() => onRowClick(dd)}
            onOpen={() => onOpenEngagement(e.id)}
          />
        ))}
      </div>
    </Card>
  )
}

function ListViewRow({
  engagement: e,
  deadline,
  days,
  pastDue,
  onRowClick,
  onOpen,
}: {
  engagement: CalendarEngagement
  deadline: Date
  days: number
  pastDue: boolean
  onRowClick: () => void
  onOpen: () => void
}) {
  const name = e.client?.name || 'Unknown'

  const dayLabel = pastDue
    ? `${Math.abs(days)}d overdue`
    : days === 0
    ? 'Due today'
    : days === 1
    ? '1 day left'
    : `${days}d left`

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onRowClick}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault()
          onRowClick()
        }
      }}
      className={cn(
        'grid cursor-pointer grid-cols-12 items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent/50 focus-visible:bg-accent/60 focus-visible:outline-none',
        pastDue && 'bg-red-50/40 dark:bg-red-950/10'
      )}
    >
      {/* date */}
      <div className="col-span-12 flex items-center gap-3 md:col-span-2">
        <div
          className={cn(
            'flex h-10 w-10 flex-col items-center justify-center rounded-lg border text-center leading-none',
            pastDue
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300'
              : 'border-border bg-card'
          )}
        >
          <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            {format(deadline, 'MMM')}
          </span>
          <span className="text-base font-bold tabular-nums">{format(deadline, 'd')}</span>
        </div>
        <div className="md:hidden">
          <p className="text-sm font-semibold">{name}</p>
          <p className="text-xs text-muted-foreground">
            {e.engagementType} · {format(deadline, 'MMM d, yyyy')}
          </p>
        </div>
      </div>

      {/* client */}
      <div className="col-span-12 hidden min-w-0 md:col-span-3 md:block">
        <p className="truncate font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {e.assignedTo?.name ? `Assigned to ${e.assignedTo.name}` : 'Unassigned'}
        </p>
      </div>

      {/* type */}
      <div className="col-span-6 hidden md:col-span-1 md:block">
        <span
          className={cn(
            'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset',
            getTypeBadgeClass(e.engagementType)
          )}
        >
          {e.engagementType}
        </span>
      </div>

      {/* status */}
      <div className="col-span-6 hidden md:col-span-2 md:block">
        <StatusBadge status={e.status} />
      </div>

      {/* priority */}
      <div className="col-span-6 hidden md:col-span-1 md:block">
        <PriorityBadge priority={e.priority} />
      </div>

      {/* days */}
      <div className="col-span-12 md:col-span-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
            pastDue || days <= 3
              ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
              : days <= 7
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300'
          )}
        >
          <Clock className="h-3 w-3" />
          {dayLabel}
        </span>
      </div>

      {/* open */}
      <div className="col-span-12 flex justify-start md:col-span-1 md:justify-end">
        <Button
          size="sm"
          variant="ghost"
          onClick={(ev) => {
            ev.stopPropagation()
            onOpen()
          }}
          className="h-8 gap-1.5 text-xs"
        >
          Open
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

/* ----------------------------- Detail Panel ----------------------------- */

function DeadlineDetailPanel({
  open,
  onOpenChange,
  date,
  items,
  onOpenEngagement,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  date: Date | null
  items: CalendarEngagement[]
  onOpenEngagement: (id: string) => void
}) {
  const today = startOfDay(new Date())
  const isTodayCell = date ? isToday(date) : false
  const pastDue = date ? isBefore(startOfDay(date), today) : false

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md md:max-w-lg">
        <SheetHeader className="gap-1.5 border-b px-5 py-4">
          <SheetTitle className="flex items-center gap-3 text-lg">
            {date && (
              <>
                <span
                  className={cn(
                    'inline-flex h-10 w-10 items-center justify-center rounded-lg text-base font-bold',
                    isTodayCell
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : pastDue
                      ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                      : 'bg-muted text-foreground'
                  )}
                >
                  {format(date, 'd')}
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {format(date, 'EEEE')}
                  </span>
                  <span>{format(date, 'MMM d, yyyy')}</span>
                </span>
              </>
            )}
          </SheetTitle>
          <SheetDescription>
            {items.length === 0
              ? 'No deadlines on this day.'
              : `${items.length} deadline${items.length === 1 ? '' : 's'} due`}
            {pastDue && items.length > 0 && ' · Past due'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60">
                <CalendarCheck className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold">Nothing due</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This day is clear. Pick another day to see deadlines.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((e) => (
                <DetailCard key={e.id} engagement={e} onOpen={() => onOpenEngagement(e.id)} />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function DetailCard({
  engagement: e,
  onOpen,
}: {
  engagement: CalendarEngagement
  onOpen: () => void
}) {
  const today = startOfDay(new Date())
  const dd = safeDate(e.deadline)!
  const days = differenceInDays(startOfDay(dd), today)
  const pastDue = days < 0
  const name = e.client?.name || 'Unknown'

  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md',
        pastDue ? 'border-red-200 dark:border-red-900/50' : 'border-border'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset',
                getTypeBadgeClass(e.engagementType)
              )}
            >
              {e.engagementType}
            </span>
            <span className="text-[10px] text-muted-foreground">TY {e.taxYear}</span>
          </div>
          <p className="mt-1.5 truncate text-sm font-semibold">{name}</p>
        </div>
        <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', PRIORITY_DOT[e.priority])} />
      </div>

      {/* assigned + status */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={e.status} />
        <PriorityBadge priority={e.priority} />
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
            pastDue || days <= 3
              ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
              : days <= 7
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300'
          )}
        >
          <Clock className="h-3 w-3" />
          {pastDue ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d left`}
        </span>
      </div>

      {/* progress */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Progress</span>
          <span className="font-semibold tabular-nums">{e.progress || 0}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-all', getProgressColor(e.progress))}
            style={{ width: `${Math.min(100, Math.max(0, e.progress))}%` }}
          />
        </div>
      </div>

      {/* assigned to */}
      {e.assignedTo?.name && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-primary text-[10px] font-bold text-white">
            {getInitials(e.assignedTo.name)}
          </span>
          <span>
            Assigned to{' '}
            <span className="font-medium text-foreground">{e.assignedTo.name}</span>
          </span>
        </div>
      )}

      <Button size="sm" className="mt-4 w-full gap-1.5" onClick={onOpen}>
        Open Engagement
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

/* ----------------------------- Skeleton & Empty ----------------------------- */

function CalendarSkeleton({ mode }: { mode: CalendarMode }) {
  if (mode === 'list') {
    return (
      <Card className="overflow-hidden p-0">
        <div className="space-y-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-12 items-center gap-3 border-b px-4 py-3 last:border-b-0"
            >
              <Skeleton className="col-span-2 h-10 w-10 rounded-lg" />
              <Skeleton className="col-span-3 h-5" />
              <Skeleton className="col-span-1 h-5" />
              <Skeleton className="col-span-2 h-5" />
              <Skeleton className="col-span-1 h-5" />
              <Skeleton className="col-span-2 h-5" />
              <Skeleton className="col-span-1 h-8" />
            </div>
          ))}
        </div>
      </Card>
    )
  }
  if (mode === 'week') {
    return (
      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-7 md:divide-x md:divide-y-0">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="min-h-[160px] p-2 md:min-h-[440px]">
              <Skeleton className="h-7 w-full" />
              <div className="mt-2 space-y-2">
                {Array.from({ length: 2 }).map((_, j) => (
                  <Skeleton key={j} className="h-16 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    )
  }
  return (
    <Card className="overflow-hidden p-0">
      <div className="grid grid-cols-7">
        {Array.from({ length: 35 }).map((_, i) => (
          <div
            key={i}
            className="min-h-[88px] border-b border-r border-border p-2 sm:min-h-[112px]"
          >
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="mt-2 h-4" />
            <Skeleton className="mt-1 h-4" />
          </div>
        ))}
      </div>
    </Card>
  )
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <CalendarCheck className="h-8 w-8 text-primary" />
      </div>
      <div>
        <p className="text-base font-semibold">No deadlines to track</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Engagements with a filing deadline and an active status will appear here.
          Add deadlines to your engagements to see them on the calendar.
        </p>
      </div>
    </Card>
  )
}
