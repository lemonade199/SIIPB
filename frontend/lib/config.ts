/**
 * Sumber data aplikasi.
 * - `mock` (bawaan): data contoh di localStorage browser — untuk demo & Sprint Review tanpa backend.
 * - `api`: data dari Flask REST API (`NEXT_PUBLIC_API_BASE_URL`), login JWT backend.
 */
export type DataSource = 'mock' | 'api';

export const DATA_SOURCE: DataSource = process.env.NEXT_PUBLIC_DATA_SOURCE === 'api' ? 'api' : 'mock';
export const isApiMode = DATA_SOURCE === 'api';

/**
 * Fitur yang tersedia per sumber data. Seluruh fitur dokumen Plan kini memiliki endpoint backend,
 * sehingga perbedaannya hanya pada fitur khusus demo (geser tanggal sistem) dan backup JSON lokal.
 */
export interface Capabilities {
  drafts: boolean;
  manualItemStatus: boolean;
  acquisitionSource: boolean;
  acquisitionYear: boolean;
  multiPhoto: boolean;
  returnDate: boolean;
  /** Jalankan pemeriksaan jatuh tempo secara manual. */
  scheduler: boolean;
  /** Mode demo: geser tanggal sistem (hanya mode mock; di server tanggal = jam server). */
  demoClock: boolean;
  userAdmin: boolean;
  changePassword: boolean;
  serverSettings: boolean;
  /** Backup/restore berkas JSON di browser (mode mock). Mode api: mysqldump di server. */
  localBackup: boolean;
  masterEdit: Record<'peminjam' | 'kategori' | 'lokasi' | 'unit', boolean>;
}

const ALL_MASTER = { peminjam: true, kategori: true, lokasi: true, unit: true };

export const CAPABILITIES: Capabilities = {
  drafts: true,
  manualItemStatus: true,
  acquisitionSource: true,
  acquisitionYear: true,
  multiPhoto: true,
  returnDate: true,
  scheduler: true,
  demoClock: !isApiMode,
  userAdmin: true,
  changePassword: true,
  serverSettings: true,
  localBackup: !isApiMode,
  masterEdit: ALL_MASTER,
};
