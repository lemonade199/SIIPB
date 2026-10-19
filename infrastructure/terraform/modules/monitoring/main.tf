# CloudWatch: log group aplikasi & Nginx, topik SNS (email), alarm EC2/RDS, dan billing alert.
# Metrik RAM & disk berasal dari CloudWatch Agent (namespace CWAgent) yang dipasang lewat user_data EC2.

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      configuration_aliases = [aws.us_east_1]
    }
  }
}

variable "name" { type = string }
variable "alarm_email" { type = string }
variable "log_retention_days" { type = number }
variable "instance_id" { type = string }
variable "db_instance_identifier" { type = string }
variable "cpu_alarm_threshold" { type = number }
variable "memory_alarm_threshold" { type = number }
variable "disk_alarm_threshold" { type = number }
variable "billing_alarm_threshold_usd" { type = number }

# ------------------------------------------------------------------ logs
resource "aws_cloudwatch_log_group" "app" {
  name              = "/${var.name}/app"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "nginx" {
  name              = "/${var.name}/nginx"
  retention_in_days = var.log_retention_days
}

# ------------------------------------------------------------------ SNS
resource "aws_sns_topic" "alarms" {
  name = "${var.name}-alarms"
}

resource "aws_sns_topic_subscription" "alarms_email" {
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

locals {
  actions = [aws_sns_topic.alarms.arn]
}

# ------------------------------------------------------------------ EC2
resource "aws_cloudwatch_metric_alarm" "ec2_cpu" {
  alarm_name          = "${var.name}-ec2-cpu-high"
  alarm_description   = "CPU EC2 SIIPB > ${var.cpu_alarm_threshold}% selama 10 menit"
  namespace           = "AWS/EC2"
  metric_name         = "CPUUtilization"
  dimensions          = { InstanceId = var.instance_id }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = var.cpu_alarm_threshold
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = local.actions
  ok_actions          = local.actions
}

resource "aws_cloudwatch_metric_alarm" "ec2_memory" {
  alarm_name          = "${var.name}-ec2-memory-high"
  alarm_description   = "RAM EC2 SIIPB > ${var.memory_alarm_threshold}% (CloudWatch Agent)"
  namespace           = "CWAgent"
  metric_name         = "mem_used_percent"
  dimensions          = { InstanceId = var.instance_id }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = var.memory_alarm_threshold
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = local.actions
  ok_actions          = local.actions
}

resource "aws_cloudwatch_metric_alarm" "ec2_disk" {
  alarm_name          = "${var.name}-ec2-disk-high"
  alarm_description   = "Disk root EC2 SIIPB terpakai > ${var.disk_alarm_threshold}% (CloudWatch Agent)"
  namespace           = "CWAgent"
  metric_name         = "disk_used_percent"
  dimensions          = { InstanceId = var.instance_id }
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 1
  threshold           = var.disk_alarm_threshold
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = local.actions
  ok_actions          = local.actions
}

resource "aws_cloudwatch_metric_alarm" "ec2_status" {
  alarm_name          = "${var.name}-ec2-status-check"
  alarm_description   = "Status check EC2 SIIPB gagal"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed"
  dimensions          = { InstanceId = var.instance_id }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  alarm_actions       = local.actions
  ok_actions          = local.actions
}

# ------------------------------------------------------------------ RDS
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${var.name}-rds-cpu-high"
  alarm_description   = "CPU RDS MariaDB > ${var.cpu_alarm_threshold}%"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  dimensions          = { DBInstanceIdentifier = var.db_instance_identifier }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = var.cpu_alarm_threshold
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = local.actions
  ok_actions          = local.actions
}

resource "aws_cloudwatch_metric_alarm" "rds_storage" {
  alarm_name          = "${var.name}-rds-free-storage-low"
  alarm_description   = "Sisa storage RDS < 2 GiB"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  dimensions          = { DBInstanceIdentifier = var.db_instance_identifier }
  statistic           = "Minimum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 2 * 1024 * 1024 * 1024
  comparison_operator = "LessThanThreshold"
  alarm_actions       = local.actions
  ok_actions          = local.actions
}

resource "aws_cloudwatch_metric_alarm" "rds_memory" {
  alarm_name          = "${var.name}-rds-freeable-memory-low"
  alarm_description   = "Freeable memory RDS < 64 MiB"
  namespace           = "AWS/RDS"
  metric_name         = "FreeableMemory"
  dimensions          = { DBInstanceIdentifier = var.db_instance_identifier }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 64 * 1024 * 1024
  comparison_operator = "LessThanThreshold"
  alarm_actions       = local.actions
  ok_actions          = local.actions
}

# ------------------------------------------------------------------ Billing (us-east-1)
# Prasyarat (sekali, akun root/billing): Billing console > Billing preferences >
# "Receive CloudWatch billing alerts" = aktif. Tanpa itu metrik EstimatedCharges tidak ada.
resource "aws_sns_topic" "billing" {
  provider = aws.us_east_1
  name     = "${var.name}-billing-alarms"
}

resource "aws_sns_topic_subscription" "billing_email" {
  provider  = aws.us_east_1
  topic_arn = aws_sns_topic.billing.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

resource "aws_cloudwatch_metric_alarm" "billing" {
  provider            = aws.us_east_1
  alarm_name          = "${var.name}-billing-estimated-charges"
  alarm_description   = "Estimasi tagihan AWS bulan ini > USD ${var.billing_alarm_threshold_usd}"
  namespace           = "AWS/Billing"
  metric_name         = "EstimatedCharges"
  dimensions          = { Currency = "USD" }
  statistic           = "Maximum"
  period              = 21600
  evaluation_periods  = 1
  threshold           = var.billing_alarm_threshold_usd
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_sns_topic.billing.arn]
}

output "app_log_group_name" { value = aws_cloudwatch_log_group.app.name }
output "nginx_log_group_name" { value = aws_cloudwatch_log_group.nginx.name }
output "sns_topic_arn" { value = aws_sns_topic.alarms.arn }
