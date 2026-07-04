/**
 * TaxDox AI — Structured-Output Validation (AI Gateway, Phase 5)
 *
 * The model's raw text is NEVER trusted. Every response passes through here
 * before reaching the database:
 *
 *   raw text → JSON parse → (one repair attempt) → shape validation → result
 *
 * A response that fails all of these is rejected, and the caller falls back to
 * the filename-heuristic / simulated path rather than storing garbage.
 */

import { logger } from '@/lib/logger'

// ─── Classification validation ───────────────────────────────────

export interface ParsedClassification {
  documentType: string | null
  confidence: number
}

/**
 * Parse + validate a classification response.
 * Returns null if the output cannot be trusted.
 */
export function parseClassification(raw: string): ParsedClassification | null {
  const json = extractJsonObject(raw)
  if (!json) return null

  let obj: unknown
  try {
    obj = JSON.parse(json)
  } catch {
    return null
  }

  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null
  const o = obj as Record<string, unknown>

  const documentType = o.documentType
  const confidence = o.confidence

  // documentType must be a string or explicitly null
  if (typeof documentType !== 'string' && documentType !== null && documentType !== undefined) {
    return null
  }

  const conf = typeof confidence === 'number' ? clamp(confidence) : 0.5

  return {
    documentType: typeof documentType === 'string' ? documentType : null,
    confidence: conf,
  }
}

// ─── Extraction validation ───────────────────────────────────────

export interface ParsedField {
  name: string
  value: string
  confidence: number
}

/**
 * Parse + validate an extraction array response.
 * Filters to only the expected field names; drops malformed entries.
 * Returns null if nothing usable could be parsed.
 */
export function parseExtraction(
  raw: string,
  expectedFieldNames: Set<string>
): ParsedField[] | null {
  const json = extractJsonArray(raw)
  if (!json) return null

  let arr: unknown
  try {
    arr = JSON.parse(json)
  } catch {
    return null
  }

  if (!Array.isArray(arr)) return null

  const out: ParsedField[] = []
  for (const entry of arr) {
    if (typeof entry !== 'object' || entry === null) continue
    const e = entry as Record<string, unknown>
    const name = e.name
    const value = e.value
    if (typeof name !== 'string' || typeof value !== 'string') continue
    if (!expectedFieldNames.has(name)) continue // drop unknown fields
    const confidence = typeof e.confidence === 'number' ? clamp(e.confidence) : 0.9
    out.push({ name, value, confidence })
  }

  return out.length > 0 ? out : null
}

// ─── Helpers ─────────────────────────────────────────────────────

function clamp(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(1, n))
}

/**
 * Pull the first {...} JSON object out of a possibly-noisy model response.
 * Handles markdown fences and surrounding prose.
 */
function extractJsonObject(raw: string): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  // Fast path: already clean JSON.
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed
  // Fenced path.
  const fenced = trimmed.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i)
  if (fenced) return fenced[1]
  // Embedded object.
  const match = trimmed.match(/\{[\s\S]*\}/)
  return match ? match[0] : null
}

/**
 * Pull the first [...] JSON array out of a possibly-noisy response.
 */
function extractJsonArray(raw: string): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) return trimmed
  const fenced = trimmed.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/i)
  if (fenced) return fenced[1]
  const match = trimmed.match(/\[[\s\S]*\]/)
  return match ? match[0] : null
}

/**
 * Log a parse failure for observability (caller decides whether to fall back).
 */
export function logParseFailure(stage: string, raw: string): void {
  logger.ai.warn('AI output failed schema validation', {
    stage,
    rawLength: raw.length,
    rawPreview: raw.slice(0, 200),
  })
}
