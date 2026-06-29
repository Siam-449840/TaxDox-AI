/**
 * TaxDox AI — Canonical Metrics (One Source of Truth)
 *
 * Every number that appears on a dashboard or report must be computed by
 * exactly one function in this file. If you find yourself calculating revenue,
 * accuracy, or completion percentage anywhere else, you're creating a second
 * source of truth that will drift from this one — exactly the bug class that
 * caused the $0-revenue incident.
 *
 * Rule: import from here, never recompute.
 */

import { db } from '@/lib/db'

// ─── Types ────────────────────────────────────────────────────

export interface TeamPerformanceMetrics {
  name: string
  role: string
  engagements: number
  completed: number
  revenue: number
  utilization: number
  color: string
}

export interface FirmFinancialMetrics {
  totalRevenue: number
  collectedRevenue: number
  outstandingRevenue: number
  revenuePerEngagement: number
}

export interface QualityMetrics {
  avgConfidence: number // 0-100
  totalExtractions: number
  verifiedExtractions: number
  manualCorrections: number
  issuesFound: number
}

// ─── Canonical Functions ──────────────────────────────────────

/**
 * Calculate team performance using the real FK (TeamMember.userId → User.id).
 *
 * This is the ONLY place team performance should be computed.
 * The reports API, team detail view, and dashboard all import this.
 *
 * Previous bug: name-matching join (e.assignedTo.name === t.name) silently
 * returned $0 when names didn't match exactly. Now uses explicit FK.
 */
export async function getTeamPerformance(firmId: string): Promise<TeamPerformanceMetrics[]> {
  const teamMembers = await db.teamMember.findMany({
    where: { firmId },
  })

  const engagements = await db.engagement.findMany({
    where: { firmId },
    include: { assignedTo: true },
  })

  return teamMembers.map((t) => {
    // Real FK join — no name matching
    const memberEngagements = engagements.filter(
      (e) => e.assignedToId === t.userId
    )
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
}

/**
 * Calculate firm financial metrics.
 *
 * This is the ONLY place revenue numbers should be computed.
 */
export async function getFirmFinancials(firmId: string): Promise<FirmFinancialMetrics> {
  const engagements = await db.engagement.findMany({
    where: { firmId },
    select: { fee: true, status: true },
  })

  const totalRevenue = engagements.reduce((s, e) => s + e.fee, 0)
  const collectedRevenue = engagements
    .filter((e) => e.status === 'done')
    .reduce((s, e) => s + e.fee, 0)

  return {
    totalRevenue,
    collectedRevenue,
    outstandingRevenue: totalRevenue - collectedRevenue,
    revenuePerEngagement: engagements.length > 0 ? Math.round(totalRevenue / engagements.length) : 0,
  }
}

/**
 * Calculate AI extraction quality metrics.
 *
 * This is the ONLY place accuracy/confidence numbers should be computed.
 */
export async function getQualityMetrics(firmId: string): Promise<QualityMetrics> {
  const extractions = await db.extraction.findMany({
    where: {
      document: {
        engagement: { firmId },
      },
    },
    select: { confidence: true, isVerified: true },
  })

  const verified = extractions.filter((e) => e.isVerified)

  return {
    avgConfidence:
      extractions.length > 0
        ? Math.round(
            (extractions.reduce((s, e) => s + e.confidence, 0) / extractions.length) * 100
          )
        : 0,
    totalExtractions: extractions.length,
    verifiedExtractions: verified.length,
    manualCorrections: extractions.length - verified.length,
    issuesFound: extractions.filter((e) => e.confidence < 0.9).length,
  }
}

/**
 * Calculate engagement progress percentage.
 *
 * This is the ONLY place progress % should be computed.
 * Uses the PBC completion ratio as the canonical progress measure.
 */
export function calculateEngagementProgress(
  pbcCompleted: number,
  pbcTotal: number,
  status: string
): number {
  if (status === 'done') return 100
  if (pbcTotal === 0) return 0
  return Math.min(99, Math.round((pbcCompleted / pbcTotal) * 100))
}
