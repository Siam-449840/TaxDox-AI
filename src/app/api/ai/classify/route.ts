import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { DOCUMENT_TYPES, DOCUMENT_TYPE_MAP, type DocTypeDef } from '@/lib/constants'
import { getObjectStore } from '@/lib/object-store'
import { logger } from '@/lib/logger'
import { requirePermission } from '@/lib/permissions'
import { getAIGateway } from '@/lib/ai'
import { ProviderError } from '@/lib/ai'

/**
 * AI Document Classification Engine
 *
 * Routes through the AI Gateway (multi-provider). The active provider is
 * selected by AI_PROVIDER env; today that's Gemini 3.5 Flash. No code in this
 * file references a provider SDK directly.
 *
 * Auth/tenant rules: same as before — requirePermission (or internal key for
 * background jobs), tenant ownership check on the document before classify.
 */

// Fallback classification from filename (preserved from prior implementation)
function classifyFromFilename(filename: string): {
  type: string | null
  confidence: number
} {
  const upper = filename.toUpperCase().replace(/[^A-Z0-9]/g, '')
  for (const dt of DOCUMENT_TYPES) {
    const normalized = dt.type.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (upper.includes(normalized)) {
      return { type: dt.type, confidence: 0.92 + Math.random() * 0.06 }
    }
  }
  if (upper.includes('W2')) return { type: 'W-2', confidence: 0.90 }
  if (upper.includes('1099') && upper.includes('INT')) return { type: '1099-INT', confidence: 0.90 }
  if (upper.includes('1099') && upper.includes('DIV')) return { type: '1099-DIV', confidence: 0.90 }
  if (upper.includes('1099') && upper.includes('NEC')) return { type: '1099-NEC', confidence: 0.90 }
  if (upper.includes('K1')) return { type: 'K-1', confidence: 0.88 }
  if (upper.includes('1098') && upper.includes('T')) return { type: '1098-T', confidence: 0.88 }
  if (upper.includes('1098') || upper.includes('MORTGAGE')) return { type: '1098', confidence: 0.87 }
  if (upper.includes('BANK') || upper.includes('STATEMENT')) return { type: 'Bank-Statement', confidence: 0.85 }
  if (upper.includes('PL') || upper.includes('PROFIT')) return { type: 'P&L', confidence: 0.86 }
  if (upper.includes('BALANCE')) return { type: 'Balance-Sheet', confidence: 0.86 }
  if (upper.includes('DL') || upper.includes('LICENSE')) return { type: 'Drivers-License', confidence: 0.85 }
  if (upper.includes('PASSPORT')) return { type: 'Passport', confidence: 0.87 }
  if (upper.includes('CHARITY') || upper.includes('DONATION')) return { type: 'Charity-Receipt', confidence: 0.84 }
  if (upper.includes('PROPERTY')) return { type: 'Property-Tax', confidence: 0.83 }
  return { type: null, confidence: 0 }
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
    const authz = await requirePermission(req, 'ai:use', 'ai')
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
  })

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  let matchedType: string | null = null
  let confidence = 0
  let model = 'filename-heuristic'
  let promptVersion: string | undefined

  // Read the actual uploaded file from storage to feed the provider.
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
          logger.ai.info(`[AI Classify] PDF text extracted: ${pdfText?.length || 0} chars`)

          if ((pdfText || '').trim().length < 50) {
            logger.ai.info('[AI Classify] PDF appears to be scanned (minimal text) — attempting OCR')
            try {
              const Tesseract = (await import('tesseract.js')).default
              const { data: { text: ocrText } } = await Tesseract.recognize(fileBuffer, 'eng')
              if (ocrText.trim().length > 50) {
                pdfText = ocrText
                logger.ai.info(`[AI Classify] OCR extracted ${ocrText.length} chars from scanned PDF`)
              }
            } catch (ocrErr) {
              logger.ai.error('AI classify: OCR failed for scanned PDF:', { error: String(ocrErr) })
            }
          }
        } catch (pdfErr) {
          logger.ai.error('AI classify: PDF text extraction failed:', { error: String(pdfErr) })
        }
      } else if (fileMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileMime === 'application/msword') {
        try {
          const mammoth = (await import('mammoth')).default
          const result = await mammoth.extractRawText({ buffer: fileBuffer })
          pdfText = result.value
          logger.ai.info(`[AI Classify] Word doc text extracted: ${pdfText.length} chars`)
        } catch (docErr) {
          logger.ai.error('AI classify: Word doc text extraction failed:', { error: String(docErr) })
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
          logger.ai.info(`AI classify: Spreadsheet text extracted: ${(pdfText ?? '').length} chars`)
        } catch (ssErr) {
          logger.ai.error('AI classify: Spreadsheet text extraction failed:', { error: String(ssErr) })
        }
      }
    } catch (e) {
      logger.ai.info('File not found on disk, using filename classification:', { error: String(e) })
    }
  }

  // ── AI classify via the gateway ─────────────────────────────────
  if ((fileBase64 || (pdfText && pdfText.length > 50))) {
    try {
      const gw = getAIGateway()
      const result = await gw.classify({
        imageBase64: fileBase64 || undefined,
        mimeType: fileMime,
        text: pdfText || undefined,
      })
      matchedType = result.documentType
      confidence = result.confidence
      model = result.model
      promptVersion = result.promptVersion
    } catch (error) {
      const kind = error instanceof ProviderError ? error.kind : 'unknown'
      logger.ai.error('AI classify failed, falling back:', {
        kind,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Fallback to filename-based classification
  if (!matchedType) {
    const result = classifyFromFilename(document.originalFilename)
    matchedType = result.type
    confidence = result.confidence
    model = fileBase64 ? `${model}-fallback` : (pdfText ? 'pdf-llm-fallback' : 'filename-heuristic')
  }

  const typeDef: DocTypeDef | null = matchedType ? DOCUMENT_TYPE_MAP[matchedType] : null

  await db.document.update({
    where: { id: documentId },
    data: {
      documentType: matchedType || 'Unknown',
      confidence,
      status: 'processing',
    },
  })

  await db.activity.create({
    data: {
      engagementId: document.engagementId,
      documentId,
      type: 'classify',
      description: `AI classified document as ${matchedType || 'Unknown'} (${Math.round(confidence * 100)}% confidence) via ${model}`,
      actor: 'TaxDox AI',
    },
  })

  return NextResponse.json({
    documentType: matchedType,
    confidence,
    label: typeDef?.label || matchedType,
    category: typeDef?.category || 'other',
    fields: typeDef?.fields || [],
    model,
    promptVersion,
  })
}
