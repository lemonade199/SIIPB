/**
 * Repository — satu pintu mutasi data untuk halaman.
 *
 * Mode `mock`: memanggil layanan lokal (aturan bisnis di browser).
 * Mode `api` : memanggil Flask REST API, lalu menyegarkan cache store dari server.
 * Semua fungsi async sehingga halaman tidak perlu tahu sumber datanya.
 */
import { isApiMode } from '@/lib/config';
import { db } from '@/lib/mock/db';
import { download as downloadBlobFile } from '@/lib/file';
import { ApiError } from '@/services/api/client';
import {
  assetsApi,
  authApi,
  borrowingsApi,
  masterApi,
  notificationsApi,
  reportsApi,
  returnsApi,
  settingsApi,
  usersApi,
  type ApiAssetInput,
  type ApiBorrowingCreate,
  type ApiReturnCreate,
  type MasterPath,
} from '@/services/api/endpoints';
import {
  apiLogin,
  apiLoginSso,
  apiLogout,
  loadItemHistory as apiLoadHistory,
  notificationRows,
  photoIds,
  pullAll,
  refreshMe,
} from '@/services/api/sync';
import * as authSvc from '@/services/auth';
import * as borrowSvc from '@/services/borrowing';
import * as invSvc from '@/services/inventory';
import * as masterSvc from '@/services/master';
import * as notifSvc from '@/services/notification';
import * as returnSvc from '@/services/return';
import * as schedSvc from '@/services/scheduler';
import * as settingsSvc from '@/services/settings';
import * as usersSvc from '@/services/users';
import { currentUser } from '@/services/session';
import { item as getItem, itemsOf, detailsOf } from '@/services/lookup';
import type { Borrowing, FieldErrors, ID, Item, Notification, PermissionKey, RecipientKind, Return, ReportFilters, Settings, User } from '@/types';

type Ok<T> = { ok: true } & T;
type Fail = { ok: false; error: string; errors?: FieldErrors };

const FIELD_ALIAS: Record<string, string> = {
  name: 'item_name',
  inventory_code: 'item_code',
  purchase_date: 'acquisition_year',
  acquisition_cost: 'acquisition_value',
  borrower_id: 'employee_id',
  asset_ids: 'item_ids',
  start_date: 'borrow_date',
  identity_number: 'nip',
  full_name: 'name',
  role_id: 'role_id',
};

