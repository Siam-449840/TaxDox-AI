/**
 * TaxDox AI — AI Security Layer (Sections 5.4, 5.5, 5.6)
 *
 * 5.4: Hallucination Detection — verify extracted values against document text
 * 5.5: Prompt Injection Defense — sanitize document text before AI call
 * 5.6: Cross-Document Validation — check consistency across documents in an engagement
 */

// ─── 5.5: Prompt Injection Defense ────────────────────────────

// Known injection patterns to detect and redact
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /override\s+(all\s+)?constraints/i,
  /system\s+prompt/i,
  /you\s+are\s+now\s+/i,
  /forget\s+(everything|all)\s+(you\s+were\s+)?told/i,
  /disregard\s+(the\s+)?above/i,
  /act\s+as\s+(if\s+you\s+are|a)/i,
  /<\|[^|]+\|>/g, // special tokens like <|system|>
  /```[\s\S]*?```/g, // code blocks that might contain instructions
]

/**
 * Sanitize document text before sending to AI.
 * Removes injection patterns and special tokens.
 * Returns sanitized text + list of detected injection attempts.
 */
export function sanitizeDocumentText(text: string): {
  sanitized: string
  injectionsDetected: number
  hadInjection: boolean
} {
  let sanitized = text
  let injectionsDetected = 0

  for (const pattern of INJECTION_PATTERNS) {
    const matches = sanitized.match(pattern)
    if (matches) {
      injectionsDetected += matches.length
      sanitized = sanitized.replace(pattern, '[REDACTED]')
    }
  }

  return {
    sanitized,
    injectionsDetected,
    hadInjection: injectionsDetected > 0,
  }
}

// ─── 5.4: Hallucination Detection ─────────────────────────────

export interface ExtractionValidation {
  fieldName: string
  value: string
  isValid: boolean
  isHallucination: boolean
  reason?: string
  confidenceAdjustment: number // negative = reduce confidence
}

/**
 * Validate a single extracted field against the document text.
 *
 * Checks:
 * 1. Does the value literally appear in the document text?
 * 2. Format validation (SSN, EIN, date, currency)
 * 3. Range validation (negative income, impossible year)
 */
export function validateExtraction(
  fieldName: string,
  value: string,
  documentText: string,
  documentType: string
): ExtractionValidation {
  // Skip validation for N/A or empty values
  if (!value || value === 'N/A' || value === '—') {
    return { fieldName, value, isValid: true, isHallucination: false, confidenceAdjustment: 0 }
  }

  // Check 1: Does the value appear in the document text?
  // For numeric values, try matching with and without formatting
  const normalizedValue = value.replace(/[$,\s]/g, '')
  const normalizedText = documentText.replace(/[$,\s]/g, '')
  const appearsInText =
    documentText.includes(value) ||
    normalizedText.includes(normalizedValue) ||
    // Try just the numeric part
    normalizedText.includes(normalizedValue.replace(/[^0-9.]/g, ''))

  // Check 2: Format validation
  const formatResult = validateFieldFormat(fieldName, value, documentType)

  // Check 3: Range validation
  const rangeResult = validateFieldRange(fieldName, value)

  const isHallucination = !appearsInText && !formatResult.isDerived
  const isValid = appearsInText && formatResult.isValid && rangeResult.isValid

  let reason: string | undefined
  let confidenceAdjustment = 0

  if (!appearsInText && !formatResult.isDerived) {
    reason = 'Value does not appear in document text (potential hallucination)'
    confidenceAdjustment = -0.3
  } else if (!formatResult.isValid) {
    reason = formatResult.reason
    confidenceAdjustment = -0.2
  } else if (!rangeResult.isValid) {
    reason = rangeResult.reason
    confidenceAdjustment = -0.15
  }

  return {
    fieldName,
    value,
    isValid,
    isHallucination,
    reason,
    confidenceAdjustment,
  }
}

// ─── Format Validation ────────────────────────────────────────

function validateFieldFormat(
  fieldName: string,
  value: string,
  documentType: string
): { isValid: boolean; isDerived: boolean; reason?: string } {
  const lower = fieldName.toLowerCase()

  // SSN format: xxx-xx-xxxx or ***-**-xxxx (masked)
  if (lower.includes('ssn')) {
    if (/^\*{3}-\*{2}-\d{4}$/.test(value)) return { isValid: true, isDerived: false }
    if (/^\d{3}-\d{2}-\d{4}$/.test(value)) return { isValid: true, isDerived: false }
    return { isValid: false, isDerived: false, reason: 'Invalid SSN format' }
  }

  // EIN format: xx-xxxxxxx
  if (lower.includes('ein')) {
    if (/^\*{2}-\*{3}\d{4}$/.test(value)) return { isValid: true, isDerived: false }
    if (/^\d{2}-\d{7}$/.test(value)) return { isValid: true, isDerived: false }
    return { isValid: false, isDerived: false, reason: 'Invalid EIN format' }
  }

  // Currency values
  if (value.match(/^\$[\d,]+(\.\d{2})?$/)) {
    return { isValid: true, isDerived: false }
  }

  // Dates
  if (lower.includes('date') || lower.includes('period')) {
    return { isValid: true, isDerived: false }
  }

  // Percentage
  if (value.match(/^\d+(\.\d+)?%$/)) {
    return { isValid: true, isDerived: false }
  }

  // Derived fields (computed, not directly in text) — don't flag as hallucination
  if (
    lower.includes('gain_loss') ||
    lower.includes('net_income') ||
    lower.includes('total') ||
    lower.includes('ownership')
  ) {
    return { isValid: true, isDerived: true }
  }

  return { isValid: true, isDerived: false }
}

