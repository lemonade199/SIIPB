# SIIPB Frontend Workspace

Direktori ini didedikasikan untuk aplikasi klien / frontend antarmuka pengguna (UI/UX) SIIPB.

---

## 🌐 Koneksi ke Backend API

Backend SIIPB berjalan pada `http://localhost:5000/api` dengan **CORS telah diaktifkan secara otomatis** untuk seluruh port frontend lokal (`localhost:5173`, `localhost:3000`, dll.).

### Konfigurasi Environment Klien
Salin `.env.example` ke `.env`:
```bash
cp .env.example .env
```

Contoh konfigurasi endpoint (Vite/React/Vue):
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## 📡 Endpoint Utama yang Tersedia untuk Frontend

| Method | Endpoint | Fungsi | Contoh Penggunaan FE |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Status API & Database | Status bar / Ping koneksi |
| `GET` | `/api/assets` | Daftar katalog inventaris | Halaman Katalog & Pencarian Aset |
| `GET` | `/api/assets?status=TERSEDIA` | Filter barang tersedia | Modal pemilihan barang checkout |
| `GET` | `/api/assets?q=ThinkPad` | Pencarian nama / kode aset | Input search / Scanner QR |
| `GET` | `/api/assets/:id` | Detail spesifikasi aset | Halaman detail aset |
| `POST` | `/api/auth/login` | Login petugas / staf | Halaman Login (Username & Password) |

> [!NOTE]
> **Peminjam tidak memiliki login/akun**. Halaman login hanya diperuntukkan bagi petugas, staf sarpras, dan pimpinan (RBAC).

---

## 📖 Dokumentasi Lengkap
Lihat panduan kontrak REST API lengkap di [docs/api_specification.md](../docs/api_specification.md).
