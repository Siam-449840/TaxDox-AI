# TaxDox AI — Non-Functional Requirements & Performance Budget

## 1. Performance budgets (SLO targets)

| Resource | Budget | Measurement | Enforcement |
|----------|--------|-------------|-------------|
| API read (GET) P95 | < 300 ms | `scripts/baseline-perf.ts` + k6 | CI perf gate (Phase 5.7) |
| API write (POST/PUT) P95 | < 500 ms | k6 `load-tests/k6-extraction.js` | CI perf gate |
| Document upload (≤50MB) | < 2 s (excl. network) | k6 | Storage driver to R2 |
| AI extraction (per doc) | < 30 s P95 | Inngest run times | Circuit breaker + timeout |
| JS bundle (First Load JS) | < 300 KB per route | `next build` output | CI bundle-size check |
| DB query (hot path) | < 100 ms | Prisma log threshold | Slow-query guard |

## 2. Scalability
- **Stateless app tier**: no in-process state across instances (sessions are JWT; cache/limits via Upstash REST). Enables horizontal scaling.
- **Target**: 100 concurrent firm users, 10 document uploads/min sustained, without P95 budget breach.
- **Background work**: all AI extraction offloaded to Inngest so the request tier stays fast.

## 3. Reliability / Availability
- **SLO**: 99.9% monthly availability for the app tier (excludes provider outages).
- **Health**: split `/live` + `/ready` (ADR-008); `/ready` 503 pulls an instance from rotation without restart.
- **Resilience**: circuit breakers (AI/Resend/Stripe) — fail fast, half-open recovery.
- **Durability**: uploaded documents in R2 (11×9s durability); DB nightly `pg_dump` + tested restore.

## 4. Security (see `docs/threat-model.md`)
- AuthN: bcrypt(12) + TOTP MFA + login rate-limit.
- AuthZ: PermissionEngine, session-only `firmId`.
- Data: AES-256-GCM field-level encryption for PII; TLS in transit.
- Secrets: fail-loud boot validation; no insecure fallbacks; `.env` untracked.

## 5. Observability
- Structured JSON logs (existing `logger.ts`) with correlation IDs.
- Sentry for errors + traces when `SENTRY_DSN` set.
- CI: `npm audit --audit-level=high`, CodeQL, Gitleaks, Trivy, SBOM.

## 6. Maintainability
- TypeScript strict; `tsc --noEmit` clean in CI (no `ignoreBuildErrors`).
- Expand/contract migrations (`docs/migration-strategy.md`).
- Provider-swappable interfaces (`ObjectStore`, `EmailTransport`, job interface).

## 7. Compliance orientation (tax/PII)
- PII minimized at rest (masked display), encrypted when stored.
- Audit log per material action; immutable append model.
- Data retention/lifecycle via R2 object lifecycle (configurable per firm country plugin).
