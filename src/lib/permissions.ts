/**
 * TaxDox AI — Permission Engine (ADR-006)
 *
 * Single authorization chokepoint. Today it enforces a role matrix; it is
 * deliberately ABAC-shaped (the `ctx` carries attributes like ownership,
 * subscription tier, country) so attribute-based rules can be added later
 * without changing call sites.
 *
 * GOLDEN RULE: `firmId` is ALWAYS taken from the session, never from the
 * request body. That closes the multi-tenant isolation hole where routes
 * trusted `body.firmId`.
 *
 * Usage in a route:
 *   const authz = await requirePermission(req, 'client:write', 'client')
 *   if (authz instanceof NextResponse) return authz   // 401/403
 *   const { user, firmId } = authz
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'

export type Role = 'admin' | 'partner' | 'manager' | 'preparer' | 'read-only'

/** A permission action, e.g. 'client:write'. See docs/api-contracts.md. */
export type Action = string

/** Resource type the action targets, e.g. 'client', 'engagement'. */
export type Resource = string

export interface SessionUser {
  id: string
  email: string
  name?: string
  role: Role
  firmId: string | null
  firmName?: string
  subscriptionTier?: string
  subscriptionStatus?: string
}

export interface AuthzContext {
  /** True if the user owns/created the specific resource (checked by caller). */
  owner?: boolean
  /** Firm subscription tier, for plan-gated features. */
  subscriptionTier?: string
  country?: string
}

export interface AuthzResult {
  user: SessionUser
  firmId: string
}

/**
 * Role → allowed actions map. 'admin'/'partner' are effectively superusers
 * within their firm. 'read-only' can only read. See docs/api-contracts.md
 * for the full matrix.
 *
 * Actions are coarse verbs scoped by resource (e.g. `client:write`,
 * `setting:write`). A role either has the action or it doesn't — ownership
 * narrowing is handled by the caller via `ctx.owner`.
 */
const ROLE_ACTIONS: Record<Role, Action[]> = {
  admin: ['*'],
  partner: ['*'],
  manager: [
    'dashboard:read',
    'client:read',
    'client:write',
    'engagement:read',
    'engagement:write',
    'document:read',
    'document:write',
    'extraction:read',
    'extraction:write',
    'pbc:read',
    'pbc:write',
    'email:read',
    'email:write',
    'report:read',
    'audit:read',
    'message:write',
  ],
  preparer: [
    'dashboard:read',
    'client:read',
    'engagement:read',
    'document:read',
    'document:write',
    'extraction:read',
    'extraction:write',
    'pbc:read',
    'pbc:write',
    'message:write',
    'ai:use',
  ],
  'read-only': [
    'dashboard:read',
    'client:read',
    'engagement:read',
    'document:read',
    'extraction:read',
    'pbc:read',
    'email:read',
    'report:read',
  ],
}

/** Actions reserved for firm admins/partners. */
const ADMIN_ONLY: Action[] = [
  'setting:read',
  'setting:write',
  'billing:write',
  'audit:read',
  'auth:mfa:write',
]

/**
 * Pure decision function. Returns true if `user` may perform `action` on
 * `resource` given the optional attribute `ctx`.
 */
export function can(
  user: SessionUser,
  action: Action,
  _resource: Resource,
  _ctx: AuthzContext = {}
): boolean {
  const allowed = ROLE_ACTIONS[user.role]
  // Superuser wildcard.
  if (allowed.includes('*')) return true
  // Admin-only actions (setting/billing/audit/mfa) are never granted to
  // non-admin roles even if listed — they're explicitly reserved here.
  if (ADMIN_ONLY.includes(action)) return false
  return allowed.includes(action)
}

/**
 * Route helper: resolves the session, asserts the permission, and returns
 * either an `{ user, firmId }` result OR a 401/403 NextResponse the caller
 * must return verbatim.
 *
 * The `req` arg is accepted for symmetry but unused (NextAuth reads cookies
 * from the global request); pass null in non-request contexts.
 */
export async function requirePermission(
  _req: NextRequest | null,
  action: Action,
  resource: Resource,
  ctx: AuthzContext = {}
): Promise<AuthzResult | NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  const user = session.user as SessionUser
  if (!user.firmId) {
    return NextResponse.json(
      { error: 'No firm associated with account' },
      { status: 403 }
    )
  }

  if (!can(user, action, resource, ctx)) {
    logger.security.warn('Permission denied', {
      userId: user.id,
      role: user.role,
      action,
      resource,
    })
    return NextResponse.json(
      { error: 'You do not have permission to perform this action' },
      { status: 403 }
    )
  }

  return { user, firmId: user.firmId }
}
