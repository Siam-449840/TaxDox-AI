'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  FileText,
  BarChart3,
  Download,
  CalendarDays,
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
  Scale,
  Keyboard,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CommandPalette } from '@/components/layout/command-palette'
import { KeyboardShortcutsHelp } from '@/components/layout/keyboard-shortcuts-help'
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
  view: 'dashboard' | 'clients' | 'engagements' | 'documents' | 'reports' | 'export-center' | 'calendar' | 'tax-rules' | 'client-portal' | 'settings'
  badge?: string
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, view: 'dashboard' },
  { key: 'clients', label: 'Clients', icon: Users, view: 'clients' },
  { key: 'engagements', label: 'Engagements', icon: ClipboardList, view: 'engagements', badge: '12' },
  { key: 'documents', label: 'Documents', icon: FileText, view: 'documents' },
  { key: 'reports', label: 'Reports', icon: BarChart3, view: 'reports' },
  { key: 'export', label: 'Export', icon: Download, view: 'export-center' },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays, view: 'calendar' },
  { key: 'tax-rules', label: 'Tax Rules', icon: Scale, view: 'tax-rules' },
  { key: 'portal', label: 'Client Portal', icon: UserCircle, view: 'client-portal' },
  { key: 'settings', label: 'Settings', icon: Settings, view: 'settings' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme()
  const { data: session } = useSession()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useAppStore((s) => s.navigate)
  const currentView = useAppStore((s) => s.currentView)
  const setClientPortalMode = useAppStore((s) => s.setClientPortalMode)

  const userName = session?.user?.name || 'User'
  const userEmail = session?.user?.email || ''
  const userRole = session?.user?.role || 'preparer'
  const userInitials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const firmName = session?.user?.firmName || 'TaxDox AI'
  const subTier = session?.user?.subscriptionTier || 'starter'

  const handleSignOut = () => {
    signOut({ callbackUrl: '/auth/signin' })
  }
  const setCommandPalette = useAppStore((s) => s.setCommandPalette)
  const openCommandPalette = () => setCommandPalette(true)
  const setKeyboardHelp = useAppStore((s) => s.setKeyboardHelp)
  const openKeyboardHelp = () => setKeyboardHelp(true)

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
        <div className="relative flex h-16 items-center gap-2.5 border-b border-sidebar-border bg-gradient-to-r from-sidebar-accent/40 to-transparent px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-lg shadow-primary/30 ring-1 ring-white/10">
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
                  'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:translate-x-0.5'
                )}
              >
                {isActive && (
                  <span
                    className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary-foreground/80"
                    aria-hidden
                  />
                )}
                <Icon className={cn(
                  'h-4 w-4 shrink-0 transition-transform duration-200',
                  !isActive && 'group-hover:scale-110'
                )} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-semibold transition-colors',
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
                <p className="truncate text-xs font-semibold text-white">{firmName}</p>
                <p className="text-[10px] capitalize text-sidebar-foreground/50">{subTier} Plan · SOC 2</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-[10px] text-sidebar-foreground/60">AI engine online · Gemini 3.5 Flash</span>
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
                    {userInitials}
                  </div>
                  <div className="hidden text-left lg:block">
                    <p className="text-xs font-semibold leading-none">{userName}</p>
                    <p className="mt-0.5 text-[10px] capitalize text-muted-foreground">{userRole}</p>
                  </div>
                  <ChevronRight className="hidden h-3 w-3 rotate-90 text-muted-foreground lg:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div>
                    <p className="text-sm font-semibold">{userName}</p>
                    <p className="text-xs text-muted-foreground">{userEmail}</p>
                    <p className="mt-1 text-[10px] capitalize text-muted-foreground">
                      {firmName} · {subTier} plan
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('settings')}>
                  Profile Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('settings')}>
                  Preferences
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openKeyboardHelp}>
                  <Keyboard className="text-muted-foreground" />
                  <span className="flex-1">Keyboard Shortcuts</span>
                  <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground">
                    ?
                  </kbd>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/pricing')}>
                  Billing & Plans
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600" onClick={handleSignOut}>
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>

      {/* Global ⌘K command palette */}
      <CommandPalette />

      {/* Global keyboard shortcuts help overlay (? key) */}
      <KeyboardShortcutsHelp />
    </div>
  )
}
