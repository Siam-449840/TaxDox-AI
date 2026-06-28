// TaxDox AI — Application constants & reference data

import {
  FileText,
  Receipt,
  IdCard,
  Building2,
  TrendingUp,
  Home,
  FileSpreadsheet,
} from 'lucide-react'
import type { Priority } from './types'

export const DOCUMENT_CATEGORIES = [
  { id: 'income', label: 'Income Documents', icon: TrendingUp, color: 'emerald' },
  { id: 'deduction', label: 'Deduction Documents', icon: Receipt, color: 'amber' },
  { id: 'identity', label: 'Identity Documents', icon: IdCard, color: 'violet' },
  { id: 'business', label: 'Business Documents', icon: Building2, color: 'cyan' },
  { id: 'investment', label: 'Investment Documents', icon: TrendingUp, color: 'blue' },
  { id: 'realestate', label: 'Real Estate Documents', icon: Home, color: 'orange' },
  { id: 'other', label: 'Other', icon: FileSpreadsheet, color: 'slate' },
] as const

export interface DocTypeDef {
  type: string
  label: string
  category: string
  description: string
  fields: { name: string; label: string; group: string }[]
}

export const DOCUMENT_TYPES: DocTypeDef[] = [
  {
    type: 'W-2',
    label: 'W-2 Wage & Tax Statement',
    category: 'income',
    description: 'Annual wages and tax statement from employer',
    fields: [
      { name: 'employer_ein', label: 'Employer EIN', group: 'employer' },
      { name: 'employer_name', label: 'Employer Name', group: 'employer' },
      { name: 'employer_address', label: 'Employer Address', group: 'employer' },
      { name: 'employee_ssn', label: 'Employee SSN', group: 'employee' },
      { name: 'employee_name', label: 'Employee Name', group: 'employee' },
      { name: 'employee_address', label: 'Employee Address', group: 'employee' },
      { name: 'box1_wages', label: 'Box 1: Wages', group: 'income' },
      { name: 'box2_federal_tax', label: 'Box 2: Federal Tax Withheld', group: 'tax' },
      { name: 'box3_ss_wages', label: 'Box 3: Social Security Wages', group: 'income' },
      { name: 'box4_ss_tax', label: 'Box 4: SS Tax Withheld', group: 'tax' },
      { name: 'box5_medicare_wages', label: 'Box 5: Medicare Wages', group: 'income' },
      { name: 'box6_medicare_tax', label: 'Box 6: Medicare Tax Withheld', group: 'tax' },
      { name: 'box12_codes', label: 'Box 12: Codes & Amounts', group: 'other' },
    ],
  },
  {
    type: '1099-NEC',
    label: '1099-NEC Nonemployee Compensation',
    category: 'income',
    description: 'Nonemployee compensation for contractors',
    fields: [
      { name: 'payer_name', label: 'Payer Name', group: 'payer' },
      { name: 'payer_ein', label: 'Payer EIN', group: 'payer' },
      { name: 'recipient_name', label: 'Recipient Name', group: 'recipient' },
      { name: 'recipient_ssn', label: 'Recipient SSN/EIN', group: 'recipient' },
      { name: 'nonemployee_comp', label: 'Nonemployee Compensation', group: 'income' },
      { name: 'federal_tax', label: 'Federal Tax Withheld', group: 'tax' },
    ],
  },
  {
    type: '1099-INT',
    label: '1099-INT Interest Income',
    category: 'income',
    description: 'Interest income from banks/institutions',
    fields: [
      { name: 'payer_name', label: 'Payer Name', group: 'payer' },
      { name: 'recipient_name', label: 'Recipient Name', group: 'recipient' },
      { name: 'box1_interest', label: 'Box 1: Interest Income', group: 'income' },
      { name: 'box2_penalty', label: 'Box 2: Early Withdrawal Penalty', group: 'other' },
      { name: 'box3_savings_bond', label: 'Box 3: US Savings Bond Interest', group: 'income' },
      { name: 'box4_federal_tax', label: 'Box 4: Federal Tax Withheld', group: 'tax' },
    ],
  },
  {
    type: '1099-DIV',
    label: '1099-DIV Dividend Income',
    category: 'income',
    description: 'Dividend and distribution income',
    fields: [
      { name: 'payer_name', label: 'Payer Name', group: 'payer' },
      { name: 'recipient_name', label: 'Recipient Name', group: 'recipient' },
      { name: 'box1a_total', label: 'Box 1a: Total Ordinary Dividends', group: 'income' },
      { name: 'box1b_qualified', label: 'Box 1b: Qualified Dividends', group: 'income' },
      { name: 'box2a_capital_gain', label: 'Box 2a: Capital Gain Distribution', group: 'income' },
      { name: 'box4_federal_tax', label: 'Box 4: Federal Tax Withheld', group: 'tax' },
    ],
  },
  {
    type: '1099-B',
    label: '1099-B Broker Transactions',
    category: 'investment',
    description: 'Broker and barter exchange transactions',
    fields: [
      { name: 'broker_name', label: 'Broker Name', group: 'payer' },
      { name: 'recipient_name', label: 'Recipient Name', group: 'recipient' },
      { name: 'transaction_date', label: 'Transaction Date', group: 'transaction' },
      { name: 'cost_basis', label: 'Cost Basis', group: 'transaction' },
      { name: 'sales_proceeds', label: 'Sales Proceeds', group: 'transaction' },
      { name: 'gain_loss', label: 'Gain / Loss', group: 'transaction' },
    ],
  },
  {
    type: '1099-R',
    label: '1099-R Retirement Distribution',
    category: 'income',
    description: 'Distributions from pensions, annuities, retirement',
    fields: [
      { name: 'payer_name', label: 'Payer Name', group: 'payer' },
      { name: 'recipient_name', label: 'Recipient Name', group: 'recipient' },
      { name: 'box1_gross', label: 'Box 1: Gross Distribution', group: 'income' },
      { name: 'box2a_taxable', label: 'Box 2a: Taxable Amount', group: 'income' },
      { name: 'box4_federal_tax', label: 'Box 4: Federal Tax Withheld', group: 'tax' },
      { name: 'box7_code', label: 'Box 7: Distribution Code', group: 'other' },
    ],
  },
  {
    type: 'K-1',
    label: 'K-1 Schedule (1065/1120S/1041)',
    category: 'income',
    description: "Partner/Shareholder/Beneficiary share of income",
    fields: [
      { name: 'entity_name', label: 'Entity Name', group: 'entity' },
      { name: 'entity_ein', label: 'Entity EIN', group: 'entity' },
      { name: 'entity_type', label: 'Entity Type', group: 'entity' },
      { name: 'partner_name', label: 'Partner/Shareholder Name', group: 'partner' },
      { name: 'partner_ssn', label: 'Partner SSN/EIN', group: 'partner' },
      { name: 'ownership_pct', label: 'Ownership %', group: 'partner' },
      { name: 'ordinary_income', label: 'Ordinary Business Income', group: 'income' },
      { name: 'rental_income', label: 'Net Rental Income', group: 'income' },
      { name: 'interest_income', label: 'Interest Income', group: 'income' },
      { name: 'capital_gain', label: 'Capital Gains', group: 'income' },
      { name: 'self_employment', label: 'Self-Employment Income', group: 'income' },
      { name: 'foreign_tax', label: 'Foreign Taxes', group: 'tax' },
    ],
  },
  {
    type: '1098',
    label: '1098 Mortgage Interest',
    category: 'deduction',
    description: 'Mortgage interest statement',
    fields: [
      { name: 'lender_name', label: 'Lender Name', group: 'lender' },
      { name: 'borrower_name', label: 'Borrower Name', group: 'borrower' },
      { name: 'borrower_ssn', label: 'Borrower SSN', group: 'borrower' },
      { name: 'box1_mortgage_interest', label: 'Box 1: Mortgage Interest', group: 'deduction' },
      { name: 'box2_outstanding', label: 'Box 2: Outstanding Mortgage Principal', group: 'other' },
      { name: 'box5_property_address', label: 'Box 5: Property Address', group: 'property' },
    ],
  },
  {
    type: '1098-T',
    label: '1098-T Tuition Statement',
    category: 'deduction',
    description: 'Tuition fees and education credits',
    fields: [
      { name: 'school_name', label: 'School Name', group: 'institution' },
      { name: 'student_name', label: 'Student Name', group: 'student' },
      { name: 'student_ssn', label: 'Student SSN', group: 'student' },
      { name: 'box1_payments', label: 'Box 1: Payments Received', group: 'deduction' },
      { name: 'box2_billed', label: 'Box 2: Amount Billed', group: 'deduction' },
      { name: 'box5_scholarships', label: 'Box 5: Scholarships/Grants', group: 'deduction' },
    ],
  },
  {
    type: 'Property-Tax',
    label: 'Property Tax Bill',
    category: 'realestate',
    description: 'Real estate property tax assessment',
    fields: [
      { name: 'jurisdiction', label: 'Jurisdiction', group: 'property' },
      { name: 'parcel_id', label: 'Parcel ID', group: 'property' },
      { name: 'property_address', label: 'Property Address', group: 'property' },
      { name: 'assessed_value', label: 'Assessed Value', group: 'value' },
      { name: 'tax_amount', label: 'Tax Amount', group: 'tax' },
      { name: 'tax_year', label: 'Tax Year', group: 'tax' },
    ],
  },
  {
    type: 'Charity-Receipt',
    label: 'Charitable Donation Receipt',
    category: 'deduction',
    description: 'Receipt for charitable contributions',
    fields: [
      { name: 'charity_name', label: 'Charity Name', group: 'charity' },
      { name: 'donor_name', label: 'Donor Name', group: 'donor' },
      { name: 'donation_date', label: 'Donation Date', group: 'donation' },
      { name: 'amount', label: 'Amount', group: 'donation' },
      { name: 'goods_received', label: 'Goods/Services Received', group: 'donation' },
    ],
  },
  {
    type: 'P&L',
    label: 'Profit & Loss Statement',
    category: 'business',
    description: 'Business income and expense statement',
    fields: [
      { name: 'business_name', label: 'Business Name', group: 'business' },
      { name: 'period', label: 'Reporting Period', group: 'period' },
      { name: 'total_revenue', label: 'Total Revenue', group: 'income' },
      { name: 'total_expenses', label: 'Total Expenses', group: 'deduction' },
      { name: 'net_income', label: 'Net Income', group: 'income' },
    ],
  },
  {
    type: 'Balance-Sheet',
    label: 'Balance Sheet',
    category: 'business',
    description: 'Business assets, liabilities, and equity',
    fields: [
      { name: 'business_name', label: 'Business Name', group: 'business' },
      { name: 'as_of_date', label: 'As Of Date', group: 'period' },
      { name: 'total_assets', label: 'Total Assets', group: 'assets' },
      { name: 'total_liabilities', label: 'Total Liabilities', group: 'liabilities' },
      { name: 'total_equity', label: 'Total Equity', group: 'equity' },
    ],
  },
  {
    type: 'Bank-Statement',
    label: 'Bank Statement',
    category: 'business',
    description: 'Monthly bank account statement',
    fields: [
      { name: 'bank_name', label: 'Bank Name', group: 'bank' },
      { name: 'account_holder', label: 'Account Holder', group: 'account' },
      { name: 'account_number', label: 'Account Number (masked)', group: 'account' },
      { name: 'period', label: 'Statement Period', group: 'period' },
      { name: 'beginning_balance', label: 'Beginning Balance', group: 'balance' },
      { name: 'ending_balance', label: 'Ending Balance', group: 'balance' },
    ],
  },
  {
    type: 'Brokerage-Statement',
    label: 'Brokerage Statement',
    category: 'investment',
    description: 'Investment account statement',
    fields: [
      { name: 'brokerage_name', label: 'Brokerage Name', group: 'institution' },
      { name: 'account_holder', label: 'Account Holder', group: 'account' },
      { name: 'account_number', label: 'Account Number (masked)', group: 'account' },
      { name: 'period', label: 'Statement Period', group: 'period' },
      { name: 'portfolio_value', label: 'Portfolio Value', group: 'value' },
    ],
  },
  {
    type: 'Drivers-License',
    label: "Driver's License",
    category: 'identity',
    description: 'Government-issued photo ID',
    fields: [
      { name: 'full_name', label: 'Full Name', group: 'identity' },
      { name: 'dl_number', label: 'DL Number', group: 'identity' },
      { name: 'dob', label: 'Date of Birth', group: 'identity' },
      { name: 'address', label: 'Address', group: 'identity' },
      { name: 'expiry', label: 'Expiry Date', group: 'identity' },
    ],
  },
  {
    type: 'Passport',
    label: 'Passport',
    category: 'identity',
    description: 'Travel passport identification',
    fields: [
      { name: 'full_name', label: 'Full Name', group: 'identity' },
      { name: 'passport_number', label: 'Passport Number', group: 'identity' },
      { name: 'nationality', label: 'Nationality', group: 'identity' },
      { name: 'dob', label: 'Date of Birth', group: 'identity' },
      { name: 'expiry', label: 'Expiry Date', group: 'identity' },
    ],
  },
  {
    type: 'Payroll-Report',
    label: 'Payroll Report',
    category: 'business',
    description: 'Employee payroll summary',
    fields: [
      { name: 'business_name', label: 'Business Name', group: 'business' },
      { name: 'period', label: 'Pay Period', group: 'period' },
      { name: 'total_wages', label: 'Total Wages', group: 'income' },
      { name: 'total_tax_withheld', label: 'Total Tax Withheld', group: 'tax' },
      { name: 'employee_count', label: 'Employee Count', group: 'business' },
    ],
  },
  {
    type: 'SSN-Card',
    label: 'SSN Card',
    category: 'identity',
    description: 'Social Security Number card',
    fields: [
      { name: 'full_name', label: 'Full Name', group: 'identity' },
      { name: 'ssn', label: 'SSN (masked)', group: 'identity' },
    ],
  },
]

