import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const team = await db.teamMember.findMany({
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ team })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const member = await db.teamMember.create({
    data: {
      firmId: body.firmId,
      name: body.name,
      role: body.role || 'preparer',
      email: body.email,
      capacity: body.capacity || 10,
      currentLoad: 0,
      color: body.color || 'emerald',
    },
  })
  return NextResponse.json({ member }, { status: 201 })
}
