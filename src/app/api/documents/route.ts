import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const engagementId = searchParams.get('engagementId')
  const clientId = searchParams.get('clientId')
  const status = searchParams.get('status')
  const documentType = searchParams.get('documentType')

  const where: Record<string, unknown> = {}
  if (engagementId) where.engagementId = engagementId
  if (clientId) where.clientId = clientId
  if (status) where.status = status
  if (documentType) where.documentType = documentType

  const documents = await db.document.findMany({
    where,
    include: {
      extractions: true,
      client: { select: { name: true, email: true } },
      pbcItem: { select: { documentType: true, description: true } },
    },
    orderBy: { uploadedAt: 'desc' },
  })

  return NextResponse.json({ documents })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const document = await db.document.create({
    data: {
      clientId: body.clientId,
      engagementId: body.engagementId,
      pbcItemId: body.pbcItemId,
      originalFilename: body.originalFilename,
      storedFilename: body.storedFilename || `uploads/${Date.now()}-${body.originalFilename}`,
      fileSize: body.fileSize || 0,
      mimeType: body.mimeType || 'application/pdf',
      status: 'uploaded',
      uploadedBy: body.uploadedBy || 'client',
    },
  })

  await db.activity.create({
    data: {
      engagementId: body.engagementId,
      documentId: document.id,
      type: 'upload',
      description: `${body.uploadedBy === 'client' ? 'Client' : 'User'} uploaded ${body.originalFilename}`,
      actor: body.uploadedBy === 'client' ? 'Client' : 'You',
    },
  })

  return NextResponse.json({ document }, { status: 201 })
}
