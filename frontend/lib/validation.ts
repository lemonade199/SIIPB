/**
 * Aturan NIP & nomor telepon — sama dengan backend (app/utils/validators.py).
 * Telepon disimpan seragam: angka saja diawali 0, mis. "+62 812-3456-7890" -> "081234567890".
 */
export const NIP_ERROR = 'NIP harus 18 digit angka.';
export const PHONE_ERROR = 'Nomor telepon harus 10–13 digit angka dan diawali 0 (mis. 081234567890).';

export const normalizeNip = (v?: string | null) => String(v ?? '').replace(/\s+/g, '');
export const nipError = (nip: string) => (nip && !/^\d{18}$/.test(nip) ? NIP_ERROR : undefined);

export function normalizePhone(v?: string | null) {
  let p = String(v ?? '').replace(/[\s\-().]/g, '');
  if (p.startsWith('+62')) p = '0' + p.slice(3);
  else if (p.startsWith('62')) p = '0' + p.slice(2);
  return p;
}
export const phoneError = (phone: string) => (phone && !/^0\d{9,12}$/.test(phone) ? PHONE_ERROR : undefined);
