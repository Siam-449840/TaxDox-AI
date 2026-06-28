// TaxDox AI — Database seed script
// Run with: bun run db:seed

import { PrismaClient } from '@prisma/client'
import { nanoid } from 'nanoid'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()
const DEMO_PASSWORD = await bcrypt.hash('TaxDox2025!', 12)

function maskedSSN(last4: string) {
  return `***-**-${last4}`
}
function maskedEIN(mid: string) {
  return `**-${mid}`
}

const TEAM = [
  { name: 'Sarah Chen', role: 'Tax Partner', email: 'sarah.chen@meridiancpa.com', capacity: 12, color: 'emerald' },
  { name: 'Michael Torres', role: 'Tax Manager', email: 'm.torres@meridiancpa.com', capacity: 10, color: 'blue' },
  { name: 'Lisa Park', role: 'Senior Preparer', email: 'lisa.park@meridiancpa.com', capacity: 10, color: 'amber' },
  { name: 'James Okafor', role: 'Preparer', email: 'j.okafor@meridiancpa.com', capacity: 8, color: 'violet' },
  { name: 'Priya Sharma', role: 'Preparer', email: 'priya.s@meridiancpa.com', capacity: 8, color: 'cyan' },
  { name: 'David Kim', role: 'Admin', email: 'david.kim@meridiancpa.com', capacity: 5, color: 'rose' },
]

const CLIENTS = [
  { name: 'Acme Corp', email: 'cfo@acmecorp.example', phone: '+1 (415) 555-0142', type: 'business', taxId: maskedEIN('3456789'), country: 'US' },
  { name: 'John Smith', email: 'john.smith@example.com', phone: '+1 (415) 555-0188', type: 'individual', taxId: maskedSSN('1234'), country: 'US' },
  { name: 'Smith LLC', email: 'ops@smithllc.example', phone: '+1 (415) 555-0199', type: 'business', taxId: maskedEIN('7788990'), country: 'US' },
  { name: 'Williams Holdings', email: 'tax@williamsholdings.example', phone: '+1 (415) 555-0177', type: 'business', taxId: maskedEIN('1122334'), country: 'US' },
  { name: 'Maria Garcia', email: 'maria.garcia@example.com', phone: '+1 (415) 555-0155', type: 'individual', taxId: maskedSSN('5678'), country: 'US' },
  { name: 'Johnson Family Trust', email: 'trustee@johnsontrust.example', phone: '+1 (415) 555-0166', type: 'trust', taxId: maskedEIN('5544332'), country: 'US' },
  { name: 'Greenfield Nonprofit', email: 'director@greenfield.example', phone: '+1 (415) 555-0133', type: 'nonprofit', taxId: maskedEIN('8899001'), country: 'US' },
  { name: 'Robert Chen', email: 'robert.chen@example.com', phone: '+1 (415) 555-0122', type: 'individual', taxId: maskedSSN('9012'), country: 'US' },
  { name: 'Northwind Trading Ltd', email: 'accounts@northwind.example', phone: '+1 (415) 555-0111', type: 'business', taxId: maskedEIN('4455667'), country: 'US' },
  { name: 'Emily Johnson', email: 'emily.johnson@example.com', phone: '+1 (415) 555-0100', type: 'individual', taxId: maskedSSN('3456'), country: 'US' },
  { name: 'Thames Enterprises', email: 'finance@thames.example', phone: '+44 20 7946 0123', type: 'business', taxId: maskedEIN('2233445'), country: 'UK' },
  { name: 'Maple Leaf Consulting', email: 'tax@mapleleaf.example', phone: '+1 (416) 555-0199', type: 'business', taxId: maskedEIN('9988776'), country: 'CA' },
]

