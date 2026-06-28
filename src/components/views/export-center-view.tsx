'use client'

import { useState, useCallback, useMemo, useSyncExternalStore } from 'react'
import {
  Download,
  FileText,
  Users,
  ClipboardList,
  Sparkles,
  DollarSign,
  TrendingUp,
  Clock,
  Trash2,
  Loader2,
  CheckCircle2,
  History,
  FileSpreadsheet,
  FileType2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

type ExportFormat = 'csv' | 'excel' | 'pdf'

interface HistoryEntry {
  id: string
  filename: string
  format: ExportFormat
  rows: number
  category: string
  timestamp: number
}

interface EngagementsPayload {
  engagements: Array<{
    id: string
    client?: { name: string; email?: string } | null
    clientId: string
    taxYear: number
    engagementType: string
    status: string
    assignedTo?: { name: string } | null
    assignedToId?: string | null
    deadline?: string | null
    priority: string
    progress: number
    fee: number
    notes?: string | null
    createdAt: string
    updatedAt: string
    _count?: { documents?: number; pbcItems?: number; pbcCompleted?: number; messages?: number }
  }>
}

interface ClientsPayload {
  clients: Array<{
    id: string
    name: string
    email: string
    phone?: string | null
    taxId?: string | null
    clientType: string
    status: string
    country: string
    createdAt: string
    updatedAt: string
    _count?: { engagements?: number; documents?: number }
  }>
}

interface DocumentsPayload {
  documents: Array<{
    id: string
    clientId: string
    engagementId?: string | null
    originalFilename: string
    storedFilename: string
    fileSize: number
    mimeType: string
    documentType?: string | null
    confidence: number
    status: string
    uploadedBy: string
    uploadedAt: string
    processedAt?: string | null
    client?: { name: string; email?: string } | null
    extractions?: Array<{
      id: string
      fieldName: string
      fieldLabel: string
      fieldValue: string
      fieldGroup: string
      confidence: number
      isVerified: boolean
      sourceLocation?: string | null
      createdAt: string
      verifiedAt?: string | null
    }>
  }>
}

interface ReportsPayload {
  financial: {
    totalRevenue: number
    collectedRevenue: number
    outstandingRevenue: number
    revenuePerEngagement: number
    avgHourlyRate: number
    outsourcingSavings: number
  }
  teamPerformance: Array<{
    name: string
    role: string
    engagements: number
    completed: number
    revenue: number
    utilization: number
    color: string
  }>
}

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const HISTORY_KEY = 'taxdox-export-history'
const HISTORY_LIMIT = 25

const ACTIVE_STATUSES = ['pbc_sent', 'collecting', 'processing', 'review', 'filing']
const COMPLETED_STATUSES = ['done']

/* ------------------------------------------------------------------ */
/* CSV / Excel / PDF export helpers                                   */
/* ------------------------------------------------------------------ */

/**
 * Generate a properly-escaped CSV string from headers + rows and trigger
 * a browser download. Records the export in localStorage history.
 */
function exportToCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  options?: { category?: string; recordHistory?: boolean }
): number {
  if (!rows.length) {
    toast.info(`No data to export for ${filename}`)
    return 0
  }

  const csvContent = [
    headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(','),
    ...rows.map((row) =>
      row
        .map((cell) => {
          if (cell === null || cell === undefined) return '""'
          return `"${String(cell).replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
        })
        .join(',')
    ),
  ].join('\n')

  // Prepend BOM so Excel opens UTF-8 correctly
  const blob = new Blob([`\uFEFF${csvContent}`], {
    type: 'text/csv;charset=utf-8;',
  })
  const fullFilename = `${filename}-${new Date().toISOString().split('T')[0]}.csv`
  triggerDownload(blob, fullFilename)

  toast.success(`Exported ${fullFilename}`)

  if (options?.recordHistory !== false) {
    recordHistory({
      filename: fullFilename,
      format: 'csv',
      rows: rows.length,
      category: options?.category || filename,
    })
  }
  return rows.length
}

/**
 * Generate a minimal Excel-compatible HTML table (.xls) and trigger download.
 * Excel opens HTML tables natively when served as application/vnd.ms-excel.
 */
function exportToExcel(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  options?: { category?: string; recordHistory?: boolean }
): number {
  if (!rows.length) {
    toast.info(`No data to export for ${filename}`)
    return 0
  }

  const escapeHtml = (s: unknown) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const tableHtml = [
    '<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;font-family:Inter,Arial,sans-serif;font-size:12px;">',
    '<thead><tr style="background:#0f766e;color:#ffffff;font-weight:600;">',
    ...headers.map((h) => `<th>${escapeHtml(h)}</th>`),
    '</tr></thead>',
    '<tbody>',
    ...rows.map(
      (row, idx) =>
        `<tr style="background:${idx % 2 ? '#f8fafc' : '#ffffff'};">${row
          .map((cell) => `<td>${escapeHtml(cell ?? '')}</td>`)
          .join('')}</tr>`
    ),
    '</tbody>',
    '</table>',
  ].join('')

  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${escapeHtml(
    filename
  )}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>${tableHtml}</body></html>`

  const blob = new Blob([html], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  })
  const fullFilename = `${filename}-${new Date().toISOString().split('T')[0]}.xls`
  triggerDownload(blob, fullFilename)

  toast.success(`Exported ${fullFilename}`)

  if (options?.recordHistory !== false) {
    recordHistory({
      filename: fullFilename,
      format: 'excel',
      rows: rows.length,
      category: options?.category || filename,
    })
  }
  return rows.length
}

/**
 * Open a print-ready window with a styled HTML table and trigger print-to-PDF.
 */
function exportToPdf(
  filename: string,
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  options?: { category?: string; recordHistory?: boolean }
): number {
  if (!rows.length) {
    toast.info(`No data to export for ${filename}`)
    return 0
  }

  const escapeHtml = (s: unknown) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const generatedAt = format(new Date(), 'MMM d, yyyy h:mm a')

  const tableHtml = `
    <table>
      <thead>
        <tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row, idx) =>
              `<tr class="${idx % 2 ? 'alt' : ''}">${row
                .map((cell) => `<td>${escapeHtml(cell ?? '')}</td>`)
                .join('')}</tr>`
          )
          .join('')}
      </tbody>
    </table>
  `

  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { size: landscape; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0f172a; margin: 0; padding: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0f766e; padding-bottom: 14px; margin-bottom: 18px; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand .logo { width: 32px; height: 32px; border-radius: 8px; background: #0f766e; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; }
  .brand .name { font-size: 16px; font-weight: 700; color: #0f172a; }
  .brand .tag { font-size: 11px; color: #64748b; letter-spacing: 0.5px; text-transform: uppercase; }
  .meta { text-align: right; font-size: 11px; color: #64748b; }
  .meta .title { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
  .subtitle { font-size: 12px; color: #475569; margin: -10px 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead th { background: #0f766e; color: #fff; text-align: left; padding: 8px 10px; font-weight: 600; border: 1px solid #0f766e; white-space: nowrap; }
  tbody td { padding: 6px 10px; border: 1px solid #e2e8f0; vertical-align: top; }
  tbody tr.alt td { background: #f8fafc; }
  tfoot { font-size: 11px; color: #64748b; margin-top: 14px; }
  .footer { margin-top: 18px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <div class="logo">TX</div>
      <div>
        <div class="name">TaxDox AI</div>
        <div class="tag">Document Intelligence</div>
      </div>
    </div>
    <div class="meta">
      <div class="title">${escapeHtml(title)}</div>
      <div>Generated ${escapeHtml(generatedAt)}</div>
      <div>${rows.length} rows · ${headers.length} columns</div>
    </div>
  </div>
  <div class="subtitle">${escapeHtml(subtitle)}</div>
  ${tableHtml}
  <div class="footer">
    <span>Confidential — TaxDox AI Export Center</span>
    <span>Page 1</span>
  </div>
  <script>window.onload = function() { setTimeout(function() { window.print(); }, 250); }</script>
</body>
</html>`

  const printWindow = window.open('', '_blank', 'width=1100,height=850')
  if (!printWindow) {
    toast.error('Pop-up blocked. Please allow pop-ups to export PDF.')
    return rows.length
  }
  printWindow.document.open()
  printWindow.document.write(doc)
  printWindow.document.close()

  toast.success(`Opened ${filename} PDF for printing`)

  if (options?.recordHistory !== false) {
    recordHistory({
      filename: `${filename}-${new Date().toISOString().split('T')[0]}.pdf`,
      format: 'pdf',
      rows: rows.length,
      category: options?.category || filename,
    })
  }
  return rows.length
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/* ------------------------------------------------------------------ */
/* History (localStorage)                                            */
/* ------------------------------------------------------------------ */

const EMPTY_HISTORY: HistoryEntry[] = []

/**
 * Module-level cache so `getSnapshot` returns a referentially stable array
 * between renders when the underlying localStorage value hasn't changed.
 * `useSyncExternalStore` requires this to avoid infinite re-render loops.
 */
let historyCache: HistoryEntry[] | null = null

function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return EMPTY_HISTORY
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY)
    if (!raw) return EMPTY_HISTORY
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return EMPTY_HISTORY
    return parsed as HistoryEntry[]
  } catch {
    return EMPTY_HISTORY
  }
}

function getHistorySnapshot(): HistoryEntry[] {
  if (historyCache === null) {
    historyCache = loadHistory()
  }
  return historyCache
}

function getServerSnapshot(): HistoryEntry[] {
  return EMPTY_HISTORY
}

function saveHistory(entries: HistoryEntry[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
  } catch {
    /* ignore quota errors */
  }
  historyCache = entries
  // Notify subscribers in the same tab (storage event only fires cross-tab)
  window.dispatchEvent(new CustomEvent('taxdox-export-history-updated'))
}

function subscribeHistory(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const onCustom = () => callback()
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === HISTORY_KEY) {
      // Invalidate cache so the next snapshot re-reads from localStorage
      historyCache = null
      callback()
    }
  }
  window.addEventListener('taxdox-export-history-updated', onCustom)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener('taxdox-export-history-updated', onCustom)
    window.removeEventListener('storage', onStorage)
  }
}

function recordHistory(entry: Omit<HistoryEntry, 'id' | 'timestamp'>) {
  const next: HistoryEntry = {
    ...entry,
    id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  }
  const current = getHistorySnapshot()
  const updated = [next, ...current].slice(0, HISTORY_LIMIT)
  saveHistory(updated)
}

function useHistory() {
  const history = useSyncExternalStore(
    subscribeHistory,
    getHistorySnapshot,
    getServerSnapshot
  )

  const clearHistory = useCallback(() => {
    saveHistory([])
    toast.success('Export history cleared')
  }, [])

  return { history, clearHistory }
}

/* ------------------------------------------------------------------ */
/* Small UI primitives                                                */
/* ------------------------------------------------------------------ */

function FormatToggle({
  value,
  onChange,
  options,
}: {
  value: ExportFormat
  onChange: (v: ExportFormat) => void
  options: { value: ExportFormat; label: string; icon?: typeof FileText }[]
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Export format"
      className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5"
    >
      {options.map((opt) => {
        const active = value === opt.value
        const Icon = opt.icon
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background'
            )}
          >
            {Icon && <Icon className="h-3 w-3" />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function FilterToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
              active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

const FORMAT_ICON_MAP: Record<ExportFormat, typeof FileText> = {
  csv: FileText,
  excel: FileSpreadsheet,
  pdf: FileType2,
}

const FORMAT_BADGE_CLASS: Record<ExportFormat, string> = {
  csv: 'bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:ring-teal-900',
  excel:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
  pdf: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900',
}

/* ------------------------------------------------------------------ */
/* Export card shell                                                  */
/* ------------------------------------------------------------------ */

interface ExportCardProps {
  icon: typeof FileText
  iconBg: string
  iconColor: string
  title: string
  description: string
  badge?: string
  format: ExportFormat
  onFormatChange: (f: ExportFormat) => void
  formatOptions: { value: ExportFormat; label: string; icon?: typeof FileText }[]
  loading: boolean
  onExport: () => void
  footerStats?: { label: string; value: string | number }[]
  children?: React.ReactNode
}

function ExportCard({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  description,
  badge,
  format,
  onFormatChange,
  formatOptions,
  loading,
  onExport,
  footerStats,
  children,
}: ExportCardProps) {
  return (
    <Card className="flex flex-col gap-4 rounded-xl p-5 transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            iconBg
          )}
        >
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {badge && (
              <Badge variant="secondary" className="text-[10px] font-medium">
                {badge}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </div>

      {/* Body: format + filters */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Format
          </span>
          <FormatToggle value={format} onChange={onFormatChange} options={formatOptions} />
        </div>
        {children}
      </div>

      {/* Footer stats */}
      {footerStats && footerStats.length > 0 && (
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
          {footerStats.map((s) => (
            <div key={s.label} className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {s.label}
              </span>
              <span className="text-sm font-semibold text-foreground">{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Action */}
      <Button
        type="button"
        onClick={onExport}
        disabled={loading}
        className="mt-auto w-full"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparing…
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Export {format.toUpperCase()}
          </>
        )}
      </Button>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Main view                                                          */
/* ------------------------------------------------------------------ */

export function ExportCenterView() {
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const { history, clearHistory } = useHistory()

  // Per-card format & filter state
  const [engagementsFormat, setEngagementsFormat] = useState<ExportFormat>('csv')
  const [engagementsFilter, setEngagementsFilter] = useState<
    'all' | 'active' | 'completed' | 'date'
  >('all')
  const [engagementsFrom, setEngagementsFrom] = useState('')
  const [engagementsTo, setEngagementsTo] = useState('')

  const [clientsFormat, setClientsFormat] = useState<ExportFormat>('csv')

  const [documentsFormat, setDocumentsFormat] = useState<ExportFormat>('csv')
  const [documentsFilter, setDocumentsFilter] = useState<
    'all' | 'processed' | 'review'
  >('all')

  const [extractionsFormat, setExtractionsFormat] = useState<ExportFormat>('csv')
  const [extractionsFilter, setExtractionsFilter] = useState<
    'all' | 'verified' | 'review'
  >('all')

  const [financialFormat, setFinancialFormat] = useState<ExportFormat>('csv')
  const [teamFormat, setTeamFormat] = useState<ExportFormat>('csv')

  /* ----------------------------- Fetchers ----------------------------- */

  const fetchEngagements = useCallback(async () => {
    const res = await fetch('/api/engagements', { cache: 'no-store' })
    if (!res.ok) throw new Error('Failed to load engagements')
    const json = (await res.json()) as EngagementsPayload
    return json.engagements || []
  }, [])

  const fetchClients = useCallback(async () => {
    const res = await fetch('/api/clients', { cache: 'no-store' })
    if (!res.ok) throw new Error('Failed to load clients')
    const json = (await res.json()) as ClientsPayload
    return json.clients || []
  }, [])

  const fetchDocuments = useCallback(async () => {
    const res = await fetch('/api/documents', { cache: 'no-store' })
    if (!res.ok) throw new Error('Failed to load documents')
    const json = (await res.json()) as DocumentsPayload
    return json.documents || []
  }, [])

  const fetchReports = useCallback(async () => {
    const res = await fetch('/api/reports', { cache: 'no-store' })
    if (!res.ok) throw new Error('Failed to load reports')
    return (await res.json()) as ReportsPayload
  }, [])

  /* ----------------------------- Helpers ----------------------------- */

  const formatDate = (iso?: string | null) => {
    if (!iso) return ''
    try {
      return format(new Date(iso), 'yyyy-MM-dd')
    } catch {
      return String(iso)
    }
  }

  const filterEngagements = useCallback(
    (rows: EngagementsPayload['engagements']) => {
      if (engagementsFilter === 'active') {
        return rows.filter((e) => ACTIVE_STATUSES.includes(e.status))
      }
      if (engagementsFilter === 'completed') {
        return rows.filter((e) => COMPLETED_STATUSES.includes(e.status))
      }
      if (engagementsFilter === 'date') {
        const from = engagementsFrom ? new Date(engagementsFrom) : null
        const to = engagementsTo ? new Date(engagementsTo) : null
        if (to) to.setHours(23, 59, 59, 999)
        return rows.filter((e) => {
          const d = new Date(e.updatedAt)
          if (from && d < from) return false
          if (to && d > to) return false
          return true
        })
      }
      return rows
    },
    [engagementsFilter, engagementsFrom, engagementsTo]
  )

  /* --------------------- Export handlers (per card) --------------------- */

  const runExport = useCallback(
    async (
      key: string,
      fn: () => Promise<void> | void
    ) => {
      setLoadingKey(key)
      try {
        await fn()
      } catch (err) {
        console.error('[export]', err)
        toast.error(
          err instanceof Error ? err.message : 'Export failed. Please try again.'
        )
      } finally {
        setLoadingKey(null)
      }
    },
    []
  )

  const handleExportEngagements = useCallback(() => {
    runExport('engagements', async () => {
      const all = await fetchEngagements()
      const rows = filterEngagements(all)
      const headers = [
        'ID',
        'Client',
        'Client Email',
        'Tax Year',
        'Type',
        'Status',
        'Priority',
        'Assignee',
        'Progress',
        'Fee',
        'Deadline',
        'Documents',
        'PBC Items',
        'PBC Completed',
        'Messages',
        'Created',
        'Updated',
      ]
      const data = rows.map((e) => [
        e.id,
        e.client?.name || '',
        e.client?.email || '',
        e.taxYear,
        e.engagementType,
        e.status,
        e.priority,
        e.assignedTo?.name || '',
        e.progress,
        e.fee,
        formatDate(e.deadline),
        e._count?.documents ?? 0,
        e._count?.pbcItems ?? 0,
        e._count?.pbcCompleted ?? 0,
        e._count?.messages ?? 0,
        formatDate(e.createdAt),
        formatDate(e.updatedAt),
      ])
      if (engagementsFormat === 'csv') {
        exportToCsv('engagements', headers, data, { category: 'Engagements' })
      } else {
        exportToExcel('engagements', headers, data, { category: 'Engagements' })
      }
    })
  }, [runExport, fetchEngagements, filterEngagements, engagementsFormat])

  const handleExportClients = useCallback(() => {
    runExport('clients', async () => {
      const rows = await fetchClients()
      const headers = [
        'ID',
        'Name',
        'Email',
        'Phone',
        'Tax ID',
        'Type',
        'Status',
        'Country',
        'Engagements',
        'Documents',
        'Created',
        'Updated',
      ]
      const data = rows.map((c) => [
        c.id,
        c.name,
        c.email,
        c.phone || '',
        c.taxId || '',
        c.clientType,
        c.status,
        c.country,
        c._count?.engagements ?? 0,
        c._count?.documents ?? 0,
        formatDate(c.createdAt),
        formatDate(c.updatedAt),
      ])
      if (clientsFormat === 'csv') {
        exportToCsv('clients', headers, data, { category: 'Clients' })
      } else {
        exportToExcel('clients', headers, data, { category: 'Clients' })
      }
    })
  }, [runExport, fetchClients, clientsFormat])

  const handleExportDocuments = useCallback(() => {
    runExport('documents', async () => {
      const all = await fetchDocuments()
      const rows = all.filter((d) => {
        if (documentsFilter === 'processed') {
          return ['processed', 'reviewed'].includes(d.status)
        }
        if (documentsFilter === 'review') {
          return d.status === 'reviewed' || (d.status === 'processed' && d.confidence < 0.9)
        }
        return true
      })
      const headers = [
        'ID',
        'Filename',
        'Client',
        'Document Type',
        'Category',
        'Confidence',
        'Status',
        'File Size (bytes)',
        'MIME Type',
        'Uploaded By',
        'Uploaded At',
        'Processed At',
        'Extractions Count',
        'Verified Extractions',
      ]
      const data = rows.map((d) => {
        const extractions = d.extractions || []
        const verified = extractions.filter((x) => x.isVerified).length
        return [
          d.id,
          d.originalFilename,
          d.client?.name || '',
          d.documentType || 'Unclassified',
          d.documentType || '',
          `${Math.round(d.confidence * 100)}%`,
          d.status,
          d.fileSize,
          d.mimeType,
          d.uploadedBy,
          formatDate(d.uploadedAt),
          formatDate(d.processedAt),
          extractions.length,
          verified,
        ]
      })
      if (documentsFormat === 'csv') {
        exportToCsv('documents', headers, data, { category: 'Documents' })
      } else {
        exportToExcel('documents', headers, data, { category: 'Documents' })
      }
    })
  }, [runExport, fetchDocuments, documentsFilter, documentsFormat])

  const handleExportExtractions = useCallback(() => {
    runExport('extractions', async () => {
      const docs = await fetchDocuments()
      // Aggregate extractions from all documents
      const all = docs.flatMap((d) =>
        (d.extractions || []).map((x) => ({
          ...x,
          documentFilename: d.originalFilename,
          documentType: d.documentType || '',
          clientName: d.client?.name || '',
          documentStatus: d.status,
        }))
      )
      const rows = all.filter((x) => {
        if (extractionsFilter === 'verified') return x.isVerified
        if (extractionsFilter === 'review') return !x.isVerified
        return true
      })
      const headers = [
        'Extraction ID',
        'Document',
        'Client',
        'Document Type',
        'Field Name',
        'Field Label',
        'Field Group',
        'Field Value',
        'Confidence',
        'Verified',
        'Source Location',
        'Verified At',
        'Created At',
      ]
      const data = rows.map((x) => [
        x.id,
        x.documentFilename,
        x.clientName,
        x.documentType,
        x.fieldName,
        x.fieldLabel,
        x.fieldGroup,
        x.fieldValue,
        `${Math.round(x.confidence * 100)}%`,
        x.isVerified ? 'Yes' : 'No',
        x.sourceLocation || '',
        formatDate(x.verifiedAt),
        formatDate(x.createdAt),
      ])
      if (extractionsFormat === 'csv') {
        exportToCsv('ai-extractions', headers, data, { category: 'AI Extractions' })
      } else {
        exportToExcel('ai-extractions', headers, data, { category: 'AI Extractions' })
      }
    })
  }, [runExport, fetchDocuments, extractionsFilter, extractionsFormat])

  const handleExportFinancial = useCallback(() => {
    runExport('financial', async () => {
      const report = await fetchReports()
      const fin = report.financial
      // Build a flat row list summarizing financial KPIs
      const headers = ['Metric', 'Value', 'Unit']
      const data: (string | number)[][] = [
        ['Total Revenue', fin.totalRevenue, 'USD'],
        ['Collected Revenue', fin.collectedRevenue, 'USD'],
        ['Outstanding Revenue', fin.outstandingRevenue, 'USD'],
        ['Revenue per Engagement', fin.revenuePerEngagement, 'USD'],
        ['Avg Hourly Rate', fin.avgHourlyRate, 'USD'],
        ['Outsourcing Savings', fin.outsourcingSavings, 'USD'],
      ]
      if (financialFormat === 'pdf') {
        exportToPdf(
          'financial-summary',
          'Financial Summary Report',
          'Revenue, collected, outstanding by engagement and client.',
          headers,
          data,
          { category: 'Financial Summary' }
        )
      } else {
        exportToCsv('financial-summary', headers, data, {
          category: 'Financial Summary',
        })
      }
    })
  }, [runExport, fetchReports, financialFormat])

  const handleExportTeam = useCallback(() => {
    runExport('team', async () => {
      const report = await fetchReports()
      const team = report.teamPerformance || []
      const headers = [
        'Name',
        'Role',
        'Engagements',
        'Completed',
        'Completion Rate',
        'Revenue',
        'Utilization',
      ]
      const data = team.map((t) => [
        t.name,
        t.role,
        t.engagements,
        t.completed,
        t.engagements > 0
          ? `${Math.round((t.completed / t.engagements) * 100)}%`
          : '0%',
        t.revenue,
        `${t.utilization}%`,
      ])
      if (teamFormat === 'pdf') {
        exportToPdf(
          'team-performance',
          'Team Performance Report',
          'Per-member stats: engagements, completion rate, revenue, utilization.',
          headers,
          data,
          { category: 'Team Performance' }
        )
      } else {
        exportToCsv('team-performance', headers, data, {
          category: 'Team Performance',
        })
      }
    })
  }, [runExport, fetchReports, teamFormat])

  /* ----------------------------- Memoized stats banner ----------------------------- */

  const stats = useMemo(
    () => [
      {
        label: 'Available exports',
        value: '6',
        icon: FileText,
      },
      {
        label: 'Total exports run',
        value: history.length,
        icon: Download,
      },
      {
        label: 'Formats supported',
        value: 'CSV · XLS · PDF',
        icon: FileSpreadsheet,
      },
      {
        label: 'Last export',
        value: history[0]
          ? format(new Date(history[0].timestamp), 'MMM d, h:mm a')
          : '—',
        icon: Clock,
      },
    ],
    [history]
  )

  /* ----------------------------- Render ----------------------------- */

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <Download className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Export Center
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Download your data in CSV, Excel, or PDF format
            </p>
          </div>
        </div>
      </header>

      {/* Quick stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Card
              key={s.label}
              className="flex items-center gap-3 rounded-xl p-4"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </p>
                <p className="truncate text-sm font-semibold text-foreground">
                  {s.value}
                </p>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Export cards grid */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Data Exports
          </h2>
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* 1. Engagements */}
          <ExportCard
            icon={ClipboardList}
            iconBg="bg-teal-50 dark:bg-teal-950/40"
            iconColor="text-teal-600 dark:text-teal-300"
            title="Engagements"
            description="All engagement data including client, type, status, progress, deadline, fee"
            format={engagementsFormat}
            onFormatChange={setEngagementsFormat}
            formatOptions={[
              { value: 'csv', label: 'CSV', icon: FileText },
              { value: 'excel', label: 'Excel', icon: FileSpreadsheet },
            ]}
            loading={loadingKey === 'engagements'}
            onExport={handleExportEngagements}
          >
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Filter
              </span>
              <FilterToggle
                value={engagementsFilter}
                onChange={setEngagementsFilter}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'active', label: 'Active' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'date', label: 'By Date Range' },
                ]}
              />
              {engagementsFilter === 'date' && (
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="eng-from" className="text-[10px] text-muted-foreground">
                      From
                    </Label>
                    <Input
                      id="eng-from"
                      type="date"
                      value={engagementsFrom}
                      onChange={(e) => setEngagementsFrom(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="eng-to" className="text-[10px] text-muted-foreground">
                      To
                    </Label>
                    <Input
                      id="eng-to"
                      type="date"
                      value={engagementsTo}
                      onChange={(e) => setEngagementsTo(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          </ExportCard>

          {/* 2. Clients */}
          <ExportCard
            icon={Users}
            iconBg="bg-violet-50 dark:bg-violet-950/40"
            iconColor="text-violet-600 dark:text-violet-300"
            title="Clients"
            description="All client information including contact details, type, status"
            format={clientsFormat}
            onFormatChange={setClientsFormat}
            formatOptions={[
              { value: 'csv', label: 'CSV', icon: FileText },
              { value: 'excel', label: 'Excel', icon: FileSpreadsheet },
            ]}
            loading={loadingKey === 'clients'}
            onExport={handleExportClients}
          />

          {/* 3. Documents */}
          <ExportCard
            icon={FileText}
            iconBg="bg-sky-50 dark:bg-sky-950/40"
            iconColor="text-sky-600 dark:text-sky-300"
            title="Documents"
            description="All document records with classification, confidence, extraction status"
            format={documentsFormat}
            onFormatChange={setDocumentsFormat}
            formatOptions={[
              { value: 'csv', label: 'CSV', icon: FileText },
              { value: 'excel', label: 'Excel', icon: FileSpreadsheet },
            ]}
            loading={loadingKey === 'documents'}
            onExport={handleExportDocuments}
          >
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Filter
              </span>
              <FilterToggle
                value={documentsFilter}
                onChange={setDocumentsFilter}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'processed', label: 'Processed' },
                  { value: 'review', label: 'Needs Review' },
                ]}
              />
            </div>
          </ExportCard>

          {/* 4. Extractions */}
          <ExportCard
            icon={Sparkles}
            iconBg="bg-amber-50 dark:bg-amber-950/40"
            iconColor="text-amber-600 dark:text-amber-300"
            title="AI Extractions"
            description="All extracted field data with confidence scores and verification status"
            badge="AI"
            format={extractionsFormat}
            onFormatChange={setExtractionsFormat}
            formatOptions={[
              { value: 'csv', label: 'CSV', icon: FileText },
              { value: 'excel', label: 'Excel', icon: FileSpreadsheet },
            ]}
            loading={loadingKey === 'extractions'}
            onExport={handleExportExtractions}
          >
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Filter
              </span>
              <FilterToggle
                value={extractionsFilter}
                onChange={setExtractionsFilter}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'verified', label: 'Verified' },
                  { value: 'review', label: 'Needs Review' },
                ]}
              />
            </div>
          </ExportCard>

          {/* 5. Financial Summary */}
          <ExportCard
            icon={DollarSign}
            iconBg="bg-emerald-50 dark:bg-emerald-950/40"
            iconColor="text-emerald-600 dark:text-emerald-300"
            title="Financial Summary"
            description="Revenue, collected, outstanding by engagement and client"
            badge="Report"
            format={financialFormat}
            onFormatChange={setFinancialFormat}
            formatOptions={[
              { value: 'csv', label: 'CSV', icon: FileText },
              { value: 'pdf', label: 'PDF', icon: FileType2 },
            ]}
            loading={loadingKey === 'financial'}
            onExport={handleExportFinancial}
          />

          {/* 6. Team Performance */}
          <ExportCard
            icon={TrendingUp}
            iconBg="bg-rose-50 dark:bg-rose-950/40"
            iconColor="text-rose-600 dark:text-rose-300"
            title="Team Performance"
            description="Per-member stats: engagements, completion rate, revenue, utilization"
            badge="Report"
            format={teamFormat}
            onFormatChange={setTeamFormat}
            formatOptions={[
              { value: 'csv', label: 'CSV', icon: FileText },
              { value: 'pdf', label: 'PDF', icon: FileType2 },
            ]}
            loading={loadingKey === 'team'}
            onExport={handleExportTeam}
          />
        </div>
      </section>

      {/* Export history */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Recent Exports
            </h2>
            {history.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {history.length}
              </Badge>
            )}
          </div>
          {history.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearHistory}
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
              Clear history
            </Button>
          )}
        </div>

        {history.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-2 rounded-xl p-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No exports yet</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Your exported files will appear here for quick reference. History is
              stored locally in your browser.
            </p>
          </Card>
        ) : (
          <Card className="overflow-hidden rounded-xl p-0">
            <ul className="divide-y divide-border">
              {history.map((h) => {
                const FormatIcon = FORMAT_ICON_MAP[h.format]
                return (
                  <li
                    key={h.id}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md ring-1',
                        FORMAT_BADGE_CLASS[h.format]
                      )}
                    >
                      <FormatIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {h.filename}
                      </p>
                      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="uppercase">{h.format}</span>
                        <span aria-hidden>·</span>
                        <span>{h.rows.toLocaleString()} rows</span>
                        <span aria-hidden>·</span>
                        <span>{h.category}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span title={format(new Date(h.timestamp), 'PPpp')}>
                        {format(new Date(h.timestamp), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  </li>
                )
              })}
            </ul>
          </Card>
        )}
      </section>
    </div>
  )
}
