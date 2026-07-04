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
  clientId: z.string().min(1),
  // formData.get() returns `null` for absent fields; `.nullish()` accepts both
  // null and undefined so an upload without these optional ids validates.
  engagementId: z.string().min(1).nullish(),
  pbcItemId: z.string().min(1).nullish(),
  uploadedBy: z.enum(['client', 'user']).default('user'),
})

export async function POST(req: NextRequest) {
  try {
    // Idempotency replay: if the client retries an upload with the same
    // Idempotency-Key, return the original result instead of re-uploading.
    const idem = await getIdempotentResult(req)
    if (idem.hit) {
      return NextResponse.json(idem.body, { status: idem.status })
    }

    const authz = await requirePermission(req, 'document:write', 'document')
    if (authz instanceof NextResponse) return authz
    const { firmId } = authz

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const clientId = (formData.get('clientId') as string | null) ?? ''
    const engagementId = formData.get('engagementId') as string | null
    const pbcItemId = formData.get('pbcItemId') as string | null
    const uploadedBy = (formData.get('uploadedBy') as string) || 'user'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const meta = uploadMetaSchema.safeParse({ clientId, engagementId, pbcItemId, uploadedBy })
    if (!meta.success) {
      return NextResponse.json(
        { error: 'Invalid upload metadata', details: meta.error.flatten() },
        { status: 400 }
      )
    }
    const data = meta.data

    // Validate MIME type (not just extension)
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

    // ── Tenant guard: the client must belong to this firm before we attach
    // a document to it. Prevents cross-firm uploads.
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

    // ── Store the file via the ObjectStore abstraction (R2 in prod, local
    // disk in dev). The returned key is what we persist.
    const buffer = Buffer.from(await file.arrayBuffer())
    const store = getObjectStore()
    const storageKey = generateKey(file.name)
    const stored = await store.put(storageKey, buffer, {
      contentType: file.type,
      originalName: file.name,
    })

    // Create document record
    const document = await db.document.create({
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

    // Log activity
    await db.activity.create({
      data: {
        engagementId: data.engagementId || undefined,
        documentId: document.id,
        type: 'upload',
        description: `${data.uploadedBy === 'client' ? 'Client' : 'User'} uploaded ${file.name} (${formatFileSize(file.size)})`,
        actor: data.uploadedBy === 'client' ? 'Client' : 'You',
      },
    })

    logger.document.info('Document uploaded', {
      documentId: document.id,
      storageKey: stored.key,
      checksum: stored.checksum.slice(0, 12),
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    })

    // ── Kick off AI extraction ──────────────────────────────────────
    // Production: enqueue an Inngest event (returns immediately, processed
    // async with retries). Dev fallback: run the pipeline inline so the app
    // works without queue credentials.
    let jobId: string | undefined
    if (isQueueEnabled()) {
      await getInngest().send({
        name: EVENTS.extractionRequested,
        data: { documentId: document.id },
      })
      jobId = document.id
      logger.ai.info('Extraction enqueued', { documentId: document.id })
    } else {
      // Dev: run inline (non-blocking; the response still returns fast).
      runExtraction(document.id).catch((e) =>
        logger.ai.error('Inline extraction failed', { documentId: document.id, error: String(e) })
      )
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

    // Cache the result so a client retry with the same Idempotency-Key
    // replays this response instead of creating a duplicate upload.
    await storeIdempotentResult(req, responseBody, 201)

    return NextResponse.json(responseBody, { status: 201 })
  } catch (error) {
    logger.document.error('Upload error', { error: String(error) })
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
