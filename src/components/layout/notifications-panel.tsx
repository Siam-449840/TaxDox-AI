'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell,
  CalendarClock,
  AlertCircle,
  Clock,
  FileText,
  Sparkles,
  MessageSquare,
  CheckCheck,
  Inbox,
  ChevronRight,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type NotificationType =
  | 'deadline'
  | 'review'
  | 'pending'
  | 'upload'
  | 'extract'
  | 'message'

type NotificationPriority = 'high' | 'medium' | 'low'

interface Notification {
  id: string
  type: NotificationType
  title: string
  description: string
  priority: NotificationPriority
  timestamp: string
  read: boolean
  engagementId: string | null
  documentId: string | null
  icon: string
}

interface NotificationsResponse {
  notifications: Notification[]
  unreadCount: number
}

type TabKey = 'all' | 'unread' | 'mentions'

// ─────────────────────────────────────────────────────────────────────────────
// Constants — icon + color config per notification type
// ─────────────────────────────────────────────────────────────────────────────

interface TypeConfig {
  icon: typeof Bell
  // Tailwind classes for the icon circle background + icon color
  circle: string
  iconClass: string
}

const TYPE_CONFIG: Record<NotificationType, TypeConfig> = {
  deadline: {
    icon: CalendarClock,
    circle: 'bg-red-100 dark:bg-red-500/15',
    iconClass: 'text-red-600 dark:text-red-400',
  },
  review: {
    icon: AlertCircle,
    circle: 'bg-amber-100 dark:bg-amber-500/15',
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
  pending: {
    icon: Clock,
    circle: 'bg-amber-100 dark:bg-amber-500/15',
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
  upload: {
    icon: FileText,
    circle: 'bg-blue-100 dark:bg-blue-500/15',
    iconClass: 'text-blue-600 dark:text-blue-400',
  },
  extract: {
    icon: Sparkles,
    circle: 'bg-teal-100 dark:bg-teal-500/15',
    iconClass: 'text-teal-600 dark:text-teal-400',
  },
  message: {
    icon: MessageSquare,
    circle: 'bg-teal-100 dark:bg-teal-500/15',
    iconClass: 'text-teal-600 dark:text-teal-400',
  },
}

const STORAGE_KEY = 'taxdox:read-notifications'

// ─────────────────────────────────────────────────────────────────────────────
// Helper — read state via localStorage
// ─────────────────────────────────────────────────────────────────────────────

function loadReadIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr as string[])
  } catch {
    return new Set()
  }
}

