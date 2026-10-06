/**
 * Endpoint Flask REST API SIIPB yang sudah tersedia di `backend/app/routes`.
 * Bentuk DTO mengikuti serializer backend (snake_case).
 */
import { api, request, tokenStore } from '@/services/api/client';

/* ---------- DTO ---------- */
export interface ApiUser {
  id: number;
  username: string;
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
  location_id: number;
  location_name: string | null;
  owner_unit_id: number | null;
  owner_unit_name: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}
export interface ApiBorrowing {
  id: number;
  transaction_number: string;
  borrower_id: number;
  borrower: { id: number; name: string; identity_number: string; email: string; phone: string };
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
export interface ApiReturnCreate {
  borrowing_id: number;
  notes?: string;
  items: {
    borrowing_item_id: number;
    asset_id: number;
    final_condition: string;
    completeness?: string;
    damage?: { severity: string; description: string; repair_cost?: number };
  }[];
}
export interface Paging {
  page?: number;
  per_page?: number;
}

/* ---------- Auth ---------- */
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
    } finally {
      tokenStore.set(null);
    }
  },
  /** URL redirect login Google/SSO (ditangani backend, callback mengembalikan token). */
  ssoUrl: () => `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api/v1'}/auth/google`,
};

/* ---------- Inventaris ---------- */
export const assetsApi = {
  list: (q: Paging & { search?: string; category_id?: number; location_id?: number; status?: string; condition?: string } = {}) =>
    api.get<ApiAsset[]>('/assets', q),
  get: (id: number) => api.get<ApiAsset>(`/assets/${id}`).then((r) => r.data),
  create: (body: Partial<ApiAsset>) => api.post<ApiAsset>('/assets', body).then((r) => r.data),
  update: (id: number, body: Partial<ApiAsset>) => api.put<ApiAsset>(`/assets/${id}`, body).then((r) => r.data),
  remove: (id: number) => api.del<null>(`/assets/${id}`),
  history: (id: number) => api.get<unknown[]>(`/assets/${id}/history`).then((r) => r.data),
  uploadPhoto: (id: number, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.upload<{ photo_path: string }>(`/assets/${id}/upload-photo`, fd).then((r) => r.data);
  },
};

/* ---------- Transaksi ---------- */
export const borrowingsApi = {
  list: (q: Paging & { status?: string; borrower_id?: number } = {}) => api.get<ApiBorrowing[]>('/borrowings', q),
  get: (id: number) => api.get<ApiBorrowing>(`/borrowings/${id}`).then((r) => r.data),
  create: (body: ApiBorrowingCreate) => api.post<ApiBorrowing>('/borrowings', body).then((r) => r.data),
};

export const returnsApi = {
  list: (q: Paging = {}) => api.get<unknown[]>('/returns', q),
  get: (id: number) => api.get<unknown>(`/returns/${id}`).then((r) => r.data),
  create: (body: ApiReturnCreate) => api.post<unknown>('/returns', body).then((r) => r.data),
  damageReports: (q: Paging = {}) => api.get<unknown[]>('/damage-reports', q),
  updateRepairStatus: (id: number, body: { status: string; notes?: string; repair_cost?: number }) =>
    api.put<unknown>(`/damage-reports/${id}/repair-status`, body).then((r) => r.data),
  lossReports: (q: Paging = {}) => api.get<unknown[]>('/loss-reports', q),
};

/* ---------- Master data ---------- */
export const masterApi = {
  units: () => api.get<unknown[]>('/organizational-units').then((r) => r.data),
  createUnit: (body: Record<string, unknown>) => api.post<unknown>('/organizational-units', body).then((r) => r.data),
  categories: () => api.get<unknown[]>('/categories').then((r) => r.data),
  createCategory: (body: Record<string, unknown>) => api.post<unknown>('/categories', body).then((r) => r.data),
  locations: () => api.get<unknown[]>('/locations').then((r) => r.data),
  createLocation: (body: Record<string, unknown>) => api.post<unknown>('/locations', body).then((r) => r.data),
  borrowers: (q: Paging & { search?: string } = {}) => api.get<unknown[]>('/borrowers', q),
  createBorrower: (body: Record<string, unknown>) => api.post<unknown>('/borrowers', body).then((r) => r.data),
  updateBorrower: (id: number, body: Record<string, unknown>) => api.put<unknown>(`/borrowers/${id}`, body).then((r) => r.data),
  deleteBorrower: (id: number) => api.del<null>(`/borrowers/${id}`),
};

/* ---------- Notifikasi, dashboard, audit ---------- */
export const notificationsApi = {
  list: (q: Paging & { status?: string } = {}) => api.get<unknown[]>('/notifications', q),
  templates: () => api.get<unknown[]>('/notifications/templates').then((r) => r.data),
  resend: (id: number) => api.post<unknown>(`/notifications/${id}/resend`).then((r) => r.data),
};
export const dashboardApi = {
  summary: () => api.get<Record<string, unknown>>('/dashboard/summary').then((r) => r.data),
};
export const auditApi = {
  list: (q: Paging & { action?: string; user_id?: number } = {}) => api.get<unknown[]>('/audit-logs', q),
};
