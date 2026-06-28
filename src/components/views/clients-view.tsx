'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Users,
  UserCheck,
  Building2,
  User as UserIcon,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Pencil,
  FilePlus2,
  Mail,
  Phone,
  Hash,
  Globe,
  X,
  Loader2,
  ArrowUpDown,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { StatCard } from '@/components/shared/stat-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { CLIENT_TYPES, COUNTRIES } from '@/lib/constants'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ClientType } from '@/lib/types'

// ─── Types ──────────────────────────────────────────────────────

interface ClientRow {
  id: string
  firmId: string
  name: string
  email: string
  phone?: string | null
  taxId?: string | null
  clientType: ClientType
  status: string
  country: string
  createdAt: string
  updatedAt: string
  _count?: { engagements: number; documents: number }
}

interface ClientFormState {
  name: string
  email: string
  phone: string
  taxId: string
  clientType: ClientType
  country: string
  status: string
}

// ─── Constants ──────────────────────────────────────────────────

const TYPE_AVATAR_COLORS: Record<ClientType, string> = {
  individual: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  business: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300',
  trust: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
  nonprofit: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
}

const TYPE_BADGE_COLORS: Record<ClientType, string> = {
  individual: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  business: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-900',
  trust: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900',
  nonprofit: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900',
}

const STATUS_FILTERS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'prospect', label: 'Prospect' },
] as const

const TYPE_FILTERS = [
  { value: 'all', label: 'All Types' },
  ...CLIENT_TYPES.map((t) => ({ value: t.value, label: t.label })),
] as const

const EMPTY_FORM: ClientFormState = {
  name: '',
  email: '',
  phone: '',
  taxId: '',
  clientType: 'individual',
  country: 'US',
  status: 'active',
}

// ─── Helpers ────────────────────────────────────────────────────

