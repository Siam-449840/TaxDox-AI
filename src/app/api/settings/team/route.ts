import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'
import { z } from 'zod'
import { logger } from '@/lib/logger'

const createTeamMemberSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email().toLowerCase(),
  role: z.enum(['partner', 'manager', 'preparer', 'admin', 'read-only']).default('preparer'),
  capacity: z.number().int().min(1).max(100).default(10),
  color: z.string().max(40).default('emerald'),
})

export async function GET(req: NextRequest) {
  const authz = await requirePermission(req, 'setting:read', 'team')
  if (authz instanceof NextResponse) return authz
  const { firmId } = authz

  const team = await db.teamMember.findMany({
    where: { firmId }, // firm-scoped
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ team })
}

export async function POST(req: NextRequest) {
  // Setting writes are admin/partner only (ADMIN_ONLY in permissions.ts).
  const authz = await requirePermission(req, 'setting:write', 'team')
  if (authz instanceof NextResponse) return authz
  const { firmId } = authz

  const body = await req.json()
  const parsed = createTeamMemberSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const data = parsed.data

  try {
    const member = await db.teamMember.create({
      data: {
        firmId, // from session
        name: data.name,
        role: data.role,
        email: data.email,
        capacity: data.capacity,
        currentLoad: 0,
        color: data.color,
      },
    })
    logger.api.info('Team member added', { firmId, teamMemberId: member.id })
    return NextResponse.json({ member }, { status: 201 })
  } catch (error) {
    logger.api.error('Team member creation failed', {
      firmId,
      error: String(error),
    })
    return NextResponse.json(
      { error: 'Failed to add team member' },
      { status: 500 }
    )
  }
}
