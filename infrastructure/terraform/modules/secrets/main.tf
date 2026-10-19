# AWS Secrets Manager: satu secret JSON berisi seluruh variabel lingkungan sensitif aplikasi.
# EC2 membacanya saat deploy (deploy/scripts/fetch-secrets.sh) lalu menyuntikkannya ke container
# sebagai env_file — tidak ada kredensial mentah di repository maupun di GitHub.

variable "name" { type = string }
variable "recovery_window_in_days" { type = number }

variable "values" {
  type      = map(string)
  sensitive = true
}

resource "aws_secretsmanager_secret" "app" {
  name                    = var.name
  description             = "Environment variables SIIPB (RDS, JWT, SMTP, S3, SSO)"
  recovery_window_in_days = var.recovery_window_in_days
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id     = aws_secretsmanager_secret.app.id
  secret_string = jsonencode(var.values)
}

output "secret_arn" { value = aws_secretsmanager_secret.app.arn }
output "secret_name" { value = aws_secretsmanager_secret.app.name }
