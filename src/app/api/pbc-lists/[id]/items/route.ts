import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const count = await db.pbcItem.count({ where: { pbcListId: id } })
  const item = await db.pbcItem.create({
    data: {
      pbcListId: id,
      documentType: body.documentType,
      description: body.description,
      category: body.category || 'other',
      required: body.required ?? true,
      priority: body.priority || 'medium',
      expectedFormat: body.expectedFormat || 'pdf',
      orderIndex: count,
      status: 'pending',
    },
  })
  return NextResponse.json({ item }, { status: 201 })
}
