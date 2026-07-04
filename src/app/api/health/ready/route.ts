import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isCloudStorage } from '@/lib/object-store'
import { isRealEmailConfigured } from '@/lib/email'
import { isQueueEnabled } from '@/inngest/client'
import { breakerStates } from '@/lib/circuit-breaker'
import { flagSnapshot } from '@/lib/flags'
import { OPTIONAL_INTEGRATIONS } from '@/lib/env'
import { logger } from '@/lib/logger'

const IS_PROD = process.env.NODE_ENV === 'production'

type CheckStatus = 'ok' | 'degraded' | 'down'

interface Check {
  status: CheckStatus
  latencyMs?: number
  detail?: string
  required: boolean // does a 'down' here make the instance not-ready?
}

/**
 * GET /api/health/ready
 *
 * Readiness probe. Checks dependencies + circuit states. Returns 503 if any
 * REQUIRED check is down — pulling the instance from routing without forcing
 * a restart (ADR-008). Optional integrations only 'degrade' (still ready).
 *
 * In dev, optional integrations being unset is fine (degraded, not down) so
 * local work isn't blocked by missing third-party credentials.
 */
export async function GET() {
  const checks: Record<string, Check> = {}
  let allReady = true

  // ── Database (required) ──────────────────────────────────────────
  try {
    const t = Date.now()
    await db.$queryRaw`SELECT 1`
    const latency = Date.now() - t
    checks.database = {
      status: latency > 1000 ? 'degraded' : 'ok',
      latencyMs: latency,
      required: true,
    }
    if (latency > 5000) allReady = false
  } catch {
    checks.database = { status: 'down', required: true }
    allReady = false
  }

  // ── Redis (required in prod, optional in dev) ────────────────────
  if (OPTIONAL_INTEGRATIONS.redis()) {
    checks.redis = { status: 'ok', required: IS_PROD }
  } else {
    checks.redis = {
      status: IS_PROD ? 'down' : 'degraded',
      detail: 'UPSTASH_REDIS_REST_URL unset',
      required: IS_PROD,
    }
    if (IS_PROD) allReady = false
  }

  // ── Object storage (required in prod when configured) ────────────
  checks.storage = {
    status: isCloudStorage() ? 'ok' : IS_PROD ? 'degraded' : 'ok',
    detail: isCloudStorage() ? 'R2' : 'local-disk',
    required: false, // degraded, not down — reads still work from local
  }

  // ── Email transport (optional) ───────────────────────────────────
  checks.email = {
    status: isRealEmailConfigured() ? 'ok' : 'degraded',
    detail: isRealEmailConfigured() ? 'resend' : 'log-only',
    required: false,
  }

  // ── Job queue (optional) ─────────────────────────────────────────
  checks.queue = {
    status: isQueueEnabled() ? 'ok' : 'degraded',
    detail: isQueueEnabled() ? 'inngest' : 'inline',
    required: false,
  }

  // ── AI provider (required in prod when extraction is product-critical) ─
  // We treat AI as required-but-degradable: a missing key degrades readiness
  // but doesn't pull the instance (the app still serves reads). An open AI
  // breaker is already handled by the circuitBreakers check below.
  if (OPTIONAL_INTEGRATIONS.ai()) {
    checks.ai = { status: 'ok', detail: process.env.AI_PROVIDER || 'gemini', required: false }
  } else {
    checks.ai = {
      status: IS_PROD ? 'degraded' : 'degraded',
      detail: 'AI provider not configured',
      required: false,
    }
  }

  // ── Circuit breakers (any open → not ready) ──────────────────────
  const states = breakerStates()
  const openBreakers = Object.entries(states).filter(([, s]) => s === 'open')
  checks.circuitBreakers = {
    status: openBreakers.length > 0 ? 'down' : 'ok',
    detail: states as unknown as string,
    required: false,
  }
  if (openBreakers.length > 0) allReady = false

  const status = allReady ? 200 : 503
  logger.system.debug('Readiness check', { allReady, openBreakers: openBreakers.length })

  return NextResponse.json(
    {
      status: allReady ? 'ready' : 'not-ready',
      timestamp: new Date().toISOString(),
      checks,
      flags: flagSnapshot(),
    },
    { status }
  )
}
