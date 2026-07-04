/**
 * TaxDox AI — Extraction pipeline (classify → extract).
 *
 * Extracted from the /api/ai/classify and /api/ai/extract route handlers so
 * the same logic runs either:
 *   - synchronously, as the dev fallback (when Inngest isn't configured), or
 *   - inside an Inngest function (production), with retries + timeouts.
 *
 * Status is written to the Document row so clients can poll
 * /api/documents/[id]/extraction-status.
 */

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { getBreaker } from '@/lib/circuit-breaker'

export type ExtractionStage = 'queued' | 'classifying' | 'extracting' | 'processed' | 'failed'

export interface ExtractionProgress {
  stage: ExtractionStage
  documentType?: string | null
  confidence?: number
  fieldCount?: number
  model?: string
  error?: string
}

/**
 * Run the full classify → extract pipeline for a document by calling the
 * existing internal endpoints' logic. We invoke the route handlers' core via
 * the shared fetch path to avoid duplicating the AI prompt/parsing code.
 *
 * In the Inngest function this is wrapped with retries (3×, exponential
 * backoff) and a per-step timeout. Failures are recorded on the Document.
 */
export async function runExtraction(documentId: string): Promise<ExtractionProgress> {
  const aiBreaker = getBreaker(`ai-${process.env.AI_PROVIDER || 'gemini'}`, { threshold: 5, cooldownMs: 60_000 })
  const baseUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const internalKey =
    process.env.INTERNAL_API_KEY ||
    process.env.CRON_API_KEY ||
    (process.env.NODE_ENV !== 'production' ? 'dev-internal' : '')
  const internalHeaders = {
    'Content-Type': 'application/json',
    ...(internalKey ? { 'x-taxdox-internal-key': internalKey } : {}),
  }

  try {
    await setStage(documentId, 'classifying')

    // Classify. We hit the existing endpoint with a server-internal call so
    // the AI prompt + fallback heuristics live in exactly one place. The
    // breaker fails fast if the AI provider is down.
    const classifyRes = await aiBreaker.run(() =>
      fetch(`${baseUrl}/api/ai/classify`, {
        method: 'POST',
        headers: internalHeaders,
        body: JSON.stringify({ documentId }),
      })
    )

    if (!classifyRes.ok) {
      throw new Error(`Classify failed: ${classifyRes.status}`)
    }
    const classifyJson = await classifyRes.json()

    await setStage(documentId, 'extracting')

    // Extract fields based on the (now-classified) type.
    const extractRes = await aiBreaker.run(() =>
      fetch(`${baseUrl}/api/ai/extract`, {
        method: 'POST',
        headers: internalHeaders,
        body: JSON.stringify({ documentId }),
      })
    )

    if (!extractRes.ok) {
      throw new Error(`Extract failed: ${extractRes.status}`)
    }
    const extractJson = await extractRes.json()

    return {
      stage: 'processed',
      documentType: classifyJson.documentType,
      confidence: classifyJson.confidence,
      fieldCount: extractJson.count,
      model: extractJson.model,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.ai.error('Extraction pipeline failed', { documentId, error: message })
    await setStage(documentId, 'failed', message)
    return { stage: 'failed', error: message }
  }
}

async function setStage(
  documentId: string,
  stage: ExtractionStage,
  error?: string
): Promise<void> {
  // Map pipeline stage onto the existing Document.status vocabulary so the
  // UI (which reads status) reflects progress without a schema change.
  const statusMap: Record<ExtractionStage, string> = {
    queued: 'uploaded',
    classifying: 'processing',
    extracting: 'processing',
    processed: 'processed',
    failed: 'uploaded', // back to uploaded so a retry is possible
  }

  await db.document
    .update({
      where: { id: documentId },
      data: { status: statusMap[stage] },
    })
    .catch((e) => {
      logger.ai.error('Failed to set document stage', {
        documentId,
        stage,
        error: String(e),
      })
    })

  if (error) {
    logger.ai.warn('Extraction stage error', { documentId, stage, error })
  }
}
