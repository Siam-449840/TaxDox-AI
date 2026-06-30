/**
 * TaxDox AI — Inngest functions (ADR-004)
 *
 * Registered functions:
 *   - extract-document: runs the classify → extract pipeline with retries.
 *   - drain-outbox: drains pending outbox events (ADR-007).
 *
 * Served from /api/inngest (see route). When Inngest isn't configured (dev),
 * the upload route runs extraction inline via runExtraction() instead.
 */

import { serve } from 'inngest/next'
import { getInngest, EVENTS } from './client'
import { runExtraction } from '@/lib/jobs/extraction'
import { drainOutbox } from '@/lib/outbox'
import { logger } from '@/lib/logger'

const inngest = getInngest()

// ── Extraction pipeline ────────────────────────────────────────────
// Inngest v3 API: createFunction(options, handler). Options includes
// `triggers`; `id`/`name` are metadata. `retries` applies to each step.
const extractionFn = inngest.createFunction(
  {
    id: 'extract-document',
    name: 'AI Document Extraction',
    retries: 3,
    triggers: [{ event: EVENTS.extractionRequested }],
  },
  async ({ event, step }) => {
    const documentId = (event.data as { documentId: string }).documentId
    logger.ai.info('Extraction job started', { documentId })

    const result = await step.run('run-pipeline', async () => {
      return runExtraction(documentId)
    })

    logger.ai.info('Extraction job finished', {
      documentId,
      stage: result.stage,
      model: result.model,
    })
    return result
  }
)

// ── Outbox drain ───────────────────────────────────────────────────
const outboxFn = inngest.createFunction(
  {
    id: 'drain-outbox',
    name: 'Drain Outbox',
    triggers: [{ event: EVENTS.outboxDrain }],
  },
  async ({ step }) => {
    const result = await step.run('drain', async () => drainOutbox(50))
    logger.notification.info('Outbox drain complete', result)
    return result
  }
)

/**
 * Inngest serve handler. Mount at /api/inngest.
 */
export function inngestServe() {
  return serve({
    client: inngest,
    functions: [extractionFn, outboxFn],
    streaming: true,
  })
}
