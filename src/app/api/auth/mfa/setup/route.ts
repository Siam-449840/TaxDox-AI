import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'
import { generateMfaSetup } from '@/lib/mfa'
import { encryptPII } from '@/lib/encryption'
import { logger } from '@/lib/logger'

/**
 * POST /api/auth/mfa/setup
 *
 * Generates a new TOTP secret + QR code. The user scans the QR with their
 * authenticator app, then calls POST /api/auth/mfa/verify to confirm.
 * The secret is NOT activated until verification succeeds.
 */
export async function POST() {
  const authz = await requirePermission(null, 'auth:mfa:write', 'user')
  if (authz instanceof NextResponse) return authz
  const { user } = authz

  try {
    const { secret, qrDataUrl } = await generateMfaSetup(user.email)

    // Store the (encrypted) secret temporarily — MFA stays disabled until
    // the user verifies a code via /verify.
    await db.user.update({
      where: { id: user.id },
      data: {
        mfaSecret: encryptPII(secret),
        mfaEnabled: false, // stays off until verification
      },
    })

    logger.auth.info('MFA setup initiated', { userId: user.id })
    return NextResponse.json({
      qrDataUrl,
      secret, // shown to user for manual entry
    })
  } catch (error) {
    logger.auth.error('MFA setup failed', { userId: user.id, error: String(error) })
    return NextResponse.json({ error: 'Failed to setup MFA' }, { status: 500 })
  }
}
