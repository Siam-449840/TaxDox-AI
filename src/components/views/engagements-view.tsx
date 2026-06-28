'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Search,
  Filter,
  FolderOpen,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  CalendarClock,
  MessageSquare,
  X,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { StatCard } from '@/components/shared/stat-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { ENGAGEMENT_TYPES, CLIENT_TYPES } from '@/lib/constants'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { format, differenceInDays, isValid } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Engagement, Priority, EngagementType } from '@/lib/types'

/* ----------------------------- helpers & config ----------------------------- */

const ENGAGEMENT_TYPE_COLORS: Record<string, string> = {
  '1040': 'bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:ring-teal-900',
  '1065': 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900',
  '1120': 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
  '1120S': 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
  '1041': 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900',
}

const TEAM_COLOR_HEX: Record<string, string> = {
  emerald: '#10b981',
  blue: '#3b82f6',
  amber: '#f59e0b',
  violet: '#8b5cf6',
  cyan: '#06b6d4',
  rose: '#f43f5e',
  teal: '#14b8a6',
}

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'created', label: 'Created' },
  { value: 'pbc_sent', label: 'PBC Sent' },
  { value: 'collecting', label: 'Collecting' },
  { value: 'processing', label: 'Processing' },
  { value: 'review', label: 'In Review' },
  { value: 'filing', label: 'Filing' },
  { value: 'done', label: 'Completed' },
]

