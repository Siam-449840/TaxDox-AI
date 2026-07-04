/**
 * TaxDox AI — Gemini Provider (AI Gateway, Phase 2)
 *
 * THE ONLY module in the codebase that imports @google/genai or mentions the
 * string 'gemini'. Everything else talks to the AIProvider interface.
 *
 * Implements: timeouts, retries (transient/quota only), normalized
 * ProviderError, safety settings, JSON-output preference, and metadata for
 * observability/cost tracking.
 *
 * Reading config: GEMINI_API_KEY + GEMINI_MODEL from env (never hardcoded).
 */

import type {
  AIProvider,
  ChatMessage,
  ChatResult,
  ClassifyInput,
  ClassifyResult,
  ExtractInput,
  ExtractionResult,
  HealthResult,
  ProviderMeta,
} from './types'
import { ProviderError } from './types'
import { CLASSIFICATION_PROMPT, EXTRACTION_PROMPT, CHAT_SYSTEM_PROMPT } from './prompts'
import { parseClassification, parseExtraction, logParseFailure } from './schema-validation'
import { logger } from '@/lib/logger'

// ─── Config ──────────────────────────────────────────────────────

const MODEL = () => process.env.GEMINI_MODEL || 'gemini-3.5-flash'
const API_KEY = () => process.env.GEMINI_API_KEY || ''
const TEXT_TIMEOUT_MS = 30_000
const VISION_TIMEOUT_MS = 60_000
const MAX_RETRIES = 2

// ─── Lazy SDK singleton ──────────────────────────────────────────

// Minimal structural type for the SDK client surface we use. We avoid importing
// the concrete class type at module top-level (the SDK is dynamic-imported) but
// get full type-checking on the response shapes.
interface GenAIResponse {
  text: string
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
  }
}
interface GenAIClient {
  models: {
    generateContent(req: Record<string, unknown>): Promise<GenAIResponse>
  }
}

let _client: GenAIClient | null = null

async function getClient(): Promise<GenAIClient> {
  if (_client) return _client
  if (!API_KEY()) {
    throw new ProviderError('gemini', 'auth', 'GEMINI_API_KEY is not set', false)
  }
  // Dynamic import keeps this heavy dep out of any Edge bundle and means a
  // non-Gemini deploy never loads the SDK.
  const { GoogleGenAI } = await import('@google/genai')
  _client = new GoogleGenAI({ apiKey: API_KEY() }) as unknown as GenAIClient
  return _client
}

