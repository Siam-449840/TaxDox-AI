import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'
import { z } from 'zod'
import { logger } from '@/lib/logger'

const createTemplateSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  clientType: z.enum(['individual', 'business', 'trust', 'nonprofit']).default('individual'),
  engagementType: z.enum(['1040', '1065', '1120', '1120S', '1041']).default('1040'),
  items: z.array(z.record(z.string(), z.unknown())).default([]),
  isDefault: z.boolean().default(false),
})

export async function GET(req: NextRequest) {
  const authz = await requirePermission(req, 'setting:read', 'template')
  if (authz instanceof NextResponse) return authz
  const { firmId } = authz

  const templates = await db.pbcTemplate.findMany({
    where: { firmId }, // firm-scoped
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
  // Setting writes are admin/partner only.
  const authz = await requirePermission(req, 'setting:write', 'template')
  if (authz instanceof NextResponse) return authz
  const { firmId } = authz

  const body = await req.json()
  const parsed = createTemplateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const data = parsed.data

  try {
    const template = await db.pbcTemplate.create({
      data: {
        firmId, // from session
        name: data.name,
        description: data.description,
        clientType: data.clientType,
        engagementType: data.engagementType,
        items: JSON.stringify(data.items),
        isDefault: data.isDefault,
      },
    })
    logger.api.info('Template created', { firmId, templateId: template.id })
    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    logger.api.error('Template creation failed', {
      firmId,
      error: String(error),
    })
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    )
  }
}
