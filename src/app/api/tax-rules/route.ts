import { NextResponse } from 'next/server'

// Tax rules reference data for supported countries
// This serves as the configurable tax rules engine reference

const TAX_RULES = {
  US: {
    country: 'United States',
    flag: '🇺🇸',
    taxYear: 2025,
    currency: 'USD',
    filingDeadline: 'April 15, 2026',
    extensionDeadline: 'October 15, 2026',
    federal: {
      standardDeduction: [
        { status: 'Single', amount: 14600 },
        { status: 'Married Filing Jointly', amount: 29200 },
        { status: 'Married Filing Separately', amount: 14600 },
        { status: 'Head of Household', amount: 21900 },
      ],
      taxBrackets: [
        { rate: '10%', single: '0 – 11,600', mfj: '0 – 23,200', hoh: '0 – 16,550' },
        { rate: '12%', single: '11,601 – 47,150', mfj: '23,201 – 94,300', hoh: '16,551 – 63,100' },
        { rate: '22%', single: '47,151 – 100,525', mfj: '94,301 – 201,050', hoh: '63,101 – 100,500' },
        { rate: '24%', single: '100,526 – 191,950', mfj: '201,051 – 383,900', hoh: '100,501 – 191,950' },
        { rate: '32%', single: '191,951 – 243,725', mfj: '383,901 – 487,450', hoh: '191,951 – 243,700' },
        { rate: '35%', single: '243,726 – 609,350', mfj: '487,451 – 731,200', hoh: '243,701 – 609,350' },
        { rate: '37%', single: '609,350+', mfj: '731,200+', hoh: '609,350+' },
      ],
      keyCredits: [
        { name: 'Child Tax Credit', amount: '$2,000 per child under 17' },
        { name: 'Earned Income Tax Credit', amount: 'Up to $7,830 (3+ kids)' },
        { name: 'American Opportunity Credit', amount: 'Up to $2,500 per student' },
        { name: 'Lifetime Learning Credit', amount: 'Up to $2,000 per return' },
        { name: 'Saver\'s Credit', amount: 'Up to $1,000 ($2,000 MFJ)' },
      ],
      keyLimits: [
        { name: '401(k) Contribution Limit', amount: '$23,000 (+$7,500 catch-up 50+)' },
        { name: 'IRA Contribution Limit', amount: '$7,000 (+$1,000 catch-up 50+)' },
        { name: 'HSA Contribution (Family)', amount: '$8,300 (+$1,000 catch-up 55+)' },
        { name: 'FSA Contribution Limit', amount: '$3,300' },
        { name: 'Gift Tax Exclusion', amount: '$18,000 per recipient' },
        { name: 'Estate Tax Exemption', amount: '$13.61 million per person' },
      ],
    },
    keyForms: [
      { form: '1040', description: 'Individual Income Tax Return' },
      { form: '1065', description: 'Partnership Return' },
      { form: '1120', description: 'C Corporation Return' },
      { form: '1120S', description: 'S Corporation Return' },
      { form: '1041', description: 'Estate/Trust Return' },
    ],
  },
  UK: {
    country: 'United Kingdom',
    flag: '🇬🇧',
    taxYear: '2025/26 (Apr 6 – Apr 5)',
    currency: 'GBP',
    filingDeadline: 'January 31, 2027 (Self-Assessment)',
    federal: {
      standardDeduction: [
        { status: 'Personal Allowance', amount: 12570 },
      ],
      taxBrackets: [
        { rate: '0% (Personal Allowance)', single: '0 – 12,570', mfj: '—', hoh: '—' },
        { rate: '20% (Basic Rate)', single: '12,571 – 50,270', mfj: '—', hoh: '—' },
        { rate: '40% (Higher Rate)', single: '50,271 – 125,140', mfj: '—', hoh: '—' },
        { rate: '45% (Additional Rate)', single: '125,140+', mfj: '—', hoh: '—' },
      ],
      keyCredits: [
        { name: 'Marriage Allowance', amount: 'Transfer £1,260 of Personal Allowance' },
        { name: 'Blind Person\'s Allowance', amount: '£3,070' },
        { name: 'Married Couple\'s Allowance', amount: 'Up to £11,080 (born before Apr 1935)' },
      ],
      keyLimits: [
        { name: 'ISA Annual Limit', amount: '£20,000' },
        { name: 'Pension Annual Allowance', amount: '£60,000' },
        { name: 'Capital Gains Annual Exempt Amount', amount: '£3,000' },
        { name: 'Inheritance Tax Threshold', amount: '£325,000' },
      ],
    },
    keyForms: [
      { form: 'SA100', description: 'Self-Assessment Tax Return' },
      { form: 'P60', description: 'End of Year Certificate (employer)' },
      { form: 'P45', description: 'Details of employee leaving' },
      { form: 'CT600', description: 'Company Tax Return' },
    ],
  },
  CA: {
    country: 'Canada',
    flag: '🇨🇦',
    taxYear: 2025,
    currency: 'CAD',
    filingDeadline: 'April 30, 2026',
    federal: {
      standardDeduction: [
        { status: 'Basic Personal Amount', amount: 15780 },
      ],
      taxBrackets: [
        { rate: '15%', single: '0 – 57,375', mfj: '—', hoh: '—' },
        { rate: '20.5%', single: '57,376 – 114,750', mfj: '—', hoh: '—' },
        { rate: '26%', single: '114,751 – 177,882', mfj: '—', hoh: '—' },
        { rate: '29%', single: '177,883 – 253,414', mfj: '—', hoh: '—' },
        { rate: '33%', single: '253,414+', mfj: '—', hoh: '—' },
      ],
      keyCredits: [
        { name: 'Canada Child Benefit', amount: 'Up to $7,787 (under 6)' },
        { name: 'GST/HST Credit', amount: 'Up to $519 (single)' },
        { name: 'Climate Action Incentive', amount: 'Varies by province' },
      ],
      keyLimits: [
        { name: 'RRSP Contribution', amount: '18% of prior year income (max $32,490)' },
        { name: 'TFSA Contribution', amount: '$7,000' },
        { name: 'CPP Contribution', amount: '$4,034.10' },
      ],
    },
    keyForms: [
      { form: 'T1', description: 'Personal Income Tax Return' },
      { form: 'T2', description: 'Corporate Income Tax Return' },
      { form: 'T4', description: 'Statement of Remuneration Paid' },
      { form: 'T5', description: 'Statement of Investment Income' },
    ],
  },
}

export async function GET() {
  return NextResponse.json({
    countries: TAX_RULES,
    supportedCountries: Object.keys(TAX_RULES).map((code) => ({
      code,
      name: TAX_RULES[code as keyof typeof TAX_RULES].country,
      flag: TAX_RULES[code as keyof typeof TAX_RULES].flag,
    })),
  })
}
