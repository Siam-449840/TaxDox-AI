'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Clock,
  Target,
  Star,
  TrendingUp,
  DollarSign,
  Download,
  RefreshCw,
  Gauge,
  Timer,
  CalendarClock,
  CheckCircle2,
  Users,
  MessageSquare,
  Wallet,
  Briefcase,
  Award,
  Sparkles,
  AlertTriangle,
  FileSearch,
  ListChecks,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
} from 'lucide-react'
import { StatCard } from '@/components/shared/stat-card'
import { ProgressRing } from '@/components/shared/progress-ring'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { toast } from 'sonner'
import { DOCUMENT_TYPE_MAP } from '@/lib/constants'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface OperationalMetrics {
  avgProcessingMin: number
  avgCollectionDays: number
  onTimeRate: number
  teamUtilization: number
  clientResponseRate: number
}

interface FinancialMetrics {
  totalRevenue: number
  collectedRevenue: number
  outstandingRevenue: number
  revenuePerEngagement: number
  avgHourlyRate: number
  outsourcingSavings: number
}

interface QualityMetrics {
  avgConfidence: number
  manualCorrections: number
  issuesFound: number
  clientSatisfaction: number
  totalExtractions: number
}

interface TrendPoint {
  date: string
  documents: number
  extractions: number
  accuracy: number
}

interface TypeCount {
  type: string
  count: number
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

interface EngagementStatusBreakdown {
  active: number
  completed: number
  pending: number
}

interface ReportsData {
  operational: OperationalMetrics
  financial: FinancialMetrics
  quality: QualityMetrics
  trendData: TrendPoint[]
  typeDistribution: TypeCount[]
  teamPerformance: TeamPerf[]
  engagementStatusBreakdown: EngagementStatusBreakdown
}

/* ------------------------------------------------------------------ */
/* Constants & helpers                                               */
/* ------------------------------------------------------------------ */

const RANGE_OPTIONS = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: '1y', label: '1Y' },
] as const

type RangeValue = (typeof RANGE_OPTIONS)[number]['value']

const CHART_COLORS = {
  primary: '#0ea5e9',
  emerald: '#10b981',
  amber: '#f59e0b',
  violet: '#8b5cf6',
  pink: '#ec4899',
  cyan: '#06b6d4',
  red: '#ef4444',
  slate: '#64748b',
  orange: '#f97316',
}

const TYPE_BAR_COLORS = [
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#64748b',
  '#14b8a6',
  '#a855f7',
  '#ef4444',
  '#84cc16',
]

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
}

