'use client'

import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  FileText,
  DollarSign,
  ArrowRight,
  Activity as ActivityIcon,
  CalendarClock,
  Zap,
  Target,
  Plus,
  BarChart3,
  Sparkles,
  Flame,
  Upload,
  UserPlus,
  Send,
  CalendarDays,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { StatCard } from '@/components/shared/stat-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { ProgressRing } from '@/components/shared/progress-ring'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import { formatDistanceToNow, format, differenceInCalendarDays } from 'date-fns'

interface DashboardData {
  stats: {
    active: number
    pending: number
    done: number
    alerts: number
    totalClients: number
    totalDocuments: number
    totalPbcItems: number
    totalRevenue: number
    collectedRevenue: number
    avgConfidence: number
    verifiedExtractions: number
    totalExtractions: number
  }
  statusCounts: Record<string, number>
  typeCounts: Record<string, number>
  docsByStatus: Record<string, number>
  teamWorkload: Array<{
    id: string
    name: string
    role: string
    capacity: number
    currentLoad: number
    utilization: number
    color: string
    avatar?: string
  }>
  recentEngagements: Array<{
    id: string
    clientName: string
    clientType: string
    engagementType: string
    taxYear: number
    status: string
    progress: number
    priority: string
    deadline: string
    assignedTo?: string
  }>
  recentActivities: Array<{
    id: string
    type: string
    description: string
    actor: string
    createdAt: string
    clientName?: string
  }>
  upcomingDeadlines: Array<{
    id: string
    clientName: string
    engagementType: string
    deadline: string
    priority: string
    progress: number
    daysLeft: number
  }>
}

const STATUS_COLORS: Record<string, string> = {
  created: '#94a3b8',
  pbc_sent: '#3b82f6',
  collecting: '#f59e0b',
  processing: '#8b5cf6',
  review: '#6366f1',
  filing: '#06b6d4',
  done: '#10b981',
}

const TYPE_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

const ACTIVITY_STYLES: Record<
  string,
  { icon: typeof ActivityIcon; bg: string; text: string }
