'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  Mail,
  Phone,
  CreditCard,
  Calendar,
  Copy,
  Plus,
  FileText,
  ClipboardList,
  Activity as ActivityIcon,
  Pencil,
  Building2,
  User as UserIcon,
  ScrollText,
  Heart,
  TrendingUp,
  Receipt,
  IdCard,
  Home as HomeIcon,
  FileSpreadsheet,
  FileImage,
  Upload,
  Sparkles,
  CheckCircle2,
  Send,
  MessageSquare,
  RefreshCw,
  CircleDot,
  Inbox,
  Loader2,
  AlertCircle,
  CalendarClock,
  DollarSign,
  FolderOpen,
  Clock,
  ArrowUpRight,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { StatusBadge } from '@/components/shared/status-badge'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { ProgressRing } from '@/components/shared/progress-ring'
import { ConfidenceMeter } from '@/components/shared/confidence-meter'
import {
  CLIENT_TYPES,
  COUNTRIES,
  ENGAGEMENT_TYPES,
  DOCUMENT_CATEGORIES,
  DOCUMENT_TYPE_MAP,
} from '@/lib/constants'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { format, formatDistanceToNow, differenceInDays, isValid } from 'date-fns'
import { cn } from '@/lib/utils'
import type {
  Client,
  Engagement,
  TaxDocument,
  Activity,
  ClientType,
  Priority,
} from '@/lib/types'

/* ────────────────────────────────────────────────────────────────────────────
 *  Local types
 * ────────────────────────────────────────────────────────────────────────── */

type AssignedUser = {
  id: string
  name: string
  role?: string
  email?: string
  image?: string | null
}

type EngagementRow = Engagement & {
  client?: Client
  assignedTo?: AssignedUser | null
  _count?: {
    documents: number
    pbcItems: number
    pbcCompleted: number
    messages: number
  }
}

type DocumentRow = TaxDocument & {
  client?: { name: string; email: string }
  pbcItem?: { documentType: string; description: string } | null
}

type ActivityRow = Activity & {
  engagement?: { id: string; engagementType: string; taxYear: number } | null
}

type TabValue = 'overview' | 'engagements' | 'documents' | 'activity'

/* ────────────────────────────────────────────────────────────────────────────
 *  Constants & helpers
 * ────────────────────────────────────────────────────────────────────────── */

const TYPE_AVATAR_COLORS: Record<ClientType, string> = {
  individual:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  business:
    'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300',
  trust: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
  nonprofit: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
}

const TYPE_BADGE_COLORS: Record<ClientType, string> = {
  individual:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  business:
    'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-900',
  trust: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900',
  nonprofit:
    'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900',
}

