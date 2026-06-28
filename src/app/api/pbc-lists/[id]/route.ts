import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const pbcList = await db.pbcList.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { orderIndex: 'asc' },
        include: { documents: true },
      },
      engagement: { include: { client: true } },
    },
  })

  if (!pbcList) {
    return NextResponse.json({ error: 'PBC list not found' }, { status: 404 })
  }

  return NextResponse.json({ pbcList })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const pbcList = await db.pbcList.update({
    where: { id },
    data: { name: body.name },
  })
  return NextResponse.json({ pbcList })
}
