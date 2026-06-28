'use client'

import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Send,
  Upload,
  FileText,
  FileImage,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Sparkles,
  Mail,
  MessageSquare,
  Download,
  FileCheck2,
  RefreshCw,
  CalendarClock,
  Layers,
  ListChecks,
  Bot,
  Pencil,
  CircleDot,
  Loader2,
  PartyPopper,
  FileDown,
  ArrowRight,
  CheckCircle,
  Filter,
  FileX2,
  Inbox,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { StatusBadge } from '@/components/shared/status-badge'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { ProgressRing } from '@/components/shared/progress-ring'
import { ConfidenceMeter } from '@/components/shared/confidence-meter'
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_TYPE_MAP,
  WORKFLOW_STEPS,
  ENGAGEMENT_TYPES,
} from '@/lib/constants'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { format, formatDistanceToNow, differenceInDays } from 'date-fns'
import { cn } from '@/lib/utils'
import type {
  Engagement,
  PbcItem,
  TaxDocument,
  Extraction,
  Workflow,
  Activity,
  Message,
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
  avatar?: string | null
}

type EngagementDetail = Engagement & {
  client: NonNullable<Engagement['client']>
  assignedTo?: AssignedUser | null
  pbcList?: {
    id: string
    name: string
    sentAt?: string | null
    sentVia?: string | null
    items: PbcItem[]
  } | null
  documents?: TaxDocument[]
  workflows?: Workflow[]
  messages?: Message[]
  activities?: Activity[]
}

type DocFilterKey = 'all' | 'processing' | 'processed' | 'reviewed'

const TAB_VALUES = ['pbc', 'documents', 'extraction', 'workflow', 'messages'] as const
type TabValue = (typeof TAB_VALUES)[number]

/* ────────────────────────────────────────────────────────────────────────────
 *  Helpers
 * ────────────────────────────────────────────────────────────────────────── */

function fileIconFor(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv'))
    return FileSpreadsheet
  return FileText
}

function formatFileSize(bytes: number) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function engagementTypeLabel(type: string) {
  return ENGAGEMENT_TYPES.find((t) => t.value === type)?.label ?? type
}

function categoryLabel(categoryId: string) {
  return DOCUMENT_CATEGORIES.find((c) => c.id === categoryId)?.label ?? categoryId
}

function initials(name?: string | null) {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('')
}

function pbcStatusRank(status: string): number {
  const order = ['pending', 'uploaded', 'processing', 'extracted', 'reviewed', 'rejected']
  return order.indexOf(status)
}

