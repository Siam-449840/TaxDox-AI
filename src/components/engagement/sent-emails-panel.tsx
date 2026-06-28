'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Mail,
  Send,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sparkles,
  Bell,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Inbox,
  PartyPopper,
  Loader2,
  CalendarClock,
  Plus,
  Filter,
} from 'lucide-react'
import { format, formatDistanceToNow, differenceInDays } from 'date-fns'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  EMAIL_TEMPLATE_LABELS,
  type EmailTemplate,
} from '@/lib/email-templates'

/* ────────────────────────────────────────────────────────────────────────────
 *  Types
 * ────────────────────────────────────────────────────────────────────────── */

interface EmailLogRow {
  id: string
  firmId: string
  engagementId: string | null
  clientId: string | null
  toEmail: string
  toName: string
  fromName: string
  subject: string
  body: string
  template: EmailTemplate
  status: 'sent' | 'delivered' | 'opened' | 'failed'
  sentAt: string
  createdAt: string
  client?: { id: string; name: string; email: string } | null
  engagement?: { id: string; engagementType: string; taxYear: number } | null
}

interface SentEmailsPanelProps {
  engagementId: string
  /** Optional engagement metadata used to power the "Send Reminder" button. */
  engagement?: {
    clientName: string
    clientEmail?: string
    clientId?: string
    engagementType: string
    taxYear: number
    deadline?: string | null
  }
  /** Optional handler for the "Send PBC Request" CTA shown in the empty state. */
  onSendPbc?: () => void
  /** When true, disables the Send PBC button (e.g. while the request is in flight). */
  sendingPbc?: boolean
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Status filter tabs
 * ────────────────────────────────────────────────────────────────────────── */

type StatusFilter = 'all' | 'sent' | 'delivered' | 'opened'

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'sent', label: 'Sent' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'opened', label: 'Opened' },
]

/* ────────────────────────────────────────────────────────────────────────────
 *  Compose dialog — template presets
 * ────────────────────────────────────────────────────────────────────────── */

type ComposeTemplateKey =
  | 'custom'
  | 'pbc_request'
  | 'deadline_reminder'
  | 'document_received'
  | 'extraction_complete'

const COMPOSE_TEMPLATE_OPTIONS: {
  key: ComposeTemplateKey
  label: string
}[] = [
  { key: 'custom', label: 'Custom' },
  { key: 'pbc_request', label: 'PBC Request' },
  { key: 'deadline_reminder', label: 'Deadline Reminder' },
  { key: 'document_received', label: 'Document Received' },
  { key: 'extraction_complete', label: 'Extraction Complete' },
]

