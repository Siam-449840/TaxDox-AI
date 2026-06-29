/**
 * TaxDox AI — Country Plugin Registry (Section 6.1-6.2)
 *
 * Loads all country plugin configs and provides a unified API.
 * Adding a new country = adding a new JSON file in this directory.
 * Zero core-code changes required.
 */

import { createCountryPlugin, type CountryPlugin, type JurisdictionConfig } from './types'

// Import all country configs
import usConfig from './us.json'
import gbConfig from './gb.json'
import caConfig from './ca.json'
import inConfig from './in.json'
import auConfig from './au.json'

// ─── Plugin Registry ──────────────────────────────────────────

const REGISTRY: Map<string, CountryPlugin> = new Map()

function registerPlugin(config: JurisdictionConfig) {
  const plugin = createCountryPlugin(config)
  REGISTRY.set(config.code.toUpperCase(), plugin)
}

// Register all built-in country plugins
registerPlugin(usConfig as JurisdictionConfig)
registerPlugin(gbConfig as JurisdictionConfig)
registerPlugin(caConfig as JurisdictionConfig)
registerPlugin(inConfig as JurisdictionConfig)
registerPlugin(auConfig as JurisdictionConfig)

// ─── Public API ───────────────────────────────────────────────

/**
 * Get a country plugin by country code (US, GB, CA, IN, AU).
 */
export function getCountryPlugin(countryCode: string): CountryPlugin | null {
  return REGISTRY.get(countryCode.toUpperCase()) || null
}

/**
 * Get all registered country plugins.
 */
export function getAllCountryPlugins(): CountryPlugin[] {
  return Array.from(REGISTRY.values())
}

/**
 * Get all supported countries with their support tiers.
 * Used to display the support-tier table to users (Section 10 requirement).
 */
export function getSupportTierTable(): Array<{
  code: string
  name: string
  flag: string
  supportTier: 'full' | 'partial' | 'unsupported'
  supportTierDescription: string
  identifierName: string
  currency: string
}> {
  return getAllCountryPlugins().map((p) => ({
    code: p.config.code,
    name: p.config.name,
    flag: p.config.flag,
    supportTier: p.config.supportTier,
    supportTierDescription: p.config.supportTierDescription,
    identifierName: p.config.identifierName,
    currency: p.config.currency,
  }))
}

/**
 * Validate that a country is supported.
 */
export function isCountrySupported(countryCode: string): boolean {
  return REGISTRY.has(countryCode.toUpperCase())
}

/**
 * Get document types for a specific country.
 */
export function getCountryDocumentTypes(countryCode: string) {
  const plugin = getCountryPlugin(countryCode)
  return plugin ? plugin.getDocumentTypes() : []
}

/**
 * Get filing deadlines for a specific country.
 */
export function getCountryFilingDeadlines(countryCode: string) {
  const plugin = getCountryPlugin(countryCode)
  return plugin ? plugin.getFilingDeadlines() : []
}

/**
 * Validate a tax identifier for a specific country.
 */
export function validateTaxIdentifier(countryCode: string, identifier: string): boolean {
  const plugin = getCountryPlugin(countryCode)
  return plugin ? plugin.validateIdentifier(identifier) : false
}

/**
 * Format a currency amount for a specific country.
 */
export function formatCurrencyForCountry(countryCode: string, amount: number): string {
  const plugin = getCountryPlugin(countryCode)
  return plugin ? plugin.formatCurrency(amount) : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}
