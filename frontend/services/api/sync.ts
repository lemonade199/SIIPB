/**
 * Adapter mode `api`: menarik data dari Flask REST API, memetakannya ke model domain frontend,
 * lalu mengisi store (cache di memori). Halaman tetap membaca store yang sama seperti mode mock,
 * sedangkan mutasi dikirim ke API lewat `services/repo.ts` lalu cache disegarkan.
 */
import { diffDays, localDate, nowISO } from '@/lib/date';
import { PERMISSIONS } from '@/lib/constants';
import { db, TABLES } from '@/lib/mock/db';
import { defaultSettings, defaultTemplates, migrate } from '@/lib/mock/defaults';
import { apiBaseAbsolute, tokenStore } from '@/services/api/client';
import {
  assetsApi,
  auditApi,
  authApi,
  borrowingsApi,
  masterApi,
  notificationsApi,
  returnsApi,
  settingsApi,
  usersApi,
  type ApiAsset,
  type ApiAssetHistory,
  type ApiAuditLog,
  type ApiBorrower,
  type ApiBorrowing,
  type ApiNotification,
  type ApiReturn,
  type ApiRole,
  type ApiSchedulerRun,
  type ApiTemplate,
  type ApiUser,
  type ApiUserRow,
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
  EmailTemplate,
  Employee,
  ID,
  Item,
  ItemMovement,
  ItemStatus,
  LoginMethod,
  MovementType,
  Notification,
  NotificationLog,
  PermissionKey,
  Recipient,
  Return,
  ReturnConditionKey,
  ReturnDetail,
  Role,
  SchedulerRun,
  Settings,
  User,
} from '@/types';

/* ================= Izin ================= */
const UI_PERMS = new Set<string>(PERMISSIONS.map((p) => p.key));
/** Kode lama backend (sebelum migrasi a7c3e91d2b40) → izin antarmuka. */
const LEGACY_PERM_MAP: Record<string, PermissionKey[]> = {
  'asset.view': ['dashboard.view', 'inventory.view', 'monitoring.view', 'borrowing.view', 'notification.view'],
  'asset.create': ['inventory.manage', 'masterdata.manage', 'qr.manage'],
  'asset.update': ['inventory.manage', 'qr.manage'],
  'asset.delete': ['inventory.manage'],
  'borrowing.create': ['borrowing.view', 'borrowing.manage', 'masterdata.manage', 'monitoring.view'],
  'borrowing.return': ['borrowing.view', 'return.manage', 'monitoring.view'],
  'user.manage': ['users.manage'],
  'audit.read': ['audit.view'],
};
export const ROLE_CODE: Record<string, string> = { ADMIN: 'admin', SARPRAS: 'petugas', PIMPINAN: 'pimpinan' };
const ROLE_NAME: Record<string, string> = { ADMIN: 'Administrator', SARPRAS: 'Petugas Sarpras/IT', PIMPINAN: 'Pimpinan' };
const uiRoleCode = (code: string) => ROLE_CODE[code] || code.toLowerCase();

export function mapPermissionCodes(codes: string[]): PermissionKey[] {
  const out = new Set<PermissionKey>();
  for (const p of codes) {
    if (UI_PERMS.has(p)) out.add(p as PermissionKey);
    else (LEGACY_PERM_MAP[p] || []).forEach((k) => out.add(k));
  }
  return [...out];
}

export function mapPermissions(u: Pick<ApiUser, 'roles' | 'permissions'>): PermissionKey[] {
  if (u.roles.includes('ADMIN')) return PERMISSIONS.map((p) => p.key);
  return mapPermissionCodes(u.permissions);
}

export function mapRole(r: ApiRole): Role {
  return {
    id: r.id,
    code: uiRoleCode(r.code),
    name: r.name,
    description: r.description || '',
    permissions: r.code === 'ADMIN' ? PERMISSIONS.map((p) => p.key) : mapPermissionCodes(r.permissions),
    system: r.system,
  };
}

export function mapUser(u: ApiUserRow): User {
  return {
    id: u.id,
    name: u.full_name,
    username: u.username,
    email: u.email,
    password: '',
    role_id: u.role_id ?? 0,
    active: u.is_active,
    login_method: (u.login_method as LoginMethod) || 'LOKAL',
    phone: u.phone || '',
    last_login: u.last_login_at,
    created_at: u.created_at || nowISO(),
  };
}

/* ================= Pemetaan entitas ================= */
const ITEM_STATUSES: ItemStatus[] = ['TERSEDIA', 'DIPINJAM', 'RUSAK', 'RUSAK_BERAT', 'DALAM_PERBAIKAN', 'HILANG'];
const CONDS: Condition[] = ['BAIK', 'RUSAK_RINGAN', 'RUSAK_BERAT'];

