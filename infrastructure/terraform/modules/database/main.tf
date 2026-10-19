# RDS MariaDB di private subnet, tidak dapat diakses publik.
# Automated backup harian (backup_window) dengan retensi backup_retention_period hari + point-in-time restore.

variable "name" { type = string }
variable "subnet_ids" { type = list(string) }
variable "security_group_id" { type = string }
variable "db_name" { type = string }
variable "username" { type = string }
variable "engine_version" { type = string }
variable "instance_class" { type = string }
variable "allocated_storage" { type = number }
variable "max_allocated_storage" { type = number }
variable "multi_az" { type = bool }
variable "backup_retention_period" { type = number }
variable "backup_window" { type = string }
variable "maintenance_window" { type = string }
variable "deletion_protection" { type = bool }
variable "skip_final_snapshot" { type = bool }

variable "password" {
  type      = string
  sensitive = true
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.name}-db-subnets"
  subnet_ids = var.subnet_ids
  tags       = { Name = "${var.name}-db-subnets" }
}

resource "aws_db_parameter_group" "this" {
  name_prefix = "${var.name}-mariadb-"
  family      = "mariadb${join(".", slice(split(".", var.engine_version), 0, 2))}"
  description = "SIIPB MariaDB (utf8mb4, WIB)"

  parameter {
    name  = "character_set_server"
    value = "utf8mb4"
  }
  parameter {
    name  = "collation_server"
    value = "utf8mb4_unicode_ci"
  }
  parameter {
    name  = "time_zone"
    value = "Asia/Jakarta"
  }
  parameter {
    name  = "slow_query_log"
    value = "1"
  }
  parameter {
    name  = "long_query_time"
    value = "2"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_db_instance" "this" {
  identifier     = "${var.name}-mariadb"
  engine         = "mariadb"
  engine_version = var.engine_version
  instance_class = var.instance_class

  db_name  = var.db_name
  username = var.username
  password = var.password
  port     = 3306

  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [var.security_group_id]
  parameter_group_name   = aws_db_parameter_group.this.name
  publicly_accessible    = false
  multi_az               = var.multi_az

  # ---- Automated Backups (harian) ----
  backup_retention_period  = var.backup_retention_period
  backup_window            = var.backup_window
  maintenance_window       = var.maintenance_window
  copy_tags_to_snapshot    = true
  delete_automated_backups = false

  auto_minor_version_upgrade      = true
  enabled_cloudwatch_logs_exports = ["error", "slowquery"]
  deletion_protection             = var.deletion_protection
  skip_final_snapshot             = var.skip_final_snapshot
  final_snapshot_identifier       = "${var.name}-mariadb-final"
  apply_immediately               = false

  tags = { Name = "${var.name}-mariadb" }

  lifecycle {
    # minor version di-upgrade otomatis oleh AWS; jangan dianggap drift.
    ignore_changes = [engine_version]
  }
}

output "address" { value = aws_db_instance.this.address }
output "port" { value = aws_db_instance.this.port }
output "identifier" { value = aws_db_instance.this.identifier }
output "subnet_group_name" { value = aws_db_subnet_group.this.name }
