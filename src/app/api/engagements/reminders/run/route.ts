import { NextResponse } from 'next/server'
import { runReminderSweep } from '@/lib/jobs/reminders'
import { requirePermission } from '@/lib/permissions'
import { logger } from '@/lib/logger'

/**
 * POST /api/engagements/reminders/run
 *
 * Authenticated, admin/partner-only trigger for the in-app "Run reminders"
 * button. Runs the deadline-reminder sweep for the caller's firm only.
 *
 * This replaces the old client-side pattern of calling the cron endpoint with
 * a NEXT_PUBLIC_-exposed key (which leaked a privileged trigger to every
 * browser). Here authorization comes from the user's session + role, not a
 * shared secret shipped to the client.
 */
export async function POST() {
  const authz = await requirePermission(null, 'engagement:write', 'engagement')
  if (authz instanceof NextResponse) return authz
  const { firmId } = authz

  try {
    const result = await runReminderSweep(firmId)
    logger.notification.info('Manual reminder sweep complete', {
      firmId,
      processed: result.processed,
      skipped: result.skipped,
    })
    return NextResponse.json(result)
  } catch (error) {
    logger.notification.error('Manual reminder sweep failed', {
      firmId,
      error: String(error),
    })
    return NextResponse.json({ error: 'Sweep failed' }, { status: 500 })
  }
}