export const photoUrl = (path: string | null | undefined) => {
  if (!path) return null;
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  return new URL(apiBaseAbsolute()).origin + path;
};

/** Id foto server per URL (untuk hapus/urutkan foto). */
export const photoIds = new Map<string, number>();

export function mapAsset(a: ApiAsset): Item {
  const status = (ITEM_STATUSES as string[]).includes(a.status) ? (a.status as ItemStatus) : 'TERSEDIA';
  const photos = (a.photos?.length ? a.photos : a.photo_path ? [{ id: 0, path: a.photo_path }] : []).map((p) => {
    const url = photoUrl(p.path)!;
    if (p.id) photoIds.set(url, p.id);
    return url;
  });
  return {
    id: a.id,
    item_code: a.inventory_code,
    item_name: a.name,
    category_id: a.category_id,
    brand: a.brand || '',
    model: a.model || '',
    serial_number: a.serial_number || '',
    acquisition_year: a.purchase_date ? Number(a.purchase_date.slice(0, 4)) : '',
    acquisition_source: a.acquisition_source || '',
    acquisition_value: a.acquisition_cost ?? '',
    location_id: a.location_id ?? 0,
    condition_status: (CONDS as string[]).includes(a.condition) ? (a.condition as Condition) : 'BAIK',
    item_status: status,
    photos,
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

const BORROW_STATUS: Record<string, BorrowStatus> = { DRAF: 'DRAF', AKTIF: 'DIPINJAM', TERLAMBAT: 'TERLAMBAT', DIKEMBALIKAN: 'DIKEMBALIKAN', DIBATALKAN: 'DIBATALKAN' };

export function mapBorrowing(b: ApiBorrowing, returnedAt?: string | null): { borrowing: Borrowing; details: BorrowingDetail[] } {
  const created = b.created_at || b.borrowed_at || nowISO();
  const status = BORROW_STATUS[b.status] || 'DIPINJAM';
  const checkedOut = b.checked_out_at !== undefined ? b.checked_out_at : status === 'DRAF' ? null : b.borrowed_at || created;
  return {
    borrowing: {
      id: b.id,
      code: b.transaction_number,
      employee_id: b.borrower_id,
      borrow_date: (b.start_date || created).slice(0, 10),
      due_date: (b.due_date || created).slice(0, 10),
      purpose: b.purpose || '',
      notes: b.notes || '',
      status,
      created_by: b.handled_by,
      created_at: created,
      checked_out_at: checkedOut ?? null,
      checked_out_by: checkedOut ? (b.checked_out_by ?? b.handled_by) : null,
      returned_at: b.returned_at ?? returnedAt ?? null,
      cancel_reason: b.cancel_reason || undefined,
    },
    details: b.items.map((it) => ({
      id: it.id,
      borrowing_id: b.id,
      item_id: it.asset_id,
      item_condition_out: ((CONDS as string[]).includes(it.condition_out || '') ? it.condition_out : 'BAIK') as Condition,
    })),
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
      late_days: r.late_days ?? (b ? Math.max(0, diffDays(b.due_date, returnDate)) : 0),
      created_at: r.created_at || r.returned_at,
    },
    details: r.items.map((it) => {
      const sev = it.damage_report?.severity;
      const after = it.asset_status_after || '';
      const cond: ReturnConditionKey =
        it.final_condition === 'BAIK'
          ? 'BAIK'
          : it.final_condition === 'HILANG'
            ? 'HILANG'
            : after === 'RUSAK_BERAT' || after === 'DALAM_PERBAIKAN'
              ? after
              : sev === 'BERAT'
                ? 'RUSAK_BERAT'
                : 'RUSAK';
      const completeness = (it.completeness || '').toLowerCase();
      const incomplete = completeness.startsWith('tidak');
      return {
        id: it.id,
        return_id: r.id,
        item_id: it.asset_id,
        condition_after: cond,
        complete: !incomplete,
        missing_note: incomplete ? (it.completeness || '').replace(/^tidak lengkap:?\s*/i, '') : '',
        damage_note: it.damage_report?.description || it.loss_report?.description || it.notes || '',
      };
    }),
  };
}

/* ---- Notifikasi: backend menyimpan satu baris per penerima; UI menampilkan satu notifikasi per event ---- */
const NOTIF_STATUS: Record<string, Notification['status']> = { SENT: 'TERKIRIM', FAILED: 'GAGAL', QUEUED: 'MENUNGGU', PROCESSING: 'MENUNGGU', RETRYING: 'MENUNGGU' };
const RECIPIENT: Record<string, Recipient['type']> = { PEMINJAM: 'Peminjam', PETUGAS: 'Petugas', PIMPINAN: 'Pimpinan' };
const EVENT_TEMPLATE: Record<string, string> = {
  LOAN_CONFIRMATION: 'tpl_checkout',
  H_MINUS_3: 'tpl_h_min3',
  H_MINUS_1: 'tpl_h_min1',
  H_DAY: 'tpl_h',
  H_PLUS_1: 'tpl_h_plus1',
  H_PLUS_3: 'tpl_h_plus3',
  H_PLUS_7: 'tpl_h_plus7',
  RETURN_CONFIRMATION: 'tpl_return',
};
/** id notifikasi UI → id baris backend (semua penerima) untuk tandai terbaca / kirim ulang. */
export const notificationRows = new Map<ID, ApiNotification[]>();

const guessEvent = (n: ApiNotification): Notification['event'] =>
  (n.event as Notification['event']) || (/pengembalian/i.test(n.subject) ? 'PENGEMBALIAN' : /pengingat|batas/i.test(n.subject) ? 'H-1' : 'CHECKOUT');

export function mapNotifications(rows: ApiNotification[], fallbackBorrowing: (borrowerId: number | null) => ID): { notifications: Notification[]; logs: NotificationLog[] } {
  const groups = new Map<string, ApiNotification[]>();
  for (const n of rows) {
    const key = n.event_id ? `e${n.event_id}` : `n${n.id}`;
    groups.set(key, [...(groups.get(key) || []), n]);
  }
  const notifications: Notification[] = [];
  const logs: NotificationLog[] = [];
  notificationRows.clear();
  for (const list of groups.values()) {
    list.sort((a, b) => a.id - b.id);
    const head = list[0];
    const event = guessEvent(head);
    const borrowingId = head.borrowing_id ?? fallbackBorrowing(head.borrower_id);
    const statuses = list.map((n) => NOTIF_STATUS[n.status] || 'MENUNGGU');
    const status: Notification['status'] = statuses.includes('GAGAL') ? 'GAGAL' : statuses.includes('MENUNGGU') ? 'MENUNGGU' : 'TERKIRIM';
    const readByAll = [...new Set(list.flatMap((n) => n.read_by || []))];
    notificationRows.set(head.id, list);
    notifications.push({
      id: head.id,
      borrowing_id: borrowingId,
      event,
      template: EVENT_TEMPLATE[head.event_code || ''] || head.template_code || '',
      subject: head.subject,
      body: head.body || '',
      recipients: list.map((n) => ({
        type: RECIPIENT[n.recipient_type || 'PEMINJAM'] || 'Peminjam',
        name: n.recipient_name || n.recipient,
        email: n.recipient,
        ...(n.recipient_user_id ? { user_id: n.recipient_user_id } : {}),
      })),
      status,
      attempts: Math.max(...list.map((n) => n.deliveries.length)),
      created_at: head.created_at || nowISO(),
      sent_at: list.every((n) => n.sent_at) ? list.map((n) => n.sent_at!).sort().pop()! : null,
      read_by: readByAll,
      trigger: head.trigger || 'transaksi',
    });
    for (const n of list) {
      n.deliveries.forEach((d) =>
        logs.push({
          id: n.id * 100 + d.attempt,
          notification_id: head.id,
          borrowing_id: borrowingId,
          event,
          recipient: n.recipient,
          recipient_type: RECIPIENT[n.recipient_type || 'PEMINJAM'] || 'Peminjam',
          status: d.status === 'SENT' ? 'TERKIRIM' : 'GAGAL',
          attempt: d.attempt,
          message: d.error || (d.status === 'SENT' ? (d.provider === 'mock_smtp' ? '250 OK (SMTP simulasi)' : '250 OK') : d.status),
          at: d.attempted_at || head.created_at || nowISO(),
        }),
      );
    }
  }
  return { notifications, logs };
}

export function mapTemplate(t: ApiTemplate): EmailTemplate {
  return { id: t.id, code: EVENT_TEMPLATE[t.code] || t.code, name: t.name, subject: t.subject, body: t.body, updated_at: t.updated_at || nowISO() };
}
export const templateServerCode = (uiCode: string) => Object.entries(EVENT_TEMPLATE).find(([, v]) => v === uiCode)?.[0] || uiCode;

export function mapSchedulerRun(r: ApiSchedulerRun): SchedulerRun {
  return {
    id: r.id,
    at: r.at,
    today: r.today,
    trigger: r.trigger === 'BEAT' ? 'Celery Beat' : 'manual',
    checked: r.checked,
    late_marked: r.late_marked,
    sent: r.sent,
    skipped: r.skipped,
    failed: r.failed,
    details: r.details,
  };
}

export function mergeSettings(base: Settings, server: Record<string, unknown>): Settings {
  const s = server as Partial<Settings> & { rules?: Settings['rules'] };
  const merged: Settings = {
    ...base,
    ...(s as Partial<Settings>),
    smtp: { ...base.smtp, ...((s.smtp as Partial<Settings['smtp']>) || {}) },
    scheduler: { ...base.scheduler, ...((s.scheduler as Partial<Settings['scheduler']>) || {}) },
    security: { ...base.security, ...((s.security as Partial<Settings['security']>) || {}) },
    backup: { ...base.backup, ...((s.backup as Partial<Settings['backup']>) || {}) },
    parameters: (s.parameters as Settings['parameters']) || base.parameters,
    demo_offset_days: 0,
  };
  if (Array.isArray(s.rules)) merged.rules = s.rules.map((r) => ({ ...r, template: EVENT_TEMPLATE[r.template] || r.template }));
  return merged;
}

const ENTITY: Record<string, string> = {
  asset: 'items',
  borrowing: 'borrowings',
  return: 'returns',
  user: 'users',
  role: 'roles',
  borrower: 'employees',
  category: 'categories',
  location: 'locations',
  organizational_unit: 'units',
  notification: 'notifications',
  notification_template: 'email_templates',
  settings: 'settings',
};

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

const MOVE: Record<string, MovementType> = {
  CHECKOUT: 'DIPINJAM',
  RETURNED_GOOD: 'DIKEMBALIKAN',
  RETURNED_DAMAGED: 'DIKEMBALIKAN',
  RETURNED_LOST: 'DIKEMBALIKAN',
  CREATED: 'DICATAT',
  DEACTIVATED: 'DINONAKTIFKAN',
  ACTIVATED: 'DIAKTIFKAN',
  LOCATION_CHANGE: 'PINDAH_LOKASI',
  STATUS_CHANGED: 'UBAH_STATUS',
  REPAIR_COMPLETED: 'UBAH_STATUS',
};

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
  const at = () => nowISO();
  const data = { version: 1, created_at: nowISO(), _seq: {} } as DbData;
  TABLES.forEach((t) => {
    (data as unknown as Record<string, unknown[]>)[t] = [];
  });
  data.settings = defaultSettings(at);
  data.settings.institution = process.env.NEXT_PUBLIC_INSTITUTION || data.settings.institution;
  data.settings.backup.history = [];
  data.email_templates = defaultTemplates(at);
  return migrate(data);
}

