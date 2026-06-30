import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'

/**
 * GET /api/documents/[id]/extraction-status
 *
 * Lightweight poll for extraction progress. Clients call this after upload
 * (when the job was enqueued) to know when classify/extract is done.
 * Maps the Document.status vocabulary onto a UI-friendly stage.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const authz = await requirePermission(req, 'document:read', 'document')
  if (authz instanceof NextResponse) return authz
  const { firmId } = authz

  const document = await db.document.findUnique({
    where: { id },
    include: {
      client: { select: { firmId: true } },
      _count: { select: { extractions: true } },
    },
  })

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  // Tenant guard.
  if (document.client.firmId !== firmId) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const stageMap: Record<string, string> = {
    uploaded: document.documentType ? 'extracting' : 'queued',
    processing: 'classifying',
    processed: 'processed',
    reviewed: 'processed',
    rejected: 'failed',
  }
  const stage = stageMap[document.status] ?? 'queued'

  return NextResponse.json({
    stage,
    status: document.status,
    documentType: document.documentType,
    confidence: document.confidence,
    fieldCount: document._count.extractions,
  })
}
