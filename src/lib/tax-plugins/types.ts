/**
 * TaxDox AI — Country Plugin Interface (Section 6.1)
 *
 * Each jurisdiction is implemented as an independent plugin with a standard interface.
 * Adding a country = writing a JSON config file, NOT changing application code.
 */

export interface DocumentTypeDefinition {
  type: string
  label: string
  category: string
  description: string
  fields: FieldDefinition[]
}

export interface FieldDefinition {
  name: string
  label: string
  group: string
  format?: string // regex pattern or 'currency' | 'date' | 'percentage' | 'text' | 'ssn' | 'ein'
  required?: boolean
}

export interface FilingDeadline {
  returnType: string
  deadline: string // e.g., "April 15" or "January 31"
  extensionDeadline?: string
  description: string
}

export interface JurisdictionConfig {
  code: string // US, GB, CA, IN, AU
  name: string
  flag: string
  taxYearLabel: string // "Tax Year 2025" or "2025/26"
  taxYearStart: string // "January 1" or "April 6"
  currency: string
  currencySymbol: string
  locale: string
  dateFormat: string
  numberFormat: string
  identifierName: string // "SSN" (US), "NINO" (UK), "SIN" (CA), "PAN" (IN), "TFN" (AU)
  identifierFormat: string // regex pattern
  identifierMaskPattern: string
  supportTier: 'full' | 'partial' | 'unsupported'
  supportTierDescription: string
  filingDeadlines: FilingDeadline[]
  documentTypes: DocumentTypeDefinition[]
  taxSoftware: Array<{ id: string; name: string; vendor: string }>
  taxBrackets: Array<{
    rate: string
    label: string
    single?: string
    married?: string
    notes?: string
  }>
  standardDeduction: Array<{
    status: string
    amount: number
  }>
  keyCredits: Array<{ name: string; amount: string }>
  keyLimits: Array<{ name: string; amount: string }>
}

export interface CountryPlugin {
  config: JurisdictionConfig

  getDocumentTypes(): DocumentTypeDefinition[]
  getExtractionFields(documentType: string): FieldDefinition[]
  validateDocument(documentType: string, fields: Record<string, string>): { isValid: boolean; errors: string[] }
  validateIdentifier(identifier: string): boolean
  getFilingDeadlines(): FilingDeadline[]
  getFilingDeadline(returnType: string): FilingDeadline | undefined
  formatCurrency(amount: number): string
  formatDate(date: Date): string
}

// ─── Base Plugin Implementation ───────────────────────────────

export function createCountryPlugin(config: JurisdictionConfig): CountryPlugin {
  return {
    config,

    getDocumentTypes() {
      return config.documentTypes
    },

    getExtractionFields(documentType: string) {
      const dt = config.documentTypes.find((d) => d.type === documentType)
      return dt?.fields || []
    },

    validateDocument(documentType: string, fields: Record<string, string>) {
      const errors: string[] = []
      const docType = config.documentTypes.find((d) => d.type === documentType)
      if (!docType) {
        errors.push(`Unknown document type: ${documentType}`)
        return { isValid: false, errors }
      }

      for (const field of docType.fields) {
        if (field.required && !fields[field.name]) {
          errors.push(`${field.label} is required`)
        }
        if (field.format && fields[field.name]) {
          const value = fields[field.name]
          if (field.format === 'ssn' && !/^\d{3}-\d{2}-\d{4}$/.test(value) && !/^\*{3}-\*{2}-\d{4}$/.test(value)) {
            errors.push(`${field.label} has invalid format`)
          }
          if (field.format === 'ein' && !/^\d{2}-\d{7}$/.test(value) && !/^\*{2}-\*{3}\d{4}$/.test(value)) {
            errors.push(`${field.label} has invalid format`)
          }
        }
      }

      return { isValid: errors.length === 0, errors }
    },

    validateIdentifier(identifier: string) {
      return new RegExp(config.identifierFormat).test(identifier)
    },

    getFilingDeadlines() {
      return config.filingDeadlines
    },

    getFilingDeadline(returnType: string) {
      return config.filingDeadlines.find((d) => d.returnType === returnType)
    },

    formatCurrency(amount: number) {
      return new Intl.NumberFormat(config.locale, {
        style: 'currency',
        currency: config.currency,
      }).format(amount)
    },

    formatDate(date: Date) {
      return new Intl.DateTimeFormat(config.locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date)
    },
  }
}
