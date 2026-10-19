# ==========================================================================
# SIIPB — infrastruktur AWS production
#
#   Internet ──► Elastic IP ──► EC2 Ubuntu (public subnet)
#                                 Nginx (host) ─► 127.0.0.1:3000 Next.js
#                                              └► 127.0.0.1:5000 Flask API
#                                 Celery worker/beat + Redis (container)
#                                 image ditarik dari ECR, .env dari Secrets Manager
#                                    │ 3306 (SG ke SG)
#                                    ▼
#                              RDS MariaDB (private subnet, tanpa akses publik)
#   S3 bucket: foto barang (uploads/) & backup (backups/)
#   CloudWatch: agent (CPU/RAM/disk), alarm → SNS email, billing alert
# ==========================================================================

locals {
  name = "${var.project}-${var.environment}"
  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
  deploy_dir = "${path.root}/../../deploy"
}

data "aws_caller_identity" "current" {}

module "network" {
  source   = "./modules/network"
  name     = local.name
  vpc_cidr = var.vpc_cidr
}

module "security" {
  source            = "./modules/security"
  name              = local.name
  vpc_id            = module.network.vpc_id
  admin_cidrs       = var.admin_cidrs
  web_ingress_cidrs = var.web_ingress_cidrs
  smtp_ports        = var.smtp_ports
}

module "ecr" {
  source       = "./modules/ecr"
  project      = var.project
  repositories = ["backend", "worker", "frontend"]
}

module "storage" {
  source                = "./modules/storage"
  name                  = local.name
  force_destroy         = var.s3_force_destroy
  backup_retention_days = var.s3_backup_retention_days
}

# ---- kredensial yang dibangkitkan (tidak pernah ditulis di repository) ----
# special = false: nilai dipakai di DATABASE_URL & .env sehingga harus aman untuk URL.
resource "random_password" "db" {
  length  = 32
  special = false
}

resource "random_password" "secret_key" {
  length  = 64
  special = false
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

module "database" {
  source                  = "./modules/database"
  name                    = local.name
  subnet_ids              = module.network.private_subnet_ids
  security_group_id       = module.security.rds_security_group_id
  db_name                 = var.db_name
  username                = var.db_username
  password                = random_password.db.result
  engine_version          = var.db_engine_version
  instance_class          = var.db_instance_class
  allocated_storage       = var.db_allocated_storage
  max_allocated_storage   = var.db_max_allocated_storage
  multi_az                = var.db_multi_az
  backup_retention_period = var.db_backup_retention_days
  backup_window           = var.db_backup_window
  maintenance_window      = var.db_maintenance_window
  deletion_protection     = var.db_deletion_protection
  skip_final_snapshot     = var.db_skip_final_snapshot
}

module "secrets" {
  source                  = "./modules/secrets"
  name                    = "${var.project}/${var.environment}/app"
  recovery_window_in_days = var.secret_recovery_window_days

  values = {
    APP_ENV                = "production"
    APP_DEBUG              = "false"
    DB_HOST                = module.database.address
    DB_PORT                = tostring(module.database.port)
    DB_NAME                = var.db_name
    DB_USER                = var.db_username
    DB_PASSWORD            = random_password.db.result
    DATABASE_URL           = "mariadb+pymysql://${var.db_username}:${random_password.db.result}@${module.database.address}:${module.database.port}/${var.db_name}?charset=utf8mb4"
    SECRET_KEY             = random_password.secret_key.result
    JWT_SECRET_KEY         = random_password.jwt_secret.result
    JWT_ACCESS_TTL_MINUTES = "30"
    JWT_REFRESH_TTL_DAYS   = "7"
    SEED_ADMIN_PASSWORD    = var.seed_admin_password
    SMTP_HOST              = var.smtp_host
    SMTP_PORT              = tostring(var.smtp_port)
    SMTP_USERNAME          = var.smtp_username
    SMTP_PASSWORD          = var.smtp_password
    SMTP_USE_TLS           = "true"
    SMTP_SENDER_EMAIL      = var.smtp_sender_email
    SMTP_SENDER_NAME       = var.smtp_sender_name
    GOOGLE_CLIENT_ID       = var.google_client_id
    GOOGLE_CLIENT_SECRET   = var.google_client_secret
    # Akses S3 memakai IAM instance profile (tanpa access key statis).
    S3_BUCKET    = module.storage.bucket_name
    S3_REGION    = var.aws_region
    PUBLIC_URL   = "https://${var.domain_name}"
    CORS_ORIGINS = "https://${var.domain_name}"
    FRONTEND_URL = "https://${var.domain_name}"
    TZ           = "Asia/Jakarta"
  }
}

module "iam" {
  source                      = "./modules/iam"
  name                        = local.name
  aws_region                  = var.aws_region
  account_id                  = data.aws_caller_identity.current.account_id
  ecr_repository_arns         = values(module.ecr.repository_arns)
  secret_arn                  = module.secrets.secret_arn
  bucket_arn                  = module.storage.bucket_arn
  ec2_security_group_id       = module.security.ec2_security_group_id
  github_repository           = var.github_repository
  github_branch               = var.github_branch
  create_github_oidc_provider = var.create_github_oidc_provider
}

module "compute" {
  source                = "./modules/compute"
  name                  = local.name
  subnet_id             = module.network.public_subnet_ids[0]
  security_group_id     = module.security.ec2_security_group_id
  instance_profile_name = module.iam.ec2_instance_profile_name
  instance_type         = var.instance_type
  root_volume_size      = var.root_volume_size
  ssh_public_key        = var.ssh_public_key

  aws_region        = var.aws_region
  domain_name       = var.domain_name
  letsencrypt_email = var.letsencrypt_email
  secret_id         = module.secrets.secret_name
  ecr_registry      = module.ecr.registry
  s3_bucket         = module.storage.bucket_name
  app_log_group     = module.monitoring.app_log_group_name
  nginx_log_group   = module.monitoring.nginx_log_group_name
  nginx_http_conf   = file("${local.deploy_dir}/nginx/siipb.http.conf")
  nginx_https_conf  = file("${local.deploy_dir}/nginx/siipb.https.conf")
  setup_ssl_script  = file("${local.deploy_dir}/scripts/setup-ssl.sh")
  nginx_locations   = file("${local.deploy_dir}/nginx/snippets/siipb-locations.conf")
}

module "dns" {
  source      = "./modules/dns"
  create      = var.route53_zone_id != ""
  zone_id     = var.route53_zone_id
  domain_name = var.domain_name
  public_ip   = module.compute.public_ip
}

module "monitoring" {
  source                 = "./modules/monitoring"
  name                   = local.name
  alarm_email            = var.alarm_email
  log_retention_days     = var.log_retention_days
  instance_id            = module.compute.instance_id
  db_instance_identifier = module.database.identifier

  cpu_alarm_threshold         = var.cpu_alarm_threshold
  memory_alarm_threshold      = var.memory_alarm_threshold
  disk_alarm_threshold        = var.disk_alarm_threshold
  billing_alarm_threshold_usd = var.billing_alarm_threshold_usd

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }
}
