import Stripe from 'stripe'

// Lazy-initialized Stripe client
let stripeInstance: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    stripeInstance = new Stripe(key, {
      apiVersion: '2026-06-24.dahlia',
      typescript: true,
    })
  }
  return stripeInstance
}

// Price IDs for each tier — MUST be configured in the Stripe dashboard and set
// via env. No placeholder fallback: a missing price must surface as an error
// rather than silently charging an invalid price.
export const STRIPE_PRICES = {
  starter: process.env.STRIPE_PRICE_STARTER,
  professional: process.env.STRIPE_PRICE_PROFESSIONAL,
  business: process.env.STRIPE_PRICE_BUSINESS,
} as const

/**
 * Resolve a tier to its price id, throwing a clear error if unconfigured.
 * Call sites that already validate the tier should use this instead of the
 * raw map so misconfiguration fails loudly at the point of use.
 */
export function requirePriceId(tier: PlanTier): string {
  const id = STRIPE_PRICES[tier]
  if (!id) {
    throw new Error(
      `STRIPE_PRICE_${tier.toUpperCase()} is not configured. Set it in the environment.`
    )
  }
  return id
}

export type PlanTier = keyof typeof STRIPE_PRICES

// Tier configuration with Stripe prices
export const PLAN_CONFIG = {
  starter: {
    name: 'Starter',
    price: 99,
    priceId: STRIPE_PRICES.starter,
    docsPerMonth: 50,
    features: ['Basic AI extraction', 'Email support', '5 clients', 'CSV export'],
  },
  professional: {
    name: 'Professional',
    price: 299,
    priceId: STRIPE_PRICES.professional,
    docsPerMonth: 200,
    features: [
      'Full AI extraction (Gemini 3.5 Flash)',
      'All tax software integrations',
      'Priority support',
      '25 clients',
      'Excel + CSV export',
      'Workflow automation',
    ],
  },
  business: {
    name: 'Business',
    price: 799,
    priceId: STRIPE_PRICES.business,
    docsPerMonth: 1000,
    features: [
      'Workflow automation',
      'Reporting & analytics',
      'Dedicated support',
      '100 clients',
      'API access',
      'Custom templates',
    ],
  },
} as const

/**
 * Verify a Stripe webhook signature and construct the event.
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set')
  }
  return getStripe().webhooks.constructEvent(
    payload,
    signature,
    secret
  )
}
