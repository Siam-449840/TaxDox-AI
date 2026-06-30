import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { getObjectStore } from '@/lib/object-store'
import { requirePermission } from '@/lib/permissions'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Authn + authz (document:read). firmId from session drives the ownership
  // check below.
  const authz = await requirePermission(req, 'document:read', 'document')
  if (authz instanceof NextResponse) return authz
  const { firmId } = authz

  const document = await db.document.findUnique({
    where: { id },
    include: { client: { select: { firmId: true } } },
  })

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  // ── Tenant guard: the document's client must belong to the caller's firm.
  if (document.client.firmId !== firmId) {
    logger.security.warn('Cross-tenant document preview blocked', {
      documentId: id,
      documentFirmId: document.client.firmId,
      callerFirmId: firmId,
    })
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  if (!document.storedFilename) {
    return NextResponse.json({ error: 'No file stored' }, { status: 404 })
  }

  try {
    const store = getObjectStore()
    const fileBuffer = await store.get(document.storedFilename)

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': document.mimeType || 'application/octet-stream',
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    logger.document.error('Preview error', { error: String(error) })
    return NextResponse.json(
      { error: 'File not found' },
      { status: 404 }
    )
  }
}
