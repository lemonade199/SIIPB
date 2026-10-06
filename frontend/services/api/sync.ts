/**
 * Adapter mode `api`: menarik data dari Flask REST API, memetakannya ke model domain frontend,
 * lalu mengisi store (cache di memori). Halaman tetap membaca store yang sama seperti mode mock,
 * sedangkan mutasi dikirim ke API lewat `services/repo.ts` lalu cache disegarkan.
 */
import { atTime, diffDays, localDate, nowISO } from '@/lib/date';
import { PERMISSIONS } from '@/lib/constants';
import { db, TABLES } from '@/lib/mock/db';
import { defaultSettings, defaultTemplates, migrate } from '@/lib/mock/defaults';
import { API_BASE_URL, tokenStore } from '@/services/api/client';
import {
  assetsApi,
  auditApi,
  authApi,
  borrowingsApi,
  masterApi,
  notificationsApi,
  returnsApi,
  type ApiAsset,
  type ApiAssetHistory,
  type ApiAuditLog,
  type ApiBorrower,
  type ApiBorrowing,
  type ApiNotification,
  type ApiReturn,
  type ApiUser,
  type LoginResponse,
} from '@/services/api/endpoints';
import { getSession, setSession } from '@/services/session';
import type {
  ActivityLog,
  Borrowing,
  BorrowingDetail,
  BorrowStatus,
  Condition,
  DbData,
  Employee,
  ID,
  Item,
  ItemMovement,
  ItemStatus,
  MovementType,
  Notification,
  NotificationLog,
  PermissionKey,
  Return,
  ReturnConditionKey,
  ReturnDetail,
  Role,
  User,
} from '@/types';

/* ================= Pemetaan izin backend → izin antarmuka ================= */
const PERM_MAP: Record<string, PermissionKey[]> = {
  'asset.view': ['dashboard.view', 'inventory.view', 'monitoring.view', 'borrowing.view', 'notification.view'],
  'asset.create': ['inventory.manage', 'masterdata.manage', 'qr.manage'],
  'asset.update': ['inventory.manage', 'qr.manage'],
  'asset.delete': ['inventory.manage'],
  'borrowing.create': ['borrowing.view', 'borrowing.manage', 'masterdata.manage', 'monitoring.view'],
  'borrowing.return': ['borrowing.view', 'return.manage', 'monitoring.view'],
  'report.view': ['report.view', 'report.export', 'dashboard.view'],
  'user.manage': ['users.manage'],
  'settings.manage': ['settings.manage', 'notification.manage', 'notification.view'],
  'audit.view': ['audit.view'],
  'audit.read': ['audit.view'],
};
const ROLE_NAME: Record<string, string> = { ADMIN: 'Administrator', SARPRAS: 'Petugas Sarpras/IT', PIMPINAN: 'Pimpinan' };

export function mapPermissions(u: Pick<ApiUser, 'roles' | 'permissions'>): PermissionKey[] {
  if (u.roles.includes('ADMIN')) return PERMISSIONS.map((p) => p.key);
  const out = new Set<PermissionKey>();
  for (const p of u.permissions) (PERM_MAP[p] || []).forEach((k) => out.add(k));
  if (u.roles.includes('PIMPINAN')) ['dashboard.view', 'monitoring.view', 'report.view', 'report.export', 'notification.view'].forEach((k) => out.add(k as PermissionKey));
  return [...out];
}

/* ================= Pemetaan entitas ================= */
const ITEM_STATUSES: ItemStatus[] = ['TERSEDIA', 'DIPINJAM', 'RUSAK', 'RUSAK_BERAT', 'DALAM_PERBAIKAN', 'HILANG'];
const CONDS: Condition[] = ['BAIK', 'RUSAK_RINGAN', 'RUSAK_BERAT'];

export const photoUrl = (path: string | null) => {
  if (!path) return null;
  if (/^(https?:|data:)/.test(path)) return path;
  return new URL(API_BASE_URL).origin + path;
};

export function mapAsset(a: ApiAsset): Item {
  const status = (ITEM_STATUSES as string[]).includes(a.status) ? (a.status as ItemStatus) : 'TERSEDIA';
  const photo = photoUrl(a.photo_path);
  return {
    id: a.id,
    item_code: a.inventory_code,
    item_name: a.name,
    category_id: a.category_id,
    brand: a.brand || '',
    model: a.model || '',
    serial_number: a.serial_number || '',
    acquisition_year: a.purchase_date ? Number(a.purchase_date.slice(0, 4)) : '',
    acquisition_source: '',
    acquisition_value: a.acquisition_cost ?? '',
    location_id: a.location_id ?? 0,
    condition_status: (CONDS as string[]).includes(a.condition) ? (a.condition as Condition) : 'BAIK',
    item_status: status,
    photos: photo ? [photo] : [],
    notes: a.description || '',
    active: a.is_active && a.status !== 'NONAKTIF',
    created_at: a.created_at || nowISO(),
    updated_at: a.updated_at || a.created_at || nowISO(),
  };
}

