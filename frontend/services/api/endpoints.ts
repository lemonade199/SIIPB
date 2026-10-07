/**
 * Endpoint Flask REST API SIIPB (`backend/app/routes`, prefix /api/v1).
 * Bentuk DTO mengikuti serializer backend (snake_case). Dokumentasi lengkap: /api/docs (Swagger).
 */
import { api, download, request, tokenStore, type ApiEnvelope } from '@/services/api/client';

/* ================= DTO ================= */
export interface ApiUser {
  id: number;
  username: string;
  email?: string;
  full_name?: string;
  phone?: string | null;
  unit_id?: number | null;
  roles: string[];
  permissions: string[];
  login_method?: string;
  last_login_at?: string | null;
}
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  user: ApiUser;
}
export interface ApiUserRow {
  id: number;
  username: string;
  email: string;
  full_name: string;
  phone: string | null;
  unit_id: number | null;
  is_active: boolean;
  roles: { id: number; code: string; name: string }[];
  role_id: number | null;
  login_method: string;
  last_login_at: string | null;
  created_at: string | null;
}
export interface ApiDirectoryUser {
  id: number;
  full_name: string;
  username: string;
  is_active: boolean;
  roles: string[];
}
export interface ApiRole {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  system: boolean;
  permissions: string[];
  user_count: number;
}
export interface ApiCategory {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_active?: boolean;
}
export interface ApiLocation {
  id: number;
  code: string;
  name: string;
  parent_id: number | null;
  parent_name?: string | null;
  description?: string | null;
  is_active?: boolean;
}
export interface ApiUnit {
  id: number;
  code: string;
  name: string;
  parent_id: number | null;
  is_active: boolean;
}
export interface ApiBorrower {
  id: number;
  name: string;
  identity_number: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
  unit_id: number | null;
  unit_name?: string | null;
  is_active: boolean;
}
export interface ApiAsset {
  id: number;
  inventory_code: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  description: string | null;
  photo_path: string | null;
  photos?: { id: number; path: string }[];
  purchase_date: string | null;
  acquisition_cost: number | null;
  acquisition_source?: string | null;
  status: string;
  condition: string;
  category_id: number;
  category_name: string | null;
  location_id: number | null;
  location_name: string | null;
  owner_unit_id: number | null;
  owner_unit_name: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}
