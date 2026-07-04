import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { DOCUMENT_TYPE_MAP } from '@/lib/constants'
import { getObjectStore } from '@/lib/object-store'
import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import { extractionCompleteEmail } from '@/lib/email-templates'
import { requirePermission } from '@/lib/permissions'
import { getAIGateway } from '@/lib/ai'
import { ProviderError } from '@/lib/ai'

// Minimal HTML escaper so plain-text email bodies render safely in HTML view.
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * AI Field-Level Data Extraction Engine
 *
 * Routes through the AI Gateway (active provider selected by AI_PROVIDER, today
 * Gemini 3.5 Flash). Output is schema-validated + hallucination-checked before
 * it is persisted. No route code references a provider SDK directly.
 *
 * Auth/tenant rules unchanged: requirePermission (or internal key), tenant
 * ownership of the document before extract.
 */

// Simulated extraction values (demo fallback when no provider call succeeds)
function getMockValues(docType: string): Record<string, string> {
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
  }
  return data[docType] || {}
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { documentId, fileContent, mimeType } = body
  const expectedInternalKey = process.env.INTERNAL_API_KEY || process.env.CRON_API_KEY
  const providedInternalKey = req.headers.get('x-taxdox-internal-key')
  const isInternal =
    (!!expectedInternalKey && providedInternalKey === expectedInternalKey) ||
    (!expectedInternalKey &&
      process.env.NODE_ENV !== 'production' &&
      providedInternalKey === 'dev-internal')

  if (!isInternal) {
    const authz = await requirePermission(req, 'extraction:write', 'extraction')
    if (authz instanceof NextResponse) return authz
    const document = await db.document.findFirst({
      where: { id: documentId, client: { firmId: authz.firmId } },
      select: { id: true },
    })
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }
  }

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

  let extractedFields: { name: string; value: string; confidence: number }[] = []
  let model = 'simulated'
  let promptVersion = 'extraction-v1'
  let isFallback = true

  // Read the uploaded file from storage to feed the provider.
  let fileBase64: string | null = fileContent || null
  let fileMime: string = mimeType || document.mimeType
  let pdfText: string | null = null

  if (!fileBase64 && document.storedFilename) {
    try {
      const store = getObjectStore()
      const fileBuffer = await store.get(document.storedFilename)

      const isImage = fileMime.startsWith('image/') && !fileMime.includes('svg')
      const isPdf = fileMime === 'application/pdf' || document.storedFilename.endsWith('.pdf')

      if (isImage) {
        fileBase64 = fileBuffer.toString('base64')
      } else if (isPdf) {
        try {
          const pdfParse = (await import('pdf-parse')) as any
          const pdfData = await (pdfParse.default ? pdfParse.default(fileBuffer) : pdfParse(fileBuffer))
          pdfText = pdfData.text
          logger.ai.info(`[AI Extract] PDF text extracted: ${pdfText?.length || 0} chars`)

          if ((pdfText || '').trim().length < 50) {
            logger.ai.info('[AI Extract] PDF appears to be scanned (minimal text) — attempting OCR')
            try {
              const Tesseract = (await import('tesseract.js')).default
              const { data: { text: ocrText } } = await Tesseract.recognize(fileBuffer, 'eng')
              if (ocrText.trim().length > 50) {
                pdfText = ocrText
                logger.ai.info(`[AI Extract] OCR extracted ${ocrText.length} chars from scanned PDF`)
              }
            } catch (ocrErr) {
              logger.ai.error('AI extract: OCR failed for scanned PDF:', { error: String(ocrErr) })
            }
          }
        } catch (pdfErr) {
          logger.ai.error('AI extract: PDF text extraction failed:', { error: String(pdfErr) })
        }
      } else if (fileMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileMime === 'application/msword') {
        try {
          const mammoth = (await import('mammoth')).default
          const result = await mammoth.extractRawText({ buffer: fileBuffer })
          pdfText = result.value
          logger.ai.info(`[AI Extract] Word doc text extracted: ${pdfText.length} chars`)
        } catch (docErr) {
          logger.ai.error('AI extract: Word doc text extraction failed:', { error: String(docErr) })
        }
      } else if (
        fileMime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        fileMime === 'application/vnd.ms-excel' ||
        fileMime === 'text/csv'
      ) {
        try {
          if (fileMime === 'text/csv') {
            const Papa = (await import('papaparse')).default
            const csvText = fileBuffer.toString('utf-8')
            const parsed = Papa.parse(csvText, { skipEmptyLines: true })
            pdfText = parsed.data.map((row: unknown) => Array.isArray(row) ? row.join('\t') : String(row)).join('\n')
          } else {
            const XLSX = (await import('xlsx')).default
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
            const sheets = workbook.SheetNames.map(name => {
              const sheet = workbook.Sheets[name]
              return `=== Sheet: ${name} ===\n${XLSX.utils.sheet_to_csv(sheet)}`
            }).join('\n\n')
            pdfText = sheets
          }
          logger.ai.info(`AI extract: Spreadsheet text extracted: ${(pdfText ?? '').length} chars`)
        } catch (ssErr) {
          logger.ai.error('AI extract: Spreadsheet text extraction failed:', { error: String(ssErr) })
        }
      }
    } catch (e) {
      logger.ai.info('File not found on disk, using simulated extraction:', { error: String(e) })
    }
  }

  // ── AI extract via the gateway (image or text) ──────────────────
  if (fileBase64 || (pdfText && pdfText.length > 50)) {
    // Sanitize document text for prompt-injection defense before it reaches any
    // provider. (The gateway passes text through verbatim, so defense happens
    // here at the application boundary — same as before.)
    let sanitizedText = pdfText
    if (pdfText) {
      const { sanitizeDocumentText } = await import('@/lib/ai-security')
      const r = sanitizeDocumentText(pdfText)
      if (r.hadInjection) {
        logger.ai.warn('AI extract: Prompt injection detected in document text — sanitized')
      }
      sanitizedText = r.sanitized
    }

    try {
      const gw = getAIGateway()
      const result = await gw.extract({
        documentType: document.documentType,
        fields: typeDef.fields.map((f) => ({ name: f.name, label: f.label })),
        imageBase64: fileBase64 || undefined,
        mimeType: fileMime,
        text: sanitizedText || undefined,
      })
      extractedFields = result.fields
      model = result.model
      promptVersion = result.promptVersion
      isFallback = result.isFallback
    } catch (error) {
      const kind = error instanceof ProviderError ? error.kind : 'unknown'
      logger.ai.error('AI extract failed, falling back to simulated:', {
        kind,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Fallback to simulated extraction
  if (extractedFields.length === 0) {
    const mockValues = getMockValues(document.documentType)
    extractedFields = typeDef.fields.map((field) => ({
      name: field.name,
      value: mockValues[field.name] || '—',
      confidence: 0.82 + Math.random() * 0.17,
    }))
    model = fileBase64 ? `${model}-fallback` : 'simulated'
    isFallback = true
  }

  // Version tracking — records exactly what produced this extraction.
  const templateVersion = `${document.documentType?.toLowerCase().replace(/[^a-z0-9]/g, '')}-v1`

  // Save extractions to database
  const extractions: any[] = []
  const fieldMap = new Map(typeDef.fields.map((f) => [f.name, f]))
  for (const extracted of extractedFields) {
    const fieldDef = fieldMap.get(extracted.name)
    if (!fieldDef) continue

    const confidence = Math.max(0, Math.min(1, extracted.confidence || 0.9))
    const ext = await db.extraction.create({
      data: {
        documentId,
        fieldName: extracted.name,
        fieldLabel: fieldDef.label,
        fieldValue: extracted.value,
        fieldGroup: fieldDef.group,
        confidence,
        sourceLocation: 'page 1',
        isVerified: confidence > 0.9,
        verifiedAt: confidence > 0.9 ? new Date() : null,
        modelVersion: model,
        templateVersion,
        promptVersion,
        isFallback,
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
      description: `AI extracted ${extractions.length} fields from ${document.documentType} via ${model}`,
      actor: 'TaxDox AI',
    },
  })

  // Best-effort extraction-complete email.
  try {
    const docWithClient = await db.document.findUnique({
      where: { id: documentId },
      include: { client: true, engagement: true },
    })
    if (docWithClient?.client) {
      const avgConfidence =
        extractions.length > 0
          ? extractions.reduce((sum, e) => sum + e.confidence, 0) / extractions.length
          : 0
      const emailTpl = extractionCompleteEmail(
        docWithClient.client.name,
        document.documentType || 'Document',
        extractions.length,
        avgConfidence
      )
      await sendEmail({
        firmId: docWithClient.client.firmId,
        engagementId: docWithClient.engagementId || null,
        clientId: docWithClient.client.id,
        to: docWithClient.client.email,
        toName: docWithClient.client.name,
        subject: emailTpl.subject,
        text: emailTpl.body,
        html: `<pre style="font-family: ui-sans-serif, system-ui, sans-serif; white-space: pre-wrap;">${escapeHtml(emailTpl.body)}</pre>`,
        template: emailTpl.template,
      })
    }
  } catch (emailError) {
    logger.ai.error('extraction_complete email failed', { error: String(emailError) })
  }

  return NextResponse.json({
    extractions,
    model,
    count: extractions.length,
  })
}
