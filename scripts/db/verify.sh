#!/usr/bin/env bash
# Prüfungen nach den Migrationen: RLS überall aktiv, Kernfunktionen laufen, Reservierungslogik korrekt.
set -euo pipefail
cd "$(dirname "$0")/../.."
export PGOPTIONS="${PGOPTIONS:-} -c search_path=public,extensions"
psql -v ON_ERROR_STOP=1 -q -f scripts/db/verify.sql
