/**
 * TaxDox AI — Provider Registry (AI Gateway, Phase 1)
 *
 * The registry decouples provider SELECTION (env-driven) from provider
 * IMPLEMENTATION. Each provider self-registers; the gateway looks one up by
 * name. Adding a provider is exactly two changes:
 *
 *   1. implement `AIProvider` in its own module
 *   2. call `registerProvider('openai', () => new OpenAIProvider())` on load
 *
 * No gateway, route, or job code changes.
 *
 * Providers are constructed lazily (factory) so a missing SDK for an unused
 * provider never breaks boot.
 */

import type { AIProvider } from './types'

export type ProviderFactory = () => AIProvider

const registry = new Map<string, ProviderFactory>()
const instances = new Map<string, AIProvider>()

/** Register a provider constructor under `name`. Idempotent. */
export function registerProvider(name: string, factory: ProviderFactory): void {
  registry.set(name, factory)
}

/** Names of all registered providers (for health/debug). */
export function listProviders(): string[] {
  return [...registry.keys()]
}

/**
 * Resolve a provider by name, constructing it on first use. Throws if the name
 * is unknown — this is a fail-loud config error, not a runtime fallback.
 */
export function getProvider(name: string): AIProvider {
  const cached = instances.get(name)
  if (cached) return cached

  const factory = registry.get(name)
  if (!factory) {
    throw new Error(
      `[ai] Unknown AI_PROVIDER "${name}". Registered: ${registry.size ? listProviders().join(', ') : '(none)'}.`
    )
  }
  const instance = factory()
  instances.set(name, instance)
  return instance
}
