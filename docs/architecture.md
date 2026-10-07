# Arsitektur SIIPB (dokumen Plan §9, §14, §23)

```text
 Pengguna internal (Admin / Petugas Sarpras-IT / Pimpinan)          Peminjam (tanpa akun)
                │ HTTPS                                                   ▲ email
                ▼                                                         │
 ┌──────────────────────── Nginx ────────────────────────┐                │
 │  /            → frontend:3000 (Next.js standalone)     │                │
 │  /api/, /api/docs → backend:5000 (Flask + Gunicorn)    │                │
 │  /uploads/    → volume uploads (foto barang)           │                │
 │  rate limit login, header keamanan, TLS (nginx.https)  │                │
 └───────────────┬────────────────────────┬───────────────┘                │
                 ▼                        ▼                                │
        Next.js + React + TS      Flask REST API ──── SQLAlchemy ──► MariaDB 11 (29 tabel, Alembic)
        (UI, RBAC rute & tombol)   JWT · RBAC · Marshmallow   │
                                   │                          └──► Redis ◄── Celery Beat (jatuh tempo /15 mnt, backup 01.00)
                                   └── dispatch email ──────────────┘   │
                                                                        ▼
                                                                Celery Worker ──► SMTP (retry, log)
```

## Alur utama

1. **Peminjaman** (Plan §7.1, §20): petugas memilih peminjam & barang → `POST /borrowings` (DRAF atau langsung checkout).
   Checkout mengunci baris aset (`SELECT … FOR UPDATE`, urut id), memvalidasi `TERSEDIA`, mengubah status menjadi `DIPINJAM`,
   mencatat `asset_history` & `audit_logs`, lalu membuat event `LOAN_CONFIRMATION` → email ke peminjam.
2. **Pengembalian** (§7.2): `POST /returns` mencatat kondisi & kelengkapan per barang; status aset menjadi TERSEDIA / RUSAK /
   RUSAK_BERAT / DALAM_PERBAIKAN / HILANG, laporan kerusakan/kehilangan dibuat, transaksi `DIKEMBALIKAN` bila semua barang kembali,
   konfirmasi email (dapat dimatikan per transaksi atau global).
3. **Keterlambatan** (§7.3, §21): Celery Beat → `run_due_check` → AKTIF lewat batas menjadi TERLAMBAT → aturan H-3…H+7
   (penerima dapat dikonfigurasi) → `notification_events` (UNIQUE borrowing+event, anti-duplikat) → `notifications` per penerima
   → worker SMTP → `email_deliveries` + `notification_logs`.

## Keputusan teknis

| Aspek | Keputusan |
|---|---|
| Sumber kebenaran skema | Alembic (`backend/alembic/versions`); `database/SIIPB.sql` hanya referensi |
| RBAC | Kode permission backend = kode antarmuka; izin dibaca dari DB setiap permintaan |
| Rahasia | `.env` / secret manager; kata sandi SMTP dari UI disimpan terenkripsi (Fernet, kunci dari `SECRET_KEY`) |
| Pengiriman email | `NOTIFICATION_DISPATCH=celery` (production) atau `sync` (pengembangan/tes) |
| Frontend | Mode `api` (production) dan `mock` (demo tanpa server) memakai komponen yang sama; mutasi melalui `services/repo.ts` |
| Berkas | Foto barang di volume `/app/uploads` (ekstensi + magic bytes diperiksa, nama UUID, batas ukuran) |
| Backup | `mariadb-dump` gzip harian + manual; pemulihan hanya via skrip server |
