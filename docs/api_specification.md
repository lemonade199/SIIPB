# Spesifikasi REST API SIIPB (Frontend - Backend Contract)

Dokumen ini mendefinisikan standar komunikasi REST API antara **Frontend** dan **Backend** sistem SIIPB.

---

## 📐 Standar Respon JSON

Seluruh respon API mengikuti struktur seragam:

### Sukses:
```json
{
  "status": "success",
  "data": { ... },
  "message": "Operasi berhasil"
}
```

### Error:
```json
{
  "status": "error",
  "message": "Pesan deskripsi error",
  "errors": { ... }
}
```

---

## 🔑 1. Autentikasi (`/api/auth`)

### `POST /api/auth/login`
Autentikasi akun petugas/admin/pimpinan. (*Peminjam tidak memiliki akun login*).

**Request Body:**
```json
{
  "username": "petugas",
  "password": "password123"
}
```

**Response 200 OK:**
```json
{
  "status": "success",
  "data": {
    "access_token": "eyJhbGciOi...",
    "refresh_token": "d7a8e...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "user": {
      "id": 1,
      "username": "petugas",
      "full_name": "Budi Sarpras",
      "roles": ["SARPRAS"],
      "permissions": ["asset.view", "borrowing.create", "borrowing.return"]
    }
  }
}
```

---

## 📦 2. Inventaris & Aset (`/api/assets`)

### `GET /api/assets`
Mengambil daftar aset dengan filter dan pencarian.

**Query Parameters:**
- `status`: `TERSEDIA`, `DIPINJAM`, `RUSAK`, `RUSAK_BERAT`, `DALAM_PERBAIKAN`, `HILANG`, `NONAKTIF`
- `q`: Kata kunci pencarian (nama barang, `inventory_code`, atau `serial_number`)
- `category_id`: ID kategori
- `location_id`: ID lokasi

**Response 200 OK:**
```json
{
  "status": "success",
  "count": 2,
  "data": [
    {
      "id": 1,
      "inventory_code": "AST-RPL-001",
      "name": "ThinkPad T480s",
      "brand": "Lenovo",
      "model": "T480s",
      "serial_number": "PF-XYZ123",
      "status": "TERSEDIA",
      "condition": "BAIK",
      "category_id": 1,
      "location_id": 2,
      "is_borrowable": true
    }
  ]
}
```

### `GET /api/assets/:id`
Mengambil informasi lengkap satu aset beserta spesifikasi dan riwayat singkat.

---

## 📋 3. Transaksi Peminjaman (`/api/borrowings`)

### `POST /api/borrowings`
Membuat transaksi peminjaman baru (Checkout).

**Headers:**
`Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "borrower_id": 1,
  "start_date": "2026-10-06",
  "due_date": "2026-10-09",
  "purpose": "Praktikum Pemrograman Web",
  "notes": "Dipinjam beserta adaptor",
  "asset_ids": [1, 2]
}
```

**Response 201 Created:**
```json
{
  "status": "success",
  "message": "Peminjaman berhasil dibuat",
  "data": {
    "id": 10,
    "transaction_number": "TX-2026-0012",
    "status": "AKTIF",
    "borrower": {
      "id": 1,
      "name": "Ahmad Pratama",
      "identity_number": "NISN-0051234567"
    },
    "items_count": 2,
    "borrowed_at": "2026-10-06T09:30:00.000000",
    "due_date": "2026-10-09"
  }
}
```

---

## 🔄 4. Transaksi Pengembalian (`/api/returns`)

### `POST /api/returns`
Memproses pengembalian barang (dapat berupa pengembalian sebagian / parsial).

**Request Body:**
```json
{
  "borrowing_id": 10,
  "notes": "Barang dikembalikan tepat waktu",
  "items": [
    {
      "borrowing_item_id": 1,
      "asset_id": 1,
      "final_condition": "BAIK",
      "completeness": "Lengkap dengan tas dan adaptor"
    },
    {
      "borrowing_item_id": 2,
      "asset_id": 2,
      "final_condition": "RUSAK",
      "completeness": "Adaptor ada",
      "damage": {
        "severity": "SEDANG",
        "description": "Engsel layar goyang dan casing retak",
        "repair_cost": 450000.00
      }
    }
  ]
}
```

**Response 200 OK:**
```json
{
  "status": "success",
  "message": "Pengembalian berhasil dicatat",
  "data": {
    "return_id": 5,
    "returned_at": "2026-10-08T14:15:00.000000",
    "items_processed": 2,
    "damage_reports_created": 1
  }
}
```

---

## 👥 5. Master Data Peminjam (`/api/borrowers`)

### `GET /api/borrowers`
Mengambil daftar peminjam (Siswa, Guru, Staf).
- Tidak memiliki kredensial login.
- Riwayat peminjaman dilindungi `ON DELETE RESTRICT`.
