import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readFile } from 'fs/promises'
import path from 'path'

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

  try {
    const filePath = path.join(
      process.cwd(),
      'download',
      'uploads',
      document.storedFilename
    )
    const fileBuffer = await readFile(filePath)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': document.mimeType || 'application/octet-stream',
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Preview error:', error)
    return NextResponse.json(
      { error: 'File not found on disk' },
      { status: 404 }
    )
  }
}
