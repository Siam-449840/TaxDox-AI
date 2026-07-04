import { db } from '../src/lib/db'
import { getObjectStore } from '../src/lib/object-store'
import path from 'node:path'

async function assertUploadError(
  label: string,
  formData: FormData,
  expectedStatus: number,
  cookieHeaders: string[],
  validateBody?: (body: any) => void
) {
  const BASE_URL = 'http://localhost:3000'
  const res = await fetch(`${BASE_URL}/api/documents/upload`, {
    method: 'POST',
    headers: {
      'Cookie': cookieHeaders.join('; '),
      'Origin': BASE_URL,
      'Referer': `${BASE_URL}/`,
    },
    body: formData,
  })

  if (res.status !== expectedStatus) {
    throw new Error(`[${label}] Expected status ${expectedStatus}, got ${res.status}`)
  }

  const body = await res.json()
  if (!body.error) {
    throw new Error(`[${label}] Expected error response, got: ${JSON.stringify(body)}`)
  }

  if (validateBody) {
    validateBody(body)
  }
  console.log(`✔ [${label}] Passed: received expected HTTP ${expectedStatus}`)
}

async function runTest() {
  console.log('Starting E2E Document Upload Pipeline Test...')

  const BASE_URL = 'http://localhost:3000'

  // Step 1: Fetch CSRF Token
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`)
  if (!csrfRes.ok) {
    throw new Error(`Failed to fetch CSRF token: ${csrfRes.statusText}`)
  }
  const csrfCookies = csrfRes.headers.getSetCookie()
  const cookieHeaders = csrfCookies.map((c) => c.split(';')[0])
  const { csrfToken } = await csrfRes.json()
  console.log('✔ Fetched CSRF Token successfully')

  // Step 2: Login
  const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieHeaders.join('; '),
    },
    body: new URLSearchParams({
      email: 'sarah.chen@meridiancpa.com',
      password: 'TaxDox2025!',
      csrfToken,
      callbackUrl: `${BASE_URL}/`,
    }),
    redirect: 'manual',
  })

  if (loginRes.status !== 302 && loginRes.status !== 200) {
    throw new Error(`Login request failed with status ${loginRes.status}: ${loginRes.statusText}`)
  }

  const loginCookies = loginRes.headers.getSetCookie()
  loginCookies.forEach((c) => {
    cookieHeaders.push(c.split(';')[0])
  })

  // Verify Session
  const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: {
      'Cookie': cookieHeaders.join('; '),
    },
  })
  const sessionData = await sessionRes.json()
  if (!sessionData.user) {
    throw new Error(`Authentication failed. Session data: ${JSON.stringify(sessionData)}`)
  }
  console.log(`✔ Authenticated successfully as ${sessionData.user.name}`)

  // Step 3: Fetch Clients to get a valid Client ID
  const clientsRes = await fetch(`${BASE_URL}/api/clients`, {
    headers: {
      'Cookie': cookieHeaders.join('; '),
    },
  })
  if (!clientsRes.ok) {
    throw new Error(`Failed to fetch clients list: ${clientsRes.statusText}`)
  }
  const { clients } = await clientsRes.json()
  if (!clients || clients.length === 0) {
    throw new Error('No clients found in the seeded database. Run: npm run db:seed')
  }
  const targetClient = clients[0]
  console.log(`✔ Found target client: ${targetClient.name} (ID: ${targetClient.id})`)

  // Step 4: Verify Auth/Validation/Oversized/MIME/Tenant Edge Cases
  console.log('\nTesting validation and edge-case error pathways...')

  // Path A: Unauthenticated / Authorization Failure
  const unauthFormData = new FormData()
  unauthFormData.append('file', new Blob(['test'], { type: 'application/pdf' }), 'test.pdf')
  unauthFormData.append('clientId', targetClient.id)
  await assertUploadError('Authorization Failure Check', unauthFormData, 401, [])

  // Path B: Validation Failure (Missing clientId)
  const validationFormData = new FormData()
  validationFormData.append('file', new Blob(['test'], { type: 'application/pdf' }), 'test.pdf')
  await assertUploadError('Metadata Validation Failure Check', validationFormData, 400, cookieHeaders, (body) => {
    if (!body.missingFields || !body.missingFields.includes('clientId')) {
      throw new Error(`Expected missingFields with 'clientId', got: ${JSON.stringify(body)}`)
    }
  })

  // Path C: Unsupported MIME Type
  const mimeFormData = new FormData()
  mimeFormData.append('file', new Blob(['test'], { type: 'application/zip' }), 'test.zip')
  mimeFormData.append('clientId', targetClient.id)
  await assertUploadError('Unsupported MIME Type Check', mimeFormData, 400, cookieHeaders)

  // Path D: Oversized File (> 50MB limit)
  const largeBlob = new Blob([new Uint8Array(50 * 1024 * 1024 + 100)], { type: 'application/pdf' })
  const sizeFormData = new FormData()
  sizeFormData.append('file', largeBlob, 'large.pdf')
  sizeFormData.append('clientId', targetClient.id)
  await assertUploadError('Oversized File Size Check', sizeFormData, 400, cookieHeaders)

  // Path E: Tenant Isolation Mismatch
  const tenantFormData = new FormData()
  tenantFormData.append('file', new Blob(['test'], { type: 'application/pdf' }), 'test.pdf')
  tenantFormData.append('clientId', 'cmr0000000000000000000000') // Non-existent/unowned client ID
  await assertUploadError('Tenant Isolation / Client Match Check', tenantFormData, 404, cookieHeaders)

  console.log('\nTesting successful upload pipeline...')

  // Step 5: Perform Successful Multipart Upload
  const mockFileContent = 'Hello World! This is an E2E document upload pipeline test file content.'
  const mockBlob = new Blob([mockFileContent], { type: 'application/pdf' })
  
  const formData = new FormData()
  formData.append('file', mockBlob, 'e2e_test_upload.pdf')
  formData.append('clientId', targetClient.id)
  formData.append('uploadedBy', 'user')

  console.log('Sending upload POST request to /api/documents/upload...')
  const uploadRes = await fetch(`${BASE_URL}/api/documents/upload`, {
    method: 'POST',
    headers: {
      'Cookie': cookieHeaders.join('; '),
      'Origin': BASE_URL,
      'Referer': `${BASE_URL}/`,
    },
    body: formData,
  })

  const uploadResult = await uploadRes.json()
  if (!uploadRes.ok || uploadResult.error) {
    throw new Error(`Upload API returned error: ${JSON.stringify(uploadResult)}`)
  }
  console.log('✔ Upload API returned 201 Created')

  const documentId = uploadResult.document?.id
  const storedFilename = uploadResult.storedFilename

  if (!documentId || !storedFilename) {
    throw new Error(`Invalid response metadata: ${JSON.stringify(uploadResult)}`)
  }

  // Step 6: Verify Document in PostgreSQL Database
  const dbDoc = await db.document.findUnique({
    where: { id: documentId },
  })

  if (!dbDoc) {
    throw new Error(`Document record not found in database for ID: ${documentId}`)
  }

  if (dbDoc.clientId !== targetClient.id) {
    throw new Error(`Document client ID mismatch. Expected: ${targetClient.id}, Got: ${dbDoc.clientId}`)
  }
  console.log('✔ Verified document insertion in PostgreSQL database')

  // Step 7: Verify File in Storage (Local File System check in dev)
  const fullStoragePath = path.join(process.cwd(), storedFilename)
  const store = getObjectStore()
  const fileBuffer = await store.get(storedFilename)

  if (!fileBuffer || fileBuffer.toString() !== mockFileContent) {
    throw new Error('File contents in storage do not match expected upload content')
  }
  console.log(`✔ Verified file existence and integrity in storage at: ${storedFilename}`)

  // Step 8: Clean Up (Database Records & Storage File)
  await db.activity.deleteMany({
    where: { documentId },
  })
  await db.document.delete({
    where: { id: documentId },
  })
  await store.delete(storedFilename)

  console.log('✔ Cleaned up test document and activity database records')
  console.log('✔ Cleaned up test storage file')
  console.log('🎉 All E2E Document Upload Pipeline Tests Passed successfully!')
}

runTest().catch((err) => {
  console.error('❌ E2E Document Upload Pipeline Test Failed:', err)
  process.exit(1)
})
