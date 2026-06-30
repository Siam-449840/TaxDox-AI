/**
 * TaxDox AI — Canonical URL resolution.
 *
 * Centralizes how the public app origin is determined, so redirect URLs
 * (Stripe checkout/portal, email links) can never accidentally fall back to
 * localhost in production. In production, APP_URL/NEXTAUTH_URL MUST be set
 * (enforced by validateEnv()); here we resolve the first defined value and
 * throw if none is configured when running in prod.
 */

const isProd = process.env.NODE_ENV === 'production'

function rawAppUrl(): string | undefined {
  return process.env.APP_URL || process.env.NEXTAUTH_URL
}

/**
 * Resolved public app URL, with no trailing slash.
 * - Production: throws if unset (defend in depth — validateEnv() guards boot).
 * - Dev: defaults to http://localhost:3000.
 */
export const appUrl: string = (() => {
  const raw = rawAppUrl()
  if (raw) return raw.replace(/\/+$/, '')
  if (isProd) {
    throw new Error('[urls] APP_URL/NEXTAUTH_URL must be set in production.')
  }
  return 'http://localhost:3000'
})()
