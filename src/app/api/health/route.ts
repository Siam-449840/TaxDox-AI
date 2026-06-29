import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Health Check Endpoint
 *
 * Used by hosting infrastructure to detect and restart dead processes.
 * This directly addresses the "sandbox is inactive" failure mode —
 * the infra can poll this endpoint and auto-restart if it fails.
 *
 * Returns 200 if the app is healthy, 503 if not.
 * Does NOT require authentication (must be publicly accessible for health checks).
 */

export async function GET() {
  const checks: Record<string, { status: string; latency?: number }> = {}
  let allHealthy = true

  // Check 1: Database connectivity
  try {
    const start = Date.now()
    await db.$queryRaw`SELECT 1`
    const latency = Date.now() - start
    checks.database = { status: 'ok', latency }
    if (latency > 1000) {
      checks.database.status = 'slow'
      allHealthy = false
    }
  } catch {
    checks.database = { status: 'error' }
    allHealthy = false
  }

  // Check 2: App process is alive (if we're responding, we're alive)
  checks.process = { status: 'ok' }

  // Check 3: Environment variables
  const requiredEnvVars = ['DATABASE_URL', 'NEXTAUTH_SECRET']
  const missingVars = requiredEnvVars.filter((v) => !process.env[v])
  checks.env = {
    status: missingVars.length === 0 ? 'ok' : 'error',
  }
  if (missingVars.length > 0) {
    allHealthy = false
  }

  const status = allHealthy ? 200 : 503
  return NextResponse.json(
    {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status }
  )
}
