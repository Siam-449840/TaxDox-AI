# TaxDox AI — Threat Model (STRIDE)

Scope: the TaxDox AI Next.js application — auth, document upload/preview, AI extraction, multi-tenancy, Stripe billing, email. Out of scope: the hosting provider's own infra (Vercel/R2/Upstash/Resend), covered by their respective compliance programs.

Legend: **L** = Likelihood, **I** = Impact, **P** = Priority (H/M/L). Controls map to implementation phases.

## 1. Spoofing

| ID | Threat | L | I | P | Current state | Control |
|----|--------|---|---|---|---------------|---------|
| S1 | Password brute-force / credential stuffing | H | H | H | No lockout | Rate-limit login (Phase 1.5) |
| S2 | Stolen password alone grants access to tax PII | M | H | H | No 2nd factor | MFA/2FA TOTP (Phase 1.6) |
| S3 | Forged session JWT | L | H | M | `NEXTAUTH_SECRET` required (no fallback) | Fail-loud `validateEnv()` (Phase 1.1) |
| S4 | Webhook spoofed as Stripe | M | H | H | Signature verified | Already mitigated; keep |

## 2. Tampering

| ID | Threat | L | I | P | Current state | Control |
|----|--------|---|---|---|---------------|---------|
| T1 | Cross-tenant data write via `body.firmId` | H | H | H | 4 routes trust body | Session-only `firmId` + PermissionEngine (1.3/1.4) |
| T2 | Privilege escalation (preparer → admin endpoint) | H | H | H | No server RBAC | PermissionEngine (1.3) |
| T3 | PII field tampering via direct DB access | L | H | M | AES-GCM at field level | Keep; remove key fallback (1.1) |
| T4 | Prompt injection via document text → bad extraction | M | M | M | `sanitizeDocumentText()` exists | Keep; log injection attempts |
| T5 | CSRF on state-changing API | M | H | M | Only NextAuth CSRF | Origin-check + SameSite (1.7) |

## 3. Repudiation

| ID | Threat | L | I | P | Current state | Control |
|----|--------|---|---|---|---------------|---------|
| R1 | User denies an action with no audit trail | M | H | M | AuditLog exists but not wired everywhere | Outbox audit events (Phase 3) |
| R2 | Idempotent retry double-charges / double-sends | M | M | M | None | Idempotency-Key (Phase 5.2) |

## 4. Information Disclosure

| ID | Threat | L | I | P | Current state | Control |
|----|--------|---|---|---|---------------|---------|
| I1 | Committed `.env` leaks secrets | H | H | H | `.env` tracked in git | Untrack + rotate (1.2) |
| I2 | Cross-tenant read (unscoped GET) | H | H | H | GETs not firm-scoped | `where:{firmId}` on all reads (1.4) |
| I3 | Document preview leaks across tenants | M | H | H | No ownership check | Ownership check in PermissionEngine (1.3) |
| I4 | Insecure default encryption key used in prod | M | H | H | Hardcoded fallback | Remove fallback (1.1) |
| I5 | Verbose error messages leak internals | M | M | L | Generic 500s mostly | Keep generic; never echo stack |

## 5. Denial of Service

| ID | Threat | L | I | P | Current state | Control |
|----|--------|---|---|---|---------------|---------|
| D1 | Synchronous AI extraction saturates workers | H | H | H | Inline in request | Inngest queue (Phase 4) |
| D2 | Oversized upload exhausts memory/disk | M | M | M | 50MB cap exists | Keep; add multipart + checksum (Phase 2) |
| D3 | Runaway cron/loop | L | M | L | Manual trigger | Keep manual + API-key gated |

## 6. Elevation of Privilege

(See T1, T2 — same root cause: no server-side authorization. Resolved by the PermissionEngine.)

---

## Residual risk after controls
- **Vendor concentration**: R2 + Upstash + Resend + Inngest + Stripe + Vercel. Mitigated by abstraction interfaces (`ObjectStore`, `EmailTransport`, job interface) so any one is swappable.
- **MFA bypass via backup codes**: backup codes are hashed and rate-limited same as OTP.
- **WebAuthn/passkeys** not in scope this phase (see `docs/roadmap-passkeys.md`) — TOTP is the stopgap.

## Review cadence
Re-review quarterly and after any architecture change in `docs/adr/`.
