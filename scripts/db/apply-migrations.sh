#!/usr/bin/env bash
# Wendet Stubs (nur lokal) und alle Migrationen in Reihenfolge auf die per PG*-Variablen adressierte Datenbank an.
set -euo pipefail
cd "$(dirname "$0")/../.."
export PGOPTIONS="${PGOPTIONS:-} -c search_path=public,extensions"
psql -v ON_ERROR_STOP=1 -q -f scripts/db/supabase-stubs.sql
psql -v ON_ERROR_STOP=1 -q -c "alter database ${PGDATABASE:-postgres} set search_path = public, extensions;"
for f in supabase/migrations/*.sql; do
  echo "→ $(basename "$f")"
  psql -v ON_ERROR_STOP=1 -q -f "$f"
done
echo "Migrationen angewendet."