function teamHex(color: string): string {
  return TEAM_COLOR_HEX[color] || '#0ea5e9'
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

const numberCompact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

function formatDateShort(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function docTypeLabel(type: string): string {
  return DOCUMENT_TYPE_MAP[type]?.label || type.replace(/-/g, ' ')
}

function utilizationColor(u: number): string {
  if (u >= 90) return '#ef4444'
  if (u >= 75) return '#f59e0b'
  if (u >= 50) return '#0ea5e9'
  return '#10b981'
}

function performanceTier(utilization: number, completed: number, engagements: number):
  | { label: string; color: string; bg: string }
  | null {
  if (engagements === 0) return null
  const completionRate = engagements > 0 ? completed / engagements : 0
  if (completionRate >= 0.75 && utilization >= 70)
    return { label: 'Top', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900' }
  if (completionRate >= 0.5)
    return { label: 'Solid', color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900' }
  if (completionRate >= 0.25)
    return { label: 'Building', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900' }
  return { label: 'New', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800' }
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/* ------------------------------------------------------------------ */
/* Chart tooltip                                                      */
/* ------------------------------------------------------------------ */

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--popover))',
  color: 'hsl(var(--popover-foreground))',
  fontSize: 12,
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
  padding: '8px 12px',
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export function ReportsView() {
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<RangeValue>('30d')
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(
    async (r: RangeValue, silent = false) => {
      if (!silent) setLoading(true)
      setRefreshing(true)
      try {
        const res = await fetch(`/api/reports?range=${r}`)
        if (!res.ok) throw new Error('Failed to load reports')
        const json = (await res.json()) as ReportsData
        setData(json)
      } catch (e) {
        console.error(e)
        toast.error('Could not load report data')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchData(range)
  }, [range, fetchData])

  const handleRangeChange = (r: RangeValue) => {
    setRange(r)
    toast.info(`Range updated to ${r.toUpperCase()}`, { duration: 1500 })
  }

  const handleRefresh = () => {
    fetchData(range, true)
    toast.success('Reports refreshed', { duration: 1500 })
  }

  const handleExport = () => {
    if (!data) return
    // Build a CSV summary export
    const rows: string[][] = []
    rows.push(['TaxDox AI — Firm Analytics Report'])
    rows.push([`Range: ${range.toUpperCase()}`, `Generated: ${new Date().toISOString()}`])
    rows.push([])
    rows.push(['OPERATIONAL METRICS'])
    rows.push(['Avg Processing Time (min)', String(data.operational.avgProcessingMin)])
    rows.push(['Avg Collection Days', String(data.operational.avgCollectionDays)])
    rows.push(['On-time Filing Rate (%)', String(data.operational.onTimeRate)])
    rows.push(['Team Utilization (%)', String(data.operational.teamUtilization)])
    rows.push(['Client Response Rate (%)', String(data.operational.clientResponseRate)])
    rows.push([])
    rows.push(['FINANCIAL METRICS'])
    rows.push(['Total Revenue', String(data.financial.totalRevenue)])
    rows.push(['Collected Revenue', String(data.financial.collectedRevenue)])
    rows.push(['Outstanding Revenue', String(data.financial.outstandingRevenue)])
    rows.push(['Revenue per Engagement', String(data.financial.revenuePerEngagement)])
    rows.push(['Avg Hourly Rate', String(data.financial.avgHourlyRate)])
    rows.push(['Outsourcing Savings', String(data.financial.outsourcingSavings)])
    rows.push([])
    rows.push(['QUALITY METRICS'])
    rows.push(['AI Accuracy (%)', String(data.quality.avgConfidence)])
    rows.push(['Manual Corrections', String(data.quality.manualCorrections)])
    rows.push(['Issues Found', String(data.quality.issuesFound)])
    rows.push(['Client Satisfaction (/5)', String(data.quality.clientSatisfaction)])
    rows.push(['Total Extractions', String(data.quality.totalExtractions)])
    rows.push([])
    rows.push(['TEAM PERFORMANCE'])
    rows.push(['Name', 'Role', 'Engagements', 'Completed', 'Revenue', 'Utilization %'])
    data.teamPerformance.forEach((t) =>
      rows.push([t.name, t.role, String(t.engagements), String(t.completed), String(t.revenue), String(t.utilization)])
    )
    rows.push([])
    rows.push(['DOCUMENT TYPE DISTRIBUTION'])
    rows.push(['Type', 'Count'])
    data.typeDistribution.forEach((d) => rows.push([d.type, String(d.count)]))

    const csv = rows
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `taxdox-report-${range}-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Report exported as CSV')
  }

  /* ----------------------------- Loading ----------------------------- */
  if (loading || !data) {
    return <ReportsSkeleton />
  }

  const { operational, financial, quality, trendData, typeDistribution, teamPerformance, engagementStatusBreakdown } =
    data

  /* ----------------------- Derived chart data ------------------------ */

  const revenueTrend =
      trendData.map((p) => ({
        date: formatDateShort(p.date),
        documents: p.documents,
        extractions: p.extractions,
        revenue: p.extractions * financial.avgHourlyRate,
      }))

  const accuracyTrend =
      trendData.map((p) => ({
        date: formatDateShort(p.date),
        accuracy: p.accuracy,
      }))

  const totalTypeCount = typeDistribution.reduce((s, t) => s + t.count, 0) || 1
  const typeChartData = typeDistribution
    .slice(0, 10)
    .map((t, i) => ({
      type: docTypeLabel(t.type),
      shortType: t.type,
      count: t.count,
      pct: Math.round((t.count / totalTypeCount) * 100),
      fill: TYPE_BAR_COLORS[i % TYPE_BAR_COLORS.length],
    }))

  const statusPieData = [
    { name: 'Active', value: engagementStatusBreakdown.active, color: CHART_COLORS.primary },
    { name: 'Completed', value: engagementStatusBreakdown.completed, color: CHART_COLORS.emerald },
    { name: 'Pending', value: engagementStatusBreakdown.pending, color: CHART_COLORS.amber },
  ].filter((s) => s.value > 0)
  const statusTotal =
    engagementStatusBreakdown.active +
    engagementStatusBreakdown.completed +
    engagementStatusBreakdown.pending

  /* --------------------------- Render ------------------------------- */

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* ----------------------- Header ----------------------- */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Reports &amp; Analytics</h1>
              <p className="text-sm text-muted-foreground">
                Firm-wide operational, financial, and quality metrics at a glance.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date range selector */}
          <div className="inline-flex h-9 items-center rounded-lg border bg-muted/40 p-[3px]">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleRangeChange(opt.value)}
                className={cn(
                  'inline-flex h-[calc(100%-1px)] items-center justify-center rounded-md px-3 text-xs font-medium transition-colors',
                  range === opt.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn('mr-1.5 h-4 w-4', refreshing && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" onClick={handleExport}>
            <Download className="mr-1.5 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* --------------------- Key Metrics Row -------------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={currency.format(financial.totalRevenue)}
          icon={DollarSign}
          trend={{ value: 12.4, label: 'vs last period' }}
          accent="primary"
        />
        <StatCard
          label="Avg Processing Time"
          value={`${operational.avgProcessingMin}m`}
          icon={Clock}
          trend={{ value: -8.2, label: 'per document' }}
          accent="info"
        />
        <StatCard
          label="AI Accuracy"
          value={`${quality.avgConfidence}%`}
          icon={Target}
          trend={{ value: 3.1, label: 'extraction confidence' }}
          accent="success"
        />
        <StatCard
          label="Client Satisfaction"
          value={`${quality.clientSatisfaction} / 5`}
          icon={Star}
          trend={{ value: 2.5, label: 'avg rating' }}
          accent="warning"
        />
      </div>

      {/* ------------------------- Tabs for metric sections ------------------------- */}
      <Tabs defaultValue="operational" className="w-full">
        <TabsList className="h-9">
          <TabsTrigger value="operational">
            <Gauge className="mr-1.5 h-3.5 w-3.5" />
            Operational
          </TabsTrigger>
          <TabsTrigger value="financial">
            <Wallet className="mr-1.5 h-3.5 w-3.5" />
            Financial
          </TabsTrigger>
          <TabsTrigger value="quality">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Quality
          </TabsTrigger>
        </TabsList>

        {/* ----------------------- Operational ----------------------- */}
        <TabsContent value="operational" className="mt-4">
          <Card className="rounded-xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Operational Metrics</h2>
                <p className="text-xs text-muted-foreground">
                  Throughput, collection speed, and team utilization across the firm.
                </p>
              </div>
              <Badge variant="outline" className="gap-1">
                <Activity className="h-3 w-3" />
                Live
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <OperationalMetricCard
                icon={Timer}
                accent="primary"
                label="Avg Processing / Doc"
                value={`${operational.avgProcessingMin}m`}
                trend={{ value: -8.2, label: 'faster' }}
              />
              <OperationalMetricCard
                icon={CalendarClock}
                accent="info"
                label="Avg Collection Days"
                value={`${operational.avgCollectionDays}d`}
                trend={{ value: -4.5, label: 'faster' }}
              />
              <OperationalMetricCard
                icon={CheckCircle2}
                accent="success"
                label="On-time Filing Rate"
                value={`${operational.onTimeRate}%`}
                trend={{ value: 2.1, label: 'vs target' }}
              />
              <OperationalMetricCard
                icon={Users}
                accent="warning"
                label="Team Utilization"
                value={`${operational.teamUtilization}%`}
                trend={{ value: 5.6, label: 'capacity' }}
              />
              <OperationalMetricCard
                icon={MessageSquare}
                accent="violet"
                label="Client Response Rate"
                value={`${operational.clientResponseRate}%`}
                trend={{ value: 1.8, label: 'engagement' }}
              />
            </div>

            {/* Mini area chart showing document/extraction throughput */}
            <div className="mt-6 border-t pt-5">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Processing Throughput</h3>
                  <p className="text-xs text-muted-foreground">Daily documents &amp; extractions over the selected range</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CHART_COLORS.primary }} />
                    Documents
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CHART_COLORS.emerald }} />
                    Extractions
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revenueTrend} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="opDocsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="opExtGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.emerald} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={CHART_COLORS.emerald} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="documents"
                    stroke={CHART_COLORS.primary}
                    strokeWidth={2}
                    fill="url(#opDocsGrad)"
                    name="Documents"
                  />
                  <Area
                    type="monotone"
                    dataKey="extractions"
                    stroke={CHART_COLORS.emerald}
                    strokeWidth={2}
                    fill="url(#opExtGrad)"
                    name="Extractions"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        {/* ----------------------- Financial ----------------------- */}
        <TabsContent value="financial" className="mt-4">
          <Card className="rounded-xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Financial Metrics</h2>
                <p className="text-xs text-muted-foreground">Revenue, collections, and rate analysis.</p>
              </div>
              <Badge variant="outline" className="gap-1">
                <Wallet className="h-3 w-3" />
                {range.toUpperCase()} snapshot
              </Badge>
            </div>

            {/* Three big numbers */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <FinancialBigCard
                label="Total Revenue"
                value={currency.format(financial.totalRevenue)}
                icon={DollarSign}
                accent="primary"
                subtitle={`Across ${teamPerformance.reduce((s, t) => s + t.engagements, 0)} engagements`}
              />
              <FinancialBigCard
                label="Collected Revenue"
                value={currency.format(financial.collectedRevenue)}
                icon={CheckCircle2}
                accent="success"
                subtitle={`${Math.round((financial.collectedRevenue / (financial.totalRevenue || 1)) * 100)}% of total`}
              />
              <FinancialBigCard
                label="Outstanding Revenue"
                value={currency.format(financial.outstandingRevenue)}
                icon={AlertTriangle}
                accent="warning"
                subtitle={`${Math.round((financial.outstandingRevenue / (financial.totalRevenue || 1)) * 100)}% of total`}
              />
            </div>

            {/* Smaller financial stats */}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <SmallStat
                icon={Briefcase}
                accent="primary"
                label="Revenue per Engagement"
                value={currency.format(financial.revenuePerEngagement)}
              />
              <SmallStat
                icon={Timer}
                accent="violet"
                label="Avg Hourly Rate"
                value={`${currency.format(financial.avgHourlyRate)}/hr`}
              />
              <SmallStat
                icon={TrendingUp}
                accent="success"
                label="Outsourcing Savings"
                value={currency.format(financial.outsourcingSavings)}
                trend={{ value: 18.3, label: 'YoY' }}
              />
            </div>

            {/* Revenue trend area chart */}
            <div className="mt-6 border-t pt-5">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Revenue Trend</h3>
                  <p className="text-xs text-muted-foreground">
                    Derived from extraction volume × avg hourly rate
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CHART_COLORS.primary }} />
                    Revenue
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={revenueTrend} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                    tickFormatter={(v) => currencyCompact.format(v as number)}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => [currency.format(v), 'Revenue']}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={CHART_COLORS.primary}
                    strokeWidth={2.5}
                    fill="url(#revGrad)"
                    name="Revenue"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        {/* ----------------------- Quality ----------------------- */}
        <TabsContent value="quality" className="mt-4">
          <Card className="rounded-xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Quality Metrics</h2>
                <p className="text-xs text-muted-foreground">AI extraction accuracy, corrections, and client sentiment.</p>
              </div>
              <Badge variant="outline" className="gap-1">
                <Sparkles className="h-3 w-3" />
                AI Quality
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Accuracy ring (large) */}
              <div className="flex flex-col items-center justify-center rounded-xl border bg-muted/20 p-6">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  AI Extraction Accuracy
                </p>
                <ProgressRing
                  value={quality.avgConfidence}
                  size={160}
                  strokeWidth={12}
                  color={CHART_COLORS.emerald}
                />
                <p className="mt-3 text-sm font-medium text-emerald-600">
                  {quality.avgConfidence >= 95
                    ? 'Excellent'
                    : quality.avgConfidence >= 90
                      ? 'Strong'
                      : quality.avgConfidence >= 80
                        ? 'Good'
                        : 'Needs review'}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  across {numberCompact.format(quality.totalExtractions)} extractions
                </p>
              </div>

              {/* Quality side metrics */}
              <div className="grid grid-cols-2 gap-3 lg:col-span-2">
                <QualityStatCard
                  icon={FileSearch}
                  accent="primary"
                  label="Total Extractions"
                  value={numberCompact.format(quality.totalExtractions)}
                  subtitle="fields extracted"
                />
                <QualityStatCard
                  icon={AlertTriangle}
                  accent="warning"
                  label="Manual Corrections"
                  value={String(quality.manualCorrections)}
                  subtitle="unverified fields"
                />
                <QualityStatCard
                  icon={ListChecks}
                  accent="danger"
                  label="Issues Found"
                  value={String(quality.issuesFound)}
                  subtitle="low-confidence docs"
                />
                <QualityStatCard
                  icon={Star}
                  accent="violet"
                  label="Client Satisfaction"
                  value={`${quality.clientSatisfaction} / 5`}
                  subtitle={<StarRating value={quality.clientSatisfaction} />}
                />
              </div>
            </div>

            {/* Accuracy trend line chart */}
            <div className="mt-6 border-t pt-5">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Accuracy Trend</h3>
                  <p className="text-xs text-muted-foreground">Daily AI extraction confidence over the selected range</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CHART_COLORS.emerald }} />
                    Accuracy %
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={accuracyTrend} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[80, 100]}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => [`${v}%`, 'Accuracy']}
                  />
                  <Line
                    type="monotone"
                    dataKey="accuracy"
                    stroke={CHART_COLORS.emerald}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: CHART_COLORS.emerald, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    name="Accuracy"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ----------------------- Document Type Distribution + Engagement Status ----------------------- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Document Type Distribution (2/3 width) */}
        <Card className="rounded-xl p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Document Type Distribution</h2>
              <p className="text-xs text-muted-foreground">
                Top {typeChartData.length} document types processed by the AI
              </p>
            </div>
            <Badge variant="outline" className="gap-1">
              <FileSearch className="h-3 w-3" />
              {typeDistribution.length} types
            </Badge>
          </div>

          <ResponsiveContainer width="100%" height={Math.max(240, typeChartData.length * 36)}>
            <BarChart
              data={typeChartData}
              layout="vertical"
              margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
              barCategoryGap={8}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="shortType"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={92}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                formatter={(v: number, _name, props) => [
                  `${v} (${props.payload.pct}%)`,
                  props.payload.type,
                ]}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {typeChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Percentage legend list */}
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-4 sm:grid-cols-3">
            {typeChartData.map((t) => (
              <div key={t.shortType} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: t.fill }} />
                <span className="truncate text-muted-foreground" title={t.type}>
                  {t.shortType}
                </span>
                <span className="ml-auto font-semibold tabular-nums">{t.pct}%</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Engagement Status Breakdown (1/3 width) */}
        <Card className="rounded-xl p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold">Engagement Status</h2>
            <p className="text-xs text-muted-foreground">Active pipeline distribution</p>
          </div>

          <div className="relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={92}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {statusPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number, name) => [v, name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold tabular-nums">{statusTotal}</span>
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {statusPieData.map((s) => {
              const pct = Math.round((s.value / (statusTotal || 1)) * 100)
              return (
                <div
                  key={s.name}
                  className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-sm font-medium">{s.name}</span>
                  <span className="ml-auto text-sm font-semibold tabular-nums">{s.value}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* ----------------------- Team Performance Table ----------------------- */}
      <Card className="rounded-xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Team Performance</h2>
            <p className="text-xs text-muted-foreground">
              Individual contributor metrics across all engagements
            </p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" />
            {teamPerformance.length} members
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-3">Team Member</TableHead>
                <TableHead className="text-center">Engagements</TableHead>
                <TableHead className="text-center">Completed</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="min-w-[160px]">Utilization</TableHead>
                <TableHead className="text-center">Performance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamPerformance.map((m, i) => {
                const hex = teamHex(m.color)
                const tier = performanceTier(m.utilization, m.completed, m.engagements)
                const completionRate =
                  m.engagements > 0 ? Math.round((m.completed / m.engagements) * 100) : 0
                return (
                  <TableRow key={`${m.name}-${i}`} className="text-sm">
                    <TableCell className="pl-3 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: hex }}
                        >
                          {initials(m.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{m.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{m.role}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-md bg-muted px-2 text-sm font-semibold tabular-nums">
                        {m.engagements}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-sm font-semibold tabular-nums">{m.completed}</span>
                        <span className="text-[10px] text-muted-foreground">{completionRate}% rate</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-semibold tabular-nums">{currency.format(m.revenue)}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {m.engagements > 0
                            ? `${currencyCompact.format(m.revenue / m.engagements)}/eng`
                            : '—'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(100, m.utilization)}%`,
                              backgroundColor: utilizationColor(m.utilization),
                            }}
                          />
                        </div>
                        <span
                          className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums"
                          style={{ color: utilizationColor(m.utilization) }}
                        >
                          {m.utilization}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {tier ? (
                        <Badge
                          variant="outline"
                          className={cn('gap-1 font-medium', tier.bg, tier.color)}
                        >
                          <Award className="h-3 w-3" />
                          {tier.label}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
              {teamPerformance.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No team performance data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Subcomponents                                                      */
/* ------------------------------------------------------------------ */

function OperationalMetricCard({
  icon: Icon,
  accent,
  label,
  value,
  trend,
}: {
  icon: typeof Clock
  accent: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'violet'
  label: string
  value: string
  trend?: { value: number; label: string }
}) {
  const accentClasses: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
    warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
    danger: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
    info: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
  }
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', accentClasses[accent])}>
          <Icon className="h-4 w-4" />
        </div>
        {trend && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium',
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
        )}
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
        {trend && <p className="mt-0.5 text-[10px] text-muted-foreground">{trend.label}</p>}
      </div>
    </div>
  )
}

function FinancialBigCard({
  label,
  value,
  icon: Icon,
  accent,
  subtitle,
}: {
  label: string
  value: string
  icon: typeof DollarSign
  accent: 'primary' | 'success' | 'warning'
  subtitle: string
}) {
  const accentClasses: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
    warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  }
  return (
    <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card to-muted/20 p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', accentClasses[accent])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  )
}

function SmallStat({
  icon: Icon,
  accent,
  label,
  value,
  trend,
}: {
  icon: typeof DollarSign
  accent: 'primary' | 'success' | 'warning' | 'violet'
  label: string
  value: string
  trend?: { value: number; label: string }
}) {
  const accentClasses: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
    warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', accentClasses[accent])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold tabular-nums">{value}</p>
      </div>
      {trend && (
        <span
          className={cn(
            'inline-flex items-center gap-0.5 text-xs font-medium',
            trend.value >= 0 ? 'text-emerald-600' : 'text-red-600'
          )}
        >
          {trend.value >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(trend.value)}%
        </span>
      )}
    </div>
  )
}

function QualityStatCard({
  icon: Icon,
  accent,
  label,
  value,
  subtitle,
}: {
  icon: typeof Star
  accent: 'primary' | 'success' | 'warning' | 'danger' | 'violet'
  label: string
  value: string
  subtitle: React.ReactNode
}) {
  const accentClasses: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
    warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
    danger: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', accentClasses[accent])}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      <div className="text-xs text-muted-foreground">{subtitle}</div>
    </div>
  )
}

function StarRating({ value }: { value: number }) {
  const full = Math.floor(value)
  const hasHalf = value - full >= 0.5
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const isFull = i < full
        const isHalf = i === full && hasHalf
        return (
          <Star
            key={i}
            className={cn(
              'h-3.5 w-3.5',
              isFull
                ? 'fill-amber-400 text-amber-400'
                : isHalf
                  ? 'fill-amber-200 text-amber-400'
                  : 'fill-transparent text-muted-foreground/40'
            )}
          />
        )
      })}
      <span className="ml-1 text-xs font-medium tabular-nums">{value.toFixed(1)}</span>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function ReportsSkeleton() {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-3 w-72" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-40 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>

      <Skeleton className="h-9 w-72 rounded-lg" />
      <Skeleton className="h-96 rounded-xl" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>

      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}