export interface ApiAssetInput {
  inventory_code?: string | null;
  category_id?: number;
  location_id?: number | null;
  name?: string;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  description?: string | null;
  purchase_date?: string | null;
  acquisition_cost?: number | null;
  acquisition_source?: string | null;
  condition?: string;
  status?: string;
  is_active?: boolean;
  reason?: string | null;
}
export interface ApiAssetHistory {
  id: number;
  event_type: string;
  old_status: string | null;
  new_status: string | null;
  old_condition: string | null;
  new_condition: string | null;
  old_location_id: number | null;
  new_location_id: number | null;
  reason: string | null;
  changed_by: number | null;
  changed_by_name?: string | null;
  created_at: string;
}
export interface ApiBorrowing {
  id: number;
  transaction_number: string;
  borrower_id: number;
  borrower: { id: number; name: string; identity_number: string | null; email: string | null; phone: string | null };
  handled_by: number;
  handler_name: string | null;
  borrowed_at: string | null;
  start_date: string | null;
  due_date: string | null;
  status: string;
  purpose: string | null;
  notes: string | null;
  checked_out_at?: string | null;
  checked_out_by?: number | null;
  checked_out_name?: string | null;
  cancel_reason?: string | null;
  returned_at?: string | null;
  items: { id: number; asset_id: number; asset_name: string | null; inventory_code: string | null; condition_out?: string | null; checked_out_at: string | null }[];
  created_at: string | null;
}
export interface ApiBorrowingCreate {
  borrower_id: number;
  start_date: string;
  due_date: string;
  purpose?: string;
  notes?: string;
  asset_ids: number[];
  checkout?: boolean;
}
export interface ApiReturnItem {
  id: number;
  borrowing_item_id: number;
  asset_id: number;
  asset_name: string | null;
  inventory_code: string | null;
  final_condition: 'BAIK' | 'RUSAK' | 'HILANG';
  asset_status_after?: string | null;
  completeness: string | null;
  notes: string | null;
  damage_report: { id: number; severity: string; description: string; repair_cost: number | null; repair_status: string } | null;
  loss_report: { id: number; description: string } | null;
}
export interface ApiReturn {
  id: number;
  borrowing_id: number;
  transaction_number: string;
  received_by: number;
  receiver_name: string | null;
  returned_at: string;
  late_days?: number;
  notes: string | null;
  created_at: string;
  items: ApiReturnItem[];
}
export interface ApiReturnCreate {
  borrowing_id: number;
  notes?: string;
  returned_date?: string;
  send_confirmation?: boolean;
  items: {
    borrowing_item_id: number;
    asset_id: number;
    final_condition: 'BAIK' | 'RUSAK' | 'HILANG';
    asset_status?: 'RUSAK' | 'RUSAK_BERAT' | 'DALAM_PERBAIKAN';
    completeness?: string;
    notes?: string;
    damage?: { severity: 'RINGAN' | 'SEDANG' | 'BERAT'; description: string; repair_cost?: number };
    loss?: { description: string };
  }[];
}
export interface ApiNotification {
  id: number;
  event_id: number | null;
  event_code?: string | null;
  event?: string | null;
  borrowing_id?: number | null;
  transaction_number?: string | null;
  trigger?: string;
  borrower_id: number | null;
  template_code?: string | null;
  channel: string;
  recipient: string;
  recipient_name?: string | null;
  recipient_type?: 'PEMINJAM' | 'PETUGAS' | 'PIMPINAN';
  recipient_user_id?: number | null;
  subject: string;
  body?: string | null;
  status: string;
  sent_at: string | null;
  created_at: string | null;
  read_by?: number[];
  deliveries: { attempt: number; status: string; provider?: string; error: string | null; attempted_at: string | null }[];
  logs?: { status: string; message: string; created_at: string | null }[];
}
export interface ApiTemplate {
  id: number;
  code: string;
  event: string | null;
  name: string;
  subject: string;
  body: string;
  is_active: boolean;
  updated_at: string | null;
}
export interface ApiAuditLog {
  id: number;
  action: string;
  module: string;
  entity_type: string | null;
  entity_id: number | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  user_id: number | null;
  user_name: string | null;
  created_at: string;
}
export interface ApiSchedulerRun {
  id: number;
  at: string;
  today: string;
  trigger: string;
  triggered_by: number | null;
  checked: number;
  late_marked: number;
  sent: number;
  skipped: number;
  failed: number;
  details: { code: string; action: string }[];
}
export interface ApiBackup {
  file: string;
  size_kb: number;
  created_at: string;
}
export interface Paging {
  page?: number;
  per_page?: number;
}

/** Ambil semua halaman dari endpoint berpaginasi. */
export async function fetchAll<T>(path: string, query: object = {}, perPage = 100): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page < 1000; page++) {
    const res: ApiEnvelope<T[]> = await api.get<T[]>(path, { ...query, page, per_page: perPage });
    out.push(...(res.data || []));
    const total = res.meta?.total;
    if (total === undefined || out.length >= total || !res.data?.length) break;
  }
  return out;
}

