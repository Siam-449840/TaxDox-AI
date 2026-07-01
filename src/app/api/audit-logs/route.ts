import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'

export async function GET(req: Request) {
  const authz = await requirePermission(req as never, 'audit:read', 'audit')
  if (authz instanceof NextResponse) return authz
  const { firmId } = authz

  const logs = await db.auditLog.findMany({
    where: { firmId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return NextResponse.json({ logs })
}
