import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { getObjectStore } from '@/lib/object-store'
import { requirePermission } from '@/lib/permissions'
import sanitizeHtml from 'sanitize-html'

/**
 * GET /api/documents/[id]/html
 *
 * Converts Word documents (.docx) to HTML for preview via mammoth.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const authz = await requirePermission(req, 'document:read', 'document')
  if (authz instanceof NextResponse) return authz
  const { firmId } = authz

  const document = await db.document.findUnique({
    where: { id },
    include: { client: { select: { firmId: true } } },
  })

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  // Tenant guard.
  if (document.client.firmId !== firmId) {
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
    const store = getObjectStore()
    const fileBuffer = await store.get(document.storedFilename)
    const mammoth = (await import('mammoth')).default
    const result = await mammoth.convertToHtml({ buffer: fileBuffer })
    const html = sanitizeHtml(result.value, {
      allowedTags: [
        'p',
        'br',
        'strong',
        'b',
        'em',
        'i',
        'u',
        's',
        'ul',
        'ol',
        'li',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        'h1',
        'h2',
        'h3',
        'h4',
        'blockquote',
        'a',
        'span',
      ],
      allowedAttributes: {
        a: ['href', 'name', 'target', 'rel'],
        span: ['class'],
        p: ['class'],
        table: ['class'],
        th: ['colspan', 'rowspan'],
        td: ['colspan', 'rowspan'],
      },
      allowedSchemes: ['http', 'https', 'mailto'],
      transformTags: {
        a: sanitizeHtml.simpleTransform('a', {
          rel: 'noopener noreferrer',
          target: '_blank',
        }),
      },
    })

    return NextResponse.json({
      html,
      messages: result.messages,
    })
  } catch (error) {
    logger.document.error('Word doc HTML conversion error', { error: String(error) })
    return NextResponse.json(
      { error: 'Failed to convert Word document' },
      { status: 500 }
    )
  }
}
