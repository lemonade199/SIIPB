# Panduan Konfigurasi SSO (OIDC) & SMTP — SIIPB

Dokumen ini menjelaskan cara mengaktifkan **Sign in with SSO** (OAuth 2.0 + OpenID Connect) dan **pengiriman email SMTP** (notifikasi peminjaman & pengingat jatuh tempo). Semua konfigurasi dilakukan dari **Pengaturan** di aplikasi, tanpa mengubah `.env` dan tanpa restart.

---

## 1. Sign in with SSO (OIDC)

### Cara kerja

```
Pengguna klik "Sign in with SSO"
  → GET /api/v1/auth/sso            (backend membuat state + nonce, redirect ke Identity Provider)
  → login di Google / Microsoft / Keycloak
  → GET /api/v1/auth/sso/callback   (backend memvalidasi state & nonce, mencocokkan email pengguna)
  → redirect ke /login#sso_code=…   (kode sekali pakai, berlaku 60 detik)
  → POST /api/v1/auth/sso/exchange  (frontend menukar kode dengan token JWT)
```

- Pengguna SSO **harus sudah terdaftar** di menu **Pengguna** dengan email yang sama dengan akun SSO-nya. SSO tidak membuat akun baru secara otomatis.
- Login pertama menautkan akun SSO ke pengguna tersebut. Login berikutnya dicocokkan lewat ID akun SSO (`sub`).
- Tombol SSO di halaman login baru aktif jika SSO **dicentang** dan **Issuer, Client ID, dan Client Secret sudah lengkap**.
- Client Secret disimpan **terenkripsi** di database dan tidak pernah dikirim kembali ke browser.
- URL lama `/api/v1/auth/google` dan `/api/v1/auth/google/callback` tetap berfungsi sebagai alias.

### Langkah A — Membuat OAuth Client di Google Cloud

1. Buka <https://console.cloud.google.com/> dan pilih atau buat project.
2. Buka **APIs & Services → OAuth consent screen**:
   - User type **Internal** jika memakai Google Workspace instansi (hanya akun domain instansi yang bisa login), atau **External** untuk akun Gmail biasa.
   - Isi nama aplikasi (mis. `SIIPB`), email dukungan, lalu simpan.
   - Untuk tipe External dalam mode *Testing*, tambahkan email penguji di **Test users**.
3. Buka **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: `SIIPB`
   - **Authorized redirect URIs**: salin dari kolom **Redirect URI** di halaman *Pengaturan → Keamanan & SSO*. Contoh:
     - Lokal (Docker + Nginx): `http://localhost/api/v1/auth/sso/callback`
     - Server: `https://siipb.instansi.go.id/api/v1/auth/sso/callback`
4. Klik **Create**, lalu catat **Client ID** dan **Client Secret**.

### Langkah B — Mengisi Pengaturan SIIPB

Login sebagai admin, lalu buka **Pengaturan → Keamanan & SSO**:

| Kolom | Isi |
|---|---|
| Aktifkan login SSO | ✅ centang |
| Issuer / Identity Provider | `https://accounts.google.com` |
| Client ID | Client ID dari Google |
| Client secret | Client Secret dari Google (kosongkan saat menyimpan ulang jika tidak diubah) |

Klik **Simpan**. Jika muncul tulisan **"SSO siap"**, tombol **Sign in with SSO** di halaman login sudah aktif.

### Identity Provider lain

| Provider | Issuer | Redirect URI didaftarkan di |
|---|---|---|
| Google | `https://accounts.google.com` | Google Cloud Console → Credentials |
| Microsoft Entra ID | `https://login.microsoftonline.com/<tenant-id>/v2.0` | Entra ID → App registrations → Authentication (platform *Web*) |
| Keycloak | `https://<host>/realms/<realm>` | Keycloak → Clients → *Valid redirect URIs* (Client authentication: ON) |

Setiap provider wajib mendukung OpenID Connect discovery (`<issuer>/.well-known/openid-configuration`) dan scope `openid email profile`.

### Alternatif lewat `.env` (opsional)

Jika Issuer/Client ID di Pengaturan dibiarkan kosong, backend memakai Google dari environment:

```
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxx
```

SSO tetap harus dicentang di Pengaturan.

### Masalah yang sering terjadi

| Pesan | Penyebab & solusi |
|---|---|
| `redirect_uri_mismatch` (halaman Google) | Redirect URI di Google tidak sama persis dengan yang tampil di Pengaturan (cek http/https, port, garis miring di akhir). |
| "Akun internal dengan identitas OAuth ini belum terdaftar di sistem" | Email akun SSO belum terdaftar di menu **Pengguna**. Tambahkan pengguna dengan email yang sama. |
| "Email akun SSO belum terverifikasi" | Email di Identity Provider belum diverifikasi. |
| "Akun dinonaktifkan" | Pengguna dinonaktifkan di SIIPB. |
| Tombol SSO memunculkan "SSO belum diaktifkan" | Konfigurasi belum lengkap (lihat status di Pengaturan). |
| Redirect memakai `http` padahal situs `https` | Pastikan `TRUST_PROXY=1` pada backend di belakang Nginx. |

---

## 2. Email SMTP

Tanpa username dan password SMTP, email hanya **disimulasikan**: tercatat di riwayat notifikasi sebagai terkirim, tapi tidak benar-benar dikirim. Isi kredensial agar email sampai ke peminjam.

### Langkah A — App Password Gmail

Gmail tidak menerima kata sandi akun biasa untuk SMTP. Gunakan **App Password**:

1. Aktifkan **2-Step Verification** di <https://myaccount.google.com/security>.
2. Buka <https://myaccount.google.com/apppasswords>, buat App Password (nama mis. `SIIPB`).
3. Salin 16 karakter yang muncul (spasi boleh dihapus).

> Untuk Google Workspace instansi, admin domain mungkin perlu mengizinkan App Password, atau gunakan SMTP relay instansi.

### Langkah B — Mengisi Pengaturan SIIPB

Buka **Pengaturan → SMTP**:

| Kolom | Gmail | Microsoft 365 |
|---|---|---|
| Host | `smtp.gmail.com` | `smtp.office365.com` |
| Port | `587` | `587` |
| Enkripsi | `STARTTLS` | `STARTTLS` |
| Username | alamat Gmail pengirim | alamat email pengirim |
| Kata sandi SMTP | App Password | kata sandi / app password |
| Email pengirim | sama dengan username (Gmail menolak alamat lain kecuali sudah didaftarkan sebagai alias) | sama dengan username |

Klik **Simpan**, lalu **Kirim email uji**. Email uji dikirim ke alamat email akun admin yang sedang login. Jika berhasil, notifikasi checkout, pengembalian, dan pengingat H-3 … H+7 akan terkirim lewat server ini.

Kata sandi SMTP disimpan terenkripsi (Fernet, kunci dari `SECRET_KEY`). **Jangan mengganti `SECRET_KEY`** setelah kata sandi tersimpan. Jika diganti, isi ulang kata sandi SMTP dan Client Secret SSO.

### Masalah yang sering terjadi

| Pesan | Penyebab & solusi |
|---|---|
| `535 Username and Password not accepted` | Memakai kata sandi akun biasa. Gunakan App Password. |
| `timed out` / `Connection refused` | Port diblokir firewall/ISP. Coba port `465` dengan enkripsi `SSL/TLS`. |
| Email masuk folder spam | Gunakan email pengirim yang sama dengan akun SMTP; untuk domain instansi atur SPF/DKIM. |
