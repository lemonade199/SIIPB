# SIIPB — Panduan DevOps: Terraform, CI/CD, dan Operasional AWS

Dokumen ini menjelaskan cara membangun infrastruktur production SIIPB di AWS secara otomatis
(Infrastructure as Code dengan Terraform), menyiapkan pipeline rilis GitHub Actions, dan
menjalankan pemantauan serta backup.

## Arsitektur

```text
                 Pengguna ── HTTPS ──► siipb.averus.my.id (record A → Elastic IP)
                                              │
 ┌──────────────────────────── VPC 10.20.0.0/16 ─────────────────────────────────────┐
 │  Public subnet                                                                     │
 │  ┌──────────────────────── EC2 Ubuntu 24.04 ──────────────────────────────┐        │
 │  │ Nginx (host, Certbot/Let's Encrypt)                                    │        │
 │  │   /        → 127.0.0.1:3000  container frontend (Next.js)              │        │
 │  │   /api/    → 127.0.0.1:5000  container backend  (Flask + Gunicorn)     │        │
 │  │   /uploads → /opt/siipb/uploads  ── cron sync ──► S3 (uploads/)        │        │
 │  │ container worker + beat (Celery) ─ SMTP 587/465 keluar                 │        │
 │  │ container redis                                                        │        │
 │  │ CloudWatch Agent (CPU, RAM, disk, log Nginx) · log container → awslogs │        │
 │  └───────────────┬────────────────────────────────────────────────────────┘        │
 │                  │ 3306 (hanya SG EC2 → SG RDS)                                     │
 │  Private subnet  ▼ (tanpa rute internet)                                            │
 │  RDS MariaDB 11.4 · terenkripsi · automated backup harian 00.00 WIB · retensi 7 hari│
 └────────────────────────────────────────────────────────────────────────────────────┘
  ECR: siipb-backend, siipb-worker, siipb-frontend      Secrets Manager: siipb/production/app
  S3: siipb-production-files-xxxx (uploads/, backups/)  CloudWatch Alarms → SNS email + billing alert
  GitHub Actions ── OIDC (tanpa access key) ──► ECR push + SSH sementara ke EC2
```

## Peta tugas → berkas

| Tugas | Implementasi |
|---|---|
| **1. Provisioning** VPC, subnet publik/privat | `infrastructure/terraform/modules/network` |
| EC2 Ubuntu di public subnet + Elastic IP | `modules/compute` (+ `templates/user_data.sh.tftpl`) |
| RDS MariaDB di private subnet | `modules/database` (`publicly_accessible = false`) |
| S3 untuk berkas & foto barang | `modules/storage` (privat, terenkripsi, versioning, lifecycle) |
| Security Group 80/443/22 dari IP Anda + SMTP keluar | `modules/security` (`admin_cidrs`, `web_ingress_cidrs`, `smtp_ports`) |
| **2. Containerization** Dockerfile frontend/backend/worker | `frontend/Dockerfile`, `backend/Dockerfile`, `backend/Dockerfile.worker` |
| docker-compose lokal (Redis + MariaDB) | `docker-compose.yml` (+ `docker-compose.dev.yml`) |
| Amazon ECR | `modules/ecr` (scan on push, lifecycle 15 image) |
| **3. Web server & domain** Nginx reverse proxy di EC2 | `deploy/nginx/*` dipasang oleh user_data & `deploy.sh` |
| DNS subdomain → Elastic IP | `modules/dns` (Route 53) atau record A manual (output `dns_record`) |
| Certbot / HTTPS wajib | `deploy/scripts/setup-ssl.sh` + `deploy/nginx/siipb.https.conf` |
| **4. CI/CD** | `.github/workflows/deploy.yml` (pytest → build → push ECR → SSH → deploy) |
| **5. Secrets** | `modules/secrets` (Secrets Manager) → `deploy/scripts/fetch-secrets.sh` → `app.env` → container |
| **6. Monitoring & backup** | `modules/database` (automated backup), `modules/monitoring` (alarm, billing), `infrastructure/scripts/rds_restore_test.sh` |

---

## Tahap 0 — Prasyarat

