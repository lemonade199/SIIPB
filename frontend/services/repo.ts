/**
 * Repository — satu pintu mutasi data untuk halaman.
 *
 * Mode `mock`: memanggil layanan lokal (aturan bisnis di browser).
 * Mode `api` : memanggil Flask REST API, lalu menyegarkan cache store dari server.
 * Semua fungsi async sehingga halaman tidak perlu tahu sumber datanya.
 */
import { isApiMode } from '@/lib/config';
import { db } from '@/lib/mock/db';
import { ApiError } from '@/services/api/client';
import { assetsApi, borrowingsApi, masterApi, notificationsApi, returnsApi, type ApiAssetInput, type ApiReturnCreate } from '@/services/api/endpoints';
import { apiLogin, apiLogout, loadItemHistory as apiLoadHistory, pullAll } from '@/services/api/sync';
import * as authSvc from '@/services/auth';
import * as borrowSvc from '@/services/borrowing';
import * as invSvc from '@/services/inventory';
import * as masterSvc from '@/services/master';
import * as notifSvc from '@/services/notification';
import * as returnSvc from '@/services/return';
import { item as getItem, itemsOf, detailsOf } from '@/services/lookup';
import type { FieldErrors, ID, Item, Notification, Return, User } from '@/types';

type Ok<T> = { ok: true } & T;
type Fail = { ok: false; error: string; errors?: FieldErrors };

function apiFail(e: unknown): Fail {
  if (e instanceof ApiError) {
    const errors: FieldErrors = {};
    Object.entries(e.errors || {}).forEach(([k, v]) => {
      errors[k] = Array.isArray(v) ? v.join(' ') : String(v);
    });
    return { ok: false, error: e.message, errors };
  }
  return { ok: false, error: (e as Error)?.message || 'Terjadi kesalahan.' };
}

const dataUrlToFile = async (url: string, name: string) => {
  const blob = await (await fetch(url)).blob();
  return new File([blob], name, { type: blob.type || 'image/jpeg' });
};

/* ================= Auth ================= */
export async function login(username: string, password: string): Promise<Ok<{ user: User }> | Fail> {
  if (!isApiMode) return authSvc.login(username, password);
  try {
    return { ok: true, user: await apiLogin(username, password) };
  } catch (e) {
    return apiFail(e);
  }
}

export async function logout() {
  if (!isApiMode) return authSvc.logout();
  await apiLogout();
}

export async function refresh() {
  if (isApiMode) await pullAll();
}

/* ================= Inventaris ================= */
export async function saveItem(p: invSvc.ItemInput, id?: ID | null): Promise<Ok<{ item: Item }> | Fail> {
  if (!isApiMode) {
    const r = invSvc.saveItem(p, id);
    return r.ok ? r : { ok: false, error: 'Periksa kembali isian yang ditandai.', errors: r.errors };
  }
  const errors: FieldErrors = {};
  if (!p.item_name?.trim()) errors.item_name = 'Nama barang wajib diisi.';
  if (!p.category_id) errors.category_id = 'Pilih kategori.';
  if (!p.location_id) errors.location_id = 'Pilih lokasi.';
  if (p.acquisition_year && !/^\d{4}$/.test(String(p.acquisition_year))) errors.acquisition_year = 'Tahun harus 4 digit.';
  if (Object.keys(errors).length) return { ok: false, error: 'Periksa kembali isian yang ditandai.', errors };
  const body: ApiAssetInput = {
    category_id: Number(p.category_id),
    location_id: Number(p.location_id),
    name: p.item_name.trim(),
    brand: p.brand || null,
    model: p.model || null,
    serial_number: p.serial_number || null,
    description: p.notes || null,
    // purchase_date tidak dikirim: lihat CAPABILITIES.acquisitionYear (bug serialisasi di backend)
    acquisition_cost: p.acquisition_value === '' ? null : Number(p.acquisition_value),
    condition: p.condition_status,
  };
  try {
    let assetId = id ?? null;
    if (assetId) await assetsApi.update(assetId, body);
    else {
      const code = (p.item_code || '').trim() || invSvc.genItemCode(Number(p.category_id));
      assetId = (await assetsApi.create({ ...body, inventory_code: code })).id;
    }
    const first = p.photos?.[0];
    if (first && first.startsWith('data:')) await assetsApi.uploadPhoto(assetId, await dataUrlToFile(first, 'foto.jpg'));
    await pullAll();
    return { ok: true, item: getItem(assetId)! };
  } catch (e) {
    return apiFail(e);
  }
}

export async function setItemActive(id: ID, active: boolean, reason = ''): Promise<Ok<object> | Fail> {
  if (!isApiMode) return invSvc.setItemActive(id, active, reason);
  try {
    await assetsApi.update(id, { is_active: active, reason: reason || (active ? 'Diaktifkan kembali' : 'Dinonaktifkan') });
    await pullAll();
    return { ok: true };
  } catch (e) {
    return apiFail(e);
  }
}

export async function setItemStatus(id: ID, status: Item['item_status'], note = ''): Promise<Ok<object> | Fail> {
  if (!isApiMode) return invSvc.setItemStatus(id, status, note);
  return { ok: false, error: 'Backend belum menyediakan perubahan status manual.' };
}

export async function loadItemHistory(id: ID) {
  if (isApiMode) await apiLoadHistory(id);
}

