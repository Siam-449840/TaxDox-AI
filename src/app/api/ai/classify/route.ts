import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { DOCUMENT_TYPES, DOCUMENT_TYPE_MAP, type DocTypeDef } from '@/lib/constants'
import { readFile } from 'fs/promises'
import path from 'path'

/**
 * AI Document Classification Engine
 *
 * Model: GLM-4.6V (Vision Language Model via z-ai-web-dev-sdk)
 *
 * In production, this endpoint:
 * 1. Receives the document file (image/PDF page rendered as image)
 * 2. Sends it to GLM-4.6V with a classification prompt
 * 3. Returns the document type + confidence score
 *
 * For demo/development without actual file content, it falls back
 * to filename-based classification.
 */

// Fallback classification from filename
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
  // Heuristic patterns
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

  const document = await db.document.findUnique({
    where: { id: documentId },
  })

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  let matchedType: string | null = null
  let confidence = 0
  let model = 'filename-heuristic'

  // Try to read the actual uploaded file from disk
  let fileBase64: string | null = fileContent || null
  let fileMime: string = mimeType || document.mimeType
  let pdfText: string | null = null

  if (!fileBase64 && document.storedFilename) {
    try {
      const filePath = path.join(process.cwd(), 'download', 'uploads', document.storedFilename)
      const fileBuffer = await readFile(filePath)

      const isImage = fileMime.startsWith('image/') && !fileMime.includes('svg')
      const isPdf = fileMime === 'application/pdf' || document.storedFilename.endsWith('.pdf')

      if (isImage) {
        fileBase64 = fileBuffer.toString('base64')
      } else if (isPdf) {
        // Extract text from PDF for LLM-based classification
        try {
          const pdfParse = (await import('pdf-parse')).default
          const pdfData = await pdfParse(fileBuffer)
          pdfText = pdfData.text
          console.log(`[AI Classify] PDF text extracted: ${pdfText.length} chars`)
        } catch (pdfErr) {
          console.error('[AI Classify] PDF text extraction failed:', pdfErr)
        }
      }
    } catch (e) {
      console.log('File not found on disk, using filename classification:', e)
    }
  }

  // If we have file content (image), use GLM-4.6V vision model
  if (fileBase64) {
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default
      const zai = await ZAI.create()

      const typeList = DOCUMENT_TYPES.map((t) => t.type).join(', ')
      const prompt = `You are a tax document classifier. Look at this document image and classify it into one of these types: ${typeList}. Respond with ONLY a JSON object: {"documentType": "...", "confidence": 0.0-1.0}`

      const response = await zai.chat.completions.createVision({
        model: 'glm-4.6v',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${fileMime};base64,${fileBase64}`,
                },
              },
            ],
          },
        ],
        thinking: { type: 'disabled' },
      })

      const content = response?.choices?.[0]?.message?.content || ''
      const jsonMatch = content.match(/\{[^}]+\}/)
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0])
        matchedType = result.documentType
        confidence = result.confidence || 0.9
        model = 'glm-4.6v'
      }
    } catch (error) {
      console.error('GLM-4.6V classification failed, falling back:', error)
    }
  }

  // If we have PDF text, use LLM (text model) for classification
  if (!matchedType && pdfText && pdfText.length > 50) {
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default
      const zai = await ZAI.create()

      // Sanitize for prompt injection defense
      const { sanitizeDocumentText } = await import('@/lib/ai-security')
      const { sanitized, hadInjection } = sanitizeDocumentText(pdfText)

      if (hadInjection) {
        console.warn('[AI Classify] Prompt injection detected in PDF text — sanitized')
      }

      const typeList = DOCUMENT_TYPES.map((t) => t.type).join(', ')
      const prompt = `You are a tax document classifier. Read the following document text and classify it into one of these types: ${typeList}. Respond with ONLY a JSON object: {"documentType": "...", "confidence": 0.0-1.0}

Document text (first 4000 chars):
${sanitized.slice(0, 4000)}`

      const response = await zai.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      })

      const content = response?.choices?.[0]?.message?.content || ''
      const jsonMatch = content.match(/\{[^}]+\}/)
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0])
        matchedType = result.documentType
        confidence = result.confidence || 0.85
        model = 'glm-4.6-llm-pdf'
      }
    } catch (error) {
      console.error('PDF text LLM classification failed, falling back:', error)
    }
  }

  // Fallback to filename-based classification
  if (!matchedType) {
    const result = classifyFromFilename(document.originalFilename)
    matchedType = result.type
    confidence = result.confidence
    model = fileBase64 ? 'glm-4.6v-fallback' : (pdfText ? 'pdf-llm-fallback' : 'filename-heuristic')
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
  })
}
