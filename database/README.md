# Database SIIPB

Direktori ini berisi berkas skema dan dump database untuk sistem SIIPB (MariaDB 13 / InnoDB utf8mb4).

---

## 📁 Struktur Direktori

```text
database/
├── SIIPB.sql               # Skema terbaru hasil `alembic upgrade head` (23 tabel aplikasi + alembic_version, revisi d4e8b1a5f920)
└── README.md               # Dokumentasi database dan panduan impor
```

---

## 🗄️ Daftar Tabel (23 Tabel Aplikasi + alembic_version)

> Sumber kebenaran skema adalah migrasi Alembic (`backend/alembic/versions`). Docker Compose menjalankannya otomatis; `SIIPB.sql` untuk referensi/impor manual (lanjutkan dengan `python backend/scripts/seed_data.py`).

| Kategori | Nama Tabel | Keterangan |
| :--- | :--- | :--- |
| **RBAC & Pengguna** | `users` | Akun staf, admin, dan pimpinan (termasuk `role_id`, data Google SSO) |
| | `roles` | Master peran dinamis (ADMIN, SARPRAS, PIMPINAN, custom role) dengan daftar hak akses disimpan dalam kolom JSON `permissions` |
| **Autentikasi** | `refresh_tokens` | Hash SHA-256 JWT refresh token |
| **Master Data** | `organizational_units` | Pohon hierarki unit / jurusan / sekolah |
| | `borrowers` | Master data peminjam (**tanpa akun login**) |
| | `categories` | Master kategori inventaris |
| | `locations` | Hierarki lokasi fisik (Gedung > Lantai > Ruangan) |
| **Inventaris** | `assets` | Data fisik aset dengan CHECK status & kondisi |
| | `asset_photos` | Foto barang (item_photos), maks. 5, urutan 0 = foto utama |
| | `asset_history` | Log perubahan status & lokasi aset (*append-only*) |
| **Peminjaman** | `borrowings` | Header transaksi peminjaman (nomor transaksi, tenggat) |
| | `borrowing_items` | Rincian barang dalam peminjaman aktif |
| **Pengembalian** | `returns` | Header pengembalian (penerima & waktu kembali) |
| | `return_items` | Rincian barang kembali (`BAIK`, `RUSAK`, `HILANG`) |
| **Insiden & Perbaikan** | `asset_incident_reports` | Laporan kerusakan & kehilangan aset, estimasi biaya & siklus perbaikan |
| **Notifikasi** | `notification_templates` | Template subjek dan isi email |
| | `notification_events` | Kunci idempotency: `UNIQUE(borrowing_id, event_code)` |
| | `notifications` | Snapshot notifikasi email yang siap dikirim |
| | `notification_deliveries` | Log siklus hidup dan percobaan pengiriman SMTP per attempt |
| | `notification_reads` | Penanda notifikasi sudah dibaca per pengguna internal |
| | `scheduler_runs` | Log setiap pemeriksaan jatuh tempo (Celery Beat / manual) |
| **Konfigurasi & Audit** | `system_settings` | Konfigurasi sistem dinamis (*key-value*) |
| | `audit_logs` | Jejak audit aktivitas pengguna & snapshot JSON |

Katalog 16 permission granular didefinisikan secara statis pada backend (`app/models/permission.py`) dan disimpan langsung per role pada kolom JSON `roles.permissions`. API `/api/v1/permissions` tetap menyajikan katalog lengkap ke frontend / Matriks Hak Akses.

---

## ⚡ Cara Import / Restore Database

### Opsi 1: Menggunakan Dump SQL Langsung
Jika ingin mengimpor langsung dari dump SQL:

```bash
# 1. Buat database baru di MariaDB jika belum ada
mariadb -u root -p -e "CREATE DATABASE IF NOT EXISTS siipb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. Impor berkas dump
mariadb -u root -p siipb < database/SIIPB.sql
```

### Opsi 2: Menggunakan Alembic Migration (Rekomendasi Developer)
Jika mengelola dari project Python:

```bash
# Jalankan migrasi ke versi terbaru
alembic upgrade head
```

---

## 🧪 Validasi Integritas Database
Untuk menjalankan pengujian otomatis atas seluruh CHECK constraints, relasi RESTRICT, dan idempotency:

```bash
python scripts/verify_schema.py
```