/* ================= Peminjaman ================= */
export async function createBorrowing(
  p: borrowSvc.BorrowingInput,
  checkout: boolean,
): Promise<{ ok: true; borrowing: import('@/types').Borrowing; notification?: Notification | null } | { ok: false; errors: FieldErrors }> {
  if (!isApiMode) return borrowSvc.createBorrowing(p, { checkout });
  const errors = borrowSvc.validateBorrowing(p);
  if (Object.keys(errors).length) return { ok: false, errors };
  try {
    const res = await borrowingsApi.create({
      borrower_id: Number(p.employee_id),
      start_date: p.borrow_date,
      due_date: p.due_date,
      purpose: p.purpose.trim(),
      notes: p.notes?.trim() || undefined,
      asset_ids: p.item_ids.map(Number),
    });
    await pullAll();
    return { ok: true, borrowing: db.get('borrowings', res.id)!, notification: null };
  } catch (e) {
    const f = apiFail(e);
    return { ok: false, errors: { item_ids: f.error, ...(f.errors || {}) } };
  }
}

/* ================= Pengembalian ================= */
export async function createReturn(p: returnSvc.ReturnInput): Promise<{ ok: true; ret: Return; notification: Notification | null } | Fail> {
  if (!isApiMode) return returnSvc.createReturn(p);
  const b = db.get('borrowings', p.borrowing_id);
  if (!b) return { ok: false, error: 'Transaksi tidak ditemukan.' };
  const items = itemsOf(b);
  for (const it of items) {
    const d = p.details[it.id];
    if (!d?.condition) return { ok: false, error: `Tentukan kondisi akhir untuk ${it.item_code}.` };
    if (d.condition !== 'BAIK' && d.condition !== 'HILANG' && !(d.damage_note || '').trim()) return { ok: false, error: `Isi keterangan kerusakan untuk ${it.item_code}.` };
  }
  const body: ApiReturnCreate = {
    borrowing_id: b.id,
    notes: p.notes?.trim() || undefined,
    items: detailsOf(b).map((det) => {
      const d = p.details[det.item_id];
      const completeness = d.complete ? 'Lengkap' : `Tidak lengkap: ${d.missing_note || '-'}`;
      if (d.condition === 'BAIK') return { borrowing_item_id: det.id, asset_id: det.item_id, final_condition: 'BAIK' as const, completeness };
      if (d.condition === 'HILANG')
        return { borrowing_item_id: det.id, asset_id: det.item_id, final_condition: 'HILANG' as const, completeness, loss: { description: d.missing_note || d.damage_note || 'Barang tidak dikembalikan / hilang' } };
      const severity = d.condition === 'RUSAK_BERAT' ? 'BERAT' : d.condition === 'DALAM_PERBAIKAN' ? 'SEDANG' : 'RINGAN';
      return { borrowing_item_id: det.id, asset_id: det.item_id, final_condition: 'RUSAK' as const, completeness, damage: { severity, description: (d.damage_note || '').trim() } };
    }),
  };
  try {
    const res = await returnsApi.create(body);
    await pullAll();
    return { ok: true, ret: db.get('returns', res.id)!, notification: null };
  } catch (e) {
    return apiFail(e);
  }
}

/* ================= Master data ================= */
export async function saveMaster(key: masterSvc.MasterKey, form: masterSvc.MasterForm, id: ID | null): Promise<Ok<object> | Fail> {
  if (!isApiMode) {
    const r = masterSvc.saveMaster(key, form, id);
    return r.ok ? r : { ok: false, error: 'Periksa isian.', errors: r.errors };
  }
  const errors = masterSvc.MASTER[key].validate(form, id);
  if (key === 'peminjam' && !form.email?.trim()) delete errors.email;
  if (Object.keys(errors).length) return { ok: false, error: 'Periksa isian.', errors };
  const t = (v?: string) => (v || '').trim();
  try {
    if (key === 'peminjam') {
      const body = { identity_number: t(form.nip), name: t(form.name), unit_id: form.unit_id ? Number(form.unit_id) : null, position: t(form.position) || null, email: t(form.email) || null, phone: t(form.phone) || null };
      if (id) await masterApi.updateBorrower(id, body);
      else await masterApi.createBorrower(body);
    } else if (id) {
      return { ok: false, error: 'Backend belum menyediakan endpoint ubah untuk data ini.' };
    } else if (key === 'kategori') await masterApi.createCategory({ code: t(form.code).toUpperCase(), name: t(form.name) });
    else if (key === 'lokasi') await masterApi.createLocation({ code: t(form.code).toUpperCase(), name: t(form.name), description: t(form.building) || null });
    else await masterApi.createUnit({ code: t(form.name).toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 20) || 'UNIT', name: t(form.name) });
    await pullAll();
    return { ok: true };
  } catch (e) {
    return apiFail(e);
  }
}

export async function setMasterActive(key: masterSvc.MasterKey, id: ID, active: boolean): Promise<Ok<object> | Fail> {
  if (!isApiMode) return masterSvc.setMasterActive(key, id, active);
  if (key !== 'peminjam') return { ok: false, error: 'Backend belum menyediakan endpoint untuk menonaktifkan data ini.' };
  try {
    await masterApi.updateBorrower(id, { is_active: active });
    await pullAll();
    return { ok: true };
  } catch (e) {
    return apiFail(e);
  }
}

export async function deleteMaster(key: masterSvc.MasterKey, id: ID): Promise<Ok<object> | Fail> {
  if (!isApiMode) return masterSvc.deleteMaster(key, id);
  if (key !== 'peminjam') return { ok: false, error: 'Backend belum menyediakan endpoint hapus untuk data ini.' };
  try {
    await masterApi.deleteBorrower(id);
    await pullAll();
    return { ok: true };
  } catch (e) {
    return apiFail(e);
  }
}

/* ================= Notifikasi ================= */
export async function retryNotification(id: ID): Promise<{ ok: boolean }> {
  if (!isApiMode) return notifSvc.retryNotification(id);
  try {
    await notificationsApi.resend(id);
    await pullAll();
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
