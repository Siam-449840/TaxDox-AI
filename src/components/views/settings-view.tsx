'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Settings as SettingsIcon,
  Building2,
  Users,
  FileSpreadsheet,
  Plug,
  CreditCard,
  ScrollText,
  Plus,
  RefreshCw,
  Loader2,
  Mail,
  Check,
  X,
  Globe,
  HardDrive,
  Cloud,
  Shield,
  Crown,
  Activity as ActivityIcon,
  History,
  ChevronRight,
  Pencil,
  Star,
  Zap,
  Hash,
  Clock,
  FileText,
  Sparkles,
  Gift,
  CalendarClock,
  Send,
  Save,
  Info,
  MailCheck,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAppStore } from '@/lib/store'
import {
  pbcRequestEmail,
  deadlineReminderEmail,
  documentReceivedEmail,
  extractionCompleteEmail,
  welcomeEmail,
  EMAIL_TEMPLATE_LABELS,
  type EmailContent,
  type EmailTemplate,
} from '@/lib/email-templates'
import { StatCard } from '@/components/shared/stat-card'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TAX_SOFTWARE, COUNTRIES, PRICING_TIERS, CLIENT_TYPES, ENGAGEMENT_TYPES } from '@/lib/constants'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────

interface TeamMemberRow {
  id: string
  firmId: string
  name: string
  role: string
  email: string
  capacity: number
  currentLoad: number
  color: string
  avatar?: string | null
}

interface PbcTemplateItem {
  documentType: string
  description: string
  category: string
  required: boolean
  priority: string
}

interface PbcTemplateRow {
  id: string
  firmId: string
  name: string
  description?: string | null
  clientType: string
  engagementType: string
  items: PbcTemplateItem[]
  isDefault: boolean
  createdAt: string
}

interface AuditLogRow {
  id: string
  firmId: string
  userId?: string | null
  action: string
  resourceType?: string | null
  resourceId?: string | null
  details: Record<string, unknown> | string
  ipAddress?: string | null
  createdAt: string
}

// ─── Color helpers ─────────────────────────────────────────────

const TEAM_COLOR_HEX: Record<string, string> = {
  emerald: '#10b981',
  blue: '#3b82f6',
  amber: '#f59e0b',
  violet: '#8b5cf6',
  cyan: '#06b6d4',
  rose: '#f43f5e',
  teal: '#14b8a6',
  indigo: '#6366f1',
  pink: '#ec4899',
  green: '#22c55e',
}

const TEAM_COLOR_CLASSES: Record<string, string> = {
  emerald: 'bg-emerald-500',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  violet: 'bg-violet-500',
  cyan: 'bg-cyan-500',
  rose: 'bg-rose-500',
  teal: 'bg-teal-500',
  indigo: 'bg-indigo-500',
  pink: 'bg-pink-500',
  green: 'bg-green-500',
}

