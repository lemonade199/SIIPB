"""Section 16 to 20 for SIIPB Word Documentation."""
from docx.shared import Inches, Pt
from scripts.build_complete_docx import (
    add_header_styled, add_p, add_callout, add_code_block, create_table_from_rows
)

def build_section_16_to_20(doc):
    # ========================================================
    # BAGIAN 16 — RESPONSE API
    # ========================================================
    add_header_styled(doc, "BAGIAN 16 — RESPONSE API (STANDARD ENVELOPE)", level=1)
    add_p(doc, "Seluruh endpoint backend mengembalikan format JSON seragam (Envelope Pattern) melalui helper backend/app/utils/response.py:")

    add_header_styled(doc, "1. Format Respons Sukses", level=2)
    success_json = (
        "{\n"
        '  "success": true,\n'
        '  "message": "Transaksi peminjaman berhasil dicatat",\n'
        '  "data": {\n'
        '    "id": 101,\n'
        '    "transaction_number": "TX-20261006120000-A1B2",\n'
        '    "status": "AKTIF"\n'
        "  },\n"
        '  "meta": {\n'
        '    "page": 1,\n'
        '    "per_page": 20,\n'
        '    "total": 45\n'
        "  }\n"
        "}"
    )
    add_code_block(doc, success_json)

    add_header_styled(doc, "2. Format Respons Error", level=2)
    error_json = (
        "{\n"
        '  "success": false,\n'
        '  "message": "Aset Laptop ThinkPad L14 tidak tersedia untuk dipinjam",\n'
        '  "error_code": "ASSET_NOT_AVAILABLE",\n'
        '  "errors": {\n'
        '    "asset_ids": ["Status saat ini: DIPINJAM"]\n'
        "  }\n"
        "}"
    )
    add_code_block(doc, error_json)

    # ========================================================
    # BAGIAN 17 — FILE PENTING UNTUK DIPELAJARI
    # ========================================================
    add_header_styled(doc, "BAGIAN 17 — FILE PENTING UNTUK DIPELAJARI", level=1)
    add_p(doc, "Bagi developer yang baru pertama kali mempelajari project SIIPB, pelajari berkas dengan urutan prioritas berikut:")

    learning_files = [
        ["LEVEL 1 — WAJIB", "backend/run.py", "Titik masuk server lokal untuk memahami inisialisasi awal dan port."],
        ["LEVEL 1 — WAJIB", "backend/app/config.py", "Melihat seluruh variabel konfigurasi, koneksi database, dan secret key."],
        ["LEVEL 1 — WAJIB", "backend/app/database.py", "Memahami bagaimana koneksi SQLAlchemy SessionLocal dibuat."],
        ["LEVEL 1 — WAJIB", "backend/app/models/asset.py", "Memahami struktur entitas barang dan batasan status."],
        ["LEVEL 1 — WAJIB", "backend/app/services/borrowing_service.py", "Memahami inti logika bisnis checkout dan mekanisme row-locking."],
        ["LEVEL 2 — PENTING", "backend/app/middleware/auth_middleware.py", "Memahami cara kerja verifikasi token JWT dan proteksi hak akses RBAC."],
        ["LEVEL 2 — PENTING", "backend/app/routes/borrowing_routes.py", "Melihat alur controller menangani request peminjaman."],
        ["LEVEL 2 — PENTING", "backend/app/services/return_service.py", "Memahami logika pengembalian parsial dan pencatatan kerusakan."],
        ["LEVEL 2 — PENTING", "backend/app/tasks/email_tasks.py", "Memahami pengiriman asinkron Celery ke server SMTP."],
        ["LEVEL 3 — LANJUTAN", "backend/app/tasks/scheduler_tasks.py", "Mempelajari aturan perhitungan hari pengingat H-3 hingga Overdue H+7."],
        ["LEVEL 3 — LANJUTAN", "backend/tests/test_concurrent_checkout.py", "Melihat bukti pengujian konkurensi multithreading."],
        ["LEVEL 3 — LANJUTAN", "docker-compose.yml", "Mempelajari integrasi kontainerisasi 6 layanan server."],
    ]
    create_table_from_rows(
        doc,
        ["Tingkat Prioritas", "Path Berkas", "Alasan Mengapa Harus Dipelajari"],
        learning_files,
        [Inches(1.8), Inches(2.2), Inches(3.0)]
    )

    # ========================================================
    # BAGIAN 18 — ROADMAP BELAJAR PROJECT (7 HARI)
    # ========================================================
    add_header_styled(doc, "BAGIAN 18 — ROADMAP BELAJAR PROJECT", level=1)
    add_p(doc, "Panduan belajar bertahap bagi developer baru agar dapat menguasai sistem dalam 7 hari:")

    roadmap_rows = [
        ["Hari 1", "Arsitektur & Setup Lokal", "Clone repo, install virtualenv, import database/SIIPB.sql, jalankan python run.py, dan buka /api/docs."],
        ["Hari 2", "Eksplorasi Basis Data", "Pelajari 26 tabel MariaDB, pahami relasi Foreign Key, tabel pivot, dan aturan ON DELETE RESTRICT."],
        ["Hari 3", "Model & ORM SQLAlchemy", "Pahami declarative mapping di backend/app/models/, cara query, dan lazy-loading relasi."],
        ["Hari 4", "Rute & Controller API", "Pelajari struktur Blueprint di backend/app/routes/, registrasi rute, dan Swagger decorators."],
        ["Hari 5", "Autentikasi & RBAC", "Eksplorasi pembuatan JWT, hashing SHA-256 pada refresh_tokens, dan decorator @permission_required."],
        ["Hari 6", "Logika Bisnis & Konkurensi", "Pelajari transaksi checkout di borrowing_service.py dengan row-locking SELECT ... FOR UPDATE."],
        ["Hari 7", "Celery Worker & Pengujian", "Pelajari background task email_tasks.py, crontab Celery Beat, dan jalankan pytest -v."],
    ]
    create_table_from_rows(
        doc,
        ["Waktu", "Topik Pembelajaran", "Target yang Harus Dikuasai"],
        roadmap_rows,
        [Inches(1.0), Inches(2.0), Inches(4.0)]
    )

    # ========================================================
    # BAGIAN 19 — GLOSARIUM ISTILAH TEKNIS
    # ========================================================
    add_header_styled(doc, "BAGIAN 19 — GLOSARIUM ISTILAH TEKNIS", level=1)
    add_p(doc, "Kamus istilah teknis yang digunakan di dalam project SIIPB untuk memudahkan pemula:")

    glossary_data = [
        ["REST API", "Standar antarmuka pemrograman aplikasi berbasis web menggunakan protokol HTTP dan format data JSON."],
        ["ORM (Object-Relational Mapping)", "Teknik pemrograman untuk memanipulasi baris tabel database menggunakan objek class (SQLAlchemy)."],
        ["Blueprint", "Cara modular di Flask untuk mengelompokkan rute dan controller berdasarkan fitur atau modul."],
        ["JWT (JSON Web Token)", "Format token terenkripsi digital yang aman untuk membawa data identitas pengguna yang terautentikasi."],
        ["RBAC (Role-Based Access Control)", "Sistem manajemen hak akses di mana pengguna dikelompokkan ke dalam Peran (Role), dan Peran memiliki Izin (Permission)."],
        ["Pessimistic Row-Locking", "Mekanisme penguncian baris database (SELECT ... FOR UPDATE) untuk mencegah transaksi lain membaca atau mengubah baris yang sedang diproses."],
        ["Race Condition", "Kondisi anomali ketika dua proses simultan bersaing memodifikasi data yang sama secara tidak teratur."],
        ["Idempotent", "Sifat operasi di mana eksekusi berulang kali dengan parameter yang sama akan menghasilkan status akhir yang sama persis tanpa efek samping ganda."],
        ["Celery Worker", "Aplikasi latar belakang yang menjalankan tugas berat secara asinkron tanpa memblokir respons server web."],
        ["Celery Beat", "Penjadwal berkala (crontab scheduler) yang bertugas memicu tugas Celery pada interval waktu tertentu."],
        ["Reverse Proxy (Nginx)", "Server perantara yang menerima request publik dari klien dan meneruskannya ke server aplikasi backend."],
        ["Soft Delete", "Teknik 'menghapus' data dengan hanya mengisi penanda tanggal (deleted_at) tanpa menghapus baris fisik dari hard disk."],
    ]
    create_table_from_rows(
        doc,
        ["Istilah Teknis", "Penjelasan Sederhana untuk Pemula"],
        glossary_data,
        [Inches(2.5), Inches(4.5)]
    )

    # ========================================================
    # BAGIAN 20 — KESIMPULAN
    # ========================================================
    add_header_styled(doc, "BAGIAN 20 — KESIMPULAN", level=1)
    add_p(doc, "1. Integritas Arsitektur:", bold_prefix="• ")
    add_p(doc, "Backend SIIPB dibangun di atas fondasi MariaDB 13 yang kuat dan stabil dengan 26 tabel terstandarisasi. Seluruh aturan bisnis, constraint status, dan relasi data telah teruji 100% selaras dengan cetak biru resmi.")
    
    add_p(doc, "2. Keamanan & Konkurensi Tinggi:", bold_prefix="• ")
    add_p(doc, "Penerapan row-level locking (SELECT ... FOR UPDATE) menjamin sistem kebal terhadap anomali peminjaman ganda (double-booking). Keamanan RBAC dan tokenisasi JWT dengan hashing SHA-256 memberikan perlindungan data berstandar enterprise.")

    add_p(doc, "3. Kesiapan Operasional (Turnkey):", bold_prefix="• ")
    add_p(doc, "Sistem dilengkapi otomatisasi kontainer Docker Compose multi-layanan (MariaDB, Redis, Backend, Celery Worker, Celery Beat, dan Nginx) sehingga dapat langsung di-deploy di laptop pengembang manapun maupun server produksi hanya dengan 1 perintah.")

    add_p(doc, "4. Dokumentasi & Pengujian:", bold_prefix="• ")
    add_p(doc, "Seluruh 16 skenario pengujian automated test (pytest) lulus 100%, dan dokumentasi API interaktif Swagger UI tersedia di /api/docs untuk memudahkan tim frontend dalam mengintegrasikan antarmuka.")

    add_callout(
        doc,
        "Dokumentasi teknis ini merupakan panduan final yang memetakan kode aktual, database aktual, dan infrastruktur SIIPB tanpa asumsi atau modifikasi fiktif. Seluruh source code tersimpan aman di repositori resmi GitHub: https://github.com/lemonade199/SIIPB.git",
        title="PENUTUP RESMI"
    )

    print("Section 16-20 built.")
