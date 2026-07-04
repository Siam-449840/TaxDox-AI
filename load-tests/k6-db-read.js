/**
 * k6 DB-backed READ load test — exercises the authenticated read API surface
 * against Postgres at escalating concurrency.
 *
 * Run:  k6 run load-tests/k6-db-read.js --env AUTH_COOKIE="next-auth.session-token=..."
 *
 * Thresholds aligned with docs/nfrs.md (API read P95 < 300ms, error rate < 1%).
 */
import http from 'k6/http'
import { check, group } from 'k6'
import { Trend } from 'k6/metrics'

const BASE = __ENV.BASE_URL || 'http://localhost:3000'
const COOKIE = __ENV.AUTH_COOKIE || ''
const STAGES = __ENV.STAGES || 'default' // 'low' | 'default' | 'high'

const dashboardT = new Trend('db_dashboard', true)
const engT = new Trend('db_engagements', true)
const docsT = new Trend('db_documents', true)
const notifT = new Trend('db_notifications', true)
const reportsT = new Trend('db_reports', true)

const profiles = {
  low:     [{ duration: '20s', target: 50 },  { duration: '30s', target: 50 },  { duration: '10s', target: 0 }],
  default: [{ duration: '30s', target: 100 }, { duration: '1m',  target: 100 }, { duration: '20s', target: 0 }],
  high:    [{ duration: '40s', target: 500 }, { duration: '1m',  target: 500 }, { duration: '30s', target: 0 }],
}

export const options = {
  stages: profiles[STAGES] || profiles.default,
  thresholds: {
    db_dashboard:    ['p(95)<300'],
    db_engagements:  ['p(95)<300'],
    db_documents:    ['p(95)<300'],
    db_notifications:['p(95)<400'],
    db_reports:      ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
}

const headers = { cookie: COOKIE, origin: BASE }

export default function loadTest() {
  group('dashboard', () => {
    const r = http.get(`${BASE}/api/dashboard`, { headers })
    dashboardT.add(r.timings.duration)
    check(r, { 'dashboard 200': (x) => x.status === 200 })
  })
  group('engagements', () => {
    const r = http.get(`${BASE}/api/engagements`, { headers })
    engT.add(r.timings.duration)
    check(r, { 'engagements 200': (x) => x.status === 200 })
  })
  group('documents', () => {
    const r = http.get(`${BASE}/api/documents`, { headers })
    docsT.add(r.timings.duration)
    check(r, { 'documents 200': (x) => x.status === 200 })
  })
  group('notifications', () => {
    const r = http.get(`${BASE}/api/notifications`, { headers })
    notifT.add(r.timings.duration)
    check(r, { 'notifications 200': (x) => x.status === 200 })
  })
  group('reports', () => {
    const r = http.get(`${BASE}/api/reports`, { headers })
    reportsT.add(r.timings.duration)
    check(r, { 'reports 200': (x) => x.status === 200 })
  })
}
