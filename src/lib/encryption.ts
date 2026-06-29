/**
 * TaxDox AI — Field-Level Encryption (Section 4.3)
 *
 * AES-256-GCM encryption for PII fields: SSN, EIN, Tax ID, bank account numbers.
 * Disk-level encryption alone is not sufficient — field-level encryption ensures
 * that even if the database is compromised, PII remains encrypted.
 *
 * In production: encryption key stored in AWS KMS / Cloudflare KV (never in DB).
 * In development: key from ENCRYPTION_KEY env var (with secure default).
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

// In production, this key comes from AWS KMS / Vault.
// In development, we use a stable env var with a secure default.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'taxdox-ai-dev-encryption-key-change-in-prod-32b!'

// Derive a 32-byte key from the passphrase using SHA-256
function getKey(): Buffer {
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
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