function apiFail(e: unknown, alias = false): Fail {
  if (e instanceof ApiError) {
    const errors: FieldErrors = {};
    Object.entries(e.errors || {}).forEach(([k, v]) => {
      const msg = Array.isArray(v) ? v.join(' ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
      errors[alias ? FIELD_ALIAS[k] || k : k] = msg;
    });
    return { ok: false, error: e.message, errors };
  }
  return { ok: false, error: (e as Error)?.message || 'Terjadi kesalahan.' };
}

async function attempt<T extends object>(fn: () => Promise<T>, alias = false): Promise<Ok<T> | Fail> {
  try {
    const out = await fn();
    return { ok: true, ...out };
  } catch (e) {
    return apiFail(e, alias);
  }
}

const dataUrlToFile = async (url: string, name: string) => {
  const blob = await (await fetch(url)).blob();
  const ext = (blob.type.split('/')[1] || 'jpeg').replace('jpeg', 'jpg');
  return new File([blob], `${name}.${ext}`, { type: blob.type || 'image/jpeg' });
};

/* ================= Auth ================= */
export async function login(username: string, password: string): Promise<Ok<{ user: User }> | Fail> {
  if (!isApiMode) return authSvc.login(username, password);
  return attempt(async () => ({ user: await apiLogin(username, password) }));
}

export async function loginSso(code: string): Promise<Ok<{ user: User }> | Fail> {
  return attempt(async () => ({ user: await apiLoginSso(code) }));
}

export async function logout() {
  if (!isApiMode) return authSvc.logout();
  await apiLogout();
}

export async function refresh() {
  if (isApiMode) await pullAll();
}

export async function changePassword(u: User, oldPw: string, next: string, confirm: string): Promise<{ ok: true } | { ok: false; errors: FieldErrors }> {
  if (!isApiMode) return authSvc.changePassword(u, oldPw, next, confirm);
  if (next !== confirm) return { ok: false, errors: { new2: 'Tidak sama dengan kata sandi baru.' } };
  try {
    await authApi.changePassword(oldPw, next);
    return { ok: true };
  } catch (e) {
    const f = apiFail(e);
    return { ok: false, errors: /saat ini|lama/i.test(f.error) ? { old: f.error } : { new1: f.error } };
  }
}

export async function updateProfile(u: User, p: { name: string; email: string; phone: string }): Promise<Ok<object> | Fail> {
  if (!isApiMode) {
    db.update('users', u.id, { name: p.name.trim(), email: p.email.trim(), phone: p.phone.trim() });
    db.save();
    return { ok: true };
  }
  return attempt(async () => {
    await authApi.updateMe({ full_name: p.name.trim(), email: p.email.trim(), phone: p.phone.trim() || null });
    await refreshMe();
    await pullAll();
    return {};
  });
}

/* ================= Inventaris ================= */
async function syncPhotos(assetId: ID, photos: string[]) {
  let current = (await assetsApi.get(assetId)).photos || [];
  const keep = new Set(photos.map((p) => photoIds.get(p)).filter((x): x is number => !!x));
  for (const ph of current) if (!keep.has(ph.id)) current = (await assetsApi.deletePhoto(assetId, ph.id)).photos || [];
  const fresh = photos.filter((p) => p.startsWith('data:') || p.startsWith('blob:'));
  if (fresh.length) {
    const files = await Promise.all(fresh.map((p, i) => dataUrlToFile(p, `foto-${i + 1}`)));
    current = (await assetsApi.uploadPhotos(assetId, files)).photos || [];
  }
  // urutan sesuai form (foto pertama = foto utama)
  const byUrl = new Map<string, number>();
  photos.forEach((p) => {
    const id = photoIds.get(p);
    if (id) byUrl.set(p, id);
  });
  const newIds = current.map((c) => c.id).filter((id) => ![...byUrl.values()].includes(id));
  const order: number[] = [];
  let k = 0;
  for (const p of photos) order.push(byUrl.get(p) ?? newIds[k++]);
  const valid = order.filter((x) => x !== undefined);
  if (valid.length === current.length && valid.some((id, i) => id !== current[i].id)) await assetsApi.orderPhotos(assetId, valid);
}

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
    purchase_date: p.acquisition_year ? `${p.acquisition_year}-01-01` : null,
    acquisition_cost: p.acquisition_value === '' ? null : Number(p.acquisition_value),
    acquisition_source: p.acquisition_source || null,
    condition: p.condition_status,
  };
  try {
    let assetId = id ?? null;
    if (assetId) await assetsApi.update(assetId, body);
    else assetId = (await assetsApi.create({ ...body, inventory_code: (p.item_code || '').trim() || null })).id;
    try {
      await syncPhotos(assetId, p.photos || []);
    } catch (e) {
      await pullAll();
      return { ok: false, error: `Barang tersimpan, tetapi foto gagal diunggah: ${(e as Error).message}` };
    }
    await pullAll();
    return { ok: true, item: getItem(assetId)! };
  } catch (e) {
    return apiFail(e, true);
  }
}

export async function setItemActive(id: ID, active: boolean, reason = ''): Promise<Ok<object> | Fail> {
  if (!isApiMode) return invSvc.setItemActive(id, active, reason);
  return attempt(async () => {
    await assetsApi.update(id, { is_active: active, reason: reason || (active ? 'Diaktifkan kembali' : 'Dinonaktifkan') });
    await pullAll();
    return {};
  });
}

export async function setItemStatus(id: ID, status: Item['item_status'], note = ''): Promise<Ok<object> | Fail> {
  if (!isApiMode) return invSvc.setItemStatus(id, status, note);
  return attempt(async () => {
    await assetsApi.setStatus(id, status, note);
    await pullAll();
    return {};
  });
}

