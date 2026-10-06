/** Pengembalian — dicatat petugas: kondisi akhir, kelengkapan, kerusakan/kehilangan. */
import { db } from '@/lib/mock/db';
import { atTime, diffDays, fmtTime, nowISO } from '@/lib/date';
import { RETURN_CONDITIONS } from '@/lib/constants';
import { audit } from '@/services/audit';
import { genCode } from '@/services/borrowing';
import { movement } from '@/services/inventory';
import { notify } from '@/services/notification';
import { isActive, itemsOf } from '@/services/lookup';
import { currentUser } from '@/services/session';
import type { Borrowing, ID, Notification, Return, ReturnConditionKey } from '@/types';

export interface ReturnItemInput {
  condition: ReturnConditionKey | '';
  complete: boolean;
  missing_note?: string;
  damage_note?: string;
}

export interface ReturnInput {
  borrowing_id: ID;
  return_date: string;
  details: Record<ID, ReturnItemInput>;
  notes: string;
  send_confirmation: boolean;
}

export type ReturnResult =
  | { ok: true; ret: Return; borrowing: Borrowing; notification: Notification | null }
  | { ok: false; error: string };

export function createReturn(p: ReturnInput, opts: { at?: string; user_id?: ID } = {}): ReturnResult {
  const b = db.get('borrowings', p.borrowing_id);
  if (!b || !isActive(b)) return { ok: false, error: 'Transaksi tidak aktif atau sudah dikembalikan.' };
  const items = itemsOf(b);
  if (!p.return_date) return { ok: false, error: 'Tanggal pengembalian wajib diisi.' };
  if (diffDays(b.borrow_date, p.return_date) < 0) return { ok: false, error: 'Tanggal pengembalian tidak boleh sebelum tanggal peminjaman.' };
  for (const it of items) {
    const d = p.details[it.id];
    if (!d || !d.condition) return { ok: false, error: `Tentukan kondisi akhir untuk ${it.item_code}.` };
    if (d.condition !== 'BAIK' && d.condition !== 'HILANG' && !(d.damage_note || '').trim())
      return { ok: false, error: `Isi keterangan kerusakan untuk ${it.item_code}.` };
  }
  const userId = opts.user_id !== undefined ? opts.user_id : currentUser()!.id;
  const at = opts.at || atTime(p.return_date, fmtTime(nowISO()).replace('.', ':'));
  const lateDays = Math.max(0, diffDays(b.due_date, p.return_date));
  const r = db.insert('returns', {
    code: genCode('returns', 'KMB', p.return_date),
    borrowing_id: b.id,
    return_date: p.return_date,
    received_by: userId,
    notes: (p.notes || '').trim(),
    late_days: lateDays,
    created_at: at,
  });
  items.forEach((it) => {
    const d = p.details[it.id];
    const rule = RETURN_CONDITIONS.find((c) => c.key === d.condition)!;
    db.insert('return_details', {
      return_id: r.id,
      item_id: it.id,
      condition_after: rule.key,
      complete: !!d.complete,
      missing_note: (d.missing_note || '').trim(),
      damage_note: (d.damage_note || '').trim(),
    });
    const from = it.item_status;
    it.item_status = rule.item_status;
    if (rule.condition) it.condition_status = rule.condition;
    it.updated_at = at;
    const note = [`Dikembalikan (${r.code})`, rule.label, d.complete ? 'lengkap' : `tidak lengkap: ${d.missing_note || '-'}`, d.damage_note]
      .filter(Boolean)
      .join(' · ');
    movement(it, 'DIKEMBALIKAN', from, rule.item_status, note, at, userId, b.id);
    audit('item.status', 'items', it.id, { status: from }, { status: rule.item_status, transaksi: b.code }, userId, at);
  });
  const oldStatus = b.status;
  b.status = 'DIKEMBALIKAN';
  b.returned_at = at;
  audit('return.create', 'returns', r.id, { status_transaksi: oldStatus }, { kode: r.code, transaksi: b.code, terlambat_hari: lateDays }, userId, at);
  let notification: Notification | null = null;
  if (p.send_confirmation && db.data.settings.return_notify)
    notification = notify(b, 'PENGEMBALIAN', { at, user_id: userId, ret: r }).notification;
  db.save();
  return { ok: true, ret: r, borrowing: b, notification };
}