const ENGAGEMENTS = [
  { clientIdx: 0, type: '1120', year: 2025, status: 'collecting', priority: 'high', progress: 85, fee: 8500, deadline: '2026-04-15', assignedIdx: 0 },
  { clientIdx: 1, type: '1040', year: 2025, status: 'review', priority: 'high', progress: 100, fee: 1200, deadline: '2026-04-15', assignedIdx: 2 },
  { clientIdx: 2, type: '1065', year: 2025, status: 'processing', priority: 'medium', progress: 45, fee: 4200, deadline: '2026-04-15', assignedIdx: 1 },
  { clientIdx: 3, type: '1120', year: 2025, status: 'collecting', priority: 'low', progress: 20, fee: 6800, deadline: '2026-04-15', assignedIdx: 3 },
  { clientIdx: 4, type: '1040', year: 2025, status: 'pbc_sent', priority: 'medium', progress: 15, fee: 950, deadline: '2026-04-15', assignedIdx: 4 },
  { clientIdx: 5, type: '1041', year: 2025, status: 'collecting', priority: 'high', progress: 60, fee: 3200, deadline: '2026-04-15', assignedIdx: 0 },
  { clientIdx: 6, type: '1120', year: 2025, status: 'created', priority: 'low', progress: 0, fee: 2400, deadline: '2026-05-15', assignedIdx: 1 },
  { clientIdx: 7, type: '1040', year: 2025, status: 'done', priority: 'medium', progress: 100, fee: 1100, deadline: '2026-03-15', assignedIdx: 2 },
  { clientIdx: 8, type: '1065', year: 2025, status: 'filing', priority: 'high', progress: 92, fee: 5400, deadline: '2026-04-15', assignedIdx: 0 },
  { clientIdx: 9, type: '1040', year: 2025, status: 'collecting', priority: 'medium', progress: 55, fee: 1300, deadline: '2026-04-15', assignedIdx: 3 },
  { clientIdx: 10, type: '1120', year: 2025, status: 'pbc_sent', priority: 'medium', progress: 10, fee: 4800, deadline: '2026-04-15', assignedIdx: 4 },
  { clientIdx: 11, type: '1065', year: 2025, status: 'collecting', priority: 'low', progress: 35, fee: 3900, deadline: '2026-04-15', assignedIdx: 1 },
]

// PBC items for a 1040 individual engagement
const PBC_1040_ITEMS = [
  { documentType: 'W-2', description: 'All W-2 wage statements (2025)', category: 'income', required: true, priority: 'high' },
  { documentType: '1099-NEC', description: '1099-NEC for freelance/contract work', category: 'income', required: true, priority: 'high' },
  { documentType: '1099-INT', description: '1099-INT for bank interest', category: 'income', required: true, priority: 'medium' },
  { documentType: '1099-DIV', description: '1099-DIV for dividends', category: 'income', required: false, priority: 'medium' },
  { documentType: '1099-B', description: '1099-B for broker transactions', category: 'investment', required: false, priority: 'medium' },
  { documentType: '1099-R', description: '1099-R for retirement distributions', category: 'income', required: false, priority: 'medium' },
  { documentType: 'K-1', description: 'Schedule K-1 from partnerships/S-corps/trusts', category: 'income', required: false, priority: 'high' },
  { documentType: '1098', description: 'Form 1098 mortgage interest statement', category: 'deduction', required: true, priority: 'medium' },
  { documentType: 'Property-Tax', description: 'Property tax bills paid in 2025', category: 'realestate', required: true, priority: 'medium' },
  { documentType: 'Charity-Receipt', description: 'Charitable donation receipts', category: 'deduction', required: false, priority: 'low' },
  { documentType: '1098-T', description: '1098-T for education expenses', category: 'deduction', required: false, priority: 'low' },
  { documentType: 'Drivers-License', description: "Copy of driver's license (ID verification)", category: 'identity', required: true, priority: 'high' },
]

