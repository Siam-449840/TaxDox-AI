import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  firmId: string | null
  firmName?: string
  subscriptionTier?: string
  subscriptionStatus?: string
}

/**
 * Get the authenticated user from the current request.
 * Returns null if not authenticated.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  return session.user as AuthUser
}

/**
 * Require authentication. Returns the user or a 401 response.
 */
export async function requireAuth(): Promise<AuthUser | NextResponse> {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  return user
}

/**
 * Require a specific role. Returns the user or a 403 response.
 */
export async function requireRole(
  ...roles: string[]
): Promise<AuthUser | NextResponse> {
  const result = await requireAuth()
  if (result instanceof NextResponse) return result

  if (!roles.includes(result.role)) {
    return NextResponse.json(
      { error: 'You do not have permission to perform this action' },
      { status: 403 }
    )
  }
  return result
}

/**
 * Get the firm ID for the current user, or a 403 response if no firm.
 */
export async function requireFirm(): Promise<
  { user: AuthUser; firmId: string } | NextResponse
> {
  const result = await requireAuth()
  if (result instanceof NextResponse) return result

  if (!result.firmId) {
    return NextResponse.json(
      { error: 'No firm associated with this account' },
      { status: 403 }
    )
  }
  return { user: result, firmId: result.firmId }
}

/**
 * Check if the current user's firm has an active subscription.
 * Returns true if trialing or active, false if past_due/canceled.
 */
export async function hasActiveSubscription(): Promise<boolean> {
  const user = await getAuthUser()
  if (!user?.firmId) return false

  const firm = await db.firm.findUnique({
    where: { id: user.firmId },
    select: { subscriptionStatus: true, trialEndsAt: true },
  })

  if (!firm) return false

  // Trial still active
  if (
    firm.subscriptionStatus === 'trialing' &&
    firm.trialEndsAt &&
    firm.trialEndsAt > new Date()
  ) {
    return true
  }

  return ['active', 'trialing'].includes(firm.subscriptionStatus)
}
