import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getStripe, STRIPE_PRICES, type PlanTier } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const { tier } = body as { tier: PlanTier }

    if (!tier || !STRIPE_PRICES[tier]) {
      return NextResponse.json({ error: 'Invalid plan tier' }, { status: 400 })
    }

    const user = session.user as { id: string; firmId: string | null; email: string }
    if (!user.firmId) {
      return NextResponse.json({ error: 'No firm associated with account' }, { status: 403 })
    }

    const firm = await db.firm.findUnique({ where: { id: user.firmId } })
    if (!firm) {
      return NextResponse.json({ error: 'Firm not found' }, { status: 404 })
    }

    const stripe = getStripe()
    const priceId = STRIPE_PRICES[tier]
    const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'

    // Create or reuse Stripe customer
    let customerId = firm.stripeCustomerId

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: firm.name,
        metadata: {
          firmId: firm.id,
          userId: user.id,
        },
      })
      customerId = customer.id
      await db.firm.update({
        where: { id: firm.id },
        data: { stripeCustomerId: customerId },
      })
    }

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/?checkout=success&tier=${tier}`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          firmId: firm.id,
          tier,
        },
        trial_period_days: firm.subscriptionStatus === 'trialing' ? 0 : 14,
      },
      metadata: {
        firmId: firm.id,
        tier,
        userId: user.id,
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
