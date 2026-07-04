/**
 * TaxDox AI — Evaluation Framework (Addition #2, foundation)
 *
 * Provider-agnostic accuracy metrics. Used by `scripts/run-eval.ts` to score
 * extraction quality against a golden dataset (see `eval/golden/`).
 *
 * Pure functions — no DB, no network. This makes them unit-testable and lets
 * the eval runner score any provider's output identically.
 */

import type { ClassifyResult, ExtractionResult } from './types'

// ─── Golden dataset types ────────────────────────────────────────

export interface GoldenFixture {
  id: string
  /** Path under eval/golden/fixtures/. */
  file: string
  /** Expected document type (or null if the fixture is intentionally unknown). */
  documentType: string | null
  /** Expected field values. `tolerance` allows numeric/currency wiggle. */
  expectedFields: { name: string; value: string; tolerance?: number }[]
  /** Field names that MUST appear (even if their exact value isn't graded). */
  mustDetect?: string[]
}

// ─── Metric types ────────────────────────────────────────────────

export interface ExtractionMetrics {
  fieldAccuracy: number // fraction of expected fields matched
  // Fraction of returned fields whose name is NOT in the expected set. NOTE:
  // this compares against the expected-field set only — it does NOT verify
  // presence in the source document text (the scorer has no document access).
  // A returned value that happens to match document text but isn't in the
  // expected set still counts here as a "hallucination".
  hallucinationRate: number
  confidenceCalibration: number // avg |confidence − correct|
  classificationAccuracy: number // 1 or 0
  fieldsEvaluated: number
  fieldsCorrect: number
  fieldsHallucinated: number
}

// ─── Scoring ─────────────────────────────────────────────────────

/** Normalize a value for comparison: trim, lowercase, strip $/,/spaces. */
function norm(v: string): string {
  return v.replace(/[$,\s]/g, '').toLowerCase().trim()
}

function valueMatches(actual: string, expected: string, tolerance?: number): boolean {
  if (norm(actual) === norm(expected)) return true
  // Numeric tolerance (e.g. currency).
  if (tolerance !== undefined) {
    const a = parseFloat(norm(actual).replace(/[^0-9.-]/g, ''))
    const e = parseFloat(norm(expected).replace(/[^0-9.-]/g, ''))
    if (!isNaN(a) && !isNaN(e) && Math.abs(a - e) <= tolerance) return true
  }
  // Masked-PII partial match: last-4 of SSN/EIN.
  if (expected.includes('*') && actual.slice(-4) === expected.slice(-4)) return true
  return false
}

/**
 * Score one extraction result against its golden fixture.
 */
export function evaluateExtraction(
  result: { fields: { name: string; value: string; confidence: number }[] },
  expected: GoldenFixture,
  classify?: ClassifyResult | null
): ExtractionMetrics {
  const expectedFields = expected.expectedFields
  const expectedNames = new Set(expectedFields.map((f) => f.name))
  let correct = 0
  let hallucinated = 0
  let confDeltaSum = 0
  let fieldsEvaluated = 0

  // Track which expected field names have already been scored so duplicate
  // returns of the same name can't inflate `correct` past the expected count
  // (which would let fieldAccuracy exceed 1.0).
  const scored = new Set<string>()

  for (const f of result.fields) {
    fieldsEvaluated++
    if (!expectedNames.has(f.name) || scored.has(f.name)) {
      // Either truly unexpected, or a duplicate of an expected name we already
      // graded. Count as hallucinated (duplicate fields are not trustworthy).
      hallucinated++
      confDeltaSum += Math.abs(f.confidence - 0) // wrong → desired conf 0
      continue
    }
    scored.add(f.name)
    const exp = expectedFields.find((e) => e.name === f.name)!
    const isCorrect = valueMatches(f.value, exp.value, exp.tolerance)
    if (isCorrect) correct++
    confDeltaSum += Math.abs(f.confidence - (isCorrect ? 1 : 0))
  }

  const denom = fieldsEvaluated || 1
  const expectedCount = expectedFields.length || 1

  return {
    fieldAccuracy: Math.min(1, correct / expectedCount),
    hallucinationRate: denom > 0 ? hallucinated / denom : 0,
    confidenceCalibration: confDeltaSum / denom,
    classificationAccuracy: classify && expected.documentType
      ? (classify.documentType === expected.documentType ? 1 : 0)
      : (expected.documentType === null ? 1 : 0),
    fieldsEvaluated: result.fields.length,
    fieldsCorrect: correct,
    fieldsHallucinated: hallucinated,
  }
}

/**
 * Aggregate a list of per-fixture metrics into a summary.
 */
export function summarizeMetrics(perFixture: ExtractionMetrics[]): {
  meanFieldAccuracy: number
  meanHallucinationRate: number
  meanConfidenceCalibration: number
  classificationAccuracy: number
} {
  if (perFixture.length === 0) {
    return { meanFieldAccuracy: 0, meanHallucinationRate: 0, meanConfidenceCalibration: 0, classificationAccuracy: 0 }
  }
  const n = perFixture.length
  const sum = (sel: (m: ExtractionMetrics) => number) => perFixture.reduce((s, m) => s + sel(m), 0)
  return {
    meanFieldAccuracy: sum((m) => m.fieldAccuracy) / n,
    meanHallucinationRate: sum((m) => m.hallucinationRate) / n,
    meanConfidenceCalibration: sum((m) => m.confidenceCalibration) / n,
    classificationAccuracy: sum((m) => m.classificationAccuracy) / n,
  }
}
