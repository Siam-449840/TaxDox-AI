import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const type = searchParams.get('type')
  const search = searchParams.get('search')

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (type) where.clientType = type
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
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
  const body = await req.json()
  const client = await db.client.create({
    data: {
      firmId: body.firmId,
      name: body.name,
      email: body.email,
      phone: body.phone,
      taxId: body.taxId,
      clientType: body.clientType || 'individual',
      status: body.status || 'active',
      country: body.country || 'US',
      metadata: JSON.stringify(body.metadata || {}),
    },
  })
  return NextResponse.json({ client }, { status: 201 })
}
