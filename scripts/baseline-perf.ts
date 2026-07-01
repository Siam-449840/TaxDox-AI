import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function measure(name: string, fn: () => Promise<any>) {
  const start = performance.now()
  await fn()
  const end = performance.now()
  const duration = end - start
  console.log(`${name}: ${duration.toFixed(2)}ms`)
  return duration
}

async function main() {
  console.log('--- Database Performance Baseline ---')

  // 1. Dashboard Load equivalent (aggregation & relational fetch)
  await measure('Dashboard Load (Firms, Users, Engagements)', async () => {
    return prisma.firm.findFirst({
      include: {
        users: true,
        engagements: {
          include: { client: true, workflows: true }
        }
      }
    })
  })

  // 2. Document Query (list all documents with relations)
  await measure('Document Query (All docs with extractions)', async () => {
    return prisma.document.findMany({
      include: { extractions: true, client: true },
      take: 50
    })
  })

  // 3. Extraction Query (fetch all extractions)
  await measure('Extraction Query (Bulk fetch)', async () => {
    return prisma.extraction.findMany({
      take: 200
    })
  })

  // 4. Client Search (simulated text search)
  await measure('Client Search (Contains)', async () => {
    return prisma.client.findMany({
      where: {
        name: { contains: 'a' }
      }
    })
  })

  // 5. Concurrent Writes (SQLite struggles here)
  await measure('Concurrent Writes (10 records)', async () => {
    const promises: any[] = []
    for (let i = 0; i < 10; i++) {
      promises.push(
        prisma.activity.create({
          data: {
            type: 'test_concurrency',
            description: `Test Activity ${i}`,
            actor: 'system'
          }
        })
      )
    }
    await Promise.all(promises)
  })

  // Clean up concurrent write test
  await prisma.activity.deleteMany({
    where: { type: 'test_concurrency' }
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
