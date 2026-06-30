/**
 * TaxDox AI — Login Rate Limiter
 *
 * Sliding-window rate limiter for authentication endpoints. Uses Upstash Redis
 * REST in production (Edge-compatible, no persistent Redis connection), and
 * an in-memory fallback for development.
 *
 * Policy: 5 failed login attempts per email+IP in a 15-minute window → lockout.
 * In production, if Redis is unreachable we **fail closed** (reject the attempt)
 * rather than letting the lockout silently degrade.
 */

import { logger } from '@/lib/logger'

// ─── Config ─────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 5
const WINDOW_SECONDS = 15 * 60 // 15 minutes

// ─── Upstash REST client (lazy) ────────────────────────────────────

function upstashUrl(): string | null {
  return process.env.UPSTASH_REDIS_REST_URL ?? null
}
function upstashToken(): string | null {
  return process.env.UPSTASH_REDIS_REST_TOKEN ?? null
}

async function upstashIncr(key: string, windowSec: number): Promise<{ count: number; ttl: number }> {
  const url = upstashUrl()
  const token = upstashToken()
  if (!url || !token) return { count: 0, ttl: 0 }

  const res = await fetch(`${url}/INCR/${key}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Upstash INCR failed: ${res.status}`)

  const data = (await res.json()) as { result: number }
  const count = data.result

  // Set TTL on first increment so the window auto-expires.
  if (count === 1) {
    await fetch(`${url}/EXPIRE/${key}/${windowSec}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  }

  // Get remaining TTL for the response.
  const ttlRes = await fetch(`${url}/TTL/${key}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const ttlData = (await ttlRes.json()) as { result: number }
  return { count, ttl: ttlData.result }
}

async function upstashGet(key: string): Promise<number> {
  const url = upstashUrl()
  const token = upstashToken()
  if (!url || !token) return 0

  const res = await fetch(`${url}/GET/${key}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return 0
  const data = (await res.json()) as { result: string | null }
  return data.result ? parseInt(data.result, 10) : 0
}

// ─── In-memory fallback (dev only) ─────────────────────────────────

const memoryStore = new Map<string, { count: number; expiresAt: number }>()

function memoryIncr(key: string, windowSec: number): { count: number; ttl: number } {
  const now = Date.now()
  const entry = memoryStore.get(key)

  // Expire stale entries.
  if (entry && entry.expiresAt < now) {
    memoryStore.delete(key)
  }

  const current = memoryStore.get(key)
  const count = (current?.count ?? 0) + 1
  const expiresAt = now + windowSec * 1000
  memoryStore.set(key, { count, expiresAt })
  return { count, ttl: windowSec }
}

function memoryGet(key: string): number {
  const entry = memoryStore.get(key)
  if (!entry || entry.expiresAt < Date.now()) return 0
  return entry.count
}

// ─── Public API ────────────────────────────────────────────────────

export interface RateLimitResult {
  /** True if the request should be rejected. */
  blocked: boolean
  /** How many attempts have been made in this window. */
  count: number
  /** Seconds remaining before the window resets. */
  retryAfterSec: number
}

/**
 * Check and increment the rate limit for a given identifier (email+IP combo).
 * Returns `{ blocked: false }` if under the threshold, or `{ blocked: true,
 * retryAfterSec }` if the limit has been exceeded.
 */
export async function checkRateLimit(
  identifier: string
): Promise<RateLimitResult> {
  const isDev = process.env.NODE_ENV !== 'production'
  const hasRedis = !!(upstashUrl() && upstashToken())

  try {
    if (hasRedis) {
      // Redis path.
      const { count, ttl } = await upstashIncr(identifier, WINDOW_SECONDS)
      if (count > MAX_ATTEMPTS) {
        logger.security.warn('Rate limit exceeded', { identifier, count, ttl })
        return { blocked: true, count, retryAfterSec: ttl }
      }
      return { blocked: false, count, retryAfterSec: ttl }
    }

    if (isDev) {
      // In-memory fallback for local dev.
      const { count, ttl } = memoryIncr(identifier, WINDOW_SECONDS)
      if (count > MAX_ATTEMPTS) {
        return { blocked: true, count, retryAfterSec: ttl }
      }
      return { blocked: false, count, retryAfterSec: ttl }
    }

    // Production without Redis: FAIL CLOSED.
    // This is intentional — a missing Redis config is a misconfigured deploy
    // and we err on the side of rejecting login attempts rather than letting
    // brute-force through.
    logger.security.error('Rate limit unavailable (no Redis in prod) — failing closed')
    return { blocked: true, count: 0, retryAfterSec: WINDOW_SECONDS }
  } catch (error) {
    logger.security.error('Rate limit check failed', { error: String(error) })
    // On any Redis error in prod, fail closed. In dev, allow (in-memory may
    // have thrown but it's not a security concern locally).
    if (!isDev) {
      return { blocked: true, count: 0, retryAfterSec: WINDOW_SECONDS }
    }
    return { blocked: false, count: 0, retryAfterSec: 0 }
  }
}

/**
 * Reset the rate limit for an identifier (on successful login).
 */
export async function resetRateLimit(identifier: string): Promise<void> {
  if (upstashUrl() && upstashToken()) {
    try {
      await fetch(`${upstashUrl()}/DEL/${identifier}`, {
        headers: { Authorization: `Bearer ${upstashToken()}` },
      })
    } catch {
      // Best-effort.
    }
  }
  memoryStore.delete(identifier)
}