1. Akun AWS dengan user/role administrator. Jangan pakai akun root untuk pekerjaan harian.
2. Pasang alat di laptop:
   - [Terraform](https://developer.hashicorp.com/terraform/install) ≥ 1.10 (`terraform version`)
   - [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), lalu `aws configure` (atau `aws configure sso`)
   - Git, OpenSSH (`ssh`, `ssh-keygen`), `jq` (untuk skrip uji restore)
3. Aktifkan billing alert (sekali, oleh pemilik akun): **Billing and Cost Management → Billing preferences →
   Alert preferences → Receive CloudWatch billing alerts**. Tanpa langkah ini, metrik `EstimatedCharges` tidak ada.
4. Pastikan Anda bisa mengubah DNS `averus.my.id`, baik di Route 53 maupun di panel registrar.

Cek identitas AWS:

```bash
aws sts get-caller-identity
```

## Tahap 1 — Jalankan aplikasi secara lokal (tim developer)

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Sebelum menjalankan, isi `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `SECRET_KEY`, `JWT_SECRET_KEY`, dan `SEED_ADMIN_PASSWORD` di `.env`.
Setelah itu buka http://localhost (Swagger: http://localhost/api/docs). Ada tujuh container: `mariadb`, `redis`, `backend`,
`celery_worker`, `celery_beat`, `frontend`, dan `nginx`, dan semuanya harus berstatus *healthy*:

```bash
docker compose ps
```

## Tahap 2 — Kunci SSH deploy

```bash
ssh-keygen -t ed25519 -f ~/.ssh/siipb_deploy -C "siipb-deploy" -N ""
```

- `~/.ssh/siipb_deploy.pub` diisi ke `ssh_public_key` di Terraform.
- `~/.ssh/siipb_deploy` (private key) diisi ke GitHub secret `EC2_SSH_PRIVATE_KEY`. Jangan di-commit.

## Tahap 3 — Bootstrap Terraform state (sekali saja)

State Terraform menyimpan password RDS dan secret aplikasi, jadi state disimpan di bucket S3 yang terenkripsi, bukan di laptop.

```bash
cd infrastructure/terraform/bootstrap
terraform init
terraform apply -var="aws_region=ap-southeast-1"
terraform output -raw backend_hcl > ../backend.hcl
cd ..
```

## Tahap 4 — Isi variabel

```bash
cp terraform.tfvars.example terraform.tfvars
```

Sunting `terraform.tfvars`:

| Variabel | Isi |
|---|---|
| `admin_cidrs` | IP publik Anda + `/32` (cek: `curl https://checkip.amazonaws.com`) |
| `ssh_public_key` | isi `~/.ssh/siipb_deploy.pub` |
| `domain_name` | `siipb.averus.my.id` |
| `route53_zone_id` | ID hosted zone bila DNS di Route 53; kosongkan bila DNS di registrar |
| `letsencrypt_email`, `alarm_email` | email aktif |
| `smtp_*` | kredensial SMTP (mis. Gmail App Password) |

Berikan nilai rahasia lewat variabel lingkungan supaya tidak tersimpan di berkas.

Bash:

```bash
export TF_VAR_seed_admin_password='GantiDenganSandiKuat!2026'
export TF_VAR_smtp_password='app-password-smtp'
```

PowerShell:

```powershell
$env:TF_VAR_seed_admin_password = 'GantiDenganSandiKuat!2026'
$env:TF_VAR_smtp_password = 'app-password-smtp'
```

> Nilai secret **tidak boleh** mengandung tanda kutip tunggal (`'`).
> Password RDS, `SECRET_KEY`, dan `JWT_SECRET_KEY` dibangkitkan otomatis oleh Terraform (`random_password`).

## Tahap 5 — Provisioning infrastruktur

```bash
terraform init -backend-config=backend.hcl
terraform plan -out=tfplan
terraform apply tfplan
```

Proses ini memakan waktu ±10–15 menit; RDS adalah bagian paling lama. Setelah selesai:

```bash
terraform output
terraform output github_settings
```

Selanjutnya:

1. **Konfirmasi dua email langganan SNS** dari AWS Notifications: satu untuk alarm dan satu untuk billing. Alarm tidak akan terkirim sebelum dikonfirmasi.
2. Tunggu ±5 menit agar user_data selesai. Cek dengan:
   ```bash
   ssh -i ~/.ssh/siipb_deploy ubuntu@<ec2_public_ip> 'cat /opt/siipb/.bootstrap-done; tail -5 /var/log/siipb-bootstrap.log'
   ```
   Pada tahap ini Nginx sudah berjalan, tetapi aplikasi belum (502) sampai deploy pertama.

> Bila akun AWS sudah memiliki OIDC provider `token.actions.githubusercontent.com`, set `create_github_oidc_provider = false`.

## Tahap 6 — DNS

- **Route 53** (`route53_zone_id` diisi): record A dibuat otomatis.
- **Registrar lain**: buat record berikut (nilai juga ada di output `dns_record`):

  | Host | Tipe | Nilai | TTL |
  |---|---|---|---|
  | `siipb` | A | `<ec2_public_ip>` | 300 |

Cek propagasi:

```bash
nslookup siipb.averus.my.id
```

## Tahap 7 — GitHub Actions

Di repository GitHub, buka **Settings → Environments**, lalu buat environment `production` (opsional: tambahkan *required reviewers*).
Lalu di **Settings → Secrets and variables → Actions**:

| Jenis | Nama | Nilai |
|---|---|---|
| Secret | `AWS_DEPLOY_ROLE_ARN` | output `github_actions_role_arn` |
| Secret | `EC2_SSH_PRIVATE_KEY` | isi `~/.ssh/siipb_deploy` (lengkap dengan baris BEGIN/END) |
| Variable | `AWS_REGION` | mis. `ap-southeast-1` |
| Variable | `EC2_HOST` | output `ec2_public_ip` |
| Variable | `EC2_SECURITY_GROUP_ID` | output `ec2_security_group_id` |
| Variable | `APP_DOMAIN` | `siipb.averus.my.id` |
| Variable | `INSTITUTION_NAME` | nama instansi (ditanam saat build frontend) |

Alur `deploy.yml` setiap ada push ke `main`:

1. **test**: `pytest` dengan MariaDB service container.
2. **build**: membangun 3 image (`backend`, `worker`, `frontend`) lalu push ke ECR dengan tag `<commit-sha>` dan `latest`.
3. **deploy**:
   - membuka port 22 sementara untuk IP runner, lalu menyalin `deploy/` ke `/opt/siipb`;
   - menjalankan `deploy.sh <sha>`, yang mengambil secret, login ECR, pull image, mengganti container satu per satu sambil menunggu healthcheck, dan rollback otomatis bila gagal;
   - menjalankan smoke test, lalu menutup kembali port 22.

Deploy pertama bisa dipicu dengan push ke `main` atau lewat **Actions → Deploy Production → Run workflow**.

## Tahap 8 — HTTPS (Certbot)

Jalankan sekali setelah DNS mengarah ke Elastic IP dan deploy pertama sukses:

```bash
ssh -i ~/.ssh/siipb_deploy ubuntu@<ec2_public_ip>
/opt/siipb/scripts/setup-ssl.sh
```

Skrip ini memverifikasi DNS, menerbitkan sertifikat (`certbot --webroot`), lalu memasang `siipb.https.conf`
(HTTP → 301 HTTPS, HSTS, TLS 1.2/1.3) dan menguji perpanjangan otomatis (`certbot renew --dry-run`).
Deploy berikutnya otomatis memakai konfigurasi HTTPS karena sertifikat sudah ada.

Buka https://siipb.averus.my.id, login sebagai admin dengan `seed_admin_password`, lalu **segera ganti kata sandi**.

## Tahap 9 — Monitoring

Terraform sudah membuat komponen berikut:

| Alarm | Kondisi |
|---|---|
| `siipb-production-ec2-cpu-high` | CPU EC2 > 80% selama 10 menit |
| `siipb-production-ec2-memory-high` | RAM > 85% (CloudWatch Agent) |
| `siipb-production-ec2-disk-high` | Disk `/` > 85% (CloudWatch Agent) |
| `siipb-production-ec2-status-check` | status check EC2 gagal |
| `siipb-production-rds-*` | CPU RDS > 80%, sisa storage < 2 GiB, freeable memory < 64 MiB |
| `siipb-production-billing-estimated-charges` | estimasi tagihan > `billing_alarm_threshold_usd` (us-east-1) |

Log tersedia di CloudWatch Logs: `/siipb-production/app` (container + log deploy) dan `/siipb-production/nginx`.

Verifikasi agent di EC2:

```bash
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a status
```

Metrik muncul di **CloudWatch → Metrics → CWAgent → InstanceId**.

Uji alarm CPU (opsional, ±10 menit):

```bash
sudo apt-get install -y stress-ng && stress-ng --cpu 2 --timeout 660s
```

## Tahap 10 — Backup & simulasi restore

Lapisan backup yang aktif:

- **RDS Automated Backups**: snapshot harian pada `db_backup_window` (17:00–17:30 UTC = 00:00 WIB), retensi 7 hari, dan point-in-time restore.
  Cek dengan:
  ```bash
  aws rds describe-db-instances --db-instance-identifier siipb-production-mariadb --query "DBInstances[0].[BackupRetentionPeriod,PreferredBackupWindow,LatestRestorableTime]"
  ```
- **Dump aplikasi**: Celery Beat menjalankan `mariadb-dump` pukul 01.00 WIB ke `/opt/siipb/backups`, lalu cron menyinkronkannya ke `s3://<bucket>/backups/` pukul 02.30 dengan retensi 90 hari.
- **Foto/berkas barang**: disinkronkan ke `s3://<bucket>/uploads/` tiap 15 menit (bucket memakai versioning).

**Simulasi restore** (wajib sekali sebelum UAT). Jalankan dari laptop admin setelah ada minimal satu backup harian:

```bash
./infrastructure/scripts/rds_restore_test.sh
```

Skrip ini me-restore RDS ke instans baru (point-in-time terakhir), membandingkan jumlah baris `users`, `assets`, `borrowings`, `audit_logs`, dan versi Alembic
antara produksi dan hasil restore, lalu menghapus instans uji. Simpan output skrip sebagai bukti untuk laporan UAT.

## Operasional harian

| Kebutuhan | Perintah |
|---|---|
| Deploy ulang versi tertentu | `ssh ubuntu@EC2 /opt/siipb/scripts/deploy.sh <commit-sha>` |
| Rollback cepat | sama seperti di atas dengan SHA sebelumnya (lihat tag di ECR) |
| Ubah secret (SMTP, dll.) | ubah variabel lalu `terraform apply`, kemudian `ssh ubuntu@EC2 '/opt/siipb/scripts/deploy.sh $(cat /opt/siipb/.deployed_tag)'` |
| Lihat container | `ssh ubuntu@EC2 'cd /opt/siipb && docker compose -f docker-compose.prod.yml ps'` |
| Akses darurat tanpa SSH | `aws ssm start-session --target <ec2_instance_id>` |
| IP admin berubah | ubah `admin_cidrs` lalu `terraform apply` |

**Menghapus seluruh infrastruktur.** Set `db_deletion_protection = false` dan `s3_force_destroy = true`, jalankan `terraform apply`, lalu `terraform destroy`.
RDS tetap membuat final snapshot kecuali `db_skip_final_snapshot = true`.

## Keamanan secrets (ringkasan)

- Tidak ada kredensial di Git: `.env`, `terraform.tfvars`, `backend.hcl`, `*.tfstate`, dan `deploy/app.env` tercantum di `.gitignore`.
- Password RDS, JWT, dan `SECRET_KEY` dibangkitkan Terraform lalu disimpan di **AWS Secrets Manager** (`siipb/production/app`).
- EC2 membaca secret lewat IAM instance profile saat deploy (`app.env`, chmod 600) dan menyuntikkannya ke container sebagai `env_file`.
- GitHub hanya menyimpan ARN role OIDC dan kunci SSH deploy, tanpa AWS access key.
- S3 diakses dengan instance profile (tanpa access key), dan bucket memblokir akses publik serta menolak koneksi non-TLS.
- Terraform state terenkripsi di S3 dengan versioning dan lockfile.

## Estimasi biaya (ap-southeast-1, perkiraan)

| Komponen | USD/bulan |
|---|---|
| EC2 t3.small + EBS 30 GB gp3 | ±18 |
| RDS db.t4g.micro + 20 GB gp3 + backup | ±16 |
| Public IPv4 (Elastic IP) | ±3,6 |
| Secrets Manager, CloudWatch, S3, ECR | ±3–5 |
| **Total** | **±40–45** |

## Catatan

- Aplikasi saat ini menyimpan unggahan di disk lokal (`storage_service.py`). Agar foto tidak hilang bila instans diganti,
  disk disinkronkan ke S3 tiap 15 menit dan dipulihkan otomatis oleh user_data saat instans baru dibuat.
  Penyimpanan langsung ke S3 memerlukan perubahan kode backend (`boto3` sudah ada di `requirements.txt`).
- Port 25 keluar diblokir AWS secara default. Gunakan 587/465 (Gmail/SES), atau ajukan pembukaan port 25 ke AWS.
- Deploy mengganti container secara berurutan dengan healthcheck, sehingga jeda layanan biasanya hanya beberapa detik.
  Migrasi database yang sudah berjalan tidak ikut di-rollback otomatis.
