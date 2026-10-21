#!/usr/bin/env bash
# Deploy seluruh infrastruktur SIIPB dengan AWS CloudFormation (urut sesuai dependensi).
#
#   cd infrastructure/cloudformation
#   cp params.env.example params.env        # lalu sesuaikan
#   export SEED_ADMIN_PASSWORD='...'        # wajib saat pertama kali
#   ./deploy-stacks.sh                      # semua stack
#   ./deploy-stacks.sh network|data|app|billing|outputs   # satu stack / tampilkan output
#   ./deploy-stacks.sh release              # build image di laptop -> ECR -> deploy ke EC2 (tanpa GitHub Actions)
#
# Stack: <project>-<env>-network -> -data -> -app (region utama).
# Billing alert (-billing, us-east-1) TIDAK termasuk "all" (tidak tersedia di AWS Academy);
# jalankan terpisah dengan "./deploy-stacks.sh billing" pada akun AWS biasa.
# Butuh: AWS CLI v2 dengan kredensial administrator. Aman dijalankan ulang (idempoten).
set -euo pipefail
cd "$(dirname "$0")"

[ -f params.env ] || { echo "params.env belum ada: cp params.env.example params.env" >&2; exit 1; }
set -a; . ./params.env; set +a

P="${PROJECT}-${ENVIRONMENT}"
NETWORK_STACK="$P-network"
DATA_STACK="$P-data"
APP_STACK="$P-app"
BILLING_STACK="$P-billing"
TAGS=("Project=$PROJECT" "Environment=$ENVIRONMENT" "ManagedBy=cloudformation")
STEP="${1:-all}"

stack_exists() {
  aws cloudformation describe-stacks --region "$2" --stack-name "$1" >/dev/null 2>&1
}

