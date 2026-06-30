import { NextRequest, NextResponse } from 'next/server'
import { runReminderSweep } from '@/lib/jobs/reminders'
import { logger } from '@/lib/logger'

// ─────────────────────────────────────────────────────────────────
// Cron-style deadline reminder scheduler.
//
// Triggered by an external scheduler (or manually) with an API-key check via
// the `?key=` query param. There is NO default key — `CRON_API_KEY` must be
// set; if unset the endpoint returns 503 (refusing to run on a guessable
// value). The sweep runs across ALL firms.
//
// For an authenticated, single-firm trigger (the in-app "Run reminders"
// button) see POST /api/engagements/reminders/run instead.
//
// Returns: { processed: N, skipped: N, reminders: [...] }
// ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  // No insecure default: if CRON_API_KEY is unset, return 503 rather than
  // accepting a publicly-known value.
  const expectedKey = process.env.CRON_API_KEY
  if (!expectedKey) {
    return NextResponse.json(
      { error: 'Cron not configured (CRON_API_KEY unset)' },
      { status: 503 }
    )
  }

  if (!key || key !== expectedKey) {
    logger.security.warn('Cron reminders invoked with invalid key')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runReminderSweep()
    logger.notification.info('Reminder sweep complete', {
      processed: result.processed,
      skipped: result.skipped,
    })
    return NextResponse.json(result)
  } catch (error) {
    logger.notification.error('Reminder sweep failed', { error: String(error) })
    return NextResponse.json({ error: 'Sweep failed' }, { status: 500 })
  }
}
