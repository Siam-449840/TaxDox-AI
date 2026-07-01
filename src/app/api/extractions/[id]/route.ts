import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authz = await requirePermission(_req, 'extraction:read', 'extraction')
  if (authz instanceof NextResponse) return authz
  const { firmId } = authz

  const extractions = await db.extraction.findMany({
    where: { documentId: id, document: { client: { firmId } } },
    orderBy: { fieldGroup: 'asc' },
  })
  return NextResponse.json({ extractions })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authz = await requirePermission(req, 'extraction:write', 'extraction')
  if (authz instanceof NextResponse) return authz
  const { firmId, user } = authz

  const body = await req.json()
  const owned = await db.extraction.findFirst({
    where: { id, document: { client: { firmId } } },
    select: { id: true },
  })
  if (!owned) {
    return NextResponse.json({ error: 'Extraction not found' }, { status: 404 })
  }
  const extraction = await db.extraction.update({
    where: { id },
    data: {
      fieldValue: body.fieldValue,
      isVerified: body.isVerified ?? true,
      verifiedById: user.id,
      verifiedAt: new Date(),
    },
  })
  return NextResponse.json({ extraction })
}