export async function loadItemHistory(id: ID) {
  if (isApiMode) await apiLoadHistory(id);
}

/* ================= Peminjaman ================= */
type BorrowSave = { ok: true; borrowing: Borrowing; notification?: Notification | null } | { ok: false; errors: FieldErrors };

const borrowBody = (p: borrowSvc.BorrowingInput, checkout?: boolean): ApiBorrowingCreate => ({
  borrower_id: Number(p.employee_id),
  start_date: p.borrow_date,
  due_date: p.due_date,
  purpose: p.purpose.trim(),
  notes: p.notes?.trim() || undefined,
  asset_ids: p.item_ids.map(Number),
  ...(checkout === undefined ? {} : { checkout }),
});

const latestNotification = (bid: ID) =>
  db.where('notifications', (n) => n.borrowing_id === bid).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] || null;

export async function createBorrowing(p: borrowSvc.BorrowingInput, checkout: boolean): Promise<BorrowSave> {
  if (!isApiMode) return borrowSvc.createBorrowing(p, { checkout });
  const errors = borrowSvc.validateBorrowing(p);
  if (Object.keys(errors).length) return { ok: false, errors };
  try {
    const res = await borrowingsApi.create(borrowBody(p, checkout));
    await pullAll();
    return { ok: true, borrowing: db.get('borrowings', res.id)!, notification: checkout ? latestNotification(res.id) : null };
  } catch (e) {
    const f = apiFail(e, true);
    return { ok: false, errors: { item_ids: f.error, ...(f.errors || {}) } };
  }
}

export async function updateDraft(id: ID, p: borrowSvc.BorrowingInput): Promise<BorrowSave> {
  if (!isApiMode) return borrowSvc.updateDraft(id, p);
  const errors = borrowSvc.validateBorrowing(p);
  if (Object.keys(errors).length) return { ok: false, errors };
  try {
    await borrowingsApi.update(id, borrowBody(p));
    await pullAll();
    return { ok: true, borrowing: db.get('borrowings', id)! };
  } catch (e) {
    const f = apiFail(e, true);
    return { ok: false, errors: { _: f.error, ...(f.errors || {}) } };
  }
}

export async function checkout(id: ID): Promise<{ ok: true; borrowing: Borrowing; notification: Notification | null } | { ok: false; error: string }> {
  if (!isApiMode) return borrowSvc.checkout(id);
  try {
    await borrowingsApi.checkout(id);
    await pullAll();
    return { ok: true, borrowing: db.get('borrowings', id)!, notification: latestNotification(id) };
  } catch (e) {
    return apiFail(e);
  }
}

export async function cancelBorrowing(id: ID, reason: string): Promise<Ok<object> | Fail> {
  if (!isApiMode) return borrowSvc.cancelBorrowing(id, reason);
  return attempt(async () => {
    await borrowingsApi.cancel(id, reason);
    await pullAll();
    return {};
  });
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
    returned_date: p.return_date || undefined,
    items: detailsOf(b).map((det) => {
      const d = p.details[det.item_id];
      const completeness = d.complete ? 'Lengkap' : `Tidak lengkap: ${d.missing_note || '-'}`;
      const base = { borrowing_item_id: det.id, asset_id: det.item_id, completeness };
      if (d.condition === 'BAIK') return { ...base, final_condition: 'BAIK' as const };
      if (d.condition === 'HILANG') return { ...base, final_condition: 'HILANG' as const, loss: { description: (d.damage_note || d.missing_note || 'Barang tidak dikembalikan / hilang').trim() } };
      const severity = d.condition === 'RUSAK_BERAT' ? 'BERAT' : d.condition === 'DALAM_PERBAIKAN' ? 'SEDANG' : 'RINGAN';
      const asset_status = d.condition === 'RUSAK_BERAT' ? 'RUSAK_BERAT' : d.condition === 'DALAM_PERBAIKAN' ? 'DALAM_PERBAIKAN' : 'RUSAK';
      return { ...base, final_condition: 'RUSAK' as const, asset_status: asset_status as 'RUSAK', damage: { severity: severity as 'RINGAN', description: (d.damage_note || '').trim() } };
    }),
  };
  try {
    const res = await returnsApi.create({ ...body, send_confirmation: p.send_confirmation !== false });
    await pullAll();
    return { ok: true, ret: db.get('returns', res.id)!, notification: p.send_confirmation === false ? null : latestNotification(b.id) };
  } catch (e) {
    return apiFail(e);
  }
}

