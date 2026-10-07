#!/usr/bin/env bash
# Backup MariaDB SIIPB (gzip) dari host docker compose.
#   ./infrastructure/scripts/backup_db.sh [folder_tujuan]
# Jadwalkan via cron host, mis.:  0 1 * * * /opt/siipb/infrastructure/scripts/backup_db.sh /srv/backup/siipb
# (Celery Beat juga membuat backup harian ke volume backups_data.)
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; . ./.env; set +a
OUT="${1:-./backups}"
mkdir -p "$OUT"
FILE="$OUT/siipb-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose exec -T -e MYSQL_PWD="$DB_PASSWORD" mariadb \
  mariadb-dump -u "${DB_USER:-siipb}" --single-transaction --quick --no-tablespaces --routines --triggers "${DB_NAME:-siipb}" \
  | gzip > "$FILE"
echo "Backup: $FILE ($(du -h "$FILE" | cut -f1))"
# retensi
find "$OUT" -name 'siipb-*.sql.gz' -mtime +"${RETENTION_DAYS:-14}" -delete
