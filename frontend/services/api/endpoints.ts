/**
 * Endpoint Flask REST API SIIPB yang tersedia di `backend/app/routes` (prefix /api/v1).
 * Bentuk DTO mengikuti serializer backend (snake_case) — diverifikasi terhadap backend yang berjalan.
 */
import { api, request, tokenStore, type ApiEnvelope } from '@/services/api/client';

/* ================= DTO ================= */
export interface ApiUser {
  id: number;
  username: string;
  email?: string;
  full_name?: string;
  roles: string[];
  permissions: string[];
}
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  user: ApiUser;
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
  purchase_date: string | null;
  acquisition_cost: number | null;
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
  inventory_code?: string;
  category_id?: number;
  location_id?: number | null;
  name?: string;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  description?: string | null;
  purchase_date?: string | null;
  acquisition_cost?: number | null;
  condition?: string;
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
  items: { id: number; asset_id: number; asset_name: string | null; inventory_code: string | null; checked_out_at: string | null }[];
  created_at: string | null;
}
export interface ApiBorrowingCreate {
  borrower_id: number;
  start_date: string;
  due_date: string;
  purpose?: string;
  notes?: string;
  asset_ids: number[];
}
export interface ApiReturnItem {
  id: number;
  borrowing_item_id: number;
  asset_id: number;
  asset_name: string | null;
  inventory_code: string | null;
  final_condition: 'BAIK' | 'RUSAK' | 'HILANG';
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
  notes: string | null;
  created_at: string;
  items: ApiReturnItem[];
}
export interface ApiReturnCreate {
  borrowing_id: number;
  notes?: string;
  items: {
    borrowing_item_id: number;
    asset_id: number;
    final_condition: 'BAIK' | 'RUSAK' | 'HILANG';
    completeness?: string;
    notes?: string;
    damage?: { severity: 'RINGAN' | 'SEDANG' | 'BERAT'; description: string; repair_cost?: number };
    loss?: { description: string };
  }[];
}
export interface ApiNotification {
  id: number;
  event_id: number | null;
  borrower_id: number | null;
  channel: string;
  recipient: string;
  subject: string;
  status: string;
  sent_at: string | null;
  created_at: string | null;
  deliveries: { attempt: number; status: string; error: string | null; attempted_at: string | null }[];
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

/* ================= Auth ================= */
export const authApi = {
  async login(username: string, password: string) {
    const res = await request<LoginResponse>('/auth/login', { method: 'POST', body: { username, password }, anonymous: true });
    tokenStore.set({ access_token: res.data.access_token, refresh_token: res.data.refresh_token });
    return res.data;
  },
  me: () => api.get<ApiUser>('/auth/me').then((r) => r.data),
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
  ssoUrl: () => `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api/v1'}/auth/google`,
};

/* ================= Inventaris ================= */
export const assetsApi = {
  list: (q: Paging & { search?: string; category_id?: number; location_id?: number; status?: string; condition?: string } = {}) => api.get<ApiAsset[]>('/assets', q),
  all: () => fetchAll<ApiAsset>('/assets'),
  get: (id: number) => api.get<ApiAsset>(`/assets/${id}`).then((r) => r.data),
  create: (body: ApiAssetInput) => api.post<ApiAsset>('/assets', body).then((r) => r.data),
  update: (id: number, body: ApiAssetInput) => api.put<ApiAsset>(`/assets/${id}`, body).then((r) => r.data),
  /** Backend: menonaktifkan aset (tidak menghapus riwayat). */
  deactivate: (id: number) => api.del<null>(`/assets/${id}`),
  history: (id: number) => api.get<ApiAssetHistory[]>(`/assets/${id}/history`).then((r) => r.data),
  uploadPhoto: (id: number, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.upload<{ photo_path: string } | ApiAsset>(`/assets/${id}/upload-photo`, fd).then((r) => r.data);
  },
};

/* ================= Transaksi ================= */
export const borrowingsApi = {
  list: (q: Paging & { status?: string; borrower_id?: number } = {}) => api.get<ApiBorrowing[]>('/borrowings', q),
  all: () => fetchAll<ApiBorrowing>('/borrowings'),
  get: (id: number) => api.get<ApiBorrowing>(`/borrowings/${id}`).then((r) => r.data),
  create: (body: ApiBorrowingCreate) => api.post<ApiBorrowing>('/borrowings', body).then((r) => r.data),
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
export const masterApi = {
  units: () => api.get<ApiUnit[]>('/organizational-units').then((r) => r.data),
  createUnit: (body: { code: string; name: string; parent_id?: number | null }) => api.post<ApiUnit>('/organizational-units', body).then((r) => r.data),
  categories: () => api.get<ApiCategory[]>('/categories').then((r) => r.data),
  createCategory: (body: { code: string; name: string; description?: string | null }) => api.post<ApiCategory>('/categories', body).then((r) => r.data),
  locations: () => api.get<ApiLocation[]>('/locations').then((r) => r.data),
  createLocation: (body: { code: string; name: string; parent_id?: number | null; description?: string | null }) =>
    api.post<ApiLocation>('/locations', body).then((r) => r.data),
  borrowers: () => fetchAll<ApiBorrower>('/borrowers'),
  createBorrower: (body: Partial<ApiBorrower>) => api.post<ApiBorrower>('/borrowers', body).then((r) => r.data),
  updateBorrower: (id: number, body: Partial<ApiBorrower>) => api.put<ApiBorrower>(`/borrowers/${id}`, body).then((r) => r.data),
  deleteBorrower: (id: number) => api.del<null>(`/borrowers/${id}`),
};

/* ================= Notifikasi, dashboard, audit ================= */
export const notificationsApi = {
  all: () => fetchAll<ApiNotification>('/notifications'),
  templates: () => api.get<unknown[]>('/notifications/templates').then((r) => r.data),
  resend: (id: number) => api.post<unknown>(`/notifications/${id}/resend`).then((r) => r.data),
};
export const dashboardApi = {
  summary: () => api.get<Record<string, unknown>>('/dashboard/summary').then((r) => r.data),
};
export const auditApi = {
  all: () => fetchAll<ApiAuditLog>('/audit-logs'),
};