/* ================= Master data ================= */
const MASTER_PATH: Record<masterSvc.MasterKey, MasterPath> = {
  peminjam: 'borrowers',
  kategori: 'categories',
  lokasi: 'locations',
  unit: 'organizational-units',
};

function masterBody(key: masterSvc.MasterKey, form: masterSvc.MasterForm, id: ID | null): Record<string, unknown> {
  const t = (v?: string) => (v || '').trim();
  if (key === 'peminjam')
    return { identity_number: t(form.nip) || null, name: t(form.name), unit_id: form.unit_id ? Number(form.unit_id) : null, position: t(form.position) || null, email: t(form.email) || null, phone: t(form.phone) || null };
  if (key === 'kategori') return { code: t(form.code).toUpperCase(), name: t(form.name) };
  if (key === 'lokasi') return { code: t(form.code).toUpperCase(), name: t(form.name), description: t(form.building) || null };
  const body: Record<string, unknown> = { name: t(form.name) };
  if (!id) body.code = t(form.name).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || `UNIT-${Date.now() % 10000}`;
  return body;
}

export async function saveMaster(key: masterSvc.MasterKey, form: masterSvc.MasterForm, id: ID | null): Promise<Ok<object> | Fail> {
  if (!isApiMode) {
    const r = masterSvc.saveMaster(key, form, id);
    return r.ok ? r : { ok: false, error: 'Periksa isian.', errors: r.errors };
  }
  const errors = masterSvc.MASTER[key].validate(form, id);
  if (Object.keys(errors).length) return { ok: false, error: 'Periksa isian.', errors };
  return attempt(async () => {
    const body = masterBody(key, form, id);
    if (id) await masterApi.update(MASTER_PATH[key], id, body);
    else await masterApi.create(MASTER_PATH[key], body);
    await pullAll();
    return {};
  }, true);
}

export async function setMasterActive(key: masterSvc.MasterKey, id: ID, active: boolean): Promise<Ok<object> | Fail> {
  if (!isApiMode) return masterSvc.setMasterActive(key, id, active);
  return attempt(async () => {
    await masterApi.update(MASTER_PATH[key], id, { is_active: active });
    await pullAll();
    return {};
  });
}

export async function deleteMaster(key: masterSvc.MasterKey, id: ID): Promise<Ok<object> | Fail> {
  if (!isApiMode) return masterSvc.deleteMaster(key, id);
  return attempt(async () => {
    await masterApi.remove(MASTER_PATH[key], id);
    await pullAll();
    return {};
  });
}

export async function updateParameter(kind: 'item_status' | 'condition', code: string, label: string, desc: string): Promise<{ ok: true } | { ok: false; errors: FieldErrors }> {
  if (!isApiMode) return settingsSvc.updateParameter(kind, code, label, desc);
  if (!label.trim()) return { ok: false, errors: { label: 'Wajib diisi.' } };
  const params = structuredClone(db.data.settings.parameters);
  (params[kind] as Record<string, { label: string; desc: string }>)[code] = { label: label.trim(), desc: desc.trim() };
  try {
    await settingsApi.update({ parameters: params });
    await pullAll();
    return { ok: true };
  } catch (e) {
    return { ok: false, errors: { label: apiFail(e).error } };
  }
}

/* ================= Notifikasi & scheduler ================= */
export async function retryNotification(id: ID): Promise<{ ok: boolean; error?: string }> {
  if (!isApiMode) return notifSvc.retryNotification(id);
  try {
    const rows = notificationRows.get(id) || [{ id, status: 'FAILED' }];
    for (const r of rows) if (r.status !== 'SENT') await notificationsApi.resend(r.id);
    await pullAll();
    const n = db.get('notifications', id);
    return { ok: n?.status === 'TERKIRIM' };
  } catch (e) {
    return { ok: false, error: apiFail(e).error };
  }
}

