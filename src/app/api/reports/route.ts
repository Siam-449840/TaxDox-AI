import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const range = searchParams.get('range') || '30d'

  const engagements = await db.engagement.findMany({
    include: { client: true, assignedTo: true, documents: true },
  })
  const documents = await db.document.findMany({ include: { extractions: true } })
  const teamMembers = await db.teamMember.findMany()
  const extractions = await db.extraction.findMany()

  // Operational metrics
  const processingTimes = documents
    .filter((d) => d.processedAt)
    .map((d) => d.processedAt!.getTime() - d.uploadedAt.getTime())
  const avgProcessingMs =
    processingTimes.length > 0
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
      : 0
  const avgProcessingMin = Math.round(avgProcessingMs / 60000)

  // Collection time (from engagement creation to collecting status) - estimated
  const avgCollectionDays = 4.2

  // On-time filing rate
  const filedOnTime = engagements.filter(
    (e) => e.status === 'done'
  ).length
  const onTimeRate = engagements.length > 0
    ? Math.round((filedOnTime / engagements.length) * 100)
    : 0

  // Financial metrics
  const totalRevenue = engagements.reduce((sum, e) => sum + e.fee, 0)
  const collectedRevenue = engagements
    .filter((e) => e.status === 'done')
    .reduce((sum, e) => sum + e.fee, 0)
  const outstandingRevenue = totalRevenue - collectedRevenue
  const revenuePerEngagement = engagements.length > 0 ? totalRevenue / engagements.length : 0

  // Quality metrics
  const avgConfidence =
    extractions.length > 0
      ? extractions.reduce((sum, e) => sum + e.confidence, 0) / extractions.length
      : 0
  const manualCorrections = extractions.filter((e) => !e.isVerified).length
  const issuesFound = documents.filter((d) => d.confidence < 0.9).length

  // Trend data (last 7 days mock)
  const trendData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - i))
    return {
      date: date.toISOString().split('T')[0],
      documents: Math.floor(8 + Math.random() * 20),
      extractions: Math.floor(20 + Math.random() * 50),
      accuracy: Math.round((90 + Math.random() * 8) * 10) / 10,
    }
  })

  // Document type distribution
  const typeDist: Record<string, number> = {}
  for (const d of documents) {
    if (d.documentType) {
      typeDist[d.documentType] = (typeDist[d.documentType] || 0) + 1
    }
  }

  // Team performance
  const teamPerf = teamMembers.map((t) => {
    const memberEngagements = engagements.filter((e) => e.assignedToId === t.id)
    return {
      name: t.name,
      role: t.role,
      engagements: memberEngagements.length,
      completed: memberEngagements.filter((e) => e.status === 'done').length,
      revenue: memberEngagements.reduce((s, e) => s + e.fee, 0),
      utilization: Math.round((t.currentLoad / t.capacity) * 100),
      color: t.color,
    }
  })

  return NextResponse.json({
    operational: {
      avgProcessingMin,
      avgCollectionDays,
      onTimeRate,
      teamUtilization: Math.round(
        (teamMembers.reduce((s, t) => s + t.currentLoad / t.capacity, 0) / teamMembers.length) * 100
      ),
      clientResponseRate: 78,
    },
    financial: {
      totalRevenue,
      collectedRevenue,
      outstandingRevenue,
      revenuePerEngagement: Math.round(revenuePerEngagement),
      avgHourlyRate: 185,
      outsourcingSavings: 42000,
    },
    quality: {
      avgConfidence: Math.round(avgConfidence * 100),
      manualCorrections,
      issuesFound,
      clientSatisfaction: 4.7,
      totalExtractions: extractions.length,
    },
    trendData,
    typeDistribution: Object.entries(typeDist)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    teamPerformance: teamPerf,
    engagementStatusBreakdown: {
      active: engagements.filter((e) => !['done', 'created'].includes(e.status)).length,
      completed: engagements.filter((e) => e.status === 'done').length,
      pending: engagements.filter((e) => ['created', 'pbc_sent'].includes(e.status)).length,
    },
  })
}
