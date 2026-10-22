#!/usr/bin/env bash
# Deploy SIIPB di EC2 (dipanggil GitHub Actions lewat SSH, atau manual):
#   /opt/siipb/scripts/deploy.sh <image_tag>      # default: latest
# Alur: ambil secret -> login ECR -> pull semua image (container lama tetap melayani)
#       -> ganti container satu per satu sambil menunggu healthcheck -> rollback bila gagal.
set -euo pipefail
set -a; . /etc/siipb/siipb.conf; set +a
export IMAGE_TAG="${1:-latest}"
cd "$APP_DIR"

COMPOSE=(docker compose -f docker-compose.prod.yml)
PREV_TAG=$(cat .deployed_tag 2>/dev/null || true)

log() { echo "[$(date -Is)] $*" | tee -a /var/log/siipb-deploy.log; }

wait_healthy() {
  local svc=$1 id status
  for _ in $(seq 1 60); do
    id=$("${COMPOSE[@]}" ps -q "$svc")
    status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || echo starting)
    [ "$status" = "healthy" ] && return 0
    sleep 3
  done
  return 1
}

rollback() {
  log "GAGAL: $1"
  if [ -n "$PREV_TAG" ] && [ "$PREV_TAG" != "$IMAGE_TAG" ]; then
    log "Rollback ke image $PREV_TAG (catatan: migrasi DB yang sudah jalan tidak dibatalkan)"
    IMAGE_TAG="$PREV_TAG" "${COMPOSE[@]}" up -d --no-deps backend frontend celery_worker celery_beat
  fi
  exit 1
}

install_nginx_conf() {
  local src=nginx/siipb.http.conf
  sudo test -d "/etc/letsencrypt/live/$APP_DOMAIN" && src=nginx/siipb.https.conf
  sudo install -m 644 nginx/snippets/siipb-locations.conf /etc/nginx/snippets/siipb-locations.conf
  sed "s/__DOMAIN__/$APP_DOMAIN/g" "$src" | sudo tee /etc/nginx/sites-available/siipb.conf >/dev/null
  sudo nginx -t && sudo systemctl reload nginx
  log "Nginx: $src"
}

log "=== Deploy SIIPB tag=$IMAGE_TAG (sebelumnya: ${PREV_TAG:-none})"
"$APP_DIR/scripts/fetch-secrets.sh"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"

log "Pull image"
"${COMPOSE[@]}" pull

"${COMPOSE[@]}" up -d redis
wait_healthy redis || rollback "redis tidak sehat"

# backend dulu: entrypoint menjalankan alembic upgrade head sebelum Gunicorn melayani
log "Update backend"
"${COMPOSE[@]}" up -d --no-deps backend
wait_healthy backend || rollback "backend tidak sehat"

log "Update frontend"
"${COMPOSE[@]}" up -d --no-deps frontend
wait_healthy frontend || rollback "frontend tidak sehat"

log "Update worker & beat"
"${COMPOSE[@]}" up -d --no-deps celery_worker celery_beat
wait_healthy celery_worker || rollback "celery worker tidak sehat"

install_nginx_conf

curl -fsS http://127.0.0.1:5000/api/health >/dev/null || rollback "health check API gagal"
echo "$IMAGE_TAG" > .deployed_tag
docker image prune -f >/dev/null
log "=== Deploy selesai: $IMAGE_TAG"
"${COMPOSE[@]}" ps