const PBC_1120_ITEMS = [
  { documentType: 'P&L', description: 'Profit & Loss statement (full year 2025)', category: 'business', required: true, priority: 'high' },
  { documentType: 'Balance-Sheet', description: 'Balance sheet as of 12/31/2025', category: 'business', required: true, priority: 'high' },
  { documentType: 'Bank-Statement', description: 'Bank statements (all accounts, full year)', category: 'business', required: true, priority: 'high' },
  { documentType: 'Payroll-Report', description: 'Payroll registers & 941s', category: 'business', required: true, priority: 'high' },
  { documentType: '1099-NEC', description: 'Copies of 1099-NEC issued to contractors', category: 'income', required: true, priority: 'medium' },
  { documentType: 'W-2', description: 'Copies of W-2 issued to employees', category: 'income', required: true, priority: 'medium' },
  { documentType: 'Property-Tax', description: 'Business personal property tax', category: 'realestate', required: false, priority: 'low' },
  { documentType: 'K-1', description: 'Prior year K-1s received', category: 'income', required: false, priority: 'medium' },
]

const PBC_1065_ITEMS = [
  { documentType: 'P&L', description: 'Partnership P&L statement (2025)', category: 'business', required: true, priority: 'high' },
  { documentType: 'Balance-Sheet', description: 'Partnership balance sheet', category: 'business', required: true, priority: 'high' },
  { documentType: 'Bank-Statement', description: 'All partnership bank statements', category: 'business', required: true, priority: 'high' },
  { documentType: 'K-1', description: 'Prior year K-1s', category: 'income', required: true, priority: 'high' },
  { documentType: 'Payroll-Report', description: 'Payroll reports (if applicable)', category: 'business', required: false, priority: 'medium' },
  { documentType: '1099-NEC', description: '1099-NEC issued to contractors', category: 'income', required: true, priority: 'medium' },
]

function getPbcItems(type: string) {
  if (type === '1040' || type === '1041') return PBC_1040_ITEMS
  if (type === '1120' || type === '1120S') return PBC_1120_ITEMS
  return PBC_1065_ITEMS
}

