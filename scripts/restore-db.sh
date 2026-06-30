#!/usr/bin/env bash
#
# TaxDox AI — PostgreSQL restore (from a backup-db.sh dump).
#
# Usage: bash scripts/restore-db.sh <backup.sql.gz>
#
# Destructive: runs the dump's DROP/CREATE statements (--clean --if-exists
# was used at backup time), so the target DB is overwritten. Always confirm
# the target DATABASE_URL before running.
#
set -euo pipefail

DUMP="${1:-}"
if [ -z "$DUMP" ]; then
  echo "Usage: bash scripts/restore-db.sh <backup.sql.gz>" >&2
  exit 1
fi
if [ ! -f "$DUMP" ]; then
  echo "ERROR: dump file not found: $DUMP" >&2
  exit 1
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

echo "⚠️  This will OVERWRITE the database at the current DATABASE_URL."
echo "    Dump:  ${DUMP}"
echo "    Target: \${DATABASE_URL}"
read -r -p "Type 'restore' to confirm: " CONFIRM
if [ "$CONFIRM" != "restore" ]; then
  echo "Aborted." >&2
  exit 1
fi

echo "Restoring..."
gunzip -c "$DUMP" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1
echo "✓ Restore complete"
