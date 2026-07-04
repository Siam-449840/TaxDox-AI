/**
 * TaxDox AI — Provider-Agnostic AI Interface (AI Gateway, Phase 1)
 *
 * This module defines the contract every AI provider must implement. It
 * contains ZERO references to any specific provider (no Gemini, no OpenAI).
 * Providers live in their own modules and implement this interface; the
 * AIGateway selects one at runtime via the registry.
 *
 * Adding a new provider = implement `AIProvider` + call `registerProvider()`.
 * No application code (routes/jobs) changes.
 */

// ─── Normalized errors ───────────────────────────────────────────

export type ProviderErrorKind =
  | 'auth' // bad/missing API key
  | 'quota' // rate limit or billing quota
  | 'invalid-model' // model name rejected
  | 'timeout' // request exceeded deadline
  | 'safety' // model refused on safety grounds
  | 'invalid-response' // couldn't parse/validate model output
  | 'unknown'

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind
  readonly provider: string
  readonly retryable: boolean
  constructor(provider: string, kind: ProviderErrorKind, message: string, retryable = false) {
    super(`[${provider}] ${kind}: ${message}`)
    this.name = 'ProviderError'
    this.provider = provider
    this.kind = kind
    this.retryable = retryable
  }
}

// ─── Result types ────────────────────────────────────────────────

export interface ClassifyResult {
  documentType: string | null
  confidence: number // 0..1
  model: string // e.g. 'gemini-3.5-flash'
  provider: string // e.g. 'gemini'
  promptVersion: string
  /** True if this came from a non-AI fallback (filename heuristic, simulated). */
  isFallback: boolean
}

export interface ExtractedField {
  name: string
  value: string
  confidence: number // 0..1
}

export interface ExtractionResult {
  fields: ExtractedField[]
  model: string
  provider: string
  promptVersion: string
  templateVersion: string
  /** Token usage if the provider reports it; null when unavailable. */
  usage?: { inputTokens?: number; outputTokens?: number } | null
  isFallback: boolean
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatResult {
  reply: string
  model: string
  provider: string
  usage?: { inputTokens?: number; outputTokens?: number } | null
}

// ─── Provider metadata ───────────────────────────────────────────

export interface ProviderMeta {
  provider: string
  model: string
  promptVersions: { classification: string; extraction: string; validation: string }
  /** USD per 1K tokens (input, output), or null when not applicable. */
  costPer1k?: { input: number; output: number } | null
}

// ─── Health ──────────────────────────────────────────────────────

export interface HealthResult {
  ok: boolean
  provider: string
  model?: string
  detail?: string
  latencyMs?: number
}

// ─── The interface every provider implements ─────────────────────

export interface AIProvider {
  /** Stable provider id, e.g. 'gemini'. */
  readonly name: string

  /** Classify a document from an image (base64) or extracted text. */
  classifyDocument(input: ClassifyInput): Promise<ClassifyResult>

  /** Extract structured fields for a known document type. */
  extractFields(input: ExtractInput): Promise<ExtractionResult>

  /** Free-form chat (assistant). */
  chat(messages: ChatMessage[]): Promise<ChatResult>

  /** Liveness/auth/quota check — used by /api/health/ready + connection tests. */
  healthCheck(): Promise<HealthResult>

  /** Static metadata for observability + cost tracking. */
  providerMeta(): ProviderMeta
}

export interface ClassifyInput {
  /** base64-encoded image bytes (without the data: prefix). */
  imageBase64?: string
  mimeType?: string
  /** Pre-extracted document text (PDF/Word/spreadsheet OCR). */
  text?: string
  /** Caller-supplied filename, used only for fallback labeling. */
  filename?: string
}

export interface ExtractInput {
  /** The classified document type, e.g. 'W-2'. */
  documentType: string
  /** Field definitions expected for this type (name + label). */
  fields: { name: string; label: string }[]
  imageBase64?: string
  mimeType?: string
  text?: string
}
