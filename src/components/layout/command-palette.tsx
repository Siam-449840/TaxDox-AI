'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTheme } from 'next-themes'
import { useAppStore } from '@/lib/store'
import {
  Search,
  ArrowRight,
  Users,
  ClipboardList,
  FileText,
  LayoutDashboard,
  BarChart3,
  CalendarDays,
  UserCircle,
  Settings,
  Plus,
  Upload,
  Send,
  Moon,
  Sun,
  CornerDownLeft,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ViewKey } from '@/lib/types'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type GroupKey = 'Navigation' | 'Quick Actions' | 'Clients' | 'Engagements' | 'Documents'

interface BaseItem {
  id: string
  group: GroupKey
  title: string
  subtitle?: string
  icon: LucideIcon
  iconClass?: string
  badge?: string
  shortcut?: string
  keywords?: string
  perform: () => void
}

interface ClientResult {
  id: string
  name: string
  email: string
  clientType: string
  status: string
  country?: string
}

interface EngagementResult {
  id: string
  engagementType: string
  taxYear: number
  status: string
  client?: { name: string }
}

interface DocumentResult {
  id: string
  originalFilename: string
  documentType?: string
  status: string
  fileSize?: number
}

interface SearchResults {
  clients: ClientResult[]
  engagements: EngagementResult[]
  documents: DocumentResult[]
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const CLIENT_TYPE_LABEL: Record<string, string> = {
  individual: 'Individual',
  business: 'Business',
  trust: 'Trust',
  nonprofit: 'Nonprofit',
}

function formatBytes(bytes?: number): string {
  if (!bytes && bytes !== 0) return ''
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase())
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function CommandPalette() {
  const open = useAppStore((s) => s.commandPaletteOpen)
  const setOpen = useAppStore((s) => s.setCommandPalette)
  const toggle = useAppStore((s) => s.toggleCommandPalette)
  const navigate = useAppStore((s) => s.navigate)
  const openEngagement = useAppStore((s) => s.openEngagement)
  const openDocument = useAppStore((s) => s.openDocument)
  const setClientPortalMode = useAppStore((s) => s.setClientPortalMode)

  const { theme, setTheme } = useTheme()

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResults>({
    clients: [],
    engagements: [],
    documents: [],
  })

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestIdRef = useRef(0)

  /* --------------------------- actions ---------------------------- */

  const goTo = useCallback(
    (view: ViewKey, portal = false) => {
      navigate(view)
      if (portal) setClientPortalMode(true)
      setOpen(false)
    },
    [navigate, setClientPortalMode, setOpen]
  )

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
    setOpen(false)
  }, [theme, setTheme, setOpen])

  /* ----------------------- static commands ------------------------ */

  const navCommands: BaseItem[] = useMemo(
    () => [
      {
        id: 'nav-dashboard',
        group: 'Navigation',
        title: 'Go to Dashboard',
        subtitle: 'Overview & activity feed',
        icon: LayoutDashboard,
        shortcut: 'G D',
        keywords: 'home overview main',
        perform: () => goTo('dashboard'),
      },
      {
        id: 'nav-clients',
        group: 'Navigation',
        title: 'Go to Clients',
        subtitle: 'Manage client roster',
        icon: Users,
        shortcut: 'G C',
        keywords: 'customers people',
        perform: () => goTo('clients'),
      },
      {
        id: 'nav-engagements',
        group: 'Navigation',
        title: 'Go to Engagements',
        subtitle: 'Tax returns & workflows',
        icon: ClipboardList,
        shortcut: 'G E',
        keywords: 'returns projects work',
        perform: () => goTo('engagements'),
      },
      {
        id: 'nav-documents',
        group: 'Navigation',
        title: 'Go to Documents',
        subtitle: 'All uploaded documents',
        icon: FileText,
        shortcut: 'G O',
        keywords: 'files uploads',
        perform: () => goTo('documents'),
      },
      {
        id: 'nav-reports',
        group: 'Navigation',
        title: 'Go to Reports',
        subtitle: 'Operational & financial metrics',
        icon: BarChart3,
        shortcut: 'G R',
        keywords: 'analytics metrics stats',
        perform: () => goTo('reports'),
      },
      {
        id: 'nav-calendar',
        group: 'Navigation',
        title: 'Go to Calendar',
        subtitle: 'Filing deadlines at a glance',
        icon: CalendarDays,
        shortcut: 'G L',
        keywords: 'deadline schedule month week',
        perform: () => goTo('calendar'),
      },
      {
        id: 'nav-portal',
        group: 'Navigation',
        title: 'Go to Client Portal',
        subtitle: 'External client experience',
        icon: UserCircle,
        shortcut: 'G P',
        keywords: 'external share',
        perform: () => goTo('client-portal', true),
      },
      {
        id: 'nav-settings',
        group: 'Navigation',
        title: 'Go to Settings',
        subtitle: 'Team, templates, integrations',
        icon: Settings,
        shortcut: 'G S',
        keywords: 'preferences config',
        perform: () => goTo('settings'),
      },
    ],
    [goTo]
  )

  const actionCommands: BaseItem[] = useMemo(
    () => [
      {
        id: 'act-new-engagement',
        group: 'Quick Actions',
        title: 'New Engagement',
        subtitle: 'Create a tax return engagement',
        icon: Plus,
        iconClass: 'text-emerald-500',
        keywords: 'create engagement return add',
        perform: () => goTo('engagements'),
      },
      {
        id: 'act-new-client',
        group: 'Quick Actions',
        title: 'New Client',
        subtitle: 'Add a client to the roster',
        icon: Users,
        iconClass: 'text-teal-500',
        keywords: 'create add customer',
        perform: () => goTo('clients'),
      },
      {
        id: 'act-upload-document',
        group: 'Quick Actions',
        title: 'Upload Document',
        subtitle: 'Upload a tax document',
        icon: Upload,
        iconClass: 'text-sky-500',
        keywords: 'import file add',
        perform: () => goTo('documents'),
      },
      {
        id: 'act-pbc-reminders',
        group: 'Quick Actions',
        title: 'Send PBC Reminders',
        subtitle: 'Nudge clients for outstanding items',
        icon: Send,
        iconClass: 'text-amber-500',
        keywords: 'pbc list request email notify',
        perform: () => goTo('engagements'),
      },
      {
        id: 'act-export-reports',
        group: 'Quick Actions',
        title: 'Export Reports',
        subtitle: 'Download operational metrics',
        icon: BarChart3,
        iconClass: 'text-violet-500',
        keywords: 'download csv excel metrics',
        perform: () => goTo('reports'),
      },
      {
        id: 'act-toggle-theme',
        group: 'Quick Actions',
        title: 'Toggle Theme',
        subtitle: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
        icon: theme === 'dark' ? Sun : Moon,
        iconClass: 'text-primary',
        keywords: 'dark light mode appearance',
        perform: toggleTheme,
      },
    ],
    [goTo, theme, toggleTheme]
  )

  /* --------------------- filtered static items -------------------- */

  const filteredNav = useMemo(() => {
    if (!query.trim()) return navCommands
    return navCommands.filter(
      (c) =>
        matchesQuery(c.title, query) ||
        matchesQuery(c.subtitle ?? '', query) ||
        matchesQuery(c.keywords ?? '', query)
    )
  }, [navCommands, query])

  const filteredActions = useMemo(() => {
    if (!query.trim()) return actionCommands
    return actionCommands.filter(
      (c) =>
        matchesQuery(c.title, query) ||
        matchesQuery(c.subtitle ?? '', query) ||
        matchesQuery(c.keywords ?? '', query)
    )
  }, [actionCommands, query])

  /* ------------------------ search results ------------------------ */

  const clientItems: BaseItem[] = useMemo(
    () =>
      results.clients.slice(0, 5).map((c) => ({
        id: `client-${c.id}`,
        group: 'Clients',
        title: c.name,
        subtitle: c.email,
        icon: Users,
        iconClass: 'text-teal-500',
        badge: CLIENT_TYPE_LABEL[c.clientType] ?? c.clientType,
        perform: () => {
          navigate('clients')
          setOpen(false)
        },
      })),
    [results.clients, navigate, setOpen]
  )

  const engagementItems: BaseItem[] = useMemo(
    () =>
      results.engagements.slice(0, 5).map((e) => ({
        id: `eng-${e.id}`,
        group: 'Engagements',
        title: `${e.client?.name ?? 'Unknown client'} · ${e.engagementType} ${e.taxYear}`,
        subtitle: `Status: ${e.status.replace('_', ' ')}`,
        icon: ClipboardList,
        iconClass: 'text-primary',
        badge: e.engagementType,
        perform: () => {
          openEngagement(e.id)
          setOpen(false)
        },
      })),
    [results.engagements, openEngagement, setOpen]
  )

  const documentItems: BaseItem[] = useMemo(
    () =>
      results.documents.slice(0, 6).map((d) => ({
        id: `doc-${d.id}`,
        group: 'Documents',
        title: d.originalFilename,
        subtitle: [d.documentType, formatBytes(d.fileSize)].filter(Boolean).join(' · '),
        icon: FileText,
        iconClass: 'text-sky-500',
        badge: d.status,
        perform: () => {
          openDocument(d.id)
          setOpen(false)
        },
      })),
    [results.documents, openDocument, setOpen]
  )

  const hasSearchResults =
    clientItems.length > 0 ||
    engagementItems.length > 0 ||
    documentItems.length > 0

  /* ------------------------- flat items --------------------------- */

  const flatItems = useMemo(() => {
    const items: BaseItem[] = []
    if (filteredNav.length) items.push(...filteredNav)
    if (filteredActions.length) items.push(...filteredActions)
    if (query.trim()) {
      items.push(...clientItems)
      items.push(...engagementItems)
      items.push(...documentItems)
    }
    return items
  }, [filteredNav, filteredActions, clientItems, engagementItems, documentItems, query])

  /* ----------------------- reset on close ------------------------- */

  useEffect(() => {
    if (!open) {
      // small delay so the close animation doesn't show empty state
      const t = setTimeout(() => {
        setQuery('')
        setSelectedIndex(0)
        setResults({ clients: [], engagements: [], documents: [] })
        setLoading(false)
      }, 150)
      return () => clearTimeout(t)
    }
    // focus input on open
    const t = setTimeout(() => inputRef.current?.focus(), 30)
    return () => clearTimeout(t)
  }, [open])

  /* ----------------- clamp selection when items change ------------ */

  useEffect(() => {
    if (selectedIndex >= flatItems.length) setSelectedIndex(0)
  }, [flatItems.length, selectedIndex])

  /* ----------------------- debounced search ----------------------- */

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (!q) {
      setResults({ clients: [], engagements: [], documents: [] })
      setLoading(false)
      return
    }
    setLoading(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const reqId = ++requestIdRef.current
      try {
        const [clientsRes, engRes, docsRes] = await Promise.all([
          fetch(`/api/clients?search=${encodeURIComponent(q)}`).then((r) => r.json()),
          fetch(`/api/engagements?search=${encodeURIComponent(q)}`).then((r) => r.json()),
          fetch(`/api/documents`).then((r) => r.json()),
        ])
        // ignore out-of-order responses
        if (reqId !== requestIdRef.current) return
        const docs = (docsRes.documents ?? []) as DocumentResult[]
        const lowerQ = q.toLowerCase()
        const filteredDocs = docs
          .filter((d) => d.originalFilename.toLowerCase().includes(lowerQ))
          .slice(0, 6)
        setResults({
          clients: (clientsRes.clients ?? []).slice(0, 5),
          engagements: (engRes.engagements ?? []).slice(0, 5),
          documents: filteredDocs,
        })
      } catch {
        if (reqId !== requestIdRef.current) return
        setResults({ clients: [], engagements: [], documents: [] })
      } finally {
        if (reqId === requestIdRef.current) setLoading(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, open])

  /* ------------------- global ⌘K / Ctrl+K listener ---------------- */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggle])

  /* ------------- in-palette keyboard nav (arrows/enter/esc) ------- */

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => (flatItems.length ? (i + 1) % flatItems.length : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) =>
          flatItems.length ? (i - 1 + flatItems.length) % flatItems.length : 0
        )
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const item = flatItems[selectedIndex]
        if (item) item.perform()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      }
    },
    [flatItems, selectedIndex, setOpen]
  )

  /* ------------------ scroll selected item into view -------------- */

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-cmd-idx="${selectedIndex}"]`
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  /* ----------------------------- render --------------------------- */

  if (!open) return null

  // Build grouped sections in display order
  const sections: { key: GroupKey; items: BaseItem[] }[] = [
    { key: 'Navigation', items: filteredNav },
    { key: 'Quick Actions', items: filteredActions },
    { key: 'Clients', items: clientItems },
    { key: 'Engagements', items: engagementItems },
    { key: 'Documents', items: documentItems },
  ]

  let runningIndex = -1

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in-0 duration-150"
      style={{ paddingTop: '18vh' }}
      onClick={() => setOpen(false)}
      onKeyDown={handleKeyDown}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border bg-popover shadow-2xl animate-in fade-in-0 zoom-in-95 slide-in-from-top-4 duration-150"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b px-4">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="Search clients, engagements, documents or run a command…"
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/70"
            autoComplete="off"
            spellCheck={false}
          />
          {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
          {!loading && query && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted"
            >
              clear
            </button>
          )}
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="min-h-0 flex-1 overflow-y-auto py-2"
        >
          {flatItems.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <Search className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">No results found</p>
              <p className="text-xs text-muted-foreground">
                Try a different search term or pick a command above.
              </p>
            </div>
          )}

          {sections.map((section) => {
            if (section.items.length === 0) return null
            return (
              <div key={section.key} className="px-2 pb-1">
                <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {section.key}
                  {section.key !== 'Navigation' && section.key !== 'Quick Actions' && (
                    <span className="ml-1.5 normal-case text-muted-foreground/50">
                      · {section.items.length}
                    </span>
                  )}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    runningIndex += 1
                    const idx = runningIndex
                    const isActive = idx === selectedIndex
                    const Icon = item.icon
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-cmd-idx={idx}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        onClick={item.perform}
                        className={cn(
                          'group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                          isActive
                            ? 'bg-accent text-accent-foreground'
                            : 'hover:bg-accent/60'
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background/60',
                            isActive
                              ? 'border-primary/30 text-primary'
                              : 'border-border text-muted-foreground'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {item.title}
                          </span>
                          {item.subtitle && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {item.subtitle}
                            </span>
                          )}
                        </span>
                        {item.badge && (
                          <span className="shrink-0 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {item.badge}
                          </span>
                        )}
                        {item.shortcut && (
                          <span className="hidden shrink-0 gap-0.5 sm:flex">
                            {item.shortcut.split(' ').map((k, i) => (
                              <kbd
                                key={i}
                                className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                              >
                                {k}
                              </kbd>
                            ))}
                          </span>
                        )}
                        {isActive && (
                          <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono">↑</kbd>
              <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono">↓</kbd>
              <span className="ml-1">navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="flex items-center rounded border bg-background px-1.5 py-0.5 font-mono">
                <CornerDownLeft className="h-3 w-3" />
              </kbd>
              <span className="ml-1">select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono">esc</kbd>
              <span className="ml-1">close</span>
            </span>
          </div>
          <div className="hidden items-center gap-1.5 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
            <span className="font-medium text-foreground/70">TaxDox AI</span>
            <span className="text-muted-foreground/60">· Command Palette</span>
          </div>
        </div>
      </div>
    </div>
  )
}
