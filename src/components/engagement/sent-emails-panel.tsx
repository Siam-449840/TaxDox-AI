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
} from 'lucide-react'
import { format, formatDistanceToNow, differenceInDays } from 'date-fns'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
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
    engagementType: string
    taxYear: number
    deadline?: string | null
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

export function SentEmailsPanel({ engagementId, engagement }: SentEmailsPanelProps) {
  const [emails, setEmails] = useState<EmailLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [sendingReminder, setSendingReminder] = useState(false)

  const fetchEmails = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/emails?engagementId=${engagementId}`)
      if (!res.ok) throw new Error('Failed to load emails')
      const json = await res.json()
      setEmails((json.emails as EmailLogRow[]) ?? [])
    } catch {
      toast.error('Could not load sent emails')
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
              onClick={handleSendReminder}
              disabled={sendingReminder || !engagement}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
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

      {/* List */}
      {loading ? (
        <SentEmailsSkeleton />
      ) : emails.length === 0 ? (
        <EmptyState onSendReminder={handleSendReminder} sendingReminder={sendingReminder} />
      ) : (
        <div className="space-y-2.5">
          {emails.map((email) => (
            <EmailCard
              key={email.id}
              email={email}
              expanded={expanded.has(email.id)}
              onToggle={() => toggleExpand(email.id)}
            />
          ))}
        </div>
      )}
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
}: {
  onSendReminder: () => void
  sendingReminder: boolean
}) {
  return (
    <Card className="rounded-xl p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Inbox className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mt-3 text-base font-semibold">No emails sent yet</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Once a PBC list is sent or a reminder is dispatched, the simulated
        emails will appear here. Click below to send a deadline reminder.
      </p>
      <div className="mt-4 flex justify-center">
        <Button
          onClick={onSendReminder}
          disabled={sendingReminder}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {sendingReminder ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <>
              <CalendarClock className="mr-1.5 h-4 w-4" />
              Send Deadline Reminder
            </>
          )}
        </Button>
      </div>
    </Card>
  )
}
