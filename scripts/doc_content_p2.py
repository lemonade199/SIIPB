"""Section 6 to 10 for SIIPB Word Documentation."""
from docx.shared import Inches, Pt, RGBColor
from scripts.build_complete_docx import (
    add_header_styled, add_p, add_callout, add_code_block, create_table_from_rows
)

def build_section_6_to_10(doc):
    # ========================================================
    # BAGIAN 6 — MODEL / ORM
    # ========================================================
    add_header_styled(doc, "BAGIAN 6 — MODEL / ORM (SQLALCHEMY 2.X)", level=1)
    add_p(doc, "Backend SIIPB menggunakan modern declarative mapping SQLAlchemy 2.0 (Mapped[T] dan mapped_column). Model bertindak sebagai jembatan object-oriented antara kode Python dan baris tabel MariaDB.")

    model_rows = [
        ["User (app.models.user)", "users", "id", "roles (N:M), refresh_tokens (1:N), external_identities (1:N)", "Memiliki property permission_codes untuk mengekstrak set izin unik dari seluruh peran aktif."],
        ["Role (app.models.role)", "roles", "id", "users (N:M), permissions (N:M)", "Mengelompokkan hak akses sistem menjadi peran fungsional."],
        ["Permission (app.models.permission)", "permissions", "id", "roles (N:M)", "Izin atomik (misal: asset.read, asset.create, borrowing.checkout)."],
        ["Asset (app.models.asset)", "assets", "id", "category (M:1), location (M:1), owner_unit (M:1), history (1:N)", "Menjaga status ketersediaan (TERSEDIA, DIPINJAM, RUSAK, HILANG) dengan CHECK constraint."],
        ["Borrowing (app.models.borrowing)", "borrowings", "id", "borrower (M:1), handler (M:1), items (1:N), returns (1:N)", "Header peminjaman, mencatat transaction_number unik (TX-YYYYMMDDHHMMSS-XXXX)."],
        ["BorrowingItem (app.models.borrowing)", "borrowing_items", "id", "borrowing (M:1), asset (M:1), return_items (1:N)", "Menghubungkan unit aset spesifik yang dipinjam dalam satu nomor transaksi."],
        ["Return (app.models.asset_return)", "returns", "id", "borrowing (M:1), receiver (M:1), items (1:N)", "Header pengembalian barang, mendukung pengembalian bertahap (partial return)."],
        ["ReturnItem (app.models.asset_return)", "return_items", "id", "return_ (M:1), asset (M:1), damage_reports (1:N), loss_report (1:1)", "Mencatat evaluasi kondisi fisik barang saat dikembalikan (BAIK, RUSAK, HILANG)."],
        ["DamageReport (app.models.damage_report)", "damage_reports", "id", "return_item (M:1), reporter (M:1)", "Memiliki siklus hidup perbaikan: DILAPORKAN -> DALAM_PERBAIKAN -> SELESAI."],
        ["LossReport (app.models.loss_report)", "loss_reports", "id", "return_item (M:1), reporter (M:1)", "Mencatat laporan kehilangan dan tindakan kompensasi / investigasi yang diambil."],
        ["AuditLog (app.models.audit_log)", "audit_logs", "id", "user (M:1)", "Log append-only yang menyimpan snapshot old_data dan new_data dalam format JSON."],
        ["Notification (app.models.notification)", "notifications", "id", "event (M:1), borrower (M:1), deliveries (1:N)", "Menyimpan snapshot pesan email beku (body_snapshot) agar histori pesan tidak berubah."],
    ]
    create_table_from_rows(
        doc,
        ["Nama Model & Modul", "Tabel Basis Data", "Primary Key", "Relationship Terkait", "Karakteristik & Fitur Khusus"],
        model_rows,
        [Inches(1.8), Inches(1.0), Inches(0.6), Inches(1.5), Inches(1.6)]
    )

    # ========================================================
    # BAGIAN 7 — API / ROUTES
    # ========================================================
    add_header_styled(doc, "BAGIAN 7 — API / ROUTES", level=1)
    add_p(doc, "Seluruh endpoint REST API dikelompokkan dalam prefix standar /api/v1. Format request dan response menggunakan standar Application/JSON.")

    routes_data = [
        ["POST", "/api/v1/auth/login", "auth_routes.py", "login", "Publik", "Autentikasi username/email & password, mengembalikan JWT & refresh token."],
        ["POST", "/api/v1/auth/refresh", "auth_routes.py", "refresh", "Publik", "Menukarkan refresh token valid untuk mendapatkan access token baru."],
        ["GET", "/api/v1/auth/me", "auth_routes.py", "get_me", "Bearer Token", "Mendapatkan data profil pengguna yang sedang login beserta seluruh hak izinnya."],
        ["POST", "/api/v1/auth/logout", "auth_routes.py", "logout", "Bearer Token", "Mencabut (revoke) refresh token agar tidak dapat digunakan kembali."],
        ["GET", "/api/v1/auth/google", "auth_routes.py", "google_login", "Publik", "Redirect pengguna ke halaman login Google OAuth 2.0 / OIDC."],
        ["GET", "/api/v1/auth/google/callback", "auth_routes.py", "google_callback", "Publik", "Menerima kode OAuth dari Google dan mengautentikasi pengguna internal."],
        ["GET", "/api/v1/assets", "asset_routes.py", "list_assets", "Bearer Token", "Melihat katalog aset dengan filter kategori, lokasi, status, dan pencarian."],
        ["POST", "/api/v1/assets", "asset_routes.py", "add_asset", "asset.create", "Mendaftarkan aset baru ke inventaris dan mencatat ke asset_history."],
        ["GET", "/api/v1/assets/<id>", "asset_routes.py", "get_asset_detail", "Bearer Token", "Melihat rincian spesifikasi aset tertentu berdasarkan ID."],
        ["PUT", "/api/v1/assets/<id>", "asset_routes.py", "edit_asset", "asset.update", "Memperbarui atribut barang (nama, lokasi, kondisi) dan mencatat mutasi."],
        ["DELETE", "/api/v1/assets/<id>", "asset_routes.py", "remove_asset", "asset.delete", "Menonaktifkan aset (soft delete) asalkan barang tidak sedang dipinjam."],
        ["GET", "/api/v1/assets/<id>/history", "asset_routes.py", "list_asset_history", "Bearer Token", "Melihat rekam jejak kronologis pergerakan fisik dan status aset."],
        ["POST", "/api/v1/assets/<id>/upload-photo", "asset_routes.py", "upload_asset_photo", "asset.update", "Mengunggah foto barang ke penyimpanan server / MinIO."],
        ["GET", "/api/v1/borrowings", "borrowing_routes.py", "list_borrowings", "Bearer Token", "Melihat daftar transaksi peminjaman (status AKTIF, TERLAMBAT, DIKEMBALIKAN)."],
        ["GET", "/api/v1/borrowings/<id>", "borrowing_routes.py", "get_borrowing_detail", "Bearer Token", "Melihat rincian transaksi peminjaman dan daftar barang yang dipinjam."],
        ["POST", "/api/v1/borrowings", "borrowing_routes.py", "create_borrowing", "borrowing.create", "Checkout peminjaman barang dengan row-locking (SELECT ... FOR UPDATE)."],
        ["GET", "/api/v1/returns", "return_routes.py", "list_returns", "Bearer Token", "Melihat daftar transaksi pengembalian barang yang diterima petugas."],
        ["GET", "/api/v1/returns/<id>", "return_routes.py", "get_return_detail", "Bearer Token", "Melihat rincian penerimaan barang kembali beserta evaluasi kondisinya."],
        ["POST", "/api/v1/returns", "return_routes.py", "create_return", "borrowing.return", "Memproses pengembalian barang (kondisi BAIK, RUSAK, atau HILANG)."],
        ["GET", "/api/v1/damage-reports", "return_routes.py", "list_damage_reports", "Bearer Token", "Melihat daftar laporan kerusakan barang akibat peminjaman."],
        ["PUT", "/api/v1/damage-reports/<id>/repair-status", "return_routes.py", "update_repair_status", "damage.update", "Memperbarui status perbaikan teknis barang (DILAPORKAN -> SELESAI)."],
        ["GET", "/api/v1/loss-reports", "return_routes.py", "list_loss_reports", "Bearer Token", "Melihat daftar laporan insiden barang hilang saat peminjaman."],
        ["GET", "/api/v1/organizational-units", "master_routes.py", "list_units", "Bearer Token", "Mendapatkan daftar unit kerja organisasi."],
        ["POST", "/api/v1/organizational-units", "master_routes.py", "add_unit", "settings.manage", "Menambah unit kerja baru."],
        ["GET", "/api/v1/categories", "master_routes.py", "list_categories", "Bearer Token", "Mendapatkan daftar kategori barang."],
        ["POST", "/api/v1/categories", "master_routes.py", "add_category", "asset.create", "Menambah kategori barang baru."],
        ["GET", "/api/v1/locations", "master_routes.py", "list_locations", "Bearer Token", "Mendapatkan daftar lokasi fisik (gedung/ruangan)."],
        ["POST", "/api/v1/locations", "master_routes.py", "add_location", "asset.create", "Menambah lokasi fisik baru."],
        ["GET", "/api/v1/borrowers", "master_routes.py", "list_borrowers", "Bearer Token", "Melihat daftar peminjam (tanpa akun login)."],
        ["POST", "/api/v1/borrowers", "master_routes.py", "add_borrower", "borrowing.create", "Mendaftarkan peminjam baru."],
        ["PUT", "/api/v1/borrowers/<id>", "master_routes.py", "edit_borrower", "borrowing.create", "Mengubah data kontak peminjam."],
        ["DELETE", "/api/v1/borrowers/<id>", "master_routes.py", "remove_borrower", "borrowing.create", "Menonaktifkan data peminjam."],
        ["GET", "/api/v1/notifications", "notification_routes.py", "list_notifications", "Bearer Token", "Melihat log pengiriman email notifikasi otomatis."],
        ["GET", "/api/v1/notifications/templates", "notification_routes.py", "list_templates", "Bearer Token", "Melihat daftar template email (H-3, H-1, H, Overdue)."],
        ["POST", "/api/v1/notifications/<id>/resend", "notification_routes.py", "resend_notification", "settings.manage", "Mengantrekan ulang pengiriman email yang gagal."],
        ["GET", "/api/v1/dashboard/summary", "dashboard_routes.py", "dashboard_summary", "Bearer Token", "Mendapatkan statistik ringkasan aset, peminjaman aktif, dan insiden."],
        ["GET", "/api/v1/audit-logs", "audit_routes.py", "list_audit_logs", "audit.read", "Melihat riwayat jejak audit aktivitas sistem secara append-only."],
        ["POST", "/api/v1/uploads", "upload_routes.py", "upload_file", "Bearer Token", "Mengunggah berkas foto bukti fisik kerusakan atau dokumen."],
        ["GET", "/api/health", "app/__init__.py", "health_check", "Publik", "Pemeriksaan kesehatan server dan status koneksi database."],
        ["GET", "/api/docs", "extensions.py", "swagger_ui", "Publik", "Dokumentasi interaktif OpenAPI / Swagger UI."],
    ]
    create_table_from_rows(
        doc,
        ["Method", "Endpoint URL", "Controller File", "Function", "Otorisasi", "Fungsi & Deskripsi"],
        routes_data,
        [Inches(0.8), Inches(1.8), Inches(1.1), Inches(1.1), Inches(0.9), Inches(1.8)]
    )

    # ========================================================
    # BAGIAN 8 — CONTROLLER / ROUTE HANDLERS
    # ========================================================
    add_header_styled(doc, "BAGIAN 8 — CONTROLLER / ROUTE HANDLERS", level=1)
    add_p(doc, "Pada framework Flask, peran Controller dijalankan oleh fungsi handler di dalam modul Blueprint (backend/app/routes/). Controller bertugas menerima request HTTP, memvalidasi input payload menggunakan Schema Marshmallow, memanggil fungsi bisnis di Service Layer, dan mengembalikan respons JSON terstandarisasi.")

    add_header_styled(doc, "Pola Alur Controller", level=2)
    ctrl_code = (
        "@borrowing_bp.post('')\n"
        "@permission_required('borrowing.create')  # 1. Cek Hak Akses (RBAC)\n"
        "def create_borrowing_transaction():\n"
        "    data = request.get_json(silent=True) or {}  # 2. Ambil Input\n"
        "    errors = BorrowingCreateSchema().validate(data)  # 3. Validasi Data\n"
        "    if errors:\n"
        "        return error_response('Validasi gagal', errors=errors)\n"
        "    \n"
        "    with SessionLocal() as session:\n"
        "        try:\n"
        "            # 4. Panggil Service Bisnis (Row-Locking SELECT FOR UPDATE)\n"
        "            borrowing = checkout_borrowing(\n"
        "                session=session,\n"
        "                borrower_id=data['borrower_id'],\n"
        "                handled_by=g.current_user['id'],\n"
        "                start_date=data['start_date'],\n"
        "                due_date=data['due_date'],\n"
        "                asset_ids=data['asset_ids']\n"
        "            )\n"
        "            # 5. Kembalikan Respons Standar HTTP 201\n"
        "            return success_response(data=serialize_borrowing(borrowing), status_code=201)\n"
        "        except ValueError as e:\n"
        "            return error_response(str(e), status_code=400)"
    )
    add_code_block(doc, ctrl_code)

    # ========================================================
    # BAGIAN 9 — AUTHENTICATION & AUTHORIZATION
    # ========================================================
    add_header_styled(doc, "BAGIAN 9 — AUTHENTICATION & AUTHORIZATION", level=1)
    add_p(doc, "Keamanan SIIPB menerapkan prinsip pertahanan berlapis (Defense-in-Depth):")
    add_p(doc, "1. Hashing Kata Sandi: Menggunakan PBKDF2/SHA-256 dan Scrypt melalui werkzeug.security, dengan fallback verifikasi aman.")
    add_p(doc, "2. Access Token JWT: Bersifat stateless dengan masa berlaku terkontrol (default 60 menit) memuat klaim identitas, peran, dan daftar izin.")
    add_p(doc, "3. Refresh Token Ter-Hash (SHA-256): Token fisik acak sepanjang 64 karakter diberikan ke klien, namun database HANYA menyimpan hash SHA-256 (64 hex characters) di tabel refresh_tokens.token_hash. Jika database disusupi, token tidak dapat direkonstruksi.")
    add_p(doc, "4. OAuth 2.0 / OpenID Connect: Melalui library Authlib, akun internal dapat dihubungkan ke SSO institusi (Google Workspace) dan disimpan pada tabel external_identities.")

    add_header_styled(doc, "Matriks Peran dan Izin Hak Akses (RBAC)", level=2)
    rbac_rows = [
        ["ADMIN (Administrator)", "Memegang seluruh 10 izin sistem (asset.create, asset.update, asset.delete, borrowing.create, borrowing.return, damage.update, audit.read, settings.manage, report.generate, notification.manage)."],
        ["SARPRAS (Petugas Sarpras / IT)", "Mengelola inventaris dan transaksi operasional harian (asset.read, asset.create, asset.update, borrowing.create, borrowing.return, damage.update, report.generate)."],
        ["PIMPINAN (Kepala Sekolah / Manajer)", "Hak pemantauan eksekutif dan persetujuan (asset.read, audit.read, report.generate, dashboard.read)."],
        ["PEMINJAM (Guru / Karyawan / Siswa)", "TIDAK MEMILIKI AKUN LOGIN. Data peminjam adalah entitas master murni yang hanya menerima notifikasi email tanda bukti peminjaman dan pengingat jatuh tempo."],
    ]
    create_table_from_rows(
        doc,
        ["Peran (Role)", "Cakupan Hak Akses & Tanggung Jawab"],
        rbac_rows,
        [Inches(2.5), Inches(4.5)]
    )

    # ========================================================
    # BAGIAN 10 — VALIDATION
    # ========================================================
    add_header_styled(doc, "BAGIAN 10 — VALIDATION (MARSHMALLOW SCHEMAS)", level=1)
    add_p(doc, "Validasi input dilakukan di backend menggunakan pustaka Marshmallow (backend/app/schemas/) sebelum data menyentuh service bisnis atau database:")

    schema_rows = [
        ["LoginSchema", "auth_schema.py", "username (Wajib, string), password (Wajib, string min 6)."],
        ["RefreshTokenSchema", "auth_schema.py", "refresh_token (Wajib, string tidak boleh kosong)."],
        ["AssetCreateSchema", "asset_schema.py", "inventory_code (Wajib, 3-50 char unik), category_id (Wajib, integer), name (Wajib, 2-200 char), status (Enum AssetStatus), condition (Enum AssetCondition)."],
        ["AssetUpdateSchema", "asset_schema.py", "name, brand, model, location_id, condition, reason (Opsional keterangan pembaruan)."],
        ["BorrowingCreateSchema", "borrowing_schema.py", "borrower_id (Wajib), start_date (Date), due_date (Date, divalidasi due_date >= start_date), asset_ids (List integer minimal 1 barang)."],
        ["ReturnCreateSchema", "return_schema.py", "borrowing_id (Wajib), items (List ReturnItemInputSchema dengan final_condition 'BAIK'/'RUSAK'/'HILANG', completeness, notes, damage, loss)."],
        ["BorrowerSchema", "master_schema.py", "name (Wajib), identity_number (Wajib unik), email (Validasi format email), phone, unit_id."],
    ]
    create_table_from_rows(
        doc,
        ["Nama Skema", "Berkas Skema", "Aturan & Parameter Validasi"],
        schema_rows,
        [Inches(2.0), Inches(1.5), Inches(3.5)]
    )

    print("Section 6-10 built.")
