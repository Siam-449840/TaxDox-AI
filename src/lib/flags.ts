/**
 * TaxDox AI — Feature Flags (Phase 5.3)
 *
 * Thin layer over a key→value store (Vercel Edge Config in prod, env vars +
 * process-local defaults in dev). Used to gate the MFA-enforcement rollout,
 * canary features, and plan-gated functionality without redeploying.
 *
 * Roadmap: swap `EdgeConfigStore` in for `EnvStore` when @vercel/edge-config
 * is added; the `isEnabled()` contract stays identical.
 */

import { logger } from '@/lib/logger'

export type FlagKey =
  | 'mfa.enforce' // require MFA for all accounts (vs. optional)
  | 'extraction.queue' // route extraction through Inngest (vs. inline)
  | 'billing.require' // block app access without an active subscription
  | 'canary.newDashboard' // canary UI

const DEFAULTS: Record<FlagKey, boolean> = {
  'mfa.enforce': false,
  'extraction.queue': false,
  'billing.require': true,
  'canary.newDashboard': false,
}

/**
 * Resolve a flag. Resolution order:
 *   1. Env override (FLAG_<key>=1|0) — useful for staging canaries.
 *   2. Code default.
 *
 * Edge Config integration is additive: if EDGE_CONFIG is bound, read it first
 * here without changing call sites.
 */
export function isEnabled(flag: FlagKey): boolean {
  const envKey = `FLAG_${flag.replace(/\./g, '_').toUpperCase()}`
  const raw = process.env[envKey]
  if (raw === '1' || raw === 'true') return true
  if (raw === '0' || raw === 'false') return false
  return DEFAULTS[flag] ?? false
}

/**
 * Contextual check — for attribute-gated flags (e.g. enable a feature only for
 * a specific firm or role). Today this just wraps `isEnabled`; it's shaped so
 * ABAC rules can slot in later (see ADR-006).
 */
export function isEnabledFor(
  flag: FlagKey,
  _ctx: { firmId?: string; role?: string; plan?: string } = {}
): boolean {
  // Example future rule:
  //   if (flag === 'canary.newDashboard' && ctx.firmId === 'firm_canary') return true
  return isEnabled(flag)
}

/**
 * Snapshot all flags for /admin or debugging. Never expose secrets.
 */
export function flagSnapshot(): Record<FlagKey, boolean> {
  const out = {} as Record<FlagKey, boolean>
  for (const key of Object.keys(DEFAULTS) as FlagKey[]) {
    out[key] = isEnabled(key)
  }
  if (process.env.NODE_ENV !== 'production') {
    logger.system.debug('Flag snapshot', { flags: out })
  }
  return out
}