/** Pre-fill subject + body when a template is picked in the Compose dialog. */
function templatePreset(
  template: ComposeTemplateKey,
  ctx: { clientName: string; engagementType: string; taxYear: number }
): { subject: string; body: string } {
  switch (template) {
    case 'pbc_request':
      return {
        subject: `Action Required: Document Request for Your ${ctx.engagementType} Tax Return (${ctx.taxYear})`,
        body: `Dear ${ctx.clientName},\n\nWe are preparing your ${ctx.engagementType} tax return for tax year ${ctx.taxYear}. Please log in to the secure client portal and upload the requested documents at your earliest convenience.\n\nSecure portal: https://portal.meridiancpa.com\n\nIf you have any questions, simply reply to this email.\n\nBest regards,\nMeridian CPA Group`,
      }
    case 'deadline_reminder':
      return {
        subject: `Reminder: Documents needed for your ${ctx.engagementType} (${ctx.taxYear})`,
        body: `Dear ${ctx.clientName},\n\nThis is a friendly reminder that we still need a few documents to finalize your ${ctx.engagementType} return for tax year ${ctx.taxYear}. Please upload them via the secure client portal as soon as possible.\n\nSecure portal: https://portal.meridiancpa.com\n\nIf you have already uploaded everything, you can disregard this message.\n\nBest regards,\nMeridian CPA Group`,
      }
    case 'document_received':
      return {
        subject: `Document received — thank you`,
        body: `Dear ${ctx.clientName},\n\nWe have received your document and added it to your engagement workspace. Our AI engine will classify and extract the key fields automatically, and a preparer will review the data shortly.\n\nYou can track the status of all your documents in real time in the secure client portal.\n\nSecure portal: https://portal.meridiancpa.com\n\nBest regards,\nMeridian CPA Group`,
      }
    case 'extraction_complete':
      return {
        subject: `AI extraction complete — your document is ready for review`,
        body: `Dear ${ctx.clientName},\n\nWe have finished AI-extracting the data from your document. A member of our team will verify the extracted data and reach out if anything looks unclear.\n\nYou can review the extracted data in the secure client portal at any time.\n\nSecure portal: https://portal.meridiancpa.com\n\nBest regards,\nMeridian CPA Group`,
      }
    case 'custom':
    default:
      return { subject: '', body: '' }
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Color config — keyed by template key and email status.
 *  Keeps Tailwind classes static so the JIT compiler can pick them up.
 * ────────────────────────────────────────────────────────────────────────── */

const TEMPLATE_BADGE: Record<
  EmailTemplate,
  { label: string; icon: typeof Mail; classes: string; dot: string }
> = {
  pbc_request: {
    label: EMAIL_TEMPLATE_LABELS.pbc_request,
    icon: FileText,
    classes:
      'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-800/60',
    dot: 'bg-blue-500',
  },
  deadline_reminder: {
    label: EMAIL_TEMPLATE_LABELS.deadline_reminder,
    icon: Clock,
    classes:
      'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/60',
    dot: 'bg-amber-500',
  },
  document_received: {
    label: EMAIL_TEMPLATE_LABELS.document_received,
    icon: CheckCircle2,
    classes:
      'bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:ring-teal-800/60',
    dot: 'bg-teal-500',
  },
  extraction_complete: {
    label: EMAIL_TEMPLATE_LABELS.extraction_complete,
    icon: Sparkles,
    classes:
      'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800/60',
    dot: 'bg-violet-500',
  },
  welcome: {
    label: EMAIL_TEMPLATE_LABELS.welcome,
    icon: PartyPopper,
    classes:
      'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/60',
    dot: 'bg-emerald-500',
  },
  custom: {
    label: EMAIL_TEMPLATE_LABELS.custom,
    icon: Mail,
    classes:
      'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:ring-slate-700',
    dot: 'bg-slate-400',
  },
}

const STATUS_BADGE: Record<
  EmailLogRow['status'],
  { label: string; classes: string; dot: string; icon: typeof Mail }
> = {
  sent: {
    label: 'Sent',
    classes:
      'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300',
    dot: 'bg-slate-400',
    icon: Send,
  },
  delivered: {
    label: 'Delivered',
    classes:
      'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300',
    dot: 'bg-teal-500',
    icon: CheckCircle2,
  },
  opened: {
    label: 'Opened',
    classes:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    classes:
      'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
    dot: 'bg-red-500',
    icon: AlertTriangle,
  },
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Main panel
 * ────────────────────────────────────────────────────────────────────────── */

export function SentEmailsPanel({
  engagementId,
  engagement,
  onSendPbc,
  sendingPbc,
}: SentEmailsPanelProps) {
  const [emails, setEmails] = useState<EmailLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [sendingReminder, setSendingReminder] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // Compose dialog state
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeTemplate, setComposeTemplate] =
    useState<ComposeTemplateKey>('custom')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [sendingCompose, setSendingCompose] = useState(false)

  const fetchEmails = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/emails?engagementId=${engagementId}`)
      if (!res.ok) throw new Error('Failed to load emails')
      const json = await res.json()
      setEmails((json.emails as EmailLogRow[]) ?? [])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [engagementId])

  useEffect(() => {
    fetchEmails()
  }, [fetchEmails])

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const daysLeft = useMemo(() => {
    if (!engagement?.deadline) return null
    return differenceInDays(new Date(engagement.deadline), new Date())
  }, [engagement?.deadline])

  const handleSendReminder = async () => {
    if (!engagement) {
      toast.error('Engagement details not available')
      return
    }
    setSendingReminder(true)
    try {
      const res = await fetch('/api/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engagementId,
          template: 'deadline_reminder',
          payload: {
            clientName: engagement.clientName,
            engagementType: engagement.engagementType,
            taxYear: engagement.taxYear,
            deadline: engagement.deadline ?? new Date(),
            daysLeft: daysLeft ?? 14,
          },
        }),
      })
      if (!res.ok) throw new Error('Failed to send reminder')
      toast.success('Deadline reminder sent to client')
      await fetchEmails()
    } catch {
      toast.error('Could not send reminder')
    } finally {
      setSendingReminder(false)
    }
  }

  /* ── Derived stats ───────────────────────────────────────────── */
  const stats = useMemo(() => {
    const total = emails.length
    const opened = emails.filter((e) => e.status === 'opened').length
    const delivered = emails.filter((e) =>
      ['delivered', 'opened'].includes(e.status)
    ).length
    const failed = emails.filter((e) => e.status === 'failed').length
    return { total, opened, delivered, failed }
  }, [emails])

  /* ── Status filter counts + filtered list ────────────────────── */
  const statusCounts = useMemo(() => {
    return {
      all: emails.length,
      sent: emails.filter((e) => e.status === 'sent').length,
      delivered: emails.filter((e) => e.status === 'delivered').length,
      opened: emails.filter((e) => e.status === 'opened').length,
    } satisfies Record<StatusFilter, number>
  }, [emails])

  const filteredEmails = useMemo(() => {
    if (statusFilter === 'all') return emails
    return emails.filter((e) => e.status === statusFilter)
  }, [emails, statusFilter])

  /* ── Compose dialog handlers ─────────────────────────────────── */
  const openCompose = () => {
    setComposeTemplate('custom')
    setComposeSubject('')
    setComposeBody('')
    setComposeOpen(true)
  }

  const handleComposeTemplateChange = (key: ComposeTemplateKey) => {
    setComposeTemplate(key)
    if (!engagement) return
    // For any template (including switching back to "Custom"), pre-fill
    // subject + body from the preset. Custom returns empty strings so the
    // user can start fresh; other templates seed a sensible default that
    // the user can then edit before sending.
    const preset = templatePreset(key, {
      clientName: engagement.clientName,
      engagementType: engagement.engagementType,
      taxYear: engagement.taxYear,
    })
    setComposeSubject(preset.subject)
    setComposeBody(preset.body)
  }

  const handleSendCompose = async () => {
    if (!engagement) {
      toast.error('Engagement details not available')
      return
    }
    const subject = composeSubject.trim()
    const body = composeBody.trim()
    if (!subject) {
      toast.error('Please enter a subject')
      return
    }
    if (!body) {
      toast.error('Please enter a message')
      return
    }
    setSendingCompose(true)
    try {
      const res = await fetch('/api/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engagementId,
          clientId: engagement.clientId,
          toEmail: engagement.clientEmail,
          toName: engagement.clientName,
          subject,
          body,
          template: 'custom',
        }),
      })
      if (!res.ok) throw new Error('Failed to send email')
      toast.success('Email sent to client')
      setComposeOpen(false)
      await fetchEmails()
    } catch {
      toast.error('Could not send email')
    } finally {
      setSendingCompose(false)
    }
  }

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      {/* Header / toolbar */}
      <Card className="rounded-xl p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Sent Emails</h3>
              <p className="text-xs text-muted-foreground">
                Outbound client communications for this engagement.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchEmails}
              disabled={loading}
            >
              <RefreshCw
                className={cn(
                  'mr-1.5 h-4 w-4',
                  loading && 'animate-spin'
                )}
              />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={openCompose}
              disabled={!engagement}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Compose
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSendReminder}
              disabled={sendingReminder || !engagement}
              className="border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
            >
              {sendingReminder ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Bell className="mr-1.5 h-4 w-4" />
              )}
              Send Reminder
            </Button>
          </div>
        </div>

        {/* Mini stat row */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniStat label="Total" value={stats.total} accent="text-foreground" />
          <MiniStat
            label="Delivered"
            value={stats.delivered}
            accent="text-teal-600 dark:text-teal-400"
          />
          <MiniStat
            label="Opened"
            value={stats.opened}
            accent="text-emerald-600 dark:text-emerald-400"
          />
          <MiniStat
            label="Failed"
            value={stats.failed}
            accent={
              stats.failed > 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-muted-foreground'
            }
          />
        </div>
      </Card>

      {/* Status filter tabs */}
      {emails.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 hidden items-center gap-1 text-xs font-medium text-muted-foreground sm:inline-flex">
            <Filter className="h-3.5 w-3.5" />
            Filter:
          </span>
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.key
            const count = statusCounts[f.key]
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-primary/50 dark:hover:text-primary'
                )}
              >
                {f.label}
                <span
                  className={cn(
                    'inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums',
                    active
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* List */}
      {loading ? (
        <SentEmailsSkeleton />
      ) : error ? (
        <ErrorState onRetry={fetchEmails} />
      ) : emails.length === 0 ? (
        <EmptyState
          onSendReminder={handleSendReminder}
          sendingReminder={sendingReminder}
          onSendPbc={onSendPbc}
          sendingPbc={sendingPbc}
        />
      ) : filteredEmails.length === 0 ? (
        <Card className="rounded-xl border-dashed bg-muted/20 p-8 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Inbox className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">
            No {statusFilter === 'all' ? '' : statusFilter} emails
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try switching to a different status filter.
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filteredEmails.map((email) => (
            <EmailCard
              key={email.id}
              email={email}
              expanded={expanded.has(email.id)}
              onToggle={() => toggleExpand(email.id)}
            />
          ))}
        </div>
      )}

      {/* Compose dialog */}
      <ComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        toEmail={engagement?.clientEmail ?? ''}
        toName={engagement?.clientName ?? ''}
        template={composeTemplate}
        onTemplateChange={handleComposeTemplateChange}
        subject={composeSubject}
        onSubjectChange={setComposeSubject}
        body={composeBody}
        onBodyChange={setComposeBody}
        sending={sendingCompose}
        onSend={handleSendCompose}
      />
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Sub-components
 * ────────────────────────────────────────────────────────────────────────── */

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent: string
}) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn('mt-0.5 text-lg font-bold tabular-nums', accent)}>
        {value}
      </p>
    </div>
  )
}

function EmailCard({
  email,
  expanded,
  onToggle,
}: {
  email: EmailLogRow
  expanded: boolean
  onToggle: () => void
}) {
  const tcfg = TEMPLATE_BADGE[email.template] ?? TEMPLATE_BADGE.pbc_request
  const scfg = STATUS_BADGE[email.status] ?? STATUS_BADGE.sent
  const TplIcon = tcfg.icon
  const StIcon = scfg.icon
  const sentDate = new Date(email.sentAt)
  const preview = email.body
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140)

  return (
    <Card
      className={cn(
        'group overflow-hidden rounded-xl transition-shadow hover:shadow-md',
        expanded && 'shadow-md'
      )}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 p-3.5 text-left sm:p-4"
        aria-expanded={expanded}
      >
        {/* Template icon */}
        <div
          className={cn(
            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            tcfg.classes
          )}
        >
          <TplIcon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold leading-tight">
              {email.subject}
            </p>
            <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
              {format(sentDate, 'MMM d, h:mm a')}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">
              To: {email.toName}
            </span>
            <span className="opacity-50">·</span>
            <span className="truncate">{email.toEmail}</span>
          </div>
          {!expanded && (
            <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">
              {preview}
              {email.body.length > 140 ? '…' : ''}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                tcfg.classes
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', tcfg.dot)} />
              {tcfg.label}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                scfg.classes
              )}
            >
              <StIcon className="h-3 w-3" />
              {scfg.label}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(sentDate, { addSuffix: true })}
            </span>
          </div>
        </div>

        {/* Expand chevron */}
        <div className="mt-1 shrink-0 self-start text-muted-foreground transition-transform group-hover:text-foreground">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <>
          <Separator />
          <div className="bg-muted/30 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span>
                <span className="font-medium text-foreground/70">From:</span>{' '}
                {email.fromName}
              </span>
              <span>
                <span className="font-medium text-foreground/70">To:</span>{' '}
                {email.toName} &lt;{email.toEmail}&gt;
              </span>
              <span>
                <span className="font-medium text-foreground/70">Sent:</span>{' '}
                {format(sentDate, "MMM d, yyyy 'at' h:mm a")}
              </span>
            </div>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground/90">
              {email.body}
            </pre>
          </div>
        </>
      )}
    </Card>
  )
}

function SentEmailsSkeleton() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function EmptyState({
  onSendReminder,
  sendingReminder,
  onSendPbc,
  sendingPbc,
}: {
  onSendReminder: () => void
  sendingReminder: boolean
  onSendPbc?: () => void
  sendingPbc?: boolean
}) {
  return (
    <Card className="rounded-xl border-dashed bg-gradient-to-b from-teal-50/60 to-transparent p-10 text-center dark:from-teal-950/20">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300">
        <Mail className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-base font-semibold">No emails sent yet</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
        When you send PBC requests or reminders, they&apos;ll appear here.
        Client confirmations and AI extraction notices also show up
        automatically.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {onSendPbc && (
          <Button
            onClick={onSendPbc}
            disabled={sendingPbc}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {sendingPbc ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-4 w-4" />
            )}
            Send PBC Request
          </Button>
        )}
        <Button
          variant={onSendPbc ? 'outline' : 'default'}
          onClick={onSendReminder}
          disabled={sendingReminder}
          className={
            onSendPbc
              ? undefined
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }
        >
          {sendingReminder ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <CalendarClock className="mr-1.5 h-4 w-4" />
          )}
          Send Reminder
        </Button>
      </div>
    </Card>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="rounded-xl border-amber-200 bg-amber-50/70 p-8 text-center dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
        <Inbox className="h-6 w-6" />
      </div>
      <h3 className="mt-3 text-base font-semibold text-amber-900 dark:text-amber-200">
        Couldn&apos;t load emails right now
      </h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-amber-700/80 dark:text-amber-300/80">
        Your sent emails are still safe — we just couldn&apos;t reach the
        server. Give it another try in a moment.
      </p>
      <div className="mt-4 flex justify-center">
        <Button
          variant="outline"
          onClick={onRetry}
          className="border-amber-300 bg-white text-amber-800 hover:bg-amber-100 hover:text-amber-900 dark:border-amber-800 dark:bg-transparent dark:text-amber-200 dark:hover:bg-amber-950/40"
        >
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Try again
        </Button>
      </div>
    </Card>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Compose dialog
 * ────────────────────────────────────────────────────────────────────────── */

function ComposeDialog({
  open,
  onOpenChange,
  toEmail,
  toName,
  template,
  onTemplateChange,
  subject,
  onSubjectChange,
  body,
  onBodyChange,
  sending,
  onSend,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  toEmail: string
  toName: string
  template: ComposeTemplateKey
  onTemplateChange: (key: ComposeTemplateKey) => void
  subject: string
  onSubjectChange: (value: string) => void
  body: string
  onBodyChange: (value: string) => void
  sending: boolean
  onSend: () => void
}) {
  const canSend = subject.trim().length > 0 && body.trim().length > 0 && !sending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Mail className="h-4 w-4" />
            </span>
            Compose Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          {/* To (read-only) */}
          <div className="space-y-1.5">
            <Label htmlFor="compose-to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input
              id="compose-to"
              value={toName && toEmail ? `${toName} <${toEmail}>` : toEmail || '—'}
              readOnly
              disabled
              className="bg-muted/40 text-xs"
            />
          </div>

          {/* Template selector */}
          <div className="space-y-1.5">
            <Label htmlFor="compose-template" className="text-xs text-muted-foreground">
              Template
            </Label>
            <Select
              value={template}
              onValueChange={(v) => onTemplateChange(v as ComposeTemplateKey)}
            >
              <SelectTrigger id="compose-template" className="text-xs">
                <SelectValue placeholder="Pick a template" />
              </SelectTrigger>
              <SelectContent>
                {COMPOSE_TEMPLATE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Selecting a template pre-fills the subject and body.
            </p>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="compose-subject" className="text-xs text-muted-foreground">
              Subject
            </Label>
            <Input
              id="compose-subject"
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              placeholder="Enter email subject"
              className="text-xs"
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label htmlFor="compose-body" className="text-xs text-muted-foreground">
              Message
            </Label>
            <Textarea
              id="compose-body"
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              placeholder="Type your message…"
              rows={8}
              className="min-h-[160px] resize-y text-xs leading-relaxed"
            />
          </div>
        </div>

        <DialogFooter className="border-t border-slate-100 px-5 py-3 dark:border-slate-800">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onSend}
            disabled={!canSend}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {sending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-4 w-4" />
            )}
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
