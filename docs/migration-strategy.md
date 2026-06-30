# Database Migration Strategy

TaxDox AI uses Prisma migrations against PostgreSQL. Goal: **zero-downtime deploys with safe rollback.** Every schema change follows expand/contract so the app keeps running between the "expand" and "contract" deploys.

## Principles

1. **One migration per PR.** Never bundle unrelated schema changes.
2. **Expand before contract.** Additive changes (new columns/tables/indexes) first; breaking changes (drops/renames/retype) in a *later* PR after code stops depending on the old shape.
3. **Never drop in the same release that stops reading.** Dropping always lags by one deploy.
4. **Backfill out of band.** Large data backfills run as a separate script/job, never inline in the migration.

## Additive (expand) — safe to deploy immediately

Example: adding nullable/defaulted columns (the MFA fields).

```sql
ALTER TABLE "User" ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "mfaSecret" TEXT;             -- nullable
ALTER TABLE "User" ADD COLUMN "mfaBackupCodes" TEXT;        -- nullable
```

- Old code ignores the new columns; new code reads them. **Safe to deploy in any order.**
- This is how the `add_mfa_fields_to_user` and `add_outbox_event` migrations are structured.

## Breaking (contract) — two-phase

Renaming or retyping a column that existing code reads:

1. **Phase A (expand):** add the new column, dual-write in code (write both old + new), backfill, dual-read.
2. **Phase B (contract):** after Phase A is deployed and verified, drop the old column in a follow-up migration.

Example roadmap: encrypting `Client.taxId` at rest (currently plaintext for legacy read paths). That requires a coordinated expand/contract because every read site must learn to decrypt — see `docs/security-rotation.md` §2 for the dual-key read pattern.

## Applying migrations

- **CI:** `prisma migrate deploy` runs against a fresh PG service container; a failed migration fails the build.
- **Production:** `bunx prisma migrate deploy` runs as the Vercel build step (or a pre-deploy hook). `migrate deploy` only applies pending migrations — it never generates new ones in prod.
- **Never** use `migrate dev` or `db push` against production.

## Post-migration verification

After each deploy that includes a migration:

```bash
# 1. Schema is at the expected state.
bunx prisma migrate status

# 2. App boots (validateEnv passes, no column mismatch crashes).
curl -sf $APP_URL/api/health/ready

# 3. Smoke the happy path.
bash scripts/smoke-test.sh
```

## Rollback

If a deploy fails after a migration:

1. **If the migration was additive only (expand):** revert the *code* to the previous release. The new columns are harmless (nullable/defaulted) — the old code ignores them.
2. **If a contract migration dropped something:** roll forward, not back — restoring a dropped column from a backup means data loss. This is why contract changes must be the last step of a multi-PR rollout.

Always take a backup (`bun run db:backup`) before a contract migration.

## Migration inventory (this hardening pass)

| Migration | Type | Notes |
|-----------|------|-------|
| `add_mfa_fields_to_user` | expand (additive) | nullable/defaulted — safe |
| `add_outbox_event` | expand (new table) | safe |
