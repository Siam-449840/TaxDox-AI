/**
 * TaxDox AI — Field-Level Encryption (Section 4.3)
 *
 * AES-256-GCM encryption for PII fields: SSN, EIN, Tax ID, bank account numbers.
 * Disk-level encryption alone is not sufficient — field-level encryption ensures
 * that even if the database is compromised, PII remains encrypted.
 *
 * In production: the key MUST come from ENCRYPTION_KEY (validated at boot by
 * validateEnv()); there is no secure default. In development only, a dev-only
 * fallback key is used so local work doesn't require a configured secret.
 *
 * Usage:
 *   import { encryptPII, decryptPII, maskPII } from '@/lib/encryption'
 *
 *   const encrypted = encryptPII('123-45-6789')  // store in DB
 *   const plain = decryptPII(encrypted)            // when needed
 *   const masked = maskPII('123-45-6789')          // '***-**-6789' for display
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16

// The PII encryption key MUST be provided via ENCRYPTION_KEY. There is no
// secure default: a publicly-known key would let anyone with DB access
// decrypt every SSN/EIN. We resolve lazily so validateEnv() (boot) gets the
// chance to fail loud first; calls here hard-error if the key is missing in
// production, and fall back to a dev-only key otherwise.
const DEV_FALLBACK_KEY = 'taxdox-dev-only-encryption-key-DO-NOT-USE-IN-PROD-32b!'
const isProd = process.env.NODE_ENV === 'production'

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw || raw.trim() === '') {
    if (isProd) {
      // Should never reach here — validateEnv() blocks boot — but defend in depth.
      throw new Error('[encryption] ENCRYPTION_KEY is required in production.')
    }
    console.warn('[encryption] ENCRYPTION_KEY unset — using dev-only key. NEVER use in production.')
    return crypto.createHash('sha256').update(DEV_FALLBACK_KEY).digest()
  }
  return crypto.createHash('sha256').update(raw).digest()
}

/**
 * Encrypt a PII value using AES-256-GCM.
 * Returns a base64 string containing IV + ciphertext + auth tag.
 */
export function encryptPII(plaintext: string): string {
  if (!plaintext) return ''
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  // Format: base64(iv + tag + ciphertext)
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

/**
 * Decrypt a PII value encrypted by encryptPII.
 */
export function decryptPII(encryptedValue: string): string {
  if (!encryptedValue) return ''
  try {
    const data = Buffer.from(encryptedValue, 'base64')
    const iv = data.subarray(0, IV_LENGTH)
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH)
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ])
    return decrypted.toString('utf8')
  } catch {
    // If decryption fails, the value might be plaintext (pre-encryption data)
    // Return the original to avoid breaking existing flows
    return encryptedValue
  }
}

/**
 * Mask a PII value for display: show only last 4 characters.
 * SSN: 123-45-6789 → ***-**-6789
 * EIN: 12-3456789 → **-***6789
 */
export function maskPII(value: string): string {
  if (!value) return ''
  // If it looks like an SSN (xxx-xx-xxxx), mask the first 5 digits
  if (/^\d{3}-\d{2}-\d{4}$/.test(value)) {
    return '***-**-' + value.slice(-4)
  }
  // If it looks like an EIN (xx-xxxxxxx), mask the first 2 digits
  if (/^\d{2}-\d{7}$/.test(value)) {
    return '**-***' + value.slice(-4)
  }
  // Generic: show last 4, mask the rest
  if (value.length <= 4) return '****'
  return '****' + value.slice(-4)
}

/**
 * Check if a value appears to be encrypted (base64 with correct length).
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false
  try {
    const data = Buffer.from(value, 'base64')
    return data.length > IV_LENGTH + TAG_LENGTH
  } catch {
    return false
  }
}
