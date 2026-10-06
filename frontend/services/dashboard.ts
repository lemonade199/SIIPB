/** Statistik dashboard. */
import { db } from '@/lib/mock/db';
import { MON, pad, parseDate, relDue, today as todayStr } from '@/lib/date';
import { ITEM_STATUS } from '@/lib/constants';
import { activeBorrowings, item } from '@/services/lookup';
import type { Borrowing, ItemStatus } from '@/types';

export interface DashboardStats {
  total: number;
  byStatus: Record<ItemStatus, number>;
  active: Borrowing[];
  due: Borrowing[];
  late: Borrowing[];
  returnsMonth: number;
  months: { key: string; label: string; count: number }[];
  perCat: { name: string; count: number }[];
  drafts: Borrowing[];
}

export function stats(): DashboardStats {
  const today = todayStr();
  const items = db.where('items', (i) => i.active);
  const byStatus = Object.fromEntries(ITEM_STATUS.map((s) => [s, 0])) as Record<ItemStatus, number>;
  items.forEach((i) => {
    byStatus[i.item_status] = (byStatus[i.item_status] || 0) + 1;
  });
  const active = activeBorrowings();
  const due = active.filter((b) => {
    const n = relDue(b.due_date, today).n;
    return n >= 0 && n <= 3;
  });
  const late = active.filter((b) => relDue(b.due_date, today).n < 0);
  const monthKey = today.slice(0, 7);
  const returnsMonth = db.where('returns', (r) => r.return_date.slice(0, 7) === monthKey).length;
  const counted = (b: Borrowing) => b.status !== 'DIBATALKAN' && b.status !== 'DRAF';
  const months = [];
  for (let k = 5; k >= 0; k--) {
    const dt = parseDate(today);
    dt.setDate(1);
    dt.setMonth(dt.getMonth() - k);
    const key = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
    months.push({ key, label: MON[dt.getMonth()], count: db.where('borrowings', (b) => counted(b) && b.borrow_date.slice(0, 7) === key).length });
  }
  const perCat = db
    .all('categories')
    .map((c) => ({
      name: c.name,
      count: db.where('borrowing_details', (d) => {
        const it = item(d.item_id);
        const b = db.get('borrowings', d.borrowing_id);
        return !!it && it.category_id === c.id && !!b && counted(b);
      }).length,
    }))
    .sort((a, b) => b.count - a.count);
  return { total: items.length, byStatus, active, due, late, returnsMonth, months, perCat, drafts: db.where('borrowings', (b) => b.status === 'DRAF') };
}
