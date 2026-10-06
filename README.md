# SIIPB (Sistem Informasi Inventaris dan Peminjaman Barang)

Sistem Informasi Inventaris dan Peminjaman Barang berbasis web dengan arsitektur monorepo terpadu, mendukung integrasi mulus antara tim **Frontend** dan **Backend**.

---

## 📁 Struktur Repositori (Monorepo)

```text
SIIPB/
├── backend/                  # 🐍 Backend API Service (Flask 3.0 & SQLAlchemy 2.x)
│   ├── app/                  # Application Factory, Models, & REST Blueprints
│   ├── alembic/              # Database Migrations
│   ├── scripts/              # Seed data & verification scripts
│   ├── run.py                # Development server runner (Port 5000)
│   └── README.md             # Panduan lengkap backend developer
│
├── frontend/                 # ⚛️ Frontend UI Workspace (React / Vue / Vite / Next.js)
│   ├── .env.example          # Konfigurasi endpoint API klien
│   └── README.md             # Panduan integrasi tim frontend
│
├── database/                 # 🗄️ Database Schema & DDL
│   ├── SIIPB.sql             # MariaDB 13 Full Database Dump (26 Tabel)
│   └── README.md             # Dokumentasi skema & panduan restore manual
│
├── docs/                     # 📚 Dokumentasi Teknis & Kontrak
│   ├── api_specification.md  # Spesifikasi REST API Kontrak Frontend <-> Backend
│   └── architecture.md       # Diagram arsitektur sistem & integrasi
│
├── .gitignore                # Global gitignore (Virtualenv, .env, caches)
└── README.md                 # Dokumentasi utama proyek
```

---

## 🚀 Quick Start untuk Tim Pengembang

### 1. Menjalankan Backend API
```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate      # Windows
pip install -r requirements.txt

# Siapkan database & migrasi
cp .env.example .env          # Sesuaikan DATABASE_URL di .env
alembic upgrade head

# Isi data simulasi untuk frontend
python scripts/seed_data.py

# Jalankan server
python run.py
```
Backend API aktif di `http://localhost:5000/api` (CORS otomatis aktif untuk port frontend lokal).

### 2. Mengembangkan Frontend
1. Masuk ke direktori `frontend/`.
2. Arahkan base URL API ke `http://localhost:5000/api`.
3. Konsumsi endpoint yang telah disediakan sesuai dokumen [docs/api_specification.md](docs/api_specification.md).

---

## 📌 Ringkasan Skema Database (26 Tabel)

- **RBAC Dinamis:** `users`, `roles`, `permissions`, `user_roles`, `role_permissions`
- **Autentikasi:** `refresh_tokens` (SHA-256 hash), `external_identities` (OAuth/OIDC)
- **Master Data:** `organizational_units`, `locations`, `categories`, `borrowers` (**Peminjam tanpa akun**)
- **Inventaris:** `assets` (CHECK status & kondisi), `asset_history` (Append-only)
- **Transaksi:** `borrowings`, `borrowing_items`, `returns`, `return_items` (**ON DELETE RESTRICT**)
- **Insiden:** `damage_reports` (Repair lifecycle), `loss_reports`
- **Notifikasi Idempotent:** `notification_events` (`UNIQUE(borrowing, event)`), `notifications`, `notification_logs`, `email_deliveries`
- **Audit & Konfigurasi:** `audit_logs` (JSON snapshot), `system_settings`