#!/usr/bin/env bash
# Ambil environment aplikasi dari AWS Secrets Manager -> /opt/siipb/app.env (chmod 600).
# Dipakai docker-compose.prod.yml sebagai env_file; kredensial tidak pernah disimpan di Git/GitHub.
set -euo pipefail
set -a; . /etc/siipb/siipb.conf; set +a

json=$(aws secretsmanager get-secret-value --region "$AWS_REGION" --secret-id "$SECRET_ID" \
  --query SecretString --output text)

# env_file Compose: nilai dalam kutip tunggal dibaca literal (tanpa interpolasi $).
if ! jq -e --arg q "'" '[.[] | tostring | contains($q)] | any | not' >/dev/null <<<"$json"; then
  echo "Secret $SECRET_ID berisi tanda kutip tunggal (') — ganti nilainya." >&2
  exit 1
fi

umask 077
tmp=$(mktemp "$APP_DIR/.app.env.XXXXXX")
jq -r --arg q "'" 'to_entries[] | "\(.key)=\($q)\(.value | tostring)\($q)"' <<<"$json" > "$tmp"
mv "$tmp" "$APP_DIR/app.env"
echo "app.env diperbarui dari $SECRET_ID ($(wc -l < "$APP_DIR/app.env") variabel)"
