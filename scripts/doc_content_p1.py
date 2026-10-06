"""Section 1 to 5 for SIIPB Word Documentation with complete 27-table dictionary."""
from docx.shared import Inches, Pt, RGBColor
from scripts.build_complete_docx import (
    add_header_styled, add_p, add_callout, add_code_block, create_table_from_rows, COLOR_PRIMARY
)
from scripts.generate_table_dictionaries import get_all_tables_metadata

TABLE_DESCRIPTIONS = {
    "alembic_version": "Menyimpan catatan nomor revisi migrasi skema basis data Alembic yang aktif (f627cba678a2).",
    "users": "Menyimpan data akun pengguna internal sistem yang memiliki akses masuk (Admin, Petugas Sarpras, Pimpinan).",
    "roles": "Master data peran pengguna untuk mengelompokkan wewenang (ADMIN, SARPRAS, PIMPINAN).",
    "permissions": "Master data hak akses atomik untuk membatasi aksi pada modul tertentu (misal: asset.create, borrowing.checkout).",
    "user_roles": "Tabel pivot penghubung Many-to-Many antara tabel users dan roles.",
    "role_permissions": "Tabel pivot penghubung Many-to-Many antara tabel roles dan permissions.",
    "refresh_tokens": "Menyimpan token penyegar sesi JWT dalam bentuk hash SHA-256 (64 hex characters) demi keamanan tingkat tinggi.",
    "external_identities": "Menyimpan identitas akun Single Sign-On (SSO) pihak ketiga seperti Google OAuth 2.0 / OpenID Connect.",
    "organizational_units": "Master data unit kerja, departemen, atau divisi pemilik dan peminjam barang (struktur hierarkis parent-child).",
    "categories": "Kategori klasifikasi barang inventaris (misalnya: Elektronik, Laboratorium, Furnitur, Kendaraan).",
    "locations": "Master data lokasi fisik penempatan barang (Gedung, Lantai, Ruangan, Lemari/Rak).",
    "borrowers": "Master data peminjam barang (Guru, Karyawan, Siswa) yang TIDAK MEMILIKI AKUN LOGIN ke dalam sistem.",
    "assets": "Tabel utama aset inventaris yang mencatat spesifikasi, serial number, lokasi fisik, kondisi, dan status ketersediaan barang.",
    "asset_history": "Buku jurnal audit pergerakan aset yang mencatat kronologi mutasi status, lokasi, penanggung jawab, dan kondisi fisik barang.",
    "borrowings": "Header transaksi peminjaman barang yang mencatat nomor transaksi unik, peminjam, petugas, tanggal pinjam, dan batas pengembalian.",
    "borrowing_items": "Detail barang-barang fisik yang dipinjam dalam satu nomor transaksi peminjaman.",
    "returns": "Header transaksi pengembalian barang yang diterima dan diverifikasi oleh petugas Sarpras/IT.",
    "return_items": "Detail penerimaan barang kembali yang mencatat hasil evaluasi kondisi fisik barang (BAIK, RUSAK, atau HILANG).",
    "damage_reports": "Laporan insiden kerusakan barang akibat peminjaman, mencatat tingkat keparahan, alur perbaikan, dan biaya reparasi.",
    "loss_reports": "Laporan resmi kehilangan aset saat peminjaman beserta tindakan investigasi atau ganti rugi yang diputuskan.",
    "notification_templates": "Template pesan email otomatis (H-3, H-1, H, Overdue) yang memuat placeholder variabel dinamis.",
    "notification_events": "Tabel pencegahan duplikasi (idempoten) untuk memastikan notifikasi yang sama tidak dikirimkan berulang kali.",
    "notifications": "Antrean pengiriman notifikasi yang membekukan snapshot isi pesan email (body_snapshot) agar data historis tidak berubah.",
    "notification_logs": "Catatan log status antrean pengiriman pesan (QUEUED, SENT, FAILED).",
    "email_deliveries": "Catatan teknis per-percobaan pengiriman email ke server SMTP (mencatat kode error, message ID, dan waktu pengiriman).",
    "audit_logs": "Jejak audit trail append-only yang merekam pelaku, alamat IP, user agent, serta data sebelum dan sesudah perubahan dalam format JSON.",
    "system_settings": "Tabel konfigurasi parameter sistem terpusat berbasis pasangan kunci dan nilai (key-value store).",
}