// Sample extraction data per document type
function getExtractions(docType: string) {
  const map: Record<string, { fieldName: string; fieldLabel: string; fieldValue: string; fieldGroup: string; confidence: number }[]> = {
    'W-2': [
      { fieldName: 'employer_name', fieldLabel: 'Employer Name', fieldValue: 'Acme Corp', fieldGroup: 'employer', confidence: 0.98 },
      { fieldName: 'employer_ein', fieldLabel: 'Employer EIN', fieldValue: '12-3456789', fieldGroup: 'employer', confidence: 0.97 },
      { fieldName: 'employee_name', fieldLabel: 'Employee Name', fieldValue: 'John Smith', fieldGroup: 'employee', confidence: 0.99 },
      { fieldName: 'employee_ssn', fieldLabel: 'Employee SSN', fieldValue: '***-**-1234', fieldGroup: 'employee', confidence: 0.96 },
      { fieldName: 'box1_wages', fieldLabel: 'Box 1: Wages', fieldValue: '$145,820.00', fieldGroup: 'income', confidence: 0.99 },
      { fieldName: 'box2_federal_tax', fieldLabel: 'Box 2: Federal Tax Withheld', fieldValue: '$28,450.00', fieldGroup: 'tax', confidence: 0.98 },
      { fieldName: 'box3_ss_wages', fieldLabel: 'Box 3: Social Security Wages', fieldValue: '$145,820.00', fieldGroup: 'income', confidence: 0.97 },
      { fieldName: 'box4_ss_tax', fieldLabel: 'Box 4: SS Tax Withheld', fieldValue: '$9,040.84', fieldGroup: 'tax', confidence: 0.97 },
      { fieldName: 'box5_medicare_wages', fieldLabel: 'Box 5: Medicare Wages', fieldValue: '$145,820.00', fieldGroup: 'income', confidence: 0.99 },
      { fieldName: 'box6_medicare_tax', fieldLabel: 'Box 6: Medicare Tax Withheld', fieldValue: '$2,114.39', fieldGroup: 'tax', confidence: 0.98 },
    ],
    '1099-INT': [
      { fieldName: 'payer_name', fieldLabel: 'Payer Name', fieldValue: 'First National Bank', fieldGroup: 'payer', confidence: 0.98 },
      { fieldName: 'recipient_name', fieldLabel: 'Recipient Name', fieldValue: 'John Smith', fieldGroup: 'recipient', confidence: 0.99 },
      { fieldName: 'box1_interest', fieldLabel: 'Box 1: Interest Income', fieldValue: '$842.50', fieldGroup: 'income', confidence: 0.97 },
      { fieldName: 'box4_federal_tax', fieldLabel: 'Box 4: Federal Tax Withheld', fieldValue: '$0.00', fieldGroup: 'tax', confidence: 0.95 },
    ],
    '1099-DIV': [
      { fieldName: 'payer_name', fieldLabel: 'Payer Name', fieldValue: 'Vanguard Brokerage', fieldGroup: 'payer', confidence: 0.97 },
      { fieldName: 'recipient_name', fieldLabel: 'Recipient Name', fieldValue: 'John Smith', fieldGroup: 'recipient', confidence: 0.99 },
      { fieldName: 'box1a_total', fieldLabel: 'Box 1a: Total Ordinary Dividends', fieldValue: '$3,240.75', fieldGroup: 'income', confidence: 0.96 },
      { fieldName: 'box1b_qualified', fieldLabel: 'Box 1b: Qualified Dividends', fieldValue: '$2,890.30', fieldGroup: 'income', confidence: 0.92 },
      { fieldName: 'box2a_capital_gain', fieldLabel: 'Box 2a: Capital Gain Distribution', fieldValue: '$1,120.00', fieldGroup: 'income', confidence: 0.88 },
    ],
    'K-1': [
      { fieldName: 'entity_name', fieldLabel: 'Entity Name', fieldValue: 'Acme Partners LLC', fieldGroup: 'entity', confidence: 0.98 },
      { fieldName: 'entity_ein', fieldLabel: 'Entity EIN', fieldValue: '12-3456789', fieldGroup: 'entity', confidence: 0.96 },
      { fieldName: 'entity_type', fieldLabel: 'Entity Type', fieldValue: 'Partnership (1065)', fieldGroup: 'entity', confidence: 0.99 },
      { fieldName: 'partner_name', fieldLabel: 'Partner Name', fieldValue: 'John Smith', fieldGroup: 'partner', confidence: 0.99 },
      { fieldName: 'partner_ssn', fieldLabel: 'Partner SSN', fieldValue: '***-**-1234', fieldGroup: 'partner', confidence: 0.95 },
      { fieldName: 'ownership_pct', fieldLabel: 'Ownership %', fieldValue: '33.3%', fieldGroup: 'partner', confidence: 0.97 },
      { fieldName: 'ordinary_income', fieldLabel: 'Ordinary Business Income', fieldValue: '$250,000', fieldGroup: 'income', confidence: 0.98 },
      { fieldName: 'rental_income', fieldLabel: 'Net Rental Income', fieldValue: '$12,000', fieldGroup: 'income', confidence: 0.95 },
      { fieldName: 'interest_income', fieldLabel: 'Interest Income', fieldValue: '$1,500', fieldGroup: 'income', confidence: 0.96 },
      { fieldName: 'capital_gain', fieldLabel: 'Capital Gains', fieldValue: '$8,000', fieldGroup: 'income', confidence: 0.85 },
    ],
    '1098': [
      { fieldName: 'lender_name', fieldLabel: 'Lender Name', fieldValue: 'Wells Fargo Home Mortgage', fieldGroup: 'lender', confidence: 0.98 },
      { fieldName: 'borrower_name', fieldLabel: 'Borrower Name', fieldValue: 'John Smith', fieldGroup: 'borrower', confidence: 0.99 },
      { fieldName: 'box1_mortgage_interest', fieldLabel: 'Box 1: Mortgage Interest', fieldValue: '$18,420.00', fieldGroup: 'deduction', confidence: 0.99 },
      { fieldName: 'box2_outstanding', fieldLabel: 'Box 2: Outstanding Mortgage Principal', fieldValue: '$420,000.00', fieldGroup: 'other', confidence: 0.94 },
    ],
    'P&L': [
      { fieldName: 'business_name', fieldLabel: 'Business Name', fieldValue: 'Acme Corp', fieldGroup: 'business', confidence: 0.99 },
      { fieldName: 'period', fieldLabel: 'Reporting Period', fieldValue: 'Jan 1 - Dec 31, 2025', fieldGroup: 'period', confidence: 0.97 },
      { fieldName: 'total_revenue', fieldLabel: 'Total Revenue', fieldValue: '$2,840,000', fieldGroup: 'income', confidence: 0.96 },
      { fieldName: 'total_expenses', fieldLabel: 'Total Expenses', fieldValue: '$2,120,000', fieldGroup: 'deduction', confidence: 0.95 },
      { fieldName: 'net_income', fieldLabel: 'Net Income', fieldValue: '$720,000', fieldGroup: 'income', confidence: 0.97 },
    ],
    'Bank-Statement': [
      { fieldName: 'bank_name', fieldLabel: 'Bank Name', fieldValue: 'Chase Bank', fieldGroup: 'bank', confidence: 0.98 },
      { fieldName: 'account_holder', fieldLabel: 'Account Holder', fieldValue: 'Acme Corp', fieldGroup: 'account', confidence: 0.99 },
      { fieldName: 'account_number', fieldLabel: 'Account Number (masked)', fieldValue: '****8842', fieldGroup: 'account', confidence: 0.96 },
      { fieldName: 'period', fieldLabel: 'Statement Period', fieldValue: 'Dec 2025', fieldGroup: 'period', confidence: 0.97 },
      { fieldName: 'ending_balance', fieldLabel: 'Ending Balance', fieldValue: '$845,230.00', fieldGroup: 'balance', confidence: 0.94 },
    ],
  }
  return map[docType] || []
}

