'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FileText,
  Receipt,
  IdCard,
  Building2,
  TrendingUp,
  Home,
  FileSpreadsheet,
  Upload,
  Search,
  FileCheck2,
  Clock3,
  AlertTriangle,
  Loader2,
  Users,
  Calendar,
  Building,
  Filter,
  Inbox,
  ImageIcon,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { StatCard } from '@/components/shared/stat-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { ConfidenceMeter } from '@/components/shared/confidence-meter'
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_MAP,
} from '@/lib/constants'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import type { TaxDocument, Client, Engagement } from '@/lib/types'
import { cn } from '@/lib/utils'

const CATEGORY_ICON_MAP: Record<string, typeof FileText> = {
  income: TrendingUp,
  deduction: Receipt,
  identity: IdCard,
  business: Building2,
  investment: TrendingUp,
  realestate: Home,
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

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function DocumentsView() {
  const [documents, setDocuments] = useState<TaxDocument[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [engagements, setEngagements] = useState<Engagement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [selectedEngagementId, setSelectedEngagementId] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const openDocument = useAppStore((s) => s.openDocument)

  const fetchDocuments = () => {
    setLoading(true)
    fetch('/api/documents')
      .then((r) => r.json())
      .then((d) => {
        setDocuments(d.documents || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchDocuments()
    // Pre-fetch clients so we can default `selectedClientId` to the first client
    // for direct dropzone uploads without requiring the user to open the dialog.
    fetch('/api/clients')
      .then((r) => r.json())
      .then((c) => {
        const list = c.clients || []
        setClients(list)
        if (list.length > 0) {
          setSelectedClientId((prev) => prev || list[0].id)
        }
      })
      .catch(() => {
        /* silent */
      })
  }, [])

  useEffect(() => {
    if (!uploadOpen) return
    Promise.all([
      fetch('/api/clients').then((r) => r.json()),
      fetch('/api/engagements').then((r) => r.json()),
    ])
      .then(([c, e]) => {
        setClients(c.clients || [])
        setEngagements(e.engagements || [])
      })
      .catch(() => {
        /* silent */
      })
  }, [uploadOpen])

  const stats = useMemo(() => {
    const total = documents.length
    const processingCount = documents.filter(
      (d) => d.status === 'uploaded' || d.status === 'processing'
    ).length
    const processed = documents.filter(
      (d) => d.status === 'processed' || d.status === 'reviewed'
    ).length
    const needsReview = documents.filter(
      (d) =>
        (d.status === 'processed' || d.status === 'reviewed') &&
        (d.extractions || []).some((e) => !e.isVerified)
    ).length
    return {
      total,
      processing: processingCount,
      processed,
      needsReview,
    }
  }, [documents])

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      if (search) {
        const q = search.toLowerCase()
        if (!d.originalFilename.toLowerCase().includes(q)) return false
      }
      if (statusFilter !== 'all' && d.status !== statusFilter) return false
      if (typeFilter !== 'all' && d.documentType !== typeFilter) return false
      if (categoryFilter !== 'all') {
        const typeDef = d.documentType ? DOCUMENT_TYPE_MAP[d.documentType] : null
        if (!typeDef || typeDef.category !== categoryFilter) return false
      }
      return true
    })
  }, [documents, search, statusFilter, typeFilter, categoryFilter])

  const handleFileSelect = (file: File) => {
    if (selectedClientId) {
      // Client context already set (or defaulted to first client) — upload directly
      handleUpload(file)
    } else {
      // No client selected — open dialog so user can pick one first
      setPendingFile(file)
      setUploadOpen(true)
    }
  }

  const handleUpload = async (file: File) => {
    // Pick a clientId: prefer selectedClientId, else default to first available client
    let clientId = selectedClientId
    if (!clientId) {
      if (clients.length === 0) {
        toast.error('Please select a client first')
        setPendingFile(file)
        setUploadOpen(true)
        return
      }
      clientId = clients[0].id
      setSelectedClientId(clientId)
    }
    setUploading(true)
    setUploadProgress(0)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('clientId', clientId)
      formData.append('engagementId', selectedEngagementId || '')
      formData.append('uploadedBy', 'user')

      // Simulate progress for visual feedback (real multipart upload progress
      // would require XHR; this provides the same UX affordance).
      const progressInterval = setInterval(() => {
        setUploadProgress((p) => Math.min(90, p + Math.random() * 18))
      }, 180)

      // Don't set Content-Type — the browser sets it with the multipart boundary
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      clearInterval(progressInterval)
      setUploadProgress(100)
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Upload failed')
      }
      await new Promise((r) => setTimeout(r, 250))
      toast.success(`"${file.name}" uploaded`, {
        description: 'Ready for AI processing.',
      })

      // Close dialog if open + reset transient state (keep client/engagement
      // context so subsequent uploads reuse them).
      setUploadOpen(false)
      setPendingFile(null)
      setUploadProgress(0)

      // Auto-trigger AI processing (classify + extract) via GLM-4.6V
      const documentId = data.document?.id
      if (documentId) {
        setProcessing(true)
        const processingToast = toast.info('Processing with GLM-4.6V...', {
          description: 'Classifying document type and extracting fields.',
        })
        try {
          await fetch('/api/ai/classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentId }),
          })
          await fetch('/api/ai/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentId }),
          })
          toast.success('AI processing complete', {
            description: 'Document classified and fields extracted.',
          })
        } catch (err) {
          console.error('AI processing failed:', err)
          toast.warning('AI processing incomplete', {
            description: 'You can re-process from the document detail page.',
          })
        } finally {
          toast.dismiss(processingToast)
          setProcessing(false)
        }
      }

      fetchDocuments()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Upload failed. Please try again.'
      toast.error(message)
    } finally {
      setUploading(false)
    }
  }

  const hasFilters =
    search !== '' ||
    statusFilter !== 'all' ||
    typeFilter !== 'all' ||
    categoryFilter !== 'all'

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setTypeFilter('all')
    setCategoryFilter('all')
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-powered document management
          </p>
        </div>
        <Button onClick={() => fileInputRef.current?.click()}>
          <Upload className="mr-1.5 h-4 w-4" />
          Upload
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.tiff,.docx"
          onChange={(e) => {
            const files = Array.from(e.target.files || [])
            files.forEach((file) => handleFileSelect(file))
            e.target.value = ''
          }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="Total Documents"
          value={stats.total}
          icon={FileText}
          accent="primary"
        />
        <StatCard
          label="Processing"
          value={stats.processing}
          icon={Clock3}
          accent="warning"
        />
        <StatCard
          label="Processed"
          value={stats.processed}
          icon={FileCheck2}
          accent="success"
        />
        <StatCard
          label="Needs Review"
          value={stats.needsReview}
          icon={AlertTriangle}
          accent="danger"
        />
      </div>

      {/* Dropzone */}
      <Card
        className={cn(
          'group relative flex flex-col items-center justify-center border-2 border-dashed p-6 text-center transition-all duration-200',
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 bg-muted/30 hover:border-primary/40 hover:bg-primary/[0.02]',
          (uploading || processing) && 'pointer-events-none'
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const files = Array.from(e.dataTransfer.files || [])
          files.forEach((file) => handleFileSelect(file))
        }}
      >
        {/* Gradient hover glow */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              'radial-gradient(circle at center, oklch(0.48 0.09 195 / 0.06), transparent 70%)',
          }}
          aria-hidden
        />
        {uploading || processing ? (
          <div className="relative flex w-full max-w-md flex-col items-center gap-2 py-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <p className="text-sm font-medium">
              {processing
                ? 'Processing with GLM-4.6V...'
                : 'Uploading file...'}
            </p>
            <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${processing ? 100 : Math.round(uploadProgress)}%`,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {processing
                ? 'Classifying and extracting fields'
                : 'Saving to secure storage'}
            </p>
          </div>
        ) : (
          <div className="relative flex w-full max-w-md flex-col items-center gap-2 py-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-105">
              <Upload className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium">
              Drop files here or click to upload
            </p>
            <p className="text-xs text-muted-foreground">
              Supports PDF, PNG, JPG, TIFF, DOCX · Max 25 MB · Multiple files
              supported
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileText className="mr-1.5 h-4 w-4" />
              Select Files
            </Button>
          </div>
        )}
      </Card>

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by filename..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="uploaded">Uploaded</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="processed">Processed</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full md:w-56">
            <SelectValue placeholder="Document type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {DOCUMENT_TYPES.map((t) => (
              <SelectItem key={t.type} value={t.type}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full md:w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {DOCUMENT_CATEGORIES.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Result count + clear */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading
            ? 'Loading...'
            : `${filtered.length} of ${documents.length} document${
                documents.length === 1 ? '' : 's'
              }`}
        </p>
        {hasFilters && !loading && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <Filter className="mr-1.5 h-3.5 w-3.5" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-60 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Inbox className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">
              {hasFilters ? 'No matching documents' : 'No documents yet'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {hasFilters
                ? 'Try adjusting your filters or upload a new document.'
                : 'Upload your first document to get started.'}
            </p>
          </div>
          {!hasFilters && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-1.5 h-4 w-4" />
              Upload Document
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              onClick={() => openDocument(doc.id)}
            />
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(o) => !uploading && setUploadOpen(o)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload document</DialogTitle>
            <DialogDescription>
              Select a client and engagement to associate with this document.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {pendingFile && (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {pendingFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(pendingFile.size)} ·{' '}
                    {pendingFile.type || 'application/pdf'}
                  </p>
                </div>
              </div>
            )}

            {uploading && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Uploading...</span>
                  <span className="tabular-nums">{Math.round(uploadProgress)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Client</Label>
              <Select
                value={selectedClientId}
                onValueChange={(v) => {
                  setSelectedClientId(v)
                  setSelectedEngagementId('')
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                Engagement{' '}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Select
                value={selectedEngagementId}
                onValueChange={setSelectedEngagementId}
                disabled={!selectedClientId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an engagement" />
                </SelectTrigger>
                <SelectContent>
                  {engagements
                    .filter((e) => e.clientId === selectedClientId)
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.engagementType} · {e.taxYear}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadOpen(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (pendingFile) handleUpload(pendingFile)
              }}
              disabled={uploading || !pendingFile || !selectedClientId}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-1.5 h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface DocumentCardProps {
  doc: TaxDocument & {
    engagement?: Engagement
    pbcItem?: { documentType?: string; description?: string }
  }
  onClick: () => void
}

function DocumentCard({ doc, onClick }: DocumentCardProps) {
  const typeDef = doc.documentType ? DOCUMENT_TYPE_MAP[doc.documentType] : null
  const category = typeDef?.category || 'other'
  const style = getCategoryStyle(category)
  const Icon = typeDef
    ? CATEGORY_ICON_MAP[category] || FileText
    : FileText
  const extractions = doc.extractions || []
  const avgConfidence =
    extractions.length > 0
      ? extractions.reduce((sum, e) => sum + e.confidence, 0) /
        extractions.length
      : doc.confidence
  const verifiedCount = extractions.filter((e) => e.isVerified).length

  // New badge: uploaded within 24 hours
  const uploadedMs = new Date(doc.uploadedAt).getTime()
  const isNew = Date.now() - uploadedMs < 24 * 60 * 60 * 1000

  // Thumbnail state: only used when the document is an image
  const isImage = !!doc.mimeType && doc.mimeType.startsWith('image/')
  const [thumbLoaded, setThumbLoaded] = useState(false)
  const [thumbError, setThumbError] = useState(false)
  // If the doc isn't an image (or the thumbnail failed to load), fall back to
  // the category-colored icon treatment so non-image documents are unaffected.
  const showThumbnail = isImage && !thumbError

  return (
    <button onClick={onClick} className="group block h-full text-left">
      <Card className="card-hover h-full overflow-hidden p-0">
        {/* Top section — image thumbnail for image docs, icon for others */}
        {showThumbnail ? (
          <div className="relative h-24 w-full overflow-hidden rounded-t-lg bg-muted">
            {/* Loading skeleton while the thumbnail streams in */}
            {!thumbLoaded && (
              <div className="absolute inset-0 flex items-center justify-center shimmer-bg">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            <img
              src={`/api/documents/${doc.id}/preview`}
              alt={doc.originalFilename}
              loading="lazy"
              onLoad={() => setThumbLoaded(true)}
              onError={() => setThumbError(true)}
              className={cn(
                'h-24 w-full object-cover transition-opacity duration-300',
                thumbLoaded ? 'opacity-100' : 'opacity-0'
              )}
            />
            {/* Subtle bottom gradient so the status badge stays legible on any image */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/30 to-transparent" />
            <div className="absolute right-2 top-2 flex flex-col items-end gap-1.5">
              {isNew && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                  <span className="h-1 w-1 rounded-full bg-white" />
                  New
                </span>
              )}
              <div className="rounded-full bg-black/45 px-2 py-0.5 backdrop-blur-sm">
                <StatusBadge
                  status={doc.status}
                  className="!bg-transparent !text-white"
                />
              </div>
            </div>
          </div>
        ) : (
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
              {/* When a thumbnail fails on an image doc, show ImageIcon instead of the category icon */}
              {isImage && thumbError ? (
                <ImageIcon className="h-7 w-7" />
              ) : (
                <Icon className="h-7 w-7" />
              )}
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
        )}

        {/* Body */}
        <div className="space-y-3 p-4">
          <div>
            <p
              className="truncate text-sm font-semibold"
              title={doc.originalFilename}
            >
              {doc.originalFilename}
            </p>
            <div className="mt-2 flex items-center gap-2">
              {typeDef ? (
                <Badge variant="secondary" className="text-[10px] font-medium">
                  {doc.documentType}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[10px] text-muted-foreground"
                >
                  Unclassified
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground">
                {(doc.fileSize / 1024).toFixed(0)} KB
              </span>
            </div>
          </div>

          {/* Confidence */}
          {doc.status === 'processed' && extractions.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Confidence
                </span>
                <ConfidenceMeter value={avgConfidence} />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>
                  {extractions.length} field{extractions.length === 1 ? '' : 's'}
                </span>
                <span className="flex items-center gap-1">
                  <FileCheck2 className="h-3 w-3 text-emerald-500" />
                  {verifiedCount}/{extractions.length} verified
                </span>
              </div>
            </div>
          )}

          {doc.status === 'uploaded' && (
            <div className="flex items-center gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 px-2 py-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
              <Clock3 className="h-3 w-3" />
              Ready for AI processing
            </div>
          )}

          <Separator />

          {/* Client + Engagement + Date */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs">
              <Users className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">
                {doc.client?.name || 'Unassigned'}
              </span>
            </div>
            {doc.engagement && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Building className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {doc.engagement.engagementType} · {doc.engagement.taxYear}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 shrink-0" />
              <span>
                {formatDistanceToNow(new Date(doc.uploadedAt), {
                  addSuffix: true,
                })}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </button>
  )
}
