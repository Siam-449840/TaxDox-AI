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
import { formatDistanceToNow, format } from 'date-fns'

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
      <div className="relative overflow-hidden rounded-xl border bg-gradient-primary p-5 text-white shadow-sm sm:p-6">
        {/* Decorative pattern */}
        <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden>
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -bottom-24 right-32 h-48 w-48 rounded-full bg-cyan-300/30 blur-3xl" />
        </div>
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
                    'group flex w-full items-center gap-3 p-4 text-left transition-all hover:bg-muted/50',
                    e.priority === 'high'
                      ? 'border-l-2 border-l-red-400'
                      : e.priority === 'medium'
                        ? 'border-l-2 border-l-amber-400'
                        : 'border-l-2 border-l-slate-200 dark:border-l-slate-700'
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
                className="group flex w-full items-center gap-3 p-4 text-left transition-all hover:bg-muted/50"
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
