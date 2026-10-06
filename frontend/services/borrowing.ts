/** Peminjaman — seluruhnya dicatat oleh petugas (peminjam tidak login / tidak mengisi formulir). */
import { db } from '@/lib/mock/db';
import { diffDays, localDate, nowISO, today as todayStr } from '@/lib/date';
import { audit } from '@/services/audit';
import { movement } from '@/services/inventory';
import { notify } from '@/services/notification';
import { emp, isBorrowable, item, itemsOf } from '@/services/lookup';
import { currentUser } from '@/services/session';
import type { Borrowing, FieldErrors, ID, Notification } from '@/types';

export function genCode(table: 'borrowings' | 'returns', prefix: string, dateStr?: string) {
  const y = String(dateStr || todayStr()).slice(0, 4);
  const p = `${prefix}-${y}-`;
  const max = (db.all(table) as { code: string }[])
    .filter((r) => r.code && r.code.startsWith(p))
    .reduce((m, r) => Math.max(m, Number(r.code.slice(p.length)) || 0), 0);
  return p + String(max + 1).padStart(4, '0');
}

export interface BorrowingInput {
  employee_id: ID | null;
  item_ids: ID[];
  borrow_date: string;
  due_date: string;
  purpose: string;
  notes: string;
}

export function validateBorrowing(p: BorrowingInput): FieldErrors {
  const errors: FieldErrors = {};
  const e = emp(p.employee_id);
  if (!e || !e.active) errors.employee_id = 'Pilih peminjam dari master data.';
  else if (!e.email) errors.employee_id = 'Peminjam belum memiliki email untuk notifikasi.';
  const ids = (p.item_ids || []).map(Number);
  if (!ids.length) errors.item_ids = 'Pilih minimal satu barang.';
  const bad = ids.map((id) => item(id)).filter((it) => !isBorrowable(it));
  if (bad.length) errors.item_ids = 'Barang tidak tersedia: ' + bad.map((b) => (b ? `${b.item_code} (${b.item_status})` : '?')).join(', ');
  if (!p.borrow_date) errors.borrow_date = 'Tanggal peminjaman wajib diisi.';
  if (!p.due_date) errors.due_date = 'Batas pengembalian wajib diisi.';
  if (p.borrow_date && p.due_date && diffDays(p.borrow_date, p.due_date) < 0)
    errors.due_date = 'Batas pengembalian tidak boleh sebelum tanggal peminjaman.';
  if (!p.purpose || !p.purpose.trim()) errors.purpose = 'Tujuan peminjaman wajib diisi.';
  return errors;
}

export interface TxOptions {
  at?: string;
  user_id?: ID;
  checkout?: boolean;
  today?: string;
}

type CheckoutResult = { ok: true; borrowing: Borrowing; notification: Notification | null } | { ok: false; error: string };

export function checkout(id: ID, opts: TxOptions = {}): CheckoutResult {
  const b = db.get('borrowings', id);
  if (!b || b.status !== 'DRAF') return { ok: false, error: 'Hanya transaksi berstatus DRAF yang dapat di-checkout.' };
  const items = itemsOf(b);
  const bad = items.filter((it) => !isBorrowable(it));
  if (bad.length)
    return { ok: false, error: 'Validasi ketersediaan gagal: ' + bad.map((x) => `${x.item_code} berstatus ${x.item_status}`).join(', ') };
  const userId = opts.user_id !== undefined ? opts.user_id : currentUser()!.id;
  const at = opts.at || nowISO();
  const borrowerName = emp(b.employee_id)?.name;
  items.forEach((it) => {
    it.item_status = 'DIPINJAM';
    it.updated_at = at;
    movement(it, 'DIPINJAM', 'TERSEDIA', 'DIPINJAM', `Checkout ${b.code} — ${borrowerName}`, at, userId, b.id);
    audit('item.status', 'items', it.id, { status: 'TERSEDIA' }, { status: 'DIPINJAM', transaksi: b.code }, userId, at);
  });
  const today = opts.today || localDate(at);
  b.status = diffDays(b.due_date, today) > 0 ? 'TERLAMBAT' : 'DIPINJAM';
  b.checked_out_at = at;
  b.checked_out_by = userId;
  audit('borrowing.checkout', 'borrowings', b.id, { status: 'DRAF' }, { status: b.status }, userId, at);
  let notification: Notification | null = null;
  if (db.data.settings.checkout_notify) notification = notify(b, 'CHECKOUT', { at, user_id: userId }).notification;
  db.save();
  return { ok: true, borrowing: b, notification };
}

