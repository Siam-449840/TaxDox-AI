import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'
import { verifyTotpCode, generateBackupCodes } from '@/lib/mfa'
import { encryptPII } from '@/lib/encryption'
import { logger } from '@/lib/logger'

/**
 * POST /api/auth/mfa/verify
 *
 * Confirms MFA setup (called from the settings page after the user scans the
 * QR and enters a code). On success:
 *  - Enables MFA for the account
 *  - Generates 10 backup codes (shown once)
 *  - Returns the backup codes for the user to save
 *
 * MFA verification during SIGN-IN is handled inside NextAuth's authorize()
 * (lib/auth.ts) — it is NOT a public endpoint, so there is no way to bypass
 * MFA by calling a different route.
 */
export async function POST(req: NextRequest) {
  const authz = await requirePermission(null, 'auth:mfa:write', 'user')
  if (authz instanceof NextResponse) return authz
  const { user } = authz

  const body = await req.json()
  const { code } = body as { code?: string }

  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'A 6-digit code is required' }, { status: 400 })
  }

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, mfaSecret: true, mfaEnabled: true },
  })

  if (!dbUser || !dbUser.mfaSecret) {
    return NextResponse.json({ error: 'Setup MFA first' }, { status: 400 })
  }
  if (dbUser.mfaEnabled) {
    return NextResponse.json({ error: 'MFA is already enabled' }, { status: 400 })
  }

  if (!(await verifyTotpCode(code, dbUser.mfaSecret))) {
    logger.security.warn('Invalid MFA setup code', { userId: user.id })
    return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 401 })
  }

  // Generate backup codes.
  const { plaintext: backupCodes, hashed } = generateBackupCodes()

  // Enable MFA and store hashed backup codes.
  await db.user.update({
    where: { id: user.id },
    data: {
      mfaEnabled: true,
      mfaBackupCodes: encryptPII(JSON.stringify(hashed)),
    },
  })

  logger.auth.info('MFA enabled', { userId: user.id })
  return NextResponse.json({
    verified: true,
    backupCodes, // shown to user ONCE — never retrievable again
  })
}
