'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  FileText,
  Loader2,
  Sparkles,
  CheckCircle2,
  Pencil,
  Save,
  X,
  Download,
  FileSpreadsheet,
  RefreshCw,
  CheckCheck,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Target,
  Zap,
  AlertTriangle,
  Activity as ActivityIcon,
  Users,
  ShieldCheck,
  Building2,
  Calendar,
  Upload as UploadIcon,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { StatusBadge } from '@/components/shared/status-badge'
import { ConfidenceMeter } from '@/components/shared/confidence-meter'
import { DOCUMENT_TYPE_MAP } from '@/lib/constants'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import type { TaxDocument, Extraction, Engagement, Client } from '@/lib/types'
import { cn } from '@/lib/utils'

type ProcessingStage = 'idle' | 'classifying' | 'extracting' | 'done' | 'error'

interface DocumentDetail extends TaxDocument {
  engagement?: Engagement & { client?: Client }
  client?: Client
  pbcItem?: { documentType?: string; description?: string }
  extractions?: Extraction[]
}

interface ActivityEntry {
  id: string
  type: string
  description: string
  actor: string
  createdAt: string
}

const GROUP_LABELS: Record<string, string> = {
  employer: 'Employer Information',
  employee: 'Employee Information',
  income: 'Income',
  tax: 'Tax Withholding',
  payer: 'Payer Information',
  recipient: 'Recipient Information',
  entity: 'Entity Information',
  partner: 'Partner / Shareholder',
  lender: 'Lender Information',
  borrower: 'Borrower Information',
  property: 'Property',
  deduction: 'Deduction',
  institution: 'Institution',
  student: 'Student',
  school: 'School',
  charity: 'Charity',
  donor: 'Donor',
  donation: 'Donation',
  business: 'Business',
  period: 'Period',
  assets: 'Assets',
  liabilities: 'Liabilities',
  equity: 'Equity',
  bank: 'Bank',
  account: 'Account',
  balance: 'Balance',
  transaction: 'Transaction',
  value: 'Value',
  identity: 'Identity',
  other: 'Other',
}

const ACTIVITY_ICON_MAP: Record<string, typeof ActivityIcon> = {
  upload: UploadIcon,
  classify: Zap,
  extract: Target,
  verify: CheckCircle2,
}

const ACTIVITY_STYLE_MAP: Record<string, string> = {
  upload: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
  classify:
    'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
  extract:
    'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  verify:
    'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400',
}

const PROCESSING_STEPS: {
  id: ProcessingStage
  label: string
  icon: typeof Zap
}[] = [
  { id: 'classifying', label: 'Classifying document...', icon: Zap },
  { id: 'extracting', label: 'Extracting fields...', icon: Target },
  { id: 'done', label: 'AI processing complete', icon: CheckCircle2 },
]

