/**
 * k6 load test — document upload + extraction pipeline.
 *
 * Run:  k6 run load-tests/k6-extraction.js --env BASE_URL=http://localhost:3000
 *       --env AUTH_COOKIE=__Secure-next-auth.session-token=...
 *
 * Asserts the NFR perf budget (docs/nfrs.md):
 *   - upload P95 < 2s
 *   - extraction-status P95 < 300ms
 *
 * Requires a seeded user session cookie (AUTH_COOKIE) since the upload route
 * requires authentication.
 */

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Trend } from 'k6/metrics'

const BASE = __ENV.BASE_URL || 'http://localhost:3000'
const COOKIE = __ENV.AUTH_COOKIE || ''

const uploadTrend = new Trend('upload_duration', true)
const statusTrend = new Trend('status_duration', true)

export const options = {
  stages: [
    { duration: '30s', target: 5 }, // ramp to 5 concurrent
    { duration: '1m', target: 5 }, // hold
    { duration: '30s', target: 10 }, // ramp to 10
    { duration: '1m', target: 10 }, // hold
    { duration: '30s', target: 0 }, // ramp down
  ],
  thresholds: {
    // Perf budget (docs/nfrs.md). Build fails if exceeded.
    upload_duration: ['p(95)<2000'],
    status_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
  },
}

// A tiny in-memory PDF stub — enough to pass MIME validation for the upload
// shape. Replace with a real fixture for end-to-end extraction testing.
const PDF_BYTES = Buffer.from(
  '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF',
  'binary'
)

export default function uploadAndPoll() {
  const clientId = __ENV.CLIENT_ID || 'seed-client-1'

  group('upload + poll', () => {
    const fd = {
      file: http.file(PDF_BYTES, 'w2-stub.pdf', 'application/pdf'),
      clientId,
      uploadedBy: 'user',
    }

    const up = http.post(`${BASE}/api/documents/upload`, fd, {
      headers: { cookie: COOKIE },
    })
    uploadTrend.add(up.timings.duration)

    check(up, {
      'upload ok or replay': (r) => r.status === 201 || r.status === 200,
    })

    const docId = up.json('document.id')
    if (docId) {
      const st = http.get(`${BASE}/api/documents/${docId}/extraction-status`, {
        headers: { cookie: COOKIE },
      })
      statusTrend.add(st.timings.duration)
      check(st, { 'status ok': (r) => r.status === 200 })
    }
  })

  sleep(1)
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data),
  }
}

// Minimal text summary (k6's built-in textSummary is deprecated in newer
// versions; keep this dependency-free).
function textSummary(data) {
  const m = data.metrics
  return `
==== Extraction Load Test ====
upload   P95: ${m.upload_duration ? m.upload_duration.values['p(95)'].toFixed(0) : 'n/a'} ms
status   P95: ${m.status_duration ? m.status_duration.values['p(95)'].toFixed(0) : 'n/a'} ms
failed:    ${(m.http_req_failed ? m.http_req_failed.values.rate * 100 : 0).toFixed(2)}%
`
}
