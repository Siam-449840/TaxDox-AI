import { db } from '../src/lib/db'
import { getObjectStore } from '../src/lib/object-store'
import path from 'node:path'
import { unlink } from 'node:fs/promises'

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

  // Step 4: Perform Multipart Upload
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

  // Step 5: Verify Document in PostgreSQL Database
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

  // Step 6: Verify File in Storage (Local File System check in dev)
  const fullStoragePath = path.join(process.cwd(), storedFilename)
  const store = getObjectStore()
  const fileBuffer = await store.get(storedFilename)

  if (!fileBuffer || fileBuffer.toString() !== mockFileContent) {
    throw new Error('File contents in storage do not match expected upload content')
  }
  console.log(`✔ Verified file existence and integrity in storage at: ${storedFilename}`)

  // Step 7: Clean Up (Database Records & Storage File)
  await db.activity.deleteMany({
    where: { documentId },
  })
  await db.document.delete({
    where: { id: documentId },
  })
  await store.delete(storedFilename)

  console.log('✔ Cleaned up test document and activity database records')
  console.log('✔ Cleaned up test storage file')
  console.log('🎉 E2E Document Upload Pipeline Test Passed successfully!')
}

runTest().catch((err) => {
  console.error('❌ E2E Document Upload Pipeline Test Failed:', err)
  process.exit(1)
})
