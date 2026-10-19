# Record A subdomain -> Elastic IP EC2 (hanya bila DNS domain dikelola di Route 53).
# Bila DNS di luar AWS (mis. panel registrar averus.my.id), buat record A manual sesuai output dns_record.

variable "create" { type = bool }
variable "zone_id" { type = string }
variable "domain_name" { type = string }
variable "public_ip" { type = string }

resource "aws_route53_record" "app" {
  count   = var.create ? 1 : 0
  zone_id = var.zone_id
  name    = var.domain_name
  type    = "A"
  ttl     = 300
  records = [var.public_ip]
}

output "created" { value = var.create }
output "fqdn" { value = var.create ? aws_route53_record.app[0].fqdn : var.domain_name }