export function DocumentDetailView() {
  const documentId = useAppStore((s) => s.selectedDocumentId)
  const navigate = useAppStore((s) => s.navigate)

  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<ProcessingStage>('idle')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [verifyingAll, setVerifyingAll] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [page, setPage] = useState(1)
  const totalPages = 3

  const fetchDoc = () => {
    if (!documentId) return
    setLoading(true)
    fetch(`/api/documents/${documentId}`)
      .then((r) => r.json())
      .then((d) => {
        setDoc(d.document)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchDoc()
     
  }, [documentId])

  const handleProcessWithAI = async () => {
    if (!documentId) return
    setProcessing('classifying')
    try {
      // Step 1: Classify
      const classifyRes = await fetch('/api/ai/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      })
      if (!classifyRes.ok) throw new Error('Classify failed')
      const classifyData = await classifyRes.json()
      await new Promise((r) => setTimeout(r, 700))

      setProcessing('extracting')
      // Step 2: Extract
      const extractRes = await fetch('/api/ai/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      })
      if (!extractRes.ok) throw new Error('Extract failed')
      await new Promise((r) => setTimeout(r, 600))

      setProcessing('done')
      toast.success('AI processing complete', {
        description: `Classified as ${classifyData.documentType || 'Unknown'} · ${classifyData.fields?.length || 0} fields extracted`,
      })
      fetchDoc()
      setTimeout(() => setProcessing('idle'), 1800)
    } catch {
      setProcessing('error')
      toast.error('AI processing failed', {
        description: 'Please try again or contact support.',
      })
      setTimeout(() => setProcessing('idle'), 1800)
    }
  }

  const handleSaveEdit = async (extractionId: string) => {
    try {
      const res = await fetch(`/api/extractions/${extractionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldValue: editValue, isVerified: true }),
      })
      if (!res.ok) throw new Error()
      const { extraction } = await res.json()
      setDoc((d) =>
        d
          ? {
              ...d,
              extractions: (d.extractions || []).map((e) =>
                e.id === extractionId ? extraction : e
              ),
            }
          : d
      )
      setEditingId(null)
      toast.success('Field updated & verified')
    } catch {
      toast.error('Failed to update field')
    }
  }

  const handleVerifyAll = async () => {
    if (!doc?.extractions) return
    const unverified = doc.extractions.filter((e) => !e.isVerified)
    if (unverified.length === 0) {
      toast.info('All fields are already verified')
      return
    }
    setVerifyingAll(true)
    try {
      await Promise.all(
        unverified.map((e) =>
          fetch(`/api/extractions/${e.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fieldValue: e.fieldValue,
              isVerified: true,
            }),
          })
        )
      )
      toast.success(`Verified ${unverified.length} field${unverified.length === 1 ? '' : 's'}`)
      fetchDoc()
    } catch {
      toast.error('Failed to verify all fields')
    } finally {
      setVerifyingAll(false)
    }
  }

  const handleExportCSV = () => {
    if (!doc?.extractions || doc.extractions.length === 0) return
    const rows: string[][] = [
      ['Field', 'Label', 'Group', 'Value', 'Confidence', 'Verified'],
    ]
    doc.extractions.forEach((e) => {
      rows.push([
        e.fieldName,
        e.fieldLabel,
        e.fieldGroup,
        e.fieldValue,
        `${Math.round(e.confidence * 100)}%`,
        e.isVerified ? 'Yes' : 'No',
      ])
    })
    const csv = rows
      .map((r) =>
        r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')
      )
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${doc.originalFilename.replace(/\.[^.]+$/, '')}-extraction.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  const handleExportUltraTax = () => {
    if (!doc?.extractions || doc.extractions.length === 0) return
    toast.success('Exporting to UltraTax CS...', {
      description: `${doc.extractions.length} fields queued for import to ${doc.client?.name || 'client'}'s return.`,
    })
  }

  const typeDef = doc?.documentType ? DOCUMENT_TYPE_MAP[doc.documentType] : null
  const extractions = doc?.extractions || []

  const groupedExtractions = useMemo(() => {
    const groups: Record<string, Extraction[]> = {}
    extractions.forEach((e) => {
      if (!groups[e.fieldGroup]) groups[e.fieldGroup] = []
      groups[e.fieldGroup].push(e)
    })
    // Sort groups by predefined order
    const order = Object.keys(GROUP_LABELS)
    return Object.entries(groups).sort(([a], [b]) => {
      const ia = order.indexOf(a)
      const ib = order.indexOf(b)
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
    })
  }, [extractions])

  const avgConfidence =
    extractions.length > 0
      ? extractions.reduce((sum, e) => sum + e.confidence, 0) /
        extractions.length
      : doc?.confidence || 0
  const verifiedCount = extractions.filter((e) => e.isVerified).length
  const lowConfidenceCount = extractions.filter(
    (e) => e.confidence < 0.9
  ).length

  const activityLog = useMemo<ActivityEntry[]>(() => {
    if (!doc) return []
    const log: ActivityEntry[] = []
    log.push({
      id: 'upload',
      type: 'upload',
      description: `Document uploaded by ${
        doc.uploadedBy === 'client' ? 'client' : 'team member'
      }`,
      actor: doc.uploadedBy === 'client' ? 'Client Portal' : 'Team Member',
      createdAt: doc.uploadedAt,
    })
    if (doc.documentType && doc.processedAt) {
      log.push({
        id: 'classify',
        type: 'classify',
        description: `AI classified as ${doc.documentType} (${Math.round(
          (doc.confidence || 0) * 100
        )}% confidence)`,
        actor: 'TaxDox AI',
        createdAt: doc.processedAt,
      })
    }
    if (extractions.length > 0 && doc.processedAt) {
      log.push({
        id: 'extract',
        type: 'extract',
        description: `AI extracted ${extractions.length} fields from document`,
        actor: 'TaxDox AI',
        createdAt: doc.processedAt,
      })
    }
    if (verifiedCount > 0) {
      log.push({
        id: 'verify',
        type: 'verify',
        description: `${verifiedCount} field${
          verifiedCount === 1 ? '' : 's'
        } verified`,
        actor: 'Team Member',
        createdAt: doc.processedAt || doc.uploadedAt,
      })
    }
    return log.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [doc, extractions.length, verifiedCount])

  if (loading || !doc) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="h-[500px] animate-pulse rounded-xl bg-muted" />
          <div className="h-[500px] animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    )
  }

  const needsProcessing =
    doc.status === 'uploaded' ||
    (doc.status === 'processing' && !doc.documentType)

  const isBusy = processing !== 'idle'

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="space-y-3 p-4 lg:p-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('documents')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  className="truncate text-xl font-bold tracking-tight"
                  title={doc.originalFilename}
                >
                  {doc.originalFilename}
                </h1>
                {typeDef && (
                  <Badge variant="secondary" className="shrink-0">
                    {doc.documentType}
                  </Badge>
                )}
                <StatusBadge status={doc.status} />
                {doc.confidence > 0 && (
                  <Badge
                    variant="outline"
                    className="shrink-0 text-muted-foreground"
                  >
                    <Target className="mr-1 h-3 w-3" />
                    {Math.round(doc.confidence * 100)}% confidence
                  </Badge>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {doc.client && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> {doc.client.name}
                  </span>
                )}
                {doc.engagement && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {doc.engagement.engagementType} · {doc.engagement.taxYear}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Uploaded {formatDistanceToNow(new Date(doc.uploadedAt), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {needsProcessing ? (
              <Button onClick={handleProcessWithAI} size="sm" disabled={isBusy}>
                {isBusy ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-4 w-4" />
                )}
                {isBusy ? 'Processing...' : 'Process with AI'}
              </Button>
            ) : (
              <Button
                onClick={handleProcessWithAI}
                variant="outline"
                size="sm"
                disabled={isBusy}
              >
                {isBusy ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-4 w-4" />
                )}
                Re-process
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={extractions.length === 0}
            >
              <Download className="mr-1.5 h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportUltraTax}
              disabled={extractions.length === 0}
            >
              <FileSpreadsheet className="mr-1.5 h-4 w-4" />
              Export to UltraTax
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleVerifyAll}
              disabled={
                verifyingAll ||
                extractions.length === 0 ||
                verifiedCount === extractions.length
              }
            >
              {verifyingAll ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <CheckCheck className="mr-1.5 h-4 w-4" />
              )}
              Verify All
            </Button>
          </div>

          {/* Processing animation */}
          {isBusy && (
            <Card className="border-primary/20 bg-primary/5 p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">AI Processing</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {processing === 'classifying' && 'Step 1 of 2'}
                    {processing === 'extracting' && 'Step 2 of 2'}
                    {processing === 'done' && 'Complete'}
                    {processing === 'error' && 'Failed'}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {PROCESSING_STEPS.map((step) => {
                    const isCurrent = processing === step.id
                    const isDone =
                      (processing === 'extracting' &&
                        step.id === 'classifying') ||
                      (processing === 'done' &&
                        (step.id === 'classifying' ||
                          step.id === 'extracting'))
                    const StepIcon = step.icon
                    return (
                      <div key={step.id} className="flex items-center gap-2.5">
                        {isDone ? (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </div>
                        ) : isCurrent ? (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          </div>
                        ) : (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full border border-muted-foreground/30 text-muted-foreground/50">
                            <StepIcon className="h-3 w-3" />
                          </div>
                        )}
                        <span
                          className={cn(
                            'text-sm',
                            isCurrent
                              ? 'font-medium text-foreground'
                              : isDone
                                ? 'text-muted-foreground'
                                : 'text-muted-foreground/60'
                          )}
                        >
                          {step.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Body: split view */}
      <div className="flex-1 overflow-hidden">
        <div className="grid h-full grid-cols-1 lg:grid-cols-2">
          {/* LEFT: Preview */}
          <div className="flex flex-col border-r bg-muted/30">
            {/* Preview toolbar */}
            <div className="flex items-center justify-between border-b px-4 py-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                <span className="font-medium">
                  Page {page} of {totalPages}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Separator orientation="vertical" className="mx-1 h-5" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setZoom((z) => Math.max(50, z - 25))}
                  disabled={zoom <= 50}
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">
                  {zoom}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setZoom((z) => Math.min(200, z + 25))}
                  disabled={zoom >= 200}
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {/* Preview area */}
            <div className="flex-1 overflow-auto p-6">
              <div
                className="mx-auto aspect-[8.5/11] max-w-md origin-top rounded-md border bg-white shadow-md transition-transform"
                style={{
                  transform: `scale(${zoom / 100})`,
                }}
              >
                <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
                    <FileText className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {doc.originalFilename}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Page {page} of {totalPages} ·{' '}
                    {doc.mimeType || 'application/pdf'}
                  </p>
                  <Separator className="my-1 w-32" />
                  <p className="text-[11px] text-muted-foreground/70">
                    Preview not available —{' '}
                    <span className="font-medium text-primary">view source</span>
                  </p>

                  {/* Simulated document content lines */}
                  <div className="mt-4 w-full space-y-2 px-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-2 rounded-full bg-muted/80"
                        style={{ width: `${75 - i * 8}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Extracted data + activity */}
          <div className="flex flex-col overflow-hidden">
            <Tabs defaultValue="extraction" className="flex h-full flex-col">
              <div className="border-b px-4 pt-3">
                <TabsList>
                  <TabsTrigger value="extraction" className="gap-1.5">
                    <Target className="h-3.5 w-3.5" />
                    Extraction
                    {extractions.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="ml-1 h-4 px-1 text-[10px]"
                      >
                        {extractions.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="gap-1.5">
                    <ActivityIcon className="h-3.5 w-3.5" />
                    Activity
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent
                value="extraction"
                className="mt-0 flex-1 overflow-hidden"
              >
                <ScrollArea className="h-full">
                  <div className="space-y-4 p-4">
                    {extractions.length > 0 ? (
                      <>
                        {/* Summary header */}
                        <div className="grid grid-cols-3 gap-2">
                          <Card className="p-3">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Fields
                            </p>
                            <p className="mt-0.5 text-lg font-bold tabular-nums">
                              {extractions.length}
                            </p>
                          </Card>
                          <Card className="p-3">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Avg Confidence
                            </p>
                            <p className="mt-0.5 text-lg font-bold tabular-nums text-primary">
                              {Math.round(avgConfidence * 100)}%
                            </p>
                          </Card>
                          <Card className="p-3">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Verified
                            </p>
                            <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-600">
                              {verifiedCount}/{extractions.length}
                            </p>
                          </Card>
                        </div>

                        {lowConfidenceCount > 0 && (
                          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              {lowConfidenceCount} field
                              {lowConfidenceCount === 1 ? '' : 's'} below 90%
                              confidence — review recommended
                            </span>
                          </div>
                        )}

                        {/* Grouped extractions */}
                        {groupedExtractions.map(([group, fields]) => (
                          <Card key={group} className="overflow-hidden p-0">
                            <div className="border-b bg-muted/40 px-4 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {GROUP_LABELS[group] || group}
                              </p>
                            </div>
                            <div className="divide-y">
                              {fields.map((ext) => (
                                <ExtractionRow
                                  key={ext.id}
                                  ext={ext}
                                  isEditing={editingId === ext.id}
                                  editValue={editValue}
                                  onStartEdit={() => {
                                    setEditingId(ext.id)
                                    setEditValue(ext.fieldValue)
                                  }}
                                  onCancelEdit={() => setEditingId(null)}
                                  onChangeEdit={setEditValue}
                                  onSaveEdit={() => handleSaveEdit(ext.id)}
                                />
                              ))}
                            </div>
                          </Card>
                        ))}
                      </>
                    ) : needsProcessing ? (
                      <Card className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <Sparkles className="h-7 w-7" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">
                            Ready for AI extraction
                          </p>
                          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                            Click &ldquo;Process with AI&rdquo; to classify this
                            document and extract structured data fields
                            automatically.
                          </p>
                        </div>
                        <Button
                          onClick={handleProcessWithAI}
                          size="sm"
                          className="mt-1"
                          disabled={isBusy}
                        >
                          {isBusy ? (
                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="mr-1.5 h-4 w-4" />
                          )}
                          Process with AI
                        </Button>
                      </Card>
                    ) : (
                      <Card className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                          <Target className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">
                            No extractions yet
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            No structured data has been extracted from this
                            document.
                          </p>
                        </div>
                      </Card>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent
                value="activity"
                className="mt-0 flex-1 overflow-hidden"
              >
                <ScrollArea className="h-full">
                  <div className="space-y-1 p-4">
                    {activityLog.length === 0 ? (
                      <Card className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                          <ActivityIcon className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">No activity yet</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Events will appear here as the document is processed.
                          </p>
                        </div>
                      </Card>
                    ) : (
                      activityLog.map((entry, i) => (
                        <ActivityRow
                          key={entry.id}
                          entry={entry}
                          isLast={i === activityLog.length - 1}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}

interface ExtractionRowProps {
  ext: Extraction
  isEditing: boolean
  editValue: string
  onStartEdit: () => void
  onCancelEdit: () => void
  onChangeEdit: (v: string) => void
  onSaveEdit: () => void
}

function ExtractionRow({
  ext,
  isEditing,
  editValue,
  onStartEdit,
  onCancelEdit,
  onChangeEdit,
  onSaveEdit,
}: ExtractionRowProps) {
  const isLowConfidence = ext.confidence < 0.9
  return (
    <div
      className={cn(
        'p-3 transition-colors',
        isLowConfidence && 'bg-amber-50/40 dark:bg-amber-950/20'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-muted-foreground">{ext.fieldLabel}</p>
            {ext.isVerified && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                <ShieldCheck className="h-2.5 w-2.5" />
                Verified
              </span>
            )}
          </div>
          {isEditing ? (
            <Input
              value={editValue}
              onChange={(e) => onChangeEdit(e.target.value)}
              className="mt-1 h-8 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveEdit()
                if (e.key === 'Escape') onCancelEdit()
              }}
            />
          ) : (
            <p className="mt-0.5 break-words text-sm font-medium">
              {ext.fieldValue || '—'}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ConfidenceMeter value={ext.confidence} />
          {isEditing ? (
            <div className="flex gap-0.5">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40"
                onClick={onSaveEdit}
              >
                <Save className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground"
                onClick={onCancelEdit}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onStartEdit}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function ActivityRow({
  entry,
  isLast,
}: {
  entry: ActivityEntry
  isLast: boolean
}) {
  const Icon = ACTIVITY_ICON_MAP[entry.type] || ActivityIcon
  const style =
    ACTIVITY_STYLE_MAP[entry.type] ||
    'bg-muted text-muted-foreground'
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg',
            style
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        {!isLast && <div className="mt-1 w-px flex-1 bg-border" />}
      </div>
      <div className="min-w-0 flex-1 pb-4">
        <p className="text-sm leading-snug">{entry.description}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {entry.actor} ·{' '}
          {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  )
}
