'use client'

import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Upload,
  Camera,
  FileText,
  Mail,
  Lock,
  Send,
  CheckCircle2,
  Clock,
  Loader2,
  Image as ImageIcon,
  Folder,
  AlertCircle,
  FileCheck2,
  RotateCw,
  CalendarClock,
  Sparkles,
  Inbox,
  MessageSquare,
  ShieldCheck,
  Paperclip,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { format, formatDistanceToNow, differenceInDays } from 'date-fns'
import { cn } from '@/lib/utils'
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_TYPE_MAP,
  ENGAGEMENT_TYPES,
} from '@/lib/constants'
import type {
  Client,
  Engagement,
  PbcItem,
  TaxDocument,
  Message,
  Priority,
} from '@/lib/types'

/* ────────────────────────────────────────────────────────────────────────────
 *  Local types
 * ────────────────────────────────────────────────────────────────────────── */

interface EngagementListItem extends Engagement {
  client?: Client
  pbcList?: {
    id: string
    name: string
    items: PbcItem[]
  } | null
  documents?: { id: string; status: string; documentType?: string }[]
}

interface EngagementDetail extends Omit<Engagement, 'client' | 'assignedTo' | 'pbcList' | 'documents'> {
  client: NonNullable<Engagement['client']>
  assignedTo?: {
    id: string
    name: string
    role?: string
    email?: string
  } | null
  pbcList?: {
    id: string
    name: string
    sentAt?: string | null
    sentVia?: string | null
    items: PbcItem[]
  } | null
  documents?: TaxDocument[]
  messages?: Message[]
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Helpers
 * ────────────────────────────────────────────────────────────────────────── */

function initials(name?: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('')
}

function engagementTypeLabel(type: string): string {
  return ENGAGEMENT_TYPES.find((t) => t.value === type)?.label ?? type
}

function engagementShortLabel(type: string): string {
  const def = ENGAGEMENT_TYPES.find((t) => t.value === type)
  return def ? `${def.value} ${def.entity}` : type
}

function categoryMeta(categoryId: string) {
  return (
    DOCUMENT_CATEGORIES.find((c) => c.id === categoryId) ||
    DOCUMENT_CATEGORIES[DOCUMENT_CATEGORIES.length - 1]
  )
}

function categoryIcon(categoryId: string) {
  return categoryMeta(categoryId).icon
}

function categorySurfaceClass(categoryId: string): string {
  const color = categoryMeta(categoryId).color
  const map: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400',
    cyan: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
    orange: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',
    slate: 'bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300',
  }
  return map[color] || map.slate
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function progressColorClass(value: number): string {
  if (value >= 100) return 'bg-emerald-500'
  if (value >= 75) return 'bg-primary'
  if (value >= 50) return 'bg-amber-500'
  if (value > 0) return 'bg-orange-500'
  return 'bg-slate-400'
}

function deadlineState(deadline?: string | null): {
  label: string
  tone: 'danger' | 'warning' | 'ok'
} {
  if (!deadline) return { label: 'No deadline', tone: 'ok' }
  const d = new Date(deadline)
  const days = differenceInDays(d, new Date())
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, tone: 'danger' }
  if (days === 0) return { label: 'Due today', tone: 'danger' }
  if (days <= 7) return { label: `${days}d remaining`, tone: 'warning' }
  return { label: `${days}d remaining`, tone: 'ok' }
}

function docStatusVisual(status: string): {
  icon: typeof CheckCircle2
  label: string
  tone: 'ok' | 'pending' | 'processing'
} {
  if (status === 'reviewed' || status === 'processed' || status === 'extracted') {
    return { icon: CheckCircle2, label: 'Reviewed', tone: 'ok' }
  }
  if (status === 'processing') {
    return { icon: RotateCw, label: 'Processing', tone: 'processing' }
  }
  return { icon: Clock, label: 'Pending review', tone: 'pending' }
}

