# ADR-009: Deployment Strategy (staged + canary)

## Status
Accepted

## Context
The app deploys straight to a single environment with no gate between "builds green" and "users hit it." For a platform handling tax data and payments, a bad deploy (a migration that breaks a query, a regression in extraction) lands on all users simultaneously with no safe rollback or early-warning path.

## Decision
Adopt a **staged deployment pipeline** with **canary rollout**:
1. **dev** (local) → **staging** (auto-deploy on merge to `main`, isolated DB) → **production** (manual promote from staging).
2. Production promotion uses **canary** traffic shifting: 10% → 25% → 50% → 100%, gated by feature flags (`src/lib/flags.ts`) and health signals.
3. `vercel.json` pins build config; long-running job routes get explicit `maxDuration`; `/api/cron/reminders` is wired as a Vercel Cron.
4. Required CI gates (`docs/` + `.github/workflows/ci.yml`) must pass before any staging deploy: `tsc --noEmit`, `eslint`, `prisma migrate status`, `npm audit --audit-level=high`, `next build`, smoke test.
5. Database migrations follow **expand/contract** (`docs/migration-strategy.md`) — additive changes first, backfill, then contract in a later deploy — so zero-downtime deploys are possible and rollback is safe.

## Consequences
- **Positive**: Bad changes are caught at staging or during 10% canary, not by 100% of users.
- **Positive**: Expand/contract migrations make rolling forward/back safe.
- **Negative**: Slightly slower release cadence (staging gate) — acceptable for tax/payment workloads.
- **Negative**: Feature-flag and canary tooling add a small operational surface.

## Alternatives Considered
- **Push-to-main → prod** (current; rejected: no blast-radius control).
- **Blue/green only** (rejected: lacks graduated traffic shifting; canary gives earlier signal).

## Review Date
Q4 2026
