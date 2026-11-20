#!/usr/bin/env bash
# Start the user-space PostgreSQL cluster used by Nava (no root needed).
#
# The data directory lives INSIDE the project (./.pgdata) so every teammate
# gets the same layout. It is gitignored — each machine runs `npm run setup`
# once to init + migrate + seed. Port 5433 is fixed so DATABASE_URL in .env
# matches on every device.
set -euo pipefail

PGBIN=${PGBIN:-/usr/lib/postgresql/18/bin}
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGDIR="$PROJECT_DIR/.pgdata"
SOCK=/tmp/pgsafar

if [ ! -x "$PGBIN/initdb" ]; then
  echo "ERROR: PostgreSQL 18 not found at $PGBIN" >&2
  echo "Install it with:  sudo apt-get install postgresql-18" >&2
  exit 1
fi

if [ ! -d "$PGDIR/base" ]; then
  mkdir -p "$PGDIR" "$SOCK"
  "$PGBIN/initdb" -D "$PGDIR" -U safar -A trust -E UTF8 --locale=C.UTF-8 >/dev/null
fi
if ! "$PGBIN/pg_ctl" -D "$PGDIR" status >/dev/null 2>&1; then
  mkdir -p "$SOCK"
  "$PGBIN/pg_ctl" -D "$PGDIR" -l "$PGDIR/postgres.log" \
    -o "-p 5433 -k $SOCK -c listen_addresses=127.0.0.1" -w start >/dev/null
fi
"$PGBIN/createdb" -h127.0.0.1 -p 5433 -U safar safar 2>/dev/null || true
"$PGBIN/createdb" -h127.0.0.1 -p 5433 -U safar safar_test 2>/dev/null || true
echo "postgres ready on 127.0.0.1:5433 (dbs: safar, safar_test)"
