#!/usr/bin/env bash
# Pulihkan database SIIPB dari berkas backup (.sql.gz atau .sql).
#   ./infrastructure/scripts/restore_db.sh backups/siipb-20261007-010000.sql.gz
# PERINGATAN: menimpa seluruh isi database. Layanan aplikasi dihentikan sementara.
set -euo pipefail
cd "$(dirname "$0")/../.."
[ -f "${1:-}" ] || { echo "Pemakaian: $0 <berkas-backup.sql.gz>"; exit 1; }
set -a; . ./.env; set +a
read -r -p "Database '${DB_NAME:-siipb}' akan DITIMPA dari $1. Ketik 'PULIHKAN' untuk lanjut: " ok
[ "$ok" = "PULIHKAN" ] || { echo "Dibatalkan."; exit 1; }
docker compose stop backend celery_worker celery_beat frontend
if [[ "$1" == *.gz ]]; then CAT="gunzip -c"; else CAT="cat"; fi
$CAT "$1" | docker compose exec -T -e MYSQL_PWD="$DB_PASSWORD" mariadb mariadb -u "${DB_USER:-siipb}" "${DB_NAME:-siipb}"
docker compose start backend celery_worker celery_beat frontend   # backend menjalankan alembic upgrade head
echo "Pemulihan selesai. Catat uji restore di Pengaturan > Backup."
