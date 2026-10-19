# ---------------------------------------------------------------- umum
variable "project" {
  description = "Nama proyek (prefix semua resource)."
  type        = string
  default     = "siipb"
}

variable "environment" {
  description = "Nama lingkungan."
  type        = string
  default     = "production"
}

variable "aws_region" {
  description = "Region AWS utama (ap-southeast-1 = Singapura; ap-southeast-3 = Jakarta, perlu opt-in)."
  type        = string
  default     = "ap-southeast-1"
}

# ---------------------------------------------------------------- jaringan
variable "vpc_cidr" {
  description = "CIDR VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "admin_cidrs" {
  description = "IP admin yang boleh SSH (port 22), format CIDR, mis. [\"203.0.113.10/32\"]. Cek: curl https://checkip.amazonaws.com"
  type        = list(string)

  validation {
    condition     = length(var.admin_cidrs) > 0 && alltrue([for c in var.admin_cidrs : can(cidrhost(c, 0)) && c != "0.0.0.0/0"])
    error_message = "admin_cidrs wajib diisi CIDR valid dan tidak boleh 0.0.0.0/0."
  }
}

variable "web_ingress_cidrs" {
  description = "Sumber yang boleh mengakses HTTP/HTTPS (80/443). Bawaan publik; Let's Encrypt HTTP-01 butuh port 80 terbuka. Isi IP Anda bila aplikasi hanya untuk internal/UAT."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "smtp_ports" {
  description = "Port SMTP keluar (egress) yang dibuka untuk pengiriman email."
  type        = list(number)
  default     = [25, 465, 587]
}

# ---------------------------------------------------------------- EC2
variable "instance_type" {
  description = "Tipe instans EC2 (Next.js + Gunicorn + Celery + Redis). Minimal t3.small."
  type        = string
  default     = "t3.small"
}

variable "root_volume_size" {
  description = "Ukuran disk root EC2 (GiB)."
  type        = number
  default     = 30
}

variable "ssh_public_key" {
  description = "Isi public key SSH (ssh-ed25519 AAAA... / ssh-rsa AAAA...) untuk user ubuntu."
  type        = string
}

# ---------------------------------------------------------------- domain
variable "domain_name" {
  description = "Subdomain aplikasi."
  type        = string
  default     = "siipb.averus.my.id"
}

variable "route53_zone_id" {
  description = "Hosted zone Route 53 untuk domain. Kosongkan bila DNS dikelola di luar AWS (record A dibuat manual)."
  type        = string
  default     = ""
}

variable "letsencrypt_email" {
  description = "Email untuk registrasi Let's Encrypt (notifikasi kedaluwarsa sertifikat)."
  type        = string
}

# ---------------------------------------------------------------- RDS
variable "db_name" {
  type    = string
  default = "siipb"
}

variable "db_username" {
  type    = string
  default = "siipb"
}

variable "db_engine_version" {
  description = "Versi MariaDB di RDS (prefix major.minor; minor dipilih otomatis)."
  type        = string
  default     = "11.4"
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "db_max_allocated_storage" {
  description = "Batas autoscaling storage RDS (GiB)."
  type        = number
  default     = 100
}

variable "db_multi_az" {
  type    = bool
  default = false
}

variable "db_backup_retention_days" {
  description = "Retensi automated backup harian RDS (hari, 1-35)."
  type        = number
  default     = 7
}

variable "db_backup_window" {
  description = "Jendela backup harian (UTC). 17:00-17:30 UTC = 00:00-00:30 WIB."
  type        = string
  default     = "17:00-17:30"
}

variable "db_maintenance_window" {
  description = "Jendela maintenance mingguan (UTC). Tidak boleh tumpang tindih dengan backup window."
  type        = string
  default     = "sun:18:00-sun:19:00"
}

variable "db_deletion_protection" {
  type    = bool
  default = true
}

variable "db_skip_final_snapshot" {
  type    = bool
  default = false
}

# ---------------------------------------------------------------- S3
variable "s3_force_destroy" {
  description = "Izinkan terraform destroy menghapus bucket yang masih berisi objek."
  type        = bool
  default     = false
}

variable "s3_backup_retention_days" {
  description = "Umur berkas di prefix backups/ sebelum dihapus otomatis."
  type        = number
  default     = 90
}

# ---------------------------------------------------------------- aplikasi (disimpan di Secrets Manager)
variable "institution_name" {
  type    = string
  default = "Instansi Contoh"
}

variable "seed_admin_password" {
  description = "Kata sandi awal akun admin (WAJIB diganti setelah login pertama)."
  type        = string
  sensitive   = true
}

variable "smtp_host" {
  type    = string
  default = "smtp.gmail.com"
}

variable "smtp_port" {
  type    = number
  default = 587
}

variable "smtp_username" {
  type    = string
  default = ""
}

variable "smtp_password" {
  description = "Kosongkan untuk mode simulasi. Sebaiknya diberikan lewat TF_VAR_smtp_password, bukan file."
  type        = string
  default     = ""
  sensitive   = true
}

variable "smtp_sender_email" {
  type    = string
  default = "no-reply@averus.my.id"
}

variable "smtp_sender_name" {
  type    = string
  default = "SIIPB Sarpras IT"
}

variable "google_client_id" {
  type    = string
  default = ""
}

variable "google_client_secret" {
  type      = string
  default   = ""
  sensitive = true
}

variable "secret_recovery_window_days" {
  description = "Masa tunggu sebelum secret benar-benar terhapus (0 = langsung, 7-30)."
  type        = number
  default     = 7
}

# ---------------------------------------------------------------- CI/CD
variable "github_repository" {
  description = "Repository GitHub (owner/name) yang boleh deploy via OIDC."
  type        = string
  default     = "lemonade199/SIIPB"
}

variable "github_branch" {
  type    = string
  default = "main"
}

variable "create_github_oidc_provider" {
  description = "false bila OIDC provider token.actions.githubusercontent.com sudah ada di akun AWS (hanya boleh satu per akun)."
  type        = bool
  default     = true
}

# ---------------------------------------------------------------- monitoring
variable "alarm_email" {
  description = "Email penerima notifikasi CloudWatch Alarm & billing (konfirmasi langganan SNS lewat email)."
  type        = string
}

variable "cpu_alarm_threshold" {
  type    = number
  default = 80
}

variable "memory_alarm_threshold" {
  type    = number
  default = 85
}

variable "disk_alarm_threshold" {
  type    = number
  default = 85
}

variable "billing_alarm_threshold_usd" {
  description = "Ambang estimasi tagihan bulanan (USD) untuk billing alert."
  type        = number
  default     = 50
}

variable "log_retention_days" {
  type    = number
  default = 30
}
