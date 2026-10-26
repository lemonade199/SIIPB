#!/usr/bin/env bash
# Pulihkan database SIIPB dari berkas backup (.sql.gz atau .sql).
#   ./infrastructure/scripts/restore_db.sh backups/siipb-20261007-010000.sql.gz
# PERINGATAN: menimpa seluruh isi database. Layanan aplikasi dihentikan sementara.
set -euo pipefail
cd "$(dirname "$0")/../.."

BACKUP_FILE="${1:-}"
[ -f "$BACKUP_FILE" ] || { echo "Pemakaian: $0 <berkas-backup.sql.gz>"; exit 1; }

# 1. Validasi integritas berkas arsip sebelum operasi
if [[ "$BACKUP_FILE" == *.gz ]]; then
  echo "Memeriksa integritas arsip gzip..."
  gzip -t "$BACKUP_FILE" || { echo "ERROR: Berkas arsip $BACKUP_FILE rusak (corrupted)! Pemulihan dibatalkan." >&2; exit 1; }
  CAT="gunzip -c"
else
  CAT="cat"
fi

set -a; . ./.env; set +a
DB="${DB_NAME:-siipb}"
USER="${DB_USER:-siipb}"

# 2. Uji konektivitas database
if ! docker compose exec -T -e MYSQL_PWD="$DB_PASSWORD" mariadb mariadb -u "$USER" -e "SELECT 1;" >/dev/null 2>&1; then
  echo "ERROR: Tidak dapat terhubung ke MariaDB di Docker Compose. Pastikan kontainer mariadb berjalan." >&2
  exit 1
fi

read -r -p "Database '$DB' akan DITIMPA dari $BACKUP_FILE. Ketik 'PULIHKAN' untuk lanjut: " ok
[ "$ok" = "PULIHKAN" ] || { echo "Dibatalkan."; exit 1; }

# Pastikan layanan aplikasi dinyalakan kembali meskipun skrip mengalami error di tengah jalan
trap 'echo "Memastikan layanan aplikasi berjalan..."; docker compose start backend celery_worker celery_beat frontend >/dev/null 2>&1 || true' EXIT

echo "Menghentikan layanan backend, worker, dan frontend sementara..."
docker compose stop backend celery_worker celery_beat frontend

echo "Memulihkan database '$DB'..."
if ! $CAT "$BACKUP_FILE" | docker compose exec -T -e MYSQL_PWD="$DB_PASSWORD" mariadb mariadb -u "$USER" "$DB"; then
  echo "ERROR: Eksekusi SQL pemulihan gagal!" >&2
  exit 1
fi

echo "Memulai kembali layanan aplikasi..."
docker compose start backend celery_worker celery_beat frontend

# 3. Verifikasi hasil pemulihan
TABLE_COUNT=$(docker compose exec -T -e MYSQL_PWD="$DB_PASSWORD" mariadb mariadb -u "$USER" -N -s -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$DB';")
echo "Pemulihan berhasil diverifikasi ($TABLE_COUNT tabel aktif di database '$DB')."
echo "Catat tanggal dan hasil uji restore di menu Pengaturan > Backup."
