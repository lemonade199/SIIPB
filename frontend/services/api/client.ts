/**
 * HTTP client untuk Flask REST API SIIPB (`/api/v1`).
 *
 * - Envelope respons backend: { success, message, data, meta?, error_code?, errors? }
 * - Access token dikirim sebagai `Authorization: Bearer …`
 * - Bila access token kedaluwarsa (401), refresh token dipakai sekali untuk memperbarui.
 */

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api/v1').replace(/\/+$/, '');

/** URL absolut API. `NEXT_PUBLIC_API_BASE_URL=/api/v1` (di balik Nginx yang sama) didukung. */
export const apiBaseAbsolute = () =>
  API_BASE_URL.startsWith('/') ? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost') + API_BASE_URL : API_BASE_URL;

const TOKEN_KEY = 'siipb.api.tokens';

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: { page: number; per_page: number; total: number };
  error_code?: string;
  errors?: Record<string, string[] | string>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public errors?: Record<string, string[] | string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface Tokens {
  access_token: string;
  refresh_token: string;
}

export const tokenStore = {
  get(): Tokens | null {
    if (typeof window === 'undefined') return null;
    try {
      return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
    } catch {
      return null;
    }
  },
  set(t: Tokens | null) {
    if (typeof window === 'undefined') return;
    if (t) localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
    else localStorage.removeItem(TOKEN_KEY);
  },
};

type Query = object;

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  query?: Query;
  body?: unknown;
  /** Lewati header Authorization (mis. login). */
  anonymous?: boolean;
}

function buildUrl(path: string, query?: Query) {
  const url = new URL(apiBaseAbsolute() + (path.startsWith('/') ? path : `/${path}`));
  Object.entries((query || {}) as Record<string, unknown>).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });
  return url.toString();
}

let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const t = tokenStore.get();
  if (!t?.refresh_token) return false;
  refreshing ??= fetch(buildUrl('/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: t.refresh_token }),
  })
    .then(async (res) => {
      if (!res.ok) return false;
      const json = (await res.json()) as ApiEnvelope<Partial<Tokens>>;
      if (!json.data?.access_token) return false;
      tokenStore.set({ access_token: json.data.access_token, refresh_token: json.data.refresh_token || t.refresh_token });
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function request<T>(path: string, opts: RequestOptions = {}, retry = true): Promise<ApiEnvelope<T>> {
  const { query, body, anonymous, headers, ...init } = opts;
  const h = new Headers(headers);
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) h.set('Content-Type', 'application/json');
  h.set('Accept', 'application/json');
  const tokens = tokenStore.get();
  if (!anonymous && tokens?.access_token) h.set('Authorization', `Bearer ${tokens.access_token}`);

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      ...init,
      headers: h,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Tidak dapat terhubung ke server SIIPB. Periksa koneksi atau NEXT_PUBLIC_API_BASE_URL.', 0, 'NETWORK_ERROR');
  }

  if (res.status === 401 && retry && !anonymous && (await refreshTokens())) return request<T>(path, opts, false);

  let json: ApiEnvelope<T> | null = null;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    json = null;
  }
  if (!res.ok || !json || json.success === false) {
    if (res.status === 401) tokenStore.set(null);
    throw new ApiError(json?.message || `Permintaan gagal (HTTP ${res.status}).`, res.status, json?.error_code, json?.errors);
  }
  return json;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>(path, { method: 'GET', query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, form: FormData) => request<T>(path, { method: 'POST', body: form }),
};

/** Unduh berkas biner (laporan PDF/Excel, backup) dengan header Authorization. */
export async function download(path: string, query?: Query, retry = true): Promise<{ blob: Blob; filename: string }> {
  const tokens = tokenStore.get();
  const h = new Headers();
  if (tokens?.access_token) h.set('Authorization', `Bearer ${tokens.access_token}`);
  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), { headers: h });
  } catch {
    throw new ApiError('Tidak dapat terhubung ke server SIIPB.', 0, 'NETWORK_ERROR');
  }
  if (res.status === 401 && retry && (await refreshTokens())) return download(path, query, false);
  if (!res.ok) {
    let msg = `Unduhan gagal (HTTP ${res.status}).`;
    try {
      msg = ((await res.json()) as ApiEnvelope<unknown>).message || msg;
    } catch {
      /* bukan JSON */
    }
    throw new ApiError(msg, res.status);
  }
  const cd = res.headers.get('Content-Disposition') || '';
  const filename = /filename="?([^";]+)"?/i.exec(cd)?.[1] || path.split('/').pop() || 'unduhan';
  return { blob: await res.blob(), filename };
}
