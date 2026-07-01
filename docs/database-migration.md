# PostgreSQL Database Migration Guide

This document outlines the migration from SQLite to PostgreSQL for the TaxDox AI platform.

## 1. Migration Process

The application was successfully migrated from SQLite to PostgreSQL with `pgvector` enabled on **June 29, 2026**.

**Key Changes:**
- `prisma/schema.prisma` provider was updated from `sqlite` to `postgresql`.
- Extensions `pg_trgm`, `uuid-ossp`, `citext`, and `vector` were added to the schema.
- Local development now uses a Dockerized `pgvector:pg16` image via `docker-compose.yml`.
- The `DATABASE_URL` format is now a PostgreSQL connection string instead of a local file path.
- The previous SQLite migrations were archived to `prisma/migrations-sqlite-backup` to preserve history.

**Performance Baseline Results:**
- SQLite concurrent writes (10 records): 160.65ms
- PostgreSQL concurrent writes (10 records): 34.24ms
*(Massive improvement in concurrency, which was the primary driver for this migration).*

## 2. Rollback Guide

If a critical failure occurs and you need to revert to SQLite:
1. Update `.env`: Set `DATABASE_URL=file:../db/custom.db`
2. Update `prisma/schema.prisma`:
   - Change `provider = "postgresql"` back to `provider = "sqlite"`.
   - Remove the `previewFeatures` and `extensions` blocks.
3. Restore migrations:
   - Move `prisma/migrations` to `prisma/migrations-postgres-backup`.
   - Rename `prisma/migrations-sqlite-backup` back to `prisma/migrations`.
4. Run `npx prisma generate` to update the Prisma Client.

## 3. Production Setup

In a production environment (e.g., Supabase, Neon, AWS RDS, GCP Cloud SQL):
1. **Environment Variables**:
   - Do NOT use the local Docker connection string.
   - Set the `DATABASE_URL` to your managed PostgreSQL instance.
   - For Prisma, you may need a separate `DIRECT_URL` if using a connection pooler like Supabase's built-in pooler.
2. **Extensions**:
   - Ensure the managed database provider has `pgvector` and `pg_trgm` extensions enabled on the specific database instance.

## 4. Backup Strategy

For the local Docker database:
- A local volume `postgres-data` is mounted. To back it up, you can run `docker exec -t <container_name> pg_dumpall -c -U taxdox_dev > dump.sql`.

For Production:
- Rely on the managed database provider's built-in Point-in-Time Recovery (PITR) and automated daily snapshots. Ensure retention is set to at least 30 days for financial data compliance.

## 5. Future Architecture (pgBouncer)

As the application scales in Serverless environments (like Vercel), direct connections to PostgreSQL can easily exhaust the database connection limit. 

**Future Setup:**
```
Next.js API Routes (Serverless)  --->  pgBouncer (Connection Pooler)  --->  PostgreSQL
```
*Note: If deploying to Supabase, this is handled automatically via their port 6543 pooler.*
