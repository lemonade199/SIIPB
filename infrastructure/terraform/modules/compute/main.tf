# EC2 Ubuntu 24.04 di public subnet + Elastic IP.
# user_data menyiapkan: Docker + Compose, Nginx (reverse proxy host), Certbot, AWS CLI v2,
# CloudWatch Agent (CPU/RAM/disk + log Nginx), cron sinkronisasi uploads/backup ke S3.

variable "name" { type = string }
variable "subnet_id" { type = string }
variable "security_group_id" { type = string }
variable "instance_profile_name" { type = string }
variable "instance_type" { type = string }
variable "root_volume_size" { type = number }
variable "ssh_public_key" { type = string }
variable "aws_region" { type = string }
variable "domain_name" { type = string }
variable "letsencrypt_email" { type = string }
variable "secret_id" { type = string }
variable "ecr_registry" { type = string }
variable "s3_bucket" { type = string }
variable "app_log_group" { type = string }
variable "nginx_log_group" { type = string }
variable "nginx_http_conf" { type = string }
variable "nginx_https_conf" { type = string }
variable "setup_ssl_script" { type = string }
variable "nginx_locations" { type = string }

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_key_pair" "this" {
  key_name   = "${var.name}-key"
  public_key = var.ssh_public_key
}

locals {
  cloudwatch_agent_config = jsonencode({
    agent = {
      metrics_collection_interval = 60
      run_as_user                 = "root"
    }
    metrics = {
      namespace         = "CWAgent"
      append_dimensions = { InstanceId = "$${aws:InstanceId}" }
      # metrik agregat per instans -> dimensi hanya InstanceId (dipakai CloudWatch Alarm)
      aggregation_dimensions = [["InstanceId"]]
      metrics_collected = {
        cpu = {
          measurement = ["cpu_usage_idle", "cpu_usage_user", "cpu_usage_system", "cpu_usage_iowait"]
          totalcpu    = true
        }
        mem  = { measurement = ["mem_used_percent", "mem_available"] }
        swap = { measurement = ["swap_used_percent"] }
        disk = {
          measurement = ["used_percent", "inodes_used"]
          resources   = ["/"]
          drop_device = true
        }
      }
    }
    logs = {
      logs_collected = {
        files = {
          collect_list = [
            { file_path = "/var/log/nginx/access.log", log_group_name = var.nginx_log_group, log_stream_name = "{instance_id}/access" },
            { file_path = "/var/log/nginx/error.log", log_group_name = var.nginx_log_group, log_stream_name = "{instance_id}/error" },
            { file_path = "/var/log/siipb-deploy.log", log_group_name = var.app_log_group, log_stream_name = "{instance_id}/deploy" },
          ]
        }
      }
    }
  })

  # replace(): buang CRLF bila repo di-checkout di Windows
  user_data = replace(templatefile("${path.module}/templates/user_data.sh.tftpl", {
    aws_region          = var.aws_region
    domain_name         = var.domain_name
    letsencrypt_email   = var.letsencrypt_email
    secret_id           = var.secret_id
    ecr_registry        = var.ecr_registry
    s3_bucket           = var.s3_bucket
    app_log_group       = var.app_log_group
    nginx_http_b64      = base64encode(replace(var.nginx_http_conf, "\r\n", "\n"))
    nginx_https_b64     = base64encode(replace(var.nginx_https_conf, "\r\n", "\n"))
    nginx_locations_b64 = base64encode(replace(var.nginx_locations, "\r\n", "\n"))
    setup_ssl_b64       = base64encode(replace(var.setup_ssl_script, "\r\n", "\n"))
    cwagent_b64         = base64encode(local.cloudwatch_agent_config)
  }), "\r\n", "\n")
}

resource "aws_instance" "this" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [var.security_group_id]
  iam_instance_profile   = var.instance_profile_name
  key_name               = aws_key_pair.this.key_name
  user_data              = local.user_data
  monitoring             = false

  metadata_options {
    http_tokens                 = "required" # IMDSv2
    http_endpoint               = "enabled"
    http_put_response_hop_limit = 2
  }

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_size
    encrypted             = true
    delete_on_termination = true
  }

  credit_specification {
    cpu_credits = "standard"
  }

  tags = { Name = "${var.name}-app" }

  lifecycle {
    # AMI baru / perubahan bootstrap tidak boleh mengganti server yang sedang berjalan.
    ignore_changes = [ami, user_data]
  }
}

resource "aws_eip" "this" {
  domain   = "vpc"
  instance = aws_instance.this.id
  tags     = { Name = "${var.name}-eip" }
}

output "instance_id" { value = aws_instance.this.id }
output "public_ip" { value = aws_eip.this.public_ip }
output "private_ip" { value = aws_instance.this.private_ip }
