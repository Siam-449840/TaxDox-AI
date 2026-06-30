import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { appUrl } from '@/lib/urls'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = session.user as { firmId: string | null }
    if (!user.firmId) {
      return NextResponse.json({ error: 'No firm found' }, { status: 403 })
    }

    const firm = await db.firm.findUnique({ where: { id: user.firmId } })
    if (!firm?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No billing account found. Please subscribe first.' },
        { status: 400 }
      )
    }

    const stripe = getStripe()

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: firm.stripeCustomerId,
      return_url: `${appUrl}/`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    console.error('Billing portal error:', error)
    return NextResponse.json(
      { error: 'Failed to open billing portal' },
      { status: 500 }
    )
  }
}
