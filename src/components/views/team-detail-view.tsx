'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  Mail,
  Briefcase,
  DollarSign,
  TrendingUp,
  Award,
  AlertTriangle,
  Zap,
  Gauge,
  CheckCircle2,
  FolderOpen,
  CalendarClock,
  ClipboardList,
  Activity as ActivityIcon,
  Inbox,
  Loader2,
  AlertCircle,
  Clock,
  FileText,
  Send,
  Sparkles,
  RefreshCw,
  MessageSquare,
  CircleDot,
  Plus,
  Users,
  PieChart as PieChartIcon,
  BarChart3,
  Layers,
  CalendarDays,
  ArrowRight,
  UserCheck,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { StatusBadge } from '@/components/shared/status-badge'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { ProgressRing } from '@/components/shared/progress-ring'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { toast } from 'sonner'
import { format, formatDistanceToNow, differenceInDays, isValid } from 'date-fns'
import { cn } from '@/lib/utils'
import { ENGAGEMENT_TYPES } from '@/lib/constants'
import type {
  TeamMember,
  Engagement,
  Priority,
  Activity,
} from '@/lib/types'

/* ────────────────────────────────────────────────────────────────────────────
 *  Types
 * ────────────────────────────────────────────────────────────────────────── */

type AssignedUser = {
  id: string
  name: string
  role?: string
  email?: string
  image?: string | null
}

type EngagementRow = Engagement & {
  client?: { id: string; name: string; email?: string; clientType?: string }
  assignedTo?: AssignedUser | null
  _count?: {
    documents: number
    pbcItems: number
    pbcCompleted: number
    messages: number
  }
}

type ActivityRow = Activity & {
  engagement?: {
    id: string
    engagementType: string
    taxYear: number
  } | null
}

interface TeamPerf {
  name: string
  role: string
  engagements: number
  completed: number
  revenue: number
  utilization: number
  color: string
}

type TabValue = 'overview' | 'engagements' | 'workload'
type StatusFilter = 'all' | 'active' | 'completed'

/* ────────────────────────────────────────────────────────────────────────────
 *  Constants & helpers
 * ────────────────────────────────────────────────────────────────────────── */

const TEAM_COLOR_HEX: Record<string, string> = {
  emerald: '#10b981',
  blue: '#3b82f6',
  amber: '#f59e0b',
  violet: '#8b5cf6',
  cyan: '#06b6d4',
  rose: '#f43f5e',
  sky: '#0ea5e9',
  teal: '#14b8a6',
  orange: '#f97316',
  green: '#22c55e',
  pink: '#ec4899',
  red: '#ef4444',
  slate: '#64748b',
  indigo: '#6366f1',
}

function teamHex(color?: string): string {
  if (!color) return '#0d9488'
  return TEAM_COLOR_HEX[color] || '#0d9488'
}

const ENGAGEMENT_TYPE_COLORS: Record<string, string> = {
  '1040':
    'bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:ring-teal-900',
  '1065':
    'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900',
  '1120':
    'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
  '1120S':
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
  '1041':
    'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900',
}

const ENGAGEMENT_TYPE_HEX: Record<string, string> = {
  '1040': '#14b8a6',
  '1065': '#8b5cf6',
  '1120': '#f59e0b',
  '1120S': '#10b981',
  '1041': '#f43f5e',
}

const ENGAGEMENT_STATUS_BORDER: Record<string, string> = {
  created: 'border-l-slate-300 dark:border-l-slate-600',
  pbc_sent: 'border-l-blue-400 dark:border-l-blue-500',
  collecting: 'border-l-amber-400 dark:border-l-amber-500',
  processing: 'border-l-violet-400 dark:border-l-violet-500',
  review: 'border-l-cyan-400 dark:border-l-cyan-500',
  filing: 'border-l-teal-400 dark:border-l-teal-500',
  done: 'border-l-emerald-400 dark:border-l-emerald-500',
}

const ACTIVE_ENGAGEMENT_STATUSES = [
  'created',
  'pbc_sent',
  'collecting',
  'processing',
  'review',
  'filing',
]

const ACTIVITY_STYLE_MAP: Record<
  string,
  { icon: typeof CircleDot; surface: string; iconColor: string; line: string }
> = {
  upload: {
    icon: FileText,
    surface: 'bg-blue-100 dark:bg-blue-950/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
    line: 'bg-blue-200 dark:bg-blue-900',
  },
  classify: {
    icon: Sparkles,
    surface: 'bg-violet-100 dark:bg-violet-950/40',
    iconColor: 'text-violet-600 dark:text-violet-400',
    line: 'bg-violet-200 dark:bg-violet-900',
  },
  extract: {
    icon: FileText,
    surface: 'bg-teal-100 dark:bg-teal-950/40',
    iconColor: 'text-teal-600 dark:text-teal-400',
    line: 'bg-teal-200 dark:bg-teal-900',
  },
  verify: {
    icon: CheckCircle2,
    surface: 'bg-emerald-100 dark:bg-emerald-950/40',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    line: 'bg-emerald-200 dark:bg-emerald-900',
  },
  send: {
    icon: Send,
    surface: 'bg-cyan-100 dark:bg-cyan-950/40',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    line: 'bg-cyan-200 dark:bg-cyan-900',
  },
  message: {
    icon: MessageSquare,
    surface: 'bg-amber-100 dark:bg-amber-950/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    line: 'bg-amber-200 dark:bg-amber-900',
  },
  status_change: {
    icon: RefreshCw,
    surface: 'bg-slate-100 dark:bg-slate-800/60',
    iconColor: 'text-slate-600 dark:text-slate-300',
    line: 'bg-slate-200 dark:bg-slate-700',
  },
}