> = {
  upload: {
    icon: FileText,
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-600 dark:text-blue-400',
  },
  classify: {
    icon: Zap,
    bg: 'bg-violet-50 dark:bg-violet-950/40',
    text: 'text-violet-600 dark:text-violet-400',
  },
  extract: {
    icon: Target,
    bg: 'bg-teal-50 dark:bg-teal-950/40',
    text: 'text-teal-600 dark:text-teal-400',
  },
  verify: {
    icon: CheckCircle2,
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  send: {
    icon: FileText,
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-600 dark:text-amber-400',
  },
  message: {
    icon: Users,
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-sky-600 dark:text-sky-400',
  },
  status_change: {
    icon: ActivityIcon,
    bg: 'bg-slate-100 dark:bg-slate-800/60',
    text: 'text-slate-600 dark:text-slate-300',
  },
}

function teamColorHex(color: string): string {
  switch (color) {
    case 'emerald':
      return '#10b981'
    case 'blue':
      return '#3b82f6'
    case 'amber':
      return '#f59e0b'
    case 'violet':
      return '#8b5cf6'
    case 'cyan':
      return '#06b6d4'
    default:
      return '#f43f5e'
  }
}

function daysUntil(dateStr: string): number {
  const ms = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

export function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const openEngagement = useAppStore((s) => s.openEngagement)
  const navigate = useAppStore((s) => s.navigate)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading || !data) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-28 w-full animate-pulse rounded-xl bg-muted" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  const statusData = Object.entries(data.statusCounts).map(([name, value]) => ({
    name,
    value,
    color: STATUS_COLORS[name] || '#94a3b8',
  }))

  const typeData = Object.entries(data.typeCounts).map(([name, value], i) => ({
    name,
    value,
    color: TYPE_COLORS[i % TYPE_COLORS.length],
  }))

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-xl border border-primary/10 bg-gradient-primary p-5 text-white shadow-lg shadow-primary/20 sm:p-6">
        {/* Decorative pattern */}
        <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden>
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -bottom-24 right-32 h-48 w-48 rounded-full bg-cyan-300/30 blur-3xl" />
        </div>
        {/* Subtle top highlight */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-white/80" />
              <p className="text-xs font-medium uppercase tracking-wider text-white/80">
                {format(new Date(), 'EEEE, MMMM d')}
              </p>
            </div>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">
              Welcome back, Sarah
            </h1>
            <p className="mt-1.5 text-sm text-white/85">
              {data.stats.alerts > 0 ? (
                <>
                  <span className="font-semibold text-white">
                    {data.stats.alerts} engagement{data.stats.alerts === 1 ? '' : 's'}
                  </span>{' '}
                  need attention today ·{' '}
                  <span className="font-semibold text-white">{data.stats.active}</span> active ·{' '}
                  <span className="font-semibold text-white">{data.stats.pending}</span> pending collection
                </>
              ) : (
                <>
                  <span className="font-semibold text-white">{data.stats.active}</span> active engagements ·{' '}
                  <span className="font-semibold text-white">{data.stats.pending}</span> pending collection · all caught up
                </>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('reports')}
              className="border-0 bg-white/15 text-white backdrop-blur-sm hover:bg-white/25 hover:text-white"
            >
              <BarChart3 className="mr-1.5 h-4 w-4" />
              View Reports
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('engagements')}
              className="border-0 bg-white text-primary shadow-sm hover:bg-white/90 hover:text-primary"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New Engagement
            </Button>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
        <StatCard
          label="Active Engagements"
          value={data.stats.active}
          icon={LayoutDashboard}
          trend={{ value: 12, label: 'vs last month' }}
          accent="primary"
          className="transition-all hover:-translate-y-0.5 hover:shadow-md"
        />
        <StatCard
          label="Pending Collection"
          value={data.stats.pending}
          icon={Clock}
          accent="warning"
          className="transition-all hover:-translate-y-0.5 hover:shadow-md"
        />
        <StatCard
          label="Completed"
          value={data.stats.done}
          icon={CheckCircle2}
          trend={{ value: 8, label: 'vs last month' }}
          accent="success"
          className="transition-all hover:-translate-y-0.5 hover:shadow-md"
        />
        <StatCard
          label="Needs Attention"
          value={data.stats.alerts}
          icon={AlertTriangle}
          accent="danger"
          className={cn(
            'transition-all hover:-translate-y-0.5 hover:shadow-md',
            data.stats.alerts > 0 && 'ring-2 ring-red-400/60 ring-offset-2 ring-offset-background'
          )}
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
        <Card className="group relative flex items-center gap-3 overflow-hidden p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
          <span className="absolute left-0 top-0 h-full w-1 bg-blue-500" aria-hidden />
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums">{data.stats.totalClients}</p>
            <p className="text-xs text-muted-foreground">Total Clients</p>
          </div>
        </Card>
        <Card className="group relative flex items-center gap-3 overflow-hidden p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
          <span className="absolute left-0 top-0 h-full w-1 bg-violet-500" aria-hidden />
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums">{data.stats.totalDocuments}</p>
            <p className="text-xs text-muted-foreground">Documents</p>
          </div>
        </Card>
        <Card className="group relative flex items-center gap-3 overflow-hidden p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
          <span className="absolute left-0 top-0 h-full w-1 bg-emerald-500" aria-hidden />
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums">{data.stats.avgConfidence}%</p>
            <p className="text-xs text-muted-foreground">AI Accuracy</p>
          </div>
        </Card>
        <Card className="group relative flex items-center gap-3 overflow-hidden p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
          <span className="absolute left-0 top-0 h-full w-1 bg-amber-500" aria-hidden />
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums">
              ${(data.stats.totalRevenue / 1000).toFixed(1)}k
            </p>
            <p className="text-xs text-muted-foreground">Engagement Value</p>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2.5 border-b bg-gradient-to-r from-primary/5 to-transparent p-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Quick Actions</h2>
            <p className="text-xs text-muted-foreground">Jump straight to common tasks</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
          {([
            { label: 'New Engagement', icon: Plus, view: 'engagements' as const },
            { label: 'Upload Document', icon: Upload, view: 'documents' as const },
            { label: 'Add Client', icon: UserPlus, view: 'clients' as const },
            { label: 'Send PBC Reminders', icon: Send, view: 'engagements' as const },
            { label: 'View Calendar', icon: CalendarDays, view: 'calendar' as const },
            { label: 'View Reports', icon: BarChart3, view: 'reports' as const },
          ]).map(({ label, icon: Icon, view }) => (
            <button
              key={label}
              onClick={() => navigate(view)}
              title={label}
              className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-border/60 bg-card p-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-teal-600 transition-colors group-hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-400 dark:group-hover:bg-teal-900/60">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="text-sm font-medium leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Recent Engagements */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b p-4">
            <div>
              <h2 className="text-base font-semibold">Recent Engagements</h2>
              <p className="text-xs text-muted-foreground">Latest tax preparation activity</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('engagements')} className="transition-colors">
              View all
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="divide-y">
            {data.recentEngagements.map((e) => {
              const d = daysUntil(e.deadline)
              const hasDeadline = !Number.isNaN(d)
              return (
                <button
                  key={e.id}
                  onClick={() => openEngagement(e.id)}
                  title={`${e.clientName} — ${e.engagementType} ${e.taxYear} · ${e.progress}% complete`}
                  className={cn(
                    'group flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/60',
                    e.priority === 'high'
                      ? 'border-l-2 border-l-red-400 dark:border-l-red-500'
                      : e.priority === 'medium'
                        ? 'border-l-2 border-l-amber-400 dark:border-l-amber-500'
                        : 'border-l-2 border-l-transparent'
                  )}
                >
                  <ProgressRing value={e.progress} size={52} strokeWidth={5} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{e.clientName}</p>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {e.engagementType} · {e.taxYear}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusBadge status={e.status} />
                      <PriorityBadge priority={e.priority as 'high' | 'medium' | 'low'} />
                      {e.assignedTo && (
                        <span className="text-xs text-muted-foreground">· {e.assignedTo}</span>
                      )}
                    </div>
                  </div>
                  {hasDeadline && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'shrink-0 border-0 text-[10px] font-semibold tabular-nums',
                        d < 0
                          ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                          : d <= 3
                            ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                            : d <= 7
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                              : 'bg-muted text-muted-foreground'
                      )}
                      title={`Due ${format(new Date(e.deadline), 'MMM d, yyyy')}`}
                    >
                      {d < 0 ? `${Math.abs(d)}d overdue` : `${d}d left`}
                    </Badge>
                  )}
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              )
            })}
          </div>
        </Card>

        {/* Upcoming Deadlines */}
        <Card>
          <div className="border-b p-4">
            <h2 className="text-base font-semibold">Upcoming Deadlines</h2>
            <p className="text-xs text-muted-foreground">Closest filing dates</p>
          </div>
          <div className="divide-y">
            {data.upcomingDeadlines.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No upcoming deadlines
              </div>
            )}
            {data.upcomingDeadlines.map((d) => (
              <button
                key={d.id}
                onClick={() => openEngagement(d.id)}
                title={`${d.clientName} — ${d.engagementType} · ${d.progress}% complete · ${d.daysLeft}d left`}
                className={cn(
                  'group flex w-full items-center gap-3 p-4 text-left transition-all hover:bg-muted/50',
                  d.daysLeft <= 3
                    ? 'border-l-2 border-l-red-400 dark:border-l-red-500'
                    : d.daysLeft <= 7
                      ? 'border-l-2 border-l-amber-400 dark:border-l-amber-500'
                      : 'border-l-2 border-l-transparent'
                )}
              >
                <div
                  className={cn(
                    'flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg transition-transform group-hover:scale-105',
                    d.daysLeft <= 3
                      ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                      : d.daysLeft <= 7
                        ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                        : 'bg-muted text-muted-foreground'
                  )}
                >
                  <CalendarClock className="h-4 w-4" />
                  <span className="text-[10px] font-bold">{d.daysLeft}d</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{d.clientName}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{d.engagementType}</Badge>
                    <span className="text-xs text-muted-foreground">{d.progress}% done</span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </Card>

        {/* ─── Deadline Timeline (spans 2 of 3 columns) ─── */}
        <DeadlineTimelineCard
          deadlines={data.upcomingDeadlines}
          onOpen={openEngagement}
          onViewCalendar={() => navigate('calendar')}
        />

        {/* ─── Deadline Health (companion, 1 of 3 columns) ─── */}
        <DeadlineHealthCard deadlines={data.upcomingDeadlines} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Status Distribution */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Engagement Status</h2>
          <p className="mb-3 text-xs text-muted-foreground">Current pipeline distribution</p>
          <div className="relative">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={84}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="var(--card)"
                  strokeWidth={2}
                >
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
              aria-hidden
            >
              <span className="text-2xl font-bold tabular-nums">
                {statusData.reduce((sum, s) => sum + s.value, 0)}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Total
              </span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {statusData.map((s) => (
              <div
                key={s.name}
                className="flex items-center gap-1.5 text-xs transition-colors hover:bg-muted/40 rounded px-1 py-0.5"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="capitalize text-muted-foreground">{s.name.replace('_', ' ')}</span>
                <span className="ml-auto font-semibold tabular-nums">{s.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Return Type Distribution */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Return Types</h2>
          <p className="mb-3 text-xs text-muted-foreground">Engagement mix by form</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={typeData}
                cx="50%"
                cy="50%"
                outerRadius={72}
                dataKey="value"
                label={({ percent }) =>
                  `${((percent as number) * 100).toFixed(0)}%`
                }
                labelLine={false}
                fontSize={11}
                stroke="var(--card)"
                strokeWidth={2}
              >
                {typeData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1.5">
            {typeData.map((t) => {
              const total = typeData.reduce((sum, x) => sum + x.value, 0)
              const pct = total > 0 ? Math.round((t.value / total) * 100) : 0
              return (
                <div
                  key={t.name}
                  className="flex items-center gap-2 rounded px-1 py-0.5 text-xs transition-colors hover:bg-muted/40"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                  <span className="font-medium">{t.name}</span>
                  <span className="ml-auto tabular-nums text-muted-foreground">
                    {t.value} · {pct}%
                  </span>
                </div>
              )
            })}
          </div>
        </Card>

        {/* AI Extraction Stats */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold">AI Extraction Quality</h2>
          <p className="mb-3 text-xs text-muted-foreground">Confidence & verification</p>
          <div className="relative flex flex-col items-center justify-center py-3">
            <div className="relative flex items-center justify-center">
              <div
                className="absolute h-32 w-32 rounded-full bg-emerald-500/15 blur-3xl"
                aria-hidden
              />
              <ProgressRing
                value={data.stats.avgConfidence}
                size={140}
                strokeWidth={12}
                color="#10b981"
                className="relative"
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Average confidence</p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-t pt-3">
            <div className="text-center">
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {data.stats.verifiedExtractions}
              </p>
              <p className="text-[10px] text-muted-foreground">Verified</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                {data.stats.totalExtractions - data.stats.verifiedExtractions}
              </p>
              <p className="text-[10px] text-muted-foreground">Needs Review</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Team Workload + Activity */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Team Workload */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Team Workload</h2>
              <p className="text-xs text-muted-foreground">Current capacity utilization</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('settings')} className="transition-colors">
              Manage
            </Button>
          </div>
          <div className="space-y-2">
            {data.teamWorkload.map((t) => (
              <div
                key={t.id}
                title={`${t.name} — ${t.role}: ${t.currentLoad} of ${t.capacity} engagements (${t.utilization}% utilized)`}
                className="group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50"
              >
                <div
                  className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
                  style={{ backgroundColor: teamColorHex(t.color) }}
                >
                  {t.name.split(' ').map((n) => n[0]).join('')}
                  {t.utilization >= 90 && (
                    <span
                      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white ring-2 ring-card"
                      title="At or near capacity"
                    >
                      <Flame className="h-2.5 w-2.5" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{t.role}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {t.utilization >= 90 && <Flame className="h-3.5 w-3.5 text-red-500" />}
                      <span
                        className={cn(
                          'text-xs font-medium tabular-nums',
                          t.utilization >= 90
                            ? 'text-red-600 dark:text-red-400'
                            : t.utilization >= 75
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-muted-foreground'
                        )}
                      >
                        {t.currentLoad}/{t.capacity}
                      </span>
                    </div>
                  </div>
                  <div
                    className="relative mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={t.utilization}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        t.utilization >= 90
                          ? 'bg-gradient-to-r from-red-500 to-rose-500'
                          : t.utilization >= 75
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                      )}
                      style={{
                        width: `${Math.min(100, Math.max(0, t.utilization))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Recent Activity</h2>
          <p className="mb-3 text-xs text-muted-foreground">Latest events across all engagements</p>
          <ScrollArea className="h-[300px] pr-3">
            <div className="relative space-y-4 pl-0.5">
              {/* Vertical timeline line */}
              {data.recentActivities.length > 1 && (
                <div
                  className="absolute left-[18px] top-4 bottom-4 w-px bg-border"
                  aria-hidden
                />
              )}
              {data.recentActivities.map((a) => {
                const style = ACTIVITY_STYLES[a.type] || {
                  icon: ActivityIcon,
                  bg: 'bg-muted',
                  text: 'text-muted-foreground',
                }
                const Icon = style.icon
                return (
                  <div key={a.id} className="relative flex gap-3">
                    <div
                      className={cn(
                        'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ring-border',
                        style.bg
                      )}
                    >
                      <Icon className={cn('h-4 w-4', style.text)} />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-sm leading-snug">{a.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/70">{a.actor}</span>
                        <span className="mx-1">·</span>
                        <span>{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</span>
                        {a.clientName && (
                          <>
                            <span className="mx-1">·</span>
                            <span>{a.clientName}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Deadline Timeline Widget
//
// Renders the next N upcoming deadlines as color-coded dots on a
// horizontal timeline. Dot size scales with the number of deadlines
// falling on the same day; hover reveals a tooltip with client,
// engagement type, due date, and days remaining. A red warning banner
// appears at the top when any deadline is already overdue.
// ─────────────────────────────────────────────────────────────────

interface DeadlineItem {
  id: string
  clientName: string
  engagementType: string
  deadline: string
  priority: string
  progress: number
  daysLeft: number
}

const PRIORITY_STYLES: Record<
  string,
  { dot: string; ring: string; shadow: string; label: string }
> = {
  high: {
    dot: 'bg-red-500',
    ring: 'ring-red-200 dark:ring-red-950/60',
    shadow: 'shadow-red-500/40',
    label: 'High',
  },
  medium: {
    dot: 'bg-amber-500',
    ring: 'ring-amber-200 dark:ring-amber-950/60',
    shadow: 'shadow-amber-500/40',
    label: 'Medium',
  },
  low: {
    dot: 'bg-slate-400',
    ring: 'ring-slate-200 dark:ring-slate-800',
    shadow: 'shadow-slate-500/30',
    label: 'Low',
  },
}

function dotSizeClass(count: number): string {
  if (count >= 3) return 'h-7 w-7'
  if (count === 2) return 'h-6 w-6'
  return 'h-5 w-5'
}

function DeadlineTimelineCard({
  deadlines,
  onOpen,
  onViewCalendar,
}: {
  deadlines: DeadlineItem[]
  onOpen: (id: string) => void
  onViewCalendar: () => void
}) {
  // Empty state — no deadlines to plot.
  if (deadlines.length === 0) {
    return (
      <Card className="lg:col-span-2 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarClock className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Upcoming Deadline Timeline</h2>
              <p className="text-xs text-muted-foreground">No deadlines to display</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <CalendarClock className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">All caught up</p>
          <p className="text-xs text-muted-foreground">
            No upcoming deadlines in the next 14 days.
          </p>
        </div>
      </Card>
    )
  }

  // Sort ascending by deadline date so the closest is on the left.
  const sorted = [...deadlines].sort(
    (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
  )

  // Compute the date range and clamp to avoid divide-by-zero.
  const times = sorted.map((d) => new Date(d.deadline).getTime())
  const minTime = Math.min(...times)
  const maxTime = Math.max(...times)
  const range = Math.max(1, maxTime - minTime)

  // Count deadlines per day so dots can scale up when several fall on
  // the same day, and track each item's index within its day to allow
  // vertical stacking.
  const dayCounts = new Map<string, number>()
  const dayIndex = new Map<string, number>()
  for (const d of sorted) {
    const key = format(new Date(d.deadline), 'yyyy-MM-dd')
    dayCounts.set(key, (dayCounts.get(key) || 0) + 1)
  }

  const overdueCount = sorted.filter((d) => d.daysLeft < 0).length

  // Pre-compute each dot's position, size, and vertical offset.
  const positioned = sorted.map((d) => {
    const t = new Date(d.deadline).getTime()
    const pct = ((t - minTime) / range) * 100
    const key = format(new Date(d.deadline), 'yyyy-MM-dd')
    const count = dayCounts.get(key) || 1
    const idx = dayIndex.get(key) || 0
    dayIndex.set(key, idx + 1)
    // When several dots land on the same day, spread them vertically
    // across the timeline band so they don't fully overlap.
    const verticalOffset =
      count > 1 ? (idx - (count - 1) / 2) * 26 : 0
    return { ...d, pct, count, verticalOffset }
  })

  // "Today" marker — only render if today falls inside the visible range.
  const nowTime = Date.now()
  const todayPct = ((nowTime - minTime) / range) * 100
  const showToday = todayPct >= 0 && todayPct <= 100

  return (
    <Card className="lg:col-span-2 p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Upcoming Deadline Timeline</h2>
            <p className="text-xs text-muted-foreground">
              Next {sorted.length} deadline{sorted.length === 1 ? '' : 's'} ·
              click a dot to open
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onViewCalendar} className="text-xs">
          Calendar
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Overdue warning banner */}
      {overdueCount > 0 && (
        <div
          role="alert"
          className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse" />
          <span>
            <strong className="font-semibold">{overdueCount}</strong>{' '}
            {overdueCount === 1 ? 'deadline is' : 'deadlines are'} overdue!
          </span>
          <span className="ml-auto hidden text-xs text-red-700/80 dark:text-red-300/80 sm:inline">
            Send reminders now →
          </span>
        </div>
      )}

      {/* Timeline canvas */}
      <div className="relative overflow-x-auto pb-2">
        <div className="relative h-36 min-w-[460px]">
          {/* The horizontal axis line */}
          <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-border to-transparent" />

          {/* "Today" vertical marker */}
          {showToday && (
            <div
              className="pointer-events-none absolute top-1/2 z-10 h-28 -translate-y-1/2"
              style={{ left: `${todayPct}%` }}
            >
              <div className="relative flex h-full -translate-x-1/2 flex-col items-center">
                <span className="mb-1 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground shadow-sm">
                  Today
                </span>
                <div className="w-px flex-1 bg-primary/30" />
              </div>
            </div>
          )}

          {/* Deadline dots */}
          {positioned.map((d) => {
            const style = PRIORITY_STYLES[d.priority] || PRIORITY_STYLES.low
            const size = dotSizeClass(d.count)
            const isOverdue = d.daysLeft < 0
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onOpen(d.id)}
                className="group absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 focus:outline-none"
                style={{
                  left: `${d.pct}%`,
                  marginTop: `${d.verticalOffset}px`,
                }}
                aria-label={`${d.clientName} — ${d.engagementType}, ${d.daysLeft < 0 ? `${Math.abs(d.daysLeft)} days overdue` : `${d.daysLeft} days left`}`}
              >
                {/* The dot */}
                <span
                  className={cn(
                    'block rounded-full ring-4 transition-all duration-200 group-hover:scale-125 group-hover:shadow-lg',
                    style.dot,
                    style.ring,
                    style.shadow,
                    size,
                    isOverdue && 'animate-pulse ring-red-300/60 dark:ring-red-900/80'
                  )}
                />
                {/* Tooltip on hover */}
                <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden -translate-x-1/2 group-hover:block">
                  <span className="block min-w-[200px] rounded-lg border bg-popover p-2.5 text-left shadow-xl">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold">
                        {d.clientName}
                      </span>
                      <PriorityBadge priority={d.priority as 'high' | 'medium' | 'low'} />
                    </span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {d.engagementType} ·{' '}
                      {format(new Date(d.deadline), 'MMM d, yyyy')}
                    </span>
                    <span
                      className={cn(
                        'mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
                        isOverdue || d.daysLeft <= 3
                          ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                          : d.daysLeft <= 7
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <CalendarClock className="h-3 w-3" />
                      {isOverdue
                        ? `${Math.abs(d.daysLeft)}d overdue`
                        : `${d.daysLeft}d left`}
                    </span>
                    <span className="mt-1.5 block text-[10px] text-muted-foreground">
                      {d.progress}% complete ·{' '}
                      {differenceInCalendarDays(
                        new Date(d.deadline),
                        new Date()
                      )}{' '}
                      days from today
                    </span>
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          High priority
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          Medium priority
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
          Low priority
        </span>
        <span className="ml-auto hidden text-[10px] italic sm:inline">
          Dot size scales with deadlines per day
        </span>
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────
// Deadline Health Card — small companion to the timeline that
// summarizes counts (total, overdue, next-up) so users get the
// headline numbers at a glance.
// ─────────────────────────────────────────────────────────────────

function DeadlineHealthCard({ deadlines }: { deadlines: DeadlineItem[] }) {
  const total = deadlines.length
  const overdue = deadlines.filter((d) => d.daysLeft < 0).length
  const soon = deadlines.filter((d) => d.daysLeft >= 0 && d.daysLeft <= 3).length
  const next = [...deadlines].sort(
    (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
  )[0]

  return (
    <Card className="p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Target className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Deadline Health</h2>
          <p className="text-xs text-muted-foreground">Snapshot of upcoming work</p>
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" /> Total upcoming
          </span>
          <span className="text-sm font-bold tabular-nums">{total}</span>
        </div>

        <div
          className={cn(
            'flex items-center justify-between rounded-lg border px-3 py-2',
            overdue > 0
              ? 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40'
              : 'border-border/60 bg-muted/30'
          )}
        >
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle
              className={cn(
                'h-3.5 w-3.5',
                overdue > 0 && 'text-red-500 dark:text-red-400'
              )}
            />
            Overdue
          </span>
          <span
            className={cn(
              'text-sm font-bold tabular-nums',
              overdue > 0 && 'text-red-600 dark:text-red-400'
            )}
          >
            {overdue}
          </span>
        </div>

        <div
          className={cn(
            'flex items-center justify-between rounded-lg border px-3 py-2',
            soon > 0
              ? 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40'
              : 'border-border/60 bg-muted/30'
          )}
        >
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock
              className={cn(
                'h-3.5 w-3.5',
                soon > 0 && 'text-amber-500 dark:text-amber-400'
              )}
            />
            Due ≤ 3 days
          </span>
          <span
            className={cn(
              'text-sm font-bold tabular-nums',
              soon > 0 && 'text-amber-600 dark:text-amber-400'
            )}
          >
            {soon}
          </span>
        </div>
      </div>

      {next && (
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-primary/80">
            Next up
          </p>
          <p className="mt-1 truncate text-sm font-semibold">{next.clientName}</p>
          <p className="text-xs text-muted-foreground">
            {next.engagementType} · {format(new Date(next.deadline), 'MMM d')}
          </p>
        </div>
      )}
    </Card>
  )
}