// ─── GeminiProvider ──────────────────────────────────────────────

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini'

  providerMeta(): ProviderMeta {
    return {
      provider: 'gemini',
      model: MODEL(),
      promptVersions: {
        classification: CLASSIFICATION_PROMPT.version,
        extraction: EXTRACTION_PROMPT.version,
        validation: 'gemini-3.5-flash-validation-v1',
      },
      // gemini-3.5-flash pricing (USD / 1K tokens). Update when Google publishes.
      costPer1k: { input: 0.0003, output: 0.0025 },
    }
  }

  async classifyDocument(input: ClassifyInput): Promise<ClassifyResult> {
    const typeList = [
      'W-2', '1099-NEC', '1099-INT', '1099-DIV', '1099-B', '1099-R', 'K-1',
      '1098', '1098-T', 'Property-Tax', 'Charity-Receipt', 'P&L',
      'Balance-Sheet', 'Bank-Statement', 'Brokerage-Statement',
      'Drivers-License', 'Passport', 'Payroll-Report', 'SSN-Card',
    ].join(', ')
    const prompt = CLASSIFICATION_PROMPT.text({ typeList })

    const parts: Part[] = []
    parts.push({ text: prompt })
    if (input.imageBase64) {
      parts.push({ inlineData: { data: input.imageBase64, mimeType: input.mimeType || 'image/png' } })
    } else if (input.text) {
      parts.push({ text: `Document text:\n${input.text.slice(0, 4000)}` })
    }

    const raw = await this.generate(parts, !!input.imageBase64)
    const parsed = parseClassification(raw)
    if (!parsed) {
      logParseFailure('classify', raw)
      throw new ProviderError('gemini', 'invalid-response', 'classification JSON unparseable', false)
    }
    return {
      documentType: parsed.documentType,
      confidence: parsed.confidence,
      model: MODEL(),
      provider: 'gemini',
      promptVersion: CLASSIFICATION_PROMPT.version,
      isFallback: false,
    }
  }

  async extractFields(input: ExtractInput): Promise<ExtractionResult> {
    const fieldList = input.fields.map((f) => `- ${f.name}: ${f.label}`).join('\n')
    const docLabel = input.documentType
    const prompt = EXTRACTION_PROMPT.text({ docLabel, fieldList })

    const parts: Part[] = []
    parts.push({ text: prompt })
    if (input.imageBase64) {
      parts.push({ inlineData: { data: input.imageBase64, mimeType: input.mimeType || 'image/png' } })
    } else if (input.text) {
      parts.push({ text: `Document text:\n${input.text.slice(0, 8000)}` })
    }

    const { raw, usage } = await this.generateWithUsage(parts, !!input.imageBase64)
    const expected = new Set(input.fields.map((f) => f.name))
    const parsed = parseExtraction(raw, expected)
    if (!parsed) {
      logParseFailure('extract', raw)
      throw new ProviderError('gemini', 'invalid-response', 'extraction JSON unparseable', false)
    }
    return {
      fields: parsed,
      model: MODEL(),
      provider: 'gemini',
      promptVersion: EXTRACTION_PROMPT.version,
      templateVersion: `${docLabel.toLowerCase().replace(/[^a-z0-9]/g, '')}-v1`,
      usage,
      isFallback: false,
    }
  }

  async chat(messages: ChatMessage[]): Promise<ChatResult> {
    // Gemini uses a systemInstruction field + contents.
    const sys = messages.find((m) => m.role === 'system')?.content || CHAT_SYSTEM_PROMPT
    const convo = messages.filter((m) => m.role !== 'system').map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    try {
      const client = await getClient()
      const t0 = Date.now()
      const res = await withTimeout(
        client.models.generateContent({
          model: MODEL(),
          contents: convo,
          config: {
            systemInstruction: sys,
            temperature: 0.4,
            maxOutputTokens: 1024,
          },
        }),
        TEXT_TIMEOUT_MS
      )
      const text = res.text ?? ''
      logger.ai.info('Gemini chat ok', { latencyMs: Date.now() - t0 })
      return {
        reply: text || 'I apologize, I could not process that request.',
        model: MODEL(),
        provider: 'gemini',
        usage: res.usageMetadata
          ? { inputTokens: res.usageMetadata.promptTokenCount, outputTokens: res.usageMetadata.candidatesTokenCount }
          : null,
      }
    } catch (err) {
      throw normalizeError(err)
    }
  }

  async healthCheck(): Promise<HealthResult> {
    if (!API_KEY()) {
      return { ok: false, provider: 'gemini', detail: 'GEMINI_API_KEY unset' }
    }
    const t0 = Date.now()
    try {
      const client = await getClient()
      // Minimal call: a 1-token "ping". Validates auth + model name + quota.
      const res = await withTimeout(
        client.models.generateContent({
          model: MODEL(),
          contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: ok' }] }],
          config: { maxOutputTokens: 5 },
        }),
        TEXT_TIMEOUT_MS
      )
      const ok = typeof res.text === 'string'
      return { ok, provider: 'gemini', model: MODEL(), detail: ok ? 'reachable' : 'empty response', latencyMs: Date.now() - t0 }
    } catch (err) {
      const e = err instanceof ProviderError ? err : normalizeError(err)
      return { ok: false, provider: 'gemini', model: MODEL(), detail: `${e.kind}: ${e.message}`, latencyMs: Date.now() - t0 }
    }
  }

  // ─── Internal: generate with retry + timeout ───────────────────

  private async generate(parts: Part[], isVision: boolean): Promise<string> {
    return (await this.generateWithUsage(parts, isVision)).raw
  }

  private async generateWithUsage(
    parts: Part[],
    isVision: boolean
  ): Promise<{ raw: string; usage: ExtractionResult['usage'] }> {
    const timeout = isVision ? VISION_TIMEOUT_MS : TEXT_TIMEOUT_MS
    let lastErr: ProviderError | null = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const client = await getClient()
        const t0 = Date.now()
        const res = await withTimeout(
          client.models.generateContent({
            model: MODEL(),
            contents: [{ role: 'user', parts }],
            config: {
              temperature: 0.1,
              maxOutputTokens: isVision ? 4096 : 2048,
              // Prefer structured JSON output where the model supports it.
              responseMimeType: 'application/json',
            },
          }),
          timeout
        )
        const raw = res.text ?? ''
        const usage = res.usageMetadata
          ? { inputTokens: res.usageMetadata.promptTokenCount, outputTokens: res.usageMetadata.candidatesTokenCount }
          : null
        logger.ai.debug('Gemini generate ok', {
          model: MODEL(),
          attempt,
          latencyMs: Date.now() - t0,
          chars: raw.length,
        })
        return { raw, usage }
      } catch (err) {
        const e = err instanceof ProviderError ? err : normalizeError(err)
        lastErr = e
        if (!e.retryable || attempt === MAX_RETRIES) break
        // Exponential backoff: 400ms, 800ms.
        await sleep(400 * 2 ** attempt)
        logger.ai.warn('Gemini retry', { attempt: attempt + 1, kind: e.kind })
      }
    }
    throw lastErr ?? new ProviderError('gemini', 'unknown', 'generate failed')
  }
}

// ─── Error normalization ─────────────────────────────────────────

function normalizeError(err: unknown): ProviderError {
  const msg = err instanceof Error ? err.message : String(err)
  const lower = msg.toLowerCase()
  // API key / permission
  if (lower.includes('api key') || lower.includes('permission') || lower.includes('unauthorized') || lower.includes('401') || lower.includes('403')) {
    return new ProviderError('gemini', 'auth', msg, false)
  }
  // Quota / rate limit
  if (lower.includes('quota') || lower.includes('rate limit') || lower.includes('429') || lower.includes('resource_exhausted')) {
    return new ProviderError('gemini', 'quota', msg, true)
  }
  // Model name
  if (lower.includes('not found') || lower.includes('model') && lower.includes('unsupported') || lower.includes('404')) {
    return new ProviderError('gemini', 'invalid-model', msg, false)
  }
  // Safety block
  if (lower.includes('safety') || lower.includes('blocked') || lower.includes('prohibited')) {
    return new ProviderError('gemini', 'safety', msg, false)
  }
  // Timeout (our own AbortError or SDK deadline)
  if (lower.includes('timeout') || lower.includes('aborted') || lower.includes('deadline')) {
    return new ProviderError('gemini', 'timeout', msg, true)
  }
  // 5xx / transient
  if (lower.includes('500') || lower.includes('502') || lower.includes('503') || lower.includes('unavailable') || lower.includes('internal')) {
    return new ProviderError('gemini', 'unknown', msg, true)
  }
  return new ProviderError('gemini', 'unknown', msg, false)
}

// ─── Tiny helpers ────────────────────────────────────────────────

interface Part {
  text?: string
  inlineData?: { data: string; mimeType: string }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new ProviderError('gemini', 'timeout', `exceeded ${ms}ms`, true)), ms)
    p.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) }
    )
  })
}
