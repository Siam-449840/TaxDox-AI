'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  CalendarClock,
  DollarSign,
  Percent,
  FileText,
  TrendingUp,
  Gift,
  GraduationCap,
  Heart,
  PiggyBank,
  Scale,
  Landmark,
  Wallet,
  Receipt,
  Leaf,
  EyeOff,
  HeartHandshake,
  ShieldCheck,
  Coins,
  Scroll,
  ChevronDown,
  RefreshCw,
  Info,
  Baby,
  Building2,
  FileBarChart,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

/* ------------------------------------------------------------------ */
/* Types — match the shape returned by GET /api/tax-rules            */
/* ------------------------------------------------------------------ */

interface DeductionRow {
  status: string
  amount: number
}

interface BracketRow {
  rate: string
  single: string
  mfj: string
  hoh: string
}

interface CreditItem {
  name: string
  amount: string
}

interface LimitItem {
  name: string
  amount: string
}

interface KeyForm {
  form: string
  description: string
}

interface CountryRules {
  country: string
  flag: string
  taxYear: number | string
  currency: string
  filingDeadline?: string
  extensionDeadline?: string
  federal: {
    standardDeduction: DeductionRow[]
    taxBrackets: BracketRow[]
    keyCredits: CreditItem[]
    keyLimits: LimitItem[]
  }
  keyForms: KeyForm[]
}

interface TaxRulesResponse {
  countries: Record<string, CountryRules>
  supportedCountries: { code: string; name: string; flag: string }[]
}

type CountryCode = 'US' | 'UK' | 'CA'

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$',
  GBP: '£',
  CAD: '$',
}

function formatAmount(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOL[currency] ?? '$'
  return `${symbol}${amount.toLocaleString('en-US')}`
}

/**
 * Parse a numeric percentage out of a rate string like "12%", "20.5%",
 * "0% (Personal Allowance)", "37%", "45% (Additional Rate)".
 * Returns null if no leading number is found.
 */
function parseRate(rate: string): number | null {
  const match = rate.match(/(\d+(?:\.\d+)?)/)
  if (!match) return null
  return parseFloat(match[1])
}

/**
 * Color-code tax rates on a green → teal → amber → orange → red gradient.
 * Lower rates (0–12%) are green/teal; mid rates (20–24%) are amber/orange;
 * higher rates (32%+) are red. Returns background + text + ring classes.
 */
function getRateStyle(rate: string): string {
  const r = parseRate(rate)
  if (r === null) {
    return 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:ring-slate-700'
  }
  if (r === 0) {
    return 'bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-900/60'
  }
  if (r <= 12) {
    return 'bg-teal-100 text-teal-800 ring-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:ring-teal-900/60'
  }
  if (r <= 20.5) {
    return 'bg-cyan-100 text-cyan-800 ring-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:ring-cyan-900/60'
  }
  if (r <= 24) {
    return 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-900/60'
  }
  if (r <= 29) {
    return 'bg-orange-100 text-orange-800 ring-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:ring-orange-900/60'
  }
  if (r <= 33) {
    return 'bg-red-100 text-red-800 ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-900/60'
  }
  return 'bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-900/60'
}

/** Pick a representative Lucide icon for a tax credit based on its name. */
function getCreditIcon(name: string) {
  const n = name.toLowerCase()
  if (n.includes('child') || n.includes('baby')) return Baby
  if (n.includes('education') || n.includes('opportunity') || n.includes('learning'))
    return GraduationCap
  if (n.includes('saver') || n.includes('saving')) return PiggyBank
  if (n.includes('earned income')) return Wallet
  if (n.includes('marriage') || n.includes('married')) return HeartHandshake
  if (n.includes('blind')) return EyeOff
  if (n.includes('gst') || n.includes('hst') || n.includes('sales')) return Receipt
  if (n.includes('climate') || n.includes('carbon')) return Leaf
  if (n.includes('senior') || n.includes('disability') || n.includes('age')) return Heart
  return Gift
}

/** Pick a representative Lucide icon for a contribution / limit type. */
function getLimitIcon(name: string) {
  const n = name.toLowerCase()
  if (n.includes('401')) return PiggyBank
  if (n.includes('ira')) return Landmark
  if (n.includes('hsa') || n.includes('health')) return Heart
  if (n.includes('fsa')) return Wallet
  if (n.includes('gift')) return Gift
  if (n.includes('estate') || n.includes('inheritance')) return Scroll
  if (n.includes('isa')) return Landmark
  if (n.includes('pension') || n.includes('rrsp')) return Coins
  if (n.includes('capital gain') || n.includes('cg')) return TrendingUp
  if (n.includes('tfsa')) return Wallet
  if (n.includes('cpp')) return ShieldCheck
  return Coins
}

