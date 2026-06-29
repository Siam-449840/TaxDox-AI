import { NextResponse } from 'next/server'
import { getSupportTierTable, getAllCountryPlugins } from '@/lib/tax-plugins/registry'

/**
 * GET /api/tax-plugins
 *
 * Returns all country plugin information including support tiers.
 * This endpoint powers the support-tier table visible to users (Section 10).
 */
export async function GET() {
  return NextResponse.json({
    countries: getSupportTierTable(),
    plugins: getAllCountryPlugins().map((p) => ({
      code: p.config.code,
      name: p.config.name,
      flag: p.config.flag,
      taxYearLabel: p.config.taxYearLabel,
      currency: p.config.currency,
      currencySymbol: p.config.currencySymbol,
      locale: p.config.locale,
      identifierName: p.config.identifierName,
      supportTier: p.config.supportTier,
      supportTierDescription: p.config.supportTierDescription,
      filingDeadlines: p.config.filingDeadlines,
      documentTypes: p.config.documentTypes.map((dt) => ({
        type: dt.type,
        label: dt.label,
        category: dt.category,
        description: dt.description,
        fieldCount: dt.fields.length,
      })),
      taxBrackets: p.config.taxBrackets,
      standardDeduction: p.config.standardDeduction,
      keyCredits: p.config.keyCredits,
      keyLimits: p.config.keyLimits,
      taxSoftware: p.config.taxSoftware,
    })),
  })
}
