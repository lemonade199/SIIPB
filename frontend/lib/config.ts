/**
 * Sumber data aplikasi.
 * - `mock` (bawaan): data contoh di localStorage browser — untuk demo & Sprint Review tanpa backend.
 * - `api`: data dari Flask REST API (`NEXT_PUBLIC_API_BASE_URL`), login JWT backend.
 */
export type DataSource = 'mock' | 'api';

export const DATA_SOURCE: DataSource = process.env.NEXT_PUBLIC_DATA_SOURCE === 'api' ? 'api' : 'mock';
export const isApiMode = DATA_SOURCE === 'api';

/**
 * Fitur yang tersedia per sumber data. Di mode `api`, fitur yang belum memiliki endpoint
 * di backend disembunyikan/dinonaktifkan agar UI tidak menjanjikan hal yang tidak tersimpan.
 */
export interface Capabilities {
  /** Draf peminjaman (backend langsung checkout saat transaksi dibuat). */
  drafts: boolean;
  /** Ubah status barang manual (AssetUpdateSchema belum menerima `status`). */
  manualItemStatus: boolean;
  /** Field sumber perolehan (tidak ada kolom di tabel assets). */
  acquisitionSource: boolean;
  /**
   * Tahun perolehan (`purchase_date`). Di backend saat ini POST/PUT /assets dengan purchase_date
   * menyebabkan error 500 saat serialisasi (bug serialize_asset), jadi dinonaktifkan di mode api.
   */
  acquisitionYear: boolean;
  /** Banyak foto per barang (backend: satu `photo_path`). */
  multiPhoto: boolean;
  /** Tanggal pengembalian dapat dipilih (backend memakai waktu server). */
  returnDate: boolean;
  /** Jalankan scheduler manual & mode demo (backend: Celery Beat). */
  scheduler: boolean;
  /** Kelola pengguna & role (belum ada endpoint /users, /roles). */
  userAdmin: boolean;
  /** Ganti kata sandi sendiri. */
  changePassword: boolean;
  /** Pengaturan disimpan ke server (saat ini hanya tersimpan di browser). */
  serverSettings: boolean;
  /** Master data: ubah / nonaktifkan / hapus per jenis. */
  masterEdit: Record<'peminjam' | 'kategori' | 'lokasi' | 'unit', boolean>;
}

export const CAPABILITIES: Capabilities = isApiMode
  ? {
      drafts: false,
      manualItemStatus: false,
      acquisitionSource: false,
      acquisitionYear: false,
      multiPhoto: false,
      returnDate: false,
      scheduler: false,
      userAdmin: false,
      changePassword: false,
      serverSettings: false,
      masterEdit: { peminjam: true, kategori: false, lokasi: false, unit: false },
    }
  : {
      drafts: true,
      manualItemStatus: true,
      acquisitionSource: true,
      acquisitionYear: true,
      multiPhoto: true,
      returnDate: true,
      scheduler: true,
      userAdmin: true,
      changePassword: true,
      serverSettings: true,
      masterEdit: { peminjam: true, kategori: true, lokasi: true, unit: true },
    };
