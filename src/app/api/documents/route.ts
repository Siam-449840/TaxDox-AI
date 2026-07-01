import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'
import { documentUploadSchema, validateMimeType } from '@/lib/validation'

export async function GET(req: NextRequest) {
  const authz = await requirePermission(req, 'document:read', 'document')
  if (authz instanceof NextResponse) return authz
  const { firmId } = authz

  const { searchParams } = new URL(req.url)
  const engagementId = searchParams.get('engagementId')
  const clientId = searchParams.get('clientId')
  const status = searchParams.get('status')
  const documentType = searchParams.get('documentType')

  const where: Record<string, unknown> = { client: { firmId } }
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
  const authz = await requirePermission(req, 'document:write', 'document')
  if (authz instanceof NextResponse) return authz
  const { firmId } = authz

  const body = await req.json()
  const parsed = documentUploadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const data = parsed.data

  if (body.mimeType && !validateMimeType(body.mimeType)) {
    return NextResponse.json({ error: 'Unsupported MIME type' }, { status: 400 })
  }

  const owningClient = await db.client.findFirst({
    where: { id: data.clientId, firmId },
    select: { id: true },
  })
  if (!owningClient) {
    return NextResponse.json({ error: 'Client not found in your firm' }, { status: 404 })
  }

  if (data.engagementId) {
    const owningEngagement = await db.engagement.findFirst({
      where: { id: data.engagementId, firmId, clientId: data.clientId },
      select: { id: true },
    })
    if (!owningEngagement) {
      return NextResponse.json({ error: 'Engagement not found in your firm' }, { status: 404 })
    }
  }

  const document = await db.document.create({
    data: {
      clientId: data.clientId,
      engagementId: data.engagementId,
      pbcItemId: data.pbcItemId,
      originalFilename: body.originalFilename,
      storedFilename: body.storedFilename || `uploads/${Date.now()}-${body.originalFilename}`,
      fileSize: body.fileSize || 0,
      mimeType: body.mimeType || 'application/pdf',
      status: 'uploaded',
      uploadedBy: data.uploadedBy,
    },
  })

  await db.activity.create({
    data: {
      engagementId: data.engagementId,
      documentId: document.id,
      type: 'upload',
      description: `${body.uploadedBy === 'client' ? 'Client' : 'User'} uploaded ${body.originalFilename}`,
      actor: body.uploadedBy === 'client' ? 'Client' : 'You',
    },
  })

  return NextResponse.json({ document }, { status: 201 })
}
