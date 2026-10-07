# Spesifikasi REST API SIIPB (`/api/v1`)

Dokumentasi interaktif lengkap (parameter, body, respons) tersedia di **Swagger UI `/api/docs`** (OpenAPI 2.0, `/apispec_1.json`).
Dokumen ini merangkum kontrak frontend ↔ backend.

## Format respons

```json
// sukses
{ "success": true, "message": "…", "data": { … }, "meta": { "page": 1, "per_page": 20, "total": 57 } }
// gagal
{ "success": false, "message": "…", "error_code": "VALIDATION_ERROR", "data": null, "errors": { "field": ["pesan"] } }
```

Kode HTTP: `200/201` sukses, `400` validasi/aturan bisnis, `401` token tidak valid/akun nonaktif, `403` tanpa izin, `404` tidak ditemukan, `413` berkas terlalu besar.

## Autentikasi & otorisasi

- Header `Authorization: Bearer <access_token>`; perbarui dengan `POST /auth/refresh`.
- Status akun, role, dan permission dibaca dari database setiap permintaan — penonaktifan akun/perubahan role berlaku seketika.
- Role `ADMIN` memiliki semua izin. Kode permission (sama dengan antarmuka):
  `dashboard.view, inventory.view, inventory.manage, masterdata.manage, borrowing.view, borrowing.manage, return.manage, monitoring.view, notification.view, notification.manage, qr.manage, report.view, report.export, audit.view, users.manage, settings.manage`.

## Endpoint (dokumen Plan §11 + pelengkap)