const TYPE_ICON: Record<ClientType, typeof UserIcon> = {
  individual: UserIcon,
  business: Building2,
  trust: ScrollText,
  nonprofit: Heart,
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

const ACTIVE_ENGAGEMENT_STATUSES = [
  'created',
  'pbc_sent',
  'collecting',
  'processing',
  'review',
  'filing',
]

/* Subtle left-border accent per engagement status (spec). */
const ENGAGEMENT_STATUS_BORDER: Record<string, string> = {
  created: 'border-l-slate-300 dark:border-l-slate-600',
  pbc_sent: 'border-l-blue-400 dark:border-l-blue-500',
  collecting: 'border-l-amber-400 dark:border-l-amber-500',
  processing: 'border-l-violet-400 dark:border-l-violet-500',
  review: 'border-l-cyan-400 dark:border-l-cyan-500',
  filing: 'border-l-teal-400 dark:border-l-teal-500',
  done: 'border-l-emerald-400 dark:border-l-emerald-500',
}

/* Friendly title per activity type for the rich timeline. */
const ACTIVITY_TITLE_MAP: Record<string, string> = {
  upload: 'Document uploaded',
  classify: 'Document classified',
  extract: 'Data extracted',
  verify: 'Field verified',
  send: 'PBC list sent',
  message: 'Message posted',
  status_change: 'Status updated',
}

/** Read industry from client metadata safely. */
function getIndustry(client: Client): string {
  const meta = client.metadata as { industry?: string } | null
  return meta?.industry?.trim() || 'Not specified'
}

/* Activity type → color/icon mapping (per spec). */
const ACTIVITY_STYLE_MAP: Record<
  string,
  { icon: typeof CircleDot; surface: string; iconColor: string; line: string }
> = {
  upload: {
    icon: Upload,
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

/* Document category icons (mirrors documents-view). */
const CATEGORY_ICON_MAP: Record<string, typeof FileText> = {
  income: TrendingUp,
  deduction: Receipt,
  identity: IdCard,
  business: Building2,
  investment: TrendingUp,
  realestate: HomeIcon,
  other: FileSpreadsheet,
}

const CATEGORY_STYLE_MAP: Record<
  string,
  { surface: string; icon: string }
> = {
  income: {
    surface: 'bg-emerald-50 dark:bg-emerald-950/30',
    icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  },
  deduction: {
    surface: 'bg-amber-50 dark:bg-amber-950/30',
    icon: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  },
  identity: {
    surface: 'bg-violet-50 dark:bg-violet-950/30',
    icon: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
  },
  business: {
    surface: 'bg-cyan-50 dark:bg-cyan-950/30',
    icon: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-400',
  },
  investment: {
    surface: 'bg-blue-50 dark:bg-blue-950/30',
    icon: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  },
  realestate: {
    surface: 'bg-orange-50 dark:bg-orange-950/30',
    icon: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
  },
  other: {
    surface: 'bg-slate-100 dark:bg-slate-900/40',
    icon: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
}

function getCategoryStyle(category: string | undefined) {
  if (!category) return CATEGORY_STYLE_MAP.other
  return CATEGORY_STYLE_MAP[category] || CATEGORY_STYLE_MAP.other
}

function getInitials(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function getTypeDef(value: string) {
  return CLIENT_TYPES.find((t) => t.value === value) || CLIENT_TYPES[0]
}

function getCountryDef(code: string) {
  return COUNTRIES.find((c) => c.code === code) || COUNTRIES[0]
}

function engagementTypeLabel(type: string): string {
  return ENGAGEMENT_TYPES.find((t) => t.value === type)?.label ?? type
}

/** Format tax ID for display — keeps existing mask, otherwise masks last 4. */
function formatTaxId(taxId: string | null | undefined, type: ClientType): string {
  if (!taxId) return '—'
  if (taxId.includes('*')) return taxId
  if (type === 'individual' && /^\d{9}$/.test(taxId)) {
    return `***-**-${taxId.slice(-4)}`
  }
  if (type !== 'individual' && /^\d{9}$/.test(taxId)) {
    return `**-***${taxId.slice(-4)}`
  }
  if (taxId.length > 4) return `••••${taxId.slice(-4)}`
  return taxId
}

function formatFee(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value || 0)
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

function fileIconFor(mimeType: string): typeof FileText {
  if (mimeType?.startsWith('image/')) return FileImage
  if (
    mimeType?.includes('sheet') ||
    mimeType?.includes('excel') ||
    mimeType?.includes('csv')
  )
    return FileSpreadsheet
  return FileText
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Main view
 * ────────────────────────────────────────────────────────────────────────── */

export function ClientDetailView() {
  const clientId = useAppStore((s) => s.selectedClientId)
  const navigate = useAppStore((s) => s.navigate)
  const openEngagement = useAppStore((s) => s.openEngagement)
  const openDocument = useAppStore((s) => s.openDocument)

  const [client, setClient] = useState<Client | null>(null)
  const [engagements, setEngagements] = useState<EngagementRow[]>([])
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [activities, setActivities] = useState<ActivityRow[]>([])

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState<TabValue>('overview')
  const [activitiesLoading, setActivitiesLoading] = useState(false)

  /* ── Fetch ─────────────────────────────────────────────────────────── */

  const fetchAll = useCallback(async () => {
    if (!clientId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setNotFound(false)
    try {
      const [clientsRes, engRes, docsRes] = await Promise.all([
        fetch('/api/clients'),
        fetch(`/api/engagements?clientId=${encodeURIComponent(clientId)}`),
        fetch(`/api/documents?clientId=${encodeURIComponent(clientId)}`),
      ])

      if (!clientsRes.ok) throw new Error('Failed to load clients')

      const [clientsJson, engJson, docsJson] = await Promise.all([
        clientsRes.json(),
        engRes.json(),
        docsRes.json(),
      ])

      const foundClient = (clientsJson.clients as Client[]).find(
        (c) => c.id === clientId
      )
      if (!foundClient) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setClient(foundClient)
      setEngagements((engJson.engagements as EngagementRow[]) || [])
      setDocuments((docsJson.documents as DocumentRow[]) || [])
      setActivities([])
      setLoading(false)
    } catch (err) {
      console.error(err)
      setNotFound(true)
      setLoading(false)
    }
  }, [clientId])

  // Fetch engagement detail records (in parallel) so we can collect their
  // activity timelines. We look at every engagement to make the timeline rich.
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

  const handleCopyEmail = async () => {
    if (!client?.email) return
    try {
      await navigator.clipboard.writeText(client.email)
      toast.success('Email copied to clipboard')
    } catch {
      toast.error('Could not copy email')
    }
  }

  const handleNewEngagement = () => {
    toast.info('New engagement dialog', {
      description: `Start a new engagement for ${client?.name ?? 'this client'} from the Engagements view.`,
    })
  }

  const handleEdit = () => {
    toast.info('Edit client', {
      description: 'Client editing is coming soon — use the Clients list to manage records.',
    })
  }

  /* ── Empty / loading states ────────────────────────────────────────── */

  if (!clientId) {
    return (
      <EmptyState
        icon={<Inbox className="h-6 w-6 text-muted-foreground" />}
        title="No client selected"
        description="Choose a client from the list to view their details."
        action={
          <Button variant="outline" size="sm" onClick={() => navigate('clients')}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Go to clients
          </Button>
        }
      />
    )
  }

  if (loading) return <ClientDetailSkeleton />

  if (notFound || !client) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />}
        iconWrap="bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
        title="Client not found"
        description="This client may have been removed or you don't have access."
        action={
          <Button variant="outline" size="sm" onClick={() => navigate('clients')}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to clients
          </Button>
        }
      />
    )
  }

  /* ── Derived stats ─────────────────────────────────────────────────── */

  const totalEngagements = engagements.length
  const totalDocuments = documents.length
  const activeEngagements = engagements.filter((e) =>
    ACTIVE_ENGAGEMENT_STATUSES.includes(e.status)
  ).length
  const totalFees = engagements.reduce((sum, e) => sum + (e.fee ?? 0), 0)
  const recentActivities = activities.slice(0, 5)

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <ClientHeader
        client={client}
        onBack={() => navigate('clients')}
        onEdit={handleEdit}
        onNewEngagement={handleNewEngagement}
      />

      <InfoCardsRow client={client} onCopyEmail={handleCopyEmail} />

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
            <TabsTrigger value="documents" className="gap-1.5">
              <FileText className="h-4 w-4" /> Documents
              {totalDocuments > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                  {totalDocuments}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5">
              <ActivityIcon className="h-4 w-4" /> Activity
              {activities.length > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                  {activities.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Overview ────────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-4">
          <OverviewTab
            client={client}
            totalEngagements={totalEngagements}
            totalDocuments={totalDocuments}
            activeEngagements={activeEngagements}
            totalFees={totalFees}
            engagements={engagements}
            documents={documents}
            recentActivities={recentActivities}
            activitiesLoading={activitiesLoading}
            onOpenEngagement={(id) => openEngagement(id)}
            onOpenDocument={(id) => openDocument(id)}
            onSwitchTab={(t) => setActiveTab(t)}
          />
        </TabsContent>

        {/* ── Engagements ────────────────────────────────────────── */}
        <TabsContent value="engagements" className="mt-4">
          <EngagementsTab
            engagements={engagements}
            onOpenEngagement={(id) => openEngagement(id)}
          />
        </TabsContent>

        {/* ── Documents ──────────────────────────────────────────── */}
        <TabsContent value="documents" className="mt-4">
          <DocumentsTab
            documents={documents}
            onOpenDocument={(id) => openDocument(id)}
          />
        </TabsContent>

        {/* ── Activity ───────────────────────────────────────────── */}
        <TabsContent value="activity" className="mt-4">
          <ActivityTab
            activities={activities}
            loading={activitiesLoading}
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
      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full',
          iconWrap
        )}
      >
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

function ClientHeader({
  client,
  onBack,
  onEdit,
  onNewEngagement,
}: {
  client: Client
  onBack: () => void
  onEdit: () => void
  onNewEngagement: () => void
}) {
  const typeDef = getTypeDef(client.clientType)
  const countryDef = getCountryDef(client.country)
  const TypeIcon = TYPE_ICON[client.clientType]

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
              aria-label="Back to clients"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-inset ring-white/25',
                'text-xl font-bold'
              )}
            >
              {getInitials(client.name)}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                  {client.name}
                </h1>
                <Badge
                  variant="secondary"
                  className={cn(
                    'border-white/20 bg-white/15 text-white',
                    'inline-flex items-center gap-1'
                  )}
                >
                  <span aria-hidden>{typeDef.icon}</span>
                  {typeDef.label}
                </Badge>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-white/85">
                <StatusBadge
                  status={client.status}
                  size="sm"
                  className="!bg-white/15 !text-white"
                />
                <span className="inline-flex items-center gap-1 text-sm">
                  <span aria-hidden className="text-base leading-none">
                    {countryDef.flag}
                  </span>
                  {countryDef.code}
                </span>
                <span className="opacity-50">•</span>
                <span className="inline-flex items-center gap-1 text-sm">
                  <TypeIcon className="h-3.5 w-3.5" />
                  {typeDef.label}
                </span>
                {client.email && (
                  <>
                    <span className="opacity-50">•</span>
                    <span className="text-sm">{client.email}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={onEdit}
              className="bg-white/15 text-white hover:bg-white/25"
            >
              <Pencil className="mr-1.5 h-4 w-4" /> Edit
            </Button>
            <Button
              size="sm"
              onClick={onNewEngagement}
              className="bg-white text-primary hover:bg-white/90"
            >
              <Plus className="mr-1.5 h-4 w-4" /> New Engagement
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Info cards row
 * ────────────────────────────────────────────────────────────────────────── */

function InfoCardsRow({
  client,
  onCopyEmail,
}: {
  client: Client
  onCopyEmail: () => void
}) {
  const cards: {
    icon: React.ReactNode
    label: string
    value: React.ReactNode
    trailing?: React.ReactNode
  }[] = [
    {
      icon: <Mail className="h-4 w-4 text-primary" />,
      label: 'Email',
      value: client.email || '—',
      trailing: client.email ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onCopyEmail}
          aria-label="Copy email"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      ) : undefined,
    },
    {
      icon: <Phone className="h-4 w-4 text-primary" />,
      label: 'Phone',
      value: client.phone || '—',
    },
    {
      icon: <CreditCard className="h-4 w-4 text-primary" />,
      label: 'Tax ID',
      value: (
        <span className="font-mono tabular-nums">
          {formatTaxId(client.taxId, client.clientType)}
        </span>
      ),
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <Card
          key={c.label}
          className="flex items-start gap-3 rounded-xl p-4 shadow-sm transition-colors hover:bg-muted/20"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            {c.icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {c.label}
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold" title={String(c.value)}>
              {c.value}
            </p>
          </div>
          {c.trailing}
        </Card>
      ))}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Tab 1: Overview
 * ────────────────────────────────────────────────────────────────────────── */

function OverviewTab({
  client,
  totalEngagements,
  totalDocuments,
  activeEngagements,
  totalFees,
  engagements,
  documents,
  recentActivities,
  activitiesLoading,
  onOpenEngagement,
  onOpenDocument,
  onSwitchTab,
}: {
  client: Client
  totalEngagements: number
  totalDocuments: number
  activeEngagements: number
  totalFees: number
  engagements: EngagementRow[]
  documents: DocumentRow[]
  recentActivities: ActivityRow[]
  activitiesLoading: boolean
  onOpenEngagement: (id: string) => void
  onOpenDocument: (id: string) => void
  onSwitchTab: (tab: TabValue) => void
}) {
  const recentDocs = documents.slice(0, 4)
  const typeDef = getTypeDef(client.clientType)
  const countryDef = getCountryDef(client.country)
  const TypeIcon = TYPE_ICON[client.clientType]
  const industry = getIndustry(client)
  const activeEngagementsList = engagements.filter((e) =>
    ACTIVE_ENGAGEMENT_STATUSES.includes(e.status)
  )
  const activeEngagementsCount = activeEngagementsList.length

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left: client profile + stats + recent activity */}
      <div className="space-y-6 lg:col-span-2">
        {/* ── Client Profile (different info than the top info cards) ── */}
        <Card className="rounded-xl p-5 shadow-sm">
          <SectionHeader
            icon={<UserIcon className="h-4 w-4" />}
            title="Client Profile"
          />
          <Separator className="my-4" />
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <DetailField
              icon={<Building2 className="h-4 w-4" />}
              label="Industry"
              value={industry}
            />
            <DetailField
              icon={<HomeIcon className="h-4 w-4" />}
              label="Country"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="text-base leading-none">
                    {countryDef.flag}
                  </span>
                  {countryDef.label}
                </span>
              }
            />
            <DetailField
              icon={<TypeIcon className="h-4 w-4" />}
              label="Client Type"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden>{typeDef.icon}</span>
                  {typeDef.label}
                </span>
              }
            />
            <DetailField
              icon={<CircleDot className="h-4 w-4" />}
              label="Status"
              value={<StatusBadge status={client.status} size="sm" />}
            />
            <DetailField
              icon={<Calendar className="h-4 w-4" />}
              label="Client Since"
              value={
                client.createdAt
                  ? `Client since ${format(new Date(client.createdAt), 'MMM d, yyyy')}`
                  : '—'
              }
            />
          </dl>
        </Card>

        {/* ── Stats grid ── */}
        <div>
          <SectionHeader
            icon={<TrendingUp className="h-4 w-4" />}
            title="Engagement Snapshot"
            trailing={
              <Badge variant="secondary" className="px-2 py-0 text-[10px]">
                {totalEngagements} total
              </Badge>
            }
          />
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              icon={<FolderOpen className="h-4 w-4" />}
              label="Engagements"
              value={totalEngagements}
              accent="bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300"
            />
            <StatTile
              icon={<FileText className="h-4 w-4" />}
              label="Documents"
              value={totalDocuments}
              accent="bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
            />
            <StatTile
              icon={<Clock className="h-4 w-4" />}
              label="Active Eng."
              value={activeEngagements}
              accent="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
            />
            <StatTile
              icon={<DollarSign className="h-4 w-4" />}
              label="Total Fees"
              value={formatFee(totalFees)}
              accent="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
            />
          </div>
        </div>

        {/* ── Recent activity ── */}
        <Card className="rounded-xl p-5 shadow-sm">
          <SectionHeader
            icon={<ActivityIcon className="h-4 w-4" />}
            title="Recent Activity"
            trailing={
              <button
                onClick={() => onSwitchTab('activity')}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
              >
                View all
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
                Activity from this client&apos;s engagements will appear here.
              </p>
            </div>
          ) : (
            <ActivityList activities={recentActivities} />
          )}
        </Card>
      </div>

      {/* Right: snapshot of engagements + documents */}
      <div className="space-y-6">
        {/* ── Active Engagements preview ── */}
        <Card className="rounded-xl p-5 shadow-sm">
          <SectionHeader
            icon={<FolderOpen className="h-4 w-4" />}
            title="Active Engagements"
            trailing={
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {activeEngagementsCount}
                </Badge>
                {totalEngagements > 0 && (
                  <button
                    onClick={() => onSwitchTab('engagements')}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    View all
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            }
          />
          <Separator className="my-3" />
          {activeEngagementsList.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {engagements.length === 0
                ? 'No engagements yet.'
                : 'No active engagements — all are completed.'}
            </div>
          ) : (
            <div className="space-y-2">
              {activeEngagementsList.slice(0, 4).map((e) => (
                <button
                  key={e.id}
                  onClick={() => onOpenEngagement(e.id)}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted/40"
                >
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
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">FY{e.taxYear}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {engagementTypeLabel(e.engagementType)}
                    </p>
                  </div>
                  <ProgressRing value={e.progress ?? 0} size={32} strokeWidth={3} />
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* ── Recent documents preview ── */}
        <Card className="rounded-xl p-5 shadow-sm">
          <SectionHeader
            icon={<FileText className="h-4 w-4" />}
            title="Recent Documents"
            trailing={
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {totalDocuments}
                </Badge>
                {totalDocuments > 0 && (
                  <button
                    onClick={() => onSwitchTab('documents')}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    View all
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            }
          />
          <Separator className="my-3" />
          {totalDocuments === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No documents uploaded.
            </div>
          ) : (
            <div className="space-y-1.5">
              {recentDocs.map((doc) => {
                const typeDef = doc.documentType
                  ? DOCUMENT_TYPE_MAP[doc.documentType]
                  : null
                const Icon = typeDef
                  ? CATEGORY_ICON_MAP[typeDef.category] || FileText
                  : fileIconFor(doc.mimeType)
                return (
                  <button
                    key={doc.id}
                    onClick={() => onOpenDocument(doc.id)}
                    className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-medium"
                        title={doc.originalFilename}
                      >
                        {doc.originalFilename}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {typeDef ? typeDef.label : 'Unclassified'} ·{' '}
                        {formatDistanceToNow(new Date(doc.uploadedAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </button>
                )
              })}
            </div>
          )}
        </Card>
      </div>
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

/* Small section header used to introduce a card / region. */
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

function StatTile({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  accent: string
}) {
  return (
    <Card className="rounded-xl p-4">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg',
            accent
          )}
        >
          {icon}
        </div>
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
    </Card>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Tab 2: Engagements
 * ────────────────────────────────────────────────────────────────────────── */

function EngagementsTab({
  engagements,
  onOpenEngagement,
}: {
  engagements: EngagementRow[]
  onOpenEngagement: (id: string) => void
}) {
  if (engagements.length === 0) {
    return (
      <Card className="rounded-xl">
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FolderOpen className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No engagements yet</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            This client doesn&apos;t have any engagements. Start a new one from
            the header to begin collecting documents.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {engagements.map((e) => (
        <EngagementRowCard
          key={e.id}
          engagement={e}
          onClick={() => onOpenEngagement(e.id)}
        />
      ))}
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
  const assignedTo = engagement.assignedTo
  const progress = engagement.progress ?? 0
  const typeLabel = engagementTypeLabel(engagement.engagementType)

  return (
    <Card
      className={cn(
        'cursor-pointer overflow-hidden rounded-xl p-0 shadow-sm transition-all hover:shadow-md hover:border-primary/40',
        'border-l-4',
        ENGAGEMENT_STATUS_BORDER[engagement.status] || 'border-l-slate-300 dark:border-l-slate-600'
      )}
      onClick={onClick}
    >
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        {/* Header: type badge + title + fee + chevron */}
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
              FY{engagement.taxYear} engagement
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

        {/* Group 2: prominent progress with label */}
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

        {/* Group 3: deadline + assignee */}
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
          <div className="inline-flex items-center gap-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
              {getInitials(assignedTo?.name)}
            </div>
            <div className="hidden sm:block">
              <p className="max-w-[120px] truncate text-xs font-semibold leading-tight">
                {assignedTo?.name ?? 'Unassigned'}
              </p>
              {assignedTo?.role && (
                <p className="text-[10px] capitalize leading-tight text-muted-foreground">
                  {assignedTo.role}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Tab 3: Documents
 * ────────────────────────────────────────────────────────────────────────── */

function DocumentsTab({
  documents,
  onOpenDocument,
}: {
  documents: DocumentRow[]
  onOpenDocument: (id: string) => void
}) {
  if (documents.length === 0) {
    return (
      <Card className="rounded-xl">
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FileText className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No documents</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            This client hasn&apos;t uploaded any documents yet. Documents will
            appear here once an engagement&apos;s PBC list is fulfilled.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          doc={doc}
          onClick={() => onOpenDocument(doc.id)}
        />
      ))}
    </div>
  )
}

function DocumentCard({
  doc,
  onClick,
}: {
  doc: DocumentRow
  onClick: () => void
}) {
  const typeDef = doc.documentType ? DOCUMENT_TYPE_MAP[doc.documentType] : null
  const category = typeDef?.category || 'other'
  const style = getCategoryStyle(category)
  const Icon = typeDef
    ? CATEGORY_ICON_MAP[category] || FileText
    : fileIconFor(doc.mimeType)

  const extractions = doc.extractions ?? []
  const avgConfidence =
    extractions.length > 0
      ? extractions.reduce((s, e) => s + e.confidence, 0) /
        extractions.length
      : doc.confidence ?? 0

  const uploadedMs = new Date(doc.uploadedAt).getTime()
  const isNew = Date.now() - uploadedMs < 24 * 60 * 60 * 1000

  return (
    <button onClick={onClick} className="group block h-full text-left">
      <Card className="card-hover h-full overflow-hidden rounded-xl p-0">
        {/* Top section — category-colored icon */}
        <div
          className={cn(
            'relative flex items-start justify-between gap-3 p-4',
            style.surface
          )}
        >
          <div
            className={cn(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform duration-200 group-hover:scale-105',
              style.icon
            )}
          >
            <Icon className="h-7 w-7" />
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {isNew && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                <span className="h-1 w-1 rounded-full bg-white" />
                New
              </span>
            )}
            <StatusBadge status={doc.status} />
          </div>
        </div>

        {/* Bottom — filename + meta */}
        <div className="space-y-3 p-4">
          <div className="min-w-0">
            <p
              className="truncate text-sm font-semibold leading-tight"
              title={doc.originalFilename}
            >
              {doc.originalFilename}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {typeDef ? typeDef.label : 'Unclassified'}
            </p>
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {formatFileSize(doc.fileSize)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDistanceToNow(new Date(doc.uploadedAt), {
                addSuffix: true,
              })}
            </span>
          </div>

          {/* Confidence meter */}
          {doc.status !== 'uploaded' && doc.status !== 'processing' && (
            <div className="border-t pt-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  AI Confidence
                </span>
                <ConfidenceMeter value={avgConfidence} className="ml-auto" />
              </div>
              {extractions.length > 0 && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {extractions.filter((e) => e.isVerified).length} of{' '}
                  {extractions.length} fields verified
                </p>
              )}
            </div>
          )}

          {(doc.status === 'uploaded' || doc.status === 'processing') && (
            <div className="flex items-center gap-2 border-t pt-3 text-[11px] text-amber-700 dark:text-amber-400">
              {doc.status === 'processing' ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Processing with AI…
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3" />
                  Ready for AI processing
                </>
              )}
            </div>
          )}
        </div>
      </Card>
    </button>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Tab 4: Activity
 * ────────────────────────────────────────────────────────────────────────── */

function ActivityTab({
  activities,
  loading,
}: {
  activities: ActivityRow[]
  loading: boolean
}) {
  if (loading) {
    return (
      <Card className="rounded-xl p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-5 w-28 rounded-full" />
        </div>
        <div className="space-y-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2 pt-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  if (activities.length === 0) {
    return (
      <Card className="rounded-xl shadow-sm">
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ActivityIcon className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No activity yet</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Once this client&apos;s engagements start collecting documents and
            AI processing, a rich timeline will appear here.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="rounded-xl p-5 shadow-sm">
      <RichActivityTimeline activities={activities} />
    </Card>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Rich activity timeline (used in Activity tab)
 * ────────────────────────────────────────────────────────────────────────── */

function RichActivityTimeline({
  activities,
}: {
  activities: ActivityRow[]
}) {
  // Compute the time range from the oldest activity to now (min 1 day).
  const oldest = activities.length
    ? new Date(activities[activities.length - 1].createdAt)
    : null
  const daysRange = oldest
    ? Math.max(
        1,
        Math.ceil(
          (Date.now() - oldest.getTime()) / (1000 * 60 * 60 * 24)
        )
      )
    : 30

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-2">
        <SectionHeader
          icon={<ActivityIcon className="h-4 w-4" />}
          title="Activity Timeline"
        />
        <Badge variant="outline" className="text-[11px] tabular-nums">
          Last {daysRange} {daysRange === 1 ? 'day' : 'days'} ·{' '}
          {activities.length} {activities.length === 1 ? 'event' : 'events'}
        </Badge>
      </div>
      <ScrollArea className="max-h-[640px] pr-3">
        <ol className="relative">
          {activities.map((a, i) => {
            const cfg = ACTIVITY_STYLE_MAP[a.type] ?? DEFAULT_ACTIVITY_STYLE
            const Icon = cfg.icon
            const title = ACTIVITY_TITLE_MAP[a.type] ?? 'Activity'
            const isLast = i === activities.length - 1
            const date = new Date(a.createdAt)
            const dateValid = isValid(date)
            return (
              <li key={a.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full ring-4 ring-background',
                      cfg.surface
                    )}
                  >
                    <Icon className={cn('h-5 w-5', cfg.iconColor)} />
                  </div>
                  {!isLast && (
                    <div
                      className={cn('mt-0.5 w-px flex-1', cfg.line)}
                      style={{ minHeight: 24 }}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1 pb-5">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="text-sm font-semibold leading-snug">
                      {title}
                    </p>
                    {dateValid && (
                      <span className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(date, { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                    {a.description}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-foreground/70">
                        {getInitials(a.actor)}
                      </span>
                      <span className="font-medium text-foreground/80">
                        {a.actor}
                      </span>
                    </span>
                    {dateValid && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="tabular-nums">
                          {format(date, 'MMM d, yyyy · h:mm a')}
                        </span>
                      </>
                    )}
                    {a.engagement && (
                      <>
                        <span aria-hidden>·</span>
                        <Badge
                          variant="outline"
                          className="px-1.5 py-0 text-[10px] font-semibold ring-1 ring-inset"
                        >
                          {a.engagement.engagementType} · FY
                          {a.engagement.taxYear}
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
    </>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Compact activity list (used in Overview's Recent Activity card)
 * ────────────────────────────────────────────────────────────────────────── */

function ActivityList({
  activities,
  showEngagement = false,
}: {
  activities: ActivityRow[]
  showEngagement?: boolean
}) {
  if (activities.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        No recent activity.
      </div>
    )
  }

  return (
    <ScrollArea className="max-h-[560px] pr-3">
      <ol className="relative space-y-3">
        {activities.map((a, i) => {
          const cfg = ACTIVITY_STYLE_MAP[a.type] ?? DEFAULT_ACTIVITY_STYLE
          const Icon = cfg.icon
          const isLast = i === activities.length - 1
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
                <p className="text-sm leading-snug">{a.description}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/80">
                    {a.actor}
                  </span>
                  <span aria-hidden>·</span>
                  <span>
                    {formatDistanceToNow(new Date(a.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                  {showEngagement && a.engagement && (
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
 *  Skeleton
 * ────────────────────────────────────────────────────────────────────────── */

function ClientDetailSkeleton() {
  return (
    <div className="space-y-5 p-4 lg:p-6">
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
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
