/**
 * TaxDox AI — Input Validation Schemas (Section 4.4)
 *
 * Zod schemas for every API route input.
 * MIME type check, not just extension; max size; sanitize filename.
 */

import { z } from 'zod'

// ─── Auth Schemas ─────────────────────────────────────────────

export const signInSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
})

export const signUpSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email format').toLowerCase(),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain a digit')
    .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
  firmName: z.string().min(2, 'Firm name is required').max(200),
  country: z.enum(['US', 'UK', 'CA', 'IN', 'AU']).default('US'),
})

// ─── Client Schemas ───────────────────────────────────────────

export const createClientSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email().toLowerCase(),
  phone: z.string().max(30).optional(),
  taxId: z.string().max(30).optional(), // will be encrypted
  clientType: z.enum(['individual', 'business', 'trust', 'nonprofit']),
  status: z.enum(['active', 'inactive', 'prospect']).default('active'),
  country: z.enum(['US', 'UK', 'CA', 'IN', 'AU']).default('US'),
})

// ─── Engagement Schemas ───────────────────────────────────────

export const createEngagementSchema = z.object({
  clientId: z.string().cuid(),
  taxYear: z.number().int().min(2020).max(2030),
  engagementType: z.enum(['1040', '1065', '1120', '1120S', '1041']),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  fee: z.number().min(0).max(10000000).default(0),
  deadline: z.string().datetime().optional(),
  assignedToId: z.string().cuid().optional(),
  notes: z.string().max(2000).optional(),
})

// ─── Document Upload Schema ───────────────────────────────────

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/tiff',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
] as const

export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB per guideline

export const documentUploadSchema = z.object({
  clientId: z.string().cuid(),
  engagementId: z.string().cuid().optional(),
  pbcItemId: z.string().cuid().optional(),
  uploadedBy: z.enum(['client', 'user']).default('user'),
})

// ─── Email Schema ─────────────────────────────────────────────

export const sendEmailSchema = z.object({
  engagementId: z.string().cuid().optional(),
  clientId: z.string().cuid().optional(),
  toEmail: z.string().email(),
  toName: z.string().min(1).max(200),
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(50000),
  template: z.enum([
    'custom',
    'pbc_request',
    'deadline_reminder',
    'document_received',
    'extraction_complete',
    'welcome',
  ]),
})

// ─── Sanitization ─────────────────────────────────────────────

/**
 * Sanitize a filename to prevent path traversal and special character issues.
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // only allow safe chars
    .replace(/\.{2,}/g, '.') // no double dots (path traversal)
    .slice(0, 255) // max length
}

/**
 * Validate MIME type against allowlist (not just extension).
 */
export function validateMimeType(mimeType: string): boolean {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)
}
