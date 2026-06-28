import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const templates = await db.pbcTemplate.findMany({
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({
    templates: templates.map((t) => ({
      ...t,
      items: JSON.parse(t.items),
    })),
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const template = await db.pbcTemplate.create({
    data: {
      firmId: body.firmId,
      name: body.name,
      description: body.description,
      clientType: body.clientType || 'individual',
      engagementType: body.engagementType || '1040',
      items: JSON.stringify(body.items || []),
      isDefault: body.isDefault || false,
    },
  })
  return NextResponse.json({ template }, { status: 201 })
}
