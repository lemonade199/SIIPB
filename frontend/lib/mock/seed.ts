/**
 * Data awal (seed) mockup. Riwayat transaksi dibuat melalui layanan agar status barang,
 * riwayat, notifikasi, dan audit log konsisten dengan aturan bisnis.
 */
import { addDays, atTime, pad, toDateStr } from '@/lib/date';
import { PERMISSIONS } from '@/lib/constants';
import { db, TABLES } from '@/lib/mock/db';
import { audit } from '@/services/audit';
import { createBorrowing } from '@/services/borrowing';
import { movement } from '@/services/inventory';
import { createReturn, type ReturnItemInput } from '@/services/return';
import { runScheduler } from '@/services/scheduler';
import type { Borrowing, Condition, DbData, EmailTemplate, ID, ItemStatus } from '@/types';

export function seedDatabase() {
  const T = toDateStr(new Date());
  const d = (n: number) => addDays(T, n);
  const at = (n: number, hh = '09:00') => atTime(d(n), hh);

  const data = { version: 1, created_at: new Date().toISOString(), _seq: {} } as DbData;
  TABLES.forEach((t) => {
    (data as unknown as Record<string, unknown[]>)[t] = [];
  });
  db.data = data;

  const allPerms = PERMISSIONS.map((p) => p.key);
  data.roles = [
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
  data.users = [
    { id: 1, name: 'Administrator Sistem', username: 'admin', email: 'admin@siipb.local', password: 'admin123', role_id: 1, active: true, login_method: 'LOKAL', phone: '', last_login: at(-1, '16:40'), created_at: at(-200) },
    { id: 2, name: 'Rina Kartika', username: 'petugas', email: 'rina.kartika@siipb.local', password: 'petugas123', role_id: 2, active: true, login_method: 'LOKAL + SSO', phone: 'ext. 1021', last_login: at(-1, '07:55'), created_at: at(-180) },
    { id: 3, name: 'Yoga Saputra', username: 'yoga', email: 'yoga.saputra@siipb.local', password: 'yoga123', role_id: 2, active: true, login_method: 'LOKAL + SSO', phone: 'ext. 1022', last_login: at(-2, '16:10'), created_at: at(-150) },
    { id: 4, name: 'Hendra Susanto', username: 'pimpinan', email: 'hendra.susanto@siipb.local', password: 'pimpinan123', role_id: 3, active: true, login_method: 'LOKAL + SSO', phone: '', last_login: at(-4, '09:02'), created_at: at(-180) },
    { id: 5, name: 'M. Arif', username: 'arif', email: 'arif@siipb.local', password: 'arif123', role_id: 2, active: false, login_method: 'LOKAL', phone: '', last_login: at(-55, '11:30'), created_at: at(-300) },
  ];
  data.oauth_accounts = [
    { id: 1, user_id: 2, provider: 'SSO Organisasi (OIDC)', subject: 'b1f0-rina', email: 'rina.kartika@siipb.local', linked_at: at(-170) },
    { id: 2, user_id: 3, provider: 'SSO Organisasi (OIDC)', subject: 'c7a2-yoga', email: 'yoga.saputra@siipb.local', linked_at: at(-140) },
    { id: 3, user_id: 4, provider: 'SSO Organisasi (OIDC)', subject: 'e9d1-hendra', email: 'hendra.susanto@siipb.local', linked_at: at(-170) },
  ];
  data.units = ['Bagian Umum', 'Keuangan', 'Humas', 'Akademik', 'Kepegawaian', 'Perencanaan', 'Teknologi Informasi'].map((n, i) => ({ id: i + 1, name: n, active: true }));
  data.categories = (
    [['KOM', 'Laptop & Komputer'], ['MMD', 'Multimedia'], ['JRG', 'Jaringan'], ['FUR', 'Furnitur'], ['ALT', 'Peralatan'], ['AUD', 'Audio']] as const
  ).map(([c, n], i) => ({ id: i + 1, code: c, name: n, active: true }));
  data.locations = (
    [['GDG', 'Gudang Sarpras', 'Gedung A Lt. 1'], ['RIT', 'Ruang IT', 'Gedung B Lt. 2'], ['RMD', 'Ruang Media', 'Gedung A Lt. 2'], ['AUL', 'Aula Utama', 'Gedung C'], ['SRV', 'Ruang Server', 'Gedung B Lt. 2']] as const
  ).map(([c, n, b], i) => ({ id: i + 1, code: c, name: n, building: b, active: true }));
  data.employees = (
    [
      ['198703122010', 'Siti Nurhaliza', 3, 'siti.nurhaliza@siipb.local', '0812-3456-1021'],
      ['199001042015', 'Dimas Pratama', 2, 'dimas.pratama@siipb.local', '0813-2211-4410'],
      ['198511202009', 'Andi Wijaya', 4, 'andi.wijaya@siipb.local', '0857-1100-2290'],
      ['197902142005', 'Rahmat Hidayat', 1, 'rahmat.hidayat@siipb.local', '0821-7788-7731'],
      ['199205302018', 'Lestari Putri', 5, 'lestari.putri@siipb.local', '0819-3344-3305'],
      ['199408172020', 'Fajar Nugroho', 6, 'fajar.nugroho@siipb.local', '0878-5500-5562'],
      ['199112092016', 'Yusuf Maulana', 3, 'yusuf.maulana@siipb.local', '0812-9090-1212'],
      ['198808252012', 'Dewi Anggraini', 4, 'dewi.anggraini@siipb.local', '0813-4545-8080'],
      ['199503112021', 'Bayu Prasetyo', 7, 'bayu.prasetyo@siipb.local', '0856-7171-3030'],
    ] as const
  ).map(([nip, name, unit, email, phone], i) => ({ id: i + 1, nip, name, unit_id: unit, email, phone, position: 'Staf', active: true }));

  type ItemSeed = [string, string, number, string, string, string, number, string, number, number, Condition, ItemStatus, string];
  const I: ItemSeed[] = [
    ['INV-KOM-0001', 'Laptop Lenovo ThinkPad E14', 1, 'Lenovo', 'ThinkPad E14 Gen 5', 'PF4KX92M', 2024, 'APBN 2024', 14500000, 2, 'BAIK', 'TERSEDIA', 'Termasuk charger dan tas laptop.'],
    ['INV-KOM-0002', 'Laptop Lenovo ThinkPad E14', 1, 'Lenovo', 'ThinkPad E14 Gen 5', 'PF4KX93N', 2024, 'APBN 2024', 14500000, 2, 'BAIK', 'TERSEDIA', 'Termasuk charger.'],
    ['INV-KOM-0003', 'Laptop Asus Vivobook 14', 1, 'Asus', 'Vivobook 14 A1404', 'N3NRKD0123', 2023, 'APBN 2023', 9800000, 2, 'BAIK', 'TERSEDIA', ''],
    ['INV-KOM-0004', 'PC All-in-One HP 24', 1, 'HP', '24-cb1000d', '8CC2310XYZ', 2022, 'Hibah', 12300000, 2, 'BAIK', 'TERSEDIA', 'Tidak untuk dibawa keluar gedung.'],
    ['INV-KOM-0005', 'Tablet Samsung Galaxy Tab A8', 1, 'Samsung', 'SM-X205', 'R9KT40ABCD', 2023, 'APBN 2023', 3900000, 2, 'BAIK', 'TERSEDIA', ''],
    ['INV-KOM-0006', 'Printer Epson L3210', 1, 'Epson', 'L3210', 'X8GN012345', 2023, 'APBN 2023', 2400000, 2, 'BAIK', 'TERSEDIA', ''],
    ['INV-MMD-0001', 'Proyektor Epson EB-X51', 2, 'Epson', 'EB-X51', 'X4JK1100231', 2022, 'APBN 2022', 7200000, 1, 'BAIK', 'TERSEDIA', 'Termasuk kabel HDMI 3 m dan remote.'],
    ['INV-MMD-0002', 'Proyektor BenQ MS560', 2, 'BenQ', 'MS560', 'PDJ2300987', 2023, 'APBN 2023', 6100000, 1, 'BAIK', 'TERSEDIA', ''],
    ['INV-MMD-0003', 'Kamera Canon EOS M50', 2, 'Canon', 'EOS M50 Mark II', '0820103344', 2022, 'APBN 2022', 10500000, 3, 'BAIK', 'TERSEDIA', '1 baterai cadangan, kartu memori 64 GB.'],
    ['INV-MMD-0004', 'Tripod Takara ECO-196A', 2, 'Takara', 'ECO-196A', '-', 2022, 'APBN 2022', 450000, 3, 'BAIK', 'TERSEDIA', ''],
    ['INV-MMD-0005', 'Layar Proyektor Tripod 70"', 2, 'D-Light', 'Tripod 70"', '-', 2021, 'APBN 2021', 850000, 1, 'BAIK', 'TERSEDIA', ''],
    ['INV-MMD-0006', 'Kamera Sony ZV-E10', 2, 'Sony', 'ZV-E10', '3345120', 2024, 'APBN 2024', 11200000, 3, 'BAIK', 'TERSEDIA', 'Lensa kit 16-50 mm.'],
    ['INV-AUD-0001', 'Speaker Portable JBL Charge 5', 6, 'JBL', 'Charge 5', 'TL0451-22', 2023, 'APBN 2023', 2500000, 1, 'BAIK', 'TERSEDIA', 'Termasuk kabel charger USB-C.'],
    ['INV-AUD-0002', 'Mikrofon Wireless Shure BLX24', 6, 'Shure', 'BLX24/PG58', '2BX0091', 2021, 'APBN 2021', 7800000, 4, 'BAIK', 'TERSEDIA', 'Receiver + 1 mikrofon genggam.'],
    ['INV-AUD-0003', 'Mixer Audio Yamaha MG10XU', 6, 'Yamaha', 'MG10XU', 'YMG10-7781', 2021, 'APBN 2021', 3600000, 4, 'BAIK', 'TERSEDIA', ''],
    ['INV-AUD-0004', 'Mikrofon Clip-on Boya BY-M1', 6, 'Boya', 'BY-M1', '-', 2023, 'APBN 2023', 150000, 3, 'BAIK', 'TERSEDIA', ''],
    ['INV-JRG-0001', 'Switch TP-Link 24 Port', 3, 'TP-Link', 'TL-SG1024D', '22190K8765', 2020, 'APBN 2020', 1600000, 5, 'BAIK', 'TERSEDIA', ''],
    ['INV-JRG-0002', 'Access Point Ubiquiti U6 Lite', 3, 'Ubiquiti', 'U6-Lite', 'F4E2C6AB12', 2024, 'APBN 2024', 2300000, 5, 'BAIK', 'TERSEDIA', ''],
    ['INV-JRG-0003', 'Router MikroTik hEX', 3, 'MikroTik', 'RB750Gr3', 'HG90876', 2022, 'APBN 2022', 950000, 5, 'BAIK', 'TERSEDIA', ''],
    ['INV-FUR-0001', 'Kursi Lipat Chitose (set 20 unit)', 4, 'Chitose', 'Yuka', '-', 2020, 'APBN 2020', 9000000, 4, 'BAIK', 'TERSEDIA', 'Satu set berisi 20 kursi.'],
    ['INV-FUR-0002', 'Meja Lipat Portabel (set 5 unit)', 4, 'Olympic', 'Folding 120', '-', 2021, 'APBN 2021', 3250000, 4, 'BAIK', 'TERSEDIA', ''],
    ['INV-ALT-0001', 'Bor Listrik Bosch GSB 550', 5, 'Bosch', 'GSB 550', '603128', 2019, 'APBN 2019', 750000, 1, 'BAIK', 'TERSEDIA', ''],
    ['INV-ALT-0002', 'Tangga Aluminium 3 m', 5, 'Krisbow', 'Multi 3 m', '-', 2021, 'APBN 2021', 1200000, 1, 'BAIK', 'TERSEDIA', ''],
    ['INV-ALT-0003', 'Kabel Roll 25 m', 5, 'Uticon', 'ST-2525', '-', 2022, 'APBN 2022', 280000, 1, 'BAIK', 'TERSEDIA', ''],
  ];
  data.items = I.map((r, i) => ({
    id: i + 1,
    item_code: r[0],
    item_name: r[1],
    category_id: r[2],
    brand: r[3],
    model: r[4],
    serial_number: r[5],
    acquisition_year: r[6],
    acquisition_source: r[7],
    acquisition_value: r[8],
    location_id: r[9],
    condition_status: r[10],
    item_status: r[11],
    photo: null,
    notes: r[12],
    active: true,
    created_at: atTime(`${r[6]}-02-14`, '08:00'),
    updated_at: atTime(`${r[6]}-02-14`, '08:00'),
  }));
  data.items.forEach((it) => {
    data.item_movements.push({ id: data.item_movements.length + 1, item_id: it.id, type: 'DICATAT', from_status: null, to_status: 'TERSEDIA', note: 'Data awal inventaris', user_id: 1, at: it.created_at });
  });

  data.settings = {
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

  const tpl = (code: string, name: string, subject: string, body: string): EmailTemplate => ({
    id: data.email_templates.length + 1,
    code,
    name,
    subject,
    body,
    updated_at: at(-60),
  });
  const FOOT =
    '\n\nKontak petugas: {{nama_petugas}} ({{kontak_petugas}})\nTempat pengembalian: {{lokasi_pengembalian}}\n\nEmail ini dikirim otomatis oleh SIIPB {{nama_instansi}}. Anda tidak perlu login, mengisi formulir, atau membalas email ini.';
  const push = (t: EmailTemplate) => data.email_templates.push(t);
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

  seedHistory(d, at);
  data.activity_logs.sort((a, b) => a.at.localeCompare(b.at));
  db.save();
}

type PlanRow = [employee: ID, items: ID[], borrowOff: number, dueOff: number, purpose: string, notes: string, officer: ID, returnOff: number | null, conditions?: Record<ID, ReturnItemInput>];

function seedHistory(d: (n: number) => string, at: (n: number, hh?: string) => string) {
  const plan: PlanRow[] = [
    [8, [5], -45, -40, 'Pendataan lapangan program beasiswa', '', 3, -38, { 5: { condition: 'HILANG', complete: false, missing_note: 'Tablet tidak dapat ditemukan peminjam', damage_note: '' } }],
    [6, [3], -30, -24, 'Penyusunan dokumen perencanaan di luar kantor', '', 2, -22, { 3: { condition: 'BAIK', complete: true } }],
    [1, [8], -20, -15, 'Dokumentasi rapat kerja', '', 2, -16, { 8: { condition: 'BAIK', complete: true } }],
    [7, [14], -14, -10, 'Acara pelepasan purna tugas', 'Receiver + 1 mikrofon', 3, -10, { 14: { condition: 'RUSAK', complete: true, damage_note: 'Kabel antena receiver putus di dekat konektor.' } }],
    [4, [7], -16, -7, 'Rapat koordinasi di luar kantor', 'Termasuk kabel HDMI dan remote', 2, null],
    [3, [13], -12, -3, 'Kegiatan wisuda fakultas', '', 3, null],
    [2, [1], -7, 2, 'Penyusunan laporan keuangan triwulan III', 'Charger dan tas laptop', 2, null],
    [1, [9, 10], -4, 0, 'Dokumentasi kegiatan sosialisasi', 'Kamera dengan 1 baterai cadangan', 2, null],
    [5, [20], -1, 5, 'Pelatihan pegawai baru', 'Satu set berisi 20 kursi', 3, null],
  ];

  type Ev =
    | { t: string; kind: 'borrow' | 'return'; p: PlanRow; idx: number }
    | { t: string; kind: 'sched'; k: number }
    | { t: string; kind: 'status'; id: ID; status: ItemStatus; note: string };
  const events: Ev[] = [];
  plan.forEach((p, idx) => {
    events.push({ t: at(p[2], '09:' + pad(10 + idx)), kind: 'borrow', p, idx });
    if (p[7] !== null) events.push({ t: at(p[7], '10:' + pad(15 + idx)), kind: 'return', p, idx });
  });
  for (let k = -45; k <= -1; k++) events.push({ t: at(k, '08:00'), kind: 'sched', k });
  events.push({ t: at(-20, '11:00'), kind: 'status', id: 17, status: 'DALAM_PERBAIKAN', note: 'Beberapa port tidak berfungsi, dikirim ke vendor.' });
  events.push({ t: at(-33, '14:00'), kind: 'status', id: 22, status: 'RUSAK_BERAT', note: 'Motor terbakar, tidak layak diperbaiki.' });
  events.sort((a, b) => a.t.localeCompare(b.t));

  const created: Record<number, Borrowing> = {};
  events.forEach((ev) => {
    if (ev.kind === 'borrow') {
      const p = ev.p;
      const r = createBorrowing(
        { employee_id: p[0], item_ids: p[1], borrow_date: d(p[2]), due_date: d(p[3]), purpose: p[4], notes: p[5] },
        { at: ev.t, user_id: p[6], checkout: true, today: d(p[2]) },
      );
      if (r.ok) created[ev.idx] = r.borrowing;
    } else if (ev.kind === 'return') {
      const p = ev.p;
      const b = created[ev.idx];
      const details: Record<ID, ReturnItemInput> = {};
      p[1].forEach((id) => {
        details[id] = p[8]![id];
      });
      createReturn({ borrowing_id: b.id, return_date: d(p[7]!), details, notes: '', send_confirmation: true }, { at: ev.t, user_id: p[6] });
    } else if (ev.kind === 'sched') {
      runScheduler({ trigger: 'otomatis (Celery Beat)', today: d(ev.k), at: ev.t, silent: true });
    } else if (ev.kind === 'status') {
      const it = db.get('items', ev.id)!;
      const from = it.item_status;
      it.item_status = ev.status;
      it.condition_status = ev.status === 'RUSAK_BERAT' ? 'RUSAK_BERAT' : 'RUSAK_RINGAN';
      movement(it, 'UBAH_STATUS', from, ev.status, ev.note, ev.t, 3);
      audit('item.status', 'items', it.id, { status: from }, { status: ev.status, catatan: ev.note }, 3, ev.t);
    }
  });
  // Satu draf yang belum diserahkan, untuk mencoba alur checkout
  createBorrowing(
    { employee_id: 6, item_ids: [12], borrow_date: d(0), due_date: d(3), purpose: 'Liputan kegiatan pimpinan', notes: 'Menunggu peminjam datang mengambil' },
    { at: at(-1, '15:30'), user_id: 2 },
  );
  db.data.settings.scheduler.last_run_date = d(-1);
  db.data.scheduler_runs = db.data.scheduler_runs.filter((r) => r.today >= d(-7));
  audit('role.update', 'roles', 3, { permission: '-report.export' }, { permission: '+report.export' }, 1, at(-9, '09:05'));
  audit('settings.update', 'settings', null, { jam_scheduler: '07:00' }, { jam_scheduler: '08:00' }, 1, at(-30, '10:12'));
}