function simulateFilename(documentType?: string): string {
  const base = documentType?.replace(/[^a-zA-Z0-9]/g, '_') || 'document'
  const stamp = Date.now().toString().slice(-6)
  return `${base}_${stamp}.pdf`
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Main view
 * ────────────────────────────────────────────────────────────────────────── */

export function ClientPortalView() {
  const navigate = useAppStore((s) => s.navigate)

  const [clients, setClients] = useState<Client[]>([])
  const [engagements, setEngagements] = useState<EngagementListItem[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [detail, setDetail] = useState<EngagementDetail | null>(null)
  const [localMessages, setLocalMessages] = useState<Message[]>([])
  const [hiddenPbcItemIds, setHiddenPbcItemIds] = useState<Set<string>>(new Set())
  const [optimisticDocs, setOptimisticDocs] = useState<TaxDocument[]>([])

  const [loadingLists, setLoadingLists] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [uploadingPbcId, setUploadingPbcId] = useState<string | null>(null)
  const [quickUploading, setQuickUploading] = useState(false)
  const [activeTab, setActiveTab] = useState<'documents' | 'messages'>('documents')

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const quickFileInputRef = useRef<HTMLInputElement>(null)

  /* ── Fetch clients + engagements ──────────────────────────────────────── */
  const fetchLists = useCallback(async () => {
    setLoadingLists(true)
    try {
      const [clientsRes, engRes] = await Promise.all([
        fetch('/api/clients'),
        fetch('/api/engagements'),
      ])
      const clientsJson = await clientsRes.json()
      const engJson = await engRes.json()
      const clientList: Client[] = clientsJson.clients || []
      const engList: EngagementListItem[] = engJson.engagements || []
      setClients(clientList)
      setEngagements(engList)

      // Pick initial client: prefer the client of an engagement with status
      // 'collecting' or 'pbc_sent' so the portal has interesting data.
      if (!selectedClientId && clientList.length > 0) {
        const preferred = engList.find(
          (e) => e.status === 'collecting' || e.status === 'pbc_sent'
        )
        const firstId = preferred?.clientId || engList[0]?.clientId || clientList[0].id
        setSelectedClientId(firstId)
      }
    } catch {
      toast.error('Failed to load portal data')
    } finally {
      setLoadingLists(false)
    }
     
  }, [])

  useEffect(() => {
    fetchLists()
  }, [fetchLists])

  /* ── Pick the best engagement for the selected client ─────────────────── */
  const selectedEngagement = useMemo<EngagementListItem | undefined>(() => {
    if (!selectedClientId) return undefined
    const forClient = engagements.filter((e) => e.clientId === selectedClientId)
    if (forClient.length === 0) return undefined
    const ranked = [...forClient].sort((a, b) => {
      const score = (e: EngagementListItem) => {
        if (e.status === 'collecting') return 5
        if (e.status === 'pbc_sent') return 4
        if (e.status === 'processing') return 3
        if (e.status === 'review') return 2
        if (e.status === 'filing') return 1
        return 0
      }
      return score(b) - score(a)
    })
    return ranked[0]
  }, [selectedClientId, engagements])

  /* ── Fetch engagement detail (with messages, pbc items, documents) ────── */
  const fetchDetail = useCallback(async () => {
    if (!selectedEngagement) {
      setDetail(null)
      setLocalMessages([])
      setHiddenPbcItemIds(new Set())
      setOptimisticDocs([])
      return
    }
    setLoadingDetail(true)
    setHiddenPbcItemIds(new Set())
    setOptimisticDocs([])
    try {
      const res = await fetch(`/api/engagements/${selectedEngagement.id}`)
      if (!res.ok) throw new Error('Failed to load engagement')
      const json = await res.json()
      const engagement = json.engagement as EngagementDetail
      setDetail(engagement)
      setLocalMessages(engagement.messages || [])
    } catch {
      toast.error('Failed to load your documents')
      setDetail(null)
    } finally {
      setLoadingDetail(false)
    }
  }, [selectedEngagement])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  /* ── Derived data ─────────────────────────────────────────────────────── */
  const client = useMemo<Client | undefined>(
    () => clients.find((c) => c.id === selectedClientId),
    [clients, selectedClientId]
  )

  const allPbcItems = detail?.pbcList?.items || []
  const pendingPbcItems = useMemo(
    () =>
      allPbcItems
        .filter((i) => i.status === 'pending' && !hiddenPbcItemIds.has(i.id))
        .sort((a, b) => {
          const prioRank: Record<Priority, number> = { high: 0, medium: 1, low: 2 }
          return (
            (prioRank[a.priority] ?? 3) - (prioRank[b.priority] ?? 3) ||
            a.orderIndex - b.orderIndex
          )
        }),
    [allPbcItems, hiddenPbcItemIds]
  )

  const uploadedDocuments = useMemo<TaxDocument[]>(() => {
    const fromApi = detail?.documents || []
    // Merge optimistic docs that aren't already in the API list
    const apiIds = new Set(fromApi.map((d) => d.id))
    const merged = [...fromApi, ...optimisticDocs.filter((d) => !apiIds.has(d.id))]
    return merged.sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )
  }, [detail, optimisticDocs])

  const pbcTotal = allPbcItems.length
  const pbcCompleted = allPbcItems.filter((i) =>
    ['uploaded', 'processing', 'extracted', 'reviewed'].includes(i.status)
  ).length
  const pbcPercent =
    pbcTotal === 0 ? 0 : Math.round((pbcCompleted / pbcTotal) * 100)

  const displayProgress = detail?.progress ?? pbcPercent

  /* ── Upload a document for a specific PBC item ────────────────────────── */
  const uploadForPbcItem = useCallback(
    async (item: PbcItem) => {
      if (!detail || !client) return
      setUploadingPbcId(item.id)
      const filename = simulateFilename(item.documentType)
      try {
        const res = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: client.id,
            engagementId: detail.id,
            pbcItemId: item.id,
            originalFilename: filename,
            storedFilename: `uploads/${Date.now()}-${filename}`,
            fileSize: Math.floor(120_000 + Math.random() * 1_800_000),
            mimeType: 'application/pdf',
            uploadedBy: 'client',
          }),
        })
        if (!res.ok) throw new Error('Upload failed')
        const json = await res.json()
        const newDoc = json.document as TaxDocument

        // Optimistic updates
        setOptimisticDocs((prev) => [newDoc, ...prev])
        setHiddenPbcItemIds((prev) => new Set(prev).add(item.id))

        toast.success(`Uploaded ${filename}`, {
          description: 'Your accountant has been notified.',
        })

        // Refetch detail in the background to reconcile state
        fetchDetail()
      } catch {
        toast.error('Upload failed. Please try again.')
      } finally {
        setUploadingPbcId(null)
      }
    },
    [detail, client, fetchDetail]
  )

  /* ── Quick upload (drag-drop / file picker / camera) ──────────────────── */
  const handleQuickUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !detail || !client) return
      setQuickUploading(true)
      let success = 0
      for (const file of Array.from(files)) {
        // Try to match a pending PBC item by document type, else upload "unlinked"
        const matchedPbc = pendingPbcItems.find((i) => {
          const def = DOCUMENT_TYPE_MAP[i.documentType]
          return def && file.name.toLowerCase().includes(i.documentType.toLowerCase())
        })
        try {
          const res = await fetch('/api/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientId: client.id,
              engagementId: detail.id,
              pbcItemId: matchedPbc?.id || null,
              originalFilename: file.name,
              storedFilename: `uploads/${Date.now()}-${file.name}`,
              fileSize: file.size || Math.floor(50_000 + Math.random() * 2_000_000),
              mimeType: file.type || 'application/octet-stream',
              uploadedBy: 'client',
            }),
          })
          if (!res.ok) throw new Error('Upload failed')
          const json = await res.json()
          const newDoc = json.document as TaxDocument
          setOptimisticDocs((prev) => [newDoc, ...prev])
          if (matchedPbc) {
            setHiddenPbcItemIds((prev) => new Set(prev).add(matchedPbc.id))
          }
          success++
        } catch {
          /* continue with next file */
        }
      }
      setQuickUploading(false)
      if (success > 0) {
        toast.success(
          `Uploaded ${success} ${success === 1 ? 'document' : 'documents'}`,
          { description: 'Your accountant has been notified.' }
        )
        fetchDetail()
      } else {
        toast.error('Upload failed. Please try again.')
      }
    },
    [detail, client, pendingPbcItems, fetchDetail]
  )

  /* ── Send a message (local-only since there's no messages POST API) ───── */
  const sendMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim()
      if (!trimmed || !detail) return
      const msg: Message = {
        id: `local-${Date.now()}`,
        engagementId: detail.id,
        clientId: detail.clientId,
        fromType: 'client',
        content: trimmed,
        read: true,
        createdAt: new Date().toISOString(),
      }
      setLocalMessages((prev) => [...prev, msg])
      toast.success('Message sent', {
        description: 'Your accountant typically responds within 2 hours.',
      })
    },
    [detail]
  )

  /* ── Loading skeleton ─────────────────────────────────────────────────── */
  if (loadingLists) {
    return <PortalSkeleton />
  }

  /* ── No clients ───────────────────────────────────────────────────────── */
  if (clients.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Card className="items-center gap-3 p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold">No portal access yet</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Your accountant hasn&apos;t shared any document requests with you. Once
            they do, you&apos;ll see them here.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate('dashboard')}>
            Back to dashboard
          </Button>
        </Card>
      </div>
    )
  }

  const dlState = deadlineState(detail?.deadline)

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      {/* ── Client selector ─────────────────────────────────────────────── */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Lock className="h-3.5 w-3.5 text-primary" />
          Secure client portal
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Viewing as
          </span>
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger
              size="sm"
              className="h-8 min-w-[10rem] max-w-[16rem] gap-1.5 rounded-full border-slate-200 bg-white text-xs font-medium shadow-none dark:border-slate-700 dark:bg-slate-900"
            >
              <Avatar className="h-5 w-5">
                <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                  {initials(client?.name)}
                </AvatarFallback>
              </Avatar>
              <SelectValue placeholder="Select client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                        {initials(c.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{c.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Welcome header + progress card ──────────────────────────────── */}
      <WelcomeCard
        clientName={client?.name || 'there'}
        engagementType={detail?.engagementType}
        taxYear={detail?.taxYear}
        progress={displayProgress}
        deadline={detail?.deadline}
        dlState={dlState}
        loading={loadingDetail}
        hasEngagement={!!detail}
      />

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'documents' | 'messages')}
        className="mt-6"
      >
        <TabsList className="grid w-full grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/60">
          <TabsTrigger
            value="documents"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900"
          >
            <FileText className="h-4 w-4" />
            My Documents
            {pendingPbcItems.length > 0 && (
              <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {pendingPbcItems.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="messages"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900"
          >
            <MessageSquare className="h-4 w-4" />
            Messages
          </TabsTrigger>
        </TabsList>

        {/* ── Documents tab ──────────────────────────────────────────────── */}
        <TabsContent value="documents" className="mt-5 space-y-6">
          {/* Quick Upload */}
          <QuickUploadCard
            uploading={quickUploading}
            onPickFiles={() => quickFileInputRef.current?.click()}
            onPickCamera={() => cameraInputRef.current?.click()}
            onPickFilesIcon={() => quickFileInputRef.current?.click()}
            onDropFiles={handleQuickUpload}
            onEmail={() =>
              toast.info('Email upload', {
                description:
                  'Forward documents to portal@meridiancpa.com — they will appear here automatically.',
              })
            }
          />
          <input
            ref={quickFileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              handleQuickUpload(e.target.files)
              e.target.value = ''
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              handleQuickUpload(e.target.files)
              e.target.value = ''
            }}
          />

          {/* Pending PBC items */}
          <section>
            <SectionHeader
              icon={AlertCircle}
              title={`Documents you need to provide (${pendingPbcItems.length} pending)`}
              subtitle="Your accountant has requested the following documents."
            />
            {loadingDetail ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            ) : pendingPbcItems.length === 0 ? (
              <Card className="items-center gap-2 p-6 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  All requested documents uploaded
                </p>
                <p className="text-xs text-muted-foreground">
                  Nice work! Your accountant will review them shortly.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {pendingPbcItems.map((item) => (
                  <PendingPbcCard
                    key={item.id}
                    item={item}
                    uploading={uploadingPbcId === item.id}
                    onUpload={() => uploadForPbcItem(item)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Uploaded documents */}
          <section>
            <SectionHeader
              icon={FileCheck2}
              title={`Uploaded documents (${uploadedDocuments.length})`}
              subtitle="Documents you've shared with your accountant."
            />
            {loadingDetail ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : uploadedDocuments.length === 0 ? (
              <Card className="items-center gap-2 p-6 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <Inbox className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  No documents uploaded yet
                </p>
                <p className="text-xs text-muted-foreground">
                  Use the upload area above or pick a pending document to get
                  started.
                </p>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {uploadedDocuments.map((doc) => (
                  <UploadedDocRow key={doc.id} doc={doc} />
                ))}
              </div>
            )}
          </section>
        </TabsContent>

        {/* ── Messages tab ───────────────────────────────────────────────── */}
        <TabsContent value="messages" className="mt-5">
          <MessagesPanel
            messages={localMessages}
            accountantName={detail?.assignedTo?.name || 'Your accountant'}
            accountantRole={detail?.assignedTo?.role}
            clientName={client?.name || 'You'}
            onSend={sendMessage}
            loading={loadingDetail}
          />
        </TabsContent>
      </Tabs>

      {/* ── Security footer ─────────────────────────────────────────────── */}
      <div className="mt-8 flex flex-col items-center gap-2 border-t border-slate-100 pt-6 text-center dark:border-slate-800">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Bank-grade encryption
        </div>
        <p className="text-[11px] text-muted-foreground">
          AES-256 · SOC 2 Type II compliant · TLS 1.3 in transit
        </p>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Sub-components
 * ────────────────────────────────────────────────────────────────────────── */

function PortalSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-5 flex justify-end">
        <Skeleton className="h-8 w-48 rounded-full" />
      </div>
      <Skeleton className="h-44 w-full rounded-2xl" />
      <div className="mt-6">
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
      <div className="mt-5 space-y-3">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    </div>
  )
}

function WelcomeCard({
  clientName,
  engagementType,
  taxYear,
  progress,
  deadline,
  dlState,
  loading,
  hasEngagement,
}: {
  clientName: string
  engagementType?: string
  taxYear?: number
  progress: number
  deadline?: string | null
  dlState: { label: string; tone: 'danger' | 'warning' | 'ok' }
  loading: boolean
  hasEngagement: boolean
}) {
  const firstName = clientName.split(' ')[0] || clientName
  const toneClass =
    dlState.tone === 'danger'
      ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
      : dlState.tone === 'warning'
        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'

  return (
    <Card className="overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-primary to-teal-700 p-0 text-white shadow-lg shadow-primary/20">
      <div className="relative px-5 py-5 sm:px-6 sm:py-6">
        {/* Decorative sparkle */}
        <Sparkles className="absolute right-4 top-4 h-5 w-5 text-white/25" />

        <p className="text-sm font-medium text-white/80">
          Welcome back, {firstName} 👋
        </p>
        <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
          {hasEngagement
            ? `Your ${engagementType ? engagementShortLabel(engagementType) : ''} return`
            : 'No active engagement'}
        </h1>

        {loading ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-3 w-40 bg-white/20" />
            <Skeleton className="h-3 w-full bg-white/20" />
          </div>
        ) : hasEngagement ? (
          <>
            <div className="mt-4 flex items-center justify-between text-xs text-white/85">
              <span className="font-medium">
                Tax document preparation progress
              </span>
              <span className="text-base font-bold text-white">{progress}%</span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-700 ease-out',
                  progressColorClass(progress)
                )}
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {engagementType && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                  <FileText className="h-3 w-3" />
                  {engagementTypeLabel(engagementType)}
                  {taxYear ? ` · ${taxYear}` : ''}
                </span>
              )}
              {deadline && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-sm',
                    toneClass
                  )}
                >
                  <CalendarClock className="h-3 w-3" />
                  {format(new Date(deadline), 'MMM d, yyyy')} · {dlState.label}
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-white/80">
            Your accountant hasn&apos;t started a document request for you yet.
            Check back soon.
          </p>
        )}
      </div>
    </Card>
  )
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof FileText
  title: string
  subtitle?: string
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {subtitle && (
        <p className="mt-0.5 pl-6 text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  )
}

function PendingPbcCard({
  item,
  uploading,
  onUpload,
}: {
  item: PbcItem
  uploading: boolean
  onUpload: () => void
}) {
  const Icon = categoryIcon(item.category)
  const docTypeDef = DOCUMENT_TYPE_MAP[item.documentType]
  return (
    <Card className="gap-0 rounded-xl p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
            categorySurfaceClass(item.category)
          )}
        >
          {createElement(Icon, { className: 'h-5 w-5' })}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {docTypeDef?.label || item.documentType}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.description}
              </p>
            </div>
            <PriorityBadge priority={item.priority} />
          </div>
          <div className="mt-2 flex items-center gap-2">
            {item.required ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-400">
                Required
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Optional
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">
              Format: {item.expectedFormat.toUpperCase()}
            </span>
          </div>
          <Button
            onClick={onUpload}
            disabled={uploading}
            size="sm"
            className="mt-3 h-9 w-full min-w-[110px] gap-1.5 rounded-lg text-xs font-semibold sm:w-auto"
          >
            {uploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                Upload
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function UploadedDocRow({ doc }: { doc: TaxDocument }) {
  const visual = docStatusVisual(doc.status)
  const Icon = visual.icon
  const docTypeDef = doc.documentType
    ? DOCUMENT_TYPE_MAP[doc.documentType]
    : undefined
  const category = docTypeDef?.category || 'other'
  const CatIcon = categoryIcon(category)
  return (
    <Card className="gap-0 rounded-xl p-3.5">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            categorySurfaceClass(category)
          )}
        >
          {createElement(CatIcon, { className: 'h-4.5 w-4.5' })}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {doc.originalFilename}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {docTypeDef?.label || doc.documentType || 'Document'} ·{' '}
            {format(new Date(doc.uploadedAt), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
              visual.tone === 'ok' &&
                'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
              visual.tone === 'processing' &&
                'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400',
              visual.tone === 'pending' &&
                'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
            )}
          >
            <Icon
              className={cn(
                'h-3 w-3',
                visual.tone === 'processing' && 'animate-spin'
              )}
            />
            {visual.label}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(doc.uploadedAt), { addSuffix: true })}
          </span>
        </div>
      </div>
    </Card>
  )
}