export function mapBorrower(b: ApiBorrower): Employee {
  return {
    id: b.id,
    nip: b.identity_number || '',
    name: b.name,
    unit_id: b.unit_id ?? 0,
    email: b.email || '',
    phone: b.phone || '',
    position: b.position || '',
    active: b.is_active,
  };
}

const BORROW_STATUS: Record<string, BorrowStatus> = { AKTIF: 'DIPINJAM', TERLAMBAT: 'TERLAMBAT', DIKEMBALIKAN: 'DIKEMBALIKAN', DIBATALKAN: 'DIBATALKAN' };

export function mapBorrowing(b: ApiBorrowing, returnedAt?: string | null): { borrowing: Borrowing; details: BorrowingDetail[] } {
  const created = b.created_at || b.borrowed_at || nowISO();
  return {
    borrowing: {
      id: b.id,
      code: b.transaction_number,
      employee_id: b.borrower_id,
      borrow_date: (b.start_date || created).slice(0, 10),
      due_date: (b.due_date || created).slice(0, 10),
      purpose: b.purpose || '',
      notes: b.notes || '',
      status: BORROW_STATUS[b.status] || 'DIPINJAM',
      created_by: b.handled_by,
      created_at: created,
      checked_out_at: b.borrowed_at || created,
      checked_out_by: b.handled_by,
      returned_at: returnedAt ?? null,
    },
    details: b.items.map((it) => ({ id: it.id, borrowing_id: b.id, item_id: it.asset_id, item_condition_out: 'BAIK' as Condition })),
  };
}

export function mapReturn(r: ApiReturn, b: Borrowing | undefined): { ret: Return; details: ReturnDetail[] } {
  const returnDate = localDate(r.returned_at);
  return {
    ret: {
      id: r.id,
      code: `KMB-${String(r.id).padStart(4, '0')}`,
      borrowing_id: r.borrowing_id,
      return_date: returnDate,
      received_by: r.received_by,
      notes: r.notes || '',
      late_days: b ? Math.max(0, diffDays(b.due_date, returnDate)) : 0,
      created_at: r.created_at || r.returned_at,
    },
    details: r.items.map((it) => {
      const sev = it.damage_report?.severity;
      const cond: ReturnConditionKey = it.final_condition === 'BAIK' ? 'BAIK' : it.final_condition === 'HILANG' ? 'HILANG' : sev === 'BERAT' ? 'RUSAK_BERAT' : 'RUSAK';
      const completeness = (it.completeness || '').toLowerCase();
      return {
        id: it.id,
        return_id: r.id,
        item_id: it.asset_id,
        condition_after: cond,
        complete: !completeness || (completeness.includes('lengkap') && !completeness.includes('tidak')),
        missing_note: completeness.includes('tidak') ? it.completeness || '' : '',
        damage_note: it.damage_report?.description || it.loss_report?.description || it.notes || '',
      };
    }),
  };
}

const NOTIF_STATUS: Record<string, Notification['status']> = { SENT: 'TERKIRIM', FAILED: 'GAGAL', QUEUED: 'MENUNGGU', PROCESSING: 'MENUNGGU', RETRYING: 'MENUNGGU' };

export function mapNotification(n: ApiNotification, borrowingOfBorrower: (id: number | null) => ID): { notification: Notification; logs: NotificationLog[] } {
  const status = NOTIF_STATUS[n.status] || 'MENUNGGU';
  const at = n.created_at || nowISO();
  const bid = borrowingOfBorrower(n.borrower_id);
  return {
    notification: {
      id: n.id,
      borrowing_id: bid,
      event: (/pengembalian/i.test(n.subject) ? 'PENGEMBALIAN' : /pengingat|tenggat|batas/i.test(n.subject) ? 'H-1' : 'CHECKOUT') as Notification['event'],
      template: '',
      subject: n.subject,
      body: '(Isi email disimpan di server; tampilkan melalui log pengiriman SMTP.)',
      recipients: [{ type: 'Peminjam', name: n.recipient, email: n.recipient }],
      status,
      attempts: n.deliveries.length,
      created_at: at,
      sent_at: n.sent_at,
      read_by: [],
      trigger: 'server',
    },
    logs: n.deliveries.map((d, i) => ({
      id: n.id * 100 + i,
      notification_id: n.id,
      borrowing_id: bid,
      event: 'CHECKOUT',
      recipient: n.recipient,
      recipient_type: 'Peminjam',
      status: d.status === 'SENT' ? 'TERKIRIM' : 'GAGAL',
      attempt: d.attempt,
      message: d.error || (d.status === 'SENT' ? '250 OK' : d.status),
      at: d.attempted_at || at,
    })),
  };
}