async function main() {
  console.log('🌱 Seeding TaxDox AI database...')

  // Clean
  await db.subscriptionEvent.deleteMany()
  await db.auditLog.deleteMany()
  await db.activity.deleteMany()
  await db.message.deleteMany()
  await db.extraction.deleteMany()
  await db.document.deleteMany()
  await db.pbcItem.deleteMany()
  await db.pbcList.deleteMany()
  await db.workflow.deleteMany()
  await db.engagement.deleteMany()
  await db.client.deleteMany()
  await db.teamMember.deleteMany()
  await db.pbcTemplate.deleteMany()
  await db.session.deleteMany()
  await db.account.deleteMany()
  await db.user.deleteMany()
  await db.firm.deleteMany()

  // Firm
  const firm = await db.firm.create({
    data: {
      name: 'Meridian CPA Group',
      subscriptionTier: 'business',
      subscriptionStatus: 'active',
      country: 'US',
      settings: JSON.stringify({ taxSoftware: ['ultratax', 'cch'], multiCountry: true }),
    },
  })

  // Users — create one User per team member so engagements can be assigned properly
  const users = []
  for (const t of TEAM) {
    const u = await db.user.create({
      data: {
        firmId: firm.id,
        email: t.email,
        name: t.name,
        password: DEMO_PASSWORD,
        role: t.role.toLowerCase().includes('partner')
          ? 'partner'
          : t.role.toLowerCase().includes('manager')
            ? 'manager'
            : t.role.toLowerCase().includes('admin')
              ? 'admin'
              : 'preparer',
        status: 'active',
        emailVerified: new Date(),
      },
    })
    users.push(u)
  }
  const user = users[0] // Sarah Chen — primary user for audit logs

  // Team members
  const teamMembers = []
  for (let i = 0; i < TEAM.length; i++) {
    const t = TEAM[i]
    const tm = await db.teamMember.create({
      data: {
        firmId: firm.id,
        name: t.name,
        role: t.role,
        email: t.email,
        capacity: t.capacity,
        currentLoad: Math.floor(t.capacity * (0.5 + Math.random() * 0.5)),
        color: t.color,
      },
    })
    teamMembers.push(tm)
  }

  // Clients
  const clients = []
  for (const c of CLIENTS) {
    const client = await db.client.create({
      data: {
        firmId: firm.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        taxId: c.taxId,
        clientType: c.type,
        status: 'active',
        country: c.country,
        metadata: JSON.stringify({ industry: c.type === 'business' ? 'Technology' : undefined }),
      },
    })
    clients.push(client)
  }

  // Engagements with PBC lists & documents
  for (const e of ENGAGEMENTS) {
    const client = clients[e.clientIdx]
    const assignedUser = users[e.assignedIdx] || users[0]
    const pbcItems = getPbcItems(e.type)

    const engagement = await db.engagement.create({
      data: {
        firmId: firm.id,
        clientId: client.id,
        taxYear: e.year,
        engagementType: e.type,
        status: e.status,
        priority: e.priority,
        progress: e.progress,
        fee: e.fee,
        deadline: new Date(e.deadline),
        assignedToId: assignedUser.id,
        notes: `${e.type} tax return for ${client.name} — tax year ${e.year}`,
      },
    })

    // PBC List
    const pbcList = await db.pbcList.create({
      data: {
        engagementId: engagement.id,
        name: `${e.type} ${e.year} — ${client.name}`,
        sentAt: e.status !== 'created' ? new Date(Date.now() - 7 * 86400000) : null,
        sentVia: 'email',
      },
    })

    // PBC Items
    let uploadedCount = 0
    const totalItems = pbcItems.length
    const targetUploaded = Math.floor((e.progress / 100) * totalItems)
    for (let i = 0; i < pbcItems.length; i++) {
      const item = pbcItems[i]
      let status = 'pending'
      if (i < targetUploaded) {
        if (i < targetUploaded * 0.6) status = 'extracted'
        else if (i < targetUploaded * 0.8) status = 'processing'
        else status = 'uploaded'
        uploadedCount++
      }
      const pbcItem = await db.pbcItem.create({
        data: {
          pbcListId: pbcList.id,
          documentType: item.documentType,
          description: item.description,
          category: item.category,
          required: item.required,
          priority: item.priority as 'high' | 'medium' | 'low',
          expectedFormat: 'pdf',
          orderIndex: i,
          status,
        },
      })

      // Create document for uploaded items
      if (status !== 'pending') {
        const docType = item.documentType
        const now = Date.now()
        const uploadedAt = new Date(now - (uploadedCount * 3600000 + Math.random() * 86400000))
        const docStatus = status === 'extracted' ? 'processed' : status === 'processing' ? 'processing' : 'uploaded'

        const doc = await db.document.create({
          data: {
            clientId: client.id,
            engagementId: engagement.id,
            pbcItemId: pbcItem.id,
            originalFilename: `${docType.replace(/[^a-z0-9]/gi, '_')}_${client.name.replace(/\s/g, '')}_${e.year}.pdf`,
            storedFilename: `${nanoid()}.pdf`,
            fileSize: Math.floor(50000 + Math.random() * 2000000),
            mimeType: 'application/pdf',
            documentType: docType,
            confidence: 0.85 + Math.random() * 0.14,
            status: docStatus,
            uploadedBy: 'client',
            uploadedAt,
            processedAt: docStatus === 'processed' ? new Date(uploadedAt.getTime() + 120000) : null,
          },
        })

        // Extractions for processed docs
        if (docStatus === 'processed') {
          const extractions = getExtractions(docType)
          for (const ext of extractions) {
            await db.extraction.create({
              data: {
                documentId: doc.id,
                fieldName: ext.fieldName,
                fieldLabel: ext.fieldLabel,
                fieldValue: ext.fieldValue,
                fieldGroup: ext.fieldGroup,
                confidence: ext.confidence,
                sourceLocation: `page 1, box`,
                isVerified: ext.confidence > 0.9,
                verifiedAt: ext.confidence > 0.9 ? new Date() : null,
              },
            })
          }
        }

        // Activity
        await db.activity.create({
          data: {
            engagementId: engagement.id,
            documentId: doc.id,
            type: 'upload',
            description: `Client uploaded ${docType}`,
            actor: client.name,
          },
        })
        if (docStatus === 'processed') {
          await db.activity.create({
            data: {
              engagementId: engagement.id,
              documentId: doc.id,
              type: 'extract',
              description: `AI extracted ${getExtractions(docType).length} fields from ${docType}`,
              actor: 'TaxDox AI',
            },
          })
        }
      }
    }

    // Workflow steps
    const steps = ['create', 'pbc_send', 'collection', 'ai_processing', 'human_review', 'tax_import', 'filing', 'delivery']
    const activeStepIdx = Math.floor((e.progress / 100) * (steps.length - 1))
    for (let i = 0; i < steps.length; i++) {
      let stepStatus = 'pending'
      if (i < activeStepIdx) stepStatus = 'completed'
      else if (i === activeStepIdx && e.progress < 100) stepStatus = 'in_progress'
      else if (e.progress === 100) stepStatus = 'completed'
      await db.workflow.create({
        data: {
          engagementId: engagement.id,
          step: steps[i],
          status: stepStatus,
          assignedToId: i >= 3 ? assignedUser.id : undefined,
          startedAt: i <= activeStepIdx ? new Date(Date.now() - (activeStepIdx - i) * 86400000) : null,
          completedAt: i < activeStepIdx ? new Date(Date.now() - (activeStepIdx - i - 1) * 86400000) : null,
        },
      })
    }

    // Messages
    if (e.status !== 'created') {
      await db.message.create({
        data: {
          engagementId: engagement.id,
          clientId: client.id,
          fromType: 'user',
          content: `Hi ${client.name.split(' ')[0]}, we've sent you the PBC document request list for your ${e.type} ${e.year} return. Please upload at your earliest convenience.`,
          read: true,
        },
      })
      await db.message.create({
        data: {
          engagementId: engagement.id,
          clientId: client.id,
          fromType: 'client',
          content: 'Thanks, I will start uploading the documents today.',
          read: true,
        },
      })
    }
  }

  // PBC Templates
  await db.pbcTemplate.create({
    data: {
      firmId: firm.id,
      name: 'Standard 1040 Individual',
      description: 'Comprehensive PBC list for individual tax returns',
      clientType: 'individual',
      engagementType: '1040',
      items: JSON.stringify(PBC_1040_ITEMS),
      isDefault: true,
    },
  })
  await db.pbcTemplate.create({
    data: {
      firmId: firm.id,
      name: 'Corporate 1120',
      description: 'PBC list for C-Corporation tax returns',
      clientType: 'business',
      engagementType: '1120',
      items: JSON.stringify(PBC_1120_ITEMS),
      isDefault: true,
    },
  })
  await db.pbcTemplate.create({
    data: {
      firmId: firm.id,
      name: 'Partnership 1065',
      description: 'PBC list for partnership tax returns',
      clientType: 'business',
      engagementType: '1065',
      items: JSON.stringify(PBC_1065_ITEMS),
      isDefault: true,
    },
  })

  // Audit logs
  await db.auditLog.create({
    data: {
      firmId: firm.id,
      userId: user.id,
      action: 'firm.login',
      resourceType: 'auth',
      details: JSON.stringify({ method: 'password' }),
      ipAddress: '192.168.1.1',
    },
  })
  await db.auditLog.create({
    data: {
      firmId: firm.id,
      userId: user.id,
      action: 'engagement.created',
      resourceType: 'engagement',
      details: JSON.stringify({ count: ENGAGEMENTS.length }),
      ipAddress: '192.168.1.1',
    },
  })

  const stats = {
    firm: 1,
    team: teamMembers.length,
    clients: clients.length,
    engagements: ENGAGEMENTS.length,
  }
  console.log('✅ Seed complete:', stats)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