const ROLE_BADGE: Record<string, { label: string; classes: string }> = {
  partner: { label: 'Partner', classes: 'bg-primary/10 text-primary border-primary/20' },
  manager: { label: 'Manager', classes: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900' },
  preparer: { label: 'Preparer', classes: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900' },
  admin: { label: 'Admin', classes: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900' },
  'read-only': { label: 'Read-only', classes: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300' },
}

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function getRoleKey(role: string): keyof typeof ROLE_BADGE | 'read-only' {
  const r = role.toLowerCase()
  if (r.includes('partner')) return 'partner'
  if (r.includes('manager')) return 'manager'
  if (r.includes('preparer')) return 'preparer'
  if (r.includes('admin')) return 'admin'
  return 'read-only'
}

function getCountryFlag(code: string) {
  const found = COUNTRIES.find((c) => c.code === code)
  return found?.flag || '🌐'
}

function getCountryLabel(code: string) {
  const found = COUNTRIES.find((c) => c.code === code)
  return found?.label || code
}

// ─── Tier accent (colored badges per subscription tier) ────────

const TIER_ACCENT: Record<
  string,
  { badge: string; dot: string; ring: string; soft: string }
> = {
  starter: {
    badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700',
    dot: 'bg-slate-500',
    ring: 'ring-slate-200',
    soft: 'bg-slate-50 dark:bg-slate-900/40',
  },
  professional: {
    badge: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900',
    dot: 'bg-sky-500',
    ring: 'ring-sky-200',
    soft: 'bg-sky-50 dark:bg-sky-950/40',
  },
  business: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-200',
    soft: 'bg-emerald-50 dark:bg-emerald-950/40',
  },
  enterprise: {
    badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
    dot: 'bg-amber-500',
    ring: 'ring-amber-200',
    soft: 'bg-amber-50 dark:bg-amber-950/40',
  },
}

function getTierAccent(tierId: string) {
  return TIER_ACCENT[tierId] || TIER_ACCENT.business
}

// ─── Settings View ─────────────────────────────────────────────

export function SettingsView() {
  const [activeTab, setActiveTab] = useState('general')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [team, setTeam] = useState<TeamMemberRow[]>([])
  const [templates, setTemplates] = useState<PbcTemplateRow[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([])

  // Firm info (derived from API responses; fall back to seeded defaults if needed)
  const [firm, setFirm] = useState({
    id: '',
    name: 'Meridian CPA Group',
    subscriptionTier: 'business',
    country: 'US',
    settings: { taxSoftware: ['ultratax', 'cch'], multiCountry: true } as Record<string, unknown>,
  })

  const [showAddMember, setShowAddMember] = useState(false)
  const [showCreateTemplate, setShowCreateTemplate] = useState(false)

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [teamRes, templatesRes, auditRes] = await Promise.all([
        fetch('/api/settings/team'),
        fetch('/api/settings/templates'),
        fetch('/api/audit-logs'),
      ])

      if (teamRes.ok) {
        const teamData = await teamRes.json()
        const teamList: TeamMemberRow[] = teamData.team || []
        setTeam(teamList)
        if (teamList[0]?.firmId) {
          setFirm((f) => ({ ...f, id: teamList[0].firmId }))
        }
      }
      if (templatesRes.ok) {
        const tplData = await templatesRes.json()
        setTemplates(tplData.templates || [])
      }
      if (auditRes.ok) {
        const auditData = await auditRes.json()
        setAuditLogs(auditData.logs || [])
      }
    } catch (err) {
      console.error('Failed to load settings data:', err)
      toast.error('Failed to load settings data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    loadData(true).then(() => toast.success('Settings refreshed'))
  }

  // Derived stats
  const usageStats = useMemo(
    () => ({
      teamMembers: team.length,
      templates: templates.length,
      connectedSoftware: TAX_SOFTWARE.filter((s) => s.connected).length,
      auditEvents: auditLogs.length,
    }),
    [team, templates, auditLogs]
  )

  if (loading) {
    return <SettingsSkeleton />
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <SettingsIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage your firm, team, templates, integrations, billing, and audit trail.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Team Members"
          value={usageStats.teamMembers}
          icon={Users}
          accent="primary"
          className="transition-shadow hover:shadow-md hover:border-primary/30"
        />
        <StatCard
          label="PBC Templates"
          value={usageStats.templates}
          icon={FileSpreadsheet}
          accent="info"
          className="transition-shadow hover:shadow-md hover:border-primary/30"
        />
        <StatCard
          label="Connected Tax Software"
          value={usageStats.connectedSoftware}
          icon={Plug}
          accent="success"
          className="transition-shadow hover:shadow-md hover:border-primary/30"
        />
        <StatCard
          label="Audit Events (30d)"
          value={usageStats.auditEvents}
          icon={ScrollText}
          accent="warning"
          className="transition-shadow hover:shadow-md hover:border-primary/30"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto">
          <TabsList className="h-auto w-fit">
            <TabsTrigger value="general" className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> General
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-1.5">
              <Users className="h-3.5 w-3.5" /> Team
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Templates
            </TabsTrigger>
            <TabsTrigger value="emails" className="gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Emails
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-1.5">
              <Plug className="h-3.5 w-3.5" /> Integrations
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-1.5">
              <CreditCard className="h-3.5 w-3.5" /> Billing
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5">
              <ScrollText className="h-3.5 w-3.5" /> Audit Log
            </TabsTrigger>
          </TabsList>
        </div>

        {/* GENERAL */}
        <TabsContent value="general" className="mt-6">
          <GeneralSection firm={firm} setFirm={setFirm} />
        </TabsContent>

        {/* TEAM */}
        <TabsContent value="team" className="mt-6">
          <TeamSection
            team={team}
            onAdd={() => setShowAddMember(true)}
            firmId={firm.id}
            onMemberAdded={(m) => setTeam((prev) => [...prev, m].sort((a, b) => a.name.localeCompare(b.name)))}
          />
        </TabsContent>

        {/* TEMPLATES */}
        <TabsContent value="templates" className="mt-6">
          <TemplatesSection templates={templates} onCreate={() => setShowCreateTemplate(true)} />
        </TabsContent>

        {/* EMAILS */}
        <TabsContent value="emails" className="mt-6">
          <EmailTemplatesSection />
        </TabsContent>

        {/* INTEGRATIONS */}
        <TabsContent value="integrations" className="mt-6">
          <IntegrationsSection firm={firm} />
        </TabsContent>

        {/* BILLING */}
        <TabsContent value="billing" className="mt-6">
          <BillingSection firm={firm} usageStats={usageStats} />
        </TabsContent>

        {/* AUDIT LOG */}
        <TabsContent value="audit" className="mt-6">
          <AuditLogSection logs={auditLogs} />
        </TabsContent>
      </Tabs>

      {/* Add Team Member dialog */}
      <AddTeamMemberDialog
        open={showAddMember}
        onOpenChange={setShowAddMember}
        firmId={firm.id}
        onCreated={(m) => {
          setTeam((prev) => [...prev, m].sort((a, b) => a.name.localeCompare(b.name)))
        }}
      />

      {/* Create Template dialog */}
      <CreateTemplateDialog
        open={showCreateTemplate}
        onOpenChange={setShowCreateTemplate}
        firmId={firm.id}
        onCreated={(t) => setTemplates((prev) => [...prev, t])}
      />
    </div>
  )
}

// ─── General Section ───────────────────────────────────────────

function GeneralSection({
  firm,
  setFirm,
}: {
  firm: {
    id: string
    name: string
    subscriptionTier: string
    country: string
    settings: Record<string, unknown>
  }
  setFirm: React.Dispatch<
    React.SetStateAction<{
      id: string
      name: string
      subscriptionTier: string
      country: string
      settings: Record<string, unknown>
    }>
  >
}) {
  const navigate = useAppStore((s) => s.navigate)
  const openEngagement = useAppStore((s) => s.openEngagement)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: firm.name,
    subscriptionTier: firm.subscriptionTier,
    country: firm.country,
  })
  const [runningReminders, setRunningReminders] = useState(false)
  const [viewingEmails, setViewingEmails] = useState(false)
  const [lastReminderRun, setLastReminderRun] = useState<Date | null>(null)
  const [remindersSentTotal, setRemindersSentTotal] = useState(0)

  const tierLabel = PRICING_TIERS.find((t) => t.id === firm.subscriptionTier)?.name || firm.subscriptionTier
  const tierInfo = PRICING_TIERS.find((t) => t.id === firm.subscriptionTier)
  const tierAccent = getTierAccent(firm.subscriptionTier)

  const handleSave = () => {
    setFirm((f) => ({ ...f, ...form }))
    setEditing(false)
    toast.success('Firm settings updated (cosmetic)')
  }

  // Cosmetic Save Changes button — confirms the form without committing
  // to the parent firm state. Demonstrates the success toast pattern.
  const handleSaveChanges = () => {
    setFirm((f) => ({ ...f, ...form }))
    setEditing(false)
    toast.success('Firm changes saved', {
      description: 'Your firm profile has been updated successfully.',
    })
  }

  const handleResetForm = () => {
    setForm({
      name: firm.name,
      subscriptionTier: firm.subscriptionTier,
      country: firm.country,
    })
    setEditing(false)
    toast.info('Form reset to current values')
  }

  // Trigger the cron-style reminder sweep manually. The default API
  // key is exposed to the client as NEXT_PUBLIC_CRON_API_KEY so the
  // button works in development without server-side configuration;
  // fall back to the same default key the cron route uses.
  const handleRunReminders = async () => {
    setRunningReminders(true)
    try {
      const cronKey =
        process.env.NEXT_PUBLIC_CRON_API_KEY || 'taxdox-cron-key'
      const res = await fetch(
        `/api/cron/reminders?key=${encodeURIComponent(cronKey)}`
      )
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`)
      }
      const data = await res.json()
      const sent = data.processed ?? 0
      const skipped = data.skipped ?? 0
      setLastReminderRun(new Date())
      setRemindersSentTotal((prev) => prev + sent)
      toast.success(
        `Reminder check complete — ${sent} sent${
          skipped > 0 ? `, ${skipped} skipped` : ''
        }`,
        {
          description:
            sent > 0
              ? 'Deadline reminders queued for delivery.'
              : 'No new reminders were due.',
        }
      )
    } catch (err) {
      console.error('Reminder check failed:', err)
      toast.error('Failed to run reminder check', {
        description:
          'Check the console — the cron endpoint may be unreachable.',
      })
    } finally {
      setRunningReminders(false)
    }
  }

  // Navigate to an engagement that has sent emails so reviewers can
  // inspect the email history first-hand. Falls back to the engagements
  // list view if the API call fails or returns no rows.
  const handleViewSentEmails = async () => {
    setViewingEmails(true)
    try {
      const res = await fetch('/api/engagements?limit=20')
      if (res.ok) {
        const data = await res.json()
        const engagements: Array<{ id: string }> = data.engagements || data || []
        if (engagements.length > 0 && engagements[0].id) {
          openEngagement(engagements[0].id)
          toast.info('Opened engagement with sent emails', {
            description: 'Switch to the Emails tab to view communication history.',
          })
          return
        }
      }
      navigate('engagements')
      toast.info('Opened engagements list', {
        description: 'Click any engagement to view its email history.',
      })
    } catch (err) {
      console.error('Failed to load engagements:', err)
      navigate('engagements')
      toast.info('Opened engagements list')
    } finally {
      setViewingEmails(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ───────── Firm Information ───────── */}
      <Card className="overflow-hidden transition-shadow hover:shadow-md">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-4.5 w-4.5" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  Firm Information
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="rounded-full text-muted-foreground/70 transition-colors hover:text-foreground"
                        aria-label="Firm information help"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Manage your firm identity, region, and subscription tier.</TooltipContent>
                  </Tooltip>
                </CardTitle>
                <CardDescription className="mt-1">Manage your firm profile and primary settings.</CardDescription>
              </div>
            </div>
            {!editing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
                className="transition-colors hover:bg-primary/5"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave}>
                  <Check className="h-3.5 w-3.5" /> Save
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Group: Firm Identity */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 text-primary" /> Firm Identity
            </div>
            <div className="flex items-center gap-4 rounded-xl bg-gradient-primary p-5 text-white shadow-lg shadow-primary/20">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                <Building2 className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wider text-white/70">Firm</p>
                <p className="truncate text-xl font-bold">{form.name}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white px-2.5 py-0.5 font-semibold text-foreground shadow-sm">
                    <Crown className="h-3 w-3 text-amber-500" /> {tierLabel}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-white/90">
                    <span>{getCountryFlag(form.country)}</span> {getCountryLabel(form.country)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-white/90">
                    <Shield className="h-3 w-3" /> SOC 2
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border/60" />

          {/* Group: Editable Configuration */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Pencil className="h-3.5 w-3.5 text-primary" /> Editable Configuration
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="firm-name">Firm Name</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground/70 transition-colors hover:text-foreground" aria-label="Firm name help">
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Legal name of your accounting firm shown to clients.</TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="firm-name"
                  value={form.name}
                  disabled={!editing}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="firm-tier">Subscription Tier</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground/70 transition-colors hover:text-foreground" aria-label="Subscription tier help">
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Current pricing plan. Upgrade anytime from the Billing tab.</TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={form.subscriptionTier}
                  disabled={!editing}
                  onValueChange={(v) => setForm((f) => ({ ...f, subscriptionTier: v }))}
                >
                  <SelectTrigger id="firm-tier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICING_TIERS.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.id === firm.subscriptionTier ? ' (current)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 pt-0.5">
                  <Badge variant="outline" className={cn('gap-1.5', tierAccent.badge)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', tierAccent.dot)} /> {tierLabel}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">Active plan</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="firm-country">Country</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground/70 transition-colors hover:text-foreground" aria-label="Country help">
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Primary tax jurisdiction for this firm.</TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={form.country}
                  disabled={!editing}
                  onValueChange={(v) => setForm((f) => ({ ...f, country: v }))}
                >
                  <SelectTrigger id="firm-country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.flag} {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="firm-firmid">Firm ID</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground/70 transition-colors hover:text-foreground" aria-label="Firm ID help">
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Unique internal identifier (read-only).</TooltipContent>
                  </Tooltip>
                </div>
                <Input id="firm-firmid" value={firm.id} disabled className="font-mono text-xs" />
              </div>
            </div>

            {/* Save Changes footer */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-4">
              <Button variant="ghost" size="sm" onClick={handleResetForm} className="transition-colors hover:bg-muted">
                Reset
              </Button>
              <Button size="sm" onClick={handleSaveChanges} className="gap-1.5 transition-transform hover:scale-[1.02]">
                <Save className="h-3.5 w-3.5" /> Save Changes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ───────── Automation (prominent) ───────── */}
      <Card className="overflow-hidden border-primary/30 transition-shadow hover:shadow-lg">
        <CardHeader className="border-b bg-gradient-primary p-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-bold text-white">
                  Automation
                  <Badge className="border-0 bg-white/20 text-white">
                    <span className="mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /> Live
                  </Badge>
                </CardTitle>
                <CardDescription className="mt-1 text-white/80">
                  Scheduled workflows run automatically. Trigger them on demand below.
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          {/* Status indicators */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <AutomationStatusTile
              icon={History}
              label="Last Run"
              value={lastReminderRun ? format(lastReminderRun, 'MMM d, HH:mm') : 'Never'}
              hint="Manual trigger"
              accent="muted"
            />
            <AutomationStatusTile
              icon={CalendarClock}
              label="Next Scheduled"
              value="Daily · 09:00"
              hint="Auto cron"
              accent="primary"
            />
            <AutomationStatusTile
              icon={MailCheck}
              label="Reminders Sent"
              value={String(remindersSentTotal)}
              hint="This session"
              accent="emerald"
            />
          </div>

          {/* Reminder sweep block */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 transition-colors hover:border-primary/30">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                  <CalendarClock className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Deadline Reminder Sweep</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Scans engagements due within the next 14 days and sends a deadline reminder to each client who hasn't received one in the last 3 days.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                      <Clock className="h-3 w-3" /> 14-day window
                    </Badge>
                    <Badge variant="outline" className="gap-1 border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300">
                      <Send className="h-3 w-3" /> 3-day cooldown
                    </Badge>
                    <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <Sparkles className="h-3 w-3" /> Auto-sends reminders
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:w-52">
                <Button
                  onClick={handleRunReminders}
                  disabled={runningReminders}
                  className="h-10 w-full text-sm transition-transform hover:scale-[1.02]"
                >
                  {runningReminders ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  Run Reminder Check
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleViewSentEmails}
                  disabled={viewingEmails}
                  className="w-full transition-colors hover:bg-primary/5"
                >
                  {viewingEmails ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Mail className="h-3.5 w-3.5" />
                  )}
                  View Sent Emails
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ───────── Plan + Preferences summary ───────── */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="border-b">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Plan Summary</CardTitle>
                <CardDescription>Your current subscription details.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current Plan</span>
              <Badge variant="outline" className={cn('gap-1.5', tierAccent.badge)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', tierAccent.dot)} /> {tierLabel}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Price</span>
              <span className="text-sm font-semibold">
                {tierInfo?.price ? `$${tierInfo.price}/${tierInfo.period}` : 'Custom'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Doc Limit / Month</span>
              <span className="text-sm font-semibold">
                {tierInfo?.docsPerMonth === -1 ? 'Unlimited' : tierInfo?.docsPerMonth ?? '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Multi-country</span>
              <Badge variant="outline" className="gap-1">
                <Globe className="h-3 w-3" /> {firm.settings.multiCountry ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="border-b">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <SettingsIcon className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Preferences</CardTitle>
                <CardDescription>Workspace-wide preferences (cosmetic).</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <PreferenceRow label="Auto-classify documents on upload" value="On" />
            <PreferenceRow label="Send PBC reminders every" value="3 days" />
            <PreferenceRow label="Default PBC template" value="Standard 1040 Individual" />
            <PreferenceRow label="Confidence review threshold" value="90%" />
            <PreferenceRow label="Daily AI usage report" value="Email · 8:00 AM" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function AutomationStatusTile({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: typeof History
  label: string
  value: string
  hint: string
  accent: 'primary' | 'emerald' | 'muted'
}) {
  const accentClasses: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
    muted: 'bg-muted text-muted-foreground',
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary/30">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', accentClasses[accent])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-bold tabular-nums">{value}</p>
        <p className="text-[10px] text-muted-foreground">{hint}</p>
      </div>
    </div>
  )
}

function PreferenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-3 transition-colors last:border-0 last:pb-0 hover:bg-muted/30">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}

// ─── Team Section ──────────────────────────────────────────────

function TeamSection({
  team,
  onAdd,
}: {
  team: TeamMemberRow[]
  onAdd: () => void
  firmId: string
  onMemberAdded: (m: TeamMemberRow) => void
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Team Members</CardTitle>
            <CardDescription>
              {team.length} member{team.length === 1 ? '' : 's'} · manage roles, capacity, and workload.
            </CardDescription>
          </div>
          <Button size="sm" onClick={onAdd}>
            <Plus className="h-4 w-4" /> Add Team Member
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {team.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm font-medium">No team members yet</p>
            <p className="text-xs text-muted-foreground">Add your first team member to get started.</p>
          </div>
        ) : (
          <div className="-mx-6 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="text-center">Capacity</TableHead>
                  <TableHead className="hidden sm:table-cell">Current Load</TableHead>
                  <TableHead className="min-w-[160px]">Utilization</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.map((m) => {
                  const util = m.capacity > 0 ? Math.round((m.currentLoad / m.capacity) * 100) : 0
                  const utilColor =
                    util >= 90
                      ? 'text-red-600'
                      : util >= 75
                      ? 'text-amber-600'
                      : util >= 50
                      ? 'text-primary'
                      : 'text-emerald-600'
                  const barColor =
                    util >= 90
                      ? 'bg-red-500'
                      : util >= 75
                      ? 'bg-amber-500'
                      : util >= 50
                      ? 'bg-primary'
                      : 'bg-emerald-500'
                  const roleKey = getRoleKey(m.role)
                  const roleCfg = ROLE_BADGE[roleKey]
                  return (
                    <TableRow key={m.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: TEAM_COLOR_HEX[m.color] || '#64748b' }}
                          >
                            {initials(m.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{m.name}</p>
                            <p className="truncate text-xs text-muted-foreground md:hidden">{m.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('font-medium', roleCfg.classes)}>
                          {roleCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{m.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm font-medium tabular-nums">{m.capacity}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {m.currentLoad} / {m.capacity}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn('h-full rounded-full transition-all', barColor)}
                              style={{ width: `${Math.min(100, util)}%` }}
                            />
                          </div>
                          <span className={cn('w-9 text-right text-xs font-semibold tabular-nums', utilColor)}>
                            {util}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Templates Section ─────────────────────────────────────────

function TemplatesSection({
  templates,
  onCreate,
}: {
  templates: PbcTemplateRow[]
  onCreate: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">PBC Templates</h2>
          <p className="text-sm text-muted-foreground">
            Reusable document request lists for different engagement types.
          </p>
        </div>
        <Button size="sm" onClick={onCreate}>
          <Plus className="h-4 w-4" /> Create Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm font-medium">No templates yet</p>
            <p className="text-xs text-muted-foreground">Create a template to standardize your PBC lists.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const requiredCount = t.items.filter((i) => i.required).length
            const clientTypeLabel =
              CLIENT_TYPES.find((c) => c.value === t.clientType)?.label || t.clientType
            const clientTypeIcon =
              CLIENT_TYPES.find((c) => c.value === t.clientType)?.icon || '📄'
            const engLabel =
              ENGAGEMENT_TYPES.find((e) => e.value === t.engagementType)?.label || t.engagementType
            return (
              <Card
                key={t.id}
                className="group relative overflow-hidden transition-all hover:shadow-md hover:border-primary/30"
              >
                <div className="absolute right-0 top-0 h-20 w-20 -translate-y-6 translate-x-6 rounded-full bg-primary/5" />
                <CardHeader className="border-b pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FileSpreadsheet className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-sm leading-tight">{t.name}</CardTitle>
                        {t.isDefault && (
                          <Badge className="mt-1 gap-1 bg-primary/10 text-primary border-primary/20" variant="outline">
                            <Star className="h-3 w-3" /> Default
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {t.description && (
                    <CardDescription className="mt-2 line-clamp-2">{t.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="gap-1 text-xs">
                      <span>{clientTypeIcon}</span> {clientTypeLabel}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {engLabel}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3 text-center">
                    <div>
                      <p className="text-lg font-bold tabular-nums">{t.items.length}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Items</p>
                    </div>
                    <div className="border-x border-border">
                      <p className="text-lg font-bold tabular-nums text-primary">{requiredCount}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Required</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold tabular-nums text-muted-foreground">
                        {t.items.length - requiredCount}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Optional</p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="flex-1">
                      Use Template
                    </Button>
                    <Button size="sm" variant="outline">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Email Templates Section ───────────────────────────────────

interface EmailTemplateMeta {
  key: EmailTemplate
  label: string
  description: string
  icon: typeof Mail
  accent: 'blue' | 'amber' | 'teal' | 'violet' | 'emerald'
  generator: () => EmailContent
}

const EMAIL_TEMPLATE_META: EmailTemplateMeta[] = [
  {
    key: 'pbc_request',
    label: 'PBC Document Request',
    description: 'Sent when a PBC list is dispatched to the client.',
    icon: Mail,
    accent: 'blue',
    generator: () => pbcRequestEmail('John Smith', '1040', 2025, 'April 15, 2026'),
  },
  {
    key: 'deadline_reminder',
    label: 'Deadline Reminder',
    description: 'Sent when an engagement deadline is approaching.',
    icon: Clock,
    accent: 'amber',
    generator: () => deadlineReminderEmail('John Smith', '1040', 2025, 7, 'April 15, 2026'),
  },
  {
    key: 'document_received',
    label: 'Document Received',
    description: 'Sent when the client uploads a new document.',
    icon: FileText,
    accent: 'teal',
    generator: () => documentReceivedEmail('John Smith', 'W-2', 'W2_2025.pdf'),
  },
  {
    key: 'extraction_complete',
    label: 'Extraction Complete',
    description: 'Sent when AI extraction finishes on a document.',
    icon: Sparkles,
    accent: 'violet',
    generator: () => extractionCompleteEmail('John Smith', 'W-2', 10, 97),
  },
  {
    key: 'welcome',
    label: 'Welcome Email',
    description: 'Sent to a newly created client.',
    icon: Gift,
    accent: 'emerald',
    generator: () => welcomeEmail('John Smith', 'Meridian CPA Group'),
  },
]

const EMAIL_ACCENT_CLASSES: Record<
  EmailTemplateMeta['accent'],
  { border: string; bg: string; text: string; badge: string }
> = {
  blue: {
    border: 'border-l-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
  },
  amber: {
    border: 'border-l-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-600 dark:text-amber-400',
    badge:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  },
  teal: {
    border: 'border-l-teal-500',
    bg: 'bg-teal-50 dark:bg-teal-950/40',
    text: 'text-teal-600 dark:text-teal-400',
    badge: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900',
  },
  violet: {
    border: 'border-l-violet-500',
    bg: 'bg-violet-50 dark:bg-violet-950/40',
    text: 'text-violet-600 dark:text-violet-400',
    badge:
      'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900',
  },
  emerald: {
    border: 'border-l-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  },
}

function EmailTemplatesSection() {
  const [previewKey, setPreviewKey] = useState<EmailTemplate | null>(null)
  const previewMeta = EMAIL_TEMPLATE_META.find((t) => t.key === previewKey) || null
  const previewContent = previewMeta?.generator() ?? null

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Email Templates</h2>
          <p className="text-sm text-muted-foreground">
            Preview the automated client communications sent by TaxDox AI.
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 shrink-0">
          <Mail className="h-3.5 w-3.5" />
          {EMAIL_TEMPLATE_META.length} templates
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EMAIL_TEMPLATE_META.map((meta) => {
          const content = meta.generator()
          const accent = EMAIL_ACCENT_CLASSES[meta.accent]
          const Icon = meta.icon
          const bodyLines = content.body.split('\n').filter((l) => l.trim().length > 0)
          const previewLines = bodyLines.slice(0, 2).join(' ')
          return (
            <Card
              key={meta.key}
              className={cn(
                'group relative overflow-hidden rounded-xl border-l-4 transition-all hover:shadow-md hover:-translate-y-0.5',
                accent.border
              )}
            >
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg',
                        accent.bg,
                        accent.text
                      )}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight">{meta.label}</p>
                      <p className="text-[11px] text-muted-foreground">{meta.description}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <Badge variant="outline" className={cn('text-[10px] font-medium', accent.badge)}>
                    {EMAIL_TEMPLATE_LABELS[meta.key]}
                  </Badge>
                </div>

                <div className="space-y-1 rounded-lg bg-muted/40 p-2.5">
                  <p className="truncate text-xs font-medium" title={content.subject}>
                    <span className="text-muted-foreground">Subject:</span>{' '}
                    <span className="text-foreground">{content.subject}</span>
                  </p>
                  <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                    {previewLines}
                  </p>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => setPreviewKey(meta.key)}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Preview
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <EmailPreviewDialog
        open={previewKey !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewKey(null)
        }}
        meta={previewMeta}
        content={previewContent}
      />
    </div>
  )
}

function EmailPreviewDialog({
  open,
  onOpenChange,
  meta,
  content,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  meta: EmailTemplateMeta | null
  content: EmailContent | null
}) {
  if (!meta || !content) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl" />
      </Dialog>
    )
  }

  const Icon = meta.icon
  const accent = EMAIL_ACCENT_CLASSES[meta.accent]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="border-b p-5 pb-4">
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg',
                accent.bg,
                accent.text
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            {meta.label}
            <Badge variant="outline" className={cn('ml-1 text-[10px]', accent.badge)}>
              {EMAIL_TEMPLATE_LABELS[meta.key]}
            </Badge>
          </DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto">
          {/* Email client-style header */}
          <div className="space-y-2 border-b bg-muted/30 p-5 text-sm">
            <div className="flex items-start gap-2">
              <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">From</span>
              <span className="min-w-0 flex-1">
                <span className="font-medium">Meridian CPA Group</span>{' '}
                <span className="text-muted-foreground">&lt;notifications@meridiancpa.com&gt;</span>
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">To</span>
              <span className="min-w-0 flex-1">
                John Smith <span className="text-muted-foreground">&lt;john.smith@example.com&gt;</span>
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">Subject</span>
              <span className="min-w-0 flex-1 font-medium">{content.subject}</span>
            </div>
          </div>

          {/* Email body */}
          <div className="p-5">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
              {content.body}
            </pre>
          </div>
        </div>

        <DialogFooter className="border-t p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Integrations Section ──────────────────────────────────────

function IntegrationsSection({
  firm,
}: {
  firm: { settings: Record<string, unknown> }
}) {
  const storageProviders = [
    { id: 'box', name: 'Box', vendor: 'Box, Inc.', connected: false, icon: Cloud, color: 'text-blue-500' },
    { id: 'gdrive', name: 'Google Drive', vendor: 'Google', connected: true, icon: HardDrive, color: 'text-emerald-500' },
    { id: 'onedrive', name: 'OneDrive', vendor: 'Microsoft', connected: false, icon: Cloud, color: 'text-cyan-500' },
  ]

  return (
    <div className="space-y-6">
      {/* Tax Software */}
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Tax Software Integrations</CardTitle>
              <CardDescription>Connect your tax preparation software for one-click import.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TAX_SOFTWARE.map((sw) => {
              const initials_ = sw.name
                .split(' ')
                .map((p) => p[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()
              return (
                <div
                  key={sw.id}
                  className={cn(
                    'flex flex-col gap-3 rounded-xl border p-4 transition-all',
                    sw.connected
                      ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20'
                      : 'border-border bg-card hover:border-primary/30'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold',
                          sw.connected
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-primary/10 text-primary'
                        )}
                      >
                        {initials_}
                      </div>
                      <div>
                        <p className="text-sm font-semibold leading-tight">{sw.name}</p>
                        <p className="text-xs text-muted-foreground">{sw.vendor}</p>
                      </div>
                    </div>
                    {sw.connected ? (
                      <Badge className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" /> Disconnected
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={sw.connected ? 'outline' : 'default'}
                    className="mt-auto w-full"
                    onClick={() =>
                      toast.info(
                        sw.connected ? `Configure ${sw.name} integration` : `Connect ${sw.name}`,
                        { description: 'Integration setup is coming soon.' }
                      )
                    }
                  >
                    {sw.connected ? (
                      <>
                        <SettingsIcon className="h-3.5 w-3.5" /> Configure
                      </>
                    ) : (
                      <>
                        <Plug className="h-3.5 w-3.5" /> Connect
                      </>
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Storage */}
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <HardDrive className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Document Storage</CardTitle>
              <CardDescription>Connect cloud storage providers for document import.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {storageProviders.map((sp) => {
              const Icon = sp.icon
              return (
                <div
                  key={sp.id}
                  className={cn(
                    'flex items-center justify-between rounded-xl border p-4',
                    sp.connected
                      ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20'
                      : 'border-border'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <Icon className={cn('h-4.5 w-4.5', sp.color)} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight">{sp.name}</p>
                      <p className="text-xs text-muted-foreground">{sp.vendor}</p>
                    </div>
                  </div>
                  {sp.connected ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toast.info(`Connect ${sp.name}`, { description: 'Coming soon.' })}
                    >
                      Connect
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Multi-country */}
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Multi-Country Support</CardTitle>
              <CardDescription>
                TaxDox AI supports tax jurisdictions in the following countries.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3">
            {COUNTRIES.map((c) => (
              <div
                key={c.code}
                className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-2.5"
              >
                <span className="text-2xl leading-none">{c.flag}</span>
                <div>
                  <p className="text-sm font-semibold leading-tight">{c.label}</p>
                  <p className="text-xs text-muted-foreground">{c.code}</p>
                </div>
                <Badge variant="outline" className="ml-1 gap-1 text-emerald-600 border-emerald-200 dark:border-emerald-900">
                  <Check className="h-3 w-3" /> Active
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Billing Section ───────────────────────────────────────────

function BillingSection({
  firm,
  usageStats,
}: {
  firm: { subscriptionTier: string }
  usageStats: { teamMembers: number; templates: number; connectedSoftware: number; auditEvents: number }
}) {
  const currentTier = PRICING_TIERS.find((t) => t.id === firm.subscriptionTier)
  // Mocked usage numbers (real data would come from a usage endpoint)
  const usage = {
    documentsThisMonth: 312,
    documentsLimit: currentTier?.docsPerMonth === -1 ? null : currentTier?.docsPerMonth ?? 0,
    clients: 12,
    clientsLimit: 100,
    teamMembers: usageStats.teamMembers,
    teamLimit: 50,
  }

  const docUtil = usage.documentsLimit ? Math.round((usage.documentsThisMonth / usage.documentsLimit) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Current plan banner */}
      <Card className="overflow-hidden border-primary/30">
        <div className="relative bg-gradient-primary p-6 text-white">
          <div className="absolute right-0 top-0 h-32 w-32 -translate-y-8 translate-x-8 rounded-full bg-white/10" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/70">
                <Crown className="h-3.5 w-3.5" /> Current Plan
              </div>
              <h3 className="mt-1 text-2xl font-bold">{currentTier?.name} Plan</h3>
              <p className="mt-0.5 text-sm text-white/80">{currentTier?.description}</p>
              <div className="mt-2 text-sm">
                <span className="text-2xl font-bold">
                  {currentTier?.price ? `$${currentTier.price}` : 'Custom'}
                </span>
                {currentTier?.price && <span className="text-white/70">/{currentTier.period}</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/15 text-white hover:bg-white/25"
                onClick={() => toast.info('Manage plan', { description: 'Billing portal coming soon.' })}
              >
                Manage Plan
              </Button>
              <Button
                size="sm"
                className="bg-white text-primary hover:bg-white/90"
                onClick={() => toast.info('Contact sales', { description: 'We will reach out shortly.' })}
              >
                Upgrade
              </Button>
            </div>
          </div>
        </div>
        <CardContent className="grid gap-6 pt-6 sm:grid-cols-3">
          <UsageStat
            label="Documents This Month"
            value={usage.documentsThisMonth}
            limit={usage.documentsLimit}
            util={docUtil}
            icon={FileSpreadsheet}
            accent="primary"
          />
          <UsageStat
            label="Clients"
            value={usage.clients}
            limit={usage.clientsLimit}
            util={Math.round((usage.clients / usage.clientsLimit) * 100)}
            icon={Users}
            accent="info"
          />
          <UsageStat
            label="Team Members"
            value={usage.teamMembers}
            limit={usage.teamLimit}
            util={Math.round((usage.teamMembers / usage.teamLimit) * 100)}
            icon={Users}
            accent="success"
          />
        </CardContent>
      </Card>

      {/* Pricing tiers */}
      <div>
        <h3 className="text-lg font-semibold">Available Plans</h3>
        <p className="text-sm text-muted-foreground">Compare and choose the right plan for your firm.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PRICING_TIERS.map((tier) => {
          const isCurrent = tier.id === firm.subscriptionTier
          const isHighlight = tier.highlight
          return (
            <Card
              key={tier.id}
              className={cn(
                'relative flex flex-col overflow-hidden transition-all',
                isCurrent
                  ? 'border-primary ring-2 ring-primary/30'
                  : isHighlight
                  ? 'border-primary/40 ring-1 ring-primary/20'
                  : 'hover:border-primary/30'
              )}
            >
              {isHighlight && (
                <div className="bg-gradient-primary px-4 py-1 text-center text-xs font-semibold uppercase tracking-wide text-white">
                  Most Popular
                </div>
              )}
              {isCurrent && !isHighlight && (
                <div className="bg-primary px-4 py-1 text-center text-xs font-semibold uppercase tracking-wide text-primary-foreground">
                  Current Plan
                </div>
              )}
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{tier.name}</CardTitle>
                <CardDescription className="line-clamp-2">{tier.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4 pt-0">
                <div className="flex items-baseline gap-1">
                  {tier.price !== null ? (
                    <>
                      <span className="text-3xl font-bold tracking-tight">${tier.price}</span>
                      <span className="text-sm text-muted-foreground">/{tier.period}</span>
                    </>
                  ) : (
                    <span className="text-2xl font-bold tracking-tight">Custom</span>
                  )}
                </div>
                <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Doc limit / month</p>
                  <p className="text-sm font-semibold">
                    {tier.docsPerMonth === -1 ? 'Unlimited' : tier.docsPerMonth.toLocaleString()}
                  </p>
                </div>
                <ul className="flex-1 space-y-2">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="text-foreground/80">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={isCurrent ? 'outline' : isHighlight ? 'default' : 'outline'}
                  disabled={isCurrent}
                  onClick={() =>
                    toast.info(
                      isCurrent
                        ? 'You are on this plan'
                        : tier.price === null
                        ? 'Contact sales'
                        : `Upgrade to ${tier.name}`,
                      { description: isCurrent ? undefined : 'Billing portal coming soon.' }
                    )
                  }
                >
                  {isCurrent ? (
                    <>
                      <Check className="h-4 w-4" /> Current
                    </>
                  ) : tier.price === null ? (
                    'Contact Sales'
                  ) : (
                    `Upgrade to ${tier.name}`
                  )}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function UsageStat({
  label,
  value,
  limit,
  util,
  icon: Icon,
  accent,
}: {
  label: string
  value: number
  limit: number | null
  util: number
  icon: typeof FileSpreadsheet
  accent: 'primary' | 'success' | 'info'
}) {
  const accentClass =
    accent === 'primary'
      ? 'bg-primary/10 text-primary'
      : accent === 'success'
      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
      : 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className={cn('flex h-7 w-7 items-center justify-center rounded-md', accentClass)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</span>
        <span className="text-sm text-muted-foreground">
          / {limit === null ? '∞' : limit.toLocaleString()}
        </span>
      </div>
      <Progress value={Math.min(100, util)} className="h-1.5" />
      <p className="text-xs text-muted-foreground">{util}% used</p>
    </div>
  )
}

// ─── Audit Log Section ─────────────────────────────────────────

function AuditLogSection({ logs }: { logs: AuditLogRow[] }) {
  const actionColor = (action: string) => {
    if (action.includes('login') || action.includes('auth')) return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400'
    if (action.includes('create')) return 'text-primary bg-primary/10'
    if (action.includes('delete')) return 'text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400'
    if (action.includes('update') || action.includes('patch')) return 'text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400'
    return 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300'
  }

  const formatDetails = (details: Record<string, unknown> | string) => {
    if (typeof details === 'string') {
      try {
        return JSON.stringify(JSON.parse(details), null, 0)
      } catch {
        return details
      }
    }
    return JSON.stringify(details)
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <History className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Audit Log</CardTitle>
              <CardDescription>
                Last {logs.length} event{logs.length === 1 ? '' : 's'} across your firm.
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="gap-1">
            <ActivityIcon className="h-3 w-3" /> {logs.length} events
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ScrollText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm font-medium">No audit events yet</p>
            <p className="text-xs text-muted-foreground">Actions taken in TaxDox will appear here.</p>
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-22rem)] min-h-[320px]">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead className="hidden md:table-cell">IP Address</TableHead>
                  <TableHead className="hidden lg:table-cell">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium tabular-nums">
                          {format(new Date(log.createdAt), 'MMM d, yyyy')}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                          <Clock12 /> {format(new Date(log.createdAt), 'HH:mm:ss')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code
                        className={cn(
                          'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
                          actionColor(log.action)
                        )}
                      >
                        {log.action}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Hash className="h-3 w-3" />
                        {log.resourceType || '—'}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <code className="text-xs text-muted-foreground tabular-nums">
                        {log.ipAddress || '—'}
                      </code>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <code className="line-clamp-1 max-w-md text-xs text-muted-foreground">
                        {formatDetails(log.details)}
                      </code>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

// Small clock icon (since lucide Clock may conflict with naming)
function Clock12(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

// ─── Add Team Member Dialog ────────────────────────────────────

function AddTeamMemberDialog({
  open,
  onOpenChange,
  firmId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  firmId: string
  onCreated: (m: TeamMemberRow) => void
}) {
  const [form, setForm] = useState({
    name: '',
    role: 'preparer',
    email: '',
    capacity: 10,
    color: 'emerald',
  })
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setForm({ name: '', role: 'preparer', email: '', capacity: 10, color: 'emerald' })
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error('Valid email is required')
      return
    }
    if (!firmId) {
      toast.error('Firm not loaded yet — try again')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/settings/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, firmId }),
      })
      if (!res.ok) throw new Error('Failed to create team member')
      const data = await res.json()
      onCreated(data.member)
      toast.success(`${form.name} added to the team`)
      reset()
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error('Failed to add team member')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
          <DialogDescription>
            Create a new team member record. Role controls permissions and capacity sets max concurrent load.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="tm-name">Name *</Label>
            <Input
              id="tm-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Jordan Smith"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="tm-role">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger id="tm-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="partner">Partner</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="preparer">Preparer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="read-only">Read-only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tm-capacity">Capacity</Label>
              <Input
                id="tm-capacity"
                type="number"
                min={1}
                max={50}
                value={form.capacity}
                onChange={(e) => setForm((f) => ({ ...f, capacity: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tm-email">Email *</Label>
            <Input
              id="tm-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="name@firm.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Avatar Color</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(TEAM_COLOR_HEX).map(([key, hex]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color: key }))}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-white transition-all',
                    form.color === key ? 'ring-2 ring-offset-2 ring-offset-background ring-primary scale-110' : 'opacity-80 hover:opacity-100'
                  )}
                  style={{ backgroundColor: hex }}
                  aria-label={key}
                >
                  {form.color === key && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Create Template Dialog ────────────────────────────────────

function CreateTemplateDialog({
  open,
  onOpenChange,
  firmId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  firmId: string
  onCreated: (t: PbcTemplateRow) => void
}) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    clientType: 'individual',
    engagementType: '1040',
  })
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setForm({ name: '', description: '', clientType: 'individual', engagementType: '1040' })
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Template name is required')
      return
    }
    if (!firmId) {
      toast.error('Firm not loaded yet — try again')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/settings/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, firmId, items: [] }),
      })
      if (!res.ok) throw new Error('Failed to create template')
      const data = await res.json()
      onCreated({ ...data.template, items: [] })
      toast.success(`Template "${form.name}" created`)
      reset()
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error('Failed to create template')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create PBC Template</DialogTitle>
          <DialogDescription>
            Templates let you standardize document request lists across similar engagements.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="tpl-name">Template Name *</Label>
            <Input
              id="tpl-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Standard 1040 Individual"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tpl-desc">Description</Label>
            <Input
              id="tpl-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Short description of when to use this template"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="tpl-client">Client Type</Label>
              <Select value={form.clientType} onValueChange={(v) => setForm((f) => ({ ...f, clientType: v }))}>
                <SelectTrigger id="tpl-client">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_TYPES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.icon} {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-eng">Engagement Type</Label>
              <Select value={form.engagementType} onValueChange={(v) => setForm((f) => ({ ...f, engagementType: v }))}>
                <SelectTrigger id="tpl-eng">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENGAGEMENT_TYPES.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5" />
              You can add PBC items to this template from the engagement view after creation.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Skeleton ──────────────────────────────────────────────────

function SettingsSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 animate-pulse rounded-xl bg-muted" />
          <div className="space-y-2">
            <div className="h-6 w-32 animate-pulse rounded bg-muted" />
            <div className="h-3 w-64 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  )
}
