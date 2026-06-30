# Secret Rotation Procedure

> ⚠️ **The `.env` file was previously committed to git (4 commits).** Any
> secret that lived in it must be treated as **compromised and rotated**
> before this codebase touches real tax data.

## 1. Required rotation (committed secrets are burned)

Rotate every one of these and update them in the deployment environment
(Vercel project env vars / secrets manager) — **not** in a new committed file.

| Secret | Where rotated | How to generate |
|--------|---------------|-----------------|
| `NEXTAUTH_SECRET` | Auth0/NextAuth sessions | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | AES-256-GCM PII encryption | `openssl rand -base64 32` |
| `CRON_API_KEY` | `/api/cron/*` guard | `openssl rand -hex 32` |
| `STRIPE_SECRET_KEY` | Stripe dashboard | Roll the key in Stripe |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook settings | Recreate the webhook endpoint |
| `STRIPE_PRICE_*` | Stripe products | Re-fetch price ids |
| `DATABASE_URL` | DB host | Rotate the DB password |

## 2. Special case: rotating `ENCRYPTION_KEY`

This key encrypts PII at the field level (SSN/EIN/Tax-ID). **Rotating it
invalidates the decryption of existing encrypted rows.** Use a two-phase
rotation:

1. **Phase A — dual-key read**: deploy code that, on decrypt failure with the
   new key, falls back to the old key (`ENCRYPTION_KEY_PREVIOUS`). Existing
   rows still readable.
2. **Phase B — re-encrypt**: run a backfill job that decrypts with the old key
   and re-encrypts with the new, then remove `ENCRYPTION_KEY_PREVIOUS`.

(For the first production deploy with a fresh DB this is moot — there is no
legacy ciphertext to migrate.)

## 3. Verifying rotation

- `curl https://<prod>/api/health/ready` returns 200 (boot validation passed).
- Login still works (JWT signed by new secret).
- Upload a document → preview it (R2 creds valid).
- Trigger `/api/cron/reminders?key=<new>` (cron key valid).

## 4. Preventing recurrence

- `.gitignore` excludes `.env*` (except `.env.example`).
- CI runs **Gitleaks** (`.github/workflows/security.yml`) to reject any
  future commit containing high-entropy secrets.
- `validateEnv()` fails production boot on any missing required var.
