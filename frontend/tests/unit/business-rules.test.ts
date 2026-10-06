/**
 * Aturan bisnis (dokumen Plan bagian 5, 20, 21) diuji terhadap lapisan layanan dengan data contoh.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { addDays, today } from '@/lib/date';
import { db } from '@/lib/mock/db';
import { migrate } from '@/lib/mock/defaults';
import { seedDatabase } from '@/lib/mock/seed';
import { login } from '@/services/auth';
import { checkout, createBorrowing, validateBorrowing } from '@/services/borrowing';
import { setItemStatus } from '@/services/inventory';
import { borrowView, itemByCode } from '@/services/lookup';
import { saveMaster } from '@/services/master';
import { createReturn } from '@/services/return';
import { runScheduler } from '@/services/scheduler';
import { can, currentUser } from '@/services/session';
import type { DbData } from '@/types';

beforeEach(() => {
  localStorage.clear();
  db.load(seedDatabase);
  db.data.settings.demo_offset_days = 0;
});

const available = () => db.where('items', (i) => i.active && i.item_status === 'TERSEDIA');
const borrow = (itemIds: number[], due = addDays(today(), 3)) =>
  createBorrowing({ employee_id: 2, item_ids: itemIds, borrow_date: today(), due_date: due, purpose: 'Uji', notes: '' }, { checkout: true });

describe('autentikasi & RBAC', () => {
  it('menolak kata sandi salah dan akun nonaktif', () => {
    expect(login('admin', 'salah').ok).toBe(false);
    expect(login('arif', 'arif123')).toMatchObject({ ok: false, error: expect.stringMatching(/dinonaktifkan/) });
  });

  it('izin mengikuti role: pimpinan tidak boleh mencatat peminjaman', () => {
    expect(login('pimpinan', 'pimpinan123').ok).toBe(true);
    expect(currentUser()?.username).toBe('pimpinan');
    expect(can('dashboard.view')).toBe(true);
    expect(can('borrowing.manage')).toBe(false);
    expect(can('settings.manage')).toBe(false);
  });
});

describe('peminjaman (bagian 20)', () => {
  beforeEach(() => {
    login('petugas', 'petugas123');
  });

  it('barang RUSAK_BERAT / HILANG / DALAM_PERBAIKAN tidak dapat dipinjam', () => {
    const broken = db.where('items', (i) => ['RUSAK_BERAT', 'HILANG', 'DALAM_PERBAIKAN'].includes(i.item_status));
    expect(broken.length).toBeGreaterThan(0);
    const errors = validateBorrowing({ employee_id: 2, item_ids: [broken[0].id], borrow_date: today(), due_date: today(), purpose: 'x', notes: '' });
    expect(errors.item_ids).toMatch(/tidak tersedia/i);
  });

  it('validasi wajib: peminjam, barang, tanggal, tujuan', () => {
    const e = validateBorrowing({ employee_id: null, item_ids: [], borrow_date: '2026-10-06', due_date: '2026-10-01', purpose: ' ', notes: '' });
    expect(Object.keys(e).sort()).toEqual(['due_date', 'employee_id', 'item_ids', 'purpose']);
  });

  it('checkout mengubah status barang menjadi DIPINJAM dan mengirim notifikasi ke peminjam', () => {
    const [a, b] = available();
    const r = borrow([a.id, b.id]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.borrowing.status).toBe('DIPINJAM');
    expect(db.get('items', a.id)?.item_status).toBe('DIPINJAM');
    const n = db.find('notifications', (x) => x.borrowing_id === r.borrowing.id && x.event === 'CHECKOUT');
    expect(n?.status).toBe('TERKIRIM');
    expect(n?.body).toContain(a.item_code);
    expect(n?.recipients[0].type).toBe('Peminjam');
  });

  it('draf tidak mengubah status barang sampai di-checkout', () => {
    const [a] = available();
    const r = createBorrowing({ employee_id: 2, item_ids: [a.id], borrow_date: today(), due_date: today(), purpose: 'Draf', notes: '' });
    expect(r.ok && r.borrowing.status).toBe('DRAF');
    expect(db.get('items', a.id)?.item_status).toBe('TERSEDIA');
    if (r.ok) expect(checkout(r.borrowing.id).ok).toBe(true);
    expect(db.get('items', a.id)?.item_status).toBe('DIPINJAM');
  });

  it('mencatat audit log untuk perubahan penting', () => {
    const before = db.all('activity_logs').length;
    borrow([available()[0].id]);
    const actions = db.all('activity_logs').slice(before).map((x) => x.action);
    expect(actions).toEqual(expect.arrayContaining(['borrowing.create', 'borrowing.checkout', 'item.status']));
  });
});

describe('pengembalian (bagian 5 & 7.2)', () => {
  beforeEach(() => {
    login('petugas', 'petugas123');
  });

  it.each([
    ['BAIK', 'TERSEDIA'],
    ['RUSAK', 'RUSAK'],
    ['DALAM_PERBAIKAN', 'DALAM_PERBAIKAN'],
    ['HILANG', 'HILANG'],
  ] as const)('kondisi %s → status barang %s', (cond, status) => {
    const it0 = available()[0];
    const r = borrow([it0.id]);
    if (!r.ok) throw new Error('gagal pinjam');
    const ret = createReturn({
      borrowing_id: r.borrowing.id,
      return_date: today(),
      details: { [it0.id]: { condition: cond, complete: cond !== 'HILANG', damage_note: cond === 'BAIK' || cond === 'HILANG' ? '' : 'retak' } },
      notes: '',
      send_confirmation: true,
    });
    expect(ret.ok).toBe(true);
    expect(db.get('items', it0.id)?.item_status).toBe(status);
    expect(db.get('borrowings', r.borrowing.id)?.status).toBe('DIKEMBALIKAN');
  });

  it('kerusakan wajib diberi keterangan', () => {
    const it0 = available()[0];
    const r = borrow([it0.id]);
    if (!r.ok) throw new Error('gagal pinjam');
    const ret = createReturn({ borrowing_id: r.borrowing.id, return_date: today(), details: { [it0.id]: { condition: 'RUSAK', complete: true } }, notes: '', send_confirmation: false });
    expect(ret).toMatchObject({ ok: false, error: expect.stringMatching(/keterangan kerusakan/) });
  });
});

describe('keterlambatan & notifikasi (bagian 21)', () => {
  beforeEach(() => {
    login('petugas', 'petugas123');
  });

  it('transaksi lewat batas menjadi TERLAMBAT, notifikasi tidak terkirim ganda, transaksi kembali tidak ikut terlambat', () => {
    const [a, b] = available();
    const late = borrow([a.id], today());
    const returned = borrow([b.id], today());
    if (!late.ok || !returned.ok) throw new Error('gagal pinjam');
    createReturn({ borrowing_id: returned.borrowing.id, return_date: today(), details: { [b.id]: { condition: 'BAIK', complete: true } }, notes: '', send_confirmation: false });

    const h3 = addDays(today(), 3);
    const run1 = runScheduler({ today: h3, trigger: 'uji' });
    expect(db.get('borrowings', late.borrowing.id)?.status).toBe('TERLAMBAT');
    expect(db.get('borrowings', returned.borrowing.id)?.status).toBe('DIKEMBALIKAN');
    expect(run1.details.some((d) => d.code === late.borrowing.code && /H\+3 dikirim/.test(d.action))).toBe(true);
    const h3notif = db.find('notifications', (n) => n.borrowing_id === late.borrowing.id && n.event === 'H+3');
    expect(h3notif?.recipients.map((r) => r.type)).toEqual(['Peminjam', 'Petugas']);

    const count = db.where('notifications', (n) => n.borrowing_id === late.borrowing.id).length;
    const run2 = runScheduler({ today: h3, trigger: 'uji' });
    expect(db.where('notifications', (n) => n.borrowing_id === late.borrowing.id).length).toBe(count);
    expect(run2.skipped).toBeGreaterThan(0);
    expect(db.all('notification_logs').every((l) => ['TERKIRIM', 'GAGAL'].includes(l.status))).toBe(true);
  });

  it('eskalasi H+7 mengikuti konfigurasi penerima (termasuk pimpinan)', () => {
    const r = borrow([available()[0].id], today());
    if (!r.ok) throw new Error('gagal pinjam');
    runScheduler({ today: addDays(today(), 7) });
    const n = db.find('notifications', (x) => x.borrowing_id === r.borrowing.id && x.event === 'H+7');
    expect(n?.recipients.map((x) => x.type)).toContain('Pimpinan');
    expect(borrowView(db.get('borrowings', r.borrowing.id)!, addDays(today(), 7)).lateDays).toBe(7);
  });

  it('SMTP gagal → status GAGAL dan tercatat di notification_logs', () => {
    db.data.settings.smtp.simulate_failure = true;
    const r = borrow([available()[0].id]);
    if (!r.ok) throw new Error('gagal pinjam');
    const n = db.find('notifications', (x) => x.borrowing_id === r.borrowing.id && x.event === 'CHECKOUT')!;
    expect(n.status).toBe('GAGAL');
    expect(db.where('notification_logs', (l) => l.notification_id === n.id)[0].status).toBe('GAGAL');
  });
});

describe('inventaris & master data', () => {
  beforeEach(() => {
    login('admin', 'admin123');
  });

  it('status DIPINJAM hanya lewat checkout', () => {
    const it0 = available()[0];
    expect(setItemStatus(it0.id, 'DIPINJAM')).toMatchObject({ ok: false });
    expect(setItemStatus(it0.id, 'DALAM_PERBAIKAN', 'servis').ok).toBe(true);
    expect(itemByCode(it0.item_code)?.condition_status).toBe('RUSAK_RINGAN');
  });

  it('NIP peminjam harus unik dan email valid', () => {
    const dup = db.all('employees')[0].nip;
    const r = saveMaster('peminjam', { nip: dup, name: 'X', unit_id: '1', position: '', email: 'bukan-email', phone: '' }, null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['email', 'nip']);
  });

  it('migrasi data lama: photo → photos dan parameter status/kondisi', () => {
    const old = JSON.parse(JSON.stringify(db.data)) as DbData & { items: { photo?: string }[] };
    old.items[0].photo = 'data:image/jpeg;base64,AAA';
    delete (old.items[0] as { photos?: string[] }).photos;
    delete (old.settings as { parameters?: unknown }).parameters;
    const m = migrate(old as DbData);
    expect(m.items[0].photos).toEqual(['data:image/jpeg;base64,AAA']);
    expect(m.settings.parameters.condition.BAIK.label).toBe('Baik');
  });
});
