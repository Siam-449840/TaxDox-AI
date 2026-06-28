import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const engagement = await db.engagement.findUnique({
    where: { id },
    include: { pbcList: true, client: true },
  })

  if (!engagement) {
    return NextResponse.json({ error: 'Engagement not found' }, { status: 404 })
  }

  if (engagement.pbcList) {
    await db.pbcList.update({
      where: { id: engagement.pbcList.id },
      data: { sentAt: new Date(), sentVia: body.via || 'email' },
    })
  }

  await db.engagement.update({
    where: { id },
    data: { status: 'pbc_sent' },
  })

  await db.workflow.updateMany({
    where: { engagementId: id, step: 'pbc_send' },
    data: { status: 'completed', startedAt: new Date(), completedAt: new Date() },
  })
  await db.workflow.updateMany({
    where: { engagementId: id, step: 'collection' },
    data: { status: 'in_progress', startedAt: new Date() },
  })

  await db.activity.create({
    data: {
      engagementId: id,
      type: 'send',
      description: `PBC list sent to ${engagement.client.name} via ${body.via || 'email'}`,
      actor: 'You',
    },
  })

  return NextResponse.json({ success: true })
}
