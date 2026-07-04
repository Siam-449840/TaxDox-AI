/**
 * TaxDox AI — HTTP Performance Validation (Section 3)
 *
 * Measures real DB-backed API latency (P50/P95/P99) against the running prod
 * server with authenticated sessions. Reports against the NFR budgets in
 * docs/nfrs.md (API P95 < 300ms for read, < 800ms for write).
 *
 * Usage: bun scripts/perf-http.ts
 */
const BASE = process.env.PERF_BASE || 'http://localhost:3000'

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

async function readCookieJar(path: string): Promise<string> {
  const file = await Bun.file(path).text()
  const line = file.split('\n').find((l) => l.includes('session-token'))
  if (!line) throw new Error(`no session-token in ${path}`)
  const parts = line.split('\t')
  return `${parts[5]}=${parts[6]}` // name=value (netscape jar format)
}

interface ProbeResult {
  name: string
  samples: number[]
  failures: number
}

async function probe(
  name: string,
  url: string,
  cookie: string,
  opts: { method?: string; body?: string; n?: number; warmup?: number } = {}
): Promise<ProbeResult> {
  const method = opts.method || 'GET'
  const n = opts.n || 60
  const warmup = opts.warmup ?? 3
  const samples: number[] = []
  let failures = 0
  const headers: Record<string, string> = { cookie, origin: BASE }
  if (opts.body) {
    headers['content-type'] = 'application/json'
    headers['origin'] = BASE
  }
  const reqInit: RequestInit = { method, headers, body: opts.body }

  // Warmup (discard)
  for (let i = 0; i < warmup; i++) {
    try { await fetch(url, reqInit) } catch {}
    await new Promise((r) => setTimeout(r, 30))
  }

  for (let i = 0; i < n; i++) {
    const t0 = performance.now()
    try {
      const res = await fetch(url, reqInit)
      await res.text()
      const dt = performance.now() - t0
      if (res.status >= 500) failures++
      samples.push(dt)
    } catch {
      failures++
    }
  }
  samples.sort((a, b) => a - b)
  return { name, samples, failures }
}

function report(r: ProbeResult, budgetMs: number) {
  const p50 = percentile(r.samples, 50)
  const p95 = percentile(r.samples, 95)
  const p99 = percentile(r.samples, 99)
  const avg = r.samples.reduce((s, v) => s + v, 0) / Math.max(1, r.samples.length)
  const pass = p95 <= budgetMs
  const flag = pass ? '✓ PASS' : '✗ FAIL'
  console.log(
    `  ${flag}  ${r.name.padEnd(42)} P50 ${p50.toFixed(1).padStart(6)}ms  P95 ${p95.toFixed(1).padStart(6)}ms  P99 ${p99.toFixed(1).padStart(6)}ms  (budget P95≤${budgetMs}ms, n=${r.samples.length}, fail=${r.failures})`
  )
  return { name: r.name, p50, p95, p99, avg, budgetMs, pass, failures: r.failures }
}

async function main() {
  console.log(`\n=== TaxDox AI — HTTP Performance Validation ===`)
  console.log(`Target: ${BASE}\n`)
  const cookie = await readCookieJar('/tmp/fa.jar')

  const results: any[] = []

  // Public / infra
  results.push(report(await probe('GET /api/health/live (no DB)', `${BASE}/api/health/live`, '', { n: 100 }), 100))
  results.push(report(await probe('GET /api/health/ready (DB probe)', `${BASE}/api/health/ready`, '', { n: 60 }), 200))

  // Authenticated DB-backed reads (Firm A — 12 clients, 12 engagements, many docs)
  results.push(report(await probe('GET /api/dashboard (aggregations)', `${BASE}/api/dashboard`, cookie), 300))
  results.push(report(await probe('GET /api/clients (list)', `${BASE}/api/clients`, cookie), 300))
  results.push(report(await probe('GET /api/engagements (list w/ relations)', `${BASE}/api/engagements`, cookie), 300))
  results.push(report(await probe('GET /api/documents (list w/ extractions)', `${BASE}/api/documents`, cookie), 300))
  results.push(report(await probe('GET /api/reports (cross-table aggregations)', `${BASE}/api/reports`, cookie), 500))
  results.push(report(await probe('GET /api/notifications (6 source queries)', `${BASE}/api/notifications`, cookie), 400))
  results.push(report(await probe('GET /api/emails (list)', `${BASE}/api/emails`, cookie), 300))
  results.push(report(await probe('GET /api/audit-logs (list)', `${BASE}/api/audit-logs`, cookie), 300))

  // Single-resource reads (engagement detail with deep relations)
  // fetch an engagement id first
  const engList = await fetch(`${BASE}/api/engagements`, { headers: { cookie, origin: BASE } }).then((r) => r.json())
  const engId = engList.engagements?.[0]?.id
  if (engId) {
    results.push(report(await probe('GET /api/engagements/[id] (deep detail)', `${BASE}/api/engagements/${engId}`, cookie), 300))
  }

  // Write (create + delete a client) — measures write latency + activity log write
  const writeSamples: number[] = []
  for (let i = 0; i < 20; i++) {
    const t0 = performance.now()
    const res = await fetch(`${BASE}/api/clients`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json', origin: BASE },
      body: JSON.stringify({ name: `Perf Client ${i}`, email: `perf${i}@test.example`, clientType: 'individual' }),
    })
    const body = await res.json()
    const dt = performance.now() - t0
    writeSamples.push(dt)
    // cleanup
    if (body.client?.id) {
      await fetch(`${BASE}/api/clients`, { method: 'DELETE', headers: { cookie, origin: BASE } }).catch(() => {})
    }
  }
  writeSamples.sort((a, b) => a - b)
  const wp95 = percentile(writeSamples, 95)
  console.log(
    `  ${wp95 <= 800 ? '✓ PASS' : '✗ FAIL'}  ${'POST /api/clients (create write)'.padEnd(42)} P50 ${percentile(writeSamples,50).toFixed(1).padStart(6)}ms  P95 ${wp95.toFixed(1).padStart(6)}ms  (budget P95≤800ms, n=${writeSamples.length})`
  )

  console.log('\n=== Summary ===')
  const passed = results.filter((r) => r.pass).length
  console.log(`  ${passed}/${results.length} read probes within budget`)

  // Save raw results for the report
  await Bun.write('/tmp/perf-results.json', JSON.stringify(results, null, 2))
  console.log('  raw: /tmp/perf-results.json')
}

main().catch((e) => { console.error(e); process.exit(1) })
