'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  FileText,
  BarChart3,
  Settings,
  Sparkles,
  UserCircle,
  Moon,
  Sun,
  Search,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CommandPalette } from '@/components/layout/command-palette'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { NotificationsPanel } from '@/components/layout/notifications-panel'

interface NavItem {
  key: string
  label: string
  icon: typeof LayoutDashboard
  view: 'dashboard' | 'clients' | 'engagements' | 'documents' | 'reports' | 'client-portal' | 'settings'
  badge?: string
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, view: 'dashboard' },
  { key: 'clients', label: 'Clients', icon: Users, view: 'clients' },
  { key: 'engagements', label: 'Engagements', icon: ClipboardList, view: 'engagements', badge: '12' },
  { key: 'documents', label: 'Documents', icon: FileText, view: 'documents' },
  { key: 'reports', label: 'Reports', icon: BarChart3, view: 'reports' },
  { key: 'portal', label: 'Client Portal', icon: UserCircle, view: 'client-portal' },
  { key: 'settings', label: 'Settings', icon: Settings, view: 'settings' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useAppStore((s) => s.navigate)
  const currentView = useAppStore((s) => s.currentView)
  const setClientPortalMode = useAppStore((s) => s.setClientPortalMode)
  const setCommandPalette = useAppStore((s) => s.setCommandPalette)
  const openCommandPalette = () => setCommandPalette(true)

  const handleNav = (item: NavItem) => {
    navigate(item.view)
    setClientPortalMode(item.view === 'client-portal')
    setMobileOpen(false)
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-lg shadow-primary/20">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-tight text-white">TaxDox AI</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/60">
              Document Intelligence
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin px-3 py-4">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            Workspace
          </p>
          {NAV_ITEMS.map((item) => {
            const isActive = currentView === item.view || (item.view === 'engagements' && currentView === 'engagement-detail') || (item.view === 'documents' && currentView === 'document-detail')
            const Icon = item.icon
            return (
              <button
                key={item.key}
                onClick={() => handleNav(item)}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                      isActive
                        ? 'bg-sidebar-primary-foreground/20'
                        : 'bg-sidebar-accent text-sidebar-accent-foreground'
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Bottom: Firm info + AI status */}
        <div className="border-t border-sidebar-border p-3">
          <div className="rounded-lg bg-sidebar-accent/50 p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">Meridian CPA Group</p>
                <p className="text-[10px] text-sidebar-foreground/50">Business Plan · SOC 2</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-[10px] text-sidebar-foreground/60">AI engine online · 97.4% accuracy</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <PanelLeft className="h-5 w-5" />
          </Button>

          {/* Search — opens the ⌘K command palette */}
          <button
            type="button"
            onClick={openCommandPalette}
            className="relative hidden flex-1 max-w-md items-center gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:flex h-9"
            aria-label="Open command palette"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">Search clients, engagements, documents…</span>
            <kbd className="hidden shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground lg:block">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-2">
            <NotificationsPanel />

            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  >
                    <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle theme</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-white">
                    SC
                  </div>
                  <div className="hidden text-left lg:block">
                    <p className="text-xs font-semibold leading-none">Sarah Chen</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Tax Partner</p>
                  </div>
                  <ChevronRight className="hidden h-3 w-3 rotate-90 text-muted-foreground lg:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  <div>
                    <p className="text-sm font-semibold">Sarah Chen</p>
                    <p className="text-xs text-muted-foreground">sarah.chen@meridiancpa.com</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Profile Settings</DropdownMenuItem>
                <DropdownMenuItem>Preferences</DropdownMenuItem>
                <DropdownMenuItem>API Keys</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600">Sign Out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>

      {/* Global ⌘K command palette */}
      <CommandPalette />
    </div>
  )
}
