#!/usr/bin/env bash
#
# TaxDox AI — PostgreSQL backup (pg_dump).
#
# Usage: bash scripts/backup-db.sh [output_path]
#
# Reads DATABASE_URL. Produces a gzipped SQL dump suitable for restore via
# scripts/restore-db.sh. Recommended schedule: nightly via cron or your
# hosting platform's job runner.
#
set -euo pipefail

OUT="${1:-backups/taxdox-$(date -u +%Y%m%dT%H%M%SZ).sql.gz}"
mkdir -p "$(dirname "$OUT")"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

echo "Backing up database to ${OUT}..."
# --no-owner/--no-privileges so the dump restores cleanly to a fresh DB.
pg_dump --no-owner --no-privileges --clean --if-exists "$DATABASE_URL" | gzip > "$OUT"

SIZE=$(du -h "$OUT" | cut -f1)
echo "✓ Backup complete: ${OUT} (${SIZE})"

# Retention: keep the last 30 days of backups in the local dir.
find "$(dirname "$OUT")" -name "taxdox-*.sql.gz" -mtime +30 -delete 2>/dev/null || true
echo "✓ Retention applied (kept last 30 days)"
