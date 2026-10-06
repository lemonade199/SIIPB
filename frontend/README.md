# SIIPB — Frontend (Next.js + React + TypeScript)

Konversi mockup HTML/JS SIIPB ke **Next.js 16 (App Router) + React 19 + TypeScript (strict) + Tailwind CSS v4**, dengan komponen bergaya shadcn/ui dan ikon `lucide-react`. Semua halaman, alur, aturan bisnis, dan RBAC dari mockup sudah dipindahkan.

## Menjalankan

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
npm run build && npm start   # mode production
npm run lint
```

Akun demo: `admin / admin123`, `petugas / petugas123`, `pimpinan / pimpinan123`.

## Struktur (sesuai bagian 14 dokumen Plan)

```
frontend/
├── app/
│   ├── layout.tsx              # root: FeedbackProvider (toast/confirm) + DataProvider
│   ├── page.tsx                # redirect ke halaman awal sesuai role
│   ├── (auth)/login/           # login lokal + simulasi SSO OIDC
│   └── (app)/                  # area terautentikasi (AppShell: sidebar, topbar, RBAC per rute)
│       ├── dashboard/  inventaris/[id]/ubah  inventaris/baru
│       ├── peminjaman/[id]/ubah  peminjaman/baru
│       ├── pengembalian/[id]  pengembalian/baru
│       ├── monitoring/  notifikasi/  qr/  laporan/
│       ├── master/[tab]/  pengguna/  audit/  pengaturan/  profil/
├── components/
│   ├── ui/          # Button, Card, Badge, Field/Input/Select, Modal, Tabs, Pager, QrCode, Icon …
│   ├── layout/      # AppShell, Sidebar, Topbar
│   ├── domain/      # ItemForm, BorrowForm, EmailPreview, BorrowBadge/DueText
│   └── providers/   # DataProvider, FeedbackProvider (useToast, useConfirm)
├── lib/             # date, utils, file (CSV/unduh/foto), constants, navigation (menu + izin rute)
│   └── mock/        # db.ts (store localStorage reaktif) + seed.ts (data contoh)
├── services/        # aturan bisnis: auth, inventory, borrowing, return, notification,
│   │                #   scheduler, dashboard, report, master, users, settings, backup, audit
│   └── api/         # HTTP client Flask REST API /api/v1 (JWT + refresh) & endpoint bertipe
├── hooks/           # useAuth/useCan, useDbVersion, usePersistentState, useTitle
└── types/           # tipe domain (kontrak data frontend ↔ backend)
```

## Lapisan data

- **Sekarang (mockup fungsional):** `services/*` menjalankan aturan bisnis di atas `lib/mock/db.ts` (localStorage). Setiap `db.save()` memicu render ulang lewat `useSyncExternalStore`, sehingga UI selalu sinkron.
- **Integrasi backend:** `services/api/client.ts` sudah menangani envelope `{ success, message, data, meta, errors }`, header `Authorization: Bearer`, dan refresh token otomatis. `services/api/endpoints.ts` memetakan endpoint yang tersedia di `backend/app/routes` (auth, assets, borrowings, returns, master, notifications, dashboard, audit-logs). Atur base URL di `.env`:

  ```
  NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1
  ```

  Langkah integrasi per modul: ganti pemanggilan fungsi di `services/<modul>.ts` dengan pemanggilan `services/api/endpoints.ts` (disarankan dibungkus TanStack Query), lalu petakan DTO backend (`inventory_code`, `name`, …) ke tipe di `types/`.
  Catatan: backend belum menyediakan endpoint untuk pengguna/role, pengaturan, laporan, scheduler manual, dan QR — modul tersebut tetap memakai adapter mock sampai endpoint-nya tersedia.

## Catatan teknis

- RBAC dua lapis di antarmuka: menu/tombol disembunyikan per permission, dan `lib/navigation.ts` menolak rute (tampilan 403) bila izin tidak cukup.
- QR dibuat lokal dengan pustaka `qrcode` (SVG) — tidak lagi bergantung CDN, berfungsi offline.
- Filter & pencarian daftar dipertahankan saat berpindah halaman (`usePersistentState`).
- Cetak bukti/label/laporan memakai CSS `@media print` (PDF via "Simpan sebagai PDF").