function getInitials(name: string): string {
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

/** Format tax ID for display — keeps existing mask, otherwise masks last 4. */
function formatTaxId(taxId: string | null | undefined, type: ClientType): string {
  if (!taxId) return '—'
  // Already masked (from seed) — pass through
  if (taxId.includes('*')) return taxId
  // SSN: 9 digits → xxx-xx-1234
  if (type === 'individual' && /^\d{9}$/.test(taxId)) {
    return `***-**-${taxId.slice(-4)}`
  }
  // EIN: 9 digits → xx-xxx1234
  if (type !== 'individual' && /^\d{9}$/.test(taxId)) {
    return `**-***${taxId.slice(-4)}`
  }
  // Anything else: show last 4 only
  if (taxId.length > 4) return `••••${taxId.slice(-4)}`
  return taxId
}

// ─── Component ──────────────────────────────────────────────────

export function ClientsView() {
  const navigate = useAppStore((s) => s.navigate)
  const openClient = useAppStore((s) => s.openClient)

  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ClientFormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof ClientFormState, string>>>({})

  // ─── Fetch clients ───────────────────────────────────────────
  useEffect(() => {
    void loadClients()
  }, [])

  async function loadClients() {
    setLoading(true)
    try {
      const res = await fetch('/api/clients')
      if (!res.ok) throw new Error('Failed to load clients')
      const data = await res.json()
      setClients(data.clients || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load clients', {
        description: 'Please try again in a moment.',
      })
    } finally {
      setLoading(false)
    }
  }

  // ─── Derived stats ───────────────────────────────────────────
  const stats = useMemo(() => {
    const total = clients.length
    const active = clients.filter((c) => c.status === 'active').length
    const business = clients.filter((c) => c.clientType === 'business').length
    const individual = clients.filter((c) => c.clientType === 'individual').length
    return { total, active, business, individual }
  }, [clients])

  // ─── Filtered clients (client-side filter on top of API data) ─
  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase()
    return clients.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !c.email.toLowerCase().includes(q)) {
        return false
      }
      if (typeFilter !== 'all' && c.clientType !== typeFilter) return false
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      return true
    })
  }, [clients, search, typeFilter, statusFilter])

  const firmId = clients[0]?.firmId

  // ─── Dialog handlers ─────────────────────────────────────────
  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setDialogOpen(true)
  }

  function openEdit(client: ClientRow) {
    setEditingId(client.id)
    setForm({
      name: client.name,
      email: client.email,
      phone: client.phone ?? '',
      taxId: client.taxId ?? '',
      clientType: client.clientType,
      country: client.country,
      status: client.status,
    })
    setErrors({})
    setDialogOpen(true)
  }

  function validate(): boolean {
    const e: Partial<Record<keyof ClientFormState, string>> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.email.trim()) e.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      if (editingId) {
        // PATCH not implemented in API; show optimistic note
        toast.info('Edit coming soon', {
          description: 'Client editing API endpoint is not wired yet.',
        })
        setDialogOpen(false)
      } else {
        const payload = {
          firmId: firmId || 'firm-1-placeholder',
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          taxId: form.taxId.trim() || null,
          clientType: form.clientType,
          country: form.country,
          status: form.status,
        }
        const res = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}))
          throw new Error(errBody?.error || `HTTP ${res.status}`)
        }
        const data = await res.json()
        setClients((prev) => [data.client, ...prev])
        toast.success('Client added', {
          description: `${data.client.name} has been added to your client list.`,
        })
        setDialogOpen(false)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error('Failed to save client', { description: msg })
    } finally {
      setSubmitting(false)
    }
  }

  function handleRowClick(client: ClientRow) {
    openClient(client.id)
  }

  // ─── Loading skeleton ────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 p-4 lg:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
            <div className="h-4 w-72 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <Card className="overflow-hidden">
          <div className="space-y-3 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-md bg-muted/60" />
            ))}
          </div>
        </Card>
      </div>
    )
  }

  // ─── Main render ─────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your client roster, contact details, and engagement history.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadClients()}>
            <ArrowUpDown className="mr-1.5 h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate} className="ml-1 shadow-sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Add Client
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="Total Clients"
          value={stats.total}
          icon={Users}
          accent="primary"
          trend={{ value: 8, label: 'vs last quarter' }}
          className="transition-all hover:-translate-y-0.5 hover:shadow-md"
        />
        <StatCard
          label="Active Clients"
          value={stats.active}
          icon={UserCheck}
          accent="success"
          className="transition-all hover:-translate-y-0.5 hover:shadow-md"
        />
        <StatCard
          label="Business Clients"
          value={stats.business}
          icon={Building2}
          accent="info"
          className="transition-all hover:-translate-y-0.5 hover:shadow-md"
        />
        <StatCard
          label="Individual Clients"
          value={stats.individual}
          icon={UserIcon}
          accent="warning"
          className="transition-all hover:-translate-y-0.5 hover:shadow-md"
        />
      </div>

      {/* Filters + Table Card */}
      <Card className="overflow-hidden">
        {/* Filter Bar */}
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Filters:</span>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger size="sm" className="h-8 w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_FILTERS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.value !== 'all' && (
                      <span className="mr-1">{getTypeDef(t.value).icon}</span>
                    )}
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger size="sm" className="h-8 w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(typeFilter !== 'all' || statusFilter !== 'all' || search) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => {
                  setTypeFilter('all')
                  setStatusFilter('all')
                  setSearch('')
                }}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
          <span>
            Showing <span className="font-semibold text-foreground">{filteredClients.length}</span>{' '}
            of <span className="font-semibold text-foreground">{clients.length}</span> clients
          </span>
        </div>

        {/* Table */}
        {filteredClients.length === 0 ? (
          <EmptyState
            hasClients={clients.length > 0}
            onAdd={openCreate}
            onClear={() => {
              setSearch('')
              setTypeFilter('all')
              setStatusFilter('all')
            }}
          />
        ) : (
          <div className="max-h-[calc(100vh-22rem)] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-[260px] pl-4">Client</TableHead>
                  <TableHead className="min-w-[140px]">Type</TableHead>
                  <TableHead className="min-w-[130px]">Tax ID</TableHead>
                  <TableHead className="min-w-[110px] text-center">Engagements</TableHead>
                  <TableHead className="min-w-[110px] text-center">Documents</TableHead>
                  <TableHead className="min-w-[120px]">Status</TableHead>
                  <TableHead className="min-w-[110px]">Country</TableHead>
                  <TableHead className="w-[60px] text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => {
                  const typeDef = getTypeDef(client.clientType)
                  const countryDef = getCountryDef(client.country)
                  const engagementCount = client._count?.engagements ?? 0
                  const documentCount = client._count?.documents ?? 0
                  return (
                    <TableRow
                      key={client.id}
                      className="cursor-pointer transition-colors hover:bg-muted/30"
                      onClick={() => handleRowClick(client)}
                    >
                      {/* Client cell */}
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                              TYPE_AVATAR_COLORS[client.clientType]
                            )}
                          >
                            {getInitials(client.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold leading-tight">
                              {client.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {client.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Type */}
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium',
                            TYPE_BADGE_COLORS[client.clientType]
                          )}
                        >
                          <span aria-hidden>{typeDef.icon}</span>
                          {typeDef.label}
                        </span>
                      </TableCell>

                      {/* Tax ID */}
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatTaxId(client.taxId, client.clientType)}
                        </span>
                      </TableCell>

                      {/* Engagements */}
                      <TableCell className="text-center">
                        <Badge
                          variant="secondary"
                          className={cn(
                            'tabular-nums',
                            engagementCount === 0 && 'bg-muted text-muted-foreground'
                          )}
                        >
                          {engagementCount}
                        </Badge>
                      </TableCell>

                      {/* Documents */}
                      <TableCell className="text-center">
                        <Badge
                          variant="secondary"
                          className={cn(
                            'tabular-nums',
                            documentCount === 0 && 'bg-muted text-muted-foreground'
                          )}
                        >
                          {documentCount}
                        </Badge>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <StatusBadge status={client.status} />
                      </TableCell>

                      {/* Country */}
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className="text-base leading-none" aria-hidden>
                            {countryDef.flag}
                          </span>
                          <span className="font-medium text-muted-foreground">
                            {countryDef.code}
                          </span>
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell
                        className="pr-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={`Actions for ${client.name}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => handleRowClick(client)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(client)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit client
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                toast.info('Navigating to engagements…')
                                navigate('engagements')
                              }}
                            >
                              <FilePlus2 className="mr-2 h-4 w-4" />
                              New engagement
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Add/Edit Client Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Client' : 'Add New Client'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update client contact and tax profile details.'
                : 'Create a new client record. They can be added to engagements once saved.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="client-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="client-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Acme Corp or Jane Doe"
                autoFocus
                aria-invalid={!!errors.name}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>

            {/* Email + Phone */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="client-email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="client-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="client@example.com"
                    className="pl-9"
                    aria-invalid={!!errors.email}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-phone">Phone</Label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="client-phone"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+1 (555) 000-0000"
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            {/* Tax ID */}
            <div className="space-y-1.5">
              <Label htmlFor="client-taxid">Tax ID (SSN / EIN)</Label>
              <div className="relative">
                <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="client-taxid"
                  value={form.taxId}
                  onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
                  placeholder={form.clientType === 'individual' ? '123-45-6789' : '12-3456789'}
                  className="pl-9 font-mono"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Stored masked — only last 4 digits are visible in lists.
              </p>
            </div>

            {/* Type + Country */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="client-type">Client Type</Label>
                <Select
                  value={form.clientType}
                  onValueChange={(v) => setForm((f) => ({ ...f, clientType: v as ClientType }))}
                >
                  <SelectTrigger id="client-type" className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="mr-1.5">{t.icon}</span>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-country">Country</Label>
                <Select
                  value={form.country}
                  onValueChange={(v) => setForm((f) => ({ ...f, country: v }))}
                >
                  <SelectTrigger id="client-country" className="w-full">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        <span className="mr-1.5">{c.flag}</span>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label htmlFor="client-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger id="client-status" className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Active
                  </SelectItem>
                  <SelectItem value="prospect">
                    <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Prospect
                  </SelectItem>
                  <SelectItem value="inactive">
                    <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                    Inactive
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Live preview card */}
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Preview</p>
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    TYPE_AVATAR_COLORS[form.clientType]
                  )}
                >
                  {form.name ? getInitials(form.name) : '?'}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {form.name || 'Client name'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {form.email || 'client@example.com'}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
                      TYPE_BADGE_COLORS[form.clientType]
                    )}
                  >
                    {getTypeDef(form.clientType).icon} {getTypeDef(form.clientType).label}
                  </span>
                  <StatusBadge status={form.status} />
                </div>
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
                {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {editingId ? 'Save Changes' : 'Create Client'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Empty State ────────────────────────────────────────────────

function EmptyState({
  hasClients,
  onAdd,
  onClear,
}: {
  hasClients: boolean
  onAdd: () => void
  onClear: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <Users className="h-7 w-7 text-primary" />
      </div>
      <h3 className="mt-4 text-base font-semibold">
        {hasClients ? 'No clients match your filters' : 'No clients yet'}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {hasClients
          ? 'Try adjusting your search query or clearing active filters to see more results.'
          : 'Get started by adding your first client to the roster.'}
      </p>
      <div className="mt-4 flex items-center gap-2">
        {hasClients ? (
          <Button variant="outline" size="sm" onClick={onClear}>
            Clear filters
          </Button>
        ) : (
          <Button size="sm" onClick={onAdd}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add your first client
          </Button>
        )}
      </div>
    </div>
  )
}
