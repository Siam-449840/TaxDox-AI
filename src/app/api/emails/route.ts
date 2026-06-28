import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  pbcRequestEmail,
  deadlineReminderEmail,
  documentReceivedEmail,
  extractionCompleteEmail,
  welcomeEmail,
  type EmailTemplate,
} from '@/lib/email-templates'

/**
 * GET /api/emails
 *   Optional query params:
 *     ?engagementId=<cuid>   — filter by engagement
 *     ?clientId=<cuid>       — filter by client
 *     ?template=<key>        — filter by template key
 *     ?limit=<number>        — limit (default 100, max 500)
 *
 * Returns { emails: [...] } sorted newest-first.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const engagementId = searchParams.get('engagementId')
  const clientId = searchParams.get('clientId')
  const template = searchParams.get('template')
  const rawLimit = Number(searchParams.get('limit') ?? '100')
  const limit = Number.isFinite(rawLimit)
    ? Math.min(500, Math.max(1, Math.floor(rawLimit)))
    : 100

  const where: Record<string, unknown> = {}
  if (engagementId) where.engagementId = engagementId
  if (clientId) where.clientId = clientId
  if (template) where.template = template

  const emails = await db.emailLog.findMany({
    where,
    orderBy: { sentAt: 'desc' },
    take: limit,
    include: {
      client: { select: { id: true, name: true, email: true } },
      engagement: {
        select: { id: true, engagementType: true, taxYear: true },
      },
    },
  })

  return NextResponse.json({ emails })
}

/**
 * POST /api/emails
 *   Body: {
 *     firmId, template, engagementId?, clientId?,
 *     toEmail?, toName?, fromName?, status?,
 *     // template-specific payload:
 *     payload: { clientName, engagementType, taxYear, deadline, daysLeft,
 *                documentType, filename, fieldCount, confidence, firmName }
 *   }
 *
 * Simulates sending an email by:
 *   1. Looking up the engagement + client (when ids are provided)
 *   2. Building the subject/body from the template generator
 *   3. Persisting an EmailLog row with status "sent"
 *
 * Returns { email } — the created EmailLog record.
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const template = (body.template as EmailTemplate) ?? 'pbc_request'

  // Resolve firm / engagement / client in parallel when ids are provided.
  const engagementId: string | undefined = body.engagementId
  const clientId: string | undefined = body.clientId

  const [engagement, client] = await Promise.all([
    engagementId
      ? db.engagement.findUnique({
          where: { id: engagementId },
          include: { client: true },
        })
      : Promise.resolve(null),
    clientId
      ? db.client.findUnique({ where: { id: clientId } })
      : Promise.resolve(null),
  ])

  // Determine firmId (prefer body → engagement → client → first firm)
  let firmId: string | undefined = body.firmId
  if (!firmId && engagement) firmId = engagement.firmId
  if (!firmId && client) firmId = client.firmId
  if (!firmId) {
    const firstFirm = await db.firm.findFirst({ select: { id: true } })
    firmId = firstFirm?.id
  }
  if (!firmId) {
    return NextResponse.json({ error: 'Could not resolve firm' }, { status: 400 })
  }

  // Resolve recipient info
  const clientRecord = client ?? engagement?.client ?? null
  const toName: string = body.toName ?? clientRecord?.name ?? 'Client'
  const toEmail: string =
    body.toEmail ?? clientRecord?.email ?? 'client@example.com'

  // Pull template-specific fields (with sane defaults).
  const p = body.payload ?? {}
  const clientName: string = p.clientName ?? toName
  const engagementType: string = p.engagementType ?? engagement?.engagementType ?? '1040'
  const taxYear: number = Number(p.taxYear ?? engagement?.taxYear ?? new Date().getFullYear())
  const deadline: string | Date = p.deadline ?? engagement?.deadline ?? new Date()
  const daysLeft: number = Number(p.daysLeft ?? 7)
  const documentType: string = p.documentType ?? 'Document'
  const filename: string = p.filename ?? `${documentType}.pdf`
  const fieldCount: number = Number(p.fieldCount ?? 0)
  const confidence: number = Number(p.confidence ?? 0.95)
  const firmName: string = p.firmName ?? 'Meridian CPA Group'

  // Build the content via the template generators.
  let content: { subject: string; body: string; template: EmailTemplate }
  switch (template) {
    case 'deadline_reminder':
      content = deadlineReminderEmail(clientName, engagementType, taxYear, daysLeft, deadline)
      break
    case 'document_received':
      content = documentReceivedEmail(clientName, documentType, filename)
      break
    case 'extraction_complete':
      content = extractionCompleteEmail(clientName, documentType, fieldCount, confidence)
      break
    case 'welcome':
      content = welcomeEmail(clientName, firmName)
      break
    case 'pbc_request':
    default:
      content = pbcRequestEmail(clientName, engagementType, taxYear, deadline)
      break
  }

  // Persist the simulated email.
  const email = await db.emailLog.create({
    data: {
      firmId,
      engagementId: engagementId ?? engagement?.id ?? null,
      clientId: clientId ?? clientRecord?.id ?? null,
      toEmail,
      toName,
      fromName: body.fromName ?? 'Meridian CPA Group',
      subject: content.subject,
      body: content.body,
      template: content.template,
      status: body.status ?? 'sent',
      sentAt: new Date(),
    },
  })

  return NextResponse.json({ email }, { status: 201 })
}
