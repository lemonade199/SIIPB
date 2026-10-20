# Database SIIPB

Direktori ini berisi berkas skema, diagram ERD (Entity Relationship Diagram), dan dump database untuk sistem SIIPB (MariaDB 13 / InnoDB `utf8mb4_unicode_ci`).

---

## 📁 Struktur Direktori

```text
database/
├── SIIPB.sql               # Skema terbaru hasil `alembic upgrade head` (23 tabel aplikasi + alembic_version, revisi d4e8b1a5f920)
├── ERD.png                 # Diagram ERD visual resolusi tinggi (format gambar)
├── ERD.svg                 # Diagram ERD visual vektor murni skalabel
└── README.md               # Dokumentasi database, ERD, dan panduan impor
```

---

## 🖼️ Entity Relationship Diagram (ERD)

Diagram ERD resmi skema database aktif SIIPB (23 tabel produksi) menggunakan gaya visual **Crow's Foot**:

![Entity Relationship Diagram SIIPB](ERD.png)

> **Catatan Berkas:**
> - Versi visual interaktif (dengan fitur *Pan*, *Zoom*, dan unduh berkas): [`docs/SIIPB_ERD_diagram.html`](../docs/SIIPB_ERD_diagram.html).
> - Berkas vektor skalabel tanpa penurunan kualitas: [`database/ERD.svg`](ERD.svg).

---

## 🗄️ Daftar Tabel (23 Tabel Aplikasi + alembic_version)

> Sumber kebenaran skema adalah migrasi Alembic (`backend/alembic/versions`). Docker Compose menjalankannya otomatis; `SIIPB.sql` untuk referensi/impor manual (lanjutkan dengan `python backend/scripts/seed_data.py`).

| Kategori | Nama Tabel | Keterangan & Relasi Kunci |
| :--- | :--- | :--- |
| **RBAC & Pengguna** | `users` | Akun staf, admin, dan pimpinan (termasuk `role_id -> roles.id`, data Google SSO) |
| | `roles` | Master peran dinamis (ADMIN, SARPRAS, PIMPINAN) dengan daftar izin disimpan pada kolom JSON `permissions` |
| **Autentikasi** | `refresh_tokens` | Hash SHA-256 JWT refresh token (`user_id`, `ON DELETE CASCADE`) |
| **Master Data** | `organizational_units` | Pohon hierarki unit / jurusan / sekolah (`parent_id` self-referencing) |
| | `borrowers` | Master data peminjam (**tanpa akun login**, terafiliasi ke `unit_id`) |
| | `categories` | Master kategori inventaris |
| | `locations` | Hierarki lokasi fisik (Gedung > Lantai > Ruangan, `parent_id` self-referencing) |
| **Inventaris** | `assets` | Data fisik aset dengan CHECK status & kondisi (`category_id`, `location_id`, `owner_unit_id`) |
| | `asset_photos` | Galeri foto fisik barang, maks. 5 foto, urutan 0 = foto utama (`asset_id`, `ON DELETE CASCADE`) |
| | `asset_history` | Log perubahan status & mutasi lokasi aset (*append-only*, `RESTRICT`) |
| **Peminjaman** | `borrowings` | Header transaksi peminjaman (nomor transaksi, tenggat waktu, `due_date >= start_date`) |
| | `borrowing_items` | Rincian unit barang dalam peminjaman aktif (`borrowing_id`, `asset_id`) |
| **Pengembalian** | `returns` | Header pengembalian (penerima & waktu kembali) |
| | `return_items` | Rincian kondisi barang saat kembali (`final_condition: BAIK, RUSAK, HILANG`) |
| **Insiden & Perbaikan** | `asset_incident_reports` | Laporan kerusakan & kehilangan aset, estimasi biaya & siklus perbaikan (`return_item_id`) |
| **Notifikasi** | `notification_templates` | Master template subjek dan isi email (dapat disunting admin via UI) |
| | `notification_events` | Kunci idempotency anti-duplikasi: `UNIQUE(borrowing_id, event_code)` |
| | `notifications` | Snapshot notifikasi email yang siap dikirim per alamat penerima |
| | `notification_deliveries` | Log siklus hidup dan percobaan pengiriman SMTP per attempt (`CASCADE`) |
| | `notification_reads` | Penanda notifikasi sudah dibaca per pengguna internal pada kotak masuk bersama |
| | `scheduler_runs` | Log riwayat setiap pemeriksaan jatuh tempo (Celery Beat harian / manual) |
| **Konfigurasi & Audit** | `system_settings` | Konfigurasi sistem dinamis (*key-value*) |
| | `audit_logs` | Jejak audit aktivitas pengguna & snapshot JSON (*append-only*) |

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
python backend/scripts/verify_schema.py
```