const ENTITY: Record<string, string> = { asset: 'items', borrowing: 'borrowings', return: 'returns', user: 'users', borrower: 'employees', category: 'categories', location: 'locations' };

export function mapAudit(a: ApiAuditLog): ActivityLog {
  return {
    id: a.id,
    at: a.created_at,
    user_id: a.user_id ?? 0,
    action: `${a.module || 'system'}.${a.action.toLowerCase()}`,
    entity: ENTITY[a.entity_type || ''] || a.entity_type || a.module,
    entity_id: a.entity_id,
    old_value: a.old_data,
    new_value: a.new_data,
    ip: a.ip_address || '—',
  };
}

const MOVE: Record<string, MovementType> = { CHECKOUT: 'DIPINJAM', RETURN: 'DIKEMBALIKAN', RETURNED: 'DIKEMBALIKAN', CREATE: 'DICATAT', CREATED: 'DICATAT', DEACTIVATED: 'DINONAKTIFKAN', ACTIVATED: 'DIAKTIFKAN', LOCATION_CHANGE: 'PINDAH_LOKASI' };

export function mapHistory(itemId: ID, h: ApiAssetHistory): ItemMovement {
  const st = (s: string | null) => (s && (ITEM_STATUSES as string[]).includes(s) ? (s as ItemStatus) : null);
  return {
    id: itemId * 100000 + h.id,
    item_id: itemId,
    type: MOVE[h.event_type] || (h.old_location_id !== h.new_location_id ? 'PINDAH_LOKASI' : 'UBAH_STATUS'),
    from_status: st(h.old_status),
    to_status: st(h.new_status),
    note: h.reason || '',
    user_id: h.changed_by ?? 0,
    at: h.created_at,
  };
}

/* ================= Store ================= */
function baseData(): DbData {
  const today = new Date().toISOString().slice(0, 10);
  const at = (n: number, hh = '09:00') => atTime(today, hh);
  const data = { version: 1, created_at: nowISO(), _seq: {} } as DbData;
  TABLES.forEach((t) => {
    (data as unknown as Record<string, unknown[]>)[t] = [];
  });
  data.settings = defaultSettings(at);
  data.settings.institution = process.env.NEXT_PUBLIC_INSTITUTION || data.settings.institution;
  data.email_templates = defaultTemplates(at);
  return migrate(data);
}

/** Pengguna yang sedang login (dari respons login / /auth/me). */
let me: { user: User; role: Role } | null = null;
/** Pengaturan lokal dipertahankan antar sinkronisasi (belum ada endpoint pengaturan). */
const SETTINGS_KEY = 'siipb.api.settings';

function toLocalUser(u: ApiUser): { user: User; role: Role } {
  const code = u.roles[0] || 'USER';
  const role: Role = { id: 1, code: code.toLowerCase() === 'sarpras' ? 'petugas' : code.toLowerCase(), name: ROLE_NAME[code] || code, description: `Role backend: ${u.roles.join(', ')}`, permissions: mapPermissions(u), system: true };
  const user: User = {
    id: u.id,
    name: u.full_name || u.username,
    username: u.username,
    email: u.email || '',
    password: '',
    role_id: role.id,
    active: true,
    login_method: 'LOKAL',
    phone: '',
    last_login: nowISO(),
    created_at: nowISO(),
  };
  return { user, role };
}

function jwtExp(token: string): string {
  try {
    const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return new Date(p.exp * 1000).toISOString();
  } catch {
    return new Date(Date.now() + 3600_000).toISOString();
  }
}

/** Siapkan store kosong (sebelum login). */
export function initApiStore() {
  db.setPersist(false);
  const data = baseData();
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (saved) data.settings = { ...data.settings, ...saved };
  } catch {
    /* abaikan */
  }
  db.replace(migrate(data));
}