export async function markRead(id: ID, userId: ID) {
  if (!isApiMode) return notifSvc.markRead(id, userId);
  const n = db.get('notifications', id);
  if (n && !n.read_by.includes(userId)) {
    n.read_by.push(userId);
    db.touch();
  }
  const rows = notificationRows.get(id) || [];
  await Promise.all(rows.map((r) => notificationsApi.read(r.id).catch(() => undefined)));
}

export async function markAllRead(u: User) {
  if (!isApiMode) return notifSvc.markAllRead(u);
  notifSvc.inbox(u).forEach((n) => !n.read_by.includes(u.id) && n.read_by.push(u.id));
  db.touch();
  await notificationsApi.readAll().catch(() => undefined);
}

export async function runScheduler(): Promise<Ok<{ result: schedSvc.SchedulerResult }> | Fail> {
  if (!isApiMode) return { ok: true, result: schedSvc.runScheduler({ trigger: 'manual', user_id: currentUser()?.id }) };
  return attempt(async () => {
    const res = await settingsApi.runScheduler();
    await pullAll();
    const r = res.data;
    return { result: { at: r.at, today: r.today, trigger: 'manual', checked: r.checked, late_marked: r.late_marked, sent: r.sent, skipped: r.skipped, failed: r.failed, details: r.details } };
  });
}

/* ================= Pengaturan ================= */
/** Simpan bagian pengaturan. Mode api: dikirim ke PUT /settings (sebagian). */
export async function saveSettings(patch: Partial<Settings> & { smtp_password?: string }, label: string): Promise<Ok<object> | Fail> {
  const { smtp_password, ...rest } = patch;
  if (!isApiMode) {
    settingsSvc.updateSettings((s) => Object.assign(s, structuredClone(rest)), label, { bagian: label });
    return { ok: true };
  }
  return attempt(async () => {
    const body: Record<string, unknown> = { ...rest };
    if (rest.rules) body.rules = rest.rules.map((r) => ({ event: r.event, days: r.days, active: r.active, to: r.to, desc: r.desc }));
    if (smtp_password) body.smtp = { ...(rest.smtp || {}), password: smtp_password };
    delete (body as { demo_offset_days?: number }).demo_offset_days;
    delete (body as { backup?: unknown }).backup;
    await settingsApi.update(body);
    await pullAll();
    return {};
  });
}

export async function setRuleRecipient(index: number, to: RecipientKind, on: boolean): Promise<Ok<object> | Fail> {
  if (!isApiMode) {
    settingsSvc.setRuleRecipient(index, to, on);
    return { ok: true };
  }
  const rules = structuredClone(db.data.settings.rules);
  const r = rules[index];
  r.to = on ? [...new Set([...r.to, to])] : r.to.filter((x) => x !== to);
  return saveSettings({ rules }, 'rules');
}

export async function setRuleActive(index: number, active: boolean): Promise<Ok<object> | Fail> {
  if (!isApiMode) {
    settingsSvc.setRuleActive(index, active);
    return { ok: true };
  }
  const rules = structuredClone(db.data.settings.rules);
  rules[index].active = active;
  return saveSettings({ rules }, 'rules');
}

export async function saveTemplate(id: ID, subject: string, body: string): Promise<Ok<object> | Fail> {
  if (!isApiMode) {
    settingsSvc.saveTemplate(id, subject, body);
    return { ok: true };
  }
  return attempt(async () => {
    await notificationsApi.updateTemplate(id, { subject, body });
    await pullAll();
    return {};
  });
}

export async function testSmtp(): Promise<{ ok: boolean; message: string }> {
  if (!isApiMode) {
    const ok = settingsSvc.testSmtp();
    return { ok, message: ok ? 'Koneksi SMTP berhasil (simulasi).' : 'Koneksi SMTP gagal (simulasi kegagalan aktif).' };
  }
  try {
    const res = await settingsApi.testSmtp();
    return { ok: true, message: res.message };
  } catch (e) {
    return { ok: false, message: apiFail(e).error };
  }
}

