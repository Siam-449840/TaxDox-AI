# AGENTS.md — TaxDox AI

Guidance for ZCode agents working in this repository. Read this before editing.

## What this is

TaxDox AI is an AI-native **tax document intelligence platform for accounting firms** — multi-tenant SaaS where each "tenant" is a CPA firm. Built with Next.js 16 (App Router) + Prisma/Postgres + a Gemini 3.5 Flash vision extraction pipeline (via a multi-provider AI Gateway; see `docs/ai-architecture.md`). Handles tax PII (SSN/EIN), so security and tenant isolation are first-class concerns.

## Critical conventions (do not violate)

- **`firmId` ALWAYS comes from the session, never the request body.** Every firm-scoped Prisma query must filter by `firmId` (directly or via `client: { firmId }` / `engagement: { firmId }`). Trusting `body.firmId` is the #1 cross-tenant IDOR vector. See `src/lib/permissions.ts`.
- **All API routes go through `requirePermission(req, action, resource)`** (returns `{ user, firmId }` or a 401/403 `NextResponse` to return verbatim). 27 routes already do. Never add a mutating `/api/*` route without it.
- **No insecure fallbacks for secrets.** `src/lib/env.ts` is the single source of truth — `validateEnv()` throws in production if a required var is missing (called from `src/instrumentation.ts` at boot). Never add `|| 'insecure-default'`.
- **PII (SSN/EIN) is AES-256-GCM encrypted at field level** via `src/lib/encryption.ts` (`encryptPII`/`decryptPII`/`maskPII`). Mask for display; never log raw PII. `ENCRYPTION_KEY` must come from env (no default in prod).
- **Document text sent to AI must pass `sanitizeDocumentText()`** (`src/lib/ai-security.ts`) — prompt-injection defense.
- **Word-doc preview HTML must pass `sanitize-html`** allowlist (XSS defense). See `src/app/api/documents/[id]/html/route.ts`.

## Commands

```bash
npm run dev                 # Next dev on :3000 (writes dev.log)
npm run build               # standalone build; copies static+public into .next/standalone
npm run start               # prod: bun .next/standalone/server.js
npm run lint                # eslint
npx tsc --noEmit            # typecheck (scripts/ and load-tests/ are excluded from build)

# DB
npx prisma generate         # after schema changes
npm run db:migrate          # create + apply migration (dev)
npm run db:migrate:deploy   # apply existing migrations (prod/CI)
npm run db:seed             # seed Firm A (Meridian CPA) — bun prisma/seed.ts
bun scripts/seed-tenant-b.ts # seed Firm B (Atlas) — needed for cross-tenant tests

# Validation
npm run smoke               # 10-check smoke test (expects server on :3000)
npm run perf:baseline       # DB perf baseline
k6 run load-tests/k6-db-read.js --env AUTH_COOKIE="next-auth.session-token=..."
bun scripts/perf-http.ts    # authenticated P50/P95/P99 over HTTP
npm run db:backup / db:restore  # pg_dump/restore drill
npm audit --audit-level=moderate
```

Local infra: `docker-compose up -d` (Postgres 15 + pgvector, Redis 7). Postgres client tools (`pg_dump`/`psql`) are **not** on the host — run them via `docker exec <pg-container> ...`.

## Runtime caveats

- `.env` ships with weak/dev placeholders (`NEXTAUTH_SECRET`, Stripe `*_placeholder_*`). These MUST be rotated before any real deployment — do not treat `.env` values as production-safe.
- Production login **fails closed without Redis** (Upstash REST). For local runtime tests against `NODE_ENV=production`, set `CI=true` to enable the in-memory rate-limit fallback — it does not weaken any real control (production deploys don't set `CI`).
- Run the prod server on **port 3000** (matches `NEXTAUTH_URL`); NextAuth redirects callbacks to `NEXTAUTH_URL`, so other ports won't set the session cookie.
- The app expects **Upstash Redis REST** (`UPSTASH_REDIS_REST_URL`/`TOKEN`), not raw Redis protocol — the local Redis container is for health/backup tooling, not the rate limiter.

## Path & import rules

- Path alias: `@/*` → `./src/*` (e.g. `import { db } from '@/lib/db'`).
- Heavy/injection-only deps (`@google/genai`, `pdf-parse`, `mammoth`, `tesseract.js`, `xlsx`, `papaparse`) are **dynamic-`import()`-ed** at call sites — keep them dynamic, don't hoist to top-level. `@google/genai` is imported ONLY in `src/lib/ai/gemini-provider.ts`; all other code goes through the AI Gateway (`src/lib/ai/gateway.ts` → `AIProvider` interface). Never import a provider SDK directly in a route or job.

## Logging

Use the scoped loggers in `src/lib/logger.ts` — pick by domain: `logger.auth | api | ai | billing | document | engagement | notification | security | system`. Structured JSON with module + context. Never log raw PII or full secrets.

## Key files to read before touching sensitive areas

- `docs/threat-model.md` — STRIDE threats + the controls that mitigate them.
- `docs/adr/` — 9 ADRs covering permission engine, outbox, object storage, job queue, health, canary deploy. Read the relevant one before architectural changes.
- `docs/nfrs.md` — performance budgets (API read P95 < 300ms, write < 500ms, bundle < 300KB/route).
- `docs/ai-architecture.md` — the multi-provider AI Gateway pattern; read before touching any AI code.
- `docs/api-contracts.md` — the permission action/resource matrix.
- `docs/migration-strategy.md` — expand/contract migration rules (never do a breaking migration in one step).
- `docs/production-validation-2026-07-03.md` — latest validation state, known gaps, and the go-live checklist.
- `prisma/schema.prisma` — firm-scoped tables all carry `firmId`; relations matter for `where` clauses.
