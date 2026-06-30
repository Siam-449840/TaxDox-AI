import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pbcRequestEmail } from '@/lib/email-templates'
import { sendEmail } from '@/lib/email'

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

  // ── Deliver the PBC request email ───────────────────────────────
  // Only send when the channel is email so portal/sms dispatches don't create
  // spurious logs. Delivers via the real transport (Resend/log) and persists
  // an EmailLog reflecting the actual result.
  if (sendVia === 'email') {
    const template = pbcRequestEmail(
      engagement.client.name,
      engagement.engagementType,
      engagement.taxYear,
      engagement.deadline ?? new Date()
    )
    await sendEmail({
      firmId: engagement.firmId,
      engagementId: engagement.id,
      clientId: engagement.client.id,
      to: engagement.client.email,
      toName: engagement.client.name,
      fromName: 'Meridian CPA Group',
      subject: template.subject,
      text: template.body,
      html: `<pre style="font-family: ui-sans-serif, system-ui, sans-serif; white-space: pre-wrap;">${escapeHtml(template.body)}</pre>`,
      template: template.template,
    })
  }

  return NextResponse.json({ success: true })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
