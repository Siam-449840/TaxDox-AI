# ADR-007: Outbox Pattern for Reliable Side Effects

## Status
Accepted

## Context
Mutations currently fan out to multiple side effects inline — write entity, send email (DB log), write audit log, enqueue job. These are **not transactional**: a crash between the entity write and the email log leaves the system in a partial state (client never notified, audit trail incomplete). On a tax platform these inconsistencies are compliance-relevant, not merely cosmetic. Today's 4 "email sends" are also pure DB inserts with no real transport, so delivery is best-effort and unobservable.

## Decision
Adopt the **transactional outbox pattern**:
1. A new `OutboxEvent` model records every intended side effect **in the same Prisma transaction** as the main mutation (status `pending`).
2. A relay (Inngest-scheduled function) drains the outbox: dispatches email (via `EmailTransport`), webhooks, audit entries, with retries and exponential backoff.
3. `sendEmail()` (`src/lib/email.ts`) becomes: **deliver via transport → write `EmailLog` with the real result → mark outbox row `sent`**.
4. The event types are catalogued in `docs/event-catalog.md`.

## Consequences
- **Positive**: At-least-once delivery of emails/audits — no silent drops on partial failure.
- **Positive**: Real transport status is persisted (`EmailLog.status`), making delivery observable for the first time.
- **Positive**: Decouples mutation latency from external-service latency.
- **Negative**: Adds a relay step + outbox table (storage + a periodic drain).
- **Negative**: Requires idempotent consumers (emails/webhooks must dedupe on a stable event id).

## Alternatives Considered
- **Inline best-effort fan-out** (current; rejected: partial failures, unobservable delivery).
- **Transactional CDC stream** (overkill until volume demands it; outbox + relay is the simpler isomorphic step).

## Review Date
Q4 2026