/** Pengguna yang sedang login (dari respons login / /auth/me). */
let me: { user: User; role: Role; api: ApiUser } | null = null;
export const currentApiUser = () => me?.api ?? null;

function toLocalUser(u: ApiUser): { user: User; role: Role; api: ApiUser } {
  const code = u.roles[0] || 'USER';
  const role: Role = { id: -1, code: uiRoleCode(code), name: ROLE_NAME[code] || code, description: '', permissions: mapPermissions(u), system: true };
  const user: User = {
    id: u.id,
    name: u.full_name || u.username,
    username: u.username,
    email: u.email || '',
    password: '',
    role_id: role.id,
    active: true,
    login_method: (u.login_method as LoginMethod) || 'LOKAL',
    phone: u.phone || '',
    last_login: u.last_login_at || nowISO(),
    created_at: nowISO(),
  };
  return { user, role, api: u };
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
  db.replace(baseData());
}

const can = (p: PermissionKey) => !!me && me.role.permissions.includes(p);

/** Tarik seluruh data dari API lalu ganti isi store. */
export async function pullAll() {
  const movements = db.ready ? db.data.item_movements : [];
  const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
  const when = <T,>(ok: boolean, p: () => Promise<T>, fallback: T) => (ok ? safe(p(), fallback) : Promise.resolve(fallback));

  const [cats, locs, units, borrowers, assets, borrowings, returns, notifs, templates, audits, settings, runs, usersFull, roles, directory] = await Promise.all([
    masterApi.categories(),
    masterApi.locations(),
    masterApi.units(),
    masterApi.borrowers(),
    when(can('inventory.view'), () => assetsApi.all(), []),
    when(can('borrowing.view'), () => borrowingsApi.all(), []),
    when(can('borrowing.view'), () => returnsApi.all(), []),
    when(can('notification.view'), () => notificationsApi.all(), []),
    when(can('notification.view') || can('settings.manage'), () => notificationsApi.templates(), []),
    when(can('audit.view'), () => auditApi.all(), []),
    safe(settingsApi.get(), {} as Record<string, unknown>),
    when(can('notification.view') || can('notification.manage'), () => settingsApi.schedulerRuns(), []),
    when(can('users.manage'), () => usersApi.list(), []),
    when(can('users.manage'), () => usersApi.roles(), []),
    safe(usersApi.directory(), []),
  ]);

  const data = baseData();
  data.settings = mergeSettings(data.settings, settings);
  if (templates.length) data.email_templates = templates.map(mapTemplate);
  data.item_movements = movements;
  data.scheduler_runs = runs.map(mapSchedulerRun);

  const locName = new Map(locs.map((l) => [l.id, l.name]));
  data.categories = cats.map((c) => ({ id: c.id, code: c.code, name: c.name, active: c.is_active ?? true }));
  data.locations = locs.map((l) => ({
    id: l.id,
    code: l.code,
    name: l.name,
    building: l.description || (l.parent_id ? locName.get(l.parent_id) || '' : ''),
    active: l.is_active ?? true,
  }));
  data.units = units.map((u) => ({ id: u.id, name: u.name, active: u.is_active }));
  data.employees = borrowers.map(mapBorrower);
  photoIds.clear();
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
  const latestOfBorrower = (bid: number | null) =>
    data.borrowings.filter((b) => b.employee_id === bid).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.id ?? 0;
  const n = mapNotifications(notifs, latestOfBorrower);
  data.notifications = n.notifications;
  data.notification_logs = n.logs;
  data.activity_logs = audits.map(mapAudit);

  // Pengguna & role: lengkap bila berizin users.manage; selain itu direktori nama (tampilan saja)
  if (roles.length) {
    data.roles = roles.map(mapRole);
    data.users = usersFull.map(mapUser);
  } else {
    const roleByCode = new Map<string, Role>();
    if (me) roleByCode.set(me.role.code, me.role);
    data.users = directory.map((u) => {
      const code = uiRoleCode(u.roles[0] || 'USER');
      if (!roleByCode.has(code)) roleByCode.set(code, { id: -(roleByCode.size + 2), code, name: ROLE_NAME[u.roles[0]] || code, description: '', permissions: [], system: true });
      return { id: u.id, name: u.full_name, username: u.username, email: '', password: '', role_id: roleByCode.get(code)!.id, active: u.is_active, login_method: 'LOKAL', phone: '', last_login: null, created_at: nowISO() };
    });
    data.roles = [...roleByCode.values()];
  }
  if (me) {
    const self = data.users.find((u) => u.id === me!.user.id);
    if (self) {
      // sesi memakai izin dari token/profil terbaru
      me.user = { ...me.user, ...self, role_id: self.role_id };
      const role = data.roles.find((r) => r.id === self.role_id);
      if (role) me.role = { ...role, permissions: mapPermissions(me.api) };
      else data.roles.push(me.role);
    } else {
      data.users.push(me.user);
      data.roles.push(me.role);
    }
    // role sendiri harus mencerminkan izin efektif dari server
    data.roles = data.roles.map((r) => (r.id === me!.user.role_id ? { ...r, permissions: mapPermissions(me!.api) } : r));
  }
  data.settings.scheduler.last_run_date = data.settings.scheduler.last_run_date || (runs[0]?.today ?? null);
  db.replace(migrate(data));
}

export async function loadItemHistory(itemId: ID) {
  const list = await assetsApi.history(itemId);
  const others = db.data.item_movements.filter((m) => m.item_id !== itemId);
  db.data.item_movements = [...others, ...list.map((h) => mapHistory(itemId, h))];
  db.touch();
}

function startSession(u: ApiUser, access: string) {
  me = toLocalUser(u);
  setSession({ user_id: u.id, token: access, exp: jwtExp(access), method: 'JWT (Flask API)', started: new Date().toISOString() });
}

/** Perbarui profil & izin dari /auth/me (mis. setelah role diubah admin). */
export async function refreshMe() {
  const u = await authApi.me();
  startSession(u, tokenStore.get()?.access_token || '');
}

export async function apiLogin(username: string, password: string) {
  const res: LoginResponse = await authApi.login(username, password);
  startSession(res.user, res.access_token);
  await pullAll();
  return me!.user;
}

export async function apiLoginSso(code: string) {
  const res: LoginResponse = await authApi.exchangeSso(code);
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
  me = null;
  setSession(null);
  initApiStore();
}
