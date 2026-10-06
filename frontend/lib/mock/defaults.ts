/**
 * Nilai bawaan: role, pengaturan, template email, parameter status/kondisi,
 * serta migrasi data lama di storage browser agar tetap kompatibel.
 */
import { PERMISSIONS } from '@/lib/constants';
import type { DbData, EmailTemplate, Parameters, Role, Settings } from '@/types';

type At = (n: number, hh?: string) => string;

export function defaultParameters(): Parameters {
  return {
    item_status: {
      TERSEDIA: { label: 'Tersedia', desc: 'Siap dipinjam.' },
      DIPINJAM: { label: 'Dipinjam', desc: 'Sedang dibawa peminjam (diberikan otomatis saat checkout).' },
      RUSAK: { label: 'Rusak', desc: 'Rusak ringan; masih dapat dipinjam setelah diperiksa ulang.' },
      RUSAK_BERAT: { label: 'Rusak berat', desc: 'Tidak layak pakai; tidak dapat dipinjam.' },
      DALAM_PERBAIKAN: { label: 'Dalam perbaikan', desc: 'Sedang diservis; tidak dapat dipinjam.' },
      HILANG: { label: 'Hilang', desc: 'Tidak ditemukan; tidak dapat dipinjam.' },
    },
    condition: {
      BAIK: { label: 'Baik', desc: 'Berfungsi normal dan lengkap.' },
      RUSAK_RINGAN: { label: 'Rusak ringan', desc: 'Ada kerusakan kecil, masih dapat digunakan.' },
      RUSAK_BERAT: { label: 'Rusak berat', desc: 'Tidak dapat digunakan.' },
    },
  };
}

export function defaultRoles(): Role[] {
  const allPerms = PERMISSIONS.map((p) => p.key);
  return [
    { id: 1, code: 'admin', name: 'Administrator', description: 'Pengaturan sistem, pengguna, role, permission, seluruh data.', permissions: allPerms.slice(), system: true },
    {
      id: 2,
      code: 'petugas',
      name: 'Petugas Sarpras/IT',
      description: 'Mengelola inventaris, mencatat peminjaman/pengembalian, monitoring, laporan.',
      system: true,
      permissions: ['dashboard.view', 'inventory.view', 'inventory.manage', 'masterdata.manage', 'borrowing.view', 'borrowing.manage', 'return.manage', 'monitoring.view', 'notification.view', 'notification.manage', 'qr.manage', 'report.view', 'report.export'],
    },
    {
      id: 3,
      code: 'pimpinan',
      name: 'Pimpinan',
      description: 'Melihat dashboard, laporan, monitoring dan eskalasi.',
      system: true,
      permissions: ['dashboard.view', 'inventory.view', 'borrowing.view', 'monitoring.view', 'notification.view', 'report.view', 'report.export'],
    },
  ];
}

export function defaultSettings(at: At): Settings {
  return {
    parameters: defaultParameters(),
    institution: 'Instansi Contoh',
    unit_sarpras: 'Bagian Sarana & Prasarana / IT',
    staff_email: 'sarpras@siipb.local',
    staff_phone: 'ext. 1020',
    return_location: 'Ruang Sarpras, Gedung A Lt. 1',
    smtp: { host: 'smtp.siipb.local', port: 587, username: 'no-reply@siipb.local', encryption: 'STARTTLS', from_name: 'SIIPB Sarpras', from_email: 'no-reply@siipb.local', simulate_failure: false },
    scheduler: { enabled: true, time: '08:00', timezone: 'Asia/Jakarta', last_run_date: null },
    checkout_notify: true,
    return_notify: true,
    rules: [
      { event: 'H-3', days: -3, active: true, to: ['peminjam'], template: 'tpl_h_min3', desc: 'Pengingat batas pengembalian' },
      { event: 'H-1', days: -1, active: true, to: ['peminjam'], template: 'tpl_h_min1', desc: 'Pengingat satu hari sebelum jatuh tempo' },
      { event: 'H', days: 0, active: true, to: ['peminjam'], template: 'tpl_h', desc: 'Hari ini batas pengembalian' },
      { event: 'H+1', days: 1, active: true, to: ['peminjam'], template: 'tpl_h_plus1', desc: 'Pemberitahuan sudah terlambat' },
      { event: 'H+3', days: 3, active: true, to: ['peminjam', 'petugas'], template: 'tpl_h_plus3', desc: 'Eskalasi keterlambatan' },
      { event: 'H+7', days: 7, active: true, to: ['peminjam', 'petugas', 'pimpinan'], template: 'tpl_h_plus7', desc: 'Eskalasi lanjutan' },
    ],
    security: { jwt_access_minutes: 15, jwt_refresh_days: 7, session_hours: 8, oidc_enabled: true, oidc_issuer: 'https://sso.siipb.local/realms/instansi', oidc_client_id: 'siipb-web', upload_max_mb: 2, upload_types: 'JPG, PNG, WEBP' },
    backup: {
      schedule: 'Harian 01.00 WIB',
      retention_days: 14,
      history: [
        { at: at(-2, '01:00'), type: 'Terjadwal', size_kb: 412, status: 'SUKSES', by: 'system' },
        { at: at(-1, '01:00'), type: 'Terjadwal', size_kb: 418, status: 'SUKSES', by: 'system' },
      ],
      last_restore_test: at(-15, '10:00'),
    },
    demo_offset_days: 0,
  };
}

