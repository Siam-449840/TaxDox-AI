import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = session.user as { firmId: string | null }
    if (!user.firmId) {
      return NextResponse.json({ error: 'No firm found' }, { status: 403 })
    }

    const firm = await db.firm.findUnique({
      where: { id: user.firmId },
      select: {
        id: true,
        name: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    })

    if (!firm) {
      return NextResponse.json({ error: 'Firm not found' }, { status: 404 })
    }

    // Count this month's documents for usage tracking
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const documentsThisMonth = await db.document.count({
      where: {
        engagement: { firmId: firm.id },
        uploadedAt: { gte: startOfMonth },
      },
    })

    const clientCount = await db.client.count({
      where: { firmId: firm.id },
    })

    const userCount = await db.user.count({
      where: { firmId: firm.id },
    })

    // Calculate trial days remaining
    let trialDaysRemaining: number | null = null
    if (firm.trialEndsAt && firm.subscriptionStatus === 'trialing') {
      const diff = firm.trialEndsAt.getTime() - Date.now()
      trialDaysRemaining = Math.max(0, Math.ceil(diff / 86400000))
    }

    return NextResponse.json({
      firm: {
        ...firm,
        trialDaysRemaining,
      },
      usage: {
        documentsThisMonth,
        clientCount,
        userCount,
      },
    })
  } catch (error) {
    console.error('Subscription status error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription status' },
      { status: 500 }
    )
  }
}