def build_section_1_to_5(doc):
    # ========================================================
    # COVER PAGE
    # ========================================================
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(36)
    p_title.paragraph_format.space_after = Pt(8)
    p_title.alignment = 1  # Center
    r_t = p_title.add_run("PANDUAN LENGKAP ARSITEKTUR BACKEND & BASIS DATA SIIPB")
    r_t.font.size = Pt(20)
    r_t.font.bold = True
    r_t.font.color.rgb = COLOR_PRIMARY

    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(20)
    p_sub.alignment = 1
    r_s = p_sub.add_run("Sistem Informasi Inventaris Barang, Peminjaman, dan Pengembalian Barang\nDokumentasi Teknis Komprehensif Berbasis MariaDB 13 & Flask REST API")
    r_s.font.size = Pt(11)
    r_s.font.italic = True

    add_callout(
        doc,
        "Dokumen ini disusun khusus sebagai referensi resmi pemahaman arsitektur backend, perancangan database 26 tabel, logika bisnis transaksi, kontrol konkurensi (row-locking), keamanan RBAC, dan integrasi API untuk pengembang, arsitek sistem, dan pimpinan proyek.",
        title="DOKUMEN TEKNIS RESMI"
    )

    p_meta = doc.add_paragraph()
    p_meta.paragraph_format.space_before = Pt(14)
    p_meta.paragraph_format.space_after = Pt(24)
    p_meta.alignment = 1
    r_m = p_meta.add_run("Versi Dokumen: 1.0.0 (Production Ready)\nTarget Audiens: Pengembang Pemula hingga Senior, Pimpinan Proyek\nStack Utama: Python 3.12, Flask, MariaDB 13, SQLAlchemy 2.0, Celery, Redis, Nginx, Docker\nTanggal Rilis: Oktober 2026")
    r_m.font.size = Pt(9)

    doc.add_page_break()

    # ========================================================
    # DAFTAR ISI RINGKAS
    # ========================================================
    add_header_styled(doc, "DAFTAR ISI DOKUMEN", level=1)
    toc_items = [
        ["BAGIAN 1", "Gambaran Besar Project (Tujuan, Masalah, & Teknologi)"],
        ["BAGIAN 2", "Struktur Folder Backend (Organisasi Kode & Interaksi Modul)"],
        ["BAGIAN 3", "Database (Spesifikasi MariaDB, Konfigurasi Pool, & Engine)"],
        ["BAGIAN 4", "Daftar Semua Tabel (Analisis Detail 27 Tabel & Kamus Data Lengkap)"],
        ["BAGIAN 5", "Relasi Database (Hubungan 1:1, 1:N, N:M, Pivot Table, & ERD)"],
        ["BAGIAN 6", "Model / ORM (SQLAlchemy 2.x Declarative Mapping & Relationship)"],
        ["BAGIAN 7", "API / Routes (Katalog 46 Endpoint REST API v1)"],
        ["BAGIAN 8", "Controller / Route Handlers (Logika Penanganan HTTP Request)"],
        ["BAGIAN 9", "Authentication & Authorization (JWT, OAuth 2.0, & RBAC Multi-Peran)"],
        ["BAGIAN 10", "Validation (Validasi Input Payload dengan Marshmallow)"],
        ["BAGIAN 11", "Business Logic (Kontrol Konkurensi Row Locking & Siklus Aset)"],
        ["BAGIAN 12", "CRUD (Create, Read, Update, Delete per Modul)"],
        ["BAGIAN 13", "Alur Fitur Utama (Peminjaman, Pengembalian, Keterlambatan, Insiden)"],
        ["BAGIAN 14", "Contoh Data Dummy (Visualisasi Data Riil per Entitas)"],
        ["BAGIAN 15", "Error Handling (Penanganan Eksepsi & Status Code HTTP)"],
        ["BAGIAN 16", "Response API (Standardisasi Format JSON Envelope)"],
        ["BAGIAN 17", "File Penting untuk Dipelajari (Level 1, Level 2, Level 3)"],
        ["BAGIAN 18", "Roadmap Belajar Project (Panduan 7 Hari untuk Pengembang Baru)"],
        ["BAGIAN 19", "Glosarium Istilah Teknis (Kamus Istilah untuk Pemula)"],
        ["BAGIAN 20", "Kesimpulan (Rangkuman Akhir Kesiapan Sistem)"],
    ]
    create_table_from_rows(doc, ["Bagian", "Topik Pembahasan"], toc_items, [1.5, 5.0])

    doc.add_page_break()

    # ========================================================
    # BAGIAN 1 — GAMBARAN BESAR PROJECT
    # ========================================================
    add_header_styled(doc, "BAGIAN 1 — GAMBARAN BESAR PROJECT", level=1)
    add_p(doc, "SIIPB (Sistem Informasi Inventaris Barang, Peminjaman, dan Pengembalian Barang)", bold_prefix="Nama Project: ")
    add_p(doc, "Sistem informasi terintegrasi untuk membantu petugas Sarpras/IT dalam melakukan pencatatan inventaris barang, sirkulasi peminjaman, verifikasi pengembalian, pemantauan batas jatuh tempo, otomasi notifikasi email, audit trail pergerakan aset, dan pelaporan eksekutif.", bold_prefix="Tujuan Project: ")
    add_p(doc, "Pada sistem konvensional, peminjaman barang inventaris kantor/sekolah sering mengalami masalah: pencatatan di buku manual mudah hilang, barang lambat dikembalikan karena lupa, kesulitan mengetahui lokasi fisik barang secara instan, peminjaman ganda pada aset yang sama (double booking), serta ketiadaan rekam jejak saat barang dikembalikan dalam kondisi rusak atau hilang.", bold_prefix="Masalah yang Diselesaikan: ")
    add_p(doc, "Aplikasi Web Enterprise berbasis REST API (Backend Python Flask) yang melayani antarmuka pengguna SPA (Single Page Application Next.js / React) serta siap diakses multi-perangkat melalui jaringan lokal maupun internet.", bold_prefix="Jenis Aplikasi: ")

    add_header_styled(doc, "Tabel Komponen Teknologi Project", level=2)
    tech_rows = [
        ["Bahasa Pemrograman", "Python 3.12+", "Bahasa utama backend, berkecepatan tinggi, aman, dan kaya ekosistem."],
        ["Framework Backend", "Flask 3.0+", "Micro-framework ringan dan modular dengan pola Application Factory & Blueprints."],
        ["Database Engine", "MariaDB 13.0 (InnoDB)", "RDBMS berstandar enterprise dengan dukungan transaksi ACID dan row-level locking."],
        ["ORM", "SQLAlchemy 2.0", "Object-Relational Mapping modern dengan mapping tipe data deklaratif."],
        ["Skema Migrasi", "Alembic 1.13+", "Version control skema database untuk menjamin integritas revisi f627cba678a2."],
        ["Autentikasi", "JWT (PyJWT) + OAuth 2.0 (Authlib)", "Access token stateless dan refresh token ter-hash SHA-256 serta SSO Google OIDC."],
        ["Otorisasi", "RBAC (Role-Based Access Control)", "Pembagian hak akses berbasis Role (ADMIN, SARPRAS, PIMPINAN) dan 10 Permission."],
        ["Message Broker", "Redis 7.0 (Alpine)", "Penyimpanan antrean in-memory berkecepatan mikrodetik."],
        ["Background Job", "Celery 5.3+", "Worker asinkron untuk pengiriman email SMTP tanpa menghambat respons HTTP."],
        ["Scheduler", "Celery Beat", "Penjadwal otomatis pengecekan jatuh tempo harian pada pukul 08:00 WIB."],
        ["Dokumentasi API", "OpenAPI / Swagger (Flasgger)", "Dokumentasi interaktif otomatis pada rute /api/docs."],
        ["Penyimpanan Berkas", "MinIO / S3 Storage + Local", "Penyimpanan foto fisik aset dan bukti insiden kerusakan."],
        ["Web Server & Proxy", "Nginx 1.25", "Reverse proxy gerbang utama, kompresi Gzip, proteksi rate-limit, dan caching."],
        ["Kontainerisasi", "Docker & Docker Compose", "Pengemasan seluruh stack menjadi kontainer mandiri siap jalan."],
    ]
    create_table_from_rows(doc, ["Komponen", "Teknologi", "Fungsi & Peran"], tech_rows, [1.8, 2.2, 2.5])

    add_header_styled(doc, "Arsitektur Alur Sistem (Flow of Control)", level=2)
    add_p(doc, "Arsitektur backend SIIPB mengadopsi pola berlapis (Layered Architecture) yang memisahkan tanggung jawab secara tegas:")
    flow_text = (
        "Pengguna / Perangkat Lain (Browser / HP)\n"
        "   ↓ (HTTP Request)\n"
        "Nginx Reverse Proxy (:80)\n"
        "   ↓ (Proxy Pass ke :5000)\n"
        "Flask Application Factory (create_app)\n"
        "   ↓ (Routing Blueprint /api/v1/...)\n"
        "Middleware Auth & RBAC (@jwt_required, @permission_required)\n"
        "   ↓ (Validasi Input)\n"
        "Marshmallow Schema (Validation Layer)\n"
        "   ↓ (Eksekusi Aturan Bisnis)\n"
        "Service Layer (Row-Locking SELECT FOR UPDATE, Audit, Event Scheduler)\n"
        "   ↓ (Model Query & Persistensi)\n"
        "SQLAlchemy 2.0 Models\n"
        "   ↓ (SQL Execution via PyMySQL)\n"
        "MariaDB 13 Database (siipb)\n"
        "   ↓ (Background Queue via Redis)\n"
        "Celery Worker & Celery Beat (SMTP Email Delivery)"
    )
    add_code_block(doc, flow_text)

    # ========================================================
    # BAGIAN 2 — STRUKTUR FOLDER BACKEND
    # ========================================================
    add_header_styled(doc, "BAGIAN 2 — STRUKTUR FOLDER BACKEND", level=1)
    add_p(doc, "Struktur folder backend dirancang modular di dalam direktori backend/app/ untuk memastikan skalabilitas, kemudahan pemeliharaan, dan pemisahan logika:")

    folder_rows = [
        ["backend/app/__init__.py", "Application Factory", "Menginisialisasi Flask app, mengaktifkan CORS, mendaftarkan ekstensi Swagger dan OAuth, serta meregistrasikan seluruh Blueprint API v1."],
        ["backend/app/config.py", "Konfigurasi Sistem", "Memuat variabel lingkungan (.env) seperti kredensial MariaDB, Redis URL, JWT TTL, SMTP email, dan S3 storage."],
        ["backend/app/database.py", "Koneksi Database", "Menyediakan SQLAlchemy Engine dan SessionLocal dengan pool_pre_ping=True untuk koneksi database yang tahan putus."],
        ["backend/app/extensions.py", "Ekstensi Eksternal", "Inisialisasi objek Celery, Flasgger (Swagger UI), dan Authlib (OAuth 2.0)."],
        ["backend/app/middleware/", "Pemeriksa Hak Akses", "Berisi auth_middleware.py dengan decorator @jwt_required dan @permission_required(*perms) untuk otorisasi RBAC."],
        ["backend/app/models/", "Definisi Skema Database", "Berisi 24 berkas model SQLAlchemy 2.x yang memetakan persis 26 tabel database MariaDB existing."],
        ["backend/app/routes/", "Controller & Endpoint", "Berisi 9 berkas Blueprint REST API v1 (auth, master, assets, borrowings, returns, notifications, dashboard, audit, uploads)."],
        ["backend/app/schemas/", "Validasi Input", "Berisi skema Marshmallow untuk memvalidasi tipe data, format string, rentang tanggal, dan batasan enum."],
        ["backend/app/services/", "Lapisan Logika Bisnis", "Jantung bisnis sistem: checkout_borrowing (dengan row-locking), process_return, damage_loss, audit_service, dan notification_service."],
        ["backend/app/tasks/", "Pekerjaan Asinkron", "Berisi email_tasks.py (pengiriman SMTP dengan retry exponential backoff) dan scheduler_tasks.py (pengingat jatuh tempo berkala)."],
        ["backend/app/utils/", "Utilitas Pembantu", "Berisi security.py (hashing password dan token) dan response.py (standardisasi format JSON success dan error)."],
        ["backend/tests/", "Suite Pengujian", "Berisi 7 berkas pytest otomatis, termasuk pengujian konkurensi multithreading checkout secara simultan."],
        ["backend/run.py", "Server Runner", "Titik masuk eksekusi server development yang otomatis mendeteksi dan menampilkan IP LAN untuk perangkat lain."],
        ["backend/celery_app.py", "Celery Entrypoint", "Titik masuk eksekusi Celery Worker dan konfigurasi crontab jadwal Celery Beat."],
    ]
    create_table_from_rows(doc, ["Folder / Berkas", "Fungsi", "Pentingnya bagi Sistem"], folder_rows, [2.0, 1.8, 2.7])

    # ========================================================
    # BAGIAN 3 — DATABASE
    # ========================================================
    add_header_styled(doc, "BAGIAN 3 — DATABASE", level=1)
    add_p(doc, "Backend SIIPB dibangun di atas basis data existing yang telah disediakan pada berkas database/SIIPB.sql. Sistem tidak merancang ulang skema atau membuat database baru dari nol, melainkan menyesuaikan ORM dan service layer agar selaras sempurna dengan struktur yang ada.")

    db_specs = [
        ["DBMS", "MariaDB Server (Versi 13.0.2 / Kompatibel 10.11+ dan 11.4)"],
        ["Nama Database", "siipb"],
        ["Storage Engine", "InnoDB (Dukungan penuh Foreign Key, ACID, dan Row-Level Locking)"],
        ["Default Charset", "utf8mb4"],
        ["Default Collation", "utf8mb4_unicode_ci (Mendukung karakter internasional dan emoji secara aman)"],
        ["Host Default", "127.0.0.1 (Lokal) atau mariadb (di dalam jaringan Docker Compose)"],
        ["Port Default", "3306"],
        ["Connection Pool Size", "10 koneksi dasar dengan max_overflow=20 (SQLAlchemy Engine)"],
        ["Pool Recycle", "3600 detik (1 jam) untuk mencegah koneksi MySQL timeout/stale"],
        ["Pre-Ping Healthcheck", "Aktif (pool_pre_ping=True) untuk memverifikasi keaktifan koneksi sebelum query"],
        ["Alembic Migration Version", "f627cba678a2 (Tercatat pada tabel alembic_version)"],
    ]
    create_table_from_rows(doc, ["Parameter Basis Data", "Nilai & Konfigurasi Aktual"], db_specs, [2.5, 4.0])

    add_callout(
        doc,
        "Seluruh kata sandi, secret key JWT, dan token sensitif TIDAK BOLEH ditulis langsung di dalam kode, melainkan dikonfigurasi melalui berkas .env menggunakan variabel lingkungan DATABASE_URL.",
        title="KEAMANAN KREDENSIAL"
    )

    # ========================================================
    # BAGIAN 4 — DAFTAR SEMUA TABEL
    # ========================================================
    add_header_styled(doc, "BAGIAN 4 — DAFTAR SEMUA TABEL (KAMUS DATA LENGKAP)", level=1)
    add_p(doc, "Database SIIPB memiliki total 27 tabel fisik yang diekstraksi langsung dari MariaDB information_schema dan database/SIIPB.sql. Berikut adalah rincian struktur kolom, tipe data, indeks, default value, dan fungsi dari masing-masing tabel:")

    metadata = get_all_tables_metadata()
    table_index = 1
    for tname, tinfo in metadata.items():
        desc = TABLE_DESCRIPTIONS.get(tname, "Tabel pendukung sistem inventaris SIIPB.")
        add_header_styled(doc, f"4.{table_index} Tabel: {tname}", level=2)
        add_p(doc, desc, bold_prefix="Fungsi Tabel: ")

        # Foreign keys summary
        fks = tinfo["foreign_keys"]
        if fks:
            fk_str = ", ".join([f"{fk[0]} -> {fk[1]}({fk[2]})" for fk in fks])
            add_p(doc, fk_str, bold_prefix="Foreign Key & Relasi: ")
        else:
            add_p(doc, "Tidak ada foreign key keluar (Tabel master / independen).", bold_prefix="Foreign Key: ")

        cols = tinfo["columns"]
        col_rows = []
        for idx, c in enumerate(cols):
            c_name = c[0]
            c_type = c[1]
            c_nullable = "YA" if c[2] == "YES" else "TIDAK"
            c_key = c[3] or "-"
            c_def = str(c[4]) if c[4] is not None else "-"
            c_extra = c[5] or ""
            
            keterangan = []
            if c_key == "PRI":
                keterangan.append("Primary Key")
            if c_key == "UNI":
                keterangan.append("Unique Value")
            if c_key == "MUL":
                keterangan.append("Indexed / FK")
            if c_extra:
                keterangan.append(c_extra)
            ket_str = ", ".join(keterangan) if keterangan else "Atribut data"

            col_rows.append([idx + 1, c_name, c_type, c_nullable, c_key, c_def, ket_str])

        create_table_from_rows(
            doc,
            ["No", "Kolom", "Tipe Data", "Nullable", "Key", "Default", "Keterangan"],
            col_rows,
            [0.4, 1.4, 1.4, 0.7, 0.6, 0.8, 1.2]
        )
        table_index += 1

    # ========================================================
    # BAGIAN 5 — RELASI DATABASE
    # ========================================================
    add_header_styled(doc, "BAGIAN 5 — RELASI DATABASE & ERD", level=1)
    add_p(doc, "Seluruh tabel dihubungkan oleh relasi relasional ketat menggunakan batasan Foreign Key dengan aturan aksi ON DELETE RESTRICT (untuk data transaksi berharga) atau ON DELETE CASCADE (untuk relasi pivot dan token):")

    add_header_styled(doc, "1. Relasi One-to-Many (1:N)", level=2)
    add_p(doc, "• users → borrowings (1:N): Satu petugas dapat menangani banyak transaksi peminjaman.")
    add_p(doc, "• borrowers → borrowings (1:N): Satu peminjam dapat melakukan banyak transaksi peminjaman sepanjang masa.")
    add_p(doc, "• borrowings → borrowing_items (1:N): Satu transaksi peminjaman dapat memuat beberapa barang sekaligus.")
    add_p(doc, "• returns → return_items (1:N): Satu transaksi pengembalian dapat memuat beberapa barang yang dikembalikan.")
    add_p(doc, "• assets → asset_history (1:N): Satu barang memiliki riwayat pergerakan yang panjang seiring waktu.")
    add_p(doc, "• return_items → damage_reports (1:N): Satu pengembalian barang rusak dapat memiliki catatan laporan kerusakan.")

    add_header_styled(doc, "2. Relasi Many-to-Many (N:M) melalui Pivot Table", level=2)
    add_p(doc, "• users ↔ roles melalui tabel pivot 'user_roles': Satu user dapat memiliki banyak peran (misal: PETUGAS dan PIMPINAN), dan satu peran dimiliki banyak user.")
    add_p(doc, "• roles ↔ permissions melalui tabel pivot 'role_permissions': Satu peran memegang banyak izin, dan satu izin dapat diterapkan ke beberapa peran.")
    add_p(doc, "• borrowings ↔ assets melalui tabel detail 'borrowing_items': Menghubungkan banyak transaksi peminjaman dengan banyak unit aset inventaris.")

    add_header_styled(doc, "3. Relasi One-to-One (1:1)", level=2)
    add_p(doc, "• return_items ↔ loss_reports (1:1): Satu barang yang dikembalikan dengan kondisi HILANG hanya memiliki tepat 1 berkas laporan kehilangan resmi.")

    add_header_styled(doc, "Diagram ERD Representasi Teks Sederhana", level=2)
    erd_text = (
        "[organizational_units]\n"
        "   ├── 1:N ──> [borrowers] ── 1:N ──> [borrowings]\n"
        "   │                                      │\n"
        "[categories]                              ├── 1:N ──> [borrowing_items]\n"
        "   └── 1:N ──> [assets] <── 1:N ──────────┤                │\n"
        "                  │                                        ├── 1:N ──> [return_items]\n"
        "                  ├── 1:N ──> [asset_history]              │                │\n"
        "                  │                                   [returns]             ├── 1:N ──> [damage_reports]\n"
        "[users]           └── 1:N ──> [audit_logs]                                  └── 1:1 ──> [loss_reports]\n"
        "   ├── N:M ──> [user_roles] ──> [roles] ── N:M ──> [role_permissions] ──> [permissions]\n"
        "   ├── 1:N ──> [refresh_tokens]\n"
        "   └── 1:N ──> [external_identities]"
    )
    add_code_block(doc, erd_text)

    print("Section 1-5 built with 27-table dictionaries.")