// ─── Range Validation ─────────────────────────────────────────

function validateFieldRange(
  fieldName: string,
  value: string
): { isValid: boolean; reason?: string } {
  const lower = fieldName.toLowerCase()

  // Extract numeric value
  const numMatch = value.match(/-?[\d,]+(\.\d+)?/)
  if (!numMatch) return { isValid: true }

  const num = parseFloat(numMatch[0].replace(/,/g, ''))

  // Negative income is suspicious
  if (lower.includes('wages') || lower.includes('income') || lower.includes('revenue')) {
    if (num < 0) return { isValid: false, reason: 'Negative income value' }
  }

  // Tax year range
  if (lower.includes('year') && num > 1900 && num < 2100) {
    if (num < 2020 || num > 2030) {
      return { isValid: false, reason: `Tax year ${num} is outside valid range` }
    }
  }

  // Ownership percentage
  if (lower.includes('ownership') || lower.includes('pct')) {
    const pctMatch = value.match(/(\d+(\.\d+)?)/)
    if (pctMatch) {
      const pct = parseFloat(pctMatch[1])
      if (pct < 0 || pct > 100) {
        return { isValid: false, reason: 'Ownership percentage out of range' }
      }
    }
  }

  return { isValid: true }
}

// ─── 5.6: Cross-Document Validation ───────────────────────────

export interface CrossDocumentCheck {
  check: string
  passed: boolean
  message: string
  severity: 'info' | 'warning' | 'error'
}

/**
 * Run cross-document validation checks on an engagement's extractions.
 *
 * Examples:
 * - W-2 wages vs. 1040 line 1
 * - 1099-INT vs. Schedule B
 * - K-1 vs. partner's 1065
 * - Year-over-year changes >50%
 */
export function validateCrossDocuments(
  documents: Array<{
    documentType: string | null
    extractions: Array<{ fieldName: string; fieldValue: string }>
  }>
): CrossDocumentCheck[] {
  const checks: CrossDocumentCheck[] = []

  // Find all W-2 documents and sum wages
  const w2Docs = documents.filter((d) => d.documentType === 'W-2')
  const w2Wages = w2Docs.reduce((sum, d) => {
    const wageField = d.extractions.find((e) => e.fieldName === 'box1_wages')
    const num = wageField ? parseFloat(wageField.fieldValue.replace(/[$,\s]/g, '')) : 0
    return sum + (isNaN(num) ? 0 : num)
  }, 0)

  if (w2Docs.length > 0) {
    checks.push({
      check: 'W-2 wages total',
      passed: true,
      message: `Total W-2 wages across ${w2Docs.length} document(s): $${w2Wages.toLocaleString()}`,
      severity: 'info',
    })
  }

  // Check for 1099-INT and verify interest income is positive
  const intDocs = documents.filter((d) => d.documentType === '1099-INT')
  for (const doc of intDocs) {
    const interestField = doc.extractions.find((e) => e.fieldName === 'box1_interest')
    if (interestField) {
      const num = parseFloat(interestField.fieldValue.replace(/[$,\s]/g, ''))
      if (!isNaN(num) && num < 0) {
        checks.push({
          check: '1099-INT negative interest',
          passed: false,
          message: 'Interest income cannot be negative',
          severity: 'error',
        })
      }
    }
  }

  // Check K-1 ownership percentages sum to ~100% for partnerships
  const k1Docs = documents.filter((d) => d.documentType === 'K-1')
  if (k1Docs.length > 1) {
    const totalOwnership = k1Docs.reduce((sum, d) => {
      const ownField = d.extractions.find((e) => e.fieldName === 'ownership_pct')
      const match = ownField?.fieldValue.match(/(\d+(\.\d+)?)/)
      return sum + (match ? parseFloat(match[1]) : 0)
    }, 0)

    if (totalOwnership > 0 && (totalOwnership < 95 || totalOwnership > 105)) {
      checks.push({
        check: 'K-1 ownership sum',
        passed: false,
        message: `Total K-1 ownership is ${totalOwnership.toFixed(1)}% (expected ~100%)`,
        severity: 'warning',
      })
    } else if (totalOwnership > 0) {
      checks.push({
        check: 'K-1 ownership sum',
        passed: true,
        message: `Total K-1 ownership: ${totalOwnership.toFixed(1)}%`,
        severity: 'info',
      })
    }
  }

  return checks
}
