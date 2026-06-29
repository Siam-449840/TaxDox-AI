# TaxDox AI — API Contract Freeze

Frozen reference for all `src/app/api/**` routes. Drives the idempotency, RBAC, and validation decisions in later phases. Conventions first, then per-route table.

## Conventions
- **Auth**: every route except the public allowlist requires a NextAuth token (enforced by `src/middleware.ts`). Public: `/api/auth/*`, `/api/stripe/webhook`, `/api/health*`, `/api/cron/*` (key-gated).
- **AuthZ**: mutations must call `requirePermission(req, action, resource)` (ADR-006). `firmId` always from session.
- **Validation**: request bodies validated with Zod (`src/lib/validation.ts`) via `.safeParse()`; never `await req.json()` then trust.
- **Errors**: uniform `{ error: string }` shape. Status codes: `400` validation, `401` unauth, `403` forbidden, `404` not found, `409` conflict, `500` server.
- **Idempotency**: `POST /upload`, `/stripe/checkout`, `/emails`, job enqueue accept optional `Idempotency-Key` header (Phase 5.2).
- **Versioning**: breaking changes ship under a new path segment (`/v2/...`); additive changes are non-breaking.

## Per-route contract

| Method + Path | Auth action | Body schema | Success | Notes |
|---------------|-------------|-------------|---------|-------|
| `POST /api/auth/register` | public | `signUpSchema` | 201 `{user,firm}` | First user → firm admin; MFA optional after |
| `POST /api/auth/[...nextauth]` | public | NextAuth | 200 session | Adds `{requiresMfa}` step when MFA on |
| `POST /api/auth/mfa/setup` | `auth:mfa:write` | — | 200 `{secret,qr}` | Returns TOTP secret + QR data URL |
| `POST /api/auth/mfa/verify` | `auth:mfa:write` | `{code}` | 200 `{backupCodes}` | Enables MFA, returns 10 backup codes |
| `POST /api/auth/mfa/disable` | `auth:mfa:write` | `{code}` | 200 | Disables MFA |
| `GET /api/clients` | `client:read` | — (query filters) | 200 `{clients}` | firm-scoped |
| `POST /api/clients` | `client:write` | `createClientSchema` | 201 `{client}` | firmId from session |
| `GET /api/engagements` | `engagement:read` | — | 200 `{engagements}` | firm-scoped |
| `POST /api/engagements` | `engagement:write` | `createEngagementSchema` | 201 `{engagement}` | firmId from session |
| `GET/POST /api/engagements/[id]` | `engagement:*` | — | 200/200 | ownership-checked |
| `POST /api/engagements/[id]/send` | `engagement:write` | `{via}` | 200 | emits `pbc.sent` |
| `POST /api/documents/upload` | `document:write` | multipart | 201 `{document,jobId}` | enqueues extraction; Idempotency-Key |
| `GET /api/documents/[id]/preview` | `document:read` | — | 200 binary | ownership-checked |
| `GET /api/documents/[id]/html` | `document:read` | — | 200 `{html}` | Word docs only |
| `GET /api/documents/[id]/extraction-status` | `document:read` | — | 200 `{status, progress}` | new (Phase 4) |
| `POST /api/ai/classify` | `document:write` | `{documentId}` | 200 `{documentType,...}` | becomes job trigger |
| `POST /api/ai/extract` | `document:write` | `{documentId}` | 200 `{extractions}` | becomes job trigger |
| `POST /api/ai/chat` | `ai:use` | `{messages}` | 200 stream | prompt-injection sanitized |
| `GET /api/emails` | `email:read` | — | 200 `{emails}` | firm-scoped |
| `POST /api/emails` | `email:write` | `sendEmailSchema` | 201 `{email}` | via transport; emits `email.requested` |
| `GET /api/pbc-lists` `/[id]` `/[id]/items` | `pbc:read` | — | 200 | firm-scoped |
| `GET /api/settings/{team,templates,integrations}` | `setting:read` | — | 200 | admin/partner for writes |
| `POST /api/settings/{team,templates}` | `setting:write` | schema | 201 | admin/partner only |
| `GET /api/reports` | `report:read` | — | 200 `{metrics}` | firm-scoped |
| `GET /api/dashboard` | `dashboard:read` | — | 200 | firm-scoped |
| `GET /api/tax-plugins` | public-ish | — | 200 | static-ish |
| `POST /api/stripe/checkout` | `billing:write` | `{tier}` | 200 `{url}` | Idempotency-Key |
| `POST /api/stripe/portal` | `billing:write` | — | 200 `{url}` | |
| `GET /api/stripe/subscription` | `billing:read` | — | 200 `{firm,usage}` | |
| `POST /api/stripe/webhook` | public (sig) | Stripe | 200 | idempotent on stripeEventId |
| `GET /api/health` | public | — | 200/503 | composite (legacy) |
| `GET /api/health/live` | public | — | 200 | process only |
| `GET /api/health/ready` | public | — | 200/503 | deps + circuits |
| `GET /api/cron/reminders` | key-gated | — | 200 `{processed,...}` | emits `deadline.reminder` |
| `GET /api/audit-logs` | `audit:read` | — | 200 | admin/partner |

## Role → action matrix (defaults)
| Action | admin | partner | manager | preparer | read-only |
|--------|-------|---------|---------|----------|-----------|
| `*:read` | ✅ | ✅ | ✅ | ✅ (own) | ✅ |
| `client:write` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `engagement:write` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `document:write` | ✅ | ✅ | ✅ | ✅ (own) | ❌ |
| `email:write` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `setting:write` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `billing:write` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `audit:read` | ✅ | ✅ | ❌ | ❌ | ❌ |
