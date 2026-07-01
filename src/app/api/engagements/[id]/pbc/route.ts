import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authz = await requirePermission(_req, 'pbc:write', 'pbc')
  if (authz instanceof NextResponse) return authz
  const { firmId } = authz

  const engagement = await db.engagement.findFirst({
    where: { id, firmId },
    include: { pbcList: true, client: true },
  })

  if (!engagement) {
    return NextResponse.json({ error: 'Engagement not found' }, { status: 404 })
  }

  if (engagement.pbcList) {
    return NextResponse.json({ pbcList: engagement.pbcList })
  }

  const template = await db.pbcTemplate.findFirst({
    where: {
      firmId,
      engagementType: engagement.engagementType,
      isDefault: true,
    },
  })

  const items = template ? JSON.parse(template.items) : []

  const pbcList = await db.pbcList.create({
    data: {
      engagementId: engagement.id,
      name: `${engagement.engagementType} ${engagement.taxYear} — ${engagement.client.name}`,
    },
  })

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    await db.pbcItem.create({
      data: {
        pbcListId: pbcList.id,
        documentType: item.documentType,
        description: item.description,
        category: item.category,
        required: item.required,
        priority: item.priority,
        expectedFormat: 'pdf',
        orderIndex: i,
        status: 'pending',
      },
    })
  }

  const fullList = await db.pbcList.findUnique({
    where: { id: pbcList.id },
    include: { items: { orderBy: { orderIndex: 'asc' } } },
  })

  return NextResponse.json({ pbcList: fullList }, { status: 201 })
}
