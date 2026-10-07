#!/bin/sh
# Menjalankan migrasi database (Alembic) + seed awal sebelum proses utama.
# Hanya container API (RUN_MIGRATIONS=1) yang melakukan migrasi; worker/beat cukup menunggu.
set -e

if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  echo "[entrypoint] alembic upgrade head"
  alembic upgrade head
  if [ "${SEED_ON_START:-1}" = "1" ]; then
    echo "[entrypoint] seed data awal (idempoten)"
    if [ "${SEED_DEMO_DATA:-0}" = "1" ]; then python scripts/seed_data.py; else python scripts/seed_data.py --minimal; fi
  fi
fi

exec "$@"
