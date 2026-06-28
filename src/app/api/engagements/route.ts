import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const type = searchParams.get('type')
  const clientId = searchParams.get('clientId')
  const search = searchParams.get('search')

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (type) where.engagementType = type
  if (clientId) where.clientId = clientId
  if (search) {
    where.client = { name: { contains: search } }
  }

  const engagements = await db.engagement.findMany({
    where,
    include: {
      client: true,
      assignedTo: true,
      pbcList: { include: { items: { include: { documents: true } } } },
      documents: { select: { id: true, status: true, documentType: true } },
      _count: { select: { documents: true, messages: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const enriched = engagements.map((e) => {
    const pbcItems = e.pbcList?.items || []
    const pbcCompleted = pbcItems.filter((i) =>
      ['extracted', 'reviewed'].includes(i.status)
    ).length
    return {
      ...e,
      _count: {
        ...e._count,
        pbcItems: pbcItems.length,
        pbcCompleted,
      },
    }
  })

  return NextResponse.json({ engagements: enriched })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const engagement = await db.engagement.create({
    data: {
      firmId: body.firmId,
      clientId: body.clientId,
      taxYear: body.taxYear || 2025,
      engagementType: body.engagementType,
      status: 'created',
      priority: body.priority || 'medium',
      fee: body.fee || 0,
      deadline: body.deadline ? new Date(body.deadline) : null,
      assignedToId: body.assignedToId,
      notes: body.notes,
    },
  })

  const steps = ['create', 'pbc_send', 'collection', 'ai_processing', 'human_review', 'tax_import', 'filing', 'delivery']
  await db.workflow.create({
    data: {
      engagementId: engagement.id,
      step: 'create',
      status: 'completed',
      startedAt: new Date(),
      completedAt: new Date(),
    },
  })
  for (const step of steps.slice(1)) {
    await db.workflow.create({
      data: { engagementId: engagement.id, step, status: 'pending' },
    })
  }

  return NextResponse.json({ engagement }, { status: 201 })
}
