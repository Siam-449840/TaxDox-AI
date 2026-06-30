/**
 * TaxDox AI — MFA/2FA Utilities (TOTP via otplib v13)
 *
 * Generates TOTP secrets, QR code data URLs, verifies OTP codes, and manages
 * hashed backup codes. The MFA secret stored in the DB is encrypted via
 * `encryptPII()` so it's not recoverable from a DB dump alone.
 *
 * otplib v13 exposes an async API: generate(), verify(), generateSecret(),
 * generateURI().
 */

import * as otplib from 'otplib'
import QRCode from 'qrcode'
import crypto from 'crypto'
import { encryptPII, decryptPII } from '@/lib/encryption'

const BACKUP_CODE_COUNT = 10
const BACKUP_CODE_LENGTH = 8

/**
 * Generate a new TOTP secret and a QR-code data URL for the user to scan.
 */
export async function generateMfaSetup(
  email: string,
  issuer: string = 'TaxDox AI'
) {
  const secret = otplib.generateSecret()

  const otpauth = otplib.generateURI({
    strategy: 'totp',
    issuer,
    label: email,
    secret,
  })
  const qrDataUrl = await QRCode.toDataURL(otpauth, { width: 256, margin: 2 })

  return { secret, qrDataUrl, otpauth }
}

/**
 * Verify a 6-digit TOTP code against a stored (encrypted) secret.
 * Returns true if the code matches within the configured time window.
 */
export async function verifyTotpCode(
  code: string,
  encryptedSecret: string
): Promise<boolean> {
  const secret = decryptPII(encryptedSecret)
  if (!secret) return false

  const cleaned = code.replace(/\s/g, '')
  if (!/^\d{6}$/.test(cleaned)) return false

  try {
    const result = await otplib.verify({ strategy: 'totp', token: cleaned, secret })
    return result.valid
  } catch {
    return false
  }
}

/**
 * Generate backup codes, returning both plaintext (shown to user once) and
 * their hashed form (stored in DB). Hashing uses SHA-256 so raw codes are
 * never stored.
 */
export function generateBackupCodes(): {
  plaintext: string[]
  hashed: string[]
} {
  const plaintext: string[] = []
  const hashed: string[] = []

  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const code = crypto
      .randomBytes(BACKUP_CODE_LENGTH)
      .toString('hex')
      .toUpperCase()
      .slice(0, BACKUP_CODE_LENGTH)
    plaintext.push(code)
    hashed.push(hashBackupCode(code))
  }

  return { plaintext, hashed }
}

/**
 * Verify a backup code against the stored JSON array of hashed codes.
 * Returns the index of the matched code (for removal) or -1 if none match.
 */
export function verifyBackupCode(
  code: string,
  encryptedCodesJson: string
): number {
  const codesJson = decryptPII(encryptedCodesJson)
  if (!codesJson) return -1

  let codes: string[]
  try {
    codes = JSON.parse(codesJson)
  } catch {
    return -1
  }

  const inputHash = hashBackupCode(code.replace(/\s/g, '').toUpperCase())
  const idx = codes.indexOf(inputHash)
  return idx
}

/**
 * Remove a used backup code from the stored list and re-encrypt.
 */
export function removeBackupCode(
  encryptedCodesJson: string,
  index: number
): string {
  const codesJson = decryptPII(encryptedCodesJson)
  if (!codesJson) return encryptedCodesJson

  const codes: string[] = JSON.parse(codesJson)
  codes.splice(index, 1)
  return encryptPII(JSON.stringify(codes))
}

function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}
