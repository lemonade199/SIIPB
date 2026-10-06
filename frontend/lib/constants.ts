import type {
  BorrowStatus,
  Condition,
  ItemStatus,
  NotificationEvent,
  Permission,
  ReportType,
  ReturnConditionKey,
} from '@/types';

export const APP_NAME = 'SIIPB';
export const APP_FULL_NAME = 'Sistem Informasi Inventaris Barang, Peminjaman, dan Pengembalian Barang';

export const PERMISSIONS: Permission[] = [
  { key: 'dashboard.view', group: 'Dashboard', label: 'Melihat dashboard & statistik' },
  { key: 'inventory.view', group: 'Inventaris', label: 'Melihat data inventaris' },
  { key: 'inventory.manage', group: 'Inventaris', label: 'Tambah, ubah, nonaktifkan barang' },
  { key: 'masterdata.manage', group: 'Master Data', label: 'Kelola kategori, lokasi, peminjam, unit kerja' },
  { key: 'borrowing.view', group: 'Transaksi', label: 'Melihat transaksi peminjaman & pengembalian' },
  { key: 'borrowing.manage', group: 'Transaksi', label: 'Mencatat peminjaman & checkout' },
  { key: 'return.manage', group: 'Transaksi', label: 'Mencatat pengembalian' },
  { key: 'monitoring.view', group: 'Monitoring', label: 'Monitoring jatuh tempo & keterlambatan' },
  { key: 'notification.view', group: 'Notifikasi', label: 'Melihat riwayat & log notifikasi' },
  { key: 'notification.manage', group: 'Notifikasi', label: 'Menjalankan pemeriksaan & kirim ulang' },
  { key: 'qr.manage', group: 'QR/Barcode', label: 'Membuat & mencetak label QR' },
  { key: 'report.view', group: 'Laporan', label: 'Melihat laporan' },
  { key: 'report.export', group: 'Laporan', label: 'Unduh laporan PDF/Excel & cetak' },
  { key: 'audit.view', group: 'Audit & Pengaturan', label: 'Melihat audit log' },
  { key: 'users.manage', group: 'Audit & Pengaturan', label: 'Kelola pengguna, role & permission' },
  { key: 'settings.manage', group: 'Audit & Pengaturan', label: 'SMTP, template, aturan notifikasi, backup' },
];

export const ITEM_STATUS: ItemStatus[] = ['TERSEDIA', 'DIPINJAM', 'RUSAK', 'RUSAK_BERAT', 'DALAM_PERBAIKAN', 'HILANG'];
/** Barang dengan status ini tidak muncul saat pencatatan peminjaman. */
export const NOT_BORROWABLE: ItemStatus[] = ['RUSAK_BERAT', 'HILANG', 'DALAM_PERBAIKAN'];

export const CONDITIONS: Record<Condition, string> = {
  BAIK: 'Baik',
  RUSAK_RINGAN: 'Rusak ringan',
  RUSAK_BERAT: 'Rusak berat',
};

export const BORROW_STATUS: BorrowStatus[] = ['DRAF', 'DIPINJAM', 'TERLAMBAT', 'DIKEMBALIKAN', 'DIBATALKAN'];

export interface ReturnConditionRule {
  key: ReturnConditionKey;
  label: string;
  item_status: ItemStatus;
  condition: Condition | null;
}
export const RETURN_CONDITIONS: ReturnConditionRule[] = [
  { key: 'BAIK', label: 'Baik — siap dipinjam lagi', item_status: 'TERSEDIA', condition: 'BAIK' },
  { key: 'RUSAK', label: 'Rusak ringan', item_status: 'RUSAK', condition: 'RUSAK_RINGAN' },
  { key: 'DALAM_PERBAIKAN', label: 'Rusak — langsung diperbaiki', item_status: 'DALAM_PERBAIKAN', condition: 'RUSAK_RINGAN' },
  { key: 'RUSAK_BERAT', label: 'Rusak berat', item_status: 'RUSAK_BERAT', condition: 'RUSAK_BERAT' },
  { key: 'HILANG', label: 'Hilang', item_status: 'HILANG', condition: null },
];

export const EVENT_LABEL: Record<NotificationEvent, string> = {
  CHECKOUT: 'Konfirmasi peminjaman',
  'H-3': 'Pengingat H-3',
  'H-1': 'Pengingat H-1',
  H: 'Hari jatuh tempo',
  'H+1': 'Terlambat H+1',
  'H+3': 'Eskalasi H+3',
  'H+7': 'Eskalasi lanjutan H+7',
  PENGEMBALIAN: 'Konfirmasi pengembalian',
};

export const REPORTS: Record<ReportType, { label: string; desc: string; icon: 'box' | 'out' | 'in' | 'clock' | 'alert' }> = {
  inventaris: { label: 'Inventaris', desc: 'Daftar barang per kategori, lokasi, kondisi, status', icon: 'box' },
  peminjaman: { label: 'Peminjaman', desc: 'Transaksi per periode dan unit kerja', icon: 'out' },
  pengembalian: { label: 'Pengembalian', desc: 'Tanggal, kondisi, kelengkapan barang kembali', icon: 'in' },
  keterlambatan: { label: 'Keterlambatan', desc: 'Transaksi terlambat dan eskalasi', icon: 'clock' },
  kerusakan: { label: 'Kerusakan & kehilangan', desc: 'Barang rusak, dalam perbaikan, hilang', icon: 'alert' },
};

export const TEMPLATE_PLACEHOLDERS = [
  'nama_peminjam',
  'kode_transaksi',
  'daftar_barang',
  'tanggal_pinjam',
  'batas_kembali',
  'tujuan',
  'hari_terlambat',
  'nama_petugas',
  'kontak_petugas',
  'lokasi_pengembalian',
  'nama_instansi',
  'tanggal_kembali',
  'daftar_barang_kembali',
];

export const STORAGE_KEYS = {
  db: 'siipb.db.v1',
  session: 'siipb.session',
} as const;

export const DEMO_ACCOUNTS = [
  { username: 'admin', password: 'admin123', role: 'Administrator' },
  { username: 'petugas', password: 'petugas123', role: 'Petugas Sarpras/IT' },
  { username: 'pimpinan', password: 'pimpinan123', role: 'Pimpinan' },
];
