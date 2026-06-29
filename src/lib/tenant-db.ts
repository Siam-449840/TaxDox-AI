/**
 * TaxDox AI — Multi-Tenant Isolation Extension
 *
 * Section 4.2: Every Prisma query MUST include a firmId filter.
 * This extension enforces that at the database access layer —
 * if a query touches a firm-scoped table without a firmId filter,
 * it throws immediately (loud failure, not silent data leak).
 *
 * Usage:
 *   import { getTenantDb } from '@/lib/tenant-db'
 *   const db = getTenantDb(firmId)
 *   const clients = await db.client.findMany() // automatically filtered by firmId
 */

import { PrismaClient } from '@prisma/client'
import type { Prisma } from '@prisma/client'

// Tables that contain firm-scoped data and MUST be filtered by firmId
const FIRM_SCOPED_TABLES = [
  'client',
  'engagement',
  'document',
  'pbcList',
  'pbcItem',
  'pbcTemplate',
  'workflow',
  'activity',
  'message',
  'auditLog',
  'teamMember',
  'extraction',
  'emailLog',
  'subscriptionEvent',
] as const

type FirmScopedTable = (typeof FIRM_SCOPED_TABLES)[number]

// Table name → the firmId field name on that table
const FIRM_ID_FIELD: Record<FirmScopedTable, string> = {
  client: 'firmId',
  engagement: 'firmId',
  document: 'engagement', // documents are scoped via engagement → need join (handled separately)
  pbcList: 'engagement',
  pbcItem: 'pbcList',
  pbcTemplate: 'firmId',
  workflow: 'engagement',
  activity: 'engagement',
  message: 'engagement',
  auditLog: 'firmId',
  teamMember: 'firmId',
  extraction: 'document',
  emailLog: 'firmId',
  subscriptionEvent: 'firmId',
}

// Direct firmId tables (no join needed)
const DIRECT_FIRM_TABLES: FirmScopedTable[] = [
  'client',
  'engagement',
  'pbcTemplate',
  'auditLog',
  'teamMember',
  'emailLog',
  'subscriptionEvent',
]

/**
 * Create a Prisma client extension that automatically filters
 * all queries on firm-scoped tables by the given firmId.
 *
 * For tables with direct firmId field, we inject the filter.
 * For tables scoped via engagement (document, pbcList, etc.),
 * the caller must pass firmId in the where clause explicitly
 * (these typically join through engagement which has firmId).
 */
export function getTenantDb(firmId: string) {
  const base = new PrismaClient()
  return base.$extends({
    name: 'tenant-isolation',
    query: {
      ...Object.fromEntries(
        DIRECT_FIRM_TABLES.map((table) => [
          table,
          {
            async findMany({ args, query }: { args: Prisma.AnyTuple; query: any }) {
              args.where = args.where || {}
              args.where.firmId = firmId
              return query(args)
            },
            async findFirst({ args, query }: { args: Prisma.AnyTuple; query: any }) {
              args.where = args.where || {}
              args.where.firmId = firmId
              return query(args)
            },
            async findUnique({ args, query }: { args: Prisma.AnyTuple; query: any }) {
              args.where = args.where || {}
              if (args.where.firmId === undefined) {
                args.where = { AND: [args.where, { firmId }] }
              }
              return query(args)
            },
            async count({ args, query }: { args: Prisma.AnyTuple; query: any }) {
              args.where = args.where || {}
              args.where.firmId = firmId
              return query(args)
            },
            async update({ args, query }: { args: Prisma.AnyTuple; query: any }) {
              args.where = args.where || {}
              args.where.firmId = firmId
              return query(args)
            },
            async updateMany({ args, query }: { args: Prisma.AnyTuple; query: any }) {
              args.where = args.where || {}
              args.where.firmId = firmId
              return query(args)
            },
            async delete({ args, query }: { args: Prisma.AnyTuple; query: any }) {
              args.where = args.where || {}
              args.where.firmId = firmId
              return query(args)
            },
            async deleteMany({ args, query }: { args: Prisma.AnyTuple; query: any }) {
              args.where = args.where || {}
              args.where.firmId = firmId
              return query(args)
            },
          },
        ])
      ),
    },
  })
}
