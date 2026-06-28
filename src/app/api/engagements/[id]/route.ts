import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const engagement = await db.engagement.findUnique({
    where: { id },
    include: {
      client: true,
      assignedTo: true,
      pbcList: {
        include: {
          items: {
            orderBy: { orderIndex: 'asc' },
            include: { documents: true },
          },
        },
      },
      documents: {
        include: { extractions: true, pbcItem: true },
        orderBy: { uploadedAt: 'desc' },
      },
      workflows: { orderBy: { createdAt: 'asc' } },
      messages: { orderBy: { createdAt: 'asc' } },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  })

  if (!engagement) {
    return NextResponse.json({ error: 'Engagement not found' }, { status: 404 })
  }

  return NextResponse.json({ engagement })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const engagement = await db.engagement.update({
    where: { id },
    data: {
      status: body.status,
      progress: body.progress,
      priority: body.priority,
      assignedToId: body.assignedToId,
      deadline: body.deadline ? new Date(body.deadline) : undefined,
      fee: body.fee,
      notes: body.notes,
    },
  })
  return NextResponse.json({ engagement })
}
