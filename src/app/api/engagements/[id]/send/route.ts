import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pbcRequestEmail } from '@/lib/email-templates'

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

  const sendVia = body.via || 'email'

  if (engagement.pbcList) {
    await db.pbcList.update({
      where: { id: engagement.pbcList.id },
      data: { sentAt: new Date(), sentVia: sendVia },
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
      description: `PBC list sent to ${engagement.client.name} via ${sendVia}`,
      actor: 'You',
    },
  })

  // ── Simulate outbound email ────────────────────────────────────
  // Only log when the request channel was email (or unspecified) so
  // portal/sms dispatches do not create spurious email logs.
  if (sendVia === 'email') {
    const template = pbcRequestEmail(
      engagement.client.name,
      engagement.engagementType,
      engagement.taxYear,
      engagement.deadline ?? new Date()
    )
    await db.emailLog.create({
      data: {
        firmId: engagement.firmId,
        engagementId: engagement.id,
        clientId: engagement.client.id,
        toEmail: engagement.client.email,
        toName: engagement.client.name,
        fromName: 'Meridian CPA Group',
        subject: template.subject,
        body: template.body,
        template: template.template,
        status: 'sent',
        sentAt: new Date(),
      },
    })
  }

  return NextResponse.json({ success: true })
}
