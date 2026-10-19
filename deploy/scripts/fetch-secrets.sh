#!/usr/bin/env bash
# Ambil environment aplikasi dari AWS Secrets Manager -> /opt/siipb/app.env (chmod 600).
# Dipakai docker-compose.prod.yml sebagai env_file; kredensial tidak pernah disimpan di Git/GitHub.
#
# Secret (dibuat stack CloudFormation 02-data, prefix SECRET_PREFIX mis. siipb/production):
#   <prefix>/db          {username,password,host,port,dbname,...}  (dibangkitkan AWS + attachment RDS)
#   <prefix>/secret-key  string acak  -> SECRET_KEY
#   <prefix>/jwt         string acak  -> JWT_SECRET_KEY
#   <prefix>/app-config  JSON SMTP_*, GOOGLE_*, SEED_ADMIN_PASSWORD, JWT TTL
set -euo pipefail
set -a; . /etc/siipb/siipb.conf; set +a

get() {
  aws secretsmanager get-secret-value --region "$AWS_REGION" --secret-id "$SECRET_PREFIX/$1" \
    --query SecretString --output text
}

db=$(get db)
cfg=$(get app-config)
secret_key=$(get secret-key)
jwt=$(get jwt)

json=$(jq -n \
  --argjson db "$db" --argjson cfg "$cfg" \
  --arg sk "$secret_key" --arg jwt "$jwt" \
  --arg domain "$APP_DOMAIN" --arg bucket "$S3_BUCKET" --arg region "$AWS_REGION" '
  $cfg + {
    APP_ENV: "production",
    APP_DEBUG: "false",
    DB_HOST: $db.host,
    DB_PORT: ($db.port | tostring),
    DB_NAME: $db.dbname,
    DB_USER: $db.username,
    DB_PASSWORD: $db.password,
    DATABASE_URL: "mariadb+pymysql://\($db.username):\($db.password)@\($db.host):\($db.port)/\($db.dbname)?charset=utf8mb4",
    SECRET_KEY: $sk,
    JWT_SECRET_KEY: $jwt,
    S3_BUCKET: $bucket,
    S3_REGION: $region,
    PUBLIC_URL: "https://\($domain)",
    CORS_ORIGINS: "https://\($domain)",
    FRONTEND_URL: "https://\($domain)",
    TZ: "Asia/Jakarta"
  }')

if [ "$(jq -r '.DB_HOST // ""' <<<"$json")" = "" ]; then
  echo "Secret $SECRET_PREFIX/db belum berisi host RDS (SecretTargetAttachment belum selesai?)." >&2
  exit 1
fi

# env_file Compose: nilai dalam kutip tunggal dibaca literal (tanpa interpolasi $).
if ! jq -e --arg q "'" '[.[] | tostring | contains($q)] | any | not' >/dev/null <<<"$json"; then
  echo "Salah satu secret berisi tanda kutip tunggal (') — ganti nilainya." >&2
  exit 1
fi

umask 077
tmp=$(mktemp "$APP_DIR/.app.env.XXXXXX")
jq -r --arg q "'" 'to_entries[] | "\(.key)=\($q)\(.value | tostring)\($q)"' <<<"$json" > "$tmp"
mv "$tmp" "$APP_DIR/app.env"
echo "app.env diperbarui dari $SECRET_PREFIX/* ($(wc -l < "$APP_DIR/app.env") variabel)"
