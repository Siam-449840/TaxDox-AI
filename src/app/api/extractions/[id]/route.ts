import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const extractions = await db.extraction.findMany({
    where: { documentId: id },
    orderBy: { fieldGroup: 'asc' },
  })
  return NextResponse.json({ extractions })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const extraction = await db.extraction.update({
    where: { id },
    data: {
      fieldValue: body.fieldValue,
      isVerified: body.isVerified ?? true,
      verifiedAt: new Date(),
    },
  })
  return NextResponse.json({ extraction })
}
