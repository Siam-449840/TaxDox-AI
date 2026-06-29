# ADR-008: Health-Check Maturity (live vs ready)

## Status
Accepted

## Context
The single `/api/health` endpoint conflates liveness and readiness. Orchestrators (Vercel/k8s/load balancers) need them separate: **liveness** ("is the process alive?") drives restarts; **readiness** ("can I serve traffic?") drives routing. A slow DB or open circuit breaker should pull the instance out of rotation (503 `/ready`) without forcing a restart (200 `/live`).

## Decision
Split into three endpoints, all public (no auth) so infra can poll:
1. **`GET /api/health/live`** — process only; always 200 if the server responds. Drives restart decisions.
2. **`GET /api/health/ready`** — composite: DB ping, Upstash Redis reachability, R2/Resend reachability, **circuit-breaker states** (AI / Resend / Stripe), Inngest reachability. 503 if any critical dependency is down or a breaker is open.
3. **`GET /api/health`** — retained as a backwards-compatible composite (DB + process + env) for existing monitors and the smoke test.

Readiness checks are **fail-closed in production** (a missing dependency returns unhealthy) and lenient in development (warns but stays healthy so local dev isn't blocked by unset third-party creds).

## Consequences
- **Positive**: Infra can keep an alive-but-unready instance running while it recovers, instead of thrashing restarts.
- **Positive**: Circuit-breaker state becomes operationally visible, enabling graceful degradation.
- **Negative**: Three endpoints to maintain; documented in `docs/api-contracts.md` to keep them consistent.

## Alternatives Considered
- **Single `/health`** (rejected: conflates two distinct signals).
- **External uptime probe only** (rejected: doesn't expose internal dependency/circuit state).

## Review Date
Q4 2026
