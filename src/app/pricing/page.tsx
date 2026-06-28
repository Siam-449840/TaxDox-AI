import type { Metadata } from 'next'
import { PricingPage } from '@/components/billing/pricing-page'

export const metadata: Metadata = {
  title: 'Pricing — TaxDox AI',
  description: 'Simple, transparent pricing for accounting firms of all sizes.',
}

export default function Page() {
  return <PricingPage />
}
