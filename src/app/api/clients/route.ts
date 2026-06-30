import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'
import { createClientSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const authz = await requirePermission(req, 'client:read', 'client')
  if (authz instanceof NextResponse) return authz
  const { firmId } = authz

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const type = searchParams.get('type')
  const search = searchParams.get('search')

  // firmId is ALWAYS from the session — closes the cross-tenant read hole.
  const where: Record<string, unknown> = { firmId }
  if (status) where.status = status
  if (type) where.clientType = type
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
  }

  const clients = await db.client.findMany({
    where,
    include: {
      _count: { select: { engagements: true, documents: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ clients })
}

export async function POST(req: NextRequest) {
  const authz = await requirePermission(req, 'client:write', 'client')
  if (authz instanceof NextResponse) return authz
  const { firmId } = authz

  const body = await req.json()
  // Validate input with Zod — never trust the body raw.
  const parsed = createClientSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const data = parsed.data

  try {
    const client = await db.client.create({
      data: {
        firmId, // from session, never body
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        // NOTE: taxId storage is preserved as-is to match existing read
        // paths (clients/client-detail views expect plaintext for masking).
        // Field-level encryption of taxId is tracked as a follow-up that
        // must add decrypt+mask at every read site in one pass.
        taxId: data.taxId ?? null,
        clientType: data.clientType,
        status: data.status,
        country: data.country,
        metadata: JSON.stringify({}),
      },
    })
    logger.api.info('Client created', { firmId, clientId: client.id })
    return NextResponse.json({ client }, { status: 201 })
  } catch (error) {
    logger.api.error('Client creation failed', { firmId, error: String(error) })
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
  }
}