| Metode | Endpoint | Fungsi | Izin |
|---|---|---|---|
| POST | `/auth/login` | Login (username/email + kata sandi) | publik |
| POST | `/auth/refresh` | Access token baru | refresh token |
| POST | `/auth/logout` | Cabut refresh token | login |
| GET / PUT | `/auth/me` | Profil sendiri / ubah nama, email, telepon | login |
| POST | `/auth/change-password` | Ganti kata sandi (min. 8, huruf & angka; sesi lain dicabut) | login |
| GET | `/auth/google` → `/auth/google/callback` | Login SSO OAuth 2.0/OIDC (Authlib, state & nonce) → redirect `FRONTEND_URL/login#sso_code=…` | publik |
| POST | `/auth/sso/exchange` | Tukar kode SSO sekali pakai (60 detik) dengan token | publik |
| GET / POST | `/users` | Kelola pengguna internal | users.manage |
| GET / PUT / DELETE | `/users/{id}` | Detail / ubah (role, aktif, reset sandi) / hapus | users.manage |
| GET | `/users/directory` | Nama pengguna untuk tampilan | login |
| GET / POST | `/roles`, PUT/DELETE `/roles/{id}` | Role & matriks permission | users.manage |
| GET | `/permissions` | Daftar permission | users.manage |
| GET / POST | `/items` (= `/assets`) | Daftar / tambah barang (kode otomatis `INV-<KAT>-0001`) | inventory.view / inventory.manage |
| GET / PUT | `/items/{id}` | Detail / ubah barang, aktif-nonaktif | inventory.view / inventory.manage |
| POST | `/items/{id}/status` | Ubah status manual (TERSEDIA, RUSAK, RUSAK_BERAT, DALAM_PERBAIKAN, HILANG) | inventory.manage |
| GET | `/items/{id}/history` | Riwayat status/lokasi | inventory.view |
| POST / DELETE / PUT | `/items/{id}/photos`, `/photos/{pid}`, `/photos/order` | Foto barang (maks 5, JPG/PNG/WEBP, isi berkas diperiksa) | inventory.manage |
| GET | `/items/{id}/qr?format=svg\|png` | QR Code `SIIPB:<kode>` (python qrcode) | inventory.view |
| GET | `/items/by-code/{kode}` | Cari barang dari hasil pindai | inventory.view |
| GET / POST | `/borrowings` | Daftar / catat peminjaman (`checkout: true` langsung serah, `false` = DRAF) | borrowing.view / borrowing.manage |
| GET / PUT | `/borrowings/{id}` | Detail / ubah draf | borrowing.view / borrowing.manage |
| POST | `/borrowings/{id}/checkout` | Konfirmasi penyerahan (row lock, status DIPINJAM, email) | borrowing.manage |
| POST | `/borrowings/{id}/cancel` | Batalkan draf (alasan wajib) | borrowing.manage |
| GET / POST | `/returns` | Daftar / catat pengembalian (kondisi, kelengkapan, rusak/hilang, tanggal) | borrowing.view / return.manage |
| GET | `/returns/{id}` | Detail pengembalian | borrowing.view |
| GET / PUT | `/damage-reports`, `/damage-reports/{id}/repair-status` | Laporan kerusakan & siklus perbaikan | borrowing.view / return.manage |
| GET | `/loss-reports` | Laporan kehilangan | borrowing.view |
| GET | `/notifications` | Riwayat notifikasi + log pengiriman (`?event=H+3&borrowing_id=&inbox=1`) | notification.view |
| POST | `/notifications/{id}/read`, `/notifications/read-all` | Tandai terbaca | login |
| GET | `/notifications/unread-count` | Jumlah belum dibaca | login |
| POST | `/notifications/{id}/resend` | Kirim ulang | notification.manage |
| GET / PUT | `/notifications/templates`, `/templates/{id}` | Template email (`{{nama_peminjam}}`, …) | notification.view / settings.manage |
| GET | `/dashboard/summary` | Ringkasan | dashboard.view |
| GET | `/dashboard/overdue` | Daftar terlambat + tingkat eskalasi | monitoring.view |
| GET | `/dashboard/statistics?months=12` | Tren bulanan, barang terpopuler, ketepatan waktu | dashboard.view / report.view |
| GET | `/reports/{inventaris\|peminjaman\|pengembalian\|keterlambatan\|kerusakan}?format=json\|xlsx\|pdf` | Laporan (openpyxl / WeasyPrint), filter `from,to,unit_id,category_id,location_id,status` | report.view (+ report.export untuk berkas) |
| GET / PUT | `/settings` | Pengaturan umum, SMTP (sandi terenkripsi), scheduler, aturan H-3…H+7, keamanan, parameter | login (bagian umum) / settings.manage |
| GET | `/settings/public` | Nama instansi & status SSO (halaman login) | publik |
| POST | `/settings/smtp/test` | Uji koneksi SMTP | settings.manage |
| POST | `/scheduler/run` | Jalankan pemeriksaan jatuh tempo sekarang (idempoten) | notification.manage |
| GET | `/scheduler/runs` | Riwayat pemeriksaan | notification.view |
| GET / POST | `/backups`, GET `/backups/{file}` | Backup database (mariadb-dump) & unduh | settings.manage |
| GET | `/audit-logs` | Audit log (`module, action, user_id, entity_type, entity_id, from, to`) | audit.view |
| GET / POST / PUT / DELETE | `/categories`, `/locations`, `/organizational-units`, `/borrowers` (+ `/{id}`) | Master data (`?all=1` sertakan nonaktif) | login / masterdata.manage |
| GET | `/api/health` | Health check (DB + revisi migrasi) | publik |

## Aturan notifikasi (Plan §12, §21)

- Event: `LOAN_CONFIRMATION` (checkout), `H_MINUS_3`, `H_MINUS_1`, `H_DAY`, `H_PLUS_1`, `H_PLUS_3`, `H_PLUS_7`, `RETURN_CONFIRMATION`.
- `notification_events` UNIQUE(`borrowing_id`, `event_code`) → satu jenis notifikasi tidak pernah dikirim dua kali.
- Penerima per aturan dapat dikonfigurasi (bawaan: H+3 = peminjam + petugas, H+7 = + pimpinan); satu baris `notifications` per penerima.
- Celery Beat mengecek tiap 15 menit dan menjalankan pemeriksaan sekali sehari setelah jam di Pengaturan (bawaan 08.00 Asia/Jakarta). Bila sempat terlewat, aturan terakhir yang sudah tercapai tetap dikirim sekali.
- Transaksi AKTIF yang melewati batas → `TERLAMBAT`; transaksi `DIKEMBALIKAN` tidak disentuh.
- Setiap percobaan kirim tercatat di `email_deliveries` dan `notification_logs` (retry eksponensial di worker).
