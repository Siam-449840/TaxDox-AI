import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const document = await db.document.findUnique({
    where: { id },
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
  const body = await req.json()
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
  await db.document.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
