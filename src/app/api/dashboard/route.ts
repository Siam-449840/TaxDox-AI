import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'

export async function GET(req: Request) {
  const authz = await requirePermission(req as never, 'dashboard:read', 'dashboard')
  if (authz instanceof NextResponse) return authz
  const { firmId } = authz

  const [engagements, clients, documents, teamMembers, pbcItems] = await Promise.all([
    db.engagement.findMany({
      where: { firmId },
      include: { client: true, assignedTo: true },
      orderBy: { updatedAt: 'desc' },
    }),
    db.client.count({ where: { firmId } }),
    db.document.count({ where: { client: { firmId } } }),
    db.teamMember.findMany({ where: { firmId } }),
    db.pbcItem.count({ where: { pbcList: { engagement: { firmId } } } }),
  ])

  const active = engagements.filter((e) =>
    !['done', 'created'].includes(e.status)
  ).length
  const pending = engagements.filter((e) =>
    ['created', 'pbc_sent', 'collecting'].includes(e.status)
  ).length
  const done = engagements.filter((e) => e.status === 'done').length
  const alerts = engagements.filter(
    (e) => e.priority === 'high' && e.status !== 'done' && e.progress < 50
  ).length

  // Status distribution
  const statusCounts: Record<string, number> = {}
  for (const e of engagements) {
    statusCounts[e.status] = (statusCounts[e.status] || 0) + 1
  }

  // Type distribution
  const typeCounts: Record<string, number> = {}
  for (const e of engagements) {
    typeCounts[e.engagementType] = (typeCounts[e.engagementType] || 0) + 1
  }

  // Document processing stats
  const docsByStatus: Record<string, number> = {}
  const allDocs = await db.document.findMany({
    where: { client: { firmId } },
    select: { status: true },
  })
  for (const d of allDocs) {
    docsByStatus[d.status] = (docsByStatus[d.status] || 0) + 1
  }

  // Recent activity (from activities table)
  const recentActivities = await db.activity.findMany({
    where: {
      OR: [
        { engagement: { firmId } },
        { document: { client: { firmId } } },
      ],
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: { engagement: { include: { client: true } } },
  })

  // Upcoming deadlines
  const upcomingDeadlines = engagements
    .filter((e) => e.status !== 'done' && e.deadline)
    .sort((a, b) => (a.deadline!.getTime() - b.deadline!.getTime()))
    .slice(0, 5)

  // Revenue
  const totalRevenue = engagements.reduce((sum, e) => sum + e.fee, 0)
  const collectedRevenue = engagements
    .filter((e) => e.status === 'done')
    .reduce((sum, e) => sum + e.fee, 0)

  // Team workload
  const teamWorkload = teamMembers.map((t) => ({
    id: t.id,
    name: t.name,
    role: t.role,
    capacity: t.capacity,
    currentLoad: t.currentLoad,
    utilization: Math.round((t.currentLoad / t.capacity) * 100),
    color: t.color,
    avatar: t.avatar,
  }))

  // Processing accuracy (mock from extractions)
  const extractions = await db.extraction.findMany({
    where: { document: { client: { firmId } } },
  })
  const avgConfidence =
    extractions.length > 0
      ? extractions.reduce((sum, e) => sum + e.confidence, 0) / extractions.length
      : 0
  const verifiedCount = extractions.filter((e) => e.isVerified).length

  return NextResponse.json({
    stats: {
      active,
      pending,
      done,
      alerts,
      totalClients: clients,
      totalDocuments: documents,
      totalPbcItems: pbcItems,
      totalRevenue,
      collectedRevenue,
      avgConfidence: Math.round(avgConfidence * 100),
      verifiedExtractions: verifiedCount,
      totalExtractions: extractions.length,
    },
    statusCounts,
    typeCounts,
    docsByStatus,
    teamWorkload,
    recentEngagements: engagements.slice(0, 6).map((e) => ({
      id: e.id,
      clientName: e.client.name,
      clientType: e.client.clientType,
      engagementType: e.engagementType,
      taxYear: e.taxYear,
      status: e.status,
      progress: e.progress,
      priority: e.priority,
      deadline: e.deadline,
      assignedTo: e.assignedTo?.name,
    })),
    recentActivities: recentActivities.map((a) => ({
      id: a.id,
      type: a.type,
      description: a.description,
      actor: a.actor,
      createdAt: a.createdAt,
      clientName: a.engagement?.client?.name,
    })),
    upcomingDeadlines: upcomingDeadlines.map((e) => ({
      id: e.id,
      clientName: e.client.name,
      engagementType: e.engagementType,
      deadline: e.deadline,
      priority: e.priority,
      progress: e.progress,
      daysLeft: Math.ceil((e.deadline!.getTime() - Date.now()) / 86400000),
    })),
  })
}
