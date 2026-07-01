import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authz = await requirePermission(_req, 'document:read', 'document')
  if (authz instanceof NextResponse) return authz
  const { firmId } = authz

  const document = await db.document.findFirst({
    where: { id, client: { firmId } },
    include: {
      extractions: { orderBy: { fieldGroup: 'asc' } },
      client: true,
      engagement: { include: { client: true } },
      pbcItem: true,
    },
  })

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  return NextResponse.json({ document })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authz = await requirePermission(req, 'document:write', 'document')
  if (authz instanceof NextResponse) return authz
  const { firmId } = authz

  const body = await req.json()
  const owned = await db.document.findFirst({
    where: { id, client: { firmId } },
    select: { id: true },
  })
  if (!owned) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }
  const document = await db.document.update({
    where: { id },
    data: {
      documentType: body.documentType,
      confidence: body.confidence,
      status: body.status,
      processedAt: body.status === 'processed' ? new Date() : undefined,
    },
  })
  return NextResponse.json({ document })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authz = await requirePermission(_req, 'document:write', 'document')
  if (authz instanceof NextResponse) return authz
  const { firmId } = authz

  const owned = await db.document.findFirst({
    where: { id, client: { firmId } },
    select: { id: true },
  })
  if (!owned) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }
  await db.document.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
