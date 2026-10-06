# Database SIIPB

Direktori ini berisi berkas skema dan dump database untuk sistem SIIPB (MariaDB 13 / InnoDB utf8mb4).

---

## 📁 Struktur Direktori

```text
database/
├── SIIPB.sql               # Dump DDL skema database MariaDB 13 (26 tabel + alembic_version)
└── README.md               # Dokumentasi database dan panduan impor
```

---

## 🗄️ Daftar Tabel (26 Tabel)

| Kategori | Nama Tabel | Keterangan |
| :--- | :--- | :--- |
| **RBAC & Pengguna** | `users` | Akun staf, admin, dan pimpinan |
| | `roles` | Master peran dinamis (ADMIN, SARPRAS, PIMPINAN) |
| | `permissions` | Master izin akses granular |
| | `user_roles` | Relasi *many-to-many* pengguna ke peran |
| | `role_permissions` | Relasi *many-to-many* peran ke izin akses |
| **Autentikasi** | `refresh_tokens` | Hash SHA-256 JWT refresh token |
| | `external_identities` | Identitas OAuth / OIDC (`provider`, `provider_subject`) |
| **Master Data** | `organizational_units` | Pohon hierarki unit / jurusan / sekolah |
| | `borrowers` | Master data peminjam (**tanpa akun login**) |
| | `categories` | Master kategori inventaris |
| | `locations` | Hierarki lokasi fisik (Gedung > Lantai > Ruangan) |
| **Inventaris** | `assets` | Data fisik aset dengan CHECK status & kondisi |
| | `asset_history` | Log perubahan status & lokasi aset (*append-only*) |
| **Peminjaman** | `borrowings` | Header transaksi peminjaman (nomor transaksi, tenggat) |
| | `borrowing_items` | Rincian barang dalam peminjaman aktif |
| **Pengembalian** | `returns` | Header pengembalian (penerima & waktu kembali) |
| | `return_items` | Rincian barang kembali (`BAIK`, `RUSAK`, `HILANG`) |
| **Insiden & Perbaikan** | `damage_reports` | Laporan kerusakan, estimasi biaya & siklus perbaikan |
| | `loss_reports` | Laporan kehilangan aset |
| **Notifikasi** | `notification_templates` | Template subjek dan isi email |
| | `notification_events` | Kunci idempotency: `UNIQUE(borrowing_id, event_code)` |
| | `notifications` | Snapshot notifikasi email yang siap dikirim |
| | `notification_logs` | Log siklus hidup pembuatan dan antrean notifikasi |
| | `email_deliveries` | Rekam jejak percobaan pengiriman SMTP per attempt |
| **Konfigurasi & Audit** | `system_settings` | Konfigurasi sistem dinamis (*key-value*) |
| | `audit_logs` | Jejak audit aktivitas pengguna & snapshot JSON |

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