const DEFAULT_ACTIVITY_STYLE = {
  icon: CircleDot,
  surface: 'bg-slate-100 dark:bg-slate-800/60',
  iconColor: 'text-slate-600 dark:text-slate-300',
  line: 'bg-slate-200 dark:bg-slate-700',
}

const ACTIVITY_TITLE_MAP: Record<string, string> = {
  upload: 'Document uploaded',
  classify: 'Document classified',
  extract: 'Data extracted',
  verify: 'Field verified',
  send: 'PBC list sent',
  message: 'Message posted',
  status_change: 'Status updated',
}

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const currencyCompact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

function getInitials(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function engagementTypeLabel(type: string): string {
  return ENGAGEMENT_TYPES.find((t) => t.value === type)?.label ?? type
}

function formatFee(value: number): string {
  return currency.format(value || 0)
}

function formatFeeCompact(value: number): string {
  return currencyCompact.format(value || 0)
}

function utilizationColor(u: number): string {
  if (u >= 95) return '#ef4444'
  if (u >= 80) return '#f59e0b'
  if (u >= 50) return '#0ea5e9'
  return '#10b981'
}

function utilizationTone(u: number): 'red' | 'amber' | 'info' | 'success' {
  if (u >= 95) return 'red'
  if (u >= 80) return 'amber'
  if (u >= 50) return 'info'
  return 'success'
}

function getDeadlineState(deadline?: string | null) {
  if (!deadline) return null
  const date = new Date(deadline)
  if (!isValid(date)) return null
  const days = differenceInDays(date, new Date())
  let tone: 'red' | 'amber' | 'neutral' = 'neutral'
  if (days < 0) tone = 'red'
  else if (days <= 7) tone = 'amber'
  return { date, days, tone }
}

function formatRelative(iso: string): string {
  const d = new Date(iso)
  if (!isValid(d)) return ''
  return formatDistanceToNow(d, { addSuffix: true })
}

function titleCase(s: string): string {
  return s
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Main view
 * ────────────────────────────────────────────────────────────────────────── */

export function TeamDetailView() {
  const memberName = useAppStore((s) => s.selectedTeamMemberName)
  const navigate = useAppStore((s) => s.navigate)
  const openEngagement = useAppStore((s) => s.openEngagement)

  const [member, setMember] = useState<TeamMember | null>(null)
  const [engagements, setEngagements] = useState<EngagementRow[]>([])
  const [perf, setPerf] = useState<TeamPerf | null>(null)
  const [activities, setActivities] = useState<ActivityRow[]>([])

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState<TabValue>('overview')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [activitiesLoading, setActivitiesLoading] = useState(false)

  /* ── Fetch ─────────────────────────────────────────────────────────── */

  const fetchAll = useCallback(async () => {
    if (!memberName) {
      setLoading(false)
      return
    }
    setLoading(true)
    setNotFound(false)
    try {
      const [teamRes, engRes, reportsRes] = await Promise.all([
        fetch('/api/settings/team'),
        fetch('/api/engagements'),
        fetch('/api/reports'),
      ])

      if (!teamRes.ok) throw new Error('Failed to load team')

      const [teamJson, engJson, reportsJson] = await Promise.all([
        teamRes.json(),
        engRes.json(),
        reportsRes.json(),
      ])

      const foundMember = (teamJson.team as TeamMember[]).find(
        (t) => t.name === memberName
      )
      if (!foundMember) {
        setNotFound(true)
        setLoading(false)
        return
      }

      // Engagement.assignedTo is a User record (no color); filter by name
      const memberEngagements = ((engJson.engagements as EngagementRow[]) || []).filter(
        (e) => e.assignedTo?.name === memberName
      )

      const perfEntry = ((reportsJson.teamPerformance as TeamPerf[]) || []).find(
        (p) => p.name === memberName
      )

      setMember(foundMember)
      setEngagements(memberEngagements)
      setPerf(perfEntry || null)
      setActivities([])
      setLoading(false)
    } catch (err) {
      console.error(err)
      setNotFound(true)
      setLoading(false)
    }
  }, [memberName])

  // Fetch engagement detail records in parallel to aggregate activities.
  const fetchActivities = useCallback(async () => {
    if (!engagements.length) {
      setActivities([])
      return
    }
    setActivitiesLoading(true)
    try {
      const targets = engagements.slice(0, 25)
      const settled = await Promise.allSettled(
        targets.map((e) =>
          fetch(`/api/engagements/${e.id}`).then((r) =>
            r.ok ? r.json() : null
          )
        )
      )
      const collected: ActivityRow[] = []
      settled.forEach((res, idx) => {
        if (res.status !== 'fulfilled' || !res.value) return
        const detail = res.value.engagement
        if (!detail?.activities) return
        const eng = targets[idx]
        for (const a of detail.activities as Activity[]) {
          collected.push({
            ...a,
            engagement: {
              id: eng.id,
              engagementType: eng.engagementType,
              taxYear: eng.taxYear,
            },
          })
        }
      })
      collected.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      setActivities(collected)
    } catch (err) {
      console.error('Activity fetch failed', err)
      setActivities([])
    } finally {
      setActivitiesLoading(false)
    }
  }, [engagements])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  useEffect(() => {
    if (!loading && engagements.length > 0) {
      void fetchActivities()
    }
  }, [loading, engagements.length, fetchActivities])

  /* ── Actions ───────────────────────────────────────────────────────── */

  const handleAssignEngagement = () => {
    toast.info('Assign engagement', {
      description: `Choose an engagement to assign to ${member?.name ?? 'this member'} from the Engagements view.`,
    })
  }

  /* ── Empty / loading states ────────────────────────────────────────── */

  if (!memberName) {
    return (
      <EmptyState
        icon={<Inbox className="h-6 w-6 text-muted-foreground" />}
        title="No team member selected"
        description="Pick a team member from the Reports view to see their performance details."
        action={
          <Button variant="outline" size="sm" onClick={() => navigate('reports')}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Go to reports
          </Button>
        }
      />
    )
  }

  if (loading) return <TeamDetailSkeleton />

  if (notFound || !member) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />}
        iconWrap="bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
        title="Team member not found"
        description="This team member may have been removed or you don't have access."
        action={
          <Button variant="outline" size="sm" onClick={() => navigate('reports')}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to reports
          </Button>
        }
      />
    )
  }

  /* ── Derived stats ─────────────────────────────────────────────────── */

  const totalEngagements = perf?.engagements ?? engagements.length
  const completedCount =
    perf?.completed ??
    engagements.filter((e) => e.status === 'done').length
  const revenue =
    perf?.revenue ?? engagements.reduce((s, e) => s + (e.fee ?? 0), 0)
  const utilization =
    perf?.utilization ??
    (member.capacity > 0
      ? Math.round((member.currentLoad / member.capacity) * 100)
      : 0)
  const completionRate =
    totalEngagements > 0 ? Math.round((completedCount / totalEngagements) * 100) : 0
  const avgRevenuePerEng = totalEngagements > 0 ? revenue / totalEngagements : 0
  const activeEngagements = engagements.filter((e) =>
    ACTIVE_ENGAGEMENT_STATUSES.includes(e.status)
  ).length
  const recentActivities = activities.slice(0, 6)

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <TeamDetailHeader
        member={member}
        utilization={utilization}
        onBack={() => navigate('reports')}
        onAssign={handleAssignEngagement}
      />

      <StatsRow
        totalEngagements={totalEngagements}
        completedCount={completedCount}
        completionRate={completionRate}
        revenue={revenue}
        utilization={utilization}
        accentHex={teamHex(member.color)}
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabValue)}
      >
        <div className="overflow-x-auto">
          <TabsList className="h-auto w-full justify-start gap-1 rounded-xl bg-muted/60 p-1 sm:w-auto">
            <TabsTrigger value="overview" className="gap-1.5">
              <ClipboardList className="h-4 w-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="engagements" className="gap-1.5">
              <FolderOpen className="h-4 w-4" /> Engagements
              {totalEngagements > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                  {totalEngagements}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="workload" className="gap-1.5">
              <Gauge className="h-4 w-4" /> Workload
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Overview ────────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-4">
          <OverviewTab
            member={member}
            totalEngagements={totalEngagements}
            completedCount={completedCount}
            completionRate={completionRate}
            revenue={revenue}
            avgRevenuePerEng={avgRevenuePerEng}
            utilization={utilization}
            activeEngagements={activeEngagements}
            recentActivities={recentActivities}
            activitiesLoading={activitiesLoading}
            onOpenEngagement={(id) => openEngagement(id)}
            onSwitchTab={(t) => setActiveTab(t)}
          />
        </TabsContent>

        {/* ── Engagements ────────────────────────────────────────── */}
        <TabsContent value="engagements" className="mt-4">
          <EngagementsTab
            engagements={engagements}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onOpenEngagement={(id) => openEngagement(id)}
          />
        </TabsContent>

        {/* ── Workload ───────────────────────────────────────────── */}
        <TabsContent value="workload" className="mt-4">
          <WorkloadTab
            member={member}
            engagements={engagements}
            utilization={utilization}
            onOpenEngagement={(id) => openEngagement(id)}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Empty state (shared)
 * ────────────────────────────────────────────────────────────────────────── */

function EmptyState({
  icon,
  iconWrap = 'bg-muted',
  title,
  description,
  action,
}: {
  icon: React.ReactNode
  iconWrap?: string
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <div className={cn('flex h-12 w-12 items-center justify-center rounded-full', iconWrap)}>
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Header
 * ────────────────────────────────────────────────────────────────────────── */

function TeamDetailHeader({
  member,
  utilization,
  onBack,
  onAssign,
}: {
  member: TeamMember
  utilization: number
  onBack: () => void
  onAssign: () => void
}) {
  const hex = teamHex(member.color)
  const tone = utilizationTone(utilization)
  const toneText = {
    red: 'text-red-200',
    amber: 'text-amber-200',
    info: 'text-sky-200',
    success: 'text-emerald-200',
  }[tone]

  return (
    <Card className="overflow-hidden rounded-xl p-0">
      <div className="bg-gradient-primary px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Button
              variant="secondary"
              size="icon"
              onClick={onBack}
              className="h-9 w-9 shrink-0 bg-white/15 text-white hover:bg-white/25"
              aria-label="Back to reports"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-sm ring-1 ring-inset ring-white/25"
              style={{ backgroundColor: hex }}
            >
              {getInitials(member.name)}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                  {member.name}
                </h1>
                <Badge
                  variant="secondary"
                  className="border-white/20 bg-white/15 text-white"
                >
                  <Briefcase className="mr-1 h-3 w-3" />
                  {titleCase(member.role)}
                </Badge>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-white/85">
                {member.email && (
                  <span className="inline-flex items-center gap-1 text-sm">
                    <Mail className="h-3.5 w-3.5" />
                    {member.email}
                  </span>
                )}
                <span className="opacity-50">•</span>
                <span className="inline-flex items-center gap-1 text-sm">
                  <Gauge className="h-3.5 w-3.5" />
                  {member.currentLoad}/{member.capacity} workload
                </span>
                <span className="opacity-50">•</span>
                <span className={cn('inline-flex items-center gap-1 text-sm font-medium', toneText)}>
                  <Zap className="h-3.5 w-3.5" />
                  {utilization}% utilization
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={onAssign}
              className="bg-white text-primary hover:bg-white/90"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Assign Engagement
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Stats row (4 cards)
 * ────────────────────────────────────────────────────────────────────────── */

function StatsRow({
  totalEngagements,
  completedCount,
  completionRate,
  revenue,
  utilization,
  accentHex,
}: {
  totalEngagements: number
  completedCount: number
  completionRate: number
  revenue: number
  utilization: number
  accentHex: string
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Engagements */}
      <StatCard
        icon={<Briefcase className="h-5 w-5" />}
        iconBg="bg-primary/10 text-primary"
        label="Total Engagements"
        value={totalEngagements.toString()}
        trend={{
          value: 12,
          label: 'vs last 30d',
        }}
      />

      {/* Completed */}
      <StatCard
        icon={<CheckCircle2 className="h-5 w-5" />}
        iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
        label="Completed"
        value={completedCount.toString()}
        sub={`${completionRate}% completion rate`}
      />

      {/* Revenue Generated */}
      <StatCard
        icon={<DollarSign className="h-5 w-5" />}
        iconBg="bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400"
        label="Revenue Generated"
        value={formatFee(revenue)}
        sub={
          totalEngagements > 0
            ? `${formatFeeCompact(revenue / totalEngagements)} avg / eng`
            : '—'
        }
      />

      {/* Utilization */}
      <Card className="rounded-xl p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">Utilization</p>
            <p className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums">
              {utilization}%
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {utilization >= 95
                ? 'Over capacity — reassign recommended'
                : utilization >= 80
                  ? 'Near capacity'
                  : utilization >= 50
                    ? 'Healthy load'
                    : 'Light load'}
            </p>
          </div>
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: `${utilizationColor(utilization)}1a`,
              color: utilizationColor(utilization),
            }}
          >
            <Gauge className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, utilization)}%`,
                backgroundColor: utilizationColor(utilization),
              }}
            />
          </div>
          <span
            className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums"
            style={{ color: utilizationColor(utilization) }}
          >
            {utilization}%
          </span>
        </div>
      </Card>
    </div>
  )
}

function StatCard({
  icon,
  iconBg,
  label,
  value,
  trend,
  sub,
}: {
  icon: React.ReactNode
  iconBg: string
  label: string
  value: string
  trend?: { value: number; label?: string }
  sub?: string
}) {
  return (
    <Card className="relative overflow-hidden rounded-xl p-5 shadow-sm">
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
              {trend.label && <span className="text-muted-foreground">{trend.label}</span>}
            </div>
          )}
          {sub && !trend && (
            <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>
          )}
        </div>
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
            iconBg
          )}
        >
          {icon}
        </div>
      </div>
    </Card>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Small shared building blocks
 * ────────────────────────────────────────────────────────────────────────── */

function SectionHeader({
  icon,
  title,
  trailing,
}: {
  icon?: React.ReactNode
  title: string
  trailing?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {icon && (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </span>
        )}
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      </div>
      {trailing}
    </div>
  )
}

function DetailField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span className="text-muted-foreground/70">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold">{value}</dd>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Tab 1: Overview
 * ────────────────────────────────────────────────────────────────────────── */

function OverviewTab({
  member,
  totalEngagements,
  completedCount,
  completionRate,
  revenue,
  avgRevenuePerEng,
  utilization,
  activeEngagements,
  recentActivities,
  activitiesLoading,
  onOpenEngagement,
  onSwitchTab,
}: {
  member: TeamMember
  totalEngagements: number
  completedCount: number
  completionRate: number
  revenue: number
  avgRevenuePerEng: number
  utilization: number
  activeEngagements: number
  recentActivities: ActivityRow[]
  activitiesLoading: boolean
  onOpenEngagement: (id: string) => void
  onSwitchTab: (tab: TabValue) => void
}) {
  const badges = computeBadges({
    completed: completedCount,
    utilization,
  })

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left col: performance summary + recent activity */}
      <div className="space-y-6 lg:col-span-2">
        {/* Performance summary */}
        <Card className="rounded-xl p-5 shadow-sm">
          <SectionHeader
            icon={<TrendingUp className="h-4 w-4" />}
            title="Performance Summary"
            trailing={
              <Badge variant="secondary" className="px-2 py-0 text-[10px]">
                {activeEngagements} active
              </Badge>
            }
          />
          <Separator className="my-4" />
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <DetailField
              icon={<Briefcase className="h-4 w-4" />}
              label="Total Engagements"
              value={
                <span className="inline-flex items-center gap-2">
                  <span className="tabular-nums">{totalEngagements}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    ({activeEngagements} active)
                  </span>
                </span>
              }
            />
            <DetailField
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Completion Rate"
              value={
                <span className="inline-flex items-center gap-2">
                  <span className="tabular-nums">{completionRate}%</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    ({completedCount} of {totalEngagements})
                  </span>
                </span>
              }
            />
            <DetailField
              icon={<DollarSign className="h-4 w-4" />}
              label="Avg Revenue / Engagement"
              value={
                <span className="tabular-nums">{formatFee(avgRevenuePerEng)}</span>
              }
            />
            <DetailField
              icon={<Clock className="h-4 w-4" />}
              label="Avg Processing Time"
              value={
                <span className="inline-flex items-center gap-2 tabular-nums">
                  ~4.2 days
                  <span className="text-xs font-normal text-muted-foreground">
                    per engagement
                  </span>
                </span>
              }
            />
          </dl>
        </Card>

        {/* Performance badges */}
        <Card className="rounded-xl p-5 shadow-sm">
          <SectionHeader
            icon={<Award className="h-4 w-4" />}
            title="Skill & Performance Badges"
          />
          <Separator className="my-4" />
          {badges.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Award className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No badges yet</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Badges unlock as the team member hits utilization and completion
                milestones.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {badges.map((b) => (
                <div
                  key={b.label}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-3',
                    b.surface
                  )}
                >
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                      b.iconWrap
                    )}
                  >
                    <b.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm font-semibold', b.text)}>{b.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {b.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent activity */}
        <Card className="rounded-xl p-5 shadow-sm">
          <SectionHeader
            icon={<ActivityIcon className="h-4 w-4" />}
            title="Recent Activity"
            trailing={
              <button
                onClick={() => onSwitchTab('workload')}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
              >
                View workload
                <ArrowUpRight className="h-3 w-3" />
              </button>
            }
          />
          <Separator className="my-4" />
          {activitiesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentActivities.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Inbox className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No recent activity</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Activity from this member&apos;s engagements will appear here.
              </p>
            </div>
          ) : (
            <CompactActivityList activities={recentActivities} />
          )}
        </Card>
      </div>

      {/* Right col: profile + utilization snapshot */}
      <div className="space-y-6">
        <Card className="rounded-xl p-5 shadow-sm">
          <SectionHeader
            icon={<UserCheck className="h-4 w-4" />}
            title="Member Profile"
          />
          <Separator className="my-4" />
          <dl className="space-y-4">
            <DetailField
              icon={<Briefcase className="h-4 w-4" />}
              label="Role"
              value={titleCase(member.role)}
            />
            <DetailField
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              value={<span className="break-all">{member.email || '—'}</span>}
            />
            <DetailField
              icon={<Gauge className="h-4 w-4" />}
              label="Capacity"
              value={
                <span className="inline-flex items-center gap-2 tabular-nums">
                  {member.currentLoad}
                  <span className="text-muted-foreground">/ {member.capacity}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    engagements
                  </span>
                </span>
              }
            />
            <DetailField
              icon={<Zap className="h-4 w-4" />}
              label="Current Utilization"
              value={
                <span
                  className="inline-flex items-center gap-2 tabular-nums"
                  style={{ color: utilizationColor(utilization) }}
                >
                  {utilization}%
                  <span className="text-xs font-normal text-muted-foreground">
                    of capacity
                  </span>
                </span>
              }
            />
          </dl>
        </Card>

        <Card className="rounded-xl p-5 shadow-sm">
          <SectionHeader
            icon={<DollarSign className="h-4 w-4" />}
            title="Revenue Snapshot"
          />
          <Separator className="my-4" />
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Total Generated
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">
                {formatFee(revenue)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t pt-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Per Engagement
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums">
                  {totalEngagements > 0 ? formatFeeCompact(avgRevenuePerEng) : '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Completed
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums">
                  {completedCount} of {totalEngagements}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Tab 2: Engagements (with status filter)
 * ────────────────────────────────────────────────────────────────────────── */

function EngagementsTab({
  engagements,
  statusFilter,
  onStatusFilterChange,
  onOpenEngagement,
}: {
  engagements: EngagementRow[]
  statusFilter: StatusFilter
  onStatusFilterChange: (f: StatusFilter) => void
  onOpenEngagement: (id: string) => void
}) {
  const filtered = useMemo(() => {
    if (statusFilter === 'all') return engagements
    if (statusFilter === 'active') {
      return engagements.filter((e) =>
        ACTIVE_ENGAGEMENT_STATUSES.includes(e.status)
      )
    }
    return engagements.filter((e) => e.status === 'done')
  }, [engagements, statusFilter])

  const counts = useMemo(
    () => ({
      all: engagements.length,
      active: engagements.filter((e) =>
        ACTIVE_ENGAGEMENT_STATUSES.includes(e.status)
      ).length,
      completed: engagements.filter((e) => e.status === 'done').length,
    }),
    [engagements]
  )

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-xl bg-muted/60 p-1">
          {(
            [
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'completed', label: 'Completed' },
            ] as { value: StatusFilter; label: string }[]
          ).map((opt) => {
            const isActive = statusFilter === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => onStatusFilterChange(opt.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                  isActive
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {opt.label}
                <span
                  className={cn(
                    'inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums',
                    isActive
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {counts[opt.value]}
                </span>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {engagements.length} engagements
        </p>
      </div>

      {filtered.length === 0 ? (
        <Card className="rounded-xl">
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FolderOpen className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">
              {engagements.length === 0
                ? 'No engagements assigned'
                : 'No engagements match this filter'}
            </h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {engagements.length === 0
                ? "This team member doesn't have any engagements yet. Assign one from the header to get started."
                : `Try switching to ${statusFilter === 'active' ? 'Completed or All' : 'Active or All'} to see more.`}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => (
            <EngagementRowCard
              key={e.id}
              engagement={e}
              onClick={() => onOpenEngagement(e.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function EngagementRowCard({
  engagement,
  onClick,
}: {
  engagement: EngagementRow
  onClick: () => void
}) {
  const deadline = getDeadlineState(engagement.deadline)
  const docCount = engagement._count?.documents ?? 0
  const progress = engagement.progress ?? 0
  const typeLabel = engagementTypeLabel(engagement.engagementType)

  return (
    <Card
      className={cn(
        'cursor-pointer overflow-hidden rounded-xl p-0 shadow-sm transition-all hover:shadow-md hover:border-primary/40',
        'border-l-4',
        ENGAGEMENT_STATUS_BORDER[engagement.status] ||
          'border-l-slate-300 dark:border-l-slate-600'
      )}
      onClick={onClick}
    >
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        {/* Header: type badge + title + client + fee + chevron */}
        <div className="flex items-start gap-3">
          <Badge
            variant="outline"
            className={cn(
              'shrink-0 px-2.5 py-1 text-sm font-bold ring-1 ring-inset',
              ENGAGEMENT_TYPE_COLORS[engagement.engagementType] ||
                'bg-muted text-foreground ring-border'
            )}
          >
            {engagement.engagementType}
          </Badge>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight">
              {typeLabel} — Tax Year {engagement.taxYear}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {engagement.client?.name ?? 'Unknown client'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            {formatFee(engagement.fee ?? 0)}
          </div>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>

        {/* Group 1: status + priority + doc count */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={engagement.status} size="md" />
          <PriorityBadge priority={engagement.priority as Priority} />
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <FileText className="h-3 w-3" />
            <span className="font-medium tabular-nums">{docCount}</span>
            {docCount === 1 ? 'doc' : 'docs'}
          </span>
        </div>

        {/* Group 2: progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium uppercase tracking-wide text-muted-foreground">
              Progress
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {progress}% complete
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Group 3: deadline */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <div className="inline-flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
            {deadline ? (
              <span
                className={cn(
                  'text-xs font-medium tabular-nums',
                  deadline.tone === 'red'
                    ? 'text-red-600 dark:text-red-400'
                    : deadline.tone === 'amber'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-muted-foreground'
                )}
              >
                {format(deadline.date, 'MMM d, yyyy')}
                {deadline.tone === 'red' && ' · Overdue'}
                {deadline.tone === 'amber' && ` · ${deadline.days}d left`}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">No deadline</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Tab 3: Workload
 * ────────────────────────────────────────────────────────────────────────── */

function WorkloadTab({
  member,
  engagements,
  utilization,
  onOpenEngagement,
}: {
  member: TeamMember
  engagements: EngagementRow[]
  utilization: number
  onOpenEngagement: (id: string) => void
}) {
  const hex = teamHex(member.color)

  // Breakdown by engagement type
  const typeBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of engagements) {
      map[e.engagementType] = (map[e.engagementType] || 0) + 1
    }
    return Object.entries(map).map(([type, count]) => ({
      type,
      count,
      label: engagementTypeLabel(type),
    }))
  }, [engagements])

  // Breakdown by status
  const statusBreakdown = useMemo(() => {
    const groups: Record<string, { count: number; color: string; label: string }> = {
      created: { count: 0, color: '#94a3b8', label: 'Created' },
      pbc_sent: { count: 0, color: '#3b82f6', label: 'PBC Sent' },
      collecting: { count: 0, color: '#f59e0b', label: 'Collecting' },
      processing: { count: 0, color: '#8b5cf6', label: 'Processing' },
      review: { count: 0, color: '#06b6d4', label: 'In Review' },
      filing: { count: 0, color: '#14b8a6', label: 'Filing' },
      done: { count: 0, color: '#10b981', label: 'Completed' },
    }
    for (const e of engagements) {
      const g = groups[e.status]
      if (g) g.count += 1
    }
    return Object.entries(groups)
      .filter(([, v]) => v.count > 0)
      .map(([k, v]) => ({ status: k, ...v }))
  }, [engagements])

  // Upcoming deadlines (sorted ascending, exclude overdue done)
  const upcomingDeadlines = useMemo(() => {
    return engagements
      .map((e) => ({ e, d: getDeadlineState(e.deadline) }))
      .filter((x) => x.d !== null && x.d.days >= 0 && x.e.status !== 'done')
      .sort((a, b) => (a.d!.days - b.d!.days))
      .slice(0, 5)
  }, [engagements])

  const overloaded = utilization >= 95

  return (
    <div className="space-y-6">
      {/* Capacity visualization */}
      <Card className="rounded-xl p-5 shadow-sm">
        <SectionHeader
          icon={<Gauge className="h-4 w-4" />}
          title="Capacity"
          trailing={
            <Badge
              variant="outline"
              className={cn(
                'gap-1 px-2 py-0 text-[11px] font-semibold',
                utilization >= 95
                  ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400'
                  : utilization >= 80
                    ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400'
              )}
            >
              {utilization >= 95
                ? 'Overloaded'
                : utilization >= 80
                  ? 'Near Capacity'
                  : 'Healthy'}
            </Badge>
          }
        />
        <Separator className="my-4" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Progress bar */}
          <div className="space-y-3 lg:col-span-2">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Current Load
                </p>
                <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
                  {member.currentLoad}
                  <span className="text-lg font-medium text-muted-foreground">
                    {' '}
                    / {member.capacity}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Utilization
                </p>
                <p
                  className="mt-1 text-2xl font-bold tracking-tight tabular-nums"
                  style={{ color: utilizationColor(utilization) }}
                >
                  {utilization}%
                </p>
              </div>
            </div>
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, utilization)}%`,
                  backgroundColor: utilizationColor(utilization),
                }}
              />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                0–50% Light
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                50–80% Healthy
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                80–95% Near Capacity
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                95%+ Overloaded
              </span>
            </div>
          </div>

          {/* Ring */}
          <div className="flex flex-col items-center justify-center gap-2 border-t pt-4 lg:border-l lg:border-t-0 lg:pt-0">
            <ProgressRing
              value={Math.min(100, utilization)}
              size={120}
              strokeWidth={10}
              color={utilizationColor(utilization)}
            />
            <p className="text-xs text-muted-foreground">Capacity Used</p>
          </div>
        </div>
      </Card>

      {/* Breakdown charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* By engagement type */}
        <Card className="rounded-xl p-5 shadow-sm">
          <SectionHeader
            icon={<PieChartIcon className="h-4 w-4" />}
            title="By Engagement Type"
            trailing={
              <Badge variant="secondary" className="px-2 py-0 text-[10px]">
                {typeBreakdown.length} types
              </Badge>
            }
          />
          <Separator className="my-4" />
          {typeBreakdown.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-muted-foreground">
              <PieChartIcon className="mb-2 h-8 w-8 text-muted-foreground/50" />
              No engagement data to chart yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={typeBreakdown}
                      dataKey="count"
                      nameKey="type"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    >
                      {typeBreakdown.map((entry) => (
                        <Cell
                          key={entry.type}
                          fill={ENGAGEMENT_TYPE_HEX[entry.type] || hex}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid hsl(var(--border))',
                        background: 'hsl(var(--popover))',
                        color: 'hsl(var(--popover-foreground))',
                        fontSize: 12,
                      }}
                      formatter={(v: number, _n, item) => [
                        `${v} engagement${v === 1 ? '' : 's'}`,
                        (item?.payload as { label?: string })?.label ?? item?.name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {typeBreakdown.map((entry) => {
                  const pct =
                    engagements.length > 0
                      ? Math.round((entry.count / engagements.length) * 100)
                      : 0
                  return (
                    <div
                      key={entry.type}
                      className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            ENGAGEMENT_TYPE_HEX[entry.type] || hex,
                        }}
                      />
                      <span className="text-sm font-medium">{entry.type}</span>
                      <span className="ml-auto text-sm font-semibold tabular-nums">
                        {entry.count}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {pct}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </Card>

        {/* By status */}
        <Card className="rounded-xl p-5 shadow-sm">
          <SectionHeader
            icon={<BarChart3 className="h-4 w-4" />}
            title="By Status"
            trailing={
              <Badge variant="secondary" className="px-2 py-0 text-[10px]">
                {statusBreakdown.length} stages
              </Badge>
            }
          />
          <Separator className="my-4" />
          {statusBreakdown.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-muted-foreground">
              <BarChart3 className="mb-2 h-8 w-8 text-muted-foreground/50" />
              No status data to chart yet.
            </div>
          ) : (
            <div className="space-y-3">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={statusBreakdown}
                  margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
                >
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--popover))',
                      color: 'hsl(var(--popover-foreground))',
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [
                      `${v} engagement${v === 1 ? '' : 's'}`,
                      'Count',
                    ]}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {statusBreakdown.map((entry) => (
                      <Cell key={entry.status} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {statusBreakdown.map((entry) => (
                  <div
                    key={entry.status}
                    className="flex items-center gap-2 rounded-lg border bg-muted/20 px-2 py-1.5"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="truncate text-xs font-medium">{entry.label}</span>
                    <span className="ml-auto text-xs font-semibold tabular-nums">
                      {entry.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Upcoming deadlines + reassign suggestions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Upcoming deadlines */}
        <Card className="rounded-xl p-5 shadow-sm lg:col-span-2">
          <SectionHeader
            icon={<CalendarDays className="h-4 w-4" />}
            title="Upcoming Deadlines"
            trailing={
              <Badge variant="secondary" className="px-2 py-0 text-[10px]">
                {upcomingDeadlines.length} upcoming
              </Badge>
            }
          />
          <Separator className="my-3" />
          {upcomingDeadlines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-muted-foreground">
              <CalendarDays className="mb-2 h-8 w-8 text-muted-foreground/50" />
              No upcoming deadlines for this member&apos;s engagements.
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingDeadlines.map(({ e, d }) => (
                <button
                  key={e.id}
                  onClick={() => onOpenEngagement(e.id)}
                  className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40"
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg text-center',
                      d!.tone === 'red'
                        ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                        : d!.tone === 'amber'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'bg-muted text-foreground'
                    )}
                  >
                    <span className="text-[9px] font-bold uppercase leading-none">
                      {format(d!.date, 'MMM').toUpperCase()}
                    </span>
                    <span className="text-base font-bold leading-none">
                      {format(d!.date, 'd')}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {e.client?.name ?? 'Unknown client'}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {engagementTypeLabel(e.engagementType)} — FY{e.taxYear}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'shrink-0 px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                      ENGAGEMENT_TYPE_COLORS[e.engagementType] ||
                        'bg-muted text-foreground ring-border'
                    )}
                  >
                    {e.engagementType}
                  </Badge>
                  <span
                    className={cn(
                      'shrink-0 text-xs font-semibold tabular-nums',
                      d!.tone === 'red'
                        ? 'text-red-600 dark:text-red-400'
                        : d!.tone === 'amber'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-muted-foreground'
                    )}
                  >
                    {d!.days === 0 ? 'Today' : `${d!.days}d`}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Reassign suggestions */}
        <Card className="rounded-xl p-5 shadow-sm">
          <SectionHeader
            icon={<Users className="h-4 w-4" />}
            title="Workload Insights"
          />
          <Separator className="my-3" />
          {overloaded ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
                <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                    Reassign Recommended
                  </p>
                  <p className="mt-0.5 text-xs text-red-700/80 dark:text-red-300/80">
                    {member.name.split(' ')[0]} is at {utilization}% of capacity.
                    Consider moving one or more engagements to a less-loaded team
                    member.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Suggested Actions
                </p>
                {[
                  {
                    label: 'Reassign lowest-priority engagement',
                    hint: 'Move one low/medium-priority engagement to balance load',
                  },
                  {
                    label: 'Split a complex engagement',
                    hint: 'Break a high-volume engagement into sub-tasks',
                  },
                  {
                    label: 'Defer non-critical deadlines',
                    hint: 'Push filing deadlines where extensions allow',
                  },
                ].map((s) => (
                  <button
                    key={s.label}
                    onClick={() =>
                      toast.info('Reassignment workflow', {
                        description: s.hint,
                      })
                    }
                    className="flex w-full items-start gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-left transition-colors hover:bg-muted/40"
                  >
                    <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold">{s.label}</p>
                      <p className="text-[11px] text-muted-foreground">{s.hint}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-3',
                  utilization >= 80
                    ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
                    : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
                )}
              >
                <CheckCircle2
                  className={cn(
                    'h-5 w-5 shrink-0',
                    utilization >= 80
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'text-sm font-semibold',
                      utilization >= 80
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-emerald-700 dark:text-emerald-300'
                    )}
                  >
                    {utilization >= 80 ? 'Near Capacity' : 'Healthy Workload'}
                  </p>
                  <p
                    className={cn(
                      'mt-0.5 text-xs',
                      utilization >= 80
                        ? 'text-amber-700/80 dark:text-amber-300/80'
                        : 'text-emerald-700/80 dark:text-emerald-300/80'
                    )}
                  >
                    {utilization >= 80
                      ? `${member.name.split(' ')[0]} is approaching capacity. Monitor incoming engagements.`
                      : `${member.name.split(' ')[0]} has bandwidth to take on additional engagements.`}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Capacity Snapshot
                </p>
                <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                  <span className="text-xs font-medium">Available slots</span>
                  <span className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {Math.max(0, member.capacity - member.currentLoad)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                  <span className="text-xs font-medium">Headroom</span>
                  <span
                    className="text-sm font-bold tabular-nums"
                    style={{ color: utilizationColor(utilization) }}
                  >
                    {Math.max(0, 100 - utilization)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Compact activity list (used in Overview tab)
 * ────────────────────────────────────────────────────────────────────────── */

function CompactActivityList({
  activities,
}: {
  activities: ActivityRow[]
}) {
  return (
    <ScrollArea className="max-h-[560px] pr-3">
      <ol className="relative space-y-3">
        {activities.map((a, i) => {
          const cfg = ACTIVITY_STYLE_MAP[a.type] ?? DEFAULT_ACTIVITY_STYLE
          const Icon = cfg.icon
          const isLast = i === activities.length - 1
          const title = ACTIVITY_TITLE_MAP[a.type] ?? 'Activity'
          return (
            <li key={a.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg',
                    cfg.surface
                  )}
                >
                  <Icon className={cn('h-4 w-4', cfg.iconColor)} />
                </div>
                {!isLast && (
                  <div
                    className={cn('mt-0.5 w-px flex-1', cfg.line)}
                    style={{ minHeight: 16 }}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 pb-3">
                <p className="text-sm font-semibold leading-snug">{title}</p>
                <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                  {a.description}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/80">{a.actor}</span>
                  <span aria-hidden>·</span>
                  <span>{formatRelative(a.createdAt)}</span>
                  {a.engagement && (
                    <>
                      <span aria-hidden>·</span>
                      <Badge
                        variant="outline"
                        className="px-1.5 py-0 text-[10px] font-semibold ring-1 ring-inset"
                      >
                        {a.engagement.engagementType} · FY{a.engagement.taxYear}
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </ScrollArea>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Badges
 * ────────────────────────────────────────────────────────────────────────── */

interface BadgeDef {
  label: string
  description: string
  icon: typeof Award
  surface: string
  iconWrap: string
  text: string
}

function computeBadges({
  completed,
  utilization,
}: {
  completed: number
  utilization: number
}): BadgeDef[] {
  const out: BadgeDef[] = []
  if (completed > 3) {
    out.push({
      label: 'Top Performer',
      description: `Completed ${completed} engagements — exceeds the 3-engagement threshold.`,
      icon: Award,
      surface:
        'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40',
      iconWrap:
        'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
      text: 'text-amber-800 dark:text-amber-200',
    })
  }
  if (utilization > 80 && utilization <= 95) {
    out.push({
      label: 'High Capacity',
      description: `Running at ${utilization}% utilization — a high-output contributor.`,
      icon: Zap,
      surface:
        'border-teal-200 bg-teal-50 dark:border-teal-900 dark:bg-teal-950/40',
      iconWrap:
        'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
      text: 'text-teal-800 dark:text-teal-200',
    })
  }
  if (utilization > 95) {
    out.push({
      label: 'Needs Attention',
      description: `At ${utilization}% utilization — over capacity. Consider reassigning work.`,
      icon: AlertTriangle,
      surface:
        'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40',
      iconWrap: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
      text: 'text-red-800 dark:text-red-200',
    })
  }
  return out
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Skeleton
 * ────────────────────────────────────────────────────────────────────────── */

function TeamDetailSkeleton() {
  return (
    <div className="space-y-5 p-4 lg:p-6">
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-10 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  )
}
