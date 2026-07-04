/**
 * TaxDox AI — AI Gateway (Phase 1, single application chokepoint)
 *
 *   Application (routes/jobs)
 *        ↓
 *   AIGateway            ← provider selection, circuit breaker, metrics, fallback
 *        ↓
 *   AIProvider interface ← zero provider knowledge
 *        ↓
 *   GeminiProvider       ← the only place Gemini is named
 *
 * Every AI call from a route/job goes through getAIGateway(). No route ever
 * imports a provider SDK or the registry directly.
 *
 * Fallback readiness (Addition #3): the gateway is built to try providers in a
 * priority order. Today only Gemini is registered, so fallback is dormant —
 * but the shape means adding a second provider later is config + one
 * registerProvider() call, not a rewrite.
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
} from './types'
import { ProviderError } from './types'
import { getProvider, registerProvider, listProviders } from './registry'
import { getBreaker } from '@/lib/circuit-breaker'
import { logger } from '@/lib/logger'

// ─── Provider registration ───────────────────────────────────────
// Self-register the Gemini provider. Dynamic import keeps the SDK out of the
// gateway's module graph (and out of any Edge bundle) until first use.
let _geminiRegistered = false
async function ensureProvidersRegistered(): Promise<void> {
  if (_geminiRegistered) return
  if (!listProviders().includes('gemini')) {
    const { GeminiProvider } = await import('./gemini-provider')
    registerProvider('gemini', () => new GeminiProvider())
  }
  _geminiRegistered = true
}

// ─── Fallback config (Addition #3) ───────────────────────────────
// Ordered list of providers to try. Pulled from AI_PROVIDER (primary); future
// env AI_FALLBACK_PROVIDERS can extend it. Today: just the primary.
function providerPriority(): string[] {
  // Trim so "gemini " doesn't create a distinct breaker key / fail registry lookup.
  const primary = (process.env.AI_PROVIDER || 'gemini').trim()
  const fallbacks = (process.env.AI_FALLBACK_PROVIDERS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  // De-dup, primary first.
  return [...new Set([primary, ...fallbacks])]
}

// ─── Gateway ─────────────────────────────────────────────────────

class AIGateway {
  /**
   * Try each provider in priority order until one succeeds. Records which
   * provider handled the call (fallback flag) for observability. With a single
   * registered provider this collapses to "try Gemini once".
   */
  private async withFallback<T>(
    fn: (provider: AIProvider) => Promise<T>
  ): Promise<{ result: T; providerName: string; fallback: boolean }> {
    await ensureProvidersRegistered()
    const priority = providerPriority()
    let lastErr: unknown = null

    for (let i = 0; i < priority.length; i++) {
      const name = priority[i]
      let provider: AIProvider
      try {
        provider = getProvider(name)
      } catch (e) {
        // Unknown provider name — log and skip to the next.
        logger.ai.warn('AI provider not registered, skipping', { provider: name, error: String(e) })
        continue
      }

      // Each provider gets its own breaker, so one provider's outage doesn't
      // block a healthy secondary.
      const breaker = getBreaker(`ai-${name}`, { threshold: 5, cooldownMs: 60_000 })
      try {
        const result = await breaker.run(() => fn(provider))
        return { result, providerName: name, fallback: i > 0 }
      } catch (err) {
        lastErr = err
        const kind = err instanceof ProviderError ? err.kind : 'unknown'
        const retryable = err instanceof ProviderError ? err.retryable : false
        logger.ai.warn('AI provider call failed', {
          provider: name,
          kind,
          retryable,
          error: err instanceof Error ? err.message : String(err),
          nextFallback: i < priority.length - 1,
        })
        // If the error is non-retryable (auth/invalid-model), don't bother the
        // next provider with the same broken config — but only when there IS a
        // next provider to consider. With one provider we still surface the err.
        if (kind === 'auth' || kind === 'invalid-model') break
      }
    }
    throw lastErr ?? new ProviderError('gateway', 'unknown', 'all providers exhausted')
  }

  // ── Public API ─────────────────────────────────────────────────

  async classify(input: ClassifyInput): Promise<ClassifyResult> {
    const t0 = Date.now()
    try {
      const { result, providerName, fallback } = await this.withFallback((p) => p.classifyDocument(input))
      logger.ai.info('AI classify ok', {
        provider: providerName, model: result.model, fallback,
        latencyMs: Date.now() - t0, type: result.documentType, confidence: result.confidence,
      })
      return result
    } catch (err) {
      logger.ai.error('AI classify failed', { latencyMs: Date.now() - t0, error: err instanceof Error ? err.message : String(err) })
      throw err
    }
  }

  async extract(input: ExtractInput): Promise<ExtractionResult> {
    const t0 = Date.now()
    try {
      const { result, providerName, fallback } = await this.withFallback((p) => p.extractFields(input))
      logger.ai.info('AI extract ok', {
        provider: providerName, model: result.model, fallback,
        latencyMs: Date.now() - t0, fields: result.fields.length,
        usage: result.usage,
      })
      return result
    } catch (err) {
      logger.ai.error('AI extract failed', { latencyMs: Date.now() - t0, error: err instanceof Error ? err.message : String(err) })
      throw err
    }
  }

  async chat(messages: ChatMessage[]): Promise<ChatResult> {
    const { result } = await this.withFallback((p) => p.chat(messages))
    return result
  }

  /** Health of every configured provider — used by /api/health/ready. */
  async health(): Promise<HealthResult[]> {
    await ensureProvidersRegistered()
    const priority = providerPriority()
    const out: HealthResult[] = []
    for (const name of priority) {
      try {
        const provider = getProvider(name)
        out.push(await provider.healthCheck())
      } catch (e) {
        out.push({ ok: false, provider: name, detail: String(e) })
      }
    }
    return out
  }

  /** Metadata for the primary provider (observability/cost). */
  async providerMeta() {
    await ensureProvidersRegistered()
    return getProvider(providerPriority()[0]).providerMeta()
  }
}

// ─── Singleton ───────────────────────────────────────────────────

let _gateway: AIGateway | null = null
export function getAIGateway(): AIGateway {
  if (!_gateway) _gateway = new AIGateway()
  return _gateway
}
