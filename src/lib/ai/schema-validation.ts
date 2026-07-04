/**
 * TaxDox AI — Structured-Output Validation (AI Gateway, Phase 5)
 *
 * The model's raw text is NEVER trusted. Every response passes through here
 * before reaching the database:
 *
 *   raw text → extract JSON → repair attempt → JSON.parse → shape validation → result
 *
 * A response that fails all of these is rejected, and the caller falls back to
 * the filename-heuristic / simulated path rather than storing garbage.
 *
 * NOTE: on failure we log only metadata (length + short hash) — never a raw
 * preview, since model output may contain unmasked PII if the model misbehaves.
 */

import crypto from 'crypto'
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

  const obj = tryJsonParse(json)
  if (obj === null) return null

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

  const arr = tryJsonParse(json)
  if (arr === null) return null

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
 * One-shot repair of common model-output mistakes before JSON.parse:
 *   - strip a trailing comma before } or ] (trailing-comma in array/object)
 *   - strip single-line // comments
 *   - normalize smart quotes → straight quotes
 * If the input isn't salvageable it's returned unchanged (the parse will then
 * fail and the caller falls back). Returns the repaired string + whether a
 * repair was applied.
 */
function repairJson(s: string): { repaired: string; changed: boolean } {
  let out = s
  let changed = false
  // Trailing commas: `,]` or `,}` (with optional whitespace/newline between).
  const trail = out.replace(/,\s*([\]}])/g, '$1')
  if (trail !== out) { out = trail; changed = true }
  // Strip single-line // comments (models sometimes annotate JSON).
  const noComments = out.replace(/\/\/[^\n\r]*/g, '')
  if (noComments !== out) { out = noComments; changed = true }
  // Smart quotes → straight.
  const norm = out.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
  if (norm !== out) { out = norm; changed = true }
  return { repaired: out.trim(), changed }
}

/**
 * Extract + repair + parse a candidate JSON object. Returns the parsed value
 * or null. Used internally by the two public parsers.
 */
function tryJsonParse(raw: string): unknown | null {
  try {
    return JSON.parse(raw)
  } catch {
    const { repaired, changed } = repairJson(raw)
    if (!changed) return null
    try {
      return JSON.parse(repaired)
    } catch {
      return null
    }
  }
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
 *
 * Logs ONLY metadata — never a raw preview. Model output may contain unmasked
 * PII if the model misbehaves, and the logger doesn't redact.
 */
export function logParseFailure(stage: string, raw: string): void {
  // Short stable hash of the raw text for correlation without leaking content.
  const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12)
  logger.ai.warn('AI output failed schema validation', {
    stage,
    rawLength: raw.length,
    hash,
  })
}
