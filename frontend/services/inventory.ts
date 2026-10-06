/** Inventaris: simpan barang, ubah status, aktif/nonaktif, riwayat pergerakan. */
import { db } from '@/lib/mock/db';
import { nowISO } from '@/lib/date';
import { clone } from '@/lib/utils';
import { audit } from '@/services/audit';
import { cat, item, loc } from '@/services/lookup';
import { currentUser } from '@/services/session';
import type { Condition, FormResult, ID, Item, ItemStatus, MovementType, Result } from '@/types';

export function movement(
  it: Item,
  type: MovementType,
  from: ItemStatus | null,
  to: ItemStatus | null,
  note = '',
  at?: string,
  userId?: ID,
  ref?: ID | null,
) {
  db.insert('item_movements', {
    item_id: it.id,
    type,
    from_status: from,
    to_status: to,
    note,
    user_id: userId !== undefined ? userId : currentUser()?.id ?? 0,
    at: at || nowISO(),
    ref: ref ?? null,
  });
}

export function genItemCode(categoryId: ID) {
  const c = cat(categoryId);
  const prefix = `INV-${c ? c.code : 'GEN'}-`;
  const max = db
    .where('items', (i) => i.item_code.startsWith(prefix))
    .reduce((m, i) => Math.max(m, Number(i.item_code.slice(prefix.length)) || 0), 0);
  return prefix + String(max + 1).padStart(4, '0');
}

export interface ItemInput {
  item_code: string;
  item_name: string;
  category_id: string | number;
  location_id: string | number;
  brand: string;
  model: string;
  serial_number: string;
  condition_status: Condition;
  acquisition_year: string | number;
  acquisition_source: string;
  acquisition_value: string | number;
  notes: string;
  photo?: string | null;
}

export function saveItem(p: ItemInput, id?: ID | null): FormResult<{ item: Item }> {
  const errors: Record<string, string> = {};
  if (!p.item_name?.trim()) errors.item_name = 'Nama barang wajib diisi.';
  if (!p.category_id) errors.category_id = 'Pilih kategori.';
  if (!p.location_id) errors.location_id = 'Pilih lokasi.';
  if (p.acquisition_year && !/^\d{4}$/.test(String(p.acquisition_year))) errors.acquisition_year = 'Tahun harus 4 digit.';
  if (p.acquisition_value !== '' && p.acquisition_value !== null && isNaN(Number(p.acquisition_value)))
    errors.acquisition_value = 'Nilai harus angka.';
  if (p.item_code) {
    const dup = db.find('items', (i) => i.item_code.toLowerCase() === p.item_code.trim().toLowerCase() && i.id !== Number(id));
    if (dup) errors.item_code = 'Kode barang sudah dipakai.';
  }
  if (Object.keys(errors).length) return { ok: false, errors };

  const row = {
    item_code: (p.item_code || '').trim() || genItemCode(Number(p.category_id)),
    item_name: p.item_name.trim(),
    category_id: Number(p.category_id),
    brand: p.brand || '',
    model: p.model || '',
    serial_number: p.serial_number || '',
    acquisition_year: (p.acquisition_year ? Number(p.acquisition_year) : '') as number | '',
    acquisition_source: p.acquisition_source || '',
    acquisition_value: (p.acquisition_value === '' ? '' : Number(p.acquisition_value)) as number | '',
    location_id: Number(p.location_id),
    condition_status: p.condition_status || 'BAIK',
    notes: p.notes || '',
    updated_at: nowISO(),
  };

  let saved: Item;
  if (id) {
    const old = clone(item(id)!);
    saved = db.update('items', id, { ...row, ...(p.photo !== undefined ? { photo: p.photo } : {}) })!;
    if (old.location_id !== row.location_id)
      movement(saved, 'PINDAH_LOKASI', null, null, `${loc(old.location_id)?.name} → ${loc(row.location_id)?.name}`);
    const changed: Record<string, unknown> = {};
    const before: Record<string, unknown> = {};
    (Object.keys(row) as (keyof typeof row)[]).forEach((k) => {
      if (k !== 'updated_at' && String(old[k]) !== String(row[k])) {
        changed[k] = row[k];
        before[k] = old[k];
      }
    });
    if (p.photo !== undefined && p.photo !== old.photo) {
      changed.photo = p.photo ? 'foto diperbarui' : 'foto dihapus';
      before.photo = old.photo ? 'ada' : 'tidak ada';
    }
    audit('item.update', 'items', saved.id, before, changed);
  } else {
    saved = db.insert('items', {
      ...row,
      item_status: 'TERSEDIA',
      active: true,
      created_at: nowISO(),
      photo: p.photo ?? null,
    });
    movement(saved, 'DICATAT', null, 'TERSEDIA', 'Barang baru dicatat');
    audit('item.create', 'items', saved.id, null, { kode: saved.item_code, nama: saved.item_name });
  }
  db.save();
  return { ok: true, item: saved };
}

export function setItemStatus(id: ID, status: ItemStatus, note = ''): Result {
  const it = item(id);
  if (!it) return { ok: false, error: 'Barang tidak ditemukan.' };
  if (it.item_status === 'DIPINJAM') return { ok: false, error: 'Barang sedang dipinjam. Status berubah melalui pencatatan pengembalian.' };
  if (status === 'DIPINJAM') return { ok: false, error: 'Status DIPINJAM hanya diberikan melalui checkout peminjaman.' };
  const from = it.item_status;
  it.item_status = status;
  if (status === 'TERSEDIA') it.condition_status = 'BAIK';
  if (status === 'RUSAK_BERAT') it.condition_status = 'RUSAK_BERAT';
  if (status === 'RUSAK' || status === 'DALAM_PERBAIKAN')
    it.condition_status = it.condition_status === 'BAIK' ? 'RUSAK_RINGAN' : it.condition_status;
  it.updated_at = nowISO();
  movement(it, 'UBAH_STATUS', from, status, note);
  audit('item.status', 'items', it.id, { status: from }, { status, catatan: note });
  db.save();
  return { ok: true };
}

export function setItemActive(id: ID, active: boolean, reason = ''): Result {
  const it = item(id);
  if (!it) return { ok: false, error: 'Barang tidak ditemukan.' };
  if (!active && it.item_status === 'DIPINJAM') return { ok: false, error: 'Barang yang sedang dipinjam tidak dapat dinonaktifkan.' };
  it.active = active;
  it.updated_at = nowISO();
  movement(it, active ? 'DIAKTIFKAN' : 'DINONAKTIFKAN', null, null, reason);
  audit(active ? 'item.activate' : 'item.deactivate', 'items', it.id, { aktif: !active }, { aktif: active, alasan: reason });
  db.save();
  return { ok: true };
}

export const qrPayload = (it: Item) => `SIIPB:${it.item_code}`;
