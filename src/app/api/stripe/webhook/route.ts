import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { constructWebhookEvent } from '@/lib/stripe'
import type Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = constructWebhookEvent(body, signature)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Log the event
  console.log(`Stripe webhook: ${event.type} (${event.id})`)

  // ─── Idempotency check ──────────────────────────────────────
  // Stripe will redeliver events on retries. We must not double-process.
  // Check if we've already seen this exact event ID.
  const existingEvent = await db.subscriptionEvent.findFirst({
    where: { stripeEventId: event.id },
    select: { id: true },
  })
  if (existingEvent) {
    console.log(`Webhook event ${event.id} already processed — skipping (idempotent)`)
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const firmId = session.metadata?.firmId
        const tier = session.metadata?.tier

        if (firmId && tier) {
          await db.firm.update({
            where: { id: firmId },
            data: {
              subscriptionTier: tier,
              subscriptionStatus: 'active',
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              trialEndsAt: null,
            },
          })

          await db.subscriptionEvent.create({
            data: {
              firmId,
              eventType: event.type,
              stripeEventId: event.id,
              payload: JSON.stringify(session),
            },
          })
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const firmId = subscription.metadata?.firmId

        if (firmId) {
          const statusMap: Record<string, string> = {
            active: 'active',
            trialing: 'trialing',
            past_due: 'past_due',
            canceled: 'canceled',
            incomplete: 'incomplete',
            incomplete_expired: 'canceled',
            unpaid: 'past_due',
          }

          // Determine tier from price ID using the canonical price map.
          // A missing/unrecognized price is recorded as null rather than
          // silently defaulting to 'starter'.
          const priceId = subscription.items.data[0]?.price?.id
          const tierMap: Record<string, string> = {
            [process.env.STRIPE_PRICE_STARTER ?? '']: 'starter',
            [process.env.STRIPE_PRICE_PROFESSIONAL ?? '']: 'professional',
            [process.env.STRIPE_PRICE_BUSINESS ?? '']: 'business',
          }
          const tier = priceId ? (tierMap[priceId] ?? null) : null

          await db.firm.update({
            where: { id: firmId },
            data: {
              subscriptionStatus: statusMap[subscription.status] || 'incomplete',
              // Only update the tier when we recognized the price; leave the
              // existing tier untouched if the price id is unmapped.
              ...(tier ? { subscriptionTier: tier } : {}),
              stripeSubscriptionId: subscription.id,
              stripePriceId: priceId ?? null,
            },
          })

          await db.subscriptionEvent.create({
            data: {
              firmId,
              eventType: event.type,
              stripeEventId: event.id,
              payload: JSON.stringify(subscription),
            },
          })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const firmId = subscription.metadata?.firmId

        if (firmId) {
          await db.firm.update({
            where: { id: firmId },
            data: {
              subscriptionStatus: 'canceled',
              subscriptionTier: 'starter',
              stripeSubscriptionId: null,
            },
          })

          await db.subscriptionEvent.create({
            data: {
              firmId,
              eventType: event.type,
              stripeEventId: event.id,
              payload: JSON.stringify(subscription),
            },
          })
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        const firm = await db.firm.findFirst({
          where: { stripeCustomerId: customerId },
        })

        if (firm) {
          await db.subscriptionEvent.create({
            data: {
              firmId: firm.id,
              eventType: event.type,
              stripeEventId: event.id,
              payload: JSON.stringify(invoice),
            },
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        const firm = await db.firm.findFirst({
          where: { stripeCustomerId: customerId },
        })

        if (firm) {
          await db.firm.update({
            where: { id: firm.id },
            data: { subscriptionStatus: 'past_due' },
          })

          await db.subscriptionEvent.create({
            data: {
              firmId: firm.id,
              eventType: event.type,
              stripeEventId: event.id,
              payload: JSON.stringify(invoice),
            },
          })
        }
        break
      }

      default:
        // Unhandled event type — log but don't error
        console.log(`Unhandled Stripe event: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}
