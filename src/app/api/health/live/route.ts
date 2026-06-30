import { NextResponse } from 'next/server'

/**
 * GET /api/health/live
 *
 * Liveness probe. Returns 200 if the process can respond at all. Drives
 * restart decisions — never check dependencies here (that's /ready), so a
 * slow DB doesn't cause a restart loop.
 */
export async function GET() {
  return NextResponse.json({ status: 'alive', timestamp: new Date().toISOString() })
}
