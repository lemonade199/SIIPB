'use client';

import { relDue } from '@/lib/date';
import { Badge } from '@/components/ui/badge';
import { borrowView } from '@/services/lookup';
import type { Borrowing } from '@/types';

/** Badge status transaksi (DIPINJAM yang sisa ≤ 3 hari tampil "JATUH TEMPO"). */
export function BorrowBadge({ b }: { b: Borrowing }) {
  return <Badge status={borrowView(b).display} />;
}

/** Teks sisa waktu / keterlambatan transaksi. */
export function DueText({ b }: { b: Borrowing }) {
  if (b.status === 'DIKEMBALIKAN') {
    const late = borrowView(b).lateDays;
    return late ? <span className="text-late">Terlambat {late} hari</span> : <span className="text-ok">Tepat waktu</span>;
  }
  if (b.status === 'DRAF' || b.status === 'DIBATALKAN') return <span className="muted">—</span>;
  const r = relDue(b.due_date);
  const cls = r.n < 0 ? 'text-late' : r.n <= 3 ? 'text-warn' : 'muted';
  return (
    <span className={cls}>
      <span className="mono">{r.label}</span> · {r.text}
    </span>
  );
}

export function LateText({ days }: { days: number }) {
  return days ? <span className="text-late">{days} hari</span> : <span className="text-ok">Tepat waktu</span>;
}
