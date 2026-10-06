# Arsitektur Monorepo & Integrasi SIIPB

Dokumen ini menjelaskan arsitektur sistem SIIPB dalam pola monorepo terpadu.

---

## 🏛️ Diagram Arsitektur Sistem

```text
┌─────────────────────────────────────────────────────────────┐
│                       KLIEN / PENGGUNA                      │
│      Petugas Sarpras, Admin, Pimpinan (Desktop / Mobile)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  FRONTEND LAYER (frontend/)                 │
│      Single Page Application (Vite / React / Vue / etc.)    │
│      Port: http://localhost:5173                            │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON REST API
                               │ CORS Enabled
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND LAYER (backend/)                  │
│      Flask 3.0 REST API Factory                             │
│      Port: http://localhost:5000/api                        │
│                                                             │
│      ├── api/         (Controllers & Route Blueprints)      │
│      ├── services/    (Transaction & Business Logic)        │
│      ├── models/      (SQLAlchemy 2.x Declarative Models)   │
│      └── alembic/     (Database Migration Engine)           │
└──────────────────────────────┬──────────────────────────────┘
                               │ PyMySQL / utf8mb4
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  DATABASE LAYER (database/)                 │
│      MariaDB 13 (InnoDB Engine)                             │
│                                                             │
│      ├── 26 Tables with CHECK Constraints                   │
│      ├── Master Data & RBAC (Users, Roles, Permissions)     │
│      ├── Peminjam Tanpa Akun (Borrowers)                    │
│      ├── Transaksi (Borrowings, Returns) - ON DELETE RESTRICT│
│      ├── Insiden (Damage Reports, Loss Reports)             │
│      ├── Idempotent Notifikasi (UNIQUE(borrowing, event))   │
│      └── Audit Trail & System Settings (JSON Validated)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Alur Integrasi Tim Frontend & Backend

1. **Backend Developer:**
   - Mengembangkan model & business logic di `backend/app/models/` dan `backend/app/services/`.
   - Mengelola perubahan skema melalui Alembic: `alembic revision --autogenerate` dan `alembic upgrade head`.
   - Menghasilkan endpoint REST di `backend/app/api/` sesuai spesifikasi di `docs/api_specification.md`.

2. **Frontend Developer:**
   - Membangun antarmuka di `frontend/`.
   - Menjalankan `python backend/scripts/seed_data.py` untuk mendapatkan dataset realistis di database lokal.
   - Menjalankan server backend `python backend/run.py`.
   - Menghubungkan HTTP client (Axios, Fetch, TanStack Query) ke `http://localhost:5000/api`.
   - Menikmati integrasi tanpa kendala CORS karena backend sudah mengizinkan origin lokal secara bawaan.
