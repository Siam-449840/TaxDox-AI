import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authz = await requirePermission(req, 'pbc:write', 'pbc')
  if (authz instanceof NextResponse) return authz
  const { firmId } = authz

  const pbcList = await db.pbcList.findFirst({
    where: { id, engagement: { firmId } },
    select: { id: true },
  })
  if (!pbcList) {
    return NextResponse.json({ error: 'PBC list not found' }, { status: 404 })
  }

  const body = await req.json()
  const count = await db.pbcItem.count({ where: { pbcListId: id } })
  const item = await db.pbcItem.create({
    data: {
      pbcListId: id,
      documentType: body.documentType,
      description: body.description,
      category: body.category || 'other',
      required: body.required ?? true,
      priority: body.priority || 'medium',
      expectedFormat: body.expectedFormat || 'pdf',
      orderIndex: count,
      status: 'pending',
    },
  })
  return NextResponse.json({ item }, { status: 201 })
}
