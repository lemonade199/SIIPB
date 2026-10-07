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
Akun mode api: akun hasil `backend/scripts/seed_data.py` (`admin / admin123`, `petugas / petugas123`, `pimpinan / pimpinan123`; di Docker diatur lewat `SEED_*_PASSWORD`). Daftar akun di halaman login mode api hanya tampil bila `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=true`.

### Perintah lain

```bash
npm run build && npm start   # production
npm run build:api            # build mode api
docker build -t siipb-frontend --build-arg NEXT_PUBLIC_API_BASE_URL=/api/v1 .   # image standalone
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
- `lib/config.ts` (`CAPABILITIES`): seluruh fitur dokumen Plan tersedia di kedua mode; hanya *mode demo geser tanggal* dan backup JSON lokal yang khusus mode mock.
- Mode api menyegarkan cache tiap 60 detik dan saat tab kembali aktif. `NEXT_PUBLIC_API_BASE_URL` boleh relatif (`/api/v1`) bila frontend & API di balik Nginx yang sama.

### Cakupan mode api (diuji Playwright terhadap backend yang berjalan, langsung & lewat Nginx)

| Fitur | Endpoint |
|---|---|
| Login JWT, refresh, logout, profil, ganti kata sandi, SSO OIDC | `/auth/*` |
| Pengguna, role & matriks permission | `/users`, `/roles`, `/permissions` |
| Inventaris: tambah/ubah, tahun & sumber perolehan, ≤5 foto, status manual, aktif/nonaktif, riwayat | `/items` (`/assets`) |
| Master data: tambah/ubah/nonaktif/hapus (peminjam, kategori, lokasi, unit kerja) + parameter status/kondisi | `/borrowers`, `/categories`, `/locations`, `/organizational-units`, `/settings` |
| Peminjaman: draf, ubah draf, checkout, batal | `/borrowings`, `/borrowings/{id}/checkout|cancel` |
| Pengembalian: kondisi, kelengkapan, rusak/perbaikan/hilang, tanggal kembali, konfirmasi email | `/returns` |
| Notifikasi: riwayat per penerima, log pengiriman, tandai terbaca, kirim ulang, template | `/notifications/*` |
| Scheduler manual & riwayat | `/scheduler/run`, `/scheduler/runs` |
| Laporan PDF (WeasyPrint) & Excel (openpyxl) | `/reports/{jenis}?format=pdf|xlsx` |
| Pengaturan (umum, SMTP + kata sandi terenkripsi, penjadwal, aturan H-3…H+7, keamanan), backup | `/settings`, `/backups` |
| Audit log | `/audit-logs` |

## Catatan fitur

- **Parameter status & kondisi** (Master Data → Status & Kondisi): label & keterangan dapat diubah, kode tetap karena terikat aturan bisnis.
- **Monitoring** mencakup tab *Rusak / hilang* (RUSAK, RUSAK_BERAT, DALAM_PERBAIKAN, HILANG).
- **Foto barang**: hingga 5 foto per barang (`asset_photos`), foto pertama = foto utama.
- **Laporan**: unduh **PDF** dan **Excel .xlsx** — mode api dibuat server (WeasyPrint/openpyxl, tercatat di audit log); mode mock dibuat di browser (jsPDF/ExcelJS); plus cetak.
- **QR** dibuat lokal (`qrcode`, SVG) — tetap berfungsi offline; pemindaian lewat keyboard scanner atau kamera (BarcodeDetector).
- RBAC dua lapis di antarmuka: menu/tombol per permission dan penolakan rute (403) di `lib/navigation.ts`.