const PRIORITY_FILTER_OPTIONS = [
  { value: 'all', label: 'All Priorities' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const ACTIVE_STATUSES = ['created', 'pbc_sent', 'collecting', 'processing', 'review', 'filing']

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

function getProgressText(value: number) {
  if (value >= 100) return 'text-emerald-600 dark:text-emerald-400'
  if (value >= 75) return 'text-teal-600 dark:text-teal-400'
  if (value >= 50) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function getTeamColorHex(color?: string) {
  if (!color) return '#64748b'
  return TEAM_COLOR_HEX[color] || '#64748b'
}

function getDeadlineState(deadline?: string | null) {
  if (!deadline) return null
  const date = new Date(deadline)
  if (!isValid(date)) return null
  const days = differenceInDays(date, new Date())
  let tone: 'red' | 'amber' | 'neutral' | 'done' = 'neutral'
  if (days < 0) tone = 'red'
  else if (days <= 3) tone = 'red'
  else if (days <= 7) tone = 'amber'
  return { date, days, tone }
}

function formatFee(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

/* --------------------------------- types --------------------------------- */

interface EngagementRow extends Omit<Engagement, 'client' | 'assignedTo' | '_count'> {
  client?: {
    id: string
    name: string
    email: string
    clientType: string
  } | null
  assignedTo?: {
    id: string
    name: string
    email?: string
    role: string
    color?: string
  } | null
  _count?: {
    documents: number
    pbcItems: number
    pbcCompleted: number
    messages: number
  }
}

interface ClientOption {
  id: string
  name: string
  firmId: string
  email?: string
  clientType: string
}

interface TeamOption {
  id: string
  name: string
  role: string
  email?: string
  color?: string
}

type ViewTab = 'all' | 'active' | 'completed'

interface NewEngagementForm {
  clientId: string
  engagementType: EngagementType | ''
  taxYear: string
  priority: Priority
  deadline: string
  fee: string
  assignedToId: string
  notes: string
}

const INITIAL_FORM: NewEngagementForm = {
  clientId: '',
  engagementType: '',
  taxYear: '2025',
  priority: 'medium',
  deadline: '',
  fee: '',
  assignedToId: '',
  notes: '',
}

/* ------------------------------ main component ------------------------------ */

export function EngagementsView() {
  const openEngagement = useAppStore((s) => s.openEngagement)

  const [engagements, setEngagements] = useState<EngagementRow[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [team, setTeam] = useState<TeamOption[]>([])

  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [viewTab, setViewTab] = useState<ViewTab>('all')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')

  const [form, setForm] = useState<NewEngagementForm>(INITIAL_FORM)

  /* ------------------------------- data fetch ------------------------------ */
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [engRes, clientsRes, teamRes] = await Promise.all([
          fetch('/api/engagements'),
          fetch('/api/clients'),
          fetch('/api/settings/team'),
        ])
        const [engData, clientsData, teamData] = await Promise.all([
          engRes.json(),
          clientsRes.json(),
          teamRes.json(),
        ])
        if (cancelled) return
        setEngagements(engData.engagements || [])
        setClients(
          (clientsData.clients || []).map((c: ClientOption) => ({
            id: c.id,
            name: c.name,
            firmId: c.firmId,
            email: c.email,
            clientType: c.clientType,
          }))
        )
        setTeam(teamData.team || [])
      } catch (err) {
        console.error('Failed to load engagements', err)
        toast.error('Failed to load engagements')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  /* -------------------------------- stats ---------------------------------- */
  const stats = useMemo(() => {
    const total = engagements.length
    const inProgress = engagements.filter((e) =>
      ['pbc_sent', 'collecting', 'processing', 'filing'].includes(e.status)
    ).length
    const needsReview = engagements.filter((e) => e.status === 'review').length
    const completed = engagements.filter((e) => e.status === 'done').length
    return { total, inProgress, needsReview, completed }
  }, [engagements])

  /* --------------------------- team color lookup --------------------------- */
  // Engagement.assignedTo is a User (no color), so we resolve the color
  // by matching the assigned user's email against team members.
  const colorByEmail = useMemo(() => {
    const map: Record<string, string> = {}
    for (const t of team) {
      if (t.email) map[t.email.toLowerCase()] = getTeamColorHex(t.color)
    }
    return map
  }, [team])

  // Map team-member email → User ID (for assignment on submit)
  const userIdByEmail = useMemo(() => {
    const map: Record<string, string> = {}
    for (const e of engagements) {
      const u = e.assignedTo
      if (u?.email) {
        map[u.email.toLowerCase()] = u.id
      }
    }
    return map
  }, [engagements])

  /* ------------------------------- filtering ------------------------------- */
  const visibleEngagements = useMemo(() => {
    return engagements.filter((e) => {
      if (viewTab === 'active' && e.status === 'done') return false
      if (viewTab === 'completed' && e.status !== 'done') return false
      if (typeFilter !== 'all' && e.engagementType !== typeFilter) return false
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (priorityFilter !== 'all' && e.priority !== priorityFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        const name = e.client?.name?.toLowerCase() || ''
        if (!name.includes(q)) return false
      }
      return true
    })
  }, [engagements, viewTab, typeFilter, statusFilter, priorityFilter, search])

  const hasActiveFilters =
    typeFilter !== 'all' ||
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    search.trim() !== ''

  function clearFilters() {
    setTypeFilter('all')
    setStatusFilter('all')
    setPriorityFilter('all')
    setSearch('')
    setViewTab('all')
  }

  /* ---------------------------- dialog handlers ---------------------------- */
  function openNewDialog() {
    setForm(INITIAL_FORM)
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.clientId) {
      toast.error('Please select a client')
      return
    }
    if (!form.engagementType) {
      toast.error('Please select an engagement type')
      return
    }
    const client = clients.find((c) => c.id === form.clientId)
    if (!client) {
      toast.error('Selected client not found')
      return
    }

    setSubmitting(true)
    try {
      // Resolve the selected team member's email to a User ID, since
      // Engagement.assignedToId references the User table.
      let assignedToId: string | null = null
      if (form.assignedToId) {
        const tm = team.find((t) => t.id === form.assignedToId)
        if (tm?.email) {
          assignedToId = userIdByEmail[tm.email.toLowerCase()] || null
        }
      }

      const res = await fetch('/api/engagements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firmId: client.firmId,
          clientId: form.clientId,
          engagementType: form.engagementType,
          taxYear: Number(form.taxYear) || 2025,
          priority: form.priority,
          deadline: form.deadline || null,
          fee: Number(form.fee) || 0,
          assignedToId,
          notes: form.notes || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to create engagement')
      const data = await res.json()
      const newEngagement = data.engagement as EngagementRow
      // attach client + assignedTo for immediate display
      newEngagement.client = {
        id: client.id,
        name: client.name,
        email: client.email || '',
        clientType: client.clientType,
      }
      const assigned = team.find((t) => t.id === form.assignedToId)
      if (assigned) {
        newEngagement.assignedTo = {
          id: assignedToId || assigned.id,
          name: assigned.name,
          email: assigned.email,
          role: assigned.role,
          color: undefined,
        }
      }
      setEngagements((prev) => [newEngagement, ...prev])
      setDialogOpen(false)
      setForm(INITIAL_FORM)
      toast.success('Engagement created', {
        description: `${client.name} · ${form.engagementType} · TY ${form.taxYear}`,
      })
    } catch (err) {
      console.error(err)
      toast.error('Could not create engagement')
    } finally {
      setSubmitting(false)
    }
  }

  /* --------------------------------- render -------------------------------- */
  if (loading) {
    return <EngagementsSkeleton />
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Engagements</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage tax preparation engagements
          </p>
        </div>
        <Button onClick={openNewDialog} className="shrink-0">
          <Plus className="mr-1.5 h-4 w-4" />
          New Engagement
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="Total Engagements"
          value={stats.total}
          icon={FolderOpen}
          accent="primary"
          trend={{ value: 12, label: 'vs last quarter' }}
        />
        <StatCard
          label="In Progress"
          value={stats.inProgress}
          icon={Clock}
          accent="info"
        />
        <StatCard
          label="Needs Review"
          value={stats.needsReview}
          icon={AlertCircle}
          accent="warning"
        />
        <StatCard
          label="Completed"
          value={stats.completed}
          icon={CheckCircle2}
          accent="success"
          trend={{ value: 8, label: 'vs last quarter' }}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as ViewTab)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by client name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span>Filters</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:flex-1">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Engagement Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {ENGAGEMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTER_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_FILTER_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0">
              <X className="mr-1 h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing <span className="font-semibold text-foreground">{visibleEngagements.length}</span>{' '}
          of <span className="font-semibold text-foreground">{engagements.length}</span> engagements
        </span>
      </div>

      {/* Engagement Cards Grid */}
      {visibleEngagements.length === 0 ? (
        <EmptyState
          hasFilters={hasActiveFilters}
          onClear={clearFilters}
          onCreate={openNewDialog}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleEngagements.map((e) => (
            <EngagementCard
              key={e.id}
              engagement={e}
              colorByEmail={colorByEmail}
              onClick={() => openEngagement(e.id)}
            />
          ))}
        </div>
      )}

      {/* New Engagement Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Engagement</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Client */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="clientId">Client *</Label>
                <Select
                  value={form.clientId}
                  onValueChange={(v) => setForm((f) => ({ ...f, clientId: v }))}
                >
                  <SelectTrigger id="clientId" className="w-full">
                    <SelectValue placeholder="Select a client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        No clients available
                      </div>
                    )}
                    {clients.map((c) => {
                      const typeDef = CLIENT_TYPES.find((t) => t.value === c.clientType)
                      return (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="mr-1.5">{typeDef?.icon || '👤'}</span>
                          {c.name}
                          {c.email && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              · {c.email}
                            </span>
                          )}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Engagement Type */}
              <div className="space-y-1.5">
                <Label htmlFor="engagementType">Engagement Type *</Label>
                <Select
                  value={form.engagementType}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, engagementType: v as EngagementType }))
                  }
                >
                  <SelectTrigger id="engagementType" className="w-full">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ENGAGEMENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tax Year */}
              <div className="space-y-1.5">
                <Label htmlFor="taxYear">Tax Year</Label>
                <Input
                  id="taxYear"
                  type="number"
                  value={form.taxYear}
                  onChange={(e) => setForm((f) => ({ ...f, taxYear: e.target.value }))}
                  min={2020}
                  max={2030}
                />
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm((f) => ({ ...f, priority: v as Priority }))}
                >
                  <SelectTrigger id="priority" className="w-full">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Assigned To */}
              <div className="space-y-1.5">
                <Label htmlFor="assignedToId">Assigned To</Label>
                <Select
                  value={form.assignedToId}
                  onValueChange={(v) => setForm((f) => ({ ...f, assignedToId: v }))}
                >
                  <SelectTrigger id="assignedToId" className="w-full">
                    <SelectValue placeholder="Select team member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {team.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} · {t.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Deadline */}
              <div className="space-y-1.5">
                <Label htmlFor="deadline">Deadline</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                />
              </div>

              {/* Fee */}
              <div className="space-y-1.5">
                <Label htmlFor="fee">Fee (USD)</Label>
                <Input
                  id="fee"
                  type="number"
                  min={0}
                  step={50}
                  value={form.fee}
                  onChange={(e) => setForm((f) => ({ ...f, fee: e.target.value }))}
                  placeholder="0"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Any additional context for this engagement..."
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Create Engagement
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ------------------------------ engagement card ----------------------------- */

