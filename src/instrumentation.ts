/**
 * TaxDox AI — Boot-time instrumentation hook.
 *
 * Next.js runs `register()` once per server start, before any request is
 * handled. This is the correct place to fail loud on a misconfigured
 * environment (ADR-009): if a required secret is missing in production we
 * crash here rather than serving requests in a half-broken, insecure state.
 *
 * In development we only warn, so `bun dev` works without every integration.
 */

export async function register() {
  // Validate environment before anything else.
  const { validateEnv } = await import('@/lib/env')
  validateEnv()

  // Initialize Sentry when configured. The config files are added in a later
  // phase; until then this is a no-op guarded by a dynamic import so the app
  // boots fine without them.
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.SENTRY_DSN) {
    try {
      await import('../sentry.server.config')
    } catch {
      // Sentry config not present yet — skip silently.
    }
  }
}
