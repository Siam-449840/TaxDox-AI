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
      apiVersion: '2024-12-18.acacia',
      typescript: true,
    })
  }
  return stripeInstance
}

// Price IDs for each tier — configured in Stripe dashboard
export const STRIPE_PRICES = {
  starter: process.env.STRIPE_PRICE_STARTER || 'price_starter',
  professional: process.env.STRIPE_PRICE_PROFESSIONAL || 'price_professional',
  business: process.env.STRIPE_PRICE_BUSINESS || 'price_business',
} as const

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
      'Full AI extraction (GLM-4.6V)',
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
