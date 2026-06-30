import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { readFile } from 'fs/promises'
import path from 'path'

/**
 * GET /api/documents/[id]/html
 *
 * Converts Word documents (.docx) to HTML for preview.
 * Uses mammoth to extract formatted HTML from the .docx file.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const document = await db.document.findUnique({ where: { id } })

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  if (!document.storedFilename) {
    return NextResponse.json({ error: 'No file stored' }, { status: 404 })
  }

  const isWord =
    document.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    document.mimeType === 'application/msword' ||
    document.storedFilename.endsWith('.docx') ||
    document.storedFilename.endsWith('.doc')

  if (!isWord) {
    return NextResponse.json({ error: 'Not a Word document' }, { status: 400 })
  }

  try {
    const filePath = path.join(process.cwd(), 'download', 'uploads', document.storedFilename)
    const fileBuffer = await readFile(filePath)
    const mammoth = (await import('mammoth')).default
    const result = await mammoth.convertToHtml({ buffer: fileBuffer })

    return NextResponse.json({
      html: result.value,
      messages: result.messages,
    })
  } catch (error) {
    logger.document.error('Word doc HTML conversion error:', { error: String(error) })
    return NextResponse.json(
      { error: 'Failed to convert Word document' },
      { status: 500 }
    )
  }
}