deploy() { # deploy <stack> <template> <region> [extra aws args...] -- <param overrides...>
  local stack=$1 template=$2 region=$3; shift 3
  local extra=() params=()
  while [ $# -gt 0 ] && [ "$1" != "--" ]; do extra+=("$1"); shift; done
  [ "${1:-}" = "--" ] && shift
  params=("$@")
  echo "=== $stack ($region) <- $template"
  aws cloudformation deploy --region "$region" \
    --stack-name "$stack" --template-file "$template" \
    --no-fail-on-empty-changeset --tags "${TAGS[@]}" \
    "${extra[@]}" --parameter-overrides "${params[@]}"
}

outputs() {
  aws cloudformation describe-stacks --region "$2" --stack-name "$1" \
    --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" --output table
}

out() {
  aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$1" \
    --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue" --output text
}

deploy_network() {
  deploy "$NETWORK_STACK" templates/01-network.yaml "$AWS_REGION" -- \
    "ProjectName=$PROJECT" "EnvironmentName=$ENVIRONMENT" \
    "AdminCidr=$ADMIN_CIDR" "WebIngressCidr=${WEB_INGRESS_CIDR:-0.0.0.0/0}"
}

deploy_data() {
  local params=(
    "ProjectName=$PROJECT" "EnvironmentName=$ENVIRONMENT" "NetworkStackName=$NETWORK_STACK"
    "DbInstanceClass=$DB_INSTANCE_CLASS" "DbEngineVersion=$DB_ENGINE_VERSION"
    "DbAllocatedStorage=$DB_ALLOCATED_STORAGE" "DbBackupRetentionDays=$DB_BACKUP_RETENTION_DAYS"
    "DbMultiAz=$DB_MULTI_AZ" "DbDeletionProtection=$DB_DELETION_PROTECTION"
    "SmtpHost=$SMTP_HOST" "SmtpPort=$SMTP_PORT" "SmtpSenderEmail=$SMTP_SENDER_EMAIL" "SmtpSenderName=$SMTP_SENDER_NAME"
  )
  # nilai opsional/rahasia hanya dikirim bila diisi; bila tidak, stack yang sudah ada memakai nilai sebelumnya
  [ -n "${SMTP_USERNAME:-}" ] && params+=("SmtpUsername=$SMTP_USERNAME")
  [ -n "${GOOGLE_CLIENT_ID:-}" ] && params+=("GoogleClientId=$GOOGLE_CLIENT_ID")
  [ -n "${SMTP_PASSWORD:-}" ] && params+=("SmtpPassword=$SMTP_PASSWORD")
  [ -n "${GOOGLE_CLIENT_SECRET:-}" ] && params+=("GoogleClientSecret=$GOOGLE_CLIENT_SECRET")
  if [ -n "${SEED_ADMIN_PASSWORD:-}" ]; then
    params+=("SeedAdminPassword=$SEED_ADMIN_PASSWORD")
  elif ! stack_exists "$DATA_STACK" "$AWS_REGION"; then
    echo "SEED_ADMIN_PASSWORD wajib diisi saat stack data pertama kali dibuat: export SEED_ADMIN_PASSWORD='...'" >&2
    exit 1
  fi
  echo "(RDS butuh ±10-15 menit saat pertama kali dibuat)"
  deploy "$DATA_STACK" templates/02-data.yaml "$AWS_REGION" --capabilities CAPABILITY_AUTO_EXPAND -- "${params[@]}"
}

deploy_app() {
  local key_file="${SSH_PUBLIC_KEY_FILE/#\~/$HOME}"
  [ -f "$key_file" ] || { echo "Public key tidak ditemukan: $key_file (ssh-keygen -t ed25519 -f ~/.ssh/siipb_deploy)" >&2; exit 1; }
  echo "(stack menunggu sinyal bootstrap user_data EC2, ±5-10 menit)"
  # CAPABILITY_NAMED_IAM hanya bila template membuat IAM (tidak pada AWS Academy)
  local caps=(--capabilities CAPABILITY_AUTO_EXPAND)
  if [ -z "${EC2_INSTANCE_PROFILE:-}" ] || [ "${CREATE_GITHUB_DEPLOY_ROLE:-true}" = "true" ]; then
    caps=(--capabilities CAPABILITY_NAMED_IAM)
  fi
  deploy "$APP_STACK" templates/03-app.yaml "$AWS_REGION" "${caps[@]}" -- \
    "ProjectName=$PROJECT" "EnvironmentName=$ENVIRONMENT" \
    "NetworkStackName=$NETWORK_STACK" "DataStackName=$DATA_STACK" \
    "InstanceType=$INSTANCE_TYPE" "RootVolumeSize=$ROOT_VOLUME_SIZE" \
    "SshPublicKey=$(tr -d '\r\n' < "$key_file")" \
    "DomainName=$DOMAIN_NAME" "HostedZoneId=${HOSTED_ZONE_ID:-}" "LetsEncryptEmail=$LETSENCRYPT_EMAIL" \
    "GitHubRepository=$GITHUB_REPOSITORY" "GitHubBranch=$GITHUB_BRANCH" \
    "Ec2InstanceProfileName=${EC2_INSTANCE_PROFILE:-}" \
    "CreateGitHubDeployRole=${CREATE_GITHUB_DEPLOY_ROLE:-true}" \
    "CreateGitHubOidcProvider=${CREATE_GITHUB_OIDC_PROVIDER:-true}" "AlarmEmail=$ALARM_EMAIL"
}

deploy_billing() {
  deploy "$BILLING_STACK" templates/04-billing.yaml us-east-1 -- \
    "ProjectName=$PROJECT" "EnvironmentName=$ENVIRONMENT" \
    "AlarmEmail=$ALARM_EMAIL" "BillingThresholdUsd=$BILLING_THRESHOLD_USD"
}

# Build image di laptop -> push ke ECR -> salin deploy/ ke EC2 -> jalankan deploy.sh (tanpa GitHub Actions).
# Cocok untuk AWS Academy: cukup kredensial lab di ~/.aws/credentials + Docker + kunci SSH deploy.
release() {
  local registry ip key tag ssh_cmd
  registry=$(out "$DATA_STACK" EcrRegistry)
  ip=$(out "$APP_STACK" PublicIp)
  key="${SSH_PUBLIC_KEY_FILE/#\~/$HOME}"; key="${key%.pub}"
  [ -n "$registry" ] && [ -n "$ip" ] || { echo "Stack data/app belum ada: jalankan ./deploy-stacks.sh dulu" >&2; exit 1; }
  [ -f "$key" ] || { echo "Private key tidak ditemukan: $key" >&2; exit 1; }
  tag=$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)
  # Git Bash: pakai path Windows (D:/SIIPB) karena docker.exe tidak mengenal /d/SIIPB
  local root; root=$(cd ../.. && { pwd -W 2>/dev/null || pwd; })

  echo "=== Login ECR $registry"
  aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$registry"

  build_push() { # build_push <image> <context> <dockerfile> [build args...]
    local image=$1 ctx=$2 file=$3; shift 3
    echo "=== Build & push siipb-$image:$tag"
    # Git Bash (Windows) mengubah argumen mirip path (/api/v1 -> C:/Program Files/Git/api/v1); matikan konversi itu.
    MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*" docker build --platform linux/amd64 -f "$root/$file" "$@" \
      -t "$registry/siipb-$image:$tag" -t "$registry/siipb-$image:latest" "$root/$ctx"
    docker push "$registry/siipb-$image:$tag"
    docker push "$registry/siipb-$image:latest"
  }
  build_push backend backend backend/Dockerfile
  build_push worker backend backend/Dockerfile.worker
  build_push frontend frontend frontend/Dockerfile \
    --build-arg NEXT_PUBLIC_DATA_SOURCE=api --build-arg NEXT_PUBLIC_API_BASE_URL=/api/v1 \
    --build-arg "NEXT_PUBLIC_INSTITUTION=$INSTITUTION_NAME" --build-arg NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=false

  ssh_cmd=(ssh -i "$key" -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 "ubuntu@$ip")
  echo "=== Salin deploy/ ke EC2 $ip"
  tar czf - -C "$root/deploy" . | "${ssh_cmd[@]}" 'tar xzf - -C /opt/siipb && chmod +x /opt/siipb/scripts/*.sh'
  echo "=== Deploy tag $tag di EC2"
  "${ssh_cmd[@]}" "/opt/siipb/scripts/deploy.sh $tag"
  curl -fsS --retry 5 --retry-delay 5 "http://$ip/api/health" && echo && echo "Selesai: http://$ip"
}

