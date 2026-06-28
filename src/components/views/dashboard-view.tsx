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
  TrendingUp,
  ArrowRight,
  Activity as ActivityIcon,
  CalendarClock,
  Zap,
  Target,
  Plus,
  BarChart3,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { StatCard } from '@/components/shared/stat-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { ProgressRing } from '@/components/shared/progress-ring'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
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
import { formatDistanceToNow } from 'date-fns'

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

const ACTIVITY_ICONS: Record<string, typeof ActivityIcon> = {
  upload: FileText,
  classify: Zap,
  extract: Target,
  verify: CheckCircle2,
  send: FileText,
  message: Users,
  status_change: ActivityIcon,
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
        <div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back, Sarah</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here's what's happening at Meridian CPA Group today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('reports')}>
            <BarChart3 className="mr-1.5 h-4 w-4" />
            View Reports
          </Button>
          <Button size="sm" onClick={() => navigate('engagements')}>
            <Plus className="mr-1.5 h-4 w-4" />
            New Engagement
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="Active Engagements"
          value={data.stats.active}
          icon={LayoutDashboard}
          trend={{ value: 12, label: 'vs last month' }}
          accent="primary"
        />
        <StatCard
          label="Pending Collection"
          value={data.stats.pending}
          icon={Clock}
          accent="warning"
        />
        <StatCard
          label="Completed"
          value={data.stats.done}
          icon={CheckCircle2}
          trend={{ value: 8, label: 'vs last month' }}
          accent="success"
        />
        <StatCard
          label="Needs Attention"
          value={data.stats.alerts}
          icon={AlertTriangle}
          accent="danger"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums">{data.stats.totalClients}</p>
            <p className="text-xs text-muted-foreground">Total Clients</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums">{data.stats.totalDocuments}</p>
            <p className="text-xs text-muted-foreground">Documents</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums">{data.stats.avgConfidence}%</p>
            <p className="text-xs text-muted-foreground">AI Accuracy</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent Engagements */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b p-4">
            <div>
              <h2 className="text-base font-semibold">Recent Engagements</h2>
              <p className="text-xs text-muted-foreground">Latest tax preparation activity</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('engagements')}>
              View all
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="divide-y">
            {data.recentEngagements.map((e) => (
              <button
                key={e.id}
                onClick={() => openEngagement(e.id)}
                className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-muted/50"
              >
                <ProgressRing value={e.progress} size={44} />
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
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
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
                className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-muted/50"
              >
                <div
                  className={cn(
                    'flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg',
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
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Status Distribution */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold">Engagement Status</h2>
          <p className="mb-3 text-xs text-muted-foreground">Current pipeline distribution</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={2}
                dataKey="value"
              >
                {statusData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid hsl(var(--border))',
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {statusData.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5 text-xs">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="capitalize text-muted-foreground">{s.name.replace('_', ' ')}</span>
                <span className="ml-auto font-semibold">{s.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Return Type Distribution */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold">Return Types</h2>
          <p className="mb-3 text-xs text-muted-foreground">Engagement mix by form</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={typeData}
                cx="50%"
                cy="50%"
                outerRadius={75}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={false}
                fontSize={11}
              >
                {typeData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid hsl(var(--border))',
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* AI Extraction Stats */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold">AI Extraction Quality</h2>
          <p className="mb-3 text-xs text-muted-foreground">Confidence & verification</p>
          <div className="flex flex-col items-center justify-center py-4">
            <ProgressRing
              value={data.stats.avgConfidence}
              size={120}
              strokeWidth={10}
              color="#10b981"
            />
            <p className="mt-3 text-xs text-muted-foreground">Average confidence</p>
          </div>
          <div className="grid grid-cols-2 gap-2 border-t pt-3">
            <div className="text-center">
              <p className="text-lg font-bold text-emerald-600">
                {data.stats.verifiedExtractions}
              </p>
              <p className="text-[10px] text-muted-foreground">Verified</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-amber-600">
                {data.stats.totalExtractions - data.stats.verifiedExtractions}
              </p>
              <p className="text-[10px] text-muted-foreground">Needs Review</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Team Workload + Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Team Workload */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Team Workload</h2>
              <p className="text-xs text-muted-foreground">Current capacity utilization</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('settings')}>
              Manage
            </Button>
          </div>
          <div className="space-y-3">
            {data.teamWorkload.map((t) => (
              <div key={t.id} className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white',
                    `bg-${t.color}-500`
                  )}
                  style={{
                    backgroundColor:
                      t.color === 'emerald'
                        ? '#10b981'
                        : t.color === 'blue'
                          ? '#3b82f6'
                          : t.color === 'amber'
                            ? '#f59e0b'
                            : t.color === 'violet'
                              ? '#8b5cf6'
                              : t.color === 'cyan'
                                ? '#06b6d4'
                                : '#f43f5e',
                  }}
                >
                  {t.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    <span className="text-xs text-muted-foreground">
                      {t.currentLoad}/{t.capacity}
                    </span>
                  </div>
                  <Progress
                    value={t.utilization}
                    className="mt-1 h-1.5"
                    indicatorClassName={
                      t.utilization >= 90
                        ? 'bg-red-500'
                        : t.utilization >= 75
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold">Recent Activity</h2>
          <p className="mb-3 text-xs text-muted-foreground">Latest events across all engagements</p>
          <ScrollArea className="h-[280px] pr-3">
            <div className="space-y-3">
              {data.recentActivities.map((a) => {
                const Icon = ACTIVITY_ICONS[a.type] || ActivityIcon
                return (
                  <div key={a.id} className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">{a.description}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {a.actor} · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                        {a.clientName && ` · ${a.clientName}`}
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
