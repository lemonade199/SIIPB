output "ec2_public_ip" {
  description = "Elastic IP EC2 — arahkan record A domain ke IP ini."
  value       = module.compute.public_ip
}

output "ec2_instance_id" {
  value = module.compute.instance_id
}

output "ssh_command" {
  value = "ssh ubuntu@${module.compute.public_ip}"
}

output "app_url" {
  value = "https://${var.domain_name}"
}

output "dns_record" {
  description = "Record DNS yang harus ada (dibuat otomatis bila route53_zone_id diisi)."
  value       = module.dns.created ? "Route 53: ${var.domain_name} A ${module.compute.public_ip} (otomatis)" : "BUAT MANUAL di pengelola DNS: ${var.domain_name}  A  ${module.compute.public_ip}  TTL 300"
}

output "rds_endpoint" {
  description = "Endpoint RDS (hanya dapat diakses dari dalam VPC)."
  value       = module.database.address
}

output "rds_identifier" {
  value = module.database.identifier
}

output "s3_bucket" {
  value = module.storage.bucket_name
}

output "ecr_registry" {
  value = module.ecr.registry
}

output "ecr_repository_urls" {
  value = module.ecr.repository_urls
}

output "app_secret_name" {
  description = "Nama secret aplikasi di AWS Secrets Manager."
  value       = module.secrets.secret_name
}

output "github_actions_role_arn" {
  description = "Isi ke GitHub secret AWS_DEPLOY_ROLE_ARN."
  value       = module.iam.github_actions_role_arn
}

output "ec2_security_group_id" {
  description = "Isi ke GitHub variable EC2_SECURITY_GROUP_ID."
  value       = module.security.ec2_security_group_id
}

output "sns_alarm_topic_arn" {
  value = module.monitoring.sns_topic_arn
}

output "github_settings" {
  description = "Ringkasan nilai yang perlu diisi di GitHub > Settings > Secrets and variables > Actions."
  value = {
    "secret AWS_DEPLOY_ROLE_ARN"     = module.iam.github_actions_role_arn
    "secret EC2_SSH_PRIVATE_KEY"     = "<isi private key pasangan ssh_public_key>"
    "variable AWS_REGION"            = var.aws_region
    "variable EC2_HOST"              = module.compute.public_ip
    "variable EC2_SECURITY_GROUP_ID" = module.security.ec2_security_group_id
    "variable APP_DOMAIN"            = var.domain_name
    "variable INSTITUTION_NAME"      = var.institution_name
  }
}