function isPbcComplete(status: string) {
  return ['extracted', 'reviewed'].includes(status)
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Main view
 * ────────────────────────────────────────────────────────────────────────── */

export function EngagementDetailView() {
  const engagementId = useAppStore((s) => s.selectedEngagementId)
  const navigate = useAppStore((s) => s.navigate)
  const openDocument = useAppStore((s) => s.openDocument)

  const [data, setData] = useState<EngagementDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState<TabValue>('pbc')
  const [processingDocIds, setProcessingDocIds] = useState<Set<string>>(new Set())
  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({})

  const fetchEngagement = useCallback(async () => {
    if (!engagementId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/engagements/${engagementId}`)
      if (!res.ok) {
        setNotFound(true)
        setLoading(false)
        return
      }
      const json = await res.json()
      setData(json.engagement as EngagementDetail)
      setNotFound(false)
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [engagementId])

  useEffect(() => {
    if (!engagementId) {
      setLoading(false)
      return
    }
    fetchEngagement()
  }, [engagementId, fetchEngagement])

  /* ── Actions ─────────────────────────────────────────────────────────── */

  const setBusy = (key: string, v: boolean) =>
    setActionBusy((s) => ({ ...s, [key]: v }))

  const handleGeneratePbc = async () => {
    if (!engagementId) return
    setBusy('gen-pbc', true)
    try {
      const res = await fetch(`/api/engagements/${engagementId}/pbc`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      toast.success('PBC list generated from default template')
      await fetchEngagement()
    } catch {
      toast.error('Could not generate PBC list')
    } finally {
      setBusy('gen-pbc', false)
    }
  }

  const handleSendPbc = async () => {
    if (!engagementId) return
    setBusy('send-pbc', true)
    try {
      const res = await fetch(`/api/engagements/${engagementId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ via: 'email' }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('PBC list sent to client via email')
      await fetchEngagement()
    } catch {
      toast.error('Could not send PBC list')
    } finally {
      setBusy('send-pbc', false)
    }
  }

  const handleAddPbcItem = async (pbcListId: string) => {
    const description = window.prompt('Describe the document you want to request:')
    if (!description) return
    const documentType = window.prompt(
      'Document type (e.g. W-2, 1099-INT, Bank-Statement):',
      'Other'
    )
    if (!documentType) return
    setBusy('add-pbc', true)
    try {
      const res = await fetch(`/api/pbc-lists/${pbcListId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType,
          description,
          category: 'other',
          required: false,
          priority: 'medium' as Priority,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('PBC item added')
      await fetchEngagement()
    } catch {
      toast.error('Could not add PBC item')
    } finally {
      setBusy('add-pbc', false)
    }
  }

  const handleProcessWithAI = async (docId: string) => {
    setProcessingDocIds((s) => new Set(s).add(docId))
    const t1 = toast.loading('Classifying document with AI…')
    try {
      const classifyRes = await fetch('/api/ai/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId }),
      })
      if (!classifyRes.ok) throw new Error('Classify failed')
      const classifyJson = await classifyRes.json()
      toast.success(`Classified as ${classifyJson.documentType ?? 'Unknown'}`, { id: t1 })

      const t2 = toast.loading('Extracting fields with AI…')
      const extractRes = await fetch('/api/ai/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId }),
      })
      if (!extractRes.ok) throw new Error('Extract failed')
      const extractJson = await extractRes.json()
      toast.success(`Extracted ${extractJson.extractions?.length ?? 0} fields`, { id: t2 })
      await fetchEngagement()
    } catch {
      toast.error('AI processing failed', { id: t1 })
    } finally {
      setProcessingDocIds((s) => {
        const next = new Set(s)
        next.delete(docId)
        return next
      })
    }
  }

  const handleReextractAll = async () => {
    if (!data?.documents?.length) {
      toast.info('No documents to process')
      return
    }
    const uploaded = data.documents.filter((d) => d.status === 'uploaded')
    if (uploaded.length === 0) {
      toast.info('All documents already processed')
      return
    }
    toast.promise(
      Promise.all(uploaded.map((d) => handleProcessWithAI(d.id))),
      {
        loading: `Re-extracting ${uploaded.length} documents…`,
        success: `Re-extracted ${uploaded.length} documents`,
        error: 'Some documents failed to extract',
      }
    )
  }

  const handleAdvanceWorkflow = async () => {
    if (!data || !engagementId) return
    const steps = data.workflows ?? []
    const currentIndex = steps.findIndex((w) => w.status === 'in_progress')
    const nextPendingIndex = steps.findIndex((w) => w.status === 'pending')
    const targetIndex = currentIndex >= 0 ? currentIndex : nextPendingIndex
    if (targetIndex < 0) {
      toast.info('Workflow is already complete')
      return
    }
    const currentStep = steps[targetIndex]
    const nextStep = steps[targetIndex + 1]
    setBusy('advance', true)
    try {
      // PATCH engagement status to mirror workflow progress.
      const statusMap: Record<string, string> = {
        create: 'created',
        pbc_send: 'pbc_sent',
        collection: 'collecting',
        ai_processing: 'processing',
        human_review: 'review',
        tax_import: 'filing',
        filing: 'filing',
        delivery: 'done',
      }
      const nextStatus = nextStep ? statusMap[nextStep.step] ?? data.status : 'done'
      const newProgress = Math.round(((targetIndex + 1) / WORKFLOW_STEPS.length) * 100)

      await fetch(`/api/engagements/${engagementId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, progress: newProgress }),
      })

      // Optimistically advance workflow locally (no dedicated endpoint).
      setData((prev) =>
        prev
          ? {
              ...prev,
              status: nextStatus as Engagement['status'],
              progress: newProgress,
              workflows: prev.workflows?.map((w, i) => {
                if (i === targetIndex)
                  return {
                    ...w,
                    status: 'completed',
                    completedAt: new Date().toISOString(),
                  }
                if (i === targetIndex + 1)
                  return {
                    ...w,
                    status: 'in_progress',
                    startedAt: new Date().toISOString(),
                  }
                return w
              }),
            }
          : prev
      )
      toast.success(`Advanced to "${nextStep ? stepLabel(nextStep.step) : 'Delivery'}"`)
    } catch {
      toast.error('Could not advance workflow')
    } finally {
      setBusy('advance', false)
    }
  }

  const handleExport = (format: 'csv' | 'ultratax' | 'excel') => {
    if (!data) return
    const docs = data.documents ?? []
    const extractions = docs.flatMap((d) => d.extractions ?? [])
    if (extractions.length === 0) {
      toast.info('No extractions to export yet')
      return
    }
    setBusy(`export-${format}`, true)
    setTimeout(() => {
      setBusy(`export-${format}`, false)
      const labels: Record<typeof format, string> = {
        csv: 'CSV',
        ultratax: 'UltraTax CS',
        excel: 'Excel (.xlsx)',
      }
      toast.success(`Exported ${extractions.length} fields to ${labels[format]}`)
    }, 700)
  }

  const handleSendMessage = async (content: string) => {
    if (!engagementId || !content.trim()) return
    const newMsg: Message = {
      id: `local-${Date.now()}`,
      engagementId,
      fromType: 'user',
      content: content.trim(),
      read: true,
      createdAt: new Date().toISOString(),
    }
    setData((prev) =>
      prev ? { ...prev, messages: [...(prev.messages ?? []), newMsg] } : prev
    )
    setBusy('send-msg', true)
    setTimeout(() => setBusy('send-msg', false), 400)
    toast.success('Message sent to client')
  }

  const handleSuggestReply = async (
    onSuggest: (text: string) => void
  ): Promise<void> => {
    if (!data) return
    setBusy('suggest', true)
    try {
      const recent = (data.messages ?? []).slice(-6).map((m) => ({
        role: m.fromType === 'user' ? 'assistant' : 'user',
        content: m.content,
      }))
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Suggest a short, professional reply to the client's most recent message for the ${data.engagementType} (${data.taxYear}) engagement for ${data.client.name}. Keep it concise and friendly. Reply with only the suggested message text.`,
            },
            ...recent,
          ],
        }),
      })
      const json = await res.json()
      const suggestion: string = json.reply || 'Thanks for the update — I will review and get back to you shortly.'
      onSuggest(suggestion)
      toast.success('AI suggested a reply')
    } catch {
      toast.error('Could not generate suggestion')
    } finally {
      setBusy('suggest', false)
    }
  }

  /* ── Loading & empty states ─────────────────────────────────────────── */

  if (!engagementId) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Inbox className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">No engagement selected</h2>
          <p className="text-sm text-muted-foreground">
            Choose an engagement from the list to view its details.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('engagements')}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Go to engagements
        </Button>
      </div>
    )
  }

  if (loading) return <EngagementDetailSkeleton />

  if (notFound || !data) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Engagement not found</h2>
          <p className="text-sm text-muted-foreground">
            This engagement may have been removed or you don&apos;t have access.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('engagements')}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to engagements
        </Button>
      </div>
    )
  }

  /* ── Derived data ───────────────────────────────────────────────────── */

  const pbcItems = data.pbcList?.items ?? []
  const pbcCompleted = pbcItems.filter((i) => isPbcComplete(i.status)).length
  const pbcPct = pbcItems.length ? Math.round((pbcCompleted / pbcItems.length) * 100) : 0
  const pbcSent = !!data.pbcList?.sentAt

  const daysLeft = data.deadline
    ? differenceInDays(new Date(data.deadline), new Date())
    : null

  const documents = data.documents ?? []
  const extractions = documents.flatMap((d) => d.extractions ?? [])
  const avgConfidence = extractions.length
    ? extractions.reduce((s, e) => s + e.confidence, 0) / extractions.length
    : 0
  const verifiedCount = extractions.filter((e) => e.isVerified).length
  const needsReviewCount = extractions.length - verifiedCount

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-5 p-4 lg:p-6">
        <EngagementHeader
          data={data}
          daysLeft={daysLeft}
          pbcSent={pbcSent}
          onBack={() => navigate('engagements')}
          onSendPbc={handleSendPbc}
          busySendPbc={actionBusy['send-pbc']}
          onExportCsv={() => handleExport('csv')}
          onMessage={() => setActiveTab('messages')}
        />

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
          <div className="overflow-x-auto">
            <TabsList className="h-auto w-full justify-start gap-1 rounded-xl bg-muted/60 p-1 sm:w-auto">
              <TabsTrigger value="pbc" className="gap-1.5">
                <ListChecks className="h-4 w-4" /> PBC List
                {pbcItems.length > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                    {pbcCompleted}/{pbcItems.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="documents" className="gap-1.5">
                <FileText className="h-4 w-4" /> Documents
                {documents.length > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                    {documents.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="extraction" className="gap-1.5">
                <Sparkles className="h-4 w-4" /> AI Extraction
                {extractions.length > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                    {extractions.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="workflow" className="gap-1.5">
                <Layers className="h-4 w-4" /> Workflow
              </TabsTrigger>
              <TabsTrigger value="messages" className="gap-1.5">
                <MessageSquare className="h-4 w-4" /> Messages
                {(data.messages?.length ?? 0) > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                    {data.messages!.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── PBC List ─────────────────────────────────────────────── */}
          <TabsContent value="pbc" className="mt-4">
            <PbcTab
              data={data}
              pbcItems={pbcItems}
              pbcCompleted={pbcCompleted}
              pbcPct={pbcPct}
              pbcSent={pbcSent}
              busyGenPbc={actionBusy['gen-pbc']}
              busySendPbc={actionBusy['send-pbc']}
              busyAddPbc={actionBusy['add-pbc']}
              onGenerate={handleGeneratePbc}
              onSend={handleSendPbc}
              onAddItem={handleAddPbcItem}
              onOpenDocument={openDocument}
            />
          </TabsContent>

          {/* ── Documents ────────────────────────────────────────────── */}
          <TabsContent value="documents" className="mt-4">
            <DocumentsTab
              documents={documents}
              processingDocIds={processingDocIds}
              onProcess={handleProcessWithAI}
              onOpenDocument={openDocument}
            />
          </TabsContent>

          {/* ── AI Extraction ────────────────────────────────────────── */}
          <TabsContent value="extraction" className="mt-4">
            <ExtractionTab
              documents={documents}
              extractions={extractions}
              avgConfidence={avgConfidence}
              verifiedCount={verifiedCount}
              needsReviewCount={needsReviewCount}
              onReextractAll={handleReextractAll}
              onExport={handleExport}
              busyExport={actionBusy}
              busyReextract={actionBusy['reextract']}
              onOpenDocument={openDocument}
            />
          </TabsContent>

          {/* ── Workflow ─────────────────────────────────────────────── */}
          <TabsContent value="workflow" className="mt-4">
            <WorkflowTab
              workflows={data.workflows ?? []}
              activities={data.activities ?? []}
              busyAdvance={actionBusy['advance']}
              onAdvance={handleAdvanceWorkflow}
            />
          </TabsContent>

          {/* ── Messages ─────────────────────────────────────────────── */}
          <TabsContent value="messages" className="mt-4">
            <MessagesTab
              messages={data.messages ?? []}
              clientName={data.client.name}
              onSend={handleSendMessage}
              onSuggest={handleSuggestReply}
              busySend={actionBusy['send-msg']}
              busySuggest={actionBusy['suggest']}
            />
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}

function stepLabel(step: string): string {
  const found = WORKFLOW_STEPS.find((s) => s.step === step)
  return found?.label ?? step
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Header
 * ────────────────────────────────────────────────────────────────────────── */

function EngagementHeader({
  data,
  daysLeft,
  pbcSent,
  onBack,
  onSendPbc,
  busySendPbc,
  onExportCsv,
  onMessage,
}: {
  data: EngagementDetail
  daysLeft: number | null
  pbcSent: boolean
  onBack: () => void
  onSendPbc: () => void
  busySendPbc: boolean
  onExportCsv: () => void
  onMessage: () => void
}) {
  const overdue = daysLeft !== null && daysLeft < 0
  const soon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7

  return (
    <Card className="overflow-hidden rounded-xl p-0">
      {/* Top banner */}
      <div className="bg-gradient-primary px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Button
              variant="secondary"
              size="icon"
              onClick={onBack}
              className="h-9 w-9 shrink-0 bg-white/15 text-white hover:bg-white/25"
              aria-label="Back to engagements"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                  {data.client.name}
                </h1>
                <Badge
                  variant="secondary"
                  className="border-white/20 bg-white/15 text-white"
                >
                  {engagementTypeLabel(data.engagementType)} · FY{data.taxYear}
                </Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-white/80">
                <span className="text-sm">{data.client.email}</span>
                {data.client.clientType && (
                  <>
                    <span className="opacity-50">•</span>
                    <span className="text-sm capitalize">{data.client.clientType}</span>
                  </>
                )}
                {data.client.country && (
                  <>
                    <span className="opacity-50">•</span>
                    <span className="text-sm">{data.client.country}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!pbcSent && (
              <Button
                size="sm"
                onClick={onSendPbc}
                disabled={busySendPbc}
                className="bg-white text-primary hover:bg-white/90"
              >
                {busySendPbc ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1.5 h-4 w-4" />
                )}
                Send PBC
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={onExportCsv}
              className="bg-white/15 text-white hover:bg-white/25"
            >
              <Download className="mr-1.5 h-4 w-4" /> Export
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onMessage}
              className="bg-white/15 text-white hover:bg-white/25"
            >
              <MessageSquare className="mr-1.5 h-4 w-4" /> Message
            </Button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-5">
        <HeaderStat
          label="Status"
          value={<StatusBadge status={data.status} size="md" />}
        />
        <HeaderStat
          label="Priority"
          value={<PriorityBadge priority={data.priority as Priority} />}
        />
        <HeaderStat
          label="Deadline"
          value={
            <div className="flex flex-col gap-2">
              <span className="inline-flex items-center gap-1.5 text-base font-semibold tabular-nums">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                {data.deadline ? format(new Date(data.deadline), 'MMM d, yyyy') : '—'}
              </span>
              {daysLeft !== null && (
                <span
                  className={cn(
                    'inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                    overdue
                      ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                      : soon
                        ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                        : 'bg-muted text-muted-foreground'
                  )}
                >
                  {overdue
                    ? `${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} overdue`
                    : daysLeft === 0
                      ? 'Due today'
                      : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
                </span>
              )}
            </div>
          }
        />
        <HeaderStat
          label="Assigned to"
          value={
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                {initials(data.assignedTo?.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {data.assignedTo?.name ?? 'Unassigned'}
                </p>
                {data.assignedTo?.role && (
                  <p className="truncate text-xs capitalize text-muted-foreground">
                    {data.assignedTo.role}
                  </p>
                )}
              </div>
            </div>
          }
        />
        <HeaderStat
          label="Progress"
          value={
            <div className="flex items-center gap-3">
              <ProgressRing value={data.progress} size={42} strokeWidth={4} />
              <div>
                <p className="text-sm font-semibold">{data.progress}%</p>
                <p className="text-xs text-muted-foreground">complete</p>
              </div>
            </div>
          }
        />
      </div>
    </Card>
  )
}

function HeaderStat({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 bg-card p-3.5 sm:p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="min-w-0">{value}</div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Tab 1: PBC List
 * ────────────────────────────────────────────────────────────────────────── */

function PbcTab({
  data,
  pbcItems,
  pbcCompleted,
  pbcPct,
  pbcSent,
  busyGenPbc,
  busySendPbc,
  busyAddPbc,
  onGenerate,
  onSend,
  onAddItem,
  onOpenDocument,
}: {
  data: EngagementDetail
  pbcItems: PbcItem[]
  pbcCompleted: number
  pbcPct: number
  pbcSent: boolean
  busyGenPbc: boolean
  busySendPbc: boolean
  busyAddPbc: boolean
  onGenerate: () => void
  onSend: () => void
  onAddItem: (pbcListId: string) => void
  onOpenDocument: (id: string) => void
}) {
  // Group items by status in the canonical order.
  const groups = useMemo(() => {
    const map: Record<string, PbcItem[]> = {}
    for (const it of pbcItems) {
      ;(map[it.status] ||= []).push(it)
    }
    return map
  }, [pbcItems])

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const it of pbcItems) {
      map[it.category] = (map[it.category] ?? 0) + 1
    }
    return map
  }, [pbcItems])

  // No PBC list yet → empty state.
  if (!data.pbcList) {
    return (
      <Card className="rounded-xl">
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ListChecks className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No PBC list yet</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Generate a Prepared by Client document request list from the default{' '}
            {data.engagementType} template. The client will receive a secure link to
            upload their documents.
          </p>
          <Button className="mt-5" onClick={onGenerate} disabled={busyGenPbc}>
            {busyGenPbc ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-4 w-4" />
            )}
            Generate PBC List
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Progress summary */}
      <Card className="rounded-xl p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">{data.pbcList!.name}</h3>
              {pbcSent && data.pbcList!.sentAt && (
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400"
                >
                  <Mail className="h-3 w-3" />
                  Sent {formatDistanceToNow(new Date(data.pbcList!.sentAt), {
                    addSuffix: true,
                  })}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {pbcCompleted} of {pbcItems.length} documents received{' '}
              <span className="font-semibold text-foreground">({pbcPct}%)</span>
            </p>
            <Progress value={pbcPct} className="mt-2 h-2" />
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddItem(data.pbcList!.id)}
              disabled={busyAddPbc}
            >
              {busyAddPbc ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-1.5 h-4 w-4" />
              )}
              Add Item
            </Button>
            <Button
              size="sm"
              onClick={onSend}
              disabled={busySendPbc || pbcSent}
              variant={pbcSent ? 'outline' : 'default'}
            >
              {busySendPbc ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-4 w-4" />
              )}
              {pbcSent ? 'Already Sent' : 'Send to Client'}
            </Button>
          </div>
        </div>

        {/* Category summary chips */}
        <Separator className="my-4" />
        <div className="flex flex-wrap gap-2">
          {Object.entries(categoryCounts).map(([cat, count]) => {
            const def = DOCUMENT_CATEGORIES.find((c) => c.id === cat)
            const Icon = def?.icon ?? FileText
            return (
              <Badge
                key={cat}
                variant="outline"
                className="gap-1.5 rounded-full py-1 pl-2 pr-3 text-xs"
              >
                <Icon className="h-3 w-3 text-muted-foreground" />
                {def?.label ?? cat}
                <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                  {count}
                </span>
              </Badge>
            )
          })}
        </div>
      </Card>

      {/* Grouped items */}
      {pbcItems.length === 0 ? (
        <Card className="rounded-xl p-10 text-center text-sm text-muted-foreground">
          This PBC list has no items yet. Use &ldquo;Add Item&rdquo; to create a
          custom request.
        </Card>
      ) : (
        <div className="space-y-4">
          {(['pending', 'uploaded', 'processing', 'extracted', 'reviewed', 'rejected'] as const)
            .filter((s) => groups[s]?.length)
            .map((status) => (
              <PbcStatusGroup
                key={status}
                status={status}
                items={groups[status]}
                onOpenDocument={onOpenDocument}
              />
            ))}
        </div>
      )}
    </div>
  )
}

function PbcStatusGroup({
  status,
  items,
  onOpenDocument,
}: {
  status: string
  items: PbcItem[]
  onOpenDocument: (id: string) => void
}) {
  const cfg = PBC_GROUP_CONFIG[status] ?? PBC_GROUP_CONFIG.pending
  return (
    <Card className="overflow-hidden rounded-xl">
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <cfg.icon className={cn('h-4 w-4', cfg.iconClass)} />
          <span className="text-sm font-semibold">{cfg.label}</span>
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
            {items.length}
          </Badge>
        </div>
      </div>
      <div className="divide-y">
        {items.map((item) => (
          <PbcItemRow key={item.id} item={item} onOpenDocument={onOpenDocument} />
        ))}
      </div>
    </Card>
  )
}

const PBC_GROUP_CONFIG: Record<
  string,
  { label: string; icon: typeof Clock; iconClass: string }
> = {
  pending: { label: 'Pending', icon: Clock, iconClass: 'text-slate-500' },
  uploaded: { label: 'Uploaded', icon: Upload, iconClass: 'text-blue-500' },
  processing: { label: 'Processing', icon: Loader2, iconClass: 'text-violet-500 animate-spin' },
  extracted: { label: 'Extracted', icon: Sparkles, iconClass: 'text-emerald-500' },
  reviewed: { label: 'Reviewed', icon: CheckCircle2, iconClass: 'text-teal-500' },
  rejected: { label: 'Rejected', icon: AlertCircle, iconClass: 'text-red-500' },
}

function PbcItemRow({
  item,
  onOpenDocument,
}: {
  item: PbcItem
  onOpenDocument: (id: string) => void
}) {
  const typeDef = DOCUMENT_TYPE_MAP[item.documentType]
  const doc = item.documents?.[0]
  return (
    <div className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/30">
      <Checkbox
        checked={isPbcComplete(item.status)}
        disabled
        className="mt-0.5"
        aria-label="item complete"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">
            {typeDef?.label ?? item.documentType}
          </span>
          <Badge variant="outline" className="text-[10px]">
            {item.documentType}
          </Badge>
          <PriorityBadge priority={item.priority as Priority} />
          {!item.required && (
            <Badge
              variant="outline"
              className="border-slate-200 bg-slate-50 text-[10px] text-slate-500 dark:border-slate-700 dark:bg-slate-900/40"
            >
              Optional
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge
            variant="outline"
            className="border-primary/20 bg-primary/5 text-[10px] text-primary"
          >
            {categoryLabel(item.category)}
          </Badge>
          {doc && (
            <button
              onClick={() => onOpenDocument(doc.id)}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-primary hover:bg-primary/5"
            >
              <FileText className="h-3 w-3" />
              {doc.originalFilename}
            </button>
          )}
          {doc && (
            <span className="text-[11px]">
              · uploaded {formatDistanceToNow(new Date(doc.uploadedAt), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0">
        <StatusBadge status={item.status} />
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Tab 2: Documents
 * ────────────────────────────────────────────────────────────────────────── */

function DocumentsTab({
  documents,
  processingDocIds,
  onProcess,
  onOpenDocument,
}: {
  documents: TaxDocument[]
  processingDocIds: Set<string>
  onProcess: (id: string) => void
  onOpenDocument: (id: string) => void
}) {
  const [filter, setFilter] = useState<DocFilterKey>('all')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    if (filter === 'all') return documents
    return documents.filter((d) => {
      if (filter === 'processing') return d.status === 'processing' || d.status === 'uploaded'
      if (filter === 'processed') return d.status === 'processed'
      if (filter === 'reviewed') return d.status === 'reviewed'
      return true
    })
  }, [documents, filter])

  const handleFileSelect = () => {
    toast.info('Document upload is simulated in this demo')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      {/* Upload dropzone */}
      <Card
        className={cn(
          'rounded-xl border-2 border-dashed p-6 transition-colors',
          dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/20'
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          handleFileSelect()
        }}
      >
        <div className="flex flex-col items-center justify-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Drop documents here or click to upload</p>
              <p className="text-xs text-muted-foreground">
                PDF, JPG, PNG, XLSX — AI will classify & extract automatically
              </p>
            </div>
          </div>
          <Button size="sm" onClick={handleFileSelect}>
            <Upload className="mr-1.5 h-4 w-4" /> Upload Document
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      </Card>

      {/* Filters + count */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filter:</span>
          <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
            {(
              [
                { key: 'all', label: 'All' },
                { key: 'processing', label: 'Processing' },
                { key: 'processed', label: 'Processed' },
                { key: 'reviewed', label: 'Reviewed' },
              ] as { key: DocFilterKey; label: string }[]
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  filter === opt.key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {filtered.length} of {documents.length} documents
        </span>
      </div>

      {/* Document grid */}
      {filtered.length === 0 ? (
        <Card className="rounded-xl p-12 text-center">
          <FileX2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No documents found</p>
          <p className="text-xs text-muted-foreground">
            Upload documents or adjust your filter.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              processing={processingDocIds.has(doc.id)}
              onProcess={onProcess}
              onOpen={() => onOpenDocument(doc.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function DocumentCard({
  doc,
  processing,
  onProcess,
  onOpen,
}: {
  doc: TaxDocument
  processing: boolean
  onProcess: (id: string) => void
  onOpen: () => void
}) {
  const Icon = fileIconFor(doc.mimeType)
  const typeDef = doc.documentType ? DOCUMENT_TYPE_MAP[doc.documentType] : null
  const isProcessed = doc.status === 'processed' || doc.status === 'reviewed'

  return (
    <Card className="group flex flex-col gap-0 rounded-xl p-4 transition-all hover:shadow-md">
      <div className="flex items-start gap-3">
        <button
          onClick={onOpen}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15"
          aria-label="Open document"
        >
          {createElement(Icon, { className: 'h-5 w-5' })}
        </button>
        <div className="min-w-0 flex-1">
          <button
            onClick={onOpen}
            className="block w-full truncate text-left text-sm font-semibold hover:text-primary"
            title={doc.originalFilename}
          >
            {doc.originalFilename}
          </button>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatFileSize(doc.fileSize)} · {format(new Date(doc.uploadedAt), 'MMM d')}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {typeDef ? (
          <Badge
            variant="outline"
            className="border-primary/20 bg-primary/5 text-[10px] text-primary"
          >
            {doc.documentType}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">
            Unclassified
          </Badge>
        )}
        <StatusBadge status={doc.status} />
      </div>

      {isProcessed && (
        <div className="mt-3 rounded-lg bg-muted/40 px-2.5 py-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Confidence
            </span>
            <ConfidenceMeter value={doc.confidence} />
          </div>
        </div>
      )}

      <Separator className="my-3" />

      <div className="mt-auto flex items-center gap-2">
        {doc.status === 'uploaded' && (
          <Button
            size="sm"
            className="h-7 flex-1 text-xs"
            onClick={() => onProcess(doc.id)}
            disabled={processing}
          >
            {processing ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1 h-3.5 w-3.5" />
            )}
            {processing ? 'Processing' : 'Process with AI'}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={onOpen}
        >
          Open
        </Button>
      </div>
    </Card>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Tab 3: AI Extraction
 * ────────────────────────────────────────────────────────────────────────── */

function ExtractionTab({
  documents,
  extractions,
  avgConfidence,
  verifiedCount,
  needsReviewCount,
  onReextractAll,
  onExport,
  busyExport,
  busyReextract,
  onOpenDocument,
}: {
  documents: TaxDocument[]
  extractions: Extraction[]
  avgConfidence: number
  verifiedCount: number
  needsReviewCount: number
  onReextractAll: () => void
  onExport: (format: 'csv' | 'ultratax' | 'excel') => void
  busyExport: Record<string, boolean>
  busyReextract: boolean
  onOpenDocument: (id: string) => void
}) {
  const docsByExtraction = documents.filter((d) => (d.extractions?.length ?? 0) > 0)

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryStat
          icon={Sparkles}
          accent="primary"
          label="Fields Extracted"
          value={extractions.length.toString()}
        />
        <SummaryStat
          icon={CheckCircle2}
          accent="success"
          label="Average Confidence"
          value={`${Math.round(avgConfidence * 100)}%`}
        />
        <SummaryStat
          icon={FileCheck2}
          accent="info"
          label="Verified"
          value={verifiedCount.toString()}
        />
        <SummaryStat
          icon={AlertCircle}
          accent="warning"
          label="Needs Review"
          value={needsReviewCount.toString()}
        />
      </div>

      {/* Actions */}
      <Card className="rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Extraction Output</h3>
            <p className="text-xs text-muted-foreground">
              Review, verify, and export field-level data extracted from{' '}
              {docsByExtraction.length} document{docsByExtraction.length === 1 ? '' : 's'}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onReextractAll}
              disabled={busyReextract}
            >
              {busyReextract ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-4 w-4" />
              )}
              Re-extract All
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onExport('csv')}
              disabled={busyExport['export-csv']}
            >
              <FileDown className="mr-1.5 h-4 w-4" /> Export CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onExport('ultratax')}
              disabled={busyExport['export-ultratax']}
            >
              <Download className="mr-1.5 h-4 w-4" /> UltraTax
            </Button>
            <Button
              size="sm"
              onClick={() => onExport('excel')}
              disabled={busyExport['export-excel']}
            >
              <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Excel
            </Button>
          </div>
        </div>
      </Card>

      {/* Per-document extraction tables */}
      {docsByExtraction.length === 0 ? (
        <Card className="rounded-xl p-12 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No extractions yet</p>
          <p className="text-xs text-muted-foreground">
            Upload documents and run AI processing to extract data fields.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {docsByExtraction.map((doc) => (
            <ExtractionDocSection
              key={doc.id}
              doc={doc}
              onOpenDocument={onOpenDocument}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryStat({
  icon: Icon,
  accent,
  label,
  value,
}: {
  icon: typeof Sparkles
  accent: 'primary' | 'success' | 'warning' | 'info'
  label: string
  value: string
}) {
  const accents: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
    warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
    info: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
  }
  return (
    <Card className="flex items-center gap-3 rounded-xl p-4">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', accents[accent])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  )
}

function ExtractionDocSection({
  doc,
  onOpenDocument,
}: {
  doc: TaxDocument
  onOpenDocument: (id: string) => void
}) {
  const exts = doc.extractions ?? []
  const typeDef = doc.documentType ? DOCUMENT_TYPE_MAP[doc.documentType] : null
  const docAvg = exts.length
    ? exts.reduce((s, e) => s + e.confidence, 0) / exts.length
    : 0
  const lowConfidenceCount = exts.filter((e) => e.confidence < 0.9).length

  return (
    <Card className="overflow-hidden rounded-xl transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <button
              onClick={() => onOpenDocument(doc.id)}
              className="block truncate text-left text-sm font-semibold transition-colors hover:text-primary"
              title={doc.originalFilename}
            >
              {doc.originalFilename}
            </button>
            <div className="mt-1.5 flex items-center gap-2">
              {doc.documentType && (
                <Badge
                  variant="outline"
                  className="border-primary/20 bg-primary/5 text-[10px] text-primary"
                >
                  {doc.documentType}
                </Badge>
              )}
              {typeDef && (
                <span className="truncate text-xs text-muted-foreground">
                  {typeDef.label}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
          <span className="hidden sm:inline rounded-md bg-card px-2 py-1 ring-1 ring-border">
            {exts.length} fields · avg {Math.round(docAvg * 100)}%
          </span>
          {lowConfidenceCount > 0 && (
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 text-[10px] text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400"
            >
              <AlertCircle className="h-3 w-3" />
              {lowConfidenceCount} low
            </Badge>
          )}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[35%]">Field</TableHead>
            <TableHead className="w-[35%]">Value</TableHead>
            <TableHead>Confidence</TableHead>
            <TableHead className="text-right">Verified</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {exts.map((ext) => (
            <TableRow
              key={ext.id}
              className={cn(
                ext.confidence < 0.9 && 'bg-amber-50/60 dark:bg-amber-950/20'
              )}
            >
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{ext.fieldLabel}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {ext.fieldGroup}
                  </span>
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs">
                {ext.fieldValue || <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell>
                <ConfidenceMeter value={ext.confidence} />
              </TableCell>
              <TableCell className="text-right">
                {ext.isVerified ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Verified{' '}
                      {ext.verifiedAt
                        ? formatDistanceToNow(new Date(ext.verifiedAt), { addSuffix: true })
                        : ''}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Clock className="h-4 w-4 text-amber-500" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Pending verification</TooltipContent>
                  </Tooltip>
                )}
              </TableCell>
              <TableCell>
                <Button size="icon" variant="ghost" className="h-7 w-7">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Tab 4: Workflow
 * ────────────────────────────────────────────────────────────────────────── */

function WorkflowTab({
  workflows,
  activities,
  busyAdvance,
  onAdvance,
}: {
  workflows: Workflow[]
  activities: Activity[]
  busyAdvance: boolean
  onAdvance: () => void
}) {
  const currentIdx = useMemo(() => {
    const i = workflows.findIndex((w) => w.status === 'in_progress')
    if (i >= 0) return i
    const completed = workflows.filter((w) => w.status === 'completed').length
    return completed - 1
  }, [workflows])

  const completedCount = workflows.filter((w) => w.status === 'completed').length
  const allDone = completedCount === workflows.length && workflows.length > 0
  const progressPct = workflows.length
    ? Math.round((completedCount / workflows.length) * 100)
    : 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="rounded-xl p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">Engagement Workflow</h3>
              <Badge variant="outline" className="text-[10px]">
                {completedCount} / {workflows.length} steps
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {allDone
                ? 'All workflow steps complete. Engagement ready for delivery.'
                : `Currently on step ${currentIdx + 1} of ${workflows.length}: ${stepLabel(
                    workflows[currentIdx]?.step ?? ''
                  )}`}
            </p>
            <Progress value={progressPct} className="mt-2 h-2" />
          </div>
          <Button onClick={onAdvance} disabled={busyAdvance || allDone} className="shrink-0">
            {busyAdvance ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : allDone ? (
              <PartyPopper className="mr-1.5 h-4 w-4" />
            ) : (
              <ArrowRight className="mr-1.5 h-4 w-4" />
            )}
            {allDone ? 'Workflow Complete' : 'Advance to Next Step'}
          </Button>
        </div>
      </Card>

      {/* Stepper */}
      <Card className="rounded-xl p-5">
        <div className="lg:hidden">
          <WorkflowVerticalStepper workflows={workflows} currentIdx={currentIdx} />
        </div>
        <div className="hidden lg:block">
          <WorkflowHorizontalStepper workflows={workflows} currentIdx={currentIdx} />
        </div>
      </Card>

      {/* Activity log */}
      <Card className="rounded-xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold">Activity Log</h3>
            <p className="text-xs text-muted-foreground">
              Recent events on this engagement
            </p>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            {activities.length} events
          </Badge>
        </div>
        <div className="px-5 py-3">
          <ActivityList activities={activities} />
        </div>
      </Card>
    </div>
  )
}

function WorkflowHorizontalStepper({
  workflows,
  currentIdx,
}: {
  workflows: Workflow[]
  currentIdx: number
}) {
  return (
    <div className="flex items-start">
      {workflows.map((w, i) => {
        const def = WORKFLOW_STEPS.find((s) => s.step === w.step)
        const Icon = def?.icon ?? CircleDot
        const isCompleted = w.status === 'completed'
        const isCurrent = w.status === 'in_progress'
        const isPending = w.status === 'pending'
        const isLast = i === workflows.length - 1
        return (
          <div
            key={w.id}
            className={cn('flex flex-1 flex-col items-center text-center', !isLast && 'pr-2')}
          >
            <div className="flex w-full items-center">
              {/* left line */}
              <div
                className={cn(
                  'h-0.5 flex-1',
                  i === 0 ? 'opacity-0' : isCompleted || isCurrent ? 'bg-primary' : 'bg-border'
                )}
              />
              {/* node */}
              <div
                className={cn(
                  'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  isCompleted &&
                    'border-primary bg-primary text-primary-foreground',
                  isCurrent &&
                    'border-primary bg-card text-primary animate-pulse-ring',
                  isPending && 'border-border bg-card text-muted-foreground'
                )}
              >
                {isCompleted ? (
                  <CheckCircle className="h-4 w-4" />
                ) : isCurrent ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              {/* right line */}
              <div
                className={cn(
                  'h-0.5 flex-1',
                  isLast
                    ? 'opacity-0'
                    : isCompleted
                      ? 'bg-primary'
                      : 'bg-border'
                )}
              />
            </div>
            <p
              className={cn(
                'mt-2 text-[11px] font-medium leading-tight',
                isCurrent && 'text-primary',
                isCompleted && 'text-foreground',
                isPending && 'text-muted-foreground'
              )}
            >
              {def?.label ?? w.step}
            </p>
            {w.completedAt && (
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {format(new Date(w.completedAt), 'MMM d')}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function WorkflowVerticalStepper({
  workflows,
  currentIdx,
}: {
  workflows: Workflow[]
  currentIdx: number
}) {
  return (
    <ol className="relative space-y-5">
      {workflows.map((w, i) => {
        const def = WORKFLOW_STEPS.find((s) => s.step === w.step)
        const Icon = def?.icon ?? CircleDot
        const isCompleted = w.status === 'completed'
        const isCurrent = w.status === 'in_progress'
        const isPending = w.status === 'pending'
        const isLast = i === workflows.length - 1
        return (
          <li key={w.id} className="relative flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2',
                  isCompleted && 'border-primary bg-primary text-primary-foreground',
                  isCurrent && 'border-primary bg-card text-primary animate-pulse-ring',
                  isPending && 'border-border bg-card text-muted-foreground'
                )}
              >
                {isCompleted ? (
                  <CheckCircle className="h-4 w-4" />
                ) : isCurrent ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              {!isLast && (
                <div
                  className={cn(
                    'mt-1 w-0.5 flex-1',
                    isCompleted ? 'bg-primary' : 'bg-border'
                  )}
                  style={{ minHeight: 16 }}
                />
              )}
            </div>
            <div className={cn('min-w-0 flex-1 pb-1', isLast && 'pb-0')}>
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className={cn(
                    'text-sm font-semibold',
                    isPending && 'text-muted-foreground',
                    isCurrent && 'text-primary'
                  )}
                >
                  {def?.label ?? w.step}
                </p>
                <StatusBadgeMini status={w.status} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {w.startedAt && (
                  <span>Started: {format(new Date(w.startedAt), 'MMM d, yyyy · h:mm a')}</span>
                )}
                {w.completedAt && (
                  <span>Completed: {format(new Date(w.completedAt), 'MMM d, yyyy · h:mm a')}</span>
                )}
                {!w.startedAt && <span>Not started</span>}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function StatusBadgeMini({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    completed: {
      label: 'Completed',
      cls: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400',
    },
    in_progress: {
      label: 'In Progress',
      cls: 'border-primary/30 bg-primary/10 text-primary',
    },
    pending: {
      label: 'Pending',
      cls: 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900/40',
    },
    skipped: {
      label: 'Skipped',
      cls: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400',
    },
  }
  const c = cfg[status] ?? cfg.pending
  return (
    <Badge variant="outline" className={cn('text-[10px]', c.cls)}>
      {c.label}
    </Badge>
  )
}

function ActivityList({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        No recent activity.
      </div>
    )
  }
  return (
    <ScrollArea className="max-h-[400px] pr-3">
      <ol className="relative space-y-3">
        {activities.map((a, i) => {
          const Icon = ACTIVITY_ICON_MAP[a.type] ?? CircleDot
          return (
            <li key={a.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                {i < activities.length - 1 && (
                  <div className="mt-0.5 w-px flex-1 bg-border" style={{ minHeight: 12 }} />
                )}
              </div>
              <div className="min-w-0 flex-1 pb-2">
                <p className="text-sm leading-snug">{a.description}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span className="font-medium">{a.actor}</span>
                  {' · '}
                  {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </ScrollArea>
  )
}

const ACTIVITY_ICON_MAP: Record<string, typeof CircleDot> = {
  upload: Upload,
  classify: Sparkles,
  extract: Sparkles,
  verify: CheckCircle2,
  send: Send,
  message: MessageSquare,
  status_change: RefreshCw,
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Tab 5: Messages
 * ────────────────────────────────────────────────────────────────────────── */

function MessagesTab({
  messages,
  clientName,
  onSend,
  onSuggest,
  busySend,
  busySuggest,
}: {
  messages: Message[]
  clientName: string
  onSend: (content: string) => void
  onSuggest: (onSuggest: (text: string) => void) => Promise<void>
  busySend: boolean
  busySuggest: boolean
}) {
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

  const handleSend = () => {
    if (!draft.trim()) return
    onSend(draft)
    setDraft('')
  }

  return (
    <Card className="flex h-[calc(100vh-260px)] min-h-[500px] flex-col rounded-xl p-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {initials(clientName)}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-semibold">{clientName}</p>
            <p className="text-xs text-muted-foreground">Client · Online</p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {messages.length} messages
        </Badge>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto bg-muted/20 p-5 scrollbar-thin"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs text-muted-foreground">
              Start the conversation with your client.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} message={m} clientName={clientName} />
          ))
        )}
      </div>

      {/* Composer */}
      <div className="border-t p-3">
        <div className="mb-2 flex items-center justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSuggest(setDraft)}
            disabled={busySuggest || messages.length === 0}
            className="h-7 text-xs"
          >
            {busySuggest ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Bot className="mr-1.5 h-3.5 w-3.5" />
            )}
            AI Suggest Reply
          </Button>
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a message to your client…"
            className="min-h-[60px] flex-1 resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <Button
            onClick={handleSend}
            disabled={!draft.trim() || busySend}
            size="icon"
            className="h-10 w-10 shrink-0"
            aria-label="Send message"
          >
            {busySend ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </Card>
  )
}

function MessageBubble({ message, clientName }: { message: Message; clientName: string }) {
  const fromClient = message.fromType === 'client'
  const fromAI = message.fromType === 'ai'
  const isUser = !fromClient && !fromAI

  return (
    <div className={cn('flex items-end gap-2', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
            fromAI
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {fromAI ? <Bot className="h-3.5 w-3.5" /> : initials(clientName)}
        </div>
      )}
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm',
          isUser
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : fromAI
              ? 'rounded-bl-sm border border-primary/20 bg-primary/5 text-foreground'
              : 'rounded-bl-sm bg-card text-card-foreground'
        )}
      >
        {fromAI && (
          <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
            <Sparkles className="h-3 w-3" /> AI Assistant
          </div>
        )}
        <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
        <p
          className={cn(
            'mt-1 text-[10px]',
            isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )}
        >
          {format(new Date(message.createdAt), 'MMM d, h:mm a')}
        </p>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Skeleton
 * ────────────────────────────────────────────────────────────────────────── */

function EngagementDetailSkeleton() {
  return (
    <div className="space-y-5 p-4 lg:p-6">
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-10 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}
