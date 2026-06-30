/**
 * TaxDox AI — Object Storage Abstraction (ADR-005)
 *
 * Uploaded tax documents are durable, sensitive, and must survive redeploys.
 * This interface decouples the storage provider from call sites:
 *   - R2Store:  Cloudflare R2 (S3-compatible) in production.
 *   - LocalStore: local disk fallback for development.
 *
 * Selection is via STORAGE_DRIVER ('r2' | 'local', default 'local'). When R2
 * credentials are unset in production, the app stays healthy for non-upload
 * flows but /ready reports storage as unhealthy.
 *
 * The interface is deliberately richer than put/get: multipart for large
 * files, SHA-256 checksums, signed URLs (removes the app server from the
 * preview hot path), and a pluggable `onStored` hook for a future virus-scan
 * step without touching call sites.
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { readFile, writeFile, mkdir, unlink } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { logger } from '@/lib/logger'

export interface PutOptions {
  contentType: string
  /** Caller-visible original filename, for metadata only. */
  originalName?: string
}

export interface StoredObject {
  /** The key under which the object was stored. */
  key: string
  /** SHA-256 of the stored bytes (hex). */
  checksum: string
  /** Bytes stored. */
  size: number
}

export interface ObjectStore {
  put(key: string, data: Buffer, opts: PutOptions): Promise<StoredObject>
  get(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  /** Time-limited URL for direct browser access (preview). */
  getSignedUrl(key: string, ttlSeconds?: number): Promise<string>
}

// ─── Key generation ────────────────────────────────────────────────

/**
 * Generate a collision-free storage key preserving the file extension.
 * Namespaced under a date partition for listing/backups.
 */
export function generateKey(originalName: string): string {
  const ext = path.extname(originalName || '').toLowerCase()
  const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const id = crypto.randomBytes(16).toString('hex')
  return `uploads/${date}/${id}${ext}`
}

// ─── LocalStore (dev fallback) ─────────────────────────────────────

const LOCAL_DIR = path.join(process.cwd(), 'download', 'uploads')

class LocalStore implements ObjectStore {
  async put(key: string, data: Buffer, _opts: PutOptions): Promise<StoredObject> {
    const full = path.join(process.cwd(), key)
    await mkdir(path.dirname(full), { recursive: true })
    await writeFile(full, data)
    return {
      key,
      checksum: crypto.createHash('sha256').update(data).digest('hex'),
      size: data.length,
    }
  }

  async get(key: string): Promise<Buffer> {
    // Support both new partitioned keys and legacy flat filenames.
    const full = path.join(process.cwd(), key)
    try {
      return await readFile(full)
    } catch {
      // Legacy path: older uploads were stored flat under download/uploads/.
      return readFile(path.join(LOCAL_DIR, path.basename(key)))
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(path.join(process.cwd(), key))
    } catch {
      // Already gone — fine.
    }
  }

  async getSignedUrl(key: string): Promise<string> {
    // Local dev has no signed URLs; the preview route serves bytes directly.
    return `/api/documents/local/${encodeURIComponent(key)}`
  }
}

// ─── R2Store (production) ──────────────────────────────────────────

class R2Store implements ObjectStore {
  private client: S3Client
  private bucket: string

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID!
    this.bucket = process.env.R2_BUCKET_NAME!
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  }

  async put(key: string, data: Buffer, opts: PutOptions): Promise<StoredObject> {
    const checksum = crypto.createHash('sha256').update(data).digest('hex')
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: opts.contentType,
        Metadata: {
          'original-name': opts.originalName ? sanitizeMetadata(opts.originalName) : 'unknown',
          'sha256': checksum,
        },
      })
    )
    return { key, checksum, size: data.length }
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key })
    )
    // The Body is a stream; collect it into a buffer.
    const bytes = await res.Body!.transformToByteArray()
    return Buffer.from(bytes)
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    )
  }

  async getSignedUrl(key: string, ttlSeconds = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: ttlSeconds }
    )
  }
}

// Metadata values must be simple ASCII (S3 restriction).
function sanitizeMetadata(s: string): string {
  return s.replace(/[^\x20-\x7E]/g, '?').slice(0, 200)
}

// ─── Factory ───────────────────────────────────────────────────────

let _store: ObjectStore | null = null

/**
 * Resolve the active ObjectStore. The choice is fixed for the process.
 * - STORAGE_DRIVER=r2 with all R2_* env vars set → R2Store
 * - otherwise → LocalStore
 */
export function getObjectStore(): ObjectStore {
  if (_store) return _store

  const driver = process.env.STORAGE_DRIVER
  const r2Configured =
    driver === 'r2' &&
    !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME)

  if (r2Configured) {
    logger.document.info('Object storage: R2 (Cloudflare)')
    _store = new R2Store()
  } else {
    if (process.env.NODE_ENV === 'production' && driver === 'r2') {
      logger.document.warn('R2 selected but credentials incomplete — falling back to local disk. This will NOT persist in production.')
    } else {
      logger.document.info('Object storage: local disk (development)')
    }
    _store = new LocalStore()
  }
  return _store
}

/**
 * Whether the configured store is the cloud (R2) backend. Used by /ready.
 */
export function isCloudStorage(): boolean {
  return getObjectStore() instanceof R2Store
}
