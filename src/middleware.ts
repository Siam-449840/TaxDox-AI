import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Public API routes that don't require authentication
const PUBLIC_API_ROUTES = [
  '/api/auth',
  '/api/stripe/webhook',
  '/api/health',
  '/api/inngest',
  // Cron endpoints authenticate via their own API key (?key=...),
  // not user sessions, so they must bypass NextAuth.
  '/api/cron',
]

/**
 * Resolve the set of allowed origins for CSRF protection. In production this
 * is the canonical APP_URL (and NEXTAUTH_URL). In dev we also allow
 * localhost:3000. Webhook/cron endpoints that are legitimately called from
 * other origins are exempted from the origin check below.
 */
function getAllowedOrigins(): string[] {
  const origins = new Set<string>()
  const app = process.env.APP_URL || process.env.NEXTAUTH_URL
  if (app) {
    try {
      origins.add(new URL(app).origin)
    } catch {
      /* ignore malformed */
    }
  }
  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:3000')
    origins.add('http://127.0.0.1:3000')
  }
  return [...origins]
}

/**
 * Origin-based CSRF defense for state-changing requests. NextAuth only
 * protects its own routes; this extends the same-origin check to every POST /
 * PUT / PATCH / DELETE across /api/*.
 *
 * We compare the Origin (or Referer fallback) against the allowed origins.
 * A missing or mismatched origin on a mutating request is rejected with 403.
 */
function csrfOk(req: NextRequest): boolean {
  const method = req.method.toUpperCase()
  // GET/HEAD/OPTIONS are safe; no CSRF check.
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true
  }

  const origin = req.headers.get('origin') || req.headers.get('referer')
  if (!origin) {
    // No origin header at all on a mutating request — reject. Legit browsers
    // always send Origin on CORS-relevant methods.
    return false
  }

  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    return false
  }

  const allowed = getAllowedOrigins()
  // If no allowed origins are configured (e.g. fully unconfigured dev), fail
  // closed in prod and open in dev.
  if (allowed.length === 0) {
    return process.env.NODE_ENV !== 'production'
  }
  return allowed.includes(parsed.origin)
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Only protect /api routes (pages handle their own auth via client redirect)
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Public API routes (auth callbacks, webhooks, health, cron) bypass auth.
  // Webhooks legitimately arrive with no session, so they're exempt from both
  // auth and CSRF (Stripe signs its payloads; cron uses an API key).
  const isPublic = PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route))

  if (!isPublic) {
    // CSRF check first — cheap reject before any token work.
    if (!csrfOk(req)) {
      return NextResponse.json(
        { error: 'Cross-origin request blocked' },
        { status: 403 }
      )
    }

    // Check for valid NextAuth token
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in.' },
        { status: 401 }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
