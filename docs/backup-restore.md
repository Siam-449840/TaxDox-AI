# Backup & Restore

## Backup

Nightly logical dump via `pg_dump`:

```bash
bun run db:backup
# → backups/taxdox-YYYYMMDDTHHMMSSZ.sql.gz
```

The script (`scripts/backup-db.sh`) uses `--clean --if-exists --no-owner --no-privileges` so the dump restores cleanly to a fresh DB, and applies 30-day local retention.

**Schedule it** via Vercel Cron, GitHub Actions, or your DB provider's managed backup. For a tax-PII app, combine:

- **Managed automated backups** (RDS/Aurora/Neon point-in-time recovery) — primary.
- **Nightly `pg_dump` to object storage** (R2/S3) — portable, off-provider copy.
- **Weekly backup-restore drill** — see below.

## Restore

```bash
# ⚠️  Destructive — overwrites the target DATABASE_URL.
bun run db:restore backups/taxdox-20260630T120000Z.sql.gz
```

Always restore into a **fresh staging DB** first to verify, never directly into production without a drill.

## Backup-restore drill (monthly)

1. Spin up a throwaway DB (`docker run ankane/pgvector:v0.5.1`).
2. `DATABASE_URL=<throwaway> bun run db:restore backups/<latest>.sql.gz`.
3. Point a staging deploy at the throwaway and run `bash scripts/smoke-test.sh`.
4. Spot-check: can you log in? Are clients/documents present? Do extractions read?
5. Record: backup age, restore time, smoke result. File an issue if anything fails.

A backup you've never restored is a hope, not a backup.

## Object storage

R2 uploads (`download/uploads`) are durable independently (11×9s) and lifecycle-managed at the bucket. They are NOT covered by the DB dump — they live in R2 and are backed up via R2's own bucket versioning/replication. Enable R2 bucket versioning in production.
