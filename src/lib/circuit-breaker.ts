/**
 * TaxDox AI — Circuit Breaker
 *
 * Wraps calls to unreliable external services (AI/GLM, Resend, Stripe) so a
 * failing dependency fails fast instead of cascading. Three states:
 *   - CLOSED:     requests pass through; failures increment a counter.
 *   - OPEN:       requests fail immediately for `cooldownMs`; no call is made.
 *   - HALF_OPEN:  a single probe request is allowed; success → CLOSED,
 *                 failure → back to OPEN.
 *
 * State is in-memory per process. For multi-instance this would move to
 * Redis, but per-instance breakers still meaningfully protect each instance.
 *
 * Surfaced in /api/health/ready so an open breaker pulls the instance from
 * routing.
 */

import { logger } from '@/lib/logger'

type State = 'closed' | 'open' | 'half-open'

interface BreakerOptions {
  /** Failures within `windowMs` that trip the breaker. */
  threshold?: number
  /** Rolling window for counting failures. */
  windowMs?: number
  /** How long the breaker stays OPEN before a probe. */
  cooldownMs?: number
}

class CircuitBreaker {
  private state: State = 'closed'
  private failures: number[] = [] // timestamps
  private openedAt = 0
  private readonly threshold: number
  private readonly windowMs: number
  private readonly cooldownMs: number

  constructor(
    private readonly name: string,
    opts: BreakerOptions = {}
  ) {
    this.threshold = opts.threshold ?? 5
    this.windowMs = opts.windowMs ?? 60_000
    this.cooldownMs = opts.cooldownMs ?? 30_000
  }

  /** Current state, for /ready health reporting. */
  getState(): State {
    this.maybeHalfOpen()
    return this.state
  }

  isOpen(): boolean {
    this.maybeHalfOpen()
    return this.state === 'open'
  }

  /**
   * Execute `fn`, applying circuit semantics. Throws if open (or if `fn`
   * throws). Records success/failure to evolve state.
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    this.maybeHalfOpen()

    if (this.state === 'open') {
      throw new CircuitOpenError(this.name)
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (err) {
      this.onFailure()
      throw err
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      logger.system.info('Circuit breaker closed (recovered)', { name: this.name })
    }
    this.failures = []
    this.state = 'closed'
  }

  private onFailure(): void {
    const now = Date.now()
    this.failures = [...this.failures, now].filter((t) => now - t < this.windowMs)

    if (this.state === 'half-open') {
      // Probe failed — reopen.
      this.trip(now)
      return
    }

    if (this.failures.length >= this.threshold) {
      this.trip(now)
    }
  }

  private trip(now: number): void {
    this.state = 'open'
    this.openedAt = now
    logger.system.warn('Circuit breaker opened', {
      name: this.name,
      failures: this.failures.length,
    })
  }

  private maybeHalfOpen(): void {
    if (this.state === 'open' && Date.now() - this.openedAt >= this.cooldownMs) {
      this.state = 'half-open'
      logger.system.info('Circuit breaker half-open (probing)', { name: this.name })
    }
  }
}

/** Thrown when a call is rejected because the breaker is open. */
export class CircuitOpenError extends Error {
  constructor(name: string) {
    super(`Circuit '${name}' is open — failing fast`)
    this.name = 'CircuitOpenError'
  }
}

// ─── Registry (named breakers for the key external deps) ───────────

const breakers = new Map<string, CircuitBreaker>()

export function getBreaker(name: string, opts?: BreakerOptions): CircuitBreaker {
  let b = breakers.get(name)
  if (!b) {
    b = new CircuitBreaker(name, opts)
    breakers.set(name, b)
  }
  return b
}

/**
 * Snapshot all breaker states for /ready. An open breaker makes the instance
 * not-ready so traffic shifts away while the dependency recovers.
 */
export function breakerStates(): Record<string, State> {
  const out: Record<string, State> = {}
  for (const [name, b] of breakers) {
    out[name] = b.getState()
  }
  return out
}
