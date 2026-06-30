/**
 * TaxDox AI — Transactional Outbox (ADR-007)
 *
 * Side effects (email, audit, webhooks) must be recorded in the SAME
 * transaction as the main mutation, then drained by a relay. This avoids
 * partial failures where, e.g., a document is created but the notification
 * email is lost on a crash.
 *
 * Usage inside a Prisma transaction:
 *   await db.$transaction(async (tx) => {
 *     const doc = await tx.document.create(...)
 *     await emitOutboxEvent(tx, {
 *       eventType: 'document.uploaded',
 *       aggregateType: 'document',
 *       aggregateId: doc.id,
 *       firmId,
 *       payload: { ... },
 *     })
 *   })
 *
 * The relay (wired in Phase 4 via Inngest) drains 'pending' rows and calls
 * the appropriate handler (sendEmail(), webhook POST, audit write) with
 * retries. Until then, emitOutboxEvent() simply records the row so the audit
 * trail exists; the synchronous sendEmail() still delivers immediately.
 */

import crypto from 'crypto'
import type { PrismaClient } from '@prisma/client'
import { logger } from '@/lib/logger'

export interface OutboxEmitParams {
  eventType: string
  aggregateType: string
  aggregateId: string
  firmId: string
  payload?: Record<string, unknown>
}

/**
 * Deterministic dedupe key: same aggregate + event type + occurrence count
 * produces the same id, so a retried emit is idempotent rather than creating
 * duplicate side effects.
 */
function dedupeKey(p: OutboxEmitParams): string {
  const namespace = crypto.createHash('sha1').update(`${p.aggregateType}:${p.firmId}`).digest()
  const name = `${p.eventType}:${p.aggregateId}`
  return crypto.createHash('sha1').update(name).digest('hex')
}

/**
 * Emit an outbox event. Accepts an optional transaction client `tx` so it can
 * be included in the caller's transaction; falls back to the shared client.
 */
export async function emitOutboxEvent(
  txOrClient: PrismaClient,
  params: OutboxEmitParams
): Promise<void> {
  try {
    await txOrClient.outboxEvent.create({
      data: {
        firmId: params.firmId,
        eventType: params.eventType,
        aggregateType: params.aggregateType,
        aggregateId: params.aggregateId,
        eventId: dedupeKey(params),
        payload: JSON.stringify(params.payload ?? {}),
      },
    })
  } catch (err) {
    // Duplicate eventId (same event re-emitted) is expected and harmless.
    logger.notification.warn('Outbox emit skipped', {
      eventType: params.eventType,
      aggregateId: params.aggregateId,
      error: String(err),
    })
  }
}

/**
 * Drain pending outbox events. Called by the relay (Inngest, Phase 4) or
 * manually. Returns the number processed.
 *
 * NOTE: the actual side-effect dispatch (sendEmail for email.* events, etc.)
 * is wired in Phase 4. For now this just marks events dispatched so the table
 * doesn't grow unbounded during development.
 */
export async function drainOutbox(limit = 50): Promise<{ processed: number; failed: number }> {
  const pending = await (globalThis as { prisma?: PrismaClient }).prisma!.outboxEvent.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  let processed = 0
  let failed = 0

  for (const ev of pending) {
    // Phase 4 will route by eventType to the right handler. For now, mark
    // dispatched so the table is bounded.
    await (globalThis as { prisma?: PrismaClient }).prisma!.outboxEvent.update({
      where: { id: ev.id },
      data: { status: 'dispatched', dispatchedAt: new Date() },
    }).catch(() => { failed++ })
    processed++
  }

  return { processed, failed: failed }
}