export function defaultTemplates(at: At): EmailTemplate[] {
  const list: EmailTemplate[] = [];
  const tpl = (code: string, name: string, subject: string, body: string): EmailTemplate => ({
    id: list.length + 1,
    code,
    name,
    subject,
    body,
    updated_at: at(-60),
  });
  const FOOT =
    '\n\nKontak petugas: {{nama_petugas}} ({{kontak_petugas}})\nTempat pengembalian: {{lokasi_pengembalian}}\n\nEmail ini dikirim otomatis oleh SIIPB {{nama_instansi}}. Anda tidak perlu login, mengisi formulir, atau membalas email ini.';
  const push = (t: EmailTemplate) => list.push(t);
  push(tpl('tpl_checkout', 'Konfirmasi peminjaman', '[SIIPB] Peminjaman {{kode_transaksi}} — kembalikan paling lambat {{batas_kembali}}',
    'Yth. {{nama_peminjam}},\n\nPetugas Sarpras/IT telah mencatat peminjaman barang atas nama Anda:\n\n{{daftar_barang}}\n\nTanggal peminjaman : {{tanggal_pinjam}}\nBatas pengembalian : {{batas_kembali}}\nTujuan             : {{tujuan}}\n\nMohon kembalikan barang sebelum batas waktu. Kondisi dan kelengkapan barang akan diperiksa saat pengembalian.' + FOOT));
  push(tpl('tpl_h_min3', 'Pengingat H-3', '[SIIPB] Pengingat: batas pengembalian {{kode_transaksi}} tinggal 3 hari',
    'Yth. {{nama_peminjam}},\n\nBarang berikut harus dikembalikan paling lambat {{batas_kembali}} (3 hari lagi):\n\n{{daftar_barang}}' + FOOT));
  push(tpl('tpl_h_min1', 'Pengingat H-1', '[SIIPB] Besok batas pengembalian {{kode_transaksi}}',
    'Yth. {{nama_peminjam}},\n\nBesok, {{batas_kembali}}, adalah batas pengembalian barang berikut:\n\n{{daftar_barang}}' + FOOT));
  push(tpl('tpl_h', 'Hari ini jatuh tempo', '[SIIPB] Hari ini batas pengembalian {{kode_transaksi}}',
    'Yth. {{nama_peminjam}},\n\nHari ini, {{batas_kembali}}, adalah batas pengembalian barang berikut:\n\n{{daftar_barang}}\n\nMohon diserahkan ke petugas hari ini.' + FOOT));
  push(tpl('tpl_h_plus1', 'Terlambat H+1', '[SIIPB] Peminjaman {{kode_transaksi}} terlambat {{hari_terlambat}} hari',
    'Yth. {{nama_peminjam}},\n\nBatas pengembalian barang berikut telah lewat ({{batas_kembali}}). Saat ini terlambat {{hari_terlambat}} hari:\n\n{{daftar_barang}}\n\nMohon segera mengembalikan barang.' + FOOT));
  push(tpl('tpl_h_plus3', 'Eskalasi H+3', '[SIIPB] ESKALASI: {{kode_transaksi}} terlambat {{hari_terlambat}} hari',
    'Yth. {{nama_peminjam}},\n(tembusan: Petugas Sarpras/IT)\n\nPeminjaman {{kode_transaksi}} telah terlambat {{hari_terlambat}} hari dari batas {{batas_kembali}}:\n\n{{daftar_barang}}\n\nPetugas akan menindaklanjuti keterlambatan ini.' + FOOT));
  push(tpl('tpl_h_plus7', 'Eskalasi lanjutan H+7', '[SIIPB] ESKALASI LANJUTAN: {{kode_transaksi}} terlambat {{hari_terlambat}} hari',
    'Yth. {{nama_peminjam}},\n(tembusan: Petugas Sarpras/IT dan Pimpinan)\n\nPeminjaman {{kode_transaksi}} telah terlambat {{hari_terlambat}} hari dari batas {{batas_kembali}}:\n\n{{daftar_barang}}\n\nKeterlambatan ini telah dilaporkan kepada pimpinan unit.' + FOOT));
  push(tpl('tpl_return', 'Konfirmasi pengembalian', '[SIIPB] Pengembalian {{kode_transaksi}} telah diterima',
    'Yth. {{nama_peminjam}},\n\nPetugas telah menerima pengembalian barang berikut pada {{tanggal_kembali}}:\n\n{{daftar_barang_kembali}}\n\nTerima kasih.' + FOOT));
  return list;
}

/** Lengkapi data lama (versi sebelumnya) dengan field baru. Dipanggil saat load & restore. */
export function migrate(data: DbData): DbData {
  const params = defaultParameters();
  data.settings.parameters = {
    item_status: { ...params.item_status, ...(data.settings.parameters?.item_status || {}) },
    condition: { ...params.condition, ...(data.settings.parameters?.condition || {}) },
  };
  for (const it of data.items as (DbData['items'][number] & { photo?: string | null })[]) {
    if (!Array.isArray(it.photos)) it.photos = it.photo ? [it.photo] : [];
    delete it.photo;
  }
  return data;
}
