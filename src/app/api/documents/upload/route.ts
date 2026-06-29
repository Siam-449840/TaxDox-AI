import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { nanoid } from 'nanoid'
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE, sanitizeFilename, validateMimeType } from '@/lib/validation'
import { logger } from '@/lib/logger'

const UPLOAD_DIR = path.join(process.cwd(), 'download', 'uploads')

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = session.user as { id: string; firmId: string | null }
    if (!user.firmId) {
      return NextResponse.json({ error: 'No firm associated' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const clientId = formData.get('clientId') as string | null
    const engagementId = formData.get('engagementId') as string | null
    const pbcItemId = formData.get('pbcItemId') as string | null
    const uploadedBy = (formData.get('uploadedBy') as string) || 'user'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 })
    }

    // Validate MIME type (not just extension)
    if (!validateMimeType(file.type)) {
      return NextResponse.json(
        { error: `File type ${file.type} is not supported. Allowed: PDF, JPEG, PNG, TIFF, WebP, Excel, CSV, Word` },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 50MB limit' },
        { status: 400 }
      )
    }

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true })

    // Generate unique filename with sanitized original name
    const safeName = sanitizeFilename(file.name)
    const ext = path.extname(safeName) || mimeToExt(file.type)
    const storedFilename = `${nanoid()}${ext}`
    const filePath = path.join(UPLOAD_DIR, storedFilename)

    // Write file to disk
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Create document record
    const document = await db.document.create({
      data: {
        clientId,
        engagementId: engagementId || undefined,
        pbcItemId: pbcItemId || undefined,
        originalFilename: file.name,
        storedFilename,
        fileSize: file.size,
        mimeType: file.type,
        status: 'uploaded',
        uploadedBy,
      },
    })

    // Log activity
    await db.activity.create({
      data: {
        engagementId: engagementId || undefined,
        documentId: document.id,
        type: 'upload',
        description: `${uploadedBy === 'client' ? 'Client' : 'User'} uploaded ${file.name} (${formatFileSize(file.size)})`,
        actor: uploadedBy === 'client' ? 'Client' : 'You',
      },
    })

    logger.document.info('Document uploaded', { documentId: document.id, filename: file.name, mimeType: file.type, size: file.size })

    return NextResponse.json({
      document,
      storedFilename,
      fileSize: file.size,
      mimeType: file.type,
      message: 'File uploaded successfully',
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/tiff': '.tiff',
    'image/webp': '.webp',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-excel': '.xls',
    'text/csv': '.csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/msword': '.doc',
  }
  return map[mime] || '.bin'
}
