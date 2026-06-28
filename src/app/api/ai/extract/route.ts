import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { DOCUMENT_TYPE_MAP } from '@/lib/constants'

// Simulated AI field-level extraction endpoint.
// Generates realistic field values based on document type.
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { documentId } = body

  const document = await db.document.findUnique({
    where: { id: documentId },
    include: { extractions: true },
  })

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  if (!document.documentType || document.documentType === 'Unknown') {
    return NextResponse.json(
      { error: 'Document not classified yet' },
      { status: 400 }
    )
  }

  // Delete existing extractions
  await db.extraction.deleteMany({ where: { documentId } })

  const typeDef = DOCUMENT_TYPE_MAP[document.documentType]
  if (!typeDef) {
    return NextResponse.json({ error: 'Unknown document type' }, { status: 400 })
  }

  // Generate realistic mock extractions
  const mockValues: Record<string, string> = generateMockValues(document.documentType)

  const extractions = []
  for (const field of typeDef.fields) {
    const value = mockValues[field.name] || '—'
    const confidence = 0.82 + Math.random() * 0.17
    const ext = await db.extraction.create({
      data: {
        documentId,
        fieldName: field.name,
        fieldLabel: field.label,
        fieldValue: value,
        fieldGroup: field.group,
        confidence,
        sourceLocation: `page 1`,
        isVerified: confidence > 0.9,
        verifiedAt: confidence > 0.9 ? new Date() : null,
      },
    })
    extractions.push(ext)
  }

  await db.document.update({
    where: { id: documentId },
    data: { status: 'processed', processedAt: new Date() },
  })

  // Update PBC item status if linked
  if (document.pbcItemId) {
    await db.pbcItem.update({
      where: { id: document.pbcItemId },
      data: { status: 'extracted' },
    })
  }

  await db.activity.create({
    data: {
      engagementId: document.engagementId,
      documentId,
      type: 'extract',
      description: `AI extracted ${extractions.length} fields from ${document.documentType}`,
      actor: 'TaxDox AI',
    },
  })

  return NextResponse.json({ extractions })
}

function generateMockValues(docType: string): Record<string, string> {
  const data: Record<string, Record<string, string>> = {
    'W-2': {
      employer_name: 'Acme Corp',
      employer_ein: '12-3456789',
      employer_address: '1234 Market St, San Francisco, CA 94103',
      employee_name: 'John Smith',
      employee_ssn: '***-**-1234',
      employee_address: '456 Oak Ave, San Francisco, CA 94102',
      box1_wages: '$145,820.00',
      box2_federal_tax: '$28,450.00',
      box3_ss_wages: '$145,820.00',
      box4_ss_tax: '$9,040.84',
      box5_medicare_wages: '$145,820.00',
      box6_medicare_tax: '$2,114.39',
      box12_codes: 'D $8,000.00 | DD $14,500.00',
    },
    '1099-NEC': {
      payer_name: 'TechFlow Inc',
      payer_ein: '98-7654321',
      recipient_name: 'John Smith',
      recipient_ssn: '***-**-1234',
      nonemployee_comp: '$42,500.00',
      federal_tax: '$0.00',
    },
    '1099-INT': {
      payer_name: 'First National Bank',
      recipient_name: 'John Smith',
      box1_interest: '$842.50',
      box2_penalty: '$0.00',
      box3_savings_bond: '$0.00',
      box4_federal_tax: '$0.00',
    },
    '1099-DIV': {
      payer_name: 'Vanguard Brokerage',
      recipient_name: 'John Smith',
      box1a_total: '$3,240.75',
      box1b_qualified: '$2,890.30',
      box2a_capital_gain: '$1,120.00',
      box4_federal_tax: '$0.00',
    },
    '1099-B': {
      broker_name: 'Charles Schwab',
      recipient_name: 'John Smith',
      transaction_date: '2025-06-15',
      cost_basis: '$12,500.00',
      sales_proceeds: '$18,750.00',
      gain_loss: '$6,250.00',
    },
    '1099-R': {
      payer_name: 'Fidelity Investments',
      recipient_name: 'John Smith',
      box1_gross: '$24,000.00',
      box2a_taxable: '$24,000.00',
      box4_federal_tax: '$4,800.00',
      box7_code: '1 (Early distribution)',
    },
    'K-1': {
      entity_name: 'Acme Partners LLC',
      entity_ein: '12-3456789',
      entity_type: 'Partnership (1065)',
      partner_name: 'John Smith',
      partner_ssn: '***-**-1234',
      ownership_pct: '33.3%',
      ordinary_income: '$250,000',
      rental_income: '$12,000',
      interest_income: '$1,500',
      capital_gain: '$8,000',
      self_employment: '$83,250',
      foreign_tax: '$420',
    },
    '1098': {
      lender_name: 'Wells Fargo Home Mortgage',
      borrower_name: 'John Smith',
      borrower_ssn: '***-**-1234',
      box1_mortgage_interest: '$18,420.00',
      box2_outstanding: '$420,000.00',
      box5_property_address: '456 Oak Ave, San Francisco, CA 94102',
    },
    '1098-T': {
      school_name: 'Stanford University',
      student_name: 'Emily Smith',
      student_ssn: '***-**-5678',
      box1_payments: '$52,180.00',
      box2_billed: '$0.00',
      box5_scholarships: '$12,500.00',
    },
    'Property-Tax': {
      jurisdiction: 'San Francisco County',
      parcel_id: '1234-567-890',
      property_address: '456 Oak Ave, San Francisco, CA 94102',
      assessed_value: '$825,000',
      tax_amount: '$9,075.00',
      tax_year: '2025',
    },
    'Charity-Receipt': {
      charity_name: 'American Red Cross',
      donor_name: 'John Smith',
      donation_date: '2025-11-15',
      amount: '$2,500.00',
      goods_received: 'None',
    },
    'P&L': {
      business_name: 'Acme Corp',
      period: 'Jan 1 - Dec 31, 2025',
      total_revenue: '$2,840,000',
      total_expenses: '$2,120,000',
      net_income: '$720,000',
    },
    'Balance-Sheet': {
      business_name: 'Acme Corp',
      as_of_date: 'Dec 31, 2025',
      total_assets: '$3,450,000',
      total_liabilities: '$1,280,000',
      total_equity: '$2,170,000',
    },
    'Bank-Statement': {
      bank_name: 'Chase Bank',
      account_holder: 'Acme Corp',
      account_number: '****8842',
      period: 'Dec 2025',
      beginning_balance: '$812,450.00',
      ending_balance: '$845,230.00',
    },
    'Brokerage-Statement': {
      brokerage_name: 'Vanguard',
      account_holder: 'John Smith',
      account_number: '****3391',
      period: 'Q4 2025',
      portfolio_value: '$284,750.00',
    },
    "Drivers-License": {
      full_name: 'John Smith',
      dl_number: 'D1234567',
      dob: '1985-03-22',
      address: '456 Oak Ave, San Francisco, CA 94102',
      expiry: '2027-08-15',
    },
    Passport: {
      full_name: 'John Smith',
      passport_number: 'P12345678',
      nationality: 'United States',
      dob: '1985-03-22',
      expiry: '2028-09-10',
    },
    'Payroll-Report': {
      business_name: 'Acme Corp',
      period: 'Dec 2025',
      total_wages: '$485,200.00',
      total_tax_withheld: '$148,250.00',
      employee_count: '24',
    },
    'SSN-Card': {
      full_name: 'John Smith',
      ssn: '***-**-1234',
    },
  }
  return data[docType] || {}
}
