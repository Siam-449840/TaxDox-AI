# Deployment Guide

Staged, canary rollout (ADR-009). The app is serverless-ready (Vercel) with optional self-hosting via the standalone build.

## Environments

| Env | Purpose | DB | Deploy trigger |
|-----|---------|-----|----------------|
| **dev** (local) | Development | local Docker pgvector | `bun dev` |
| **staging** | Pre-prod verification | isolated RDS/pgvector | auto on merge to `main` |
| **production** | Real users | managed pgvector | manual promote from staging, canary 10→25→50→100% |

## Required production environment variables

**All of these MUST be set** — `validateEnv()` fails production boot if any is missing (see `src/lib/env.ts`).

| Var | Source |
|-----|--------|
| `DATABASE_URL` | Managed Postgres (pgvector) |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | `openssl rand -base64 32` / your origin |
| `ENCRYPTION_KEY` | `openssl rand -base64 32` (rotate the leaked one — see security-rotation.md) |
| `APP_URL` | your origin |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER/PROFESSIONAL/BUSINESS` | Stripe dashboard |
| `CRON_API_KEY` | `openssl rand -hex 32` |
| `AI_PROVIDER` | `gemini` (the active provider; see `docs/ai-architecture.md`) |
| `GEMINI_API_KEY` | Google Gemini API key |
| `GEMINI_MODEL` | `gemini-3.5-flash` (or another supported model id) |

**Optional but recommended for full production behavior:**

| Var | Effect when set |
|-----|-----------------|
| `STORAGE_DRIVER=r2` + `R2_*` | uploads to Cloudflare R2 (durable) |
| `EMAIL_DRIVER=resend` + `RESEND_API_KEY` + `FROM_EMAIL` | real email delivery |
| `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` | queued extraction (no timeouts) |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | distributed rate-limit + idempotency |
| `SENTRY_DSN` | error/perf monitoring |
| `FLAG_*` | feature-flag overrides |
| `AI_FALLBACK_PROVIDERS` | ordered comma-separated fallback provider chain (none registered today) |

## First-time production deploy

1. **Provision infra:** managed Postgres (with `pgvector` extension), an R2 bucket, Resend sender domain, Upstash Redis, an Inngest app, a Stripe account.
2. **Run migrations:** `bunx prisma migrate deploy` against the prod DB (additive-only at this point — safe).
3. **Seed the first firm** via sign-up (the first user becomes the firm admin).
4. **Set every required env var** in the hosting provider, then deploy.
5. **Verify:** `curl /api/health/ready` → 200; `bash scripts/smoke-test.sh` → all pass.
6. **Register the Inngest endpoint** (`/api/inngest`) in the Inngest dashboard so functions are synced.
7. **Point the Stripe webhook** at `/api/stripe/webhook` with the signing secret.
8. **Enable the Vercel Cron** for `/api/cron/reminders` (already in `vercel.json`).

## Canary rollout

Use feature flags + gradual traffic shifting:

1. Deploy to production behind `FLAG_EXTRACTION_QUEUE=0` (inline, no behavior change).
2. Enable a flag for a canary cohort (e.g. `FLAG_CANARY_NEW_DASHBOARD=1` for one firm).
3. Shift traffic 10% → 25% → 50% → 100%, watching `/api/health/ready`, Sentry, and error rate.
4. Roll back instantly by reverting the release or flipping the flag.

## Post-deploy checks

```bash
curl -sf $APP_URL/api/health/live        # 200
curl -sf $APP_URL/api/health/ready       # 200 (deps + circuits healthy)
bash scripts/smoke-test.sh               # all green
```

## Stripe live keys

The code is Stripe-complete (checkout, portal, webhook with idempotency). To go live:

1. Create the three Products/Prices in Stripe; copy the `price_*` ids into env.
2. Swap `STRIPE_SECRET_KEY` to `sk_live_*`.
3. Set the production webhook endpoint + copy `whsec_*` to `STRIPE_WEBHOOK_SECRET`.
4. Verify a test checkout → webhook → `subscriptionStatus=active` round-trip on staging first.
