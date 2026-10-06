# SIIPB Backend API

Service backend komprehensif berbasis Python 3.12+, Flask REST API, SQLAlchemy 2.x, MariaDB 13 existing database, Redis, Celery, dan JWT RBAC.

---

## 🛠️ Tech Stack

- **Framework:** Flask 3.0+ (Application Factory, Blueprints `/api/v1`)
- **Database ORM:** SQLAlchemy 2.0 (Declarative Mapping, strict row-locking `SELECT ... FOR UPDATE`)
- **Database Engine:** MariaDB 13.0 (26 production tables existing dari `database/SIIPB.sql`)
- **Migrations:** Alembic 1.13+ (Revision `f627cba678a2` dipertahankan)
- **Asynchronous Task Queue:** Celery 5.3+ & Celery Beat
- **Message Broker & Cache:** Redis 7.0+
- **Authentication & Security:** JWT (Access Token + SHA-256 Hashed Refresh Token), Argon2 / Scrypt, Authlib OAuth 2.0 / OIDC
- **Validation:** Marshmallow 3.20+
- **Documentation:** Flasgger Swagger UI (`/api/docs`)
- **Testing:** Pytest (Unit, Integration, & Concurrent Checkout Concurrency Testing)
- **Containerization:** Docker & Docker Compose dengan Nginx Reverse Proxy

---

## 📁 Struktur Direktori Backend

```text
backend/
├── app/
│   ├── __init__.py           # Flask App Factory (create_app), Swagger, CORS, error handling
│   ├── config.py             # Konfigurasi environment (DB, Redis, Celery, JWT, SMTP, MinIO)
│   ├── database.py           # Engine & SessionLocal SQLAlchemy 2.x
│   ├── extensions.py         # Inisialisasi Celery, Swagger (Flasgger), OAuth (Authlib)
│   ├── middleware/           # @jwt_required & @permission_required RBAC decorators
│   ├── models/               # 26 Tabel Model SQLAlchemy 2.x persis dengan SIIPB.sql
│   ├── routes/               # API v1 Blueprints:
│   │   ├── auth_routes.py    # /api/v1/auth (login, refresh, me, logout, google oauth)
│   │   ├── master_routes.py  # /api/v1 (units, categories, locations, borrowers)
│   │   ├── asset_routes.py   # /api/v1/assets (CRUD, history audit, photo upload)
│   │   ├── borrowing_routes.py # /api/v1/borrowings (checkout SELECT FOR UPDATE, list, detail)
│   │   ├── return_routes.py  # /api/v1/returns, /damage-reports, /loss-reports
│   │   ├── notification_routes.py # /api/v1/notifications & templates
│   │   ├── dashboard_routes.py    # /api/v1/dashboard/summary
│   │   ├── audit_routes.py   # /api/v1/audit-logs
│   │   └── upload_routes.py  # /api/v1/uploads (multipart photos/evidence)
│   ├── schemas/              # Marshmallow validation schemas
│   ├── services/             # Business logic layer (Checkout, Return, Audit, Notification)
│   ├── tasks/                # Celery background & scheduled tasks
│   │   ├── email_tasks.py    # Asynchronous SMTP worker dengan exponential backoff
│   │   └── scheduler_tasks.py # Celery Beat H-3, H-1, H, Overdue H+1, H+3, H+7 reminders
│   └── utils/                # Standard response formatters & security helpers
├── tests/                    # Automated Pytest Suite
│   ├── conftest.py           # Fixtures (client, db_session, auth_headers)
│   ├── test_auth.py          # Pengujian login, token refresh, RBAC
│   ├── test_assets.py        # Pengujian inventaris & duplicate checks
│   ├── test_borrowing.py     # Pengujian checkout workflow & tanggal
│   ├── test_concurrent_checkout.py # Concurrency test: row locking mencegah double lending
│   ├── test_returns.py       # Pengujian return BAIK, RUSAK, siklus perbaikan
│   └── test_master.py        # Pengujian master data & live dashboard stats
├── celery_app.py             # Celery worker & beat schedule entrypoint
├── Dockerfile                # Multi-stage production container
├── requirements.txt          # Dependensi Python backend
└── run.py                    # Server development runner (port 5000)
```

---

## 🚀 Panduan Menjalankan Backend Secara Lokal

### 1. Setup Virtual Environment & Install Dependensi
```powershell
python -m venv .venv
.\.venv\Scripts\activate      # Windows PowerShell
pip install -r requirements.txt
```

### 2. Konfigurasi Lingkungan (`.env`)
Salin berkas `.env.example` ke `.env`:
```powershell
cp .env.example .env
```
Pastikan `DATABASE_URL` mengarah ke MariaDB:
```env
DATABASE_URL=mariadb+pymysql://root:123@127.0.0.1:3306/siipb?charset=utf8mb4
PORT=5000
```

### 3. Menjalankan Server API
```powershell
python run.py
```
- API Base: `http://localhost:5000/api/v1`
- Swagger Docs: `http://localhost:5000/api/docs`
- Health Check: `http://localhost:5000/api/health`

### 4. Menjalankan Background Worker (Celery & Celery Beat)
```powershell
# Terminal 1: Celery Worker
celery -A celery_app.celery worker --loglevel=info

# Terminal 2: Celery Beat Scheduler
celery -A celery_app.celery beat --loglevel=info
```

### 5. Menjalankan Automated Test Suite
```powershell
pytest -v
```
Seluruh 16 skenario pengujian termasuk simulasi multithreading concurrency row locking (`SELECT ... FOR UPDATE`) akan dieksekusi secara otomatis.

---

## 🐳 Menjalankan dengan Docker & Docker Compose

Jalankan seluruh stack (MariaDB, Redis, Flask API, Celery Worker, Celery Beat, dan Nginx) dengan satu perintah:

```powershell
docker compose up -d --build
```
Aplikasi akan langsung dapat diakses pada port 80:
- API: `http://localhost/api/v1`
- Swagger UI: `http://localhost/api/docs`
- Static Uploads: `http://localhost/uploads/`
