import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'
import { MAX_FILE_SIZE, validateMimeType } from '@/lib/validation'
import { getObjectStore, generateKey } from '@/lib/object-store'
import { logger } from '@/lib/logger'
import { isQueueEnabled, getInngest, EVENTS } from '@/inngest/client'
import { runExtraction } from '@/lib/jobs/extraction'
import { getIdempotentResult, storeIdempotentResult } from '@/lib/idempotency'
import { z } from 'zod'

const uploadMetaSchema = z.object({
  clientId: z.string().min(1, 'clientId cannot be empty'),
  engagementId: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : val),
    z.string().min(1).nullable().optional()
  ),
  pbcItemId: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : val),
    z.string().min(1).nullable().optional()
  ),
  uploadedBy: z.enum(['client', 'user']).default('user'),
})

export async function POST(req: NextRequest) {
  try {
    // Idempotency replay
    const idem = await getIdempotentResult(req)
    if (idem.hit) {
      return NextResponse.json(idem.body, { status: idem.status })
    }

    const authz = await requirePermission(req, 'document:write', 'document')
    if (authz instanceof NextResponse) return authz
    const { firmId } = authz

    let formData: FormData
    try {
      formData = await req.formData()
    } catch (e) {
      logger.document.error('Failed to parse multipart form data', { error: String(e) })
      return NextResponse.json({ error: 'Failed to parse form data' }, { status: 400 })
    }

    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate MIME type
    if (!validateMimeType(file.type)) {
      return NextResponse.json(
        { error: `File type ${file.type} is not supported. Allowed: PDF, JPEG, PNG, TIFF, WebP, Excel, CSV, Word` },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 50MB limit' },
        { status: 400 }
      )
    }

    const rawClientId = formData.get('clientId')
    const rawEngagementId = formData.get('engagementId')
    const rawPbcItemId = formData.get('pbcItemId')
    const rawUploadedBy = formData.get('uploadedBy')

    const meta = uploadMetaSchema.safeParse({
      clientId: rawClientId,
      engagementId: rawEngagementId,
      pbcItemId: rawPbcItemId,
      uploadedBy: rawUploadedBy,
    })

    if (!meta.success) {
      const missingFields: string[] = []
      const invalidTypes: { field: string; expected: string; received: string }[] = []

      meta.error.issues.forEach((issue) => {
        const path = issue.path.join('.')
        const received = 'received' in issue ? String(issue.received) : 'unknown'
        if (issue.code === 'invalid_type' && received === 'undefined') {
          missingFields.push(path)
        } else {
          invalidTypes.push({
            field: path,
            expected: 'expected' in issue ? String(issue.expected) : 'valid value',
            received,
          })
        }
      })

      const receivedKeys = Array.from(formData.keys()).filter((k) => k !== 'file')

      logger.document.warn('Metadata validation failed', {
        missingFields,
        invalidTypes,
        receivedKeys,
      })

      return NextResponse.json(
        {
          error: 'Invalid upload metadata',
          missingFields,
          invalidTypes,
          receivedKeys,
        },
        { status: 400 }
      )
    }

    const data = meta.data

    // Tenant check
    try {
      const owningClient = await db.client.findFirst({
        where: { id: data.clientId, firmId },
        select: { id: true },
      })
      if (!owningClient) {
        return NextResponse.json(
          { error: 'Client not found in your firm' },
          { status: 404 }
        )
      }

      if (data.engagementId) {
        const owningEngagement = await db.engagement.findFirst({
          where: { id: data.engagementId, firmId, clientId: data.clientId },
          select: { id: true },
        })
        if (!owningEngagement) {
          return NextResponse.json(
            { error: 'Engagement not found in your firm' },
            { status: 404 }
          )
        }
      }

      if (data.pbcItemId) {
        const owningPbcItem = await db.pbcItem.findFirst({
          where: {
            id: data.pbcItemId,
            pbcList: { engagement: { firmId, clientId: data.clientId } },
          },
          select: { id: true },
        })
        if (!owningPbcItem) {
          return NextResponse.json(
            { error: 'PBC item not found in your firm' },
            { status: 404 }
          )
        }
      }
    } catch (e) {
      logger.document.error('Tenant verification failed', { error: String(e), stack: e instanceof Error ? e.stack : undefined })
      return NextResponse.json({ error: 'Tenant verification failed' }, { status: 500 })
    }

    // Read file buffer
    let buffer: Buffer
    try {
      buffer = Buffer.from(await file.arrayBuffer())
    } catch (e) {
      logger.document.error('Failed to read file buffer', { error: String(e) })
      return NextResponse.json({ error: 'Failed to read file data' }, { status: 400 })
    }

    // Write file to storage
    let stored: any
    const store = getObjectStore()
    const storageKey = generateKey(file.name)
    try {
      stored = await store.put(storageKey, buffer, {
        contentType: file.type,
        originalName: file.name,
      })
    } catch (e) {
      logger.document.error('Storage write failed', { error: String(e), stack: e instanceof Error ? e.stack : undefined })
      return NextResponse.json({ error: 'Storage write failed' }, { status: 500 })
    }

    // Insert Document & Activity atomically in DB
    let document: any
    try {
      document = await db.$transaction(async (tx) => {
        const doc = await tx.document.create({
          data: {
            clientId: data.clientId,
            engagementId: data.engagementId || undefined,
            pbcItemId: data.pbcItemId || undefined,
            originalFilename: file.name,
            storedFilename: stored.key,
            fileSize: file.size,
            mimeType: file.type,
            status: 'uploaded',
            uploadedBy: data.uploadedBy,
          },
        })

        await tx.activity.create({
          data: {
            engagementId: data.engagementId || undefined,
            documentId: doc.id,
            type: 'upload',
            description: `${data.uploadedBy === 'client' ? 'Client' : 'User'} uploaded document (${formatFileSize(file.size)})`,
            actor: data.uploadedBy === 'client' ? 'Client' : 'You',
          },
        })

        return doc
      })
    } catch (e) {
      // Storage rollback only if database insertion fails
      try {
        await store.delete(stored.key)
        logger.document.warn('Rolled back orphaned storage file after database failure', { key: stored.key })
      } catch (cleanupError) {
        logger.document.error('Failed to clean up orphaned storage file', { key: stored.key, error: String(cleanupError) })
      }

      logger.document.error('Database insert failed', { error: String(e), stack: e instanceof Error ? e.stack : undefined })
      return NextResponse.json({ error: 'Database insert failed' }, { status: 500 })
    }

    logger.document.info('Document uploaded successfully', {
      documentId: document.id,
      storageKey: stored.key,
      mimeType: file.type,
      size: file.size,
    })

    // AI Ingestion Trigger
    let jobId: string | undefined
    try {
      if (isQueueEnabled()) {
        await getInngest().send({
          name: EVENTS.extractionRequested,
          data: { documentId: document.id },
        })
        jobId = document.id
        logger.ai.info('Extraction enqueued', { documentId: document.id })
      } else {
        runExtraction(document.id).catch((e) =>
          logger.ai.error('Inline extraction failed', { documentId: document.id, error: String(e) })
        )
      }
    } catch (queueError) {
      logger.ai.error('Failed to queue extraction', { documentId: document.id, error: String(queueError) })
    }

    const responseBody = {
      document,
      jobId,
      status: isQueueEnabled() ? 'queued' : 'processing',
      storedFilename: stored.key,
      fileSize: file.size,
      mimeType: file.type,
      message: 'File uploaded successfully',
    }

    await storeIdempotentResult(req, responseBody, 201)

    return NextResponse.json(responseBody, { status: 201 })
  } catch (error) {
    logger.document.error('Unexpected upload route error', { error: String(error), stack: error instanceof Error ? error.stack : undefined })
    return NextResponse.json(
      { error: 'An unexpected error occurred during upload' },
      { status: 500 }
    )
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
