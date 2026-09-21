#!/usr/bin/env bash
# Lokaler PostgreSQL 16 ohne Docker (ADR-003).
#   pnpm db:local          startet den Server (Port 54329), legt DB 'provibe' an, wendet Migrationen an, prüft
#   pnpm db:local:stop     stoppt den Server
#   pnpm db:migrate:local  wendet Migrationen erneut auf eine frische DB an
set -euo pipefail
cd "$(dirname "$0")/../.."
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DATA_DIR="${PGDATA_DIR:-.pgdata}"
PORT="${LOCAL_PG_PORT:-54329}"
DB="provibe"
export PGHOST=localhost PGPORT="$PORT" PGUSER=postgres PGDATABASE="$DB"
LOG="$DATA_DIR/server.log"

run_as() { if [ "$(id -u)" = "0" ]; then chown -R postgres:postgres "$DATA_DIR" 2>/dev/null || true; su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }

case "${1:-start}" in
  stop)
    run_as "$PGBIN/pg_ctl -D $DATA_DIR stop -m fast" || true ;;
  start|migrate)
    if [ ! -f "$DATA_DIR/PG_VERSION" ]; then
      mkdir -p "$DATA_DIR"
      run_as "$PGBIN/initdb -D $DATA_DIR -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null"
      echo "unix_socket_directories = '/tmp'" >> "$DATA_DIR/postgresql.conf"
      echo "port = $PORT" >> "$DATA_DIR/postgresql.conf"
      echo "listen_addresses = 'localhost'" >> "$DATA_DIR/postgresql.conf"
    fi
    if ! "$PGBIN/pg_isready" -h localhost -p "$PORT" >/dev/null 2>&1; then
      run_as "$PGBIN/pg_ctl -D $DATA_DIR -l $LOG start -w >/dev/null"
    fi
    psql -d postgres -qc "drop database if exists $DB;" -qc "create database $DB;"
    bash scripts/db/apply-migrations.sh
    bash scripts/db/verify.sh
    echo "Lokale DB bereit: postgres://postgres@localhost:$PORT/$DB" ;;
  *) echo "Verwendung: $0 [start|stop|migrate]"; exit 1 ;;
esac