interface EngagementCardProps {
  engagement: EngagementRow
  colorByEmail: Record<string, string>
  onClick: () => void
}

function EngagementCard({ engagement, colorByEmail, onClick }: EngagementCardProps) {
  const e = engagement
  const clientName = e.client?.name || 'Unknown Client'
  const clientType = e.client?.clientType || 'individual'
  const typeDef = CLIENT_TYPES.find((t) => t.value === clientType)
  const assigned = e.assignedTo
  const assignedColor = assigned?.email
    ? colorByEmail[assigned.email.toLowerCase()]
    : undefined
  const progress = e.progress ?? 0
  const docsCount = e._count?.documents ?? 0
  const pbcTotal = e._count?.pbcItems ?? 0
  const pbcDone = e._count?.pbcCompleted ?? 0
  const messagesCount = e._count?.messages ?? 0
  const deadline = getDeadlineState(e.deadline)

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-all',
        'cursor-pointer hover:-translate-y-0.5 hover:shadow-md'
      )}
    >
      {/* Top row: client + assigned avatar */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {getInitials(clientName)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{clientName}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {typeDef?.icon} {typeDef?.label || clientType}
              {e.client?.email ? ` · ${e.client.email}` : ''}
            </p>
          </div>
        </div>
        {assigned && (
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: assignedColor || '#64748b' }}
            title={`${assigned.name} · ${assigned.role}`}
          >
            {getInitials(assigned.name)}
          </div>
        )}
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            'inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
            ENGAGEMENT_TYPE_COLORS[e.engagementType] ||
              'bg-slate-50 text-slate-700 ring-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:ring-slate-800'
          )}
        >
          {e.engagementType}
        </span>
        <span className="inline-flex items-center rounded-md border border-input bg-muted/40 px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
          TY {e.taxYear}
        </span>
        <StatusBadge status={e.status} />
        <PriorityBadge priority={e.priority} />
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Progress</span>
          <span className={cn('font-semibold tabular-nums', getProgressText(progress))}>
            {progress}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-all duration-500', getProgressColor(progress))}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 border-t pt-3 text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground">Documents</span>
          <span className="flex items-center gap-1 font-semibold tabular-nums">
            <FileText className="h-3 w-3 text-muted-foreground" />
            {docsCount}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground">PBC</span>
          <span className="flex items-center gap-1 font-semibold tabular-nums">
            <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
            {pbcDone}/{pbcTotal}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground">Messages</span>
          <span className="flex items-center gap-1 font-semibold tabular-nums">
            <MessageSquare className="h-3 w-3 text-muted-foreground" />
            {messagesCount}
          </span>
        </div>
      </div>

      {/* Footer: deadline + fee */}
      <div className="flex items-center justify-between border-t pt-3">
        {deadline ? (
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
              deadline.tone === 'red' &&
                'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
              deadline.tone === 'amber' &&
                'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
              deadline.tone === 'neutral' &&
                'bg-muted text-muted-foreground'
            )}
          >
            <CalendarClock className="h-3.5 w-3.5" />
            <span>
              {deadline.days < 0
                ? `${Math.abs(deadline.days)}d overdue`
                : deadline.days === 0
                  ? 'Due today'
                  : `${deadline.days}d left`}
            </span>
            <span className="text-[10px] opacity-70">· {format(deadline.date, 'MMM d')}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No deadline</span>
        )}
        {e.fee > 0 && (
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">
            {formatFee(e.fee)}
          </span>
        )}
      </div>
    </div>
  )
}

/* --------------------------------- skeleton -------------------------------- */

function EngagementsSkeleton() {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-72" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

/* ------------------------------- empty state ------------------------------- */

interface EmptyStateProps {
  hasFilters: boolean
  onClear: () => void
  onCreate: () => void
}

function EmptyState({ hasFilters, onClear, onCreate }: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 p-12 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <FolderOpen className="h-7 w-7 text-primary" />
      </div>
      <div>
        <h3 className="text-base font-semibold">
          {hasFilters ? 'No matching engagements' : 'No engagements yet'}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasFilters
            ? 'Try adjusting your filters or search query.'
            : 'Create your first tax preparation engagement to get started.'}
        </p>
      </div>
      {hasFilters ? (
        <Button variant="outline" onClick={onClear}>
          <X className="mr-1.5 h-4 w-4" />
          Clear filters
        </Button>
      ) : (
        <Button onClick={onCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          New Engagement
        </Button>
      )}
    </Card>
  )
}