/** Tarik seluruh data dari API lalu ganti isi store. */
export async function pullAll() {
  const settings = db.ready ? db.data.settings : baseData().settings;
  const templates = db.ready ? db.data.email_templates : [];
  const movements = db.ready ? db.data.item_movements : [];
  const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);

  const [cats, locs, units, borrowers, assets, borrowings, returns, notifs, audits] = await Promise.all([
    masterApi.categories(),
    masterApi.locations(),
    masterApi.units(),
    masterApi.borrowers(),
    assetsApi.all(),
    borrowingsApi.all(),
    returnsApi.all(),
    safe(notificationsApi.all(), []),
    safe(auditApi.all(), []),
  ]);

  const data = baseData();
  data.settings = settings;
  if (templates.length) data.email_templates = templates;
  data.item_movements = movements;

  const locName = new Map(locs.map((l) => [l.id, l.name]));
  data.categories = cats.map((c) => ({ id: c.id, code: c.code, name: c.name, active: c.is_active ?? true }));
  data.locations = locs.map((l) => ({ id: l.id, code: l.code, name: l.name, building: l.parent_id ? locName.get(l.parent_id) || '' : '', active: l.is_active ?? true }));
  data.units = units.map((u) => ({ id: u.id, name: u.name, active: u.is_active }));
  data.employees = borrowers.map(mapBorrower);
  data.items = assets.map(mapAsset);

  const returnedAt = new Map(returns.map((r) => [r.borrowing_id, r.returned_at]));
  for (const b of borrowings) {
    const m = mapBorrowing(b, returnedAt.get(b.id));
    data.borrowings.push(m.borrowing);
    data.borrowing_details.push(...m.details);
  }
  const bmap = new Map(data.borrowings.map((b) => [b.id, b]));
  for (const r of returns) {
    const m = mapReturn(r, bmap.get(r.borrowing_id));
    data.returns.push(m.ret);
    data.return_details.push(...m.details);
  }
  // notifikasi backend tidak menyertakan borrowing_id → kaitkan ke transaksi terbaru peminjam
  const latestOfBorrower = (bid: number | null) => {
    const list = data.borrowings.filter((b) => b.employee_id === bid).sort((a, b) => b.created_at.localeCompare(a.created_at));
    return list[0]?.id ?? 0;
  };
  for (const n of notifs) {
    const m = mapNotification(n, latestOfBorrower);
    data.notifications.push(m.notification);
    data.notification_logs.push(...m.logs);
  }
  data.activity_logs = audits.map(mapAudit);

  // Pengguna: diri sendiri + nama petugas yang muncul di transaksi/audit (tampilan saja)
  const users = new Map<ID, User>();
  const roles: Role[] = me ? [me.role] : [];
  if (me) users.set(me.user.id, me.user);
  const ghost = (id: ID | null | undefined, name: string | null | undefined) => {
    if (!id || users.has(id) || !name) return;
    users.set(id, { id, name, username: '', email: '', password: '', role_id: 0, active: true, login_method: 'LOKAL', phone: '', last_login: null, created_at: nowISO() });
  };
  borrowings.forEach((b) => ghost(b.handled_by, b.handler_name));
  returns.forEach((r) => ghost(r.received_by, r.receiver_name));
  audits.forEach((a) => ghost(a.user_id, a.user_name));
  data.users = [...users.values()];
  data.roles = roles;

  db.replace(migrate(data));
}

export async function loadItemHistory(itemId: ID) {
  const list = await assetsApi.history(itemId);
  const others = db.data.item_movements.filter((m) => m.item_id !== itemId);
  db.data.item_movements = [...others, ...list.map((h) => mapHistory(itemId, h))];
  db.touch();
}

const USER_KEY = 'siipb.api.user';

function startSession(u: ApiUser, access: string) {
  // /auth/me tidak menyertakan nama & email → lengkapi dari data login yang tersimpan
  try {
    const saved = JSON.parse(localStorage.getItem(USER_KEY) || 'null') as ApiUser | null;
    if (saved && saved.id === u.id) u = { ...saved, ...u, full_name: u.full_name || saved.full_name, email: u.email || saved.email };
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  } catch {
    /* abaikan */
  }
  me = toLocalUser(u);
  setSession({ user_id: u.id, token: access, exp: jwtExp(access), method: 'JWT (Flask API)', started: new Date().toISOString() });
}

export async function apiLogin(username: string, password: string) {
  const res: LoginResponse = await authApi.login(username, password);
  startSession(res.user, res.access_token);
  await pullAll();
  return me!.user;
}

/** Pulihkan sesi saat halaman dimuat ulang (token masih tersimpan). */
export async function restoreApiSession(): Promise<boolean> {
  const t = tokenStore.get();
  if (!t || !getSession()) return false;
  try {
    const u = await authApi.me();
    startSession(u, tokenStore.get()?.access_token || t.access_token);
    await pullAll();
    return true;
  } catch {
    tokenStore.set(null);
    setSession(null);
    me = null;
    return false;
  }
}

export async function apiLogout() {
  await authApi.logout();
  try {
    localStorage.removeItem(USER_KEY);
  } catch {
    /* abaikan */
  }
  me = null;
  setSession(null);
  initApiStore();
}
