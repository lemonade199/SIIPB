/** Lookup & tampilan turunan (setara query helper / serializer di backend). */
import { db } from '@/lib/mock/db';
import { diffDays, localDate, relDue, today as todayStr, type RelDue } from '@/lib/date';
import type { Borrowing, BorrowDisplay, Condition, ID, Item, ItemStatus, Return } from '@/types';

export const cat = (id: ID | null | undefined) => db.get('categories', id);
export const loc = (id: ID | null | undefined) => db.get('locations', id);
export const unit = (id: ID | null | undefined) => db.get('units', id);
export const emp = (id: ID | null | undefined) => db.get('employees', id);
export const user = (id: ID | null | undefined) => db.get('users', id);
export const item = (id: ID | null | undefined) => db.get('items', id);
export const role = (id: ID | null | undefined) => db.get('roles', id);
export const borrowing = (id: ID | string | null | undefined) => db.get('borrowings', id);
export const returnById = (id: ID | string | null | undefined) => db.get('returns', id);

export const itemByCode = (code: string) =>
  db.find('items', (i) => i.item_code.toLowerCase() === String(code || '').trim().toLowerCase());
export const borrowingByCode = (code: string) =>
  db.find('borrowings', (b) => b.code.toLowerCase() === String(code || '').trim().toLowerCase());
export const returnByCode = (code: string) =>
  db.find('returns', (r) => r.code.toLowerCase() === String(code || '').trim().toLowerCase());

export const detailsOf = (b: Borrowing) => db.where('borrowing_details', (d) => d.borrowing_id === b.id);
export const itemsOf = (b: Borrowing): Item[] => detailsOf(b).map((d) => item(d.item_id)).filter((x): x is Item => !!x);
export const returnOf = (b: Borrowing) => db.find('returns', (r) => r.borrowing_id === b.id);
export const returnDetails = (r: Return) => db.where('return_details', (d) => d.return_id === r.id);
export const userName = (id: ID | null | undefined) => (id === 0 ? 'Sistem (scheduler)' : user(id)?.name || '—');

export const isBorrowable = (it: Item | null | undefined): boolean => !!it && it.active && it.item_status === 'TERSEDIA';
export const borrowableItems = () => db.where('items', (i) => isBorrowable(i));
export const isActive = (b: Borrowing) => b.status === 'DIPINJAM' || b.status === 'TERLAMBAT';
export const activeBorrowings = () => db.where('borrowings', isActive);
export const activeBorrowingOfItem = (itemId: ID) =>
  db.find('borrowings', (b) => isActive(b) && detailsOf(b).some((d) => d.item_id === itemId));

export interface BorrowView {
  rel: RelDue;
  display: BorrowDisplay;
  lateDays: number;
}
/** Status tampilan: DIPINJAM yang sisa 0–3 hari ditandai "JATUH TEMPO". */
export function borrowView(b: Borrowing, today = todayStr()): BorrowView {
  const rel = relDue(b.due_date, today);
  let display: BorrowDisplay = b.status;
  if (isActive(b)) display = rel.n < 0 ? 'TERLAMBAT' : rel.n <= 3 ? 'JATUH TEMPO' : 'DIPINJAM';
  let lateDays = 0;
  if (b.status === 'DIKEMBALIKAN' && b.returned_at) lateDays = Math.max(0, diffDays(b.due_date, localDate(b.returned_at)));
  else if (isActive(b)) lateDays = Math.max(0, -rel.n);
  return { rel, display, lateDays };
}

export const isLate = (b: Borrowing, today = todayStr()) => relDue(b.due_date, today).n < 0;
export const isDueSoon = (b: Borrowing, today = todayStr()) => {
  const n = relDue(b.due_date, today).n;
  return n >= 0 && n <= 3;
};

/* ---------- Parameter status & kondisi (master data) ---------- */
export const conditionLabel = (c: Condition | null | undefined) => (c ? db.data.settings.parameters?.condition[c]?.label || c : '—');
export const statusLabel = (s: ItemStatus) => db.data.settings.parameters?.item_status[s]?.label || s;
export const statusDesc = (s: ItemStatus) => db.data.settings.parameters?.item_status[s]?.desc || '';
