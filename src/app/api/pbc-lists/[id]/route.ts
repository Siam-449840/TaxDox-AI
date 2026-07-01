import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authz = await requirePermission(_req, 'pbc:read', 'pbc')
  if (authz instanceof NextResponse) return authz
  const { firmId } = authz

  const pbcList = await db.pbcList.findFirst({
    where: { id, engagement: { firmId } },
    include: {
      items: {
        orderBy: { orderIndex: 'asc' },
        include: { documents: true },
      },
      engagement: { include: { client: true } },
    },
  })

  if (!pbcList) {
    return NextResponse.json({ error: 'PBC list not found' }, { status: 404 })
  }

  return NextResponse.json({ pbcList })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authz = await requirePermission(req, 'pbc:write', 'pbc')
  if (authz instanceof NextResponse) return authz
  const { firmId } = authz

  const body = await req.json()
  const owned = await db.pbcList.findFirst({
    where: { id, engagement: { firmId } },
    select: { id: true },
  })
  if (!owned) {
    return NextResponse.json({ error: 'PBC list not found' }, { status: 404 })
  }
  const pbcList = await db.pbcList.update({
    where: { id },
    data: { name: body.name },
  })
  return NextResponse.json({ pbcList })
}
