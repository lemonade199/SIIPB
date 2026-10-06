"""Section 11 to 15 for SIIPB Word Documentation."""
from docx.shared import Inches, Pt
from scripts.build_complete_docx import (
    add_header_styled, add_p, add_callout, add_code_block, create_table_from_rows
)

def build_section_11_to_15(doc):
    # ========================================================
    # BAGIAN 11 — BUSINESS LOGIC
    # ========================================================
    add_header_styled(doc, "BAGIAN 11 — BUSINESS LOGIC (LOGIKA BISNIS UTAMA)", level=1)
    
    add_header_styled(doc, "1. Pencegahan Peminjaman Ganda (Row-Level Locking)", level=2)
    add_p(doc, "Masalah paling fatal dalam sistem peminjaman multi-user adalah saat 2 petugas membuka sistem di waktu bersamaan dan mencoba meminjamkan 1 barang yang sama kepada 2 peminjam berbeda (Race Condition).")
    add_p(doc, "Solusi SIIPB: Menggunakan pesimistik row locking pada level mesin InnoDB MariaDB: session.get(Asset, asset_id, with_for_update=True).")
    lock_code = (
        "# Cuplikan backend/app/services/borrowing_service.py\n"
        "for asset_id in asset_ids:\n"
        "    # SELECT * FROM assets WHERE id = :id FOR UPDATE;\n"
        "    asset = session.get(Asset, asset_id, with_for_update=True)\n"
        "    \n"
        "    # Validasi ketersediaan di dalam baris yang terkunci\n"
        "    if asset.status != AssetStatus.TERSEDIA.value or not asset.is_active:\n"
        "        raise ValueError(f'Aset {asset.name} tidak tersedia untuk dipinjam (Status: {asset.status})')\n"
        "    \n"
        "    # Ubah status & buat riwayat\n"
        "    asset.status = AssetStatus.DIPINJAM.value\n"
        "    session.add(AssetHistory(...))\n"
        "session.commit() # Kunci dilepaskan setelah transaksi selesai tersimpan"
    )
    add_code_block(doc, lock_code)
    add_p(doc, "Transaksi A yang tiba lebih dulu mengunci baris barang. Transaksi B akan ditahan (wait) hingga Transaksi A commit, lalu Transaksi B membaca bahwa status barang telah berubah menjadi 'DIPINJAM', sehingga Transaksi B otomatis dibatalkan dengan aman.")

    add_header_styled(doc, "2. Siklus Status Barang (State Transitions)", level=2)
    add_p(doc, "• TERSEDIA → Saat checkout disetujui → DIPINJAM.")
    add_p(doc, "• DIPINJAM → Dikembalikan dalam kondisi baik → TERSEDIA.")
    add_p(doc, "• DIPINJAM → Dikembalikan dalam kondisi rusak → RUSAK (masuk ke antrean perbaikan damage_reports).")
    add_p(doc, "• RUSAK → Selesai diservis/diperbaiki → TERSEDIA (kondisi fisik menjadi BAIK).")
    add_p(doc, "• DIPINJAM → Dilaporkan hilang → HILANG (dibuat berkas loss_reports untuk ganti rugi).")

    add_header_styled(doc, "3. Notifikasi Idempoten (Pencegahan Email Spam)", level=2)
    add_p(doc, "Sebelum mengirim email, sistem membuat event di tabel notification_events dengan batasan UNIQUE(borrowing_id, event_code). Jika cron job scheduler berjalan dua kali dalam satu menit, event kedua diabaikan sehingga peminjam tidak akan pernah menerima email ganda untuk kejadian yang sama.")

    # ========================================================
    # BAGIAN 12 — CRUD
    # ========================================================
    add_header_styled(doc, "BAGIAN 12 — CRUD (CREATE, READ, UPDATE, DELETE)", level=1)
    add_p(doc, "Berikut adalah ringkasan siklus CRUD pada entitas utama sistem:")

    crud_rows = [
        ["Aset Inventaris", "POST /api/v1/assets\n(add_asset)", "GET /api/v1/assets\n(list_assets, search)", "PUT /api/v1/assets/<id>\n(edit_asset, log history)", "DELETE /api/v1/assets/<id>\n(soft delete deleted_at)"],
        ["Peminjaman", "POST /api/v1/borrowings\n(checkout with lock)", "GET /api/v1/borrowings\n(filter status, borrower)", "PUT /api/v1/borrowings/<id>\n(update notes / due date)", "Dibatalkan (status DIBATALKAN, data tidak dihapus)"],
        ["Pengembalian", "POST /api/v1/returns\n(process_return)", "GET /api/v1/returns\n(detail return items)", "Kondisi diubah via laporan perbaikan", "Dilarang dihapus (Integritas audit RESTRICT)"],
        ["Peminjam", "POST /api/v1/borrowers\n(add_borrower)", "GET /api/v1/borrowers\n(pencarian nama/NIP)", "PUT /api/v1/borrowers/<id>\n(update kontak)", "DELETE /api/v1/borrowers/<id>\n(is_active=False)"],
        ["Kategori & Lokasi", "POST /api/v1/categories\nPOST /api/v1/locations", "GET /api/v1/categories\nGET /api/v1/locations", "PUT /api/v1/categories/<id>\nPUT /api/v1/locations/<id>", "Soft delete jika belum ada aset terkait"],
    ]
    create_table_from_rows(
        doc,
        ["Entitas", "CREATE (Buat)", "READ (Baca / Cari)", "UPDATE (Ubah)", "DELETE (Hapus / Nonaktifkan)"],
        crud_rows,
        [Inches(1.5), Inches(1.5), Inches(1.5), Inches(1.3), Inches(1.4)]
    )

    # ========================================================
    # BAGIAN 13 — ALUR FITUR UTAMA
    # ========================================================
    add_header_styled(doc, "BAGIAN 13 — ALUR FITUR UTAMA (END-TO-END FLOW)", level=1)

    add_header_styled(doc, "Fitur 1: Pencatatan Peminjaman Barang (Checkout)", level=2)
    add_p(doc, "1. Petugas membuka menu peminjaman di frontend dan memilih nama peminjam serta barang yang ingin dipinjam.")
    add_p(doc, "2. Frontend mengirim payload JSON ke POST /api/v1/borrowings berisi borrower_id, tanggal pinjam, batas kembali, dan daftar asset_ids.")
    add_p(doc, "3. Middleware memverifikasi token JWT dan hak akses 'borrowing.create'.")
    add_p(doc, "4. Service layer memulai transaksi database dan mengunci baris aset menggunakan SELECT ... FOR UPDATE.")
    add_p(doc, "5. Status aset diubah menjadi 'DIPINJAM', nomor transaksi dibuat, dan event LOAN_CONFIRMATION dijadwalkan.")
    add_p(doc, "6. Celery Worker mengirimkan email bukti peminjaman dan batas pengembalian ke email peminjam.")

    add_header_styled(doc, "Fitur 2: Pencatatan Pengembalian & Penanganan Kerusakan", level=2)
    add_p(doc, "1. Peminjam mengembalikan fisik barang ke ruang Sarpras/IT.")
    add_p(doc, "2. Petugas membuka transaksi peminjaman aktif dan memeriksa kelengkapan serta kondisi fisik setiap barang.")
    add_p(doc, "3. Jika barang BAIK: Status aset otomatis kembali menjadi 'TERSEDIA'.")
    add_p(doc, "4. Jika barang RUSAK: Petugas mengisi deskripsi kerusakan dan estimasi biaya perbaikan. Status barang berubah menjadi 'RUSAK', dan sistem otomatis membuat berkas laporan di tabel damage_reports.")
    add_p(doc, "5. Setelah teknisi menyelesaikan reparasi, petugas memperbarui status perbaikan menjadi 'SELESAI', dan sistem otomatis mengembalikan status barang menjadi 'TERSEDIA'.")

    add_header_styled(doc, "Fitur 3: Pemantauan Jatuh Tempo & Otomasi Pengingat (Celery Beat)", level=2)
    add_p(doc, "1. Celery Beat berjalan setiap hari pukul 08:00 WIB mengeksekusi check_borrowing_due_dates_task.")
    add_p(doc, "2. Sistem membandingkan batas due_date dengan tanggal hari ini.")
    add_p(doc, "3. H-3: Mengirim email pengingat awal.")
    add_p(doc, "4. H-1: Mengirim email peringatan besok batas akhir pengembalian.")
    add_p(doc, "5. H-0: Mengirim email bahwa hari ini batas akhir pengembalian.")
    add_p(doc, "6. Lewat Jatuh Tempo: Status transaksi diubah menjadi 'TERLAMBAT'. Notifikasi eskalasi dikirim pada H+1 ke peminjam, H+3 ke petugas, dan H+7 ke pimpinan unit.")

    # ========================================================
    # BAGIAN 14 — CONTOH DATA DUMMY
    # ========================================================
    add_header_styled(doc, "BAGIAN 14 — CONTOH DATA DUMMY", level=1)
    add_p(doc, "Berikut adalah visualisasi contoh data konkret yang tersimpan di dalam database untuk memudahkan pemahaman relasi:")

    add_header_styled(doc, "Tabel: users (Petugas & Admin)", level=2)
    create_table_from_rows(
        doc,
        ["id", "username", "email", "full_name", "is_active"],
        [
            ["1", "admin", "admin@siipb.sch.id", "Budi Administrator", "True"],
            ["2", "petugas", "petugas@siipb.sch.id", "Siti Petugas Sarpras", "True"],
        ],
        [Inches(0.6), Inches(1.5), Inches(2.2), Inches(2.0), Inches(0.9)]
    )

    add_header_styled(doc, "Tabel: borrowers (Peminjam Tanpa Akun)", level=2)
    create_table_from_rows(
        doc,
        ["id", "name", "identity_number", "email", "unit_id"],
        [
            ["1", "Drs. Ahmad Dahlan", "NIP-19850101-01", "ahmad@sekolah.sch.id", "1 (Unit Kurikulum)"],
            ["2", "Dewi Lestari, S.Pd", "NIP-19900202-02", "dewi@sekolah.sch.id", "2 (Unit Kesiswaan)"],
        ],
        [Inches(0.6), Inches(2.0), Inches(1.8), Inches(2.0), Inches(1.8)]
    )

    add_header_styled(doc, "Tabel: assets (Inventaris)", level=2)
    create_table_from_rows(
        doc,
        ["id", "inventory_code", "name", "category_id", "status", "condition"],
        [
            ["1", "AST-001", "Laptop ThinkPad L14", "1 (Elektronik)", "TERSEDIA", "BAIK"],
            ["2", "AST-002", "Proyektor Epson EB-X500", "1 (Elektronik)", "DIPINJAM", "BAIK"],
            ["3", "AST-003", "Kamera DSLR Canon 80D", "1 (Elektronik)", "RUSAK", "RUSAK_RINGAN"],
        ],
        [Inches(0.5), Inches(1.4), Inches(2.2), Inches(1.4), Inches(1.1), Inches(1.1)]
    )

    add_header_styled(doc, "Tabel: borrowings (Transaksi Peminjaman)", level=2)
    create_table_from_rows(
        doc,
        ["id", "transaction_number", "borrower_id", "handled_by", "due_date", "status"],
        [
            ["101", "TX-20261006120000-A1B2", "1 (Ahmad)", "2 (Siti)", "2026-10-13", "AKTIF"],
            ["102", "TX-20261001083000-C3D4", "2 (Dewi)", "2 (Siti)", "2026-10-05", "TERLAMBAT"],
        ],
        [Inches(0.6), Inches(2.2), Inches(1.4), Inches(1.2), Inches(1.1), Inches(1.0)]
    )

    # ========================================================
    # BAGIAN 15 — ERROR HANDLING
    # ========================================================
    add_header_styled(doc, "BAGIAN 15 — ERROR HANDLING & STATUS CODES", level=1)
    add_p(doc, "Backend SIIPB menerapkan standardisasi error handling JSON yang konsisten di semua rute:")

    error_rows = [
        ["200 OK", "Permintaan berhasil diproses (misal: get list, get detail, update)."],
        ["201 Created", "Entitas baru berhasil dibuat (misal: tambah aset, checkout peminjaman)."],
        ["400 Bad Request", "Validasi input gagal, format JSON tidak valid, atau pelanggaran aturan bisnis."],
        ["401 Unauthorized", "Akses ditolak karena token JWT tidak disertakan, kedaluwarsa, atau tanda tangan tidak valid."],
        ["403 Forbidden", "Pengguna sudah login namun tidak memiliki izin yang dipersyaratkan (RBAC violation)."],
        ["404 Not Found", "Data ID atau endpoint yang diminta tidak ditemukan di database."],
        ["405 Method Not Allowed", "Metode HTTP yang dipanggil salah (misal: memanggil GET pada rute POST)."],
        ["500 Internal Server Error", "Terjadi kesalahan internal tak terduga pada server."],
    ]
    create_table_from_rows(
        doc,
        ["Status Code HTTP", "Arti & Kondisi Penggunaan"],
        error_rows,
        [Inches(2.0), Inches(5.0)]
    )

    print("Section 11-15 built.")
