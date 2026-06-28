import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { DOCUMENT_TYPES, DOCUMENT_TYPE_MAP } from '@/lib/constants'

// Simulated AI classification endpoint.
// In production this would call a multimodal LLM (VLM) on the document image.
// Here we infer from filename + known document types and assign a realistic confidence.
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { documentId } = body

  const document = await db.document.findUnique({
    where: { id: documentId },
  })

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  // Match against known document types from filename
  const filename = document.originalFilename.toUpperCase()
  let matchedType: string | null = null
  let confidence = 0.85 + Math.random() * 0.14

  for (const dt of DOCUMENT_TYPES) {
    const normalized = dt.type.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const fnNormalized = filename.replace(/[^A-Z0-9]/g, '')
    if (fnNormalized.includes(normalized)) {
      matchedType = dt.type
      confidence = 0.92 + Math.random() * 0.07
      break
    }
  }

  // Fallback heuristics
  if (!matchedType) {
    if (filename.includes('W2') || filename.includes('WAGE')) matchedType = 'W-2'
    else if (filename.includes('1099') && filename.includes('INT')) matchedType = '1099-INT'
    else if (filename.includes('1099') && filename.includes('DIV')) matchedType = '1099-DIV'
    else if (filename.includes('1099') && filename.includes('NEC')) matchedType = '1099-NEC'
    else if (filename.includes('K1') || filename.includes('K-1')) matchedType = 'K-1'
    else if (filename.includes('1098') && filename.includes('T')) matchedType = '1098-T'
    else if (filename.includes('1098') || filename.includes('MORTGAGE')) matchedType = '1098'
    else if (filename.includes('BANK') || filename.includes('STATEMENT')) matchedType = 'Bank-Statement'
    else if (filename.includes('PL') || filename.includes('P&L') || filename.includes('PROFIT')) matchedType = 'P&L'
    else if (filename.includes('BALANCE')) matchedType = 'Balance-Sheet'
    else if (filename.includes('DL') || filename.includes('LICENSE')) matchedType = 'Drivers-License'
    else if (filename.includes('PASSPORT')) matchedType = 'Passport'
    else if (filename.includes('CHARITY') || filename.includes('DONATION')) matchedType = 'Charity-Receipt'
    else if (filename.includes('PROPERTY') || filename.includes('TAX') && filename.includes('BILL')) matchedType = 'Property-Tax'
    if (matchedType) confidence = 0.88 + Math.random() * 0.08
  }

  const typeDef = matchedType ? DOCUMENT_TYPE_MAP[matchedType] : null

  const updated = await db.document.update({
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
      description: `AI classified document as ${matchedType || 'Unknown'} (${Math.round(confidence * 100)}% confidence)`,
      actor: 'TaxDox AI',
    },
  })

  return NextResponse.json({
    documentType: matchedType,
    confidence,
    label: typeDef?.label || matchedType,
    category: typeDef?.category || 'other',
    fields: typeDef?.fields || [],
  })
}
