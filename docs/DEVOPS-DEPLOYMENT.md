# SIIPB — Panduan DevOps: AWS CloudFormation, CI/CD, dan Operasional

Panduan ini menjelaskan cara membangun infrastruktur production SIIPB di AWS secara otomatis
dengan **AWS CloudFormation** (Infrastructure as Code), menyiapkan pipeline rilis GitHub Actions,
dan menjalankan pemantauan serta backup.

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
  ECR: siipb-backend, siipb-worker, siipb-frontend     Secrets Manager: siipb/production/{db,secret-key,jwt,app-config}
  S3: bucket berkas (uploads/, backups/)               CloudWatch Alarms → SNS email · billing alert (us-east-1)
  GitHub Actions ── OIDC (tanpa access key) ──► ECR push + SSH sementara ke EC2
```

## Struktur berkas

```text
infrastructure/cloudformation/
├── templates/
│   ├── 01-network.yaml   VPC, subnet publik/privat, route table, S3 endpoint, Security Group
│   ├── 02-data.yaml      RDS MariaDB, S3, ECR (3 repo), Secrets Manager
│   ├── 03-app.yaml       IAM + OIDC GitHub, EC2 + Elastic IP + user data, Route 53, log, SNS, alarm
│   └── 04-billing.yaml   billing alert (region us-east-1)
├── params.env.example    contoh parameter → salin ke params.env
└── deploy-stacks.sh      deploy semua stack berurutan + tampilkan nilai untuk GitHub
deploy/                   berkas yang disalin CI ke EC2 (/opt/siipb)
├── docker-compose.prod.yml
├── nginx/                siipb.http.conf, siipb.https.conf, snippets/siipb-locations.conf
└── scripts/              deploy.sh, fetch-secrets.sh, setup-ssl.sh
.github/workflows/deploy.yml   CI/CD: pytest → build → push ECR → SSH deploy
infrastructure/scripts/rds_restore_test.sh   simulasi restore RDS
```

## Peta tugas → implementasi

| Tugas | Implementasi |
|---|---|
| **1. Provisioning** VPC, public subnet (server) & private subnet (DB) | `01-network.yaml` |
| EC2 Ubuntu di public subnet | `03-app.yaml` (`AppInstance`, Elastic IP, IMDSv2, disk terenkripsi) |
| RDS MariaDB di private subnet | `02-data.yaml` (`PubliclyAccessible: false`, subnet privat tanpa rute internet) |
| S3 untuk berkas & foto barang | `02-data.yaml` (`FilesBucket`: privat, terenkripsi, versioning, lifecycle) |
| SG 80/443, 22 khusus IP Anda, port SMTP | `01-network.yaml` (`AdminCidr` untuk SSH; egress 25/465/587) |
| **2. Containerization** Dockerfile frontend/backend/worker | `frontend/Dockerfile`, `backend/Dockerfile`, `backend/Dockerfile.worker` |
| docker-compose lokal + Redis + MariaDB | `docker-compose.yml` (+ `docker-compose.dev.yml`) |
| Amazon ECR | `02-data.yaml` (scan on push, simpan 15 image terakhir) |
| **3. Web server & domain** Nginx reverse proxy di EC2 | `deploy/nginx/*`, dipasang user data & `deploy.sh` |
| DNS subdomain → Elastic IP | `03-app.yaml` (`DnsRecord` bila Route 53) atau record A manual |
| Certbot / HTTPS wajib | `deploy/scripts/setup-ssl.sh` + `siipb.https.conf` |
| **4. CI/CD** | `.github/workflows/deploy.yml` |
| **5. Secrets** | Secrets Manager (`02-data.yaml`) → `fetch-secrets.sh` → `app.env` → container |
| **6. Monitoring & backup** | Automated Backups RDS, CloudWatch Agent + alarm (`03-app.yaml`), billing (`04-billing.yaml`), `rds_restore_test.sh` |

---

## Tahap 0 — Prasyarat

1. **Akun AWS** dengan user IAM/SSO administrator. Jangan pakai akun root untuk pekerjaan harian.
2. **Alat di laptop** (Windows: jalankan semua perintah di **Git Bash**):
   - AWS CLI v2:
     ```bash
     winget install Amazon.AWSCLI
     ```
     Lalu buka ulang terminal dan login:
     ```bash
     aws configure
     ```
     Isi Access Key admin, region `ap-southeast-1`, dan output `json`.
   - Git dan OpenSSH (sudah ada bersama Git for Windows).
   - `jq`, hanya untuk skrip uji restore:
     ```bash
     winget install jqlang.jq
     ```
3. **Aktifkan billing alert** (sekali, oleh pemilik akun): Billing and Cost Management → Billing preferences →
   Alert preferences → centang **Receive CloudWatch billing alerts** → Update.
4. Akses untuk mengubah DNS `averus.my.id`, baik di Route 53 maupun di panel registrar.

Verifikasi bahwa CLI sudah login:

```bash
aws sts get-caller-identity
```

### Khusus AWS Academy / Learner Lab

Akun lab memiliki batasan, dan template sudah menyediakan mode khususnya:

| Batasan lab | Penyesuaian |
|---|---|
| Hanya region **us-east-1** (atau us-west-2) | `AWS_REGION=us-east-1`; deploy semua stack di N. Virginia |
| **Tidak boleh membuat IAM role / OIDC provider** | `Ec2InstanceProfileName = LabInstanceProfile` dan `CreateGitHubDeployRole = false` |
| Tidak ada akses Billing | stack `04-billing` **tidak dipakai** (tidak termasuk `./deploy-stacks.sh`) |
| Kredensial sementara (habis tiap sesi ±4 jam) | GitHub secret `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` diambil dari **AWS Details → AWS CLI** di halaman lab, dan **diperbarui tiap mulai sesi** sebelum push/deploy |
| EC2 & RDS dihentikan saat sesi lab berakhir | otomatis menyala lagi saat lab di-*Start*. Container memakai `restart: unless-stopped`, Elastic IP tetap sama |

Untuk AWS CLI di laptop, salin isi **AWS Details → AWS CLI: Show** ke `~/.aws/credentials` setiap sesi.

## Tahap 1 — Jalankan aplikasi secara lokal (tim developer)

```bash
cp .env.example .env
```

Isi `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `SECRET_KEY`, `JWT_SECRET_KEY`, dan `SEED_ADMIN_PASSWORD` di `.env`, lalu:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Buka http://localhost (Swagger: http://localhost/api/docs). Ketujuh container (`mariadb`, `redis`, `backend`,
`celery_worker`, `celery_beat`, `frontend`, `nginx`) harus berstatus *healthy*:

```bash
docker compose ps
```

## Tahap 2 — Buat kunci SSH deploy

```bash
ssh-keygen -t ed25519 -f ~/.ssh/siipb_deploy -C "siipb-deploy" -N ""
```

- `~/.ssh/siipb_deploy.pub` dipakai CloudFormation (parameter `SSH_PUBLIC_KEY_FILE`).
- `~/.ssh/siipb_deploy` (private key) nanti diisi ke GitHub secret `EC2_SSH_PRIVATE_KEY`. Jangan di-commit.

## Tahap 3 — Isi parameter

```bash
cd infrastructure/cloudformation
cp params.env.example params.env
```

Cek IP publik Anda:

```bash
curl https://checkip.amazonaws.com
```

Sunting `params.env`, minimal bagian berikut:

| Variabel | Isi |
|---|---|
| `ADMIN_CIDR` | IP publik Anda + `/32`, mis. `36.71.10.20/32` |
| `DOMAIN_NAME` | `siipb.averus.my.id` |
| `HOSTED_ZONE_ID` | ID hosted zone bila DNS di Route 53; kosongkan bila DNS di registrar |
| `LETSENCRYPT_EMAIL`, `ALARM_EMAIL` | email aktif |
| `SMTP_USERNAME`, `SMTP_SENDER_EMAIL` | akun SMTP (mis. Gmail + App Password) |

Password **tidak** ditulis ke berkas. Berikan lewat variabel lingkungan di terminal yang sama:

```bash
export SEED_ADMIN_PASSWORD='GantiDenganSandiKuat2026'
export SMTP_PASSWORD='app-password-gmail'
```

`SEED_ADMIN_PASSWORD` wajib saat pertama kali, sedangkan `SMTP_PASSWORD` opsional (kosong berarti email hanya disimulasikan).

> Password RDS, `SECRET_KEY`, dan `JWT_SECRET_KEY` **dibangkitkan otomatis oleh AWS Secrets Manager**, jadi tidak pernah ada di repo atau di laptop.
> Hindari tanda kutip tunggal (`'`) di semua password.

## Tahap 4 — Deploy infrastruktur

Masih di folder `infrastructure/cloudformation`:

```bash
chmod +x deploy-stacks.sh
./deploy-stacks.sh
```

Skrip membuat 3 stack secara berurutan (total ±20–30 menit):

| Stack | Region | Isi | Waktu |
|---|---|---|---|
| `siipb-production-network` | ap-southeast-1 | VPC, subnet, SG | ±2 menit |
| `siipb-production-data` | ap-southeast-1 | RDS, S3, ECR, Secrets Manager | ±10–15 menit |
| `siipb-production-app` | ap-southeast-1 | IAM, EC2, EIP, DNS, alarm | ±5–10 menit |

Stack `app` memakai **WaitCondition**: stack baru dinyatakan sukses setelah bootstrap EC2 (Docker, Nginx,
Certbot, CloudWatch Agent) selesai dan mengirim sinyal lewat URL presigned (tidak butuh izin IAM). Bila bootstrap gagal
atau tidak selesai dalam 25 menit, stack otomatis gagal dan di-rollback.

Billing alert (`04-billing.yaml`, region us-east-1) **tidak** ikut dibuat. Pada akun AWS biasa (bukan Academy), jalankan terpisah:
```bash
./deploy-stacks.sh billing
```

Di akhir, skrip menampilkan semua output beserta nilai yang perlu diisi ke GitHub. Untuk menampilkannya lagi:

```bash
./deploy-stacks.sh outputs
```

Lalu:

1. **Konfirmasi email "AWS Notification - Subscription Confirmation"** yang dikirim ke `ALARM_EMAIL`. Alarm tidak terkirim sebelum dikonfirmasi.
2. Opsional: cek log bootstrap.
   ```bash
   ssh -i ~/.ssh/siipb_deploy ubuntu@<PublicIp> 'cat /opt/siipb/.bootstrap-done'
   ```
   Pada tahap ini Nginx sudah aktif, tetapi aplikasi masih menampilkan 502 sampai deploy pertama (Tahap 6).

Bila terjadi error, buka **CloudFormation console → stack → tab Events**. Cari baris `CREATE_FAILED` pertama; kolom *Status reason* menjelaskan penyebabnya.
Setelah diperbaiki, jalankan `./deploy-stacks.sh` lagi. Stack yang gagal saat pertama kali dibuat (`ROLLBACK_COMPLETE`) harus dihapus dulu:

```bash
aws cloudformation delete-stack --stack-name <nama-stack>
```

> Bila akun sudah punya OIDC provider GitHub (`token.actions.githubusercontent.com`), set `CREATE_GITHUB_OIDC_PROVIDER=false`.

### Alternatif: upload manual lewat CloudFormation Console

Buka **Create stack → With new resources → Upload a template file**, lalu buat stack berurutan di region yang sama.
Tunggu tiap stack sampai `CREATE_COMPLETE` sebelum lanjut. Nama di kolom `NetworkStackName` dan `DataStackName`
harus **persis sama** dengan nama stack yang dibuat sebelumnya, karena export dicari berdasarkan nama itu.
Untuk memastikan, cek menu **Exports**.

1. **01-network.yaml**, nama `siipb-production-network`. Isi `AdminCidr` = `<IP Anda>/32`, sisanya default.
2. **02-data.yaml**, nama `siipb-production-data`:
   - isi `NetworkStackName` dan `SeedAdminPassword`;
   - SMTP/Google boleh kosong;
   - centang **CAPABILITY_AUTO_EXPAND**.
3. **03-app.yaml**, nama `siipb-production-app`:

   | Parameter | Isi |
   |---|---|
   | NetworkStackName / DataStackName | nama stack 1 / stack 2 |
   | SshPublicKey | isi `~/.ssh/siipb_deploy.pub` (satu baris) |
   | DomainName | domain aplikasi, mis. `averus.my.id` |
   | HostedZoneId | kosong (DNS di registrar) |
   | LetsEncryptEmail / AlarmEmail | email aktif |
   | **Ec2InstanceProfileName** | `LabInstanceProfile` (Academy) / kosong (akun biasa) |
   | **CreateGitHubDeployRole** | `false` (Academy) / `true` (akun biasa) |
   | CreateGitHubOidcProvider | diabaikan bila `CreateGitHubDeployRole=false` |
   | lainnya | default |

   Centang kotak IAM hanya bila muncul (akun biasa).

## Tahap 5 — DNS

- **Route 53** (`HOSTED_ZONE_ID` diisi): record A dibuat otomatis.
- **Registrar lain**: buat record berikut di panel DNS `averus.my.id`:

  | Host | Tipe | Nilai | TTL |
  |---|---|---|---|
  | `siipb` (atau `@` bila `DOMAIN_NAME` = `averus.my.id`) | A | `<PublicIp>` | 300 |

Cek propagasi:

```bash
nslookup siipb.averus.my.id
```

Hasilnya harus menunjukkan Elastic IP.

## Tahap 6 — GitHub Actions & deploy pertama

1. Di GitHub, buka **Settings → Environments → New environment**, lalu buat `production` (opsional: tambahkan *required reviewers*).
2. Isi **Settings → Secrets and variables → Actions** (nilainya dari `./deploy-stacks.sh outputs`):

   | Jenis | Nama | Nilai |
   |---|---|---|
   | Secret | `AWS_DEPLOY_ROLE_ARN` | output `GitHubActionsRoleArn` (akun AWS biasa) |
   | Secret | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` | **AWS Academy**: dari AWS Details lab, perbarui tiap sesi (kosongkan `AWS_DEPLOY_ROLE_ARN`) |
   | Secret | `EC2_SSH_PRIVATE_KEY` | seluruh isi `~/.ssh/siipb_deploy` (termasuk baris BEGIN/END) |
   | Variable | `AWS_REGION` | region stack, mis. `us-east-1` (Academy) |
   | Variable | `EC2_HOST` | output `PublicIp` |
   | Variable | `EC2_SECURITY_GROUP_ID` | output `Ec2SecurityGroupId` |
   | Variable | `APP_DOMAIN` | `siipb.averus.my.id` |
   | Variable | `INSTITUTION_NAME` | nama instansi (ditanam saat build frontend) |

3. Merge/push ke `main`, atau buka **Actions → Deploy Production → Run workflow**.

Alur `deploy.yml`:

1. **test**: `pytest` dengan MariaDB service container.
2. **build** (3 job paralel): image `backend`, `worker`, dan `frontend` di-push ke ECR dengan tag `<commit-sha>` dan `latest`.
3. **deploy**:
   - membuka port 22 untuk IP runner saja, lalu menyalin `deploy/` ke `/opt/siipb`;
   - menjalankan `deploy.sh <sha>`, yang mengambil secret, login ECR, pull image, mengganti container satu per satu sambil menunggu healthcheck, dan rollback otomatis bila gagal;
   - menjalankan smoke test `/api/health`, lalu menutup kembali port 22 (selalu, walaupun job gagal).

## Tahap 7 — HTTPS (Certbot)

Jalankan sekali setelah DNS mengarah ke Elastic IP **dan** deploy pertama sukses:

```bash
ssh -i ~/.ssh/siipb_deploy ubuntu@<PublicIp>
/opt/siipb/scripts/setup-ssl.sh
```

Skrip ini:

- memverifikasi DNS;
- menerbitkan sertifikat Let's Encrypt (`certbot --webroot`);
- mengaktifkan `siipb.https.conf` (HTTP → 301 HTTPS, HSTS, TLS 1.2/1.3);
- menguji perpanjangan otomatis.

Deploy berikutnya otomatis memakai konfigurasi HTTPS.

Buka **https://siipb.averus.my.id**, login sebagai `admin` dengan `SEED_ADMIN_PASSWORD`, lalu **segera ganti kata sandi**.

## Tahap 8 — Monitoring

| Alarm | Kondisi |
|---|---|
| `siipb-production-ec2-cpu-high` | CPU EC2 > 80% selama 10 menit |
| `siipb-production-ec2-memory-high` | RAM > 85% (CloudWatch Agent) |
| `siipb-production-ec2-disk-high` | Disk `/` > 85% (CloudWatch Agent) |
| `siipb-production-ec2-status-check` | status check EC2 gagal |
| `siipb-production-rds-cpu-high` / `-free-storage-low` / `-freeable-memory-low` | beban & kapasitas RDS |
| `siipb-production-billing-estimated-charges` (us-east-1, opsional, bukan Academy) | estimasi tagihan > `BILLING_THRESHOLD_USD` |

- Konfigurasi agent tersimpan di SSM Parameter `AmazonCloudWatch-siipb-production`.
- Metrik ada di **CloudWatch → Metrics → CWAgent → InstanceId**.
- Log: `/siipb-production/app` (container, deploy, bootstrap) dan `/siipb-production/nginx`.

Cek status agent di EC2:

```bash
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a status
```

Uji alarm CPU (opsional, ±10 menit):

```bash
sudo apt-get install -y stress-ng && stress-ng --cpu 2 --timeout 660s
```

Email "ALARM" akan datang, disusul "OK" setelah beban turun.

## Tahap 9 — Backup & simulasi restore

Lapisan backup:

- **RDS Automated Backups**: snapshot harian 17:00–17:30 UTC (00:00 WIB), retensi 7 hari, plus point-in-time restore. Cek dengan:
  ```bash
  aws rds describe-db-instances --db-instance-identifier siipb-production-mariadb --query "DBInstances[0].[BackupRetentionPeriod,PreferredBackupWindow,LatestRestorableTime]"
  ```
  Daftar snapshot harian:
  ```bash
  aws rds describe-db-snapshots --db-instance-identifier siipb-production-mariadb --snapshot-type automated
  ```
- **Dump aplikasi**: Celery Beat menjalankan `mariadb-dump` pukul 01.00 WIB, lalu hasilnya disinkronkan ke `s3://<bucket>/backups/` pukul 02.30 dengan retensi 90 hari.
- **Foto/berkas barang**: disinkronkan ke `s3://<bucket>/uploads/` tiap 15 menit (bucket memakai versioning).

**Simulasi restore** (wajib sekali sebelum UAT, setelah minimal 1 hari berjalan). Jalankan dari root repo:

```bash
./infrastructure/scripts/rds_restore_test.sh
```

Skrip ini:

1. me-restore RDS ke **instans baru** (point-in-time terakhir);
2. membandingkan jumlah baris `users`, `assets`, `borrowings`, `audit_logs`, dan versi Alembic antara produksi dan hasil restore;
3. menghapus instans uji (`KEEP=1` untuk menyimpannya).

Simpan output skrip sebagai bukti uji restore pada laporan UAT.

## Operasional harian

| Kebutuhan | Cara |
|---|---|
| Deploy ulang / rollback ke versi tertentu | `ssh ubuntu@EC2 /opt/siipb/scripts/deploy.sh <commit-sha>` |
| Ubah SMTP / parameter lain | ubah `params.env` (password lewat `export`) → `./deploy-stacks.sh data` → deploy ulang aplikasi |
| IP admin berubah | ubah `ADMIN_CIDR` → `./deploy-stacks.sh network` |
| Lihat container | `ssh ubuntu@EC2 'cd /opt/siipb && docker compose -f docker-compose.prod.yml ps'` |
| Akses darurat tanpa SSH | `aws ssm start-session --target <InstanceId>` |
| Cek perubahan di luar CloudFormation | Console → stack → *Stack actions → Detect drift* |

Untuk deploy ulang aplikasi tanpa ganti versi:

```bash
ssh ubuntu@EC2 '/opt/siipb/scripts/deploy.sh $(cat /opt/siipb/.deployed_tag)'
```

**Menghapus infrastruktur** (urutan terbalik):

1. Set `DB_DELETION_PROTECTION=false` lalu jalankan `./deploy-stacks.sh data`.
2. Hapus stack satu per satu dengan urutan ini, menunggu tiap stack selesai sebelum lanjut:
   ```bash
   aws cloudformation delete-stack --region us-east-1 --stack-name siipb-production-billing
   ```
   ```bash
   aws cloudformation delete-stack --stack-name siipb-production-app
   ```
   ```bash
   aws cloudformation delete-stack --stack-name siipb-production-data
   ```
   ```bash
   aws cloudformation delete-stack --stack-name siipb-production-network
   ```

RDS meninggalkan snapshot akhir, dan bucket S3 tetap disimpan (`DeletionPolicy`) supaya data tidak hilang tidak sengaja. Hapus keduanya manual bila memang tidak diperlukan.

## Keamanan secrets (ringkasan)

- Tidak ada kredensial di Git: `.env`, `params.env`, dan `app.env` tercantum di `.gitignore`.
- Password RDS, `SECRET_KEY`, dan `JWT_SECRET_KEY` dibangkitkan AWS Secrets Manager. Parameter rahasia CloudFormation memakai `NoEcho`.
- EC2 membaca secret lewat IAM instance profile saat deploy, menulisnya ke `app.env` (chmod 600), dan menyuntikkannya ke container sebagai `env_file`.
- GitHub hanya menyimpan ARN role OIDC dan kunci SSH deploy, tanpa AWS access key.
- S3 diakses lewat instance profile. Bucket memblokir akses publik dan menolak koneksi non-TLS.

## Estimasi biaya (ap-southeast-1, perkiraan)

| Komponen | USD/bulan |
|---|---|
| EC2 t3.small + EBS 30 GB gp3 | ±18 |
| RDS db.t4g.micro + 20 GB gp3 + backup | ±16 |
| Public IPv4 (Elastic IP) | ±3,6 |
| Secrets Manager (4 secret), CloudWatch, S3, ECR | ±4–6 |
| **Total** | **±42–45** |

## Catatan

- Unggahan aplikasi saat ini disimpan di disk lokal (`storage_service.py`). Disk disinkronkan ke S3 tiap 15 menit
  dan dipulihkan otomatis oleh user data bila instans diganti. Penyimpanan langsung ke S3 memerlukan perubahan kode backend.
- AWS memblokir port 25 keluar secara default. Gunakan 587/465 (Gmail/SES).
- Deploy mengganti container berurutan dengan healthcheck, jadi jeda layanan hanya beberapa detik.
  Migrasi database yang sudah berjalan tidak ikut di-rollback otomatis.
