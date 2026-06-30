/**
 * TaxDox AI — Deadline reminder sweep (core logic).
 *
 * Extracted from /api/cron/reminders so both the cron endpoint (key-gated,
 * for external schedulers) and an authenticated admin endpoint (for the
 * in-app "Run reminders" button) share one implementation. This also lets
 * Phase 3 route these sends through the real email transport + outbox.
 */

import { db } from '@/lib/db'
import { deadlineReminderEmail } from '@/lib/email-templates'
import { differenceInCalendarDays, format } from 'date-fns'

export interface ReminderResult {
  engagementId: string
  client: string
  email: string
  engagementType: string
  taxYear: number
  daysLeft: number
  deadline: string
}

export interface ReminderSweepOutput {
  processed: number
  skipped: number
  reminders: ReminderResult[]
  ranAt: string
}

/**
 * Run the deadline-reminder sweep across all firms (cron) or a single firm
 * (admin button). Sends are idempotent: an engagement is skipped if a
 * reminder was already logged in the last 3 days.
 *
 * @param firmId  When provided, restrict the sweep to one firm.
 */
export async function runReminderSweep(
  firmId?: string
): Promise<ReminderSweepOutput> {
  const now = new Date()
  const fourteenDaysFromNow = new Date(
    now.getTime() + 14 * 24 * 60 * 60 * 1000
  )
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

  const engagements = await db.engagement.findMany({
    where: {
      ...(firmId ? { firmId } : {}),
      status: { notIn: ['done', 'created'] },
      deadline: { gte: now, lte: fourteenDaysFromNow },
    },
    include: { client: true },
  })

  const reminders: ReminderResult[] = []
  let skipped = 0

  for (const engagement of engagements) {
    if (!engagement.client?.email) {
      skipped++
      continue
    }

    const recentReminder = await db.emailLog.findFirst({
      where: {
        engagementId: engagement.id,
        template: 'deadline_reminder',
        sentAt: { gte: threeDaysAgo },
      },
      select: { id: true },
    })

    if (recentReminder) {
      skipped++
      continue
    }

    const daysLeft = differenceInCalendarDays(engagement.deadline!, now)
    const emailTpl = deadlineReminderEmail(
      engagement.client.name,
      engagement.engagementType,
      engagement.taxYear,
      daysLeft,
      format(engagement.deadline!, 'MMMM d, yyyy')
    )

    await db.emailLog.create({
      data: {
        firmId: engagement.firmId,
        engagementId: engagement.id,
        clientId: engagement.clientId,
        toEmail: engagement.client.email,
        toName: engagement.client.name,
        fromName: 'Meridian CPA Group',
        subject: emailTpl.subject,
        body: emailTpl.body,
        template: emailTpl.template,
        status: 'sent',
        sentAt: now,
      },
    })

    reminders.push({
      engagementId: engagement.id,
      client: engagement.client.name,
      email: engagement.client.email,
      engagementType: engagement.engagementType,
      taxYear: engagement.taxYear,
      daysLeft,
      deadline: format(engagement.deadline!, 'MMMM d, yyyy'),
    })
  }

  return {
    processed: reminders.length,
    skipped,
    reminders,
    ranAt: now.toISOString(),
  }
}
