# TaxDox AI — Event Catalog (Outbox)

Canonical list of outbox event types emitted by the application (see ADR-007). Producers write these transactionally; the relay drains and dispatches them. Consumers **must be idempotent** (dedupe on `eventId`).

## Event envelope
Every outbox row stores:
```
{ id, eventType, aggregateType, aggregateId, firmId, payload(JSON), status, attempts, eventId, createdAt, dispatchedAt }
```
`eventId` is a stable dedupe key (uuid v5 over aggregate+type+occurrence).

## Event types

| eventType | Producer | Trigger | Consumers | idempotency key basis |
|-----------|----------|---------|-----------|-----------------------|
| `document.uploaded` | `POST /api/documents/upload` | file persisted to object store | audit logger, (optional) notify assignee | documentId |
| `document.classified` | extraction job | classify step complete | audit logger | documentId + modelVersion |
| `extraction.completed` | extraction job | fields written | `EmailTransport` (client notify), audit | documentId |
| `extraction.failed` | extraction job | retries exhausted | audit, alerting | documentId |
| `pbc.sent` | `POST /api/engagements/[id]/send` | PBC list dispatched | `EmailTransport` (client email), audit | engagementId |
| `email.requested` | `POST /api/emails` | ad-hoc email | `EmailTransport`, audit | client requestId |
| `deadline.reminder` | `GET /api/cron/reminders` | deadline within 14d | `EmailTransport` | engagementId + day |
| `subscription.activated` | Stripe webhook | checkout completed | audit, (optional) welcome email | stripeEventId |
| `subscription.past_due` | Stripe webhook | invoice failed | audit, (optional) dunning email | stripeEventId |
| `subscription.canceled` | Stripe webhook | subscription deleted | audit | stripeEventId |

## Retry & DLQ semantics
- The relay retries up to **5×** with exponential backoff (30s, 2m, 10m, 30m, 2h).
- After max attempts → status `dead_letter`, surfaced in `/ready` health and alerted.
- Transport failures (e.g. Resend 5xx) are retried; 4xx (bad address) mark `failed` immediately and are not retried.

## Versioning
Adding a field is backward-compatible. Removing/renaming a field requires a new `eventType` version suffix (e.g. `extraction.completed.v2`) — consumers opt in.
