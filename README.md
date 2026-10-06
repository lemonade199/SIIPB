# SIIPB (Sistem Informasi Inventaris dan Peminjaman Barang)

Sistem Informasi Inventaris dan Peminjaman Barang berbasis web dengan fokus pada integritas data transaksi, kontrol hak akses berbasis peran (RBAC), idempotency notifikasi email, dan audit trail menyeluruh.

---

## 🛠️ Tech Stack & Database Architecture

- **Language / Runtime:** Python 3.12
- **ORM / Migrations:** SQLAlchemy 2.0 (Modern 2.x declarative syntax), Alembic 1.13+
- **Database:** MariaDB 13 (InnoDB Engine, `utf8mb4`, `utf8mb4_unicode_ci`)
- **Driver:** PyMySQL 1.1+

---

## 📌 Karakteristik & Desain Skema (26 Tabel)

1. **Peminjam Tanpa Akun (`borrowers`):** Peminjam hanya tercatat sebagai master data dan tidak memiliki username/password/login.
2. **RBAC Dinamis (`users`, `roles`, `permissions`, `user_roles`, `role_permissions`):** Role tidak di-hardcode ke permission.
3. **Autentikasi Aman (`refresh_tokens`, `external_identities`):** Refresh token disimpan dalam bentuk hash SHA-256 (`token_hash`), OAuth OIDC menggunakan `(provider, provider_subject)`.
4. **Hierarki Organisasi & Lokasi (`organizational_units`, `locations`):** Mendukung relasi multi-level (Gedung > Lantai > Ruangan, Sekolah > Unit/Jurusan).
5. **Integritas Status Barang (`assets`, `asset_history`):** Status barang dikunci oleh database CHECK constraints (`TERSEDIA`, `DIPINJAM`, `RUSAK`, `RUSAK_BERAT`, `DALAM_PERBAIKAN`, `HILANG`, `NONAKTIF`). Perubahan status tercatat secara *append-only* di `asset_history`.
6. **Transaksi Peminjaman & Pengembalian (`borrowings`, `borrowing_items`, `returns`, `return_items`):** Mendukung pengembalian parsial dan proteksi `ON DELETE RESTRICT` agar riwayat transaksi tidak dapat terhapus.
7. **Laporan Kerusakan & Kehilangan (`damage_reports`, `loss_reports`):** Siklus perbaikan barang rusak memiliki tracking terpisah dengan status perbaikan dan estimasi biaya non-negatif.
8. **Idempotent Notifications (`notification_events`, `notifications`, `notification_logs`, `email_deliveries`):** Idempotency dijamin oleh database constraint `UNIQUE(borrowing_id, event_code)`. Scheduler aman dieksekusi berkali-kali tanpa duplikasi pengiriman.
9. **Audit Trail & Konfigurasi (`audit_logs`, `system_settings`):** Snapshot perubahan data disimpan dalam kolom format JSON tervalidasi (`json_valid`).

---

## 🚀 Panduan Setup & Instalasi Lokal

### 1. Prasyarat
- Python 3.12+
- MariaDB Server 10.11+ / 13.0+

### 2. Virtual Environment & Dependensi
```bash
python -m venv .venv
.\.venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### 3. Konfigurasi Lingkungan (`.env`)
Salin berkas template konfigurasi:
```bash
cp .env.example .env
```
Sesuaikan `DATABASE_URL` di dalam file `.env`:
```env
DATABASE_URL=mariadb+pymysql://USER:PASSWORD@127.0.0.1:3306/siipb?charset=utf8mb4
```

### 4. Eksekusi Migrasi Database
```bash
alembic upgrade head
```

### 5. Validasi & Pengujian Skema Otomatis
Jalankan test suite integritas skema (12 skenario pengujian):
```bash
python scripts/verify_schema.py
```

### 6. Impor Langsung Dump SQL (Alternatif)
Dump lengkap skema database tersedia di dalam folder [database/](file:///c:/SIIPB/database):
```bash
mariadb -u root -p siipb < database/SIIPB.sql
```