/**
 * TaxDox AI — Fail-Loud Environment Validation
 *
 * Production safety: in production we refuse to boot if a required secret or
 * config value is missing. The previous code used insecure fallbacks
 * (a publicly-known encryption key, a default cron key, placeholder Stripe
 * prices) which silently fail open — catastrophic for a tax-PII platform.
 *
 * Behavior:
 *   - In NODE_ENV=production: validateEnv() THROWS on missing required vars.
 *   - In development/test: missing required vars are logged as warnings so
 *     `bun dev` keeps working without every integration configured, but the
 *     app never silently uses a known-insecure default.
 *
 * There is intentionally NO `|| 'insecure-default'` fallback anywhere in the
 * codebase for secrets — this module is the single source of truth for what
 * "configured" means.
 */

const IS_PROD = process.env.NODE_ENV === 'production'

/** Secrets/config that MUST be present in production. */
const REQUIRED_IN_PROD: Record<string, string> = {
  DATABASE_URL: 'PostgreSQL connection string',
  NEXTAUTH_SECRET: 'NextAuth JWT signing secret',
  NEXTAUTH_URL: 'Public app URL (canonical origin)',
  ENCRYPTION_KEY: 'AES-256-GCM PII encryption key',
  APP_URL: 'Public app URL for redirects/email links',
  // Billing
  STRIPE_SECRET_KEY: 'Stripe secret key',
  STRIPE_WEBHOOK_SECRET: 'Stripe webhook signing secret',
  STRIPE_PRICE_STARTER: 'Stripe price id — Starter tier',
  STRIPE_PRICE_PROFESSIONAL: 'Stripe price id — Professional tier',
  STRIPE_PRICE_BUSINESS: 'Stripe price id — Business tier',
  // Cron
  CRON_API_KEY: 'Shared secret guarding /api/cron/*',
  // AI provider (Gemini). AI_PROVIDER selects the gateway provider;
  // GEMINI_* configure the Gemini implementation.
  AI_PROVIDER: 'AI provider name (gemini)',
  GEMINI_API_KEY: 'Google Gemini API key',
  GEMINI_MODEL: 'Gemini model id (e.g. gemini-3.5-flash)',
}

/**
 * Variables that, if unset, simply disable an optional integration. The app
 * stays healthy; the feature degrades gracefully (dev mode) or is surfaced
 * as unhealthy by /ready (prod mode).
 */
export const OPTIONAL_INTEGRATIONS = {
  storage: () => !!process.env.STORAGE_DRIVER && process.env.STORAGE_DRIVER !== 'local',
  email: () => process.env.EMAIL_DRIVER === 'resend' && !!process.env.RESEND_API_KEY,
  queue: () => !!process.env.INNGEST_EVENT_KEY,
  redis: () => !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN,
  sentry: () => !!process.env.SENTRY_DSN,
  ai: () => {
    const provider = (process.env.AI_PROVIDER || 'gemini').trim()
    return provider === 'gemini' && !!process.env.GEMINI_API_KEY
  },
  r2: () =>
    !!process.env.R2_ACCOUNT_ID &&
    !!process.env.R2_ACCESS_KEY_ID &&
    !!process.env.R2_SECRET_ACCESS_KEY &&
    !!process.env.R2_BUCKET_NAME,
} as const

export type IntegrationKey = keyof typeof OPTIONAL_INTEGRATIONS

let validated = false
let validationError: string | null = null

/**
 * Validate the environment. Called once at boot from instrumentation.ts.
 *
 * - Production: throws if any REQUIRED_IN_PROD var is missing.
 * - Development: collects warnings, logs them, but does not throw.
 *
 * Returns the list of missing vars (empty if all present).
 */
export function validateEnv(): string[] {
  const missing: string[] = []
  for (const [key, label] of Object.entries(REQUIRED_IN_PROD)) {
    if (!process.env[key] || process.env[key]?.trim() === '') {
      missing.push(`${key} (${label})`)
    }
  }

  validated = true

  if (missing.length === 0) {
    validationError = null
    return []
  }

  if (IS_PROD) {
    validationError = `Missing required environment variables: ${missing.join(', ')}`
    // Throw loudly — the process must not start in a misconfigured state.
    throw new Error(`[env] Refusing to boot. ${validationError}`)
  }

  // Development: warn but continue (so local dev without every integration works).
  validationError = null
  console.warn(
    `[env] Missing (ok in dev): ${missing.join(', ')}. These MUST be set before production.`
  )
  return missing
}

/** True if validateEnv() has run without a hard error. */
export function envValidated(): boolean {
  return validated && validationError === null
}

/** Read NODE_ENV flag. */
export const isProduction = IS_PROD
