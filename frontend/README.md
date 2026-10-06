# SIIPB — Frontend (Next.js + React + TypeScript)

Frontend SIIPB sesuai dokumen *Plan SIIPB Scrum*: **Next.js 16 (App Router) + React 19 + TypeScript (strict) + Tailwind CSS v4 + shadcn/ui** (Radix UI + class-variance-authority, ikon lucide-react). Semua halaman, alur, aturan bisnis, dan RBAC dari mockup sudah dipindahkan, dan frontend dapat berjalan **tanpa backend (mode mock)** atau **terhubung ke Flask REST API (mode api)**.

## Menjalankan

```bash
cd frontend
npm install
npm run dev                      # http://localhost:3000 (mode mock, bawaan)
```

| Mode | Cara | Data |
|---|---|---|
| `mock` (bawaan) | `NEXT_PUBLIC_DATA_SOURCE=mock` | Data contoh di browser (localStorage) — untuk demo & Sprint Review |
| `api` | `NEXT_PUBLIC_DATA_SOURCE=api` + `NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1` | Flask REST API, login JWT backend |

Salin `.env.example` menjadi `.env` lalu atur nilainya. Variabel `NEXT_PUBLIC_*` dibaca saat build, jadi jalankan ulang `npm run dev` / `npm run build` setelah mengubahnya.

Akun demo (mode mock): `admin / admin123`, `petugas / petugas123`, `pimpinan / pimpinan123`.
Akun mode api: akun hasil `backend/scripts/seed_data.py` (`admin / admin123`, `petugas / petugas123`).

### Perintah lain

```bash
npm run build && npm start   # production
npm run build:api            # build mode api
npm run lint                 # ESLint
npm run typecheck            # TypeScript
npm test                     # Vitest (unit, aturan bisnis, mapper API, komponen)
npm run test:e2e             # Playwright (UI) — membangun & menjalankan app otomatis
E2E_API=1 npm run test:e2e   # Playwright integrasi API (backend harus berjalan, build mode api)
```

## Struktur (dokumen Plan bagian 14)

```
frontend/
├── app/
│   ├── layout.tsx            # FeedbackProvider (toast/confirm) + DataProvider
│   ├── page.tsx              # redirect ke halaman awal sesuai role
│   ├── login/                # login lokal / JWT backend + SSO OIDC
│   └── (app)/                # area terautentikasi: dashboard, inventaris, peminjaman, pengembalian,
│                             #   monitoring, notifikasi, qr, laporan, master/[tab], pengguna, audit, pengaturan, profil
├── components/
│   ├── ui/                   # shadcn/ui: button, badge, card, input, label, checkbox/switch, dialog, tabs, form, qr-code …
│   ├── layout/               # AppShell (RBAC per rute), Sidebar, Topbar
│   ├── domain/               # ItemForm, BorrowForm, PhotoGallery/Editor, EmailPreview, status transaksi
│   └── providers/            # DataProvider, FeedbackProvider
├── lib/                      # date, utils, file, export (Excel .xlsx & PDF), constants, navigation, config
│   └── mock/                 # db.ts (store reaktif), seed.ts, defaults.ts (pengaturan, parameter, migrasi)
├── services/                 # aturan bisnis per modul (mode mock) + repo.ts (pintu mutasi untuk halaman)
│   └── api/                  # client.ts (JWT + refresh), endpoints.ts (DTO), sync.ts (adapter mode api)
├── hooks/                    # useAuth/useCan, useDbVersion, usePersistentState, useTitle
├── types/                    # tipe domain
└── tests/                    # unit/ (Vitest) & e2e/ (Playwright)
```

## Arsitektur data

- Halaman membaca store (`lib/mock/db.ts`) secara sinkron dan dirender ulang otomatis lewat `useSyncExternalStore`.
- Semua **mutasi** lewat `services/repo.ts`:
  - mode mock → layanan lokal di `services/*` (aturan bisnis lengkap di browser);
  - mode api → endpoint Flask (`services/api/endpoints.ts`), lalu cache disegarkan dari server (`services/api/sync.ts`).
- `lib/config.ts` (`CAPABILITIES`) menyembunyikan fitur yang belum punya endpoint backend, sehingga UI tidak menjanjikan data yang tidak tersimpan.

### Cakupan mode api (diverifikasi terhadap backend yang berjalan)

| Fitur | Endpoint | Status |
|---|---|---|
| Login, sesi, logout, refresh token | `/auth/login`, `/auth/me`, `/auth/logout`, `/auth/refresh` | ✅ |
| Inventaris: daftar, tambah, ubah, aktif/nonaktif, foto utama, riwayat | `/assets`, `/assets/{id}`, `/assets/{id}/history`, `/assets/{id}/upload-photo` | ✅ |
| Master: peminjam (tambah/ubah/nonaktif/hapus); kategori, lokasi, unit (tambah) | `/borrowers`, `/categories`, `/locations`, `/organizational-units` | ✅ |
| Peminjaman (checkout langsung) & pengembalian (rusak/hilang → laporan kerusakan/kehilangan) | `/borrowings`, `/returns` | ✅ |
| Notifikasi (riwayat, kirim ulang), audit log | `/notifications`, `/audit-logs` | ✅ |
| Dashboard, monitoring, laporan, QR | dihitung di frontend dari data API | ✅ |
| Pengguna/role, pengaturan, template, draf peminjaman, ubah status manual, jalankan scheduler | belum ada endpoint | ⏸️ disembunyikan / disimpan lokal |

### Temuan di backend (tidak diubah — di luar lingkup frontend)

1. `POST/PUT /assets` dengan `purchase_date` → error 500 (`serialize_asset` memanggil `.isoformat()` pada string). Data tetap tersimpan, tetapi respons gagal. Karena itu tahun perolehan tidak dikirim pada mode api.
2. `GET /notifications/templates` → error 500 (`NotificationTemplate` tidak punya atribut `channel`).
3. Endpoint di dokumen bagian 11 berbeda dengan implementasi: `/items` ↔ `/assets`; belum ada `/users`, `/borrowings/{id}/checkout`, `/notifications/{id}/read`, `/dashboard/overdue`, `/dashboard/statistics`.
4. Respons notifikasi belum menyertakan `borrowing_id`, jadi notifikasi dikaitkan ke transaksi terbaru peminjam.

## Catatan fitur

- **Parameter status & kondisi** (Master Data → Status & Kondisi): label & keterangan dapat diubah, kode tetap karena terikat aturan bisnis.
- **Monitoring** mencakup tab *Rusak / hilang* (RUSAK, RUSAK_BERAT, DALAM_PERBAIKAN, HILANG).
- **Foto barang**: hingga 5 foto per barang (`item_photos`), foto pertama = foto utama. Mode api: 1 foto (`photo_path`).
- **Laporan**: unduh **Excel .xlsx** (ExcelJS: header, autofilter, format Rupiah) dan **PDF** (jsPDF: A4 lanskap, kop, nomor halaman, tanda tangan), plus cetak.
- **QR** dibuat lokal (`qrcode`, SVG) — tetap berfungsi offline; pemindaian lewat keyboard scanner atau kamera (BarcodeDetector).
- RBAC dua lapis di antarmuka: menu/tombol per permission dan penolakan rute (403) di `lib/navigation.ts`.