const API_BASE = () => (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api/v1').replace(/\/+$/, '');

/* ================= Auth ================= */
export const authApi = {
  async login(username: string, password: string) {
    const res = await request<LoginResponse>('/auth/login', { method: 'POST', body: { username, password }, anonymous: true });
    tokenStore.set({ access_token: res.data.access_token, refresh_token: res.data.refresh_token });
    return res.data;
  },
  async exchangeSso(code: string) {
    const res = await request<LoginResponse>('/auth/sso/exchange', { method: 'POST', body: { code }, anonymous: true });
    tokenStore.set({ access_token: res.data.access_token, refresh_token: res.data.refresh_token });
    return res.data;
  },
  me: () => api.get<ApiUser>('/auth/me').then((r) => r.data),
  updateMe: (body: { full_name?: string; email?: string; phone?: string | null }) => api.put<ApiUser>('/auth/me', body).then((r) => r.data),
  changePassword: (current_password: string, new_password: string) => api.post<null>('/auth/change-password', { current_password, new_password }),
  async logout() {
    const t = tokenStore.get();
    try {
      await api.post('/auth/logout', { refresh_token: t?.refresh_token });
    } catch {
      /* token mungkin sudah kedaluwarsa — tetap keluar di sisi klien */
    } finally {
      tokenStore.set(null);
    }
  },
  /** URL login SSO (OAuth/OIDC) yang ditangani backend. */
  ssoUrl: () => `${API_BASE()}/auth/google`,
};

/* ================= Pengguna & role ================= */
export const usersApi = {
  list: () => api.get<ApiUserRow[]>('/users').then((r) => r.data),
  directory: () => api.get<ApiDirectoryUser[]>('/users/directory').then((r) => r.data),
  create: (body: Record<string, unknown>) => api.post<ApiUserRow>('/users', body).then((r) => r.data),
  update: (id: number, body: Record<string, unknown>) => api.put<ApiUserRow>(`/users/${id}`, body).then((r) => r.data),
  remove: (id: number) => api.del<null>(`/users/${id}`),
  roles: () => api.get<ApiRole[]>('/roles').then((r) => r.data),
  createRole: (body: Record<string, unknown>) => api.post<ApiRole>('/roles', body).then((r) => r.data),
  updateRole: (id: number, body: Record<string, unknown>) => api.put<ApiRole>(`/roles/${id}`, body).then((r) => r.data),
};

/* ================= Inventaris ================= */
export const assetsApi = {
  list: (q: Paging & { search?: string; category_id?: number; location_id?: number; status?: string; condition?: string } = {}) => api.get<ApiAsset[]>('/assets', q),
  all: () => fetchAll<ApiAsset>('/assets'),
  get: (id: number) => api.get<ApiAsset>(`/assets/${id}`).then((r) => r.data),
  create: (body: ApiAssetInput) => api.post<ApiAsset>('/assets', body).then((r) => r.data),
  update: (id: number, body: ApiAssetInput) => api.put<ApiAsset>(`/assets/${id}`, body).then((r) => r.data),
  setStatus: (id: number, status: string, reason?: string) => api.post<ApiAsset>(`/assets/${id}/status`, { status, reason }).then((r) => r.data),
  deactivate: (id: number) => api.del<null>(`/assets/${id}`),
  history: (id: number) => api.get<ApiAssetHistory[]>(`/assets/${id}/history`).then((r) => r.data),
  uploadPhotos: (id: number, files: File[], primary = false) => {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    if (primary) fd.append('primary', 'true');
    return api.upload<ApiAsset>(`/assets/${id}/photos`, fd).then((r) => r.data);
  },
  deletePhoto: (id: number, photoId: number) => api.del<ApiAsset>(`/assets/${id}/photos/${photoId}`).then((r) => r.data),
  orderPhotos: (id: number, photo_ids: number[]) => api.put<ApiAsset>(`/assets/${id}/photos/order`, { photo_ids }).then((r) => r.data),
};

/* ================= Transaksi ================= */
export const borrowingsApi = {
  list: (q: Paging & { status?: string; borrower_id?: number } = {}) => api.get<ApiBorrowing[]>('/borrowings', q),
  all: () => fetchAll<ApiBorrowing>('/borrowings'),
  get: (id: number) => api.get<ApiBorrowing>(`/borrowings/${id}`).then((r) => r.data),
  create: (body: ApiBorrowingCreate) => api.post<ApiBorrowing>('/borrowings', body).then((r) => r.data),
  update: (id: number, body: ApiBorrowingCreate) => api.put<ApiBorrowing>(`/borrowings/${id}`, body).then((r) => r.data),
  checkout: (id: number) => api.post<ApiBorrowing>(`/borrowings/${id}/checkout`).then((r) => r.data),
  cancel: (id: number, reason: string) => api.post<ApiBorrowing>(`/borrowings/${id}/cancel`, { reason }).then((r) => r.data),
};

export const returnsApi = {
  all: () => fetchAll<ApiReturn>('/returns'),
  get: (id: number) => api.get<ApiReturn>(`/returns/${id}`).then((r) => r.data),
  create: (body: ApiReturnCreate) => api.post<ApiReturn>('/returns', body).then((r) => r.data),
  damageReports: () => fetchAll<unknown>('/damage-reports'),
  updateRepairStatus: (id: number, body: { repair_status: string; action_taken?: string; repair_cost?: number }) =>
    api.put<unknown>(`/damage-reports/${id}/repair-status`, body).then((r) => r.data),
  lossReports: () => fetchAll<unknown>('/loss-reports'),
};

/* ================= Master data ================= */
export type MasterPath = 'organizational-units' | 'categories' | 'locations' | 'borrowers';
export const masterApi = {
  units: () => api.get<ApiUnit[]>('/organizational-units', { all: 1 }).then((r) => r.data),
  categories: () => api.get<ApiCategory[]>('/categories', { all: 1 }).then((r) => r.data),
  locations: () => api.get<ApiLocation[]>('/locations', { all: 1 }).then((r) => r.data),
  borrowers: () => fetchAll<ApiBorrower>('/borrowers', { all: 1 }),
  create: (path: MasterPath, body: Record<string, unknown>) => api.post<{ id: number }>(`/${path}`, body).then((r) => r.data),
  update: (path: MasterPath, id: number, body: Record<string, unknown>) => api.put<{ id: number }>(`/${path}/${id}`, body).then((r) => r.data),
  remove: (path: MasterPath, id: number) => api.del<null>(`/${path}/${id}`),
};

/* ================= Notifikasi ================= */
export const notificationsApi = {
  all: () => fetchAll<ApiNotification>('/notifications'),
  templates: () => api.get<ApiTemplate[]>('/notifications/templates').then((r) => r.data),
  updateTemplate: (id: number, body: Partial<Pick<ApiTemplate, 'name' | 'subject' | 'body' | 'is_active'>>) =>
    api.put<ApiTemplate>(`/notifications/templates/${id}`, body).then((r) => r.data),
  resend: (id: number) => api.post<ApiNotification>(`/notifications/${id}/resend`).then((r) => r.data),
  read: (id: number) => api.post<unknown>(`/notifications/${id}/read`),
  readAll: () => api.post<{ marked: number }>('/notifications/read-all'),
};

/* ================= Dashboard, laporan, audit ================= */
export const dashboardApi = {
  summary: () => api.get<Record<string, unknown>>('/dashboard/summary').then((r) => r.data),
  overdue: () => api.get<unknown[]>('/dashboard/overdue').then((r) => r.data),
  statistics: (months = 12) => api.get<Record<string, unknown>>('/dashboard/statistics', { months }).then((r) => r.data),
};
export const reportsApi = {
  download: (type: string, format: 'xlsx' | 'pdf', filters: Record<string, string | undefined>) => download(`/reports/${type}`, { ...filters, format }),
};
export const auditApi = {
  all: () => fetchAll<ApiAuditLog>('/audit-logs', {}, 200),
};

/* ================= Pengaturan, scheduler, backup ================= */
export const settingsApi = {
  get: () => api.get<Record<string, unknown>>('/settings').then((r) => r.data),
  update: (body: Record<string, unknown>) => api.put<Record<string, unknown>>('/settings', body).then((r) => r.data),
  testSmtp: () => api.post<{ ok: boolean; mode: string }>('/settings/smtp/test'),
  runScheduler: (date?: string) => api.post<ApiSchedulerRun>('/scheduler/run', date ? { date } : {}),
  schedulerRuns: () => api.get<ApiSchedulerRun[]>('/scheduler/runs').then((r) => r.data),
  backups: () => api.get<ApiBackup[]>('/backups').then((r) => r.data),
  backupNow: () => api.post<{ file: string; size_kb: number; status: string }>('/backups'),
  downloadBackup: (name: string) => download(`/backups/${encodeURIComponent(name)}`),
};