function QuickUploadCard({
  uploading,
  onPickFiles,
  onPickCamera,
  onPickFilesIcon,
  onDropFiles,
  onEmail,
}: {
  uploading: boolean
  onPickFiles: () => void
  onPickCamera: () => void
  onPickFilesIcon: () => void
  onDropFiles: (files: FileList | null) => void
  onEmail: () => void
}) {
  const [dragOver, setDragOver] = useState(false)

  return (
    <Card className="gap-3 rounded-2xl border-dashed border-2 border-slate-200 bg-slate-50/50 p-5 dark:border-slate-700 dark:bg-slate-900/40">
      <button
        type="button"
        onClick={onPickFiles}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          onDropFiles(e.dataTransfer.files)
        }}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-2 rounded-xl px-4 py-6 text-center transition-colors',
          dragOver
            ? 'bg-primary/5 ring-2 ring-primary/40'
            : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Upload className="h-5 w-5" />
          )}
        </div>
        <p className="text-sm font-semibold text-foreground">
          {uploading ? 'Uploading…' : 'Drag & drop files here, or click to browse'}
        </p>
        <p className="text-[11px] text-muted-foreground">
          PDF, JPG, PNG · up to 25MB each · multiple files supported
        </p>
      </button>

      <div className="grid grid-cols-4 gap-2">
        <QuickActionButton
          icon={Camera}
          label="Camera"
          onClick={onPickCamera}
          disabled={uploading}
        />
        <QuickActionButton
          icon={ImageIcon}
          label="Photos"
          onClick={onPickFiles}
          disabled={uploading}
        />
        <QuickActionButton
          icon={Folder}
          label="Files"
          onClick={onPickFilesIcon}
          disabled={uploading}
        />
        <QuickActionButton
          icon={Mail}
          label="Email"
          onClick={onEmail}
          disabled={uploading}
        />
      </div>
    </Card>
  )
}

function QuickActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof Upload
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-3 text-xs font-medium text-slate-700 transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary',
        'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-primary/50 dark:hover:bg-primary/10',
        disabled && 'opacity-50'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

function MessagesPanel({
  messages,
  accountantName,
  accountantRole,
  clientName,
  onSend,
  loading,
}: {
  messages: Message[]
  accountantName: string
  accountantRole?: string
  clientName: string
  onSend: (content: string) => void
  loading: boolean
}) {
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = () => {
    if (!draft.trim()) return
    onSend(draft)
    setDraft('')
  }

  return (
    <Card className="flex h-[600px] max-h-[70vh] flex-col gap-0 overflow-hidden rounded-2xl p-0">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
            {initials(accountantName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {accountantName}
          </p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {accountantRole || 'Your accountant'} · Online
          </p>
        </div>
        <Badge
          variant="secondary"
          className="rounded-full bg-slate-100 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        >
          <Clock className="h-3 w-3" />
          ~2h reply
        </Badge>
      </div>

      {/* Info note */}
      <div className="flex items-center gap-2 bg-primary/5 px-4 py-2 text-[11px] text-primary/80 dark:text-primary/70">
        <Sparkles className="h-3 w-3 shrink-0" />
        Your accountant typically responds within 2 hours during business hours.
      </div>

      {/* Messages list */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto bg-slate-50/40 px-4 py-4 dark:bg-slate-900/30"
      >
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
            <Skeleton className="h-12 w-2/3 rounded-2xl" />
            <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              No messages yet
            </p>
            <p className="max-w-[16rem] text-xs text-muted-foreground">
              Have a question about your documents? Start the conversation below.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              accountantName={accountantName}
              clientName={clientName}
            />
          ))
        )}
      </div>

      {/* Input */}
      <div className="border-t border-slate-100 p-3 dark:border-slate-800">
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20 dark:border-slate-700 dark:bg-slate-900">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground"
            onClick={() => toast.info('Attachments coming soon')}
            aria-label="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Type a message…"
            rows={1}
            className="max-h-28 min-h-[24px] flex-1 resize-none bg-transparent px-1 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <Button
            onClick={handleSend}
            disabled={!draft.trim()}
            size="icon"
            className="h-9 w-9 shrink-0 rounded-xl"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}

function MessageBubble({
  message,
  accountantName,
  clientName,
}: {
  message: Message
  accountantName: string
  clientName: string
}) {
  const fromClient = message.fromType === 'client'
  const fromAI = message.fromType === 'ai'
  const time = format(new Date(message.createdAt), 'h:mm a')

  if (fromClient) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground shadow-sm">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <span className="px-1 text-[10px] text-muted-foreground">{time}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-end gap-2">
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback
            className={cn(
              'text-[10px] font-semibold',
              fromAI
                ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400'
                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
            )}
          >
            {fromAI ? 'AI' : initials(accountantName)}
          </AvatarFallback>
        </Avatar>
        <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2 text-sm text-foreground shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
      <span className="px-9 text-[10px] text-muted-foreground">
        {fromAI ? 'AI Assistant' : accountantName} · {time}
      </span>
    </div>
  )
}
