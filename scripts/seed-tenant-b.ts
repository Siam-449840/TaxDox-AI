/**
 * Creates a SECOND tenant (Firm B) so cross-tenant IDOR/isolation can be
 * validated at runtime. Firm A is the seeded "Meridian CPA Group".
 *
 * Produces:
 *   - Firm B: "Atlas Tax Partners"
 *   - User:   partner@ataxpartners.example / AtlasValidation2025!  (role: partner)
 *   - 1 client + 1 engagement + 1 PBC list + 1 PBC item (uploaded doc)
 *
 * Run: bun scripts/seed-tenant-b.ts
 */
import { PrismaClient } from '@prisma/client'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()
// Read the seed password from env (never commit a real one). A random one is
// generated + printed once if SEED_TENANT_B_PASSWORD is unset, so this script
// can never accidentally be run against a non-local DB with a known password.
const SEED_PASSWORD = process.env.SEED_TENANT_B_PASSWORD || (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SEED_TENANT_B_PASSWORD must be set in production (refusing to use a generated password)')
  }
  const generated = `Atlas-${crypto.randomBytes(6).toString('hex')}!`
  console.log('⚠️  Generated ephemeral seed password (set SEED_TENANT_B_PASSWORD to pin it):', generated)
  return generated
})()
const PWD = await bcrypt.hash(SEED_PASSWORD, 12)

async function main() {
  console.log('🌐 Seeding second tenant (Firm B) for IDOR validation...')

  const firmB = await db.firm.create({
    data: {
      name: 'Atlas Tax Partners',
      subscriptionTier: 'professional',
      subscriptionStatus: 'active',
      country: 'US',
      settings: JSON.stringify({ taxSoftware: ['drake'], multiCountry: false }),
    },
  })

  const userB = await db.user.create({
    data: {
      firmId: firmB.id,
      email: 'partner@ataxpartners.example',
      name: 'Dana Whitfield',
      password: PWD,
      role: 'partner',
      status: 'active',
      emailVerified: new Date(),
    },
  })

  const clientB = await db.client.create({
    data: {
      firmId: firmB.id,
      name: 'Summit Logistics Inc',
      email: 'cfo@summitlogistics.example',
      phone: '+1 (212) 555-0144',
      taxId: '**-***4321',
      clientType: 'business',
      status: 'active',
      country: 'US',
    },
  })

  const engB = await db.engagement.create({
    data: {
      firmId: firmB.id,
      clientId: clientB.id,
      taxYear: 2025,
      engagementType: '1120',
      status: 'collecting',
      priority: 'high',
      progress: 50,
      fee: 9200,
      deadline: new Date('2026-04-15'),
      assignedToId: userB.id,
      notes: 'Cross-tenant validation engagement — Firm B',
    },
  })

  const pbcB = await db.pbcList.create({
    data: { engagementId: engB.id, name: '1120 2025 — Summit Logistics', sentAt: new Date(), sentVia: 'email' },
  })

  const pbcItemB = await db.pbcItem.create({
    data: {
      pbcListId: pbcB.id,
      documentType: 'P&L',
      description: 'Profit & Loss statement (full year 2025)',
      category: 'business',
      required: true,
      priority: 'high',
      expectedFormat: 'pdf',
      orderIndex: 0,
      status: 'uploaded',
    },
  })

  const docB = await db.document.create({
    data: {
      clientId: clientB.id,
      engagementId: engB.id,
      pbcItemId: pbcItemB.id,
      originalFilename: 'PL_Summit_2025.pdf',
      storedFilename: 'tenant-b-doc.svg',
      fileSize: 78000,
      mimeType: 'image/svg+xml',
      documentType: 'P&L',
      confidence: 0.9,
      status: 'uploaded',
      uploadedBy: 'client',
    },
  })

  console.log('✅ Firm B created:')
  console.log('   firmId   :', firmB.id)
  console.log('   userId   :', userB.id, '(partner@ataxpartners.example)')
  console.log('   clientId :', clientB.id)
  console.log('   engagementId:', engB.id)
  console.log('   pbcItemId:', pbcItemB.id)
  console.log('   documentId:', docB.id)
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1) })
  .finally(() => db.$disconnect())
