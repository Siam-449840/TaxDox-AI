import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'
import { createEngagementSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const authz = await requirePermission(req, 'engagement:read', 'engagement')
  if (authz instanceof NextResponse) return authz
  const { firmId } = authz

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const type = searchParams.get('type')
  const clientId = searchParams.get('clientId')
  const search = searchParams.get('search')

  // firmId always from the session — closes the cross-tenant read hole.
  const where: Record<string, unknown> = { firmId }
  if (status) where.status = status
  if (type) where.engagementType = type
  if (clientId) where.clientId = clientId
  if (search) {
    where.client = { name: { contains: search, mode: 'insensitive' } }
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
  const authz = await requirePermission(req, 'engagement:write', 'engagement')
  if (authz instanceof NextResponse) return authz
  const { firmId } = authz

  const body = await req.json()
  // Attach session firmId before validating so the schema stays pure.
  const parsed = createEngagementSchema.safeParse({ ...body, firmId })
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const data = parsed.data

  // Ensure the client actually belongs to this firm (no cross-tenant attach).
  const owningClient = await db.client.findFirst({
    where: { id: data.clientId, firmId },
    select: { id: true },
  })
  if (!owningClient) {
    return NextResponse.json(
      { error: 'Client not found in your firm' },
      { status: 404 }
    )
  }

  try {
    const engagement = await db.engagement.create({
      data: {
        firmId, // from session
        clientId: data.clientId,
        taxYear: data.taxYear,
        engagementType: data.engagementType,
        status: 'created',
        priority: data.priority,
        fee: data.fee,
        deadline: data.deadline ? new Date(data.deadline) : null,
        assignedToId: data.assignedToId,
        notes: data.notes,
      },
    })

    const steps = [
      'create',
      'pbc_send',
      'collection',
      'ai_processing',
      'human_review',
      'tax_import',
      'filing',
      'delivery',
    ]
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

    logger.api.info('Engagement created', {
      firmId,
      engagementId: engagement.id,
    })
    return NextResponse.json({ engagement }, { status: 201 })
  } catch (error) {
    logger.api.error('Engagement creation failed', {
      firmId,
      error: String(error),
    })
    return NextResponse.json(
      { error: 'Failed to create engagement' },
      { status: 500 }
    )
  }
}
