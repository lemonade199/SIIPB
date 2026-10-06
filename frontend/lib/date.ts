/**
 * Utilitas tanggal.
 * Tanggal disimpan sebagai 'YYYY-MM-DD', waktu sebagai ISO string.
 * "Hari ini" dapat digeser (mode demo) untuk mensimulasikan H-3 … H+7.
 */

let offsetProvider: () => number = () => 0;

/** Didaftarkan oleh lapisan data agar util tanggal tahu pergeseran hari mode demo. */
export function setDayOffsetProvider(fn: () => number) {
  offsetProvider = fn;
}

export const offsetDays = () => offsetProvider();

export const pad = (n: number) => String(n).padStart(2, '0');
export const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function now(): Date {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays());
  return d;
}
export const nowISO = () => now().toISOString();
export const localDate = (iso: string) => toDateStr(new Date(iso));
export const today = () => toDateStr(now());

export function ymd(s: string): [number, number, number] {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return [y, m - 1, d];
}
export function parseDate(s: string): Date {
  const [y, m, d] = ymd(s);
  return new Date(y, m, d);
}
export function addDays(s: string, n: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}
/** Selisih hari kalender: b - a. */
export const diffDays = (a: string, b: string) => Math.round((Date.UTC(...ymd(b)) - Date.UTC(...ymd(a))) / 86400000);

export const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function fmtDate(s: string | null | undefined, long = false): string {
  if (!s) return '—';
  const d = parseDate(s);
  if (long) return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
}
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}.${pad(d.getMinutes())}`;
}
export function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getHours())}.${pad(d.getMinutes())}`;
}

export interface RelDue {
  label: string;
  text: string;
  /** positif = masih sisa hari, 0 = hari ini, negatif = terlambat */
  n: number;
}
export function relDue(due: string, ref?: string): RelDue {
  const n = diffDays(ref || today(), due);
  if (n > 0) return { label: `H-${n}`, text: `${n} hari lagi`, n };
  if (n === 0) return { label: 'H', text: 'Hari ini', n };
  return { label: `H+${-n}`, text: `Terlambat ${-n} hari`, n };
}

export function atTime(dateStr: string, hhmm = '08:00'): string {
  const d = parseDate(dateStr);
  const [h, m] = String(hhmm).split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
}

export function greeting(d: Date = now()) {
  const h = d.getHours();
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
}