show_outputs() {
  outputs "$NETWORK_STACK" "$AWS_REGION"
  outputs "$DATA_STACK" "$AWS_REGION"
  outputs "$APP_STACK" "$AWS_REGION"
  cat <<EOF

================ Isi di GitHub > Settings > Secrets and variables > Actions ================
$(if [ "${CREATE_GITHUB_DEPLOY_ROLE:-true}" = "true" ]; then
  echo "secret   AWS_DEPLOY_ROLE_ARN    = $(out "$APP_STACK" GitHubActionsRoleArn)"
else
  echo "secret   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN = dari 'AWS Details' lab (perbarui tiap sesi)"
fi)
secret   EC2_SSH_PRIVATE_KEY    = <isi berkas private key ${SSH_PUBLIC_KEY_FILE%.pub}>
variable AWS_REGION             = $AWS_REGION
variable EC2_HOST               = $(out "$APP_STACK" PublicIp)
variable EC2_SECURITY_GROUP_ID  = $(out "$NETWORK_STACK" Ec2SecurityGroupId)
variable APP_DOMAIN             = $DOMAIN_NAME
variable INSTITUTION_NAME       = $INSTITUTION_NAME

DNS: $(out "$APP_STACK" DnsRecord)
EOF
}

case "$STEP" in
  all)     deploy_network; deploy_data; deploy_app; show_outputs ;;
  network) deploy_network ;;
  data)    deploy_data ;;
  app)     deploy_app ;;
  billing) deploy_billing ;;
  outputs) show_outputs ;;
  release) release ;;
  *) echo "Pemakaian: $0 [all|network|data|app|billing|outputs|release]" >&2; exit 1 ;;
esac
