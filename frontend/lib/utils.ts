import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Gabungkan className (pola shadcn/ui). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const rupiah = (n: number | string | null | undefined) =>
  n === null || n === undefined || n === '' ? '—' : 'Rp ' + Number(n).toLocaleString('id-ID');

export const num = (n: number | null | undefined) => Number(n || 0).toLocaleString('id-ID');

export const initials = (name?: string | null) =>
  String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

export const uid = () => Math.random().toString(36).slice(2, 10);

export const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));

/** Pencarian teks sederhana (tidak peka huruf besar/kecil) pada beberapa kolom. */
export function match(q: string, ...fields: unknown[]) {
  if (!q) return true;
  const s = q.toLowerCase();
  return fields.some((f) => String(f ?? '').toLowerCase().includes(s));
}

export interface Page<T> {
  rows: T[];
  page: number;
  pages: number;
  total: number;
  from: number;
  to: number;
}
export function paginate<T>(arr: T[], page: number, size: number): Page<T> {
  const pages = Math.max(1, Math.ceil(arr.length / size));
  const p = Math.min(Math.max(1, page), pages);
  return {
    rows: arr.slice((p - 1) * size, p * size),
    page: p,
    pages,
    total: arr.length,
    from: arr.length ? (p - 1) * size + 1 : 0,
    to: Math.min(p * size, arr.length),
  };
}

export const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Kode dari pemindai QR berformat "SIIPB:INV-XXX-0000". */
export const stripQrPrefix = (code: string) => String(code || '').trim().replace(/^SIIPB:/i, '');

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