export type BorrowingSaveResult =
  | { ok: true; borrowing: Borrowing; notification?: Notification | null }
  | { ok: false; errors: FieldErrors; borrowing?: Borrowing };

export function createBorrowing(p: BorrowingInput, opts: TxOptions = {}): BorrowingSaveResult {
  const errors = validateBorrowing(p);
  if (Object.keys(errors).length) return { ok: false, errors };
  const userId = opts.user_id !== undefined ? opts.user_id : currentUser()!.id;
  const at = opts.at || nowISO();
  const b = db.insert('borrowings', {
    code: genCode('borrowings', 'PJM', p.borrow_date),
    employee_id: Number(p.employee_id),
    borrow_date: p.borrow_date,
    due_date: p.due_date,
    purpose: p.purpose.trim(),
    notes: (p.notes || '').trim(),
    status: 'DRAF',
    created_by: userId,
    created_at: at,
    checked_out_at: null,
    checked_out_by: null,
    returned_at: null,
  });
  p.item_ids.map(Number).forEach((id) =>
    db.insert('borrowing_details', { borrowing_id: b.id, item_id: id, item_condition_out: item(id)!.condition_status }),
  );
  audit(
    'borrowing.create',
    'borrowings',
    b.id,
    null,
    { kode: b.code, peminjam: emp(b.employee_id)?.name, barang: p.item_ids.length, status: 'DRAF' },
    userId,
    at,
  );
  let notification: Notification | null = null;
  if (opts.checkout) {
    const r = checkout(b.id, opts);
    if (!r.ok) {
      db.save();
      return { ok: false, errors: { item_ids: r.error }, borrowing: b };
    }
    notification = r.notification;
  }
  db.save();
  return { ok: true, borrowing: b, notification };
}

export function updateDraft(id: ID, p: BorrowingInput): BorrowingSaveResult {
  const b = db.get('borrowings', id);
  if (!b || b.status !== 'DRAF') return { ok: false, errors: { _: 'Hanya draf yang dapat diubah.' } };
  const errors = validateBorrowing(p);
  if (Object.keys(errors).length) return { ok: false, errors };
  const old = { batas: b.due_date, tujuan: b.purpose };
  Object.assign(b, {
    employee_id: Number(p.employee_id),
    borrow_date: p.borrow_date,
    due_date: p.due_date,
    purpose: p.purpose.trim(),
    notes: (p.notes || '').trim(),
  });
  db.data.borrowing_details = db.data.borrowing_details.filter((d) => d.borrowing_id !== b.id);
  p.item_ids.map(Number).forEach((iid) =>
    db.insert('borrowing_details', { borrowing_id: b.id, item_id: iid, item_condition_out: item(iid)!.condition_status }),
  );
  audit('borrowing.update', 'borrowings', b.id, old, { batas: b.due_date, tujuan: b.purpose });
  db.save();
  return { ok: true, borrowing: b };
}

export function cancelBorrowing(id: ID, reason = '') {
  const b = db.get('borrowings', id);
  if (!b || b.status !== 'DRAF') return { ok: false as const, error: 'Hanya draf yang dapat dibatalkan.' };
  b.status = 'DIBATALKAN';
  b.cancel_reason = reason;
  audit('borrowing.cancel', 'borrowings', b.id, { status: 'DRAF' }, { status: 'DIBATALKAN', alasan: reason });
  db.save();
  return { ok: true as const };
}
