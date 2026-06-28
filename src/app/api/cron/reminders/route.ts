import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { deadlineReminderEmail } from '@/lib/email-templates'
import { differenceInCalendarDays, format } from 'date-fns'

// ─────────────────────────────────────────────────────────────────
// Cron-style deadline reminder scheduler.
//
// Triggered by an external scheduler (or manually) with a simple API
// key check via the `?key=` query param. The default key is taken
// from `CRON_API_KEY` (env), falling back to `taxdox-cron-key` for
// local development.
//
// For every engagement whose deadline is within the next 14 days,
// where the status is NOT 'done' or 'created', and where no
// `deadline_reminder` email has been logged in the past 3 days, this
// endpoint:
//   • Computes the number of days until the deadline
//   • Builds the email body using `deadlineReminderEmail`
//   • Persists an EmailLog with status 'sent' addressed to the
//     engagement's client
//
// Returns: { processed: N, skipped: N, reminders: [...] }
// ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  const expectedKey = process.env.CRON_API_KEY || 'taxdox-cron-key'

  if (key !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const fourteenDaysFromNow = new Date(
    now.getTime() + 14 * 24 * 60 * 60 * 1000
  )
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

  // Find engagements with upcoming deadlines (status NOT done/created)
  const engagements = await db.engagement.findMany({
    where: {
      status: { notIn: ['done', 'created'] },
      deadline: { gte: now, lte: fourteenDaysFromNow },
    },
    include: { client: true },
  })

  const reminders: Array<{
    engagementId: string
    client: string
    email: string
    engagementType: string
    taxYear: number
    daysLeft: number
    deadline: string
  }> = []
  let skipped = 0

  for (const engagement of engagements) {
    // Skip engagements with no client email — we can't reach them
    if (!engagement.client?.email) {
      skipped++
      continue
    }

    // Check if a reminder was already sent in the last 3 days
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

  return NextResponse.json({
    processed: reminders.length,
    skipped,
    reminders,
    ranAt: now.toISOString(),
  })
}