export async function backupNow(): Promise<{ ok: boolean; message: string }> {
  if (!isApiMode) return { ok: false, message: 'Gunakan "Unduh backup JSON" pada mode demo.' };
  try {
    const res = await settingsApi.backupNow();
    await pullAll();
    return { ok: true, message: res.message };
  } catch (e) {
    return { ok: false, message: apiFail(e).error };
  }
}

export async function downloadBackup(name: string) {
  const { blob, filename } = await settingsApi.downloadBackup(name);
  downloadBlobFile(filename, blob);
}

/* ================= Laporan ================= */
export async function exportReport(filters: ReportFilters, format: 'xlsx' | 'pdf'): Promise<{ ok: true } | Fail> {
  try {
    const { type, ...rest } = filters;
    const { blob, filename } = await reportsApi.download(type, format, rest);
    downloadBlobFile(filename, blob);
    return { ok: true };
  } catch (e) {
    return apiFail(e);
  }
}

/* ================= Pengguna & role ================= */
export async function saveUser(d: usersSvc.UserInput, existing: User | null, actorId: ID): Promise<{ ok: true } | { ok: false; errors: FieldErrors }> {
  if (!isApiMode) return usersSvc.saveUser(d, existing, actorId);
  const body: Record<string, unknown> = {
    full_name: d.name.trim(),
    email: d.email.trim(),
    phone: d.phone.trim() || null,
    role_id: Number(d.role_id),
  };
  if (existing && existing.id !== actorId) body.is_active = d.active;
  if (!existing) {
    body.username = d.username.trim();
    body.password = d.login_method === 'SSO' ? null : d.password || '';
    body.sso_only = d.login_method === 'SSO';
  }
  try {
    if (existing) await usersApi.update(existing.id, body);
    else await usersApi.create(body);
    await pullAll();
    return { ok: true };
  } catch (e) {
    const f = apiFail(e, true);
    return { ok: false, errors: Object.keys(f.errors || {}).length ? f.errors! : { _: f.error } };
  }
}

/** Reset kata sandi oleh admin: kata sandi sementara dibuat di sini dan dikirim ke server. */
export async function resetPassword(id: ID): Promise<string | null> {
  if (!isApiMode) return usersSvc.resetPassword(id);
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const rnd = crypto.getRandomValues(new Uint32Array(10));
  const pw = 'Siipb-' + Array.from(rnd, (n) => alphabet[n % alphabet.length]).join('') + '9';
  try {
    await usersApi.update(id, { password: pw });
    return pw;
  } catch {
    return null;
  }
}

export async function createRole(name: string, description: string): Promise<{ ok: true } | { ok: false; errors: FieldErrors }> {
  if (!isApiMode) return usersSvc.createRole(name, description);
  if (!name.trim()) return { ok: false, errors: { name: 'Wajib diisi.' } };
  try {
    const code = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 50);
    await usersApi.createRole({ code: code.length >= 3 ? code : `ROLE_${code}`, name: name.trim(), description: description.trim(), permissions: ['dashboard.view'] });
    await pullAll();
    return { ok: true };
  } catch (e) {
    const f = apiFail(e);
    return { ok: false, errors: { name: f.errors?.code || f.error } };
  }
}

export async function setRolePermission(roleId: ID, perm: PermissionKey, granted: boolean): Promise<Ok<object> | Fail> {
  if (!isApiMode) {
    usersSvc.setRolePermission(roleId, perm, granted);
    return { ok: true };
  }
  const role = db.get('roles', roleId);
  if (!role || role.code === 'admin') return { ok: false, error: 'Role Administrator selalu memiliki semua izin.' };
  const permissions = granted ? [...new Set([...role.permissions, perm])] : role.permissions.filter((p) => p !== perm);
  return attempt(async () => {
    await usersApi.updateRole(roleId, { permissions });
    await refreshMe();
    await pullAll();
    return {};
  });
}
