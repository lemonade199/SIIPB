# Security group EC2 & RDS.
#  EC2 inbound : 22 hanya dari IP admin; 80/443 dari web_ingress_cidrs.
#  EC2 outbound: 80/443 (apt, ECR, API AWS), SMTP (25/465/587), DNS, NTP, 3306 hanya ke SG RDS.
#  RDS inbound : 3306 hanya dari SG EC2. Tanpa aturan lain.

variable "name" { type = string }
variable "vpc_id" { type = string }
variable "admin_cidrs" { type = list(string) }
variable "web_ingress_cidrs" { type = list(string) }
variable "smtp_ports" { type = list(number) }

resource "aws_security_group" "ec2" {
  name        = "${var.name}-ec2-sg"
  description = "SIIPB web server (Nginx + containers)"
  vpc_id      = var.vpc_id
  tags        = { Name = "${var.name}-ec2-sg" }

  # Aturan 22 sementara ditambah/dihapus oleh GitHub Actions saat deploy.
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group" "rds" {
  name        = "${var.name}-rds-sg"
  description = "SIIPB RDS MariaDB - hanya dari EC2"
  vpc_id      = var.vpc_id
  tags        = { Name = "${var.name}-rds-sg" }
}

# ---------------- EC2 inbound
resource "aws_vpc_security_group_ingress_rule" "ssh" {
  for_each          = toset(var.admin_cidrs)
  security_group_id = aws_security_group.ec2.id
  description       = "SSH admin"
  ip_protocol       = "tcp"
  from_port         = 22
  to_port           = 22
  cidr_ipv4         = each.value
}

resource "aws_vpc_security_group_ingress_rule" "http" {
  for_each          = toset(var.web_ingress_cidrs)
  security_group_id = aws_security_group.ec2.id
  description       = "HTTP (redirect ke HTTPS + ACME challenge)"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  cidr_ipv4         = each.value
}

resource "aws_vpc_security_group_ingress_rule" "https" {
  for_each          = toset(var.web_ingress_cidrs)
  security_group_id = aws_security_group.ec2.id
  description       = "HTTPS"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = each.value
}

# ---------------- EC2 outbound
locals {
  egress_tcp = merge(
    { http = 80, https = 443 },
    { for p in var.smtp_ports : "smtp-${p}" => p },
  )
}

resource "aws_vpc_security_group_egress_rule" "tcp" {
  for_each          = local.egress_tcp
  security_group_id = aws_security_group.ec2.id
  description       = "Outbound ${each.key}"
  ip_protocol       = "tcp"
  from_port         = each.value
  to_port           = each.value
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "dns_udp" {
  security_group_id = aws_security_group.ec2.id
  description       = "DNS"
  ip_protocol       = "udp"
  from_port         = 53
  to_port           = 53
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "dns_tcp" {
  security_group_id = aws_security_group.ec2.id
  description       = "DNS (TCP)"
  ip_protocol       = "tcp"
  from_port         = 53
  to_port           = 53
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "ntp" {
  security_group_id = aws_security_group.ec2.id
  description       = "NTP"
  ip_protocol       = "udp"
  from_port         = 123
  to_port           = 123
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "to_rds" {
  security_group_id            = aws_security_group.ec2.id
  description                  = "MariaDB ke RDS"
  ip_protocol                  = "tcp"
  from_port                    = 3306
  to_port                      = 3306
  referenced_security_group_id = aws_security_group.rds.id
}

# ---------------- RDS inbound
resource "aws_vpc_security_group_ingress_rule" "rds_from_ec2" {
  security_group_id            = aws_security_group.rds.id
  description                  = "MariaDB dari EC2"
  ip_protocol                  = "tcp"
  from_port                    = 3306
  to_port                      = 3306
  referenced_security_group_id = aws_security_group.ec2.id
}

output "ec2_security_group_id" { value = aws_security_group.ec2.id }
output "rds_security_group_id" { value = aws_security_group.rds.id }