/** Pick a representative Lucide icon for a tax form based on its number/name. */
function getFormIcon(form: string, description: string) {
  const f = form.toUpperCase()
  const d = description.toLowerCase()
  if (f.startsWith('10') || f.startsWith('T1') || f.startsWith('SA1')) return FileText
  if (f.startsWith('11') || f.startsWith('T2') || f.startsWith('CT')) return Building2
  if (f.startsWith('P6') || f.startsWith('P4') || f.startsWith('T4') || f.startsWith('T5'))
    return FileBarChart
  if (d.includes('trust') || d.includes('estate')) return Scroll
  return FileText
}

/* ------------------------------------------------------------------ */
/* Small subcomponents                                                */
/* ------------------------------------------------------------------ */

function SectionHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof FileText
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-tight tracking-tight">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  )
}

function SkeletonCard() {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Main view                                                          */
/* ------------------------------------------------------------------ */

export function TaxRulesView() {
  const [data, setData] = useState<TaxRulesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [country, setCountry] = useState<CountryCode>('US')
  const [expandedForm, setExpandedForm] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tax-rules', { cache: 'no-store' })
      if (!res.ok) throw new Error(`Failed to load tax rules (${res.status})`)
      const json: TaxRulesResponse = await res.json()
      setData(json)
    } catch (err) {
      console.error(err)
      toast.error('Could not load tax rules reference data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const current = useMemo(() => data?.countries[country] ?? null, [data, country])

  // Detect whether to show MFJ / HOH columns in the brackets table.
  // For US both columns have values; for UK/CA they are all "—".
  const showMfj = useMemo(() => {
    if (!current) return false
    return current.federal.taxBrackets.some((b) => b.mfj && b.mfj !== '—')
  }, [current])

  const showHoh = useMemo(() => {
    if (!current) return false
    return current.federal.taxBrackets.some((b) => b.hoh && b.hoh !== '—')
  }, [current])

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-6">
      {/* ---------------- Header ---------------- */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-md shadow-primary/20">
              <Scale className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                Tax Rules Reference
              </h1>
              <p className="text-sm text-muted-foreground">
                Configurable tax rules engine — standard deductions, brackets, credits, and limits
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {current && (
            <Badge
              variant="outline"
              className="gap-1.5 border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary"
            >
              <CalendarClock className="h-3.5 w-3.5" />
              Tax Year {String(current.taxYear)}
            </Badge>
          )}
          {current && (
            <Badge
              variant="outline"
              className="gap-1.5 border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              <DollarSign className="h-3.5 w-3.5" />
              {current.currency}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ---------------- Country Tabs ---------------- */}
      <Card className="p-4">
        <Tabs value={country} onValueChange={(v) => setCountry(v as CountryCode)}>
          <TabsList className="h-auto w-full justify-start gap-1 bg-muted/60 p-1 sm:w-auto">
            {data?.supportedCountries.map((c) => (
              <TabsTrigger
                key={c.code}
                value={c.code}
                className="gap-2 px-4 py-1.5 text-sm font-medium"
              >
                <span className="text-base leading-none">{c.flag}</span>
                <span>{c.code}</span>
                <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
                  · {c.name}
                </span>
              </TabsTrigger>
            ))}
            {!data &&
              (['US', 'UK', 'CA'] as const).map((code) => (
                <TabsTrigger
                  key={code}
                  value={code}
                  disabled
                  className="gap-2 px-4 py-1.5 text-sm font-medium"
                >
                  <Skeleton className="h-4 w-12" />
                </TabsTrigger>
              ))}
          </TabsList>
        </Tabs>
      </Card>

      {/* ---------------- Content ---------------- */}
      {loading || !current || !data ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <div className="lg:col-span-2">
            <SkeletonCard />
          </div>
          <SkeletonCard />
        </div>
      ) : (
        <div className="space-y-6">
          {/* ---------------- 1. Filing Deadline ---------------- */}
          <Card className="overflow-hidden p-0">
            <div className="relative">
              {/* Decorative teal gradient banner */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
              <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/30">
                    <CalendarClock className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {current.country} · Filing Deadline
                      </p>
                      <span className="text-base leading-none">{current.flag}</span>
                    </div>
                    <p className="text-lg font-bold tracking-tight sm:text-xl">
                      {current.filingDeadline ?? '—'}
                    </p>
                    {current.extensionDeadline && (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Info className="h-3 w-3" />
                        Extension deadline:{' '}
                        <span className="font-medium text-foreground">
                          {current.extensionDeadline}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end sm:gap-1.5">
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary"
                  >
                    <CalendarClock className="h-3.5 w-3.5" />
                    Tax Year {String(current.taxYear)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    <DollarSign className="h-3.5 w-3.5" />
                    {current.currency}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          {/* ---------------- 2 + 3. Deductions + Brackets ---------------- */}
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Standard Deduction / Personal Allowance */}
            <Card className="p-5 lg:col-span-2">
              <SectionHeader
                icon={PiggyBank}
                title="Standard Deduction / Personal Allowance"
                description={
                  country === 'US'
                    ? 'Federal standard deduction by filing status'
                    : 'Personal allowance / basic personal amount'
                }
              />
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="h-9 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Filing Status
                      </TableHead>
                      <TableHead className="h-9 px-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Amount
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {current.federal.standardDeduction.map((row) => (
                      <TableRow key={row.status}>
                        <TableCell className="px-3 py-2.5 text-sm font-medium">
                          {row.status}
                        </TableCell>
                        <TableCell className="px-3 py-2.5 text-right font-mono text-sm font-semibold tabular-nums text-primary">
                          {formatAmount(row.amount, current.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                {country === 'US'
                  ? 'Taxpayers who itemize deductions cannot also claim the standard deduction.'
                  : country === 'UK'
                    ? 'Personal Allowance is reduced by £1 for every £2 of income above £100,000.'
                    : 'Basic Personal Amount is indexed annually; higher-income taxpayers may receive a reduced amount.'}
              </p>
            </Card>

            {/* Tax Brackets */}
            <Card className="p-5 lg:col-span-3">
              <SectionHeader
                icon={Percent}
                title="Tax Brackets"
                description={`${current.country} federal marginal tax rates · ${String(current.taxYear)}`}
              />
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="h-9 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Rate
                      </TableHead>
                      <TableHead className="h-9 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Single
                      </TableHead>
                      {showMfj && (
                        <TableHead className="h-9 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Married Filing Jointly
                        </TableHead>
                      )}
                      {showHoh && (
                        <TableHead className="h-9 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Head of Household
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {current.federal.taxBrackets.map((row, idx) => (
                      <TableRow key={`${row.rate}-${idx}`}>
                        <TableCell className="px-3 py-2.5">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ring-1 ring-inset tabular-nums',
                              getRateStyle(row.rate)
                            )}
                          >
                            <Percent className="h-3 w-3 opacity-70" />
                            {row.rate}
                          </span>
                        </TableCell>
                        <TableCell className="px-3 py-2.5 font-mono text-xs tabular-nums text-foreground">
                          {row.single}
                        </TableCell>
                        {showMfj && (
                          <TableCell className="px-3 py-2.5 font-mono text-xs tabular-nums text-foreground">
                            {row.mfj === '—' ? (
                              <span className="text-muted-foreground/50">—</span>
                            ) : (
                              row.mfj
                            )}
                          </TableCell>
                        )}
                        {showHoh && (
                          <TableCell className="px-3 py-2.5 font-mono text-xs tabular-nums text-foreground">
                            {row.hoh === '—' ? (
                              <span className="text-muted-foreground/50">—</span>
                            ) : (
                              row.hoh
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">Rate scale:</span>
                {[
                  { label: '0–12%', cls: 'bg-teal-100 text-teal-800 ring-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:ring-teal-900/60' },
                  { label: '20–24%', cls: 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-900/60' },
                  { label: '26–29%', cls: 'bg-orange-100 text-orange-800 ring-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:ring-orange-900/60' },
                  { label: '32%+', cls: 'bg-red-100 text-red-800 ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-900/60' },
                ].map((s) => (
                  <span
                    key={s.label}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
                      s.cls
                    )}
                  >
                    {s.label}
                  </span>
                ))}
              </div>
            </Card>
          </div>

          {/* ---------------- 4. Key Tax Credits ---------------- */}
          <Card className="p-5">
            <SectionHeader
              icon={Gift}
              title="Key Tax Credits"
              description="Common refundable and non-refundable tax credits for the selected country"
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {current.federal.keyCredits.map((credit) => {
                const Icon = getCreditIcon(credit.name)
                return (
                  <div
                    key={credit.name}
                    className="group relative flex items-start gap-3 rounded-xl border bg-gradient-to-br from-card to-muted/20 p-4 transition-all hover:border-primary/40 hover:shadow-sm"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-tight">{credit.name}</p>
                      <p className="mt-1 text-sm font-medium tabular-nums text-primary">
                        {credit.amount}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* ---------------- 5. Contribution Limits ---------------- */}
          <Card className="overflow-hidden p-5">
            <SectionHeader
              icon={Landmark}
              title="Contribution Limits & Key Thresholds"
              description="Annual contribution limits, gift/estate thresholds, and other tax-advantaged account caps"
            />
            <div className="overflow-hidden rounded-lg border border-primary/15">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary/5 hover:bg-primary/5">
                    <TableHead className="h-9 px-3 text-xs font-semibold uppercase tracking-wider text-primary">
                      Account / Threshold
                    </TableHead>
                    <TableHead className="h-9 px-3 text-right text-xs font-semibold uppercase tracking-wider text-primary">
                      Annual Limit / Amount
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {current.federal.keyLimits.map((limit) => {
                    const Icon = getLimitIcon(limit.name)
                    return (
                      <TableRow
                        key={limit.name}
                        className="group"
                      >
                        <TableCell className="px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-sm font-medium">{limit.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-2.5 text-right">
                          <span className="inline-flex items-center rounded-md bg-primary/5 px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-primary ring-1 ring-inset ring-primary/15">
                            {limit.amount}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              Catch-up contribution amounts apply to taxpayers aged 50+ (US) or per plan rules (UK/CA).
              Always verify with the latest official guidance.
            </p>
          </Card>

          {/* ---------------- 6. Key Tax Forms ---------------- */}
          <Card className="p-5">
            <SectionHeader
              icon={FileText}
              title="Key Tax Forms"
              description="Click a form to expand additional context"
            />
            <div className="overflow-hidden rounded-lg border">
              <ul className="divide-y">
                {current.keyForms.map((f) => {
                  const Icon = getFormIcon(f.form, f.description)
                  const isExpanded = expandedForm === f.form
                  return (
                    <li key={f.form}>
                      <button
                        type="button"
                        onClick={() => setExpandedForm(isExpanded ? null : f.form)}
                        className={cn(
                          'flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40',
                          isExpanded && 'bg-muted/40'
                        )}
                      >
                        <div className="flex h-9 w-12 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/5 font-mono text-xs font-bold tracking-tight text-primary">
                          {f.form}
                        </div>
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{f.description}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Form <span className="font-mono font-semibold">{f.form}</span> · {current.country}
                          </p>
                        </div>
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                            isExpanded && 'rotate-180'
                          )}
                        />
                      </button>
                      {isExpanded && (
                        <div className="border-t border-dashed bg-muted/20 px-3 py-3">
                          <div className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                            <Info className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                            <div className="space-y-1.5">
                              <p>
                                <span className="font-semibold text-foreground">
                                  {f.form}
                                </span>{' '}
                                — {f.description}.
                              </p>
                              <p>
                                This is a reference summary from the TaxDox AI tax rules engine.
                                Use the official tax authority portal for current form revisions,
                                filing instructions, and e-file availability.
                              </p>
                              <p className="flex flex-wrap items-center gap-1.5 pt-1">
                                <Badge
                                  variant="outline"
                                  className="border-primary/30 bg-primary/5 px-1.5 py-0 text-[10px] font-medium text-primary"
                                >
                                  {current.flag} {current.country}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className="border-emerald-200 bg-emerald-50 px-1.5 py-0 text-[10px] font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                                >
                                  Tax Year {String(current.taxYear)}
                                </Badge>
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          </Card>

          {/* ---------------- Footer disclaimer ---------------- */}
          <Card className="border-dashed bg-muted/20 p-4">
            <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="leading-relaxed">
                <span className="font-semibold text-foreground">Reference only.</span>{' '}
                Tax rules are sourced from the TaxDox AI configurable tax engine and reflect the
                latest available figures for{' '}
                <span className="font-medium text-foreground">{current.country}</span> (
                {String(current.taxYear)}). Always confirm with the official tax authority
                (IRS · HMRC · CRA) before filing. Figures may be updated mid-year by legislation.
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
