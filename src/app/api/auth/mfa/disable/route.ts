import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'
import { verifyTotpCode } from '@/lib/mfa'
import { logger } from '@/lib/logger'

/**
 * POST /api/auth/mfa/disable
 *
 * Disables MFA after verifying the user can produce a valid current code
 * (proves possession of the authenticator). Clears the secret + backup codes.
 */
export async function POST(req: NextRequest) {
  const authz = await requirePermission(null, 'auth:mfa:write', 'user')
  if (authz instanceof NextResponse) return authz
  const { user } = authz

  const body = await req.json()
  const { code } = body as { code?: string }

  if (!code) {
    return NextResponse.json({ error: 'A 6-digit code is required' }, { status: 400 })
  }

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, mfaSecret: true, mfaEnabled: true },
  })

  if (!dbUser || !dbUser.mfaEnabled || !dbUser.mfaSecret) {
    return NextResponse.json({ error: 'MFA is not enabled' }, { status: 400 })
  }

  if (!(await verifyTotpCode(code, dbUser.mfaSecret))) {
    logger.security.warn('MFA disable attempt with invalid code', { userId: user.id })
    return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 401 })
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: null,
    },
  })

  logger.auth.info('MFA disabled', { userId: user.id })
  return NextResponse.json({ disabled: true })
}
