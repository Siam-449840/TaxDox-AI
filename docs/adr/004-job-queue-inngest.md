# ADR-004: Job Queue with Inngest (serverless)

## Status
Accepted

## Context
AI extraction (classify → OCR → LLM) is long-running (5–30s+) and currently **synchronous** inside the request handler. Under load this hits API timeouts, blocks the event loop, and degrades the upload UX. The previous plan proposed BullMQ + Redis, which requires a persistent worker process + Redis instance — friction on a serverless (Vercel) deployment and extra operational surface (worker scaling, dead-letter queues, monitoring).

## Decision
Adopt **Inngest** as the background-job layer:
1. Extraction pipeline runs as an **Inngest function** (`src/lib/jobs/extraction.ts`) — retries (3× exponential backoff), timeouts, per-step concurrency, and a built-in observability dashboard.
2. Upload route **enqueues** an Inngest event and returns `{ jobId, status: 'queued' }` immediately; clients poll `GET /api/documents/[id]/extraction-status`.
3. **Upstash Redis (REST)** is retained only for stateless concerns (rate limiting, idempotency keys) — no worker process needed.
4. **Sync fallback**: when `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` are unset (local dev), extraction runs inline as before — the app never hard-requires the queue.

## Consequences
- **Positive**: No worker process to deploy/scale; first-class fit for Vercel serverless.
- **Positive**: Retries, timeouts, and dashboard come for free; extraction no longer risks request timeouts.
- **Positive**: A single conditional (`isQueueEnabled()`) keeps `bun dev` fully functional without credentials.
- **Negative**: Vendor coupling to Inngest (mitigated by isolating all Inngest calls behind `src/lib/jobs/extraction.ts`).
- **Negative**: One new external dependency (Inngest) + Upstash for limits/idempotency.

## Alternatives Considered
- **BullMQ + Redis** (rejected: worker-process burden, more to operate on serverless).
- **Trigger.dev** (viable; Inngest chosen for simpler serverless DX and stronger Next.js integration).
- **Keep synchronous** (rejected: fails under concurrency, hits platform timeouts).

## Review Date
Q4 2026
