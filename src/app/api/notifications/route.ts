import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ─────────────────────────────────────────────────────────────────────────────
// Notifications API — generates a unified notification feed from live DB state.
//
// Notification sources:
//   1. deadline  — engagements with deadlines within 7 days (or overdue), not done
//   2. review    — documents with status='processed' and confidence < 0.9
//   3. pending   — PBC items still 'pending' for more than 3 days
//   4. upload    — activities of type 'upload' in the last 24 hours
//   5. extract   — activities of type 'extract' in the last 24 hours
//   6. message   — unread client messages (read=false, fromType='client')
//
// Notifications are ephemeral — they are generated fresh on every request and
// are not persisted. Read/dismissed state is tracked client-side (localStorage)
// using the deterministic IDs emitted below.
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'deadline'
  | 'review'
  | 'pending'
  | 'upload'
  | 'extract'
  | 'message'

export type NotificationPriority = 'high' | 'medium' | 'low'

export interface Notification {
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

const MS_PER_DAY = 24 * 60 * 60 * 1000
const PRIORITY_RANK: Record<NotificationPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY)
}

export async function GET() {
  const now = new Date()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * MS_PER_DAY)
  const threeDaysAgo = new Date(now.getTime() - 3 * MS_PER_DAY)
  const oneDayAgo = new Date(now.getTime() - MS_PER_DAY)

  // Run all source queries in parallel.
  const [
    deadlineEngagements,
    reviewDocuments,
    pendingPbcItems,
    recentUploads,
    recentExtracts,
    unreadMessages,
  ] = await Promise.all([
    // 1. Deadlines within 7 days (or overdue) for non-done engagements.
    db.engagement.findMany({
      where: {
        status: { not: 'done' },
        deadline: { lte: sevenDaysFromNow, not: null },
      },
      include: { client: true },
      orderBy: { deadline: 'asc' },
      take: 25,
    }),
    // 2. Documents processed but low-confidence (not yet reviewed).
    db.document.findMany({
      where: {
        status: 'processed',
        confidence: { lt: 0.9 },
      },
      include: {
        client: { select: { name: true } },
        engagement: {
          select: {
            id: true,
            engagementType: true,
            client: { select: { name: true } },
          },
        },
      },
      orderBy: { processedAt: 'desc' },
      take: 25,
    }),
    // 3. PBC items still pending for more than 3 days.
    db.pbcItem.findMany({
      where: {
        status: 'pending',
        createdAt: { lt: threeDaysAgo },
      },
      include: {
        pbcList: {
          include: {
            engagement: {
              include: { client: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 25,
    }),
    // 4. Recent upload activities (last 24h).
    db.activity.findMany({
      where: {
        type: 'upload',
        createdAt: { gte: oneDayAgo },
      },
      include: {
        document: { select: { id: true, originalFilename: true } },
        engagement: { include: { client: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
    // 5. Recent extract activities (last 24h).
    db.activity.findMany({
      where: {
        type: 'extract',
        createdAt: { gte: oneDayAgo },
      },
      include: {
        document: { select: { id: true, originalFilename: true } },
        engagement: { include: { client: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
    // 6. Unread messages from clients.
    db.message.findMany({
      where: {
        read: false,
        fromType: 'client',
      },
      include: {
        client: { select: { name: true } },
        engagement: { include: { client: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
  ])

  const notifications: Notification[] = []

  // ── 1. Deadlines ────────────────────────────────────────────────────────
  for (const e of deadlineEngagements) {
    if (!e.deadline) continue
    const daysLeft = daysBetween(now, e.deadline)
    const isOverdue = daysLeft < 0
    const clientName = e.client?.name ?? 'Unknown client'
    notifications.push({
      id: `deadline-${e.id}`,
      type: 'deadline',
      title: isOverdue
        ? `${e.engagementType} overdue`
        : `${e.engagementType} deadline ${daysLeft === 0 ? 'today' : `in ${daysLeft}d`}`,
      description: `${clientName} · Tax year ${e.taxYear}${
        isOverdue ? ` · ${Math.abs(daysLeft)}d overdue` : ''
      }`,
      priority: 'high',
      timestamp: e.deadline.toISOString(),
      read: false,
      engagementId: e.id,
      documentId: null,
      icon: 'CalendarClock',
    })
  }

  // ── 2. Documents needing review ─────────────────────────────────────────
  for (const d of reviewDocuments) {
    const clientName =
      d.engagement?.client?.name ?? d.client?.name ?? 'Unknown client'
    const confidencePct = Math.round(d.confidence * 100)
    notifications.push({
      id: `review-${d.id}`,
      type: 'review',
      title: `${d.documentType ?? 'Document'} needs review`,
      description: `${d.originalFilename} · ${clientName} · ${confidencePct}% confidence`,
      priority: 'medium',
      timestamp: (d.processedAt ?? d.uploadedAt).toISOString(),
      read: false,
      engagementId: d.engagementId ?? null,
      documentId: d.id,
      icon: 'AlertCircle',
    })
  }

  // ── 3. PBC items pending ────────────────────────────────────────────────
  for (const item of pendingPbcItems) {
    const engagement = item.pbcList?.engagement
    const clientName = engagement?.client?.name ?? 'Unknown client'
    const daysPending = Math.max(1, daysBetween(item.createdAt, now))
    notifications.push({
      id: `pending-${item.id}`,
      type: 'pending',
      title: `PBC item pending: ${item.documentType}`,
      description: `${clientName}${
        engagement ? ` · ${engagement.engagementType}` : ''
      } · pending ${daysPending}d${item.required ? ' · required' : ''}`,
      priority: 'medium',
      timestamp: item.createdAt.toISOString(),
      read: false,
      engagementId: engagement?.id ?? null,
      documentId: null,
      icon: 'Clock',
    })
  }

  // ── 4. Recent uploads ───────────────────────────────────────────────────
  for (const a of recentUploads) {
    const clientName = a.engagement?.client?.name ?? 'Unknown client'
    const filename = a.document?.originalFilename ?? 'a document'
    notifications.push({
      id: `upload-${a.id}`,
      type: 'upload',
      title: 'New document uploaded',
      description: `${a.actor} uploaded ${filename} · ${clientName}`,
      priority: 'low',
      timestamp: a.createdAt.toISOString(),
      read: false,
      engagementId: a.engagementId ?? null,
      documentId: a.documentId ?? null,
      icon: 'FileText',
    })
  }

  // ── 5. AI extraction complete ───────────────────────────────────────────
  for (const a of recentExtracts) {
    const clientName = a.engagement?.client?.name ?? 'Unknown client'
    const filename = a.document?.originalFilename ?? 'a document'
    notifications.push({
      id: `extract-${a.id}`,
      type: 'extract',
      title: 'AI extraction complete',
      description: `${filename} · ${clientName} · ready for review`,
      priority: 'low',
      timestamp: a.createdAt.toISOString(),
      read: false,
      engagementId: a.engagementId ?? null,
      documentId: a.documentId ?? null,
      icon: 'Sparkles',
    })
  }

  // ── 6. Unread client messages ───────────────────────────────────────────
  for (const m of unreadMessages) {
    const clientName =
      m.client?.name ?? m.engagement?.client?.name ?? 'A client'
    const preview =
      m.content.length > 80 ? m.content.slice(0, 80) + '…' : m.content
    notifications.push({
      id: `message-${m.id}`,
      type: 'message',
      title: `Message from ${clientName}`,
      description: preview,
      priority: 'high',
      timestamp: m.createdAt.toISOString(),
      read: false,
      engagementId: m.engagementId ?? null,
      documentId: null,
      icon: 'MessageSquare',
    })
  }

  // Sort by priority (high → low) then by timestamp (newest → oldest).
  notifications.sort((a, b) => {
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    if (p !== 0) return p
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })

  return NextResponse.json({
    notifications,
    unreadCount: notifications.length,
  })
}
