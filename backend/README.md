# SIIPB Backend API

Service backend berbasis Python (Flask) dan SQLAlchemy 2.x dengan MariaDB 13.

---

## 🛠️ Tech Stack

- **Framework:** Flask 3.0+ (REST API Factory dengan CORS)
- **Database ORM:** SQLAlchemy 2.0 (Modern 2.x Declarative Mapping)
- **Migrations:** Alembic 1.13+
- **Database Engine:** MariaDB 13.0 (InnoDB, `utf8mb4_unicode_ci`)
- **Driver:** PyMySQL 1.1+

---

## 📁 Struktur Direktori Backend

```text
backend/
├── app/
│   ├── __init__.py           # Flask App Factory (create_app) & CORS setup
│   ├── config.py             # Konfigurasi environment (DATABASE_URL, JWT, CORS)
│   ├── database.py           # Engine & SessionLocal SQLAlchemy
│   ├── api/                  # REST API Blueprints (health, auth, assets, dll.)
│   │   ├── __init__.py       # Health check /api/health
│   │   ├── assets.py         # /api/assets (Katalog & pencarian inventaris)
│   │   └── auth.py           # /api/auth (Login & Token)
│   ├── models/               # 26 Tabel Model SQLAlchemy 2.x
│   └── services/             # Business Logic Layer (Checkout, Return, Audit)
├── alembic/                  # Script versi migrasi skema
├── scripts/
│   ├── seed_data.py          # Seeder data awal untuk pengujian FE & BE
│   └── verify_schema.py      # Automated schema & business rule test suite
├── alembic.ini               # Konfigurasi Alembic
├── requirements.txt          # Dependensi Python
├── run.py                    # Server development runner (port 5000)
└── .env.example              # Template variabel lingkungan
```

---

## 🚀 Panduan Menjalankan Backend

### 1. Setup Virtual Environment & Install Dependensi
```bash
python -m venv .venv
.\.venv\Scripts\activate      # Windows PowerShell
pip install -r requirements.txt
```

### 2. Konfigurasi Lingkungan (`.env`)
Salin berkas `.env.example` ke `.env`:
```bash
cp .env.example .env
```
Sesuaikan kredensial MariaDB di `.env`:
```env
DATABASE_URL=mariadb+pymysql://root:password@127.0.0.1:3306/siipb?charset=utf8mb4
PORT=5000
```

### 3. Migrasi & Seed Data Awal
```bash
# Eksekusi migrasi tabel ke database MariaDB
alembic upgrade head

# Isi data awal (Users, Roles, Categories, Locations, Assets, Borrowers)
python scripts/seed_data.py
```

### 4. Jalankan Dev Server API
```bash
python run.py
```
API akan aktif pada: `http://localhost:5000/api`
- Health check: `http://localhost:5000/api/health`
- Katalog Aset : `http://localhost:5000/api/assets`
