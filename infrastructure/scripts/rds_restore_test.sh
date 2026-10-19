#!/usr/bin/env bash
# Simulasi restore AWS RDS MariaDB dari automated backup (point-in-time, waktu terakhir yang bisa dipulihkan).
#   1. restore ke instans BARU <sumber>-restore-test-<waktu> (instans produksi tidak disentuh)
#   2. bandingkan jumlah baris tabel inti sumber vs hasil restore (query dijalankan di EC2 —
#      satu-satunya host yang boleh mengakses RDS)
#   3. hapus instans uji (KEEP=1 untuk menyimpannya)
#
# Dijalankan dari mesin admin (butuh: aws cli + kredensial admin, jq, ssh ke EC2), setelah ada >= 1 backup harian:
#   ./infrastructure/scripts/rds_restore_test.sh
# Nama stack dibaca dari infrastructure/cloudformation/params.env (PROJECT, ENVIRONMENT, AWS_REGION).
# Estimasi waktu 15-30 menit. Instans uji dikenai biaya selama hidup.
set -euo pipefail
cd "$(dirname "$0")/../cloudformation"
[ -f params.env ] || { echo "infrastructure/cloudformation/params.env tidak ditemukan" >&2; exit 1; }
set -a; . ./params.env; set +a
export AWS_REGION

out() {
  aws cloudformation describe-stacks --stack-name "$1" --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue" --output text
}
SRC=$(out "$PROJECT-$ENVIRONMENT-data" DbInstanceIdentifier)
EC2=$(out "$PROJECT-$ENVIRONMENT-app" PublicIp)
SSH_KEY="${SSH_PUBLIC_KEY_FILE%.pub}"
SSH_KEY="${SSH_KEY/#\~/$HOME}"
TARGET="${SRC}-restore-test-$(date +%Y%m%d%H%M)"

info=$(aws rds describe-db-instances --db-instance-identifier "$SRC")
db() { jq -r ".DBInstances[0].$1" <<<"$info"; }
echo "Sumber            : $SRC"
echo "Retensi backup    : $(db BackupRetentionPeriod) hari, window $(db PreferredBackupWindow) UTC"
echo "Restore ke waktu  : $(db LatestRestorableTime)"
[ "$(db BackupRetentionPeriod)" -gt 0 ] || { echo "Automated backup belum aktif!"; exit 1; }

cleanup() {
  if [ "${KEEP:-0}" = "1" ]; then
    echo "KEEP=1: instans $TARGET dibiarkan. Hapus manual: aws rds delete-db-instance --db-instance-identifier $TARGET --skip-final-snapshot"
  else
    echo "Menghapus instans uji $TARGET ..."
    aws rds delete-db-instance --db-instance-identifier "$TARGET" --skip-final-snapshot --delete-automated-backups >/dev/null || true
  fi
}

echo "Membuat instans restore $TARGET ..."
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier "$SRC" \
  --target-db-instance-identifier "$TARGET" \
  --use-latest-restorable-time \
  --db-instance-class "$(db DBInstanceClass)" \
  --db-subnet-group-name "$(db DBSubnetGroup.DBSubnetGroupName)" \
  --vpc-security-group-ids "$(db 'VpcSecurityGroups[0].VpcSecurityGroupId')" \
  --db-parameter-group-name "$(db 'DBParameterGroups[0].DBParameterGroupName')" \
  --no-publicly-accessible --no-multi-az --no-deletion-protection \
  --tags Key=Purpose,Value=restore-test >/dev/null
trap cleanup EXIT

echo "Menunggu instans tersedia (dapat 15-30 menit) ..."
aws rds wait db-instance-available --db-instance-identifier "$TARGET" \
  || aws rds wait db-instance-available --db-instance-identifier "$TARGET"
ENDPOINT=$(aws rds describe-db-instances --db-instance-identifier "$TARGET" --query 'DBInstances[0].Endpoint.Address' --output text)
echo "Restore siap: $ENDPOINT"

ssh -i "$SSH_KEY" "ubuntu@$EC2" bash -s -- "$ENDPOINT" <<'REMOTE'
set -euo pipefail
set -a; . /opt/siipb/app.env; set +a
Q="SELECT 'users' t, COUNT(*) n FROM users
   UNION ALL SELECT 'assets', COUNT(*) FROM assets
   UNION ALL SELECT 'borrowings', COUNT(*) FROM borrowings
   UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs
   UNION ALL SELECT CONCAT('alembic ', version_num), 0 FROM alembic_version"
run() { MYSQL_PWD="$DB_PASSWORD" mariadb -h "$1" -u "$DB_USER" "$DB_NAME" -N -e "$Q"; }
run "$DB_HOST" > /tmp/src.txt
run "$1"       > /tmp/restore.txt
echo "== Sumber (produksi) =="; cat /tmp/src.txt
echo "== Hasil restore    =="; cat /tmp/restore.txt
if diff -q /tmp/src.txt /tmp/restore.txt >/dev/null; then
  echo "HASIL: IDENTIK — restore berhasil."
else
  echo "HASIL: ada selisih (wajar bila ada transaksi setelah LatestRestorableTime, ~5 menit terakhir). Periksa di atas."
fi
REMOTE

echo "Simulasi restore selesai $(date -Is). Catat hasilnya di Pengaturan > Backup / laporan UAT."