export const DOCUMENT_TYPE_MAP: Record<string, DocTypeDef> = DOCUMENT_TYPES.reduce(
  (acc, t) => ({ ...acc, [t.type]: t }),
  {}
)

export const ENGAGEMENT_TYPES = [
  { value: '1040', label: '1040 — Individual', entity: 'Person' },
  { value: '1065', label: '1065 — Partnership', entity: 'Partnership' },
  { value: '1120', label: '1120 — C Corporation', entity: 'Corporation' },
  { value: '1120S', label: '1120S — S Corporation', entity: 'S Corp' },
  { value: '1041', label: '1041 — Estate/Trust', entity: 'Estate/Trust' },
] as const

export const CLIENT_TYPES = [
  { value: 'individual', label: 'Individual', icon: '👤' },
  { value: 'business', label: 'Business', icon: '🏢' },
  { value: 'trust', label: 'Trust', icon: '📜' },
  { value: 'nonprofit', label: 'Nonprofit', icon: '❤️' },
] as const

export const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; dot: string }
> = {
  // Engagement
  created: { label: 'Created', color: 'text-slate-600', bg: 'bg-slate-100', dot: 'bg-slate-400' },
  pbc_sent: { label: 'PBC Sent', color: 'text-blue-600', bg: 'bg-blue-50', dot: 'bg-blue-500' },
  collecting: { label: 'Collecting', color: 'text-amber-600', bg: 'bg-amber-50', dot: 'bg-amber-500' },
  processing: { label: 'Processing', color: 'text-violet-600', bg: 'bg-violet-50', dot: 'bg-violet-500' },
  review: { label: 'In Review', color: 'text-indigo-600', bg: 'bg-indigo-50', dot: 'bg-indigo-500' },
  filing: { label: 'Filing', color: 'text-cyan-600', bg: 'bg-cyan-50', dot: 'bg-cyan-500' },
  done: { label: 'Completed', color: 'text-emerald-600', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },

  // Document
  uploaded: { label: 'Uploaded', color: 'text-slate-600', bg: 'bg-slate-100', dot: 'bg-slate-400' },
  pending: { label: 'Pending', color: 'text-slate-500', bg: 'bg-slate-100', dot: 'bg-slate-400' },
  processing_doc: { label: 'Processing', color: 'text-violet-600', bg: 'bg-violet-50', dot: 'bg-violet-500' },
  processed: { label: 'Processed', color: 'text-emerald-600', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  extracted: { label: 'Extracted', color: 'text-emerald-600', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  reviewed: { label: 'Reviewed', color: 'text-teal-600', bg: 'bg-teal-50', dot: 'bg-teal-500' },
  rejected: { label: 'Rejected', color: 'text-red-600', bg: 'bg-red-50', dot: 'bg-red-500' },

  // Client
  active: { label: 'Active', color: 'text-emerald-600', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  inactive: { label: 'Inactive', color: 'text-slate-500', bg: 'bg-slate-100', dot: 'bg-slate-400' },
  prospect: { label: 'Prospect', color: 'text-amber-600', bg: 'bg-amber-50', dot: 'bg-amber-500' },
}

export const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; color: string; bg: string }
> = {
  high: { label: 'High', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
  medium: { label: 'Medium', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  low: { label: 'Low', color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200' },
}

export const WORKFLOW_STEPS = [
  { step: 'create', label: 'Engagement Created', icon: FileText },
  { step: 'pbc_send', label: 'PBC List Sent', icon: FileText },
  { step: 'collection', label: 'Document Collection', icon: Receipt },
  { step: 'ai_processing', label: 'AI Processing', icon: FileText },
  { step: 'human_review', label: 'Human Review', icon: IdCard },
  { step: 'tax_import', label: 'Tax Software Import', icon: Building2 },
  { step: 'filing', label: 'Filing', icon: FileText },
  { step: 'delivery', label: 'Delivery', icon: FileText },
] as const

export const TAX_SOFTWARE = [
  { id: 'ultratax', name: 'UltraTax CS', vendor: 'Thomson Reuters', connected: true },
  { id: 'cch', name: 'CCH Axcess Tax', vendor: 'Wolters Kluwer', connected: true },
  { id: 'lacerte', name: 'Lacerte', vendor: 'Intuit', connected: false },
  { id: 'proseries', name: 'ProSeries', vendor: 'Intuit', connected: false },
  { id: 'drake', name: 'Drake Tax', vendor: 'Drake Software', connected: false },
  { id: 'atx', name: 'ATX', vendor: 'Wolters Kluwer', connected: false },
]

export const COUNTRIES = [
  { code: 'US', label: 'United States', flag: '🇺🇸' },
  { code: 'UK', label: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', label: 'Canada', flag: '🇨🇦' },
  { code: 'IN', label: 'India', flag: '🇮🇳' },
  { code: 'AU', label: 'Australia', flag: '🇦🇺' },
]

export const PRICING_TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 99,
    period: 'month',
    description: 'For solo practitioners (1-2 people)',
    docsPerMonth: 50,
    features: ['Basic extraction', 'Email support', '5 clients', 'CSV export'],
    highlight: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 299,
    period: 'month',
    description: 'For small firms (3-10 people)',
    docsPerMonth: 200,
    features: [
      'Full AI extraction',
      'All integrations',
      'Priority support',
      '25 clients',
      'Excel + CSV export',
      'Workflow automation',
    ],
    highlight: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: 799,
    period: 'month',
    description: 'For mid-sized firms (11-50 people)',
    docsPerMonth: 1000,
    features: [
      'Workflow automation',
      'Reporting & analytics',
      'Dedicated support',
      '100 clients',
      'API access',
      'Custom templates',
    ],
    highlight: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: null,
    period: 'month',
    description: 'For large firms (50+ people)',
    docsPerMonth: -1,
    features: [
      'Unlimited documents',
      'Custom integrations',
      'SLA guarantee',
      'Dedicated account manager',
      'SSO/SAML',
      'Audit & compliance',
    ],
    highlight: false,
  },
]
