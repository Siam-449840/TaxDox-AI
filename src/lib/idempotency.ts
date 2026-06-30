/**
 * TaxDox AI — Idempotency-Key support (Phase 5.2)
 *
 * Lets clients safely retry POST requests (upload, checkout, email send, job
 * enqueue) without creating duplicates. The client sends an `Idempotency-Key`
 * header; we store the key→result mapping in Upstash Redis (prod) or an
 * in-memory map (dev).
 *
 * Usage in a route:
 *   const idem = await getIdempotentResult(req)   // replay if present
 *   if (idem.hit) return NextResponse.json(idem.body, { status: idem.status })
 *   ... do the work ...
 *   await storeIdempotentResult(req, body, status) // cache for replay
 */

import { logger } from '@/lib/logger'

const TTL_SECONDS = 24 * 60 * 60 // 24h

interface StoredResult {
  body: unknown
  status: number
}

// ─── Upstash REST ──────────────────────────────────────────────────

function upstashUrl(): string | null {
  return process.env.UPSTASH_REDIS_REST_URL ?? null
}
function upstashToken(): string | null {
  return process.env.UPSTASH_REDIS_REST_TOKEN ?? null
}

async function upstashGet(key: string): Promise<string | null> {
  const url = upstashUrl()
  const token = upstashToken()
  if (!url || !token) return null
  const res = await fetch(`${url}/GET/${key}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const data = (await res.json()) as { result: string | null }
  return data.result
}

async function upstashSet(key: string, value: string, ttl: number): Promise<void> {
  const url = upstashUrl()
  const token = upstashToken()
  if (!url || !token) return
  await fetch(`${url}/SET/${key}/${encodeURIComponent(value)}?EX=${ttl}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {})
}

// ─── In-memory fallback (dev) ──────────────────────────────────────

const memory = new Map<string, { result: StoredResult; expiresAt: number }>()

// ─── Public API ────────────────────────────────────────────────────

const HEADER = 'idempotency-key'

function readKey(req: { headers: Headers } | null): string | null {
  if (!req) return null
  const raw = req.headers.get(HEADER)
  if (!raw) return null
  // Sanitize: alphanumeric + dash, max 128 chars.
  const cleaned = raw.replace(/[^A-Za-z0-9-]/g, '').slice(0, 128)
  return cleaned || null
}

function redisKey(idemKey: string): string {
  return `idem:${idemKey}`
}

export interface IdempotentCheck {
  hit: boolean
  body?: unknown
  status?: number
}

/**
 * If the request carries an Idempotency-Key we've seen, replay the stored
 * result. Otherwise returns { hit: false }.
 */
export async function getIdempotentResult(
  req: { headers: Headers } | null
): Promise<IdempotentCheck> {
  const key = readKey(req)
  if (!key) return { hit: false }

  // Redis path.
  if (upstashUrl() && upstashToken()) {
    try {
      const raw = await upstashGet(redisKey(key))
      if (raw) {
        const stored = JSON.parse(raw) as StoredResult
        logger.api.info('Idempotent replay (redis)', { key })
        return { hit: true, body: stored.body, status: stored.status }
      }
    } catch {
      /* fall through */
    }
    return { hit: false }
  }

  // Memory path (dev).
  const entry = memory.get(redisKey(key))
  if (entry && entry.expiresAt > Date.now()) {
    logger.api.info('Idempotent replay (memory)', { key })
    return { hit: true, body: entry.result.body, status: entry.result.status }
  }
  return { hit: false }
}

/**
 * Store a result under the request's Idempotency-Key so a future retry
 * replays it instead of re-executing. No-op if no key present.
 */
export async function storeIdempotentResult(
  req: { headers: Headers } | null,
  body: unknown,
  status: number
): Promise<void> {
  const key = readKey(req)
  if (!key) return
  const stored: StoredResult = { body, status }

  if (upstashUrl() && upstashToken()) {
    await upstashSet(redisKey(key), JSON.stringify(stored), TTL_SECONDS)
    return
  }

  memory.set(redisKey(key), { result: stored, expiresAt: Date.now() + TTL_SECONDS * 1000 })
}