function saveReadIds(ids: Set<string>) {
  if (typeof window === 'undefined') return
  try {
    // Keep only the most recent 500 read IDs to avoid unbounded growth.
    const arr = Array.from(ids).slice(-500)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr))
  } catch {
    /* no-op */
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function NotificationsPanel() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<NotificationsResponse | null>(null)
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds())
  const [tab, setTab] = useState<TabKey>('all')
  const fetchedRef = useRef(false)

  const navigate = useAppStore((s) => s.navigate)
  const openEngagement = useAppStore((s) => s.openEngagement)
  const openDocument = useAppStore((s) => s.openDocument)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: NotificationsResponse = await res.json()
      setData(json)
    } catch (err) {
      console.error('Failed to load notifications:', err)
      toast.error('Could not load notifications')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch on mount so the bell dot can render.
  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    fetchNotifications()
  }, [fetchNotifications])

  // Refresh whenever the panel opens.
  useEffect(() => {
    if (open) fetchNotifications()
  }, [open, fetchNotifications])

  // Refresh read-state from storage on mount + when window refocuses.
  useEffect(() => {
    const onFocus = () => setReadIds(loadReadIds())
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  // ── Apply local read-state to API notifications ──────────────────────────
  const notifications = useMemo<Notification[]>(() => {
    if (!data) return []
    return data.notifications.map((n) => ({
      ...n,
      read: readIds.has(n.id) ? true : n.read,
    }))
  }, [data, readIds])

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  )

  // ── Tab filtering ────────────────────────────────────────────────────────
  const visibleNotifications = useMemo(() => {
    if (tab === 'unread') return notifications.filter((n) => !n.read)
    if (tab === 'mentions') return notifications.filter((n) => n.type === 'message')
    return notifications
  }, [notifications, tab])

  // ── Actions ──────────────────────────────────────────────────────────────
  const markAsRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      saveReadIds(next)
      return next
    })
  }, [])

  const markAllRead = useCallback(() => {
    if (!notifications.length) return
    setReadIds((prev) => {
      const next = new Set(prev)
      for (const n of notifications) next.add(n.id)
      saveReadIds(next)
      return next
    })
    toast.success('All notifications marked as read')
  }, [notifications])

  const handleNotificationClick = useCallback(
    (n: Notification) => {
      markAsRead(n.id)
      setOpen(false)
      // Prefer document deep-link when available, else engagement, else fallback view.
      if (n.documentId) {
        openDocument(n.documentId)
      } else if (n.engagementId) {
        openEngagement(n.engagementId)
      } else if (n.type === 'message') {
        // No engagement on the message — go to client portal.
        navigate('client-portal')
      } else {
        navigate('engagements')
      }
    },
    [markAsRead, openDocument, openEngagement, navigate]
  )

  const handleViewAll = () => {
    setOpen(false)
    navigate('engagements')
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label={`Notifications${unreadCount > 0 ? ` · ${unreadCount} unread` : ''}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white shadow-sm ring-2 ring-background">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-96 max-w-[calc(100vw-2rem)] rounded-xl border bg-popover p-0 shadow-2xl"
      >
        <div className="flex flex-col">
          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <Badge
                  variant="secondary"
                  className="h-5 rounded-full bg-red-100 px-1.5 text-[10px] font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-400"
                >
                  {unreadCount} new
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={markAllRead}
              disabled={unreadCount === 0}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          </div>

          {/* ── Tabs ────────────────────────────────────────────────────── */}
          <div className="px-3 pt-3">
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as TabKey)}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all" className="text-xs">
                  All
                </TabsTrigger>
                <TabsTrigger value="unread" className="text-xs">
                  Unread
                  {unreadCount > 0 && (
                    <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="mentions" className="text-xs">
                  Mentions
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* ── List ────────────────────────────────────────────────────── */}
          <div className="max-h-96 overflow-y-auto scrollbar-thin">
            {loading ? (
              <NotificationListSkeleton />
            ) : visibleNotifications.length === 0 ? (
              <EmptyState tab={tab} />
            ) : (
              <ul className="divide-y divide-border">
                {visibleNotifications.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onClick={() => handleNotificationClick(n)}
                  />
                ))}
              </ul>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <div className="border-t">
            <button
              onClick={handleViewAll}
              className="flex w-full items-center justify-center gap-1 px-4 py-2.5 text-xs font-medium text-primary transition-colors hover:bg-accent"
            >
              View all activity
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function NotificationItem({
  notification,
  onClick,
}: {
  notification: Notification
  onClick: () => void
}) {
  const cfg = TYPE_CONFIG[notification.type] ?? TYPE_CONFIG.upload
  const Icon = cfg.icon
  const isUnread = !notification.read

  let relativeTime: string
  try {
    relativeTime = formatDistanceToNow(new Date(notification.timestamp), {
      addSuffix: true,
    })
  } catch {
    relativeTime = ''
  }

  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          'group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60',
          isUnread && 'bg-primary/[0.03]'
        )}
      >
        {/* Icon circle */}
        <span
          className={cn(
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
            cfg.circle
          )}
        >
          <Icon className={cn('h-4 w-4', cfg.iconClass)} />
        </span>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                'text-sm leading-tight',
                isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/90'
              )}
            >
              {notification.title}
            </p>
            {isUnread && (
              <span
                aria-label="Unread"
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary ring-2 ring-background"
              />
            )}
          </div>
          <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
            {notification.description}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
            {relativeTime}
          </p>
        </div>
      </button>
    </li>
  )
}

function EmptyState({ tab }: { tab: TabKey }) {
  const message =
    tab === 'unread'
      ? 'No unread notifications'
      : tab === 'mentions'
        ? 'No client messages'
        : "You're all caught up!"

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/15">
        <Inbox className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{message}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          New activity will appear here in real time.
        </p>
      </div>
    </div>
  )
}

function NotificationListSkeleton() {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="flex items-start gap-3 px-4 py-3">
          <div className="mt-0.5 h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-full animate-pulse rounded bg-muted" />
            <div className="h-2 w-1/4 animate-pulse rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  )
}

export default NotificationsPanel
